#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

console.log('🚀 Setting up n8n-MCP Modern with Claude Code agents...')

// Required MCP servers
const requiredMCPs = [
  '@modelcontextprotocol/server-sequential-thinking',
  '@modelcontextprotocol/server-memory',
  '@modelcontextprotocol/server-filesystem',
  '@context7/mcp-server',
]

function detectClaudeCodeEnvironment() {
  // Check for Claude Code indicators
  const indicators = [
    process.env.CLAUDE_CODE,
    existsSync(join(process.env.HOME || '', '.claude')),
    process.env.ANTHROPIC_CLI === 'true',
  ]

  return indicators.some(Boolean)
}

function createDirectoryStructure() {
  console.log('📁 Creating directory structure...')

  const dirs = [
    join(projectRoot, '.claude'),
    join(projectRoot, '.claude/agents'),
    join(projectRoot, 'data'),
    join(projectRoot, 'workflows'),
  ]

  dirs.forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
      console.log(`   Created: ${dir}`)
    }
  })
}

function installMCPDependencies() {
  console.log('📦 Installing required MCP servers...')

  for (const mcp of requiredMCPs) {
    try {
      console.log(`   Installing ${mcp}...`)
      execSync(`npm install -g ${mcp}`, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000,
      })
      console.log(`   ✅ ${mcp} installed successfully`)
    }
    catch (error) {
      console.warn(`   ⚠️  Failed to install ${mcp}: ${error.message}`)
      console.log(`   💡 You may need to install manually: npm install -g ${mcp}`)
    }
  }
}

function validateAgents() {
  console.log('🤖 Validating Claude Code agents...')

  const agentFiles = [
    'n8n-control.md',
    'n8n-architect.md',
    'n8n-node.md',
    'n8n-connector.md',
    'n8n-scriptguard.md',
    'n8n-guide.md',
  ]

  let allValid = true

  agentFiles.forEach((file) => {
    const agentPath = join(projectRoot, '.claude/agents', file)
    if (existsSync(agentPath)) {
      try {
        const content = readFileSync(agentPath, 'utf8')

        // Validate YAML frontmatter
        if (!content.startsWith('---')) {
          console.warn(`   ⚠️  ${file}: Missing YAML frontmatter`)
          allValid = false
        }

        // Check for required fields
        const requiredFields = ['name:', 'description:', 'model:']
        const missingFields = requiredFields.filter(field => !content.includes(field))

        if (missingFields.length > 0) {
          console.warn(`   ⚠️  ${file}: Missing fields: ${missingFields.join(', ')}`)
          allValid = false
        }
        else {
          console.log(`   ✅ ${file} validated`)
        }
      }
      catch (error) {
        console.warn(`   ⚠️  ${file}: Validation error: ${error.message}`)
        allValid = false
      }
    }
    else {
      console.warn(`   ⚠️  ${file}: Agent file not found`)
      allValid = false
    }
  })

  return allValid
}

function updateMCPConfiguration() {
  console.log('⚙️  Updating MCP configuration...')

  const mcpConfigPath = join(projectRoot, '.mcp.json')

  if (existsSync(mcpConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(mcpConfigPath, 'utf8'))

      // Validate required MCP servers are configured
      const requiredServers = ['sequential-thinking', 'memory', 'filesystem', 'context7']
      const configuredServers = Object.keys(config.mcpServers || {})

      const missingServers = requiredServers.filter(server => !configuredServers.includes(server))

      if (missingServers.length === 0) {
        console.log('   ✅ All required MCP servers configured')
      }
      else {
        console.warn(`   ⚠️  Missing MCP servers: ${missingServers.join(', ')}`)
        console.log('   💡 Please update .mcp.json with the missing servers')
      }
    }
    catch (error) {
      console.warn(`   ⚠️  Failed to parse .mcp.json: ${error.message}`)
    }
  }
  else {
    console.warn('   ⚠️  .mcp.json not found')
  }
}

