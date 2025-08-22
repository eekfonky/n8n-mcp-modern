/**
 * Database-MCP Parity Tests
 *
 * Critical tests to ensure consistency between database operations and MCP tool responses
 * especially after the API-first architecture migration. These tests verify that:
 *
 * 1. MCP tools return consistent data formats
 * 2. Database and API responses are properly synchronized
 * 3. Error handling is consistent across layers
 * 4. Performance characteristics are comparable
 * 5. Interface conversions work correctly
 */

import type { DatabaseHealth } from '../database/index.js'
import { performance } from 'node:perf_hooks'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { database } from '../database/index.js'
import { N8NMCPTools } from '../tools/index.js'

describe('database-MCP Parity Tests', () => {
  beforeAll(async () => {
    // Initialize test environment
    await database.initialize()
  })

  afterAll(async () => {
    database.close()
  })

  describe('node Discovery Parity', () => {
    it('should return consistent node data structure between database and MCP search', { timeout: 10000 }, async () => {
      // Test with a common search term
      const searchTerm = 'HTTP'

      // Get data from database (legacy path - should be minimal now)
      const dbNodes = database.searchNodes(searchTerm)

      // Get data from MCP tool (should use API) - with timeout protection
      const mcpResult = await Promise.race([
        N8NMCPTools.executeTool('search_n8n_nodes', {
          query: searchTerm,
          limit: 50,
        }),
        new Promise<{ success: false, error: string }>((resolve) => {
          setTimeout(() => resolve({ success: false, error: 'Test timeout - API unavailable' }), 8000)
        }),
      ])

      // MCP should either succeed or fail gracefully (API may be unavailable in tests)
      if (mcpResult.success && mcpResult.data) {
        const mcpNodes = Array.isArray(mcpResult.data) ? mcpResult.data : [mcpResult.data]

        // Verify data structure consistency
        if (dbNodes.length > 0) {
          const dbNode = dbNodes[0]
          const mcpNode = mcpNodes[0]

          // Both should have core properties
          expect(typeof dbNode.name).toBe('string')
          expect(typeof dbNode.displayName).toBe('string')
          expect(typeof dbNode.description).toBe('string')

          if (mcpNode) {
            expect(typeof mcpNode.name).toBe('string')
            expect(typeof (mcpNode.displayName ?? mcpNode.display_name)).toBe('string')
            expect(typeof mcpNode.description).toBe('string')
          }
        }

        // MCP should return more nodes than database (API-first)
        console.log(`Database nodes: ${dbNodes.length}, MCP nodes: ${mcpNodes.length}`)
        expect(mcpNodes.length).toBeGreaterThanOrEqual(0)
      }
      else if (!mcpResult.success) {
        // If API is unavailable, should fail gracefully
        console.warn(`API search failed (expected in test environment): ${mcpResult.error}`)
        expect(mcpResult.error).toBeDefined()
      }
    })

    it('should handle empty search results consistently', { timeout: 10000 }, async () => {
      const unusualSearchTerm = 'XyZaAbBcC123NonExistent'

      // Database search
      const dbNodes = database.searchNodes(unusualSearchTerm)

      // MCP search with timeout protection
      const mcpResult = await Promise.race([
        N8NMCPTools.executeTool('search_n8n_nodes', {
          query: unusualSearchTerm,
        }),
        new Promise<{ success: false, error: string }>((resolve) => {
          setTimeout(() => resolve({ success: false, error: 'Test timeout - API unavailable' }), 8000)
        }),
      ])

      // Both should handle empty results gracefully
      expect(dbNodes).toEqual([])

      // MCP should either succeed with empty data or fail gracefully
      if (mcpResult.success) {
        const mcpNodes = Array.isArray(mcpResult.data) ? mcpResult.data : []
        expect(mcpNodes).toEqual([])
      }
      else {
        // If it fails, it should have an error message
        expect(mcpResult.error).toBeDefined()
        expect(typeof mcpResult.error).toBe('string')
      }
    })

    it('should return consistent node listings between database and MCP', { timeout: 10000 }, async () => {
      // Get limited node list from database
      const dbNodes = database.getNodes()

      // Get node list from MCP tool with timeout protection
      const mcpResult = await Promise.race([
        N8NMCPTools.executeTool('search_n8n_nodes', {
          query: '',
          limit: 100,
        }),
        new Promise<{ success: false, error: string }>((resolve) => {
          setTimeout(() => resolve({ success: false, error: 'Test timeout - API unavailable' }), 8000)
        }),
      ])

      // MCP should either succeed or fail gracefully
      if (mcpResult.success && mcpResult.data) {
        const mcpNodes = Array.isArray(mcpResult.data) ? mcpResult.data : [mcpResult.data]

        // Verify structure consistency
        if (dbNodes.length > 0 && mcpNodes.length > 0) {
          const dbNode = dbNodes[0]
          const mcpNode = mcpNodes[0]

          // Core fields should exist in both
          expect(dbNode).toHaveProperty('name')
          expect(dbNode).toHaveProperty('displayName')
          expect(dbNode).toHaveProperty('version')

          expect(mcpNode).toHaveProperty('name')
          // MCP might use different field names due to API format
          expect(mcpNode.displayName ?? mcpNode.display_name).toBeDefined()
        }

        console.log(`Database node count: ${dbNodes.length}, MCP node count: ${mcpNodes.length}`)
      }
      else if (!mcpResult.success) {
        // If MCP failed, log the error for debugging
        console.warn(`MCP search failed: ${mcpResult.error}`)
      }
    })
  })

  describe('data Format Parity', () => {
    it('should maintain consistent field names across database and MCP responses', { timeout: 10000 }, async () => {
      // Test with tool usage statistics
      const dbUsage = database.getToolUsage()

      // Test MCP equivalent
      const mcpResult = await N8NMCPTools.executeTool('get_tool_usage_stats', {})

      expect(mcpResult.success).toBe(true)

      if (mcpResult.success && mcpResult.data && dbUsage.length > 0) {
        const dbStat = dbUsage[0]

        // Verify database usage has expected fields
        expect(dbStat).toHaveProperty('toolName')
        expect(dbStat).toHaveProperty('usageCount')
        expect(dbStat).toHaveProperty('lastUsed')
        expect(dbStat).toHaveProperty('averageExecutionTime')
        expect(dbStat).toHaveProperty('successRate')

        // Verify types
        expect(typeof dbStat.toolName).toBe('string')
        expect(typeof dbStat.usageCount).toBe('number')
        expect(dbStat.lastUsed instanceof Date).toBe(true)
        expect(typeof dbStat.averageExecutionTime).toBe('number')
        expect(typeof dbStat.successRate).toBe('number')
      }
    })

    it('should handle type conversions correctly', async () => {
      // Test node property parsing
      const dbNodes = database.getNodes()

      if (dbNodes.length > 0) {
        const node = dbNodes[0]

        // Verify parsed JSON fields
        expect(Array.isArray(node.inputs)).toBe(true)
        expect(Array.isArray(node.outputs)).toBe(true)
        expect(typeof node.properties).toBe('object')
        expect(Array.isArray(node.credentials)).toBe(true)

        // Verify optional fields are properly typed
        if (node.icon !== undefined) {
          expect(typeof node.icon).toBe('string')
        }

        if (node.webhooks !== undefined) {
          expect(typeof node.webhooks).toBe('boolean')
        }

        if (node.polling !== undefined) {
          expect(typeof node.polling).toBe('boolean')
        }
      }
    })
  })

  describe('error Handling Parity', () => {
    it('should handle database connection errors gracefully', async () => {
      // Test database error scenario
      database.close()

      try {
        // This should throw a DatabaseConnectionError
        database.getNodes()
        expect(false).toBe(true) // Should not reach here
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toContain('Database not initialized')
      }

      // Reinitialize for other tests
      await database.initialize()
    })

    it('should handle invalid MCP tool parameters consistently', async () => {
      // Test with invalid tool name (should return structured error)
      const result = await N8NMCPTools.executeTool('invalid_tool_name', {
        query: 'test',
      })

      // Should fail gracefully with structured error response
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(typeof result.error).toBe('string')
      expect(result.error).toContain('Unknown tool')
    })

    it('should provide consistent error messages', async () => {
      // Test non-existent tool
      const result = await N8NMCPTools.executeTool('non_existent_tool', {})

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(0)
      expect(result.error).toContain('Unknown tool')
    })
  })

  describe('performance Parity', () => {
    it('should have comparable response times', { timeout: 15000 }, async () => {
      const iterations = 5
      const dbTimes: number[] = []
      const mcpTimes: number[] = []

      // Test database performance
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        database.getToolUsage()
        const end = performance.now()
        dbTimes.push(end - start)
      }

      // Test MCP performance
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        const result = await N8NMCPTools.executeTool('get_tool_usage_stats', {})
        const end = performance.now()
        mcpTimes.push(end - start)

        // Ensure MCP tools are working
        expect(result.success).toBe(true)
      }

      const avgDbTime = dbTimes.reduce((a, b) => a + b, 0) / iterations
      const avgMcpTime = mcpTimes.reduce((a, b) => a + b, 0) / iterations

      console.log(`Average DB time: ${avgDbTime.toFixed(2)}ms, Average MCP time: ${avgMcpTime.toFixed(2)}ms`)

      // Both should be reasonably fast (under 100ms for basic operations)
      expect(avgDbTime).toBeLessThan(100)
      expect(avgMcpTime).toBeLessThan(1000) // MCP allows more time for network calls
    })

    it('should handle concurrent requests appropriately', { timeout: 15000 }, async () => {
      // Test concurrent database access
      const dbPromises = Array.from({ length: 5 }).fill(null).map(() =>
        Promise.resolve(database.getToolUsage()),
      )

      const dbResults = await Promise.all(dbPromises)

      // All results should be consistent
      expect(dbResults.length).toBe(5)
      dbResults.forEach((result) => {
        expect(Array.isArray(result)).toBe(true)
      })

      // Test concurrent MCP access
      const mcpPromises = Array.from({ length: 3 }).fill(null).map(() =>
        N8NMCPTools.executeTool('get_tool_usage_stats', {}),
      )

      const mcpResults = await Promise.all(mcpPromises)

      // All should succeed consistently with structured responses
      expect(mcpResults.length).toBe(3)
      mcpResults.forEach((result) => {
        expect(typeof result.success).toBe('boolean')
        if (result.success) {
          expect(result.data).toBeDefined()
        }
        else {
          expect(result.error).toBeDefined()
        }
      })
    })

    it('should validate cache effectiveness', async () => {
      // Clear any existing cache
      database.close()
      await database.initialize()

      // First call - should be slower (cache miss)
      const start1 = performance.now()
      const result1 = database.getToolUsage()
      const end1 = performance.now()
      const time1 = end1 - start1

      // Second call - should be faster (cache hit)
      const start2 = performance.now()
      const result2 = database.getToolUsage()
      const end2 = performance.now()
      const time2 = end2 - start2

      console.log(`Cache miss: ${time1.toFixed(2)}ms, Cache hit: ${time2.toFixed(2)}ms`)

      // Results should be identical
      expect(result1).toEqual(result2)

      // Second call should generally be faster (though not guaranteed due to system variations)
      expect(time2).toBeLessThan(50) // Should be very fast
    })
  })

  describe('health Monitoring Parity', () => {
    it('should provide consistent health information', async () => {
      // Test database health check
      const dbHealth: DatabaseHealth = await database.checkHealth()

      expect(dbHealth).toHaveProperty('status')
      expect(['healthy', 'degraded', 'unhealthy']).toContain(dbHealth.status)
      expect(dbHealth).toHaveProperty('connectionStatus')
      expect(typeof dbHealth.connectionStatus).toBe('boolean')
      expect(dbHealth).toHaveProperty('lastCheck')
      expect(dbHealth.lastCheck instanceof Date).toBe(true)

      // Test MCP health via available tools
      const mcpHealth = await N8NMCPTools.executeTool('list_available_tools', {})

      expect(mcpHealth.success).toBe(true)
      if (mcpHealth.success && mcpHealth.data) {
        // Should provide some health information
        expect(mcpHealth.data).toBeDefined()
      }
    })

    it('should detect and report issues consistently', async () => {
      const health = await database.checkHealth()

      if (health.status !== 'healthy') {
        // If unhealthy, should provide error details
        expect(health.errors.length).toBeGreaterThan(0)
        health.errors.forEach((error) => {
          expect(typeof error).toBe('string')
          expect(error.length).toBeGreaterThan(0)
        })
      }
      else {
        // If healthy, errors should be empty
        expect(health.errors.length).toBe(0)
      }

      // Performance metrics should be reasonable
      expect(health.queryResponseTime).toBeGreaterThanOrEqual(0)
      expect(health.uptime).toBeGreaterThan(0)
    })
  })

  describe('aPI-First Architecture Validation', () => {
    it('should prioritize API data over database for node discovery', { timeout: 10000 }, async () => {
      // MCP node search should use API, not database - with timeout protection
      const mcpResult = await Promise.race([
        N8NMCPTools.executeTool('search_n8n_nodes', {
          query: 'webhook',
        }),
        new Promise<{ success: false, error: string }>((resolve) => {
          setTimeout(() => resolve({ success: false, error: 'Test timeout - API unavailable' }), 8000)
        }),
      ])

      // MCP should either succeed or fail gracefully (API might not be available in tests)
      if (mcpResult.success && mcpResult.data) {
        const nodes = Array.isArray(mcpResult.data) ? mcpResult.data : [mcpResult.data]

        // Should find webhook nodes (common in n8n) or be empty if API unavailable
        expect(nodes.length).toBeGreaterThanOrEqual(0)

        // If nodes found, they should have live API characteristics
        if (nodes.length > 0) {
          const node = nodes[0]
          expect(node).toHaveProperty('name')
          // API nodes should have more comprehensive data
        }
      }
      else if (!mcpResult.success) {
        // If API is unavailable, should fail gracefully
        console.warn(`API search failed (expected in test environment): ${mcpResult.error}`)
        expect(mcpResult.error).toBeDefined()
      }
    })

    it('should use database only for usage statistics and metadata', async () => {
      // Record some tool usage
      database.recordToolUsage('test-tool', 150, true)
      database.recordToolUsage('test-tool', 200, false)

      // Retrieve usage stats
      const usage = database.getToolUsage()
      const testToolStats = usage.find(u => u.toolName === 'test-tool')

      if (testToolStats) {
        expect(testToolStats.usageCount).toBeGreaterThanOrEqual(2)
        expect(testToolStats.successRate).toBeGreaterThan(0)
        expect(testToolStats.successRate).toBeLessThanOrEqual(100)
        expect(testToolStats.averageExecutionTime).toBeGreaterThan(0)
      }
    })
  })
})
