/**
 * MCP Tool Bridge for Agent Execution
 * 
 * This module provides a bridge that allows spawned agents (via Task tool)
 * to access MCP tools by proxying requests through the parent context.
 */

import { logger } from "../server/logger.js";
import { N8NMCPTools } from "./index.js";
import { n8nApi } from "../n8n/api.js";
import { database } from "../database/index.js";

/**
 * MCP Tool Proxy Handler
 * Allows agents to execute MCP tools through a proxy interface
 */
export class MCPToolProxy {
  private toolRegistry: Map<string, (args: unknown) => Promise<unknown>> = new Map();
  
  constructor() {
    this.registerN8NTools();
  }

  /**
   * Register all n8n MCP tools that agents can access
   */
  private registerN8NTools(): void {
    // Workflow management tools
    this.toolRegistry.set("n8n_list_workflows", async (_args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.getWorkflows();
    });

    this.toolRegistry.set("n8n_get_workflow", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.getWorkflow((args as { id: string }).id);
    });

    this.toolRegistry.set("n8n_create_workflow", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.createWorkflow(args as Record<string, unknown>);
    });

    this.toolRegistry.set("n8n_update_full_workflow", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      const typedArgs = args as { id: string };
      return await n8nApi.updateWorkflow(typedArgs.id, args as Record<string, unknown>);
    });

    this.toolRegistry.set("n8n_delete_workflow", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.deleteWorkflow((args as { id: string }).id);
    });

    this.toolRegistry.set("n8n_activate_workflow", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.activateWorkflow((args as { id: string }).id);
    });

    this.toolRegistry.set("n8n_deactivate_workflow", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.deactivateWorkflow((args as { id: string }).id);
    });

    // Execution management
    this.toolRegistry.set("n8n_execute_workflow", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      const typedArgs = args as { id: string; inputData?: Record<string, unknown> };
      return await n8nApi.executeWorkflow(typedArgs.id, typedArgs.inputData);
    });

    this.toolRegistry.set("n8n_list_executions", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.getExecutions((args as { workflowId?: string }).workflowId);
    });

    this.toolRegistry.set("n8n_get_execution", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.getExecution((args as { id: string }).id);
    });

    // Node database tools
    this.toolRegistry.set("search_nodes", async (args) => {
      const query = (args as { query?: string }).query ?? "";
      
      const results = database.searchNodes(query);
      
      return {
        success: true,
        data: results
      };
    });

    this.toolRegistry.set("list_nodes", async (args) => {
      const results = database.getNodes((args as { category?: string }).category);
      
      return {
        success: true,
        data: results
      };
    });

    this.toolRegistry.set("get_node_info", async (args) => {
      const result = database.getNodes().find(n => n.name === (args as { nodeType: string }).nodeType);
      return {
        success: true,
        data: result
      };
    });

    // Validation tools
    this.toolRegistry.set("validate_workflow", async (args) => {
      return await N8NMCPTools.executeTool("validate_workflow", args as Record<string, unknown>);
    });

    this.toolRegistry.set("validate_node_operation", async (args) => {
      return await N8NMCPTools.executeTool("validate_node_operation", args as Record<string, unknown>);
    });

    // Webhook tools
    this.toolRegistry.set("n8n_trigger_webhook_workflow", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      // Use the webhook URL directly with fetch
      try {
        const method = (args as { httpMethod?: string }).httpMethod ?? "GET";
        const requestOptions: globalThis.RequestInit = {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(args as { headers?: Record<string, string> }).headers
          }
        };
        
        const typedWebhookArgs = args as { data?: unknown; headers?: Record<string, string> };
        if (typedWebhookArgs.data && method !== "GET") {
          requestOptions.body = JSON.stringify(typedWebhookArgs.data);
        }
        
        const response = await globalThis.fetch((args as { webhookUrl: string }).webhookUrl, requestOptions);
        return await response.json();
      } catch (error) {
        throw new Error(`Webhook trigger failed: ${error}`);
      }
    });

    // Credential management
    this.toolRegistry.set("n8n_list_credentials", async (_args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.getCredentials();
    });

    this.toolRegistry.set("n8n_get_credential", async (args) => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.getCredential((args as { id: string }).id);
    });

    // System tools
    this.toolRegistry.set("n8n_health_check", async () => {
      if (!n8nApi) throw new Error("n8n API not initialized");
      return await n8nApi.testConnection();
    });

    this.toolRegistry.set("n8n_diagnostic", async (args) => {
      return await N8NMCPTools.executeTool("n8n_diagnostic", args as Record<string, unknown>);
    });

    this.toolRegistry.set("tools_documentation", async (args) => {
      return await N8NMCPTools.executeTool("tools_documentation", args as Record<string, unknown>);
    });

    logger.info(`MCP Tool Bridge initialized with ${this.toolRegistry.size} tools`);
  }

  /**
   * Execute a tool through the proxy
   */
  async executeTool(toolName: string, args: unknown): Promise<unknown> {
    // Handle different tool name formats
    const normalizedName = this.normalizeToolName(toolName);
    
    const handler = this.toolRegistry.get(normalizedName);
    if (!handler) {
      logger.warn(`Tool not found in proxy: ${toolName} (normalized: ${normalizedName})`);
      return {
        success: false,
        error: `Tool ${toolName} is not available through the MCP bridge`
      };
    }

    try {
      logger.debug(`Executing proxied tool: ${normalizedName}`, { args });
      const result = await handler(args);
      return result;
    } catch (error) {
      logger.error(`Error executing proxied tool ${normalizedName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }

  /**
   * Normalize tool names from different formats
   */
  private normalizeToolName(toolName: string): string {
    // Remove MCP prefixes
    let normalized = toolName
      .replace(/^mcp__/, "")
      .replace(/^n8n-mcp-modern__/, "")
      .replace(/^n8n-mcp__/, "");
    
    // Handle underscore/hyphen variations
    if (normalized.startsWith("n8n-")) {
      normalized = normalized.replace("n8n-", "n8n_");
    }
    
    return normalized;
  }

  /**
   * Get list of available tools
   */
  getAvailableTools(): string[] {
    return Array.from(this.toolRegistry.keys());
  }

  /**
   * Check if a tool is available
   */
  hasTool(toolName: string): boolean {
    const normalized = this.normalizeToolName(toolName);
    return this.toolRegistry.has(normalized);
  }
}

// Export singleton instance
export const mcpToolProxy = new MCPToolProxy();

/**
 * Agent Tool Executor
 * Provides a high-level interface for agents to execute tools
 */
export class AgentToolExecutor {
  constructor(private proxy: MCPToolProxy = mcpToolProxy) {}

  /**
   * Execute a tool on behalf of an agent
   */
  async execute(
    agentName: string,
    toolName: string,
    args: unknown
  ): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }> {
    logger.info(`Agent ${agentName} executing tool: ${toolName}`);
    
    try {
      // Check if tool is available
      if (!this.proxy.hasTool(toolName)) {
        logger.warn(`Tool ${toolName} not available for agent ${agentName}`);
        return {
          success: false,
          error: `Tool ${toolName} is not available`
        };
      }

      // Execute through proxy
      const result = await this.proxy.executeTool(toolName, args);
      
      // Normalize response format
      if (result && typeof result === "object") {
        const typedResult = result as Record<string, unknown>;
        if ("success" in typedResult) {
          const response: { success: boolean; data?: unknown; error?: string } = {
            success: Boolean(typedResult.success)
          };
          if (typedResult.data !== undefined) {
            response.data = typedResult.data;
          }
          if (typeof typedResult.error === "string") {
            response.error = typedResult.error;
          }
          return response;
        }
        // Wrap raw results
        return {
          success: true,
          data: result
        };
      }
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error(`Agent ${agentName} tool execution failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed"
      };
    }
  }

  /**
   * Batch execute multiple tools
   */
  async executeBatch(
    agentName: string,
    tools: Array<{ name: string; args: unknown }>
  ): Promise<Array<{ tool: string; result: unknown }>> {
    const results = [];
    
    for (const tool of tools) {
      const result = await this.execute(agentName, tool.name, tool.args);
      results.push({
        tool: tool.name,
        result
      });
    }
    
    return results;
  }
}

// Export executor instance
export const agentToolExecutor = new AgentToolExecutor();