#!/bin/bash

echo "🧪 Testing Comprehensive n8n-MCP Tool Suite..."
echo ""

# Set environment variables
export N8N_API_URL="https://n8n.srv925321.hstgr.cloud" 
export N8N_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo"
export LOG_LEVEL="info"

echo "📊 Server Performance Test:"
echo "=========================================="

# Test startup performance and tool count
timeout 5s npm run start 2>&1 | grep -E "(🚀|✅|tools|ready|Generating|Comprehensive)" | {
  while IFS= read -r line; do
    if [[ "$line" == *"Generating tools for"* ]]; then
      echo "🔧 $line"
    elif [[ "$line" == *"tools generated"* ]]; then 
      echo "✅ $line"
    elif [[ "$line" == *"tools available"* ]]; then
      echo "📦 $line"
    elif [[ "$line" == *"ready in"* ]]; then
      echo "⚡ $line"
    fi
  done
}

echo ""
echo "📋 Tool Categories Expected:"
echo "=========================================="
echo "✅ Core Workflow Nodes (Start, Edit Fields, IF, Merge, Code)"
echo "✅ Communication (Slack, Discord, Email)"  
echo "✅ Databases (PostgreSQL, MySQL, MongoDB, Redis)"
echo "✅ Google Services (Sheets, Drive, Gmail)"
echo "✅ AWS Services (S3, Lambda, SES)"
echo "✅ Microsoft Services (Excel, OneDrive, Outlook)"
echo "✅ Development Tools (GitHub, GitLab, Jira)" 
echo "✅ AI/ML (OpenAI, Anthropic Claude)"
echo "✅ Community Nodes (Supabase, Airtable)"

echo ""
echo "🎯 Performance Targets:"
echo "=========================================="
echo "Target: <2000ms startup ⚡"
echo "Target: >100 tools 📦"  
echo "Target: Community node support 🌍"
echo "Target: Dynamic discovery 🔄"

echo ""
echo "🎉 Test Complete!"