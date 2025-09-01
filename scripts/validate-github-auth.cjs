#!/usr/bin/env node

/**
 * GitHub Packages Authentication Validator
 * Validates GitHub token and package access for seamless installations
 */

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/**
 * Execute command safely with proper error handling
 */
function execCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
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

    proc.on('close', (code) => {
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
      reject(error)
    })
  })
}

/**
 * Check if .npmrc exists and is configured for GitHub Packages
 */
function checkNpmrcConfiguration() {
  const npmrcPath = path.join(os.homedir(), '.npmrc')
  
  if (!fs.existsSync(npmrcPath)) {
    return {
      exists: false,
      configured: false,
      path: npmrcPath,
      message: '.npmrc file not found in home directory'
    }
  }

  try {
    const content = fs.readFileSync(npmrcPath, 'utf8')
    const hasRegistry = content.includes('@eekfonky:registry=https://npm.pkg.github.com')
    const hasAuthToken = content.includes('//npm.pkg.github.com/:_authToken=')
    const hasPlaceholder = content.includes('YOUR_GITHUB_TOKEN')

    return {
      exists: true,
      configured: hasRegistry && hasAuthToken,
      hasPlaceholder,
      path: npmrcPath,
      content,
      message: hasRegistry && hasAuthToken 
        ? (hasPlaceholder ? 'Configuration present but token is placeholder' : 'Properly configured')
        : 'Missing GitHub Packages configuration'
    }
  }
  catch (error) {
    return {
      exists: true,
      configured: false,
      path: npmrcPath,
      message: `Error reading .npmrc: ${error.message}`
    }
  }
}

/**
 * Extract GitHub token from .npmrc
 */
function extractGitHubToken() {
  const npmrcCheck = checkNpmrcConfiguration()
  
  if (!npmrcCheck.configured || !npmrcCheck.content) {
    return null
  }

  const tokenMatch = npmrcCheck.content.match(/\/\/npm\.pkg\.github\.com\/:_authToken=([^\s\n]+)/)
  if (!tokenMatch) {
    return null
  }

  const token = tokenMatch[1]
  if (token === 'YOUR_GITHUB_TOKEN' || token === '${GITHUB_TOKEN}') {
    return null
  }

  return token
}

/**
 * Validate GitHub token with GitHub API
 */
async function validateGitHubToken(token) {
  if (!token) {
    return {
      valid: false,
      message: 'No token provided'
    }
  }

  try {
    const result = await execCommand('curl', [
      '-s',
      '-H', `Authorization: token ${token}`,
      '-H', 'Accept: application/vnd.github.v3+json',
      'https://api.github.com/user'
    ])

    const response = JSON.parse(result.stdout)
    
    if (response.message === 'Bad credentials') {
      return {
        valid: false,
        message: 'Invalid GitHub token'
      }
    }

    if (response.login) {
      return {
        valid: true,
        message: `Valid token for user: ${response.login}`,
        user: response.login
      }
    }

    return {
      valid: false,
      message: 'Unexpected API response'
    }
  }
  catch (error) {
    return {
      valid: false,
      message: `Token validation failed: ${error.message}`
    }
  }
}

/**
 * Test package access by attempting to fetch package metadata
 */
async function testPackageAccess(token) {
  if (!token) {
    return {
      accessible: false,
      message: 'No token to test with'
    }
  }

  try {
    const result = await execCommand('npm', [
      'view',
      '@eekfonky/n8n-mcp-modern',
      'version',
      '--registry=https://npm.pkg.github.com'
    ], {
      env: {
        ...process.env,
        NPM_TOKEN: token
      }
    })

    if (result.stdout.trim()) {
      return {
        accessible: true,
        message: `Package accessible, latest version: ${result.stdout.trim()}`,
        version: result.stdout.trim()
      }
    }

    return {
      accessible: false,
      message: 'Package not accessible or version not found'
    }
  }
  catch (error) {
    // Check if it's an authentication error
    if (error.stderr.includes('401') || error.stderr.includes('Unauthorized')) {
      return {
        accessible: false,
        message: 'Authentication failed - token may not have read:packages permission'
      }
    }

    return {
      accessible: false,
      message: `Package access test failed: ${error.message}`
    }
  }
}

/**
 * Test actual npm install capability
 */
async function testNpmInstall() {
  try {
    // Test in a temporary directory to avoid affecting current project
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-test-'))
    
    const result = await execCommand('npm', [
      'install',
      '@eekfonky/n8n-mcp-modern',
      '--dry-run',
      '--no-audit',
      '--no-fund',
      '--silent'
    ], {
      cwd: tmpDir
    })

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true })

    return {
      installable: true,
      message: 'Package can be installed successfully'
    }
  }
  catch (error) {
    if (error.stderr.includes('401') || error.stderr.includes('Unauthorized')) {
      return {
        installable: false,
        message: 'Installation failed - authentication required'
      }
    }

    return {
      installable: false,
      message: `Installation test failed: ${error.message.split('\n')[0]}`
    }
  }
}

/**
 * Provide actionable guidance based on validation results
 */
