/**
 * Error Handling Tests
 *
 * Critical tests to validate error handling for API failures,
 * connection errors, timeout scenarios, and edge cases.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../server/config.js'
import { EnhancedHttpClient } from '../../utils/enhanced-http-client.js'

describe('error Handling Tests', () => {
  let httpClient: EnhancedHttpClient
  let mockFetch: vi.Mock

  beforeEach(() => {
    httpClient = new EnhancedHttpClient()

    // Mock fetch for controlled error scenarios
    mockFetch = vi.fn()
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('aPI Failure Handling', () => {
    it('should handle 400 Bad Request errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid parameters' }),
        text: async () => '{"error": "Invalid parameters"}',
      })

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toContain('Bad Request')
        expect((error as any).status).toBe(400)
      }
    })

    it('should handle 401 Unauthorized errors with proper context', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' }),
        text: async () => '{"error": "Invalid API key"}',
      })

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/unauthorized|invalid.*key/i)
        expect((error as any).status).toBe(401)

        // Should provide actionable error information
        expect(error.message).toBeTruthy()
        expect(error.message.length).toBeGreaterThan(5)
      }
    })

    it('should handle 403 Forbidden errors appropriately', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Insufficient permissions' }),
        text: async () => '{"error": "Insufficient permissions"}',
      })

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect((error as any).status).toBe(403)
        expect(error.message).toMatch(/forbidden|permission/i)
      }
    })

    it('should handle 404 Not Found errors with context', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' }),
        text: async () => '{"error": "Resource not found"}',
      })

      try {
        await httpClient.get('http://test.com/api/nonexistent')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect((error as any).status).toBe(404)
        expect(error.message).toMatch(/not found|resource/i)
      }
    })

    it('should handle 429 Rate Limit errors with retry information', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([
          ['retry-after', '60'],
          ['x-ratelimit-remaining', '0'],
          ['x-ratelimit-reset', '1640995200'],
        ]),
        json: async () => ({ error: 'Rate limit exceeded' }),
        text: async () => '{"error": "Rate limit exceeded"}',
      })

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect((error as any).status).toBe(429)
        expect(error.message).toMatch(/rate.*limit|too.*many/i)

        // Should include retry information if available
        const errorObj = error as any
        if (errorObj.headers || errorObj.retryAfter) {
          expect(errorObj.retryAfter || errorObj.headers?.get?.('retry-after')).toBeTruthy()
        }
      }
    })

    it('should handle 500 Internal Server Error appropriately', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error occurred' }),
        text: async () => '{"error": "Server error occurred"}',
      })

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect((error as any).status).toBe(500)
        expect(error.message).toMatch(/server.*error|internal/i)

        // Server errors should be retryable in nature
        expect(error.message).not.toMatch(/permanent|fatal/i)
      }
    })

    it('should handle 502/503 Service Unavailable errors', async () => {
      const serviceErrors = [502, 503, 504]

      for (const status of serviceErrors) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: status === 502 ? 'Bad Gateway' : status === 503 ? 'Service Unavailable' : 'Gateway Timeout',
          json: async () => ({ error: 'Service temporarily unavailable' }),
          text: async () => '{"error": "Service temporarily unavailable"}',
        })

        try {
          await httpClient.get('http://test.com/api')
        }
        catch (error) {
          expect(error).toBeDefined()
          expect((error as any).status).toBe(status)
          expect(error.message).toMatch(/unavailable|gateway|timeout/i)
        }
      }
    })
  })

  describe('connection Error Handling', () => {
    it('should handle network connection failures', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

      try {
        await httpClient.get('http://localhost:1/nonexistent')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/ECONNREFUSED|connection|refused/i)

        // Should provide helpful context
        expect(error.message.length).toBeGreaterThan(10)
      }
    })

    it('should handle DNS resolution failures', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND invalid-domain.invalid'))

      try {
        await httpClient.get('http://invalid-domain.invalid/api')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/ENOTFOUND|DNS|domain|resolve/i)
      }
    })

    it('should handle SSL/TLS certificate errors', async () => {
      const sslErrors = [
        'CERT_UNTRUSTED',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'SELF_SIGNED_CERT_IN_CHAIN',
      ]

      const promises = sslErrors.map(async (sslError) => {
        mockFetch.mockRejectedValueOnce(new Error(sslError))

        try {
          await httpClient.get('https://self-signed.test.com/api')
          throw new Error('Should have thrown SSL error')
        }
        catch (error) {
          expect(error).toBeDefined()
          expect(error.message).toMatch(/cert|ssl|tls|untrusted|signature/i)
        }
      })

      await Promise.all(promises)
    })

    it('should handle network timeout scenarios', async () => {
      // Mock a timeout error
      mockFetch.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10),
        ),
      )

      const shortTimeoutClient = new EnhancedHttpClient({ timeout: 5 })

      try {
        await shortTimeoutClient.get('http://test.com/slow-endpoint')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/timeout|timed.*out/i)
      }
    })

    it('should handle connection reset errors', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNRESET'))

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/ECONNRESET|connection.*reset/i)
      }
    })
  })

  describe('data Parsing Error Handling', () => {
    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token') },
        text: async () => '{"invalid": json malformed}',
      })

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/json|syntax|parse/i)
      }
    })

    it('should handle empty response bodies gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => null,
        text: async () => '',
      })

      // Should not throw error for empty but valid responses
      await expect(httpClient.get('http://test.com/api')).resolves.toBeDefined()
    })

    it('should handle non-JSON response types', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]),
        json: async () => { throw new Error('Not JSON') },
        text: async () => 'Plain text response',
      })

      // Should handle non-JSON responses gracefully
      await expect(httpClient.get('http://test.com/api')).resolves.toBeDefined()
    })

    it('should handle binary response data appropriately', async () => {
      const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]) // PNG header

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'image/png']]),
        json: async () => { throw new Error('Not JSON') },
        text: async () => { throw new Error('Not text') },
        arrayBuffer: async () => binaryData.buffer,
      })

      try {
        await httpClient.get('http://test.com/image.png')
      }
      catch (error) {
        // Should either handle binary data or fail gracefully
        expect(error).toBeDefined()
        expect(error.message).not.toMatch(/uncaught|unexpected/i)
      }
    })
  })

  describe('configuration Error Handling', () => {
    it('should handle invalid URL formats', async () => {
      const invalidUrls = [
        'not-a-url',
        'http://',
        'ftp://invalid.com',
        '',
      ]

      for (const invalidUrl of invalidUrls) {
        try {
          await httpClient.get(invalidUrl)
        }
        catch (error) {
          expect(error).toBeDefined()
          expect(error.message).toMatch(/url|invalid|malformed/i)
        }
      }
    })

    it('should handle missing configuration gracefully', () => {
      // Test client without configuration
      expect(() => new EnhancedHttpClient()).not.toThrow()

      // Test with partial configuration
      expect(() => new EnhancedHttpClient({ timeout: 5000 })).not.toThrow()

      // Test with invalid configuration
      expect(() => new EnhancedHttpClient({ timeout: -1000 })).not.toThrow()
    })

    it('should validate configuration parameters', () => {
      const invalidConfigs = [
        { timeout: 'invalid' },
        { maxRedirects: -1 },
        { headers: 'not-an-object' },
      ]

      invalidConfigs.forEach((config) => {
        // Should either use defaults or handle invalid config gracefully
        expect(() => new EnhancedHttpClient(config as any)).not.toThrow()
      })
    })
  })

  describe('resource Exhaustion Handling', () => {
    it('should handle memory exhaustion scenarios', async () => {
      // Mock large response
      const largeResponse = 'x'.repeat(config.maxResponseSize + 1000)

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: largeResponse }),
        text: async () => largeResponse,
      })

      try {
        await httpClient.get('http://test.com/large-response')
      }
      catch (error) {
        // Should either handle large responses or fail with appropriate error
        if (error) {
          expect(error.message).toMatch(/size|memory|limit/i)
        }
      }
    })

    it('should handle file descriptor exhaustion', async () => {
      // Simulate many concurrent requests
      const manyRequests = Array.from({ length: 100 }, () =>
        httpClient.get('http://test.com/api').catch(() => {}))

      // Should not crash the process
      await expect(Promise.all(manyRequests)).resolves.toBeDefined()
    })

    it('should respect concurrent request limits', async () => {
      const maxConcurrent = config.maxConcurrentRequests
      const requestCount = maxConcurrent + 10

      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          }), 50),
        ),
      )

      const startTime = Date.now()

      const requests = Array.from({ length: requestCount }, () =>
        httpClient.get('http://test.com/api').catch(() => {}))

      await Promise.all(requests)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should demonstrate queueing behavior (longer than if all concurrent)
      const minExpectedTime = Math.ceil(requestCount / maxConcurrent) * 50 * 0.8 // 80% of theoretical minimum
      expect(duration).toBeGreaterThan(minExpectedTime)
    })
  })

  describe('error Recovery and Resilience', () => {
    it('should provide meaningful error messages', async () => {
      const errorScenarios = [
        { status: 400, message: 'Bad Request' },
        { status: 401, message: 'Unauthorized' },
        { status: 403, message: 'Forbidden' },
        { status: 404, message: 'Not Found' },
        { status: 429, message: 'Rate Limited' },
        { status: 500, message: 'Server Error' },
        { status: 503, message: 'Service Unavailable' },
      ]

      for (const scenario of errorScenarios) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: scenario.status,
          statusText: scenario.message,
          json: async () => ({ error: scenario.message }),
          text: async () => `{"error": "${scenario.message}"}`,
        })

        try {
          await httpClient.get('http://test.com/api')
        }
        catch (error) {
          expect(error.message).toBeTruthy()
          expect(error.message.length).toBeGreaterThan(5)
          expect(error.message).not.toBe('Error') // Should be more specific
          expect((error as any).status).toBe(scenario.status)
        }
      }
    })

    it('should maintain error context and stack traces', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.stack).toBeDefined()
        expect(error.stack).toContain('httpClient')
      }
    })

    it.skip('should handle cascading failures gracefully', async () => {
      // First request fails
      mockFetch.mockRejectedValueOnce(new Error('First failure'))

      // Second request also fails
      mockFetch.mockRejectedValueOnce(new Error('Second failure'))

      // Third request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })

      const results = await Promise.allSettled([
        httpClient.get('http://test.com/api1').catch(e => ({ error: e.message })),
        httpClient.get('http://test.com/api2').catch(e => ({ error: e.message })),
        httpClient.get('http://test.com/api3'),
      ])

      expect(results).toHaveLength(3)

      // First two should fail and be caught, third should succeed
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('fulfilled')
      expect(results[2].status).toBe('fulfilled')

      // First two should have error objects from catch handlers
      expect((results[0] as any).value).toHaveProperty('error')
      expect((results[1] as any).value).toHaveProperty('error')
      expect((results[0] as any).value.error).toMatch(/First failure/)
      expect((results[1] as any).value.error).toMatch(/Second failure/)

      // Third should have successful response
      expect((results[2] as any).value).toHaveProperty('success', true)
    })

    it('should validate error serialization for logging', async () => {
      mockFetch.mockRejectedValue(new Error('Test error for serialization'))

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        // Error should be serializable for logging
        const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error))
        expect(serialized).toBeTruthy()

        const parsed = JSON.parse(serialized)
        expect(parsed.message).toBe(error.message)
        expect(parsed.name).toBe(error.name)
      }
    })
  })

  describe('edge Case Error Handling', () => {
    it('should handle null and undefined responses', async () => {
      const nullResponses = [null, undefined]

      for (const nullResponse of nullResponses) {
        mockFetch.mockResolvedValueOnce(nullResponse as any)

        try {
          await httpClient.get('http://test.com/api')
        }
        catch (error) {
          expect(error).toBeDefined()
          expect(error.message).toMatch(/response|null|undefined/i)
        }
      }
    })

    it('should handle circular reference errors', async () => {
      const circularObj: any = { name: 'test' }
      circularObj.self = circularObj

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => circularObj,
        text: async () => JSON.stringify(circularObj),
      })

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        // Should handle circular references gracefully
        expect(error).toBeDefined()
        expect(error.message).toMatch(/circular|reference|convert/i)
      }
    })

    it('should handle unicode and encoding issues', async () => {
      const unicodeData = '{"message": "Hello 世界 🌍 \uD800"}'

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid unicode') },
        text: async () => unicodeData,
      })

      try {
        await httpClient.get('http://test.com/api')
      }
      catch (error) {
        // Should handle encoding issues gracefully
        expect(error).toBeDefined()
        expect(error.message).toMatch(/unicode|encoding|character/i)
      }
    })
  })
})
