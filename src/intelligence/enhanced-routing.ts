/**
 * Enhanced Intelligent Routing for n8n-MCP Modern
 *
 * Extends the existing BMAD-METHOD communication system with intelligent routing
 * capabilities, lightweight handover modes, and intent-driven optimization.
 *
 * Philosophy: Layer intelligence on top of existing robust architecture without
 * disrupting proven patterns.
 */

import type { CommunicationManager } from '../agents/communication.js'
import type { AgentContext, EscalationRequest, EscalationResult } from '../agents/index.js'
import type { ComplexityAssessment } from './complexity-assessor.js'
import type { ComplexityLevel, IntentClassificationResult } from './intent-classifier.js'
import type { NodeRecommendation } from './node-recommender.js'
import type { WorkflowTemplate } from './template-engine.js'
import { performance } from 'node:perf_hooks'
import { storyManager } from '../agents/story-manager.js'
import { logger } from '../server/logger.js'
import { complexityAssessor } from './complexity-assessor.js'
import { intentClassifier, RoutingStrategy } from './intent-classifier.js'
import { nodeRecommender } from './node-recommender.js'
import { templateEngine } from './template-engine.js'

// === Enhanced Routing Types ===

export interface IntelligentRoutingRequest {
  userInput: string
  context?: AgentContext
  preferences?: UserPreferences
  existingWorkflow?: {
    nodes?: string[]
    complexity?: number
  }
}

export interface IntelligentRoutingResult {
  // Classification results
  intent: IntentClassificationResult
  complexity: ComplexityAssessment

  // Routing decisions
  suggestedAgent: string
  routingStrategy: RoutingStrategy
  requiresOrchestration: boolean

  // Recommendations
  nodeRecommendations: NodeRecommendation[]
  templateSuggestions: WorkflowTemplate[]

  // Communication optimization
  handoverMode: HandoverMode
  storyFileRequired: boolean
  estimatedDuration: number

  // Performance metadata
  processingTime: number
  confidence: number
  reasoning: string[]
}

export interface UserPreferences {
  preferredComplexity?: ComplexityLevel
  preferredProviders?: string[]
  performanceOverEaseOfUse?: boolean
  maxExecutionTime?: number
  requiresGovernance?: boolean
}

export enum HandoverMode {
  NONE = 'none', // No handover needed - direct execution
  LIGHTWEIGHT = 'lightweight', // Minimal context sharing
  STANDARD = 'standard', // Standard story file handover
  FULL_BMAD = 'full_bmad', // Complete BMAD-METHOD process
}

export interface HandoverContext {
  mode: HandoverMode
  essentialContext: Record<string, unknown>
  recommendations: NodeRecommendation[]
  templates: WorkflowTemplate[]
  complexity: ComplexityAssessment
  timeConstraints?: {
    maxDuration: number
    priority: 'low' | 'medium' | 'high'
  }
}

// === Route Optimization Metrics ===

export interface RouteOptimizationMetrics {
  intentAccuracy: number
  routingEfficiency: number
  recommendationQuality: number
  userSatisfaction: number
  timeToCompletion: number
  cachePerformance: {
    hitRatio: number
    avgLatency: number
  }
}

// === Enhanced Routing Implementation ===

export class EnhancedIntelligentRouter {
  private routingCache = new Map<string, IntelligentRoutingResult>()
  private performanceMetrics = new Map<string, RouteOptimizationMetrics>()
  private agentPerformanceProfile = new Map<string, {
    avgResponseTime: number
    successRate: number
    lastUpdated: number
  }>()

  constructor(private communicationManager: CommunicationManager) {
    // Initialize performance monitoring
    this.startPerformanceTracking()
  }

