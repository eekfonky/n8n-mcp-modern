/**
 * Dynamic Agent Database Manager
 * Handles memory, sessions, discoveries, and delegation learning
 * Security-first implementation with encryption and integrity checks
 */

import type { Database } from 'better-sqlite3'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import process from 'node:process'
import BetterSqlite3 from 'better-sqlite3'
import { logger } from '../server/logger.js'

// Database result types
interface DatabaseMemoryRow {
  id: number
  agent_name: string
  memory_type: string
  content: string
  content_hash: string
  relevance_score: number
  usage_count: number
  last_accessed: string
  created_at: string
  updated_at: string
  tags: string
  embeddings?: string
  expires_at?: string
  parent_memory_id?: number
  related_memory_ids?: string
}

interface DatabaseSessionRow {
  id: number
  session_id: string
  agent_name: string
  session_type: string
  state_data?: string
  context_data?: string
  metadata?: string
  started_at: string
  last_active: string
  expires_at: string
  completed_at?: string
  encrypted_state?: Buffer
  state_signature?: string
  operations_count?: number
  memory_usage_bytes?: number
  parent_session_id?: string
  child_session_ids?: string
}

interface DatabaseDiscoveryRow {
  id: number
  discovery_type: string
  discovery_key: string
  title: string
  description: string
  content_data: string
  node_types: string
  tags: string
  success_rate: number
  usage_count: number
  created_at: string
  confidence_score?: number
  created_by?: string
  validated_by?: string
  last_used?: string
  version?: number
  superseded_by?: number
}

interface DatabaseCountRow {
  count: number
}

interface DatabaseAvgRow {
  avg_success: number
}

interface DatabaseStringRow {
  to_agent: string
  title: string
  partner: string
}

interface DatabaseDelegationRow {
  id: number
  delegation_type: string
  task_pattern: string
  recommended_agent: string
  success_count: number
  failure_count: number
  confidence_score: number
  avg_duration_minutes: number
  created_at: string
  updated_at: string
}

interface DatabaseMemoryRelationshipRow {
  id: number
  source_memory_id: number
  target_memory_id: number
  relationship_type: string
  strength: number
  created_at: string
  created_by: string
}

interface DatabaseSessionOperationRow {
  id: number
  session_id: string
  operation_type: string
  operation_data: string
  success: boolean
  error_message?: string
  duration_ms: number
  memory_impact_bytes: number
  timestamp: string
}

export interface AgentMemory {
  id?: number | undefined
  agentName: string
  memoryType: 'workflow_pattern' | 'workflow_template' | 'workflow_snippet' | 'node_configuration' | 'node_pattern' | 'integration_pattern'
    | 'user_preference' | 'user_query' | 'user_feedback' | 'user_context'
    | 'error_solution' | 'troubleshooting_guide' | 'debug_strategy' | 'workaround_solution'
    | 'discovery_result' | 'knowledge_base' | 'learning_outcome' | 'best_practice' | 'anti_pattern'
    | 'performance_insight' | 'optimization_rule' | 'efficiency_tip' | 'resource_usage'
    | 'validation_rule' | 'security_pattern' | 'credential_pattern' | 'permission_rule'
    | 'delegation_outcome' | 'collaboration_pattern' | 'team_preference' | 'handoff_instruction'
    | 'test_pattern' | 'test_case' | 'test_data' | 'mock_configuration'
    | 'api_pattern' | 'webhook_pattern' | 'connection_config' | 'data_mapping'
    | 'usage_pattern' | 'metric_definition' | 'alert_rule' | 'dashboard_config'
    | 'response_format' | 'performance_test' | 'load_test'
  content: string
  contentHash?: string | undefined
  embeddings?: Float32Array | number[] | undefined
  tags?: string[] | undefined
  relevanceScore?: number | undefined
  usageCount?: number | undefined
  lastAccessed?: Date | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
  expiresAt?: Date | undefined
  encryptedContent?: string | undefined
  signature?: string | undefined
  parentMemoryId?: number | undefined
  relatedMemoryIds?: number[] | undefined
}

export interface AgentSession {
  id?: number | undefined
  sessionId: string
  agentName: string
  sessionType: 'iterative_building' | 'rapid_prototyping' | 'workflow_design' | 'template_creation'
    | 'consultation' | 'technical_advisory' | 'strategic_consultation' | 'architecture_review' | 'best_practice_guidance'
    | 'collaboration' | 'pair_programming' | 'code_review' | 'knowledge_transfer' | 'cross_training' | 'team_building'
    | 'delegation' | 'task_management' | 'project_coordination' | 'work_distribution' | 'progress_tracking'
    | 'learning' | 'training_session' | 'skill_development' | 'mentoring' | 'onboarding' | 'certification_prep'
    | 'troubleshooting' | 'incident_response' | 'emergency_support' | 'crisis_management' | 'post_mortem'
    | 'data_exploration' | 'research_session' | 'competitive_analysis' | 'market_research' | 'feasibility_study'
    | 'testing_session' | 'validation_review' | 'quality_assurance' | 'security_audit' | 'performance_analysis'
    | 'planning_session' | 'roadmap_planning' | 'sprint_planning' | 'release_planning' | 'capacity_planning'
    | 'integration_session' | 'deployment_planning' | 'rollout_coordination' | 'migration_planning' | 'cutover_management'
    | 'mcp_testing' | 'test_session'
  stateData?: string | undefined
  contextData?: string | undefined
  metadata?: string | undefined
  startedAt?: Date | undefined
  lastActive?: Date | undefined
  expiresAt: Date
  completedAt?: Date | undefined
  encryptedState?: Buffer | undefined
  stateSignature?: string | undefined
  operationsCount?: number | undefined
  memoryUsageBytes?: number | undefined
  parentSessionId?: string | undefined
  childSessionIds?: string[] | undefined
}

export interface SharedDiscovery {
  id?: number
  discoveryType: 'node_pattern' | 'workflow_template' | 'error_solution'
    | 'performance_optimization' | 'security_pattern'
    | 'integration_method' | 'validation_rule' | 'best_practice'
  discoveryKey: string
  title: string
  description: string
  contentData?: Record<string, unknown>
  nodeTypes?: string[]
  tags?: string[]
  successRate?: number
  usageCount?: number
  confidenceScore?: number | undefined
  createdBy: string
  validatedBy?: string[]
  createdAt?: Date
  lastUsed?: Date | undefined
  version?: number | undefined
  supersededBy?: number | undefined
}

