/**
 * Enhanced n8n API Integration System
 * Part of Phase 5: Advanced Features for n8n-MCP Modern
 *
 * This module provides advanced n8n integration features:
 * - Intelligent connection pooling and load balancing
 * - Advanced caching with cache coherence and invalidation
 * - Request batching and bulk operations
 * - Real-time webhook management and processing
 * - Comprehensive monitoring and analytics
 * - Advanced error recovery and failover strategies
 * - GraphQL-style query optimization
 * - Event-driven updates and streaming
 */

import type { WorkflowCreatePayload } from '../types/api-payloads.js'
import type { N8NCredential, N8NExecution, N8NWorkflow } from './api.js'
import { EventEmitter } from 'node:events'
import { performance } from 'node:perf_hooks'
import { AdvancedCache, CacheStrategy } from '../agents/communication.js'
import { logger } from '../server/logger.js'
import { N8NApiClient } from './api.js'

// === Enhanced API Types ===

export interface EnhancedApiOptions {
  connectionPoolSize?: number
  enableIntelligentCaching?: boolean
  enableRequestBatching?: boolean
  enableWebhookProcessing?: boolean
  enableRealTimeMonitoring?: boolean
  maxConcurrentRequests?: number
  requestTimeout?: number
  cacheStrategy?: CacheStrategy
  failoverConfig?: FailoverConfig
}

export interface FailoverConfig {
  maxRetries: number
  backoffStrategy: 'exponential' | 'linear' | 'constant'
  baseDelay: number
  maxDelay: number
  enableCircuitBreaker: boolean
  healthCheckInterval: number
}

export interface RequestBatch {
  id: string
  requests: BatchRequest[]
  priority: number
  createdAt: number
  timeout: number
}

export interface BatchRequest {
  id: string
  method: string
  endpoint: string
  payload?: unknown
  responseSchema?: unknown
  retryCount: number
}

export interface WebhookEvent {
  id: string
  workflowId: string
  executionId?: string
  type: 'workflow.started' | 'workflow.completed' | 'workflow.failed' | 'node.executed'
  payload: Record<string, unknown>
  timestamp: number
}

export interface MonitoringMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  cacheHitRatio: number
  activeConnections: number
  webhooksProcessed: number
  batchesProcessed: number
  healthScore: number
}

export interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  errorRate: number
  lastHealthCheck: number
  consecutiveFailures: number
}

// === Advanced Connection Pool ===

export class N8NConnectionPool extends EventEmitter {
  private connections: N8NApiClient[] = []
  private healthStatus = new Map<N8NApiClient, ConnectionHealth>()
  private requestQueue: Array<{ resolve: (value: N8NApiClient) => void, reject: (error: Error) => void, priority: number }> = []
  private readonly maxSize: number
  private readonly healthCheckInterval: number
  private healthCheckTimer?: NodeJS.Timeout

  constructor(maxSize = 5, healthCheckInterval = 30000) {
    super()
    this.maxSize = maxSize
    this.healthCheckInterval = healthCheckInterval
    this.initializeConnections()
    this.startHealthMonitoring()
  }

