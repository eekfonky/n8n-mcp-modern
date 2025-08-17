# n8n Claude Code Agents

This directory contains 7 specialized Claude Code agents for n8n workflow automation. These agents work together with the n8n-mcp-modern MCP server to provide expert n8n guidance and automation capabilities.

## 🏗️ Agent Architecture

```
TIER 1: MASTER ORCHESTRATOR
├─ n8n-workflow-architect - Strategic planning & coordination

TIER 2: CORE SPECIALISTS  
├─ n8n-validator - Security & validation
├─ n8n-integration-specialist - Authentication & connectivity
└─ n8n-node-specialist - 525+ node expertise

TIER 3: RESEARCH SPECIALISTS
├─ n8n-assistant - Quick research & synthesis  
├─ n8n-docs-specialist - Documentation & setup
└─ n8n-community-specialist - AI/ML & community patterns
```

## 📥 Installation

### Step 1: Install the MCP Server
```bash
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @lexinet/n8n-mcp-modern
```

### Step 2: Agents Auto-Install ✨
**Agents are automatically installed to `~/.claude/agents/` during MCP installation!**

The postinstall script will:
- ✅ Create `~/.claude/agents/` directory if needed
- ✅ Copy all 7 specialist agents automatically  
- ✅ Backup existing agents before updating
- ✅ Skip agents that are already up-to-date

```bash
# Verify agents were installed
claude agents list

# Manual installation (if needed)
cp agents/*.md ~/.claude/agents/
```

## 🚀 Usage

Once installed, use Claude Code's Task tool to delegate to specialists:

```
# For complex workflow design
"Task: Create a comprehensive e-commerce automation system" 
→ Uses n8n-workflow-architect

# For security validation
"Task: Validate this payment processing workflow for security issues"
→ Uses n8n-validator

# For API integration help
"Task: Set up OAuth authentication with Salesforce"
→ Uses n8n-integration-specialist

# For node-specific questions
"Task: What's the best node configuration for processing large CSV files?"
→ Uses n8n-node-specialist

# For quick help
"Task: How do I connect Slack to Google Sheets?"
→ Uses n8n-assistant

# For documentation
"Task: Create setup guide for automated customer support workflows"
→ Uses n8n-docs-specialist

# For AI/ML workflows
"Task: Design an AI content moderation system using community tools"
→ Uses n8n-community-specialist
```

## 🔧 How It Works

1. **You ask Claude Code** for n8n help using the Task tool
2. **Claude Code selects** the appropriate specialist agent
3. **The agent uses** n8n-mcp-modern MCP tools for n8n operations
4. **You get expert guidance** tailored to your specific needs

## 🤝 Agent Coordination

Agents automatically coordinate when needed:
- **n8n-workflow-architect** orchestrates complex projects
- **Specialists** handle their expertise areas
- **Research agents** provide support and documentation

## 🛠️ Customization

These agent files are customizable! Edit them to:
- Add your specific n8n instance details
- Include your organization's workflow patterns
- Customize communication styles
- Add domain-specific knowledge

## 📚 MCP Tools Available

All agents have access to 87+ n8n MCP tools including:
- `search_nodes` - Find nodes for specific tasks
- `create_workflow` - Build new workflows  
- `validate_workflow` - Check workflow security and structure
- `get_node_info` - Get detailed node information
- And many more...

## 🔄 Updates

Keep your agents updated by re-copying from this repository when new versions are released.

---

*These agents leverage the modern n8n-MCP architecture for optimal Claude Code integration.*