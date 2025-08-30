/**
 * MCP Tool Generation Engine
 *
 * Phase 3: Generate 2000+ MCP tools from discovered n8n nodes with lazy loading
 *
 * Strategy:
 * 1. Generate multiple MCP tools per discovered node (general + operation-specific)
 * 2. Implement lazy loading to handle 2000+ tools efficiently
 * 3. Create tool schemas using discovered node metadata
 * 4. Integrate with 6-agent Claude Code system
 * 5. Provide memory-efficient tool management
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { MCPTool, N8NNodeDatabase } from '../types/core.js'
import { z } from 'zod'
import { database, VersionManager } from '../database/index.js'
import { logger } from '../server/logger.js'

/**
 * Generated MCP tool definition
 */
interface GeneratedTool {
  id: string
  name: string
  description: string
  inputSchema: z.ZodSchema
  outputSchema?: z.ZodSchema
  sourceNode: string | null
  toolType: 'general' | 'operation_specific' | 'category'
  operationName?: string
  category: string
  agentRecommendation?: string
  memoryFootprint: number
  lastUsed?: Date | undefined
}

/**
 * Tool generation statistics
 */
interface GenerationStats {
  nodesProcessed: number
  toolsGenerated: number
  generalTools: number
  operationTools: number
  categoryTools: number
  memoryUsed: number
  executionTime: number
  errors: number
  totalGenerated: number
  toolsWithOperations: number
}

/**
 * Lazy loading cache entry
 */
interface CacheEntry {
  tool: GeneratedTool
  schema: Tool
  loaded: boolean
  lastAccessed: Date
  accessCount: number
}

/**
 * MCP Tool Generator with Lazy Loading
 */
export class MCPToolGenerator {
  private versionManager: VersionManager
  private toolCache = new Map<string, CacheEntry>()
  private toolRegistry = new Map<string, GeneratedTool>()
  private categoryStats = new Map<string, number>()
  private maxCacheSize = 1000 // Maximum tools to keep in memory
  private cacheCleanupThreshold = 0.8 // Cleanup when 80% full

  // Common n8n operations that generate specific tools
  private readonly COMMON_OPERATIONS = [
    'create',
    'read',
    'update',
    'delete',
    'list',
    'get',
    'send',
    'search',
    'upload',
    'download',
    'execute',
    'trigger',
    'webhook',
    'poll',
  ]

  // Agent routing recommendations based on node categories
  private readonly AGENT_ROUTING: Record<string, string> = {
    'Data & Storage': 'n8n-node-expert', // Database operations need node expertise
    'Communication': 'n8n-builder', // Messaging workflows need builder
    'Development': 'n8n-scriptguard', // Code operations need security review
    'AI & Machine Learning': 'n8n-node-expert', // AI workflows need specialized knowledge
    'Authentication': 'n8n-connector', // Auth operations need connector expertise
    'Security': 'n8n-scriptguard', // Security operations need validation
    'Community': 'n8n-guide', // Community nodes may need documentation
    'Automation': 'n8n-orchestrator', // Complex automation needs orchestration
    'Finance': 'n8n-connector', // Payment systems need secure connections
    'Analytics': 'n8n-node-expert', // Data analysis needs node optimization
  }

  constructor() {
    this.versionManager = new VersionManager(database)
  }