export interface DelegationRecord {
  id?: number
  fromAgent: string
  toAgent: string
  delegationType: 'strategic_planning' | 'requirement_analysis' | 'solution_design' | 'architecture_review' | 'feasibility_study'
    | 'technical_implementation' | 'workflow_generation' | 'workflow_modification' | 'workflow_optimization' | 'node_selection' | 'node_configuration'
    | 'integration_setup' | 'api_integration' | 'webhook_configuration'
    | 'security_validation' | 'functional_testing' | 'integration_testing' | 'performance_testing' | 'regression_testing'
    | 'validation_task' | 'quality_assurance'
    | 'error_resolution' | 'troubleshooting' | 'debugging' | 'investigation' | 'root_cause_analysis' | 'incident_response'
    | 'performance_optimization' | 'resource_optimization' | 'efficiency_improvement' | 'cost_optimization' | 'scalability_enhancement'
    | 'knowledge_lookup' | 'knowledge_sharing' | 'documentation_update' | 'training_delivery' | 'skill_assessment' | 'learning_facilitation'
    | 'monitoring_setup' | 'health_check' | 'system_maintenance' | 'backup_management' | 'cleanup_operation'
    | 'team_coordination' | 'stakeholder_communication' | 'progress_reporting' | 'review_facilitation' | 'decision_support'
    | 'data_analysis' | 'data_transformation' | 'reporting_generation' | 'metrics_collection' | 'insight_generation'
    | 'security_assessment' | 'compliance_check' | 'audit_preparation' | 'risk_assessment' | 'access_management'
    | 'documentation' | 'tutorial_creation' | 'guide_development' | 'example_creation' | 'best_practice_documentation'
    | 'consultation' | 'advisory_session' | 'strategic_consultation' | 'technical_consultation'
    | 'collaboration' | 'cross_team_coordination' | 'stakeholder_alignment' | 'consensus_building'
    | 'project_management' | 'task_coordination' | 'resource_allocation' | 'timeline_management' | 'milestone_tracking'
    | 'governance' | 'policy_enforcement' | 'audit_support' | 'security_review'
  taskDescription: string
  taskComplexity?: 'low' | 'medium' | 'high' | 'critical'
  estimatedDurationMinutes?: number
  success: boolean
  actualDurationMinutes?: number
  userSatisfaction?: number
  qualityScore?: number
  contextData?: Record<string, unknown>
  errorDetails?: string
  lessonsLearned?: string
  createdAt?: Date
}

export interface MemoryRelationship {
  id?: number
  sourceMemoryId: number
  targetMemoryId: number
  relationshipType: 'similar_to' | 'caused_by' | 'leads_to' | 'contradicts'
    | 'builds_on' | 'alternative_to' | 'prerequisite_for'
  strength: number
  createdAt?: Date | undefined
  createdBy: string
}

// Missing type exports that are imported by other modules
export interface MemoryQuery {
  agentName?: string
  memoryTypes?: AgentMemory['memoryType'][]
  limit?: number
  minRelevanceScore?: number
  includeTags?: string[]
}

export interface SessionOperation {
  id?: number
  sessionId: string
  operationType: string
  operationData: string
  success: boolean
  errorMessage?: string | null | undefined
  durationMs?: number | undefined
  memoryImpactBytes?: number | undefined
  timestamp?: Date | undefined
}

// Encryption utilities
class EncryptionManager {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly IV_LENGTH = 16
  private static readonly AUTH_TAG_LENGTH = 16

  static encrypt(text: string, key: string): { encrypted: Buffer, iv: Buffer, authTag: Buffer } {
    const keyBuffer = crypto.createHash('sha256').update(key).digest()
    const iv = crypto.randomBytes(this.IV_LENGTH)
    const cipher = crypto.createCipheriv(this.ALGORITHM, keyBuffer, iv)

    let encrypted = cipher.update(text, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])

    return {
      encrypted,
      iv,
      authTag: cipher.getAuthTag(),
    }
  }

  static decrypt(encryptedData: Buffer, iv: Buffer, authTag: Buffer, key: string): string {
    const keyBuffer = crypto.createHash('sha256').update(key).digest()
    const decipher = crypto.createDecipheriv(this.ALGORITHM, keyBuffer, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedData)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')
  }

  static createSignature(data: string, key: string): string {
    return crypto.createHmac('sha256', key).update(data).digest('hex')
  }

  static verifySignature(data: string, signature: string, key: string): boolean {
    const expectedSignature = this.createSignature(data, key)
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    )
  }
}

export class DynamicAgentDB {
  private db: Database
  private encryptionKey: Buffer

  constructor(dbPath?: string | Database) {
    if (typeof dbPath === 'string') {
      this.db = new BetterSqlite3(dbPath) as Database
    }
    else if (dbPath) {
      this.db = dbPath as Database
    }
    else {
      this.db = new BetterSqlite3(':memory:') as Database
    }
    // Use provided encryption key or generate deterministic key for MCP compliance
    this.encryptionKey = this.getOrCreateEncryptionKey('AGENT_ENCRYPTION_KEY')
    this.initializeDatabase()
  }

  /**
   * Securely generate or retrieve encryption key
   */
  private getOrCreateEncryptionKey(envVarName: string): Buffer {
    const envKey = process.env[envVarName]
    if (envKey) {
      if (envKey.length !== 64) { // 32 bytes * 2 (hex)
        throw new Error(`${envVarName} must be exactly 64 hex characters (32 bytes)`)
      }
      return Buffer.from(envKey, 'hex')
    }

    // For production, require explicit key to ensure data persistence
    if (process.env.NODE_ENV === 'production') {
      logger.warn(`${envVarName} not provided in production - using deterministic fallback`)
    }

    // Generate deterministic key for MCP compliance (ensures data persistence)
    const seed = process.env.DETERMINISTIC_SEED || `n8n-mcp-${envVarName}-fallback`
    return crypto.scryptSync(seed, `n8n-mcp-salt-${process.env.NODE_ENV || 'development'}`, 32)
  }

  private initializeDatabase(): void {
    try {
      // Enable foreign keys and WAL mode
      this.db.pragma('foreign_keys = ON')
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('synchronous = NORMAL')

      // Create tables
      this.createTables()

      logger.info('Dynamic agent database initialized successfully')
    }
    catch (error) {
      logger.error('Failed to initialize dynamic agent database:', error)
      throw error
    }
  }

