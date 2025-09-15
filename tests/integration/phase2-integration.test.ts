/**
 * Phase 2 Integration Tests - Dynamic Agent Infrastructure
 * Tests memory system, session management, and agent collaboration
 */

import { strict as assert } from 'node:assert'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { AgentMemorySystem } from '../agents/memory-system.js'
import { AgentSessionManager } from '../agents/session-manager.js'
import { DynamicAgentDB } from '../database/dynamic-agent-db.js'
import { createDynamicAgentTools } from '../tools/dynamic-agent-tools.js'

describe('phase 2: Dynamic Agent Infrastructure Integration Tests', () => {
  let db: DynamicAgentDB
  let memorySystem: AgentMemorySystem
  let sessionManager: AgentSessionManager
  let dynamicTools: any
  let testDbPath: string

  beforeAll(async () => {
    // Create test database
    testDbPath = join(process.cwd(), 'test_dynamic_agent_db.sqlite')

    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath)
    }
    catch {
      // File doesn't exist, that's fine
    }

    // Initialize components
    db = new DynamicAgentDB(testDbPath)
    await db.initialize()

    memorySystem = new AgentMemorySystem(db)
    sessionManager = new AgentSessionManager(db)
    dynamicTools = await createDynamicAgentTools()
  })

  afterAll(async () => {
    // Cleanup
    await sessionManager.shutdown()
    await db.close()

    try {
      await fs.unlink(testDbPath)
    }
    catch {
      // Ignore cleanup errors
    }
  })

  describe('database Infrastructure', () => {
    it('should initialize database with all required tables', async () => {
      const tables = await db.getTables()

      const requiredTables = [
        'agent_memories',
        'memory_relationships',
        'agent_sessions',
        'session_operations',
        'shared_discoveries',
        'discovery_relationships',
        'delegation_history',
        'delegation_routing',
        'agent_performance',
        'system_analytics',
      ]

      for (const table of requiredTables) {
        assert(tables.includes(table), `Table ${table} should exist`)
      }
    })

    it('should have proper indexes for performance', async () => {
      const indexes = await db.getIndexes()

      // Check for critical indexes
      assert(indexes.some(idx => idx.includes('agent_name')), 'Should have agent_name indexes')
      assert(indexes.some(idx => idx.includes('session_id')), 'Should have session_id indexes')
      assert(indexes.some(idx => idx.includes('relevance')), 'Should have relevance indexes')
    })
  })

  describe('agent Memory System', () => {
    it('should store and retrieve memories', async () => {
      const memoryId = await memorySystem.storeMemory({
        agentName: 'test-agent',
        memoryType: 'workflow_pattern',
        content: 'HTTP Request → Set Variables → Conditional Logic is a common pattern for API processing',
        tags: ['http', 'api', 'conditional'],
      })

      assert(typeof memoryId === 'number', 'Should return numeric memory ID')
      assert(memoryId > 0, 'Memory ID should be positive')
    })

    it('should perform semantic search', async () => {
      // Store a test memory
      await memorySystem.storeMemory({
        agentName: 'test-agent',
        memoryType: 'error_solution',
        content: 'When n8n HTTP Request returns 429 rate limit, implement exponential backoff with Wait node',
        tags: ['http', 'rate-limiting', 'error-handling'],
      })

      // Search for related memories
      const results = await memorySystem.searchMemories(
        'test-agent',
        'HTTP rate limit error handling',
        { minRelevance: 0.3, limit: 5 },
      )

      assert(Array.isArray(results), 'Should return array of results')
      assert(results.length > 0, 'Should find relevant memories')
      assert(results[0]!.relevanceScore >= 0.3, 'Should meet relevance threshold')
    })

    it('should create memory relationships', async () => {
      // Store two related memories
      const memory1Id = await memorySystem.storeMemory({
        agentName: 'test-agent',
        memoryType: 'workflow_pattern',
        content: 'Use HTTP Request node to call external APIs',
        tags: ['http', 'api'],
      })

      const memory2Id = await memorySystem.storeMemory({
        agentName: 'test-agent',
        memoryType: 'error_solution',
        content: 'Handle API timeouts with retry logic',
        tags: ['http', 'error-handling', 'retry'],
      })

      // Link the memories
      await memorySystem.linkMemories(
        memory1Id,
        memory2Id,
        'builds_on',
        0.8,
        'test-system',
      )

      // Get related memories
      const related = await memorySystem.getRelatedMemories(memory1Id, 1, 0.5)
      assert(related.length > 0, 'Should find related memories')
    })

    it('should get memory analytics', async () => {
      const analytics = await memorySystem.getMemoryAnalytics('test-agent')

      assert(typeof analytics.totalMemories === 'number', 'Should have total memory count')
      assert(typeof analytics.averageRelevance === 'number', 'Should have average relevance')
      assert(typeof analytics.memoryTypeDistribution === 'object', 'Should have type distribution')
      assert(Array.isArray(analytics.topTags), 'Should have top tags array')
      assert(typeof analytics.relationshipStats === 'object', 'Should have relationship stats')
    })
  })

  describe('session Management System', () => {
    it('should create and manage sessions', async () => {
      const sessionId = await sessionManager.createSession({
        agentName: 'test-builder',
        sessionType: 'iterative_building',
        expirationHours: 1,
        initialState: { step: 1, nodeCount: 0 },
        initialContext: { workflowType: 'api-integration' },
      })

      assert(typeof sessionId === 'string', 'Should return string session ID')
      assert(sessionId.startsWith('sess_'), 'Session ID should have proper prefix')

      // Retrieve the session
      const session = await sessionManager.getSession(sessionId)
      assert(session !== null, 'Should retrieve created session')
      assert(session!.agentName === 'test-builder', 'Should have correct agent name')
      assert(session!.sessionType === 'iterative_building', 'Should have correct session type')
    })

    it('should update session state with encryption', async () => {
      const sessionId = await sessionManager.createSession({
        agentName: 'test-builder',
        sessionType: 'collaboration',
        expirationHours: 1,
        initialState: { nodes: [] },
      })

      const success = await sessionManager.updateSession({
        sessionId,
        stateUpdates: { nodes: ['http-request'], currentStep: 2 },
        contextUpdates: { lastOperation: 'add-node' },
        operationType: 'node_added',
        operationData: { nodeType: 'http-request' },
      })

      assert(success === true, 'Should successfully update session')

      // Verify updates
      const session = await sessionManager.getSession(sessionId)
      assert(session !== null, 'Should retrieve updated session')

      const state = JSON.parse(session!.stateData || '{}')
      assert(Array.isArray(state.nodes), 'Should have nodes array')
      assert(state.nodes.includes('http-request'), 'Should include added node')
    })

    it('should create child sessions', async () => {
      const parentSessionId = await sessionManager.createSession({
        agentName: 'test-orchestrator',
        sessionType: 'collaboration',
        expirationHours: 2,
        initialState: { project: 'enterprise-integration' },
      })

      const childSessionId = await sessionManager.createChildSession(
        parentSessionId,
        'test-builder',
        'delegation',
        { inheritedProject: 'enterprise-integration', role: 'workflow-builder' },
      )

      assert(typeof childSessionId === 'string', 'Should return child session ID')
      assert(childSessionId !== parentSessionId, 'Child should have different ID')

      const childSession = await sessionManager.getSession(childSessionId)
      assert(childSession !== null, 'Should retrieve child session')
      assert(childSession!.parentSessionId === parentSessionId, 'Should reference parent')
    })

    it('should get session analytics', async () => {
      const sessionId = await sessionManager.createSession({
        agentName: 'test-agent',
        sessionType: 'learning',
        expirationHours: 1,
      })

      // Perform some operations
      await sessionManager.updateSession({
        sessionId,
        stateUpdates: { step: 1 },
        operationType: 'test_operation',
      })

      const analytics = await sessionManager.getSessionAnalytics(sessionId)
      assert(analytics !== null, 'Should get session analytics')
      assert(analytics!.totalOperations >= 1, 'Should track operations')
      assert(typeof analytics!.sessionDurationMinutes === 'number', 'Should calculate duration')
    })
  })

  describe('dynamic Agent Tools Integration', () => {
    it('should provide all required MCP tools', () => {
      const tools = dynamicTools.getTools()

      const requiredToolNames = [
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

      for (const toolName of requiredToolNames) {
        assert(
          tools.some(tool => tool.name === toolName),
          `Should provide ${toolName} tool`,
        )
      }
    })

    it('should handle store_agent_memory tool calls', async () => {
      const result = await dynamicTools.handleToolCall('store_agent_memory', {
        agentName: 'integration-test',
        memoryType: 'workflow_pattern',
        content: 'Webhook → Transform Data → Database Insert is effective for real-time data ingestion',
        tags: ['webhook', 'transform', 'database'],
        expiresIn: 24, // 24 hours
      })

      assert(result.success === true, 'Should successfully store memory')
      assert(typeof result.memoryId === 'number', 'Should return memory ID')
      assert(result.memoryType === 'workflow_pattern', 'Should preserve memory type')
    })

    it('should handle search_agent_memory tool calls', async () => {
      // First store a memory to search for
      await dynamicTools.handleToolCall('store_agent_memory', {
        agentName: 'integration-test',
        memoryType: 'error_solution',
        content: 'When Slack API returns 429, use exponential backoff with maximum 5 retries',
        tags: ['slack', 'api', 'rate-limiting', 'retry'],
      })

      // Search for it
      const result = await dynamicTools.handleToolCall('search_agent_memory', {
        agentName: 'integration-test',
        query: 'Slack API rate limiting retry strategy',
        limit: 5,
        minRelevance: 0.3,
      })

      assert(result.success === true, 'Should successfully search memories')
      assert(Array.isArray(result.results), 'Should return results array')
      assert(result.resultsCount >= 0, 'Should report results count')
    })

    it('should handle create_agent_session tool calls', async () => {
      const result = await dynamicTools.handleToolCall('create_agent_session', {
        agentName: 'integration-test',
        sessionType: 'iterative_building',
        expirationHours: 2,
        initialData: { projectType: 'api-integration', complexity: 'medium' },
      })

      assert(result.success === true, 'Should successfully create session')
      assert(typeof result.sessionId === 'string', 'Should return session ID')
      assert(result.agentName === 'integration-test', 'Should preserve agent name')
    })

    it('should handle delegation tool calls', async () => {
      const result = await dynamicTools.handleToolCall('delegate_agent_task', {
        fromAgent: 'n8n-orchestrator',
        toAgent: 'n8n-builder',
        taskType: 'workflow_generation',
        taskDescription: 'Create a workflow for processing customer feedback forms',
        complexity: 'medium',
      })

      assert(result.success === true, 'Should successfully delegate task')
      assert(typeof result.delegationId === 'number', 'Should return delegation ID')
      assert(result.fromAgent === 'n8n-orchestrator', 'Should preserve from agent')
      assert(result.toAgent === 'n8n-builder', 'Should preserve to agent')
    })

    it('should handle knowledge discovery tool calls', async () => {
      const result = await dynamicTools.handleToolCall('discover_knowledge', {
        agentName: 'integration-test',
        discoveryType: 'best_practice',
        title: 'Efficient API Pagination Pattern',
        description: 'Use HTTP Request with Loop Over Items for efficient API pagination handling',
        content: {
          pattern: 'HTTP Request → Loop Over Items → Set Variables',
          nodes: ['HttpRequest', 'LoopOverItems', 'Set'],
          benefits: ['memory efficient', 'handles large datasets', 'automatic pagination'],
        },
        nodeTypes: ['n8n-nodes-base.httpRequest', 'n8n-nodes-base.loopOverItems'],
      })

      assert(result.success === true, 'Should successfully record discovery')
      assert(typeof result.discoveryId === 'number', 'Should return discovery ID')
      assert(result.discoveryType === 'best_practice', 'Should preserve discovery type')
    })

    it('should handle collaboration enablement tool calls', async () => {
      const result = await dynamicTools.handleToolCall('enable_agent_collaboration', {
        primaryAgent: 'n8n-orchestrator',
        collaboratingAgents: ['n8n-builder', 'n8n-connector', 'n8n-scriptguard'],
        collaborationType: 'workflow_design',
        sharedContext: {
          project: 'enterprise-crm-integration',
          requirements: ['security', 'scalability', 'monitoring'],
        },
      })

      assert(result.success === true, 'Should successfully enable collaboration')
      assert(typeof result.collaborationId === 'string', 'Should return collaboration ID')
      assert(Array.isArray(result.childSessions), 'Should create child sessions')
      assert(result.childSessions.length === 3, 'Should create session for each collaborating agent')
    })
  })

  describe('end-to-End Workflow Scenarios', () => {
    it('should support iterative workflow building with memory', async () => {
      // 1. Search memories for similar patterns
      const memorySearch = await dynamicTools.handleToolCall('search_agent_memory', {
        agentName: 'n8n-builder',
        query: 'HTTP API workflow patterns',
        limit: 3,
      })

      // 2. Create session for iterative building
      const sessionResult = await dynamicTools.handleToolCall('create_agent_session', {
        agentName: 'n8n-builder',
        sessionType: 'iterative_building',
        initialData: {
          workflowType: 'api-integration',
          inspiration: memorySearch.results || [],
        },
      })

      assert(sessionResult.success === true, 'Should create building session')

      // 3. Update session with progress
      const updateResult = await dynamicTools.handleToolCall('update_agent_session', {
        sessionId: sessionResult.sessionId,
        updates: {
          nodesAdded: ['HttpRequest', 'Set'],
          currentStep: 'validation',
        },
        operation: 'add_validation_node',
      })

      assert(updateResult.success === true, 'Should update session')

      // 4. Store successful pattern as memory
      const memoryResult = await dynamicTools.handleToolCall('store_agent_memory', {
        agentName: 'n8n-builder',
        memoryType: 'workflow_pattern',
        content: 'HTTP Request → Set Variables → Validation workflow completed successfully',
        tags: ['http', 'validation', 'successful-build'],
      })

      assert(memoryResult.success === true, 'Should store learned pattern')
    })

    it('should support agent collaboration scenario', async () => {
      // 1. Enable collaboration
      const collaboration = await dynamicTools.handleToolCall('enable_agent_collaboration', {
        primaryAgent: 'n8n-orchestrator',
        collaboratingAgents: ['n8n-builder', 'n8n-connector'],
        collaborationType: 'problem_solving',
        sharedContext: { issue: 'API authentication failure' },
      })

      assert(collaboration.success === true, 'Should enable collaboration')

      // 2. Each agent contributes knowledge
      await dynamicTools.handleToolCall('store_agent_memory', {
        agentName: 'n8n-connector',
        memoryType: 'error_solution',
        content: 'OAuth token expiration causes 401 errors - implement refresh token logic',
        tags: ['oauth', 'authentication', 'error-401'],
      })

      await dynamicTools.handleToolCall('store_agent_memory', {
        agentName: 'n8n-builder',
        memoryType: 'workflow_pattern',
        content: 'Add HTTP Request with retry logic for authentication failures',
        tags: ['http', 'retry', 'authentication'],
      })

      // 3. Discover and share knowledge
      const discovery = await dynamicTools.handleToolCall('discover_knowledge', {
        agentName: 'n8n-orchestrator',
        discoveryType: 'error_solution',
        title: 'OAuth Authentication Failure Resolution',
        description: 'Comprehensive solution for OAuth token refresh and retry logic',
        content: {
          problem: 'OAuth token expiration',
          solution: 'Implement refresh token flow with retry mechanism',
          implementation: ['detect 401 error', 'refresh OAuth token', 'retry original request'],
        },
      })

      assert(discovery.success === true, 'Should record collaborative discovery')
    })
  })

  describe('performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations = []

      // Create multiple concurrent memory storage operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          dynamicTools.handleToolCall('store_agent_memory', {
            agentName: `concurrent-test-${i}`,
            memoryType: 'performance_insight',
            content: `Performance test memory ${i} with concurrent operations`,
            tags: ['performance', 'concurrent', `test-${i}`],
          }),
        )
      }

      const results = await Promise.all(operations)

      // All operations should succeed
      for (const result of results) {
        assert(result.success === true, 'All concurrent operations should succeed')
      }
    })

    it('should maintain memory relevance over time', async () => {
      // Store memory with high relevance
      const memoryResult = await dynamicTools.handleToolCall('store_agent_memory', {
        agentName: 'relevance-test',
        memoryType: 'workflow_pattern',
        content: 'High-value workflow pattern for testing relevance decay',
        tags: ['high-value', 'testing'],
      })

      // Strengthen the memory through usage
      await memorySystem.strengthenMemory(memoryResult.memoryId, 1.2)

      // Search should find it with high relevance
      const searchResult = await dynamicTools.handleToolCall('search_agent_memory', {
        agentName: 'relevance-test',
        query: 'high value workflow pattern testing',
        limit: 5,
      })

      assert(searchResult.success === true, 'Should find strengthened memory')
      assert(searchResult.results.length > 0, 'Should return results')
      assert(
        searchResult.results[0]!.relevanceScore >= 0.7,
        'Should have high relevance score',
      )
    })
  })
})
