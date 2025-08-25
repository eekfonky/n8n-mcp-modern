/**
 * Progressive Complexity Assessment for n8n Workflows
 *
 * Determines workflow complexity and appropriate handling strategy to optimize
 * resource allocation and user experience across the agent hierarchy.
 *
 * Philosophy: Simple rule-based assessment with clear complexity boundaries
 * to route workflows to appropriate agent tiers efficiently.
 */

import { logger } from '../server/logger.js'
import { ComplexityLevel, WorkflowIntent } from './intent-classifier.js'

// === Complexity Assessment Types ===

export interface ComplexityAssessment {
  level: ComplexityLevel
  score: number
  factors: ComplexityFactor[]
  recommendations: ComplexityRecommendation[]
  estimatedDuration: number // in milliseconds
  resourceRequirements: ResourceRequirements
  riskLevel: RiskLevel
}

export interface ComplexityFactor {
  type: ComplexityFactorType
  description: string
  impact: number
  detected: boolean
}

export interface ComplexityRecommendation {
  type: 'routing' | 'architecture' | 'performance' | 'security'
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface ResourceRequirements {
  agentTier: 1 | 2 | 3 // Maps to agent hierarchy tiers
  estimatedAgents: string[]
  storyFileRequired: boolean
  governanceLevel: 'minimal' | 'standard' | 'enterprise'
  monitoringLevel: 'basic' | 'enhanced' | 'comprehensive'
}

export enum ComplexityFactorType {
  INTEGRATION_COUNT = 'integration_count',
  DATA_VOLUME = 'data_volume',
  SECURITY_REQUIREMENTS = 'security_requirements',
  COMPLIANCE_REQUIREMENTS = 'compliance_requirements',
  REAL_TIME_PROCESSING = 'real_time_processing',
  ERROR_HANDLING = 'error_handling',
  SCALABILITY_NEEDS = 'scalability_needs',
  AI_COMPLEXITY = 'ai_complexity',
  BUSINESS_CRITICALITY = 'business_criticality',
  CUSTOM_LOGIC = 'custom_logic',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// === Complexity Factor Definitions ===

interface FactorDefinition {
  type: ComplexityFactorType
  patterns: RegExp[]
  keywords: string[]
  baseImpact: number
  description: string
  riskContribution: number
}

const COMPLEXITY_FACTORS: FactorDefinition[] = [
  {
    type: ComplexityFactorType.INTEGRATION_COUNT,
    patterns: [
      /\b(?:multiple|several|various|many)\s+(?:services?|integrations?|systems?|apis?)\b/i,
      /\b(?:connect|integrate|sync)\s+\S+\s+(?:and|with|\+)/i,
    ],
    keywords: ['multiple', 'several', 'integrate', 'connect', 'sync', 'various'],
    baseImpact: 2,
    description: 'Multiple system integrations increase complexity',
    riskContribution: 1,
  },
  {
    type: ComplexityFactorType.DATA_VOLUME,
    patterns: [
      /\b(?:large|big|huge|massive|bulk|batch)\s+(?:data|dataset|files?|records?)\b/i,
      /\b\d+[kmg]b?\b/i, // File sizes
      /\b(?:thousands?|millions?)\s+of\b/i,
    ],
    keywords: ['large', 'big', 'bulk', 'batch', 'massive', 'dataset'],
    baseImpact: 3,
    description: 'Large data volumes require special handling',
    riskContribution: 2,
  },
  {
    type: ComplexityFactorType.SECURITY_REQUIREMENTS,
    patterns: [
      /\b(secure|security|encrypt|decrypt|auth|permission|access control)\b/i,
      /\b(oauth|jwt|token|certificate|ssl|tls|https)\b/i,
      /\b(sensitive|confidential|private|protected)\b/i,
    ],
    keywords: ['secure', 'security', 'encrypt', 'auth', 'permission', 'oauth', 'sensitive'],
    baseImpact: 4,
    description: 'Security requirements add architectural complexity',
    riskContribution: 3,
  },
  {
    type: ComplexityFactorType.COMPLIANCE_REQUIREMENTS,
    patterns: [
      /\b(gdpr|hipaa|sox|pci|compliance|regulation|audit)\b/i,
      /\b(data retention|privacy|consent|audit trail)\b/i,
      /\b(compliant|regulatory|legal|policy)\b/i,
    ],
    keywords: ['gdpr', 'hipaa', 'compliance', 'audit', 'regulatory', 'privacy'],
    baseImpact: 5,
    description: 'Compliance requirements need enterprise governance',
    riskContribution: 4,
  },
  {
    type: ComplexityFactorType.REAL_TIME_PROCESSING,
    patterns: [
      /\b(real[-\s]?time|live|instant|immediate|streaming)\b/i,
      /\b(websocket|sse|pubsub|event[-\s]?driven)\b/i,
      /\b(low[-\s]?latency|fast|quick|rapid)\b/i,
    ],
    keywords: ['realtime', 'real-time', 'live', 'instant', 'streaming', 'websocket'],
    baseImpact: 3,
    description: 'Real-time processing increases technical complexity',
    riskContribution: 2,
  },
  {
    type: ComplexityFactorType.ERROR_HANDLING,
    patterns: [
      /\b(error|exception|fault|failure|retry|rollback|fallback)\b/i,
      /\b(resilient|robust|fault[-\s]?tolerant|reliable)\b/i,
      /\b(handle|catch|recover|graceful)\b/i,
    ],
    keywords: ['error', 'retry', 'rollback', 'resilient', 'fault-tolerant', 'recover'],
    baseImpact: 2,
    description: 'Comprehensive error handling adds implementation complexity',
    riskContribution: 1,
  },
  {
    type: ComplexityFactorType.SCALABILITY_NEEDS,
    patterns: [
      /\b(scale|scalable|high[-\s]?volume|enterprise|production)\b/i,
      /\b(load|performance|throughput|concurrent|parallel)\b/i,
      /\b(?:thousands?|millions?|billions?)\s+(?:requests?|users?|transactions?)\b/i,
    ],
    keywords: ['scale', 'scalable', 'high-volume', 'performance', 'concurrent', 'load'],
    baseImpact: 4,
    description: 'Scalability requirements need performance optimization',
    riskContribution: 3,
  },
  {
    type: ComplexityFactorType.AI_COMPLEXITY,
    patterns: [
      /\b(ai|artificial intelligence|machine learning|ml|neural|model)\b/i,
      /\b(gpt|claude|openai|anthropic|hugging face)\b/i,
      /\b(train|inference|prediction|classification|generation)\b/i,
      /\b(vector|embedding|similarity|rag|retrieval)\b/i,
    ],
    keywords: ['ai', 'ml', 'gpt', 'neural', 'model', 'vector', 'embedding', 'rag'],
    baseImpact: 4,
    description: 'AI workflows require specialized expertise',
    riskContribution: 2,
  },
  {
    type: ComplexityFactorType.BUSINESS_CRITICALITY,
    patterns: [
      /\b(critical|mission[-\s]?critical|production|business[-\s]?critical)\b/i,
      /\b(uptime|availability|sla|service level)\b/i,
      /\b(important|essential|vital|crucial)\b/i,
    ],
    keywords: ['critical', 'mission-critical', 'production', 'uptime', 'sla', 'vital'],
    baseImpact: 3,
    description: 'Business-critical workflows need enhanced monitoring',
    riskContribution: 4,
  },
  {
    type: ComplexityFactorType.CUSTOM_LOGIC,
    patterns: [
      /\b(custom|complex|advanced|sophisticated|intricate)\b/i,
      /\b(algorithm|logic|calculation|business rule)\b/i,
      /\b(javascript|code|function|script)\b/i,
    ],
    keywords: ['custom', 'complex', 'algorithm', 'logic', 'javascript', 'calculation'],
    baseImpact: 2,
    description: 'Custom logic increases maintenance complexity',
    riskContribution: 1,
  },
]

// === Complexity Assessment Implementation ===

export class ComplexityAssessor {
  /**
   * Assess workflow complexity from user input and intent
   */
  assessComplexity(
    userInput: string,
    intent: WorkflowIntent,
    additionalContext?: {
      estimatedNodes?: number
      hasExternalDependencies?: boolean
      requiresCustomCode?: boolean
    },
  ): ComplexityAssessment {
    logger.debug('Assessing workflow complexity', { intent, userInput: userInput.slice(0, 100) })

    // Analyze complexity factors
    const factors = this.analyzeComplexityFactors(userInput)

    // Calculate base complexity score
    let score = this.calculateBaseScore(intent)

    // Apply factor impacts
    for (const factor of factors) {
      if (factor.detected) {
        score += factor.impact
      }
    }

    // Apply additional context
    if (additionalContext) {
      score += this.applyContextualFactors(additionalContext)
    }

    // Determine complexity level
    const level = this.determineComplexityLevel(score)

    // Generate resource requirements
    const resourceRequirements = this.determineResourceRequirements(level, factors, intent)

    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(factors, level)

    // Generate recommendations
    const recommendations = this.generateRecommendations(level, factors, intent)

    // Estimate duration
    const estimatedDuration = this.estimateDuration(level, factors)

    const assessment: ComplexityAssessment = {
      level,
      score,
      factors,
      recommendations,
      estimatedDuration,
      resourceRequirements,
      riskLevel,
    }

    logger.debug('Complexity assessment completed', {
      level,
      score,
      riskLevel,
      factorsDetected: factors.filter(f => f.detected).length,
    })

    return assessment
  }

