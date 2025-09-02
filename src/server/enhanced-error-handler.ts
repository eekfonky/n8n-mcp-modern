/**
 * Enhanced Error Handling System
 *
 * Comprehensive error classification, recovery strategies, and monitoring
 * Built for production reliability and maintainability
 */

import { ApiConnectionError, ApiValidationError } from '../types/api-validation.js'
import { logger } from './logger.js'

// ============================================================================
// ERROR CODES AND CATEGORIES
// ============================================================================

/**
 * Standardized error codes for different error categories
 */
export enum ErrorCode {
  // Configuration Errors (1000-1099)
  CONFIG_MISSING = 'ERR_1000',
  CONFIG_INVALID = 'ERR_1001',
  CONFIG_ENV_MISSING = 'ERR_1002',
  CONFIG_VALIDATION_FAILED = 'ERR_1003',

  // Connection Errors (1100-1199)
  CONNECTION_TIMEOUT = 'ERR_1100',
  CONNECTION_REFUSED = 'ERR_1101',
  CONNECTION_LOST = 'ERR_1102',
  CONNECTION_UNAUTHORIZED = 'ERR_1103',
  CONNECTION_FORBIDDEN = 'ERR_1104',
  CONNECTION_NOT_FOUND = 'ERR_1105',
  CONNECTION_RATE_LIMITED = 'ERR_1106',

  // API Errors (1200-1299)
  API_INVALID_RESPONSE = 'ERR_1200',
  API_VALIDATION_FAILED = 'ERR_1201',
  API_VERSION_MISMATCH = 'ERR_1202',
  API_QUOTA_EXCEEDED = 'ERR_1203',
  API_MAINTENANCE = 'ERR_1204',

  // Discovery Errors (1300-1399)
  DISCOVERY_NO_CREDENTIALS = 'ERR_1300',
  DISCOVERY_CREDENTIAL_INVALID = 'ERR_1301',
  DISCOVERY_NO_NODES_FOUND = 'ERR_1302',
  DISCOVERY_SESSION_FAILED = 'ERR_1303',
  DISCOVERY_TIMEOUT = 'ERR_1304',

  // Database Errors (1400-1499)
  DATABASE_CONNECTION_FAILED = 'ERR_1400',
  DATABASE_QUERY_FAILED = 'ERR_1401',
  DATABASE_MIGRATION_FAILED = 'ERR_1402',
  DATABASE_CORRUPTED = 'ERR_1403',
  DATABASE_LOCKED = 'ERR_1404',

  // Tool Generation Errors (1500-1599)
  TOOL_GENERATION_FAILED = 'ERR_1500',
  TOOL_VALIDATION_FAILED = 'ERR_1501',
  TOOL_EXECUTION_FAILED = 'ERR_1502',
  TOOL_SCHEMA_INVALID = 'ERR_1503',

  // Memory and Performance Errors (1600-1699)
  MEMORY_LIMIT_EXCEEDED = 'ERR_1600',
  PERFORMANCE_DEGRADED = 'ERR_1601',
  RESOURCE_EXHAUSTED = 'ERR_1602',
  TIMEOUT_EXCEEDED = 'ERR_1603',

  // Security Errors (1700-1799)
  SECURITY_UNAUTHORIZED = 'ERR_1700',
  SECURITY_TOKEN_INVALID = 'ERR_1701',
  SECURITY_SIGNATURE_INVALID = 'ERR_1702',
  SECURITY_RATE_LIMITED = 'ERR_1703',

  // Generic/Unknown Errors (1900-1999)
  UNKNOWN_ERROR = 'ERR_1900',
  INTERNAL_ERROR = 'ERR_1901',
  UNEXPECTED_ERROR = 'ERR_1902',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Recovery strategies for different error types
 */
export enum RecoveryStrategy {
  NONE = 'none',
  FAIL_FAST = 'fail_fast',
  MANUAL_INTERVENTION = 'manual_intervention',
}

// ============================================================================
// ENHANCED ERROR CLASSES
// ============================================================================

/**
 * Base enhanced error class with structured information
 */
export class EnhancedError extends Error {
  public readonly timestamp: Date = new Date()
  public readonly errorId: string = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public readonly recoveryStrategy: RecoveryStrategy = RecoveryStrategy.NONE,
    public readonly context?: Record<string, unknown>,
    public readonly retryable: boolean = false,
    cause?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
    this.cause = cause

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype)

