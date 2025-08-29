#!/usr/bin/env node
/**
 * Test script to validate MCP server functionality with real n8n API
 */

import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const N8N_API_URL = 'https://n8n.srv925321.hstgr.cloud'
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo'

console.log('🧪 Testing n8n-MCP Modern functionality...\n')

// Start MCP server
const mcpServer = spawn('node', ['dist/index.js'], {
  env: {
    ...process.env,
    N8N_API_URL,
    N8N_API_KEY,
    LOG_LEVEL: 'info',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
})

let serverReady = false
let toolsDiscovered = 0

mcpServer.stderr.on('data', (data) => {
  const output = data.toString()
  console.log('📋 Server:', output.trim())

  if (output.includes('🚀 n8n-MCP Modern ready')) {
    serverReady = true
  }
  if (output.includes('tools available')) {
    const match = output.match(/(\d+) tools available/)
    if (match)
      toolsDiscovered = Number.parseInt(match[1])
  }
})

// Wait for server to be ready
await sleep(2000)

if (!serverReady) {
  console.error('❌ Server failed to start')
  mcpServer.kill()
  process.exit(1)
}

console.log(`✅ Server ready! Discovered ${toolsDiscovered} tools\n`)

// Test MCP protocol messages
const testMessages = [
  {
    name: 'list_tools',
    message: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    },
  },
  {
    name: 'ping_tool',
    message: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'ping',
        arguments: {},
      },
    },
  },
  {
    name: 'list_workflows',
    message: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'list_workflows',
        arguments: {},
      },
    },
  },
]

console.log('🧪 Testing MCP protocol messages...\n')

for (const test of testMessages) {
  console.log(`📤 Testing ${test.name}:`)

  try {
    // Send message to MCP server
    mcpServer.stdin.write(`${JSON.stringify(test.message)}\n`)

    // Wait for response
    await sleep(1000)

    console.log(`✅ ${test.name} sent successfully\n`)
  }
  catch (error) {
    console.error(`❌ ${test.name} failed:`, error.message, '\n')
  }
}

// Listen for responses
let responseCount = 0
mcpServer.stdout.on('data', (data) => {
  try {
    const response = JSON.parse(data.toString())
    responseCount++

    console.log(`📥 Response ${responseCount}:`)
    if (response.result) {
      if (response.result.tools) {
        console.log(`  Found ${response.result.tools.length} tools:`)
        response.result.tools.forEach(tool =>
          console.log(`    - ${tool.name}: ${tool.description}`),
        )
      }
      else if (response.result.content) {
        console.log(`  Content: ${response.result.content[0].text.substring(0, 100)}...`)
      }
      else {
        console.log(`  Result:`, JSON.stringify(response.result, null, 2).substring(0, 200))
      }
    }
    console.log('')
  }
  catch (e) {
    console.log('📥 Raw response:', data.toString().trim())
  }
})

// Wait for responses
await sleep(3000)

console.log(`\n🎉 Test completed! Received ${responseCount} responses`)

// Cleanup
mcpServer.kill()
console.log('🔚 Server stopped')
