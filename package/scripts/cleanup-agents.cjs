#!/usr/bin/env node

/**
 * Agent Cleanup Script for n8n-MCP Modern
 * 
 * This script removes deprecated/removed agents during npm upgrades
 * to prevent conflicts and confusion in user installations.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// Track agent content hashes to detect updates
// When agent content changes significantly, we can update user installations
const AGENT_CONTENT_VERSIONS = {
  '5.1.1': {
    'n8n-guide.md': 'content-updated-with-reverse-delegation',
    'n8n-orchestrator.md': 'content-updated-with-token-optimization',
    'n8n-node-expert.md': 'content-updated-with-token-optimization',
    'n8n-scriptguard.md': 'content-updated-with-token-optimization',
    'n8n-connector.md': 'content-updated-with-token-optimization',
    'n8n-builder.md': 'content-updated-with-token-optimization'
  }
  // Future versions can track content changes here
};

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

function getAgentContentHash(content) {
  // Create a simple content signature to detect if agent content has changed significantly
  const normalizedContent = content
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/^---[\s\S]*?---\n/, '') // Remove frontmatter
    .trim();
  
  return crypto.createHash('md5').update(normalizedContent).digest('hex').substring(0, 8);
}

function shouldUpdateAgent(agentPath, filename, newContent) {
  const filePath = path.join(agentPath, filename);
  
  try {
    if (!fs.existsSync(filePath)) {
      return true; // File doesn't exist, should create it
    }
    
    const existingContent = fs.readFileSync(filePath, 'utf8');
    const existingHash = getAgentContentHash(existingContent);
    const newHash = getAgentContentHash(newContent);
    
    // Check if this is a known content update we want to apply
    const hasKnownUpdate = Object.values(AGENT_CONTENT_VERSIONS).some(versionAgents => 
      versionAgents[filename] && versionAgents[filename].includes('content-updated')
    );
    
    // Update if content is different and we have a known update for this agent
    return existingHash !== newHash && hasKnownUpdate;
  } catch (error) {
    console.warn(`⚠️  Could not check agent content for ${filename}: ${error.message}`);
    return false;
  }
}

function updateAgentContent(agentPath, filename) {
  const packageAgentPath = path.join(__dirname, '..', 'agents', filename);
  const targetPath = path.join(agentPath, filename);
  
  try {
    if (fs.existsSync(packageAgentPath)) {
      const newContent = fs.readFileSync(packageAgentPath, 'utf8');
      
      if (shouldUpdateAgent(agentPath, filename, newContent)) {
        fs.writeFileSync(targetPath, newContent, 'utf8');
        console.log(`🔄 Updated agent content: ${filename} in ${agentPath}`);
        return true;
      }
    }
  } catch (error) {
    console.warn(`⚠️  Failed to update ${filename}: ${error.message}`);
    return false;
  }
  
  return false;
}

function cleanupAgents() {
  console.log('🧹 n8n-MCP Modern: Cleaning up and updating agents...');
  
  const agentDirectories = findAgentDirectories();
  
  if (agentDirectories.length === 0) {
    console.log('ℹ️  No agent directories found, skipping cleanup');
    return;
  }

  let totalRemoved = 0;
  let totalUpdated = 0;
  const currentAgents = ['n8n-orchestrator.md', 'n8n-node-expert.md', 'n8n-scriptguard.md', 'n8n-connector.md', 'n8n-builder.md', 'n8n-guide.md'];
  
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
    
    // Update current agents if their content has changed
    currentAgents.forEach(agentFile => {
      if (updateAgentContent(agentPath, agentFile)) {
        totalUpdated++;
      }
    });
  });

  // Report results
  const actions = [];
  if (totalRemoved > 0) {
    actions.push(`removed ${totalRemoved} deprecated agent(s)`);
  }
  if (totalUpdated > 0) {
    actions.push(`updated ${totalUpdated} agent(s) with new content`);
  }

  if (actions.length > 0) {
    console.log(`✨ Successfully ${actions.join(' and ')}`);
    console.log('📋 Current active agents: n8n-orchestrator, n8n-node-expert, n8n-scriptguard, n8n-connector, n8n-builder, n8n-guide');
  } else {
    console.log('✅ No changes needed, installation is up to date');
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

module.exports = { 
  cleanupAgents, 
  REMOVED_AGENTS, 
  LEGACY_AGENTS, 
  AGENT_CONTENT_VERSIONS,
  updateAgentContent,
  getAgentContentHash 
};