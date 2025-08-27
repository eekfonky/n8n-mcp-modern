/**
 * Discovery Cache Layer with TTL and Invalidation
 * High-performance caching for n8n discovery results and schemas
 *
 * FEATURES:
 * - TTL-based expiration with automatic cleanup
 * - Selective invalidation by category or pattern
 * - Memory-efficient LRU eviction policy
 * - Background refresh capabilities
 * - Cache warming strategies
 * - Hit/miss analytics and optimization
 */

import type { ToolDefinition } from '../tools/dynamic-tool-registry.js'
import type { N8nCredentialType, N8nNode, N8nWorkflow } from './n8n-api-client.js'
import type { GeneratedSchema } from './schema-generator.js'
import type { ToolSelection } from './tool-selector.js'
import { logger } from '../server/logger.js'
import { createCleanObject } from '../utils/aggressive-memory-cleanup.js'

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
  category: string
  key: string
}

export interface CacheOptions {
  defaultTtl?: number
  maxSize?: number
  backgroundRefresh?: boolean
  warmingStrategy?: 'eager' | 'lazy' | 'scheduled'
  cleanupInterval?: number
}

export interface CacheStatistics {
  totalEntries: number
  hitCount: number
  missCount: number
  hitRatio: number
  evictionCount: number
  memoryUsage: number
  categoryCounts: Record<string, number>
  averageTtl: number
  expiredEntries: number
}

