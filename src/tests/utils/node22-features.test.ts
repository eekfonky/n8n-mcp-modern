/**
 * Node.js 22+ Features Tests
 * Tests for modern Node.js APIs and performance monitoring utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAsyncContext,
  parseCommandLineArgs,
  performanceMonitor,
  resourceMonitor,
} from '../../utils/node22-features.js'

describe('node.js 22+ Features Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any ongoing measurements
    performanceMonitor.clearAll()
  })

  describe('command Line Argument Parsing', () => {
    it('should parse command line arguments with parseArgs API', () => {
      const mockArgv = ['node', 'script.js', '--version', '--config', 'test.json', 'input.txt']
      vi.stubGlobal('process', {
        ...process,
        argv: mockArgv,
      })

      const result = parseCommandLineArgs({
        version: { type: 'boolean', short: 'v' },
        config: { type: 'string', short: 'c' },
        help: { type: 'boolean', short: 'h' },
      })

      expect(result.values).toEqual({
        version: true,
        config: 'test.json',
      })
      expect(result.positionals).toEqual(['input.txt'])
    })

    it('should handle boolean flags', () => {
      const mockArgv = ['node', 'script.js', '--verbose', '--debug']
      vi.stubGlobal('process', {
        ...process,
        argv: mockArgv,
      })

      const result = parseCommandLineArgs({
        verbose: { type: 'boolean' },
        debug: { type: 'boolean' },
        quiet: { type: 'boolean' },
      })

      expect(result.values).toEqual({
        verbose: true,
        debug: true,
      })
    })

    it('should handle string arguments', () => {
      const mockArgv = ['node', 'script.js', '--name', 'test-server', '--port', '3000']
      vi.stubGlobal('process', {
        ...process,
        argv: mockArgv,
      })

      const result = parseCommandLineArgs({
        name: { type: 'string' },
        port: { type: 'string' },
      })

      expect(result.values).toEqual({
        name: 'test-server',
        port: '3000',
      })
    })

    it('should handle short flags', () => {
      const mockArgv = ['node', 'script.js', '-v', '-c', 'config.json']
      vi.stubGlobal('process', {
        ...process,
        argv: mockArgv,
      })

      const result = parseCommandLineArgs({
        version: { type: 'boolean', short: 'v' },
        config: { type: 'string', short: 'c' },
      })

      expect(result.values).toEqual({
        version: true,
        config: 'config.json',
      })
    })

    it('should handle invalid arguments gracefully', () => {
      const mockArgv = ['node', 'script.js', '--unknown-flag']
      vi.stubGlobal('process', {
        ...process,
        argv: mockArgv,
      })

      expect(() => {
        parseCommandLineArgs({
          version: { type: 'boolean' },
        }, { strict: false })
      }).not.toThrow()
    })
  })

  describe('performance Monitor', () => {
    it('should start and end measurements', () => {
      const measurementId = 'test-operation'

      performanceMonitor.startMeasurement(measurementId)

      // Simulate some work
      const start = Date.now()
      while (Date.now() - start < 1) {
        // Small delay
      }

      const measurement = performanceMonitor.endMeasurement(measurementId)

      expect(measurement).toBeDefined()
      expect(measurement?.name).toBe(measurementId)
      expect(measurement?.duration).toBeGreaterThan(0)
      expect(typeof measurement?.startTime).toBe('number')
      expect(typeof measurement?.endTime).toBe('number')
    })

    it('should handle multiple concurrent measurements', () => {
      const id1 = 'operation-1'
      const id2 = 'operation-2'

      performanceMonitor.startMeasurement(id1)
      performanceMonitor.startMeasurement(id2)

      const measurement1 = performanceMonitor.endMeasurement(id1)
      const measurement2 = performanceMonitor.endMeasurement(id2)

      expect(measurement1?.name).toBe(id1)
      expect(measurement2?.name).toBe(id2)
      expect(measurement1?.duration).toBeGreaterThanOrEqual(0)
      expect(measurement2?.duration).toBeGreaterThanOrEqual(0)
    })

    it('should return undefined for unknown measurement', () => {
      const result = performanceMonitor.endMeasurement('non-existent')
      expect(result).toBeUndefined()
    })

    it('should provide measurement statistics', () => {
      const measurementId = 'repeated-operation'

      // Perform multiple measurements
      for (let i = 0; i < 5; i++) {
        performanceMonitor.startMeasurement(`${measurementId}-${i}`)
        performanceMonitor.endMeasurement(`${measurementId}-${i}`)
      }

      const stats = performanceMonitor.getStats()
      expect(stats.totalMeasurements).toBeGreaterThanOrEqual(5)
      expect(stats.activeMeasurements).toBeGreaterThanOrEqual(0)
    })

    it('should clear all measurements', () => {
      performanceMonitor.startMeasurement('test-1')
      performanceMonitor.startMeasurement('test-2')

      performanceMonitor.clearAll()

      const stats = performanceMonitor.getStats()
      expect(stats.activeMeasurements).toBe(0)
    })

    it('should handle nested measurements', () => {
      const parentId = 'parent-operation'
      const childId = 'child-operation'

      performanceMonitor.startMeasurement(parentId)
      performanceMonitor.startMeasurement(childId)

      const child = performanceMonitor.endMeasurement(childId)
      const parent = performanceMonitor.endMeasurement(parentId)

      expect(child?.duration).toBeGreaterThanOrEqual(0)
      expect(parent?.duration).toBeGreaterThanOrEqual(child!.duration)
    })
  })

  describe('resource Monitor', () => {
    it('should collect current resource usage', async () => {
      const usage = await resourceMonitor.getCurrentUsage()

      expect(usage).toHaveProperty('memory')
      expect(usage).toHaveProperty('cpu')
      expect(usage).toHaveProperty('uptime')
      expect(usage).toHaveProperty('timestamp')

      expect(usage.memory).toHaveProperty('rss')
      expect(usage.memory).toHaveProperty('heapUsed')
      expect(usage.memory).toHaveProperty('heapTotal')
      expect(usage.memory).toHaveProperty('external')

      expect(typeof usage.cpu.user).toBe('number')
      expect(typeof usage.cpu.system).toBe('number')
      expect(typeof usage.uptime).toBe('number')
      expect(typeof usage.timestamp).toBe('number')
    })

    it('should start monitoring with intervals', async () => {
      const monitor = resourceMonitor.startMonitoring(100) // 100ms interval

      expect(monitor).toBeDefined()
      expect(typeof monitor.stop).toBe('function')

      // Let it run briefly
      await new Promise(resolve => setTimeout(resolve, 250))

      monitor.stop()

      const history = resourceMonitor.getHistory()
      expect(history.length).toBeGreaterThan(0)
    })

    it('should provide resource usage history', async () => {
      // Clear any existing history
      resourceMonitor.clearHistory()

      // Collect some data points
      await resourceMonitor.getCurrentUsage()
      await new Promise(resolve => setTimeout(resolve, 10))
      await resourceMonitor.getCurrentUsage()

      const history = resourceMonitor.getHistory()
      expect(Array.isArray(history)).toBe(true)
    })

    it('should calculate resource usage statistics', async () => {
      // Collect some data
      for (let i = 0; i < 3; i++) {
        await resourceMonitor.getCurrentUsage()
        await new Promise(resolve => setTimeout(resolve, 1))
      }

      const stats = resourceMonitor.getStats()

      expect(stats).toHaveProperty('memoryAvg')
      expect(stats).toHaveProperty('cpuAvg')
      expect(stats).toHaveProperty('samples')

      expect(typeof stats.memoryAvg).toBe('number')
      expect(typeof stats.cpuAvg).toBe('number')
      expect(typeof stats.samples).toBe('number')
    })

    it('should handle monitoring lifecycle', () => {
      const monitor1 = resourceMonitor.startMonitoring(50)
      const monitor2 = resourceMonitor.startMonitoring(100)

      // Both monitors should be independent
      expect(monitor1).toBeDefined()
      expect(monitor2).toBeDefined()

      monitor1.stop()
      monitor2.stop()
    })

    it('should clear history on demand', async () => {
      await resourceMonitor.getCurrentUsage()
      expect(resourceMonitor.getHistory().length).toBeGreaterThan(0)

      resourceMonitor.clearHistory()
      expect(resourceMonitor.getHistory().length).toBe(0)
    })
  })

  describe('asyncLocalStorage Context Management', () => {
    it('should create async context storage', () => {
      const context = createAsyncContext<{ userId: string }>()

      expect(context).toHaveProperty('run')
      expect(context).toHaveProperty('getStore')
      expect(typeof context.run).toBe('function')
      expect(typeof context.getStore).toBe('function')
    })

    it('should maintain context across async operations', async () => {
      const context = createAsyncContext<{ requestId: string }>()

      const testValue = { requestId: 'test-123' }

      await context.run(testValue, async () => {
        // Should have access to context
        const store = context.getStore()
        expect(store).toEqual(testValue)

        // Context should persist through async operations
        await new Promise(resolve => setTimeout(resolve, 1))

        const storeAfterAsync = context.getStore()
        expect(storeAfterAsync).toEqual(testValue)
      })
    })

    it('should isolate contexts between different runs', async () => {
      const context = createAsyncContext<{ value: number }>()

      const results: number[] = []

      await Promise.all([
        context.run({ value: 1 }, async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          const store = context.getStore()
          results.push(store?.value || 0)
        }),
        context.run({ value: 2 }, async () => {
          await new Promise(resolve => setTimeout(resolve, 5))
          const store = context.getStore()
          results.push(store?.value || 0)
        }),
        context.run({ value: 3 }, async () => {
          const store = context.getStore()
          results.push(store?.value || 0)
        }),
      ])

      expect(results).toContain(1)
      expect(results).toContain(2)
      expect(results).toContain(3)
    })

    it('should return undefined when no context is active', () => {
      const context = createAsyncContext<{ data: string }>()

      const store = context.getStore()
      expect(store).toBeUndefined()
    })

    it('should handle nested context runs', async () => {
      const context = createAsyncContext<{ level: number }>()

      await context.run({ level: 1 }, async () => {
        const outer = context.getStore()
        expect(outer?.level).toBe(1)

        await context.run({ level: 2 }, async () => {
          const inner = context.getStore()
          expect(inner?.level).toBe(2)

          await new Promise(resolve => setTimeout(resolve, 1))

          const stillInner = context.getStore()
          expect(stillInner?.level).toBe(2)
        })

        // Should restore outer context
        const restored = context.getStore()
        expect(restored?.level).toBe(1)
      })
    })
  })

  describe('integration and Error Handling', () => {
    it('should handle performance monitoring errors gracefully', () => {
      // Start measurement with invalid ID
      expect(() => {
        performanceMonitor.startMeasurement('')
      }).not.toThrow()

      // End non-existent measurement
      expect(() => {
        performanceMonitor.endMeasurement('non-existent')
      }).not.toThrow()
    })

    it('should handle resource monitoring errors gracefully', async () => {
      // Should handle system errors gracefully
      const usage = await resourceMonitor.getCurrentUsage()
      expect(usage).toBeDefined()
    })

    it('should handle command line parsing edge cases', () => {
      const mockArgv = ['node', 'script.js']
      vi.stubGlobal('process', {
        ...process,
        argv: mockArgv,
      })

      const result = parseCommandLineArgs({
        optional: { type: 'boolean' },
      })

      expect(result.values).toEqual({})
      expect(result.positionals).toEqual([])
    })
  })

  describe('performance Characteristics', () => {
    it('should have low overhead for performance monitoring', () => {
      const start = Date.now()

      for (let i = 0; i < 100; i++) {
        performanceMonitor.startMeasurement(`test-${i}`)
        performanceMonitor.endMeasurement(`test-${i}`)
      }

      const duration = Date.now() - start
      expect(duration).toBeLessThan(50) // Should be very fast
    })

    it('should handle concurrent performance measurements efficiently', async () => {
      const promises = []

      for (let i = 0; i < 20; i++) {
        promises.push((async () => {
          const id = `concurrent-${i}`
          performanceMonitor.startMeasurement(id)
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10))
          return performanceMonitor.endMeasurement(id)
        })())
      }

      const results = await Promise.all(promises)

      results.forEach((result, index) => {
        expect(result).toBeDefined()
        expect(result?.name).toBe(`concurrent-${index}`)
        expect(result?.duration).toBeGreaterThanOrEqual(0)
      })
    })

    it('should maintain memory efficiency with resource monitoring', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // Generate lots of resource usage data
      for (let i = 0; i < 50; i++) {
        await resourceMonitor.getCurrentUsage()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Should not consume excessive memory
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // Less than 10MB
    })
  })
})
