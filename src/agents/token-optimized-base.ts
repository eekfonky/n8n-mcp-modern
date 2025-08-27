/**
 * Token-Optimized Hierarchical Agent Base
 * Extends existing 6-agent system with efficient sub-agent reporters
 */

import { logger } from '../server/logger.js'

/**
 * Simple complexity analysis for token routing
 */
export function isSimpleQuery(request: string | Record<string, unknown>): boolean {
  const text = typeof request === 'string'
    ? request
    : String(request?.query || request?.description || '').toLowerCase()

  // High reasoning triggers (route to core agent)
  const reasoningTriggers = [
    'analyze',
    'design',
    'plan',
    'optimize',
    'strategy',
    'architect',
    'build',
    'create',
    'implement',
    'solve',
    'troubleshoot',
    'debug',
  ]

  // Simple reporting triggers (route to reporter)
  const reportingTriggers = [
    'get',
    'list',
    'show',
    'status',
    'check',
    'display',
    'current',
    'summary',
    'count',
    'health',
    'available',
    'installed',
  ]

  // Check for reasoning needs first
  if (reasoningTriggers.some(trigger => text.includes(trigger))) {
    return false // Needs high reasoning
  }

  // Check for simple reporting
  if (reportingTriggers.some(trigger => text.includes(trigger))) {
    return true // Can use reporter
  }

  // Default to high reasoning for safety
  return false
}

/**
 * Base class for reporter sub-agents
 * Handles simple data retrieval without reasoning
 */
export abstract class ReporterBase {
  constructor(
    protected agentName: string,
    protected database?: unknown,
  ) {}

  /**
   * Handle simple reporting requests
   */
  abstract report(request: Record<string, unknown>): Promise<Record<string, unknown>>

  /**
   * Common helper for simple status responses
   */
  protected createSimpleResponse(data: Record<string, unknown>, type: string = 'simple_report'): Record<string, unknown> {
    return {
      ...data,
      model_used: 'haiku',
      response_type: type,
      estimated_tokens_used: 'minimal',
      agent: this.agentName,
    }
  }

  /**
   * Log token savings
   */
  protected logTokenSaving(requestType: string): void {
    logger.debug(`Token optimization: ${requestType} routed to ${this.agentName} (Haiku)`)
  }
}

/**
 * Base class for token-optimized hierarchical agents
 * Extends existing agents with reporter sub-agents
 */
export abstract class TokenOptimizedAgent {
  protected reporter: ReporterBase

  constructor(
    protected agentId: string,
    reporter: ReporterBase,
  ) {
    this.reporter = reporter
  }

  /**
   * Smart routing between core agent and reporter
   */
  async handleRequest(request: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (isSimpleQuery(request)) {
      logger.debug(`Routing simple query to ${this.agentId}-reporter`)
      return await this.reporter.report(request)
    }
    else {
      logger.debug(`Routing complex task to ${this.agentId} core`)
      return await this.handleComplexTask(request)
    }
  }

  /**
   * Core agent handles complex reasoning (existing functionality)
   */
  abstract handleComplexTask(request: Record<string, unknown>): Promise<Record<string, unknown>>
}