  /**
   * Generate all MCP tools from discovered nodes
   */
  async generateAllTools(maxTools?: number): Promise<GenerationStats> {
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed

    const stats: GenerationStats = {
      nodesProcessed: 0,
      toolsGenerated: 0,
      generalTools: 0,
      operationTools: 0,
      categoryTools: 0,
      memoryUsed: 0,
      executionTime: 0,
      errors: 0,
      totalGenerated: 0,
      toolsWithOperations: 0,
    }

    try {
      logger.info('Starting MCP tool generation', { maxTools, phase: 3 })

      // Get all discovered nodes from database
      const nodes = database.getNodes()
      logger.info(`Found ${nodes.length} discovered nodes for tool generation`)

      // Debug: Log first few node names for verification
      if (nodes.length > 0) {
        logger.debug('Sample discovered nodes:', nodes.slice(0, 3).map(n => ({ name: n.name, category: n.category, type: n.nodeType })))
      }
      else {
        // Try to debug why no nodes are found
        logger.warn('No nodes found in database - debugging database state')
        const rawDb = database.rawDatabase
        if (rawDb) {
          try {
            const count = rawDb.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number }
            logger.warn(`Raw database query shows ${count.count} nodes in nodes table`)

            const sample = rawDb.prepare('SELECT name, display_name, category FROM nodes LIMIT 3').all()
            logger.warn('Sample raw nodes:', sample)
          }
          catch (error) {
            logger.error('Failed to query database directly:', error)
          }
        }
      }

      // Generate category tools first (one per category)
      const categories = [...new Set(nodes.map(node => node.category))]
      for (const category of categories) {
        try {
          const categoryTool = await this.generateCategoryTool(category, nodes.filter(n => n.category === category))
          this.registerTool(categoryTool)
          stats.categoryTools++
          stats.toolsGenerated++
          this.categoryStats.set(category, (this.categoryStats.get(category) || 0) + 1)
        }
        catch (error) {
          logger.debug(`Failed to generate category tool for ${category}:`, error)
          stats.errors++
        }
      }

      // Generate node-specific tools
      let processedNodes = 0
      for (const node of nodes) {
        try {
          // Stop if we've reached the maximum
          if (maxTools && stats.toolsGenerated >= maxTools) {
            logger.info(`Reached maximum tools limit: ${maxTools}`)
            break
          }

          // Generate general tool for the node
          const generalTool = await this.generateGeneralTool(node)
          this.registerTool(generalTool)
          stats.generalTools++
          stats.toolsGenerated++

          // Generate operation-specific tools
          const operations = this.extractNodeOperations(node)
          for (const operation of operations) {
            if (maxTools && stats.toolsGenerated >= maxTools)
              break

            try {
              const operationTool = await this.generateOperationTool(node, operation)
              this.registerTool(operationTool)
              stats.operationTools++
              stats.toolsGenerated++
            }
            catch (error) {
              logger.debug(`Failed to generate operation tool ${operation} for ${node.name}:`, error)
              stats.errors++
            }
          }

          stats.nodesProcessed++
          processedNodes++

          // Progress reporting
          if (processedNodes % 50 === 0) {
            logger.info('Tool generation progress', {
              nodesProcessed: processedNodes,
              toolsGenerated: stats.toolsGenerated,
              memoryUsage: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`,
            })
          }
        }
        catch (error) {
          logger.debug(`Failed to generate tools for node ${node.name}:`, error)
          stats.errors++
        }
      }

      // Store generated tools in database
      await this.persistGeneratedTools()

      stats.executionTime = Date.now() - startTime
      stats.memoryUsed = process.memoryUsage().heapUsed - startMemory
      stats.totalGenerated = stats.toolsGenerated + stats.categoryTools
      stats.toolsWithOperations = stats.operationTools

      logger.info('MCP tool generation completed', stats)

      return stats
    }
    catch (error) {
      logger.error('Tool generation failed:', error)
      stats.errors++
      throw error
    }
  }

  /**
   * Generate a general tool for a node
   */
  private async generateGeneralTool(node: N8NNodeDatabase): Promise<GeneratedTool> {
    const toolId = `${node.name.replace(/[^a-z0-9]/gi, '_')}_general`

    const inputSchema = z.object({
      nodeParameters: z.record(z.any()).describe('Node-specific parameters based on node properties'),
      inputData: z.any().optional().describe('Input data to process'),
      credentials: z.record(z.any()).optional().describe('Authentication credentials if required'),
    })

    const outputSchema = z.object({
      success: z.boolean(),
      data: z.any().optional(),
      nodeOutput: z.any().optional(),
      executionId: z.string().optional(),
      metadata: z.object({
        node: z.string(),
        operation: z.string(),
        timestamp: z.string(),
      }),
    })

    return {
      id: toolId,
      name: `${node.displayName} (General)`,
      description: `Execute ${node.displayName} with general parameters. ${node.description}`,
      inputSchema,
      outputSchema,
      sourceNode: node.name,
      toolType: 'general',
      category: node.category,
      agentRecommendation: this.AGENT_ROUTING[node.category] || 'n8n-guide',
      memoryFootprint: this.estimateMemoryFootprint(node),
      lastUsed: undefined as Date | undefined,
    }
  }

  /**
   * Generate an operation-specific tool
   */
  private async generateOperationTool(node: N8NNodeDatabase, operation: string): Promise<GeneratedTool> {
    const toolId = `${node.name.replace(/[^a-z0-9]/gi, '_')}_${operation}`

    const inputSchema = this.generateOperationSchema(node, operation)
    const outputSchema = this.generateOperationOutputSchema(operation)

    return {
      id: toolId,
      name: `${node.displayName} - ${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
      description: `${operation.charAt(0).toUpperCase() + operation.slice(1)} operation for ${node.displayName}. ${node.description}`,
      inputSchema,
      outputSchema,
      sourceNode: node.name,
      toolType: 'operation_specific',
      operationName: operation,
      category: node.category,
      agentRecommendation: this.getOperationAgentRecommendation(operation, node.category),
      memoryFootprint: this.estimateMemoryFootprint(node, operation),
      lastUsed: undefined as Date | undefined,
    }
  }

  /**
   * Generate a category tool (aggregates multiple nodes in a category)
   */
  private async generateCategoryTool(category: string, nodes: N8NNodeDatabase[]): Promise<GeneratedTool> {
    const toolId = `category_${category.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`

    const inputSchema = z.object({
      operation: z.enum(['list', 'search', 'recommend', 'compare'] as const).describe('Operation to perform on category'),
      query: z.string().optional().describe('Search query or criteria'),
      nodeFilter: z.array(z.string()).optional().describe('Specific nodes to include'),
      parameters: z.record(z.any()).optional().describe('Additional parameters'),
    })

    const outputSchema = z.object({
      success: z.boolean(),
      category: z.string(),
      nodeCount: z.number(),
      nodes: z.array(z.object({
        name: z.string(),
        displayName: z.string(),
        description: z.string(),
        available: z.boolean(),
      })),
      recommendations: z.array(z.string()).optional(),
      metadata: z.object({
        category: z.string(),
        totalNodes: z.number(),
        timestamp: z.string(),
      }),
    })

    return {
      id: toolId,
      name: `${category} - Category Operations`,
      description: `Manage and interact with all ${category} nodes. Includes ${nodes.length} nodes: ${nodes.slice(0, 3).map(n => n.displayName).join(', ')}${nodes.length > 3 ? '...' : ''}`,
      inputSchema,
      outputSchema,
      sourceNode: null, // Category tools don't belong to a specific node
      toolType: 'category',
      category,
      agentRecommendation: this.AGENT_ROUTING[category] || 'n8n-orchestrator',
      memoryFootprint: nodes.length * 100, // Estimate based on node count
      lastUsed: undefined as Date | undefined,
    }
  }

  /**
   * Extract operations from node properties
   */
  private extractNodeOperations(node: N8NNodeDatabase): string[] {
    const operations: string[] = []

    // Check node properties for operation hints
    const properties = node.properties || {}

    // Look for operation/resource/method properties
    for (const [key, value] of Object.entries(properties)) {
      if (key.toLowerCase().includes('operation')
        || key.toLowerCase().includes('resource')
        || key.toLowerCase().includes('method')) {
        if (typeof value === 'object' && value && 'options' in value) {
          const options = (value as any).options
          if (Array.isArray(options)) {
            operations.push(...options.map((opt: any) => opt.value || opt.name).filter(Boolean))
          }
        }
      }
    }

    // If no specific operations found, use common operations based on category
    if (operations.length === 0) {
      const categoryOperations = this.getCategoryOperations(node.category)
      operations.push(...categoryOperations)
    }

    // Limit to prevent too many tools per node
    return operations.slice(0, 5).filter(op => this.COMMON_OPERATIONS.includes(op.toLowerCase()))
  }

  /**
   * Get common operations for a category
   */
  private getCategoryOperations(category: string): string[] {
    const categoryOperationMap: Record<string, string[]> = {
      'Data & Storage': ['create', 'read', 'update', 'delete', 'list'],
      'Communication': ['send', 'read', 'list', 'create'],
      'Development': ['create', 'update', 'get', 'list', 'execute'],
      'AI & Machine Learning': ['execute', 'create', 'get'],
      'Marketing & Sales': ['create', 'update', 'get', 'list', 'send'],
      'Finance': ['create', 'get', 'list', 'update'],
      'Files & Documents': ['upload', 'download', 'read', 'create', 'delete'],
      'Community': ['execute', 'get', 'create'],
    }

    return categoryOperationMap[category] || ['get', 'create', 'execute']
  }

  /**
   * Generate operation-specific input schema
   */
  private generateOperationSchema(node: N8NNodeDatabase, operation: string): z.ZodSchema {
    const baseSchema = {
      credentials: z.record(z.any()).optional().describe('Authentication credentials'),
    }

    // Operation-specific parameters
    switch (operation.toLowerCase()) {
      case 'create':
        return z.object({
          ...baseSchema,
          data: z.record(z.any()).describe('Data to create'),
          options: z.record(z.any()).optional().describe('Creation options'),
        })

      case 'read':
      case 'get':
        return z.object({
          ...baseSchema,
          id: z.union([z.string(), z.number()]).optional().describe('Resource ID to read'),
          query: z.record(z.any()).optional().describe('Query parameters'),
          fields: z.array(z.string()).optional().describe('Specific fields to retrieve'),
        })

      case 'update':
        return z.object({
          ...baseSchema,
          id: z.union([z.string(), z.number()]).describe('Resource ID to update'),
          data: z.record(z.any()).describe('Data to update'),
          options: z.record(z.any()).optional().describe('Update options'),
        })

      case 'delete':
        return z.object({
          ...baseSchema,
          id: z.union([z.string(), z.number()]).describe('Resource ID to delete'),
          force: z.boolean().optional().describe('Force deletion'),
        })

      case 'list':
        return z.object({
          ...baseSchema,
          limit: z.number().optional().describe('Maximum number of items to return'),
          offset: z.number().optional().describe('Number of items to skip'),
          filters: z.record(z.any()).optional().describe('Filter criteria'),
        })

      case 'search':
        return z.object({
          ...baseSchema,
          query: z.string().describe('Search query'),
          limit: z.number().optional().describe('Maximum results'),
          filters: z.record(z.any()).optional().describe('Additional filters'),
        })

      case 'send':
        return z.object({
          ...baseSchema,
          to: z.union([z.string(), z.array(z.string())]).describe('Recipient(s)'),
          message: z.string().describe('Message content'),
          options: z.record(z.any()).optional().describe('Send options'),
        })

      case 'upload':
        return z.object({
          ...baseSchema,
          file: z.string().describe('File path or data'),
          destination: z.string().optional().describe('Upload destination'),
          metadata: z.record(z.any()).optional().describe('File metadata'),
        })

      case 'download':
        return z.object({
          ...baseSchema,
          source: z.string().describe('Source URL or path'),
          destination: z.string().optional().describe('Local destination'),
          options: z.record(z.any()).optional().describe('Download options'),
        })

      default:
        return z.object({
          ...baseSchema,
          parameters: z.record(z.any()).optional().describe(`Parameters for ${operation} operation`),
        })
    }
  }

  /**
   * Generate operation-specific output schema
   */
  private generateOperationOutputSchema(operation: string): z.ZodSchema {
    const baseOutput = {
      success: z.boolean(),
      operation: z.literal(operation),
      timestamp: z.string(),
    }

    switch (operation.toLowerCase()) {
      case 'create':
        return z.object({
          ...baseOutput,
          id: z.union([z.string(), z.number()]).optional(),
          data: z.any(),
          created: z.boolean(),
        })

      case 'read':
      case 'get':
        return z.object({
          ...baseOutput,
          data: z.any(),
          found: z.boolean(),
        })

      case 'list':
        return z.object({
          ...baseOutput,
          data: z.array(z.any()),
          count: z.number(),
          hasMore: z.boolean().optional(),
        })

      case 'search':
        return z.object({
          ...baseOutput,
          results: z.array(z.any()),
          totalCount: z.number(),
          query: z.string(),
        })

      case 'update':
        return z.object({
          ...baseOutput,
          data: z.any(),
          updated: z.boolean(),
          changes: z.array(z.string()).optional(),
        })

      case 'delete':
        return z.object({
          ...baseOutput,
          deleted: z.boolean(),
          id: z.union([z.string(), z.number()]),
        })

      default:
        return z.object({
          ...baseOutput,
          data: z.any().optional(),
          message: z.string().optional(),
        })
    }
  }

  /**
   * Get agent recommendation for specific operation
   */
  private getOperationAgentRecommendation(operation: string, category: string): string {
    // Security-sensitive operations
    if (['delete', 'update', 'create'].includes(operation.toLowerCase())) {
      return 'n8n-scriptguard'
    }

    // Authentication operations
    if (operation.toLowerCase().includes('auth') || operation.toLowerCase().includes('login')) {
      return 'n8n-connector'
    }

    // Complex data operations
    if (['search', 'list', 'execute'].includes(operation.toLowerCase())) {
      return 'n8n-node-expert'
    }

    // Default to category recommendation
    return this.AGENT_ROUTING[category] || 'n8n-guide'
  }

  /**
   * Estimate memory footprint for a tool
   */
  private estimateMemoryFootprint(node: N8NNodeDatabase, operation?: string): number {
    let baseSize = 1000 // Base memory for tool metadata

    // Add size based on properties complexity
    const propertyCount = Object.keys(node.properties || {}).length
    baseSize += propertyCount * 50

    // Add size based on credentials
    const credentialCount = (node.credentials || []).length
    baseSize += credentialCount * 100

    // Operation-specific overhead
    if (operation) {
      const operationOverhead: Record<string, number> = {
        upload: 500,
        download: 500,
        search: 300,
        list: 200,
      }
      baseSize += operationOverhead[operation.toLowerCase()] || 100
    }

    return baseSize
  }

  /**
   * Register a tool in the registry and mark for lazy loading
   */
  private registerTool(tool: GeneratedTool): void {
    this.toolRegistry.set(tool.id, tool)

    // Don't load into cache immediately - lazy loading
    logger.debug(`Registered tool: ${tool.name} (${tool.toolType})`, {
      id: tool.id,
      memoryFootprint: tool.memoryFootprint,
    })
  }

  /**
   * Lazy load a tool into cache
   */
  async loadTool(toolId: string): Promise<CacheEntry | null> {
    // Check if already in cache
    let cacheEntry = this.toolCache.get(toolId)
    if (cacheEntry) {
      cacheEntry.lastAccessed = new Date()
      cacheEntry.accessCount++
      return cacheEntry
    }

    // Get tool from registry
    const tool = this.toolRegistry.get(toolId)
    if (!tool) {
      return null
    }

    // Cleanup cache if needed
    if (this.toolCache.size >= this.maxCacheSize * this.cacheCleanupThreshold) {
      await this.cleanupCache()
    }

    // Create MCP SDK tool schema
    const schema: Tool = {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    }

    // Create cache entry
    cacheEntry = {
      tool,
      schema,
      loaded: true,
      lastAccessed: new Date(),
      accessCount: 1,
    }

    this.toolCache.set(toolId, cacheEntry)

    logger.debug(`Lazy loaded tool: ${tool.name}`, {
      cacheSize: this.toolCache.size,
      memoryFootprint: tool.memoryFootprint,
    })

    return cacheEntry
  }

  /**
   * Get all registered tool IDs (without loading them)
   */
  getAllToolIds(): string[] {
    return Array.from(this.toolRegistry.keys())
  }

  /**
   * Get tool metadata without loading full tool (single tool)
   */
  getToolMetadataById(toolId: string): GeneratedTool | null {
    return this.toolRegistry.get(toolId) || null
  }

  /**
   * Get tools by category (metadata only)
   */
  getToolsByCategory(category: string): GeneratedTool[] {
    return Array.from(this.toolRegistry.values())
      .filter(tool => tool.category === category)
  }

  /**
   * Search tools by name or description
   */
  searchTools(query: string, limit: number = 50): GeneratedTool[] {
    const searchTerm = query.toLowerCase()
    return Array.from(this.toolRegistry.values())
      .filter(tool =>
        tool.name.toLowerCase().includes(searchTerm)
        || tool.description.toLowerCase().includes(searchTerm),
      )
      .slice(0, limit)
  }

  /**
   * Get tool statistics
   */
  getToolStats(): {
    totalTools: number
    toolTypes: Record<string, number>
    categories: Record<string, number>
    cacheStats: { size: number, hitRate: number }
    memoryUsage: { total: number, cached: number }
  } {
    const toolTypes: Record<string, number> = {}
    const categories: Record<string, number> = {}
    let totalMemory = 0
    let cachedMemory = 0

    for (const tool of this.toolRegistry.values()) {
      toolTypes[tool.toolType] = (toolTypes[tool.toolType] || 0) + 1
      categories[tool.category] = (categories[tool.category] || 0) + 1
      totalMemory += tool.memoryFootprint

      if (this.toolCache.has(tool.id)) {
        cachedMemory += tool.memoryFootprint
      }
    }

    const totalAccesses = Array.from(this.toolCache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0)
    const hitRate = totalAccesses > 0 ? this.toolCache.size / totalAccesses : 0

    return {
      totalTools: this.toolRegistry.size,
      toolTypes,
      categories,
      cacheStats: {
        size: this.toolCache.size,
        hitRate: Number.parseFloat(hitRate.toFixed(3)),
      },
      memoryUsage: {
        total: totalMemory,
        cached: cachedMemory,
      },
    }
  }

  /**
   * Cleanup least recently used tools from cache
   */
  private async cleanupCache(): Promise<void> {
    const entriesToRemove = Math.floor(this.toolCache.size * 0.2) // Remove 20%

    // Sort by last accessed time (oldest first)
    const sortedEntries = Array.from(this.toolCache.entries())
      .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime())

    for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
      const entry = sortedEntries[i]
      if (entry) {
        const [toolId] = entry
        this.toolCache.delete(toolId)
      }
    }

    logger.debug(`Cleaned up ${entriesToRemove} tools from cache`, {
      cacheSize: this.toolCache.size,
      maxSize: this.maxCacheSize,
    })
  }

  /**
   * Persist generated tools to database
   */
  private async persistGeneratedTools(): Promise<void> {
    const toolsToStore: MCPTool[] = []

    // Get the instance ID once to avoid multiple database calls
    const instanceId = await this.getLatestInstanceId()
    logger.info(`Using instance ID for MCP tools: ${instanceId}`)

    for (const tool of this.toolRegistry.values()) {
      toolsToStore.push({
        id: tool.id,
        nodeName: tool.sourceNode,
        instanceId,
        toolType: tool.toolType,
        ...(tool.operationName ? { operationName: tool.operationName } : {}),
        schemaHash: this.calculateSchemaHash(tool),
        generatedAt: new Date(),
        lastUpdated: new Date(),
        usageCount: 0,
        successCount: 0,
        errorCount: 0,
        avgExecutionTime: 0,
        isActive: true,
      })
    }

    // Store in batches to avoid memory issues
    const batchSize = 100
    logger.info(`Attempting to persist ${toolsToStore.length} tools in batches of ${batchSize}`)

    for (let i = 0; i < toolsToStore.length; i += batchSize) {
      const batch = toolsToStore.slice(i, i + batchSize)
      logger.debug(`Persisting batch ${Math.floor(i / batchSize) + 1}: ${batch.length} tools`)

      for (const tool of batch) {
        try {
          logger.debug(`Registering tool: ${tool.id} (node: ${tool.nodeName}, instance: ${tool.instanceId})`)
          await this.versionManager.registerMCPTool(tool)
        }
        catch (error) {
          logger.error(`Failed to register tool ${tool.id}:`, error)
          throw error // Re-throw to stop the process and get more details
        }
      }
    }

    logger.info(`Persisted ${toolsToStore.length} generated tools to database`)
  }

  /**
   * Calculate schema hash for change detection
   */
  private calculateSchemaHash(tool: GeneratedTool): string {
    const content = JSON.stringify({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema._def,
      outputSchema: tool.outputSchema?._def,
    })

    // Simple hash function
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  /**
   * Get the latest registered n8n instance ID
   */
  private async getLatestInstanceId(): Promise<string> {
    try {
      const result = database.rawDatabase?.prepare(`
        SELECT id FROM n8n_instances 
        ORDER BY created_at DESC 
        LIMIT 1
      `).get() as { id: string } | undefined

      if (result?.id) {
        return result.id
      }

      // Fallback: create a default instance if none exists
      logger.warn('No n8n instance found, creating default instance')
      return await this.versionManager.registerInstance({
        url: 'http://localhost:5678',
        version: '1.0.0',
        edition: 'community',
        discoveryMethod: 'manual',
        status: 'active',
        errorCount: 0,
        lastDiscovered: new Date(),
        officialNodeCount: 0,
        communityNodeCount: 0,
        apiResponseTime: 0,
      })
    }
    catch (error) {
      logger.error('Failed to get instance ID:', error)
      // Return a hard-coded fallback that should work
      return 'default-instance'
    }
  }

  /**
   * Get tool metadata without loading full schemas (for lazy loading)
   */
  async getToolMetadata(limit?: number): Promise<Array<{
    toolId: string
    nodeName: string | null
    toolType: string
    operationName: string | null
    isActive: boolean
  }>> {
    try {
      const query = `
        SELECT 
          id as toolId,
          node_name as nodeName,
          tool_type as toolType,
          operation_name as operationName,
          is_active as isActive
        FROM mcp_tools 
        ORDER BY generated_at ASC
        ${limit ? `LIMIT ${limit}` : ''}
      `

      return database.rawDatabase?.prepare(query).all() as Array<{
        toolId: string
        nodeName: string | null
        toolType: string
        operationName: string | null
        isActive: boolean
      }>
    }
    catch (error) {
      logger.error('Failed to get tool metadata:', error)
      throw error
    }
  }
}
