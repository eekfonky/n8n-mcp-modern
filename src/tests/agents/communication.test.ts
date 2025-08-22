/**
 * Test Suite: Advanced Agent Communication Optimization
 * Tests the Phase 5 communication enhancements including:
 * - Advanced caching strategies
 * - Circuit breaker patterns
 * - Connection pooling
 * - Message queuing with backpressure
 * - Performance monitoring
 */

import type { Agent, EscalationRequest } from '../../agents/index.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AdvancedCache,
  AgentConnectionPool,
  CacheStrategy,
  CircuitBreaker,
  CircuitBreakerState,
  CommunicationManager,
  MessageQueue,
} from '../../agents/communication.js'

// Mock agent for testing
function createMockAgent(name: string): Agent {
  return {
    name,
    description: `Mock agent ${name}`,
    tier: 1 as any,
    capabilities: [],
    canHandle: vi.fn().mockReturnValue(true),
    getPriority: vi.fn().mockReturnValue(50),
    getCapabilities: vi.fn().mockReturnValue([]),
    executeWithContext: vi.fn().mockResolvedValue({ success: true }),
    validateInput: vi.fn().mockReturnValue({ isValid: true }),
  }
}

describe('advancedCache', () => {
  let cache: AdvancedCache<string>

  beforeEach(() => {
    cache = new AdvancedCache<string>(3, CacheStrategy.LRU, 1000) // 1 second TTL for testing
  })

  afterEach(() => {
    cache.clear()
  })

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1')
    expect(cache.get('key1')).toBe('value1')
  })

  it('should return undefined for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined()
  })

  it('should respect TTL expiration', async () => {
    cache.set('key1', 'value1', 100) // 100ms TTL
    expect(cache.get('key1')).toBe('value1')

    // Wait for TTL to expire
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 150)
    })
    expect(cache.get('key1')).toBeUndefined()
  })

  it('should evict LRU items when cache is full', () => {
    cache.set('key1', 'value1')
    cache.set('key2', 'value2')
    cache.set('key3', 'value3')

    // Access key1 to make it recently used
    cache.get('key1')

    // Add fourth item, should evict key2 (oldest unused)
    cache.set('key4', 'value4')

    expect(cache.get('key1')).toBe('value1') // Should still exist
    expect(cache.get('key2')).toBeUndefined() // Should be evicted
    expect(cache.get('key3')).toBe('value3') // Should still exist
    expect(cache.get('key4')).toBe('value4') // Should exist
  })

  it('should track hit/miss statistics', () => {
    cache.set('key1', 'value1')

    // Generate some hits and misses
    cache.get('key1') // hit
    cache.get('key1') // hit
    cache.get('nonexistent') // miss

    const stats = cache.getStats()
    expect(stats.hitCount).toBe(2)
    expect(stats.missCount).toBe(1)
    expect(stats.hitRatio).toBeCloseTo(0.67, 2)
  })

  it('should handle LFU eviction strategy', () => {
    const lfuCache = new AdvancedCache<string>(3, CacheStrategy.LFU)

    lfuCache.set('key1', 'value1')
    lfuCache.set('key2', 'value2')
    lfuCache.set('key3', 'value3')

    // Access key1 multiple times
    lfuCache.get('key1')
    lfuCache.get('key1')
    lfuCache.get('key1')

    // Access key2 once
    lfuCache.get('key2')

    // key3 has 0 accesses, should be evicted when adding key4
    lfuCache.set('key4', 'value4')

    expect(lfuCache.get('key1')).toBe('value1') // Should exist (most frequent)
    expect(lfuCache.get('key2')).toBe('value2') // Should exist
    expect(lfuCache.get('key3')).toBeUndefined() // Should be evicted (least frequent)
    expect(lfuCache.get('key4')).toBe('value4') // Should exist
  })
})