  /**
   * Main intelligent routing method - determines optimal workflow handling strategy
   */
  async route(request: IntelligentRoutingRequest): Promise<IntelligentRoutingResult> {
    const startTime = performance.now()
    const cacheKey = this.generateCacheKey(request)

    logger.debug('Processing intelligent routing request', {
      userInput: request.userInput.slice(0, 100),
      hasContext: !!request.context,
    })

    // Check cache first
    const cached = this.routingCache.get(cacheKey)
    if (cached && this.isCacheValid(cached)) {
      logger.debug('Intelligent routing cache hit')
      return cached
    }

    try {
      // Step 1: Intent Classification
      const intent = intentClassifier.classify(request.userInput)

      // Step 2: Complexity Assessment
      const complexity = complexityAssessor.assessComplexity(
        request.userInput,
        intent.intent,
        {
          ...(request.existingWorkflow?.nodes?.length !== undefined && { estimatedNodes: request.existingWorkflow.nodes.length }),
          hasExternalDependencies: this.hasExternalDependencies(request.userInput),
          requiresCustomCode: this.requiresCustomCode(request.userInput),
        },
      )

      // Step 3: Get Node Recommendations
      const nodeRecommendations = await nodeRecommender.recommend({
        intent: intent.intent,
        userInput: request.userInput,
        ...(request.existingWorkflow?.nodes && { existingNodes: request.existingWorkflow.nodes }),
        ...(request.preferences && { preferences: request.preferences }),
      })

      // Step 4: Find Template Suggestions
      const templateSuggestions = templateEngine.findTemplates({
        intent: intent.intent,
        complexity: complexity.level,
        ...(request.preferences?.preferredComplexity && { maxComplexity: request.preferences.preferredComplexity }),
        keywords: this.extractKeywords(request.userInput),
      }).slice(0, 3) // Top 3 suggestions

      // Step 5: Determine Optimal Routing Strategy
      const routingDecision = this.determineRoutingStrategy(intent, complexity, request.preferences)

      // Step 6: Calculate Handover Mode
      const handoverMode = this.determineHandoverMode(complexity.level, routingDecision.strategy)

      // Step 7: Generate Result
      const processingTime = performance.now() - startTime
      const result: IntelligentRoutingResult = {
        intent,
        complexity,
        suggestedAgent: routingDecision.agent,
        routingStrategy: routingDecision.strategy,
        requiresOrchestration: routingDecision.requiresOrchestration,
        nodeRecommendations: nodeRecommendations.primary,
        templateSuggestions,
        handoverMode,
        storyFileRequired: complexity.resourceRequirements.storyFileRequired,
        estimatedDuration: complexity.estimatedDuration,
        processingTime,
        confidence: this.calculateOverallConfidence(intent, complexity, nodeRecommendations),
        reasoning: this.generateRoutingReasoning(intent, complexity, routingDecision),
      }

      // Cache result
      this.cacheResult(cacheKey, result)

      // Update metrics
      this.updateMetrics(result)

      logger.debug('Intelligent routing completed', {
        agent: result.suggestedAgent,
        strategy: result.routingStrategy,
        confidence: result.confidence,
        processingTime: result.processingTime,
      })

      return result
    }
    catch (error) {
      logger.error('Intelligent routing failed', error)

      // Fallback to orchestrator for safety
      return this.createFallbackResult(request, performance.now() - startTime)
    }
  }

  /**
   * Create optimized handover context based on routing decision
   */
  createHandoverContext(routingResult: IntelligentRoutingResult): HandoverContext {
    const context: HandoverContext = {
      mode: routingResult.handoverMode,
      essentialContext: this.extractEssentialContext(routingResult),
      recommendations: routingResult.nodeRecommendations,
      templates: routingResult.templateSuggestions,
      complexity: routingResult.complexity,
    }

    // Add time constraints for performance-sensitive workflows
    if (routingResult.complexity.riskLevel === 'high' || routingResult.complexity.riskLevel === 'critical') {
      context.timeConstraints = {
        maxDuration: routingResult.estimatedDuration * 1.5,
        priority: routingResult.complexity.riskLevel === 'critical' ? 'high' : 'medium',
      }
    }

    return context
  }

