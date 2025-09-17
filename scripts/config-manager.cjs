#!/usr/bin/env node

/**
 * Unified Configuration Manager
 *
 * Consolidates MCP configuration setup and management.
 * Handles Claude Desktop, VS Code, and custom MCP configurations
 * with user consent and interactive setup.
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

class ConfigManager {
  constructor() {
    this.homeDir = os.homedir()
    this.projectRoot = path.resolve(__dirname, '..')
    this.configTemplateDir = path.join(this.projectRoot, 'config-templates')
    this.interactive = !process.argv.includes('--non-interactive')
    this.setup = process.argv.includes('--setup')
    this.claudeConfigPath = path.join(this.homeDir, '.config', 'claude-desktop', 'claude_desktop_config.json')
    this.vscodeConfigDir = path.join(this.homeDir, '.vscode', 'settings.json')
  }

  log(message, level = 'info') {
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'warning' ? '⚠️' : 'ℹ️'
    console.log(`${prefix} ${message}`)
  }

  prompt(question) {
    if (!this.interactive)
      return 'y'

    process.stdout.write(`${question} (y/n): `)
    const response = require('node:child_process').execSync('read -r line; echo "$line"', {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit'],
    }).trim().toLowerCase()

    return response === 'y' || response === 'yes'
  }

  async ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true })
        this.log(`Created directory: ${dirPath}`, 'success')
        return true
      }
      catch (error) {
        this.log(`Failed to create directory ${dirPath}: ${error.message}`, 'error')
        return false
      }
    }
    return true
  }

  loadUnifiedTemplate() {
    const templatePath = path.join(this.configTemplateDir, 'unified-mcp-config.json')

    if (!fs.existsSync(templatePath)) {
      this.log('Unified configuration template not found. Using default.', 'warning')
      return this.getDefaultConfig()
    }

    try {
      const template = fs.readFileSync(templatePath, 'utf8')
      return JSON.parse(template)
    }
    catch (error) {
      this.log(`Failed to load template: ${error.message}`, 'error')
      return this.getDefaultConfig()
    }
  }

  getDefaultConfig() {
    return {
      mcpServers: {
        'n8n-mcp-modern': {
          command: 'npx',
          args: ['-y', '@eekfonky/n8n-mcp-modern'],
          env: {
            N8N_API_URL: '${N8N_API_URL}',
            N8N_API_KEY: '${N8N_API_KEY}',
            LOG_LEVEL: 'info',
          },
        },
      },
    }
  }

  collectEnvironmentVariables() {
    const envVars = {}

    if (this.interactive) {
      console.log('\n🔧 Environment Configuration')
      console.log('Configure your n8n API connection (press Enter to skip):')

      process.stdout.write('N8N API URL (e.g., http://localhost:5678): ')
      const apiUrl = require('node:child_process').execSync('read -r line; echo "$line"', {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'inherit'],
      }).trim()

      process.stdout.write('N8N API Key: ')
      const apiKey = require('node:child_process').execSync('read -r -s line; echo "$line"', {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'inherit'],
      }).trim()

      if (apiUrl)
        envVars.N8N_API_URL = apiUrl
      if (apiKey)
        envVars.N8N_API_KEY = apiKey
    }
    else {
      // Non-interactive mode, use environment variables if available
      if (process.env.N8N_API_URL)
        envVars.N8N_API_URL = process.env.N8N_API_URL
      if (process.env.N8N_API_KEY)
        envVars.N8N_API_KEY = process.env.N8N_API_KEY
    }

    return envVars
  }

  substituteVariables(config, envVars) {
    const configStr = JSON.stringify(config, null, 2)
    let substituted = configStr

    for (const [key, value] of Object.entries(envVars)) {
      const placeholder = `\${${key}}`
      substituted = substituted.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
    }

    try {
      return JSON.parse(substituted)
    }
    catch (error) {
      this.log(`Failed to substitute variables: ${error.message}`, 'error')
      return config
    }
  }

  async setupClaudeDesktopConfig(config) {
    this.log('Setting up Claude Desktop configuration...')

    const configDir = path.dirname(this.claudeConfigPath)
    if (!await this.ensureDirectoryExists(configDir)) {
      return false
    }

    let existingConfig = {}
    if (fs.existsSync(this.claudeConfigPath)) {
      try {
        existingConfig = JSON.parse(fs.readFileSync(this.claudeConfigPath, 'utf8'))
        this.log('Found existing Claude Desktop configuration', 'info')
      }
      catch (error) {
        this.log('Existing configuration is invalid, will backup and replace', 'warning')
      }
    }

    // Backup existing config
    if (fs.existsSync(this.claudeConfigPath) && this.interactive) {
      const backup = `${this.claudeConfigPath}.backup.${Date.now()}`
      fs.copyFileSync(this.claudeConfigPath, backup)
      this.log(`Backed up existing config to: ${backup}`, 'info')
    }

    // Merge configurations
    const mergedConfig = {
      ...existingConfig,
      mcpServers: {
        ...existingConfig.mcpServers,
        ...config.mcpServers,
      },
    }

    try {
      fs.writeFileSync(this.claudeConfigPath, JSON.stringify(mergedConfig, null, 2))
      this.log('Claude Desktop configuration updated successfully!', 'success')
      return true
    }
    catch (error) {
      this.log(`Failed to write Claude Desktop config: ${error.message}`, 'error')
      return false
    }
  }

  async setupVSCodeConfig(config) {
    if (!this.interactive || !this.prompt('Setup VS Code MCP configuration?')) {
      return true
    }

    this.log('Setting up VS Code configuration...')

    const vscodeConfig = {
      'mcp.servers': config.mcpServers,
    }

    let existingSettings = {}
    if (fs.existsSync(this.vscodeConfigDir)) {
      try {
        existingSettings = JSON.parse(fs.readFileSync(this.vscodeConfigDir, 'utf8'))
      }
      catch (error) {
        this.log('VS Code settings file is invalid, will replace', 'warning')
      }
    }

    const mergedSettings = {
      ...existingSettings,
      ...vscodeConfig,
    }

    try {
      const settingsDir = path.dirname(this.vscodeConfigDir)
      await this.ensureDirectoryExists(settingsDir)
      fs.writeFileSync(this.vscodeConfigDir, JSON.stringify(mergedSettings, null, 2))
      this.log('VS Code configuration updated successfully!', 'success')
      return true
    }
    catch (error) {
      this.log(`Failed to write VS Code config: ${error.message}`, 'error')
      return false
    }
  }

  validateConfiguration(config) {
    this.log('Validating configuration...')

    const issues = []

    if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
      issues.push('No MCP servers configured')
    }

    for (const [name, server] of Object.entries(config.mcpServers || {})) {
      if (!server.command) {
        issues.push(`Server "${name}" missing command`)
      }

      if (server.env) {
        for (const [envKey, envValue] of Object.entries(server.env)) {
          if (typeof envValue === 'string' && envValue.includes('${') && envValue.includes('}')) {
            issues.push(`Server "${name}" has unresolved variable: ${envKey}=${envValue}`)
          }
        }
      }
    }

    if (issues.length > 0) {
      this.log('Configuration validation issues:', 'warning')
      issues.forEach(issue => this.log(`  • ${issue}`, 'warning'))
      return false
    }

    this.log('Configuration validation passed!', 'success')
    return true
  }

  showConfigurationSummary(config) {
    console.log('\n📋 Configuration Summary:')
    console.log(`Servers configured: ${Object.keys(config.mcpServers).length}`)

    for (const [name, server] of Object.entries(config.mcpServers)) {
      console.log(`\n• ${name}:`)
      console.log(`  Command: ${server.command} ${(server.args || []).join(' ')}`)

      if (server.env) {
        const envKeys = Object.keys(server.env)
        if (envKeys.length > 0) {
          console.log(`  Environment: ${envKeys.join(', ')}`)
        }
      }
    }

    console.log(`\nClaude Desktop config: ${this.claudeConfigPath}`)
    console.log('\nTo use:')
    console.log('1. Restart Claude Desktop')
    console.log('2. Start a conversation')
    console.log('3. Use MCP tools for n8n workflow automation')
  }

  async run() {
    this.log('Starting MCP configuration management...')

    try {
      // Load unified template
      const template = this.loadUnifiedTemplate()

      // Collect environment variables
      const envVars = this.collectEnvironmentVariables()

      // Substitute variables in template
      const config = this.substituteVariables(template, envVars)

      // Validate configuration
      if (!this.validateConfiguration(config)) {
        if (this.interactive && !this.prompt('Continue with validation warnings?')) {
          this.log('Configuration cancelled by user.', 'info')
          process.exit(0)
        }
      }

      // Setup configurations
      const claudeSuccess = await this.setupClaudeDesktopConfig(config)
      const vscodeSuccess = await this.setupVSCodeConfig(config)

      if (claudeSuccess || vscodeSuccess) {
        this.showConfigurationSummary(config)
        this.log('MCP configuration completed successfully!', 'success')

        // Save environment variables to local .env file for reference
        if (Object.keys(envVars).length > 0) {
          const envPath = path.join(this.projectRoot, '.env')
          const envContent = Object.entries(envVars)
            .map(([key, value]) => `${key}="${value}"`)
            .join('\n')

          fs.writeFileSync(envPath, envContent)
          this.log(`Environment variables saved to: ${envPath}`, 'info')
        }
      }
      else {
        this.log('Configuration setup failed!', 'error')
        process.exit(1)
      }
    }
    catch (error) {
      this.log(`Configuration failed: ${error.message}`, 'error')
      process.exit(1)
    }
  }

  async backup() {
    this.log('Creating configuration backup...')

    const backupDir = path.join(this.projectRoot, 'config-backups')
    await this.ensureDirectoryExists(backupDir)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupName = `config-backup-${timestamp}`
    const backupPath = path.join(backupDir, backupName)

    const configs = [
      { name: 'claude-desktop', path: this.claudeConfigPath },
      { name: 'vscode', path: this.vscodeConfigDir },
    ]

    let backedUp = 0
    for (const config of configs) {
      if (fs.existsSync(config.path)) {
        const backupFile = path.join(backupPath, `${config.name}.json`)
        await this.ensureDirectoryExists(path.dirname(backupFile))
        fs.copyFileSync(config.path, backupFile)
        backedUp++
      }
    }

    if (backedUp > 0) {
      this.log(`Configurations backed up to: ${backupPath}`, 'success')
    }
    else {
      this.log('No configurations found to backup', 'info')
    }
  }
}

// Command line interface
if (require.main === module) {
  const manager = new ConfigManager()

  if (process.argv.includes('--backup')) {
    manager.backup()
  }
  else {
    manager.run().catch((error) => {
      console.error('❌ Configuration failed:', error)
      process.exit(1)
    })
  }
}

module.exports = ConfigManager
