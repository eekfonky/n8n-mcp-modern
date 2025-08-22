#!/usr/bin/env node
/**
 * Cleanup SQLite temporary files
 * Removes WAL/SHM files that might exist from previous versions
 * Safe for global installs - exits gracefully if data directory doesn't exist
 */

const fs = require('node:fs')
const path = require('node:path')

function cleanupSQLiteFiles() {
  try {
    const dataDir = path.join(__dirname, '..', 'data')

    // Skip cleanup if data directory doesn't exist (fresh install)
    if (!fs.existsSync(dataDir)) {
      return
    }

    const filesToClean = ['nodes.db-wal', 'nodes.db-shm']
    filesToClean.forEach((file) => {
      const filePath = path.join(dataDir, file)
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
          console.log(`🧹 Cleaned up: ${file}`)
        }
        catch {
          // Ignore cleanup errors silently
        }
      }
    })
  }
  catch {
    // Exit gracefully on any error during postinstall
    // This prevents installation failures
  }
}

cleanupSQLiteFiles()
