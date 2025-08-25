/**
 * Intent-Driven Classification for n8n Workflows
 *
 * Lightweight pattern-based classifier that analyzes user input to determine
 * workflow intent, complexity, and optimal routing strategy.
 *
 * Philosophy: Simple regex + keyword matching for immediate value,
 * expandable to ML-based classification later.
 */

import { logger } from '../server/logger.js'

// === Intent Classification Types ===

export enum WorkflowIntent {
  EMAIL_AUTOMATION = 'email-automation',
  DATA_PROCESSING = 'data-processing',
  API_INTEGRATION = 'api-integration',
  AI_WORKFLOW = 'ai-workflow',
  NOTIFICATION = 'notification',
  FILE_PROCESSING = 'file-processing',
  SCHEDULING = 'scheduling',
  DATABASE_OPERATION = 'database-operation',
  SOCIAL_MEDIA = 'social-media',
  E_COMMERCE = 'e-commerce',
  UNKNOWN = 'unknown',
}

export enum ComplexityLevel {
  EXPRESS = 'express', // <3 complexity points - direct to builder
  STANDARD = 'standard', // 3-7 points - single specialist
  ENTERPRISE = 'enterprise', // >7 points - full BMAD orchestration
}

export enum RoutingStrategy {
  DIRECT_TO_BUILDER = 'direct-to-builder',
  NODE_EXPERT_FIRST = 'node-expert-first',
  ORCHESTRATOR_REQUIRED = 'orchestrator-required',
}

export interface IntentClassificationResult {
  intent: WorkflowIntent
  confidence: number
  complexity: ComplexityLevel
  complexityScore: number
  suggestedRoute: RoutingStrategy
  estimatedNodes: string[]
  keywords: string[]
  reasoning: string
}

// === Intent Patterns (Lean Regex-based Approach) ===

