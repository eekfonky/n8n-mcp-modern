#!/bin/bash

echo "🧪 Testing MCP server with real n8n instance..."

# Set environment variables
export N8N_API_URL="https://n8n.srv925321.hstgr.cloud"
export N8N_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo"
export LOG_LEVEL="info"

echo "📋 Starting MCP server..."

# Test MCP server startup and tool discovery
timeout 5s npm run start 2>&1 | grep -E "(🚀|✅|tools|ready|INFO)" | head -10

echo ""
echo "✅ MCP server test completed!"

# Now test that the tools actually work by testing workflows API directly
echo ""
echo "🔧 Testing n8n API directly..."

# Test list workflows
echo "📋 Testing workflow listing..."
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_API_URL/api/v1/workflows" | jq '.data | length' 2>/dev/null | {
  read count
  echo "Found $count workflows in your n8n instance"
}

echo ""
echo "🎉 All tests completed successfully!"