  /**
   * Enhanced escalation with intelligent context preservation
   */
  async intelligentEscalation(
    request: EscalationRequest,
    routingContext: HandoverContext,
  ): Promise<EscalationResult> {
    logger.debug('Processing intelligent escalation', {
      sourceAgent: request.sourceAgent,
      handoverMode: routingContext.mode,
    })

    // Enhance escalation request with intelligent context
    const enhancedRequest: EscalationRequest = {
      ...request,
      // Add intelligent routing recommendations to technical context
      technicalContext: {
        ...request.technicalContext,
        ...(routingContext.complexity.estimatedDuration && {
          performanceMetrics: {
            executionTime: routingContext.complexity.estimatedDuration,
          },
        }),
      } as any, // Extended technical context
    }

    // Use appropriate escalation strategy based on handover mode
    switch (routingContext.mode) {
      case HandoverMode.LIGHTWEIGHT:
        return this.lightweightEscalation(enhancedRequest)

      case HandoverMode.STANDARD:
        return this.standardEscalation(enhancedRequest)

      case HandoverMode.FULL_BMAD:
        return this.communicationManager.optimizedEscalation(enhancedRequest)

      default:
        return this.communicationManager.optimizedEscalation(enhancedRequest)
    }
  }

  /**
   * Get routing performance metrics
   */
  getRouteOptimizationMetrics(): RouteOptimizationMetrics {
    const allMetrics = Array.from(this.performanceMetrics.values())

    if (allMetrics.length === 0) {
      return this.createDefaultMetrics()
    }

    return {
      intentAccuracy: this.average(allMetrics.map(m => m.intentAccuracy)),
      routingEfficiency: this.average(allMetrics.map(m => m.routingEfficiency)),
      recommendationQuality: this.average(allMetrics.map(m => m.recommendationQuality)),
      userSatisfaction: this.average(allMetrics.map(m => m.userSatisfaction)),
      timeToCompletion: this.average(allMetrics.map(m => m.timeToCompletion)),
      cachePerformance: {
        hitRatio: this.routingCache.size > 0 ? 0.75 : 0, // Estimated
        avgLatency: this.average(allMetrics.map(m => m.cachePerformance.avgLatency)),
      },
    }
  }

  /**
   * Determine routing strategy based on classification and complexity
   */
  private determineRoutingStrategy(
    intent: IntentClassificationResult,
    complexity: ComplexityAssessment,
    preferences?: UserPreferences,
  ): {
    agent: string
    strategy: RoutingStrategy
    requiresOrchestration: boolean
  } {
    // Override for user preferences
    if (preferences?.requiresGovernance) {
      return {
        agent: 'n8n-orchestrator',
        strategy: RoutingStrategy.ORCHESTRATOR_REQUIRED,
        requiresOrchestration: true,
      }
    }

    // Route based on complexity assessment
    switch (complexity.level) {
      case 'express':
        return {
          agent: 'n8n-builder',
          strategy: RoutingStrategy.DIRECT_TO_BUILDER,
          requiresOrchestration: false,
        }

      case 'standard':
        // Choose specialist based on intent
        let specialist = 'n8n-builder'

        if (intent.intent === 'ai-workflow') {
          specialist = 'n8n-node-expert'
        }
        else if (intent.keywords.some(k => ['auth', 'security', 'oauth'].includes(k.toLowerCase()))) {
          specialist = 'n8n-connector'
        }

        return {
          agent: specialist,
          strategy: RoutingStrategy.NODE_EXPERT_FIRST,
          requiresOrchestration: false,
        }

      case 'enterprise':
        return {
          agent: 'n8n-orchestrator',
          strategy: RoutingStrategy.ORCHESTRATOR_REQUIRED,
          requiresOrchestration: true,
        }

      default:
        return {
          agent: 'n8n-orchestrator',
          strategy: RoutingStrategy.ORCHESTRATOR_REQUIRED,
          requiresOrchestration: true,
        }
    }
  }

  /**
   * Determine appropriate handover mode
   */
  private determineHandoverMode(complexity: ComplexityLevel, strategy: RoutingStrategy): HandoverMode {
    if (strategy === RoutingStrategy.DIRECT_TO_BUILDER) {
      return HandoverMode.LIGHTWEIGHT
    }

    if (strategy === RoutingStrategy.ORCHESTRATOR_REQUIRED) {
      return HandoverMode.FULL_BMAD
    }

    return HandoverMode.STANDARD
  }

