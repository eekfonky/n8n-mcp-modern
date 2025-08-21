#!/usr/bin/env tsx
/**
 * Test what environment variables are needed for community node discovery
 */

console.log("🔍 Community Node Discovery Requirements\n");

console.log(
  "According to n8n documentation, you need these environment variables:",
);
console.log("\n📋 REQUIRED Environment Variables:");
console.log("✅ N8N_PUBLIC_API_ENABLED=true  (you have this)");
console.log("❓ N8N_COMMUNITY_PACKAGES_ENABLED=true  (default: true)");
console.log("❓ N8N_VERIFIED_PACKAGES_ENABLED=true  (default: true)");
console.log("❓ N8N_UNVERIFIED_PACKAGES_ENABLED=true  (default: true)");

console.log("\n📋 ADDITIONAL Variables for Full API:");
console.log("❓ N8N_METRICS=true  (enables /metrics endpoint)");
console.log("❓ N8N_ENDPOINT_REST=rest  (default: rest)");
console.log(
  "❓ N8N_PUBLIC_API_SWAGGERUI_DISABLED=false  (enables API playground)",
);

console.log("\n🔧 Suggested docker-compose.yml additions:");
console.log(`
environment:
  # Existing variables
  - N8N_PUBLIC_API_ENABLED=true
  - N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
  
  # Add these for full community node support:
  - N8N_COMMUNITY_PACKAGES_ENABLED=true
  - N8N_VERIFIED_PACKAGES_ENABLED=true  
  - N8N_UNVERIFIED_PACKAGES_ENABLED=true
  - N8N_METRICS=true
  - N8N_PUBLIC_API_SWAGGERUI_DISABLED=false
`);

console.log("\n🎯 Key Insight:");
console.log(
  "The /node-types endpoint specifically needs N8N_COMMUNITY_PACKAGES_ENABLED=true",
);
console.log("to expose community node information through the public API.");

console.log("\n📚 Documentation References:");
console.log(
  "- N8N_COMMUNITY_PACKAGES_ENABLED controls community node functionality",
);
console.log(
  "- N8N_VERIFIED_PACKAGES_ENABLED controls verified community nodes in UI",
);
console.log(
  "- N8N_UNVERIFIED_PACKAGES_ENABLED controls unverified community nodes",
);
console.log("- These defaults should be 'true' but may be explicitly disabled");
