/**
 * Dynamic Schema Management System
 *
 * Replaces static database schemas with a dynamic, versioned migration system.
 * Enables runtime schema evolution, rollback capabilities, and forward compatibility.
 *
 * FEATURES:
 * - Version-controlled schema migrations
 * - Up/down migration support with rollback
 * - Schema validation and integrity checks
 * - Dynamic table and column management
 * - Migration dependency tracking
 * - Production-safe migration execution
 */

import type { Database } from 'better-sqlite3'
import { join } from 'node:path'
import process from 'node:process'
import { logger } from '../server/logger.js'

/**
 * Schema version information
 */
export interface SchemaVersion {
  version: number
  name: string
  description: string
  timestamp: string
  checksum: string
}

/**
 * Migration definition
 */
export interface Migration {
  version: number
  name: string
  description: string
  dependencies: number[] // Required previous versions
  up: (db: Database) => Promise<void> | void
  down: (db: Database) => Promise<void> | void
  validate?: (db: Database) => Promise<boolean> | boolean
  checksum: string
}

/**
 * Migration execution result
 */
export interface MigrationResult {
  version: number
  name: string
  success: boolean
  executionTime: number
  error?: string
  rollback?: boolean
}

/**
 * Schema validation result
 */
export interface SchemaValidation {
  isValid: boolean
  currentVersion: number
  expectedVersion: number
  missingTables: string[]
  extraTables: string[]
  schemaErrors: string[]
  recommendations: string[]
}

/**
 * Migration execution strategy
 */
export enum MigrationStrategy {
  STRICT = 'strict', // Fail on any error
  GRACEFUL = 'graceful', // Skip failed migrations with warnings
  ROLLBACK_ON_ERROR = 'rollback', // Rollback all changes on first error
}

/**
 * Dynamic Schema Manager
 * Handles versioned database schema evolution with migrations
 */
export class SchemaManager {
  private migrations = new Map<number, Migration>()
  private currentVersion = 0
  private isInitialized = false
  private db: Database | null = null
  private migrationHistory: MigrationResult[] = []

  constructor(
    private databasePath: string,
    private migrationsPath?: string,
  ) {
    this.migrationsPath = migrationsPath || join(process.cwd(), 'migrations')
  }

  /**
   * Initialize schema manager and load migrations
   */
  async initialize(database: Database): Promise<void> {
    if (this.isInitialized) {
      return
    }

    this.db = database

    try {
      // Create schema_versions table for tracking migrations
      await this.createVersionTable()

      // Load current version from database
      this.currentVersion = await this.getCurrentVersion()

      // Load available migrations
      await this.loadMigrations()

      // Validate current schema
      const validation = await this.validateSchema()
      if (!validation.isValid) {
        logger.warn('Schema validation issues detected:', validation)
      }

      this.isInitialized = true
      logger.info('Schema manager initialized', {
        currentVersion: this.currentVersion,
        availableMigrations: this.migrations.size,
        schemaValid: validation.isValid,
      })
    }
    catch (error) {
      logger.error('Failed to initialize schema manager:', error)
      throw error
    }
  }

  /**
   * Register a new migration
   */
  registerMigration(migration: Migration): void {
    if (this.migrations.has(migration.version)) {
      throw new Error(`Migration version ${migration.version} already registered`)
    }

    // Validate migration structure
    this.validateMigration(migration)

    this.migrations.set(migration.version, migration)
    logger.debug(`Registered migration: ${migration.version} - ${migration.name}`)
  }

  /**
   * Execute pending migrations
   */
  async migrate(
    targetVersion?: number,
    strategy: MigrationStrategy = MigrationStrategy.STRICT,
  ): Promise<MigrationResult[]> {
    if (!this.isInitialized) {
      throw new Error('Schema manager not initialized')
    }

    const results: MigrationResult[] = []
    const pendingMigrations = this.getPendingMigrations(targetVersion)

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations to execute')
      return results
    }

    logger.info(`Executing ${pendingMigrations.length} migrations`, {
      strategy,
      targetVersion: targetVersion || 'latest',
      currentVersion: this.currentVersion,
    })

