/**
 * Dynamic Schema Generation Test Suite
 * Tests the schema generator that converts n8n parameters to Zod schemas
 *
 * This test suite validates:
 * - Schema generation from n8n node properties
 * - Type conversion accuracy (string, number, boolean, options, etc.)
 * - Schema validation and parameter checking
 * - Memory efficiency and caching
 *
 * @architecture Dynamic schema generation for zero-hardcoded validation
 * @coverage Target: 100% schema generation coverage
 */

import type { N8nNode } from '../../discovery/n8n-api-client.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { SchemaGenerator } from '../../discovery/schema-generator.js'

// Mock n8n node for testing schema generation
const mockHttpRequestNode: N8nNode = {
  name: 'n8n-nodes-base.httpRequest',
  displayName: 'HTTP Request',
  description: 'Makes HTTP requests to any URL',
  version: 1,
  properties: [
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      required: true,
      description: 'The URL to make the request to',
    },
    {
      displayName: 'Method',
      name: 'method',
      type: 'options',
      required: true,
      description: 'HTTP method to use',
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
        { name: 'PUT', value: 'PUT' },
        { name: 'DELETE', value: 'DELETE' },
      ],
    },
    {
      displayName: 'Headers',
      name: 'headers',
      type: 'json',
      required: false,
      description: 'HTTP headers to send',
    },
    {
      displayName: 'Timeout',
      name: 'timeout',
      type: 'number',
      required: false,
      default: 5000,
      description: 'Request timeout in milliseconds',
      typeOptions: {
        minValue: 100,
        maxValue: 60000,
      },
    },
    {
      displayName: 'Follow Redirects',
      name: 'followRedirects',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Whether to follow HTTP redirects',
    },
  ],
  group: ['transform'],
}

const mockComplexNode: N8nNode = {
  name: 'n8n-nodes-base.emailSend',
  displayName: 'Email Send',
  description: 'Sends emails via SMTP',
  version: 1,
  properties: [
    {
      displayName: 'To Email',
      name: 'toEmail',
      type: 'string',
      required: true,
      description: 'Email address to send to',
      typeOptions: {
        validation: 'email',
      },
    },
    {
      displayName: 'Priority',
      name: 'priority',
      type: 'options',
      required: false,
      description: 'Email priority',
      options: [
        { name: 'High', value: 'high' },
        { name: 'Normal', value: 'normal' },
        { name: 'Low', value: 'low' },
      ],
    },
    {
      displayName: 'CC Recipients',
      name: 'ccEmails',
      type: 'multiOptions',
      required: false,
      description: 'CC email addresses',
      options: [], // Will be populated dynamically
    },
    {
      displayName: 'Send Date',
      name: 'sendDate',
      type: 'dateTime',
      required: false,
      description: 'When to send the email',
    },
  ],
  group: ['communication'],
}

