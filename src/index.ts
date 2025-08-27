#!/usr/bin/env node
/**
 * n8n-MCP Modern - Main Entry Point
 * Modern n8n MCP server built with official TypeScript SDK
 */

// Handle install command BEFORE importing API modules to avoid warnings
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { initializeAgentIntegration } from './agent-integration.js'
import { AgentContextBuilder, agentRouter } from './agents/index.js'
import { database } from './database/index.js'
import { n8nApi } from './n8n/api.js'
import { config } from './server/config.js'
import { EnhancedErrorHandler, EnhancedMcpError, ErrorCategory, ErrorSeverity, executeToolWithErrorHandling, executeWithErrorHandling } from './server/enhanced-error-handler.js'
import { featureFlags, isSimplifiedPipelineEnabled } from './server/feature-flags.js'
import { logger } from './server/logger.js'
import { initializeResilience } from './server/resilience.js'
import {
  createClaudeContext,
  initializeSecurity,
  inputSanitizer,
  securityAudit,
  SecurityEventType,
  validateToolAccess,
} from './server/security.js'
import { createSimpleNodeContext, SimplifiedNodeRecommender } from './server/simplified-node-data.js'
import { initializeAgentTools } from './tools/agent-tool-handler.js'
import { getDynamicToolDescription } from './tools/dynamic-integration.js'
import { dynamicToolRegistry } from './tools/dynamic-tool-registry.js'
import { N8NMCPTools } from './tools/index.js'
import { DynamicToolEnhancer, toolRegistry } from './tools/token-optimized-tools.js'
import { N8NConnectionsSchema, N8NWorkflowNodeSchema } from './types/index.js'
import { initializeAggressiveCleanup } from './utils/aggressive-memory-cleanup.js'
import { httpClient } from './utils/enhanced-http-client.js'
import { memoryManager } from './utils/memory-manager.js'
import {
  nodeAsyncUtils,
  performanceMonitor,
  resourceMonitor,
  runWithContext,
} from './utils/node22-features.js'

const args = process.argv.slice(2)

if (args.includes('install')) {
  // Run the smart installer
  const __dirname = dirname(fileURLToPath(import.meta.url))

  // Try multiple paths to find the script
  const possiblePaths = [
    join(__dirname, '..', '..', 'scripts', 'install-mcp.js'), // From dist/index.js
    join(__dirname, '..', 'scripts', 'install-mcp.js'), // From src/index.js
    join(process.cwd(), 'scripts', 'install-mcp.js'), // From package root
  ]

  const scriptPath = possiblePaths.find(p => existsSync(p))

  if (!scriptPath) {
    process.stderr.write('Error: Could not find install script\n')
    process.stderr.write('Please ensure the package is properly installed\n')
    process.exit(1)
  }

  const installer = spawn('node', [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  })

  installer.on('close', (code) => {
    process.exit(code ?? 0)
  })

  // Exit early - don't load the MCP server
  process.exit(0)
}

/**
 * Get package version dynamically from package.json
 */
function getPackageVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const packageJsonPath = join(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    return packageJson.version
  }
  catch {
    // Fallback version if package.json can't be read
    return '4.7.4'
  }
}

// Cache the version at startup
const PACKAGE_VERSION = getPackageVersion()

// Dynamic tool counting - will be set after tools are registered
let registeredToolCount = 0

/**
 * Get the current count of registered MCP tools
 */
export function getRegisteredToolCount(): number {
  return registeredToolCount
}

/**
 * Main MCP Server Implementation
 */
class N8NMcpServer {
  private server: McpServer
  // Note: McpServer.tool() doesn't exist - tools are registered, not returned
  // Removed incorrect dynamicTools Map

  constructor() {
    // Initialize MCP server with notification debouncing optimization
    this.server = new McpServer({
      name: '@eekfonky/n8n-mcp-modern',
      version: PACKAGE_VERSION,
    }, {
      // Enable notification debouncing for high-frequency updates
      // This coalesces rapid calls into single messages, reducing network traffic
      debouncedNotificationMethods: [
        'notifications/tools/list_changed',
        'notifications/resources/list_changed',
        'notifications/prompts/list_changed',
      ],
    })

    logger.debug('Starting MCP server initialization...')
    this.setupToolsSync()
    this.setupResources()
    this.setupErrorHandlers()
    this.configureDynamicTools()
    this.initializeTokenOptimization()
    logger.debug('MCP server initialization complete')
  }

  private setupToolsSync(): void {
    logger.info('Setting up n8n MCP tools...')

    // Register ALL tools dynamically - NO static registration
    this.registerDynamicTools().catch((error) => {
      logger.error('Failed to register dynamic tools:', error)
    })

    logger.info('Registered MCP tools with agent routing system')
  }