  /**
   * Analyze complexity factors in user input
   */
  private analyzeComplexityFactors(userInput: string): ComplexityFactor[] {
    const inputLower = userInput.toLowerCase()

    return COMPLEXITY_FACTORS.map((factorDef) => {
      let detected = false

      // Check patterns
      for (const pattern of factorDef.patterns) {
        if (pattern.test(userInput)) {
          detected = true
          break
        }
      }

      // Check keywords if no pattern matched
      if (!detected) {
        for (const keyword of factorDef.keywords) {
          if (inputLower.includes(keyword.toLowerCase())) {
            detected = true
            break
          }
        }
      }

      return {
        type: factorDef.type,
        description: factorDef.description,
        impact: factorDef.baseImpact,
        detected,
      }
    })
  }

  /**
   * Calculate base complexity score based on intent
   */
  private calculateBaseScore(intent: WorkflowIntent): number {
    const baseScores: Record<WorkflowIntent, number> = {
      [WorkflowIntent.EMAIL_AUTOMATION]: 2,
      [WorkflowIntent.NOTIFICATION]: 2,
      [WorkflowIntent.SCHEDULING]: 2,
      [WorkflowIntent.DATA_PROCESSING]: 4,
      [WorkflowIntent.FILE_PROCESSING]: 3,
      [WorkflowIntent.API_INTEGRATION]: 5,
      [WorkflowIntent.DATABASE_OPERATION]: 5,
      [WorkflowIntent.SOCIAL_MEDIA]: 3,
      [WorkflowIntent.AI_WORKFLOW]: 6,
      [WorkflowIntent.E_COMMERCE]: 7,
      [WorkflowIntent.UNKNOWN]: 4,
    }

    return baseScores[intent] || 4
  }

