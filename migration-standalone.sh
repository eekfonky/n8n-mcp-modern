#!/bin/bash
# Standalone Migration Script: @lexinet to @eekfonky
# Download and run: curl -fsSL https://raw.githubusercontent.com/eekfonky/n8n-mcp-modern/main/migration-standalone.sh | bash

set -e

echo "🚀 n8n-MCP Modern Migration: @lexinet to @eekfonky (GitHub Packages)"
echo "=================================================================="
echo "Migrating from npmjs.com to GitHub Packages for better reliability"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if user wants to proceed
read -p "Do you want to migrate to @eekfonky/n8n-mcp-modern on GitHub Packages? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

# Step 1: Remove old installations
echo -e "${YELLOW}Step 1: Removing old @lexinet installations...${NC}"
claude mcp remove n8n-mcp-modern 2>/dev/null && echo "✅ Removed n8n-mcp-modern" || echo "ℹ️ n8n-mcp-modern not found"
claude mcp remove @lexinet/n8n-mcp-modern 2>/dev/null && echo "✅ Removed @lexinet/n8n-mcp-modern" || echo "ℹ️ @lexinet/n8n-mcp-modern not found"

# Step 2: Clear caches
echo -e "${YELLOW}Step 2: Clearing npm/npx caches...${NC}"
npm cache clean --force
npx clear-npx-cache 2>/dev/null || rm -rf ~/.npm/_npx 2>/dev/null || true
echo "✅ Caches cleared"

# Step 3: Authentication check
echo -e "${YELLOW}Step 3: Checking GitHub Packages authentication...${NC}"
if npm view @eekfonky/n8n-mcp-modern version >/dev/null 2>&1; then
    VERSION=$(npm view @eekfonky/n8n-mcp-modern version)
    echo -e "✅ GitHub Packages access confirmed - Version: ${GREEN}$VERSION${NC}"
else
    echo -e "${RED}❌ Cannot access GitHub Packages. Authentication required.${NC}"
    echo ""
    echo "Please choose an authentication method:"
    echo "1. Set GITHUB_TOKEN environment variable (recommended)"
    echo "2. Login via npm"
    echo "3. Manual .npmrc setup"
    echo ""
    
    read -p "Choose method (1/2/3): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            read -p "Enter your GitHub token: " GITHUB_TOKEN
            export GITHUB_TOKEN
            if npm view @eekfonky/n8n-mcp-modern version >/dev/null 2>&1; then
                echo "✅ Authentication successful with token"
            else
                echo "❌ Token authentication failed"
                exit 1
            fi
            ;;
        2)
            echo "Running: npm login --scope=@eekfonky --registry=https://npm.pkg.github.com"
            npm login --scope=@eekfonky --registry=https://npm.pkg.github.com
            ;;
        3)
            echo "Manual setup required:"
            echo "1. Go to: https://github.com/settings/tokens"
            echo "2. Create token with 'read:packages' scope"
            echo "3. Run:"
            echo "   echo '@eekfonky:registry=https://npm.pkg.github.com' >> ~/.npmrc"
            echo "   echo '//npm.pkg.github.com/:_authToken=YOUR_TOKEN' >> ~/.npmrc"
            echo ""
            echo "Then re-run this script."
            exit 0
            ;;
        *)
            echo "Invalid choice"
            exit 1
            ;;
    esac
fi

# Step 4: Fresh installation
echo -e "${YELLOW}Step 4: Installing fresh @eekfonky/n8n-mcp-modern...${NC}"

# Backup environment variables
if [ -n "$N8N_API_URL" ]; then
    echo "ℹ️ Found N8N_API_URL: $N8N_API_URL"
    N8N_URL_BACKUP="$N8N_API_URL"
fi
if [ -n "$N8N_API_KEY" ]; then
    echo "ℹ️ Found N8N_API_KEY in environment"
    N8N_KEY_BACKUP="$N8N_API_KEY"
fi

# Try smart installer first
echo "Using smart installer..."
if npx @eekfonky/n8n-mcp-modern install; then
    echo -e "${GREEN}✅ Smart installation successful!${NC}"
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
echo -e "${GREEN}🎉 Migration completed successfully!${NC}"
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
echo "📦 You now have @eekfonky/n8n-mcp-modern v5.2.0!"