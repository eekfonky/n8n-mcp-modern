/**
 * Production Readiness - Fail Hard Philosophy
 *
 * Provides production-grade monitoring with explicit failure reporting:
 * - Health checks and status monitoring
 * - Critical error detection and reporting
 * - NO graceful degradation - fails hard with clear error messages
 * - Configuration validation
 * - Performance monitoring
 */

import type { DiscoveryCache } from '../discovery/discovery-cache.js'
import type { N8nApiClient } from '../discovery/n8n-api-client.js'
import process from 'node:process'
import { mcpMonitor } from '../monitoring/mcp-performance-monitor.js'
import { createCleanObject } from '../utils/aggressive-memory-cleanup.js'
import { logger } from './logger.js'

export interface ProductionHealth {
  status: 'healthy' | 'warning' | 'critical'
  uptime: number
  issues: string[]
  criticalErrors: string[]
  shouldTerminate: boolean
}

export class ProductionReadiness {
  private startTime = Date.now()
  private healthCheckTimer: NodeJS.Timeout | null = null
  private criticalErrors: string[] = []

  constructor(
    private n8nClient?: N8nApiClient,
    private cache?: DiscoveryCache,
  ) {
    this.startHealthMonitoring()
    logger.info('Production readiness monitoring initialized - FAIL HARD MODE')
  }

  /**
   * Get comprehensive health status - FAIL HARD MODE
   */
  getHealthStatus(): ProductionHealth {
    const issues: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    let shouldTerminate = false

    // Check system health
    const monitorHealth = mcpMonitor.getHealthStatus()
    if (monitorHealth.status === 'critical') {
      status = 'critical'
      shouldTerminate = true
      issues.push(...monitorHealth.issues)
      this.criticalErrors.push(`CRITICAL SYSTEM HEALTH: ${monitorHealth.issues.join(', ')}`)
    }
    else if (monitorHealth.status === 'warning') {
      if (status === 'healthy')
        status = 'warning'
      issues.push(...monitorHealth.issues)
    }

    // Check n8n connectivity (if configured)
    if (this.n8nClient) {
      const stats = mcpMonitor.getStats()
      if (!stats.n8nConnectivity.isConnected && stats.n8nConnectivity.totalApiCalls > 0) {
        // Only critical if we were supposed to have connectivity
        status = 'critical'
        shouldTerminate = true
        const error = 'n8n API connectivity completely failed after initial connection'
        issues.push(error)
        this.criticalErrors.push(`CRITICAL N8N FAILURE: ${error}`)
      }
    }

    // Check cache health
    if (this.cache) {
      const cacheHealth = this.cache.getHealthStatus()
      if (cacheHealth.status === 'critical') {
        status = 'critical'
        shouldTerminate = true
        issues.push(...cacheHealth.issues)
        this.criticalErrors.push(`CRITICAL CACHE FAILURE: ${cacheHealth.issues.join(', ')}`)
      }
      else if (cacheHealth.status === 'warning') {
        if (status === 'healthy')
          status = 'warning'
        issues.push(...cacheHealth.issues)
      }
    }

    // Memory pressure check
    const stats = mcpMonitor.getStats()
    if (stats.memory.pressure === 'critical') {
      status = 'critical'
      shouldTerminate = true
      const error = `Critical memory pressure: ${stats.memory.currentUsageMB.toFixed(1)}MB`
      issues.push(error)
      this.criticalErrors.push(`CRITICAL MEMORY FAILURE: ${error}`)
    }

    return createCleanObject({
      status,
      uptime: Date.now() - this.startTime,
      issues,
      criticalErrors: [...this.criticalErrors],
      shouldTerminate,
    })
  }

