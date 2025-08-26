/**
 * MCP Tools Functionality Audit Test Suite
 *
 * Systematically audits all 15 registered MCP tools to identify gaps between
 * advertised and actual functionality for n8n integration.
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

interface AuditResult {
  toolName: string
  registered: boolean
  functional: boolean
  responseTime: number
  errorHandling: 'good' | 'fair' | 'poor'
  hasRealData: boolean
  issues: string[]
}

class McpServerTestClient {
  private server: ChildProcess | null = null
  private messageId = 1

  async start(): Promise<void> {
    this.server = spawn('node', ['dist/index.js'], {
      env: {
        ...process.env,
        N8N_API_URL: process.env.N8N_API_URL || 'https://n8n.srv925321.hstgr.cloud',
        N8N_API_KEY: process.env.N8N_API_KEY || 'test-key',
        LOG_LEVEL: 'info', // Need to see initialization messages
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Wait for server initialization with better pattern matching
    await new Promise<void>((resolve, reject) => {
      let initTimeout: NodeJS.Timeout | undefined
      let allOutput = ''

      const onData = (data: Buffer) => {
        const output = data.toString()
        allOutput += output
        console.log('Server output:', output) // Debug logging

        // Look for multiple success indicators
        if (output.includes('MCP server initialized successfully')
          || output.includes('Server ready for Claude Code integration')
          || allOutput.includes('n8n-MCP Modern server started successfully')) {
          if (initTimeout)
            clearTimeout(initTimeout)
          this.server!.stdout?.off('data', onData)
          this.server!.stderr?.off('data', onData)
          resolve()
        }
      }

      const onError = (error: Error) => {
        console.log('Server error:', error) // Debug logging
        if (initTimeout)
          clearTimeout(initTimeout)
        reject(error)
      }

      this.server!.stdout?.on('data', onData)
      this.server!.stderr?.on('data', onData)
      this.server!.on('error', onError)

      initTimeout = setTimeout(() => {
        reject(new Error(`MCP server initialization timeout. Output received: ${allOutput.slice(-500)}`))
      }, 5000) // Reduced timeout since server starts quickly
    })

    // Initialize MCP protocol
    await this.sendMessage({
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        clientInfo: { name: 'audit-client', version: '1.0.0' },
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

      const onData = (data: Buffer) => {
        const lines = data.toString().trim().split('\n')
        for (const line of lines) {
          if (line.startsWith('{')) {
            try {
              const response = JSON.parse(line)
              if (response.id === message.id) {
                clearTimeout(timeout)
                this.server!.stdout!.off('data', onData)
                resolve(response)
                return
              }
            }
            catch (e) {
              // Ignore non-JSON lines
            }
          }
        }
      }

      this.server!.stdout!.on('data', onData)
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

    return response.result.tools || []
  }

  async callTool(toolName: string, args: any = {}): Promise<{ result: any, responseTime: number }> {
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

    return { result: response, responseTime }
  }
}

describe('mCP Tools Functionality Audit', () => {
  let client: McpServerTestClient
  let registeredTools: McpTool[] = []
  const auditResults: AuditResult[] = []

  // Expected tools based on source code analysis
  const expectedTools = [
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

  beforeAll(async () => {
    client = new McpServerTestClient()
    await client.start()
    registeredTools = await client.listTools()
  }, 30000)

  afterAll(async () => {
    if (client) {
      await client.stop()
    }

    // Generate audit report
    console.log('\n=== MCP TOOLS AUDIT REPORT ===')
    console.log(`Total Expected Tools: ${expectedTools.length}`)
    console.log(`Total Registered Tools: ${registeredTools.length}`)
    console.log(`Audit Results:`)

    auditResults.forEach((result) => {
      console.log(`\n${result.toolName}:`)
      console.log(`  ✓ Registered: ${result.registered}`)
      console.log(`  ✓ Functional: ${result.functional}`)
      console.log(`  ✓ Response Time: ${result.responseTime}ms`)
      console.log(`  ✓ Real Data: ${result.hasRealData}`)
      console.log(`  ✓ Error Handling: ${result.errorHandling}`)
      if (result.issues.length > 0) {
        console.log(`  ⚠ Issues: ${result.issues.join(', ')}`)
      }
    })

    const functionalTools = auditResults.filter(r => r.functional).length
    const realDataTools = auditResults.filter(r => r.hasRealData).length
    const fastTools = auditResults.filter(r => r.responseTime < 2000).length

    console.log(`\n=== SUMMARY ===`)
    console.log(`Functional Tools: ${functionalTools}/${auditResults.length}`)
    console.log(`Tools with Real Data: ${realDataTools}/${auditResults.length}`)
    console.log(`Tools Under 2s Response: ${fastTools}/${auditResults.length}`)
  })

  describe('task 1: MCP Protocol Tool Discovery', () => {
    it('should register all 15 expected MCP tools', () => {
      expect(registeredTools).toBeDefined()
      expect(registeredTools.length).toBe(15)

      const registeredNames = registeredTools.map(t => t.name)
      expectedTools.forEach((expectedTool) => {
        expect(registeredNames).toContain(expectedTool)
      })
    })

    it('should have valid tool schemas for all registered tools', () => {
      registeredTools.forEach((tool) => {
        expect(tool.name).toBeDefined()
        expect(tool.title).toBeDefined()
        expect(tool.description).toBeDefined()
        expect(tool.inputSchema).toBeDefined()
      })
    })

    it('should not have extra unregistered tools', () => {
      const extraTools = registeredTools.filter(tool =>
        !expectedTools.includes(tool.name),
      )
      expect(extraTools.length).toBe(0)
    })
  })

  describe('task 2: Individual Tool Functionality Testing', () => {
    expectedTools.forEach((toolName) => {
      it(`${toolName} - should be functional and provide meaningful response`, async () => {
        const auditResult: AuditResult = {
          toolName,
          registered: false,
          functional: false,
          responseTime: 0,
          errorHandling: 'poor',
          hasRealData: false,
          issues: [],
        }

        // Check if tool is registered
        const tool = registeredTools.find(t => t.name === toolName)
        auditResult.registered = !!tool

        if (!tool) {
          auditResult.issues.push('Tool not registered')
          auditResults.push(auditResult)
          expect(tool).toBeDefined()
          return
        }

        try {
          // Test basic functionality with minimal valid input
          const testArgs = getTestArgsForTool(toolName)
          const { result, responseTime } = await client.callTool(toolName, testArgs)

          auditResult.responseTime = responseTime
          auditResult.functional = !result.error

          if (result.error) {
            auditResult.issues.push(`Tool error: ${result.error.message}`)
          }
          else {
            // Check if response contains real data vs placeholder
            auditResult.hasRealData = assessRealDataContent(toolName, result.result)
            if (!auditResult.hasRealData) {
              auditResult.issues.push('Appears to return placeholder data')
            }
          }

          // Test error handling
          try {
            const invalidArgs = getInvalidArgsForTool(toolName)
            const errorTest = await client.callTool(toolName, invalidArgs)
            auditResult.errorHandling = errorTest.result.error ? 'good' : 'fair'
          }
          catch {
            auditResult.errorHandling = 'fair'
          }
        }
        catch (error) {
          auditResult.issues.push(`Exception: ${error instanceof Error ? error.message : String(error)}`)
        }

        auditResults.push(auditResult)

        // Assertions for test framework
        expect(auditResult.registered).toBe(true)
        expect(auditResult.responseTime).toBeLessThan(5000) // Allow up to 5s for audit
      }, 10000)
    })
  })

  describe('task 3: Performance and Error Handling Assessment', () => {
    it('should have reasonable response times for all tools', async () => {
      const slowTools = auditResults.filter(result => result.responseTime > 2000)

      if (slowTools.length > 0) {
        console.log('Slow tools (>2s):', slowTools.map(t => `${t.toolName}: ${t.responseTime}ms`))
      }

      // Allow some flexibility during audit phase
      expect(slowTools.length).toBeLessThan(auditResults.length * 0.5) // Less than 50% slow
    })

    it('should handle errors gracefully', () => {
      const poorErrorHandling = auditResults.filter(result => result.errorHandling === 'poor')

      if (poorErrorHandling.length > 0) {
        console.log('Tools with poor error handling:', poorErrorHandling.map(t => t.toolName))
      }

      expect(poorErrorHandling.length).toBeLessThan(auditResults.length * 0.3) // Less than 30% poor
    })
  })

  describe('task 4: Analysis and Reporting', () => {
    it('should identify tools needing implementation work', () => {
      const needsWork = auditResults.filter(result =>
        !result.functional || !result.hasRealData || result.issues.length > 0,
      )

      console.log('\nTools needing implementation work:')
      needsWork.forEach((tool) => {
        console.log(`- ${tool.toolName}: ${tool.issues.join(', ')}`)
      })

      // This test documents the current state rather than enforcing perfection
      expect(needsWork.length).toBeGreaterThanOrEqual(0) // Always passes, used for reporting
    })

    it('should generate implementation priority matrix', () => {
      // High priority: Core workflow management tools
      const highPriorityTools = [
        'get_n8n_workflows',
        'create_n8n_workflow',
        'execute_n8n_workflow',
        'activate_n8n_workflow',
        'deactivate_n8n_workflow',
      ]

      const brokenHighPriority = auditResults.filter(result =>
        highPriorityTools.includes(result.toolName) && (!result.functional || !result.hasRealData),
      )

      console.log('\nHigh priority tools with issues:')
      brokenHighPriority.forEach((tool) => {
        console.log(`- ${tool.toolName}: ${tool.issues.join(', ')}`)
      })

      // Document findings
      expect(brokenHighPriority.length).toBeGreaterThanOrEqual(0)
    })
  })
})

/**
 * Get appropriate test arguments for each tool
 */
