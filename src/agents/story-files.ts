/**
 * Story File System for Agent Handover
 *
 * Implements persistent context preservation between agent handovers,
 * inspired by collaborative agent patterns. Provides:
 * - Rich context preservation during agent transitions
 * - Two-phase workflow support (planning → implementation)
 * - Decision audit trails for debugging and learning
 * - Hyper-detailed development stories for complex tasks
 */

import type { AgentContext, EscalationRequest, EscalationResult } from './index.js'
import { z } from 'zod'

// === Workflow Phases ===

export enum WorkflowPhase {
  PLANNING = 'planning',
  IMPLEMENTATION = 'implementation',
  VALIDATION = 'validation',
  COMPLETED = 'completed',
}

export enum StoryStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  HANDED_OVER = 'handed_over',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

// === Decision Records for Audit Trail ===

export interface DecisionRecord {
  id: string
  timestamp: number
  agentName: string
  decisionType: 'technical' | 'architectural' | 'process' | 'escalation'
  description: string
  rationale: string
  alternatives?: string[] | undefined
  impact: 'low' | 'medium' | 'high' | 'critical'
  reversible: boolean
  dependencies?: string[] | undefined
  outcome?: {
    success: boolean
    notes?: string | undefined
    measuredImpact?: string | undefined
  } | undefined
}

// === Technical Context ===

export interface TechnicalContext {
  codebaseAnalysis?: {
    filesModified: string[]
    filesCreated: string[]
    filesDeleted: string[]
    dependencies: string[]
    breakingChanges: boolean
  } | undefined
  testingStatus?: {
    testsRun: number
    testsPassed: number
    testsFailed: number
    coverage?: number | undefined
    failureDetails?: string[] | undefined
  } | undefined
  performanceMetrics?: {
    executionTime?: number | undefined
    memoryUsage?: number | undefined
    cpuUsage?: number | undefined
    throughput?: number | undefined
  } | undefined
  securityConsiderations?: {
    vulnerabilitiesFound: number
    sensitiveDataHandling: boolean
    authenticationRequired: boolean
    encryptionUsed: boolean
  } | undefined
}

// === Story File Core Structure ===

export interface StoryFile {
  // Identity
  id: string
  version: number
  createdAt: number
  updatedAt: number

  // Workflow tracking
  phase: WorkflowPhase
  status: StoryStatus

  // Agent information
  currentAgent: string
  previousAgents: string[]
  nextAgent?: string | undefined

  // Context preservation
  context: {
    original: AgentContext
    current: AgentContext
    technical: TechnicalContext
  }

  // Work tracking
  completedWork: string[]
  pendingWork: string[]
  blockers?: string[] | undefined

  // Decision trail
  decisions: DecisionRecord[]

  // Handover details
  handoverNotes: string
  acceptanceCriteria?: string[] | undefined
  rollbackPlan?: string | undefined

  // Metadata
  ttl?: number | undefined // Time to live in milliseconds
  priority?: number | undefined
  tags?: string[] | undefined
  relatedStories?: string[] | undefined
}

// === Enhanced Escalation with Story Context ===

export interface StoryEscalationRequest extends EscalationRequest {
  storyFileId?: string
  storyContext?: Partial<StoryFile>
  requiresNewStory?: boolean
}

export interface StoryEscalationResult extends EscalationResult {
  storyFileId?: string
  storyUpdates?: Partial<StoryFile>
  decisionsAdded?: DecisionRecord[]
}

// === Story File Validation Schemas ===

export const DecisionRecordSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  agentName: z.string(),
  decisionType: z.enum(['technical', 'architectural', 'process', 'escalation']),
  description: z.string(),
  rationale: z.string(),
  alternatives: z.array(z.string()).optional(),
  impact: z.enum(['low', 'medium', 'high', 'critical']),
  reversible: z.boolean(),
  dependencies: z.array(z.string()).optional(),
  outcome: z.object({
    success: z.boolean(),
    notes: z.string().optional(),
    measuredImpact: z.string().optional(),
  }).optional(),
})

