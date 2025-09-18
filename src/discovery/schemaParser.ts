import { logger } from '../server/logger.js'

export interface NodeParameter {
  name: string
  type: string
  required: boolean
  description?: string
  options?: Array<{ name: string, value: string | number | boolean }>
  default?: string | number | boolean | object
}

export interface NodeSchema {
  nodeId: string
  displayName: string
  description: string
  parameters: NodeParameter[]
  inputPorts: number
  outputPorts: number
  credentials?: string[]
  webhookSupport: boolean
  triggerNode: boolean
}

export class SchemaParser {
  static parseNodeSchema(nodeData: Record<string, unknown>): NodeSchema {
    try {
      const schema = typeof nodeData.schema === 'string'
        ? JSON.parse(nodeData.schema)
        : nodeData.schema

      const parameters = this.extractParameters(schema.properties || [])
      const credentials = this.extractCredentials(schema.credentials || [])

      return {
        nodeId: String((nodeData as any).id || 'unknown'),
        displayName: String((nodeData as any).name || 'Unknown Node'),
        description: (nodeData as any).description || '',
        parameters,
        inputPorts: this.getInputPorts(schema),
        outputPorts: this.getOutputPorts(schema),
        credentials,
        webhookSupport: this.hasWebhookSupport(schema),
        triggerNode: this.isTriggerNode(schema),
      }
    }
    catch (error) {
      logger.error(`Failed to parse schema for node ${(nodeData as any).id}:`, error)
      return {
        nodeId: String((nodeData as any).id || 'unknown'),
        displayName: String((nodeData as any).name || 'Unknown Node'),
        description: (nodeData as any).description || '',
        parameters: [],
        inputPorts: 1,
        outputPorts: 1,
        webhookSupport: false,
        triggerNode: false,
      }
    }
  }

  private static extractParameters(properties: unknown): NodeParameter[] {
    if (!Array.isArray(properties)) {
      return []
    }

    return (properties as any[]).map((prop: any) => ({
      name: String(prop.name || prop.displayName || ''),
      type: String(prop.type || 'string'),
      required: prop.required === true,
      description: String(prop.description || ''),
      options: prop.options || undefined,
      default: prop.default,
    }))
  }

  private static extractCredentials(credentials: unknown): string[] {
    if (!Array.isArray(credentials)) {
      return []
    }

    return credentials.map(cred => cred.name || cred.displayName || '').filter(Boolean)
  }

  private static getInputPorts(schema: unknown): number {
    const s = schema as any
    if (s && s.inputs && Array.isArray(s.inputs)) {
      return s.inputs.length
    }
    return s ? (s.maxNodes || 1) : 1
  }

  private static getOutputPorts(schema: unknown): number {
    const s = schema as any
    if (s && s.outputs && Array.isArray(s.outputs)) {
      return s.outputs.length
    }
    return s ? (s.outputs || 1) : 1
  }

  private static hasWebhookSupport(schema: unknown): boolean {
    const s = schema as any
    return s.webhooks && s.webhooks.length > 0
  }

  private static isTriggerNode(schema: unknown): boolean {
    const s = schema as any
    return s.group?.includes('trigger')
      || String(s.name || '').toLowerCase().includes('trigger')
      || String(s.displayName || '').toLowerCase().includes('trigger')
  }

  static generateMCPToolSchema(nodeSchema: NodeSchema): Record<string, unknown> {
    const toolName = `n8n_${nodeSchema.nodeId.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`

    const inputSchema: Record<string, any> = {}

    for (const param of nodeSchema.parameters) {
      const paramSchema: Record<string, unknown> = {
        type: this.mapParameterType(param.type),
        description: param.description || `${param.name} parameter`,
      }

      if (param.options && param.options.length > 0) {
        paramSchema.enum = param.options.map(opt => opt.value || opt)
      }

      if (param.default !== undefined) {
        paramSchema.default = param.default
      }

      inputSchema[param.name] = paramSchema
    }

    return {
      name: toolName,
      description: `Execute ${nodeSchema.displayName} node: ${nodeSchema.description}`,
      inputSchema,
      metadata: {
        nodeId: nodeSchema.nodeId,
        displayName: nodeSchema.displayName,
        inputPorts: nodeSchema.inputPorts,
        outputPorts: nodeSchema.outputPorts,
        credentials: nodeSchema.credentials,
        webhookSupport: nodeSchema.webhookSupport,
        triggerNode: nodeSchema.triggerNode,
      },
    }
  }

  private static mapParameterType(n8nType: string): string {
    switch (n8nType.toLowerCase()) {
      case 'string':
      case 'collection':
      case 'fixedcollection':
        return 'string'
      case 'number':
        return 'number'
      case 'boolean':
        return 'boolean'
      case 'options':
        return 'string'
      case 'multiOptions':
        return 'array'
      case 'json':
        return 'object'
      default:
        return 'string'
    }
  }

  static extractUseCases(nodeSchema: NodeSchema): string[] {
    const useCases: string[] = []
    const name = nodeSchema.displayName.toLowerCase()
    const description = nodeSchema.description.toLowerCase()

    // Common use case patterns
    const patterns = [
      { keywords: ['webhook', 'trigger'], useCase: 'Event Triggering' },
      { keywords: ['http', 'api', 'request'], useCase: 'API Integration' },
      { keywords: ['database', 'sql', 'mysql', 'postgres'], useCase: 'Database Operations' },
      { keywords: ['email', 'smtp', 'mail'], useCase: 'Email Automation' },
      { keywords: ['slack', 'discord', 'teams'], useCase: 'Team Communication' },
      { keywords: ['file', 'upload', 'download'], useCase: 'File Management' },
      { keywords: ['schedule', 'cron', 'interval'], useCase: 'Scheduled Tasks' },
      { keywords: ['transform', 'convert', 'format'], useCase: 'Data Transformation' },
      { keywords: ['notification', 'alert', 'sms'], useCase: 'Notifications' },
      { keywords: ['storage', 'cloud', 'aws', 'gcp'], useCase: 'Cloud Storage' },
    ]

    for (const pattern of patterns) {
      if (pattern.keywords.some(keyword =>
        name.includes(keyword) || description.includes(keyword),
      )) {
        useCases.push(pattern.useCase)
      }
    }

    return [...new Set(useCases)] // Remove duplicates
  }

  static generateWorkflowHints(nodeSchema: NodeSchema): string[] {
    const hints: string[] = []

    if (nodeSchema.triggerNode) {
      hints.push('This is a trigger node - use as the starting point of workflows')
    }

    if (nodeSchema.webhookSupport) {
      hints.push('Supports webhooks for real-time event processing')
    }

    if (nodeSchema.credentials && nodeSchema.credentials.length > 0) {
      hints.push(`Requires credentials: ${nodeSchema.credentials.join(', ')}`)
    }

    if (nodeSchema.inputPorts > 1) {
      hints.push(`Supports multiple inputs (${nodeSchema.inputPorts} ports)`)
    }

    if (nodeSchema.outputPorts > 1) {
      hints.push(`Provides multiple outputs (${nodeSchema.outputPorts} ports)`)
    }

    const complexParams = nodeSchema.parameters.filter(p =>
      p.type === 'collection' || p.type === 'json' || p.options,
    )
    if (complexParams.length > 0) {
      hints.push('Has advanced configuration options')
    }

    return hints
  }
}
