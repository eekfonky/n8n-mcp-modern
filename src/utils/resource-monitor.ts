/**
 * Clean Resource Coordination and Integration System
 *
 * Lightweight coordinator that integrates specialized monitors:
 * - Coordinates MemoryMonitor and SystemMonitor
 * - Provides unified resource status
 * - Handles cross-system cleanup coordination
 * - Emergency shutdown coordination
 * - Simplified interface for existing code
 */

import type { MemoryAlert, MemoryMetrics } from './memory-monitor.js'
import type { SystemAlert, SystemMetrics } from './system-monitor.js'
import { EventEmitter } from 'node:events'
import { logger } from '../server/logger.js'
import { MemoryMonitor } from './memory-monitor.js'
import { getProcessManager } from './process-manager.js'
import { SystemMonitor } from './system-monitor.js'
import { getTimerManager } from './timer-manager.js'

export interface UnifiedResourceMetrics {
  timestamp: Date
  memory: MemoryMetrics
  system: SystemMetrics
  timers: {
    total: number
    active: number
    intervals: number
  }
}

export interface ResourceCoordinatorStatus {
  isMonitoring: boolean
  emergencyMode: boolean
  lastMetrics: UnifiedResourceMetrics | null
  health: {
    overall: 'healthy' | 'warning' | 'critical' | 'emergency'
    memory: 'healthy' | 'warning' | 'critical' | 'emergency'
    system: 'healthy' | 'warning' | 'critical'
  }
}

export class ResourceMonitor extends EventEmitter {
  private memoryMonitor: MemoryMonitor
  private systemMonitor: SystemMonitor

  private isMonitoring = false
  private lastMetrics?: UnifiedResourceMetrics
  private emergencyMode = false

  constructor() {
    super()
    this.memoryMonitor = new MemoryMonitor()
    this.systemMonitor = new SystemMonitor()

    this.setupEventHandlers()
  }

  /**
   * Setup event handlers for specialized monitors
   */
  private setupEventHandlers(): void {
    // Memory alerts
    this.memoryMonitor.on('memoryAlert', (alert: MemoryAlert) => {
      this.handleMemoryAlert(alert)
    })

    this.memoryMonitor.on('emergencyCleanup', () => {
      this.triggerEmergencyMode('Memory emergency cleanup triggered')
    })

    // System alerts
    this.systemMonitor.on('systemAlert', (alert: SystemAlert) => {
      this.handleSystemAlert(alert)
    })

    // Metrics collection
    this.memoryMonitor.on('metricsCollected', () => {
      this.collectUnifiedMetrics()
    })

    this.systemMonitor.on('metricsCollected', () => {
      this.collectUnifiedMetrics()
    })
  }

