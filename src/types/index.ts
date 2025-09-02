/**
 * Core Types - Clean and Simple
 * Only exports what's actually used by the core system
 */

import { z } from 'zod'

// N8N Connection Types
export interface N8NConnection {
  node: string
  type: string
  index: number
}

export interface N8NWorkflowConnections {
  [nodeId: string]: {
    [connectionType: string]: N8NConnection[][]
  }
}

export interface N8NWorkflowSettings {
  callerPolicy?: string
  callerIds?: string[]
  errorWorkflow?: string
  timezone?: string
  saveDataErrorExecution?: 'all' | 'none'
  saveDataSuccessExecution?: 'all' | 'none'
  saveManualExecutions?: boolean
  saveExecutionProgress?: boolean
  executionTimeout?: number
  maxTimeout?: number
}

export interface N8NWorkflowStaticData {
  [key: string]: unknown
}

export interface N8NNodeOption {
  name: string
  value: string | number | boolean
  description?: string
}

export interface N8NContextValue {
  [key: string]: unknown
}

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
  connections?: N8NWorkflowConnections
  settings?: N8NWorkflowSettings
  staticData?: N8NWorkflowStaticData
  tags?: string[]
}

export interface N8NWorkflowNode {
  id: string
  name: string
  type: string
  position: [number, number]
  parameters: Record<string, unknown>
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
  default?: unknown
  required?: boolean
  options?: N8NNodeOption[]
}

// API Argument Types
export interface CreateWorkflowArgs {
  name: string
  nodes?: N8NWorkflowNode[]
  active?: boolean
  settings?: N8NWorkflowSettings
}

export interface ExecuteWorkflowArgs {
  workflowId: string
  data?: Record<string, unknown>
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
  context?: N8NContextValue
}

export interface SearchNodesArgs {
  query?: string
  category?: string
  limit?: number
}

// Zod Schemas for validation
export const CreateWorkflowArgsSchema = z.object({
  name: z.string(),
  nodes: z.array(z.unknown()).optional(),
  active: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
})

export const ExecuteWorkflowArgsSchema = z.object({
  workflowId: z.string(),
  data: z.record(z.unknown()).optional(),
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
  context: z.record(z.unknown()).optional(),
})

export const SearchNodesArgsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().optional(),
})

// Re-export core types from fast-types
export type { N8NMcpError } from './fast-types.js'
