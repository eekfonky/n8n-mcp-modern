/**
 * Memory Monitoring and Management System
 *
 * Specialized memory monitoring split from ResourceMonitor:
 * - Heap usage tracking and analysis
 * - Memory leak detection
 * - Garbage collection management
 * - Memory threshold monitoring
 * - Emergency memory cleanup
 */

import { EventEmitter } from 'node:events'
import { freemem, totalmem } from 'node:os'
import process from 'node:process'
import { logger } from '../server/logger.js'
import { managedClearTimer, managedSetInterval, managedSetTimeout } from './timer-manager.js'

export interface MemoryThresholds {
  warning: number // Percentage
  critical: number // Percentage
  emergency: number // Percentage
  heapWarning: number // Percentage
  heapCritical: number // Percentage
}

export interface MemoryMetrics {
  timestamp: Date
  system: {
    used: number
    free: number
    total: number
    percentage: number
  }
  heap: {
    used: number
    total: number
    percentage: number
  }
  process: {
    rss: number
    external: number
    arrayBuffers: number
  }
  gc: {
    lastRun: Date | null
    runCount: number
    totalTimeSaved: number
  }
}

export interface MemoryAlert {
  level: 'warning' | 'critical' | 'emergency'
  type: 'system' | 'heap' | 'leak'
  message: string
  metrics: MemoryMetrics
  suggestedActions: string[]
}

export class MemoryMonitor extends EventEmitter {
  private thresholds: MemoryThresholds = {
    warning: 70,
    critical: 85,
    emergency: 95,
    heapWarning: 80,
    heapCritical: 90,
  }

  private isMonitoring = false
  private monitoringInterval: string | undefined
  private lastMetrics?: MemoryMetrics
  private memoryHistory: MemoryMetrics[] = []
  private gcHistory: Array<{ timestamp: Date, memoryBefore: number, memoryAfter: number }> = []

  // GC management
  private lastGcTime = 0
  private readonly GC_COOLDOWN = 5000 // 5 seconds minimum between GC calls
  private readonly MAX_GC_PER_HOUR = 12 // Maximum 12 GC calls per hour
  private gcRunCount = 0

  constructor(customThresholds?: Partial<MemoryThresholds>) {
    super()
    if (customThresholds) {
      this.thresholds = { ...this.thresholds, ...customThresholds }
    }
  }

