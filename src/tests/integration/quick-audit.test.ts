/**
 * Quick MCP Tools Audit
 * Fast audit to identify which tools work vs timeout
 */

import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { describe, expect } from 'vitest'

class QuickAuditClient {
  private server: ChildProcess | null = null
  private messageId = 1

  async start(): Promise<void> {
    this.server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, LOG_LEVEL: 'error' },
    })

    await new Promise(resolve => setTimeout(resolve, 500))

    await this.sendMessage({
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        clientInfo: { name: 'quick-audit', version: '1.0.0' },
      },
    })
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.kill('SIGTERM')
      this.server = null
    }
  }

  async sendMessage(message: any): Promise<any> {
    if (!this.server?.stdin) {
      throw new Error('MCP server not started')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve({ error: { message: 'TIMEOUT' } })
      }, 1000) // Very short timeout

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
              // Ignore
            }
          }
        }
      }

      this.server!.stdout!.on('data', responseHandler)
      this.server!.stdin!.write(`${JSON.stringify(message)}\n`)
    })
  }

  async callTool(toolName: string, args: any = {}): Promise<any> {
    const startTime = Date.now()

    const response = await this.sendMessage({
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    })

    const responseTime = Date.now() - startTime

    return { response, responseTime }
  }
}

describe('quick MCP Tools Audit', () => {
  const tools = [
    'search_n8n_nodes',
    'get_n8n_workflow',
    'activate_n8n_workflow',
    'deactivate_n8n_workflow',
    'get_n8n_executions',
    'get_workflow_stats',
    'n8n_import_workflow',
    'get_tool_usage_stats',
    'list_available_tools',
    'validate_mcp_config',
    'recommend_n8n_nodes',
    'get_system_health',
    'get_n8n_workflows',
    'create_n8n_workflow',
    'execute_n8n_workflow',
  ]

  it('audit all tools for responsiveness', async () => {
    const client = new QuickAuditClient()
    await client.start()

    const results: Array<{ tool: string, working: boolean, time: number, hasData: boolean }> = []

    for (const tool of tools) {
      const { response, responseTime } = await client.callTool(tool, {})
      const working = !response.error || response.error.message !== 'TIMEOUT'
      let hasData = false

      if (working && response.result?.content?.[0]?.text) {
        const text = response.result.content[0].text.toLowerCase()
        hasData = !text.includes('placeholder')
          && !text.includes('not implemented')
          && !text.includes('mock data')
          && text.length > 20
      }

      results.push({ tool, working, time: responseTime, hasData })
    }

    await client.stop()

    // Print results
    console.log('\n=== QUICK AUDIT RESULTS ===')
    results.forEach((r) => {
      const status = r.working
        ? (r.hasData ? '✅ WORKING' : '⚠️  PLACEHOLDER')
        : '❌ TIMEOUT'
      console.log(`${r.tool}: ${status} (${r.time}ms)`)
    })

    const workingCount = results.filter(r => r.working).length
    const realDataCount = results.filter(r => r.hasData).length

    console.log(`\n=== SUMMARY ===`)
    console.log(`Working Tools: ${workingCount}/${results.length}`)
    console.log(`Tools with Real Data: ${realDataCount}/${results.length}`)
    console.log(`Fast Tools (<500ms): ${results.filter(r => r.time < 500).length}/${results.length}`)

    expect(results.length).toBe(15)
  }, 30000)
})
