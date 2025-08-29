/**
 * Enhanced Error Handling System
 *
 * Provides structured error handling, logging, and recovery mechanisms
 * for the optimized n8n-MCP Modern server.
 *
 * Philosophy: Fail fast, log comprehensively, recover gracefully
 */

// Removed node22-features.js dependency
import { featureFlags } from './feature-flags.js'
import { logger } from './logger.js'

// === Enhanced Error Types ===

export enum ErrorCategory {
  TOOL_EXECUTION = 'tool_execution',
  N8N_API = 'n8n_api',
  DATABASE = 'database',
  CONFIGURATION = 'configuration',
  VALIDATION = 'validation',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  PERFORMANCE = 'performance',
  SYSTEM = 'system',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorDetailLevel {
  MINIMAL = 'minimal', // Production: basic error message only
  STANDARD = 'standard', // Staging: include some technical details
  DETAILED = 'detailed', // Development: full error details
  DEBUG = 'debug', // Debug: everything including stack traces
}

export interface ErrorContext {
  requestId?: string
  toolName?: string
  userId?: string
  timestamp: number
  category: ErrorCategory
  severity: ErrorSeverity
  recoverable: boolean
  metadata?: Record<string, unknown>
}

export class EnhancedMcpError extends Error {
  public readonly context: ErrorContext
  public readonly originalError?: Error
  public readonly statusCode?: number

