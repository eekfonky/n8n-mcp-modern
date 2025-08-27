/**
 * MCP Performance Monitor
 *
 * Lightweight monitoring for MCP server performance:
 * - Tool call response times
 * - Discovery cache effectiveness
 * - n8n API connectivity health
 * - Memory usage (important for CLI tools)
 * - Error tracking for debugging
 */

import process from 'node:process'
import { logger } from '../server/logger.js'
import { createCleanObject } from '../utils/aggressive-memory-cleanup.js'

export interface McpPerformanceStats {
  toolCalls: {
    total: number
    successful: number
    averageResponseTime: number
    slowestCall: { tool: string, duration: number } | null
  }
  discovery: {
    cacheHitRatio: number
    nodeDiscoverySuccess: number
    nodeDiscoveryFailures: number
    lastDiscoveryTime: number | null
  }
  n8nConnectivity: {
    isConnected: boolean
    lastSuccessfulCall: number | null
    consecutiveFailures: number
    totalApiCalls: number
  }
  memory: {
    currentUsageMB: number
    peakUsageMB: number
    pressure: 'low' | 'medium' | 'high' | 'critical'
  }
  errors: {
    total: number
    byCategory: Record<string, number>
    recent: Array<{ timestamp: number, error: string, category: string }>
  }
}

export class McpPerformanceMonitor {
  private stats: McpPerformanceStats
  private startTime = Date.now()

  constructor() {
    this.stats = this.initializeStats()
    logger.debug('MCP performance monitor initialized')
  }

  private initializeStats(): McpPerformanceStats {
    return createCleanObject({
      toolCalls: {
        total: 0,
        successful: 0,
        averageResponseTime: 0,
        slowestCall: null,
      },
      discovery: {
        cacheHitRatio: 0,
        nodeDiscoverySuccess: 0,
        nodeDiscoveryFailures: 0,
        lastDiscoveryTime: null,
      },
      n8nConnectivity: {
        isConnected: false,
        lastSuccessfulCall: null,
        consecutiveFailures: 0,
        totalApiCalls: 0,
      },
      memory: {
        currentUsageMB: 0,
        peakUsageMB: 0,
        pressure: 'low',
      },
      errors: {
        total: 0,
        byCategory: {},
        recent: [],
      },
    })
  }

  /**
   * Record a tool call
   */
  recordToolCall(toolName: string, duration: number, success: boolean): void {
    this.stats.toolCalls.total++

    if (success) {
      this.stats.toolCalls.successful++
    }

    // Update average response time
    const totalTime = this.stats.toolCalls.averageResponseTime * (this.stats.toolCalls.total - 1) + duration
    this.stats.toolCalls.averageResponseTime = totalTime / this.stats.toolCalls.total

    // Track slowest call
    if (!this.stats.toolCalls.slowestCall || duration > this.stats.toolCalls.slowestCall.duration) {
      this.stats.toolCalls.slowestCall = { tool: toolName, duration }
    }

    // Log slow calls
    if (duration > 5000) {
      logger.warn(`Slow tool call detected: ${toolName} took ${duration}ms`)
    }
  }

  /**
   * Record discovery cache performance
   */
  recordCacheOperation(hit: boolean): void {
    const totalOps = this.stats.discovery.nodeDiscoverySuccess + this.stats.discovery.nodeDiscoveryFailures
    const hits = hit ? this.stats.discovery.nodeDiscoverySuccess + 1 : this.stats.discovery.nodeDiscoverySuccess

    if (hit) {
      this.stats.discovery.nodeDiscoverySuccess++
    }
    else {
      this.stats.discovery.nodeDiscoveryFailures++
    }

    this.stats.discovery.cacheHitRatio = hits / (totalOps + 1)
    this.stats.discovery.lastDiscoveryTime = Date.now()
  }

  /**
   * Record n8n API call
   */
  recordN8nApiCall(success: boolean): void {
    this.stats.n8nConnectivity.totalApiCalls++

    if (success) {
      this.stats.n8nConnectivity.isConnected = true
      this.stats.n8nConnectivity.lastSuccessfulCall = Date.now()
      this.stats.n8nConnectivity.consecutiveFailures = 0
    }
    else {
      this.stats.n8nConnectivity.consecutiveFailures++

      // Consider disconnected after 3 consecutive failures
      if (this.stats.n8nConnectivity.consecutiveFailures >= 3) {
        this.stats.n8nConnectivity.isConnected = false
      }
    }
  }

