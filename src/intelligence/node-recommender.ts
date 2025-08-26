/**
 * Adaptive Node Intelligence Engine for n8n Workflows
 *
 * Provides intelligent node recommendations based on user intent, workflow patterns,
 * and performance analysis. Learns from successful workflows to improve suggestions.
 *
 * Philosophy: Simple scoring algorithm initially, with ML upgrade path ready.
 */

import { logger } from '../server/logger.js'
import { WorkflowIntent } from './intent-classifier.js'

// === Node Recommendation Types ===

export interface NodeRecommendation {
  nodeType: string
  displayName: string
  confidence: number
  reasoning: string
  category: NodeCategory
  alternatives: string[]
  configuration?: Record<string, unknown>
  performanceScore?: number
  communityRating?: number
}

export interface WorkflowPattern {
  id: string
  name: string
  description: string
  nodes: string[]
  successRate: number
  avgExecutionTime: number
  usageCount: number
  intent: WorkflowIntent
  complexity: number
}

export interface RecommendationContext {
  intent: WorkflowIntent
  userInput: string
  existingNodes?: string[]
  preferences?: UserPreferences
  constraints?: WorkflowConstraints
}

export interface UserPreferences {
  preferredProviders?: string[]
  avoidProviders?: string[]
  performanceOverEaseOfUse?: boolean
  costSensitive?: boolean
}

export interface WorkflowConstraints {
  maxNodes?: number
  requiredSecurity?: boolean
  cloudOnly?: boolean
  onPremiseOnly?: boolean
}

export enum NodeCategory {
  TRIGGER = 'trigger',
  ACTION = 'action',
  CORE = 'core',
  AI = 'ai',
  COMMUNICATION = 'communication',
  DATA = 'data',
  STORAGE = 'storage',
  INTEGRATION = 'integration',
}

// === Node Database (Lean Implementation) ===

interface NodeDefinition {
  nodeType: string
  displayName: string
  category: NodeCategory
  description: string
  intents: WorkflowIntent[]
  baseScore: number
  tags: string[]
  alternatives: string[]
  commonConfigurations: Record<string, unknown>[]
  performanceRating: number // 1-10 scale
  communityRating: number // 1-10 scale
  dependencies?: string[]
}

/**
 * Curated node database based on the 525+ nodes available in n8n
 * Focused on most commonly used and high-value nodes
 */
