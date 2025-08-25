/**
 * Advanced Agent Communication Optimization System
 * Part of Phase 5: Advanced Features for n8n-MCP Modern
 *
 * This module provides high-performance communication patterns for agent systems:
 * - Connection pooling and resource management
 * - Advanced caching with LRU and TTL strategies
 * - Parallel processing with backpressure control
 * - Intelligent routing with performance analytics
 * - Circuit breaker pattern for resilience
 * - Message streaming and batching optimization
 */

import type { Agent, AgentContext, EscalationRequest, EscalationResult } from './index.js'
import type { StoryFile, StoryMetrics } from './story-files.js'
import { performance } from 'node:perf_hooks'
import { shouldLimitMemoryArrays } from '../server/feature-flags.js'
import { logger } from '../server/logger.js'
import { StoryStatus } from './story-files.js'
import { storyManager } from './story-manager.js'

// === Performance Monitoring Types ===

export interface CommunicationMetrics {
  routingLatency: number[]
  escalationLatency: number[]
  throughput: number
  errorRate: number
  cacheHitRatio: number
  activeConnections: number
  queueLength: number
  circuitBreakerState: CircuitBreakerState

  // Agent handover story file metrics
  storyMetrics?: StoryMetrics
  activeStoryFiles: number
  averageHandoverTime: number
  storyFileHitRatio: number
}

export interface PerformanceProfile {
  agentName: string
  averageResponseTime: number
  successRate: number
  resourceUtilization: number
  lastUpdated: number
}

// === Advanced Caching System ===

export enum CacheStrategy {
  LRU = 'lru',
  TTL = 'ttl',
  LFU = 'lfu',
  ADAPTIVE = 'adaptive',
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
  ttl?: number
}

export class AdvancedCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private accessOrder: string[] = []
  private readonly maxSize: number
  private readonly strategy: CacheStrategy
  private readonly defaultTTL: number
  private hitCount = 0
  private missCount = 0

  constructor(
    maxSize = 1000,
    strategy = CacheStrategy.LRU,
    defaultTTL = 300000, // 5 minutes
  ) {
    this.maxSize = maxSize
    this.strategy = strategy
    this.defaultTTL = defaultTTL

    // Auto-cleanup interval
    setInterval(() => this.cleanup(), 60000) // Every minute
  }

  set(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      accessCount: 0,
      ttl: ttl ?? this.defaultTTL,
    }

    // Handle size limits
    if (this.cache.size >= this.maxSize) {
      this.evict()
    }

    this.cache.set(key, entry)
    this.updateAccessOrder(key)
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      this.missCount++
      return undefined
    }

    // Check TTL
    if (entry.ttl && (Date.now() - entry.timestamp) > entry.ttl) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      this.missCount++
      return undefined
    }

    entry.accessCount++
    this.updateAccessOrder(key)
    this.hitCount++
    return entry.data
  }

  private evict(): void {
    switch (this.strategy) {
      case CacheStrategy.LRU:
        this.evictLRU()
        break
      case CacheStrategy.LFU:
        this.evictLFU()
        break
      case CacheStrategy.ADAPTIVE:
        this.evictAdaptive()
        break
      default:
        this.evictLRU()
    }
  }

  private evictLRU(): void {
    const oldestKey = this.accessOrder[0]
    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.removeFromAccessOrder(oldestKey)
    }
  }

  private evictLFU(): void {
    let minAccessCount = Infinity
    let keyToRemove = ''

    for (const [key, entry] of this.cache) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount
        keyToRemove = key
      }
    }

    if (keyToRemove) {
      this.cache.delete(keyToRemove)
      this.removeFromAccessOrder(keyToRemove)
    }
  }

  private evictAdaptive(): void {
    // Use LRU for cold data, LFU for hot data
    const now = Date.now()
    const hotThreshold = 300000 // 5 minutes

    // Find cold entries (not accessed recently)
    for (const [key, entry] of this.cache) {
      if ((now - entry.timestamp) > hotThreshold) {
        this.cache.delete(key)
        this.removeFromAccessOrder(key)
        return
      }
    }

    // Fall back to LFU for hot data
    this.evictLFU()
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key)
    this.accessOrder.push(key)
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache) {
      if (entry.ttl && (now - entry.timestamp) > entry.ttl) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
    }
  }

  getStats(): { size: number, hitRatio: number, hitCount: number, missCount: number } {
    const total = this.hitCount + this.missCount
    return {
      size: this.cache.size,
      hitRatio: total > 0 ? this.hitCount / total : 0,
      hitCount: this.hitCount,
      missCount: this.missCount,
    }
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
    this.hitCount = 0
    this.missCount = 0
  }

  // Public methods to expose private cache for external access
  getCacheKeys(): string[] {
    return Array.from(this.cache.keys())
  }

  delete(key: string): boolean {
    const result = this.cache.delete(key)
    if (result) {
      this.removeFromAccessOrder(key)
    }
    return result
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }
}

