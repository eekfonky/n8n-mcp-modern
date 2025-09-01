#!/usr/bin/env node

/**
 * Interactive First-Time Setup for n8n-MCP Modern
 * Guides users through configuration of n8n URL and API key
 */

const { spawn } = require('node:child_process')
const fs = require('node:fs')
// Removed unused os import
const path = require('node:path')
const process = require('node:process')
const readline = require('node:readline')

/**
 * Create readline interface for user input
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

/**
 * Prompt user for input with validation
 */
function prompt(question, validator, defaultValue) {
  return new Promise((resolve) => {
    const rl = createInterface()

    const askQuestion = () => {
      const questionWithDefault = defaultValue
        ? `${question} (default: ${defaultValue}): `
        : `${question}: `

      rl.question(questionWithDefault, (answer) => {
        const value = answer.trim() || defaultValue

        if (validator) {
          const validation = validator(value)
          if (!validation.valid) {
            console.log(`❌ ${validation.message}`)
            askQuestion()
            return
          }
        }

        rl.close()
        resolve(value)
      })
    }

    askQuestion()
  })
}

/**
 * Validators for user input
 */
const validators = {
  url: (value) => {
    if (!value) {
      return { valid: false, message: 'URL is required' }
    }

    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { valid: false, message: 'URL must use http:// or https://' }
      }
      return { valid: true }
    }
    catch {
      return { valid: false, message: 'Please enter a valid URL (e.g., https://your-n8n.com)' }
    }
  },

  apiKey: (value) => {
    if (!value) {
      return { valid: false, message: 'API key is required' }
    }

    if (value.length < 10) {
      return { valid: false, message: 'API key seems too short. Please check your n8n API key.' }
    }

    return { valid: true }
  },

  yesNo: (value) => {
    const normalized = value.toLowerCase()
    if (!['y', 'n', 'yes', 'no'].includes(normalized)) {
      return { valid: false, message: 'Please enter y/yes or n/no' }
    }
    return { valid: true }
  },
}

/**
 * Test n8n API connectivity
 */
async function testN8nConnection(apiUrl, apiKey) {
  return new Promise((resolve) => {
    console.log('🔍 Testing n8n API connectivity...')

    // Normalize URL
    let normalizedUrl = apiUrl.replace(/\/$/, '')
    if (!normalizedUrl.includes('/api/v1')) {
      normalizedUrl += '/api/v1'
    }

    const proc = spawn('curl', [
      '-s',
      '-w',
      '%{http_code}',
      '-o',
      '/dev/null',
      '-H',
      `Authorization: Bearer ${apiKey}`,
      '-H',
      'Accept: application/json',
      `${normalizedUrl}/workflows`,
      '--max-time',
      '10',
    ])

    let stdout = ''
    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.on('close', (_code) => {
      const httpCode = stdout.trim()

      if (httpCode === '200') {
        console.log('✅ n8n API connection successful!')
        resolve({ success: true, httpCode })
      }
      else if (httpCode === '401') {
        console.log('❌ Authentication failed (401). Please check your API key.')
        resolve({ success: false, error: 'authentication', httpCode })
      }
      else if (httpCode === '404') {
        console.log('❌ API endpoint not found (404). Please check your n8n URL.')
        resolve({ success: false, error: 'not-found', httpCode })
      }
      else {
        console.log(`⚠️  Unexpected response (${httpCode}). Connection may have issues.`)
        resolve({ success: false, error: 'unexpected', httpCode })
      }
    })

    proc.on('error', () => {
      console.log('❌ Failed to test connection (curl not available or network error)')
      resolve({ success: false, error: 'network' })
    })
  })
}

/**
 * Detect n8n setup based on common configurations
 */
