#!/usr/bin/env node
/**
 * Comprehensive upgrade cleanup for n8n-MCP Modern
 * Handles cleanup of legacy files, configs, and data during package upgrades
 * Safe for all installation contexts - exits gracefully if directories don't exist
 */

const fs = require('node:fs')
const path = require('node:path')

function log(message, isError = false) {
  const prefix = isError ? '❌' : '🧹'
  console.log(`${prefix} ${message}`)
}

function cleanupSQLiteFiles() {
  try {
    const dataDir = path.join(__dirname, '..', 'data')

    if (!fs.existsSync(dataDir)) {
      return { cleaned: false, reason: 'data directory not found' }
    }

    const sqliteFiles = ['nodes.db-wal', 'nodes.db-shm', 'nodes.db-journal']
    let cleaned = 0

    for (const file of sqliteFiles) {
      const filePath = path.join(dataDir, file)
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
          cleaned++
          log(`SQLite temporary file: ${file}`)
        }
        catch (error) {
          log(`Failed to clean ${file}: ${error.message}`, true)
        }
      }
    }

    return { cleaned: cleaned > 0, count: cleaned }
  }
  catch (error) {
    return { cleaned: false, error: error.message }
  }
}

function cleanupLegacyFiles() {
  try {
    const packageRoot = path.join(__dirname, '..')
    const legacyFiles = [
      // Legacy config files that might have changed format
      '.n8n-mcp.config.js',
      '.n8n-mcp.config.json',
      'n8n-mcp.config.old',
      // Old script locations
      'install-mcp-old.js',
      'install-claude-mcp-old.js',
      // Legacy data files
      'data/nodes.db.backup',
      'data/legacy-nodes.db',
      // Old documentation
      'agents/README-old.md',
      'UPGRADE_NOTES.md',
      // Build artifacts from older versions
      'dist/.cache',
      'dist/temp',
      // Old log files
      'npm-debug.log.old',
      'upgrade.log',
    ]

    let cleaned = 0

    for (const file of legacyFiles) {
      const filePath = path.join(packageRoot, file)
      if (fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath)
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true })
          }
          else {
            fs.unlinkSync(filePath)
          }
          cleaned++
          log(`Legacy file/directory: ${file}`)
        }
        catch (error) {
          log(`Failed to clean ${file}: ${error.message}`, true)
        }
      }
    }

    return { cleaned: cleaned > 0, count: cleaned }
  }
  catch (error) {
    return { cleaned: false, error: error.message }
  }
}

function cleanupOldCacheFiles() {
  try {
    const packageRoot = path.join(__dirname, '..')
    const cacheDirs = [
      'node_modules/.cache',
      '.npm/_cacache',
      'dist/.tsbuildinfo.old',
    ]

    let cleaned = 0

    for (const dir of cacheDirs) {
      const dirPath = path.join(packageRoot, dir)
      if (fs.existsSync(dirPath)) {
        try {
          fs.rmSync(dirPath, { recursive: true, force: true })
          cleaned++
          log(`Cache directory: ${dir}`)
        }
        catch (error) {
          log(`Failed to clean cache ${dir}: ${error.message}`, true)
        }
      }
    }

    return { cleaned: cleaned > 0, count: cleaned }
  }
  catch (error) {
    return { cleaned: false, error: error.message }
  }
}

function validateDatabaseSchema() {
  try {
    const dataDir = path.join(__dirname, '..', 'data')
    const dbPath = path.join(dataDir, 'nodes.db')

    if (!fs.existsSync(dbPath)) {
      return { valid: false, reason: 'database file not found' }
    }

    // Check if database is accessible and not corrupted
    const stat = fs.statSync(dbPath)
    if (stat.size === 0) {
      log('Database file is empty, may need regeneration', true)
      return { valid: false, reason: 'empty database file' }
    }

    // Basic validation - ensure it's not obviously corrupted
    const buffer = Buffer.alloc(16)
    const fd = fs.openSync(dbPath, 'r')
    try {
      fs.readSync(fd, buffer, 0, 16, 0)
      const header = buffer.toString('utf8', 0, 16)
      const isValidSQLite = header.startsWith('SQLite format 3')

      if (!isValidSQLite) {
        log('Database header validation failed', true)
        return { valid: false, reason: 'invalid SQLite header' }
      }

      log('Database validation passed')
      return { valid: true }
    }
    finally {
      fs.closeSync(fd)
    }
  }
  catch (error) {
    log(`Database validation error: ${error.message}`, true)
    return { valid: false, error: error.message }
  }
}

function migrateConfigFiles() {
  try {
    const packageRoot = path.join(__dirname, '..')
    const oldConfig = path.join(packageRoot, '.npmrc.old')
    const templateConfig = path.join(packageRoot, '.npmrc.template')

    // If old config exists and template is newer, show migration notice
    if (fs.existsSync(oldConfig) && fs.existsSync(templateConfig)) {
      const oldStat = fs.statSync(oldConfig)
      const newStat = fs.statSync(templateConfig)

      if (newStat.mtime > oldStat.mtime) {
        log('Configuration template has been updated. Please review .npmrc.template for new settings.')
        fs.unlinkSync(oldConfig)
        return { migrated: true }
      }
    }

    return { migrated: false }
  }
  catch (error) {
    return { migrated: false, error: error.message }
  }
}

function performUpgradeCleanup() {
  log('Starting n8n-MCP Modern upgrade cleanup...')

  const results = {
    sqlite: cleanupSQLiteFiles(),
    legacy: cleanupLegacyFiles(),
    cache: cleanupOldCacheFiles(),
    database: validateDatabaseSchema(),
    config: migrateConfigFiles(),
  }

  // Summary
  const totalCleaned = (results.sqlite.count || 0)
    + (results.legacy.count || 0)
    + (results.cache.count || 0)

  if (totalCleaned > 0) {
    log(`Cleanup completed: ${totalCleaned} items removed`)
  }
  else {
    log('No cleanup needed - installation is clean')
  }

  // Warnings for issues
  if (!results.database.valid) {
    log(`Database issue detected: ${results.database.reason || results.database.error}`, true)
    log('Consider running: npm run rebuild-db', true)
  }

  if (results.config.migrated) {
    log('Configuration migrated - check .npmrc.template for updates')
  }

  return results
}

// Only run if called directly (not required as module)
if (require.main === module) {
  try {
    performUpgradeCleanup()
  }
  catch (error) {
    log(`Upgrade cleanup failed: ${error.message}`, true)
    // Don't exit with error code to avoid breaking npm install
    process.exit(0)
  }
}

module.exports = { performUpgradeCleanup }
