/**
 * Dynamic Agent MCP Tools
 * Tools for memory management, session handling, and agent collaboration
 * Phase 2 Section 2.4: Dynamic MCP Tools Implementation
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { AgentMemorySystem } from '../agents/memory-system.js'
import { AgentSessionManager } from '../agents/session-manager.js'
import { DynamicAgentDB } from '../database/dynamic-agent-db.js'

// Define SessionAnalytics interface to match the one in session-manager.ts
interface SessionAnalytics {
  sessionId: string
  agentName: string
  totalOperations: number
  successfulOperations: number
  averageOperationDuration: number
  memoryUsageBytes: number
  sessionDurationMinutes: number
  operationTypes: Record<string, number>
  errorPatterns: Array<{ error: string, count: number }>
}

// Input schemas for MCP tools
const StoreMemorySchema = z.object({
  agentName: z.string().min(1).max(100).regex(/^[\w-]+$/).describe('Agent name - alphanumeric, underscore, and dash only'),
  memoryType: z.enum([
    // Core workflow patterns
    'workflow_pattern',
    'workflow_template',
    'workflow_snippet',
    'node_configuration',
    'node_pattern',
    'integration_pattern',

    // User interaction patterns
    'user_preference',
    'user_query',
    'user_feedback',
    'user_context',

    // Problem solving patterns
    'error_solution',
    'troubleshooting_guide',
    'debug_strategy',
    'workaround_solution',

    // Knowledge and learning
    'discovery_result',
    'knowledge_base',
    'learning_outcome',
    'best_practice',
    'anti_pattern',

    // Performance and optimization
    'performance_insight',
    'optimization_rule',
    'efficiency_tip',
    'resource_usage',

    // Security and validation
    'validation_rule',
    'security_pattern',
    'credential_pattern',
    'permission_rule',

    // Collaboration and delegation
    'delegation_outcome',
    'collaboration_pattern',
    'team_preference',
    'handoff_instruction',

    // Testing and development
    'test_pattern',
    'test_case',
    'test_data',
    'mock_configuration',

    // API and integration specific
    'api_pattern',
    'webhook_pattern',
    'connection_config',
    'data_mapping',

    // Monitoring and analytics
    'usage_pattern',
    'metric_definition',
    'alert_rule',
    'dashboard_config',

    // Legacy test support
    'response_format',
    'performance_test',
    'load_test',
  ]),
  content: z.string().min(10).max(10000).describe('Memory content - detailed information to store'),
  tags: z.array(z.string().min(1).max(50)).max(20).optional().describe('Optional tags for categorization (max 20 tags, 50 chars each)'),
  expiresIn: z.number().min(1).max(8760).optional().describe('Hours until expiration (max 1 year)'), // Hours until expiration
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional().describe('Memory importance level'),
})

const SearchMemorySchema = z.object({
  agentName: z.string().min(1).describe('Agent name to search memories for'),
  query: z.string().min(3).max(500).describe('Search query - keywords or phrases to find'),
  memoryTypes: z.array(z.string().min(1)).max(10).optional().describe('Filter by specific memory types (max 10 types)'),
  limit: z.number().min(1).max(50).default(10).describe('Maximum number of results to return'),
  minRelevance: z.number().min(0.1).max(1.0).default(0.7).describe('Minimum relevance score threshold'),
  tags: z.array(z.string().min(1)).max(10).optional().describe('Filter by tags (max 10 tags)'),
})

const CreateSessionSchema = z.object({
  agentName: z.string().min(1).max(100).regex(/^[\w-]+$/).describe('Agent name - alphanumeric, underscore, and dash only'),
  sessionType: z.enum([
    // Core workflow development
    'iterative_building',
    'rapid_prototyping',
    'workflow_design',
    'template_creation',

    // Consultation and advisory
    'consultation',
    'technical_advisory',
    'strategic_consultation',
    'architecture_review',
    'best_practice_guidance',

    // Collaboration patterns
    'collaboration',
    'pair_programming',
    'code_review',
    'knowledge_transfer',
    'cross_training',
    'team_building',

    // Task delegation and management
    'delegation',
    'task_management',
    'project_coordination',
    'work_distribution',
    'progress_tracking',

    // Learning and development
    'learning',
    'training_session',
    'skill_development',
    'mentoring',
    'onboarding',
    'certification_prep',

    // Problem solving and support
    'troubleshooting',
    'incident_response',
    'emergency_support',
    'crisis_management',
    'post_mortem',

    // Analysis and research
    'data_exploration',
    'research_session',
    'competitive_analysis',
    'market_research',
    'feasibility_study',

    // Testing and validation
    'testing_session',
    'validation_review',
    'quality_assurance',
    'security_audit',
    'performance_analysis',

    // Planning and strategy
    'planning_session',
    'roadmap_planning',
    'sprint_planning',
    'release_planning',
    'capacity_planning',

    // Integration and deployment
    'integration_session',
    'deployment_planning',
    'rollout_coordination',
    'migration_planning',
    'cutover_management',

    // Legacy test support
    'mcp_testing',
    'test_session',
  ]),
  expirationHours: z.number().min(1).max(168).default(24).describe('Session expiration in hours (default 24h, max 1 week)'),
  initialData: z.record(z.unknown()).optional().describe('Initial session data and context'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe('Session priority level'),
})

const UpdateSessionSchema = z.object({
  sessionId: z.string().min(1),
  updates: z.record(z.unknown()),
  operation: z.string().min(1),
})

const DelegateTaskSchema = z.object({
  fromAgent: z.string().min(1),
  toAgent: z.string().min(1),
  taskType: z.enum([
    // Strategic and planning
    'strategic_planning',
    'requirement_analysis',
    'solution_design',
    'architecture_review',
    'feasibility_study',

    // Implementation and development
    'technical_implementation',
    'workflow_generation',
    'workflow_modification',
    'workflow_optimization',
    'node_selection',
    'node_configuration',
    'integration_setup',
    'api_integration',
    'webhook_configuration',

    // Testing and validation
    'security_validation',
    'functional_testing',
    'integration_testing',
    'performance_testing',
    'regression_testing',
    'validation_task',
    'quality_assurance',

    // Problem solving and support
    'error_resolution',
    'troubleshooting',
    'debugging',
    'investigation',
    'root_cause_analysis',
    'incident_response',

    // Optimization and improvement
    'performance_optimization',
    'resource_optimization',
    'efficiency_improvement',
    'cost_optimization',
    'scalability_enhancement',

    // Knowledge and learning
    'knowledge_lookup',
    'knowledge_sharing',
    'documentation_update',
    'training_delivery',
    'skill_assessment',
    'learning_facilitation',

    // Monitoring and maintenance
    'monitoring_setup',
    'health_check',
    'system_maintenance',
    'backup_management',
    'cleanup_operation',

    // Collaboration and communication
    'team_coordination',
    'stakeholder_communication',
    'progress_reporting',
    'review_facilitation',
    'decision_support',

    // Data and analytics
    'data_analysis',
    'data_transformation',
    'reporting_generation',
    'metrics_collection',
    'insight_generation',

    // Security and compliance
    'security_assessment',
    'compliance_check',
    'audit_preparation',
    'risk_assessment',
    'access_management',
  ]),
  taskDescription: z.string().min(10).max(2000).describe('Detailed description of the task to be performed'),
  complexity: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Task complexity level - affects resource allocation and timeouts'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe('Task priority level for scheduling'),
  sessionId: z.string().optional(),
})

const DiscoverKnowledgeSchema = z.object({
  agentName: z.string().min(1).max(100).regex(/^[\w-]+$/).describe('Agent name - alphanumeric, underscore, and dash only'),
  discoveryType: z.enum([
    'node_pattern',
    'workflow_template',
    'error_solution',
    'performance_optimization',
    'security_pattern',
    'integration_method',
    'validation_rule',
    'best_practice',
  ]),
  title: z.string().min(5),
  description: z.string().min(20),
  content: z.record(z.unknown()),
  nodeTypes: z.array(z.string()).optional(),
})

/**
 * Dynamic Agent Tools Registry
 * Provides MCP tools for enhanced agent capabilities
 */
