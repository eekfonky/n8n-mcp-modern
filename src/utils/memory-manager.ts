/**
 * Simple Memory Manager for Lightweight MCP
 * Prevents memory leaks in long-running agent processes
 */

import process from 'node:process'
import { logger } from '../server/logger.js'
import { managedClearTimer, managedSetInterval, managedSetTimeout } from './timer-manager.js'

export interface MemoryStats {
  heapUsed: number
  heapTotal: number
  external: number
  arrayBuffers: number
}

export class MemoryManager {
  private cleanupCallbacks = new Set<() => void>()
  private intervalId: string | undefined
  private memoryBaseline?: MemoryStats

  constructor(private checkIntervalMs = 30000) { // 30 second check
    this.establishBaseline()
    this.startMonitoring()
  }

  /**
   * Register a cleanup callback
   */
  registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.add(callback)
  }

  /**
   * Unregister a cleanup callback
   */
  unregisterCleanup(callback: () => void): void {
    this.cleanupCallbacks.delete(callback)
  }

  /**
   * Force garbage collection if available
   */
  forceGC(): void {
    if (globalThis.gc) {
      globalThis.gc()
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage()
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
    }
  }

  /**
   * Check if memory usage is concerning
   */
  isMemoryHigh(): boolean {
    if (!this.memoryBaseline)
      return false

    const current = this.getMemoryStats()
    const baseline = this.memoryBaseline

    // Alert if heap grew by more than 100MB
    const heapGrowth = current.heapUsed - baseline.heapUsed
    return heapGrowth > 100 * 1024 * 1024
  }

  /**
   * Run all cleanup callbacks
   */
  async cleanup(): Promise<void> {
    logger.info(`Running ${this.cleanupCallbacks.size} cleanup callbacks...`)

    for (const callback of this.cleanupCallbacks) {
      try {
        callback()
      }
      catch (error) {
        logger.error('Cleanup callback failed:', error)
      }
    }

    // Force GC after cleanup
    this.forceGC()

    logger.info('Memory cleanup completed')
  }

  /**
   * Start automatic memory monitoring
   */
  private startMonitoring(): void {
    this.intervalId = managedSetInterval(async () => {
      if (this.isMemoryHigh()) {
        logger.warn('High memory usage detected, running cleanup...', 'memory-manager:interval')
        await this.cleanup()
      }
    }, this.checkIntervalMs)
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (this.intervalId) {
      managedClearTimer(this.intervalId)
    }
    this.intervalId = undefined
  }

  /**
   * Establish memory baseline
   */
  private establishBaseline(): void {
    // Force GC first to get clean baseline
    this.forceGC()
    managedSetTimeout(() => {
      this.memoryBaseline = this.getMemoryStats()
      logger.debug('Memory baseline established:', this.memoryBaseline, 'memory-manager:timer')
    }, 1000)
  }

  /**
   * Get memory report
   */
  getReport(): string {
    const current = this.getMemoryStats()
    const baseline = this.memoryBaseline

    if (!baseline) {
      return `Current: ${Math.round(current.heapUsed / 1024 / 1024)}MB heap`
    }

    const heapGrowth = current.heapUsed - baseline.heapUsed
    const growthMB = Math.round(heapGrowth / 1024 / 1024)

    return `Memory: ${Math.round(current.heapUsed / 1024 / 1024)}MB heap (${growthMB >= 0 ? '+' : ''}${growthMB}MB from baseline)`
  }
}

// Global memory manager instance
export const memoryManager = new MemoryManager()

// Register process exit cleanup (with safety checks to prevent duplicate handlers)
const exitHandlerRegistered = Symbol.for('memoryManager.exitHandlerRegistered')
if (!(globalThis as Record<symbol, boolean>)[exitHandlerRegistered]) {
  (globalThis as Record<symbol, boolean>)[exitHandlerRegistered] = true

  process.on('exit', () => {
    memoryManager.stop()
  })

  let shutdownInProgress = false
  const gracefulShutdown = async (signal: string): Promise<void> => {
    if (shutdownInProgress)
      return
    shutdownInProgress = true

    try {
      await memoryManager.cleanup()
    }
    catch (error) {
      logger.error(`Error during ${signal} cleanup:`, error)
    }
    finally {
      process.exit(0)
    }
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}
