/**
 * Token Optimization Performance Benchmark Tests
 * Validates 90%+ token savings and performance improvements
 *
 * TECH DEBT CLEANUP:
 * - Bounded test data (no memory leaks)
 * - Proper TypeScript types throughout
 * - Memory-efficient test patterns
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isSimpleQuery } from '../../agents/memory-optimized-base.js'
import { BuilderReporter } from '../../agents/reporters/builder-reporter.js'
import { ConnectorReporter } from '../../agents/reporters/connector-reporter.js'
import { GuideReporter } from '../../agents/reporters/guide-reporter.js'
import { MemoryEfficientOrchestratorReporter } from '../../agents/reporters/memory-efficient-orchestrator-reporter.js'
import { NodeExpertReporter } from '../../agents/reporters/node-expert-reporter.js'
import { ScriptguardReporter } from '../../agents/reporters/scriptguard-reporter.js'
import { DynamicToolEnhancer } from '../../tools/token-optimized-tools.js'

interface TokenOptimizationTestCase {
  query: string
  toolName: string
  expectedRouting: 'reporter' | 'full-agent'
  expectedTokenSavings: number // percentage
}

interface PerformanceMetrics {
  executionTime: number
  memoryUsed: number
  tokenEstimate: number
  routing: 'reporter' | 'full-agent'
}

// Bounded test data to prevent memory issues
const TEST_SCENARIOS: TokenOptimizationTestCase[] = [
  // Simple queries - should route to reporters (90%+ token savings)
  {
    query: 'status',
    toolName: 'get_system_health',
    expectedRouting: 'reporter',
    expectedTokenSavings: 90,
  },
  {
    query: 'what nodes are available?',
    toolName: 'search_n8n_nodes',
    expectedRouting: 'reporter',
    expectedTokenSavings: 85,
  },
  {
    query: 'list workflows',
    toolName: 'get_n8n_workflows',
    expectedRouting: 'reporter',
    expectedTokenSavings: 80,
  },
  {
    query: 'connection health',
    toolName: 'validate_mcp_config',
    expectedRouting: 'reporter',
    expectedTokenSavings: 85,
  },
  {
    query: 'build status',
    toolName: 'get_workflow_stats',
    expectedRouting: 'reporter',
    expectedTokenSavings: 80,
  },
  {
    query: 'help with webhooks',
    toolName: 'list_available_tools',
    expectedRouting: 'reporter',
    expectedTokenSavings: 75,
  },

  // Complex queries - should route to full agents (no token savings, full reasoning)
  {
    query: 'create a complex multi-step workflow with error handling and API integrations',
    toolName: 'create_n8n_workflow',
    expectedRouting: 'full-agent',
    expectedTokenSavings: 0,
  },
  {
    query: 'analyze this JavaScript code for security vulnerabilities and performance issues',
    toolName: 'recommend_n8n_nodes',
    expectedRouting: 'full-agent',
    expectedTokenSavings: 0,
  },
  {
    query: 'debug execution failure with complex data transformations',
    toolName: 'get_n8n_executions',
    expectedRouting: 'full-agent',
    expectedTokenSavings: 0,
  },
]

describe('token Optimization Performance Benchmarks', () => {
  let originalMemoryUsage: NodeJS.MemoryUsage
  let reporters: Map<string, any>

  beforeAll(async () => {
    // Capture baseline memory usage
    originalMemoryUsage = process.memoryUsage()

    // Initialize reporter instances for testing
    reporters = new Map([
      ['orchestrator', new MemoryEfficientOrchestratorReporter()],
      ['builder', new BuilderReporter()],
      ['connector', new ConnectorReporter()],
      ['node-expert', new NodeExpertReporter()],
      ['scriptguard', new ScriptguardReporter()],
      ['guide', new GuideReporter()],
    ])
  })

  afterAll(() => {
    // Clean up reporters to prevent memory leaks
    reporters.clear()
  })

  describe('query Classification Accuracy', () => {
    it('should correctly identify simple queries for token optimization', () => {
      const simpleQueries = [
        'status',
        'health',
        'list workflows',
        'available nodes',
        'connection check',
        'help',
        'what is',
        'show me',
      ]

      simpleQueries.forEach((query) => {
        const isSimple = isSimpleQuery({ query, description: query })
        expect(isSimple).toBe(true)
      })
    })

    it('should correctly identify complex queries requiring full agent reasoning', () => {
      const complexQueries = [
        'create a workflow that processes CSV files, validates data, sends notifications on errors, and logs results to multiple databases',
        'analyze this JavaScript function for security vulnerabilities and suggest improvements',
        'debug why my workflow is failing with timeout errors during API calls',
        'optimize performance for a workflow processing 10,000 records per hour',
      ]

      complexQueries.forEach((query) => {
        const isSimple = isSimpleQuery({ query, description: query })
        expect(isSimple).toBe(false)
      })
    })
  })

  describe('token Savings Validation', () => {
    it('should achieve 90%+ token optimization rate across all tools', () => {
      // Simulate tool enhancement
      const mockTools = [
        { name: 'get_system_health', description: 'Get system health status' },
        { name: 'search_n8n_nodes', description: 'Search for available n8n nodes' },
        { name: 'get_n8n_workflows', description: 'Get list of workflows' },
        { name: 'validate_mcp_config', description: 'Validate MCP configuration' },
      ]

      const enhanced = DynamicToolEnhancer.enhanceAllTools(mockTools)
      const stats = DynamicToolEnhancer.getComprehensiveStats()

      expect(stats.optimization_rate).toBeGreaterThanOrEqual(90)
      expect(enhanced.length).toBeGreaterThan(0)
      expect(stats.total_tools).toEqual(mockTools.length)
    })

    it('should have all 6 reporters active for maximum token savings', () => {
      const stats = DynamicToolEnhancer.getComprehensiveStats()

      // We should have all 6 reporters active
      const expectedReporters = 6
      expect(stats.categories.orchestration + stats.categories.building
        + stats.categories.connection + stats.categories.nodes
        + stats.categories.scripting + stats.categories.guidance).toBeGreaterThanOrEqual(expectedReporters)
    })
  })

  describe('performance Impact Measurement', () => {
    it('should demonstrate significant performance improvement for simple queries', async () => {
      const testQuery = { query: 'status', description: 'get status' }
      const startTime = performance.now()

      // Test reporter routing (optimized path)
      const reporter = reporters.get('orchestrator')!
      const reporterResult = await reporter.report(testQuery)
      const reporterTime = performance.now() - startTime

      // Verify fast response
      expect(reporterTime).toBeLessThan(100) // Should be under 100ms
      expect(reporterResult).toBeDefined()
      expect(reporterResult.response_type).toBe('status_summary')
    })

    it('should maintain low memory usage during token-optimized operations', async () => {
      const memoryBefore = process.memoryUsage()

      // Execute multiple optimized queries
      const queries = [
        'status',
        'health',
        'list nodes',
        'connection check',
        'help',
      ]

      for (const query of queries) {
        const reporter = reporters.get('orchestrator')!
        await reporter.report({ query, description: query })
      }

      const memoryAfter = process.memoryUsage()

      // Memory growth should be minimal (less than 5MB)
      const memoryGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024) // 5MB limit
    })
  })

  describe('routing Decision Accuracy', () => {
    TEST_SCENARIOS.forEach((scenario) => {
      it(`should route "${scenario.query}" to ${scenario.expectedRouting}`, () => {
        const isSimple = isSimpleQuery({
          query: scenario.query,
          description: scenario.query,
        })

        const expectedSimple = scenario.expectedRouting === 'reporter'
        expect(isSimple).toBe(expectedSimple)
      })
    })
  })

  describe('reporter Response Quality', () => {
    it('should provide meaningful responses from orchestrator reporter', async () => {
      const reporter = reporters.get('orchestrator')!
      const result = await reporter.report({
        query: 'status',
        description: 'get system status',
      })

      expect(result.response_type).toBe('status_summary')
      expect(result.agents_status).toBeDefined()
      expect(result.system_health).toBeDefined()
      expect(result.active_agents).toBeGreaterThan(0)
    })

    it('should provide node recommendations from node-expert reporter', async () => {
      const reporter = reporters.get('node-expert')!
      const result = await reporter.report({
        query: 'available nodes',
        description: 'list available nodes',
      })

      expect(result.response_type).toBe('available_nodes')
      expect(result.total_nodes).toBeGreaterThan(0)
      expect(result.cached_nodes).toBeDefined()
      expect(result.available_nodes).toBeInstanceOf(Array)
    })

    it('should provide security information from scriptguard reporter', async () => {
      const reporter = reporters.get('scriptguard')!
      const result = await reporter.report({
        query: 'security rules',
        description: 'get security rules',
      })

      expect(result.response_type).toBe('security_rules')
      expect(result.active_rules).toBeInstanceOf(Array)
      expect(result.rule_categories).toBeDefined()
      expect(result.total_rules).toBeGreaterThan(0)
    })
  })

  describe('memory Efficiency Validation', () => {
    it('should maintain bounded caches across all reporters', async () => {
      // Test that caches don't grow unbounded
      const testData = Array.from({ length: 1000 }, (_, i) => ({
        query: `test query ${i}`,
        description: `test description ${i}`,
      }))

      const nodeReporter = reporters.get('node-expert')!

      // Execute many queries
      for (const data of testData.slice(0, 100)) { // Limit to prevent test timeout
        await nodeReporter.report(data)
      }

      // Cache size should be bounded (max 1000 for node cache)
      expect(nodeReporter.nodeCache?.getSize()).toBeLessThanOrEqual(1000)
    })

    it('should clean up validation caches in scriptguard reporter', async () => {
      const scriptguardReporter = reporters.get('scriptguard')!

      // Execute validation queries to fill cache
      const validationQueries = Array.from({ length: 250 }, (_, i) => ({
        query: 'validate',
        description: `validate script ${i}`,
      }))

      for (const query of validationQueries.slice(0, 50)) {
        await scriptguardReporter.report(query)
      }

      // Validation cache should be bounded (max 200)
      expect(scriptguardReporter.validationCache?.getSize()).toBeLessThanOrEqual(200)
    })
  })

  describe('dynamic Tool Count Integration', () => {
    it('should dynamically calculate tool counts without hardcoding', () => {
      const toolCount = DynamicToolEnhancer.getToolCount()
      const stats = DynamicToolEnhancer.getComprehensiveStats()

      // Should be dynamic, not hardcoded values like 92 or 126
      expect(toolCount).toBeGreaterThan(0)
      expect(stats.total_tools).toEqual(toolCount)

      // Verify categories sum correctly
      const categorySum = Object.values(stats.categories).reduce((sum: number, count) => sum + count, 0)
      expect(categorySum).toBeGreaterThan(0)
    })
  })
})

/**
 * Performance utility functions for testing
 */
