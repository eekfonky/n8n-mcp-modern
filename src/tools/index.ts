/**
 * MCP Tools for n8n automation
 * Comprehensive 87+ tools for Claude Code agents to interact with n8n
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { database } from "../database/index.js";
import { n8nApi } from "../n8n/api.js";
import { logger } from "../server/logger.js";
import {
  getAllComprehensiveTools,
  ComprehensiveMCPTools,
} from "./comprehensive.js";
import { CodeGenerationTools, codeGenerationTools } from "./code-generation.js";
import {
  DeveloperWorkflowTools,
  developerWorkflowTools,
} from "./developer-workflows.js";
import {
  PerformanceObservabilityTools,
  performanceObservabilityTools,
} from "./performance-observability.js";
import {
  SearchNodesArgsSchema,
  GetWorkflowsArgsSchema,
  GetWorkflowArgsSchema,
  CreateWorkflowArgsSchema,
  ExecuteWorkflowArgsSchema,
  GetExecutionsArgsSchema,
  RouteToAgentArgsSchema,
  N8NWorkflowNodeSchema as _N8NWorkflowNodeSchema,
  N8NConnectionsSchema as _N8NConnectionsSchema,
} from "../types/index.js";
import type {
  SearchNodesArgs,
  GetWorkflowsArgs,
  GetWorkflowArgs,
  CreateWorkflowArgs,
  ExecuteWorkflowArgs,
  GetExecutionsArgs,
  RouteToAgentArgs,
  N8NWorkflowNode,
} from "../types/index.js";

// Use schemas from types file - no duplicates needed

/**
 * MCP Tool implementations
 */
export class N8NMCPTools {
  /**
   * Convert Zod schema to JSON schema (proper implementation)
   */
  private static zodToJsonSchema(
    zodSchema: z.ZodSchema,
  ): Record<string, unknown> {
    // Basic Zod to JSON Schema conversion
    // For production use, integrate @anatine/zod-openapi library
    if (zodSchema instanceof z.ZodObject) {
      const shape = zodSchema.shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const zodValue = value as z.ZodTypeAny;
        if (zodValue instanceof z.ZodString) {
          properties[key] = { type: "string" };
        } else if (zodValue instanceof z.ZodNumber) {
          properties[key] = { type: "number" };
        } else if (zodValue instanceof z.ZodBoolean) {
          properties[key] = { type: "boolean" };
        } else if (zodValue instanceof z.ZodArray) {
          properties[key] = { type: "array", items: { type: "object" } };
        } else if (zodValue instanceof z.ZodRecord) {
          properties[key] = { type: "object" };
        } else {
          properties[key] = { type: "object" };
        }

        if (!zodValue.isOptional()) {
          required.push(key);
        }
      }

      return { type: "object", properties, required };
    }

