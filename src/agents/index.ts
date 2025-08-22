/**
 * Optimized Agent System for n8n MCP Modern
 * Implements the 7-agent hierarchy optimized for Claude Code development workflows
 *
 * TIER 1 - Master Orchestrator (1):
 *   - n8n-workflow-architect
 *
 * TIER 2 - Core Domain Specialists (5):
 *   - n8n-developer-specialist [NEW] - Code generation, templates, DevOps
 *   - n8n-integration-specialist - Authentication, APIs, connectivity
 *   - n8n-node-specialist [ENHANCED] - Nodes + AI/ML + community
 *   - n8n-javascript-specialist [NEW] - JavaScript validation, optimization, security
 *   - n8n-performance-specialist [NEW] - Monitoring, optimization, analytics
 *
 * TIER 3 - Support Specialist (1):
 *   - n8n-guidance-specialist [MERGED] - Documentation + support + admin
 */

import type { CommunicationManager, CommunicationMetrics } from './communication.js'
import { logger } from '../server/logger.js'

/**
 * Agent capability types - used in agent definitions
 */
export enum AgentCapability {
  WORKFLOW_DESIGN = 'workflow_design',

  CODE_GENERATION = 'code_generation',

  DEVELOPER_WORKFLOWS = 'developer_workflows',

  NODE_EXPERTISE = 'node_expertise',

  AUTHENTICATION = 'authentication',

  JAVASCRIPT_VALIDATION = 'javascript_validation',

  PERFORMANCE_OPTIMIZATION = 'performance_optimization',

  MONITORING_ANALYTICS = 'monitoring_analytics',

  DOCUMENTATION = 'documentation',

  RESEARCH = 'research',

  COMMUNITY = 'community',

  SYSTEM_ADMIN = 'system_admin',

  GUIDANCE_SUPPORT = 'guidance_support',
}

/**
 * Agent tier levels - used in agent hierarchy
 */
export enum AgentTier {
  MASTER = 1, // Master Orchestrator (1 agent)

  SPECIALIST = 2, // Core Domain Specialists (4 agents)

  SUPPORT = 3, // Support Specialist (1 agent)
}

/**
 * Escalation reasons - standardized reasons why agents escalate tasks
 */
export enum EscalationReason {
  COMPLEXITY_EXCEEDED = 'complexity_exceeded',
  CROSS_DOMAIN_DEPENDENCY = 'cross_domain_dependency',
  AUTHENTICATION_REQUIRED = 'authentication_required',
  PERFORMANCE_BOTTLENECK = 'performance_bottleneck',
  VALIDATION_REQUIRED = 'validation_required',
  STRATEGIC_PLANNING_NEEDED = 'strategic_planning_needed',
  SPECIALIST_KNOWLEDGE_REQUIRED = 'specialist_knowledge_required',
  ORCHESTRATION_REQUIRED = 'orchestration_required',
  SECURITY_CONCERN = 'security_concern',
  RESOURCE_LIMITATION = 'resource_limitation',
}

/**
 * Escalation urgency levels
 */
export enum EscalationUrgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Escalation request structure
 */
export interface EscalationRequest {
  originalToolName: string
  originalContext?: AgentContext
  reason: EscalationReason
  urgency?: EscalationUrgency
  sourceAgent: string
  targetAgent?: string
  message: string
  attemptedActions: string[]
  requiredCapabilities: AgentCapability[]
  additionalContext?: Record<string, unknown>
  timestamp?: number
}

/**
 * Escalation result structure
 */
export interface EscalationResult {
  success: boolean
  handledBy: string
  action: 'handled' | 'redirected' | 'escalated_further' | 'rejected'
  message: string
  newContext?: AgentContext
  recommendedAgent?: string
  followUpRequired?: boolean
  metadata?: Record<string, unknown>
  timestamp?: number
}

// Phase 2 MCP Orchestration Types
interface EscalationSession {
  id: string
  startTime: number
  escalations: EscalationRequest[]
  context: Record<string, unknown>
  activeCoordinations: number
  patterns: EscalationPattern[]
}

interface EscalationPattern {
  signature: string
  reason: EscalationReason
  urgency: EscalationUrgency
  frequency: number
  firstSeen: number
  lastSeen: number
}

interface CoordinationStrategy {
  type: string // 'exploratory' | 'pattern-based' | 'adaptive'
  priority: EscalationUrgency
  expectedAgents: string[]
  estimatedDuration: number
  parallelizable: boolean
}

interface CoordinationEvent {
  timestamp: number
  sessionId: string
  request: EscalationRequest
  strategy: CoordinationStrategy
  result: EscalationResult
  duration: number
}

interface CoordinationSample {
  agentType: string
  confidence: number
  recommendation: string
  context: Record<string, unknown>
  metadata: {
    generationTime: number
    requestComplexity: 'low' | 'medium' | 'high'
  }
}

interface SynthesizedResult {
  confidence: number
  message: string
  recommendedAgent: string
  context: Record<string, unknown>
}

interface CoordinationAnalytics {
  totalEscalations: number
  activeSessions: number
  patternCount: number
  averageCoordinationTime: number
  successRate: number
  mostCommonReasons: Array<{ reason: EscalationReason, count: number }>
  performanceMetrics: Record<string, { avg: number, min: number, max: number }>
}

interface EscalationStats {
  totalEscalations: number
  escalationsByReason: Record<EscalationReason, number>
  escalationsByAgent: Record<
    string,
    { sent: number, received: number, handled: number }
  >
  successRate: number
  coordinationAnalytics?: CoordinationAnalytics
}

/**
 * Agent context for routing decisions
 */
export interface AgentContext {
  complexity?: 'low' | 'medium' | 'high'
  requiresValidation?: boolean
  requiresAuthentication?: boolean
  connectivity?: boolean
  nodeExpertise?: boolean
  nodeConfiguration?: boolean
  quickHelp?: boolean
  documentation?: boolean
  setupGuide?: boolean
  troubleshooting?: boolean
  userManagement?: boolean
  systemAdmin?: boolean
  guidance?: boolean
  community?: boolean
  codeGeneration?: boolean
  developerWorkflow?: boolean
  template?: boolean
  performance?: boolean
  optimization?: boolean
  monitoring?: boolean
  analytics?: boolean
  requiresOrchestration?: boolean
  escalationHistory?: EscalationRequest[]
  originalAgent?: string
}

/**
 * Base agent interface
 */
export interface Agent {
  name: string
  tier: AgentTier
  capabilities: AgentCapability[]
  description: string
  canHandle: (_toolName: string, _context?: AgentContext) => boolean
  getPriority: (_toolName: string, _context?: AgentContext) => number

  // Escalation methods
  canEscalate?: (toolName: string, context?: AgentContext) => boolean
  shouldEscalate?: (
    toolName: string,
    context?: AgentContext,
    reason?: EscalationReason,
  ) => boolean
  escalateToCoordinator?: (request: EscalationRequest) => Promise<EscalationResult>
  escalateToSpecialist?: (request: EscalationRequest) => Promise<EscalationResult>
  handleEscalation?: (request: EscalationRequest) => Promise<EscalationResult>
}

/**
 * TIER 1 - Master Orchestrator
 */
export class WorkflowArchitect implements Agent {
  name = 'n8n-workflow-architect'
  tier = AgentTier.MASTER // Used in tier filtering
  capabilities = [
    AgentCapability.WORKFLOW_DESIGN, // Used in capability filtering
  ]

  description
    = 'Master orchestrator for complex, multi-step n8n automation projects. Strategic planning, workflow architecture, and multi-agent coordination.'

  canHandle(toolName: string, context?: AgentContext): boolean {
    // The architect can handle complex workflow operations
    const complexOperations = [
      'create_n8n_workflow',
      'get_workflow_stats',
      'execute_n8n_workflow',
    ]

    return (
      complexOperations.includes(toolName)
      || context?.complexity === 'high'
      || context?.requiresOrchestration === true
    )
  }

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.complexity === 'high')
      return 10
    if (this.canHandle(toolName, context))
      return 8
    return 5 // Default coordinator priority
  }

  // Escalation methods for Tier 1 (Master Orchestrator)
  canEscalate(toolName: string, context?: AgentContext): boolean {
    // Master orchestrator rarely escalates - only for resource limitations
    return (
      context?.complexity === 'high'
      && (toolName.includes('enterprise') || toolName.includes('cluster'))
    )
  }

  shouldEscalate(
    _toolName: string,
    _context?: AgentContext,
    reason?: EscalationReason,
  ): boolean {
    // Only escalate for critical resource or external system issues
    return (
      reason === EscalationReason.RESOURCE_LIMITATION
      || reason === EscalationReason.SECURITY_CONCERN
    )
  }

  async escalateToCoordinator(
    _request: EscalationRequest,
  ): Promise<EscalationResult> {
    // As the top tier, we don't escalate to coordinator - we ARE the coordinator
    logger.warn(
      `WorkflowArchitect received escalateToCoordinator request - no higher tier available`,
    )
    return {
      success: false,
      handledBy: this.name,
      action: 'rejected',
      message: 'No higher tier available for escalation',
    }
  }

  async escalateToSpecialist(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    // Architect can delegate to specialists
    logger.info(
      `WorkflowArchitect delegating to specialist: ${request.targetAgent ?? 'auto-select'}`,
    )

    // Logic to route to appropriate specialist based on required capabilities
    let targetAgent = request.targetAgent
    if (!targetAgent && request.requiredCapabilities.length > 0) {
      const capability = request.requiredCapabilities[0]
      switch (capability) {
        case AgentCapability.CODE_GENERATION:
        case AgentCapability.DEVELOPER_WORKFLOWS:
          targetAgent = 'n8n-developer-specialist'
          break
        case AgentCapability.AUTHENTICATION:
          targetAgent = 'n8n-integration-specialist'
          break
        case AgentCapability.NODE_EXPERTISE:
        case AgentCapability.COMMUNITY:
          targetAgent = 'n8n-node-specialist'
          break
        case AgentCapability.PERFORMANCE_OPTIMIZATION:
        case AgentCapability.MONITORING_ANALYTICS:
          targetAgent = 'n8n-performance-specialist'
          break
        default:
          targetAgent = 'n8n-guidance-specialist'
      }
    }

    return {
      success: true,
      handledBy: this.name,
      action: 'redirected',
      message: `Task delegated to ${targetAgent} by WorkflowArchitect`,
      ...(targetAgent && { recommendedAgent: targetAgent }),
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async handleEscalation(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `WorkflowArchitect handling escalation from ${request.sourceAgent}: ${request.reason}`,
    )

    // Architect evaluates escalations and makes strategic decisions
    switch (request.reason) {
      case EscalationReason.COMPLEXITY_EXCEEDED:
        // Take over complex orchestration
        return {
          success: true,
          handledBy: this.name,
          action: 'handled',
          message: 'Complex orchestration taken over by WorkflowArchitect',
          newContext: {
            ...request.originalContext,
            complexity: 'high',
            requiresOrchestration: true,
            originalAgent: request.sourceAgent,
          },
        }

      case EscalationReason.CROSS_DOMAIN_DEPENDENCY:
        // Coordinate multi-agent workflow
        return {
          success: true,
          handledBy: this.name,
          action: 'handled',
          message: 'Multi-agent coordination initiated by WorkflowArchitect',
          newContext: {
            ...request.originalContext,
            requiresOrchestration: true,
            originalAgent: request.sourceAgent,
          },
        }

      case EscalationReason.STRATEGIC_PLANNING_NEEDED:
        // Provide strategic oversight
        return {
          success: true,
          handledBy: this.name,
          action: 'handled',
          message: 'Strategic planning provided by WorkflowArchitect',
          newContext: {
            ...request.originalContext,
            complexity: 'high',
            originalAgent: request.sourceAgent,
          },
        }

      case EscalationReason.ORCHESTRATION_REQUIRED:
        // Direct orchestration
        return {
          success: true,
          handledBy: this.name,
          action: 'handled',
          message: 'Orchestration managed by WorkflowArchitect',
          newContext: {
            ...request.originalContext,
            requiresOrchestration: true,
            originalAgent: request.sourceAgent,
          },
        }

      default:
        // Delegate to appropriate specialist
        return this.escalateToSpecialist({
          ...request,
          sourceAgent: this.name,
          message: `Architect redirecting ${request.reason} to specialist`,
        })
    }
  }
}

