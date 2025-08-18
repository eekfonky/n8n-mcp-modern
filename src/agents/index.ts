/**
 * Agent System for n8n MCP Modern
 * Implements the 7-agent hierarchy for specialized n8n workflow automation
 */

import { logger } from '../server/logger.js';
import { database } from '../database/index.js';

/**
 * Agent capability types
 */
export enum AgentCapability {
  WORKFLOW_DESIGN = 'workflow_design',
  NODE_EXPERTISE = 'node_expertise',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  DOCUMENTATION = 'documentation',
  RESEARCH = 'research',
  COMMUNITY = 'community',
  QUICK_HELP = 'quick_help'
}

/**
 * Agent tier levels
 */
export enum AgentTier {
  MASTER = 1,    // Master Orchestrator
  CORE = 2,      // Core Specialists  
  RESEARCH = 3   // Research Specialists
}

/**
 * Base agent interface
 */
export interface Agent {
  name: string;
  tier: AgentTier;
  capabilities: AgentCapability[];
  description: string;
  canHandle(toolName: string, context?: any): boolean;
  getPriority(toolName: string, context?: any): number;
}

/**
 * Tier 1 - Master Orchestrator
 */
export class WorkflowArchitect implements Agent {
  name = 'n8n-workflow-architect';
  tier = AgentTier.MASTER;
  capabilities = [
    AgentCapability.WORKFLOW_DESIGN,
    AgentCapability.NODE_EXPERTISE,
    AgentCapability.VALIDATION
  ];
  description = 'Master coordinator & workflow lifecycle manager for n8n-MCP Enhanced. Strategic planning, complex orchestration, and multi-agent coordination.';

  canHandle(toolName: string, context?: any): boolean {
    // The architect can handle complex workflow operations
    const complexOperations = [
      'create_n8n_workflow',
      'get_workflow_stats',
      'execute_n8n_workflow'
    ];
    
    return complexOperations.includes(toolName) || 
           (context?.complexity === 'high') ||
           (context?.requiresOrchestration === true);
  }

  getPriority(toolName: string, context?: any): number {
    if (context?.complexity === 'high') return 10;
    if (this.canHandle(toolName, context)) return 8;
    return 5; // Default coordinator priority
  }
}

/**
 * Tier 2 - Core Specialists
 */
export class Validator implements Agent {
  name = 'n8n-validator';
  tier = AgentTier.CORE;
  capabilities = [AgentCapability.VALIDATION];
  description = 'Security analysis & multi-level validation specialist for n8n-MCP Enhanced. Comprehensive validation, compliance checking, and risk assessment.';

  canHandle(toolName: string, context?: any): boolean {
    const validationTools = [
      'get_workflow_stats',
      'get_n8n_executions'
    ];
    
    return validationTools.includes(toolName) ||
           (context?.requiresValidation === true) ||
           (context?.securityCheck === true);
  }

  getPriority(toolName: string, context?: any): number {
    if (context?.securityCheck === true) return 9;
    if (context?.requiresValidation === true) return 8;
    return 6;
  }
}

export class IntegrationSpecialist implements Agent {
  name = 'n8n-integration-specialist';
  tier = AgentTier.CORE;
  capabilities = [AgentCapability.AUTHENTICATION];
  description = 'Authentication & connectivity expert for n8n-MCP Enhanced. OAuth flows, API authentication, webhook setup, and connectivity troubleshooting across 525+ platforms.';

  canHandle(toolName: string, context?: any): boolean {
    const integrationTools = [
      'get_n8n_workflows',
      'activate_n8n_workflow',
      'deactivate_n8n_workflow'
    ];
    
    return integrationTools.includes(toolName) ||
           (context?.requiresAuthentication === true) ||
           (context?.connectivity === true);
  }

  getPriority(toolName: string, context?: any): number {
    if (context?.requiresAuthentication === true) return 9;
    if (context?.connectivity === true) return 8;
    return 7;
  }
}

export class NodeSpecialist implements Agent {
  name = 'n8n-node-specialist';
  tier = AgentTier.CORE;
  capabilities = [AgentCapability.NODE_EXPERTISE];
  description = '525+ node database expert & AI specialist for n8n-MCP Enhanced. Node selection, configuration, AI/ML workflow design, and performance optimization.';

  canHandle(toolName: string, context?: any): boolean {
    const nodeTools = [
      'search_n8n_nodes'
    ];
    
    return nodeTools.includes(toolName) ||
           (context?.nodeExpertise === true) ||
           (context?.nodeConfiguration === true);
  }

  getPriority(toolName: string, context?: any): number {
    if (context?.nodeExpertise === true) return 9;
    if (context?.nodeConfiguration === true) return 8;
    if (toolName === 'search_n8n_nodes') return 9;
    return 6;
  }
}

/**
 * Tier 3 - Research Specialists
 */
