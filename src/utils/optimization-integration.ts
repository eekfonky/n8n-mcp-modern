/**
 * Optimization Integration Manager
 *
 * Coordinates all optimization systems and provides unified interface:
 * - Health monitoring integration
 * - Process lifecycle management
 * - Resource monitoring and cleanup
 * - Timer management
 * - Circuit breaker coordination
 * - Emergency response protocols
 */

import { EventEmitter } from 'node:events'
import { logger } from '../server/logger.js'
import { CircuitBreakerConfigs, getCircuitBreaker } from './circuit-breaker.js'
import { getHealthMonitor } from './health-monitor.js'
import { getProcessManager } from './process-manager.js'
import { getProductionManager } from './production-readiness.js'
import { getResourceMonitor } from './resource-monitor.js'
import { getTimerManager, managedClearTimer, managedSetInterval, managedSetTimeout } from './timer-manager.js'

export interface OptimizationStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'emergency'
  components: {
    health: 'healthy' | 'warning' | 'critical'
    resources: 'healthy' | 'warning' | 'critical' | 'emergency'
    processes: 'healthy' | 'warning' | 'critical'
    timers: 'healthy' | 'warning' | 'critical'
    circuitBreakers: 'healthy' | 'warning' | 'critical'
  }
  metrics: {
    uptime: number
    memoryUsage: number
    processCount: number
    timerCount: number
    openCircuits: number
  }
  recommendations: string[]
}

export class OptimizationIntegration extends EventEmitter {
  private isInitialized = false
  private statusCheckInterval: string | undefined = undefined
  private emergencyResponseActive = false

  constructor() {
    super()
  }

  /**
   * Initialize all optimization systems
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Optimization systems already initialized')
      return
    }

    logger.info('Initializing integrated optimization systems')

    try {
      // Initialize all managers (they're singletons)
      const healthMonitor = getHealthMonitor()
      const processManager = getProcessManager()
      const resourceMonitor = getResourceMonitor()
      const timerManager = getTimerManager()
      const productionManager = getProductionManager()

      // Initialize circuit breakers for critical operations
      getCircuitBreaker('n8n_api', CircuitBreakerConfigs.n8nApi)
      getCircuitBreaker('discovery', CircuitBreakerConfigs.discovery)
      getCircuitBreaker('database', CircuitBreakerConfigs.database)

      // Start monitoring systems
      await healthMonitor.startMonitoring()
      await resourceMonitor.startMonitoring()

      // Setup cross-system event handlers
      this.setupEventHandlers()

      // Start periodic status checks
      this.startStatusMonitoring()

      // Start production metrics collection
      managedSetInterval(async () => {
        try {
          await productionManager.collectMetrics()
        }
        catch (error) {
          logger.error('Production metrics collection failed:', error, 'optimization-integration:interval')
        }
      }, 60000) // Collect metrics every minute

      this.isInitialized = true
      logger.info('✅ All optimization systems initialized successfully')

      this.emit('initialized')
    }
    catch (error) {
      logger.error('Failed to initialize optimization systems:', error)
      throw error
    }
  }

  /**
   * Shutdown all optimization systems
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down optimization systems')

    try {
      // Stop status monitoring
      if (this.statusCheckInterval) {
        managedClearTimer(this.statusCheckInterval)
      }

      // Stop monitoring systems
      const healthMonitor = getHealthMonitor()
      const resourceMonitor = getResourceMonitor()

      healthMonitor.stopMonitoring()
      resourceMonitor.stopMonitoring()

      // Cleanup processes and timers
      const processManager = getProcessManager()
      const timerManager = getTimerManager()

      await processManager.gracefulShutdown()
      timerManager.clearAllTimers()

      this.isInitialized = false
      logger.info('✅ All optimization systems shutdown completed')

      this.emit('shutdown')
    }
    catch (error) {
      logger.error('Error during optimization systems shutdown:', error)
      throw error
    }
  }

  /**
   * Get comprehensive optimization status
   */
  async getStatus(): Promise<OptimizationStatus> {
    const healthMonitor = getHealthMonitor()
    const resourceMonitor = getResourceMonitor()
    const processManager = getProcessManager()
    const timerManager = getTimerManager()

    // Get component statuses
    const healthStatus = await healthMonitor.performHealthCheck()
    const resourceStatus = resourceMonitor.getStatus()
    const processStats = processManager.getStats()
    const timerStats = timerManager.getStats()

    // Get circuit breaker status
    const circuitBreakers = new Map([
      ['n8n_api', getCircuitBreaker('n8n_api', CircuitBreakerConfigs.n8nApi)],
      ['discovery', getCircuitBreaker('discovery', CircuitBreakerConfigs.discovery)],
      ['database', getCircuitBreaker('database', CircuitBreakerConfigs.database)],
    ])

    const openCircuits = Array.from(circuitBreakers.values())
      .filter(cb => cb.getMetrics().state === 'OPEN')
      .length

    // Determine component health levels
    const memoryPercentage = resourceStatus.lastMetrics?.memory.system.percentage ?? 0
    const components = {
      health: healthStatus.overall,
      resources: resourceStatus.emergencyMode
        ? 'emergency'
        : memoryPercentage >= 85
          ? 'critical'
          : memoryPercentage >= 70 ? 'warning' : 'healthy',
      processes: processStats.totalProcesses > 15
        ? 'critical'
        : processStats.totalProcesses > 10 ? 'warning' : 'healthy',
      timers: timerStats.total > 80
        ? 'critical'
        : timerStats.total > 50 ? 'warning' : 'healthy',
      circuitBreakers: openCircuits > 2
        ? 'critical'
        : openCircuits > 0 ? 'warning' : 'healthy',
    } as const

    // Determine overall status
    const overall = this.calculateOverallStatus(components)

    // Generate recommendations
    const recommendations = this.generateRecommendations(components, {
      memoryUsage: resourceStatus.lastMetrics?.memory.system.percentage || 0,
      processCount: processStats.totalProcesses,
      timerCount: timerStats.total,
      openCircuits,
    })

    const status: OptimizationStatus = {
      overall,
      components,
      metrics: {
        uptime: process.uptime(),
        memoryUsage: resourceStatus.lastMetrics?.memory.system.percentage || 0,
        processCount: processStats.totalProcesses,
        timerCount: timerStats.total,
        openCircuits,
      },
      recommendations,
    }

    this.emit('statusUpdated', status)
    return status
  }

