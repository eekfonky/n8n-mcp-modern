/**
 * Dynamic Node Count Manager
 *
 * Replaces hardcoded node count references (525+, 737+, etc.) with dynamic values
 * based on actual discovery results from n8n instances.
 */

import { database } from '../database/index.js'
import { ALL_N8N_NODES } from '../discovery/all-n8n-nodes.js'
import { logger } from '../server/logger.js'

interface NodeCountStats {
  discoveredNodes: number
  standardNodes: number
  communityNodes: number
  totalAvailableNodes: number
  lastUpdated: Date
}

export class DynamicNodeCountManager {
  private static instance: DynamicNodeCountManager
  private cachedStats: NodeCountStats | null = null
  private readonly cacheExpiration = 10 * 60 * 1000 // 10 minutes

  private constructor() {}

  static getInstance(): DynamicNodeCountManager {
    if (!DynamicNodeCountManager.instance) {
      DynamicNodeCountManager.instance = new DynamicNodeCountManager()
    }
    return DynamicNodeCountManager.instance
  }

  /**
   * Get the current node count statistics
   */
  async getNodeCountStats(): Promise<NodeCountStats> {
    // Check cache first
    if (this.cachedStats && this.isCacheValid()) {
      return this.cachedStats
    }

    // Get statistics from database
    const stats = await this.queryNodeCountStats()
    this.cachedStats = stats

    return stats
  }

  /**
   * Get dynamic node count string for documentation (e.g., "525+", "750+")
   */
  async getDynamicNodeCountString(): Promise<string> {
    const stats = await this.getNodeCountStats()

    // Use the higher of discovered nodes or static nodes, rounded down to nearest 25
    const baseCount = Math.max(stats.discoveredNodes, stats.standardNodes)
    const roundedCount = Math.floor(baseCount / 25) * 25

    return `${roundedCount}+`
  }

  /**
   * Get formatted node count for display
   */
  async getFormattedNodeCount(): Promise<string> {
    const stats = await this.getNodeCountStats()

    if (stats.discoveredNodes > stats.standardNodes) {
      return `${stats.discoveredNodes} discovered nodes (${stats.standardNodes} standard + ${stats.communityNodes} community)`
    }
    else {
      return `${stats.standardNodes} standard nodes (${stats.communityNodes} community nodes available)`
    }
  }

  /**
   * Replace node count references in text with dynamic values
   */
  async replaceNodeCountReferences(text: string): Promise<string> {
    const nodeCountString = await getDynamicNodeCountString()

    // Replace various hardcoded patterns
    return text
      .replace(/\b(?:525|682|737)\+/g, nodeCountString)
      .replace(/\b(?:525|682|737)\+ nodes/g, `${nodeCountString} nodes`)
      .replace(/\b(?:525|682|737)\+ n8n nodes/g, `${nodeCountString} n8n nodes`)
  }

  /**
   * Invalidate cache to force refresh on next request
   */
  invalidateCache(): void {
    this.cachedStats = null
  }

  private async queryNodeCountStats(): Promise<NodeCountStats> {
    try {
      // Get statistics from discovery database
      const discoveryStats = database.getDiscoveryStats()

      // Get instance statistics
      const instanceStats = await database.executeCustomSQL('get-node-counts', (db) => {
        const stmt = db.prepare(`
          SELECT 
            SUM(official_node_count) as total_official,
            SUM(community_node_count) as total_community,
            COUNT(*) as instance_count,
            MAX(updated_at) as last_update
          FROM n8n_instances 
          WHERE status = 'active'
        `)
        return stmt.get() as {
          total_official: number
          total_community: number
          instance_count: number
          last_update: string
        } | undefined
      })

      const standardNodes = ALL_N8N_NODES.length
      const discoveredNodes = discoveryStats.totalNodesDiscovered || 0
      const communityNodes = instanceStats?.total_community || 0

      const stats: NodeCountStats = {
        discoveredNodes: Math.max(discoveredNodes, standardNodes),
        standardNodes,
        communityNodes,
        totalAvailableNodes: standardNodes + communityNodes,
        lastUpdated: new Date(instanceStats?.last_update || Date.now()),
      }

      logger.debug('Node count statistics updated', {
        discoveredNodes: stats.discoveredNodes,
        standardNodes: stats.standardNodes,
        communityNodes: stats.communityNodes,
        totalAvailable: stats.totalAvailableNodes,
      })

      return stats
    }
    catch (error) {
      logger.warn('Failed to get dynamic node count, falling back to static count', { error })

      // Fallback to static count
      return {
        discoveredNodes: ALL_N8N_NODES.length,
        standardNodes: ALL_N8N_NODES.length,
        communityNodes: 0,
        totalAvailableNodes: ALL_N8N_NODES.length,
        lastUpdated: new Date(),
      }
    }
  }

  private isCacheValid(): boolean {
    if (!this.cachedStats)
      return false

    const age = Date.now() - this.cachedStats.lastUpdated.getTime()
    return age < this.cacheExpiration
  }
}

// Export singleton instance and helper functions
export const nodeCountManager = DynamicNodeCountManager.getInstance()

/**
 * Get dynamic node count string (e.g., "525+")
 */
export async function getDynamicNodeCountString(): Promise<string> {
  return nodeCountManager.getDynamicNodeCountString()
}

/**
 * Get formatted node count for display
 */
export async function getFormattedNodeCount(): Promise<string> {
  return nodeCountManager.getFormattedNodeCount()
}

/**
 * Replace node count references in text with dynamic values
 */
export async function replaceNodeCountReferences(text: string): Promise<string> {
  return nodeCountManager.replaceNodeCountReferences(text)
}

/**
 * Invalidate node count cache
 */
export function invalidateNodeCountCache(): void {
  nodeCountManager.invalidateCache()
}
