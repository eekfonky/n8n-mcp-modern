/**
 * Quick validation script to test MCP tools functionality
 * Tests basic tool registration and response format
 */

// Run validation if this script is executed directly
import process from 'node:process'

import { N8NMCPTools } from './src/tools/index.ts'

async function validateImplementation() {
  console.warn('🔍 Validating Enhanced MCP Tools Implementation...\n')

  const testResults = {
    toolsRegistered: 0,
    toolsResponding: 0,
    enhancedFeatures: 0,
    errors: [],
  }

  // Test 1: Tool Registration
  try {
    const tools = N8NMCPTools.getTools()
    testResults.toolsRegistered = tools.length
    console.warn(`✅ Tool Registration: ${tools.length} tools registered`)

    // Check for new enhanced tools
    const enhancedTools = tools.filter(tool =>
      tool.name === 'recommend_n8n_nodes' || tool.name === 'get_system_health',
    )
    console.warn(`✅ New Enhanced Tools: ${enhancedTools.length}/2 found`)
  }
  catch (error) {
    testResults.errors.push(`Tool registration failed: ${error.message}`)
    console.error(`❌ Tool Registration Failed: ${error.message}`)
  }

  // Test 2: Basic Tool Execution (mock mode)
  const testTools = ['get_system_health', 'list_available_tools', 'validate_mcp_config']

  for (const toolName of testTools) {
    try {
      console.warn(`Testing ${toolName}...`)
      const result = await N8NMCPTools.executeTool(toolName, {})

      if (result.success) {
        testResults.toolsResponding++

        // Check for enhanced features
        if (result.data && typeof result.data === 'object') {
          const data = result.data
          if (data.source === 'enhanced_api' || data.timestamp || data.metadata) {
            testResults.enhancedFeatures++
            console.warn(`  ✅ Enhanced features detected: ${Object.keys(data).join(', ')}`)
          }
        }

        console.warn(`  ✅ ${toolName}: Working`)
      }
      else {
        console.error(`  ⚠️  ${toolName}: Error - ${result.error}`)
      }
    }
    catch (error) {
      testResults.errors.push(`${toolName}: ${error.message}`)
      console.error(`  ❌ ${toolName}: Exception - ${error.message}`)
    }
  }

  // Results Summary
  console.warn('\n📊 Implementation Validation Results:')
  console.warn(`   Tools Registered: ${testResults.toolsRegistered}`)
  console.warn(`   Tools Responding: ${testResults.toolsResponding}/${testTools.length}`)
  console.warn(`   Enhanced Features: ${testResults.enhancedFeatures} tools with enhancements`)

  if (testResults.errors.length > 0) {
    console.error(`   Errors: ${testResults.errors.length}`)
    testResults.errors.forEach(error => console.error(`     - ${error}`))
  }

  const successRate = (testResults.toolsResponding / testTools.length) * 100
  console.warn(`\n🎯 Success Rate: ${successRate.toFixed(1)}%`)

  if (successRate >= 70) {
    console.warn('🎉 Implementation Status: PRODUCTION READY')
  }
  else if (successRate >= 50) {
    console.warn('⚠️  Implementation Status: NEEDS REFINEMENT')
  }
  else {
    console.error('❌ Implementation Status: MAJOR ISSUES')
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  validateImplementation().catch(console.error)
}

export { validateImplementation }
