/**
 * Enhanced Error Handling System for Epic 2
 * Provides user-friendly error messages with actionable guidance
 */

import { N8NMcpError } from './index.js'

/**
 * Error categories for better user experience
 */
export type ErrorCategory
  = | 'configuration' // Missing or invalid config (N8N_API_URL, N8N_API_KEY)
    | 'connectivity' // Network/connection issues to n8n instance
    | 'authentication' // API key or permission issues
    | 'validation' // Invalid user input or parameters
    | 'api_error' // n8n API returned an error
    | 'timeout' // Operation took too long
    | 'not_found' // Resource doesn't exist (workflow, execution, etc.)
    | 'server_error' // Internal server/system errors
    | 'feature_unavailable' // Feature requires n8n API but not configured

/**
 * Error severity levels for appropriate user messaging
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical'

/**
 * Troubleshooting step with action and expected outcome
 */
export interface TroubleshootingStep {
  action: string
  description: string
  command?: string
  expectedResult?: string
}

/**
 * Enhanced error details for comprehensive user guidance
 */
export interface EnhancedErrorDetails {
  /** User-friendly error message */
  message: string
  /** Error category for appropriate handling */
  category: ErrorCategory
  /** Error severity level */
  severity: ErrorSeverity
  /** What the user was trying to do */
  context: string
  /** Step-by-step troubleshooting guidance */
  troubleshooting: TroubleshootingStep[]
  /** Quick fixes or workarounds */
  quickFixes?: string[]
  /** Recovery suggestions */
  recoverySuggestions?: string[]
  /** Relevant documentation or help links */
  helpLinks?: string[]
  /** Technical details (optional, for advanced users) */
  technicalDetails?: {
    originalError?: string
    endpoint?: string
    statusCode?: number
    operationId?: string
  }
}

/**
 * Enhanced n8n MCP Error with user-friendly messaging and guidance
 */
export class EnhancedN8NMcpError extends N8NMcpError {
  public readonly category: ErrorCategory
  public readonly severity: ErrorSeverity
  public readonly context: string
  public readonly troubleshooting: TroubleshootingStep[]
  public readonly quickFixes: string[] | undefined
  public readonly recoverySuggestions: string[] | undefined
  public readonly helpLinks: string[] | undefined

  constructor(details: EnhancedErrorDetails) {
    // Call parent constructor with user-friendly message
    super(
      details.message,
      `ENHANCED_${details.category.toUpperCase()}`,
      details.technicalDetails?.statusCode || 400,
      {
        category: details.category,
        severity: details.severity,
        context: details.context,
        ...details.technicalDetails,
      },
    )

    this.category = details.category
    this.severity = details.severity
    this.context = details.context
    this.troubleshooting = details.troubleshooting
    this.quickFixes = details.quickFixes
    this.recoverySuggestions = details.recoverySuggestions
    this.helpLinks = details.helpLinks
  }

  /**
   * Get user-friendly error response for MCP tools
   */
  public toUserFriendlyResponse(includeDetailedHelp = false): Record<string, unknown> {
    const response = {
      success: false,
      error: this.message,
      category: this.category,
      severity: this.severity,
      context: this.context,
      help: {
        troubleshooting: this.troubleshooting,
        quickFixes: this.quickFixes || [],
        recoverySuggestions: this.recoverySuggestions || [],
      },
    }

    if (includeDetailedHelp) {
      return {
        ...response,
        detailedHelp: {
          helpLinks: this.helpLinks || [],
          technicalDetails: this.details,
          supportInfo: 'For additional help, visit: https://github.com/anthropics/claude-code/issues',
        },
      }
    }

    return response
  }
}

/**
 * Error message templates for common scenarios
 */
