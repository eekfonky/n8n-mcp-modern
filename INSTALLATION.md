# Seamless Installation Guide - n8n-MCP Modern

Complete installation guide for n8n-MCP Modern with multiple deployment options and built-in rollback support.

## 🚀 Quick Start (Recommended)

### One-Command NPX Installation

The fastest way to get started - no installation required:

```bash
# Direct execution (downloads latest version automatically)
npx -y @eekfonky/n8n-mcp-modern

# With environment variables
N8N_API_URL="https://your-n8n.com" N8N_API_KEY="your-key" npx -y @eekfonky/n8n-mcp-modern
```

### Smart Installation Script (Interactive Setup)

Our intelligent installer detects your environment and guides you through configuration:

```bash
# Interactive installation with guided setup
git clone https://github.com/eekfonky/n8n-mcp-modern.git
cd n8n-mcp-modern
node scripts/install-mcp.js  # Automatically launches interactive setup for first-time users

# Or run interactive setup separately
npm run mcp:setup
# OR
node scripts/interactive-setup.cjs
```

**What the interactive setup does:**
- 🔍 **Auto-detects** existing n8n instances (localhost, environment variables)
- 📋 **Guides you** through n8n URL and API key configuration  
- 🔗 **Tests connectivity** to ensure your credentials work
- 📦 **Chooses scope** (project-shared `.mcp.json` vs global Claude Code config)
- 💾 **Creates configuration** automatically with real values (no placeholders!)
- ✅ **Validates setup** with health checks

## 📦 Installation Methods

### Method 1: Claude Code Integration (Recommended)

```bash
# Automatic with smart installer
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern

# Manual configuration
claude mcp add n8n-mcp-modern --scope project -- npx -y @eekfonky/n8n-mcp-modern
```

### Method 2: Global NPM Installation

```bash
# Install globally
npm install -g @eekfonky/n8n-mcp-modern

# Run the server
n8n-mcp

# Or with environment variables
N8N_API_URL="https://your-n8n.com" N8N_API_KEY="your-key" n8n-mcp
```

### Method 3: Project-Scoped Installation

```bash
# For team collaboration
npm init -y  # If no package.json exists
npm install @eekfonky/n8n-mcp-modern
echo '{"mcpServers":{"n8n-mcp-modern":{"command":"npx","args":["-y","@eekfonky/n8n-mcp-modern"]}}}' > .mcp.json
```

### Method 4: Docker Deployment

```bash
# Using Docker Compose (recommended for production)
curl -sSL https://raw.githubusercontent.com/eekfonky/n8n-mcp-modern/main/config-templates/docker-compose.yml -o docker-compose.yml

# Edit environment variables in docker-compose.yml
docker-compose up -d

# Or manual Docker
docker run -d \
  --name n8n-mcp-modern \
  -e N8N_API_URL="https://your-n8n.com" \
  -e N8N_API_KEY="your-key" \
  -v n8n-mcp-data:/app/data \
  n8n-mcp-modern:latest
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `N8N_API_URL` | **Yes** | - | Your n8n instance URL |
| `N8N_API_KEY` | **Yes** | - | n8n API key or JWT token |
| `LOG_LEVEL` | No | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| `ENABLE_CACHE` | No | `true` | Enable caching for performance |
| `CACHE_TTL` | No | `3600` | Cache TTL in seconds |
| `MAX_CONCURRENT_REQUESTS` | No | `10` | Max concurrent API requests |
| `MCP_MODE` | No | `stdio` | MCP transport mode |
| `DISABLE_CONSOLE_OUTPUT` | No | `false` | Disable console logging |

### Configuration Templates

Pre-configured templates are available in `config-templates/`:

- **Claude Desktop**: `claude-desktop.json`
- **VS Code MCP**: `vscode-mcp.json`
- **Docker Compose**: `docker-compose.yml`
- **Claude Desktop + Docker**: `claude-desktop-docker.json`

## 🔒 Authentication Setup

### GitHub Packages Authentication

Since n8n-MCP Modern is distributed via GitHub Packages, authentication is required:

```bash
# Automatic setup (recommended)
node scripts/install-github-packages.cjs

# Manual setup
echo "@eekfonky:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
```

### Generate GitHub Token

1. Go to [GitHub Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token" → "Generate new token (classic)"
3. Select scope: `read:packages`
4. Copy the token and use it in your `.npmrc` file

### Validate Authentication

```bash
# Comprehensive validation
node scripts/validate-github-auth.cjs --verbose

# Quick check
npm view @eekfonky/n8n-mcp-modern version
```

## 🏥 Health Checks & Validation

### Post-Installation Health Check

```bash
# Comprehensive health check
npm run mcp:health

