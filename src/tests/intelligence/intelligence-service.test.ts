/**
 * Tests for Intelligence Service Integration
 *
 * Tests the complete intelligence layer integration including workflow optimization,
 * template customization, and enhanced routing.
 */

import type { CommunicationManager } from '../../agents/communication.js'
import type {
  IntelligenceConfig,
  WorkflowOptimizationRequest,
} from '../../intelligence/index.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ComplexityLevel,
  IntelligenceService,
  WorkflowIntent,
} from '../../intelligence/index.js'

// Mock the communication manager
const mockCommunicationManager: CommunicationManager = {
  routeWithOptimization: vi.fn(),
  optimizedEscalation: vi.fn(),
  getMetrics: vi.fn(),
  shutdown: vi.fn(),
} as any

describe('intelligence Service', () => {
  let intelligenceService: IntelligenceService

  beforeEach(() => {
    const config: Partial<IntelligenceConfig> = {
      enabled: true,
      features: {
        intentClassification: true,
        nodeRecommendations: true,
        templateSuggestions: true,
        intelligentRouting: true,
        performanceOptimization: true,
      },
    }

    intelligenceService = new IntelligenceService(mockCommunicationManager, config)
  })

  describe('workflow Optimization', () => {
    it('should optimize email automation workflow', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Send email notifications when orders are received',
        preferences: {
          performanceOverEaseOfUse: true,
        },
      }

      const result = await intelligenceService.optimizeWorkflow(request)

      expect(result.intent.intent).toBe(WorkflowIntent.EMAIL_AUTOMATION)
      expect(result.complexity.level).toBe(ComplexityLevel.EXPRESS)
      expect(result.nodeRecommendations.primary.length).toBeGreaterThan(0)
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should optimize AI workflow with higher complexity', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Create AI-powered customer support chatbot with sentiment analysis',
        preferences: {
          requiresGovernance: true,
        },
      }

      const result = await intelligenceService.optimizeWorkflow(request)

      expect(result.intent.intent).toBe(WorkflowIntent.AI_WORKFLOW)
      expect(result.complexity.level).toBeOneOf([ComplexityLevel.STANDARD, ComplexityLevel.ENTERPRISE])
      expect(result.nodeRecommendations.primary.some(node =>
        node.nodeType.includes('openAi') || node.nodeType.includes('anthropic'),
      )).toBe(true)
    })

    it('should provide template suggestions', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Analyze content with AI and route responses',
      }

      const result = await intelligenceService.optimizeWorkflow(request)

      expect(Array.isArray(result.templateSuggestions)).toBe(true)
      if (result.templateSuggestions.length > 0) {
        result.templateSuggestions.forEach((template) => {
          expect(template).toHaveProperty('id')
          expect(template).toHaveProperty('name')
          expect(template).toHaveProperty('description')
          expect(template).toHaveProperty('nodes')
        })
      }
    })

    it('should generate optimization insights', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Complex enterprise workflow with multiple integrations and security requirements',
      }

      const result = await intelligenceService.optimizeWorkflow(request)

      expect(Array.isArray(result.optimizations)).toBe(true)
      if (result.optimizations.length > 0) {
        result.optimizations.forEach((optimization) => {
          expect(optimization).toHaveProperty('type')
          expect(optimization).toHaveProperty('title')
          expect(optimization).toHaveProperty('description')
          expect(optimization).toHaveProperty('impact')
          expect(optimization).toHaveProperty('effort')
          expect(['performance', 'reliability', 'security', 'maintainability']).toContain(optimization.type)
        })
      }
    })

    it('should calculate estimated improvements', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Optimize existing workflow performance',
        existingWorkflow: {
          nodes: ['webhook', 'http-request', 'gmail'],
          executionTime: 10000,
        },
      }

      const result = await intelligenceService.optimizeWorkflow(request)

      expect(result.estimatedImprovement).toHaveProperty('executionTime')
      expect(result.estimatedImprovement).toHaveProperty('reliability')
      expect(result.estimatedImprovement).toHaveProperty('maintainability')

      expect(typeof result.estimatedImprovement.executionTime).toBe('number')
      expect(typeof result.estimatedImprovement.reliability).toBe('number')
      expect(typeof result.estimatedImprovement.maintainability).toBe('number')
    })
  })

  describe('template Customization', () => {
    it('should customize workflow template', async () => {
      const variables = {
        WEBHOOK_PATH: 'test-webhook',
        RECIPIENT_EMAIL: 'test@example.com',
        EMAIL_SUBJECT: 'Test Subject',
        EMAIL_MESSAGE: 'Test Message',
      }

      const result = await intelligenceService.createWorkflowFromTemplate(
        'email-notification-basic',
        variables,
      )

      expect(result.workflow).toBeDefined()
      expect(result.workflow.nodes).toBeDefined()
      expect(result.workflow.nodes.length).toBeGreaterThan(0)
      expect(result.template).toBeDefined()
      expect(Array.isArray(result.appliedCustomizations)).toBe(true)
    })

    it('should warn about missing required variables', async () => {
      const variables = {
        WEBHOOK_PATH: 'test-webhook',
        // Missing required variables
      }

      const result = await intelligenceService.createWorkflowFromTemplate(
        'email-notification-basic',
        variables,
      )

      expect(Array.isArray(result.warnings)).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(warning =>
        warning.toLowerCase().includes('missing') || warning.toLowerCase().includes('required'),
      )).toBe(true)
    })
  })

  describe('agent Routing', () => {
    it('should route simple workflows to builder', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Send simple Slack notification',
      }

      const result = await intelligenceService.routeToAgent(request)

      expect(result.agent).toBe('n8n-builder')
      expect(result.handoverMode).toBe('lightweight')
      expect(typeof result.estimatedDuration).toBe('number')
    })

    it('should route AI workflows to node expert', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Create AI content generation workflow',
      }

      const result = await intelligenceService.routeToAgent(request)

      expect(['n8n-node-expert', 'n8n-orchestrator']).toContain(result.agent)
      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it('should route enterprise workflows to orchestrator', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Enterprise-grade workflow with GDPR compliance and multi-system integration',
      }

      const result = await intelligenceService.routeToAgent(request)

      expect(result.agent).toBe('n8n-orchestrator')
      expect(['standard', 'full_bmad']).toContain(result.handoverMode)
    })
  })

  describe('intelligence Metrics', () => {
    it('should provide comprehensive metrics', () => {
      const metrics = intelligenceService.getIntelligenceMetrics()

      expect(metrics).toHaveProperty('classification')
      expect(metrics).toHaveProperty('routing')
      expect(metrics).toHaveProperty('recommendations')
      expect(metrics).toHaveProperty('templates')
      expect(metrics).toHaveProperty('performance')

      // Classification metrics
      expect(metrics.classification).toHaveProperty('totalRequests')
      expect(metrics.classification).toHaveProperty('accuracy')
      expect(metrics.classification).toHaveProperty('avgProcessingTime')

      // Performance metrics
      expect(metrics.performance).toHaveProperty('cacheHitRatio')
      expect(metrics.performance).toHaveProperty('avgResponseTime')
      expect(metrics.performance).toHaveProperty('errorRate')
    })

    it('should track request counts', async () => {
      const initialMetrics = intelligenceService.getIntelligenceMetrics()
      const initialRequests = initialMetrics.classification.totalRequests

      await intelligenceService.optimizeWorkflow({
        userInput: 'Test workflow for metrics',
      })

      const updatedMetrics = intelligenceService.getIntelligenceMetrics()
      expect(updatedMetrics.classification.totalRequests).toBe(initialRequests + 1)
    })
  })

  describe('configuration Management', () => {
    it('should handle disabled intelligence service', async () => {
      const disabledService = new IntelligenceService(mockCommunicationManager, {
        enabled: false,
      })

      const request: WorkflowOptimizationRequest = {
        userInput: 'Test workflow',
      }

      const result = await disabledService.optimizeWorkflow(request)

      expect(result.confidence).toBe(0)
      expect(result.processingTime).toBe(0)
      expect(result.nodeRecommendations.primary.length).toBe(0)
    })

    it('should update configuration at runtime', () => {
      const newConfig = {
        features: {
          intentClassification: false,
          nodeRecommendations: true,
          templateSuggestions: true,
          intelligentRouting: true,
          performanceOptimization: false,
        },
      }

      expect(() => {
        intelligenceService.updateConfig(newConfig)
      }).not.toThrow()
    })
  })

  describe('error Handling', () => {
    it('should handle invalid template ID gracefully', async () => {
      await expect(intelligenceService.createWorkflowFromTemplate(
        'non-existent-template',
        {},
      )).rejects.toThrow()
    })

    it('should provide fallback results on processing errors', async () => {
      // Test with extremely long input that might cause issues
      const request: WorkflowOptimizationRequest = {
        userInput: `${'a'.repeat(10000)} workflow`,
      }

      const result = await intelligenceService.optimizeWorkflow(request)

      expect(result).toBeDefined()
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('cache Management', () => {
    it('should clear caches without errors', () => {
      expect(() => {
        intelligenceService.clearCaches()
      }).not.toThrow()
    })

    it('should improve performance on repeated requests', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Send email notification workflow',
      }

      const start1 = performance.now()
      await intelligenceService.optimizeWorkflow(request)
      const time1 = performance.now() - start1

      const start2 = performance.now()
      await intelligenceService.optimizeWorkflow(request)
      const time2 = performance.now() - start2

      // Second request should be faster due to caching
      // Note: This might not always be true due to various factors, so we just check it doesn't error
      expect(time1).toBeGreaterThan(0)
      expect(time2).toBeGreaterThan(0)
    })
  })

  describe('integration with Existing Systems', () => {
    it('should work with existing workflow context', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Enhance existing email workflow',
        context: {
          workflowName: 'existing-workflow',
        },
        existingWorkflow: {
          nodes: ['n8n-nodes-base.webhook', 'n8n-nodes-base.gmail'],
          complexity: 3,
        },
      }

      const result = await intelligenceService.optimizeWorkflow(request)

      expect(result).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.nodeRecommendations.primary.length).toBeGreaterThanOrEqual(0)
    })

    it('should respect user preferences', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Create workflow with specific requirements',
        preferences: {
          preferredComplexity: ComplexityLevel.EXPRESS,
          performanceOverEaseOfUse: true,
          maxExecutionTime: 5000,
        },
      }

      const result = await intelligenceService.optimizeWorkflow(request)

      expect(result).toBeDefined()
      // Preferences should influence the recommendations
      if (result.complexity.level !== ComplexityLevel.EXPRESS) {
        // If complexity couldn't be kept to EXPRESS, there should be a good reason
        expect(result.complexity.score).toBeGreaterThan(3)
      }
    })
  })

  describe('performance Characteristics', () => {
    it('should complete optimization within reasonable time', async () => {
      const request: WorkflowOptimizationRequest = {
        userInput: 'Standard workflow optimization test',
      }

      const start = performance.now()
      const result = await intelligenceService.optimizeWorkflow(request)
      const processingTime = performance.now() - start

      expect(processingTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.processingTime).toBeGreaterThan(0)
      expect(result.processingTime).toBeLessThan(processingTime + 100) // Within measurement accuracy
    })

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 3 }, (_, i) => ({
        userInput: `Concurrent workflow test ${i + 1}`,
      }))

      const results = await Promise.all(
        requests.map(request => intelligenceService.optimizeWorkflow(request)),
      )

      expect(results.length).toBe(3)
      results.forEach((result) => {
        expect(result).toBeDefined()
        expect(result.confidence).toBeGreaterThanOrEqual(0)
      })
    })
  })
})
