#!/usr/bin/env node
/**
 * n8n-MCP Modern - Pure Dynamic Discovery
 * Light, flexible, smart MCP server for n8n automation
 * Zero hardcoded tools - everything discovered dynamically
 */

import type { CallToolRequest, ListToolsRequest } from '@modelcontextprotocol/sdk/types.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {

  CallToolRequestSchema,

  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { coldStartOptimizer, startupAnalyzer } from './server/cold-start-optimizer.js'
import { safeExecute } from './server/enhanced-error-handler.js'
import { setupErrorMonitoring } from './server/error-monitoring.js'
import { logger } from './server/logger.js'
import { cleanup, executeToolHandler, getAllTools, initializeDynamicTools } from './tools/index.js'
import { initializePerformanceOptimizations } from './tools/performance-optimized.js'
import { getQuickMemoryStats, memoryProfiler, setupMemoryMonitoring } from './utils/memory-profiler.js'

const startTime = performance.now()

/**
 * Main MCP server implementation
 */
async function main() {
  startupAnalyzer.startPhase('startup-initialization')
  logger.info('🚀 Starting n8n-MCP Modern - Dynamic Discovery...')

  // Phase 1: Cold start optimization
  startupAnalyzer.startPhase('cold-start-optimization')
  const optimizationMetrics = await coldStartOptimizer.optimizeColdStart()
  startupAnalyzer.endPhase('cold-start-optimization')
  logger.info('✅ Cold start optimization completed', {
    totalTime: `${Math.round(optimizationMetrics.totalStartupTime)}ms`,
    preloadTime: `${Math.round(optimizationMetrics.preloadTime)}ms`,
    cachedModules: Object.keys(optimizationMetrics.moduleTimings).length,
  })

  // Phase 2: Error monitoring setup
  startupAnalyzer.startPhase('error-monitoring-setup')
  setupErrorMonitoring()
  startupAnalyzer.endPhase('error-monitoring-setup')
  logger.info('✅ Error monitoring system initialized')

  // Phase 3: Memory profiling setup
  startupAnalyzer.startPhase('memory-profiling-setup')
  setupMemoryMonitoring()
  memoryProfiler.start()
  const initialMemory = getQuickMemoryStats()
  startupAnalyzer.endPhase('memory-profiling-setup')
  logger.info('✅ Memory profiler started', initialMemory)

  // Phase 4: MCP Server setup
  startupAnalyzer.startPhase('mcp-server-setup')
  const server = new Server(
    {
      name: 'n8n-mcp-modern',
      version: '6.2.0',
      description: 'Dynamic n8n MCP server with community node discovery',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )
  startupAnalyzer.endPhase('mcp-server-setup')

  // Phase 5: Performance optimizations
  startupAnalyzer.startPhase('performance-optimizations')
  initializePerformanceOptimizations()
  startupAnalyzer.endPhase('performance-optimizations')

  // Phase 6: Dynamic tool discovery
  startupAnalyzer.startPhase('dynamic-tool-discovery')
  const discoveryResult = await safeExecute(
    async () => {
      await initializeDynamicTools()
      const initTime = performance.now() - startTime
      logger.info(`✅ Dynamic discovery complete in ${Math.round(initTime)}ms`)
      return initTime
    },
    {
      maxRetries: 2,
      baseDelayMs: 2000,
      onRetry: (attempt) => {
        logger.warn(`Dynamic discovery failed, retrying (attempt ${attempt})`)
      },
    },
  )
  startupAnalyzer.endPhase('dynamic-tool-discovery')

  if (!discoveryResult.success) {
    logger.warn('Dynamic discovery failed after retries, running in basic mode:', {
      error: discoveryResult.error.getErrorInfo(),
    })
  }

  // List tools (dynamically discovered)
  server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest) => {
    try {
      const tools = await getAllTools()
      logger.debug(`Returning ${tools.length} dynamically discovered tools`)
      return { tools }
    }
    catch (error) {
      logger.error('Failed to list tools:', error)
      return { tools: [] }
    }
  })

  // Execute tools (dynamically discovered)
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params

    logger.debug(`Executing dynamic tool: ${name}`)

    const executionResult = await safeExecute(
      async () => {
        const result = await executeToolHandler(name, args || {})
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      },
      {
        maxRetries: 1,
        baseDelayMs: 1000,
        onRetry: () => {
          logger.warn(`Tool execution failed, retrying: ${name}`)
        },
      },
    )

    if (executionResult.success) {
      return {
        content: [{
          type: 'text' as const,
          text: executionResult.data,
        }],
      }
    }
    else {
      // Handle execution failure with enhanced error information
      const errorInfo = executionResult.error.getErrorInfo()
      logger.error(`Tool execution failed for ${name}:`, errorInfo)

      return {
        content: [{
          type: 'text' as const,
          text: `Error executing tool "${name}": ${executionResult.error.message} (Code: ${errorInfo.code}, ID: ${errorInfo.errorId})`,
        }],
        isError: true,
      }
    }
  })

  // Phase 7: Server connection
  startupAnalyzer.startPhase('server-connection')
  const transport = new StdioServerTransport()
  await server.connect(transport)
  startupAnalyzer.endPhase('server-connection')

  // Phase 8: Final initialization
  startupAnalyzer.startPhase('final-initialization')
  const totalTime = performance.now() - startTime
  startupAnalyzer.endPhase('final-initialization')
  startupAnalyzer.endPhase('startup-initialization')

  // Generate startup performance report
  const performanceReport = startupAnalyzer.generateReport()

  logger.info(`🚀 n8n-MCP Modern ready in ${Math.round(totalTime)}ms`, {
    coldStartOptimization: `${Math.round(optimizationMetrics.totalStartupTime)}ms`,
    slowestPhase: `${performanceReport.slowestPhase.name} (${Math.round(performanceReport.slowestPhase.time)}ms)`,
    totalPhases: Object.keys(performanceReport.phases).length,
    cacheEfficiency: optimizationMetrics.cacheHitRate ? `${(optimizationMetrics.cacheHitRate * 100).toFixed(1)}%` : 'N/A',
  })
}

// Handle process signals with cleanup (prevent duplicate handlers)
const mainShutdownHandlerRegistered = Symbol.for('main.shutdownHandlerRegistered')
if (!(global as any)[mainShutdownHandlerRegistered]) {
  (global as any)[mainShutdownHandlerRegistered] = true

  let shutdownInProgress = false

  const gracefulShutdown = async (signal: string) => {
    if (shutdownInProgress) {
      logger.warn(`${signal} received but shutdown already in progress`)
      return
    }

    shutdownInProgress = true
    logger.info(`Shutting down n8n-MCP Modern (${signal})...`)

    try {
      // Stop memory profiler and get final stats
      memoryProfiler.stop()
      const finalMemory = getQuickMemoryStats()
      logger.info('Final memory stats', finalMemory)

      await cleanup()
      logger.info('Cleanup completed successfully')
    }
    catch (error) {
      logger.error('Error during shutdown cleanup:', error)
    }
    finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
}

// Start the server
main().catch((error) => {
  logger.error('Failed to start n8n-MCP Modern:', error)
  process.exit(1)
})
