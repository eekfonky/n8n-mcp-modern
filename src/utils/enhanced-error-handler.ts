/**
 * Enhanced Error Handler for MCP Tools
 * Provides contextual, user-friendly error handling with actionable guidance
 */

import type { ErrorCategory, ErrorSeverity } from '../types/enhanced-errors.js'
import { logger } from '../server/logger.js'
import {
  EnhancedN8NMcpError,

  ErrorMessageTemplates,

} from '../types/enhanced-errors.js'

/**
 * Enhanced error handler for MCP tool operations
 */
export class EnhancedErrorHandler {
  /**
   * Handle and transform errors into user-friendly responses
   */
  static handleToolError(
    error: unknown,
    context: {
      toolName: string
      operation: string
      args?: Record<string, unknown>
      apiUrl?: string
    },
    includeDetailedHelp = false,
  ): Record<string, unknown> {
    logger.error(`Enhanced error handling for ${context.toolName}:`, {
      operation: context.operation,
      error: error instanceof Error ? error.message : String(error),
      args: context.args,
    })

    // If it's already an enhanced error, return it
    if (error instanceof EnhancedN8NMcpError) {
      return error.toUserFriendlyResponse(includeDetailedHelp)
    }

    // Transform common error patterns into enhanced errors
    const enhancedError = this.transformError(error, context)
    return enhancedError.toUserFriendlyResponse(includeDetailedHelp)
  }

  /**
   * Transform common errors into enhanced user-friendly errors
   */
  private static transformError(
    error: unknown,
    context: {
      toolName: string
      operation: string
      args?: Record<string, unknown>
      apiUrl?: string
    },
  ): EnhancedN8NMcpError {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const operationContext = `${context.toolName}: ${context.operation}`

    // Configuration errors
    if (this.isConfigurationError(errorMessage)) {
      if (errorMessage.includes('N8N_API_URL') || errorMessage.includes('not configured')) {
        return new EnhancedN8NMcpError(
          ErrorMessageTemplates.configuration.missingApiUrl(operationContext),
        )
      }

      if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
        return new EnhancedN8NMcpError(
          ErrorMessageTemplates.configuration.invalidApiKey(operationContext),
        )
      }
    }

    // Connectivity errors
    if (this.isConnectivityError(errorMessage)) {
      if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
        const timeoutMatch = errorMessage.match(/(\d+)ms/)
        const timeoutMs = timeoutMatch?.[1] ? Number.parseInt(timeoutMatch[1]) : undefined
        return new EnhancedN8NMcpError(
          ErrorMessageTemplates.connectivity.timeout(operationContext, timeoutMs),
        )
      }

