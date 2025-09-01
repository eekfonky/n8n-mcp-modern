#!/usr/bin/env node

/**
 * Upgrade Rollback Mechanism for n8n-MCP Modern
 * Handles safe rollbacks when upgrades fail
 */

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const process = require('node:process')

/**
 * Execute command safely with timeout and error handling
 */
function execCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 30000

    const proc = spawn(command, args, {
      stdio: options.stdio || 'pipe',
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

    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`Command timed out after ${timeout}ms`))
    }, timeout)

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve({ stdout, stderr, code })
      }
      else {
        const error = new Error(`Command failed with exit code ${code}`)
        error.stdout = stdout
        error.stderr = stderr
        error.code = code
        reject(error)
      }
    })

    proc.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

/**
 * Backup current configuration before upgrade
 */
async function createBackup(scope = 'local') {
  console.log('💾 Creating configuration backup...')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(os.homedir(), '.n8n-mcp-backups', timestamp)

  try {
    // Create backup directory
    fs.mkdirSync(backupDir, { recursive: true })

    const backupManifest = {
      timestamp,
      scope,
      version: 'unknown',
      files: [],
      configuration: null,
    }

    // Backup project-scoped configuration
    if (scope === 'project') {
      const projectMcpPath = path.join(process.cwd(), '.mcp.json')
      if (fs.existsSync(projectMcpPath)) {
        const backupPath = path.join(backupDir, 'project-mcp.json')
        fs.copyFileSync(projectMcpPath, backupPath)
        backupManifest.files.push({ original: projectMcpPath, backup: backupPath })

        // Extract current configuration
        try {
          const content = fs.readFileSync(projectMcpPath, 'utf8')
          const config = JSON.parse(content)
          if (config.mcpServers && config.mcpServers['n8n-mcp-modern']) {
            backupManifest.configuration = config.mcpServers['n8n-mcp-modern']
          }
        }
        catch {
          console.log('⚠️  Could not parse project configuration for backup')
        }
      }
    }

    // Backup global Claude MCP configuration
    try {
      const result = await execCommand('claude', ['mcp', 'list', '--json'])
      const globalConfig = JSON.parse(result.stdout)

      if (globalConfig.servers && globalConfig.servers['n8n-mcp-modern']) {
        backupManifest.configuration = globalConfig.servers['n8n-mcp-modern']

        // Save global config to backup
        const globalBackupPath = path.join(backupDir, 'global-mcp-config.json')
        fs.writeFileSync(globalBackupPath, JSON.stringify(globalConfig, null, 2))
        backupManifest.files.push({ type: 'global-config', backup: globalBackupPath })
      }
    }
    catch {
      console.log('ℹ️  Could not backup global Claude MCP configuration (this is optional)')
    }

    // Try to detect current version
    try {
      const result = await execCommand('npm', ['list', '-g', '@eekfonky/n8n-mcp-modern', '--depth=0'])
      const versionMatch = result.stdout.match(/@eekfonky\/n8n-mcp-modern@([.\w-]+)/)
      if (versionMatch) {
        backupManifest.version = versionMatch[1]
      }
    }
    catch {
      // Try npx version check
      try {
        const result = await execCommand('npx', ['@eekfonky/n8n-mcp-modern', '--version'], { timeout: 10000 })
        backupManifest.version = result.stdout.trim()
      }
      catch {
        console.log('ℹ️  Could not detect current version')
      }
    }

    // Save backup manifest
    const manifestPath = path.join(backupDir, 'backup-manifest.json')
    fs.writeFileSync(manifestPath, JSON.stringify(backupManifest, null, 2))

    console.log(`✅ Backup created: ${backupDir}`)
    console.log(`   Version: ${backupManifest.version}`)
    console.log(`   Files: ${backupManifest.files.length}`)

    return {
      success: true,
      backupDir,
      manifest: backupManifest,
    }
  }
  catch (error) {
    console.error('❌ Backup creation failed:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Restore configuration from backup
 */
async function restoreFromBackup(backupDir, scope = 'local') {
  console.log(`🔄 Restoring configuration from backup: ${backupDir}`)

  try {
    const manifestPath = path.join(backupDir, 'backup-manifest.json')
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Backup manifest not found')
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    console.log(`   Restoring version: ${manifest.version}`)

    // Restore project configuration
    if (scope === 'project' || manifest.scope === 'project') {
      const projectBackup = manifest.files.find(f => f.original && f.original.endsWith('.mcp.json'))
      if (projectBackup && fs.existsSync(projectBackup.backup)) {
        fs.copyFileSync(projectBackup.backup, projectBackup.original)
        console.log('✅ Restored project configuration')
      }
    }

    // Restore global configuration using Claude CLI
    if (manifest.configuration) {
      try {
        console.log('🔄 Restoring Claude MCP configuration...')

        // Remove current configuration
        try {
          await execCommand('claude', ['mcp', 'remove', 'n8n-mcp-modern', '--scope', scope])
        }
        catch {
          // Ignore removal errors - may not exist
        }

        // Restore configuration with environment variables
        const envArgs = []
        if (manifest.configuration.env) {
          Object.entries(manifest.configuration.env).forEach(([key, value]) => {
            envArgs.push('--env', `${key}=${value}`)
          })
        }

        // Reconstruct the add command
        await execCommand('claude', [
          'mcp',
          'add',
          'n8n-mcp-modern',
          '--scope',
          scope,
          ...envArgs,
          '--',
          ...(manifest.configuration.args || ['npx', '-y', '@eekfonky/n8n-mcp-modern']),
        ])

        console.log('✅ Restored Claude MCP configuration')
      }
      catch (error) {
        console.log('⚠️  Could not restore global configuration:', error.message)
        console.log('   Manual reconfiguration may be required')
      }
    }

    console.log('✅ Configuration restoration completed')
    return { success: true, manifest }
  }
  catch (error) {
    console.error('❌ Restore failed:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Rollback to previous version
 */
async function rollbackToPreviousVersion(backupDir, scope = 'local') {
  console.log('🔄 Rolling back to previous version...')

  try {
    const manifestPath = path.join(backupDir, 'backup-manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

    console.log(`   Target version: ${manifest.version}`)

    // First, restore configuration
    const restoreResult = await restoreFromBackup(backupDir, scope)
    if (!restoreResult.success) {
      throw new Error(`Configuration restore failed: ${restoreResult.error}`)
    }

    // For global installations, try to install the specific version
    if (manifest.version !== 'unknown') {
      try {
        console.log(`🔄 Installing previous version: ${manifest.version}`)

        // Remove current version
        try {
          await execCommand('npm', ['uninstall', '-g', '@eekfonky/n8n-mcp-modern'])
        }
        catch {
          // Ignore uninstall errors
        }

        // Install specific version
        await execCommand('npm', ['install', '-g', `@eekfonky/n8n-mcp-modern@${manifest.version}`])
        console.log('✅ Previous version installed successfully')
      }
      catch (error) {
        console.log('⚠️  Could not install previous version:', error.message)
        console.log('   Configuration has been restored but version rollback failed')
        console.log(`   Manual installation required: npm install -g @eekfonky/n8n-mcp-modern@${manifest.version}`)
      }
    }

    console.log('✅ Rollback completed successfully')
    return { success: true, manifest }
  }
  catch (error) {
    console.error('❌ Rollback failed:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * List available backups
 */
function listBackups() {
  console.log('📋 Available backups:')

  const backupsDir = path.join(os.homedir(), '.n8n-mcp-backups')

  if (!fs.existsSync(backupsDir)) {
    console.log('   No backups found')
    return []
  }

  const backups = []
  const entries = fs.readdirSync(backupsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const manifestPath = path.join(backupsDir, entry.name, 'backup-manifest.json')

      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
          backups.push({
            name: entry.name,
            path: path.join(backupsDir, entry.name),
            manifest,
          })

          console.log(`   📁 ${entry.name}`)
          console.log(`      Version: ${manifest.version}`)
          console.log(`      Scope: ${manifest.scope}`)
          console.log(`      Files: ${manifest.files.length}`)
          console.log(`      Date: ${new Date(manifest.timestamp).toLocaleString()}`)
          console.log()
        }
        catch {
          console.log(`   📁 ${entry.name} (invalid manifest)`)
        }
      }
    }
  }

  return backups.sort((a, b) => new Date(b.manifest.timestamp) - new Date(a.manifest.timestamp))
}

/**
 * Clean up old backups (keep last 5)
 */
function cleanupOldBackups() {
  const backupsDir = path.join(os.homedir(), '.n8n-mcp-backups')

  if (!fs.existsSync(backupsDir)) {
    return
  }

  const backups = listBackups()

  if (backups.length > 5) {
    console.log(`🧹 Cleaning up old backups (keeping 5 most recent)...`)

    const toDelete = backups.slice(5)

    for (const backup of toDelete) {
      try {
        fs.rmSync(backup.path, { recursive: true, force: true })
        console.log(`   Deleted: ${backup.name}`)
      }
      catch {
        console.log(`   Failed to delete: ${backup.name}`)
      }
    }
  }
}

/**
 * Main CLI interface
 */
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'backup': {
      const scope = args[1] || 'local'
      const result = await createBackup(scope)
      process.exit(result.success ? 0 : 1)
      break
    }

    case 'restore': {
      const backupDir = args[1]
      if (!backupDir) {
        console.error('Usage: node upgrade-rollback.cjs restore <backup-directory>')
        process.exit(1)
      }
      const restoreScope = args[2] || 'local'
      const restoreResult = await restoreFromBackup(backupDir, restoreScope)
      process.exit(restoreResult.success ? 0 : 1)
      break
    }

    case 'rollback': {
      const rollbackDir = args[1]
      if (!rollbackDir) {
        console.error('Usage: node upgrade-rollback.cjs rollback <backup-directory>')
        process.exit(1)
      }
      const rollbackScope = args[2] || 'local'
      const rollbackResult = await rollbackToPreviousVersion(rollbackDir, rollbackScope)
      process.exit(rollbackResult.success ? 0 : 1)
      break
    }

    case 'list':
      listBackups()
      break

    case 'cleanup':
      cleanupOldBackups()
      break

    default:
      console.log('n8n-MCP Modern - Upgrade Rollback Tool')
      console.log('')
      console.log('Usage:')
      console.log('  node upgrade-rollback.cjs backup [scope]     - Create backup')
      console.log('  node upgrade-rollback.cjs restore <dir>     - Restore from backup')
      console.log('  node upgrade-rollback.cjs rollback <dir>    - Full rollback')
      console.log('  node upgrade-rollback.cjs list              - List backups')
      console.log('  node upgrade-rollback.cjs cleanup           - Clean old backups')
      console.log('')
      console.log('Scopes: local, project')
      break
  }
}

// Export functions for use by other scripts
module.exports = {
  createBackup,
  restoreFromBackup,
  rollbackToPreviousVersion,
  listBackups,
  cleanupOldBackups,
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Command failed:', error.message)
    process.exit(1)
  })
}
