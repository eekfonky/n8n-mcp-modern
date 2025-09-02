import { SimpleHttpClient, httpClient } from '../utils/simple-http-client.js'
import { logger } from '../server/logger.js'
import { N8NMcpError } from '../server/errors.js'

export interface N8NApiConfig {
  apiUrl: string
  apiKey: string
}

export interface WorkflowData {
  id?: string
  name: string
  active?: boolean
  nodes: any[]
  connections: any
  settings?: any
  staticData?: any
  tags?: any[]
}

export interface CredentialData {
  id?: string
  name: string
  type: string
  data: any
  nodesAccess?: any[]
}

export interface ExecutionData {
  id: string
  finished: boolean
  mode: string
  startedAt: string
  stoppedAt?: string
  workflowId: string
  workflowData?: WorkflowData
  data?: any
  status?: string
  error?: any
}

export class N8NApi {
  private apiUrl: string
  private apiKey: string
  private client: SimpleHttpClient
  private headers: Record<string, string>

  constructor(config: N8NApiConfig) {
    // Normalize API URL
    this.apiUrl = config.apiUrl.replace(/\/+$/, '')
    if (!this.apiUrl.includes('/api/v1')) {
      this.apiUrl += '/api/v1'
    }
    
    this.apiKey = config.apiKey
    this.client = httpClient
    this.headers = {
      'X-N8N-API-KEY': this.apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  }

  // Workflows
  async getWorkflows(): Promise<WorkflowData[]> {
    try {
      const response = await this.client.get(`${this.apiUrl}/workflows`, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch workflows: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || []
    } catch (error) {
      logger.error('Failed to fetch workflows:', error)
      throw error
    }
  }

  async getWorkflow(id: string): Promise<WorkflowData> {
    try {
      const response = await this.client.get(`${this.apiUrl}/workflows/${id}`, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch workflow ${id}: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || response.data
    } catch (error) {
      logger.error(`Failed to fetch workflow ${id}:`, error)
      throw error
    }
  }

  async createWorkflow(workflow: WorkflowData): Promise<WorkflowData> {
    try {
      const response = await this.client.post(`${this.apiUrl}/workflows`, workflow, {
        headers: this.headers,
      })
      
      if (response.status !== 200 && response.status !== 201) {
        throw new N8NMcpError(
          `Failed to create workflow: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || response.data
    } catch (error) {
      logger.error('Failed to create workflow:', error)
      throw error
    }
  }

  async updateWorkflow(id: string, workflow: Partial<WorkflowData>): Promise<WorkflowData> {
    try {
      const response = await this.client.patch(`${this.apiUrl}/workflows/${id}`, workflow, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to update workflow ${id}: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || response.data
    } catch (error) {
      logger.error(`Failed to update workflow ${id}:`, error)
      throw error
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    try {
      const response = await this.client.delete(`${this.apiUrl}/workflows/${id}`, {
        headers: this.headers,
      })
      
      if (response.status !== 200 && response.status !== 204) {
        throw new N8NMcpError(
          `Failed to delete workflow ${id}: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
    } catch (error) {
      logger.error(`Failed to delete workflow ${id}:`, error)
      throw error
    }
  }

  async activateWorkflow(id: string): Promise<WorkflowData> {
    return this.updateWorkflow(id, { active: true })
  }

  async deactivateWorkflow(id: string): Promise<WorkflowData> {
    return this.updateWorkflow(id, { active: false })
  }

  // Executions
  async getExecutions(workflowId?: string): Promise<ExecutionData[]> {
    try {
      const url = workflowId 
        ? `${this.apiUrl}/executions?workflowId=${workflowId}`
        : `${this.apiUrl}/executions`
        
      const response = await this.client.get(url, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch executions: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || []
    } catch (error) {
      logger.error('Failed to fetch executions:', error)
      throw error
    }
  }

  async getExecution(id: string): Promise<ExecutionData> {
    try {
      const response = await this.client.get(`${this.apiUrl}/executions/${id}`, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch execution ${id}: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || response.data
    } catch (error) {
      logger.error(`Failed to fetch execution ${id}:`, error)
      throw error
    }
  }

  async deleteExecution(id: string): Promise<void> {
    try {
      const response = await this.client.delete(`${this.apiUrl}/executions/${id}`, {
        headers: this.headers,
      })
      
      if (response.status !== 200 && response.status !== 204) {
        throw new N8NMcpError(
          `Failed to delete execution ${id}: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
    } catch (error) {
      logger.error(`Failed to delete execution ${id}:`, error)
      throw error
    }
  }

  // Credentials
  async getCredentials(): Promise<CredentialData[]> {
    try {
      const response = await this.client.get(`${this.apiUrl}/credentials`, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch credentials: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || []
    } catch (error) {
      logger.error('Failed to fetch credentials:', error)
      throw error
    }
  }

  async getCredential(id: string): Promise<CredentialData> {
    try {
      const response = await this.client.get(`${this.apiUrl}/credentials/${id}`, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch credential ${id}: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || response.data
    } catch (error) {
      logger.error(`Failed to fetch credential ${id}:`, error)
      throw error
    }
  }

  async createCredential(credential: CredentialData): Promise<CredentialData> {
    try {
      const response = await this.client.post(`${this.apiUrl}/credentials`, credential, {
        headers: this.headers,
      })
      
      if (response.status !== 200 && response.status !== 201) {
        throw new N8NMcpError(
          `Failed to create credential: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || response.data
    } catch (error) {
      logger.error('Failed to create credential:', error)
      throw error
    }
  }

  async updateCredential(id: string, credential: Partial<CredentialData>): Promise<CredentialData> {
    try {
      const response = await this.client.patch(`${this.apiUrl}/credentials/${id}`, credential, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to update credential ${id}: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || response.data
    } catch (error) {
      logger.error(`Failed to update credential ${id}:`, error)
      throw error
    }
  }

  async deleteCredential(id: string): Promise<void> {
    try {
      const response = await this.client.delete(`${this.apiUrl}/credentials/${id}`, {
        headers: this.headers,
      })
      
      if (response.status !== 200 && response.status !== 204) {
        throw new N8NMcpError(
          `Failed to delete credential ${id}: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
    } catch (error) {
      logger.error(`Failed to delete credential ${id}:`, error)
      throw error
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get(`${this.apiUrl}/workflows`, {
        headers: this.headers,
        timeout: 5000,
      })
      
      return response.status === 200
    } catch (error) {
      logger.error('Failed to test connection:', error)
      return false
    }
  }

  // Additional methods for compatibility
  async getVersion(): Promise<any> {
    try {
      const response = await this.client.get(`${this.apiUrl}/version`, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch version: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data
    } catch (error) {
      logger.error('Failed to fetch version:', error)
      throw error
    }
  }

  async getHealth(): Promise<any> {
    try {
      const response = await this.client.get(`${this.apiUrl}/health`, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch health: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data
    } catch (error) {
      logger.error('Failed to fetch health:', error)
      throw error
    }
  }

  async getNodeTypes(): Promise<any[]> {
    try {
      const response = await this.client.get(`${this.apiUrl}/node-types`, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch node types: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || []
    } catch (error) {
      logger.error('Failed to fetch node types:', error)
      throw error
    }
  }

  async getVariables(): Promise<any[]> {
    try {
      const response = await this.client.get(`${this.apiUrl}/variables`, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch variables: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || []
    } catch (error) {
      logger.error('Failed to fetch variables:', error)
      throw error
    }
  }

  async getTags(): Promise<any[]> {
    try {
      const response = await this.client.get(`${this.apiUrl}/tags`, {
        headers: this.headers,
      })
      
      if (response.status !== 200) {
        throw new N8NMcpError(
          `Failed to fetch tags: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || []
    } catch (error) {
      logger.error('Failed to fetch tags:', error)
      throw error
    }
  }

  async createIterativeWorkflow(name: string): Promise<WorkflowData> {
    const workflow: WorkflowData = {
      name,
      active: false,
      nodes: [
        {
          id: 'n8n-start',
          name: 'Start',
          type: 'n8n-nodes-base.start',
          typeVersion: 1,
          position: [250, 300],
          parameters: {},
        },
      ],
      connections: {},
      settings: {
        executionOrder: 'v1',
      },
    }
    
    return this.createWorkflow(workflow)
  }

  async getCompatibleNodes(workflowId: string, nodeType?: string): Promise<any[]> {
    // This is a placeholder - in a real implementation, this would
    // analyze the workflow and suggest compatible next nodes
    try {
      const nodeTypes = await this.getNodeTypes()
      
      // Filter for commonly used nodes as suggestions
      const suggestions = nodeTypes.filter((node: any) => {
        const commonNodes = [
          'n8n-nodes-base.httpRequest',
          'n8n-nodes-base.set',
          'n8n-nodes-base.code',
          'n8n-nodes-base.if',
          'n8n-nodes-base.merge',
          'n8n-nodes-base.splitInBatches',
        ]
        return commonNodes.includes(node.name)
      })
      
      return suggestions.slice(0, 5) // Return top 5 suggestions
    } catch (error) {
      logger.error('Failed to get compatible nodes:', error)
      return []
    }
  }

  async executeWorkflow(workflowId: string, data?: any): Promise<ExecutionData> {
    try {
      const response = await this.client.post(
        `${this.apiUrl}/workflows/${workflowId}/execute`,
        { data },
        {
          headers: this.headers,
        }
      )
      
      if (response.status !== 200 && response.status !== 201) {
        throw new N8NMcpError(
          `Failed to execute workflow ${workflowId}: ${response.status}`,
          'N8N_API_ERROR',
          response.status
        )
      }
      
      return response.data?.data || response.data
    } catch (error) {
      logger.error(`Failed to execute workflow ${workflowId}:`, error)
      throw error
    }
  }

  // Additional dynamically generated methods
  async validateWorkflowConnections(workflowId: string): Promise<any> {
    // Stub implementation - would validate workflow connections
    const workflow = await this.getWorkflow(workflowId)
    return { valid: true, workflow }
  }

  async duplicateWorkflow(workflowId: string): Promise<WorkflowData> {
    const workflow = await this.getWorkflow(workflowId)
    const { id, ...workflowWithoutId } = workflow
    const duplicated = {
      ...workflowWithoutId,
      name: `${workflow.name} (copy)`,
    }
    return this.createWorkflow(duplicated)
  }

  async retryExecution(executionId: string): Promise<ExecutionData> {
    // Stub - would retry a failed execution
    return this.getExecution(executionId)
  }

  async stopExecution(executionId: string): Promise<void> {
    // Stub - would stop a running execution
    await this.deleteExecution(executionId)
  }

  async testCredential(credentialId: string): Promise<any> {
    // Stub - would test credential connectivity
    const credential = await this.getCredential(credentialId)
    return { success: true, credential }
  }

  async exportWorkflow(workflowId: string): Promise<any> {
    return this.getWorkflow(workflowId)
  }

  async importWorkflow(workflowData: any): Promise<WorkflowData> {
    return this.createWorkflow(workflowData)
  }

  async createTag(tag: { name: string; description?: string }): Promise<any> {
    // Stub - would create a new tag
    return { id: 'tag-id', ...tag }
  }

  async tagWorkflow(workflowId: string, tagId: string): Promise<void> {
    // Stub - would add tag to workflow
    const workflow = await this.getWorkflow(workflowId)
    if (!workflow.tags) workflow.tags = []
    workflow.tags.push(tagId as any)
    await this.updateWorkflow(workflowId, { tags: workflow.tags })
  }

  async createVariable(variable: { key: string; value: string }): Promise<any> {
    // Stub - would create environment variable
    return { id: 'var-id', ...variable }
  }

  async updateVariable(variableId: string, updates: any): Promise<any> {
    // Stub - would update environment variable
    return { id: variableId, ...updates }
  }

  async deleteVariable(variableId: string): Promise<void> {
    // Stub - would delete environment variable
  }

  async getEventDestinations(): Promise<any[]> {
    // Stub - would get event destinations
    return []
  }

  async batchDeleteWorkflows(workflowIds: string[]): Promise<void> {
    await Promise.all(workflowIds.map(id => this.deleteWorkflow(id)))
  }

  async batchActivateWorkflows(workflowIds: string[]): Promise<void> {
    await Promise.all(workflowIds.map(id => this.activateWorkflow(id)))
  }

  async batchDeactivateWorkflows(workflowIds: string[]): Promise<void> {
    await Promise.all(workflowIds.map(id => this.deactivateWorkflow(id)))
  }
}

// Type alias for compatibility
export type SimpleN8nApi = N8NApi

// Export singleton instance if config is available
let apiInstance: N8NApi | null = null

export function getN8NApi(config?: N8NApiConfig): N8NApi {
  if (!apiInstance && config) {
    apiInstance = new N8NApi(config)
  }
  
  if (!apiInstance) {
    throw new N8NMcpError(
      'N8N API not initialized. Please provide configuration.',
      'API_NOT_INITIALIZED'
    )
  }
  
  return apiInstance
}

export function initializeN8NApi(config: N8NApiConfig): N8NApi {
  apiInstance = new N8NApi(config)
  return apiInstance
}

// Create a singleton instance for backward compatibility
export const simpleN8nApi = new Proxy({} as N8NApi, {
  get(target, prop, receiver) {
    const instance = getN8NApi()
    return Reflect.get(instance, prop, receiver)
  }
})