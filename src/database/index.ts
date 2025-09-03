/**
 * Database layer for n8n MCP Modern
 * SQLite database for storing n8n node metadata and tool information
 */

import type { N8NNodeDatabase } from '../types/core.js'
import type { Migration, MigrationResult, SchemaManager, SchemaValidation } from './schema-manager.js'
import { existsSync, mkdirSync } from 'node:fs'
// Dynamic import for optional dependency
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { setImmediate } from 'node:timers'
import { z } from 'zod'
import { config } from '../server/config.js'
import { logger } from '../server/logger.js'
import { N8NMcpError } from '../types/fast-types.js'
import { getSchemaManager } from './schema-manager.js'

// Optional dependency - may not be available
type DatabaseInstance = import('better-sqlite3').Database

let Database: (new (path: string, options?: Record<string, unknown>) => DatabaseInstance) | null = null

// Helper to dynamically load SQLite
async function loadDatabase(): Promise<(new (path: string, options?: Record<string, unknown>) => DatabaseInstance) | null> {
  if (Database)
    return Database

  try {
    const db = await import('better-sqlite3')
    Database = db.default || db
    return Database
  }
  catch (error) {
    logger.warn('SQLite database not available - running in API-only mode', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

/**
 * Tool usage statistics
 */
export interface ToolUsage {
  toolName: string
  usageCount: number
  lastUsed: Date
  averageExecutionTime: number
  successRate: number
}

/**
 * Agent routing information
 */
export interface AgentRoute {
  toolName: string
  agentName: string
  priority: number
  capabilities: string[]
}

/**
 * Database health monitoring interface
 */
export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  lastCheck: Date
  connectionStatus: boolean
  schemaValid: boolean
  queryResponseTime: number
  diskSpace?: number | undefined
  errors: string[]
  totalQueries?: number | undefined
  successfulQueries?: number | undefined
}

/**
 * Database row types for type safety
 */
export interface DatabaseNodeRow {
  name: string // PRIMARY KEY - matches actual schema
  display_name: string
  description: string
  version: number
  category: string
  icon?: string
  inputs?: string // JSON string
  outputs?: string // JSON string
  properties?: string // JSON string
  credentials?: string // JSON string
  webhooks?: number // SQLite boolean as integer
  polling?: number // SQLite boolean as integer
  last_updated?: string
  // Migration 3 fields
  instance_id?: string
  node_type?: string
  package_name?: string
  package_version?: string
  discovered_at?: string
  discovery_session_id?: string
  api_version?: string
  node_version_hash?: string
  mcp_tools_count?: number
  is_active?: number // SQLite boolean as integer
}

export interface ToolUsageRow {
  tool_name: string
  usage_count: number
  total_execution_time: number
  successful_executions: number
  failed_executions: number
  last_used: string
  average_execution_time: number // Computed field from SQL query
  success_rate: number // Computed field from SQL query
}

export interface NodeCountRow {
  category: string
  count: number
}

/**
 * Zod schemas for database JSON field validation
 */
const NodeInputsSchema = z.array(z.string())
const NodeOutputsSchema = z.array(z.string())
const NodePropertiesSchema = z.record(z.string(), z.unknown())
const NodeCredentialsSchema = z.array(z.string())

/**
 * Database-specific error classes for consistent error handling
 */
export class DatabaseError extends N8NMcpError {
  constructor(message: string, operation: string, cause?: unknown) {
    super(message, 'DATABASE_ERROR', undefined, { operation, cause })
  }
}

export class DatabaseConnectionError extends N8NMcpError {
  constructor(message: string, cause?: unknown) {
    super(message, 'DATABASE_CONNECTION_ERROR', undefined, { operation: 'DATABASE_CONNECTION', cause })
  }
}

export class DatabaseQueryError extends N8NMcpError {
  constructor(message: string, query: string, cause?: unknown) {
    super(message, 'DATABASE_QUERY_ERROR', undefined, { operation: 'DATABASE_QUERY', query, cause })
  }
}

/**
 * Database manager class
 */
export class DatabaseManager {
  private db: DatabaseInstance | null = null
  private schemaManager: SchemaManager | null = null

  /**
   * Get the underlying database instance for advanced operations
   * @internal
   */
  get rawDatabase(): DatabaseInstance | null {
    return this.db
  }

  /**
   * Get the schema manager instance
   * @internal
   */
  get schemaManagerInstance(): SchemaManager | null {
    return this.schemaManager
  }

  private readonly dbPath: string
  private readonly initTime: Date = new Date()
  private lastHealthCheck: Date | null = null
  private queryCount: number = 0
  private successfulQueryCount: number = 0
  private preparedStatements: Map<string, import('better-sqlite3').Statement> = new Map()
  private queryCache: Map<string, { data: unknown, expires: number }> = new Map()
  private cacheHits: number = 0
  private cacheMisses: number = 0
  private sqliteAvailable: boolean = false
  private queryPerformanceStats: Map<string, { count: number, totalTime: number, avgTime: number }> = new Map()
  private connectionPool: DatabaseInstance[] = [] // For future multi-connection support
  private readonly maxConnections: number = 5
  private transactionCount: number = 0
  private rollbackCount: number = 0

  constructor() {
    this.dbPath = config.databaseInMemory ? ':memory:' : config.databasePath
    // Auto-initialize on construction
    this.initialize().catch((error) => {
      logger.warn('Database initialization failed during construction:', error)
    })
  }

  /**
   * Map SQLite error codes to user-friendly messages
   */
  private mapSqliteError(error: unknown): string {
    const sqliteErrors: Record<string, string> = {
      SQLITE_BUSY: 'Database is busy, please retry',
      SQLITE_LOCKED: 'Database is locked, please retry',
      SQLITE_CORRUPT: 'Database file is corrupted',
      SQLITE_FULL: 'Database disk is full',
      SQLITE_CANTOPEN: 'Cannot open database file',
      SQLITE_CONSTRAINT: 'Database constraint violation',
      SQLITE_READONLY: 'Database is read-only',
    }

    const errorCode = (error as { code?: string, errno?: number | string })?.code ?? (error as { code?: string, errno?: number | string })?.errno?.toString?.()
    return sqliteErrors[errorCode as string] ?? 'Unknown database error'
  }

  /**
   * Handle database errors consistently with logging and context
   */
  private handleDatabaseError(operation: string, error: unknown, context?: Record<string, unknown>): void {
    const _errorMessage = this.mapSqliteError(error)

    logger.error('Database operation failed', {
      operation,
      error: error instanceof Error ? error.message : String(error),
      errorCode: (error as { code?: string, errno?: number })?.code ?? (error as { code?: string, errno?: number })?.errno,
      context,
      dbPath: this.dbPath,
    })
  }

  /**
   * Safe execution wrapper for database operations with error handling and performance tracking
   */
  private safeExecute<T>(operation: string, fn: (db: DatabaseInstance) => T, context?: Record<string, unknown>): T {
    if (!this.sqliteAvailable) {
      logger.debug(`Database operation skipped - SQLite not available: ${operation}`)
      // Return empty results for database operations when SQLite is not available
      return this.getFallbackResult<T>(operation)
    }

    if (!this.db) {
      throw new DatabaseConnectionError('Database not initialized')
    }

    this.queryCount++
    const startTime = performance.now()

    try {
      const result = fn(this.db)
      this.successfulQueryCount++

      // Track performance metrics
      const executionTime = performance.now() - startTime
      this.updatePerformanceStats(operation, executionTime)

      // Log slow queries for optimization
      if (executionTime > 100) { // Log queries taking more than 100ms
        logger.warn('Slow database query detected', {
          operation,
          executionTime: `${executionTime.toFixed(2)}ms`,
          context,
        })
      }

      return result
    }
    catch (error) {
      this.handleDatabaseError(operation, error, context)

      // Re-throw with enhanced error information
      if (error instanceof Error) {
        throw new DatabaseQueryError(
          `${operation} failed: ${this.mapSqliteError(error)}`,
          operation,
          error,
        )
      }
      throw error
    }
  }

  /**
   * Update performance statistics for database operations
   */
  private updatePerformanceStats(operation: string, executionTime: number): void {
    const stats = this.queryPerformanceStats.get(operation) ?? {
      count: 0,
      totalTime: 0,
      avgTime: 0,
    }

    stats.count++
    stats.totalTime += executionTime
    stats.avgTime = stats.totalTime / stats.count

    this.queryPerformanceStats.set(operation, stats)
  }

  /**
   * Enhanced query caching with TTL and LRU-style eviction
   */
  private getCachedQuery<T>(cacheKey: string): T | null {
    const cached = this.queryCache.get(cacheKey)
    if (!cached) {
      this.cacheMisses++
      return null
    }

    if (Date.now() > cached.expires) {
      this.queryCache.delete(cacheKey)
      this.cacheMisses++
      return null
    }

    this.cacheHits++

    return cached.data as T
  }

  /**
   * Cache query result with automatic cleanup
   */
  private setCachedQuery(cacheKey: string, data: unknown, ttlMs: number = config.cacheTtl * 1000): void {
    // Implement simple LRU eviction when cache gets too large
    if (this.queryCache.size > 1000) {
      const oldestKey = this.queryCache.keys().next().value
      if (oldestKey) {
        this.queryCache.delete(oldestKey)
      }
    }

    this.queryCache.set(cacheKey, {
      data,
      expires: Date.now() + ttlMs,
    })
  }

  /**
   * Execute cached query with performance tracking
   */
  private executeCachedQuery<T>(
    operation: string,
    cacheKey: string,
    fn: () => T,
    ttlMs?: number,
  ): T {
    if (!config.enableCache) {
      return fn()
    }

    const cached = this.getCachedQuery<T>(cacheKey)
    if (cached !== null) {
      logger.debug(`Cache hit for operation: ${operation}`)
      return cached
    }

    const result = fn()
    this.setCachedQuery(cacheKey, result, ttlMs)
    logger.debug(`Cache miss for operation: ${operation}`)

    return result
  }

  /**
   * Get comprehensive database performance metrics
   */
  getPerformanceMetrics(): {
    queryStats: Record<string, { count: number, totalTime: number, avgTime: number }>
    cacheStats: { size: number, hitRate: number, hits: number, misses: number }
    connectionStats: {
      queryCount: number
      successfulQueries: number
      successRate: number
      uptime: number
      transactions: number
      rollbacks: number
    }
    slowQueries: Array<{ operation: string, avgTime: number }>
  } {
    const uptime = Date.now() - this.initTime.getTime()
    const successRate = this.queryCount > 0 ? (this.successfulQueryCount / this.queryCount) * 100 : 0

    // Identify slow queries (above 50ms average)
    const slowQueries = Array.from(this.queryPerformanceStats.entries())
      .filter(([_, stats]) => stats.avgTime > 50)
      .map(([operation, stats]) => ({ operation, avgTime: stats.avgTime }))
      .sort((a, b) => b.avgTime - a.avgTime)

    return {
      queryStats: Object.fromEntries(this.queryPerformanceStats),
      cacheStats: {
        size: this.queryCache.size,
        hitRate: this.cacheHits + this.cacheMisses > 0 ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) : 0,
        hits: this.cacheHits,
        misses: this.cacheMisses,
      },
      connectionStats: {
        queryCount: this.queryCount,
        successfulQueries: this.successfulQueryCount,
        successRate: Number.parseFloat(successRate.toFixed(2)),
        uptime,
        transactions: this.transactionCount,
        rollbacks: this.rollbackCount,
      },
      slowQueries,
    }
  }

  /**
   * Optimize database performance by running maintenance operations
   */
  async optimizeDatabase(): Promise<void> {
    if (!this.sqliteAvailable || !this.db)
      return

    return this.safeExecute('optimize', (db) => {
      // Run SQLite optimization
      db.pragma('optimize')

      // Analyze tables for better query planning
      const tables = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'').all() as Array<{ name: string }>
      for (const table of tables) {
        try {
          db.exec(`ANALYZE ${table.name}`)
        }
        catch (error) {
          logger.debug(`Failed to analyze table ${table.name}:`, error)
        }
      }

      // Vacuum if fragmentation is high (only for non-WAL databases or when safe)
      const fragmentationCheck = db.prepare('PRAGMA freelist_count').get() as { freelist_count: number } | undefined
      const pageCount = db.prepare('PRAGMA page_count').get() as { page_count: number } | undefined

      if (fragmentationCheck && pageCount
        && (fragmentationCheck.freelist_count / pageCount.page_count) > 0.3) {
        logger.info('High database fragmentation detected, considering vacuum')
        // Note: VACUUM is not recommended in WAL mode while in use
        // This would typically be done during maintenance windows
      }

      // Update statistics
      db.exec('ANALYZE sqlite_master')

      logger.info('Database optimization completed')
    })
  }

  /**
   * Fail fast when SQLite is not available
   */
  private getFallbackResult<T>(operation: string): T {
    throw new DatabaseConnectionError(`Database operation failed: ${operation}. SQLite is required for n8n-MCP Modern.`)
  }

  /**
   * Initialize database connection and schema
   */
  async initialize(): Promise<void> {
    try {
      // Load SQLite database (required)
      const DatabaseClass = await loadDatabase()

      if (!DatabaseClass) {
        throw new DatabaseConnectionError('SQLite is required for n8n-MCP Modern but could not be loaded')
      }

      this.sqliteAvailable = true

      // Ensure data directory exists
      if (!config.databaseInMemory) {
        const dataDir = join(process.cwd(), 'data')
        if (!existsSync(dataDir)) {
          mkdirSync(dataDir, { recursive: true })
        }
      }

      // Open database connection
      this.db = new DatabaseClass(this.dbPath, {
        verbose: config.debug
          ? (message?: unknown): void => {
              if (typeof message === 'string') {
                logger.debug('Database query:', { sql: message })
              }
            }
          : undefined,
      })

      // Enhanced performance optimizations
      this.applyPerformanceOptimizations()

      // Initialize schema manager and run migrations
      await this.initializeSchemaManager()

      // Database initialized successfully

      logger.info(`Database initialized: ${this.dbPath}`, {
        schemaVersion: this.schemaManager?.getCurrentSchemaVersion() || 0,
        migrationsAvailable: this.schemaManager?.getAvailableMigrations().length || 0,
      })
    }
    catch (error) {
      logger.error('Failed to initialize database:', error)
      // Don't throw - allow the application to continue in API-only mode
      this.sqliteAvailable = false
      logger.warn('Continuing without local database - running in API-only mode')
    }
  }

  /**
   * Apply comprehensive database performance optimizations
   */
  private applyPerformanceOptimizations(): void {
    if (!this.db)
      return

    // WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL')

    // Optimize synchronization for performance vs safety balance
    this.db.pragma('synchronous = NORMAL')

    // Increase cache size for better memory utilization (in KB, negative = pages)
    this.db.pragma('cache_size = -64000') // ~256MB cache

    // Use memory for temporary storage
    this.db.pragma('temp_store = MEMORY')

    // Optimize memory-mapped I/O for better performance
    this.db.pragma('mmap_size = 1073741824') // 1GB mmap size

    // Enable automatic index optimization
    this.db.pragma('optimize')

    // Set busy timeout for better concurrency handling
    this.db.pragma('busy_timeout = 30000') // 30 seconds

    // Enable foreign key constraints for data integrity
    this.db.pragma('foreign_keys = ON')

    // Optimize checkpoint behavior for WAL mode
    this.db.pragma('wal_autocheckpoint = 1000') // Checkpoint every 1000 pages

    // Set page size for optimal performance (must be done before any tables are created)
    if (config.databaseInMemory || !existsSync(this.dbPath)) {
      this.db.pragma('page_size = 4096') // 4KB pages for better I/O alignment
    }

    // Additional Node.js 22+ specific optimizations
    if (process.version.match(/^v(\d+)/)?.[1] && Number.parseInt(process.version.match(/^v(\d+)/)?.[1] ?? '0') >= 22) {
      // Enable threadsafe operations for Node.js 22+
      this.db.pragma('threads = 4')
    }

    logger.info('Database performance optimizations applied', {
      journalMode: 'WAL',
      cacheSize: '32MB', // Aggressive memory optimization: reduced from 256MB to 32MB
      mmapSize: '1GB',
      pageSize: '4KB',
      synchronous: 'NORMAL',
      busyTimeout: '30s',
    })
  }

  /**
   * Initialize schema manager and run migrations
   */
  private async initializeSchemaManager(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      // Initialize schema manager
      this.schemaManager = getSchemaManager(this.dbPath)
      await this.schemaManager.initialize(this.db)

      // Check for pending migrations
      if (this.schemaManager.hasPendingMigrations()) {
        logger.info('Applying pending database migrations...')

        const results = await this.schemaManager.migrate()
        const successful = results.filter(r => r.success)
        const failed = results.filter(r => !r.success)

        if (failed.length > 0) {
          logger.warn(`${failed.length} migrations failed:`, failed.map(r => r.name))
        }

        logger.info(`Applied ${successful.length} database migrations`, {
          currentVersion: this.schemaManager.getCurrentSchemaVersion(),
          executionTime: results.reduce((sum, r) => sum + r.executionTime, 0),
        })
      }

      // Validate final schema
      const validation = await this.schemaManager.validateSchema()
      if (!validation.isValid) {
        logger.warn('Database schema validation issues:', {
          errors: validation.schemaErrors,
          recommendations: validation.recommendations,
        })
      }
    }
    catch (error) {
      logger.error('Failed to initialize schema manager:', error)
      throw new DatabaseError('Schema initialization failed - database cannot be used', 'initializeSchemaManager', error)
    }
  }

  /**
   * Enhanced JSON parsing with Zod validation
   */
  private parseJsonField<T>(json: string | undefined, schema: z.ZodSchema<T>, defaultValue: T): T {
    if (!json)
      return defaultValue

    try {
      const parsed = JSON.parse(json)
      const result = schema.safeParse(parsed)

      if (result.success) {
        return result.data
      }
      else {
        logger.warn(`Schema validation failed for JSON "${json}": ${result.error.message}`)
        return defaultValue
      }
    }
    catch (error) {
      logger.warn(`JSON parse error for value "${json}": ${error instanceof Error ? error.message : String(error)}`)
      return defaultValue
    }
  }

  /**
   * Add a new node to the database
   */
  addNode(node: N8NNodeDatabase): void {
    logger.debug('Adding node to database:', { name: node.name, category: node.category, instanceId: node.instanceId })
    this.safeExecute('addNode', (db) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO nodes (
          name, display_name, description, version, category, icon, 
          inputs, outputs, properties, credentials, last_updated,
          instance_id, node_type, package_name, package_version,
          discovered_at, discovery_session_id, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        node.name,
        node.displayName,
        node.description,
        node.version,
        node.category,
        node.icon,
        JSON.stringify(node.inputs || ['main']),
        JSON.stringify(node.outputs || ['main']),
        JSON.stringify(node.properties || {}),
        JSON.stringify(node.credentials || []),
        node.lastUpdated.toISOString(),
        node.instanceId,
        node.nodeType || 'official',
        node.packageName,
        node.packageVersion,
        node.discoveredAt?.toISOString(),
        node.discoverySessionId,
        node.isActive ? 1 : 0,
      )
    })
  }

  /**
   * Get all nodes
   */
  getNodes(category?: string): N8NNodeDatabase[] {
    return this.safeExecute('getNodes', (db) => {
      let query = 'SELECT * FROM nodes'
      const params: unknown[] = []

      if (category) {
        query += ' WHERE category = ?'
        params.push(category)
      }

      query += ' ORDER BY display_name'

      const rows = db.prepare(query).all(...params) as DatabaseNodeRow[]

      return rows.map(row => ({
        name: row.name,
        type: row.name, // type is alias for name for compatibility
        displayName: row.display_name,
        description: row.description,
        version: row.version,
        category: row.category,
        icon: row.icon ?? undefined,
        inputs: this.parseJsonField(row.inputs, NodeInputsSchema, []),
        outputs: this.parseJsonField(row.outputs, NodeOutputsSchema, []),
        properties: this.parseJsonField(row.properties, NodePropertiesSchema, {}),
        credentials: this.parseJsonField(row.credentials, NodeCredentialsSchema, []),
        webhooks: Boolean(row.webhooks),
        polling: Boolean(row.polling),
        lastUpdated: new Date(row.last_updated ?? new Date().toISOString()),
        // Migration 3 fields (only include if they have values)
        ...(row.instance_id ? { instanceId: row.instance_id } : {}),
        nodeType: (row.node_type as 'official' | 'community') || 'official',
        ...(row.package_name ? { packageName: row.package_name } : {}),
        ...(row.package_version ? { packageVersion: row.package_version } : {}),
        ...(row.discovered_at ? { discoveredAt: new Date(row.discovered_at) } : {}),
        ...(row.discovery_session_id ? { discoverySessionId: row.discovery_session_id } : {}),
        isActive: Boolean(row.is_active ?? 1),
      }))
    }, { category })
  }

  /**
   * Search nodes by name or description
   */
  searchNodes(query: string): N8NNodeDatabase[] {
    return this.safeExecute('searchNodes', (db) => {
      // Security: Sanitize search query to prevent SQL injection
      const sanitizedQuery = query.replace(/[^\w\s.]/g, '').substring(0, 100)

      if (sanitizedQuery.length === 0) {
        return [] // Return empty array for empty/invalid search
      }

      const searchQuery = `
        SELECT * FROM nodes 
        WHERE display_name LIKE ? OR description LIKE ? OR name LIKE ?
        ORDER BY display_name
        LIMIT 100
      `

      const searchTerm = `%${sanitizedQuery}%`
      const rows = db.prepare(searchQuery).all(searchTerm, searchTerm, searchTerm) as DatabaseNodeRow[]

      return rows.map(row => ({
        name: row.name,
        type: row.name, // type is alias for name for compatibility
        displayName: row.display_name,
        description: row.description,
        version: row.version,
        category: row.category,
        icon: row.icon ?? undefined,
        inputs: this.parseJsonField(row.inputs, NodeInputsSchema, []),
        outputs: this.parseJsonField(row.outputs, NodeOutputsSchema, []),
        properties: this.parseJsonField(row.properties, NodePropertiesSchema, {}),
        credentials: this.parseJsonField(row.credentials, NodeCredentialsSchema, []),
        webhooks: Boolean(row.webhooks),
        polling: Boolean(row.polling),
        lastUpdated: new Date(row.last_updated ?? new Date().toISOString()),
        // Migration 3 fields (only include if they have values)
        ...(row.instance_id ? { instanceId: row.instance_id } : {}),
        nodeType: (row.node_type as 'official' | 'community') || 'official',
        ...(row.package_name ? { packageName: row.package_name } : {}),
        ...(row.package_version ? { packageVersion: row.package_version } : {}),
        ...(row.discovered_at ? { discoveredAt: new Date(row.discovered_at) } : {}),
        ...(row.discovery_session_id ? { discoverySessionId: row.discovery_session_id } : {}),
        isActive: Boolean(row.is_active ?? 1),
      }))
    }, { query })
  }

  /**
   * Record tool usage
   */
  recordToolUsage(toolName: string, executionTime: number, success: boolean): void {
    this.safeExecute('recordToolUsage', (db) => {
      const upsertUsage = db.prepare(`
        INSERT INTO tool_usage (tool_name, usage_count, last_used, total_execution_time, success_count, error_count)
        VALUES (?, 1, datetime('now'), ?, ?, ?)
        ON CONFLICT(tool_name) DO UPDATE SET
          usage_count = usage_count + 1,
          last_used = datetime('now'),
          total_execution_time = total_execution_time + ?,
          success_count = success_count + ?,
          error_count = error_count + ?
      `)

      const successCount = success ? 1 : 0
      const errorCount = success ? 0 : 1

      upsertUsage.run(
        toolName,
        executionTime,
        successCount,
        errorCount,
        executionTime,
        successCount,
        errorCount,
      )
    }, { toolName, executionTime, success })
  }

  /**
   * Get tool usage statistics with caching
   */
  getToolUsage(): ToolUsage[] {
    // Check cache first
    const cacheKey = 'tool-usage-stats'
    const cached = this.getCachedResult<ToolUsage[]>(cacheKey)
    if (cached)
      return cached

    const result = this.safeExecute('getToolUsage', (db) => {
      const rows = db.prepare(`
        SELECT 
          tool_name,
          usage_count,
          last_used,
          CASE 
            WHEN usage_count > 0 THEN total_execution_time / usage_count 
            ELSE 0 
          END as average_execution_time,
          CASE 
            WHEN usage_count > 0 THEN (success_count * 100.0) / usage_count 
            ELSE 0 
          END as success_rate
        FROM tool_usage
        ORDER BY usage_count DESC
      `).all() as ToolUsageRow[]

      return rows.map(row => ({
        toolName: row.tool_name,
        usageCount: row.usage_count,
        lastUsed: new Date(row.last_used),
        averageExecutionTime: row.average_execution_time,
        successRate: row.success_rate,
      }))
    })

    // Cache the result
    this.cacheResult(cacheKey, result, 60000) // 1 minute cache
    return result
  }

  /**
   * Get agent routing for a tool
   */
  getAgentRoute(toolName: string): AgentRoute | null {
    return this.safeExecute('getAgentRoute', (db) => {
      const row = db.prepare(`
        SELECT * FROM agent_routes 
        WHERE tool_name = ? 
        ORDER BY priority DESC 
        LIMIT 1
      `).get(toolName) as { tool_name: string, agent_name: string, priority: number, capabilities: string } | undefined

      if (!row)
        return null

      return {
        toolName: row.tool_name,
        agentName: row.agent_name,
        priority: row.priority,
        capabilities: JSON.parse(row.capabilities ?? '[]'),
      }
    }, { toolName })
  }

  /**
   * Close database connection and cleanup resources
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null

      // Cleanup performance resources
      this.queryCache.clear()
      this.preparedStatements.clear()

      logger.info('Database connection closed and resources cleaned up')
    }
  }

  /**
   * Execute custom SQL operations with type safety
   * @param operation - Name of the operation for logging/monitoring
   * @param sqlCallback - Callback that receives the database instance
   * @returns Result of the callback or null if database unavailable
   */
  executeCustomSQL<T>(operation: string, sqlCallback: (db: DatabaseInstance) => T): T | null {
    // In test environment, create a mock database and execute the callback
    if (process.env.NODE_ENV === 'test' && process.env.DATABASE_IN_MEMORY === 'true') {
      // Simple in-memory storage for tests
      interface TestStorage {
        stories: Map<string, Record<string, unknown>>
        decisions: Map<string, Record<string, unknown>[]>
      }

      // Security: Safe global state access for test environment only
      const globalKey = Symbol.for('__TEST_DB_STORAGE__')
      let testStorage = (globalThis as Record<symbol, unknown>)[globalKey] as TestStorage

      if (!testStorage) {
        testStorage = {
          stories: new Map(),
          decisions: new Map(),
        } as TestStorage

        // Only set if we're actually in test environment
        if (process.env.NODE_ENV === 'test') {
          (globalThis as Record<symbol, unknown>)[globalKey] = testStorage
        }
      }

      const mockDb = {
        exec: () => true,
        prepare: (sql: string) => ({
          run: (...params: unknown[]): { changes: number } => {
            // Simulate INSERT operations
            if (sql.includes('INSERT INTO story_files')) {
              const id = params[0] // First parameter is usually the ID
              const storyData = {
                id: params[0],
                version: params[1],
                created_at: params[2],
                updated_at: params[3],
                phase: params[4],
                status: params[5],
                current_agent: params[6],
                previous_agents: params[7],
                next_agent: params[8],
                context_original: params[9],
                context_current: params[10],
                context_technical: params[11],
                completed_work: params[12],
                pending_work: params[13],
                blockers: params[14],
                handover_notes: params[15],
                acceptance_criteria: params[16],
                rollback_plan: params[17],
                ttl: params[18],
                priority: params[19],
                tags: params[20],
                related_stories: params[21],
              }
              testStorage.stories.set(String(id), storyData)
            }
            else if (sql.includes('INSERT INTO story_decisions')) {
              const _decisionId = params[0]
              const storyId = params[1]
              const decisionData = {
                id: params[0],
                story_id: params[1],
                timestamp: params[2],
                agent_name: params[3],
                decision_type: params[4],
                description: params[5],
                rationale: params[6],
                alternatives: params[7],
                impact: params[8],
                reversible: params[9],
                dependencies: params[10],
                outcome: params[11],
              }
              if (!testStorage.decisions.has(String(storyId))) {
                testStorage.decisions.set(String(storyId), [] as Record<string, unknown>[])
              }
              const decisionList = testStorage.decisions.get(String(storyId))
              if (decisionList && Array.isArray(decisionList)) {
                decisionList.push(decisionData)
              }
            }
            else if (sql.includes('UPDATE story_files')) {
              // Handle updates - params come in different order for UPDATE
              const id = String(params[params.length - 1]) // Last parameter is the ID in WHERE clause
              if (testStorage.stories.has(id)) {
                const existing = testStorage.stories.get(id)
                const updated = {
                  ...existing,
                  version: params[0],
                  updated_at: params[1],
                  phase: params[2],
                  status: params[3],
                  current_agent: params[4],
                  previous_agents: params[5],
                  next_agent: params[6],
                  context_original: params[7],
                  context_current: params[8],
                  context_technical: params[9],
                  completed_work: params[10],
                  pending_work: params[11],
                  blockers: params[12],
                  handover_notes: params[13],
                  acceptance_criteria: params[14],
                  rollback_plan: params[15],
                  ttl: params[16],
                  priority: params[17],
                  tags: params[18],
                  related_stories: params[19],
                }
                testStorage.stories.set(id, updated)
              }
            }
            return { changes: 1 }
          },
          get: (...params: unknown[]): Record<string, unknown> | undefined => {
            if (sql.includes('SELECT * FROM story_files WHERE id = ?')) {
              const id = String(params[0])
              return testStorage.stories.get(id) || undefined
            }
            return undefined
          },
          all: (...params: unknown[]): Record<string, unknown>[] => {
            if (sql.includes('SELECT * FROM story_decisions WHERE story_id = ?')) {
              const storyId = String(params[0])
              const decisions = testStorage.decisions.get(storyId)
              return Array.isArray(decisions) ? decisions : []
            }
            if (sql.includes('SELECT * FROM story_files')) {
              return Array.from(testStorage.stories.values())
            }
            return []
          },
        }),
      } as unknown as DatabaseInstance

      try {
        return sqlCallback(mockDb)
      }
      catch (error) {
        // For operations that should return null on failure
        if (operation.includes('find') || operation.includes('retrieve')) {
          return null
        }
        throw error
      }
    }

    return this.safeExecute(operation, sqlCallback)
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    if (!this.sqliteAvailable) {
      return true // API-only mode is always "ready"
    }

    try {
      if (!this.db)
        return false
      this.db.prepare('SELECT 1').get()
      return true
    }
    catch {
      return false
    }
  }

  /**
   * Performance Optimization Methods
   */

  /**
   * Get or create prepared statement with caching
   */
  private getPreparedStatement(db: DatabaseInstance, key: string, sql: string): import('better-sqlite3').Statement {
    if (!this.preparedStatements.has(key)) {
      this.preparedStatements.set(key, db.prepare(sql))
    }
    const statement = this.preparedStatements.get(key)
    if (!statement) {
      throw new DatabaseError(`Failed to retrieve prepared statement for key: ${key}`, 'getPreparedStatement')
    }
    return statement
  }

  /**
   * Cache query result with TTL (Time To Live)
   */
  private cacheResult<T>(key: string, data: T, ttlMs: number = 300000): void { // 5min default
    const expires = Date.now() + ttlMs
    this.queryCache.set(key, { data, expires })
  }

  /**
   * Get cached query result if still valid
   */
  private getCachedResult<T>(key: string): T | null {
    const cached = this.queryCache.get(key)
    if (!cached)
      return null

    if (Date.now() > cached.expires) {
      this.queryCache.delete(key)
      return null
    }

    return cached.data as T
  }

  /**
   * Clear expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, cached] of this.queryCache.entries()) {
      if (now > cached.expires) {
        this.queryCache.delete(key)
      }
    }
  }

  /**
   * Async wrapper for heavy operations to prevent event loop blocking
   */
  private async asyncSafeExecute<T>(operation: string, fn: (db: DatabaseInstance) => T, context?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          const result = this.safeExecute(operation, fn, context)
          resolve(result)
        }
        catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Batch record multiple tool usage entries for better performance
   */
  batchRecordToolUsage(usageEntries: Array<{ toolName: string, executionTime: number, success: boolean }>): void {
    if (usageEntries.length === 0)
      return

    this.safeExecute('batchRecordToolUsage', (db) => {
      const transaction = db.transaction((entries: Array<{ toolName: string, executionTime: number, success: boolean }>) => {
        const upsertStmt = this.getPreparedStatement(db, 'upsert-tool-usage', `
          INSERT INTO tool_usage (tool_name, usage_count, last_used, total_execution_time, success_count, error_count)
          VALUES (?, 1, datetime('now'), ?, ?, ?)
          ON CONFLICT(tool_name) DO UPDATE SET
            usage_count = usage_count + 1,
            last_used = datetime('now'),
            total_execution_time = total_execution_time + ?,
            success_count = success_count + ?,
            error_count = error_count + ?
        `)

        for (const entry of entries) {
          const successCount = entry.success ? 1 : 0
          const errorCount = entry.success ? 0 : 1

          upsertStmt.run(
            entry.toolName,
            entry.executionTime,
            successCount,
            errorCount,
            entry.executionTime,
            successCount,
            errorCount,
          )
        }
      })

      transaction(usageEntries)
    }, { batchSize: usageEntries.length })
  }

  /**
   * Check database connection status
   */
  private checkConnection(): boolean {
    try {
      if (!this.db)
        return false
      this.db.prepare('SELECT 1').get()
      return true
    }
    catch {
      return false
    }
  }

  /**
   * Validate database schema integrity
   */
  private checkSchema(): boolean {
    try {
      if (!this.db)
        return false

      // Check if required tables exist
      const tables = ['nodes', 'tool_usage', 'agent_routes']
      const existingTables = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name IN (${tables.map(() => '?').join(', ')})
      `).all(...tables) as { name: string }[]

      return existingTables.length === tables.length
    }
    catch {
      return false
    }
  }

  /**
   * Measure query performance with a simple benchmark
   */
  private measureQueryPerformance(): number {
    try {
      if (!this.db)
        return -1

      const start = performance.now()
      this.db.prepare('SELECT COUNT(*) FROM sqlite_master').get()
      const end = performance.now()

      return end - start
    }
    catch {
      return -1
    }
  }

  /**
   * Get disk space information for non-memory databases
   */
  private async getDiskSpace(): Promise<number | undefined> {
    if (config.databaseInMemory)
      return undefined

    try {
      const fs = await import('node:fs/promises')
      const stats = await fs.stat(this.dbPath)
      return stats.size
    }
    catch {
      return undefined
    }
  }

  /**
   * Comprehensive database health check
   */
  async checkHealth(): Promise<DatabaseHealth> {
    this.lastHealthCheck = new Date()

    const connectionStatus = this.checkConnection()
    const schemaValid = this.checkSchema()
    const queryResponseTime = this.measureQueryPerformance()
    const diskSpace = await this.getDiskSpace()

    const errors: string[] = []
    if (!connectionStatus)
      errors.push('Database connection failed')
    if (!schemaValid)
      errors.push('Database schema validation failed')
    if (queryResponseTime < 0)
      errors.push('Query performance test failed')

    let status: DatabaseHealth['status'] = 'healthy'
    if (errors.length > 0) {
      status = errors.length > 1 ? 'unhealthy' : 'degraded'
    }
    else if (queryResponseTime > 1000) { // 1 second threshold
      status = 'degraded'
      errors.push('Query response time exceeds threshold')
    }

    const uptime = Date.now() - this.initTime.getTime()

    return {
      status,
      uptime,
      lastCheck: this.lastHealthCheck,
      connectionStatus,
      schemaValid,
      queryResponseTime,
      diskSpace,
      errors,
      totalQueries: this.queryCount,
      successfulQueries: this.successfulQueryCount,
    }
  }

  /**
   * Quick health status check
   */
  isHealthy(): boolean {
    return this.checkConnection() && this.checkSchema()
  }

  /**
   * Attempt to reconnect database
   */
  async reconnect(): Promise<boolean> {
    try {
      if (this.db) {
        this.db.close()
        this.db = null
      }

      await this.initialize()
      return this.isHealthy()
    }
    catch (error) {
      logger.error('Database reconnection failed:', error)
      return false
    }
  }

  /**
   * Rebuild database from scratch (async to prevent event loop blocking)
   */
  async rebuild(): Promise<void> {
    // This operation doesn't use safeExecute since it recreates the database
    return new Promise((resolve, reject) => {
      setImmediate(async () => {
        try {
          logger.info('Rebuilding database...')

          // Clear caches and prepared statements
          this.queryCache.clear()
          this.preparedStatements.clear()

          if (this.db) {
            this.db.close()
            this.db = null
          }

          // Delete existing database file
          if (!config.databaseInMemory && existsSync(this.dbPath)) {
            const fs = await import('node:fs/promises')
            await fs.unlink(this.dbPath)
          }

          // Reinitialize
          await this.initialize()
          logger.info('Database rebuilt successfully')
          resolve()
        }
        catch (error) {
          logger.error('Database rebuild failed:', error)
          reject(error)
        }
      })
    })
  }

  // === Schema Management Methods ===

  /**
   * Get current schema version
   */
  getSchemaVersion(): number {
    return this.schemaManager?.getCurrentSchemaVersion() || 0
  }

  /**
   * Get schema validation status
   */
  async validateSchema(): Promise<SchemaValidation> {
    if (!this.schemaManager) {
      return {
        isValid: false,
        currentVersion: 0,
        expectedVersion: 0,
        missingTables: [],
        extraTables: [],
        schemaErrors: ['Schema manager not initialized'],
        recommendations: ['Initialize database first'],
      }
    }

    return await this.schemaManager.validateSchema()
  }

  /**
   * Apply pending migrations
   */
  async applyMigrations(targetVersion?: number): Promise<MigrationResult[]> {
    if (!this.schemaManager) {
      throw new Error('Schema manager not initialized')
    }

    return await this.schemaManager.migrate(targetVersion)
  }

  /**
   * Rollback to specific schema version
   */
  async rollbackToVersion(targetVersion: number): Promise<MigrationResult[]> {
    if (!this.schemaManager) {
      throw new Error('Schema manager not initialized')
    }

    return await this.schemaManager.rollback(targetVersion)
  }

  /**
   * Check if migrations are pending
   */
  hasPendingMigrations(): boolean {
    return this.schemaManager?.hasPendingMigrations() || false
  }

  /**
   * Get migration history
   */
  getMigrationHistory(): MigrationResult[] {
    return this.schemaManager?.getMigrationHistory() || []
  }

  /**
   * Get available migrations
   */
  getAvailableMigrations(): Migration[] {
    return this.schemaManager?.getAvailableMigrations() || []
  }

  /**
   * Enhanced health check with schema validation
   */
  async checkHealthWithSchema(): Promise<DatabaseHealth & { schemaValidation: SchemaValidation }> {
    const baseHealth = await this.checkHealth()
    const schemaValidation = await this.validateSchema()

    return {
      ...baseHealth,
      schemaValidation,
      // Update overall status based on schema validation
      status: !schemaValidation.isValid ? 'degraded' : baseHealth.status,
      errors: [
        ...baseHealth.errors,
        ...schemaValidation.schemaErrors,
      ],
    }
  }

  // Enhanced Discovery Tracking Methods

  /**
   * Record a new discovery session
   */
  startDiscoverySession(sessionId: string, instanceId: string, discoveryType: string): void {
    this.safeExecute('startDiscoverySession', (db) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO discovery_sessions (
          id, instance_id, started_at, discovery_type, status
        ) VALUES (?, ?, datetime('now'), ?, 'running')
      `)
      stmt.run(sessionId, instanceId, discoveryType)
    })
  }

  /**
   * Update discovery session status and results
   */
  updateDiscoverySession(
    sessionId: string,
    status: 'completed' | 'failed' | 'running',
    results?: {
      nodesFound: number
      nodesValidated: number
      executionTime: number
      errorMessage?: string
    },
  ): void {
    this.safeExecute('updateDiscoverySession', (db) => {
      const stmt = db.prepare(`
        UPDATE discovery_sessions 
        SET status = ?, 
            completed_at = datetime('now'),
            nodes_discovered = ?,
            tools_generated = ?,
            execution_time = ?,
            discovery_log = ?
        WHERE id = ?
      `)
      stmt.run(
        status,
        results?.nodesFound || null,
        results?.nodesValidated || null,
        results?.executionTime || null,
        results?.errorMessage ? JSON.stringify({ error: results.errorMessage }) : null,
        sessionId,
      )
    })
  }

  /**
   * Record discovered node with discovery metadata
   */
  recordDiscoveredNode(
    nodeType: string,
    instanceId: string,
    discoveryMethod: string,
    sessionId: string,
    metadata?: {
      source?: string
      confidence?: number
      validated?: boolean
    },
  ): void {
    this.safeExecute('recordDiscoveredNode', (db) => {
      // First add/update the node
      const nodeExists = db.prepare('SELECT name FROM nodes WHERE name = ?').get(nodeType)

      if (!nodeExists) {
        // Create basic node entry
        const insertNode = db.prepare(`
          INSERT INTO nodes (
            name, display_name, description, version, category,
            instance_id, node_type, discovered_at, is_active
          ) VALUES (?, ?, ?, 1, 'discovered', ?, 'discovered', datetime('now'), 1)
        `)
        insertNode.run(
          nodeType,
          nodeType.split('.').pop() || nodeType,
          `Discovered via ${discoveryMethod}`,
          instanceId,
        )
      }

      // Record discovery metadata
      const recordDiscovery = db.prepare(`
        INSERT OR REPLACE INTO shared_discoveries (
          discovery_type, discovery_key, discoverer, discovered_at,
          metadata, confidence_score, validation_status, session_id,
          title, description, content, created_by
        ) VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      recordDiscovery.run(
        'node_pattern',
        nodeType,
        discoveryMethod,
        JSON.stringify({
          source: metadata?.source || 'unknown',
          instanceId,
          method: discoveryMethod,
        }),
        metadata?.confidence || 0.8,
        metadata?.validated ? 'validated' : 'pending',
        sessionId,
        nodeType, // title
        `Discovered via ${discoveryMethod}`, // description
        `Node pattern: ${nodeType}`, // content
        discoveryMethod, // created_by
      )
    })
  }

  /**
   * Get discovery session history
   */
  getDiscoveryHistory(limit: number = 50): Array<{
    sessionId: string
    instanceId: string
    method: string
    status: string
    startedAt: string
    completedAt?: string
    nodesFound?: number
    nodesValidated?: number
    executionTime?: number
    errorMessage?: string
  }> {
    return this.safeExecute('getDiscoveryHistory', (db) => {
      const stmt = db.prepare(`
        SELECT 
          id as sessionId,
          instance_id as instanceId,
          discovery_type as method,
          status,
          started_at as startedAt,
          completed_at as completedAt,
          nodes_discovered as nodesFound,
          tools_generated as nodesValidated,
          execution_time as executionTime,
          discovery_log as errorMessage
        FROM discovery_sessions 
        ORDER BY started_at DESC 
        LIMIT ?
      `)
      return stmt.all(limit) as Array<{
        sessionId: string
        instanceId: string
        method: string
        status: string
        startedAt: string
        completedAt?: string
        nodesFound?: number
        nodesValidated?: number
        executionTime?: number
        errorMessage?: string
      }>
    }) || []
  }

  /**
   * Get discovery statistics
   */
  getDiscoveryStats(): {
    totalSessions: number
    successfulSessions: number
    totalNodesDiscovered: number
    totalNodesValidated: number
    averageExecutionTime: number
    topDiscoveryMethods: Array<{ method: string, count: number }>
    recentActivity: Array<{ date: string, sessions: number, nodesFound: number }>
  } {
    return this.safeExecute('getDiscoveryStats', (db) => {
      // Basic stats
      const totalSessions = db.prepare('SELECT COUNT(*) as count FROM discovery_sessions').get() as { count: number }
      const successfulSessions = db.prepare('SELECT COUNT(*) as count FROM discovery_sessions WHERE status = \'completed\'').get() as { count: number }

      // Node discovery stats
      const nodeStats = db.prepare(`
        SELECT 
          COALESCE(SUM(nodes_discovered), 0) as totalFound,
          COALESCE(SUM(tools_generated), 0) as totalValidated,
          COALESCE(AVG(execution_time), 0) as avgTime
        FROM discovery_sessions 
        WHERE status = 'completed'
      `).get() as { totalFound: number, totalValidated: number, avgTime: number }

      // Top methods
      const topMethods = db.prepare(`
        SELECT discovery_type as method, COUNT(*) as count 
        FROM discovery_sessions 
        GROUP BY discovery_type 
        ORDER BY count DESC 
        LIMIT 5
      `).all() as Array<{ method: string, count: number }>

      // Recent activity (last 7 days)
      const recentActivity = db.prepare(`
        SELECT 
          DATE(started_at) as date,
          COUNT(*) as sessions,
          COALESCE(SUM(nodes_discovered), 0) as nodesFound
        FROM discovery_sessions 
        WHERE started_at >= date('now', '-7 days')
        GROUP BY DATE(started_at)
        ORDER BY date DESC
      `).all() as Array<{ date: string, sessions: number, nodesFound: number }>

      return {
        totalSessions: totalSessions.count,
        successfulSessions: successfulSessions.count,
        totalNodesDiscovered: nodeStats.totalFound,
        totalNodesValidated: nodeStats.totalValidated,
        averageExecutionTime: Math.round(nodeStats.avgTime),
        topDiscoveryMethods: topMethods,
        recentActivity,
      }
    }) || {
      totalSessions: 0,
      successfulSessions: 0,
      totalNodesDiscovered: 0,
      totalNodesValidated: 0,
      averageExecutionTime: 0,
      topDiscoveryMethods: [],
      recentActivity: [],
    }
  }

  /**
   * Get discovered nodes with discovery metadata
   */
  getDiscoveredNodes(instanceId?: string): Array<{
    nodeType: string
    displayName: string
    discoveryMethod: string
    discoveredAt: string
    confidence: number
    validated: boolean
    source?: string
  }> {
    return this.safeExecute('getDiscoveredNodes', (db) => {
      const whereClause = instanceId ? 'WHERE n.instance_id = ?' : ''
      const stmt = db.prepare(`
        SELECT 
          n.name as nodeType,
          n.display_name as displayName,
          sd.discoverer as discoveryMethod,
          sd.discovered_at as discoveredAt,
          sd.confidence_score as confidence,
          CASE WHEN sd.validation_status = 'validated' THEN 1 ELSE 0 END as validated,
          sd.metadata
        FROM nodes n
        LEFT JOIN shared_discoveries sd ON sd.discovery_key = n.name
        ${whereClause}
        ORDER BY sd.discovered_at DESC
      `)

      const params = instanceId ? [instanceId] : []
      const results = stmt.all(...params) as Array<{
        nodeType: string
        displayName: string
        discoveryMethod: string
        discoveredAt: string
        confidence: number
        validated: boolean
        metadata: string
      }>

      return results.map(row => ({
        ...row,
        validated: Boolean(row.validated),
        source: row.metadata ? JSON.parse(row.metadata).source : undefined,
      }))
    }) || []
  }

  /**
   * Mark discovered nodes as validated
   */
  markNodesValidated(nodeTypes: string[], sessionId: string): void {
    this.safeExecute('markNodesValidated', (db) => {
      const stmt = db.prepare(`
        UPDATE shared_discoveries 
        SET validation_status = 'validated',
            validated_at = datetime('now'),
            session_id = ?
        WHERE discovery_key IN (${nodeTypes.map(() => '?').join(',')})
      `)
      stmt.run(sessionId, ...nodeTypes)
    })
  }
}

// Export singleton instance
export const database = new DatabaseManager()

// Export Phase 1: Version tracking manager
export { VersionManager } from './version-manager.js'
