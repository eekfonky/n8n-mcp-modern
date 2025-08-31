#!/usr/bin/env node
/**
 * Enhanced MCP Server with Full Protocol Support
 * Implements all MCP capabilities for comprehensive n8n automation
 */

import type {
  Server as MCPServer,
  RequestHandlerExtra,
} from '@modelcontextprotocol/sdk/server/index.js'
import type {
  LoggingLevel,
} from '@modelcontextprotocol/sdk/types.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  SetLevelRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { coldStartOptimizer } from '../server/cold-start-optimizer.js'
import { safeExecute } from '../server/enhanced-error-handler.js'
import { logger } from '../server/logger.js'
import { cleanup, executeToolHandler, getAllTools, initializeDynamicTools } from '../tools/index.js'
import { memoryProfiler, setupMemoryMonitoring } from '../utils/memory-profiler.js'
import { completionManager } from './completions.js'
import { promptManager } from './prompts.js'
import { resourceManager } from './resources.js'

const startTime = performance.now()

/**
 * Enhanced MCP server with full capabilities
 */
export async function createEnhancedServer(): Promise<MCPServer> {
  logger.info('🚀 Starting Enhanced n8n-MCP Server with Full Protocol Support...')

  // Initialize optimizations
  await coldStartOptimizer.optimizeColdStart()
  setupMemoryMonitoring()
  memoryProfiler.start()

  // Create server with all capabilities
  const server = new Server(
    {
      name: 'n8n-mcp-enhanced',
      version: '7.0.0',
      description: 'Full MCP protocol implementation for n8n automation',
    },
    {
      capabilities: {
        // Core capabilities
        tools: {
          listChanged: true,
        },
        resources: {
          subscribe: true,
          listChanged: true,
        },
        prompts: {
          listChanged: true,
        },
        completions: {},
        logging: {},

        // Experimental features
        experimental: {
          'n8n-integration': true,
          'dynamic-discovery': true,
          'performance-monitoring': true,
        },
      },
    },
  )

  // Initialize dynamic tools
  await safeExecute(
    async () => {
      await initializeDynamicTools()
      logger.info('✅ Dynamic tool discovery completed')
    },
    {
      maxRetries: 2,
      baseDelayMs: 2000,
    },
  )

  // ============================================================================
  // TOOLS HANDLERS
  // ============================================================================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const tools = await getAllTools()
      logger.debug(`Returning ${tools.length} tools`)
      return { tools }
    }
    catch (error) {
      logger.error('Failed to list tools:', error)
      return { tools: [] }
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    logger.debug(`Executing tool: ${name}`)

    const result = await safeExecute(
      async () => {
        const output = await executeToolHandler(name, args || {})
        return typeof output === 'string' ? output : JSON.stringify(output, null, 2)
      },
      { maxRetries: 1 },
    )

    if (result.success) {
      return {
        content: [{
          type: 'text' as const,
          text: result.data,
        }],
      }
    }
    else {
      return {
        content: [{
          type: 'text' as const,
          text: `Error: ${result.error.message}`,
        }],
        isError: true,
      }
    }
  })

  // ============================================================================
  // RESOURCES HANDLERS
  // ============================================================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const resources = await resourceManager.listResources()
      logger.debug(`Returning ${resources.length} resources`)
      return { resources }
    }
    catch (error) {
      logger.error('Failed to list resources:', error)
      return { resources: [] }
    }
  })

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const contents = await resourceManager.readResource(request.params.uri)
      return { contents }
    }
    catch (error) {
      logger.error(`Failed to read resource ${request.params.uri}:`, error)
      throw error
    }
  })

  server.setRequestHandler(SubscribeRequestSchema, async (request, extra: RequestHandlerExtra) => {
    const { uri } = request.params
    const sessionId = extra.meta?.sessionId || 'default'

    await resourceManager.subscribe(uri, sessionId)
    logger.debug(`Subscribed to ${uri}`)

    return {}
  })

  server.setRequestHandler(UnsubscribeRequestSchema, async (request, extra: RequestHandlerExtra) => {
    const { uri } = request.params
    const sessionId = extra.meta?.sessionId || 'default'

    await resourceManager.unsubscribe(uri, sessionId)
    logger.debug(`Unsubscribed from ${uri}`)

    return {}
  })

  // ============================================================================
  // PROMPTS HANDLERS
  // ============================================================================

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    try {
      const prompts = await promptManager.listPrompts()
      logger.debug(`Returning ${prompts.length} prompts`)
      return { prompts }
    }
    catch (error) {
      logger.error('Failed to list prompts:', error)
      return { prompts: [] }
    }
  })

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    try {
      const result = await promptManager.getPrompt(
        request.params.name,
        request.params.arguments || {},
      )
      return result
    }
    catch (error) {
      logger.error(`Failed to get prompt ${request.params.name}:`, error)
      throw error
    }
  })

  // ============================================================================
  // COMPLETIONS HANDLER
  // ============================================================================

  server.setRequestHandler(CompleteRequestSchema, async (request) => {
    try {
      const result = await completionManager.complete(request)
      return result
    }
    catch (error) {
      logger.error('Failed to complete:', error)
      return {
        completion: {
          values: [],
          total: 0,
          hasMore: false,
        },
      }
    }
  })

  // ============================================================================
  // LOGGING HANDLER
  // ============================================================================

  server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    const level = request.params.level as LoggingLevel

    // Map MCP logging levels to our logger
    const levelMap: Record<LoggingLevel, string> = {
      debug: 'debug',
      info: 'info',
      notice: 'info',
      warning: 'warn',
      error: 'error',
      critical: 'error',
      alert: 'error',
      emergency: 'error',
    }

    const mappedLevel = levelMap[level] || 'info'
    logger.level = mappedLevel
    logger.info(`Logging level set to: ${level} (mapped to ${mappedLevel})`)

    return {}
  })

  // ============================================================================
  // RESOURCE CHANGE NOTIFICATIONS
  // ============================================================================

  resourceManager.on('resources_changed', async ({ added, removed }) => {
    // Send list changed notification
    await server.notification({
      method: 'notifications/resources/list_changed',
      params: {},
    })

    logger.debug('Resources changed', { added, removed })
  })

  resourceManager.on('resource_updated', async ({ uri, content, sessionId }) => {
    // Send resource updated notification
    await server.notification({
      method: 'notifications/resources/updated',
      params: { uri },
    })

    logger.debug(`Resource updated: ${uri}`)
  })

  // ============================================================================
  // LOGGING NOTIFICATIONS
  // ============================================================================

  // Intercept our logger to send MCP logging notifications
  const originalLog = logger.log.bind(logger)
  logger.log = function (level: string, message: string, ...args: any[]) {
    originalLog(level, message, ...args)

    // Send MCP logging notification
    const mcpLevel = level === 'warn' ? 'warning' : level as LoggingLevel

    server.notification({
      method: 'notifications/message',
      params: {
        level: mcpLevel,
        logger: 'n8n-mcp',
        data: { message, args },
      },
    }).catch((err) => {
      // Ignore notification errors
    })
  }

  const totalTime = performance.now() - startTime
  logger.info(`🚀 Enhanced MCP Server ready in ${Math.round(totalTime)}ms`)

  return server
}

