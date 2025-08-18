#!/usr/bin/env node

/**
 * Smart MCP Installation Script
 * Automatically detects project context and installs with appropriate scope
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const N8N_API_URL = process.env.N8N_API_URL || "https://your-n8n-instance.com";
const N8N_API_KEY = process.env.N8N_API_KEY || "your-api-key";

function detectInstallationScope() {
  // Check if we're in a project directory with .mcp.json
  const mcpJsonPath = join(process.cwd(), ".mcp.json");

  if (existsSync(mcpJsonPath)) {
    console.log(
      "📦 Detected .mcp.json file - installing as project-scoped MCP server",
    );
    return "project";
  }

  // Check if this looks like a development project
  const packageJsonPath = join(process.cwd(), "package.json");
  const gitPath = join(process.cwd(), ".git");

  if (existsSync(packageJsonPath) || existsSync(gitPath)) {
    console.log(
      "🏗️  Detected project directory - installing as project-scoped MCP server",
    );
    console.log("💡 This will create/update .mcp.json for team sharing");
    return "project";
  }

  console.log(
    "🌍 No project context detected - installing as global MCP server",
  );
  return "local";
}

function validateEnvironment() {
  if (
    N8N_API_URL === "https://your-n8n-instance.com" ||
    N8N_API_KEY === "your-api-key"
  ) {
    console.error(
      "❌ Please set N8N_API_URL and N8N_API_KEY environment variables",
    );
    console.error("");
    console.error("Example:");
    console.error('export N8N_API_URL="https://your-n8n-instance.com"');
    console.error('export N8N_API_KEY="your-jwt-token"');
    console.error("");
    console.error("Or run with:");
    console.error(
      'N8N_API_URL="https://..." N8N_API_KEY="..." npm run mcp:install',
    );
    process.exit(1);
  }
}

function main() {
  console.log("🚀 n8n-MCP Modern - Smart Installation");
  console.log("");

  validateEnvironment();

  const scope = detectInstallationScope();

  const command = [
    "claude mcp add n8n-mcp-modern",
    `--scope ${scope}`,
    `--env N8N_API_URL="${N8N_API_URL}"`,
    `--env N8N_API_KEY="${N8N_API_KEY}"`,
    "-- npx -y @lexinet/n8n-mcp-modern",
  ].join(" ");

  console.log("📋 Running command:");
  console.log(`   ${command}`);
  console.log("");

  try {
    execSync(command, { stdio: "inherit" });
    console.log("");
    console.log("✅ Installation completed successfully!");

    if (scope === "project") {
      console.log(
        "📄 MCP server added to .mcp.json (commit this file for team sharing)",
      );
    } else {
      console.log("🔧 MCP server added to global configuration");
    }

    console.log("");
    console.log("🔍 Verify installation with: claude mcp list");
  } catch (error) {
    const errorMessage = error.message;

    // Handle case where server already exists
    if (errorMessage.includes("already exists")) {
      console.log("");
      console.log("ℹ️  MCP server already configured!");
      console.log("");
      console.log("To update configuration:");
      console.log(`   claude mcp remove n8n-mcp-modern -s ${scope}`);
      console.log(`   ${command}`);
      console.log("");
      console.log("🔍 Current status: claude mcp list");
      return;
    }

    console.error("❌ Installation failed:", errorMessage);
    console.error("");
    console.error("💡 Try running manually:");
    console.error(`   ${command}`);
    process.exit(1);
  }
}

main();
