/**
 * n8n API integration layer
 * Handles communication with n8n REST API
 */

import { fetch } from "undici";
import { config } from "../server/config.js";
import { logger } from "../server/logger.js";
import { retryHandler, n8nApiCircuitBreaker } from "../server/resilience.js";

/**
 * n8n Workflow structure
 */
export interface N8NWorkflow {
  id?: string;
  name: string;
  active: boolean;
  nodes: N8NWorkflowNode[];
  connections: Record<
    string,
    Record<string, Array<Array<{ node: string; type: string; index: number }>>>
  >;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

/**
 * n8n Workflow Node
 */
export interface N8NWorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, string>;
}

/**
 * n8n Execution
 */
export interface N8NExecution {
  id: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  data?: Record<string, unknown>;
}

/**
 * n8n Credential
 */
export interface N8NCredential {
  id: string;
  name: string;
  type: string;
  data?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  ownedBy?: string;
  sharedWith?: string[];
}

/**
 * n8n User
 */
export interface N8NUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isOwner: boolean;
  isPending: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * n8n Node Type
 */
export interface N8NNodeType {
  name: string;
  displayName: string;
  description: string;
  version: number;
  defaults?: Record<string, unknown>;
  inputs: string[];
  outputs: string[];
  properties: N8NNodeProperty[];
  credentials?: N8NNodeCredential[];
  group: string[];
  category?: string;
}

/**
 * n8n Node Property
 */
export interface N8NNodeProperty {
  displayName: string;
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
  options?: Array<{ name: string; value: unknown }>;
}

/**
 * n8n Node Credential
 */
export interface N8NNodeCredential {
  name: string;
  required?: boolean;
  displayOptions?: Record<string, unknown>;
}

/**
 * n8n Settings
 */
export interface N8NSettings {
  endpointWebhook: string;
  endpointWebhookWaiting: string;
  saveDataErrorExecution: string;
  saveDataSuccessExecution: string;
  saveManualExecutions: boolean;
  timezone: string;
  urlBaseWebhook: string;
}

/**
 * n8n Health Status
 */
export interface N8NHealthStatus {
  status: "ok" | "error";
  database: { status: "ok" | "error"; latency?: number };
  redis?: { status: "ok" | "error"; latency?: number };
}

/**
 * n8n API Response
 */
interface N8NApiResponse<T = unknown> {
  data: T;
  nextCursor?: string;
}

/**
 * n8n API Client
 */
