/**
 * Lightweight types for fast n8n-MCP
 * Only includes essential types needed for dynamic discovery
 */

import { z } from 'zod'

// Configuration Schema - minimal but compatible version
export const ConfigSchema = z.object({
  n8nApiUrl: z.string().url().optional(),
  n8nApiKey: z.string().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  disableConsoleOutput: z.boolean().default(false),
  mcpMode: z.enum(['stdio', 'http']).default('stdio'),
  mcpTimeout: z.number().default(30000),
  enableCache: z.boolean().default(true),
  cacheTtl: z.number().default(3600),
  maxConcurrentRequests: z.number().default(10),
  nodeEnv: z.enum(['development', 'production', 'test']).default('production'),
  debug: z.boolean().default(false),

  // Database Settings
  databasePath: z.string().default('./data/nodes.db'),
  databaseInMemory: z.boolean().default(false),
})

export type Config = z.infer<typeof ConfigSchema>

// Simple configuration interface for lightweight build
export interface SimpleConfig {
  n8nUrl?: string
  n8nApiKey?: string | undefined
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
  enabledAgents?: string[]
}

// MCP Tool Types
export interface ToolResult {
  success: boolean
  data?: unknown
  message?: string
  error?: string
}

export interface MCPTool {
  name: string
  description: string
  handler: (args?: unknown) => Promise<ToolResult>
  agent?: string
  category?: string
}

// Agent Types
export enum AgentTier {
  MASTER = 'master',
  SPECIALIST = 'specialist',
  SUPPORT = 'support',
}

export enum AgentCapability {
  WORKFLOW_DESIGN = 'workflow-design',
  CODE_GENERATION = 'code-generation',
  API_INTEGRATION = 'api-integration',
  NODE_EXPERTISE = 'node-expertise',
  DOCUMENTATION = 'documentation',
  VALIDATION = 'validation',
}

export interface AgentContext {
  complexity?: 'low' | 'medium' | 'high'
  requiresValidation?: boolean
  requiresAuthentication?: boolean
  nodeExpertise?: boolean
  quickHelp?: boolean
  [key: string]: unknown
}

export interface AgentResult {
  success: boolean
  result?: unknown
  error?: string
}

// Discovery Types
export interface DiscoveredNode {
  nodeType: string
  displayName: string
  category: string
  version: string
  description: string
  properties?: unknown[]
  credentials?: unknown[]
}

export interface DiscoveredTool {
  name: string
  description: string
  category: string
  handler: (context: unknown) => Promise<unknown>
}

// Minimal N8N API Types
export interface N8NNodeAPI {
  name: string
  displayName: string
  description: string
  version: number
  type?: string
  group?: string[]
  properties?: unknown[]
  credentials?: unknown[]
}

export interface N8NWorkflowNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters: Record<string, unknown>
  credentials?: Record<string, string>
}

// Simple Error class
export class N8NMcpError extends Error {
  public readonly code: string
  public readonly statusCode?: number
  public readonly details?: unknown

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: unknown,
  ) {
    super(message)
    this.name = 'N8NMcpError'
    this.code = code
    if (statusCode !== undefined) {
      this.statusCode = statusCode
    }
    this.details = details
  }
}
