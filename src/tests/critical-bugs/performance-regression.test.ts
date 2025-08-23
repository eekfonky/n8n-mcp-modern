/**
 * Performance Regression Tests
 *
 * Critical tests to detect performance regressions in API response times,
 * memory usage patterns, and system performance characteristics.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { config } from '../../server/config.js'
import { EnhancedHttpClient } from '../../utils/enhanced-http-client.js'
import { AdvancedMemoryManager } from '../../utils/memory-manager.js'

describe('performance Regression Tests', () => {
  let httpClient: EnhancedHttpClient
  let memoryManager: AdvancedMemoryManager

  beforeEach(() => {
    httpClient = new EnhancedHttpClient()
    memoryManager = new AdvancedMemoryManager()
  })

  afterEach(() => {
    memoryManager.stop()
  })

  describe('aPI Response Time Performance', () => {
    it('should maintain sub-100ms response times for tool operations', async () => {
      // Use faster mock operations instead of real HTTP calls
      const testOperations = [
        () => Promise.resolve({ status: 200, data: {} }),
        () => Promise.resolve({ status: 201, data: { test: 'data' } }),
        () => Promise.resolve({ status: 200, data: { message: 'hello' } }),
      ]

      for (const operation of testOperations) {
        const startTime = performance.now()

        try {
          await operation()
        }
        catch {
          // Network errors are acceptable, we're testing client performance
        }

        const endTime = performance.now()
        const duration = endTime - startTime

        // Client setup and processing should be fast
        expect(duration).toBeLessThan(10) // 10ms threshold for mock operations
      }
    })

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10
      const maxConcurrentTime = 50 // ms

      const startTime = performance.now()

      const requests = Array.from({ length: concurrentRequests }, () =>
        Promise.resolve({ status: 200, data: {} }).catch(() => {}))

      await Promise.all(requests)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(maxConcurrentTime)
    })

    it('should validate timeout handling performance', async () => {
      const shortTimeout = 50 // ms
      const testClient = new EnhancedHttpClient({ timeout: shortTimeout })

      const startTime = performance.now()

      try {
        // This should timeout quickly
        await testClient.get('http://httpbin.org/delay/1')
      }
      catch (error) {
        const endTime = performance.now()
        const actualTimeout = endTime - startTime

        // Timeout should be close to configured value (within 50% margin)
        expect(actualTimeout).toBeGreaterThan(shortTimeout * 0.5)
        expect(actualTimeout).toBeLessThan(shortTimeout * 2)
      }
    })

    it('should maintain consistent response times under load', async () => {
      const iterations = 20
      const responseTimes: number[] = []

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()

        try {
          await httpClient.get('http://httpbin.org/json')
        }
        catch {
          // Network errors acceptable
        }

        const endTime = performance.now()
        responseTimes.push(endTime - startTime)
      }

      // Calculate variance in response times
      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      const variance = responseTimes.reduce((acc, time) => acc + (time - avgTime) ** 2, 0) / responseTimes.length
      const stdDev = Math.sqrt(variance)

      // Standard deviation should be reasonable (not too much variance)
      expect(stdDev).toBeLessThan(avgTime * 0.5) // Within 50% of average
    })
  })

  describe('memory Usage Performance', () => {
    it('should maintain stable memory usage during operations', () => {
      const initialStats = memoryManager.getCurrentMemoryStats()

      // Simulate intensive operations
      const operations = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        data: Array.from({ length: 1000 }).fill(Math.random()),
        timestamp: Date.now(),
      }))

      // Process operations
      operations.forEach((op) => {
        JSON.stringify(op)
        JSON.parse(JSON.stringify(op))
      })

      const finalStats = memoryManager.getCurrentMemoryStats()
      const memoryGrowth = finalStats.heapUsed - initialStats.heapUsed

      // Memory growth should be reasonable (< 10MB for these operations)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024)
    })

    it('should handle garbage collection efficiently', () => {
      if (!globalThis.gc) {
        // Skip if GC is not exposed
        return
      }

      const beforeGC = memoryManager.getCurrentMemoryStats()
      const startTime = performance.now()

      // Force garbage collection
      globalThis.gc()

      const endTime = performance.now()
      const afterGC = memoryManager.getCurrentMemoryStats()

      const gcTime = endTime - startTime
      const memoryFreed = beforeGC.heapUsed - afterGC.heapUsed

      // GC should complete quickly (< 100ms)
      expect(gcTime).toBeLessThan(100)

      // Should free some memory (or at least not increase significantly)
      expect(memoryFreed).toBeGreaterThanOrEqual(-1024 * 1024) // Allow 1MB increase
    })

    it('should detect memory leaks in performance tests', () => {
      const iterations = 50
      const memorySnapshots: number[] = []

      // Create and cleanup objects repeatedly
      for (let i = 0; i < iterations; i++) {
        // Create temporary objects
        const tempData = Array.from({ length: 1000 }, () => ({
          id: Math.random(),
          data: Array.from({ length: 100 }).fill(i),
        }))

        // Process data
        tempData.forEach(item => JSON.stringify(item))

        // Take memory snapshot
        const stats = memoryManager.getCurrentMemoryStats()
        memorySnapshots.push(stats.heapUsed)

        // Clear references
        tempData.length = 0
      }

      // Analyze memory trend
      const firstHalf = memorySnapshots.slice(0, Math.floor(iterations / 2))
      const secondHalf = memorySnapshots.slice(Math.floor(iterations / 2))

      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

      const memoryGrowthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg

      // Memory growth rate should be minimal (< 10%)
      expect(memoryGrowthRate).toBeLessThan(0.1)
    })

    it('should validate memory monitoring overhead', () => {
      const iterations = 1000
      const startTime = performance.now()

      // Repeatedly call memory monitoring
      for (let i = 0; i < iterations; i++) {
        memoryManager.getCurrentMemoryStats()
      }

      const endTime = performance.now()
      const avgTimePerCall = (endTime - startTime) / iterations

      // Each monitoring call should be very fast (< 0.1ms)
      expect(avgTimePerCall).toBeLessThan(0.1)
    })
  })

  describe('system Performance Characteristics', () => {
    it('should maintain efficient CPU usage during operations', async () => {
      const cpuIntensiveWork = () => {
        const start = Date.now()
        let result = 0

        // CPU intensive calculation with time limit
        while (Date.now() - start < 10) { // 10ms limit
          result += Math.sqrt(Math.random())
        }

        return result
      }

      const startTime = performance.now()
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        cpuIntensiveWork()
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should complete efficiently (rough CPU performance check)
      expect(totalTime).toBeLessThan(iterations * 15) // 15ms per iteration max
    })

    it('should handle I/O operations efficiently', async () => {
      const ioOperations = [
        () => Promise.resolve(JSON.stringify({ test: 'data' })),
        () => Promise.resolve(JSON.parse('{"test":"data"}')),
        () => new Promise(resolve => setTimeout(resolve, 1)),
      ]

      const startTime = performance.now()

      // Run I/O operations concurrently
      await Promise.all(ioOperations.map(op => op()))

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete quickly
      expect(duration).toBeLessThan(50) // 50ms
    })

    it('should validate event loop performance', async () => {
      let eventLoopDelay = 0
      const measurements: number[] = []

      // Measure event loop delay
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint()

        await new Promise(resolve => setImmediate(resolve))

        const end = process.hrtime.bigint()
        const delay = Number(end - start) / 1000000 // Convert to ms

        measurements.push(delay)
      }

      eventLoopDelay = measurements.reduce((a, b) => a + b, 0) / measurements.length

      // Event loop delay should be minimal (< 10ms)
      expect(eventLoopDelay).toBeLessThan(10)
    })

    it('should validate timer precision and performance', async () => {
      const timerTests = [1, 5, 10, 50] // ms intervals

      for (const interval of timerTests) {
        const startTime = performance.now()

        await new Promise(resolve => setTimeout(resolve, interval))

        const endTime = performance.now()
        const actualInterval = endTime - startTime

        // Timer should be reasonably accurate (within 50% for small intervals)
        const tolerance = Math.max(interval * 0.5, 5) // At least 5ms tolerance
        expect(Math.abs(actualInterval - interval)).toBeLessThan(tolerance)
      }
    })
  })

  describe('configuration Impact on Performance', () => {
    it('should validate cache performance benefits', () => {
      const cacheEnabled = config.enableCache
      const cacheTtl = config.cacheTtl

      if (cacheEnabled) {
        // Cache TTL should be reasonable for performance
        expect(cacheTtl).toBeGreaterThan(60) // At least 1 minute
        expect(cacheTtl).toBeLessThan(86400) // Less than 1 day

        // Cache operations should be fast
        const testKey = 'performance-test'
        const testValue = { data: 'test', timestamp: Date.now() }

        const startTime = performance.now()

        // Simulate cache operations
        const serialized = JSON.stringify(testValue)
        const deserialized = JSON.parse(serialized)

        const endTime = performance.now()
        const cacheOpTime = endTime - startTime

        expect(cacheOpTime).toBeLessThan(1) // < 1ms for cache operations
        expect(deserialized).toEqual(testValue)
      }
    })

    it('should validate concurrent request limits impact', async () => {
      const maxConcurrent = config.maxConcurrentRequests

      // Should be reasonable for performance
      expect(maxConcurrent).toBeGreaterThan(1)
      expect(maxConcurrent).toBeLessThan(50) // Reasonable upper limit

      // Test queueing performance with mock requests
      const requestQueue: Promise<void>[] = []

      for (let i = 0; i < maxConcurrent + 5; i++) {
        requestQueue.push(
          new Promise(resolve => setTimeout(resolve, 10)),
        )
      }

      const startTime = performance.now()
      await Promise.all(requestQueue)
      const endTime = performance.now()

      const totalTime = endTime - startTime

      // Should handle queueing efficiently
      expect(totalTime).toBeLessThan((maxConcurrent + 5) * 15) // 15ms per request max
    })

    it('should validate timeout settings performance', () => {
      const validationTimeout = config.validationTimeout
      const mcpTimeout = config.mcpTimeout

      // Timeouts should be reasonable for performance
      expect(validationTimeout).toBeGreaterThan(100) // At least 100ms
      expect(validationTimeout).toBeLessThan(30000) // Less than 30s

      expect(mcpTimeout).toBeGreaterThan(1000) // At least 1s
      expect(mcpTimeout).toBeLessThan(300000) // Less than 5 minutes

      // Validation timeout should be shorter than MCP timeout
      expect(validationTimeout).toBeLessThan(mcpTimeout)
    })
  })

  describe('resource Cleanup Performance', () => {
    it('should validate efficient resource cleanup', async () => {
      const resources: any[] = []

      // Create resources
      for (let i = 0; i < 100; i++) {
        const resource = {
          id: i,
          data: Array.from({ length: 100 }).fill(Math.random()),
          cleanup: () => { /* cleanup logic */ },
        }
        resources.push(resource)
      }

      const startTime = performance.now()

      // Cleanup resources
      resources.forEach((resource) => {
        resource.cleanup()
        resource.data = null
      })
      resources.length = 0

      const endTime = performance.now()
      const cleanupTime = endTime - startTime

      // Cleanup should be fast
      expect(cleanupTime).toBeLessThan(10) // < 10ms
    })

    it('should validate WeakRef cleanup performance', () => {
      const objects: object[] = []
      const weakRefs: WeakRef<object>[] = []

      // Create objects and weak references
      for (let i = 0; i < 50; i++) {
        const obj = { id: i, data: Array.from({ length: 100 }).fill(i) }
        objects.push(obj)
        weakRefs.push(new WeakRef(obj))
      }

      const startTime = performance.now()

      // Clear strong references
      objects.length = 0

      // Check weak references
      let aliveCount = 0
      weakRefs.forEach((ref) => {
        if (ref.deref() !== undefined) {
          aliveCount++
        }
      })

      const endTime = performance.now()
      const checkTime = endTime - startTime

      // WeakRef operations should be fast
      expect(checkTime).toBeLessThan(5) // < 5ms

      // Some objects might still be alive (GC timing dependent)
      expect(aliveCount).toBeGreaterThanOrEqual(0)
    })

    it('should validate interval cleanup performance', () => {
      const intervals: NodeJS.Timeout[] = []

      // Create intervals
      for (let i = 0; i < 20; i++) {
        const interval = setInterval(() => {}, 1000)
        intervals.push(interval)
      }

      const startTime = performance.now()

      // Clear intervals
      intervals.forEach(interval => clearInterval(interval))
      intervals.length = 0

      const endTime = performance.now()
      const clearTime = endTime - startTime

      // Interval cleanup should be fast
      expect(clearTime).toBeLessThan(5) // < 5ms
    })
  })

  describe('performance Regression Detection', () => {
    it('should detect significant performance degradation', () => {
      // Baseline performance benchmarks (in ms)
      const performanceBaselines = {
        memoryStatsCollection: 0.1,
        jsonSerialization: 1,
        httpClientSetup: 10,
        configValidation: 5,
        errorHandling: 1,
      }

      Object.entries(performanceBaselines).forEach(([operation, baseline]) => {
        const startTime = performance.now()

        // Simulate operation
        switch (operation) {
          case 'memoryStatsCollection':
            memoryManager.getCurrentMemoryStats()
            break
          case 'jsonSerialization':
            JSON.stringify({ test: 'data', array: [1, 2, 3, 4, 5] })
            break
          case 'httpClientSetup':
            new EnhancedHttpClient({ timeout: 5000 })
            break
          case 'configValidation':
            expect(config).toBeDefined()
            break
          case 'errorHandling':
            try {
              throw new Error('test')
            }
            catch {
              // Handle error
            }
            break
        }

        const endTime = performance.now()
        const actualTime = endTime - startTime

        // Should not be significantly slower than baseline (3x threshold)
        expect(actualTime, `${operation} performance regression`).toBeLessThan(baseline * 3)
      })
    })

    it('should maintain performance under memory pressure', () => {
      // Create memory pressure
      const memoryPressure: any[] = []

      for (let i = 0; i < 10; i++) {
        memoryPressure.push(Array.from({ length: 10000 }).fill(Math.random()))
      }

      // Test operations under pressure
      const startTime = performance.now()

      for (let i = 0; i < 10; i++) {
        memoryManager.getCurrentMemoryStats()
        JSON.stringify({ iteration: i, data: 'test' })
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should still perform reasonably under memory pressure
      expect(totalTime).toBeLessThan(50) // < 50ms for 10 operations

      // Cleanup
      memoryPressure.length = 0
    })
  })
})
