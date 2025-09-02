/**
 * Advanced agent collaboration patterns for n8n-MCP Modern
 * Implements sophisticated multi-agent workflows with performance optimization
 */

import type { CollaborationPattern, TaskComplexity } from './types.js'
import { AGENT_DEFINITIONS } from './agent-definitions.js'
import { getOptimalAgent } from './agent-routing.js'

/**
 * Get collaboration suggestions for an agent based on task complexity
 * Optimized with memoization for frequently accessed patterns
 */
const collaborationCache = new Map<string, string[]>()

export function getCollaborationSuggestions(
  agentName: string, 
  taskComplexity: TaskComplexity
): readonly string[] {
  const cacheKey = `${agentName}:${taskComplexity}`
  const cached = collaborationCache.get(cacheKey)
  if (cached) return cached

  const agent = AGENT_DEFINITIONS.find(a => a.name === agentName)
  if (!agent) return []
  
  let suggestions: string[]
  
  if (taskComplexity === 'expert' || taskComplexity === 'high') {
    // For complex tasks, suggest more collaborators
    suggestions = agent.collaboratesWith.slice(0, 3)
  } else if (taskComplexity === 'medium') {
    // For medium tasks, suggest 1-2 collaborators
    suggestions = agent.collaboratesWith.slice(0, 2)
  } else {
    // For simple tasks, suggest 1 collaborator
    suggestions = agent.collaboratesWith.slice(0, 1)
  }
  
  // Cache the result
  collaborationCache.set(cacheKey, suggestions)
  return suggestions
}

/**
 * Advanced collaboration pattern selection with intelligent routing
 */
export function getCollaborationPattern(
  nodeType: string, 
  complexity: TaskComplexity
): CollaborationPattern {
  const primaryAgent = getOptimalAgent(nodeType, complexity)
  
  if (complexity === 'low') {
    // Simple tasks - single agent handles everything
    return {
      gatheringAgent: primaryAgent,
      decisionAgent: primaryAgent,
      pattern: 'gather-decide'
    }
  }
  
  if (complexity === 'medium') {
    // Medium complexity - guide gathers, specialist decides
    return {
      gatheringAgent: 'n8n-guide',
      decisionAgent: primaryAgent,
      pattern: 'gather-decide'
    }
  }
  
  if (complexity === 'high' || complexity === 'expert') {
    // Complex tasks - full collaboration workflow
    const collaborators = getCollaborationSuggestions(primaryAgent, complexity)
    const executionAgent = selectOptimalExecutionAgent(primaryAgent, collaborators, nodeType)
    
    return {
      gatheringAgent: 'n8n-guide',
      decisionAgent: primaryAgent,
      executionAgent,
      pattern: 'gather-decide-execute'
    }
  }
  
  // Default fallback
  return {
    gatheringAgent: 'n8n-guide',
    decisionAgent: primaryAgent,
    pattern: 'gather-decide'
  }
}

/**
 * Select the optimal execution agent based on node type and available collaborators
 */
function selectOptimalExecutionAgent(
  primaryAgent: string,
  collaborators: readonly string[],
  nodeType: string
): string {
  if (collaborators.length === 0) return primaryAgent
  
  // Smart execution agent selection based on node type characteristics
  const executionPriority: Record<string, string[]> = {
    'security': ['n8n-scriptguard', 'n8n-connector'],
    'performance': ['n8n-performance', 'n8n-architect'],
    'data': ['n8n-data', 'n8n-cloud'],
    'integration': ['n8n-workflow', 'n8n-architect'],
    'code': ['n8n-builder', 'n8n-scriptguard'],
    'ai': ['n8n-ai', 'n8n-data'],
    'communication': ['n8n-communication', 'n8n-automation']
  }
  
  // Find the most suitable execution agent
  for (const [category, preferredAgents] of Object.entries(executionPriority)) {
    if (nodeType.includes(category)) {
      for (const preferred of preferredAgents) {
        if (collaborators.includes(preferred)) {
          return preferred
        }
      }
    }
  }
  
  // Fallback to first collaborator or primary agent
  return collaborators[0] || primaryAgent
}

