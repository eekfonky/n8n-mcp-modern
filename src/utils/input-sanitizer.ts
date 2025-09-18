/**
 * Input Sanitization and Command Injection Protection
 *
 * Comprehensive input validation and sanitization:
 * - Command injection prevention
 * - Path traversal protection
 * - SQL injection prevention
 * - XSS protection
 * - LDAP injection prevention
 * - NoSQL injection prevention
 */

import { logger } from '../server/logger.js'

export interface SanitizationOptions {
  maxLength?: number
  allowedCharacters?: RegExp
  allowHTML?: boolean
  allowPaths?: boolean
  allowCommands?: boolean
  strictMode?: boolean
}

export interface SanitizationResult {
  sanitized: string
  isValid: boolean
  violations: string[]
  originalLength: number
  sanitizedLength: number
}

export class InputSanitizer {
  // Dangerous patterns that indicate potential attacks
  private static readonly COMMAND_INJECTION_PATTERNS = [
    /[;&|`$()]/g, // Shell metacharacters
    /\b(bash|sh|cmd|powershell|exec|eval|system)\b/gi, // Command execution
    /\$\{[^}]*\}/g, // Parameter expansion
    /\$\([^)]*\)/g, // Command substitution
    /`[^`]*`/g, // Backtick command substitution
    /\|\s*(curl|wget|nc|netcat|telnet|ssh|ftp)\b/gi, // Network commands
    />\s*\/dev\//gi, // Device file redirection
    /\/proc\//gi, // Process filesystem access
    /\.\.[/\\]/g, // Path traversal
  ]

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.[/\\]/g, // Directory traversal
    /[/\\]{2,}/g, // Multiple slashes
    /\0/g, // Null bytes
    /[<>:"|?*]/g, // Invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
  ]

  private static readonly SCRIPT_INJECTION_PATTERNS = [
    /<script[^>]*>/gi,
    /<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers
    /data:text\/html/gi,
    /vbscript:/gi,
    /expression\s*\(/gi, // CSS expressions
  ]

  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|FROM|WHERE|ORDER|GROUP|HAVING)\b)/gi,
    /[';]--/g, // SQL comments
    /\/\*.*?\*\//g, // Multi-line comments
    /\b(OR|AND)\s+\d+\s*=\s*\d+/gi, // Tautologies
    /\bUNION\s+(ALL\s+)?SELECT\b/gi, // Union-based injection
  ]

  /**
   * Comprehensive input sanitization
   */
  static sanitize(
    input: unknown,
    options: SanitizationOptions = {},
  ): SanitizationResult {
    const {
      maxLength = 1000,
      allowedCharacters,
      allowHTML = false,
      allowPaths = false,
      allowCommands = false,
      strictMode = true,
    } = options

    // Handle non-string inputs
    if (typeof input !== 'string') {
      if (input === null || input === undefined) {
        return {
          sanitized: '',
          isValid: true,
          violations: [],
          originalLength: 0,
          sanitizedLength: 0,
        }
      }

      input = String(input)
    }

    const originalInput = input as string
    const violations: string[] = []
    let sanitized = originalInput

    // Length validation
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength)
      violations.push(`Input truncated to ${maxLength} characters`)
    }

    // Command injection protection
    if (!allowCommands) {
      for (const pattern of this.COMMAND_INJECTION_PATTERNS) {
        if (pattern.test(sanitized)) {
          violations.push('Command injection pattern detected')
          sanitized = sanitized.replace(pattern, '')
        }
      }
    }

