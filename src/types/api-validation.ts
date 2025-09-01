/**
 * API Response Validation Utilities
 * Error classes, validation helpers, and runtime validation logic
 */

import { z } from 'zod'
import { logger } from '../server/logger.js'

// ============================================================================
// VALIDATION ERROR CLASSES
// ============================================================================

/**
 * API Response Validation Error
 * Thrown when API response doesn't match expected schema
 */
export class ApiValidationError extends Error {
  public override readonly name = 'ApiValidationError'
  public readonly isApiValidationError = true

  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly httpStatus: number,
    public readonly response: unknown,
    public readonly validationErrors: z.ZodError,
    public readonly responseTime?: number,
  ) {
    super(message)

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiValidationError.prototype)

    // Log validation failure for monitoring
    logger.warn('API Response Validation Failed', {
      endpoint,
      httpStatus,
      errorCount: validationErrors.issues.length,
      firstError: validationErrors.issues[0],
      responseTime,
    })
  }

  /**
   * Get formatted validation error details
   */
  public getValidationDetails(): {
    issues: Array<{
      path: string
      message: string
      code: string
      received: unknown
    }>
    summary: string
  } {
    const issues = this.validationErrors.issues.map(issue => ({
      path: issue.path.join('.') || 'root',
      message: issue.message,
      code: issue.code,
      received: 'received' in issue ? issue.received : undefined,
    }))

    const summary = `${issues.length} validation error(s): ${issues
      .slice(0, 3)
      .map(i => `${i.path}: ${i.message}`)
      .join(', ')}${issues.length > 3 ? '...' : ''}`

    return { issues, summary }
  }

  /**
   * Get sanitized response data (removes sensitive info)
   */
  public getSanitizedResponse(): unknown {
    if (typeof this.response === 'object' && this.response !== null) {
      const obj = this.response as Record<string, unknown>
      const sanitized = { ...obj }

      // Remove potentially sensitive fields
      const sensitiveFields = [
        'password',
        'token',
        'apiKey',
        'secret',
        'credential',
        'auth',
        'key',
      ]

      for (const field of sensitiveFields) {
        if (field in sanitized) {
          sanitized[field] = '[REDACTED]'
        }
      }

      return sanitized
    }

    return this.response
  }
}

/**
 * API Connection Error
 * Thrown when API request fails at network/HTTP level
 */
export class ApiConnectionError extends Error {
  public override readonly name = 'ApiConnectionError'
  public readonly isApiConnectionError = true

  constructor(
    message: string,
    public readonly endpoint: string,
    public override readonly cause?: unknown,
    public readonly responseTime?: number,
  ) {
    super(message)
    Object.setPrototypeOf(this, ApiConnectionError.prototype)

    logger.error('API Connection Failed', {
      endpoint,
      message,
      cause: cause instanceof Error ? cause.message : String(cause),
      responseTime,
    })
  }
}

// ============================================================================
// VALIDATION CONFIGURATION
// ============================================================================

/**
 * Validation behavior configuration
 */
export interface ValidationConfig {
  /** Whether to throw errors on validation failures (vs. logging warnings) */
  strict: boolean
  /** Whether to log validation details */
  enableLogging: boolean
  /** Timeout for validation operations (ms) */
  timeout: number
  /** Whether to sanitize responses before validation */
  sanitizeResponses: boolean
  /** Maximum response size to validate (bytes) */
  maxResponseSize: number
}

/**
 * Default validation configuration
 */
