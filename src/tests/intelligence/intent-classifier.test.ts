/**
 * Tests for Intent Classification System
 *
 * Tests the intent classifier's ability to correctly identify workflow intents,
 * assess complexity, and provide appropriate routing recommendations.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ComplexityLevel,
  intentClassifier,
  RoutingStrategy,
  WorkflowIntent,
} from '../../intelligence/intent-classifier.js'

describe('intent Classifier', () => {
  beforeEach(() => {
    // Clear cache before each test
    intentClassifier.clearCache()
  })

  afterEach(() => {
    // Cleanup after each test
    intentClassifier.clearCache()
  })

  describe('email Automation Intent', () => {
    it('should classify email automation correctly', () => {
      const result = intentClassifier.classify('Send email notifications when new orders arrive')

      expect(result.intent).toBe(WorkflowIntent.EMAIL_AUTOMATION)
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.keywords).toContain('email')
      expect(result.estimatedNodes).toContain('Gmail')
    })

    it('should handle Gmail-specific requests', () => {
      const result = intentClassifier.classify('Use Gmail to send welcome emails to new customers')

      expect(result.intent).toBe(WorkflowIntent.EMAIL_AUTOMATION)
      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.keywords).toContain('gmail')
      expect(result.estimatedNodes).toContain('Gmail')
    })

    it('should suggest express complexity for simple email workflows', () => {
      const result = intentClassifier.classify('Send a simple email notification')

      expect(result.complexity).toBe(ComplexityLevel.EXPRESS)
      expect(result.suggestedRoute).toBe(RoutingStrategy.DIRECT_TO_BUILDER)
    })
  })

  describe('aI Workflow Intent', () => {
    it('should classify AI workflows with high confidence', () => {
      const result = intentClassifier.classify('Analyze customer feedback using OpenAI and generate summaries')

      expect(result.intent).toBe(WorkflowIntent.AI_WORKFLOW)
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.keywords).toContain('openai')
      expect(result.estimatedNodes).toContain('OpenAI')
    })

    it('should suggest node expert routing for AI workflows', () => {
      const result = intentClassifier.classify('Create an AI chatbot using Claude for customer support')

      expect(result.intent).toBe(WorkflowIntent.AI_WORKFLOW)
      expect(result.suggestedRoute).toBe(RoutingStrategy.NODE_EXPERT_FIRST)
      expect(result.complexity).toBe(ComplexityLevel.STANDARD)
    })

    it('should handle various AI providers', () => {
      const testCases = [
        'Use GPT-4 to analyze documents',
        'Create chatbot with Anthropic Claude',
        'Generate images with DALL-E',
        'Use machine learning for predictions',
      ]

      testCases.forEach((testCase) => {
        const result = intentClassifier.classify(testCase)
        expect(result.intent).toBe(WorkflowIntent.AI_WORKFLOW)
        expect(result.confidence).toBeGreaterThan(0.6)
      })
    })
  })

  describe('data Processing Intent', () => {
    it('should classify CSV processing correctly', () => {
      const result = intentClassifier.classify('Process CSV files and transform the data structure')

      expect(result.intent).toBe(WorkflowIntent.DATA_PROCESSING)
      expect(result.keywords).toContain('csv')
      expect(result.keywords).toContain('transform')
      expect(result.estimatedNodes).toContain('Edit Fields')
    })

    it('should suggest standard complexity for data processing', () => {
      const result = intentClassifier.classify('Transform JSON data and merge with database records')

      expect(result.intent).toBe(WorkflowIntent.DATA_PROCESSING)
      expect(result.complexity).toBe(ComplexityLevel.STANDARD)
    })
  })

  describe('aPI Integration Intent', () => {
    it('should classify API integrations', () => {
      const result = intentClassifier.classify('Connect to external REST API and process webhook responses')

      expect(result.intent).toBe(WorkflowIntent.API_INTEGRATION)
      expect(result.keywords).toContain('api')
      expect(result.keywords).toContain('webhook')
      expect(result.estimatedNodes).toContain('HTTP Request')
    })

    it('should suggest higher complexity for API integrations', () => {
      const result = intentClassifier.classify('Integrate multiple APIs with OAuth authentication')

      expect(result.intent).toBe(WorkflowIntent.API_INTEGRATION)
      expect(result.complexity).toBe(ComplexityLevel.STANDARD)
      expect(result.complexityScore).toBeGreaterThan(5)
    })
  })

  describe('complexity Assessment', () => {
    it('should increase complexity for security requirements', () => {
      const simple = intentClassifier.classify('Send email notification')
      const secure = intentClassifier.classify('Send secure encrypted email with OAuth authentication')

      expect(secure.complexityScore).toBeGreaterThan(simple.complexityScore)
      expect(secure.complexity).not.toBe(ComplexityLevel.EXPRESS)
    })

    it('should increase complexity for compliance keywords', () => {
      const result = intentClassifier.classify('Process customer data with GDPR compliance and audit trails')

      expect(result.complexityScore).toBeGreaterThan(8)
      expect(result.complexity).toBe(ComplexityLevel.ENTERPRISE)
      expect(result.suggestedRoute).toBe(RoutingStrategy.ORCHESTRATOR_REQUIRED)
    })

    it('should handle real-time processing complexity', () => {
      const result = intentClassifier.classify('Real-time data streaming with low-latency processing')

      expect(result.complexityScore).toBeGreaterThan(5)
      expect(result.keywords).toContain('real-time')
    })
  })

  describe('routing Strategy', () => {
    it('should route simple workflows directly to builder', () => {
      const result = intentClassifier.classify('Send notification to Slack')

      expect(result.complexity).toBe(ComplexityLevel.EXPRESS)
      expect(result.suggestedRoute).toBe(RoutingStrategy.DIRECT_TO_BUILDER)
    })

    it('should route AI workflows to node expert', () => {
      const result = intentClassifier.classify('Use AI to analyze customer sentiment')

      expect(result.intent).toBe(WorkflowIntent.AI_WORKFLOW)
      expect(result.suggestedRoute).toBe(RoutingStrategy.NODE_EXPERT_FIRST)
    })

    it('should route enterprise workflows to orchestrator', () => {
      const result = intentClassifier.classify('Enterprise-grade multi-system integration with GDPR compliance')

      expect(result.complexity).toBe(ComplexityLevel.ENTERPRISE)
      expect(result.suggestedRoute).toBe(RoutingStrategy.ORCHESTRATOR_REQUIRED)
    })
  })

  describe('edge Cases', () => {
    it('should handle empty input gracefully', () => {
      const result = intentClassifier.classify('')

      expect(result.intent).toBe(WorkflowIntent.UNKNOWN)
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should handle very long input', () => {
      const longInput = `${'a'.repeat(1000)} email notification workflow`
      const result = intentClassifier.classify(longInput)

      expect(result.intent).toBe(WorkflowIntent.EMAIL_AUTOMATION)
      expect(result.confidence).toBeGreaterThan(0.3)
    })

    it('should handle mixed intent scenarios', () => {
      const result = intentClassifier.classify('Send emails using AI to analyze data from API')

      // Should pick the strongest signal
      expect([WorkflowIntent.EMAIL_AUTOMATION, WorkflowIntent.AI_WORKFLOW, WorkflowIntent.API_INTEGRATION])
        .toContain(result.intent)
      expect(result.confidence).toBeGreaterThan(0.4)
    })
  })

  describe('cache Performance', () => {
    it('should cache classification results', () => {
      const input = 'Send email notifications'
      const result1 = intentClassifier.classify(input)
      const result2 = intentClassifier.classify(input)

      // Results should be identical (cached)
      expect(result1).toEqual(result2)
    })

    it('should provide cache statistics', () => {
      const stats = intentClassifier.getCacheStats()

      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('maxSize')
      expect(typeof stats.size).toBe('number')
      expect(typeof stats.maxSize).toBe('number')
    })

    it('should clear cache successfully', () => {
      intentClassifier.classify('test input')
      expect(intentClassifier.getCacheStats().size).toBeGreaterThan(0)

      intentClassifier.clearCache()
      expect(intentClassifier.getCacheStats().size).toBe(0)
    })
  })

  describe('confidence Scoring', () => {
    it('should provide higher confidence for clear intent', () => {
      const clear = intentClassifier.classify('Send Gmail email notification')
      const vague = intentClassifier.classify('do something with data')

      expect(clear.confidence).toBeGreaterThan(vague.confidence)
    })

    it('should have confidence between 0 and 1', () => {
      const testInputs = [
        'Send email notification',
        'Process CSV data with AI analysis',
        'Complex enterprise integration system',
        'vague input text',
      ]

      testInputs.forEach((input) => {
        const result = intentClassifier.classify(input)
        expect(result.confidence).toBeGreaterThanOrEqual(0)
        expect(result.confidence).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('keyword Extraction', () => {
    it('should extract relevant keywords', () => {
      const result = intentClassifier.classify('Send secure email notifications via Gmail with OAuth')

      expect(result.keywords.length).toBeGreaterThan(0)
      expect(result.keywords).toContain('email')
      expect(result.keywords).toContain('gmail')
    })

    it('should not include stop words', () => {
      const result = intentClassifier.classify('Send the email to the user via the API')

      expect(result.keywords).not.toContain('the')
      expect(result.keywords).not.toContain('to')
      expect(result.keywords).not.toContain('via')
    })
  })

  describe('reasoning Generation', () => {
    it('should provide clear reasoning', () => {
      const result = intentClassifier.classify('Send email using OpenAI for content generation')

      expect(result.reasoning).toBeTruthy()
      expect(typeof result.reasoning).toBe('string')
      expect(result.reasoning.length).toBeGreaterThan(10)
    })

    it('should include confidence in reasoning', () => {
      const result = intentClassifier.classify('Create AI-powered workflow')

      expect(result.reasoning).toContain('confidence')
    })
  })
})
