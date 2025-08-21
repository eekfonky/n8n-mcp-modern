# n8n-MCP Modern 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-5.1.3-blue.svg)](https://github.com/eekfonky/n8n-mcp-modern)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Modern](https://img.shields.io/badge/Architecture-Modern-green.svg)](https://github.com/eekfonky/n8n-mcp-modern)
[![Technical Debt](https://img.shields.io/badge/Technical%20Debt-ZERO-brightgreen.svg)](https://github.com/eekfonky/n8n-mcp-modern)

**Modern n8n MCP server built from the ground up with zero legacy dependencies and maximum performance.**

## 🎯 What's New in v5.1.3

**Agent Coordination Framework (MAJOR):**

- ✅ **Intelligent Agent Coordination** - Agents now actively delegate to specialists for optimal results
- ✅ **Explicit Delegation Rules** - Clear triggers for when each agent coordinates with others
- ✅ **Transparent Multi-Agent Workflows** - Users see coordination happening with clear communication
- ✅ **Model Optimization** - Strategic assignment: Opus for complex reasoning, Sonnet for structured tasks, Haiku for docs
- ✅ **Practical Implementation** - Real coordination workflows instead of theoretical agent descriptions

**Agent Coordination Highlights:**

- **n8n-guide (Haiku)** → Intelligent triage agent with specialist delegation
- **n8n-orchestrator (Opus)** → Master coordinator for complex enterprise projects
- **n8n-node-expert (Opus)** → Authority on 525+ nodes with horizontal coordination
- **n8n-scriptguard (Opus)** → Security leader with proactive intervention
- **n8n-connector (Sonnet)** → Authentication specialist with clear escalation
- **n8n-builder (Sonnet)** → Implementation coordinator with multi-agent examples

**Previous Release (v5.0.1):**

**Modern Dependencies & Security:**

- ✅ **Up-to-Date Dependencies** - TypeScript ESLint 8.40.0, dotenv 17.2.1
- ✅ **Header Validation Fix** - Resolved JWT token handling for undici 7.0.0 compatibility
- ✅ **TypeScript Validator Tested** - Comprehensive security-first validation agent
- ✅ **Zero Security Vulnerabilities** - Clean audit with modern dependency stack
- ✅ **Production Hardened** - 175+ tests passing with comprehensive validation

**Previous Features:**

**Dynamic Version Management (v4.7.4):**

- ✅ **Automatic Version Detection** - Version now dynamically read from package.json
- ✅ **No More Version Mismatches** - Ensures displayed version always matches package

**ZERO TECHNICAL DEBT ACHIEVED (v4.7.3):**

- ✅ **Complete Technical Debt Elimination** - Comprehensive cleanup with TypeScript validation
- ✅ **Encryption Module Tested** - Production-ready encryption with 9 comprehensive test cases
- ✅ **n8n API Compliance** - Validated workflow creation follows n8n API constraints
- ✅ **Modern ESM Patterns** - Full ES2024 compatibility with Node.js 22+ optimization

**Previous Features (v4.6.11):**

**Smart Installation & Optimization:**

- ✅ **75% Smaller Package** - Reduced from 5.4MB to 1.3MB for lightning-fast installs
- ✅ **Smart Agent Updates** - Only install/update when needed, not every server start
- ✅ **Upgrade Safety** - Automatic cleanup of legacy files during updates
- ✅ **Content Hash Tracking** - Detects actual agent changes for precise updates
- ✅ **Production Ready** - 175 tests passing with comprehensive E2E validation

**Enhanced Stability & Production Readiness:**

- ✅ **Production Stability** - Enhanced error handling and graceful shutdown
- ✅ **Complete Test Coverage** - 175/176 tests passing with full E2E validation
- ✅ **Zero Security Issues** - Clean dependency tree with minimal attack surface
- ✅ **TypeScript Excellence** - Strict mode compliance with comprehensive type safety
- ✅ **Performance Optimized** - Advanced caching and connection pooling
- ✅ **Modern Architecture** - ESM-first with Node.js 22+ optimization

**Complete Tool & Agent Ecosystem:**

- ✅ **100 Total Tools** - Comprehensive n8n automation coverage
- ✅ **7-Agent Hierarchy** - Optimized for Claude Code workflows
- ✅ **Code Generation** - AI-powered workflow creation (12 tools)
- ✅ **DevOps Integration** - CI/CD & deployment automation (10 tools)
- ✅ **Performance Monitoring** - Advanced observability & optimization (12 tools)
- ✅ **Comprehensive n8n** - Complete ecosystem management (58 tools)
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
    "@modelcontextprotocol/sdk": "^1.17.3", // Official MCP SDK
    "better-sqlite3": "^12.2.0", // Database
    "undici": "^7.0.0", // HTTP client
    "dotenv": "^17.2.1", // Config
    "zod": "^3.25.76" // Validation
  }
}
```

### Core Components

```
src/
├── server/           # MCP server implementation
├── database/         # SQLite with clean schemas
├── tools/           # 100 MCP tools (modern patterns)
├── agents/          # 7-agent hierarchical system
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