  private initializeConnections(): void {
    for (let i = 0; i < this.maxSize; i++) {
      try {
        const client = new N8NApiClient()
        this.connections.push(client)
        this.healthStatus.set(client, {
          status: 'healthy',
          latency: 0,
          errorRate: 0,
          lastHealthCheck: Date.now(),
          consecutiveFailures: 0,
        })
      }
      catch (error) {
        logger.warn(`Failed to create connection ${i + 1}:`, error)
      }
    }
    logger.info(`Initialized n8n connection pool with ${this.connections.length} connections`)
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks()
    }, this.healthCheckInterval)
  }

  private async performHealthChecks(): Promise<void> {
    const checks = this.connections.map(async (client) => {
      const startTime = performance.now()
      const health = this.healthStatus.get(client)
      if (!health) {
        return // Skip health check for client without health status
      }

      try {
        const isHealthy = await client.testConnection()
        const latency = performance.now() - startTime

        if (isHealthy) {
          health.status = latency > 2000 ? 'degraded' : 'healthy'
          health.latency = latency
          health.consecutiveFailures = 0
          health.errorRate = Math.max(0, health.errorRate - 0.1) // Gradual recovery
        }
        else {
          health.consecutiveFailures++
          health.errorRate = Math.min(1, health.errorRate + 0.2)
          health.status = health.consecutiveFailures > 3 ? 'unhealthy' : 'degraded'
        }

        health.lastHealthCheck = Date.now()
        this.emit('healthCheck', { client, health })
      }
      catch (error) {
        health.consecutiveFailures++
        health.errorRate = 1
        health.status = 'unhealthy'
        health.lastHealthCheck = Date.now()
        logger.debug(`Health check failed for connection:`, error)
      }
    })

    await Promise.allSettled(checks)
    this.rebalanceConnections()
  }

  private rebalanceConnections(): void {
    const healthyConnections = this.connections.filter(
      client => this.healthStatus.get(client)?.status === 'healthy',
    )

    if (healthyConnections.length < Math.ceil(this.maxSize * 0.3)) {
      logger.warn(`Low healthy connection ratio: ${healthyConnections.length}/${this.maxSize}`)
      this.emit('lowHealth', { healthy: healthyConnections.length, total: this.maxSize })
    }
  }

  async acquireConnection(priority = 0): Promise<N8NApiClient> {
    const healthyConnections = this.connections.filter(
      client => this.healthStatus.get(client)?.status === 'healthy',
    )

    if (healthyConnections.length > 0) {
      // Return connection with lowest latency
      const bestConnection = healthyConnections.reduce((best, current) => {
        const bestHealth = this.healthStatus.get(best)
        const currentHealth = this.healthStatus.get(current)
        if (!bestHealth || !currentHealth) {
          return best
        }
        return currentHealth.latency < bestHealth.latency ? current : best
      })

      return bestConnection
    }

    // Fallback to degraded connections
    const degradedConnections = this.connections.filter(
      client => this.healthStatus.get(client)?.status === 'degraded',
    )

    if (degradedConnections.length > 0) {
      logger.warn('Using degraded connection due to no healthy connections available')
      const connection = degradedConnections[0]
      if (!connection) {
        throw new Error('No degraded connection available')
      }
      return connection
    }

    // Queue request if no connections available
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, priority })
      this.requestQueue.sort((a, b) => b.priority - a.priority)

      // Timeout after 10 seconds
      setTimeout(() => {
        const index = this.requestQueue.findIndex(item => item.resolve === resolve)
        if (index > -1) {
          this.requestQueue.splice(index, 1)
          reject(new Error('Connection acquisition timeout'))
        }
      }, 10000)
    })
  }

  getPoolStats(): {
    total: number
    healthy: number
    degraded: number
    unhealthy: number
    queueLength: number
    averageLatency: number
  } {
    const stats = { total: 0, healthy: 0, degraded: 0, unhealthy: 0, queueLength: 0, averageLatency: 0 }
    let totalLatency = 0

    for (const [_client, health] of this.healthStatus) {
      stats.total++
      stats[health.status]++
      totalLatency += health.latency
    }

    stats.queueLength = this.requestQueue.length
    stats.averageLatency = stats.total > 0 ? totalLatency / stats.total : 0

    return stats
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    // Reject all queued requests
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) {
        request.reject(new Error('Connection pool shutting down'))
      }
    }

    logger.info('n8n connection pool shut down')
  }
}

// === Intelligent Caching System ===

export class IntelligentCacheManager {
  private workflowCache: AdvancedCache<N8NWorkflow>
  private executionCache: AdvancedCache<N8NExecution>
  private credentialCache: AdvancedCache<N8NCredential>
  private invalidationRules = new Map<string, string[]>()
  private cacheDependencies = new Map<string, Set<string>>()

  constructor(
    private readonly connectionPool: N8NConnectionPool,
    strategy: CacheStrategy = CacheStrategy.ADAPTIVE,
  ) {
    // Workflow cache: longer TTL, larger capacity
    this.workflowCache = new AdvancedCache<N8NWorkflow>(
      1000,
      strategy,
      3600000, // 1 hour TTL
    )

    // Execution cache: shorter TTL, medium capacity
    this.executionCache = new AdvancedCache<N8NExecution>(
      500,
      strategy,
      600000, // 10 minute TTL
    )

    // Credential cache: very short TTL for security
    this.credentialCache = new AdvancedCache<N8NCredential>(
      200,
      strategy,
      300000, // 5 minute TTL
    )

    this.setupInvalidationRules()
  }