export class DynamicAgentTools {
  private memorySystem: AgentMemorySystem
  private sessionManager: AgentSessionManager
  private db: DynamicAgentDB

  constructor(
    memorySystem: AgentMemorySystem,
    sessionManager: AgentSessionManager,
    db: DynamicAgentDB,
  ) {
    this.memorySystem = memorySystem
    this.sessionManager = sessionManager
    this.db = db
  }

  /**
   * Get all dynamic agent MCP tools
   */
  getTools(): Tool[] {
    return [
      this.getStoreMemoryTool(),
      this.getSearchMemoryTool(),
      this.getMemoryAnalyticsTool(),
      this.getCreateSessionTool(),
      this.getUpdateSessionTool(),
      this.getSessionAnalyticsTool(),
      this.getDelegateTaskTool(),
      this.getDiscoverKnowledgeTool(),
      this.getAgentInsightsTool(),
      this.getCollaborationTool(),
    ]
  }

  /**
   * Handle dynamic agent tool requests
   */
  async handleToolCall(toolName: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (toolName) {
      case 'store_agent_memory':
        return this.handleStoreMemory(args)
      case 'search_agent_memory':
        return this.handleSearchMemory(args)
      case 'get_memory_analytics':
        return this.handleMemoryAnalytics(args)
      case 'create_agent_session':
        return this.handleCreateSession(args)
      case 'update_agent_session':
        return this.handleUpdateSession(args)
      case 'get_session_analytics':
        return this.handleSessionAnalytics(args)
      case 'delegate_agent_task':
        return this.handleDelegateTask(args)
      case 'discover_knowledge':
        return this.handleDiscoverKnowledge(args)
      case 'get_agent_insights':
        return this.handleAgentInsights(args)
      case 'enable_agent_collaboration':
        return this.handleCollaboration(args)
      default:
        throw new Error(`Unknown dynamic agent tool: ${toolName}`)
    }
  }

