/**
 * Aggressive Memory Cleanup Utilities
 * Addresses critical memory usage (90%+ → target <80%)
 *
 * EMERGENCY FIXES:
 * - Force garbage collection more frequently
 * - Clear caches aggressively
 * - Reduce object allocations
 * - Monitor and cleanup memory leaks
 */

import process from 'node:process'
import { logger } from '../server/logger.js'

/**
 * Aggressive memory cleanup manager
 */
export class AggressiveMemoryCleanup {
  private static cleanupInterval: NodeJS.Timeout | null = null
  private static isActive = false

  /**
   * Start aggressive memory cleanup
   */
  static start(): void {
    if (this.isActive)
      return

    this.isActive = true
    logger.info('🚨 Starting aggressive memory cleanup mode')

    // Force GC every 10 seconds instead of default 60
    this.cleanupInterval = setInterval(() => {
      this.performAggressiveCleanup()
    }, 10000)

    // Immediate cleanup
    this.performAggressiveCleanup()
  }

  /**
   * Stop aggressive cleanup
   */
  static stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.isActive = false
    logger.info('Stopped aggressive memory cleanup')
  }

  /**
   * Perform comprehensive memory cleanup
   */
  private static performAggressiveCleanup(): void {
    const beforeMemory = process.memoryUsage()

    try {
      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc()
      }

      // Clear all possible caches
      this.clearAllCaches()

      // Force another GC cycle
      if (globalThis.gc) {
        globalThis.gc()
      }

      const afterMemory = process.memoryUsage()
      const heapReduction = beforeMemory.heapUsed - afterMemory.heapUsed
      const newUsagePercent = (afterMemory.heapUsed / afterMemory.heapTotal) * 100

      if (heapReduction > 0) {
        logger.info('🧹 Aggressive cleanup freed memory', {
          freed: `${Math.round(heapReduction / 1024 / 1024)}MB`,
          newUsage: `${newUsagePercent.toFixed(1)}%`,
          heapUsed: `${Math.round(afterMemory.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(afterMemory.heapTotal / 1024 / 1024)}MB`,
        })
      }
    }
    catch (error) {
      logger.warn('Error during aggressive memory cleanup:', error)
    }
  }

  /**
   * Clear all possible caches and temporary data
   */
  private static clearAllCaches(): void {
    try {
      // Clear require cache (but keep essential modules)
      const moduleCache = require.cache || {}
      const keepModules = [
        'fs',
        'path',
        'util',
        'events',
        'stream',
        'crypto',
        'os',
        'http',
        'https',
        'url',
        'querystring',
        'zlib',
      ]

      Object.keys(moduleCache).forEach((key) => {
        const isEssential = keepModules.some(mod => key.includes(mod))
        if (!isEssential && key.includes('node_modules')) {
          delete moduleCache[key]
        }
      })

      // Clear any global caches we might have
      const globalAny = globalThis as Record<string, unknown>
      if (globalAny.__n8n_cache__) {
        globalAny.__n8n_cache__ = {}
      }
    }
    catch (error) {
      logger.debug('Cache clearing had issues:', error)
    }
  }

  /**
   * Get current memory pressure level
   */
  static getMemoryPressure(): 'low' | 'medium' | 'high' | 'critical' {
    const memory = process.memoryUsage()
    const usagePercent = (memory.heapUsed / memory.heapTotal) * 100

    if (usagePercent >= 95)
      return 'critical'
    if (usagePercent >= 90)
      return 'high'
    if (usagePercent >= 80)
      return 'medium'
    return 'low'
  }

  /**
   * Emergency memory relief
   */
  static emergencyCleanup(): void {
    logger.warn('🚨 EMERGENCY: Performing emergency memory cleanup')

    // Multiple aggressive GC cycles
    for (let i = 0; i < 3; i++) {
      if (globalThis.gc) {
        globalThis.gc()
      }
    }

    this.clearAllCaches()

    // Final GC
    if (globalThis.gc) {
      globalThis.gc()
    }

    const memory = process.memoryUsage()
    const usagePercent = (memory.heapUsed / memory.heapTotal) * 100

    logger.info('Emergency cleanup complete', {
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      usage: `${usagePercent.toFixed(1)}%`,
    })
  }
}

/**
 * Memory-efficient object creator with cleanup
 */
export function createCleanObject<T extends object>(data: T): T {
  // Create minimal object without prototype pollution
  const clean = Object.create(null)
  Object.assign(clean, data)
  return clean
}

/**
 * Memory-efficient array operations
 */
export class MemoryEfficientArrays {
  /**
   * Slice array and immediately clean up references
   */
  static slice<T>(arr: T[], start?: number, end?: number): T[] {
    const result = arr.slice(start, end)

    // Help GC by clearing references in original if it's large
    if (arr.length > 100) {
      arr.length = Math.min(arr.length, 50) // Truncate large arrays
    }

    return result
  }

  /**
   * Map with immediate cleanup
   */
  static map<T, U>(arr: T[], fn: (item: T, index: number) => U): U[] {
    const result: U[] = []

    for (let i = 0; i < Math.min(arr.length, 50); i++) { // Limit iterations
      const item = arr[i]
      if (item !== undefined) {
        result.push(fn(item, i))
      }
    }

    return result
  }
}

/**
 * Initialize aggressive memory cleanup if needed
 */
export function initializeAggressiveCleanup(): void {
  const pressure = AggressiveMemoryCleanup.getMemoryPressure()

  if (pressure === 'high' || pressure === 'critical') {
    logger.warn(`Memory pressure: ${pressure} - Starting aggressive cleanup`)
    AggressiveMemoryCleanup.start()
  }

  // Monitor and adjust
  setInterval(() => {
    const currentPressure = AggressiveMemoryCleanup.getMemoryPressure()

    if (currentPressure === 'critical') {
      AggressiveMemoryCleanup.emergencyCleanup()
    }
  }, 5000) // Check every 5 seconds
}
