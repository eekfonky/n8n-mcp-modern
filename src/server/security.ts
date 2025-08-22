/**
 * Security module for n8n-MCP-Modern
 * Implements security controls and audit mechanisms
 */

import { Buffer } from 'node:buffer'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import { z } from 'zod'
import { config } from './config.js'
import { logger } from './logger.js'

/**
 * Security event types for audit logging
 */
export enum SecurityEventType {

  ACCESS_GRANTED = 'ACCESS_GRANTED',

  ACCESS_DENIED = 'ACCESS_DENIED',

  API_KEY_VALIDATED = 'API_KEY_VALIDATED',

  API_KEY_INVALID = 'API_KEY_INVALID',

  TOOL_EXECUTED = 'TOOL_EXECUTED',

  TOOL_DENIED = 'TOOL_DENIED',

  CONFIG_CHANGED = 'CONFIG_CHANGED',

  SECURITY_ERROR = 'SECURITY_ERROR',

  // Enhanced security events
  BRUTE_FORCE_DETECTED = 'BRUTE_FORCE_DETECTED',

  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',

  INPUT_VALIDATION_FAILED = 'INPUT_VALIDATION_FAILED',

  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  SECURITY_POLICY_VIOLATED = 'SECURITY_POLICY_VIOLATED',
}

/**
 * Security event for audit logging
 */
export interface SecurityEvent {
  timestamp: Date
  eventType: SecurityEventType
  userId?: string
  toolName?: string
  details?: Record<string, unknown>
  ipAddress?: string
  success: boolean
}

/**
 * Security audit logger
 */
class SecurityAuditLogger {
  private events: SecurityEvent[] = []
  private readonly maxEvents = 10000

  /**
   * Log a security event
   */
  logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    }

    this.events.push(fullEvent)

    // Trim events if exceeding max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }

    // Log to system logger based on event type
    if (event.success) {
      logger.info(`Security: ${event.eventType}`, {
        toolName: event.toolName,
        userId: event.userId,
      })
    }
    else {
      logger.warn(`Security Alert: ${event.eventType}`, {
        toolName: event.toolName,
        userId: event.userId,
        details: event.details,
      })
    }
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit = 100): SecurityEvent[] {
    return this.events.slice(-limit)
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: SecurityEventType, limit = 100): SecurityEvent[] {
    return this.events
      .filter(e => e.eventType === eventType)
      .slice(-limit)
  }

  /**
   * Clear audit log (use with caution)
   */
  clearLog(): void {
    this.events = []
    logger.info('Security audit log cleared')
  }
}

// Create singleton instance early to avoid "use before defined" errors
const securityAudit = new SecurityAuditLogger()

/**
 * API Key validator
 */
export class ApiKeyValidator {
  private readonly keyHashCache = new Map<string, string>()

  /**
   * Hash an API key for secure comparison
   */
  private hashKey(key: string): string {
    const cached = this.keyHashCache.get(key)
    if (cached)
      return cached

    const hash = createHash('sha256').update(key).digest('hex')
    this.keyHashCache.set(key, hash)
    return hash
  }

  /**
   * Validate API key format
   */
  validateFormat(apiKey: string): boolean {
    // n8n API keys are typically 64 characters
    const apiKeySchema = z.string().min(32).max(128)

    try {
      apiKeySchema.parse(apiKey)
      return true
    }
    catch {
      return false
    }
  }

  /**
   * Validate API key against configured key using timing-safe comparison
   */
  validateKey(providedKey: string): boolean {
    if (!config.n8nApiKey) {
      securityAudit.logEvent({
        eventType: SecurityEventType.API_KEY_INVALID,
        success: false,
        details: { reason: 'No API key configured' },
      })
      return false
    }

    if (!this.validateFormat(providedKey)) {
      securityAudit.logEvent({
        eventType: SecurityEventType.API_KEY_INVALID,
        success: false,
        details: { reason: 'Invalid API key format' },
      })
      return false
    }

    // Use timing-safe comparison to prevent timing attacks
    const providedHash = Buffer.from(this.hashKey(providedKey), 'hex')
    const configHash = Buffer.from(this.hashKey(config.n8nApiKey), 'hex')

    const isValid = providedHash.length === configHash.length
      && timingSafeEqual(providedHash, configHash)

    securityAudit.logEvent({
      eventType: isValid ? SecurityEventType.API_KEY_VALIDATED : SecurityEventType.API_KEY_INVALID,
      success: isValid,
      details: {
        keyLength: providedKey.length,
        // Don't log the actual key for security
        keyPrefix: `${providedKey.substring(0, 4)}***`,
      },
    })

    return isValid
  }
}

