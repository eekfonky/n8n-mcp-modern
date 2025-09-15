#!/usr/bin/env node
/**
 * README.md Validation Script
 * Ensures README.md is current and accurate before pushes
 */

const fs = require('node:fs')
const process = require('node:process')

// Get current version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const currentVersion = packageJson.version

// Read README.md
const readmePath = 'README.md'
const readmeContent = fs.readFileSync(readmePath, 'utf8')

console.log('🔍 Validating README.md...')

const errors = []
const warnings = []

// 1. Check version badge
const versionBadgePattern
  = /\[!\[npm version\]\(https:\/\/img\.shields\.io\/npm\/v\/@eekfonky\/n8n-mcp-modern\.svg\)\]/
const versionMatch = readmeContent.match(versionBadgePattern)

if (!versionMatch) {
  warnings.push('⚠️ NPM version badge not found in README.md (this is automatically updated by npmjs.org)')
}

// 2. Check installation commands have current package references
const npmCommands = readmeContent.match(/(@eekfonky\/n8n-mcp-modern|npx.*@eekfonky)/g)
if (!npmCommands || npmCommands.length === 0) {
  warnings.push('⚠️ No npm installation commands found')
}

// 3. Check for outdated version references
const oldVersionRefs = readmeContent.match(/v4\.[0-5]\.\d+/g)
if (oldVersionRefs) {
  warnings.push(
    `⚠️ Found references to old versions: ${oldVersionRefs.join(', ')}`,
  )
}

// 4. Check for essential sections
const requiredSections = [
  'Installation',
  'Architecture',
  'Configuration',
  'Testing',
]

requiredSections.forEach((section) => {
  if (!readmeContent.toLowerCase().includes(section.toLowerCase())) {
    warnings.push(`⚠️ Missing section: ${section}`)
  }
})

// 5. Check for new unified script references
const newScriptCommands = [
  'npm run install',
  'npm run config',
  'npm run health',
  'npm run update'
]

newScriptCommands.forEach((command) => {
  if (!readmeContent.includes(command)) {
    warnings.push(`⚠️ Missing new script command: ${command}`)
  }
})

// 6. Check for removal of old commands
const deprecatedCommands = [
  'mcp:install',
  'mcp:setup',
  'auto-update',
  'setup-github-packages'
]

deprecatedCommands.forEach((command) => {
  if (readmeContent.includes(command)) {
    errors.push(`❌ Found deprecated command that should be removed: ${command}`)
  }
})

// 7. Check environment variable examples
if (
  !readmeContent.includes('N8N_API_URL')
  || !readmeContent.includes('N8N_API_KEY')
) {
  errors.push(
    '❌ Missing environment variable examples (N8N_API_URL, N8N_API_KEY)',
  )
}

// 8. Check for unified config template references (relaxed check)
if (!readmeContent.includes('unified') && !readmeContent.includes('config-templates')) {
  warnings.push('⚠️ Missing reference to unified configuration template')
}

// 9. Validate test structure references
if (!readmeContent.includes('tests/unit') || !readmeContent.includes('tests/integration') || !readmeContent.includes('tests/behavioral')) {
  warnings.push('⚠️ Missing references to new test structure (tests/unit, tests/integration, tests/behavioral)')
}

// Report results
console.log('\n📋 Validation Results:')

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ README.md is up-to-date and accurate!')
  process.exit(0)
}

if (errors.length > 0) {
  console.log('\n🚨 ERRORS (must fix before push):')
  errors.forEach(error => console.log(`  ${error}`))
}

if (warnings.length > 0) {
  console.log('\n⚠️ WARNINGS (recommended fixes):')
  warnings.forEach(warning => console.log(`  ${warning}`))
}

console.log('\n💡 Tips:')
console.log('  • Update script references to new unified commands')
console.log('  • Remove deprecated script names from examples')
console.log('  • Reference unified-mcp-config.json template')
console.log('  • Update test structure documentation')
console.log('  • Ensure simplified installation instructions are current')
console.log('  • Run: npm run validate-readme to check again')

if (errors.length > 0) {
  console.log(
    '\n❌ README validation failed. Please fix errors before pushing.',
  )
  process.exit(1)
}
else {
  console.log('\n✅ README validation passed with warnings.')
  process.exit(0)
}