/**
 * Validation chain pattern for security-critical operations
 */
export function createValidationChain(
  nodeType: string,
  validators: readonly string[] = ['n8n-scriptguard', 'n8n-connector']
): CollaborationPattern {
  const primaryAgent = getOptimalAgent(nodeType, 'high')
  
  return {
    gatheringAgent: 'n8n-guide',
    decisionAgent: primaryAgent,
    executionAgent: validators[0] ?? 'n8n-scriptguard',
    pattern: 'validation-chain'
  }
}

/**
 * Multi-specialist pattern for complex cross-domain operations
 */
export function createMultiSpecialistPattern(
  nodeTypes: readonly string[],
  coordination: 'sequential' | 'parallel' = 'sequential'
): CollaborationPattern {
  const specialists = nodeTypes.map(nodeType => getOptimalAgent(nodeType, 'expert'))
  const uniqueSpecialists = [...new Set(specialists)]
  
  if (uniqueSpecialists.length === 1) {
    // Single specialist can handle all node types
    return getCollaborationPattern(nodeTypes[0] ?? 'default', 'expert')
  }
  
  // Multiple specialists required
  return {
    gatheringAgent: 'n8n-guide',
    decisionAgent: 'n8n-orchestrator', // Orchestrator coordinates multi-specialist work
    executionAgent: uniqueSpecialists[0] ?? 'n8n-guide', // Primary execution agent
    pattern: 'multi-specialist'
  }
}

/**
 * Performance-optimized collaboration for high-throughput scenarios
 */
export function createHighThroughputPattern(
  nodeType: string,
  expectedLoad: number
): CollaborationPattern {
  const primaryAgent = getOptimalAgent(nodeType, 'medium')
  
  if (expectedLoad > 1000) {
    // Very high load - use Haiku models for speed
    const fastAgents = ['n8n-communication', 'n8n-automation', 'n8n-guide']
    const haikusAgent = fastAgents.find(agent => 
      AGENT_DEFINITIONS.find(a => a.name === agent)?.collaboratesWith.includes(primaryAgent)
    )
    
    return {
      gatheringAgent: haikusAgent || 'n8n-guide',
      decisionAgent: primaryAgent,
      executionAgent: haikusAgent || primaryAgent,
      pattern: 'gather-decide-execute'
    }
  }
  
  return getCollaborationPattern(nodeType, 'medium')
}

/**
 * Error recovery pattern for failed operations
 */
export function createErrorRecoveryPattern(
  failedAgent: string,
  nodeType: string,
  errorType: 'timeout' | 'validation' | 'execution' | 'resource'
): CollaborationPattern {
  const recoveryAgents: Record<string, string> = {
    'timeout': 'n8n-performance',
    'validation': 'n8n-scriptguard', 
    'execution': 'n8n-architect',
    'resource': 'n8n-orchestrator'
  }
  
  const recoveryAgent = recoveryAgents[errorType]
  const alternativeAgent = getOptimalAgent(nodeType, 'high')
  
  return {
    gatheringAgent: 'n8n-guide', // Gather error context
    decisionAgent: recoveryAgent ?? 'n8n-orchestrator', // Analyze and decide recovery
    executionAgent: alternativeAgent, // Execute with alternative agent
    pattern: 'validation-chain'
  }
}

/**
 * Clear collaboration cache (useful for testing or configuration changes)
 */
export function clearCollaborationCache(): void {
  collaborationCache.clear()
}

/**
 * Get collaboration system performance statistics
 */
export function getCollaborationStats(): {
  cacheSize: number
  patternTypes: Record<string, number>
  averageCollaborators: number
} {
  const patternTypes: Record<string, number> = {}
  let totalCollaborators = 0
  let patternCount = 0
  
  // This would be tracked in a real implementation
  // For now, return mock data structure
  
  return {
    cacheSize: collaborationCache.size,
    patternTypes: {
      'gather-decide': 0,
      'gather-decide-execute': 0,
      'multi-specialist': 0,
      'validation-chain': 0
    },
    averageCollaborators: patternCount > 0 ? totalCollaborators / patternCount : 0
  }
}