  /**
   * Report critical failure and terminate
   */
  reportCriticalFailure(error: string, details?: unknown): never {
    this.criticalErrors.push(`CRITICAL FAILURE: ${error}`)

    logger.error('🚨 CRITICAL FAILURE - TERMINATING PROCESS', {
      error,
      details,
      uptime: Date.now() - this.startTime,
      criticalErrors: this.criticalErrors,
      systemStats: mcpMonitor.getPerformanceSummary(),
    })

    // Log all critical errors for debugging
    if (this.criticalErrors.length > 0) {
      logger.error('All critical errors encountered:', this.criticalErrors)
    }

    // Exit with error code
    process.exit(1)
  }

  /**
   * Check if system should terminate due to critical errors
   */
  checkCriticalFailure(): void {
    const health = this.getHealthStatus()

    if (health.shouldTerminate) {
      this.reportCriticalFailure(
        'System health critical - multiple failures detected',
        {
          issues: health.issues,
          criticalErrors: health.criticalErrors,
        },
      )
    }
  }

  /**
   * Start continuous health monitoring - FAIL HARD MODE
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck()
    }, 15000) // Every 15 seconds for faster failure detection

    // Initial health check
    this.performHealthCheck()
  }

  /**
   * Perform periodic health check - TERMINATE ON CRITICAL
   */
  private performHealthCheck(): void {
    const health = this.getHealthStatus()

    // FAIL HARD - terminate immediately on critical status
    if (health.status === 'critical') {
      this.reportCriticalFailure(
        'Critical health check failure detected',
        {
          issues: health.issues,
          criticalErrors: health.criticalErrors,
        },
      )
    }

    // Log warnings for monitoring
    if (health.status === 'warning') {
      logger.warn('Production health warning:', {
        status: health.status,
        issues: health.issues,
        uptime: `${Math.floor(health.uptime / 60000)}m`,
      })
    }

    // Log healthy status less frequently
    if (health.status === 'healthy' && Math.floor(health.uptime / 60000) % 5 === 0) {
      logger.info('Production health: OK', {
        uptime: `${Math.floor(health.uptime / 60000)}m`,
        performance: mcpMonitor.getPerformanceSummary(),
      })
    }
  }

  /**
   * Get production readiness score (0-100)
   */
  getReadinessScore(): number {
    const health = this.getHealthStatus()

    if (health.status === 'critical')
      return 0 // Will terminate anyway

    let score = 100

    // Deduct for each issue
    score -= health.issues.length * 15

    // Deduct for warnings
    if (health.status === 'warning')
      score -= 25

    // Deduct for critical errors (even if resolved)
    score -= this.criticalErrors.length * 10

    return Math.max(0, score)
  }

  /**
   * Validate configuration on startup
   */
  validateConfiguration(): void {
    logger.info('Validating production configuration...')

    // Check Node.js version
    const nodeVersion = process.versions.node
    const majorVersion = Number.parseInt(nodeVersion.split('.')[0] || '0')

    if (majorVersion < 22) {
      this.reportCriticalFailure(
        `Unsupported Node.js version: ${nodeVersion}. Requires Node.js >=22.0.0`,
        { currentVersion: nodeVersion, requiredVersion: '>=22.0.0' },
      )
    }

    // Check memory availability
    const totalMemory = process.memoryUsage()
    if (totalMemory.heapTotal < 50 * 1024 * 1024) { // 50MB minimum
      this.reportCriticalFailure(
        'Insufficient memory available',
        { availableMemory: `${Math.round(totalMemory.heapTotal / 1024 / 1024)}MB` },
      )
    }

    logger.info('Configuration validation passed')
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    logger.info('Production readiness monitoring destroyed')
  }
}

// Global production readiness instance - will be initialized with proper dependencies
let _productionReadiness: ProductionReadiness

export function getProductionReadiness(): ProductionReadiness {
  if (!_productionReadiness) {
    throw new Error('Production readiness not initialized')
  }
  return _productionReadiness
}

export function initializeProductionReadiness(
  n8nClient?: N8nApiClient,
  cache?: DiscoveryCache,
): ProductionReadiness {
  _productionReadiness = new ProductionReadiness(n8nClient, cache)

  // Run startup validation
  _productionReadiness.validateConfiguration()

  return _productionReadiness
}
