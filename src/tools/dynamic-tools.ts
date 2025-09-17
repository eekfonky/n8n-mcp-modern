import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { database } from '../database/index.js'
import { NodeDiscoveryService } from '../discovery/nodeDiscovery.js'
import { SchemaParser } from '../discovery/schemaParser.js'
import { config } from '../server/config.js'
import { logger } from '../server/logger.js'

export class DynamicToolsManager {
  private readonly nodeDiscovery: NodeDiscoveryService
  private readonly config = config
  private readonly db = database

  constructor(private readonly server: McpServer) {
    this.nodeDiscovery = new NodeDiscoveryService()
    this.registerCoreTools()
  }

  private registerCoreTools(): void {
    // Discovery and node management tools
    this.server.registerTool(
      'discover_nodes',
      {
        title: 'Discover n8n Nodes',
        description: 'Discover and cache all available nodes from the connected n8n instance',
        inputSchema: {
          force_refresh: z.boolean().optional().describe('Force refresh even if recently discovered'),
        },
      },
      async ({ force_refresh: _force_refresh = false }) => {
        try {
          const session = await this.nodeDiscovery.discoverNodes()
          return {
            content: [{
              type: 'text',
              text: `Discovery completed: ${session.nodesDiscovered} total nodes (${session.nodesNew} new, ${session.nodesUpdated} updated)`,
            }],
          }
        }
        catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          }
        }
      },
    )

    this.server.registerTool(
      'search_nodes',
      {
        title: 'Search n8n Nodes',
        description: 'Search for nodes by name, description, or capabilities',
        inputSchema: {
          query: z.string().describe('Search query'),
          category: z.string().optional().describe('Filter by category'),
          limit: z.number().optional().default(10).describe('Maximum results'),
        },
      },
      async ({ query, category, limit = 10 }) => {
        const nodes = await this.nodeDiscovery.searchNodes(query, category)
        const limitedNodes = nodes.slice(0, limit)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query,
              category,
              found: nodes.length,
              returned: limitedNodes.length,
              nodes: limitedNodes.map(node => ({
                id: node.id,
                name: node.name,
                category: node.category,
                description: node.description,
                isCommunity: node.is_community,
              })),
            }, null, 2),
          }],
        }
      },
    )

    this.server.registerTool(
      'get_node_details',
      {
        title: 'Get Node Details',
        description: 'Get detailed information about a specific node including schema and parameters',
        inputSchema: {
          node_id: z.string().describe('Node ID to get details for'),
        },
      },
      async ({ node_id }) => {
        const node = await this.nodeDiscovery.getNodeById(node_id)
        if (!node) {
          return {
            content: [{
              type: 'text',
              text: `Node not found: ${node_id}`,
            }],
            isError: true,
          }
        }

        const schema = SchemaParser.parseNodeSchema(node)
        const useCases = SchemaParser.extractUseCases(schema)
        const hints = SchemaParser.generateWorkflowHints(schema)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              node: {
                id: node.id,
                name: node.name,
                category: node.category,
                description: node.description,
                version: node.version,
                isCommunity: node.is_community,
              },
              schema: {
                parameters: schema.parameters,
                inputPorts: schema.inputPorts,
                outputPorts: schema.outputPorts,
                credentials: schema.credentials,
                webhookSupport: schema.webhookSupport,
                triggerNode: schema.triggerNode,
              },
              useCases,
              hints,
            }, null, 2),
          }],
        }
      },
    )

    // Workflow building tools
    this.server.registerTool(
      'create_workflow',
      {
        title: 'Create n8n Workflow',
        description: 'Create a new workflow in the connected n8n instance',
        inputSchema: {
          name: z.string().describe('Workflow name'),
          description: z.string().optional().describe('Workflow description'),
          nodes: z.array(z.any()).optional().describe('Initial nodes configuration'),
          active: z.boolean().optional().default(false).describe('Activate workflow immediately'),
        },
      },
      async ({ name, description, nodes = [], active = false }) => {
        try {
          const workflow = await this.createWorkflow({ name, description, nodes, active })
          return {
            content: [{
              type: 'text',
              text: `Workflow created successfully: ${workflow.id} - ${workflow.name}`,
            }],
          }
        }
        catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Failed to create workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          }
        }
      },
    )

    this.server.registerTool(
      'validate_workflow',
      {
        title: 'Validate Workflow',
        description: 'Validate a workflow configuration for errors and best practices',
        inputSchema: {
          workflow: z.object({
            nodes: z.array(z.any()),
            connections: z.object({}).optional(),
          }).describe('Workflow configuration to validate'),
        },
      },
      async ({ workflow }) => {
        const validation = await this.validateWorkflow(workflow)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(validation, null, 2),
          }],
        }
      },
    )

    // Node configuration tools
    this.server.registerTool(
      'suggest_node_config',
      {
        title: 'Suggest Node Configuration',
        description: 'Get configuration suggestions for a node based on use case',
        inputSchema: {
          node_id: z.string().describe('Node ID to configure'),
          use_case: z.string().describe('Intended use case'),
          context: z.object({}).optional().describe('Additional context or requirements'),
        },
      },
      async ({ node_id, use_case, context = {} }) => {
        const suggestions = await this.suggestNodeConfiguration(node_id, use_case, context)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(suggestions, null, 2),
          }],
        }
      },
    )

    // Analytics and insights tools
    this.server.registerTool(
      'get_node_stats',
      {
        title: 'Get Node Statistics',
        description: 'Get statistics about discovered nodes and usage patterns',
        inputSchema: {},
      },
      async () => {
        const stats = await this.nodeDiscovery.getNodeStats()
        const popular = await this.nodeDiscovery.getPopularNodes()

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              stats,
              popularNodes: popular,
            }, null, 2),
          }],
        }
      },
    )

    // Pattern learning tools
    this.server.registerTool(
      'save_workflow_pattern',
      {
        title: 'Save Workflow Pattern',
        description: 'Save a successful workflow pattern for future reuse',
        inputSchema: {
          name: z.string().describe('Pattern name'),
          description: z.string().describe('Pattern description'),
          workflow: z.object({}).describe('Workflow configuration'),
          tags: z.array(z.string()).optional().describe('Tags for categorization'),
        },
      },
      async ({ name, description, workflow, tags = [] }) => {
        await this.saveWorkflowPattern(name, description, workflow, tags)
        return {
          content: [{
            type: 'text',
            text: `Workflow pattern saved: ${name}`,
          }],
        }
      },
    )

    this.server.registerTool(
      'suggest_workflow_patterns',
      {
        title: 'Suggest Workflow Patterns',
        description: 'Get workflow pattern suggestions based on requirements',
        inputSchema: {
          requirements: z.string().describe('Workflow requirements description'),
          category: z.string().optional().describe('Workflow category'),
        },
      },
      async ({ requirements, category }) => {
        const patterns = await this.suggestWorkflowPatterns(requirements, category)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(patterns, null, 2),
          }],
        }
      },
    )
  }

  private async createWorkflow(config: any): Promise<any> {
    if (!this.config.n8nApiUrl || !this.config.n8nApiKey) {
      throw new Error('n8n API not configured')
    }

    const response = await fetch(`${this.config.n8nApiUrl}/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': this.config.n8nApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      throw new Error(`Failed to create workflow: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  private async validateWorkflow(workflow: any): Promise<any> {
    const validation = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
      suggestions: [] as string[],
    }

    // Basic validation
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      validation.isValid = false
      validation.errors.push('Workflow must have nodes array')
      return validation
    }

    if (workflow.nodes.length === 0) {
      validation.isValid = false
      validation.errors.push('Workflow must have at least one node')
      return validation
    }

    // Check for trigger nodes
    const triggerNodes = workflow.nodes.filter((node: any) =>
      node.type?.includes('trigger') || node.type?.includes('Trigger'),
    )

    if (triggerNodes.length === 0) {
      validation.warnings.push('No trigger node found - workflow may not start automatically')
    }

    // Check for disconnected nodes
    if (workflow.connections) {
      const connectedNodes = new Set()
      Object.values(workflow.connections).forEach((connections: any) => {
        Object.values(connections).forEach((outputs: any) => {
          outputs.forEach((output: any) => {
            output.forEach((connection: any) => {
              connectedNodes.add(connection.node)
            })
          })
        })
      })

      const disconnectedNodes = workflow.nodes.filter((node: any) =>
        !connectedNodes.has(node.name) && !triggerNodes.includes(node),
      )

      if (disconnectedNodes.length > 0) {
        validation.warnings.push(`Disconnected nodes found: ${disconnectedNodes.map((n: any) => n.name).join(', ')}`)
      }
    }

    // Best practice suggestions
    if (workflow.nodes.length > 10) {
      validation.suggestions.push('Consider breaking large workflows into smaller, reusable components')
    }

    return validation
  }

  private async suggestNodeConfiguration(nodeId: string, useCase: string, _context: any): Promise<any> {
    const node = await this.nodeDiscovery.getNodeById(nodeId)
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`)
    }

    const schema = SchemaParser.parseNodeSchema(node)
    const suggestions = {
      nodeId,
      useCase,
      recommendedParameters: {} as any,
      notes: [] as string[],
    }

    // Get existing configurations for this node and use case
    const query = `
      SELECT configuration, rating, usage_count
      FROM node_configurations
      WHERE node_id = ? AND use_case LIKE ?
      ORDER BY rating DESC, usage_count DESC
      LIMIT 5
    `

    const existingConfigs = this.db.rawDatabase?.prepare(query).all(nodeId, `%${useCase}%`) || []

    if (existingConfigs.length > 0) {
      const topConfig = JSON.parse((existingConfigs[0] as any).configuration)
      suggestions.recommendedParameters = topConfig
      suggestions.notes.push(`Based on ${existingConfigs.length} similar configurations`)
    }
    else {
      // Generate default configuration based on schema
      for (const param of schema.parameters) {
        if (param.required) {
          suggestions.recommendedParameters[param.name] = param.default || ''
        }
      }
      suggestions.notes.push('Default configuration - no similar use cases found')
    }

    return suggestions
  }

  private async saveWorkflowPattern(name: string, description: string, workflow: any, tags: string[]): Promise<void> {
    const query = `
      INSERT INTO workflow_patterns (name, description, pattern_json, usage_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(name) DO UPDATE SET
        description = excluded.description,
        pattern_json = excluded.pattern_json,
        usage_count = usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
    `

    this.db.rawDatabase?.prepare(query).run(name, description, JSON.stringify({ workflow, tags }))
  }

  private async suggestWorkflowPatterns(requirements: string, category?: string): Promise<any[]> {
    let query = `
      SELECT * FROM workflow_patterns
      WHERE description LIKE ? OR name LIKE ?
    `
    const params = [`%${requirements}%`, `%${requirements}%`]

    if (category) {
      // Add category filtering logic if needed
    }

    query += ` ORDER BY usage_count DESC, success_rate DESC LIMIT 10`

    const patterns = this.db.rawDatabase?.prepare(query).all(...params) || []

    return (patterns as any[]).map((pattern: { name: string, description: string, pattern_json: string, usage_count: number, success_rate: number }) => ({
      name: pattern.name,
      description: pattern.description,
      usageCount: pattern.usage_count,
      successRate: pattern.success_rate,
      pattern: JSON.parse(pattern.pattern_json),
    }))
  }

  async generateDynamicTools(): Promise<void> {
    try {
      // Get all nodes from the database
      const nodes = this.db.rawDatabase?.prepare('SELECT * FROM nodes ORDER BY name').all() || []

      logger.info(`Generating ${nodes.length} dynamic tools from discovered nodes`)

      for (const node of nodes as any[]) {
        try {
          const schema = SchemaParser.parseNodeSchema(node)
          const toolSchema = SchemaParser.generateMCPToolSchema(schema)

          // Register the dynamic tool
          this.server.registerTool(
            toolSchema.name,
            {
              title: toolSchema.description,
              description: toolSchema.description,
              inputSchema: toolSchema.inputSchema,
            },
            async (params: Record<string, unknown>) => {
              return await this.executeNodeTool(node.id, params)
            },
          )
        }
        catch (error) {
          logger.warn(`Failed to generate tool for node ${(node as any).id}:`, error)
        }
      }

      logger.info('Dynamic tool generation completed')
    }
    catch (error) {
      logger.error('Failed to generate dynamic tools:', error)
    }
  }

  private async executeNodeTool(nodeId: string, params: any): Promise<any> {
    // This would integrate with n8n's API to execute a node or add it to a workflow
    // For now, return configuration guidance
    const node = await this.nodeDiscovery.getNodeById(nodeId)
    const schema = SchemaParser.parseNodeSchema(node)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          action: 'node_configured',
          nodeId,
          nodeName: schema.displayName,
          parameters: params,
          hints: SchemaParser.generateWorkflowHints(schema),
          nextSteps: [
            'Add this node to a workflow',
            'Configure connections to other nodes',
            'Test the node configuration',
          ],
        }, null, 2),
      }],
    }
  }
}