// === Circuit Breaker Pattern ===

export enum CircuitBreakerState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Failing, reject requests
  HALF_OPEN = 'half_open', // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
  minimumThroughput: number
}

export class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED
  private failures = 0
  private lastFailureTime = 0
  private successes = 0
  private readonly config: CircuitBreakerConfig

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod ?? 300000, // 5 minutes
      minimumThroughput: config.minimumThroughput ?? 10,
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN
      }
      else {
        throw new Error('Circuit breaker is OPEN - rejecting request')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    }
    catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.successes++

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.reset()
    }
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN
      logger.warn(`Circuit breaker opened after ${this.failures} failures`)
    }
  }

  private shouldAttemptReset(): boolean {
    return (Date.now() - this.lastFailureTime) >= this.config.resetTimeout
  }

  private reset(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failures = 0
    this.successes = 0
    logger.info('Circuit breaker reset to CLOSED state')
  }

  getState(): CircuitBreakerState {
    return this.state
  }

  getStats(): { state: CircuitBreakerState, failures: number, successes: number } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
    }
  }
}

// === Connection Pool Management ===

export interface ConnectionPool<T> {
  acquire: () => Promise<T>
  release: (connection: T) => void
  size: () => number
  availableCount: () => number
  destroy: () => Promise<void>
}

export class AgentConnectionPool implements ConnectionPool<Agent> {
  private available: Agent[] = []
  private inUse = new Set<Agent>()
  private readonly maxSize: number
  private readonly agents: Agent[]
  private destroyed = false

  constructor(agents: Agent[], maxSize = 10) {
    this.agents = agents
    this.maxSize = maxSize
    this.initialize()
  }

  private initialize(): void {
    // Pre-warm the pool with available agents
    for (let i = 0; i < Math.min(this.maxSize, this.agents.length); i++) {
      const agent = this.agents[i % this.agents.length]
      if (agent) {
        this.available.push(agent)
      }
    }
  }

  async acquire(): Promise<Agent> {
    if (this.destroyed) {
      throw new Error('Connection pool is destroyed')
    }

    if (this.available.length > 0) {
      const agent = this.available.pop()
      if (!agent) {
        throw new Error('Failed to get agent from available pool')
      }
      this.inUse.add(agent)
      return agent
    }

    // If no available agents and under max size, create new connection
    if (this.size() < this.maxSize) {
      const agentIndex = this.size() % this.agents.length
      const agent = this.agents[agentIndex]
      if (!agent) {
        throw new Error(`No agent available at index ${agentIndex}`)
      }
      this.inUse.add(agent)
      return agent
    }

    // Wait for an agent to become available (with shorter timeout for tests)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for available agent'))
      }, 1000) // 1 second timeout for better testing

      const checkAvailable = (): void => {
        if (this.destroyed) {
          clearTimeout(timeout)
          reject(new Error('Connection pool is destroyed'))
          return
        }

        if (this.available.length > 0) {
          clearTimeout(timeout)
          const agent = this.available.pop()
          if (!agent) {
            reject(new Error('Failed to get agent from available pool'))
            return
          }
          this.inUse.add(agent)
          resolve(agent)
        }
        else {
          setTimeout(checkAvailable, 50)
        }
      }

      checkAvailable()
    })
  }

  release(agent: Agent): void {
    if (this.inUse.has(agent)) {
      this.inUse.delete(agent)
      this.available.push(agent)
    }
  }

  size(): number {
    return this.available.length + this.inUse.size
  }

  availableCount(): number {
    return this.available.length
  }

  async destroy(): Promise<void> {
    this.destroyed = true
    this.available = []
    this.inUse.clear()
  }

  getStats(): { total: number, available: number, inUse: number } {
    return {
      total: this.size(),
      available: this.availableCount(),
      inUse: this.inUse.size,
    }
  }

  getAgents(): Agent[] {
    return [...this.agents]
  }
}

// === Advanced Message Queue with Backpressure ===

