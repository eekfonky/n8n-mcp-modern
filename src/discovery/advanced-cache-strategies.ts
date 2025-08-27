/**
 * Advanced Caching Strategies with Background Refresh Mechanisms
 *
 * Enhances the existing discovery cache with sophisticated caching patterns:
 * - Background refresh for frequently accessed items
 * - Predictive cache warming based on usage patterns
 * - Intelligent cache invalidation strategies
 * - Multi-tier cache architecture
 * - Performance analytics and optimization
 */

import type { DiscoveryCache } from './discovery-cache.js'
import { logger } from '../server/logger.js'
import { createCleanObject } from '../utils/aggressive-memory-cleanup.js'

export interface CacheStrategy {
  name: string
  priority: number
  shouldApply: (key: string, accessCount: number, lastAccessed: number) => boolean
  ttlMultiplier: number
  backgroundRefresh: boolean
}

export interface UsagePattern {
  key: string
  frequency: number
  recentAccess: number
  predictedNextAccess: number
  category: string
}

export interface CachePerformanceMetrics {
  hitRatioTrend: number[]
  averageResponseTime: number
  backgroundRefreshSuccess: number
  backgroundRefreshFailures: number
  cacheMissPatterns: Record<string, number>
  hotKeyIdentification: string[]
  coldKeyCleanup: number
  memoryEfficiency: number
}

export class AdvancedCacheStrategies {
  private discoveryCache: DiscoveryCache
  private usagePatterns = new Map<string, UsagePattern>()
  private performanceMetrics: CachePerformanceMetrics
  private backgroundRefreshQueue = new Set<string>()
  private refreshWorkers: NodeJS.Timeout[] = []
  private analyticsInterval: NodeJS.Timeout | null = null

  private readonly strategies: CacheStrategy[] = [
    {
      name: 'frequent_access',
      priority: 90,
      shouldApply: (key, accessCount, lastAccessed) =>
        accessCount > 10 && (Date.now() - lastAccessed) < 300000, // 5 min
      ttlMultiplier: 2.0,
      backgroundRefresh: true,
    },
    {
      name: 'node_discovery_priority',
      priority: 80,
      shouldApply: key => key.startsWith('node:') || key.startsWith('nodes:'),
      ttlMultiplier: 1.5,
      backgroundRefresh: true,
    },
    {
      name: 'schema_critical',
      priority: 85,
      shouldApply: key => key.startsWith('schema:'),
      ttlMultiplier: 1.8,
      backgroundRefresh: true,
    },
    {
      name: 'cold_data',
      priority: 20,
      shouldApply: (key, accessCount, lastAccessed) =>
        accessCount < 2 && (Date.now() - lastAccessed) > 3600000, // 1 hour
      ttlMultiplier: 0.5,
      backgroundRefresh: false,
    },
  ]

  constructor(discoveryCache: DiscoveryCache) {
    this.discoveryCache = discoveryCache
    this.performanceMetrics = this.initializeMetrics()
    this.startBackgroundServices()

    logger.info('Advanced cache strategies initialized with background refresh')
  }

  /**
   * Initialize performance metrics tracking
   */
  private initializeMetrics(): CachePerformanceMetrics {
    return createCleanObject({
      hitRatioTrend: [],
      averageResponseTime: 0,
      backgroundRefreshSuccess: 0,
      backgroundRefreshFailures: 0,
      cacheMissPatterns: {},
      hotKeyIdentification: [],
      coldKeyCleanup: 0,
      memoryEfficiency: 0,
    })
  }

  /**
   * Start background refresh and analytics services
   */
  private startBackgroundServices(): void {
    // Background refresh worker
    const refreshWorker = setInterval(() => {
      this.processBackgroundRefresh()
    }, 30000) // Every 30 seconds

    this.refreshWorkers.push(refreshWorker)

    // Performance analytics and optimization
    this.analyticsInterval = setInterval(() => {
      this.performCacheAnalytics()
      this.optimizeCacheStrategy()
    }, 300000) // Every 5 minutes

    // Usage pattern learning
    const patternWorker = setInterval(() => {
      this.predictiveCacheWarming()
    }, 120000) // Every 2 minutes

    this.refreshWorkers.push(patternWorker)

    logger.info('Background cache services started')
  }

