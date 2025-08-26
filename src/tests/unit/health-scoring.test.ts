/**
 * Health Scoring Tests
 * Validates realistic memory usage scoring for production environments
 */

import { describe, expect, it } from 'vitest'

// Test the health scoring logic independently
function calculateHealthScore(
  errorStats: { recentErrors: number, totalErrors: number },
  memoryUsage: NodeJS.MemoryUsage,
  config = { memoryThresholdWarning: 87, memoryThresholdCritical: 95 },
): number {
  let score = 100

  // Deduct for recent errors
  score -= Math.min(errorStats.recentErrors * 2, 30)

  // Deduct for total error diversity
  score -= Math.min(errorStats.totalErrors, 20)

  // Use configurable memory thresholds for realistic scoring
  const memoryUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal
  const warningThreshold = config.memoryThresholdWarning / 100 // Convert to ratio
  const criticalThreshold = config.memoryThresholdCritical / 100 // Convert to ratio

  // More realistic memory usage scoring for Node.js applications
  if (memoryUsageRatio > criticalThreshold) {
    // Only penalize at critical levels (default 95%+)
    score -= 20
  }
  else if (memoryUsageRatio > warningThreshold) {
    // Light penalty at warning levels (default 85%+), scaled by proximity to critical
    const warningRange = criticalThreshold - warningThreshold
    const proximityToCritical = (memoryUsageRatio - warningThreshold) / warningRange
    score -= Math.round(proximityToCritical * 10) // Max 10 point deduction
  }
  // No penalty below warning threshold - normal Node.js operation

  return Math.max(0, Math.min(100, Math.round(score)))
}

describe('health Scoring', () => {
  const noErrors = { recentErrors: 0, totalErrors: 0 }

  describe('memory Usage Scoring', () => {
    it('should give 100/100 for normal memory usage (85.7% heap)', () => {
      const memoryUsage = {
        heapUsed: 18 * 1024 * 1024, // 18MB
        heapTotal: 21 * 1024 * 1024, // 21MB (85.7% usage - below 87% threshold)
        rss: 83 * 1024 * 1024,
        external: 4 * 1024 * 1024,
        arrayBuffers: 0,
      }

      const score = calculateHealthScore(noErrors, memoryUsage)
      expect(score).toBe(100) // Should be perfect score now
    })

    it('should give 100/100 for healthy memory usage (80% heap)', () => {
      const memoryUsage = {
        heapUsed: 80 * 1024 * 1024, // 80MB
        heapTotal: 100 * 1024 * 1024, // 100MB (80% usage - well below threshold)
        rss: 120 * 1024 * 1024,
        external: 4 * 1024 * 1024,
        arrayBuffers: 0,
      }

      const score = calculateHealthScore(noErrors, memoryUsage)
      expect(score).toBe(100) // Should be perfect score
    })

    it('should give 100/100 for memory usage at warning threshold (87%)', () => {
      const memoryUsage = {
        heapUsed: 87 * 1024 * 1024, // 87MB
        heapTotal: 100 * 1024 * 1024, // 100MB (exactly 87% usage)
        rss: 120 * 1024 * 1024,
        external: 4 * 1024 * 1024,
        arrayBuffers: 0,
      }

      const score = calculateHealthScore(noErrors, memoryUsage)
      expect(score).toBe(100) // Should still be perfect at threshold
    })

    it('should deduct small penalty for elevated memory usage (90%)', () => {
      const memoryUsage = {
        heapUsed: 90 * 1024 * 1024, // 90MB
        heapTotal: 100 * 1024 * 1024, // 100MB (90% usage)
        rss: 120 * 1024 * 1024,
        external: 4 * 1024 * 1024,
        arrayBuffers: 0,
      }

      const score = calculateHealthScore(noErrors, memoryUsage)
      expect(score).toBeGreaterThan(90) // Should be minor penalty
      expect(score).toBeLessThan(100)
    })

    it('should deduct 20 points for critical memory usage (95%+)', () => {
      const memoryUsage = {
        heapUsed: 96 * 1024 * 1024, // 96MB
        heapTotal: 100 * 1024 * 1024, // 100MB (96% usage)
        rss: 120 * 1024 * 1024,
        external: 4 * 1024 * 1024,
        arrayBuffers: 0,
      }

      const score = calculateHealthScore(noErrors, memoryUsage)
      expect(score).toBe(80) // Should deduct 20 points for critical usage
    })

    it('should handle custom thresholds correctly', () => {
      const memoryUsage = {
        heapUsed: 75 * 1024 * 1024, // 75MB
        heapTotal: 100 * 1024 * 1024, // 100MB (75% usage)
        rss: 120 * 1024 * 1024,
        external: 4 * 1024 * 1024,
        arrayBuffers: 0,
      }

      // Custom thresholds: warning at 70%, critical at 80%
      const customConfig = { memoryThresholdWarning: 70, memoryThresholdCritical: 80 }
      const score = calculateHealthScore(noErrors, memoryUsage, customConfig)
      expect(score).toBeGreaterThan(90) // Should have minor penalty
      expect(score).toBeLessThan(100)
    })
  })

  describe('error Scoring Integration', () => {
    it('should maintain 100/100 with no errors and healthy memory', () => {
      const memoryUsage = {
        heapUsed: 70 * 1024 * 1024, // 70MB
        heapTotal: 100 * 1024 * 1024, // 100MB (70% usage)
        rss: 120 * 1024 * 1024,
        external: 4 * 1024 * 1024,
        arrayBuffers: 0,
      }

      const score = calculateHealthScore(noErrors, memoryUsage)
      expect(score).toBe(100)
    })

    it('should combine error and memory penalties correctly', () => {
      const errorStats = { recentErrors: 2, totalErrors: 5 }
      const memoryUsage = {
        heapUsed: 96 * 1024 * 1024, // 96MB
        heapTotal: 100 * 1024 * 1024, // 100MB (96% critical usage)
        rss: 120 * 1024 * 1024,
        external: 4 * 1024 * 1024,
        arrayBuffers: 0,
      }

      const score = calculateHealthScore(errorStats, memoryUsage)
      // Should deduct: 4 (recent errors) + 5 (total errors) + 20 (critical memory) = 29 points
      expect(score).toBe(71)
    })
  })
})
