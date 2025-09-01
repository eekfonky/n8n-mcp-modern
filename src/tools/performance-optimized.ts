/**
 * Performance-optimized tool loading for n8n-MCP Modern
 * Lazy loading, pre-compiled schemas, native Node.js features
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { logger } from '../server/logger.js'

// Agent interface for type safety
interface Agent {
  type: string
  execute: (toolName: string, args: Record<string, unknown>) => Promise<{
    agent: string
    tool: string
    args?: Record<string, unknown>
    status: 'success' | 'error'
    timestamp: number
    executionTime: number
    error?: string
  }>
}

// Pre-compiled schema cache (using native Map for performance)
const compiledSchemas = new Map<string, (...args: unknown[]) => unknown>()
const toolCache = new Map<string, Tool>()
const handlerCache = new Map<string, (...args: unknown[]) => unknown>()

// Performance timing using native performance.now()
const startTime = performance.now()

/**
 * Lazy-loaded agent registry
 */
const agentRegistry = new Map<string, Agent>()

function _unusedGetAgent(type: string): Agent | null {
  if (!agentRegistry.has(type)) {
    // Lazy load agent classes only when needed
    switch (type) {
      case 'orchestrator':
        agentRegistry.set(type, createSimpleAgent('orchestrator'))
        break
      case 'builder':
        agentRegistry.set(type, createSimpleAgent('builder'))
        break
      case 'connector':
        agentRegistry.set(type, createSimpleAgent('connector'))
        break
      case 'node-expert':
        agentRegistry.set(type, createSimpleAgent('node-expert'))
        break
      case 'guide':
        agentRegistry.set(type, createSimpleAgent('guide'))
        break
      default:
        agentRegistry.set(type, createSimpleAgent('default'))
    }
  }
  return agentRegistry.get(type) || null
}

/**
 * Create simple agent with direct execution
 */
function createSimpleAgent(type: string): Agent {
  return {
    type,
    execute: async (toolName: string, args: Record<string, unknown>) => {
      const executeStart = performance.now()

      try {
        // Direct execution without complex routing
        const result = {
          agent: type,
          tool: toolName,
          args,
          status: 'success' as const,
          timestamp: Date.now(),
          executionTime: Math.round(performance.now() - executeStart),
        }

        logger.debug(`${type} executed ${toolName} in ${result.executionTime}ms`)
        return result
      }
      catch (error) {
        return {
          agent: type,
          tool: toolName,
          status: 'error' as const,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          executionTime: Math.round(performance.now() - executeStart),
        }
      }
    },
  }
}

/**
 * Pre-compile frequently used schemas
 */
export function preCompileSchemas(): void {
  const _basicSchema = {
    type: 'object',
    properties: {
      operation: { type: 'string' },
      parameters: { type: 'object' },
    },
  }

  // Simple validation function (avoiding zod overhead for hot paths)
  compiledSchemas.set('basic', (data: unknown) => {
    return typeof data === 'object' && data !== null
  })

  logger.debug(`Pre-compiled ${compiledSchemas.size} schemas`)
}

/**
 * Fast tool registration with minimal overhead
 */
export function registerTool(name: string, description: string, handler: (...args: unknown[]) => unknown): void {
  const tool: Tool = {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string' },
        parameters: { type: 'object' },
      },
    },
  }

  toolCache.set(name, tool)
  handlerCache.set(name, handler)
}

/**
 * Fast tool execution with performance monitoring
 */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const executeStart = performance.now()

  try {
    const handler = handlerCache.get(name)
    if (!handler) {
      throw new Error(`Tool not found: ${name}`)
    }

    // Fast validation
    const validator = compiledSchemas.get('basic')
    if (validator && !validator(args)) {
      throw new Error('Invalid arguments')
    }

    const result = await handler(args)
    const executionTime = Math.round(performance.now() - executeStart)

    // Performance target check
    if (executionTime > 100) {
      logger.warn(`Slow operation: ${name} took ${executionTime}ms`)
    }

    return {
      ...result,
      executionTime,
      performanceTarget: executionTime < 100 ? 'met' : 'exceeded',
    }
  }
  catch (error) {
    const executionTime = Math.round(performance.now() - executeStart)
    throw new Error(`Tool execution failed in ${executionTime}ms: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Get all tools with lazy loading
 */
export function getAllTools(): Tool[] {
  return Array.from(toolCache.values())
}

/**
 * Initialize performance optimizations
 */
export function initializePerformanceOptimizations(): void {
  // Pre-compile schemas
  preCompileSchemas()

  // Register core tools
  registerTool('ping', 'Health check with performance metrics', async () => ({
    status: 'ok',
    timestamp: Date.now(),
    uptime: Math.round(performance.now() - startTime),
    mode: 'performance_optimized',
  }))

  // Force garbage collection if available (Node.js with --expose-gc)
  if (globalThis.gc) {
    globalThis.gc()
    logger.debug('Forced garbage collection for optimal startup')
  }

  const initTime = Math.round(performance.now() - startTime)
  logger.info(`Performance optimizations initialized in ${initTime}ms`)
}

/**
 * Memory cleanup for performance
 */
export function performanceCleanup(): void {
  toolCache.clear()
  handlerCache.clear()
  compiledSchemas.clear()
  agentRegistry.clear()

  if (globalThis.gc) {
    globalThis.gc()
  }
}
