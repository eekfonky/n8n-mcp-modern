/**
 * Lightweight Agent Routing System
 *
 * Simplified alternative to complex intelligence-driven routing.
 * Fast, efficient, and maintainable agent selection based on simple patterns.
 *
 * Philosophy: Simple rules > Complex analysis for 90% of use cases
 */

import { featureFlags, isIntelligenceEnabled } from './feature-flags.js'
import { logger } from './logger.js'

// === Lightweight Agent Types ===

export interface SimpleAgent {
  name: string
  tier: number
  capabilities: string[]
  specializes: string[]
  fallback?: string
}

export interface SimpleRoutingContext {
  toolName: string
  userIntent?: string
  complexity?: 'low' | 'medium' | 'high'
  requiresAuth?: boolean
  requiresGovernance?: boolean
}

export interface RoutingResult {
  agent: SimpleAgent
  reasoning: string
  confidence: number
  fallbackAgent?: string
  estimatedDuration?: number
}

// === Agent Definitions (simplified from complex system) ===

const LIGHTWEIGHT_AGENTS: Record<string, SimpleAgent> = {
  // Tier 1: Master orchestrator for complex scenarios
  'n8n-orchestrator': {
    name: 'n8n-orchestrator',
    tier: 1,
    capabilities: ['coordination', 'governance', 'complex-workflows', 'handover-management'],
    specializes: ['complex-analysis', 'multi-agent-coordination', 'strategic-planning'],
    fallback: 'n8n-guide',
  },

  // Tier 2: Core specialists
  'n8n-builder': {
    name: 'n8n-builder',
    tier: 2,
    capabilities: ['workflow-creation', 'code-generation', 'template-implementation'],
    specializes: ['workflow-building', 'automation-creation', 'rapid-development'],
    fallback: 'n8n-orchestrator',
  },

  'n8n-connector': {
    name: 'n8n-connector',
    tier: 2,
    capabilities: ['authentication', 'api-integration', 'connectivity'],
    specializes: ['oauth-setup', 'api-connections', 'credential-management'],
    fallback: 'n8n-orchestrator',
  },

  'n8n-node-expert': {
    name: 'n8n-node-expert',
    tier: 2,
    capabilities: ['node-recommendations', 'node-configuration', 'troubleshooting'],
    specializes: ['node-expertise', 'configuration-help', 'best-practices'],
    fallback: 'n8n-guide',
  },

  'n8n-scriptguard': {
    name: 'n8n-scriptguard',
    tier: 2,
    capabilities: ['code-validation', 'security-review', 'javascript-optimization'],
    specializes: ['code-security', 'script-validation', 'performance-optimization'],
    fallback: 'n8n-builder',
  },

  // Tier 3: Support specialist
  'n8n-guide': {
    name: 'n8n-guide',
    tier: 3,
    capabilities: ['documentation', 'tutorials', 'general-help'],
    specializes: ['guidance', 'tutorials', 'general-support'],
    fallback: 'n8n-orchestrator',
  },
} as const

// === Tool-to-Agent Mapping (fast lookup) ===

const TOOL_AGENT_MAPPING: Record<string, string> = {
  // Workflow operations → Builder
  create_n8n_workflow: 'n8n-builder',
  n8n_import_workflow: 'n8n-builder',
  get_n8n_workflow: 'n8n-builder',

  // Node operations → Node Expert
  search_n8n_nodes: 'n8n-node-expert',

  // Execution & stats → Builder or Orchestrator
  execute_n8n_workflow: 'n8n-builder',
  get_workflow_stats: 'n8n-builder',
  get_n8n_executions: 'n8n-builder',

  // Authentication → Connector
  activate_n8n_workflow: 'n8n-connector',
  deactivate_n8n_workflow: 'n8n-connector',

  // General operations → Guide
  get_n8n_workflows: 'n8n-guide',
  list_available_tools: 'n8n-guide',
  get_tool_usage_stats: 'n8n-guide',
  validate_mcp_config: 'n8n-guide',
} as const

// === Lightweight Router Implementation ===

export class LightweightRouter {
  private static instance: LightweightRouter
  private performanceMetrics = {
    routingTimes: [] as number[],
    totalRoutes: 0,
    fallbackRoutes: 0,
  }

  private constructor() {}

  static getInstance(): LightweightRouter {
    if (!this.instance) {
      this.instance = new LightweightRouter()
    }
    return this.instance
  }

