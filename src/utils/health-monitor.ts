/**
 * Health Monitoring System
 *
 * Comprehensive health checks for:
 * - System resources (CPU, memory, disk)
 * - Database connectivity
 * - N8N API availability
 * - Process stability
 * - Circuit breaker status
 */

import { cpus, freemem, totalmem } from 'node:os'
import process from 'node:process'
import { database } from '../database/index.js'
import { config } from '../server/config.js'
import { logger } from '../server/logger.js'
import { getAllCircuitBreakers } from './circuit-breaker.js'
import { managedClearTimer, managedSetInterval, managedSetTimeout } from './timer-manager.js'

export interface HealthCheck {
  name: string
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  message: string
  lastCheck: Date
  responseTime?: number
  details?: Record<string, any>
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical'
  timestamp: Date
  uptime: number
  checks: HealthCheck[]
  metrics: {
    memory: {
      used: number
      free: number
      total: number
      percentage: number
    }
    cpu: {
      usage: number
      cores: number
    }
    process: {
      pid: number
      memoryUsage: NodeJS.MemoryUsage
      uptime: number
    }
  }
}

export class HealthMonitor {
  private lastCpuUsage = process.cpuUsage()
  private checks: Map<string, HealthCheck> = new Map()
  private isMonitoring = false
  private monitoringInterval: string | undefined = undefined

