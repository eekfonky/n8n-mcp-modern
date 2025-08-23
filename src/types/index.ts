import { z } from 'zod'

// Core MCP Types
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: z.ZodSchema
  outputSchema?: z.ZodSchema
}

// Configuration Types
export const ConfigSchema = z.object({
  n8nApiUrl: z.string().url().optional(),
  n8nApiKey: z.string().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  disableConsoleOutput: z.boolean().default(false),
  mcpMode: z.enum(['stdio', 'http']).default('stdio'),
  mcpTimeout: z.number().default(30000),
  databasePath: z.string().default('./data/nodes.db'),
  databaseInMemory: z.boolean().default(false),
  enableCache: z.boolean().default(true),
  cacheTtl: z.number().default(3600),
  maxConcurrentRequests: z.number().default(10),
  nodeEnv: z.enum(['development', 'production', 'test']).default('production'),
  debug: z.boolean().default(false),

  // API Response Validation Settings
  strictApiValidation: z
    .boolean()
    .default(false)
    .describe('Throw errors on API response validation failures'),
  enableResponseLogging: z
    .boolean()
    .default(true)
    .describe('Log API response validation details'),
  validationTimeout: z
    .number()
    .default(5000)
    .describe('Validation timeout in milliseconds'),
  sanitizeApiResponses: z
    .boolean()
    .default(true)
    .describe('Sanitize API responses before validation'),
  maxResponseSize: z
    .number()
    .default(10485760)
    .describe('Maximum response size to validate (10MB)'),

  // Memory Management Settings
  enableMemoryMonitoring: z
    .boolean()
    .default(true)
    .describe('Enable memory usage monitoring and leak detection'),
  memoryThresholdWarning: z
    .number()
    .default(80)
    .describe('Memory usage percentage to trigger warning (50-95)'),
  memoryThresholdCritical: z
    .number()
    .default(90)
    .describe('Memory usage percentage to trigger critical alert (80-98)'),
  gcIntervalMs: z
    .number()
    .default(60000)
    .describe('Garbage collection interval in milliseconds'),
  maxHeapSizeMb: z
    .number()
    .default(512)
    .describe('Maximum heap size in MB (Node.js --max-old-space-size)'),
  cacheCleanupIntervalMs: z
    .number()
    .default(300000)
    .describe('Cache cleanup interval in milliseconds'),
})

export type Config = z.infer<typeof ConfigSchema>

// N8N Node Types (Deprecated - Use Unified Types)

// Enhanced Security Types
export type {
  ErrorType,
  SecurityContext,
  SecurityError,
  SecurityEvent,
} from '../server/security.js'
export {
  createClaudeContext,
  generateSessionId,
  initializeSecurity,
  SecureInputValidator,
  SecurityErrorHandler,
  SecurityEventType,
  validateToolAccess,
} from '../server/security.js'

// Re-export Node.js 22+ utilities
export {
  getCurrentContext,
  nodeAsyncUtils,
  performanceMonitor,
  resourceMonitor,
  runWithContext,
} from '../utils/node22-features.js'
// Re-export TypeScript 5.9+ advanced patterns
export type {
  DeepReadonly,
  ExecutionId,
  ExtractConfigValue,
  FilterNumericConfig,
  NodeConnectionType,
  NodeId,
  SafeAsync,
  WorkflowExecutionResult,
  WorkflowExecutionState,
  WorkflowId,
} from './advanced-patterns.js'

export {
  createExecutionId,
  createMemoized,
  createNodeId,
  createWorkflowId,
  isExecutionError,
  isExecutionSuccess,
  NODE_CONNECTION_TYPES,
  safeAsyncOperation,
  WORKFLOW_EXECUTION_STATES,
} from './advanced-patterns.js'

export interface N8NCredential {
  id?: string
  name: string
  type: string
  data?: Record<string, unknown>
  ownedBy?: string
  sharedWith?: string[]
  required?: boolean
  displayOptions?: {
    show?: Record<string, unknown[]>
    hide?: Record<string, unknown[]>
  }
}

export interface N8NWebhook {
  name: string
  httpMethod: string
  responseMode: string
  path: string
}

// Validation Types
export const ValidationProfileSchema = z.enum([
  'minimal',
  'runtime',
  'ai-friendly',
  'strict',
])
export type ValidationProfile = z.infer<typeof ValidationProfileSchema>

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  suggestions: string[]
}

export interface ValidationError {
  type: string
  property: string
  message: string
  fix?: string
}

export interface ValidationWarning {
  type: string
  property: string
  message: string
  suggestion?: string
}

// MCP Tool Types (removed internal agent logic)
export interface ToolResult {
  success: boolean
  data?: unknown
  message?: string
  error?: string
}

// Database Types
export interface DatabaseNode {
  id: string
  type: string
  displayName: string
  name: string
  package: string
  version: string
  group: string
  description: string
  properties: string // JSON stringified
  credentials?: string // JSON stringified
  webhooks?: string // JSON stringified
  codex?: string // JSON stringified
  isAiTool: boolean
  category: string
  developmentStyle: string
  createdAt: string
  updatedAt: string
}

