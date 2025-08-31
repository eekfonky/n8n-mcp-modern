import { z } from 'zod'
import { logger } from '../server/logger.js'

const __brand = Symbol('brand')

// Schema Generation Configuration
export const SchemaGeneratorConfigSchema = z.object({
  enableStrictValidation: z.boolean().default(true),
  enableTypeInference: z.boolean().default(true),
  enableDescriptionGeneration: z.boolean().default(true),
  enableExampleGeneration: z.boolean().default(false),
  maxStringLength: z.number().min(50).default(10000),
  maxArrayLength: z.number().min(10).default(1000),
  enableCustomValidators: z.boolean().default(true),
  includeMetadata: z.boolean().default(true),
})

export type SchemaGeneratorConfig = z.infer<typeof SchemaGeneratorConfigSchema>

// Schema Generation Context
export interface SchemaGenerationContext {
  nodeType: string
  nodeVersion: string
  category: string
  displayName: string
  description?: string
  properties?: any[]
  credentials?: any[]
  inputs?: any[]
  outputs?: any[]
}

// Generated Schema Result
export interface GeneratedSchemaResult {
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  zodSchema: z.ZodSchema
  validationRules: ValidationRule[]
  metadata: SchemaMetadata
}

// Validation Rule
export interface ValidationRule {
  field: string
  type: 'required' | 'conditional' | 'format' | 'range' | 'custom'
  rule: string
  message: string
  dependencies?: string[]
}

// Schema Metadata
export interface SchemaMetadata {
  generated: Date
  nodeType: string
  version: string
  complexity: 'simple' | 'moderate' | 'complex'
  fieldCount: number
  validationCount: number
  inferredCapabilities: string[]
}

// Property Type Mapping
export const PROPERTY_TYPE_MAP = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  array: 'array',
  object: 'object',
  json: 'object',
  collection: 'array',
  fixedCollection: 'array',
  multiOptions: 'array',
  options: 'string',
  color: 'string',
  dateTime: 'string',
  hidden: 'string',
} as const

/**
 * Real-Time Schema Generator - Creates Zod schemas from n8n node definitions
 * Generates dynamic input/output validation schemas for tools
 */
export class RealTimeSchemaGenerator {
  private config: SchemaGeneratorConfig
  private schemaCache = new Map<string, GeneratedSchemaResult>()
  private generationStats = {
    totalGenerated: 0,
    cacheHits: 0,
    generationTime: 0,
    errors: 0,
  }

  constructor(config: Partial<SchemaGeneratorConfig> = {}) {
    this.config = SchemaGeneratorConfigSchema.parse(config)
  }

  /**
   * Generate schema from n8n node definition
   */
  async generateSchemaFromNode(context: SchemaGenerationContext): Promise<GeneratedSchemaResult> {
    const startTime = Date.now()
    const cacheKey = `${context.nodeType}-${context.nodeVersion}`

    // Check cache first
    if (this.schemaCache.has(cacheKey)) {
      this.generationStats.cacheHits++
      return this.schemaCache.get(cacheKey)!
    }

    try {
      const result = await this.generateSchema(context)

      // Cache the result
      this.schemaCache.set(cacheKey, result)

      // Update stats
      this.generationStats.totalGenerated++
      this.generationStats.generationTime += Date.now() - startTime

      this.emitSchemaGenerated(context.nodeType, result)
      return result
    }
    catch (error) {
      this.generationStats.errors++
      logger.error(`Schema generation failed for ${context.nodeType}:`, error)
      throw error
    }
  }

  /**
   * Generate schema from n8n API endpoint definition
   */
  async generateSchemaFromEndpoint(
    method: string,
    path: string,
    parameters?: any[],
    responses?: any,
  ): Promise<GeneratedSchemaResult> {
    const context: SchemaGenerationContext = {
      nodeType: `api_${path.replace(/[^a-z0-9]/gi, '_')}`,
      nodeVersion: '1.0.0',
      category: 'api',
      displayName: `${method.toUpperCase()} ${path}`,
      description: `n8n API endpoint: ${method.toUpperCase()} ${path}`,
      properties: this.convertEndpointParametersToProperties(parameters || []),
    }

    return await this.generateSchemaFromNode(context)
  }

