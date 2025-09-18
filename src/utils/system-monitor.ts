/**
 * System Resource Monitoring (CPU, Processes, Disk)
 *
 * Focused system monitoring split from ResourceMonitor:
 * - CPU usage tracking and analysis
 * - Process monitoring and management
 * - Disk space monitoring
 * - System load analysis
 * - Resource threshold alerts
 */

import { exec } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { cpus, loadavg } from 'node:os'
import process from 'node:process'
import { promisify } from 'node:util'
import { logger } from '../server/logger.js'
import { managedClearTimer, managedSetInterval } from './timer-manager.js'

const execAsync = promisify(exec)

export interface SystemThresholds {
  cpu: {
    warning: number // Percentage
    critical: number // Percentage
  }
  load: {
    warning: number // Load average ratio to CPU cores
    critical: number // Load average ratio to CPU cores
  }
  processes: {
    max: number
    warning: number
  }
  disk: {
    warning: number // Percentage
    critical: number // Percentage
  }
}

export interface SystemMetrics {
  timestamp: Date
  cpu: {
    usage: number
    cores: number
    loadAverage: {
      one: number
      five: number
      fifteen: number
    }
    loadRatio: number // Load average / cores
  }
  processes: {
    total: number
    running: number
    sleeping: number
    zombie: number
  }
  disk: {
    used: number
    free: number
    total: number
    percentage: number
  }
  uptime: number
}

export interface SystemAlert {
  level: 'warning' | 'critical'
  type: 'cpu' | 'load' | 'process' | 'disk'
  message: string
  metrics: SystemMetrics
  suggestedActions: string[]
}

export class SystemMonitor extends EventEmitter {
  private thresholds: SystemThresholds = {
    cpu: {
      warning: 80,
      critical: 95,
    },
    load: {
      warning: 1.5, // 1.5x CPU cores
      critical: 2.0, // 2x CPU cores
    },
    processes: {
      max: 1000,
      warning: 800,
    },
    disk: {
      warning: 80,
      critical: 90,
    },
  }

  private isMonitoring = false
  private monitoringInterval: string | undefined
  private lastMetrics?: SystemMetrics
  private metricsHistory: SystemMetrics[] = []
  private lastCpuTimes?: NodeJS.CpuUsage

  constructor(customThresholds?: Partial<SystemThresholds>) {
    super()
    if (customThresholds) {
      this.thresholds = { ...this.thresholds, ...customThresholds }
    }
  }