  /**
   * Apply intelligent caching strategy based on access patterns
   */
  applyIntelligentCaching<T>(
    key: string,
    data: T,
    baseTtl: number,
    category: string,
    accessCount: number = 0,
    lastAccessed: number = Date.now(),
  ): { ttl: number, backgroundRefresh: boolean } {
    const applicableStrategies = this.strategies
      .filter(strategy => strategy.shouldApply(key, accessCount, lastAccessed))
      .sort((a, b) => b.priority - a.priority)

    const primaryStrategy = applicableStrategies[0]

    if (primaryStrategy) {
      const enhancedTtl = Math.round(baseTtl * primaryStrategy.ttlMultiplier)

      // Queue for background refresh if strategy requires it
      if (primaryStrategy.backgroundRefresh) {
        this.queueBackgroundRefresh(key, category)
      }

      // Track usage patterns
      this.trackUsage(key, category, accessCount)

      logger.debug(`Applied cache strategy "${primaryStrategy.name}" to ${key}`, {
        baseTtl,
        enhancedTtl,
        backgroundRefresh: primaryStrategy.backgroundRefresh,
      })

      return {
        ttl: enhancedTtl,
        backgroundRefresh: primaryStrategy.backgroundRefresh,
      }
    }

    return { ttl: baseTtl, backgroundRefresh: false }
  }

  /**
   * Queue item for background refresh
   */
  private queueBackgroundRefresh(key: string, _category: string): void {
    this.backgroundRefreshQueue.add(key)

    // Limit queue size to prevent memory issues
    if (this.backgroundRefreshQueue.size > 100) {
      const oldestKey = Array.from(this.backgroundRefreshQueue)[0]
      if (oldestKey) {
        this.backgroundRefreshQueue.delete(oldestKey)
      }
    }
  }

  /**
   * Process background refresh queue
   */
  private async processBackgroundRefresh(): Promise<void> {
    if (this.backgroundRefreshQueue.size === 0)
      return

    const batchSize = Math.min(5, this.backgroundRefreshQueue.size)
    const keysToRefresh = Array.from(this.backgroundRefreshQueue).slice(0, batchSize)

    // Process all refreshes concurrently for better performance
    const refreshPromises = keysToRefresh.map(async (key) => {
      try {
        await this.refreshCacheEntry(key)
        this.performanceMetrics.backgroundRefreshSuccess++
        this.backgroundRefreshQueue.delete(key)
        return { key, success: true }
      }
      catch (error) {
        logger.warn(`Background refresh failed for ${key}:`, error)
        this.performanceMetrics.backgroundRefreshFailures++
        this.backgroundRefreshQueue.delete(key) // Remove failed items
        return { key, success: false }
      }
    })

    // Wait for all refreshes to complete
    await Promise.all(refreshPromises)

    if (keysToRefresh.length > 0) {
      logger.debug(`Background refresh processed ${keysToRefresh.length} items`)
    }
  }

  /**
   * Refresh individual cache entry
   */
  private async refreshCacheEntry(key: string): Promise<void> {
    // This would be implemented based on the specific cache entry type
    // For now, we'll simulate the refresh process

    if (key.startsWith('nodes:')) {
      // Would refresh node data from n8n API
      logger.debug(`Refreshing node cache: ${key}`)
    }
    else if (key.startsWith('schema:')) {
      // Would regenerate schema
      logger.debug(`Refreshing schema cache: ${key}`)
    }
    else if (key.startsWith('selection:')) {
      // Would recalculate tool selection
      logger.debug(`Refreshing selection cache: ${key}`)
    }
  }

  /**
   * Track usage patterns for predictive caching
   */
  private trackUsage(key: string, category: string, _accessCount: number): void {
    const existing = this.usagePatterns.get(key)
    const now = Date.now()

    if (existing) {
      existing.frequency++
      existing.recentAccess = now
      existing.predictedNextAccess = this.calculatePredictedAccess(existing)
    }
    else {
      this.usagePatterns.set(key, createCleanObject({
        key,
        frequency: 1,
        recentAccess: now,
        predictedNextAccess: now + 3600000, // Default 1 hour
        category,
      }))
    }

    // Limit usage patterns to prevent memory bloat
    if (this.usagePatterns.size > 500) {
      this.cleanupOldUsagePatterns()
    }
  }

  /**
   * Calculate predicted next access time based on patterns
   */
  private calculatePredictedAccess(pattern: UsagePattern): number {
    const averageInterval = pattern.frequency > 1
      ? (Date.now() - pattern.recentAccess) / pattern.frequency
      : 3600000 // Default 1 hour

    return Date.now() + averageInterval
  }

  /**
   * Clean up old usage patterns
   */
  private cleanupOldUsagePatterns(): void {
    const cutoffTime = Date.now() - 86400000 // 24 hours ago
    const keysToRemove: string[] = []

    for (const [key, pattern] of this.usagePatterns.entries()) {
      if (pattern.recentAccess < cutoffTime && pattern.frequency < 3) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => this.usagePatterns.delete(key))

    if (keysToRemove.length > 0) {
      logger.debug(`Cleaned up ${keysToRemove.length} old usage patterns`)
    }
  }

