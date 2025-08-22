/**
 * Advanced Memory Management for n8n-MCP Modern
 * Implements proactive memory monitoring, leak detection, and garbage collection optimization
 */

import process from 'node:process'
import { clearInterval, setInterval } from 'node:timers'
import { config } from '../server/config.js'
import { logger } from '../server/logger.js'

/**
 * Memory usage statistics interface
 */
export interface MemoryStats {
  rss: number // Resident Set Size - total memory allocated
  heapTotal: number // Total heap size allocated by V8
  heapUsed: number // Heap memory used by V8
  external: number // C++ objects bound to JavaScript objects
  arrayBuffers: number // Memory allocated for ArrayBuffers
  timestamp: number // When the measurement was taken
}

/**
 * Memory threshold levels
 */
export enum MemoryLevel {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * Memory leak detection result
 */
export interface LeakDetection {
  suspected: boolean
  trend: 'increasing' | 'stable' | 'decreasing'
  rate: number // MB per minute
  recommendation?: string
}

/**
 * Advanced memory manager with proactive monitoring and optimization
 */
export class AdvancedMemoryManager {
  private monitoringInterval: NodeJS.Timeout | null = null
  private gcInterval: NodeJS.Timeout | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  private memoryHistory: MemoryStats[] = []
  private readonly maxHistorySize = 100

  private weakRefs = new Set<WeakRef<object>>()
  private objectRegistry = new FinalizationRegistry((heldValue) => {
    logger.debug('Object finalized:', heldValue)
  })

  private lastGCTime = 0
  private gcCount = 0

  constructor() {
    // Set up memory monitoring if enabled
    if (config.enableMemoryMonitoring) {
      this.startMonitoring()
    }

    // Set up process warnings for memory issues
    this.setupProcessWarnings()
  }

  /**
   * Start comprehensive memory monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval)
      return

    // Monitor memory usage every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage()
    }, 30000)

    // Schedule garbage collection based on configuration
    this.gcInterval = setInterval(() => {
      this.performGarbageCollection()
    }, config.gcIntervalMs)

    // Set up cache cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.performCacheCleanup()
    }, config.cacheCleanupIntervalMs)

    logger.info('Advanced memory monitoring started', {
      gcInterval: `${config.gcIntervalMs}ms`,
      cleanupInterval: `${config.cacheCleanupIntervalMs}ms`,
      warningThreshold: `${config.memoryThresholdWarning}%`,
      criticalThreshold: `${config.memoryThresholdCritical}%`,
    })
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    if (this.gcInterval) {
      clearInterval(this.gcInterval)
      this.gcInterval = null
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    logger.info('Memory monitoring stopped')
  }

  /**
   * Get current memory statistics
   */
  getCurrentMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage()
    return {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      timestamp: Date.now(),
    }
  }

  /**
   * Check memory usage and trigger warnings/actions as needed
   */
  private checkMemoryUsage(): void {
    const stats = this.getCurrentMemoryStats()
    this.memoryHistory.push(stats)

    // Trim history to prevent unbounded growth
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift()
    }

    // Calculate memory usage percentage
    const heapUsagePercent = (stats.heapUsed / stats.heapTotal) * 100
    const level = this.getMemoryLevel(heapUsagePercent)

    // Log memory status based on level
    switch (level) {
      case MemoryLevel.CRITICAL:
        logger.error('CRITICAL: Memory usage exceeded threshold', {
          heapUsed: `${Math.round(stats.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(stats.heapTotal / 1024 / 1024)}MB`,
          usage: `${heapUsagePercent.toFixed(1)}%`,
          threshold: `${config.memoryThresholdCritical}%`,
        })
        this.handleCriticalMemory(stats)
        break

      case MemoryLevel.WARNING:
        logger.warn('WARNING: Memory usage above warning threshold', {
          heapUsed: `${Math.round(stats.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(stats.heapTotal / 1024 / 1024)}MB`,
          usage: `${heapUsagePercent.toFixed(1)}%`,
          threshold: `${config.memoryThresholdWarning}%`,
        })
        this.handleWarningMemory(stats)
        break

      default:
        logger.debug('Memory usage normal', {
          heapUsed: `${Math.round(stats.heapUsed / 1024 / 1024)}MB`,
          usage: `${heapUsagePercent.toFixed(1)}%`,
        })
    }