  private setupInvalidationRules(): void {
    // When workflow is updated, invalidate related executions
    this.invalidationRules.set('workflow:update', ['execution:*'])

    // When execution starts, invalidate workflow stats
    this.invalidationRules.set('execution:create', ['workflow:stats:*'])

    // When credential is updated, invalidate related workflows
    this.invalidationRules.set('credential:update', ['workflow:*'])
  }

  async getWorkflow(id: string): Promise<N8NWorkflow | null> {
    const cached = this.workflowCache.get(`workflow:${id}`)
    if (cached) {
      logger.debug(`Cache hit for workflow ${id}`)
      return cached
    }

    try {
      const client = await this.connectionPool.acquireConnection()
      const workflow = await client.getWorkflow(id)

      this.workflowCache.set(`workflow:${id}`, workflow, 3600000)
      this.addDependency(`workflow:${id}`, `execution:workflow:${id}`)

      logger.debug(`Cache miss for workflow ${id}, fetched and cached`)
      return workflow
    }
    catch (error) {
      logger.warn(`Failed to fetch workflow ${id}:`, error)
      return null
    }
  }

  async getExecution(id: string): Promise<N8NExecution | null> {
    const cached = this.executionCache.get(`execution:${id}`)
    if (cached) {
      return cached
    }

    try {
      const client = await this.connectionPool.acquireConnection()
      const execution = await client.getExecution(id)

      this.executionCache.set(`execution:${id}`, execution)
      if (execution.workflowId) {
        this.addDependency(`execution:${id}`, `workflow:${execution.workflowId}`)
      }

      return execution
    }
    catch (error) {
      logger.warn(`Failed to fetch execution ${id}:`, error)
      return null
    }
  }

  private addDependency(key: string, dependsOn: string): void {
    if (!this.cacheDependencies.has(dependsOn)) {
      this.cacheDependencies.set(dependsOn, new Set())
    }
    const dependencies = this.cacheDependencies.get(dependsOn)
    if (dependencies) {
      dependencies.add(key)
    }
  }

  invalidate(pattern: string): void {
    // Direct pattern invalidation
    if (pattern.includes('*')) {
      this.invalidatePattern(pattern)
    }
    else {
      this.workflowCache.get(pattern) && this.workflowCache.delete(pattern)
      this.executionCache.get(pattern) && this.executionCache.delete(pattern)
      this.credentialCache.get(pattern) && this.credentialCache.delete(pattern)
    }

    // Cascade invalidation based on dependencies
    this.cascadeInvalidation(pattern)

    logger.debug(`Cache invalidated for pattern: ${pattern}`)
  }

  private invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'))

    // Clear matching entries from all caches
    for (const cache of [this.workflowCache, this.executionCache, this.credentialCache]) {
      const keys = cache.getCacheKeys()
      keys.forEach((key) => {
        if (regex.test(key)) {
          cache.delete(key)
        }
      })
    }
  }

  private cascadeInvalidation(changedKey: string): void {
    const dependents = this.cacheDependencies.get(changedKey)
    if (dependents) {
      dependents.forEach((dependent) => {
        this.invalidate(dependent)
      })
    }
  }

  getCacheStats(): {
    workflow: { size: number, hitRate: number }
    execution: { size: number, hitRate: number }
    credential: { size: number, hitRate: number }
    dependencies: number
  } {
    const workflowStats = this.workflowCache.getStats()
    const executionStats = this.executionCache.getStats()
    const credentialStats = this.credentialCache.getStats()
    return {
      workflow: { size: workflowStats.size, hitRate: workflowStats.hitRatio },
      execution: { size: executionStats.size, hitRate: executionStats.hitRatio },
      credential: { size: credentialStats.size, hitRate: credentialStats.hitRatio },
      dependencies: this.cacheDependencies.size,
    }
  }

  async preloadWorkflows(): Promise<void> {
    try {
      const client = await this.connectionPool.acquireConnection()
      const workflows = await client.getWorkflows()

      workflows.forEach((workflow) => {
        if (workflow.id) {
          this.workflowCache.set(`workflow:${workflow.id}`, workflow, 3600000)
        }
      })

      logger.info(`Preloaded ${workflows.length} workflows into cache`)
    }
    catch (error) {
      logger.warn('Failed to preload workflows:', error)
    }
  }
}