function detectN8nSetup() {
  console.log('🔍 Looking for existing n8n configuration...')

  // Common n8n locations and patterns
  const possibleUrls = []

  // Check environment variables
  if (process.env.N8N_HOST) {
    const protocol = process.env.N8N_PROTOCOL || 'https'
    const port = process.env.N8N_PORT ? `:${process.env.N8N_PORT}` : ''
    possibleUrls.push(`${protocol}://${process.env.N8N_HOST}${port}`)
  }

  if (process.env.WEBHOOK_URL) {
    const webhookUrl = process.env.WEBHOOK_URL
    const baseUrl = webhookUrl.replace(/\/webhook\/.*$/, '')
    possibleUrls.push(baseUrl)
  }

  // Common local development URLs
  possibleUrls.push('http://localhost:5678', 'http://127.0.0.1:5678')

  if (possibleUrls.length > 0) {
    console.log('💡 Found potential n8n URLs:')
    possibleUrls.forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`)
    })
  }

  return possibleUrls
}

/**
 * Get n8n API key instructions
 */
function showApiKeyInstructions() {
  console.log('\n📋 How to get your n8n API Key:')
  console.log('')
  console.log('1. Open your n8n instance in a web browser')
  console.log('2. Go to Settings → Personal → API Keys')
  console.log('3. Click "Create API Key"')
  console.log('4. Give it a name (e.g., "MCP Integration")')
  console.log('5. Copy the generated API key')
  console.log('')
  console.log('💡 Alternative: Use your n8n JWT token from browser cookies')
  console.log('   (Found in Developer Tools → Application → Cookies → n8n-auth)')
  console.log('')
}

/**
 * Create configuration file
 */
async function createConfiguration(config, scope = 'local') {
  try {
    if (scope === 'project') {
      // Create .mcp.json in current directory
      const mcpConfig = {
        mcpServers: {
          'n8n-mcp-modern': {
            command: 'npx',
            args: ['-y', '@eekfonky/n8n-mcp-modern'],
            env: {
              N8N_API_URL: config.apiUrl,
              N8N_API_KEY: config.apiKey,
              LOG_LEVEL: config.logLevel || 'info',
              ENABLE_CACHE: 'true',
            },
          },
        },
      }

      const configPath = path.join(process.cwd(), '.mcp.json')
      fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2))
      console.log(`✅ Created project configuration: ${configPath}`)
      return { success: true, path: configPath, type: 'project' }
    }
    else {
      // Use Claude Code global configuration via claude mcp command
      console.log('🔄 Adding to Claude Code global configuration...')

      try {
        // Use the same approach as the install script
        const { spawn } = require('node:child_process')

        const addCommand = spawn('claude', [
          'mcp',
          'add',
          'n8n-mcp-modern',
          '--scope',
          'local',
          '--env',
          `N8N_API_URL=${config.apiUrl}`,
          '--env',
          `N8N_API_KEY=${config.apiKey}`,
          '--env',
          `LOG_LEVEL=${config.logLevel || 'info'}`,
          '--env',
          'ENABLE_CACHE=true',
          '--',
          'npx',
          '-y',
          '@eekfonky/n8n-mcp-modern',
        ], {
          stdio: 'inherit',
        })

        return new Promise((resolve) => {
          addCommand.on('close', (code) => {
            if (code === 0) {
              console.log('✅ Added to Claude Code global configuration')
              resolve({ success: true, path: 'Claude Code global config', type: 'claude-code-global' })
            }
            else {
              console.log('⚠️  Failed to add to Claude Code global config, falling back to manual instructions')
              resolve({ success: false, error: `claude mcp command failed with code ${code}` })
            }
          })

          addCommand.on('error', (error) => {
            console.log('⚠️  Claude CLI not available, providing manual instructions')
            resolve({ success: false, error: error.message })
          })
        })
      }
      catch (error) {
        console.log('⚠️  Could not add to Claude Code global config:', error.message)
        return { success: false, error: error.message }
      }
    }
  }
  catch (error) {
    console.error('❌ Failed to create configuration:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Main interactive setup
 */
async function runInteractiveSetup() {
  console.log('🚀 n8n-MCP Modern - Interactive Setup')
  console.log('='.repeat(50))
  console.log('')
  console.log('Welcome! Let\'s configure your n8n integration.')
  console.log('')

  // Step 1: Detect existing setup
  const detectedUrls = detectN8nSetup()

  // Step 2: Get n8n URL
  console.log('📡 Step 1: n8n Instance Configuration')
  console.log('')

  let apiUrl
  if (detectedUrls.length > 0) {
    console.log('We found some potential n8n URLs. You can:')
    console.log('1. Use one of the detected URLs')
    console.log('2. Enter a different URL')
    console.log('')

    const useDetected = await prompt('Use a detected URL? (y/n)', validators.yesNo, 'y')

    if (['y', 'yes'].includes(useDetected.toLowerCase())) {
      if (detectedUrls.length === 1) {
        apiUrl = detectedUrls[0]
        console.log(`Using: ${apiUrl}`)
      }
      else {
        console.log('\nSelect a URL:')
        detectedUrls.forEach((url, i) => {
          console.log(`${i + 1}. ${url}`)
        })

        const selection = await prompt(`Choose (1-${detectedUrls.length})`, (value) => {
          const num = Number.parseInt(value)
          if (Number.isNaN(num) || num < 1 || num > detectedUrls.length) {
            return { valid: false, message: `Please choose a number between 1 and ${detectedUrls.length}` }
          }
          return { valid: true }
        })

        apiUrl = detectedUrls[Number.parseInt(selection) - 1]
      }
    }
  }

  if (!apiUrl) {
    console.log('Enter your n8n instance URL:')
    console.log('Examples: https://n8n.yourdomain.com, http://localhost:5678')
    apiUrl = await prompt('n8n URL', validators.url)
  }

  // Step 3: Get API key
  console.log('')
  console.log('🔑 Step 2: API Authentication')
  showApiKeyInstructions()

  const apiKey = await prompt('n8n API Key', validators.apiKey)

  // Step 4: Test connection
  console.log('')
  console.log('🔍 Step 3: Testing Connection')
  const connectionTest = await testN8nConnection(apiUrl, apiKey)

  if (!connectionTest.success) {
    console.log('')
    console.log('⚠️  Connection test failed, but you can still proceed.')
    console.log('   The configuration will be saved and you can fix the connection later.')
    console.log('')

    const proceed = await prompt('Continue with configuration? (y/n)', validators.yesNo, 'y')
    if (!['y', 'yes'].includes(proceed.toLowerCase())) {
      console.log('Setup cancelled.')
      process.exit(0)
    }
  }

  // Step 5: Choose scope
  console.log('')
  console.log('📦 Step 4: Installation Scope')
  console.log('')
  console.log('Choose installation scope:')
  console.log('1. Project (team-shared, creates .mcp.json in current directory)')
  console.log('2. Global (your user only, uses Claude Code global config)')
  console.log('')

  const scopeChoice = await prompt('Choose scope (1-2)', (value) => {
    const num = Number.parseInt(value)
    if (![1, 2].includes(num)) {
      return { valid: false, message: 'Please choose 1 or 2' }
    }
    return { valid: true }
  }, '1') // Default to project scope for Claude Code

  const scope = scopeChoice === '1' ? 'project' : 'local'

  // Step 6: Additional options
  console.log('')
  console.log('⚙️  Step 5: Additional Options')
  const logLevel = await prompt('Log level (debug/info/warn/error)', (value) => {
    if (!['debug', 'info', 'warn', 'error'].includes(value)) {
      return { valid: false, message: 'Please choose: debug, info, warn, or error' }
    }
    return { valid: true }
  }, 'info')

  // Step 7: Create configuration
  console.log('')
  console.log('💾 Step 6: Creating Configuration')
  const config = { apiUrl, apiKey, logLevel }
  const configResult = await createConfiguration(config, scope)

  if (configResult.success) {
    console.log('')
    console.log('🎉 Setup Complete!')
    console.log('='.repeat(50))
    console.log(`✅ Configuration saved: ${configResult.path}`)
    console.log(`🔧 Scope: ${scope}`)
    console.log(`📡 n8n URL: ${apiUrl}`)
    console.log(`🔑 API Key: ${'*'.repeat(Math.min(apiKey.length, 8))}`)
    console.log('')
    console.log('🚀 Next Steps:')
    if (scope === 'project') {
      console.log('1. Share .mcp.json with your team (commit to git)')
      console.log('2. Team members can use: claude mcp install')
    }
    else {
      console.log('1. Configuration active in Claude Code immediately')
    }
    console.log('2. Test the integration: claude mcp list')
    console.log('3. Run health check: npm run mcp:health')
    console.log('4. Start using n8n tools in Claude Code!')
    console.log('')
    console.log('💡 Need help? Check INSTALLATION.md for troubleshooting')
  }
  else {
    console.log('')
    console.log('❌ Setup Failed')
    console.error('Configuration creation failed:', configResult.error)
    console.log('')
    console.log('🔧 Manual setup required:')
    console.log(`1. Create configuration file with these values:`)
    console.log(`   N8N_API_URL: ${apiUrl}`)
    console.log(`   N8N_API_KEY: ${apiKey}`)
    console.log('2. See config-templates/ for examples')
    process.exit(1)
  }
}

// Export for use by other scripts
module.exports = {
  runInteractiveSetup,
  testN8nConnection,
  createConfiguration,
  detectN8nSetup,
}

// Run if called directly
if (require.main === module) {
  runInteractiveSetup().catch((error) => {
    console.error('\n❌ Setup failed:', error.message)
    console.log('\n🔧 For manual setup, see: config-templates/README.md')
    process.exit(1)
  })
}
