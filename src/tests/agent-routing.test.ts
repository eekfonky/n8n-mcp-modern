/**
 * Agent Routing System Tests
 * Tests the 7-agent hierarchy and intelligent routing
 */

import { describe, it, expect } from 'vitest';
import { agentRouter, AgentContext, AgentTier } from '../agents/index.js';

describe('Agent Routing System Tests', () => {
  describe('Agent Hierarchy', () => {
    it('should have all 7 agents available', () => {
      const agents = agentRouter.getAllAgents();
      expect(agents.length).toBe(7);
      
      // Check agent names
      const agentNames = agents.map(agent => agent.name);
      expect(agentNames).toContain('n8n-workflow-architect');
      expect(agentNames).toContain('n8n-validator');
      expect(agentNames).toContain('n8n-integration-specialist');
      expect(agentNames).toContain('n8n-node-specialist');
      expect(agentNames).toContain('n8n-assistant');
      expect(agentNames).toContain('n8n-docs-specialist');
      expect(agentNames).toContain('n8n-community-specialist');
    });

    it('should have proper tier distribution', () => {
      const masterAgents = agentRouter.getAgentsByTier(AgentTier.MASTER);
      const coreAgents = agentRouter.getAgentsByTier(AgentTier.CORE);
      const researchAgents = agentRouter.getAgentsByTier(AgentTier.RESEARCH);

      expect(masterAgents.length).toBe(1); // Workflow Architect
      expect(coreAgents.length).toBeGreaterThan(1); // Core specialists
      expect(researchAgents.length).toBeGreaterThan(1); // Research specialists
      
      expect(masterAgents[0]?.name).toBe('n8n-workflow-architect');
    });
  });

  describe('Tool Routing Logic', () => {
    it('should route workflow creation to architect', () => {
      const context = AgentContext.create()
        .complexity('high')
        .build();

      const selectedAgent = agentRouter.routeTool('create_n8n_workflow', context);
      expect(selectedAgent.name).toBe('n8n-workflow-architect');
      expect(selectedAgent.tier).toBe(AgentTier.MASTER);
    });

    it('should route validation tasks to validator', () => {
      const context = AgentContext.create()
        .requiresValidation()
        .securityCheck(true)
        .build();

      // Use get_n8n_executions which is validator-specific and has security priority
      const selectedAgent = agentRouter.routeTool('get_n8n_executions', context);
      expect(selectedAgent.name).toBe('n8n-validator');
      expect(selectedAgent.tier).toBe(AgentTier.CORE);
    });

    it('should route authentication tasks to integration specialist', () => {
      const context = AgentContext.create()
        .requiresAuthentication()
        .build();

      const selectedAgent = agentRouter.routeTool('activate_n8n_workflow', context);
      expect(selectedAgent.name).toBe('n8n-integration-specialist');
    });

    it('should route node-related tasks to node specialist', () => {
      const context = AgentContext.create()
        .nodeExpertise()
        .build();

      const selectedAgent = agentRouter.routeTool('search_n8n_nodes', context);
      expect(selectedAgent.name).toBe('n8n-node-specialist');
    });

    it('should route quick help to assistant', () => {
      const context = AgentContext.create()
        .quickHelp()
        .build();

      const selectedAgent = agentRouter.routeTool('get_tool_usage_stats', context);
      expect(selectedAgent.name).toBe('n8n-assistant');
    });
  });

  describe('Context Building', () => {
    it('should build complex workflow context correctly', () => {
      const context = AgentContext.create()
        .complexity('high')
        .requiresValidation()
        .nodeExpertise()
        .build();

      expect(context.complexity).toBe('high');
      expect(context.requiresValidation).toBe(true);
      expect(context.nodeExpertise).toBe(true);
    });

    it('should build authentication context correctly', () => {
      const context = AgentContext.create()
        .requiresAuthentication()
        .complexity('medium')
        .build();

      expect(context.requiresAuthentication).toBe(true);
      expect(context.complexity).toBe('medium');
    });

    it('should build research context correctly', () => {
      const context = AgentContext.create()
        .quickHelp()
        .complexity('low')
        .build();

      expect(context.quickHelp).toBe(true);
      expect(context.complexity).toBe('low');
    });
  });

  describe('Priority-Based Selection', () => {
    it('should select highest priority agent for complex tasks', () => {
      // Test that high complexity tasks go to master architect
      const highComplexityContext = AgentContext.create()
        .complexity('high')
        .build();

      const agent = agentRouter.routeTool('create_n8n_workflow', highComplexityContext);
      expect(agent.tier).toBe(AgentTier.MASTER);
    });

    it('should handle tool routing fallbacks', () => {
      // Test with a tool that no agent specifically handles
      const agent = agentRouter.routeTool('unknown_tool', {});
      
      // Should fall back to a default agent (usually assistant)
      expect(agent).toBeDefined();
      expect(agent.name).toBeDefined();
    });

    it('should respect agent specialization', () => {
      // Node search should prefer node specialist over others
      const nodeContext = AgentContext.create()
        .nodeExpertise()
        .build();

      const agent = agentRouter.routeTool('search_n8n_nodes', nodeContext);
      expect(agent.name).toBe('n8n-node-specialist');
    });
  });

  describe('Agent Capabilities', () => {
    it('should have proper capabilities assigned', () => {
      const agents = agentRouter.getAllAgents();
      
      const architect = agents.find(a => a.name === 'n8n-workflow-architect');
      const validator = agents.find(a => a.name === 'n8n-validator');
      const nodeSpecialist = agents.find(a => a.name === 'n8n-node-specialist');

      expect(architect?.capabilities).toContain('workflow_design');
      expect(validator?.capabilities).toContain('validation');
      expect(nodeSpecialist?.capabilities).toContain('node_expertise');
    });

    it('should validate agent can handle specific tools', () => {
      const agents = agentRouter.getAllAgents();
      
      const architect = agents.find(a => a.name === 'n8n-workflow-architect');
      expect(architect?.canHandle('create_n8n_workflow')).toBe(true);
      
      const validator = agents.find(a => a.name === 'n8n-validator');
      expect(validator?.canHandle('get_workflow_stats')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context gracefully', () => {
      const agent = agentRouter.routeTool('search_n8n_nodes', {});
      expect(agent).toBeDefined();
      expect(agent.name).toBeDefined();
    });

    it('should handle undefined context gracefully', () => {
      const agent = agentRouter.routeTool('get_n8n_workflows');
      expect(agent).toBeDefined();
      expect(agent.name).toBeDefined();
    });

    it('should handle conflicting context requirements', () => {
      // Test context with conflicting requirements
      const conflictContext = AgentContext.create()
        .complexity('high')
        .quickHelp()
        .requiresValidation()
        .build();

      const agent = agentRouter.routeTool('search_n8n_nodes', conflictContext);
      expect(agent).toBeDefined();
      // Should prioritize based on agent priority logic
    });
  });
});