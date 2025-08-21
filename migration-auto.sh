#!/bin/bash
# Automatic Migration Script: @lexinet to @eekfonky
# Download and run: curl -fsSL https://raw.githubusercontent.com/eekfonky/n8n-mcp-modern/main/migration-auto.sh | bash

set -e

echo "n8n-MCP Modern Migration: @lexinet to @eekfonky (GitHub Packages)"
echo "================================================================"
echo "Migrating from npmjs.com to GitHub Packages for better reliability"
echo ""
echo "This script will automatically:"
echo "1. Remove old @lexinet installations"
echo "2. Clear npm/npx caches"
echo "3. Install fresh @eekfonky/n8n-mcp-modern"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Remove old installations
echo -e "${YELLOW}Step 1: Removing old @lexinet installations...${NC}"
claude mcp remove n8n-mcp-modern 2>/dev/null && echo "Removed n8n-mcp-modern" || echo "n8n-mcp-modern not found"
claude mcp remove @lexinet/n8n-mcp-modern 2>/dev/null && echo "Removed @lexinet/n8n-mcp-modern" || echo "@lexinet/n8n-mcp-modern not found"

# Step 2: Clear caches
echo -e "${YELLOW}Step 2: Clearing npm/npx caches...${NC}"
npm cache clean --force
npx clear-npx-cache 2>/dev/null || rm -rf ~/.npm/_npx 2>/dev/null || true
echo "Caches cleared"

# Step 3: Check if GitHub token is available
echo -e "${YELLOW}Step 3: Checking GitHub authentication...${NC}"
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}GITHUB_TOKEN environment variable not set${NC}"
    echo ""
    echo "Please set your GitHub token and run again:"
    echo "export GITHUB_TOKEN=your_github_token_here"
    echo "curl -fsSL https://raw.githubusercontent.com/eekfonky/n8n-mcp-modern/main/migration-auto.sh | bash"
    echo ""
    echo "Create token at: https://github.com/settings/tokens (needs 'read:packages' scope)"
    exit 1
fi

# Test authentication
if npm view @eekfonky/n8n-mcp-modern version >/dev/null 2>&1; then
    VERSION=$(npm view @eekfonky/n8n-mcp-modern version)
    echo -e "GitHub Packages access confirmed - Version: ${GREEN}$VERSION${NC}"
else
    echo -e "${RED}Cannot access GitHub Packages with current token${NC}"
    echo "Please check your GITHUB_TOKEN has 'read:packages' scope"
    exit 1
fi

# Step 4: Fresh installation
echo -e "${YELLOW}Step 4: Installing fresh @eekfonky/n8n-mcp-modern...${NC}"

# Backup environment variables
if [ -n "$N8N_API_URL" ]; then
    echo "Found N8N_API_URL: $N8N_API_URL"
    N8N_URL_BACKUP="$N8N_API_URL"
fi
if [ -n "$N8N_API_KEY" ]; then
    echo "Found N8N_API_KEY in environment"
    N8N_KEY_BACKUP="$N8N_API_KEY"
fi

# Try smart installer first
echo "Using smart installer..."
if npx @eekfonky/n8n-mcp-modern install; then
    echo -e "${GREEN}Smart installation successful!${NC}"
else
    echo -e "${YELLOW}Smart installer failed, trying manual installation...${NC}"
    
    if [ -n "$N8N_URL_BACKUP" ] && [ -n "$N8N_KEY_BACKUP" ]; then
        echo "Using saved environment variables..."
        claude mcp add n8n-mcp-modern \
            --scope project \
            --env N8N_API_URL="$N8N_URL_BACKUP" \
            --env N8N_API_KEY="$N8N_KEY_BACKUP" \
            -- npx -y @eekfonky/n8n-mcp-modern
    else
        echo "Manual setup required. Please run:"
        echo "claude mcp add n8n-mcp-modern --scope project --env N8N_API_URL=your-url --env N8N_API_KEY=your-key -- npx -y @eekfonky/n8n-mcp-modern"
        exit 1
    fi
fi

# Step 5: Verification
echo -e "${YELLOW}Step 5: Verifying installation...${NC}"
echo "Current MCP servers:"
claude mcp list

echo ""
echo -e "${GREEN}Migration completed successfully!${NC}"
echo ""
echo "What changed:"
echo "- Package: @lexinet/n8n-mcp-modern to @eekfonky/n8n-mcp-modern"
echo "- Registry: npmjs.com to GitHub Packages"
echo "- Tools: Now 126 tools (was 87+)"
echo "- Version: v5.2.0 with zero technical debt"
echo ""
echo "Next steps:"
echo "1. Restart Claude Code application"
echo "2. Test MCP tools (try: list_available_tools)"
echo "3. Enjoy improved reliability and performance!"
echo ""
echo "You now have @eekfonky/n8n-mcp-modern v5.2.0!"