  /**
   * Apply contextual factors to complexity score
   */
  private applyContextualFactors(context: {
    estimatedNodes?: number
    hasExternalDependencies?: boolean
    requiresCustomCode?: boolean
  }): number {
    let additionalScore = 0

    if (context.estimatedNodes && context.estimatedNodes > 10) {
      additionalScore += 2
    }

    if (context.hasExternalDependencies) {
      additionalScore += 3
    }

    if (context.requiresCustomCode) {
      additionalScore += 2
    }

    return additionalScore
  }

  /**
   * Determine complexity level from score
   */
  private determineComplexityLevel(score: number): ComplexityLevel {
    if (score < 5)
      return ComplexityLevel.EXPRESS
    if (score <= 10)
      return ComplexityLevel.STANDARD
    return ComplexityLevel.ENTERPRISE
  }

  /**
   * Determine resource requirements based on complexity
   */
  private determineResourceRequirements(
    level: ComplexityLevel,
    factors: ComplexityFactor[],
    intent: WorkflowIntent,
  ): ResourceRequirements {
    const hasCompliance = factors.some(f =>
      f.type === ComplexityFactorType.COMPLIANCE_REQUIREMENTS && f.detected,
    )
    const hasSecurity = factors.some(f =>
      f.type === ComplexityFactorType.SECURITY_REQUIREMENTS && f.detected,
    )
    const hasAI = factors.some(f =>
      f.type === ComplexityFactorType.AI_COMPLEXITY && f.detected,
    )

    switch (level) {
      case ComplexityLevel.EXPRESS:
        return {
          agentTier: 3,
          estimatedAgents: ['n8n-builder'],
          storyFileRequired: false,
          governanceLevel: 'minimal',
          monitoringLevel: 'basic',
        }

      case ComplexityLevel.STANDARD:
        const standardAgents = ['n8n-builder']

        if (hasAI || intent === WorkflowIntent.AI_WORKFLOW) {
          standardAgents.unshift('n8n-node-expert')
        }
        if (hasSecurity) {
          standardAgents.push('n8n-connector')
        }

        return {
          agentTier: 2,
          estimatedAgents: standardAgents,
          storyFileRequired: standardAgents.length > 1,
          governanceLevel: 'standard',
          monitoringLevel: 'enhanced',
        }

      case ComplexityLevel.ENTERPRISE:
        const enterpriseAgents = ['n8n-orchestrator']

        if (hasAI || intent === WorkflowIntent.AI_WORKFLOW) {
          enterpriseAgents.push('n8n-node-expert')
        }
        if (hasSecurity) {
          enterpriseAgents.push('n8n-connector')
        }
        enterpriseAgents.push('n8n-scriptguard', 'n8n-builder')

        return {
          agentTier: 1,
          estimatedAgents: enterpriseAgents,
          storyFileRequired: true,
          governanceLevel: hasCompliance ? 'enterprise' : 'standard',
          monitoringLevel: 'comprehensive',
        }

      default:
        return {
          agentTier: 2,
          estimatedAgents: ['n8n-builder'],
          storyFileRequired: false,
          governanceLevel: 'standard',
          monitoringLevel: 'enhanced',
        }
    }
  }