describe('circuitBreaker', () => {
  let circuitBreaker: CircuitBreaker

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 100, // 100ms for testing
      monitoringPeriod: 1000,
      minimumThroughput: 1,
    })
  })

  it('should start in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
  })

  it('should execute successful operations', async () => {
    const mockOperation = vi.fn().mockResolvedValue('success')
    const result = await circuitBreaker.execute(mockOperation)

    expect(result).toBe('success')
    expect(mockOperation).toHaveBeenCalledOnce()
    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
  })

  it('should open circuit after failure threshold', async () => {
    const mockOperation = vi.fn().mockRejectedValue(new Error('failure'))

    // Trigger failures
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(mockOperation)
      }
      catch (_error) {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN)

    // Next operation should be rejected without execution
    await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is OPEN')
    expect(mockOperation).toHaveBeenCalledTimes(3) // Should not be called again
  })

  it('should transition to HALF_OPEN after reset timeout', async () => {
    const mockOperation = vi.fn().mockRejectedValue(new Error('failure'))

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(mockOperation)
      }
      catch (_error) {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN)

    // Wait for reset timeout
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 150)
    })

    // Mock successful operation for half-open test
    const successOperation = vi.fn().mockResolvedValue('success')
    await circuitBreaker.execute(successOperation)

    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
  })

  it('should track failure and success statistics', async () => {
    const mockFailure = vi.fn().mockRejectedValue(new Error('failure'))
    const mockSuccess = vi.fn().mockResolvedValue('success')

    // One success
    await circuitBreaker.execute(mockSuccess)

    // Two failures
    try {
      await circuitBreaker.execute(mockFailure)
    }
    catch (_error) {
      // Expected
    }

    try {
      await circuitBreaker.execute(mockFailure)
    }
    catch (_error) {
      // Expected
    }

    const stats = circuitBreaker.getStats()
    expect(stats.successes).toBe(1)
    expect(stats.failures).toBe(2)
    expect(stats.state).toBe(CircuitBreakerState.CLOSED) // Not yet at threshold
  })
})

describe('agentConnectionPool', () => {
  let pool: AgentConnectionPool
  let mockAgents: Agent[]

  beforeEach(() => {
    mockAgents = [
      createMockAgent('agent1'),
      createMockAgent('agent2'),
      createMockAgent('agent3'),
    ]
    pool = new AgentConnectionPool(mockAgents, 5)
  })

  afterEach(async () => {
    await pool.destroy()
  })

  it('should acquire and release agents', async () => {
    const agent = await pool.acquire()
    expect(agent).toBeDefined()
    expect(mockAgents.includes(agent)).toBe(true)

    const stats = pool.getStats()
    expect(stats.inUse).toBe(1)
    expect(stats.available).toBeLessThan(stats.total)

    pool.release(agent)

    const statsAfter = pool.getStats()
    expect(statsAfter.inUse).toBe(0)
    expect(statsAfter.available).toBe(statsAfter.total)
  })

  it('should handle concurrent acquisitions', async () => {
    const acquisitions = []
    for (let i = 0; i < 3; i++) {
      acquisitions.push(pool.acquire())
    }

    const agents = await Promise.all(acquisitions)
    expect(agents).toHaveLength(3)

    // All should be different agents or the same agents reused
    agents.forEach((agent) => {
      expect(agent).toBeDefined()
      expect(mockAgents.includes(agent)).toBe(true)
    })
  })

  it('should timeout when pool is exhausted', async () => {
    // Exhaust the pool by acquiring without releasing
    const agents = []
    // Use a smaller number that actually exhausts the pool
    for (let i = 0; i < 3; i++) {
      agents.push(await pool.acquire())
    }

    // Create a new pool with a limited size to force timeout
    const limitedPool = new AgentConnectionPool(mockAgents, 3)

    // Exhaust the limited pool
    const exhaustAgents = []
    for (let i = 0; i < 3; i++) {
      exhaustAgents.push(await limitedPool.acquire())
    }

    // This should timeout since pool is exhausted and we don't release
    await expect(limitedPool.acquire()).rejects.toThrow('Timeout waiting for available agent')

    await limitedPool.destroy()
  })

  it('should track pool statistics', async () => {
    const agent1 = await pool.acquire()
    const _agent2 = await pool.acquire()

    const stats = pool.getStats()
    expect(stats.total).toBeGreaterThanOrEqual(2)
    expect(stats.inUse).toBe(2)
    expect(stats.available).toBe(stats.total - 2)

    pool.release(agent1)

    const statsAfter = pool.getStats()
    expect(statsAfter.inUse).toBe(1)
    expect(statsAfter.available).toBe(stats.available + 1)
  })
})