    // Log error immediately
    this.logError()
  }

  /**
   * Log error with appropriate level based on severity
   */
  private logError(): void {
    const logData = {
      errorId: this.errorId,
      code: this.code,
      severity: this.severity,
      recoveryStrategy: this.recoveryStrategy,
      retryable: this.retryable,
      context: this.context,
      cause: this.cause instanceof Error ? this.cause.message : String(this.cause),
      timestamp: this.timestamp.toISOString(),
    }

    switch (this.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(`[CRITICAL] ${this.message}`, logData)
        break
      case ErrorSeverity.HIGH:
        logger.error(`[HIGH] ${this.message}`, logData)
        break
      case ErrorSeverity.MEDIUM:
        logger.warn(`[MEDIUM] ${this.message}`, logData)
        break
      case ErrorSeverity.LOW:
        logger.debug(`[LOW] ${this.message}`, logData)
        break
    }
  }

  /**
   * Get formatted error information for external consumption
   */
  public getErrorInfo(): {
    errorId: string
    code: string
    message: string
    severity: string
    recoveryStrategy: string
    retryable: boolean
    timestamp: string
    context?: Record<string, unknown>
  } {
    return {
      errorId: this.errorId,
      code: this.code,
      message: this.message,
      severity: this.severity,
      recoveryStrategy: this.recoveryStrategy,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
      ...(this.context && { context: this.context }),
    }
  }

  /**
   * Convert to JSON for serialization
   */
  public toJSON(): Record<string, unknown> {
    return this.getErrorInfo()
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends EnhancedError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.CONFIG_INVALID,
    context?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(
      message,
      code,
      ErrorSeverity.HIGH,
      RecoveryStrategy.MANUAL_INTERVENTION,
      context,
      false,
      cause,
    )
  }
}

/**
 * Connection-related errors with automatic recovery strategies
 */
export class ConnectionError extends EnhancedError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.CONNECTION_TIMEOUT,
    context?: Record<string, unknown>,
    cause?: unknown,
  ) {
    const recoveryStrategy = ConnectionError.getRecoveryStrategy(code)
    const retryable = ConnectionError.isRetryable(code)

    super(
      message,
      code,
      ErrorSeverity.MEDIUM,
      recoveryStrategy,
      context,
      retryable,
      cause,
    )
  }

  private static getRecoveryStrategy(_code: ErrorCode): RecoveryStrategy {
    // With fail-fast approach, all connection errors require manual intervention
    return RecoveryStrategy.MANUAL_INTERVENTION
  }

  private static isRetryable(_code: ErrorCode): boolean {
    // With fail-fast approach, errors are not retryable
    return false
  }
}

/**
 * Discovery-related errors
 */
export class DiscoveryError extends EnhancedError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.DISCOVERY_SESSION_FAILED,
    context?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(
      message,
      code,
      ErrorSeverity.HIGH,
      RecoveryStrategy.FAIL_FAST,
      context,
      false,
      cause,
    )
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends EnhancedError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.DATABASE_QUERY_FAILED,
    context?: Record<string, unknown>,
    cause?: unknown,
  ) {
    const severity = code === ErrorCode.DATABASE_CORRUPTED
      ? ErrorSeverity.CRITICAL
      : ErrorSeverity.HIGH

    const recoveryStrategy = DatabaseError.getRecoveryStrategy(code)

    super(
      message,
      code,
      severity,
      recoveryStrategy,
      context,
      false,
      cause,
    )
  }

  private static getRecoveryStrategy(code: ErrorCode): RecoveryStrategy {
    switch (code) {
      case ErrorCode.DATABASE_CORRUPTED:
        return RecoveryStrategy.MANUAL_INTERVENTION
      default:
        return RecoveryStrategy.FAIL_FAST
    }
  }
}

/**
 * Performance-related errors
 */
export class PerformanceError extends EnhancedError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PERFORMANCE_DEGRADED,
    context?: Record<string, unknown>,
    cause?: unknown,
  ) {
    const severity = code === ErrorCode.MEMORY_LIMIT_EXCEEDED
      ? ErrorSeverity.CRITICAL
      : ErrorSeverity.HIGH

    super(
      message,
      code,
      severity,
      RecoveryStrategy.FAIL_FAST,
      context,
      false,
      cause,
    )
  }
}

