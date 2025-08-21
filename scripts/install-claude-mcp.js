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
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLAUDE_AGENTS_DIR = path.join(process.cwd(), ".claude", "agents");
const PACKAGE_AGENTS_DIR = path.join(__dirname, "..", "agents");
const VERSION_FILE = path.join(CLAUDE_AGENTS_DIR, ".n8n-mcp-version");
const CONTENT_HASH_FILE = path.join(CLAUDE_AGENTS_DIR, ".n8n-mcp-content-hash");

// Get version dynamically from package.json
let CURRENT_VERSION = "4.7.4"; // Fallback version
try {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
  );
  CURRENT_VERSION = packageJson.version;
} catch (error) {
  // Use fallback if can't read package.json
}
const AGENT_CONTENT_VERSION = "1.0.1"; // Bump when agent content changes

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
 * Clean up SQLite temporary files from package directory
 * Removes WAL/SHM files that might exist from previous versions
 */
function cleanupSQLiteFiles() {
  const packageRoot = path.join(__dirname, "..");
  const dataDir = path.join(packageRoot, "data");

  if (fs.existsSync(dataDir)) {
    const filesToClean = ["nodes.db-wal", "nodes.db-shm"];
    filesToClean.forEach((file) => {
      const filePath = path.join(dataDir, file);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`🧹 Cleaned up: ${file}`);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  }
}

/**
 * Copy agent files
 */
function copyAgents() {
  console.log("📋 Installing n8n MCP agents...");

  // Clean up any leftover SQLite temporary files first
  cleanupSQLiteFiles();

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
 * Calculate hash of agent files to detect content changes
 */
function calculateAgentContentHash() {
  const hash = crypto.createHash("sha256");
  const agentFiles = fs.readdirSync(PACKAGE_AGENTS_DIR).sort();

  agentFiles.forEach((file) => {
    if (file.endsWith(".md") && file !== "README.md") {
      const filePath = path.join(PACKAGE_AGENTS_DIR, file);
      const content = fs.readFileSync(filePath, "utf8");
      hash.update(file + content);
    }
  });

  // Include agent content version in hash
  hash.update(AGENT_CONTENT_VERSION);
  return hash.digest("hex");
}

/**
 * Check if agents need updating
 */
function needsUpdate() {
  // Check if agents directory exists
  if (!fs.existsSync(CLAUDE_AGENTS_DIR)) {
    console.log("🔍 No agents directory found - installation needed");
    return { needed: true, reason: "fresh_install" };
  }

  // Check version file
  if (!fs.existsSync(VERSION_FILE)) {
    console.log("🔍 No version file found - installation needed");
    return { needed: true, reason: "missing_version" };
  }

  const installedVersion = fs.readFileSync(VERSION_FILE, "utf8").trim();

  // Check if version has changed
  if (installedVersion !== CURRENT_VERSION) {
    console.log(
      `🔍 Version change detected: ${installedVersion} → ${CURRENT_VERSION}`,
    );
    return {
      needed: true,
      reason: "version_change",
      previousVersion: installedVersion,
    };
  }

  // Check content hash for agent file changes
  const currentHash = calculateAgentContentHash();

  if (fs.existsSync(CONTENT_HASH_FILE)) {
    const installedHash = fs.readFileSync(CONTENT_HASH_FILE, "utf8").trim();
    if (installedHash !== currentHash) {
      console.log("🔍 Agent content changes detected");
      return {
        needed: true,
        reason: "content_change",
        previousVersion: installedVersion,
      };
    }
  } else {
    console.log("🔍 No content hash found - installation needed");
    return {
      needed: true,
      reason: "missing_hash",
      previousVersion: installedVersion,
    };
  }

  // Everything is up to date
  return { needed: false, reason: "up_to_date", version: installedVersion };
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
 * Update version and content hash files
 */
function updateVersionFile() {
  fs.writeFileSync(VERSION_FILE, CURRENT_VERSION);
  const contentHash = calculateAgentContentHash();
  fs.writeFileSync(CONTENT_HASH_FILE, contentHash);
  console.log(`📝 Updated version file: ${CURRENT_VERSION}`);
  console.log(`📝 Updated content hash`);
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
  console.log(`   • 7 specialized agents with streamlined naming`);
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
  console.log(`📊 Agent Count: 7 specialized agents`);
  console.log(`🔧 Tool Count: 98 MCP tools`);
  console.log(`\n🤖 Available Agents:`);
  console.log(`   • n8n-orchestrator (Master Coordinator)`);
  console.log(`   • n8n-builder (Code & DevOps)`);
  console.log(`   • n8n-connector (Authentication & APIs)`);
  console.log(`   • n8n-node-expert (525+ Nodes)`);
  console.log(`   • n8n-optimizer (Performance & Monitoring)`);
  console.log(`   • n8n-scriptguard (JavaScript Security)`);
  console.log(`   • n8n-guide (Documentation & Support)`);
}

/**
 * Main installation function
 * @param {boolean} silent - Run in silent mode (for auto-install)
 * @returns {boolean} - True if installation/update occurred, false if already up to date
 */
function main(silent = false) {
  if (!silent) {
    console.log("🚀 n8n MCP Claude Integration Setup\n");
  }

  // Check if update is needed
  const updateStatus = needsUpdate();

  if (!updateStatus.needed) {
    if (!silent) {
      console.log("✅ Agents are already up to date");
      console.log(`📦 Version: ${updateStatus.version}`);
    }
    return false;
  }

  if (!silent) {
    console.log(`📋 Update needed: ${updateStatus.reason}`);
  }

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
    if (!silent) {
      if (updateStatus.previousVersion) {
        showUpgradeInfo(updateStatus.previousVersion);
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
      console.log(`   • Run: npm install -g @eekfonky/n8n-mcp-modern@latest`);
      console.log(`   • Agents will auto-update on next MCP server start`);
    } else {
      console.log(`✅ Agents updated (${updateStatus.reason})`);
    }

    return true;
  } catch (error) {
    console.error("❌ Installation failed:", error.message);
    if (!silent) {
      process.exit(1);
    }
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check for --silent flag
  const silent =
    process.argv.includes("--silent") || process.argv.includes("-s");
  main(silent);
}

export { main, copyAgents, checkExistingInstallation, needsUpdate };
