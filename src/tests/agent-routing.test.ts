/**
 * Agent Routing System Tests
 * Tests the 7-agent hierarchy and intelligent routing
 */

import { describe, it, expect } from 'vitest';
import { agentRouter, AgentContextBuilder, AgentTier } from '../agents/index.js';

describe('Agent Routing System Tests', () => {
  describe('Agent Hierarchy', () => {
    it('should have all 6 agents available', () => {
      const agents = agentRouter.getAllAgents();
      expect(agents.length).toBe(6);
      
      // Check agent names for optimized 6-agent structure
      const agentNames = agents.map(agent => agent.name);
      expect(agentNames).toContain('n8n-workflow-architect');
      expect(agentNames).toContain('n8n-developer-specialist');
      expect(agentNames).toContain('n8n-integration-specialist');
      expect(agentNames).toContain('n8n-node-specialist');
      expect(agentNames).toContain('n8n-performance-specialist');
      expect(agentNames).toContain('n8n-guidance-specialist');
    });

    it('should have proper tier distribution', () => {
      const masterAgents = agentRouter.getAgentsByTier(AgentTier.MASTER);
      const specialistAgents = agentRouter.getAgentsByTier(AgentTier.SPECIALIST);
      const supportAgents = agentRouter.getAgentsByTier(AgentTier.SUPPORT);

      expect(masterAgents.length).toBe(1); // Workflow Architect
      expect(specialistAgents.length).toBe(4); // Core domain specialists
      expect(supportAgents.length).toBe(1); // Support specialist
      
      expect(masterAgents[0]?.name).toBe('n8n-workflow-architect');
    });
  });

  describe('Tool Routing Logic', () => {
    it('should route workflow creation to architect', () => {
      const context = AgentContextBuilder.create()
        .complexity('high')
        .build();

      const selectedAgent = agentRouter.routeTool('create_n8n_workflow', context);
      expect(selectedAgent.name).toBe('n8n-workflow-architect');
      expect(selectedAgent.tier).toBe(AgentTier.MASTER);
    });

    it('should route performance analysis tasks to performance specialist', () => {
      const context = AgentContextBuilder.create()
        .performance(true)
        .monitoring(true)
        .build();

      // Use get_workflow_stats which is now handled by performance specialist
      const selectedAgent = agentRouter.routeTool('get_workflow_stats', context);
      expect(selectedAgent.name).toBe('n8n-performance-specialist');
      expect(selectedAgent.tier).toBe(AgentTier.SPECIALIST);
    });

    it('should route authentication tasks to integration specialist', () => {
      const context = AgentContextBuilder.create()
        .requiresAuthentication()
        .build();

      const selectedAgent = agentRouter.routeTool('activate_n8n_workflow', context);
      expect(selectedAgent.name).toBe('n8n-integration-specialist');
    });

    it('should route node-related tasks to node specialist', () => {
      const context = AgentContextBuilder.create()
        .nodeExpertise()
        .build();

      const selectedAgent = agentRouter.routeTool('search_n8n_nodes', context);
      expect(selectedAgent.name).toBe('n8n-node-specialist');
    });

    it('should route general help to guidance specialist', () => {
      const context = AgentContextBuilder.create()
        .guidance(true)
        .build();

      const selectedAgent = agentRouter.routeTool('get_tool_usage_stats', context);
      expect(selectedAgent.name).toBe('n8n-guidance-specialist');
    });

    it('should route code generation to developer specialist', () => {
      const context = AgentContextBuilder.create()
        .codeGeneration(true)
        .build();

      const selectedAgent = agentRouter.routeTool('generate_workflow_from_description', context);
      expect(selectedAgent.name).toBe('n8n-developer-specialist');
      expect(selectedAgent.tier).toBe(AgentTier.SPECIALIST);
    });
  });

  describe('Context Building', () => {
    it('should build complex workflow context correctly', () => {
      const context = AgentContextBuilder.create()
        .complexity('high')
        .requiresValidation()
        .nodeExpertise()
        .build();

      expect(context.complexity).toBe('high');
      expect(context.requiresValidation).toBe(true);
      expect(context.nodeExpertise).toBe(true);
    });

    it('should build authentication context correctly', () => {
      const context = AgentContextBuilder.create()
        .requiresAuthentication()
        .complexity('medium')
        .build();

      expect(context.requiresAuthentication).toBe(true);
      expect(context.complexity).toBe('medium');
    });

    it('should build research context correctly', () => {
      const context = AgentContextBuilder.create()
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
      const highComplexityContext = AgentContextBuilder.create()
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
      const nodeContext = AgentContextBuilder.create()
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
      const developer = agents.find(a => a.name === 'n8n-developer-specialist');
      const nodeSpecialist = agents.find(a => a.name === 'n8n-node-specialist');
      const performance = agents.find(a => a.name === 'n8n-performance-specialist');

      expect(architect?.capabilities).toContain('workflow_design');
      expect(developer?.capabilities).toContain('code_generation');
      expect(nodeSpecialist?.capabilities).toContain('node_expertise');
      expect(performance?.capabilities).toContain('performance_optimization');
    });

    it('should validate agent can handle specific tools', () => {
      const agents = agentRouter.getAllAgents();
      
      const architect = agents.find(a => a.name === 'n8n-workflow-architect');
      expect(architect?.canHandle('create_n8n_workflow')).toBe(true);
      
      const performance = agents.find(a => a.name === 'n8n-performance-specialist');
      expect(performance?.canHandle('get_workflow_stats')).toBe(true);
      
      const developer = agents.find(a => a.name === 'n8n-developer-specialist');
      expect(developer?.canHandle('generate_workflow_from_description')).toBe(true);
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
      const conflictContext = AgentContextBuilder.create()
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