// ============================================================================
// ERROR RECOVERY SYSTEM
// ============================================================================

/**
 * Recovery context for retry operations
 */
export interface RecoveryContext {
  maxRetries: number
  currentRetry: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  onRetry?: (attempt: number, error: EnhancedError) => void
  onRecovery?: (attempt: number) => void
  onFailure?: (error: EnhancedError) => void
}

/**
 * Default recovery configuration
 */
export const defaultRecoveryContext: RecoveryContext = {
  maxRetries: 3,
  currentRetry: 0,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

/**
 * Simplified Error Manager for fail-fast approach
 */
export class ErrorRecoveryManager {
  /**
   * Execute operation with fail-fast error handling
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    _context: Partial<RecoveryContext> = {},
  ): Promise<T> {
    try {
      return await operation()
    }
    catch (error) {
      const enhancedError = this.enhanceError(error)
      throw enhancedError
    }
  }

  /**
   * Enhance generic errors to structured errors
   */
  private enhanceError(error: unknown): EnhancedError {
    if (error instanceof EnhancedError) {
      return error
    }

    if (error instanceof ApiValidationError) {
      return new EnhancedError(
        error.message,
        ErrorCode.API_VALIDATION_FAILED,
        ErrorSeverity.HIGH,
        RecoveryStrategy.FAIL_FAST,
        {
          endpoint: error.endpoint,
          httpStatus: error.httpStatus,
          validationErrors: error.getValidationDetails(),
        },
        false,
        error,
      )
    }

    if (error instanceof ApiConnectionError) {
      return new ConnectionError(
        error.message,
        ErrorCode.CONNECTION_TIMEOUT,
        { endpoint: error.endpoint },
        error,
      )
    }

    // Generic error enhancement
    const message = error instanceof Error ? error.message : String(error)
    return new EnhancedError(
      message,
      ErrorCode.UNKNOWN_ERROR,
      ErrorSeverity.HIGH,
      RecoveryStrategy.FAIL_FAST,
      undefined,
      false,
      error,
    )
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

/**
 * Global error recovery manager instance
 */
export const errorRecoveryManager = new ErrorRecoveryManager()

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Type guard for enhanced errors
 */
export function isEnhancedError(error: unknown): error is EnhancedError {
  return error instanceof EnhancedError
}

/**
 * Extract error code from any error type
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (isEnhancedError(error)) {
    return error.code
  }
  return ErrorCode.UNKNOWN_ERROR
}

/**
 * Create specific error types with convenience functions
 */
export const createError = {
  configuration: (message: string, context?: Record<string, unknown>, cause?: unknown): ConfigurationError =>
    new ConfigurationError(message, ErrorCode.CONFIG_INVALID, context, cause),

  connection: (message: string, context?: Record<string, unknown>, cause?: unknown): ConnectionError =>
    new ConnectionError(message, ErrorCode.CONNECTION_TIMEOUT, context, cause),

  discovery: (message: string, context?: Record<string, unknown>, cause?: unknown): DiscoveryError =>
    new DiscoveryError(message, ErrorCode.DISCOVERY_SESSION_FAILED, context, cause),

  database: (message: string, context?: Record<string, unknown>, cause?: unknown): DatabaseError =>
    new DatabaseError(message, ErrorCode.DATABASE_QUERY_FAILED, context, cause),

  performance: (message: string, context?: Record<string, unknown>, cause?: unknown): PerformanceError =>
    new PerformanceError(message, ErrorCode.PERFORMANCE_DEGRADED, context, cause),
}

/**
 * Safe operation wrapper that never throws, returns result object
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  _context?: Partial<RecoveryContext>,
): Promise<{ success: true, data: T } | { success: false, error: EnhancedError }> {
  try {
    const data = await operation()
    return { success: true, data }
  }
  catch (error) {
    const enhancedError = error instanceof EnhancedError
      ? error
      : new EnhancedError(
        error instanceof Error ? error.message : String(error),
        ErrorCode.UNKNOWN_ERROR,
      )

    return { success: false, error: enhancedError }
  }
}
