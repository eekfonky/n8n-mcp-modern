/**
 * Dynamic Tool Discovery and Registration System
 * TRUE DYNAMIC DISCOVERY - Zero hardcoded n8n functionality
 *
 * ARCHITECTURE PRINCIPLES:
 * - Discover n8n capabilities via live API queries
 * - Generate tool schemas dynamically from discovered nodes
 * - Zero hardcoded tool definitions
 * - Token-efficient context-aware tool selection
 * - Agentic hierarchy adapts to actual n8n capabilities
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { CacheOptions } from '../discovery/discovery-cache.js'
import type { N8nApiClientConfig, N8nCredentialType, N8nNode, N8nWorkflow } from '../discovery/n8n-api-client.js'
import type { GeneratedSchema } from '../discovery/schema-generator.js'
import type { ToolContext, ToolSelection } from '../discovery/tool-selector.js'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { z } from 'zod'
import { DiscoveryCache } from '../discovery/discovery-cache.js'
import { N8nApiClient } from '../discovery/n8n-api-client.js'
import { SchemaGenerator } from '../discovery/schema-generator.js'
import { ToolSelector } from '../discovery/tool-selector.js'
import { logger } from '../server/logger.js'
import { createCleanObject } from '../utils/aggressive-memory-cleanup.js'

// Migration flags for safe transition
const MIGRATION_MODE = process.env.MIGRATION_MODE || 'dynamic'
// 'legacy' = temporary fallback (deprecated)
// 'hybrid' = mixed mode during transition
// 'dynamic' = pure dynamic discovery (target)

export interface ToolDefinition {
  name: string
  title: string
  description: string
  category: string
  inputSchema: Record<string, z.ZodTypeAny>
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>
  priority: number
  memoryOptimized: boolean
  dynamicallyGenerated: boolean // Track origin
}

interface ToolCategory {
  name: string
  description: string
  tools: string[]
  priority: number
}

// Utility functions for creating MCP responses
function createMcpResponse(content: string, isError?: boolean): CallToolResult {
  return {
    content: [{
      type: 'text' as const,
      text: content,
    }],
    ...(isError !== undefined && { isError }),
  }
}

function createMcpError(message: string, details?: unknown): CallToolResult {
  return {
    content: [{
      type: 'text' as const,
      text: `Error: ${message}${details ? ` - ${String(details)}` : ''}`,
    }],
    isError: true,
  }
}

/**
 * Dynamic Tool Registry with True n8n Discovery
 * NO HARDCODED TOOLS - Everything discovered from live n8n API
 */
