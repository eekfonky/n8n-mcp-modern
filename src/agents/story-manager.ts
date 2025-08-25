/**
 * Story File Manager - Database and Management Layer
 *
 * Provides persistence and management for BMAD-METHOD story files,
 * implementing the StoryFileOperations interface with SQLite backing.
 */

import type {
  DecisionRecord,
  StoryFile,
  StoryFileOperations,
  StoryMetrics,
  WorkflowPhase,
} from './story-files.js'
import process from 'node:process'
import { database } from '../database/index.js'
import { logger } from '../server/logger.js'
import { N8NMcpError } from '../types/index.js'
import {
  HandoverValidator,
  StoryFileFactory,
  StoryFileSchema,
  StoryMetricsCollector,
  StoryStatus,
} from './story-files.js'

// === Database Schema Extension ===

const STORY_SCHEMA = `
  -- Main story files table
  CREATE TABLE IF NOT EXISTS story_files (
    id TEXT PRIMARY KEY,
    version INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Workflow tracking
    phase TEXT NOT NULL,
    status TEXT NOT NULL,
    
    -- Agent information
    current_agent TEXT NOT NULL,
    previous_agents TEXT, -- JSON array
    next_agent TEXT,
    
    -- Context (stored as JSON)
    context_original TEXT NOT NULL,
    context_current TEXT NOT NULL,
    context_technical TEXT,
    
    -- Work tracking (JSON arrays)
    completed_work TEXT,
    pending_work TEXT,
    blockers TEXT,
    
    -- Handover details
    handover_notes TEXT,
    acceptance_criteria TEXT, -- JSON array
    rollback_plan TEXT,
    
    -- Metadata
    ttl INTEGER,
    priority INTEGER DEFAULT 5,
    tags TEXT, -- JSON array
    related_stories TEXT -- JSON array
  );
  
  -- Decision records table
  CREATE TABLE IF NOT EXISTS story_decisions (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    description TEXT NOT NULL,
    rationale TEXT NOT NULL,
    alternatives TEXT, -- JSON array
    impact TEXT NOT NULL,
    reversible INTEGER DEFAULT 1, -- boolean
    dependencies TEXT, -- JSON array
    outcome TEXT, -- JSON object
    
    FOREIGN KEY (story_id) REFERENCES story_files(id) ON DELETE CASCADE
  );
  
  -- Audit trail table
  CREATE TABLE IF NOT EXISTS story_audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT, -- JSON object
    
    FOREIGN KEY (story_id) REFERENCES story_files(id) ON DELETE CASCADE
  );
  
  -- Performance indexes
  CREATE INDEX IF NOT EXISTS idx_story_phase ON story_files(phase);
  CREATE INDEX IF NOT EXISTS idx_story_status ON story_files(status);
  CREATE INDEX IF NOT EXISTS idx_story_agent ON story_files(current_agent);
  CREATE INDEX IF NOT EXISTS idx_story_updated ON story_files(updated_at);
  CREATE INDEX IF NOT EXISTS idx_story_priority ON story_files(priority DESC);
  CREATE INDEX IF NOT EXISTS idx_decision_story ON story_decisions(story_id);
  CREATE INDEX IF NOT EXISTS idx_decision_timestamp ON story_decisions(timestamp);
  CREATE INDEX IF NOT EXISTS idx_audit_story ON story_audit_trail(story_id);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON story_audit_trail(timestamp);
`

// === Database Interface Types ===

interface DatabaseRow {
  [key: string]: string | number | null
}

// === Story File Manager Implementation ===

export class StoryFileManager implements StoryFileOperations {
  private initialized = false
  private cleanupInterval: NodeJS.Timeout | undefined = undefined

  constructor() {
    // Initialize cleanup job
    this.startCleanupJob()
  }