  /**
   * Start memory monitoring
   */
  async startMonitoring(interval = 10000): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Memory monitoring already running')
      return
    }

    this.isMonitoring = true
    logger.info('Starting memory monitoring', {
      interval,
      thresholds: this.thresholds,
      gcAvailable: !!global.gc,
    })

    // Initial metrics collection
    await this.collectMetrics()

    // Start periodic monitoring
    this.monitoringInterval = managedSetInterval(async () => {
      try {
        await this.collectMetrics()
        await this.analyzeMemory()
        this.detectMemoryLeaks()
      }
      catch (error) {
        logger.error('Memory monitoring failed:', error, 'memory-monitor:interval')
      }
    }, interval)
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      managedClearTimer(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    this.isMonitoring = false
    logger.info('Memory monitoring stopped')
  }

  /**
   * Collect current memory metrics
   */
  async collectMetrics(): Promise<MemoryMetrics> {
    const memUsage = process.memoryUsage()
    const systemTotal = totalmem()
    const systemFree = freemem()
    const systemUsed = systemTotal - systemFree

    const metrics: MemoryMetrics = {
      timestamp: new Date(),
      system: {
        used: systemUsed,
        free: systemFree,
        total: systemTotal,
        percentage: (systemUsed / systemTotal) * 100,
      },
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      process: {
        rss: memUsage.rss,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
      },
      gc: {
        lastRun: this.gcHistory.length > 0 ? this.gcHistory[this.gcHistory.length - 1]?.timestamp || null : null,
        runCount: this.gcRunCount,
        totalTimeSaved: this.calculateMemorySaved(),
      },
    }

    this.lastMetrics = metrics
    this.memoryHistory.push(metrics)

    // Keep only last 100 metrics (about 16 minutes at 10s intervals)
    if (this.memoryHistory.length > 100) {
      this.memoryHistory = this.memoryHistory.slice(-100)
    }

    this.emit('metricsCollected', metrics)
    return metrics
  }

  /**
   * Analyze memory usage and trigger alerts
   */
  private async analyzeMemory(): Promise<void> {
    if (!this.lastMetrics)
      return

    const metrics = this.lastMetrics
    const alerts: MemoryAlert[] = []

    // System memory analysis
    if (metrics.system.percentage >= this.thresholds.emergency) {
      alerts.push({
        level: 'emergency',
        type: 'system',
        message: `System memory usage critical: ${metrics.system.percentage.toFixed(1)}%`,
        metrics,
        suggestedActions: [
          'Emergency garbage collection',
          'Kill non-essential processes',
          'Consider system restart',
        ],
      })
      await this.emergencyMemoryCleanup()
    }
    else if (metrics.system.percentage >= this.thresholds.critical) {
      alerts.push({
        level: 'critical',
        type: 'system',
        message: `System memory usage critical: ${metrics.system.percentage.toFixed(1)}%`,
        metrics,
        suggestedActions: [
          'Force garbage collection',
          'Clear caches',
          'Reduce active processes',
        ],
      })
      await this.forceGarbageCollection()
    }
    else if (metrics.system.percentage >= this.thresholds.warning) {
      alerts.push({
        level: 'warning',
        type: 'system',
        message: `System memory usage high: ${metrics.system.percentage.toFixed(1)}%`,
        metrics,
        suggestedActions: [
          'Schedule garbage collection',
          'Monitor for leaks',
        ],
      })
      await this.scheduleGarbageCollection()
    }

    // Heap memory analysis
    if (metrics.heap.percentage >= this.thresholds.heapCritical) {
      alerts.push({
        level: 'critical',
        type: 'heap',
        message: `Heap memory usage critical: ${metrics.heap.percentage.toFixed(1)}%`,
        metrics,
        suggestedActions: [
          'Immediate garbage collection',
          'Clear large objects',
          'Investigate memory leaks',
        ],
      })
      await this.forceGarbageCollection()
    }
    else if (metrics.heap.percentage >= this.thresholds.heapWarning) {
      alerts.push({
        level: 'warning',
        type: 'heap',
        message: `Heap memory usage high: ${metrics.heap.percentage.toFixed(1)}%`,
        metrics,
        suggestedActions: [
          'Schedule garbage collection',
          'Monitor heap growth',
        ],
      })
    }

    // Emit alerts
    for (const alert of alerts) {
      logger.warn(`Memory alert: ${alert.message}`, {
        level: alert.level,
        type: alert.type,
        suggestions: alert.suggestedActions,
      })
      this.emit('memoryAlert', alert)
    }
  }

  /**
   * Detect potential memory leaks
   */
  private detectMemoryLeaks(): void {
    if (this.memoryHistory.length < 10)
      return // Need enough data

    const recent = this.memoryHistory.slice(-10)
    const heapGrowth = recent[recent.length - 1]!.heap.used - recent[0]!.heap.used
    const timeSpan = recent[recent.length - 1]!.timestamp.getTime() - recent[0]!.timestamp.getTime()

    // Check for consistent memory growth (potential leak)
    const growthRate = heapGrowth / timeSpan // bytes per millisecond
    const growthPerMinute = growthRate * 60 * 1000 // bytes per minute

    if (growthPerMinute > 10 * 1024 * 1024) { // More than 10MB growth per minute
      const alert: MemoryAlert = {
        level: 'warning',
        type: 'leak',
        message: `Potential memory leak detected: ${(growthPerMinute / 1024 / 1024).toFixed(1)}MB/min growth`,
        metrics: this.lastMetrics!,
        suggestedActions: [
          'Investigate object retention',
          'Check for event listener leaks',
          'Review timer cleanup',
          'Force garbage collection',
        ],
      }

      logger.warn('Memory leak detection triggered', {
        growthPerMinute: growthPerMinute / 1024 / 1024,
        timeSpan: timeSpan / 1000,
        heapGrowth: heapGrowth / 1024 / 1024,
      })

      this.emit('memoryAlert', alert)
      this.forceGarbageCollection()
    }
  }

  /**
   * Schedule garbage collection (rate-limited)
   */
  private async scheduleGarbageCollection(): Promise<void> {
    const now = Date.now()

    // Only run if enough time has passed
    if ((now - this.lastGcTime) < this.GC_COOLDOWN) {
      return
    }

    await this.performGarbageCollection()
  }

  /**
   * Force garbage collection (ignores some rate limits)
   */
  async forceGarbageCollection(): Promise<void> {
    await this.performGarbageCollection(true)
  }

  /**
   * Emergency memory cleanup
   */
  private async emergencyMemoryCleanup(): Promise<void> {
    logger.error('Performing emergency memory cleanup')

    try {
      // Multiple aggressive GC cycles
      if (global.gc) {
        for (let i = 0; i < 5; i++) {
          global.gc()
          await new Promise<void>(resolve => managedSetTimeout(() => resolve(), 200, 'memory-monitor:timer'))
        }
      }

      // Clear large data structures
      this.clearCaches()

      // Emit emergency signal for other systems to cleanup
      this.emit('emergencyCleanup', this.lastMetrics)
    }
    catch (error) {
      logger.error('Emergency memory cleanup failed:', error)
    }
  }

  /**
   * Perform garbage collection with safety checks
   */
  private async performGarbageCollection(force = false): Promise<boolean> {
    const now = Date.now()

    // Check cooldown period (unless forced)
    if (!force && (now - this.lastGcTime) < this.GC_COOLDOWN) {
      logger.debug('GC request ignored - cooldown active')
      return false
    }

    // Check rate limiting (unless forced)
    if (!force) {
      const hourAgo = now - (60 * 60 * 1000)
      const recentGcCount = this.gcHistory.filter(entry => entry.timestamp.getTime() > hourAgo).length

      if (recentGcCount >= this.MAX_GC_PER_HOUR) {
        logger.warn('GC request ignored - rate limit exceeded')
        return false
      }
    }

    if (!global.gc) {
      logger.warn('Manual garbage collection not available - start with --expose-gc flag')
      return false
    }

    const memoryBefore = process.memoryUsage().heapUsed

    logger.info('Triggering garbage collection', {
      forced: force,
      memoryBefore: Math.round(memoryBefore / 1024 / 1024),
      lastGc: this.lastGcTime ? new Date(this.lastGcTime).toISOString() : 'never',
    })

    this.lastGcTime = now
    global.gc()
    this.gcRunCount++

    // Measure improvement
    managedSetTimeout(() => {
      const memoryAfter = process.memoryUsage().heapUsed
      const improvement = memoryBefore - memoryAfter
      const improvementMB = Math.round(improvement / 1024 / 1024)

      this.gcHistory.push({
        timestamp: new Date(now),
        memoryBefore,
        memoryAfter,
      })

      // Keep only recent GC history
      const hourAgo = now - (60 * 60 * 1000)
      this.gcHistory = this.gcHistory.filter(entry => entry.timestamp.getTime() > hourAgo)

      logger.info('Garbage collection completed', {
        memoryBefore: Math.round(memoryBefore / 1024 / 1024),
        memoryAfter: Math.round(memoryAfter / 1024 / 1024),
        improvementMB,
        improvementPercent: Math.round((improvement / memoryBefore) * 100),
      })

      this.emit('garbageCollected', {
        timestamp: now,
        memoryBefore,
        memoryAfter,
        improvement,
      })
    }, 100)

    return true
  }

  /**
   * Clear internal caches and large objects
   */
  private clearCaches(): void {
    // Clear memory history (keep only last 10 entries)
    this.memoryHistory = this.memoryHistory.slice(-10)

    // Clear old GC history
    const hourAgo = Date.now() - (60 * 60 * 1000)
    this.gcHistory = this.gcHistory.filter(entry => entry.timestamp.getTime() > hourAgo)

    logger.debug('Internal caches cleared')
  }

  /**
   * Calculate total memory saved by GC
   */
  private calculateMemorySaved(): number {
    return this.gcHistory.reduce((total, entry) => {
      return total + (entry.memoryBefore - entry.memoryAfter)
    }, 0)
  }

  /**
   * Get current memory metrics
   */
  getCurrentMetrics(): MemoryMetrics | null {
    return this.lastMetrics || null
  }

  /**
   * Get memory history
   */
  getMemoryHistory(count = 50): MemoryMetrics[] {
    return this.memoryHistory.slice(-count)
  }

  /**
   * Get garbage collection history
   */
  getGCHistory(): Array<{ timestamp: Date, memoryBefore: number, memoryAfter: number }> {
    return [...this.gcHistory]
  }

  /**
   * Get memory status summary
   */
  getStatus(): {
    isMonitoring: boolean
    currentMetrics: MemoryMetrics | null
    thresholds: MemoryThresholds
    gcStats: {
      available: boolean
      runCount: number
      lastRun: Date | null
      totalSaved: number
    }
  } {
    return {
      isMonitoring: this.isMonitoring,
      currentMetrics: this.lastMetrics || null,
      thresholds: this.thresholds,
      gcStats: {
        available: !!global.gc,
        runCount: this.gcRunCount,
        lastRun: this.gcHistory.length > 0 ? this.gcHistory[this.gcHistory.length - 1]?.timestamp || null : null,
        totalSaved: this.calculateMemorySaved(),
      },
    }
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds }
    logger.info('Memory thresholds updated', this.thresholds)
  }
}
