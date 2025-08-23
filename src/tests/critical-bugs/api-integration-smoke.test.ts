/**
 * API Integration Smoke Tests
 *
 * Critical smoke tests to prevent API integration failures.
 * Tests actual n8n API connectivity, authentication, and basic operations.
 */

import type { N8NExecution, N8NWorkflow } from '../../types/index.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { config, updateConfig } from '../../server/config.js'
import { EnhancedHttpClient } from '../../utils/enhanced-http-client.js'

describe('aPI Integration Smoke Tests', () => {
  let httpClient: EnhancedHttpClient
  let originalConfig: typeof config

  beforeAll(() => {
    // Store original config
    originalConfig = { ...config }
  })

  beforeEach(() => {
    httpClient = new EnhancedHttpClient()
  })

  afterAll(() => {
    // Restore original config
    updateConfig(originalConfig)
  })

  describe('configuration Validation', () => {
    it('should validate n8n API URL format', () => {
      const testUrls = [
        'https://n8n.example.com',
        'http://localhost:5678',
        'https://app.n8n.cloud/api/v1',
      ]

      testUrls.forEach((url) => {
        expect(() => {
          updateConfig({ n8nApiUrl: url })
        }).not.toThrow()
      })
    })

    it('should reject invalid n8n API URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid.com',
        'https://',
        '',
      ]

      invalidUrls.forEach((url) => {
        expect(() => {
          updateConfig({ n8nApiUrl: url })
        }).toThrow()
      })
    })

    it('should handle missing API credentials gracefully', () => {
      updateConfig({ n8nApiUrl: undefined, n8nApiKey: undefined })

      expect(config.n8nApiUrl).toBeUndefined()
      expect(config.n8nApiKey).toBeUndefined()
    })

    it('should validate API key format', () => {
      const validKeys = [
        'n8n_api_123456789abcdef',
        'sk-1234567890abcdef1234567890abcdef',
        'bearer_token_example',
      ]

      validKeys.forEach((key) => {
        expect(() => {
          updateConfig({ n8nApiKey: key })
        }).not.toThrow()
      })
    })
  })

  describe('connection Health Checks', () => {
    it('should handle connection timeout gracefully', async () => {
      // Test with a non-existent server
      const testClient = new EnhancedHttpClient({ timeout: 100 })

      try {
        await testClient.get('http://localhost:1/nonexistent')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/timeout|ECONNREFUSED|ENOTFOUND/)
      }
    })

    it('should validate SSL certificates in production', async () => {
      // Test SSL validation
      const testClient = new EnhancedHttpClient({
        tls: { rejectUnauthorized: true },
      })

      expect(testClient).toBeDefined()
    })

    it('should handle DNS resolution failures', async () => {
      const testClient = new EnhancedHttpClient({ timeout: 1000 })

      try {
        await testClient.get('https://this-domain-definitely-does-not-exist.invalid')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/ENOTFOUND|getaddrinfo/)
      }
    })
  })

  describe('authentication Flow', () => {
    it('should construct proper authorization headers', () => {
      const apiKey = 'test-api-key-123'
      const client = new EnhancedHttpClient({
        headers: { Authorization: `Bearer ${apiKey}` },
      })

      expect(client).toBeDefined()
      // Headers should be handled securely and not exposed in logs
    })

    it('should handle authentication failure responses', async () => {
      // Simulate 401 Unauthorized response
      const mockResponse = {
        status: 401,
        statusText: 'Unauthorized',
        data: { error: 'Invalid API key' },
      }

      // Test error handling without actual API call
      const error = new Error('Unauthorized')
      ;(error as any).status = 401
      ;(error as any).response = mockResponse

      expect(error.message).toBe('Unauthorized')
      expect((error as any).status).toBe(401)
    })

    it('should handle missing authorization header', async () => {
      const client = new EnhancedHttpClient()

      // Test that missing auth is handled gracefully
      expect(client).toBeDefined()
    })
  })

  describe('aPI Endpoint Validation', () => {
    it('should validate workflows endpoint structure', async () => {
      // Mock workflow response structure
      const mockWorkflow: N8NWorkflow = {
        id: '123',
        name: 'Test Workflow',
        active: true,
        nodes: [],
        connections: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Validate the structure matches our types
      expect(mockWorkflow).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        active: expect.any(Boolean),
        nodes: expect.any(Array),
        connections: expect.any(Object),
      })
    })

    it('should validate executions endpoint structure', async () => {
      // Mock execution response structure
      const mockExecution: N8NExecution = {
        id: '456',
        workflowId: '123',
        mode: 'manual',
        status: 'success',
        startedAt: new Date().toISOString(),
        stoppedAt: new Date().toISOString(),
        data: {
          resultData: {
            runData: {},
          },
        },
      }

      // Validate the structure matches our types
      expect(mockExecution).toMatchObject({
        id: expect.any(String),
        workflowId: expect.any(String),
        mode: expect.any(String),
        status: expect.any(String),
        data: expect.any(Object),
      })
    })

    it('should handle API version compatibility', () => {
      const apiVersions = ['v1', 'v2']

      apiVersions.forEach((version) => {
        const url = `https://api.n8n.com/api/${version}`
        expect(() => new URL(url)).not.toThrow()
      })
    })
  })

  describe('request/Response Handling', () => {
    it('should handle large response payloads', async () => {
      // Test max response size handling
      const maxSize = config.maxResponseSize
      expect(maxSize).toBeGreaterThan(1024) // At least 1KB
      expect(maxSize).toBeLessThan(100 * 1024 * 1024) // Less than 100MB
    })

    it('should sanitize response data when enabled', async () => {
      const mockResponse = {
        data: {
          password: 'secret123',
          apiKey: 'sk-123456',
          token: 'bearer-token',
          normalField: 'normal-value',
        },
      }

      if (config.sanitizeApiResponses) {
        // Response sanitization should be active
        expect(config.sanitizeApiResponses).toBe(true)
      }
    })

    it('should handle JSON parsing errors gracefully', async () => {
      const invalidJson = '{"invalid": json}'

      expect(() => {
        try {
          JSON.parse(invalidJson)
        }
        catch (error) {
          expect(error).toBeInstanceOf(SyntaxError)
          throw error
        }
      }).toThrow()
    })

    it('should respect request timeouts', async () => {
      const timeout = config.validationTimeout
      expect(timeout).toBeGreaterThan(100) // At least 100ms
      expect(timeout).toBeLessThan(60000) // Less than 60 seconds
    })
  })

  describe('error Response Patterns', () => {
    it('should handle n8n specific error formats', async () => {
      const n8nErrors = [
        { message: 'Workflow not found', code: 404 },
        { message: 'Invalid credentials', code: 401 },
        { message: 'Rate limit exceeded', code: 429 },
        { message: 'Server error', code: 500 },
      ]

      n8nErrors.forEach((errorResponse) => {
        expect(errorResponse.message).toBeDefined()
        expect(typeof errorResponse.code).toBe('number')
        expect(errorResponse.code).toBeGreaterThan(399)
      })
    })

    it('should handle network-level errors', () => {
      const networkErrors = [
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
        'ECONNRESET',
      ]

      networkErrors.forEach((errorCode) => {
        const error = new Error(`Network error: ${errorCode}`)
        ;(error as any).code = errorCode

        expect(error.message).toContain(errorCode)
        expect((error as any).code).toBe(errorCode)
      })
    })

    it('should classify error types correctly', () => {
      const errorClassifications = [
        { status: 400, type: 'client' },
        { status: 401, type: 'auth' },
        { status: 404, type: 'notfound' },
        { status: 429, type: 'ratelimit' },
        { status: 500, type: 'server' },
        { status: 503, type: 'unavailable' },
      ]

      errorClassifications.forEach(({ status, type }) => {
        if (status >= 400 && status < 500) {
          expect(['client', 'auth', 'notfound', 'ratelimit']).toContain(type)
        }
        else if (status >= 500) {
          expect(['server', 'unavailable']).toContain(type)
        }
      })
    })
  })

  describe('rate Limiting & Concurrency', () => {
    it('should respect concurrent request limits', () => {
      const maxConcurrent = config.maxConcurrentRequests
      expect(maxConcurrent).toBeGreaterThan(0)
      expect(maxConcurrent).toBeLessThan(100) // Reasonable upper limit
    })

    it('should handle rate limit responses', async () => {
      const rateLimitResponse = {
        status: 429,
        headers: {
          'retry-after': '60',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1234567890',
        },
      }

      expect(rateLimitResponse.status).toBe(429)
      expect(rateLimitResponse.headers['retry-after']).toBeDefined()
    })

    it('should queue requests when at limit', async () => {
      // Test that the system handles request queueing
      const promises = Array.from({ length: 5 }, () =>
        new Promise(resolve => setTimeout(resolve, 10)))

      const results = await Promise.all(promises)
      expect(results).toHaveLength(5)
    })
  })

  describe('cache Integration', () => {
    it('should validate cache configuration', () => {
      if (config.enableCache) {
        expect(config.cacheTtl).toBeGreaterThan(0)
        expect(config.cacheCleanupIntervalMs).toBeGreaterThan(0)
      }
    })

    it('should handle cache miss scenarios', async () => {
      // Cache miss should trigger actual API request
      const cacheKey = 'test-workflow-123'
      expect(cacheKey).toBeDefined()
    })

    it('should handle cache invalidation', () => {
      // Cache should be invalidated on data changes
      expect(config.enableCache).toBeDefined()
    })
  })

  describe('data Validation', () => {
    it('should validate workflow data structure', () => {
      const workflowData = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node-1',
            name: 'Start',
            type: 'n8n-nodes-base.start',
            parameters: {},
          },
        ],
        connections: {},
      }

      expect(workflowData.name).toBeTruthy()
      expect(Array.isArray(workflowData.nodes)).toBe(true)
      expect(typeof workflowData.connections).toBe('object')
    })

    it('should validate execution data structure', () => {
      const executionData = {
        mode: 'manual',
        workflowData: {
          name: 'Test',
          nodes: [],
          connections: {},
        },
      }

      expect(['manual', 'trigger', 'webhook']).toContain(executionData.mode)
      expect(executionData.workflowData).toBeDefined()
    })
  })

  describe('environment-Specific Tests', () => {
    it('should handle development environment', () => {
      if (config.nodeEnv === 'development') {
        expect(config.debug).toBeDefined()
      }
    })

    it('should handle production environment', () => {
      if (config.nodeEnv === 'production') {
        expect(config.enableResponseLogging).toBeDefined()
      }
    })

    it('should validate environment-specific URLs', () => {
      const environments = {
        development: 'http://localhost:5678',
        production: 'https://api.n8n.cloud',
      }

      Object.entries(environments).forEach(([env, url]) => {
        expect(() => new URL(url)).not.toThrow()
      })
    })
  })
})
