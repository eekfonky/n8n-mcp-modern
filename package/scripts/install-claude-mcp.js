#!/usr/bin/env node
/**
 * Claude MCP Installation Script
 * Automatically installs agents to ~/.claude/agents/ directory
 * Provides upgrade path for seamless updates
 */

import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLAUDE_AGENTS_DIR = path.join(process.cwd(), ".claude", "agents");
const PACKAGE_AGENTS_DIR = path.join(__dirname, "..", "agents");
const VERSION_FILE = path.join(CLAUDE_AGENTS_DIR, ".n8n-mcp-version");

// Current package version
const CURRENT_VERSION = "4.3.2";

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
}

/**
 * Copy agent files
 */
function copyAgents() {
  console.log("📋 Installing n8n MCP agents...");

  // Ensure agents directory exists
  ensureDir(CLAUDE_AGENTS_DIR);

  // Copy all agent files
  const agentFiles = fs.readdirSync(PACKAGE_AGENTS_DIR);
  let copiedCount = 0;

  agentFiles.forEach((file) => {
    // Only copy agent .md files, skip README.md
    if (file.endsWith(".md") && file !== "README.md") {
      const sourcePath = path.join(PACKAGE_AGENTS_DIR, file);
      const targetPath = path.join(CLAUDE_AGENTS_DIR, file);

      try {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`  ✅ Installed: ${file}`);
        copiedCount++;
      } catch (error) {
        console.error(`  ❌ Failed to install ${file}:`, error.message);
      }
    }
  });

  console.log(`🎯 Installed ${copiedCount} agents to ${CLAUDE_AGENTS_DIR}`);
  return copiedCount;
}

/**
 * Check for existing installation and version
 */
function checkExistingInstallation() {
  if (fs.existsSync(VERSION_FILE)) {
    const installedVersion = fs.readFileSync(VERSION_FILE, "utf8").trim();
    return installedVersion;
  }
  return null;
}

/**
 * Update version file
 */
function updateVersionFile() {
  fs.writeFileSync(VERSION_FILE, CURRENT_VERSION);
  console.log(`📝 Updated version file: ${CURRENT_VERSION}`);
}

/**
 * Show upgrade information
 */
function showUpgradeInfo(previousVersion) {
  console.log(`\n🚀 n8n MCP Agents Upgrade Complete!`);
  console.log(`   Previous: v${previousVersion}`);
  console.log(`   Current:  v${CURRENT_VERSION}`);
  console.log(`\n📊 New in v${CURRENT_VERSION}:`);
  console.log(`   • 98 total tools (up from 87+)`);
  console.log(`   • 6 optimized agents (streamlined from 7)`);
  console.log(`   • Code generation tools (12 new)`);
  console.log(`   • DevOps integration tools (10 new)`);
  console.log(`   • Performance monitoring tools (12 new)`);
  console.log(`   • Enhanced agent specialization`);
}

/**
 * Show installation information
 */
function showInstallInfo() {
  console.log(`\n🎉 n8n MCP Agents Installation Complete!`);
  console.log(`\n📍 Installed to: ${CLAUDE_AGENTS_DIR}`);
  console.log(`📊 Agent Count: 6 specialized agents`);
  console.log(`🔧 Tool Count: 98 MCP tools`);
  console.log(`\n🤖 Available Agents:`);
  console.log(`   • n8n-workflow-architect (Master Orchestrator)`);
  console.log(`   • n8n-developer-specialist (Code & DevOps)`);
  console.log(`   • n8n-integration-specialist (Authentication)`);
  console.log(`   • n8n-node-specialist (525+ Nodes + AI/ML)`);
  console.log(`   • n8n-performance-specialist (Monitoring)`);
  console.log(`   • n8n-guidance-specialist (Documentation & Support)`);
}

/**
 * Main installation function
 */
function main() {
  console.log("🚀 n8n MCP Claude Integration Setup\n");

  // Check if this is an upgrade
  const previousVersion = checkExistingInstallation();

  try {
    // Copy agents
    const agentCount = copyAgents();

    if (agentCount === 0) {
      console.error("❌ No agents were installed. Check package integrity.");
      process.exit(1);
    }

    // Update version tracking
    updateVersionFile();

    // Show appropriate completion message
    if (previousVersion) {
      showUpgradeInfo(previousVersion);
    } else {
      showInstallInfo();
    }

    // Final instructions
    console.log(`\n✨ Next Steps:`);
    console.log(`   1. Restart Claude Code if running`);
    console.log(
      `   2. Use: claude mcp add n8n-mcp-modern --env N8N_API_URL=... --env N8N_API_KEY=...`,
    );
    console.log(`   3. Agents are automatically available in Claude Code!`);

    console.log(`\n🔄 Upgrade Path:`);
    console.log(`   • Run: npm install -g @lexinet/n8n-mcp-modern@latest`);
    console.log(`   • Agents will auto-update on next MCP server start`);
  } catch (error) {
    console.error("❌ Installation failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, copyAgents, checkExistingInstallation };