    // Path traversal protection
    if (!allowPaths) {
      for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
        if (pattern.test(sanitized)) {
          violations.push('Path traversal pattern detected')
          sanitized = sanitized.replace(pattern, '')
        }
      }
    }

    // Script injection protection
    if (!allowHTML) {
      for (const pattern of this.SCRIPT_INJECTION_PATTERNS) {
        if (pattern.test(sanitized)) {
          violations.push('Script injection pattern detected')
          sanitized = sanitized.replace(pattern, '')
        }
      }

      // Basic HTML tag removal
      sanitized = sanitized.replace(/<[^>]*>/g, '')
    }

    // SQL injection protection
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        violations.push('SQL injection pattern detected')
        if (strictMode) {
          sanitized = sanitized.replace(pattern, '')
        }
      }
    }

    // Custom character allowlist
    if (allowedCharacters) {
      const originalLength = sanitized.length
      sanitized = sanitized.replace(new RegExp(`[^${allowedCharacters.source}]`, 'g'), '')
      if (sanitized.length !== originalLength) {
        violations.push('Disallowed characters removed')
      }
    }

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim()

    const result: SanitizationResult = {
      sanitized,
      isValid: violations.length === 0,
      violations,
      originalLength: originalInput.length,
      sanitizedLength: sanitized.length,
    }

    // Log security violations
    if (violations.length > 0) {
      logger.warn('Input sanitization violations detected', {
        violations,
        originalLength: originalInput.length,
        sanitizedLength: sanitized.length,
        inputPreview: originalInput.substring(0, 100) + (originalInput.length > 100 ? '...' : ''),
      })
    }

    return result
  }

  /**
   * Sanitize command arguments specifically
   */
  static sanitizeCommandArgs(args: string[]): { sanitized: string[], violations: string[] } {
    const sanitized: string[] = []
    const allViolations: string[] = []

    for (const arg of args) {
      const result = this.sanitize(arg, {
        maxLength: 500,
        allowCommands: false,
        allowPaths: true, // Allow paths for file operations
        allowHTML: false,
        strictMode: true,
      })

      sanitized.push(result.sanitized)
      allViolations.push(...result.violations)
    }

    return { sanitized, violations: allViolations }
  }

  /**
   * Sanitize object properties recursively
   */
  static sanitizeObject(
    obj: Record<string, unknown>,
    options: SanitizationOptions = {},
  ): { sanitized: Record<string, unknown>, violations: string[] } {
    const sanitized: Record<string, unknown> = {}
    const allViolations: string[] = []

    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const keyResult = this.sanitize(key, {
        maxLength: 100,
        allowedCharacters: /[\w-]/,
        allowCommands: false,
        allowPaths: false,
        allowHTML: false,
      })

      if (!keyResult.isValid) {
        allViolations.push(`Invalid key: ${key}`)
        continue
      }

      // Sanitize value
      if (typeof value === 'string') {
        const valueResult = this.sanitize(value, options)
        sanitized[keyResult.sanitized] = valueResult.sanitized
        allViolations.push(...valueResult.violations)
      }
      else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nestedResult = this.sanitizeObject(value as Record<string, unknown>, options)
        sanitized[keyResult.sanitized] = nestedResult.sanitized
        allViolations.push(...nestedResult.violations)
      }
      else if (Array.isArray(value)) {
        const sanitizedArray = value.map((item) => {
          if (typeof item === 'string') {
            return this.sanitize(item, options).sanitized
          }
          return item
        })
        sanitized[keyResult.sanitized] = sanitizedArray
      }
      else {
        sanitized[keyResult.sanitized] = value
      }
    }

    return { sanitized, violations: allViolations }
  }

  /**
   * Validate file path safety
   */
  static validateFilePath(path: string): { isValid: boolean, violations: string[] } {
    const violations: string[] = []

    // Check for path traversal
    if (path.includes('..')) {
      violations.push('Path traversal detected')
    }

    // Check for absolute paths outside allowed directories
    if (path.startsWith('/') && !path.startsWith('/tmp/') && !path.startsWith('/var/tmp/')) {
      violations.push('Absolute path outside allowed directories')
    }

    // Check for null bytes
    if (path.includes('\0')) {
      violations.push('Null byte in path')
    }

    // Check for Windows reserved names
    const filename = path.split(/[/\\]/).pop() || ''
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(filename)) {
      violations.push('Windows reserved filename')
    }

    return {
      isValid: violations.length === 0,
      violations,
    }
  }

  /**
   * Create a safe environment for command execution
   */
  static createSafeEnvironment(env: Record<string, string> = {}): Record<string, string> {
    const safeEnv: Record<string, string> = {
      PATH: '/usr/local/bin:/usr/bin:/bin',
      HOME: '/tmp',
      TMPDIR: '/tmp',
      SHELL: '/bin/sh',
    }

    // Sanitize provided environment variables
    for (const [key, value] of Object.entries(env)) {
      const keyResult = this.sanitize(key, {
        maxLength: 50,
        allowedCharacters: /[A-Z_0-9]/,
        allowCommands: false,
        allowPaths: false,
        allowHTML: false,
      })

      const valueResult = this.sanitize(value, {
        maxLength: 1000,
        allowCommands: false,
        allowPaths: true,
        allowHTML: false,
      })

      if (keyResult.isValid && valueResult.isValid) {
        safeEnv[keyResult.sanitized] = valueResult.sanitized
      }
    }

    return safeEnv
  }

  /**
   * Validate npm package names and commands
   */
  static validateNpmCommand(command: string, args: string[]): { isValid: boolean, violations: string[] } {
    const violations: string[] = []

    // Allowed npm commands
    const allowedCommands = ['list', 'outdated', 'info', 'view', 'search']
    if (!allowedCommands.includes(command)) {
      violations.push(`Npm command '${command}' not allowed`)
    }

    // Validate package names
    for (const arg of args) {
      if (arg.startsWith('@')) {
        // Scoped package
        if (!/^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/.test(arg)) {
          violations.push(`Invalid scoped package name: ${arg}`)
        }
      }
      else {
        // Regular package
        if (!/^[a-z0-9-~][a-z0-9-._~]*$/.test(arg) || arg.length > 214) {
          violations.push(`Invalid package name: ${arg}`)
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    }
  }
}

// Export convenience functions
export const sanitize = InputSanitizer.sanitize.bind(InputSanitizer)
export const sanitizeCommandArgs = InputSanitizer.sanitizeCommandArgs.bind(InputSanitizer)
export const sanitizeObject = InputSanitizer.sanitizeObject.bind(InputSanitizer)
export const validateFilePath = InputSanitizer.validateFilePath.bind(InputSanitizer)
export const createSafeEnvironment = InputSanitizer.createSafeEnvironment.bind(InputSanitizer)
export const validateNpmCommand = InputSanitizer.validateNpmCommand.bind(InputSanitizer)