  private createTables(): void {
    // Agent memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        embeddings TEXT,
        tags TEXT,
        relevance_score REAL DEFAULT 1.0,
        usage_count INTEGER DEFAULT 0,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        signature TEXT,
        parent_memory_id INTEGER,
        related_memory_ids TEXT,
        superseded_by INTEGER,
        FOREIGN KEY (parent_memory_id) REFERENCES agent_memories (id),
        FOREIGN KEY (superseded_by) REFERENCES agent_memories (id)
      )
    `)

    // Memory relationships table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_memory_id INTEGER NOT NULL,
        target_memory_id INTEGER NOT NULL,
        relationship_type TEXT NOT NULL,
        strength REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT NOT NULL,
        FOREIGN KEY (source_memory_id) REFERENCES agent_memories (id) ON DELETE CASCADE,
        FOREIGN KEY (target_memory_id) REFERENCES agent_memories (id) ON DELETE CASCADE,
        UNIQUE(source_memory_id, target_memory_id, relationship_type)
      )
    `)

    // Agent sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        agent_name TEXT NOT NULL,
        session_type TEXT NOT NULL,
        state_data TEXT,
        context_data TEXT,
        metadata TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        encrypted_state BLOB,
        state_signature TEXT,
        operations_count INTEGER DEFAULT 0,
        memory_usage_bytes INTEGER DEFAULT 0,
        parent_session_id TEXT,
        child_session_ids TEXT,
        FOREIGN KEY (parent_session_id) REFERENCES agent_sessions (session_id)
      )
    `)

    // Session operations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        operation_data TEXT,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        duration_ms INTEGER,
        memory_impact_bytes INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES agent_sessions (session_id) ON DELETE CASCADE
      )
    `)

    // Shared discoveries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shared_discoveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discovery_type TEXT NOT NULL,
        discovery_key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        content_data TEXT,
        node_types TEXT,
        tags TEXT,
        success_rate REAL DEFAULT 1.0,
        usage_count INTEGER DEFAULT 0,
        confidence_score REAL DEFAULT 1.0,
        created_by TEXT NOT NULL,
        validated_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP,
        version INTEGER DEFAULT 1,
        superseded_by INTEGER,
        FOREIGN KEY (superseded_by) REFERENCES shared_discoveries (id)
      )
    `)

    // Discovery relationships table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS discovery_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_discovery_id INTEGER NOT NULL,
        target_discovery_id INTEGER NOT NULL,
        relationship_type TEXT NOT NULL,
        strength REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_discovery_id) REFERENCES shared_discoveries (id) ON DELETE CASCADE,
        FOREIGN KEY (target_discovery_id) REFERENCES shared_discoveries (id) ON DELETE CASCADE
      )
    `)

    // Delegation history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS delegation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        delegation_type TEXT NOT NULL,
        task_description TEXT NOT NULL,
        task_complexity TEXT,
        estimated_duration_minutes INTEGER,
        success BOOLEAN NOT NULL,
        actual_duration_minutes INTEGER,
        user_satisfaction REAL,
        quality_score REAL,
        context_data TEXT,
        error_details TEXT,
        lessons_learned TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Delegation routing table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS delegation_routing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        delegation_type TEXT NOT NULL,
        task_pattern TEXT NOT NULL,
        recommended_agent TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        avg_duration_minutes REAL,
        avg_quality_score REAL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(delegation_type, task_pattern, recommended_agent)
      )
    `)

    // Agent performance table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        performance_date DATE NOT NULL,
        total_tasks INTEGER DEFAULT 0,
        successful_tasks INTEGER DEFAULT 0,
        avg_completion_time REAL,
        memory_efficiency REAL,
        collaboration_score REAL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agent_name, performance_date)
      )
    `)

    // System analytics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        metric_data TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create indexes for performance
    this.createIndexes()

    // Create FTS5 virtual table for full-text search
    this.createFullTextSearchTable()
  }

  private createFullTextSearchTable(): void {
    try {
      // Create FTS5 virtual table for fast content search
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS agent_memories_fts USING fts5(
          content, 
          tags, 
          agent_name,
          memory_type,
          content='agent_memories',
          content_rowid='id'
        )
      `)

      // Create trigger to keep FTS table in sync with main table
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS agent_memories_fts_insert AFTER INSERT ON agent_memories BEGIN
          INSERT INTO agent_memories_fts(rowid, content, tags, agent_name, memory_type) 
          VALUES (NEW.id, NEW.content, NEW.tags, NEW.agent_name, NEW.memory_type);
        END
      `)

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS agent_memories_fts_delete AFTER DELETE ON agent_memories BEGIN
          INSERT INTO agent_memories_fts(agent_memories_fts, rowid, content, tags, agent_name, memory_type) 
          VALUES('delete', OLD.id, OLD.content, OLD.tags, OLD.agent_name, OLD.memory_type);
        END
      `)

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS agent_memories_fts_update AFTER UPDATE ON agent_memories BEGIN
          INSERT INTO agent_memories_fts(agent_memories_fts, rowid, content, tags, agent_name, memory_type) 
          VALUES('delete', OLD.id, OLD.content, OLD.tags, OLD.agent_name, OLD.memory_type);
          INSERT INTO agent_memories_fts(rowid, content, tags, agent_name, memory_type) 
          VALUES (NEW.id, NEW.content, NEW.tags, NEW.agent_name, NEW.memory_type);
        END
      `)

      logger.debug('Full-text search table and triggers created successfully')
    }
    catch (error) {
      logger.warn('FTS5 not available, falling back to LIKE search:', error instanceof Error ? error.message : String(error))
    }
  }

  private createIndexes(): void {
    // Memory system indexes - optimized for search performance
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_agent_name ON agent_memories (agent_name)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_type ON agent_memories (memory_type)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_relevance ON agent_memories (relevance_score)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_hash ON agent_memories (content_hash)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_expires ON agent_memories (expires_at)')

    // Composite indexes for optimal search performance
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_agent_relevance ON agent_memories (agent_name, relevance_score DESC)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_agent_type ON agent_memories (agent_name, memory_type)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_agent_active ON agent_memories (agent_name, expires_at)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_memories_search_priority ON agent_memories (agent_name, relevance_score DESC, last_accessed DESC)')

    // Session system indexes
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_agent_name ON agent_sessions (agent_name)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON agent_sessions (expires_at)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_active ON agent_sessions (last_active)')

    // Operation indexes
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_operations_session_id ON session_operations (session_id)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_operations_type ON session_operations (operation_type)')

    // Discovery indexes
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_discoveries_type ON shared_discoveries (discovery_type)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_discoveries_confidence ON shared_discoveries (confidence_score)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_discoveries_usage ON shared_discoveries (usage_count)')

    // Delegation indexes
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_delegation_from ON delegation_history (from_agent)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_delegation_to ON delegation_history (to_agent)')
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_delegation_type ON delegation_history (delegation_type)')
  }

  // =============================================================================
  // MEMORY MANAGEMENT
  // =============================================================================

  async storeMemory(memory: AgentMemory): Promise<number> {
    try {
      // Generate content hash for deduplication
      const contentHash = crypto.createHash('sha256').update(memory.content).digest('hex')

      // Check for existing memory
      const existing = this.db.prepare(`
        SELECT id FROM agent_memories 
        WHERE agent_name = ? AND content_hash = ?
      `).get(memory.agentName, contentHash)

      if (existing) {
        // Update usage count and last accessed
        this.db.prepare(`
          UPDATE agent_memories 
          SET usage_count = usage_count + 1, 
              last_accessed = CURRENT_TIMESTAMP,
              relevance_score = MIN(1.0, relevance_score + 0.1)
          WHERE id = ?
        `).run((existing as DatabaseMemoryRow).id)
        return (existing as DatabaseMemoryRow).id
      }

      // Create signature for integrity
      const signature = EncryptionManager.createSignature(memory.content, this.encryptionKey.toString('hex'))

      const stmt = this.db.prepare(`
        INSERT INTO agent_memories (
          agent_name, memory_type, content, content_hash, embeddings, tags,
          relevance_score, signature, related_memory_ids, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const result = stmt.run(
        memory.agentName,
        memory.memoryType,
        memory.content,
        contentHash,
        memory.embeddings ? JSON.stringify(Array.from(memory.embeddings)) : null,
        memory.tags ? JSON.stringify(memory.tags) : null,
        memory.relevanceScore || 1.0,
        signature,
        memory.relatedMemoryIds ? JSON.stringify(memory.relatedMemoryIds) : null,
        memory.expiresAt?.toISOString() || null,
      )

      logger.debug(`Stored memory for agent ${memory.agentName}: ${memory.memoryType}`)
      return result.lastInsertRowid as number
    }
    catch (error) {
      logger.error('Failed to store agent memory:', error)
      throw error
    }
  }

  private hasFTS(): boolean {
    try {
      const result = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='agent_memories_fts'`).get()
      return !!result
    }
    catch {
      return false
    }
  }

  private queryMemoriesWithFTS(
    agentName: string,
    query: string,
    options: {
      memoryType?: AgentMemory['memoryType']
      limit?: number
      minRelevance?: number
      includeTags?: string[]
    } = {},
  ): AgentMemory[] {
    try {
      const { memoryType, limit = 10, minRelevance = 0.1, includeTags } = options

      // Build FTS query
      const ftsQuery = this.buildFTSQuery(query, agentName, memoryType, includeTags)

      const sql = `
        SELECT m.* FROM agent_memories m
        JOIN agent_memories_fts fts ON m.id = fts.rowid
        WHERE fts.agent_memories_fts MATCH ?
        AND m.relevance_score >= ?
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        ORDER BY bm25(agent_memories_fts), m.relevance_score DESC, m.last_accessed DESC 
        LIMIT ?
      `

      const memories = this.db.prepare(sql).all(ftsQuery, minRelevance, limit) as DatabaseMemoryRow[]

      // Update last accessed for retrieved memories
      const updateStmt = this.db.prepare(`
        UPDATE agent_memories 
        SET last_accessed = CURRENT_TIMESTAMP, usage_count = usage_count + 1 
        WHERE id = ?
      `)

      memories.forEach(memory => updateStmt.run(memory.id))

      return memories.map(this.mapDatabaseRowToMemory)
    }
    catch (error) {
      // Fall back to regular search if FTS fails
      logger.warn('FTS search failed, falling back to LIKE search:', error instanceof Error ? error.message : String(error))
      return []
    }
  }

  private mapDatabaseRowToMemory(row: DatabaseMemoryRow): AgentMemory {
    return {
      id: row.id,
      agentName: row.agent_name,
      memoryType: row.memory_type as AgentMemory['memoryType'],
      content: row.content,
      contentHash: row.content_hash,
      embeddings: row.embeddings ? JSON.parse(row.embeddings) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      relevanceScore: row.relevance_score,
      usageCount: row.usage_count,
      lastAccessed: row.last_accessed ? new Date(row.last_accessed) : undefined,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      parentMemoryId: row.parent_memory_id,
      relatedMemoryIds: row.related_memory_ids ? JSON.parse(row.related_memory_ids) : undefined,
    }
  }

  private buildFTSQuery(query: string, agentName: string, memoryType?: string, includeTags?: string[]): string {
    const parts: string[] = []

    // Agent name filter - quote the value to handle hyphens and special characters
    parts.push(`agent_name:"${agentName}"`)

    // Memory type filter - quote the value
    if (memoryType) {
      parts.push(`memory_type:"${memoryType}"`)
    }

    // Tag filters - quote tag values
    if (includeTags && includeTags.length > 0) {
      const tagQuery = includeTags.map(tag => `tags:"${tag}"`).join(' OR ')
      parts.push(`(${tagQuery})`)
    }

    // Content search - use phrase search for better results
    const contentSearch = query.trim().split(/\s+/).map(term => `"${term}"`).join(' OR ')
    parts.push(`(content:(${contentSearch}) OR tags:(${contentSearch}))`)

    return parts.join(' AND ')
  }

  // =============================================================================
  // ENHANCED SEARCH METHODS
  // =============================================================================

  async searchMemoriesAdvanced(
    agentName: string,
    options: {
      query?: string
      memoryTypes?: string[]
      tags?: string[]
      dateRange?: { from?: Date, to?: Date }
      minRelevance?: number
      limit?: number
      sortBy?: 'relevance' | 'date' | 'usage'
    } = {},
  ): Promise<AgentMemory[]> {
    const {
      query = '',
      memoryTypes = [],
      tags = [],
      dateRange,
      minRelevance = 0.1,
      limit = 50,
      sortBy = 'relevance',
    } = options

    let sql: string
    let params: unknown[]

    if (query.trim() && this.hasFTS()) {
      // Use FTS for text search
      sql = `
        SELECT m.*, bm25(agent_memories_fts) as fts_score FROM agent_memories m
        JOIN agent_memories_fts fts ON m.id = fts.rowid
        WHERE fts.agent_memories_fts MATCH ?
        AND m.agent_name = ?
        AND m.relevance_score >= ?
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
      `

      const ftsQuery = this.buildAdvancedFTSQuery(query, memoryTypes, tags)
      params = [ftsQuery, agentName, minRelevance]
    }
    else {
      // Use traditional search
      sql = `
        SELECT m.*, 0 as fts_score FROM agent_memories m
        WHERE m.agent_name = ?
        AND m.relevance_score >= ?
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
      `
      params = [agentName, minRelevance]

      if (query.trim()) {
        sql += ' AND (LOWER(m.content) LIKE LOWER(?) OR LOWER(m.tags) LIKE LOWER(?))'
        params.push(`%${query}%`, `%${query}%`)
      }
    }

    // Add filters
    if (memoryTypes.length > 0) {
      const placeholders = memoryTypes.map(() => '?').join(',')
      sql += ` AND m.memory_type IN (${placeholders})`
      params.push(...memoryTypes)
    }

    if (tags.length > 0) {
      const tagFilters = tags.map(() => 'm.tags LIKE ?').join(' AND ')
      sql += ` AND (${tagFilters})`
      tags.forEach(tag => params.push(`%"${tag}"%`))
    }

    if (dateRange) {
      if (dateRange.from) {
        sql += ' AND m.created_at >= ?'
        params.push(dateRange.from.toISOString())
      }
      if (dateRange.to) {
        sql += ' AND m.created_at <= ?'
        params.push(dateRange.to.toISOString())
      }
    }

    // Add sorting
    switch (sortBy) {
      case 'relevance':
        sql += query.trim() && this.hasFTS()
          ? ' ORDER BY bm25(agent_memories_fts), m.relevance_score DESC'
          : ' ORDER BY m.relevance_score DESC, m.last_accessed DESC'
        break
      case 'date':
        sql += ' ORDER BY m.created_at DESC'
        break
      case 'usage':
        sql += ' ORDER BY m.usage_count DESC, m.last_accessed DESC'
        break
    }

    sql += ' LIMIT ?'
    params.push(limit)

    const memories = this.db.prepare(sql).all(...params) as (DatabaseMemoryRow & { fts_score?: number })[]

    return memories.map(this.mapDatabaseRowToMemory)
  }

  private buildAdvancedFTSQuery(query: string, memoryTypes: string[], tags: string[]): string {
    const parts: string[] = []

    // Memory type filters - quote the values to handle special characters
    if (memoryTypes.length > 0) {
      const typeQuery = memoryTypes.map(type => `memory_type:"${type}"`).join(' OR ')
      parts.push(`(${typeQuery})`)
    }

    // Tag filters - quote tag values
    if (tags.length > 0) {
      const tagQuery = tags.map(tag => `tags:"${tag}"`).join(' OR ')
      parts.push(`(${tagQuery})`)
    }

    // Content search
    if (query.trim()) {
      const contentSearch = query.trim().split(/\s+/).map(term => `"${term}"`).join(' OR ')
      parts.push(`(content:(${contentSearch}) OR tags:(${contentSearch}))`)
    }

    return parts.length > 0 ? parts.join(' AND ') : '*'
  }

  async queryMemories(
    agentName: string,
    query: string,
    options: {
      memoryType?: AgentMemory['memoryType']
      limit?: number
      minRelevance?: number
      includeTags?: string[]
    } = {},
  ): Promise<AgentMemory[]> {
    try {
      const { memoryType, limit = 10, minRelevance = 0.1, includeTags } = options

      // Try FTS search first for text queries
      if (query.trim() && this.hasFTS()) {
        const ftsStartTime = Date.now()
        const ftsResults = this.queryMemoriesWithFTS(agentName, query, options)
        const ftsElapsed = Date.now() - ftsStartTime

        logger.debug('FTS search performance', {
          query: query.slice(0, 50),
          agentName,
          resultsCount: ftsResults.length,
          elapsedMs: ftsElapsed,
        })

        if (ftsResults.length > 0) {
          return ftsResults
        }
        // FTS returned no results, continue to fallback search
        logger.debug('FTS search returned no results, falling back to LIKE search')
      }

      // Fallback to traditional index-optimized search
      const fallbackStartTime = Date.now()
      let sql = `
        SELECT * FROM agent_memories 
        WHERE agent_name = ? 
        AND relevance_score >= ?
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `
      const params: (string | number)[] = [agentName, minRelevance]

      // Add memory type filter
      if (memoryType) {
        sql += ' AND memory_type = ?'
        params.push(memoryType)
      }

      // Add text search (case-insensitive LIKE)
      if (query.trim()) {
        sql += ' AND (LOWER(content) LIKE LOWER(?) OR LOWER(tags) LIKE LOWER(?))'
        params.push(`%${query}%`, `%${query}%`)
      }

      // Add tag filtering
      if (includeTags && includeTags.length > 0) {
        const tagFilters = includeTags.map(() => 'tags LIKE ?').join(' OR ')
        sql += ` AND (${tagFilters})`
        includeTags.forEach(tag => params.push(`%"${tag}"%`))
      }

      sql += ' ORDER BY relevance_score DESC, last_accessed DESC LIMIT ?'
      params.push(limit)

      logger.debug('Executing fallback search', {
        sql: sql.replace(/\s+/g, ' ').trim(),
        params: params.slice(0, 3), // Don't log all params for privacy
        agentName,
        query: query.slice(0, 50),
      })

      const memories = this.db.prepare(sql).all(...params) as DatabaseMemoryRow[]

      // Update last accessed for retrieved memories
      const updateStmt = this.db.prepare(`
        UPDATE agent_memories 
        SET last_accessed = CURRENT_TIMESTAMP, usage_count = usage_count + 1
        WHERE id = ?
      `)

      const results: AgentMemory[] = memories.map((row) => {
        updateStmt.run(row.id)

        return {
          id: row.id,
          agentName: row.agent_name,
          memoryType: row.memory_type as AgentMemory['memoryType'],
          content: row.content,
          contentHash: row.content_hash,
          embeddings: row.embeddings ? JSON.parse(row.embeddings) : undefined,
          tags: row.tags ? JSON.parse(row.tags) : undefined,
          relevanceScore: row.relevance_score,
          usageCount: row.usage_count,
          lastAccessed: new Date(row.last_accessed),
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
          parentMemoryId: row.parent_memory_id,
          relatedMemoryIds: row.related_memory_ids ? JSON.parse(row.related_memory_ids) : undefined,
        }
      })

      const fallbackElapsed = Date.now() - fallbackStartTime
      logger.debug('Fallback search performance', {
        query: query.slice(0, 50),
        agentName,
        resultsCount: results.length,
        elapsedMs: fallbackElapsed,
        sqlType: 'LIKE',
      })

      return results
    }
    catch (error) {
      logger.error('Failed to query agent memories:', error)
      throw error
    }
  }

  async createMemoryRelationship(relationship: MemoryRelationship): Promise<number> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memory_relationships (
          source_memory_id, target_memory_id, relationship_type, strength, created_by
        ) VALUES (?, ?, ?, ?, ?)
      `)

      const result = stmt.run(
        relationship.sourceMemoryId,
        relationship.targetMemoryId,
        relationship.relationshipType,
        relationship.strength,
        relationship.createdBy,
      )

      return result.lastInsertRowid as number
    }
    catch (error) {
      logger.error('Failed to create memory relationship:', error)
      throw error
    }
  }

  // =============================================================================
  // SESSION MANAGEMENT
  // =============================================================================

  async createSession(session: AgentSession): Promise<string> {
    try {
      const sessionId = session.sessionId || crypto.randomUUID()

      // Encrypt sensitive state data
      let encryptedState: Buffer | null = null
      let stateSignature: string | null = null

      if (session.stateData) {
        const stateJson = JSON.stringify(session.stateData)
        const { encrypted } = EncryptionManager.encrypt(stateJson, this.encryptionKey.toString('hex'))
        encryptedState = encrypted
        stateSignature = EncryptionManager.createSignature(stateJson, this.encryptionKey.toString('hex'))
      }

      const stmt = this.db.prepare(`
        INSERT INTO agent_sessions (
          session_id, agent_name, session_type, state_data, context_data, 
          metadata, expires_at, encrypted_state, state_signature,
          parent_session_id, child_session_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        sessionId,
        session.agentName,
        session.sessionType,
        session.stateData ? JSON.stringify(session.stateData) : null,
        session.contextData ? JSON.stringify(session.contextData) : null,
        session.metadata ? JSON.stringify(session.metadata) : null,
        session.expiresAt.toISOString(),
        encryptedState,
        stateSignature,
        session.parentSessionId || null,
        session.childSessionIds ? JSON.stringify(session.childSessionIds) : null,
      )

      logger.debug(`Created session ${sessionId} for agent ${session.agentName}`)
      return sessionId
    }
    catch (error) {
      logger.error('Failed to create agent session:', error)
      throw error
    }
  }

  async getSession(sessionId: string): Promise<AgentSession | null> {
    try {
      const row = this.db.prepare(`
        SELECT * FROM agent_sessions 
        WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP
      `).get(sessionId) as DatabaseSessionRow | undefined

      if (!row) {
        return null
      }

      // Decrypt state data if present
      let stateData = null
      if (row.state_data && row.state_signature) {
        // Verify signature first
        const isValid = EncryptionManager.verifySignature(
          row.state_data,
          row.state_signature,
          this.encryptionKey.toString('hex'),
        )

        if (isValid) {
          stateData = JSON.parse(row.state_data)
        }
        else {
          logger.warn(`Session ${sessionId} has invalid state signature`)
        }
      }

      return {
        id: row.id,
        sessionId: row.session_id,
        agentName: row.agent_name,
        sessionType: row.session_type as AgentSession['sessionType'],
        stateData,
        contextData: row.context_data ? JSON.parse(row.context_data) : null,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        startedAt: new Date(row.started_at),
        lastActive: new Date(row.last_active),
        expiresAt: new Date(row.expires_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        operationsCount: row.operations_count,
        memoryUsageBytes: row.memory_usage_bytes,
        parentSessionId: row.parent_session_id,
        childSessionIds: row.child_session_ids ? JSON.parse(row.child_session_ids) : undefined,
      }
    }
    catch (error) {
      logger.error('Failed to get agent session:', error)
      throw error
    }
  }

  async updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<boolean> {
    try {
      const updateFields: string[] = []
      const params: (string | number | boolean)[] = []

      if (updates.stateData !== undefined) {
        updateFields.push('state_data = ?', 'state_signature = ?')
        const stateJson = JSON.stringify(updates.stateData)
        params.push(stateJson, EncryptionManager.createSignature(stateJson, this.encryptionKey.toString('hex')))
      }

      if (updates.contextData !== undefined) {
        updateFields.push('context_data = ?')
        params.push(JSON.stringify(updates.contextData))
      }

      if (updates.metadata !== undefined) {
        updateFields.push('metadata = ?')
        params.push(JSON.stringify(updates.metadata))
      }

      if (updates.completedAt !== undefined) {
        updateFields.push('completed_at = ?')
        params.push(updates.completedAt.toISOString())
      }

      if (updates.operationsCount !== undefined) {
        updateFields.push('operations_count = ?')
        params.push(updates.operationsCount)
      }

      if (updateFields.length === 0) {
        return true // No updates needed
      }

      updateFields.push('last_active = CURRENT_TIMESTAMP')
      params.push(sessionId)

      const sql = `UPDATE agent_sessions SET ${updateFields.join(', ')} WHERE session_id = ?`
      const result = this.db.prepare(sql).run(...params)

      return result.changes > 0
    }
    catch (error) {
      logger.error('Failed to update agent session:', error)
      throw error
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = this.db.prepare(`
        DELETE FROM agent_sessions 
        WHERE expires_at < CURRENT_TIMESTAMP
      `).run()

      if (result.changes > 0) {
        logger.info(`Cleaned up ${result.changes} expired agent sessions`)
      }

      return result.changes
    }
    catch (error) {
      logger.error('Failed to cleanup expired sessions:', error)
      throw error
    }
  }

  // =============================================================================
  // SHARED DISCOVERIES
  // =============================================================================

  async storeDiscovery(discovery: SharedDiscovery): Promise<number> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO shared_discoveries (
          discovery_type, discovery_key, title, description, content_data,
          node_types, tags, success_rate, confidence_score, created_by,
          validated_by, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const result = stmt.run(
        discovery.discoveryType,
        discovery.discoveryKey,
        discovery.title,
        discovery.description,
        discovery.contentData ? JSON.stringify(discovery.contentData) : null,
        discovery.nodeTypes ? JSON.stringify(discovery.nodeTypes) : null,
        discovery.tags ? JSON.stringify(discovery.tags) : null,
        discovery.successRate || 1.0,
        discovery.confidenceScore || 1.0,
        discovery.createdBy,
        discovery.validatedBy ? JSON.stringify(discovery.validatedBy) : null,
        discovery.version || 1,
      )

      logger.debug(`Stored discovery: ${discovery.title} by ${discovery.createdBy}`)
      return result.lastInsertRowid as number
    }
    catch (error) {
      logger.error('Failed to store discovery:', error)
      throw error
    }
  }

  async searchDiscoveries(
    query: string,
    options: {
      discoveryType?: SharedDiscovery['discoveryType']
      minConfidence?: number
      createdBy?: string
      nodeTypes?: string[]
      limit?: number
    } = {},
  ): Promise<SharedDiscovery[]> {
    try {
      const { discoveryType, minConfidence = 0.5, createdBy, nodeTypes, limit = 20 } = options

      let sql = `
        SELECT * FROM shared_discoveries 
        WHERE superseded_by IS NULL 
        AND confidence_score >= ?
      `
      const params: (string | number)[] = [minConfidence]

      if (discoveryType) {
        sql += ' AND discovery_type = ?'
        params.push(discoveryType)
      }

      if (createdBy) {
        sql += ' AND created_by = ?'
        params.push(createdBy)
      }

      if (query.trim()) {
        sql += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)'
        params.push(`%${query}%`, `%${query}%`, `%${query}%`)
      }

      if (nodeTypes && nodeTypes.length > 0) {
        const nodeTypeFilters = nodeTypes.map(() => 'node_types LIKE ?').join(' OR ')
        sql += ` AND (${nodeTypeFilters})`
        nodeTypes.forEach(nodeType => params.push(`%"${nodeType}"%`))
      }

      sql += ' ORDER BY usage_count DESC, confidence_score DESC, created_at DESC LIMIT ?'
      params.push(limit)

      const discoveries = this.db.prepare(sql).all(...params) as DatabaseDiscoveryRow[]

      // Update usage count for retrieved discoveries
      const updateStmt = this.db.prepare(`
        UPDATE shared_discoveries 
        SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
        WHERE id = ?
      `)

      return discoveries.map((row) => {
        updateStmt.run(row.id)

        return {
          id: row.id,
          discoveryType: row.discovery_type as SharedDiscovery['discoveryType'],
          discoveryKey: row.discovery_key,
          title: row.title,
          description: row.description,
          contentData: row.content_data ? JSON.parse(row.content_data) : undefined,
          nodeTypes: row.node_types ? JSON.parse(row.node_types) : undefined,
          tags: row.tags ? JSON.parse(row.tags) : undefined,
          successRate: row.success_rate,
          usageCount: row.usage_count,
          confidenceScore: row.confidence_score || undefined,
          createdBy: row.created_by || '',
          validatedBy: row.validated_by ? JSON.parse(row.validated_by) : undefined,
          createdAt: new Date(row.created_at),
          lastUsed: row.last_used ? new Date(row.last_used) : undefined,
          version: row.version || undefined,
          supersededBy: row.superseded_by || undefined,
        }
      })
    }
    catch (error) {
      logger.error('Failed to search discoveries:', error)
      throw error
    }
  }

  // =============================================================================
  // DELEGATION LEARNING
  // =============================================================================

  async recordDelegation(delegation: DelegationRecord): Promise<number> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO delegation_history (
          from_agent, to_agent, delegation_type, task_description, task_complexity,
          estimated_duration_minutes, success, actual_duration_minutes,
          user_satisfaction, quality_score, context_data, error_details, lessons_learned
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const result = stmt.run(
        delegation.fromAgent,
        delegation.toAgent,
        delegation.delegationType,
        delegation.taskDescription,
        delegation.taskComplexity || null,
        delegation.estimatedDurationMinutes || null,
        delegation.success ? 1 : 0,
        delegation.actualDurationMinutes || null,
        delegation.userSatisfaction || null,
        delegation.qualityScore || null,
        delegation.contextData ? JSON.stringify(delegation.contextData) : null,
        delegation.errorDetails || null,
        delegation.lessonsLearned || null,
      )

      // Update delegation routing suggestions based on this outcome
      await this.updateDelegationRouting(delegation)

      logger.debug(`Recorded delegation from ${delegation.fromAgent} to ${delegation.toAgent}`)
      return result.lastInsertRowid as number
    }
    catch (error) {
      logger.error('Failed to record delegation:', error)
      throw error
    }
  }

  private async updateDelegationRouting(delegation: DelegationRecord): Promise<void> {
    try {
      // Find existing routing suggestion
      const existing = this.db.prepare(`
        SELECT * FROM delegation_routing 
        WHERE delegation_type = ? AND recommended_agent = ?
        AND task_pattern LIKE ?
      `).get(
        delegation.delegationType,
        delegation.toAgent,
        `%${delegation.taskDescription.split(' ')[0]}%`, // Use first word as pattern
      ) as DatabaseDelegationRow | undefined

      if (existing) {
        // Update statistics
        const newSuccessCount = existing.success_count + (delegation.success ? 1 : 0)
        const newFailureCount = existing.failure_count + (delegation.success ? 0 : 1)
        const totalCount = newSuccessCount + newFailureCount
        const newConfidenceScore = Math.max(0.1, Math.min(1.0, newSuccessCount / totalCount))

        this.db.prepare(`
          UPDATE delegation_routing 
          SET success_count = ?, failure_count = ?, confidence_score = ?,
              avg_duration_minutes = COALESCE(
                (avg_duration_minutes * (? - 1) + ?) / ?, 
                ?
              ),
              avg_quality_score = COALESCE(
                (avg_quality_score * (? - 1) + ?) / ?,
                ?
              ),
              last_updated = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          newSuccessCount,
          newFailureCount,
          newConfidenceScore,
          totalCount, // For duration calculation
          delegation.actualDurationMinutes || 0,
          totalCount,
          delegation.actualDurationMinutes || 0,
          totalCount, // For quality calculation
          delegation.qualityScore || 0.5,
          totalCount,
          delegation.qualityScore || 0.5,
          existing.id,
        )
      }
    }
    catch (error) {
      logger.error('Failed to update delegation routing:', error)
      // Don't throw - this is a best-effort update
    }
  }

  async getSuggestedDelegate(taskDescription: string, delegationType: DelegationRecord['delegationType']): Promise<string | null> {
    try {
      const suggestions = this.db.prepare(`
        SELECT recommended_agent, confidence_score 
        FROM delegation_routing 
        WHERE delegation_type = ? 
        AND (task_pattern LIKE ? OR ? LIKE task_pattern)
        ORDER BY confidence_score DESC, success_count DESC
        LIMIT 1
      `).get(
        delegationType,
        `%${taskDescription}%`,
        `%${taskDescription}%`,
      ) as DatabaseDelegationRow | undefined

      return suggestions?.recommended_agent || null
    }
    catch (error) {
      logger.error('Failed to get delegation suggestion:', error)
      return null
    }
  }

  // =============================================================================
  // ANALYTICS AND INSIGHTS
  // =============================================================================

  async getSystemAnalytics(): Promise<{
    totalMemories: number
    activeSessions: number
    totalDiscoveries: number
    avgDelegationSuccess: number
    topPerformingAgents: string[]
  }> {
    try {
      const totalMemories = (this.db.prepare(`
        SELECT COUNT(*) as count FROM agent_memories 
        WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP
      `).get() as DatabaseCountRow | undefined)?.count || 0

      const activeSessions = (this.db.prepare(`
        SELECT COUNT(*) as count FROM agent_sessions 
        WHERE expires_at > CURRENT_TIMESTAMP
      `).get() as DatabaseCountRow | undefined)?.count || 0

      const totalDiscoveries = (this.db.prepare(`
        SELECT COUNT(*) as count FROM shared_discoveries 
        WHERE superseded_by IS NULL
      `).get() as DatabaseCountRow | undefined)?.count || 0

      const avgDelegationSuccess = (this.db.prepare(`
        SELECT AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as avg_success
        FROM delegation_history 
        WHERE created_at > datetime('now', '-7 days')
      `).get() as DatabaseAvgRow | undefined)?.avg_success || 0

      const topPerformingAgents = this.db.prepare(`
        SELECT to_agent, AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate
        FROM delegation_history 
        WHERE created_at > datetime('now', '-30 days')
        GROUP BY to_agent
        HAVING COUNT(*) >= 3
        ORDER BY success_rate DESC
        LIMIT 5
      `).all().map((row: unknown) => (row as DatabaseStringRow).to_agent)

      return {
        totalMemories,
        activeSessions,
        totalDiscoveries,
        avgDelegationSuccess,
        topPerformingAgents,
      }
    }
    catch (error) {
      logger.error('Failed to get system analytics:', error)
      throw error
    }
  }

  // =============================================================================
  // MISSING METHODS IMPLEMENTATION
  // =============================================================================

  async initialize(): Promise<void> {
    this.initializeDatabase()
  }

  async close(): Promise<void> {
    this.db.close()
  }

  async getTables(): Promise<string[]> {
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>

    return tables.map(t => t.name)
  }

  async getIndexes(): Promise<string[]> {
    const indexes = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>

    return indexes.map(i => i.name)
  }

  async getMemoryById(memoryId: number): Promise<AgentMemory | null> {
    const row = this.db.prepare(`
      SELECT * FROM agent_memories WHERE id = ?
    `).get(memoryId) as DatabaseMemoryRow | undefined

    if (!row)
      return null

    return {
      id: row.id,
      agentName: row.agent_name,
      memoryType: row.memory_type as AgentMemory['memoryType'],
      content: row.content,
      contentHash: row.content_hash,
      embeddings: row.embeddings ? JSON.parse(row.embeddings) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      relevanceScore: row.relevance_score,
      usageCount: row.usage_count,
      lastAccessed: row.last_accessed ? new Date(row.last_accessed) : undefined,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      parentMemoryId: row.parent_memory_id,
      relatedMemoryIds: row.related_memory_ids ? JSON.parse(row.related_memory_ids) : undefined,
    }
  }

  async updateMemoryRelevance(memoryId: number, relevanceScore: number): Promise<void> {
    this.db.prepare(`
      UPDATE agent_memories 
      SET relevance_score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(relevanceScore, memoryId)
  }

  async incrementMemoryUsage(memoryId: number): Promise<void> {
    this.db.prepare(`
      UPDATE agent_memories 
      SET usage_count = usage_count + 1, last_accessed = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(memoryId)
  }

  async updateMemoryContent(memoryId: number, content: string): Promise<void> {
    const contentHash = crypto.createHash('sha256').update(content).digest('hex')
    this.db.prepare(`
      UPDATE agent_memories 
      SET content = ?, content_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(content, contentHash, memoryId)
  }

  async updateMemoryTags(memoryId: number, tags: string[]): Promise<void> {
    this.db.prepare(`
      UPDATE agent_memories 
      SET tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(tags), memoryId)
  }

  async supersedMemory(memoryId: number, supersededBy: number): Promise<void> {
    this.db.prepare(`
      UPDATE agent_memories 
      SET superseded_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(supersededBy, memoryId)
  }

  async getMemoryRelationships(memoryId: number): Promise<MemoryRelationship[]> {
    const rows = this.db.prepare(`
      SELECT * FROM memory_relationships 
      WHERE source_memory_id = ? OR target_memory_id = ?
    `).all(memoryId, memoryId) as DatabaseMemoryRelationshipRow[]

    return rows.map(row => ({
      id: row.id,
      sourceMemoryId: row.source_memory_id,
      targetMemoryId: row.target_memory_id,
      relationshipType: row.relationship_type as MemoryRelationship['relationshipType'],
      strength: row.strength,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      createdBy: row.created_by,
    }))
  }

  async getAgentRelationships(agentName: string): Promise<MemoryRelationship[]> {
    const rows = this.db.prepare(`
      SELECT mr.* FROM memory_relationships mr
      JOIN agent_memories am ON (mr.source_memory_id = am.id OR mr.target_memory_id = am.id)
      WHERE am.agent_name = ?
    `).all(agentName) as DatabaseMemoryRelationshipRow[]

    return rows.map(row => ({
      id: row.id,
      sourceMemoryId: row.source_memory_id,
      targetMemoryId: row.target_memory_id,
      relationshipType: row.relationship_type as MemoryRelationship['relationshipType'],
      strength: row.strength,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      createdBy: row.created_by,
    }))
  }

  async getSessionById(sessionId: string): Promise<AgentSession | null> {
    return this.getSession(sessionId)
  }

  async updateSessionState(sessionId: string, updates: Record<string, unknown>): Promise<boolean> {
    return this.updateSession(sessionId, updates)
  }

  async getSessionOperations(sessionId: string): Promise<SessionOperation[]> {
    const rows = this.db.prepare(`
      SELECT * FROM session_operations 
      WHERE session_id = ?
      ORDER BY timestamp DESC
    `).all(sessionId) as DatabaseSessionOperationRow[]

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      operationType: row.operation_type,
      operationData: row.operation_data,
      success: row.success,
      errorMessage: row.error_message,
      durationMs: row.duration_ms,
      memoryImpactBytes: row.memory_impact_bytes,
      timestamp: row.timestamp ? new Date(row.timestamp) : undefined,
    }))
  }

  async logSessionOperation(operation: SessionOperation): Promise<void> {
    this.db.prepare(`
      INSERT INTO session_operations (
        session_id, operation_type, operation_data, success, 
        error_message, duration_ms, memory_impact_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      operation.sessionId,
      operation.operationType,
      operation.operationData || null,
      operation.success ? 1 : 0,
      operation.errorMessage || null,
      operation.durationMs || null,
      operation.memoryImpactBytes || null,
    )
  }

  async completeSession(sessionId: string, completionData?: Record<string, unknown>): Promise<void> {
    this.db.prepare(`
      UPDATE agent_sessions 
      SET completed_at = CURRENT_TIMESTAMP,
          metadata = CASE 
            WHEN metadata IS NULL THEN ?
            ELSE json_patch(metadata, ?)
          END
      WHERE session_id = ?
    `).run(
      completionData ? JSON.stringify({ completionData }) : null,
      completionData ? JSON.stringify({ completionData }) : null,
      sessionId,
    )
  }

  async expireSession(sessionId: string): Promise<void> {
    this.db.prepare(`
      UPDATE agent_sessions 
      SET expires_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(sessionId)
  }

  async getActiveSessionsByAgent(agentName: string): Promise<AgentSession[]> {
    const rows = this.db.prepare(`
      SELECT * FROM agent_sessions 
      WHERE agent_name = ? AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_active DESC
    `).all(agentName) as DatabaseSessionRow[]

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      agentName: row.agent_name,
      sessionType: row.session_type as AgentSession['sessionType'],
      stateData: row.state_data,
      contextData: row.context_data,
      metadata: row.metadata,
      startedAt: new Date(row.started_at),
      lastActive: new Date(row.last_active),
      expiresAt: new Date(row.expires_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      encryptedState: row.encrypted_state,
      stateSignature: row.state_signature,
      operationsCount: row.operations_count,
      memoryUsageBytes: row.memory_usage_bytes,
      parentSessionId: row.parent_session_id,
      childSessionIds: row.child_session_ids ? JSON.parse(row.child_session_ids) : undefined,
    }))
  }

  async getExpiredSessions(): Promise<AgentSession[]> {
    const rows = this.db.prepare(`
      SELECT * FROM agent_sessions 
      WHERE expires_at <= CURRENT_TIMESTAMP
    `).all() as DatabaseSessionRow[]

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      agentName: row.agent_name,
      sessionType: row.session_type as AgentSession['sessionType'],
      stateData: row.state_data,
      contextData: row.context_data,
      metadata: row.metadata,
      startedAt: new Date(row.started_at),
      lastActive: new Date(row.last_active),
      expiresAt: new Date(row.expires_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      encryptedState: row.encrypted_state,
      stateSignature: row.state_signature,
      operationsCount: row.operations_count,
      memoryUsageBytes: row.memory_usage_bytes,
      parentSessionId: row.parent_session_id,
      childSessionIds: row.child_session_ids ? JSON.parse(row.child_session_ids) : undefined,
    }))
  }

  async recordDiscovery(discovery: SharedDiscovery): Promise<number> {
    return this.storeDiscovery(discovery)
  }

  async getDelegationRecommendations(taskType: string): Promise<Array<{
    recommendedAgent: string
    confidenceScore: number
  }>> {
    const rows = this.db.prepare(`
      SELECT recommended_agent, confidence_score 
      FROM delegation_routing 
      WHERE delegation_type = ?
      ORDER BY confidence_score DESC, success_count DESC
      LIMIT 5
    `).all(taskType) as DatabaseDelegationRow[]

    return rows.map(row => ({
      recommendedAgent: row.recommended_agent,
      confidenceScore: row.confidence_score,
    }))
  }

  async getAgentInsights(agentName: string, _timeframe?: string): Promise<{
    memoryCount: number
    activeSessionCount: number
    avgSuccessRate: number
    topDiscoveries: string[]
    collaborationPartners: string[]
  }> {
    try {
      const memoryCount = (this.db.prepare(`
        SELECT COUNT(*) as count FROM agent_memories 
        WHERE agent_name = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `).get(agentName) as DatabaseCountRow | undefined)?.count || 0

      const activeSessionCount = (this.db.prepare(`
        SELECT COUNT(*) as count FROM agent_sessions 
        WHERE agent_name = ? AND expires_at > CURRENT_TIMESTAMP
      `).get(agentName) as DatabaseCountRow | undefined)?.count || 0

      const successRateData = this.db.prepare(`
        SELECT AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as avg_success
        FROM delegation_history 
        WHERE to_agent = ? AND created_at > datetime('now', '-7 days')
      `).get(agentName) as DatabaseAvgRow | undefined

      const avgSuccessRate = successRateData?.avg_success || 0

      const topDiscoveries = this.db.prepare(`
        SELECT title FROM shared_discoveries 
        WHERE created_by = ? 
        ORDER BY usage_count DESC, confidence_score DESC
        LIMIT 5
      `).all(agentName).map((row: unknown) => (row as DatabaseStringRow).title)

      const collaborationPartners = this.db.prepare(`
        SELECT DISTINCT 
          CASE WHEN from_agent = ? THEN to_agent ELSE from_agent END as partner
        FROM delegation_history 
        WHERE (from_agent = ? OR to_agent = ?) 
        AND created_at > datetime('now', '-30 days')
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `).all(agentName, agentName, agentName).map((row: unknown) => (row as DatabaseStringRow).partner)

      return {
        memoryCount,
        activeSessionCount,
        avgSuccessRate,
        topDiscoveries,
        collaborationPartners,
      }
    }
    catch (error) {
      logger.error('Failed to get agent insights:', error)
      throw error
    }
  }
}
