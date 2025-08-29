/**
 * Core Types - Clean and Simple
 * Only exports what's actually used by the core system
 */

import { z } from 'zod'

// Core MCP Types
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: z.ZodSchema
  outputSchema?: z.ZodSchema
}

// N8N Workflow Types
export interface N8NWorkflow {
  id: string
  name: string
  active: boolean
  nodes: N8NWorkflowNode[]
  connections?: Record<string, any>
  settings?: Record<string, any>
  staticData?: Record<string, any>
  tags?: string[]
}

export interface N8NWorkflowNode {
  id: string
  name: string
  type: string
  position: [number, number]
  parameters: Record<string, any>
}

// N8N Node Types
export interface N8NNodeType {
  name: string
  displayName: string
  description: string
  version: number
  properties: N8NNodeProperty[]
  group: string[]
}

export interface N8NNodeProperty {
  displayName: string
  name: string
  type: string
  default?: any
  required?: boolean
  options?: any[]
}

// API Argument Types
export interface CreateWorkflowArgs {
  name: string
  nodes?: N8NWorkflowNode[]
  active?: boolean
  settings?: Record<string, any>
}

export interface ExecuteWorkflowArgs {
  workflowId: string
  data?: Record<string, any>
}

export interface GetExecutionsArgs {
  workflowId?: string
  limit?: number
  offset?: number
}

export interface GetWorkflowArgs {
  id: string
}

export interface GetWorkflowsArgs {
  active?: boolean
  limit?: number
  offset?: number
}

export interface RouteToAgentArgs {
  message: string
  context?: Record<string, any>
}

export interface SearchNodesArgs {
  query?: string
  category?: string
  limit?: number
}

// Zod Schemas for validation
export const CreateWorkflowArgsSchema = z.object({
  name: z.string(),
  nodes: z.array(z.any()).optional(),
  active: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
})

export const ExecuteWorkflowArgsSchema = z.object({
  workflowId: z.string(),
  data: z.record(z.any()).optional(),
})

export const GetExecutionsArgsSchema = z.object({
  workflowId: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
})

export const GetWorkflowArgsSchema = z.object({
  id: z.string(),
})

export const GetWorkflowsArgsSchema = z.object({
  active: z.boolean().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
})

export const RouteToAgentArgsSchema = z.object({
  message: z.string(),
  context: z.record(z.any()).optional(),
})

export const SearchNodesArgsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().optional(),
})

// Re-export core types from fast-types
export type { N8NMcpError } from './fast-types.js'