const NODE_DATABASE: NodeDefinition[] = [
  // === Trigger Nodes ===
  {
    nodeType: 'n8n-nodes-base.manualTrigger',
    displayName: 'Manual Trigger',
    category: NodeCategory.TRIGGER,
    description: 'Manually trigger workflow execution',
    intents: [WorkflowIntent.UNKNOWN],
    baseScore: 5,
    tags: ['manual', 'testing', 'simple'],
    alternatives: ['Schedule Trigger', 'Webhook'],
    commonConfigurations: [{}],
    performanceRating: 10,
    communityRating: 9,
  },
  {
    nodeType: 'n8n-nodes-base.scheduleTrigger',
    displayName: 'Schedule Trigger',
    category: NodeCategory.TRIGGER,
    description: 'Trigger workflows on a schedule',
    intents: [WorkflowIntent.SCHEDULING],
    baseScore: 9,
    tags: ['schedule', 'cron', 'periodic', 'automation'],
    alternatives: ['Cron Trigger', 'Manual Trigger'],
    commonConfigurations: [
      { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } },
      { rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] } },
    ],
    performanceRating: 9,
    communityRating: 10,
  },
  {
    nodeType: 'n8n-nodes-base.webhook',
    displayName: 'Webhook',
    category: NodeCategory.TRIGGER,
    description: 'Receive HTTP requests to trigger workflows',
    intents: [WorkflowIntent.API_INTEGRATION],
    baseScore: 9,
    tags: ['webhook', 'http', 'api', 'trigger', 'realtime'],
    alternatives: ['HTTP Request', 'Form Trigger'],
    commonConfigurations: [
      { httpMethod: 'POST', path: 'webhook' },
      { httpMethod: 'GET', path: 'status' },
    ],
    performanceRating: 9,
    communityRating: 9,
  },

  // === Communication Nodes ===
  {
    nodeType: 'n8n-nodes-base.gmail',
    displayName: 'Gmail',
    category: NodeCategory.COMMUNICATION,
    description: 'Send and manage Gmail emails',
    intents: [WorkflowIntent.EMAIL_AUTOMATION],
    baseScore: 9,
    tags: ['email', 'gmail', 'google', 'communication'],
    alternatives: ['Microsoft Outlook', 'SMTP'],
    commonConfigurations: [
      { operation: 'send', sendTo: '', subject: '', message: '' },
    ],
    performanceRating: 8,
    communityRating: 9,
  },
  {
    nodeType: 'n8n-nodes-base.slack',
    displayName: 'Slack',
    category: NodeCategory.COMMUNICATION,
    description: 'Send messages and manage Slack workspace',
    intents: [WorkflowIntent.NOTIFICATION],
    baseScore: 9,
    tags: ['slack', 'messaging', 'notification', 'team'],
    alternatives: ['Discord', 'Microsoft Teams'],
    commonConfigurations: [
      { operation: 'postMessage', channel: '#general', text: '' },
    ],
    performanceRating: 9,
    communityRating: 10,
  },
  {
    nodeType: 'n8n-nodes-base.discord',
    displayName: 'Discord',
    category: NodeCategory.COMMUNICATION,
    description: 'Send messages to Discord channels',
    intents: [WorkflowIntent.NOTIFICATION],
    baseScore: 8,
    tags: ['discord', 'messaging', 'notification', 'community'],
    alternatives: ['Slack', 'Telegram'],
    commonConfigurations: [
      { operation: 'sendMessage', content: '' },
    ],
    performanceRating: 8,
    communityRating: 8,
  },

  // === AI Nodes ===
  {
    nodeType: 'n8n-nodes-base.openAi',
    displayName: 'OpenAI',
    category: NodeCategory.AI,
    description: 'Generate text, images, and analyze content with OpenAI',
    intents: [WorkflowIntent.AI_WORKFLOW],
    baseScore: 10,
    tags: ['ai', 'openai', 'gpt', 'generation', 'analysis'],
    alternatives: ['Anthropic', 'Google Gemini'],
    commonConfigurations: [
      { operation: 'message', model: 'gpt-4o-mini' },
      { operation: 'image', model: 'dall-e-3' },
    ],
    performanceRating: 9,
    communityRating: 10,
  },
  {
    nodeType: 'n8n-nodes-langchain.anthropic',
    displayName: 'Anthropic',
    category: NodeCategory.AI,
    description: 'Use Claude AI models for text generation and analysis',
    intents: [WorkflowIntent.AI_WORKFLOW],
    baseScore: 9,
    tags: ['ai', 'anthropic', 'claude', 'generation', 'analysis'],
    alternatives: ['OpenAI', 'Google Gemini'],
    commonConfigurations: [
      { operation: 'message', model: 'claude-3-5-sonnet-20241022' },
    ],
    performanceRating: 9,
    communityRating: 9,
  },

  // === Data Processing Nodes ===
  {
    nodeType: 'n8n-nodes-base.set',
    displayName: 'Edit Fields',
    category: NodeCategory.CORE,
    description: 'Set, modify, and transform data fields',
    intents: [WorkflowIntent.DATA_PROCESSING],
    baseScore: 10,
    tags: ['data', 'transform', 'fields', 'set', 'modify'],
    alternatives: ['Code', 'Function'],
    commonConfigurations: [
      { assignments: { assignments: [] } },
    ],
    performanceRating: 10,
    communityRating: 10,
  },
  {
    nodeType: 'n8n-nodes-base.merge',
    displayName: 'Merge',
    category: NodeCategory.CORE,
    description: 'Combine data from multiple sources',
    intents: [WorkflowIntent.DATA_PROCESSING],
    baseScore: 9,
    tags: ['data', 'merge', 'combine', 'join'],
    alternatives: ['Code', 'Function'],
    commonConfigurations: [
      { mode: 'combine' },
      { mode: 'merge' },
    ],
    performanceRating: 9,
    communityRating: 9,
  },
  {
    nodeType: 'n8n-nodes-base.if',
    displayName: 'If',
    category: NodeCategory.CORE,
    description: 'Conditional logic and branching',
    intents: [WorkflowIntent.DATA_PROCESSING, WorkflowIntent.UNKNOWN],
    baseScore: 9,
    tags: ['condition', 'logic', 'branch', 'if'],
    alternatives: ['Switch', 'Code'],
    commonConfigurations: [
      { conditions: { conditions: [] } },
    ],
    performanceRating: 10,
    communityRating: 10,
  },
  {
    nodeType: 'n8n-nodes-base.code',
    displayName: 'Code',
    category: NodeCategory.CORE,
    description: 'Execute custom JavaScript code',
    intents: [WorkflowIntent.DATA_PROCESSING, WorkflowIntent.UNKNOWN],
    baseScore: 8,
    tags: ['code', 'javascript', 'custom', 'advanced'],
    alternatives: ['Function', 'Edit Fields'],
    commonConfigurations: [
      { jsCode: 'return items;' },
    ],
    performanceRating: 7,
    communityRating: 8,
  },

  // === HTTP & API Nodes ===
  {
    nodeType: 'n8n-nodes-base.httpRequest',
    displayName: 'HTTP Request',
    category: NodeCategory.INTEGRATION,
    description: 'Make HTTP requests to APIs and services',
    intents: [WorkflowIntent.API_INTEGRATION],
    baseScore: 10,
    tags: ['http', 'api', 'request', 'rest'],
    alternatives: ['Webhook', 'specific service nodes'],
    commonConfigurations: [
      { method: 'GET', url: '' },
      { method: 'POST', url: '', body: {} },
    ],
    performanceRating: 9,
    communityRating: 10,
  },

  // === Storage Nodes ===
  {
    nodeType: 'n8n-nodes-base.googleDrive',
    displayName: 'Google Drive',
    category: NodeCategory.STORAGE,
    description: 'Manage files in Google Drive',
    intents: [WorkflowIntent.FILE_PROCESSING],
    baseScore: 9,
    tags: ['google', 'drive', 'file', 'storage', 'cloud'],
    alternatives: ['Dropbox', 'OneDrive'],
    commonConfigurations: [
      { operation: 'upload', name: '', data: '' },
    ],
    performanceRating: 8,
    communityRating: 9,
  },

  // === Database Nodes ===
  {
    nodeType: 'n8n-nodes-base.airtable',
    displayName: 'Airtable',
    category: NodeCategory.STORAGE,
    description: 'Manage data in Airtable bases',
    intents: [WorkflowIntent.DATABASE_OPERATION],
    baseScore: 9,
    tags: ['airtable', 'database', 'table', 'records'],
    alternatives: ['Notion', 'MySQL'],
    commonConfigurations: [
      { operation: 'create', application: '', table: '' },
    ],
    performanceRating: 8,
    communityRating: 9,
  },
  {
    nodeType: 'n8n-nodes-base.notion',
    displayName: 'Notion',
    category: NodeCategory.STORAGE,
    description: 'Manage Notion pages and databases',
    intents: [WorkflowIntent.DATABASE_OPERATION],
    baseScore: 8,
    tags: ['notion', 'database', 'pages', 'knowledge'],
    alternatives: ['Airtable', 'Google Sheets'],
    commonConfigurations: [
      { resource: 'page', operation: 'create' },
    ],
    performanceRating: 7,
    communityRating: 8,
  },
]

