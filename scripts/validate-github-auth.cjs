#!/usr/bin/env node

/**
 * GitHub Connectivity Validator
 * Simplified validator for essential GitHub operations only.
 * GitHub Packages authentication no longer needed for primary distribution.
 */

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const process = require('node:process')

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
 * Check basic GitHub connectivity
 */
async function checkGitHubConnectivity() {
  try {
    const result = await execCommand('curl', [
      '-s',
      '--connect-timeout', '10',
      '-H', 'Accept: application/vnd.github.v3+json',
      'https://api.github.com/repos/eekfonky/n8n-mcp-modern'
    ])

    const response = JSON.parse(result.stdout)

    if (response.name === 'n8n-mcp-modern') {
      return {
        connected: true,
        message: 'GitHub API accessible',
        repository: response.full_name
      }
    }

    return {
      connected: false,
      message: 'Unexpected API response'
    }
  } catch (error) {
    return {
      connected: false,
      message: `GitHub connectivity failed: ${error.message}`
    }
  }
}

/**
 * Test basic npm connectivity to npmjs.org
 */
async function testNpmConnectivity() {
  try {
    const result = await execCommand('npm', [
      'view',
      '@eekfonky/n8n-mcp-modern',
      'version',
      '--registry=https://registry.npmjs.org'
    ])

    if (result.stdout.trim()) {
      return {
        accessible: true,
        message: `Package available on npmjs.org, version: ${result.stdout.trim()}`,
        version: result.stdout.trim()
      }
    }

    return {
      accessible: false,
      message: 'Package not found on npmjs.org'
    }
  } catch (error) {
    return {
      accessible: false,
      message: `npmjs.org connectivity failed: ${error.message}`
    }
  }
}

/**
 * Check git installation and basic functionality
 */
async function checkGitInstallation() {
  try {
    const result = await execCommand('git', ['--version'])

    if (result.stdout.includes('git version')) {
      return {
        installed: true,
        message: `Git available: ${result.stdout.trim()}`,
        version: result.stdout.trim()
      }
    }

    return {
      installed: false,
      message: 'Git not properly installed'
    }
  } catch (error) {
    return {
      installed: false,
      message: 'Git not found in PATH'
    }
  }
}

/**
 * Provide actionable guidance based on validation results
 */
function provideGuidance(results) {
  console.log('\n🔧 SYSTEM STATUS & GUIDANCE:\n')

  if (!results.github.connected) {
    console.log('⚠️  GitHub connectivity issues:')
    console.log(`   Problem: ${results.github.message}`)
    console.log('   Impact: Source installation may fail')
    console.log('   Solution: Check network connectivity')
    console.log('')
  }

  if (!results.npm.accessible) {
    console.log('⚠️  npmjs.org connectivity issues:')
    console.log(`   Problem: ${results.npm.message}`)
    console.log('   Impact: Primary installation may fail')
    console.log('   Solution: Check network connectivity and npm configuration')
    console.log('')
  }

  if (!results.git.installed) {
    console.log('⚠️  Git not available:')
    console.log(`   Problem: ${results.git.message}`)
    console.log('   Impact: Source installation not possible')
    console.log('   Solution: Install git from https://git-scm.com/')
    console.log('')
  }

  if (results.overall) {
    console.log('✅ All essential systems are operational!')
    console.log('Your system is ready for n8n-mcp-modern installation.')
    console.log('\n📦 Recommended installation:')
    console.log('   npm install -g @eekfonky/n8n-mcp-modern')
    console.log('\n🔧 Alternative methods:')
    console.log('   npm run install  (unified installer with fallbacks)')
    console.log('   npx @eekfonky/n8n-mcp-modern  (temporary usage)')
  } else {
    console.log('⚠️  Some systems have issues but installation may still work')
    console.log('\n🔧 Try installation methods in order:')
    console.log('   1. npm install -g @eekfonky/n8n-mcp-modern  (primary)')
    console.log('   2. npm run install  (unified installer with fallbacks)')
    console.log('   3. Contact support if issues persist')
  }
}

/**
 * Main validation function
 */
async function validateSystemConnectivity(verbose = false) {
  console.log('🔍 n8n-MCP Modern - System Connectivity Validator')
  console.log('='.repeat(55))

  const results = {
    github: null,
    npm: null,
    git: null,
    overall: false,
  }

  // Check GitHub connectivity
  console.log('\n🐙 Checking GitHub connectivity...')
  results.github = await checkGitHubConnectivity()
  console.log(`   ${results.github.connected ? '✅' : '⚠️'} ${results.github.message}`)

  if (verbose && results.github.repository) {
    console.log(`   Repository: ${results.github.repository}`)
  }

  // Check npmjs.org connectivity
  console.log('\n📦 Checking npmjs.org package availability...')
  results.npm = await testNpmConnectivity()
  console.log(`   ${results.npm.accessible ? '✅' : '⚠️'} ${results.npm.message}`)

  if (verbose && results.npm.version) {
    console.log(`   Latest version: ${results.npm.version}`)
  }

  // Check git installation
  console.log('\n🔧 Checking git installation...')
  results.git = await checkGitInstallation()
  console.log(`   ${results.git.installed ? '✅' : '⚠️'} ${results.git.message}`)

  if (verbose && results.git.version) {
    console.log(`   Version: ${results.git.version}`)
  }

  // Determine overall status
  // Primary installation requires npm connectivity
  // Git and GitHub are nice-to-have for fallback scenarios
  results.overall = results.npm.accessible

  provideGuidance(results)
  return results
}

// CLI interface
async function main() {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v')

  try {
    const results = await validateSystemConnectivity(verbose)
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
  validateSystemConnectivity,
  checkGitHubConnectivity,
  testNpmConnectivity,
  checkGitInstallation,
}

// Run if called directly
if (require.main === module) {
  main()
}
