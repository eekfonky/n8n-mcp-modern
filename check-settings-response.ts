#!/usr/bin/env tsx
/**
 * Check the full settings response for community package info
 */

import { fetch, Headers } from "undici";

const BASE_URL = "https://n8n.srv925321.hstgr.cloud";
const API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

console.log(
  "🔍 Checking full /rest/settings response for community package info\n",
);

try {
  const headers = new Headers({
    "X-N8N-API-KEY": API_KEY,
    Accept: "application/json",
  });

  const response = await fetch(`${BASE_URL}/rest/settings`, { headers });

  if (response.ok) {
    const data = await response.json();
    console.log("📋 Full settings response:");
    console.log(JSON.stringify(data, null, 2));

    // Look for any community/package related fields
    const settingsStr = JSON.stringify(data).toLowerCase();
    const communityRelated = [
      "community",
      "package",
      "node",
      "install",
      "npm",
      "scrapeninja",
    ];

    console.log("\n🔍 Searching for community/package related fields:");
    communityRelated.forEach((term) => {
      if (settingsStr.includes(term)) {
        console.log(`✅ Found: "${term}"`);
      } else {
        console.log(`❌ Not found: "${term}"`);
      }
    });
  } else {
    console.log(
      `❌ Failed to get settings: ${response.status} ${response.statusText}`,
    );
  }
} catch (error) {
  console.error("❌ Error:", error.message);
}