  /**
   * Route tool to appropriate agent (fast, simple routing)
   */
  routeTool(toolName: string, context?: SimpleRoutingContext): RoutingResult {
    const startTime = performance.now()

    // If complex intelligence is enabled, skip lightweight routing
    if (isIntelligenceEnabled()) {
      return this.createDeferredResult('Intelligence system active')
    }

    let result: RoutingResult

    try {
      // Step 1: Direct tool mapping (fastest path)
      const directAgent = TOOL_AGENT_MAPPING[toolName]
      const agent = directAgent ? LIGHTWEIGHT_AGENTS[directAgent] : undefined
      if (agent) {
        result = {
          agent,
          reasoning: `Direct mapping for ${toolName}`,
          confidence: 0.9,
          estimatedDuration: 5000, // 5 seconds estimate
        }
      }
      else {
        // Step 2: Pattern-based routing (fallback)
        result = this.routeByPattern(toolName, context)
      }

      // Step 3: Apply context adjustments
      if (context) {
        result = this.applyContextAdjustments(result, context)
      }
    }
    catch (error) {
      logger.warn('Lightweight routing failed, using fallback', { toolName, error })
      result = this.createFallbackResult(toolName)
    }

    // Record performance metrics
    const routingTime = performance.now() - startTime
    this.recordMetrics(routingTime, result.agent.name === 'n8n-orchestrator')

    logger.debug('Lightweight routing completed', {
      toolName,
      selectedAgent: result.agent.name,
      confidence: result.confidence,
      routingTime: `${routingTime.toFixed(2)}ms`,
      reasoning: result.reasoning,
    })

    return result
  }

  /**
   * Pattern-based routing for unmapped tools
   */
  private routeByPattern(toolName: string, _context?: SimpleRoutingContext): RoutingResult {
    // Workflow-related patterns
    if (toolName.includes('workflow') || toolName.includes('execute')) {
      const agent = LIGHTWEIGHT_AGENTS['n8n-builder']
      if (!agent)
        throw new Error('n8n-builder agent not found')
      return {
        agent,
        reasoning: 'Workflow-related operation',
        confidence: 0.8,
        estimatedDuration: 10000,
      }
    }

    // Node-related patterns
    if (toolName.includes('node') || toolName.includes('search')) {
      const agent = LIGHTWEIGHT_AGENTS['n8n-node-expert']
      if (!agent)
        throw new Error('n8n-node-expert agent not found')
      return {
        agent,
        reasoning: 'Node-related operation',
        confidence: 0.8,
        estimatedDuration: 3000,
      }
    }

    // Authentication/activation patterns
    if (toolName.includes('activate') || toolName.includes('auth') || toolName.includes('credential')) {
      const agent = LIGHTWEIGHT_AGENTS['n8n-connector']
      if (!agent)
        throw new Error('n8n-connector agent not found')
      return {
        agent,
        reasoning: 'Authentication/connection operation',
        confidence: 0.8,
        estimatedDuration: 8000,
      }
    }

    // Code/validation patterns
    if (toolName.includes('code') || toolName.includes('script') || toolName.includes('validate')) {
      const agent = LIGHTWEIGHT_AGENTS['n8n-scriptguard']
      if (!agent)
        throw new Error('n8n-scriptguard agent not found')
      return {
        agent,
        reasoning: 'Code/validation operation',
        confidence: 0.7,
        estimatedDuration: 6000,
      }
    }

    // Default: Route to guide for general help
    const agent = LIGHTWEIGHT_AGENTS['n8n-guide']
    if (!agent)
      throw new Error('n8n-guide agent not found')
    return {
      agent,
      reasoning: 'General operation, using guide',
      confidence: 0.6,
      estimatedDuration: 4000,
      fallbackAgent: 'n8n-orchestrator',
    }
  }

  /**
   * Apply context-based adjustments to routing decision
   */
  private applyContextAdjustments(result: RoutingResult, context: SimpleRoutingContext): RoutingResult {
    let adjustedResult = { ...result }

    // High complexity → Orchestrator
    if (context.complexity === 'high' || context.requiresGovernance) {
      const orchestrator = LIGHTWEIGHT_AGENTS['n8n-orchestrator']
      if (!orchestrator)
        throw new Error('n8n-orchestrator agent not found')
      adjustedResult = {
        ...adjustedResult,
        agent: orchestrator,
        reasoning: `${result.reasoning} + escalated due to complexity/governance`,
        confidence: Math.max(result.confidence, 0.8),
        estimatedDuration: (result.estimatedDuration || 5000) * 1.5,
      }
    }

    // Authentication required → Ensure connector involvement
    if (context.requiresAuth && result.agent.name !== 'n8n-connector') {
      adjustedResult = {
        ...adjustedResult,
        fallbackAgent: 'n8n-connector',
        reasoning: `${result.reasoning} + auth support from connector`,
        estimatedDuration: (result.estimatedDuration || 5000) * 1.2,
      }
    }

    return adjustedResult
  }

