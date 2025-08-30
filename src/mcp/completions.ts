/**
 * MCP Completions Implementation
 * Provides intelligent autocompletion for n8n parameters
 */

import type {
  CompleteRequest,
  CompleteResult,
} from '@modelcontextprotocol/sdk/types.js'
import { simpleN8nApi } from '../n8n/simple-api.js'
import { logger } from '../server/logger.js'
import { hasN8nApi } from '../simple-config.js'
import { getAllNodeTemplates } from '../tools/comprehensive-node-registry.js'

export class CompletionManager {
  private nodeCache: Map<string, any> = new Map()
  private credentialTypes: Set<string> = new Set()

  constructor() {
    this.initializeCache()
  }

  /**
   * Initialize completion caches
   */
  private async initializeCache() {
    try {
      // Cache node templates
      const templates = await getAllNodeTemplates()
      templates.forEach((template) => {
        this.nodeCache.set(template.name, template)
      })

      // Cache credential types if n8n is connected
      if (hasN8nApi) {
        const credentials = await simpleN8nApi.getCredentials()
        if (credentials) {
          credentials.forEach((cred) => {
            this.credentialTypes.add(cred.type)
          })
        }
      }
    }
    catch (error) {
      logger.error('Failed to initialize completion cache:', error)
    }
  }

  /**
   * Provide completions for a given context
   */
  async complete(request: CompleteRequest): Promise<CompleteResult> {
    const { ref, argument } = request.params
    const context = request.params.context || {}

    try {
      // Handle different completion contexts
      if (ref.type === 'ref/prompt') {
        return this.completePromptArgument(ref.name, argument, context)
      }
      else if (ref.type === 'ref/resource') {
        return this.completeResourceArgument(ref.uri, argument, context)
      }
      else if (ref.type === 'ref/tool') {
        return this.completeToolArgument(ref.name, argument, context)
      }

      // Default: no completions
      return {
        completion: {
          values: [],
          total: 0,
          hasMore: false,
        },
      }
    }
    catch (error) {
      logger.error('Completion error:', error)
      return {
        completion: {
          values: [],
          total: 0,
          hasMore: false,
        },
      }
    }
  }

  /**
   * Complete prompt arguments
   */
  private async completePromptArgument(
    promptName: string,
    argument: { name: string, value: string },
    context: any,
  ): Promise<CompleteResult> {
    const values: string[] = []

    switch (promptName) {
      case 'create-workflow':
        if (argument.name === 'nodes') {
          // Suggest node types
          const nodeTypes = Array.from(this.nodeCache.keys())
          const filtered = nodeTypes
            .filter(n => n.toLowerCase().includes(argument.value.toLowerCase()))
            .slice(0, 20)
          values.push(...filtered)
        }
        break

      case 'configure-node':
        if (argument.name === 'nodeType') {
          // Suggest node types
          const nodeTypes = Array.from(this.nodeCache.keys())
          const filtered = nodeTypes
            .filter(n => n.toLowerCase().includes(argument.value.toLowerCase()))
            .slice(0, 20)
          values.push(...filtered)
        }
        break

      case 'integrate-api':
        if (argument.name === 'apiName') {
          // Suggest common APIs
          const commonApis = [
            'Slack',
            'Discord',
            'Telegram',
            'GitHub',
            'GitLab',
            'Google Sheets',
            'Google Drive',
            'Gmail',
            'Google Calendar',
            'Notion',
            'Airtable',
            'Baserow',
            'Supabase',
            'Stripe',
            'PayPal',
            'Shopify',
            'WooCommerce',
            'HubSpot',
            'Salesforce',
            'Pipedrive',
            'Zendesk',
            'Jira',
            'Trello',
            'Asana',
            'Monday.com',
            'Twitter',
            'LinkedIn',
            'Facebook',
            'Instagram',
            'OpenAI',
            'Anthropic',
            'Hugging Face',
            'Replicate',
          ]
          const filtered = commonApis
            .filter(api => api.toLowerCase().includes(argument.value.toLowerCase()))
          values.push(...filtered)
        }
        break

      case 'automation-pattern':
        if (argument.name === 'pattern') {
          const patterns = [
            'batch-processing',
            'scheduled-sync',
            'event-driven',
            'webhook-triggered',
            'polling',
            'streaming',
            'queue-processing',
            'parallel-processing',
            'sequential-processing',
            'conditional-routing',
            'error-retry',
            'rate-limited',
            'paginated-fetch',
            'incremental-sync',
            'full-sync',
          ]
          const filtered = patterns
            .filter(p => p.includes(argument.value.toLowerCase()))
          values.push(...filtered)
        }
        break
    }

    return {
      completion: {
        values,
        total: values.length,
        hasMore: false,
      },
    }
  }

