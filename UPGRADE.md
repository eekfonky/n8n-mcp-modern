# 🚀 n8n MCP Modern - Migration Guide

## ⚠️ **CRITICAL: Package Migration Required**

**The package has moved from `@lexinet/n8n-mcp-modern` (npmjs.com) to `@eekfonky/n8n-mcp-modern` (GitHub Packages) for better reliability and zero technical debt.**

## 🚀 **Easy Migration (Recommended)**

### **One-Command Migration**

```bash
curl -fsSL https://raw.githubusercontent.com/eekfonky/n8n-mcp-modern/main/migration-standalone.sh | bash
```

**This script will:**

- ✅ Remove old `@lexinet` package
- ✅ Clear all caches
- ✅ Set up GitHub Packages authentication
- ✅ Install fresh `@eekfonky/n8n-mcp-modern@5.2.0`
- ✅ Verify everything works

---

## 🔧 **Manual Migration Steps**

If you prefer manual control:

### **Step 1: Clean Removal**

```bash
# Remove all old installations
claude mcp remove n8n-mcp-modern
claude mcp remove @lexinet/n8n-mcp-modern

# Clear npm/npx caches completely
npm cache clean --force
npx clear-npx-cache || rm -rf ~/.npm/_npx
```

### **Step 2: GitHub Packages Authentication**

You need a GitHub token with `read:packages` permission:

1. **[Create GitHub Token](https://github.com/settings/tokens)** (classic token)
2. **Select scopes**: `read:packages` (and `write:packages` if publishing)
3. **Choose authentication method**:

```bash
# Method A: Environment variable (recommended)
export GITHUB_TOKEN=your_github_token_here

# Method B: Login via npm
npm login --scope=@eekfonky --registry=https://npm.pkg.github.com

# Method C: Update ~/.npmrc file
echo "@eekfonky:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_TOKEN" >> ~/.npmrc
```

### **Step 3: Fresh Installation**

```bash
# Smart installer (preserves your configuration)
npx @eekfonky/n8n-mcp-modern install

# OR manual Claude MCP setup
claude mcp add n8n-mcp-modern \
  --scope project \
  --env N8N_API_URL=your-n8n-url \
  --env N8N_API_KEY=your-api-key \
  -- npx -y @eekfonky/n8n-mcp-modern
```

### **Step 4: Verification**

```bash
# Check installation
claude mcp list

# Should show: n8n-mcp-modern using @eekfonky package

# Test in Claude Code (try: list_available_tools)
```

---

## 🎯 Smart Install/Upgrade (For New Users)

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

- Complete implementation of all **92 tools** (up from broken legacy implementations)
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
# Check tool count (should show 92 tools)
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
# ✅ 92 tools available
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

**🚀 Ready to install or upgrade?** Run `npx @eekfonky/n8n-mcp-modern install` and get all 92 tools working in seconds!
