/**
 * Agent Tool Handler
 *
 * This module provides a unified handler for agents to access MCP tools
 * when they are spawned through the Task tool. It acts as a bridge between
 * the agent execution context and the MCP tool system.
 */

import { logger } from '../server/logger.js'
import { agentToolExecutor, mcpToolProxy } from './mcp-bridge.js'

/**
 * Tool mapping for agent compatibility
 * Maps the tool names agents expect to the actual implementation
 */
const TOOL_MAPPING: Record<string, string> = {
  // Direct n8n tool mappings
  delete_n8n_workflow: 'n8n_delete_workflow',
  deactivate_n8n_workflow: 'n8n_deactivate_workflow',
  activate_n8n_workflow: 'n8n_activate_workflow',
  list_workflows: 'n8n_list_workflows',
  get_workflow: 'n8n_get_workflow',
  create_workflow: 'n8n_create_workflow',
  update_workflow: 'n8n_update_full_workflow',
  execute_workflow: 'n8n_execute_workflow',

  // Node database mappings
  search_n8n_nodes: 'search_nodes',
  get_node_info: 'get_node_info',
  list_nodes: 'list_nodes',

  // Validation mappings
  validate_workflow: 'validate_workflow',
  validate_node: 'validate_node_operation',

  // System tools
  health_check: 'n8n_health_check',
  diagnostic: 'n8n_diagnostic',
  get_documentation: 'tools_documentation',
}

/**
 * Agent Tool Handler Class
 * Provides a unified interface for agents to execute tools
 */
export class AgentToolHandler {
  private agentName: string
  private allowedTools: Set<string>

  constructor(agentName: string, allowedTools?: string[]) {
    this.agentName = agentName
    this.allowedTools = new Set(allowedTools ?? [])

    // If no specific tools provided, allow all n8n tools
    if (this.allowedTools.size === 0) {
      this.allowAllN8NTools()
    }
  }

  /**
   * Allow all n8n-related tools
   */
  private allowAllN8NTools(): void {
    const allTools = mcpToolProxy.getAvailableTools()
    allTools.forEach((tool) => {
      if (tool.includes('n8n') || tool.includes('node') || tool.includes('workflow')) {
        this.allowedTools.add(tool)
      }
    })
  }

  /**
   * Check if a tool is allowed for this agent
   */
  private isToolAllowed(toolName: string): boolean {
    // If no restrictions, allow all
    if (this.allowedTools.size === 0)
      return true

    // Check exact match
    if (this.allowedTools.has(toolName))
      return true

    // Check mapped name
    const mappedName = TOOL_MAPPING[toolName]
    if (mappedName && this.allowedTools.has(mappedName))
      return true

    // Check with MCP prefix
    if (this.allowedTools.has(`mcp__n8n-mcp-modern__${toolName}`))
      return true

    return false
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName: string, args: unknown): Promise<unknown> {
    // Map tool name if needed
    const actualToolName = TOOL_MAPPING[toolName] ?? toolName

    // Check permissions
    if (!this.isToolAllowed(actualToolName)) {
      logger.warn(`Agent ${this.agentName} attempted to use disallowed tool: ${toolName}`)
      return {
        success: false,
        error: `Tool ${toolName} is not allowed for this agent`,
      }
    }

    // Execute through the tool executor
    return await agentToolExecutor.execute(this.agentName, actualToolName, args)
  }

  /**
   * Get list of available tools for this agent
   */
  getAvailableTools(): string[] {
    if (this.allowedTools.size === 0) {
      return mcpToolProxy.getAvailableTools()
    }
    return Array.from(this.allowedTools)
  }
}

/**
 * Global agent tool handler factory
 */
export function createAgentToolHandler(
  agentName: string,
  allowedTools?: string[],
): AgentToolHandler {
  return new AgentToolHandler(agentName, allowedTools)
}

/**
 * Tool execution wrapper for Task-spawned agents
 * This function can be called by agents to execute MCP tools
 */
export async function executeAgentTool(
  toolName: string,
  args: unknown,
  context?: {
    agentName?: string
    allowedTools?: string[]
  },
): Promise<unknown> {
  const agentName = context?.agentName ?? 'unknown-agent'
  const handler = createAgentToolHandler(agentName, context?.allowedTools)

  logger.info(`Agent tool execution: ${agentName} -> ${toolName}`)

  try {
    const result = await handler.executeTool(toolName, args)

    // Format response for agent consumption
    if (result && typeof result === 'object') {
      const typedResult = result as { success?: boolean, error?: string, data?: unknown }
      if (typedResult.success === false) {
        return {
          error: typedResult.error ?? `Tool ${toolName} failed`,
          success: false,
        }
      }
      return typedResult.data ?? result
    }

    return result
  }
  catch (error) {
    logger.error(`Agent tool execution error:`, error)
    return {
      error: error instanceof Error ? error.message : 'Tool execution failed',
      success: false,
    }
  }
}

/**
 * Initialize agent tool system
 * This should be called when the MCP server starts
 */
export function initializeAgentTools(): void {
  logger.info('Initializing agent tool system')

  // Register global handler for agent tool requests
  const globalHandlers = globalThis as unknown as { __agentToolExecutor?: typeof executeAgentTool, __createAgentToolHandler?: typeof createAgentToolHandler }
  globalHandlers.__agentToolExecutor = executeAgentTool
  globalHandlers.__createAgentToolHandler = createAgentToolHandler

  logger.info('Agent tool system initialized')
}

// Auto-initialize if imported
initializeAgentTools()
