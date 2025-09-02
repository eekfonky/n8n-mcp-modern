/**
 * MCP Tool Invocation Tests - Critical Core Functionality
 * Tests all 10 dynamic agent tools and MCP protocol compliance
 */

import { strict as assert } from 'node:assert'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { DynamicAgentDB } from '../database/dynamic-agent-db.js'
import { createDynamicAgentTools } from '../tools/dynamic-agent-tools.js'
import { getAllTools, getDiscoveredToolsArray } from '../tools/index.js'

// Test helper to populate basic tools without requiring n8n API
async function initializeTestTools(dynamicAgentTools: any) {
  // Access the discovered tools array
  const discoveredTools = getDiscoveredToolsArray()

  // Clear existing tools
  discoveredTools.length = 0

  // Add basic connectivity tool
  discoveredTools.push({
    name: 'ping',
    description: 'Health check for n8n-MCP server',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  })

  // Add dynamic agent tools
  if (dynamicAgentTools) {
    const dynamicTools = dynamicAgentTools.getTools()
    for (const tool of dynamicTools) {
      discoveredTools.push(tool)
    }
  }

  // Add iterative workflow builder tool
  discoveredTools.push({
    name: 'build_workflow_iteratively',
    description: 'Interactive step-by-step workflow building with real-time validation and rollback capability',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start_session', 'add_node', 'connect_nodes', 'validate', 'rollback', 'complete_workflow'],
          description: 'Action to perform in the iterative workflow building process',
        },
      },
      required: ['action'],
    },
  })
}

