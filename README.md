# n8n-MCP Modern 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-6.2.0-blue.svg)](https://github.com/eekfonky/n8n-mcp-modern)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

**Modern n8n MCP server with agent handover system. Zero legacy dependencies, maximum performance.**

## 🎯 What's New in v6.2.0

**LATEST RELEASE** - Enhanced intelligence and performance optimizations:
- ✅ **126+ Advanced Tools**: Comprehensive workflow automation toolkit
- ✅ **7-Agent Hierarchy**: Optimized specialist routing with enhanced performance
- ✅ **Memory Optimization**: Array limits and intelligent monitoring
- ✅ **Enhanced Routing**: Improved complexity assessment and agent selection
- ✅ **Runtime Reliability**: Resolved critical MCP server runtime issues

> **✨ UPGRADE RECOMMENDED**: Clean performance improvements and expanded capabilities.

## 🚀 Installation

### Fresh Installation (v6.2.0+)

```bash
# Method 1: Direct from GitHub (Recommended)
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern
```

```bash
# Method 2: Local Development
git clone https://github.com/eekfonky/n8n-mcp-modern.git
cd n8n-mcp-modern && npm install && npm run build
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- node /absolute/path/to/n8n-mcp-modern/dist/index.js
```

### Upgrading from v5.x (REQUIRED)

```bash
# 1. Clean removal
claude mcp remove n8n-mcp-modern
rm -rf ~/.claude/mcp/servers/n8n-mcp-modern

# 2. Remove local data (saves new story file system)
rm -rf data/n8n-mcp.db data/nodes.db

# 3. Fresh install with v6.2.0
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern
```

> **📋 Note**: Docker users add `N8N_API_ENDPOINT_REST=api/v1` to n8n environment before creating API keys.

## 🏗️ Architecture

### 7-Agent Hierarchy with Intelligent Routing

```
TIER 1 - MASTER ORCHESTRATOR
├─ n8n-workflow-architect - Strategic planning & coordination

TIER 2 - CORE DOMAIN SPECIALISTS (5)
├─ n8n-developer-specialist - Code generation, templates, DevOps
├─ n8n-integration-specialist - Authentication, APIs, connectivity
├─ n8n-node-specialist - 525+ nodes + AI/ML + community
├─ n8n-javascript-specialist - JavaScript validation, optimization, security
└─ n8n-performance-specialist - Monitoring, optimization, analytics

TIER 3 - SUPPORT SPECIALIST
└─ n8n-guidance-specialist - Documentation, tutorials, admin support
```

### Performance vs Legacy

| Metric | Legacy | Modern | Improvement |
|--------|--------|--------|-------------|
| Bundle Size | 1.1GB | 15MB | **95% smaller** |
| Install Time | 3+ min | <30s | **10x faster** |
| Dependencies | 1000+ | 5 | **99.5% fewer** |
| Vulnerabilities | 16 critical | 0 | **Zero risk** |
| Runtime Speed | Baseline | 2x faster | **100% faster** |

## 🛠️ Core Features

### Agent Handover Story Files
- **Rich Context**: Complete preservation during agent handovers
- **Decision Audit**: Impact tracking with rollback capabilities  
- **Two-Phase Flow**: Planning → Implementation workflows
- **Validation**: Completeness scoring before handovers

### 126+ Advanced Tools
- **18 Core MCP Tools**: Direct n8n API integration with enhanced features
- **12 Code Generation Tools**: Workflow templates, API integrations, Docker
- **10 Developer Workflow Tools**: CI/CD, Git integration, deployment automation
- **12 Performance & Observability Tools**: Monitoring, optimization, analytics
- **87+ Comprehensive Tools**: Discovery, validation, management, and specialized operations

### Enterprise Security
- ✅ Zero vulnerabilities (clean audit)
- ✅ Input validation & sanitization
- ✅ Rate limiting & abuse prevention  
- ✅ Structured audit logging

## 📊 Story File System

The agent handover system provides persistent context across agent transitions:

```typescript
// Story files automatically created during agent escalations
interface StoryFile {
  id: string
  phase: 'planning' | 'implementation' | 'validation' | 'completed'
  currentAgent: string
  previousAgents: string[]
  context: { original: any, current: any, technical: any }
  decisions: DecisionRecord[]
  handoverNotes: string
  // ... additional audit fields
}
```

Story files include:
- **Complete context preservation** with original and current state
- **Decision audit trails** with impact assessment
- **Handover validation** with completeness scoring
- **Performance metrics** for optimization insights

## 🔧 Configuration

### Environment Variables

```bash
# Required for n8n integration
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your-api-key

# Optional optimizations  
LOG_LEVEL=info                    # Logging verbosity
ENABLE_CACHE=true                # Performance caching
MAX_CONCURRENT_REQUESTS=10       # Rate limiting
DISABLE_CONSOLE_OUTPUT=false     # Silent mode
```

### MCP Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "n8n-mcp-modern": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@eekfonky/n8n-mcp-modern"],
      "env": {
        "N8N_API_URL": "https://your-n8n-instance.com",
        "N8N_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

> **🔒 Security Note**: Only `N8N_API_URL` and `N8N_API_KEY` are required. Do not add other API keys (like OpenRouter, OpenAI, etc.) to the MCP configuration - these should be configured within your n8n workflows themselves for better security and portability.

## 🎖️ Enterprise Features

### Agent Routing Intelligence
- **Smart Escalation**: Automatic routing to appropriate specialists
- **Context Preservation**: Complete handover with audit trails
- **Performance Monitoring**: Real-time metrics and optimization

### Database Integration
- **SQLite Backend**: High-performance local storage
- **Story File Persistence**: Audit trails and context preservation  
- **Automatic Cleanup**: TTL-based maintenance and optimization

### Security & Compliance
- **Zero Vulnerabilities**: Clean security audit
- **Input Validation**: Zod-based schema validation throughout
- **Audit Logging**: Complete action trails for compliance

## 🤝 Contributing

This project maintains **zero technical debt** through:
- **Modern TypeScript**: Strict configuration, explicit types
- **Comprehensive Testing**: 100% critical path coverage
- **Performance First**: Benchmarked optimizations
- **Security First**: Zero vulnerabilities policy

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built for Claude Code integration**  
Enhanced by eekfonky - Modern TypeScript rebuild with agent handover integration