export class ErrorMessageTemplates {
  /**
   * Configuration errors - missing or invalid setup
   */
  static configuration = {
    missingApiUrl: (context: string): EnhancedErrorDetails => ({
      message: 'n8n API connection not configured',
      category: 'configuration',
      severity: 'error',
      context,
      troubleshooting: [
        {
          action: 'Set your n8n API URL',
          description: 'Configure the N8N_API_URL environment variable',
          command: 'export N8N_API_URL=https://your-n8n-instance.com',
          expectedResult: 'Should point to your running n8n instance',
        },
        {
          action: 'Set your n8n API key',
          description: 'Configure the N8N_API_KEY environment variable',
          command: 'export N8N_API_KEY=your-api-key',
          expectedResult: 'Use an API key with workflow management permissions',
        },
        {
          action: 'Verify configuration',
          description: 'Test your configuration setup',
          command: 'mcp-tool validate_mcp_config',
          expectedResult: 'Should show \'healthy\' status with no issues',
        },
      ],
      quickFixes: [
        'Run \'validate_mcp_config\' for guided setup',
        'Check that n8n is running and accessible',
        'Verify API key has proper permissions',
      ],
      recoverySuggestions: [
        'Use offline mode for testing without n8n API',
        'Check n8n documentation for API key setup',
      ],
      helpLinks: [
        'n8n API Documentation: https://docs.n8n.io/api/',
        'Claude Code MCP Setup: https://docs.anthropic.com/claude-code/',
      ],
    }),

    invalidApiKey: (context: string): EnhancedErrorDetails => ({
      message: 'n8n API key authentication failed',
      category: 'authentication',
      severity: 'error',
      context,
      troubleshooting: [
        {
          action: 'Check API key validity',
          description: 'Verify your API key is correct and active',
          command: 'curl -H \'Authorization: Bearer YOUR_KEY\' YOUR_N8N_URL/api/v1/workflows',
          expectedResult: 'Should return workflow data or permissions error',
        },
        {
          action: 'Verify API key permissions',
          description: 'Ensure the API key has workflow management permissions',
          expectedResult: 'Key should have read/write access to workflows',
        },
        {
          action: 'Generate new API key',
          description: 'Create a new API key in n8n settings if the current one is invalid',
          expectedResult: 'Fresh API key with appropriate permissions',
        },
      ],
      quickFixes: [
        'Double-check your N8N_API_KEY environment variable',
        'Test API key with a simple curl command',
        'Generate a new API key in n8n settings',
      ],
      recoverySuggestions: [
        'Use \'validate_mcp_config\' to test API connectivity',
        'Check n8n logs for authentication errors',
      ],
    }),
  }

  /**
   * Connectivity errors - network/connection issues
   */
  static connectivity = {
    cannotConnect: (context: string, apiUrl?: string): EnhancedErrorDetails => ({
      message: `Cannot connect to n8n instance${apiUrl ? ` at ${apiUrl}` : ''}`,
      category: 'connectivity',
      severity: 'error',
      context,
      troubleshooting: [
        {
          action: 'Check n8n instance status',
          description: 'Verify your n8n instance is running and accessible',
          command: apiUrl ? `curl -I ${apiUrl}` : 'curl -I $N8N_API_URL',
          expectedResult: 'Should return HTTP response headers',
        },
        {
          action: 'Verify URL format',
          description: 'Ensure N8N_API_URL is correct and includes protocol',
          expectedResult: 'URL should be like: https://your-n8n-instance.com',
        },
        {
          action: 'Test network connectivity',
          description: 'Check if the n8n instance is reachable from your network',
          command: apiUrl ? `ping ${new URL(apiUrl).hostname}` : 'ping your-n8n-host',
          expectedResult: 'Should receive ping responses',
        },
      ],
      quickFixes: [
        'Ensure n8n instance is running and accessible',
        'Check firewall settings and network connectivity',
        'Verify N8N_API_URL format and protocol (https://)',
      ],
      recoverySuggestions: [
        'Try connecting from a different network',
        'Check n8n instance logs for connection errors',
        'Use \'get_system_health\' for detailed connectivity diagnostics',
      ],
    }),

    timeout: (context: string, timeoutMs?: number): EnhancedErrorDetails => ({
      message: `Connection to n8n instance timed out${timeoutMs ? ` after ${timeoutMs}ms` : ''}`,
      category: 'timeout',
      severity: 'warning',
      context,
      troubleshooting: [
        {
          action: 'Check n8n instance performance',
          description: 'Verify n8n instance is responding normally',
          command: 'mcp-tool get_system_health',
          expectedResult: 'Should show system health and response times',
        },
        {
          action: 'Check network latency',
          description: 'Test network connection speed to n8n instance',
          expectedResult: 'Low latency indicates good connectivity',
        },
        {
          action: 'Retry the operation',
          description: 'Temporary network issues may resolve automatically',
          expectedResult: 'Operation may succeed on retry',
        },
      ],
      quickFixes: [
        'Retry the operation - timeouts are often temporary',
        'Check n8n instance system resources and performance',
        'Verify network stability and latency',
      ],
      recoverySuggestions: [
        'Use cached data if available',
        'Try again in a few moments',
        'Check n8n instance system resources',
      ],
    }),
  }

