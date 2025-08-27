/**
 * Enhanced Error Handling System
 *
 * Provides structured error handling, logging, and recovery mechanisms
 * for the optimized n8n-MCP Modern server.
 *
 * Philosophy: Fail fast, log comprehensively, recover gracefully
 */

import { performanceMonitor } from '../utils/node22-features.js'
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
    return {
      message: this.message,
      level: this.context.severity === ErrorSeverity.CRITICAL ? 'error' : 'warn',
      context: {
        category: this.context.category,
        severity: this.context.severity,
        recoverable: this.context.recoverable,
        requestId: this.context.requestId,
        toolName: this.context.toolName,
        statusCode: this.statusCode,
        metadata: this.context.metadata,
        originalError: this.originalError?.message,
        // Stack trace removed for security - see sanitizeErrorMessage for details
      },
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
    // Sanitize the error message to remove sensitive information
    const sanitizedMessage = this.sanitizeErrorMessage(this.message)

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
      performanceMonitor.recordError(enhancedError.context.toolName || 'unknown')
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