/**
 * Input sanitizer for security
 */
export class InputSanitizer {
  /**
   * Sanitize string input
   */
  sanitizeString(input: string, maxLength = 1000): string {
    // Remove null bytes and other control characters
    // eslint-disable-next-line no-control-regex
    let sanitized = input.replace(/[\u0000-\u001F\u007F]/g, '')

    // Truncate to max length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength)
    }

    // Remove control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\v\f\x0E-\x1F\x7F]/g, '')

    return sanitized
  }

  /**
   * Sanitize object input recursively
   */
  sanitizeObject(obj: unknown, maxDepth = 10): unknown {
    if (maxDepth <= 0) {
      throw new Error('Maximum sanitization depth exceeded')
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj)
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, maxDepth - 1))
    }

    if (obj && typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key, 100)
        sanitized[sanitizedKey] = this.sanitizeObject(value, maxDepth - 1)
      }
      return sanitized
    }

    return obj
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private readonly requests = new Map<string, number[]>()

  constructor(
    private readonly maxRequests: number = 100,
    private readonly windowMs: number = 60000, // 1 minute
  ) {}

  /**
   * Check if request is allowed
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(identifier) ?? []

    // Filter out old requests
    const recentRequests = requests.filter(time => now - time < this.windowMs)

    if (recentRequests.length >= this.maxRequests) {
      securityAudit.logEvent({
        eventType: SecurityEventType.ACCESS_DENIED,
        success: false,
        userId: identifier,
        details: { reason: 'Rate limit exceeded' },
      })
      return false
    }

    // Add current request
    recentRequests.push(now)
    this.requests.set(identifier, recentRequests)

    return true
  }

  /**
   * Reset rate limit for identifier
   */
  reset(identifier: string): void {
    this.requests.delete(identifier)
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.requests.clear()
  }
}

/**
 * Security context for request handling
 */
export interface SecurityContext {
  userId: string
  sessionId: string
  permissions: string[]
  metadata?: Record<string, unknown>
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Create a security context for Claude Code
 */
export function createClaudeContext(): SecurityContext {
  return {
    userId: 'claude-code',
    sessionId: generateSessionId(),
    permissions: ['mcp:tools:*', 'n8n:api:*'],
    metadata: {
      client: 'Claude Code',
      version: process.env.npm_package_version,
    },
  }
}

// Export singleton instances
export { securityAudit }
export const apiKeyValidator = new ApiKeyValidator()
export const inputSanitizer = new InputSanitizer()

// Lazy initialization to avoid config access at module load time
let _rateLimiter: RateLimiter | null = null
export function getRateLimiter(): RateLimiter {
  if (!_rateLimiter) {
    _rateLimiter = new RateLimiter(
      config.maxConcurrentRequests * 10,
      60000, // 1 minute window
    )
  }
  return _rateLimiter
}

/**
 * Security middleware for tool execution
 */
export function validateToolAccess(
  toolName: string,
  context: SecurityContext,
): boolean {
  // Check if user has permission for this tool
  const hasPermission = context.permissions.some(perm =>
    perm === `mcp:tools:${toolName}`
    || perm === 'mcp:tools:*',
  )

  securityAudit.logEvent({
    eventType: hasPermission ? SecurityEventType.TOOL_EXECUTED : SecurityEventType.TOOL_DENIED,
    success: hasPermission,
    userId: context.userId,
    toolName,
  })

  return hasPermission
}

/**
 * Error classification types for centralized error handling
 */
export enum ErrorType {
  // Operational errors - expected and recoverable
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Programmer errors - bugs that should be fixed
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  TYPE_ERROR = 'TYPE_ERROR',
  ASSERTION_ERROR = 'ASSERTION_ERROR',

  // Security errors - potential threats
  MALICIOUS_INPUT = 'MALICIOUS_INPUT',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
}

/**
 * Enhanced error class with classification and context
 */
export class SecurityError extends Error {
  public readonly errorType: ErrorType
  public readonly isOperational: boolean
  public readonly statusCode: number
  public readonly details: Record<string, unknown>
  public readonly timestamp: Date

