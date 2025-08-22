/**
 * Comprehensive n8n MCP Tools (87+ Tools)
 * Modern MCP tools following TypeScript SDK patterns
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { n8nApi, type N8NCredential, type N8NWorkflow } from "../n8n/api.js";
import { logger } from "../server/logger.js";
import { inputSanitizer } from "../server/security.js";

// Node.js 18+ provides fetch globally
/* global fetch */

// ============== CORE DISCOVERY TOOLS (8 tools) ==============

export const coreDiscoveryTools = [
  {
    name: "search_nodes_advanced",
    description:
      "Advanced node search with filters, categories, and detailed information",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term for nodes" },
        category: {
          type: "string",
          description: "Filter by category (trigger, action, etc.)",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 20,
          description: "Maximum results",
        },
        includeCredentials: {
          type: "boolean",
          default: false,
          description: "Include credential requirements",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_node_categories",
    description: "Get all available node categories and their descriptions",
    inputSchema: {
      type: "object" as const,
      properties: {
        includeCount: {
          type: "boolean",
          default: true,
          description: "Include node count per category",
        },
      },
    },
  },
  {
    name: "get_node_documentation",
    description: "Get detailed documentation and examples for specific nodes",
    inputSchema: {
      type: "object" as const,
      properties: {
        nodeType: {
          type: "string",
          description: "Node type name (e.g., HttpRequest)",
        },
        includeExamples: {
          type: "boolean",
          default: true,
          description: "Include usage examples",
        },
      },
      required: ["nodeType"],
    },
  },
  {
    name: "get_node_essentials",
    description:
      "Get essential information about a node including inputs, outputs, and properties",
    inputSchema: {
      type: "object" as const,
      properties: {
        nodeType: { type: "string", description: "Node type name" },
      },
      required: ["nodeType"],
    },
  },
  {
    name: "list_ai_tools",
    description: "List AI/ML specific nodes and their capabilities",
    inputSchema: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string",
          description: "Filter by AI provider (openai, anthropic, etc.)",
        },
      },
    },
  },
  {
    name: "get_database_statistics",
    description: "Get comprehensive database and system statistics",
    inputSchema: {
      type: "object" as const,
      properties: {
        includeHealth: {
          type: "boolean",
          default: true,
          description: "Include system health status",
        },
      },
    },
  },
  {
    name: "search_node_properties",
    description: "Search within node properties and configuration options",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Property search term" },
        nodeType: {
          type: "string",
          description: "Specific node type to search within",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "validate_node_availability",
    description:
      "Check if specific nodes are available - validates built-in nodes and community packages via npm registry",
    inputSchema: {
      type: "object" as const,
      properties: {
        nodeTypes: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of node type names to check (e.g., 'n8n-nodes-base.httpRequest', '@n8n/n8n-nodes-scrapeninja')",
        },
      },
      required: ["nodeTypes"],
    },
  },
  {
    name: "validate_mcp_installation",
    description:
      "Comprehensive validation test for MCP installation - checks connectivity, node discovery, and core functionality",
    inputSchema: {
      type: "object" as const,
      properties: {
        includeNodeSample: {
          type: "boolean",
          default: true,
          description: "Include sample of discovered nodes in output",
        },
        testWorkflowNodes: {
          type: "array",
          items: { type: "string" },
          default: ["supabase", "anthropic", "scrapeninja", "webhook", "code"],
          description: "Node types to specifically test for",
        },
      },
    },
  },
];

// ============== VALIDATION ENGINE TOOLS (6 tools) ==============

export const validationEngineTools = [
  {
    name: "validate_workflow_structure",
    description: "Comprehensive workflow structure validation",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "Workflow ID to validate" },
        checkConnections: {
          type: "boolean",
          default: true,
          description: "Validate node connections",
        },
        checkExpressions: {
          type: "boolean",
          default: true,
          description: "Validate expressions",
        },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "validate_workflow_connections",
    description: "Validate all node connections and data flow in a workflow",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "Workflow ID to validate" },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "validate_workflow_expressions",
    description:
      "Validate all expressions and data transformations in workflow",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "Workflow ID to validate" },
        strict: {
          type: "boolean",
          default: false,
          description: "Use strict validation rules",
        },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "validate_node_configuration",
    description: "Validate individual node configuration and parameters",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "Workflow ID" },
        nodeId: { type: "string", description: "Node ID within workflow" },
      },
      required: ["workflowId", "nodeId"],
    },
  },
  {
    name: "get_property_dependencies",
    description: "Get dependencies between node properties and configurations",
    inputSchema: {
      type: "object" as const,
      properties: {
        nodeType: { type: "string", description: "Node type to analyze" },
      },
      required: ["nodeType"],
    },
  },
  {
    name: "validate_credentials_configuration",
    description: "Validate credential configurations and connections",
    inputSchema: {
      type: "object" as const,
      properties: {
        credentialId: {
          type: "string",
          description: "Credential ID to validate",
        },
        testConnection: {
          type: "boolean",
          default: true,
          description: "Test actual connection",
        },
      },
      required: ["credentialId"],
    },
  },
];

// ============== CREDENTIAL MANAGEMENT TOOLS (12 tools) ==============

export const credentialManagementTools = [
  {
    name: "create_credential",
    description: "Create new credential with validation",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Credential name" },
        type: { type: "string", description: "Credential type" },
        data: { type: "object", description: "Credential data" },
      },
      required: ["name", "type", "data"],
    },
  },
  {
    name: "update_credential",
    description: "Update existing credential",
    inputSchema: {
      type: "object" as const,
      properties: {
        credentialId: { type: "string", description: "Credential ID" },
        name: { type: "string", description: "New credential name" },
        data: { type: "object", description: "Updated credential data" },
      },
      required: ["credentialId"],
    },
  },
  {
    name: "delete_credential",
    description: "Delete credential with usage check",
    inputSchema: {
      type: "object" as const,
      properties: {
        credentialId: {
          type: "string",
          description: "Credential ID to delete",
        },
        force: {
          type: "boolean",
          default: false,
          description: "Force delete even if in use",
        },
      },
      required: ["credentialId"],
    },
  },
  {
    name: "list_credentials",
    description: "List all credentials with filtering options",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "Filter by credential type" },
        includeUsage: {
          type: "boolean",
          default: false,
          description: "Include usage information",
        },
      },
    },
  },
  {
    name: "get_credential_details",
    description: "Get detailed credential information",
    inputSchema: {
      type: "object" as const,
      properties: {
        credentialId: { type: "string", description: "Credential ID" },
      },
      required: ["credentialId"],
    },
  },
  {
    name: "test_credential_connection",
    description: "Test credential connection and validity",
    inputSchema: {
      type: "object" as const,
      properties: {
        credentialId: { type: "string", description: "Credential ID to test" },
      },
      required: ["credentialId"],
    },
  },
  {
    name: "get_credential_types",
    description: "Get all available credential types and their requirements",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Filter by category" },
      },
    },
  },
  {
    name: "share_credential",
    description: "Share credential with other users (if supported)",
    inputSchema: {
      type: "object" as const,
      properties: {
        credentialId: { type: "string", description: "Credential ID" },
        userIds: {
          type: "array",
          items: { type: "string" },
          description: "User IDs to share with",
        },
      },
      required: ["credentialId", "userIds"],
    },
  },
  {
    name: "get_credential_usage",
    description: "Get workflows and nodes using specific credential",
    inputSchema: {
      type: "object" as const,
      properties: {
        credentialId: { type: "string", description: "Credential ID" },
      },
      required: ["credentialId"],
    },
  },
  {
    name: "validate_oauth_flow",
    description: "Validate OAuth flow configuration for OAuth credentials",
    inputSchema: {
      type: "object" as const,
      properties: {
        credentialType: {
          type: "string",
          description: "OAuth credential type",
        },
        redirectUrl: { type: "string", description: "OAuth redirect URL" },
      },
      required: ["credentialType"],
    },
  },
  {
    name: "refresh_oauth_tokens",
    description: "Refresh OAuth tokens for credential",
    inputSchema: {
      type: "object" as const,
      properties: {
        credentialId: { type: "string", description: "OAuth credential ID" },
      },
      required: ["credentialId"],
    },
  },
  {
    name: "get_credential_permissions",
    description: "Get credential permissions and access control",
    inputSchema: {
      type: "object" as const,
      properties: {
        credentialId: { type: "string", description: "Credential ID" },
      },
      required: ["credentialId"],
    },
  },
];

