#!/bin/bash
# Create a release package with built files

set -e

echo "📦 Creating n8n-mcp-modern release package..."

# Clean up previous builds
rm -rf release-package
rm -f n8n-mcp-modern-*.tgz

# Create release directory
mkdir -p release-package

# Copy necessary files
cp -r dist release-package/
cp -r agents release-package/
cp -r data release-package/
cp -r scripts release-package/
cp package.json release-package/
cp README.md release-package/
cp LICENSE release-package/ 2>/dev/null || true

# Create a simple install script
cat > release-package/install.sh << 'EOF'
#!/bin/bash
echo "Installing n8n-mcp-modern..."
npm install --production
echo "✅ Installation complete!"
echo ""
echo "To use with Claude Code:"
echo "claude mcp add n8n-mcp-modern \\"
echo "  --env N8N_API_URL='https://your-n8n.com' \\"
echo "  --env N8N_API_KEY='your-key' \\"
echo "  -- node $(pwd)/dist/index.js"
EOF

chmod +x release-package/install.sh

# Create tarball
cd release-package
npm pack
mv *.tgz ../
cd ..

echo "✅ Release package created: n8n-mcp-modern-*.tgz"
echo ""
echo "Users can install with:"
echo "  npm install -g n8n-mcp-modern-*.tgz"