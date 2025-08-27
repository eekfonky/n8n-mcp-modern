/**
 * Simple Token Optimization Validation Test
 * Focus on core functionality validation
 */

import { describe, expect, it } from 'vitest'
import { isSimpleQuery } from '../../agents/memory-optimized-base.js'
import { DynamicToolEnhancer } from '../../tools/token-optimized-tools.js'

describe('token Optimization Core Functionality', () => {
  describe('query Classification', () => {
    it('should identify simple status queries correctly', () => {
      const simpleQueries = [
        'status',
        'health check',
        'list available nodes',
        'show workflows',
        'get system health',
        'what nodes are available',
      ]

      simpleQueries.forEach((query) => {
        const result = isSimpleQuery(query)
        expect(result).toBe(true)
      })
    })

    it('should identify complex queries correctly', () => {
      const complexQueries = [
        'create a complex multi-step workflow with error handling and API integrations',
        'analyze this JavaScript code for security vulnerabilities and performance issues',
        'debug execution failure with complex data transformations and error handling',
      ]

      complexQueries.forEach((query) => {
        const result = isSimpleQuery(query)
        expect(result).toBe(false)
      })
    })
  })

  describe('dynamic Tool Enhancement', () => {
    it('should enhance tools without errors', () => {
      const mockTools = [
        { name: 'get_system_health', description: 'Get system health status' },
        { name: 'search_n8n_nodes', description: 'Search for available nodes' },
      ]

      const result = DynamicToolEnhancer.enhanceAllTools(mockTools)

      expect(result.tools).toBeDefined()
      expect(result.tools.length).toEqual(mockTools.length)
      expect(result.stats).toBeDefined()
    })

    it('should provide tool count dynamically', () => {
      const toolCount = DynamicToolEnhancer.getToolCount()
      expect(toolCount).toBeGreaterThanOrEqual(0)
    })

    it('should provide comprehensive statistics', () => {
      const stats = DynamicToolEnhancer.getComprehensiveStats()

      expect(stats).toBeDefined()
      expect(stats.categories).toBeDefined()
      expect(typeof stats.total_tools).toBe('number')
    })
  })
})

/**
 * Performance measurement utility for real-world testing
 */
export async function measureTokenOptimizationPerformance() {
  console.log('🚀 Token Optimization Performance Test')

  // Test query classification speed
  const queries = [
    'status',
    'health',
    'list nodes',
    'available workflows',
    'create complex workflow',
    'analyze security issues',
  ]

  const startTime = performance.now()
  const results = queries.map(query => ({
    query,
    isSimple: isSimpleQuery(query),
    estimatedTokenSavings: isSimpleQuery(query) ? '90%' : '0%',
  }))
  const endTime = performance.now()

  console.log(`Classification performance: ${endTime - startTime}ms for ${queries.length} queries`)
  console.log('Results:', results)

  // Test tool enhancement
  const mockTools = Array.from({ length: 15 }, (_, i) => ({
    name: `tool_${i}`,
    description: `Test tool ${i}`,
  }))

  const enhanceStartTime = performance.now()
  const enhanced = DynamicToolEnhancer.enhanceAllTools(mockTools)
  const enhanceEndTime = performance.now()

  console.log(`Tool enhancement: ${enhanceEndTime - enhanceStartTime}ms for ${mockTools.length} tools`)
  console.log('Enhancement stats:', enhanced.stats)

  return {
    classificationTime: endTime - startTime,
    enhancementTime: enhanceEndTime - enhanceStartTime,
    toolsProcessed: mockTools.length,
    optimizationRate: enhanced.stats?.optimization_rate || 0,
  }
}
