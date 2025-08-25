/**
 * Intelligent Agent Routing System
 * 
 * Bridges the gap between simple routing and agent handovers.
 * Automatically determines when to use collaborative multi-agent approach
 * versus single-agent simple routing based on complexity and user preferences.
 */

import { logger } from './logger.js'
import { agentRouter } from '../agents/index.js'
import type { Agent, AgentContext } from '../agents/index.js'
import { 
  shouldTriggerHandover, 
  assessWorkflowComplexity,
  handoverConfig,
  isHandoverDisabledByUser 
} from './handover-features.js'
import { CommunicationManager } from '../agents/communication.js'
import { storyManager } from '../agents/story-manager.js'
import type { StoryFile } from '../agents/story-files.js'

// === Routing Decision Types ===

export interface RoutingDecision {
  agent: Agent
  approach: 'simple' | 'handover' | 'emergency'
  reasoning: string
  complexity: number
  storyFileId?: string | undefined
  estimatedSteps: number
  suggestedAgentChain?: string[] | undefined
}

export interface RoutingContext extends AgentContext {
  userId?: string
  toolName: string
  requestId?: string
  userPreferHandovers?: boolean
  timeoutMs?: number
}

// === Intelligent Router Class ===

export class IntelligentRouter {
  private communicationManager?: CommunicationManager
  private routingHistory: Array<{
    timestamp: number
    toolName: string
    approach: string
    success: boolean
    complexityScore: number
    handoverChainLength?: number
  }> = []

  constructor(agents?: Agent[]) {
    if (agents && agents.length > 0) {
      this.communicationManager = new CommunicationManager(agents)
    }
  }

  /**
   * Main routing decision point - chooses between simple and handover approaches
   */
  async routeWithIntelligence(
    toolName: string, 
    context: RoutingContext
  ): Promise<RoutingDecision> {
    const startTime = performance.now()
    
    try {
      logger.debug(`Intelligent routing request for ${toolName}`, { 
        complexity: context.complexity,
        integrations: context.integrations?.length,
        customCode: !!context.customCode 
      })

      // Step 1: Assess complexity
      const complexityAssessment = assessWorkflowComplexity(context)
      
      // Step 2: Check user preferences and system configuration
      const userHandoversDisabled = isHandoverDisabledByUser(context.userId)
      const globalHandoversDisabled = !handoverConfig.enableHandovers
      const userPreference = context.userPreferHandovers

      // Step 3: Make routing decision
      let approach: 'simple' | 'handover' | 'emergency' = 'simple'
      let reasoning = 'Default simple routing'
      
      // Emergency escalation takes priority
      if (complexityAssessment.recommendation === 'emergency' && 
          handoverConfig.emergencyEscalation && 
          !globalHandoversDisabled) {
        approach = 'emergency'
        reasoning = 'Emergency escalation required for security/performance'
      }
      // Handover recommendation
      else if (complexityAssessment.recommendation === 'handover') {
        if (globalHandoversDisabled) {
          approach = 'simple'
          reasoning = 'Handovers recommended but disabled globally'
        } else if (userHandoversDisabled && !userPreference) {
          approach = 'simple'
          reasoning = 'Handovers recommended but disabled by user'
        } else {
          approach = 'handover'
          reasoning = `High complexity (${complexityAssessment.score}/100) triggers handover system`
        }
      }
      // User explicitly requested handovers
      else if (userPreference && !globalHandoversDisabled && !userHandoversDisabled) {
        approach = 'handover'
        reasoning = 'User explicitly requested collaborative approach'
      }

      // Step 4: Route based on decision
      let agent: Agent
      let storyFileId: string | undefined
      let suggestedAgentChain: string[] | undefined

      if (approach === 'simple') {
        agent = await agentRouter.routeTool(toolName, context)
      } else {
        // Use handover system
        const handoverResult = await this.routeWithHandovers(toolName, context, approach)
        agent = handoverResult.agent
        storyFileId = handoverResult.storyFileId
        suggestedAgentChain = handoverResult.suggestedAgentChain
      }

      // Step 5: Record routing decision
      const decision: RoutingDecision = {
        agent,
        approach,
        reasoning,
        complexity: complexityAssessment.score,
        storyFileId,
        estimatedSteps: this.estimateSteps(complexityAssessment, approach),
        suggestedAgentChain,
      }

      // Step 6: Update routing history
      this.recordRoutingDecision(toolName, decision, performance.now() - startTime)

      if (handoverConfig.detailedLogging) {
        logger.info(`Intelligent routing decision for ${toolName}:`, {
          approach: decision.approach,
          agent: decision.agent.name,
          complexity: decision.complexity,
          reasoning: decision.reasoning,
          estimatedSteps: decision.estimatedSteps,
        })
      }

      return decision

    } catch (error) {
      logger.error(`Intelligent routing failed for ${toolName}:`, error)
      
      // Fallback to simple routing
      const fallbackAgent = await agentRouter.routeTool(toolName, context)
      return {
        agent: fallbackAgent,
        approach: 'simple',
        reasoning: 'Fallback to simple routing due to error',
        complexity: 0,
        estimatedSteps: 1,
      }
    }
  }