export class N8NApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    if (!config.n8nApiUrl || !config.n8nApiKey) {
      throw new Error(
        "n8n API configuration missing. Set N8N_API_URL and N8N_API_KEY environment variables.",
      );
    }

    this.baseUrl = config.n8nApiUrl;
    this.apiKey = config.n8nApiKey;
  }

  /**
   * Make authenticated request to n8n API
   */
  private async request<T = unknown>(
    endpoint: string,
    options: globalThis.RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Create a clean request options object to avoid type conflicts
    const requestOptions: Record<string, unknown> = {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": this.apiKey,
        ...(options.headers as Record<string, string>),
      },
    };

    // Add body if present
    if (options.body) {
      requestOptions.body = options.body;
    }

    return await n8nApiCircuitBreaker.execute(async () => {
      return await retryHandler.execute(
        async () => {
          logger.debug(
            `Making request to n8n API: ${requestOptions.method ?? "GET"} ${url}`,
          );

          const response = await fetch(
            url,
            requestOptions as Record<string, unknown>,
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`n8n API error (${response.status}): ${errorText}`);
          }

          return (await response.json()) as T;
        },
        `n8n API ${options.method ?? "GET"} ${endpoint}`,
      );
    });
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request("/workflows?limit=1");
      logger.info("n8n API connection successful");
      return true;
    } catch (error) {
      logger.error("n8n API connection failed:", error);
      return false;
    }
  }

  /**
   * Get all workflows
   */
  async getWorkflows(): Promise<N8NWorkflow[]> {
    const response =
      await this.request<N8NApiResponse<N8NWorkflow[]>>("/workflows");
    return response.data;
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(id: string): Promise<N8NWorkflow> {
    const response = await this.request<N8NWorkflow>(`/workflows/${id}`);
    return response;
  }

  /**
   * Create new workflow
   */
  async createWorkflow(
    workflow: Omit<N8NWorkflow, "id">,
  ): Promise<N8NWorkflow> {
    const response = await this.request<N8NWorkflow>("/workflows", {
      method: "POST",
      body: JSON.stringify(workflow),
    });

    logger.info(`Created workflow: ${workflow.name} (ID: ${response.id})`);
    return response;
  }

  /**
   * Update existing workflow
   */
  async updateWorkflow(
    id: string,
    workflow: Partial<N8NWorkflow>,
  ): Promise<N8NWorkflow> {
    const response = await this.request<N8NWorkflow>(`/workflows/${id}`, {
      method: "PUT",
      body: JSON.stringify(workflow),
    });

    logger.info(`Updated workflow: ${id}`);
    return response;
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    await this.request(`/workflows/${id}`, {
      method: "DELETE",
    });

    logger.info(`Deleted workflow: ${id}`);
  }

  /**
   * Activate workflow
   */
  async activateWorkflow(id: string): Promise<N8NWorkflow> {
    const response = await this.request<N8NWorkflow>(
      `/workflows/${id}/activate`,
      {
        method: "POST",
      },
    );

    logger.info(`Activated workflow: ${id}`);
    return response;
  }

  /**
   * Deactivate workflow
   */
  async deactivateWorkflow(id: string): Promise<N8NWorkflow> {
    const response = await this.request<N8NWorkflow>(
      `/workflows/${id}/deactivate`,
      {
        method: "POST",
      },
    );

    logger.info(`Deactivated workflow: ${id}`);
    return response;
  }

  /**
   * Execute workflow
   */
  async executeWorkflow(
    id: string,
    data?: Record<string, unknown>,
  ): Promise<N8NExecution> {
    const response = await this.request<N8NExecution>(
      `/workflows/${id}/execute`,
      {
        method: "POST",
        body: JSON.stringify({ data }),
      },
    );

    logger.info(`Executed workflow: ${id} (Execution: ${response.id})`);
    return response;
  }

  /**
   * Get workflow executions
   */
  async getExecutions(workflowId?: string): Promise<N8NExecution[]> {
    let endpoint = "/executions";
    if (workflowId) {
      endpoint += `?workflowId=${workflowId}`;
    }

    const response =
      await this.request<N8NApiResponse<N8NExecution[]>>(endpoint);
    return response.data;
  }

  /**
   * Get execution by ID
   */
  async getExecution(id: string): Promise<N8NExecution> {
    const response = await this.request<N8NExecution>(`/executions/${id}`);
    return response;
  }

  /**
   * Stop execution
   */
  async stopExecution(id: string): Promise<N8NExecution> {
    const response = await this.request<N8NExecution>(
      `/executions/${id}/stop`,
      {
        method: "POST",
      },
    );

    logger.info(`Stopped execution: ${id}`);
    return response;
  }

  /**
   * Get workflow execution data
   */
  async getExecutionData(id: string): Promise<Record<string, unknown>> {
    const response = await this.request<{ data: Record<string, unknown> }>(
      `/executions/${id}`,
    );
    return response.data;
  }

  /**
   * Search workflows
   */
  async searchWorkflows(query: string): Promise<N8NWorkflow[]> {
    const workflows = await this.getWorkflows();

    const searchTerm = query.toLowerCase();
    return workflows.filter(
      (workflow) =>
        workflow.name.toLowerCase().includes(searchTerm) ||
        workflow.tags?.some((tag) => tag.toLowerCase().includes(searchTerm)),
    );
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(id: string): Promise<{
    executions: number;
    successRate: number;
    avgExecutionTime: number;
    lastExecution?: Date;
  }> {
    const executions = await this.getExecutions(id);

    if (executions.length === 0) {
      return {
        executions: 0,
        successRate: 0,
        avgExecutionTime: 0,
      };
    }

    const successful = executions.filter((e) => e.finished && !e.data?.error);
    const successRate = (successful.length / executions.length) * 100;

    const executionTimes = executions
      .filter((e) => e.startedAt && e.stoppedAt)
      .map(
        (e) =>
          new Date(e.stoppedAt ?? "").getTime() -
          new Date(e.startedAt).getTime(),
      );

    const avgExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0;

    const lastExecution =
      executions.length > 0 && executions[0]
        ? new Date(executions[0].startedAt)
        : undefined;

    const result: {
      executions: number;
      successRate: number;
      avgExecutionTime: number;
      lastExecution?: Date;
    } = {
      executions: executions.length,
      successRate,
      avgExecutionTime,
    };

    if (lastExecution) {
      result.lastExecution = lastExecution;
    }

    return result;
  }

  // ============== CREDENTIAL MANAGEMENT ==============

  /**
   * Get all credentials
   */
  async getCredentials(): Promise<N8NCredential[]> {
    const response =
      await this.request<N8NApiResponse<N8NCredential[]>>("/credentials");
    return response.data;
  }

  /**
   * Get credential by ID
   */
  async getCredential(id: string): Promise<N8NCredential> {
    const response = await this.request<N8NCredential>(`/credentials/${id}`);
    return response;
  }

  /**
   * Create new credential
   */
  async createCredential(
    credential: Omit<N8NCredential, "id" | "createdAt" | "updatedAt">,
  ): Promise<N8NCredential> {
    const response = await this.request<N8NCredential>("/credentials", {
      method: "POST",
      body: JSON.stringify(credential),
    });

    logger.info(`Created credential: ${credential.name} (ID: ${response.id})`);
    return response;
  }

  /**
   * Update existing credential
   */
  async updateCredential(
    id: string,
    credential: Partial<N8NCredential>,
  ): Promise<N8NCredential> {
    const response = await this.request<N8NCredential>(`/credentials/${id}`, {
      method: "PUT",
      body: JSON.stringify(credential),
    });

    logger.info(`Updated credential: ${id}`);
    return response;
  }

  /**
   * Delete credential
   */
  async deleteCredential(id: string): Promise<void> {
    await this.request(`/credentials/${id}`, {
      method: "DELETE",
    });

    logger.info(`Deleted credential: ${id}`);
  }

  /**
   * Test credential connection
   */
  async testCredential(
    id: string,
  ): Promise<{ status: "success" | "error"; message?: string }> {
    try {
      await this.request(`/credentials/${id}/test`, {
        method: "POST",
      });
      return { status: "success" };
    } catch (error) {
      return { status: "error", message: (error as Error).message };
    }
  }

  // ============== NODE OPERATIONS ==============

  /**
   * Get all available node types
   */
  async getNodeTypes(): Promise<N8NNodeType[]> {
    const response =
      await this.request<N8NApiResponse<N8NNodeType[]>>("/node-types");
    return response.data;
  }

  /**
   * Get specific node type information
   */
  async getNodeType(nodeType: string): Promise<N8NNodeType> {
    const response = await this.request<N8NNodeType>(`/node-types/${nodeType}`);
    return response;
  }

  /**
   * Search node types by query
   */
  async searchNodeTypes(
    query: string,
    category?: string,
  ): Promise<N8NNodeType[]> {
    const nodeTypes = await this.getNodeTypes();

    const searchTerm = query.toLowerCase();
    return nodeTypes.filter((node) => {
      const matchesQuery =
        node.displayName.toLowerCase().includes(searchTerm) ||
        node.description.toLowerCase().includes(searchTerm) ||
        node.name.toLowerCase().includes(searchTerm);

      const matchesCategory =
        !category ||
        node.group.some((g) =>
          g.toLowerCase().includes(category.toLowerCase()),
        );

      return matchesQuery && matchesCategory;
    });
  }

  // ============== USER MANAGEMENT ==============

  /**
   * Get all users
   */
  async getUsers(): Promise<N8NUser[]> {
    const response = await this.request<N8NApiResponse<N8NUser[]>>("/users");
    return response.data;
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<N8NUser> {
    const response = await this.request<N8NUser>("/users/me");
    return response;
  }

  /**
   * Create new user
   */
  async createUser(
    user: Omit<N8NUser, "id" | "createdAt" | "updatedAt">,
  ): Promise<N8NUser> {
    const response = await this.request<N8NUser>("/users", {
      method: "POST",
      body: JSON.stringify(user),
    });

    logger.info(`Created user: ${user.email} (ID: ${response.id})`);
    return response;
  }

  /**
   * Update user
   */
  async updateUser(id: string, user: Partial<N8NUser>): Promise<N8NUser> {
    const response = await this.request<N8NUser>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(user),
    });

    logger.info(`Updated user: ${id}`);
    return response;
  }

  // ============== SYSTEM MANAGEMENT ==============

  /**
   * Get system settings
   */
  async getSettings(): Promise<N8NSettings> {
    const response = await this.request<N8NSettings>("/settings");
    return response;
  }

  /**
   * Update system settings
   */
  async updateSettings(settings: Partial<N8NSettings>): Promise<N8NSettings> {
    const response = await this.request<N8NSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });

    logger.info("Updated system settings");
    return response;
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<N8NHealthStatus> {
    try {
      const response = await this.request<N8NHealthStatus>("/health");
      return response;
    } catch {
      return {
        status: "error",
        database: { status: "error" },
      };
    }
  }

  /**
   * Get system version information
   */
  async getVersionInfo(): Promise<{ version: string; build?: string }> {
    try {
      const response = await this.request<{ version: string; build?: string }>(
        "/version",
      );
      return response;
    } catch {
      // Fallback for instances without version endpoint
      return { version: "unknown" };
    }
  }

  // ============== ADVANCED OPERATIONS ==============

  /**
   * Get workflow tags
   */
  async getTags(): Promise<string[]> {
    try {
      const response =
        await this.request<N8NApiResponse<{ name: string }[]>>("/tags");
      return response.data.map((tag) => tag.name);
    } catch {
      // Not all n8n versions support tags
      return [];
    }
  }

  /**
   * Create workflow tag
   */
  async createTag(name: string): Promise<{ id: string; name: string }> {
    const response = await this.request<{ id: string; name: string }>("/tags", {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    logger.info(`Created tag: ${name}`);
    return response;
  }

  /**
   * Get workflow templates (if available)
   */
  async getTemplates(): Promise<Record<string, unknown>[]> {
    try {
      const response = await this.request<
        N8NApiResponse<Record<string, unknown>[]>
      >("/workflows/templates");
      return response.data;
    } catch {
      // Templates might not be available in all n8n versions
      return [];
    }
  }

  /**
   * Import workflow from data
   */
  async importWorkflow(
    workflowData: Record<string, unknown>,
  ): Promise<N8NWorkflow> {
    const response = await this.request<N8NWorkflow>("/workflows/import", {
      method: "POST",
      body: JSON.stringify(workflowData),
    });

    logger.info(`Imported workflow: ${response.name} (ID: ${response.id})`);
    return response;
  }

  /**
   * Export workflow data
   */
  async exportWorkflow(
    id: string,
    format: "json" | "yaml" = "json",
  ): Promise<N8NWorkflow> {
    const workflow = await this.getWorkflow(id);

    if (format === "json") {
      return workflow;
    }

    // For YAML export, we'd need a YAML library
    // For now, return JSON format
    return workflow;
  }

  /**
   * Get execution logs with details
   */
  async getExecutionLogs(id: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.request<Record<string, unknown>>(
        `/executions/${id}/logs`,
      );
      return response;
    } catch {
      // Fallback to execution data
      return await this.getExecutionData(id);
    }
  }

  /**
   * Retry failed execution
   */
  async retryExecution(id: string): Promise<N8NExecution> {
    const response = await this.request<N8NExecution>(
      `/executions/${id}/retry`,
      {
        method: "POST",
      },
    );

    logger.info(`Retried execution: ${id} (New execution: ${response.id})`);
    return response;
  }

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<N8NUser> {
    return await this.request<N8NUser>(`/users/${id}`);
  }

  /**
   * Delete user with workflow transfer
   */
  async deleteUser(id: string, transferWorkflows?: string): Promise<void> {
    const params = transferWorkflows
      ? `?transferWorkflows=${transferWorkflows}`
      : "";
    await this.request(`/users/${id}${params}`, {
      method: "DELETE",
    });

    logger.info(`Deleted user: ${id}`);
  }

  /**
   * Update user permissions
   */
  async updateUserPermissions(
    userId: string,
    permissions: Record<string, unknown>,
  ): Promise<N8NUser> {
    return await this.request<N8NUser>(`/users/${userId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    });
  }

  /**
   * Get system settings (alias for getSettings)
   */
  async getSystemSettings(): Promise<N8NSettings> {
    return await this.getSettings();
  }

  /**
   * Update system settings (alias for updateSettings)
   */
  async updateSystemSettings(
    settings: Record<string, unknown>,
  ): Promise<N8NSettings> {
    return await this.updateSettings(settings as Partial<N8NSettings>);
  }
}

/**
 * Create n8n API client instance
 */
export function createN8NApiClient(): N8NApiClient | null {
  try {
    return new N8NApiClient();
  } catch (error) {
    logger.warn("n8n API client not available:", (error as Error).message);
    return null;
  }
}

// Export singleton instance
export const n8nApi = createN8NApiClient();
