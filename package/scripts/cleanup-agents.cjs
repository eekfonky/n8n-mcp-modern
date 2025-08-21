#!/usr/bin/env node

/**
 * Agent Cleanup Script for n8n-MCP Modern
 * 
 * This script removes deprecated/removed agents during npm upgrades
 * to prevent conflicts and confusion in user installations.
 */

const fs = require('fs');
const path = require('path');

// Track removed agents by version
const REMOVED_AGENTS = {
  '5.1.0': [
    'n8n-optimizer.md'
  ],
  // Future versions can add more removed agents here
  // '5.2.0': ['some-other-agent.md'],
};

// Legacy agents that should be cleaned up from older versions
const LEGACY_AGENTS = [
  'n8n-developer-specialist.md',
  'n8n-guidance-specialist.md', 
  'n8n-integration-specialist.md',
  'n8n-javascript-specialist.md',
  'n8n-node-specialist.md',
  'n8n-performance-specialist.md',
  'n8n-workflow-architect.md'
];

function findAgentDirectories() {
  const possiblePaths = [
    // Project-level agent directories
    path.join(process.cwd(), 'agents'),
    path.join(process.cwd(), '.claude', 'agents'),
    path.join(process.cwd(), 'package', 'agents'),
    
    // Parent directory agent paths (for sub-packages)
    path.join(process.cwd(), '..', 'agents'),
    path.join(process.cwd(), '..', '.claude', 'agents'),
    
    // Global Claude agent paths
    path.join(require('os').homedir(), '.claude', 'agents'),
  ];

  return possiblePaths.filter(agentPath => {
    try {
      return fs.existsSync(agentPath) && fs.statSync(agentPath).isDirectory();
    } catch (error) {
      return false;
    }
  });
}

function removeAgentFile(agentPath, filename) {
  const filePath = path.join(agentPath, filename);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Removed deprecated agent: ${filename} from ${agentPath}`);
      return true;
    }
  } catch (error) {
    console.warn(`⚠️  Failed to remove ${filename}: ${error.message}`);
    return false;
  }
  
  return false;
}

function cleanupAgents() {
  console.log('🧹 n8n-MCP Modern: Cleaning up deprecated agents...');
  
  const agentDirectories = findAgentDirectories();
  
  if (agentDirectories.length === 0) {
    console.log('ℹ️  No agent directories found, skipping cleanup');
    return;
  }

  let totalRemoved = 0;
  
  agentDirectories.forEach(agentPath => {
    console.log(`🔍 Checking agent directory: ${agentPath}`);
    
    // Remove agents that were removed in specific versions
    Object.entries(REMOVED_AGENTS).forEach(([version, agents]) => {
      agents.forEach(agentFile => {
        if (removeAgentFile(agentPath, agentFile)) {
          totalRemoved++;
        }
      });
    });
    
    // Remove legacy agents from older versions
    LEGACY_AGENTS.forEach(agentFile => {
      if (removeAgentFile(agentPath, agentFile)) {
        totalRemoved++;
      }
    });
  });

  if (totalRemoved > 0) {
    console.log(`✨ Successfully cleaned up ${totalRemoved} deprecated agent(s)`);
    console.log('📋 Current active agents: n8n-orchestrator, n8n-node-expert, n8n-scriptguard, n8n-connector, n8n-builder, n8n-guide');
  } else {
    console.log('✅ No deprecated agents found, installation is clean');
  }
}

function main() {
  try {
    cleanupAgents();
  } catch (error) {
    console.error('❌ Agent cleanup failed:', error.message);
    // Don't fail the installation if cleanup fails
    process.exit(0);
  }
}

// Only run if called directly
if (require.main === module) {
  main();
}

module.exports = { cleanupAgents, REMOVED_AGENTS, LEGACY_AGENTS };