export const TechnicalContextSchema = z.object({
  codebaseAnalysis: z.object({
    filesModified: z.array(z.string()),
    filesCreated: z.array(z.string()),
    filesDeleted: z.array(z.string()),
    dependencies: z.array(z.string()),
    breakingChanges: z.boolean(),
  }).optional(),
  testingStatus: z.object({
    testsRun: z.number(),
    testsPassed: z.number(),
    testsFailed: z.number(),
    coverage: z.number().optional(),
    failureDetails: z.array(z.string()).optional(),
  }).optional(),
  performanceMetrics: z.object({
    executionTime: z.number().optional(),
    memoryUsage: z.number().optional(),
    cpuUsage: z.number().optional(),
    throughput: z.number().optional(),
  }).optional(),
  securityConsiderations: z.object({
    vulnerabilitiesFound: z.number(),
    sensitiveDataHandling: z.boolean(),
    authenticationRequired: z.boolean(),
    encryptionUsed: z.boolean(),
  }).optional(),
})

export const StoryFileSchema = z.object({
  id: z.string(),
  version: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),

  phase: z.nativeEnum(WorkflowPhase),
  status: z.nativeEnum(StoryStatus),

  currentAgent: z.string(),
  previousAgents: z.array(z.string()),
  nextAgent: z.string().optional(),

  context: z.object({
    original: z.record(z.unknown()),
    current: z.record(z.unknown()),
    technical: TechnicalContextSchema,
  }),

  completedWork: z.array(z.string()),
  pendingWork: z.array(z.string()),
  blockers: z.array(z.string()).optional(),

  decisions: z.array(DecisionRecordSchema),

  handoverNotes: z.string(),
  acceptanceCriteria: z.array(z.string()).optional(),
  rollbackPlan: z.string().optional(),

  ttl: z.number().optional(),
  priority: z.number().optional(),
  tags: z.array(z.string()).optional(),
  relatedStories: z.array(z.string()).optional(),
})

// === Story File Operations Interface ===

export interface StoryFileOperations {
  // CRUD operations
  create: (initial: Partial<StoryFile>) => Promise<StoryFile>
  update: (id: string, updates: Partial<StoryFile>) => Promise<StoryFile>
  retrieve: (id: string) => Promise<StoryFile | null>
  delete: (id: string) => Promise<boolean>

  // Query operations
  findByAgent: (agentName: string) => Promise<StoryFile[]>
  findByPhase: (phase: WorkflowPhase) => Promise<StoryFile[]>
  findByStatus: (status: StoryStatus) => Promise<StoryFile[]>
  findRelated: (storyId: string) => Promise<StoryFile[]>

  // Workflow operations
  transitionPhase: (id: string, newPhase: WorkflowPhase) => Promise<StoryFile>
  handover: (id: string, toAgent: string, notes: string) => Promise<StoryFile>
  addDecision: (id: string, decision: DecisionRecord) => Promise<StoryFile>

  // Maintenance operations
  archive: (id: string) => Promise<boolean>
  cleanup: (ttlMs?: number) => Promise<number> // Returns count of cleaned stories
}

// === Handover Validation ===

export interface HandoverValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
  completenessScore: number // 0-100
}

export class HandoverValidator {
  static validate(story: StoryFile): HandoverValidation {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    // Required fields
    if (!story.handoverNotes || story.handoverNotes.length < 10) {
      errors.push('Handover notes must be at least 10 characters')
      score -= 20
    }

    if (story.pendingWork.length === 0 && story.phase !== WorkflowPhase.COMPLETED) {
      warnings.push('No pending work specified for incomplete story')
      score -= 10
    }

    if (story.decisions.length === 0) {
      warnings.push('No decisions recorded in story file')
      score -= 15
    }

    // Context completeness
    if (!story.context.technical.codebaseAnalysis && story.phase === WorkflowPhase.IMPLEMENTATION) {
      warnings.push('Missing codebase analysis for implementation phase')
      score -= 10
    }

    if (!story.context.technical.testingStatus && story.phase === WorkflowPhase.VALIDATION) {
      errors.push('Testing status required for validation phase')
      score -= 25
    }

    // Security checks
    if (story.context.technical.securityConsiderations?.vulnerabilitiesFound
      && story.context.technical.securityConsiderations.vulnerabilitiesFound > 0
      && !story.rollbackPlan) {
      errors.push('Rollback plan required when vulnerabilities are present')
      score -= 20
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore: Math.max(0, score),
    }
  }