// === Node Recommender Implementation ===

export class NodeRecommender {
  private patternCache = new Map<string, WorkflowPattern[]>()
  private recommendationCache = new Map<string, NodeRecommendation[]>()

  /**
   * Get node recommendations based on intent and context
   */
  async recommend(context: RecommendationContext): Promise<{
    primary: NodeRecommendation[]
    alternatives: NodeRecommendation[]
    patterns: WorkflowPattern[]
    warnings: string[]
  }> {
    const cacheKey = this.generateCacheKey(context)

    // Check cache
    const cached = this.recommendationCache.get(cacheKey)
    if (cached) {
      logger.debug('Node recommendation cache hit', { intent: context.intent })
      return {
        primary: cached,
        alternatives: [],
        patterns: [],
        warnings: [],
      }
    }

    logger.debug('Generating node recommendations', {
      intent: context.intent,
      userInput: context.userInput,
    })

    // Get relevant patterns
    const patterns = await this.getRelevantPatterns(context.intent)

    // Score and rank nodes
    const recommendations = this.scoreNodes(context)

    // Separate primary and alternatives
    const primary = recommendations.slice(0, 5)
    const alternatives = recommendations.slice(5, 10)

    // Generate warnings
    const warnings = this.generateWarnings(context, primary)

    // Cache results
    this.recommendationCache.set(cacheKey, primary)

    const result = {
      primary,
      alternatives,
      patterns,
      warnings,
    }

    logger.debug('Node recommendations generated', {
      primaryCount: primary.length,
      alternativesCount: alternatives.length,
      patternsCount: patterns.length,
    })

    return result
  }