/**
 * Main entry point
 */
export async function main() {
  try {
    const server = await createEnhancedServer()
    const transport = new StdioServerTransport()
    await server.connect(transport)

    logger.info('✅ Enhanced MCP Server connected via stdio')
  }
  catch (error) {
    logger.error('Failed to start Enhanced MCP Server:', error)
    process.exit(1)
  }
}

// Handle process signals (prevent duplicate handlers)
const enhancedServerShutdownRegistered = Symbol.for('enhancedServer.shutdownHandlerRegistered')
if (!(global as any)[enhancedServerShutdownRegistered]) {
  (global as any)[enhancedServerShutdownRegistered] = true

  let shutdownInProgress = false

  const gracefulShutdown = async (signal: string) => {
    if (shutdownInProgress) {
      logger.warn(`${signal} received but Enhanced MCP Server shutdown already in progress`)
      return
    }

    shutdownInProgress = true
    logger.info(`Shutting down Enhanced MCP Server (${signal})...`)

    try {
      // Proper cleanup order: Stop monitoring first, then cleanup resources
      memoryProfiler.stop()
      resourceManager.cleanup()
      await cleanup()
      logger.info('Enhanced MCP Server shutdown completed')
    }
    catch (error) {
      logger.error('Error during Enhanced MCP Server shutdown:', error)
    }
    finally {
      // Force exit after timeout to prevent hanging
      setTimeout(() => process.exit(1), 5000).unref()
      process.exit(0)
    }
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Fatal error:', error)
    process.exit(1)
  })
}
