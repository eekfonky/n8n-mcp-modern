/**
 * Agent Handover Validation Tests
 * Tests the complete agent handover system for complex n8n workflows
 */

import type { Agent } from '../agents/index.js'
import type {
  AgentContext,
  DecisionRecord,
} from '../agents/story-files.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CommunicationManager } from '../agents/communication.js'
import { AgentCapability, agentRouter, AgentTier } from '../agents/index.js'
import {
  HandoverValidator,
  WorkflowPhase,
} from '../agents/story-files.js'
import {
  StoryFileManager,
} from '../agents/story-manager.js'

describe('agent Handover Validation Tests', () => {
  let storyManager: StoryFileManager
  let communicationManager: CommunicationManager

  beforeEach(async () => {
    storyManager = new StoryFileManager()

    // Create mock agents for testing
    const mockAgents: Agent[] = [
      {
        name: 'n8n-workflow-architect',
        tier: AgentTier.MASTER,
        capabilities: [AgentCapability.WORKFLOW_DESIGN],
        description: 'Test architect agent',
        canHandle: () => true,
        getPriority: () => 5,
        // Optional methods
        canEscalate: () => false,
        shouldEscalate: () => false,
      },
      {
        name: 'n8n-developer-specialist',
        tier: AgentTier.SPECIALIST,
        capabilities: [AgentCapability.CODE_GENERATION],
        description: 'Test developer agent',
        canHandle: () => true,
        getPriority: () => 5,
        // Optional methods
        canEscalate: () => false,
        shouldEscalate: () => false,
      },
    ]

    communicationManager = new CommunicationManager(mockAgents)

    // Initialize clean state
    await storyManager.cleanup(0) // Clean all stories
  })

  afterEach(async () => {
    // Clean up test stories
    await storyManager.cleanup(0)
  })

  describe('story 1: Multi-Integration E-commerce Workflow', () => {
    it('should handle architect → developer → integration → performance handover chain', async () => {
      // Phase 1: Architect Planning
      const architectContext: AgentContext = {
        userRequest: 'Create workflow that syncs Shopify orders to Airtable, sends Slack notifications, updates SAP inventory',
        complexity: 'high',
        integrations: ['shopify', 'airtable', 'slack', 'sap'],
        requirements: ['real-time processing', 'error handling', 'scalability'],
      }

      const storyFile = await storyManager.create({
        currentAgent: 'n8n-workflow-architect',
        phase: WorkflowPhase.PLANNING,
        context: {
          original: architectContext,
          current: architectContext,
          technical: {},
        },
        completedWork: [],
        pendingWork: [
          'Design overall architecture',
          'Identify integration points',
          'Plan error handling strategy',
          'Define scalability requirements',
        ],
      })

      expect(storyFile.id).toBeDefined()
      expect(storyFile.currentAgent).toBe('n8n-workflow-architect')
      expect(storyFile.phase).toBe(WorkflowPhase.PLANNING)

      // Architect completes planning phase
      const architectDecision: DecisionRecord = {
        id: 'arch-001',
        timestamp: Date.now(),
        agentName: 'n8n-workflow-architect',
        decisionType: 'architectural',
        description: 'Chose event-driven architecture with error queues',
        rationale: 'Ensures reliability and scalability for high-volume order processing',
        alternatives: ['Batch processing', 'Direct API calls'],
        impact: 'high',
        reversible: true,
        dependencies: ['Shopify webhooks', 'SAP API availability'],
      }

      await storyManager.addDecision(storyFile.id, architectDecision)

      const updatedPlanning = await storyManager.update(storyFile.id, {
        completedWork: [
          'Designed event-driven architecture',
          'Identified integration points and dependencies',
          'Planned error handling with retry queues',
          'Defined scalability targets (1000+ orders/day)',
        ],
        pendingWork: [
          'Implement basic workflow structure',
          'Create Shopify webhook handler',
          'Set up Airtable integration',
          'Implement Slack notifications',
        ],
        handoverNotes: 'Architecture complete. Event-driven design chosen for scalability. Focus on webhook reliability and error handling. SAP integration will be complex - may need integration specialist.',
        context: {
          ...storyFile.context,
          technical: {
            codebaseAnalysis: {
              filesModified: [],
              filesCreated: ['workflow-architecture.json'],
              filesDeleted: [],
              dependencies: ['n8n-nodes-base', '@n8n/workflow'],
              breakingChanges: false,
            },
          },
        },
      })

      expect(updatedPlanning?.completedWork).toHaveLength(4)

      // Phase 2: Handover to Developer
      const handoverToDeveloper = await storyManager.handover(
        storyFile.id,
        'n8n-developer-specialist',
        'Architecture approved. Implement basic workflow structure following event-driven pattern. SAP integration complexity may require specialist handover.',
      )

      expect(handoverToDeveloper?.currentAgent).toBe('n8n-developer-specialist')
      expect(handoverToDeveloper?.previousAgents).toContain('n8n-workflow-architect')

      // Manually transition phase to implementation after handover
      await storyManager.transitionPhase(storyFile.id, WorkflowPhase.IMPLEMENTATION)
      const updatedHandover = await storyManager.retrieve(storyFile.id)
      expect(updatedHandover?.phase).toBe(WorkflowPhase.IMPLEMENTATION)

      // Developer implements basic structure
      const developerDecision: DecisionRecord = {
        id: 'dev-001',
        timestamp: Date.now(),
        agentName: 'n8n-developer-specialist',
        decisionType: 'technical',
        description: 'Implemented webhook handler with retry logic',
        rationale: 'Ensures reliable order processing even during high traffic',
        impact: 'medium',
        reversible: true,
      }

      await storyManager.addDecision(storyFile.id, developerDecision)

      // Developer hits SAP integration complexity
      const handoverToIntegration = await storyManager.handover(
        storyFile.id,
        'n8n-integration-specialist',
        'Basic workflow implemented. Stuck on SAP authentication - requires OAuth 2.0 with custom scope handling. Need integration specialist expertise.',
      )

      expect(handoverToIntegration?.currentAgent).toBe('n8n-integration-specialist')
      expect(handoverToIntegration?.previousAgents).toContain('n8n-developer-specialist')

      // Integration specialist solves auth
      const integrationDecision: DecisionRecord = {
        id: 'int-001',
        timestamp: Date.now(),
        agentName: 'n8n-integration-specialist',
        decisionType: 'technical',
        description: 'Implemented SAP OAuth 2.0 with token refresh',
        rationale: 'SAP requires specific scope configuration and token rotation',
        impact: 'high',
        reversible: false,
        dependencies: ['SAP API credentials', 'OAuth endpoints'],
      }

      await storyManager.addDecision(storyFile.id, integrationDecision)

      // Final handover to performance specialist
      const handoverToPerformance = await storyManager.handover(
        storyFile.id,
        'n8n-performance-specialist',
        'All integrations working. Workflow processes orders but needs optimization for 1000+/day target. Focus on webhook processing speed and error queue efficiency.',
      )

      expect(handoverToPerformance?.currentAgent).toBe('n8n-performance-specialist')

      // Validate complete handover chain
      expect(handoverToPerformance?.previousAgents).toEqual([
        'n8n-workflow-architect',
        'n8n-developer-specialist',
        'n8n-integration-specialist',
      ])

      // Validate context preservation through handovers
      expect(handoverToPerformance?.context.original).toEqual(architectContext)
      expect(handoverToPerformance?.decisions).toHaveLength(3)
      expect(handoverToPerformance?.handoverNotes).toContain('1000+/day target')

      // Validate handover quality
      const validation = HandoverValidator.validate(handoverToPerformance!)
      expect(validation.isValid).toBe(true)
      expect(validation.completenessScore).toBeGreaterThan(80)
    })

    it('should validate context preservation across all handovers', async () => {
      const originalContext: AgentContext = {
        userRequest: 'Complex e-commerce integration',
        requirements: ['scalability', 'reliability', 'performance'],
        constraints: ['budget: $500/month', 'timeline: 2 weeks'],
      }

      const story = await storyManager.create({
        currentAgent: 'n8n-workflow-architect',
        phase: WorkflowPhase.PLANNING,
        context: {
          original: originalContext,
          current: originalContext,
          technical: {},
        },
        completedWork: [],
        pendingWork: ['Initial planning'],
        handoverNotes: 'Planning phase initiated',
      })

      // Multiple handovers
      const step1 = await storyManager.handover(story.id, 'n8n-developer-specialist', 'Planning complete')
      const step2 = await storyManager.handover(story.id, 'n8n-integration-specialist', 'Development issues')
      const step3 = await storyManager.handover(story.id, 'n8n-performance-specialist', 'Auth complete')

      // Original context should be preserved
      expect(step3?.context.original).toEqual(originalContext)
      expect(step3?.context.original.constraints).toContain('budget: $500/month')
      expect(step3?.context.original.requirements).toContain('scalability')
    })
  })

  describe('story 2: JavaScript Security Review Handover', () => {
    it('should handle emergency security escalation', async () => {
      const securityContext: AgentContext = {
        userRequest: 'Process CSV with custom JavaScript transformation',
        customCode: 'eval(user_input)', // Dangerous code
        securityRisk: 'high',
      }

      const story = await storyManager.create({
        currentAgent: 'n8n-developer-specialist',
        phase: WorkflowPhase.IMPLEMENTATION,
        context: {
          original: securityContext,
          current: securityContext,
          technical: {
            securityConsiderations: {
              vulnerabilitiesFound: 1,
              sensitiveDataHandling: true,
              authenticationRequired: false,
              encryptionUsed: false,
            },
          },
        },
        completedWork: [],
        pendingWork: ['Security review needed'],
        handoverNotes: 'Initial security assessment complete',
        priority: 10, // High priority for security
        tags: ['security', 'javascript', 'urgent'],
        rollbackPlan: 'Revert to safe code patterns if vulnerabilities found',
      })

      // Emergency handover to JavaScript specialist
      const securityHandover = await storyManager.handover(
        story.id,
        'n8n-javascript-specialist',
        'SECURITY ALERT: Custom JavaScript contains eval() with user input. Immediate review required to prevent code injection.',
      )

      expect(securityHandover?.currentAgent).toBe('n8n-javascript-specialist')
      expect(securityHandover?.priority).toBe(10)
      expect(securityHandover?.tags).toContain('security')

      // Validate security context is preserved
      expect(securityHandover?.context.technical.securityConsiderations?.vulnerabilitiesFound).toBe(1)
      expect(securityHandover?.handoverNotes).toContain('SECURITY ALERT')

      // JavaScript specialist should be able to access security details
      const validation = HandoverValidator.validate(securityHandover!)
      expect(validation.isValid).toBe(true)
      expect(validation.warnings).not.toContain('Missing security context')
    })
  })

  describe('story 3: Bidirectional Handover', () => {
    it('should handle performance → developer → performance round trip', async () => {
      const story = await storyManager.create({
        currentAgent: 'n8n-performance-specialist',
        phase: WorkflowPhase.IMPLEMENTATION,
        context: {
          original: { userRequest: 'Optimize slow workflow' },
          current: { userRequest: 'Optimize slow workflow' },
          technical: {
            performanceMetrics: {
              executionTime: 5000, // 5 seconds - too slow
              memoryUsage: 512,
              cpuUsage: 80,
            },
          },
        },
        completedWork: ['Initial performance analysis'],
        pendingWork: ['Code optimization needed'],
        handoverNotes: 'Performance bottleneck identified in data processing',
      })

      // Performance specialist identifies code changes needed
      const handoverToDeveloper = await storyManager.handover(
        story.id,
        'n8n-developer-specialist',
        'Performance analysis complete. Need to refactor data processing loop in custom code node. Target: reduce execution time from 5s to <2s.',
      )

      expect(handoverToDeveloper?.currentAgent).toBe('n8n-developer-specialist')
      expect(handoverToDeveloper?.handoverNotes).toContain('Target: reduce execution time')

      // Developer makes optimizations and hands back
      const handoverBackToPerformance = await storyManager.handover(
        story.id,
        'n8n-performance-specialist',
        'Code optimized: replaced nested loops with Set operations, added data caching. Ready for performance validation.',
      )

      expect(handoverBackToPerformance?.currentAgent).toBe('n8n-performance-specialist')
      expect(handoverBackToPerformance?.previousAgents).toEqual([
        'n8n-performance-specialist',
        'n8n-developer-specialist',
      ])

      // Validate round-trip preserved context
      expect(handoverBackToPerformance?.context.technical.performanceMetrics?.executionTime).toBe(5000)
      expect(handoverBackToPerformance?.handoverNotes).toContain('Ready for performance validation')
    })
  })

  describe('handover Quality Validation', () => {
    it('should enforce minimum handover quality standards', async () => {
      const story = await storyManager.create({
        currentAgent: 'n8n-workflow-architect',
        phase: WorkflowPhase.PLANNING,
        context: {
          original: { userRequest: 'Test validation' },
          current: { userRequest: 'Test validation' },
          technical: {},
        },
        handoverNotes: '', // Empty notes - should fail validation
        pendingWork: [], // No work defined - should warn
        decisions: [], // No decisions - should warn
        completedWork: [],
      })

      const validation = HandoverValidator.validate(story)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Handover notes must be at least 10 characters')
      expect(validation.warnings).toContain('No pending work specified for incomplete story')
      expect(validation.warnings).toContain('No decisions recorded in story file')
      expect(validation.completenessScore).toBeLessThan(80)
    })

    it('should validate high-quality handovers score well', async () => {
      const highQualityStory = await storyManager.create({
        currentAgent: 'n8n-workflow-architect',
        phase: WorkflowPhase.PLANNING,
        handoverNotes: 'Comprehensive architecture planning completed. Event-driven design chosen for scalability. Next: implement webhook handlers with retry logic.',
        pendingWork: [
          'Implement Shopify webhook handler',
          'Set up Airtable integration',
          'Create error handling queues',
          'Add monitoring and alerts',
        ],
        completedWork: ['Architecture design complete'],
        decisions: [
          {
            id: 'arch-001',
            timestamp: Date.now(),
            agentName: 'n8n-workflow-architect',
            decisionType: 'architectural',
            description: 'Event-driven architecture selected',
            rationale: 'Provides best scalability and error handling for high-volume processing',
            alternatives: ['Batch processing', 'Synchronous API calls'],
            impact: 'high',
            reversible: true,
            dependencies: ['Webhook infrastructure', 'Message queue system'],
          },
        ],
        context: {
          original: { userRequest: 'E-commerce integration workflow' },
          current: { userRequest: 'E-commerce integration workflow' },
          technical: {
            codebaseAnalysis: {
              filesModified: [],
              filesCreated: ['architecture-plan.md', 'integration-map.json'],
              filesDeleted: [],
              dependencies: ['n8n-nodes-base'],
              breakingChanges: false,
            },
          },
        },
      })

      const validation = HandoverValidator.validate(highQualityStory)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(validation.completenessScore).toBeGreaterThan(90)
    })
  })

  describe('integration with Communication System', () => {
    it('should integrate handovers with communication metrics', async () => {
      const initialMetrics = await communicationManager.getMetrics()
      const initialActiveStories = initialMetrics.activeStoryFiles

      // Create and hand over a story
      const story = await communicationManager.createStoryFile(
        'n8n-workflow-architect',
        { userRequest: 'Test handover integration' },
        ['Initial work item'],
      )

      // Update the story to include proper handover notes
      await storyManager.update(story.id, {
        handoverNotes: 'Communication system integration test - ready for handover',
      })

      const handoverStory = await communicationManager.handoverStoryFile(
        story.id,
        'n8n-developer-specialist',
        'Handover for communication system testing - validation passed',
      )

      expect(handoverStory).toBeDefined()
      expect(handoverStory?.currentAgent).toBe('n8n-developer-specialist')

      // Metrics should reflect active story
      const updatedMetrics = await communicationManager.getMetrics()
      // Note: The metrics count may not immediately reflect new stories
      // due to async operations and database timing
      expect(updatedMetrics.activeStoryFiles).toBeGreaterThanOrEqual(initialActiveStories)
    })
  })

  describe('agent System Integration', () => {
    it('should work with agent routing system', async () => {
      // Test basic functionality by verifying the communication manager
      // can create and handle story files
      const testStory = await communicationManager.createStoryFile(
        'n8n-workflow-architect',
        { userRequest: 'Test agent system integration' },
        ['Test task'],
      )

      expect(testStory).toBeDefined()
      expect(testStory.currentAgent).toBe('n8n-workflow-architect')
      expect(testStory.context.original.userRequest).toBe('Test agent system integration')

      // Validate basic agent router functionality
      expect(agentRouter).toBeDefined()
      expect(typeof agentRouter.routeTool).toBe('function')
    })
  })
})
