#!/usr/bin/env node
/**
 * README.md Validation Script
 * Ensures README.md is current and accurate before pushes
 */

const fs = require("fs");
const path = require("path");

// Get current version from package.json
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const currentVersion = packageJson.version;

// Read README.md
const readmePath = "README.md";
const readmeContent = fs.readFileSync(readmePath, "utf8");

console.log("🔍 Validating README.md...");

const errors = [];
const warnings = [];

// 1. Check version badge
const versionBadgePattern =
  /\[!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-([^-]+)-blue\.svg\)\]/;
const versionMatch = readmeContent.match(versionBadgePattern);

if (!versionMatch) {
  errors.push("❌ Version badge not found in README.md");
} else if (versionMatch[1] !== currentVersion) {
  errors.push(
    `❌ Version badge shows ${versionMatch[1]} but package.json has ${currentVersion}`,
  );
}

// 2. Check installation commands have current version references
const npmCommands = readmeContent.match(/npx -y @eekfonky\/n8n-mcp-modern/g);
if (!npmCommands || npmCommands.length === 0) {
  warnings.push("⚠️ No npm installation commands found");
}

// 3. Check for outdated version references
const oldVersionRefs = readmeContent.match(/v4\.[0-5]\.\d+/g);
if (oldVersionRefs) {
  warnings.push(
    `⚠️ Found references to old versions: ${oldVersionRefs.join(", ")}`,
  );
}

// 4. Check for essential sections
const requiredSections = [
  "Installation",
  "What's New",
  "Architecture",
  "Environment Variables",
];

requiredSections.forEach((section) => {
  if (!readmeContent.toLowerCase().includes(section.toLowerCase())) {
    warnings.push(`⚠️ Missing section: ${section}`);
  }
});

// 5. Check installation commands are properly formatted
const claudeMcpCommands = readmeContent.match(/claude mcp add n8n-mcp-modern/g);
if (!claudeMcpCommands || claudeMcpCommands.length < 2) {
  warnings.push("⚠️ Missing or incomplete Claude MCP installation commands");
}

// 6. Check environment variable examples
if (
  !readmeContent.includes("N8N_API_URL") ||
  !readmeContent.includes("N8N_API_KEY")
) {
  errors.push(
    "❌ Missing environment variable examples (N8N_API_URL, N8N_API_KEY)",
  );
}

// Report results
console.log("\n📋 Validation Results:");

if (errors.length === 0 && warnings.length === 0) {
  console.log("✅ README.md is up-to-date and accurate!");
  process.exit(0);
}

if (errors.length > 0) {
  console.log("\n🚨 ERRORS (must fix before push):");
  errors.forEach((error) => console.log(`  ${error}`));
}

if (warnings.length > 0) {
  console.log("\n⚠️ WARNINGS (recommended fixes):");
  warnings.forEach((warning) => console.log(`  ${warning}`));
}

console.log("\n💡 Tips:");
console.log("  • Auto-sync version badge: npm run sync-version");
console.log(
  '  • Manual update: search for "version-X.X.X-blue" and replace with current version',
);
console.log('  • Check "What\'s New" section reflects latest changes');
console.log("  • Ensure installation commands are current");
console.log("  • Run: npm run validate-readme to check again");

if (errors.length > 0) {
  console.log(
    "\n❌ README validation failed. Please fix errors before pushing.",
  );
  process.exit(1);
} else {
  console.log("\n✅ README validation passed with warnings.");
  process.exit(0);
}
