/**
 * Enhanced n8n API client implementation
 * Extends existing N8NApiClient with comprehensive n8n REST API support
 * Designed for MCP tool integration with performance optimization
 */

import type { N8NNodeAPI } from '../types/core.js'

import type {
  N8NExecution,
  N8NHealthStatus,
  N8NWorkflow,
} from './api.js'
import { logger } from '../server/logger.js'
import { N8NMcpError } from '../types/index.js'
import { N8NApiClient } from './api.js'

/**
 * Enhanced API operation options
 */
interface EnhancedApiOptions {
  /** Enable response caching for this request */
  cache?: boolean
  /** Cache TTL override in seconds */
  cacheTtl?: number
  /** Request timeout override in milliseconds */
  timeout?: number
  /** Skip response validation */
  skipValidation?: boolean
  /** Include additional metadata in response */
  includeMetadata?: boolean
}

/**
 * Workflow query options
 */
interface WorkflowQueryOptions extends EnhancedApiOptions {
  /** Maximum number of workflows to return */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** Filter by workflow status */
  active?: boolean
  /** Filter by tags */
  tags?: string[]
  /** Search query for name/description */
  search?: string
}

/**
 * Execution query options
 */
interface ExecutionQueryOptions extends EnhancedApiOptions {
  /** Maximum number of executions to return */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** Filter by workflow ID */
  workflowId?: string
  /** Filter by execution status */
  status?: 'success' | 'error' | 'running' | 'waiting'
  /** Filter by date range */
  startDate?: Date
  endDate?: Date
}

/**
 * Cached response wrapper
 */
interface CachedResponse<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * Enhanced n8n API client with comprehensive endpoint coverage
 */
export class EnhancedN8NApi extends N8NApiClient {
  private cache: Map<string, CachedResponse<unknown>> = new Map()
  private rateLimiter: Map<string, number> = new Map()
  private readonly defaultCacheTtl = {
    workflows: 300, // 5 minutes
    nodeTypes: 3600, // 1 hour
    health: 30, // 30 seconds
    executions: 0, // No caching
    credentials: 300, // 5 minutes
    users: 600, // 10 minutes
    settings: 1800, // 30 minutes
  }

  constructor() {
    super()
    logger.debug('Enhanced n8n API client initialized with caching and performance optimization')
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(endpoint: string, options?: Record<string, unknown>): string {
    const optionsStr = options ? JSON.stringify(options) : ''
    return `${endpoint}:${optionsStr}`
  }

  /**
   * Check if cached response is valid
   */
  private isCacheValid<T>(cached: CachedResponse<T>): boolean {
    return Date.now() - cached.timestamp < cached.ttl * 1000
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key) as CachedResponse<T> | undefined
    if (cached && this.isCacheValid(cached)) {
      logger.debug(`Cache hit for ${key}`)
      return cached.data
    }
    if (cached) {
      this.cache.delete(key)
    }
    return null
  }

  /**
   * Store data in cache
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    if (ttl > 0) {
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
      })
      logger.debug(`Cached response for ${key} (TTL: ${ttl}s)`)
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(operation: string): void {
    const now = Date.now()
    const lastRequest = this.rateLimiter.get(operation) || 0
    const minInterval = 100 // Minimum 100ms between requests

    if (now - lastRequest < minInterval) {
      throw new N8NMcpError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429,
        { operation, minInterval },
      )
    }

    this.rateLimiter.set(operation, now)
  }

  /**
   * Sanitize response to remove sensitive data
   */
  private sanitizeResponse<T>(response: T, operation: string): T {
    if (!response || typeof response !== 'object') {
      return response
    }

    try {
      const sanitized = JSON.parse(JSON.stringify(response))

      // Remove sensitive fields based on operation
      if (operation.includes('credential')) {
        this.removeSensitiveFields(sanitized, ['password', 'token', 'key', 'secret'])
      }

      if (operation.includes('user')) {
        this.removeSensitiveFields(sanitized, ['password', 'resetToken', 'apiKey'])
      }

      return sanitized
    }
    catch {
      return response
    }
  }