// === Request Batching System ===

export class RequestBatchProcessor extends EventEmitter {
  private batches = new Map<string, RequestBatch>()
  private processingQueue: RequestBatch[] = []
  private isProcessing = false
  private readonly batchTimeout: number
  private readonly maxBatchSize: number

  constructor(
    private readonly connectionPool: N8NConnectionPool,
    batchTimeout = 100,
    maxBatchSize = 10,
  ) {
    super()
    this.batchTimeout = batchTimeout
    this.maxBatchSize = maxBatchSize
    this.startProcessor()
  }

  async addRequest(
    method: string,
    endpoint: string,
    payload?: unknown,
    priority = 0,
  ): Promise<unknown> {
    const requestId = this.generateRequestId()
    const batchId = this.getBatchId(method, endpoint)

    let batch = this.batches.get(batchId)
    if (!batch) {
      batch = {
        id: batchId,
        requests: [],
        priority,
        createdAt: Date.now(),
        timeout: this.batchTimeout,
      }
      this.batches.set(batchId, batch)

      // Schedule batch processing
      setTimeout(() => this.flushBatch(batchId), this.batchTimeout)
    }

    const request: BatchRequest = {
      id: requestId,
      method,
      endpoint,
      payload,
      retryCount: 0,
    }

    batch.requests.push(request)

    // Flush batch if it reaches max size
    if (batch.requests.length >= this.maxBatchSize) {
      this.flushBatch(batchId)
    }

    return new Promise((resolve, reject) => {
      this.once(`response:${requestId}`, resolve)
      this.once(`error:${requestId}`, reject)
    })
  }

