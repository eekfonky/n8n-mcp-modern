#!/usr/bin/env node

/**
 * Smart MCP Installation Script
 * Automatically detects project context and installs with appropriate scope
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const N8N_API_URL = process.env.N8N_API_URL || 'https://your-n8n-instance.com'
const N8N_API_KEY = process.env.N8N_API_KEY || 'your-api-key'

// Input validation functions
function validateEnvironmentValue(value) {
  if (typeof value !== 'string') {
    throw new Error('Environment value must be a string')
  }
  // Prevent command injection by checking for dangerous characters
  if (value.includes(';') || value.includes('&') || value.includes('|') || value.includes('`')) {
    throw new Error('Invalid characters in environment value')
  }
  return value
}

// Safe command execution with spawn
function safeExecCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: options.stdio || 'pipe',
      encoding: 'utf8',
      ...options
    })
    
    let stdout = ''
    let stderr = ''
    
    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data
      })
    }
    
    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data
      })
    }
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        const error = new Error(`Command failed with code ${code}`)
        error.stdout = stdout
        error.stderr = stderr
        reject(error)
      }
    })
    
    proc.on('error', (error) => {
      reject(error)
    })
  })
}

function detectInstallationScope() {
  // Check if we're in a project directory with .mcp.json
  const mcpJsonPath = join(process.cwd(), '.mcp.json')

  if (existsSync(mcpJsonPath)) {
    console.log(
      '📦 Detected .mcp.json file - installing as project-scoped MCP server',
    )
    return 'project'
  }

  // Check if this looks like a development project
  const packageJsonPath = join(process.cwd(), 'package.json')
  const gitPath = join(process.cwd(), '.git')

  if (existsSync(packageJsonPath) || existsSync(gitPath)) {
    console.log(
      '🏗️  Detected project directory - installing as project-scoped MCP server',
    )
    console.log('💡 This will create/update .mcp.json for team sharing')
    return 'project'
  }

  console.log(
    '🌍 No project context detected - installing as global MCP server',
  )
  return 'local'
}

async function checkExistingInstallation() {
  try {
    // Check global Claude MCP config
    const result = await safeExecCommand('claude', ['mcp', 'list'])
    if (result.includes('n8n-mcp-modern')) {
      return true
    }
  }
  catch (error) {
    // Claude MCP command failed, continue checking
    console.log('Debug: Claude MCP list command failed:', error.message)
  }

  // Check for project-level .mcp.json
  try {
    const mcpJsonPath = join(process.cwd(), '.mcp.json')
    if (existsSync(mcpJsonPath)) {
      const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf8'))
      if (mcpConfig.mcpServers && mcpConfig.mcpServers['n8n-mcp-modern']) {
        return true
      }
    }
  }
  catch {
    // .mcp.json doesn't exist or is invalid, continue
  }

  return false
}

/**
 * Extract existing environment variables from MCP configuration
 * This preserves user's n8n API credentials during upgrades
 */
async function extractExistingEnvVars() {
  const envVars = {}

  // Try to read from project-level .mcp.json first
  try {
    const mcpJsonPath = join(process.cwd(), '.mcp.json')
    if (existsSync(mcpJsonPath)) {
      const content = readFileSync(mcpJsonPath, 'utf8')
      const mcpConfig = JSON.parse(content)
      if (typeof mcpConfig !== 'object' || mcpConfig === null) {
        throw new Error('Invalid JSON structure in .mcp.json')
      }
      const n8nServer = mcpConfig.mcpServers?.['n8n-mcp-modern']
      if (n8nServer?.env) {
        // Validate extracted environment variables
        for (const [key, value] of Object.entries(n8nServer.env)) {
          try {
            envVars[key] = validateEnvironmentValue(value)
          } catch (error) {
            console.log(`Warning: Skipping invalid env var ${key}: ${error.message}`)
          }
        }
      }
    }
  }
  catch (error) {
    console.log('Debug: Failed to read project config:', error.message)
  }

  // If no project config found, try global config via claude mcp list
  if (Object.keys(envVars).length === 0) {
    try {
      const result = await safeExecCommand('claude', ['mcp', 'list', '--json'])
      const config = JSON.parse(result)
      if (typeof config !== 'object' || config === null) {
        throw new Error('Invalid JSON response from claude mcp list')
      }
      const n8nServer = config.servers?.['n8n-mcp-modern']
      if (n8nServer?.env) {
        // Validate extracted environment variables
        for (const [key, value] of Object.entries(n8nServer.env)) {
          try {
            envVars[key] = validateEnvironmentValue(value)
          } catch (error) {
            console.log(`Warning: Skipping invalid env var ${key}: ${error.message}`)
          }
        }
      }
    }
    catch (error) {
      console.log('Debug: Global config extraction failed:', error.message)
    }
  }

  return envVars
}

