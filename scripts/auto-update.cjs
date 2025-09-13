#!/usr/bin/env node
/**
 * Auto-update utility for n8n-MCP Modern
 * Checks for latest version and updates .mcp.json configurations
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

class AutoUpdater {
  constructor(options = {}) {
    this.packageName = '@eekfonky/n8n-mcp-modern'
    this.silent = options.silent || false
    this.dryRun = options.dryRun || false
    this.forceUpdate = options.forceUpdate || false
    this.clearCache = options.clearCache !== false // Default to true
  }

  log(message, isError = false) {
    if (this.silent) return
    const prefix = isError ? '❌' : '🔄'
    console.log(`${prefix} ${message}`)
  }

  /**
   * Get the latest version from npm registry
   */
  async getLatestVersion() {
    try {
      // Create a clean environment without scoped registry config
      const cleanEnv = { ...process.env }
      delete cleanEnv.npm_config_registry

      const result = execSync(`npm view ${this.packageName} version --registry https://registry.npmjs.org`, {
        encoding: 'utf8',
        timeout: 10000,
        stdio: 'pipe',
        env: cleanEnv,
        cwd: '/tmp' // Run from a directory without .npmrc
      })
      return result.trim()
    } catch (error) {
      this.log(`Failed to fetch latest version: ${error.message}`, true)
      return null
    }
  }

  /**
   * Get current version from package.json
   */
  getCurrentVersion() {
    try {
      const packagePath = path.join(__dirname, '..', 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
      return packageJson.version
    } catch (error) {
      this.log(`Failed to read current version: ${error.message}`, true)
      return null
    }
  }

  /**
   * Find all .mcp.json files in common locations
   */
  findMcpConfigs() {
    const possibleLocations = [
      // Current directory
      '.mcp.json',
      // User home
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.mcp.json'),
      // Claude desktop config locations
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'claude', '.mcp.json'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', 'Library', 'Application Support', 'Claude', '.mcp.json'),
      path.join(process.env.APPDATA || '', 'Claude', '.mcp.json'),
      // Project root
      path.join(process.cwd(), '.mcp.json')
    ]

    const found = []
    for (const location of possibleLocations) {
      if (fs.existsSync(location)) {
        const resolved = path.resolve(location)
        if (!found.includes(resolved)) {
          found.push(resolved)
        }
      }
    }

    return found
  }

  /**
   * Check if a config uses our package and needs updating
   */
  analyzeConfig(configPath) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      const servers = config.mcpServers || {}

      const n8nServers = []
      for (const [name, serverConfig] of Object.entries(servers)) {
        if (serverConfig.args && serverConfig.args.some(arg => arg.includes('eekfonky/n8n-mcp-modern'))) {
          n8nServers.push({
            name,
            config: serverConfig,
            needsUpdate: true // We'll check version later
          })
        }
      }

      return {
        path: configPath,
        servers: n8nServers,
        hasN8nMcp: n8nServers.length > 0
      }
    } catch (error) {
      this.log(`Failed to read config ${configPath}: ${error.message}`, true)
      return null
    }
  }

  /**
   * Update a specific config file
   */
  updateConfig(configInfo, latestVersion) {
    try {
      const config = JSON.parse(fs.readFileSync(configInfo.path, 'utf8'))
      let updated = false

      for (const serverInfo of configInfo.servers) {
        const serverConfig = config.mcpServers[serverInfo.name]

        // Check if it's using a versioned package (contains @version)
        const currentArgs = serverConfig.args || []
        const packageArgIndex = currentArgs.findIndex(arg => arg.includes(this.packageName))

        if (packageArgIndex !== -1) {
          const currentArg = currentArgs[packageArgIndex]
          const newArg = `${this.packageName}@${latestVersion}`

          if (currentArg !== newArg || this.forceUpdate) {
            if (this.dryRun) {
              this.log(`Would update ${configInfo.path}: ${currentArg} → ${newArg}`)
            } else {
              currentArgs[packageArgIndex] = newArg
              config.mcpServers[serverInfo.name].args = currentArgs
              updated = true
              this.log(`Updated ${serverInfo.name} in ${configInfo.path}: ${currentArg} → ${newArg}`)
            }
          }
        }
      }

      if (updated && !this.dryRun) {
        // Create backup
        const backupPath = `${configInfo.path}.backup.${Date.now()}`
        fs.copyFileSync(configInfo.path, backupPath)
        this.log(`Backup created: ${backupPath}`)

        // Write updated config
        fs.writeFileSync(configInfo.path, JSON.stringify(config, null, 2))
        this.log(`Updated config: ${configInfo.path}`)
      }

      return updated
    } catch (error) {
      this.log(`Failed to update config ${configInfo.path}: ${error.message}`, true)
      return false
    }
  }

  /**
   * Clear npx cache for this package
   */
  clearNpxCache() {
    try {
      if (this.dryRun) {
        this.log('Would clear npx cache')
        return true
      }

      // Clear specific package from npx cache
      this.log('Clearing npx cache...')

      // Method 1: Try to clear specific package
      try {
        execSync(`npx clear-npx-cache`, {
          stdio: this.silent ? 'pipe' : 'inherit',
          timeout: 30000
        })
        this.log('✅ Cleared npx cache')
        return true
      } catch {
        // Method 2: Manual cache clearing
        const os = require('node:os')
        const npxCachePath = path.join(os.homedir(), '.npm', '_npx')

        if (fs.existsSync(npxCachePath)) {
          // Find and remove our package directories
          const cacheEntries = fs.readdirSync(npxCachePath)
          let removed = 0

          for (const entry of cacheEntries) {
            if (entry.includes('eekfonky') || entry.includes('n8n-mcp-modern')) {
              const fullPath = path.join(npxCachePath, entry)
              try {
                execSync(`rm -rf "${fullPath}"`, { stdio: 'pipe' })
                removed++
              } catch {
                // Continue with other entries
              }
            }
          }

          if (removed > 0) {
            this.log(`✅ Cleared ${removed} cached package entries`)
            return true
          }
        }
      }

      this.log('No cache entries found to clear')
      return true
    } catch (error) {
      this.log(`Warning: Failed to clear cache: ${error.message}`, true)
      return false // Don't fail the entire process
    }
  }

  /**
   * Clear npm package cache
   */
  clearNpmCache() {
    try {
      if (this.dryRun) {
        this.log('Would clear npm cache')
        return true
      }

      this.log('Clearing npm cache...')
      execSync(`npm cache clean --force`, {
        stdio: this.silent ? 'pipe' : 'inherit',
        timeout: 30000
      })
      this.log('✅ Cleared npm cache')
      return true
    } catch (error) {
      this.log(`Warning: Failed to clear npm cache: ${error.message}`, true)
      return false
    }
  }

  /**
   * Main update process
   */
  async run() {
    this.log('🔄 Starting auto-update check...')

    // Get versions
    const currentVersion = this.getCurrentVersion()
    const latestVersion = await this.getLatestVersion()

    if (!currentVersion || !latestVersion) {
      this.log('Failed to determine versions', true)
      return false
    }

    this.log(`Current version: ${currentVersion}`)
    this.log(`Latest version: ${latestVersion}`)

    // Check if update is needed
    if (currentVersion === latestVersion && !this.forceUpdate) {
      this.log('✅ Already using latest version')
      return true
    }

    if (currentVersion !== latestVersion) {
      this.log(`📦 New version available: ${currentVersion} → ${latestVersion}`)
    }

    // Find configs
    const configPaths = this.findMcpConfigs()
    if (configPaths.length === 0) {
      this.log('No .mcp.json files found')
      return true
    }

    this.log(`Found ${configPaths.length} config file(s)`)

    // Process each config
    let updatedCount = 0
    for (const configPath of configPaths) {
      const configInfo = this.analyzeConfig(configPath)
      if (configInfo && configInfo.hasN8nMcp) {
        this.log(`Processing: ${configPath}`)
        const updated = this.updateConfig(configInfo, latestVersion)
        if (updated) updatedCount++
      } else {
        this.log(`Skipping ${configPath} (no n8n-mcp-modern found)`)
      }
    }

    if (updatedCount > 0) {
      this.log(`✅ Updated ${updatedCount} config file(s)`)
      this.log('🔄 Claude Code will use the new version on next restart')
    } else {
      this.log('No updates needed')
    }

    // Clear caches to ensure fresh package downloads
    if (this.clearCache) {
      this.log('🧹 Cleaning up caches...')
      this.clearNpxCache()
      this.clearNpmCache()
    }

    return true
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const options = {
    silent: args.includes('--silent'),
    dryRun: args.includes('--dry-run'),
    forceUpdate: args.includes('--force'),
    clearCache: !args.includes('--no-cache')
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Auto-update utility for n8n-MCP Modern

Usage: node auto-update.cjs [options]

Options:
  --dry-run     Show what would be updated without making changes
  --force       Update configs even if versions match
  --silent      Run quietly (no output)
  --no-cache    Skip clearing npm/npx caches
  --help, -h    Show this help

Examples:
  node auto-update.cjs                    # Check, update configs, and clear caches
  node auto-update.cjs --dry-run          # Preview changes
  node auto-update.cjs --force            # Force update all configs
  node auto-update.cjs --no-cache         # Update without clearing caches
`)
    process.exit(0)
  }

  const updater = new AutoUpdater(options)
  const success = await updater.run()
  process.exit(success ? 0 : 1)
}

// Export for programmatic use
module.exports = AutoUpdater

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Auto-update failed:', error.message)
    process.exit(1)
  })
}