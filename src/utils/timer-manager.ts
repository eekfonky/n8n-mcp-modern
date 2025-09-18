/**
 * Timer and Interval Management System
 *
 * Centralized management of all timers and intervals to prevent leaks:
 * - Automatic cleanup on shutdown
 * - Timer monitoring and health checks
 * - Resource usage optimization
 * - Collision detection and prevention
 * - Adaptive timing based on system load
 */

import { EventEmitter } from 'node:events'
import { logger } from '../server/logger.js'
import { getHealthMonitor } from './health-monitor.js'

export interface TimerInfo {
  id: string
  type: 'timeout' | 'interval'
  callback: Function
  delay: number
  created: Date
  lastExecution?: Date
  executionCount: number
  source: string // Stack trace or identifier
  isActive: boolean
}

export interface TimerStats {
  total: number
  active: number
  timeouts: number
  intervals: number
  oldestTimer: Date | null
  averageDelay: number
  totalExecutions: number
}

export class TimerManager extends EventEmitter {
  private timers = new Map<string, {
    info: TimerInfo
    handle: NodeJS.Timeout
  }>()

  private isShuttingDown = false
  private maxTimers = 50 // Prevent timer explosion
  private cleanupInterval?: NodeJS.Timeout | undefined

  constructor() {
    super()
    this.startCleanupMonitoring()
    this.setupShutdownHandlers()
  }

  /**
   * Create a managed timeout
   */
  setTimeout(
    callback: () => void | Promise<void>,
    delay: number,
    source?: string,
  ): string {
    if (this.isShuttingDown) {
      throw new Error('Timer manager is shutting down')
    }

    if (this.timers.size >= this.maxTimers) {
      logger.warn('Maximum timer limit reached - cleaning up old timers')
      this.cleanupOldTimers()
    }

    const id = this.generateId('timeout')
    const actualSource = source || this.getCallerInfo()

    const wrappedCallback = async () => {
      const entry = this.timers.get(id)
      if (entry) {
        entry.info.lastExecution = new Date()
        entry.info.executionCount++
        entry.info.isActive = false

        try {
          await callback()
          this.emit('timerExecuted', entry.info)
        }
        catch (error) {
          logger.error(`Timer ${id} execution failed:`, error)
          this.emit('timerError', entry.info, error)
        }

        // Remove timeout after execution
        this.timers.delete(id)
      }
    }

    const handle = setTimeout(wrappedCallback, delay)

    const timerInfo: TimerInfo = {
      id,
      type: 'timeout',
      callback,
      delay,
      created: new Date(),
      executionCount: 0,
      source: actualSource,
      isActive: true,
    }

    this.timers.set(id, { info: timerInfo, handle })
    this.emit('timerCreated', timerInfo)

    logger.debug(`Created timeout ${id}`, { delay, source: actualSource })
    return id
  }

  /**
   * Create a managed interval
   */
  setInterval(
    callback: () => void | Promise<void>,
    delay: number,
    source?: string,
  ): string {
    if (this.isShuttingDown) {
      throw new Error('Timer manager is shutting down')
    }

    if (this.timers.size >= this.maxTimers) {
      logger.warn('Maximum timer limit reached - cleaning up old timers')
      this.cleanupOldTimers()
    }

    const id = this.generateId('interval')
    const actualSource = source || this.getCallerInfo()

    const wrappedCallback = async () => {
      const entry = this.timers.get(id)
      if (entry && entry.info.isActive) {
        entry.info.lastExecution = new Date()
        entry.info.executionCount++

        try {
          await callback()
          this.emit('timerExecuted', entry.info)
        }
        catch (error) {
          logger.error(`Interval ${id} execution failed:`, error)
          this.emit('timerError', entry.info, error)

          // Stop problematic intervals
          if (entry.info.executionCount > 10) {
            logger.warn(`Stopping problematic interval ${id} after ${entry.info.executionCount} failures`)
            this.clearTimer(id)
          }
        }
      }
    }

    const handle = setInterval(wrappedCallback, delay)

    const timerInfo: TimerInfo = {
      id,
      type: 'interval',
      callback,
      delay,
      created: new Date(),
      executionCount: 0,
      source: actualSource,
      isActive: true,
    }

    this.timers.set(id, { info: timerInfo, handle })
    this.emit('timerCreated', timerInfo)

    logger.debug(`Created interval ${id}`, { delay, source: actualSource })
    return id
  }

