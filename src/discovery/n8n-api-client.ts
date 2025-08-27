/**
 * n8n API Client for Dynamic Discovery
 * Handles authentication and core API requests for discovering n8n capabilities
 *
 * FEATURES:
 * - X-N8N-API-KEY authentication
 * - Auto URL normalization to /api/v1 endpoints
 * - Robust error handling with retries
 * - Type-safe response handling
 * - Connection validation and health checks
 */

import { logger } from '../server/logger.js'
import { createCleanObject } from '../utils/aggressive-memory-cleanup.js'

export interface N8nNode {
  name: string
  displayName: string
  description: string
  version: number
  properties: N8nNodeProperty[]
  group: string[]
  subtitle?: string
  codex?: {
    categories?: string[]
    subcategories?: string[]
    resources?: {
      primaryDocumentation?: Array<{ url: string }>
      credentialDocumentation?: Array<{ url: string }>
    }
  }
}

export interface N8nNodeProperty {
  displayName: string
  name: string
  type: string
  required?: boolean
  default?: unknown
  description?: string
  options?: Array<{ name: string, value: string | number | boolean }>
  typeOptions?: Record<string, unknown>
}

export interface N8nWorkflow {
  id: string
  name: string
  active: boolean
  nodes: unknown[]
  connections: Record<string, unknown>
  createdAt: string
  updatedAt: string
  tags?: string[]
}

export interface N8nCredentialType {
  name: string
  displayName: string
  properties: N8nNodeProperty[]
  authenticate?: Record<string, unknown>
  test?: Record<string, unknown>
}

export interface N8nApiClientConfig {
  baseUrl: string
  apiKey?: string
  timeout?: number
  retries?: number
  validateSsl?: boolean
}

export class N8nApiClient {
  private config: N8nApiClientConfig
  private baseApiUrl: string

  constructor(config: N8nApiClientConfig) {
    this.config = {
      timeout: 10000,
      retries: 3,
      validateSsl: true,
      ...config,
    }

    // Normalize URL to API endpoint
    this.baseApiUrl = this.normalizeApiUrl(config.baseUrl)

    logger.info(`🔗 n8n API client configured for: ${this.baseApiUrl}`)
  }

  /**
   * Test connection and authentication
   */
  async testConnection(): Promise<{ success: boolean, error?: string, info?: Record<string, unknown> }> {
    try {
      logger.info('🔍 Testing n8n API connection...')

      const response = await this.makeRequest('/health', 'GET')

      if (response.ok) {
        const data = await response.json()
        logger.info('✅ n8n API connection successful')
        return {
          success: true,
          info: createCleanObject({
            status: (data as Record<string, unknown>)?.status || 'ok',
            version: (data as Record<string, unknown>)?.version || 'unknown',
            timestamp: new Date().toISOString(),
          }),
        }
      }
      else {
        const error = `Connection failed: ${response.status} ${response.statusText}`
        logger.error(`❌ n8n API connection failed: ${error}`)
        return { success: false, error }
      }
    }
    catch (error) {
      const errorMsg = `Connection test failed: ${String(error)}`
      logger.error(`❌ n8n API connection error: ${errorMsg}`)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Discover all available nodes
   */
  async getNodes(): Promise<N8nNode[]> {
    try {
      logger.info('🔍 Discovering n8n nodes via API...')

      const response = await this.makeRequest('/nodes', 'GET')

      if (!response.ok) {
        throw new Error(`Failed to fetch nodes: ${response.status} ${response.statusText}`)
      }

      const nodes = await response.json() as N8nNode[]

      logger.info(`✅ Discovered ${nodes.length} n8n nodes`)
      return nodes
    }
    catch (error) {
      logger.error('❌ Failed to discover n8n nodes:', error)
      throw error
    }
  }

  /**
   * Get specific node information
   */
  async getNode(nodeName: string): Promise<N8nNode | null> {
    try {
      const response = await this.makeRequest(`/nodes/${encodeURIComponent(nodeName)}`, 'GET')

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch node ${nodeName}: ${response.status} ${response.statusText}`)
      }

      return await response.json() as N8nNode
    }
    catch (error) {
      logger.error(`❌ Failed to get node ${nodeName}:`, error)
      throw error
    }
  }

  /**
   * Discover workflows
   */
  async getWorkflows(): Promise<N8nWorkflow[]> {
    try {
      logger.info('🔍 Discovering n8n workflows...')

      const response = await this.makeRequest('/workflows', 'GET')

      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.status} ${response.statusText}`)
      }

      const workflows = await response.json() as { data: N8nWorkflow[] }

      logger.info(`✅ Discovered ${workflows.data.length} workflows`)
      return workflows.data
    }
    catch (error) {
      logger.error('❌ Failed to discover workflows:', error)
      throw error
    }
  }

  /**
   * Discover credential types
   */
  async getCredentialTypes(): Promise<N8nCredentialType[]> {
    try {
      logger.info('🔍 Discovering n8n credential types...')

      const response = await this.makeRequest('/credential-types', 'GET')

      if (!response.ok) {
        throw new Error(`Failed to fetch credential types: ${response.status} ${response.statusText}`)
      }

      const credentialTypes = await response.json() as N8nCredentialType[]

      logger.info(`✅ Discovered ${credentialTypes.length} credential types`)
      return credentialTypes
    }
    catch (error) {
      logger.error('❌ Failed to discover credential types:', error)
      throw error
    }
  }

  /**
   * Make authenticated API request with retry logic
   */
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<Response> {
    const url = `${this.baseApiUrl}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add authentication header if API key is available
    if (this.config.apiKey) {
      headers['X-N8N-API-KEY'] = this.config.apiKey
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    }

    if (body) {
      fetchOptions.body = JSON.stringify(body)
    }

    // Add timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
    fetchOptions.signal = controller.signal

    // Retry logic - sequential attempts with exponential backoff
    const maxAttempts = this.config.retries || 1

    const makeRequestWithRetry = async (attemptNumber: number): Promise<Response> => {
      try {
        logger.debug(`Making request to ${url} (attempt ${attemptNumber})`)

        const response = await fetch(url, fetchOptions)
        clearTimeout(timeoutId)

        return response
      }
      catch (error) {
        clearTimeout(timeoutId)

        if (attemptNumber < maxAttempts) {
          const delay = 2 ** (attemptNumber - 1) * 1000 // Exponential backoff
          logger.warn(`Request failed (attempt ${attemptNumber}), retrying in ${delay}ms...`)

          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), delay)
          })

          return makeRequestWithRetry(attemptNumber + 1)
        }

        throw error
      }
    }

    return makeRequestWithRetry(1)
  }

  /**
   * Normalize base URL to proper n8n API endpoint
   */
  private normalizeApiUrl(baseUrl: string): string {
    // Remove trailing slash
    let normalized = baseUrl.replace(/\/$/, '')

    // Add /api/v1 if not already present
    if (!normalized.includes('/api/v1')) {
      normalized += '/api/v1'
    }

    return normalized
  }

  /**
   * Update API client configuration
   */
  updateConfig(newConfig: Partial<N8nApiClientConfig>): void {
    this.config = { ...this.config, ...newConfig }

    if (newConfig.baseUrl) {
      this.baseApiUrl = this.normalizeApiUrl(newConfig.baseUrl)
    }

    logger.info('🔧 n8n API client configuration updated')
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<N8nApiClientConfig, 'apiKey'> & { hasApiKey: boolean } {
    return createCleanObject({
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout ?? 30000,
      retries: this.config.retries ?? 3,
      validateSsl: this.config.validateSsl ?? true,
      hasApiKey: !!this.config.apiKey,
    })
  }
}