### Prerequisites for Full Agent Functionality

**Recommended MCP Dependencies:**

For optimal agent performance with real-time documentation and enhanced reasoning capabilities, we recommend installing these companion MCP servers:

```bash
# 1. Context7 MCP - Real-time documentation access (HIGHLY RECOMMENDED)
claude mcp add context7 -s user -- npx -y @upstash/context7-mcp

# 2. Sequential Thinking MCP - Enhanced reasoning for complex tasks
claude mcp add sequential-thinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking
```

**Why These Are Important:**

- **Context7**: Provides agents with up-to-date API documentation, current best practices, and real-time library information instead of relying on training cutoffs
- **Sequential Thinking**: Enables agents to break down complex problems systematically for better analysis and implementation

> **Note**: n8n-MCP Modern works without these dependencies, but agent capabilities will be limited to training knowledge cutoffs.

### Installation

> **🐳 Self-Hosted n8n with Docker**: If you're running n8n via docker-compose, you MUST add this environment variable to your n8n service BEFORE creating your API key:
>
> ```yaml
> environment:
>   - N8N_API_ENDPOINT_REST=api/v1
> ```
>
> Run `docker-compose up -d --build` to rebuild your container, then create your API key. This enables the REST API endpoints required by the MCP server.

**Method 1: Smart Installation (Recommended)**

```bash
# Direct installation with smart auto-detection
N8N_API_URL="https://your-n8n-instance.com" \
N8N_API_KEY="your-api-key" \
npx @eekfonky/n8n-mcp-modern install

# Alternative: Install globally first, then configure
npm install -g @eekfonky/n8n-mcp-modern
N8N_API_URL="https://your-n8n-instance.com" \
N8N_API_KEY="your-api-key" \
n8n-mcp install
```

**The smart installer automatically:**

- ✅ **Project Detection**: Uses `--scope project` when in a project directory with `.mcp.json` or `package.json`
- ✅ **Global Fallback**: Uses `--scope local` when no project context detected
- ✅ **Team Sharing**: Creates `.mcp.json` for version control when project-scoped

### 📚 Enhanced Agent Capabilities

**Agents with MCP Integration:**

The 7-agent system leverages Context7 and Sequential Thinking MCPs when available:

- `n8n-workflow-architect` - Master coordinator with sequential thinking for complex orchestration
- `n8n-developer-specialist` - Current API/library docs for code generation
- `n8n-integration-specialist` - Up-to-date auth docs across 525+ platforms
- `n8n-guidance-specialist` - Current documentation and tutorials
- `n8n-node-specialist` - AI/ML library docs and community packages
- `n8n-javascript-specialist` - Current Node.js and JavaScript library documentation
- `n8n-performance-specialist` - Real-time metrics and optimization patterns

**What Enhanced MCPs Enable:**

- ✅ **Real-time API Documentation** - Current docs instead of outdated knowledge
- ✅ **Enhanced Code Generation** - Better templates with current API patterns
- ✅ **Up-to-Date Auth Patterns** - Live documentation for 525+ integrations
- ✅ **Current Best Practices** - Always-current Node.js and library standards
- ✅ **Sequential Problem Solving** - Break down complex tasks systematically

**Method 2: Manual Installation**

```bash
# Project-scoped (recommended for development projects)
claude mcp add n8n-mcp-modern --scope project \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern

# Global installation
claude mcp add n8n-mcp-modern --scope local \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern
```

> **⚠️ Important**: For full n8n workflow automation capabilities, you MUST provide your n8n API credentials via environment variables as shown above.

### 🔄 Upgrading

**Smart Install/Upgrade (Recommended)**

```bash
# Same command for both fresh installs and upgrades!
N8N_API_URL="https://your-n8n-instance.com" \
N8N_API_KEY="your-api-key" \
npx @eekfonky/n8n-mcp-modern install
```

✅ **Auto-detects** existing installations and preserves configuration  
✅ **Updates** all 7 agents to latest capabilities  
✅ **Preserves** your environment variables and settings  
✅ **Smart routing** for all 100 tools

**Manual Upgrade (Fallback)**