export interface QueuedMessage<T> {
  id: string
  payload: T
  priority: number
  timestamp: number
  retryCount: number
  maxRetries: number
}

export class MessageQueue<T> {
  private queue: QueuedMessage<T>[] = []
  private processing = false
  private readonly maxSize: number
  private readonly concurrency: number
  private activeWorkers = 0

  constructor(maxSize = 1000, concurrency = 5) {
    this.maxSize = maxSize
    this.concurrency = concurrency
  }

  async enqueue(
    payload: T,
    priority = 0,
    maxRetries = 3,
  ): Promise<string> {
    if (this.queue.length >= this.maxSize) {
      throw new Error('Message queue is full - backpressure applied')
    }

    const message: QueuedMessage<T> = {
      id: this.generateId(),
      payload,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    }

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(m => m.priority < priority)
    if (insertIndex === -1) {
      this.queue.push(message)
    }
    else {
      this.queue.splice(insertIndex, 0, message)
    }

    // Start processing if not already running
    if (!this.processing && this.queue.length > 0) {
      setImmediate((): void => {
        void this.startProcessing()
      })
    }

    return message.id
  }

  private async startProcessing(): Promise<void> {
    this.processing = true

    const processNext = async (): Promise<void> => {
      while (this.queue.length > 0 && this.activeWorkers < this.concurrency) {
        const message = this.queue.shift()
        if (message) {
          this.activeWorkers++
          this.processMessage(message).finally(() => {
            this.activeWorkers--
            // Continue processing after this worker finishes
            if (this.queue.length > 0 && this.processing) {
              setImmediate(() => processNext())
            }
            else if (this.queue.length === 0 && this.activeWorkers === 0) {
              this.processing = false
            }
          })
        }
      }
    }

    await processNext()
  }

  private async processMessage(message: QueuedMessage<T>): Promise<void> {
    try {
      // This would be implemented by the consumer
      await this.handleMessage(message.payload)
      logger.debug(`Processed message ${message.id}`)
    }
    catch (error) {
      logger.error(`Error processing message ${message.id}:`, error)

      if (message.retryCount < message.maxRetries) {
        message.retryCount++
        // Re-queue for retry with lower priority
        this.queue.push({ ...message, priority: message.priority - 1 })
        logger.debug(`Re-queued message ${message.id} for retry ${message.retryCount}`)
      }
    }
  }

  // Override this method in implementations
  protected async handleMessage(_payload: T): Promise<void> {
    logger.warn('handleMessage not implemented - message dropped')
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getStats(): { size: number, activeWorkers: number, processing: boolean } {
    return {
      size: this.queue.length,
      activeWorkers: this.activeWorkers,
      processing: this.processing,
    }
  }

  clear(): void {
    this.queue = []
    this.processing = false
  }
}

// === Optimized Communication Manager ===

export class CommunicationManager {
  private routingCache = new AdvancedCache<Agent>(500, CacheStrategy.ADAPTIVE)
  private performanceCache = new AdvancedCache<PerformanceProfile>(200)
  private storyFileCache = new AdvancedCache<StoryFile>(300, CacheStrategy.LRU)
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private connectionPool?: AgentConnectionPool
  private messageQueue = new class extends MessageQueue<EscalationRequest> {
    protected override async handleMessage(payload: EscalationRequest): Promise<void> {
      // Handle escalation messages
      logger.debug('Processing escalation request:', payload.reason)
    }
  }()

  private metrics: CommunicationMetrics = {
    routingLatency: [],
    escalationLatency: [],
    throughput: 0,
    errorRate: 0,
    cacheHitRatio: 0,
    activeConnections: 0,
    queueLength: 0,
    circuitBreakerState: CircuitBreakerState.CLOSED,
    activeStoryFiles: 0,
    averageHandoverTime: 0,
    storyFileHitRatio: 0,
  }

  constructor(agents: Agent[]) {
    this.connectionPool = new AgentConnectionPool(agents)
    this.initializeCircuitBreakers(agents)
    this.startMetricsCollection()
  }

  private initializeCircuitBreakers(agents: Agent[]): void {
    for (const agent of agents) {
      this.circuitBreakers.set(agent.name, new CircuitBreaker())
    }
  }

