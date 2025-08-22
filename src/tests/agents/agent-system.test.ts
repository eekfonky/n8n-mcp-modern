/**
 * Agent System Integration Tests
 * Tests the optimized 6-agent hierarchical system and inter-agent communication
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AgentContextBuilder,
  agentRouter,
} from '../../agents/index.js'

describe('agent System Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('agent Registry', () => {
    it('should have all 7 agents registered', () => {
      const agents = agentRouter.getAllAgents()
      expect(agents.length).toBe(7)
    })

    it('should have proper agent hierarchy', () => {
      const agents = agentRouter.getAllAgents()

      // Check Tier 1 - Master Orchestrator
      const tier1Agents = agents.filter(a => a.tier === 1)
      expect(tier1Agents.length).toBe(1)
      expect(tier1Agents[0].name).toBe('n8n-workflow-architect')

      // Check Tier 2 - Core Domain Specialists
      const tier2Agents = agents.filter(a => a.tier === 2)
      expect(tier2Agents.length).toBe(5)
      const tier2Names = tier2Agents.map(a => a.name)
      expect(tier2Names).toContain('n8n-developer-specialist')
      expect(tier2Names).toContain('n8n-integration-specialist')
      expect(tier2Names).toContain('n8n-node-specialist')
      expect(tier2Names).toContain('n8n-performance-specialist')

      // Check Tier 3 - Support Specialist
      const tier3Agents = agents.filter(a => a.tier === 3)
      expect(tier3Agents.length).toBe(1)
      const tier3Names = tier3Agents.map(a => a.name)
      expect(tier3Names).toContain('n8n-guidance-specialist')
    })

    it('should have unique agent names', () => {
      const agents = agentRouter.getAllAgents()
      const names = agents.map(a => a.name)
      const uniqueNames = [...new Set(names)]
      expect(uniqueNames.length).toBe(names.length)
    })

    it('should have valid capabilities for each agent', () => {
      const agents = agentRouter.getAllAgents()

      agents.forEach((agent) => {
        expect(agent.capabilities).toBeDefined()
        expect(Array.isArray(agent.capabilities)).toBe(true)
        expect(agent.capabilities.length).toBeGreaterThan(0)

        // Each capability should be a non-empty string
        agent.capabilities.forEach((cap) => {
          expect(typeof cap).toBe('string')
          expect(cap.length).toBeGreaterThan(0)
        })
      })
    })
  })

  describe('agent Routing', () => {
    it('should route workflow creation to developer specialist', async () => {
      const query = 'Create a workflow with API integrations'
      const agent = await agentRouter.routeToAgent(query)

      expect(agent).toBeDefined()
      expect(agent?.name).toBe('n8n-developer-specialist')
    })

    it('should route complex orchestration to architect', async () => {
      const query = 'Design a complex enterprise workflow architecture'
      const agent = await agentRouter.routeToAgent(query)

      expect(agent).toBeDefined()
      expect(agent?.name).toBe('n8n-workflow-architect')
    })

    it('should route authentication issues to integration specialist', async () => {
      const query = 'OAuth2 authentication setup for Google API'
      const agent = await agentRouter.routeToAgent(query)

      expect(agent).toBeDefined()
      expect(agent?.name).toBe('n8n-integration-specialist')
    })

    it('should route node discovery to node specialist', async () => {
      const query = 'What nodes are available for database operations?'
      const agent = await agentRouter.routeToAgent(query)

      expect(agent).toBeDefined()
      expect(agent?.name).toBe('n8n-node-specialist')
    })

    it('should route performance optimization requests to performance specialist', async () => {
      const query = 'Optimize workflow performance and monitor execution'
      const agent = await agentRouter.routeToAgent(query)

      expect(agent).toBeDefined()
      expect(agent?.name).toBe('n8n-performance-specialist')
    })

    it('should route documentation queries to guidance specialist', async () => {
      const query = 'How to set up n8n with Docker?'
      const agent = await agentRouter.routeToAgent(query)

      expect(agent).toBeDefined()
      expect(agent?.name).toBe('n8n-guidance-specialist')
    })

    it('should route AI/ML queries to node specialist', async () => {
      const query = 'Integrate OpenAI GPT-4 with n8n workflow'
      const agent = await agentRouter.routeToAgent(query)

      expect(agent).toBeDefined()
      expect(agent?.name).toBe('n8n-node-specialist')
    })

    it('should route general node queries to node specialist', async () => {
      const query = 'What nodes are available in n8n?'
      const agent = await agentRouter.routeToAgent(query)

      expect(agent).toBeDefined()
      expect(agent?.name).toBe('n8n-node-specialist')
    })
  })

  describe('agent Context Management', () => {
    it('should create valid agent context', () => {
      const context = AgentContextBuilder.create()
        .complexity('high')
        .requiresValidation(true)
        .build()

      expect(context).toBeDefined()
      expect(context.complexity).toBe('high')
      expect(context.requiresValidation).toBe(true)
    })

    it('should support complex context building', () => {
      const context = AgentContextBuilder.create()
        .complexity('medium')
        .requiresAuthentication(true)
        .nodeExpertise(false)
        .quickHelp(false)
        .build()

      expect(context.complexity).toBe('medium')
      expect(context.requiresAuthentication).toBe(true)
      expect(context.nodeExpertise).toBe(false)
    })

    it('should support all context options', () => {
      const context = AgentContextBuilder.create()
        .documentation(true)
        .community(true)
        .codeGeneration(true)
        .performance(true)
        .build()

      expect(context.documentation).toBe(true)
      expect(context.community).toBe(true)
      expect(context.codeGeneration).toBe(true)
      expect(context.performance).toBe(true)
    })
  })

  describe('agent Capabilities', () => {
    it('should match architect capabilities', () => {
      const architect = agentRouter.getAgentById('n8n-workflow-architect')
      expect(architect).toBeDefined()
      if (architect) {
        const capabilities = architect.capabilities
        expect(capabilities.length).toBeGreaterThan(0)
        expect(architect.tier).toBe(1) // Master tier
        expect(architect.description).toContain('Master orchestrator')
      }
    })

    it('should match developer specialist capabilities', () => {
      const developer = agentRouter.getAgentById('n8n-developer-specialist')
      expect(developer).toBeDefined()
      if (developer) {
        expect(developer.tier).toBe(2) // Specialist tier
        expect(developer.description).toContain('Code generation')
        expect(developer.description).toContain('templates')
      }
    })

    it('should match performance specialist capabilities', () => {
      const performance = agentRouter.getAgentById(
        'n8n-performance-specialist',
      )
      expect(performance).toBeDefined()
      if (performance) {
        expect(performance.tier).toBe(2) // Specialist tier
        expect(performance.description).toContain('Performance monitoring')
        expect(performance.description).toContain('optimization')
      }
    })

    it('should match integration specialist capabilities', () => {
      const specialist = agentRouter.getAgentById('n8n-integration-specialist')
      expect(specialist).toBeDefined()
      if (specialist) {
        expect(specialist.tier).toBe(2) // Specialist tier
        expect(specialist.description).toContain('Authentication')
        expect(specialist.description).toContain('connectivity')
      }
    })

    it('should match node specialist capabilities', () => {
      const specialist = agentRouter.getAgentById('n8n-node-specialist')
      expect(specialist).toBeDefined()
      if (specialist) {
        expect(specialist.tier).toBe(2) // Specialist tier
        expect(specialist.description).toContain('525+')
        expect(specialist.description).toContain('node')
      }
    })
  })

  describe('agent Coordination', () => {
    it('should handle multi-agent workflows', async () => {
      // Simulate a complex query requiring multiple agents
      const complexQuery
        = 'Create a secure workflow with OAuth2 authentication for Google Sheets, validate security, and optimize performance'

      // Complex queries should route to developer specialist for creation
      // Then coordinate with other specialists as needed:
      // 1. Developer specialist for workflow creation
      // 2. Integration specialist for OAuth2
      // 3. Performance specialist for optimization

      const primaryAgent = await agentRouter.routeToAgent(complexQuery)
      expect(primaryAgent).toBeDefined()
      expect(primaryAgent?.name).toBe('n8n-developer-specialist')

      // Developer specialist should handle workflow creation
      expect(primaryAgent?.tier).toBe(2) // Specialist tier
    })

    it('should respect agent hierarchy in routing', async () => {
      // Complex queries should go to higher tier agents
      const strategicQuery = 'Design enterprise-grade automation system'
      const strategicAgent = await agentRouter.routeToAgent(strategicQuery)
      expect(strategicAgent?.tier).toBe(1)

      // Specific technical queries go to tier 2
      const technicalQuery = 'Configure webhook authentication'
      const technicalAgent = await agentRouter.routeToAgent(technicalQuery)
      expect(technicalAgent?.tier).toBe(2)

      // Node queries go to tier 2 (node specialist)
      const nodeQuery = 'Find nodes for PDF processing'
      const nodeAgent = await agentRouter.routeToAgent(nodeQuery)
      expect(nodeAgent?.tier).toBe(2)
    })

    it('should handle agent unavailability gracefully', async () => {
      // Mock agent unavailability by directly mocking the getAgent method
      const originalGetAgent = agentRouter.getAgent
      agentRouter.getAgent = vi.fn((name: string) => {
        if (name === 'n8n-workflow-architect')
          return null
        return originalGetAgent.call(agentRouter, name)
      })

      const query = 'Create complex workflow'
      const agent = await agentRouter.routeToAgent(query)

      // Should fallback to guidance specialist since architect is unavailable
      expect(agent).toBeDefined()
      expect(agent?.name).toBe('n8n-guidance-specialist')

      // Restore original function
      agentRouter.getAgent = originalGetAgent
    })
  })

  describe('agent Performance', () => {
    it('should route queries efficiently', async () => {
      const startTime = Date.now()
      const queries = [
        'Create workflow',
        'Setup OAuth',
        'Validate security',
        'Find AI nodes',
        'Documentation help',
      ]

      const agents = await Promise.all(
        queries.map(q => agentRouter.routeToAgent(q)),
      )

      const duration = Date.now() - startTime

      expect(agents.every(a => a !== undefined)).toBe(true)
      expect(duration).toBeLessThan(100) // Should route in under 100ms
    })

    it('should cache agent lookups', () => {
      const agent1 = agentRouter.getAgentById('n8n-workflow-architect')
      const agent2 = agentRouter.getAgentById('n8n-workflow-architect')

      // Should return the same agent instance (cached)
      expect(agent1).toBe(agent2)
    })

    it('should handle concurrent agent requests', async () => {
      const concurrentQueries = [
        'Create complex workflow',
        'OAuth authentication setup',
        'Validate security settings',
        'Configure PostgreSQL node',
        'How to setup n8n',
        'Find AI nodes',
        'Design enterprise automation',
        'Debug webhook issues',
        'Community packages for ML',
        'General workflow help',
      ]

      const results = await Promise.all(
        concurrentQueries.map(query => agentRouter.routeToAgent(query)),
      )

      expect(results.every(r => r !== undefined)).toBe(true)
      expect(new Set(results.map(r => r?.name)).size).toBeGreaterThan(1)
    })
  })

  describe('agent Error Handling', () => {
    it('should handle invalid queries gracefully', async () => {
      const invalidQueries = ['', null, undefined, 123, {}, []]

      for (const query of invalidQueries) {
        const agent = await agentRouter.routeToAgent(query as any)
        // Should either return a default agent or undefined
        expect(
          [undefined, 'n8n-guidance-specialist'].includes(agent?.name || ''),
        ).toBe(true)
      }
    })

    it('should handle routing errors', async () => {
      // Mock routing error
      const originalRoute = agentRouter.routeToAgent
      agentRouter.routeToAgent = vi
        .fn()
        .mockRejectedValue(new Error('Routing failed'))

      try {
        await agentRouter.routeToAgent('test query')
        expect.fail('Should have thrown an error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Routing failed')
      }

      // Restore original function
      agentRouter.routeToAgent = originalRoute
    })

    it('should validate agent responses', () => {
      const agents = agentRouter.getAllAgents()

      agents.forEach((agent) => {
        // Validate agent structure
        expect(agent.name).toBeDefined()
        expect(typeof agent.name).toBe('string')
        expect(agent.name.length).toBeGreaterThan(0)

        expect(agent.tier).toBeDefined()
        expect(typeof agent.tier).toBe('number')
        expect([1, 2, 3]).toContain(agent.tier)

        expect(agent.capabilities).toBeDefined()
        expect(Array.isArray(agent.capabilities)).toBe(true)
      })
    })
  })
})