  /**
   * Route using handover system with story files
   */
  private async routeWithHandovers(
    toolName: string, 
    context: RoutingContext, 
    approach: 'handover' | 'emergency'
  ): Promise<{
    agent: Agent
    storyFileId?: string
    suggestedAgentChain?: string[]
  }> {
    const complexityAssessment = assessWorkflowComplexity(context)
    
    // Determine initial agent based on tool
    const initialAgent = await agentRouter.routeTool(toolName, context)
    
    // Create story file for handover tracking
    const storyFile = await storyManager.create({
      currentAgent: initialAgent.name,
      context: {
        original: context,
        current: context,
        technical: {
          codebaseAnalysis: {
            filesModified: [],
            filesCreated: [],
            filesDeleted: [],
            dependencies: context.integrations ?? [],
            breakingChanges: false,
          },
          ...(complexityAssessment.factors.securitySensitive && {
            securityConsiderations: {
              vulnerabilitiesFound: context.securityRisk === 'high' ? 1 : 0,
              sensitiveDataHandling: !!context.customCode,
              authenticationRequired: !!context.requiresAuthentication,
              encryptionUsed: false,
            },
          }),
          ...(complexityAssessment.factors.performanceCritical && {
            performanceMetrics: {
              executionTime: context.executionTime,
              memoryUsage: context.memoryUsage,
              cpuUsage: context.cpuUsage,
            },
          }),
        },
      },
      pendingWork: this.generateInitialWorkItems(toolName, context, complexityAssessment),
      priority: approach === 'emergency' ? 10 : Math.floor(complexityAssessment.score / 20),
      tags: [
        toolName,
        approach,
        ...(complexityAssessment.factors.securitySensitive ? ['security'] : []),
        ...(complexityAssessment.factors.performanceCritical ? ['performance'] : []),
        ...(context.integrations ?? []),
      ],
      handoverNotes: this.generateInitialHandoverNotes(toolName, context, complexityAssessment, approach),
    })

    // Suggest agent chain based on complexity
    const suggestedAgentChain = this.suggestAgentChain(toolName, complexityAssessment)

    if (handoverConfig.detailedLogging) {
      logger.info(`Created story file ${storyFile.id} for ${approach} approach`, {
        initialAgent: initialAgent.name,
        complexity: complexityAssessment.score,
        suggestedChain: suggestedAgentChain,
      })
    }

    return {
      agent: initialAgent,
      storyFileId: storyFile.id,
      suggestedAgentChain,
    }
  }

  /**
   * Generate initial work items based on tool and complexity
   */
  private generateInitialWorkItems(
    toolName: string, 
    context: RoutingContext, 
    complexity: ReturnType<typeof assessWorkflowComplexity>
  ): string[] {
    const workItems: string[] = []

    // Tool-specific initial work
    if (toolName.includes('workflow') || toolName.includes('create')) {
      workItems.push('Design workflow architecture')
      if (complexity.factors.integrationCount > 2) {
        workItems.push('Plan integration strategy')
      }
    }

    if (toolName.includes('auth') || context.requiresAuthentication) {
      workItems.push('Configure authentication and credentials')
    }

    if (complexity.factors.customCodePresent) {
      workItems.push('Review custom JavaScript for security')
      workItems.push('Validate code performance and patterns')
    }

    if (complexity.factors.performanceCritical) {
      workItems.push('Establish performance benchmarks')
      workItems.push('Optimize for scale and efficiency')
    }

    // General work items
    workItems.push('Implement core functionality')
    workItems.push('Test and validate implementation')

    if (complexity.score > 70) {
      workItems.push('Documentation and user guidance')
    }

    return workItems
  }

  /**
   * Generate initial handover notes
   */
  private generateInitialHandoverNotes(
    toolName: string,
    context: RoutingContext,
    complexity: ReturnType<typeof assessWorkflowComplexity>,
    approach: 'handover' | 'emergency'
  ): string {
    const notes = [`${approach === 'emergency' ? 'EMERGENCY' : 'Complex'} ${toolName} request initiated.`]
    
    notes.push(`Complexity Score: ${complexity.score}/100`)
    
    if (complexity.factors.nodeCount > 0) {
      notes.push(`Workflow size: ${complexity.factors.nodeCount} nodes`)
    }
    
    if (complexity.factors.integrationCount > 0) {
      notes.push(`Integrations: ${context.integrations?.join(', ') ?? 'multiple'}`)
    }
    
    if (complexity.factors.customCodePresent) {
      notes.push('Contains custom JavaScript - security review required')
    }
    
    if (complexity.factors.authenticationRequired) {
      notes.push('Complex authentication setup needed')
    }
    
    if (complexity.factors.performanceCritical) {
      notes.push('Performance optimization required')
    }

    notes.push(`Handover system activated to ensure quality and expertise coverage.`)

    return notes.join(' ')
  }

