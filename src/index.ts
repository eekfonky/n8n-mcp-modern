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
import { N8NMCPTools } from './tools/index.js'
import { N8NConnectionsSchema, N8NWorkflowNodeSchema } from './types/index.js'
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

/**
 * Count MCP-registered tools by checking the actual registration
 */
async function countMCPRegisteredTools(): Promise<number> {
  // We'll count these by maintaining a registry
  return getMCPToolRegistry().length
}

/**
 * Count comprehensive tools from comprehensive.ts
 */
async function countComprehensiveTools(): Promise<number> {
  try {
    const { getAllComprehensiveTools } = await import('./tools/comprehensive.js')
    return getAllComprehensiveTools().length
  }
  catch {
    // Fallback count if import fails
    return 40
  }
}

/**
 * Get MCP tool registry for counting
 */
function getMCPToolRegistry(): string[] {
  return [
    'search_n8n_nodes',
    'get_n8n_workflows',
    'get_n8n_workflow',
    'create_n8n_workflow',
    'execute_n8n_workflow',
    'get_n8n_executions',
    'get_workflow_stats',
    'activate_n8n_workflow',
    'deactivate_n8n_workflow',
    'n8n_import_workflow',
    'get_tool_usage_stats',
    'route_to_agent',
  ]
}

/**
 * Get dynamic tool count
 */
async function getToolCount(): Promise<{
  total: number
  registered: number
  comprehensive: number
}> {
  // Dynamic count of MCP-registered tools
  const mcpRegisteredTools = await countMCPRegisteredTools()

  // Dynamic count of comprehensive tools from comprehensive.ts
  const comprehensiveTools = await countComprehensiveTools()

  return {
    total: mcpRegisteredTools + comprehensiveTools,
    registered: mcpRegisteredTools,
    comprehensive: comprehensiveTools,
  }
}

// Cache tool count (will be populated async)
let TOTAL_TOOLS: {
  total: number
  registered: number
  comprehensive: number
} = { total: 0, registered: 0, comprehensive: 0 }

// Initialize tool count cache
getToolCount().then((count) => {
  TOTAL_TOOLS = count
}).catch(() => {
  // Fallback values if counting fails
  TOTAL_TOOLS = { total: 52, registered: 12, comprehensive: 40 }
})

/**
 * Main MCP Server Implementation
 */
class N8NMcpServer {
  private server: McpServer
  // Dynamic tool management - store references for runtime manipulation
  private dynamicTools: Map<string, ReturnType<McpServer['tool']>> = new Map()

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

    this.setupTools()
    this.setupErrorHandlers()
    this.configureDynamicTools()
  }

  private setupTools(): void {
    logger.info('Setting up n8n MCP tools...')

    // Optimized batch tool registration
    this.registerN8NToolsBatch()

    // Dynamic n8n API-dependent tools
    this.setupDynamicN8NApiTools()

    logger.info('Registered MCP tools with agent routing system')
  }

  /**
   * Optimized batch tool registration using efficient patterns
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
        description: `Get comprehensive list of all ${TOTAL_TOOLS.total} available tools with categories`,
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
                text: JSON.stringify(result, null, 2)
              }]
            }
          } catch (error) {
            logger.error(`❌ Tool failed: ${toolConfig.name}`, error)
            return {
              content: [{
                type: 'text' as const,
                text: `Error executing ${toolConfig.name}: ${error instanceof Error ? error.message : String(error)}`
              }],
              isError: true
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
              text: mcpResult.error || 'Tool execution failed'
            }],
            isError: true
          }
        }
        
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(mcpResult.data, null, 2)
          }]
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
                text: mcpResult.error || 'Tool execution failed'
              }],
              isError: true
            }
          }
          
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(mcpResult.data, null, 2)
            }]
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

    logger.info(
      `${TOTAL_TOOLS.total} total tools available: ${TOTAL_TOOLS.registered} MCP-registered + ${TOTAL_TOOLS.comprehensive} execution-routed`,
    )
    logger.info(`Complete catalog: 92 tools ready for Claude Code integration`)

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
    const getWorkflowsTool = this.server.tool(
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
    this.dynamicTools.set('get_n8n_workflows', getWorkflowsTool)

    // Create workflow - requires API access
    const createWorkflowTool = this.server.tool(
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
    this.dynamicTools.set('create_n8n_workflow', createWorkflowTool)

    // Execute workflow - requires API access
    const executeWorkflowTool = this.server.tool(
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
    this.dynamicTools.set('execute_n8n_workflow', executeWorkflowTool)

    // Configure initial state based on API availability
    if (hasN8NApiConfig) {
      logger.info('n8n API configured - enabling workflow management tools')
      // Tools are enabled by default when created
    }
    else {
      logger.warn('n8n API not configured - disabling workflow management tools')
      getWorkflowsTool.disable()
      createWorkflowTool.disable()
      executeWorkflowTool.disable()
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
   * Runtime tool management - enable n8n API tools when configuration is updated
   */
  public enableN8NApiTools(): void {
    const workflowTools = ['get_n8n_workflows', 'create_n8n_workflow', 'execute_n8n_workflow']

    workflowTools.forEach((toolName) => {
      const tool = this.dynamicTools.get(toolName)
      if (tool) {
        tool.enable()
        logger.info(`Enabled ${toolName} - n8n API is now available`)
      }
    })
  }

  /**
   * Runtime tool management - disable n8n API tools when configuration is lost
   */
  public disableN8NApiTools(): void {
    const workflowTools = ['get_n8n_workflows', 'create_n8n_workflow', 'execute_n8n_workflow']

    workflowTools.forEach((toolName) => {
      const tool = this.dynamicTools.get(toolName)
      if (tool) {
        tool.disable()
        logger.info(`Disabled ${toolName} - n8n API is not available`)
      }
    })
  }

  /**
   * Update tool configuration at runtime
   */
  public updateToolConfiguration(toolName: string, updates: { description?: string }): void {
    const tool = this.dynamicTools.get(toolName)
    if (tool && updates.description) {
      tool.update({
        description: updates.description,
      })
      logger.debug(`Updated ${toolName} configuration`)
    }
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

    // Deduct for high memory usage
    const memoryUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal
    if (memoryUsageRatio > 0.8) {
      score -= 20
    }
    else if (memoryUsageRatio > 0.6) {
      score -= 10
    }

    return Math.max(0, Math.min(100, Math.round(score)))
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
n8n-MCP Modern v${PACKAGE_VERSION} - ${TOTAL_TOOLS.total} MCP Tools for n8n Automation

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
