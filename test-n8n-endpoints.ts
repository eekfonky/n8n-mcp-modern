#!/usr/bin/env tsx
/**
 * Test what endpoints your n8n instance actually supports
 */

process.env.N8N_API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
process.env.N8N_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

import { fetch, Headers } from "undici";

const API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
const API_KEY = process.env.N8N_API_KEY!;

async function testEndpoint(path: string) {
  try {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-N8N-API-KEY": API_KEY,
    });

    const response = await fetch(`${API_URL}${path}`, { headers });

    console.log(`${path}: ${response.status}`);

    if (response.ok && path !== "/workflows") {
      // Don't log workflows for brevity
      const data = await response.json();
      if (Array.isArray(data?.data)) {
        console.log(`  → Found ${data.data.length} items`);
      } else if (data?.version) {
        console.log(`  → Version: ${data.version}`);
      } else {
        console.log(`  → Structure:`, Object.keys(data).slice(0, 5));
      }
    }
  } catch (error) {
    console.log(`${path}: ERROR - ${error.message}`);
  }
}

console.log("🔍 Testing n8n API endpoints to find node discovery\n");

// Test common endpoints that might give us node information
const endpoints = [
  "/workflows", // We know this works
  "/node-types", // This failed, but let's confirm
  "/credentials", // Credential types
  "/credential-types", // Available credential types
  "/settings", // Instance settings
  "/community-packages", // Community packages
  "/installed-packages", // Installed packages
  "/nodes", // Alternative nodes endpoint
  "/types/nodes", // Alternative path
  "/api/v1/node-types", // Maybe it's at a different path?
  "/community-nodes", // Another possibility
  "/packages", // Package info
  "/health", // Health check
  "/version", // Version info
];

for (const endpoint of endpoints) {
  await testEndpoint(endpoint);
}

console.log(
  "\n🔍 Let's also check your docker-compose for community package settings...",
);
console.log("Current docker environment includes:");
console.log("- N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true");
console.log("\nYou might need to add:");
console.log("- N8N_NODES_EXCLUDE=[]");
console.log("- N8N_NODES_INCLUDE=[]");
console.log("- N8N_COMMUNITY_PACKAGES_ENABLED=true");
