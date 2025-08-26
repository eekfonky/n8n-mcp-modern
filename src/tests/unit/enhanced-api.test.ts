/**
 * Enhanced n8n API Client Unit Tests
 * Comprehensive testing with mock n8n API responses
 */

import { beforeEach, describe, expect, vi } from 'vitest'
import { EnhancedN8NApi } from '../../n8n/enhanced-api.js'
import { N8NMcpError } from '../../types/index.js'

// Mock the parent N8NApiClient
vi.mock('../../n8n/api.js', () => ({
  N8NApiClient: vi.fn().mockImplementation(() => ({
    request: vi.fn(),
    getWorkflowStats: vi.fn(),
    getVersionInfo: vi.fn(),
  })),
}))

// Mock dependencies
vi.mock('../../server/config.js', () => ({
  config: {
    n8nApiUrl: 'https://test.n8n.io/api/v1',
    n8nApiKey: 'test-api-key',
    mcpTimeout: 5000,
  },
}))

vi.mock('../../server/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock workflow data
const mockWorkflow = {
  id: 'test-workflow-1',
  name: 'Test Workflow',
  active: true,
  nodes: [
    {
      id: 'node1',
      name: 'Start',
      type: 'n8n-nodes-base.start',
      position: [100, 200],
      parameters: {},
    },
  ],
  connections: {},
  tags: ['test', 'automation'],
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
}

const mockExecution = {
  id: 'exec-1',
  workflowId: 'test-workflow-1',
  finished: true,
  mode: 'manual',
  startedAt: '2023-01-01T10:00:00Z',
  stoppedAt: '2023-01-01T10:01:00Z',
  data: { success: true },
}

const mockNodeTypes = [
  {
    name: 'n8n-nodes-base.webhook',
    displayName: 'Webhook',
    description: 'Receive HTTP requests',
    group: ['trigger'],
    version: 1,
    defaults: {},
    inputs: [],
    outputs: ['main'],
    properties: [],
  },
  {
    name: 'n8n-nodes-base.httpRequest',
    displayName: 'HTTP Request',
    description: 'Make HTTP requests',
    group: ['regular'],
    version: 1,
    defaults: {},
    inputs: ['main'],
    outputs: ['main'],
    properties: [],
  },
]

describe('enhancedN8NApi', () => {
  let api: EnhancedN8NApi
  let mockRequest: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    api = new EnhancedN8NApi()

    // Get the mock request method
    mockRequest = (api as any).request
    mockRequest.mockClear()
  })

  describe('constructor and Initialization', () => {
    it('should initialize with caching enabled', () => {
      expect(api).toBeInstanceOf(EnhancedN8NApi)
      expect(api.getCacheStats().size).toBe(0)
    })
  })

  describe('workflow Management', () => {
    it('should get workflows with default options', async () => {
      mockRequest.mockResolvedValueOnce({ data: [mockWorkflow] })

      const result = await api.getWorkflows()

      expect(result.workflows).toHaveLength(1)
      expect(result.workflows[0]).toEqual(mockWorkflow)
      expect(result.total).toBe(1)
      expect(result.hasMore).toBe(false)
      expect(mockRequest).toHaveBeenCalledWith(
        '/workflows',
        expect.any(Object),
      )
    })

    it('should get workflows with pagination', async () => {
      mockRequest.mockResolvedValueOnce({
        data: [mockWorkflow],
        nextCursor: 'next-page-token',
      })

      const result = await api.getWorkflows({
        limit: 10,
        offset: 0,
      })

      expect(result.workflows).toHaveLength(1)
      expect(result.hasMore).toBe(true)
      expect(mockRequest).toHaveBeenCalledWith(
        '/workflows?limit=10&offset=0',
        expect.any(Object),
      )
    })

    it('should get workflows with filtering', async () => {
      mockRequest.mockResolvedValueOnce({ data: [mockWorkflow] })

      await api.getWorkflows({
        active: true,
        search: 'test',
        tags: ['automation'],
      })

      expect(mockRequest).toHaveBeenCalledWith(
        '/workflows?active=true&filter=test',
        expect.any(Object),
      )
    })

    it('should get single workflow', async () => {
      mockRequest.mockResolvedValueOnce(mockWorkflow)

      const result = await api.getWorkflow('test-workflow-1')

      expect(result).toEqual(mockWorkflow)
      expect(mockRequest).toHaveBeenCalledWith(
        '/workflows/test-workflow-1',
        expect.objectContaining({ cache: true }),
      )
    })

    it('should get workflow with stats', async () => {
      mockRequest.mockResolvedValueOnce(mockWorkflow)
      const mockStats = {
        executions: 5,
        successRate: 80,
        lastExecution: new Date('2023-01-01T12:00:00Z'),
      }
      ;(api as any).getWorkflowStats = vi.fn().mockResolvedValueOnce(mockStats)

      const result = await api.getWorkflow('test-workflow-1', {
        includeMetadata: true,
      })

      expect(result.stats).toEqual(mockStats)
    })

    it('should create workflow with validation', async () => {
      const newWorkflow = {
        name: 'New Workflow',
        nodes: [{ id: 'start', type: 'n8n-nodes-base.start' }],
        connections: {},
      }
      mockRequest.mockResolvedValueOnce({ ...mockWorkflow, ...newWorkflow })

      const result = await api.createWorkflow(newWorkflow)

      expect(result.name).toBe(newWorkflow.name)
      expect(mockRequest).toHaveBeenCalledWith(
        '/workflows',
        expect.objectContaining({
          method: 'POST',
          body: newWorkflow,
        }),
      )
    })

    it('should validate workflow creation input', async () => {
      // Test missing name
      await expect(
        api.createWorkflow({
          name: '',
          nodes: [],
          connections: {},
        }),
      ).rejects.toThrow(N8NMcpError)

      // Test missing nodes
      await expect(
        api.createWorkflow({
          name: 'Test',
          nodes: [],
          connections: {},
        }),
      ).rejects.toThrow(N8NMcpError)
    })

    it('should update workflow', async () => {
      const updatedWorkflow = { ...mockWorkflow, name: 'Updated Workflow' }
      mockRequest.mockResolvedValueOnce(updatedWorkflow)

      const result = await api.updateWorkflow('test-workflow-1', {
        name: 'Updated Workflow',
      })

      expect(result.name).toBe('Updated Workflow')
      expect(mockRequest).toHaveBeenCalledWith(
        '/workflows/test-workflow-1',
        expect.objectContaining({
          method: 'PUT',
          body: { name: 'Updated Workflow' },
        }),
      )
    })
  })

  describe('execution Management', () => {
    it('should execute workflow', async () => {
      mockRequest.mockResolvedValueOnce(mockExecution)

      const result = await api.executeWorkflow('test-workflow-1', {
        data: { input: 'test' },
      })

      expect(result).toEqual(mockExecution)
      expect(mockRequest).toHaveBeenCalledWith(
        '/workflows/test-workflow-1/execute',
        expect.objectContaining({
          method: 'POST',
          body: { data: { input: 'test' } },
        }),
      )
    })

    it('should execute workflow and wait for completion', async () => {
      const runningExecution = { ...mockExecution, finished: false }
      const completedExecution = { ...mockExecution, finished: true }

      mockRequest
        .mockResolvedValueOnce(runningExecution)
        .mockResolvedValueOnce(runningExecution)
        .mockResolvedValueOnce(completedExecution)

      const result = await api.executeWorkflow('test-workflow-1', {
        waitForCompletion: true,
        timeout: 5000,
      })

      expect(result.finished).toBe(true)
    })

    it('should timeout waiting for execution', async () => {
      const runningExecution = { ...mockExecution, finished: false }
      mockRequest.mockResolvedValue(runningExecution)

      await expect(
        api.waitForExecution('exec-1', 1000, 100),
      ).rejects.toThrow(N8NMcpError)
    })

    it('should get executions with filtering', async () => {
      mockRequest.mockResolvedValueOnce({ data: [mockExecution] })

      const result = await api.getExecutions({
        workflowId: 'test-workflow-1',
        status: 'success',
        limit: 5,
      })

      expect(result.executions).toHaveLength(1)
      expect(mockRequest).toHaveBeenCalledWith(
        '/executions?limit=5&workflowId=test-workflow-1&status=success',
        expect.objectContaining({ cache: false }),
      )
    })

    it('should get execution by id', async () => {
      mockRequest.mockResolvedValueOnce(mockExecution)

      const result = await api.getExecution('exec-1')

      expect(result).toEqual(mockExecution)
      expect(mockRequest).toHaveBeenCalledWith(
        '/executions/exec-1',
        expect.objectContaining({ cache: false }),
      )
    })
  })

  describe('node Management', () => {
    it('should get node types', async () => {
      mockRequest.mockResolvedValueOnce({ data: mockNodeTypes })

      const result = await api.getNodeTypes()

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('n8n-nodes-base.webhook')
      expect(mockRequest).toHaveBeenCalledWith(
        '/node-types',
        expect.objectContaining({ cache: true }),
      )
    })

    it('should filter node types by search', async () => {
      mockRequest.mockResolvedValueOnce({ data: mockNodeTypes })

      const result = await api.getNodeTypes({
        search: 'webhook',
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('n8n-nodes-base.webhook')
    })

    it('should filter node types by category', async () => {
      mockRequest.mockResolvedValueOnce({ data: mockNodeTypes })

      const result = await api.getNodeTypes({
        category: 'trigger',
      })

      expect(result).toHaveLength(1)
      expect(result[0].displayName).toBe('Webhook')
    })
  })

  describe('system Management', () => {
    it('should get system health', async () => {
      const mockHealth = {
        status: 'ok' as const,
        database: { status: 'ok' as const, latency: 10 },
      }
      mockRequest.mockResolvedValueOnce(mockHealth)

      const result = await api.getSystemHealth()

      expect(result.status).toBe('ok')
      expect(result.database.status).toBe('ok')
      expect(mockRequest).toHaveBeenCalledWith(
        '/health',
        expect.objectContaining({ cache: true }),
      )
    })

    it('should get system health with details', async () => {
      const mockHealth = {
        status: 'ok' as const,
        database: { status: 'ok' as const },
      }
      const mockVersion = { version: '1.0.0' }

      mockRequest.mockResolvedValueOnce(mockHealth)
      ;(api as any).getVersionInfo = vi.fn().mockResolvedValueOnce(mockVersion)

      const result = await api.getSystemHealth({
        includeMetadata: true,
      })

      expect(result.details?.version).toBe('1.0.0')
    })
  })

  describe('caching', () => {
    it('should cache GET requests', async () => {
      mockRequest.mockResolvedValueOnce({ data: [mockWorkflow] })

      // First request
      await api.getWorkflows()
      expect(mockRequest).toHaveBeenCalledTimes(1)

      // Second request should use cache
      await api.getWorkflows()
      expect(mockRequest).toHaveBeenCalledTimes(1) // Still 1, from cache
    })

    it('should not cache execution requests', async () => {
      mockRequest.mockResolvedValue(mockExecution)

      // Multiple requests
      await api.getExecution('exec-1')
      await api.getExecution('exec-1')

      expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('should clear cache', () => {
      // Add some cached data
      (api as any).cache.set('test-key', {
        data: 'test',
        timestamp: Date.now(),
        ttl: 300,
      })

      expect(api.getCacheStats().size).toBe(1)

      api.clearCache()
      expect(api.getCacheStats().size).toBe(0)
    })

    it('should provide cache statistics', async () => {
      mockRequest.mockResolvedValueOnce({ data: [mockWorkflow] })

      await api.getWorkflows()
      const stats = api.getCacheStats()

      expect(stats.size).toBe(1)
      expect(stats.entries).toHaveLength(1)
      expect(stats.entries[0].key).toContain('/workflows')
    })
  })

  describe('error Handling', () => {
    it('should handle API errors', async () => {
      const apiError = new Error('API Error')
      mockRequest.mockRejectedValueOnce(apiError)

      await expect(api.getWorkflows()).rejects.toThrow(N8NMcpError)
    })

    it('should handle rate limiting', async () => {
      // Make rapid requests to trigger rate limiting
      const promises = Array.from({ length: 5 }).fill(0).map(() =>
        api.getWorkflows({ cache: false }),
      )

      await expect(Promise.all(promises)).rejects.toThrow()
    })
  })

  describe('response Sanitization', () => {
    it('should sanitize credential responses', async () => {
      const credentialWithSecrets = {
        id: 'cred-1',
        name: 'Test Credential',
        type: 'test',
        data: {
          password: 'secret123',
          apiKey: 'key123',
        },
      }
      mockRequest.mockResolvedValueOnce(credentialWithSecrets)

      // Mock credential request
      const sanitized = (api as any).sanitizeResponse(
        credentialWithSecrets,
        'GET /credentials',
      )

      expect(sanitized.data.password).toBe('[REDACTED]')
      expect(sanitized.data.apiKey).toBe('[REDACTED]')
    })

    it('should sanitize user responses', async () => {
      const userWithSecrets = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'secret',
        resetToken: 'token123',
      }

      const sanitized = (api as any).sanitizeResponse(
        userWithSecrets,
        'GET /users',
      )

      expect(sanitized.password).toBe('[REDACTED]')
      expect(sanitized.resetToken).toBe('[REDACTED]')
    })
  })

  describe('input Validation', () => {
    it('should validate workflow creation parameters', async () => {
      await expect(
        api.createWorkflow({
          name: '',
          nodes: [],
          connections: {},
        }),
      ).rejects.toThrow(N8NMcpError)

      await expect(
        api.createWorkflow({
          name: 'Valid Name',
          nodes: [],
          connections: {},
        }),
      ).rejects.toThrow(N8NMcpError)
    })

    it('should validate execution parameters', async () => {
      mockRequest.mockResolvedValueOnce(mockExecution)

      // Should accept valid parameters
      await expect(
        api.executeWorkflow('workflow-1', {
          data: { input: 'test' },
          timeout: 5000,
        }),
      ).resolves.toBeDefined()
    })
  })
})
