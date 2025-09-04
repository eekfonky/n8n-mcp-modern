/**
 * Enhanced n8n API type definitions
 * Additional types for comprehensive API coverage
 */

import type { CredentialData, ExecutionData, WorkflowData } from '../simple-api.js'

/**
 * Enhanced workflow with additional metadata
 */
export interface EnhancedWorkflow extends WorkflowData {
  stats?: WorkflowStats
  permissions?: WorkflowPermissions
  sharing?: WorkflowSharing
}

/**
 * Workflow statistics
 */
export interface WorkflowStats {
  executions: number
  successRate: number
  averageExecutionTime: number
  lastExecution?: Date
  errorCount: number
  totalRunTime: number
}

/**
 * Workflow permissions
 */
export interface WorkflowPermissions {
  canEdit: boolean
  canExecute: boolean
  canShare: boolean
  canDelete: boolean
  owner: string
}

/**
 * Workflow sharing information
 */
export interface WorkflowSharing {
  isPublic: boolean
  sharedWith: string[]
  shareUrl?: string
}

/**
 * Enhanced execution with additional context
 */
export interface EnhancedExecution extends ExecutionData {
  workflow?: {
    id: string
    name: string
  }
  duration?: number
  nodeExecutions?: NodeExecutionSummary[]
  errorDetails?: ExecutionError
}

/**
 * Node execution summary
 */
export interface NodeExecutionSummary {
  nodeName: string
  nodeType: string
  status: 'success' | 'error' | 'skipped'
  executionTime: number
  outputItems: number
  errorMessage?: string
}

/**
 * Execution error details
 */
export interface ExecutionError {
  message: string
  stack?: string
  node?: string
  timestamp: Date
  type: 'workflow' | 'node' | 'system'
}

/**
 * API response pagination metadata
 */
export interface PaginationMetadata {
  total: number
  limit: number
  offset: number
  hasMore: boolean
  nextCursor?: string
  previousCursor?: string
}

/**
 * Enhanced API response wrapper
 */
export interface EnhancedApiResponse<T> {
  data: T
  metadata?: PaginationMetadata
  requestId?: string
  responseTime?: number
  fromCache?: boolean
}

/**
 * Workflow creation options
 */
export interface WorkflowCreateOptions {
  name: string
  nodes: unknown[]
  connections: Record<string, unknown>
  settings?: Record<string, unknown>
  tags?: string[]
  active?: boolean
  validateNodes?: boolean
  saveSnapshot?: boolean
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  data?: Record<string, unknown>
  waitForCompletion?: boolean
  timeout?: number
  startNodes?: string[]
  destinationNode?: string
  runData?: Record<string, unknown>
}

/**
 * Node search criteria
 */
export interface NodeSearchCriteria {
  query?: string
  category?: string
  tags?: string[]
  version?: string
  featured?: boolean
  deprecated?: boolean
}

/**
 * System health details
 */
export interface SystemHealthDetails {
  uptime: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
    cores: number
  }
  disk: {
    used: number
    total: number
    percentage: number
  }
  version: string
  environment: string
  activeConnections: number
  queuedExecutions: number
}

/**
 * Enhanced credential with security info
 */
export interface EnhancedCredential extends CredentialData {
  isValid?: boolean
  lastTested?: Date
  usedByWorkflows?: string[]
  securityLevel?: 'low' | 'medium' | 'high'
}

/**
 * User activity summary
 */
export interface UserActivity {
  userId: string
  lastLogin?: Date
  workflowsCreated: number
  workflowsExecuted: number
  credentialsManaged: number
  activityLevel: 'low' | 'medium' | 'high'
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  id: string
  workflowId: string
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  isTest: boolean
  nodeId: string
}

/**
 * Execution filter options
 */
export interface ExecutionFilterOptions {
  workflowId?: string
  status?: 'success' | 'error' | 'running' | 'waiting' | 'canceled'
  startDate?: Date
  endDate?: Date
  mode?: 'manual' | 'trigger' | 'retry'
  tags?: string[]
  limit?: number
  offset?: number
}

/**
 * Node validation result
 */
export interface NodeValidationResult {
  isValid: boolean
  errors: Array<{
    field: string
    message: string
    severity: 'error' | 'warning'
  }>
  warnings: Array<{
    field: string
    message: string
    suggestion?: string
  }>
}

/**
 * API rate limit info
 */
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  size: number
  hitRate: number
  missRate: number
  totalRequests: number
  memoryUsage: number
  entries: Array<{
    key: string
    size: number
    age: number
    ttl: number
    hitCount: number
  }>
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  responseTime: number
  requestSize: number
  responseSize: number
  memoryUsed: number
  cpuUsage: number
  cacheHit: boolean
  retryCount: number
}

/**
 * Error context for enhanced error handling
 */
export interface ErrorContext {
  operation: string
  endpoint: string
  requestId?: string
  userId?: string
  workflowId?: string
  executionId?: string
  timestamp: Date
  userAgent?: string
  metadata?: Record<string, unknown>
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string
  timestamp: Date
  userId: string
  action: string
  resource: string
  resourceId: string
  details: Record<string, unknown>
  ipAddress: string
  userAgent: string
  success: boolean
  errorMessage?: string
}

/**
 * Export/import options
 */
export interface ExportOptions {
  format: 'json' | 'yaml'
  includeCredentials: boolean
  includeExecutions: boolean
  includeSettings: boolean
  password?: string
}

/**
 * Import validation result
 */
export interface ImportValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  workflowCount: number
  credentialCount: number
  conflicts: Array<{
    type: 'workflow' | 'credential'
    name: string
    action: 'skip' | 'overwrite' | 'rename'
  }>
}
