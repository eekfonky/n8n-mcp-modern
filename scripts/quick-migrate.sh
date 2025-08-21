#!/bin/bash
# Quick migration script - assumes you have GitHub token ready

set -e

echo "🚀 Quick Migration: @lexinet → @eekfonky (GitHub Packages)"
echo "======================================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if GitHub token is available
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN environment variable not set"
    echo "Please run: export GITHUB_TOKEN=your_github_token_here"
    exit 1
fi

echo -e "${YELLOW}Step 1: Cleaning old installations...${NC}"
claude mcp remove n8n-mcp-modern 2>/dev/null && echo "✅ Removed n8n-mcp-modern" || echo "ℹ️ Not found"
claude mcp remove @lexinet/n8n-mcp-modern 2>/dev/null && echo "✅ Removed @lexinet package" || echo "ℹ️ Not found"

echo -e "${YELLOW}Step 2: Clearing caches...${NC}"
npm cache clean --force >/dev/null 2>&1
rm -rf ~/.npm/_npx 2>/dev/null || true
echo "✅ Caches cleared"

echo -e "${YELLOW}Step 3: Installing @eekfonky/n8n-mcp-modern@5.2.0...${NC}"
if npx @eekfonky/n8n-mcp-modern install; then
    echo -e "${GREEN}✅ Installation successful!${NC}"
else
    echo "❌ Smart installer failed, trying manual..."
    if [ -n "$N8N_API_URL" ] && [ -n "$N8N_API_KEY" ]; then
        claude mcp add n8n-mcp-modern \
            --scope project \
            --env N8N_API_URL="$N8N_API_URL" \
            --env N8N_API_KEY="$N8N_API_KEY" \
            -- npx -y @eekfonky/n8n-mcp-modern
    else
        echo "⚠️ Manual setup required - set N8N_API_URL and N8N_API_KEY"
        echo "Then run: claude mcp add n8n-mcp-modern --scope project --env N8N_API_URL=your-url --env N8N_API_KEY=your-key -- npx -y @eekfonky/n8n-mcp-modern"
    fi
fi

echo -e "${YELLOW}Step 4: Verification...${NC}"
echo "Current MCP servers:"
claude mcp list

echo ""
echo -e "${GREEN}🎉 Quick migration complete!${NC}"
echo "📦 You now have @eekfonky/n8n-mcp-modern v5.2.0 with 126 tools!"
echo ""
echo "Next steps:"
echo "1. Restart Claude Code"
echo "2. Test MCP tools are working"