async function validateEnvironment() {
  // Check if already installed (might be an upgrade)
  const isInstalled = await checkExistingInstallation()

  if (isInstalled) {
    console.log('🔄 Detected existing n8n-MCP Modern installation')
    console.log(
      '📦 Performing smart upgrade (preserving your configuration)...',
    )
    console.log('')
    return true // Allow proceed with existing config
  }

  // For fresh installs, warn about environment variables but allow installation
  if (
    N8N_API_URL === 'https://your-n8n-instance.com'
    || N8N_API_KEY === 'your-api-key'
  ) {
    console.log(
      '⚠️  N8N_API_URL and N8N_API_KEY environment variables not configured',
    )
    console.log('')
    console.log(
      'The MCP server will install successfully but will run in offline mode.',
    )
    console.log(
      'To enable n8n API integration, set these environment variables:',
    )
    console.log('')
    console.log('Example:')
    console.log('export N8N_API_URL="https://your-n8n-instance.com"')
    console.log('export N8N_API_KEY="your-jwt-token"')
    console.log('')
    console.log('Or run with:')
    console.log(
      'N8N_API_URL="https://..." N8N_API_KEY="..." npx @eekfonky/n8n-mcp-modern install',
    )
    console.log('')
    console.log('Proceeding with fresh installation in offline mode...')
    console.log('')
    return false // Fresh install without env vars
  }

  console.log('✅ Environment configured - proceeding with fresh installation')
  console.log('')
  return false // Fresh install with env vars
}

