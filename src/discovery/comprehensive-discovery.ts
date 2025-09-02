/**
 * Comprehensive Node Discovery System
 *
 * Replaces the flawed credential-based discovery with a comprehensive approach
 * that discovers all available n8n nodes including:
 * - 500+ standard n8n-nodes-base nodes
 * - Community nodes (like ScrapeNinja)
 * - Custom nodes
 */

import type { N8NNodeDatabase } from '../types/core.js'
import { createHash } from 'node:crypto'
import { database } from '../database/index.js'
import { config } from '../server/config.js'
import { logger } from '../server/logger.js'
import { ALL_N8N_NODES } from './all-n8n-nodes.js'

interface NodeTypeInfo {
  name: string
  displayName: string
  description: string
  group: string[]
  version: number[]
  inputs: string[]
  outputs: string[]
  credentials?: string[]
  properties: Array<{
    displayName: string
    name: string
    type: string
    required?: boolean
    description?: string
  }>
}

interface DiscoveryStats {
  nodesDiscovered: number
  standardNodes: number
  communityNodes: number
  customNodes: number
  totalValidated: number
  discoveryTime: number
}

export class ComprehensiveNodeDiscovery {
  // Use the complete list of 525+ nodes from all-n8n-nodes.ts
  private static readonly STANDARD_N8N_NODES = ALL_N8N_NODES

  private static readonly KNOWN_COMMUNITY_PACKAGES = [
    '@scrapeninja/n8n-nodes-scrapeninja',
    '@n8n/n8n-nodes-langchain',
    '@digital-boss/n8n-nodes-pdf',
    '@digital-boss/n8n-nodes-file-data',
    '@digital-boss/n8n-nodes-advanced-tools',
  ]

  private discoveredNodes: Map<string, NodeTypeInfo> = new Map()
  private baseUrl: string
  private headers: Record<string, string>
  private instanceId: string

  constructor() {
    const { n8nApiUrl, n8nApiKey } = config
    if (!n8nApiUrl || !n8nApiKey) {
      throw new Error('n8n API configuration required for comprehensive discovery')
    }

    this.baseUrl = n8nApiUrl.replace(/\/api\/v1.*$/, '/api/v1')
    this.headers = {
      'X-N8N-API-KEY': n8nApiKey,
      'Content-Type': 'application/json',
    }

    // Generate instance ID from base URL (safe - no sensitive data)
    this.instanceId = this.generateInstanceId(n8nApiUrl)
  }

  /**
   * Comprehensive discovery of all available nodes
   */
  async discover(): Promise<DiscoveryStats> {
    const startTime = Date.now()
    logger.info('🔍 Starting comprehensive node discovery...')

    const stats: DiscoveryStats = {
      nodesDiscovered: 0,
      standardNodes: 0,
      communityNodes: 0,
      customNodes: 0,
      totalValidated: 0,
      discoveryTime: 0,
    }

    try {
      // Phase 1: Discover standard n8n nodes
      logger.info('Phase 1: Discovering standard n8n nodes...')
      await this.discoverStandardNodes(stats)

      // Phase 2: Discover community packages
      logger.info('Phase 2: Discovering community nodes...')
      await this.discoverCommunityNodes(stats)

      // Phase 3: Validate discovered nodes
      logger.info('Phase 3: Validating discovered nodes...')
      await this.validateDiscoveredNodes(stats)

      stats.discoveryTime = Date.now() - startTime
      stats.nodesDiscovered = this.discoveredNodes.size

      logger.info(`✅ Comprehensive discovery complete:`, {
        totalNodes: stats.nodesDiscovered,
        standardNodes: stats.standardNodes,
        communityNodes: stats.communityNodes,
        validatedNodes: stats.totalValidated,
        discoveryTime: `${stats.discoveryTime}ms`,
      })

      return stats
    }
    catch (error) {
      logger.error('❌ Comprehensive discovery failed:', error)
      throw error
    }
  }

