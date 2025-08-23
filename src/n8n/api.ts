/**
 * n8n API integration layer
 * Handles communication with n8n REST API
 */

import type {
  WorkflowCreatePayload,
  WorkflowUpdatePayload,
} from '../types/api-payloads.js'
import type { N8NNodeAPI, N8NWorkflowNode } from '../types/core.js'
import type { EnhancedRequestOptions } from '../utils/enhanced-http-client.js'
import process from 'node:process'

import { fetch, Headers } from 'undici'
import { z } from 'zod'
import { config } from '../server/config.js'
import { logger } from '../server/logger.js'
import { n8nApiCircuitBreaker, retryHandler } from '../server/resilience.js'
import {
  PayloadSanitizers,
  sanitizeWorkflowCreation,
  validateWorkflowCreation,
} from '../types/api-payloads.js'
import {
  CredentialListResponseSchema,
  ExecutionListResponseSchema,
  N8NCredentialResponseSchema,
  N8NExecutionResponseSchema,
  N8NHealthStatusResponseSchema,
  N8NNodeTypeResponseSchema,
  N8NSettingsResponseSchema,
  N8NUserResponseSchema,
  N8NWorkflowResponseSchema,
  NodeTypeListResponseSchema,
  TagCreateResponseSchema,
  UserListResponseSchema,
  VersionInfoResponseSchema,
  WorkflowListResponseSchema,
} from '../types/api-responses.js'
import {
  ApiConnectionError,
  ApiValidationError,
  createValidationConfig,
  validateApiResponse,
} from '../types/api-validation.js'
import { httpClient } from '../utils/enhanced-http-client.js'

/**
 * n8n Workflow structure
 */
export interface N8NWorkflow {
  id?: string
  name: string
  active: boolean
  nodes: N8NWorkflowNode[]
  connections: Record<
    string,
    Record<string, Array<Array<{ node: string, type: string, index: number }>>>
  >
  settings?: Record<string, unknown>
  staticData?: Record<string, unknown>
  tags?: string[]
  versionId?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * n8n Execution
 */
export interface N8NExecution {
  id: string
  finished: boolean
  mode: string
  retryOf?: string
  retrySuccessId?: string
  startedAt: string
  stoppedAt?: string
  workflowId: string
  data?: Record<string, unknown>
}

/**
 * n8n Credential
 */
export interface N8NCredential {
  id: string
  name: string
  type: string
  data?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  ownedBy?: string
  sharedWith?: string[]
}

/**
 * n8n User
 */
export interface N8NUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role: string
  isOwner: boolean
  isPending: boolean
  createdAt: string
  updatedAt: string
}

/**
 * n8n Node Type
 * @deprecated Use N8NNodeAPI from types/core.ts instead
 */
export type N8NNodeType = N8NNodeAPI

/**
 * n8n Settings
 */
export interface N8NSettings {
  endpointWebhook: string
  endpointWebhookWaiting: string
  saveDataErrorExecution: string
  saveDataSuccessExecution: string
  saveManualExecutions: boolean
  timezone: string
  urlBaseWebhook: string
}

/**
 * n8n Health Status
 */
export interface N8NHealthStatus {
  status: 'ok' | 'error'
  database: { status: 'ok' | 'error', latency?: number }
  redis?: { status: 'ok' | 'error', latency?: number }
}

/**
 * n8n API Response
 */
interface N8NApiResponse<T = unknown> {
  data: T
  nextCursor?: string
}

/**
 * n8n API Client
 */
