/**
 * Utility functions for agent system management and analysis
 * High-performance utilities with caching and optimization
 */

import type { AgentSpecialization, AgentSystemSummary, ClaudeModel } from './types.js'
import { AGENT_DEFINITIONS } from './agent-definitions.js'
import { CLAUDE_MODEL_TIERS } from './types.js'

/**
 * High-performance agent registry with O(1) lookups
 */
class AgentRegistry {
  private readonly agentMap = new Map<string, AgentSpecialization>()
  private readonly tierMap = new Map<number, AgentSpecialization[]>()
  private readonly domainMap = new Map<string, AgentSpecialization[]>()
  private initialized = false

  private initialize(): void {
    if (this.initialized)
      return

    // Build optimized lookup maps
    for (const agent of AGENT_DEFINITIONS) {
      this.agentMap.set(agent.name, agent)

      // Group by tier
      const tierAgents = this.tierMap.get(agent.tier) || []
      tierAgents.push(agent)
      this.tierMap.set(agent.tier, tierAgents)

      // Group by domains
      for (const domain of agent.domains) {
        const domainAgents = this.domainMap.get(domain) || []
        domainAgents.push(agent)
        this.domainMap.set(domain, domainAgents)
      }
    }

    this.initialized = true
  }

  getAgent(name: string): AgentSpecialization | undefined {
    this.initialize()
    return this.agentMap.get(name)
  }

  getAgentsByTier(tier: number): readonly AgentSpecialization[] {
    this.initialize()
    return this.tierMap.get(tier) || []
  }

  getAgentsByDomain(domain: string): readonly AgentSpecialization[] {
    this.initialize()
    return this.domainMap.get(domain) || []
  }

  getAllAgents(): readonly AgentSpecialization[] {
    return AGENT_DEFINITIONS
  }

  getStats(): {
    totalAgents: number
    tiersCount: number
    domainsCount: number
    averageCapacity: number
  } {
    this.initialize()
    const totalCapacity = AGENT_DEFINITIONS.reduce((sum, agent) => sum + agent.maxConcurrentTasks, 0)

    return {
      totalAgents: this.agentMap.size,
      tiersCount: this.tierMap.size,
      domainsCount: this.domainMap.size,
      averageCapacity: Math.round(totalCapacity / this.agentMap.size),
    }
  }
}

// Global registry instance
const agentRegistry = new AgentRegistry()

/**
 * Get agent by name with O(1) lookup performance
 */
export function getAgentByName(name: string): AgentSpecialization | undefined {
  return agentRegistry.getAgent(name)
}

/**
 * Get agents by tier with optimized lookup
 */
export function getAgentsByTier(tier: 1 | 2 | 3 | 4): readonly AgentSpecialization[] {
  return agentRegistry.getAgentsByTier(tier)
}

/**
 * Get agents by domain with optimized lookup
 */
export function getAgentsByDomain(domain: string): readonly AgentSpecialization[] {
  return agentRegistry.getAgentsByDomain(domain)
}

/**
 * Get the optimal model for an agent with fallback support
 */
export function getAgentModel(agentName: string, fallback: boolean = false): ClaudeModel {
  const agent = getAgentByName(agentName)
  if (!agent)
    return CLAUDE_MODEL_TIERS.SONNET

  return fallback && agent.modelConfig.fallbackModel
    ? agent.modelConfig.fallbackModel
    : agent.modelConfig.primaryModel
}

/**
 * Generate comprehensive system summary with performance optimization
 */