      return new EnhancedN8NMcpError(
        ErrorMessageTemplates.connectivity.cannotConnect(operationContext, context.apiUrl),
      )
    }

    // Validation errors
    if (this.isValidationError(errorMessage)) {
      // Check for specific validation patterns
      const missingFieldMatch = errorMessage.match(/required[^'"]*['"]([^'"]+)['"]|['"]([^'"]+)['"][^'"]*required/i)
      if (missingFieldMatch) {
        const field = missingFieldMatch[1] || missingFieldMatch[2]
        if (field) {
          return new EnhancedN8NMcpError(
            ErrorMessageTemplates.validation.missingRequiredField(operationContext, field),
          )
        }
      }

      const invalidFormatMatch = errorMessage.match(/invalid[^'"]*['"]([^'"]+)['"]|['"]([^'"]+)['"][^'"]*invalid/i)
      if (invalidFormatMatch) {
        const field = invalidFormatMatch[1] || invalidFormatMatch[2]
        if (field) {
          return new EnhancedN8NMcpError(
            ErrorMessageTemplates.validation.invalidInput(
              operationContext,
              field,
              'check tool documentation for expected format',
            ),
          )
        }
      }
    }

    // Feature unavailable (no n8n API configured)
    if (this.isFeatureUnavailableError(errorMessage)) {
      return new EnhancedN8NMcpError(
        ErrorMessageTemplates.featureUnavailable.requiresApiConfig(operationContext, context.toolName),
      )
    }

    // Default enhanced error for unknown cases
    return this.createDefaultEnhancedError(error, operationContext)
  }

  /**
   * Create a default enhanced error for unrecognized error patterns
   */
  private static createDefaultEnhancedError(error: unknown, context: string): EnhancedN8NMcpError {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Determine category based on error characteristics
    let category: ErrorCategory = 'server_error'
    let severity: ErrorSeverity = 'error'

    if (errorMessage.toLowerCase().includes('network')
      || errorMessage.toLowerCase().includes('connection')) {
      category = 'connectivity'
    }
    else if (errorMessage.toLowerCase().includes('validation')
      || errorMessage.toLowerCase().includes('invalid')) {
      category = 'validation'
      severity = 'warning'
    }
    else if (errorMessage.toLowerCase().includes('not found')) {
      category = 'not_found'
      severity = 'warning'
    }

    return new EnhancedN8NMcpError({
      message: `Operation failed: ${errorMessage}`,
      category,
      severity,
      context,
      troubleshooting: [
        {
          action: 'Check the error details',
          description: 'Review the technical details below for more information',
          expectedResult: 'Better understanding of the root cause',
        },
        {
          action: 'Verify your configuration',
          description: 'Run configuration validation to ensure proper setup',
          command: 'mcp-tool validate_mcp_config',
          expectedResult: 'Configuration should show as healthy',
        },
        {
          action: 'Check system health',
          description: 'Run system health check to identify any issues',
          command: 'mcp-tool get_system_health',
          expectedResult: 'System health should show no critical issues',
        },
      ],
      quickFixes: [
        'Try the operation again - some errors are temporary',
        'Check your n8n instance is running and accessible',
        'Verify all required parameters are provided',
      ],
      recoverySuggestions: [
        'Use \'validate_mcp_config\' for configuration issues',
        'Use \'get_system_health\' for connectivity diagnostics',
        'Check the tool documentation for parameter requirements',
      ],
      technicalDetails: {
        originalError: errorMessage,
        operationId: `${context}_${Date.now()}`,
      },
    })
  }

  /**
   * Check if error is related to configuration issues
   */
  private static isConfigurationError(errorMessage: string): boolean {
    const configKeywords = [
      'not configured',
      'N8N_API_URL',
      'N8N_API_KEY',
      'environment variable',
      'API key',
      'authentication',
      'unauthorized',
      '401',
      'credentials',
    ]

    return configKeywords.some(keyword =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase()),
    )
  }

  /**
   * Check if error is related to connectivity issues
   */
  private static isConnectivityError(errorMessage: string): boolean {
    const connectivityKeywords = [
      'connection',
      'network',
      'timeout',
      'unreachable',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'connect',
      'fetch failed',
      'socket',
    ]

    return connectivityKeywords.some(keyword =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase()),
    )
  }

  /**
   * Check if error is related to validation issues
   */
  private static isValidationError(errorMessage: string): boolean {
    const validationKeywords = [
      'validation',
      'invalid',
      'required',
      'missing',
      'expected',
      'format',
      'type',
      'schema',
      'parameter',
    ]

    return validationKeywords.some(keyword =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase()),
    )
  }

  /**
   * Check if error indicates feature is unavailable due to missing n8n API
   */
  private static isFeatureUnavailableError(errorMessage: string): boolean {
    const unavailableKeywords = [
      'requires n8n API',
      'n8n API not available',
      'offline mode',
      'feature unavailable',
      'API not configured',
    ]

    return unavailableKeywords.some(keyword =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase()),
    )
  }

  /**
   * Create a user-friendly error for missing n8n API configuration
   */
  static createApiNotConfiguredError(toolName: string): EnhancedN8NMcpError {
    return new EnhancedN8NMcpError(
      ErrorMessageTemplates.featureUnavailable.requiresApiConfig(
        `${toolName} execution`,
        toolName,
      ),
    )
  }

  /**
   * Create a user-friendly error for validation failures
   */
  static createValidationError(
    toolName: string,
    field: string,
    expectedFormat: string,
  ): EnhancedN8NMcpError {
    return new EnhancedN8NMcpError(
      ErrorMessageTemplates.validation.invalidInput(
        `${toolName} parameter validation`,
        field,
        expectedFormat,
      ),
    )
  }

  /**
   * Handle timeout errors with specific guidance
   */
  static createTimeoutError(toolName: string, timeoutMs: number): EnhancedN8NMcpError {
    return new EnhancedN8NMcpError(
      ErrorMessageTemplates.connectivity.timeout(
        `${toolName} execution`,
        timeoutMs,
      ),
    )
  }

  /**
   * Progressive error detail - basic vs. detailed help
   */
  static getProgressiveError(
    error: unknown,
    context: {
      toolName: string
      operation: string
      args?: Record<string, unknown>
      apiUrl?: string
    },
    userRequestedDetails = false,
  ): Record<string, unknown> {
    const basicResponse = this.handleToolError(error, context, false)

    if (!userRequestedDetails) {
      return {
        ...basicResponse,
        helpHint: 'Add \'includeDetails: true\' to your request for detailed troubleshooting information',
      }
    }

    return this.handleToolError(error, context, true)
  }
}

/**
 * Utility functions for error handling in MCP tools
 */
export const ErrorUtils = {
  /**
   * Wrap MCP tool execution with enhanced error handling
   */
  async withEnhancedErrorHandling<T>(
    operation: () => Promise<T>,
    context: {
      toolName: string
      operation: string
      args?: Record<string, unknown>
      apiUrl?: string
    },
    includeDetailedHelp = false,
  ): Promise<T> {
    try {
      return await operation()
    }
    catch (error) {
      const enhancedResponse = EnhancedErrorHandler.handleToolError(
        error,
        context,
        includeDetailedHelp,
      )

      // Log the enhanced error details
      logger.info('Enhanced error response generated:', {
        toolName: context.toolName,
        category: enhancedResponse.category,
        severity: enhancedResponse.severity,
      })

      // Return error response without creating new stack trace
      // Use the original error structure that's already sanitized
      if (error instanceof Error) {
        // Preserve original error type but sanitize the message
        const sanitizedError = new Error(JSON.stringify(enhancedResponse))
        sanitizedError.name = error.name
        // Remove stack trace completely for security
        delete sanitizedError.stack
        throw sanitizedError
      }
      else {
        // For non-Error objects, create a clean error
        const cleanError = new Error(JSON.stringify(enhancedResponse))
        delete cleanError.stack
        throw cleanError
      }
    }
  },

  /**
   * Check if n8n API is available and throw user-friendly error if not
   */
  requiresN8NApi(client: unknown, toolName: string): void {
    if (!client) {
      throw EnhancedErrorHandler.createApiNotConfiguredError(toolName)
    }
  },
}
