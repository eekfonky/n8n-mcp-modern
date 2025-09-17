import { z } from 'zod'
import { database } from '../database/index.js'
import { config } from '../server/config.js'
import { logger } from '../server/logger.js'

const NodeSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  version: z.number(),
  group: z.array(z.string()),
  defaults: z.object({
    name: z.string(),
    color: z.string().optional(),
  }),
  properties: z.array(z.any()).optional(),
  credentials: z.array(z.any()).optional(),
})

const NodesResponseSchema = z.array(NodeSchema)

export interface DiscoverySession {
  id: number
  n8nInstanceUrl: string
  nodesDiscovered: number
  nodesNew: number
  nodesUpdated: number
  status: 'running' | 'completed' | 'failed'
  errorMessage?: string
  startedAt: Date
  completedAt: Date | undefined
}

export class NodeDiscoveryService {
  private readonly config = config
  private readonly db = database

  async discoverNodes(): Promise<DiscoverySession> {
    const sessionId = await this.createDiscoverySession()

    try {
      logger.info('Starting node discovery from n8n instance')

      if (!this.config.n8nApiUrl || !this.config.n8nApiKey) {
        throw new Error('n8n API URL and API key must be configured for node discovery')
      }

      const nodes = await this.fetchNodesFromN8N()
      const { newNodes, updatedNodes } = await this.processNodes(nodes)

      await this.completeDiscoverySession(sessionId, {
        nodesDiscovered: nodes.length,
        nodesNew: newNodes,
        nodesUpdated: updatedNodes,
        status: 'completed',
      })

      logger.info(`Discovery completed: ${nodes.length} total, ${newNodes} new, ${updatedNodes} updated`)

      return this.getDiscoverySession(sessionId)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Node discovery failed:', errorMessage)

      await this.completeDiscoverySession(sessionId, {
        status: 'failed',
        errorMessage,
      })

      throw error
    }
  }

