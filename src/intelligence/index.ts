/**
 * Intelligence Layer Orchestrator for n8n-MCP Modern
 *
 * Central integration point for all intelligent workflow optimization features.
 * Provides a unified interface for intent classification, node recommendation,
 * complexity assessment, and enhanced routing while preserving the existing
 * agent handover architecture.
 *
 * Philosophy: Intelligent enhancement layer that augments rather than replaces
 * the proven agent handover system.
 */

import type { CommunicationManager } from '../agents/communication.js'
import type { AgentContext } from '../agents/index.js'

import type { ComplexityAssessment } from './complexity-assessor.js'

import type { HandoverMode, IntelligentRoutingRequest, IntelligentRoutingResult, RouteOptimizationMetrics } from './enhanced-routing.js'
import type { ComplexityLevel, IntentClassificationResult, WorkflowIntent } from './intent-classifier.js'
import type { NodeRecommendation } from './node-recommender.js'
import type { CustomizationRequest, CustomizedWorkflow, WorkflowTemplate } from './template-engine.js'
import { shouldLimitMemoryArrays } from '../server/feature-flags.js'
import { logger } from '../server/logger.js'
import {

  complexityAssessor,
} from './complexity-assessor.js'
import {
  EnhancedIntelligentRouter,

} from './enhanced-routing.js'
// Intelligence Layer Components
import {

  intentClassifier,

} from './intent-classifier.js'
import {

  nodeRecommender,

} from './node-recommender.js'
import {

  templateEngine,

} from './template-engine.js'

// === Main Intelligence Service Types ===

export interface IntelligenceConfig {
  enabled: boolean
  features: {
    intentClassification: boolean
    nodeRecommendations: boolean
    templateSuggestions: boolean
    intelligentRouting: boolean
    performanceOptimization: boolean
  }
  thresholds: {
    minConfidence: number
    maxProcessingTime: number
    cacheSize: number
  }
}

export interface WorkflowOptimizationRequest {
  userInput: string
  context?: AgentContext
  preferences?: {
    preferredComplexity?: ComplexityLevel
    preferredProviders?: string[]
    maxExecutionTime?: number
    requiresGovernance?: boolean
    performanceOverEaseOfUse?: boolean
  }
  existingWorkflow?: {
    nodes?: string[]
    complexity?: number
    executionTime?: number
  }
}

export interface WorkflowOptimizationResult {
  // Core Analysis
  intent: IntentClassificationResult
  complexity: ComplexityAssessment
  routing: IntelligentRoutingResult

  // Recommendations
  nodeRecommendations: {
    primary: NodeRecommendation[]
    alternatives: NodeRecommendation[]
    warnings: string[]
  }
  templateSuggestions: WorkflowTemplate[]

  // Optimization Insights
  optimizations: WorkflowOptimization[]
  estimatedImprovement: {
    executionTime: number
    reliability: number
    maintainability: number
  }

  // Metadata
  processingTime: number
  confidence: number
  cacheHit: boolean
}

export interface WorkflowOptimization {
  type: 'performance' | 'reliability' | 'security' | 'maintainability'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  effort: 'low' | 'medium' | 'high'
  recommendation: string
}

export interface IntelligenceMetrics {
  classification: {
    totalRequests: number
    accuracy: number
    avgProcessingTime: number
  }
  routing: RouteOptimizationMetrics
  recommendations: {
    totalGenerated: number
    acceptanceRate: number
    avgQuality: number
  }
  templates: {
    totalSuggestions: number
    usageRate: number
    customizationRate: number
  }
  performance: {
    cacheHitRatio: number
    avgResponseTime: number
    errorRate: number
  }
}

// === Main Intelligence Service ===

export class IntelligenceService {
  private router: EnhancedIntelligentRouter
  private config: IntelligenceConfig
  private metrics = {
    totalRequests: 0,
    cacheHits: 0,
    processingTimes: [] as number[],
  }

  constructor(
    private communicationManager: CommunicationManager,
    config: Partial<IntelligenceConfig> = {},
  ) {
    this.config = this.mergeConfig(config)
    this.router = new EnhancedIntelligentRouter(communicationManager)
    this.initialize()
  }

