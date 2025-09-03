/**
 * Optimized 15-Agent Hierarchy for n8n-MCP Modern
 * Modular architecture with focused, high-performance modules
 */

// Re-export agent definitions
export {
  AGENT_DEFINITIONS as OPTIMIZED_AGENT_HIERARCHY,
} from './agent-definitions.js'

// Re-export routing functionality
export {
  AGENT_ROUTING_RULES,
  clearRoutingCache,
  getAgentLoadInfo,
  getOptimalAgent,
  getRoutingStats,
  updateAgentLoad,
} from './agent-routing.js'

// Re-export utility functions
export {
  calculateLoadDistribution,
  clearUtilsCaches,
  findAgentsByCapability,
  findCollaborators,
  getAgentByName,
  getAgentModel,
  getAgentsByDomain,
  getAgentsByTier,
  getAgentSummary,
  getRegistryStats,
  validateAgentSystem,
} from './agent-utils.js'

// Re-export collaboration patterns
export {
  clearCollaborationCache,
  createErrorRecoveryPattern,
  createHighThroughputPattern,
  createMultiSpecialistPattern,
  createValidationChain,
  getCollaborationPattern,
  getCollaborationStats,
  getCollaborationSuggestions,
} from './collaboration-patterns.js'

// Re-export all types from centralized type definitions
export type {
  AgentLoadInfo,
  AgentModelConfig,
  AgentRoutingRule,
  AgentSpecialization,
  AgentSystemSummary,
  ClaudeModel,
  CollaborationPattern,
  TaskComplexity,
} from './types.js'

export {
  CLAUDE_MODEL_TIERS,
} from './types.js'
