/**
 * Simplified Node Data Layer
 *
 * Extracts valuable node information from the complex intelligence layer
 * into a lightweight, efficient format for Phase 2 optimization.
 *
 * Philosophy: Simple, fast, memory-efficient node recommendations
 */

import type { N8NNodeDatabase } from '../types/core.js'
import { isIntelligenceEnabled } from './feature-flags.js'
import { logger } from './logger.js'

// === Simplified Node Types ===

export interface SimpleNodeRecommendation {
  nodeType: string
  displayName: string
  category: string
  confidence: number
  reasoning: string
  alternatives?: string[]
  isPopular?: boolean
  isRecommended?: boolean
}

export interface SimpleNodeContext {
  userInput: string
  intent?: 'workflow-creation' | 'data-processing' | 'automation' | 'integration' | 'unknown'
  preferences?: {
    providers?: string[]
    complexity?: 'simple' | 'standard' | 'advanced'
  }
}

// === Core Node Categories (simplified from complex intelligence layer) ===

const NODE_CATEGORIES = {
  // Core automation nodes
  core: ['Manual Trigger', 'Schedule Trigger', 'HTTP Request', 'If', 'Code', 'Wait'],

  // Popular integrations
  popular: ['OpenAI', 'Gmail', 'Slack', 'Google Sheets', 'Airtable', 'Notion'],

  // Data processing
  data: ['Code', 'Function', 'Item Lists', 'Merge', 'Split In Batches', 'Filter'],

  // Communication
  communication: ['Gmail', 'Slack', 'Discord', 'Telegram', 'Email Send'],

  // Storage & databases
  storage: ['Google Sheets', 'Airtable', 'MongoDB', 'PostgreSQL', 'MySQL'],

  // AI & ML
  ai: ['OpenAI', 'Anthropic', 'Hugging Face', 'Google AI'],
} as const

// === Intent Detection (lightweight alternative to complex intelligence) ===

export class SimplifiedIntentDetector {
  private static readonly INTENT_KEYWORDS = {
    'workflow-creation': ['create', 'build', 'make', 'setup', 'workflow', 'automation'],
    'data-processing': ['process', 'transform', 'filter', 'merge', 'split', 'data', 'csv', 'json'],
    'integration': ['connect', 'integrate', 'api', 'webhook', 'sync', 'send', 'fetch'],
    'automation': ['automate', 'trigger', 'schedule', 'monitor', 'watch', 'automatic'],
  } as const

  static detectIntent(userInput: string): SimpleNodeContext['intent'] {
    const input = userInput.toLowerCase()

    for (const [intent, keywords] of Object.entries(this.INTENT_KEYWORDS)) {
      if (keywords.some(keyword => input.includes(keyword))) {
        return intent as SimpleNodeContext['intent']
      }
    }

    return 'unknown'
  }
}

// === Simplified Node Recommender ===

export class SimplifiedNodeRecommender {
  private static nodeDatabase: N8NNodeDatabase[] = []
  private static isInitialized = false

  /**
   * Initialize with basic node data from database
   */
  static async initialize(database: { getAllNodes: () => Promise<N8NNodeDatabase[]> }): Promise<void> {
    if (this.isInitialized)
      return

    try {
      this.nodeDatabase = await database.getAllNodes()
      this.isInitialized = true

      logger.info('Simplified node recommender initialized', {
        nodeCount: this.nodeDatabase.length,
        categories: Object.keys(NODE_CATEGORIES).length,
      })
    }
    catch (error) {
      logger.warn('Failed to initialize simplified node recommender', error)
      this.nodeDatabase = []
    }
  }

  /**
   * Get lightweight node recommendations (replaces complex intelligence layer)
   */
  static getRecommendations(context: SimpleNodeContext): SimpleNodeRecommendation[] {
    // If complex intelligence is enabled, defer to that system
    if (isIntelligenceEnabled()) {
      return [] // Let complex system handle it
    }

    const { userInput, intent, preferences } = context
    const recommendations: SimpleNodeRecommendation[] = []

    // Step 1: Intent-based recommendations
    const intentRecommendations = this.getIntentBasedRecommendations(intent || 'unknown')
    recommendations.push(...intentRecommendations)

    // Step 2: Keyword-based recommendations
    const keywordRecommendations = this.getKeywordBasedRecommendations(userInput)
    recommendations.push(...keywordRecommendations)

    // Step 3: Popular node recommendations (fallback)
    if (recommendations.length < 3) {
      const popularRecommendations = this.getPopularRecommendations()
      recommendations.push(...popularRecommendations)
    }

    // Step 4: Apply preferences and deduplicate
    const filteredRecommendations = this.applyPreferences(recommendations, preferences)

    // Limit to top 5 recommendations for performance
    return filteredRecommendations.slice(0, 5)
  }

  /**
   * Get recommendations based on detected intent
   */
  private static getIntentBasedRecommendations(intent: NonNullable<SimpleNodeContext['intent']>): SimpleNodeRecommendation[] {
    const recommendations: SimpleNodeRecommendation[] = []

    switch (intent) {
      case 'workflow-creation':
        recommendations.push(
          {
            nodeType: 'Manual Trigger',
            displayName: 'Manual Trigger',
            category: 'trigger',
            confidence: 0.9,
            reasoning: 'Essential for starting workflows manually',
            isRecommended: true,
          },
          {
            nodeType: 'HTTP Request',
            displayName: 'HTTP Request',
            category: 'action',
            confidence: 0.8,
            reasoning: 'Versatile for API integrations',
            isPopular: true,
          },
        )
        break

      case 'data-processing':
        recommendations.push(
          {
            nodeType: 'Code',
            displayName: 'Code',
            category: 'transform',
            confidence: 0.9,
            reasoning: 'Flexible for custom data processing',
            isRecommended: true,
          },
          {
            nodeType: 'Function',
            displayName: 'Function',
            category: 'transform',
            confidence: 0.8,
            reasoning: 'Good for data transformations',
          },
        )
        break

      case 'integration':
        recommendations.push(
          {
            nodeType: 'HTTP Request',
            displayName: 'HTTP Request',
            category: 'action',
            confidence: 0.9,
            reasoning: 'Universal API integration tool',
            isRecommended: true,
          },
        )
        break

      case 'automation':
        recommendations.push(
          {
            nodeType: 'Schedule Trigger',
            displayName: 'Schedule Trigger',
            category: 'trigger',
            confidence: 0.9,
            reasoning: 'Essential for scheduled automation',
            isRecommended: true,
          },
        )
        break
    }

    return recommendations
  }

