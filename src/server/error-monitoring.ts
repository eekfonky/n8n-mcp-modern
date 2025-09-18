/**
 * Error Monitoring and Health Check System
 *
 * Provides real-time monitoring, health checks, and error pattern analysis
 * for production reliability and observability
 */

import type { ErrorCode } from './enhanced-error-handler.js'
import process from 'node:process'
import { managedClearTimer, managedSetInterval } from '../utils/timer-manager.js'
import { EnhancedError, ErrorSeverity } from './enhanced-error-handler.js'
import { logger } from './logger.js'

// ============================================================================
// ERROR MONITORING TYPES
// ============================================================================

/**
 * Error pattern detection result
 */
export interface ErrorPattern {
  code: ErrorCode
  frequency: number
  severity: ErrorSeverity
  firstOccurrence: Date
  lastOccurrence: Date
  trend: 'increasing' | 'decreasing' | 'stable'
  correlatedErrors: ErrorCode[]
}

/**
 * System health status
 */
export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical'
  timestamp: Date
  uptime: number
  errorRate: number
  criticalErrors: number
  components: {
    database: 'healthy' | 'degraded' | 'failed'
    api: 'healthy' | 'degraded' | 'failed'
    discovery: 'healthy' | 'degraded' | 'failed'
    memory: 'healthy' | 'degraded' | 'critical'
  }
  metrics: {
    totalErrors: number
    errorsByHour: number[]
    memoryUsage: number
    cpuUsage?: number
  }
}

/**
 * Error monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean
  errorThreshold: number
  criticalErrorThreshold: number
  healthCheckInterval: number
  patternDetectionWindow: number
  alerting: {
    enabled: boolean
    webhookUrl?: string
    emailEnabled?: boolean
    slackEnabled?: boolean
  }
}

// ============================================================================
// ERROR MONITORING CLASS
// ============================================================================

/**
 * Comprehensive error monitoring and analysis system
 */