export const defaultValidationConfig: ValidationConfig = {
  strict: false, // Start permissive
  enableLogging: true,
  timeout: 5000,
  sanitizeResponses: true,
  maxResponseSize: 10 * 1024 * 1024, // 10MB
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates API response with comprehensive error handling
 */
export async function validateApiResponse<T>(
  response: unknown,
  schema: z.ZodSchema<T>,
  endpoint: string,
  httpStatus: number,
  config: ValidationConfig = defaultValidationConfig,
  responseTime?: number,
): Promise<T> {
  const startTime = Date.now()

  try {
    // Check response size limit
    const responseStr = JSON.stringify(response)
    if (responseStr.length > config.maxResponseSize) {
      throw new Error(
        `Response too large: ${responseStr.length} bytes > ${config.maxResponseSize} bytes`,
      )
    }

    // Sanitize response if enabled
    let sanitizedResponse = response
    if (config.sanitizeResponses) {
      sanitizedResponse = sanitizeResponse(response)
    }

    // Validate with timeout
    const validationPromise = schema.parseAsync(sanitizedResponse)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Validation timeout')), config.timeout)
    })

    const validatedData = await Promise.race([
      validationPromise,
      timeoutPromise,
    ])

    // Log successful validation
    if (config.enableLogging) {
      const validationTime = Date.now() - startTime
      logger.debug('API Response Validated Successfully', {
        endpoint,
        httpStatus,
        responseTime,
        validationTime,
      })
    }

    return validatedData
  }
  catch (error) {
    const validationTime = Date.now() - startTime

    if (error instanceof z.ZodError) {
      const validationError = new ApiValidationError(
        `API response validation failed for ${endpoint}`,
        endpoint,
        httpStatus,
        response,
        error,
        responseTime,
      )

      if (config.strict) {
        throw validationError
      }
      else {
        // Non-strict mode: log warning and return raw response
        logger.warn('API Response Validation Failed (Non-Strict Mode)', {
          endpoint,
          httpStatus,
          validationTime,
          errorDetails: validationError.getValidationDetails(),
        })

        // Return raw response with type assertion (unsafe but preserves functionality)
        return response as T
      }
    }
    else {
      // Other validation errors (timeout, size, etc.)
      const errorMessage
        = error instanceof Error ? error.message : String(error)

      if (config.strict) {
        throw new Error(`Response validation failed: ${errorMessage}`)
      }
      else {
        logger.warn('Response Validation Issue (Non-Strict Mode)', {
          endpoint,
          error: errorMessage,
          validationTime,
        })
        return response as T
      }
    }
  }
}

/**
 * Sanitizes API response by removing unexpected fields and normalizing data
 */
function sanitizeResponse(response: unknown): unknown {
  if (response === null || response === undefined) {
    return response
  }

  if (Array.isArray(response)) {
    return response.map(sanitizeResponse)
  }

  if (typeof response === 'object') {
    const obj = response as Record<string, unknown>
    const sanitized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      // Skip internal/debug fields that might be added by development servers
      if (key.startsWith('_') || key.startsWith('__')) {
        continue
      }

      // Recursively sanitize nested objects
      sanitized[key] = sanitizeResponse(value)
    }

    return sanitized
  }

  return response
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * Result of validation operation
 */
export type ValidationResult<T>
  = | { success: true, data: T, warnings?: string[] }
    | { success: false, error: ApiValidationError }

/**
 * Safe validation that never throws, returns result object instead
 */
export async function safeValidateResponse<T>(
  response: unknown,
  schema: z.ZodSchema<T>,
  endpoint: string,
  httpStatus: number,
  config: ValidationConfig = defaultValidationConfig,
  responseTime?: number,
): Promise<ValidationResult<T>> {
  try {
    const data = await validateApiResponse(
      response,
      schema,
      endpoint,
      httpStatus,
      config,
      responseTime,
    )

    return { success: true, data }
  }
  catch (error) {
    if (error instanceof ApiValidationError) {
      return {
        success: false,
        error,
      }
    }
    else {
      // Convert other errors to ApiValidationError
      const validationError = new ApiValidationError(
        `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        endpoint,
        httpStatus,
        response,
        new z.ZodError([
          {
            code: 'custom',
            message: error instanceof Error ? error.message : String(error),
            path: [],
          },
        ]),
        responseTime,
      )

      return {
        success: false,
        error: validationError,
      }
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if error is an API validation error
 */
export function isApiValidationError(
  error: unknown,
): error is ApiValidationError {
  return (
    error instanceof ApiValidationError
    || (typeof error === 'object'
      && error !== null
      && 'isApiValidationError' in error
      && error.isApiValidationError === true)
  )
}

/**
 * Check if error is an API connection error
 */
export function isApiConnectionError(
  error: unknown,
): error is ApiConnectionError {
  return (
    error instanceof ApiConnectionError
    || (typeof error === 'object'
      && error !== null
      && 'isApiConnectionError' in error
      && error.isApiConnectionError === true)
  )
}

/**
 * Extract validation summary from error
 */
export function getValidationSummary(error: ApiValidationError): string {
  const details = error.getValidationDetails()
  return `${error.endpoint}: ${details.summary}`
}

/**
 * Create validation config with overrides
 */
export function createValidationConfig(
  overrides: Partial<ValidationConfig>,
): ValidationConfig {
  return { ...defaultValidationConfig, ...overrides }
}