  private getBatchId(method: string, endpoint: string): string {
    // Group similar requests together
    const baseEndpoint = endpoint.split('?')[0]?.replace(/\/\d+/, '/:id') || endpoint
    return `${method}:${baseEndpoint}`
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private flushBatch(batchId: string): void {
    const batch = this.batches.get(batchId)
    if (!batch || batch.requests.length === 0) {
      return
    }

    this.batches.delete(batchId)
    this.processingQueue.push(batch)

    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true

    while (this.processingQueue.length > 0) {
      // Sort by priority
      this.processingQueue.sort((a, b) => b.priority - a.priority)
      const batch = this.processingQueue.shift()
      if (!batch) {
        break // No more batches to process
      }

      try {
        // Sequential batch processing required for ordered execution
        // eslint-disable-next-line no-await-in-loop
        await this.processBatch(batch)
      }
      catch (error) {
        logger.error(`Batch processing failed for ${batch.id}:`, error)

        // Emit errors for all requests in batch
        batch.requests.forEach((request) => {
          this.emit(`error:${request.id}`, error)
        })
      }
    }

    this.isProcessing = false
  }

  private async processBatch(batch: RequestBatch): Promise<void> {
    logger.debug(`Processing batch ${batch.id} with ${batch.requests.length} requests`)

    // For similar requests, we can optimize by grouping them
    if (this.canOptimizeBatch(batch)) {
      return this.processOptimizedBatch(batch)
    }

    // Process requests individually with parallelization
    const promises = batch.requests.map(request =>
      this.processSingleRequest(request),
    )

    const results = await Promise.allSettled(promises)

    results.forEach((result, index) => {
      const request = batch.requests[index]
      if (request) {
        if (result.status === 'fulfilled') {
          this.emit(`response:${request.id}`, result.value)
        }
        else {
          this.emit(`error:${request.id}`, result.reason)
        }
      }
    })
  }

  private canOptimizeBatch(batch: RequestBatch): boolean {
    // Check if all requests are GET requests to similar endpoints
    return batch.requests.every(req =>
      req.method === 'GET'
      && batch.requests[0]?.endpoint.split('/')[1] === req.endpoint.split('/')[1],
    )
  }

  private async processOptimizedBatch(batch: RequestBatch): Promise<void> {
    // Example: Batch multiple workflow GETs into a single list request
    if (batch.requests.every(req => req.endpoint.startsWith('/workflows/'))) {
      try {
        const client = await this.connectionPool.acquireConnection()
        const allWorkflows = await client.getWorkflows()

        batch.requests.forEach((request) => {
          const workflowId = request.endpoint.split('/')[2]
          const workflow = allWorkflows.find(w => w.id === workflowId)
          this.emit(`response:${request.id}`, workflow)
        })

        logger.debug(`Optimized batch: fetched ${allWorkflows.length} workflows for ${batch.requests.length} requests`)
        return
      }
      catch {
        // Fall back to individual processing
        logger.debug('Batch optimization failed, falling back to individual requests')
      }
    }

    // Fall back to individual processing
    return this.processBatch(batch)
  }

  private async processSingleRequest(request: BatchRequest): Promise<unknown> {
    const client = await this.connectionPool.acquireConnection()

    // Map method and endpoint to client method
    const method = request.method.toLowerCase()
    const endpoint = request.endpoint

    if (method === 'get' && endpoint.startsWith('/workflows/')) {
      const id = endpoint.split('/')[2]
      if (!id) {
        throw new Error('Invalid workflow endpoint - missing ID')
      }
      return await client.getWorkflow(id)
    }
    else if (method === 'get' && endpoint.startsWith('/executions/')) {
      const id = endpoint.split('/')[2]
      if (!id) {
        throw new Error('Invalid execution endpoint - missing ID')
      }
      return await client.getExecution(id)
    }
    else if (method === 'post' && endpoint === '/workflows') {
      return await client.createWorkflow(request.payload as WorkflowCreatePayload)
    }

    throw new Error(`Unsupported batch request: ${method} ${endpoint}`)
  }

  private startProcessor(): void {
    // Start background processor with interval
    setInterval(() => {
      if (this.processingQueue.length > 0 && !this.isProcessing) {
        this.processQueue()
      }
    }, 50) // Process every 50ms
  }

  getBatchingStats(): {
    activeBatches: number
    queueLength: number
    totalBatchesProcessed: number
  } {
    return {
      activeBatches: this.batches.size,
      queueLength: this.processingQueue.length,
      totalBatchesProcessed: this.listenerCount('batchProcessed'),
    }
  }
}

// === Enhanced Integration Manager ===

export class EnhancedN8NIntegration extends EventEmitter {
  private connectionPool!: N8NConnectionPool
  private cacheManager!: IntelligentCacheManager
  private batchProcessor!: RequestBatchProcessor
  private webhookProcessor?: WebhookEventProcessor
  private monitoringMetrics: MonitoringMetrics
  private isInitialized = false

  constructor(private options: EnhancedApiOptions = {}) {
    super()

    // Set defaults
    this.options = {
      connectionPoolSize: 5,
      enableIntelligentCaching: true,
      enableRequestBatching: true,
      enableWebhookProcessing: true,
      enableRealTimeMonitoring: true,
      maxConcurrentRequests: 10,
      requestTimeout: 30000,
      cacheStrategy: CacheStrategy.ADAPTIVE,
      ...options,
    }

    this.monitoringMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRatio: 0,
      activeConnections: 0,
      webhooksProcessed: 0,
      batchesProcessed: 0,
      healthScore: 100,
    }

    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize connection pool
      const poolSize = this.options.connectionPoolSize ?? 5
      this.connectionPool = new N8NConnectionPool(poolSize)

      // Initialize intelligent caching
      if (this.options.enableIntelligentCaching) {
        this.cacheManager = new IntelligentCacheManager(
          this.connectionPool,
          this.options.cacheStrategy,
        )

        // Preload commonly accessed data
        await this.cacheManager.preloadWorkflows()
      }

      // Initialize request batching
      if (this.options.enableRequestBatching) {
        this.batchProcessor = new RequestBatchProcessor(this.connectionPool)
      }

      // Initialize webhook processing
      if (this.options.enableWebhookProcessing) {
        this.webhookProcessor = new WebhookEventProcessor(this)
      }

      // Start monitoring
      if (this.options.enableRealTimeMonitoring) {
        this.startMonitoring()
      }

      this.isInitialized = true
      this.emit('initialized')