  /**
   * Batch generate schemas for multiple nodes
   */
  async batchGenerateSchemas(contexts: SchemaGenerationContext[]): Promise<Map<string, GeneratedSchemaResult>> {
    const results = new Map<string, GeneratedSchemaResult>()
    const batchSize = 5 // Process in batches to avoid overwhelming the system

    for (let i = 0; i < contexts.length; i += batchSize) {
      const batch = contexts.slice(i, i + batchSize)

      const batchPromises = batch.map(async (context) => {
        try {
          const result = await this.generateSchemaFromNode(context)
          return { key: context.nodeType, result }
        }
        catch (error) {
          logger.warn(`Failed to generate schema for ${context.nodeType}:`, error)
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)

      for (const item of batchResults) {
        if (item) {
          results.set(item.key, item.result)
        }
      }

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < contexts.length) {
        await new Promise<void>(resolve => setTimeout(resolve, 100))
      }
    }

    logger.info(`Batch schema generation completed: ${results.size}/${contexts.length} successful`)
    return results
  }

  /**
   * Update existing schema with new node properties
   */
  async updateSchema(
    nodeType: string,
    newProperties: any[],
  ): Promise<GeneratedSchemaResult | null> {
    const cacheKey = `${nodeType}-latest`
    const existingSchema = this.schemaCache.get(cacheKey)

    if (!existingSchema) {
      logger.warn(`Cannot update schema for ${nodeType}: not found in cache`)
      return null
    }

    // Create updated context
    const updatedContext: SchemaGenerationContext = {
      nodeType,
      nodeVersion: 'latest',
      category: existingSchema.metadata.nodeType,
      displayName: `Updated ${nodeType}`,
      properties: newProperties,
    }

    try {
      const updatedSchema = await this.generateSchemaFromNode(updatedContext)
      logger.info(`Schema updated for ${nodeType}: ${updatedSchema.metadata.fieldCount} fields`)
      return updatedSchema
    }
    catch (error) {
      logger.error(`Failed to update schema for ${nodeType}:`, error)
      return null
    }
  }

  /**
   * Get generation statistics
   */
  getStats() {
    return {
      ...this.generationStats,
      cacheSize: this.schemaCache.size,
      averageGenerationTime: this.generationStats.totalGenerated > 0
        ? this.generationStats.generationTime / this.generationStats.totalGenerated
        : 0,
      cacheHitRate: this.generationStats.totalGenerated > 0
        ? this.generationStats.cacheHits / (this.generationStats.totalGenerated + this.generationStats.cacheHits)
        : 0,
    }
  }

  /**
   * Clear schema cache
   */
  clearCache(): void {
    this.schemaCache.clear()
    logger.info('Schema generator cache cleared')
  }

  // Private Methods

  private async generateSchema(context: SchemaGenerationContext): Promise<GeneratedSchemaResult> {
    const properties: Record<string, any> = {}
    const required: string[] = []
    const validationRules: ValidationRule[] = []
    const zodSchema: Record<string, z.ZodTypeAny> = {}

    // Process node properties
    if (context.properties && Array.isArray(context.properties)) {
      for (const prop of context.properties) {
        const fieldSchema = this.generateFieldSchema(prop)
        if (fieldSchema) {
          properties[prop.name] = fieldSchema.jsonSchema
          zodSchema[prop.name] = fieldSchema.zodType

          if (prop.required !== false && !prop.optional) {
            required.push(prop.name)
          }

          // Add validation rules
          validationRules.push(...this.generateValidationRules(prop))
        }
      }
    }

    // Add common workflow fields
    this.addCommonWorkflowFields(properties, zodSchema, required)

    // Create final schemas
    const inputSchema = {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    }

    const finalZodSchema = z.object(zodSchema)

    // Generate output schema if available
    const outputSchema = this.generateOutputSchema(context)

    // Calculate complexity
    const complexity = this.calculateComplexity(properties, validationRules)

    // Infer capabilities
    const inferredCapabilities = this.inferCapabilities(context, properties)

    const metadata: SchemaMetadata = {
      generated: new Date(),
      nodeType: context.nodeType,
      version: context.nodeVersion,
      complexity,
      fieldCount: Object.keys(properties).length,
      validationCount: validationRules.length,
      inferredCapabilities,
    }

    return {
      inputSchema,
      ...(outputSchema && { outputSchema }),
      zodSchema: finalZodSchema,
      validationRules,
      metadata,
    }
  }

  private generateFieldSchema(prop: any): { jsonSchema: any, zodType: z.ZodTypeAny } | null {
    if (!prop.name || !prop.type) {
      return null
    }

    const baseType = PROPERTY_TYPE_MAP[prop.type as keyof typeof PROPERTY_TYPE_MAP] || 'string'
    let jsonSchema: any = { type: baseType }
    let zodType: z.ZodTypeAny

    // Handle different property types
    switch (prop.type) {
      case 'string':
        jsonSchema = {
          type: 'string',
          description: prop.description || prop.displayName || `${prop.name} parameter`,
          ...(prop.default !== undefined && { default: prop.default }),
          ...(this.config.maxStringLength && { maxLength: this.config.maxStringLength }),
        }
        zodType = z.string()
        if (prop.default !== undefined)
          zodType = zodType.default(prop.default)
        break

      case 'number': {
        jsonSchema = {
          type: 'number',
          description: prop.description || prop.displayName || `${prop.name} parameter`,
          ...(prop.typeOptions?.minValue !== undefined && { minimum: prop.typeOptions.minValue }),
          ...(prop.typeOptions?.maxValue !== undefined && { maximum: prop.typeOptions.maxValue }),
          ...(prop.default !== undefined && { default: prop.default }),
        }
        let numberSchema = z.number()
        if (prop.typeOptions?.minValue !== undefined)
          numberSchema = numberSchema.min(prop.typeOptions.minValue)
        if (prop.typeOptions?.maxValue !== undefined)
          numberSchema = numberSchema.max(prop.typeOptions.maxValue)
        zodType = numberSchema
        if (prop.default !== undefined)
          zodType = zodType.default(prop.default)
        break
      }

      case 'boolean':
        jsonSchema = {
          type: 'boolean',
          description: prop.description || prop.displayName || `${prop.name} parameter`,
          ...(prop.default !== undefined && { default: prop.default }),
        }
        zodType = z.boolean()
        if (prop.default !== undefined)
          zodType = zodType.default(prop.default)
        break

      case 'options':
        if (prop.options && Array.isArray(prop.options)) {
          const enumValues = prop.options.map((opt: any) => opt.value || opt.name || opt)
          jsonSchema = {
            type: 'string',
            enum: enumValues,
            description: prop.description || prop.displayName || `${prop.name} parameter`,
          }
          zodType = z.enum(enumValues)
        }
        else {
          jsonSchema = { type: 'string', description: prop.description || `${prop.name} parameter` }
          zodType = z.string()
        }
        break

      case 'multiOptions':
        if (prop.options && Array.isArray(prop.options)) {
          const enumValues = prop.options.map((opt: any) => opt.value || opt.name || opt)
          jsonSchema = {
            type: 'array',
            items: { type: 'string', enum: enumValues },
            description: prop.description || prop.displayName || `${prop.name} parameter`,
          }
          zodType = z.array(z.enum(enumValues))
        }
        else {
          jsonSchema = { type: 'array', items: { type: 'string' } }
          zodType = z.array(z.string())
        }
        break

      case 'collection':
      case 'fixedCollection':
        jsonSchema = {
          type: 'array',
          items: { type: 'object' },
          description: prop.description || prop.displayName || `${prop.name} collection`,
          ...(this.config.maxArrayLength && { maxItems: this.config.maxArrayLength }),
        }
        zodType = z.array(z.record(z.unknown()))
        break

      case 'json':
      case 'object':
        jsonSchema = {
          type: 'object',
          description: prop.description || prop.displayName || `${prop.name} object`,
        }
        zodType = z.record(z.unknown())
        break

      case 'dateTime':
        jsonSchema = {
          type: 'string',
          format: 'date-time',
          description: prop.description || prop.displayName || `${prop.name} date/time`,
        }
        zodType = z.string().datetime()
        break

      case 'color':
        jsonSchema = {
          type: 'string',
          pattern: '^#[0-9A-Fa-f]{6}$',
          description: prop.description || prop.displayName || `${prop.name} color (hex format)`,
        }
        zodType = z.string().regex(/^#[0-9A-F]{6}$/i)
        break

      default:
        jsonSchema = {
          type: 'string',
          description: prop.description || prop.displayName || `${prop.name} parameter`,
        }
        zodType = z.string()
    }

    // Handle optional fields
    if (prop.required === false || prop.optional === true) {
      zodType = zodType.optional()
    }

    return { jsonSchema, zodType }
  }

  private generateValidationRules(prop: any): ValidationRule[] {
    const rules: ValidationRule[] = []

    // Required field rule
    if (prop.required !== false && !prop.optional) {
      rules.push({
        field: prop.name,
        type: 'required',
        rule: 'required',
        message: `${prop.displayName || prop.name} is required`,
      })
    }

    // Conditional display rules
    if (prop.displayOptions?.show) {
      const conditions = Object.entries(prop.displayOptions.show).map(([field, values]) => {
        const valueList = Array.isArray(values) ? values : [values]
        return `${field} in [${valueList.join(', ')}]`
      })

      rules.push({
        field: prop.name,
        type: 'conditional',
        rule: conditions.join(' AND '),
        message: `${prop.name} is only available when ${conditions.join(' and ')}`,
        dependencies: Object.keys(prop.displayOptions.show),
      })
    }

    // Range validation for numbers
    if (prop.type === 'number' && prop.typeOptions) {
      if (prop.typeOptions.minValue !== undefined) {
        rules.push({
          field: prop.name,
          type: 'range',
          rule: `>= ${prop.typeOptions.minValue}`,
          message: `${prop.name} must be at least ${prop.typeOptions.minValue}`,
        })
      }
      if (prop.typeOptions.maxValue !== undefined) {
        rules.push({
          field: prop.name,
          type: 'range',
          rule: `<= ${prop.typeOptions.maxValue}`,
          message: `${prop.name} must be at most ${prop.typeOptions.maxValue}`,
        })
      }
    }

    // Format validation
    if (prop.type === 'string' && prop.typeOptions?.pattern) {
      rules.push({
        field: prop.name,
        type: 'format',
        rule: prop.typeOptions.pattern,
        message: `${prop.name} must match the required format`,
      })
    }

    return rules
  }

  private addCommonWorkflowFields(
    properties: Record<string, any>,
    zodSchema: Record<string, z.ZodTypeAny>,
    _required: string[],
  ): void {
    // Add workflow execution context fields
    properties.workflowId = {
      type: 'string',
      description: 'ID of the workflow containing this node',
      optional: true,
    }
    zodSchema.workflowId = z.string().optional()

    properties.executionMode = {
      type: 'string',
      enum: ['manual', 'trigger', 'webhook', 'cron', 'api'],
      description: 'How the workflow is being executed',
      default: 'manual',
    }
    zodSchema.executionMode = z.enum(['manual', 'trigger', 'webhook', 'cron', 'api']).default('manual')

    properties.nodeId = {
      type: 'string',
      description: 'Unique identifier for this node instance',
      optional: true,
    }
    zodSchema.nodeId = z.string().optional()
  }

  private generateOutputSchema(context: SchemaGenerationContext): Record<string, unknown> | undefined {
    if (!context.outputs || !Array.isArray(context.outputs)) {
      return undefined
    }

    const outputProperties: Record<string, any> = {}

    for (const output of context.outputs) {
      if (output.type && output.name) {
        const outputType = PROPERTY_TYPE_MAP[output.type as keyof typeof PROPERTY_TYPE_MAP] || 'object'
        outputProperties[output.name] = {
          type: outputType,
          description: output.description || `Output: ${output.displayName || output.name}`,
        }
      }
    }

    // Common output fields
    outputProperties.success = {
      type: 'boolean',
      description: 'Whether the node execution was successful',
    }

    outputProperties.executionTime = {
      type: 'number',
      description: 'Time taken to execute the node (in milliseconds)',
    }

    outputProperties.outputData = {
      type: 'array',
      items: { type: 'object' },
      description: 'Array of data items produced by the node',
    }

    return {
      type: 'object',
      properties: outputProperties,
    }
  }

  private calculateComplexity(
    properties: Record<string, any>,
    validationRules: ValidationRule[],
  ): 'simple' | 'moderate' | 'complex' {
    const fieldCount = Object.keys(properties).length
    const ruleCount = validationRules.length
    const conditionalRules = validationRules.filter(rule => rule.type === 'conditional').length

    if (fieldCount <= 5 && ruleCount <= 3 && conditionalRules === 0) {
      return 'simple'
    }
    else if (fieldCount <= 15 && ruleCount <= 10 && conditionalRules <= 2) {
      return 'moderate'
    }
    else {
      return 'complex'
    }
  }

  private inferCapabilities(
    context: SchemaGenerationContext,
    properties: Record<string, any>,
  ): string[] {
    const capabilities = new Set<string>()

    // Category-based capabilities
    switch (context.category?.toLowerCase()) {
      case 'trigger':
        capabilities.add('workflow_triggers')
        break
      case 'core':
        capabilities.add('core_functionality')
        break
      case 'data':
        capabilities.add('data_processing')
        break
      case 'communication':
        capabilities.add('connectivity')
        break
      case 'productivity':
        capabilities.add('workflow_management')
        break
    }

    // Property-based capabilities
    const propertyNames = Object.keys(properties).map(name => name.toLowerCase())

    if (propertyNames.some(name => name.includes('auth') || name.includes('credential'))) {
      capabilities.add('authentication')
    }
    if (propertyNames.some(name => name.includes('webhook') || name.includes('url'))) {
      capabilities.add('connectivity')
    }
    if (propertyNames.some(name => name.includes('code') || name.includes('script'))) {
      capabilities.add('script_execution')
    }
    if (propertyNames.some(name => name.includes('data') || name.includes('transform'))) {
      capabilities.add('data_processing')
    }

    // Node type-based capabilities
    const nodeTypeLC = context.nodeType.toLowerCase()
    if (nodeTypeLC.includes('http') || nodeTypeLC.includes('api')) {
      capabilities.add('connectivity')
    }
    if (nodeTypeLC.includes('code') || nodeTypeLC.includes('function')) {
      capabilities.add('script_execution')
    }
    if (nodeTypeLC.includes('if') || nodeTypeLC.includes('switch')) {
      capabilities.add('workflow_control')
    }

    return Array.from(capabilities)
  }

  private convertEndpointParametersToProperties(parameters: any[]): any[] {
    return parameters.map(param => ({
      name: param.name,
      type: this.mapEndpointParameterType(param.type),
      description: param.description,
      required: param.required,
      displayName: param.name,
      default: param.default,
    }))
  }

  private mapEndpointParameterType(paramType: string): string {
    const typeMap: Record<string, string> = {
      string: 'string',
      integer: 'number',
      number: 'number',
      boolean: 'boolean',
      array: 'array',
      object: 'object',
    }

    return typeMap[paramType] || 'string'
  }

  private emitSchemaGenerated(nodeType: string, result: GeneratedSchemaResult): void {
    logger.debug(`Schema generated for ${nodeType}:`, {
      fieldCount: result.metadata.fieldCount,
      complexity: result.metadata.complexity,
      validationRules: result.metadata.validationCount,
      capabilities: result.metadata.inferredCapabilities,
    })
  }
}

// Export singleton instance
let generatorInstance: RealTimeSchemaGenerator | null = null

export function getRealTimeSchemaGenerator(config?: Partial<SchemaGeneratorConfig>): RealTimeSchemaGenerator {
  if (!generatorInstance) {
    generatorInstance = new RealTimeSchemaGenerator(config)
  }
  return generatorInstance
}