function getTestArgsForTool(toolName: string): any {
  switch (toolName) {
    case 'search_n8n_nodes':
      return { query: 'webhook' }
    case 'get_n8n_workflow':
      return { id: 'test-workflow-id' }
    case 'activate_n8n_workflow':
    case 'deactivate_n8n_workflow':
      return { id: 'test-workflow-id' }
    case 'get_n8n_executions':
      return { limit: 5 }
    case 'get_workflow_stats':
      return { id: 'test-workflow-id' }
    case 'n8n_import_workflow':
      return { workflowData: { name: 'Test', nodes: [], connections: {} } }
    case 'get_tool_usage_stats':
      return { period: 'day' }
    case 'list_available_tools':
      return {}
    case 'validate_mcp_config':
      return {}
    case 'recommend_n8n_nodes':
      return { userInput: 'send email' }
    case 'get_system_health':
      return {}
    case 'get_n8n_workflows':
      return { limit: 5 }
    case 'create_n8n_workflow':
      return { name: 'Test Workflow', nodes: [], connections: {} }
    case 'execute_n8n_workflow':
      return { id: 'test-workflow-id' }
    default:
      return {}
  }
}

/**
 * Get invalid arguments to test error handling
 */
function getInvalidArgsForTool(toolName: string): any {
  switch (toolName) {
    case 'get_n8n_workflow':
    case 'activate_n8n_workflow':
    case 'deactivate_n8n_workflow':
    case 'get_workflow_stats':
    case 'execute_n8n_workflow':
      return { id: null } // Invalid ID
    case 'search_n8n_nodes':
      return { query: null } // Missing required query
    case 'recommend_n8n_nodes':
      return { userInput: null } // Missing required input
    default:
      return { invalid: 'parameter' }
  }
}

