/**
 * Enhanced HTTP Client with Undici Optimizations
 * Provides high-performance HTTP client with connection pooling, caching, and monitoring
 */

import type { z } from 'zod'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { Agent, Pool, request, setGlobalDispatcher } from 'undici'
import { config } from '../server/config.js'
import { logger } from '../server/logger.js'
// Removed node22-features.js dependency

/**
 * HTTP request options with performance optimizations
 */
export interface EnhancedRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: string | Buffer | Uint8Array | undefined
  timeout?: number
  retries?: number
  cache?: boolean | undefined
  cacheTTL?: number
  keepAlive?: boolean
  compression?: boolean
}

/**
 * HTTP response with enhanced metadata
 */
export interface EnhancedResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  responseTime: number
  fromCache: boolean
  size: number
}

/**
 * Cache entry for HTTP responses
 */
interface CacheEntry<T> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  timestamp: number
  size: number
  ttl: number
}

/**
 * Connection pool statistics
 */
export interface PoolStats {
  connected: number
  free: number
  pending: number
  running: number
  size: number
}

/**
 * Enhanced HTTP client with advanced undici features
 */
export class EnhancedHttpClient {
  private agent: Agent
  private pools = new Map<string, Pool>()
  private cache = new Map<string, CacheEntry<unknown>>()
  private readonly maxCacheSize = 1000
  private readonly defaultTimeout = 30000
  private stats = {
    requests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    totalResponseTime: 0,
  }

  constructor() {
    // Create optimized Agent with connection pooling
    this.agent = new Agent({
      // Connection pool settings
      connections: config.maxConcurrentRequests * 2, // Allow more connections
      pipelining: 1, // Enable HTTP/1.1 pipelining
      keepAliveTimeout: 60000, // 60 seconds
      keepAliveMaxTimeout: 600000, // 10 minutes

      // Performance optimizations
      headersTimeout: 30000,
      bodyTimeout: 0, // Disable body timeout for large transfers

      // Connection limits per origin
      connect: {
        timeout: 10000,
        maxCachedSessions: 100,
      },
    })

    // Set as global dispatcher for all undici requests
    setGlobalDispatcher(this.agent)

    // Set up cache cleanup
    this.setupCacheCleanup()

    logger.info('Enhanced HTTP client initialized with undici optimizations', {
      maxConnections: config.maxConcurrentRequests * 2,
      keepAliveTimeout: '60s',
      cacheEnabled: true,
    })
  }

  /**
   * Make HTTP request with enhanced features
   */
  async request<T = unknown>(
    url: string,
    options: EnhancedRequestOptions = {},
    schema?: z.ZodSchema<T>,
  ): Promise<EnhancedResponse<T>> {
    const startTime = Date.now()
    const method = options.method ?? 'GET'
    const cacheKey = this.getCacheKey(url, method, options.body)

    // Check cache for GET requests
    if (method === 'GET' && options.cache !== false) {
      const cached = this.getFromCache<T>(cacheKey)
      if (cached) {
        this.stats.cacheHits++
        // Performance monitoring removed
        return {
          ...cached,
          responseTime: Date.now() - startTime,
          fromCache: true,
        }
      }
      this.stats.cacheMisses++
    }

    // Start performance measurement
    // Performance monitoring removed

    try {
      this.stats.requests++

      const pool = this.getOrCreatePool(new URL(url).origin)

      // Handle body properly for undici type compatibility
      const requestBody = options.body !== undefined ? options.body : null

      const response = await request(url, {
        method,
        headers: {
          'User-Agent': 'n8n-mcp-modern/5.2.8',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          ...options.headers,
        },
        body: requestBody,
        dispatcher: pool,
        headersTimeout: options.timeout ?? this.defaultTimeout,
        bodyTimeout: options.timeout ?? this.defaultTimeout,
      })

      const responseTime = Date.now() - startTime
      this.stats.totalResponseTime += responseTime

      // Read response body
      const responseBody = response.body ? await response.body.text() : ''
      const responseSize = Buffer.byteLength(responseBody, 'utf8')

      // Parse JSON response with security validation
      let data: T
      try {
        if (responseBody) {
          // Security validation: Check for potentially malicious JSON
          if (this.isValidJsonStructure(responseBody)) {
            data = this.parseJsonSecurely(responseBody) as T
          }
          else {
            logger.warn('Invalid JSON structure detected, treating as plain text', {
              url,
              responseSize: responseBody.length,
              preview: responseBody.slice(0, 100),
            })
            data = responseBody as T
          }
        }
        else {
          data = {} as T
        }
      }
      catch (parseError) {
        logger.debug('JSON parsing failed, treating as plain text', {
          url,
          error: parseError instanceof Error ? parseError.message : String(parseError),
          responsePreview: responseBody.slice(0, 100),
        })
        data = responseBody as T
      }

      // Validate with schema if provided
      if (schema) {
        try {
          data = schema.parse(data)
        }
        catch (error) {
          logger.warn('Response validation failed:', error)
          // Continue with unvalidated data in non-strict mode
        }
      }

      const result: EnhancedResponse<T> = {
        data,
        status: response.statusCode,
        statusText: response.statusCode.toString(),
        headers: this.normalizeHeaders(response.headers),
        responseTime,
        fromCache: false,
        size: responseSize,
      }

      // Cache successful GET requests
      if (method === 'GET' && response.statusCode < 400 && options.cache !== false) {
        this.setCache(cacheKey, result, options.cacheTTL ?? config.cacheTtl * 1000)
      }

      // Log slow requests
      if (responseTime > 1000) {
        logger.warn('Slow HTTP request detected', {
          url,
          method,
          responseTime: `${responseTime}ms`,
          status: response.statusCode,
          size: `${Math.round(responseSize / 1024)}KB`,
        })
      }

      // Performance monitoring removed
      return result
    }
    catch (error) {
      this.stats.errors++
      // Performance monitoring removed

      logger.error('HTTP request failed:', {
        url,
        method,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      })

      throw error
    }
  }

