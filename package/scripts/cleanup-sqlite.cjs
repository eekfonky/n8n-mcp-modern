#!/usr/bin/env node
/**
 * Comprehensive cleanup script for n8n-MCP Modern
 * - Removes SQLite temporary files (WAL/SHM)
 * - Cleans up deprecated/removed agents during upgrades
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
          console.log(`🧹 Cleaned up SQLite temp file: ${file}`);
        } catch (error) {
          // Ignore cleanup errors silently
        }
      }
    });
  }
}

function runAgentCleanup() {
  try {
    const agentCleanup = require('./cleanup-agents.cjs');
    agentCleanup.cleanupAgents();
  } catch (error) {
    // Agent cleanup is optional, don't fail installation
    console.log('ℹ️  Agent cleanup skipped (not critical)');
  }
}

// Run both cleanup operations
console.log('🚀 n8n-MCP Modern: Running post-install cleanup...');
cleanupSQLiteFiles();
runAgentCleanup();
console.log('✨ Post-install cleanup complete!');
