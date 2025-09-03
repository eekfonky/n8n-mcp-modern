# n8n Claude Code Agents

This directory contains 15 specialized Claude Code agents for comprehensive n8n workflow automation. These agents form a sophisticated hierarchical system that works with the n8n-mcp-modern MCP server to provide expert guidance across 675+ n8n nodes and all automation domains.

## 🏗️ Agent Hierarchy

```
TIER 1: MASTER ORCHESTRATOR
├─ n8n-orchestrator - Strategic planning & multi-agent coordination

TIER 2: CORE ARCHITECTURE SPECIALISTS  
├─ n8n-builder - Code generation & DevOps workflows
├─ n8n-connector - Authentication & connectivity
├─ n8n-scriptguard - JavaScript validation & security
└─ n8n-architect - Workflow architecture & design patterns

TIER 3: DOMAIN SPECIALISTS
├─ n8n-data - Data processing & pipeline optimization
├─ n8n-cloud - Cloud platforms & infrastructure
├─ n8n-ecommerce - E-commerce & retail automation
├─ n8n-finance - Financial systems & compliance
├─ n8n-communication - Messaging & social platforms
├─ n8n-ai - AI/ML workflows & LLM integration
└─ n8n-automation - IoT & smart device automation

TIER 4: SPECIALIZED SUPPORT
├─ n8n-guide - Documentation & tutorials
├─ n8n-workflow - Templates & reusable patterns
└─ n8n-performance - Optimization & scalability
```

## 📥 Installation

### Step 1: Install the MCP Server

```bash
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern
```

### Step 2: Agents Auto-Install ✨

**All 15 agents are automatically installed to `~/.claude/agents/` during MCP installation!**

The postinstall script will:

- ✅ Create `~/.claude/agents/` directory if needed
- ✅ Copy all 15 specialist agents automatically
- ✅ Backup existing agents before updating
- ✅ Skip agents that are already up-to-date

```bash
# Verify agents were installed
claude agents list

# Manual installation (if needed)
cp agents/*.md ~/.claude/agents/
```

## 🚀 Usage

Once installed, use Claude Code's Task tool to delegate across the hierarchy:

```
# TIER 1: Strategic Coordination
"Task: Plan a complete business automation transformation with 50+ workflows"
→ Uses n8n-orchestrator

# TIER 2: Core Architecture
"Task: Set up OAuth2 authentication with Microsoft Graph API"
→ Uses n8n-connector

"Task: Optimize Code node performance for 10K+ records processing"
→ Uses n8n-scriptguard

"Task: Find the best nodes for real-time payment processing"
→ Uses n8n-scriptguard (525+ nodes)

"Task: Build CI/CD pipeline for workflow deployment"
→ Uses n8n-builder

# TIER 3: Domain Expertise
"Task: Design microservices architecture for workflow scaling"
→ Uses n8n-architect

"Task: Create ML pipeline for customer churn prediction"
→ Uses n8n-ai

"Task: Set up AWS Lambda integration with S3 event triggers"
→ Uses n8n-cloud

"Task: Build Shopify to NetSuite inventory sync"
→ Uses n8n-ecommerce

"Task: Implement GDPR-compliant financial reporting automation"
→ Uses n8n-finance

"Task: Create omnichannel customer communication system"
→ Uses n8n-communication

"Task: Automate smart home with 100+ IoT devices"
→ Uses n8n-automation

"Task: Process 1M+ records with ETL optimization"
→ Uses n8n-data

# TIER 4: Specialized Support
"Task: Create reusable template library for HR workflows"
→ Uses n8n-workflow

"Task: Optimize workflows handling 50K+ executions/day"
→ Uses n8n-performance

"Task: Write comprehensive API integration guide"
→ Uses n8n-guide
```

## 🔧 How It Works

1. **You ask Claude Code** for n8n help using the Task tool
2. **Claude Code selects** the appropriate specialist agent
3. **The agent uses** n8n-mcp-modern MCP tools for n8n operations
4. **You get expert guidance** tailored to your specific needs

## 🤝 Agent Coordination

Agents automatically coordinate through sophisticated hierarchy:

- **TIER 1**: Master orchestrator coordinates strategic multi-agent initiatives
- **TIER 2**: Core architecture specialists handle foundational capabilities
- **TIER 3**: Domain specialists provide deep expertise in specific areas
- **TIER 4**: Specialized support agents provide templates, optimization, and guidance
- **Cross-tier collaboration**: Agents intelligently delegate and collaborate based on task complexity

## 🛠️ Customization

These agent files are customizable! Edit them to:

- Add your specific n8n instance details
- Include your organization's workflow patterns
- Customize communication styles
- Add domain-specific knowledge

## 📚 MCP Tools Available

All 15 agents have access to 92+ n8n MCP tools including:

- `search_nodes` - Find nodes across 675+ available nodes
- `create_workflow` - Build new workflows with validation
- `validate_workflow` - Security and structure checking
- `get_node_info` - Detailed node specifications
- `discover_capabilities` - Dynamic capability assessment
- `analyze_performance` - Workflow optimization insights
- And many more advanced automation tools...

## 🔄 Updates

Keep your agents updated by re-copying from this repository when new versions are released.

---

_These agents leverage the modern n8n-MCP architecture for optimal Claude Code integration._
