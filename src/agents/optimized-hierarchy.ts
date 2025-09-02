/**
 * Optimized 15-Agent Hierarchy for n8n-MCP Modern
 * Modular architecture with focused, high-performance modules
 */

// Re-export all types from centralized type definitions
export type {
  ClaudeModel,
  AgentModelConfig,
  AgentSpecialization,
  AgentRoutingRule,
  CollaborationPattern,
  TaskComplexity,
  AgentLoadInfo,
  AgentSystemSummary
} from './types.js'

export {
  CLAUDE_MODEL_TIERS
} from './types.js'

// Re-export agent definitions
export {
  AGENT_DEFINITIONS as OPTIMIZED_AGENT_HIERARCHY
} from './agent-definitions.js'

// Re-export routing functionality
export {
  AGENT_ROUTING_RULES,
  getOptimalAgent,
  updateAgentLoad,
  getAgentLoadInfo,
  clearRoutingCache,
  getRoutingStats
} from './agent-routing.js'

// Re-export collaboration patterns
export {
  getCollaborationSuggestions,
  getCollaborationPattern,
  createValidationChain,
  createMultiSpecialistPattern,
  createHighThroughputPattern,
  createErrorRecoveryPattern,
  clearCollaborationCache,
  getCollaborationStats
} from './collaboration-patterns.js'

// Re-export utility functions
export {
  getAgentByName,
  getAgentsByTier,
  getAgentsByDomain,
  getAgentModel,
  getAgentSummary,
  findAgentsByCapability,
  findCollaborators,
  calculateLoadDistribution,
  validateAgentSystem,
  getRegistryStats,
  clearUtilsCaches
} from './agent-utils.js'
