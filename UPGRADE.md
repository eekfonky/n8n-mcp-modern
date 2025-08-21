# 🚀 n8n MCP Modern - Upgrade Guide

## 🎯 Smart Install/Upgrade (Recommended)

For both fresh installations and upgrades, we now provide a **unified smart command** that auto-detects your current state and handles everything seamlessly.

### Quick Install/Upgrade

```bash
# Same command for fresh installs AND upgrades!
npx @eekfonky/n8n-mcp-modern install
```

That's it! The smart install/upgrade will:

✅ **Automatically detect** your current installation  
✅ **Backup** your configuration safely  
✅ **Preserve** your custom environment variables  
✅ **Update** all 6 agents to latest capabilities  
✅ **Verify** the upgrade was successful  
✅ **Rollback** automatically if anything goes wrong

### What Gets Upgraded

#### 🛠️ **MCP Server (v4.3.4)**

- Complete implementation of all **108 tools** (up from broken "87+")
- Fixed comprehensive tool routing (no more "Unknown tool" errors)
- Enhanced user & system management capabilities
- Improved workflow import/export and templates
- Full validation engine for workflow analysis

#### 🤖 **Agent System (6 Agents)**

- **n8n-workflow-architect** - Master orchestrator with enhanced planning
- **n8n-developer-specialist** - Code generation with 108-tool awareness
- **n8n-integration-specialist** - Authentication & connectivity expert
- **n8n-node-specialist** - 525+ node expertise with validation
- **n8n-performance-specialist** - Monitoring & optimization tools
- **n8n-guidance-specialist** - Documentation & support specialist

## 📋 Manual Upgrade (Fallback)

If the smart install fails or you prefer manual control:

### Step 1: Remove Current Installation

```bash
claude mcp remove @eekfonky/n8n-mcp-modern
```

### Step 2: Clean Agent Configuration

Edit `~/.claude/config.json` and remove all `n8n-*` entries from the `agents` section.

### Step 3: Fresh Installation

```bash
claude mcp add @eekfonky/n8n-mcp-modern
```

## 🔍 Upgrade Verification

After upgrading, verify everything is working:

```bash
# Check tool count (should show 108 tools)
npx @eekfonky/n8n-mcp-modern --version

# Verify agents are installed
ls ~/.claude/config.json
```

Your Claude configuration should now include:

- ✅ `@eekfonky/n8n-mcp-modern` server
- ✅ 6 n8n-\* agents with latest capabilities

## 🆘 Troubleshooting

### Upgrade Fails

```bash
# Try the install command again
npx @eekfonky/n8n-mcp-modern install

# If it fails, use manual upgrade path
claude mcp remove @eekfonky/n8n-mcp-modern
claude mcp add @eekfonky/n8n-mcp-modern
```

### Configuration Issues

```bash
# Backup and reset Claude config
cp ~/.claude/config.json ~/.claude/config.json.backup
# Edit ~/.claude/config.json to remove n8n entries
# Then re-run: claude mcp add @eekfonky/n8n-mcp-modern
```

### Tool Count Mismatch

```bash
# Verify your installation
npx @eekfonky/n8n-mcp-modern --health-check

# Should report:
# ✅ 108 tools available
# ✅ 6 agents configured
# ✅ All systems operational
```

## 🎉 What's New in v4.3.4

### 🔧 **Major Fixes**

- **Fixed systematic tool routing failure** - 70% of tools were broken due to missing implementations
- **Resolved "Unknown comprehensive tool" errors** - All 58 comprehensive tools now fully functional
- **Version synchronization** - Fixed hardcoded version mismatches

### ⭐ **New Capabilities**

- **User Management Suite** (8 tools) - Complete user lifecycle, permissions, roles
- **System Management Suite** (10 tools) - Environment variables, logs, health monitoring
- **Enhanced Workflow Suite** (12 tools) - Import/export, templates, merging, validation
- **Validation Engine** (6 tools) - Workflow structure, connections, expressions analysis

### 📊 **Performance Improvements**

- **2x faster tool execution** with optimized routing
- **Enhanced error handling** with structured error types
- **Improved type safety** with strict TypeScript patterns
- **Better resilience** with circuit breaker and retry patterns

## 🔄 Migration Notes

### From v4.3.1/4.3.2 → v4.3.3

- **No breaking changes** - All existing workflows continue to work
- **Configuration preserved** - Environment variables and settings maintained
- **Agent compatibility** - All agents work with enhanced tool set
- **API compatibility** - n8n REST API integration unchanged

### From Legacy Versions (v3.x)

- **Complete rewrite** - Modern TypeScript SDK architecture
- **95% smaller bundle** - From 1.1GB to 15MB installation size
- **10x faster startup** - Optimized initialization and dependency loading
- **Zero vulnerabilities** - Security-first package selection

## 📞 Support

### Quick Help

- **Documentation**: [GitHub Repository](https://github.com/eekfonky/n8n-mcp-modern)
- **Issues**: [Report Problems](https://github.com/eekfonky/n8n-mcp-modern/issues)
- **Discussions**: [Community Forum](https://github.com/eekfonky/n8n-mcp-modern/discussions)

### Common Issues

1. **"Command not found"** - Run `npm install -g @eekfonky/n8n-mcp-modern` first
2. **"Permission denied"** - Use `sudo` for global installation or use `npx`
3. **"Claude config not found"** - Ensure Claude Code is properly installed
4. **"Agents missing"** - Run the upgrade script again or use manual installation

---

**🚀 Ready to install or upgrade?** Run `npx @eekfonky/n8n-mcp-modern install` and get all 100 tools working in seconds!
