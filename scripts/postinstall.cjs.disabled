#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Post-install script to automatically copy n8n agents to Claude Code agents directory
 */

async function installAgents() {
  console.log('🤖 Installing n8n Claude Code agents...');
  
  try {
    // Use current working directory for project-specific installation
    const currentDir = process.cwd();
    const claudeAgentsDir = path.join(currentDir, '.claude', 'agents');
    
    // Create .claude/agents directory if it doesn't exist  
    if (!fs.existsSync(claudeAgentsDir)) {
      console.log('📁 Creating .claude/agents directory...');
      fs.mkdirSync(claudeAgentsDir, { recursive: true });
    }
    
    // Find the agents directory in the installed package
    const packageDir = path.dirname(path.dirname(__filename));
    const agentsSourceDir = path.join(packageDir, 'agents');
    
    if (!fs.existsSync(agentsSourceDir)) {
      console.log('⚠️  Agents directory not found, skipping agent installation');
      return;
    }
    
    // Copy all .md files from agents/ to ~/.claude/agents/
    const agentFiles = fs.readdirSync(agentsSourceDir)
      .filter(file => file.endsWith('.md') && file !== 'README.md');
    
    let installedCount = 0;
    let skippedCount = 0;
    
    for (const agentFile of agentFiles) {
      const sourcePath = path.join(agentsSourceDir, agentFile);
      const targetPath = path.join(claudeAgentsDir, agentFile);
      
      // Check if agent already exists
      if (fs.existsSync(targetPath)) {
        // Read both files to compare
        const sourceContent = fs.readFileSync(sourcePath, 'utf8');
        const targetContent = fs.readFileSync(targetPath, 'utf8');
        
        if (sourceContent === targetContent) {
          console.log(`✓ ${agentFile} (already up to date)`);
          skippedCount++;
        } else {
          // Backup existing file
          const backupPath = `${targetPath}.backup.${Date.now()}`;
          fs.copyFileSync(targetPath, backupPath);
          
          // Copy new version
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`🔄 ${agentFile} (updated, backup saved as ${path.basename(backupPath)})`);
          installedCount++;
        }
      } else {
        // Copy new agent
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`➕ ${agentFile} (installed)`);
        installedCount++;
      }
    }
    
    console.log('\n🎉 Agent installation complete!');
    console.log(`   📥 Installed/Updated: ${installedCount} agents`);
    console.log(`   ✓ Skipped (up to date): ${skippedCount} agents`);
    console.log(`   📂 Location: ${claudeAgentsDir}`);
    
    if (installedCount > 0) {
      console.log('\n📖 Usage:');
      console.log('   Run "claude agents list" to see your installed agents');
      console.log('   Use Claude Code\'s Task tool to automatically delegate to specialists');
      console.log('   Or explicitly request: "Use the n8n-workflow-architect agent to..."');
    }
    
  } catch (error) {
    console.error('❌ Error installing agents:', error.message);
    process.exit(1);
  }
}

// Only run if this script is executed directly (not required)
if (require.main === module) {
  installAgents();
}

module.exports = { installAgents };