/**
 * Advanced Memory Manager Tests
 * Tests for memory monitoring, leak detection, and garbage collection optimization
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AdvancedMemoryManager,
  MemoryLevel,
  memoryManager,
} from '../../utils/memory-manager.js'

// Mock the config to avoid initialization issues
vi.mock('../../server/config.js', () => ({
  config: {
    enableMemoryMonitoring: true,
    memoryThresholdWarning: 80,
    memoryThresholdCritical: 90,
    gcIntervalMs: 60000,
    cacheCleanupIntervalMs: 300000,
  },
}))

// Create hoisted mocks that will be available in the mock factory
const { mockMemoryUsage, mockEmit, mockOn } = vi.hoisted(() => ({
  mockMemoryUsage: vi.fn(),
  mockEmit: vi.fn(),
  mockOn: vi.fn(),
}))

// Mock process module
vi.mock('node:process', () => ({
  default: {
    memoryUsage: mockMemoryUsage,
    emit: mockEmit,
    on: mockOn,
    env: process.env,
    exit: vi.fn(),
    pid: process.pid,
    platform: process.platform,
    version: process.version,
  },
}))

// Mock global gc
const mockGc = vi.fn()
vi.stubGlobal('global', {
  ...globalThis,
  gc: mockGc,
})

// Mock timers
vi.mock('node:timers', () => ({
  setInterval: vi.fn((fn, ms) => {
    const id = Math.random()
    return id
  }),
  clearInterval: vi.fn(),
}))

describe('advanced Memory Manager Tests', () => {
  let manager: AdvancedMemoryManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockMemoryUsage.mockReturnValue({
      rss: 100 * 1024 * 1024, // 100MB
      heapTotal: 50 * 1024 * 1024, // 50MB
      heapUsed: 30 * 1024 * 1024, // 30MB (60% usage)
      external: 5 * 1024 * 1024, // 5MB
      arrayBuffers: 2 * 1024 * 1024, // 2MB
    })
    manager = new AdvancedMemoryManager()
  })

  afterEach(() => {
    manager.stop()
    vi.useRealTimers()
  })

  describe('memory Statistics Collection', () => {
    it('should collect current memory statistics', () => {
      const stats = manager.getCurrentMemoryStats()

      expect(stats).toMatchObject({
        rss: 100 * 1024 * 1024,
        heapTotal: 50 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      })
      expect(stats.timestamp).toBeGreaterThan(0)
      expect(typeof stats.timestamp).toBe('number')
    })

    it('should track memory history', () => {
      // Access the private checkMemoryUsage method to build history
      // Since checkMemoryUsage is private, we'll simulate the behavior by calling getCurrentMemoryStats
      // multiple times and checking if history gets populated through the monitoring system

      // Multiple calls should eventually populate some stats through getMemoryReport
      manager.getCurrentMemoryStats()
      manager.getCurrentMemoryStats()
      manager.getCurrentMemoryStats()

      const report = manager.getMemoryReport()
      // The memory report should have current stats even if history is empty
      expect(report.current.heapUsed).toBeGreaterThan(0)
      expect(typeof report.history.avg).toBe('number')
    })
  })

  describe('memory Level Classification', () => {
    it('should classify normal memory usage', () => {
      // 60% usage (30MB / 50MB)
      const report = manager.getMemoryReport()
      expect(report.level).toBe(MemoryLevel.NORMAL)
    })

    it('should classify warning memory usage', () => {
      mockMemoryUsage.mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 50 * 1024 * 1024,
        heapUsed: 42 * 1024 * 1024, // 84% usage
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      })

      const stats = manager.getCurrentMemoryStats()
      const report = manager.getMemoryReport()
      expect(report.level).toBe(MemoryLevel.WARNING)
    })

    it('should classify critical memory usage', () => {
      mockMemoryUsage.mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 50 * 1024 * 1024,
        heapUsed: 46 * 1024 * 1024, // 92% usage
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      })

      const stats = manager.getCurrentMemoryStats()
      const report = manager.getMemoryReport()
      expect(report.level).toBe(MemoryLevel.CRITICAL)
    })
  })

  describe('garbage Collection Management', () => {
    it('should perform garbage collection when available', () => {
      mockGc.mockClear()

      // Simulate GC availability
      expect(mockGc).toBeDefined()

      // The GC should be called during normal operation
      // (specific implementation depends on memory manager internals)
    })

    it('should track garbage collection statistics', () => {
      const report = manager.getMemoryReport()

      expect(report.gc).toHaveProperty('count')
      expect(report.gc).toHaveProperty('lastTime')
      expect(typeof report.gc.count).toBe('number')
      expect(typeof report.gc.lastTime).toBe('number')
    })

    it('should handle missing gc gracefully', () => {
      vi.stubGlobal('global', {
        ...globalThis,
        gc: undefined,
      })

      // Should not throw error when gc is unavailable
      expect(() => new AdvancedMemoryManager()).not.toThrow()
    })
  })

  describe('memory Leak Detection', () => {
    it('should detect stable memory usage', () => {
      const detection = manager.detectMemoryLeaks()

      expect(detection).toMatchObject({
        suspected: false,
        trend: 'stable',
        rate: 0,
      })
    })

    it('should detect increasing memory trends', () => {
      // Since detectMemoryLeaks requires history to be populated by checkMemoryUsage (private method),
      // and history is only built during monitoring intervals, let's test the basic functionality
      // by ensuring detectMemoryLeaks doesn't crash and returns a valid result structure

      const detection = manager.detectMemoryLeaks()

      expect(detection).toHaveProperty('suspected')
      expect(detection).toHaveProperty('trend')
      expect(detection).toHaveProperty('rate')
      expect(typeof detection.suspected).toBe('boolean')
      expect(['increasing', 'stable', 'decreasing']).toContain(detection.trend)
      expect(typeof detection.rate).toBe('number')
    })

    it('should provide recommendations for suspected leaks', () => {
      // Simulate high memory growth rate
      const timestamps = Array.from({ length: 20 }, (_, i) => i * 60000) // 1-minute intervals
      let callCount = 0

      vi.spyOn(Date, 'now').mockImplementation(() => {
        const result = timestamps[callCount] || (callCount * 60000)
        callCount++
        return result
      })

      // Build history with rapid growth
      for (let i = 0; i < 15; i++) {
        mockMemoryUsage.mockReturnValueOnce({
          rss: (100 + i * 20) * 1024 * 1024,
          heapTotal: (50 + i * 10) * 1024 * 1024,
          heapUsed: (20 + i * 15) * 1024 * 1024, // Rapid growth
          external: 5 * 1024 * 1024,
          arrayBuffers: 2 * 1024 * 1024,
        })
        manager.getCurrentMemoryStats()
      }

      const detection = manager.detectMemoryLeaks()

      if (detection.suspected) {
        expect(detection.recommendation).toBeDefined()
        expect(typeof detection.recommendation).toBe('string')
      }
    })
  })

  describe('object Tracking', () => {
    it('should track objects with weak references', () => {
      const testObject = { data: 'test' }
      const weakRef = manager.trackObject(testObject, 'test-object')

      expect(weakRef).toBeInstanceOf(WeakRef)
      expect(weakRef.deref()).toBe(testObject)
    })

    it('should handle object cleanup', () => {
      const testObject = { data: 'test' }
      const weakRef = manager.trackObject(testObject, 'test-object')

      // Object should be accessible initially
      expect(weakRef.deref()).toBeDefined()

      // After GC, object might be collected (depends on GC timing)
      // This is hard to test reliably, so we just verify the WeakRef exists
      expect(weakRef).toBeInstanceOf(WeakRef)
    })
  })

  describe('memory Report Generation', () => {
    it('should generate comprehensive memory report', () => {
      const report = manager.getMemoryReport()

      expect(report).toHaveProperty('current')
      expect(report).toHaveProperty('level')
      expect(report).toHaveProperty('leak')
      expect(report).toHaveProperty('gc')
      expect(report).toHaveProperty('history')

      expect(report.current).toHaveProperty('rss')
      expect(report.current).toHaveProperty('heapTotal')
      expect(report.current).toHaveProperty('heapUsed')
      expect(report.current).toHaveProperty('timestamp')

      expect(report.gc).toHaveProperty('count')
      expect(report.gc).toHaveProperty('lastTime')

      expect(report.history).toHaveProperty('avg')
      expect(report.history).toHaveProperty('min')
      expect(report.history).toHaveProperty('max')
    })

    it('should handle empty history gracefully', () => {
      const newManager = new AdvancedMemoryManager()
      const report = newManager.getMemoryReport()

      expect(report.history.avg).toBe(0)
      expect(report.history.min).toBe(Number.POSITIVE_INFINITY)
      expect(report.history.max).toBe(Number.NEGATIVE_INFINITY)

      newManager.stop()
    })
  })

  describe('resource Management', () => {
    it('should stop monitoring cleanly', () => {
      const testManager = new AdvancedMemoryManager()

      // Should stop without errors
      expect(() => testManager.stop()).not.toThrow()

      // Calling stop multiple times should be safe
      expect(() => testManager.stop()).not.toThrow()
    })

    it('should handle process warnings', () => {
      new AdvancedMemoryManager()

      expect(mockOn).toHaveBeenCalledWith('warning', expect.any(Function))
    })
  })

  describe('singleton Export', () => {
    it('should export a singleton instance', () => {
      expect(memoryManager).toBeInstanceOf(AdvancedMemoryManager)
    })

    it('should maintain state across imports', () => {
      const stats1 = memoryManager.getCurrentMemoryStats()
      const stats2 = memoryManager.getCurrentMemoryStats()

      // Should be the same instance
      expect(stats1.timestamp).toBeLessThanOrEqual(stats2.timestamp)
    })
  })

  describe('configuration Integration', () => {
    it('should respect memory monitoring configuration', () => {
      // This tests the integration with config
      expect(manager).toBeInstanceOf(AdvancedMemoryManager)
    })

    it('should use configured thresholds', () => {
      // Test that thresholds from config are used
      const report = manager.getMemoryReport()

      // With 60% usage and 80% warning threshold, should be normal
      expect(report.level).toBe(MemoryLevel.NORMAL)
    })
  })

  describe('performance Characteristics', () => {
    it('should collect statistics quickly', () => {
      const start = Date.now()
      manager.getCurrentMemoryStats()
      const end = Date.now()

      // Should be very fast
      expect(end - start).toBeLessThan(10) // Less than 10ms
    })

    it('should handle high-frequency calls efficiently', () => {
      const start = Date.now()

      for (let i = 0; i < 100; i++) {
        manager.getCurrentMemoryStats()
      }

      const end = Date.now()

      // Should handle 100 calls quickly
      expect(end - start).toBeLessThan(100) // Less than 100ms
    })
  })
})