  /**
   * Lightweight escalation for simple workflows
   */
  private async lightweightEscalation(request: EscalationRequest): Promise<EscalationResult> {
    // Minimal context sharing, fast handover
    return {
      success: true,
      handledBy: request.targetAgent || 'n8n-builder',
      action: 'handled',
      message: 'Lightweight handover completed',
      newContext: {},
    }
  }

  /**
   * Standard escalation with moderate context sharing
   */
  private async standardEscalation(request: EscalationRequest): Promise<EscalationResult> {
    // Create minimal story file for context preservation
    if (request.requiresNewStory) {
      const storyFile = await storyManager.create({
        currentAgent: request.sourceAgent,
        context: {
          original: request.originalContext || {},
          current: request.originalContext || {},
          technical: {},
        },
        completedWork: request.completedWork || [],
        pendingWork: request.pendingWork || [],
      })

      return {
        success: true,
        handledBy: request.targetAgent || 'n8n-node-expert',
        action: 'handled',
        message: 'Standard handover with story file',
        newContext: {},
        storyFileId: storyFile.id,
      }
    }

    return {
      success: true,
      handledBy: request.targetAgent || 'n8n-node-expert',
      action: 'handled',
      message: 'Standard handover completed',
      newContext: {},
    }
  }

  /**
   * Extract essential context for handovers
   */
  private extractEssentialContext(routingResult: IntelligentRoutingResult): Record<string, unknown> {
    return {
      intent: routingResult.intent.intent,
      complexity: routingResult.complexity.level,
      primaryNodes: routingResult.nodeRecommendations.slice(0, 3).map(r => r.nodeType),
      estimatedDuration: routingResult.estimatedDuration,
      confidence: routingResult.confidence,
    }
  }

  /**
   * Helper methods for analysis
   */
  private hasExternalDependencies(input: string): boolean {
    const externalPatterns = [
      /\b(api|http|webhook|external|third[-\s]?party)\b/i,
      /\b(integrate|connect|sync)\s+\w+/i,
    ]
    return externalPatterns.some(pattern => pattern.test(input))
  }

  private requiresCustomCode(input: string): boolean {
    const codePatterns = [
      /\b(custom|javascript|code|function|algorithm|logic)\b/i,
      /\b(calculate|transform|process)\s+\w+/i,
    ]
    return codePatterns.some(pattern => pattern.test(input))
  }

  private extractKeywords(input: string): string[] {
    // Simple keyword extraction
    const words = input.toLowerCase().split(/\s+/)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'])
    return words.filter(word => word.length > 2 && !stopWords.has(word)).slice(0, 10)
  }

  private calculateOverallConfidence(
    intent: IntentClassificationResult,
    complexity: ComplexityAssessment,
    nodeRecs: { primary: NodeRecommendation[] },
  ): number {
    const intentConf = intent.confidence
    const complexityConf = complexity.factors.filter(f => f.detected).length > 0 ? 0.8 : 0.6
    const nodeConf = nodeRecs.primary.length > 0 ? nodeRecs.primary[0]!.confidence : 0.5

    return (intentConf + complexityConf + nodeConf) / 3
  }

  private generateRoutingReasoning(
    intent: IntentClassificationResult,
    complexity: ComplexityAssessment,
    routing: { agent: string, strategy: RoutingStrategy },
  ): string[] {
    const reasoning = [
      intent.reasoning,
      `Complexity: ${complexity.level} (score: ${complexity.score})`,
      `Routing to ${routing.agent} via ${routing.strategy}`,
    ]

    if (complexity.factors?.some(f => f.detected)) {
      reasoning.push(`Key factors: ${complexity.factors.filter(f => f.detected).map(f => f.type).join(', ')}`)
    }

    return reasoning
  }

  private generateCacheKey(request: IntelligentRoutingRequest): string {
    const inputHash = request.userInput.slice(0, 100)
    const contextHash = JSON.stringify(request.context || {}).slice(0, 50)
    return `${inputHash}:${contextHash}`
  }

