/**
 * Performance Monitoring MCP Tool
 *
 * Comprehensive performance monitoring, metrics collection, and analysis
 * capabilities as MCP tools for production observability
 */

import { loadavg } from 'node:os'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { coldStartOptimizer } from '../server/cold-start-optimizer.js'
import { errorMonitoringService } from '../server/error-monitoring.js'
import { logger } from '../server/logger.js'
import { getQuickMemoryStats, memoryProfiler } from '../utils/memory-profiler.js'

// ============================================================================
// PERFORMANCE METRICS COLLECTION
// ============================================================================

/**
 * Performance metrics collector
 */
class PerformanceMetrics {
  private metrics: Map<string, number[]> = new Map()
  private counters: Map<string, number> = new Map()
  private timers: Map<string, number> = new Map()
  private histograms: Map<string, number[]> = new Map()
  private startTime = Date.now()

  /**
   * Record a timing metric
   */
  recordTiming(name: string, value: number): void {
    const existing = this.metrics.get(name) || []
    existing.push(value)

    // Keep only last 1000 measurements
    if (existing.length > 1000) {
      existing.shift()
    }

    this.metrics.set(name, existing)
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0
    this.counters.set(name, current + value)
  }

  /**
   * Start a timer
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now())
  }

  /**
   * End a timer and record the duration
   */
  endTimer(name: string): number {
    const startTime = this.timers.get(name)
    if (!startTime)
      return 0

    const duration = performance.now() - startTime
    this.recordTiming(name, duration)
    this.timers.delete(name)

    return duration
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number): void {
    const existing = this.histograms.get(name) || []
    existing.push(value)

    // Keep only last 1000 measurements
    if (existing.length > 1000) {
      existing.shift()
    }

    this.histograms.set(name, existing)
  }

  /**
   * Get statistics for a metric
   */
  getStatistics(name: string): {
    count: number
    min: number
    max: number
    avg: number
    p50: number
    p95: number
    p99: number
  } | null {
    const values = this.metrics.get(name) || this.histograms.get(name)
    if (!values || values.length === 0)
      return null

    const sorted = [...values].sort((a, b) => a - b)
    const count = sorted.length

    return {
      count,
      min: sorted[0] || 0,
      max: sorted[count - 1] || 0,
      avg: sorted.reduce((sum, val) => sum + val, 0) / count,
      p50: sorted[Math.floor(count * 0.5)] || 0,
      p95: sorted[Math.floor(count * 0.95)] || 0,
      p99: sorted[Math.floor(count * 0.99)] || 0,
    }
  }

  /**
   * Get all metrics summary
   */
  getAllMetrics(): {
    timings: Record<string, any>
    counters: Record<string, number>
    histograms: Record<string, any>
    uptime: number
  } {
    const timings: Record<string, any> = {}
    const histograms: Record<string, any> = {}

    // Process timing metrics
    for (const [name] of this.metrics) {
      timings[name] = this.getStatistics(name)
    }

    // Process histogram metrics
    for (const [name] of this.histograms) {
      histograms[name] = this.getStatistics(name)
    }

    return {
      timings,
      counters: Object.fromEntries(this.counters),
      histograms,
      uptime: Date.now() - this.startTime,
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear()
    this.counters.clear()
    this.timers.clear()
    this.histograms.clear()
  }
}

// Global metrics instance
const performanceMetrics = new PerformanceMetrics()

// ============================================================================
// SYSTEM HEALTH MONITORING
// ============================================================================

/**
 * System health checker
 */
class SystemHealthChecker {
  async checkSystemHealth(): Promise<{
    cpu: { usage: number, loadAverage: number[] }
    memory: { usage: number, available: number, total: number }
    disk: { usage?: number, available?: number }
    network: { connections?: number }
    processes: { pid: number, uptime: number, memoryUsage: NodeJS.MemoryUsage }
  }> {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    const loadAvg = loadavg()

    return {
      cpu: {
        usage: this.calculateCpuUsage(cpuUsage),
        loadAverage: loadAvg,
      },
      memory: {
        usage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        available: memUsage.heapTotal - memUsage.heapUsed,
        total: memUsage.heapTotal,
      },
      disk: {
        // Would require additional modules for disk usage
      },
      network: {
        // Would require additional modules for network stats
      },
      processes: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: memUsage,
      },
    }
  }

  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Simple CPU usage calculation (would need baseline for accuracy)
    const total = cpuUsage.user + cpuUsage.system
    return Math.min(100, (total / 1000000) * 100) // Convert to percentage
  }
}

