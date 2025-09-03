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

  /**
   * Discover new nodes using multiple strategies
   */
  async discoverNewNodes(): Promise<DiscoveryStats & { newNodes: string[] }> {
    const startTime = Date.now()
    logger.info('🔍 Starting enhanced new node discovery...')

    const newNodes = new Set<string>()
    const stats: DiscoveryStats & { newNodes: string[] } = {
      nodesDiscovered: 0,
      standardNodes: 0,
      communityNodes: 0,
      customNodes: 0,
      totalValidated: 0,
      discoveryTime: 0,
      newNodes: [],
    }

    try {
      // Strategy 1: Analyze existing workflows (highest priority)
      logger.info('Strategy 1: Analyzing existing workflows...')
      const workflowNodes = await this.analyzeExistingWorkflows()
      workflowNodes.forEach(node => newNodes.add(node))
      logger.info(`Found ${workflowNodes.length} nodes from workflow analysis`)

      // Strategy 2: Pattern-based discovery
      logger.info('Strategy 2: Pattern-based node discovery...')
      const patternNodes = await this.scanForNewNodePatterns()
      patternNodes.forEach(node => newNodes.add(node))
      logger.info(`Found ${patternNodes.length} nodes from pattern scanning`)

      // Strategy 3: Community package scanning
      logger.info('Strategy 3: Community package scanning...')
      const communityNodes = await this.scanCommunityPackages()
      communityNodes.forEach(node => newNodes.add(node))
      logger.info(`Found ${communityNodes.length} nodes from community packages`)

      // Filter out already known nodes
      const currentKnownNodes = this.getCurrentKnownNodes()
      const trulyNewNodes = Array.from(newNodes).filter(node => !currentKnownNodes.has(node))

      logger.info(`Discovered ${trulyNewNodes.length} truly new nodes`)

      // Validate and store new nodes
      // Validate nodes in parallel for better performance
      const validationPromises = trulyNewNodes.map(async (nodeType) => {
        try {
          if (await this.validateSingleNode(nodeType)) {
            const nodeInfo = await this.extractNodeInfo(nodeType)
            this.discoveredNodes.set(nodeType, nodeInfo)
            this.storeNode(nodeType, nodeInfo)
            logger.info(`✅ Validated and stored new node: ${nodeType}`)
            return { nodeType, success: true }
          }
          else {
            logger.debug(`❌ Failed to validate node: ${nodeType}`)
            return { nodeType, success: false }
          }
        }
        catch (error) {
          logger.debug(`Error validating node ${nodeType}:`, error)
          return { nodeType, success: false }
        }
      })

      const validationResults = await Promise.all(validationPromises)
      const validatedCount = validationResults.filter(result => result.success).length

      stats.discoveryTime = Date.now() - startTime
      stats.nodesDiscovered = newNodes.size
      stats.totalValidated = validatedCount
      stats.newNodes = trulyNewNodes

      logger.info(`✅ Enhanced discovery complete:`, {
        totalFoundNodes: newNodes.size,
        newNodesFound: trulyNewNodes.length,
        validatedNodes: validatedCount,
        discoveryTime: `${stats.discoveryTime}ms`,
      })

      return stats
    }
    catch (error) {
      logger.error('❌ Enhanced discovery failed:', error)
      throw error
    }
  }

  /**
   * Analyze existing workflows to discover node types in use
   */
  private async analyzeExistingWorkflows(): Promise<string[]> {
    const discoveredNodes: string[] = []

    try {
      // Get all workflows
      const response = await fetch(`${this.baseUrl}/workflows`, {
        headers: this.headers,
      })

      if (!response.ok) {
        logger.warn(`Failed to fetch workflows: ${response.status}`)
        return discoveredNodes
      }

      const workflowsData = await response.json() as { data?: { id: string }[] }
      const workflows = workflowsData.data || []

      logger.info(`Analyzing ${workflows.length} workflows for node types...`)

      // Process workflows in batches to avoid overwhelming the API
      const batchSize = 10
      for (let i = 0; i < workflows.length; i += batchSize) {
        const batch = workflows.slice(i, i + batchSize)

        const batchPromises = batch.map(async (workflow) => {
          try {
            const workflowResponse = await fetch(`${this.baseUrl}/workflows/${workflow.id}`, {
              headers: this.headers,
            })

            if (workflowResponse.ok) {
              const workflowData = await workflowResponse.json() as { data?: { nodes?: { type: string }[] } }
              const nodes = workflowData.data?.nodes || []

              return nodes.map(node => node.type).filter(type => type && typeof type === 'string')
            }
          }
          catch (error) {
            logger.debug(`Failed to analyze workflow ${workflow.id}:`, error)
          }
          return []
        })

        const batchResults = await Promise.all(batchPromises)
        const batchNodes = batchResults.flat()
        discoveredNodes.push(...batchNodes)

        // Small delay between batches
        if (i + batchSize < workflows.length) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 100)
          })
        }
      }

      // Remove duplicates and return unique node types
      const uniqueNodes = [...new Set(discoveredNodes)]
      logger.info(`Extracted ${uniqueNodes.length} unique node types from workflows`)
      return uniqueNodes
    }
    catch (error) {
      logger.error('Failed to analyze workflows:', error)
      return discoveredNodes
    }
  }

  /**
   * Scan for new nodes using common naming patterns
   */
  private async scanForNewNodePatterns(): Promise<string[]> {
    const discoveredNodes: string[] = []

    const commonPrefixes = [
      'n8n-nodes-base',
      '@n8n/n8n-nodes-langchain',
      'n8n-nodes-langchain',
    ]

    const commonNodeNames = [
      // AI/LLM nodes
      'openai',
      'anthropic',
      'claude',
      'gemini',
      'ollama',
      'cohere',
      'huggingface',
      'mistral',
      'perplexity',
      'groq',
      'replicate',
      'vertex',
      'bedrock',

      // Database nodes
      'postgres',
      'mysql',
      'mongodb',
      'redis',
      'elasticsearch',
      'neo4j',
      'cassandra',
      'dynamodb',
      'firestore',
      'supabase',
      'planetscale',

      // Communication nodes
      'slack',
      'discord',
      'teams',
      'telegram',
      'whatsapp',
      'signal',
      'zoom',
      'webex',
      'meet',
      'skype',

      // Productivity nodes
      'notion',
      'airtable',
      'monday',
      'asana',
      'trello',
      'jira',
      'confluence',
      'linear',
      'height',
      'clickup',

      // Cloud services
      'aws',
      'gcp',
      'azure',
      'vercel',
      'netlify',
      'cloudflare',
      'digitalocean',
      'heroku',
      'railway',
      'fly',

      // Development tools
      'github',
      'gitlab',
      'bitbucket',
      'docker',
      'kubernetes',
      'jenkins',
      'circleci',
      'travis',
      'buildkite',
    ]

    logger.info(`Testing ${commonPrefixes.length * commonNodeNames.length} potential node combinations...`)

    // Generate all node type combinations
    const nodeTypesToTest: string[] = []
    for (const prefix of commonPrefixes) {
      for (const name of commonNodeNames) {
        nodeTypesToTest.push(`${prefix}.${name}`)
      }
    }

    // Test in batches with rate limiting for better performance
    const batchSize = 10
    let testedCount = 0

    for (let i = 0; i < nodeTypesToTest.length; i += batchSize) {
      const batch = nodeTypesToTest.slice(i, i + batchSize)

      // Process batch in parallel
      const batchPromises = batch.map(async (nodeType) => {
        try {
          if (await this.testNodeExists(nodeType)) {
            logger.info(`✅ Pattern discovery found: ${nodeType}`)
            return nodeType
          }
        }
        catch (error) {
          logger.debug(`Pattern test failed for ${nodeType}:`, error)
        }
        return null
      })

      const batchResults = await Promise.all(batchPromises)
      const foundNodes = batchResults.filter((node): node is string => node !== null)
      discoveredNodes.push(...foundNodes)

      testedCount += batch.length

      // Rate limiting: delay between batches
      if (i + batchSize < nodeTypesToTest.length) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 50)
        })
      }
    }

    logger.info(`Pattern scanning tested ${testedCount} combinations, found ${discoveredNodes.length} nodes`)
    return discoveredNodes
  }

  /**
   * Scan npm registry for new community packages
   */
  private async scanCommunityPackages(): Promise<string[]> {
    const discoveredNodes: string[] = []

    try {
      // Search npm registry for n8n community packages
      const searchUrl = 'https://registry.npmjs.org/-/v1/search?text=n8n-nodes-&size=250'
      const response = await fetch(searchUrl)

      if (!response.ok) {
        logger.warn('Failed to search npm registry for community packages')
        return discoveredNodes
      }

      const searchData = await response.json() as {
        objects?: Array<{ package: { name: string, version: string } }>
      }

      const packages = searchData.objects || []
      const communityPackages = packages
        .filter(pkg => pkg.package.name.startsWith('n8n-nodes-')
          || (pkg.package.name.includes('@') && pkg.package.name.includes('n8n-nodes')))
        .map(pkg => pkg.package.name)

      logger.info(`Found ${communityPackages.length} community packages to test`)

      // Test packages in batches for better performance
      const packagesToTest = communityPackages.slice(0, 50) // Limit to prevent overwhelming
      const batchSize = 5

      for (let i = 0; i < packagesToTest.length; i += batchSize) {
        const batch = packagesToTest.slice(i, i + batchSize)

        const batchPromises = batch.map(async (packageName) => {
          try {
            return await this.testCommunityPackage(packageName)
          }
          catch (error) {
            logger.debug(`Failed to test community package ${packageName}:`, error)
            return []
          }
        })

        const batchResults = await Promise.all(batchPromises)
        const batchNodes = batchResults.flat()
        discoveredNodes.push(...batchNodes)
      }
    }
    catch (error) {
      logger.error('Failed to scan community packages:', error)
    }

    return discoveredNodes
  }

  /**
   * Test if a node type exists by creating a test workflow
   */
  private async testNodeExists(nodeType: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/workflows`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          name: `Test Node Discovery ${Date.now()}`,
          settings: {},
          nodes: [{
            id: 'test',
            name: 'Test Node',
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
    catch (error) {
      logger.debug(`Test node exists failed for ${nodeType}:`, error)
      return false
    }
  }

  /**
   * Test community package for common node patterns
   */
  private async testCommunityPackage(packageName: string): Promise<string[]> {
    const discoveredNodes: string[] = []

    // Common node name patterns for community packages
    const commonNames = ['main', 'api', 'trigger', 'webhook', packageName.split('-').pop() || '']

    // Test all patterns in parallel for better performance
    const testPromises = commonNames.map(async (name) => {
      const nodeType = `${packageName}.${name}`
      try {
        if (await this.testNodeExists(nodeType)) {
          return nodeType
        }
      }
      catch (error) {
        logger.debug(`Community package test failed for ${nodeType}:`, error)
      }
      return null
    })

    const results = await Promise.all(testPromises)
    const foundNodes = results.filter((node): node is string => node !== null)
    discoveredNodes.push(...foundNodes)

    return discoveredNodes
  }

  /**
   * Get set of currently known nodes
   */
  private getCurrentKnownNodes(): Set<string> {
    const knownNodes = new Set<string>()

    // Add static nodes with prefix
    ComprehensiveNodeDiscovery.STANDARD_N8N_NODES.forEach((node) => {
      knownNodes.add(`n8n-nodes-base.${node}`)
    })

    // Add already discovered nodes
    this.discoveredNodes.forEach((_, nodeType) => {
      knownNodes.add(nodeType)
    })

    return knownNodes
  }

  /**
   * Extract node information for newly discovered nodes
   */
  private async extractNodeInfo(nodeType: string): Promise<NodeTypeInfo> {
    // Create basic node info structure for discovered nodes
    const nodeInfo: NodeTypeInfo = {
      name: nodeType,
      displayName: this.formatDisplayName(nodeType.split('.').pop() || nodeType),
      description: `Discovered node: ${nodeType}`,
      group: this.categorizeNode(nodeType),
      version: [1],
      inputs: ['main'],
      outputs: ['main'],
      properties: [],
    }

    return nodeInfo
  }

  /**
   * Categorize node based on its type and naming patterns
   */
  private categorizeNode(nodeType: string): string[] {
    if (nodeType.includes('langchain') || nodeType.includes('openai')
      || nodeType.includes('anthropic') || nodeType.includes('gemini')) {
      return ['ai', 'community']
    }

    if (nodeType.includes('trigger') || nodeType.includes('webhook')) {
      return ['trigger', 'community']
    }

    if (nodeType.startsWith('n8n-nodes-base')) {
      return ['standard']
    }

    return ['community']
  }
}
