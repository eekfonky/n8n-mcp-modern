/**
 * Version Tracking Manager for n8n-MCP Modern
 *
 * Phase 1: Version tracking and n8n instance management
 *
 * Handles:
 * - n8n instance registration and tracking
 * - Version change detection
 * - Discovery session management
 * - MCP tool lifecycle tracking
 * - Performance metrics and monitoring
 *
 * Designed for Docker/Watchtower environments where n8n instances
 * are automatically upgraded and discovery needs to be retriggered.
 */

import type { DiscoveryMetrics, DiscoverySession, MCPTool, N8NInstance, VersionChange } from '../types/core.js'
import type { DatabaseManager } from './index.js'
import { randomUUID } from 'node:crypto'
import { logger } from '../server/logger.js'
import { N8NMcpError } from '../types/fast-types.js'

/**
 * Version tracking and instance management
 */
export class VersionManager {
  constructor(private database: DatabaseManager) {}

  // === n8n Instance Management ===

  /**
   * Register or update an n8n instance
   */
  async registerInstance(instance: Omit<N8NInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const instanceId = randomUUID()
    const now = new Date().toISOString()

    return this.database.executeCustomSQL('register-instance', (db) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO n8n_instances (
          id, url, version, edition, last_discovered, discovery_method,
          status, error_count, last_error, capabilities, community_nodes,
          official_node_count, community_node_count, api_response_time,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run([
        instanceId,
        instance.url,
        instance.version,
        instance.edition,
        instance.lastDiscovered.toISOString(),
        instance.discoveryMethod,
        instance.status,
        instance.errorCount,
        instance.lastError || null,
        JSON.stringify(instance.capabilities || {}),
        JSON.stringify(instance.communityNodes || []),
        instance.officialNodeCount,
        instance.communityNodeCount,
        instance.apiResponseTime,
        now,
        now,
      ])

      logger.info('Registered n8n instance', {
        instanceId,
        url: instance.url,
        version: instance.version,
        edition: instance.edition,
        nodeCount: instance.officialNodeCount + instance.communityNodeCount,
      })

      return instanceId
    }) || instanceId
  }

  /**
   * Update existing instance information
   */
  async updateInstance(instanceId: string, updates: Partial<N8NInstance>): Promise<void> {
    this.database.executeCustomSQL('update-instance', (db) => {
      const fields = []
      const values = []

      // Build dynamic update query
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'id' || key === 'createdAt')
          return // Skip immutable fields

        const dbField = this.camelToSnakeCase(key)
        fields.push(`${dbField} = ?`)

        if (value instanceof Date) {
          values.push(value.toISOString())
        }
        else if (typeof value === 'object' && value !== null) {
          values.push(JSON.stringify(value))
        }
        else {
          values.push(value)
        }
      })

      if (fields.length === 0)
        return

      // Always update the updated_at timestamp
      fields.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(instanceId)

      const stmt = db.prepare(`
        UPDATE n8n_instances 
        SET ${fields.join(', ')}
        WHERE id = ?
      `)

      const result = stmt.run(values)

      if (result.changes === 0) {
        throw new N8NMcpError(`Instance not found: ${instanceId}`, 'INSTANCE_NOT_FOUND')
      }

