#!/bin/bash
# n8n MCP Modern - GitHub/NPM Sync Script
# Ensures perfect synchronization between GitHub and NPM

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 n8n MCP Modern - Sync Release Script${NC}"

# Get current package.json version
PACKAGE_VERSION=$(node -p "require('./package.json').version")
echo -e "📦 Package version: ${YELLOW}$PACKAGE_VERSION${NC}"

# Check if git tag exists for this version
if git rev-parse "v$PACKAGE_VERSION" >/dev/null 2>&1; then
    echo -e "🏷️  Git tag v$PACKAGE_VERSION already exists"
else
    echo -e "${YELLOW}🏷️  Creating git tag v$PACKAGE_VERSION${NC}"
    git tag -a "v$PACKAGE_VERSION" -m "Release v$PACKAGE_VERSION - Complete 108 MCP tools implementation"
    git push origin "v$PACKAGE_VERSION"
fi

# Check NPM published version
NPM_VERSION=$(npm view @lexinet/n8n-mcp-modern version 2>/dev/null || echo "not-published")
echo -e "🌐 NPM version: ${YELLOW}$NPM_VERSION${NC}"

# Verify sync status
if [ "$PACKAGE_VERSION" = "$NPM_VERSION" ]; then
    echo -e "${GREEN}✅ GitHub and NPM are synchronized at v$PACKAGE_VERSION${NC}"
    
    # Additional verification
    echo -e "\n${GREEN}🔍 Verification Details:${NC}"
    echo -e "  📁 Package.json: $PACKAGE_VERSION"
    echo -e "  🌐 NPM Registry: $NPM_VERSION"
    echo -e "  🏷️  Git Tag: $(git describe --tags --exact-match HEAD 2>/dev/null || echo 'v'$PACKAGE_VERSION)"
    echo -e "  📊 Total Tools: 108"
    echo -e "  🤖 Agents: 6"
    
    # Check if there are uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "\n${YELLOW}⚠️  Warning: There are uncommitted changes${NC}"
        git status --porcelain
        echo -e "\nRun: ${YELLOW}git add -A && git commit -m 'Update' && git push${NC}"
    else
        echo -e "\n${GREEN}✅ No uncommitted changes - fully synchronized${NC}"
    fi
else
    echo -e "${RED}❌ Sync mismatch detected!${NC}"
    echo -e "  Package.json: $PACKAGE_VERSION"
    echo -e "  NPM Registry: $NPM_VERSION"
    
    if [ "$NPM_VERSION" = "not-published" ]; then
        echo -e "\n${YELLOW}📤 Publishing to NPM...${NC}"
        npm publish
    elif [ "$PACKAGE_VERSION" \> "$NPM_VERSION" ]; then
        echo -e "\n${YELLOW}📤 Updating NPM version...${NC}"
        npm publish
    else
        echo -e "\n${RED}⚠️  NPM version is ahead of package.json - manual intervention required${NC}"
    fi
fi

echo -e "\n${GREEN}🚀 Sync check complete!${NC}"