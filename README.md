# n8n-MCP Modern 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-5.2.8-blue.svg)](https://github.com/eekfonky/n8n-mcp-modern)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Modern](https://img.shields.io/badge/Architecture-Modern-green.svg)](https://github.com/eekfonky/n8n-mcp-modern)
[![Technical Debt](https://img.shields.io/badge/Technical%20Debt-ZERO-brightgreen.svg)](https://github.com/eekfonky/n8n-mcp-modern)

**Modern n8n MCP server built from the ground up with zero legacy dependencies and maximum performance.**

## 🎯 What's New

**v5.2.8** - Enterprise Security & JavaScript Excellence - [See all releases](./RELEASES.md)
- ✅ JavaScript Validator Integration for comprehensive security analysis
- ✅ Command Injection Prevention with secure spawn-based execution
- ✅ Complete Input Validation Layer for all user input
- ✅ Structured Logging System with file output and metadata

## 🚀 Quick Start

### Prerequisites

For optimal agent performance, install these companion MCP servers:

```bash
# Context7 MCP - Real-time documentation access (HIGHLY RECOMMENDED)
claude mcp add context7 -s user -- npx -y @upstash/context7-mcp

# Sequential Thinking MCP - Enhanced reasoning for complex tasks
claude mcp add sequential-thinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking
```

### Installation

**Method 1: Local Installation (Most Reliable)**

```bash
# Clone and build
git clone https://github.com/eekfonky/n8n-mcp-modern.git
cd n8n-mcp-modern
npm install
npm run build

# Add to Claude Code
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- node /absolute/path/to/n8n-mcp-modern/dist/index.js
```

**Method 2: NPM Installation**

```bash
# Install globally (skip problematic scripts if needed)
npm install -g n8n-mcp-modern --ignore-scripts

# Configure and install
N8N_API_URL="https://your-n8n-instance.com" \
N8N_API_KEY="your-api-key" \
n8n-mcp install
```

> **🐳 Docker Users**: Add `N8N_API_ENDPOINT_REST=api/v1` to your n8n environment variables and restart before creating API keys.

## 🏗️ Architecture

### Ultra-Minimal Dependencies (5 packages vs 1000+ in legacy)

```json
{
  "@modelcontextprotocol/sdk": "^1.17.3",  // Official MCP SDK
  "better-sqlite3": "^12.2.0",              // SQLite database
  "undici": "^7.0.0",                       // HTTP client
  "dotenv": "^17.2.1",                      // Configuration
  "zod": "^3.25.76"                         // Validation
}
```

### Performance Metrics

- 🚀 **95% Smaller Bundle**: 1.1GB → 15MB
- ⚡ **10x Faster Install**: 3+ minutes → <30 seconds
- 🔒 **Zero Vulnerabilities**: Clean security audit
- 💨 **2x Faster Runtime**: Modern V8 optimizations

## 🤖 6-Agent Hierarchy System

```
TIER 1: MASTER ORCHESTRATOR
├─ n8n-orchestrator - Strategic planning & multi-agent coordination

TIER 2: CORE SPECIALISTS  
├─ n8n-connector - Authentication & connectivity (525+ platforms)
├─ n8n-builder - Code generation, templates, DevOps workflows
├─ n8n-node-expert - 525+ node expertise + AI/ML patterns
└─ n8n-scriptguard - JavaScript validation & security

TIER 3: SUPPORT SPECIALISTS
├─ n8n-guide - Documentation, tutorials & best practices
└─ (Additional research agents as needed)
```

## 🛠️ 92 MCP Tools

### Tool Categories

- **🔧 Code Generation** (12 tools) - Workflow creation from natural language
- **🛠️ DevOps Integration** (10 tools) - CI/CD, Git, deployment automation
- **📊 Performance & Monitoring** (12 tools) - Analytics, optimization, alerting
- **📚 Core n8n Management** (46 tools) - Workflows, credentials, nodes, users
- **🔍 Additional Utilities** (12 tools) - Search, validation, debugging

### Key Capabilities

- Generate workflows from descriptions
- Create API integrations and webhooks
- Build data processing pipelines
- Setup CI/CD automation
- Monitor performance metrics
- Manage credentials securely
- Validate and optimize workflows

## 🚀 Usage Examples

### Basic MCP Tool Usage

```bash
# Search for n8n nodes
claude mcp call n8n-mcp-modern search_n8n_nodes '{"query": "HTTP Request"}'

# Get workflow list  
claude mcp call n8n-mcp-modern get_n8n_workflows '{"limit": 10}'

# Create a simple workflow
claude mcp call n8n-mcp-modern create_n8n_workflow '{
  "name": "Test Workflow", 
  "nodes": [{"type": "webhook", "name": "Webhook"}],
  "settings": {}
}'
```

### Agent Integration

```bash
# Use Task tool to delegate to specialists
"Task: Create a webhook that processes customer data and sends to Slack"
# → Routes to n8n-builder for code generation

"Task: Set up OAuth with Google Sheets" 
# → Routes to n8n-connector for authentication

"Task: What's the best node for CSV processing?"
# → Routes to n8n-node-expert for guidance
```

## 🔧 Configuration

### Environment Variables

```bash
# Core Settings
MCP_MODE=stdio                           # Optimized for Claude Code
LOG_LEVEL=info                          # Logging level
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your-api-key

# Performance (optional)
ENABLE_CACHE=true
CACHE_TTL=3600
MAX_CONCURRENT_REQUESTS=10
```

### Getting n8n API Credentials

1. **n8n Cloud**: Settings → API → Generate key
2. **Self-hosted**: Enable API in settings → Generate key
3. **Docker**: Ensure `N8N_API_ENDPOINT_REST=api/v1` is set

## 📦 Migration from Legacy

From `@lexinet/n8n-mcp-modern` or legacy versions:

```bash
# Quick migration
curl -fsSL https://raw.githubusercontent.com/eekfonky/n8n-mcp-modern/main/migration-standalone.sh | bash

# Or manual steps
claude mcp remove n8n-mcp-modern
npm cache clean --force
npx @eekfonky/n8n-mcp-modern install
```

## 🧪 Development

```bash
# Setup
git clone https://github.com/eekfonky/n8n-mcp-modern.git
cd n8n-mcp-modern
npm install

# Development
npm run dev           # Watch mode
npm run build         # Production build
npm test              # Run tests
npm run lint          # Linting
npm run typecheck     # Type checking
npm run rebuild-db    # Rebuild node database
```

## 🐳 Docker Deployment

### Production Setup with SSL

See [Docker Configuration Guide](./docs/docker-setup.md) for complete production setup with Traefik and SSL.

### Minimal Development Setup

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_API_ENDPOINT_REST=api/v1
      - N8N_PUBLIC_API_ENABLED=true
      - N8N_COMMUNITY_PACKAGES_ENABLED=true
    volumes:
      - n8n_data:/home/node/.n8n
```

## 🔧 Troubleshooting

### Common Issues

**Installation hangs**: Use `--ignore-scripts` flag
```bash
npm install -g n8n-mcp-modern --ignore-scripts
```

**API Connection Issues**: Validate configuration
```bash
validate_mcp_config
validate_mcp_config {"fix_issues": true}
```

**Node.js Version**: Requires Node.js 22+
```bash
node --version  # Should be v22.0.0 or higher
```

## 📚 Documentation

- [Release History](./RELEASES.md) - All version updates
- [Agent Documentation](./agents/README.md) - Agent capabilities
- [API Reference](./docs/api.md) - Tool documentation
- [Docker Setup](./docs/docker-setup.md) - Complete Docker guide

## 🤝 Contributing

We welcome contributions! Please ensure:
- TypeScript strict mode compliance
- ESM-only patterns
- Zod validation for inputs
- Comprehensive test coverage
- Zero security vulnerabilities

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🏆 Credits

Modern TypeScript rebuild by [eekfonky](https://github.com/eekfonky).

---

_Built for Claude Code users who demand modern, secure, high-performance n8n automation._ 🎯