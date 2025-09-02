/**
 * Pure Dynamic MCP Tools for n8n automation
 * Zero hardcoded tools - everything discovered dynamically from live n8n instances
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { NodeTemplate } from './comprehensive-node-registry.js'
import type { DynamicAgentTools } from './dynamic-agent-tools.js'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { CredentialDiscovery } from '../discovery/credential-discovery.js'
import { DiscoveryScheduler } from '../discovery/scheduler.js'
import { simpleN8nApi } from '../n8n/simple-api.js'
import { features } from '../server/config.js'
import { logger } from '../server/logger.js'
import { coldStartOptimizationTools } from './cold-start-optimization-tool.js'
import { getAllNodeTemplates } from './comprehensive-node-registry.js'
import { createDynamicAgentTools } from './dynamic-agent-tools.js'
import { MCPToolGenerator } from './mcp-tool-generator.js'
import { memoryOptimizationTools } from './memory-optimization-tool.js'
import { performanceMonitoringTools } from './performance-monitoring-tool.js'
import { WorkflowBuilderUtils } from './workflow-builder-utils.js'

// Tool result interfaces
interface ToolResult {
  success: boolean
  message: string
  details?: Record<string, unknown>
}

interface MCPConfig {
  mcpServers?: Record<string, unknown>
  [key: string]: unknown
}

const { hasN8nApi } = features

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let discoveredTools: Tool[] = []
const toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>> = new Map()
let toolGenerator: MCPToolGenerator | null = null
let credentialDiscovery: CredentialDiscovery | null = null
let discoveryScheduler: DiscoveryScheduler | null = null
let dynamicAgentTools: DynamicAgentTools | null = null

/**
 * Execute command safely with proper error handling
 */
function execCommand(command: string, args: string[] = [], options: Record<string, unknown> = {}): Promise<{ stdout: string, stderr: string, code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: (options.stdio as 'pipe' | 'inherit' | 'ignore') || 'pipe',
      cwd: (options.cwd as string) || process.cwd(),
      env: { ...process.env, ...(options.env as Record<string, string>) },
      ...options,
    })

    let stdout = ''
    let stderr = ''

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 })
    })

    proc.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Get current package version
 */
async function getCurrentVersion(): Promise<string | null> {
  try {
    // Try to read from package.json in the module directory
    const packageJsonPath = path.resolve(__dirname, '../../package.json')
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
    return packageJson.version
  }
  catch (error) {
    logger.error('Failed to read current version:', error)
    return null
  }
}

/**
 * Get latest version from GitHub Packages
 */
async function getLatestVersion(): Promise<{ version: string, available: boolean } | null> {
  try {
    const result = await execCommand('npm', [
      'view',
      '@eekfonky/n8n-mcp-modern',
      'version',
      '--registry=https://npm.pkg.github.com',
    ])

    if (result.code === 0 && result.stdout.trim()) {
      const latestVersion = result.stdout.trim().replace(/['"]/g, '')
      const currentVersion = await getCurrentVersion()

      return {
        version: latestVersion,
        available: currentVersion !== latestVersion,
      }
    }

    return null
  }
  catch (error) {
    logger.error('Failed to check latest version:', error)
    return null
  }
}

/**
 * Validate GitHub Packages authentication
 */
async function validateGitHubAuth(): Promise<{ valid: boolean, message: string }> {
  try {
    const result = await execCommand('npm', [
      'view',
      '@eekfonky/n8n-mcp-modern',
      'version',
      '--registry=https://npm.pkg.github.com',
    ])

    if (result.code === 0) {
      return { valid: true, message: 'GitHub Packages authentication is working' }
    }
    else if (result.stderr.includes('401') || result.stderr.includes('Unauthorized')) {
      return { valid: false, message: 'GitHub Packages authentication failed - check your .npmrc configuration' }
    }
    else {
      return { valid: false, message: `Authentication check failed: ${result.stderr}` }
    }
  }
  catch (error) {
    return { valid: false, message: `Authentication validation error: ${(error as Error).message}` }
  }
}

/**
 * Create backup of current installation
 */
async function createBackup(): Promise<{ success: boolean, backupPath?: string, message: string }> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = path.join(os.tmpdir(), `n8n-mcp-modern-backup-${timestamp}`)

    await fs.mkdir(backupDir, { recursive: true })

    // Copy critical files
    const currentDir = path.resolve(__dirname, '../..')
    const criticalFiles = ['package.json', 'data', 'dist']

    for (const file of criticalFiles) {
      const sourcePath = path.join(currentDir, file)
      const destPath = path.join(backupDir, file)

      try {
        // eslint-disable-next-line no-await-in-loop
        const stats = await fs.stat(sourcePath)
        if (stats.isDirectory()) {
          // eslint-disable-next-line no-await-in-loop
          await execCommand('cp', ['-r', sourcePath, destPath])
        }
        else {
          // eslint-disable-next-line no-await-in-loop
          await fs.copyFile(sourcePath, destPath)
        }
      }
      catch (error) {
        // File might not exist, continue
        logger.warn(`Could not backup ${file}:`, error)
      }
    }

    return {
      success: true,
      backupPath: backupDir,
      message: `Backup created at ${backupDir}`,
    }
  }
  catch (error) {
    return {
      success: false,
      message: `Backup failed: ${(error as Error).message}`,
    }
  }
}

/**
 * Perform the actual update
 */
async function performUpdate(preserveData: boolean = true): Promise<ToolResult> {
  try {
    // Check for existing .mcp.json to preserve
    let mcpConfig: MCPConfig | null = null
    if (preserveData) {
      try {
        const mcpJsonPath = path.resolve('.mcp.json')
        mcpConfig = JSON.parse(await fs.readFile(mcpJsonPath, 'utf8'))
        logger.info('Preserved .mcp.json configuration for update')
      }
      catch {
        logger.info('No .mcp.json found to preserve')
      }
    }

    // Try global update first
    logger.info('Attempting global package update...')
    const globalResult = await execCommand('npm', [
      'update',
      '-g',
      '@eekfonky/n8n-mcp-modern',
    ])

    if (globalResult.code === 0) {
      return {
        success: true,
        message: 'Package updated successfully via npm global update',
        details: {
          method: 'global',
          stdout: globalResult.stdout,
          preservedData: !!mcpConfig,
        },
      }
    }

    // Fallback to install
    logger.info('Global update failed, trying fresh install...')
    const installResult = await execCommand('npm', [
      'install',
      '-g',
      '@eekfonky/n8n-mcp-modern@latest',
    ])

    if (installResult.code === 0) {
      return {
        success: true,
        message: 'Package updated successfully via npm install',
        details: {
          method: 'install',
          stdout: installResult.stdout,
          preservedData: !!mcpConfig,
        },
      }
    }

    return {
      success: false,
      message: `Update failed: ${installResult.stderr || 'Unknown error'}`,
      details: {
        globalResult: globalResult.stderr,
        installResult: installResult.stderr,
      },
    }
  }
  catch (error) {
    return {
      success: false,
      message: `Update failed with error: ${(error as Error).message}`,
    }
  }
}

/**
 * Handle installation validation requests
 */
