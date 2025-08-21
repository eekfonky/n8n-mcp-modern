#!/bin/bash
# Manual Authentication Migration Script
# Download and run: curl -fsSL https://raw.githubusercontent.com/eekfonky/n8n-mcp-modern/main/migration-manual-auth.sh | bash

set -e

echo "n8n-MCP Modern Migration: @lexinet to @eekfonky (GitHub Packages)"
echo "================================================================"
echo "Setting up GitHub Packages authentication manually..."
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

# Step 3: Set up .npmrc for GitHub Packages
echo -e "${YELLOW}Step 3: Configuring GitHub Packages authentication...${NC}"

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}GITHUB_TOKEN not set${NC}"
    echo "Please run: export GITHUB_TOKEN=your_token_here"
    exit 1
fi

# Create/update .npmrc
echo "Setting up .npmrc for GitHub Packages..."
echo "@eekfonky:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> ~/.npmrc

# Test authentication
echo "Testing authentication..."
if npm view @eekfonky/n8n-mcp-modern version >/dev/null 2>&1; then
    VERSION=$(npm view @eekfonky/n8n-mcp-modern version)
    echo -e "${GREEN}Authentication successful - Version: $VERSION${NC}"
else
    echo -e "${RED}Authentication failed${NC}"
    echo "Please check your token has 'read:packages' scope"
    exit 1
fi

# Step 4: Installation
echo -e "${YELLOW}Step 4: Installing @eekfonky/n8n-mcp-modern...${NC}"

# Backup environment variables
if [ -n "$N8N_API_URL" ]; then
    echo "Found N8N_API_URL: $N8N_API_URL"
    N8N_URL_BACKUP="$N8N_API_URL"
fi
if [ -n "$N8N_API_KEY" ]; then
    echo "Found N8N_API_KEY in environment"
    N8N_KEY_BACKUP="$N8N_API_KEY"
fi

# Try smart installer
echo "Using smart installer..."
if npx @eekfonky/n8n-mcp-modern install; then
    echo -e "${GREEN}Installation successful!${NC}"
else
    echo -e "${YELLOW}Smart installer failed, trying manual...${NC}"
    
    if [ -n "$N8N_URL_BACKUP" ] && [ -n "$N8N_KEY_BACKUP" ]; then
        echo "Using saved environment variables..."
        claude mcp add n8n-mcp-modern \
            --scope project \
            --env N8N_API_URL="$N8N_URL_BACKUP" \
            --env N8N_API_KEY="$N8N_KEY_BACKUP" \
            -- npx -y @eekfonky/n8n-mcp-modern
    else
        echo "Manual setup required"
        exit 1
    fi
fi

# Step 5: Verification
echo -e "${YELLOW}Step 5: Verifying installation...${NC}"
claude mcp list

echo ""
echo -e "${GREEN}Migration completed!${NC}"
echo "You now have @eekfonky/n8n-mcp-modern v5.2.0 with 126 tools!"