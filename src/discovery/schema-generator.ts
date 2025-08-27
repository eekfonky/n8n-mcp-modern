/**
 * Dynamic Schema Generation for n8n Parameters
 * Converts n8n node parameters to Zod schemas for MCP tool validation
 *
 * FEATURES:
 * - Real-time schema generation from discovered n8n nodes
 * - Complex parameter type handling (options, collections, conditionals)
 * - Zod schema optimization for token efficiency
 * - Memory-efficient schema caching
 * - Type-safe schema generation with full TypeScript support
 */

import type { N8nNode, N8nNodeProperty } from './n8n-api-client.js'
import { z } from 'zod'
import { logger } from '../server/logger.js'
import { createCleanObject } from '../utils/aggressive-memory-cleanup.js'

export interface GeneratedSchema {
  schema: Record<string, z.ZodTypeAny>
  documentation: Record<string, string>
  required: string[]
  optional: string[]
}

export interface SchemaGenerationOptions {
  includeOptional?: boolean
  maxDepth?: number
  tokenOptimized?: boolean
  includeExamples?: boolean
}

export class SchemaGenerator {
  private schemaCache: Map<string, GeneratedSchema> = new Map()
  private readonly maxCacheSize = 500 // Prevent memory leaks

  /**
   * Generate Zod schema from n8n node parameters
   */
  generateSchemaForNode(node: N8nNode, options: SchemaGenerationOptions = {}): GeneratedSchema {
    const cacheKey = this.getCacheKey(node.name, options)

    // Check cache first
    if (this.schemaCache.has(cacheKey)) {
      logger.debug(`Using cached schema for node: ${node.name}`)
      const cachedSchema = this.schemaCache.get(cacheKey)
      if (cachedSchema) {
        return cachedSchema
      }
    }

    logger.debug(`Generating schema for node: ${node.name}`)

    const schema: Record<string, z.ZodTypeAny> = {}
    const documentation: Record<string, string> = {}
    const required: string[] = []
    const optional: string[] = []

    // Process each node property
    for (const property of node.properties || []) {
      const zodType = this.convertPropertyToZod(property, options)

      if (zodType) {
        schema[property.name] = zodType
        documentation[property.name] = property.description || property.displayName

        if (property.required) {
          required.push(property.name)
        }
        else {
          optional.push(property.name)
        }
      }
    }

    const result: GeneratedSchema = createCleanObject({
      schema,
      documentation,
      required,
      optional,
    })

    // Cache the result (with size limit)
    this.cacheSchema(cacheKey, result)

    return result
  }

