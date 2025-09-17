#!/usr/bin/env node

/**
 * Simple Post-Install Script
 *
 * Validates pre-built installation without complex building or operations.
 * Replaces the complex 151-line postinstall.cjs with focused validation.
 */

const fs = require('node:fs')
const path = require('node:path')

class SimplePostInstall {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..')
    this.distDir = path.join(this.projectRoot, 'dist')
    this.dataDir = path.join(this.projectRoot, 'data')
    this.mainEntry = path.join(this.distDir, 'index.js')
    this.dbFile = path.join(this.dataDir, 'nodes.db')
  }

  log(message, level = 'info') {
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ️'
    console.log(`${prefix} ${message}`)
  }

  validatePreBuiltFiles() {
    this.log('Validating pre-built distribution files...')

    if (!fs.existsSync(this.distDir)) {
      this.log('Error: dist/ directory not found. This package may be corrupted.', 'error')
      return false
    }

    if (!fs.existsSync(this.mainEntry)) {
      this.log('Error: Main entry point dist/index.js not found.', 'error')
      return false
    }

    // Check if main entry is executable
    try {
      fs.accessSync(this.mainEntry, fs.constants.X_OK)
    }
    catch (error) {
      this.log('Warning: Main entry point may not be executable.', 'error')
    }

    this.log('Pre-built files validation passed!', 'success')
    return true
  }

  validateDatabase() {
    this.log('Checking database file presence...')

    if (!fs.existsSync(this.dbFile)) {
      this.log('Warning: Database file not found. Will be created on first run.', 'info')
      return true
    }

    // Basic database file validation
    try {
      const stats = fs.statSync(this.dbFile)
      if (stats.size === 0) {
        this.log('Warning: Database file is empty. Will be initialized on first run.', 'info')
      }
      else {
        this.log('Database file found and appears valid.', 'success')
      }
    }
    catch (error) {
      this.log('Warning: Could not validate database file.', 'info')
    }

    return true
  }

  performBasicHealthCheck() {
    this.log('Performing basic installation health check...')

    const requiredDirs = ['agents', 'config-templates']
    const missingDirs = requiredDirs.filter(dir => !fs.existsSync(path.join(this.projectRoot, dir)))

    if (missingDirs.length > 0) {
      this.log(`Warning: Missing directories: ${missingDirs.join(', ')}`, 'error')
      return false
    }

    this.log('Basic health check passed!', 'success')
    return true
  }

  run() {
    this.log('Starting simple post-install validation...')

    try {
      // Validate pre-built files
      if (!this.validatePreBuiltFiles()) {
        this.showErrorGuidance()
        process.exit(1)
      }

      // Check database
      this.validateDatabase()

      // Basic health check
      if (!this.performBasicHealthCheck()) {
        this.showErrorGuidance()
        process.exit(1)
      }

      this.log('Post-install validation completed successfully!', 'success')
      this.showNextSteps()
    }
    catch (error) {
      this.log(`Post-install validation failed: ${error.message}`, 'error')
      this.showErrorGuidance()
      process.exit(1)
    }
  }

  showNextSteps() {
    console.log('\n📋 Next Steps:')
    console.log('1. Run: npm run config (setup MCP configuration)')
    console.log('2. Run: npm run health (comprehensive health check)')
    console.log('3. Add to your MCP client configuration')
    console.log('4. Start using: n8n-mcp')
  }

  showErrorGuidance() {
    console.log('\n🔧 Troubleshooting:')
    console.log('1. Try reinstalling: npm uninstall -g @eekfonky/n8n-mcp-modern && npm install -g @eekfonky/n8n-mcp-modern')
    console.log('2. Use unified installer: npm run install')
    console.log('3. Check comprehensive health: npm run health')
    console.log('4. For support, visit: https://github.com/eekfonky/n8n-mcp-modern/issues')
  }
}

// Run post-install validation
if (require.main === module) {
  const postInstall = new SimplePostInstall()
  postInstall.run()
}

module.exports = SimplePostInstall