export class N8NApiClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly useEnhancedClient: boolean

  constructor(useEnhancedClient = true) {
    if (!config.n8nApiUrl || !config.n8nApiKey) {
      throw new Error(
        'n8n API configuration missing. Set N8N_API_URL and N8N_API_KEY environment variables.',
      )
    }

    this.baseUrl = config.n8nApiUrl
    this.apiKey = config.n8nApiKey
    this.useEnhancedClient = useEnhancedClient

    if (useEnhancedClient) {
      logger.debug('N8N API client initialized with enhanced HTTP client')
    }
  }

  /**
   * Make authenticated request to n8n API with enhanced HTTP client
   */
  private async enhancedRequest<T = unknown>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      body?: unknown
      headers?: Record<string, string>
      cache?: boolean
      timeout?: number
    } = {},
    responseSchema?: z.ZodSchema<T>,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    // Sanitize the API key
    const sanitizedApiKey = this.apiKey.trim().replace(/[\r\n\0]/g, '')

    const headers = {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': sanitizedApiKey,
      ...options.headers,
    }

    // Build request options with proper typing
    const requestOptions: EnhancedRequestOptions = {
      method: options.method ?? 'GET',
      headers,
      timeout: options.timeout ?? config.mcpTimeout,
    }

    // Add body if present
    if (options.body) {
      requestOptions.body = JSON.stringify(options.body)
    }

    // Add cache setting if explicitly provided
    if (options.cache !== undefined) {
      requestOptions.cache = options.cache
    }

    try {
      const response = await httpClient.request(url, requestOptions, responseSchema)

      logger.debug(`n8n API request completed`, {
        endpoint,
        method: options.method ?? 'GET',
        status: response.status,
        responseTime: `${response.responseTime}ms`,
        fromCache: response.fromCache,
        size: `${Math.round(response.size / 1024)}KB`,
      })

      if (response.status >= 400) {
        throw new ApiConnectionError(
          `n8n API error (${response.status}): ${JSON.stringify(response.data)}`,
          endpoint,
          new Error(`HTTP ${response.status}`),
          response.responseTime,
        )
      }

      return response.data
    }
    catch (error) {
      logger.error('Enhanced n8n API request failed:', {
        endpoint,
        method: options.method ?? 'GET',
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Convert Headers object to plain object
   */
  private headersToObject(headers?: Record<string, string> | Headers | Array<[string, string]>): Record<string, string> {
    if (!headers)
      return {}

    if (headers instanceof Headers) {
      const result: Record<string, string> = {}
      headers.forEach((value, key) => {
        result[key] = value
      })
      return result
    }

    if (Array.isArray(headers)) {
      const result: Record<string, string> = {}
      headers.forEach(([key, value]) => {
        result[key] = value
      })
      return result
    }

    return headers as Record<string, string>
  }

  /**
   * Make authenticated request to n8n API with optional response validation (legacy method)
   */
  private async request<T = unknown>(
    endpoint: string,
    options: globalThis.RequestInit = {},
    responseSchema?: z.ZodSchema<T>,
  ): Promise<T> {
    // Use enhanced client if enabled
    if (this.useEnhancedClient) {
      const enhancedOptions: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
        body?: unknown
        headers?: Record<string, string>
        cache?: boolean
      } = {
        method: (options.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH') ?? 'GET',
        cache: true,
      }

      if (options.body) {
        enhancedOptions.body = JSON.parse(options.body as string)
      }

      if (options.headers) {
        enhancedOptions.headers = this.headersToObject(options.headers as Record<string, string>)
      }

      return this.enhancedRequest(endpoint, enhancedOptions, responseSchema)
    }

    // Original fetch-based implementation for fallback
    const url = `${this.baseUrl}${endpoint}`

    // Sanitize the API key to ensure it's valid for HTTP headers
    const sanitizedApiKey = this.apiKey.trim().replace(/[\r\n\0]/g, '')

    // Create headers object more carefully to avoid undici validation issues
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': sanitizedApiKey,
    })

    // Add any additional headers from options
    if (options.headers) {
      const additionalHeaders = this.headersToObject(options.headers as Record<string, string>)
      for (const [key, value] of Object.entries(additionalHeaders)) {
        headers.set(key, value)
      }
    }

    // Create a clean request options object to avoid type conflicts
    const requestOptions: Record<string, unknown> = {
      method: options.method ?? 'GET',
      headers,
    }

    // Add body if present
    if (options.body) {
      requestOptions.body = options.body
    }

    const startTime = Date.now()

    return await n8nApiCircuitBreaker.execute(async () => {
      return await retryHandler.execute(
        async () => {
          logger.debug(
            `Making request to n8n API: ${requestOptions.method ?? 'GET'} ${url}`,
          )

          const response = await fetch(
            url,
            requestOptions as Record<string, unknown>,
          )

          const responseTime = Date.now() - startTime

          if (!response.ok) {
            let errorMessage: string
            try {
              const errorJson = (await response.json()) as {
                message?: string
                error?: string
              }
              errorMessage
                = errorJson.message
                  ?? errorJson.error
                  ?? JSON.stringify(errorJson)
            }
            catch {
              errorMessage = await response.text()
            }
            throw new ApiConnectionError(
              `n8n API error (${response.status}): ${errorMessage}`,
              endpoint,
              new Error(`HTTP ${response.status}: ${errorMessage}`),
              responseTime,
            )
          }

          let rawResponse: unknown
          try {
            rawResponse = await response.json()
          }
          catch (error) {
            throw new ApiConnectionError(
              `Failed to parse n8n API response as JSON`,
              endpoint,
              error,
              responseTime,
            )
          }

          // Apply response validation if schema provided
          if (responseSchema) {
            const validationConfig = createValidationConfig({
              strict: config.strictApiValidation,
              enableLogging: config.enableResponseLogging,
              timeout: config.validationTimeout,
              sanitizeResponses: config.sanitizeApiResponses,
              maxResponseSize: config.maxResponseSize,
            })

            try {
              return await validateApiResponse(
                rawResponse,
                responseSchema,
                endpoint,
                response.status,
                validationConfig,
                responseTime,
              )
            }
            catch (validationError) {
              if (validationError instanceof ApiValidationError) {
                // Re-throw validation errors as-is
                throw validationError
              }
              else {
                // Wrap other errors
                throw new ApiValidationError(
                  `Response validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
                  endpoint,
                  response.status,
                  rawResponse,
                  new z.ZodError([
                    {
                      code: 'custom',
                      message:
                        validationError instanceof Error
                          ? validationError.message
                          : String(validationError),
                      path: [],
                    },
                  ]),
                  responseTime,
                )
              }
            }
          }
          else {
            // Return raw response without validation
            return rawResponse as T
          }
        },
        `n8n API ${options.method ?? 'GET'} ${endpoint}`,
      )
    })
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request('/workflows?limit=1')
      logger.info('n8n API connection successful')
      return true
    }
    catch (error) {
      logger.error('n8n API connection failed:', error)
      return false
    }
  }

  /**
   * Get all workflows
   */
  async getWorkflows(): Promise<N8NWorkflow[]> {
    const response = await this.request(
      '/workflows',
      {},
      WorkflowListResponseSchema,
    )
    return response.data as N8NWorkflow[]
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(id: string): Promise<N8NWorkflow> {
    const response = await this.request(
      `/workflows/${id}`,
      {},
      N8NWorkflowResponseSchema,
    )
    return response as N8NWorkflow
  }

  /**
   * Create new workflow with strict type safety
   * Automatically strips read-only fields to prevent API compliance issues
   */
  async createWorkflow(
    workflow: WorkflowCreatePayload | Record<string, unknown>,
  ): Promise<N8NWorkflow> {
    // Ensure type safety by sanitizing payload
    let cleanPayload: WorkflowCreatePayload

    if (typeof workflow === 'object' && workflow !== null) {
      // Sanitize any unknown payload to ensure API compliance
      cleanPayload = sanitizeWorkflowCreation(
        workflow as Record<string, unknown>,
      )
    }
    else {
      throw new Error('Invalid workflow payload: must be an object')
    }

    // Additional runtime validation
    if (!validateWorkflowCreation(cleanPayload)) {
      throw new Error(
        'Invalid workflow payload: missing required fields (name, nodes, connections)',
      )
    }

    logger.debug('Creating workflow with sanitized payload', {
      name: cleanPayload.name,
      nodeCount: cleanPayload.nodes.length,
      hasSettings: !!cleanPayload.settings,
    })

    const response = await this.request(
      '/workflows',
      {
        method: 'POST',
        body: JSON.stringify(cleanPayload),
      },
      N8NWorkflowResponseSchema,
    )

    const createdWorkflow = response as N8NWorkflow
    logger.info(
      `✅ Created workflow: ${cleanPayload.name} (ID: ${createdWorkflow.id})`,
    )
    return createdWorkflow
  }

  /**
   * Update existing workflow with strict type safety
   * Automatically strips read-only fields to prevent API compliance issues
   */
  async updateWorkflow(
    id: string,
    workflow: WorkflowUpdatePayload | Record<string, unknown>,
  ): Promise<N8NWorkflow> {
    // Sanitize payload to remove read-only fields
    const cleanPayload = PayloadSanitizers.workflowUpdate(
      workflow as Record<string, unknown>,
    )

    logger.debug(`Updating workflow ${id} with sanitized payload`, {
      providedFields: Object.keys(workflow as Record<string, unknown>),
      cleanedFields: Object.keys(cleanPayload),
    })

    const response = await this.request(
      `/workflows/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(cleanPayload),
      },
      N8NWorkflowResponseSchema,
    )

    logger.info(`✅ Updated workflow: ${id}`)
    return response as N8NWorkflow
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    await this.request(`/workflows/${id}`, {
      method: 'DELETE',
    })

    logger.info(`Deleted workflow: ${id}`)
  }

  /**
   * Activate workflow
   */
  async activateWorkflow(id: string): Promise<N8NWorkflow> {
    const response = await this.request(
      `/workflows/${id}/activate`,
      {
        method: 'POST',
      },
      N8NWorkflowResponseSchema,
    )

    logger.info(`Activated workflow: ${id}`)
    return response as N8NWorkflow
  }

  /**
   * Deactivate workflow
   */
  async deactivateWorkflow(id: string): Promise<N8NWorkflow> {
    const response = await this.request(
      `/workflows/${id}/deactivate`,
      {
        method: 'POST',
      },
      N8NWorkflowResponseSchema,
    )

    logger.info(`Deactivated workflow: ${id}`)
    return response as N8NWorkflow
  }

  /**
   * Execute workflow
   */
  async executeWorkflow(
    id: string,
    data?: Record<string, unknown>,
  ): Promise<N8NExecution> {
    const response = await this.request(
      `/workflows/${id}/execute`,
      {
        method: 'POST',
        body: JSON.stringify({ data }),
      },
      N8NExecutionResponseSchema,
    )

    const execution = response as N8NExecution
    logger.info(`Executed workflow: ${id} (Execution: ${execution.id})`)
    return execution
  }

  /**
   * Get workflow executions
   */
  async getExecutions(workflowId?: string): Promise<N8NExecution[]> {
    let endpoint = '/executions'
    if (workflowId) {
      endpoint += `?workflowId=${workflowId}`
    }

    const response = await this.request(
      endpoint,
      {},
      ExecutionListResponseSchema,
    )
    return response.data as N8NExecution[]
  }

  /**
   * Get execution by ID
   */
  async getExecution(id: string): Promise<N8NExecution> {
    const response = await this.request(
      `/executions/${id}`,
      {},
      N8NExecutionResponseSchema,
    )
    return response as N8NExecution
  }

  /**
   * Stop execution
   */
  async stopExecution(id: string): Promise<N8NExecution> {
    const response = await this.request(
      `/executions/${id}/stop`,
      {
        method: 'POST',
      },
      N8NExecutionResponseSchema,
    )

    logger.info(`Stopped execution: ${id}`)
    return response as N8NExecution
  }

  /**
   * Get workflow execution data
   */
  async getExecutionData(id: string): Promise<Record<string, unknown>> {
    const response = await this.request<{ data: Record<string, unknown> }>(
      `/executions/${id}`,
    )
    return response.data
  }

  /**
   * Search workflows
   */
  async searchWorkflows(query: string): Promise<N8NWorkflow[]> {
    const workflows = await this.getWorkflows()

    const searchTerm = query.toLowerCase()
    return workflows.filter(
      workflow =>
        workflow.name.toLowerCase().includes(searchTerm)
        || workflow.tags?.some(tag => tag.toLowerCase().includes(searchTerm)),
    )
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(id: string): Promise<{
    executions: number
    successRate: number
    avgExecutionTime: number
    lastExecution?: Date
  }> {
    const executions = await this.getExecutions(id)

    if (executions.length === 0) {
      return {
        executions: 0,
        successRate: 0,
        avgExecutionTime: 0,
      }
    }

    const successful = executions.filter(e => e.finished && !e.data?.error)
    const successRate = (successful.length / executions.length) * 100

    const executionTimes = executions
      .filter(e => e.startedAt && e.stoppedAt)
      .map(
        e =>
          new Date(e.stoppedAt ?? '').getTime()
            - new Date(e.startedAt).getTime(),
      )

    const avgExecutionTime
      = executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0

    const lastExecution
      = executions.length > 0 && executions[0]
        ? new Date(executions[0].startedAt)
        : undefined

    const result: {
      executions: number
      successRate: number
      avgExecutionTime: number
      lastExecution?: Date
    } = {
      executions: executions.length,
      successRate,
      avgExecutionTime,
    }

    if (lastExecution) {
      result.lastExecution = lastExecution
    }

    return result
  }

  // ============== CREDENTIAL MANAGEMENT ==============

  /**
   * Get all credentials
   */
  async getCredentials(): Promise<N8NCredential[]> {
    const response = await this.request(
      '/credentials',
      {},
      CredentialListResponseSchema,
    )
    return response.data as N8NCredential[]
  }

  /**
   * Get credential by ID
   */
  async getCredential(id: string): Promise<N8NCredential> {
    const response = await this.request(
      `/credentials/${id}`,
      {},
      N8NCredentialResponseSchema,
    )
    return response as N8NCredential
  }

  /**
   * Create new credential
   */
  async createCredential(
    credential: Omit<N8NCredential, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<N8NCredential> {
    const response = await this.request(
      '/credentials',
      {
        method: 'POST',
        body: JSON.stringify(credential),
      },
      N8NCredentialResponseSchema,
    )

    const cred = response as N8NCredential
    logger.info(`Created credential: ${credential.name} (ID: ${cred.id})`)
    return cred
  }

  /**
   * Update existing credential
   */
  async updateCredential(
    id: string,
    credential: Partial<N8NCredential>,
  ): Promise<N8NCredential> {
    const response = await this.request(
      `/credentials/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(credential),
      },
      N8NCredentialResponseSchema,
    )

    logger.info(`Updated credential: ${id}`)
    return response as N8NCredential
  }

  /**
   * Delete credential
   */
  async deleteCredential(id: string): Promise<void> {
    await this.request(`/credentials/${id}`, {
      method: 'DELETE',
    })

    logger.info(`Deleted credential: ${id}`)
  }

  /**
   * Test credential connection
   */
  async testCredential(
    id: string,
  ): Promise<{ status: 'success' | 'error', message?: string }> {
    try {
      await this.request(`/credentials/${id}/test`, {
        method: 'POST',
      })
      return { status: 'success' }
    }
    catch (error) {
      return { status: 'error', message: (error as Error).message }
    }
  }

  // ============== NODE OPERATIONS ==============

  /**
   * Get all available node types
   */
  async getNodeTypes(): Promise<N8NNodeAPI[]> {
    const response = await this.request(
      '/node-types',
      {},
      NodeTypeListResponseSchema,
    )
    return response.data as N8NNodeAPI[]
  }

  /**
   * Get specific node type information
   */
  async getNodeType(nodeType: string): Promise<N8NNodeAPI> {
    const response = await this.request(
      `/node-types/${nodeType}`,
      {},
      N8NNodeTypeResponseSchema,
    )
    return response as N8NNodeAPI
  }

  /**
   * Search node types by query
   */
  async searchNodeTypes(
    query: string,
    category?: string,
  ): Promise<N8NNodeAPI[]> {
    const nodeTypes = await this.getNodeTypes()

    const searchTerm = query.toLowerCase()
    return nodeTypes.filter((node) => {
      const matchesQuery
        = node.displayName.toLowerCase().includes(searchTerm)
          || node.description.toLowerCase().includes(searchTerm)
          || node.name.toLowerCase().includes(searchTerm)

      const matchesCategory
        = !category
          || node.group.some(g =>
            g.toLowerCase().includes(category.toLowerCase()),
          )

      return matchesQuery && matchesCategory
    })
  }

  // ============== USER MANAGEMENT ==============

  /**
   * Get all users
   */
  async getUsers(): Promise<N8NUser[]> {
    const response = await this.request('/users', {}, UserListResponseSchema)
    return response.data as N8NUser[]
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<N8NUser> {
    const response = await this.request('/users/me', {}, N8NUserResponseSchema)
    return response as N8NUser
  }

  /**
   * Create new user
   */
  async createUser(
    user: Omit<N8NUser, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<N8NUser> {
    const response = await this.request(
      '/users',
      {
        method: 'POST',
        body: JSON.stringify(user),
      },
      N8NUserResponseSchema,
    )

    const newUser = response as N8NUser
    logger.info(`Created user: ${user.email} (ID: ${newUser.id})`)
    return newUser
  }

  /**
   * Update user
   */
  async updateUser(id: string, user: Partial<N8NUser>): Promise<N8NUser> {
    const response = await this.request(
      `/users/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(user),
      },
      N8NUserResponseSchema,
    )

    logger.info(`Updated user: ${id}`)
    return response as N8NUser
  }

  // ============== SYSTEM MANAGEMENT ==============

  /**
   * Get system settings
   */
  async getSettings(): Promise<N8NSettings> {
    const response = await this.request(
      '/settings',
      {},
      N8NSettingsResponseSchema,
    )
    return response as N8NSettings
  }

  /**
   * Update system settings
   */
  async updateSettings(settings: Partial<N8NSettings>): Promise<N8NSettings> {
    const response = await this.request(
      '/settings',
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      N8NSettingsResponseSchema,
    )

    logger.info('Updated system settings')
    return response as N8NSettings
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<N8NHealthStatus> {
    try {
      const response = await this.request(
        '/health',
        {},
        N8NHealthStatusResponseSchema,
      )
      return response as N8NHealthStatus
    }
    catch {
      return {
        status: 'error',
        database: { status: 'error' },
      }
    }
  }

  /**
   * Get system version information
   */
  async getVersionInfo(): Promise<{ version: string, build?: string }> {
    try {
      const response = await this.request(
        '/version',
        {},
        VersionInfoResponseSchema,
      )
      return response as { version: string, build?: string }
    }
    catch {
      // Fallback for instances without version endpoint
      return { version: 'unknown' }
    }
  }

  // ============== ADVANCED OPERATIONS ==============

  /**
   * Get workflow tags
   */
  async getTags(): Promise<string[]> {
    try {
      const response
        = await this.request<N8NApiResponse<{ name: string }[]>>('/tags')
      return response.data.map(tag => tag.name)
    }
    catch {
      // Not all n8n versions support tags
      return []
    }
  }

  /**
   * Create workflow tag
   */
  async createTag(name: string): Promise<{ id: string, name: string }> {
    const response = await this.request(
      '/tags',
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      },
      TagCreateResponseSchema,
    )

    logger.info(`Created tag: ${name}`)
    return response as { id: string, name: string }
  }

  /**
   * Get workflow templates (if available)
   */
  async getTemplates(): Promise<Record<string, unknown>[]> {
    try {
      const response = await this.request<
        N8NApiResponse<Record<string, unknown>[]>
      >('/workflows/templates')
      return response.data
    }
    catch {
      // Templates might not be available in all n8n versions
      return []
    }
  }

  /**
   * Import workflow from data
   */
  async importWorkflow(
    workflowData: Record<string, unknown>,
  ): Promise<N8NWorkflow> {
    const response = await this.request(
      '/workflows/import',
      {
        method: 'POST',
        body: JSON.stringify(workflowData),
      },
      N8NWorkflowResponseSchema,
    )

    const workflow = response as N8NWorkflow
    logger.info(`Imported workflow: ${workflow.name} (ID: ${workflow.id})`)
    return workflow
  }

  /**
   * Export workflow data
   */
  async exportWorkflow(
    id: string,
    format: 'json' | 'yaml' = 'json',
  ): Promise<N8NWorkflow> {
    const workflow = await this.getWorkflow(id)

    if (format === 'json') {
      return workflow
    }

    // For YAML export, we'd need a YAML library
    // For now, return JSON format
    return workflow
  }

  /**
   * Get execution logs with details
   */
  async getExecutionLogs(id: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.request<Record<string, unknown>>(
        `/executions/${id}/logs`,
      )
      return response
    }
    catch {
      // Fallback to execution data
      return await this.getExecutionData(id)
    }
  }

  /**
   * Retry failed execution
   */
  async retryExecution(id: string): Promise<N8NExecution> {
    const response = await this.request(
      `/executions/${id}/retry`,
      {
        method: 'POST',
      },
      N8NExecutionResponseSchema,
    )

    const execution = response as N8NExecution
    logger.info(`Retried execution: ${id} (New execution: ${execution.id})`)
    return execution
  }

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<N8NUser> {
    const response = await this.request(
      `/users/${id}`,
      {},
      N8NUserResponseSchema,
    )
    return response as N8NUser
  }

  /**
   * Delete user with workflow transfer
   */
  async deleteUser(id: string, transferWorkflows?: string): Promise<void> {
    const params = transferWorkflows
      ? `?transferWorkflows=${transferWorkflows}`
      : ''
    await this.request(`/users/${id}${params}`, {
      method: 'DELETE',
    })

    logger.info(`Deleted user: ${id}`)
  }

  /**
   * Update user permissions
   */
  async updateUserPermissions(
    userId: string,
    permissions: Record<string, unknown>,
  ): Promise<N8NUser> {
    const response = await this.request(
      `/users/${userId}/permissions`,
      {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
      },
      N8NUserResponseSchema,
    )
    return response as N8NUser
  }

  /**
   * Get system settings (alias for getSettings)
   */
  async getSystemSettings(): Promise<N8NSettings> {
    return await this.getSettings()
  }

  /**
   * Update system settings (alias for updateSettings)
   */
  async updateSystemSettings(
    settings: Record<string, unknown>,
  ): Promise<N8NSettings> {
    return await this.updateSettings(settings as Partial<N8NSettings>)
  }
}

/**
 * Check if we should suppress API configuration warnings
 * Suppresses warnings during npm install/postinstall scripts
 */
function shouldSuppressApiWarnings(): boolean {
  const argv1 = process.argv[1] ?? ''

  // Suppress during npm install/postinstall contexts
  return (
    argv1.includes('postinstall')
    || argv1.includes('cleanup')
    || argv1.includes('install-')
    || argv1.includes('validate-')
    || argv1.includes('scripts/')
    || process.argv.includes('--silent')
    || process.argv.includes('--version')
    || process.argv.includes('--help')
  )
}

/**
 * Create n8n API client instance
 */
export function createN8NApiClient(): N8NApiClient | null {
  try {
    return new N8NApiClient()
  }
  catch (error) {
    // Suppress warnings during npm install/postinstall contexts
    if (shouldSuppressApiWarnings()) {
      logger.debug('n8n API client not configured (install/script context)')
      return null
    }

    // For MCP server and CLI contexts, show appropriate warning
    logger.warn('n8n API client not available:', (error as Error).message)
    return null
  }
}

// Export singleton instance
export const n8nApi = createN8NApiClient()
