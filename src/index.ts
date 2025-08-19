#!/usr/bin/env node
/**
 * n8n-MCP Modern - Main Entry Point
 * Modern n8n MCP server built with official TypeScript SDK
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "./server/config.js";
import { logger } from "./server/logger.js";
import { database } from "./database/index.js";
import { N8NMCPTools } from "./tools/index.js";
import { agentRouter, AgentContextBuilder } from "./agents/index.js";
import { initializeResilience } from "./server/resilience.js";
import {
  initializeSecurity,
  createClaudeContext,
  validateToolAccess,
  securityAudit,
  inputSanitizer,
  SecurityEventType,
} from "./server/security.js";
import { n8nApi } from "./n8n/api.js";
import { N8NWorkflowNodeSchema, N8NConnectionsSchema } from "./types/index.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/**
 * Main MCP Server Implementation
 */
class N8NMcpServer {
  private server: McpServer;

  constructor() {
    this.server = new McpServer({
      name: "@lexinet/n8n-mcp-modern",
      version: "4.3.8",
    });

    this.setupTools();
    this.setupErrorHandlers();
  }

  private setupTools(): void {
    logger.info("Setting up n8n MCP tools...");

    // Register each tool individually using the MCP SDK pattern
    this.registerN8NTools();

    logger.info("Registered MCP tools with agent routing system");
  }