describe('dynamic Schema Generation', () => {
  let schemaGenerator: SchemaGenerator

  beforeEach(() => {
    schemaGenerator = new SchemaGenerator()
  })

  describe('basic Schema Generation', () => {
    it('should generate schema for HTTP Request node', () => {
      const result = schemaGenerator.generateSchemaForNode(mockHttpRequestNode)

      expect(result).toBeTruthy()
      expect(result.schema).toBeTruthy()
      expect(result.documentation).toBeTruthy()
      expect(result.required).toContain('url')
      expect(result.required).toContain('method')
      expect(result.optional).toContain('headers')
      expect(result.optional).toContain('timeout')
      expect(result.optional).toContain('followRedirects')
    })

    it('should generate proper Zod types for different parameter types', () => {
      const result = schemaGenerator.generateSchemaForNode(mockHttpRequestNode)
      const schema = result.schema

      // All schema entries should be defined
      expect(schema.url).toBeDefined()
      expect(schema.method).toBeDefined()
      expect(schema.headers).toBeDefined()
      expect(schema.timeout).toBeDefined()
      expect(schema.followRedirects).toBeDefined()

      // Should be able to create a valid Zod object
      const zodObject = z.object(schema)
      expect(zodObject).toBeTruthy()
    })

    it('should handle required vs optional parameters correctly', () => {
      const result = schemaGenerator.generateSchemaForNode(mockHttpRequestNode)
      const schema = z.object(result.schema)

      // Test valid data
      const validData = {
        url: 'https://api.example.com',
        method: 'GET',
      }

      const parseResult = schema.safeParse(validData)
      expect(parseResult.success).toBe(true)

      // Test missing required field
      const invalidData = {
        method: 'GET',
        // Missing required 'url'
      }

      const parseResult2 = schema.safeParse(invalidData)
      expect(parseResult2.success).toBe(false)
    })
  })

  describe('advanced Type Handling', () => {
    it('should handle email validation for string types', () => {
      const result = schemaGenerator.generateSchemaForNode(mockComplexNode)
      const schema = z.object(result.schema)

      // Valid email should pass
      const validData = {
        toEmail: 'test@example.com',
      }
      expect(schema.safeParse(validData).success).toBe(true)

      // Invalid email should fail
      const invalidData = {
        toEmail: 'not-an-email',
      }
      expect(schema.safeParse(invalidData).success).toBe(false)
    })

    it('should handle options with proper enum validation', () => {
      const result = schemaGenerator.generateSchemaForNode(mockComplexNode)
      const schema = z.object(result.schema)

      // Valid option should pass
      const validData = {
        toEmail: 'test@example.com',
        priority: 'high',
      }
      expect(schema.safeParse(validData).success).toBe(true)

      // Invalid option should fail
      const invalidData = {
        toEmail: 'test@example.com',
        priority: 'invalid-priority',
      }
      expect(schema.safeParse(invalidData).success).toBe(false)
    })

    it('should handle number ranges correctly', () => {
      const result = schemaGenerator.generateSchemaForNode(mockHttpRequestNode)
      const schema = z.object(result.schema)

      // Valid timeout within range
      const validData = {
        url: 'https://api.example.com',
        method: 'GET',
        timeout: 5000,
      }
      expect(schema.safeParse(validData).success).toBe(true)

      // Timeout below minimum
      const invalidData = {
        url: 'https://api.example.com',
        method: 'GET',
        timeout: 50, // Below minimum of 100
      }
      expect(schema.safeParse(invalidData).success).toBe(false)
    })

    it('should handle dateTime types', () => {
      const result = schemaGenerator.generateSchemaForNode(mockComplexNode)
      const schema = z.object(result.schema)

      // Valid ISO datetime
      const validData = {
        toEmail: 'test@example.com',
        sendDate: '2024-01-15T10:30:00Z',
      }
      expect(schema.safeParse(validData).success).toBe(true)

      // Valid date only
      const validData2 = {
        toEmail: 'test@example.com',
        sendDate: '2024-01-15',
      }
      expect(schema.safeParse(validData2).success).toBe(true)

      // Invalid date format
      const invalidData = {
        toEmail: 'test@example.com',
        sendDate: 'not-a-date',
      }
      expect(schema.safeParse(invalidData).success).toBe(false)
    })
  })

  describe('batch Schema Generation', () => {
    it('should generate schemas for multiple nodes efficiently', () => {
      const nodes = [mockHttpRequestNode, mockComplexNode]

      const schemas = schemaGenerator.generateSchemasForNodes(nodes)

      expect(schemas.size).toBe(2)
      expect(schemas.has(mockHttpRequestNode.name)).toBe(true)
      expect(schemas.has(mockComplexNode.name)).toBe(true)
    })

    it('should handle errors gracefully during batch generation', () => {
      const invalidNode: N8nNode = {
        name: 'invalid-node',
        displayName: 'Invalid Node',
        description: 'Node with invalid properties',
        version: 1,
        properties: [
          {
            displayName: 'Invalid',
            name: 'invalid',
            type: 'unknown-type' as any,
            required: true,
            description: 'Invalid property type',
          },
        ],
        group: ['test'],
      }

      const nodes = [mockHttpRequestNode, invalidNode]

      const schemas = schemaGenerator.generateSchemasForNodes(nodes)

      // Should still generate 2 schemas (one with fallback for invalid node)
      expect(schemas.size).toBe(2)
      expect(schemas.has(mockHttpRequestNode.name)).toBe(true)
      expect(schemas.has(invalidNode.name)).toBe(true)
    })
  })

  describe('schema Validation', () => {
    it('should validate schemas against sample data', () => {
      const result = schemaGenerator.generateSchemaForNode(mockHttpRequestNode)

      const validData = {
        url: 'https://api.example.com',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        followRedirects: true,
      }

      const validation = schemaGenerator.validateSchema(result, validData)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect validation errors', () => {
      const result = schemaGenerator.generateSchemaForNode(mockHttpRequestNode)

      const invalidData = {
        url: 'not-a-url',
        method: 'INVALID_METHOD',
        timeout: -100, // Below minimum
      }

      const validation = schemaGenerator.validateSchema(result, invalidData)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    it('should detect missing required fields', () => {
      const result = schemaGenerator.generateSchemaForNode(mockHttpRequestNode)

      const incompleteData = {
        method: 'GET',
        // Missing required 'url'
      }

      const validation = schemaGenerator.validateSchema(result, incompleteData)

      expect(validation.valid).toBe(false)
      expect(validation.warnings.some(w => w.includes('url'))).toBe(true)
    })
  })

  describe('memory Management and Caching', () => {
    it('should cache generated schemas', () => {
      // Generate schema twice
      const result1 = schemaGenerator.generateSchemaForNode(mockHttpRequestNode)
      const result2 = schemaGenerator.generateSchemaForNode(mockHttpRequestNode)

      // Should return same object (cached)
      expect(result1).toBe(result2)
    })

    it('should provide statistics', () => {
      schemaGenerator.generateSchemaForNode(mockHttpRequestNode)
      schemaGenerator.generateSchemaForNode(mockComplexNode)

      const stats = schemaGenerator.getStatistics()

      expect(stats.cachedSchemas).toBeGreaterThanOrEqual(2)
      expect(stats.maxCacheSize).toBeTruthy()
      expect(stats.memoryEfficient).toBe(true)
      expect(Array.isArray(stats.supportedTypes)).toBe(true)
    })

    it('should clear cache when requested', () => {
      schemaGenerator.generateSchemaForNode(mockHttpRequestNode)

      let stats = schemaGenerator.getStatistics()
      expect(stats.cachedSchemas).toBeGreaterThan(0)

      schemaGenerator.clearCache()

      stats = schemaGenerator.getStatistics()
      expect(stats.cachedSchemas).toBe(0)
    })
  })

  describe('token Optimization', () => {
    it('should respect token optimization options', () => {
      const resultOptimized = schemaGenerator.generateSchemaForNode(mockHttpRequestNode, {
        tokenOptimized: true,
      })

      const resultFull = schemaGenerator.generateSchemaForNode(mockHttpRequestNode, {
        tokenOptimized: false,
      })

      // Both should work, but may have different internal handling
      expect(resultOptimized.schema).toBeTruthy()
      expect(resultFull.schema).toBeTruthy()
    })

    it('should handle optional parameter inclusion', () => {
      const resultWithOptional = schemaGenerator.generateSchemaForNode(mockHttpRequestNode, {
        includeOptional: true,
      })

      const resultWithoutOptional = schemaGenerator.generateSchemaForNode(mockHttpRequestNode, {
        includeOptional: false,
      })

      expect(resultWithOptional.optional.length).toBeGreaterThanOrEqual(
        resultWithoutOptional.optional.length,
      )
    })
  })
})