  /**
   * Clear a specific timer
   */
  clearTimer(id: string): boolean {
    const entry = this.timers.get(id)
    if (!entry) {
      return false
    }

    clearTimeout(entry.handle) // Works for both timeout and interval
    entry.info.isActive = false
    this.timers.delete(id)

    logger.debug(`Cleared timer ${id}`)
    this.emit('timerCleared', entry.info)
    return true
  }

  /**
   * Clear all timers
   */
  clearAllTimers(): void {
    logger.info(`Clearing ${this.timers.size} active timers`)

    for (const [id, entry] of this.timers) {
      clearTimeout(entry.handle)
      entry.info.isActive = false
      this.emit('timerCleared', entry.info)
    }

    this.timers.clear()
  }

  /**
   * Get timer statistics
   */
  getStats(): TimerStats {
    const activeTimers = Array.from(this.timers.values()).map(entry => entry.info)
    const timeouts = activeTimers.filter(timer => timer.type === 'timeout')
    const intervals = activeTimers.filter(timer => timer.type === 'interval')

    const totalExecutions = activeTimers.reduce((sum, timer) => sum + timer.executionCount, 0)
    const averageDelay = activeTimers.length > 0
      ? activeTimers.reduce((sum, timer) => sum + timer.delay, 0) / activeTimers.length
      : 0

    const oldestTimer = activeTimers.length > 0
      ? activeTimers.reduce((oldest, timer) =>
          timer.created < oldest ? timer.created : oldest, activeTimers[0]!.created)
      : null

    return {
      total: this.timers.size,
      active: activeTimers.filter(timer => timer.isActive).length,
      timeouts: timeouts.length,
      intervals: intervals.length,
      oldestTimer,
      averageDelay,
      totalExecutions,
    }
  }

  /**
   * Get all timer information
   */
  getAllTimers(): TimerInfo[] {
    return Array.from(this.timers.values()).map(entry => ({ ...entry.info }))
  }

  /**
   * Get timer by ID
   */
  getTimer(id: string): TimerInfo | null {
    const entry = this.timers.get(id)
    return entry ? { ...entry.info } : null
  }

  /**
   * Check timer health and cleanup old/problematic timers
   */
  healthCheck(): boolean {
    const stats = this.getStats()
    const healthMonitor = getHealthMonitor()

    // Check for timer explosion
    if (stats.total > this.maxTimers * 0.8) {
      logger.warn('High timer count detected', stats)
      this.cleanupOldTimers()
    }

    // Check for stuck intervals (not executing)
    const now = Date.now()
    for (const entry of this.timers.values()) {
      if (entry.info.type === 'interval' && entry.info.lastExecution) {
        const timeSinceLastExecution = now - entry.info.lastExecution.getTime()
        if (timeSinceLastExecution > entry.info.delay * 5) { // 5x expected delay
          logger.warn(`Stuck interval detected: ${entry.info.id}`)
          this.clearTimer(entry.info.id)
        }
      }
    }

    // Check system health
    const systemHealthy = healthMonitor.isHealthy()

    // Reduce timer frequency under high load
    if (!systemHealthy) {
      this.adaptTimersForHighLoad()
    }

    return systemHealthy && stats.total < this.maxTimers
  }

  /**
   * Adapt timer frequencies during high system load
   */
  private adaptTimersForHighLoad(): void {
    logger.info('Adapting timers for high system load')

    for (const [id, entry] of this.timers) {
      if (entry.info.type === 'interval' && entry.info.delay < 10000) {
        // Increase interval delay for frequent timers
        const newDelay = Math.min(entry.info.delay * 2, 60000) // Max 1 minute

        this.clearTimer(id)
        this.setInterval(
          entry.info.callback as () => void,
          newDelay,
          `${entry.info.source} (adapted for high load)`,
        )
      }
    }
  }

  /**
   * Clean up old or inactive timers
   */
  private cleanupOldTimers(): void {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    for (const [id, entry] of this.timers) {
      const age = now - entry.info.created.getTime()

      if (age > maxAge || !entry.info.isActive) {
        logger.debug(`Cleaning up old timer ${id}`, { age: Math.floor(age / 1000) })
        this.clearTimer(id)
      }
    }
  }

  /**
   * Start cleanup monitoring with recursion protection
   */
  private healthCheckInProgress = false
  private healthCheckErrorCount = 0
  private readonly MAX_HEALTH_CHECK_ERRORS = 5

