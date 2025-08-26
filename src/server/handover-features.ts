/**
 * Agent Handover Feature Management
 *
 * Controls when and how agent handovers are activated for complex n8n workflows.
 * Provides granular control over handover behavior with gradual rollout capability.
 */

import type { AgentContext } from '../agents/index.js'
import process from 'node:process'
import { logger } from './logger.js'

// === Handover Configuration ===

export interface HandoverConfig {
  // Master switches
  enableHandovers: boolean
  allowUserDisable: boolean

  // Complexity thresholds
  complexityThreshold: number // 0-100, when to auto-trigger handovers
  nodeCountThreshold: number // Number of nodes that triggers handover
  integrationCountThreshold: number // Number of integrations that triggers handover

  // Emergency escalation
  emergencyEscalation: boolean
  securityEscalationEnabled: boolean
  performanceEscalationEnabled: boolean

  // Handover behavior
  bidirectionalHandovers: boolean
  maxHandoverChain: number
  handoverTimeout: number // milliseconds

  // Quality control
  enforceHandoverValidation: boolean
  minimumHandoverScore: number // 0-100
  requireRollbackPlan: boolean

  // Metrics and monitoring
  handoverMetrics: boolean
  detailedLogging: boolean
  storyFileRetention: number // days
}

// === Default Configuration ===

const DEFAULT_CONFIG: HandoverConfig = {
  // Conservative defaults - handovers disabled by default
  enableHandovers: false,
  allowUserDisable: true,

  // Moderate complexity thresholds
  complexityThreshold: 70,
  nodeCountThreshold: 10,
  integrationCountThreshold: 3,

  // Emergency features enabled
  emergencyEscalation: true,
  securityEscalationEnabled: true,
  performanceEscalationEnabled: true,

  // Reasonable handover behavior
  bidirectionalHandovers: true,
  maxHandoverChain: 5,
  handoverTimeout: 30000, // 30 seconds

  // Quality control enabled
  enforceHandoverValidation: true,
  minimumHandoverScore: 80,
  requireRollbackPlan: true,

  // Metrics enabled for monitoring
  handoverMetrics: true,
  detailedLogging: false,
  storyFileRetention: 30, // 30 days
}

// === Environment Configuration Override ===

export function loadHandoverConfig(): HandoverConfig {
  const config: HandoverConfig = { ...DEFAULT_CONFIG }

  // Environment variable overrides
  if (process.env.ENABLE_AGENT_HANDOVERS === 'true') {
    config.enableHandovers = true
    logger.info('Agent handovers enabled via environment variable')
  }

  if (process.env.HANDOVER_COMPLEXITY_THRESHOLD) {
    const threshold = Number.parseInt(process.env.HANDOVER_COMPLEXITY_THRESHOLD, 10)
    if (!Number.isNaN(threshold) && threshold >= 0 && threshold <= 100) {
      config.complexityThreshold = threshold
    }
  }

  if (process.env.HANDOVER_NODE_THRESHOLD) {
    const threshold = Number.parseInt(process.env.HANDOVER_NODE_THRESHOLD, 10)
    if (!Number.isNaN(threshold) && threshold > 0) {
      config.nodeCountThreshold = threshold
    }
  }

  if (process.env.HANDOVER_INTEGRATION_THRESHOLD) {
    const threshold = Number.parseInt(process.env.HANDOVER_INTEGRATION_THRESHOLD, 10)
    if (!Number.isNaN(threshold) && threshold > 0) {
      config.integrationCountThreshold = threshold
    }
  }

  if (process.env.HANDOVER_DETAILED_LOGGING === 'true') {
    config.detailedLogging = true
  }

  if (process.env.HANDOVER_MAX_CHAIN) {
    const maxChain = Number.parseInt(process.env.HANDOVER_MAX_CHAIN, 10)
    if (!Number.isNaN(maxChain) && maxChain > 0 && maxChain <= 10) {
      config.maxHandoverChain = maxChain
    }
  }

  if (process.env.DISABLE_HANDOVER_VALIDATION === 'true') {
    config.enforceHandoverValidation = false
    logger.warn('Handover validation disabled - this may reduce quality')
  }

  return config
}

// === Singleton Configuration ===

export const handoverConfig = loadHandoverConfig()

// === Complexity Assessment Functions ===

export interface WorkflowComplexity {
  score: number // 0-100
  factors: {
    nodeCount: number
    integrationCount: number
    customCodePresent: boolean
    authenticationRequired: boolean
    performanceCritical: boolean
    securitySensitive: boolean
  }
  recommendation: 'simple' | 'handover' | 'emergency'
}

/**
 * Assess workflow complexity to determine if handovers should be triggered
 */
export function assessWorkflowComplexity(context: AgentContext): WorkflowComplexity {
  let score = 0

  const factors = {
    nodeCount: context.nodeCount ?? 0,
    integrationCount: context.integrations?.length ?? 0,
    customCodePresent: !!context.customCode,
    authenticationRequired: !!context.requiresAuthentication,
    performanceCritical: !!context.performance,
    securitySensitive: !!context.securityRisk || !!context.customCode,
  }

  // Node count scoring (0-25 points)
  if (factors.nodeCount > handoverConfig.nodeCountThreshold) {
    score += Math.min(25, (factors.nodeCount - handoverConfig.nodeCountThreshold) * 2)
  }

  // Integration count scoring (0-20 points)
  if (factors.integrationCount > handoverConfig.integrationCountThreshold) {
    score += Math.min(20, (factors.integrationCount - handoverConfig.integrationCountThreshold) * 5)
  }

  // Complexity factors (0-55 points total)
  if (factors.customCodePresent)
    score += 15
  if (factors.authenticationRequired)
    score += 10
  if (factors.performanceCritical)
    score += 15
  if (factors.securitySensitive)
    score += 15

  // Context-based scoring
  if (context.complexity === 'high')
    score += 20
  else if (context.complexity === 'medium')
    score += 10

  // Emergency indicators
  let recommendation: 'simple' | 'handover' | 'emergency' = 'simple'

  if (context.securityRisk === 'high' || factors.securitySensitive) {
    recommendation = 'emergency'
    score = Math.max(score, 90) // Force high score for security issues
  }
  else if (score >= handoverConfig.complexityThreshold) {
    recommendation = 'handover'
  }

  return {
    score: Math.min(100, score),
    factors,
    recommendation,
  }
}

