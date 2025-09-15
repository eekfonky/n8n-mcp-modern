# n8n Claude Code Agents

This directory contains specialized Claude Code agents for conversation-driven n8n workflow automation. These agents form a dynamic, adaptive system that scales with your n8n ecosystem and provides expert guidance based on your actual n8n instance capabilities.

## 🏗️ Dynamic Agent Architecture

### Adaptive 4-Tier System

```
TIER 1: CONVERSATION ORCHESTRATOR
├─ n8n-orchestrator - Natural language understanding & routing

TIER 2: CORE SPECIALISTS
├─ n8n-architect - Workflow architecture & design patterns
├─ n8n-builder - Code generation & workflow creation
├─ n8n-connector - Authentication & API connectivity
└─ n8n-scriptguard - Security validation & best practices

TIER 3: DOMAIN SPECIALISTS (Scale with your n8n ecosystem)
├─ n8n-data - Databases, ETL, analytics (if you have data nodes)
├─ n8n-cloud - Cloud services (if you have AWS/GCP/Azure nodes)
├─ n8n-ecommerce - E-commerce platforms (if you have Shopify/WooCommerce nodes)
├─ n8n-finance - Payments & accounting (if you have Stripe/QuickBooks nodes)
├─ n8n-communication - Messaging platforms (if you have Slack/Discord nodes)
├─ n8n-ai - AI/ML workflows (if you have OpenAI/LangChain nodes)
└─ n8n-automation - IoT & devices (if you have Home Assistant/MQTT nodes)

TIER 4: SUPPORT SPECIALISTS
├─ n8n-guide - Documentation & tutorials
├─ n8n-workflow - Templates & patterns
└─ n8n-performance - Optimization & scaling
```

### Key Features
- **Context-Aware Activation:** Agents only activate when relevant to your request
- **Ecosystem Adaptation:** Domain specialists automatically adapt to your n8n node types
- **Real-Time Discovery:** Agents learn your n8n capabilities in real-time

## 📥 Installation

### One-Command Setup

```bash
# Basic installation (discovers n8n capabilities automatically)
claude mcp add n8n-mcp-modern -- npx -y @eekfonky/n8n-mcp-modern

# With n8n API integration (recommended)
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern
```

### Agents Auto-Install ✨

**All specialist agents are automatically available through the MCP server!**

The system will:
- ✅ Discover your n8n instance capabilities
- ✅ Activate relevant domain specialists automatically
- ✅ Adapt agent behavior based on your available nodes
- ✅ Scale with your n8n ecosystem growth

```bash
# Verify MCP server is running
claude mcp status

# Test with a simple request
# "What n8n nodes do I have available?"
```

## 🚀 Conversation-Driven Usage

Simply describe what you want to build - the system automatically routes to appropriate agents:

### Natural Language Examples

```text
# Workflow Creation
"Create a workflow that sends Slack notifications for new GitHub issues"
→ System discovers GitHub & Slack nodes → Builds complete workflow

# Data Processing
"I need to process CSV files and update my database"
→ Detects CSV & database nodes → Creates ETL pipeline

# API Integration
"Connect my CRM to our email marketing platform"
→ Identifies available CRM & email nodes → Builds sync workflow

# Complex Automation
"Set up a customer onboarding process with multiple touchpoints"
→ Orchestrator coordinates multiple specialists → Multi-workflow system

# Performance Optimization
"My workflow is running slow with large datasets"
→ Performance specialist analyzes → Provides optimization recommendations
```

### Agent Activation Examples

**What triggers different specialists:**

- **n8n-data**: Mentions of databases, CSV, JSON, ETL, analytics
- **n8n-communication**: Slack, Discord, email, SMS, social media
- **n8n-cloud**: AWS, GCP, Azure, serverless, cloud storage
- **n8n-ecommerce**: Shopify, WooCommerce, payments, inventory
- **n8n-ai**: OpenAI, machine learning, data analysis, LLMs
- **n8n-finance**: Stripe, PayPal, accounting, invoicing

**Example Flow:**
```text
User: "Build an e-commerce analytics dashboard"

System:
1. Detects e-commerce + analytics context
2. Activates n8n-ecommerce + n8n-data specialists
3. Discovers your Shopify & database nodes
4. Creates integrated workflow automatically
```

## 🔧 How It Works

1. **You describe your need** in natural language
2. **Orchestrator analyzes** your request and n8n context
3. **Appropriate specialists activate** based on discovered capabilities
4. **MCP tools execute** real n8n API operations
5. **You get working workflows** with minimal back-and-forth

## 🤝 Intelligent Agent Coordination

### Dynamic Routing
- **Context Analysis**: System understands your request intent
- **Capability Matching**: Checks your n8n instance for relevant nodes
- **Specialist Selection**: Activates appropriate domain experts
- **Cross-Agent Collaboration**: Multiple agents work together when needed

### Real-Time Adaptation
- **Node Discovery**: Agents learn your n8n capabilities on first use
- **Smart Activation**: Only relevant specialists participate
- **Ecosystem Growth**: New community nodes automatically expand agent capabilities
- **Continuous Learning**: System improves recommendations based on your workflows

## 🛠️ Customization

These agent files are customizable! Edit them to:

- Add your specific n8n instance details
- Include your organization's workflow patterns
- Customize communication styles
- Add domain-specific knowledge

## 📚 Dynamic MCP Tools

Agents access **tools generated from your n8n instance:**

### Core Tools (Always Available)
- `n8n_list_workflows` - List your workflows
- `n8n_create_workflow` - Build new workflows
- `n8n_discover_nodes` - Scan available node types
- `n8n_execute_workflow` - Run workflows with data

### Generated Node Tools (Based on Your n8n)
- `n8n_slack` - If you have Slack node installed
- `n8n_github` - If you have GitHub node installed
- `n8n_mysql` - If you have MySQL node installed
- `n8n_openai` - If you have OpenAI node installed
- ...and every other node type in your n8n instance

### Smart Tool Selection
Agents automatically use the right tools based on:
- Your available node types
- Request context and intent
- Workflow complexity requirements

## 🔄 Updates

Keep your agents updated by re-copying from this repository when new versions are released.

---

_These agents leverage the modern n8n-MCP architecture for optimal Claude Code integration._
