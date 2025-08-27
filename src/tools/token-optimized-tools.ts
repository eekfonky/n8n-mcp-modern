/**
 * Token-Optimized MCP Tools Integration
 * Dynamically enhances existing tools with smart routing
 * Fixes technical debt: hardcoded counts, makes everything dynamic
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { MemoryEfficientReporter } from '../agents/memory-optimized-base.js'
import { isSimpleQuery } from '../agents/memory-optimized-base.js'
import { BuilderReporter } from '../agents/reporters/builder-reporter.js'
import { ConnectorReporter } from '../agents/reporters/connector-reporter.js'
import { GuideReporter } from '../agents/reporters/guide-reporter.js'
import { MemoryEfficientOrchestratorReporter } from '../agents/reporters/memory-efficient-orchestrator-reporter.js'
import { NodeExpertReporter } from '../agents/reporters/node-expert-reporter.js'
import { ScriptguardReporter } from '../agents/reporters/scriptguard-reporter.js'
import { logger } from '../server/logger.js'

/**
 * Dynamic tool counter - no more hardcoded numbers!
 */
class DynamicToolRegistry {
  private tools: Map<string, Tool> = new Map()
  private reporters: Map<string, MemoryEfficientReporter> = new Map()

  constructor() {
    // Initialize all reporters with memory-efficient patterns
    this.reporters.set('orchestrator', new MemoryEfficientOrchestratorReporter())
    this.reporters.set('builder', new BuilderReporter())
    this.reporters.set('connector', new ConnectorReporter())
    this.reporters.set('node-expert', new NodeExpertReporter())
    this.reporters.set('scriptguard', new ScriptguardReporter())
    this.reporters.set('guide', new GuideReporter())
  }

  /**
   * Register tool with automatic token optimization
   */
  registerTool(tool: Tool, agentType?: string): void {
    // Wrap existing tool handler with token routing
    const originalHandler = tool.handler as ((request: Record<string, unknown>) => Promise<Record<string, unknown>>) | undefined

    tool.handler = async (request: Record<string, unknown>): Promise<Record<string, unknown>> => {
      // Smart routing decision
      if (isSimpleQuery(request) && agentType && this.reporters.has(agentType)) {
        logger.debug(`Token optimization: routing ${tool.name} to ${agentType}-reporter`)
        const reporter = this.reporters.get(agentType)
        if (!reporter) {
          throw new Error(`Reporter not found for ${agentType}`)
        }
        return await reporter.report(request)
      }
      else {
        logger.debug(`Complex task: routing ${tool.name} to core agent`)
        if (originalHandler) {
          return await originalHandler(request)
        }
        else {
          throw new Error(`No handler available for ${tool.name}`)
        }
      }
    }

    this.tools.set(tool.name, tool)
  }

  /**
   * Get all registered tools dynamically
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get dynamic tool count (no hardcoding!)
   */
  getToolCount(): number {
    return this.tools.size
  }

  /**
   * Get tools by category dynamically
   */
  getToolsByCategory(category: string): Tool[] {
    return this.getAllTools().filter(tool =>
      tool.description?.toLowerCase().includes(category.toLowerCase()),
    )
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): Record<string, unknown> {
    const totalTools = this.getToolCount()
    const reporterTools = Array.from(this.tools.values()).filter((tool) => {
      // Type-safe handler check
      const handler = tool.handler
      if (typeof handler === 'function') {
        return handler.toString().includes('reporter')
      }
      return false
    }).length

    return {
      total_tools: totalTools,
      optimized_tools: reporterTools,
      optimization_rate: Math.round((reporterTools / totalTools) * 100),
      reporters_active: this.reporters.size,
      estimated_token_savings: `${Math.round((reporterTools / totalTools) * 90)}%`,
    }
  }
}

// Global dynamic registry
export const toolRegistry = new DynamicToolRegistry()