interface IntentPattern {
  intent: WorkflowIntent
  patterns: RegExp[]
  keywords: string[]
  complexityBonus: number
  suggestedNodes: string[]
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: WorkflowIntent.EMAIL_AUTOMATION,
    patterns: [
      /\b(email|mail|send|notification|alert|message)\b/i,
      /\b(gmail|outlook|smtp|mailchimp|sendgrid)\b/i,
      /\b(subscribe|unsubscribe|newsletter|campaign)\b/i,
    ],
    keywords: ['email', 'send', 'notification', 'alert', 'gmail', 'outlook', 'newsletter'],
    complexityBonus: 1,
    suggestedNodes: ['Gmail', 'Microsoft Outlook', 'SMTP', 'Mailchimp'],
  },
  {
    intent: WorkflowIntent.DATA_PROCESSING,
    patterns: [
      /\b(csv|json|xml|data|transform|parse|convert|clean)\b/i,
      /\b(spreadsheet|excel|process|filter|merge|split)\b/i,
      /\b(database|sql|query|aggregate)\b/i,
    ],
    keywords: ['csv', 'json', 'data', 'transform', 'process', 'filter', 'excel', 'database'],
    complexityBonus: 2,
    suggestedNodes: ['Edit Fields', 'Merge', 'Split', 'Filter', 'Sort', 'Code'],
  },
  {
    intent: WorkflowIntent.API_INTEGRATION,
    patterns: [
      /\b(api|http|rest|webhook|endpoint|request|response)\b/i,
      /\b(get|post|put|delete|fetch|call|integration)\b/i,
      /\b(json|payload|header|authentication|oauth)\b/i,
    ],
    keywords: ['api', 'http', 'webhook', 'request', 'integration', 'oauth', 'authentication'],
    complexityBonus: 3,
    suggestedNodes: ['HTTP Request', 'Webhook', 'Wait', 'If'],
  },
  {
    intent: WorkflowIntent.AI_WORKFLOW,
    patterns: [
      /\b(ai|artificial intelligence|openai|gpt|claude|anthropic|llm)\b/i,
      /\b(chat|chatbot|assistant|generate|analyze|summarize)\b/i,
      /\b(machine learning|ml|prediction|classification|embedding)\b/i,
      /\b(vision|image analysis|text analysis|sentiment)\b/i,
    ],
    keywords: ['ai', 'openai', 'gpt', 'chat', 'generate', 'analyze', 'ml', 'assistant'],
    complexityBonus: 4,
    suggestedNodes: ['OpenAI', 'Anthropic', 'AI Agent', 'AI Transform'],
  },
  {
    intent: WorkflowIntent.NOTIFICATION,
    patterns: [
      /\b(notify|alert|send message|ping|update|inform)\b/i,
      /\b(slack|discord|teams|telegram|whatsapp|sms)\b/i,
      /\b(mobile|push|desktop|notification)\b/i,
    ],
    keywords: ['notify', 'alert', 'slack', 'discord', 'sms', 'telegram', 'push'],
    complexityBonus: 1,
    suggestedNodes: ['Slack', 'Discord', 'Telegram', 'Twilio', 'Microsoft Teams'],
  },
  {
    intent: WorkflowIntent.FILE_PROCESSING,
    patterns: [
      /\b(file|pdf|image|document|upload|download|storage)\b/i,
      /\b(drive|dropbox|s3|onedrive|sharepoint|cloud)\b/i,
      /\b(resize|convert|compress|extract|scan)\b/i,
    ],
    keywords: ['file', 'pdf', 'image', 'upload', 'download', 'drive', 'storage'],
    complexityBonus: 2,
    suggestedNodes: ['Google Drive', 'Dropbox', 'AWS S3', 'Read PDF', 'Write PDF'],
  },
  {
    intent: WorkflowIntent.SCHEDULING,
    patterns: [
      /\b(schedule|cron|timer|trigger|periodic|daily|weekly)\b/i,
      /\b(calendar|meeting|appointment|reminder|deadline)\b/i,
      /\b(recurring|interval|delay|wait)\b/i,
    ],
    keywords: ['schedule', 'cron', 'timer', 'daily', 'weekly', 'calendar', 'recurring'],
    complexityBonus: 1,
    suggestedNodes: ['Schedule Trigger', 'Cron', 'Wait', 'Google Calendar'],
  },
  {
    intent: WorkflowIntent.DATABASE_OPERATION,
    patterns: [
      /\b(database|db|sql|mysql|postgres|mongodb|redis)\b/i,
      /\b(insert|update|delete|select|query|table|record)\b/i,
      /\b(airtable|notion|firebase|supabase)\b/i,
    ],
    keywords: ['database', 'sql', 'insert', 'update', 'query', 'airtable', 'notion'],
    complexityBonus: 3,
    suggestedNodes: ['Airtable', 'Notion', 'MySQL', 'MongoDB', 'Supabase'],
  },
  {
    intent: WorkflowIntent.SOCIAL_MEDIA,
    patterns: [
      /\b(social|twitter|facebook|instagram|linkedin|youtube)\b/i,
      /\b(post|tweet|share|publish|social media|content)\b/i,
      /\b(hashtag|mention|comment|like|follow)\b/i,
    ],
    keywords: ['social', 'twitter', 'post', 'share', 'publish', 'content', 'hashtag'],
    complexityBonus: 2,
    suggestedNodes: ['Twitter', 'Facebook', 'LinkedIn', 'Instagram'],
  },
  {
    intent: WorkflowIntent.E_COMMERCE,
    patterns: [
      /\b(ecommerce|e-commerce|shop|store|order|payment|cart)\b/i,
      /\b(stripe|paypal|shopify|woocommerce|product|inventory)\b/i,
      /\b(customer|purchase|refund|transaction|billing)\b/i,
    ],
    keywords: ['ecommerce', 'shop', 'order', 'payment', 'stripe', 'shopify', 'customer'],
    complexityBonus: 4,
    suggestedNodes: ['Stripe', 'PayPal', 'Shopify', 'WooCommerce'],
  },
]

