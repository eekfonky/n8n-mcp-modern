/**
 * Node.js 22+ Feature Utilization
 * Demonstrates modern Node.js APIs and patterns
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { performance, PerformanceObserver } from 'node:perf_hooks'
import process from 'node:process'
import { setImmediate } from 'node:timers'
import { logger } from '../server/logger.js'

// Node.js 22+ AsyncLocalStorage for request context
export interface RequestContext {
  requestId: string
  startTime: number
  toolName?: string
  userId?: string
}

const requestContext = new AsyncLocalStorage<RequestContext>()

/**
 * Get current request context using AsyncLocalStorage
 */
export function getCurrentContext(): RequestContext | undefined {
  return requestContext.getStore()
}

/**
 * Run function with request context
 */
export function runWithContext<T>(
  context: { requestId: string, startTime: number, toolName?: string, userId?: string },
  fn: () => T,
): T {
  return requestContext.run(context, fn)
}

/**
 * Enhanced performance monitoring using Node.js 22+ performance APIs
 */
class PerformanceMonitor {
  private observer: PerformanceObserver | null = null
  private metrics: Map<string, number[]> = new Map()

  constructor() {
    this.setupPerformanceObserver()
  }

  private setupPerformanceObserver(): void {
    try {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()

        for (const entry of entries) {
          if (entry.name.startsWith('mcp-tool-')) {
            const toolName = entry.name.replace('mcp-tool-', '')
            const existing = this.metrics.get(toolName) ?? []
            existing.push(entry.duration)

            // Keep only last 100 measurements for memory efficiency
            if (existing.length > 100) {
              existing.shift()
            }

            this.metrics.set(toolName, existing)
          }
        }
      })

      this.observer.observe({ entryTypes: ['measure'] })
    }
    catch (error) {
      logger.debug('Performance observer not available:', error)
    }
  }

  /**
   * Start performance measurement for a tool
   */
  startMeasurement(toolName: string): void {
    performance.mark(`${toolName}-start`)
  }

  /**
   * End performance measurement for a tool
   */
  endMeasurement(toolName: string): number {
    const endMark = `${toolName}-end`
    performance.mark(endMark)

    try {
      performance.measure(`mcp-tool-${toolName}`, `${toolName}-start`, endMark)

      // Clean up marks to prevent memory leaks
      performance.clearMarks(`${toolName}-start`)
      performance.clearMarks(endMark)

      // Return the duration from the most recent measurement
      const entries = performance.getEntriesByName(`mcp-tool-${toolName}`, 'measure')
      return entries[entries.length - 1]?.duration ?? 0
    }
    catch (error) {
      logger.debug(`Failed to measure performance for ${toolName}:`, error)
      return 0
    }
  }

  /**
   * Get performance statistics for a tool
   */
  getToolStats(toolName: string): {
    count: number
    average: number
    min: number
    max: number
    p95: number
  } | null {
    const measurements = this.metrics.get(toolName)
    if (!measurements || measurements.length === 0) {
      return null
    }

    const sorted = [...measurements].sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((acc, val) => acc + val, 0)
    const average = sum / count
    const min = sorted[0]
    const max = sorted[count - 1]
    const p95Index = Math.floor(count * 0.95)
    const p95 = sorted[p95Index] ?? max

    return {
      count,
      average,
      min: min ?? 0,
      max: max ?? 0,
      p95: p95 ?? 0,
    }
  }

  /**
   * Get all performance metrics
   */
  getAllStats(): Record<string, ReturnType<PerformanceMonitor['getToolStats']>> {
    const stats: Record<string, ReturnType<PerformanceMonitor['getToolStats']>> = {}

    for (const [toolName] of this.metrics) {
      stats[toolName] = this.getToolStats(toolName)
    }

    return stats
  }

  /**
   * Record error for performance tracking
   */
  recordError(toolName: string): void {
    // For now, we'll track errors as negative performance metrics
    // This allows error-aware performance monitoring
    const existing = this.metrics.get(`${toolName}-errors`) ?? []
    existing.push(-1) // Negative value to indicate error

    // Keep only last 100 error records
    if (existing.length > 100) {
      existing.shift()
    }

    this.metrics.set(`${toolName}-errors`, existing)
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear()
    performance.clearMeasures()
  }

  /**
   * Cleanup observer on shutdown
   */
  cleanup(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    this.clearMetrics()
  }
}

// Singleton performance monitor
export const performanceMonitor = new PerformanceMonitor()

/**
 * Enhanced resource monitoring using Node.js 22+ process APIs
 */
export class ResourceMonitor {
  private intervalId: NodeJS.Timeout | null = null
  private resourceHistory: Array<{
    timestamp: number
    memory: NodeJS.MemoryUsage
    cpu: number
    uptime: number
    activeHandles: number
    activeRequests: number
  }> = []

  constructor(private maxHistory: number = 100) {}

  /**
   * Start resource monitoring
   */
  start(intervalMs: number = 30000): void {
    if (this.intervalId) {
      return // Already running
    }

    this.intervalId = setInterval(() => {
      this.collectMetrics()
    }, intervalMs)

    // Initial collection
    this.collectMetrics()
  }