  /**
   * Score nodes based on context and patterns
   */
  private scoreNodes(context: RecommendationContext): NodeRecommendation[] {
    const scored: Array<{
      node: NodeDefinition
      score: number
      reasoning: string[]
    }> = []

    for (const node of NODE_DATABASE) {
      const reasoningFactors: string[] = []
      let score = node.baseScore

      // Intent matching
      if (node.intents.includes(context.intent)) {
        score += 20
        reasoningFactors.push(`Matches ${context.intent} intent`)
      }

      // Keyword matching in user input
      const inputLower = context.userInput.toLowerCase()
      for (const tag of node.tags) {
        if (inputLower.includes(tag)) {
          score += 5
          reasoningFactors.push(`Keyword match: "${tag}"`)
        }
      }

      // Performance and community ratings
      score += (node.performanceRating / 10) * 5
      score += (node.communityRating / 10) * 3

      if (node.performanceRating >= 8) {
        reasoningFactors.push('High performance rating')
      }
      if (node.communityRating >= 9) {
        reasoningFactors.push('Popular in community')
      }

      // User preferences
      if (context.preferences?.performanceOverEaseOfUse && node.performanceRating >= 8) {
        score += 5
        reasoningFactors.push('High performance (per preferences)')
      }

      // Avoid already used nodes (for diversity)
      if (context.existingNodes?.includes(node.nodeType)) {
        score -= 10
        reasoningFactors.push('Already in workflow')
      }

      if (score > 0) {
        scored.push({
          node,
          score,
          reasoning: reasoningFactors,
        })
      }
    }

    // Sort by score and convert to recommendations
    return scored
      .sort((a, b) => b.score - a.score)
      .map(({ node, score, reasoning }) => ({
        nodeType: node.nodeType,
        displayName: node.displayName,
        confidence: Math.min(score / 50, 1.0), // Normalize to 0-1
        reasoning: reasoning.join(', ') || 'General recommendation',
        category: node.category,
        alternatives: node.alternatives,
        ...(node.commonConfigurations[0] && { configuration: node.commonConfigurations[0] }),
        performanceScore: node.performanceRating,
        communityRating: node.communityRating,
      }))
  }

