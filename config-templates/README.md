# Configuration Templates

This directory contains configuration templates for different MCP clients and deployment methods.

## Quick Start

### 1. Claude Code (Recommended)

**Project scope** (team-shared, creates `.mcp.json`):
```bash
# Interactive setup (recommended)
npm run mcp:setup

# Manual command
claude mcp add n8n-mcp-modern \
  --scope project \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern
```

**Global scope** (your user only):
```bash
# Interactive setup
npm run mcp:setup

# Manual command  
claude mcp add n8n-mcp-modern \
  --scope local \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern
```

### 2. Claude Desktop (Alternative)

Copy the contents of `claude-desktop.json` to your Claude Desktop configuration:

**Location:** `~/.config/claude-desktop/config.json` (Linux/Mac) or `%APPDATA%/Claude/config.json` (Windows)

### 3. VS Code MCP Extension

Copy the contents of `vscode-mcp.json` to your VS Code settings:

**Location:** VS Code Settings → Extensions → MCP → Edit in settings.json

Or add to `.vscode/mcp.json` in your workspace.

### 3. One-Command NPX Installation

```bash
# Direct execution (no installation required)
npx -y @eekfonky/n8n-mcp-modern

# Global installation
npm install -g @eekfonky/n8n-mcp-modern
n8n-mcp
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `N8N_API_URL` | Yes | - | Your n8n instance URL |
| `N8N_API_KEY` | Yes | - | Your n8n API key or JWT token |
| `LOG_LEVEL` | No | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| `ENABLE_CACHE` | No | `true` | Enable caching for better performance |
| `CACHE_TTL` | No | `3600` | Cache TTL in seconds |
| `MAX_CONCURRENT_REQUESTS` | No | `10` | Max concurrent API requests |

## Docker Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Copy docker-compose.yml and customize environment variables
docker-compose up -d
```

### Option 2: Claude Desktop with Docker

Use `claude-desktop-docker.json` for containerized deployment with Claude Desktop.

### Option 3: Manual Docker

```bash
# Build image
docker build -t n8n-mcp-modern .

# Run container
docker run -d \
  --name n8n-mcp-modern \
  -e N8N_API_URL="https://your-n8n-instance.com" \
  -e N8N_API_KEY="your-api-key" \
  -v n8n-mcp-data:/app/data \
  n8n-mcp-modern
```

## Advanced Configuration

### Custom Agent Routing

```json
{
  "mcpServers": {
    "n8n-mcp-modern": {
      "command": "npx",
      "args": ["-y", "@eekfonky/n8n-mcp-modern"],
      "env": {
        "N8N_API_URL": "https://your-n8n-instance.com",
        "N8N_API_KEY": "your-api-key",
        "AGENT_ROUTING_MODE": "intelligent",
        "ENABLE_COMMUNITY_NODES": "true",
        "DISCOVERY_INTERVAL": "3600"
      }
    }
  }
}
```

### Multiple n8n Instances

```json
{
  "mcpServers": {
    "n8n-production": {
      "command": "npx",
      "args": ["-y", "@eekfonky/n8n-mcp-modern"],
      "env": {
        "N8N_API_URL": "https://production.n8n.com",
        "N8N_API_KEY": "prod-key",
        "INSTANCE_NAME": "production"
      }
    },
    "n8n-staging": {
      "command": "npx", 
      "args": ["-y", "@eekfonky/n8n-mcp-modern"],
      "env": {
        "N8N_API_URL": "https://staging.n8n.com",
        "N8N_API_KEY": "staging-key",
        "INSTANCE_NAME": "staging"
      }
    }
  }
}
```

## Troubleshooting

### Installation Issues

```bash
# Validate GitHub Packages authentication
node scripts/validate-github-auth.cjs --verbose

# Setup GitHub Packages authentication
node scripts/install-github-packages.cjs

# Smart installation with validation
node scripts/install-mcp.js
```

### Health Check

```bash
# Verify installation
claude mcp list

# Test connectivity
curl -X POST http://localhost:3000/health
```

### Performance Tuning

For high-traffic scenarios:

```json
{
  "env": {
    "ENABLE_CACHE": "true",
    "CACHE_TTL": "1800",
    "MAX_CONCURRENT_REQUESTS": "20",
    "MEMORY_LIMIT": "512",
    "CPU_PRIORITY": "high"
  }
}
```

## Support

- **Documentation:** [GitHub README](https://github.com/eekfonky/n8n-mcp-modern)
- **Issues:** [GitHub Issues](https://github.com/eekfonky/n8n-mcp-modern/issues)  
- **Community:** [n8n Community](https://community.n8n.io)

## Version Information

Current templates are compatible with:
- n8n-MCP Modern v7.0.1+
- Claude Desktop v0.5.0+
- VS Code MCP Extension v1.0.0+
- Node.js 22.0.0+