  /**
   * Remove sensitive fields from object recursively
   */
  private removeSensitiveFields(obj: Record<string, unknown>, fieldsToRemove: string[]): void {
    if (!obj || typeof obj !== 'object')
      return

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (fieldsToRemove.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '[REDACTED]'
        }
        else if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (Array.isArray(obj[key])) {
            obj[key].forEach((item: Record<string, unknown>) => this.removeSensitiveFields(item, fieldsToRemove))
          }
          else {
            this.removeSensitiveFields(obj[key] as Record<string, unknown>, fieldsToRemove)
          }
        }
      }
    }
  }

  /**
   * Enhanced request wrapper with caching and error handling
   */
  private async enhancedApiRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      body?: unknown
      cache?: boolean
      cacheTtl?: number
      timeout?: number
    } = {},
    defaultTtl: number = 0,
  ): Promise<T> {
    const operation = `${options.method || 'GET'} ${endpoint}`

    try {
      // Check rate limiting
      this.checkRateLimit(operation)

      // Check cache for GET requests
      if (!options.method || options.method === 'GET') {
        const cacheKey = this.getCacheKey(endpoint, options)
        const cached = this.getFromCache<T>(cacheKey)
        if (cached) {
          return this.sanitizeResponse(cached, operation)
        }
      }

      // Make API request using parent's request method
      const requestOptions: Record<string, unknown> = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }

      if (options.body) {
        requestOptions.body = JSON.stringify(options.body)
      }

      const response = await (this as unknown as { request: (endpoint: string, options: Record<string, unknown>) => Promise<T> }).request(endpoint, requestOptions)

      // Cache successful GET responses
      if ((!options.method || options.method === 'GET') && options.cache !== false) {
        const ttl = options.cacheTtl || defaultTtl
        if (ttl > 0) {
          const cacheKey = this.getCacheKey(endpoint, options)
          this.setCache(cacheKey, response, ttl)
        }
      }

      return this.sanitizeResponse(response, operation)
    }
    catch (error) {
      logger.error(`Enhanced API request failed: ${operation}`, {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      })

      // Convert to standardized MCP error
      if (error instanceof Error) {
        throw new N8NMcpError(
          `n8n API operation failed: ${error.message}`,
          'N8N_API_ERROR',
          500,
          { operation, endpoint },
        )
      }
      throw error
    }
  }

  // ============== ENHANCED WORKFLOW MANAGEMENT ==============

  /**
   * Get workflows with comprehensive filtering and pagination
   */
  async getWorkflowsEnhanced(options: WorkflowQueryOptions = {}): Promise<{
    workflows: N8NWorkflow[]
    total: number
    hasMore: boolean
  }> {
    let endpoint = '/workflows'
    const params = new URLSearchParams()

    if (options.limit)
      params.append('limit', options.limit.toString())
    if (options.offset)
      params.append('offset', options.offset.toString())
    if (options.active !== undefined)
      params.append('active', options.active.toString())
    if (options.search)
      params.append('filter', options.search)

    if (params.toString()) {
      endpoint += `?${params.toString()}`
    }

    const response = await this.enhancedApiRequest<{
      data: N8NWorkflow[]
      nextCursor?: string
    }>(endpoint, {
      cache: options.cache !== false,
      ...(options.cacheTtl !== undefined && { cacheTtl: options.cacheTtl }),
      ...(options.timeout !== undefined && { timeout: options.timeout }),
    }, this.defaultCacheTtl.workflows)

    const workflows = response.data || []

    // Apply tag filtering if specified
    const filteredWorkflows = options.tags?.length
      ? workflows.filter(w =>
          w.tags?.some(tag => options.tags?.includes(tag) ?? false),
        )
      : workflows

    return {
      workflows: filteredWorkflows,
      total: filteredWorkflows.length,
      hasMore: !!response.nextCursor,
    }
  }

  /**
   * Get workflow with enhanced metadata
   */
  override async getWorkflow(id: string, options: EnhancedApiOptions = {}): Promise<N8NWorkflow & {
    stats?: {
      executions: number
      successRate: number
      lastExecution?: Date
    }
  }> {
    const workflow = await this.enhancedApiRequest<N8NWorkflow>(
      `/workflows/${id}`,
      {
        ...options,
        cache: options.cache !== false,
      },
      this.defaultCacheTtl.workflows,
    )

    // Include stats if requested
    if (options.includeMetadata) {
      try {
        const stats = await super.getWorkflowStats(id)
        return { ...workflow, stats }
      }
      catch {
        return workflow
      }
    }

    return workflow
  }

  /**
   * Create workflow with enhanced validation
   */
  override async createWorkflow(
    workflowData: {
      name: string
      nodes: unknown[]
      connections: Record<string, unknown>
      settings?: Record<string, unknown>
      tags?: string[]
    },
    options: EnhancedApiOptions = {},
  ): Promise<N8NWorkflow> {
    // Validate required fields
    if (!workflowData.name?.trim()) {
      throw new N8NMcpError(
        'Workflow name is required',
        'VALIDATION_ERROR',
        400,
        { field: 'name' },
      )
    }

    if (!Array.isArray(workflowData.nodes) || workflowData.nodes.length === 0) {
      throw new N8NMcpError(
        'Workflow must contain at least one node',
        'VALIDATION_ERROR',
        400,
        { field: 'nodes' },
      )
    }

    const workflow = await this.enhancedApiRequest<N8NWorkflow>(
      '/workflows',
      {
        ...options,
        method: 'POST',
        body: workflowData,
      },
    )

    // Clear workflows cache
    this.clearCacheByPattern('/workflows')

    logger.info(`Created workflow: ${workflowData.name} (ID: ${workflow.id})`)
    return workflow
  }

  /**
   * Update workflow with change tracking
   */
  override async updateWorkflow(
    id: string,
    changes: Partial<N8NWorkflow>,
    options: EnhancedApiOptions = {},
  ): Promise<N8NWorkflow> {
    const workflow = await this.enhancedApiRequest<N8NWorkflow>(
      `/workflows/${id}`,
      {
        ...options,
        method: 'PUT',
        body: changes,
      },
    )

    // Clear related cache entries
    this.clearCacheByPattern(`/workflows/${id}`)
    this.clearCacheByPattern('/workflows')

    logger.info(`Updated workflow: ${id}`)
    return workflow
  }

  // ============== ENHANCED EXECUTION MANAGEMENT ==============

  /**
   * Execute workflow with data and options
   */
  override async executeWorkflow(
    id: string,
    executionData?: {
      data?: Record<string, unknown>
      waitForCompletion?: boolean
      timeout?: number
    },
    options: EnhancedApiOptions = {},
  ): Promise<N8NExecution> {
    const execution = await this.enhancedApiRequest<N8NExecution>(
      `/workflows/${id}/execute`,
      {
        ...options,
        method: 'POST',
        body: executionData,
        ...(executionData?.timeout !== undefined && { timeout: executionData.timeout }),
        ...(options.timeout !== undefined && !executionData?.timeout && { timeout: options.timeout }),
      },
    )

    logger.info(`Executed workflow: ${id} (Execution: ${execution.id})`)

    // Wait for completion if requested
    if (executionData?.waitForCompletion) {
      return await this.waitForExecution(execution.id, executionData.timeout || 30000)
    }

    return execution
  }

  /**
   * Wait for execution completion with polling
   */
  async waitForExecution(
    executionId: string,
    timeoutMs: number = 30000,
    pollInterval: number = 1000,
  ): Promise<N8NExecution> {
    return this.pollExecution(executionId, Date.now(), timeoutMs, pollInterval)
  }

  private async pollExecution(
    executionId: string,
    startTime: number,
    timeoutMs: number,
    pollInterval: number,
  ): Promise<N8NExecution> {
    if (Date.now() - startTime >= timeoutMs) {
      throw new N8NMcpError(
        'Execution timeout',
        'EXECUTION_TIMEOUT',
        408,
        { executionId, timeoutMs },
      )
    }

    try {
      const execution = await this.getExecution(executionId, { cache: false })

      if (execution.finished) {
        return execution
      }
    }
    catch (error) {
      // If we can't get the execution, it might be complete or failed
      logger.warn(`Failed to get execution ${executionId}: ${error}`)
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, pollInterval)
    })

    return this.pollExecution(executionId, startTime, timeoutMs, pollInterval)
  }

  /**
   * Get executions with comprehensive filtering
   */
  async getExecutionsEnhanced(options: ExecutionQueryOptions = {}): Promise<{
    executions: N8NExecution[]
    total: number
    hasMore: boolean
  }> {
    let endpoint = '/executions'
    const params = new URLSearchParams()

    if (options.limit)
      params.append('limit', options.limit.toString())
    if (options.offset)
      params.append('offset', options.offset.toString())
    if (options.workflowId)
      params.append('workflowId', options.workflowId)
    if (options.status)
      params.append('status', options.status)
    if (options.startDate)
      params.append('startedAfter', options.startDate.toISOString())
    if (options.endDate)
      params.append('startedBefore', options.endDate.toISOString())

    if (params.toString()) {
      endpoint += `?${params.toString()}`
    }

    const response = await this.enhancedApiRequest<{
      data: N8NExecution[]
      nextCursor?: string
    }>(endpoint, {
      ...options,
      cache: false, // Never cache execution data
    })

    return {
      executions: response.data || [],
      total: response.data?.length || 0,
      hasMore: !!response.nextCursor,
    }
  }

  /**
   * Get execution with enhanced details
   */
  override async getExecution(id: string, options: EnhancedApiOptions = {}): Promise<N8NExecution> {
    return await this.enhancedApiRequest<N8NExecution>(
      `/executions/${id}`,
      {
        ...options,
        cache: false, // Never cache execution data
      },
    )
  }

  // ============== ENHANCED NODE MANAGEMENT ==============

  /**
   * Get node types with enhanced filtering
   */
  override async getNodeTypes(options: EnhancedApiOptions & {
    category?: string
    search?: string
  } = {}): Promise<N8NNodeAPI[]> {
    const nodeTypes = await this.enhancedApiRequest<{
      data: N8NNodeAPI[]
    }>(
      '/node-types',
      {
        ...options,
        cache: options.cache !== false,
      },
      this.defaultCacheTtl.nodeTypes,
    )

    let filteredNodes = nodeTypes.data || []

    // Apply search filter
    if (options.search) {
      const searchTerm = options.search.toLowerCase()
      filteredNodes = filteredNodes.filter(node =>
        node.displayName.toLowerCase().includes(searchTerm)
        || node.description.toLowerCase().includes(searchTerm)
        || node.name.toLowerCase().includes(searchTerm),
      )
    }

    // Apply category filter
    if (options.category) {
      filteredNodes = filteredNodes.filter(node =>
        node.group.some(g =>
          g.toLowerCase().includes(options.category?.toLowerCase() ?? ''),
        ),
      )
    }

    return filteredNodes
  }

  /**
   * Search nodes with intelligent matching
   */
  async searchNodes(options: EnhancedApiOptions & {
    query: string
    category?: string
    complexity?: 'simple' | 'standard' | 'advanced'
  }): Promise<{
    nodes: N8NNodeAPI[]
    total: number
    categories: string[]
    fromCache?: boolean
  }> {
    // Get all node types (cached)
    const allNodes = await this.getNodeTypes({
      cache: options.cache !== false,
      ...(options.cacheTtl !== undefined && { cacheTtl: options.cacheTtl }),
    })

    const queryLower = options.query.toLowerCase()
    let matchedNodes = allNodes.filter((node) => {
      // Score-based matching for better results
      const nameMatch = node.displayName.toLowerCase().includes(queryLower)
      const descMatch = node.description.toLowerCase().includes(queryLower)
      const codeNameMatch = node.name.toLowerCase().includes(queryLower)

      return nameMatch || descMatch || codeNameMatch
    })

    // Apply category filter
    if (options.category) {
      matchedNodes = matchedNodes.filter(node =>
        node.group.some(g =>
          g.toLowerCase().includes(options.category?.toLowerCase() ?? ''),
        ),
      )
    }

    // Get unique categories from results
    const categories = [...new Set(matchedNodes.flatMap(node => node.group))]

    return {
      nodes: matchedNodes,
      total: matchedNodes.length,
      categories,
      fromCache: true, // Node types are typically cached
    }
  }

  /**
   * Recommend nodes based on user input and workflow patterns
   */
  async recommendNodes(options: EnhancedApiOptions & {
    userInput: string
    complexity?: 'simple' | 'standard' | 'advanced'
    providers?: string[]
    workflowContext?: string[]
  }): Promise<{
    recommendations: Array<{
      node: N8NNodeAPI
      score: number
      reason: string
    }>
    categories: string[]
    total: number
  }> {
    // Get all available nodes
    const allNodes = await this.getNodeTypes({
      cache: options.cache !== false,
      ...(options.cacheTtl !== undefined && { cacheTtl: options.cacheTtl }),
    })

    const inputLower = options.userInput.toLowerCase()
    const recommendations: Array<{
      node: N8NNodeAPI
      score: number
      reason: string
    }> = []

    // Intelligent recommendation logic
    for (const node of allNodes) {
      let score = 0
      const reasons: string[] = []

      // Name/display name matching (high weight)
      if (node.displayName.toLowerCase().includes(inputLower)) {
        score += 10
        reasons.push('name match')
      }

      // Description matching (medium weight)
      if (node.description.toLowerCase().includes(inputLower)) {
        score += 7
        reasons.push('description match')
      }

      // Provider preference matching
      if (options.providers?.length) {
        const nodeProvider = node.name.split('.')[0]
        if (nodeProvider && options.providers.includes(nodeProvider)) {
          score += 5
          reasons.push('preferred provider')
        }
      }

      // Complexity matching
      if (options.complexity) {
        const isCore = node.name.startsWith('n8n-nodes-base')
        const complexityScore = {
          simple: isCore ? 3 : 1,
          standard: 2,
          advanced: isCore ? 1 : 3,
        }[options.complexity]

        score += complexityScore
        reasons.push(`${options.complexity} complexity`)
      }

      // Only include nodes with meaningful scores
      if (score >= 3) {
        recommendations.push({
          node,
          score,
          reason: reasons.join(', '),
        })
      }
    }

    // Sort by score (descending) and limit results
    recommendations.sort((a, b) => b.score - a.score)
    const topRecommendations = recommendations.slice(0, 20)

    // Get categories from recommendations
    const categories = [...new Set(
      topRecommendations.flatMap(r => r.node.group),
    )]

    return {
      recommendations: topRecommendations,
      categories,
      total: topRecommendations.length,
    }
  }

  // ============== ENHANCED SYSTEM MANAGEMENT ==============

  /**
   * Get comprehensive system health with detailed checks
   */
  async getSystemHealth(options: EnhancedApiOptions = {}): Promise<N8NHealthStatus & {
    details?: {
      uptime?: number
      memory?: { used: number, total: number }
      cpu?: { usage: number }
      version?: string
    }
  }> {
    const health = await this.enhancedApiRequest<N8NHealthStatus>(
      '/health',
      {
        ...options,
        cache: options.cache !== false,
      },
      this.defaultCacheTtl.health,
    )

    // Add enhanced details if requested
    if (options.includeMetadata) {
      try {
        const version = await super.getVersionInfo()
        return {
          ...health,
          details: {
            version: version.version,
          },
        }
      }
      catch {
        return health
      }
    }

    return health
  }

  // ============== CACHE MANAGEMENT ==============

  /**
   * Clear cache entries matching pattern
   */
  private clearCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
    logger.debug(`Cleared cache entries matching pattern: ${pattern}`)
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear()
    logger.debug('Cleared all cache entries')
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number
    hitRate: number
    entries: Array<{ key: string, age: number, ttl: number }>
  } {
    const now = Date.now()
    const entries: Array<{ key: string, age: number, ttl: number }> = []

    for (const [key, cached] of this.cache.entries()) {
      entries.push({
        key,
        age: Math.floor((now - cached.timestamp) / 1000),
        ttl: cached.ttl,
      })
    }

    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
      entries,
    }
  }
}

/**
 * Create enhanced n8n API client instance
 */
export function createEnhancedN8NApi(): EnhancedN8NApi | null {
  try {
    return new EnhancedN8NApi()
  }
  catch (error) {
    logger.error('Failed to create enhanced n8n API client:', error)
    return null
  }
}

// Lazy singleton for enhanced API client
let _enhancedApiInstance: EnhancedN8NApi | null = null

export function getEnhancedN8NApi(): EnhancedN8NApi | null {
  if (!_enhancedApiInstance) {
    _enhancedApiInstance = createEnhancedN8NApi()
  }
  return _enhancedApiInstance
}