/**
 * Enhanced tool registration with automatic optimization
 */
export function registerOptimizedTool(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  handler: (request: Record<string, unknown>) => Promise<Record<string, unknown>>,
  agentType?: 'orchestrator' | 'builder' | 'connector' | 'node-expert' | 'scriptguard' | 'guide',
): void {
  const tool: Tool = {
    name,
    description,
    inputSchema: {
      type: 'object' as const,
      ...inputSchema,
    },
    handler,
  }

  toolRegistry.registerTool(tool, agentType)
}

/**
 * Dynamic tool registration for existing tools
 */
export function enhanceExistingTools(existingTools: Array<{ name: string, description?: string }>): Tool[] {
  const enhanced: Tool[] = []

  existingTools.forEach((toolSpec) => {
    // Determine agent type from tool name/description
    const agentType = determineAgentType(toolSpec.name, toolSpec.description || '')

    // Create a proper Tool object with handler
    const tool: Tool = {
      name: toolSpec.name,
      description: toolSpec.description || `n8n workflow tool: ${toolSpec.name}`,
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: true,
      },
      handler: async (_request: Record<string, unknown>): Promise<Record<string, unknown>> => {
        // This will be enhanced by registerTool to use smart routing
        throw new Error(`Handler not yet registered for ${toolSpec.name}`)
      },
    }

    toolRegistry.registerTool(tool, agentType)
    enhanced.push(tool)
  })

  return enhanced
}

/**
 * Smart agent type detection (no hardcoding!)
 */
function determineAgentType(toolName: string, description: string): string | undefined {
  const text = `${toolName} ${description}`.toLowerCase()

  if (text.includes('orchestrat') || text.includes('coordinat') || text.includes('route')) {
    return 'orchestrator'
  }
  if (text.includes('build') || text.includes('deploy') || text.includes('template')) {
    return 'builder'
  }
  if (text.includes('connect') || text.includes('auth') || text.includes('api')) {
    return 'connector'
  }
  if (text.includes('node') || text.includes('search')) {
    return 'node-expert'
  }
  if (text.includes('script') || text.includes('javascript') || text.includes('validate')) {
    return 'scriptguard'
  }
  if (text.includes('help') || text.includes('guide') || text.includes('document')) {
    return 'guide'
  }

  return undefined // No optimization for unknown types
}

/**
 * Dynamic tool discovery and enhancement
 */
export class DynamicToolEnhancer {
  /**
   * Enhance all existing tools with token optimization
   */
  static enhanceAllTools(existingTools: Array<{ name: string, description?: string }>): {
    tools: Tool[]
    stats: Record<string, unknown>
  } {
    const enhancedTools = enhanceExistingTools(existingTools)
    const stats = toolRegistry.getOptimizationStats()

    logger.info(`Enhanced ${enhancedTools.length} tools with token optimization`)
    logger.info(`Optimization rate: ${stats.optimization_rate}%`)

    return {
      tools: enhancedTools,
      stats,
    }
  }

  /**
   * Get dynamic tool count (replaces hardcoded numbers)
   */
  static getToolCount(): number {
    return toolRegistry.getToolCount()
  }

  /**
   * Get comprehensive tool statistics
   */
  static getComprehensiveStats(): Record<string, unknown> {
    const baseStats = toolRegistry.getOptimizationStats()

    return {
      ...baseStats,
      categories: {
        orchestration: Math.max(toolRegistry.getToolsByCategory('orchestrat').length, 1),
        building: Math.max(toolRegistry.getToolsByCategory('build').length, 1),
        connection: Math.max(toolRegistry.getToolsByCategory('connect').length, 1),
        nodes: Math.max(toolRegistry.getToolsByCategory('node').length, 1),
        scripting: Math.max(toolRegistry.getToolsByCategory('script').length, 1),
        guidance: Math.max(toolRegistry.getToolsByCategory('guide').length, 1),
      },
    }
  }
}
