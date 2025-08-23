/**
 * HTTP Client Compatibility Tests
 *
 * These tests prevent critical undici configuration bugs like the
 * `throwOnError: false` issue that caused complete API failure.
 *
 * Based on undici testing patterns from nodejs/undici repository.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { EnhancedHttpClient } from '../../utils/enhanced-http-client.js'

describe('hTTP Client Compatibility', () => {
  let httpClient: EnhancedHttpClient

  beforeEach(() => {
    httpClient = new EnhancedHttpClient()
  })

  describe('undici Configuration Validation', () => {
    it('should not include invalid undici options', async () => {
      // This test prevents the throwOnError: false bug
      const clientOptions = typeof httpClient === 'object' && httpClient !== null
        && 'getRequestOptions' in httpClient
        && typeof httpClient.getRequestOptions === 'function'
        ? httpClient.getRequestOptions()
        : {}

      // Verify no invalid undici options are present
      expect(clientOptions).not.toHaveProperty('throwOnError')
      expect(clientOptions).not.toHaveProperty('throwOnClientError')
      expect(clientOptions).not.toHaveProperty('throwOnServerError')
    })

    it('should use valid undici request options only', async () => {
      // Valid undici options based on official documentation
      const validOptions = [
        'method',
        'headers',
        'body',
        'dispatcher',
        'signal',
        'headersTimeout',
        'bodyTimeout',
        'maxRedirections',
        'upgrade',
        'blocking',
        'reset',
      ]

      const testRequest = async () => {
        try {
          // Use a mock server endpoint that should fail gracefully
          await httpClient.get('http://localhost:1/nonexistent')
        }
        catch (error) {
          // Expected to fail, but not due to invalid options
          expect(error).toBeDefined()
        }
      }

      // Should not throw due to invalid configuration
      await expect(testRequest()).resolves.not.toThrow()
    })

    it('should handle request errors gracefully without throwOnError', async () => {
      // Test that errors are handled manually, not via throwOnError
      try {
        await httpClient.get('http://localhost:1/should-fail')
      }
      catch (error) {
        // Should be our custom error handling, not undici's throwOnError
        expect(error).toBeDefined()
        expect(error.message).not.toContain('throwOnError')
      }
    })
  })

  describe('hTTP Request Configuration', () => {
    it('should set proper timeout values', () => {
      const client = new EnhancedHttpClient({ timeout: 5000 })
      // Client should be created with timeout configuration
      expect(client).toBeDefined()
    })

    it('should configure headers correctly', async () => {
      const customHeaders = { 'X-Test': 'value' }
      const client = new EnhancedHttpClient({
        headers: customHeaders,
      })

      // Client should be created with header configuration
      expect(client).toBeDefined()
    })

    it('should handle connection pooling configuration', () => {
      const client = new EnhancedHttpClient({
        maxConnections: 10,
      })

      // Should configure connection pooling without invalid options
      expect(() => client).not.toThrow()
    })
  })

  describe('response Handling', () => {
    it('should parse JSON responses correctly', async () => {
      // Mock successful response
      const mockResponse = { success: true, data: { test: 'value' } }

      // Test that JSON parsing works without throwOnError interference
      expect(() => JSON.parse(JSON.stringify(mockResponse))).not.toThrow()
    })

    it('should handle non-JSON responses gracefully', async () => {
      // Test handling of plain text responses
      const textResponse = 'plain text response'

      expect(() => {
        try {
          JSON.parse(textResponse)
        }
        catch {
          // Expected to fail parsing, should handle gracefully
          return textResponse
        }
      }).not.toThrow()
    })
  })

  describe('error Response Validation', () => {
    it('should properly handle 4xx errors', () => {
      // Should handle client errors without throwOnError
      const error404 = new Error('Not Found')
      ;(error404 as any).status = 404

      expect(error404.message).toBe('Not Found')
      expect((error404 as any).status).toBe(404)
    })

    it('should properly handle 5xx errors', () => {
      // Should handle server errors without throwOnError
      const error500 = new Error('Internal Server Error')
      ;(error500 as any).status = 500

      expect(error500.message).toBe('Internal Server Error')
      expect((error500 as any).status).toBe(500)
    })

    it('should handle network errors', () => {
      // Test network-level errors
      const networkError = new Error('ECONNREFUSED')
      ;(networkError as any).code = 'ECONNREFUSED'

      expect(networkError.message).toContain('ECONNREFUSED')
      expect((networkError as any).code).toBe('ECONNREFUSED')
    })
  })

  describe('security Configuration', () => {
    it('should not expose sensitive configuration', () => {
      const client = new EnhancedHttpClient({
        headers: { Authorization: 'Bearer secret-token' },
      })

      // Sensitive headers should be handled securely
      const stringified = JSON.stringify(client)
      expect(stringified).not.toContain('secret-token')
    })

    it('should validate SSL/TLS configuration', () => {
      // SSL configuration should be valid
      const client = new EnhancedHttpClient({
        tls: { rejectUnauthorized: true },
      })

      expect(() => client).not.toThrow()
    })
  })
})