async function main() {
  console.log('🚀 n8n-MCP Modern - Smart Install/Upgrade')
  console.log('')

  const isUpgrade = await validateEnvironment()
  const scope = detectInstallationScope()

  // Build command with preserved environment variables
  const commandParts = ['claude mcp add n8n-mcp-modern', `--scope ${scope}`]

  // For upgrades, extract and preserve existing environment variables
  let envVarsToAdd = {}
  if (isUpgrade) {
    envVarsToAdd = await extractExistingEnvVars()
    console.log('🔐 Preserving existing API credentials from configuration')
  }
  else if (N8N_API_URL !== 'https://your-n8n-instance.com') {
    // For fresh installs, use environment variables if available (with validation)
    try {
      envVarsToAdd = {
        N8N_API_URL: validateEnvironmentValue(N8N_API_URL),
        N8N_API_KEY: validateEnvironmentValue(N8N_API_KEY),
      }
    } catch (error) {
      console.log(`Warning: Environment variable validation failed: ${error.message}`)
      envVarsToAdd = {}
    }
  }

  // Add environment variables to command (with validation)
  Object.entries(envVarsToAdd).forEach(([key, value]) => {
    if (value && value.trim() !== '') {
      try {
        const validatedValue = validateEnvironmentValue(value)
        commandParts.push(`--env ${key}="${validatedValue}"`)
      } catch (error) {
        console.log(`Warning: Skipping invalid environment variable ${key}: ${error.message}`)
      }
    }
  })

  commandParts.push('-- npx -y @eekfonky/n8n-mcp-modern')
  const command = commandParts.join(' ')

  console.log('📋 Running command:')
  console.log(`   ${command}`)
  console.log('')

  try {
    await safeExecCommand('claude', ['mcp', 'add', 'n8n-mcp-modern', `--scope`, scope, ...Object.entries(envVarsToAdd).flatMap(([key, value]) => {
      if (value && value.trim() !== '') {
        try {
          const validatedValue = validateEnvironmentValue(value)
          return [`--env`, `${key}=${validatedValue}`]
        } catch (error) {
          console.log(`Warning: Skipping invalid environment variable ${key}: ${error.message}`)
          return []
        }
      }
      return []
    }), '--', 'npx', '-y', '@eekfonky/n8n-mcp-modern'], { stdio: 'inherit' })
    console.log('')
    if (isUpgrade) {
      console.log('✅ Upgrade completed successfully!')
      console.log('🎉 Your n8n-MCP Modern installation is now up to date')
    }
    else {
      console.log('✅ Installation completed successfully!')
    }

    if (scope === 'project') {
      console.log(
        '📄 MCP server added to .mcp.json (commit this file for team sharing)',
      )
    }
    else {
      console.log('🔧 MCP server added to global configuration')
    }

    console.log('')
    console.log('🔍 Verify installation with: claude mcp list')
  }
  catch (error) {
    const errorMessage = error?.message || 'Unknown error occurred'
    console.log('🐛 Debug - Error message:', errorMessage)

    // Handle case where server already exists - for upgrades, remove and re-add
    const isServerExistsError
      = errorMessage.includes('already exists')
        || errorMessage.includes('MCP server')
        || (errorMessage.includes('server') && errorMessage.includes('exists'))
        || (errorMessage.includes('claude mcp add')
          && errorMessage.includes('Command failed'))

    if (isServerExistsError) {
      if (isUpgrade) {
        console.log('')
        console.log(
          '🔄 Performing seamless upgrade (removing old, adding new)...',
        )

        try {
          // Extract environment variables before removal
          const preservedEnvVars = await extractExistingEnvVars()

          // Remove existing installation
          await safeExecCommand('claude', ['mcp', 'remove', 'n8n-mcp-modern', '--scope', scope], { stdio: 'pipe' })
          console.log('✅ Removed existing installation')

          // Add new installation with preserved environment variables
          const envArgs = Object.entries(preservedEnvVars).flatMap(([key, value]) => {
            if (value && value.trim() !== '') {
              try {
                const validatedValue = validateEnvironmentValue(value)
                return [`--env`, `${key}=${validatedValue}`]
              } catch (error) {
                console.log(`Warning: Skipping invalid environment variable ${key}: ${error.message}`)
                return []
              }
            }
            return []
          })
          
          await safeExecCommand('claude', ['mcp', 'add', 'n8n-mcp-modern', '--scope', scope, ...envArgs, '--', 'npx', '-y', '@eekfonky/n8n-mcp-modern'], { stdio: 'inherit' })
          console.log('')
          console.log('✅ Upgrade completed successfully!')
          console.log('🎉 Your n8n-MCP Modern installation is now up to date')

          if (scope === 'project') {
            console.log('📄 MCP server updated in .mcp.json')
          }
          else {
            console.log('🔧 MCP server updated in global configuration')
          }

          console.log('')
          console.log('🔍 Verify upgrade with: claude mcp list')
          return
        }
        catch (upgradeError) {
          const upgradeErrorMessage = upgradeError?.message || 'Unknown upgrade error'
          console.error('❌ Seamless upgrade failed:', upgradeErrorMessage)
          console.error('')
          console.error('🔧 Manual upgrade steps:')
          console.error(`   claude mcp remove n8n-mcp-modern --scope ${scope}`)
          console.error(`   ${command}`)
          process.exit(1)
        }
      }
      else {
        console.log('')
        console.log('ℹ️  MCP server already configured!')
        console.log('')
        console.log('To update configuration:')
        console.log(`   claude mcp remove n8n-mcp-modern --scope ${scope}`)
        console.log(`   ${command}`)
        console.log('')
        console.log('🔍 Current status: claude mcp list')
        return
      }
    }

    console.error('❌ Installation failed:', errorMessage)
    console.error('')
    console.error('💡 Try running manually:')
    console.error(`   ${command}`)
    process.exit(1)
  }
}

main()