  /**
   * GET request shorthand
   */
  async get<T = unknown>(
    url: string,
    options: Omit<EnhancedRequestOptions, 'method' | 'body'> = {},
    schema?: z.ZodSchema<T>,
  ): Promise<EnhancedResponse<T>> {
    return this.request(url, { ...options, method: 'GET' }, schema)
  }

  /**
   * POST request shorthand
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    options: Omit<EnhancedRequestOptions, 'method'> = {},
    schema?: z.ZodSchema<T>,
  ): Promise<EnhancedResponse<T>> {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }, schema)
  }

  /**
   * PUT request shorthand
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    options: Omit<EnhancedRequestOptions, 'method'> = {},
    schema?: z.ZodSchema<T>,
  ): Promise<EnhancedResponse<T>> {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }, schema)
  }

  /**
   * DELETE request shorthand
   */
  async delete<T = unknown>(
    url: string,
    options: Omit<EnhancedRequestOptions, 'method' | 'body'> = {},
    schema?: z.ZodSchema<T>,
  ): Promise<EnhancedResponse<T>> {
    return this.request(url, { ...options, method: 'DELETE' }, schema)
  }

  /**
   * Get or create connection pool for origin
   */
  private getOrCreatePool(origin: string): Pool {
    const existingPool = this.pools.get(origin)
    if (existingPool) {
      return existingPool
    }

    // Create pool with basic options first
    const pool = new Pool(origin, {
      connections: Math.max(5, Math.floor(config.maxConcurrentRequests / 2)),
      pipelining: 1,
      keepAliveTimeout: 60000,
      keepAliveMaxTimeout: 600000,
    })

    this.pools.set(origin, pool)
    logger.debug(`Created connection pool for ${origin}`)

    return pool
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(url: string, method: string, body?: string | Buffer | Uint8Array): string {
    const bodyHash = body ? this.hashString(typeof body === 'string' ? body : body.toString()) : ''
    return `${method}:${url}:${bodyHash}`
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
  }

  /**
   * Get response from cache
   */
  private getFromCache<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined

    if (!entry)
      return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry
  }