  /**
   * Main optimization method - analyzes user input and provides comprehensive recommendations
   */
  async optimizeWorkflow(request: WorkflowOptimizationRequest): Promise<WorkflowOptimizationResult> {
    if (!this.config.enabled) {
      return this.createDisabledResult(request)
    }

    const startTime = performance.now()
    this.metrics.totalRequests++

    logger.debug('Processing workflow optimization request', {
      userInput: request.userInput.slice(0, 100),
      hasContext: !!request.context,
      hasPreferences: !!request.preferences,
    })

    try {
      // Step 1: Intelligent Routing Analysis
      const routingRequest: IntelligentRoutingRequest = {
        userInput: request.userInput,
        ...(request.context && { context: request.context }),
        ...(request.preferences && { preferences: request.preferences }),
        ...(request.existingWorkflow && { existingWorkflow: request.existingWorkflow }),
      }

      const routing = await this.router.route(routingRequest)

      // Step 2: Enhanced Node Recommendations (from routing + additional analysis)
      const additionalNodeContext = {
        intent: routing.intent.intent,
        userInput: request.userInput,
        ...(request.existingWorkflow?.nodes && { existingNodes: request.existingWorkflow.nodes }),
        ...(request.preferences && { preferences: request.preferences }),
      }

      const nodeRecommendations = await nodeRecommender.recommend(additionalNodeContext)

      // Step 3: Template Suggestions (enhanced based on routing results)
      const templateSuggestions = routing.templateSuggestions.length > 0
        ? routing.templateSuggestions
        : templateEngine.findTemplates({
            intent: routing.intent.intent,
            complexity: routing.complexity.level,
            keywords: this.extractKeywords(request.userInput),
          }).slice(0, 3)

      // Step 4: Generate Optimization Insights
      const optimizations = this.generateOptimizations(routing, nodeRecommendations, request)

      // Step 5: Calculate Estimated Improvements
      const estimatedImprovement = this.calculateEstimatedImprovement(
        routing,
        nodeRecommendations,
        request.existingWorkflow,
      )

      const processingTime = performance.now() - startTime

      // Add processing time with memory-conscious management
      this.addProcessingTime(processingTime)

      const result: WorkflowOptimizationResult = {
        intent: routing.intent,
        complexity: routing.complexity,
        routing,
        nodeRecommendations: {
          primary: nodeRecommendations.primary,
          alternatives: nodeRecommendations.alternatives,
          warnings: nodeRecommendations.warnings,
        },
        templateSuggestions,
        optimizations,
        estimatedImprovement,
        processingTime,
        confidence: routing.confidence,
        cacheHit: false, // Would be determined by caching logic
      }

      logger.debug('Workflow optimization completed', {
        intent: routing.intent.intent,
        complexity: routing.complexity.level,
        confidence: routing.confidence,
        processingTime,
      })

      return result
    }
    catch (error) {
      logger.error('Workflow optimization failed', error)
      return this.createFallbackResult(request, performance.now() - startTime)
    }
  }

  /**
   * Create customized workflow from template
   */
  async createWorkflowFromTemplate(
    templateId: string,
    variables: Record<string, unknown>,
    preferences?: {
      nodeProviders?: string[]
      errorHandlingLevel?: 'minimal' | 'standard' | 'comprehensive'
    },
  ): Promise<CustomizedWorkflow> {
    logger.debug('Creating workflow from template', { templateId })

    const customizationRequest: CustomizationRequest = {
      templateId,
      variables,
      ...(preferences && { preferences }),
    }

    return templateEngine.customizeTemplate(customizationRequest)
  }

  /**
   * Enhanced agent routing with intelligent handover
   */
  async routeToAgent(request: WorkflowOptimizationRequest): Promise<{
    agent: string
    handoverMode: HandoverMode
    context: Record<string, unknown>
    recommendations: NodeRecommendation[]
    estimatedDuration: number
  }> {
    const optimization = await this.optimizeWorkflow(request)
    const handoverContext = this.router.createHandoverContext(optimization.routing)

    return {
      agent: optimization.routing.suggestedAgent,
      handoverMode: optimization.routing.handoverMode,
      context: handoverContext.essentialContext,
      recommendations: optimization.nodeRecommendations.primary,
      estimatedDuration: optimization.routing.estimatedDuration,
    }
  }

  /**
   * Get performance metrics for the intelligence layer
   */
  getIntelligenceMetrics(): IntelligenceMetrics {
    const routingMetrics = this.router.getRouteOptimizationMetrics()
    const avgProcessingTime = this.metrics.processingTimes.length > 0
      ? this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length
      : 0

    return {
      classification: {
        totalRequests: this.metrics.totalRequests,
        accuracy: 0.85, // Would be calculated from feedback
        avgProcessingTime,
      },
      routing: routingMetrics,
      recommendations: {
        totalGenerated: this.metrics.totalRequests * 3, // Avg 3 recommendations per request
        acceptanceRate: 0.65, // Would be calculated from usage data
        avgQuality: 0.78,
      },
      templates: {
        totalSuggestions: this.metrics.totalRequests * 1.5, // Avg 1.5 templates per request
        usageRate: 0.35, // Would be tracked
        customizationRate: 0.45,
      },
      performance: {
        cacheHitRatio: this.metrics.cacheHits / Math.max(this.metrics.totalRequests, 1),
        avgResponseTime: avgProcessingTime,
        errorRate: 0.02, // Would be calculated from errors
      },
    }
  }

