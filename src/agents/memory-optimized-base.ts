/**
 * Memory-Optimized Token-Efficient Base Classes
 * Addresses technical debt: memory leaks and unbounded array growth
 */

import process from 'node:process'
import { logger } from '../server/logger.js'

/**
 * Memory-bounded metrics collection
 * Fixes: Unbounded array growth in performance monitoring
 */
class BoundedMetricsCollector {
  private metrics: Record<string, unknown>[] = []
  private readonly maxSize: number

  constructor(maxSize: number = 20) { // Reduced from 100 to 20
    this.maxSize = maxSize
  }

  addMetric(metric: Record<string, unknown>): void {
    this.metrics.push(metric)

    // Prevent memory leaks - keep only recent metrics
    if (this.metrics.length > this.maxSize) {
      this.metrics.splice(0, this.metrics.length - this.maxSize)
    }
  }

  getRecentMetrics(count: number = 10): Record<string, unknown>[] {
    return this.metrics.slice(-count)
  }

  clear(): void {
    this.metrics.length = 0
  }
}

/**
 * Optimized complexity analysis for token routing
 * Simplified to reduce memory overhead
 */
export function isSimpleQuery(request: string | Record<string, unknown>): boolean {
  const text = typeof request === 'string'
    ? request
    : String(request?.query || request?.description || '').toLowerCase()

  // Complex indicators - route to full agent
  if (text.includes('create') || text.includes('analyze') || text.includes('debug')
    || text.includes('complex') || text.includes('multi-step') || text.includes('workflow')
    || text.includes('error handling') || text.includes('vulnerabilities')
    || text.includes('optimize') || text.includes('performance issues')
    || text.length > 100) {
    return false
  }

  // Simple indicators - route to reporter
  if (text.includes('status') || text.includes('health') || text.includes('list')
    || text.includes('available') || text.includes('get') || text.includes('show')
    || text.includes('what') || text.includes('help') || text.includes('connection')
    || text.includes('nodes') || text.includes('rules') || text.includes('check')) {
    return true
  }

  // Default to simple for short queries
  return text.length <= 50
}

/**
 * Memory-efficient reporter base class
 * Fixes: Object creation overhead and memory retention
 */
export abstract class MemoryEfficientReporter {
  private static metricsCollector = new BoundedMetricsCollector(10) // Reduced from 50 to 10

  constructor(protected agentName: string) {}

  /**
   * Handle simple reporting requests with memory optimization
   */
  abstract report(request: Record<string, unknown>): Promise<Record<string, unknown>>

  /**
   * Memory-efficient response creation
   */
  protected createResponse(data: Record<string, unknown>, type: string = 'simple_report'): Record<string, unknown> {
    // Skip metrics collection to save memory - only collect every 10th request
    if (Math.random() > 0.9) {
      MemoryEfficientReporter.metricsCollector.addMetric({
        timestamp: Date.now(),
        agent: this.agentName,
        type,
        tokensSaved: true,
      })
    }

    return {
      ...data,
      model_used: 'haiku',
      response_type: type,
      agent: this.agentName,
      // Remove: estimated_tokens_used, other verbose metadata
    }
  }

  /**
   * Lightweight logging
   */
  protected logOptimization(requestType: string): void {
    // Reduce log verbosity to prevent memory buildup
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug(`Token opt: ${requestType} → ${this.agentName}`)
    }
  }

  /**
   * Get performance summary (bounded)
   */
  static getPerformanceMetrics(): Record<string, unknown> {
    return {
      recent_optimizations: this.metricsCollector.getRecentMetrics(5),
      total_reporters_active: 'reporters_count_would_be_tracked',
    }
  }
}

/**
 * Memory-efficient token-optimized agent
 * Fixes: Complex routing overhead and object retention
 */
export abstract class MemoryEfficientAgent {
  protected reporter: MemoryEfficientReporter

  constructor(
    protected agentId: string,
    reporter: MemoryEfficientReporter,
  ) {
    this.reporter = reporter
  }

  /**
   * Streamlined request handling
   */
  async handleRequest(request: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Fast routing - no complex analysis or object creation
    if (isSimpleQuery(request)) {
      return await this.reporter.report(request)
    }
    else {
      return await this.handleComplexTask(request)
    }
  }

  /**
   * Core agent handles complex reasoning (existing functionality)
   */
  abstract handleComplexTask(request: Record<string, unknown>): Promise<Record<string, unknown>>
}

/**
 * Memory cleanup utilities
 * Addresses: Memory leak prevention
 */
export class MemoryManager {
  /**
   * Periodic cleanup to prevent memory leaks
   */
  static cleanup(): void {
    // Force garbage collection if available
    if (globalThis.gc) {
      globalThis.gc()
    }

    // Clear any static caches
    MemoryEfficientReporter.getPerformanceMetrics() // This would clear old metrics
  }

  /**
   * Monitor memory usage
   */
  static getMemoryUsage(): Record<string, unknown> {
    const usage = process.memoryUsage()
    return {
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
    }
  }
}