  constructor(
    message: string,
    errorType: ErrorType,
    statusCode = 500,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'SecurityError'
    this.errorType = errorType
    this.statusCode = statusCode
    this.details = details
    this.timestamp = new Date()

    // Classify error as operational or programmer error
    this.isOperational = [
      ErrorType.NETWORK_ERROR,
      ErrorType.API_RATE_LIMIT,
      ErrorType.AUTHENTICATION_FAILED,
      ErrorType.RESOURCE_NOT_FOUND,
      ErrorType.VALIDATION_FAILED,
      ErrorType.PERMISSION_DENIED,
      ErrorType.MALICIOUS_INPUT,
      ErrorType.BRUTE_FORCE_ATTEMPT,
      ErrorType.SUSPICIOUS_PATTERN,
    ].includes(errorType)
  }
}

/**
 * Centralized error handler with security-aware logging
 */
export class SecurityErrorHandler {
  /**
   * Handle and classify errors
   */
  static handleError(error: unknown, context?: SecurityContext): SecurityError {
    let securityError: SecurityError

    if (error instanceof SecurityError) {
      securityError = error
    }
    else if (error instanceof Error) {
      // Classify unknown errors
      const errorType = this.classifyError(error)
      const statusCode = this.getStatusCode(errorType)

      securityError = new SecurityError(
        error.message,
        errorType,
        statusCode,
        { originalError: error.name, stack: error.stack },
      )
    }
    else {
      // Handle non-Error types
      securityError = new SecurityError(
        'Unknown error occurred',
        ErrorType.ASSERTION_ERROR,
        500,
        { value: error },
      )
    }

    // Log security event
    const eventData: Omit<SecurityEvent, 'timestamp'> = {
      eventType: securityError.isOperational
        ? SecurityEventType.SECURITY_ERROR
        : SecurityEventType.SECURITY_POLICY_VIOLATED,
      success: false,
      details: {
        errorType: securityError.errorType,
        statusCode: securityError.statusCode,
        isOperational: securityError.isOperational,
        message: securityError.message,
        ...securityError.details,
      },
    }

    if (context?.userId) {
      eventData.userId = context.userId
    }

    securityAudit.logEvent(eventData)

    return securityError
  }

  /**
   * Classify error type based on error properties
   */
  private static classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase()

    // Network-related errors
    if (message.includes('network') || message.includes('connection')
      || message.includes('timeout') || error.name === 'NetworkError') {
      return ErrorType.NETWORK_ERROR
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorType.API_RATE_LIMIT
    }

    // Authentication
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return ErrorType.AUTHENTICATION_FAILED
    }

    // Validation
    if (message.includes('validation') || error.name === 'ValidationError'
      || error.name === 'ZodError') {
      return ErrorType.VALIDATION_FAILED
    }

    // Type errors (programmer errors)
    if (error.name === 'TypeError') {
      return ErrorType.TYPE_ERROR
    }

    // Default to assertion error for unknown cases
    return ErrorType.ASSERTION_ERROR
  }

  /**
   * Get appropriate HTTP status code for error type
   */
  private static getStatusCode(errorType: ErrorType): number {
    const statusMap: Record<ErrorType, number> = {
      [ErrorType.NETWORK_ERROR]: 503,
      [ErrorType.API_RATE_LIMIT]: 429,
      [ErrorType.AUTHENTICATION_FAILED]: 401,
      [ErrorType.RESOURCE_NOT_FOUND]: 404,
      [ErrorType.VALIDATION_FAILED]: 400,
      [ErrorType.PERMISSION_DENIED]: 403,
      [ErrorType.INVALID_ARGUMENT]: 400,
      [ErrorType.TYPE_ERROR]: 500,
      [ErrorType.ASSERTION_ERROR]: 500,
      [ErrorType.MALICIOUS_INPUT]: 400,
      [ErrorType.BRUTE_FORCE_ATTEMPT]: 429,
      [ErrorType.SUSPICIOUS_PATTERN]: 403,
    }

    return statusMap[errorType] ?? 500
  }
}

/**
 * Enhanced input validator with security patterns
 */
export class SecureInputValidator {
  private readonly sanitizer = new InputSanitizer()