  /**
   * Complete resource arguments
   */
  private async completeResourceArgument(
    resourceUri: string,
    argument: { name: string, value: string },
    context: any,
  ): Promise<CompleteResult> {
    const values: string[] = []

    // Parse resource URI
    if (resourceUri.startsWith('n8n://')) {
      const parts = resourceUri.replace('n8n://', '').split('/')
      const resourceType = parts[0]

      if (resourceType === 'workflow' && hasN8nApi) {
        // Suggest workflow IDs or names
        const workflows = await simpleN8nApi.getWorkflows()
        if (workflows) {
          workflows.forEach((wf) => {
            if (wf.name?.toLowerCase().includes(argument.value.toLowerCase())) {
              values.push(wf.id.toString())
              if (wf.name)
                values.push(wf.name)
            }
          })
        }
      }
      else if (resourceType === 'credential' && hasN8nApi) {
        // Suggest credential types
        const credTypes = Array.from(this.credentialTypes)
        const filtered = credTypes
          .filter(t => t.toLowerCase().includes(argument.value.toLowerCase()))
        values.push(...filtered)
      }
    }

    return {
      completion: {
        values: values.slice(0, 20),
        total: values.length,
        hasMore: values.length > 20,
      },
    }
  }

  /**
   * Complete tool arguments
   */
  private async completeToolArgument(
    toolName: string,
    argument: { name: string, value: string },
    context: any,
  ): Promise<CompleteResult> {
    const values: string[] = []

    // Node-specific completions
    if (toolName.startsWith('node-')) {
      const nodeType = toolName.replace('node-', '').replace(/-/g, '.')

      if (argument.name === 'operation') {
        // Suggest operations for this node type
        const nodeTemplate = this.nodeCache.get(nodeType)
        if (nodeTemplate?.properties) {
          const operations = nodeTemplate.properties
            .filter((p: any) => p.name === 'operation')
            .flatMap((p: any) => p.options || [])
            .map((o: any) => o.value)
            .filter((v: string) => v.toLowerCase().includes(argument.value.toLowerCase()))
          values.push(...operations)
        }
      }
      else if (argument.name === 'resource') {
        // Suggest resources for this node type
        const nodeTemplate = this.nodeCache.get(nodeType)
        if (nodeTemplate?.properties) {
          const resources = nodeTemplate.properties
            .filter((p: any) => p.name === 'resource')
            .flatMap((p: any) => p.options || [])
            .map((o: any) => o.value)
            .filter((v: string) => v.toLowerCase().includes(argument.value.toLowerCase()))
          values.push(...resources)
        }
      }
    }

    // Workflow management completions
    if (toolName === 'workflow-execute' && argument.name === 'workflowId' && hasN8nApi) {
      const workflows = await simpleN8nApi.getWorkflows()
      if (workflows) {
        workflows.forEach((wf) => {
          if (wf.name?.toLowerCase().includes(argument.value.toLowerCase())
            || wf.id.toString().includes(argument.value)) {
            values.push(wf.id.toString())
          }
        })
      }
    }

    // Credential completions
    if (toolName === 'credential-test' && argument.name === 'credentialId' && hasN8nApi) {
      const credentials = await simpleN8nApi.getCredentials()
      if (credentials) {
        credentials.forEach((cred) => {
          if (cred.name.toLowerCase().includes(argument.value.toLowerCase())
            || cred.id.toString().includes(argument.value)) {
            values.push(cred.id.toString())
          }
        })
      }
    }

    return {
      completion: {
        values: values.slice(0, 20),
        total: values.length,
        hasMore: values.length > 20,
      },
    }
  }

  /**
   * Provide expression completions for n8n
   */
  async completeExpression(
    expression: string,
    cursorPosition: number,
  ): Promise<CompleteResult> {
    const values: string[] = []

    // Common n8n expressions
    const expressions = [
      '$json',
      '$input',
      '$node',
      '$workflow',
      '$execution',
      '$now',
      '$today',
      '$items()',
      '$item()',
      '$binary',
      '$env',
      '{{ $json }}',
      '{{ $node["NodeName"].json }}',
      '{{ $workflow.id }}',
      '{{ $execution.id }}',
      '{{ $now }}',
      '{{ $today }}',
      '{{ $items("NodeName") }}',
      '{{ $parameter["paramName"] }}',
    ]

    // Filter based on current input
    const currentWord = this.getCurrentWord(expression, cursorPosition)
    const filtered = expressions
      .filter(exp => exp.includes(currentWord))

    values.push(...filtered)

    return {
      completion: {
        values,
        total: values.length,
        hasMore: false,
      },
    }
  }

  /**
   * Get current word being typed
   */
  private getCurrentWord(text: string, position: number): string {
    const before = text.substring(0, position)
    const after = text.substring(position)

    const beforeMatch = before.match(/[\w$]+$/)
    const afterMatch = after.match(/^[\w$]+/)

    const beforePart = beforeMatch ? beforeMatch[0] : ''
    const afterPart = afterMatch ? afterMatch[0] : ''

    return beforePart + afterPart
  }

  /**
   * Refresh caches
   */
  async refresh() {
    await this.initializeCache()
  }
}

// Singleton instance
export const completionManager = new CompletionManager()
