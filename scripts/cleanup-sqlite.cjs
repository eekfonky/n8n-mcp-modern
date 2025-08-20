#!/usr/bin/env node
/**
 * Cleanup SQLite temporary files
 * Removes WAL/SHM files that might exist from previous versions
 */

const fs = require("fs");
const path = require("path");

function cleanupSQLiteFiles() {
  const dataDir = path.join(__dirname, "..", "data");

  if (fs.existsSync(dataDir)) {
    const filesToClean = ["nodes.db-wal", "nodes.db-shm"];
    filesToClean.forEach((file) => {
      const filePath = path.join(dataDir, file);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`🧹 Cleaned up: ${file}`);
        } catch (error) {
          // Ignore cleanup errors silently
        }
      }
    });
  }
}

cleanupSQLiteFiles();