export class ErrorMonitoringService {
  private errorHistory: EnhancedError[] = []
  private startTime = Date.now()
  private healthHistory: HealthStatus[] = []
  private config: MonitoringConfig
  private healthCheckTimer: string | undefined = undefined
  private lastHealthCheck?: HealthStatus

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enabled: true,
      errorThreshold: 10, // errors per hour
      criticalErrorThreshold: 3, // critical errors per hour
      healthCheckInterval: 60000, // 1 minute
      patternDetectionWindow: 3600000, // 1 hour
      alerting: {
        enabled: false,
      },
      ...config,
    }

    if (this.config.enabled) {
      this.startHealthChecks()
    }
  }

  /**
   * Record error for monitoring analysis
   */
  recordError(error: EnhancedError): void {
    if (!this.config.enabled)
      return

    // Add to error history
    this.errorHistory.push(error)

    // Keep only recent errors (last 24 hours)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000
    this.errorHistory = this.errorHistory.filter(
      e => e.timestamp.getTime() > twentyFourHoursAgo,
    )

    // Detect critical patterns
    this.detectCriticalPatterns(error)

    logger.debug('Error recorded for monitoring', {
      errorId: error.errorId,
      code: error.code,
      severity: error.severity,
      totalErrors: this.errorHistory.length,
    })
  }

  /**
   * Get current system health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const now = new Date()
    const uptime = Date.now() - this.startTime
    const oneHourAgo = Date.now() - 3600000

    // Filter recent errors
    const recentErrors = this.errorHistory.filter(
      e => e.timestamp.getTime() > oneHourAgo,
    )

    const criticalErrors = recentErrors.filter(
      e => e.severity === ErrorSeverity.CRITICAL,
    ).length

    const errorRate = recentErrors.length / (3600000 / 1000) // errors per second

    // Component health checks
    const components = await this.checkComponentsHealth()

    // Memory metrics
    const memoryUsage = process.memoryUsage()
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100

    // Calculate error distribution by hour
    const errorsByHour = this.calculateErrorsByHour()

    const health: HealthStatus = {
      overall: this.calculateOverallHealth(errorRate, criticalErrors, components, memoryUsagePercent),
      timestamp: now,
      uptime,
      errorRate,
      criticalErrors,
      components,
      metrics: {
        totalErrors: this.errorHistory.length,
        errorsByHour,
        memoryUsage: memoryUsagePercent,
      },
    }

    this.lastHealthCheck = health
    this.healthHistory.push(health)

    // Keep only last 24 hours of health checks
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000
    this.healthHistory = this.healthHistory.filter(
      h => h.timestamp.getTime() > twentyFourHoursAgo,
    )

    return health
  }

  /**
   * Detect error patterns and trends
   */
  getErrorPatterns(): ErrorPattern[] {
    const patterns = new Map<ErrorCode, ErrorPattern>()
    const windowStart = Date.now() - this.config.patternDetectionWindow

    const relevantErrors = this.errorHistory.filter(
      e => e.timestamp.getTime() > windowStart,
    )

    // Group by error code
    for (const error of relevantErrors) {
      const existing = patterns.get(error.code)

      if (existing) {
        existing.frequency++
        existing.lastOccurrence = error.timestamp

        // Simple trend calculation
        const halfWindow = windowStart + (this.config.patternDetectionWindow / 2)
        const recentCount = relevantErrors.filter(
          e => e.code === error.code && e.timestamp.getTime() > halfWindow,
        ).length
        const olderCount = existing.frequency - recentCount

        existing.trend = recentCount > olderCount
          ? 'increasing'
          : recentCount < olderCount ? 'decreasing' : 'stable'
      }
      else {
        patterns.set(error.code, {
          code: error.code,
          frequency: 1,
          severity: error.severity,
          firstOccurrence: error.timestamp,
          lastOccurrence: error.timestamp,
          trend: 'stable',
          correlatedErrors: this.findCorrelatedErrors(error.code, relevantErrors),
        })
      }
    }

    return Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency) // Sort by frequency
  }

  /**
   * Get error statistics summary
   */
  getErrorStatistics(): {
    total: number
    bySeverity: Record<ErrorSeverity, number>
    byCode: Record<ErrorCode, number>
    byHour: number[]
    trends: {
      errorRate: 'increasing' | 'decreasing' | 'stable'
    }
  } {
    const bySeverity = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0,
    }

    const byCode: Record<ErrorCode, number> = {} as Record<ErrorCode, number>

    for (const error of this.errorHistory) {
      bySeverity[error.severity]++
      byCode[error.code] = (byCode[error.code] || 0) + 1
    }

    return {
      total: this.errorHistory.length,
      bySeverity,
      byCode,
      byHour: this.calculateErrorsByHour(),
      trends: this.calculateTrends(),
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      managedClearTimer(this.healthCheckTimer)
    }

    this.healthCheckTimer = managedSetInterval(async () => {
      try {
        await this.getHealthStatus()
      }
      catch (error) {
        logger.error('Health check failed', error)
      }
    }, this.config.healthCheckInterval, 'ErrorMonitor:health-check')
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    if (this.healthCheckTimer) {
      managedClearTimer(this.healthCheckTimer)
    }
    this.healthCheckTimer = undefined
  }

  /**
   * Check individual component health
   */
  private async checkComponentsHealth(): Promise<HealthStatus['components']> {
    return {
      database: await this.checkDatabaseHealth(),
      api: await this.checkApiHealth(),
      discovery: await this.checkDiscoveryHealth(),
      memory: this.checkMemoryHealth(),
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<'healthy' | 'degraded' | 'failed'> {
    try {
      // Simple database connectivity check
      // This would be implemented based on your database setup
      return 'healthy'
    }
    catch (error) {
      logger.error('Database health check failed', error)
      return 'failed'
    }
  }

  /**
   * Check API health
   */
  private async checkApiHealth(): Promise<'healthy' | 'degraded' | 'failed'> {
    const recentApiErrors = this.errorHistory.filter(
      e => e.code.toString().startsWith('ERR_12') // API errors
        && e.timestamp.getTime() > Date.now() - 300000, // Last 5 minutes
    ).length

    if (recentApiErrors === 0)
      return 'healthy'
    if (recentApiErrors < 5)
      return 'degraded'
    return 'failed'
  }

  /**
   * Check discovery service health
   */
  private async checkDiscoveryHealth(): Promise<'healthy' | 'degraded' | 'failed'> {
    const recentDiscoveryErrors = this.errorHistory.filter(
      e => e.code.toString().startsWith('ERR_13') // Discovery errors
        && e.timestamp.getTime() > Date.now() - 600000, // Last 10 minutes
    ).length

    if (recentDiscoveryErrors === 0)
      return 'healthy'
    if (recentDiscoveryErrors < 3)
      return 'degraded'
    return 'failed'
  }

  /**
   * Check memory health
   */
  private checkMemoryHealth(): 'healthy' | 'degraded' | 'critical' {
    const memoryUsage = process.memoryUsage()
    const usagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100

    if (usagePercent < 70)
      return 'healthy'
    if (usagePercent < 90)
      return 'degraded'
    return 'critical'
  }

  /**
   * Calculate overall system health
   */
  private calculateOverallHealth(
    errorRate: number,
    criticalErrors: number,
    components: HealthStatus['components'],
    memoryUsage: number,
  ): 'healthy' | 'degraded' | 'critical' {
    // Critical conditions
    if (criticalErrors >= this.config.criticalErrorThreshold
      || components.database === 'failed'
      || components.memory === 'critical') {
      return 'critical'
    }

    // Degraded conditions
    if (errorRate > this.config.errorThreshold
      || Object.values(components).some(status => status === 'degraded' || status === 'failed')
      || memoryUsage > 80) {
      return 'degraded'
    }

    return 'healthy'
  }

  /**
   * Calculate errors by hour for the last 24 hours
   */
  private calculateErrorsByHour(): number[] {
    const hours = Array.from({ length: 24 }, () => 0)
    const now = Date.now()

    for (const error of this.errorHistory) {
      const hoursAgo = Math.floor((now - error.timestamp.getTime()) / (60 * 60 * 1000))
      if (hoursAgo >= 0 && hoursAgo < 24) {
        const index = 23 - hoursAgo
        hours[index] = (hours[index] || 0) + 1
      }
    }

    return hours
  }

  /**
   * Calculate average recovery time
   */
  private calculateAverageRecoveryTime(): number {
    // With fail-fast approach, recovery time is zero (no retries)
    return 0
  }

  /**
   * Calculate error and recovery trends
   */
  private calculateTrends(): {
    errorRate: 'increasing' | 'decreasing' | 'stable'
  } {
    if (this.healthHistory.length < 2) {
      return { errorRate: 'stable' }
    }

    const recent = this.healthHistory.slice(-5) // Last 5 health checks
    const older = this.healthHistory.slice(-10, -5) // Previous 5 health checks

    const recentErrorRate = recent.reduce((sum, h) => sum + h.errorRate, 0) / recent.length
    const olderErrorRate = older.length > 0
      ? older.reduce((sum, h) => sum + h.errorRate, 0) / older.length
      : recentErrorRate

    return {
      errorRate: recentErrorRate > olderErrorRate * 1.1
        ? 'increasing'
        : recentErrorRate < olderErrorRate * 0.9 ? 'decreasing' : 'stable',
    }
  }

  /**
   * Find correlated errors (errors that often occur together)
   */
  private findCorrelatedErrors(targetCode: ErrorCode, errors: EnhancedError[]): ErrorCode[] {
    const timeWindow = 5 * 60 * 1000 // 5 minutes
    const correlatedCodes = new Map<ErrorCode, number>()

    const targetErrors = errors.filter(e => e.code === targetCode)

    for (const targetError of targetErrors) {
      const nearbyErrors = errors.filter(e =>
        e.code !== targetCode
        && Math.abs(e.timestamp.getTime() - targetError.timestamp.getTime()) < timeWindow,
      )

      for (const nearbyError of nearbyErrors) {
        correlatedCodes.set(
          nearbyError.code,
          (correlatedCodes.get(nearbyError.code) || 0) + 1,
        )
      }
    }

    // Return codes that appear with target error more than 20% of the time
    const threshold = Math.max(1, Math.floor(targetErrors.length * 0.2))
    return Array.from(correlatedCodes.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([code]) => code)
  }

  /**
   * Detect critical error patterns that require immediate attention
   */
  private detectCriticalPatterns(error: EnhancedError): void {
    // Critical error pattern: Multiple critical errors in short time
    if (error.severity === ErrorSeverity.CRITICAL) {
      const recentCritical = this.errorHistory.filter(e =>
        e.severity === ErrorSeverity.CRITICAL
        && Date.now() - e.timestamp.getTime() < 300000, // Last 5 minutes
      ).length

      if (recentCritical >= 3) {
        logger.error('CRITICAL PATTERN DETECTED: Multiple critical errors', {
          count: recentCritical,
          latestError: error.getErrorInfo(),
        })
      }
    }

    // Error burst pattern: Many errors in short time
    const recentErrors = this.errorHistory.filter(e =>
      Date.now() - e.timestamp.getTime() < 60000, // Last minute
    ).length

    if (recentErrors >= 10) {
      logger.warn('ERROR BURST DETECTED: High error frequency', {
        count: recentErrors,
        latestError: error.getErrorInfo(),
      })
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global error monitoring service instance
 */
export const errorMonitoringService = new ErrorMonitoringService()

// ============================================================================
// INTEGRATION HOOKS
// ============================================================================

/**
 * Hook to automatically record enhanced errors
 */
export function setupErrorMonitoring(): void {
  // Override console.error to capture all errors
  const originalConsoleError = console.error
  console.error = (...args: unknown[]): void => {
    // Call original console.error
    originalConsoleError.apply(console, args)

    // Try to extract enhanced error information
    const firstArg = args[0]
    if (firstArg instanceof EnhancedError) {
      errorMonitoringService.recordError(firstArg)
    }
  }

  logger.info('Error monitoring system initialized')
}