/**
 * Determine if handover should be triggered based on context
 */
export function shouldTriggerHandover(context: AgentContext): {
  shouldHandover: boolean
  reason: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
} {
  // Master switch check
  if (!handoverConfig.enableHandovers) {
    return {
      shouldHandover: false,
      reason: 'Handovers disabled globally',
      urgency: 'low',
    }
  }

  const complexity = assessWorkflowComplexity(context)

  // Emergency escalation
  if (complexity.recommendation === 'emergency') {
    return {
      shouldHandover: true,
      reason: 'Emergency escalation required (security/performance)',
      urgency: 'critical',
    }
  }

  // Complexity-based handover
  if (complexity.recommendation === 'handover') {
    const reasons = []

    if (complexity.factors.nodeCount > handoverConfig.nodeCountThreshold) {
      reasons.push(`${complexity.factors.nodeCount} nodes (>${handoverConfig.nodeCountThreshold})`)
    }

    if (complexity.factors.integrationCount > handoverConfig.integrationCountThreshold) {
      reasons.push(`${complexity.factors.integrationCount} integrations`)
    }

    if (complexity.factors.customCodePresent) {
      reasons.push('custom JavaScript code')
    }

    if (complexity.factors.authenticationRequired) {
      reasons.push('complex authentication')
    }

    if (complexity.factors.performanceCritical) {
      reasons.push('performance requirements')
    }

    return {
      shouldHandover: true,
      reason: `High complexity (${complexity.score}/100): ${reasons.join(', ')}`,
      urgency: complexity.score >= 85 ? 'high' : 'medium',
    }
  }

  return {
    shouldHandover: false,
    reason: `Low complexity (${complexity.score}/100) below threshold (${handoverConfig.complexityThreshold})`,
    urgency: 'low',
  }
}

// === User Control Functions ===

/**
 * Allow users to override handover behavior for specific requests
 */
export function setUserHandoverPreference(userId: string, preference: {
  enableHandovers?: boolean
  complexityOverride?: number
  bypassValidation?: boolean
}): void {
  // In a real implementation, this would store user preferences
  // For now, we'll just log the preference
  logger.info(`User handover preference updated for ${userId}:`, preference)

  if (preference.enableHandovers === false) {
    logger.info(`User ${userId} has disabled handovers`)
  }

  if (preference.complexityOverride) {
    logger.info(`User ${userId} set complexity override to ${preference.complexityOverride}`)
  }
}

/**
 * Check if user has disabled handovers
 */
export function isHandoverDisabledByUser(_userId?: string): boolean {
  // In a real implementation, this would check user preferences
  // For now, respect the global allowUserDisable setting
  return false
}

// === Handover Activation Functions ===

/**
 * Activate handover system with specific configuration
 */
export function activateHandovers(config: Partial<HandoverConfig> = {}): void {
  Object.assign(handoverConfig, {
    enableHandovers: true,
    ...config,
  })

  logger.info('Agent handover system activated with configuration:', {
    complexityThreshold: handoverConfig.complexityThreshold,
    nodeCountThreshold: handoverConfig.nodeCountThreshold,
    integrationCountThreshold: handoverConfig.integrationCountThreshold,
    emergencyEscalation: handoverConfig.emergencyEscalation,
    maxHandoverChain: handoverConfig.maxHandoverChain,
  })
}

/**
 * Deactivate handover system (fall back to simple routing)
 */
export function deactivateHandovers(): void {
  handoverConfig.enableHandovers = false
  logger.info('Agent handover system deactivated - using simple routing')
}

/**
 * Get current handover configuration for debugging/monitoring
 */
export function getHandoverStatus(): {
  enabled: boolean
  config: HandoverConfig
  stats: {
    totalHandovers: number
    averageComplexityScore: number
    emergencyEscalations: number
  }
} {
  // In a real implementation, these stats would come from the story manager
  return {
    enabled: handoverConfig.enableHandovers,
    config: handoverConfig,
    stats: {
      totalHandovers: 0, // Would be tracked in production
      averageComplexityScore: 0, // Would be calculated from recent handovers
      emergencyEscalations: 0, // Would be tracked in production
    },
  }
}

// === Environment-based Activation ===

// Auto-enable handovers in development for testing
if (process.env.NODE_ENV === 'development' && !process.env.DISABLE_DEV_HANDOVERS) {
  logger.info('Development environment detected - enabling handovers for testing')
  activateHandovers({
    complexityThreshold: 50, // Lower threshold for easier testing
    detailedLogging: true,
    enforceHandoverValidation: false, // More lenient for development
  })
}

// Log configuration on startup
logger.info('Handover system initialized:', {
  enabled: handoverConfig.enableHandovers,
  complexityThreshold: handoverConfig.complexityThreshold,
  emergencyEscalation: handoverConfig.emergencyEscalation,
})