let cachedSummary: AgentSystemSummary | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function getAgentSummary(forceRefresh: boolean = false): AgentSystemSummary {
  const now = Date.now()

  if (!forceRefresh && cachedSummary && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSummary
  }

  const totalCapacity = AGENT_DEFINITIONS.reduce(
    (sum, agent) => sum + agent.maxConcurrentTasks,
    0,
  )

  const modelDistribution = AGENT_DEFINITIONS.reduce(
    (acc, agent) => {
      const model = agent.modelConfig.primaryModel
      acc[model] = (acc[model] || 0) + 1
      return acc
    },
    {} as Record<ClaudeModel, number>,
  )

  const tierDistribution = AGENT_DEFINITIONS.reduce(
    (acc, agent) => {
      acc[`tier${agent.tier}`] = (acc[`tier${agent.tier}`] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  cachedSummary = {
    totalAgents: AGENT_DEFINITIONS.length,
    totalCapacity,
    averageCapacity: Math.round(totalCapacity / AGENT_DEFINITIONS.length),
    modelDistribution,
    tierDistribution,
  }

  cacheTimestamp = now
  return cachedSummary
}

/**
 * Find agents with specific capabilities or expertise
 */
export function findAgentsByCapability(capability: string): readonly AgentSpecialization[] {
  return AGENT_DEFINITIONS.filter(agent =>
    agent.expertise.some(exp => exp.toLowerCase().includes(capability.toLowerCase()))
    || agent.specializedKnowledge.some(knowledge => knowledge.toLowerCase().includes(capability.toLowerCase())),
  )
}

/**
 * Find agents that can collaborate with a given agent
 */
export function findCollaborators(agentName: string): readonly AgentSpecialization[] {
  const agent = getAgentByName(agentName)
  if (!agent)
    return []

  return AGENT_DEFINITIONS.filter(a =>
    agent.collaboratesWith.includes(a.name)
    || a.collaboratesWith.includes(agentName),
  )
}

/**
 * Calculate system load distribution and balance
 */
export function calculateLoadDistribution(): {
  totalCapacity: number
  capacityByTier: Record<string, number>
  capacityByModel: Record<ClaudeModel, number>
  loadBalance: 'excellent' | 'good' | 'unbalanced'
} {
  const capacityByTier = AGENT_DEFINITIONS.reduce((acc, agent) => {
    const tier = `tier${agent.tier}`
    acc[tier] = (acc[tier] || 0) + agent.maxConcurrentTasks
    return acc
  }, {} as Record<string, number>)

  const capacityByModel = AGENT_DEFINITIONS.reduce((acc, agent) => {
    const model = agent.modelConfig.primaryModel
    acc[model] = (acc[model] || 0) + agent.maxConcurrentTasks
    return acc
  }, {} as Record<ClaudeModel, number>)

  const totalCapacity = Object.values(capacityByTier).reduce((sum, cap) => sum + cap, 0)

  // Calculate load balance based on variance in tier capacities
  const avgTierCapacity = totalCapacity / Object.keys(capacityByTier).length
  const variance = Object.values(capacityByTier).reduce(
    (sum, cap) => sum + (cap - avgTierCapacity) ** 2,
    0,
  ) / Object.keys(capacityByTier).length

  let loadBalance: 'excellent' | 'good' | 'unbalanced'
  if (variance < avgTierCapacity * 0.1)
    loadBalance = 'excellent'
  else if (variance < avgTierCapacity * 0.3)
    loadBalance = 'good'
  else loadBalance = 'unbalanced'

  return {
    totalCapacity,
    capacityByTier,
    capacityByModel,
    loadBalance,
  }
}

/**
 * Validate agent system integrity
 */
export function validateAgentSystem(): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for duplicate agent names
  const names = new Set<string>()
  for (const agent of AGENT_DEFINITIONS) {
    if (names.has(agent.name)) {
      errors.push(`Duplicate agent name: ${agent.name}`)
    }
    names.add(agent.name)
  }

  // Validate collaborations (all collaborators should exist)
  for (const agent of AGENT_DEFINITIONS) {
    for (const collaborator of agent.collaboratesWith) {
      if (!getAgentByName(collaborator)) {
        errors.push(`Agent ${agent.name} references non-existent collaborator: ${collaborator}`)
      }
    }
  }

  // Check for orphaned agents (agents with no collaborators and no one collaborates with them)
  for (const agent of AGENT_DEFINITIONS) {
    const hasCollaborators = agent.collaboratesWith.length > 0
    const isCollaborator = AGENT_DEFINITIONS.some(a =>
      a.collaboratesWith.includes(agent.name),
    )

    if (!hasCollaborators && !isCollaborator && agent.name !== 'n8n-orchestrator') {
      warnings.push(`Potentially orphaned agent: ${agent.name}`)
    }
  }

  // Validate tier distribution
  const tierCounts = AGENT_DEFINITIONS.reduce((acc, agent) => {
    acc[agent.tier] = (acc[agent.tier] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  if (!tierCounts[1] || tierCounts[1] !== 1) {
    errors.push('Should have exactly 1 Tier 1 (strategic) agent')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Get registry performance statistics
 */
export function getRegistryStats(): {
  registryStats: ReturnType<AgentRegistry['getStats']>
  cacheHits: number
  totalLookups: number
} {
  return {
    registryStats: agentRegistry.getStats(),
    cacheHits: 0, // Would track in real implementation
    totalLookups: 0, // Would track in real implementation
  }
}

/**
 * Clear all caches (useful for testing)
 */
export function clearUtilsCaches(): void {
  cachedSummary = null
  cacheTimestamp = 0
}
