#!/usr/bin/env tsx
/**
 * Debug what headers the MCP is actually sending
 */

// Monkey patch fetch BEFORE importing anything
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  console.log("📡 INTERCEPTED FETCH CALL:");
  console.log("URL:", url);
  console.log("Method:", options.method || "GET");

  // Check if headers is a Headers object or plain object
  let headers = options.headers;
  if (headers instanceof Headers) {
    console.log("Headers (Headers object):");
    headers.forEach((value, key) => {
      if (
        key.toLowerCase().includes("api") ||
        key.toLowerCase().includes("auth") ||
        key.toLowerCase().includes("n8n")
      ) {
        console.log(`  ${key}: ${value.substring(0, 30)}...`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });
  } else if (headers) {
    console.log("Headers (plain object):");
    for (const [key, value] of Object.entries(headers)) {
      if (
        key.toLowerCase().includes("api") ||
        key.toLowerCase().includes("auth") ||
        key.toLowerCase().includes("n8n")
      ) {
        console.log(`  ${key}: ${value.substring(0, 30)}...`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
  }

  console.log(
    "Body:",
    options.body ? options.body.substring(0, 100) + "..." : "none",
  );
  console.log("-".repeat(50));

  // Make the actual request
  const result = await originalFetch(url, options);
  console.log("Response status:", result.status);

  if (!result.ok) {
    const text = await result.text();
    console.log("Error response:", text.substring(0, 200));
    // Create new response with same status for proper error handling
    return new Response(text, {
      status: result.status,
      statusText: result.statusText,
    });
  }

  return result;
};

import { N8NApiClient } from "./src/n8n/api.js";

// Set environment variables
process.env.N8N_API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
process.env.N8N_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

console.log("🔍 Intercepting actual API calls to see headers\n");

// Monkey patch fetch to intercept calls
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  console.log("📡 INTERCEPTED FETCH CALL:");
  console.log("URL:", url);
  console.log("Method:", options.method || "GET");

  // Check if headers is a Headers object or plain object
  let headers = options.headers;
  if (headers instanceof Headers) {
    console.log("Headers (Headers object):");
    headers.forEach((value, key) => {
      if (
        key.toLowerCase().includes("api") ||
        key.toLowerCase().includes("auth")
      ) {
        console.log(`  ${key}: ${value.substring(0, 30)}...`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });
  } else {
    console.log("Headers (plain object):", JSON.stringify(headers, null, 2));
  }

  console.log(
    "Body:",
    options.body ? options.body.substring(0, 100) + "..." : "none",
  );
  console.log("-".repeat(50));

  // Make the actual request
  const result = await originalFetch(url, options);
  console.log("Response status:", result.status);

  if (!result.ok) {
    const text = await result.text();
    console.log("Error response:", text.substring(0, 200));
    // Create new response with same status for proper error handling
    return new Response(text, {
      status: result.status,
      statusText: result.statusText,
    });
  }

  return result;
};

// Now test the API client
console.log("🧪 Testing N8NApiClient...\n");

try {
  const client = new N8NApiClient();
  console.log("✅ Client created");

  // Try to get workflows
  console.log("\n📞 Calling getWorkflows()...");
  const workflows = await client.getWorkflows();
  console.log(`✅ Success: Got ${workflows.length} workflows`);
} catch (error) {
  console.error("❌ Error:", error.message);
} finally {
  // Restore original fetch
  globalThis.fetch = originalFetch;
}

console.log("\n" + "=".repeat(60));
console.log("Debug complete!");
