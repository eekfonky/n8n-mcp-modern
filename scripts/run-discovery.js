#!/usr/bin/env node
/**
 * Manual Discovery Runner
 *
 * Run node discovery on an active n8n instance
 */

import process from 'node:process'
import { ComprehensiveNodeDiscovery } from '../src/discovery/comprehensive-discovery.js'

async function runDiscovery() {
  try {
    // Verify n8n connection
    const n8nUrl = process.env.N8N_API_URL
    const n8nKey = process.env.N8N_API_KEY

    if (!n8nUrl || !n8nKey) {
      console.error('❌ Missing required environment variables:')
      console.error('   N8N_API_URL - Your n8n instance URL (e.g., https://n8n.example.com)')
      console.error('   N8N_API_KEY - Your n8n API key')
      console.error('')
      console.error('Set them with:')
      console.error('   export N8N_API_URL="https://your-n8n-instance.com"')
      console.error('   export N8N_API_KEY="your-api-key"')
      process.exit(1)
    }

    console.log('🔍 Starting n8n node discovery...')
    console.log(`📍 Target: ${n8nUrl}`)
    console.log(`🔑 API Key: ${n8nKey.substring(0, 8)}...`)
    console.log('')

    // Initialize discovery system
    const discovery = new ComprehensiveNodeDiscovery()

    // Run comprehensive discovery
    const startTime = Date.now()
    const stats = await discovery.runDiscovery()
    const duration = Date.now() - startTime

    // Display results
    console.log('✅ Discovery completed successfully!')
    console.log('')
    console.log('📊 Discovery Results:')
    console.log(`   Total nodes discovered: ${stats.nodesDiscovered}`)
    console.log(`   Standard n8n nodes: ${stats.standardNodes}`)
    console.log(`   Community nodes: ${stats.communityNodes}`)
    console.log(`   Custom nodes: ${stats.customNodes}`)
    console.log(`   Validated nodes: ${stats.totalValidated}`)
    console.log(`   Discovery time: ${duration}ms`)
    console.log('')

    // Update node count references automatically
    console.log('📝 Updating documentation node count references...')

    try {
      const { updateAllNodeCountReferences } = await import('../dist/scripts/update-node-count-references.js')
      await updateAllNodeCountReferences()
      console.log('✅ Documentation updated with new node counts')
    }
    catch (updateError) {
      console.log('⚠️  Documentation update failed (non-critical):', updateError.message)
    }

    console.log('')
    console.log('🎉 Discovery process complete!')
    console.log('')
    console.log('💡 To use discovered nodes:')
    console.log('   1. Start the MCP server: npm run start')
    console.log('   2. Use Claude Code with n8n-mcp-modern')
    console.log('   3. Ask agents about newly discovered capabilities')
  }
  catch (error) {
    console.error('❌ Discovery failed:', error.message)

    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
      console.error('')
      console.error('🔧 Connection troubleshooting:')
      console.error('   - Check that your n8n instance is running')
      console.error('   - Verify the N8N_API_URL is correct and accessible')
      console.error('   - Ensure the N8N_API_KEY has proper permissions')
      console.error('   - Check if n8n requires authentication headers')
    }

    process.exit(1)
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
n8n Node Discovery Runner

Usage: node run-discovery.js [options]

Environment Variables (required):
  N8N_API_URL     Your n8n instance URL
  N8N_API_KEY     Your n8n API key

Options:
  --help, -h      Show this help message

Example:
  export N8N_API_URL="https://n8n.example.com"
  export N8N_API_KEY="n8n_api_key_here"
  node run-discovery.js
  `)
  process.exit(0)
}

// Run discovery
runDiscovery().catch((error) => {
  console.error('Discovery script failed:', error)
  process.exit(1)
})