  private async fetchNodesFromN8N(): Promise<any[]> {
    const url = `${this.config.n8nApiUrl}/nodes`
    const response = await fetch(url, {
      headers: {
        'X-N8N-API-KEY': this.config.n8nApiKey!,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch nodes from n8n: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return NodesResponseSchema.parse(data)
  }

  private async processNodes(nodes: any[]): Promise<{ newNodes: number, updatedNodes: number }> {
    let newNodes = 0
    let updatedNodes = 0

    for (const node of nodes) {
      const nodeId = node.name
      const existingNode = await this.getExistingNode(nodeId)

      const nodeData = {
        id: nodeId,
        name: node.displayName || node.name,
        type: node.name,
        category: node.group?.[0] || 'unknown',
        description: node.description || '',
        schema: JSON.stringify(node),
        version: node.version?.toString() || '1',
        is_community: !node.name.startsWith('n8n-nodes-base'),
        capabilities: JSON.stringify({
          properties: node.properties?.length || 0,
          credentials: node.credentials?.length || 0,
          group: node.group || [],
        }),
      }

      if (existingNode) {
        if (existingNode.version !== nodeData.version) {
          await this.updateNode(nodeData)
          updatedNodes++
        }
      }
      else {
        await this.insertNode(nodeData)
        newNodes++
      }
    }

    return { newNodes, updatedNodes }
  }

  private async createDiscoverySession(): Promise<number> {
    const query = `
      INSERT INTO discovery_sessions (n8n_instance_url, status)
      VALUES (?, 'running')
    `
    const result = this.db.rawDatabase?.prepare(query).run(this.config.n8nApiUrl)
    return result?.lastInsertRowid as number
  }

  private async completeDiscoverySession(
    sessionId: number,
    updates: Partial<DiscoverySession>,
  ): Promise<void> {
    const fields = []
    const values = []

    if (updates.nodesDiscovered !== undefined) {
      fields.push('nodes_discovered = ?')
      values.push(updates.nodesDiscovered)
    }
    if (updates.nodesNew !== undefined) {
      fields.push('nodes_new = ?')
      values.push(updates.nodesNew)
    }
    if (updates.nodesUpdated !== undefined) {
      fields.push('nodes_updated = ?')
      values.push(updates.nodesUpdated)
    }
    if (updates.status) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?')
      values.push(updates.errorMessage)
    }

    fields.push('completed_at = CURRENT_TIMESTAMP')
    values.push(sessionId)

    const query = `
      UPDATE discovery_sessions
      SET ${fields.join(', ')}
      WHERE id = ?
    `

    this.db.rawDatabase?.prepare(query).run(...values)
  }

  private async getDiscoverySession(sessionId: number): Promise<DiscoverySession> {
    const query = `
      SELECT * FROM discovery_sessions WHERE id = ?
    `
    const row = this.db.rawDatabase?.prepare(query).get(sessionId) as any

    if (!row) {
      throw new Error(`Discovery session ${sessionId} not found`)
    }

    return {
      id: row.id,
      n8nInstanceUrl: row.n8n_instance_url,
      nodesDiscovered: row.nodes_discovered,
      nodesNew: row.nodes_new,
      nodesUpdated: row.nodes_updated,
      status: row.status,
      errorMessage: row.error_message,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    }
  }

  private async getExistingNode(nodeId: string): Promise<Record<string, unknown> | null> {
    const query = `SELECT * FROM nodes WHERE id = ?`
    return (this.db.rawDatabase?.prepare(query).get(nodeId) as Record<string, unknown>) || null
  }

  private async insertNode(nodeData: any): Promise<void> {
    const query = `
      INSERT INTO nodes (
        id, name, type, category, description, schema, version, is_community, capabilities
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    this.db.rawDatabase?.prepare(query).run(
      nodeData.id,
      nodeData.name,
      nodeData.type,
      nodeData.category,
      nodeData.description,
      nodeData.schema,
      nodeData.version,
      nodeData.is_community,
      nodeData.capabilities,
    )
  }

  private async updateNode(nodeData: any): Promise<void> {
    const query = `
      UPDATE nodes SET
        name = ?, type = ?, category = ?, description = ?, schema = ?,
        version = ?, is_community = ?, capabilities = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `

    this.db.rawDatabase?.prepare(query).run(
      nodeData.name,
      nodeData.type,
      nodeData.category,
      nodeData.description,
      nodeData.schema,
      nodeData.version,
      nodeData.is_community,
      nodeData.capabilities,
      nodeData.id,
    )
  }

  async searchNodes(query: string, category?: string): Promise<any[]> {
    let sql = `
      SELECT * FROM nodes
      WHERE (name LIKE ? OR description LIKE ? OR type LIKE ?)
    `
    const params = [`%${query}%`, `%${query}%`, `%${query}%`]

    if (category) {
      sql += ` AND category = ?`
      params.push(category)
    }

    sql += ` ORDER BY name ASC`

    return this.db.rawDatabase?.prepare(sql).all(...params) || []
  }

  async getNodeById(nodeId: string): Promise<any | null> {
    const query = `SELECT * FROM nodes WHERE id = ?`
    return this.db.rawDatabase?.prepare(query).get(nodeId) || null
  }

  async getNodesByCategory(category: string): Promise<any[]> {
    const query = `SELECT * FROM nodes WHERE category = ? ORDER BY name ASC`
    return this.db.rawDatabase?.prepare(query).all(category) || []
  }

  async getPopularNodes(limit = 10): Promise<any[]> {
    const query = `SELECT * FROM popular_nodes LIMIT ?`
    return this.db.rawDatabase?.prepare(query).all(limit) || []
  }

  async getNodeStats(): Promise<{ total: number, community: number, categories: string[] }> {
    const totalQuery = `SELECT COUNT(*) as count FROM nodes`
    const communityQuery = `SELECT COUNT(*) as count FROM nodes WHERE is_community = true`
    const categoriesQuery = `SELECT DISTINCT category FROM nodes ORDER BY category`

    const totalResult = this.db.rawDatabase?.prepare(totalQuery).get() as { count: number } | undefined
    const communityResult = this.db.rawDatabase?.prepare(communityQuery).get() as { count: number } | undefined
    const categoriesResult = this.db.rawDatabase?.prepare(categoriesQuery).all() as { category: string }[] | undefined

    return {
      total: totalResult?.count || 0,
      community: communityResult?.count || 0,
      categories: categoriesResult?.map((row: { category: string }) => row.category) || [],
    }
  }
}
