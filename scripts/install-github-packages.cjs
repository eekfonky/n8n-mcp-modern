#!/usr/bin/env node

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/**
 * Installation script for n8n-mcp-modern from GitHub Packages
 * Handles authentication setup with comprehensive validation
 */

// Import authentication validator
const { validateGitHubAuthentication } = require('./validate-github-auth.cjs')

console.log('📦 n8n-mcp-modern GitHub Packages Installation Helper')
console.log('='.repeat(60))

const homeDir = os.homedir()
const npmrcPath = path.join(homeDir, '.npmrc')
const templatePath = path.join(__dirname, '..', '.npmrc.template')

// Check if .npmrc exists and has GitHub Packages configuration (local fallback)
function checkNpmrcConfigurationLocal() {
  try {
    if (!fs.existsSync(npmrcPath)) {
      return false
    }

    const npmrcContent = fs.readFileSync(npmrcPath, 'utf8')
    return npmrcContent.includes('@eekfonky:registry=https://npm.pkg.github.com/')
  }
  catch {
    return false
  }
}

// Setup .npmrc configuration
function setupNpmrc() {
  console.log('\n🔧 Setting up .npmrc configuration...')

  try {
    if (!fs.existsSync(templatePath)) {
      console.error('❌ .npmrc.template not found. Please run from the project root.')
      return false
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8')

    if (fs.existsSync(npmrcPath)) {
      console.log('⚠️  .npmrc already exists. Backing up to .npmrc.backup')
      fs.copyFileSync(npmrcPath, `${npmrcPath}.backup`)

      // Append to existing .npmrc
      const existingContent = fs.readFileSync(npmrcPath, 'utf8')
      if (!existingContent.includes('@eekfonky:registry=https://npm.pkg.github.com/')) {
        fs.appendFileSync(npmrcPath, `\n\n${templateContent}`)
        console.log('✅ Configuration appended to existing .npmrc')
      }
      else {
        console.log('✅ Configuration already present in .npmrc')
      }
    }
    else {
      // Create new .npmrc
      fs.writeFileSync(npmrcPath, templateContent)
      console.log('✅ Created new .npmrc configuration')
    }

    return true
  }
  catch (error) {
    console.error('❌ Failed to setup .npmrc:', error.message)
    return false
  }
}

// Provide installation instructions
function provideInstructions() {
  console.log('\n📋 Next Steps:')
  console.log('1. Generate a GitHub Personal Access Token:')
  console.log('   https://github.com/settings/tokens')
  console.log('   Required scopes: read:packages')
  console.log('')
  console.log('2. Edit ~/.npmrc and replace YOUR_GITHUB_TOKEN with your actual token')
  console.log('')
  console.log('3. Install the package:')
  console.log('   npm install -g @eekfonky/n8n-mcp-modern')
  console.log('')
  console.log('4. Add to Claude Code:')
  console.log('   claude mcp add n8n-mcp-modern \\\\')
  console.log('     --env N8N_API_URL="https://your-n8n.com" \\\\')
  console.log('     --env N8N_API_KEY="your-key" \\\\')
  console.log('     -- npx @eekfonky/n8n-mcp-modern')
}

// Alternative installation methods
function provideAlternatives() {
  console.log('\n🔄 Alternative Installation Methods:')
  console.log('')
  console.log('Method 1: Direct from GitHub (requires git and build tools):')
  console.log('  git clone https://github.com/eekfonky/n8n-mcp-modern.git')
  console.log('  cd n8n-mcp-modern')
  console.log('  npm install')
  console.log('  npm run build')
  console.log('  npm install -g .')
  console.log('')
  console.log('Method 2: Using npx (temporary usage):')
  console.log('  npx @eekfonky/n8n-mcp-modern')
  console.log('  (requires GitHub Packages authentication)')
}

// Main execution with comprehensive validation
async function main() {
  console.log('\n🔍 Running comprehensive GitHub Packages validation...')

  try {
    const results = await validateGitHubAuthentication(true)

    if (results.overall) {
      console.log('\n✅ All validation checks passed!')
      console.log('Your system is ready for seamless n8n-mcp-modern installation.')
      console.log('\n🚀 You can now install with:')
      console.log('   npm install -g @eekfonky/n8n-mcp-modern')
      console.log('   npx @eekfonky/n8n-mcp-modern')
      console.log('   node scripts/install-mcp.js')
      return
    }

    console.log('\n⚠️  Validation identified issues that need to be resolved.')
    console.log('The validator has provided specific guidance above.')
  }
  catch (error) {
    console.error('\n❌ Validation failed with error:', error.message)
    console.log('\n🔄 Falling back to legacy setup process...')

    // Fallback to original logic
    const configCheck = checkNpmrcConfigurationLocal()

    if (configCheck.configured) {
      console.log('✅ GitHub Packages configuration already present')
      console.log('\n🚀 You can now install with:')
      console.log('npm install -g @eekfonky/n8n-mcp-modern')
      return
    }

    console.log('⚙️  GitHub Packages authentication not configured')

    const setupSuccess = setupNpmrc()

    if (setupSuccess) {
      provideInstructions()
    }
    else {
      console.log('\n❌ Automatic setup failed. Manual configuration required:')
      provideAlternatives()
    }
  }

  console.log('\n📚 For more information, see:')
  console.log('https://github.com/eekfonky/n8n-mcp-modern#installation')
}

if (require.main === module) {
  main()
}

module.exports = { checkNpmrcConfigurationLocal, setupNpmrc }