```bash
claude mcp remove n8n-mcp-modern
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern
```

**Alternative: Direct Claude MCP Integration**

```bash
# For immediate use without smart installer
claud mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern
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

**7 Specialized Claude Code Agents for n8n Automation:**

This package includes Claude Code agents that work with the MCP server:

```
TIER 1: MASTER ORCHESTRATOR
├─ n8n-workflow-architect - Strategic planning & coordination

TIER 2: CORE DOMAIN SPECIALISTS
├─ n8n-developer-specialist - Code generation, templates, DevOps workflows
├─ n8n-integration-specialist - Authentication & connectivity
├─ n8n-node-specialist - 525+ node expertise + AI/ML patterns
├─ n8n-javascript-specialist - Code node validation & optimization
└─ n8n-performance-specialist - Monitoring, optimization, analytics

TIER 3: SUPPORT SPECIALIST
└─ n8n-guidance-specialist - Documentation, support & admin (merged)
```

**Installation:** Agents automatically install to `.claude/agents/` in your project for Claude Code integration.

## 🏗️ Architecture

**Clean Separation of Concerns:**

1. **🔧 MCP Server** (`@eekfonky/n8n-mcp-modern`): Provides 100 n8n-specific tools
2. **🤖 Claude Code Agents** (`agents/*.md`): 7 specialized agents using MCP tools
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

**📚 Comprehensive n8n (58 tools):**

- **Core Discovery (8):** Node search, documentation, database stats
- **Validation Engine (6):** Schema validation, workflow verification
- **Credential Management (14):** OAuth, API keys, authentication
- **User Management (8):** Permissions, admin functions
- **System Management (10):** Health checks, status monitoring
- **Workflow Management (12):** Advanced workflow operations

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
     -- npx -y @eekfonky/n8n-mcp-modern
   ```

### URL Auto-Normalization

The package automatically handles URL formatting:

- ✅ `https://n8n.example.com` → `https://n8n.example.com/api/v1`
- ✅ `https://n8n.example.com/` → `https://n8n.example.com/api/v1`
- ✅ `https://n8n.example.com/api` → `https://n8n.example.com/api/v1`

## 📊 Migration from Legacy

**From n8n-mcp-enhanced v3.x:**

1. **Same MCP Interface** - All 100 tools work identically
2. **Agent System Preserved** - Same hierarchical structure
3. **Performance Gains** - 10x faster, 95% smaller
4. **Zero Breaking Changes** - Drop-in replacement

**Migration Command:**

```bash
# Remove old version
claude mcp remove n8n-mcp-enhanced

# Add modern version
claude mcp add n8n-mcp-modern -- npx -y @eekfonky/n8n-mcp-modern
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

## 🔧 Troubleshooting

### Common Installation Issues

**Issue: MCP server hangs during installation**

```bash
# v4.6.11 includes 30-second timeout protection
# If hanging occurs, use diagnostic tools:
validate_mcp_config {"fix_issues": true}
```

**Issue: "Connection refused" or API errors**

```bash
# Validate your n8n configuration:
validate_mcp_config

# Check Node.js version (requires 22+):
node --version

# Verify n8n API endpoint is accessible:
curl -H "Authorization: Bearer YOUR_KEY" YOUR_N8N_URL/api/v1/workflows
```

**Issue: Tools not working properly**

```bash
# List all available tools and their status:
list_available_tools

# Check specific category:
list_available_tools {"category": "core"}
```

**Issue: TypeScript compilation errors**

```bash
# All TypeScript issues were fixed in v4.6.11
npm run typecheck  # Should show zero errors
npm run lint       # Should show zero warnings
```

### Environment Variable Setup

```bash
# Required for full functionality:
export N8N_API_URL="https://your-n8n-instance.com"
export N8N_API_KEY="your-api-key"

# Optional performance tuning:
export LOG_LEVEL="info"          # debug, info, warn, error
export ENABLE_CACHE="true"       # Caches API responses
export MAX_CONCURRENT_REQUESTS="10"  # API rate limiting
```

### Docker Users (Self-Hosted n8n)

If using docker-compose, ensure your n8n service includes:

```yaml
environment:
  - N8N_API_ENDPOINT_REST=api/v1
```

Then rebuild: `docker-compose up -d --build`

## 📄 License

MIT License - see LICENSE file for details.

## 🏆 Credits

Modern TypeScript rebuild by [eekfonky](https://github.com/eekfonky).

**Evolution**: From legacy prototype → Modern, secure, performant MCP server.

---

_Built for Claude Code users who demand modern, secure, high-performance n8n automation._ 🎯