  /**
   * Get relevant workflow patterns for intent
   */
  private async getRelevantPatterns(intent: WorkflowIntent): Promise<WorkflowPattern[]> {
    const cached = this.patternCache.get(intent)
    if (cached) {
      return cached
    }

    // For now, return common patterns based on intent
    // Later this would query the database for learned patterns
    const patterns = this.getCommonPatterns(intent)

    this.patternCache.set(intent, patterns)
    return patterns
  }

  /**
   * Get common workflow patterns (hardcoded for lean implementation)
   */
  private getCommonPatterns(intent: WorkflowIntent): WorkflowPattern[] {
    const commonPatterns: Record<WorkflowIntent, WorkflowPattern[]> = {
      [WorkflowIntent.EMAIL_AUTOMATION]: [
        {
          id: 'email-notification',
          name: 'Email Notification',
          description: 'Send email notifications with data processing',
          nodes: ['Manual Trigger', 'Edit Fields', 'Gmail'],
          successRate: 0.95,
          avgExecutionTime: 2000,
          usageCount: 1250,
          intent: WorkflowIntent.EMAIL_AUTOMATION,
          complexity: 2,
        },
      ],
      [WorkflowIntent.DATA_PROCESSING]: [
        {
          id: 'data-transform',
          name: 'Data Transformation',
          description: 'Process and transform data with validation',
          nodes: ['Manual Trigger', 'Edit Fields', 'If', 'Code'],
          successRate: 0.88,
          avgExecutionTime: 1500,
          usageCount: 980,
          intent: WorkflowIntent.DATA_PROCESSING,
          complexity: 3,
        },
      ],
      [WorkflowIntent.AI_WORKFLOW]: [
        {
          id: 'ai-analysis',
          name: 'AI Content Analysis',
          description: 'Analyze content with AI and route based on results',
          nodes: ['Webhook', 'OpenAI', 'If', 'Slack'],
          successRate: 0.92,
          avgExecutionTime: 5000,
          usageCount: 750,
          intent: WorkflowIntent.AI_WORKFLOW,
          complexity: 4,
        },
      ],
      [WorkflowIntent.API_INTEGRATION]: [
        {
          id: 'api-webhook',
          name: 'API Integration',
          description: 'Receive webhook data and make API calls',
          nodes: ['Webhook', 'HTTP Request', 'If', 'Edit Fields'],
          successRate: 0.89,
          avgExecutionTime: 3000,
          usageCount: 1100,
          intent: WorkflowIntent.API_INTEGRATION,
          complexity: 4,
        },
      ],
      [WorkflowIntent.NOTIFICATION]: [
        {
          id: 'multi-channel-notification',
          name: 'Multi-Channel Notification',
          description: 'Send notifications to multiple channels',
          nodes: ['Schedule Trigger', 'HTTP Request', 'If', 'Slack', 'Discord'],
          successRate: 0.93,
          avgExecutionTime: 2500,
          usageCount: 890,
          intent: WorkflowIntent.NOTIFICATION,
          complexity: 3,
        },
      ],
      [WorkflowIntent.FILE_PROCESSING]: [
        {
          id: 'file-upload-process',
          name: 'File Upload & Process',
          description: 'Upload files and process their contents',
          nodes: ['File Trigger', 'Google Drive', 'Code', 'Slack'],
          successRate: 0.85,
          avgExecutionTime: 8000,
          usageCount: 650,
          intent: WorkflowIntent.FILE_PROCESSING,
          complexity: 4,
        },
      ],
      [WorkflowIntent.SCHEDULING]: [
        {
          id: 'scheduled-report',
          name: 'Scheduled Report',
          description: 'Generate and send reports on schedule',
          nodes: ['Schedule Trigger', 'HTTP Request', 'Edit Fields', 'Gmail'],
          successRate: 0.94,
          avgExecutionTime: 4000,
          usageCount: 820,
          intent: WorkflowIntent.SCHEDULING,
          complexity: 3,
        },
      ],
      [WorkflowIntent.DATABASE_OPERATION]: [
        {
          id: 'data-sync',
          name: 'Database Sync',
          description: 'Sync data between databases',
          nodes: ['Schedule Trigger', 'Airtable', 'Edit Fields', 'Notion'],
          successRate: 0.87,
          avgExecutionTime: 6000,
          usageCount: 540,
          intent: WorkflowIntent.DATABASE_OPERATION,
          complexity: 5,
        },
      ],
      [WorkflowIntent.SOCIAL_MEDIA]: [
        {
          id: 'social-post',
          name: 'Social Media Posting',
          description: 'Post content to social media with scheduling',
          nodes: ['Schedule Trigger', 'Edit Fields', 'Twitter', 'Slack'],
          successRate: 0.91,
          avgExecutionTime: 3500,
          usageCount: 420,
          intent: WorkflowIntent.SOCIAL_MEDIA,
          complexity: 3,
        },
      ],
      [WorkflowIntent.E_COMMERCE]: [
        {
          id: 'order-processing',
          name: 'Order Processing',
          description: 'Process orders and send confirmations',
          nodes: ['Webhook', 'Stripe', 'If', 'Gmail', 'Airtable'],
          successRate: 0.96,
          avgExecutionTime: 4500,
          usageCount: 380,
          intent: WorkflowIntent.E_COMMERCE,
          complexity: 6,
        },
      ],
      [WorkflowIntent.UNKNOWN]: [],
    }

    return commonPatterns[intent] || []
  }