      logger.debug('Updated n8n instance', { instanceId, fields: Object.keys(updates) })
    })
  }

  /**
   * Get instance by ID
   */
  async getInstance(instanceId: string): Promise<N8NInstance | null> {
    return this.database.executeCustomSQL('get-instance', (db) => {
      const row = db.prepare('SELECT * FROM n8n_instances WHERE id = ?').get(instanceId) as Record<string, unknown> | undefined

      if (!row)
        return null

      return this.mapInstanceRow(row)
    })
  }

  /**
   * Get all registered instances
   */
  async getAllInstances(activeOnly: boolean = false): Promise<N8NInstance[]> {
    return this.database.executeCustomSQL('get-all-instances', (db) => {
      let query = 'SELECT * FROM n8n_instances'
      if (activeOnly) {
        query += ' WHERE status = \'active\''
      }
      query += ' ORDER BY created_at DESC'

      const rows = db.prepare(query).all() as Array<Record<string, unknown>>
      return rows.map(row => this.mapInstanceRow(row))
    }) || []
  }

  // === Version Change Detection ===

  /**
   * Detect and record version changes
   */
  async detectVersionChange(instanceId: string, newVersion: string): Promise<VersionChange | null> {
    const instance = await this.getInstance(instanceId)
    if (!instance) {
      throw new N8NMcpError(`Instance not found: ${instanceId}`, 'INSTANCE_NOT_FOUND')
    }

    if (instance.version === newVersion) {
      return null // No version change
    }

    const changeType = this.compareVersions(instance.version, newVersion)

    const versionChange: Omit<VersionChange, 'id'> = {
      instanceId,
      oldVersion: instance.version,
      newVersion,
      detectedAt: new Date(),
      changeType,
      triggerSource: 'discovery',
      rediscoveryRequired: true,
      nodesChanged: 0,
      toolsRegenerated: 0,
    }

    const changeId = this.database.executeCustomSQL('record-version-change', (db) => {
      const stmt = db.prepare(`
        INSERT INTO version_changes (
          instance_id, old_version, new_version, detected_at, change_type,
          trigger_source, rediscovery_required, nodes_changed, tools_regenerated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `)

      const result = stmt.get([
        instanceId,
        instance.version,
        newVersion,
        new Date().toISOString(),
        changeType,
        'discovery',
        1,
        0,
        0,
      ]) as { id: number } | undefined

      return result?.id || 0
    })

    // Update the instance version
    await this.updateInstance(instanceId, { version: newVersion })

    logger.info('Version change detected', {
      instanceId,
      oldVersion: instance.version,
      newVersion,
      changeType,
    })

    return { id: changeId || 0, ...versionChange }
  }

  /**
   * Mark version change rediscovery as completed
   */
  async completeRediscovery(versionChangeId: number, nodesChanged: number, toolsRegenerated: number): Promise<void> {
    this.database.executeCustomSQL('complete-rediscovery', (db) => {
      const stmt = db.prepare(`
        UPDATE version_changes 
        SET rediscovery_required = 0, 
            rediscovery_completed_at = ?,
            nodes_changed = ?,
            tools_regenerated = ?
        WHERE id = ?
      `)

      const result = stmt.run([
        new Date().toISOString(),
        nodesChanged,
        toolsRegenerated,
        versionChangeId,
      ])

      if (result.changes === 0) {
        throw new N8NMcpError(`Version change not found: ${versionChangeId}`, 'VERSION_CHANGE_NOT_FOUND')
      }

      logger.info('Rediscovery completed', { versionChangeId, nodesChanged, toolsRegenerated })
    })
  }

  /**
   * Get pending rediscoveries (for scheduled discovery)
   */
  async getPendingRediscoveries(): Promise<VersionChange[]> {
    return this.database.executeCustomSQL('get-pending-rediscoveries', (db) => {
      const rows = db.prepare(`
        SELECT * FROM version_changes 
        WHERE rediscovery_required = 1 
        ORDER BY detected_at ASC
      `).all() as Array<Record<string, unknown>>

      return rows.map(row => this.mapVersionChangeRow(row))
    }) || []
  }

  // === Discovery Session Management ===

  /**
   * Start a new discovery session
   */
  async startDiscoverySession(session: Omit<DiscoverySession, 'id' | 'startedAt' | 'status'>): Promise<string> {
    const sessionId = randomUUID()

    return this.database.executeCustomSQL('start-discovery-session', (db) => {
      const stmt = db.prepare(`
        INSERT INTO discovery_sessions (
          id, instance_id, started_at, status, discovery_type, trigger,
          nodes_discovered, tools_generated, credentials_tested, execution_time,
          memory_used, errors_count, warnings_count, success_rate,
          discovery_log, performance_metrics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run([
        sessionId,
        session.instanceId,
        new Date().toISOString(),
        'running',
        session.discoveryType,
        session.trigger,
        0, // Will be updated as discovery progresses
        0,
        0,
        0,
        0,
        0,
        0,
        0.0,
        JSON.stringify({}),
        JSON.stringify({}),
      ])

      logger.info('Started discovery session', {
        sessionId,
        instanceId: session.instanceId,
        type: session.discoveryType,
        trigger: session.trigger,
      })

      return sessionId
    }) || sessionId
  }

  /**
   * Complete a discovery session
   */
  async completeDiscoverySession(
    sessionId: string,
    results: Partial<Pick<DiscoverySession, 'nodesDiscovered' | 'toolsGenerated' | 'credentialsTested' | 'errorsCount' | 'warningsCount' | 'discoveryLog' | 'performanceMetrics'>>,
  ): Promise<void> {
    this.database.executeCustomSQL('complete-discovery-session', (db) => {
      const now = new Date().toISOString()

      // Get session start time to calculate execution time
      const session = db.prepare('SELECT started_at FROM discovery_sessions WHERE id = ?').get(sessionId) as { started_at: string } | undefined
      if (!session) {
        throw new N8NMcpError(`Discovery session not found: ${sessionId}`, 'SESSION_NOT_FOUND')
      }

      const executionTime = Date.now() - new Date(session.started_at).getTime()
      const successRate = results.errorsCount
        ? (results.nodesDiscovered || 0) / ((results.nodesDiscovered || 0) + results.errorsCount)
        : 1.0

      const stmt = db.prepare(`
        UPDATE discovery_sessions 
        SET completed_at = ?, status = ?, nodes_discovered = ?, tools_generated = ?,
            credentials_tested = ?, execution_time = ?, errors_count = ?, 
            warnings_count = ?, success_rate = ?, discovery_log = ?, performance_metrics = ?
        WHERE id = ?
      `)

      const updateResult = stmt.run([
        now,
        results.errorsCount && results.errorsCount > 0 ? 'failed' : 'completed',
        results.nodesDiscovered || 0,
        results.toolsGenerated || 0,
        results.credentialsTested || 0,
        executionTime,
        results.errorsCount || 0,
        results.warningsCount || 0,
        successRate,
        JSON.stringify(results.discoveryLog || {}),
        JSON.stringify(results.performanceMetrics || {}),
        sessionId,
      ])

      if (updateResult.changes === 0) {
        throw new N8NMcpError(`Discovery session not found: ${sessionId}`, 'SESSION_NOT_FOUND')
      }

      logger.info('Completed discovery session', {
        sessionId,
        executionTime: `${executionTime}ms`,
        nodesDiscovered: results.nodesDiscovered,
        toolsGenerated: results.toolsGenerated,
        successRate: `${(successRate * 100).toFixed(1)}%`,
      })
    })
  }

  // === MCP Tool Tracking ===

  /**
   * Register a generated MCP tool
   */
  async registerMCPTool(tool: Omit<MCPTool, 'generatedAt' | 'lastUpdated' | 'usageCount' | 'successCount' | 'errorCount' | 'avgExecutionTime' | 'isActive'>): Promise<void> {
    this.database.executeCustomSQL('register-mcp-tool', (db) => {
      const now = new Date().toISOString()

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO mcp_tools (
          id, node_name, instance_id, tool_type, operation_name, schema_hash,
          generated_at, last_updated, usage_count, success_count, error_count,
          avg_execution_time, is_active, discovery_session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run([
        tool.id,
        tool.nodeName,
        tool.instanceId,
        tool.toolType,
        tool.operationName || null,
        tool.schemaHash,
        now,
        now,
        0,
        0,
        0,
        0.0,
        1,
        tool.discoverySessionId || null,
      ])
    })
  }

  /**
   * Update MCP tool usage statistics
   */
  async updateToolUsage(toolId: string, executionTime: number, success: boolean): Promise<void> {
    this.database.executeCustomSQL('update-tool-usage', (db) => {
      const stmt = db.prepare(`
        UPDATE mcp_tools 
        SET usage_count = usage_count + 1,
            success_count = success_count + ?,
            error_count = error_count + ?,
            avg_execution_time = (avg_execution_time * usage_count + ?) / (usage_count + 1),
            last_used = ?
        WHERE id = ?
      `)

      const result = stmt.run([
        success ? 1 : 0,
        success ? 0 : 1,
        executionTime,
        new Date().toISOString(),
        toolId,
      ])

      if (result.changes === 0) {
        logger.warn('Failed to update tool usage - tool not found', { toolId })
      }
    })
  }

  // === Metrics and Monitoring ===

  /**
   * Get comprehensive discovery metrics
   */
  async getDiscoveryMetrics(): Promise<DiscoveryMetrics> {
    return this.database.executeCustomSQL('get-discovery-metrics', (db) => {
      // Get instance counts
      const instanceStats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active
        FROM n8n_instances
      `).get() as { total: number, active: number } | undefined

      // Get node counts
      const nodeStats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN node_type = 'official' THEN 1 END) as official,
          COUNT(CASE WHEN node_type = 'community' THEN 1 END) as community
        FROM nodes WHERE is_active = 1
      `).get() as { total: number, official: number, community: number } | undefined

      // Get tool counts
      const toolStats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN tool_type = 'general' THEN 1 END) as general,
          COUNT(CASE WHEN tool_type = 'operation_specific' THEN 1 END) as operation_specific,
          COUNT(CASE WHEN tool_type = 'category' THEN 1 END) as category
        FROM mcp_tools WHERE is_active = 1
      `).get() as { total: number, general: number, operation_specific: number, category: number } | undefined

      // Get recent session activity
      const sessionStats = db.prepare(`
        SELECT 
          COUNT(*) as last24h,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM discovery_sessions 
        WHERE started_at > datetime('now', '-24 hours')
      `).get() as { last24h: number, successful: number, failed: number } | undefined

      // Get performance metrics
      const perfStats = db.prepare(`
        SELECT 
          AVG(execution_time) as avg_discovery_time,
          AVG(nodes_discovered) as avg_nodes_per_session,
          AVG(tools_generated * 1.0 / NULLIF(nodes_discovered, 0)) as avg_tools_per_node
        FROM discovery_sessions 
        WHERE status = 'completed' AND completed_at > datetime('now', '-30 days')
      `).get() as { avg_discovery_time: number, avg_nodes_per_session: number, avg_tools_per_node: number } | undefined

      // Get version change stats
      const versionStats = db.prepare(`
        SELECT 
          COUNT(*) as last30_days,
          COUNT(CASE WHEN change_type = 'upgrade' THEN 1 END) as upgrades,
          COUNT(CASE WHEN rediscovery_completed_at IS NOT NULL THEN 1 END) as rediscoveries_completed
        FROM version_changes 
        WHERE detected_at > datetime('now', '-30 days')
      `).get() as { last30_days: number, upgrades: number, rediscoveries_completed: number } | undefined

      return {
        totalInstances: instanceStats?.total || 0,
        activeInstances: instanceStats?.active || 0,
        totalNodes: nodeStats?.total || 0,
        nodeBreakdown: {
          official: nodeStats?.official || 0,
          community: nodeStats?.community || 0,
        },
        totalTools: toolStats?.total || 0,
        toolBreakdown: {
          general: toolStats?.general || 0,
          operationSpecific: toolStats?.operation_specific || 0,
          category: toolStats?.category || 0,
        },
        recentSessions: {
          last24h: sessionStats?.last24h || 0,
          successful: sessionStats?.successful || 0,
          failed: sessionStats?.failed || 0,
        },
        performance: {
          avgDiscoveryTime: perfStats?.avg_discovery_time || 0,
          avgNodesPerSession: perfStats?.avg_nodes_per_session || 0,
          avgToolsPerNode: perfStats?.avg_tools_per_node || 0,
        },
        versionChanges: {
          last30Days: versionStats?.last30_days || 0,
          upgradesDetected: versionStats?.upgrades || 0,
          rediscoveriesTriggered: versionStats?.rediscoveries_completed || 0,
        },
      }
    }) || {
      totalInstances: 0,
      activeInstances: 0,
      totalNodes: 0,
      nodeBreakdown: { official: 0, community: 0 },
      totalTools: 0,
      toolBreakdown: { general: 0, operationSpecific: 0, category: 0 },
      recentSessions: { last24h: 0, successful: 0, failed: 0 },
      performance: { avgDiscoveryTime: 0, avgNodesPerSession: 0, avgToolsPerNode: 0 },
      versionChanges: { last30Days: 0, upgradesDetected: 0, rediscoveriesTriggered: 0 },
    }
  }

  // === Helper Methods ===

  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
  }

  private compareVersions(oldVersion: string, newVersion: string): 'upgrade' | 'downgrade' | 'unknown' {
    try {
      const oldParts = oldVersion.split('.').map(Number)
      const newParts = newVersion.split('.').map(Number)

      for (let i = 0; i < Math.max(oldParts.length, newParts.length); i++) {
        const oldPart = oldParts[i] || 0
        const newPart = newParts[i] || 0

        if (newPart > oldPart)
          return 'upgrade'
        if (newPart < oldPart)
          return 'downgrade'
      }

      return 'unknown'
    }
    catch {
      return 'unknown'
    }
  }

  private mapInstanceRow(row: Record<string, unknown>): N8NInstance {
    return {
      id: row.id as string,
      url: row.url as string,
      version: row.version as string,
      edition: row.edition as 'community' | 'cloud' | 'enterprise',
      lastDiscovered: new Date(row.last_discovered as string),
      discoveryMethod: row.discovery_method as 'api' | 'credential_test' | 'manual',
      status: row.status as 'active' | 'inactive' | 'error',
      errorCount: row.error_count as number,
      lastError: row.last_error ? (row.last_error as string) : undefined,
      capabilities: row.capabilities ? JSON.parse(row.capabilities as string) : undefined,
      communityNodes: row.community_nodes ? JSON.parse(row.community_nodes as string) : undefined,
      officialNodeCount: row.official_node_count as number,
      communityNodeCount: row.community_node_count as number,
      apiResponseTime: row.api_response_time as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  private mapVersionChangeRow(row: Record<string, unknown>): VersionChange {
    return {
      id: row.id as number,
      instanceId: row.instance_id as string,
      oldVersion: row.old_version ? (row.old_version as string) : undefined,
      newVersion: row.new_version ? (row.new_version as string) : undefined,
      detectedAt: new Date(row.detected_at as string),
      changeType: row.change_type as 'upgrade' | 'downgrade' | 'unknown',
      triggerSource: row.trigger_source as 'discovery' | 'watchtower' | 'manual',
      rediscoveryRequired: Boolean(row.rediscovery_required),
      rediscoveryCompletedAt: row.rediscovery_completed_at ? new Date(row.rediscovery_completed_at as string) : undefined,
      nodesChanged: row.nodes_changed as number,
      toolsRegenerated: row.tools_regenerated as number,
    }
  }
}