    // Detect potential memory leaks
    const leakDetection = this.detectMemoryLeaks()
    if (leakDetection.suspected) {
      logger.warn('Potential memory leak detected', leakDetection)
    }
  }

  /**
   * Determine memory level based on usage percentage
   */
  private getMemoryLevel(usagePercent: number): MemoryLevel {
    if (usagePercent >= config.memoryThresholdCritical) {
      return MemoryLevel.CRITICAL
    }
    else if (usagePercent >= config.memoryThresholdWarning) {
      return MemoryLevel.WARNING
    }
    return MemoryLevel.NORMAL
  }

  /**
   * Handle critical memory usage
   */
  private handleCriticalMemory(stats: MemoryStats): void {
    // Force garbage collection
    this.forceGarbageCollection()

    // Clear weak references to help GC
    this.cleanupWeakReferences()

    // Emergency cache cleanup
    this.performCacheCleanup()

    // If still critical, consider process restart warning
    const newStats = this.getCurrentMemoryStats()
    const newUsage = (newStats.heapUsed / newStats.heapTotal) * 100

    if (newUsage >= config.memoryThresholdCritical) {
      logger.error('EMERGENCY: Memory usage remains critical after cleanup', {
        beforeCleanup: `${Math.round(stats.heapUsed / 1024 / 1024)}MB`,
        afterCleanup: `${Math.round(newStats.heapUsed / 1024 / 1024)}MB`,
        usage: `${newUsage.toFixed(1)}%`,
        recommendation: 'Consider restarting the process',
      })
    }
  }

  /**
   * Handle warning level memory usage
   */
  private handleWarningMemory(_stats: MemoryStats): void {
    // Suggest garbage collection (but don't force it)
    if (globalThis.gc && Date.now() - this.lastGCTime > 60000) {
      logger.debug('Triggering garbage collection due to memory warning')
      this.performGarbageCollection()
    }
  }

  /**
   * Perform garbage collection with monitoring
   */
  private performGarbageCollection(): void {
    if (!globalThis.gc) {
      logger.debug('Garbage collection not available (run with --expose-gc)')
      return
    }

    const beforeStats = this.getCurrentMemoryStats()
    const startTime = Date.now()

    try {
      globalThis.gc()
      this.gcCount++
      this.lastGCTime = Date.now()

      const afterStats = this.getCurrentMemoryStats()
      const gcTime = Date.now() - startTime
      const freedMemory = beforeStats.heapUsed - afterStats.heapUsed

      logger.debug('Garbage collection completed', {
        duration: `${gcTime}ms`,
        freedMemory: `${Math.round(freedMemory / 1024 / 1024)}MB`,
        heapBefore: `${Math.round(beforeStats.heapUsed / 1024 / 1024)}MB`,
        heapAfter: `${Math.round(afterStats.heapUsed / 1024 / 1024)}MB`,
        gcCount: this.gcCount,
      })
    }
    catch (error) {
      logger.error('Garbage collection failed:', error)
    }
  }

  /**
   * Force garbage collection (used in critical situations)
   */
  private forceGarbageCollection(): void {
    if (!globalThis.gc)
      return

    try {
      // Multiple GC cycles to ensure thorough cleanup
      globalThis.gc()
      globalThis.gc()
      logger.info('Forced garbage collection completed')
    }
    catch (error) {
      logger.error('Forced garbage collection failed:', error)
    }
  }

  /**
   * Detect potential memory leaks by analyzing trends
   */
  detectMemoryLeaks(): LeakDetection {
    if (this.memoryHistory.length < 10) {
      return { suspected: false, trend: 'stable', rate: 0 }
    }

    // Analyze last 10 measurements
    const recent = this.memoryHistory.slice(-10)
    const oldest = recent[0]
    const newest = recent[recent.length - 1]
    if (!oldest || !newest) {
      return { suspected: false, trend: 'stable', rate: 0 }
    }

    const timeDiffMinutes = (newest.timestamp - oldest.timestamp) / (1000 * 60)
    const heapDiffMB = (newest.heapUsed - oldest.heapUsed) / (1024 * 1024)
    const rate = heapDiffMB / timeDiffMinutes

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    let suspected = false
    const result: LeakDetection = { suspected: false, trend: 'stable', rate: Number.parseFloat(rate.toFixed(2)) }

    if (rate > 5) { // More than 5MB per minute increase
      trend = 'increasing'
      suspected = rate > 10 // More than 10MB per minute is suspicious

      if (suspected) {
        result.recommendation = 'Check for object retention, event listeners, or circular references'
      }
    }
    else if (rate < -2) {
      trend = 'decreasing'
    }

    result.suspected = suspected
    result.trend = trend

    return result
  }

  /**
   * Register an object for memory tracking
   */
  trackObject<T extends object>(obj: T, id: string): WeakRef<T> {
    const ref = new WeakRef(obj)
    this.weakRefs.add(ref)
    this.objectRegistry.register(obj, id)
    return ref
  }

  /**
   * Clean up weak references that have been garbage collected
   */
  private cleanupWeakReferences(): void {
    let cleanedCount = 0

    for (const ref of this.weakRefs) {
      if (ref.deref() === undefined) {
        this.weakRefs.delete(ref)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} weak references`)
    }
  }

  /**
   * Perform application-specific cache cleanup
   */
  private performCacheCleanup(): void {
    // This would integrate with the database and other caches
    logger.debug('Performing cache cleanup')

    // Clean up weak references
    this.cleanupWeakReferences()

    // Emit event for other modules to clean up their caches
    // eslint-disable-next-line ts/no-explicit-any
    process.emit('memory:cleanup' as any)
  }

  /**
   * Set up process warnings for memory-related issues
   */
  private setupProcessWarnings(): void {
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        logger.warn('Memory warning: Too many event listeners', {
          warning: warning.message,
          stack: warning.stack,
        })
      }
    })
  }

  /**
   * Get comprehensive memory report
   */
  getMemoryReport(): {
    current: MemoryStats
    level: MemoryLevel
    leak: LeakDetection
    gc: { count: number, lastTime: number }
    history: { avg: number, min: number, max: number }
  } {
    const current = this.getCurrentMemoryStats()
    const level = this.getMemoryLevel((current.heapUsed / current.heapTotal) * 100)
    const leak = this.detectMemoryLeaks()

    // Calculate history statistics
    const heapUsages = this.memoryHistory.map(s => s.heapUsed)
    const avg = heapUsages.length > 0 ? heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length : 0
    const min = Math.min(...heapUsages)
    const max = Math.max(...heapUsages)

    return {
      current,
      level,
      leak,
      gc: { count: this.gcCount, lastTime: this.lastGCTime },
      history: { avg, min, max },
    }
  }
}

// Singleton instance
export const memoryManager = new AdvancedMemoryManager()

// Clean up on process exit
process.on('beforeExit', () => {
  memoryManager.stop()
})