  constructor(
    message: string,
    context: Omit<ErrorContext, 'timestamp'>,
    originalError?: Error,
    statusCode?: number,
  ) {
    super(message)
    this.name = 'EnhancedMcpError'
    this.context = {
      ...context,
      timestamp: Date.now(),
    }
    // Fix exactOptionalPropertyTypes violations by using conditional assignment
    if (originalError !== undefined) {
      this.originalError = originalError
    }
    if (statusCode !== undefined) {
      this.statusCode = statusCode
    }

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EnhancedMcpError)
    }
  }

  /**
   * Get formatted error for logging
   */
  toLogFormat(): {
    message: string
    level: 'warn' | 'error'
    context: Record<string, unknown>
  } {
    const detailLevel = EnhancedErrorHandler.getErrorDetailLevel()

    const baseContext: Record<string, unknown> = {
      category: this.context.category,
      severity: this.context.severity,
      recoverable: this.context.recoverable,
    }

    // Add details based on environment level
    switch (detailLevel) {
      case ErrorDetailLevel.MINIMAL:
        // Production: Minimal logging, no sensitive data
        break

      case ErrorDetailLevel.STANDARD:
        // Staging: Add basic context
        Object.assign(baseContext, {
          requestId: this.context.requestId,
          toolName: this.context.toolName,
          statusCode: this.statusCode,
        })
        break

      case ErrorDetailLevel.DETAILED:
        // Development: Add more context
        Object.assign(baseContext, {
          requestId: this.context.requestId,
          toolName: this.context.toolName,
          statusCode: this.statusCode,
          metadata: this.context.metadata,
          originalError: this.originalError?.message,
        })
        break

      case ErrorDetailLevel.DEBUG:
        // Debug: Include everything
        Object.assign(baseContext, {
          requestId: this.context.requestId,
          toolName: this.context.toolName,
          statusCode: this.statusCode,
          metadata: this.context.metadata,
          originalError: this.originalError?.message,
          stack: this.originalError?.stack?.split('\n').slice(0, 5).join('\n'),
          timestamp: this.context.timestamp,
        })
        break
    }

    return {
      message: this.message,
      level: this.context.severity === ErrorSeverity.CRITICAL ? 'error' : 'warn',
      context: baseContext,
    }
  }

  /**
   * Get user-friendly error response
   */
  toUserResponse(): {
    content: Array<{ type: 'text', text: string }>
    isError: true
  } {
    const userMessage = this.getUserFriendlyMessage()
    return {
      content: [{ type: 'text', text: userMessage }],
      isError: true,
    }
  }

  private getUserFriendlyMessage(): string {
    const detailLevel = EnhancedErrorHandler.getErrorDetailLevel()

    // Sanitize the error message to remove sensitive information
    const sanitizedMessage = this.sanitizeErrorMessage(this.message)

    // Get base message based on category
    const baseMessage = this.getCategoryMessage(sanitizedMessage)

    // Add details based on environment
    switch (detailLevel) {
      case ErrorDetailLevel.MINIMAL:
        return this.getMinimalErrorMessage()

      case ErrorDetailLevel.STANDARD:
        return baseMessage

      case ErrorDetailLevel.DETAILED:
        return this.getDetailedErrorMessage(baseMessage)

      case ErrorDetailLevel.DEBUG:
        return this.getDebugErrorMessage(baseMessage)

      default:
        return baseMessage
    }
  }

  private getCategoryMessage(sanitizedMessage: string): string {
    switch (this.context.category) {
      case ErrorCategory.N8N_API:
        return `n8n API Error: ${sanitizedMessage}. Please check your n8n server connection and credentials.`
      case ErrorCategory.DATABASE:
        return `Database Error: ${sanitizedMessage}. The operation could not be completed.`
      case ErrorCategory.CONFIGURATION:
        return `Configuration Error: ${sanitizedMessage}. Please check your MCP configuration.`
      case ErrorCategory.VALIDATION:
        return `Input Validation Error: ${sanitizedMessage}. Please check your input parameters.`
      case ErrorCategory.NETWORK:
        return `Network Error: ${sanitizedMessage}. Please check your network connection.`
      case ErrorCategory.AUTHENTICATION:
        return `Authentication Error: ${sanitizedMessage}. Please check your credentials.`
      default:
        return `Error: ${sanitizedMessage}`
    }
  }

  private getMinimalErrorMessage(): string {
    // Production: Only show generic error messages
    switch (this.context.category) {
      case ErrorCategory.N8N_API:
        return 'n8n service is temporarily unavailable. Please try again later.'
      case ErrorCategory.DATABASE:
        return 'Data operation failed. Please try again.'
      case ErrorCategory.CONFIGURATION:
        return 'Configuration issue detected. Please contact support.'
      case ErrorCategory.VALIDATION:
        return 'Invalid input provided. Please check your parameters.'
      case ErrorCategory.NETWORK:
        return 'Network connection issue. Please check connectivity.'
      case ErrorCategory.AUTHENTICATION:
        return 'Authentication failed. Please verify credentials.'
      default:
        return 'An error occurred. Please try again or contact support.'
    }
  }

  private getDetailedErrorMessage(baseMessage: string): string {
    // Development: Include technical details
    const details: string[] = [baseMessage]

    if (this.context.requestId) {
      details.push(`Request ID: ${this.context.requestId}`)
    }

    if (this.context.toolName) {
      details.push(`Tool: ${this.context.toolName}`)
    }

    if (this.statusCode) {
      details.push(`Status: ${this.statusCode}`)
    }

    if (this.context.metadata) {
      const metadataStr = Object.entries(this.context.metadata)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(', ')
      if (metadataStr) {
        details.push(`Details: ${metadataStr}`)
      }
    }

    return details.join(' | ')
  }

  private getDebugErrorMessage(baseMessage: string): string {
    // Debug: Include everything including stack traces
    const details: string[] = [baseMessage]

    if (this.context.requestId) {
      details.push(`Request ID: ${this.context.requestId}`)
    }

    if (this.context.toolName) {
      details.push(`Tool: ${this.context.toolName}`)
    }

    if (this.statusCode) {
      details.push(`Status: ${this.statusCode}`)
    }

    if (this.originalError?.stack) {
      details.push(`Stack: ${this.originalError.stack.split('\n').slice(0, 3).join(' -> ')}`)
    }

    if (this.context.metadata) {
      details.push(`Metadata: ${JSON.stringify(this.context.metadata)}`)
    }

    details.push(`Category: ${this.context.category}`)
    details.push(`Severity: ${this.context.severity}`)
    details.push(`Recoverable: ${this.context.recoverable}`)

    return details.join(' | ')
  }

  /**
   * Sanitize error messages to remove sensitive information and stack traces
   */
  private sanitizeErrorMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      return 'An error occurred'
    }

    return message
      // Remove sensitive keywords and replace with generic terms
      .replace(/api[_\s]*key/gi, 'credentials')
      .replace(/api[_\s]*token/gi, 'authentication')
      .replace(/password/gi, 'credentials')
      .replace(/secret/gi, 'configuration')
      .replace(/bearer\s+[\w-]+/gi, 'authentication')
      .replace(/token:\s*[\w-]+/gi, 'authentication')

      // Remove stack traces and technical details
      .replace(/at Object\.[\w$.()[\] ]+/g, '[internal]')
      .replace(/\s+at\s+[^\n]+/g, '')
      .replace(/\s+\([^)]+\)$/gm, '')
      .replace(/Error:\s*/g, '')

      // Remove file paths and internal references
      .replace(/[a-z]:[\\/][^:]+:\d+:\d+/gi, '[internal]')
      .replace(/\/[\w\-/]+\.js:\d+:\d+/g, '[internal]')
      .replace(/src\/[\w\-/]+\.ts/g, '[internal]')

      // Clean up multiple spaces and trim
      .replace(/\s+/g, ' ')
      .trim()
  }
}