  /**
   * Initialize story file database schema
   */
  async initialize(): Promise<void> {
    if (this.initialized)
      return

    try {
      // Execute schema creation
      await database.initialize()

      // Add story-specific schema if database is available
      if (database.isReady()) {
        // Use the database's type-safe custom SQL execution
        database.executeCustomSQL('initialize-story-schema', (db) => {
          db.exec(STORY_SCHEMA)
          logger.info('Story file database schema initialized')
          return true
        })
      }

      this.initialized = true
    }
    catch (error) {
      logger.error('Failed to initialize story file database:', error)
      throw new N8NMcpError(
        'Story file database initialization failed',
        'STORY_DB_INIT_ERROR',
        500,
        { error: error instanceof Error ? error.message : String(error) },
      )
    }
  }

  // === CRUD Operations ===

  async create(initial: Partial<StoryFile>): Promise<StoryFile> {
    await this.ensureInitialized()

    const story = initial.id
      ? { ...StoryFileFactory.create({ agentName: initial.currentAgent ?? 'unknown', context: initial.context?.current ?? {} }), ...initial }
      : { ...StoryFileFactory.create({ agentName: initial.currentAgent ?? 'unknown', context: initial.context?.current ?? {} }), ...initial }

    // Validate the story file
    const validated = StoryFileSchema.parse(story)

    try {
      // Use type-safe database access
      const insertResult = database.executeCustomSQL('create-story-file', (db) => {
        const stmt = db.prepare(`
          INSERT INTO story_files (
            id, version, created_at, updated_at, phase, status,
            current_agent, previous_agents, next_agent,
            context_original, context_current, context_technical,
            completed_work, pending_work, blockers,
            handover_notes, acceptance_criteria, rollback_plan,
            ttl, priority, tags, related_stories
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?
          )
        `)

        return stmt.run(
          validated.id,
          validated.version,
          validated.createdAt,
          validated.updatedAt,
          validated.phase,
          validated.status,
          validated.currentAgent,
          JSON.stringify(validated.previousAgents),
          validated.nextAgent ?? null,
          JSON.stringify(validated.context.original),
          JSON.stringify(validated.context.current),
          JSON.stringify(validated.context.technical),
          JSON.stringify(validated.completedWork),
          JSON.stringify(validated.pendingWork),
          validated.blockers ? JSON.stringify(validated.blockers) : null,
          validated.handoverNotes,
          validated.acceptanceCriteria ? JSON.stringify(validated.acceptanceCriteria) : null,
          validated.rollbackPlan ?? null,
          validated.ttl ?? null,
          validated.priority ?? 5,
          validated.tags ? JSON.stringify(validated.tags) : null,
          validated.relatedStories ? JSON.stringify(validated.relatedStories) : null,
        )
      })
      
      if (!insertResult) {
        throw new Error('Database not available')
      }

      // Add initial audit trail entry
      await this.addAuditEntry(validated.id, validated.currentAgent, 'created', { initial })

      logger.debug(`Created story file: ${validated.id}`)
      return validated
    }
    catch (error) {
      logger.error('Failed to create story file:', error)
      throw new N8NMcpError(
        'Failed to create story file',
        'STORY_CREATE_ERROR',
        500,
        { error: error instanceof Error ? error.message : String(error) },
      )
    }
  }

  async update(id: string, updates: Partial<StoryFile>): Promise<StoryFile> {
    await this.ensureInitialized()

    const existing = await this.retrieve(id)
    if (!existing) {
      throw new N8NMcpError('Story file not found', 'STORY_NOT_FOUND', 404, { id })
    }

    const updated: StoryFile = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID changes
      version: existing.version + 1,
      updatedAt: Date.now(),
    }

    // Validate the updated story
    const validated = StoryFileSchema.parse(updated)

