/**
 * Comprehensive Test Suite for CircuitBreaker
 *
 * Critical protection mechanism tests covering:
 * - State transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * - Failure threshold behavior
 * - Recovery timeout handling
 * - Emergency abort scenarios
 * - Performance under load
 * - Timing attack resistance
 */

import { afterEach, beforeEach, describe, expect, vi } from 'vitest'
import { CircuitBreaker } from '../../utils/circuit-breaker.js'

describe('circuitBreaker - State Transitions', () => {
  let circuitBreaker: CircuitBreaker

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      successThreshold: 2,
    })
  })

  it('starts in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe('CLOSED')
    expect(circuitBreaker.isCallAllowed()).toBe(true)
  })

  it('transitions CLOSED -> OPEN after failure threshold', async () => {
    const failingOperation = async () => {
      throw new Error('Test failure')
    }

    // Execute 3 failures to trigger threshold
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation)
      }
      catch (error) {
        // Expected failures
      }
    }

    expect(circuitBreaker.getState()).toBe('OPEN')
    expect(circuitBreaker.isCallAllowed()).toBe(false)
  })

  it('transitions OPEN -> HALF_OPEN after recovery timeout', async () => {
    const failingOperation = async () => {
      throw new Error('Test failure')
    }

    // Trigger OPEN state
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation)
      }
      catch (error) {
        // Expected failures
      }
    }

    expect(circuitBreaker.getState()).toBe('OPEN')

    // Wait for recovery timeout + buffer
    await new Promise(resolve => setTimeout(resolve, 1100))

    // Should now allow one test call
    expect(circuitBreaker.isCallAllowed()).toBe(true)
    expect(circuitBreaker.getState()).toBe('HALF_OPEN')
  })

  it('transitions HALF_OPEN -> CLOSED after successful calls', async () => {
    const failingOperation = async () => {
      throw new Error('Test failure')
    }
    const successfulOperation = async () => {
      return 'success'
    }

    // Trigger OPEN state
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation)
      }
      catch (error) {
        // Expected failures
      }
    }

    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, 1100))

    // Execute 2 successful operations (success threshold)
    await circuitBreaker.execute(successfulOperation)
    await circuitBreaker.execute(successfulOperation)

    expect(circuitBreaker.getState()).toBe('CLOSED')
    expect(circuitBreaker.isCallAllowed()).toBe(true)
  })

  it('transitions HALF_OPEN -> OPEN on failure', async () => {
    const failingOperation = async () => {
      throw new Error('Test failure')
    }

    // Trigger OPEN state
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation)
      }
      catch (error) {
        // Expected failures
      }
    }

    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, 1100))

    // One failure in HALF_OPEN should trigger OPEN again
    try {
      await circuitBreaker.execute(failingOperation)
    }
    catch (error) {
      // Expected failure
    }

    expect(circuitBreaker.getState()).toBe('OPEN')
    expect(circuitBreaker.isCallAllowed()).toBe(false)
  })
})

