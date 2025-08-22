/**
 * Database layer for n8n MCP Modern
 * SQLite database for storing n8n node metadata and tool information
 */

// Dynamic import for optional dependency
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { z } from 'zod';
import { setImmediate } from 'timers';
import { performance } from 'perf_hooks';
import { logger } from '../server/logger.js';
import { config } from '../server/config.js';
import { N8NMcpError } from '../types/index.js';
import type { N8NNodeDatabase } from '../types/core.js';

// Optional dependency - may not be available
let Database: any = null;

// Helper to dynamically load SQLite
async function loadDatabase(): Promise<any> {
  if (Database) return Database;
  
  try {
    const db = await import('better-sqlite3');
    Database = db.default;
    return Database;
  } catch (error) {
    logger.warn('SQLite database not available - running in API-only mode', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * n8n Node metadata
 * @deprecated Use N8NNodeDatabase from types/core.ts instead
 */
export type N8NNode = N8NNodeDatabase;

/**
 * Tool usage statistics
 */
export interface ToolUsage {
  toolName: string;
  usageCount: number;
  lastUsed: Date;
  averageExecutionTime: number;
  successRate: number;
}

/**
 * Agent routing information
 */
export interface AgentRoute {
  toolName: string;
  agentName: string;
  priority: number;
  capabilities: string[];
}

/**
 * Database health monitoring interface
 */
export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCheck: Date;
  connectionStatus: boolean;
  schemaValid: boolean;
  queryResponseTime: number;
  diskSpace?: number | undefined;
  errors: string[];
  totalQueries?: number | undefined;
  successfulQueries?: number | undefined;
}

/**
 * Database row types for type safety
 */
export interface DatabaseNodeRow {
  name: string; // PRIMARY KEY - matches actual schema
  display_name: string;
  description: string;
  version: number;
  category: string;
  icon?: string;
  inputs?: string; // JSON string
  outputs?: string; // JSON string
  properties?: string; // JSON string
  credentials?: string; // JSON string
  webhooks?: number; // SQLite boolean as integer
  polling?: number; // SQLite boolean as integer
  last_updated?: string;
  // Removed unused fields that don't exist in actual schema:
  // id, type, package, group, codex, is_ai_tool, category, development_style, created_at, updated_at
}

export interface ToolUsageRow {
  tool_name: string;
  usage_count: number;
  total_execution_time: number;
  successful_executions: number;
  failed_executions: number;
  last_used: string;
  average_execution_time: number; // Computed field from SQL query
  success_rate: number; // Computed field from SQL query
}

export interface NodeCountRow {
  category: string;
  count: number;
}

/**
 * Zod schemas for database JSON field validation
 */
const NodeInputsSchema = z.array(z.string());
const NodeOutputsSchema = z.array(z.string());
const NodePropertiesSchema = z.record(z.string(), z.unknown());
const NodeCredentialsSchema = z.array(z.string());

/**
 * Database-specific error classes for consistent error handling
 */
export class DatabaseError extends N8NMcpError {
  constructor(message: string, operation: string, cause?: unknown) {
    super(message, 'DATABASE_ERROR', undefined, { operation, cause });
  }
}

export class DatabaseConnectionError extends N8NMcpError {
  constructor(message: string, cause?: unknown) {
    super(message, 'DATABASE_CONNECTION_ERROR', undefined, { operation: 'DATABASE_CONNECTION', cause });
  }
}

export class DatabaseQueryError extends N8NMcpError {
  constructor(message: string, query: string, cause?: unknown) {
    super(message, 'DATABASE_QUERY_ERROR', undefined, { operation: 'DATABASE_QUERY', query, cause });
  }
}

/**
 * Database manager class
 */
export class DatabaseManager {
  private db: any = null; // Use any type since Database might not be available
  private readonly dbPath: string;
  private readonly initTime: Date = new Date();
  private lastHealthCheck: Date | null = null;
  private queryCount: number = 0;
  private successfulQueryCount: number = 0;
  private preparedStatements: Map<string, any> = new Map(); // Use any for optional dependency
  private queryCache: Map<string, { data: unknown; expires: number }> = new Map();
  private sqliteAvailable: boolean = false;

  constructor() {
    this.dbPath = config.databaseInMemory ? ':memory:' : config.databasePath;
  }

  /**
   * Map SQLite error codes to user-friendly messages
   */
  private mapSqliteError(error: unknown): string {
    const sqliteErrors: Record<string, string> = {
      'SQLITE_BUSY': 'Database is busy, please retry',
      'SQLITE_LOCKED': 'Database is locked, please retry', 
      'SQLITE_CORRUPT': 'Database file is corrupted',
      'SQLITE_FULL': 'Database disk is full',
      'SQLITE_CANTOPEN': 'Cannot open database file',
      'SQLITE_CONSTRAINT': 'Database constraint violation',
      'SQLITE_READONLY': 'Database is read-only',
    };

    const errorCode = (error as { code?: string; errno?: number | string })?.code ?? (error as { code?: string; errno?: number | string })?.errno?.toString?.();
    return sqliteErrors[errorCode as string] ?? 'Unknown database error';
  }

  /**
   * Handle database errors consistently with logging and context
   */
  private handleDatabaseError(operation: string, error: unknown, context?: Record<string, unknown>): void {
    const _errorMessage = this.mapSqliteError(error);
    
    logger.error('Database operation failed', {
      operation,
      error: error instanceof Error ? error.message : String(error),
      errorCode: (error as { code?: string; errno?: number })?.code ?? (error as { code?: string; errno?: number })?.errno,
      context,
      dbPath: this.dbPath
    });
  }

  /**
   * Safe execution wrapper for database operations with error handling
   */
  private safeExecute<T>(operation: string, fn: (db: any) => T, context?: Record<string, unknown>): T {
    if (!this.sqliteAvailable) {
      logger.debug(`Database operation skipped - SQLite not available: ${operation}`);
      // Return empty results for database operations when SQLite is not available
      return this.getFallbackResult<T>(operation);
    }

    if (!this.db) {
      throw new DatabaseConnectionError('Database not initialized');
    }

    this.queryCount++;

    try {
      const result = fn(this.db);
      this.successfulQueryCount++;
      return result;
    } catch (error) {
      this.handleDatabaseError(operation, error, context);
      
      // Re-throw with enhanced error information
      if (error instanceof Error) {
        throw new DatabaseQueryError(
          `${operation} failed: ${this.mapSqliteError(error)}`,
          operation,
          error
        );
      }
      throw error;
    }
  }

  /**
   * Provide fallback results when SQLite is not available
   */
  private getFallbackResult<T>(operation: string): T {
    switch (operation) {
      case 'getNodes':
      case 'searchNodes':
        return [] as T;
      case 'getToolUsage':
        return [] as T;
      case 'getAgentRoute':
        return null as T;
      default:
        logger.debug(`No fallback available for operation: ${operation}`);
        return [] as T;
    }
  }

  /**
   * Initialize database connection and schema
   */
  async initialize(): Promise<void> {
    try {
      // Try to load SQLite database
      const DatabaseClass = await loadDatabase();
      
      if (!DatabaseClass) {
        logger.info('SQLite not available - running in API-only mode without local database');
        this.sqliteAvailable = false;
        return;
      }

      this.sqliteAvailable = true;

      // Ensure data directory exists
      if (!config.databaseInMemory) {
        const dataDir = join(process.cwd(), 'data');
        if (!existsSync(dataDir)) {
          mkdirSync(dataDir, { recursive: true });
        }
      }

      // Open database connection
      this.db = new DatabaseClass(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');

      // Create schema
      await this.createSchema();
      
      // Initialize with default data
      await this.initializeDefaultData();

      logger.info(`Database initialized: ${this.dbPath}`);
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      // Don't throw - allow the application to continue in API-only mode
      this.sqliteAvailable = false;
      logger.warn('Continuing without local database - running in API-only mode');
    }
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const schemas = [
      // n8n nodes table
      `CREATE TABLE IF NOT EXISTS nodes (
        name TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        description TEXT,
        version INTEGER DEFAULT 1,
        category TEXT NOT NULL,
        icon TEXT,
        inputs TEXT, -- JSON array
        outputs TEXT, -- JSON array
        properties TEXT, -- JSON object
        credentials TEXT, -- JSON array
        webhooks BOOLEAN DEFAULT FALSE,
        polling BOOLEAN DEFAULT FALSE,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Tool usage statistics
      `CREATE TABLE IF NOT EXISTS tool_usage (
        tool_name TEXT PRIMARY KEY,
        usage_count INTEGER DEFAULT 0,
        last_used DATETIME,
        total_execution_time INTEGER DEFAULT 0, -- milliseconds
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0
      )`,

      // Agent routing table
      `CREATE TABLE IF NOT EXISTS agent_routes (
        tool_name TEXT,
        agent_name TEXT,
        priority INTEGER DEFAULT 1,
        capabilities TEXT, -- JSON array
        PRIMARY KEY (tool_name, agent_name)
      )`,

      // Create indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_nodes_category ON nodes(category)`,
      `CREATE INDEX IF NOT EXISTS idx_nodes_updated ON nodes(last_updated)`,
      `CREATE INDEX IF NOT EXISTS idx_usage_count ON tool_usage(usage_count DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_agent_priority ON agent_routes(priority DESC)`
    ];

    for (const schema of schemas) {
      this.db.exec(schema);
    }

    logger.debug('Database schema created');
  }

  /**
   * Initialize with default n8n node data
   * @deprecated Node data now comes from n8n API, not database
   */
  private async initializeDefaultData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Skip node initialization - using API-first architecture
    logger.debug('Skipping default node initialization - using n8n API for node discovery');
  }

  /**
   * Enhanced JSON parsing with Zod validation
   */
  private parseJsonField<T>(json: string | undefined, schema: z.ZodSchema<T>, defaultValue: T): T {
    if (!json) return defaultValue;
    
    try {
      const parsed = JSON.parse(json);
      const result = schema.safeParse(parsed);
      
      if (result.success) {
        return result.data;
      } else {
        logger.warn(`Schema validation failed for JSON "${json}": ${result.error.message}`);
        return defaultValue;
      }
    } catch (error) {
      logger.warn(`JSON parse error for value "${json}": ${error instanceof Error ? error.message : String(error)}`);
      return defaultValue;
    }
  }

  /**
   * Get all nodes
   */
  getNodes(category?: string): N8NNodeDatabase[] {
    return this.safeExecute('getNodes', (db) => {
      let query = 'SELECT * FROM nodes';
      const params: unknown[] = [];

      if (category) {
        query += ' WHERE category = ?';
        params.push(category);
      }

      query += ' ORDER BY display_name';

      const rows = db.prepare(query).all(...params) as DatabaseNodeRow[];
    
      return rows.map(row => ({
        name: row.name,
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
        lastUpdated: new Date(row.last_updated ?? new Date().toISOString())
      }));
    }, { category });
  }

  /**
   * Search nodes by name or description
   */
  searchNodes(query: string): N8NNodeDatabase[] {
    return this.safeExecute('searchNodes', (db) => {
      const searchQuery = `
        SELECT * FROM nodes 
        WHERE display_name LIKE ? OR description LIKE ? OR name LIKE ?
        ORDER BY display_name
      `;
      
      const searchTerm = `%${query}%`;
      const rows = db.prepare(searchQuery).all(searchTerm, searchTerm, searchTerm) as DatabaseNodeRow[];
    
      return rows.map(row => ({
        name: row.name,
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
        lastUpdated: new Date(row.last_updated ?? new Date().toISOString())
      }));
    }, { query });
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
      `);

      const successCount = success ? 1 : 0;
      const errorCount = success ? 0 : 1;

      upsertUsage.run(
        toolName,
        executionTime,
        successCount,
        errorCount,
        executionTime,
        successCount,
        errorCount
      );
    }, { toolName, executionTime, success });
  }

  /**
   * Get tool usage statistics with caching
   */
  getToolUsage(): ToolUsage[] {
    // Check cache first
    const cacheKey = 'tool-usage-stats';
    const cached = this.getCachedResult<ToolUsage[]>(cacheKey);
    if (cached) return cached;

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
      `).all() as ToolUsageRow[];

      return rows.map(row => ({
        toolName: row.tool_name,
        usageCount: row.usage_count,
        lastUsed: new Date(row.last_used),
        averageExecutionTime: row.average_execution_time,
        successRate: row.success_rate
      }));
    });

    // Cache the result
    this.cacheResult(cacheKey, result, 60000); // 1 minute cache
    return result;
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
      `).get(toolName) as { tool_name: string; agent_name: string; priority: number; capabilities: string } | undefined;

      if (!row) return null;

      return {
        toolName: row.tool_name,
        agentName: row.agent_name,
        priority: row.priority,
        capabilities: JSON.parse(row.capabilities ?? '[]')
      };
    }, { toolName });
  }

  /**
   * Close database connection and cleanup resources
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      
      // Cleanup performance resources
      this.queryCache.clear();
      this.preparedStatements.clear();
      
      logger.info('Database connection closed and resources cleaned up');
    }
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    if (!this.sqliteAvailable) {
      return true; // API-only mode is always "ready"
    }
    
    try {
      if (!this.db) return false;
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Performance Optimization Methods
   */

  /**
   * Get or create prepared statement with caching
   */
  private getPreparedStatement(db: any, key: string, sql: string): any {
    if (!this.preparedStatements.has(key)) {
      this.preparedStatements.set(key, db.prepare(sql));
    }
    const statement = this.preparedStatements.get(key);
    if (!statement) {
      throw new DatabaseError(`Failed to retrieve prepared statement for key: ${key}`, 'getPreparedStatement');
    }
    return statement;
  }

  /**
   * Cache query result with TTL (Time To Live)
   */
  private cacheResult<T>(key: string, data: T, ttlMs: number = 300000): void { // 5min default
    const expires = Date.now() + ttlMs;
    this.queryCache.set(key, { data, expires });
  }

  /**
   * Get cached query result if still valid
   */
  private getCachedResult<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expires) {
      this.queryCache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  /**
   * Clear expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.queryCache.entries()) {
      if (now > cached.expires) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Async wrapper for heavy operations to prevent event loop blocking
   */
  private async asyncSafeExecute<T>(operation: string, fn: (db: any) => T, context?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          const result = this.safeExecute(operation, fn, context);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Batch record multiple tool usage entries for better performance
   */
  batchRecordToolUsage(usageEntries: Array<{ toolName: string; executionTime: number; success: boolean }>): void {
    if (usageEntries.length === 0) return;

    this.safeExecute('batchRecordToolUsage', (db) => {
      const transaction = db.transaction((entries: Array<{ toolName: string; executionTime: number; success: boolean }>) => {
        const upsertStmt = this.getPreparedStatement(db, 'upsert-tool-usage', `
          INSERT INTO tool_usage (tool_name, usage_count, last_used, total_execution_time, success_count, error_count)
          VALUES (?, 1, datetime('now'), ?, ?, ?)
          ON CONFLICT(tool_name) DO UPDATE SET
            usage_count = usage_count + 1,
            last_used = datetime('now'),
            total_execution_time = total_execution_time + ?,
            success_count = success_count + ?,
            error_count = error_count + ?
        `);

        for (const entry of entries) {
          const successCount = entry.success ? 1 : 0;
          const errorCount = entry.success ? 0 : 1;

          upsertStmt.run(
            entry.toolName,
            entry.executionTime,
            successCount,
            errorCount,
            entry.executionTime,
            successCount,
            errorCount
          );
        }
      });

      transaction(usageEntries);
    }, { batchSize: usageEntries.length });
  }

  /**
   * Check database connection status
   */
  private checkConnection(): boolean {
    try {
      if (!this.db) return false;
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate database schema integrity
   */
  private checkSchema(): boolean {
    try {
      if (!this.db) return false;
      
      // Check if required tables exist
      const tables = ['nodes', 'tool_usage', 'agent_routes'];
      const existingTables = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name IN (${tables.map(() => '?').join(', ')})
      `).all(...tables) as { name: string }[];
      
      return existingTables.length === tables.length;
    } catch {
      return false;
    }
  }

  /**
   * Measure query performance with a simple benchmark
   */
  private measureQueryPerformance(): number {
    try {
      if (!this.db) return -1;
      
      const start = performance.now();
      this.db.prepare('SELECT COUNT(*) FROM sqlite_master').get();
      const end = performance.now();
      
      return end - start;
    } catch {
      return -1;
    }
  }

  /**
   * Get disk space information for non-memory databases
   */
  private async getDiskSpace(): Promise<number | undefined> {
    if (config.databaseInMemory) return undefined;
    
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(this.dbPath);
      return stats.size;
    } catch {
      return undefined;
    }
  }

  /**
   * Comprehensive database health check
   */
  async checkHealth(): Promise<DatabaseHealth> {
    this.lastHealthCheck = new Date();
    
    const connectionStatus = this.checkConnection();
    const schemaValid = this.checkSchema();
    const queryResponseTime = this.measureQueryPerformance();
    const diskSpace = await this.getDiskSpace();
    
    const errors: string[] = [];
    if (!connectionStatus) errors.push('Database connection failed');
    if (!schemaValid) errors.push('Database schema validation failed');
    if (queryResponseTime < 0) errors.push('Query performance test failed');
    
    let status: DatabaseHealth['status'] = 'healthy';
    if (errors.length > 0) {
      status = errors.length > 1 ? 'unhealthy' : 'degraded';
    } else if (queryResponseTime > 1000) { // 1 second threshold
      status = 'degraded';
      errors.push('Query response time exceeds threshold');
    }

    const uptime = Date.now() - this.initTime.getTime();

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
      successfulQueries: this.successfulQueryCount
    };
  }

  /**
   * Quick health status check
   */
  isHealthy(): boolean {
    return this.checkConnection() && this.checkSchema();
  }

  /**
   * Attempt to reconnect database
   */
  async reconnect(): Promise<boolean> {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      
      await this.initialize();
      return this.isHealthy();
    } catch (error) {
      logger.error('Database reconnection failed:', error);
      return false;
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
          logger.info('Rebuilding database...');
          
          // Clear caches and prepared statements
          this.queryCache.clear();
          this.preparedStatements.clear();
          
          if (this.db) {
            this.db.close();
            this.db = null;
          }

          // Delete existing database file
          if (!config.databaseInMemory && existsSync(this.dbPath)) {
            const fs = await import('fs/promises');
            await fs.unlink(this.dbPath);
          }

          // Reinitialize
          await this.initialize();
          logger.info('Database rebuilt successfully');
          resolve();
        } catch (error) {
          logger.error('Database rebuild failed:', error);
          reject(error);
        }
      });
    });
  }
}

// Export singleton instance
export const database = new DatabaseManager();