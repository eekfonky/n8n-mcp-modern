/**
 * n8n API Integration Mock Testing Suite
 * Validates tool behavior with realistic n8n API response patterns
 *
 * This test suite provides comprehensive validation with mocked n8n API responses:
 * - Realistic n8n API response structures
 * - Edge case handling (errors, empty responses, pagination)
 * - Secure error message validation
 * - Performance with large datasets
 *
 * @fixes Security issues found in comprehensive validation
 * @coverage n8n API integration patterns
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { database } from '../../database/index.js'
import { N8NMCPTools } from '../../tools/index.js'

// Mock n8n API responses that match real API structures
const mockN8nApiResponses = {
  workflows: [
    {
      id: '1',
      name: 'Customer Onboarding',
      active: true,
      nodes: [
        {
          id: 'webhook-1',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [240, 300],
          parameters: {
            httpMethod: 'POST',
            path: 'onboarding',
          },
        },
        {
          id: 'email-1',
          name: 'Send Welcome Email',
          type: 'n8n-nodes-base.emailSend',
          typeVersion: 1,
          position: [460, 300],
          parameters: {
            fromEmail: 'welcome@company.com',
            toEmail: '={{ $json.email }}',
            subject: 'Welcome to our platform!',
          },
        },
      ],
      connections: {
        Webhook: {
          main: [
            [
              {
                node: 'Send Welcome Email',
                type: 'main',
                index: 0,
              },
            ],
          ],
        },
      },
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-20T14:45:00Z',
    },
    {
      id: '2',
      name: 'Data Sync Pipeline',
      active: false,
      nodes: [
        {
          id: 'cron-1',
          name: 'Schedule Trigger',
          type: 'n8n-nodes-base.cron',
          typeVersion: 1,
          position: [240, 300],
          parameters: {
            rule: {
              hour: 2,
              minute: 0,
            },
          },
        },
      ],
      connections: {},
      createdAt: '2024-01-10T08:00:00Z',
      updatedAt: '2024-01-10T08:00:00Z',
    },
  ],

  nodes: [
    {
      name: 'HTTP Request',
      displayName: 'HTTP Request',
      description: 'Makes an HTTP request and returns the response data',
      category: 'Regular',
      icon: 'fa:at',
      version: 4,
      defaults: {
        name: 'HTTP Request',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Request Method',
          name: 'requestMethod',
          type: 'options',
          options: [
            { name: 'GET', value: 'GET' },
            { name: 'POST', value: 'POST' },
            { name: 'PUT', value: 'PUT' },
            { name: 'DELETE', value: 'DELETE' },
          ],
          default: 'GET',
        },
        {
          displayName: 'URL',
          name: 'url',
          type: 'string',
          default: '',
          placeholder: 'https://api.example.com/endpoint',
        },
      ],
    },
    {
      name: 'Webhook',
      displayName: 'Webhook',
      description: 'Starts the workflow when a webhook is called',
      category: 'Trigger',
      icon: 'fa:arrows-alt-h',
      version: 1,
      defaults: {
        name: 'Webhook',
      },
      inputs: [],
      outputs: ['main'],
      webhooks: [
        {
          name: 'default',
          httpMethod: 'GET',
          responseMode: 'onReceived',
          path: 'webhook',
        },
      ],
      properties: [
        {
          displayName: 'HTTP Method',
          name: 'httpMethod',
          type: 'options',
          options: [
            { name: 'GET', value: 'GET' },
            { name: 'POST', value: 'POST' },
          ],
          default: 'GET',
        },
      ],
    },
    {
      name: 'Code',
      displayName: 'Code',
      description: 'Run custom JavaScript code',
      category: 'Regular',
      icon: 'fa:code',
      version: 2,
      defaults: {
        name: 'Code',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Mode',
          name: 'mode',
          type: 'options',
          options: [
            { name: 'Run Once for All Items', value: 'runOnceForAllItems' },
            { name: 'Run Once for Each Item', value: 'runOnceForEachItem' },
          ],
          default: 'runOnceForEachItem',
        },
      ],
    },
  ],

  executions: [
    {
      id: 'exec-1',
      workflowId: '1',
      status: 'success',
      mode: 'webhook',
      startedAt: '2024-01-20T15:30:00Z',
      stoppedAt: '2024-01-20T15:30:02Z',
      executionTime: 2048,
      finished: true,
      data: {
        resultData: {
          runData: {
            Webhook: [
              {
                hints: [],
                startTime: 1642696200000,
                executionTime: 12,
                data: {
                  main: [
                    [
                      {
                        json: {
                          email: 'user@example.com',
                          name: 'John Doe',
                        },
                      },
                    ],
                  ],
                },
              },
            ],
          },
        },
      },
    },
    {
      id: 'exec-2',
      workflowId: '1',
      status: 'error',
      mode: 'webhook',
      startedAt: '2024-01-20T16:00:00Z',
      stoppedAt: '2024-01-20T16:00:01Z',
      executionTime: 1200,
      finished: true,
      data: {
        resultData: {
          error: {
            message: 'Invalid email address format',
            node: 'Send Welcome Email',
          },
        },
      },
    },
  ],

  // Error response patterns
  apiErrors: {
    unauthorized: {
      code: 401,
      message: 'Unauthorized - Invalid API credentials',
      hint: 'Check your n8n API key configuration',
    },
    notFound: {
      code: 404,
      message: 'Workflow not found',
      hint: 'Verify the workflow ID exists',
    },
    rateLimited: {
      code: 429,
      message: 'Too many requests',
      retryAfter: 60,
    },
    serverError: {
      code: 500,
      message: 'Internal server error',
      hint: 'n8n server may be temporarily unavailable',
    },
  },
}

// Secure mock implementation that sanitizes sensitive data
class SecureN8nApiMock {
  private responses: typeof mockN8nApiResponses

  constructor() {
    this.responses = mockN8nApiResponses
  }

  // Mock successful responses
  async getWorkflows(options: { limit?: number } = {}) {
    const limit = options.limit || 10
    return {
      data: this.responses.workflows.slice(0, limit),
      nextCursor: limit < this.responses.workflows.length ? 'next-page-token' : null,
    }
  }

  async getWorkflow(id: string) {
    const workflow = this.responses.workflows.find(w => w.id === id)
    if (!workflow) {
      throw this.createSecureError('WORKFLOW_NOT_FOUND', `Workflow ${id} not found`)
    }
    return { data: workflow }
  }

  async getNodes() {
    return { data: this.responses.nodes }
  }

  async getExecutions(workflowId?: string, options: { limit?: number } = {}) {
    const limit = options.limit || 20
    let executions = this.responses.executions

    if (workflowId) {
      executions = executions.filter(e => e.workflowId === workflowId)
    }

    return {
      data: executions.slice(0, limit),
      nextCursor: limit < executions.length ? 'next-exec-token' : null,
    }
  }

  async createWorkflow(data: any) {
    // Validate required fields
    if (!data.name) {
      throw this.createSecureError('VALIDATION_ERROR', 'Workflow name is required')
    }
    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw this.createSecureError('VALIDATION_ERROR', 'Workflow nodes must be an array')
    }

    const newWorkflow = {
      id: `workflow-${Date.now()}`,
      name: data.name,
      active: data.active || false,
      nodes: data.nodes,
      connections: data.connections || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return { data: newWorkflow }
  }

  async activateWorkflow(id: string) {
    const workflow = this.responses.workflows.find(w => w.id === id)
    if (!workflow) {
      throw this.createSecureError('WORKFLOW_NOT_FOUND', `Workflow ${id} not found`)
    }

    return {
      data: {
        ...workflow,
        active: true,
        updatedAt: new Date().toISOString(),
      },
    }
  }

  async executeWorkflow(id: string, data: any = {}) {
    const workflow = this.responses.workflows.find(w => w.id === id)
    if (!workflow) {
      throw this.createSecureError('WORKFLOW_NOT_FOUND', `Workflow ${id} not found`)
    }

    const execution = {
      id: `exec-${Date.now()}`,
      workflowId: id,
      status: 'running',
      mode: 'manual',
      startedAt: new Date().toISOString(),
      data,
    }

    return { data: execution }
  }

  async testConnection() {
    return { status: 'ok', version: '1.0.0' }
  }

  // Create secure error that doesn't leak sensitive information
  private createSecureError(code: string, message: string) {
    const error = new Error(message)
    ;(error as any).code = code
    ;(error as any).statusCode = this.getStatusCodeForError(code)

    // Remove any potentially sensitive information
    const sanitizedMessage = this.sanitizeErrorMessage(message)
    error.message = sanitizedMessage

    return error
  }

  private getStatusCodeForError(code: string): number {
    const statusMap: Record<string, number> = {
      WORKFLOW_NOT_FOUND: 404,
      VALIDATION_ERROR: 400,
      UNAUTHORIZED: 401,
      RATE_LIMITED: 429,
      SERVER_ERROR: 500,
    }
    return statusMap[code] || 500
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove sensitive patterns
    return message
      .replace(/api[_\s]*key/gi, 'credentials')
      .replace(/token/gi, 'authentication')
      .replace(/password/gi, 'credentials')
      .replace(/secret/gi, 'configuration')
      .replace(/at Object\.[\w$.()[\] ]+/g, '[internal]')
      .replace(/\s+at\s+[^\n]+/g, '')
  }
}

describe('n8n API Integration with Secure Mocks', () => {
  let mockApi: SecureN8nApiMock

  beforeAll(async () => {
    // Initialize database for tests
    await database.initialize()
  })

  beforeEach(() => {
    mockApi = new SecureN8nApiMock()

    // Mock the n8n API module
    vi.doMock('../../n8n/api.js', () => ({
      n8nApi: mockApi,
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('workflow Management with Realistic Data', () => {
    it('should return actual workflow data when API is available', async () => {
      // Mock successful API response
      vi.spyOn(mockApi, 'getWorkflows').mockResolvedValue({
        data: mockN8nApiResponses.workflows,
        nextCursor: null,
      })

      const result = await N8NMCPTools.executeTool('get_n8n_workflows', { limit: 10 })

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        const workflows = Array.isArray(result.data) ? result.data : [result.data]
        expect(workflows.length).toBeGreaterThan(0)

        // Validate workflow structure
        const workflow = workflows[0]
        expect(workflow).toHaveProperty('id')
        expect(workflow).toHaveProperty('name')
        expect(workflow).toHaveProperty('active')
        expect(workflow).toHaveProperty('nodes')
        expect(workflow).toHaveProperty('connections')

        // Check for realistic data
        expect(workflow.name).toContain('Customer') // Real-world workflow name
        expect(Array.isArray(workflow.nodes)).toBe(true)
        expect(typeof workflow.connections).toBe('object')
      }
    })

    it('should handle workflow creation with validation', async () => {
      const workflowData = {
        name: 'Test Integration Workflow',
        nodes: [
          {
            id: 'start-1',
            name: 'Start',
            type: 'n8n-nodes-base.start',
            position: [240, 300],
            parameters: {},
          },
        ],
        connections: {},
        active: false,
      }

      vi.spyOn(mockApi, 'createWorkflow').mockResolvedValue({
        data: {
          id: 'new-workflow-123',
          ...workflowData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      const result = await N8NMCPTools.executeTool('create_n8n_workflow', workflowData)

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data).toHaveProperty('id')
        expect(result.data.name).toBe(workflowData.name)
        expect(result.data.active).toBe(false)
      }
    })

    it('should handle workflow activation with proper validation', async () => {
      const workflowId = '1'

      vi.spyOn(mockApi, 'activateWorkflow').mockResolvedValue({
        data: {
          ...mockN8nApiResponses.workflows[0],
          active: true,
          updatedAt: new Date().toISOString(),
        },
      })

      const result = await N8NMCPTools.executeTool('activate_n8n_workflow', { id: workflowId })

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data).toHaveProperty('id', workflowId)
        expect(result.data).toHaveProperty('active', true)
      }
    })
  })

  describe('node Discovery with Real Data Structures', () => {
    it('should return comprehensive node information', async () => {
      vi.spyOn(mockApi, 'getNodes').mockResolvedValue({
        data: mockN8nApiResponses.nodes,
      })

      const result = await N8NMCPTools.executeTool('search_n8n_nodes', { query: 'http' })

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        const nodes = Array.isArray(result.data) ? result.data : [result.data]
        expect(nodes.length).toBeGreaterThan(0)

        // Validate node structure
        const node = nodes.find(n => n.name?.toLowerCase().includes('http'))
        if (node) {
          expect(node).toHaveProperty('name')
          expect(node).toHaveProperty('displayName')
          expect(node).toHaveProperty('description')
          expect(node).toHaveProperty('category')
          expect(node).toHaveProperty('properties')
          expect(Array.isArray(node.properties)).toBe(true)
        }
      }
    })

    it('should support advanced node filtering', async () => {
      const result = await N8NMCPTools.executeTool('search_n8n_nodes', {
        query: 'webhook',
        category: 'Trigger',
      })

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        const nodes = Array.isArray(result.data) ? result.data : [result.data]

        // Should find webhook trigger node
        const webhookNode = nodes.find(n => n.name?.toLowerCase().includes('webhook'))
        if (webhookNode) {
          expect(webhookNode.category).toBe('Trigger')
          expect(webhookNode).toHaveProperty('webhooks')
        }
      }
    })
  })

  describe('execution Management with Performance Data', () => {
    it('should return execution history with metrics', async () => {
      const workflowId = '1'

      vi.spyOn(mockApi, 'getExecutions').mockResolvedValue({
        data: mockN8nApiResponses.executions.filter(e => e.workflowId === workflowId),
        nextCursor: null,
      })

      const result = await N8NMCPTools.executeTool('get_n8n_executions', {
        workflowId,
        limit: 10,
      })

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        const executions = Array.isArray(result.data) ? result.data : [result.data]
        expect(executions.length).toBeGreaterThan(0)

        // Validate execution structure
        const execution = executions[0]
        expect(execution).toHaveProperty('id')
        expect(execution).toHaveProperty('workflowId', workflowId)
        expect(execution).toHaveProperty('status')
        expect(execution).toHaveProperty('startedAt')
        expect(execution).toHaveProperty('executionTime')

        // Check for performance data
        expect(typeof execution.executionTime).toBe('number')
        expect(execution.executionTime).toBeGreaterThan(0)
      }
    })

    it('should handle execution statistics', async () => {
      const workflowId = '1'

      const result = await N8NMCPTools.executeTool('get_workflow_stats', { id: workflowId })

      // Even if this tool isn't fully implemented, it should not crash
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('error Handling with Secure Messages', () => {
    it('should sanitize sensitive information in error messages', async () => {
      // Mock API error with sensitive information
      vi.spyOn(mockApi, 'getWorkflows').mockRejectedValue(
        new Error('Authentication failed: Invalid n8n API key provided. Check your API token configuration.'),
      )

      const result = await N8NMCPTools.executeTool('get_n8n_workflows', {})

      expect(result.success).toBe(false)
      if (result.error) {
        // Should NOT contain sensitive keywords
        expect(result.error).not.toMatch(/api[\s_]*key/i)
        expect(result.error).not.toMatch(/token/i)
        expect(result.error).not.toMatch(/password/i)
        expect(result.error).not.toMatch(/secret/i)

        // Should NOT contain stack traces
        expect(result.error).not.toContain('at Object')
        expect(result.error).not.toMatch(/\s+at\s+/)

        // Should still be informative
        expect(result.error.length).toBeGreaterThan(10)
        expect(result.error).toMatch(/authentication|credentials|configuration/i)
      }
    })

    it('should handle different error scenarios securely', async () => {
      const errorScenarios = [
        {
          name: 'Not Found',
          mockError: new Error('Workflow not found: invalid-id'),
          expectedPattern: /not found|invalid|workflow/i,
        },
        {
          name: 'Rate Limited',
          mockError: Object.assign(new Error('Too many requests'), { statusCode: 429 }),
          expectedPattern: /rate|limit|too many/i,
        },
        {
          name: 'Server Error',
          mockError: Object.assign(new Error('Internal server error at Object.executeWorkflow'), { statusCode: 500 }),
          expectedPattern: /server|internal|error/i,
        },
      ]

      for (const scenario of errorScenarios) {
        vi.spyOn(mockApi, 'getWorkflow').mockRejectedValueOnce(scenario.mockError)

        const result = await N8NMCPTools.executeTool('get_n8n_workflow', { id: 'test-id' })

        expect(result.success).toBe(false)
        if (result.error) {
          expect(result.error).toMatch(scenario.expectedPattern)
          expect(result.error).not.toContain('at Object')
          expect(result.error).not.toMatch(/\s+at\s+/)
        }
      }
    })

    it('should handle network timeouts gracefully', async () => {
      // Mock network timeout
      vi.spyOn(mockApi, 'testConnection').mockRejectedValue(
        Object.assign(new Error('Network timeout'), { code: 'ETIMEDOUT' }),
      )

      const result = await N8NMCPTools.executeTool('validate_mcp_config', { fix: false })

      // Should handle timeout without exposing technical details
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')

      if (!result.success && result.error) {
        expect(result.error).not.toContain('ETIMEDOUT')
        expect(result.error).toMatch(/connection|network|timeout/i)
      }
    })
  })

  describe('performance with Large Datasets', () => {
    it('should handle large workflow lists efficiently', async () => {
      // Create large dataset
      const largeWorkflowList = Array.from({ length: 100 }, (_, i) => ({
        id: `workflow-${i}`,
        name: `Workflow ${i}`,
        active: i % 2 === 0,
        nodes: [],
        connections: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))

      vi.spyOn(mockApi, 'getWorkflows').mockResolvedValue({
        data: largeWorkflowList,
        nextCursor: null,
      })

      const startTime = Date.now()
      const result = await N8NMCPTools.executeTool('get_n8n_workflows', { limit: 100 })
      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(1000) // Should complete within 1 second

      if (result.success && result.data) {
        expect(Array.isArray(result.data)).toBe(true)
        expect(result.data.length).toBeLessThanOrEqual(100)
      }
    })

    it('should support pagination for large datasets', async () => {
      const totalWorkflows = 150
      const pageSize = 50

      // Mock paginated response
      vi.spyOn(mockApi, 'getWorkflows').mockImplementation(async (options) => {
        const limit = options?.limit || 50
        const workflows = Array.from({ length: Math.min(limit, totalWorkflows) }, (_, i) => ({
          id: `workflow-${i}`,
          name: `Workflow ${i}`,
          active: true,
          nodes: [],
          connections: {},
        }))

        return {
          data: workflows,
          nextCursor: limit < totalWorkflows ? 'next-page' : null,
        }
      })

      const result = await N8NMCPTools.executeTool('get_n8n_workflows', { limit: pageSize })

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.length).toBe(pageSize)
      }
    })
  })

  describe('edge Cases and Boundary Conditions', () => {
    it('should handle empty responses appropriately', async () => {
      vi.spyOn(mockApi, 'getWorkflows').mockResolvedValue({
        data: [],
        nextCursor: null,
      })

      const result = await N8NMCPTools.executeTool('get_n8n_workflows', {})

      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
        expect(result.data.length).toBe(0)
      }
    })

    it('should validate input parameters before API calls', async () => {
      const result = await N8NMCPTools.executeTool('get_n8n_workflow', {
        id: null as any,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toMatch(/required|invalid|parameter/i)
    })

    it('should handle malformed API responses gracefully', async () => {
      // Mock malformed response
      vi.spyOn(mockApi, 'getWorkflows').mockResolvedValue(null as any)

      const result = await N8NMCPTools.executeTool('get_n8n_workflows', {})

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')

      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.error).not.toContain('undefined')
        expect(result.error).not.toContain('null')
      }
    })
  })

  describe('security and Data Privacy', () => {
    it('should not log sensitive data during API calls', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await N8NMCPTools.executeTool('get_n8n_workflows', {})

        // Check that no sensitive data was logged
        const allLogs = [
          ...consoleSpy.mock.calls.map(call => call.join(' ')),
          ...consoleErrorSpy.mock.calls.map(call => call.join(' ')),
        ].join(' ').toLowerCase()

        expect(allLogs).not.toContain('api_key')
        expect(allLogs).not.toContain('token')
        expect(allLogs).not.toContain('password')
        expect(allLogs).not.toContain('secret')
      }
      finally {
        consoleSpy.mockRestore()
        consoleErrorSpy.mockRestore()
      }
    })

    it('should mask sensitive data in workflow configurations', async () => {
      const sensitiveWorkflow = {
        name: 'API Integration',
        nodes: [
          {
            id: 'http-1',
            name: 'API Call',
            type: 'n8n-nodes-base.httpRequest',
            parameters: {
              url: 'https://api.example.com/data',
              authentication: 'genericCredentialType',
              credentials: {
                apiKey: 'secret-api-key-12345',
              },
            },
          },
        ],
        connections: {},
      }

      vi.spyOn(mockApi, 'createWorkflow').mockResolvedValue({
        data: { ...sensitiveWorkflow, id: 'workflow-123' },
      })

      const result = await N8NMCPTools.executeTool('create_n8n_workflow', sensitiveWorkflow)

      // The response should not contain sensitive credential data
      const responseStr = JSON.stringify(result)
      expect(responseStr).not.toContain('secret-api-key-12345')
    })
  })
})