  /**
   * Setup MCP resources for contextual information
   */
  private setupResources(): void {
    logger.info('Setting up n8n MCP resources...')

    // Static workflow template resource
    this.server.registerResource(
      'workflow-templates',
      'n8n://templates/workflows',
      {
        title: 'n8n Workflow Templates',
        description: 'Common workflow patterns and templates for n8n',
        mimeType: 'application/json',
      },
      async (uri) => {
        const templates = [
          {
            name: 'Basic HTTP API Integration',
            description: 'Simple workflow to fetch data from an API',
            nodes: [
              { type: 'Manual Trigger', description: 'Start workflow manually' },
              { type: 'HTTP Request', description: 'Fetch data from external API' },
              { type: 'Set', description: 'Transform and set output data' },
            ],
          },
          {
            name: 'Data Processing Pipeline',
            description: 'Process and transform data with multiple steps',
            nodes: [
              { type: 'Webhook', description: 'Receive data via webhook' },
              { type: 'Code', description: 'Custom JavaScript processing' },
              { type: 'Switch', description: 'Conditional routing' },
              { type: 'Set', description: 'Final data transformation' },
            ],
          },
          {
            name: 'Scheduled Data Sync',
            description: 'Automatically sync data between systems',
            nodes: [
              { type: 'Schedule Trigger', description: 'Run on schedule' },
              { type: 'HTTP Request', description: 'Fetch source data' },
              { type: 'Code', description: 'Transform data format' },
              { type: 'HTTP Request', description: 'Send to destination' },
            ],
          },
        ]

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(templates, null, 2),
          }],
        }
      },
    )

    // Configuration guide resource
    this.server.registerResource(
      'config-guide',
      'n8n://guides/configuration',
      {
        title: 'n8n Configuration Guide',
        description: 'Best practices for configuring n8n workflows',
        mimeType: 'text/markdown',
      },
      async (uri) => {
        const guide = `# n8n Configuration Best Practices

## Workflow Design
- Keep workflows simple and focused on a single purpose
- Use meaningful names for nodes and workflows
- Add notes to complex logic for future reference
- Implement proper error handling with Error Trigger nodes

## Performance Tips
- Limit data processed per execution to avoid memory issues
- Use pagination for large datasets (>1000 items)
- Optimize HTTP requests with connection reuse
- Consider workflow splitting for complex processes

## Security Guidelines
- Never hardcode credentials in workflows
- Use environment variables for sensitive data
- Implement proper access controls with webhook authentication
- Regular credential rotation and monitoring

## Common Patterns
1. **API Integration**: Manual Trigger → HTTP Request → Set → Response
2. **Data Pipeline**: Schedule → Extract (HTTP) → Transform (Code) → Load (HTTP)
3. **Notification System**: Webhook → Switch → Multiple notification channels
4. **Error Handling**: Any Node → Error Trigger → Notification → Set

## MCP Integration Tips
- Use the n8n MCP tools to automate workflow management
- Leverage Claude's understanding of your workflow patterns
- Combine manual workflow design with AI-assisted optimization`

        return {
          contents: [{
            uri: uri.href,
            text: guide,
          }],
        }
      },
    )

    // MCP server status resource
    this.server.registerResource(
      'mcp-status',
      'n8n://mcp/status',
      {
        title: 'MCP Server Status',
        description: 'Current status and capabilities of the n8n MCP server',
        mimeType: 'application/json',
      },
      async (uri) => {
        const status = {
          server: 'n8n-MCP Modern',
          version: PACKAGE_VERSION,
          toolCount: registeredToolCount,
          apiConnected: Boolean(config.n8nApiUrl && config.n8nApiKey),
          capabilities: {
            workflowManagement: Boolean(config.n8nApiUrl && config.n8nApiKey),
            nodeRecommendations: true,
            templateGeneration: true,
            systemHealth: true,
          },
          configuration: {
            n8nApiUrl: config.n8nApiUrl ? 'configured' : 'not configured',
            logLevel: config.logLevel,
            cacheEnabled: config.enableCache,
          },
        }

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(status, null, 2),
          }],
        }
      },
    )

    logger.info('n8n MCP resources registered successfully')
  }

  /**
   * Register all MCP tools dynamically using discovery system
   */
  private async registerDynamicTools(): Promise<void> {
    try {
      // Initialize dynamic tool discovery
      await dynamicToolRegistry.initialize()

      // Get all discovered tools
      const discoveredTools = dynamicToolRegistry.getAllTools()

      logger.info(`🚀 Registering ${discoveredTools.length} dynamically discovered tools`)

      // Register ALL discovered tools - no static conflicts anymore
      for (const toolDef of discoveredTools) {
        registeredToolCount++

        this.server.registerTool(
          toolDef.name,
          {
            title: toolDef.title,
            description: toolDef.description,
            inputSchema: toolDef.inputSchema,
          },
          async (args: Record<string, unknown>) => {
            try {
              logger.debug(`🔧 Dynamic tool called: ${toolDef.name}`, { args })

              // Execute tool handler
              const result = await toolDef.handler(args)
              logger.debug(`✅ Dynamic tool completed: ${toolDef.name}`)

              // Ensure proper MCP response format
              if (result && typeof result === 'object' && 'content' in result) {
                return result
              }

              // Convert to MCP format if not already formatted
              return {
                content: [{
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                }],
              }
            }
            catch (error) {
              logger.error(`❌ Dynamic tool failed: ${toolDef.name}`, error)
              return {
                content: [{
                  type: 'text' as const,
                  text: `Error executing ${toolDef.name}: ${error instanceof Error ? error.message : String(error)}`,
                }],
                isError: true,
              }
            }
          },
        )
      }

      // Get comprehensive statistics
      const stats = dynamicToolRegistry.getStatistics()
      logger.info('📊 Dynamic tool registration complete:', {
        totalDiscovered: stats.totalTools,
        allToolsRegistered: discoveredTools.length,
        categories: (stats.categories as string[]).length,
        memoryOptimized: stats.memoryOptimizedTools,
        highPriority: stats.highPriorityTools,
      })
    }
    catch (error) {
      logger.error('Failed to register dynamic tools:', error)
      logger.info('Falling back to minimal tool set')
    }
  }

  /**
   * Legacy method - now replaced by dynamic registration
   */
  private registerN8NToolsBatch(): void {
    // Define tool configurations in a batch for better performance
    const staticToolConfigs = [
      {
        name: 'search_n8n_nodes',
        title: 'Search n8n Nodes',
        description: 'Search for available n8n nodes by name, description, or category',
        inputSchema: {
          query: z.string().describe('Search term for n8n nodes'),
          category: z.string().optional().describe('Filter by node category'),
        },
      },
      {
        name: 'get_n8n_workflow',
        title: 'Get n8n Workflow',
        description: 'Get a specific workflow by ID',
        inputSchema: {
          id: z.string().describe('Workflow ID'),
        },
      },
      {
        name: 'activate_n8n_workflow',
        title: 'Activate n8n Workflow',
        description: 'Activate a workflow in n8n',
        inputSchema: {
          id: z.string().describe('Workflow ID to activate'),
        },
      },
      {
        name: 'deactivate_n8n_workflow',
        title: 'Deactivate n8n Workflow',
        description: 'Deactivate a workflow in n8n',
        inputSchema: {
          id: z.string().describe('Workflow ID to deactivate'),
        },
      },
      {
        name: 'get_n8n_executions',
        title: 'Get n8n Executions',
        description: 'Get workflow execution history',
        inputSchema: {
          workflowId: z.string().optional().describe('Filter by workflow ID'),
          limit: z.number().optional().default(10).describe('Maximum number of executions'),
        },
      },
      {
        name: 'get_workflow_stats',
        title: 'Get Workflow Statistics',
        description: 'Get execution statistics for a workflow',
        inputSchema: {
          id: z.string().describe('Workflow ID'),
        },
      },
      {
        name: 'n8n_import_workflow',
        title: 'Import n8n Workflow',
        description: 'Import a workflow from JSON data',
        inputSchema: {
          workflowData: z.record(z.unknown()).describe('Workflow JSON data'),
          name: z.string().optional().describe('Override workflow name'),
        },
      },
      {
        name: 'get_tool_usage_stats',
        title: 'Get Tool Usage Statistics',
        description: 'Get statistics about MCP tool usage',
        inputSchema: {
          period: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
        },
      },
      {
        name: 'list_available_tools',
        title: 'List Available Tools',
        description: 'Get comprehensive list of all available n8n workflow tools with categories',
        inputSchema: {
          category: z.string().optional().describe('Filter by tool category'),
          search: z.string().optional().describe('Search term for tools'),
        },
      },
      {
        name: 'validate_mcp_config',
        title: 'Validate MCP Configuration',
        description: 'Check .mcp.json configuration and environment setup for common issues',
        inputSchema: {
          fix: z.boolean().optional().default(false).describe('Attempt to fix issues automatically'),
        },
      },
      {
        name: 'recommend_n8n_nodes',
        title: 'Recommend n8n Nodes',
        description: 'Get intelligent node recommendations based on user requirements (type-safe simplified engine)',
        inputSchema: {
          userInput: z.string().describe('Describe what you want to achieve with n8n'),
          complexity: z.enum(['simple', 'standard', 'advanced']).optional().describe('Preferred complexity level'),
          providers: z.array(z.string()).optional().describe('Preferred service providers (e.g. gmail, slack, openai)'),
        },
      },
      {
        name: 'get_system_health',
        title: 'Get System Health',
        description: 'Get comprehensive system health including error statistics and performance metrics',
        inputSchema: {
          includeErrorDetails: z.boolean().optional().default(false).describe('Include detailed error breakdown'),
        },
      },
    ] as const

    // Register all tools in batch with shared handler pattern
    staticToolConfigs.forEach((toolConfig) => {
      registeredToolCount++
      this.server.registerTool(
        toolConfig.name,
        {
          title: toolConfig.title,
          description: toolConfig.description,
          inputSchema: toolConfig.inputSchema,
        },
        async (args: Record<string, unknown>) => {
          try {
            logger.debug(`🔧 Tool called: ${toolConfig.name}`, { args })

            // Special handling for node recommendations using simplified engine
            if (toolConfig.name === 'recommend_n8n_nodes') {
              return this.handleNodeRecommendations(args)
            }

            // Special handling for system health monitoring
            if (toolConfig.name === 'get_system_health') {
              return this.handleSystemHealth(args)
            }

            // Default routing for all other tools
            const result = await this.executeToolWithRouting(toolConfig.name, args)
            logger.debug(`✅ Tool completed: ${toolConfig.name}`)

            // Ensure proper MCP response format
            if (result && typeof result === 'object' && 'content' in result) {
              return result
            }

            // Convert to MCP format if not already formatted
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              }],
            }
          }
          catch (error) {
            logger.error(`❌ Tool failed: ${toolConfig.name}`, error)
            return {
              content: [{
                type: 'text' as const,
                text: `Error executing ${toolConfig.name}: ${error instanceof Error ? error.message : String(error)}`,
              }],
              isError: true,
            }
          }
        },
      )
    })

    logger.debug(`Registered ${staticToolConfigs.length} static n8n tools`)
  }

  private async executeToolWithRouting(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    content: Array<{ type: 'text', text: string }>
    isError?: boolean
  }> {
    // Check for token-optimized routing first
    const optimizedTool = toolRegistry.getAllTools().find(t => t.name === toolName)
    if (optimizedTool) {
      try {
        logger.debug(`🚀 Using token-optimized routing for ${toolName}`)
        const handler = optimizedTool.handler as ((args: Record<string, unknown>) => Promise<unknown>) | undefined
        if (!handler) {
          throw new Error(`No handler available for optimized tool ${toolName}`)
        }
        const result = await handler(args)

        // Convert to MCP format if not already formatted
        if (result && typeof result === 'object' && 'content' in result) {
          return result as { content: Array<{ type: 'text', text: string }>, isError?: boolean }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        }
      }
      catch (error) {
        logger.warn(`Token optimization failed for ${toolName}, falling back to standard routing:`, error)
        // Fall through to standard routing
      }
    }

    // Use simplified pipeline if feature flag is enabled
    if (isSimplifiedPipelineEnabled()) {
      return this.executeToolSimplified(toolName, args)
    }

    // Original complex pipeline (for comparison and rollback safety)
    return this.executeToolComplex(toolName, args)
  }

  /**
   * Simplified tool execution pipeline (2-3 steps vs original 6+ steps)
   * Used when featureFlags.architecture.useSimplifiedToolPipeline = true
   */
  private async executeToolSimplified(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    content: Array<{ type: 'text', text: string }>
    isError?: boolean
  }> {
    const startTime = performance.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return executeWithErrorHandling(toolName, async () => {
      // Step 1: Basic input sanitization (essential for security)
      const sanitizedArgs = inputSanitizer.sanitizeObject(args) as Record<string, unknown>

      // Step 2: Direct tool execution (skip complex routing and context building)
      const timeout = config.mcpTimeout || 30000 // Default 30s if config unavailable
      const result = await nodeAsyncUtils.raceWithTimeout(
        N8NMCPTools.executeTool(toolName, sanitizedArgs),
        timeout,
        `Tool execution timeout for ${toolName} (${timeout}ms)`,
      )

      // Step 3: Simple success logging
      const executionTime = performance.now() - startTime

      if (featureFlags.debugging.logPerformanceComparisons) {
        logger.info(`🚀 Simplified execution completed: ${toolName}`, {
          executionTime: `${executionTime.toFixed(2)}ms`,
          requestId,
          pipeline: 'simplified',
          success: true,
        })
      }

      // Convert McpToolResponse to MCP format
      if (result && typeof result === 'object' && 'success' in result) {
        const mcpResult = result as { success: boolean, data?: unknown, error?: string }

        if (!mcpResult.success) {
          return {
            content: [{
              type: 'text' as const,
              text: mcpResult.error || 'Tool execution failed',
            }],
            isError: true,
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(mcpResult.data, null, 2),
          }],
        }
      }

      // Fallback for unexpected response format
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    }, requestId).catch((error: EnhancedMcpError) => {
      // Enhanced error handling with structured logging
      const executionTime = performance.now() - startTime
      const logData = error.toLogFormat()

      logger.error(`Enhanced simplified execution failed: ${toolName}`, {
        ...logData.context,
        executionTime: `${executionTime.toFixed(2)}ms`,
        pipeline: 'simplified',
      })

      // Return user-friendly error response
      return error.toUserResponse()
    })
  }

  /**
   * Original complex tool execution pipeline
   * Preserved for comparison and rollback safety
   */
  private async executeToolComplex(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    content: Array<{ type: 'text', text: string }>
    isError?: boolean
  }> {
    // Generate request ID for tracking
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    // Start performance measurement
    performanceMonitor.startMeasurement(toolName)

    // Create async context for request tracking
    const asyncContext = {
      requestId,
      startTime,
      toolName,
      userId: 'claude-code',
    }

    return runWithContext(asyncContext, async () => {
      try {
        // Create security context for Claude Code
        const securityContext = createClaudeContext()

        // Validate tool access
        if (!validateToolAccess(toolName, securityContext)) {
          securityAudit.logEvent({
            eventType: SecurityEventType.ACCESS_DENIED,
            success: false,
            toolName,
            userId: securityContext.userId,
            details: { reason: 'Tool access validation failed' },
          })

          return {
            content: [
              {
                type: 'text' as const,
                text: `Access denied for tool: ${toolName}`,
              },
            ],
            isError: true,
          }
        }

        // Sanitize input arguments with enhanced validation
        const sanitizedArgs = inputSanitizer.sanitizeObject(args) as Record<
        string,
        unknown
      >

        // Build context for intelligent agent routing
        const context = this.buildContext(toolName, sanitizedArgs)

        // Route to appropriate agent
        const agent = agentRouter.routeTool(toolName, context)

        logger.info(`Tool ${toolName} routed to agent: ${agent.name}`, { requestId })

        // Execute the tool with enhanced error handling and timeout
        const result = await nodeAsyncUtils.raceWithTimeout(
          N8NMCPTools.executeTool(toolName, sanitizedArgs),
          config.mcpTimeout,
          `Tool execution timeout for ${toolName}`,
        )

        // End performance measurement
        const executionTime = performanceMonitor.endMeasurement(toolName)

        // Log successful execution
        securityAudit.logEvent({
          eventType: SecurityEventType.TOOL_EXECUTED,
          success: true,
          toolName,
          userId: securityContext.userId,
          details: {
            executionTime: `${executionTime.toFixed(2)}ms`,
            agent: agent.name,
            requestId,
          },
        })

        logger.info(`Tool ${toolName} executed successfully`, {
          executionTime: `${executionTime.toFixed(2)}ms`,
          agent: agent.name,
          requestId,
        })

        // Convert McpToolResponse to MCP format
        if (result && typeof result === 'object' && 'success' in result) {
          const mcpResult = result as { success: boolean, data?: unknown, error?: string }

          if (!mcpResult.success) {
            return {
              content: [{
                type: 'text' as const,
                text: mcpResult.error || 'Tool execution failed',
              }],
              isError: true,
            }
          }

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(mcpResult.data, null, 2),
            }],
          }
        }

        // Fallback for unexpected response format
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }
      catch (error) {
        // End performance measurement even on error
        const executionTime = performanceMonitor.endMeasurement(toolName)

        const errorDetails = {
          tool: toolName,
          args,
          requestId,
          timestamp: new Date().toISOString(),
          executionTime: `${executionTime.toFixed(2)}ms`,
          error: (error as Error).message,
          stack: (error as Error).stack?.split('\n').slice(0, 3).join('\n'),
        }

        logger.error(`Tool execution failed: ${toolName}`, errorDetails)

        // Log security event for tool execution failure
        securityAudit.logEvent({
          eventType: SecurityEventType.SECURITY_ERROR,
          success: false,
          toolName,
          userId: asyncContext.userId,
          details: errorDetails,
        })

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error executing ${toolName}:\n${(error as Error).message}\n\nContext: ${JSON.stringify({ args, requestId, executionTime: errorDetails.executionTime, timestamp: errorDetails.timestamp }, null, 2)}`,
            },
          ],
          isError: true,
        }
      }
    })
  }

  private buildContext(
    toolName: string,
    _args: Record<string, unknown>,
  ): Record<string, unknown> {
    const context = AgentContextBuilder.create()

    // Analyze tool complexity
    if (toolName.includes('create') || toolName.includes('execute')) {
      context.complexity('high')
    }
    else if (toolName.includes('get') && toolName.includes('stats')) {
      context.complexity('medium').requiresValidation()
    }
    else {
      context.complexity('low')
    }

    // Route based on tool patterns
    if (toolName.includes('node')) {
      context.nodeExpertise()
    }

    if (
      toolName.includes('workflow')
      && (toolName.includes('activate') || toolName.includes('execute'))
    ) {
      context.requiresAuthentication()
    }

    if (toolName.includes('stats') || toolName.includes('usage')) {
      context.requiresValidation()
    }

    if (
      toolName === 'search_n8n_nodes'
      || toolName === 'get_tool_usage_stats'
    ) {
      context.quickHelp()
    }

    return context.build() as Record<string, unknown>
  }

  private setupErrorHandlers(): void {
    // McpServer handles errors internally - we just set up process handlers

    // Modern Node.js signal handling with AbortController
    const abortController = new AbortController()

    // Enhanced signal handling for graceful shutdown
    const handleShutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`)

      // Cancel any pending operations
      abortController.abort()

      try {
        // Graceful shutdown with timeout
        await Promise.race([
          this.server.close(),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Shutdown timeout')), 5000)
          }),
        ])
        logger.info('Server closed successfully')
      }
      catch (error) {
        logger.error('Error during shutdown:', error)
      }

      process.exit(0)
    }

    // Use newer Node.js signal handling patterns
    process.on('SIGINT', () => handleShutdown('SIGINT'))
    process.on('SIGTERM', () => handleShutdown('SIGTERM'))

    // Enhanced error handling for unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise.toString(),
      })

      // In production, we might want to exit on unhandled rejections
      if (config.nodeEnv === 'production') {
        logger.error('Exiting due to unhandled promise rejection in production')
        process.exit(1)
      }
    })

    // Handle uncaught exceptions with better reporting
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })

      // Always exit on uncaught exceptions
      process.exit(1)
    })

    // Node.js 22+ warning handler for deprecations
    process.on('warning', (warning) => {
      if (warning.name === 'DeprecationWarning') {
        logger.warn('Deprecation Warning:', {
          message: warning.message,
          // eslint-disable-next-line ts/no-explicit-any
          code: (warning as any).code,
          stack: warning.stack,
        })
      }
      else {
        logger.debug('Process Warning:', warning.message)
      }
    })
  }

  /**
   * Install Claude Code agents (smart update check)
   * Only installs/updates when:
   * - First time (no agents exist)
   * - Version change detected
   * - Agent content has changed
   */
  private async installClaudeAgents(): Promise<void> {
    try {
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      const installerPath = join(
        __dirname,
        '..',
        'scripts',
        'install-claude-mcp.js',
      )

      // Run installer in silent mode with update check
      const child = spawn('node', [installerPath, '--silent'], {
        stdio: 'pipe',
        detached: true,
      })

      // Capture output for logging
      child.stdout?.on('data', (data) => {
        const output = data.toString().trim()
        if (
          output.includes('Agents updated')
          || output.includes('Update needed')
        ) {
          logger.info(`Agent installer: ${output}`)
        }
      })

      child.stderr?.on('data', (data) => {
        logger.debug(`Agent installer error: ${data.toString().trim()}`)
      })

      child.unref() // Allow parent to exit independently

      logger.debug('Claude Code agent installation check initiated')
    }
    catch (error) {
      logger.debug('Agent installation check skipped:', error)
    }
  }

  async start(): Promise<void> {
    const serverStartTime = Date.now()

    logger.info('Starting n8n-MCP Modern server...')
    logger.info(`Mode: ${config.mcpMode}`)
    logger.info(`Log Level: ${config.logLevel}`)
    logger.info(`Node.js Version: ${process.version}`)
    logger.info(`Performance Monitoring: Enabled`)

    // Initialize database with performance optimization
    await database.initialize()
    logger.info('Database initialized with WAL mode and performance optimizations')

    // Initialize resilience features
    initializeResilience()
    logger.info('Resilience features initialized')

    // Initialize performance monitoring
    resourceMonitor.start(30000) // Monitor every 30 seconds
    logger.info('Resource monitoring started')

    // Initialize advanced memory management
    logger.info('Advanced memory management initialized', {
      enabled: config.enableMemoryMonitoring,
      warningThreshold: `${config.memoryThresholdWarning}%`,
      criticalThreshold: `${config.memoryThresholdCritical}%`,
      maxHeapSize: `${config.maxHeapSizeMb}MB`,
    })

    // Initialize aggressive memory cleanup for critical usage
    initializeAggressiveCleanup()
    logger.info('🚨 Aggressive memory cleanup initialized for critical usage prevention')

    // Initialize agent tools bridge
    initializeAgentTools()
    logger.info('Agent tool bridge initialized')

    // Initialize agent integration
    initializeAgentIntegration()
    logger.info('Agent MCP integration initialized')

    // Initialize security module
    initializeSecurity()
    logger.info('Security module initialized')

    // Test n8n API connection
    if (config.n8nApiUrl && config.n8nApiKey) {
      logger.info(`n8n API URL: ${config.n8nApiUrl}`)

      if (n8nApi) {
        const connected = await n8nApi.testConnection()
        if (connected) {
          logger.info('n8n API connection successful')
        }
        else {
          logger.warn('n8n API connection failed - running in offline mode')
        }
      }
    }
    else {
      logger.info('No n8n API configured - running in offline mode')
    }

    // Log agent system status
    const agents = agentRouter.getAllAgents()
    logger.info(`Agent system ready: ${agents.length} agents available`)
    agents.forEach((agent) => {
      logger.debug(
        `  - ${agent.name} (Tier ${agent.tier}): ${agent.capabilities.join(', ')}`,
      )
    })

    // Install Claude Code agents (background process)
    this.installClaudeAgents()

    const transport = new StdioServerTransport()

    // Add connection timeout
    const connectWithTimeout = Promise.race([
      this.server.connect(transport),
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('MCP connection timeout after 30 seconds')),
          30000,
        )
      }),
    ])

    await connectWithTimeout

    // Log startup performance metrics
    const startupTime = Date.now() - serverStartTime
    const memoryUsage = process.memoryUsage()

    logger.info('n8n-MCP Modern server started successfully', {
      startupTime: `${startupTime}ms`,
      memoryUsage: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      },
    })

    logger.info(`${registeredToolCount} essential n8n workflow tools ready`)
    logger.info(`MCP server initialized successfully for Claude Code integration`)

    // Log resource monitoring status
    const resourceStatus = resourceMonitor.getCurrentStatus()
    logger.info('Resource monitoring active', {
      uptime: `${Math.round(resourceStatus.uptime)}s`,
      activeHandles: resourceStatus.activeHandles,
      activeRequests: resourceStatus.activeRequests,
    })

    // Schedule periodic performance reporting
    setInterval(() => {
      const performance = performanceMonitor.getAllStats()
      const resources = resourceMonitor.getCurrentStatus()
      const db = database.getPerformanceMetrics()
      const memory = memoryManager.getMemoryReport()
      const http = httpClient.getStats()
      const pools = httpClient.getPoolStats()

      if (Object.keys(performance).length > 0 || memory.leak.suspected || http.requests > 0) {
        logger.debug('Performance metrics', {
          tools: performance,
          database: db,
          resources: {
            memory: `${Math.round(resources.memory.heapUsed / 1024 / 1024)}MB`,
            uptime: `${Math.round(resources.uptime)}s`,
          },
          memoryManagement: {
            level: memory.level,
            leak: memory.leak,
            gc: memory.gc,
            current: {
              heapUsed: `${Math.round(memory.current.heapUsed / 1024 / 1024)}MB`,
              heapTotal: `${Math.round(memory.current.heapTotal / 1024 / 1024)}MB`,
              external: `${Math.round(memory.current.external / 1024 / 1024)}MB`,
            },
          },
          httpClient: {
            requests: http.requests,
            averageResponseTime: `${http.averageResponseTime}ms`,
            cacheHitRate: http.requests > 0 ? `${Math.round((http.cacheHits / http.requests) * 100)}%` : '0%',
            errors: http.errors,
            cacheSize: http.cacheSize,
            poolCount: http.poolCount,
            pools: Object.keys(pools).length > 0 ? pools : undefined,
          },
        })
      }
    }, 300000) // Log every 5 minutes

    logger.info('Server ready for Claude Code integration')
  }

  /**
   * Setup dynamic n8n API-dependent tools
   * These tools are enabled/disabled based on n8n API configuration
   */
  private setupDynamicN8NApiTools(): void {
    const hasN8NApiConfig = config.n8nApiUrl && config.n8nApiKey

    // Get n8n workflows - requires API access
    registeredToolCount++
    this.server.registerTool(
      'get_n8n_workflows',
      {
        title: 'Get n8n Workflows',
        description: 'Retrieve all workflows from n8n instance',
        inputSchema: {
          limit: z.number().optional().default(10).describe('Maximum number of workflows to return'),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting('get_n8n_workflows', args),
    )

    // Create workflow - requires API access
    registeredToolCount++
    this.server.registerTool(
      'create_n8n_workflow',
      {
        title: 'Create n8n Workflow',
        description: 'Create a new workflow in n8n',
        inputSchema: {
          name: z.string().describe('Workflow name'),
          nodes: z.array(N8NWorkflowNodeSchema).describe('Array of workflow nodes'),
          connections: N8NConnectionsSchema.describe('Node connections'),
          active: z.boolean().optional().default(false).describe('Whether to activate the workflow'),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting('create_n8n_workflow', args),
    )

    // Execute workflow - requires API access
    registeredToolCount++
    this.server.registerTool(
      'execute_n8n_workflow',
      {
        title: 'Execute n8n Workflow',
        description: 'Execute a workflow in n8n',
        inputSchema: {
          id: z.string().describe('Workflow ID to execute'),
          data: z.record(z.unknown()).optional().describe('Input data for the workflow'),
        },
      },
      async (args: Record<string, unknown>) =>
        this.executeToolWithRouting('execute_n8n_workflow', args),
    )

    // Configure initial state based on API availability
    if (hasN8NApiConfig) {
      logger.info('n8n API configured - enabling workflow management tools')
      // Tools are enabled by default when created with registerTool()
    }
    else {
      logger.warn('n8n API not configured - disabling workflow management tools')
      // Note: With registerTool(), conditional registration should be handled at registration time
    }
  }

  /**
   * Configure dynamic tools based on runtime conditions
   */
  private configureDynamicTools(): void {
    // Monitor feature flag changes and update tools accordingly
    if (!featureFlags.intelligenceLayer.enabled) {
      // If intelligence layer is disabled, we could disable certain advanced tools
      logger.debug('Intelligence layer disabled - using simplified tool behavior')
    }

    // Example: Monitor performance and conditionally manage tools
    // Note: Direct monitoring instead of event-based approach
    const performanceStats = performanceMonitor.getAllStats()
    if (Object.keys(performanceStats).length > 0) {
      logger.debug('Performance monitoring active for dynamic tool management')
    }
  }

  /**
   * Runtime tool management - log n8n API availability status
   * Note: MCP SDK doesn't support runtime enabling/disabling of individual tools
   */
  public enableN8NApiTools(): void {
    logger.info('n8n API tools are available through dynamic tool registry')
  }

  /**
   * Runtime tool management - log n8n API unavailability status
   */
  public disableN8NApiTools(): void {
    logger.info('n8n API tools are disabled - API configuration not available')
  }

  /**
   * Tool configuration updates are handled through the dynamic tool registry
   */
  public updateToolConfiguration(toolName: string, updates: { description?: string }): void {
    logger.debug(`Tool configuration update requested for ${toolName}:`, updates)
    // MCP SDK handles tool metadata internally
  }

  /**
   * Handle node recommendations using the simplified, type-safe engine
   */
  private async handleNodeRecommendations(args: Record<string, unknown>): Promise<{
    content: Array<{ type: 'text', text: string }>
    isError?: boolean
  }> {
    return executeToolWithErrorHandling('recommend_n8n_nodes', async () => {
      const { userInput, complexity, providers } = args as {
        userInput: string
        complexity?: 'simple' | 'standard' | 'advanced'
        providers?: string[]
      }

      // Validate required input
      if (!userInput || typeof userInput !== 'string') {
        throw new EnhancedMcpError(
          'userInput is required and must be a string',
          {
            category: ErrorCategory.VALIDATION,
            severity: ErrorSeverity.MEDIUM,
            recoverable: true,
            toolName: 'recommend_n8n_nodes',
            metadata: { providedArgs: Object.keys(args) },
          },
        )
      }

      // Initialize simplified node recommender with database
      await SimplifiedNodeRecommender.initialize({ getAllNodes: () => Promise.resolve(database.getNodes()) })

      // Create recommendation context
      const context = createSimpleNodeContext(userInput, {
        ...(complexity !== undefined && { complexity }),
        ...(providers !== undefined && { providers }),
      })

      // Get recommendations using simplified engine
      const recommendations = SimplifiedNodeRecommender.getRecommendations(context)

      // Format recommendations for display
      let responseText = `🎯 **Node Recommendations** (Simplified Engine)\n\n`
      responseText += `**Input:** ${userInput}\n`
      responseText += `**Complexity Level:** ${complexity || 'standard'}\n\n`

      if (recommendations.length === 0) {
        responseText += `No specific recommendations found. Try using these popular nodes:\n`
        responseText += `• Manual Trigger (for starting workflows)\n`
        responseText += `• HTTP Request (for API calls)\n`
        responseText += `• Code (for custom logic)\n`
      }
      else {
        responseText += `**Recommended Nodes:**\n\n`

        recommendations.forEach((rec, index) => {
          responseText += `${index + 1}. **${rec.displayName}**\n`
          responseText += `   Category: ${rec.category}\n`
          responseText += `   Confidence: ${(rec.confidence * 100).toFixed(0)}%\n`
          responseText += `   Reason: ${rec.reasoning}\n`

          if (rec.alternatives?.length) {
            responseText += `   Alternatives: ${rec.alternatives.join(', ')}\n`
          }

          if (rec.isPopular) {
            responseText += `   ⭐ Popular choice\n`
          }

          if (rec.isRecommended) {
            responseText += `   ✅ Highly recommended\n`
          }

          responseText += `\n`
        })
      }

      // Add performance note
      responseText += `\n💡 **Engine:** Lightweight simplified recommendations (Phase 4 enhancement)\n`
      responseText += `**Features:** Type-safe, memory-efficient, fast pattern matching`

      return {
        content: [{ type: 'text', text: responseText }],
      }
    })
  }

  /**
   * Handle system health monitoring with comprehensive error statistics
   */
  private async handleSystemHealth(args: Record<string, unknown>): Promise<{
    content: Array<{ type: 'text', text: string }>
    isError?: boolean
  }> {
    return executeToolWithErrorHandling('get_system_health', async () => {
      const { includeErrorDetails } = args as {
        includeErrorDetails?: boolean
      }

      // Get error statistics
      const errorStats = EnhancedErrorHandler.getErrorStats()

      // Get performance metrics
      const performanceStats = performanceMonitor.getAllStats()

      // Get memory usage
      const memoryUsage = process.memoryUsage()

      // Get uptime
      const uptimeMs = performance.now()
      const uptimeMinutes = Math.floor(uptimeMs / 60000)

      let responseText = `🏥 **System Health Report**\n\n`

      // Overall health status
      const healthScore = this.calculateHealthScore(errorStats, performanceStats, memoryUsage)
      const healthIcon = healthScore >= 80 ? '🟢' : healthScore >= 60 ? '🟡' : '🔴'

      responseText += `**Overall Health:** ${healthIcon} ${healthScore}/100\n`
      responseText += `**Uptime:** ${uptimeMinutes} minutes\n\n`

      // Error Statistics
      responseText += `## 📊 Error Statistics\n`
      responseText += `- **Total Error Types:** ${errorStats.totalErrors}\n`
      responseText += `- **Recent Errors (1h):** ${errorStats.recentErrors}\n\n`

      if (includeErrorDetails && Object.keys(errorStats.errorsByCategory).length > 0) {
        responseText += `**Error Breakdown by Category:**\n`
        Object.entries(errorStats.errorsByCategory).forEach(([category, count]) => {
          responseText += `- ${category}: ${count}\n`
        })
        responseText += `\n`
      }

      // Performance Metrics
      responseText += `## ⚡ Performance Metrics\n`
      if (performanceStats && typeof performanceStats === 'object') {
        Object.entries(performanceStats).forEach(([tool, stats]) => {
          if (typeof stats === 'object' && stats !== null) {
            responseText += `- **${tool}**: ${JSON.stringify(stats)}\n`
          }
        })
      }
      responseText += `\n`

      // Memory Usage
      responseText += `## 💾 Memory Usage\n`
      responseText += `- **RSS:** ${Math.round(memoryUsage.rss / 1024 / 1024)}MB\n`
      responseText += `- **Heap Used:** ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB\n`
      responseText += `- **Heap Total:** ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB\n`
      responseText += `- **External:** ${Math.round(memoryUsage.external / 1024 / 1024)}MB\n\n`

      // Feature Flags Status
      responseText += `## 🏁 Feature Flags\n`
      responseText += `- **Intelligence Layer:** ${featureFlags.intelligenceLayer.enabled ? '✅' : '❌'}\n`
      responseText += `- **Simplified Pipeline:** ${featureFlags.architecture.useSimplifiedToolPipeline ? '✅' : '❌'}\n`
      responseText += `- **Memory Array Limits:** ${featureFlags.performance.limitMetricsArrays ? '✅' : '❌'}\n`
      responseText += `- **Performance Logging:** ${featureFlags.debugging.logPerformanceComparisons ? '✅' : '❌'}\n\n`

      // System Recommendations
      responseText += `## 💡 Recommendations\n`
      if (errorStats.recentErrors > 10) {
        responseText += `⚠️ High error rate detected - consider investigating recent changes\n`
      }
      if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.8) {
        responseText += `⚠️ High memory usage - consider enabling memory array limits\n`
      }
      if (healthScore < 60) {
        responseText += `🔴 System health is degraded - check logs for details\n`
      }
      else if (healthScore >= 90) {
        responseText += `✨ System is running optimally\n`
      }

      responseText += `\n📈 **Generated:** ${new Date().toISOString()}`

      return {
        content: [{ type: 'text', text: responseText }],
      }
    })
  }

  /**
   * Calculate overall system health score (0-100)
   */
  private calculateHealthScore(
    errorStats: ReturnType<typeof EnhancedErrorHandler.getErrorStats>,
    performanceStats: Record<string, unknown>,
    memoryUsage: NodeJS.MemoryUsage,
  ): number {
    let score = 100

    // Deduct for recent errors
    score -= Math.min(errorStats.recentErrors * 2, 30)

    // Deduct for total error diversity
    score -= Math.min(errorStats.totalErrors, 20)

    // Use configurable memory thresholds for realistic scoring
    const memoryUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal
    const warningThreshold = config.memoryThresholdWarning / 100 // Convert to ratio
    const criticalThreshold = config.memoryThresholdCritical / 100 // Convert to ratio

    // More realistic memory usage scoring for Node.js applications
    if (memoryUsageRatio > criticalThreshold) {
      // Only penalize at critical levels (default 90%+)
      score -= 20
    }
    else if (memoryUsageRatio > warningThreshold) {
      // Light penalty at warning levels (default 80%+), scaled by proximity to critical
      const warningRange = criticalThreshold - warningThreshold
      const proximityToCritical = (memoryUsageRatio - warningThreshold) / warningRange
      score -= Math.round(proximityToCritical * 10) // Max 10 point deduction
    }
    // No penalty below warning threshold - normal Node.js operation

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  /**
   * Initialize token optimization system
   * TECH DEBT FIX: Dynamic tool counts, memory-efficient reporters
   */
  private initializeTokenOptimization(): void {
    logger.info('Initializing token optimization system...')

    try {
      // Collect all existing tools for enhancement
      const existingTools = this.getAllRegisteredTools()

      // Enhance with token optimization
      const enhancementResult = DynamicToolEnhancer.enhanceAllTools(existingTools)

      // Update the registered tool count dynamically
      registeredToolCount = enhancementResult.tools.length

      logger.info('Token optimization initialized', {
        totalTools: enhancementResult.stats.total_tools,
        optimizedTools: enhancementResult.stats.optimized_tools,
        optimizationRate: `${enhancementResult.stats.optimization_rate}%`,
        estimatedTokenSavings: enhancementResult.stats.estimated_token_savings,
        reportersActive: enhancementResult.stats.reporters_active,
      })

      logger.info(`${getDynamicToolDescription()} with intelligent routing enabled`)
    }
    catch (error) {
      logger.error('Token optimization initialization failed:', error)
      logger.info('Continuing with standard tool routing')
    }
  }

  /**
   * Get all currently registered tools (for token optimization enhancement)
   */
  private getAllRegisteredTools(): Array<{ name: string, description?: string }> {
    // Get tools from dynamic registry instead of static list
    const discoveredTools = dynamicToolRegistry.getAllTools()

    return discoveredTools.map(tool => ({
      name: tool.name,
      description: tool.description,
    }))
  }

  /**
   * Get comprehensive tool descriptions for expanded coverage
   */
  private getToolDescription(toolName: string): string {
    const descriptions: Record<string, string> = {
      // Core Node Discovery & Documentation
      list_nodes: 'List all available n8n nodes with filtering and search capabilities',
      search_nodes: 'Search for nodes by name, category, or functionality with advanced filters',
      get_node_info: 'Get detailed information about a specific node including parameters and usage',
      get_node_essentials: 'Get essential node information optimized for quick reference',
      get_node_parameters: 'Get detailed parameter configuration for a node',
      get_node_examples: 'Get practical examples and use cases for a specific node',
      validate_node_config: 'Validate node configuration and parameters',
      get_node_documentation: 'Get comprehensive documentation for a node',
      get_node_versions: 'Get version information and compatibility details for nodes',
      get_community_nodes: 'List and search community-contributed nodes',
      get_popular_nodes: 'Get most popular and frequently used nodes',
      get_node_categories: 'List all node categories and their descriptions',
      get_node_tags: 'Get node tags and metadata for organization',

      // Comprehensive Workflow Management
      list_workflows: 'List all workflows with comprehensive filtering and pagination',
      get_workflow_details: 'Get detailed workflow information including nodes and connections',
      create_workflow: 'Create new workflows with validation and optimization',
      update_workflow: 'Update existing workflow configuration and structure',
      delete_workflow: 'Delete workflows with safety checks and confirmation',
      duplicate_workflow: 'Create copies of existing workflows with modifications',
      export_workflow: 'Export workflows in various formats (JSON, YAML)',
      import_workflow: 'Import workflows with validation and conflict resolution',
      validate_workflow: 'Comprehensive workflow validation and error checking',
      get_workflow_history: 'Get workflow version history and change tracking',
      restore_workflow_version: 'Restore previous workflow versions',

      // Execution Management & Analytics
      list_executions: 'List workflow executions with filtering and analytics',
      get_execution_details: 'Get detailed execution information and step-by-step results',
      retry_execution: 'Retry failed executions with options and parameters',
      stop_execution: 'Stop running executions safely',
      delete_execution: 'Delete execution records and associated data',
      get_execution_logs: 'Get comprehensive execution logs and debugging information',
      get_execution_metrics: 'Get execution performance metrics and analytics',
      get_execution_history: 'Get historical execution data with trends',

      // Workflow State Management
      activate_workflow: 'Activate workflows for automatic execution',
      deactivate_workflow: 'Deactivate workflows and stop automatic execution',
      get_workflow_status: 'Get current workflow activation status and health',
      set_workflow_active_state: 'Set workflow activation state with validation',
      get_active_workflows: 'List all currently active workflows',
      bulk_activate_workflows: 'Activate/deactivate multiple workflows in batch',

      // Template & Task Management
      list_templates: 'List available workflow templates and starter packs',
      create_template: 'Create reusable workflow templates',
      use_template: 'Create workflows from templates with customization',
      get_template_info: 'Get detailed template information and parameters',
      update_template: 'Update existing workflow templates',
      delete_template: 'Delete workflow templates',
      search_templates: 'Search templates by functionality or use case',

      // System & Configuration
      get_system_info: 'Get comprehensive system information and capabilities',
      get_settings: 'Get current system settings and configuration',
      update_settings: 'Update system settings with validation',
      get_environment_info: 'Get environment variables and deployment information',
      check_dependencies: 'Check system dependencies and compatibility',
      get_version_info: 'Get version information for n8n and components',

      // Tool Management & Monitoring
      get_tool_documentation: 'Get documentation for MCP tools and their usage',
      validate_tool_access: 'Validate tool access permissions and capabilities',
      get_performance_metrics: 'Get tool performance metrics and optimization data',

      // Advanced Features
      backup_workflows: 'Create comprehensive backups of workflows and data',
      restore_backup: 'Restore workflows from backup files',
      bulk_operations: 'Perform bulk operations on multiple workflows',
      workflow_diff: 'Compare workflow versions and show differences',
      merge_workflows: 'Merge multiple workflows with conflict resolution',
      optimize_workflow: 'Analyze and optimize workflow performance',
      analyze_workflow_performance: 'Detailed workflow performance analysis',
    }

    return descriptions[toolName] || `Advanced n8n tool: ${toolName.replace(/_/g, ' ')}`
  }
}

/**
 * Handle CLI commands using Node.js 22+ parseArgs
 */
function handleCliCommands(): boolean {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        version: {
          type: 'boolean',
          short: 'v',
          default: false,
        },
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
        verbose: {
          type: 'boolean',
          default: false,
        },
        silent: {
          type: 'boolean',
          default: false,
        },
      },
      allowPositionals: true,
      strict: false, // Allow unknown options for flexibility
    })

    if (values.version) {
      process.stdout.write(`${PACKAGE_VERSION}\n`)
      return true
    }

    if (values.help) {
      process.stdout.write(`
n8n-MCP Modern v${PACKAGE_VERSION} - Essential n8n Workflow Tools via MCP

Usage:
  npx @eekfonky/n8n-mcp-modern              # Start MCP server (stdio mode)
  npx @eekfonky/n8n-mcp-modern --version    # Show version
  npx @eekfonky/n8n-mcp-modern --help       # Show this help
  npx @eekfonky/n8n-mcp-modern install      # Smart install/upgrade (auto-detects and preserves config)

Options:
  -v, --version     # Show version information
  -h, --help        # Show this help message
  --verbose         # Enable verbose logging
  --silent          # Suppress non-error output

Environment Variables:
  N8N_API_URL       # Your n8n instance URL
  N8N_API_KEY       # Your n8n API key
  LOG_LEVEL         # debug, info, warn, error (default: info)

For Claude Code integration:
  claude mcp add n8n-mcp-modern -- npx -y @eekfonky/n8n-mcp-modern

Documentation: https://github.com/eekfonky/n8n-mcp-modern
`)
      return true
    }

    // Handle install command from positionals
    if (positionals.includes('install')) {
      return false // Let the earlier install handler take over
    }

    // Set global verbosity flags for enhanced logging
    if (values.verbose) {
      process.env.LOG_LEVEL = 'debug'
      process.env.VERBOSE = 'true'
    }

    if (values.silent) {
      process.env.DISABLE_CONSOLE_OUTPUT = 'true'
    }

    return false
  }
  catch {
    // Fallback to legacy argument parsing if parseArgs fails
    const args = process.argv.slice(2)

    if (args.includes('--version') || args.includes('-v')) {
      process.stdout.write(`${PACKAGE_VERSION}\n`)
      return true
    }

    if (args.includes('--help') || args.includes('-h')) {
      process.stdout.write(`n8n-MCP Modern v${PACKAGE_VERSION}\n`)
      return true
    }

    return false
  }
}

/**
 * Start the server
 */
async function main(): Promise<void> {
  try {
    // Handle CLI commands first
    if (handleCliCommands()) {
      return
    }

    const server = new N8NMcpServer()
    await server.start()
  }
  catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Only run if this is the main module
// Check multiple conditions to handle npx, direct execution, etc.
const isMainModule
  = import.meta.url === `file://${process.argv[1]}`
    || (process.argv[1]?.endsWith('/dist/index.js') ?? false)
    || (process.argv[1]?.endsWith('n8n-mcp') ?? false)

if (isMainModule) {
  main().catch((error) => {
    logger.error('Unhandled error in main:', error)
    process.exit(1)
  })
}

export { N8NMcpServer }
