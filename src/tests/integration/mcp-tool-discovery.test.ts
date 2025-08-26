/**
 * MCP Tool Discovery Test
 * Tests tool registration and listing functionality
 */

import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { afterAll, beforeAll, describe, expect } from 'vitest'

interface McpResponse {
  jsonrpc: string
  id: number
  result?: any
  error?: any
}

interface McpTool {
  name: string
  title: string
  description: string
  inputSchema: any
}

class McpTestClient {
  private server: ChildProcess | null = null
  private messageId = 1

  async start(): Promise<void> {
    this.server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'inherit'], // Let stderr go to console for debugging
      env: { ...process.env, LOG_LEVEL: 'error' },
    })

    // Brief startup delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Initialize MCP protocol
    await this.sendMessage({
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        clientInfo: { name: 'discovery-test', version: '1.0.0' },
      },
    })
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.kill('SIGTERM')
      await new Promise<void>((resolve) => {
        this.server!.on('close', () => resolve())
      })
      this.server = null
    }
  }

  async sendMessage(message: any): Promise<McpResponse> {
    if (!this.server?.stdin) {
      throw new Error('MCP server not started')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Message timeout: ${JSON.stringify(message)}`))
      }, 5000)

      const responseHandler = (data: Buffer) => {
        const lines = data.toString().trim().split('\n')
        for (const line of lines) {
          if (line.startsWith('{')) {
            try {
              const response = JSON.parse(line)
              if (response.id === message.id) {
                clearTimeout(timeout)
                this.server!.stdout!.off('data', responseHandler)
                resolve(response)
                return
              }
            }
            catch (e) {
              // Ignore malformed JSON
            }
          }
        }
      }

      this.server!.stdout!.on('data', responseHandler)
      this.server!.stdin!.write(`${JSON.stringify(message)}\n`)
    })
  }

  async listTools(): Promise<McpTool[]> {
    const response = await this.sendMessage({
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'tools/list',
      params: {},
    })

    if (response.error) {
      throw new Error(`Failed to list tools: ${response.error.message}`)
    }

    return response.result?.tools || []
  }
}

describe('mCP Tool Discovery', () => {
  let client: McpTestClient

  beforeAll(async () => {
    client = new McpTestClient()
    await client.start()
  }, 10000)

  afterAll(async () => {
    if (client) {
      await client.stop()
    }
  })

  it('should list registered MCP tools', async () => {
    const tools = await client.listTools()

    console.log('Discovered tools:', tools.map(t => t.name))
    console.log('Total tools found:', tools.length)

    // Basic validation
    expect(tools).toBeDefined()
    expect(Array.isArray(tools)).toBe(true)
    expect(tools.length).toBeGreaterThan(0)

    // Validate tool structure
    tools.forEach((tool) => {
      expect(tool.name).toBeDefined()
      expect(tool.description).toBeDefined()
      expect(tool.inputSchema).toBeDefined()
    })
  }, 10000)

  it('should include expected core n8n tools', async () => {
    const tools = await client.listTools()
    const toolNames = tools.map(t => t.name)

    // Check for some expected tools
    const expectedTools = [
      'get_n8n_workflows',
      'search_n8n_nodes',
      'get_system_health',
    ]

    expectedTools.forEach((expectedTool) => {
      expect(toolNames).toContain(expectedTool)
    })
  }, 10000)
})