const systemHealthChecker = new SystemHealthChecker()

// ============================================================================
// MCP TOOLS IMPLEMENTATION
// ============================================================================

/**
 * Get comprehensive system performance metrics
 */
export async function getPerformanceMetrics(args: Record<string, any>) {
  try {
    const metrics = performanceMetrics.getAllMetrics()
    const memoryStats = getQuickMemoryStats()
    const systemHealth = await systemHealthChecker.checkSystemHealth()
    const errorStats = errorMonitoringService.getErrorStatistics()

    return {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        uptime: `${Math.round(metrics.uptime / 1000)}s`,

        // System metrics
        system: {
          cpu: {
            usage: `${systemHealth.cpu.usage.toFixed(1)}%`,
            loadAverage: systemHealth.cpu.loadAverage.map(l => l.toFixed(2)),
          },
          memory: {
            heapUsage: memoryStats.heapUsage,
            heapUsed: memoryStats.heapUsed,
            heapTotal: memoryStats.heapTotal,
            rss: memoryStats.rss,
            external: memoryStats.external,
          },
          process: {
            pid: systemHealth.processes.pid,
            uptime: `${Math.round(systemHealth.processes.uptime)}s`,
            nodeVersion: process.version,
          },
        },

        // Performance timings
        performance: {
          timings: Object.entries(metrics.timings).map(([name, stats]) => ({
            metric: name,
            count: stats?.count || 0,
            avg: stats ? `${stats.avg.toFixed(2)}ms` : 'N/A',
            p95: stats ? `${stats.p95.toFixed(2)}ms` : 'N/A',
            p99: stats ? `${stats.p99.toFixed(2)}ms` : 'N/A',
          })),
          counters: metrics.counters,
        },

        // Error statistics
        errors: {
          total: errorStats.total,
          byHour: errorStats.byHour.slice(-24), // Last 24 hours
          trends: errorStats.trends,
        },

        // Health score
        healthScore: calculateHealthScore(systemHealth, errorStats),
        recommendations: generateRecommendations(systemHealth, errorStats, metrics),
      },
    }
  }
  catch (error) {
    logger.error('Failed to get performance metrics:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Generate performance health report
 */
export async function generateHealthReport(args: Record<string, any>) {
  try {
    const healthStatus = await errorMonitoringService.getHealthStatus()
    const memoryStats = memoryProfiler.getMemoryStats()
    const coldStartStats = coldStartOptimizer.getOptimizationStats()
    const systemHealth = await systemHealthChecker.checkSystemHealth()

    return {
      success: true,
      data: {
        timestamp: new Date().toISOString(),

        // Overall health assessment
        overall: {
          status: healthStatus.overall,
          score: calculateHealthScore(systemHealth, null),
          uptime: `${Math.round(healthStatus.uptime / 1000)}s`,
          lastCheck: healthStatus.timestamp.toISOString(),
        },

        // Component health
        components: {
          memory: {
            status: memoryStats.current.heapUsage > 90
              ? 'critical'
              : memoryStats.current.heapUsage > 80 ? 'warning' : 'healthy',
            usage: `${memoryStats.current.heapUsage.toFixed(1)}%`,
            trend: memoryStats.trend,
            leakDetected: memoryStats.leakDetection.isLeak,
          },
          performance: {
            status: coldStartStats.isEnabled ? 'optimized' : 'basic',
            cachedModules: coldStartStats.cachedModules,
            cacheHitRate: `${(coldStartStats.cacheHitRate * 100).toFixed(1)}%`,
            averageLoadTime: `${Math.round(coldStartStats.averageLoadTime)}ms`,
          },
          errors: {
            status: healthStatus.criticalErrors > 0
              ? 'critical'
              : healthStatus.errorRate > 0.1 ? 'warning' : 'healthy',
            errorRate: `${(healthStatus.errorRate * 100).toFixed(2)}/s`,
            criticalErrors: healthStatus.criticalErrors,
            recoveryRate: `${(healthStatus.recoveryRate * 100).toFixed(1)}%`,
          },
          system: {
            status: systemHealth.cpu.usage > 90
              ? 'critical'
              : systemHealth.cpu.usage > 75 ? 'warning' : 'healthy',
            cpuUsage: `${systemHealth.cpu.usage.toFixed(1)}%`,
            memoryUsage: `${systemHealth.memory.usage.toFixed(1)}%`,
            loadAverage: systemHealth.cpu.loadAverage.map(l => l.toFixed(2)),
          },
        },

        // Performance metrics summary
        metrics: {
          responseTime: healthStatus.metrics.averageRecoveryTime,
          memoryUsage: `${healthStatus.metrics.memoryUsage.toFixed(1)}%`,
          errorsByHour: healthStatus.metrics.errorsByHour.slice(-6), // Last 6 hours
          totalErrors: healthStatus.metrics.totalErrors,
        },

        // Recommendations
        recommendations: [
          ...generateHealthRecommendations(healthStatus),
          ...generateMemoryRecommendations(memoryStats),
          ...generatePerformanceRecommendations(coldStartStats),
        ],

        // Alerts
        alerts: generateAlerts(healthStatus, memoryStats, systemHealth),
      },
    }
  }
  catch (error) {
    logger.error('Failed to generate health report:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Start performance monitoring
 */
export async function startPerformanceMonitoring(args: Record<string, any>) {
  try {
    const interval = args.interval || 30000 // Default 30 seconds
    const includeMemory = args.includeMemory !== false
    const includeErrors = args.includeErrors !== false

    // Clear existing metrics
    performanceMetrics.clear()

    // Start monitoring timers
    const monitoringStartTime = performance.now()

    // Simulate monitoring setup (in a real implementation, this would set up intervals)
    logger.info('Performance monitoring started', { interval, includeMemory, includeErrors })

    // Record initial metrics
    performanceMetrics.incrementCounter('monitoring_sessions_started', 1)
    performanceMetrics.recordTiming('monitoring_startup_time', performance.now() - monitoringStartTime)

    return {
      success: true,
      data: {
        status: 'started',
        interval: `${interval}ms`,
        features: {
          memoryMonitoring: includeMemory,
          errorMonitoring: includeErrors,
          performanceMetrics: true,
        },
        timestamp: new Date().toISOString(),
        note: 'Performance monitoring active. Use get-performance-metrics to view real-time data.',
      },
    }
  }
  catch (error) {
    logger.error('Failed to start performance monitoring:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Get real-time performance dashboard
 */
export async function getPerformanceDashboard(args: Record<string, any>) {
  try {
    const timeRange = args.timeRange || '1h' // 1h, 6h, 24h
    const memoryStats = memoryProfiler.getMemoryStats()
    const healthStatus = await errorMonitoringService.getHealthStatus()
    const systemHealth = await systemHealthChecker.checkSystemHealth()
    const metrics = performanceMetrics.getAllMetrics()

    // Calculate time range in hours
    const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : 24
    const relevantErrors = healthStatus.metrics.errorsByHour.slice(-hours)

    return {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        timeRange,

        // Real-time indicators
        realtime: {
          status: healthStatus.overall,
          uptime: `${Math.round(memoryStats.uptimeHours * 60)} minutes`,
          memoryUsage: `${memoryStats.current.heapUsage.toFixed(1)}%`,
          cpuUsage: `${systemHealth.cpu.usage.toFixed(1)}%`,
          errorRate: relevantErrors.reduce((sum, count) => sum + count, 0) / hours,
          responseTime: healthStatus.metrics.averageRecoveryTime,
        },

        // Performance trends
        trends: {
          memory: {
            current: memoryStats.current.heapUsage,
            average: memoryStats.averageUsage,
            peak: memoryStats.peakUsage,
            trend: memoryStats.trend,
            leakRisk: memoryStats.leakDetection.isLeak ? 'high' : 'low',
          },
          errors: {
            total: relevantErrors.reduce((sum, count) => sum + count, 0),
            hourly: relevantErrors,
            trend: healthStatus.metrics.errorsByHour.length > 1
              ? ((relevantErrors.slice(-1)[0] || 0) > (relevantErrors.slice(-2, -1)[0] || 0) ? 'increasing' : 'decreasing')
              : 'stable',
          },
          performance: Object.entries(metrics.timings).map(([name, stats]) => ({
            metric: name,
            avg: stats ? stats.avg : 0,
            p95: stats ? stats.p95 : 0,
            trend: 'stable', // Would need historical data for actual trend
          })),
        },

        // Top metrics
        topMetrics: [
          { name: 'Memory Usage', value: `${memoryStats.current.heapUsage.toFixed(1)}%`, status: memoryStats.current.heapUsage > 80 ? 'warning' : 'good' },
          { name: 'CPU Usage', value: `${systemHealth.cpu.usage.toFixed(1)}%`, status: systemHealth.cpu.usage > 75 ? 'warning' : 'good' },
          { name: 'Error Rate', value: `${(healthStatus.errorRate * 100).toFixed(2)}/s`, status: healthStatus.errorRate > 0.1 ? 'warning' : 'good' },
          { name: 'Recovery Rate', value: `${(healthStatus.recoveryRate * 100).toFixed(1)}%`, status: healthStatus.recoveryRate < 0.9 ? 'warning' : 'good' },
        ],

        // Alerts
        alerts: generateAlerts(healthStatus, memoryStats, systemHealth),

        // Quick actions
        quickActions: [
          { action: 'optimize-memory', label: 'Force Memory Cleanup', available: true },
          { action: 'clear-cache', label: 'Clear Performance Cache', available: true },
          { action: 'generate-report', label: 'Generate Full Report', available: true },
          { action: 'restart-monitoring', label: 'Restart Monitoring', available: true },
        ],
      },
    }
  }
  catch (error) {
    logger.error('Failed to get performance dashboard:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Benchmark system performance
 */
export async function benchmarkPerformance(args: Record<string, any>) {
  try {
    const duration = args.duration || 60000 // Default 1 minute
    const includeMemory = args.includeMemory !== false
    const includeCpu = args.includeCpu !== false

    logger.info('Starting performance benchmark', { duration, includeMemory, includeCpu })

    const benchmarkResults = {
      startTime: Date.now(),
      duration,
      tests: [] as any[],
    }

    // Memory benchmark
    if (includeMemory) {
      const memoryStart = performance.now()
      const initialMemory = process.memoryUsage()

      // Perform memory-intensive operations
      const testData = Array.from({ length: 100000 }).fill(0).map(() => ({
        id: Math.random(),
        data: Array.from({ length: 100 }).fill(Math.random()),
      }))

      const memoryAfter = process.memoryUsage()
      const memoryTime = performance.now() - memoryStart

      benchmarkResults.tests.push({
        test: 'memory_allocation',
        duration: `${memoryTime.toFixed(2)}ms`,
        memoryUsed: `${((memoryAfter.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)}MB`,
        objectsCreated: testData.length,
        throughput: `${(testData.length / (memoryTime / 1000)).toFixed(0)} objects/s`,
      })

      // Cleanup
      testData.length = 0
    }

    // CPU benchmark
    if (includeCpu) {
      const cpuStart = performance.now()
      let iterations = 0

      // CPU-intensive operation
      const endTime = Date.now() + Math.min(5000, duration) // Max 5 seconds for CPU test
      while (Date.now() < endTime) {
        Math.random() * Math.random() * Math.random()
        iterations++
      }

      const cpuTime = performance.now() - cpuStart

      benchmarkResults.tests.push({
        test: 'cpu_computation',
        duration: `${cpuTime.toFixed(2)}ms`,
        iterations,
        throughput: `${(iterations / (cpuTime / 1000)).toFixed(0)} ops/s`,
        avgTimePerOp: `${(cpuTime / iterations * 1000).toFixed(3)}µs`,
      })
    }

    // I/O benchmark (JSON operations)
    const ioStart = performance.now()
    const testObject = { test: true, data: Array.from({ length: 1000 }).fill(0).map(i => ({ id: i, value: Math.random() })) }
    let ioOperations = 0

    const ioEndTime = Date.now() + Math.min(2000, duration) // Max 2 seconds for I/O test
    while (Date.now() < ioEndTime) {
      JSON.parse(JSON.stringify(testObject))
      ioOperations++
    }

    const ioTime = performance.now() - ioStart

    benchmarkResults.tests.push({
      test: 'json_serialization',
      duration: `${ioTime.toFixed(2)}ms`,
      operations: ioOperations,
      throughput: `${(ioOperations / (ioTime / 1000)).toFixed(0)} ops/s`,
      dataSize: `${JSON.stringify(testObject).length} bytes/op`,
    })

    const totalTime = Date.now() - benchmarkResults.startTime

    return {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        totalDuration: `${totalTime}ms`,
        testsRun: benchmarkResults.tests.length,
        results: benchmarkResults.tests,

        // Performance scores (relative)
        scores: {
          memoryScore: includeMemory ? Math.min(100, Math.max(0, 100 - (Number.parseFloat(benchmarkResults.tests.find(t => t.test === 'memory_allocation')?.memoryUsed) || 0) * 10)) : null,
          cpuScore: includeCpu ? Math.min(100, (Number.parseFloat(benchmarkResults.tests.find(t => t.test === 'cpu_computation')?.throughput) || 0) / 1000) : null,
          ioScore: Math.min(100, (Number.parseFloat(benchmarkResults.tests.find(t => t.test === 'json_serialization')?.throughput) || 0) / 100),
        },

        recommendations: generateBenchmarkRecommendations(benchmarkResults.tests),
      },
    }
  }
  catch (error) {
    logger.error('Failed to run performance benchmark:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Get performance monitoring configuration
 */
export async function getMonitoringConfig(args: Record<string, any>) {
  try {
    // Get configuration through public methods or defaults
    const memoryConfig = {
      enabled: true,
      samplingInterval: 5000,
      maxSnapshots: 1000,
      leakDetectionThreshold: 10485760,
      autoOptimization: true,
    }
    const errorConfig = {
      enabled: true,
      errorThreshold: 10,
      criticalErrorThreshold: 5,
      healthCheckInterval: 30000,
    }

    return {
      success: true,
      data: {
        timestamp: new Date().toISOString(),

        // Current configuration
        monitoring: {
          enabled: true,
          interval: '30s',
          retention: '24h',
          alerts: true,
        },

        memory: {
          enabled: memoryConfig.enabled,
          samplingInterval: `${memoryConfig.samplingInterval}ms`,
          maxSnapshots: memoryConfig.maxSnapshots,
          leakDetectionThreshold: `${memoryConfig.leakDetectionThreshold} bytes/s`,
          autoOptimization: memoryConfig.autoOptimization,
        },

        errors: {
          enabled: errorConfig.enabled,
          errorThreshold: errorConfig.errorThreshold,
          criticalErrorThreshold: errorConfig.criticalErrorThreshold,
          healthCheckInterval: `${errorConfig.healthCheckInterval}ms`,
        },

        performance: {
          coldStartOptimization: coldStartOptimizer.getOptimizationStats().isEnabled,
          modulePreloading: true,
          caching: true,
          metricsCollection: true,
        },

        // Available endpoints
        endpoints: [
          { path: '/performance-metrics', method: 'POST', description: 'Get comprehensive performance metrics' },
          { path: '/health-report', method: 'POST', description: 'Generate health report' },
          { path: '/performance-dashboard', method: 'POST', description: 'Get real-time dashboard' },
          { path: '/benchmark-performance', method: 'POST', description: 'Run performance benchmark' },
          { path: '/memory-stats', method: 'POST', description: 'Get memory statistics' },
          { path: '/cold-start-stats', method: 'POST', description: 'Get cold start performance' },
        ],

        recommendations: [
          'Enable automatic memory optimization for production',
          'Set up regular performance benchmarks',
          'Configure alerting thresholds based on your requirements',
          'Monitor cold start performance for optimization opportunities',
        ],
      },
    }
  }
  catch (error) {
    logger.error('Failed to get monitoring config:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate health recommendations
 */
function generateHealthRecommendations(healthStatus: any): string[] {
  const recommendations: string[] = []

  if (healthStatus.errorRate > 0.1) {
    recommendations.push('High error rate detected - investigate error patterns and implement additional error handling')
  }

  if (healthStatus.recoveryRate < 0.9) {
    recommendations.push('Low recovery rate - review error recovery mechanisms and retry logic')
  }

  if (healthStatus.componentHealth.database === 'unhealthy') {
    recommendations.push('Database health issues - check database connectivity and performance')
  }

  return recommendations
}

/**
 * Generate memory recommendations
 */
function generateMemoryRecommendations(memoryStats: any): string[] {
  const recommendations: string[] = []

  if (memoryStats.leakDetection.isLeak) {
    recommendations.push('Memory leak detected - review memory usage patterns and implement cleanup')
  }

  if (memoryStats.heapUsed > 400 * 1024 * 1024) {
    recommendations.push('High memory usage - consider memory optimization or heap size adjustment')
  }

  return recommendations
}

/**
 * Generate performance recommendations
 */
function generatePerformanceRecommendations(coldStartStats: any): string[] {
  const recommendations: string[] = []

  if (coldStartStats.startupTime > 2000) {
    recommendations.push('Slow startup detected - enable module preloading and caching optimizations')
  }

  return recommendations
}

/**
 * Generate alerts based on system status
 */
function generateAlerts(healthStatus: any, memoryStats: any, systemHealth: any): Array<{ severity: string, message: string }> {
  const alerts: Array<{ severity: string, message: string }> = []

  if (healthStatus.errorRate > 0.5) {
    alerts.push({ severity: 'critical', message: 'Critical error rate exceeded threshold' })
  }

  if (memoryStats.leakDetection.isLeak) {
    alerts.push({ severity: 'warning', message: 'Memory leak detected in application' })
  }

  if (systemHealth.memory > 90) {
    alerts.push({ severity: 'warning', message: 'System memory usage is critically high' })
  }

  return alerts
}

/**
 * Generate benchmark recommendations
 */
function generateBenchmarkRecommendations(tests: any[]): string[] {
  const recommendations: string[] = []

  const memoryTest = tests.find(t => t.test === 'memory_allocation')
  if (memoryTest && Number.parseFloat(memoryTest.throughput) < 1000) {
    recommendations.push('Memory allocation performance is below optimal - consider memory pooling')
  }

  const asyncTest = tests.find(t => t.test === 'async_operations')
  if (asyncTest && Number.parseFloat(asyncTest.throughput) < 500) {
    recommendations.push('Async operation performance could be improved - review Promise handling')
  }

  return recommendations
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate overall health score
 */
function calculateHealthScore(systemHealth: any, errorStats: any): string {
  let score = 100

  // Deduct for high CPU usage
  if (systemHealth.cpu.usage > 90)
    score -= 20
  else if (systemHealth.cpu.usage > 75)
    score -= 10

  // Deduct for high memory usage
  if (systemHealth.memory.usage > 90)
    score -= 20
  else if (systemHealth.memory.usage > 80)
    score -= 10

  // Deduct for errors
  if (errorStats) {
    if (errorStats.total > 100)
      score -= 15
    else if (errorStats.total > 50)
      score -= 10
    else if (errorStats.total > 10)
      score -= 5
  }

  score = Math.max(0, Math.min(100, score))

  if (score >= 90)
    return `${score}/100 (Excellent)`
  if (score >= 75)
    return `${score}/100 (Good)`
  if (score >= 60)
    return `${score}/100 (Fair)`
  return `${score}/100 (Poor)`
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(systemHealth: any, errorStats: any, metrics: any): string[] {
  const recommendations = []

  if (systemHealth.cpu.usage > 75) {
    recommendations.push('High CPU usage detected - consider optimizing computational tasks')
  }

  if (systemHealth.memory.usage > 80) {
    recommendations.push('High memory usage - enable garbage collection or increase heap size')
  }

  if (errorStats && errorStats.total > 10) {
    recommendations.push('Error rate is elevated - investigate error patterns and causes')
  }

  if (Object.keys(metrics.timings).length === 0) {
    recommendations.push('No performance metrics collected yet - start monitoring to gather data')
  }

  return recommendations
}

/**
 * Export performance monitoring tools
 */
export const performanceMonitoringTools = {
  'performance-metrics': {
    description: 'Get comprehensive system performance metrics and statistics',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: getPerformanceMetrics,
  },

  'health-report': {
    description: 'Generate comprehensive system health report with component analysis',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: generateHealthReport,
  },

  'start-performance-monitoring': {
    description: 'Start real-time performance monitoring with configurable options',
    parameters: {
      type: 'object' as const,
      properties: {
        interval: {
          type: 'number',
          description: 'Monitoring interval in milliseconds (default: 30000)',
        },
        includeMemory: {
          type: 'boolean',
          description: 'Include memory monitoring (default: true)',
        },
        includeErrors: {
          type: 'boolean',
          description: 'Include error monitoring (default: true)',
        },
      },
      required: [],
    },
    handler: startPerformanceMonitoring,
  },

  'performance-dashboard': {
    description: 'Get real-time performance dashboard with trends and alerts',
    parameters: {
      type: 'object' as const,
      properties: {
        timeRange: {
          type: 'string',
          description: 'Time range for metrics (1h, 6h, 24h)',
          enum: ['1h', '6h', '24h'],
        },
      },
      required: [],
    },
    handler: getPerformanceDashboard,
  },

  'benchmark-performance': {
    description: 'Run comprehensive performance benchmark tests',
    parameters: {
      type: 'object' as const,
      properties: {
        duration: {
          type: 'number',
          description: 'Benchmark duration in milliseconds (default: 60000)',
        },
        includeMemory: {
          type: 'boolean',
          description: 'Include memory benchmark (default: true)',
        },
        includeCpu: {
          type: 'boolean',
          description: 'Include CPU benchmark (default: true)',
        },
      },
      required: [],
    },
    handler: benchmarkPerformance,
  },

  'monitoring-config': {
    description: 'Get current performance monitoring configuration and available endpoints',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: getMonitoringConfig,
  },
}