/**
 * TIER 2 - Core Domain Specialists
 */
export class DeveloperSpecialist implements Agent {
  name = 'n8n-developer-specialist'
  tier = AgentTier.SPECIALIST // Used in tier filtering
  capabilities = [
    AgentCapability.CODE_GENERATION, // Used in capability filtering
    AgentCapability.DEVELOPER_WORKFLOWS, // Used in capability filtering
  ]

  description
    = 'Code generation, templates, and development workflow specialist. Transforms natural language into workflows, creates DevOps patterns, and provides infrastructure-as-code solutions.'

  canHandle(toolName: string, context?: AgentContext): boolean {
    const codeGenerationTools = [
      'generate_workflow_from_description',
      'create_api_integration_template',
      'build_data_processing_pipeline',
      'generate_notification_workflow',
      'create_webhook_handler',
      'export_workflow_as_template',
      'generate_docker_compose',
    ]

    return (
      codeGenerationTools.includes(toolName)
      || context?.codeGeneration === true
      || context?.developerWorkflow === true
      || context?.template === true
    )
  }

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.codeGeneration === true)
      return 9
    if (context?.developerWorkflow === true)
      return 9
    if (context?.template === true)
      return 8
    if (
      toolName.startsWith('generate_')
      || toolName.startsWith('create_')
      || toolName.startsWith('build_')
    ) {
      return 8
    }
    return 6
  }

  // Escalation methods for Developer Specialist
  canEscalate(toolName: string, context?: AgentContext): boolean {
    return (
      context?.complexity === 'high'
      || toolName.includes('enterprise')
      || toolName.includes('multi-tenant')
      || context?.requiresAuthentication === true
    )
  }

  shouldEscalate(
    _toolName: string,
    _context?: AgentContext,
    reason?: EscalationReason,
  ): boolean {
    return (
      reason === EscalationReason.COMPLEXITY_EXCEEDED
      || reason === EscalationReason.AUTHENTICATION_REQUIRED
      || reason === EscalationReason.ORCHESTRATION_REQUIRED
      || reason === EscalationReason.CROSS_DOMAIN_DEPENDENCY
    )
  }

  async escalateToCoordinator(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `DeveloperSpecialist escalating to WorkflowArchitect: ${request.reason}`,
    )

    return {
      success: true,
      handledBy: this.name,
      action: 'escalated_further',
      message: `Complex development task escalated to WorkflowArchitect`,
      recommendedAgent: 'n8n-workflow-architect',
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        complexity: 'high',
        requiresOrchestration: true,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async escalateToSpecialist(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `DeveloperSpecialist escalating to specialist: ${request.targetAgent}`,
    )

    // Determine target specialist based on required capabilities
    let targetAgent = request.targetAgent
    if (!targetAgent && request.requiredCapabilities.length > 0) {
      const capability = request.requiredCapabilities[0]
      switch (capability) {
        case AgentCapability.AUTHENTICATION:
          targetAgent = 'n8n-integration-specialist'
          break
        case AgentCapability.NODE_EXPERTISE:
          targetAgent = 'n8n-node-specialist'
          break
        case AgentCapability.PERFORMANCE_OPTIMIZATION:
          targetAgent = 'n8n-performance-specialist'
          break
        default:
          targetAgent = 'n8n-guidance-specialist'
      }
    }

    return {
      success: true,
      handledBy: this.name,
      action: 'redirected',
      message: `Development task redirected to ${targetAgent}`,
      ...(targetAgent && { recommendedAgent: targetAgent }),
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async handleEscalation(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `DeveloperSpecialist handling escalation from ${request.sourceAgent}: ${request.reason}`,
    )

    switch (request.reason) {
      case EscalationReason.SPECIALIST_KNOWLEDGE_REQUIRED:
        if (
          request.requiredCapabilities.includes(
            AgentCapability.CODE_GENERATION,
          )
          || request.requiredCapabilities.includes(
            AgentCapability.DEVELOPER_WORKFLOWS,
          )
        ) {
          return {
            success: true,
            handledBy: this.name,
            action: 'handled',
            message:
              'Code generation expertise provided by DeveloperSpecialist',
            newContext: {
              ...request.originalContext,
              codeGeneration: true,
              developerWorkflow: true,
              originalAgent: request.sourceAgent,
            },
          }
        }
        break

      case EscalationReason.CROSS_DOMAIN_DEPENDENCY:
        // Check if authentication is needed for development task
        if (
          request.originalToolName.includes('api')
          || request.originalToolName.includes('webhook')
        ) {
          return this.escalateToSpecialist({
            ...request,
            targetAgent: 'n8n-integration-specialist',
            requiredCapabilities: [AgentCapability.AUTHENTICATION],
            message: 'API/webhook development requires authentication setup',
          })
        }
        break
    }

    // If can't handle, escalate to coordinator
    return this.escalateToCoordinator({
      ...request,
      reason: EscalationReason.COMPLEXITY_EXCEEDED,
      message: 'DeveloperSpecialist cannot handle this escalation type',
    })
  }
}

export class IntegrationSpecialist implements Agent {
  name = 'n8n-integration-specialist'
  tier = AgentTier.SPECIALIST // Used in tier filtering
  capabilities = [AgentCapability.AUTHENTICATION] // Used in capability filtering
  description
    = 'Authentication, API connectivity, and platform integration expert. OAuth flows, credential management, webhook setup, and secure connectivity across 525+ platforms.'

  canHandle(toolName: string, context?: AgentContext): boolean {
    const integrationTools = [
      'get_n8n_workflows',
      'activate_n8n_workflow',
      'deactivate_n8n_workflow',
    ]

    return (
      integrationTools.includes(toolName)
      || context?.requiresAuthentication === true
      || context?.connectivity === true
    )
  }

  getPriority(_toolName: string, context?: AgentContext): number {
    if (context?.requiresAuthentication === true)
      return 9
    if (context?.connectivity === true)
      return 8
    return 7
  }

  // Escalation methods for Integration Specialist
  canEscalate(toolName: string, context?: AgentContext): boolean {
    return (
      context?.complexity === 'high'
      || toolName.includes('enterprise')
      || toolName.includes('saml')
      || context?.performance === true
    )
  }

  shouldEscalate(
    _toolName: string,
    _context?: AgentContext,
    reason?: EscalationReason,
  ): boolean {
    return (
      reason === EscalationReason.COMPLEXITY_EXCEEDED
      || reason === EscalationReason.SECURITY_CONCERN
      || reason === EscalationReason.PERFORMANCE_BOTTLENECK
      || reason === EscalationReason.ORCHESTRATION_REQUIRED
    )
  }

  async escalateToCoordinator(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `IntegrationSpecialist escalating to WorkflowArchitect: ${request.reason}`,
    )

