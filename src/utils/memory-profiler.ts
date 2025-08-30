/**
 * Memory Profiling and Optimization System
 *
 * Advanced memory monitoring, leak detection, and optimization analysis
 * for production performance and reliability
 */

import { createError } from '../server/enhanced-error-handler.js'
import { logger } from '../server/logger.js'

// ============================================================================
// MEMORY PROFILING TYPES
// ============================================================================

/**
 * Memory usage snapshot
 */
export interface MemorySnapshot {
  timestamp: Date
  heapUsed: number
  heapTotal: number
  external: number
  arrayBuffers: number
  rss: number
  heapUsage: number // Percentage
  gcCount?: number
  gcTime?: number
}

/**
 * Memory leak detection result
 */
export interface LeakDetectionResult {
  isLeak: boolean
  confidence: number // 0-1
  trend: 'increasing' | 'decreasing' | 'stable'
  growthRate: number // bytes per second
  recommendations: string[]
  snapshots: MemorySnapshot[]
}

/**
 * Memory optimization recommendations
 */
export interface OptimizationReport {
  timestamp: Date
  overallScore: number // 0-100
  issues: {
    type: 'memory_leak' | 'high_usage' | 'gc_pressure' | 'heap_fragmentation'
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    recommendation: string
    impact: number // 0-10
  }[]
  metrics: {
    currentMemoryUsage: number
    averageMemoryUsage: number
    peakMemoryUsage: number
    gcEfficiency: number
    memoryStability: number
  }
  suggestions: string[]
}

/**
 * Memory profiler configuration
 */
export interface ProfilerConfig {
  enabled: boolean
  samplingInterval: number // milliseconds
  maxSnapshots: number
  leakDetectionThreshold: number // growth rate in bytes/second
  highUsageThreshold: number // percentage
  gcMonitoring: boolean
  autoOptimization: boolean
  alertThreshold: number // percentage for alerts
}

// ============================================================================
// MEMORY PROFILER CLASS
// ============================================================================

/**
 * Comprehensive memory profiling and optimization system
 */
export class MemoryProfiler {
  private snapshots: MemorySnapshot[] = []
  private profilerTimer: NodeJS.Timeout | undefined = undefined
  private gcObserver?: any
  private startTime = Date.now()
  private config: ProfilerConfig
  private lastGcStats = { count: 0, time: 0 }
  private isRunning = false

  constructor(config: Partial<ProfilerConfig> = {}) {
    this.config = {
      enabled: true,
      samplingInterval: 10000, // 10 seconds
      maxSnapshots: 288, // 48 hours at 10s intervals
      leakDetectionThreshold: 1024, // 1KB/s growth
      highUsageThreshold: 80, // 80% heap usage
      gcMonitoring: true,
      autoOptimization: false,
      alertThreshold: 90, // 90% heap usage
      ...config,
    }

    if (this.config.enabled) {
      this.initialize()
    }
  }

  /**
   * Initialize memory profiler
   */
  private initialize(): void {
    // Setup GC monitoring if available and enabled
    if (this.config.gcMonitoring) {
      this.setupGCMonitoring()
    }

    // Take initial snapshot
    this.takeSnapshot()

    // Start profiling timer
    this.start()
  }

  /**
   * Setup GC (Garbage Collection) monitoring
   */
  private setupGCMonitoring(): void {
    try {
      // Try to setup performance hooks for GC monitoring (Node.js 8.5+)
      const { PerformanceObserver, constants } = require('node:perf_hooks')

      if (constants && constants.NODE_PERFORMANCE_GC_MAJOR) {
        this.gcObserver = new PerformanceObserver((list: any) => {
          const entries = list.getEntries()
          for (const entry of entries) {
            this.lastGcStats.count++
            this.lastGcStats.time += entry.duration
          }
        })

        this.gcObserver.observe({ entryTypes: ['gc'] })
        logger.debug('GC monitoring enabled')
      }
      else {
        logger.debug('GC monitoring not available in this Node.js version')
      }
    }
    catch (error) {
      logger.warn('Failed to setup GC monitoring:', error)
    }
  }