export class Assistant implements Agent {
  name = 'n8n-assistant';
  tier = AgentTier.RESEARCH;
  capabilities = [AgentCapability.QUICK_HELP];
  description = 'Quick research & essential information synthesis specialist for n8n-MCP Enhanced. Fast information gathering, problem diagnosis, and workflow guidance.';

  canHandle(toolName: string, context?: any): boolean {
    // Assistant handles simple, quick operations
    const simpleTools = [
      'get_tool_usage_stats',
      'get_n8n_workflow'
    ];
    
    return simpleTools.includes(toolName) ||
           (context?.quickHelp === true) ||
           (context?.simple === true);
  }

  getPriority(toolName: string, context?: any): number {
    if (context?.quickHelp === true) return 8;
    if (context?.simple === true) return 7;
    return 4; // Lower priority for general tasks
  }
}

export class DocsSpecialist implements Agent {
  name = 'n8n-docs-specialist';
  tier = AgentTier.RESEARCH;
  capabilities = [AgentCapability.DOCUMENTATION];
  description = 'Documentation & setup guides specialist for n8n-MCP Enhanced. Setup instructions, troubleshooting guides, and learning resources for n8n development.';

  canHandle(toolName: string, context?: any): boolean {
    return (context?.documentation === true) ||
           (context?.setupGuide === true) ||
           (context?.troubleshooting === true);
  }

  getPriority(toolName: string, context?: any): number {
    if (context?.documentation === true) return 8;
    if (context?.setupGuide === true) return 7;
    return 3;
  }
}

export class CommunitySpecialist implements Agent {
  name = 'n8n-community-specialist';
  tier = AgentTier.RESEARCH;
  capabilities = [AgentCapability.COMMUNITY, AgentCapability.RESEARCH];
  description = 'AI/ML workflows & community packages specialist for n8n-MCP Enhanced. Community node discovery, AI/ML patterns, and emerging automation trends.';

  canHandle(toolName: string, context?: any): boolean {
    return (context?.community === true) ||
           (context?.aiml === true) ||
           (context?.trends === true);
  }

  getPriority(toolName: string, context?: any): number {
    if (context?.community === true) return 7;
    if (context?.aiml === true) return 6;
    return 3;
  }
}

/**
 * Agent Router - Routes tools to appropriate agents
 */
export class AgentRouter {
  private agents: Agent[];

  constructor() {
    this.agents = [
      new WorkflowArchitect(),
      new Validator(),
      new IntegrationSpecialist(),
      new NodeSpecialist(),
      new Assistant(),
      new DocsSpecialist(),
      new CommunitySpecialist()
    ];
  }

  /**
   * Route a tool call to the most appropriate agent
   */
  routeTool(toolName: string, context?: any): Agent {
    // Calculate priorities for each agent
    const candidates = this.agents
      .filter(agent => agent.canHandle(toolName, context))
      .map(agent => ({
        agent,
        priority: agent.getPriority(toolName, context)
      }))
      .sort((a, b) => b.priority - a.priority);

    if (candidates.length === 0) {
      // Default to assistant for unhandled tools
      logger.warn(`No specific agent for tool ${toolName}, using assistant`);
      const assistant = this.agents.find(a => a.name === 'n8n-assistant');
      if (!assistant) {
        throw new Error('Assistant agent not found');
      }
      return assistant;
    }

    const selectedCandidate = candidates[0];
    if (!selectedCandidate) {
      throw new Error('No candidate found');
    }
    
    const selectedAgent = selectedCandidate.agent;
    
    logger.debug(`Routed tool ${toolName} to agent ${selectedAgent.name} (priority: ${selectedCandidate.priority})`);
    
    // Store routing decision in database
    this.storeRoutingDecision(toolName, selectedAgent, selectedCandidate.priority);
    
    return selectedAgent;
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): Agent | null {
    return this.agents.find(agent => agent.name === name) || null;
  }

  /**
   * Get agent by ID (alias for getAgent for backward compatibility)
   */
  getAgentById(id: string): Agent | undefined {
    return this.getAgent(id) || undefined;
  }