  /**
   * Generate warnings for recommendations
   */
  private generateWarnings(context: RecommendationContext, recommendations: NodeRecommendation[]): string[] {
    const warnings: string[] = []

    // Check for AI node without proper context
    if (context.intent === WorkflowIntent.AI_WORKFLOW) {
      const hasAiNode = recommendations.some(r => r.category === NodeCategory.AI)
      if (!hasAiNode) {
        warnings.push('AI workflow detected but no AI nodes recommended. Consider adding OpenAI or Anthropic nodes.')
      }
    }

    // Check for missing error handling
    if (context.intent === WorkflowIntent.API_INTEGRATION) {
      const hasErrorHandling = recommendations.some(r => r.nodeType.includes('if') || r.nodeType.includes('try'))
      if (!hasErrorHandling) {
        warnings.push('API integration workflows should include error handling with If or Try nodes.')
      }
    }

    // Check for security considerations
    if (context.userInput.toLowerCase().includes('password') || context.userInput.toLowerCase().includes('secret')) {
      warnings.push('Workflow involves sensitive data. Ensure proper credential management and encryption.')
    }

    return warnings
  }

  /**
   * Generate cache key for recommendations
   */
  private generateCacheKey(context: RecommendationContext): string {
    return `${context.intent}:${context.userInput.slice(0, 50)}:${context.existingNodes?.length || 0}`
  }

  /**
   * Clear recommendation caches
   */
  clearCaches(): void {
    this.recommendationCache.clear()
    this.patternCache.clear()
    logger.debug('Node recommendation caches cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    recommendations: { size: number }
    patterns: { size: number }
  } {
    return {
      recommendations: { size: this.recommendationCache.size },
      patterns: { size: this.patternCache.size },
    }
  }

  /**
   * Learn from workflow execution (placeholder for future ML integration)
   */
  async learnFromWorkflow(
    context: RecommendationContext,
    usedNodes: string[],
    success: boolean,
    executionTime: number,
  ): Promise<void> {
    // For now, just log the learning data
    // Later this would update recommendation scoring or feed into ML model
    logger.debug('Learning from workflow execution', {
      intent: context.intent,
      usedNodes,
      success,
      executionTime,
    })

    // Store workflow pattern for ML learning when database is available
    // Future enhancement: Update node scoring based on success rate
    // Future enhancement: Identify new workflow patterns through analysis
  }
}

// Export singleton instance
export const nodeRecommender = new NodeRecommender()