# Or directly
node scripts/health-check.cjs
```

The health check validates:
- ✅ Package installation (global/NPX)
- ✅ Claude MCP integration
- ✅ Configuration files
- ✅ Environment variables
- ✅ n8n API connectivity
- ✅ Authentication status

### Installation Verification

```bash
# List MCP servers
claude mcp list

# Test server connectivity
claude mcp status n8n-mcp-modern

# Verify package version
npm list -g @eekfonky/n8n-mcp-modern
```

## 🔄 Upgrade & Rollback System

### Backup Before Upgrade

```bash
# Create backup automatically
npm run mcp:backup

# Or manually
node scripts/upgrade-rollback.cjs backup local
```

### Safe Upgrades

```bash
# Smart upgrade with backup
node scripts/install-mcp.js  # Automatically detects upgrades

# Manual upgrade
npm update -g @eekfonky/n8n-mcp-modern
```

### Rollback on Failure

```bash
# List available backups
npm run mcp:rollback list

# Rollback to previous version
npm run mcp:rollback rollback <backup-directory>

# Restore configuration only
npm run mcp:restore <backup-directory>
```

### Automatic Rollback

If an upgrade fails, the system automatically:
1. 🛡️ Preserves your configuration
2. 📱 Creates a backup
3. 🔄 Attempts rollback if critical failure
4. 📋 Provides clear recovery instructions

## 🔧 Troubleshooting

### Common Issues

#### 1. Authentication Errors

```bash
# Problem: 401 Unauthorized, npm error code E401
# Solution: Setup GitHub Packages authentication
node scripts/validate-github-auth.cjs --verbose
node scripts/install-github-packages.cjs
```

#### 2. NPX Download Issues

```bash
# Problem: NPX fails to download package
# Solution: Check authentication and network
npm config get registry
npm whoami --registry=https://npm.pkg.github.com
```

#### 3. Claude MCP Not Found

```bash
# Problem: claude mcp list doesn't show n8n-mcp-modern
# Solution: Re-add with correct configuration
claude mcp remove n8n-mcp-modern --scope local
claude mcp add n8n-mcp-modern --scope local -- npx -y @eekfonky/n8n-mcp-modern
```

#### 4. n8n API Connectivity

```bash
# Problem: Cannot connect to n8n API
# Solution: Verify URL and credentials
curl -H "Authorization: Bearer YOUR_API_KEY" https://your-n8n.com/api/v1/workflows
```

### Recovery Commands

```bash
# Full system reset
claude mcp remove n8n-mcp-modern --scope local
npm uninstall -g @eekfonky/n8n-mcp-modern
npm cache clean --force

# Fresh installation
node scripts/install-mcp.js
```

### Get Help

```bash
# Health check with detailed output
npm run mcp:health

# Validate authentication
node scripts/validate-github-auth.cjs --verbose

# List backups
node scripts/upgrade-rollback.cjs list

# Check system requirements
node --version  # Should be ≥22.0.0
npm --version
```

## 🚀 Advanced Configuration

### Multiple n8n Instances

```json
{
  "mcpServers": {
    "n8n-production": {
      "command": "npx",
      "args": ["-y", "@eekfonky/n8n-mcp-modern"],
      "env": {
        "N8N_API_URL": "https://prod.n8n.com",
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

### High-Performance Setup

```bash
# Environment variables for high-traffic scenarios
export ENABLE_CACHE=true
export CACHE_TTL=1800
export MAX_CONCURRENT_REQUESTS=20
export LOG_LEVEL=warn

# Run with performance optimizations
npx -y @eekfonky/n8n-mcp-modern
```

### Development Setup

```bash
# Clone for development
git clone https://github.com/eekfonky/n8n-mcp-modern.git
cd n8n-mcp-modern

# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build
```

## 📋 System Requirements

- **Node.js**: ≥22.0.0 (LTS recommended)
- **npm**: ≥9.0.0
- **OS**: Linux, macOS, Windows
- **Memory**: 512MB RAM minimum
- **Storage**: 100MB free space
- **Network**: HTTPS access to n8n instance

## 🎯 Next Steps

After successful installation:

1. ✅ Run health check: `npm run mcp:health`
2. 🔧 Configure environment variables
3. 📱 Test n8n API connectivity
4. 🚀 Start using n8n tools in Claude Code
5. 📚 Explore [advanced features](README.md#features)

## 📞 Support

- **Documentation**: [GitHub README](https://github.com/eekfonky/n8n-mcp-modern)
- **Issues**: [GitHub Issues](https://github.com/eekfonky/n8n-mcp-modern/issues)
- **Community**: [n8n Community Forums](https://community.n8n.io)
- **Health Check**: `npm run mcp:health`

---

**Need immediate help?** Run `npm run mcp:health` for comprehensive diagnostics and specific recommendations.