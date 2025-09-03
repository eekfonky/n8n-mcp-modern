/**
 * Intelligent agent routing system for n8n-MCP Modern
 * High-performance routing with caching and load balancing
 */

import type { AgentLoadInfo, AgentRoutingRule, TaskComplexity } from './types.js'

/**
 * Optimized routing rules with performance caching
 */
export const AGENT_ROUTING_RULES: readonly AgentRoutingRule[] = [
  // Database and Data Processing
  { nodePattern: /^(postgres|mysql|mongo|redis|elastic|sql|database|table|query)/, category: 'database', primaryAgent: 'n8n-data', complexity: 'medium' },
  { nodePattern: /^(aggregate|transform|split|merge|sort|filter|etl)/, category: 'data-processing', primaryAgent: 'n8n-data', complexity: 'low' },

  // Cloud Services
  { nodePattern: /^(aws|google|azure|s3|lambda|cloud|serverless|function|storage|compute|kubernetes)/, category: 'cloud', primaryAgent: 'n8n-cloud', complexity: 'high' },

  // E-commerce
  { nodePattern: /^(shopify|woocommerce|magento|prestashop|order|product|inventory|catalog|cart)/, category: 'ecommerce', primaryAgent: 'n8n-ecommerce', complexity: 'medium' },

  // Finance and Payments
  { nodePattern: /^(stripe|paypal|square|payment|invoice|tax|accounting|quickbooks|xero|banking|financial|transaction)/, category: 'finance', primaryAgent: 'n8n-finance', complexity: 'medium' },

  // Communication and Messaging
  { nodePattern: /^(slack|discord|teams|telegram|whatsapp|email|sms|notification|message|chat|social|twitter|facebook|linkedin)/, category: 'communication', primaryAgent: 'n8n-communication', complexity: 'low' },

  // AI and Machine Learning
  { nodePattern: /^(openai|anthropic|hugging|tensorflow|pytorch|ai|ml|gpt|claude|model|predict|classify|embedding|vector|semantic)/, category: 'ai', primaryAgent: 'n8n-ai', complexity: 'expert' },

  // IoT and Automation
  { nodePattern: /^(mqtt|home|assistant|philips|hue|smart|iot|sensor|device|arduino|raspberry|automation|control|monitor)/, category: 'automation', primaryAgent: 'n8n-automation', complexity: 'medium' },

  // File and Document Operations
  { nodePattern: /^(file|upload|download|document|pdf|csv|excel|template|pattern)/, category: 'workflow', primaryAgent: 'n8n-workflow', complexity: 'medium' },

  // Authentication and Security
  { nodePattern: /^(auth|oauth|credential|token|security|ssl|certificate)/, category: 'security', primaryAgent: 'n8n-connector', secondaryAgent: 'n8n-scriptguard', complexity: 'high' },

  // Code and Scripting
  { nodePattern: /^(code|function|script|javascript|eval)/, category: 'code', primaryAgent: 'n8n-builder', secondaryAgent: 'n8n-scriptguard', complexity: 'medium' },

  // Architecture and Performance
  { nodePattern: /^(trigger|webhook|schedule|execute|performance|optimize|cache|memory|cpu)/, category: 'architecture', primaryAgent: 'n8n-architect', secondaryAgent: 'n8n-performance', complexity: 'high' },

  // Integration and APIs
  { nodePattern: /^(integration|sync|api|webhook|middleware|http|rest|graphql)/, category: 'integration', primaryAgent: 'n8n-workflow', secondaryAgent: 'n8n-architect', complexity: 'high' },

  // Default fallback
  { nodePattern: /.*/, category: 'general', primaryAgent: 'n8n-guide', complexity: 'low' },
] as const

/**
 * High-performance routing cache with LRU eviction
 * Optimized for 675+ node ecosystem with enhanced TTL and cache size
 */
class RoutingCache {
  private cache = new Map<string, { agent: string, timestamp: number }>()
  private readonly maxSize = 1500 // Increased for 675+ nodes
  private readonly ttl = 5 * 60 * 1000 // 5 minute TTL for better performance

  get(nodeType: string): string | null {
    const entry = this.cache.get(nodeType)
    if (!entry)
      return null

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(nodeType)
      return null
    }

    return entry.agent
  }

  set(nodeType: string, agent: string): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (LRU eviction)
      const firstKey = this.cache.keys().next().value
      if (firstKey)
        this.cache.delete(firstKey)
    }

    this.cache.set(nodeType, { agent, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }

  getStats(): { size: number, hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need hit/miss counters for actual implementation
    }
  }
}