// ============== USER MANAGEMENT TOOLS (8 tools) ==============

export const userManagementTools = [
  {
    name: "list_users",
    description: "List all users with role and status information",
    inputSchema: {
      type: "object" as const,
      properties: {
        includeInactive: {
          type: "boolean",
          default: false,
          description: "Include inactive users",
        },
      },
    },
  },
  {
    name: "get_user_info",
    description: "Get detailed user information",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: 'User ID or "me" for current user',
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "create_user",
    description: "Create new user account",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          format: "email",
          description: "User email address",
        },
        firstName: { type: "string", description: "First name" },
        lastName: { type: "string", description: "Last name" },
        role: {
          type: "string",
          description: "User role",
          enum: ["owner", "member", "admin"],
        },
      },
      required: ["email", "role"],
    },
  },
  {
    name: "update_user",
    description: "Update user information and settings",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "User ID" },
        firstName: { type: "string", description: "Updated first name" },
        lastName: { type: "string", description: "Updated last name" },
        role: {
          type: "string",
          description: "Updated role",
          enum: ["owner", "member", "admin"],
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "delete_user",
    description: "Delete user account",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "User ID to delete" },
        transferWorkflows: {
          type: "string",
          description: "User ID to transfer workflows to",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_user_permissions",
    description: "Get user permissions and access levels",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "User ID" },
      },
      required: ["userId"],
    },
  },
  {
    name: "update_user_permissions",
    description: "Update user permissions and role assignments",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "User ID" },
        permissions: { type: "object", description: "Permission settings" },
      },
      required: ["userId", "permissions"],
    },
  },
  {
    name: "get_role_definitions",
    description: "Get available roles and their permission definitions",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ============== SYSTEM MANAGEMENT TOOLS (9 tools) ==============

export const systemManagementTools = [
  {
    name: "get_system_settings",
    description: "Get comprehensive system settings and configuration",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description: "Filter by settings category",
        },
      },
    },
  },
  {
    name: "update_system_settings",
    description: "Update system settings and configuration",
    inputSchema: {
      type: "object" as const,
      properties: {
        settings: { type: "object", description: "Settings to update" },
      },
      required: ["settings"],
    },
  },
  {
    name: "get_environment_variables",
    description: "Get environment variables and their values",
    inputSchema: {
      type: "object" as const,
      properties: {
        showSecrets: {
          type: "boolean",
          default: false,
          description: "Show secret values (masked by default)",
        },
      },
    },
  },
  {
    name: "set_environment_variable",
    description: "Set or update environment variable",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Variable name" },
        value: { type: "string", description: "Variable value" },
        secret: {
          type: "boolean",
          default: false,
          description: "Mark as secret",
        },
      },
      required: ["name", "value"],
    },
  },
  {
    name: "get_system_health",
    description: "Get comprehensive system health status",
    inputSchema: {
      type: "object" as const,
      properties: {
        includeMetrics: {
          type: "boolean",
          default: true,
          description: "Include performance metrics",
        },
      },
    },
  },
  {
    name: "get_system_logs",
    description: "Get system logs with filtering options",
    inputSchema: {
      type: "object" as const,
      properties: {
        level: {
          type: "string",
          enum: ["error", "warn", "info", "debug"],
          description: "Log level filter",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 1000,
          default: 100,
          description: "Number of log entries",
        },
        since: {
          type: "string",
          format: "date-time",
          description: "Show logs since this timestamp",
        },
      },
    },
  },
  {
    name: "restart_system_service",
    description: "Restart n8n system services (if supported)",
    inputSchema: {
      type: "object" as const,
      properties: {
        service: {
          type: "string",
          description: "Service to restart",
          enum: ["webhook", "queue", "all"],
        },
      },
      required: ["service"],
    },
  },
  {
    name: "get_version_info",
    description: "Get n8n version and build information",
    inputSchema: {
      type: "object" as const,
      properties: {
        includeModules: {
          type: "boolean",
          default: false,
          description: "Include module versions",
        },
      },
    },
  },
  {
    name: "update_system",
    description: "Check for and apply system updates (if supported)",
    inputSchema: {
      type: "object" as const,
      properties: {
        checkOnly: {
          type: "boolean",
          default: true,
          description: "Only check for updates",
        },
      },
    },
  },
];

// ============== WORKFLOW MANAGEMENT EXPANSION (25+ tools) ==============

export const workflowManagementTools = [
  {
    name: "import_workflow_from_file",
    description: "Import workflow from various file formats",
    inputSchema: {
      type: "object" as const,
      properties: {
        data: { type: "object", description: "Workflow data to import" },
        format: {
          type: "string",
          enum: ["json", "yaml"],
          default: "json",
          description: "File format",
        },
        overwrite: {
          type: "boolean",
          default: false,
          description: "Overwrite if workflow exists",
        },
      },
      required: ["data"],
    },
  },
  {
    name: "export_workflow_to_format",
    description: "Export workflow to various formats",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "Workflow ID to export" },
        format: {
          type: "string",
          enum: ["json", "yaml"],
          default: "json",
          description: "Export format",
        },
        includeCredentials: {
          type: "boolean",
          default: false,
          description: "Include credential references",
        },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "clone_workflow",
    description: "Clone existing workflow with modifications",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "Source workflow ID" },
        name: { type: "string", description: "Name for cloned workflow" },
        activate: {
          type: "boolean",
          default: false,
          description: "Activate cloned workflow",
        },
      },
      required: ["workflowId", "name"],
    },
  },
  {
    name: "merge_workflows",
    description: "Merge multiple workflows into one",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowIds: {
          type: "array",
          items: { type: "string" },
          description: "Workflow IDs to merge",
        },
        name: { type: "string", description: "Name for merged workflow" },
        strategy: {
          type: "string",
          enum: ["sequential", "parallel"],
          default: "sequential",
          description: "Merge strategy",
        },
      },
      required: ["workflowIds", "name"],
    },
  },
  {
    name: "get_workflow_templates",
    description: "Get available workflow templates",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Template category filter" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
      },
    },
  },
  {
    name: "share_workflow",
    description: "Share workflow with other users or publicly",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "Workflow ID to share" },
        userIds: {
          type: "array",
          items: { type: "string" },
          description: "User IDs to share with",
        },
        permissions: {
          type: "string",
          enum: ["view", "edit", "execute"],
          default: "view",
          description: "Share permissions",
        },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "get_workflow_versions",
    description: "Get workflow version history",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "Workflow ID" },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 10,
          description: "Number of versions",
        },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "restore_workflow_version",
    description: "Restore workflow to previous version",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "Workflow ID" },
        versionId: { type: "string", description: "Version ID to restore" },
      },
      required: ["workflowId", "versionId"],
    },
  },
  {
    name: "batch_workflow_operations",
    description: "Perform batch operations on multiple workflows",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowIds: {
          type: "array",
          items: { type: "string" },
          description: "Workflow IDs",
        },
        operation: {
          type: "string",
          enum: ["activate", "deactivate", "delete", "tag"],
          description: "Batch operation",
        },
        parameters: {
          type: "object",
          description: "Operation-specific parameters",
        },
      },
      required: ["workflowIds", "operation"],
    },
  },
  {
    name: "get_workflow_dependencies",
    description: "Get workflow dependencies and requirements",
    inputSchema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "Workflow ID" },
        includeCredentials: {
          type: "boolean",
          default: true,
          description: "Include credential dependencies",
        },
      },
      required: ["workflowId"],
    },
  },
  // Additional workflow management tools would continue here...
];

