#!/usr/bin/env tsx
/**
 * Test if we can access community nodes settings endpoint
 */

import { fetch, Headers } from "undici";

const BASE_URL = "https://n8n.srv925321.hstgr.cloud";
const API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

async function testEndpoint(path: string, description: string) {
  console.log(`\n🔍 Testing: ${description}`);
  console.log(`   Path: ${path}`);

  try {
    const headers = new Headers({
      "X-N8N-API-KEY": API_KEY,
      Accept: "application/json",
    });

    const response = await fetch(`${BASE_URL}${path}`, { headers });
    console.log(`   Status: ${response.status}`);

    if (response.ok) {
      const contentType = response.headers.get("content-type");
      console.log(`   Content-Type: ${contentType}`);

      if (contentType?.includes("application/json")) {
        const data = await response.json();
        console.log(
          `   ✅ JSON Response: ${JSON.stringify(data, null, 2).substring(0, 200)}...`,
        );
      } else {
        const text = await response.text();
        console.log(
          `   📄 Text Response (first 200 chars): ${text.substring(0, 200)}...`,
        );
      }
    } else {
      console.log(`   ❌ Error: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`   ❌ Exception: ${error.message}`);
  }
}

console.log("🔍 Testing community nodes and installed packages endpoints\n");

// Test various possible endpoints for community nodes
const endpoints = [
  // Web UI endpoints (might not be accessible via API)
  { path: "/settings/community-nodes", desc: "Community nodes settings page" },
  { path: "/api/v1/community-packages", desc: "Community packages API" },
  { path: "/api/v1/community-nodes", desc: "Community nodes API" },
  { path: "/api/v1/packages", desc: "Packages API" },

  // Alternative internal endpoints
  { path: "/rest/packages", desc: "REST packages endpoint" },
  { path: "/rest/community-packages", desc: "REST community packages" },
  { path: "/rest/installed-packages", desc: "REST installed packages" },
  { path: "/rest/settings", desc: "REST settings endpoint" },

  // Try some settings endpoints
  { path: "/api/v1/settings", desc: "Settings API" },
  {
    path: "/api/v1/settings/community-packages",
    desc: "Community package settings",
  },

  // Check if there's a way to get installed node info
  { path: "/api/v1/nodes/installed", desc: "Installed nodes" },
  { path: "/api/v1/nodes/community", desc: "Community nodes" },

  // Health/status endpoints might reveal installed packages
  { path: "/api/v1/status", desc: "Status endpoint" },
  { path: "/api/v1/health", desc: "Health endpoint" },
];

for (const endpoint of endpoints) {
  await testEndpoint(endpoint.path, endpoint.desc);
}

console.log("\n🎯 Summary:");
console.log(
  "Most likely, the community nodes information is only available through:",
);
console.log(
  "1. The web UI (/settings/community-nodes) which requires session auth",
);
console.log("2. Internal APIs that aren't exposed publicly");
console.log("3. File system scanning (not possible via API)");
console.log(
  "\nOur npm registry approach is the best alternative for community node discovery!",
);