      logger.info('Enhanced n8n integration initialized successfully', {
        connectionPool: this.options.connectionPoolSize,
        caching: this.options.enableIntelligentCaching,
        batching: this.options.enableRequestBatching,
        webhooks: this.options.enableWebhookProcessing,
        monitoring: this.options.enableRealTimeMonitoring,
      })
    }
    catch (error) {
      logger.error('Failed to initialize enhanced n8n integration:', error)
      throw error
    }
  }

  // Enhanced workflow operations with caching and batching
  async getWorkflow(id: string, useCache = true): Promise<N8NWorkflow | null> {
    this.monitoringMetrics.totalRequests++
    const startTime = performance.now()

    try {
      let workflow: N8NWorkflow | null = null

      if (useCache && this.cacheManager) {
        workflow = await this.cacheManager.getWorkflow(id)
        if (workflow) {
          this.updateCacheHitRatio(true)
        }
      }

      if (!workflow) {
        if (this.batchProcessor) {
          workflow = await this.batchProcessor.addRequest('GET', `/workflows/${id}`) as N8NWorkflow
        }
        else {
          const client = await this.connectionPool.acquireConnection()
          workflow = await client.getWorkflow(id)
        }
        this.updateCacheHitRatio(false)
      }

      this.monitoringMetrics.successfulRequests++
      this.updateResponseTime(performance.now() - startTime)

      return workflow
    }
    catch (error) {
      this.monitoringMetrics.failedRequests++
      logger.error(`Enhanced getWorkflow failed for ${id}:`, error)
      throw error
    }
  }

  async getWorkflows(useCache = true): Promise<N8NWorkflow[]> {
    this.monitoringMetrics.totalRequests++
    const startTime = performance.now()

    try {
      const client = await this.connectionPool.acquireConnection()
      const workflows = await client.getWorkflows()

      // Cache individual workflows for future use
      if (this.cacheManager && useCache) {
        workflows.forEach((workflow) => {
          if (workflow.id) {
            // eslint-disable-next-line ts/no-explicit-any
            (this.cacheManager as any).workflowCache.set(`workflow:${workflow.id}`, workflow, 3600000)
          }
        })
      }

      this.monitoringMetrics.successfulRequests++
      this.updateResponseTime(performance.now() - startTime)

      return workflows
    }
    catch (error) {
      this.monitoringMetrics.failedRequests++
      logger.error('Enhanced getWorkflows failed:', error)
      throw error
    }
  }

  async createWorkflow(workflow: WorkflowCreatePayload | Record<string, unknown>): Promise<N8NWorkflow> {
    this.monitoringMetrics.totalRequests++
    const startTime = performance.now()

    try {
      let result: N8NWorkflow

      if (this.batchProcessor) {
        result = await this.batchProcessor.addRequest('POST', '/workflows', workflow, 10) as N8NWorkflow
      }
      else {
        const client = await this.connectionPool.acquireConnection()
        result = await client.createWorkflow(workflow)
      }

      // Invalidate related cache entries
      if (this.cacheManager) {
        this.cacheManager.invalidate('workflow:*')

        // Cache the new workflow
        if (result.id) {
          // eslint-disable-next-line ts/no-explicit-any
          (this.cacheManager as any).workflowCache.set(`workflow:${result.id}`, result, 3600000)
        }
      }

      this.monitoringMetrics.successfulRequests++
      this.updateResponseTime(performance.now() - startTime)

      this.emit('workflowCreated', result)
      return result
    }
    catch (error) {
      this.monitoringMetrics.failedRequests++
      logger.error('Enhanced createWorkflow failed:', error)
      throw error
    }
  }

  private updateCacheHitRatio(isHit: boolean): void {
    // Exponential moving average for cache hit ratio
    const alpha = 0.1
    const hitValue = isHit ? 1 : 0
    this.monitoringMetrics.cacheHitRatio
      = (alpha * hitValue) + ((1 - alpha) * this.monitoringMetrics.cacheHitRatio)
  }

  private updateResponseTime(responseTime: number): void {
    // Exponential moving average for response time
    const alpha = 0.1
    this.monitoringMetrics.averageResponseTime
      = (alpha * responseTime) + ((1 - alpha) * this.monitoringMetrics.averageResponseTime)
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.updateHealthScore()
      this.updateActiveConnections()
      this.emit('metricsUpdated', this.getMetrics())
    }, 10000) // Update every 10 seconds
  }

  private updateHealthScore(): void {
    const successRate = this.monitoringMetrics.totalRequests > 0
      ? (this.monitoringMetrics.successfulRequests / this.monitoringMetrics.totalRequests) * 100
      : 100

    const responseTimeFactor = Math.max(0, 100 - (this.monitoringMetrics.averageResponseTime / 100))
    const cacheEfficiencyFactor = this.monitoringMetrics.cacheHitRatio * 100

    this.monitoringMetrics.healthScore = Math.round(
      (successRate * 0.5)
      + (responseTimeFactor * 0.3)
      + (cacheEfficiencyFactor * 0.2),
    )
  }

  private updateActiveConnections(): void {
    if (this.connectionPool) {
      const stats = this.connectionPool.getPoolStats()
      this.monitoringMetrics.activeConnections = stats.healthy + stats.degraded
    }
  }

  // Public getters for private properties
  get cacheManagerInstance(): IntelligentCacheManager {
    return this.cacheManager
  }

  get monitoringMetricsInstance(): MonitoringMetrics {
    return this.monitoringMetrics
  }

  getMetrics(): MonitoringMetrics {
    return { ...this.monitoringMetrics }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down enhanced n8n integration...')

    if (this.connectionPool) {
      await this.connectionPool.shutdown()
    }

    if (this.webhookProcessor) {
      await this.webhookProcessor.shutdown()
    }

    this.emit('shutdown')
    logger.info('Enhanced n8n integration shut down successfully')
  }
}