  /**
   * Validate and sanitize MCP tool arguments
   */
  validateToolArgs<T>(
    args: unknown,
    schema: z.ZodSchema<T>,
    context: SecurityContext,
  ): T {
    try {
      // Pre-sanitize input
      const sanitized = this.sanitizer.sanitizeObject(args)

      // Validate with Zod schema
      const validated = schema.parse(sanitized)

      // Log successful validation
      securityAudit.logEvent({
        eventType: SecurityEventType.ACCESS_GRANTED,
        success: true,
        userId: context.userId,
        details: { argsSize: JSON.stringify(args).length },
      })

      return validated
    }
    catch (error) {
      // Log validation failure
      securityAudit.logEvent({
        eventType: SecurityEventType.INPUT_VALIDATION_FAILED,
        success: false,
        userId: context.userId,
        details: {
          error: error instanceof Error ? error.message : 'Unknown validation error',
          argsType: typeof args,
        },
      })

      throw SecurityErrorHandler.handleError(
        new SecurityError(
          'Input validation failed',
          ErrorType.VALIDATION_FAILED,
          400,
          { originalError: error },
        ),
        context,
      )
    }
  }

  /**
   * Detect potentially malicious input patterns
   */
  detectMaliciousPatterns(input: string): {
    isMalicious: boolean
    patterns: string[]
    riskLevel: 'low' | 'medium' | 'high'
  } {
    const maliciousPatterns = [
      // SQL injection patterns
      /(\bUNION\b.+\bSELECT\b)|(\bOR\b.+=.+)|(\bDROP\b.+\bTABLE\b)/i,

      // XSS patterns
      /<script[^>]*>.*?<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,

      // Command injection
      /[;&|`$(){}]/,
      /\.\.\//,

      // Path traversal
      /\.\.\/|\.\.\\|\.\.%2f|\.\.%5c/i,

      // Suspicious encoding
      /%[0-9a-f]{2}/i,
    ]

    const detectedPatterns: string[] = []

    for (const [index, pattern] of maliciousPatterns.entries()) {
      if (pattern.test(input)) {
        detectedPatterns.push(`pattern_${index + 1}`)
      }
    }

    const isMalicious = detectedPatterns.length > 0
    let riskLevel: 'low' | 'medium' | 'high' = 'low'

    if (detectedPatterns.length >= 3) {
      riskLevel = 'high'
    }
    else if (detectedPatterns.length >= 2) {
      riskLevel = 'medium'
    }
    else if (detectedPatterns.length >= 1) {
      riskLevel = 'low'
    }

    return { isMalicious, patterns: detectedPatterns, riskLevel }
  }

  /**
   * Validate string input with malicious pattern detection
   */
  validateSecureString(
    input: string,
    maxLength = 1000,
    context?: SecurityContext,
  ): string {
    // Check for malicious patterns first
    const maliciousCheck = this.detectMaliciousPatterns(input)

    if (maliciousCheck.isMalicious) {
      const eventData: Omit<SecurityEvent, 'timestamp'> = {
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        success: false,
        details: {
          patterns: maliciousCheck.patterns,
          riskLevel: maliciousCheck.riskLevel,
          inputLength: input.length,
        },
      }

      if (context?.userId) {
        eventData.userId = context.userId
      }

      securityAudit.logEvent(eventData)

      throw new SecurityError(
        'Malicious input pattern detected',
        ErrorType.MALICIOUS_INPUT,
        400,
        { patterns: maliciousCheck.patterns, riskLevel: maliciousCheck.riskLevel },
      )
    }

    // Sanitize and return
    return this.sanitizer.sanitizeString(input, maxLength)
  }
}

/**
 * Initialize security module
 */
export function initializeSecurity(): void {
  logger.info('Security module initialized', {
    auditingEnabled: true,
    rateLimitingEnabled: true,
    inputSanitizationEnabled: true,
    centralizedErrorHandling: true,
    maliciousPatternDetection: true,
  })

  // Log initial security configuration
  securityAudit.logEvent({
    eventType: SecurityEventType.CONFIG_CHANGED,
    success: true,
    details: {
      hasApiKey: Boolean(config.n8nApiKey),
      environment: config.nodeEnv,
      mcpMode: config.mcpMode,
      securityFeatures: [
        'timing-safe-comparison',
        'centralized-error-handling',
        'malicious-pattern-detection',
        'comprehensive-audit-logging',
      ],
    },
  })
}

// Export enhanced security instances
export const secureInputValidator = new SecureInputValidator()