  /**
   * Stop resource monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Collect current resource metrics
   */
  private collectMetrics(): void {
    try {
      const memory = process.memoryUsage()
      const uptime = process.uptime()

      // Node.js 22+ process metrics
      // eslint-disable-next-line ts/no-explicit-any
      const activeHandles = (process as any)._getActiveHandles?.()?.length ?? 0
      // eslint-disable-next-line ts/no-explicit-any
      const activeRequests = (process as any)._getActiveRequests?.()?.length ?? 0

      // Approximate CPU usage (simplified)
      const startTime = process.hrtime.bigint()
      setImmediate(() => {
        const endTime = process.hrtime.bigint()
        const cpuTime = Number(endTime - startTime) / 1e6 // Convert to milliseconds

        this.resourceHistory.push({
          timestamp: Date.now(),
          memory,
          cpu: cpuTime,
          uptime,
          activeHandles,
          activeRequests,
        })

        // Maintain history size
        if (this.resourceHistory.length > this.maxHistory) {
          this.resourceHistory.shift()
        }
      })
    }
    catch (error) {
      logger.debug('Failed to collect resource metrics:', error)
    }
  }

  /**
   * Get current resource status
   */
  getCurrentStatus(): {
    memory: NodeJS.MemoryUsage
    uptime: number
    activeHandles: number
    activeRequests: number
    historicalData: Array<{
      timestamp: number
      memory: NodeJS.MemoryUsage
      cpu: number
      uptime: number
      activeHandles: number
      activeRequests: number
    }>
  } {
    const latest = this.resourceHistory[this.resourceHistory.length - 1]

    return {
      memory: latest?.memory ?? process.memoryUsage(),
      uptime: process.uptime(),
      activeHandles: latest?.activeHandles ?? 0,
      activeRequests: latest?.activeRequests ?? 0,
      historicalData: this.resourceHistory,
    }
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(): {
    memoryTrend: 'increasing' | 'stable' | 'decreasing'
    leakSuspected: boolean
    recommendation?: string
  } {
    if (this.resourceHistory.length < 5) {
      return { memoryTrend: 'stable', leakSuspected: false }
    }

    const recent = this.resourceHistory.slice(-5)
    const memoryValues = recent.map(r => r.memory.heapUsed)

    // Calculate trend
    const firstHalf = memoryValues.slice(0, 2).reduce((a, b) => a + b, 0) / 2
    const secondHalf = memoryValues.slice(-2).reduce((a, b) => a + b, 0) / 2

    const percentageIncrease = ((secondHalf - firstHalf) / firstHalf) * 100

    let memoryTrend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    let leakSuspected = false
    let recommendation: string | undefined

    if (percentageIncrease > 20) {
      memoryTrend = 'increasing'
      leakSuspected = percentageIncrease > 50
      if (leakSuspected) {
        recommendation = 'Memory usage increasing rapidly. Check for unclosed resources, large object accumulation, or circular references.'
      }
    }
    else if (percentageIncrease < -10) {
      memoryTrend = 'decreasing'
    }

    const result: {
      memoryTrend: 'increasing' | 'stable' | 'decreasing'
      leakSuspected: boolean
      recommendation?: string
    } = { memoryTrend, leakSuspected }

    if (recommendation !== undefined) {
      result.recommendation = recommendation
    }

    return result
  }
}

// Singleton resource monitor
export const resourceMonitor = new ResourceMonitor()

/**
 * Enhanced async utility using Node.js 22+ features
 */
export class AsyncUtils {
  /**
   * Create a race condition with timeout using AbortController
   */
  static async raceWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out',
  ): Promise<T> {
    const controller = new AbortController()

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        controller.abort()
        reject(new Error(timeoutMessage))
      }, timeoutMs)

      // Clean up timeout if the main promise resolves first
      promise.finally(() => clearTimeout(timeoutId))
    })

    return Promise.race([promise, timeoutPromise])
  }

  /**
   * Retry with exponential backoff and AbortController support
   */
  static async retryWithBackoff<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    options: {
      maxRetries?: number
      initialDelayMs?: number
      maxDelayMs?: number
      backoffMultiplier?: number
      abortSignal?: AbortSignal
    } = {},
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelayMs = 1000,
      maxDelayMs = 10000,
      backoffMultiplier = 2,
      abortSignal,
    } = options

    let lastError: Error | undefined
    let delayMs = initialDelayMs

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check if operation was aborted
        if (abortSignal?.aborted) {
          throw new Error('Operation aborted')
        }

        // Sequential retry attempts required by design
        // eslint-disable-next-line no-await-in-loop
        return await operation(abortSignal)
      }
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry if aborted or on final attempt
        if (abortSignal?.aborted || attempt === maxRetries) {
          break
        }

        // Wait before retrying
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          const timeoutId = setTimeout(resolve, delayMs)

          // Allow abort signal to interrupt delay
          const abortHandler = (): void => {
            clearTimeout(timeoutId)
            resolve(undefined)
          }
          abortSignal?.addEventListener('abort', abortHandler)
        })

        // Increase delay for next attempt
        delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs)
      }
    }

    throw lastError ?? new Error('Retry operation failed')
  }

  /**
   * Promisified setTimeout using Node.js 22+ timers/promises
   */
  static delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Delay aborted'))
        return
      }

      const timeoutId = setTimeout(resolve, ms)

      signal?.addEventListener('abort', () => {
        clearTimeout(timeoutId)
        reject(new Error('Delay aborted'))
      })
    })
  }
}

/**
 * Cleanup resources on process exit
 */
process.on('beforeExit', () => {
  performanceMonitor.cleanup()
  resourceMonitor.stop()
})

// Export utilities
export {
  AsyncUtils as nodeAsyncUtils,
  requestContext,
}

// Start resource monitoring by default in development
if (process.env.NODE_ENV === 'development' || process.env.ENABLE_RESOURCE_MONITORING === 'true') {
  resourceMonitor.start(30000) // Every 30 seconds
}
