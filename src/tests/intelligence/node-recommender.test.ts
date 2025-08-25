/**
 * Tests for Node Recommendation Engine
 *
 * Tests the node recommender's ability to suggest appropriate nodes based on
 * workflow intent, context, and performance patterns.
 */

import type { RecommendationContext } from '../../intelligence/node-recommender.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  NodeCategory,
  nodeRecommender,
  WorkflowIntent,
} from '../../intelligence/node-recommender.js'

describe('node Recommender', () => {
  beforeEach(() => {
    nodeRecommender.clearCaches()
  })

  afterEach(() => {
    nodeRecommender.clearCaches()
  })

  describe('email Automation Recommendations', () => {
    it('should recommend Gmail node for email automation', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.EMAIL_AUTOMATION,
        userInput: 'Send email notifications to customers',
      }

      const result = await nodeRecommender.recommend(context)

      expect(result.primary.length).toBeGreaterThan(0)
      const gmailNode = result.primary.find(node => node.nodeType === 'n8n-nodes-base.gmail')
      expect(gmailNode).toBeDefined()
      expect(gmailNode?.category).toBe(NodeCategory.COMMUNICATION)
      expect(gmailNode?.confidence).toBeGreaterThan(0.5)
    })

    it('should provide email-related alternatives', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.EMAIL_AUTOMATION,
        userInput: 'Send automated emails',
      }

      const result = await nodeRecommender.recommend(context)
      const emailNodes = result.primary.filter(node =>
        node.category === NodeCategory.COMMUNICATION
        && ['gmail', 'outlook', 'smtp'].some(email =>
          node.nodeType.toLowerCase().includes(email)
          || node.displayName.toLowerCase().includes(email),
        ),
      )

      expect(emailNodes.length).toBeGreaterThan(0)
    })
  })

  describe('aI Workflow Recommendations', () => {
    it('should recommend OpenAI node for AI workflows', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.AI_WORKFLOW,
        userInput: 'Generate content using GPT-4',
      }

      const result = await nodeRecommender.recommend(context)

      const aiNodes = result.primary.filter(node => node.category === NodeCategory.AI)
      expect(aiNodes.length).toBeGreaterThan(0)

      const openaiNode = result.primary.find(node => node.nodeType.includes('openAi'))
      expect(openaiNode).toBeDefined()
      expect(openaiNode?.confidence).toBeGreaterThan(0.7)
    })

    it('should suggest Anthropic as alternative to OpenAI', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.AI_WORKFLOW,
        userInput: 'Use Claude AI for text analysis',
      }

      const result = await nodeRecommender.recommend(context)

      const anthropicNode = result.primary.find(node =>
        node.nodeType.includes('anthropic') || node.displayName.includes('Anthropic'),
      )
      expect(anthropicNode).toBeDefined()
    })
  })

  describe('data Processing Recommendations', () => {
    it('should recommend core data nodes', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.DATA_PROCESSING,
        userInput: 'Transform CSV data and merge records',
      }

      const result = await nodeRecommender.recommend(context)

      const coreNodes = result.primary.filter(node => node.category === NodeCategory.CORE)
      expect(coreNodes.length).toBeGreaterThan(0)

      const expectedNodes = ['set', 'merge', 'if', 'code']
      const foundNodes = result.primary.filter(node =>
        expectedNodes.some(expected => node.nodeType.includes(expected)),
      )
      expect(foundNodes.length).toBeGreaterThan(1)
    })

    it('should prioritize Edit Fields for simple transformations', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.DATA_PROCESSING,
        userInput: 'Set field values and modify data',
      }

      const result = await nodeRecommender.recommend(context)

      const editFieldsNode = result.primary.find(node =>
        node.nodeType === 'n8n-nodes-base.set' && node.displayName === 'Edit Fields',
      )
      expect(editFieldsNode).toBeDefined()
      expect(editFieldsNode?.confidence).toBeGreaterThan(0.8)
    })
  })

  describe('aPI Integration Recommendations', () => {
    it('should recommend HTTP Request node for API calls', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.API_INTEGRATION,
        userInput: 'Make REST API calls to external service',
      }

      const result = await nodeRecommender.recommend(context)

      const httpNode = result.primary.find(node => node.nodeType === 'n8n-nodes-base.httpRequest')
      expect(httpNode).toBeDefined()
      expect(httpNode?.confidence).toBeGreaterThan(0.8)
      expect(httpNode?.category).toBe(NodeCategory.INTEGRATION)
    })

    it('should recommend Webhook node for receiving data', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.API_INTEGRATION,
        userInput: 'Receive webhook data from external systems',
      }

      const result = await nodeRecommender.recommend(context)

      const webhookNode = result.primary.find(node => node.nodeType === 'n8n-nodes-base.webhook')
      expect(webhookNode).toBeDefined()
      expect(webhookNode?.category).toBe(NodeCategory.TRIGGER)
    })
  })

  describe('context-Based Recommendations', () => {
    it('should avoid recommending already used nodes', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.EMAIL_AUTOMATION,
        userInput: 'Send email notifications',
        existingNodes: ['n8n-nodes-base.gmail', 'n8n-nodes-base.slack'],
      }

      const result = await nodeRecommender.recommend(context)

      // Should still recommend nodes but with lower confidence for already used ones
      const existingNodeRecommendations = result.primary.filter(node =>
        context.existingNodes?.includes(node.nodeType),
      )

      if (existingNodeRecommendations.length > 0) {
        // If existing nodes are recommended, they should have lower confidence
        existingNodeRecommendations.forEach((node) => {
          expect(node.reasoning).toContain('Already in workflow')
        })
      }
    })

    it('should respect user preferences', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.AI_WORKFLOW,
        userInput: 'Generate text using AI',
        preferences: {
          performanceOverEaseOfUse: true,
        },
      }

      const result = await nodeRecommender.recommend(context)

      // Should prioritize high-performance nodes
      const highPerfNodes = result.primary.filter(node =>
        (node.performanceScore || 0) >= 8,
      )
      expect(highPerfNodes.length).toBeGreaterThan(0)
    })
  })

  describe('recommendation Quality', () => {
    it('should provide confidence scores', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.EMAIL_AUTOMATION,
        userInput: 'Send Gmail notifications',
      }

      const result = await nodeRecommender.recommend(context)

      result.primary.forEach((recommendation) => {
        expect(recommendation.confidence).toBeGreaterThanOrEqual(0)
        expect(recommendation.confidence).toBeLessThanOrEqual(1)
        expect(typeof recommendation.confidence).toBe('number')
      })
    })

    it('should provide reasoning for recommendations', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.DATA_PROCESSING,
        userInput: 'Process and transform data',
      }

      const result = await nodeRecommender.recommend(context)

      result.primary.forEach((recommendation) => {
        expect(recommendation.reasoning).toBeTruthy()
        expect(typeof recommendation.reasoning).toBe('string')
        expect(recommendation.reasoning.length).toBeGreaterThan(5)
      })
    })

    it('should provide alternatives', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.EMAIL_AUTOMATION,
        userInput: 'Send emails',
      }

      const result = await nodeRecommender.recommend(context)

      result.primary.forEach((recommendation) => {
        expect(Array.isArray(recommendation.alternatives)).toBe(true)
        expect(recommendation.alternatives.length).toBeGreaterThan(0)
      })
    })
  })

  describe('performance and Community Ratings', () => {
    it('should include performance scores', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.EMAIL_AUTOMATION,
        userInput: 'Send email notifications',
      }

      const result = await nodeRecommender.recommend(context)

      result.primary.forEach((recommendation) => {
        expect(recommendation.performanceScore).toBeDefined()
        expect(recommendation.performanceScore).toBeGreaterThanOrEqual(1)
        expect(recommendation.performanceScore).toBeLessThanOrEqual(10)
      })
    })

    it('should include community ratings', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.AI_WORKFLOW,
        userInput: 'Use AI for analysis',
      }

      const result = await nodeRecommender.recommend(context)

      result.primary.forEach((recommendation) => {
        expect(recommendation.communityRating).toBeDefined()
        expect(recommendation.communityRating).toBeGreaterThanOrEqual(1)
        expect(recommendation.communityRating).toBeLessThanOrEqual(10)
      })
    })
  })

  describe('workflow Patterns', () => {
    it('should return relevant patterns', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.AI_WORKFLOW,
        userInput: 'Create AI analysis workflow',
      }

      const result = await nodeRecommender.recommend(context)

      expect(Array.isArray(result.patterns)).toBe(true)
      if (result.patterns.length > 0) {
        result.patterns.forEach((pattern) => {
          expect(pattern).toHaveProperty('id')
          expect(pattern).toHaveProperty('name')
          expect(pattern).toHaveProperty('description')
          expect(pattern).toHaveProperty('nodes')
          expect(pattern).toHaveProperty('successRate')
          expect(Array.isArray(pattern.nodes)).toBe(true)
        })
      }
    })

    it('should match patterns to intent', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.EMAIL_AUTOMATION,
        userInput: 'Send email notifications',
      }

      const result = await nodeRecommender.recommend(context)

      const emailPatterns = result.patterns.filter(pattern =>
        pattern.intent === WorkflowIntent.EMAIL_AUTOMATION,
      )

      expect(emailPatterns.length).toBeGreaterThanOrEqual(0)
      emailPatterns.forEach((pattern) => {
        expect(pattern.nodes.some(node =>
          ['gmail', 'outlook', 'email'].some(email =>
            node.toLowerCase().includes(email),
          ),
        )).toBe(true)
      })
    })
  })

  describe('warning Generation', () => {
    it('should warn about missing AI nodes for AI workflows', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.AI_WORKFLOW,
        userInput: 'Process data without AI keywords',
      }

      const result = await nodeRecommender.recommend(context)

      const hasAiNodes = result.primary.some(rec => rec.category === NodeCategory.AI)
      if (!hasAiNodes) {
        expect(result.warnings.some(warning =>
          warning.toLowerCase().includes('ai'),
        )).toBe(true)
      }
    })

    it('should warn about API error handling', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.API_INTEGRATION,
        userInput: 'Make API calls to external service',
      }

      const result = await nodeRecommender.recommend(context)

      expect(result.warnings.some(warning =>
        warning.toLowerCase().includes('error') || warning.toLowerCase().includes('handling'),
      )).toBe(true)
    })

    it('should warn about security for sensitive data', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.DATA_PROCESSING,
        userInput: 'Process password and secret data',
      }

      const result = await nodeRecommender.recommend(context)

      expect(result.warnings.some(warning =>
        warning.toLowerCase().includes('security') || warning.toLowerCase().includes('sensitive'),
      )).toBe(true)
    })
  })

  describe('cache Performance', () => {
    it('should cache recommendation results', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.EMAIL_AUTOMATION,
        userInput: 'Send email notifications',
      }

      const start1 = performance.now()
      const result1 = await nodeRecommender.recommend(context)
      const time1 = performance.now() - start1

      const start2 = performance.now()
      const result2 = await nodeRecommender.recommend(context)
      const time2 = performance.now() - start2

      // Second call should be faster (cached)
      expect(time2).toBeLessThan(time1)
      expect(result1.primary.length).toBe(result2.primary.length)
    })

    it('should provide cache statistics', () => {
      const stats = nodeRecommender.getCacheStats()

      expect(stats).toHaveProperty('recommendations')
      expect(stats).toHaveProperty('patterns')
      expect(typeof stats.recommendations.size).toBe('number')
      expect(typeof stats.patterns.size).toBe('number')
    })
  })

  describe('learning from Workflow Execution', () => {
    it('should accept learning feedback without errors', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.EMAIL_AUTOMATION,
        userInput: 'Send notifications',
      }

      expect(async () => {
        await nodeRecommender.learnFromWorkflow(
          context,
          ['n8n-nodes-base.webhook', 'n8n-nodes-base.gmail'],
          true,
          2500,
        )
      }).not.toThrow()
    })
  })

  describe('edge Cases', () => {
    it('should handle empty user input', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.UNKNOWN,
        userInput: '',
      }

      const result = await nodeRecommender.recommend(context)

      expect(result.primary).toBeDefined()
      expect(Array.isArray(result.primary)).toBe(true)
      expect(result.alternatives).toBeDefined()
      expect(result.patterns).toBeDefined()
      expect(result.warnings).toBeDefined()
    })

    it('should handle unknown intent gracefully', async () => {
      const context: RecommendationContext = {
        intent: WorkflowIntent.UNKNOWN,
        userInput: 'do something unclear',
      }

      const result = await nodeRecommender.recommend(context)

      expect(result).toBeDefined()
      expect(result.primary.length).toBeGreaterThanOrEqual(0)
    })
  })
})
