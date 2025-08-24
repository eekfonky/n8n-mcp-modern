#!/usr/bin/env node
/**
 * Post-install script for n8n-MCP Modern
 * Ensures dist/ and data/ are available after GitHub installation
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

function log(message, isError = false) {
  const prefix = isError ? '❌' : '📦'
  console.log(`${prefix} ${message}`)
}

function checkAndBuild() {
  const packageRoot = __dirname.replace('/scripts', '')
  const distPath = path.join(packageRoot, 'dist')
  const dataPath = path.join(packageRoot, 'data', 'nodes.db')
  const srcPath = path.join(packageRoot, 'src')
  const tsconfigPath = path.join(packageRoot, 'tsconfig.json')

  let needsBuild = false
  let needsDatabase = false

  // Check if we have source files (GitHub install) but no dist
  if (fs.existsSync(srcPath) && fs.existsSync(tsconfigPath) && !fs.existsSync(distPath)) {
    needsBuild = true
    log('Source files detected, building TypeScript...')
  }

  // Check if database file is missing
  if (!fs.existsSync(dataPath)) {
    needsDatabase = true
    log('Database file missing, will create placeholder...')
  }

  if (!needsBuild && !needsDatabase) {
    log('Installation complete - all files present')
    return
  }

  try {
    // Build TypeScript if needed
    if (needsBuild) {
      // Check if TypeScript is available
      try {
        execSync('npx tsc --version', { stdio: 'pipe' })
      }
      catch {
        log('TypeScript not available, installing...', true)
        execSync('npm install typescript@latest --no-save', { stdio: 'inherit' })
      }

      log('Building TypeScript files...')
      execSync('npx tsc', { stdio: 'inherit', cwd: packageRoot })

      // Make binary executable
      const binaryPath = path.join(distPath, 'index.js')
      if (fs.existsSync(binaryPath)) {
        execSync(`chmod +x "${binaryPath}"`)
        log('Binary made executable')
      }
    }

    // Create database placeholder if needed
    if (needsDatabase) {
      const dataDir = path.join(packageRoot, 'data')
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }

      // Create empty database file
      fs.writeFileSync(dataPath, '')
      log('Database placeholder created')
      log('Run "npm run rebuild-db" to populate with n8n node data', true)
    }

    log('Post-install setup complete')
  }
  catch (error) {
    log(`Build failed: ${error.message}`, true)
    log('Package may not function correctly without build', true)
    // Don't fail the install - allow degraded functionality
    process.exit(0)
  }
}

// Run cleanup first
try {
  const cleanupScript = path.join(__dirname, 'upgrade-cleanup.cjs')
  if (fs.existsSync(cleanupScript)) {
    require(cleanupScript)
  }
}
catch {
  // Ignore cleanup errors
}

// Then check and build
checkAndBuild()
