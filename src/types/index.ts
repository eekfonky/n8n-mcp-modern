import { z } from 'zod';

// Core MCP Types
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema?: z.ZodSchema;
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
  debug: z.boolean().default(false)
});

export type Config = z.infer<typeof ConfigSchema>;

// N8N Node Types (Minimal)
export interface N8NNode {
  type: string;
  displayName: string;
  name: string;
  group: string[];
  version: number | number[];
  description: string;
  defaults: Record<string, unknown>;
  inputs: string[];
  outputs: string[];
  properties: N8NNodeProperty[];
  credentials?: N8NCredential[];
  webhooks?: N8NWebhook[];
  codex?: {
    categories: string[];
    subcategories?: Record<string, string[]>;
    resources?: {
      primaryDocumentation?: Array<{
        url: string;
        title?: string;
      }>;
    };
  };
}

export interface N8NNodeProperty {
  displayName: string;
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
  options?: Array<{
    name: string;
    value: string | number | boolean;
    description?: string;
  }>;
  displayOptions?: {
    show?: Record<string, unknown[]>;
    hide?: Record<string, unknown[]>;
  };
}

export interface N8NCredential {
  name: string;
  required?: boolean;
  displayOptions?: {
    show?: Record<string, unknown[]>;
    hide?: Record<string, unknown[]>;
  };
}

export interface N8NWebhook {
  name: string;
  httpMethod: string;
  responseMode: string;
  path: string;
}

// Validation Types
export const ValidationProfileSchema = z.enum(['minimal', 'runtime', 'ai-friendly', 'strict']);
export type ValidationProfile = z.infer<typeof ValidationProfileSchema>;

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  type: string;
  property: string;
  message: string;
  fix?: string;
}

export interface ValidationWarning {
  type: string;
  property: string;
  message: string;
  suggestion?: string;
}

// MCP Tool Types (removed internal agent logic)
export interface ToolResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

// Database Types
export interface DatabaseNode {
  id: string;
  type: string;
  displayName: string;
  name: string;
  package: string;
  version: string;
  group: string;
  description: string;
  properties: string; // JSON stringified
  credentials?: string; // JSON stringified  
  webhooks?: string; // JSON stringified
  codex?: string; // JSON stringified
  isAiTool: boolean;
  category: string;
  developmentStyle: string;
  createdAt: string;
  updatedAt: string;
}

// Search Types
export const SearchModeSchema = z.enum(['OR', 'AND', 'FUZZY']);
export type SearchMode = z.infer<typeof SearchModeSchema>;

export interface SearchOptions {
  query: string;
  limit?: number;
  mode?: SearchMode;
  package?: string;
  category?: string;
  isAiTool?: boolean;
  developmentStyle?: string;
}

// N8N Workflow Connection Schema
export const N8NConnectionSchema = z.object({
  node: z.string(),
  type: z.string(),
  index: z.number()
});

export const N8NConnectionsSchema = z.record(
  z.string(),
  z.record(z.string(), z.array(z.array(N8NConnectionSchema)))
);

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
  onError: z.string().optional()
});

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
  versionId: z.string().optional()
});

// N8N API Types (Minimal)
export interface N8NWorkflow {
  id?: string;
  name: string;
  nodes: N8NWorkflowNode[];
  connections: Record<string, Record<string, Array<Array<{ node: string; type: string; index: number }>>>>;
  active?: boolean;
  settings?: Record<string, unknown>;
  staticData?: Record<string, unknown>;
  tags?: string[];
  versionId?: string;
}

export interface N8NWorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, string>;
  disabled?: boolean;
  notes?: string;
  notesInFlow?: boolean;
  color?: string;
  continueOnFail?: boolean;
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  onError?: string;
}

// Error Types
export class N8NMcpError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'N8NMcpError';
  }
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

// MCP Tool Argument Schemas
export const SearchNodesArgsSchema = z.object({
  query: z.string(),
  category: z.string().optional()
});

export const GetWorkflowsArgsSchema = z.object({
  limit: z.number().optional().default(10)
});

export const GetWorkflowArgsSchema = z.object({
  id: z.string()
});

export const CreateWorkflowArgsSchema = z.object({
  name: z.string(),
  nodes: z.array(N8NWorkflowNodeSchema),
  connections: N8NConnectionsSchema,
  active: z.boolean().optional().default(false)
});

export const ExecuteWorkflowArgsSchema = z.object({
  id: z.string(),
  data: z.record(z.unknown()).optional()
});

export const GetExecutionsArgsSchema = z.object({
  workflowId: z.string().optional(),
  limit: z.number().optional().default(20)
});

export const RouteToAgentArgsSchema = z.object({
  query: z.string()
});

// Type inference from schemas
export type SearchNodesArgs = z.infer<typeof SearchNodesArgsSchema>;
export type GetWorkflowsArgs = z.infer<typeof GetWorkflowsArgsSchema>;
export type GetWorkflowArgs = z.infer<typeof GetWorkflowArgsSchema>;
export type CreateWorkflowArgs = z.infer<typeof CreateWorkflowArgsSchema>;
export type ExecuteWorkflowArgs = z.infer<typeof ExecuteWorkflowArgsSchema>;
export type GetExecutionsArgs = z.infer<typeof GetExecutionsArgsSchema>;
export type RouteToAgentArgs = z.infer<typeof RouteToAgentArgsSchema>;

// Tool response types for better type safety
export interface ToolExecutionResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Context building types
export interface AgentContext {
  complexity: 'low' | 'medium' | 'high';
  requiresValidation: boolean;
  requiresAuthentication: boolean;
  nodeExpertise: boolean;
  quickHelp: boolean;
}