    return {
      success: true,
      handledBy: this.name,
      action: 'escalated_further',
      message: `Complex integration task escalated to WorkflowArchitect`,
      recommendedAgent: 'n8n-workflow-architect',
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        complexity: 'high',
        requiresAuthentication: true,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async escalateToSpecialist(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `IntegrationSpecialist escalating to specialist: ${request.targetAgent}`,
    )

    // Determine target specialist based on required capabilities
    let targetAgent = request.targetAgent
    if (!targetAgent && request.requiredCapabilities.length > 0) {
      const capability = request.requiredCapabilities[0]
      switch (capability) {
        case AgentCapability.CODE_GENERATION:
          targetAgent = 'n8n-developer-specialist'
          break
        case AgentCapability.NODE_EXPERTISE:
          targetAgent = 'n8n-node-specialist'
          break
        case AgentCapability.PERFORMANCE_OPTIMIZATION:
          targetAgent = 'n8n-performance-specialist'
          break
        default:
          targetAgent = 'n8n-guidance-specialist'
      }
    }

    return {
      success: true,
      handledBy: this.name,
      action: 'redirected',
      message: `Integration task redirected to ${targetAgent}`,
      ...(targetAgent && { recommendedAgent: targetAgent }),
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        requiresAuthentication: true,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async handleEscalation(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `IntegrationSpecialist handling escalation from ${request.sourceAgent}: ${request.reason}`,
    )

    switch (request.reason) {
      case EscalationReason.AUTHENTICATION_REQUIRED:
        return {
          success: true,
          handledBy: this.name,
          action: 'handled',
          message: 'Authentication setup handled by IntegrationSpecialist',
          newContext: {
            ...request.originalContext,
            requiresAuthentication: true,
            connectivity: true,
            originalAgent: request.sourceAgent,
          },
        }

      case EscalationReason.SPECIALIST_KNOWLEDGE_REQUIRED:
        if (
          request.requiredCapabilities.includes(AgentCapability.AUTHENTICATION)
        ) {
          return {
            success: true,
            handledBy: this.name,
            action: 'handled',
            message:
              'Authentication expertise provided by IntegrationSpecialist',
            newContext: {
              ...request.originalContext,
              requiresAuthentication: true,
              connectivity: true,
              originalAgent: request.sourceAgent,
            },
          }
        }
        break

      case EscalationReason.SECURITY_CONCERN:
        return {
          success: true,
          handledBy: this.name,
          action: 'handled',
          message: 'Security review completed by IntegrationSpecialist',
          newContext: {
            ...request.originalContext,
            requiresAuthentication: true,
            originalAgent: request.sourceAgent,
          },
        }

      case EscalationReason.CROSS_DOMAIN_DEPENDENCY:
        // Check if performance monitoring is needed for authentication
        if (
          request.originalToolName.includes('oauth')
          || request.originalToolName.includes('token')
        ) {
          return this.escalateToSpecialist({
            ...request,
            targetAgent: 'n8n-performance-specialist',
            requiredCapabilities: [AgentCapability.MONITORING_ANALYTICS],
            message:
              'OAuth/token authentication requires performance monitoring',
          })
        }
        break
    }

    // If can't handle, escalate to coordinator
    return this.escalateToCoordinator({
      ...request,
      reason: EscalationReason.COMPLEXITY_EXCEEDED,
      message: 'IntegrationSpecialist cannot handle this escalation type',
    })
  }
}

export class NodeSpecialist implements Agent {
  name = 'n8n-node-specialist'
  tier = AgentTier.SPECIALIST // Used in tier filtering
  capabilities = [
    AgentCapability.NODE_EXPERTISE, // Used in capability filtering
    AgentCapability.COMMUNITY, // Used in capability filtering
  ]

  description
    = '525+ node database expert, AI/ML specialist, and community solutions expert. Node discovery, configuration, AI/ML workflows, community patterns, and emerging automation trends.'

  canHandle(toolName: string, context?: AgentContext): boolean {
    const nodeTools = ['search_n8n_nodes']

    return (
      nodeTools.includes(toolName)
      || context?.nodeExpertise === true
      || context?.nodeConfiguration === true
    )
  }

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.nodeExpertise === true)
      return 9
    if (context?.nodeConfiguration === true)
      return 8
    if (toolName === 'search_n8n_nodes')
      return 9
    return 6
  }

  // Escalation methods for Node Specialist
  canEscalate(toolName: string, context?: AgentContext): boolean {
    return (
      context?.complexity === 'high'
      || toolName.includes('custom')
      || toolName.includes('ai')
      || context?.codeGeneration === true
    )
  }

  shouldEscalate(
    _toolName: string,
    _context?: AgentContext,
    reason?: EscalationReason,
  ): boolean {
    return (
      reason === EscalationReason.COMPLEXITY_EXCEEDED
      || reason === EscalationReason.SPECIALIST_KNOWLEDGE_REQUIRED
      || reason === EscalationReason.ORCHESTRATION_REQUIRED
      || reason === EscalationReason.CROSS_DOMAIN_DEPENDENCY
    )
  }

  async escalateToCoordinator(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `NodeSpecialist escalating to WorkflowArchitect: ${request.reason}`,
    )

    return {
      success: true,
      handledBy: this.name,
      action: 'escalated_further',
      message: `Complex node configuration task escalated to WorkflowArchitect`,
      recommendedAgent: 'n8n-workflow-architect',
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        complexity: 'high',
        nodeExpertise: true,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async escalateToSpecialist(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `NodeSpecialist escalating to specialist: ${request.targetAgent}`,
    )

    // Determine target specialist based on required capabilities
    let targetAgent = request.targetAgent
    if (!targetAgent && request.requiredCapabilities.length > 0) {
      const capability = request.requiredCapabilities[0]
      switch (capability) {
        case AgentCapability.CODE_GENERATION:
          targetAgent = 'n8n-developer-specialist'
          break
        case AgentCapability.AUTHENTICATION:
          targetAgent = 'n8n-integration-specialist'
          break
        case AgentCapability.PERFORMANCE_OPTIMIZATION:
          targetAgent = 'n8n-performance-specialist'
          break
        default:
          targetAgent = 'n8n-guidance-specialist'
      }
    }

    return {
      success: true,
      handledBy: this.name,
      action: 'redirected',
      message: `Node configuration task redirected to ${targetAgent}`,
      ...(targetAgent && { recommendedAgent: targetAgent }),
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        nodeExpertise: true,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async handleEscalation(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `NodeSpecialist handling escalation from ${request.sourceAgent}: ${request.reason}`,
    )

    switch (request.reason) {
      case EscalationReason.SPECIALIST_KNOWLEDGE_REQUIRED:
        if (
          request.requiredCapabilities.includes(
            AgentCapability.NODE_EXPERTISE,
          )
          || request.requiredCapabilities.includes(AgentCapability.COMMUNITY)
        ) {
          return {
            success: true,
            handledBy: this.name,
            action: 'handled',
            message: 'Node expertise provided by NodeSpecialist',
            newContext: {
              ...request.originalContext,
              nodeExpertise: true,
              nodeConfiguration: true,
              community: true,
              originalAgent: request.sourceAgent,
            },
          }
        }
        break

      case EscalationReason.CROSS_DOMAIN_DEPENDENCY:
        // Check if custom node development is needed
        if (
          request.originalToolName.includes('custom')
          || request.originalToolName.includes('generate')
        ) {
          return this.escalateToSpecialist({
            ...request,
            targetAgent: 'n8n-developer-specialist',
            requiredCapabilities: [AgentCapability.CODE_GENERATION],
            message: 'Custom node development requires code generation',
          })
        }

        // Check if AI/ML node requires authentication
        if (
          request.originalToolName.includes('ai')
          || request.originalToolName.includes('openai')
        ) {
          return this.escalateToSpecialist({
            ...request,
            targetAgent: 'n8n-integration-specialist',
            requiredCapabilities: [AgentCapability.AUTHENTICATION],
            message: 'AI/ML nodes require API authentication setup',
          })
        }
        break

      case EscalationReason.PERFORMANCE_BOTTLENECK:
        // AI/ML workflows often have performance considerations
        return this.escalateToSpecialist({
          ...request,
          targetAgent: 'n8n-performance-specialist',
          requiredCapabilities: [AgentCapability.PERFORMANCE_OPTIMIZATION],
          message: 'Node performance optimization needed',
        })
    }

    // If can't handle, escalate to coordinator
    return this.escalateToCoordinator({
      ...request,
      reason: EscalationReason.COMPLEXITY_EXCEEDED,
      message: 'NodeSpecialist cannot handle this escalation type',
    })
  }
}

export class PerformanceSpecialist implements Agent {
  name = 'n8n-performance-specialist'
  tier = AgentTier.SPECIALIST // Used in tier filtering
  capabilities = [
    AgentCapability.PERFORMANCE_OPTIMIZATION, // Used in capability filtering
    AgentCapability.MONITORING_ANALYTICS, // Used in capability filtering
  ]

  description
    = 'Performance monitoring, optimization, and analytics expert. Real-time monitoring, bottleneck analysis, resource optimization, and predictive scaling recommendations.'

  canHandle(toolName: string, context?: AgentContext): boolean {
    const performanceTools = [
      'get_workflow_stats',
      'workflow_execution_analyzer',
      'performance_bottleneck_detector',
      'resource_usage_calculator',
      'optimization_recommender',
      'workflow_health_checker',
    ]

    return (
      performanceTools.includes(toolName)
      || context?.performance === true
      || context?.optimization === true
      || context?.monitoring === true
      || context?.analytics === true
    )
  }

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.performance === true)
      return 9
    if (context?.optimization === true)
      return 9
    if (context?.monitoring === true)
      return 8
    if (context?.analytics === true)
      return 8
    if (toolName.includes('performance') || toolName.includes('optimization'))
      return 8
    return 6
  }

  // Escalation methods for Performance Specialist
  canEscalate(toolName: string, context?: AgentContext): boolean {
    return (
      context?.complexity === 'high'
      || toolName.includes('enterprise')
      || toolName.includes('cluster')
      || context?.codeGeneration === true
    )
  }

  shouldEscalate(
    _toolName: string,
    _context?: AgentContext,
    reason?: EscalationReason,
  ): boolean {
    return (
      reason === EscalationReason.COMPLEXITY_EXCEEDED
      || reason === EscalationReason.RESOURCE_LIMITATION
      || reason === EscalationReason.ORCHESTRATION_REQUIRED
      || reason === EscalationReason.CROSS_DOMAIN_DEPENDENCY
    )
  }

  async escalateToCoordinator(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `PerformanceSpecialist escalating to WorkflowArchitect: ${request.reason}`,
    )

    return {
      success: true,
      handledBy: this.name,
      action: 'escalated_further',
      message: `Complex performance optimization task escalated to WorkflowArchitect`,
      recommendedAgent: 'n8n-workflow-architect',
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        complexity: 'high',
        performance: true,
        optimization: true,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async escalateToSpecialist(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `PerformanceSpecialist escalating to specialist: ${request.targetAgent}`,
    )

    // Determine target specialist based on required capabilities
    let targetAgent = request.targetAgent
    if (!targetAgent && request.requiredCapabilities.length > 0) {
      const capability = request.requiredCapabilities[0]
      switch (capability) {
        case AgentCapability.CODE_GENERATION:
          targetAgent = 'n8n-developer-specialist'
          break
        case AgentCapability.AUTHENTICATION:
          targetAgent = 'n8n-integration-specialist'
          break
        case AgentCapability.NODE_EXPERTISE:
          targetAgent = 'n8n-node-specialist'
          break
        default:
          targetAgent = 'n8n-guidance-specialist'
      }
    }

    return {
      success: true,
      handledBy: this.name,
      action: 'redirected',
      message: `Performance optimization task redirected to ${targetAgent}`,
      ...(targetAgent && { recommendedAgent: targetAgent }),
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        performance: true,
        optimization: true,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async handleEscalation(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `PerformanceSpecialist handling escalation from ${request.sourceAgent}: ${request.reason}`,
    )

    switch (request.reason) {
      case EscalationReason.PERFORMANCE_BOTTLENECK:
        return {
          success: true,
          handledBy: this.name,
          action: 'handled',
          message:
            'Performance bottleneck analysis handled by PerformanceSpecialist',
          newContext: {
            ...request.originalContext,
            performance: true,
            optimization: true,
            monitoring: true,
            originalAgent: request.sourceAgent,
          },
        }

      case EscalationReason.SPECIALIST_KNOWLEDGE_REQUIRED:
        if (
          request.requiredCapabilities.includes(
            AgentCapability.PERFORMANCE_OPTIMIZATION,
          )
          || request.requiredCapabilities.includes(
            AgentCapability.MONITORING_ANALYTICS,
          )
        ) {
          return {
            success: true,
            handledBy: this.name,
            action: 'handled',
            message: 'Performance expertise provided by PerformanceSpecialist',
            newContext: {
              ...request.originalContext,
              performance: true,
              optimization: true,
              monitoring: true,
              analytics: true,
              originalAgent: request.sourceAgent,
            },
          }
        }
        break

      case EscalationReason.RESOURCE_LIMITATION:
        return {
          success: true,
          handledBy: this.name,
          action: 'handled',
          message: 'Resource optimization handled by PerformanceSpecialist',
          newContext: {
            ...request.originalContext,
            performance: true,
            optimization: true,
            originalAgent: request.sourceAgent,
          },
        }

      case EscalationReason.CROSS_DOMAIN_DEPENDENCY:
        // Check if performance issues are caused by authentication overhead
        if (
          request.originalToolName.includes('oauth')
          || request.originalToolName.includes('auth')
        ) {
          return this.escalateToSpecialist({
            ...request,
            targetAgent: 'n8n-integration-specialist',
            requiredCapabilities: [AgentCapability.AUTHENTICATION],
            message: 'Authentication performance optimization needed',
          })
        }

        // Check if performance issues require code optimization
        if (
          request.originalToolName.includes('custom')
          || request.originalToolName.includes('generate')
        ) {
          return this.escalateToSpecialist({
            ...request,
            targetAgent: 'n8n-developer-specialist',
            requiredCapabilities: [AgentCapability.CODE_GENERATION],
            message: 'Code optimization needed for performance improvements',
          })
        }
        break
    }

    // If can't handle, escalate to coordinator
    return this.escalateToCoordinator({
      ...request,
      reason: EscalationReason.COMPLEXITY_EXCEEDED,
      message: 'PerformanceSpecialist cannot handle this escalation type',
    })
  }
}