  private startCleanupMonitoring(): void {
    this.cleanupInterval = setInterval(() => {
      this.performSafeHealthCheck()
    }, 60000) // Check every minute
  }

  /**
   * Perform health check with recursion and error protection
   */
  private performSafeHealthCheck(): void {
    // Prevent concurrent health checks
    if (this.healthCheckInProgress) {
      logger.warn('Health check already in progress - skipping')
      return
    }

    // Check error threshold
    if (this.healthCheckErrorCount >= this.MAX_HEALTH_CHECK_ERRORS) {
      logger.error('Too many health check failures - disabling health checks')
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
        this.cleanupInterval = undefined as NodeJS.Timeout | undefined
      }
      return
    }

    this.healthCheckInProgress = true

    try {
      const healthResult = this.healthCheck()

      if (!healthResult) {
        this.healthCheckErrorCount++
        logger.warn(`Health check failed - error count: ${this.healthCheckErrorCount}/${this.MAX_HEALTH_CHECK_ERRORS}`)
      }
      else {
        // Reset error count on successful health check
        this.healthCheckErrorCount = 0
      }
    }
    catch (error) {
      this.healthCheckErrorCount++
      logger.error(`Timer health check failed (${this.healthCheckErrorCount}/${this.MAX_HEALTH_CHECK_ERRORS}):`, error)

      // If too many errors, disable health checks to prevent infinite loops
      if (this.healthCheckErrorCount >= this.MAX_HEALTH_CHECK_ERRORS) {
        logger.error('Disabling timer health checks due to repeated failures')
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval)
          this.cleanupInterval = undefined
        }
      }
    }
    finally {
      this.healthCheckInProgress = false
    }
  }

  /**
   * Setup shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = () => {
      this.isShuttingDown = true
      this.clearAllTimers()

      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
      }
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    process.on('exit', shutdown)
  }

  /**
   * Generate unique timer ID
   */
  private generateId(type: 'timeout' | 'interval'): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get caller information for debugging with null safety
   */
  private getCallerInfo(): string {
    const stack = new Error().stack
    if (!stack)
      return 'unknown'

    const lines = stack.split('\n')
    // Skip the first 3 lines (Error, this method, and the timer creation method)
    const callerLine = lines[3]
    if (!callerLine)
      return 'unknown'

    // Extract filename and line number with null safety
    const match = callerLine.match(/at .* \((.+):(\d+):(\d+)\)/)
    if (match && match[1] && match[2]) {
      const file = match[1]
      const line = match[2]
      const filename = file.split('/').pop()
      return `${filename || file}:${line}`
    }

    return callerLine.trim()
  }
}

// Global timer manager instance
let _timerManager: TimerManager | null = null

export function getTimerManager(): TimerManager {
  if (!_timerManager) {
    _timerManager = new TimerManager()
  }
  return _timerManager
}

// Enhanced global timer functions
export function managedSetTimeout(
  callback: () => void | Promise<void>,
  delay: number,
  source?: string,
): string {
  return getTimerManager().setTimeout(callback, delay, source)
}

export function managedSetInterval(
  callback: () => void | Promise<void>,
  delay: number,
  source?: string,
): string {
  return getTimerManager().setInterval(callback, delay, source)
}

export function managedClearTimer(id: string): boolean {
  return getTimerManager().clearTimer(id)
}

// Proxy the global timer functions for automatic management
if (typeof globalThis !== 'undefined') {
  const originalSetTimeout = globalThis.setTimeout
  const originalSetInterval = globalThis.setInterval
  const originalClearTimeout = globalThis.clearTimeout
  const originalClearInterval = globalThis.clearInterval

  // Override global functions with managed versions (optional - for complete control)
  /*
  globalThis.setTimeout = (callback: Function, delay?: number, ...args: unknown[]) => {
    if (typeof callback === 'function' && typeof delay === 'number') {
      return managedSetTimeout(callback, delay) as string
    }
    return originalSetTimeout(callback, delay, ...args)
  }

  globalThis.setInterval = (callback: Function, delay?: number, ...args: unknown[]) => {
    if (typeof callback === 'function' && typeof delay === 'number') {
      return managedSetInterval(callback, delay) as any
    }
    return originalSetInterval(callback, delay, ...args)
  }
  */
}