export class DiscoveryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  private hitCount = 0
  private missCount = 0
  private evictionCount = 0
  private cleanupTimer: NodeJS.Timeout | null = null

  private readonly options: Required<CacheOptions>

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTtl: options.defaultTtl || 3600000, // 1 hour
      maxSize: options.maxSize || 1000,
      backgroundRefresh: options.backgroundRefresh || false,
      warmingStrategy: options.warmingStrategy || 'lazy',
      cleanupInterval: options.cleanupInterval || 300000, // 5 minutes
    }

    // Start cleanup timer
    this.startCleanupTimer()

    logger.info(`Discovery cache initialized with TTL: ${this.options.defaultTtl}ms, Max Size: ${this.options.maxSize}`)
  }

  /**
   * Cache n8n nodes with category-specific TTL
   */
  cacheNodes(nodes: N8nNode[], ttl?: number): void {
    const effectiveTtl = ttl || this.options.defaultTtl
    const key = 'nodes:all'

    this.setCache(key, nodes, effectiveTtl, 'nodes')

    // Also cache individual nodes for quick lookup
    nodes.forEach((node) => {
      this.setCache(`node:${node.name}`, node, effectiveTtl, 'nodes')
    })

    logger.debug(`Cached ${nodes.length} n8n nodes with TTL ${effectiveTtl}ms`)
  }

  /**
   * Cache generated schemas with optimization for frequently used nodes
   */
  cacheSchema(nodeName: string, schema: GeneratedSchema, ttl?: number): void {
    const effectiveTtl = ttl || this.options.defaultTtl * 2 // Schemas are more expensive to generate
    const key = `schema:${nodeName}`

    this.setCache(key, schema, effectiveTtl, 'schemas')

    logger.debug(`Cached schema for ${nodeName} with TTL ${effectiveTtl}ms`)
  }

  /**
   * Cache tool definitions with priority-based TTL
   */
  cacheTools(tools: ToolDefinition[], ttl?: number): void {
    const effectiveTtl = ttl || this.options.defaultTtl
    const key = 'tools:dynamic'

    this.setCache(key, tools, effectiveTtl, 'tools')

    // Cache high-priority tools individually with longer TTL
    tools.filter(t => t.priority >= 80).forEach((tool) => {
      this.setCache(`tool:${tool.name}`, tool, effectiveTtl * 1.5, 'tools')
    })

    logger.debug(`Cached ${tools.length} dynamic tools with TTL ${effectiveTtl}ms`)
  }

  /**
   * Cache tool selections for context patterns
   */
  cacheToolSelection(contextHash: string, selection: ToolSelection, ttl?: number): void {
    const effectiveTtl = ttl || this.options.defaultTtl / 2 // Selections are more dynamic
    const key = `selection:${contextHash}`

    this.setCache(key, selection, effectiveTtl, 'selections')

    logger.debug(`Cached tool selection for context ${contextHash} with TTL ${effectiveTtl}ms`)
  }

  /**
   * Cache workflows and credentials
   */
  cacheWorkflows(workflows: N8nWorkflow[], ttl?: number): void {
    const effectiveTtl = ttl || this.options.defaultTtl
    this.setCache('workflows:all', workflows, effectiveTtl, 'workflows')

    logger.debug(`Cached ${workflows.length} workflows with TTL ${effectiveTtl}ms`)
  }

  cacheCredentialTypes(credentialTypes: N8nCredentialType[], ttl?: number): void {
    const effectiveTtl = ttl || this.options.defaultTtl
    this.setCache('credentials:all', credentialTypes, effectiveTtl, 'credentials')

    logger.debug(`Cached ${credentialTypes.length} credential types with TTL ${effectiveTtl}ms`)
  }

  /**
   * Get cached data with automatic expiration check
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.missCount++
      logger.debug(`Cache miss for key: ${key}`)
      return null
    }

    const now = Date.now()

    // Check if expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.missCount++
      logger.debug(`Cache expired for key: ${key}`)
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = now
    this.hitCount++

    logger.debug(`Cache hit for key: ${key} (accessed ${entry.accessCount} times)`)
    return entry.data as T
  }

  /**
   * Get cached nodes
   */
  getNodes(): N8nNode[] | null {
    return this.get<N8nNode[]>('nodes:all')
  }

  /**
   * Get cached node by name
   */
  getNode(nodeName: string): N8nNode | null {
    return this.get<N8nNode>(`node:${nodeName}`)
  }

  /**
   * Get cached schema
   */
  getSchema(nodeName: string): GeneratedSchema | null {
    return this.get<GeneratedSchema>(`schema:${nodeName}`)
  }

  /**
   * Get cached tools
   */
  getTools(): ToolDefinition[] | null {
    return this.get<ToolDefinition[]>('tools:dynamic')
  }

  /**
   * Get cached tool selection
   */
  getToolSelection(contextHash: string): ToolSelection | null {
    return this.get<ToolSelection>(`selection:${contextHash}`)
  }

  /**
   * Get cached workflows and credentials
   */
  getWorkflows(): N8nWorkflow[] | null {
    return this.get<N8nWorkflow[]>('workflows:all')
  }

  getCredentialTypes(): N8nCredentialType[] | null {
    return this.get<N8nCredentialType[]>('credentials:all')
  }

  /**
   * Invalidate cache entries by pattern or category
   */
  invalidate(pattern: string | RegExp): number {
    const keys = Array.from(this.cache.keys())
    let invalidatedCount = 0

    const matcher = typeof pattern === 'string'
      ? (key: string): boolean => key.includes(pattern)
      : (key: string): boolean => pattern.test(key)

    keys.forEach((key) => {
      if (matcher(key)) {
        this.cache.delete(key)
        invalidatedCount++
      }
    })

    logger.info(`Invalidated ${invalidatedCount} cache entries matching pattern: ${pattern}`)
    return invalidatedCount
  }

  /**
   * Invalidate by category
   */
  invalidateCategory(category: string): number {
    const entries = Array.from(this.cache.entries())
    let invalidatedCount = 0

    entries.forEach(([key, entry]) => {
      if (entry.category === category) {
        this.cache.delete(key)
        invalidatedCount++
      }
    })

    logger.info(`Invalidated ${invalidatedCount} cache entries in category: ${category}`)
    return invalidatedCount
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    const previousSize = this.cache.size
    this.cache.clear()
    this.hitCount = 0
    this.missCount = 0
    this.evictionCount = 0

    logger.info(`Cleared ${previousSize} cache entries`)
  }

  /**
   * Refresh specific cache entry in background
   */
  async refreshEntry<T>(key: string, refreshFn: () => Promise<T>, ttl?: number): Promise<void> {
    if (!this.options.backgroundRefresh) {
      return
    }

    try {
      const newData = await refreshFn()
      const entry = this.cache.get(key)

      if (entry) {
        entry.data = newData
        entry.timestamp = Date.now()
        entry.ttl = ttl || entry.ttl

        logger.debug(`Background refresh completed for key: ${key}`)
      }
    }
    catch (error) {
      logger.warn(`Background refresh failed for key ${key}:`, error)
    }
  }

  /**
   * Get cache statistics for monitoring and optimization
   */
  getStatistics(): CacheStatistics {
    const now = Date.now()
    const entries = Array.from(this.cache.values())

    const categoryCounts: Record<string, number> = {}
    let totalTtl = 0
    let expiredCount = 0

    entries.forEach((entry) => {
      categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1
      totalTtl += entry.ttl

      if (now - entry.timestamp > entry.ttl) {
        expiredCount++
      }
    })

    const totalRequests = this.hitCount + this.missCount
    const hitRatio = totalRequests > 0 ? this.hitCount / totalRequests : 0

    return createCleanObject({
      totalEntries: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRatio: Number(hitRatio.toFixed(3)),
      evictionCount: this.evictionCount,
      memoryUsage: this.estimateMemoryUsage(),
      categoryCounts,
      averageTtl: entries.length > 0 ? totalTtl / entries.length : 0,
      expiredEntries: expiredCount,
    })
  }

  /**
   * Get cache health status
   */
  getHealthStatus(): { status: 'healthy' | 'warning' | 'critical', issues: string[] } {
    const stats = this.getStatistics()
    const issues: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    // Check hit ratio
    if (stats.hitRatio < 0.5 && stats.hitCount + stats.missCount > 100) {
      issues.push(`Low hit ratio: ${(stats.hitRatio * 100).toFixed(1)}%`)
      status = 'warning'
    }

    // Check memory usage
    if (stats.memoryUsage > 50 * 1024 * 1024) { // 50MB
      issues.push(`High memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(1)}MB`)
      status = 'warning'
    }

    // Check expired entries ratio
    if (stats.expiredEntries > stats.totalEntries * 0.3) {
      issues.push(`High expired entries ratio: ${(stats.expiredEntries / stats.totalEntries * 100).toFixed(1)}%`)
      status = 'warning'
    }

    // Check if cache is near max size
    if (stats.totalEntries > this.options.maxSize * 0.9) {
      issues.push(`Cache near capacity: ${stats.totalEntries}/${this.options.maxSize}`)
      status = 'warning'
    }

    return { status, issues }
  }

  /**
   * Warm cache with frequently used data
   */
  async warmCache(warmingFn: () => Promise<void>): Promise<void> {
    try {
      logger.info('Starting cache warming...')
      await warmingFn()
      logger.info('Cache warming completed')
    }
    catch (error) {
      logger.warn('Cache warming failed:', error)
    }
  }

  /**
   * Private helper to set cache entry with LRU eviction
   */
  private setCache<T>(key: string, data: T, ttl: number, category: string): void {
    // Check if we need to evict entries
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = createCleanObject({
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
      category,
      key,
    })

    this.cache.set(key, entry)
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    const entries = Array.from(this.cache.entries())

    // Sort by last accessed (oldest first)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    // Remove oldest 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1))

    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const entry = entries[i]
      if (entry && entry[0]) {
        this.cache.delete(entry[0])
        this.evictionCount++
      }
    }

    logger.debug(`Evicted ${toRemove} LRU cache entries`)
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())
    let removedCount = 0

    entries.forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        removedCount++
      }
    })

    if (removedCount > 0) {
      logger.debug(`Cleaned up ${removedCount} expired cache entries`)
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired()
    }, this.options.cleanupInterval)
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let size = 0

    this.cache.forEach((entry) => {
      // Rough estimation of memory usage
      size += JSON.stringify(entry.data).length * 2 // UTF-16 characters
      size += 200 // Overhead for entry metadata
    })

    return size
  }

  /**
   * Destroy cache and cleanup timers
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    this.clear()
    logger.info('Discovery cache destroyed')
  }
}