export class JavaScriptSpecialist implements Agent {
  name = 'n8n-javascript-specialist'
  tier = AgentTier.SPECIALIST
  capabilities = [
    AgentCapability.JAVASCRIPT_VALIDATION,
    AgentCapability.CODE_GENERATION,
  ]

  description
    = 'JavaScript validation & optimization specialist for n8n workflows. Proactively monitors Code nodes, Function nodes, expressions, and custom JavaScript within n8n workflows for security, performance, and best practices.'

  canHandle(toolName: string, context?: AgentContext): boolean {
    const javascriptTools = [
      'validate_javascript',
      'optimize_code_node',
      'validate_expressions',
      'security_scan',
      'performance_profile',
    ]

    const javascriptKeywords = [
      'javascript',
      'js',
      'code node',
      'function node',
      'expression',
      'eval',
      'async',
      'await',
      'api call',
      'webhook',
      'custom node',
    ]

    // Handle JavaScript-specific tools
    if (javascriptTools.includes(toolName)) {
      return true
    }

    // Handle general tools with JavaScript context
    if (context) {
      // High priority for security and validation needs
      if (context.requiresValidation && toolName.includes('validate')) {
        return true
      }

      // Handle JavaScript-related queries
      if (
        javascriptKeywords.some(
          keyword =>
            toolName.toLowerCase().includes(keyword)
            || context.toString().toLowerCase().includes(keyword),
        )
      ) {
        return true
      }
    }

    return false
  }

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.requiresValidation === true)
      return 9
    if (toolName.includes('javascript') || toolName.includes('code'))
      return 8
    return 7
  }

  canEscalate(toolName: string, context?: AgentContext): boolean {
    return (
      context?.complexity === 'high'
      || toolName.includes('workflow')
      || context?.nodeExpertise === true
    )
  }

  shouldEscalate(
    _toolName: string,
    _context?: AgentContext,
    reason?: EscalationReason,
  ): boolean {
    return (
      reason === EscalationReason.COMPLEXITY_EXCEEDED
      || reason === EscalationReason.CROSS_DOMAIN_DEPENDENCY
      || reason === EscalationReason.ORCHESTRATION_REQUIRED
    )
  }

  async escalateToCoordinator(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    return {
      success: true,
      handledBy: this.name,
      action: 'escalated_further',
      message: `Escalating ${request.reason} to workflow architect for coordination`,
      recommendedAgent: 'n8n-workflow-architect',
      newContext: request.additionalContext as AgentContext,
    }
  }

  async handleTool(
    toolName: string,
    _args: Record<string, unknown>,
    _context?: AgentContext,
  ): Promise<unknown> {
    logger.info(`JavaScriptSpecialist handling: ${toolName}`)

    // For now, delegate to appropriate tools or provide guidance
    switch (toolName) {
      case 'validate_javascript':
        return {
          analysis: 'JavaScript validation analysis would be performed here',
          security: 'Security scan results',
          performance: 'Performance optimization suggestions',
          bestPractices: 'n8n-specific JavaScript recommendations',
        }

      default:
        return {
          specialist: 'n8n-javascript-specialist',
          guidance: `JavaScript validation and optimization guidance for ${toolName}`,
          recommendations: [
            'Use proper error handling in Code nodes',
            'Validate data access patterns',
            'Implement security best practices',
            'Optimize async operations for workflow performance',
          ],
        }
    }
  }

  async handleEscalation(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `JavaScriptSpecialist handling escalation from ${request.sourceAgent}: ${request.reason}`,
    )

    // Handle JavaScript-specific escalations
    if (request.reason === EscalationReason.SECURITY_CONCERN) {
      return {
        success: true,
        handledBy: this.name,
        action: 'handled',
        message: 'Performing comprehensive JavaScript security analysis',
        metadata: {
          recommendations: [
            'Scan for hardcoded secrets',
            'Validate input sanitization',
            'Check for injection vulnerabilities',
            'Review async/await patterns',
          ],
        },
      }
    }

    if (request.reason === EscalationReason.PERFORMANCE_BOTTLENECK) {
      return {
        success: true,
        handledBy: this.name,
        action: 'handled',
        message: 'Analyzing JavaScript performance in n8n context',
        metadata: {
          optimizations: [
            'Convert sync to async operations',
            'Implement proper error handling',
            'Optimize data transformation logic',
            'Add performance monitoring',
          ],
        },
      }
    }

    // If can't handle, escalate to coordinator
    return await this.escalateToCoordinator({
      ...request,
      reason: EscalationReason.SPECIALIST_KNOWLEDGE_REQUIRED,
      message: 'JavaScriptSpecialist cannot handle this escalation type',
    })
  }
}

/**
 * TIER 3 - Support Specialist
 */
export class GuidanceSpecialist implements Agent {
  name = 'n8n-guidance-specialist'
  tier = AgentTier.SUPPORT // Used in tier filtering
  capabilities = [
    AgentCapability.DOCUMENTATION, // Used in capability filtering
    AgentCapability.GUIDANCE_SUPPORT, // Used in capability filtering
    AgentCapability.SYSTEM_ADMIN, // Used in capability filtering
    AgentCapability.RESEARCH, // Used in capability filtering
  ]

  description
    = 'Documentation, troubleshooting, user management, and general support specialist. Setup guides, system administration, quick research, and comprehensive guidance.'

  canHandle(toolName: string, context?: AgentContext): boolean {
    const guidanceTools = [
      'get_tool_usage_stats',
      'get_n8n_workflow',
      'list_users',
      'get_user_info',
      'get_system_settings',
      'get_system_health',
      'create_workflow_documentation',
    ]

    return (
      guidanceTools.includes(toolName)
      || context?.documentation === true
      || context?.setupGuide === true
      || context?.troubleshooting === true
      || context?.userManagement === true
      || context?.systemAdmin === true
      || context?.guidance === true
    )
  }

  getPriority(_toolName: string, context?: AgentContext): number {
    if (context?.documentation === true)
      return 7
    if (context?.setupGuide === true)
      return 7
    if (context?.userManagement === true)
      return 7
    if (context?.systemAdmin === true)
      return 6
    if (context?.guidance === true)
      return 6
    return 4 // General support priority
  }

  // Escalation methods for Guidance Specialist (Tier 3)
  canEscalate(toolName: string, context?: AgentContext): boolean {
    // Support specialist frequently escalates domain-specific tasks
    return (
      context?.codeGeneration === true
      || context?.requiresAuthentication === true
      || context?.nodeExpertise === true
      || context?.performance === true
      || context?.complexity !== 'low'
      || toolName.includes('create_')
      || toolName.includes('generate_')
      || toolName.includes('build_')
    )
  }

  shouldEscalate(
    _toolName: string,
    _context?: AgentContext,
    reason?: EscalationReason,
  ): boolean {
    // Support specialist escalates most specialist knowledge requests
    return (
      reason === EscalationReason.SPECIALIST_KNOWLEDGE_REQUIRED
      || reason === EscalationReason.COMPLEXITY_EXCEEDED
      || reason === EscalationReason.AUTHENTICATION_REQUIRED
      || reason === EscalationReason.PERFORMANCE_BOTTLENECK
      || reason === EscalationReason.CROSS_DOMAIN_DEPENDENCY
      || reason === EscalationReason.ORCHESTRATION_REQUIRED
    )
  }

  async escalateToCoordinator(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `GuidanceSpecialist escalating to WorkflowArchitect: ${request.reason}`,
    )

