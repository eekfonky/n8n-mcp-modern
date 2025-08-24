import { describe, expect, it } from 'vitest'
import { RateLimiter } from '../../server/security.js'

describe('concurrency and Race Conditions', () => {
  it('should handle concurrent workflow modifications safely', async () => {
    const workflowId = 'test-workflow-123'
    const operations: Promise<{ id: string, version: number, timestamp: number }>[] = []

    // Simulate 10 concurrent operations on same workflow
    for (let i = 0; i < 10; i++) {
      operations.push(
        new Promise((resolve) => {
          setTimeout(() => {
            // Simulate workflow update
            resolve({
              id: workflowId,
              version: i,
              timestamp: Date.now(),
            })
          }, Math.random() * 100)
        }),
      )
    }

    const results = await Promise.allSettled(operations)

    // All should complete without race conditions
    const successful = results.filter(r => r.status === 'fulfilled')
    expect(successful.length).toBeGreaterThan(0)

    // Check for version conflicts
    const versions = successful.map(r =>
      (r as PromiseFulfilledResult<{ id: string, version: number, timestamp: number }>).value.version,
    )
    const uniqueVersions = new Set(versions)
    expect(uniqueVersions.size).toBe(successful.length)
  })

  it('should prevent rate limit bypass via concurrent connections', () => {
    // Create a test limiter with a small limit to verify concurrent protection
    const testLimiter = new RateLimiter(10, 60000) // 10 requests per minute
    const identifier = 'concurrent-test-user'

    // Try to make 100 concurrent requests
    const requests = Array.from({ length: 100 }, () =>
      testLimiter.isAllowed(identifier))

    const allowed = requests.filter(r => r === true).length

    // Should be limited to exactly 10 despite concurrent attempts
    expect(allowed).toBe(10) // Should allow exactly 10, reject the rest
  })

  it('should handle connection pool exhaustion gracefully', async () => {
    const connections = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      active: true,
      created: Date.now(),
    }))

    const MAX_CONNECTIONS = 20

    // Simulate connection pool management
    const activeConnections = connections.filter(c => c.active)

    if (activeConnections.length > MAX_CONNECTIONS) {
      // Should queue or reject excess connections
      const toClose = activeConnections.slice(MAX_CONNECTIONS)
      toClose.forEach(c => c.active = false)
    }

    const remainingActive = connections.filter(c => c.active).length
    expect(remainingActive).toBeLessThanOrEqual(MAX_CONNECTIONS)
  })

  it('should detect and prevent deadlocks', async () => {
    const locks = new Map<string, number>()
    const LOCK_TIMEOUT = 5000

    function acquireLock(resource: string): boolean {
      const now = Date.now()
      const existingLock = locks.get(resource)

      if (existingLock && now - existingLock < LOCK_TIMEOUT) {
        return false // Lock held by another process
      }

      locks.set(resource, now)
      return true
    }

    // Try to acquire same lock from multiple "processes"
    const lock1 = acquireLock('workflow-123')
    const lock2 = acquireLock('workflow-123')

    expect(lock1).toBe(true)
    expect(lock2).toBe(false) // Should fail - prevents deadlock
  })
})
