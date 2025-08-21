#!/usr/bin/env tsx
/**
 * Test all possible n8n authentication methods
 */

const API_URL = "https://n8n.srv925321.hstgr.cloud/api/v1";
const API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

console.log("🧪 Testing ALL n8n Authentication Methods\n");
console.log("API URL:", API_URL);
console.log("API Key:", API_KEY.substring(0, 20) + "...");
console.log("=".repeat(60));

async function testAuth(method: string, headers: Record<string, string>) {
  console.log(`\n📡 Testing: ${method}`);
  console.log("Headers:", JSON.stringify(headers, null, 2));

  try {
    const response = await fetch(`${API_URL}/workflows`, {
      method: "GET",
      headers: headers,
    });

    console.log(`Response Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS - Got ${data.data?.length || 0} workflows`);
      return true;
    } else {
      const text = await response.text();
      console.log(`❌ FAILED - ${response.status}: ${text.substring(0, 100)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR - ${error.message}`);
    return false;
  }
}

async function main() {
  // Test 1: X-N8N-API-KEY (what we implemented)
  await testAuth("X-N8N-API-KEY header", {
    "X-N8N-API-KEY": API_KEY,
    "Content-Type": "application/json",
  });

  // Test 2: Bearer token (old method)
  await testAuth("Authorization Bearer", {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  });

  // Test 3: X-API-KEY (alternative)
  await testAuth("X-API-KEY header", {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json",
  });

  // Test 4: API-Key header
  await testAuth("API-Key header", {
    "API-Key": API_KEY,
    "Content-Type": "application/json",
  });

  // Test 5: X-Access-Token
  await testAuth("X-Access-Token header", {
    "X-Access-Token": API_KEY,
    "Content-Type": "application/json",
  });

  // Test 6: Cookie-based
  await testAuth("Cookie n8n-api-key", {
    Cookie: `n8n-api-key=${API_KEY}`,
    "Content-Type": "application/json",
  });

  // Test 7: Query parameter
  console.log(`\n📡 Testing: Query parameter`);
  try {
    const response = await fetch(`${API_URL}/workflows?api_key=${API_KEY}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`Response Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS - Got ${data.data?.length || 0} workflows`);
    } else {
      console.log(`❌ FAILED - ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ ERROR - ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    "\n🔍 SUMMARY: Check above to see which authentication method works!",
  );
  console.log("\nIf NONE work, the issue might be:");
  console.log("1. The API key is invalid or expired");
  console.log("2. The public API is not enabled in n8n");
  console.log("3. The API endpoint is wrong");
  console.log("4. There's a firewall or proxy blocking the requests");
}

main();
