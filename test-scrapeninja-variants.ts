#!/usr/bin/env tsx
/**
 * Test different scrapeninja package name variants
 */

process.env.N8N_API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
process.env.N8N_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

import { ComprehensiveMCPTools } from "./src/tools/comprehensive.js";

console.log("🔍 Testing different ScrapeNinja package name variants\n");

try {
  const result = await ComprehensiveMCPTools.executeTool(
    "validate_node_availability",
    {
      nodeTypes: [
        // Different possible scrapeninja package names
        "@n8n/n8n-nodes-scrapeninja",
        "n8n-nodes-scrapeninja",
        "scrapeninja",
        "@scrapeninja/n8n-nodes",
        "@scrapeninja/n8n-nodes-scrapeninja",
        "n8n-nodes-scrapeninja-community",

        // Known working community packages for comparison
        "n8n-nodes-puppeteer",
      ],
    },
  );

  console.log("Results:");
  result.forEach((item: any) => {
    console.log(`\n📦 ${item.nodeType}`);
    console.log(`   Available: ${item.available ? "✅" : "❌"}`);
    if (item.status) console.log(`   Status: ${item.status}`);
    if (item.npmUrl) console.log(`   NPM: ${item.npmUrl}`);
  });
} catch (error) {
  console.error("❌ Error:", error.message);
}

console.log(
  "\n🔍 Also checking npm registry directly for scrapeninja packages...",
);

async function searchNpmForScrapeNinja() {
  try {
    const response = await fetch(
      "https://registry.npmjs.org/-/search?text=scrapeninja%20n8n",
    );
    const data = await response.json();

    console.log(
      `\nFound ${data.objects?.length || 0} packages with 'scrapeninja n8n':`,
    );
    data.objects?.forEach((pkg: any) => {
      console.log(`  📦 ${pkg.package.name} - ${pkg.package.description}`);
      console.log(`     Version: ${pkg.package.version}`);
      console.log(
        `     URL: https://www.npmjs.com/package/${pkg.package.name}`,
      );
    });
  } catch (error) {
    console.log("Could not search npm registry");
  }
}

await searchNpmForScrapeNinja();