  /**
   * Suggest optimal agent chain based on complexity factors
   */
  private suggestAgentChain(
    toolName: string,
    complexity: ReturnType<typeof assessWorkflowComplexity>
  ): string[] {
    const chain: string[] = []

    // Always start with architect for high complexity
    if (complexity.score > 60) {
      chain.push('n8n-workflow-architect')
    }

    // Add specialist based on needs
    if (toolName.includes('workflow') || toolName.includes('create') || complexity.factors.nodeCount > 5) {
      chain.push('n8n-developer-specialist')
    }

    if (complexity.factors.authenticationRequired || complexity.factors.integrationCount > 2) {
      chain.push('n8n-integration-specialist')
    }

    if (complexity.factors.customCodePresent) {
      chain.push('n8n-javascript-specialist')
    }

    if (complexity.factors.performanceCritical || complexity.score > 80) {
      chain.push('n8n-performance-specialist')
    }

    // Always end with guidance for complex workflows
    if (complexity.score > 70 || chain.length > 2) {
      chain.push('n8n-guidance-specialist')
    }

    // Ensure we don't exceed max chain length
    if (chain.length > handoverConfig.maxHandoverChain) {
      chain.splice(handoverConfig.maxHandoverChain)
    }

    return chain
  }

  /**
   * Estimate number of steps based on complexity and approach
   */
  private estimateSteps(
    complexity: ReturnType<typeof assessWorkflowComplexity>,
    approach: 'simple' | 'handover' | 'emergency'
  ): number {
    if (approach === 'simple') {
      return 1
    }

    let steps = 2 // Minimum for handover approach

    // Add steps based on complexity factors
    if (complexity.factors.authenticationRequired) steps += 1
    if (complexity.factors.customCodePresent) steps += 1
    if (complexity.factors.performanceCritical) steps += 1
    if (complexity.factors.integrationCount > 3) steps += 1

    // Score-based adjustment
    if (complexity.score > 80) steps += 1
    if (complexity.score > 90) steps += 1

    return Math.min(steps, handoverConfig.maxHandoverChain)
  }

  /**
   * Record routing decision for analytics
   */
  private recordRoutingDecision(
    toolName: string,
    decision: RoutingDecision,
    processingTimeMs: number
  ): void {
    this.routingHistory.push({
      timestamp: Date.now(),
      toolName,
      approach: decision.approach,
      success: true, // Will be updated based on actual execution results
      complexityScore: decision.complexity,
      ...(decision.suggestedAgentChain?.length !== undefined && {
        handoverChainLength: decision.suggestedAgentChain.length
      }),
    })

    // Keep history bounded
    if (this.routingHistory.length > 1000) {
      this.routingHistory.shift()
    }

    // Log performance metrics
    if (handoverConfig.handoverMetrics) {
      logger.debug(`Routing performance for ${toolName}:`, {
        processingTime: `${processingTimeMs.toFixed(2)}ms`,
        approach: decision.approach,
        complexity: decision.complexity,
      })
    }
  }

  /**
   * Get routing analytics for monitoring
   */
  getRoutingAnalytics(): {
    totalRequests: number
    approachDistribution: Record<string, number>
    averageComplexity: number
    handoverSuccessRate: number
    popularTools: Array<{ tool: string, count: number }>
  } {
    const total = this.routingHistory.length
    const approachDistribution: Record<string, number> = {}
    let totalComplexity = 0
    let handoverSuccesses = 0
    let totalHandovers = 0
    const toolCounts: Record<string, number> = {}

    for (const record of this.routingHistory) {
      approachDistribution[record.approach] = (approachDistribution[record.approach] || 0) + 1
      totalComplexity += record.complexityScore
      
      if (record.approach !== 'simple') {
        totalHandovers++
        if (record.success) handoverSuccesses++
      }

      toolCounts[record.toolName] = (toolCounts[record.toolName] || 0) + 1
    }

    const popularTools = Object.entries(toolCounts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalRequests: total,
      approachDistribution,
      averageComplexity: total > 0 ? totalComplexity / total : 0,
      handoverSuccessRate: totalHandovers > 0 ? handoverSuccesses / totalHandovers : 0,
      popularTools,
    }
  }
}

// === Singleton Export ===

export const intelligentRouter = new IntelligentRouter()

// === Utility Functions ===

/**
 * Quick complexity check for tools that want to self-assess
 */
export function quickComplexityCheck(context: AgentContext): {
  isComplex: boolean
  score: number
  factors: string[]
} {
  const assessment = assessWorkflowComplexity(context)
  const factors: string[] = []

  if (assessment.factors.nodeCount > handoverConfig.nodeCountThreshold) {
    factors.push(`${assessment.factors.nodeCount} nodes`)
  }
  
  if (assessment.factors.integrationCount > handoverConfig.integrationCountThreshold) {
    factors.push(`${assessment.factors.integrationCount} integrations`)
  }
  
  if (assessment.factors.customCodePresent) factors.push('custom code')
  if (assessment.factors.authenticationRequired) factors.push('authentication')
  if (assessment.factors.performanceCritical) factors.push('performance')
  if (assessment.factors.securitySensitive) factors.push('security')

  return {
    isComplex: assessment.score >= handoverConfig.complexityThreshold,
    score: assessment.score,
    factors,
  }
}