// === Complexity Assessment Factors ===

interface ComplexityFactor {
  pattern: RegExp
  points: number
  description: string
}

const COMPLEXITY_FACTORS: ComplexityFactor[] = [
  { pattern: /\b(integration|integrate|connect|sync)\b/i, points: 2, description: 'Integration complexity' },
  { pattern: /\b(multiple|several|various|many)\b/i, points: 1, description: 'Multiple components' },
  { pattern: /\b(security|secure|encrypt|auth|permission)\b/i, points: 3, description: 'Security requirements' },
  { pattern: /\b(compliance|gdpr|hipaa|audit|regulation)\b/i, points: 5, description: 'Compliance requirements' },
  { pattern: /\b(real[-\s]?time|live|instant|immediate)\b/i, points: 2, description: 'Real-time processing' },
  { pattern: /\b(scale|scalable|high[-\s]?volume|enterprise)\b/i, points: 3, description: 'Scalability needs' },
  { pattern: /\b(error|retry|fallback|resilient|robust)\b/i, points: 2, description: 'Error handling' },
  { pattern: /\b(workflow|complex|advanced|sophisticated)\b/i, points: 2, description: 'Complex workflow' },
  { pattern: /\b(ai|machine learning|ml|neural|model)\b/i, points: 3, description: 'AI/ML complexity' },
  { pattern: /\b(conditional|if|logic|decision|branch)\b/i, points: 1, description: 'Conditional logic' },
]

// === Intent Classifier Implementation ===

export class IntentClassifier {
  private cache = new Map<string, IntentClassificationResult>()

  /**
   * Classify user input to determine workflow intent and complexity
   */
  classify(input: string): IntentClassificationResult {
    const cacheKey = input.toLowerCase().trim()

    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached) {
      logger.debug('Intent classification cache hit', { input: cacheKey })
      return cached
    }

    logger.debug('Classifying user intent', { input })

    // Analyze intent patterns
    const intentResults = this.analyzeIntentPatterns(input)
    const complexityScore = this.calculateComplexityScore(input, intentResults.intent)
    const complexity = this.mapComplexityLevel(complexityScore)
    const suggestedRoute = this.determineSuggestedRoute(complexity, intentResults.intent)

    const result: IntentClassificationResult = {
      intent: intentResults.intent,
      confidence: intentResults.confidence,
      complexity,
      complexityScore,
      suggestedRoute,
      estimatedNodes: intentResults.suggestedNodes,
      keywords: intentResults.keywords,
      reasoning: this.generateReasoning(intentResults, complexityScore),
    }