  /**
   * Convert individual n8n property to Zod type
   */
  private convertPropertyToZod(
    property: N8nNodeProperty,
    options: SchemaGenerationOptions,
  ): z.ZodTypeAny | null {
    try {
      let zodType: z.ZodTypeAny

      switch (property.type) {
        case 'string':
          zodType = this.handleStringType(property, options)
          break

        case 'number':
          zodType = this.handleNumberType(property, options)
          break

        case 'boolean':
          zodType = this.handleBooleanType(property, options)
          break

        case 'options':
          zodType = this.handleOptionsType(property, options)
          break

        case 'multiOptions':
          zodType = this.handleMultiOptionsType(property, options)
          break

        case 'fixedCollection':
          zodType = this.handleFixedCollectionType(property, options)
          break

        case 'collection':
          zodType = this.handleCollectionType(property, options)
          break

        case 'json':
          zodType = this.handleJsonType(property, options)
          break

        case 'dateTime':
          zodType = this.handleDateTimeType(property, options)
          break

        case 'color':
          zodType = z.string().regex(/^#[0-9A-F]{6}$/i).describe('Color in hex format')
          break

        case 'hidden':
          // Skip hidden fields for token efficiency
          return null

        default:
          logger.debug(`Unknown property type: ${property.type}, defaulting to string`)
          zodType = z.string()
          break
      }

      // Add description for better token efficiency and user experience
      if (property.description && !options.tokenOptimized) {
        zodType = zodType.describe(property.description)
      }

      // Handle optional vs required
      if (!property.required) {
        zodType = zodType.optional()

        // Add default value if specified
        if (property.default !== undefined) {
          zodType = zodType.default(property.default)
        }
      }

      return zodType
    }
    catch (error) {
      logger.warn(`Failed to convert property ${property.name} of type ${property.type}:`, error)
      return z.string().describe(`Fallback for ${property.displayName}`)
    }
  }

  /**
   * Handle string type with various string-specific options
   */
  private handleStringType(property: N8nNodeProperty, _options: SchemaGenerationOptions): z.ZodString {
    let zodType = z.string()

    // Handle string validation based on typeOptions
    const typeOptions = property.typeOptions
    if (typeOptions) {
      // Email validation
      if (typeOptions.validation === 'email') {
        zodType = z.string().email()
      }

      // URL validation
      if (typeOptions.validation === 'url') {
        zodType = z.string().url()
      }

      // Length constraints
      if (typeof typeOptions.minLength === 'number') {
        zodType = zodType.min(typeOptions.minLength)
      }
      if (typeof typeOptions.maxLength === 'number') {
        zodType = zodType.max(typeOptions.maxLength)
      }

      // Regex validation
      if (typeof typeOptions.regex === 'string') {
        try {
          zodType = zodType.regex(new RegExp(typeOptions.regex))
        }
        catch {
          logger.warn(`Invalid regex for property ${property.name}: ${typeOptions.regex}`)
        }
      }
    }

    return zodType
  }

  /**
   * Handle number type with range validation
   */
  private handleNumberType(property: N8nNodeProperty, _options: SchemaGenerationOptions): z.ZodNumber {
    let zodType = z.number()

    const typeOptions = property.typeOptions
    if (typeOptions) {
      // Range validation
      if (typeof typeOptions.minValue === 'number') {
        zodType = zodType.min(typeOptions.minValue)
      }
      if (typeof typeOptions.maxValue === 'number') {
        zodType = zodType.max(typeOptions.maxValue)
      }

      // Integer vs float
      if (typeOptions.numberPrecision === 0) {
        zodType = z.number().int()
      }
    }

    return zodType
  }

  /**
   * Handle boolean type
   */
  private handleBooleanType(_property: N8nNodeProperty, _options: SchemaGenerationOptions): z.ZodBoolean {
    return z.boolean()
  }

  /**
   * Handle options type (single select)
   */
  private handleOptionsType(property: N8nNodeProperty, _options: SchemaGenerationOptions): z.ZodEnum<[string, ...string[]]> | z.ZodString {
    if (property.options && property.options.length > 0) {
      // Create enum from options
      const values = property.options.map(opt => String(opt.value))
      if (values.length > 0) {
        return z.enum(values as [string, ...string[]])
      }
    }

    // Fallback to string if no options available
    return z.string()
  }

  /**
   * Handle multiOptions type (multi-select)
   */
  private handleMultiOptionsType(property: N8nNodeProperty, _options: SchemaGenerationOptions): z.ZodArray<z.ZodString> | z.ZodArray<z.ZodEnum<[string, ...string[]]>> {
    if (property.options && property.options.length > 0) {
      const values = property.options.map(opt => String(opt.value))
      return z.array(z.enum(values as [string, ...string[]]))
    }

    // Fallback to array of strings
    return z.array(z.string())
  }

  /**
   * Handle fixedCollection type (structured objects)
   */
  private handleFixedCollectionType(_property: N8nNodeProperty, _options: SchemaGenerationOptions): z.ZodArray<z.ZodRecord<z.ZodAny>> {
    // For complex collections, use a flexible record structure
    // This could be enhanced with deeper schema generation in the future
    return z.array(z.record(z.any())) as unknown as z.ZodArray<z.ZodRecord<z.ZodAny>>
  }

  /**
   * Handle collection type (flexible arrays)
   */
  private handleCollectionType(_property: N8nNodeProperty, _options: SchemaGenerationOptions): z.ZodArray<z.ZodRecord<z.ZodAny>> {
    return z.array(z.record(z.any())) as unknown as z.ZodArray<z.ZodRecord<z.ZodAny>>
  }

  /**
   * Handle JSON type
   */
  private handleJsonType(_property: N8nNodeProperty, _options: SchemaGenerationOptions): z.ZodRecord<z.ZodAny> {
    return z.record(z.any()) as unknown as z.ZodRecord<z.ZodAny>
  }

  /**
   * Handle dateTime type
   */
  private handleDateTimeType(_property: N8nNodeProperty, _options: SchemaGenerationOptions): z.ZodUnion<[z.ZodString, z.ZodString]> {
    return z.string().datetime().or(z.string().date())
  }

  /**
   * Generate schema for multiple nodes efficiently
   */
  generateSchemasForNodes(nodes: N8nNode[], options: SchemaGenerationOptions = {}): Map<string, GeneratedSchema> {
    const schemas = new Map<string, GeneratedSchema>()

    logger.info(`Generating schemas for ${nodes.length} nodes...`)

    let successCount = 0
    let errorCount = 0

    for (const node of nodes) {
      try {
        const schema = this.generateSchemaForNode(node, options)
        schemas.set(node.name, schema)
        successCount++
      }
      catch (error) {
        logger.error(`Failed to generate schema for node ${node.name}:`, error)
        errorCount++

        // Create minimal fallback schema
        schemas.set(node.name, {
          schema: { data: z.any().describe('Fallback parameter') },
          documentation: { data: 'Fallback parameter for failed schema generation' },
          required: [],
          optional: ['data'],
        })
      }
    }

    logger.info(`✅ Schema generation complete: ${successCount} successful, ${errorCount} errors`)

    return schemas
  }

  /**
   * Get schema generation statistics
   */
  getStatistics(): Record<string, unknown> {
    return createCleanObject({
      cachedSchemas: this.schemaCache.size,
      maxCacheSize: this.maxCacheSize,
      memoryEfficient: true,
      supportedTypes: [
        'string',
        'number',
        'boolean',
        'options',
        'multiOptions',
        'fixedCollection',
        'collection',
        'json',
        'dateTime',
        'color',
      ],
    })
  }

  /**
   * Clear schema cache for memory management
   */
  clearCache(): void {
    this.schemaCache.clear()
    logger.debug('Schema cache cleared')
  }

  /**
   * Generate cache key for schema caching
   */
  private getCacheKey(nodeName: string, options: SchemaGenerationOptions): string {
    const optionsKey = JSON.stringify(options)
    return `${nodeName}:${optionsKey}`
  }

  /**
   * Cache schema with size limit to prevent memory leaks
   */
  private cacheSchema(key: string, schema: GeneratedSchema): void {
    // Implement LRU-style eviction
    if (this.schemaCache.size >= this.maxCacheSize) {
      // Remove the first (oldest) entry
      const firstKey = this.schemaCache.keys().next().value
      if (firstKey) {
        this.schemaCache.delete(firstKey)
      }
    }

    this.schemaCache.set(key, schema)
  }

  /**
   * Validate generated schema against sample data
   */
  validateSchema(schema: GeneratedSchema, sampleData: Record<string, unknown>): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []
    let valid = true

    try {
      // Create a Zod object from the schema
      const zodObject = z.object(schema.schema)

      // Attempt validation
      const result = zodObject.safeParse(sampleData)

      if (!result.success) {
        valid = false
        errors.push(...result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`))
      }

      // Check for missing required fields
      for (const requiredField of schema.required) {
        if (!(requiredField in sampleData)) {
          warnings.push(`Missing required field: ${requiredField}`)
        }
      }
    }
    catch (error) {
      valid = false
      errors.push(`Schema validation error: ${String(error)}`)
    }

    return createCleanObject({ valid, errors, warnings })
  }
}