function initializeDatabase() {
  console.log('🗄️  Initializing database...')

  try {
    const schemaPath = join(projectRoot, 'src/database/enhanced-schema.sql')
    if (existsSync(schemaPath)) {
      console.log('   ✅ Database schema found')

      // Check if SQLite is available
      try {
        execSync('sqlite3 --version', { stdio: 'ignore' })
        console.log('   ✅ SQLite3 available')

        // Initialize database with schema
        const dataDir = join(projectRoot, 'data')
        const dbPath = join(dataDir, 'nodes.db')

        if (!existsSync(dbPath)) {
          execSync(`sqlite3 "${dbPath}" < "${schemaPath}"`, { stdio: 'ignore' })
          console.log('   ✅ Database initialized')
        }
        else {
          console.log('   ✅ Database already exists')
        }
      }
      catch (_error) {
        console.warn('   ⚠️  SQLite3 not available - database will be created at runtime')
      }
    }
    else {
      console.warn('   ⚠️  Database schema not found')
    }
  }
  catch (error) {
    console.warn(`   ⚠️  Database initialization failed: ${error.message}`)
  }
}

function generateQuickStartGuide() {
  console.log('📋 Generating quick start guide...')

  const guide = `# n8n-MCP Modern Quick Start

## Setup Complete! 🎉

Your n8n-MCP Modern installation is ready with Claude Code agents.

## What's Installed

### Claude Code Agents (in .claude/agents/)
- **n8n-control** - Master orchestrator (Opus)
- **n8n-architect** - Workflow design specialist (Opus)
- **n8n-node** - Node selection expert (Sonnet)
- **n8n-connector** - Authentication specialist (Sonnet)
- **n8n-scriptguard** - JavaScript validator (Sonnet)
- **n8n-guide** - Documentation helper (Haiku)

### MCP Dependencies
- Sequential Thinking MCP
- Memory MCP
- Filesystem MCP
- Context7 MCP

## Quick Start

1. **Start using immediately:**
   \`\`\`bash
   # Via Claude Code
   claude mcp add @eekfonky/n8n-mcp-modern

   # Or direct usage
   npx @eekfonky/n8n-mcp-modern
   \`\`\`

2. **Discover your n8n nodes:**
   \`\`\`
   Ask Claude: "Discover all nodes from my n8n instance"
   \`\`\`

3. **Build workflows with agents:**
   \`\`\`
   Ask Claude: "Use n8n-control to create a Slack notification workflow"
   \`\`\`

## Agent Delegation Examples

- **Complex workflows:** "n8n-architect, design a multi-step data processing pipeline"
- **Node selection:** "n8n-node, find the best node for sending emails"
- **Authentication:** "n8n-connector, help me set up OAuth for Google Sheets"
- **Code validation:** "n8n-scriptguard, check this JavaScript for security issues"
- **Documentation:** "n8n-guide, explain how to use the HTTP Request node"

## Configuration

Your n8n instance is configured in \`.mcp.json\`. Update the N8N_API_URL and N8N_API_KEY as needed.

## Support

- Documentation: https://github.com/eekfonky/n8n-mcp-modern
- Issues: https://github.com/eekfonky/n8n-mcp-modern/issues

Happy automating! 🚀
`

  const guidePath = join(projectRoot, 'QUICKSTART.md')
  writeFileSync(guidePath, guide)
  console.log(`   ✅ Quick start guide created: ${guidePath}`)
}

function main() {
  console.log('📍 Project root:', projectRoot)

  const isClaudeCode = detectClaudeCodeEnvironment()
  if (isClaudeCode) {
    console.log('✅ Claude Code environment detected')
  }
  else {
    console.log('ℹ️  Claude Code not detected - agents available but may not auto-load')
  }

  try {
    createDirectoryStructure()
    installMCPDependencies()
    updateMCPConfiguration()

    if (isClaudeCode) {
      const agentsValid = validateAgents()
      if (agentsValid) {
        console.log('✅ All Claude Code agents validated')
      }
    }

    initializeDatabase()
    generateQuickStartGuide()

    console.log('\n🎉 Setup completed successfully!')
    console.log('\n📖 Next steps:')
    console.log('   1. Review QUICKSTART.md for usage examples')
    console.log('   2. Update .mcp.json with your n8n instance details')
    console.log('   3. Start building workflows with Claude Code agents!')

    if (!isClaudeCode) {
      console.log('\n💡 To use Claude Code agents:')
      console.log('   1. Install Claude Code CLI')
      console.log('   2. Run: claude mcp add @eekfonky/n8n-mcp-modern')
    }
  }
  catch (error) {
    console.error('❌ Setup failed:', error.message)
    process.exit(1)
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main as setupAgents }