// === Error Handler Class ===

export class EnhancedErrorHandler {
  private static errorCounts = new Map<string, number>()
  private static lastErrorTime = new Map<string, number>()

  /**
   * Determine error detail level based on environment and configuration
   */
  static getErrorDetailLevel(): ErrorDetailLevel {
    // Check explicit configuration first
    if (process.env.ERROR_DETAIL_LEVEL) {
      const level = process.env.ERROR_DETAIL_LEVEL.toLowerCase()
      switch (level) {
        case 'minimal': return ErrorDetailLevel.MINIMAL
        case 'standard': return ErrorDetailLevel.STANDARD
        case 'detailed': return ErrorDetailLevel.DETAILED
        case 'debug': return ErrorDetailLevel.DEBUG
      }
    }

    // Auto-detect based on NODE_ENV
    const nodeEnv = process.env.NODE_ENV?.toLowerCase()
    switch (nodeEnv) {
      case 'production':
        return ErrorDetailLevel.MINIMAL
      case 'staging':
        return ErrorDetailLevel.STANDARD
      case 'development':
      case 'dev':
        return ErrorDetailLevel.DETAILED
      case 'test':
      case 'debug':
        return ErrorDetailLevel.DEBUG
      default:
        // Default to standard for unknown environments
        return ErrorDetailLevel.STANDARD
    }
  }

  /**
   * Handle and log errors with context
   */
  static handleError(error: unknown, context?: Partial<ErrorContext>): EnhancedMcpError {
    const enhancedError = this.normalizeError(error, context)

    // Log the error
    const logData = enhancedError.toLogFormat()
    if (logData.level === 'error') {
      logger.error(logData.message, logData.context)
    }
    else {
      logger.warn(logData.message, logData.context)
    }

    // Track error patterns
    this.trackErrorPattern(enhancedError)

    // Performance monitoring
    if (enhancedError.context.category === ErrorCategory.PERFORMANCE) {
      // Performance monitoring removed
    }

    return enhancedError
  }

  /**
   * Normalize any error into an EnhancedMcpError
   */
  private static normalizeError(error: unknown, context?: Partial<ErrorContext>): EnhancedMcpError {
    if (error instanceof EnhancedMcpError) {
      return error
    }

    if (error instanceof Error) {
      const category = this.categorizeError(error)
      const severity = this.determineSeverity(error, category)

      return new EnhancedMcpError(
        error.message,
        {
          category,
          severity,
          recoverable: this.isRecoverable(error, category),
          ...context,
        },
        error,
      )
    }

    // Handle non-Error objects
    const message = typeof error === 'string' ? error : 'Unknown error occurred'
    return new EnhancedMcpError(
      message,
      {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        ...context,
      },
    )
  }

  /**
   * Categorize error based on type and message
   */
  private static categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()

    if (message.includes('n8n') || message.includes('workflow')) {
      return ErrorCategory.N8N_API
    }

    if (message.includes('database') || message.includes('sqlite')) {
      return ErrorCategory.DATABASE
    }

    if (message.includes('config') || message.includes('environment')) {
      return ErrorCategory.CONFIGURATION
    }

    if (name.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return ErrorCategory.NETWORK
    }

    if (message.includes('auth') || message.includes('credential') || message.includes('permission')) {
      return ErrorCategory.AUTHENTICATION
    }

    if (message.includes('memory') || message.includes('performance')) {
      return ErrorCategory.PERFORMANCE
    }

