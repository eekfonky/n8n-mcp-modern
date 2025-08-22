/**
 * Enhanced HTTP Client Tests
 * Comprehensive tests for the undici-based HTTP client with caching and connection pooling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { EnhancedHttpClient, httpClient } from '../../utils/enhanced-http-client.js'

// Create hoisted mocks for proper module interception
const { mockRequest, mockAgent, mockPool, mockSetGlobalDispatcher } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
  mockAgent: vi.fn(),
  mockPool: vi.fn(),
  mockSetGlobalDispatcher: vi.fn(),
}))

// Mock undici for testing
vi.mock('undici', () => ({
  Agent: mockAgent,
  Pool: mockPool,
  request: mockRequest,
  setGlobalDispatcher: mockSetGlobalDispatcher,
}))

describe('enhanced HTTP Client Tests', () => {
  let client: EnhancedHttpClient

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Configure default mock behavior
    mockRequest.mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        text: () => Promise.resolve('{"success": true, "data": "test"}'),
        json: () => Promise.resolve({ success: true, data: 'test' }),
      },
    })
    
    mockAgent.mockImplementation(() => ({
      close: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    }))
    
    mockPool.mockImplementation(() => ({
      close: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      stats: {
        connected: 2,
        free: 1,
        pending: 0,
        running: 1,
        size: 3,
      },
    }))
    
    mockSetGlobalDispatcher.mockImplementation(() => {})
    
    client = new EnhancedHttpClient()
  })

  afterEach(async () => {
    await client.close()
  })

  describe('basic HTTP Operations', () => {
    it('should perform GET request successfully', async () => {
      const response = await client.get('https://api.example.com/test')

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ success: true, data: 'test' })
      expect(response.fromCache).toBe(false)
      expect(response.responseTime).toBeGreaterThanOrEqual(0)
    })

    it('should perform POST request with data', async () => {
      const testData = { name: 'test', value: 123 }
      const response = await client.post('https://api.example.com/create', testData)

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ success: true, data: 'test' })
    })

    it('should perform PUT request with data', async () => {
      const testData = { id: 1, name: 'updated' }
      const response = await client.put('https://api.example.com/update/1', testData)

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ success: true, data: 'test' })
    })

    it('should perform DELETE request', async () => {
      const response = await client.delete('https://api.example.com/delete/1')

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ success: true, data: 'test' })
    })
  })

  describe('schema Validation', () => {
    const testSchema = z.object({
      success: z.boolean(),
      data: z.string(),
    })

    it('should validate response with provided schema', async () => {
      const response = await client.get('https://api.example.com/test', {}, testSchema)

      expect(response.data.success).toBe(true)
      expect(response.data.data).toBe('test')
    })

    it('should handle schema validation failures gracefully', async () => {
      const invalidSchema = z.object({
        required: z.string(),
      })

      // Mock response that doesn't match schema
      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          text: () => Promise.resolve('{"success": true}'),
        },
      })

      // Should not throw in non-strict mode
      const response = await client.get('https://api.example.com/test', {}, invalidSchema)
      expect(response.status).toBe(200)
    })
  })

  describe('caching Functionality', () => {
    beforeEach(() => {
      client.clearCache()
    })

    it('should cache GET requests by default', async () => {
      const url = 'https://api.example.com/cacheable'

      // First request
      const response1 = await client.get(url)
      expect(response1.fromCache).toBe(false)

      // Second request should be cached
      const response2 = await client.get(url)
      expect(response2.fromCache).toBe(true)
    })

    it('should respect cache=false option', async () => {
      const url = 'https://api.example.com/no-cache'

      // First request with cache disabled
      const response1 = await client.get(url, { cache: false })
      expect(response1.fromCache).toBe(false)

      // Second request should also not be cached
      const response2 = await client.get(url, { cache: false })
      expect(response2.fromCache).toBe(false)
    })

    it('should not cache POST requests', async () => {
      const url = 'https://api.example.com/post'
      const data = { test: true }

      const response1 = await client.post(url, data)
      expect(response1.fromCache).toBe(false)

      const response2 = await client.post(url, data)
      expect(response2.fromCache).toBe(false)
    })

    it('should provide cache statistics', () => {
      const stats = client.getStats()

      expect(stats).toHaveProperty('cacheHits')
      expect(stats).toHaveProperty('cacheMisses')
      expect(stats).toHaveProperty('cacheSize')
      expect(typeof stats.cacheHits).toBe('number')
      expect(typeof stats.cacheMisses).toBe('number')
    })
  })

  describe('connection Pool Management', () => {
    it('should provide pool statistics', () => {
      const poolStats = client.getPoolStats()

      expect(poolStats).toBeInstanceOf(Object)
      // Pool stats depend on actual requests made
    })

    it('should handle multiple origins', async () => {
      await client.get('https://api1.example.com/test')
      await client.get('https://api2.example.com/test')

      const stats = client.getStats()
      expect(stats.poolCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('error Handling', () => {
    it('should handle network errors', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Network error'))

      await expect(client.get('https://api.example.com/error')).rejects.toThrow('Network error')

      const stats = client.getStats()
      expect(stats.errors).toBeGreaterThan(0)
    })

    it('should handle HTTP error status codes', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 404,
        headers: { 'content-type': 'application/json' },
        body: {
          text: () => Promise.resolve('{"error": "Not found"}'),
        },
      })

      const response = await client.get('https://api.example.com/notfound')
      expect(response.status).toBe(404)
    })

    it('should handle non-JSON responses', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: {
          text: () => Promise.resolve('Plain text response'),
        },
      })

      const response = await client.get('https://api.example.com/text')
      expect(response.data).toBe('Plain text response')
    })
  })

  describe('performance Monitoring', () => {
    it('should track response times', async () => {
      const response = await client.get('https://api.example.com/test')

      expect(response.responseTime).toBeGreaterThanOrEqual(0)
      expect(typeof response.responseTime).toBe('number')
    })

    it('should track request statistics', async () => {
      const initialStats = client.getStats()

      await client.get('https://api.example.com/test1')
      await client.get('https://api.example.com/test2')

      const finalStats = client.getStats()
      expect(finalStats.requests).toBeGreaterThan(initialStats.requests)
      expect(finalStats.averageResponseTime).toBeGreaterThanOrEqual(0)
    })

    it('should track response sizes', async () => {
      const response = await client.get('https://api.example.com/test')

      expect(response.size).toBeGreaterThan(0)
      expect(typeof response.size).toBe('number')
    })
  })

  describe('configuration and Options', () => {
    it('should respect timeout options', async () => {
      const response = await client.get('https://api.example.com/test', {
        timeout: 5000,
      })

      expect(response.status).toBe(200)
    })

    it('should handle custom headers', async () => {
      const customHeaders = {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'custom-value',
      }

      const response = await client.get('https://api.example.com/test', {
        headers: customHeaders,
      })

      expect(response.status).toBe(200)
    })
  })

  describe('cleanup and Resource Management', () => {
    it('should clean up resources on close', async () => {
      const testClient = new EnhancedHttpClient()

      // Perform some requests to create connections
      await testClient.get('https://api.example.com/test')

      // Should close cleanly
      await expect(testClient.close()).resolves.toBeUndefined()
    })

    it('should clear cache on demand', () => {
      client.clearCache()

      const stats = client.getStats()
      expect(stats.cacheSize).toBe(0)
    })
  })

  describe('singleton Export', () => {
    it('should export a singleton instance', () => {
      expect(httpClient).toBeInstanceOf(EnhancedHttpClient)
    })

    it('should maintain state across imports', async () => {
      // Use singleton
      await httpClient.get('https://api.example.com/singleton')
      const stats1 = httpClient.getStats()

      // Same instance should have updated stats
      const stats2 = httpClient.getStats()
      expect(stats1.requests).toBe(stats2.requests)
    })
  })
})
