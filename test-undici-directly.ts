#!/usr/bin/env tsx
/**
 * Test using undici directly like the code does
 */

import { fetch, Headers } from "undici";

const API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
const API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

console.log("🧪 Testing with undici directly (like the API client does)\n");

// Test 1: X-N8N-API-KEY with undici Headers
console.log("📡 Test 1: X-N8N-API-KEY with undici Headers");
try {
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-N8N-API-KEY": API_KEY,
  });

  console.log(
    "Headers object created:",
    headers.get("X-N8N-API-KEY")?.substring(0, 20) + "...",
  );

  const response = await fetch(`${API_URL}/workflows`, {
    method: "GET",
    headers: headers,
  });

  console.log("Status:", response.status);

  if (response.ok) {
    const data = await response.json();
    console.log("✅ SUCCESS - Got", data.data?.length || 0, "workflows");
  } else {
    const text = await response.text();
    console.log("❌ FAILED:", text.substring(0, 100));
  }
} catch (error) {
  console.log("❌ ERROR:", error.message);
}

console.log("\n" + "-".repeat(50));

// Test 2: Check if the JWT token has any issues
console.log("📡 Test 2: JWT token validation");
const segments = API_KEY.split(".");
console.log("JWT segments:", segments.length);
console.log("Header length:", segments[0]?.length);
console.log("Payload length:", segments[1]?.length);
console.log("Signature length:", segments[2]?.length);

// Check for any control characters
const hasControlChars = /[\r\n\0\t]/.test(API_KEY);
console.log("Has control characters:", hasControlChars);

// Test sanitization like our code does
const sanitizedApiKey = API_KEY.trim().replace(/[\r\n\0]/g, "");
console.log("API key changed after sanitization:", API_KEY !== sanitizedApiKey);

console.log("\n" + "-".repeat(50));

// Test 3: Reproduce the exact API client behavior
console.log("📡 Test 3: Exact reproduction of N8NApiClient");

// Set environment like MCP would
process.env.N8N_API_URL = API_URL;
process.env.N8N_API_KEY = API_KEY;

const { N8NApiClient } = await import("./src/n8n/api.js");

try {
  const client = new N8NApiClient();
  console.log("✅ Client created");

  const workflows = await client.getWorkflows();
  console.log("✅ Got", workflows.length, "workflows");
} catch (error) {
  console.log("❌ N8NApiClient error:", error.message);

  // Check if it's specifically a 401
  if (error.message.includes("401")) {
    console.log("🚨 This is a 401 authentication error!");
    console.log("This means our fix is NOT working in this environment");
  }
}

console.log("\n" + "=".repeat(60));
console.log("Test complete!");