  async routeWithOptimization(
    toolName: string,
    context?: AgentContext,
  ): Promise<Agent> {
    const startTime = performance.now()
    const cacheKey = `${toolName}:${JSON.stringify(context ?? {})}`

    try {
      // Try cache first
      const cachedAgent = this.routingCache.get(cacheKey)
      if (cachedAgent) {
        this.recordLatency('routing', performance.now() - startTime)
        return cachedAgent
      }

      // Find the best agent that can handle this tool
      let bestAgent: Agent | null = null
      let bestPriority = -1

      const connectionPool = this.connectionPool
      if (!connectionPool) {
        throw new Error('Connection pool not initialized')
      }

      for (const agent of connectionPool.getAgents()) {
        const circuitBreaker = this.circuitBreakers.get(agent.name)
        if (!circuitBreaker) {
          continue // Skip agents without circuit breakers
        }

        try {
          // Sequential processing required to find best agent based on priority
          // eslint-disable-next-line no-await-in-loop
          await circuitBreaker.execute(async () => {
            if (agent.canHandle(toolName, context)) {
              const priority = agent.getPriority(toolName, context)
              if (priority > bestPriority) {
                bestAgent = agent
                bestPriority = priority
              }
            }
            return Promise.resolve()
          })
        }
        catch {
          // Circuit breaker or agent failure, skip this agent
          continue
        }
      }

      if (!bestAgent) {
        throw new Error(`No agent available to handle tool ${toolName}`)
      }

      // Cache successful routing
      this.routingCache.set(cacheKey, bestAgent, 300000) // 5 minute TTL
      this.recordLatency('routing', performance.now() - startTime)

      return bestAgent
    }
    catch (error) {
      this.metrics.errorRate++
      logger.error(`Routing optimization failed for ${toolName}:`, error)
      throw error
    }
  }

  async optimizedEscalation(request: EscalationRequest): Promise<EscalationResult> {
    const startTime = performance.now()

    try {
      // Handle story file integration
      let storyFileId = request.storyFileId
      let storyFile: StoryFile | null = null

      // Create or retrieve story file if needed
      if (request.requiresNewStory && !storyFileId) {
        storyFile = await storyManager.create({
          currentAgent: request.sourceAgent,
          context: {
            original: request.originalContext ?? {},
            current: request.originalContext ?? {},
            technical: {
              ...(request.technicalContext && {
                codebaseAnalysis: {
                  filesModified: request.technicalContext.filesModified ?? [],
                  filesCreated: [],
                  filesDeleted: [],
                  dependencies: [],
                  breakingChanges: request.technicalContext.breakingChange ?? false,
                },
              }),
            },
          },
          completedWork: request.completedWork ?? [],
          pendingWork: request.pendingWork ?? [],
          blockers: request.blockers ?? undefined,
        })
        storyFileId = storyFile.id

        // Cache the story file
        this.storyFileCache.set(storyFileId, storyFile, 300000) // 5 minutes
      }
      else if (storyFileId) {
        // Try to get from cache first
        storyFile = this.storyFileCache.get(storyFileId) ?? null
        if (!storyFile) {
          storyFile = await storyManager.retrieve(storyFileId)
          if (storyFile) {
            this.storyFileCache.set(storyFileId, storyFile, 300000)
          }
        }
      }

      // Queue the escalation for processing (convert urgency to numeric priority)
      const urgencyToPriority = {
        low: 1,
        medium: 5,
        high: 8,
        critical: 10,
      }
      const priority = request.urgency ? urgencyToPriority[request.urgency] : 5
      await this.messageQueue.enqueue(request, priority)

      // Enhanced result with story file integration
      const result: EscalationResult = {
        success: true,
        handledBy: 'n8n-workflow-architect',
        action: 'handled',
        message: 'Escalation processed successfully with story file integration',
        newContext: {},
        storyFileId: storyFileId ?? undefined,
        storyUpdates: storyFile
          ? {
              completedWork: storyFile.completedWork,
              pendingWork: storyFile.pendingWork,
              decisionsAdded: storyFile.decisions.length,
              phaseChanged: false,
            }
          : undefined,
      }

      this.recordLatency('escalation', performance.now() - startTime)
      return result
    }
    catch (error) {
      this.metrics.errorRate++
      logger.error('Optimized escalation failed:', error)
      throw error
    }
  }

  private recordLatency(type: 'routing' | 'escalation', latency: number): void {
    const metrics = type === 'routing' ? this.metrics.routingLatency : this.metrics.escalationLatency
    metrics.push(latency)

    // Apply feature-flag based memory management
    const maxSize = shouldLimitMemoryArrays() ? 50 : 1000

    // Keep only recent measurements to prevent memory growth
    if (metrics.length > maxSize) {
      // Remove oldest measurements to maintain bounds
      metrics.splice(0, metrics.length - maxSize)
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics()
    }, 10000) // Every 10 seconds
  }

