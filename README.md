# n8n-MCP Modern 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-4.3.0-blue.svg)](https://github.com/eekfonky/n8n-mcp-modern)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Modern](https://img.shields.io/badge/Architecture-Modern-green.svg)](https://github.com/eekfonky/n8n-mcp-modern)

**Modern n8n MCP server built from the ground up with zero legacy dependencies and maximum performance.**

## 🎯 What's New in v4.3

**Complete Tool & Agent Ecosystem:**
- ✅ **100 Total Tools** - Comprehensive n8n automation coverage
- ✅ **6-Agent Hierarchy** - Optimized for Claude Code workflows  
- ✅ **Code Generation** - AI-powered workflow creation (12 tools)
- ✅ **DevOps Integration** - CI/CD & deployment automation (10 tools)
- ✅ **Performance Monitoring** - Advanced observability & optimization (12 tools)
- ✅ **Comprehensive n8n** - Complete ecosystem management (53 tools)
- ✅ **Configuration Management** - MCP setup validation & auto-fix
- ✅ **Claude MCP Integration** - One-command install with agent deployment

**Architecture & Performance:**
- 🚀 **95% Smaller Bundle**: 1.1GB → 15MB  
- ⚡ **10x Faster Install**: 3+ minutes → <30 seconds
- 🔒 **Zero Vulnerabilities**: 16 critical issues → 0  
- 💨 **2x Faster Runtime**: Modern V8 optimizations
- 🎯 **100% Test Coverage**: All 29 agent tests passing

## 🏗️ Architecture

### Ultra-Minimal Dependencies
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.17.3",    // Official MCP SDK
    "better-sqlite3": "^12.2.0",               // Database
    "undici": "^7.0.0",                        // HTTP client
    "dotenv": "^16.6.1",                       // Config
    "zod": "^3.25.76"                          // Validation
  }
}
```

### Core Components
```
src/
├── server/           # MCP server implementation
├── database/         # SQLite with clean schemas  
├── tools/           # 100 MCP tools (modern patterns)
├── agents/          # 6-agent hierarchical system
├── validation/      # Zod-based validation engine
├── n8n/            # Minimal n8n integration layer
└── types/          # Full TypeScript definitions
```

## 🛠️ MCP Configuration Management

New in v4.3! Validate and fix your `.mcp.json` configuration:

```bash
# Check your MCP configuration
validate_mcp_config

# Auto-fix common issues
validate_mcp_config {"fix_issues": true}
```

**Features:**
- ✅ Validates `.mcp.json` structure and syntax
- ✅ Checks Node.js version requirements (22+)
- ✅ Verifies build artifacts exist (`dist/index.js`)
- ✅ Auto-generates missing configuration files
- ✅ Provides clear recommendations for fixes

## 🚀 Quick Start

### Installation

> **🐳 Self-Hosted n8n with Docker**: If you're running n8n via docker-compose, you MUST add this environment variable to your n8n service BEFORE creating your API key:
> ```yaml
> environment:
>   - N8N_API_ENDPOINT_REST=api/v1
> ```
> Run `docker-compose up -d --build` to rebuild your container, then create your API key. This enables the REST API endpoints required by the MCP server.

**Method 1: Claude MCP Integration (Recommended)**
```bash
# Basic usage (offline mode - limited functionality)
claude mcp add n8n-mcp-modern -- npx -y @lexinet/n8n-mcp-modern

# Full functionality with your n8n instance (RECOMMENDED)
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @lexinet/n8n-mcp-modern

# ✨ Agents are automatically installed to ~/.claude/agents/ during setup!
```

> **⚠️ Important**: For full n8n workflow automation capabilities, you MUST provide your n8n API credentials via environment variables as shown above.

**Method 2: Global Install**
```bash
npm install -g @lexinet/n8n-mcp-modern
```

### Development

```bash
# Setup
git clone https://github.com/eekfonky/n8n-mcp-modern.git
cd n8n-mcp-modern
npm install

# Development
npm run dev           # Watch mode
npm run build         # Production build
npm run test          # Run tests
npm run lint          # Type checking
npm run rebuild-db    # Rebuild node database
```

## 🤖 Claude Code Agent System

**6 Optimized Claude Code Agents for n8n Automation:**

This package includes Claude Code agents that work with the MCP server:

```
TIER 1: MASTER ORCHESTRATOR
├─ n8n-workflow-architect - Strategic planning & coordination

TIER 2: CORE DOMAIN SPECIALISTS  
├─ n8n-developer-specialist - Code generation, templates, DevOps workflows
├─ n8n-integration-specialist - Authentication & connectivity  
├─ n8n-node-specialist - 525+ node expertise + AI/ML patterns
└─ n8n-performance-specialist - Monitoring, optimization, analytics