  /**
   * Start resource monitoring
   */
  async startMonitoring(interval = 15000): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Resource monitoring already running')
      return
    }

    this.isMonitoring = true
    logger.info('Starting unified resource monitoring', { interval })

    // Start specialized monitors
    await Promise.all([
      this.memoryMonitor.startMonitoring(interval / 2), // Memory more frequent
      this.systemMonitor.startMonitoring(interval),
    ])

    // Initial unified metrics collection
    await this.collectUnifiedMetrics()
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false

    // Stop specialized monitors
    this.memoryMonitor.stopMonitoring()
    this.systemMonitor.stopMonitoring()

    logger.info('Unified resource monitoring stopped')
  }

  /**
   * Collect unified metrics from specialized monitors
   */
  private async collectUnifiedMetrics(): Promise<UnifiedResourceMetrics | null> {
    const memoryMetrics = this.memoryMonitor.getCurrentMetrics()
    const systemMetrics = this.systemMonitor.getCurrentMetrics()
    const timerManager = getTimerManager()
    const timerStats = timerManager.getStats()

    if (!memoryMetrics || !systemMetrics) {
      return null
    }

    const unifiedMetrics: UnifiedResourceMetrics = {
      timestamp: new Date(),
      memory: memoryMetrics,
      system: systemMetrics,
      timers: {
        total: timerStats.total,
        active: timerStats.active,
        intervals: timerStats.intervals,
      },
    }

    this.lastMetrics = unifiedMetrics
    this.emit('metricsCollected', unifiedMetrics)

    return unifiedMetrics
  }

  /**
   * Handle memory alerts from MemoryMonitor
   */
  private handleMemoryAlert(alert: MemoryAlert): void {
    logger.warn(`Memory alert: ${alert.message}`, {
      level: alert.level,
      type: alert.type,
      suggestions: alert.suggestedActions,
    })

    // Escalate to emergency mode if needed
    if (alert.level === 'emergency') {
      this.triggerEmergencyMode(alert.message)
    }

    this.emit('resourceAlert', alert)
  }

  /**
   * Handle system alerts from SystemMonitor
   */
  private handleSystemAlert(alert: SystemAlert): void {
    logger.warn(`System alert: ${alert.message}`, {
      level: alert.level,
      type: alert.type,
      suggestions: alert.suggestedActions,
    })

    // Escalate to emergency mode for critical system issues
    if (alert.level === 'critical' && (alert.type === 'cpu' || alert.type === 'load')) {
      this.triggerEmergencyMode(alert.message)
    }

    this.emit('resourceAlert', alert)
  }

  /**
   * Trigger emergency mode
   */
  private triggerEmergencyMode(reason: string): void {
    if (this.emergencyMode)
      return

    this.emergencyMode = true
    logger.error('EMERGENCY MODE ACTIVATED', { reason })

    // Emit emergency signal
    this.emit('emergencyMode', { reason, timestamp: new Date() })

    // Trigger emergency cleanup on specialized monitors
    this.performEmergencyCleanup()

    // Schedule emergency shutdown if things don't improve
    setTimeout(async () => {
      if (this.emergencyMode) {
        logger.error('Emergency shutdown - resources critically low')
        await this.emergencyShutdown()
      }
    }, 10000) // 10 seconds
  }

  /**
   * Perform emergency cleanup
   */
  private async performEmergencyCleanup(): Promise<void> {
    logger.warn('Performing coordinated emergency cleanup')

    try {
      // Emergency memory cleanup
      await this.memoryMonitor.forceGarbageCollection()

      // System cleanup
      await this.systemMonitor.forceCleanup()

      // Timer cleanup
      const timerManager = getTimerManager()
      timerManager.clearAllTimers()

      // Process cleanup
      const processManager = getProcessManager()
      await processManager.gracefulShutdown()

      this.emit('emergencyCleanupCompleted')
    }
    catch (error) {
      logger.error('Emergency cleanup failed:', error)
    }
  }

  /**
   * Emergency shutdown
   */
  async emergencyShutdown(): Promise<void> {
    logger.error('Initiating emergency shutdown')

    try {
      // Stop all monitoring
      await this.stopMonitoring()

      // Final cleanup
      await this.performEmergencyCleanup()

      // Emit shutdown signal
      this.emit('emergencyShutdown')

      // Exit process
      process.exit(1)
    }
    catch (error) {
      logger.error('Emergency shutdown failed:', error)
      process.exit(1)
    }
  }

  /**
   * Get current unified metrics
   */
  getCurrentMetrics(): UnifiedResourceMetrics | null {
    return this.lastMetrics || null
  }

  /**
   * Get status summary
   */
  getStatus(): ResourceCoordinatorStatus {
    const memoryStatus = this.memoryMonitor.getStatus()
    const systemStatus = this.systemMonitor.getStatus()

    // Determine overall health
    let overallHealth: 'healthy' | 'warning' | 'critical' | 'emergency' = 'healthy'
    let memoryHealth: 'healthy' | 'warning' | 'critical' | 'emergency' = 'healthy'
    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy'

    // Memory health assessment
    if (memoryStatus.currentMetrics) {
      const memPercent = memoryStatus.currentMetrics.system.percentage
      const heapPercent = memoryStatus.currentMetrics.heap.percentage

      if (memPercent >= 95 || heapPercent >= 95)
        memoryHealth = 'emergency'
      else if (memPercent >= 85 || heapPercent >= 90)
        memoryHealth = 'critical'
      else if (memPercent >= 70 || heapPercent >= 80)
        memoryHealth = 'warning'
    }

    // System health assessment
    if (systemStatus.health.cpu === 'critical'
      || systemStatus.health.load === 'critical'
      || systemStatus.health.processes === 'critical') {
      systemHealth = 'critical'
    }
    else if (systemStatus.health.cpu === 'warning'
      || systemStatus.health.load === 'warning'
      || systemStatus.health.processes === 'warning') {
      systemHealth = 'warning'
    }

    // Overall health is worst of all subsystems
    if (this.emergencyMode || memoryHealth === 'emergency') {
      overallHealth = 'emergency'
    }
    else if (memoryHealth === 'critical' || systemHealth === 'critical') {
      overallHealth = 'critical'
    }
    else if (memoryHealth === 'warning' || systemHealth === 'warning') {
      overallHealth = 'warning'
    }

    return {
      isMonitoring: this.isMonitoring,
      emergencyMode: this.emergencyMode,
      lastMetrics: this.lastMetrics || null,
      health: {
        overall: overallHealth,
        memory: memoryHealth,
        system: systemHealth,
      },
    }
  }

  /**
   * Force cleanup (legacy compatibility)
   */
  async forceCleanup(): Promise<void> {
    await this.performEmergencyCleanup()
  }

  /**
   * Get resource usage summary (legacy compatibility)
   */
  getResourceUsage(): {
    memory: { heapUsed: number, heapTotal: number, rss: number }
    cpu: { usage: number }
    processes: { active: number }
  } {
    const metrics = this.getCurrentMetrics()
    if (!metrics) {
      return {
        memory: { heapUsed: 0, heapTotal: 0, rss: 0 },
        cpu: { usage: 0 },
        processes: { active: 0 },
      }
    }

    return {
      memory: {
        heapUsed: metrics.memory.heap.used,
        heapTotal: metrics.memory.heap.total,
        rss: metrics.memory.process.rss,
      },
      cpu: {
        usage: metrics.system.cpu.usage,
      },
      processes: {
        active: metrics.system.processes.running,
      },
    }
  }
}

// Global resource monitor instance
let _resourceMonitor: ResourceMonitor | null = null

export function getResourceMonitor(): ResourceMonitor {
  if (!_resourceMonitor) {
    _resourceMonitor = new ResourceMonitor()
  }
  return _resourceMonitor
}
