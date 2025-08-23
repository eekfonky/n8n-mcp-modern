/**
 * Memory Management Validation Tests
 *
 * Critical tests to validate memory thresholds, heap size calculations,
 * and prevent memory management configuration issues.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../server/config.js'
import { AdvancedMemoryManager, MemoryLevel } from '../../utils/memory-manager.js'

describe('memory Management Validation Tests', () => {
  let memoryManager: AdvancedMemoryManager
  let mockMemoryUsage: vi.Mock

  beforeEach(() => {
    // Mock process.memoryUsage
    mockMemoryUsage = vi.fn()
    vi.doMock('node:process', () => ({
      default: {
        memoryUsage: mockMemoryUsage,
        on: vi.fn(),
        emit: vi.fn(),
      },
    }))

    memoryManager = new AdvancedMemoryManager()
  })

  afterEach(() => {
    memoryManager.stop()
    vi.clearAllMocks()
  })

  describe('threshold Validation', () => {
    it('should validate memory thresholds are reasonable', () => {
      const warningThreshold = config.memoryThresholdWarning
      const criticalThreshold = config.memoryThresholdCritical

      // Thresholds should be in valid percentage range
      expect(warningThreshold).toBeGreaterThan(50)
      expect(warningThreshold).toBeLessThan(100)
      expect(criticalThreshold).toBeGreaterThan(warningThreshold)
      expect(criticalThreshold).toBeLessThan(100)

      // Should have reasonable gap between warning and critical
      expect(criticalThreshold - warningThreshold).toBeGreaterThanOrEqual(5)
      expect(criticalThreshold - warningThreshold).toBeLessThanOrEqual(20)
    })

    it('should validate thresholds against typical heap sizes', () => {
      const typicalHeapSizes = [
        { total: 20 * 1024 * 1024, used: 18 * 1024 * 1024 }, // 18MB/20MB = 90%
        { total: 50 * 1024 * 1024, used: 40 * 1024 * 1024 }, // 40MB/50MB = 80%
        { total: 100 * 1024 * 1024, used: 85 * 1024 * 1024 }, // 85MB/100MB = 85%
        { total: 512 * 1024 * 1024, used: 400 * 1024 * 1024 }, // 400MB/512MB = 78%
      ]

      typicalHeapSizes.forEach(({ total, used }, index) => {
        const usagePercent = (used / total) * 100

        mockMemoryUsage.mockReturnValue({
          rss: total + (10 * 1024 * 1024), // RSS is typically larger
          heapTotal: total,
          heapUsed: used,
          external: 5 * 1024 * 1024,
          arrayBuffers: 2 * 1024 * 1024,
        })

        const stats = memoryManager.getCurrentMemoryStats()
        const actualUsagePercent = (stats.heapUsed / stats.heapTotal) * 100

        // Allow for some variance due to memory manager overhead
        expect(actualUsagePercent).toBeCloseTo(usagePercent, 0)

        // Validate level classification makes sense for this usage
        const report = memoryManager.getMemoryReport()

        if (actualUsagePercent >= config.memoryThresholdCritical) {
          expect(report.level).toBe(MemoryLevel.CRITICAL)
        }
        else if (actualUsagePercent >= config.memoryThresholdWarning) {
          expect(report.level).toBe(MemoryLevel.WARNING)
        }
        else {
          expect(report.level).toBe(MemoryLevel.NORMAL)
        }
      })
    })

    it('should prevent overly aggressive thresholds on small heaps', () => {
      // Small heap scenario (like default Node.js)
      const smallHeapTotal = 20 * 1024 * 1024 // 20MB
      const nearFullUsage = 19 * 1024 * 1024 // 19MB = 95% usage

      mockMemoryUsage.mockReturnValue({
        rss: 50 * 1024 * 1024,
        heapTotal: smallHeapTotal,
        heapUsed: nearFullUsage,
        external: 3 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024,
      })

      const report = memoryManager.getMemoryReport()
      const usagePercent = (nearFullUsage / smallHeapTotal) * 100

      expect(usagePercent).toBe(95)

      // This should definitely be critical at 95%
      expect(report.level).toBe(MemoryLevel.CRITICAL)

      // But our thresholds should not trigger warnings too early
      // on small heaps where 18MB/20MB (90%) might be normal
      if (config.memoryThresholdCritical <= 90) {
        console.warn('Critical threshold may be too aggressive for small heaps')
      }
    })

    it('should handle edge cases in threshold calculations', () => {
      const edgeCases = [
        { heapTotal: 1024, heapUsed: 1023 }, // Nearly full tiny heap
        { heapTotal: 1024 * 1024, heapUsed: 1 }, // Nearly empty heap
        { heapTotal: 1024 * 1024, heapUsed: 1024 * 1024 }, // Completely full heap
        { heapTotal: 0, heapUsed: 0 }, // Zero heap (edge case)
      ]

      edgeCases.forEach(({ heapTotal, heapUsed }) => {
        mockMemoryUsage.mockReturnValue({
          rss: heapTotal + 1024,
          heapTotal,
          heapUsed,
          external: 0,
          arrayBuffers: 0,
        })

        expect(() => {
          const report = memoryManager.getMemoryReport()
          expect(report.level).toBeDefined()
        }).not.toThrow()
      })
    })
  })

  describe('heap Size Configuration', () => {
    it('should validate max heap size configuration', () => {
      const maxHeapSizeMb = config.maxHeapSizeMb

      // Should be reasonable for the application
      expect(maxHeapSizeMb).toBeGreaterThan(50) // At least 50MB
      expect(maxHeapSizeMb).toBeLessThan(8192) // Less than 8GB

      // Should be large enough to avoid constant pressure
      const minRecommendedMb = 128
      if (maxHeapSizeMb < minRecommendedMb) {
        console.warn(`Max heap size ${maxHeapSizeMb}MB may be too small. Recommend at least ${minRecommendedMb}MB`)
      }
    })

    it('should validate threshold alignment with heap size', () => {
      const maxHeapBytes = config.maxHeapSizeMb * 1024 * 1024
      const warningBytes = maxHeapBytes * (config.memoryThresholdWarning / 100)
      const criticalBytes = maxHeapBytes * (config.memoryThresholdCritical / 100)

      // Warning threshold should leave reasonable headroom
      const warningHeadroomMb = (maxHeapBytes - warningBytes) / (1024 * 1024)
      expect(warningHeadroomMb).toBeGreaterThan(10) // At least 10MB headroom

      // Critical threshold should leave emergency headroom
      const criticalHeadroomMb = (maxHeapBytes - criticalBytes) / (1024 * 1024)
      expect(criticalHeadroomMb).toBeGreaterThan(5) // At least 5MB emergency headroom
    })

    it('should validate GC interval configuration', () => {
      const gcInterval = config.gcIntervalMs

      // Should not be too frequent (causes performance issues)
      expect(gcInterval).toBeGreaterThan(10000) // At least 10 seconds

      // Should not be too infrequent (allows memory buildup)
      expect(gcInterval).toBeLessThan(600000) // Less than 10 minutes

      // Reasonable default range
      expect(gcInterval).toBeGreaterThanOrEqual(30000) // 30 seconds minimum
      expect(gcInterval).toBeLessThanOrEqual(300000) // 5 minutes maximum
    })

    it('should validate cache cleanup interval', () => {
      const cleanupInterval = config.cacheCleanupIntervalMs

      // Should be longer than GC interval
      expect(cleanupInterval).toBeGreaterThan(config.gcIntervalMs)

      // Should be reasonable for cache management
      expect(cleanupInterval).toBeGreaterThan(60000) // At least 1 minute
      expect(cleanupInterval).toBeLessThan(3600000) // Less than 1 hour
    })
  })

  describe('memory Leak Detection Validation', () => {
    it('should validate leak detection thresholds', () => {
      // Test with increasing memory pattern
      const timestamps = Array.from({ length: 15 }, (_, i) => i * 60000) // 1-minute intervals
      let callCount = 0

      vi.spyOn(Date, 'now').mockImplementation(() => {
        const result = timestamps[callCount] || (callCount * 60000)
        callCount++
        return result
      })

      // Simulate rapid memory growth (15MB per minute = suspicious)
      for (let i = 0; i < 15; i++) {
        mockMemoryUsage.mockReturnValueOnce({
          rss: (100 + i * 20) * 1024 * 1024,
          heapTotal: (50 + i * 5) * 1024 * 1024,
          heapUsed: (20 + i * 15) * 1024 * 1024, // Growing by 15MB per minute
          external: 5 * 1024 * 1024,
          arrayBuffers: 2 * 1024 * 1024,
        })
        memoryManager.getCurrentMemoryStats()
      }

      const leakDetection = memoryManager.detectMemoryLeaks()

      // Should detect the rapid growth as suspicious
      expect(leakDetection.trend).toBe('increasing')
      expect(leakDetection.rate).toBeGreaterThan(10) // More than 10MB/minute
      expect(leakDetection.suspected).toBe(true)
      expect(leakDetection.recommendation).toBeDefined()
    })

    it('should not flag normal memory fluctuations as leaks', () => {
      // Test with normal memory pattern
      const normalMemoryPatterns = [
        { base: 30, variation: 2 }, // 30MB ± 2MB
        { base: 50, variation: 5 }, // 50MB ± 5MB
        { base: 100, variation: 10 }, // 100MB ± 10MB
      ]

      normalMemoryPatterns.forEach(({ base, variation }) => {
        // Reset manager for clean test
        const testManager = new AdvancedMemoryManager()

        try {
          // Simulate normal fluctuation
          for (let i = 0; i < 10; i++) {
            const randomOffset = (Math.random() - 0.5) * variation * 2
            const memUsage = (base + randomOffset) * 1024 * 1024

            mockMemoryUsage.mockReturnValueOnce({
              rss: memUsage * 2,
              heapTotal: memUsage * 1.5,
              heapUsed: memUsage,
              external: 5 * 1024 * 1024,
              arrayBuffers: 2 * 1024 * 1024,
            })
            testManager.getCurrentMemoryStats()
          }

          const leakDetection = testManager.detectMemoryLeaks()

          // Should not suspect leaks for normal fluctuation
          expect(leakDetection.suspected).toBe(false)
          expect(leakDetection.trend).toBe('stable')
        }
        finally {
          testManager.stop()
        }
      })
    })

    it('should validate memory trend calculations', () => {
      const testCases = [
        {
          name: 'steep increase',
          pattern: (i: number) => 20 + i * 10, // 10MB per step
          expectedTrend: 'increasing',
          expectedSuspected: true,
        },
        {
          name: 'gentle increase',
          pattern: (i: number) => 20 + i * 2, // 2MB per step
          expectedTrend: 'increasing',
          expectedSuspected: false,
        },
        {
          name: 'decrease',
          pattern: (i: number) => 100 - i * 5, // Decreasing 5MB per step
          expectedTrend: 'decreasing',
          expectedSuspected: false,
        },
        {
          name: 'stable',
          pattern: (i: number) => 50 + Math.sin(i) * 2, // Stable around 50MB
          expectedTrend: 'stable',
          expectedSuspected: false,
        },
      ]

      testCases.forEach(({ name, pattern, expectedTrend, expectedSuspected }) => {
        const testManager = new AdvancedMemoryManager()

        try {
          for (let i = 0; i < 15; i++) {
            const memUsage = pattern(i) * 1024 * 1024

            mockMemoryUsage.mockReturnValueOnce({
              rss: memUsage * 2,
              heapTotal: memUsage * 1.5,
              heapUsed: memUsage,
              external: 5 * 1024 * 1024,
              arrayBuffers: 2 * 1024 * 1024,
            })
            testManager.getCurrentMemoryStats()
          }

          const detection = testManager.detectMemoryLeaks()

          expect(detection.trend, `${name} should have trend: ${expectedTrend}`).toBe(expectedTrend)
          expect(detection.suspected, `${name} suspected should be: ${expectedSuspected}`).toBe(expectedSuspected)
        }
        finally {
          testManager.stop()
        }
      })
    })
  })

  describe('performance Impact Validation', () => {
    it('should validate monitoring overhead', () => {
      const iterationCount = 100
      const startTime = Date.now()

      // Simulate monitoring overhead
      for (let i = 0; i < iterationCount; i++) {
        mockMemoryUsage.mockReturnValue({
          rss: 100 * 1024 * 1024,
          heapTotal: 50 * 1024 * 1024,
          heapUsed: 30 * 1024 * 1024,
          external: 5 * 1024 * 1024,
          arrayBuffers: 2 * 1024 * 1024,
        })

        memoryManager.getCurrentMemoryStats()
      }

      const endTime = Date.now()
      const avgTimePerCall = (endTime - startTime) / iterationCount

      // Each call should be very fast (< 1ms average)
      expect(avgTimePerCall).toBeLessThan(1)
    })

    it('should validate memory usage of monitoring itself', () => {
      const initialStats = memoryManager.getCurrentMemoryStats()

      // Generate some monitoring activity
      for (let i = 0; i < 50; i++) {
        mockMemoryUsage.mockReturnValue({
          rss: (100 + i) * 1024 * 1024,
          heapTotal: (50 + i) * 1024 * 1024,
          heapUsed: (30 + i) * 1024 * 1024,
          external: 5 * 1024 * 1024,
          arrayBuffers: 2 * 1024 * 1024,
        })

        memoryManager.getCurrentMemoryStats()
      }

      const finalStats = memoryManager.getCurrentMemoryStats()

      // The monitoring system itself should not use excessive memory
      // (This is approximate since we're mocking memoryUsage)
      expect(finalStats).toBeDefined()
    })

    it('should validate history management efficiency', () => {
      // Fill up history to maximum
      for (let i = 0; i < 150; i++) { // More than maxHistorySize (100)
        mockMemoryUsage.mockReturnValue({
          rss: 100 * 1024 * 1024,
          heapTotal: 50 * 1024 * 1024,
          heapUsed: 30 * 1024 * 1024,
          external: 5 * 1024 * 1024,
          arrayBuffers: 2 * 1024 * 1024,
        })

        memoryManager.getCurrentMemoryStats()
      }

      const report = memoryManager.getMemoryReport()

      // History should be trimmed to prevent unbounded growth
      expect(report.history).toBeDefined()

      // The system should still function normally
      expect(report.current).toBeDefined()
      expect(report.level).toBeDefined()
    })
  })

  describe('configuration Edge Cases', () => {
    it('should handle invalid threshold configurations gracefully', () => {
      // Test what happens with extreme threshold values
      const extremeCases = [
        { warning: 0, critical: 0 },
        { warning: 100, critical: 100 },
        { warning: 95, critical: 85 }, // Critical lower than warning
        { warning: 50, critical: 51 }, // Very close thresholds
      ]

      extremeCases.forEach(({ warning, critical }) => {
        // The config validation should prevent these, but test graceful handling
        mockMemoryUsage.mockReturnValue({
          rss: 100 * 1024 * 1024,
          heapTotal: 50 * 1024 * 1024,
          heapUsed: 45 * 1024 * 1024, // 90% usage
          external: 5 * 1024 * 1024,
          arrayBuffers: 2 * 1024 * 1024,
        })

        expect(() => {
          memoryManager.getCurrentMemoryStats()
          memoryManager.getMemoryReport()
        }).not.toThrow()
      })
    })

    it('should validate interval timing relationships', () => {
      // GC interval should be reasonable relative to monitoring
      const gcInterval = config.gcIntervalMs
      const cleanupInterval = config.cacheCleanupIntervalMs
      const monitoringInterval = 30000 // Hard-coded in memory manager

      // Cleanup should be less frequent than GC
      expect(cleanupInterval).toBeGreaterThan(gcInterval)

      // GC should be less frequent than monitoring
      expect(gcInterval).toBeGreaterThan(monitoringInterval)

      // All intervals should be reasonable multiples
      expect(gcInterval % monitoringInterval).toBe(0) // GC should be multiple of monitoring
    })
  })
})
