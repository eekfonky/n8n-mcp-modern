#!/bin/bash
# Debug version of migration script

set -e

echo "Debug: Starting migration script"
echo "Debug: Bash version: $BASH_VERSION"
echo "Debug: Current shell: $0"

echo "🚀 n8n-MCP Modern Migration"
echo "=========================="

# Test basic functionality
echo "Debug: Testing echo command"
echo "This is a test echo"

echo "Debug: Testing read command"
read -p "Type 'y' to continue: " -n 1 -r
echo
echo "Debug: You typed: $REPLY"

echo "Debug: Script completed successfully"