  /**
   * Calculate overall risk level
   */
  private calculateRiskLevel(factors: ComplexityFactor[], level: ComplexityLevel): RiskLevel {
    let riskScore = 0

    // Sum risk contributions from detected factors
    for (const factor of factors) {
      if (factor.detected) {
        const factorDef = COMPLEXITY_FACTORS.find(f => f.type === factor.type)
        if (factorDef) {
          riskScore += factorDef.riskContribution
        }
      }
    }

    // Base risk from complexity level
    const levelRisk = {
      [ComplexityLevel.EXPRESS]: 0,
      [ComplexityLevel.STANDARD]: 2,
      [ComplexityLevel.ENTERPRISE]: 4,
    }

    riskScore += levelRisk[level]

    // Map to risk levels
    if (riskScore <= 2)
      return RiskLevel.LOW
    if (riskScore <= 5)
      return RiskLevel.MEDIUM
    if (riskScore <= 8)
      return RiskLevel.HIGH
    return RiskLevel.CRITICAL
  }

  /**
   * Generate complexity-based recommendations
   */
  private generateRecommendations(
    level: ComplexityLevel,
    factors: ComplexityFactor[],
    intent: WorkflowIntent,
  ): ComplexityRecommendation[] {
    const recommendations: ComplexityRecommendation[] = []

    // Routing recommendations
    switch (level) {
      case ComplexityLevel.EXPRESS:
        recommendations.push({
          type: 'routing',
          title: 'Express Processing',
          description: 'Simple workflow - can proceed directly to implementation',
          priority: 'low',
        })
        break

      case ComplexityLevel.STANDARD:
        recommendations.push({
          type: 'routing',
          title: 'Standard Processing',
          description: 'Moderate complexity - recommend specialist consultation',
          priority: 'medium',
        })
        break

      case ComplexityLevel.ENTERPRISE:
        recommendations.push({
          type: 'routing',
          title: 'Enterprise Processing Required',
          description: 'High complexity - requires orchestrated multi-agent approach',
          priority: 'high',
        })
        break
    }

    // Factor-specific recommendations
    for (const factor of factors) {
      if (!factor.detected)
        continue

      switch (factor.type) {
        case ComplexityFactorType.SECURITY_REQUIREMENTS:
          recommendations.push({
            type: 'security',
            title: 'Security Review Required',
            description: 'Engage security specialist for authentication and encryption patterns',
            priority: 'high',
          })
          break

        case ComplexityFactorType.COMPLIANCE_REQUIREMENTS:
          recommendations.push({
            type: 'architecture',
            title: 'Compliance Architecture',
            description: 'Design with audit trails, data retention, and regulatory requirements',
            priority: 'critical',
          })
          break

        case ComplexityFactorType.SCALABILITY_NEEDS:
          recommendations.push({
            type: 'performance',
            title: 'Performance Optimization',
            description: 'Design for scale with appropriate caching and load handling',
            priority: 'high',
          })
          break

        case ComplexityFactorType.AI_COMPLEXITY:
          recommendations.push({
            type: 'architecture',
            title: 'AI Workflow Optimization',
            description: 'Leverage AI node expertise for optimal model selection and configuration',
            priority: 'medium',
          })
          break
      }
    }

    return recommendations
  }

  /**
   * Estimate workflow duration based on complexity
   */
  private estimateDuration(level: ComplexityLevel, factors: ComplexityFactor[]): number {
    const baseDurations = {
      [ComplexityLevel.EXPRESS]: 300000, // 5 minutes
      [ComplexityLevel.STANDARD]: 900000, // 15 minutes
      [ComplexityLevel.ENTERPRISE]: 2700000, // 45 minutes
    }

    let duration = baseDurations[level]

    // Add time for each detected factor
    const detectedFactors = factors.filter(f => f.detected).length
    duration += detectedFactors * 120000 // +2 minutes per factor

    return duration
  }
}

// Export singleton instance
export const complexityAssessor = new ComplexityAssessor()