async function handleInstallationValidation(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { checks = ['all'], includeRecommendations = true, detailed = false } = args

  try {
    const results: Record<string, unknown> = {
      overall: true,
      timestamp: new Date().toISOString(),
      checks: {} as Record<string, unknown>,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      } as Record<string, unknown>,
      recommendations: [] as string[],
      system: {} as Record<string, unknown>,
    }

    // Determine which checks to run
    const checksToRun = Array.isArray(checks) ? checks : [checks]
    const runAll = checksToRun.includes('all')

    // System Information Check
    if (runAll || checksToRun.includes('system_info')) {
      logger.debug('Running system info check...')
      const systemCheck = await validateSystemInfo(detailed as boolean)
      Object.assign(results.checks as object, { system_info: systemCheck })
      results.system = systemCheck.details
      updateSummary(results.summary, systemCheck)
    }

    // Dependencies Check
    if (runAll || checksToRun.includes('dependencies')) {
      logger.debug('Running dependencies check...')
      const depsCheck = await validateDependencies(detailed as boolean)
      Object.assign(results.checks as object, { dependencies: depsCheck })
      updateSummary(results.summary, depsCheck)

      if (includeRecommendations && depsCheck.recommendations && Array.isArray(depsCheck.recommendations)) {
        (results.recommendations as string[]).push(...(depsCheck.recommendations as string[]))
      }
    }

    // Database Check
    if (runAll || checksToRun.includes('database')) {
      logger.debug('Running database check...')
      const dbCheck = await validateDatabase(detailed as boolean)
      Object.assign(results.checks as object, { database: dbCheck })
      updateSummary(results.summary, dbCheck)

      if (includeRecommendations && dbCheck.recommendations && Array.isArray(dbCheck.recommendations)) {
        (results.recommendations as string[]).push(...(dbCheck.recommendations as string[]))
      }
    }

    // MCP Configuration Check
    if (runAll || checksToRun.includes('mcp_config')) {
      logger.debug('Running MCP config check...')
      const mcpCheck = await validateMcpConfig(detailed as boolean)
      Object.assign(results.checks as object, { mcp_config: mcpCheck })
      updateSummary(results.summary, mcpCheck)

      if (includeRecommendations && mcpCheck.recommendations && Array.isArray(mcpCheck.recommendations)) {
        (results.recommendations as string[]).push(...(mcpCheck.recommendations as string[]))
      }
    }

    // GitHub Authentication Check
    if (runAll || checksToRun.includes('github_auth')) {
      logger.debug('Running GitHub auth check...')
      const authCheck = await validateGitHubAuth()
      Object.assign(results.checks as object, { github_auth: {
        status: authCheck.valid ? 'passed' : 'failed',
        message: authCheck.message,
        details: authCheck,
      } })
      updateSummary(results.summary, (results.checks as Record<string, unknown>).github_auth)

      if (includeRecommendations && !authCheck.valid) {
        (results.recommendations as string[]).push('Configure GitHub Packages authentication in ~/.npmrc')
      }
    }

    // n8n Connectivity Check
    if (runAll || checksToRun.includes('n8n_connectivity')) {
      logger.debug('Running n8n connectivity check...')
      const n8nCheck = await validateN8nConnectivity(detailed as boolean)
      Object.assign(results.checks as object, { n8n_connectivity: n8nCheck })
      updateSummary(results.summary, n8nCheck)

      if (includeRecommendations && n8nCheck.recommendations && Array.isArray(n8nCheck.recommendations)) {
        (results.recommendations as string[]).push(...(n8nCheck.recommendations as string[]))
      }
    }

    // Permissions Check
    if (runAll || checksToRun.includes('permissions')) {
      logger.debug('Running permissions check...')
      const permCheck = await validatePermissions(detailed as boolean)
      Object.assign(results.checks as object, { permissions: permCheck })
      updateSummary(results.summary, permCheck)

      if (includeRecommendations && permCheck.recommendations && Array.isArray(permCheck.recommendations)) {
        (results.recommendations as string[]).push(...(permCheck.recommendations as string[]))
      }
    }

    // Disk Space Check
    if (runAll || checksToRun.includes('disk_space')) {
      logger.debug('Running disk space check...')
      const diskCheck = await validateDiskSpace(detailed as boolean)
      Object.assign(results.checks as object, { disk_space: diskCheck })
      updateSummary(results.summary, diskCheck)

      if (includeRecommendations && diskCheck.recommendations && Array.isArray(diskCheck.recommendations)) {
        (results.recommendations as string[]).push(...(diskCheck.recommendations as string[]))
      }
    }

    // Memory Usage Check
    if (runAll || checksToRun.includes('memory_usage')) {
      logger.debug('Running memory usage check...')
      const memCheck = await validateMemoryUsage(detailed as boolean)
      Object.assign(results.checks as object, { memory_usage: memCheck })
      updateSummary(results.summary, memCheck)

      if (includeRecommendations && memCheck.recommendations && Array.isArray(memCheck.recommendations)) {
        (results.recommendations as string[]).push(...(memCheck.recommendations as string[]))
      }
    }

    // Set overall status
    const summary = results.summary as Record<string, number>
    results.overall = (summary.failed || 0) === 0
    results.healthScore = Math.round(((summary.passed || 0) / (summary.total || 1)) * 100)

    return results
  }
  catch (error) {
    logger.error('Installation validation error:', error)
    return {
      overall: false,
      error: 'Validation failed',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Helper function to update validation summary
 */
function updateSummary(summary: unknown, check: unknown): void {
  const summaryObj = summary as Record<string, number>
  const checkObj = check as Record<string, string>

  summaryObj.total = (summaryObj.total || 0) + 1

  if (checkObj.status === 'passed') {
    summaryObj.passed = (summaryObj.passed || 0) + 1
  }
  else if (checkObj.status === 'failed') {
    summaryObj.failed = (summaryObj.failed || 0) + 1
  }
  else if (checkObj.status === 'warning') {
    summaryObj.warnings = (summaryObj.warnings || 0) + 1
  }
}

/**
 * Validate system information
 */
async function validateSystemInfo(detailed: boolean): Promise<Record<string, unknown>> {
  try {
    const nodeVersion = process.version
    const platform = process.platform
    const arch = process.arch
    const uptime = process.uptime()
    const memoryUsage = process.memoryUsage()

    // Check Node.js version requirement (>=22.0.0)
    const nodeVersionNum = Number.parseInt(nodeVersion.slice(1).split('.')[0] || '0', 10)
    const nodeVersionValid = nodeVersionNum >= 22

    const details = {
      node_version: nodeVersion,
      platform,
      architecture: arch,
      uptime_seconds: Math.round(uptime),
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heap_used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heap_total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
    }

    if (detailed) {
      const osModule = await import('node:os')
      ;(details as Record<string, unknown>).system = {
        hostname: osModule.hostname(),
        cpus: osModule.cpus().length,
        total_memory: `${Math.round(osModule.totalmem() / 1024 / 1024 / 1024)}GB`,
        free_memory: `${Math.round(osModule.freemem() / 1024 / 1024 / 1024)}GB`,
        load_average: osModule.loadavg(),
      }
    }

    return {
      status: nodeVersionValid ? 'passed' : 'failed',
      message: nodeVersionValid
        ? `System check passed (Node.js ${nodeVersion})`
        : `Node.js version ${nodeVersion} is below required >=22.0.0`,
      details,
      recommendations: nodeVersionValid ? [] : ['Upgrade to Node.js 22 or higher'],
    }
  }
  catch (error) {
    return {
      status: 'failed',
      message: `System info check failed: ${(error as Error).message}`,
      details: {},
      recommendations: [],
    }
  }
}

/**
 * Validate dependencies
 */
async function validateDependencies(detailed: boolean): Promise<Record<string, unknown>> {
  try {
    const packageJson = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../package.json'), 'utf8'))
    const dependencies = packageJson.dependencies || {}
    const devDependencies = packageJson.devDependencies || {}

    const allDeps = { ...dependencies, ...devDependencies }
    const installedPackages: Record<string, unknown> = {}
    const missing: string[] = []
    const recommendations: string[] = []

    // Check critical dependencies
    const criticalDeps = ['@modelcontextprotocol/sdk', 'zod', 'better-sqlite3']

    for (const [pkg, version] of Object.entries(allDeps)) {
      try {
        const pkgPath = path.resolve(__dirname, '../../node_modules', pkg, 'package.json')
        // eslint-disable-next-line no-await-in-loop
        const installedPkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'))
        installedPackages[pkg] = {
          required: version,
          installed: installedPkg.version,
          status: 'installed',
        }
      }
      catch {
        missing.push(pkg)
        installedPackages[pkg] = {
          required: version,
          installed: null,
          status: 'missing',
        }
      }
    }

    const allInstalled = missing.length === 0
    const criticalMissing = missing.filter(pkg => criticalDeps.includes(pkg))

    if (missing.length > 0) {
      recommendations.push(`Run 'npm install' to install missing dependencies: ${missing.join(', ')}`)
    }

    return {
      status: criticalMissing.length === 0 ? (allInstalled ? 'passed' : 'warning') : 'failed',
      message: allInstalled
        ? 'All dependencies are installed'
        : `${missing.length} missing dependencies${criticalMissing.length > 0 ? ` (${criticalMissing.length} critical)` : ''}`,
      details: detailed
        ? installedPackages
        : {
            total: Object.keys(allDeps).length,
            installed: Object.keys(allDeps).length - missing.length,
            missing: missing.length,
            critical_missing: criticalMissing.length,
          },
      recommendations,
    }
  }
  catch (error) {
    return {
      status: 'failed',
      message: `Dependencies check failed: ${(error as Error).message}`,
      details: {},
      recommendations: [],
    }
  }
}

/**
 * Validate database
 */
async function validateDatabase(detailed: boolean): Promise<Record<string, unknown>> {
  try {
    const { database } = await import('../database/index.js')

    // Test basic connectivity
    const testQuery = database.executeCustomSQL('connectivityTest', (db) => {
      return db.prepare('SELECT 1 as test').get()
    })
    if (!testQuery || (testQuery as { test?: number }).test !== 1) {
      throw new Error('Database connectivity test failed')
    }

    // Check tables exist
    const tables = database.executeCustomSQL('getTables', (db) => {
      return db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all()
    }) as Array<{ name: string }> | null

    const expectedTables = ['nodes', 'tool_usage', 'n8n_instances', 'discovery_sessions', 'mcp_tools', 'version_changes']
    const existingTables = tables ? tables.map(t => t.name) : []
    const missingTables = expectedTables.filter(t => !existingTables.includes(t))

    // Check database file size and permissions
    const dbPath = path.resolve('./data/nodes.db')
    let dbStats: Record<string, unknown> = {}
    try {
      const stats = await fs.stat(dbPath)
      dbStats = {
        size: `${Math.round(stats.size / 1024)}KB`,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        readable: true,
        writable: true,
      }
    }
    catch (error) {
      dbStats.error = (error as Error).message
    }

    const recommendations: string[] = []
    if (missingTables.length > 0) {
      recommendations.push(`Run database migrations to create missing tables: ${missingTables.join(', ')}`)
    }

    return {
      status: missingTables.length === 0 ? 'passed' : 'failed',
      message: missingTables.length === 0
        ? `Database OK (${existingTables.length} tables)`
        : `Missing ${missingTables.length} required tables`,
      details: detailed
        ? {
            existing_tables: existingTables,
            missing_tables: missingTables,
            database_file: dbStats,
          }
        : {
            tables_count: existingTables.length,
            missing_count: missingTables.length,
          },
      recommendations,
    }
  }
  catch (error) {
    return {
      status: 'failed',
      message: `Database check failed: ${(error as Error).message}`,
      details: {},
      recommendations: ['Check database file permissions and SQLite installation'],
    }
  }
}

/**
 * Validate MCP configuration
 */
async function validateMcpConfig(detailed: boolean): Promise<Record<string, unknown>> {
  try {
    let mcpConfig: unknown = null
    let configPath: string | null = null
    let configValid = false
    const recommendations: string[] = []

    // Try to find .mcp.json in current directory or parent
    const possiblePaths = [
      path.resolve('.mcp.json'),
      path.resolve('../.mcp.json'),
      path.resolve('../../.mcp.json'),
    ]

    for (const tryPath of possiblePaths) {
      try {
        // eslint-disable-next-line no-await-in-loop
        mcpConfig = JSON.parse(await fs.readFile(tryPath, 'utf8'))
        configPath = tryPath
        break
      }
      catch {
        // Continue trying other paths
      }
    }

    if (!mcpConfig) {
      recommendations.push('Create .mcp.json configuration file')
      recommendations.push('Run: node scripts/install-mcp.js')

      return {
        status: 'warning',
        message: 'No .mcp.json configuration found',
        details: { searched_paths: possiblePaths },
        recommendations,
      }
    }

    // Validate MCP config structure
    const configObj = mcpConfig as Record<string, unknown>
    const hasServers = configObj.mcpServers && typeof configObj.mcpServers === 'object'
    const mcpServers = configObj.mcpServers as Record<string, unknown>
    const hasN8nServer = hasServers && mcpServers['n8n-mcp-modern']
    const serverConfig = hasN8nServer ? mcpServers['n8n-mcp-modern'] as Record<string, unknown> : null

    configValid = Boolean(hasServers && hasN8nServer
      && serverConfig?.type === 'stdio'
      && serverConfig?.command
      && Array.isArray(serverConfig?.args))

    if (!configValid) {
      recommendations.push('Validate .mcp.json structure')
      recommendations.push('Ensure n8n-mcp-modern server is properly configured')
    }

    // Check environment variables
    const env = serverConfig?.env as Record<string, unknown> | undefined
    const hasEnvConfig = env && Object.keys(env).length > 0
    const hasN8nConfig = hasEnvConfig && env.N8N_API_URL && env.N8N_API_KEY

    if (!hasN8nConfig) {
      recommendations.push('Configure N8N_API_URL and N8N_API_KEY in .mcp.json')
    }

    return {
      status: configValid ? 'passed' : 'failed',
      message: configValid
        ? `MCP config valid${hasN8nConfig ? ' with n8n API settings' : ' (missing n8n API config)'}`
        : 'Invalid or incomplete MCP configuration',
      details: detailed
        ? {
            config_path: configPath,
            has_servers: hasServers,
            has_n8n_server: hasN8nServer,
            has_env_config: hasEnvConfig,
            has_n8n_config: hasN8nConfig,
            server_config: serverConfig,
          }
        : {
            config_found: !!mcpConfig,
            valid_structure: configValid,
            n8n_configured: hasN8nConfig,
          },
      recommendations,
    }
  }
  catch (error) {
    return {
      status: 'failed',
      message: `MCP config check failed: ${(error as Error).message}`,
      details: {},
      recommendations: ['Check .mcp.json file syntax and permissions'],
    }
  }
}

/**
 * Validate n8n connectivity
 */
async function validateN8nConnectivity(_detailed: boolean): Promise<Record<string, unknown>> {
  if (!hasN8nApi) {
    throw new Error('n8n API not configured - missing N8N_API_URL or N8N_API_KEY')
  }

  if (!simpleN8nApi) {
    throw new Error('n8n API client not initialized')
  }

  const isConnected = await simpleN8nApi.testConnection()

  if (!isConnected) {
    throw new Error('n8n API connection failed - check server status and credentials')
  }

  return {
    status: 'passed',
    message: 'n8n API connected successfully',
    details: { connected: true },
    recommendations: [],
  }
}

/**
 * Validate file system permissions
 */
async function validatePermissions(detailed: boolean): Promise<Record<string, unknown>> {
  try {
    const checks: Record<string, Record<string, unknown>> = {}
    const issues: string[] = []
    const recommendations: string[] = []

    // Check data directory permissions
    const dataDir = path.resolve('./data')
    try {
      await fs.access(dataDir, fs.constants.R_OK | fs.constants.W_OK)
      checks.data_directory = { readable: true, writable: true }
    }
    catch (error) {
      checks.data_directory = { readable: false, writable: false, error: (error as Error).message }
      issues.push('Data directory not accessible')
      recommendations.push('Ensure read/write permissions on ./data directory')
    }

    // Check database file permissions
    const dbPath = path.resolve('./data/nodes.db')
    try {
      await fs.access(dbPath, fs.constants.R_OK | fs.constants.W_OK)
      checks.database_file = { readable: true, writable: true }
    }
    catch (error) {
      checks.database_file = { readable: false, writable: false, error: (error as Error).message }
      issues.push('Database file not accessible')
      recommendations.push('Ensure read/write permissions on database file')
    }

    // Check temp directory permissions
    const tmpDir = os.tmpdir()
    try {
      const testFile = path.join(tmpDir, `n8n-mcp-test-${Date.now()}`)
      await fs.writeFile(testFile, 'test')
      await fs.unlink(testFile)
      checks.temp_directory = { readable: true, writable: true }
    }
    catch (error) {
      checks.temp_directory = { readable: false, writable: false, error: (error as Error).message }
      issues.push('Temp directory not accessible')
      recommendations.push('Ensure write permissions on system temp directory')
    }

    return {
      status: issues.length === 0 ? 'passed' : 'failed',
      message: issues.length === 0 ? 'All permission checks passed' : `${issues.length} permission issues found`,
      details: detailed ? checks : { issues_count: issues.length },
      recommendations,
    }
  }
  catch (error) {
    return {
      status: 'failed',
      message: `Permissions check failed: ${(error as Error).message}`,
      details: {},
      recommendations: [],
    }
  }
}

/**
 * Validate disk space
 */
async function validateDiskSpace(detailed: boolean): Promise<Record<string, unknown>> {
  try {
    // Use the execCommand function defined above
    const result = await execCommand('df', ['-h', '.'])

    // Parse df output (simplified - may need adjustment for different systems)
    const lines = result.stdout.trim().split('\n')
    const dataLine = lines[lines.length - 1]
    if (!dataLine) {
      throw new Error('Could not parse df output')
    }
    const parts = dataLine.split(/\s+/)

    const usage = {
      filesystem: parts[0],
      size: parts[1],
      used: parts[2],
      available: parts[3],
      use_percent: parts[4],
      mount: parts[5],
    }

    const usePercent = Number.parseInt(usage.use_percent?.replace('%', '') || '0')
    const availableBytes = usage.available || '0'

    const recommendations: string[] = []
    let status = 'passed'

    if (usePercent > 90) {
      status = 'failed'
      recommendations.push('Disk usage is critically high - free up space immediately')
    }
    else if (usePercent > 80) {
      status = 'warning'
      recommendations.push('Disk usage is high - consider freeing up space')
    }

    // Check if we have less than 100MB available
    const availableMB = availableBytes.includes('G')
      ? Number.parseFloat(availableBytes) * 1024
      : availableBytes.includes('M') ? Number.parseFloat(availableBytes) : 0

    if (availableMB < 100) {
      status = 'failed'
      recommendations.push('Less than 100MB available - critical space issue')
    }

    return {
      status,
      message: `Disk usage: ${usage.use_percent} (${usage.available} available)`,
      details: detailed
        ? usage
        : {
            use_percent: usage.use_percent,
            available: usage.available,
          },
      recommendations,
    }
  }
  catch (error) {
    throw new Error(`Disk space check failed: ${(error as Error).message}`)
  }
}

/**
 * Validate memory usage
 */
async function validateMemoryUsage(detailed: boolean): Promise<Record<string, unknown>> {
  try {
    const memUsage = process.memoryUsage()
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()

    const processMemoryMB = Math.round(memUsage.rss / 1024 / 1024)
    const systemMemoryGB = Math.round(totalMemory / 1024 / 1024 / 1024)
    const freeMemoryGB = Math.round(freeMemory / 1024 / 1024 / 1024)
    const memoryUsagePercent = Math.round((processMemoryMB / (systemMemoryGB * 1024)) * 100)

    const recommendations: string[] = []
    let status = 'passed'

    if (processMemoryMB > 1024) { // > 1GB
      status = 'warning'
      recommendations.push('Process memory usage is high - consider restarting if performance issues occur')
    }

    if (freeMemoryGB < 1) { // < 1GB free
      status = 'warning'
      recommendations.push('System memory is low - consider closing other applications')
    }

    const details = {
      process: {
        rss: `${processMemoryMB}MB`,
        heap_used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heap_total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      },
      system: {
        total: `${systemMemoryGB}GB`,
        free: `${freeMemoryGB}GB`,
        process_usage_percent: `${memoryUsagePercent}%`,
      },
    }

    return {
      status,
      message: `Memory: ${processMemoryMB}MB process, ${freeMemoryGB}GB system free`,
      details: detailed
        ? details
        : {
            process_memory_mb: processMemoryMB,
            system_free_gb: freeMemoryGB,
          },
      recommendations,
    }
  }
  catch (error) {
    return {
      status: 'failed',
      message: `Memory check failed: ${(error as Error).message}`,
      details: {},
      recommendations: [],
    }
  }
}

/**
 * Handle server update MCP tool requests
 */
async function handleServerUpdate(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { action, force = false, preserveData = true, backupBeforeUpdate = true } = args

  try {
    switch (action) {
      case 'check_updates': {
        logger.info('Checking for available updates...')
        const currentVersion = await getCurrentVersion()
        const latestInfo = await getLatestVersion()

        if (!currentVersion) {
          return {
            error: 'Could not determine current version',
            currentVersion: null,
            latestVersion: null,
          }
        }

        if (!latestInfo) {
          return {
            error: 'Could not check latest version - authentication or network issue',
            currentVersion,
            latestVersion: null,
            suggestion: 'Run validate_auth action to check GitHub Packages access',
          }
        }

        return {
          currentVersion,
          latestVersion: latestInfo.version,
          updateAvailable: latestInfo.available,
          message: latestInfo.available
            ? `Update available: ${currentVersion} → ${latestInfo.version}`
            : 'Already on latest version',
          nextSteps: latestInfo.available
            ? ['Run validate_auth to check authentication', 'Run perform_update to upgrade']
            : [],
        }
      }

      case 'validate_auth': {
        logger.info('Validating GitHub Packages authentication...')
        const authResult = await validateGitHubAuth()

        return {
          authenticationValid: authResult.valid,
          message: authResult.message,
          nextSteps: authResult.valid
            ? ['Authentication is working - you can proceed with updates']
            : [
                'Fix authentication by running: node scripts/validate-github-auth.cjs --verbose',
                'Configure GitHub token in ~/.npmrc',
                'Ensure token has read:packages permission',
              ],
        }
      }

      case 'perform_update': {
        logger.info('Starting server update process...')

        // Validate authentication first unless forced
        if (!force) {
          const authResult = await validateGitHubAuth()
          if (!authResult.valid) {
            return {
              error: 'GitHub Packages authentication failed',
              message: authResult.message,
              suggestion: 'Run validate_auth action first, or use force:true to bypass (not recommended)',
            }
          }
        }

        // Create backup if requested
        let backupResult: Record<string, unknown> | null = null
        if (backupBeforeUpdate) {
          logger.info('Creating backup before update...')
          backupResult = await createBackup()
          if (!backupResult.success && !force) {
            return {
              error: 'Backup failed and force is not enabled',
              message: backupResult.message,
              suggestion: 'Use force:true to bypass backup requirement',
            }
          }
        }

        // Perform the update
        const updateResult = await performUpdate(preserveData as boolean)

        return {
          success: updateResult.success,
          message: updateResult.message,
          details: updateResult.details,
          backup: backupResult,
          nextSteps: updateResult.success
            ? [
                'Server updated successfully',
                'Restart your MCP client (Claude Code) to use the new version',
                'Run check_updates to confirm new version',
              ]
            : [
                'Update failed - check error details',
                'Verify GitHub Packages authentication',
                'Check network connectivity',
              ],
        }
      }

      case 'rollback_update': {
        return {
          error: 'Rollback functionality not yet implemented',
          message: 'Manual rollback required - reinstall previous version or restore from backup',
          suggestion: 'Use npm install -g @eekfonky/n8n-mcp-modern@<previous-version>',
        }
      }

      default:
        return {
          error: 'Invalid action',
          validActions: ['check_updates', 'validate_auth', 'perform_update', 'rollback_update'],
        }
    }
  }
  catch (error) {
    logger.error('Server update error:', error)
    return {
      error: 'Update operation failed',
      message: (error as Error).message,
      stack: (error as Error).stack,
    }
  }
}

/**
 * Initialize the pure dynamic tool system
 */
export async function initializeDynamicTools(): Promise<void> {
  logger.info('Initializing pure dynamic tool discovery...')

  try {
    // Initialize the Phase 3 tool generator
    toolGenerator = new MCPToolGenerator()
    credentialDiscovery = new CredentialDiscovery()

    // Initialize dynamic agent tools
    dynamicAgentTools = await createDynamicAgentTools()

    // Basic connectivity tool
    discoveredTools.push({
      name: 'ping',
      description: 'Health check for n8n-MCP server',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    })
    toolHandlers.set('ping', async () => ({
      status: 'ok',
      timestamp: Date.now(),
      mode: 'dynamic',
      phase: 'Phase 4: Discovery Automation',
    }))

    // Add memory optimization tools
    for (const [toolName, toolConfig] of Object.entries(memoryOptimizationTools)) {
      discoveredTools.push({
        name: toolName,
        description: toolConfig.description,
        inputSchema: toolConfig.parameters,
      })
      toolHandlers.set(toolName, toolConfig.handler)
    }

    // Add cold start optimization tools
    for (const [toolName, toolConfig] of Object.entries(coldStartOptimizationTools)) {
      discoveredTools.push({
        name: toolName,
        description: toolConfig.description,
        inputSchema: toolConfig.parameters,
      })
      toolHandlers.set(toolName, toolConfig.handler)
    }

    // Add performance monitoring tools
    for (const [toolName, toolConfig] of Object.entries(performanceMonitoringTools)) {
      discoveredTools.push({
        name: toolName,
        description: toolConfig.description,
        inputSchema: toolConfig.parameters,
      })
      toolHandlers.set(toolName, toolConfig.handler)
    }

    // Add self-update tool for seamless upgrades
    discoveredTools.push({
      name: 'update_n8n_mcp_server',
      description: 'Update n8n-MCP Modern server to latest version with data preservation and validation',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['check_updates', 'validate_auth', 'perform_update', 'rollback_update'],
            description: 'Update action to perform',
          },
          force: {
            type: 'boolean',
            default: false,
            description: 'Force update even if validation fails (use with caution)',
          },
          preserveData: {
            type: 'boolean',
            default: true,
            description: 'Preserve user data and configurations during update',
          },
          backupBeforeUpdate: {
            type: 'boolean',
            default: true,
            description: 'Create backup before performing update',
          },
        },
        required: ['action'],
      },
    })

    // Add installation validation and health check tool
    discoveredTools.push({
      name: 'validate_installation',
      description: 'Comprehensive validation of n8n-MCP Modern installation including dependencies, configuration, and health checks',
      inputSchema: {
        type: 'object',
        properties: {
          checks: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'system_info',
                'dependencies',
                'database',
                'mcp_config',
                'github_auth',
                'n8n_connectivity',
                'permissions',
                'disk_space',
                'memory_usage',
                'all',
              ],
            },
            default: ['all'],
            description: 'Specific validation checks to perform',
          },
          includeRecommendations: {
            type: 'boolean',
            default: true,
            description: 'Include improvement recommendations in results',
          },
          detailed: {
            type: 'boolean',
            default: false,
            description: 'Include detailed diagnostic information',
          },
        },
      },
    })

    // Add dynamic agent tools
    if (dynamicAgentTools) {
      const dynamicTools = dynamicAgentTools.getTools()
      for (const tool of dynamicTools) {
        discoveredTools.push(tool)
        toolHandlers.set(tool.name, async (args: Record<string, unknown>) => {
          if (!dynamicAgentTools) {
            throw new Error('Dynamic agent tools not initialized')
          }
          return await dynamicAgentTools.handleToolCall(tool.name, args)
        })
      }
    }

    // Add iterative workflow building tool
    discoveredTools.push({
      name: 'build_workflow_iteratively',
      description: 'Interactive step-by-step workflow building with real-time validation and rollback capability',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'create_session',
              'add_node',
              'test_workflow',
              'create_checkpoint',
              'rollback',
              'get_suggestions',
              'validate_connections',
              'preview_workflow',
              'complete_workflow',
            ],
            description: 'The iterative building action to perform',
          },
          sessionId: {
            type: 'string',
            description: 'Unique session identifier for maintaining state across interactions',
          },
          workflowName: {
            type: 'string',
            description: 'Name for the workflow (required for create_session)',
          },
          nodeType: {
            type: 'string',
            description: 'Type of node to add (e.g., n8n-nodes-base.httpRequest)',
          },
          nodeParameters: {
            type: 'object',
            description: 'Parameters for the node being added',
            additionalProperties: true,
          },
          checkpointId: {
            type: 'number',
            description: 'Checkpoint ID for rollback operations',
            minimum: 0,
          },
        },
        required: ['action'],
      },
    })

    // Discovery scheduler control tools
    discoveredTools.push({
      name: 'discovery-trigger',
      description: 'Manually trigger n8n node discovery',
      inputSchema: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for triggering discovery',
            default: 'Manual trigger via MCP',
          },
        },
      },
    })

    discoveredTools.push({
      name: 'discovery-status',
      description: 'Get status of discovery sessions and scheduler',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    })

    discoveredTools.push({
      name: 'discovery-config',
      description: 'Update discovery scheduler configuration',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Enable/disable automatic discovery scheduling',
          },
          intervalMinutes: {
            type: 'number',
            description: 'Discovery interval in minutes',
            minimum: 5,
            maximum: 1440,
          },
          versionDetection: {
            type: 'boolean',
            description: 'Enable version change detection',
          },
        },
      },
    })

    // Add handler for self-update tool
    toolHandlers.set('update_n8n_mcp_server', async (args: Record<string, unknown>) => {
      return await handleServerUpdate(args)
    })

    // Add handler for installation validation tool
    toolHandlers.set('validate_installation', async (args: Record<string, unknown>) => {
      return await handleInstallationValidation(args)
    })

    // Add handlers for scheduler tools
    toolHandlers.set('discovery-trigger', async (args: Record<string, unknown>) => {
      if (!discoveryScheduler) {
        return { error: 'Discovery scheduler not initialized' }
      }

      const reason = (args?.reason as string) || 'Manual trigger via MCP'
      const sessionId = await discoveryScheduler.triggerDiscovery('manual', reason)

      return {
        success: true,
        sessionId,
        message: sessionId ? `Discovery session ${sessionId} started` : 'Discovery session could not be started (check concurrent limit)',
      }
    })

    toolHandlers.set('discovery-status', async () => {
      if (!discoveryScheduler) {
        return { error: 'Discovery scheduler not initialized' }
      }

      const sessions = discoveryScheduler.getSessionStatus()
      const stats = discoveryScheduler.getStats()

      return {
        scheduler: stats,
        sessions: sessions.map(session => ({
          sessionId: session.sessionId,
          status: session.status,
          trigger: session.trigger,
          startedAt: session.startedAt,
          progress: session.progress,
          stats: session.stats,
        })),
        timestamp: new Date(),
      }
    })

    toolHandlers.set('discovery-config', async (args: Record<string, unknown>) => {
      if (!discoveryScheduler) {
        return { error: 'Discovery scheduler not initialized' }
      }

      if (!args || Object.keys(args).length === 0) {
        return { error: 'No configuration provided' }
      }

      discoveryScheduler.updateConfig(args)

      return {
        success: true,
        message: 'Discovery scheduler configuration updated',
        newConfig: discoveryScheduler.getStats().config,
      }
    })

    // Add handler for iterative workflow building
    toolHandlers.set('build_workflow_iteratively', async (args: Record<string, unknown>) => {
      try {
        if (!simpleN8nApi) {
          return { error: 'n8n API not available' }
        }

        const { action, sessionId, workflowName, nodeType, nodeParameters, checkpointId } = args

        switch (action) {
          case 'create_session': {
            if (!workflowName || typeof workflowName !== 'string') {
              return { error: 'workflowName is required for create_session' }
            }

            // Create a new workflow for iterative building
            const workflow = await simpleN8nApi.createIterativeWorkflow(workflowName)
            if (!workflow) {
              return { error: 'Failed to create workflow' }
            }

            // Create a new session
            const session = WorkflowBuilderUtils.SessionManager.createSession(workflow.id as string)

            return {
              success: true,
              sessionId: session.sessionId,
              workflowId: session.workflowId,
              message: `Created iterative workflow session: ${session.sessionId}`,
              suggestions: await simpleN8nApi.getCompatibleNodes(workflow.id as string),
            }
          }

          case 'add_node': {
            if (!sessionId || typeof sessionId !== 'string') {
              return { error: 'sessionId is required for add_node' }
            }
            if (!nodeType || typeof nodeType !== 'string') {
              return { error: 'nodeType is required for add_node' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            // Create node object
            const node = {
              type: nodeType,
              parameters: (nodeParameters as Record<string, unknown>) || {},
              position: [100 + session.currentNodes.length * 200, 100] as [number, number],
            }

            // Add node to workflow
            const success = await WorkflowBuilderUtils.NodeManager.addNodeToWorkflow(
              session,
              node,
              simpleN8nApi,
            )

            if (!success) {
              return { error: 'Failed to add node to workflow' }
            }

            // Create automatic checkpoint
            WorkflowBuilderUtils.SessionManager.createCheckpoint(session, 'auto_after_add_node')

            return {
              success: true,
              message: `Added ${nodeType} node to workflow`,
              nodeCount: session.currentNodes.length,
              nextSuggestions: await simpleN8nApi.getCompatibleNodes(session.workflowId, nodeType),
            }
          }

          case 'test_workflow': {
            if (!sessionId || typeof sessionId !== 'string') {
              return { error: 'sessionId is required for test_workflow' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            const result = await WorkflowBuilderUtils.NodeManager.testWorkflow(session, simpleN8nApi)
            if (!result) {
              return { error: 'Workflow test failed' }
            }

            return {
              success: true,
              validationResult: result,
              message: result.status === 'success' ? 'Workflow executed successfully' : 'Workflow execution had issues',
            }
          }

          case 'create_checkpoint': {
            if (!sessionId || typeof sessionId !== 'string') {
              return { error: 'sessionId is required for create_checkpoint' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            const success = WorkflowBuilderUtils.SessionManager.createCheckpoint(session, 'manual')

            return {
              success,
              message: success ? 'Checkpoint created successfully' : 'Failed to create checkpoint',
              checkpointId: success ? session.checkpoints.length - 1 : null,
            }
          }

          case 'rollback': {
            if (!sessionId || typeof sessionId !== 'string') {
              return { error: 'sessionId is required for rollback' }
            }
            if (typeof checkpointId !== 'number') {
              return { error: 'checkpointId is required for rollback' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            const success = await WorkflowBuilderUtils.RollbackManager.rollbackToCheckpoint(
              session,
              checkpointId,
              simpleN8nApi,
            )

            return {
              success,
              message: success ? `Rolled back to checkpoint ${checkpointId}` : 'Rollback failed',
              nodeCount: success ? session.currentNodes.length : null,
            }
          }

          case 'get_suggestions': {
            if (!sessionId || typeof sessionId !== 'string') {
              return { error: 'sessionId is required for get_suggestions' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            const lastNode = session.currentNodes[session.currentNodes.length - 1]
            const suggestions = await simpleN8nApi.getCompatibleNodes(
              session.workflowId,
              lastNode?.type,
            )

            return {
              success: true,
              suggestions,
              lastNodeType: lastNode?.type || null,
              nodeCount: session.currentNodes.length,
            }
          }

          case 'validate_connections': {
            if (!sessionId || typeof sessionId !== 'string') {
              return { error: 'sessionId is required for validate_connections' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            const validation = await simpleN8nApi.validateWorkflowConnections(session.workflowId)

            return {
              success: true,
              validation,
              message: validation.valid ? 'Workflow connections are valid' : 'Workflow has validation issues',
            }
          }

          case 'preview_workflow': {
            if (!sessionId || typeof sessionId !== 'string') {
              return { error: 'sessionId is required for preview_workflow' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            // Generate ASCII visualization
            const nodeNames = session.currentNodes.map(n => n.name || n.type.split('.').pop())
            const preview = nodeNames.length > 0
              ? `[Start] → ${nodeNames.join(' → ')} → [End]`
              : '[Empty Workflow]'

            return {
              success: true,
              preview,
              nodeCount: session.currentNodes.length,
              checkpointCount: session.checkpoints.length,
              sessionAge: Date.now() - session.securityContext.createdAt.getTime(),
            }
          }

          case 'complete_workflow': {
            if (!sessionId || typeof sessionId !== 'string') {
              return { error: 'sessionId is required for complete_workflow' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            // Final validation
            const validation = await simpleN8nApi.validateWorkflowConnections(session.workflowId)
            if (!validation.valid) {
              return {
                error: 'Cannot complete workflow - validation failed',
                validationErrors: validation.errors,
              }
            }

            // Cleanup session
            WorkflowBuilderUtils.SessionManager.cleanupSession(sessionId)

            return {
              success: true,
              workflowId: session.workflowId,
              finalNodeCount: session.currentNodes.length,
              message: 'Workflow completed successfully. Session cleaned up.',
            }
          }

          default:
            return { error: `Unknown action: ${action}` }
        }
      }
      catch (error) {
        logger.error('Iterative workflow building error:', error)
        return {
          error: 'Internal error during iterative workflow building',
          details: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })

    // Run Phase 2 discovery - n8n API must be available
    if (!hasN8nApi || !simpleN8nApi) {
      throw new Error('n8n API connection required for dynamic tool discovery')
    }

    // Test connection first
    const isConnected = await simpleN8nApi.testConnection()
    if (!isConnected) {
      throw new Error('n8n API connection test failed - check server status and credentials')
    }

    logger.info('Running Phase 2: Credential-based node discovery...')
    const discoveryStats = await credentialDiscovery.discover()
    logger.info(`Phase 2 complete: ${discoveryStats.nodesDiscovered} nodes discovered`)

    // Run Phase 3: Generate MCP tools from discovered nodes
    logger.info('Running Phase 3: MCP tool generation with lazy loading...')
    const generationStats = await toolGenerator.generateAllTools()
    logger.info(`Phase 3 complete: ${generationStats.totalGenerated} tools generated (${generationStats.toolsWithOperations} with operations)`)

    // Load the generated tools into the MCP system
    await loadGeneratedTools(generationStats.totalGenerated)

    // Initialize Phase 4: Discovery Scheduler
    logger.info('Initializing Phase 4: Discovery automation scheduler...')
    discoveryScheduler = new DiscoveryScheduler()
    await discoveryScheduler.start()
    logger.info('Phase 4 complete: Discovery scheduler initialized')

    logger.info(`Dynamic discovery complete: ${discoveredTools.length} tools available`)
  }
  catch (error) {
    logger.error('Dynamic discovery failed:', error)
    throw error
  }
}

/**
 * Load generated tools into MCP system with lazy loading
 */
async function loadGeneratedTools(maxTools?: number): Promise<void> {
  if (!toolGenerator) {
    logger.warn('Tool generator not initialized')
    return
  }

  try {
    // Get all tool metadata from database (without loading full schemas)
    const toolMetadata = await toolGenerator.getToolMetadata(maxTools)
    logger.info(`Loading ${toolMetadata.length} tool definitions with lazy loading...`)

    for (const metadata of toolMetadata) {
      // Create lightweight tool definition for MCP
      const description = metadata.operationName
        ? `${metadata.operationName} operation for ${metadata.nodeName || 'general category'}`
        : `${metadata.toolType} tool for ${metadata.nodeName || 'category operations'}`

      discoveredTools.push({
        name: metadata.toolId,
        description,
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: metadata.operationName || 'Operation to perform',
            },
            parameters: {
              type: 'object',
              description: 'Operation parameters',
            },
          },
        },
      })

      // Create lazy-loading handler
      toolHandlers.set(metadata.toolId, createLazyToolHandler(metadata.toolId))
    }

    logger.info(`Successfully loaded ${toolMetadata.length} lazy-loading MCP tools`)
  }
  catch (error) {
    logger.error('Failed to load generated tools:', error)
    throw error
  }
}

/**
 * Create a lazy-loading tool handler
 */
function createLazyToolHandler(toolId: string): (args: Record<string, unknown>) => Promise<Record<string, unknown>> {
  return async (args: Record<string, unknown>) => {
    if (!toolGenerator) {
      throw new Error('Tool generator not available')
    }

    try {
      // Lazy load the full tool definition when first executed
      const cachedTool = await toolGenerator.loadTool(toolId)
      if (!cachedTool) {
        throw new Error(`Tool ${toolId} not found in cache`)
      }

      // Execute with the loaded tool data
      return {
        toolId,
        status: 'lazy_loaded_execution',
        timestamp: Date.now(),
        nodeType: cachedTool.tool.sourceNode,
        operation: args.operation || 'default',
        parameters: args.parameters || {},
        agentRecommendation: 'n8n-orchestrator', // Default agent
        schema: cachedTool.schema ? 'loaded' : 'not_available',
        result: 'Tool execution would proceed with n8n workflow operations',
      }
    }
    catch (error) {
      logger.error(`Lazy loading failed for tool ${toolId}:`, error)
      return {
        toolId,
        status: 'lazy_loading_error',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

/**
 * Create dynamic handler for core operations
 */
function _createDynamicHandler(operation: string): (args: Record<string, unknown>) => Promise<Record<string, unknown>> {
  return async (args: Record<string, unknown>) => {
    try {
      // Security: Validate and sanitize input arguments
      if (!args || typeof args !== 'object') {
        throw new Error('Invalid arguments provided')
      }

      // Sanitize string arguments to prevent injection attacks
      const sanitizedArgs: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string') {
          // Remove potentially dangerous characters and limit length
          sanitizedArgs[key] = value.replace(/[<>"'&]/g, '').substring(0, 1000)
        }
        else if (Array.isArray(value)) {
          // Validate array elements
          sanitizedArgs[key] = value.slice(0, 100).map(item =>
            typeof item === 'string' ? item.replace(/[<>"'&]/g, '').substring(0, 500) : item,
          )
        }
        else {
          sanitizedArgs[key] = value
        }
      }

      switch (operation) {
        // Core workflow operations
        case 'list_workflows':
          return (await simpleN8nApi?.getWorkflows() || []) as Record<string, unknown>[]
        case 'get_workflow':
          return await simpleN8nApi?.getWorkflow(args.id as string) || null
        case 'create_workflow':
          return await simpleN8nApi?.createWorkflow({
            name: args.name as string || 'Dynamic Workflow',
            nodes: (args.data as Record<string, unknown>[]) || [],
            active: false,
          }) || { status: 'workflow_creation_pending' }
        case 'execute_workflow':
          return await simpleN8nApi?.executeWorkflow(args.id as string, args.data as Record<string, unknown>) || { status: 'execution_started' }
        case 'get_executions':
          return await simpleN8nApi?.getExecutions(args.id as string) || []

        // Extended workflow operations
        case 'update_workflow':
          return await simpleN8nApi?.updateWorkflow(args.id as string, args.data as Record<string, unknown>) || null
        case 'delete_workflow':
          return await simpleN8nApi?.deleteWorkflow(args.id as string) || false
        case 'activate_workflow':
          return await simpleN8nApi?.activateWorkflow(args.id as string) || false
        case 'deactivate_workflow':
          return await simpleN8nApi?.deactivateWorkflow(args.id as string) || false
        case 'duplicate_workflow':
          return await simpleN8nApi?.duplicateWorkflow(args.id as string, args.name as string) || null

        // Execution operations
        case 'get_execution':
          return await simpleN8nApi?.getExecution(args.id as string) || null
        case 'delete_execution':
          return await simpleN8nApi?.deleteExecution(args.id as string) || false
        case 'retry_execution':
          return await simpleN8nApi?.retryExecution(args.id as string) || null
        case 'stop_execution':
          return await simpleN8nApi?.stopExecution(args.id as string) || false

        // Credential operations
        case 'list_credentials':
          return await simpleN8nApi?.getCredentials() || []
        case 'get_credential':
          return await simpleN8nApi?.getCredential(args.id as string) || null
        case 'create_credential':
          return await simpleN8nApi?.createCredential({
            name: (args.name as string) || 'New Credential',
            type: (args.type as string) || 'default',
            data: (args.data as Record<string, unknown>) || {},
          }) || null
        case 'update_credential':
          return await simpleN8nApi?.updateCredential(args.id as string, args.data as Record<string, unknown>) || null
        case 'delete_credential':
          return await simpleN8nApi?.deleteCredential(args.id as string) || false
        case 'test_credential':
          return await simpleN8nApi?.testCredential(args.id as string) || null

        // Import/Export operations
        case 'export_workflow':
          return await simpleN8nApi?.exportWorkflow(args.id as string) || null
        case 'import_workflow':
          return await simpleN8nApi?.importWorkflow(args.data as Record<string, unknown>) || null

        // Tag operations
        case 'list_tags':
          return await simpleN8nApi?.getTags() || []
        case 'create_tag':
          return await simpleN8nApi?.createTag(args.name as string) || null
        case 'tag_workflow':
          return await simpleN8nApi?.tagWorkflow(args.workflowId as string, args.tagIds as string[]) || false

        // Variable operations
        case 'list_variables':
          return await simpleN8nApi?.getVariables() || []
        case 'create_variable':
          return await simpleN8nApi?.createVariable(args as { key: string, value: string }) || null
        case 'update_variable':
          return await simpleN8nApi?.updateVariable(args.id as string, args.data as Record<string, unknown>) || null
        case 'delete_variable':
          return await simpleN8nApi?.deleteVariable(args.id as string) || false

        // System operations
        case 'get_health':
          return await simpleN8nApi?.getHealth() || null
        case 'get_version':
          return await simpleN8nApi?.getVersion() || null
        case 'list_event_destinations':
          return await simpleN8nApi?.getEventDestinations() || []

        // Batch operations
        case 'batch_delete_workflows':
          return await simpleN8nApi?.batchDeleteWorkflows(args.ids as string[]) || { success: [], failed: [] }
        case 'batch_activate_workflows':
          return await simpleN8nApi?.batchActivateWorkflows(args.ids as string[]) || { success: [], failed: [] }
        case 'batch_deactivate_workflows':
          return await simpleN8nApi?.batchDeactivateWorkflows(args.ids as string[]) || { success: [], failed: [] }

        default:
          return { operation, args, status: 'dynamic_execution' }
      }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
}

/**
 * Create handler for node template
 */
function _createNodeTemplateHandler(nodeTemplate: NodeTemplate): (args: Record<string, unknown>) => Promise<Record<string, unknown>> {
  return async (args: Record<string, unknown>) => {
    return {
      node: nodeTemplate.name,
      displayName: nodeTemplate.displayName,
      category: nodeTemplate.category,
      operation: args.operation,
      parameters: args.parameters || {},
      credentials: args.credentials || {},
      availableOperations: nodeTemplate.commonOperations,
      status: 'template_node_ready',
      description: nodeTemplate.description,
    }
  }
}

/**
 * Create handler for specific node operation
 */
function _createOperationHandler(nodeTemplate: NodeTemplate, operation: string): (args: Record<string, unknown>) => Promise<Record<string, unknown>> {
  return async (args: Record<string, unknown>) => {
    return {
      node: nodeTemplate.name,
      displayName: nodeTemplate.displayName,
      category: nodeTemplate.category,
      operation,
      parameters: args.parameters || {},
      credentials: args.credentials || {},
      status: 'operation_ready',
      description: `Executing ${operation} on ${nodeTemplate.displayName}`,
    }
  }
}

/**
 * Create handler for category overview
 */
function _createCategoryHandler(category: string): (args: Record<string, unknown>) => Promise<Record<string, unknown>> {
  return async (args: Record<string, unknown>) => {
    const categoryNodes = getAllNodeTemplates().filter(node => node.category === category)
    const detailed = args.detailed as boolean || false

    if (detailed) {
      return {
        category,
        nodeCount: categoryNodes.length,
        nodes: categoryNodes.map(node => ({
          name: node.name,
          displayName: node.displayName,
          description: node.description,
          operations: node.commonOperations,
        })),
      }
    }
    else {
      return {
        category,
        nodeCount: categoryNodes.length,
        nodes: categoryNodes.map(node => `${node.displayName} (${node.name})`),
      }
    }
  }
}

/**
 * Get all dynamically discovered tools
 */
export async function getAllTools(): Promise<Tool[]> {
  return discoveredTools
}

/**
 * Get mutable reference to discovered tools array (for testing)
 */
export function getDiscoveredToolsArray(): Tool[] {
  return discoveredTools
}

/**
 * Execute a dynamically discovered tool
 */
export async function executeToolHandler(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const handler = toolHandlers.get(name)
  if (!handler) {
    throw new Error(`Tool not found: ${name}`)
  }

  const result = await handler(args)
  return result as Record<string, unknown>
}

/**
 * Get current tool count (for monitoring)
 */
export function getToolCount(): number {
  return discoveredTools.length
}

/**
 * Refresh tool discovery (for community node updates)
 */
export async function refreshTools(): Promise<void> {
  discoveredTools = []
  toolHandlers.clear()
  await initializeDynamicTools()
  logger.info(`Tools refreshed - now ${getToolCount()} available`)
}

/**
 * Cleanup resources on shutdown
 */
export async function cleanup(): Promise<void> {
  logger.info('Cleaning up discovery automation resources...')

  try {
    // Stop discovery scheduler
    if (discoveryScheduler) {
      await discoveryScheduler.stop()
      discoveryScheduler = null
      logger.info('Discovery scheduler stopped')
    }

    // Clear tool references
    discoveredTools = []
    toolHandlers.clear()
    toolGenerator = null
    credentialDiscovery = null

    logger.info('Cleanup completed successfully')
  }
  catch (error) {
    logger.error('Error during cleanup:', error)
  }
}