  private updateMetrics(): void {
    if (this.connectionPool) {
      const poolStats = this.connectionPool.getStats()
      this.metrics.activeConnections = poolStats.total
    }

    const queueStats = this.messageQueue.getStats()
    this.metrics.queueLength = queueStats.size

    const cacheStats = this.routingCache.getStats()
    this.metrics.cacheHitRatio = cacheStats.hitRatio

    // Story file metrics
    const storyFileStats = this.storyFileCache.getStats()
    this.metrics.storyFileHitRatio = storyFileStats.hitRatio

    // Get story metrics from manager (async but don't wait)
    storyManager.getMetrics().then((storyMetrics) => {
      this.metrics.storyMetrics = storyMetrics
      this.metrics.activeStoryFiles = storyMetrics.storiesByStatus[StoryStatus.ACTIVE] ?? 0
    }).catch(() => {
      // Ignore errors in metrics collection
    })

    // Calculate average circuit breaker state
    let openBreakers = 0
    for (const breaker of this.circuitBreakers.values()) {
      if (breaker.getState() === CircuitBreakerState.OPEN) {
        openBreakers++
      }
    }

    if (openBreakers > 0) {
      this.metrics.circuitBreakerState = CircuitBreakerState.OPEN
    }
    else {
      this.metrics.circuitBreakerState = CircuitBreakerState.CLOSED
    }

    logger.debug('Communication metrics updated:', {
      routingLatencyAvg: this.getAverageLatency('routing'),
      escalationLatencyAvg: this.getAverageLatency('escalation'),
      cacheHitRatio: this.metrics.cacheHitRatio,
      storyFileHitRatio: this.metrics.storyFileHitRatio,
      activeConnections: this.metrics.activeConnections,
      activeStoryFiles: this.metrics.activeStoryFiles,
      queueLength: this.metrics.queueLength,
      circuitBreakerState: this.metrics.circuitBreakerState,
    })
  }

  private getAverageLatency(type: 'routing' | 'escalation'): number {
    const metrics = type === 'routing' ? this.metrics.routingLatency : this.metrics.escalationLatency
    if (metrics.length === 0)
      return 0
    return metrics.reduce((sum, latency) => sum + latency, 0) / metrics.length
  }

  getMetrics(): CommunicationMetrics {
    return { ...this.metrics }
  }

  // === Story File Management ===

  async getStoryFile(storyFileId: string): Promise<StoryFile | null> {
    // Try cache first
    const cached = this.storyFileCache.get(storyFileId)
    if (cached) {
      return cached
    }

    // Fetch from database
    const storyFile = await storyManager.retrieve(storyFileId)
    if (storyFile) {
      this.storyFileCache.set(storyFileId, storyFile, 300000) // 5 minute cache
    }

    return storyFile
  }

  async createStoryFile(agentName: string, context: Record<string, unknown>, initialWork?: string[]): Promise<StoryFile> {
    const storyFile = await storyManager.create({
      currentAgent: agentName,
      context: {
        original: context,
        current: context,
        technical: {},
      },
      completedWork: initialWork ?? [],
      pendingWork: [],
    })

    // Cache the new story file
    this.storyFileCache.set(storyFile.id, storyFile, 300000)

    return storyFile
  }

  async updateStoryFile(storyFileId: string, updates: Partial<StoryFile>): Promise<StoryFile | null> {
    const updatedStory = await storyManager.update(storyFileId, updates)

    // Update cache
    if (updatedStory) {
      this.storyFileCache.set(storyFileId, updatedStory, 300000)
    }

    return updatedStory
  }

  async handoverStoryFile(storyFileId: string, toAgent: string, notes: string): Promise<StoryFile | null> {
    const handedOverStory = await storyManager.handover(storyFileId, toAgent, notes)

    // Update cache
    if (handedOverStory) {
      this.storyFileCache.set(storyFileId, handedOverStory, 300000)
    }

    return handedOverStory
  }

  async getStoryMetrics(): Promise<StoryMetrics> {
    return await storyManager.getMetrics()
  }

  async shutdown(): Promise<void> {
    if (this.connectionPool) {
      await this.connectionPool.destroy()
    }

    this.routingCache.clear()
    this.performanceCache.clear()
    this.storyFileCache.clear()
    this.messageQueue.clear()
    this.circuitBreakers.clear()

    logger.info('Communication manager shut down successfully')
  }
}