describe('mCP Tool Invocation - Critical Core Tests', () => {
  let dynamicTools: any
  let db: DynamicAgentDB
  let testDbPath: string
  let allTools: any[]

  beforeAll(async () => {
    // Create isolated test database
    testDbPath = join(process.cwd(), 'test_mcp_tools.sqlite')

    try {
      await fs.unlink(testDbPath)
    }
    catch {
      // File doesn't exist, that's fine
    }

    // Initialize components
    db = new DynamicAgentDB(testDbPath)
    await db.initialize()
    dynamicTools = await createDynamicAgentTools()
    await initializeTestTools(dynamicTools)
    allTools = await getAllTools()
  })

  afterAll(async () => {
    await db.close()
    try {
      await fs.unlink(testDbPath)
    }
    catch {
      // Ignore cleanup errors
    }
  })

  describe('tool Registration & Discovery', () => {
    it('should expose all 10 critical dynamic agent tools', () => {
      const tools = dynamicTools.getTools()

      const requiredTools = [
        'store_agent_memory',
        'search_agent_memory',
        'get_memory_analytics',
        'create_agent_session',
        'update_agent_session',
        'get_session_analytics',
        'delegate_agent_task',
        'discover_knowledge',
        'get_agent_insights',
        'enable_agent_collaboration',
      ]

      assert.strictEqual(tools.length, 10, 'Should expose exactly 10 dynamic agent tools')

      for (const toolName of requiredTools) {
        const tool = tools.find(t => t.name === toolName)
        assert(tool, `Missing critical tool: ${toolName}`)
        assert(tool.description, `Tool ${toolName} should have description`)
        assert(tool.inputSchema, `Tool ${toolName} should have input schema`)
        assert.strictEqual(tool.inputSchema.type, 'object', `Tool ${toolName} should have object input schema`)
      }
    })

    it('should include MCP tools in global tool registry', async () => {
      assert(Array.isArray(allTools), 'getAllTools should return array')
      assert(allTools.length > 10, 'Should have dynamic tools plus others')

      // Check that key tools are present
      const toolNames = allTools.map(t => t.name)
      assert(toolNames.includes('ping'), 'Should include ping tool')
      assert(toolNames.includes('store_agent_memory'), 'Should include agent memory tool')
      assert(toolNames.includes('build_workflow_iteratively'), 'Should include workflow builder tool')
    })

    it('should have valid tool schemas for all tools', () => {
      const tools = dynamicTools.getTools()

      for (const tool of tools) {
        // Validate basic tool structure
        assert(typeof tool.name === 'string' && tool.name.length > 0, 'Tool name must be non-empty string')
        assert(typeof tool.description === 'string' && tool.description.length > 0, 'Tool description must be non-empty string')
        assert(typeof tool.inputSchema === 'object' && tool.inputSchema !== null, 'Tool must have input schema')

        // Validate schema structure
        assert.strictEqual(tool.inputSchema.type, 'object', 'Input schema must be object type')
        assert(typeof tool.inputSchema.properties === 'object', 'Schema must have properties')
        assert(Array.isArray(tool.inputSchema.required), 'Schema must specify required fields')
      }
    })
  })

  describe('tool Argument Validation', () => {
    it('should reject invalid arguments with proper error messages', async () => {
      const testCases = [
        {
          tool: 'store_agent_memory',
          args: {},
          expectedError: /agentName.*required/i,
        },
        {
          tool: 'search_agent_memory',
          args: { agentName: '' },
          expectedError: /query.*required/i,
        },
        {
          tool: 'create_agent_session',
          args: { agentName: 'test' },
          expectedError: /sessionType.*required/i,
        },
        {
          tool: 'delegate_agent_task',
          args: { fromAgent: 'test' },
          expectedError: /toAgent.*required/i,
        },
      ]

      for (const testCase of testCases) {
        try {
          await dynamicTools.handleToolCall(testCase.tool, testCase.args)
          assert.fail(`Tool ${testCase.tool} should have rejected invalid args`)
        }
        catch (error) {
          assert(testCase.expectedError.test(error.message), `Tool ${testCase.tool} should provide meaningful error message. Got: ${error.message}`)
        }
      }
    })

    it('should accept valid arguments and return success', async () => {
      const validCalls = [
        {
          tool: 'store_agent_memory',
          args: {
            agentName: 'validation-test',
            memoryType: 'test_pattern',
            content: 'Valid memory content for testing',
            tags: ['validation', 'test'],
          },
        },
        {
          tool: 'create_agent_session',
          args: {
            agentName: 'validation-test',
            sessionType: 'test_session',
            expirationHours: 1,
          },
        },
        {
          tool: 'delegate_agent_task',
          args: {
            fromAgent: 'n8n-orchestrator',
            toAgent: 'n8n-builder',
            taskType: 'validation_task',
            taskDescription: 'Test delegation for validation',
          },
        },
      ]

      for (const call of validCalls) {
        const result = await dynamicTools.handleToolCall(call.tool, call.args)
        assert(result.success === true, `Tool ${call.tool} should succeed with valid args`)
        assert(typeof result === 'object', `Tool ${call.tool} should return object result`)
      }
    })
  })

  describe('error Handling & Edge Cases', () => {
    it('should handle unknown tool calls gracefully', async () => {
      try {
        await dynamicTools.handleToolCall('nonexistent_tool', {})
        assert.fail('Should reject unknown tool')
      }
      catch (error) {
        assert(error.message.includes('Unknown dynamic agent tool'), 'Should provide clear error for unknown tool')
      }
    })

    it('should handle malformed arguments gracefully', async () => {
      const malformedCases = [
        { tool: 'store_agent_memory', args: null },
        { tool: 'store_agent_memory', args: 'not-an-object' },
        { tool: 'search_agent_memory', args: { agentName: null } },
        { tool: 'create_agent_session', args: { agentName: 123 } },
      ]

      for (const testCase of malformedCases) {
        try {
          await dynamicTools.handleToolCall(testCase.tool, testCase.args as any)
          assert.fail(`Tool ${testCase.tool} should reject malformed args`)
        }
        catch (error) {
          assert(error instanceof Error, 'Should throw proper Error object')
          assert(error.message.length > 0, 'Should provide error message')
        }
      }
    })

    it('should maintain consistent response format', async () => {
      const result = await dynamicTools.handleToolCall('store_agent_memory', {
        agentName: 'format-test',
        memoryType: 'response_format',
        content: 'Testing response format consistency',
        tags: ['format', 'test'],
      })

      // All successful responses should have success field
      assert(typeof result.success === 'boolean', 'Result should have boolean success field')
      assert(result.success === true, 'Successful calls should set success=true')

      // Check for common response fields
      assert(typeof result === 'object' && result !== null, 'Result should be object')
      assert(!Array.isArray(result), 'Result should not be array')
    })
  })

  describe('memory System Tool Integration', () => {
    it('should store and retrieve memories through MCP tools', async () => {
      // Store a memory
      const storeResult = await dynamicTools.handleToolCall('store_agent_memory', {
        agentName: 'integration-test',
        memoryType: 'integration_pattern',
        content: 'MCP tool integration pattern for testing end-to-end memory flow',
        tags: ['mcp', 'integration', 'memory'],
      })

      assert(storeResult.success === true, 'Memory storage should succeed')
      assert(typeof storeResult.memoryId === 'number', 'Should return memory ID')

      // Search for the memory
      const searchResult = await dynamicTools.handleToolCall('search_agent_memory', {
        agentName: 'integration-test',
        query: 'MCP tool integration pattern',
        limit: 5,
        minRelevance: 0.1, // Lower threshold for debugging
      })

      assert(searchResult.success === true, 'Memory search should succeed')
      assert(Array.isArray(searchResult.results), 'Search should return results array')
      assert(searchResult.results.length > 0, 'Should find stored memory')

      const foundMemory = searchResult.results[0]
      assert(foundMemory.content.includes('MCP tool integration'), 'Should find correct memory')
      assert(foundMemory.relevanceScore > 0, 'Should have relevance score')
    })

    it('should provide memory analytics through MCP tools', async () => {
      const analyticsResult = await dynamicTools.handleToolCall('get_memory_analytics', {
        agentName: 'integration-test',
      })

      assert(analyticsResult.success === true, 'Analytics should succeed')
      assert(typeof analyticsResult.analytics === 'object', 'Should return analytics object')
      assert(typeof analyticsResult.analytics.totalMemories === 'number', 'Should have memory count')
      assert(Array.isArray(analyticsResult.analytics.topTags), 'Should have tags array')
    })
  })

  describe('session Management Tool Integration', () => {
    it('should create and manage sessions through MCP tools', async () => {
      // Create session
      const createResult = await dynamicTools.handleToolCall('create_agent_session', {
        agentName: 'session-test',
        sessionType: 'mcp_testing',
        expirationHours: 2,
        initialData: { testType: 'mcp-integration' },
      })

      assert(createResult.success === true, 'Session creation should succeed')
      assert(typeof createResult.sessionId === 'string', 'Should return session ID')
      assert(createResult.sessionId.startsWith('sess_'), 'Session ID should have proper prefix')

      // Update session
      const updateResult = await dynamicTools.handleToolCall('update_agent_session', {
        sessionId: createResult.sessionId,
        updates: { progress: 'step-1', nodesAdded: 1 },
        operation: 'test_update',
      })

      assert(updateResult.success === true, 'Session update should succeed')

      // Get session analytics
      const analyticsResult = await dynamicTools.handleToolCall('get_session_analytics', {
        sessionId: createResult.sessionId,
      })

      assert(analyticsResult.success === true, 'Session analytics should succeed')
      assert(typeof analyticsResult.analytics === 'object', 'Should return analytics')
      assert(typeof analyticsResult.analytics.totalOperations === 'number', 'Should track operations')
    })
  })

  describe('agent Collaboration Tool Integration', () => {
    it('should enable collaboration through MCP tools', async () => {
      const collaborationResult = await dynamicTools.handleToolCall('enable_agent_collaboration', {
        primaryAgent: 'n8n-orchestrator',
        collaboratingAgents: ['n8n-builder', 'n8n-connector'],
        collaborationType: 'mcp_testing',
        sharedContext: { project: 'mcp-integration-test' },
      })

      assert(collaborationResult.success === true, 'Collaboration should succeed')
      assert(typeof collaborationResult.collaborationId === 'string', 'Should return collaboration ID')
      assert(Array.isArray(collaborationResult.childSessions), 'Should create child sessions')
      assert(collaborationResult.childSessions.length === 2, 'Should create sessions for each agent')
    })

    it('should handle task delegation through MCP tools', async () => {
      const delegationResult = await dynamicTools.handleToolCall('delegate_agent_task', {
        fromAgent: 'n8n-orchestrator',
        toAgent: 'n8n-scriptguard',
        taskType: 'validation_task',
        taskDescription: 'Validate JavaScript code patterns for MCP testing',
        complexity: 'medium',
        priority: 'high',
      })

      assert(delegationResult.success === true, 'Delegation should succeed')
      assert(typeof delegationResult.delegationId === 'number', 'Should return delegation ID')
      assert(delegationResult.fromAgent === 'n8n-orchestrator', 'Should preserve from agent')
      assert(delegationResult.toAgent === 'n8n-scriptguard', 'Should preserve to agent')
    })
  })

  describe('performance & Reliability', () => {
    it('should handle concurrent tool calls efficiently', async () => {
      const concurrentCalls = []

      // Create 5 concurrent memory operations
      for (let i = 0; i < 5; i++) {
        concurrentCalls.push(
          dynamicTools.handleToolCall('store_agent_memory', {
            agentName: `concurrent-test-${i}`,
            memoryType: 'performance_test',
            content: `Concurrent memory test ${i}`,
            tags: ['concurrent', 'performance', `test-${i}`],
          }),
        )
      }

      const results = await Promise.all(concurrentCalls)

      // All should succeed
      for (let i = 0; i < results.length; i++) {
        assert(results[i].success === true, `Concurrent call ${i} should succeed`)
        assert(typeof results[i].memoryId === 'number', `Call ${i} should return memory ID`)
      }
    })

    it('should maintain data consistency under load', async () => {
      // Store multiple related memories
      const memoryIds = []
      for (let i = 0; i < 3; i++) {
        const result = await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'consistency-test',
          memoryType: 'load_test',
          content: `Load test memory ${i} with consistent data patterns`,
          tags: ['load-test', 'consistency', `item-${i}`],
        })
        memoryIds.push(result.memoryId)
      }

      // Search should find all memories
      const searchResult = await dynamicTools.handleToolCall('search_agent_memory', {
        agentName: 'consistency-test',
        query: 'Load test memory',
        limit: 10,
        minRelevance: 0.1, // Lower threshold for debugging
      })

      assert(searchResult.success === true, 'Search should succeed under load')
      assert(searchResult.results.length >= 3, 'Should find all stored memories')

      // Verify data integrity
      for (const memory of searchResult.results) {
        assert(memory.content.includes('Load test memory'), 'Memory content should be intact')
        assert(memory.tags.includes('load-test'), 'Memory tags should be intact')
      }
    })
  })
})