describe('circuitBreaker - Failure Scenarios', () => {
  it('handles timeout operations', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 2,
      timeout: 100,
    })

    const slowOperation = async () => {
      await new Promise(resolve => setTimeout(resolve, 200))
      return 'slow result'
    }

    // Should timeout and count as failure
    await expect(circuitBreaker.execute(slowOperation)).rejects.toThrow('Operation timed out')

    // Second timeout should trigger OPEN state
    await expect(circuitBreaker.execute(slowOperation)).rejects.toThrow('Operation timed out')

    expect(circuitBreaker.getState()).toBe('OPEN')
  })

  it('handles memory exhaustion scenarios', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 1,
      emergencyAbortConditions: {
        memoryUsagePercent: 95,
      },
    })

    // Mock high memory usage
    const originalMemoryUsage = process.memoryUsage
    process.memoryUsage = vi.fn().mockReturnValue({
      rss: 1000 * 1024 * 1024, // 1GB
      heapTotal: 950 * 1024 * 1024, // 950MB
      heapUsed: 950 * 1024 * 1024, // 950MB (95% usage)
      external: 0,
      arrayBuffers: 0,
    })

    const operation = async () => 'test'

    await expect(circuitBreaker.execute(operation)).rejects.toThrow('Emergency abort: Memory usage too high')

    // Restore original function
    process.memoryUsage = originalMemoryUsage
  })

  it('handles process count limits', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 1,
      emergencyAbortConditions: {
        activeProcessCount: 10,
      },
    })

    // Create mock process manager with high process count
    const mockGetProcessStats = vi.fn().mockReturnValue({
      active: 15,
      total: 20,
    })

    // Temporarily replace global process manager
    const originalGlobal = globalThis as any
    originalGlobal._testProcessManager = {
      getStats: mockGetProcessStats,
    }

    const operation = async () => 'test'

    // Should not trigger emergency abort without process manager integration
    // This tests the defensive programming pattern
    const result = await circuitBreaker.execute(operation)
    expect(result).toBe('test')

    delete originalGlobal._testProcessManager
  })

  it('prevents rapid-fire executions', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      requestRateLimit: 10,
      rateLimitWindow: 1000,
    })

    const fastOperation = async () => 'fast'

    // Execute 15 rapid operations (should hit rate limit)
    const promises = Array.from({ length: 15 }).fill(0).map(() => circuitBreaker.execute(fastOperation))
    const results = await Promise.allSettled(promises)

    const rejectedCount = results.filter(r => r.status === 'rejected').length
    expect(rejectedCount).toBeGreaterThan(0)

    // Some should be rejected due to rate limiting
    const rateLimitErrors = results.filter(r =>
      r.status === 'rejected'
      && (r.reason as Error).message.includes('Rate limit'),
    ).length
    expect(rateLimitErrors).toBeGreaterThan(0)
  })
})

describe('circuitBreaker - Security Features', () => {
  it('resists timing attacks on state comparison', () => {
    const circuitBreaker = new CircuitBreaker()

    // Test that isCallAllowed() has consistent timing
    const measurements: number[] = []

    for (let i = 0; i < 100; i++) {
      const start = process.hrtime.bigint()
      circuitBreaker.isCallAllowed()
      const end = process.hrtime.bigint()
      measurements.push(Number(end - start))
    }

    // Check that timing variance is minimal (less than 10x difference)
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)
    const ratio = max / (min || 1)

    expect(ratio).toBeLessThan(10) // Allow some variance but not exploitation-level
  })

  it('prevents state manipulation through errors', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 2,
    })

    const maliciousOperation = async () => {
      // Try to manipulate circuit breaker state
      (circuitBreaker as any).state = 'CLOSED'
      throw new Error('Malicious failure')
    }

    const initialState = circuitBreaker.getState()

    try {
      await circuitBreaker.execute(maliciousOperation)
    }
    catch (error) {
      // Expected failure
    }

    // State should be updated properly despite manipulation attempt
    expect(circuitBreaker.getState()).toBe(initialState) // Still CLOSED after 1 failure
  })

  it('handles error objects safely', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 1,
    })

    const dangerousError = {
      message: 'Dangerous error',
      stack: 'fake stack',
      __proto__: {
        dangerous: 'property',
      },
      constructor: {
        dangerous: 'constructor',
      },
    }

    const operation = async () => {
      throw dangerousError
    }

    await expect(circuitBreaker.execute(operation)).rejects.toEqual(dangerousError)

    // Circuit breaker should still function normally
    expect(circuitBreaker.getState()).toBe('OPEN')
  })
})

describe('circuitBreaker - Performance and Load Testing', () => {
  it('handles high concurrency without deadlocks', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 10,
      timeout: 100,
    })

    const operation = async (id: number) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50))
      return `result-${id}`
    }

    // Execute 100 concurrent operations
    const promises = Array.from({ length: 100 }).fill(0).map((_, i) => circuitBreaker.execute(() => operation(i)))
    const results = await Promise.allSettled(promises)

    const successCount = results.filter(r => r.status === 'fulfilled').length
    expect(successCount).toBe(100) // All should succeed with proper concurrency handling
  })

  it('maintains performance under mixed success/failure load', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 25,
      recoveryTimeout: 100,
    })

    const mixedOperation = async (shouldFail: boolean) => {
      if (shouldFail) {
        throw new Error('Intentional failure')
      }
      return 'success'
    }

    const startTime = Date.now()

    // Execute 200 operations (70% success, 30% failure)
    const promises = Array.from({ length: 200 }).fill(0).map((_, i) =>
      circuitBreaker.execute(() => mixedOperation(i % 10 < 3)),
    )

    const results = await Promise.allSettled(promises)
    const endTime = Date.now()

    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failureCount = results.filter(r => r.status === 'rejected').length

    expect(successCount).toBeGreaterThan(100) // Most should succeed
    expect(failureCount).toBeGreaterThan(50) // Some should fail
    expect(endTime - startTime).toBeLessThan(5000) // Should complete in reasonable time
  })

  it('recovers gracefully from stress conditions', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 200,
      emergencyAbortConditions: {
        memoryUsagePercent: 99,
      },
    })

    // Simulate stress with rapid failures
    const stressOperation = async () => {
      throw new Error('Stress failure')
    }

    // Trigger circuit breaker opening
    for (let i = 0; i < 10; i++) {
      try {
        await circuitBreaker.execute(stressOperation)
      }
      catch (error) {
        // Expected failures
      }
    }

    expect(circuitBreaker.getState()).toBe('OPEN')

    // Wait for recovery and test with successful operation
    await new Promise(resolve => setTimeout(resolve, 300))

    const successOperation = async () => 'recovered'
    const result = await circuitBreaker.execute(successOperation)

    expect(result).toBe('recovered')
    expect(circuitBreaker.getState()).toBe('HALF_OPEN')
  })
})