  private registerN8NTools(): void {
    // Search n8n nodes
    this.server.registerTool(
      "search_n8n_nodes",
      {
        title: "Search n8n Nodes",
        description:
          "Search for available n8n nodes by name, description, or category",
        inputSchema: {
          query: z.string().describe("Search term for n8n nodes"),
          category: z.string().optional().describe("Filter by node category"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("search_n8n_nodes", args),
    );

    // Get n8n workflows
    this.server.registerTool(
      "get_n8n_workflows",
      {
        title: "Get n8n Workflows",
        description: "Retrieve all workflows from n8n instance",
        inputSchema: {
          limit: z
            .number()
            .optional()
            .default(10)
            .describe("Maximum number of workflows to return"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("get_n8n_workflows", args),
    );

    // Get specific workflow
    this.server.registerTool(
      "get_n8n_workflow",
      {
        title: "Get n8n Workflow",
        description: "Get a specific workflow by ID",
        inputSchema: {
          id: z.string().describe("Workflow ID"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("get_n8n_workflow", args),
    );

    // Create workflow
    this.server.registerTool(
      "create_n8n_workflow",
      {
        title: "Create n8n Workflow",
        description: "Create a new workflow in n8n",
        inputSchema: {
          name: z.string().describe("Workflow name"),
          nodes: z
            .array(N8NWorkflowNodeSchema)
            .describe("Array of workflow nodes"),
          connections: N8NConnectionsSchema.describe("Node connections"),
          active: z
            .boolean()
            .optional()
            .default(false)
            .describe("Whether to activate the workflow"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("create_n8n_workflow", args),
    );

    // Execute workflow
    this.server.registerTool(
      "execute_n8n_workflow",
      {
        title: "Execute n8n Workflow",
        description: "Execute a workflow in n8n",
        inputSchema: {
          id: z.string().describe("Workflow ID to execute"),
          data: z
            .record(z.unknown())
            .optional()
            .describe("Input data for the workflow"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("execute_n8n_workflow", args),
    );

    // Activate workflow
    this.server.registerTool(
      "activate_n8n_workflow",
      {
        title: "Activate n8n Workflow",
        description: "Activate a workflow in n8n",
        inputSchema: {
          id: z.string().describe("Workflow ID to activate"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("activate_n8n_workflow", args),
    );

    // Deactivate workflow
    this.server.registerTool(
      "deactivate_n8n_workflow",
      {
        title: "Deactivate n8n Workflow",
        description: "Deactivate a workflow in n8n",
        inputSchema: {
          id: z.string().describe("Workflow ID to deactivate"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("deactivate_n8n_workflow", args),
    );

    // Get executions
    this.server.registerTool(
      "get_n8n_executions",
      {
        title: "Get n8n Executions",
        description: "Get workflow execution history",
        inputSchema: {
          workflowId: z.string().optional().describe("Filter by workflow ID"),
          limit: z
            .number()
            .optional()
            .default(10)
            .describe("Maximum number of executions to return"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("get_n8n_executions", args),
    );

    // Get workflow stats
    this.server.registerTool(
      "get_workflow_stats",
      {
        title: "Get Workflow Statistics",
        description: "Get execution statistics for a workflow",
        inputSchema: {
          id: z.string().describe("Workflow ID"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("get_workflow_stats", args),
    );

    // Get tool usage stats
    this.server.registerTool(
      "get_tool_usage_stats",
      {
        title: "Get Tool Usage Statistics",
        description: "Get statistics about MCP tool usage",
        inputSchema: {
          period: z
            .string()
            .optional()
            .default("daily")
            .describe("Time period (daily, weekly, monthly)"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("get_tool_usage_stats", args),
    );

    // List all available tools
    this.server.registerTool(
      "list_available_tools",
      {
        title: "List Available Tools",
        description:
          "Get comprehensive list of all 98 available tools with categories",
        inputSchema: {
          category: z
            .string()
            .optional()
            .describe(
              "Filter by category: core, code-generation, developer-workflows, performance-observability, comprehensive",
            ),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("list_available_tools", args),
    );

    // Validate MCP configuration
    this.server.registerTool(
      "validate_mcp_config",
      {
        title: "Validate MCP Configuration",
        description:
          "Check .mcp.json configuration and environment setup for common issues",
        inputSchema: {
          fix_issues: z
            .boolean()
            .optional()
            .default(false)
            .describe("Attempt to auto-fix common configuration issues"),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting("validate_mcp_config", args),
    );
  }

  private async executeToolWithRouting(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  }> {
    try {
      // Create security context for Claude Code
      const securityContext = createClaudeContext();

      // Validate tool access
      if (!validateToolAccess(toolName, securityContext)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Access denied for tool: ${toolName}`,
            },
          ],
          isError: true,
        };
      }

      // Sanitize input arguments
      const sanitizedArgs = inputSanitizer.sanitizeObject(args) as Record<
        string,
        unknown
      >;

      // Build context for intelligent agent routing
      const context = this.buildContext(toolName, sanitizedArgs);

      // Route to appropriate agent
      const agent = agentRouter.routeTool(toolName, context);

      logger.info(`Tool ${toolName} routed to agent: ${agent.name}`);

      // Execute the tool with sanitized arguments
      const result = await N8NMCPTools.executeTool(toolName, sanitizedArgs);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorDetails = {
        tool: toolName,
        args,
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
        stack: (error as Error).stack?.split("\n").slice(0, 3).join("\n"),
      };

      logger.error(`Tool execution failed: ${toolName}`, errorDetails);

      // Log security event for tool execution failure
      securityAudit.logEvent({
        eventType: SecurityEventType.SECURITY_ERROR,
        success: false,
        toolName,
        details: errorDetails,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Error executing ${toolName}:\n${(error as Error).message}\n\nContext: ${JSON.stringify({ args, timestamp: errorDetails.timestamp }, null, 2)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private buildContext(
    toolName: string,
    _args: Record<string, unknown>,
  ): Record<string, unknown> {
    const context = AgentContextBuilder.create();

    // Analyze tool complexity
    if (toolName.includes("create") || toolName.includes("execute")) {
      context.complexity("high");
    } else if (toolName.includes("get") && toolName.includes("stats")) {
      context.complexity("medium").requiresValidation();
    } else {
      context.complexity("low");
    }

    // Route based on tool patterns
    if (toolName.includes("node")) {
      context.nodeExpertise();
    }

    if (
      toolName.includes("workflow") &&
      (toolName.includes("activate") || toolName.includes("execute"))
    ) {
      context.requiresAuthentication();
    }

    if (toolName.includes("stats") || toolName.includes("usage")) {
      context.requiresValidation();
    }

    if (
      toolName === "search_n8n_nodes" ||
      toolName === "get_tool_usage_stats"
    ) {
      context.quickHelp();
    }

    return context.build() as Record<string, unknown>;
  }

  private setupErrorHandlers(): void {
    // McpServer handles errors internally - we just set up process handlers

    process.on("SIGINT", async () => {
      logger.info("Received SIGINT, shutting down gracefully...");
      await this.server.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM, shutting down gracefully...");
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Install Claude Code agents (async, non-blocking)
   */
  private async installClaudeAgents(): Promise<void> {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const installerPath = join(
        __dirname,
        "..",
        "scripts",
        "install-claude-mcp.js",
      );

      // Run installer in background
      const child = spawn("node", [installerPath], {
        stdio: "pipe",
        detached: true,
      });

      child.unref(); // Allow parent to exit independently

      logger.info("Claude Code agent installation started (background)");
    } catch (error) {
      logger.debug("Agent installation skipped:", error);
    }
  }

  async start(): Promise<void> {
    logger.info("Starting n8n-MCP Modern server...");
    logger.info(`Mode: ${config.mcpMode}`);
    logger.info(`Log Level: ${config.logLevel}`);

    // Initialize database
    await database.initialize();
    logger.info("Database initialized");

    // Initialize resilience features
    initializeResilience();
    logger.info("Resilience features initialized");

    // Initialize security module
    initializeSecurity();
    logger.info("Security module initialized");

    // Test n8n API connection
    if (config.n8nApiUrl && config.n8nApiKey) {
      logger.info(`n8n API URL: ${config.n8nApiUrl}`);

      if (n8nApi) {
        const connected = await n8nApi.testConnection();
        if (connected) {
          logger.info("n8n API connection successful");
        } else {
          logger.warn("n8n API connection failed - running in offline mode");
        }
      }
    } else {
      logger.info("No n8n API configured - running in offline mode");
    }

    // Log agent system status
    const agents = agentRouter.getAllAgents();
    logger.info(`Agent system ready: ${agents.length} agents available`);
    agents.forEach((agent) => {
      logger.debug(
        `  - ${agent.name} (Tier ${agent.tier}): ${agent.capabilities.join(", ")}`,
      );
    });

    // Install Claude Code agents (background process)
    this.installClaudeAgents();

    const transport = new StdioServerTransport();

    // Add connection timeout
    const connectWithTimeout = Promise.race([
      this.server.connect(transport),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("MCP connection timeout after 30 seconds")),
          30000,
        ),
      ),
    ]);

    await connectWithTimeout;

    logger.info("n8n-MCP Modern server started successfully");
    logger.info(
      "100 total tools available: 13 MCP-registered + 87 execution-routed",
    );
    logger.info("Server ready for Claude Code integration");
  }
}

/**
 * Handle CLI commands
 */
function handleCliCommands(): boolean {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    process.stdout.write("4.3.8\n");
    return true;
  }

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`
n8n-MCP Modern v4.3.8 - 108 MCP Tools for n8n Automation

Usage:
  npx @lexinet/n8n-mcp-modern              # Start MCP server (stdio mode)
  npx @lexinet/n8n-mcp-modern --version    # Show version
  npx @lexinet/n8n-mcp-modern --help       # Show this help
  npx @lexinet/n8n-mcp-modern install      # Smart MCP installation (auto-detects scope)
  npx @lexinet/n8n-mcp-modern upgrade      # Smart upgrade (preserves config)

Environment Variables:
  N8N_API_URL       # Your n8n instance URL
  N8N_API_KEY       # Your n8n API key
  LOG_LEVEL         # debug, info, warn, error (default: info)

For Claude Code integration:
  claude mcp add n8n-mcp-modern -- npx -y @lexinet/n8n-mcp-modern

Documentation: https://github.com/eekfonky/n8n-mcp-modern
`);
    return true;
  }

  if (args.includes("install")) {
    // Run the smart installer
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const installerPath = join(__dirname, "..", "scripts", "install-mcp.js");

    const installer = spawn("node", [installerPath], {
      stdio: "inherit",
      env: process.env,
    });

    installer.on("close", (code) => {
      process.exit(code ?? 0);
    });

    return true;
  }
  if (args.includes("upgrade")) {
    process.stdout.write("🔄 Starting n8n MCP Modern upgrade...\n");
    process.stdout.write("Please run: npx @lexinet/n8n-mcp-modern upgrade\n");
    process.stdout.write(
      "This will preserve your configuration and update all agents.\n",
    );
    return true;
  }

  return false;
}

/**
 * Start the server
 */
async function main(): Promise<void> {
  try {
    // Handle CLI commands first
    if (handleCliCommands()) {
      return;
    }

    const server = new N8NMcpServer();
    await server.start();
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error("Unhandled error in main:", error);
    process.exit(1);
  });
}

export { N8NMcpServer };