TIER 3: SUPPORT SPECIALIST
└─ n8n-guidance-specialist - Documentation, support & admin (merged)
```

**Installation:** Copy `agents/*.md` files to `~/.claude/agents/` for Claude Code integration.

## 🏗️ Architecture

**Clean Separation of Concerns:**

1. **🔧 MCP Server** (`@lexinet/n8n-mcp-modern`): Provides 100 n8n-specific tools
2. **🤖 Claude Code Agents** (`agents/*.md`): 6 specialized agents using MCP tools
3. **⚡ User Experience**: Claude Code Task tool → Agent → MCP tools → n8n API

This architecture leverages Claude Code's built-in agent system while providing deep n8n integration through MCP tools.

## 🛠️ 100 MCP Tools

**🔧 Code Generation (12 tools):**
- `generate_workflow_from_description` - Natural language → n8n workflow
- `create_api_integration_template` - API integration scaffolding  
- `build_data_processing_pipeline` - Data transformation workflows
- `generate_notification_workflow` - Alert & notification systems
- `create_webhook_handler` - Webhook processing automation
- Plus 7 more advanced code generation tools

**🛠️ DevOps Integration (10 tools):**
- `integrate_with_git` - Git repository integration
- `setup_cicd_pipeline` - CI/CD automation  
- `create_deployment_automation` - Multi-environment deployment
- `generate_code_quality_checks` - Quality assurance automation
- `setup_environment_management` - Configuration management
- Plus 5 more DevOps workflow tools

**📊 Performance & Observability (12 tools):**
- `analyze_workflow_performance` - Deep performance analysis
- `monitor_system_metrics` - Real-time system monitoring
- `generate_optimization_recommendations` - AI-powered optimization
- `setup_alert_configuration` - Intelligent alerting
- `perform_capacity_planning` - Scaling & resource forecasting
- Plus 7 more monitoring & analytics tools

**📚 Comprehensive n8n (53 tools):**
- **Core Discovery (6):** Node search, documentation, database stats
- **Validation Engine (7):** Schema validation, workflow verification
- **Credential Management (7):** OAuth, API keys, authentication
- **User Management (4):** Permissions, admin functions  
- **System Management (5):** Health checks, status monitoring
- **Workflow Management (7):** Advanced workflow operations
- **Advanced Features (17):** Specialized n8n functionality

**🎯 Original Tools (11):**
- Basic workflow CRUD, execution monitoring, agent routing

## 🔧 Configuration

### Environment Variables
```bash
# Core MCP Settings
MCP_MODE=stdio              # Optimized for Claude Code
LOG_LEVEL=info             # Minimal logging
DISABLE_CONSOLE_OUTPUT=false

# n8n API Integration (Optional)  
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your-api-key

# Performance Optimization
ENABLE_CACHE=true
CACHE_TTL=3600
MAX_CONCURRENT_REQUESTS=10
```

### Getting n8n API Credentials

To use the full functionality, you need to obtain API credentials from your n8n instance:

1. **n8n Cloud Users**: 
   - Go to your n8n dashboard → Settings → API
   - Generate a new API key
   - Use your cloud URL: `https://your-workspace.app.n8n.cloud`

2. **Self-hosted n8n**:
   - Enable API in your n8n settings
   - Generate an API key in Settings → API  
   - Use your instance URL: `https://your-domain.com`

3. **Add to Claude MCP**:
   ```bash
   claude mcp add n8n-mcp-modern \
     --env N8N_API_URL="https://your-n8n-instance.com" \
     --env N8N_API_KEY="your-api-key" \
     -- npx -y @lexinet/n8n-mcp-modern
   ```

### URL Auto-Normalization
The package automatically handles URL formatting:
- ✅ `https://n8n.example.com` → `https://n8n.example.com/api/v1`
- ✅ `https://n8n.example.com/` → `https://n8n.example.com/api/v1`  
- ✅ `https://n8n.example.com/api` → `https://n8n.example.com/api/v1`

## 📊 Migration from Legacy

**From n8n-mcp-enhanced v3.x:**

1. **Same MCP Interface** - All 87 tools work identically
2. **Agent System Preserved** - Same hierarchical structure
3. **Performance Gains** - 10x faster, 95% smaller
4. **Zero Breaking Changes** - Drop-in replacement

**Migration Command:**
```bash
# Remove old version
claude mcp remove n8n-mcp-enhanced

# Add modern version  
claude mcp add n8n-mcp-modern -- npx -y @lexinet/n8n-mcp-modern
```

## 🧪 Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode  
npm run test:coverage # Coverage report
npm run typecheck     # Type validation
```

## 🤝 Contributing

**Modern Development Standards:**
- TypeScript-first with strict mode
- ESM-only architecture  
- Zod validation schemas
- Comprehensive test coverage
- Security-first approach

## 🎯 Claude Code Hooks System

**Project-Specific Quality Enforcement:**
- **Agent Routing Validation** - Ensures queries go to appropriate n8n specialists
- **File Protection** - Prevents accidental modification of critical files (package.json, .env, .git/)
- **Bash Command Security** - Validates commands for security and performance best practices
- **Auto Code Formatting** - Prettier + comprehensive validation for TS/JS/JSON/MD/YAML
- **Context Injection** - Automatically provides relevant n8n project context
- **Completion Validation** - Ensures TypeScript compiles, tests pass, linting passes before task completion

**File Type Coverage:**
- **TypeScript/JavaScript** - Type safety, security patterns, performance optimization
- **JSON** - n8n node validation (displayName, properties, inputs/outputs)
- **Markdown** - Agent frontmatter validation, code block language tags
- **YAML** - Docker Compose, configuration validation, syntax checking

All hooks stored in `.claude/hooks/` for project isolation. See `.claude/hooks/README.md` for details.

## 📄 License

MIT License - see LICENSE file for details.

## 🏆 Credits

Modern TypeScript rebuild by [eekfonky](https://github.com/eekfonky).

**Evolution**: From legacy prototype → Modern, secure, performant MCP server.

---

*Built for Claude Code users who demand modern, secure, high-performance n8n automation.* 🎯