    // Cache result (limit cache size)
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value
      if (firstKey)
        this.cache.delete(firstKey)
    }
    this.cache.set(cacheKey, result)

    logger.debug('Intent classified', result)
    return result
  }

  /**
   * Analyze input against intent patterns
   */
  private analyzeIntentPatterns(input: string): {
    intent: WorkflowIntent
    confidence: number
    suggestedNodes: string[]
    keywords: string[]
  } {
    const scores = new Map<WorkflowIntent, {
      score: number
      suggestedNodes: string[]
      keywords: string[]
    }>()

    // Test each pattern against input
    for (const pattern of INTENT_PATTERNS) {
      let score = 0
      const matchedKeywords: string[] = []

      // Pattern matching
      for (const regex of pattern.patterns) {
        if (regex.test(input)) {
          score += 10
        }
      }

      // Keyword matching
      for (const keyword of pattern.keywords) {
        if (input.toLowerCase().includes(keyword.toLowerCase())) {
          score += 5
          matchedKeywords.push(keyword)
        }
      }

      if (score > 0) {
        scores.set(pattern.intent, {
          score: score + pattern.complexityBonus,
          suggestedNodes: pattern.suggestedNodes,
          keywords: matchedKeywords,
        })
      }
    }

    // Find best match
    let bestIntent = WorkflowIntent.UNKNOWN
    let bestScore = 0
    let bestNodes: string[] = []
    let bestKeywords: string[] = []

    for (const [intent, data] of scores) {
      if (data.score > bestScore) {
        bestIntent = intent
        bestScore = data.score
        bestNodes = data.suggestedNodes
        bestKeywords = data.keywords
      }
    }

    // Calculate confidence (0-1 scale)
    const maxPossibleScore = 50 // Rough estimate for normalization
    const confidence = Math.min(bestScore / maxPossibleScore, 1.0)

    return {
      intent: bestIntent,
      confidence,
      suggestedNodes: bestNodes,
      keywords: bestKeywords,
    }
  }

  /**
   * Calculate workflow complexity score
   */
  private calculateComplexityScore(input: string, intent: WorkflowIntent): number {
    let score = 0

    // Base complexity by intent type
    const intentComplexity: Record<WorkflowIntent, number> = {
      [WorkflowIntent.EMAIL_AUTOMATION]: 1,
      [WorkflowIntent.NOTIFICATION]: 1,
      [WorkflowIntent.SCHEDULING]: 1,
      [WorkflowIntent.DATA_PROCESSING]: 3,
      [WorkflowIntent.FILE_PROCESSING]: 2,
      [WorkflowIntent.API_INTEGRATION]: 4,
      [WorkflowIntent.DATABASE_OPERATION]: 4,
      [WorkflowIntent.SOCIAL_MEDIA]: 2,
      [WorkflowIntent.AI_WORKFLOW]: 5,
      [WorkflowIntent.E_COMMERCE]: 6,
      [WorkflowIntent.UNKNOWN]: 3,
    }

    score += intentComplexity[intent] || 3

    // Apply complexity factors
    for (const factor of COMPLEXITY_FACTORS) {
      if (factor.pattern.test(input)) {
        score += factor.points
        logger.debug(`Complexity factor applied: ${factor.description} (+${factor.points})`)
      }
    }

    return score
  }

  /**
   * Map complexity score to complexity level
   */
  private mapComplexityLevel(score: number): ComplexityLevel {
    if (score < 3)
      return ComplexityLevel.EXPRESS
    if (score <= 7)
      return ComplexityLevel.STANDARD
    return ComplexityLevel.ENTERPRISE
  }

  /**
   * Determine optimal routing strategy
   */
  private determineSuggestedRoute(
    complexity: ComplexityLevel,
    intent: WorkflowIntent,
  ): RoutingStrategy {
    // Express workflows go directly to builder
    if (complexity === ComplexityLevel.EXPRESS) {
      return RoutingStrategy.DIRECT_TO_BUILDER
    }

    // AI workflows benefit from node expert consultation
    if (intent === WorkflowIntent.AI_WORKFLOW) {
      return RoutingStrategy.NODE_EXPERT_FIRST
    }

    // Enterprise complexity requires orchestration
    if (complexity === ComplexityLevel.ENTERPRISE) {
      return RoutingStrategy.ORCHESTRATOR_REQUIRED
    }

    // Standard complexity can use node expert optimization
    return RoutingStrategy.NODE_EXPERT_FIRST
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    intentResult: {
      intent: WorkflowIntent
      confidence: number
      keywords: string[]
    },
    complexityScore: number,
  ): string {
    const reasons: string[] = []

    reasons.push(`Detected ${intentResult.intent} intent (${Math.round(intentResult.confidence * 100)}% confidence)`)

    if (intentResult.keywords.length > 0) {
      reasons.push(`Keywords found: ${intentResult.keywords.join(', ')}`)
    }

    reasons.push(`Complexity score: ${complexityScore}`)

    return reasons.join('. ')
  }

  /**
   * Clear classification cache
   */
  clearCache(): void {
    this.cache.clear()
    logger.debug('Intent classification cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number, maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: 1000,
    }
  }
}

// Export singleton instance
export const intentClassifier = new IntentClassifier()
