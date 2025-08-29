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
import { logger } from './server/logger.js'
import { executeToolHandler, getAllTools, initializeDynamicTools, cleanup } from './tools/index.js'
import { initializePerformanceOptimizations } from './tools/performance-optimized.js'

const startTime = performance.now()

/**
 * Main MCP server implementation
 */
async function main() {
  logger.info('🚀 Starting n8n-MCP Modern - Dynamic Discovery...')

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

  // Initialize performance optimizations first
  initializePerformanceOptimizations()

  // Initialize dynamic tool discovery
  try {
    await initializeDynamicTools()
    const initTime = performance.now() - startTime
    logger.info(`✅ Dynamic discovery complete in ${Math.round(initTime)}ms`)
  }
  catch (error) {
    logger.warn('Dynamic discovery failed, running in basic mode:', error)
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

    try {
      logger.debug(`Executing dynamic tool: ${name}`)
      const result = await executeToolHandler(name, args || {})
      return {
        content: [{
          type: 'text' as const,
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        }],
      }
    }
    catch (error) {
      logger.error(`Tool execution failed for ${name}:`, error)
      return {
        content: [{
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      }
    }
  })

  // Start the server
  const transport = new StdioServerTransport()
  await server.connect(transport)

  const totalTime = performance.now() - startTime
  logger.info(`🚀 n8n-MCP Modern ready in ${Math.round(totalTime)}ms`)
}

// Handle process signals with cleanup
process.on('SIGINT', async () => {
  logger.info('Shutting down n8n-MCP Modern...')
  try {
    await cleanup()
  } catch (error) {
    logger.error('Error during shutdown cleanup:', error)
  }
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.info('Shutting down n8n-MCP Modern...')
  try {
    await cleanup()
  } catch (error) {
    logger.error('Error during shutdown cleanup:', error)
  }
  process.exit(0)
})

// Start the server
main().catch((error) => {
  logger.error('Failed to start n8n-MCP Modern:', error)
  process.exit(1)
})
