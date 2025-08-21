#!/usr/bin/env tsx
/**
 * Test alternative endpoint paths that might work
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

    if (response.ok) {
      const data = await response.json();
      console.log(
        `  ✅ Success! Keys: ${Object.keys(data).slice(0, 5).join(", ")}`,
      );
      if (Array.isArray(data?.data)) {
        console.log(`  → Found ${data.data.length} items`);
      }
    } else if (response.status === 401) {
      console.log(`  🔒 Authentication required`);
    } else if (response.status === 403) {
      console.log(`  🚫 Forbidden - endpoint disabled`);
    } else if (response.status === 405) {
      console.log(`  ❌ Method not allowed - try different HTTP method`);
    }
  } catch (error) {
    console.log(`${path}: ERROR - ${error.message}`);
  }
}

console.log("🔍 Testing alternative endpoint patterns\n");

// Test different API patterns that might exist
const endpoints = [
  // Alternative REST paths
  "/rest/workflows",
  "/rest/node-types",
  "/rest/credential-types",
  "/rest/settings",

  // Direct paths without /api/v1
  "/node-types",
  "/credential-types",
  "/settings",

  // Alternative API versions
  "/api/node-types",
  "/api/credential-types",

  // Internal endpoints
  "/nodes/installed",
  "/nodes/available",
  "/community/packages",
  "/community/nodes",

  // Check if swagger/openapi is available
  "/docs",
  "/openapi.yml",
  "/swagger.json",

  // Health/info endpoints
  "/healthz",
  "/healthz/readiness",
  "/metrics",
  "/info",
  "/status",
];

for (const endpoint of endpoints) {
  await testEndpoint(endpoint);
}

console.log("\n🎯 Next steps if none work:");
console.log(
  "1. Check your n8n version - older versions may not have these endpoints",
);
console.log(
  "2. Verify environment variables took effect by restarting container",
);
console.log("3. Some endpoints might only be available in newer n8n versions");