  /**
   * Record an error
   */
  recordError(error: string, category: string = 'general'): void {
    this.stats.errors.total++

    // Update category count
    this.stats.errors.byCategory[category] = (this.stats.errors.byCategory[category] || 0) + 1

    // Add to recent errors (keep last 10)
    this.stats.errors.recent.push({
      timestamp: Date.now(),
      error: error.slice(0, 200), // Limit error message length
      category,
    })

    if (this.stats.errors.recent.length > 10) {
      this.stats.errors.recent = this.stats.errors.recent.slice(-10)
    }

    logger.debug(`Error recorded: [${category}] ${error}`)
  }

  /**
   * Update memory statistics
   */
  updateMemoryStats(): void {
    const memory = process.memoryUsage()
    const currentMB = memory.heapUsed / 1024 / 1024

    this.stats.memory.currentUsageMB = currentMB
    this.stats.memory.peakUsageMB = Math.max(this.stats.memory.peakUsageMB, currentMB)

    // Update pressure based on current usage
    if (currentMB > 200) {
      this.stats.memory.pressure = 'critical'
    }
    else if (currentMB > 100) {
      this.stats.memory.pressure = 'high'
    }
    else if (currentMB > 50) {
      this.stats.memory.pressure = 'medium'
    }
    else {
      this.stats.memory.pressure = 'low'
    }
  }

  /**
   * Get current performance stats
   */
  getStats(): McpPerformanceStats {
    this.updateMemoryStats()
    return { ...this.stats }
  }

  /**
   * Get a simple health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    uptime: string
  } {
    const issues: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    // Check various health indicators
    if (!this.stats.n8nConnectivity.isConnected) {
      issues.push('n8n API connectivity lost')
      status = 'critical'
    }

    if (this.stats.memory.pressure === 'critical') {
      issues.push(`Critical memory usage: ${this.stats.memory.currentUsageMB.toFixed(1)}MB`)
      status = 'critical'
    }
    else if (this.stats.memory.pressure === 'high') {
      issues.push(`High memory usage: ${this.stats.memory.currentUsageMB.toFixed(1)}MB`)
      if (status !== 'critical')
        status = 'warning'
    }

    if (this.stats.toolCalls.total > 0) {
      const successRate = this.stats.toolCalls.successful / this.stats.toolCalls.total
      if (successRate < 0.8) {
        issues.push(`Low success rate: ${(successRate * 100).toFixed(1)}%`)
        if (status !== 'critical')
          status = 'warning'
      }
    }

    if (this.stats.toolCalls.averageResponseTime > 3000) {
      issues.push(`Slow average response time: ${this.stats.toolCalls.averageResponseTime.toFixed(0)}ms`)
      if (status !== 'critical')
        status = 'warning'
    }

    if (this.stats.discovery.cacheHitRatio < 0.5 && this.stats.discovery.nodeDiscoverySuccess > 10) {
      issues.push(`Low cache hit ratio: ${(this.stats.discovery.cacheHitRatio * 100).toFixed(1)}%`)
      if (status !== 'critical')
        status = 'warning'
    }

    const uptime = Date.now() - this.startTime
    const uptimeStr = `${Math.floor(uptime / 60000)}m ${Math.floor((uptime % 60000) / 1000)}s`

    return createCleanObject({
      status,
      issues,
      uptime: uptimeStr,
    })
  }

  /**
   * Get simple performance summary for logging
   */
  getPerformanceSummary(): string {
    const stats = this.getStats()
    const health = this.getHealthStatus()

    const successRate = stats.toolCalls.total > 0
      ? (stats.toolCalls.successful / stats.toolCalls.total * 100).toFixed(1)
      : '0'

    return [
      `Status: ${health.status}`,
      `Uptime: ${health.uptime}`,
      `Tools: ${stats.toolCalls.total} calls (${successRate}% success)`,
      `Memory: ${stats.memory.currentUsageMB.toFixed(1)}MB (${stats.memory.pressure})`,
      `n8n: ${stats.n8nConnectivity.isConnected ? 'connected' : 'disconnected'}`,
      `Cache: ${(stats.discovery.cacheHitRatio * 100).toFixed(1)}% hit rate`,
    ].join(' | ')
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = this.initializeStats()
    this.startTime = Date.now()
    logger.info('MCP performance monitor reset')
  }
}

// Global instance
export const mcpMonitor = new McpPerformanceMonitor()