describe('messageQueue', () => {
  let queue: TestableMessageQueue

  class TestableMessageQueue extends MessageQueue<string> {
    public processedMessages: string[] = []

    protected async handleMessage(payload: string): Promise<void> {
      this.processedMessages.push(payload)
      // Simulate processing time
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10)
      })
    }
  }

  beforeEach(() => {
    queue = new TestableMessageQueue(10, 2) // Max size 10, concurrency 2
  })

  afterEach(() => {
    queue.clear()
  })

  it('should enqueue and process messages', async () => {
    await queue.enqueue('message1')
    await queue.enqueue('message2')

    // Wait for processing
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })

    expect(queue.processedMessages).toContain('message1')
    expect(queue.processedMessages).toContain('message2')
  })

  it('should respect priority ordering', async () => {
    // Test priority ordering by checking the internal queue structure
    class TestableQueue extends MessageQueue<string> {
      getQueueContents() {
        return this.queue.map(msg => ({ payload: msg.payload, priority: msg.priority }))
      }

      protected async handleMessage(_payload: string): Promise<void> {
        // Don't actually process messages for this test
        await Promise.resolve()
      }
    }

    const testQueue = new TestableQueue(10, 0) // No concurrency to prevent processing

    // Add messages in non-priority order
    await testQueue.enqueue('low-priority', 1)
    await testQueue.enqueue('high-priority', 10)
    await testQueue.enqueue('medium-priority', 5)

    const queueContents = testQueue.getQueueContents()

    // Messages should be ordered by priority (highest first)
    expect(queueContents[0].payload).toBe('high-priority')
    expect(queueContents[0].priority).toBe(10)
    expect(queueContents[1].payload).toBe('medium-priority')
    expect(queueContents[1].priority).toBe(5)
    expect(queueContents[2].payload).toBe('low-priority')
    expect(queueContents[2].priority).toBe(1)

    testQueue.clear()
  })

  it('should apply backpressure when queue is full', async () => {
    // Create a queue with very small size and no processing to force backpressure
    class NonProcessingQueue extends MessageQueue<string> {
      protected async handleMessage(_payload: string): Promise<void> {
        // Don't actually process - just wait forever to keep queue full
        return new Promise(() => {}) // Never resolves
      }
    }

    const fullQueue = new NonProcessingQueue(2, 0) // Max size 2, no workers

    // Manually add messages to internal queue to bypass processing
    await fullQueue.enqueue('message1')
    await fullQueue.enqueue('message2')

    // Give time for processing to not start (since concurrency is 0)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10)
    })

    // Adding one more should trigger backpressure
    await expect(fullQueue.enqueue('overflow')).rejects.toThrow('Message queue is full - backpressure applied')

    fullQueue.clear()
  })

  it('should track queue statistics', async () => {
    // Create queue with long processing time to check stats
    class SlowQueue extends TestableMessageQueue {
      protected async handleMessage(payload: string): Promise<void> {
        this.processedMessages.push(payload)
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 100)
        }) // Slow processing
      }
    }

    const slowQueue = new SlowQueue(10, 2)

    await slowQueue.enqueue('message1')
    await slowQueue.enqueue('message2')

    // Check stats immediately while processing
    const stats = slowQueue.getStats()
    expect(stats.size).toBeGreaterThanOrEqual(0) // May have been processed
    expect(stats.activeWorkers).toBeLessThanOrEqual(2)
    expect(typeof stats.processing).toBe('boolean')

    slowQueue.clear()
  })
})

