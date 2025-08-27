/**
 * Strict TypeScript definitions for MCP SDK compliance
 * Replaces 'any' types with proper interfaces following MCP best practices
 */

import { z } from 'zod'

/**
 * MCP Tool Response format as per official SDK
 */
export interface McpToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource_link'
    text?: string
    data?: string
    url?: string
    uri?: string
    name?: string
    mimeType?: string
    description?: string
  }>
  isError?: boolean
}

/**
 * MCP Tool Definition with strict typing
 */
export interface McpToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: z.ZodSchema<Record<string, unknown>>
  handler: (args: Record<string, unknown>) => Promise<McpToolResponse>
  priority: number
  memoryOptimized: boolean
  category: string
}

/**
 * MCP Resource Content format
 */
export interface McpResourceContent {
  uri: string
  text?: string
  blob?: string
  mimeType?: string
}

/**
 * MCP Resource Response format
 */
export interface McpResourceResponse {
  contents: McpResourceContent[]
}

/**
 * MCP Tool Handler type
 */
export type McpToolHandler = (args: Record<string, unknown>) => Promise<McpToolResponse>

/**
 * Tool configuration for registration
 */
export interface McpToolConfig {
  title: string
  description: string
  inputSchema: z.ZodSchema<Record<string, unknown>>
}

/**
 * Tool category definition
 */
export interface McpToolCategory {
  name: string
  description: string
  tools: string[]
  priority: number
}

/**
 * Node discovery interfaces
 */
export interface NodeInfo {
  name: string
  displayName: string
  description: string
  category: string
  version: string
  parameters: NodeParameter[]
  examples?: NodeExample[]
  tags: string[]
  deprecated?: boolean
  communityNode?: boolean
}

export interface NodeParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description: string
  defaultValue?: unknown
  options?: string[]
}

export interface NodeExample {
  title: string
  description: string
  configuration: Record<string, unknown>
  useCase: string
}

export interface NodeCategory {
  name: string
  displayName: string
  description: string
  nodeCount: number
  popular: boolean
}

/**
 * System health interfaces
 */
export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  metrics: {
    memory: {
      used: string
      total: string
      percentage: number
    }
    performance: {
      uptime: number
      responseTime: number
    }
    errors: {
      count: number
      recent: string[]
    }
  }
  services: Record<string, 'up' | 'down' | 'degraded'>
}

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
  totalCalls: number
  successRate: number
  averageResponseTime: number
  topTools: Array<{
    name: string
    calls: number
    successRate: number
  }>
  errors: Array<{
    tool: string
    error: string
    count: number
  }>
}

/**
 * Validation helpers
 */
export const McpToolResponseSchema = z.object({
  content: z.array(z.object({
    type: z.enum(['text', 'image', 'resource_link']),
    text: z.string().optional(),
    data: z.string().optional(),
    url: z.string().optional(),
    uri: z.string().optional(),
    name: z.string().optional(),
    mimeType: z.string().optional(),
    description: z.string().optional(),
  })),
  isError: z.boolean().optional(),
})

/**
 * Safe object creation utility
 */
export function createMcpResponse(content: string, isError?: boolean): McpToolResponse {
  const response: McpToolResponse = {
    content: [{
      type: 'text',
      text: content,
    }],
  }

  // Only add isError if explicitly set to maintain exactOptionalPropertyTypes compliance
  if (typeof isError === 'boolean') {
    response.isError = isError
  }

  return response
}

/**
 * Safe error response creation
 */
export function createMcpError(message: string, details?: unknown): McpToolResponse {
  return {
    content: [{
      type: 'text',
      text: `Error: ${message}${details ? ` - ${String(details)}` : ''}`,
    }],
    isError: true,
  }
}
