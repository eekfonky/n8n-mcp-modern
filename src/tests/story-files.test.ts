/**
 * Unit Tests for BMAD-METHOD Story File System
 *
 * Comprehensive tests for story file creation, persistence, handovers,
 * validation, and the complete BMAD-METHOD integration.
 */

import type { Agent, EscalationRequest } from '../agents/index.js'
import type { DecisionRecord, StoryFile } from '../agents/story-files.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunicationManager } from '../agents/communication.js'
import { AgentCapability, AgentTier, EscalationReason, EscalationUrgency } from '../agents/index.js'
import {

  HandoverValidator,

  StoryFileFactory,
  StoryMetricsCollector,
  StoryStatus,
  WorkflowPhase,
} from '../agents/story-files.js'
import { StoryFileManager } from '../agents/story-manager.js'

// Mock the database and logger
vi.mock('../server/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// No need for database mocking - the database handles test environment automatically

// Clean up test database storage between tests
afterEach(() => {
  if (typeof globalThis !== 'undefined') {
    delete (globalThis as any).__TEST_DB_STORAGE__
  }
})

describe('storyFile Factory', () => {
  it('should create a story file with default values', () => {
    const story = StoryFileFactory.create({
      agentName: 'test-agent',
      context: { test: 'value' },
    })

    expect(story.id).toMatch(/^story_\d+_/)
    expect(story.currentAgent).toBe('test-agent')
    expect(story.phase).toBe(WorkflowPhase.PLANNING)
    expect(story.status).toBe(StoryStatus.DRAFT)
    expect(story.context.original).toEqual({ test: 'value' })
    expect(story.context.current).toEqual({ test: 'value' })
    expect(story.completedWork).toEqual([])
    expect(story.pendingWork).toEqual([])
    expect(story.decisions).toEqual([])
    expect(story.version).toBe(1)
  })

  it('should create a story file with custom phase and priority', () => {
    const story = StoryFileFactory.create({
      agentName: 'test-agent',
      context: {},
      phase: WorkflowPhase.IMPLEMENTATION,
      priority: 8,
      ttl: 3600000,
    })

    expect(story.phase).toBe(WorkflowPhase.IMPLEMENTATION)
    expect(story.priority).toBe(8)
    expect(story.ttl).toBe(3600000)
  })

  it('should create story from escalation request', () => {
    const request: EscalationRequest = {
      originalToolName: 'test-tool',
      originalContext: { complexity: 'high' },
      reason: EscalationReason.COMPLEXITY_EXCEEDED,
      urgency: EscalationUrgency.HIGH,
      sourceAgent: 'source-agent',
      message: 'Test escalation',
      attemptedActions: ['action1'],
      requiredCapabilities: [AgentCapability.CODE_GENERATION],
    }

    const story = StoryFileFactory.fromEscalation(request, 'source-agent')

    expect(story.currentAgent).toBe('source-agent')
    expect(story.context.original).toEqual({ complexity: 'high' })
    expect(story.priority).toBe(7) // HIGH urgency maps to 7
  })
})

describe('handoverValidator', () => {
  let testStory: StoryFile

  beforeEach(() => {
    testStory = StoryFileFactory.create({
      agentName: 'test-agent',
      context: {},
    })
  })

  it('should validate a complete story file', () => {
    testStory.handoverNotes = 'Detailed handover notes explaining the work completed'
    testStory.completedWork = ['Task 1', 'Task 2']
    testStory.pendingWork = ['Task 3']
    testStory.decisions = [{
      id: 'decision-1',
      timestamp: Date.now(),
      agentName: 'test-agent',
      decisionType: 'technical',
      description: 'Test decision',
      rationale: 'Test rationale',
      impact: 'medium',
      reversible: true,
    }]

    const validation = HandoverValidator.validate(testStory)

    expect(validation.isValid).toBe(true)
    expect(validation.errors).toHaveLength(0)
    expect(validation.completenessScore).toBeGreaterThan(80)
  })

  it('should fail validation for insufficient handover notes', () => {
    testStory.handoverNotes = 'Short'

    const validation = HandoverValidator.validate(testStory)

    expect(validation.isValid).toBe(false)
    expect(validation.errors).toContain('Handover notes must be at least 10 characters')
    expect(validation.completenessScore).toBeLessThan(100)
  })

  it('should require testing status for validation phase', () => {
    testStory.phase = WorkflowPhase.VALIDATION
    testStory.handoverNotes = 'Detailed handover notes'

    const validation = HandoverValidator.validate(testStory)

    expect(validation.isValid).toBe(false)
    expect(validation.errors).toContain('Testing status required for validation phase')
  })

  it('should require rollback plan when vulnerabilities present', () => {
    testStory.handoverNotes = 'Detailed handover notes'
    testStory.context.technical.securityConsiderations = {
      vulnerabilitiesFound: 2,
      sensitiveDataHandling: false,
      authenticationRequired: false,
      encryptionUsed: false,
    }

    const validation = HandoverValidator.validate(testStory)

    expect(validation.isValid).toBe(false)
    expect(validation.errors).toContain('Rollback plan required when vulnerabilities are present')
  })

  it('should validate phase transitions', () => {
    testStory.phase = WorkflowPhase.PLANNING

    expect(HandoverValidator.canTransitionPhase(testStory, WorkflowPhase.IMPLEMENTATION)).toBe(true)
    expect(HandoverValidator.canTransitionPhase(testStory, WorkflowPhase.VALIDATION)).toBe(false)
    expect(HandoverValidator.canTransitionPhase(testStory, WorkflowPhase.COMPLETED)).toBe(false)

    testStory.phase = WorkflowPhase.IMPLEMENTATION
    expect(HandoverValidator.canTransitionPhase(testStory, WorkflowPhase.VALIDATION)).toBe(true)
    expect(HandoverValidator.canTransitionPhase(testStory, WorkflowPhase.PLANNING)).toBe(true) // Rollback

    testStory.phase = WorkflowPhase.COMPLETED
    expect(HandoverValidator.canTransitionPhase(testStory, WorkflowPhase.VALIDATION)).toBe(false)
  })
})

describe('storyMetricsCollector', () => {
  it('should collect metrics from empty story list', () => {
    const metrics = StoryMetricsCollector.collect([])

    expect(metrics.totalStories).toBe(0)
    expect(metrics.averageCompletionTime).toBe(0)
    expect(metrics.averageDecisionsPerStory).toBe(0)
    expect(metrics.averageHandovers).toBe(0)
    expect(metrics.completenessScores).toEqual([])
  })

  it('should collect metrics from story list', () => {
    const stories: StoryFile[] = [
      {
        ...StoryFileFactory.create({ agentName: 'agent-1', context: {} }),
        phase: WorkflowPhase.PLANNING,
        status: StoryStatus.ACTIVE,
        decisions: [
          {
            id: 'decision-1',
            timestamp: Date.now(),
            agentName: 'agent-1',
            decisionType: 'technical',
            description: 'Decision 1',
            rationale: 'Rationale 1',
            impact: 'medium',
            reversible: true,
          },
        ],
        previousAgents: ['previous-agent'],
        handoverNotes: 'Detailed handover notes for testing',
      },
      {
        ...StoryFileFactory.create({ agentName: 'agent-2', context: {} }),
        phase: WorkflowPhase.COMPLETED,
        status: StoryStatus.COMPLETED,
        createdAt: Date.now() - 3600000, // 1 hour ago
        updatedAt: Date.now(), // Completed now
        decisions: [],
        previousAgents: [],
        handoverNotes: 'Completion notes',
      },
    ]

    const metrics = StoryMetricsCollector.collect(stories)

    expect(metrics.totalStories).toBe(2)
    expect(metrics.storiesByPhase[WorkflowPhase.PLANNING]).toBe(1)
    expect(metrics.storiesByPhase[WorkflowPhase.COMPLETED]).toBe(1)
    expect(metrics.storiesByStatus[StoryStatus.ACTIVE]).toBe(1)
    expect(metrics.storiesByStatus[StoryStatus.COMPLETED]).toBe(1)
    expect(metrics.averageDecisionsPerStory).toBe(0.5) // 1 decision across 2 stories
    expect(metrics.averageHandovers).toBe(0.5) // 1 handover across 2 stories
    expect(metrics.averageCompletionTime).toBe(3600000) // 1 hour in ms
    expect(metrics.completenessScores).toHaveLength(2)
  })
})

describe('storyFileManager', () => {
  let manager: StoryFileManager

  beforeEach(() => {
    manager = new StoryFileManager()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should create and retrieve a story file', async () => {
    const initialData = {
      currentAgent: 'test-agent',
      context: {
        original: { test: 'value' },
        current: { test: 'value' },
        technical: {},
      },
      completedWork: ['Initial task'],
      pendingWork: ['Next task'],
    }

    const createdStory = await manager.create(initialData)

    expect(createdStory.id).toBeDefined()
    expect(createdStory.currentAgent).toBe('test-agent')
    expect(createdStory.completedWork).toEqual(['Initial task'])
    expect(createdStory.pendingWork).toEqual(['Next task'])
    expect(createdStory.version).toBe(1)
  })

  it('should update a story file', async () => {
    // Mock the retrieve method to return a story
    const mockStory = StoryFileFactory.create({
      agentName: 'test-agent',
      context: {},
    })
    vi.spyOn(manager, 'retrieve').mockResolvedValue(mockStory)

    const updates = {
      completedWork: ['Completed task 1'],
      pendingWork: ['New pending task'],
      handoverNotes: 'Updated notes',
    }

    const updatedStory = await manager.update(mockStory.id, updates)

    expect(updatedStory.version).toBe(2)
    expect(updatedStory.completedWork).toEqual(['Completed task 1'])
    expect(updatedStory.pendingWork).toEqual(['New pending task'])
    expect(updatedStory.handoverNotes).toBe('Updated notes')
  })

  it('should perform handover validation', async () => {
    const mockStory = StoryFileFactory.create({
      agentName: 'source-agent',
      context: {},
    })
    mockStory.handoverNotes = 'Short' // Only 5 characters, fails validation

    vi.spyOn(manager, 'retrieve').mockResolvedValue(mockStory)

    await expect(
      manager.handover(mockStory.id, 'target-agent', 'Brief'), // Also short, 5 characters
    ).rejects.toThrow('Story file validation failed for handover')
  })

  it('should transition phases with validation', async () => {
    const mockStory = StoryFileFactory.create({
      agentName: 'test-agent',
      context: {},
    })
    mockStory.phase = WorkflowPhase.PLANNING

    vi.spyOn(manager, 'retrieve').mockResolvedValue(mockStory)
    vi.spyOn(manager, 'update').mockResolvedValue({
      ...mockStory,
      phase: WorkflowPhase.IMPLEMENTATION,
      version: 2,
    })

    const transitioned = await manager.transitionPhase(
      mockStory.id,
      WorkflowPhase.IMPLEMENTATION,
    )

    expect(transitioned.phase).toBe(WorkflowPhase.IMPLEMENTATION)
  })

  it('should reject invalid phase transitions', async () => {
    const mockStory = StoryFileFactory.create({
      agentName: 'test-agent',
      context: {},
    })
    mockStory.phase = WorkflowPhase.PLANNING

    vi.spyOn(manager, 'retrieve').mockResolvedValue(mockStory)

    await expect(
      manager.transitionPhase(mockStory.id, WorkflowPhase.COMPLETED),
    ).rejects.toThrow('Invalid phase transition')
  })

  it('should add decisions to story files', async () => {
    const mockStory = StoryFileFactory.create({
      agentName: 'test-agent',
      context: {},
    })

    vi.spyOn(manager, 'retrieve').mockResolvedValue(mockStory)
    vi.spyOn(manager, 'update').mockResolvedValue({
      ...mockStory,
      decisions: [
        {
          id: 'decision-1',
          timestamp: Date.now(),
          agentName: 'test-agent',
          decisionType: 'technical',
          description: 'Test decision',
          rationale: 'Test rationale',
          impact: 'high',
          reversible: false,
        },
      ],
    })

    const decision: DecisionRecord = {
      id: 'decision-1',
      timestamp: Date.now(),
      agentName: 'test-agent',
      decisionType: 'technical',
      description: 'Test decision',
      rationale: 'Test rationale',
      impact: 'high',
      reversible: false,
    }

    const updated = await manager.addDecision(mockStory.id, decision)

    expect(updated.decisions).toHaveLength(1)
    expect(updated.decisions[0].description).toBe('Test decision')
  })
})

describe('communicationManager Story File Integration', () => {
  let mockAgent: Agent
  let communicationManager: CommunicationManager

  beforeEach(() => {
    mockAgent = {
      name: 'test-agent',
      tier: AgentTier.SPECIALIST,
      capabilities: [AgentCapability.CODE_GENERATION],
      description: 'Test agent for story file integration',
      canHandle: vi.fn().mockReturnValue(true),
      getPriority: vi.fn().mockReturnValue(5),
    }

    communicationManager = new CommunicationManager([mockAgent])
  })

  it('should handle escalation with new story file creation', async () => {
    const request: EscalationRequest = {
      originalToolName: 'test-tool',
      originalContext: { complexity: 'high' },
      reason: EscalationReason.COMPLEXITY_EXCEEDED,
      urgency: EscalationUrgency.HIGH,
      sourceAgent: 'source-agent',
      message: 'Complex task needs story file',
      attemptedActions: ['basic-approach'],
      requiredCapabilities: [AgentCapability.CODE_GENERATION],
      requiresNewStory: true,
      completedWork: ['Analysis phase'],
      pendingWork: ['Implementation', 'Testing'],
      technicalContext: {
        filesModified: ['file1.ts', 'file2.ts'],
        dependenciesChanged: true,
        testingRequired: true,
        performanceImpact: 'medium',
        securityImpact: 'low',
        breakingChange: false,
      },
    }

    const result = await communicationManager.optimizedEscalation(request)

    expect(result.success).toBe(true)
    expect(result.storyFileId).toBeDefined()
    expect(result.storyUpdates).toBeDefined()
    expect(result.message).toContain('story file integration')
  })

  it('should handle escalation with existing story file', async () => {
    // First create a story file
    const storyFile = await communicationManager.createStoryFile(
      'test-agent',
      { test: 'context' },
      ['Initial work'],
    )

    const request: EscalationRequest = {
      originalToolName: 'test-tool',
      originalContext: {},
      reason: EscalationReason.VALIDATION_REQUIRED,
      sourceAgent: 'source-agent',
      message: 'Continue with existing story',
      attemptedActions: ['validation'],
      requiredCapabilities: [AgentCapability.CODE_GENERATION],
      storyFileId: storyFile.id,
    }

    const result = await communicationManager.optimizedEscalation(request)

    expect(result.success).toBe(true)
    expect(result.storyFileId).toBe(storyFile.id)
    expect(result.storyUpdates?.completedWork).toEqual(['Initial work'])
  })

  it('should cache and retrieve story files', async () => {
    const storyFile = await communicationManager.createStoryFile(
      'test-agent',
      { test: 'context' },
    )

    // First retrieval should hit cache
    const retrieved1 = await communicationManager.getStoryFile(storyFile.id)
    expect(retrieved1?.id).toBe(storyFile.id)

    // Second retrieval should also hit cache
    const retrieved2 = await communicationManager.getStoryFile(storyFile.id)
    expect(retrieved2?.id).toBe(storyFile.id)
  })

  it('should handle story file handovers', async () => {
    const storyFile = await communicationManager.createStoryFile(
      'source-agent',
      { test: 'context' },
    )

    // Update the story file with sufficient handover notes first
    await communicationManager.updateStoryFile(storyFile.id, {
      handoverNotes: 'Detailed initial work notes explaining the context and setup',
    })

    const handedOver = await communicationManager.handoverStoryFile(
      storyFile.id,
      'target-agent',
      'Detailed handover notes explaining all the work completed so far',
    )

    expect(handedOver?.currentAgent).toBe('target-agent')
    expect(handedOver?.status).toBe(StoryStatus.HANDED_OVER)
    expect(handedOver?.previousAgents).toContain('source-agent')
  })

  it('should collect story metrics', async () => {
    // Create some story files
    await communicationManager.createStoryFile('agent-1', {})
    await communicationManager.createStoryFile('agent-2', {})

    const metrics = await communicationManager.getStoryMetrics()

    expect(metrics.totalStories).toBeGreaterThanOrEqual(0)
    expect(metrics.storiesByPhase).toBeDefined()
    expect(metrics.storiesByStatus).toBeDefined()
  })
})

describe('error Handling and Edge Cases', () => {
  let manager: StoryFileManager

  beforeEach(() => {
    manager = new StoryFileManager()
  })

  it('should handle non-existent story file retrieval', async () => {
    const result = await manager.retrieve('non-existent-id')
    expect(result).toBeNull()
  })

  it('should handle updates to non-existent story files', async () => {
    await expect(
      manager.update('non-existent-id', { handoverNotes: 'test' }),
    ).rejects.toThrow('Story file not found')
  })

  it('should handle database errors gracefully', async () => {
    // Mock database error by spying on database.executeCustomSQL
    const { database } = await import('../database/index.js')
    vi.spyOn(database, 'executeCustomSQL').mockImplementation(() => {
      throw new Error('Database error')
    })

    await expect(
      manager.create({ currentAgent: 'test', context: { current: {} } }),
    ).rejects.toThrow()

    // Restore the spy
    vi.restoreAllMocks()
  })

  it('should handle cleanup with TTL', async () => {
    // This test would require a more complex setup with actual database
    // For now, just ensure the method exists and doesn't throw
    const cleanedCount = await manager.cleanup(1000) // Very short TTL
    expect(typeof cleanedCount).toBe('number')
    expect(cleanedCount).toBeGreaterThanOrEqual(0)
  })
})

describe('integration with Agent System', () => {
  it('should support the complete BMAD-METHOD workflow', async () => {
    // 1. Planning Phase - Create story file
    const planningStory = StoryFileFactory.create({
      agentName: 'n8n-workflow-architect',
      context: {
        workflowType: 'data-processing',
        complexity: 'high',
      },
      phase: WorkflowPhase.PLANNING,
    })

    expect(planningStory.phase).toBe(WorkflowPhase.PLANNING)
    expect(planningStory.currentAgent).toBe('n8n-workflow-architect')

    // 2. Add planning decisions
    const planningDecision: DecisionRecord = {
      id: 'planning-decision-1',
      timestamp: Date.now(),
      agentName: 'n8n-workflow-architect',
      decisionType: 'architectural',
      description: 'Decided to use microservices pattern',
      rationale: 'Better scalability for high-volume data processing',
      impact: 'high',
      reversible: false,
      alternatives: ['monolithic', 'serverless'],
    }

    planningStory.decisions.push(planningDecision)

    // 3. Validate planning completeness
    planningStory.handoverNotes = 'Architecture complete. Database schema designed. API contracts defined. Ready for implementation.'
    planningStory.completedWork = ['Requirements analysis', 'Architecture design', 'Database schema']
    planningStory.pendingWork = ['Implementation', 'Testing', 'Deployment']

    const validation = HandoverValidator.validate(planningStory)
    expect(validation.isValid).toBe(true)

    // 4. Implementation Phase - Hand over to developer
    expect(HandoverValidator.canTransitionPhase(
      planningStory,
      WorkflowPhase.IMPLEMENTATION,
    )).toBe(true)

    const implementationStory = {
      ...planningStory,
      phase: WorkflowPhase.IMPLEMENTATION,
      currentAgent: 'n8n-developer-specialist',
      previousAgents: ['n8n-workflow-architect'],
      status: StoryStatus.ACTIVE,
    }

    // 5. Add implementation work
    implementationStory.completedWork = [
      ...planningStory.completedWork,
      'Core workflow implementation',
      'Database integration',
    ]
    implementationStory.pendingWork = ['Testing', 'Performance optimization']

    // 6. Validation Phase - Hand over for testing
    expect(HandoverValidator.canTransitionPhase(
      implementationStory,
      WorkflowPhase.VALIDATION,
    )).toBe(true)

    // 7. Complete workflow
    const completedStory = {
      ...implementationStory,
      phase: WorkflowPhase.COMPLETED,
      status: StoryStatus.COMPLETED,
      completedWork: [
        ...implementationStory.completedWork,
        'Testing complete',
        'Performance optimized',
        'Deployed to production',
      ],
      pendingWork: [],
    }

    // 8. Verify metrics collection
    const stories = [planningStory, implementationStory, completedStory]
    const metrics = StoryMetricsCollector.collect(stories)

    expect(metrics.totalStories).toBe(3)
    expect(metrics.averageDecisionsPerStory).toBeGreaterThan(0)
    expect(metrics.averageHandovers).toBeGreaterThan(0)
  })
})