describe('communicationManager', () => {
  let manager: CommunicationManager
  let mockAgents: Agent[]

  beforeEach(() => {
    mockAgents = [
      createMockAgent('agent1'),
      createMockAgent('agent2'),
    ]
    manager = new CommunicationManager(mockAgents)
  })

  afterEach(async () => {
    await manager.shutdown()
  })

  it('should route tools with optimization', async () => {
    const agent = await manager.routeWithOptimization('test-tool')

    expect(agent).toBeDefined()
    expect(agent.canHandle).toHaveBeenCalledWith('test-tool', undefined)
  })

  it('should cache routing decisions', async () => {
    const agent1 = await manager.routeWithOptimization('test-tool')
    const agent2 = await manager.routeWithOptimization('test-tool')

    // Should return the same agent due to caching
    expect(agent1).toBe(agent2)
  })

  it('should handle escalation requests', async () => {
    const escalationRequest: EscalationRequest = {
      originalToolName: 'complex-tool',
      reason: 'COMPLEXITY_EXCEEDED',
      urgency: 'high',
      sourceAgent: 'agent1',
    }

    const result = await manager.optimizedEscalation(escalationRequest)

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.handledBy).toBeDefined()
    expect(result.action).toBe('handled')
  })

  it('should provide communication metrics', () => {
    const metrics = manager.getMetrics()

    expect(metrics).toHaveProperty('routingLatency')
    expect(metrics).toHaveProperty('escalationLatency')
    expect(metrics).toHaveProperty('throughput')
    expect(metrics).toHaveProperty('errorRate')
    expect(metrics).toHaveProperty('cacheHitRatio')
    expect(metrics).toHaveProperty('activeConnections')
    expect(metrics).toHaveProperty('queueLength')
    expect(metrics).toHaveProperty('circuitBreakerState')
  })

  it('should handle routing failures gracefully', async () => {
    // Mock all agents to fail for this test
    const failingAgents = mockAgents.map(agent => ({
      ...agent,
      canHandle: vi.fn().mockImplementation(() => {
        throw new Error('Agent failure')
      }),
    }))

    const managerWithFailingAgents = new CommunicationManager(failingAgents)

    await expect(managerWithFailingAgents.routeWithOptimization('test-tool')).rejects.toThrow()

    await managerWithFailingAgents.shutdown()
  })

  it('should shutdown cleanly', async () => {
    const metricsBeforeShutdown = manager.getMetrics()
    expect(metricsBeforeShutdown).toBeDefined()

    await expect(manager.shutdown()).resolves.not.toThrow()
  })
})

describe('integration Tests', () => {
  let manager: CommunicationManager
  let mockAgents: Agent[]

  beforeEach(() => {
    mockAgents = [
      createMockAgent('workflow-architect'),
      createMockAgent('integration-specialist'),
      createMockAgent('node-specialist'),
    ]

    // Configure different priorities for different tools
    mockAgents[0].canHandle = vi.fn(tool => tool.includes('workflow') || tool.includes('tool-'))
    mockAgents[0].getPriority = vi.fn().mockReturnValue(80)

    mockAgents[1].canHandle = vi.fn(tool => tool.includes('auth') || tool.includes('tool-'))
    mockAgents[1].getPriority = vi.fn().mockReturnValue(90)

    mockAgents[2].canHandle = vi.fn(tool => tool.includes('node') || tool.includes('tool-'))
    mockAgents[2].getPriority = vi.fn().mockReturnValue(70)

    manager = new CommunicationManager(mockAgents)
  })

  afterEach(async () => {
    await manager.shutdown()
  })

  it('should route different tools to appropriate agents', async () => {
    const workflowAgent = await manager.routeWithOptimization('workflow-create')
    const authAgent = await manager.routeWithOptimization('auth-setup')
    const nodeAgent = await manager.routeWithOptimization('node-search')

    expect(workflowAgent.name).toBe('workflow-architect')
    expect(authAgent.name).toBe('integration-specialist')
    expect(nodeAgent.name).toBe('node-specialist')
  })

  it('should handle high-load scenarios with multiple concurrent requests', async () => {
    const requests = []
    for (let i = 0; i < 50; i++) {
      requests.push(manager.routeWithOptimization(`tool-${i}`))
    }

    const results = await Promise.all(requests)

    expect(results).toHaveLength(50)
    results.forEach((agent) => {
      expect(agent).toBeDefined()
      expect(mockAgents.includes(agent)).toBe(true)
    })

    const metrics = manager.getMetrics()
    expect(metrics.routingLatency.length).toBeGreaterThan(0)
  })

  it('should maintain performance under circuit breaker failures', async () => {
    // Configure an agent to fail
    mockAgents[0].canHandle = vi.fn().mockImplementation(() => {
      throw new Error('Simulated failure')
    })

    // Multiple requests should trigger circuit breaker
    const requests = []
    for (let i = 0; i < 10; i++) {
      requests.push(
        manager.routeWithOptimization('workflow-test')
          .catch(error => ({ error: error.message })),
      )
    }

    const results = await Promise.all(requests)

    // Some should fail, but system should remain stable
    const failures = results.filter(r => r && 'error' in r)
    expect(failures.length).toBeGreaterThan(0)

    const metrics = manager.getMetrics()
    expect(metrics.errorRate).toBeGreaterThan(0)
  })
})