  /**
   * Validation errors - invalid user input
   */
  static validation = {
    invalidInput: (context: string, field: string, expectedFormat: string): EnhancedErrorDetails => ({
      message: `Invalid ${field}: expected ${expectedFormat}`,
      category: 'validation',
      severity: 'warning',
      context,
      troubleshooting: [
        {
          action: `Correct ${field} format`,
          description: `Provide ${field} in the expected format: ${expectedFormat}`,
          expectedResult: `Valid ${field} that meets the format requirements`,
        },
        {
          action: 'Check input parameters',
          description: 'Review all input parameters for correct format and values',
          expectedResult: 'All parameters should match expected types and formats',
        },
      ],
      quickFixes: [
        `Ensure ${field} matches expected format: ${expectedFormat}`,
        'Check for typos in parameter names and values',
        'Refer to tool documentation for parameter examples',
      ],
      recoverySuggestions: [
        'Use \'list_available_tools\' to see parameter requirements',
        'Check similar successful operations for reference',
      ],
    }),

    missingRequiredField: (context: string, field: string): EnhancedErrorDetails => ({
      message: `Required field '${field}' is missing`,
      category: 'validation',
      severity: 'warning',
      context,
      troubleshooting: [
        {
          action: `Provide ${field}`,
          description: `The ${field} parameter is required for this operation`,
          expectedResult: `Operation should proceed with valid ${field}`,
        },
      ],
      quickFixes: [
        `Add the required ${field} parameter`,
        'Check tool documentation for required parameters',
      ],
    }),
  }

  /**
   * Feature unavailable - requires n8n API but not configured
   */
  static featureUnavailable = {
    requiresApiConfig: (context: string, toolName: string): EnhancedErrorDetails => ({
      message: `${toolName} requires n8n API configuration`,
      category: 'feature_unavailable',
      severity: 'info',
      context,
      troubleshooting: [
        {
          action: 'Configure n8n API connection',
          description: 'Set up N8N_API_URL and N8N_API_KEY to enable this feature',
          command: 'mcp-tool validate_mcp_config',
          expectedResult: 'Configuration validation should guide you through setup',
        },
        {
          action: 'Verify n8n instance accessibility',
          description: 'Ensure your n8n instance is running and accessible',
          expectedResult: 'n8n instance should be reachable and responding',
        },
      ],
      quickFixes: [
        'Configure N8N_API_URL and N8N_API_KEY environment variables',
        'Run \'validate_mcp_config\' for guided setup',
        'Use \'get_system_health\' to check configuration status',
      ],
      recoverySuggestions: [
        'Explore other tools that work without n8n API',
        'Use mock data for testing and development',
      ],
      helpLinks: [
        'n8n API Setup Guide: https://docs.n8n.io/api/',
        'Environment Configuration: https://docs.anthropic.com/claude-code/',
      ],
    }),
  }
}