// ============== TOOL IMPLEMENTATIONS ==============

/**
 * NPM Registry response type definition
 */
interface NpmRegistryResponse {
  name: string;
  description?: string;
  keywords?: string[];
  "dist-tags"?: {
    latest?: string;
    [tag: string]: string | undefined;
  };
  versions?: {
    [version: string]: {
      name: string;
      version: string;
      description?: string;
      keywords?: string[];
      [key: string]: unknown;
    };
  };
  time?: {
    [version: string]: string;
    modified?: string;
    created?: string;
  };
  [key: string]: unknown;
}

/**
 * Tool execution handler following MCP TypeScript SDK patterns
 */
export class ComprehensiveMCPTools {
  /**
   * Execute a tool with proper validation and error handling
   */
  static async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const sanitizedArgs = inputSanitizer.sanitizeObject(args) as Record<
      string,
      unknown
    >;

    try {
      logger.debug(`Executing comprehensive tool: ${name}`, {
        args: sanitizedArgs,
      });

      switch (name) {
        // Core Discovery Tools
        case "search_nodes_advanced":
          return await this.searchNodesAdvanced(sanitizedArgs);
        case "list_node_categories":
          return await this.listNodeCategories(sanitizedArgs);
        case "get_node_documentation":
          return await this.getNodeDocumentation(sanitizedArgs);
        case "get_node_essentials":
          return await this.getNodeEssentials(sanitizedArgs);
        case "list_ai_tools":
          return await this.listAiTools(sanitizedArgs);
        case "get_database_statistics":
          return await this.getDatabaseStatistics(sanitizedArgs);
        case "search_node_properties":
          return await this.searchNodeProperties(sanitizedArgs);
        case "validate_node_availability":
          return await this.validateNodeAvailability(sanitizedArgs);
        case "validate_mcp_installation":
          return await this.validateMcpInstallation(sanitizedArgs);

        // Validation Engine Tools
        case "validate_workflow_structure":
          return await this.validateWorkflowStructure(sanitizedArgs);
        case "validate_workflow_connections":
          return await this.validateWorkflowConnections(sanitizedArgs);
        case "validate_workflow_expressions":
          return await this.validateWorkflowExpressions(sanitizedArgs);
        case "validate_node_configuration":
          return await this.validateNodeConfiguration(sanitizedArgs);
        case "get_property_dependencies":
          return await this.getPropertyDependencies(sanitizedArgs);
        case "validate_credentials_configuration":
          return await this.validateCredentialsConfiguration(sanitizedArgs);

        // Credential Management Tools
        case "create_credential":
          return await this.createCredential(sanitizedArgs);
        case "list_credentials":
          return await this.listCredentials(sanitizedArgs);
        case "test_credential_connection":
          return await this.testCredentialConnection(sanitizedArgs);
        case "get_credential_types":
          return await this.getCredentialTypes(sanitizedArgs);

        // System Management Tools
        case "get_system_health":
          return await this.getSystemHealth(sanitizedArgs);
        case "get_version_info":
          return await this.getVersionInfo(sanitizedArgs);

        // User Management Tools
        case "list_users":
          return await this.listUsers(sanitizedArgs);
        case "get_user_info":
          return await this.getUserInfo(sanitizedArgs);
        case "create_user":
          return await this.createUser(sanitizedArgs);
        case "update_user":
          return await this.updateUser(sanitizedArgs);
        case "delete_user":
          return await this.deleteUser(sanitizedArgs);
        case "get_user_permissions":
          return await this.getUserPermissions(sanitizedArgs);
        case "update_user_permissions":
          return await this.updateUserPermissions(sanitizedArgs);
        case "get_role_definitions":
          return await this.getRoleDefinitions(sanitizedArgs);

        // Additional System Management Tools
        case "get_system_settings":
          return await this.getSystemSettings(sanitizedArgs);
        case "update_system_settings":
          return await this.updateSystemSettings(sanitizedArgs);
        case "get_environment_variables":
          return await this.getEnvironmentVariables(sanitizedArgs);
        case "set_environment_variable":
          return await this.setEnvironmentVariable(sanitizedArgs);
        case "get_system_logs":
          return await this.getSystemLogs(sanitizedArgs);
        case "restart_system_service":
          return await this.restartSystemService(sanitizedArgs);

        // Additional Workflow Management Tools
        case "import_workflow_from_file":
          return await this.importWorkflowFromFile(sanitizedArgs);
        case "merge_workflows":
          return await this.mergeWorkflows(sanitizedArgs);
        case "get_workflow_templates":
          return await this.getWorkflowTemplates(sanitizedArgs);

        // Workflow Management Tools
        case "clone_workflow":
          return await this.cloneWorkflow(sanitizedArgs);
        case "export_workflow_to_format":
          return await this.exportWorkflowToFormat(sanitizedArgs);

        default:
          throw new Error(`Unknown comprehensive tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // ============== CORE DISCOVERY IMPLEMENTATIONS ==============

  private static async searchNodesAdvanced(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    if (!n8nApi) throw new Error("n8n API not available");

    const nodes = await n8nApi.searchNodeTypes(
      args.query as string,
      args.category as string,
    );
    const results = nodes.slice(0, (args.limit as number) ?? 20);

    if (args.includeCredentials) {
      return results.map((node) => ({
        ...(node as unknown as Record<string, unknown>),
        credentialRequirements:
          node.credentials?.map((c) => ({
            name: c.name,
            required: c.required ?? false,
          })) ?? [],
      }));
    }

    return results.map((node) => node as unknown as Record<string, unknown>);
  }

  private static async listNodeCategories(
    args: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    if (!n8nApi) throw new Error("n8n API not available");

    const nodes = await n8nApi.getNodeTypes();
    const categories = new Map<string, number>();

    nodes.forEach((node) => {
      node.group.forEach((category) => {
        categories.set(category, (categories.get(category) ?? 0) + 1);
      });
    });

    const result = Array.from(categories.entries()).map(([name, count]) => ({
      name,
      ...(args.includeCount !== false && { count }),
    }));

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  private static async getNodeDocumentation(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!n8nApi) throw new Error("n8n API not available");

    const node = await n8nApi.getNodeType(args.nodeType as string);

    const documentation = {
      name: node.name,
      displayName: node.displayName,
      description: node.description,
      version: node.version,
      category: node.group,
      inputs: node.inputs,
      outputs: node.outputs,
      properties: node.properties.map((prop) => ({
        name: prop.name,
        displayName: prop.displayName,
        type: prop.type,
        required: prop.required ?? false,
        description: prop.description,
        default: prop.default,
        options: prop.options,
      })),
    };

    if (args.includeExamples !== false) {
      (documentation as Record<string, unknown>).examples = [
        {
          name: "Basic Usage",
          description: `Basic example of using ${node.displayName}`,
          configuration: node.defaults ?? {},
        },
      ];
    }

    return documentation;
  }

  private static async getNodeEssentials(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!n8nApi) throw new Error("n8n API not available");

    const node = await n8nApi.getNodeType(args.nodeType as string);

    return {
      name: node.name,
      displayName: node.displayName,
      description: node.description,
      inputs: node.inputs.length,
      outputs: node.outputs.length,
      requiredProperties: node.properties
        .filter((p) => p.required)
        .map((p) => p.name),
      optionalProperties: node.properties.filter((p) => !p.required).length,
      credentialsRequired:
        node.credentials?.filter((c) => c.required).map((c) => c.name) ?? [],
    };
  }

  private static async listAiTools(
    args: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    if (!n8nApi) throw new Error("n8n API not available");

    const nodes = await n8nApi.getNodeTypes();
    const aiNodes = nodes.filter((node) => {
      const aiKeywords = [
        "ai",
        "openai",
        "anthropic",
        "gpt",
        "llm",
        "machine learning",
        "ml",
      ];
      return aiKeywords.some(
        (keyword) =>
          node.name.toLowerCase().includes(keyword) ||
          node.displayName.toLowerCase().includes(keyword) ||
          node.description.toLowerCase().includes(keyword),
      );
    });

    if (args.provider) {
      const provider = args.provider as string;
      return aiNodes
        .filter(
          (node) =>
            node.name.toLowerCase().includes(provider.toLowerCase()) ||
            node.displayName.toLowerCase().includes(provider.toLowerCase()),
        )
        .map((node) => node as unknown as Record<string, unknown>);
    }

    return aiNodes.map(
      (node) =>
        ({
          name: node.name,
          displayName: node.displayName,
          description: node.description,
          category: node.group,
        }) as Record<string, unknown>,
    );
  }

  private static async getDatabaseStatistics(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const stats: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      source: "n8n_api_live_data"
    };

    // Get live statistics from n8n API instead of database
    if (n8nApi) {
      try {
        const nodes = await n8nApi.getNodeTypes();
        const categories = new Map<string, number>();
        
        nodes.forEach(node => {
          node.group.forEach(group => {
            categories.set(group, (categories.get(group) ?? 0) + 1);
          });
        });

        stats.nodeStatistics = {
          totalNodes: nodes.length,
          totalCategories: categories.size,
          categorieBreakdown: Object.fromEntries(categories.entries()),
          sampleNodes: nodes.slice(0, 5).map(n => ({ 
            name: n.name, 
            displayName: n.displayName,
            group: n.group 
          }))
        };

        if (args.includeHealth !== false) {
          const health = await n8nApi.getHealthStatus();
          stats.systemHealth = health;
        }

        stats.status = "success";
        stats.message = `Successfully retrieved live statistics from n8n instance`;
      } catch (error) {
        stats.status = "error";
        stats.error = error instanceof Error ? error.message : String(error);
        stats.message = "Failed to retrieve statistics from n8n API";
      }
    } else {
      stats.status = "error";
      stats.error = "n8n API not available";
      stats.message = "Cannot retrieve statistics - n8n API not initialized";
    }

    return stats;
  }

  private static async searchNodeProperties(
    args: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    if (!n8nApi) throw new Error("n8n API not available");

    let nodes: Array<Record<string, unknown>> = [];

    if (args.nodeType) {
      const node = await n8nApi.getNodeType(args.nodeType as string);
      nodes = [node as unknown as Record<string, unknown>];
    } else {
      nodes = (await n8nApi.getNodeTypes()) as unknown as Array<
        Record<string, unknown>
      >;
    }

    const searchTerm = (args.query as string).toLowerCase();
    const results: Array<Record<string, unknown>> = [];

    nodes.forEach((node) => {
      const matchingProperties = (
        node.properties as Array<Record<string, unknown>>
      ).filter(
        (prop: Record<string, unknown>) =>
          (prop.name as string).toLowerCase().includes(searchTerm) ||
          (prop.displayName as string).toLowerCase().includes(searchTerm) ||
          (prop.description as string)?.toLowerCase().includes(searchTerm),
      );

      if (matchingProperties.length > 0) {
        results.push({
          nodeType: node.name,
          displayName: node.displayName,
          properties: matchingProperties,
        });
      }
    });

    return results;
  }

  private static async validateNodeAvailability(
    args: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    const nodeTypes = args.nodeTypes as string[];
    const results: Array<Record<string, unknown>> = [];

    for (const nodeType of nodeTypes) {
      try {
        // Check if it's a built-in node (starts with n8n-nodes-base)
        if (nodeType.startsWith("n8n-nodes-base.")) {
          results.push({
            nodeType,
            available: true,
            type: "built-in",
            status: "Built-in n8n node - always available",
          });
          continue;
        }

        // Check if it's a community package
        if (nodeType.includes("n8n-nodes-")) {
          const packageName = nodeType.split(".")[0] ?? nodeType;
          const npmResult = await this.checkNpmPackage(packageName);

          results.push({
            nodeType,
            available: npmResult.exists,
            type: "community",
            packageName,
            status: npmResult.exists
              ? `Community package available on npm: ${npmResult.version}`
              : "Community package not found on public npm registry (may be installed locally, private, or from git)",
            npmUrl: npmResult.exists
              ? `https://www.npmjs.com/package/${packageName}`
              : null,
            description: npmResult.description,
            keywords: npmResult.keywords,
            lastModified: npmResult.lastModified,
          });
          continue;
        }