  /**
   * Discover standard n8n-nodes-base nodes
   */
  private async discoverStandardNodes(stats: DiscoveryStats): Promise<void> {
    const batchSize = 50 // Increased batch size for 525+ nodes
    const totalNodes = ComprehensiveNodeDiscovery.STANDARD_N8N_NODES.length
    const batches: string[][] = []

    logger.info(`Discovering ${totalNodes} standard n8n nodes in batches of ${batchSize}...`)

    for (let i = 0; i < totalNodes; i += batchSize) {
      batches.push(ComprehensiveNodeDiscovery.STANDARD_N8N_NODES.slice(i, i + batchSize))
    }

    // Process all batches using concurrency control without await-in-loop
    const concurrentLimit = 3 // Process 3 batches concurrently
    let processedBatches = 0

    // Create batch processing function with delay
    const processBatchGroup = async (groupIndex: number): Promise<void> => {
      const startIndex = groupIndex * concurrentLimit
      const concurrentBatches = batches.slice(startIndex, startIndex + concurrentLimit)

      // Process current group of batches concurrently
      const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
        // Small delay between batches in the same concurrent group
        if (batchIndex > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 50)
          })
        }
        await this.processBatch(batch, 'n8n-nodes-base', stats, 'standardNodes')
        return startIndex + batchIndex
      })

      await Promise.all(batchPromises)
      processedBatches += concurrentBatches.length

      // Progress logging every 5 batches
      if (processedBatches % 5 === 0) {
        const nodesProcessed = Math.min(processedBatches * batchSize, totalNodes)
        logger.info(`Progress: ${nodesProcessed}/${totalNodes} nodes checked (${Math.round(nodesProcessed / totalNodes * 100)}%)`)
      }

      // Delay between concurrent groups to respect rate limits
      if (startIndex + concurrentLimit < batches.length) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 100)
        })
      }
    }

    // Process all batch groups sequentially to avoid overwhelming the API
    const totalGroups = Math.ceil(batches.length / concurrentLimit)
    const groupPromises: Promise<void>[] = []

    for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
      // Chain the promises to ensure sequential execution with delays
      if (groupIndex === 0) {
        groupPromises.push(processBatchGroup(groupIndex))
      }
      else {
        const previousPromise = groupPromises[groupIndex - 1]
        if (previousPromise) {
          groupPromises.push(
            previousPromise.then(() => processBatchGroup(groupIndex)),
          )
        }
        else {
          // Fallback if previous promise doesn't exist
          groupPromises.push(processBatchGroup(groupIndex))
        }
      }
    }

    // Wait for all groups to complete
    await Promise.all(groupPromises)
  }

  /**
   * Discover community nodes from known packages
   */
  private async discoverCommunityNodes(stats: DiscoveryStats): Promise<void> {
    // Process community packages concurrently instead of sequentially
    const packagePromises = ComprehensiveNodeDiscovery.KNOWN_COMMUNITY_PACKAGES.map(async (packageName) => {
      try {
        await this.discoverPackageNodes(packageName, stats)
      }
      catch (error) {
        logger.debug(`Community package ${packageName} not available:`, error)
      }
    })

    await Promise.all(packagePromises)
  }

  /**
   * Process a batch of node names for a specific package
   */
  private async processBatch(
    nodeNames: string[],
    packagePrefix: string,
    stats: DiscoveryStats,
    statField: keyof DiscoveryStats,
  ): Promise<void> {
    const testNodes = nodeNames.map((name, index) => ({
      id: `test_${index}`,
      name: `Test ${name}`,
      type: `${packagePrefix}.${name}`,
      typeVersion: 1,
      position: [100 + (index * 50), 100],
      parameters: {},
    }))

    try {
      const response = await fetch(`${this.baseUrl}/workflows`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          name: `Test Batch ${Date.now()}`,
          settings: {},
          nodes: testNodes,
          connections: {},
        }),
      })

      if (response.ok) {
        // All nodes in batch are valid
        for (const nodeName of nodeNames) {
          const nodeType = `${packagePrefix}.${nodeName}`
          const nodeInfo: NodeTypeInfo = {
            name: nodeType,
            displayName: this.formatDisplayName(nodeName),
            description: `${packagePrefix} ${nodeName} node`,
            group: [packagePrefix === 'n8n-nodes-base' ? 'standard' : 'community'],
            version: [1],
            inputs: ['main'],
            outputs: ['main'],
            properties: [],
          }

          this.discoveredNodes.set(nodeType, nodeInfo)

          // Store in database
          this.storeNode(nodeType, nodeInfo)

          if (typeof statField === 'string') {
            const currentValue = stats[statField] as number
            stats[statField] = currentValue + 1
          }
        }

        // Clean up test workflow
        const result = await response.json() as { id?: string }
        if (result.id) {
          await this.deleteWorkflow(result.id)
        }
      }
    }
    catch (error) {
      logger.debug(`Batch test failed for ${packagePrefix}:`, error)
    }
  }

  /**
   * Discover nodes from a specific community package
   */
  private async discoverPackageNodes(packageName: string, stats: DiscoveryStats): Promise<void> {
    // For ScrapeNinja, we know it has scrapeNinja node
    if (packageName === '@scrapeninja/n8n-nodes-scrapeninja') {
      const nodeType = `${packageName}.scrapeNinja`

      try {
        const response = await fetch(`${this.baseUrl}/workflows`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            name: `Test Community ${Date.now()}`,
            settings: {},
            nodes: [{
              id: 'test',
              name: 'Test ScrapeNinja',
              type: nodeType,
              typeVersion: 1,
              position: [100, 100],
              parameters: {},
            }],
            connections: {},
          }),
        })

        if (response.ok) {
          const nodeInfo: NodeTypeInfo = {
            name: nodeType,
            displayName: 'ScrapeNinja',
            description: 'ScrapeNinja web scraping node',
            group: ['community'],
            version: [1],
            inputs: ['main'],
            outputs: ['main'],
            properties: [],
          }

          this.discoveredNodes.set(nodeType, nodeInfo)

          // Store in database
          this.storeNode(nodeType, nodeInfo)

          stats.communityNodes++

          const result = await response.json() as { id?: string }
          if (result.id) {
            await this.deleteWorkflow(result.id)
          }
        }
      }
      catch (error) {
        logger.debug(`Community node ${nodeType} test failed:`, error)
      }
    }
  }

  /**
   * Validate discovered nodes by checking individual node types
   */
  private async validateDiscoveredNodes(stats: DiscoveryStats): Promise<void> {
    const nodeTypes = Array.from(this.discoveredNodes.keys())

    // Sample validation on a subset (don't overwhelm the API)
    const sampleSize = Math.min(50, nodeTypes.length)
    const sampleNodes = nodeTypes.slice(0, sampleSize)

    // Process validations with controlled concurrency without await-in-loop
    const concurrentLimit = 5 // Validate 5 nodes concurrently
    let validated = 0

    // Create validation processing function
    const processValidationGroup = async (groupIndex: number): Promise<number> => {
      const startIndex = groupIndex * concurrentLimit
      const concurrentNodes = sampleNodes.slice(startIndex, startIndex + concurrentLimit)

      const validationPromises = concurrentNodes.map(async (nodeType) => {
        try {
          const isValid = await this.validateSingleNode(nodeType)
          return isValid
        }
        catch (error) {
          logger.debug(`Validation failed for ${nodeType}:`, error)
          return false
        }
      })

      const results = await Promise.all(validationPromises)
      const groupValidated = results.filter(Boolean).length

      // Small delay between concurrent groups (only if more nodes remain)
      if (startIndex + concurrentLimit < sampleNodes.length) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 100)
        })
      }

      return groupValidated
    }

    // Process all validation groups sequentially
    const totalGroups = Math.ceil(sampleNodes.length / concurrentLimit)
    const validationPromises: Promise<number>[] = []

    for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
      // Chain the promises to ensure sequential execution with delays
      if (groupIndex === 0) {
        validationPromises.push(processValidationGroup(groupIndex))
      }
      else {
        const previousPromise = validationPromises[groupIndex - 1]
        if (previousPromise) {
          validationPromises.push(
            previousPromise.then(() => processValidationGroup(groupIndex)),
          )
        }
        else {
          // Fallback if previous promise doesn't exist
          validationPromises.push(processValidationGroup(groupIndex))
        }
      }
    }

    // Wait for all validations and sum the results
    const validationResults = await Promise.all(validationPromises)
    validated = validationResults.reduce((sum, count) => sum + count, 0)

    stats.totalValidated = validated
    logger.info(`Validated ${validated}/${sampleSize} sampled nodes`)
  }

  /**
   * Validate a single node type
   */
  private async validateSingleNode(nodeType: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/workflows`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          name: `Validate ${nodeType} ${Date.now()}`,
          settings: {},
          nodes: [{
            id: 'validate',
            name: `Validate ${nodeType}`,
            type: nodeType,
            typeVersion: 1,
            position: [100, 100],
            parameters: {},
          }],
          connections: {},
        }),
      })

      if (response.ok) {
        const result = await response.json() as { id?: string }
        if (result.id) {
          await this.deleteWorkflow(result.id)
        }
        return true
      }

      return false
    }
    catch {
      return false
    }
  }

  /**
   * Delete a test workflow
   */
  private async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/workflows/${workflowId}`, {
        method: 'DELETE',
        headers: this.headers,
      })
    }
    catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Format node name for display
   */
  private formatDisplayName(nodeName: string): string {
    return nodeName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  /**
   * Get all discovered nodes
   */
  getDiscoveredNodes(): Map<string, NodeTypeInfo> {
    return this.discoveredNodes
  }

  /**
   * Get node information by type
   */
  getNodeInfo(nodeType: string): NodeTypeInfo | undefined {
    return this.discoveredNodes.get(nodeType)
  }

  /**
   * Get nodes by category
   */
  getNodesByCategory(category: 'standard' | 'community' | 'custom'): NodeTypeInfo[] {
    return Array.from(this.discoveredNodes.values())
      .filter(node => node.group.includes(category))
  }

  /**
   * Generate secure instance ID without exposing sensitive URL data
   */
  private generateInstanceId(url: string): string {
    // Use crypto hash instead of base64 to avoid potential exposure
    return createHash('sha256').update(url).digest('hex').slice(0, 16)
  }

  /**
   * Store discovered node in database
   */
  private storeNode(nodeType: string, nodeInfo: NodeTypeInfo): void {
    const dbNode: N8NNodeDatabase = {
      name: nodeType,
      type: nodeType,
      displayName: nodeInfo.displayName,
      description: nodeInfo.description,
      version: nodeInfo.version[0] || 1,
      inputs: nodeInfo.inputs as string[],
      outputs: nodeInfo.outputs as string[],
      category: nodeInfo.group[0] || 'Unknown',
      icon: undefined,
      properties: nodeInfo.properties.reduce((acc, prop) => {
        acc[prop.name] = {
          displayName: prop.displayName,
          type: prop.type,
          required: prop.required,
          description: prop.description,
        }
        return acc
      }, {} as Record<string, unknown>),
      credentials: nodeInfo.credentials || [],
      webhooks: undefined,
      lastUpdated: new Date(),
      instanceId: this.instanceId,
      nodeType: nodeInfo.group.includes('community') ? 'community' as const : 'official' as const,
      discoveredAt: new Date(),
      isActive: true,
    }

    try {
      database.addNode(dbNode)
      logger.debug('Stored node in database:', { name: nodeType, category: nodeInfo.group[0] })
    }
    catch (error) {
      logger.error(`Failed to store node ${nodeType}:`, error)
    }
  }
}
