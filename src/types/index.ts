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
  nodeEnv: z.enum(['development', 'production']).default('production'),
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

// Agent Types
export const AgentTypeSchema = z.enum([
  'n8n-workflow-architect',
  'n8n-validator', 
  'n8n-integration-specialist',
  'n8n-node-specialist',
  'n8n-assistant',
  'n8n-docs-specialist',
  'n8n-community-specialist'
]);

export type AgentType = z.infer<typeof AgentTypeSchema>;

export interface AgentTask {
  description: string;
  prompt: string;
  subagentType: AgentType;
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