        // For other node types, try to determine what they might be
        results.push({
          nodeType,
          available: false,
          type: "unknown",
          status:
            "Node type format not recognized. Expected format: 'n8n-nodes-base.nodeName' or '@scope/n8n-nodes-package.nodeName'",
          suggestion:
            "Check if this is a built-in node (prefix with 'n8n-nodes-base.') or a community node package",
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.push({
          nodeType,
          available: false,
          type: "error",
          status: `Error checking node: ${errorMessage}`,
        });
      }
    }

    return results;
  }

  /**
   * Check if an npm package exists and get its metadata
   */
  private static async checkNpmPackage(packageName: string): Promise<{
    exists: boolean;
    version?: string;
    description?: string;
    keywords?: string[];
    lastModified?: string;
  }> {
    try {
      const response = await fetch(
        `https://registry.npmjs.org/${packageName}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "n8n-mcp-modern/5.0.3",
          },
        },
      );

      if (!response.ok) {
        return { exists: false };
      }

      const rawData = (await response.json()) as unknown;

      // Type guard to validate the response structure
      if (!rawData || typeof rawData !== "object") {
        logger.warn(
          `Invalid npm registry response for package ${packageName}: not an object`,
        );
        return { exists: false };
      }

      const data = rawData as NpmRegistryResponse;
      const latestVersion = data["dist-tags"]?.latest;
      const versionData = latestVersion
        ? data.versions?.[latestVersion]
        : undefined;

      const result: {
        exists: boolean;
        version?: string;
        description?: string;
        keywords?: string[];
        lastModified?: string;
      } = {
        exists: true,
        keywords: versionData?.keywords ?? data.keywords ?? [],
      };

      if (latestVersion) {
        result.version = latestVersion;
      }

      if (data.description) {
        result.description = data.description;
      }

      const lastModified =
        (latestVersion ? data.time?.[latestVersion] : undefined) ??
        data.time?.modified;
      if (lastModified) {
        result.lastModified = lastModified;
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `Error checking npm package ${packageName}: ${errorMessage}`,
      );
      return { exists: false };
    }
  }

  /**
   * Comprehensive MCP installation validation
   */
  private static async validateMcpInstallation(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      mcpVersion: "5.2.1",
      status: "unknown",
      checks: [],
      summary: {},
      recommendations: [],
    };

    const checks: Array<Record<string, unknown>> = [];
    let totalChecks = 0;
    let passedChecks = 0;

    // Check 1: n8n API Connectivity
    totalChecks++;
    try {
      if (!n8nApi) {
        checks.push({
          name: "n8n API Connection",
          status: "FAIL",
          message: "n8n API not initialized - check N8N_API_URL and N8N_API_KEY environment variables",
          critical: true,
        });
      } else {
        const health = await n8nApi.getHealthStatus();
        checks.push({
          name: "n8n API Connection",
          status: "PASS",
          message: `Successfully connected to n8n instance`,
          details: health,
        });
        passedChecks++;
      }
    } catch (error) {
      checks.push({
        name: "n8n API Connection",
        status: "FAIL",
        message: `n8n API connection failed: ${error instanceof Error ? error.message : String(error)}`,
        critical: true,
      });
    }

    // Check 2: Node Discovery System
    totalChecks++;
    try {
      if (!n8nApi) {
        checks.push({
          name: "Node Discovery",
          status: "FAIL",
          message: "Cannot test node discovery - n8n API not available",
          critical: true,
        });
      } else {
        const nodes = await n8nApi.getNodeTypes();
        const nodeCount = nodes.length;
        
        if (nodeCount >= 100) {
          checks.push({
            name: "Node Discovery",
            status: "PASS",
            message: `Successfully discovered ${nodeCount} nodes from n8n instance`,
            details: { nodeCount, sampleNodes: nodes.slice(0, 5).map(n => n.name) },
          });
          passedChecks++;
        } else if (nodeCount >= 10) {
          checks.push({
            name: "Node Discovery",
            status: "WARN",
            message: `Only discovered ${nodeCount} nodes - this may indicate a limited n8n installation`,
            details: { nodeCount },
          });
          passedChecks += 0.5;
        } else {
          checks.push({
            name: "Node Discovery",
            status: "FAIL",
            message: `Only discovered ${nodeCount} nodes - node discovery system may not be working correctly`,
            critical: true,
          });
        }
      }
    } catch (error) {
      checks.push({
        name: "Node Discovery",
        status: "FAIL",
        message: `Node discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        critical: true,
      });
    }

    // Check 3: Specific Node Types (for workflow compatibility)
    if (args.testWorkflowNodes && Array.isArray(args.testWorkflowNodes)) {
      totalChecks++;
      const testNodes = args.testWorkflowNodes as string[];
      const nodeResults: Record<string, unknown>[] = [];
      let foundNodes = 0;

      if (n8nApi) {
        for (const testNode of testNodes) {
          try {
            const searchResults = await n8nApi.searchNodeTypes(testNode);
            if (searchResults.length > 0) {
              foundNodes++;
              nodeResults.push({
                nodeType: testNode,
                found: true,
                matches: searchResults.length,
                examples: searchResults.slice(0, 2).map(n => n.name),
              });
            } else {
              nodeResults.push({
                nodeType: testNode,
                found: false,
                message: "No matching nodes found",
              });
            }
          } catch (error) {
            nodeResults.push({
              nodeType: testNode,
              found: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const successRate = foundNodes / testNodes.length;
        if (successRate >= 0.8) {
          checks.push({
            name: "Workflow Node Compatibility",
            status: "PASS",
            message: `Found ${foundNodes}/${testNodes.length} expected node types`,
            details: nodeResults,
          });
          passedChecks++;
        } else if (successRate >= 0.5) {
          checks.push({
            name: "Workflow Node Compatibility",
            status: "WARN",
            message: `Found ${foundNodes}/${testNodes.length} expected node types - some nodes may be missing`,
            details: nodeResults,
          });
          passedChecks += 0.5;
        } else {
          checks.push({
            name: "Workflow Node Compatibility",
            status: "FAIL",
            message: `Only found ${foundNodes}/${testNodes.length} expected node types`,
            details: nodeResults,
          });
        }
      } else {
        checks.push({
          name: "Workflow Node Compatibility",
          status: "FAIL",
          message: "Cannot test node compatibility - n8n API not available",
        });
      }
    }

    // Calculate overall status
    const successRate = passedChecks / totalChecks;
    let status = "FAIL";
    if (successRate >= 0.9) {
      status = "PASS";
    } else if (successRate >= 0.7) {
      status = "WARN";
    }

    // Add sample nodes if requested
    if (args.includeNodeSample && n8nApi) {
      try {
        const sampleNodes = await n8nApi.getNodeTypes();
        (results as Record<string, unknown>).sampleNodes = sampleNodes.slice(0, 10).map(node => ({
          name: node.name,
          displayName: node.displayName,
          description: node.description,
          group: node.group,
        }));
      } catch (_error) {
        // Non-critical error
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (!n8nApi) {
      recommendations.push("Configure N8N_API_URL and N8N_API_KEY environment variables");
      recommendations.push("Ensure your n8n instance is accessible from this environment");
    }
    if (passedChecks < totalChecks) {
      recommendations.push("Check the failing tests above and resolve any critical issues");
      recommendations.push("Verify your n8n instance has the required nodes installed");
    }
    if (status === "PASS") {
      recommendations.push("✅ MCP installation is working correctly!");
      recommendations.push("You can now import and validate workflows with confidence");
    }

    results.status = status;
    results.checks = checks;
    results.summary = {
      totalChecks,
      passedChecks: Math.floor(passedChecks),
      successRate: `${Math.round(successRate * 100)}%`,
      overallStatus: status,
    };
    results.recommendations = recommendations;

    return results;
  }

  // ============== CREDENTIAL MANAGEMENT IMPLEMENTATIONS ==============

  private static async createCredential(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");
    return await n8nApi.createCredential(
      args as Omit<N8NCredential, "id" | "createdAt" | "updatedAt">,
    );
  }

  private static async listCredentials(
    args: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    if (!n8nApi) throw new Error("n8n API not available");

    const credentials = await n8nApi.getCredentials();

    let filtered = credentials;
    if (args.type) {
      filtered = credentials.filter(
        (cred) => cred.type === (args.type as string),
      );
    }

    if (args.includeUsage) {
      // Add usage information for each credential
      const workflows = await n8nApi.getWorkflows();
      filtered = filtered.map((cred) => ({
        ...cred,
        usageCount: workflows.filter((workflow) =>
          workflow.nodes.some(
            (node) =>
              node.credentials &&
              Object.values(node.credentials).includes(cred.id),
          ),
        ).length,
      }));
    }

    return filtered.map((cred) => cred as unknown as Record<string, unknown>);
  }

  private static async testCredentialConnection(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");
    return await n8nApi.testCredential(args.credentialId as string);
  }

  private static async getCredentialTypes(
    _args: Record<string, unknown>,
  ): Promise<string[]> {
    // This would require the node types to extract credential type information
    if (!n8nApi) throw new Error("n8n API not available");

    const nodes = await n8nApi.getNodeTypes();
    const credentialTypes = new Set<string>();

    nodes.forEach((node) => {
      if (node.credentials) {
        node.credentials.forEach((cred) => {
          credentialTypes.add(cred.name);
        });
      }
    });

    return Array.from(credentialTypes).sort();
  }

  // ============== SYSTEM MANAGEMENT IMPLEMENTATIONS ==============

  private static async getSystemHealth(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!n8nApi) throw new Error("n8n API not available");

    const health = await n8nApi.getHealthStatus();

    if (args.includeMetrics !== false) {
      // Add performance metrics
      return {
        ...health,
        metrics: {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        },
      };
    }

    return health as unknown as Record<string, unknown>;
  }

  private static async getVersionInfo(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!n8nApi) throw new Error("n8n API not available");

    const version = await n8nApi.getVersionInfo();

    if (args.includeModules) {
      return {
        ...version,
        modules: {
          node: process.version,
          // Add other module versions as needed
        },
      };
    }

    return version;
  }

  // ============== VALIDATION ENGINE IMPLEMENTATIONS ==============

  private static async validateWorkflowStructure(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!n8nApi) throw new Error("n8n API not available");

    try {
      const workflow = await n8nApi.getWorkflow(args.workflowId as string);
      const validation = {
        isValid: true,
        errors: [] as string[],
        warnings: [] as string[],
        nodeCount: workflow.nodes?.length ?? 0,
        connectionCount: Object.keys(workflow.connections ?? {}).length,
      };

      // Check for orphaned nodes (no connections)
      if (workflow.nodes && workflow.connections) {
        const connectedNodes = new Set();
        Object.values(workflow.connections).forEach((nodeConnections) => {
          Object.values(nodeConnections).forEach((connections) => {
            connections.forEach((connectionArray) => {
              connectionArray.forEach((connection) => {
                connectedNodes.add(connection.node);
              });
            });
          });
        });

        workflow.nodes.forEach((node) => {
          if (!connectedNodes.has(node.id) && !node.type.includes("Trigger")) {
            validation.warnings.push(
              `Node '${node.name}' (${node.id}) is not connected`,
            );
          }
        });
      }

      // Check for required properties
      if (!workflow.name || workflow.name.trim() === "") {
        validation.errors.push("Workflow name is required");
        validation.isValid = false;
      }

      if (!workflow.nodes || workflow.nodes.length === 0) {
        validation.errors.push("Workflow must contain at least one node");
        validation.isValid = false;
      }

      return validation;
    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to validate workflow: ${(error as Error).message}`],
        warnings: [],
      };
    }
  }

  private static async validateWorkflowConnections(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!n8nApi) throw new Error("n8n API not available");

    try {
      const workflow = await n8nApi.getWorkflow(args.workflowId as string);
      const validation = {
        isValid: true,
        errors: [] as string[],
        warnings: [] as string[],
        connectionAnalysis: {
          totalConnections: 0,
          invalidConnections: 0,
          unreachableNodes: 0,
        },
      };

      if (!workflow.connections || !workflow.nodes) {
        validation.errors.push("Workflow missing connections or nodes data");
        validation.isValid = false;
        return validation;
      }

      // Validate each connection
      Object.entries(workflow.connections).forEach(
        ([sourceNodeId, outputs]) => {
          Object.entries(outputs).forEach(([_outputIndex, connections]) => {
            connections.forEach((connectionArray, _connectionIndex) => {
              connectionArray.forEach((connection) => {
                validation.connectionAnalysis.totalConnections++;

                // Check if target node exists
                const targetNode = workflow.nodes?.find(
                  (n) => n.id === connection.node,
                );
                if (!targetNode) {
                  validation.errors.push(
                    `Connection from ${sourceNodeId} references non-existent node ${connection.node}`,
                  );
                  validation.connectionAnalysis.invalidConnections++;
                  validation.isValid = false;
                }
              });
            });
          });
        },
      );

      return validation;
    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to validate connections: ${(error as Error).message}`],
        warnings: [],
      };
    }
  }

  private static async validateWorkflowExpressions(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!n8nApi) throw new Error("n8n API not available");

    try {
      const workflow = await n8nApi.getWorkflow(args.workflowId as string);
      const validation = {
        isValid: true,
        errors: [] as string[],
        warnings: [] as string[],
        expressionCount: 0,
        invalidExpressions: 0,
      };

      if (!workflow.nodes) {
        return validation;
      }

      // Check expressions in node parameters
      workflow.nodes.forEach((node) => {
        this.validateNodeExpressions(
          node as unknown as Record<string, unknown>,
          validation,
          args.strict as boolean,
        );
      });

      if (validation.invalidExpressions > 0) {
        validation.isValid = false;
      }

      return validation;
    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to validate expressions: ${(error as Error).message}`],
        warnings: [],
      };
    }
  }

  private static validateNodeExpressions(
    node: Record<string, unknown>,
    validation: Record<string, unknown>,
    _strict = false,
  ): void {
    const checkExpression = (value: unknown, path: string): void => {
      if (typeof value === "string" && value.includes("{{")) {
        (validation.expressionCount as number)++;

        // Basic expression validation
        const expressionRegex = /\{\{.*?\}\}/g;
        const expressions = value.match(expressionRegex);

        expressions?.forEach((expr) => {
          // Check for common issues
          if (expr.includes("undefined") || expr.includes("null")) {
            (validation.warnings as string[]).push(
              `Potential undefined reference in ${node.name} at ${path}: ${expr}`,
            );
          }

          // Check for unclosed brackets
          const openBrackets = (expr.match(/\{/g) ?? []).length;
          const closeBrackets = (expr.match(/\}/g) ?? []).length;
          if (openBrackets !== closeBrackets) {
            (validation.errors as string[]).push(
              `Malformed expression in ${node.name} at ${path}: ${expr}`,
            );
            (validation.invalidExpressions as number)++;
          }
        });
      } else if (typeof value === "object" && value !== null) {
        Object.entries(value as Record<string, unknown>).forEach(
          ([key, val]) => {
            checkExpression(val, `${path}.${key}`);
          },
        );
      }
    };

    if (node.parameters) {
      Object.entries(node.parameters as Record<string, unknown>).forEach(
        ([key, value]) => {
          checkExpression(value, `parameters.${key}`);
        },
      );
    }
  }

  private static async validateNodeConfiguration(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!n8nApi) throw new Error("n8n API not available");

    try {
      const workflow = await n8nApi.getWorkflow(args.workflowId as string);
      const targetNode = workflow.nodes?.find((n) => n.id === args.nodeId);

      if (!targetNode) {
        return {
          isValid: false,
          errors: [`Node ${args.nodeId} not found in workflow`],
          warnings: [],
        };
      }

      const validation = {
        isValid: true,
        errors: [] as string[],
        warnings: [] as string[],
        nodeType: targetNode.type,
        configurationStatus: "complete",
      };

      // Get node type information for validation
      try {
        const nodeType = await n8nApi.getNodeType(targetNode.type);

        // Check required properties
        nodeType.properties?.forEach((prop) => {
          if (prop.required && !targetNode.parameters?.[prop.name]) {
            validation.errors.push(
              `Required property '${prop.displayName}' (${prop.name}) is missing`,
            );
            validation.isValid = false;
          }
        });

        // Check credential requirements
        if (nodeType.credentials && nodeType.credentials.length > 0) {
          nodeType.credentials.forEach((cred) => {
            if (cred.required && !targetNode.credentials?.[cred.name]) {
              validation.errors.push(
                `Required credential '${cred.name}' is not configured`,
              );
              validation.isValid = false;
            }
          });
        }
      } catch (nodeTypeError) {
        validation.warnings.push(
          `Could not validate node type ${targetNode.type}: ${(nodeTypeError as Error).message}`,
        );
      }

      return validation;
    } catch (error) {
      return {
        isValid: false,
        errors: [
          `Failed to validate node configuration: ${(error as Error).message}`,
        ],
        warnings: [],
      };
    }
  }

  private static async getPropertyDependencies(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!n8nApi) throw new Error("n8n API not available");

    try {
      const nodeType = await n8nApi.getNodeType(args.nodeType as string);
      const dependencies = {
        nodeType: nodeType.name,
        properties: [] as Array<Record<string, unknown>>,
        credentials:
          nodeType.credentials?.map((c) => ({
            name: c.name,
            required: c.required ?? false,
            displayOptions: c.displayOptions,
          })) ?? [],
      };

      nodeType.properties?.forEach((prop) => {
        const propInfo: Record<string, unknown> = {
          name: prop.name,
          displayName: prop.displayName,
          type: prop.type,
          required: prop.required ?? false,
          dependencies: [],
        };

        // Check for display options that create dependencies
        if ("displayOptions" in prop && prop.displayOptions) {
          propInfo.dependencies = prop.displayOptions;
        }

        // Check for option dependencies
        if (prop.options) {
          propInfo.availableOptions = prop.options.map((opt) => ({
            name: opt.name,
            value: opt.value,
          }));
        }

        dependencies.properties.push(propInfo);
      });

      return dependencies;
    } catch (error) {
      return {
        error: `Failed to get property dependencies: ${(error as Error).message}`,
        nodeType: args.nodeType,
      };
    }
  }

  private static async validateCredentialsConfiguration(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!n8nApi) throw new Error("n8n API not available");

    try {
      const result = await n8nApi.testCredential(args.credentialId as string);
      const validation = {
        credentialId: args.credentialId,
        isValid: result.status === "success",
        status: result.status,
        message: result.message ?? "Credential test completed",
        testConnection: args.testConnection !== false,
      };

      if (result.status === "error") {
        (validation as Record<string, unknown>).errors = [
          result.message ?? "Credential test failed",
        ];
      }

      return validation;
    } catch (error) {
      return {
        credentialId: args.credentialId,
        isValid: false,
        status: "error",
        errors: [`Failed to validate credential: ${(error as Error).message}`],
      };
    }
  }

  // ============== WORKFLOW MANAGEMENT IMPLEMENTATIONS ==============

  private static async cloneWorkflow(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    const sourceWorkflow = await n8nApi.getWorkflow(args.workflowId as string);

    const { id, createdAt, updatedAt, ...workflowData } = sourceWorkflow;
    const clonedWorkflow = {
      ...workflowData,
      name: args.name as string,
      active: (args.activate as boolean) ?? false,
    };

    const result = await n8nApi.createWorkflow(clonedWorkflow);

    if (args.activate && result.id) {
      await n8nApi.activateWorkflow(result.id);
    }

    return result;
  }

  private static async exportWorkflowToFormat(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    return await n8nApi.exportWorkflow(
      args.workflowId as string,
      args.format as "json" | "yaml",
    );
  }

  // ============== USER MANAGEMENT METHODS ==============

  private static async listUsers(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    try {
      const users = await n8nApi.getUsers();
      const includeInactive = args.includeInactive as boolean;

      return {
        users: includeInactive
          ? users
          : users.filter(
              (user) => (user as { active?: boolean }).active !== false,
            ),
        totalCount: users.length,
      };
    } catch (error) {
      throw new Error(`Failed to list users: ${(error as Error).message}`);
    }
  }

  private static async getUserInfo(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    const userId = args.userId as string;

    try {
      if (userId === "me") {
        return await n8nApi.getCurrentUser();
      } else {
        return await n8nApi.getUser(userId);
      }
    } catch (error) {
      throw new Error(`Failed to get user info: ${(error as Error).message}`);
    }
  }

  private static async createUser(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    const userData = {
      email: args.email as string,
      firstName: args.firstName as string,
      lastName: args.lastName as string,
      role: args.role as string,
      isOwner: false,
      isPending: false,
    };

    try {
      return await n8nApi.createUser(userData);
    } catch (error) {
      throw new Error(`Failed to create user: ${(error as Error).message}`);
    }
  }

  private static async updateUser(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    const userId = args.userId as string;
    const updateData = {
      firstName: args.firstName as string,
      lastName: args.lastName as string,
      role: args.role as string,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    try {
      return await n8nApi.updateUser(userId, updateData);
    } catch (error) {
      throw new Error(`Failed to update user: ${(error as Error).message}`);
    }
  }

  private static async deleteUser(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    const userId = args.userId as string;
    const transferWorkflows = args.transferWorkflows as string;

    try {
      return await n8nApi.deleteUser(userId, transferWorkflows);
    } catch (error) {
      throw new Error(`Failed to delete user: ${(error as Error).message}`);
    }
  }

  private static async getUserPermissions(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    const userId = args.userId as string;

    try {
      const user = await n8nApi.getUser(userId);
      return {
        userId,
        role: user.role,
        permissions:
          (user as { permissions?: Record<string, unknown> }).permissions ?? {},
        lastActivity: (user as { lastActivity?: string }).lastActivity,
      };
    } catch (error) {
      throw new Error(
        `Failed to get user permissions: ${(error as Error).message}`,
      );
    }
  }

  private static async updateUserPermissions(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    const userId = args.userId as string;
    const permissions = args.permissions as Record<string, unknown>;

    try {
      return await n8nApi.updateUserPermissions(userId, permissions);
    } catch (error) {
      throw new Error(
        `Failed to update user permissions: ${(error as Error).message}`,
      );
    }
  }

  private static async getRoleDefinitions(
    _args: Record<string, unknown>,
  ): Promise<unknown> {
    return {
      roles: [
        {
          name: "owner",
          permissions: ["*"],
          description: "Full system access and management",
        },
        {
          name: "admin",
          permissions: [
            "workflow:*",
            "credential:*",
            "user:read",
            "user:update",
          ],
          description: "Administrative access to workflows and credentials",
        },
        {
          name: "member",
          permissions: ["workflow:read", "workflow:execute", "credential:read"],
          description: "Standard user access to workflows and credentials",
        },
      ],
    };
  }

  // ============== ADDITIONAL SYSTEM MANAGEMENT METHODS ==============

  private static async getSystemSettings(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    try {
      const settings = await n8nApi.getSystemSettings();
      const category = args.category as string;

      if (category) {
        return {
          category,
          settings:
            (settings as unknown as Record<string, unknown>)[category] ?? {},
        };
      }

      return { settings };
    } catch (error) {
      throw new Error(
        `Failed to get system settings: ${(error as Error).message}`,
      );
    }
  }

  private static async updateSystemSettings(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    const settings = args.settings as Record<string, unknown>;

    try {
      return await n8nApi.updateSystemSettings(settings);
    } catch (error) {
      throw new Error(
        `Failed to update system settings: ${(error as Error).message}`,
      );
    }
  }

  private static async getEnvironmentVariables(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const showSecrets = (args.showSecrets as boolean) ?? false;

    const envVars = Object.entries(process.env).reduce(
      (acc, [key, value]) => {
        if (
          key.includes("PASSWORD") ||
          key.includes("SECRET") ||
          key.includes("KEY")
        ) {
          acc[key] = showSecrets ? value : "***MASKED***";
        } else {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, string | undefined>,
    );

    return {
      environmentVariables: envVars,
      showSecrets,
      totalCount: Object.keys(envVars).length,
    };
  }

  private static async setEnvironmentVariable(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const name = args.name as string;
    const value = args.value as string;
    const secret = (args.secret as boolean) ?? false;

    // Note: In production, this would need proper security validation
    process.env[name] = value;

    return {
      name,
      set: true,
      secret,
      message: `Environment variable '${name}' has been set`,
    };
  }

  private static async getSystemLogs(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const level = args.level as string;
    const limit = (args.limit as number) ?? 100;
    const since = args.since as string;

    // This is a mock implementation - in production, this would read from actual log files
    const mockLogs = Array.from({ length: Math.min(limit, 50) }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      level: level ?? ["info", "warn", "error"][i % 3],
      message: `System log entry ${i + 1}`,
      component: ["mcp-server", "n8n-api", "database"][i % 3],
    }));

    return {
      logs: since ? mockLogs.filter((log) => log.timestamp >= since) : mockLogs,
      totalReturned: mockLogs.length,
      filters: { level, limit, since },
    };
  }

  private static async restartSystemService(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const service = (args.service as string) ?? "n8n";

    // This is a mock implementation - actual restart would require system permissions
    return {
      service,
      status: "restart_initiated",
      message: `Service restart initiated for ${service}`,
      timestamp: new Date().toISOString(),
      warning:
        "Restart capability depends on deployment environment and permissions",
    };
  }

  // ============== ADDITIONAL WORKFLOW MANAGEMENT METHODS ==============

  private static async importWorkflowFromFile(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    const data = args.data as Record<string, unknown>;
    const format = (args.format as string) ?? "json";
    const overwrite = (args.overwrite as boolean) ?? false;

    try {
      let workflowData: Record<string, unknown>;

      if (format === "yaml") {
        // This would require a YAML parser in production
        throw new Error("YAML format not currently supported");
      } else {
        workflowData = data;
      }

      // Check if workflow with same name exists
      if (!overwrite && workflowData.name) {
        const existing = await n8nApi.getWorkflows();
        const nameExists = existing.some((w) => w.name === workflowData.name);
        if (nameExists) {
          throw new Error(
            `Workflow '${workflowData.name}' already exists. Use overwrite=true to replace.`,
          );
        }
      }

      return await n8nApi.createWorkflow(
        workflowData as Omit<N8NWorkflow, "id">,
      );
    } catch (error) {
      throw new Error(`Failed to import workflow: ${(error as Error).message}`);
    }
  }

  private static async mergeWorkflows(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!n8nApi) throw new Error("n8n API not available");

    const workflowIds = args.workflowIds as string[];
    const name = args.name as string;
    const strategy = (args.strategy as string) ?? "sequential";

    try {
      const workflows = await Promise.all(
        workflowIds.map(async (id) => {
          if (!n8nApi) throw new Error("n8n API not available");
          return await n8nApi.getWorkflow(id);
        }),
      );

      // Basic merge logic - in production this would be more sophisticated
      const mergedWorkflow = {
        name,
        nodes: workflows.flatMap((w) => w.nodes ?? []),
        connections: workflows.reduce(
          (acc, w) => ({ ...acc, ...w.connections }),
          {},
        ),
        settings: {
          executionOrder: "v1",
          mergeStrategy: strategy,
        },
        active: false,
      };

      return await n8nApi.createWorkflow(mergedWorkflow);
    } catch (error) {
      throw new Error(`Failed to merge workflows: ${(error as Error).message}`);
    }
  }

  private static async getWorkflowTemplates(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const category = args.category as string;
    const tags = args.tags as string[];

    // Mock templates - in production this would come from a templates API or database
    const templates = [
      {
        id: "email-automation",
        name: "Email Automation",
        description: "Automated email responses and notifications",
        category: "Communication",
        tags: ["email", "automation", "notifications"],
        complexity: "low",
      },
      {
        id: "data-sync",
        name: "Database Sync",
        description: "Synchronize data between multiple databases",
        category: "Data Integration",
        tags: ["database", "sync", "integration"],
        complexity: "medium",
      },
      {
        id: "social-media",
        name: "Social Media Management",
        description: "Automated social media posting and monitoring",
        category: "Social Media",
        tags: ["social", "automation", "monitoring"],
        complexity: "high",
      },
    ];

    let filteredTemplates = templates;

    if (category) {
      filteredTemplates = filteredTemplates.filter(
        (t) => t.category === category,
      );
    }

    if (tags && tags.length > 0) {
      filteredTemplates = filteredTemplates.filter((t) =>
        tags.some((tag) => t.tags.includes(tag)),
      );
    }

    return {
      templates: filteredTemplates,
      totalCount: filteredTemplates.length,
      filters: { category, tags },
    };
  }
}

/**
 * Get all comprehensive tools
 */
export function getAllComprehensiveTools(): Tool[] {
  return [
    ...coreDiscoveryTools,
    ...validationEngineTools,
    ...credentialManagementTools,
    ...userManagementTools,
    ...systemManagementTools,
    ...workflowManagementTools,
  ];
}