    return {
      success: true,
      handledBy: this.name,
      action: 'escalated_further',
      message: `Complex support request escalated to WorkflowArchitect`,
      recommendedAgent: 'n8n-workflow-architect',
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        complexity: 'high',
        requiresOrchestration: true,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async escalateToSpecialist(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `GuidanceSpecialist escalating to specialist: ${request.targetAgent ?? 'auto-select'}`,
    )

    // Determine target specialist based on required capabilities
    let targetAgent = request.targetAgent
    if (!targetAgent && request.requiredCapabilities.length > 0) {
      const capability = request.requiredCapabilities[0]
      switch (capability) {
        case AgentCapability.CODE_GENERATION:
        case AgentCapability.DEVELOPER_WORKFLOWS:
          targetAgent = 'n8n-developer-specialist'
          break
        case AgentCapability.AUTHENTICATION:
          targetAgent = 'n8n-integration-specialist'
          break
        case AgentCapability.NODE_EXPERTISE:
        case AgentCapability.COMMUNITY:
          targetAgent = 'n8n-node-specialist'
          break
        case AgentCapability.PERFORMANCE_OPTIMIZATION:
        case AgentCapability.MONITORING_ANALYTICS:
          targetAgent = 'n8n-performance-specialist'
          break
        default:
          // If no specific capability, check tool name patterns
          if (
            request.originalToolName.includes('generate')
            || request.originalToolName.includes('create')
          ) {
            targetAgent = 'n8n-developer-specialist'
          }
          else if (
            request.originalToolName.includes('auth')
            || request.originalToolName.includes('oauth')
          ) {
            targetAgent = 'n8n-integration-specialist'
          }
          else if (
            request.originalToolName.includes('node')
            || request.originalToolName.includes('search')
          ) {
            targetAgent = 'n8n-node-specialist'
          }
          else if (
            request.originalToolName.includes('performance')
            || request.originalToolName.includes('stats')
          ) {
            targetAgent = 'n8n-performance-specialist'
          }
          else {
            targetAgent = 'n8n-workflow-architect' // Default to coordinator
          }
      }
    }

    return {
      success: true,
      handledBy: this.name,
      action: 'redirected',
      message: `Support request redirected to ${targetAgent}`,
      ...(targetAgent && { recommendedAgent: targetAgent }),
      followUpRequired: true,
      newContext: {
        ...request.originalContext,
        originalAgent: this.name,
        escalationHistory: [
          ...(request.originalContext?.escalationHistory ?? []),
          request,
        ],
      },
    }
  }

  async handleEscalation(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    logger.info(
      `GuidanceSpecialist handling escalation from ${request.sourceAgent}: ${request.reason}`,
    )

    // Support specialist only handles documentation, troubleshooting, and basic guidance
    switch (request.reason) {
      case EscalationReason.SPECIALIST_KNOWLEDGE_REQUIRED:
        if (
          request.requiredCapabilities.includes(
            AgentCapability.DOCUMENTATION,
          )
          || request.requiredCapabilities.includes(
            AgentCapability.GUIDANCE_SUPPORT,
          )
          || request.requiredCapabilities.includes(AgentCapability.RESEARCH)
        ) {
          return {
            success: true,
            handledBy: this.name,
            action: 'handled',
            message:
              'Documentation and guidance provided by GuidanceSpecialist',
            newContext: {
              ...request.originalContext,
              documentation: true,
              guidance: true,
              originalAgent: request.sourceAgent,
            },
          }
        }
        break

      // For most other escalation types, GuidanceSpecialist should escalate further
      case EscalationReason.COMPLEXITY_EXCEEDED:
      case EscalationReason.ORCHESTRATION_REQUIRED:
        return this.escalateToCoordinator({
          ...request,
          message: 'Complex task requires coordinator oversight',
        })

      case EscalationReason.AUTHENTICATION_REQUIRED:
        return this.escalateToSpecialist({
          ...request,
          targetAgent: 'n8n-integration-specialist',
          requiredCapabilities: [AgentCapability.AUTHENTICATION],
          message: 'Authentication expertise required',
        })

      case EscalationReason.PERFORMANCE_BOTTLENECK:
        return this.escalateToSpecialist({
          ...request,
          targetAgent: 'n8n-performance-specialist',
          requiredCapabilities: [AgentCapability.PERFORMANCE_OPTIMIZATION],
          message: 'Performance optimization required',
        })

      case EscalationReason.CROSS_DOMAIN_DEPENDENCY:
        // Try to route to most appropriate specialist
        return this.escalateToSpecialist({
          ...request,
          message: 'Cross-domain expertise required',
        })

      default:
        // For unknown escalation types, try to provide basic guidance or escalate
        return {
          success: true,
          handledBy: this.name,
          action: 'handled',
          message: 'General guidance provided by GuidanceSpecialist',
          newContext: {
            ...request.originalContext,
            guidance: true,
            originalAgent: request.sourceAgent,
          },
        }
    }

    // Default fallback return
    return {
      success: false,
      handledBy: this.name,
      action: 'rejected',
      message: 'Unable to handle this escalation type',
    }
  }
}

/**
 * Enhanced MCP Orchestrator for Phase 2 capabilities
 * Manages intelligent multi-server coordination and session-based escalation
 */
export class MCPOrchestrator {
  private sessionState: Map<string, EscalationSession> = new Map()
  private escalationPatterns: Map<string, EscalationPattern> = new Map()
  private coordinationHistory: CoordinationEvent[] = []
  private performanceMetrics: Map<string, number[]> = new Map()

  /**
   * Handle escalation with intelligent coordination
   */
  async handleEscalation(
    request: EscalationRequest,
    sessionId?: string,
  ): Promise<EscalationResult> {
    const session = this.getOrCreateSession(
      sessionId ?? this.generateSessionId(),
    )

    // Record escalation pattern
    this.recordEscalationPattern(request)

    // Analyze context and determine best coordination approach
    const coordinationStrategy = this.analyzeCoordinationStrategy(
      request,
      session,
    )

    // Execute coordination based on strategy
    return await this.executeCoordination(
      request,
      coordinationStrategy,
      session,
    )
  }

  /**
   * Intelligent multi-agent sampling and coordination
   */
  async coordinateMultiAgent(
    requests: EscalationRequest[],
  ): Promise<EscalationResult[]> {
    const startTime = Date.now()

    // Group related requests
    const groups = this.groupRelatedRequests(requests)

    // Execute coordination for each group
    const results: EscalationResult[] = []
    for (const group of groups) {
      // Sequential processing required for group coordination dependencies
      // eslint-disable-next-line no-await-in-loop
      const groupResult = await this.coordinateGroup(group)
      results.push(...groupResult)
    }

    // Record performance metrics
    this.recordPerformanceMetrics(
      'multi_agent_coordination',
      Date.now() - startTime,
    )

    return results
  }

