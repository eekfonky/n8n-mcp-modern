#!/usr/bin/env node

/**
 * Post-Installation Health Check for n8n-MCP Modern
 * Validates successful installation and configuration
 */

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/**
 * Execute command safely with timeout
 */
function execCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 10000 // 10 second default timeout
    
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

    // Set timeout
    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`Command timed out after ${timeout}ms`))
    }, timeout)

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve({ stdout, stderr, code })
      } else {
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
 * Check if package is globally installed
 */
async function checkGlobalInstallation() {
  console.log('🔍 Checking global npm installation...')
  
  try {
    const result = await execCommand('npm', ['list', '-g', '@eekfonky/n8n-mcp-modern', '--depth=0'])
    
    if (result.stdout.includes('@eekfonky/n8n-mcp-modern')) {
      console.log('✅ Package is globally installed')
      
      // Extract version
      const versionMatch = result.stdout.match(/@eekfonky\/n8n-mcp-modern@([\d\.\w-]+)/)
      const version = versionMatch ? versionMatch[1] : 'unknown'
      console.log(`   Version: ${version}`)
      
      return { installed: true, version, method: 'global' }
    }
  } catch (error) {
    console.log('ℹ️  Package not globally installed')
  }
  
  return { installed: false, method: 'none' }
}

/**
 * Check if npx can execute the package
 */
async function checkNpxExecution() {
  console.log('🔍 Testing npx execution...')
  
  try {
    // Test npx execution with --help flag (quick and safe)
    const result = await execCommand('npx', ['-y', '@eekfonky/n8n-mcp-modern', '--help'], {
      timeout: 30000 // 30 seconds for first npx run (may need to download)
    })
    
    console.log('✅ NPX execution successful')
    return { executable: true, method: 'npx' }
  } catch (error) {
    console.log('❌ NPX execution failed:', error.message)
    
    // Check if it's an authentication issue
    if (error.stderr && (
      error.stderr.includes('401') || 
      error.stderr.includes('Unauthorized') ||
      error.stderr.includes('npm error code E401')
    )) {
      console.log('   This appears to be a GitHub Packages authentication issue')
      console.log('   Run: node scripts/validate-github-auth.cjs --verbose')
    }
    
    return { executable: false, error: error.message }
  }
}

/**
 * Check Claude MCP integration
 */
async function checkClaudeMcpIntegration() {
  console.log('🔍 Checking Claude MCP integration...')
  
  try {
    const result = await execCommand('claude', ['mcp', 'list'])
    
    if (result.stdout.includes('n8n-mcp-modern')) {
      console.log('✅ Found in Claude MCP servers list')
      
      // Try to get more details
      try {
        const detailResult = await execCommand('claude', ['mcp', 'status', 'n8n-mcp-modern'])
        console.log('✅ Claude MCP server status check passed')
        return { integrated: true, status: 'active' }
      } catch {
        console.log('⚠️  Server found but status check failed')
        return { integrated: true, status: 'unknown' }
      }
    } else {
      console.log('ℹ️  Not found in Claude MCP servers list')
      return { integrated: false }
    }
  } catch (error) {
    if (error.message.includes('claude: command not found')) {
      console.log('ℹ️  Claude CLI not available (this is optional)')
      return { integrated: false, reason: 'claude-cli-not-found' }
    }
    
    console.log('⚠️  Claude MCP check failed:', error.message)
    return { integrated: false, error: error.message }
  }
}

/**
 * Check configuration files
 */
async function checkConfigurationFiles() {
  console.log('🔍 Checking configuration files...')
  
  const checks = []
  
  // Check for .mcp.json in current directory (project-scoped)
  const projectMcpPath = path.join(process.cwd(), '.mcp.json')
  if (fs.existsSync(projectMcpPath)) {
    try {
      const content = fs.readFileSync(projectMcpPath, 'utf8')
      const config = JSON.parse(content)
      
      if (config.mcpServers && config.mcpServers['n8n-mcp-modern']) {
        console.log('✅ Found project-scoped .mcp.json configuration')
        checks.push({ type: 'project', path: projectMcpPath, valid: true })
      }
    } catch (error) {
      console.log('⚠️  Found .mcp.json but it appears to be invalid')
      checks.push({ type: 'project', path: projectMcpPath, valid: false, error: error.message })
    }
  }
  
  // Check for Claude Desktop configuration
  const claudeConfigPaths = [
    path.join(os.homedir(), '.config', 'claude-desktop', 'config.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'config.json'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'config.json')
  ]
  
  for (const configPath of claudeConfigPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf8')
        const config = JSON.parse(content)
        
        if (config.mcpServers && config.mcpServers['n8n-mcp-modern']) {
          console.log('✅ Found Claude Desktop configuration')
          checks.push({ type: 'claude-desktop', path: configPath, valid: true })
          break
        }
      } catch (error) {
        console.log('⚠️  Found Claude Desktop config but could not parse it')
        checks.push({ type: 'claude-desktop', path: configPath, valid: false, error: error.message })
      }
    }
  }
  
  return checks
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables() {
  console.log('🔍 Checking environment variables...')
  
  const required = ['N8N_API_URL', 'N8N_API_KEY']
  const optional = ['LOG_LEVEL', 'ENABLE_CACHE', 'CACHE_TTL', 'MAX_CONCURRENT_REQUESTS']
  
  const status = { required: {}, optional: {} }
  
  for (const envVar of required) {
    const value = process.env[envVar]
    status.required[envVar] = {
      set: !!value,
      placeholder: value === 'https://your-n8n-instance.com' || value === 'your-api-key' || value === 'your-api-key-here'
    }
    
    if (status.required[envVar].set && !status.required[envVar].placeholder) {
      console.log(`✅ ${envVar} is configured`)
    } else if (status.required[envVar].placeholder) {
      console.log(`⚠️  ${envVar} is set to placeholder value`)
    } else {
      console.log(`❌ ${envVar} is not set`)
    }
  }
  
  for (const envVar of optional) {
    const value = process.env[envVar]
    status.optional[envVar] = { set: !!value, value }
    
    if (status.optional[envVar].set) {
      console.log(`✅ ${envVar} = ${value}`)
    }
  }
  
  return status
}

/**
 * Test n8n API connectivity (if credentials provided)
 */
async function testN8nConnectivity() {
  console.log('🔍 Testing n8n API connectivity...')
  
  const apiUrl = process.env.N8N_API_URL
  const apiKey = process.env.N8N_API_KEY
  
  if (!apiUrl || !apiKey || 
      apiUrl === 'https://your-n8n-instance.com' || 
      apiKey === 'your-api-key' || 
      apiKey === 'your-api-key-here') {
    console.log('ℹ️  N8N API credentials not configured - skipping connectivity test')
    return { tested: false, reason: 'no-credentials' }
  }
  
  try {
    // Normalize URL to include /api/v1 if not present
    let normalizedUrl = apiUrl.replace(/\/$/, '')
    if (!normalizedUrl.includes('/api/v1')) {
      normalizedUrl += '/api/v1'
    }
    
    const result = await execCommand('curl', [
      '-s',
      '-H', `Authorization: Bearer ${apiKey}`,
      '-H', 'Accept: application/json',
      `${normalizedUrl}/workflows`,
      '--max-time', '10'
    ])
    
    try {
      const response = JSON.parse(result.stdout)
      if (response.data !== undefined) {
        console.log('✅ n8n API connectivity successful')
        console.log(`   Found ${response.data.length} workflows`)
        return { tested: true, success: true, workflows: response.data.length }
      }
    } catch {
      // If not JSON, check if it's an HTML error page
      if (result.stdout.includes('<html>')) {
        console.log('❌ n8n API returned HTML (check URL and authentication)')
        return { tested: true, success: false, error: 'html-response' }
      }
    }
    
    console.log('❌ n8n API connectivity failed - unexpected response')
    return { tested: true, success: false, error: 'unexpected-response' }
    
  } catch (error) {
    console.log('❌ n8n API connectivity failed:', error.message)
    return { tested: true, success: false, error: error.message }
  }
}

/**
 * Generate health check report
 */
function generateReport(results) {
  console.log('\n' + '='.repeat(60))
  console.log('🏥 n8n-MCP Modern - Health Check Report')
  console.log('='.repeat(60))
  
  let overallHealth = 'HEALTHY'
  const issues = []
  const recommendations = []
  
  // Global installation
  if (results.globalInstall.installed) {
    console.log('✅ Global Installation: PASSED')
  } else {
    console.log('ℹ️  Global Installation: NOT INSTALLED (this is optional)')
  }
  
  // NPX execution
  if (results.npxExecution.executable) {
    console.log('✅ NPX Execution: PASSED')
  } else {
    console.log('❌ NPX Execution: FAILED')
    issues.push('NPX execution failed')
    recommendations.push('Run: node scripts/validate-github-auth.cjs --verbose')
    overallHealth = 'UNHEALTHY'
  }
  
  // Claude MCP integration
  if (results.claudeMcp.integrated) {
    console.log('✅ Claude MCP Integration: PASSED')
  } else {
    console.log('ℹ️  Claude MCP Integration: NOT CONFIGURED (install required)')
    recommendations.push('Run: claude mcp add n8n-mcp-modern --env N8N_API_URL="your-url" --env N8N_API_KEY="your-key" -- npx -y @eekfonky/n8n-mcp-modern')
  }
  
  // Configuration files
  if (results.configFiles.length > 0) {
    const validConfigs = results.configFiles.filter(c => c.valid)
    console.log(`✅ Configuration Files: ${validConfigs.length} found`)
  } else {
    console.log('⚠️  Configuration Files: NONE FOUND')
    recommendations.push('Create configuration using templates in config-templates/')
  }
  
  // Environment variables
  const requiredEnvSet = Object.values(results.environment.required).filter(v => v.set && !v.placeholder).length
  if (requiredEnvSet === 2) {
    console.log('✅ Environment Variables: PROPERLY CONFIGURED')
  } else {
    console.log('⚠️  Environment Variables: MISSING OR PLACEHOLDER VALUES')
    if (overallHealth === 'HEALTHY') overallHealth = 'DEGRADED'
    recommendations.push('Set N8N_API_URL and N8N_API_KEY environment variables')
  }
  
  // n8n connectivity
  if (results.n8nConnectivity.tested) {
    if (results.n8nConnectivity.success) {
      console.log('✅ n8n API Connectivity: PASSED')
    } else {
      console.log('❌ n8n API Connectivity: FAILED')
      issues.push('Cannot connect to n8n API')
      if (overallHealth === 'HEALTHY') overallHealth = 'DEGRADED'
      recommendations.push('Verify n8n URL and API key are correct')
    }
  } else {
    console.log('ℹ️  n8n API Connectivity: NOT TESTED (credentials not configured)')
  }
  
  // Overall status
  console.log('\n' + '='.repeat(60))
  console.log(`🚀 Overall Health: ${overallHealth}`)
  
  if (issues.length > 0) {
    console.log('\n❌ Issues Found:')
    issues.forEach(issue => console.log(`   • ${issue}`))
  }
  
  if (recommendations.length > 0) {
    console.log('\n💡 Recommendations:')
    recommendations.forEach(rec => console.log(`   • ${rec}`))
  }
  
  if (overallHealth === 'HEALTHY') {
    console.log('\n🎉 n8n-MCP Modern is properly installed and ready to use!')
  }
  
  console.log('='.repeat(60))
  
  return { status: overallHealth, issues, recommendations }
}

/**
 * Main health check function
 */
async function runHealthCheck() {
  console.log('🏥 n8n-MCP Modern - Health Check Starting...\n')
  
  const results = {}
  
  try {
    results.globalInstall = await checkGlobalInstallation()
    results.npxExecution = await checkNpxExecution()
    results.claudeMcp = await checkClaudeMcpIntegration()
    results.configFiles = await checkConfigurationFiles()
    results.environment = checkEnvironmentVariables()
    results.n8nConnectivity = await testN8nConnectivity()
    
    const report = generateReport(results)
    
    // Exit with appropriate code
    process.exit(report.status === 'HEALTHY' ? 0 : 1)
    
  } catch (error) {
    console.error('\n❌ Health check failed with error:', error.message)
    console.log('\n🔧 For support, please run:')
    console.log('   node scripts/validate-github-auth.cjs --verbose')
    console.log('   node scripts/install-mcp.js')
    process.exit(2)
  }
}

// CLI interface
if (require.main === module) {
  runHealthCheck()
}

module.exports = {
  runHealthCheck,
  checkGlobalInstallation,
  checkNpxExecution,
  checkClaudeMcpIntegration,
  checkConfigurationFiles,
  checkEnvironmentVariables,
  testN8nConnectivity
}