  /**
   * Start memory profiling
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Memory profiler already running')
      return
    }

    this.isRunning = true
    this.profilerTimer = setInterval(() => {
      this.takeSnapshot()
      this.analyzeMemory()
    }, this.config.samplingInterval)

    logger.info('Memory profiler started', {
      samplingInterval: this.config.samplingInterval,
      gcMonitoring: this.config.gcMonitoring,
    })
  }

  /**
   * Stop memory profiling
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.profilerTimer) {
      clearInterval(this.profilerTimer)
    }
    this.profilerTimer = undefined

    if (this.gcObserver) {
      try {
        this.gcObserver.disconnect()
        this.gcObserver = undefined
      }
      catch (error) {
        logger.warn('Error disconnecting GC observer:', error)
      }
    }

    logger.info('Memory profiler stopped')
  }

  /**
   * Take a memory usage snapshot
   */
  private takeSnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage()

    const snapshot: MemorySnapshot = {
      timestamp: new Date(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
      rss: memUsage.rss,
      heapUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      gcCount: this.lastGcStats.count,
      gcTime: this.lastGcStats.time,
    }

    // Add to snapshots array
    this.snapshots.push(snapshot)

    // Trim old snapshots
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift()
    }

    return snapshot
  }

  /**
   * Analyze memory usage patterns and detect issues
   */
  private analyzeMemory(): void {
    if (this.snapshots.length < 2)
      return

    const current = this.snapshots[this.snapshots.length - 1]
    if (!current)
      return

    // Check for high memory usage
    if (current.heapUsage > this.config.alertThreshold) {
      logger.warn('High memory usage detected', {
        heapUsage: `${current.heapUsage.toFixed(2)}%`,
        heapUsed: this.formatBytes(current.heapUsed),
        heapTotal: this.formatBytes(current.heapTotal),
      })
    }

    // Check for potential memory leaks
    const leakResult = this.detectMemoryLeaks()
    if (leakResult.isLeak && leakResult.confidence > 0.7) {
      logger.error('Potential memory leak detected', {
        confidence: `${(leakResult.confidence * 100).toFixed(1)}%`,
        growthRate: `${this.formatBytes(leakResult.growthRate)}/s`,
        trend: leakResult.trend,
        recommendations: leakResult.recommendations,
      })
    }

    // Auto-optimization if enabled
    if (this.config.autoOptimization && current.heapUsage > this.config.highUsageThreshold) {
      this.runOptimization()
    }
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(): LeakDetectionResult {
    if (this.snapshots.length < 10) {
      return {
        isLeak: false,
        confidence: 0,
        trend: 'stable',
        growthRate: 0,
        recommendations: [],
        snapshots: this.snapshots.slice(),
      }
    }

    // Use linear regression to detect memory growth trend
    const recentSnapshots = this.snapshots.slice(-20) // Last 20 samples
    const { slope, r2 } = this.calculateLinearRegression(
      recentSnapshots.map((s, i) => ({ x: i, y: s.heapUsed })),
    )

    // Convert slope from bytes per sample to bytes per second
    const growthRate = (slope * 1000) / this.config.samplingInterval

    const confidence = Math.min(r2 * 2, 1) // R² confidence, capped at 1
    const isLeak = growthRate > this.config.leakDetectionThreshold && confidence > 0.5

    const trend = slope > 50000 ? 'increasing' // 50KB per sample
      : slope < -50000 ? 'decreasing' : 'stable'

    const recommendations = this.generateLeakRecommendations(growthRate, trend, confidence)

    return {
      isLeak,
      confidence,
      trend,
      growthRate,
      recommendations,
      snapshots: recentSnapshots,
    }
  }

  /**
   * Generate comprehensive optimization report
   */
  generateOptimizationReport(): OptimizationReport {
    if (this.snapshots.length === 0) {
      throw createError.performance('No memory snapshots available for analysis')
    }

    const current = this.snapshots[this.snapshots.length - 1]
    if (!current) {
      throw createError.performance('No current memory snapshot available')
    }

    const recentSnapshots = this.snapshots.slice(-50) // Last 50 samples

    // Calculate metrics
    const heapUsages = recentSnapshots.map(s => s.heapUsed)
    const averageMemoryUsage = heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length
    const peakMemoryUsage = Math.max(...heapUsages)

    // GC efficiency calculation
    const gcEfficiency = this.calculateGCEfficiency()
    const memoryStability = this.calculateMemoryStability(recentSnapshots)

    // Detect issues
    const issues = this.detectMemoryIssues(current, recentSnapshots)

    // Calculate overall score
    const overallScore = this.calculateOverallScore(current, issues, gcEfficiency, memoryStability)

    // Generate suggestions
    const suggestions = this.generateOptimizationSuggestions(issues, current)

    return {
      timestamp: new Date(),
      overallScore,
      issues,
      metrics: {
        currentMemoryUsage: current.heapUsage,
        averageMemoryUsage: (averageMemoryUsage / current.heapTotal) * 100,
        peakMemoryUsage: (peakMemoryUsage / current.heapTotal) * 100,
        gcEfficiency,
        memoryStability,
      },
      suggestions,
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): {
    current: MemorySnapshot
    trend: 'increasing' | 'decreasing' | 'stable'
    averageUsage: number
    peakUsage: number
    uptimeHours: number
    snapshotCount: number
    leakDetection: LeakDetectionResult
  } {
    if (this.snapshots.length === 0) {
      throw createError.performance('No memory snapshots available')
    }

    const current = this.snapshots[this.snapshots.length - 1]
    if (!current) {
      throw createError.performance('No memory snapshots available')
    }

    const leakDetection = this.detectMemoryLeaks()

    const heapUsages = this.snapshots.map(s => s.heapUsed)
    const averageUsage = heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length
    const peakUsage = Math.max(...heapUsages)

    const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60)

    return {
      current,
      trend: leakDetection.trend,
      averageUsage: (averageUsage / current.heapTotal) * 100,
      peakUsage: (peakUsage / current.heapTotal) * 100,
      uptimeHours,
      snapshotCount: this.snapshots.length,
      leakDetection,
    }
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): boolean {
    try {
      if (global.gc) {
        const beforeGC = process.memoryUsage().heapUsed
        global.gc()
        const afterGC = process.memoryUsage().heapUsed
        const freed = beforeGC - afterGC

        logger.info('Manual garbage collection completed', {
          freedMemory: this.formatBytes(freed),
          beforeGC: this.formatBytes(beforeGC),
          afterGC: this.formatBytes(afterGC),
        })

        return true
      }
      else {
        logger.warn('Manual GC not available. Run node with --expose-gc flag.')
        return false
      }
    }
    catch (error) {
      logger.error('Failed to force garbage collection:', error)
      return false
    }
  }

  /**
   * Run memory optimization procedures
   */
  private runOptimization(): void {
    logger.info('Running automatic memory optimization...')

    // Use setImmediate to prevent event loop blocking
    setImmediate(() => {
      // Force GC if available
      const gcResult = this.forceGC()

      // Clear any cached data that might be holding references
      this.optimizeCaches()

      // Take snapshot after optimization (delay to allow GC to complete)
      setTimeout(() => {
        const after = this.takeSnapshot()
        logger.info('Memory optimization completed', {
          gcForced: gcResult,
          currentUsage: `${after.heapUsage.toFixed(2)}%`,
          heapUsed: this.formatBytes(after.heapUsed),
        })
      }, 1000)
    })
  }

  /**
   * Optimize internal caches and references
   */
  private optimizeCaches(): void {
    // Clear old snapshots beyond minimum required
    const minSnapshots = 50
    if (this.snapshots.length > minSnapshots * 2) {
      const toRemove = this.snapshots.length - minSnapshots
      this.snapshots.splice(0, toRemove)
      logger.debug(`Cleared ${toRemove} old memory snapshots`)
    }
  }

  /**
   * Calculate linear regression for trend analysis
   */
  private calculateLinearRegression(points: { x: number, y: number }[]): { slope: number, r2: number } {
    const n = points.length
    const sumX = points.reduce((sum, p) => sum + p.x, 0)
    const sumY = points.reduce((sum, p) => sum + p.y, 0)
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0)
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0)
    const sumYY = points.reduce((sum, p) => sum + p.y * p.y, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Calculate R² (coefficient of determination)
    const meanY = sumY / n
    const ssRes = points.reduce((sum, p) => {
      const predicted = slope * p.x + intercept
      return sum + (p.y - predicted) ** 2
    }, 0)
    const ssTot = points.reduce((sum, p) => sum + (p.y - meanY) ** 2, 0)
    const r2 = 1 - (ssRes / ssTot)

    return { slope, r2: Math.max(0, r2) }
  }

  /**
   * Generate memory leak recommendations
   */
  private generateLeakRecommendations(growthRate: number, trend: string, confidence: number): string[] {
    const recommendations: string[] = []

    if (growthRate > this.config.leakDetectionThreshold) {
      recommendations.push(
        `Memory growing at ${this.formatBytes(growthRate)}/s - investigate object retention`,
      )
    }

    if (confidence > 0.8) {
      recommendations.push('High confidence leak detected - review recent code changes')
      recommendations.push('Use heap snapshots to identify growing object types')
      recommendations.push('Check for unclosed resources (files, connections, timers)')
    }

    if (trend === 'increasing') {
      recommendations.push('Consider implementing object pooling for frequently created objects')
      recommendations.push('Review event listener cleanup and callback management')
    }

    return recommendations
  }

  /**
   * Calculate GC efficiency
   */
  private calculateGCEfficiency(): number {
    if (this.snapshots.length < 10 || !this.config.gcMonitoring) {
      return 85 // Default reasonable efficiency
    }

    // Simplified GC efficiency based on heap usage stability
    const recentUsages = this.snapshots.slice(-10).map(s => s.heapUsage)
    const variance = this.calculateVariance(recentUsages)

    // Lower variance indicates better GC efficiency
    const efficiency = Math.max(0, Math.min(100, 100 - variance * 2))
    return efficiency
  }

  /**
   * Calculate memory stability score
   */
  private calculateMemoryStability(snapshots: MemorySnapshot[]): number {
    if (snapshots.length < 5)
      return 50

    const usages = snapshots.map(s => s.heapUsage)
    const variance = this.calculateVariance(usages)

    // Lower variance = higher stability
    const stability = Math.max(0, Math.min(100, 100 - variance))
    return stability
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length
    const variance = numbers.reduce((sum, num) => sum + (num - mean) ** 2, 0) / numbers.length
    return Math.sqrt(variance)
  }

  /**
   * Detect specific memory issues
   */
  private detectMemoryIssues(current: MemorySnapshot, recent: MemorySnapshot[]): OptimizationReport['issues'] {
    const issues: OptimizationReport['issues'] = []

    // High memory usage
    if (current.heapUsage > this.config.highUsageThreshold) {
      issues.push({
        type: 'high_usage',
        severity: current.heapUsage > 95 ? 'critical' : current.heapUsage > 85 ? 'high' : 'medium',
        description: `Heap usage at ${current.heapUsage.toFixed(1)}%`,
        recommendation: 'Consider optimizing memory-intensive operations or increasing heap size',
        impact: Math.min(10, (current.heapUsage - 50) / 5),
      })
    }

    // Memory leak detection
    const leakResult = this.detectMemoryLeaks()
    if (leakResult.isLeak) {
      issues.push({
        type: 'memory_leak',
        severity: leakResult.confidence > 0.8 ? 'critical' : 'high',
        description: `Potential memory leak detected (${(leakResult.confidence * 100).toFixed(1)}% confidence)`,
        recommendation: 'Investigate object retention and ensure proper cleanup',
        impact: Math.min(10, leakResult.confidence * 8 + 2),
      })
    }

    // GC pressure
    if (recent.length > 5) {
      const gcFrequency = this.lastGcStats.count / (recent.length * this.config.samplingInterval / 1000)
      if (gcFrequency > 2) { // More than 2 GC cycles per second
        issues.push({
          type: 'gc_pressure',
          severity: gcFrequency > 5 ? 'high' : 'medium',
          description: `High GC frequency (${gcFrequency.toFixed(1)} cycles/sec)`,
          recommendation: 'Reduce object allocation rate and improve memory efficiency',
          impact: Math.min(10, gcFrequency - 1),
        })
      }
    }

    return issues
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(
    current: MemorySnapshot,
    issues: OptimizationReport['issues'],
    gcEfficiency: number,
    memoryStability: number,
  ): number {
    let score = 100

    // Deduct points for issues
    const totalImpact = issues.reduce((sum, issue) => sum + issue.impact, 0)
    score -= totalImpact * 2

    // Factor in current usage
    if (current.heapUsage > 80) {
      score -= (current.heapUsage - 80) * 2
    }

    // Factor in GC efficiency and stability
    score = (score + gcEfficiency + memoryStability) / 3

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(issues: OptimizationReport['issues'], current: MemorySnapshot): string[] {
    const suggestions: string[] = []

    if (issues.some(i => i.type === 'high_usage')) {
      suggestions.push('Enable --max-old-space-size flag to increase heap size if needed')
      suggestions.push('Implement object pooling for frequently created/destroyed objects')
      suggestions.push('Use streaming for large data processing instead of loading everything into memory')
    }

    if (issues.some(i => i.type === 'memory_leak')) {
      suggestions.push('Run with --inspect flag and use Chrome DevTools for heap analysis')
      suggestions.push('Implement WeakMap/WeakSet for caching scenarios to prevent memory leaks')
      suggestions.push('Review async operations for proper cleanup on error/completion')
    }

    if (issues.some(i => i.type === 'gc_pressure')) {
      suggestions.push('Reduce object creation in hot code paths')
      suggestions.push('Use buffer pools for network/file I/O operations')
      suggestions.push('Consider using --optimize-for-size flag for smaller objects')
    }

    if (current.external > current.heapUsed) {
      suggestions.push('High external memory usage detected - review native addon usage')
    }

    return suggestions
  }

  /**
   * Format bytes in human-readable format
   */
  formatBytes(bytes: number): string {
    if (bytes === 0)
      return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global memory profiler instance
 */
export const memoryProfiler = new MemoryProfiler()

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick memory usage check
 */
export function getQuickMemoryStats(): {
  heapUsed: string
  heapTotal: string
  heapUsage: string
  rss: string
  external: string
} {
  const mem = process.memoryUsage()
  const heapUsage = ((mem.heapUsed / mem.heapTotal) * 100).toFixed(1)

  return {
    heapUsed: memoryProfiler.formatBytes(mem.heapUsed),
    heapTotal: memoryProfiler.formatBytes(mem.heapTotal),
    heapUsage: `${heapUsage}%`,
    rss: memoryProfiler.formatBytes(mem.rss),
    external: memoryProfiler.formatBytes(mem.external),
  }
}

/**
 * Setup memory monitoring hooks
 */
export function setupMemoryMonitoring(): void {
  // Monitor uncaught exceptions that might cause memory leaks
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception - potential memory leak source:', error)
  })

  // Monitor unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection - potential memory leak source:', { reason, promise })
  })

  // Log memory stats on exit
  process.on('exit', () => {
    try {
      const stats = getQuickMemoryStats()
      logger.info('Final memory stats', stats)
    }
    catch (error) {
      // Ignore errors during exit
    }
  })

  logger.info('Memory monitoring hooks installed')
}