  /**
   * Create fallback result for error scenarios
   */
  private createFallbackResult(toolName: string): RoutingResult {
    const orchestrator = LIGHTWEIGHT_AGENTS['n8n-orchestrator']
    if (!orchestrator)
      throw new Error('n8n-orchestrator agent not found')
    return {
      agent: orchestrator,
      reasoning: `Fallback to orchestrator for ${toolName}`,
      confidence: 0.5,
      estimatedDuration: 10000,
      fallbackAgent: 'n8n-guide',
    }
  }

  /**
   * Create deferred result when intelligence system is active
   */
  private createDeferredResult(reason: string): RoutingResult {
    const orchestrator = LIGHTWEIGHT_AGENTS['n8n-orchestrator']
    if (!orchestrator)
      throw new Error('n8n-orchestrator agent not found')
    return {
      agent: orchestrator,
      reasoning: reason,
      confidence: 1.0,
      estimatedDuration: 2000,
    }
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(routingTime: number, wasFallback: boolean): void {
    this.performanceMetrics.routingTimes.push(routingTime)
    this.performanceMetrics.totalRoutes++

    if (wasFallback) {
      this.performanceMetrics.fallbackRoutes++
    }

    // Maintain bounded arrays for memory efficiency
    if (featureFlags.performance.limitMetricsArrays && this.performanceMetrics.routingTimes.length > 100) {
      this.performanceMetrics.routingTimes = this.performanceMetrics.routingTimes.slice(-100)
    }
  }

  /**
   * Get all available agents
   */
  getAllAgents(): SimpleAgent[] {
    return Object.values(LIGHTWEIGHT_AGENTS)
  }

  /**
   * Get routing performance metrics
   */
  getMetrics(): {
    averageRoutingTime: number
    totalRoutes: number
    fallbackRate: number
    efficiency: number
  } {
    const avgTime = this.performanceMetrics.routingTimes.length > 0
      ? this.performanceMetrics.routingTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.routingTimes.length
      : 0

    const fallbackRate = this.performanceMetrics.totalRoutes > 0
      ? this.performanceMetrics.fallbackRoutes / this.performanceMetrics.totalRoutes
      : 0

    return {
      averageRoutingTime: avgTime,
      totalRoutes: this.performanceMetrics.totalRoutes,
      fallbackRate,
      efficiency: 1 - fallbackRate, // Higher is better
    }
  }

  /**
   * Benchmark against complex routing system
   */
  async benchmark(toolName: string, iterations = 10): Promise<{
    lightweight: { avgTime: number, results: RoutingResult[] }
    complex?: { avgTime: number, results: any[] }
  }> {
    const results: RoutingResult[] = []
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const result = this.routeTool(toolName)
      results.push(result)
    }

    const totalTime = performance.now() - startTime
    const avgTime = totalTime / iterations

    logger.debug('Lightweight routing benchmark completed', {
      toolName,
      iterations,
      avgTime: `${avgTime.toFixed(2)}ms`,
      totalTime: `${totalTime.toFixed(2)}ms`,
    })

    return {
      lightweight: {
        avgTime,
        results,
      },
    }
  }
}

// === Factory Functions ===

/**
 * Create lightweight routing context
 */
export function createRoutingContext(
  toolName: string,
  options: {
    complexity?: SimpleRoutingContext['complexity']
    requiresAuth?: boolean
    requiresGovernance?: boolean
    userIntent?: string
  } = {},
): SimpleRoutingContext {
  return {
    toolName,
    ...(options.userIntent !== undefined && { userIntent: options.userIntent }),
    ...(options.complexity !== undefined && { complexity: options.complexity }),
    ...(options.requiresAuth !== undefined && { requiresAuth: options.requiresAuth }),
    ...(options.requiresGovernance !== undefined && { requiresGovernance: options.requiresGovernance }),
  }
}

/**
 * Get lightweight agent recommendation
 */
export function getAgentRecommendation(toolName: string): RoutingResult {
  const router = LightweightRouter.getInstance()
  return router.routeTool(toolName)
}

// Default export
export default LightweightRouter
