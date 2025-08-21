#!/usr/bin/env tsx
/**
 * Test if we can validate node availability
 */

process.env.N8N_API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
process.env.N8N_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

import { ComprehensiveMCPTools } from "./src/tools/comprehensive.js";

console.log("🔍 Testing node availability validation\n");

try {
  // Test the scrapeninja node
  const result = await ComprehensiveMCPTools.executeTool(
    "validate_node_availability",
    {
      nodeTypes: [
        "@n8n/n8n-nodes-scrapeninja",
        "n8n-nodes-base.httpRequest",
        "n8n-nodes-base.code",
      ],
    },
  );

  console.log("Validation result:", JSON.stringify(result, null, 2));

  // Also check what nodes ARE available (this will be limited since n8n API doesn't support node discovery)
  console.log(
    "\n⚠️  Note: Node search is limited due to n8n API version 1.1.1 not supporting /node-types endpoint",
  );
  console.log(
    "The 'search_nodes_advanced' tool cannot retrieve node information from your n8n instance",
  );
  console.log(
    "But 'validate_node_availability' now works via npm registry for community packages!",
  );
} catch (error) {
  console.error("Error:", error.message);
}