    try {
      // Use type-safe database access
      const updateResult = database.executeCustomSQL('update-story-file', (db) => {
        const stmt = db.prepare(`
          UPDATE story_files SET
            version = ?, updated_at = ?, phase = ?, status = ?,
            current_agent = ?, previous_agents = ?, next_agent = ?,
            context_original = ?, context_current = ?, context_technical = ?,
            completed_work = ?, pending_work = ?, blockers = ?,
            handover_notes = ?, acceptance_criteria = ?, rollback_plan = ?,
            ttl = ?, priority = ?, tags = ?, related_stories = ?
          WHERE id = ?
        `)

        return stmt.run(
          validated.version,
          validated.updatedAt,
          validated.phase,
          validated.status,
          validated.currentAgent,
          JSON.stringify(validated.previousAgents),
          validated.nextAgent ?? null,
          JSON.stringify(validated.context.original),
          JSON.stringify(validated.context.current),
          JSON.stringify(validated.context.technical),
          JSON.stringify(validated.completedWork),
          JSON.stringify(validated.pendingWork),
          validated.blockers ? JSON.stringify(validated.blockers) : null,
          validated.handoverNotes,
          validated.acceptanceCriteria ? JSON.stringify(validated.acceptanceCriteria) : null,
          validated.rollbackPlan ?? null,
          validated.ttl ?? null,
          validated.priority ?? 5,
          validated.tags ? JSON.stringify(validated.tags) : null,
          validated.relatedStories ? JSON.stringify(validated.relatedStories) : null,
          validated.id,
        )
      })
      
      if (!updateResult) {
        throw new Error('Database not available')
      }

      // Add audit trail entry
      await this.addAuditEntry(validated.id, validated.currentAgent, 'updated', { updates })

      logger.debug(`Updated story file: ${validated.id}`)
      return validated
    }
    catch (error) {
      logger.error('Failed to update story file:', error)
      throw new N8NMcpError(
        'Failed to update story file',
        'STORY_UPDATE_ERROR',
        500,
        { error: error instanceof Error ? error.message : String(error) },
      )
    }
  }

  async retrieve(id: string): Promise<StoryFile | null> {
    await this.ensureInitialized()

    try {
      // Use type-safe database access
      const result = database.executeCustomSQL('retrieve-story-file', (db) => {
        const row = db.prepare('SELECT * FROM story_files WHERE id = ?').get(id) as DatabaseRow | undefined
        if (!row)
          return null

        // Retrieve associated decisions
        const decisions = db.prepare('SELECT * FROM story_decisions WHERE story_id = ? ORDER BY timestamp').all(id) as DatabaseRow[]
        
        return { row, decisions }
      })
      
      if (!result || !result.row) {
        return null
      }

      return this.rowToStoryFile(result.row, result.decisions)
    }
    catch (error) {
      logger.error('Failed to retrieve story file:', error)
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized()

    try {
      // Use type-safe database access
      const result = database.executeCustomSQL('delete-story-file', (db) => {
        return db.prepare('DELETE FROM story_files WHERE id = ?').run(id)
      })

      if (result && result.changes > 0) {
        logger.debug(`Deleted story file: ${id}`)
        return true
      }

      return false
    }
    catch (error) {
      logger.error('Failed to delete story file:', error)
      return false
    }
  }

  // === Query Operations ===

  async findByAgent(agentName: string): Promise<StoryFile[]> {
    await this.ensureInitialized()

    try {
      // Use type-safe database access
      const result = database.executeCustomSQL('find-stories-by-agent', (db) => {
        const rows = db.prepare('SELECT * FROM story_files WHERE current_agent = ? ORDER BY updated_at DESC').all(agentName) as DatabaseRow[]

        // Optimize: Fetch all decisions in parallel instead of sequential queries
        const rowIds = rows.map(row => row.id as string)
        const decisionPromises = rowIds.map(id =>
          db.prepare('SELECT * FROM story_decisions WHERE story_id = ? ORDER BY timestamp').all(id) as DatabaseRow[],
        )
        
        return { rows, decisionPromises }
      })
      
      if (!result) {
        return []
      }
      
      const { rows, decisionPromises } = result

      const stories: StoryFile[] = []
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (row) {
          const decisions = decisionPromises[i] || []
          const story = this.rowToStoryFile(row, decisions)
          if (story)
            stories.push(story)
        }
      }

      return stories
    }
    catch (error) {
      logger.error('Failed to find stories by agent:', error)
      return []
    }
  }

  async findByPhase(phase: WorkflowPhase): Promise<StoryFile[]> {
    await this.ensureInitialized()

    try {
      // Use type-safe database access
      const result = database.executeCustomSQL('find-stories-by-phase', (db) => {
        const rows = db.prepare('SELECT * FROM story_files WHERE phase = ? ORDER BY updated_at DESC').all(phase) as DatabaseRow[]

        // Optimize: Fetch all decisions in parallel instead of sequential queries
        const rowIds = rows.map(row => row.id as string)
        const decisionPromises = rowIds.map(id =>
          db.prepare('SELECT * FROM story_decisions WHERE story_id = ? ORDER BY timestamp').all(id) as DatabaseRow[],
        )
        
        return { rows, decisionPromises }
      })
      
      if (!result) {
        return []
      }
      
      const { rows, decisionPromises } = result

      const stories: StoryFile[] = []
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (row) {
          const decisions = decisionPromises[i] || []
          const story = this.rowToStoryFile(row, decisions)
          if (story)
            stories.push(story)
        }
      }

      return stories
    }
    catch (error) {
      logger.error('Failed to find stories by phase:', error)
      return []
    }
  }

  async findByStatus(status: StoryStatus): Promise<StoryFile[]> {
    await this.ensureInitialized()

    try {
      // Use type-safe database access
      const result = database.executeCustomSQL('find-stories-by-status', (db) => {
        const rows = db.prepare('SELECT * FROM story_files WHERE status = ? ORDER BY updated_at DESC').all(status) as DatabaseRow[]

        // Optimize: Fetch all decisions in parallel instead of sequential queries
        const rowIds = rows.map(row => row.id as string)
        const decisionPromises = rowIds.map(id =>
          db.prepare('SELECT * FROM story_decisions WHERE story_id = ? ORDER BY timestamp').all(id) as DatabaseRow[],
        )
        
        return { rows, decisionPromises }
      })
      
      if (!result) {
        return []
      }
      
      const { rows, decisionPromises } = result

      const stories: StoryFile[] = []
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (row) {
          const decisions = decisionPromises[i] || []
          const story = this.rowToStoryFile(row, decisions)
          if (story)
            stories.push(story)
        }
      }

      return stories
    }
    catch (error) {
      logger.error('Failed to find stories by status:', error)
      return []
    }
  }

  async findRelated(storyId: string): Promise<StoryFile[]> {
    await this.ensureInitialized()

    const story = await this.retrieve(storyId)
    if (!story || !story.relatedStories || story.relatedStories.length === 0) {
      return []
    }

    // Optimize: Use Promise.all for parallel database operations instead of sequential
    const relatedPromises = story.relatedStories.map(relatedId => this.retrieve(relatedId))
    const relatedResults = await Promise.all(relatedPromises)

    // Filter out null results
    return relatedResults.filter((story): story is StoryFile => story !== null)
  }

  // === Workflow Operations ===

  async transitionPhase(id: string, newPhase: WorkflowPhase): Promise<StoryFile> {
    const story = await this.retrieve(id)
    if (!story) {
      throw new N8NMcpError('Story file not found', 'STORY_NOT_FOUND', 404, { id })
    }

    // Validate phase transition
    if (!HandoverValidator.canTransitionPhase(story, newPhase)) {
      throw new N8NMcpError(
        `Invalid phase transition from ${story.phase} to ${newPhase}`,
        'INVALID_PHASE_TRANSITION',
        400,
        { currentPhase: story.phase, targetPhase: newPhase },
      )
    }

    // Update the phase
    const updated = await this.update(id, { phase: newPhase })

    // Add audit trail
    await this.addAuditEntry(id, story.currentAgent, 'phase_transition', {
      from: story.phase,
      to: newPhase,
    })

    return updated
  }

  async handover(id: string, toAgent: string, notes: string): Promise<StoryFile> {
    const story = await this.retrieve(id)
    if (!story) {
      throw new N8NMcpError('Story file not found', 'STORY_NOT_FOUND', 404, { id })
    }

    // Validate handover
    const validation = HandoverValidator.validate(story)
    if (!validation.isValid) {
      throw new N8NMcpError(
        'Story file validation failed for handover',
        'HANDOVER_VALIDATION_ERROR',
        400,
        { errors: validation.errors, warnings: validation.warnings },
      )
    }

    // Perform handover
    const updated = await this.update(id, {
      currentAgent: toAgent,
      previousAgents: [...story.previousAgents, story.currentAgent],
      handoverNotes: notes,
      status: StoryStatus.HANDED_OVER,
    })

    // Add audit trail
    await this.addAuditEntry(id, toAgent, 'handover', {
      from: story.currentAgent,
      to: toAgent,
      notes,
      completenessScore: validation.completenessScore,
    })

    return updated
  }

  async addDecision(id: string, decision: DecisionRecord): Promise<StoryFile> {
    await this.ensureInitialized()

    const story = await this.retrieve(id)
    if (!story) {
      throw new N8NMcpError('Story file not found', 'STORY_NOT_FOUND', 404, { id })
    }

    try {
      // Use type-safe database access
      const insertResult = database.executeCustomSQL('add-story-decision', (db) => {
        // Insert decision record
        const stmt = db.prepare(`
          INSERT INTO story_decisions (
            id, story_id, timestamp, agent_name, decision_type,
            description, rationale, alternatives, impact, reversible,
            dependencies, outcome
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        return stmt.run(
          decision.id,
          id,
          decision.timestamp,
          decision.agentName,
          decision.decisionType,
          decision.description,
          decision.rationale,
          decision.alternatives ? JSON.stringify(decision.alternatives) : null,
          decision.impact,
          decision.reversible ? 1 : 0,
          decision.dependencies ? JSON.stringify(decision.dependencies) : null,
          decision.outcome ? JSON.stringify(decision.outcome) : null,
        )
      })
      
      if (!insertResult) {
        throw new Error('Database not available')
      }

      // Update story with new decision
      const updatedStory = await this.update(id, {
        decisions: [...story.decisions, decision],
      })

      // Add audit trail
      await this.addAuditEntry(id, decision.agentName, 'decision_added', { decision })

      return updatedStory
    }
    catch (error) {
      logger.error('Failed to add decision:', error)
      throw new N8NMcpError(
        'Failed to add decision',
        'DECISION_ADD_ERROR',
        500,
        { error: error instanceof Error ? error.message : String(error) },
      )
    }
  }

  // === Maintenance Operations ===

  async archive(id: string): Promise<boolean> {
    try {
      await this.update(id, { status: StoryStatus.ARCHIVED })
      await this.addAuditEntry(id, 'system', 'archived', {})
      return true
    }
    catch {
      return false
    }
  }

  async cleanup(ttlMs?: number): Promise<number> {
    await this.ensureInitialized()

    try {
      // Use type-safe database access
      const result = database.executeCustomSQL('cleanup-expired-stories', (db) => {
        const now = Date.now()
        const defaultTtl = ttlMs ?? 7 * 24 * 60 * 60 * 1000 // 7 days default

        // Find expired stories
        const expiredStories = db.prepare(`
          SELECT id FROM story_files 
          WHERE (ttl IS NOT NULL AND updated_at + ttl < ?) 
             OR (ttl IS NULL AND updated_at + ? < ?)
             OR status = ?
        `).all(now, defaultTtl, now, StoryStatus.ARCHIVED) as { id: string }[]
        
        return { expiredStories, now, defaultTtl }
      })
      
      if (!result) {
        return 0
      }
      
      const { expiredStories } = result

      // Optimize: Use Promise.all for parallel deletion instead of sequential
      const deletePromises = expiredStories.map(async (row) => {
        const deleted = await this.delete(row.id)
        return deleted ? 1 as const : 0 as const
      })

      const deleteResults = await Promise.all(deletePromises)
      const cleanedCount = deleteResults.reduce((sum: number, count) => sum + count, 0)

      logger.info(`Cleaned up ${cleanedCount} expired story files`)
      return cleanedCount
    }
    catch (error) {
      logger.error('Failed to cleanup story files:', error)
      return 0
    }
  }

  // === Utility Methods ===

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private rowToStoryFile(row: DatabaseRow, decisions: DatabaseRow[]): StoryFile | null {
    try {
      return {
        id: row.id as string,
        version: row.version as number,
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
        phase: row.phase as WorkflowPhase,
        status: row.status as StoryStatus,
        currentAgent: row.current_agent as string,
        previousAgents: JSON.parse((row.previous_agents as string) || '[]') as string[],
        nextAgent: (row.next_agent as string) || undefined,
        context: {
          original: JSON.parse((row.context_original as string) || '{}') as Record<string, unknown>,
          current: JSON.parse((row.context_current as string) || '{}') as Record<string, unknown>,
          technical: JSON.parse((row.context_technical as string) || '{}') as Record<string, unknown>,
        },
        completedWork: JSON.parse((row.completed_work as string) || '[]') as string[],
        pendingWork: JSON.parse((row.pending_work as string) || '[]') as string[],
        blockers: row.blockers ? JSON.parse(row.blockers as string) as string[] : undefined,
        decisions: decisions.map(d => ({
          id: d.id as string,
          timestamp: d.timestamp as number,
          agentName: d.agent_name as string,
          decisionType: d.decision_type as 'technical' | 'architectural' | 'process' | 'escalation',
          description: d.description as string,
          rationale: d.rationale as string,
          alternatives: d.alternatives ? JSON.parse(d.alternatives as string) as string[] : undefined,
          impact: d.impact as 'low' | 'medium' | 'high' | 'critical',
          reversible: Boolean(d.reversible),
          dependencies: d.dependencies ? JSON.parse(d.dependencies as string) as string[] : undefined,
          outcome: d.outcome ? JSON.parse(d.outcome as string) as { success: boolean, notes?: string, measuredImpact?: string } : undefined,
        })),
        handoverNotes: (row.handover_notes as string) || '',
        acceptanceCriteria: row.acceptance_criteria ? JSON.parse(row.acceptance_criteria as string) as string[] : undefined,
        rollbackPlan: (row.rollback_plan as string) ?? undefined,
        ttl: (row.ttl as number) ?? undefined,
        priority: (row.priority as number) ?? 5,
        tags: row.tags ? JSON.parse(row.tags as string) as string[] : undefined,
        relatedStories: row.related_stories ? JSON.parse(row.related_stories as string) as string[] : undefined,
      }
    }
    catch (error) {
      logger.error('Failed to parse story file row:', error)
      return null
    }
  }

  private async addAuditEntry(
    storyId: string,
    agentName: string,
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Use type-safe database access
      database.executeCustomSQL('add-audit-entry', (db) => {
        const stmt = db.prepare(`
          INSERT INTO story_audit_trail (story_id, timestamp, agent_name, action, details)
          VALUES (?, ?, ?, ?, ?)
        `)

        return stmt.run(storyId, Date.now(), agentName, action, JSON.stringify(details))
      })
    }
    catch (error) {
      logger.warn('Failed to add audit entry:', error)
      // Non-critical, don't throw
    }
  }

  private startCleanupJob(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      void this.cleanup()
    }, 60 * 60 * 1000)

    // Ensure cleanup on process exit
    process.on('SIGINT', () => this.shutdown())
    process.on('SIGTERM', () => this.shutdown())
  }

  private shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }
  }

  // === Metrics ===

  async getMetrics(): Promise<StoryMetrics> {
    const activeStories = await this.findByStatus(StoryStatus.ACTIVE)
    const completedStories = await this.findByStatus(StoryStatus.COMPLETED)
    const allStories = [...activeStories, ...completedStories]

    return StoryMetricsCollector.collect(allStories)
  }
}

// Export singleton instance
export const storyManager = new StoryFileManager()