    // Execute migrations in sequence
    for (const migration of pendingMigrations) {
      const result = await this.executeMigration(migration, strategy)
      results.push(result)

      if (!result.success) {
        if (strategy === MigrationStrategy.STRICT) {
          throw new Error(`Migration ${migration.version} failed: ${result.error}`)
        }
        else if (strategy === MigrationStrategy.ROLLBACK_ON_ERROR) {
          logger.error(`Migration failed, rolling back all changes`)
          await this.rollbackMigrations(results)
          throw new Error(`Migration rollback completed due to failure: ${result.error}`)
        }
        else {
          logger.warn(`Migration ${migration.version} failed but continuing with graceful strategy`)
        }
      }
      else {
        this.currentVersion = migration.version
        await this.recordMigration(migration, result)
      }
    }

    // Final schema validation
    const validation = await this.validateSchema()
    if (!validation.isValid) {
      logger.warn('Schema validation failed after migrations:', validation)
    }

    logger.info(`Completed ${results.length} migrations`, {
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      currentVersion: this.currentVersion,
    })

    return results
  }

  /**
   * Rollback migrations to target version
   */
  async rollback(targetVersion: number): Promise<MigrationResult[]> {
    if (!this.isInitialized) {
      throw new Error('Schema manager not initialized')
    }

    if (targetVersion >= this.currentVersion) {
      throw new Error(`Cannot rollback to version ${targetVersion} - current version is ${this.currentVersion}`)
    }

    const results: MigrationResult[] = []
    const migrationsToRollback = this.getMigrationsToRollback(targetVersion)

    logger.info(`Rolling back ${migrationsToRollback.length} migrations`, {
      targetVersion,
      currentVersion: this.currentVersion,
    })

    // Execute rollbacks in reverse order
    for (const migration of migrationsToRollback.reverse()) {
      const result = await this.executeRollback(migration)
      results.push(result)

      if (result.success) {
        this.currentVersion = targetVersion
        await this.removeMigrationRecord(migration)
      }
      else {
        logger.error(`Rollback failed for migration ${migration.version}:`, result.error)
        break
      }
    }

    logger.info(`Rollback completed`, {
      targetVersion,
      currentVersion: this.currentVersion,
      results: results.length,
    })

    return results
  }

  /**
   * Validate current schema against expected structure
   */
  async validateSchema(): Promise<SchemaValidation> {
    if (!this.db) {
      throw new Error('Database not available')
    }

    try {
      const currentTables = await this.getCurrentTables()
      const expectedTables = this.getExpectedTables()

      const missingTables = expectedTables.filter(table => !currentTables.includes(table))
      const extraTables = currentTables.filter(table => !expectedTables.includes(table) && table !== 'schema_versions')

      const schemaErrors: string[] = []
      const recommendations: string[] = []

      // Check for missing tables
      if (missingTables.length > 0) {
        schemaErrors.push(`Missing tables: ${missingTables.join(', ')}`)
        recommendations.push('Run migrations to create missing tables')
      }

      // Check for extra tables
      if (extraTables.length > 0) {
        recommendations.push(`Consider cleaning up unused tables: ${extraTables.join(', ')}`)
      }

      // Validate table structures
      for (const table of currentTables) {
        const tableValidation = await this.validateTableStructure(table)
        if (!tableValidation.isValid) {
          schemaErrors.push(`Table ${table}: ${tableValidation.errors.join(', ')}`)
        }
      }

      const latestVersion = Math.max(...Array.from(this.migrations.keys()))

      return {
        isValid: schemaErrors.length === 0,
        currentVersion: this.currentVersion,
        expectedVersion: latestVersion,
        missingTables,
        extraTables,
        schemaErrors,
        recommendations,
      }
    }
    catch (error) {
      logger.error('Schema validation failed:', error)
      return {
        isValid: false,
        currentVersion: this.currentVersion,
        expectedVersion: 0,
        missingTables: [],
        extraTables: [],
        schemaErrors: [`Validation error: ${error}`],
        recommendations: ['Check database connectivity and permissions'],
      }
    }
  }

  /**
   * Get current schema version
   */
  getCurrentSchemaVersion(): number {
    return this.currentVersion
  }

  /**
   * Get migration history
   */
  getMigrationHistory(): MigrationResult[] {
    return [...this.migrationHistory]
  }

  /**
   * Get available migrations
   */
  getAvailableMigrations(): Migration[] {
    return Array.from(this.migrations.values()).sort((a, b) => a.version - b.version)
  }

  /**
   * Check if migrations are pending
   */
  hasPendingMigrations(): boolean {
    const latestVersion = Math.max(...Array.from(this.migrations.keys()))
    return this.currentVersion < latestVersion
  }

  // === Private Methods ===

  /**
   * Create schema_versions table for tracking migrations
   */
  private async createVersionTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_versions (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        applied_at TEXT NOT NULL,
        execution_time INTEGER,
        checksum TEXT NOT NULL
      )
    `

    if (!this.db)
      throw new Error('Database not initialized')
    await this.db.exec(sql)
  }

  /**
   * Get current schema version from database
   */
  private async getCurrentVersion(): Promise<number> {
    try {
      if (!this.db)
        throw new Error('Database not initialized')
      const result = this.db.prepare('SELECT MAX(version) as version FROM schema_versions').get() as { version?: number } | undefined
      return result?.version || 0
    }
    catch {
      // Table might not exist yet
      return 0
    }
  }

  /**
   * Load migrations from files or registration
   */
  private async loadMigrations(): Promise<void> {
    // In this implementation, migrations will be registered programmatically
    // but we could extend this to load from files in the future

    // Register default migrations
    this.registerDefaultMigrations()
  }

  /**
   * Register default migrations for the current system
   */
  private registerDefaultMigrations(): void {
    // Migration 1: Create initial tables
    this.registerMigration({
      version: 1,
      name: 'create_initial_tables',
      description: 'Create initial n8n nodes and tools tables',
      dependencies: [],
      checksum: this.calculateChecksum('create_initial_tables_v1'),
      up: async (db) => {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS nodes (
            name TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            description TEXT,
            version INTEGER DEFAULT 1,
            category TEXT,
            icon TEXT,
            inputs TEXT,
            outputs TEXT,
            properties TEXT,
            credentials TEXT,
            webhooks INTEGER DEFAULT 0,
            polling INTEGER DEFAULT 0,
            last_updated TEXT
          )
        `)

        await db.exec(`
          CREATE TABLE IF NOT EXISTS tool_usage (
            tool_name TEXT PRIMARY KEY,
            usage_count INTEGER DEFAULT 0,
            last_used TEXT,
            average_execution_time REAL DEFAULT 0,
            success_rate REAL DEFAULT 1.0
          )
        `)

        await db.exec(`
          CREATE INDEX IF NOT EXISTS idx_nodes_category ON nodes(category)
        `)

        await db.exec(`
          CREATE INDEX IF NOT EXISTS idx_nodes_version ON nodes(version)
        `)
      },
      down: async (db) => {
        await db.exec('DROP TABLE IF EXISTS nodes')
        await db.exec('DROP TABLE IF EXISTS tool_usage')
      },
    })

    // Migration 2: Add agent routing table
    this.registerMigration({
      version: 2,
      name: 'add_agent_routing',
      description: 'Add dynamic agent routing capabilities',
      dependencies: [1],
      checksum: this.calculateChecksum('add_agent_routing_v2'),
      up: async (db) => {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS agent_routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_name TEXT NOT NULL,
            agent_name TEXT NOT NULL,
            priority INTEGER DEFAULT 0,
            capabilities TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tool_name, agent_name)
          )
        `)

        await db.exec(`
          CREATE INDEX IF NOT EXISTS idx_agent_routes_tool ON agent_routes(tool_name)
        `)

        await db.exec(`
          CREATE INDEX IF NOT EXISTS idx_agent_routes_agent ON agent_routes(agent_name)
        `)
      },
      down: async (db) => {
        await db.exec('DROP TABLE IF EXISTS agent_routes')
      },
    })

    // Migration 3: Phase 1 - Version tracking and n8n instance management
    this.registerMigration({
      version: 3,
      name: 'add_version_tracking',
      description: 'Phase 1: Add n8n version tracking and instance management for dynamic discovery',
      dependencies: [2],
      checksum: this.calculateChecksum('add_version_tracking_v3'),
      up: async (db) => {
        // n8n instance tracking - tracks different n8n instances and their versions
        await db.exec(`
          CREATE TABLE IF NOT EXISTS n8n_instances (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            version TEXT NOT NULL,
            edition TEXT DEFAULT 'community', -- community, cloud, enterprise
            last_discovered DATETIME DEFAULT CURRENT_TIMESTAMP,
            discovery_method TEXT DEFAULT 'api', -- api, credential_test, manual
            status TEXT DEFAULT 'active', -- active, inactive, error
            error_count INTEGER DEFAULT 0,
            last_error TEXT,
            capabilities TEXT, -- JSON: available features/endpoints
            community_nodes TEXT, -- JSON: installed community nodes (like scrapeninja)
            official_node_count INTEGER DEFAULT 0,
            community_node_count INTEGER DEFAULT 0,
            api_response_time INTEGER DEFAULT 0, -- milliseconds
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        // Discovery sessions - track each discovery run for performance monitoring
        await db.exec(`
          CREATE TABLE IF NOT EXISTS discovery_sessions (
            id TEXT PRIMARY KEY,
            instance_id TEXT NOT NULL,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            status TEXT DEFAULT 'running', -- running, completed, failed, cancelled
            discovery_type TEXT NOT NULL, -- full, incremental, version_check, community_only
            trigger TEXT DEFAULT 'manual', -- manual, schedule, upgrade, startup
            nodes_discovered INTEGER DEFAULT 0,
            tools_generated INTEGER DEFAULT 0,
            credentials_tested INTEGER DEFAULT 0,
            execution_time INTEGER DEFAULT 0, -- milliseconds
            memory_used INTEGER DEFAULT 0, -- bytes
            errors_count INTEGER DEFAULT 0,
            warnings_count INTEGER DEFAULT 0,
            success_rate REAL DEFAULT 0.0,
            discovery_log TEXT, -- JSON: detailed discovery log
            performance_metrics TEXT, -- JSON: timing breakdowns
            FOREIGN KEY (instance_id) REFERENCES n8n_instances(id) ON DELETE CASCADE
          )
        `)

        // Enhanced nodes table with version tracking and discovery metadata
        // SQLite requires individual ALTER TABLE statements for each column
        await db.exec(`ALTER TABLE nodes ADD COLUMN instance_id TEXT`)
        await db.exec(`ALTER TABLE nodes ADD COLUMN node_type TEXT DEFAULT 'official'`)
        await db.exec(`ALTER TABLE nodes ADD COLUMN package_name TEXT`)
        await db.exec(`ALTER TABLE nodes ADD COLUMN package_version TEXT`)
        await db.exec(`ALTER TABLE nodes ADD COLUMN discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP`)
        await db.exec(`ALTER TABLE nodes ADD COLUMN discovery_session_id TEXT`)
        await db.exec(`ALTER TABLE nodes ADD COLUMN api_version TEXT`)
        await db.exec(`ALTER TABLE nodes ADD COLUMN node_version_hash TEXT`)
        await db.exec(`ALTER TABLE nodes ADD COLUMN mcp_tools_count INTEGER DEFAULT 0`)
        await db.exec(`ALTER TABLE nodes ADD COLUMN is_active INTEGER DEFAULT 1`)

        // MCP tool tracking - track generated MCP tools and their performance
        await db.exec(`
          CREATE TABLE IF NOT EXISTS mcp_tools (
            id TEXT PRIMARY KEY, -- tool identifier 
            node_name TEXT, -- source n8n node (nullable for category tools)
            instance_id TEXT NOT NULL,
            tool_type TEXT NOT NULL, -- general, operation_specific, category
            operation_name TEXT, -- for operation-specific tools
            schema_hash TEXT NOT NULL, -- for detecting changes
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            usage_count INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            error_count INTEGER DEFAULT 0,
            avg_execution_time REAL DEFAULT 0.0,
            last_used DATETIME,
            is_active INTEGER DEFAULT 1,
            discovery_session_id TEXT,
            FOREIGN KEY (node_name) REFERENCES nodes(name) ON DELETE CASCADE,
            FOREIGN KEY (instance_id) REFERENCES n8n_instances(id) ON DELETE CASCADE,
            FOREIGN KEY (discovery_session_id) REFERENCES discovery_sessions(id) ON DELETE SET NULL
          )
        `)

        // Version change tracking - detect when n8n instances are upgraded
        await db.exec(`
          CREATE TABLE IF NOT EXISTS version_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instance_id TEXT NOT NULL,
            old_version TEXT,
            new_version TEXT,
            detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            change_type TEXT DEFAULT 'upgrade', -- upgrade, downgrade, unknown
            trigger_source TEXT DEFAULT 'discovery', -- discovery, watchtower, manual
            rediscovery_required INTEGER DEFAULT 1,
            rediscovery_completed_at DATETIME,
            nodes_changed INTEGER DEFAULT 0,
            tools_regenerated INTEGER DEFAULT 0,
            FOREIGN KEY (instance_id) REFERENCES n8n_instances(id) ON DELETE CASCADE
          )
        `)

        // Create performance indexes
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_n8n_instances_version ON n8n_instances(version)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_n8n_instances_status ON n8n_instances(status)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_n8n_instances_last_discovered ON n8n_instances(last_discovered)`)

        await db.exec(`CREATE INDEX IF NOT EXISTS idx_discovery_sessions_status ON discovery_sessions(status)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_discovery_sessions_type ON discovery_sessions(discovery_type)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_discovery_sessions_completed ON discovery_sessions(completed_at)`)

        await db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_instance ON nodes(instance_id)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_discovered ON nodes(discovered_at)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_active ON nodes(is_active)`)

        await db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_tools_node ON mcp_tools(node_name)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_tools_instance ON mcp_tools(instance_id)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_tools_type ON mcp_tools(tool_type)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_tools_usage ON mcp_tools(usage_count DESC)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_tools_active ON mcp_tools(is_active)`)

        await db.exec(`CREATE INDEX IF NOT EXISTS idx_version_changes_instance ON version_changes(instance_id)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_version_changes_detected ON version_changes(detected_at)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_version_changes_rediscovery ON version_changes(rediscovery_required)`)
      },
      down: async (db) => {
        await db.exec('DROP TABLE IF EXISTS version_changes')
        await db.exec('DROP TABLE IF EXISTS mcp_tools')
        await db.exec('DROP TABLE IF EXISTS discovery_sessions')
        await db.exec('DROP TABLE IF EXISTS n8n_instances')

        // Revert nodes table changes (SQLite doesn't support dropping columns easily)
        // In a real scenario, we'd recreate the table without the new columns
        // For now, just leave them as they won't break anything
      },
      validate: async (db) => {
        // Validate the new tables were created successfully
        const tables = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name IN ('n8n_instances', 'discovery_sessions', 'mcp_tools', 'version_changes')
        `).all()

        return tables.length === 4
      },
    })
  }

  /**
   * Validate migration structure
   */
  private validateMigration(migration: Migration): void {
    if (!migration.version || migration.version < 1) {
      throw new Error('Migration version must be a positive integer')
    }

    if (!migration.name || typeof migration.name !== 'string') {
      throw new Error('Migration name is required')
    }

    if (!migration.up || typeof migration.up !== 'function') {
      throw new Error('Migration up function is required')
    }

    if (!migration.down || typeof migration.down !== 'function') {
      throw new Error('Migration down function is required')
    }

    if (!migration.checksum) {
      throw new Error('Migration checksum is required')
    }
  }

  /**
   * Get pending migrations up to target version
   */
  private getPendingMigrations(targetVersion?: number): Migration[] {
    const maxVersion = targetVersion || Math.max(...Array.from(this.migrations.keys()))

    return Array.from(this.migrations.values())
      .filter(m => m.version > this.currentVersion && m.version <= maxVersion)
      .sort((a, b) => a.version - b.version)
  }

  /**
   * Get migrations to rollback to target version
   */
  private getMigrationsToRollback(targetVersion: number): Migration[] {
    return Array.from(this.migrations.values())
      .filter(m => m.version > targetVersion && m.version <= this.currentVersion)
      .sort((a, b) => b.version - a.version)
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: Migration, _strategy: MigrationStrategy): Promise<MigrationResult> {
    const startTime = performance.now()

    try {
      logger.info(`Executing migration ${migration.version}: ${migration.name}`)

      // Validate dependencies
      for (const dep of migration.dependencies) {
        if (dep > this.currentVersion) {
          throw new Error(`Missing dependency: migration ${dep} must be applied before ${migration.version}`)
        }
      }

      // Execute the migration
      if (!this.db)
        throw new Error('Database not initialized')
      await migration.up(this.db)

      // Validate if validation function provided
      if (migration.validate) {
        const isValid = await migration.validate(this.db)
        if (!isValid) {
          throw new Error('Migration validation failed')
        }
      }

      const executionTime = performance.now() - startTime

      return {
        version: migration.version,
        name: migration.name,
        success: true,
        executionTime,
      }
    }
    catch (error) {
      const executionTime = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      logger.error(`Migration ${migration.version} failed:`, error)

      return {
        version: migration.version,
        name: migration.name,
        success: false,
        executionTime,
        error: errorMessage,
      }
    }
  }

  /**
   * Execute migration rollback
   */
  private async executeRollback(migration: Migration): Promise<MigrationResult> {
    const startTime = performance.now()

    try {
      logger.info(`Rolling back migration ${migration.version}: ${migration.name}`)

      if (!this.db)
        throw new Error('Database not initialized')
      await migration.down(this.db)

      const executionTime = performance.now() - startTime

      return {
        version: migration.version,
        name: migration.name,
        success: true,
        executionTime,
        rollback: true,
      }
    }
    catch (error) {
      const executionTime = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      logger.error(`Rollback ${migration.version} failed:`, error)

      return {
        version: migration.version,
        name: migration.name,
        success: false,
        executionTime,
        error: errorMessage,
        rollback: true,
      }
    }
  }

  /**
   * Record successful migration in database
   */
  private async recordMigration(migration: Migration, result: MigrationResult): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO schema_versions 
      (version, name, description, applied_at, execution_time, checksum)
      VALUES (?, ?, ?, ?, ?, ?)
    `

    if (!this.db)
      throw new Error('Database not initialized')
    this.db.prepare(sql).run([
      migration.version,
      migration.name,
      migration.description,
      new Date().toISOString(),
      result.executionTime,
      migration.checksum,
    ])

    this.migrationHistory.push(result)
  }

  /**
   * Remove migration record (for rollback)
   */
  private async removeMigrationRecord(migration: Migration): Promise<void> {
    if (!this.db)
      throw new Error('Database not initialized')
    const sql = 'DELETE FROM schema_versions WHERE version = ?'
    this.db.prepare(sql).run(migration.version)
  }

  /**
   * Rollback multiple migrations
   */
  private async rollbackMigrations(results: MigrationResult[]): Promise<void> {
    const successfulMigrations = results.filter(r => r.success).reverse()

    for (const result of successfulMigrations) {
      const migration = this.migrations.get(result.version)
      if (migration) {
        await this.executeRollback(migration)
        await this.removeMigrationRecord(migration)
      }
    }
  }

  /**
   * Get current database tables
   */
  private async getCurrentTables(): Promise<string[]> {
    if (!this.db)
      throw new Error('Database not initialized')
    const sql = 'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\''
    const rows = this.db.prepare(sql).all() as Array<{ name: string }>
    return rows.map(row => row.name)
  }

  /**
   * Get expected tables based on migrations
   */
  private getExpectedTables(): string[] {
    // This would be calculated based on the current migration set
    // Updated for Phase 1: Version tracking and instance management
    return [
      'nodes',
      'tool_usage',
      'agent_routes',
      'n8n_instances',
      'discovery_sessions',
      'mcp_tools',
      'version_changes',
    ]
  }

  /**
   * Validate table structure
   */
  private async validateTableStructure(tableName: string): Promise<{ isValid: boolean, errors: string[] }> {
    try {
      if (!this.db)
        throw new Error('Database not initialized')
      const sql = `PRAGMA table_info(${tableName})`
      const columns = this.db.prepare(sql).all() as Array<Record<string, unknown>>

      // Basic validation - table should have columns
      if (columns.length === 0) {
        return { isValid: false, errors: ['Table has no columns'] }
      }

      return { isValid: true, errors: [] }
    }
    catch (error) {
      return { isValid: false, errors: [`Cannot access table info: ${error}`] }
    }
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    // Simple checksum implementation
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
  }
}

/**
 * Schema manager singleton instance
 */
let schemaManagerInstance: SchemaManager | null = null

/**
 * Get or create schema manager instance
 */
export function getSchemaManager(databasePath?: string, migrationsPath?: string): SchemaManager {
  if (!schemaManagerInstance) {
    if (!databasePath) {
      throw new Error('Database path required for schema manager initialization')
    }
    schemaManagerInstance = new SchemaManager(databasePath, migrationsPath)
  }
  return schemaManagerInstance
}

/**
 * Reset schema manager instance (for testing)
 */
export function resetSchemaManager(): void {
  schemaManagerInstance = null
}