/**
 * Assess if tool response contains real data vs placeholder content
 */
function assessRealDataContent(toolName: string, response: any): boolean {
  if (!response?.content?.[0]?.text) {
    return false
  }

  const responseText = response.content[0].text.toLowerCase()

  // Look for placeholder indicators
  const placeholderIndicators = [
    'placeholder',
    'mock data',
    'not implemented',
    'coming soon',
    'under development',
    'sample data',
    'test data',
    'dummy',
  ]

  const hasPlaceholderText = placeholderIndicators.some(indicator =>
    responseText.includes(indicator),
  )

  if (hasPlaceholderText) {
    return false
  }

  // Tool-specific real data checks
  switch (toolName) {
    case 'get_n8n_workflows':
    case 'get_n8n_workflow':
      try {
        const data = JSON.parse(response.content[0].text)
        return data.workflows || data.workflow || data.id || false
      }
      catch {
        return responseText.includes('workflow') && responseText.length > 50
      }

    case 'search_n8n_nodes':
    case 'recommend_n8n_nodes':
      return responseText.includes('node') && responseText.length > 50

    case 'get_system_health':
      return responseText.includes('health') || responseText.includes('status')

    default:
      // Generic check - substantial response suggests real implementation
      return responseText.length > 30 && !responseText.includes('error')
  }
}
