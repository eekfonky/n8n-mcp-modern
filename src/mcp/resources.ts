/**
 * MCP Resources Implementation
 * Exposes n8n data as contextual resources for LLMs
 */

import type {
  Resource,
  ResourceContents,
} from '@modelcontextprotocol/sdk/types.js'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { simpleN8nApi } from '../n8n/simple-api.js'
import { features } from '../server/config.js'
import { logger } from '../server/logger.js'
import { VERSION } from '../version.js'

const { hasN8nApi } = features

// Type for cached resource data
interface CachedResourceData {
  id: string | number
  name?: string
  type?: string
  lastModified?: Date
  data?: Record<string, unknown>
}

export class ResourceManager extends EventEmitter {
  private subscriptions = new Map<string, Set<string>>()
  private resourceCache = new Map<string, CachedResourceData>()
  private updateInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.startMonitoring()
  }

  /**
   * List all available resources
   */
  async listResources(): Promise<Resource[]> {
    const resources: Resource[] = []

    // Always available resources
    resources.push({
      uri: 'n8n://system/info',
      name: 'System Information',
      description: 'n8n system status and configuration',
      mimeType: 'application/json',
    })

    resources.push({
      uri: 'n8n://nodes/registry',
      name: 'Node Registry',
      description: 'Available n8n nodes and their capabilities',
      mimeType: 'application/json',
    })

    if (hasN8nApi) {
      try {
        // Workflow resources
        const workflows = await simpleN8nApi.getWorkflows()
        if (workflows) {
          workflows.forEach((wf) => {
            resources.push({
              uri: `n8n://workflow/${wf.id}`,
              name: wf.name || `Workflow ${wf.id}`,
              description: `Workflow configuration and nodes`,
              mimeType: 'application/json',
            })
          })
        }

        // Credential resources (metadata only)
        const credentials = await simpleN8nApi.getCredentials()
        if (credentials) {
          credentials.forEach((cred) => {
            resources.push({
              uri: `n8n://credential/${cred.id}`,
              name: cred.name,
              description: `Credential metadata for ${cred.type}`,
              mimeType: 'application/json',
            })
          })
        }

        // Execution resources
        const executions = await simpleN8nApi.getExecutions()
        if (executions) {
          executions.forEach((exec) => {
            resources.push({
              uri: `n8n://execution/${exec.id}`,
              name: `Execution ${exec.id}`,
              description: `Execution details and results`,
              mimeType: 'application/json',
            })
          })
        }

        // Variables resource
        resources.push({
          uri: 'n8n://variables',
          name: 'Environment Variables',
          description: 'n8n environment variables',
          mimeType: 'application/json',
        })

        // Tags resource
        resources.push({
          uri: 'n8n://tags',
          name: 'Workflow Tags',
          description: 'Available workflow tags',
          mimeType: 'application/json',
        })
      }
      catch (error) {
        logger.error('Failed to list n8n resources:', error)
      }
    }

    return resources
  }

  /**
   * Read a specific resource
   */
  async readResource(uri: string): Promise<ResourceContents[]> {
    const parts = uri.replace('n8n://', '').split('/')
    const resourceType = parts[0]
    const resourceId = parts[1]

    try {
      let content: Record<string, unknown> | null = null
      let text: string = ''

      switch (resourceType) {
        case 'system':
          if (resourceId === 'info') {
            content = {
              version: VERSION,
              mode: 'dynamic',
              hasN8nConnection: hasN8nApi,
              capabilities: {
                tools: true,
                resources: true,
                prompts: true,
                completions: true,
                logging: true,
              },
              memory: process.memoryUsage(),
              uptime: process.uptime(),
            }
          }
          break

        case 'nodes':
          if (resourceId === 'registry') {
            if (hasN8nApi) {
              const nodes = await simpleN8nApi.getNodeTypes()
              content = { nodes }
            }
            else {
              content = { error: 'n8n connection not configured' }
            }
          }
          break

        case 'workflow':
          if (hasN8nApi && resourceId) {
            const workflow = await simpleN8nApi.getWorkflow(resourceId)
            content = workflow as unknown as Record<string, unknown>
          }
          break

        case 'credential':
          if (hasN8nApi && resourceId) {
            const credential = await simpleN8nApi.getCredential(resourceId)
            // Only return metadata, not actual credential values
            content = {
              id: credential?.id,
              name: credential?.name,
              type: credential?.type,
              // Note: createdAt/updatedAt not available in CredentialData
            }
          }
          break

        case 'execution':
          if (hasN8nApi && resourceId) {
            const execution = await simpleN8nApi.getExecution(resourceId)
            content = execution as unknown as Record<string, unknown>
          }
          break

        case 'variables':
          if (hasN8nApi) {
            const variables = await simpleN8nApi.getVariables()
            content = { variables }
          }
          break

        case 'tags':
          if (hasN8nApi) {
            const tags = await simpleN8nApi.getTags()
            content = { tags }
          }
          break

        default:
          throw new Error(`Unknown resource type: ${resourceType}`)
      }

      text = JSON.stringify(content, null, 2)

      return [{
        uri,
        mimeType: 'application/json',
        text,
      }]
    }
    catch (error) {
      logger.error(`Failed to read resource ${uri}:`, error)
      throw error
    }
  }

  /**
   * Subscribe to resource changes
   */
  async subscribe(uri: string, sessionId: string): Promise<void> {
    if (!this.subscriptions.has(uri)) {
      this.subscriptions.set(uri, new Set())
    }
    const subscriptions = this.subscriptions.get(uri)
    if (subscriptions) {
      subscriptions.add(sessionId)
    }
    logger.debug(`Session ${sessionId} subscribed to ${uri}`)
  }

  /**
   * Unsubscribe from resource changes
   */
  async unsubscribe(uri: string, sessionId: string): Promise<void> {
    const subs = this.subscriptions.get(uri)
    if (subs) {
      subs.delete(sessionId)
      if (subs.size === 0) {
        this.subscriptions.delete(uri)
      }
    }
    logger.debug(`Session ${sessionId} unsubscribed from ${uri}`)
  }

  /**
   * Monitor resources for changes
   */
  private startMonitoring(): void {
    if (!hasN8nApi)
      return

    this.updateInterval = setInterval(async () => {
      try {
        // Check for workflow changes
        const workflows = await simpleN8nApi.getWorkflows()
        const currentWorkflowIds = workflows?.map(w => w.id) || []
        const cachedWorkflowIds = Array.from(this.resourceCache.keys())
          .filter(k => k.startsWith('workflow/'))
          .map(k => k.split('/')[1])

        // Detect new or removed workflows
        const added = currentWorkflowIds.filter(id => !cachedWorkflowIds.includes(id))
        const removed = cachedWorkflowIds.filter(id => !currentWorkflowIds.includes(id))

        if (added.length > 0 || removed.length > 0) {
          this.emit('resources_changed', { added, removed })
        }

        // Update cache
        for (const workflow of workflows || []) {
          if (workflow.id) {
            const key = `workflow/${workflow.id}`
            const cached = this.resourceCache.get(key)
            const cacheData: CachedResourceData = {
              id: workflow.id,
              name: workflow.name,
              type: 'workflow',
              data: workflow as unknown as Record<string, unknown>,
            }
            if (JSON.stringify(cached) !== JSON.stringify(cacheData)) {
              this.resourceCache.set(key, cacheData)
              this.notifySubscribers(`n8n://workflow/${workflow.id}`, workflow as unknown as Record<string, unknown>)
            }
          }
        }
      }
      catch (error) {
        logger.error('Resource monitoring error:', error)
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Notify subscribers of resource changes
   */
  private notifySubscribers(uri: string, content: Record<string, unknown>): void {
    const subscribers = this.subscriptions.get(uri)
    if (subscribers) {
      for (const sessionId of subscribers) {
        this.emit('resource_updated', { uri, content, sessionId })
      }
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
    this.subscriptions.clear()
    this.resourceCache.clear()
  }
}

// Singleton instance
export const resourceManager = new ResourceManager()