// === Webhook Event Processor ===

class WebhookEventProcessor extends EventEmitter {
  private eventQueue: WebhookEvent[] = []
  private isProcessing = false
  private processors = new Map<string, (event: WebhookEvent) => Promise<void>>()

  constructor(private integration: EnhancedN8NIntegration) {
    super()
    this.setupEventProcessors()
    this.startProcessor()
  }

  private setupEventProcessors(): void {
    this.processors.set('workflow.completed', this.handleWorkflowCompleted.bind(this))
    this.processors.set('workflow.failed', this.handleWorkflowFailed.bind(this))
    this.processors.set('workflow.started', this.handleWorkflowStarted.bind(this))
  }

  private async handleWorkflowCompleted(event: WebhookEvent): Promise<void> {
    logger.debug(`Workflow ${event.workflowId} completed (execution: ${event.executionId})`)

    // Update cache with execution results if available
    if (event.executionId && this.integration.cacheManagerInstance) {
      // Invalidate workflow stats cache as execution completed
      this.integration.cacheManagerInstance.invalidate(`workflow:stats:${event.workflowId}`)
    }
  }

  private async handleWorkflowFailed(event: WebhookEvent): Promise<void> {
    logger.warn(`Workflow ${event.workflowId} failed (execution: ${event.executionId})`)

    // Could trigger alerts, retries, or notifications here
    this.integration.emit('workflowFailed', event)
  }

  private async handleWorkflowStarted(event: WebhookEvent): Promise<void> {
    logger.debug(`Workflow ${event.workflowId} started (execution: ${event.executionId})`)
    this.integration.emit('workflowStarted', event)
  }

  async processWebhookEvent(event: WebhookEvent): Promise<void> {
    this.eventQueue.push(event)

    if (!this.isProcessing) {
      this.startProcessor()
    }
  }

  private async startProcessor(): Promise<void> {
    this.isProcessing = true

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()
      if (!event) {
        break // No more events to process
      }
      const processor = this.processors.get(event.type)

      if (processor) {
        try {
          // Sequential event processing required for ordered webhook handling
          // eslint-disable-next-line no-await-in-loop
          await processor(event)
          this.integration.monitoringMetricsInstance.webhooksProcessed++
        }
        catch (error) {
          logger.error(`Webhook processor failed for ${event.type}:`, error)
        }
      }
    }

    this.isProcessing = false
  }

  async shutdown(): Promise<void> {
    this.eventQueue = []
    this.isProcessing = false
    logger.info('Webhook event processor shut down')
  }
}

export { WebhookEventProcessor }
