#!/usr/bin/env tsx
/**
 * Simple debug to see what headers are sent
 */

console.log("🔍 Testing Headers\n");

// Set environment variables
process.env.N8N_API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
process.env.N8N_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

// Monkey patch fetch to see headers
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  console.log("📡 FETCH CALL:");
  console.log("URL:", url);

  if (options.headers instanceof Headers) {
    console.log("Headers:");
    options.headers.forEach((value, key) => {
      console.log(
        `  ${key}: ${key.toLowerCase().includes("key") ? value.substring(0, 20) + "..." : value}`,
      );
    });
  }

  const result = await origFetch(url, options);
  console.log("Status:", result.status);
  return result;
};

const { N8NApiClient } = await import("./src/n8n/api.js");

try {
  const client = new N8NApiClient();
  await client.getWorkflows();
  console.log("✅ Success");
} catch (error) {
  console.log("❌ Error:", error.message);
}
