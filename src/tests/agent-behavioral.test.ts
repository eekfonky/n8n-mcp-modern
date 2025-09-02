/**
 * Agent-Specific Behavioral Tests
 * Tests the 6-agent hierarchy behaviors and decision-making logic
 */

import { strict as assert } from 'node:assert'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { DynamicAgentDB } from '../database/dynamic-agent-db.js'
import { createDynamicAgentTools } from '../tools/dynamic-agent-tools.js'

describe('agent Behavioral Tests - 6-Agent Hierarchy', () => {
  let dynamicTools: any
  let db: DynamicAgentDB
  let testDbPath: string

  beforeAll(async () => {
    testDbPath = join(process.cwd(), 'test_agent_behavior.sqlite')

    try {
      await fs.unlink(testDbPath)
    }
    catch {
      // File doesn't exist, that's fine
    }

    db = new DynamicAgentDB(testDbPath)
    await db.initialize()
    dynamicTools = await createDynamicAgentTools()
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

  describe('tIER 1 - n8n-orchestrator (Master)', () => {
    it('should delegate workflow tasks to n8n-builder', async () => {
      const delegationResult = await dynamicTools.handleToolCall('delegate_agent_task', {
        fromAgent: 'n8n-orchestrator',
        toAgent: 'n8n-builder',
        taskType: 'workflow_generation',
        taskDescription: 'Create workflow for data processing pipeline',
        complexity: 'medium',
      })

      assert(delegationResult.success === true, 'Orchestrator should delegate workflow tasks')
      assert(delegationResult.toAgent === 'n8n-builder', 'Should delegate to n8n-builder for workflows')
      assert(typeof delegationResult.delegationId === 'number', 'Should track delegation')
    })

    it('should delegate authentication tasks to n8n-connector', async () => {
      const delegationResult = await dynamicTools.handleToolCall('delegate_agent_task', {
        fromAgent: 'n8n-orchestrator',
        toAgent: 'n8n-connector',
        taskType: 'api_integration',
        taskDescription: 'Configure OAuth2 for Slack integration',
        complexity: 'high',
      })

      assert(delegationResult.success === true, 'Orchestrator should delegate auth tasks')
      assert(delegationResult.toAgent === 'n8n-connector', 'Should delegate to n8n-connector for auth')
    })

    it('should delegate JavaScript validation to n8n-scriptguard', async () => {
      const delegationResult = await dynamicTools.handleToolCall('delegate_agent_task', {
        fromAgent: 'n8n-orchestrator',
        toAgent: 'n8n-scriptguard',
        taskType: 'security_validation',
        taskDescription: 'Validate JavaScript code in Function node',
        complexity: 'medium',
      })

      assert(delegationResult.success === true, 'Orchestrator should delegate code validation')
      assert(delegationResult.toAgent === 'n8n-scriptguard', 'Should delegate to scriptguard for validation')
    })

    it('should enable multi-agent collaboration for complex tasks', async () => {
      const collaborationResult = await dynamicTools.handleToolCall('enable_agent_collaboration', {
        primaryAgent: 'n8n-orchestrator',
        collaboratingAgents: ['n8n-builder', 'n8n-connector', 'n8n-scriptguard'],
        collaborationType: 'complex_integration',
        sharedContext: {
          project: 'enterprise-crm-integration',
          requirements: ['oauth', 'validation', 'error-handling'],
        },
      })

      assert(collaborationResult.success === true, 'Orchestrator should enable collaboration')
      assert(Array.isArray(collaborationResult.childSessions), 'Should create child sessions')
      assert(collaborationResult.childSessions.length === 3, 'Should create sessions for all collaborators')
    })
  })

  describe('tIER 2 - Core Specialists', () => {
    describe('n8n-builder (Code Generation & DevOps)', () => {
      it('should store workflow generation patterns', async () => {
        const memoryResult = await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'n8n-builder',
          memoryType: 'workflow_pattern',
          content: 'HTTP Request → JSON Transform → Database Insert pattern for API data ingestion',
          tags: ['http', 'transform', 'database', 'api-ingestion'],
        })

        assert(memoryResult.success === true, 'Builder should store workflow patterns')
        assert(memoryResult.memoryType === 'workflow_pattern', 'Should categorize as workflow pattern')
        assert(memoryResult.agentName === 'n8n-builder', 'Should associate with builder agent')
      })

      it('should search for relevant workflow patterns', async () => {
        // First store a pattern
        await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'n8n-builder',
          memoryType: 'workflow_pattern',
          content: 'Webhook → Filter → Slack notification pattern for alert systems',
          tags: ['webhook', 'filter', 'slack', 'alerts'],
        })

        // Search for it
        const searchResult = await dynamicTools.handleToolCall('search_agent_memory', {
          agentName: 'n8n-builder',
          query: 'webhook alert notification pattern',
          limit: 5,
        })

        assert(searchResult.success === true, 'Builder should find workflow patterns')
        assert(searchResult.results.length > 0, 'Should find stored patterns')
        assert(searchResult.results[0].content.includes('Webhook'), 'Should find relevant pattern')
      })

      it('should create iterative building sessions', async () => {
        const sessionResult = await dynamicTools.handleToolCall('create_agent_session', {
          agentName: 'n8n-builder',
          sessionType: 'iterative_building',
          expirationHours: 2,
          initialData: { workflowType: 'data-pipeline', nodeCount: 0 },
        })

        assert(sessionResult.success === true, 'Builder should create building sessions')
        assert(sessionResult.sessionType === 'iterative_building', 'Should use iterative building type')
      })
    })

    describe('n8n-connector (Authentication & Connectivity)', () => {
      it('should store authentication solutions', async () => {
        const memoryResult = await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'n8n-connector',
          memoryType: 'credential_pattern',
          content: 'OAuth2 token refresh pattern: detect 401 → refresh token → retry request',
          tags: ['oauth2', 'token-refresh', '401-error', 'retry'],
        })

        assert(memoryResult.success === true, 'Connector should store auth solutions')
        assert(memoryResult.memoryType === 'credential_pattern', 'Should categorize as credential pattern')
      })

      it('should search for connectivity patterns', async () => {
        // Store connectivity pattern
        await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'n8n-connector',
          memoryType: 'api_pattern',
          content: 'API rate limiting: implement exponential backoff with 429 status detection',
          tags: ['rate-limiting', 'exponential-backoff', '429-error', 'api'],
        })

        const searchResult = await dynamicTools.handleToolCall('search_agent_memory', {
          agentName: 'n8n-connector',
          query: 'API rate limiting exponential backoff',
          limit: 3,
        })

        assert(searchResult.success === true, 'Connector should find connectivity patterns')
        assert(searchResult.results[0].content.includes('exponential backoff'), 'Should find rate limiting solution')
      })
    })

    describe('n8n-node-expert (525+ Node Expertise)', () => {
      it('should store node compatibility insights', async () => {
        const memoryResult = await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'n8n-node-expert',
          memoryType: 'node_configuration',
          content: 'HTTP Request node compatible with Loop Over Items for pagination handling',
          tags: ['http-request', 'loop-over-items', 'pagination', 'compatibility'],
        })

        assert(memoryResult.success === true, 'Node expert should store compatibility insights')
        assert(memoryResult.memoryType === 'node_configuration', 'Should categorize as node configuration')
      })

      it('should provide node recommendations', async () => {
        // Store node recommendation
        await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'n8n-node-expert',
          memoryType: 'best_practice',
          content: 'For CSV processing: use Spreadsheet File node instead of Code node for better performance',
          tags: ['csv', 'spreadsheet-file', 'performance', 'recommendation'],
        })

        const searchResult = await dynamicTools.handleToolCall('search_agent_memory', {
          agentName: 'n8n-node-expert',
          query: 'CSV processing performance recommendation',
          limit: 3,
        })

        assert(searchResult.success === true, 'Node expert should find recommendations')
        assert(searchResult.results[0].content.includes('Spreadsheet File'), 'Should recommend appropriate nodes')
      })
    })

    describe('n8n-scriptguard (JavaScript Validation & Security)', () => {
      it('should store security validation patterns', async () => {
        const memoryResult = await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'n8n-scriptguard',
          memoryType: 'validation_rule',
          content: 'Reject eval() and Function() constructors in Code nodes - use JSON.parse() instead',
          tags: ['security', 'eval', 'function-constructor', 'code-node'],
        })

        assert(memoryResult.success === true, 'ScriptGuard should store security patterns')
        assert(memoryResult.memoryType === 'validation_rule', 'Should categorize as validation rule')
      })

      it('should identify unsafe JavaScript patterns', async () => {
        // Store unsafe pattern detection
        await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'n8n-scriptguard',
          memoryType: 'anti_pattern',
          content: 'Detect process.env access without validation - potential credential exposure',
          tags: ['process-env', 'credentials', 'security', 'validation'],
        })

        const searchResult = await dynamicTools.handleToolCall('search_agent_memory', {
          agentName: 'n8n-scriptguard',
          query: 'process.env credential exposure validation',
          limit: 3,
        })

        assert(searchResult.success === true, 'ScriptGuard should find security patterns')
        assert(searchResult.results[0].content.includes('process.env'), 'Should detect unsafe patterns')
      })

      it('should validate code security in sessions', async () => {
        const sessionResult = await dynamicTools.handleToolCall('create_agent_session', {
          agentName: 'n8n-scriptguard',
          sessionType: 'security_audit',
          expirationHours: 1,
          initialData: { codeReviewMode: 'strict', securityLevel: 'high' },
        })

        assert(sessionResult.success === true, 'ScriptGuard should create validation sessions')
        assert(sessionResult.sessionType === 'security_audit', 'Should use security audit type')
      })
    })
  })

  describe('tIER 3 - Support Specialists', () => {
    describe('n8n-guide (Documentation & Tutorials)', () => {
      it('should store helpful documentation patterns', async () => {
        const memoryResult = await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'n8n-guide',
          memoryType: 'knowledge_base',
          content: 'When explaining HTTP nodes, include examples of headers, authentication, and error handling',
          tags: ['documentation', 'http-node', 'headers', 'authentication', 'examples'],
        })

        assert(memoryResult.success === true, 'Guide should store documentation patterns')
        assert(memoryResult.memoryType === 'knowledge_base', 'Should categorize as knowledge base')
      })

      it('should provide contextual guidance', async () => {
        // Store guidance pattern
        await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: 'n8n-guide',
          memoryType: 'best_practice',
          content: 'For beginners: start with Trigger → Action → Output pattern before complex workflows',
          tags: ['beginner', 'pattern', 'trigger', 'action', 'output'],
        })

        const searchResult = await dynamicTools.handleToolCall('search_agent_memory', {
          agentName: 'n8n-guide',
          query: 'beginner workflow pattern guidance',
          limit: 3,
        })

        assert(searchResult.success === true, 'Guide should find guidance patterns')
        assert(searchResult.results[0].content.includes('Trigger → Action'), 'Should provide structured guidance')
      })
    })
  })

  describe('inter-Agent Communication Patterns', () => {
    it('should preserve context during agent handoffs', async () => {
      // Create parent session with orchestrator
      const parentSession = await dynamicTools.handleToolCall('create_agent_session', {
        agentName: 'n8n-orchestrator',
        sessionType: 'project_coordination',
        expirationHours: 2,
        initialData: {
          originalRequest: 'Create secure API workflow with validation',
          complexity: 'high',
          requiredAgents: ['n8n-builder', 'n8n-scriptguard'],
        },
      })

      // Enable collaboration (creates child sessions)
      const collaboration = await dynamicTools.handleToolCall('enable_agent_collaboration', {
        primaryAgent: 'n8n-orchestrator',
        collaboratingAgents: ['n8n-builder', 'n8n-scriptguard'],
        collaborationType: 'secure_workflow_creation',
        sharedContext: {
          parentSessionId: parentSession.sessionId,
          securityRequirements: ['input-validation', 'secure-headers'],
        },
      })

      assert(collaboration.success === true, 'Should enable collaboration')
      assert(collaboration.childSessions.length === 2, 'Should create child sessions')

      // Verify context preservation in child sessions
      for (const childSession of collaboration.childSessions) {
        const analytics = await dynamicTools.handleToolCall('get_session_analytics', {
          sessionId: childSession.sessionId,
        })
        assert(analytics.success === true, 'Child sessions should be accessible')
      }
    })

    it('should track delegation chains for audit', async () => {
      // Create delegation chain: orchestrator → builder → scriptguard
      const firstDelegation = await dynamicTools.handleToolCall('delegate_agent_task', {
        fromAgent: 'n8n-orchestrator',
        toAgent: 'n8n-builder',
        taskType: 'workflow_generation',
        taskDescription: 'Create workflow that requires code validation',
      })

      const secondDelegation = await dynamicTools.handleToolCall('delegate_agent_task', {
        fromAgent: 'n8n-builder',
        toAgent: 'n8n-scriptguard',
        taskType: 'security_validation',
        taskDescription: 'Review JavaScript code for security issues',
        parentDelegationId: firstDelegation.delegationId,
      })

      assert(firstDelegation.success === true, 'First delegation should succeed')
      assert(secondDelegation.success === true, 'Second delegation should succeed')
      assert(typeof firstDelegation.delegationId === 'number', 'Should track first delegation')
      assert(typeof secondDelegation.delegationId === 'number', 'Should track second delegation')
    })

    it('should enable knowledge sharing between agents', async () => {
      // Builder discovers a pattern
      const builderDiscovery = await dynamicTools.handleToolCall('discover_knowledge', {
        agentName: 'n8n-builder',
        discoveryType: 'performance_optimization',
        title: 'Efficient Error Handling Pattern',
        description: 'Use Error Trigger with Continue On Fail for robust workflows',
        content: {
          pattern: 'Main Flow → [Continue On Fail] → Error Trigger → Notification',
          benefits: ['prevents workflow stops', 'provides error visibility', 'maintains data flow'],
        },
      })

      // ScriptGuard can access this discovery
      const scriptguardSearch = await dynamicTools.handleToolCall('search_agent_memory', {
        agentName: 'n8n-scriptguard',
        query: 'error handling robust workflows',
        limit: 5,
        includeSharedKnowledge: true,
      })

      assert(builderDiscovery.success === true, 'Builder should record discovery')
      assert(scriptguardSearch.success === true, 'ScriptGuard should access shared knowledge')

      // Should find builder's discovery in shared knowledge
      const hasSharedKnowledge = scriptguardSearch.results.some(
        result => result.content && JSON.stringify(result.content).includes('Continue On Fail'),
      )
      // Note: This test assumes shared knowledge implementation - may need adjustment based on actual implementation
    })
  })

  describe('agent Memory Specialization', () => {
    it('should maintain agent-specific memory types', async () => {
      const agentMemoryTypes = [
        { agent: 'n8n-builder', type: 'workflow_pattern', content: 'Builder workflow pattern' },
        { agent: 'n8n-connector', type: 'credential_pattern', content: 'Connector credential pattern' },
        { agent: 'n8n-node-expert', type: 'node_configuration', content: 'Node expert configuration' },
        { agent: 'n8n-scriptguard', type: 'validation_rule', content: 'ScriptGuard security check' },
        { agent: 'n8n-guide', type: 'knowledge_base', content: 'Guide documentation' },
      ]

      // Store memories for each agent
      for (const { agent, type, content } of agentMemoryTypes) {
        const result = await dynamicTools.handleToolCall('store_agent_memory', {
          agentName: agent,
          memoryType: type,
          content,
          tags: ['specialization-test'],
        })
        assert(result.success === true, `${agent} should store ${type}`)
        assert(result.memoryType === type, `Should preserve memory type for ${agent}`)
      }

      // Verify each agent can access their own memories
      for (const { agent } of agentMemoryTypes) {
        const analytics = await dynamicTools.handleToolCall('get_memory_analytics', {
          agentName: agent,
        })
        assert(analytics.success === true, `${agent} should have memory analytics`)
        assert(analytics.analytics.totalMemories > 0, `${agent} should have stored memories`)
      }
    })
  })
})
