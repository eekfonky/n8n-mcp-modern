#!/usr/bin/env node
/**
 * n8n-MCP Modern - Pure Dynamic Discovery
 * Light, flexible, smart MCP server for n8n automation
 * Zero hardcoded tools - everything discovered dynamically
 */

import type { CallToolRequest, ListToolsRequest } from '@modelcontextprotocol/sdk/types.js'
import process from 'node:process'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {

  CallToolRequestSchema,

  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { initializeN8NApi } from './n8n/simple-api.js'
import { coldStartOptimizer, startupAnalyzer } from './server/cold-start-optimizer.js'
import { config, features } from './server/config.js'
import { setupErrorMonitoring } from './server/error-monitoring.js'
import { logger } from './server/logger.js'
import { cleanup, executeToolHandler, getAllTools, initializeDynamicTools } from './tools/index.js'
import { initializePerformanceOptimizations } from './tools/performance-optimized.js'
import { getQuickMemoryStats, memoryProfiler, setupMemoryMonitoring } from './utils/memory-profiler.js'
import { VERSION } from './version.js'

const { hasN8nApi } = features

const startTime = performance.now()

/**
 * Main MCP server implementation
 */
async function main(): Promise<void> {
  // Handle help flag immediately - no initialization needed
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('n8n-MCP Modern - Dynamic n8n MCP Server')
    console.log('')
    console.log('Usage: n8n-mcp [options]')
    console.log('')
    console.log('Options:')
    console.log('  -h, --help             Show this help message')
    console.log('  --version              Show version information')
    console.log('')
    console.log('Environment Variables:')
    console.log('  N8N_API_URL            Your n8n instance URL (e.g., https://n8n.example.com)')
    console.log('  N8N_API_KEY            Your n8n API key')
    console.log('  LOG_LEVEL              Log level (debug, info, warn, error)')
    console.log('')
    process.exit(0)
  }

  // Handle version flag immediately
  if (process.argv.includes('--version')) {
    console.log(VERSION)
    process.exit(0)
  }

  // Quick mode for testing - minimal initialization
  const quickMode = process.argv.includes('--quick') || process.env.MCP_QUICK_MODE === 'true'

  startupAnalyzer.startPhase('startup-initialization')

  // Fail fast if n8n is not configured - no fallback modes
  if (!hasN8nApi) {
    logger.error('❌ STARTUP FAILED: n8n API configuration missing')
    logger.error('Missing required environment variables:')
    logger.error('  - N8N_API_URL: Your n8n instance URL')
    logger.error('  - N8N_API_KEY: Your n8n API key')
    logger.error('')
    logger.error('To fix this:')
    logger.error('  1. Set the required environment variables')
    logger.error('  2. Ensure your n8n instance is accessible')
    process.exit(1)
  }

  logger.info('🚀 Starting n8n-MCP Modern - Dynamic Discovery...')

  // Initialize N8N API
  if (config.n8nApiUrl && config.n8nApiKey) {
    initializeN8NApi({
      apiUrl: config.n8nApiUrl,
      apiKey: config.n8nApiKey,
    })
    logger.info('✅ N8N API initialized')
  }

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
      version: VERSION,
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

  try {
    await initializeDynamicTools(quickMode)
    const initTime = performance.now() - startTime
    logger.info(`✅ Dynamic discovery complete in ${Math.round(initTime)}ms`)
  }
  catch (error) {
    logger.error('❌ STARTUP FAILED: Dynamic discovery failed')
    logger.error('Error details:', error instanceof Error ? error.message : String(error))
    logger.error('')
    logger.error('This usually indicates:')
    logger.error('  - n8n API connection failure (check N8N_API_URL and N8N_API_KEY)')
    logger.error('  - n8n instance is unreachable or down')
    logger.error('  - Invalid API credentials')
    logger.error('')
    logger.error('To troubleshoot:')
    logger.error('  1. Verify your n8n instance is running and accessible')
    logger.error('  2. Test API connection manually: curl -H "X-N8N-API-KEY: your_key" "your_n8n_url/api/v1/workflows"')
    process.exit(1)
  }

  startupAnalyzer.endPhase('dynamic-tool-discovery')

  // List tools (dynamically discovered)
  server.setRequestHandler(ListToolsRequestSchema, async (_request: ListToolsRequest) => {
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

    try {
      const result = await executeToolHandler(name, args || {})
      const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2)

      return {
        content: [{
          type: 'text' as const,
          text: resultText,
        }],
      }
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Tool execution failed for ${name}:`, errorMessage)

      return {
        content: [{
          type: 'text' as const,
          text: `Error executing tool "${name}": ${errorMessage}`,
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
if (!(globalThis as Record<symbol, boolean>)[mainShutdownHandlerRegistered]) {
  (globalThis as Record<symbol, boolean>)[mainShutdownHandlerRegistered] = true

  let shutdownInProgress = false

  const gracefulShutdown = async (signal: string): Promise<void> => {
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