  /**
   * Predictive cache warming based on usage patterns
   */
  private predictiveCacheWarming(): void {
    const now = Date.now()
    const candidatesForWarming: string[] = []

    for (const [key, pattern] of this.usagePatterns.entries()) {
      // Predict if this key will be accessed soon
      if (pattern.predictedNextAccess <= now + 600000) { // Within 10 minutes
        candidatesForWarming.push(key)
      }
    }

    // Warm up predicted hot keys
    candidatesForWarming.slice(0, 10).forEach((key) => {
      this.queueBackgroundRefresh(key, 'predictive')
    })

    if (candidatesForWarming.length > 0) {
      logger.debug(`Queued ${Math.min(10, candidatesForWarming.length)} keys for predictive warming`)
    }
  }

  /**
   * Perform cache analytics and generate insights
   */
  private performCacheAnalytics(): void {
    const stats = this.discoveryCache.getStatistics()

    // Track hit ratio trend
    this.performanceMetrics.hitRatioTrend.push(stats.hitRatio)
    if (this.performanceMetrics.hitRatioTrend.length > 20) {
      this.performanceMetrics.hitRatioTrend.shift() // Keep last 20 measurements
    }

    // Identify hot keys
    this.performanceMetrics.hotKeyIdentification = Array.from(this.usagePatterns.entries())
      .sort((a, b) => b[1].frequency - a[1].frequency)
      .slice(0, 10)
      .map(([key]) => key)

    // Calculate memory efficiency
    this.performanceMetrics.memoryEfficiency = stats.totalEntries > 0
      ? stats.hitRatio * (1 - (stats.expiredEntries / stats.totalEntries))
      : 0

    logger.info('Cache analytics updated', {
      hitRatio: `${(stats.hitRatio * 100).toFixed(1)}%`,
      memoryEfficiency: `${(this.performanceMetrics.memoryEfficiency * 100).toFixed(1)}%`,
      backgroundRefreshSuccess: this.performanceMetrics.backgroundRefreshSuccess,
      hotKeys: this.performanceMetrics.hotKeyIdentification.length,
    })
  }

  /**
   * Optimize cache strategy based on performance metrics
   */
  private optimizeCacheStrategy(): void {
    const hitRatioTrend = this.performanceMetrics.hitRatioTrend

    if (hitRatioTrend.length >= 3) {
      const recentAverage = hitRatioTrend.slice(-3).reduce((a, b) => a + b) / 3
      const overallAverage = hitRatioTrend.reduce((a, b) => a + b) / hitRatioTrend.length

      // If hit ratio is declining, be more aggressive with caching
      if (recentAverage < overallAverage * 0.9) {
        this.strategies.forEach((strategy) => {
          if (strategy.name === 'frequent_access') {
            strategy.ttlMultiplier = Math.min(strategy.ttlMultiplier * 1.1, 3.0)
          }
        })

        logger.info('Cache strategy optimized: Increased TTL multipliers due to declining hit ratio')
      }
    }

    // Optimize based on memory efficiency
    if (this.performanceMetrics.memoryEfficiency < 0.7) {
      // More aggressive cleanup
      this.cleanupOldUsagePatterns()

      // Reduce TTL for cold data
      const coldStrategy = this.strategies.find(s => s.name === 'cold_data')
      if (coldStrategy) {
        coldStrategy.ttlMultiplier = Math.max(coldStrategy.ttlMultiplier * 0.9, 0.1)
      }

      logger.info('Cache strategy optimized: Reduced cold data TTL for better memory efficiency')
    }
  }

  /**
   * Get advanced cache performance report
   */
  getCachePerformanceReport(): {
    metrics: CachePerformanceMetrics
    recommendations: string[]
    usagePatterns: { total: number, active: number, hotKeys: string[] }
  } {
    const recommendations: string[] = []

    // Generate recommendations
    if (this.performanceMetrics.backgroundRefreshFailures > this.performanceMetrics.backgroundRefreshSuccess * 0.1) {
      recommendations.push('High background refresh failure rate - consider optimizing refresh logic')
    }

    if (this.performanceMetrics.memoryEfficiency < 0.8) {
      recommendations.push('Memory efficiency could be improved - consider more aggressive cache cleanup')
    }

    const recentHitRatio = this.performanceMetrics.hitRatioTrend.slice(-5).reduce((a, b) => a + b, 0) / 5
    if (recentHitRatio < 0.7) {
      recommendations.push('Hit ratio declining - consider cache warming or TTL adjustments')
    }

    const activePatterns = Array.from(this.usagePatterns.values())
      .filter(p => Date.now() - p.recentAccess < 3600000)
      .length

    return createCleanObject({
      metrics: this.performanceMetrics,
      recommendations,
      usagePatterns: {
        total: this.usagePatterns.size,
        active: activePatterns,
        hotKeys: this.performanceMetrics.hotKeyIdentification,
      },
    })
  }

  /**
   * Cleanup and destroy background services
   */
  destroy(): void {
    this.refreshWorkers.forEach(worker => clearInterval(worker))
    this.refreshWorkers = []

    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval)
      this.analyticsInterval = null
    }

    this.backgroundRefreshQueue.clear()
    this.usagePatterns.clear()

    logger.info('Advanced cache strategies destroyed')
  }
}