  // Tool definitions

  private getStoreMemoryTool(): Tool {
    return {
      name: 'store_agent_memory',
      description: 'Store a memory in the agent memory system with semantic indexing and automatic relationship discovery',
      inputSchema: {
        type: 'object',
        properties: {
          agentName: {
            type: 'string',
            description: 'Name of the agent storing the memory',
          },
          memoryType: {
            type: 'string',
            enum: [
              'workflow_pattern',
              'node_configuration',
              'user_preference',
              'error_solution',
              'delegation_outcome',
              'discovery_result',
              'validation_rule',
              'performance_insight',
            ],
            description: 'Type of memory being stored',
          },
          content: {
            type: 'string',
            description: 'Memory content (minimum 10 characters)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional tags for categorization',
          },
          expiresIn: {
            type: 'number',
            description: 'Optional expiration in hours',
          },
        },
        required: ['agentName', 'memoryType', 'content'],
      },
    }
  }

  private getSearchMemoryTool(): Tool {
    return {
      name: 'search_agent_memory',
      description: 'Semantically search agent memories with relevance scoring and relationship traversal',
      inputSchema: {
        type: 'object',
        properties: {
          agentName: {
            type: 'string',
            description: 'Name of the agent to search memories for',
          },
          query: {
            type: 'string',
            description: 'Search query (minimum 3 characters)',
          },
          memoryTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional filter by memory types',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 50,
            default: 10,
            description: 'Maximum number of results',
          },
          minRelevance: {
            type: 'number',
            minimum: 0.1,
            maximum: 1.0,
            default: 0.7,
            description: 'Minimum relevance threshold',
          },
        },
        required: ['agentName', 'query'],
      },
    }
  }

  private getMemoryAnalyticsTool(): Tool {
    return {
      name: 'get_memory_analytics',
      description: 'Get comprehensive analytics about an agent\'s memory system including usage patterns and insights',
      inputSchema: {
        type: 'object',
        properties: {
          agentName: {
            type: 'string',
            description: 'Name of the agent to analyze',
          },
        },
        required: ['agentName'],
      },
    }
  }

  private getCreateSessionTool(): Tool {
    return {
      name: 'create_agent_session',
      description: 'Create a new persistent agent session with encrypted state management',
      inputSchema: {
        type: 'object',
        properties: {
          agentName: {
            type: 'string',
            description: 'Name of the agent creating the session',
          },
          sessionType: {
            type: 'string',
            enum: ['iterative_building', 'consultation', 'collaboration', 'delegation', 'learning'],
            description: 'Type of session being created',
          },
          expirationHours: {
            type: 'number',
            minimum: 1,
            maximum: 168,
            description: 'Session expiration in hours (1-168)',
          },
          initialData: {
            type: 'object',
            description: 'Optional initial session data',
          },
        },
        required: ['agentName', 'sessionType'],
      },
    }
  }

  private getUpdateSessionTool(): Tool {
    return {
      name: 'update_agent_session',
      description: 'Update agent session state with automatic encryption and operation logging',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID of the session to update',
          },
          updates: {
            type: 'object',
            description: 'State updates to apply',
          },
          operation: {
            type: 'string',
            description: 'Description of the operation being performed',
          },
        },
        required: ['sessionId', 'updates', 'operation'],
      },
    }
  }

  private getSessionAnalyticsTool(): Tool {
    return {
      name: 'get_session_analytics',
      description: 'Get detailed analytics and performance metrics for an agent session',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'ID of the session to analyze',
          },
        },
        required: ['sessionId'],
      },
    }
  }

  private getDelegateTaskTool(): Tool {
    return {
      name: 'delegate_agent_task',
      description: 'Delegate a task to another agent with learning and routing optimization',
      inputSchema: {
        type: 'object',
        properties: {
          fromAgent: {
            type: 'string',
            description: 'Agent delegating the task',
          },
          toAgent: {
            type: 'string',
            description: 'Agent receiving the task',
          },
          taskType: {
            type: 'string',
            enum: [
              'strategic_planning',
              'technical_implementation',
              'security_validation',
              'performance_optimization',
              'error_resolution',
              'knowledge_lookup',
              'workflow_generation',
              'node_selection',
            ],
            description: 'Type of task being delegated',
          },
          taskDescription: {
            type: 'string',
            description: 'Detailed description of the task',
          },
          complexity: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Task complexity level',
          },
          sessionId: {
            type: 'string',
            description: 'Optional session ID for context',
          },
        },
        required: ['fromAgent', 'toAgent', 'taskType', 'taskDescription'],
      },
    }
  }

  private getDiscoverKnowledgeTool(): Tool {
    return {
      name: 'discover_knowledge',
      description: 'Record a knowledge discovery for sharing across all agents in the system',
      inputSchema: {
        type: 'object',
        properties: {
          agentName: {
            type: 'string',
            description: 'Agent making the discovery',
          },
          discoveryType: {
            type: 'string',
            enum: [
              'node_pattern',
              'workflow_template',
              'error_solution',
              'performance_optimization',
              'security_pattern',
              'integration_method',
              'validation_rule',
              'best_practice',
            ],
            description: 'Type of knowledge discovery',
          },
          title: {
            type: 'string',
            description: 'Title of the discovery',
          },
          description: {
            type: 'string',
            description: 'Detailed description',
          },
          content: {
            type: 'object',
            description: 'Structured discovery data',
          },
          nodeTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Related n8n node types',
          },
        },
        required: ['agentName', 'discoveryType', 'title', 'description', 'content'],
      },
    }
  }

  private getAgentInsightsTool(): Tool {
    return {
      name: 'get_agent_insights',
      description: 'Get comprehensive insights about agent performance, collaboration patterns, and optimization opportunities',
      inputSchema: {
        type: 'object',
        properties: {
          agentName: {
            type: 'string',
            description: 'Optional specific agent name, or leave empty for system-wide insights',
          },
          timeframe: {
            type: 'string',
            enum: ['hour', 'day', 'week', 'month'],
            default: 'day',
            description: 'Timeframe for analysis',
          },
        },
        required: [],
      },
    }
  }

  private getCollaborationTool(): Tool {
    return {
      name: 'enable_agent_collaboration',
      description: 'Enable collaborative sessions between multiple agents with shared state management',
      inputSchema: {
        type: 'object',
        properties: {
          primaryAgent: {
            type: 'string',
            description: 'Primary agent coordinating the collaboration',
          },
          collaboratingAgents: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of agents to collaborate with',
          },
          collaborationType: {
            type: 'string',
            enum: ['workflow_design', 'problem_solving', 'knowledge_sharing', 'validation', 'mcp_testing'],
            description: 'Type of collaboration',
          },
          sharedContext: {
            type: 'object',
            description: 'Initial shared context for the collaboration',
          },
        },
        required: ['primaryAgent', 'collaboratingAgents', 'collaborationType'],
      },
    }
  }

  // Tool handlers

  private async handleStoreMemory(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    let input
    try {
      input = StoreMemorySchema.parse(args)
    }
    catch (error) {
      if (error instanceof z.ZodError) {
        const missingRequired = error.issues.find(issue => issue.code === 'invalid_type' && issue.message === 'Required')
        if (missingRequired) {
          throw new Error(`${missingRequired.path[0]} is required`)
        }
        throw new Error(error.issues[0]?.message ?? 'Validation error')
      }
      throw error
    }

    const expiresAt = input.expiresIn
      ? new Date(Date.now() + input.expiresIn * 60 * 60 * 1000)
      : undefined

    const memoryId = await this.memorySystem.storeMemory({
      agentName: input.agentName,
      memoryType: input.memoryType,
      content: input.content,
      tags: input.tags,
      expiresAt,
    })

    return {
      success: true,
      memoryId,
      message: `Memory stored successfully for agent ${input.agentName}`,
      agentName: input.agentName,
      memoryType: input.memoryType,
      contentLength: input.content.length,
      tags: input.tags ?? [],
    }
  }

  private async handleSearchMemory(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    let input
    try {
      input = SearchMemorySchema.parse(args)
    }
    catch (error) {
      if (error instanceof z.ZodError) {
        const missingRequired = error.issues.find(issue => issue.code === 'invalid_type' && issue.message === 'Required')
        if (missingRequired) {
          throw new Error(`${missingRequired.path[0]} is required`)
        }
        throw new Error(error.issues[0]?.message ?? 'Validation error')
      }
      throw error
    }

    const results = await this.memorySystem.searchMemories(
      input.agentName,
      input.query,
      {
        memoryTypes: input.memoryTypes as Array<typeof StoreMemorySchema._type.memoryType>,
        minRelevance: input.minRelevance,
        limit: input.limit,
      },
    )

    return {
      success: true,
      query: input.query,
      resultsCount: results.length,
      results: results.map(result => ({
        memoryId: result.memory.id,
        memoryType: result.memory.memoryType,
        content: result.memory.content,
        relevanceScore: result.relevanceScore,
        relationshipCount: result.relationshipCount,
        lastAccessedDays: result.lastAccessedDays,
        tags: result.memory.tags,
        usageCount: result.memory.usageCount,
      })),
    }
  }

  private async handleMemoryAnalytics(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { agentName } = args
    const analytics = await this.memorySystem.getMemoryAnalytics(String(agentName))

    return {
      success: true,
      agentName,
      analytics,
      insights: this.generateMemoryInsights(analytics),
    }
  }

  private async handleCreateSession(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    let input
    try {
      input = CreateSessionSchema.parse(args)
    }
    catch (error) {
      if (error instanceof z.ZodError) {
        const missingRequired = error.issues.find(issue => issue.code === 'invalid_type' && issue.message === 'Required')
        if (missingRequired) {
          throw new Error(`${missingRequired.path[0]} is required`)
        }
        throw new Error(error.issues[0]?.message ?? 'Validation error')
      }
      throw error
    }

    const sessionId = await this.sessionManager.createSession({
      agentName: input.agentName,
      sessionType: input.sessionType,
      expirationHours: input.expirationHours,
      initialState: input.initialData,
    })

    return {
      success: true,
      sessionId,
      agentName: input.agentName,
      sessionType: input.sessionType,
      expiresAt: new Date(Date.now() + (input.expirationHours ?? 24) * 60 * 60 * 1000),
    }
  }

  private async handleUpdateSession(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const input = UpdateSessionSchema.parse(args)

    const success = await this.sessionManager.updateSession({
      sessionId: input.sessionId,
      stateUpdates: input.updates,
      operationType: input.operation,
    })

    return {
      success,
      sessionId: input.sessionId,
      operation: input.operation,
      timestamp: new Date(),
    }
  }

  private async handleSessionAnalytics(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { sessionId } = args
    const analytics = await this.sessionManager.getSessionAnalytics(String(sessionId))

    if (!analytics) {
      return {
        success: false,
        error: 'Session not found or expired',
      }
    }

    return {
      success: true,
      sessionId,
      analytics,
      insights: this.generateSessionInsights(analytics),
    }
  }

  private async handleDelegateTask(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    let input
    try {
      input = DelegateTaskSchema.parse(args)
    }
    catch (error) {
      if (error instanceof z.ZodError) {
        const missingRequired = error.issues.find(issue => issue.code === 'invalid_type' && issue.message === 'Required')
        if (missingRequired) {
          throw new Error(`${missingRequired.path[0]} is required`)
        }
        throw new Error(error.issues[0]?.message ?? 'Validation error')
      }
      throw error
    }

    // Record delegation in database
    const delegationId = await this.db.recordDelegation({
      fromAgent: input.fromAgent,
      toAgent: input.toAgent,
      delegationType: input.taskType,
      taskDescription: input.taskDescription,
      taskComplexity: input.complexity ?? 'medium',
      estimatedDurationMinutes: this.estimateTaskDuration(input.taskType, input.complexity),
      success: false, // Will be updated when delegation completes
    })

    // Create memory record of delegation
    await this.memorySystem.storeMemory({
      agentName: input.fromAgent,
      memoryType: 'delegation_outcome',
      content: `Delegated ${input.taskType} to ${input.toAgent}: ${input.taskDescription}`,
      tags: ['delegation', input.taskType, input.toAgent],
    })

    return {
      success: true,
      delegationId,
      fromAgent: input.fromAgent,
      toAgent: input.toAgent,
      taskType: input.taskType,
      estimatedDuration: this.estimateTaskDuration(input.taskType, input.complexity),
      recommendations: await this.getDelegationRecommendations(input.fromAgent, input.taskType),
    }
  }

  private async handleDiscoverKnowledge(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const input = DiscoverKnowledgeSchema.parse(args)

    const discoveryId = await this.db.storeDiscovery({
      discoveryType: input.discoveryType,
      discoveryKey: this.generateDiscoveryKey(input.title, input.discoveryType),
      title: input.title,
      description: input.description,
      contentData: input.content,
      nodeTypes: input.nodeTypes ?? [],
      tags: this.extractTagsFromContent(input.description),
      createdBy: input.agentName,
    })

    // Store in agent memory
    await this.memorySystem.storeMemory({
      agentName: input.agentName,
      memoryType: 'discovery_result',
      content: `${input.title}: ${input.description}`,
      tags: ['discovery', input.discoveryType, ...this.extractTagsFromContent(input.description)],
    })

    return {
      success: true,
      discoveryId,
      discoveryKey: this.generateDiscoveryKey(input.title, input.discoveryType),
      agentName: input.agentName,
      discoveryType: input.discoveryType,
      sharedWith: 'all_agents',
    }
  }

  private async handleAgentInsights(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { agentName, timeframe = 'day' } = args

    const insights = agentName
      ? await this.db.getAgentInsights(String(agentName))
      : await this.db.getSystemAnalytics()

    return {
      success: true,
      agentName: agentName || 'system_wide',
      timeframe,
      insights,
      recommendations: this.generateOptimizationRecommendations(insights),
    }
  }

  private async handleCollaboration(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { primaryAgent, collaboratingAgents, collaborationType, sharedContext } = args

    // Create collaborative session
    const sessionId = await this.sessionManager.createSession({
      agentName: String(primaryAgent),
      sessionType: 'collaboration',
      expirationHours: 24,
      initialState: {
        collaborationType,
        collaboratingAgents,
        sharedContext: sharedContext ?? {},
      },
    })

    // Create child sessions for each collaborating agent
    const childSessions = []
    for (const agent of (collaboratingAgents as string[])) {
      // eslint-disable-next-line no-await-in-loop
      const childSessionId = await this.sessionManager.createChildSession(
        sessionId,
        agent,
        'collaboration',
        { primarySession: sessionId, collaborationType },
      )
      childSessions.push({ agent, sessionId: childSessionId })
    }

    return {
      success: true,
      collaborationId: sessionId,
      primaryAgent,
      collaboratingAgents,
      collaborationType,
      childSessions,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }
  }

  // Helper methods

  private generateMemoryInsights(analytics: Record<string, unknown>): string[] {
    const insights = []

    if (Number(analytics.totalMemories) > 1000) {
      insights.push('High memory usage detected - consider consolidation')
    }

    if (Number(analytics.averageRelevance) < 0.7) {
      insights.push('Memory relevance declining - strengthen important memories')
    }

    const relationshipStats = analytics.relationshipStats as Record<string, unknown> | undefined
    const strongRelationships = Number(relationshipStats?.strongRelationships) || 0
    if (strongRelationships < Number(analytics.totalMemories) * 0.1) {
      insights.push('Low memory connectivity - improve relationship linking')
    }

    return insights
  }

  private generateSessionInsights(analytics: SessionAnalytics): string[] {
    const insights = []

    const successfulOps = analytics.successfulOperations
    const totalOps = analytics.totalOperations || 1
    const successRate = successfulOps / totalOps
    if (successRate < 0.9) {
      insights.push(`Success rate ${(successRate * 100).toFixed(1)}% - investigate error patterns`)
    }

    if (analytics.averageOperationDuration > 5000) {
      insights.push('Operations taking longer than expected - optimize performance')
    }

    if (analytics.memoryUsageBytes > 1048576) {
      insights.push('High memory usage - consider session optimization')
    }

    return insights
  }

  private estimateTaskDuration(taskType: string, complexity?: string): number {
    const baseMinutes = {
      strategic_planning: 30,
      technical_implementation: 60,
      security_validation: 20,
      performance_optimization: 45,
      error_resolution: 25,
      knowledge_lookup: 10,
      workflow_generation: 40,
      node_selection: 15,
    }

    const complexityMultiplier = {
      low: 0.7,
      medium: 1.0,
      high: 1.5,
    }

    const base = baseMinutes[taskType as keyof typeof baseMinutes] ?? 30
    const multiplier = complexityMultiplier[complexity as keyof typeof complexityMultiplier] ?? 1.0

    return Math.round(base * multiplier)
  }

  private async getDelegationRecommendations(fromAgent: string, taskType: string): Promise<string[]> {
    const recommendations = await this.db.getDelegationRecommendations(taskType)
    return recommendations.map(rec =>
      `Consider ${rec.recommendedAgent} (confidence: ${(rec.confidenceScore * 100).toFixed(1)}%)`,
    )
  }

  private generateDiscoveryKey(title: string, discoveryType: string): string {
    const normalized = title.toLowerCase().replace(/[^a-z0-9]/g, '_')
    return `${discoveryType}_${normalized}_${Date.now()}`
  }

  private extractTagsFromContent(content: string): string[] {
    const words = content.toLowerCase().split(/\s+/)
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'])

    return words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 5)
  }

  private generateOptimizationRecommendations(insights: Record<string, unknown>): string[] {
    // Generate optimization recommendations based on insights
    const recommendations = []

    const performance = insights.performance as Record<string, unknown> | undefined
    if (performance?.averageResponseTime && Number(performance.averageResponseTime) > 2000) {
      recommendations.push('Optimize response time through caching and query optimization')
    }

    const memory = insights.memory as Record<string, unknown> | undefined
    if (memory?.consolidationOpportunities && Number(memory.consolidationOpportunities) > 0) {
      recommendations.push('Run memory consolidation to reduce duplicates')
    }

    const delegation = insights.delegation as Record<string, unknown> | undefined
    if (delegation?.failureRate && Number(delegation.failureRate) > 0.1) {
      recommendations.push('Review delegation patterns and improve routing')
    }

    return recommendations
  }
}

/**
 * Factory function for creating dynamic agent tools
 */
export async function createDynamicAgentTools(): Promise<DynamicAgentTools> {
  const db = new DynamicAgentDB()
  await db.initialize()

  const memorySystem = new AgentMemorySystem(db)
  const sessionManager = new AgentSessionManager(db)

  return new DynamicAgentTools(memorySystem, sessionManager, db)
}