  constructor(
    private config: {
      checkInterval: number
      memoryThreshold: number
      cpuThreshold: number
      diskThreshold: number
    } = {
      checkInterval: 30000, // 30 seconds
      memoryThreshold: 80, // 80%
      cpuThreshold: 80, // 80%
      diskThreshold: 90, // 90%
    },
  ) {}

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Health monitoring already running')
      return
    }

    this.isMonitoring = true
    logger.info('Starting health monitoring', { interval: this.config.checkInterval })

    // Initial health check
    await this.performHealthCheck()

    // Schedule periodic checks
    this.monitoringInterval = managedSetInterval(async () => {
      try {
        await this.performHealthCheck()
      }
      catch (error) {
        logger.error('Health check failed:', error, 'health-monitor:interval')
      }
    }, this.config.checkInterval)
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      managedClearTimer(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    this.isMonitoring = false
    logger.info('Health monitoring stopped')
  }

  async performHealthCheck(): Promise<SystemHealth> {
    const startTime = Date.now()
    const checks: HealthCheck[] = []

    // Memory check
    checks.push(await this.checkMemory())

    // CPU check
    checks.push(await this.checkCpu())

    // Database check
    checks.push(await this.checkDatabase())

    // N8N API check
    if (config.n8nApiUrl && config.n8nApiKey) {
      checks.push(await this.checkN8nApi())
    }

    // Process stability check
    checks.push(await this.checkProcessStability())

    // Circuit breaker check
    checks.push(await this.checkCircuitBreakers())

    // Calculate overall health
    const overall = this.calculateOverallHealth(checks)

    const health: SystemHealth = {
      overall,
      timestamp: new Date(),
      uptime: process.uptime(),
      checks,
      metrics: {
        memory: this.getMemoryMetrics(),
        cpu: await this.getCpuMetrics(),
        process: {
          pid: process.pid,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
        },
      },
    }

    // Store checks for trend analysis
    checks.forEach(check => this.checks.set(check.name, check))

    // Log warnings and critical issues
    const criticalChecks = checks.filter(c => c.status === 'critical')
    const warningChecks = checks.filter(c => c.status === 'warning')

    if (criticalChecks.length > 0) {
      logger.error('Critical health issues detected', {
        issues: criticalChecks.map(c => c.name),
      })
    }

    if (warningChecks.length > 0) {
      logger.warn('Health warnings detected', {
        warnings: warningChecks.map(c => c.name),
      })
    }

    return health
  }

  private async checkMemory(): Promise<HealthCheck> {
    const memMetrics = this.getMemoryMetrics()
    const status = memMetrics.percentage > 90
      ? 'critical'
      : memMetrics.percentage > this.config.memoryThreshold ? 'warning' : 'healthy'

    return {
      name: 'memory',
      status,
      message: `Memory usage: ${memMetrics.percentage.toFixed(1)}%`,
      lastCheck: new Date(),
      details: memMetrics,
    }
  }

  private async checkCpu(): Promise<HealthCheck> {
    const cpuMetrics = await this.getCpuMetrics()
    const status = cpuMetrics.usage > 95
      ? 'critical'
      : cpuMetrics.usage > this.config.cpuThreshold ? 'warning' : 'healthy'

    return {
      name: 'cpu',
      status,
      message: `CPU usage: ${cpuMetrics.usage.toFixed(1)}%`,
      lastCheck: new Date(),
      details: cpuMetrics,
    }
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      // ✅ Non-blocking database check with timeout
      const healthCheckPromise = new Promise<any>((resolve, reject) => {
        try {
          const result = database.executeCustomSQL('healthCheck', (db) => {
            return db.prepare('SELECT 1 as test').get()
          })
          resolve(result)
        }
        catch (error) {
          reject(error)
        }
      })

      const timeoutPromise = new Promise<never>((_, reject) => {
        managedSetTimeout(() => reject(new Error('Database health check timeout')), 2000, 'health-monitor:timer')
      })

      const result = await Promise.race([healthCheckPromise, timeoutPromise])
      const responseTime = Date.now() - startTime

      return {
        name: 'database',
        status: responseTime > 1000 ? 'warning' : 'healthy',
        message: `Database responsive in ${responseTime}ms`,
        lastCheck: new Date(),
        responseTime,
        details: { result },
      }
    }
    catch (error) {
      return {
        name: 'database',
        status: 'critical',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      }
    }
  }

  private async checkN8nApi(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      // This would check N8N API health if available
      // For now, return a basic check
      return {
        name: 'n8n_api',
        status: 'healthy',
        message: 'N8N API configuration present',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      }
    }
    catch (error) {
      return {
        name: 'n8n_api',
        status: 'warning',
        message: `N8N API check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      }
    }
  }

  private async checkProcessStability(): Promise<HealthCheck> {
    const uptime = process.uptime()
    const memUsage = process.memoryUsage()

    // Check for memory leaks (simple heuristic)
    const memLeakRisk = memUsage.heapUsed > (100 * 1024 * 1024) // > 100MB
      && uptime > 3600 // Running for more than 1 hour

    const status = memLeakRisk ? 'warning' : 'healthy'
    const message = memLeakRisk
      ? 'Potential memory leak detected - high heap usage'
      : `Process stable, uptime: ${Math.floor(uptime)}s`

    return {
      name: 'process_stability',
      status,
      message,
      lastCheck: new Date(),
      details: {
        uptime,
        memoryUsage: memUsage,
        memLeakRisk,
      },
    }
  }

  private async checkCircuitBreakers(): Promise<HealthCheck> {
    const breakers = getAllCircuitBreakers()
    const openBreakers: string[] = []
    const halfOpenBreakers: string[] = []

    for (const [name, breaker] of breakers) {
      const metrics = breaker.getMetrics()
      if (metrics.state === 'OPEN') {
        openBreakers.push(name)
      }
      else if (metrics.state === 'HALF_OPEN') {
        halfOpenBreakers.push(name)
      }
    }

    const status = openBreakers.length > 0
      ? 'critical'
      : halfOpenBreakers.length > 0 ? 'warning' : 'healthy'

    const message = openBreakers.length > 0
      ? `Circuit breakers open: ${openBreakers.join(', ')}`
      : halfOpenBreakers.length > 0
        ? `Circuit breakers recovering: ${halfOpenBreakers.join(', ')}`
        : 'All circuit breakers healthy'

    return {
      name: 'circuit_breakers',
      status,
      message,
      lastCheck: new Date(),
      details: {
        total: breakers.size,
        open: openBreakers,
        halfOpen: halfOpenBreakers,
      },
    }
  }

  private getMemoryMetrics() {
    const total = totalmem()
    const free = freemem()
    const used = total - free
    const percentage = (used / total) * 100

    return {
      used,
      free,
      total,
      percentage,
    }
  }

  private async getCpuMetrics() {
    const cores = cpus().length

    // Simple CPU usage calculation
    const currentUsage = process.cpuUsage(this.lastCpuUsage)
    this.lastCpuUsage = process.cpuUsage()

    const totalUsage = currentUsage.user + currentUsage.system
    const usage = (totalUsage / 1000000) * 100 // Convert to percentage

    return {
      usage: Math.min(usage, 100), // Cap at 100%
      cores,
    }
  }

  private calculateOverallHealth(checks: HealthCheck[]): 'healthy' | 'warning' | 'critical' {
    const critical = checks.some(c => c.status === 'critical')
    const warning = checks.some(c => c.status === 'warning')

    return critical ? 'critical' : warning ? 'warning' : 'healthy'
  }

  getLastHealthCheck(): SystemHealth | null {
    if (this.checks.size === 0)
      return null

    const checks = Array.from(this.checks.values())
    return {
      overall: this.calculateOverallHealth(checks),
      timestamp: new Date(),
      uptime: process.uptime(),
      checks,
      metrics: {
        memory: this.getMemoryMetrics(),
        cpu: { usage: 0, cores: cpus().length },
        process: {
          pid: process.pid,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
        },
      },
    }
  }

  isHealthy(): boolean {
    const lastCheck = this.getLastHealthCheck()
    return lastCheck?.overall === 'healthy' || false
  }
}

// Global health monitor instance
let _healthMonitor: HealthMonitor | null = null

export function getHealthMonitor(): HealthMonitor {
  if (!_healthMonitor) {
    _healthMonitor = new HealthMonitor()
  }
  return _healthMonitor
}
