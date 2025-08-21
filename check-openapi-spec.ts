#!/usr/bin/env tsx
/**
 * Check the OpenAPI spec to see what endpoints are available
 */

import { fetch, Headers } from "undici";

const API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
const API_KEY = process.env.N8N_API_KEY!;

async function checkOpenAPI() {
  try {
    console.log("🔍 Fetching OpenAPI specification...\n");

    const headers = new Headers({
      Accept: "application/yaml, text/yaml, */*",
      "X-N8N-API-KEY": API_KEY,
    });

    const response = await fetch(`${API_URL}/openapi.yml`, { headers });

    if (!response.ok) {
      console.log(`❌ Failed to fetch OpenAPI spec: ${response.status}`);
      return;
    }

    const yamlContent = await response.text();

    // Extract paths from the YAML content
    const pathMatches = yamlContent.match(/^  \/[^:]+:/gm);

    if (pathMatches) {
      console.log("📋 Available API endpoints:");
      const uniquePaths = [
        ...new Set(pathMatches.map((p) => p.replace(":", "").trim())),
      ];
      uniquePaths.sort().forEach((path) => {
        console.log(`  ${path}`);
      });

      // Look for node-related endpoints
      const nodeEndpoints = uniquePaths.filter(
        (path) =>
          path.includes("node") ||
          path.includes("credential") ||
          path.includes("community") ||
          path.includes("package"),
      );

      if (nodeEndpoints.length > 0) {
        console.log("\n🎯 Node/Credential related endpoints:");
        nodeEndpoints.forEach((path) => {
          console.log(`  ${path}`);
        });
      } else {
        console.log("\n❌ No node/credential endpoints found in OpenAPI spec");
        console.log(
          "This suggests your n8n version doesn't support community node discovery via API",
        );
      }
    } else {
      console.log("❌ Could not parse paths from OpenAPI spec");
    }

    // Also check for version info in the spec
    const versionMatch = yamlContent.match(/version:\s*['"]?([^'"\\n]+)['"]?/);
    if (versionMatch) {
      console.log(`\n📦 n8n API Version: ${versionMatch[1]}`);
    }
  } catch (error) {
    console.error("❌ Error checking OpenAPI spec:", error.message);
  }
}

// Also try to get version info directly
async function checkVersion() {
  try {
    console.log("\n🔍 Checking for version endpoint...");

    const headers = new Headers({
      "Content-Type": "application/json",
      "X-N8N-API-KEY": API_KEY,
    });

    // Try different version endpoints
    const versionEndpoints = ["/version", "/info", "/health", "/"];

    for (const endpoint of versionEndpoints) {
      const response = await fetch(`${API_URL}${endpoint}`, { headers });
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${endpoint}: ${JSON.stringify(data, null, 2)}`);
        break;
      }
    }
  } catch (error) {
    console.log("No version info available via API");
  }
}

await checkOpenAPI();
await checkVersion();