  /**
   * Store response in cache
   */
  private setCache<T>(key: string, response: EnhancedResponse<T>, ttl: number): void {
    // Implement LRU eviction
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      timestamp: Date.now(),
      size: response.size,
      ttl,
    })
  }

  /**
   * Normalize response headers to plain object
   */
  private normalizeHeaders(headers: unknown): Record<string, string> {
    const result: Record<string, string> = {}

    if (headers && typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string') {
          result[key.toLowerCase()] = value
        }
        else if (Array.isArray(value)) {
          result[key.toLowerCase()] = value.join(', ')
        }
      }
    }

    return result
  }

  /**
   * Set up periodic cache cleanup
   */
  private setupCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      let cleanedCount = 0

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        logger.debug(`Cleaned up ${cleanedCount} expired cache entries`)
      }
    }, config.cacheCleanupIntervalMs)
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): Record<string, PoolStats> {
    const stats: Record<string, PoolStats> = {}

    for (const [origin, pool] of this.pools) {
      const poolStats = pool.stats
      stats[origin] = {
        connected: poolStats.connected,
        free: poolStats.free,
        pending: poolStats.pending,
        running: poolStats.running,
        size: poolStats.size,
      }
    }

    return stats
  }

  /**
   * Get client statistics
   */
  getStats(): {
    requests: number
    cacheHits: number
    cacheMisses: number
    errors: number
    averageResponseTime: number
    cacheSize: number
    poolCount: number
  } {
    return {
      requests: this.stats.requests,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      errors: this.stats.errors,
      averageResponseTime: this.stats.requests > 0
        ? Math.round(this.stats.totalResponseTime / this.stats.requests)
        : 0,
      cacheSize: this.cache.size,
      poolCount: this.pools.size,
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
    logger.debug('HTTP cache cleared')
  }

  /**
   * Validate JSON structure for security
   */
  private isValidJsonStructure(jsonString: string): boolean {
    // Basic security checks
    if (jsonString.length > 50 * 1024 * 1024) { // 50MB limit
      logger.warn('JSON response too large, rejecting', { size: jsonString.length })
      return false
    }

    // Check for obvious non-JSON content
    const trimmed = jsonString.trim()
    if (!trimmed)
      return false

    // Must start with valid JSON characters
    const firstChar = trimmed[0]
    const lastChar = trimmed[trimmed.length - 1]

    const validStarts = ['{', '[', '"', 'true', 'false', 'null']
    const startsValid = validStarts.some(start =>
      start === firstChar || trimmed.startsWith(start),
    )

    if (!startsValid)
      return false

    // Basic bracket/brace matching for objects and arrays
    if ((firstChar === '{' && lastChar !== '}')
      || (firstChar === '[' && lastChar !== ']')
      || (firstChar === '"' && lastChar !== '"')) {
      return false
    }

    // Check for suspicious patterns that might indicate injection attempts
    const suspiciousPatterns = [
      /__proto__/gi,
      /constructor/gi,
      /prototype/gi,
      /<script/gi,
      /javascript:/gi,
      /eval\s*\(/gi,
      /Function\s*\(/gi,
    ]

    return !suspiciousPatterns.some(pattern => pattern.test(jsonString))
  }

  /**
   * Parse JSON with additional security measures
   */
  private parseJsonSecurely(jsonString: string): unknown {
    try {
      // Pre-validate JSON string before parsing to prevent prototype pollution
      const prototypePollutionPatterns = [
        /"__proto__"\s*:/,
        /"constructor"\s*:/,
        /"prototype"\s*:/,
        /'__proto__'\s*:/,
        /'constructor'\s*:/,
        /'prototype'\s*:/,
      ]

      if (prototypePollutionPatterns.some(pattern => pattern.test(jsonString))) {
        logger.warn('Blocked JSON with potential prototype pollution')
        throw new Error('Unsafe JSON detected: contains prototype pollution attempts')
      }

      // Parse without reviver first to avoid processing dangerous values
      const parsed = JSON.parse(jsonString)

      // Deep sanitize the parsed object
      return this.sanitizeObject(parsed)
    }
    catch (error) {
      logger.error('Secure JSON parsing failed', {
        error: error instanceof Error ? error.message : String(error),
        jsonLength: jsonString.length,
        preview: jsonString.slice(0, 100),
      })
      throw error
    }
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item))
    }

    const sanitized: any = {}
    const dangerousKeys = ['__proto__', 'constructor', 'prototype']

    for (const [key, value] of Object.entries(obj)) {
      // Skip dangerous keys entirely
      if (dangerousKeys.includes(key.toLowerCase())) {
        logger.warn(`Blocked dangerous property during sanitization: ${key}`)
        continue
      }

      // Block function strings that might be evaluated
      if (typeof value === 'string') {
        const functionPatterns = [
          /^\s*function\s*\(/,
          /^\s*\(\s*\)\s*=>/,
          /^\s*[a-z_$][\w$]*\s*=>/i,
        ]
        if (functionPatterns.some(pattern => pattern.test(value))) {
          logger.warn(`Blocked potential function in JSON: ${value.slice(0, 50)}...`)
          sanitized[key] = '[BLOCKED_FUNCTION]'
          continue
        }
      }

      // Recursively sanitize nested objects
      sanitized[key] = this.sanitizeObject(value)
    }

    return sanitized
  }

  /**
   * Close all connections and cleanup resources
   */
  async close(): Promise<void> {
    await Promise.all([...this.pools.values()].map(pool =>
      pool.close ? pool.close() : pool.destroy ? pool.destroy() : Promise.resolve(),
    ))
    if (this.agent.close) {
      await this.agent.close()
    }
    else if (this.agent.destroy) {
      await this.agent.destroy()
    }
    this.cache.clear()
    logger.info('Enhanced HTTP client closed')
  }
}

// Export singleton instance
export const httpClient = new EnhancedHttpClient()

// Cleanup on process exit - use synchronous approach for exit handlers
let isClosing = false

process.on('beforeExit', () => {
  if (!isClosing) {
    isClosing = true
    // Use synchronous cleanup for process exit to prevent hanging
    try {
      // Simplified cleanup - just call close
      // httpClient.close() - can't call async here
    }
    catch (error) {
      logger.error('Error during HTTP client cleanup:', error)
    }
  }
})

process.on('SIGTERM', () => {
  if (!isClosing) {
    // Graceful shutdown with timeout for async cleanup
    httpClient.close().catch(err => logger.error('HTTP client close error:', err))
    setTimeout(() => process.exit(0), 5000) // 5 second timeout
  }
})

process.on('SIGINT', () => {
  if (!isClosing) {
    // Graceful shutdown with timeout for async cleanup
    httpClient.close().catch(err => logger.error('HTTP client close error:', err))
    setTimeout(() => process.exit(0), 5000) // 5 second timeout
  }
})
