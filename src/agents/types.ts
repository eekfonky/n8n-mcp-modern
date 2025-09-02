/**
 * Core type definitions for the n8n-MCP Modern agent system
 * Centralized types to eliminate duplication and improve maintainability
 */

/**
 * Claude model identifiers with strict typing
 */
export const CLAUDE_MODEL_TIERS = {
  OPUS: 'claude-3-opus-20240229',       // Complex reasoning, high capability
  SONNET: 'claude-3-5-sonnet-20241022', // Balanced capability and speed  
  HAIKU: 'claude-3-haiku-20240307',     // Fast throughput, information gathering
} as const

export type ClaudeModel = typeof CLAUDE_MODEL_TIERS[keyof typeof CLAUDE_MODEL_TIERS]

/**
 * Agent model configuration with reasoning documentation
 */
export interface AgentModelConfig {
  /** Primary model for this agent's operations */
  readonly primaryModel: ClaudeModel
  /** Optional fallback model for complex scenarios */
  readonly fallbackModel?: ClaudeModel
  /** Human-readable explanation of model choice reasoning */
  readonly modelReason: string
}

/**
 * Complete agent specialization definition
 */
export interface AgentSpecialization {
  /** Unique agent identifier (e.g., 'n8n-orchestrator') */
  readonly name: string
  /** Hierarchical tier (1=Strategic, 2=Core, 3=Domain, 4=Support) */
  readonly tier: 1 | 2 | 3 | 4
  /** Human-readable display name */
  readonly displayName: string
  /** Brief description of agent responsibilities */
  readonly description: string
  /** Domain areas this agent handles */
  readonly domains: readonly string[]
  /** Node patterns this agent can process */
  readonly nodePatterns: readonly string[]
  /** Core competencies and skills */
  readonly expertise: readonly string[]
  /** Available tools and capabilities */
  readonly toolAccess: readonly string[]
  /** Other agents this agent frequently collaborates with */
  readonly collaboratesWith: readonly string[]
  /** Maximum concurrent tasks this agent can handle */
  readonly maxConcurrentTasks: number
  /** Specialized knowledge areas */
  readonly specializedKnowledge: readonly string[]
  /** Model configuration for this agent */
  readonly modelConfig: AgentModelConfig
}

/**
 * Agent routing rule for node-to-agent mapping
 */
export interface AgentRoutingRule {
  /** Regular expression pattern to match node types */
  readonly nodePattern: RegExp
  /** Category classification for the node type */
  readonly category: string
  /** Primary agent recommended for this node type */
  readonly primaryAgent: string
  /** Optional secondary agent for validation or collaboration */
  readonly secondaryAgent?: string
  /** Complexity level determining collaboration patterns */
  readonly complexity: 'low' | 'medium' | 'high' | 'expert'
}

/**
 * Agent collaboration pattern definitions
 */
export interface CollaborationPattern {
  /** Agent responsible for information gathering */
  readonly gatheringAgent: string
  /** Agent responsible for decision making */
  readonly decisionAgent: string
  /** Optional agent for execution phase */
  readonly executionAgent?: string
  /** Type of collaboration workflow */
  readonly pattern: 'gather-decide' | 'gather-decide-execute' | 'multi-specialist' | 'validation-chain'
}

/**
 * System-wide agent statistics and metrics
 */
export interface AgentSystemSummary {
  /** Total number of agents in the hierarchy */
  readonly totalAgents: number
  /** Combined concurrent task capacity */
  readonly totalCapacity: number
  /** Average capacity per agent */
  readonly averageCapacity: number
  /** Distribution of agents by Claude model */
  readonly modelDistribution: Record<ClaudeModel, number>
  /** Distribution of agents by tier */
  readonly tierDistribution: Record<string, number>
}

/**
 * Task complexity levels for routing and collaboration
 */
export type TaskComplexity = 'low' | 'medium' | 'high' | 'expert'

/**
 * Agent load balancing information
 */
export interface AgentLoadInfo {
  /** Agent identifier */
  readonly agentName: string
  /** Current active tasks */
  readonly currentLoad: number
  /** Maximum capacity */
  readonly maxCapacity: number
  /** Load percentage (0-1) */
  readonly loadPercentage: number
  /** Average response time in milliseconds */
  readonly avgResponseTime: number
}