  /**
   * Start system monitoring
   */
  async startMonitoring(interval = 15000): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('System monitoring already running')
      return
    }

    this.isMonitoring = true
    logger.info('Starting system monitoring', {
      interval,
      thresholds: this.thresholds,
      cpuCores: cpus().length,
    })

    // Initialize CPU baseline
    this.lastCpuTimes = process.cpuUsage()

    // Initial metrics collection
    await this.collectMetrics()

    // Start periodic monitoring
    this.monitoringInterval = managedSetInterval(async () => {
      try {
        await this.collectMetrics()
        await this.analyzeSystem()
      }
      catch (error) {
        logger.error('System monitoring failed:', error, 'system-monitor:interval')
      }
    }, interval)
  }

  /**
   * Stop system monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      managedClearTimer(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    this.isMonitoring = false
    logger.info('System monitoring stopped')
  }

  /**
   * Collect current system metrics
   */
  async collectMetrics(): Promise<SystemMetrics> {
    const [cpuUsage, processInfo, diskInfo] = await Promise.allSettled([
      this.getCpuUsage(),
      this.getProcessInfo(),
      this.getDiskInfo(),
    ])

    const loadAverage = loadavg()
    const cores = cpus().length

    const metrics: SystemMetrics = {
      timestamp: new Date(),
      cpu: {
        usage: cpuUsage.status === 'fulfilled' ? cpuUsage.value : 0,
        cores,
        loadAverage: {
          one: loadAverage[0] || 0,
          five: loadAverage[1] || 0,
          fifteen: loadAverage[2] || 0,
        },
        loadRatio: (loadAverage[0] || 0) / cores,
      },
      processes: processInfo.status === 'fulfilled'
        ? processInfo.value
        : {
            total: 0,
            running: 0,
            sleeping: 0,
            zombie: 0,
          },
      disk: diskInfo.status === 'fulfilled'
        ? diskInfo.value
        : {
            used: 0,
            free: 0,
            total: 0,
            percentage: 0,
          },
      uptime: process.uptime(),
    }

    this.lastMetrics = metrics
    this.metricsHistory.push(metrics)

    // Keep only last 100 metrics
    if (this.metricsHistory.length > 100) {
      this.metricsHistory = this.metricsHistory.slice(-100)
    }

    this.emit('metricsCollected', metrics)
    return metrics
  }

  /**
   * Get CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    if (!this.lastCpuTimes) {
      this.lastCpuTimes = process.cpuUsage()
      return 0
    }

    const currentCpuTimes = process.cpuUsage(this.lastCpuTimes)
    const totalTime = currentCpuTimes.user + currentCpuTimes.system
    const totalTimeMs = totalTime / 1000 // Convert to milliseconds

    // Calculate percentage based on elapsed time
    const elapsedTime = 1000 // Assuming 1 second between measurements
    const usage = Math.min((totalTimeMs / elapsedTime) * 100, 100)

    this.lastCpuTimes = process.cpuUsage()
    return usage
  }

  /**
   * Get process information
   */
  private async getProcessInfo(): Promise<{
    total: number
    running: number
    sleeping: number
    zombie: number
  }> {
    try {
      // On Linux/macOS, parse /proc/stat or use ps
      const { stdout } = await execAsync('ps aux | wc -l')
      const total = Number.parseInt(stdout.trim()) - 1 // Subtract header line

      // Try to get detailed process states
      try {
        const { stdout: stateOutput } = await execAsync('ps -eo state --no-headers | sort | uniq -c')
        const states = stateOutput.trim().split('\n')

        let running = 0
        let sleeping = 0
        let zombie = 0

        for (const line of states) {
          const match = line.trim().match(/(\d+)\s+([A-Z]+)/)
          if (match) {
            const count = Number.parseInt(match[1] || '0')
            const state = match[2]

            if (state?.includes('R'))
              running += count
            else if (state?.includes('S') || state?.includes('I'))
              sleeping += count
            else if (state?.includes('Z'))
              zombie += count
          }
        }

        return { total, running, sleeping, zombie }
      }
      catch {
        // Fallback if detailed state parsing fails
        return { total, running: 0, sleeping: 0, zombie: 0 }
      }
    }
    catch (error) {
      logger.debug('Failed to get process info:', error)
      return { total: 0, running: 0, sleeping: 0, zombie: 0 }
    }
  }

  /**
   * Get disk usage information
   */
  private async getDiskInfo(): Promise<{
    used: number
    free: number
    total: number
    percentage: number
  }> {
    try {
      // Use df command to get disk usage for current directory
      const { stdout } = await execAsync('df -h . | tail -1')
      const parts = stdout.trim().split(/\s+/)

      if (parts.length >= 5) {
        const total = this.parseSize(parts[1] || '0')
        const used = this.parseSize(parts[2] || '0')
        const free = this.parseSize(parts[3] || '0')
        const percentage = Number.parseInt((parts[4] || '0%').replace('%', ''))

        return { used, free, total, percentage }
      }
    }
    catch (error) {
      logger.debug('Failed to get disk info:', error)
    }

    return { used: 0, free: 0, total: 0, percentage: 0 }
  }

  /**
   * Parse size string (e.g., "1.2G", "500M") to bytes
   */
  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)(.)$/)
    if (!match)
      return 0

    const value = Number.parseFloat(match[1] || '0')
    const unit = match[2]?.toUpperCase()

    const multipliers: Record<string, number> = {
      K: 1024,
      M: 1024 * 1024,
      G: 1024 * 1024 * 1024,
      T: 1024 * 1024 * 1024 * 1024,
    }

    return Math.round(value * (multipliers[unit || ''] || 1))
  }

  /**
   * Analyze system metrics and trigger alerts
   */
  private async analyzeSystem(): Promise<void> {
    if (!this.lastMetrics)
      return

    const metrics = this.lastMetrics
    const alerts: SystemAlert[] = []

    // CPU analysis
    if (metrics.cpu.usage >= this.thresholds.cpu.critical) {
      alerts.push({
        level: 'critical',
        type: 'cpu',
        message: `CPU usage critical: ${metrics.cpu.usage.toFixed(1)}%`,
        metrics,
        suggestedActions: [
          'Identify CPU-intensive processes',
          'Kill non-essential processes',
          'Scale resources if possible',
        ],
      })
    }
    else if (metrics.cpu.usage >= this.thresholds.cpu.warning) {
      alerts.push({
        level: 'warning',
        type: 'cpu',
        message: `CPU usage high: ${metrics.cpu.usage.toFixed(1)}%`,
        metrics,
        suggestedActions: [
          'Monitor process activity',
          'Consider optimization',
        ],
      })
    }

    // Load average analysis
    if (metrics.cpu.loadRatio >= this.thresholds.load.critical) {
      alerts.push({
        level: 'critical',
        type: 'load',
        message: `System load critical: ${metrics.cpu.loadRatio.toFixed(2)}x cores`,
        metrics,
        suggestedActions: [
          'Reduce concurrent operations',
          'Kill unnecessary processes',
          'Add more CPU resources',
        ],
      })
    }
    else if (metrics.cpu.loadRatio >= this.thresholds.load.warning) {
      alerts.push({
        level: 'warning',
        type: 'load',
        message: `System load high: ${metrics.cpu.loadRatio.toFixed(2)}x cores`,
        metrics,
        suggestedActions: [
          'Monitor system load',
          'Optimize resource usage',
        ],
      })
    }

    // Process count analysis
    if (metrics.processes.total >= this.thresholds.processes.max) {
      alerts.push({
        level: 'critical',
        type: 'process',
        message: `Too many processes: ${metrics.processes.total}`,
        metrics,
        suggestedActions: [
          'Kill unnecessary processes',
          'Check for process leaks',
          'Increase process limits',
        ],
      })
    }
    else if (metrics.processes.total >= this.thresholds.processes.warning) {
      alerts.push({
        level: 'warning',
        type: 'process',
        message: `High process count: ${metrics.processes.total}`,
        metrics,
        suggestedActions: [
          'Monitor process creation',
          'Check for runaway processes',
        ],
      })
    }

    // Disk usage analysis
    if (metrics.disk.percentage >= this.thresholds.disk.critical) {
      alerts.push({
        level: 'critical',
        type: 'disk',
        message: `Disk usage critical: ${metrics.disk.percentage}%`,
        metrics,
        suggestedActions: [
          'Clean up temporary files',
          'Remove old logs',
          'Free disk space immediately',
        ],
      })
    }
    else if (metrics.disk.percentage >= this.thresholds.disk.warning) {
      alerts.push({
        level: 'warning',
        type: 'disk',
        message: `Disk usage high: ${metrics.disk.percentage}%`,
        metrics,
        suggestedActions: [
          'Monitor disk usage',
          'Plan cleanup activities',
        ],
      })
    }

    // Zombie process detection
    if (metrics.processes.zombie > 0) {
      alerts.push({
        level: 'warning',
        type: 'process',
        message: `Zombie processes detected: ${metrics.processes.zombie}`,
        metrics,
        suggestedActions: [
          'Kill parent processes',
          'Restart affected services',
          'Check process management',
        ],
      })
    }

    // Emit alerts
    for (const alert of alerts) {
      logger.warn(`System alert: ${alert.message}`, {
        level: alert.level,
        type: alert.type,
        suggestions: alert.suggestedActions,
      })
      this.emit('systemAlert', alert)
    }
  }

  /**
   * Get current system metrics
   */
  getCurrentMetrics(): SystemMetrics | null {
    return this.lastMetrics || null
  }

  /**
   * Get system metrics history
   */
  getMetricsHistory(count = 50): SystemMetrics[] {
    return this.metricsHistory.slice(-count)
  }

  /**
   * Get system status summary
   */
  getStatus(): {
    isMonitoring: boolean
    currentMetrics: SystemMetrics | null
    thresholds: SystemThresholds
    health: {
      cpu: 'healthy' | 'warning' | 'critical'
      load: 'healthy' | 'warning' | 'critical'
      processes: 'healthy' | 'warning' | 'critical'
      disk: 'healthy' | 'warning' | 'critical'
    }
  } {
    const health: {
      cpu: 'healthy' | 'warning' | 'critical'
      load: 'healthy' | 'warning' | 'critical'
      processes: 'healthy' | 'warning' | 'critical'
      disk: 'healthy' | 'warning' | 'critical'
    } = {
      cpu: 'healthy',
      load: 'healthy',
      processes: 'healthy',
      disk: 'healthy',
    }

    if (this.lastMetrics) {
      const m = this.lastMetrics

      // Determine health status
      if (m.cpu.usage >= this.thresholds.cpu.critical)
        health.cpu = 'critical'
      else if (m.cpu.usage >= this.thresholds.cpu.warning)
        health.cpu = 'warning'

      if (m.cpu.loadRatio >= this.thresholds.load.critical)
        health.load = 'critical'
      else if (m.cpu.loadRatio >= this.thresholds.load.warning)
        health.load = 'warning'

      if (m.processes.total >= this.thresholds.processes.max)
        health.processes = 'critical'
      else if (m.processes.total >= this.thresholds.processes.warning)
        health.processes = 'warning'

      if (m.disk.percentage >= this.thresholds.disk.critical)
        health.disk = 'critical'
      else if (m.disk.percentage >= this.thresholds.disk.warning)
        health.disk = 'warning'
    }

    return {
      isMonitoring: this.isMonitoring,
      currentMetrics: this.lastMetrics || null,
      thresholds: this.thresholds,
      health,
    }
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<SystemThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds }
    logger.info('System thresholds updated', this.thresholds)
  }

  /**
   * Force system cleanup
   */
  async forceCleanup(): Promise<void> {
    logger.info('Forcing system cleanup')

    try {
      // Clean temporary files
      await execAsync('find /tmp -type f -atime +1 -delete 2>/dev/null || true')

      // Clean up zombie processes (attempt)
      await execAsync('ps -eo pid,ppid,state | grep Z | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true')

      logger.info('System cleanup completed')
      this.emit('cleanupCompleted')
    }
    catch (error) {
      logger.error('System cleanup failed:', error)
    }
  }
}