  static canTransitionPhase(story: StoryFile, targetPhase: WorkflowPhase): boolean {
    const currentPhase = story.phase

    // Define valid transitions
    const validTransitions: Record<WorkflowPhase, WorkflowPhase[]> = {
      [WorkflowPhase.PLANNING]: [WorkflowPhase.IMPLEMENTATION],
      [WorkflowPhase.IMPLEMENTATION]: [WorkflowPhase.VALIDATION, WorkflowPhase.PLANNING],
      [WorkflowPhase.VALIDATION]: [WorkflowPhase.COMPLETED, WorkflowPhase.IMPLEMENTATION],
      [WorkflowPhase.COMPLETED]: [], // No transitions from completed
    }

    return validTransitions[currentPhase]?.includes(targetPhase) ?? false
  }
}

// === Story File Factory ===

export class StoryFileFactory {
  static create(params: {
    agentName: string
    context: AgentContext
    phase?: WorkflowPhase
    priority?: number
    ttl?: number
  }): StoryFile {
    const now = Date.now()

    return {
      id: `story_${now}_${Math.random().toString(36).substr(2, 9)}`,
      version: 1,
      createdAt: now,
      updatedAt: now,

      phase: params.phase ?? WorkflowPhase.PLANNING,
      status: StoryStatus.DRAFT,

      currentAgent: params.agentName,
      previousAgents: [],

      context: {
        original: params.context,
        current: params.context,
        technical: {},
      },

      completedWork: [],
      pendingWork: [],
      decisions: [],

      handoverNotes: '',

      ttl: params.ttl ?? undefined,
      priority: params.priority ?? undefined,
      tags: undefined,
    }
  }

  static fromEscalation(request: EscalationRequest, sourceAgent: string): StoryFile {
    return StoryFileFactory.create({
      agentName: sourceAgent,
      context: request.originalContext ?? {},
      priority: request.urgency === 'critical'
        ? 10
        : request.urgency === 'high'
          ? 7
          : request.urgency === 'medium' ? 5 : 3,
    })
  }
}

// === Story Metrics ===

export interface StoryMetrics {
  totalStories: number
  storiesByPhase: Record<WorkflowPhase, number>
  storiesByStatus: Record<StoryStatus, number>
  averageCompletionTime: number
  averageDecisionsPerStory: number
  averageHandovers: number
  completenessScores: number[]
}

export class StoryMetricsCollector {
  static collect(stories: StoryFile[]): StoryMetrics {
    const metrics: StoryMetrics = {
      totalStories: stories.length,
      storiesByPhase: {
        [WorkflowPhase.PLANNING]: 0,
        [WorkflowPhase.IMPLEMENTATION]: 0,
        [WorkflowPhase.VALIDATION]: 0,
        [WorkflowPhase.COMPLETED]: 0,
      },
      storiesByStatus: {
        [StoryStatus.DRAFT]: 0,
        [StoryStatus.ACTIVE]: 0,
        [StoryStatus.HANDED_OVER]: 0,
        [StoryStatus.COMPLETED]: 0,
        [StoryStatus.ARCHIVED]: 0,
      },
      averageCompletionTime: 0,
      averageDecisionsPerStory: 0,
      averageHandovers: 0,
      completenessScores: [],
    }

    if (stories.length === 0)
      return metrics

    let totalCompletionTime = 0
    let completedCount = 0
    let totalDecisions = 0
    let totalHandovers = 0

    for (const story of stories) {
      // Phase and status counts
      metrics.storiesByPhase[story.phase]++
      metrics.storiesByStatus[story.status]++

      // Completion time for completed stories
      if (story.status === StoryStatus.COMPLETED) {
        totalCompletionTime += story.updatedAt - story.createdAt
        completedCount++
      }

      // Decision and handover counts
      totalDecisions += story.decisions.length
      totalHandovers += story.previousAgents.length

      // Completeness scores
      const validation = HandoverValidator.validate(story)
      metrics.completenessScores.push(validation.completenessScore)
    }

    metrics.averageCompletionTime = completedCount > 0 ? totalCompletionTime / completedCount : 0
    metrics.averageDecisionsPerStory = totalDecisions / stories.length
    metrics.averageHandovers = totalHandovers / stories.length

    return metrics
  }
}