function provideGuidance(results) {
  console.log('\n🔧 ACTIONABLE GUIDANCE:\n')

  if (!results.npmrc.exists) {
    console.log('1. Create ~/.npmrc configuration:')
    console.log('   Run: node scripts/install-github-packages.cjs')
    console.log('   Or manually create ~/.npmrc with GitHub Packages configuration')
    return
  }

  if (!results.npmrc.configured) {
    console.log('1. Configure ~/.npmrc for GitHub Packages:')
    console.log('   Add: @eekfonky:registry=https://npm.pkg.github.com')
    console.log('   Add: //npm.pkg.github.com/:_authToken=YOUR_TOKEN')
    return
  }

  if (results.npmrc.hasPlaceholder) {
    console.log('1. Replace token placeholder in ~/.npmrc:')
    console.log('   Generate token: https://github.com/settings/tokens')
    console.log('   Required scopes: read:packages')
    console.log('   Replace YOUR_GITHUB_TOKEN with your actual token')
    return
  }

  if (!results.token.valid) {
    console.log('1. Fix GitHub token issue:')
    console.log(`   Problem: ${results.token.message}`)
    console.log('   Generate new token: https://github.com/settings/tokens')
    console.log('   Required scopes: read:packages')
    console.log('   Update token in ~/.npmrc')
    return
  }

  if (!results.packageAccess.accessible) {
    console.log('1. Fix package access issue:')
    console.log(`   Problem: ${results.packageAccess.message}`)
    console.log('   Ensure token has read:packages scope')
    console.log('   Verify package exists: https://github.com/eekfonky/n8n-mcp-modern/packages')
    return
  }

  if (!results.npmInstall.installable) {
    console.log('1. Fix npm installation issue:')
    console.log(`   Problem: ${results.npmInstall.message}`)
    console.log('   Try: npm cache clean --force')
    console.log('   Try: rm -rf ~/.npm && npm install')
    return
  }

  console.log('✅ All validation checks passed!')
  console.log('Your system is ready for seamless n8n-mcp-modern installation.')
  console.log('\nYou can now run:')
  console.log('   npm install -g @eekfonky/n8n-mcp-modern')
  console.log('   npx @eekfonky/n8n-mcp-modern')
}

/**
 * Main validation function
 */
async function validateGitHubAuthentication(verbose = false) {
  console.log('🔍 n8n-MCP Modern - GitHub Authentication Validator')
  console.log('=' .repeat(55))

  const results = {
    npmrc: null,
    token: null,
    packageAccess: null,
    npmInstall: null,
    overall: false
  }

  // Check .npmrc configuration
  console.log('\n📋 Checking .npmrc configuration...')
  results.npmrc = checkNpmrcConfiguration()
  console.log(`   ${results.npmrc.configured ? '✅' : '❌'} ${results.npmrc.message}`)
  
  if (verbose && results.npmrc.exists) {
    console.log(`   Path: ${results.npmrc.path}`)
  }

  if (!results.npmrc.configured) {
    results.overall = false
    provideGuidance(results)
    return results
  }

  // Extract and validate GitHub token
  console.log('\n🔑 Validating GitHub token...')
  const token = extractGitHubToken()
  
  if (!token) {
    results.token = { valid: false, message: 'No valid token found in .npmrc' }
    console.log('   ❌ No valid token found in .npmrc')
    results.overall = false
    provideGuidance(results)
    return results
  }

  results.token = await validateGitHubToken(token)
  console.log(`   ${results.token.valid ? '✅' : '❌'} ${results.token.message}`)
  
  if (!results.token.valid) {
    results.overall = false
    provideGuidance(results)
    return results
  }

  // Test package access
  console.log('\n📦 Testing package access...')
  results.packageAccess = await testPackageAccess(token)
  console.log(`   ${results.packageAccess.accessible ? '✅' : '❌'} ${results.packageAccess.message}`)
  
  if (!results.packageAccess.accessible) {
    results.overall = false
    provideGuidance(results)
    return results
  }

  // Test npm install capability
  console.log('\n🧪 Testing npm install capability...')
  results.npmInstall = await testNpmInstall()
  console.log(`   ${results.npmInstall.installable ? '✅' : '❌'} ${results.npmInstall.message}`)
  
  if (!results.npmInstall.installable) {
    results.overall = false
    provideGuidance(results)
    return results
  }

  results.overall = true
  provideGuidance(results)
  return results
}

// CLI interface
async function main() {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v')
  
  try {
    const results = await validateGitHubAuthentication(verbose)
    process.exit(results.overall ? 0 : 1)
  }
  catch (error) {
    console.error('\n❌ Validation failed with error:', error.message)
    console.error('\n🔧 Try running with --verbose for more details')
    process.exit(1)
  }
}

// Export for use by other scripts
module.exports = {
  validateGitHubAuthentication,
  checkNpmrcConfiguration,
  extractGitHubToken,
  validateGitHubToken,
  testPackageAccess,
  testNpmInstall
}

// Run if called directly
if (require.main === module) {
  main()
}