#!/usr/bin/env tsx
/**
 * Test validation with real community packages that exist
 */

process.env.N8N_API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
process.env.N8N_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

import { ComprehensiveMCPTools } from "./src/tools/comprehensive.js";

console.log("🔍 Testing validation with real community packages\n");

try {
  // Test with some real n8n community packages that exist on npm
  const result = await ComprehensiveMCPTools.executeTool(
    "validate_node_availability",
    {
      nodeTypes: [
        // Non-existent package (should show as not available)
        "@n8n/n8n-nodes-scrapeninja",

        // Real community packages that exist on npm
        "n8n-nodes-puppeteer",
        "n8n-nodes-typeform",
        "n8n-nodes-evolution-api",

        // Built-in nodes (should show as available)
        "n8n-nodes-base.httpRequest",
        "n8n-nodes-base.set",
        "n8n-nodes-base.code",

        // Unknown format (should show suggestion)
        "some-random-node",
      ],
    },
  );

  console.log("✅ Validation Results:");
  console.log("=".repeat(60));

  result.forEach((item: any, index: number) => {
    console.log(`\n${index + 1}. ${item.nodeType}`);
    console.log(`   Type: ${item.type}`);
    console.log(`   Available: ${item.available ? "✅ YES" : "❌ NO"}`);
    console.log(`   Status: ${item.status}`);

    if (item.packageName) {
      console.log(`   Package: ${item.packageName}`);
    }

    if (item.npmUrl) {
      console.log(`   NPM: ${item.npmUrl}`);
    }

    if (item.description) {
      console.log(`   Description: ${item.description}`);
    }

    if (item.suggestion) {
      console.log(`   💡 Suggestion: ${item.suggestion}`);
    }
  });

  console.log("\n🎯 Summary:");
  const available = result.filter((r: any) => r.available);
  const unavailable = result.filter((r: any) => !r.available);

  console.log(`✅ Available: ${available.length}`);
  console.log(`❌ Unavailable: ${unavailable.length}`);
  console.log(`📦 Total checked: ${result.length}`);
} catch (error) {
  console.error("❌ Error:", error.message);
}
