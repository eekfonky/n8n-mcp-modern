#!/usr/bin/env tsx
/**
 * Debug what the MCP is actually doing vs what we expect
 */

// Test 1: Check what config the MCP actually loads
console.log("🔍 Testing MCP Configuration Loading\n");

// Set the environment variables like MCP would get them
process.env.N8N_API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
process.env.N8N_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

console.log("Environment Variables:");
console.log("N8N_API_URL:", process.env.N8N_API_URL);
console.log("N8N_API_KEY:", process.env.N8N_API_KEY?.substring(0, 20) + "...");

// Import config exactly like MCP does
import { config } from "./src/server/config.js";

console.log("\nLoaded Config:");
console.log("n8nApiUrl:", config.n8nApiUrl);
console.log("n8nApiKey:", config.n8nApiKey?.substring(0, 20) + "...");

// Test the actual MCP tool function
console.log("\n🧪 Testing MCP Tool Function\n");

try {
  // Import the actual tool
  const tools = await import("./src/tools/index.js");

  // Find the get_n8n_workflows tool
  const toolsArray = await tools.getTools();
  const getWorkflowsTool = toolsArray.find(
    (t) => t.name === "get_n8n_workflows",
  );

  if (getWorkflowsTool) {
    console.log("✅ Found get_n8n_workflows tool");

    // Try to call it
    console.log("📞 Calling get_n8n_workflows...");
    const result = await getWorkflowsTool.handler({ limit: 5 });
    console.log("✅ Success:", result);
  } else {
    console.log("❌ get_n8n_workflows tool not found");
    console.log(
      "Available tools:",
      toolsArray.map((t) => t.name),
    );
  }
} catch (error) {
  console.error("❌ MCP Tool Error:", error.message);

  // If it's a 401, let's see exactly what headers are being sent
  if (error.message.includes("401")) {
    console.log("\n🔍 Investigating 401 error...");

    // Import the API client and check what it's actually doing
    const { N8NApiClient } = await import("./src/n8n/api.js");
    const client = new N8NApiClient();

    // Let's monkey patch fetch to see what headers are actually sent
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      console.log("\n📡 Actual fetch call:");
      console.log("URL:", url);
      console.log("Headers:", options.headers);

      const result = await originalFetch(url, options);
      console.log("Response status:", result.status);

      return result;
    };

    try {
      await client.getWorkflows();
    } catch (e) {
      console.log("Expected error:", e.message);
    }

    // Restore original fetch
    globalThis.fetch = originalFetch;
  }
}

console.log("\n" + "=".repeat(60));
console.log("Debug complete!");