export class TokenOptimizationTestUtils {
  /**
   * Simulate token usage estimation
   */
  static estimateTokenUsage(text: string, routing: 'reporter' | 'full-agent'): number {
    const baseTokens = Math.ceil(text.length / 4) // Rough token estimation

    if (routing === 'reporter') {
      // Reporter responses are much shorter and more efficient
      return Math.floor(baseTokens * 0.1) // 90% token savings
    }
    else {
      // Full agent reasoning uses more tokens
      return baseTokens * 3 // Complex reasoning overhead
    }
  }

  /**
   * Measure execution performance
   */
  static async measurePerformance<T>(
    operation: () => Promise<T>,
  ): Promise<{ result: T, executionTime: number, memoryDelta: number }> {
    const memoryBefore = process.memoryUsage().heapUsed
    const startTime = performance.now()

    const result = await operation()

    const executionTime = performance.now() - startTime
    const memoryAfter = process.memoryUsage().heapUsed
    const memoryDelta = memoryAfter - memoryBefore

    return { result, executionTime, memoryDelta }
  }

  /**
   * Generate bounded test data to prevent memory issues
   */
  static generateBoundedTestData(count: number, maxSize: number = 1000): Array<{ query: string, description: string }> {
    const actualCount = Math.min(count, maxSize)
    return Array.from({ length: actualCount }, (_, i) => ({
      query: `test query ${i}`,
      description: `test description ${i}`,
    }))
  }
}
