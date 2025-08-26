/**
 * Memory Leak Detection and Resource Management Tests
 *
 * This suite specifically tests for memory leaks, resource cleanup,
 * and long-running server stability patterns.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { agentRouter } from '../../agents/index.js'
import { database } from '../../database/index.js'
import { N8NMcpServer } from '../../index.js'
import { inputSanitizer } from '../../server/security.js'
import { N8NMCPTools } from '../../tools/index.js'
import { httpClient } from '../../utils/enhanced-http-client.js'
import { memoryManager } from '../../utils/memory-manager.js'

describe('memory Leak Detection & Resource Management', () => {
  let server: N8NMcpServer

  beforeAll(async () => {
    await database.initialize()
    server = new N8NMcpServer()
  })

  describe('memory Leak Detection', () => {
    it('should not leak memory during repeated tool execution', async () => {
      const initialMemory = process.memoryUsage()
      const iterations = 1000

      // Force initial GC if available
      if (globalThis.gc) {
        globalThis.gc()
        // Wait for GC to complete
        await new Promise(resolve => setImmediate(resolve))
      }

      const baselineMemory = process.memoryUsage()
      console.log(`Baseline memory: ${Math.round(baselineMemory.heapUsed / 1024 / 1024)}MB`)

      // Run many tool executions
      for (let i = 0; i < iterations; i++) {
        try {
          await N8NMCPTools.executeTool('search_n8n_nodes', { query: `test${i}` })
          await agentRouter.routeToAgent(`query ${i}`)
          inputSanitizer.sanitizeString(`input ${i}`)
        }
        catch {
          // Ignore errors, we're testing memory
        }

        // Periodic GC hints
        if (i % 100 === 0 && globalThis.gc) {
          globalThis.gc()
        }
      }

      // Final GC
      if (globalThis.gc) {
        globalThis.gc()
        await new Promise(resolve => setImmediate(resolve))
      }

      const finalMemory = process.memoryUsage()
      const memoryGrowth = finalMemory.heapUsed - baselineMemory.heapUsed
      const memoryGrowthMB = Math.round(memoryGrowth / 1024 / 1024)

      console.log(`Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`)
      console.log(`Memory growth: ${memoryGrowthMB}MB after ${iterations} operations`)

      // Memory growth should be minimal (<50MB for 1000 operations)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024) // Less than 50MB growth

      // Memory growth should be reasonable per operation (<50KB per operation)
      const growthPerOperation = memoryGrowth / iterations
      expect(growthPerOperation).toBeLessThan(50 * 1024) // Less than 50KB per operation
    })

    it('should cleanup resources after server operations', async () => {
      const initialHandles = process._getActiveHandles().length
      const initialRequests = process._getActiveRequests().length

      // Perform various operations that might create handles/requests
      const operations = Array.from({ length: 50 }, (_, i) =>
        N8NMCPTools.executeTool('get_system_health', {}).catch(() => null))

      await Promise.all(operations)

      // Allow cleanup time
      await new Promise(resolve => setTimeout(resolve, 100))

      const finalHandles = process._getActiveHandles().length
      const finalRequests = process._getActiveRequests().length

      console.log(`Handles: ${initialHandles} -> ${finalHandles}`)
      console.log(`Requests: ${initialRequests} -> ${finalRequests}`)

      // Should not accumulate handles/requests
      expect(finalHandles - initialHandles).toBeLessThan(5) // Some handles are expected
      expect(finalRequests - initialRequests).toBeLessThan(2) // Minimal request accumulation
    })

    it('should handle rapid object creation/destruction', async () => {
      const initialMemory = process.memoryUsage()

      if (globalThis.gc) {
        globalThis.gc()
      }

      const baselineMemory = process.memoryUsage()

      // Create and destroy many temporary objects
      for (let i = 0; i < 1000; i++) {
        // Simulate typical MCP operations with temporary objects
        const tempContext = {
          requestId: `req_${i}`,
          timestamp: Date.now(),
          data: Array.from({ length: 100 }, (_, j) => ({
            id: j,
            value: `value_${i}_${j}`,
            metadata: { created: Date.now() },
          })),
          processing: {
            sanitized: inputSanitizer.sanitizeString(`test input ${i}`),
            routed: await agentRouter.routeToAgent(`test query ${i}`),
          },
        }

        // Process the temporary data
        tempContext.data.filter(item => item.id % 2 === 0)
        tempContext.data.map(item => item.value.toUpperCase())

        // Objects should be eligible for GC after scope
      }

      // Force cleanup
      if (globalThis.gc) {
        globalThis.gc()
        await new Promise(resolve => setImmediate(resolve))
      }

      const finalMemory = process.memoryUsage()
      const memoryGrowth = finalMemory.heapUsed - baselineMemory.heapUsed
      const memoryGrowthMB = Math.round(memoryGrowth / 1024 / 1024)

      console.log(`Object creation/destruction memory growth: ${memoryGrowthMB}MB`)

      // Should have minimal residual memory growth
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024) // Less than 20MB residual
    })

    it('should detect and report potential memory leaks', async () => {
      const memoryReport = memoryManager.getMemoryReport()

      console.log('Memory Manager Report:', {
        level: memoryReport.level,
        suspected: memoryReport.leak.suspected,
        trend: memoryReport.leak.trend,
        current: {
          heapUsed: `${Math.round(memoryReport.current.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryReport.current.heapTotal / 1024 / 1024)}MB`,
        },
      })

      // Memory manager should not detect leaks in normal operation
      expect(memoryReport.leak.suspected).toBe(false)
      expect(memoryReport.level).not.toBe('critical')

      // Memory usage should be reasonable
      expect(memoryReport.current.heapUsed).toBeLessThan(100 * 1024 * 1024) // Less than 100MB
    })
  })

  describe('resource Cleanup Validation', () => {
    it('should cleanup HTTP client resources', async () => {
      const initialStats = httpClient.getStats()

      // Make several HTTP operations (if configured)
      const operations = Array.from({ length: 10 }, () =>
        httpClient.get('https://httpbin.org/delay/0.1').catch(() => null))

      await Promise.all(operations)

      const finalStats = httpClient.getStats()
      const poolStats = httpClient.getPoolStats()

      console.log('HTTP Client Stats:', {
        requests: finalStats.requests - initialStats.requests,
        cacheSize: finalStats.cacheSize,
        poolCount: finalStats.poolCount,
        pools: Object.keys(poolStats).length,
      })

      // Should not accumulate excessive cached responses
      expect(finalStats.cacheSize).toBeLessThan(100) // Reasonable cache size

      // Pool count should be stable
      expect(finalStats.poolCount).toBeLessThan(10) // Limited pools
    })

    it('should cleanup database connections properly', async () => {
      if (!database.prepare) {
        console.log('Database not available for cleanup testing')
        return
      }

      const initialMetrics = database.getPerformanceMetrics()

      // Perform database operations
      for (let i = 0; i < 100; i++) {
        try {
          const stmt = database.prepare('SELECT COUNT(*) as count FROM nodes WHERE name LIKE ?')
          stmt.get(`%test${i}%`)
        }
        catch {
          // Ignore query errors
        }
      }

      const finalMetrics = database.getPerformanceMetrics()

      console.log('Database Performance:', {
        queriesExecuted: finalMetrics.queriesExecuted - initialMetrics.queriesExecuted,
        averageQueryTime: finalMetrics.averageQueryTime,
        connectionPoolSize: finalMetrics.connectionPoolSize,
      })

      // Database performance should remain stable
      expect(finalMetrics.averageQueryTime).toBeLessThan(100) // Less than 100ms average
      expect(finalMetrics.connectionPoolSize || 1).toBeLessThan(5) // Limited connections
    })

    it('should handle server restart scenarios', async () => {
      const initialMemory = process.memoryUsage()

      // Simulate server restart by creating/destroying server instances
      for (let i = 0; i < 5; i++) {
        const testServer = new N8NMcpServer()

        // Simulate some work
        await Promise.resolve(testServer)

        // Allow cleanup
        await new Promise(resolve => setImmediate(resolve))
      }

      if (globalThis.gc) {
        globalThis.gc()
        await new Promise(resolve => setImmediate(resolve))
      }

      const finalMemory = process.memoryUsage()
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed
      const memoryGrowthMB = Math.round(memoryGrowth / 1024 / 1024)

      console.log(`Server restart memory growth: ${memoryGrowthMB}MB`)

      // Should not accumulate memory across server instances
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024) // Less than 10MB growth
    })
  })

  describe('long-Running Stability', () => {
    it('should maintain stable memory usage over extended operation', async () => {
      const duration = 10000 // 10 seconds
      const startTime = Date.now()
      const memorySnapshots: number[] = []

      // Initial memory
      if (globalThis.gc)
        globalThis.gc()
      const initialMemory = process.memoryUsage().heapUsed

      let operationCount = 0

      // Run operations continuously for duration
      while (Date.now() - startTime < duration) {
        try {
          await agentRouter.routeToAgent(`stability test ${operationCount}`)
          inputSanitizer.sanitizeString(`test data ${operationCount}`)
        }
        catch {
          // Ignore errors
        }

        operationCount++

        // Take memory snapshots
        if (operationCount % 50 === 0) {
          memorySnapshots.push(process.memoryUsage().heapUsed)
        }

        // Small delay
        await new Promise(resolve => setImmediate(resolve))
      }

      // Final GC and memory check
      if (globalThis.gc)
        globalThis.gc()
      await new Promise(resolve => setImmediate(resolve))

      const finalMemory = process.memoryUsage().heapUsed
      const totalGrowth = finalMemory - initialMemory
      const growthMB = Math.round(totalGrowth / 1024 / 1024)

      // Analyze memory trend
      const firstHalf = memorySnapshots.slice(0, Math.floor(memorySnapshots.length / 2))
      const secondHalf = memorySnapshots.slice(Math.floor(memorySnapshots.length / 2))

      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

      const memoryTrend = secondHalfAvg - firstHalfAvg
      const trendMB = Math.round(memoryTrend / 1024 / 1024)

      console.log(`Long-running stability test:`)
      console.log(`  Duration: ${duration}ms`)
      console.log(`  Operations: ${operationCount}`)
      console.log(`  Total memory growth: ${growthMB}MB`)
      console.log(`  Memory trend: ${trendMB}MB (first half vs second half)`)

      // Memory should be stable over time
      expect(totalGrowth).toBeLessThan(50 * 1024 * 1024) // Less than 50MB total growth
      expect(Math.abs(memoryTrend)).toBeLessThan(20 * 1024 * 1024) // Stable trend (<20MB drift)

      // Should complete reasonable number of operations
      expect(operationCount).toBeGreaterThan(100) // At least 100 ops in 10s
    }, 15000) // 15 second timeout
  })
})