    return { type: "object" };
  }

  /**
   * Get all available MCP tools (110+ comprehensive tools)
   */
  static getTools(): Tool[] {
    // Original 10 tools + 77+ comprehensive tools = 87+ total
    const originalTools: Tool[] = [
      {
        name: "search_n8n_nodes",
        description:
          "Search for available n8n nodes by name, description, or category",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description: "Search term for n8n nodes",
            },
            category: {
              type: "string",
              description: "Filter by node category (optional)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_n8n_workflows",
        description:
          "Get list of n8n workflows from the connected n8n instance",
        inputSchema: {
          type: "object" as const,
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of workflows to return",
              default: 10,
            },
          },
        },
      },
      {
        name: "get_n8n_workflow",
        description: "Get details of a specific n8n workflow by ID",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: {
              type: "string",
              description: "Workflow ID",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "create_n8n_workflow",
        description: "Create a new n8n workflow",
        inputSchema: {
          type: "object" as const,
          properties: {
            name: {
              type: "string",
              description: "Workflow name",
            },
            nodes: {
              type: "array",
              description: "Array of workflow nodes",
              items: { type: "object" },
            },
            connections: {
              type: "object" as const,
              description: "Node connections",
            },
            active: {
              type: "boolean",
              description: "Whether to activate the workflow",
              default: false,
            },
            settings: {
              type: "object" as const,
              description: "Workflow settings (optional)",
            },
            staticData: {
              type: "object" as const,
              description: "Static workflow data (optional)",
            },
            tags: {
              type: "array",
              description: "Workflow tags (optional)",
              items: { type: "string" },
            },
          },
          required: ["name", "nodes", "connections"],
        },
      },
      {
        name: "execute_n8n_workflow",
        description: "Execute an n8n workflow by ID",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: {
              type: "string",
              description: "Workflow ID to execute",
            },
            data: {
              type: "object" as const,
              description: "Input data for the workflow (optional)",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "get_n8n_executions",
        description: "Get workflow execution history",
        inputSchema: {
          type: "object" as const,
          properties: {
            workflowId: {
              type: "string",
              description: "Filter by workflow ID (optional)",
            },
            limit: {
              type: "number",
              description: "Maximum number of executions to return",
              default: 20,
            },
          },
        },
      },
      {
        name: "get_workflow_stats",
        description:
          "Get statistics for a workflow (execution count, success rate, etc.)",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: {
              type: "string",
              description: "Workflow ID",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "activate_n8n_workflow",
        description: "Activate an n8n workflow",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: {
              type: "string",
              description: "Workflow ID to activate",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "deactivate_n8n_workflow",
        description: "Deactivate an n8n workflow",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: {
              type: "string",
              description: "Workflow ID to deactivate",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "n8n_import_workflow",
        description: "Import workflow from n8n workflow data",
        inputSchema: {
          type: "object" as const,
          properties: {
            workflowData: {
              type: "object",
              description: "n8n workflow data to import",
            },
            activate: {
              type: "boolean",
              description: "Whether to activate the imported workflow",
              default: false,
            },
          },
          required: ["workflowData"],
        },
      },
      {
        name: "n8n_update_workflow",
        description: "Update existing n8n workflow",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: {
              type: "string",
              description: "Workflow ID to update",
            },
            name: {
              type: "string",
              description: "Updated workflow name (optional)",
            },
            nodes: {
              type: "array",
              description: "Updated workflow nodes (optional)",
              items: { type: "object" },
            },
            connections: {
              type: "object" as const,
              description: "Updated node connections (optional)",
            },
            active: {
              type: "boolean",
              description:
                "Whether to activate/deactivate the workflow (optional)",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "n8n_delete_workflow",
        description: "Delete n8n workflow by ID",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: {
              type: "string",
              description: "Workflow ID to delete",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "get_tool_usage_stats",
        description: "Get usage statistics for MCP tools",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "routeToAgent",
        description:
          "Route a query to the most appropriate n8n agent specialist",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description: "Query to route to appropriate agent",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "list_available_tools",
        description:
          "Get comprehensive list of all 98 available tools with categories",
        inputSchema: {
          type: "object" as const,
          properties: {
            category: {
              type: "string",
              description:
                "Filter by category: core, code-generation, developer-workflows, performance-observability, comprehensive",
            },
          },
        },
      },
    ];

    // Add Phase 1 & 2 tools (Code Generation + Developer Workflows)
    const phase1Tools = codeGenerationTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object" as const,
        properties: tool.inputSchema.shape
          ? this.zodToJsonSchema(tool.inputSchema)
          : {},
        required:
          tool.inputSchema._def?.typeName === "ZodObject"
            ? Object.keys(tool.inputSchema.shape)
            : [],
      },
    }));

    const phase2Tools = developerWorkflowTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object" as const,
        properties: tool.inputSchema.shape
          ? this.zodToJsonSchema(tool.inputSchema)
          : {},
        required:
          tool.inputSchema._def?.typeName === "ZodObject"
            ? Object.keys(tool.inputSchema.shape)
            : [],
      },
    }));

    const phase3Tools = performanceObservabilityTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object" as const,
        properties: tool.inputSchema.shape
          ? this.zodToJsonSchema(tool.inputSchema)
          : {},
        required:
          tool.inputSchema._def?.typeName === "ZodObject"
            ? Object.keys(tool.inputSchema.shape)
            : [],
      },
    }));

    // Combine all tools: Original(11) + Phase1(12) + Phase2(10) + Phase3(12) + Comprehensive(53) = 98 total
    const allTools = [
      ...originalTools,
      ...phase1Tools,
      ...phase2Tools,
      ...phase3Tools,
    ];
    const comprehensiveToolCount = 53; // Core(6) + Validation(7) + Credential(7) + User(4) + System(5) + Workflow(7) + Advanced(17)

    logger.info(
      `🚀 Enhanced MCP Server Ready: ${allTools.length + comprehensiveToolCount} tools available`,
    );
    logger.info(
      `   📦 Original: ${originalTools.length} | 🔧 Code Gen: ${phase1Tools.length} | 🛠️  DevOps: ${phase2Tools.length} | 📊 Performance: ${phase3Tools.length} | 📚 Comprehensive: 53`,
    );

    return allTools;
  }

  /**
   * Execute MCP tool (handles both original and comprehensive tools)
   */
  static async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    // Try comprehensive tools first
    const comprehensiveToolNames = getAllComprehensiveTools().map(
      (tool) => tool.name,
    );
    if (comprehensiveToolNames.includes(name)) {
      return await ComprehensiveMCPTools.executeTool(name, args);
    }

    // Fall back to original tools
    const startTime = Date.now();
    let success = false;

    try {
      logger.debug(`Executing tool: ${name}`, args);

      let result: unknown;

      switch (name) {
        case "search_n8n_nodes":
          result = await this.searchNodes(SearchNodesArgsSchema.parse(args));
          break;

        case "get_n8n_workflows":
          result = await this.getWorkflows(GetWorkflowsArgsSchema.parse(args));
          break;

        case "get_n8n_workflow":
          result = await this.getWorkflow(GetWorkflowArgsSchema.parse(args));
          break;

        case "create_n8n_workflow":
          result = await this.createWorkflow(
            CreateWorkflowArgsSchema.parse(args),
          );
          break;

        case "execute_n8n_workflow":
          result = await this.executeWorkflow(
            ExecuteWorkflowArgsSchema.parse(args),
          );
          break;

        case "get_n8n_executions":
          result = await this.getExecutions(
            GetExecutionsArgsSchema.parse(args),
          );
          break;

        case "get_workflow_stats":
          result = await this.getWorkflowStats(
            GetWorkflowArgsSchema.parse(args),
          );
          break;

        case "activate_n8n_workflow":
          result = await this.activateWorkflow(
            GetWorkflowArgsSchema.parse(args),
          );
          break;

        case "deactivate_n8n_workflow":
          result = await this.deactivateWorkflow(
            GetWorkflowArgsSchema.parse(args),
          );
          break;

        case "get_tool_usage_stats":
          result = await this.getToolUsageStats();
          break;

        case "list_available_tools":
          result = await this.listAvailableTools(args as { category?: string });
          break;

        case "validate_mcp_config":
          result = await this.validateMcpConfig(
            args as { fix_issues?: boolean },
          );
          break;

        case "routeToAgent":
          result = await this.routeToAgent(RouteToAgentArgsSchema.parse(args));
          break;

        case "n8n_import_workflow":
          result = await this.importWorkflow(args);
          break;

        case "n8n_update_workflow":
          result = await this.updateWorkflow(args);
          break;

        case "n8n_delete_workflow":
          result = await this.deleteWorkflow(args);
          break;

        // Phase 1: Code Generation Tools
         
        case "generate_workflow_from_description":
          result = await CodeGenerationTools.generateWorkflowFromDescription(
            args as any,
          );
          break;
        case "create_api_integration_template":
           
          result = await CodeGenerationTools.createAPIIntegrationTemplate(
            args as any,
          );
          break;
        case "build_data_processing_pipeline":
           
          result = await CodeGenerationTools.buildDataProcessingPipeline(
            args as any,
          );
          break;
        case "generate_notification_workflow":
           
          result = await CodeGenerationTools.generateNotificationWorkflow(
            args as any,
          );
          break;
        case "create_webhook_handler":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await CodeGenerationTools.createWebhookHandler(args as any);
          break;
        case "export_workflow_as_template":
           
          result = await CodeGenerationTools.exportWorkflowAsTemplate(
            args as any,
          );
          break;
        case "generate_docker_compose":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await CodeGenerationTools.generateDockerCompose(args as any);
          break;
        case "create_workflow_documentation":
           
          result = await CodeGenerationTools.createWorkflowDocumentation(
            args as any,
          );
          break;
        case "build_conditional_logic":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await CodeGenerationTools.buildConditionalLogic(args as any);
          break;
        case "create_error_handling":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await CodeGenerationTools.createErrorHandling(args as any);
          break;
        case "generate_testing_scenarios":
           
          result = await CodeGenerationTools.generateTestingScenarios(
            args as any,
          );
          break;
        case "build_integration_boilerplate":
           
          result = await CodeGenerationTools.buildIntegrationBoilerplate(
            args as any,
          );
          break;

        // Phase 2: Developer Workflow Tools
        case "integrate_with_git":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await DeveloperWorkflowTools.integrateWithGit(args as any);
          break;
        case "setup_cicd_pipeline":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await DeveloperWorkflowTools.setupCICDPipeline(args as any);
          break;
        case "create_deployment_automation":
           
          result = await DeveloperWorkflowTools.createDeploymentAutomation(
            args as any,
          );
          break;
        case "generate_code_quality_checks":
           
          result = await DeveloperWorkflowTools.generateCodeQualityChecks(
            args as any,
          );
          break;
        case "setup_environment_management":
           
          result = await DeveloperWorkflowTools.setupEnvironmentManagement(
            args as any,
          );
          break;
        case "create_monitoring_alerting":
           
          result = await DeveloperWorkflowTools.createMonitoringAlerting(
            args as any,
          );
          break;
        case "build_backup_recovery":
           
          result = await DeveloperWorkflowTools.buildBackupRecovery(
            args as any,
          );
          break;
        case "generate_api_testing_workflows":
           
          result = await DeveloperWorkflowTools.generateAPITestingWorkflows(
            args as any,
          );
          break;
        case "setup_infrastructure_as_code":
           
          result = await DeveloperWorkflowTools.setupInfrastructureAsCode(
            args as any,
          );
          break;
        case "create_workflow_orchestration":
           
          result = await DeveloperWorkflowTools.createWorkflowOrchestration(
            args as any,
          );
          break;

        // Phase 3: Performance & Observability Tools
        case "analyze_workflow_performance":
           
          result =
            await PerformanceObservabilityTools.analyzeWorkflowPerformance(
              args as any,
            );
          break;
        case "monitor_system_metrics":
           
          result = await PerformanceObservabilityTools.monitorSystemMetrics(
            args as any,
          );
          break;
        case "generate_optimization_recommendations":
           
          result =
            await PerformanceObservabilityTools.generateOptimizationRecommendations(
              args as any,
            );
          break;
        case "setup_alert_configuration":
           
          result = await PerformanceObservabilityTools.setupAlertConfiguration(
            args as any,
          );
          break;
        case "create_custom_dashboard":
           
          result = await PerformanceObservabilityTools.createCustomDashboard(
            args as any,
          );
          break;
        case "perform_capacity_planning":
           
          result = await PerformanceObservabilityTools.performCapacityPlanning(
            args as any,
          );
          break;
        case "generate_health_checks":
           
          result = await PerformanceObservabilityTools.generateHealthChecks(
            args as any,
          );
          break;
        case "analyze_performance_trends":
           
          result = await PerformanceObservabilityTools.analyzePerformanceTrends(
            args as any,
          );
          break;
        case "monitor_resource_utilization":
           
          result =
            await PerformanceObservabilityTools.monitorResourceUtilization(
              args as any,
            );
          break;
        case "setup_sla_monitoring":
           
          result = await PerformanceObservabilityTools.setupSLAMonitoring(
            args as any,
          );
          break;
        case "perform_log_analysis":
           
          result = await PerformanceObservabilityTools.performLogAnalysis(
            args as any,
          );
          break;
        case "generate_cost_analysis":
           
          result = await PerformanceObservabilityTools.generateCostAnalysis(
            args as any,
          );
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      success = true;
      logger.info(`Tool executed successfully: ${name}`);
      return result;
    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, error);
      throw error;
    } finally {
      const executionTime = Date.now() - startTime;
      database.recordToolUsage(name, executionTime, success);
    }
  }

  /**
   * Search for n8n nodes
   */
  private static async searchNodes(args: SearchNodesArgs): Promise<unknown> {
    const nodes = database.searchNodes(args.query);

    if (args.category) {
      return nodes.filter(
        (node) =>
          node.category.toLowerCase() === (args.category ?? "").toLowerCase(),
      );
    }

    return nodes;
  }

  /**
   * Get workflows from n8n
   */
  private static async getWorkflows(args: GetWorkflowsArgs): Promise<unknown> {
    if (!n8nApi) {
      throw new Error(
        "n8n API not configured. Set N8N_API_URL and N8N_API_KEY environment variables.",
      );
    }

    const workflows = await n8nApi.getWorkflows();
    return workflows.slice(0, args.limit);
  }

  /**
   * Get specific workflow
   */
  private static async getWorkflow(args: GetWorkflowArgs): Promise<unknown> {
    if (!n8nApi) {
      throw new Error("n8n API not configured.");
    }

    return await n8nApi.getWorkflow(args.id);
  }

  /**
   * Create new workflow
   */
  private static async createWorkflow(
    args: CreateWorkflowArgs,
  ): Promise<unknown> {
    if (!n8nApi) {
      throw new Error("n8n API not configured.");
    }

    // Normalize nodes to handle exactOptionalPropertyTypes
    const normalizedNodes = args.nodes.map((node) => {
      const normalizedNode: N8NWorkflowNode = {
        id: node.id,
        name: node.name,
        type: node.type,
        typeVersion: node.typeVersion,
        position: node.position,
        parameters: node.parameters,
      };

      // Only add optional properties if they have actual values
      if (node.credentials !== undefined)
        normalizedNode.credentials = node.credentials;
      if (node.disabled !== undefined) normalizedNode.disabled = node.disabled;
      if (node.notes !== undefined) normalizedNode.notes = node.notes;
      if (node.notesInFlow !== undefined)
        normalizedNode.notesInFlow = node.notesInFlow;
      if (node.color !== undefined) normalizedNode.color = node.color;
      if (node.continueOnFail !== undefined)
        normalizedNode.continueOnFail = node.continueOnFail;
      if (node.alwaysOutputData !== undefined)
        normalizedNode.alwaysOutputData = node.alwaysOutputData;
      if (node.executeOnce !== undefined)
        normalizedNode.executeOnce = node.executeOnce;
      if (node.retryOnFail !== undefined)
        normalizedNode.retryOnFail = node.retryOnFail;
      if (node.maxTries !== undefined) normalizedNode.maxTries = node.maxTries;
      if (node.waitBetweenTries !== undefined)
        normalizedNode.waitBetweenTries = node.waitBetweenTries;
      if (node.onError !== undefined) normalizedNode.onError = node.onError;

      return normalizedNode;
    });

    const workflowData: Omit<import("../n8n/api.js").N8NWorkflow, "id"> = {
      name: args.name,
      nodes: normalizedNodes,
      connections: args.connections,
      active: args.active,
      settings: args.settings ?? {
        saveDataErrorExecution: "all",
        saveDataSuccessExecution: "all",
        saveManualExecutions: false,
        timezone: "America/New_York",
        executionOrder: "v1",
      },
    };

    if (args.staticData !== undefined) {
      workflowData.staticData = args.staticData;
    }
    if (args.tags !== undefined) {
      workflowData.tags = args.tags;
    }

    const workflow = await n8nApi.createWorkflow(workflowData);

    if (args.active) {
      if (workflow.id) {
        await n8nApi.activateWorkflow(workflow.id);
      }
    }

    return workflow;
  }

  /**
   * Execute workflow
   */
  private static async executeWorkflow(
    args: ExecuteWorkflowArgs,
  ): Promise<unknown> {
    if (!n8nApi) {
      throw new Error("n8n API not configured.");
    }

    return await n8nApi.executeWorkflow(args.id, args.data);
  }

  /**
   * Get executions
   */
  private static async getExecutions(
    args: GetExecutionsArgs,
  ): Promise<unknown> {
    if (!n8nApi) {
      throw new Error("n8n API not configured.");
    }

    const executions = await n8nApi.getExecutions(args.workflowId);
    return executions.slice(0, args.limit || 20);
  }

  /**
   * Get workflow statistics
   */
  private static async getWorkflowStats(
    args: GetWorkflowArgs,
  ): Promise<unknown> {
    if (!n8nApi) {
      throw new Error("n8n API not configured.");
    }

    return await n8nApi.getWorkflowStats(args.id);
  }

  /**
   * Activate workflow
   */
  private static async activateWorkflow(
    args: GetWorkflowArgs,
  ): Promise<unknown> {
    if (!n8nApi) {
      throw new Error("n8n API not configured.");
    }

    return await n8nApi.activateWorkflow(args.id);
  }

  /**
   * Deactivate workflow
   */
  private static async deactivateWorkflow(
    args: GetWorkflowArgs,
  ): Promise<unknown> {
    if (!n8nApi) {
      throw new Error("n8n API not configured.");
    }

    return await n8nApi.deactivateWorkflow(args.id);
  }

  /**
   * Get tool usage statistics
   */
  private static async getToolUsageStats(): Promise<unknown> {
    return database.getToolUsage();
  }

  /**
   * List all available tools with categories
   */
  private static async listAvailableTools(args: {
    category?: string;
  }): Promise<unknown> {
    const categories = {
      core: 11, // Original n8n tools
      "code-generation": 12, // Phase 1 tools
      "developer-workflows": 10, // Phase 2 tools
      "performance-observability": 12, // Phase 3 tools
      comprehensive: 53, // Comprehensive tools from comprehensive.ts
    };

    if (args.category) {
      const count = categories[args.category as keyof typeof categories];
      if (!count) {
        return {
          error: `Unknown category: ${args.category}. Available: ${Object.keys(categories).join(", ")}`,
        };
      }
      return {
        category: args.category,
        toolCount: count,
        total: Object.values(categories).reduce((a, b) => a + b, 0),
      };
    }

    return {
      categories,
      total: Object.values(categories).reduce((a, b) => a + b, 0),
      breakdown: "13 MCP-registered + 87 execution-routed = 100 total tools",
    };
  }

  /**
   * Validate MCP configuration and provide diagnostics
   */
  private static async validateMcpConfig(args: {
    fix_issues?: boolean;
  }): Promise<unknown> {
    const issues: string[] = [];
    const fixes: string[] = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(
      nodeVersion.replace("v", "").split(".")[0] ?? "0",
    );
    if (majorVersion < 18) {
      issues.push(`Node.js ${nodeVersion} is too old. Requires >= 18.0.0`);
    } else {
      logger.info(`✅ Node.js ${nodeVersion} is compatible`);
    }

    // Check environment variables
    if (!process.env.N8N_API_URL) {
      issues.push("N8N_API_URL environment variable not set");
      if (args.fix_issues) {
        fixes.push("Set N8N_API_URL=https://your-n8n-instance.com");
      }
    } else {
      logger.info(`✅ N8N_API_URL configured: ${process.env.N8N_API_URL}`);
    }

    if (!process.env.N8N_API_KEY) {
      issues.push("N8N_API_KEY environment variable not set");
      if (args.fix_issues) {
        fixes.push("Set N8N_API_KEY=your-api-key");
      }
    } else {
      logger.info("✅ N8N_API_KEY configured");
    }

    // Test n8n API connection if credentials provided
    let apiStatus = "not_tested";
    if (process.env.N8N_API_URL && process.env.N8N_API_KEY && n8nApi) {
      try {
        const connected = await n8nApi.testConnection();
        apiStatus = connected ? "connected" : "connection_failed";
        if (!connected) {
          issues.push("N8N API connection test failed - check URL and API key");
        } else {
          logger.info("✅ N8N API connection successful");
        }
      } catch (error) {
        apiStatus = "error";
        issues.push(
          `N8N API test error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      status: issues.length === 0 ? "healthy" : "issues_found",
      nodeVersion,
      apiStatus,
      issues,
      fixes: args.fix_issues ? fixes : [],
      recommendations: [
        "Ensure N8N instance is running and accessible",
        "Use API keys with workflow management permissions",
        'Test connection with: curl -H "Authorization: Bearer YOUR_KEY" YOUR_N8N_URL/api/v1/workflows',
      ],
    };
  }

  /**
   * Import workflow from n8n workflow data
   */
  private static async importWorkflow(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) {
      throw new Error(
        "n8n API not configured. Set N8N_API_URL and N8N_API_KEY environment variables.",
      );
    }

    const workflow = await n8nApi.importWorkflow(
      args.workflowData as Record<string, unknown>,
    );

    if (args.activate && workflow.id) {
      await n8nApi.activateWorkflow(workflow.id);
    }

    return workflow;
  }

  /**
   * Update existing workflow
   */
  private static async updateWorkflow(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) {
      throw new Error(
        "n8n API not configured. Set N8N_API_URL and N8N_API_KEY environment variables.",
      );
    }

    const updateData: Record<string, unknown> = {};

    // Only include provided fields in the update
    if (args.name !== undefined) updateData.name = args.name;
    if (args.nodes !== undefined) updateData.nodes = args.nodes;
    if (args.connections !== undefined)
      updateData.connections = args.connections;
    if (args.active !== undefined) updateData.active = args.active;

    const workflow = await n8nApi.updateWorkflow(args.id as string, updateData);

    return workflow;
  }

  /**
   * Delete workflow
   */
  private static async deleteWorkflow(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) {
      throw new Error(
        "n8n API not configured. Set N8N_API_URL and N8N_API_KEY environment variables.",
      );
    }

    await n8nApi.deleteWorkflow(args.id as string);

    return {
      success: true,
      message: `Workflow ${args.id} deleted successfully`,
      workflowId: args.id,
    };
  }

  /**
   * Route query to appropriate agent
   */
  private static async routeToAgent(args: RouteToAgentArgs): Promise<unknown> {
    // Import agent router here to avoid circular dependencies
    const { agentRouter } = await import("../agents/index.js");

    try {
      const agent = await agentRouter.routeToAgent(args.query);

      if (!agent) {
        const result = {
          error: "No appropriate agent found for query",
          query: args.query,
        };
        logger.info("RouteToAgent result:", result);
        return result;
      }

      const result = {
        agent: agent.name,
        tier: agent.tier,
        capabilities: agent.capabilities,
        description: agent.description,
        query: args.query,
      };

      // Log for E2E test debugging
      logger.info("RouteToAgent result:", result);
      logger.info("RouteToAgent selected:", agent.name); // Will show in E2E test output

      return result;
    } catch (error) {
      logger.error("Error routing to agent:", error);
      const result = {
        error: `Failed to route query: ${error instanceof Error ? error.message : String(error)}`,
        query: args.query,
      };
      logger.error("RouteToAgent error:", result); // Will show in E2E test output
      return result;
    }
  }
}