  private getOrCreateSession(sessionId: string): EscalationSession {
    if (!this.sessionState.has(sessionId)) {
      this.sessionState.set(sessionId, {
        id: sessionId,
        startTime: Date.now(),
        escalations: [],
        context: {},
        activeCoordinations: 0,
        patterns: [],
      })
    }
    const session = this.sessionState.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    return session
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private recordEscalationPattern(request: EscalationRequest): void {
    const pattern = this.extractPattern(request)
    const existing = this.escalationPatterns.get(pattern.signature)

    if (existing) {
      existing.frequency++
      existing.lastSeen = Date.now()
    }
    else {
      this.escalationPatterns.set(pattern.signature, pattern)
    }
  }

  private analyzeCoordinationStrategy(
    request: EscalationRequest,
    session: EscalationSession,
  ): CoordinationStrategy {
    const patterns = Array.from(this.escalationPatterns.values())
    const relatedPatterns = patterns.filter(p =>
      this.isPatternRelated(p, request),
    )

    return {
      type: this.determineCoordinationType(request, relatedPatterns),
      priority: request.urgency ?? EscalationUrgency.MEDIUM,
      expectedAgents: this.predictRequiredAgents(request, relatedPatterns),
      estimatedDuration: this.estimateCoordinationDuration(
        request,
        relatedPatterns,
      ),
      parallelizable: this.canParallelize(request, session),
    }
  }

  private async executeCoordination(
    request: EscalationRequest,
    strategy: CoordinationStrategy,
    session: EscalationSession,
  ): Promise<EscalationResult> {
    session.activeCoordinations++

    try {
      // Simulate intelligent coordination with sampling-based approach
      const coordinationResult = await this.performSampledCoordination(
        request,
        strategy,
      )

      // Update session state
      session.escalations.push(request)
      session.patterns.push(this.extractPattern(request))

      // Record coordination event
      this.coordinationHistory.push({
        timestamp: Date.now(),
        sessionId: session.id,
        request,
        strategy,
        result: coordinationResult,
        duration: Date.now() - (request.timestamp ?? Date.now()),
      })

      return coordinationResult
    }
    finally {
      session.activeCoordinations--
    }
  }

  private async performSampledCoordination(
    request: EscalationRequest,
    strategy: CoordinationStrategy,
  ): Promise<EscalationResult> {
    // Phase 2 implementation: Sampling-based coordination
    // This simulates intelligent multi-agent coordination within current MCP constraints

    const samples: CoordinationSample[] = []

    // Generate coordination samples based on strategy
    for (let i = 0; i < strategy.expectedAgents.length; i++) {
      const agentType = strategy.expectedAgents[i]
      if (!agentType)
        continue
      // Sequential sampling required for coordination dependencies
      // eslint-disable-next-line no-await-in-loop
      const sample = await this.generateCoordinationSample(request, agentType)
      samples.push(sample)
    }

    // Analyze samples and synthesize optimal result
    const synthesizedResult = this.synthesizeCoordinationResult(
      samples,
      request,
    )

    return {
      success: synthesizedResult.confidence > 0.7,
      handledBy: 'mcp-orchestrator',
      action: synthesizedResult.confidence > 0.8 ? 'handled' : 'redirected',
      message: synthesizedResult.message,
      ...(synthesizedResult.recommendedAgent && {
        recommendedAgent: synthesizedResult.recommendedAgent,
      }),
      ...(synthesizedResult.context && {
        newContext: synthesizedResult.context,
      }),
      metadata: {
        coordinationType: strategy.type,
        samplesUsed: samples.length,
        confidence: synthesizedResult.confidence,
        estimatedAccuracy: this.calculateAccuracy(samples),
      },
    }
  }

  private async generateCoordinationSample(
    request: EscalationRequest,
    agentType: string,
  ): Promise<CoordinationSample> {
    // Simulate agent-specific coordination sample
    return {
      agentType,
      confidence: 0.7 + Math.random() * 0.3, // Simulated confidence
      recommendation: `${agentType} suggests handling ${request.reason}`,
      context: {
        agentSpecificity: agentType,
        reasoningDepth:
          request.urgency === EscalationUrgency.HIGH ? 'deep' : 'standard',
      },
      metadata: {
        generationTime: Date.now(),
        requestComplexity: this.assessComplexity(request),
      },
    }
  }

  private synthesizeCoordinationResult(
    samples: CoordinationSample[],
    _request: EscalationRequest,
  ): SynthesizedResult {
    const highConfidenceSamples = samples.filter(s => s.confidence > 0.8)
    const primarySample
      = highConfidenceSamples.length > 0 ? highConfidenceSamples[0] : samples[0]

    if (!primarySample) {
      throw new Error('No samples available for coordination')
    }

    return {
      confidence: this.calculateOverallConfidence(samples),
      message: `Coordinated response from ${samples.length} agents: ${primarySample.recommendation}`,
      recommendedAgent: primarySample.agentType,
      context: this.mergeContexts(samples.map(s => s.context)),
    }
  }

  private groupRelatedRequests(
    requests: EscalationRequest[],
  ): EscalationRequest[][] {
    const groups: EscalationRequest[][] = []
    const processed = new Set<EscalationRequest>()

    for (const request of requests) {
      if (processed.has(request))
        continue

      const group = [request]
      processed.add(request)

      // Find related requests
      for (const other of requests) {
        if (!processed.has(other) && this.areRequestsRelated(request, other)) {
          group.push(other)
          processed.add(other)
        }
      }

      groups.push(group)
    }

    return groups
  }

  private async coordinateGroup(
    group: EscalationRequest[],
  ): Promise<EscalationResult[]> {
    // Coordinate related requests as a group
    const results: EscalationResult[] = []
    const groupSession = this.getOrCreateSession(`group_${Date.now()}`)

    for (const request of group) {
      const strategy = this.analyzeCoordinationStrategy(request, groupSession)
      // Sequential execution required for group coordination order
      // eslint-disable-next-line no-await-in-loop
      const result = await this.executeCoordination(
        request,
        strategy,
        groupSession,
      )
      results.push(result)
    }

    return results
  }

  // Helper methods for pattern analysis and coordination
  private extractPattern(request: EscalationRequest): EscalationPattern {
    return {
      signature: `${request.reason}_${request.urgency}`,
      reason: request.reason,
      urgency: request.urgency ?? EscalationUrgency.MEDIUM,
      frequency: 1,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    }
  }

  private isPatternRelated(
    pattern: EscalationPattern,
    request: EscalationRequest,
  ): boolean {
    return (
      pattern.reason === request.reason
      || (pattern.urgency === request.urgency
        && pattern.reason !== EscalationReason.VALIDATION_REQUIRED)
    )
  }

  private determineCoordinationType(
    _request: EscalationRequest,
    patterns: EscalationPattern[],
  ): string {
    if (patterns.length === 0)
      return 'exploratory'
    if (patterns.some(p => p.frequency > 5))
      return 'pattern-based'
    return 'adaptive'
  }

  private predictRequiredAgents(
    request: EscalationRequest,
    _patterns: EscalationPattern[],
  ): string[] {
    const baseAgents = ['workflow-architect']

    switch (request.reason) {
      case EscalationReason.COMPLEXITY_EXCEEDED:
        return [
          ...baseAgents,
          'developer-specialist',
          'integration-specialist',
        ]
      case EscalationReason.SPECIALIST_KNOWLEDGE_REQUIRED:
        return [...baseAgents, 'node-specialist']
      case EscalationReason.PERFORMANCE_BOTTLENECK:
        return [...baseAgents, 'performance-specialist']
      default:
        return baseAgents
    }
  }

  private estimateCoordinationDuration(
    request: EscalationRequest,
    patterns: EscalationPattern[],
  ): number {
    const baseTime = 1000 // 1 second
    const complexityMultiplier
      = request.urgency === EscalationUrgency.HIGH ? 1.5 : 1.0
    const patternMultiplier = patterns.length > 0 ? 0.8 : 1.2 // Faster with patterns

    return baseTime * complexityMultiplier * patternMultiplier
  }

  private canParallelize(
    request: EscalationRequest,
    session: EscalationSession,
  ): boolean {
    return (
      session.activeCoordinations < 3
      && request.urgency !== EscalationUrgency.CRITICAL
    )
  }

  private assessComplexity(
    request: EscalationRequest,
  ): 'low' | 'medium' | 'high' {
    if (request.urgency === EscalationUrgency.CRITICAL)
      return 'high'
    if (request.reason === EscalationReason.COMPLEXITY_EXCEEDED)
      return 'high'
    if (request.reason === EscalationReason.CROSS_DOMAIN_DEPENDENCY)
      return 'medium'
    return 'low'
  }

  private calculateOverallConfidence(samples: CoordinationSample[]): number {
    if (samples.length === 0)
      return 0
    const sum = samples.reduce((acc, sample) => acc + sample.confidence, 0)
    return sum / samples.length
  }

  private calculateAccuracy(samples: CoordinationSample[]): number {
    const avgConfidence = this.calculateOverallConfidence(samples)
    const consistencyScore = this.calculateConsistency(samples)
    return (avgConfidence + consistencyScore) / 2
  }

  private calculateConsistency(samples: CoordinationSample[]): number {
    if (samples.length < 2)
      return 1.0

    const recommendations = samples.map(s => s.recommendation)
    const unique = new Set(recommendations).size
    return 1 - (unique - 1) / (recommendations.length - 1)
  }

  private mergeContexts(
    contexts: Record<string, unknown>[],
  ): Record<string, unknown> {
    return contexts.reduce(
      (merged, context) => ({ ...merged, ...context }),
      {},
    )
  }

  private areRequestsRelated(
    req1: EscalationRequest,
    req2: EscalationRequest,
  ): boolean {
    return (
      req1.reason === req2.reason
      || (req1.targetAgent === req2.targetAgent && req1.urgency === req2.urgency)
    )
  }

  private recordPerformanceMetrics(operation: string, duration: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, [])
    }

    const metrics = this.performanceMetrics.get(operation)
    if (!metrics) {
      throw new Error(`No metrics found for operation: ${operation}`)
    }
    metrics.push(duration)

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift()
    }
  }

  /**
   * Get coordination analytics
   */
  getCoordinationAnalytics(): CoordinationAnalytics {
    return {
      totalEscalations: this.coordinationHistory.length,
      activeSessions: this.sessionState.size,
      patternCount: this.escalationPatterns.size,
      averageCoordinationTime: this.calculateAverageCoordinationTime(),
      successRate: this.calculateSuccessRate(),
      mostCommonReasons: this.getMostCommonReasons(),
      performanceMetrics: this.getPerformanceMetrics(),
    }
  }

  private calculateAverageCoordinationTime(): number {
    if (this.coordinationHistory.length === 0)
      return 0
    const totalTime = this.coordinationHistory.reduce(
      (sum, event) => sum + event.duration,
      0,
    )
    return totalTime / this.coordinationHistory.length
  }

  private calculateSuccessRate(): number {
    if (this.coordinationHistory.length === 0)
      return 0
    const successful = this.coordinationHistory.filter(
      event => event.result.success,
    ).length
    return successful / this.coordinationHistory.length
  }

  private getMostCommonReasons(): Array<{
    reason: EscalationReason
    count: number
  }> {
    const reasonCounts = new Map<EscalationReason, number>()

    for (const event of this.coordinationHistory) {
      const reason = event.request.reason
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
    }

    return Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  private getPerformanceMetrics(): Record<
    string,
    { avg: number, min: number, max: number }
  > {
    const result: Record<string, { avg: number, min: number, max: number }>
      = {}

    for (const [operation, measurements] of this.performanceMetrics) {
      if (measurements.length > 0) {
        result[operation] = {
          avg:
            measurements.reduce((sum, val) => sum + val, 0)
            / measurements.length,
          min: Math.min(...measurements),
          max: Math.max(...measurements),
        }
      }
    }

    return result
  }
}

/**
 * Agent Router - Routes tools to appropriate agents with Phase 2 orchestration
 */
export class AgentRouter {
  private agents: Agent[]
  private mcpOrchestrator: MCPOrchestrator = new MCPOrchestrator()
  private communicationManager?: CommunicationManager

  constructor() {
    this.agents = [
      new WorkflowArchitect(),
      new DeveloperSpecialist(),
      new IntegrationSpecialist(),
      new NodeSpecialist(),
      new JavaScriptSpecialist(),
      new PerformanceSpecialist(),
      new GuidanceSpecialist(),
    ]

    // Initialize advanced communication system (lazy loading to avoid circular deps)
    this.initializeCommunication()
  }