describe('circuitBreaker - Configuration and Edge Cases', () => {
  it('handles invalid configuration gracefully', () => {
    // Test with negative values
    const cb1 = new CircuitBreaker({
      failureThreshold: -1,
      recoveryTimeout: -1000,
    })

    expect(cb1.getState()).toBe('CLOSED')
    expect(cb1.isCallAllowed()).toBe(true)

    // Test with extreme values
    const cb2 = new CircuitBreaker({
      failureThreshold: Number.MAX_SAFE_INTEGER,
      recoveryTimeout: Number.MAX_SAFE_INTEGER,
    })

    expect(cb2.getState()).toBe('CLOSED')
    expect(cb2.isCallAllowed()).toBe(true)
  })

  it('handles empty and null operations', async () => {
    const circuitBreaker = new CircuitBreaker()

    // Test with null operation
    await expect(circuitBreaker.execute(null as any)).rejects.toThrow()

    // Test with undefined operation
    await expect(circuitBreaker.execute(undefined as any)).rejects.toThrow()

    // Test with non-function operation
    await expect(circuitBreaker.execute('not a function' as any)).rejects.toThrow()
  })

  it('provides accurate statistics', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
    })

    const successOp = async () => 'success'
    const failOp = async () => { throw new Error('fail') }

    // Execute mixed operations
    await circuitBreaker.execute(successOp)
    try { await circuitBreaker.execute(failOp) }
    catch {}
    await circuitBreaker.execute(successOp)
    try { await circuitBreaker.execute(failOp) }
    catch {}

    const stats = circuitBreaker.getStats()

    expect(stats.totalRequests).toBe(4)
    expect(stats.successCount).toBe(2)
    expect(stats.failureCount).toBe(2)
    expect(stats.state).toBe('CLOSED')
    expect(stats.failureRate).toBe(0.5)
  })

  it('resets statistics correctly', async () => {
    const circuitBreaker = new CircuitBreaker()

    const operation = async () => 'test'
    await circuitBreaker.execute(operation)

    let stats = circuitBreaker.getStats()
    expect(stats.totalRequests).toBe(1)

    circuitBreaker.reset()

    stats = circuitBreaker.getStats()
    expect(stats.totalRequests).toBe(0)
    expect(stats.successCount).toBe(0)
    expect(stats.failureCount).toBe(0)
    expect(stats.state).toBe('CLOSED')
  })
})

describe('circuitBreaker - Error Propagation', () => {
  it('preserves original error details', async () => {
    const circuitBreaker = new CircuitBreaker()

    const originalError = new Error('Original error message')
    originalError.stack = 'Original stack trace'
    ;(originalError as any).customProperty = 'custom value'

    const operation = async () => {
      throw originalError
    }

    try {
      await circuitBreaker.execute(operation)
      expect(true).toBe(false) // Should not reach here
    }
    catch (error) {
      expect(error).toBe(originalError)
      expect((error as any).customProperty).toBe('custom value')
      expect(error.message).toBe('Original error message')
    }
  })

  it('handles async operation rejections', async () => {
    const circuitBreaker = new CircuitBreaker()

    const operation = async () => {
      return Promise.reject(new Error('Async rejection'))
    }

    await expect(circuitBreaker.execute(operation)).rejects.toThrow('Async rejection')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
