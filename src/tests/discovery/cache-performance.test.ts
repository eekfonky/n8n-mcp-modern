/**
 * Discovery Cache Performance Test Suite
 * Validates TTL-based caching, invalidation, and performance optimization
 *
 * This test suite validates:
 * - Cache hit/miss ratios and performance
 * - TTL-based expiration and cleanup
 * - Selective invalidation patterns
 * - Memory management and LRU eviction
 * - Background refresh capabilities
 * - Cache warming strategies
 *
 * @architecture High-performance caching with token efficiency
 * @coverage Target: 100% cache functionality coverage
 */

import type { N8nCredentialType, N8nNode, N8nWorkflow } from '../../discovery/n8n-api-client.js'
import type { GeneratedSchema } from '../../discovery/schema-generator.js'
import type { ToolSelection } from '../../discovery/tool-selector.js'
import type { ToolDefinition } from '../../tools/dynamic-tool-registry.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DiscoveryCache } from '../../discovery/discovery-cache.js'

// Mock data for testing
const mockN8nNodes: N8nNode[] = [
  {
    name: 'n8n-nodes-base.httpRequest',
    displayName: 'HTTP Request',
    description: 'Makes HTTP requests to any URL',
    version: 1,
    properties: [
      { displayName: 'URL', name: 'url', type: 'string', required: true },
      { displayName: 'Method', name: 'method', type: 'options', required: true },
    ],
    group: ['transform'],
  },
  {
    name: 'n8n-nodes-base.set',
    displayName: 'Set',
    description: 'Sets values and manipulates data',
    version: 1,
    properties: [
      { displayName: 'Values', name: 'values', type: 'fixedCollection', required: true },
    ],
    group: ['transform'],
  },
]

const mockSchema: GeneratedSchema = {
  schema: {
    url: { _def: { typeName: 'ZodString' } } as any,
    method: { _def: { typeName: 'ZodEnum' } } as any,
  },
  documentation: {
    url: 'The URL to make the request to',
    method: 'HTTP method to use',
  },
  required: ['url', 'method'],
  optional: [],
}

const mockTools: ToolDefinition[] = [
  {
    name: 'test_tool_1',
    title: 'Test Tool 1',
    description: 'A test tool',
    category: 'test',
    inputSchema: {},
    handler: async () => ({ content: [{ type: 'text', text: 'test' }] }),
    priority: 80,
    memoryOptimized: true,
    dynamicallyGenerated: true,
  },
]

const mockToolSelection: ToolSelection = {
  selectedTools: mockTools,
  scores: [
    {
      toolName: 'test_tool_1',
      score: 0.8,
      reasons: ['High priority'],
      category: 'test',
      contextMatch: 0.7,
      usageFrequency: 0.5,
      successRate: 0.9,
    },
  ],
  totalScore: 0.8,
  tokenEfficiency: 0.85,
  reasoning: ['Selected for testing'],
}