  private async initializeCommunication(): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { CommunicationManager } = await import('./communication.js')
      this.communicationManager = new CommunicationManager(this.agents)
      logger.info('Advanced communication system initialized')
    }
    catch (error) {
      logger.warn('Failed to initialize advanced communication system:', error)
      // Continue without advanced features
    }
  }

  /**
   * Route a tool call to the most appropriate agent
   */
  routeTool(toolName: string, context?: AgentContext): Agent {
    // Use optimized routing if communication manager is available
    if (this.communicationManager) {
      try {
        // Return the promise but cast to Agent for synchronous compatibility
        this.communicationManager.routeWithOptimization(toolName, context)
        // For now, fall through to synchronous routing, but log that async is preferred
        logger.debug(`Advanced routing available for ${toolName}, consider using routeToolAsync`)
      }
      catch (error) {
        logger.warn('Advanced routing failed, falling back to standard routing:', error)
      }
    }

    // Standard routing logic (maintained for backward compatibility)
    const candidates = this.agents
      .filter(agent => agent.canHandle(toolName, context))
      .map(agent => ({
        agent,
        priority: agent.getPriority(toolName, context),
      }))
      .sort((a, b) => b.priority - a.priority)

    if (candidates.length === 0) {
      // Default to guidance specialist for unhandled tools
      logger.warn(
        `No specific agent for tool ${toolName}, using guidance specialist`,
      )
      const guidance = this.agents.find(
        a => a.name === 'n8n-guidance-specialist',
      )
      if (!guidance) {
        throw new Error('Guidance specialist agent not found')
      }
      return guidance
    }

    const selectedCandidate = candidates[0]
    if (!selectedCandidate) {
      throw new Error('No candidate found')
    }

    const selectedAgent = selectedCandidate.agent

    logger.debug(
      `Routed tool ${toolName} to agent ${selectedAgent.name} (priority: ${selectedCandidate.priority})`,
    )

    // Store routing decision in database
    this.storeRoutingDecision(
      toolName,
      selectedAgent,
      selectedCandidate.priority,
    )

    return selectedAgent
  }

  /**
   * Advanced asynchronous routing with optimization features
   */
  async routeToolAsync(toolName: string, context?: AgentContext): Promise<Agent> {
    if (this.communicationManager) {
      try {
        return await this.communicationManager.routeWithOptimization(toolName, context)
      }
      catch (error) {
        logger.warn('Advanced async routing failed, falling back to standard routing:', error)
      }
    }

    // Fallback to synchronous routing
    return this.routeTool(toolName, context)
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): Agent | null {
    return this.agents.find(agent => agent.name === name) ?? null
  }

  /**
   * Get agent by ID (alias for getAgent for backward compatibility)
   */
  getAgentById(id: string): Agent | undefined {
    return this.getAgent(id) ?? undefined
  }

  /**
   * Route to agent based on text query (intelligent routing)
   */
  async routeToAgent(query: string): Promise<Agent | undefined> {
    if (!query || typeof query !== 'string') {
      return this.getAgent('n8n-guidance-specialist') ?? undefined
    }

    const lowerQuery = query.toLowerCase()

    // Authentication/integration queries (PRIMARY focus on auth, not workflow creation with auth)
    if (
      ((lowerQuery.includes('oauth')
        || lowerQuery.includes('auth')
        || lowerQuery.includes('credential'))
      && (lowerQuery.includes('setup')
        || lowerQuery.includes('configure')
        || lowerQuery.includes('connect')))
      || lowerQuery.includes('webhook')
      || (lowerQuery.includes('api')
        && (lowerQuery.includes('setup')
          || lowerQuery.includes('authentication')))
        || (lowerQuery.includes('integration')
          && !lowerQuery.includes('create')
          && !lowerQuery.includes('workflow'))
    ) {
      return this.getAgent('n8n-integration-specialist') ?? undefined
    }

    // Documentation and setup queries (but not auth setup)
    if (
      ((lowerQuery.includes('how to')
        || lowerQuery.includes('setup')
        || lowerQuery.includes('guide'))
      && !lowerQuery.includes('oauth')
      && !lowerQuery.includes('auth')
      && !lowerQuery.includes('credential'))
    || (lowerQuery.includes('docker')
      && (lowerQuery.includes('set up') || lowerQuery.includes('install')))
    ) {
      return this.getAgent('n8n-guidance-specialist') ?? undefined
    }

    // Code generation and development queries (HIGHEST PRIORITY for Claude Code users)
    // BUT NOT for "complex" queries which should go to architect
    if (
      (lowerQuery.includes('generate')
        || lowerQuery.includes('create')
        || lowerQuery.includes('build')
        || lowerQuery.includes('template')
        || lowerQuery.includes('ci/cd')
        || lowerQuery.includes('deploy')
        || lowerQuery.includes('pipeline')
        || lowerQuery.includes('infrastructure'))
      && !lowerQuery.includes('complex')
      && !lowerQuery.includes('enterprise')
      && !lowerQuery.includes('design')
    ) {
      return this.getAgent('n8n-developer-specialist') ?? undefined
    }

    // Performance and optimization queries
    if (
      lowerQuery.includes('optimize')
      || lowerQuery.includes('performance')
      || lowerQuery.includes('slow')
      || lowerQuery.includes('monitor')
      || lowerQuery.includes('analytics')
      || lowerQuery.includes('metrics')
      || lowerQuery.includes('bottleneck')
      || lowerQuery.includes('resource')
    ) {
      return this.getAgent('n8n-performance-specialist') ?? undefined
    }

    // Complex/strategic queries go to architect (TIER 1)
    if (
      lowerQuery.includes('complex')
      || lowerQuery.includes('enterprise')
      || lowerQuery.includes('design')
      || lowerQuery.includes('orchestrat')
      || lowerQuery.includes('strategic')
      || lowerQuery.includes('architecture')
    ) {
      const architect = this.getAgent('n8n-workflow-architect')
      if (architect)
        return architect
      // Fallback to guidance if architect unavailable
      return this.getAgent('n8n-guidance-specialist') ?? undefined
    }

    // Node discovery and AI/ML queries (includes community patterns)
    if (
      lowerQuery.includes('nodes')
      || lowerQuery.includes('available')
      || lowerQuery.includes('ai')
      || lowerQuery.includes('openai')
      || lowerQuery.includes('gpt')
      || lowerQuery.includes('ml')
      || lowerQuery.includes('community')
      || lowerQuery.includes('find')
      || lowerQuery.includes('discover')
    ) {
      return this.getAgent('n8n-node-specialist') ?? undefined
    }

    // Documentation, setup, and admin queries
    if (
      lowerQuery.includes('documentation')
      || lowerQuery.includes('setup')
      || lowerQuery.includes('how to')
      || lowerQuery.includes('user')
      || lowerQuery.includes('system')
      || lowerQuery.includes('help')
      || lowerQuery.includes('guide')
      || lowerQuery.includes('troubleshoot')
    ) {
      return this.getAgent('n8n-guidance-specialist') ?? undefined
    }

    // Default to guidance specialist for general queries
    return this.getAgent('n8n-guidance-specialist') ?? undefined
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return [...this.agents]
  }

  /**
   * Get agents by tier
   */
  getAgentsByTier(tier: AgentTier): Agent[] {
    return this.agents.filter(agent => agent.tier === tier)
  }

  /**
   * Get optimized agent summary for Claude Code users
   */
  getAgentSummary(): {
    tier: string
    agents: { name: string, description: string }[]
  }[] {
    return [
      {
        tier: 'TIER 1 - Master Orchestrator',
        agents: this.getAgentsByTier(AgentTier.MASTER).map(agent => ({
          name: agent.name,
          description: agent.description,
        })),
      },
      {
        tier: 'TIER 2 - Core Domain Specialists',
        agents: this.getAgentsByTier(AgentTier.SPECIALIST).map(agent => ({
          name: agent.name,
          description: agent.description,
        })),
      },
      {
        tier: 'TIER 3 - Support Specialist',
        agents: this.getAgentsByTier(AgentTier.SUPPORT).map(agent => ({
          name: agent.name,
          description: agent.description,
        })),
      },
    ]
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability: AgentCapability): Agent[] {
    return this.agents.filter(agent =>
      agent.capabilities.includes(capability),
    )
  }

  /**
   * Store routing decision for analytics
   */
  private storeRoutingDecision(
    toolName: string,
    agent: Agent,
    priority: number,
  ): void {
    try {
      // This would store in the database for routing analytics
      // For now, just log it
      logger.debug(
        `Routing decision: ${toolName} → ${agent.name} (priority: ${priority})`,
      )
    }
    catch (error) {
      logger.error('Failed to store routing decision:', error)
    }
  }

  /**
   * Handle escalation between agents (enhanced with Phase 5 optimization)
   */
  async handleEscalation(
    sourceAgentName: string,
    escalationRequest: EscalationRequest,
  ): Promise<EscalationResult> {
    // Try optimized communication first
    if (this.communicationManager) {
      try {
        return await this.communicationManager.optimizedEscalation(escalationRequest)
      }
      catch (error) {
        logger.warn('Optimized escalation failed, falling back to MCP orchestrator:', error)
      }
    }

    // Use MCP orchestrator for enhanced capabilities
    try {
      return await this.mcpOrchestrator.handleEscalation(escalationRequest)
    }
    catch (error) {
      // Fallback to legacy escalation handling
      logger.warn(
        'MCP orchestration failed, falling back to legacy handling:',
        error,
      )
      return this.handleLegacyEscalation(sourceAgentName, escalationRequest)
    }
  }

  /**
   * Legacy escalation handling for backward compatibility
   */
  private async handleLegacyEscalation(
    sourceAgentName: string,
    escalationRequest: EscalationRequest,
  ): Promise<EscalationResult> {
    const targetAgent = escalationRequest.targetAgent
      ? this.getAgent(escalationRequest.targetAgent)
      : this.determineEscalationTarget(escalationRequest)

    if (!targetAgent) {
      logger.error(
        `No target agent found for escalation from ${sourceAgentName}`,
      )
      return {
        success: false,
        handledBy: 'system',
        action: 'rejected',
        message: 'No suitable agent found to handle escalation',
      }
    }

    try {
      // Call the appropriate escalation method based on escalation type
      let result: EscalationResult

      if (
        escalationRequest.reason === EscalationReason.ORCHESTRATION_REQUIRED
        || escalationRequest.reason === EscalationReason.COMPLEXITY_EXCEEDED
      ) {
        // Escalate to coordinator (WorkflowArchitect)
        const coordinator = this.getAgent('n8n-workflow-architect')
        if (coordinator?.handleEscalation) {
          result = await coordinator.handleEscalation(escalationRequest)
        }
        else {
          throw new Error('Coordinator escalation method not available')
        }
      }
      else {
        // Escalate to specialist
        if (targetAgent.handleEscalation) {
          result = await targetAgent.handleEscalation(escalationRequest)
        }
        else {
          throw new Error('Target agent escalation method not available')
        }
      }

      // Store escalation for analytics
      this.storeEscalationDecision(
        sourceAgentName,
        targetAgent.name,
        escalationRequest,
        result,
      )

      return result
    }
    catch (error) {
      logger.error(`Escalation handling failed: ${error}`)
      return {
        success: false,
        handledBy: targetAgent.name,
        action: 'rejected',
        message: `Escalation handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Coordinate multi-agent workflow (legacy method - use coordinateMultiAgent for Phase 2 features)
   */
  async coordinateWorkflow(
    toolName: string,
    _context: AgentContext,
    requiredCapabilities: AgentCapability[],
  ): Promise<{
    coordinator: Agent
    specialists: Agent[]
    executionPlan: { agent: string, phase: string, dependencies: string[] }[]
  }> {
    logger.info(
      `Coordinating multi-agent workflow for ${toolName} with capabilities: ${requiredCapabilities.join(', ')}`,
    )

    // Get coordinator (always WorkflowArchitect for multi-agent workflows)
    const coordinator = this.getAgent('n8n-workflow-architect')
    if (!coordinator) {
      throw new Error('WorkflowArchitect coordinator not found')
    }

    // Get specialists for each required capability
    const specialists: Agent[] = []
    const executionPlan: {
      agent: string
      phase: string
      dependencies: string[]
    }[] = []

    for (const capability of requiredCapabilities) {
      const capabilityAgents = this.getAgentsByCapability(capability)
      if (capabilityAgents.length > 0) {
        const specialist = capabilityAgents[0] // Take the first matching agent
        if (!specialist)
          continue // Type guard for safety
        if (!specialists.find(a => a.name === specialist.name)) {
          specialists.push(specialist)

          // Create execution phase
          let phase = 'execution'
          let dependencies: string[] = []

          switch (capability) {
            case AgentCapability.AUTHENTICATION:
              phase = 'authentication_setup'
              break
            case AgentCapability.CODE_GENERATION:
              phase = 'code_generation'
              dependencies = ['authentication_setup']
              break
            case AgentCapability.NODE_EXPERTISE:
              phase = 'node_configuration'
              dependencies = ['authentication_setup']
              break
            case AgentCapability.PERFORMANCE_OPTIMIZATION:
              phase = 'performance_optimization'
              dependencies = ['code_generation', 'node_configuration']
              break
          }

          executionPlan.push({
            agent: specialist.name,
            phase,
            dependencies,
          })
        }
      }
    }

    // Add coordinator as final orchestration phase
    executionPlan.push({
      agent: coordinator.name,
      phase: 'orchestration',
      dependencies: executionPlan.map(p => p.phase),
    })

    return {
      coordinator,
      specialists,
      executionPlan,
    }
  }

  /**
   * Determine escalation target based on escalation request
   */
  private determineEscalationTarget(request: EscalationRequest): Agent | null {
    // If specific target agent is requested
    if (request.targetAgent) {
      return this.getAgent(request.targetAgent)
    }

    // Determine target based on escalation reason
    switch (request.reason) {
      case EscalationReason.COMPLEXITY_EXCEEDED:
      case EscalationReason.ORCHESTRATION_REQUIRED:
      case EscalationReason.STRATEGIC_PLANNING_NEEDED:
        return this.getAgent('n8n-workflow-architect')

      case EscalationReason.AUTHENTICATION_REQUIRED:
      case EscalationReason.SECURITY_CONCERN:
        return this.getAgent('n8n-integration-specialist')

      case EscalationReason.PERFORMANCE_BOTTLENECK:
      case EscalationReason.RESOURCE_LIMITATION:
        return this.getAgent('n8n-performance-specialist')

      case EscalationReason.SPECIALIST_KNOWLEDGE_REQUIRED:
        // Route based on required capabilities
        if (request.requiredCapabilities.length > 0) {
          const capability = request.requiredCapabilities[0]
          if (!capability)
            break // Type guard for capability
          const capabilityAgents = this.getAgentsByCapability(capability)
          return capabilityAgents.length > 0
            ? (capabilityAgents[0] ?? null)
            : null
        }
        break

      case EscalationReason.CROSS_DOMAIN_DEPENDENCY:
        // Escalate to coordinator for cross-domain coordination
        return this.getAgent('n8n-workflow-architect')
    }

    // Default to guidance specialist
    return this.getAgent('n8n-guidance-specialist')
  }

  /**
   * Store escalation decision for analytics
   */
  private storeEscalationDecision(
    sourceAgent: string,
    targetAgent: string,
    request: EscalationRequest,
    result: EscalationResult,
  ): void {
    try {
      logger.debug(
        `Escalation: ${sourceAgent} → ${targetAgent} (${request.reason}): ${result.action}`,
      )
      // This would store escalation analytics in the database
      // For now, just log it
    }
    catch (error) {
      logger.error('Failed to store escalation decision:', error)
    }
  }

  /**
   * Get MCP orchestrator for advanced coordination
   */
  getMCPOrchestrator(): MCPOrchestrator {
    return this.mcpOrchestrator
  }

  /**
   * Enhanced multi-agent coordination (Phase 2)
   */
  async coordinateMultiAgent(
    requests: EscalationRequest[],
  ): Promise<EscalationResult[]> {
    return await this.mcpOrchestrator.coordinateMultiAgent(requests)
  }

  /**
   * Get escalation statistics (enhanced with Phase 2 analytics)
   */
  getEscalationStats(): EscalationStats {
    const legacyStats = this.getLegacyEscalationStats()
    const coordinationAnalytics
      = this.mcpOrchestrator.getCoordinationAnalytics()

    return {
      ...legacyStats,
      coordinationAnalytics,
    }
  }

  private getLegacyEscalationStats(): Omit<
    EscalationStats,
    'coordinationAnalytics'
  > {
    // This would return escalation statistics from the database
    // For now, return empty stats
    return {
      totalEscalations: 0,
      escalationsByReason: {} as Record<EscalationReason, number>,
      escalationsByAgent: {},
      successRate: 0,
    }
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): Record<string, { agent: string, count: number }> {
    // This would return routing statistics from the database
    // For now, return empty object
    return {}
  }

  /**
   * Analyze agent performance
   */
  analyzeAgentPerformance(): {
    agent: string
    toolsHandled: number
    averageExecutionTime: number
    successRate: number
  }[] {
    // This would analyze agent performance from the database
    // For now, return empty array
    return []
  }

  /**
   * Get communication metrics (Phase 5 enhancement)
   */
  getCommunicationMetrics(): CommunicationMetrics | Record<string, unknown> {
    if (this.communicationManager) {
      return this.communicationManager.getMetrics() as CommunicationMetrics
    }
    return {
      routingLatency: [],
      escalationLatency: [],
      throughput: 0,
      errorRate: 0,
      cacheHitRatio: 0,
      activeConnections: 0,
      queueLength: 0,
      circuitBreakerState: 'closed',
    }
  }

  /**
   * Shutdown the router and cleanup resources
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down agent router...')

    if (this.communicationManager) {
      try {
        await this.communicationManager.shutdown()
        logger.info('Communication manager shut down successfully')
      }
      catch (error) {
        logger.error('Error shutting down communication manager:', error)
      }
    }

    logger.info('Agent router shutdown complete')
  }
}

// Export singleton router
export const agentRouter = new AgentRouter()

/**
 * Agent context builder for intelligent routing
 */
export class AgentContextBuilder {
  private context: AgentContext = {}

  static create(): AgentContextBuilder {
    return new AgentContextBuilder()
  }

  complexity(level: 'low' | 'medium' | 'high'): AgentContextBuilder {
    this.context.complexity = level
    return this
  }

  requiresValidation(required: boolean = true): AgentContextBuilder {
    this.context.requiresValidation = required
    return this
  }

  requiresAuthentication(required: boolean = true): AgentContextBuilder {
    this.context.requiresAuthentication = required
    return this
  }

  nodeExpertise(required: boolean = true): AgentContextBuilder {
    this.context.nodeExpertise = required
    return this
  }

  quickHelp(required: boolean = true): AgentContextBuilder {
    this.context.quickHelp = required
    return this
  }

  documentation(required: boolean = true): AgentContextBuilder {
    this.context.documentation = required
    return this
  }

  community(required: boolean = true): AgentContextBuilder {
    this.context.community = required
    return this
  }

  codeGeneration(required: boolean = true): AgentContextBuilder {
    this.context.codeGeneration = required
    return this
  }

  developerWorkflow(required: boolean = true): AgentContextBuilder {
    this.context.developerWorkflow = required
    return this
  }

  performance(required: boolean = true): AgentContextBuilder {
    this.context.performance = required
    return this
  }

  optimization(required: boolean = true): AgentContextBuilder {
    this.context.optimization = required
    return this
  }

  monitoring(required: boolean = true): AgentContextBuilder {
    this.context.monitoring = required
    return this
  }

  guidance(required: boolean = true): AgentContextBuilder {
    this.context.guidance = required
    return this
  }

  systemAdmin(required: boolean = true): AgentContextBuilder {
    this.context.systemAdmin = required
    return this
  }

  // Escalation context methods
  escalationHistory(history: EscalationRequest[]): AgentContextBuilder {
    this.context.escalationHistory = history
    return this
  }

  originalAgent(agentName: string): AgentContextBuilder {
    this.context.originalAgent = agentName
    return this
  }

  addEscalation(escalation: EscalationRequest): AgentContextBuilder {
    this.context.escalationHistory ??= []
    this.context.escalationHistory.push(escalation)
    return this
  }

  build(): AgentContext {
    return this.context
  }

  // Helper method to build escalation request
  static buildEscalationRequest(
    toolName: string,
    reason: EscalationReason,
    sourceAgent: string,
    options?: {
      urgency?: EscalationUrgency
      targetAgent?: string
      message?: string
      attemptedActions?: string[]
      requiredCapabilities?: AgentCapability[]
      originalContext?: AgentContext
    },
  ): EscalationRequest {
    return {
      originalToolName: toolName,
      ...(options?.originalContext && {
        originalContext: options.originalContext,
      }),
      reason,
      urgency: options?.urgency ?? EscalationUrgency.MEDIUM,
      sourceAgent,
      ...(options?.targetAgent && { targetAgent: options.targetAgent }),
      message: options?.message ?? `Escalation from ${sourceAgent}: ${reason}`,
      attemptedActions: options?.attemptedActions ?? [],
      requiredCapabilities: options?.requiredCapabilities ?? [],
      additionalContext: {},
    }
  }

  // Helper method to create escalation-aware context
  static forEscalation(
    originalContext: AgentContext,
    escalationRequest: EscalationRequest,
  ): AgentContextBuilder {
    const builder = new AgentContextBuilder()
    builder.context = {
      ...originalContext,
      escalationHistory: [
        ...(originalContext.escalationHistory ?? []),
        escalationRequest,
      ],
      originalAgent: escalationRequest.sourceAgent,
    }
    return builder
  }
}

// Export AgentContextBuilder as AgentContextClass for test compatibility
export const AgentContextClass = AgentContextBuilder

// Export enhanced Phase 2 types and classes
export type {
  CoordinationAnalytics,
  CoordinationStrategy,
  EscalationSession,
  EscalationStats,
}
