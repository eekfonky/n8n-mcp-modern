/**
 * Workflow Size Limiter
 * Prevents buffer overflow and memory issues with large workflows
 */

import { logger } from './logger.js'

export interface WorkflowSizeMetrics {
  nodeCount: number
  connectionCount: number
  jsonSize: number
  estimatedMemory: number
  exceedsStdioLimit: boolean
  exceedsMemoryLimit: boolean
}

export class WorkflowSizeLimiter {
  // Typical stdio buffer limit (10MB)
  private readonly STDIO_BUFFER_LIMIT = 10 * 1024 * 1024

  // Maximum safe workflow size (50MB)
  private readonly MAX_WORKFLOW_SIZE = 50 * 1024 * 1024

  // Maximum safe node count
  private readonly MAX_NODE_COUNT = 500

  // Maximum memory usage (500MB)
  private readonly MAX_MEMORY_USAGE = 500 * 1024 * 1024

  /**
   * Check if workflow size is safe
   */
  checkWorkflowSize(workflow: unknown): WorkflowSizeMetrics {
    // Type-safe workflow access
    const workflowObj = workflow as Record<string, unknown>
    const nodes = Array.isArray(workflowObj.nodes) ? workflowObj.nodes : []
    const connections = workflowObj.connections && typeof workflowObj.connections === 'object' ? workflowObj.connections : {}

    const nodeCount = nodes.length
    const connectionCount = Object.keys(connections).length
    const jsonString = JSON.stringify(workflow)
    const jsonSize = jsonString.length
    const estimatedMemory = jsonSize * 2 // Rough estimate (UTF-16 in memory)

    const metrics: WorkflowSizeMetrics = {
      nodeCount,
      connectionCount,
      jsonSize,
      estimatedMemory,
      exceedsStdioLimit: jsonSize > this.STDIO_BUFFER_LIMIT,
      exceedsMemoryLimit: estimatedMemory > this.MAX_MEMORY_USAGE,
    }

    // Log warnings
    if (metrics.exceedsStdioLimit) {
      logger.warn('Workflow exceeds stdio buffer limit', {
        size: jsonSize,
        limit: this.STDIO_BUFFER_LIMIT,
        nodeCount,
      })
    }

    if (metrics.exceedsMemoryLimit) {
      logger.error('Workflow exceeds memory limit', {
        estimatedMemory,
        limit: this.MAX_MEMORY_USAGE,
        nodeCount,
      })
    }

    if (nodeCount > this.MAX_NODE_COUNT) {
      logger.warn('Workflow has excessive node count', {
        nodeCount,
        limit: this.MAX_NODE_COUNT,
      })
    }

    return metrics
  }

  /**
   * Stream large workflow in chunks
   */
  async* streamWorkflow(workflow: unknown, chunkSize = 1024 * 1024): AsyncGenerator<string> {
    const jsonString = JSON.stringify(workflow)

    for (let i = 0; i < jsonString.length; i += chunkSize) {
      yield jsonString.slice(i, i + chunkSize)
    }
  }

  /**
   * Validate workflow can be safely processed
   */
  canProcessWorkflow(workflow: unknown): boolean {
    const metrics = this.checkWorkflowSize(workflow)

    // Reject if exceeds hard limits
    if (metrics.jsonSize > this.MAX_WORKFLOW_SIZE) {
      return false
    }

    if (metrics.nodeCount > this.MAX_NODE_COUNT * 2) {
      return false
    }

    return true
  }
}

export const workflowSizeLimiter = new WorkflowSizeLimiter()