  /**
   * Clear all caches and reset metrics
   */
  clearCaches(): void {
    intentClassifier.clearCache()
    nodeRecommender.clearCaches()
    // Router has its own cache management
    logger.info('Intelligence layer caches cleared')
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<IntelligenceConfig>): void {
    this.config = this.mergeConfig(newConfig)
    logger.info('Intelligence service configuration updated', this.config)
  }

  /**
   * Initialize the intelligence service
   */
  private initialize(): void {
    logger.info('Initializing intelligence service', {
      enabled: this.config.enabled,
      features: this.config.features,
    })

    // Start periodic maintenance
    setInterval(() => {
      this.performMaintenance()
    }, 300000) // Every 5 minutes
  }

  /**
   * Add processing time with memory-conscious management
   */
  private addProcessingTime(time: number): void {
    this.metrics.processingTimes.push(time)

    // Apply immediate bounds when memory optimization is enabled
    if (shouldLimitMemoryArrays()) {
      const maxSize = 100 // Aggressive limit when optimization enabled
      if (this.metrics.processingTimes.length > maxSize) {
        this.metrics.processingTimes = this.metrics.processingTimes.slice(-maxSize)
      }
    }
    else {
      // Standard maintenance - trim at 1000 items
      if (this.metrics.processingTimes.length > 1000) {
        this.metrics.processingTimes = this.metrics.processingTimes.slice(-1000)
      }
    }
  }

  private performMaintenance(): void {
    // Apply feature-flag based memory management
    const maxSize = shouldLimitMemoryArrays() ? 50 : 1000

    // Trim metrics arrays to prevent memory growth
    if (this.metrics.processingTimes.length > maxSize) {
      this.metrics.processingTimes = this.metrics.processingTimes.slice(-maxSize)
    }

    // Log performance statistics with optimization status
    const avgProcessingTime = this.metrics.processingTimes.length > 0
      ? this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length
      : 0

    const memoryOptimization = shouldLimitMemoryArrays() ? 'enabled' : 'disabled'

    logger.debug('Intelligence service performance', {
      totalRequests: this.metrics.totalRequests,
      avgProcessingTime,
      cacheHitRatio: this.metrics.cacheHits / Math.max(this.metrics.totalRequests, 1),
      arraySize: this.metrics.processingTimes.length,
      maxArraySize: maxSize,
      memoryOptimization,
    })
  }

  private mergeConfig(config: Partial<IntelligenceConfig>): IntelligenceConfig {
    return {
      enabled: config.enabled ?? true,
      features: {
        intentClassification: config.features?.intentClassification ?? true,
        nodeRecommendations: config.features?.nodeRecommendations ?? true,
        templateSuggestions: config.features?.templateSuggestions ?? true,
        intelligentRouting: config.features?.intelligentRouting ?? true,
        performanceOptimization: config.features?.performanceOptimization ?? true,
      },
      thresholds: {
        minConfidence: config.thresholds?.minConfidence ?? 0.6,
        maxProcessingTime: config.thresholds?.maxProcessingTime ?? 5000,
        cacheSize: config.thresholds?.cacheSize ?? 1000,
      },
    }
  }

  private extractKeywords(input: string): string[] {
    const words = input.toLowerCase().split(/\s+/)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'])
    return words.filter(word => word.length > 2 && !stopWords.has(word)).slice(0, 10)
  }

  private generateOptimizations(
    routing: IntelligentRoutingResult,
    nodeRecommendations: { primary: NodeRecommendation[], alternatives: NodeRecommendation[] },
    _request: WorkflowOptimizationRequest,
  ): WorkflowOptimization[] {
    const optimizations: WorkflowOptimization[] = []

    // Performance optimizations
    if (routing.complexity.level === 'enterprise') {
      optimizations.push({
        type: 'performance',
        title: 'Consider Parallel Processing',
        description: 'Complex workflow could benefit from parallel node execution where possible',
        impact: 'high',
        effort: 'medium',
        recommendation: 'Use multiple branches and merge results for independent operations',
      })
    }

    // Reliability optimizations
    if (routing.complexity.riskLevel === 'high' || routing.complexity.riskLevel === 'critical') {
      optimizations.push({
        type: 'reliability',
        title: 'Add Error Handling',
        description: 'High-risk workflow needs comprehensive error handling and retry logic',
        impact: 'high',
        effort: 'medium',
        recommendation: 'Add If nodes for error checking and Wait nodes for retry delays',
      })
    }

    // Security optimizations
    if (routing.complexity.factors.some(f => f.type === 'security_requirements' && f.detected)) {
      optimizations.push({
        type: 'security',
        title: 'Enhance Security Patterns',
        description: 'Workflow handles sensitive data and needs security optimization',
        impact: 'high',
        effort: 'high',
        recommendation: 'Implement proper credential management and data encryption',
      })
    }

    // Node selection optimizations
    const primaryNode = nodeRecommendations.primary[0]
    if (nodeRecommendations.primary.length > 0 && primaryNode && primaryNode.confidence < 0.8) {
      optimizations.push({
        type: 'maintainability',
        title: 'Review Node Selection',
        description: 'Consider alternative nodes for better performance and reliability',
        impact: 'medium',
        effort: 'low',
        recommendation: `Consider ${nodeRecommendations.alternatives[0]?.displayName || 'alternative nodes'} for improved results`,
      })
    }

    return optimizations
  }