  /**
   * Route to agent based on text query (intelligent routing)
   */
  async routeToAgent(query: string): Promise<Agent | undefined> {
    if (!query || typeof query !== 'string') {
      return this.getAgent('n8n-assistant') || undefined;
    }

    const lowerQuery = query.toLowerCase();

    // Node-specific queries (highest priority for specific configuration)
    if ((lowerQuery.includes('configure') || lowerQuery.includes('node')) && 
        (lowerQuery.includes('postgres') || lowerQuery.includes('http') || lowerQuery.includes('database'))) {
      return this.getAgent('n8n-node-specialist') || undefined;
    }

    // Complex/strategic queries go to architect (tier 1)
    if (lowerQuery.includes('complex') || lowerQuery.includes('enterprise') || lowerQuery.includes('design') || 
        lowerQuery.includes('orchestrat') || lowerQuery.includes('strategic')) {
      const architect = this.getAgent('n8n-workflow-architect');
      if (architect) return architect;
      // Fallback to assistant if architect unavailable
      return this.getAgent('n8n-assistant') || undefined;
    }

    // Workflow creation goes to architect
    if (lowerQuery.includes('create') && lowerQuery.includes('workflow')) {
      return this.getAgent('n8n-workflow-architect') || undefined;
    }

    // Authentication/OAuth queries
    if (lowerQuery.includes('oauth') || lowerQuery.includes('auth') || lowerQuery.includes('credential') ||
        lowerQuery.includes('webhook') || lowerQuery.includes('connect')) {
      return this.getAgent('n8n-integration-specialist') || undefined;
    }

    // Security/validation queries
    if (lowerQuery.includes('validate') || lowerQuery.includes('security') || lowerQuery.includes('compliance')) {
      return this.getAgent('n8n-validator') || undefined;
    }

    // Specific node availability queries - check BEFORE community
    if ((lowerQuery.includes('nodes') && lowerQuery.includes('available')) ||
        (lowerQuery.includes('what') && lowerQuery.includes('nodes'))) {
      return this.getAgent('n8n-node-specialist') || undefined;
    }

    // AI/ML and community queries go to research specialists (tier 3)
    if (lowerQuery.includes('ai') || lowerQuery.includes('openai') || lowerQuery.includes('community') ||
        lowerQuery.includes('gpt') || lowerQuery.includes('trends') ||
        lowerQuery.includes('find') || lowerQuery.includes('discover')) {
      return this.getAgent('n8n-community-specialist') || undefined;
    }

    // Documentation queries
    if (lowerQuery.includes('documentation') || lowerQuery.includes('docker') || lowerQuery.includes('setup') ||
        lowerQuery.includes('how to')) {
      return this.getAgent('n8n-docs-specialist') || undefined;
    }

    // General node queries (after community check to avoid conflicts)
    if (lowerQuery.includes('node') || lowerQuery.includes('postgres') || lowerQuery.includes('http')) {
      return this.getAgent('n8n-node-specialist') || undefined;
    }

    // Technical specific queries go to tier 2
    if (lowerQuery.includes('troubleshoot') || lowerQuery.includes('debug') || lowerQuery.includes('fix')) {
      return this.getAgent('n8n-integration-specialist') || undefined;
    }

    // Default to assistant for general queries
    return this.getAgent('n8n-assistant') || undefined;
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return [...this.agents];
  }

  /**
   * Get agents by tier
   */
  getAgentsByTier(tier: AgentTier): Agent[] {
    return this.agents.filter(agent => agent.tier === tier);
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability: AgentCapability): Agent[] {
    return this.agents.filter(agent => 
      agent.capabilities.includes(capability)
    );
  }

  /**
   * Store routing decision for analytics
   */
  private storeRoutingDecision(toolName: string, agent: Agent, priority: number): void {
    try {
      // This would store in the database for routing analytics
      // For now, just log it
      logger.debug(`Routing decision: ${toolName} → ${agent.name} (priority: ${priority})`);
    } catch (error) {
      logger.error('Failed to store routing decision:', error);
    }
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): Record<string, { agent: string; count: number }> {
    // This would return routing statistics from the database
    // For now, return empty object
    return {};
  }

  /**
   * Analyze agent performance
   */
  analyzeAgentPerformance(): {
    agent: string;
    toolsHandled: number;
    averageExecutionTime: number;
    successRate: number;
  }[] {
    // This would analyze agent performance from the database
    // For now, return empty array
    return [];
  }
}

// Export singleton router
export const agentRouter = new AgentRouter();

/**
 * Agent context builder for intelligent routing
 */
export class AgentContext {
  private context: Record<string, any> = {};

  static create(): AgentContext {
    return new AgentContext();
  }

  complexity(level: 'low' | 'medium' | 'high'): AgentContext {
    this.context.complexity = level;
    return this;
  }

  requiresValidation(required: boolean = true): AgentContext {
    this.context.requiresValidation = required;
    return this;
  }

  requiresAuthentication(required: boolean = true): AgentContext {
    this.context.requiresAuthentication = required;
    return this;
  }

  nodeExpertise(required: boolean = true): AgentContext {
    this.context.nodeExpertise = required;
    return this;
  }

  quickHelp(required: boolean = true): AgentContext {
    this.context.quickHelp = required;
    return this;
  }

  documentation(required: boolean = true): AgentContext {
    this.context.documentation = required;
    return this;
  }

  community(required: boolean = true): AgentContext {
    this.context.community = required;
    return this;
  }

  securityCheck(required: boolean = true): AgentContext {
    this.context.securityCheck = required;
    return this;
  }

  build(): any {
    return this.context;
  }
}