    return ErrorCategory.SYSTEM
  }

  /**
   * Determine error severity
   */
  private static determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    const message = error.message.toLowerCase()

    // Critical errors
    if (message.includes('memory') || message.includes('fatal') || message.includes('corruption')) {
      return ErrorSeverity.CRITICAL
    }

    // High severity errors
    if (category === ErrorCategory.DATABASE || category === ErrorCategory.AUTHENTICATION) {
      return ErrorSeverity.HIGH
    }

    if (message.includes('failed') || message.includes('error')) {
      return ErrorSeverity.MEDIUM
    }

    return ErrorSeverity.LOW
  }

  /**
   * Determine if error is recoverable
   */
  private static isRecoverable(error: Error, category: ErrorCategory): boolean {
    const message = error.message.toLowerCase()

    // Non-recoverable errors
    if (message.includes('corruption') || message.includes('fatal')) {
      return false
    }

    // Category-based recovery
    switch (category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.N8N_API:
      case ErrorCategory.VALIDATION:
        return true
      case ErrorCategory.DATABASE:
      case ErrorCategory.CONFIGURATION:
        return false
      default:
        return true
    }
  }

  /**
   * Track error patterns for monitoring
   */
  private static trackErrorPattern(error: EnhancedMcpError): void {
    const key = `${error.context.category}_${error.message.slice(0, 50)}`
    const count = (this.errorCounts.get(key) || 0) + 1
    const now = Date.now()

    this.errorCounts.set(key, count)
    this.lastErrorTime.set(key, now)

    // Alert on repeated errors
    if (count >= 5) {
      const lastTime = this.lastErrorTime.get(key) || 0
      const timeDiff = now - lastTime

      if (timeDiff < 300000) { // 5 minutes
        logger.error('Repeated error pattern detected', {
          errorPattern: key,
          count,
          timeWindow: `${timeDiff}ms`,
          category: error.context.category,
          severity: error.context.severity,
        })
      }
    }

    // Clean up old error counts (memory management)
    if (featureFlags.performance.limitMetricsArrays) {
      if (this.errorCounts.size > 100) {
        // Remove oldest entries
        const entries = Array.from(this.errorCounts.entries())
        entries.sort(([,a], [,b]) => a - b)
        entries.slice(0, 50).forEach(([key]) => {
          this.errorCounts.delete(key)
          this.lastErrorTime.delete(key)
        })
      }
    }
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): {
    totalErrors: number
    errorsByCategory: Record<ErrorCategory, number>
    recentErrors: number
  } {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    const errorsByCategory = {} as Record<ErrorCategory, number>
    let recentErrors = 0

    for (const [key, timestamp] of this.lastErrorTime.entries()) {
      if (timestamp > oneHourAgo) {
        recentErrors++
      }

      const category = key.split('_')[0] as ErrorCategory
      errorsByCategory[category] = (errorsByCategory[category] || 0) + 1
    }

    return {
      totalErrors: this.errorCounts.size,
      errorsByCategory,
      recentErrors,
    }
  }
}

// === Utility Functions ===

/**
 * Wrapper for async operations with enhanced error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: Partial<ErrorContext>,
): Promise<T> {
  try {
    return await operation()
  }
  catch (error) {
    throw EnhancedErrorHandler.handleError(error, context)
  }
}

/**
 * Wrapper for tool execution with error handling
 */
export async function executeWithErrorHandling<T>(
  toolName: string,
  operation: () => Promise<T>,
  requestId?: string,
): Promise<T> {
  const context: Partial<ErrorContext> = {
    category: ErrorCategory.TOOL_EXECUTION,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    toolName,
    metadata: {
      executionTime: Date.now(),
    },
  }

  // Only add requestId if it's defined to satisfy exactOptionalPropertyTypes
  if (requestId !== undefined) {
    context.requestId = requestId
  }

  return withErrorHandling(operation, context)
}

/**
 * Specialized wrapper for MCP tool handlers that return content responses
 */
export async function executeToolWithErrorHandling(
  toolName: string,
  operation: () => Promise<{ content: Array<{ type: 'text', text: string }> }>,
  requestId?: string,
): Promise<{ content: Array<{ type: 'text', text: string }>, isError?: boolean }> {
  try {
    const result = await executeWithErrorHandling(toolName, operation, requestId)
    return result
  }
  catch (error) {
    if (error instanceof EnhancedMcpError) {
      return error.toUserResponse()
    }

    // Handle non-enhanced errors
    const enhancedError = EnhancedErrorHandler.handleError(error, {
      category: ErrorCategory.TOOL_EXECUTION,
      severity: ErrorSeverity.MEDIUM,
      recoverable: true,
      toolName,
      ...(requestId !== undefined && { requestId }),
      metadata: { executionTime: Date.now() },
    })

    return enhancedError.toUserResponse()
  }
}

// === Utility Functions for Error Detail Level Management ===

/**
 * Get current error detail level configuration
 */
export function getCurrentErrorDetailLevel(): ErrorDetailLevel {
  return EnhancedErrorHandler.getErrorDetailLevel()
}

/**
 * Check if current environment allows detailed error information
 */
export function shouldShowDetailedErrors(): boolean {
  const level = EnhancedErrorHandler.getErrorDetailLevel()
  return level === ErrorDetailLevel.DETAILED || level === ErrorDetailLevel.DEBUG
}

/**
 * Check if current environment allows debug information
 */
export function shouldShowDebugInfo(): boolean {
  return EnhancedErrorHandler.getErrorDetailLevel() === ErrorDetailLevel.DEBUG
}

/**
 * Get environment-appropriate error message for a given error
 */
export function getEnvironmentFriendlyErrorMessage(
  error: unknown,
  context?: Partial<ErrorContext>,
): string {
  const enhancedError = EnhancedErrorHandler.handleError(error, context)
  return enhancedError.toUserResponse().content[0]?.text || 'An error occurred'
}