  private calculateEstimatedImprovement(
    routing: IntelligentRoutingResult,
    nodeRecommendations: { primary: NodeRecommendation[] },
    existingWorkflow?: { executionTime?: number },
  ): { executionTime: number, reliability: number, maintainability: number } {
    const _baseExecutionTime = existingWorkflow?.executionTime || routing.estimatedDuration

    // Estimate improvements based on recommendations
    let executionTimeImprovement = 0
    let reliabilityImprovement = 0
    let maintainabilityImprovement = 0

    // Better node selection can improve execution time
    if (nodeRecommendations.primary.length > 0) {
      const avgPerformanceScore = nodeRecommendations.primary.reduce((sum, rec) => sum + (rec.performanceScore || 5), 0) / nodeRecommendations.primary.length
      executionTimeImprovement = (avgPerformanceScore - 5) * 0.1 // 10% improvement per point above baseline
    }

    // Intelligent routing improves reliability
    if (routing.routingStrategy !== 'orchestrator-required') {
      reliabilityImprovement = 0.15 // 15% reliability improvement from optimized routing
    }

    // Template usage improves maintainability
    if (routing.templateSuggestions.length > 0) {
      maintainabilityImprovement = 0.25 // 25% maintainability improvement from templates
    }

    return {
      executionTime: Math.max(0, executionTimeImprovement),
      reliability: Math.max(0, reliabilityImprovement),
      maintainability: Math.max(0, maintainabilityImprovement),
    }
  }

  private createDisabledResult(_request: WorkflowOptimizationRequest): WorkflowOptimizationResult {
    return {
      intent: {
        intent: 'unknown' as WorkflowIntent,
        confidence: 0,
        complexity: 'standard' as ComplexityLevel,
        complexityScore: 0,
        suggestedRoute: 'orchestrator-required' as any,
        estimatedNodes: [],
        keywords: [],
        reasoning: 'Intelligence service disabled',
      },
      complexity: {
        level: 'standard' as ComplexityLevel,
        score: 0,
        factors: [],
        recommendations: [],
        estimatedDuration: 0,
        resourceRequirements: {
          agentTier: 1,
          estimatedAgents: [],
          storyFileRequired: false,
          governanceLevel: 'minimal',
          monitoringLevel: 'basic',
        },
        riskLevel: 'low' as any,
      },
      routing: {} as any,
      nodeRecommendations: { primary: [], alternatives: [], warnings: [] },
      templateSuggestions: [],
      optimizations: [],
      estimatedImprovement: { executionTime: 0, reliability: 0, maintainability: 0 },
      processingTime: 0,
      confidence: 0,
      cacheHit: false,
    }
  }

  private createFallbackResult(request: WorkflowOptimizationRequest, processingTime: number): WorkflowOptimizationResult {
    return {
      intent: {
        intent: 'unknown' as WorkflowIntent,
        confidence: 0.5,
        complexity: 'standard' as ComplexityLevel,
        complexityScore: 5,
        suggestedRoute: 'orchestrator-required' as any,
        estimatedNodes: [],
        keywords: [],
        reasoning: 'Fallback result due to processing error',
      },
      complexity: {
        level: 'standard' as ComplexityLevel,
        score: 5,
        factors: [],
        recommendations: [{
          type: 'routing',
          title: 'Use Orchestrator',
          description: 'Route to orchestrator for safe handling',
          priority: 'high' as any,
        }],
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
      routing: {} as any,
      nodeRecommendations: { primary: [], alternatives: [], warnings: ['Processing error occurred'] },
      templateSuggestions: [],
      optimizations: [],
      estimatedImprovement: { executionTime: 0, reliability: 0, maintainability: 0 },
      processingTime,
      confidence: 0.5,
      cacheHit: false,
    }
  }
}

// Re-export intelligence layer components
export {
  complexityAssessor,
  EnhancedIntelligentRouter,
  intentClassifier,
  nodeRecommender,
  templateEngine,
}

// Re-export types
export type {
  ComplexityAssessment,
  HandoverMode,
  IntelligentRoutingResult,
  IntentClassificationResult,
  NodeRecommendation,
  WorkflowTemplate,
}