const mockWorkflows: N8nWorkflow[] = [
  {
    id: '1',
    name: 'Test Workflow',
    active: true,
    nodes: [],
    connections: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
]

const mockCredentialTypes: N8nCredentialType[] = [
  {
    name: 'httpBasicAuth',
    displayName: 'Basic Auth',
    properties: [
      { displayName: 'User', name: 'user', type: 'string', required: true },
      { displayName: 'Password', name: 'password', type: 'password', required: true },
    ],
  },
]

describe('discovery Cache Performance', () => {
  let cache: DiscoveryCache

  beforeEach(() => {
    cache = new DiscoveryCache({
      defaultTtl: 1000, // 1 second for testing
      maxSize: 100,
      backgroundRefresh: true,
      warmingStrategy: 'lazy',
      cleanupInterval: 500, // 500ms for testing
    })
  })

  afterEach(() => {
    cache?.destroy()
  })

  describe('basic Caching Operations', () => {
    it('should cache and retrieve nodes', () => {
      cache.cacheNodes(mockN8nNodes)

      const retrievedNodes = cache.getNodes()
      expect(retrievedNodes).toEqual(mockN8nNodes)
      expect(retrievedNodes?.length).toBe(2)
    })

    it('should cache individual nodes', () => {
      cache.cacheNodes(mockN8nNodes)

      const httpNode = cache.getNode('n8n-nodes-base.httpRequest')
      expect(httpNode).toEqual(mockN8nNodes[0])

      const setNode = cache.getNode('n8n-nodes-base.set')
      expect(setNode).toEqual(mockN8nNodes[1])

      const nonExistentNode = cache.getNode('non-existent')
      expect(nonExistentNode).toBeNull()
    })

    it('should cache and retrieve schemas', () => {
      cache.cacheSchema('test-node', mockSchema)

      const retrievedSchema = cache.getSchema('test-node')
      expect(retrievedSchema).toEqual(mockSchema)
    })

    it('should cache and retrieve tool selections', () => {
      const contextHash = 'test-context-hash'
      cache.cacheToolSelection(contextHash, mockToolSelection)

      const retrievedSelection = cache.getToolSelection(contextHash)
      expect(retrievedSelection).toEqual(mockToolSelection)
    })

    it('should cache and retrieve workflows and credentials', () => {
      cache.cacheWorkflows(mockWorkflows)
      cache.cacheCredentialTypes(mockCredentialTypes)

      const retrievedWorkflows = cache.getWorkflows()
      const retrievedCredentials = cache.getCredentialTypes()

      expect(retrievedWorkflows).toEqual(mockWorkflows)
      expect(retrievedCredentials).toEqual(mockCredentialTypes)
    })
  })

  describe('tTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      cache.cacheNodes(mockN8nNodes, 100) // 100ms TTL

      // Should be available immediately
      expect(cache.getNodes()).toEqual(mockN8nNodes)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should be expired
      expect(cache.getNodes()).toBeNull()
    })

    it('should handle different TTLs for different data types', () => {
      cache.cacheNodes(mockN8nNodes, 2000) // 2 second TTL
      cache.cacheSchema('test-node', mockSchema, 500) // 500ms TTL

      // Both should be available immediately
      expect(cache.getNodes()).toEqual(mockN8nNodes)
      expect(cache.getSchema('test-node')).toEqual(mockSchema)
    })

    it('should update access statistics on cache hits', () => {
      cache.cacheNodes(mockN8nNodes)

      // Access multiple times
      cache.getNodes()
      cache.getNodes()
      cache.getNodes()

      const stats = cache.getStatistics()
      expect(stats.hitCount).toBe(3)
      expect(stats.missCount).toBe(0)
    })

    it('should track cache misses', () => {
      const nonExistent = cache.getNodes()
      expect(nonExistent).toBeNull()

      const stats = cache.getStatistics()
      expect(stats.missCount).toBe(1)
      expect(stats.hitCount).toBe(0)
    })
  })

  describe('cache Statistics and Health', () => {
    it('should provide accurate statistics', () => {
      cache.cacheNodes(mockN8nNodes)
      cache.cacheSchema('test-node', mockSchema)
      cache.cacheToolSelection('test-context', mockToolSelection)

      // Access some entries
      cache.getNodes()
      cache.getSchema('test-node')
      cache.getSchema('non-existent') // Miss

      const stats = cache.getStatistics()

      expect(stats.totalEntries).toBe(5) // 2 individual nodes + 1 nodes list + 1 schema + 1 selection
      expect(stats.hitCount).toBe(2)
      expect(stats.missCount).toBe(1)
      expect(stats.hitRatio).toBeCloseTo(0.667, 2)
      expect(stats.categoryCounts).toBeTruthy()
      expect(typeof stats.memoryUsage).toBe('number')
    })

    it('should provide health status', () => {
      cache.cacheNodes(mockN8nNodes)

      const health = cache.getHealthStatus()

      expect(health.status).toBe('healthy')
      expect(Array.isArray(health.issues)).toBe(true)
    })

    it('should detect health issues', () => {
      // Fill cache to near capacity
      for (let i = 0; i < 95; i++) {
        cache.cacheSchema(`node-${i}`, mockSchema)
      }

      const health = cache.getHealthStatus()
      expect(health.status).toBe('warning')
      expect(health.issues.some(issue => issue.includes('capacity'))).toBe(true)
    })
  })

  describe('cache Invalidation', () => {
    beforeEach(() => {
      cache.cacheNodes(mockN8nNodes)
      cache.cacheSchema('http-node', mockSchema)
      cache.cacheSchema('set-node', mockSchema)
      cache.cacheToolSelection('test-context', mockToolSelection)
    })

    it('should invalidate entries by pattern', () => {
      const invalidated = cache.invalidate('schema')

      expect(invalidated).toBe(2) // Should invalidate both schemas
      expect(cache.getSchema('http-node')).toBeNull()
      expect(cache.getSchema('set-node')).toBeNull()
      expect(cache.getNodes()).toEqual(mockN8nNodes) // Nodes should remain
    })

    it('should invalidate entries by regex pattern', () => {
      const invalidated = cache.invalidate(/node:/)

      expect(invalidated).toBe(2) // Should invalidate individual nodes
      expect(cache.getNode('n8n-nodes-base.httpRequest')).toBeNull()
      expect(cache.getNode('n8n-nodes-base.set')).toBeNull()
      expect(cache.getNodes()).toEqual(mockN8nNodes) // Nodes list should remain
    })

    it('should invalidate by category', () => {
      const invalidated = cache.invalidateCategory('schemas')

      expect(invalidated).toBe(2)
      expect(cache.getSchema('http-node')).toBeNull()
      expect(cache.getSchema('set-node')).toBeNull()
    })

    it('should clear all cache entries', () => {
      cache.clear()

      const stats = cache.getStatistics()
      expect(stats.totalEntries).toBe(0)
      expect(stats.hitCount).toBe(0)
      expect(stats.missCount).toBe(0)
    })
  })

  describe('memory Management and LRU Eviction', () => {
    it('should evict LRU entries when cache is full', () => {
      const smallCache = new DiscoveryCache({ maxSize: 3 })

      // Fill cache
      smallCache.cacheSchema('schema1', mockSchema)
      smallCache.cacheSchema('schema2', mockSchema)
      smallCache.cacheSchema('schema3', mockSchema)

      expect(smallCache.getStatistics().totalEntries).toBe(3)

      // Access schema2 to make it recently used
      smallCache.getSchema('schema2')

      // Add another entry to trigger eviction
      smallCache.cacheSchema('schema4', mockSchema)

      // schema1 should be evicted (least recently used)
      expect(smallCache.getSchema('schema1')).toBeNull()
      expect(smallCache.getSchema('schema2')).toEqual(mockSchema)
      expect(smallCache.getSchema('schema4')).toEqual(mockSchema)

      smallCache.destroy()
    })

    it('should estimate memory usage', () => {
      cache.cacheNodes(mockN8nNodes)
      cache.cacheSchema('test', mockSchema)

      const stats = cache.getStatistics()
      expect(stats.memoryUsage).toBeGreaterThan(0)
    })
  })

  describe('background Operations', () => {
    it('should support cache warming', async () => {
      const warmingFn = vi.fn().mockResolvedValue(undefined)

      await cache.warmCache(warmingFn)

      // Warming function should be called for eager strategy
      // For lazy strategy in test, it might not be called immediately
      expect(warmingFn).toHaveBeenCalledTimes(1)
    })

    it('should handle cache warming failures gracefully', async () => {
      const failingWarmingFn = vi.fn().mockRejectedValue(new Error('Warming failed'))

      // Should not throw
      await expect(cache.warmCache(failingWarmingFn)).resolves.toBeUndefined()
      expect(failingWarmingFn).toHaveBeenCalled()
    })

    it('should perform background refresh', async () => {
      const refreshFn = vi.fn().mockResolvedValue({ updated: 'data' })

      cache.cacheSchema('test', mockSchema)

      await cache.refreshEntry('schema:test', refreshFn, 2000)

      expect(refreshFn).toHaveBeenCalled()
    })
  })

  describe('performance Optimization', () => {
    it('should maintain good hit ratios', () => {
      // Simulate typical usage patterns
      cache.cacheNodes(mockN8nNodes)

      // Access nodes multiple times (typical discovery pattern)
      for (let i = 0; i < 10; i++) {
        cache.getNodes()
        cache.getNode('n8n-nodes-base.httpRequest')
      }

      const stats = cache.getStatistics()
      expect(stats.hitRatio).toBeGreaterThan(0.9) // Should have > 90% hit ratio
    })

    it('should optimize memory for frequently accessed items', () => {
      cache.cacheNodes(mockN8nNodes)
      cache.cacheSchema('frequent', mockSchema, 5000) // Longer TTL
      cache.cacheSchema('infrequent', mockSchema, 500) // Shorter TTL

      // Access frequent item multiple times
      for (let i = 0; i < 5; i++) {
        cache.getSchema('frequent')
      }

      // Access infrequent item once
      cache.getSchema('infrequent')

      const stats = cache.getStatistics()
      expect(stats.totalEntries).toBeGreaterThan(0)
      expect(stats.hitCount).toBe(6)
    })
  })

  describe('cleanup and Resource Management', () => {
    it('should cleanup expired entries automatically', async () => {
      const shortTtlCache = new DiscoveryCache({
        defaultTtl: 50, // 50ms
        cleanupInterval: 100, // 100ms cleanup
      })

      shortTtlCache.cacheNodes(mockN8nNodes, 50)

      expect(shortTtlCache.getStatistics().totalEntries).toBeGreaterThan(0)

      // Wait for expiration and cleanup
      await new Promise(resolve => setTimeout(resolve, 200))

      // Entries should be cleaned up
      const stats = shortTtlCache.getStatistics()
      expect(stats.expiredEntries).toBe(0) // Should have been cleaned up

      shortTtlCache.destroy()
    })

    it('should destroy cache and cleanup resources', () => {
      cache.cacheNodes(mockN8nNodes)

      const statsBeforeDestroy = cache.getStatistics()
      expect(statsBeforeDestroy.totalEntries).toBeGreaterThan(0)

      cache.destroy()

      const statsAfterDestroy = cache.getStatistics()
      expect(statsAfterDestroy.totalEntries).toBe(0)
    })
  })
})