/**
 * Load balancer for agents with performance tracking
 */
class AgentLoadBalancer {
  private agentLoads = new Map<string, AgentLoadInfo>()

  getAgentLoad(agentName: string): AgentLoadInfo | null {
    return this.agentLoads.get(agentName) || null
  }

  recordAgentLoad(agentName: string): void {
    const current = this.agentLoads.get(agentName)
    if (current) {
      this.agentLoads.set(agentName, {
        ...current,
        currentLoad: current.currentLoad + 1,
      })
    }
  }

  getActiveAgentsCount(): number {
    return this.agentLoads.size
  }

  getTotalCapacity(): number {
    let totalCapacity = 0
    for (const [, loadInfo] of this.agentLoads) {
      totalCapacity += loadInfo.maxCapacity
    }
    return totalCapacity
  }

  updateAgentLoad(agentName: string, currentLoad: number, maxCapacity: number, avgResponseTime: number): void {
    this.agentLoads.set(agentName, {
      agentName,
      currentLoad,
      maxCapacity,
      loadPercentage: currentLoad / maxCapacity,
      avgResponseTime,
    })
  }

  selectLeastLoadedAgent(primaryAgent: string, secondaryAgent?: string): string {
    const primaryLoad = this.getAgentLoad(primaryAgent)
    const secondaryLoad = secondaryAgent ? this.getAgentLoad(secondaryAgent) : null

    if (!primaryLoad && !secondaryLoad)
      return primaryAgent
    if (!primaryLoad)
      return primaryAgent
    if (!secondaryLoad)
      return primaryAgent

    // Select agent with lower load percentage and better response time
    const primaryScore = primaryLoad.loadPercentage + (primaryLoad.avgResponseTime / 10000)
    const secondaryScore = secondaryLoad.loadPercentage + (secondaryLoad.avgResponseTime / 10000)

    return primaryScore <= secondaryScore ? primaryAgent : (secondaryAgent ?? primaryAgent)
  }
}

// Global instances
const routingCache = new RoutingCache()
const loadBalancer = new AgentLoadBalancer()

/**
 * Get the optimal agent for a given node type with intelligent load balancing
 */
export function getOptimalAgent(nodeType: string, complexity?: TaskComplexity): string {
  // Check cache first
  const cachedAgent = routingCache.get(nodeType)
  if (cachedAgent)
    return cachedAgent

  // Find matching routing rule
  for (const rule of AGENT_ROUTING_RULES) {
    if (rule.nodePattern.test(nodeType)) {
      let selectedAgent: string

      if (complexity === 'expert' || complexity === 'high') {
        // For complex tasks, prefer primary agent
        selectedAgent = rule.primaryAgent
      }
      else if (complexity === 'medium' && rule.secondaryAgent) {
        // For medium complexity, use load balancing
        selectedAgent = loadBalancer.selectLeastLoadedAgent(rule.primaryAgent, rule.secondaryAgent)
      }
      else {
        selectedAgent = rule.primaryAgent
      }

      // Cache the result
      routingCache.set(nodeType, selectedAgent)
      return selectedAgent
    }
  }

  // Default fallback
  const fallback = 'n8n-guide'
  routingCache.set(nodeType, fallback)
  return fallback
}

/**
 * Update agent load information for load balancing
 */
export function updateAgentLoad(
  agentName: string,
  currentLoad: number,
  maxCapacity: number,
  avgResponseTime: number,
): void {
  loadBalancer.updateAgentLoad(agentName, currentLoad, maxCapacity, avgResponseTime)
}

/**
 * Get agent load information
 */
export function getAgentLoadInfo(agentName: string): AgentLoadInfo | null {
  return loadBalancer.getAgentLoad(agentName)
}

/**
 * Clear routing cache (useful for testing or configuration changes)
 */
export function clearRoutingCache(): void {
  routingCache.clear()
}

/**
 * Get routing system performance statistics
 */
export function getRoutingStats(): {
  cacheStats: { size: number, hitRate: number }
  activeAgents: number
  totalLoadCapacity: number
} {
  const cacheStats = routingCache.getStats()
  const activeAgents = loadBalancer.getActiveAgentsCount()
  const totalCapacity = loadBalancer.getTotalCapacity()

  return {
    cacheStats,
    activeAgents,
    totalLoadCapacity: totalCapacity,
  }
}