// Search Types
export const SearchModeSchema = z.enum(['OR', 'AND', 'FUZZY'])
export type SearchMode = z.infer<typeof SearchModeSchema>

export interface SearchOptions {
  query: string
  limit?: number
  mode?: SearchMode
  package?: string
  category?: string
  isAiTool?: boolean
  developmentStyle?: string
}

// N8N Workflow Connection Schema
export const N8NConnectionSchema = z.object({
  node: z.string(),
  type: z.string(),
  index: z.number(),
})

export const N8NConnectionsSchema = z.record(
  z.string(),
  z.record(z.string(), z.array(z.array(N8NConnectionSchema))),
)

// N8N Workflow Node Schema
export const N8NWorkflowNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  typeVersion: z.number(),
  position: z.tuple([z.number(), z.number()]),
  parameters: z.record(z.unknown()),
  credentials: z.record(z.string()).optional(),
  disabled: z.boolean().optional(),
  notes: z.string().optional(),
  notesInFlow: z.boolean().optional(),
  color: z.string().optional(),
  continueOnFail: z.boolean().optional(),
  alwaysOutputData: z.boolean().optional(),
  executeOnce: z.boolean().optional(),
  retryOnFail: z.boolean().optional(),
  maxTries: z.number().optional(),
  waitBetweenTries: z.number().optional(),
  onError: z.string().optional(),
})

// N8N Workflow Schema
export const N8NWorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  nodes: z.array(N8NWorkflowNodeSchema),
  connections: N8NConnectionsSchema,
  active: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
  staticData: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  versionId: z.string().optional(),
})

// N8N API Types (Minimal)
export interface N8NWorkflow {
  id?: string
  name: string
  nodes: import('./core.js').N8NWorkflowNode[]
  connections: Record<
    string,
    Record<string, Array<Array<{ node: string, type: string, index: number }>>>
  >
  active?: boolean
  settings?: Record<string, unknown>
  staticData?: Record<string, unknown>
  tags?: string[]
  versionId?: string
}

// Re-export unified types for convenience
export type { N8NNodeAPI, N8NNodeCredential, N8NNodeDatabase, N8NNodeProperty } from './core.js'

// Error Types
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

export { convertApiToDatabase, isN8NNodeAPI, isN8NNodeDatabase, isN8NWorkflowNode } from './core.js'

// N8NWorkflowNode interface moved to types/core.ts to prevent duplication
// Re-export from core.ts for backward compatibility
export type { N8NWorkflowNode } from './core.js'

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type RequiredKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? never : K;
}[keyof T]

export type OptionalKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? K : never;
}[keyof T]

// MCP Tool Argument Schemas
export const SearchNodesArgsSchema = z.object({
  query: z.string(),
  category: z.string().optional(),
})

export const GetWorkflowsArgsSchema = z.object({
  limit: z.number().optional().default(10),
})

export const GetWorkflowArgsSchema = z.object({
  id: z.string(),
})

export const CreateWorkflowArgsSchema = z.object({
  name: z.string(),
  nodes: z.array(N8NWorkflowNodeSchema),
  connections: N8NConnectionsSchema,
  active: z.boolean().optional().default(false),
  settings: z.record(z.unknown()).optional(),
  staticData: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
})

export const ExecuteWorkflowArgsSchema = z.object({
  id: z.string(),
  data: z.record(z.unknown()).optional(),
})

export const GetExecutionsArgsSchema = z.object({
  workflowId: z.string().optional(),
  limit: z.number().optional().default(20),
})

export const RouteToAgentArgsSchema = z.object({
  query: z.string(),
})

// Type inference from schemas
export type SearchNodesArgs = z.infer<typeof SearchNodesArgsSchema>
export type GetWorkflowsArgs = z.infer<typeof GetWorkflowsArgsSchema>
export type GetWorkflowArgs = z.infer<typeof GetWorkflowArgsSchema>
export type CreateWorkflowArgs = z.infer<typeof CreateWorkflowArgsSchema>
export type ExecuteWorkflowArgs = z.infer<typeof ExecuteWorkflowArgsSchema>
export type GetExecutionsArgs = z.infer<typeof GetExecutionsArgsSchema>
export type RouteToAgentArgs = z.infer<typeof RouteToAgentArgsSchema>

// Additional N8N API types to avoid circular dependencies
export interface N8NUser {
  id?: string
  email: string
  firstName?: string
  lastName?: string
  isOwner?: boolean
  isPending?: boolean
  settings?: Record<string, unknown>
}

export interface N8NSettings {
  timezone: string
  saveDataErrorExecution: string
  saveDataSuccessExecution: string
  saveManualExecutions: boolean
  callerPolicyDefaultOption: string
}

// Tool response types for better type safety
export interface ToolExecutionResult {
  content: Array<{
    type: 'text'
    text: string
  }>
  isError?: boolean
}

// Context building types
export interface AgentContext {
  complexity: 'low' | 'medium' | 'high'
  requiresValidation: boolean
  requiresAuthentication: boolean
  nodeExpertise: boolean
  quickHelp: boolean
}