  /**
   * Get recommendations based on keywords in user input
   */
  private static getKeywordBasedRecommendations(userInput: string): SimpleNodeRecommendation[] {
    const input = userInput.toLowerCase()
    const recommendations: SimpleNodeRecommendation[] = []

    // Check for specific service mentions
    const serviceKeywords = {
      'gmail': 'Gmail',
      'google sheets': 'Google Sheets',
      'slack': 'Slack',
      'notion': 'Notion',
      'airtable': 'Airtable',
      'openai': 'OpenAI',
      'anthropic': 'Anthropic',
    }

    for (const [keyword, nodeType] of Object.entries(serviceKeywords)) {
      if (input.includes(keyword)) {
        recommendations.push({
          nodeType,
          displayName: nodeType,
          category: 'service',
          confidence: 0.8,
          reasoning: `Mentioned "${keyword}" in request`,
          isPopular: true,
        })
      }
    }

    return recommendations
  }

  /**
   * Get popular node recommendations as fallback
   */
  private static getPopularRecommendations(): SimpleNodeRecommendation[] {
    return NODE_CATEGORIES.popular.map(nodeType => ({
      nodeType,
      displayName: nodeType,
      category: 'popular',
      confidence: 0.6,
      reasoning: 'Popular and versatile node',
      isPopular: true,
    }))
  }

  /**
   * Apply user preferences to recommendations
   */
  private static applyPreferences(
    recommendations: SimpleNodeRecommendation[],
    preferences?: SimpleNodeContext['preferences'],
  ): SimpleNodeRecommendation[] {
    if (!preferences)
      return recommendations

    let filtered = recommendations

    // Apply provider preference
    if (preferences.providers?.length) {
      // Boost recommendations that match preferred providers
      filtered = filtered.map((rec) => {
        if (preferences.providers?.some(provider =>
          rec.nodeType.toLowerCase().includes(provider.toLowerCase()),
        )) {
          return { ...rec, confidence: Math.min(rec.confidence + 0.2, 1.0) }
        }
        return rec
      })
    }

    // Apply complexity preference
    if (preferences.complexity) {
      const complexityBoosts = {
        simple: ['Manual Trigger', 'HTTP Request', 'Gmail', 'Slack'],
        standard: ['Code', 'Function', 'Google Sheets', 'Airtable'],
        advanced: ['OpenAI', 'Anthropic', 'PostgreSQL', 'MongoDB'],
      }

      const preferredNodes = complexityBoosts[preferences.complexity] || []
      filtered = filtered.map((rec) => {
        if (preferredNodes.includes(rec.nodeType)) {
          return { ...rec, confidence: Math.min(rec.confidence + 0.1, 1.0) }
        }
        return rec
      })
    }

    // Sort by confidence and remove duplicates
    const seen = new Set<string>()
    return filtered
      .sort((a, b) => b.confidence - a.confidence)
      .filter((rec) => {
        if (seen.has(rec.nodeType))
          return false
        seen.add(rec.nodeType)
        return true
      })
  }

  /**
   * Get node categories for UI/tooling
   */
  static getCategories(): Record<string, string[]> {
    return {
      core: [...NODE_CATEGORIES.core],
      popular: [...NODE_CATEGORIES.popular],
      data: [...NODE_CATEGORIES.data],
      communication: [...NODE_CATEGORIES.communication],
      storage: [...NODE_CATEGORIES.storage],
      ai: [...NODE_CATEGORIES.ai],
    }
  }

  /**
   * Performance comparison helper
   */
  static async benchmarkAgainstIntelligence(context: SimpleNodeContext): Promise<{
    simplified: { recommendations: SimpleNodeRecommendation[], time: number }
    // intelligence: { recommendations: any[], time: number }
  }> {
    const startTime = performance.now()
    const simplified = this.getRecommendations(context)
    const simplifiedTime = performance.now() - startTime

    logger.debug('Node recommendation benchmark', {
      context: context.userInput.slice(0, 50),
      simplifiedTime: `${simplifiedTime.toFixed(2)}ms`,
      recommendationCount: simplified.length,
      pipeline: 'simplified',
    })

    return {
      simplified: {
        recommendations: simplified,
        time: simplifiedTime,
      },
    }
  }
}

// === Export simplified node data utilities ===

export function createSimpleNodeContext(
  userInput: string,
  preferences?: SimpleNodeContext['preferences'],
): SimpleNodeContext {
  const intent = SimplifiedIntentDetector.detectIntent(userInput)

  return {
    userInput,
    ...(intent !== undefined && { intent }),
    ...(preferences !== undefined && { preferences }),
  }
}

export function getBasicNodeRecommendations(userInput: string): SimpleNodeRecommendation[] {
  const context = createSimpleNodeContext(userInput)
  return SimplifiedNodeRecommender.getRecommendations(context)
}

// Default export for easy importing
export default SimplifiedNodeRecommender