  /**
   * Force emergency response protocol
   */
  async triggerEmergencyResponse(reason: string): Promise<void> {
    if (this.emergencyResponseActive) {
      logger.warn('Emergency response already active')
      return
    }

    this.emergencyResponseActive = true
    logger.error(`🚨 EMERGENCY RESPONSE TRIGGERED: ${reason}`)

    try {
      const resourceMonitor = getResourceMonitor()
      await resourceMonitor.forceCleanup()

      const processManager = getProcessManager()
      await processManager.killAllProcesses('SIGTERM')

      const timerManager = getTimerManager()
      timerManager.clearAllTimers()

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      logger.info('Emergency response completed')
      this.emit('emergencyResponse', { reason, success: true })

      // Reset emergency mode after 30 seconds
      managedSetTimeout(() => {
        this.emergencyResponseActive = false
        logger.info('Emergency response mode deactivated')
      }, 30000, 'optimization-integration:timer')
    }
    catch (error) {
      logger.error('Emergency response failed:', error)
      this.emit('emergencyResponse', { reason, success: false, error })
    }
  }

  /**
   * Setup cross-system event handlers
   */
  private setupEventHandlers(): void {
    const resourceMonitor = getResourceMonitor()
    const healthMonitor = getHealthMonitor()

    // Resource alerts
    resourceMonitor.on('resourceAlert', async (alert) => {
      logger.warn('Resource alert received', alert)

      if (alert.alerts.some((a: string) => a.includes('EMERGENCY'))) {
        await this.triggerEmergencyResponse('Resource exhaustion detected')
      }
    })

    // Monitor health status changes (HealthMonitor doesn't have events yet)
    // This would be added if HealthMonitor extends EventEmitter in the future

    // Process manager alerts
    const processManager = getProcessManager()
    processManager.on('processError', (processInfo, error) => {
      logger.error(`Process ${processInfo.id} failed:`, error)
    })

    // Timer manager alerts
    const timerManager = getTimerManager()
    timerManager.on('timerError', (timerInfo, error) => {
      logger.error(`Timer ${timerInfo.id} failed:`, error)
    })
  }

  /**
   * Start periodic status monitoring
   */
  private startStatusMonitoring(): void {
    this.statusCheckInterval = managedSetInterval(async () => {
      try {
        const status = await this.getStatus()

        if (status.overall === 'critical' || status.overall === 'emergency') {
          logger.warn('System status degraded', {
            overall: status.overall,
            components: status.components,
            metrics: status.metrics,
          }, 'optimization-integration:interval')
        }
      }
      catch (error) {
        logger.error('Status monitoring failed:', error)
      }
    }, 60000) // Check every minute
  }

  /**
   * Calculate overall system status with explicit return type
   */
  private calculateOverallStatus(components: OptimizationStatus['components']): 'healthy' | 'warning' | 'critical' | 'emergency' {
    const values = Object.values(components)

    if (values.includes('emergency'))
      return 'emergency'
    if (values.includes('critical'))
      return 'critical'
    if (values.includes('warning'))
      return 'warning'
    return 'healthy'
  }

  /**
   * Generate optimization recommendations with type safety
   */
  private generateRecommendations(
    components: OptimizationStatus['components'],
    metrics: { memoryUsage: number, processCount: number, timerCount: number, openCircuits: number },
  ): string[] {
    const recommendations: string[] = []

    if (metrics.memoryUsage > 85) {
      recommendations.push('High memory usage detected - consider restarting the server')
    }

    if (metrics.processCount > 10) {
      recommendations.push('High process count - review background operations')
    }

    if (metrics.timerCount > 50) {
      recommendations.push('High timer count - check for timer leaks')
    }

    if (metrics.openCircuits > 0) {
      recommendations.push('Circuit breakers are open - check external service health')
    }

    if (components.health !== 'healthy') {
      recommendations.push('System health issues detected - run diagnostics')
    }

    if (components.resources === 'emergency') {
      recommendations.push('CRITICAL: Resource exhaustion - immediate action required')
    }

    return recommendations
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    // This should be called after getting status, but for quick checks:
    const healthMonitor = getHealthMonitor()
    const resourceMonitor = getResourceMonitor()

    return healthMonitor.isHealthy()
      && !resourceMonitor.getStatus().emergencyMode
      && !this.emergencyResponseActive
  }
}

// Global optimization integration instance
let _optimizationIntegration: OptimizationIntegration | null = null

export function getOptimizationIntegration(): OptimizationIntegration {
  if (!_optimizationIntegration) {
    _optimizationIntegration = new OptimizationIntegration()
  }
  return _optimizationIntegration
}
