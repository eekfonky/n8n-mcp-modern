/**
 * Agent Integration for Claude Code
 *
 * This module provides integration between the n8n MCP tools and Claude Code agents.
 * It creates a bridge that makes MCP tools available to spawned agents through
 * a unified interface.
 */

import { logger } from './server/logger.js'
import { mcpToolProxy } from './tools/mcp-bridge.js'

/**
 * Global agent tool registry
 * This makes n8n MCP tools available to Claude Code agents
 */
export function registerAgentTools(): void {
  // Register n8n workflow management tools
  const workflowTools = [
    'n8n_list_workflows',
    'n8n_get_workflow',
    'n8n_create_workflow',
    'n8n_update_full_workflow',
    'n8n_delete_workflow',
    'n8n_activate_workflow',
    'n8n_deactivate_workflow',
    'n8n_execute_workflow',
  ]

  // Register node database tools
  const nodeTools = [
    'search_nodes',
    'list_nodes',
    'get_node_info',
  ]

  // Register validation tools
  const validationTools = [
    'validate_workflow',
    'validate_node_operation',
  ]

  // Register system tools
  const systemTools = [
    'n8n_health_check',
    'n8n_diagnostic',
    'tools_documentation',
  ]

  const allTools = [...workflowTools, ...nodeTools, ...validationTools, ...systemTools]

  // Make tools available globally for agents
  const globalThis_ = globalThis as unknown as { __n8nMcpTools?: Record<string, (args: unknown) => Promise<unknown>> }
  globalThis_.__n8nMcpTools = {}

  for (const toolName of allTools) {
    globalThis_.__n8nMcpTools[toolName] = async (args: unknown): Promise<unknown> => {
      try {
        logger.debug(`Agent calling MCP tool: ${toolName}`, { args })
        const result = await mcpToolProxy.executeTool(toolName, args)
        return result
      }
      catch (error) {
        logger.error(`Agent MCP tool error: ${toolName}`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Tool execution failed',
        }
      }
    }
  }

  logger.info(`Registered ${allTools.length} MCP tools for agent access`)
}

/**
 * Agent tool wrapper that provides a consistent interface
 */
export async function executeAgentMCPTool(
  toolName: string,
  args: unknown,
  agentContext?: { name?: string },
): Promise<unknown> {
  const agentName = agentContext?.name ?? 'unknown-agent'

  logger.info(`Agent ${agentName} executing MCP tool: ${toolName}`)

  try {
    // Check if tool is registered
    const tools = (globalThis as unknown as { __n8nMcpTools?: Record<string, (args: unknown) => Promise<unknown>> }).__n8nMcpTools
    if (!tools?.[toolName]) {
      return {
        success: false,
        error: `MCP tool ${toolName} is not available. Available tools: ${Object.keys(tools ?? {}).join(', ')}`,
      }
    }

    // Execute the tool
    const result = await tools[toolName](args)
    return result
  }
  catch (error) {
    logger.error(`Agent MCP tool execution failed: ${toolName}`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get available MCP tools for agents
 */
export function getAvailableAgentMCPTools(): string[] {
  const tools = (globalThis as unknown as { __n8nMcpTools?: Record<string, (args: unknown) => Promise<unknown>> }).__n8nMcpTools
  return tools ? Object.keys(tools) : []
}

/**
 * Initialize agent integration
 */
export function initializeAgentIntegration(): void {
  registerAgentTools()

  // Export the tool executor globally
  const globalExports = globalThis as unknown as { __executeAgentMCPTool?: typeof executeAgentMCPTool, __getAvailableAgentMCPTools?: typeof getAvailableAgentMCPTools }
  globalExports.__executeAgentMCPTool = executeAgentMCPTool
  globalExports.__getAvailableAgentMCPTools = getAvailableAgentMCPTools

  logger.info('Agent MCP integration initialized')
}