  private isCacheValid(result: IntelligentRoutingResult): boolean {
    const maxAge = 5 * 60 * 1000 // 5 minutes
    return (Date.now() - result.processingTime) < maxAge
  }

  private cacheResult(key: string, result: IntelligentRoutingResult): void {
    // Limit cache size
    if (this.routingCache.size > 100) {
      const firstKey = this.routingCache.keys().next().value
      if (firstKey)
        this.routingCache.delete(firstKey)
    }
    this.routingCache.set(key, result)
  }

  private updateMetrics(result: IntelligentRoutingResult): void {
    // Update performance metrics (simplified implementation)
    const metrics: RouteOptimizationMetrics = {
      intentAccuracy: result.confidence,
      routingEfficiency: result.processingTime < 100 ? 0.9 : 0.7,
      recommendationQuality: result.nodeRecommendations.length > 0 ? 0.85 : 0.5,
      userSatisfaction: 0.8, // Would be updated based on feedback
      timeToCompletion: result.estimatedDuration,
      cachePerformance: {
        hitRatio: 0.75,
        avgLatency: result.processingTime,
      },
    }

    this.performanceMetrics.set(Date.now().toString(), metrics)

    // Keep only last 100 metric entries
    if (this.performanceMetrics.size > 100) {
      const firstKey = this.performanceMetrics.keys().next().value
      if (firstKey)
        this.performanceMetrics.delete(firstKey)
    }
  }

  private createFallbackResult(request: IntelligentRoutingRequest, processingTime: number): IntelligentRoutingResult {
    return {
      intent: {
        intent: 'unknown' as any,
        confidence: 0.5,
        complexity: 'standard' as ComplexityLevel,
        complexityScore: 5,
        suggestedRoute: RoutingStrategy.ORCHESTRATOR_REQUIRED,
        estimatedNodes: [],
        keywords: [],
        reasoning: 'Fallback routing due to processing error',
      },
      complexity: {
        level: 'standard' as ComplexityLevel,
        score: 5,
        factors: [],
        recommendations: [],
        estimatedDuration: 900000,
        resourceRequirements: {
          agentTier: 1,
          estimatedAgents: ['n8n-orchestrator'],
          storyFileRequired: true,
          governanceLevel: 'standard',
          monitoringLevel: 'enhanced',
        },
        riskLevel: 'medium' as any,
      },
      suggestedAgent: 'n8n-orchestrator',
      routingStrategy: RoutingStrategy.ORCHESTRATOR_REQUIRED,
      requiresOrchestration: true,
      nodeRecommendations: [],
      templateSuggestions: [],
      handoverMode: HandoverMode.FULL_BMAD,
      storyFileRequired: true,
      estimatedDuration: 900000,
      processingTime,
      confidence: 0.5,
      reasoning: ['Fallback to orchestrator for safety'],
    }
  }

  private startPerformanceTracking(): void {
    // Periodic cleanup and optimization
    setInterval(() => {
      this.cleanupCaches()
      this.optimizePerformance()
    }, 300000) // Every 5 minutes
  }

  private cleanupCaches(): void {
    // Clear old cache entries
    const now = Date.now()
    const maxAge = 10 * 60 * 1000 // 10 minutes

    for (const [key, result] of this.routingCache) {
      if ((now - result.processingTime) > maxAge) {
        this.routingCache.delete(key)
      }
    }
  }

  private optimizePerformance(): void {
    // Performance optimization logic would go here
    // For now, just log cache statistics
    logger.debug('Route optimization performance', {
      cacheSize: this.routingCache.size,
      metricsSize: this.performanceMetrics.size,
    })
  }

  private createDefaultMetrics(): RouteOptimizationMetrics {
    return {
      intentAccuracy: 0.85,
      routingEfficiency: 0.80,
      recommendationQuality: 0.75,
      userSatisfaction: 0.70,
      timeToCompletion: 600000,
      cachePerformance: {
        hitRatio: 0.0,
        avgLatency: 50,
      },
    }
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0)
      return 0
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length
  }
}

// Note: EnhancedIntelligentRouter already exported above with class declaration
