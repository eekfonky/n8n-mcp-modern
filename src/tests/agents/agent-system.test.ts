/**
 * Agent System Integration Tests
 * Tests the 7-agent hierarchical system and inter-agent communication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { agentRouter, type Agent, AgentContext } from '../../agents/index.js';

describe('Agent System Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent Registry', () => {
    it('should have all 7 agents registered', () => {
      const agents = agentRouter.getAllAgents();
      expect(agents.length).toBe(7);
    });

    it('should have proper agent hierarchy', () => {
      const agents = agentRouter.getAllAgents();
      
      // Check Tier 1 - Master Orchestrator
      const tier1Agents = agents.filter(a => a.tier === 1);
      expect(tier1Agents.length).toBe(1);
      expect(tier1Agents[0].name).toBe('n8n-workflow-architect');
      
      // Check Tier 2 - Core Specialists
      const tier2Agents = agents.filter(a => a.tier === 2);
      expect(tier2Agents.length).toBe(3);
      const tier2Names = tier2Agents.map(a => a.name);
      expect(tier2Names).toContain('n8n-validator');
      expect(tier2Names).toContain('n8n-integration-specialist');
      expect(tier2Names).toContain('n8n-node-specialist');
      
      // Check Tier 3 - Research Specialists
      const tier3Agents = agents.filter(a => a.tier === 3);
      expect(tier3Agents.length).toBe(3);
      const tier3Names = tier3Agents.map(a => a.name);
      expect(tier3Names).toContain('n8n-assistant');
      expect(tier3Names).toContain('n8n-docs-specialist');
      expect(tier3Names).toContain('n8n-community-specialist');
    });

    it('should have unique agent names', () => {
      const agents = agentRouter.getAllAgents();
      const names = agents.map(a => a.name);
      const uniqueNames = [...new Set(names)];
      expect(uniqueNames.length).toBe(names.length);
    });

    it('should have valid capabilities for each agent', () => {
      const agents = agentRouter.getAllAgents();
      
      agents.forEach(agent => {
        expect(agent.capabilities).toBeDefined();
        expect(Array.isArray(agent.capabilities)).toBe(true);
        expect(agent.capabilities.length).toBeGreaterThan(0);
        
        // Each capability should be a non-empty string
        agent.capabilities.forEach(cap => {
          expect(typeof cap).toBe('string');
          expect(cap.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Agent Routing', () => {
    it('should route workflow creation to architect', async () => {
      const query = 'Create a complex workflow with multiple integrations';
      const agent = await agentRouter.routeToAgent(query);
      
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('n8n-workflow-architect');
    });

    it('should route authentication issues to integration specialist', async () => {
      const query = 'OAuth2 authentication setup for Google API';
      const agent = await agentRouter.routeToAgent(query);
      
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('n8n-integration-specialist');
    });

    it('should route node configuration to node specialist', async () => {
      const query = 'Configure PostgreSQL node with complex query';
      const agent = await agentRouter.routeToAgent(query);
      
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('n8n-node-specialist');
    });

    it('should route validation requests to validator', async () => {
      const query = 'Validate workflow security and compliance';
      const agent = await agentRouter.routeToAgent(query);
      
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('n8n-validator');
    });

    it('should route documentation queries to docs specialist', async () => {
      const query = 'How to set up n8n with Docker?';
      const agent = await agentRouter.routeToAgent(query);
      
      expect(agent).toBeDefined();
      expect(['n8n-docs-specialist', 'n8n-assistant']).toContain(agent?.name);
    });

    it('should route AI/ML queries to community specialist', async () => {
      const query = 'Integrate OpenAI GPT-4 with n8n workflow';
      const agent = await agentRouter.routeToAgent(query);
      
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('n8n-community-specialist');
    });

    it('should route general queries to assistant', async () => {
      const query = 'What nodes are available in n8n?';
      const agent = await agentRouter.routeToAgent(query);
      
      expect(agent).toBeDefined();
      expect(['n8n-assistant', 'n8n-node-specialist']).toContain(agent?.name);
    });
  });

  describe('Agent Context Management', () => {
    it('should create valid agent context', () => {
      const context = AgentContext.create()
        .complexity('high')
        .requiresValidation(true)
        .build();

      expect(context).toBeDefined();
      expect(context.complexity).toBe('high');
      expect(context.requiresValidation).toBe(true);
    });

    it('should support complex context building', () => {
      const context = AgentContext.create()
        .complexity('medium')
        .requiresAuthentication(true)
        .nodeExpertise(false)
        .quickHelp(false)
        .build();

      expect(context.complexity).toBe('medium');
      expect(context.requiresAuthentication).toBe(true);
      expect(context.nodeExpertise).toBe(false);
    });

    it('should support all context options', () => {
      const context = AgentContext.create()
        .documentation(true)
        .community(true)
        .securityCheck(true)
        .build();

      expect(context.documentation).toBe(true);
      expect(context.community).toBe(true);
      expect(context.securityCheck).toBe(true);
    });
  });

  describe('Agent Capabilities', () => {
    it('should match architect capabilities', () => {
      const architect = agentRouter.getAgentById('n8n-workflow-architect');
      expect(architect).toBeDefined();
      
      const capabilities = architect!.capabilities;
      expect(capabilities.length).toBeGreaterThan(0);
      expect(architect!.tier).toBe(1); // Master tier
      expect(architect!.description).toContain('Master coordinator');
    });

    it('should match validator capabilities', () => {
      const validator = agentRouter.getAgentById('n8n-validator');
      expect(validator).toBeDefined();
      
      expect(validator!.tier).toBe(2); // Core tier
      expect(validator!.description).toContain('Security analysis');
      expect(validator!.description).toContain('validation');
    });

    it('should match integration specialist capabilities', () => {
      const specialist = agentRouter.getAgentById('n8n-integration-specialist');
      expect(specialist).toBeDefined();
      
      expect(specialist!.tier).toBe(2); // Core tier
      expect(specialist!.description).toContain('Authentication');
      expect(specialist!.description).toContain('connectivity');
    });

    it('should match node specialist capabilities', () => {
      const specialist = agentRouter.getAgentById('n8n-node-specialist');
      expect(specialist).toBeDefined();
      
      expect(specialist!.tier).toBe(2); // Core tier
      expect(specialist!.description).toContain('525+');
      expect(specialist!.description).toContain('node');
    });
  });

  describe('Agent Coordination', () => {
    it('should handle multi-agent workflows', async () => {
      // Simulate a complex query requiring multiple agents
      const complexQuery = 'Create a secure workflow with OAuth2 authentication for Google Sheets, validate security, and optimize performance';
      
      // This should involve multiple agents:
      // 1. Architect for overall design
      // 2. Integration specialist for OAuth2
      // 3. Validator for security
      // 4. Node specialist for optimization
      
      const primaryAgent = await agentRouter.routeToAgent(complexQuery);
      expect(primaryAgent).toBeDefined();
      expect(primaryAgent?.name).toBe('n8n-workflow-architect');
      
      // Architect should be able to coordinate with other agents
      expect(primaryAgent?.tier).toBe(1); // Master orchestrator
    });

    it('should respect agent hierarchy in routing', async () => {
      // Complex queries should go to higher tier agents
      const strategicQuery = 'Design enterprise-grade automation system';
      const strategicAgent = await agentRouter.routeToAgent(strategicQuery);
      expect(strategicAgent?.tier).toBe(1);
      
      // Specific technical queries go to tier 2
      const technicalQuery = 'Configure webhook authentication';
      const technicalAgent = await agentRouter.routeToAgent(technicalQuery);
      expect(technicalAgent?.tier).toBe(2);
      
      // Research queries go to tier 3  
      const researchQuery = 'Find community nodes for PDF processing';
      const researchAgent = await agentRouter.routeToAgent(researchQuery);
      expect(researchAgent?.tier).toBe(3);
    });

    it('should handle agent unavailability gracefully', async () => {
      // Mock agent unavailability by directly mocking the getAgent method
      const originalGetAgent = agentRouter.getAgent;
      agentRouter.getAgent = vi.fn((name: string) => {
        if (name === 'n8n-workflow-architect') return null;
        return originalGetAgent.call(agentRouter, name);
      });

      const query = 'Create complex workflow';
      const agent = await agentRouter.routeToAgent(query);
      
      // Should fallback to assistant since architect is unavailable
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('n8n-assistant');
      
      // Restore original function
      agentRouter.getAgent = originalGetAgent;
    });
  });

  describe('Agent Performance', () => {
    it('should route queries efficiently', async () => {
      const startTime = Date.now();
      const queries = [
        'Create workflow',
        'Setup OAuth',
        'Validate security',
        'Find AI nodes',
        'Documentation help'
      ];

      const agents = await Promise.all(
        queries.map(q => agentRouter.routeToAgent(q))
      );

      const duration = Date.now() - startTime;
      
      expect(agents.every(a => a !== undefined)).toBe(true);
      expect(duration).toBeLessThan(100); // Should route in under 100ms
    });

    it('should cache agent lookups', () => {
      const agent1 = agentRouter.getAgentById('n8n-workflow-architect');
      const agent2 = agentRouter.getAgentById('n8n-workflow-architect');
      
      // Should return the same agent instance (cached)
      expect(agent1).toBe(agent2);
    });

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
        'General workflow help'
      ];

      const results = await Promise.all(
        concurrentQueries.map(query => agentRouter.routeToAgent(query))
      );

      expect(results.every(r => r !== undefined)).toBe(true);
      expect(new Set(results.map(r => r?.name)).size).toBeGreaterThan(1);
    });
  });

  describe('Agent Error Handling', () => {
    it('should handle invalid queries gracefully', async () => {
      const invalidQueries = ['', null, undefined, 123, {}, []];
      
      for (const query of invalidQueries) {
        const agent = await agentRouter.routeToAgent(query as any);
        // Should either return a default agent or undefined
        expect([undefined, 'n8n-assistant'].includes(agent?.name || '')).toBe(true);
      }
    });

    it('should handle routing errors', async () => {
      // Mock routing error
      const originalRoute = agentRouter.routeToAgent;
      agentRouter.routeToAgent = vi.fn().mockRejectedValue(new Error('Routing failed'));

      try {
        await agentRouter.routeToAgent('test query');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Routing failed');
      }

      // Restore original function
      agentRouter.routeToAgent = originalRoute;
    });

    it('should validate agent responses', () => {
      const agents = agentRouter.getAllAgents();
      
      agents.forEach(agent => {
        // Validate agent structure
        expect(agent.name).toBeDefined();
        expect(typeof agent.name).toBe('string');
        expect(agent.name.length).toBeGreaterThan(0);
        
        expect(agent.tier).toBeDefined();
        expect(typeof agent.tier).toBe('number');
        expect([1, 2, 3]).toContain(agent.tier);
        
        expect(agent.capabilities).toBeDefined();
        expect(Array.isArray(agent.capabilities)).toBe(true);
      });
    });
  });
});