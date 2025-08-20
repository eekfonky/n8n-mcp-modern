#!/usr/bin/env node
/**
 * Version Sync Script
 * Automatically updates README.md version badge to match package.json
 */

const fs = require("fs");
const path = require("path");

console.log("🔄 Syncing README.md version with package.json...");

try {
  // Get current version from package.json
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const currentVersion = packageJson.version;
  
  console.log(`📦 Package version: ${currentVersion}`);

  // Read README.md
  const readmePath = "README.md";
  let readmeContent = fs.readFileSync(readmePath, "utf8");

  // Update version badge
  const versionBadgePattern =
    /(\[!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-)([^-]+)(-blue\.svg\)\])/;
  
  const match = readmeContent.match(versionBadgePattern);
  
  if (!match) {
    console.log("❌ Version badge not found in README.md");
    process.exit(1);
  }
  
  const oldVersion = match[2];
  
  if (oldVersion === currentVersion) {
    console.log("✅ README.md version badge is already current");
    process.exit(0);
  }
  
  // Replace version in badge
  const newReadmeContent = readmeContent.replace(
    versionBadgePattern,
    `$1${currentVersion}$3`
  );
  
  // Write updated README.md
  fs.writeFileSync(readmePath, newReadmeContent, "utf8");
  
  console.log(`✅ Updated README.md version badge: ${oldVersion} → ${currentVersion}`);
  console.log("💡 Don't forget to update the 'What's New' section with your changes!");
  
} catch (error) {
  console.error("❌ Error syncing version:", error.message);
  process.exit(1);
}