export class DynamicToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private categories: Map<string, ToolCategory> = new Map()
  private initialized = false
  private n8nApiClient: N8nApiClient | null = null
  private schemaGenerator: SchemaGenerator = new SchemaGenerator()
  private toolSelector: ToolSelector = new ToolSelector()
  private discoveryCache: DiscoveryCache

  // Storage for discovered n8n data
  private discoveredNodes: N8nNode[] = []
  private discoveredWorkflows: N8nWorkflow[] = []
  private discoveredCredentialTypes: N8nCredentialType[] = []
  private generatedSchemas: Map<string, GeneratedSchema> = new Map()

  constructor(cacheOptions?: CacheOptions) {
    this.discoveryCache = new DiscoveryCache({
      defaultTtl: 3600000, // 1 hour
      maxSize: 1000,
      backgroundRefresh: true,
      warmingStrategy: 'lazy',
      cleanupInterval: 300000, // 5 minutes
      ...cacheOptions,
    })
  }

  /**
   * Initialize dynamic tool discovery
   */
  async initialize(): Promise<void> {
    if (this.initialized)
      return

    logger.info(`🔍 Starting dynamic tool discovery (mode: ${MIGRATION_MODE})...`)

    // Always create minimal system tools first
    await this.createMinimalSystemTools()

    // Initialize n8n API client if configuration is available
    await this.initializeN8nApiClient()

    // Initialize base categories (minimal)
    this.initializeMinimalCategories()

    // Dynamic discovery based on migration mode
    switch (MIGRATION_MODE) {
      case 'dynamic':
        await this.performDynamicDiscovery()
        break
      case 'hybrid':
        await this.performHybridDiscovery()
        break
      case 'legacy':
        await this.performLegacyFallback()
        break
      default:
        logger.warn(`Unknown migration mode: ${MIGRATION_MODE}, defaulting to dynamic`)
        await this.performDynamicDiscovery()
    }

    this.initialized = true
    logger.info(`✅ Discovery complete: ${this.tools.size} tools, ${this.categories.size} categories`)
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).sort((a, b) => b.priority - a.priority)
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): ToolDefinition[] {
    return this.getAllTools().filter(tool => tool.category === category)
  }

  /**
   * Intelligently select tools based on context (Phase 2.3)
   */
  selectToolsForContext(context: ToolContext): ToolSelection {
    const allTools = this.getAllTools()

    if (allTools.length === 0) {
      logger.warn('No tools available for context selection')
      return {
        selectedTools: [],
        scores: [],
        totalScore: 0,
        tokenEfficiency: 0,
        reasoning: ['No tools available'],
      }
    }

    // Create context hash for caching
    const contextHash = this.createContextHash(context)

    // Check cache first
    const cachedSelection = this.discoveryCache.getToolSelection(contextHash)
    if (cachedSelection) {
      logger.debug(`Using cached tool selection for context: ${contextHash}`)
      return cachedSelection
    }

    // Generate new selection and cache it
    const selection = this.toolSelector.selectTools(allTools, context)
    this.discoveryCache.cacheToolSelection(contextHash, selection)

    logger.debug(`Generated and cached tool selection for context: ${contextHash}`)

    logger.info(`Selected ${selection.selectedTools.length} tools from ${allTools.length} available (efficiency: ${selection.tokenEfficiency.toFixed(2)})`)

    return selection
  }

  /**
   * Get tools optimized for specific user intent
   */
  getToolsForIntent(intent: 'discovery' | 'execution' | 'validation' | 'analysis' | 'troubleshooting', options?: {
    query?: string
    maxTools?: number
    category?: string
  }): ToolDefinition[] {
    const context: ToolContext = { userIntent: intent }
    if (options?.query !== undefined)
      context.query = options.query
    if (options?.maxTools !== undefined)
      context.maxTools = options.maxTools
    if (options?.category !== undefined)
      context.category = options.category

    const selection = this.selectToolsForContext(context)
    return selection.selectedTools
  }

  /**
   * Record tool usage for learning and optimization
   */
  recordToolUsage(toolName: string, success: boolean, context?: ToolContext): void {
    this.toolSelector.recordToolUsage(toolName, success)

    if (context) {
      // Learn context patterns for future selections
      this.toolSelector.learnContextPattern(context, [toolName])
    }

    logger.debug(`Recorded ${success ? 'successful' : 'failed'} usage for tool: ${toolName}`)
  }

  /**
   * Get tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics(): Record<string, unknown> {
    const tools = this.getAllTools()
    const categoryStats = Array.from(this.categories.entries()).map(([name, category]) => ({
      name,
      description: category.description,
      toolCount: category.tools.length,
      priority: category.priority,
    }))

    return createCleanObject({
      totalTools: tools.length,
      categories: categoryStats,
      memoryOptimizedTools: tools.filter(t => t.memoryOptimized).length,
      highPriorityTools: tools.filter(t => t.priority >= 80).length,
      dynamicallyGeneratedTools: tools.filter(t => t.dynamicallyGenerated).length,
      discoveryComplete: this.initialized,
      mode: MIGRATION_MODE,
      // Schema generation statistics
      discoveredNodes: this.discoveredNodes.length,
      generatedSchemas: this.generatedSchemas.size,
      schemaGeneratorStats: this.schemaGenerator.getStatistics(),
      // Discovery capabilities
      n8nConnected: !!this.n8nApiClient,
      workflowsDiscovered: this.discoveredWorkflows.length,
      credentialTypesDiscovered: this.discoveredCredentialTypes.length,
    })
  }

  /**
   * Initialize minimal base categories (will be expanded dynamically)
   */
  private initializeMinimalCategories(): void {
    const categories: ToolCategory[] = [
      {
        name: 'System',
        description: 'Core system functionality',
        tools: [],
        priority: 100,
      },
      {
        name: 'Discovery',
        description: 'Dynamic capability discovery',
        tools: [],
        priority: 95,
      },
    ]

    categories.forEach(category => this.categories.set(category.name, category))
  }

  /**
   * Perform dynamic discovery from live n8n instance
   */
  private async performDynamicDiscovery(): Promise<void> {
    logger.info('🚀 Performing dynamic discovery from n8n API...')

    if (!this.n8nApiClient) {
      logger.warn('⚠️ n8n API client not available - creating minimal tools')
      await this.createMinimalSystemTools()
      return
    }

    try {
      // Phase 2.1: Discover available n8n nodes
      await this.discoverN8nNodes()

      // Phase 2.2: Generate tools from discovered capabilities
      await this.generateToolsFromNodes()

      // Phase 2.3: Discover workflows and patterns
      await this.discoverWorkflowPatterns()
    }
    catch (error) {
      logger.error('Dynamic discovery failed, falling back to minimal tools:', error)
      await this.createMinimalSystemTools()
    }
  }

  /**
   * Perform hybrid discovery (transition mode)
   */
  private async performHybridDiscovery(): Promise<void> {
    logger.info('🔄 Performing hybrid discovery...')

    // Start with minimal tools
    await this.createMinimalSystemTools()

    // Attempt dynamic discovery in background
    try {
      if (this.n8nApiClient) {
        await this.discoverN8nNodes()
        logger.info('✅ Hybrid mode: Dynamic discovery successful')
      }
    }
    catch (error) {
      logger.warn('⚠️ Hybrid mode: Dynamic discovery failed, using minimal tools:', error)
    }
  }

  /**
   * Perform legacy fallback (temporary safety net)
   */
  private async performLegacyFallback(): Promise<void> {
    logger.warn('⚠️ Using legacy fallback mode - this will be removed!')
    await this.createMinimalSystemTools()
  }

  /**
   * Create essential system tools for basic functionality
   */
  private async createMinimalSystemTools(): Promise<void> {
    const systemTools: ToolDefinition[] = [
      {
        name: 'get_system_status',
        title: 'Get System Status',
        description: 'Get basic system status and health information',
        category: 'System',
        inputSchema: {},
        handler: async (): Promise<CallToolResult> => {
          const status = {
            status: 'operational',
            mode: MIGRATION_MODE,
            tools: this.tools.size,
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || 'unknown',
            n8nConnected: !!this.n8nApiClient,
          }
          return createMcpResponse(JSON.stringify(status, null, 2))
        },
        priority: 100,
        memoryOptimized: true,
        dynamicallyGenerated: false,
      },
      {
        name: 'list_discovery_status',
        title: 'List Discovery Status',
        description: 'Show current dynamic discovery status and available capabilities',
        category: 'Discovery',
        inputSchema: {},
        handler: async (): Promise<CallToolResult> => {
          const discoveryStatus = {
            mode: MIGRATION_MODE,
            n8nConnected: !!this.n8nApiClient,
            toolsDiscovered: this.tools.size,
            categoriesAvailable: this.categories.size,
            dynamicToolsCount: Array.from(this.tools.values()).filter(t => t.dynamicallyGenerated).length,
            lastDiscovery: new Date().toISOString(),
          }
          return createMcpResponse(JSON.stringify(discoveryStatus, null, 2))
        },
        priority: 95,
        memoryOptimized: true,
        dynamicallyGenerated: false,
      },
      {
        name: 'select_optimal_tools',
        title: 'Select Optimal Tools',
        description: 'Intelligently select the most relevant tools for a given context or query',
        category: 'Discovery',
        inputSchema: {
          query: z.string().optional().describe('Search query or task description'),
          userIntent: z.enum(['discovery', 'execution', 'validation', 'analysis', 'troubleshooting']).optional().describe('Primary user intent'),
          category: z.string().optional().describe('Preferred tool category'),
          maxTools: z.number().optional().default(10).describe('Maximum number of tools to select'),
          priorityThreshold: z.number().optional().default(0.3).describe('Minimum relevance score (0-1)'),
        },
        handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
          const context: ToolContext = {}
          if (args.query !== undefined)
            context.query = args.query as string
          if (args.userIntent !== undefined)
            context.userIntent = args.userIntent as 'discovery' | 'execution' | 'validation' | 'analysis' | 'troubleshooting'
          if (args.category !== undefined)
            context.category = args.category as string
          if (args.maxTools !== undefined)
            context.maxTools = args.maxTools as number
          if (args.priorityThreshold !== undefined)
            context.priorityThreshold = args.priorityThreshold as number
          const selection = this.selectToolsForContext(context)

          const result = createCleanObject({
            success: true,
            context,
            selection: {
              selectedCount: selection.selectedTools.length,
              totalScore: selection.totalScore,
              tokenEfficiency: selection.tokenEfficiency,
              reasoning: selection.reasoning,
            },
            tools: selection.selectedTools.map(tool => ({
              name: tool.name,
              title: tool.title,
              category: tool.category,
              priority: tool.priority,
              dynamicallyGenerated: tool.dynamicallyGenerated,
            })),
            scores: selection.scores.slice(0, 10), // Top 10 scores for transparency
          })

          return createMcpResponse(JSON.stringify(result, null, 2))
        },
        priority: 90,
        memoryOptimized: true,
        dynamicallyGenerated: false,
      },
      {
        name: 'get_cache_statistics',
        title: 'Get Cache Statistics',
        description: 'Get detailed cache performance statistics and health metrics',
        category: 'System',
        inputSchema: {},
        handler: async (): Promise<CallToolResult> => {
          const cacheStats = this.getCacheStatistics()
          const cacheHealth = this.getCacheHealthStatus()

          const result = createCleanObject({
            success: true,
            statistics: cacheStats,
            health: cacheHealth,
            timestamp: new Date().toISOString(),
          })

          return createMcpResponse(JSON.stringify(result, null, 2))
        },
        priority: 85,
        memoryOptimized: true,
        dynamicallyGenerated: false,
      },
      {
        name: 'invalidate_cache',
        title: 'Invalidate Discovery Cache',
        description: 'Clear or selectively invalidate cached discovery data',
        category: 'System',
        inputSchema: {
          pattern: z.string().optional().describe('Pattern to match for selective invalidation (optional)'),
        },
        handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
          const pattern = args.pattern as string | undefined

          let invalidatedCount: number
          if (pattern) {
            invalidatedCount = this.invalidateCache(pattern)
          }
          else {
            this.invalidateCache()
            invalidatedCount = -1 // Full clear
          }

          const result = createCleanObject({
            success: true,
            action: pattern ? 'selective_invalidation' : 'full_clear',
            pattern: pattern || null,
            invalidatedEntries: invalidatedCount,
            timestamp: new Date().toISOString(),
          })

          return createMcpResponse(JSON.stringify(result, null, 2))
        },
        priority: 80,
        memoryOptimized: true,
        dynamicallyGenerated: false,
      },
      {
        name: 'refresh_discovery_cache',
        title: 'Refresh Discovery Cache',
        description: 'Force refresh of all cached discovery data from n8n API',
        category: 'System',
        inputSchema: {},
        handler: async (): Promise<CallToolResult> => {
          try {
            await this.refreshDiscoveryCache()

            const result = createCleanObject({
              success: true,
              message: 'Discovery cache refreshed successfully',
              timestamp: new Date().toISOString(),
            })

            return createMcpResponse(JSON.stringify(result, null, 2))
          }
          catch (error) {
            return createMcpError(`Failed to refresh discovery cache: ${String(error)}`)
          }
        },
        priority: 75,
        memoryOptimized: true,
        dynamicallyGenerated: false,
      },
    ]

    this.registerTools(systemTools)
  }

  /**
   * Dynamic discovery methods (Phase 2 implementation)
   */
  private async discoverN8nNodes(): Promise<void> {
    if (!this.n8nApiClient) {
      logger.warn('No n8n API client available for node discovery')
      return
    }

    try {
      // Check cache first
      const cachedNodes = this.discoveryCache.getNodes()
      if (cachedNodes) {
        logger.info(`✅ Using cached nodes: ${cachedNodes.length} n8n nodes`)
        this.discoveredNodes = cachedNodes
        return
      }

      logger.info('🔍 Discovering n8n nodes from API...')
      const nodes = await this.n8nApiClient.getNodes()

      logger.info(`✅ Discovered ${nodes.length} n8n nodes, caching and generating tools...`)

      // Store discovered nodes for tool generation
      this.discoveredNodes = nodes

      // Cache the nodes with default TTL
      this.discoveryCache.cacheNodes(nodes)
    }
    catch (error) {
      logger.error('❌ Failed to discover n8n nodes:', error)
      throw error
    }
  }

  private async generateToolsFromNodes(): Promise<void> {
    if (!this.discoveredNodes?.length) {
      logger.info('No discovered nodes available for tool generation')
      return
    }

    logger.info('⚙️ Generating tools from discovered nodes...')

    try {
      // Phase 2.2: Generate dynamic schemas for discovered nodes
      await this.generateDynamicSchemas()

      // Generate core discovery tools for real n8n nodes
      await this.generateNodeDiscoveryTools()

      // Generate node-specific execution tools with proper schemas
      await this.generateNodeExecutionTools()

      logger.info(`✅ Generated ${this.tools.size - 2} dynamic tools from ${this.discoveredNodes.length} discovered nodes`) // -2 for system tools
    }
    catch (error) {
      logger.error('❌ Failed to generate tools from nodes:', error)
      throw error
    }
  }

  private async discoverWorkflowPatterns(): Promise<void> {
    if (!this.n8nApiClient) {
      logger.info('No n8n API client available for workflow discovery')
      return
    }

    try {
      logger.info('📋 Discovering workflow patterns...')

      // Check cache for workflows and credentials
      const cachedWorkflows = this.discoveryCache.getWorkflows()
      const cachedCredentialTypes = this.discoveryCache.getCredentialTypes()

      if (cachedWorkflows && cachedCredentialTypes) {
        logger.info(`✅ Using cached workflows (${cachedWorkflows.length}) and credential types (${cachedCredentialTypes.length})`)
        this.discoveredWorkflows = cachedWorkflows
        this.discoveredCredentialTypes = cachedCredentialTypes
        return
      }

      // Fetch from API if not cached
      const workflows = cachedWorkflows || await this.n8nApiClient.getWorkflows()
      const credentialTypes = cachedCredentialTypes || await this.n8nApiClient.getCredentialTypes()

      logger.info(`✅ Discovered ${workflows.length} workflows and ${credentialTypes.length} credential types`)

      // Store for future use in tool generation
      this.discoveredWorkflows = workflows
      this.discoveredCredentialTypes = credentialTypes

      // Cache the results
      if (!cachedWorkflows) {
        this.discoveryCache.cacheWorkflows(workflows)
      }
      if (!cachedCredentialTypes) {
        this.discoveryCache.cacheCredentialTypes(credentialTypes)
      }
    }
    catch (error) {
      logger.warn('⚠️ Failed to discover workflow patterns (non-critical):', error)
      // Non-critical error - continue with node-based tools only
    }
  }

  /**
   * Generate dynamic tools based on discovered n8n nodes
   */
  private async generateNodeDiscoveryTools(): Promise<void> {
    if (!this.discoveredNodes.length)
      return

    // Add 'n8n-discovery' category for dynamic tools
    this.categories.set('n8n-discovery', {
      name: 'n8n-discovery',
      description: 'Dynamically discovered n8n capabilities',
      tools: [],
      priority: 90,
    })

    const dynamicTools: ToolDefinition[] = []

    // Generate search tool for discovered nodes
    dynamicTools.push({
      name: 'search_n8n_nodes_dynamic',
      title: 'Search n8n Nodes (Dynamic)',
      description: `Search through ${this.discoveredNodes.length} discovered n8n nodes`,
      category: 'n8n-discovery',
      inputSchema: {
        query: z.string().describe('Search query for node names or descriptions'),
        category: z.string().optional().describe('Filter by node category'),
        limit: z.number().optional().default(10).describe('Maximum results to return'),
      },
      handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const { query, category, limit } = args as { query: string, category?: string, limit?: number }

        let filteredNodes = this.discoveredNodes.filter((node) => {
          const matchesQuery = node.name.toLowerCase().includes(query.toLowerCase())
            || node.displayName.toLowerCase().includes(query.toLowerCase())
            || node.description.toLowerCase().includes(query.toLowerCase())

          const matchesCategory = !category || node.group.some(g => g.toLowerCase().includes(category.toLowerCase()))

          return matchesQuery && matchesCategory
        })

        // Limit results
        filteredNodes = filteredNodes.slice(0, limit || 10)

        const result = createCleanObject({
          success: true,
          query,
          total: filteredNodes.length,
          nodes: filteredNodes.map(node => ({
            name: node.name,
            displayName: node.displayName,
            description: node.description,
            version: node.version,
            group: node.group,
          })),
        })

        return createMcpResponse(JSON.stringify(result, null, 2))
      },
      priority: 95,
      memoryOptimized: true,
      dynamicallyGenerated: true,
    })

    // Generate node details tool
    dynamicTools.push({
      name: 'get_n8n_node_details_dynamic',
      title: 'Get n8n Node Details (Dynamic)',
      description: 'Get detailed information about a specific discovered n8n node',
      category: 'n8n-discovery',
      inputSchema: {
        nodeName: z.string().describe('Name of the node to get details for'),
      },
      handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const { nodeName } = args as { nodeName: string }

        const node = this.discoveredNodes.find(n => n.name === nodeName)

        if (!node) {
          return createMcpError(`Node '${nodeName}' not found in discovered nodes`)
        }

        const result = createCleanObject({
          success: true,
          node: {
            name: node.name,
            displayName: node.displayName,
            description: node.description,
            version: node.version,
            group: node.group,
            properties: node.properties,
            ...(node.codex && { categories: node.codex.categories, subcategories: node.codex.subcategories }),
          },
        })

        return createMcpResponse(JSON.stringify(result, null, 2))
      },
      priority: 90,
      memoryOptimized: true,
      dynamicallyGenerated: true,
    })

    // Generate category listing tool
    dynamicTools.push({
      name: 'list_n8n_node_categories_dynamic',
      title: 'List n8n Node Categories (Dynamic)',
      description: 'List all categories from discovered n8n nodes',
      category: 'n8n-discovery',
      inputSchema: {},
      handler: async (): Promise<CallToolResult> => {
        const categoryMap = new Map<string, number>()

        this.discoveredNodes.forEach((node) => {
          node.group.forEach((group) => {
            categoryMap.set(group, (categoryMap.get(group) || 0) + 1)
          })
        })

        const categories = Array.from(categoryMap.entries()).map(([name, count]) => ({
          name,
          nodeCount: count,
        })).sort((a, b) => b.nodeCount - a.nodeCount)

        const result = createCleanObject({
          success: true,
          totalCategories: categories.length,
          categories,
        })

        return createMcpResponse(JSON.stringify(result, null, 2))
      },
      priority: 85,
      memoryOptimized: true,
      dynamicallyGenerated: true,
    })

    this.registerTools(dynamicTools)
    logger.info(`✅ Generated ${dynamicTools.length} dynamic discovery tools`)
  }

  /**
   * Generate dynamic schemas for discovered nodes
   */
  private async generateDynamicSchemas(): Promise<void> {
    if (!this.discoveredNodes.length)
      return

    logger.info(`🔧 Generating dynamic schemas for ${this.discoveredNodes.length} nodes...`)

    try {
      // Check if schemas are cached
      let schemasGenerated = 0
      const uncachedNodes: N8nNode[] = []

      for (const node of this.discoveredNodes) {
        const cachedSchema = this.discoveryCache.getSchema(node.name)
        if (cachedSchema) {
          this.generatedSchemas.set(node.name, cachedSchema)
          schemasGenerated++
        }
        else {
          uncachedNodes.push(node)
        }
      }

      if (schemasGenerated > 0) {
        logger.info(`✅ Using ${schemasGenerated} cached schemas`)
      }

      // Generate schemas for uncached nodes
      if (uncachedNodes.length > 0) {
        const schemas = this.schemaGenerator.generateSchemasForNodes(uncachedNodes, {
          tokenOptimized: true,
          includeOptional: true,
          maxDepth: 3,
        })

        // Cache and store new schemas
        schemas.forEach((schema, nodeName) => {
          this.generatedSchemas.set(nodeName, schema)
          this.discoveryCache.cacheSchema(nodeName, schema)
        })

        logger.info(`✅ Generated and cached ${schemas.size} new schemas`)
      }

      const schemaStats = this.schemaGenerator.getStatistics()
      logger.info(`✅ Total schemas available: ${this.generatedSchemas.size} - ${JSON.stringify(schemaStats)}`)
    }
    catch (error) {
      logger.error('❌ Failed to generate dynamic schemas:', error)
      throw error
    }
  }

  /**
   * Generate node-specific execution tools with proper parameter validation
   */
  private async generateNodeExecutionTools(): Promise<void> {
    if (!this.discoveredNodes.length || !this.generatedSchemas.size)
      return

    logger.info(`🛠️ Generating node execution tools...`)

    // Add execution category
    this.categories.set('node-execution', {
      name: 'node-execution',
      description: 'Execute n8n nodes with validated parameters',
      tools: [],
      priority: 85,
    })

    const executionTools: ToolDefinition[] = []

    // Generate execution tools for nodes with manageable parameter counts
    const executableNodes = this.discoveredNodes.filter((node) => {
      const schema = this.generatedSchemas.get(node.name)
      return schema && Object.keys(schema.schema).length <= 10 // Token efficiency
    }).slice(0, 20) // Limit to most important nodes

    for (const node of executableNodes) {
      const schema = this.generatedSchemas.get(node.name)
      if (!schema)
        continue

      try {
        executionTools.push({
          name: `execute_${node.name.replace(/[^a-z0-9]/gi, '_')}`,
          title: `Execute ${node.displayName}`,
          description: `Execute ${node.displayName} node with validated parameters: ${node.description}`,
          category: 'node-execution',
          inputSchema: schema.schema,
          handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
            try {
              // Validate parameters using generated schema
              const validation = this.schemaGenerator.validateSchema(schema, args)

              if (!validation.valid) {
                return createMcpError(`Parameter validation failed: ${validation.errors.join(', ')}`)
              }

              // Create execution response (placeholder - would integrate with actual n8n execution)
              const result = createCleanObject({
                success: true,
                node: node.name,
                displayName: node.displayName,
                parameters: args,
                validation,
                message: `Node ${node.displayName} would execute with validated parameters`,
                // In a real implementation, this would trigger actual n8n workflow execution
              })

              return createMcpResponse(JSON.stringify(result, null, 2))
            }
            catch (error) {
              return createMcpError(`Execution failed: ${String(error)}`)
            }
          },
          priority: 75,
          memoryOptimized: true,
          dynamicallyGenerated: true,
        })
      }
      catch (error) {
        logger.warn(`Failed to generate execution tool for ${node.name}:`, error)
      }
    }

    // Add schema validation tool
    executionTools.push({
      name: 'validate_node_parameters_dynamic',
      title: 'Validate Node Parameters (Dynamic)',
      description: 'Validate parameters for any discovered n8n node using generated schemas',
      category: 'node-execution',
      inputSchema: {
        nodeName: z.string().describe('Name of the node to validate parameters for'),
        parameters: z.record(z.any()).describe('Parameters to validate'),
      },
      handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const { nodeName, parameters } = args as { nodeName: string, parameters: Record<string, unknown> }

        const schema = this.generatedSchemas.get(nodeName)
        if (!schema) {
          return createMcpError(`No schema available for node: ${nodeName}`)
        }

        const validation = this.schemaGenerator.validateSchema(schema, parameters)

        const result = createCleanObject({
          success: true,
          nodeName,
          validation,
          schema: {
            required: schema.required,
            optional: schema.optional,
            documentation: schema.documentation,
          },
        })

        return createMcpResponse(JSON.stringify(result, null, 2))
      },
      priority: 80,
      memoryOptimized: true,
      dynamicallyGenerated: true,
    })

    // Add schema inspection tool
    executionTools.push({
      name: 'get_node_schema_dynamic',
      title: 'Get Node Schema (Dynamic)',
      description: 'Get the generated Zod schema for any discovered n8n node',
      category: 'node-execution',
      inputSchema: {
        nodeName: z.string().describe('Name of the node to get schema for'),
        includeDocumentation: z.boolean().optional().default(true).describe('Include parameter documentation'),
      },
      handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const { nodeName, includeDocumentation } = args as { nodeName: string, includeDocumentation?: boolean }

        const schema = this.generatedSchemas.get(nodeName)
        if (!schema) {
          return createMcpError(`No schema available for node: ${nodeName}`)
        }

        const result = createCleanObject({
          success: true,
          nodeName,
          schema: {
            required: schema.required,
            optional: schema.optional,
            totalParameters: Object.keys(schema.schema).length,
            ...(includeDocumentation && { documentation: schema.documentation }),
          },
        })

        return createMcpResponse(JSON.stringify(result, null, 2))
      },
      priority: 70,
      memoryOptimized: true,
      dynamicallyGenerated: true,
    })

    this.registerTools(executionTools)
    logger.info(`✅ Generated ${executionTools.length} node execution tools`)
  }

  /**
   * Register multiple tools and update categories
   */
  private registerTools(tools: ToolDefinition[]): void {
    tools.forEach((tool) => {
      this.tools.set(tool.name, tool)

      // Update category with tool reference
      const category = this.categories.get(tool.category)
      if (category) {
        category.tools.push(tool.name)
      }
    })
  }

  /**
   * Initialize n8n API client from environment configuration
   */
  private async initializeN8nApiClient(): Promise<void> {
    const n8nApiUrl = process.env.N8N_API_URL
    const n8nApiKey = process.env.N8N_API_KEY

    if (!n8nApiUrl) {
      logger.info('ℹ️ No N8N_API_URL configured - dynamic discovery will use minimal tools')
      return
    }

    try {
      const clientConfig: N8nApiClientConfig = {
        baseUrl: n8nApiUrl,
        ...(n8nApiKey && { apiKey: n8nApiKey }),
        timeout: 15000, // 15 second timeout for discovery
        retries: 2,
      }

      this.n8nApiClient = new N8nApiClient(clientConfig)

      // Test connection
      const connectionTest = await this.n8nApiClient.testConnection()

      if (connectionTest.success) {
        logger.info('✅ n8n API client initialized and connection verified')
      }
      else {
        logger.warn(`⚠️ n8n API connection test failed: ${connectionTest.error}`)
        logger.warn('Continuing with minimal tools - dynamic discovery will be limited')
      }
    }
    catch (error) {
      logger.error('❌ Failed to initialize n8n API client:', error)
      logger.warn('Continuing with minimal tools - dynamic discovery disabled')
      this.n8nApiClient = null
    }
  }

  /**
   * Set n8n API client for dynamic discovery (for testing/advanced usage)
   */
  setN8nApiClient(client: N8nApiClient | null): void {
    this.n8nApiClient = client
    logger.info('🔧 n8n API client manually configured')
  }

  /**
   * Create hash for context-based caching
   */
  private createContextHash(context: ToolContext): string {
    const hashData = {
      query: context.query || '',
      category: context.category || '',
      userIntent: context.userIntent || '',
      nodeTypes: context.nodeTypes?.sort() || [],
      maxTools: context.maxTools,
      priorityThreshold: context.priorityThreshold,
      workflowContext: context.workflowContext || false,
      previousTools: context.previousTools?.sort() || [],
    }

    // Use a more robust hash that includes all values
    const hashString = JSON.stringify(hashData, Object.keys(hashData).sort())
    return Buffer.from(hashString).toString('base64').slice(0, 32)
  }

  /**
   * Cache management methods
   */
  invalidateCache(pattern?: string | RegExp): number {
    if (pattern) {
      return this.discoveryCache.invalidate(pattern)
    }
    else {
      this.discoveryCache.clear()
      return -1
    }
  }

  getCacheStatistics(): unknown {
    return this.discoveryCache.getStatistics()
  }

  getCacheHealthStatus(): { status: 'healthy' | 'warning' | 'critical', issues: string[] } {
    return this.discoveryCache.getHealthStatus()
  }

  /**
   * Force refresh of cached data
   */
  async refreshDiscoveryCache(): Promise<void> {
    logger.info('🔄 Refreshing discovery cache...')

    // Clear existing cache
    this.discoveryCache.clear()

    // Re-run discovery to populate cache
    if (this.n8nApiClient) {
      await this.discoverN8nNodes()
      await this.generateDynamicSchemas()
      await this.discoverWorkflowPatterns()

      logger.info('✅ Discovery cache refreshed')
    }
    else {
      logger.warn('No n8n API client available for cache refresh')
    }
  }

  /**
   * Destroy registry and cleanup resources
   */
  destroy(): void {
    this.discoveryCache.destroy()
    this.tools.clear()
    this.categories.clear()
    this.generatedSchemas.clear()
    this.initialized = false

    logger.info('🧹 Dynamic tool registry destroyed')
  }
}

// Global dynamic tool registry instance
export const dynamicToolRegistry = new DynamicToolRegistry()
