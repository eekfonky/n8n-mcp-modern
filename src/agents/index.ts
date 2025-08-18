/**
 * Optimized Agent System for n8n MCP Modern
 * Implements the 6-agent hierarchy optimized for Claude Code development workflows
 * 
 * TIER 1 - Master Orchestrator (1):
 *   - n8n-workflow-architect
 * 
 * TIER 2 - Core Domain Specialists (4):
 *   - n8n-developer-specialist [NEW] - Code generation, templates, DevOps
 *   - n8n-integration-specialist - Authentication, APIs, connectivity  
 *   - n8n-node-specialist [ENHANCED] - Nodes + AI/ML + community
 *   - n8n-performance-specialist [NEW] - Monitoring, optimization, analytics
 * 
 * TIER 3 - Support Specialist (1):
 *   - n8n-guidance-specialist [MERGED] - Documentation + support + admin
 */

import { logger } from '../server/logger.js';

/**
 * Agent capability types - used in agent definitions
 */
export enum AgentCapability {
  WORKFLOW_DESIGN = 'workflow_design',
  CODE_GENERATION = 'code_generation',
  DEVELOPER_WORKFLOWS = 'developer_workflows', 
  NODE_EXPERTISE = 'node_expertise',
  AUTHENTICATION = 'authentication',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  MONITORING_ANALYTICS = 'monitoring_analytics',
  DOCUMENTATION = 'documentation',
  RESEARCH = 'research',
  COMMUNITY = 'community',
  SYSTEM_ADMIN = 'system_admin',
  GUIDANCE_SUPPORT = 'guidance_support'
}

/**
 * Agent tier levels - used in agent hierarchy  
 */
export enum AgentTier {
  MASTER = 1,       // Master Orchestrator (1 agent)
  SPECIALIST = 2,   // Core Domain Specialists (4 agents)  
  SUPPORT = 3       // Support Specialist (1 agent)
}

/**
 * Agent context for routing decisions
 */
export interface AgentContext {
  complexity?: 'low' | 'medium' | 'high';
  requiresValidation?: boolean;
  requiresAuthentication?: boolean;
  connectivity?: boolean;
  nodeExpertise?: boolean;
  nodeConfiguration?: boolean;
  quickHelp?: boolean;
  documentation?: boolean;
  setupGuide?: boolean;
  troubleshooting?: boolean;
  userManagement?: boolean;
  systemAdmin?: boolean;
  guidance?: boolean;
  community?: boolean;
  codeGeneration?: boolean;
  developerWorkflow?: boolean;
  template?: boolean;
  performance?: boolean;
  optimization?: boolean;
  monitoring?: boolean;
  analytics?: boolean;
  requiresOrchestration?: boolean;
}

/**
 * Base agent interface
 */
export interface Agent {
  name: string;
  tier: AgentTier;
  capabilities: AgentCapability[];
  description: string;
  canHandle(toolName: string, context?: AgentContext): boolean;
  getPriority(toolName: string, context?: AgentContext): number;
}

/**
 * TIER 1 - Master Orchestrator
 */
export class WorkflowArchitect implements Agent {
  name = 'n8n-workflow-architect';
  tier = AgentTier.MASTER;     // Used in tier filtering
  capabilities = [
    AgentCapability.WORKFLOW_DESIGN  // Used in capability filtering
  ];
  description = 'Master orchestrator for complex, multi-step n8n automation projects. Strategic planning, workflow architecture, and multi-agent coordination.';

  canHandle(toolName: string, context?: AgentContext): boolean {
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

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.complexity === 'high') return 10;
    if (this.canHandle(toolName, context)) return 8;
    return 5; // Default coordinator priority
  }
}

/**
 * TIER 2 - Core Domain Specialists
 */
export class DeveloperSpecialist implements Agent {
  name = 'n8n-developer-specialist';
  tier = AgentTier.SPECIALIST; // Used in tier filtering
  capabilities = [
    AgentCapability.CODE_GENERATION,     // Used in capability filtering
    AgentCapability.DEVELOPER_WORKFLOWS  // Used in capability filtering
  ];
  description = 'Code generation, templates, and development workflow specialist. Transforms natural language into workflows, creates DevOps patterns, and provides infrastructure-as-code solutions.';

  canHandle(toolName: string, context?: AgentContext): boolean {
    const codeGenerationTools = [
      'generate_workflow_from_description',
      'create_api_integration_template',
      'build_data_processing_pipeline',
      'generate_notification_workflow',
      'create_webhook_handler',
      'export_workflow_as_template',
      'generate_docker_compose'
    ];
    
    return codeGenerationTools.includes(toolName) ||
           (context?.codeGeneration === true) ||
           (context?.developerWorkflow === true) ||
           (context?.template === true);
  }

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.codeGeneration === true) return 9;
    if (context?.developerWorkflow === true) return 9;
    if (context?.template === true) return 8;
    if (toolName.startsWith('generate_') || toolName.startsWith('create_') || toolName.startsWith('build_')) return 8;
    return 6;
  }
}

export class IntegrationSpecialist implements Agent {
  name = 'n8n-integration-specialist';
  tier = AgentTier.SPECIALIST; // Used in tier filtering
  capabilities = [AgentCapability.AUTHENTICATION]; // Used in capability filtering
  description = 'Authentication, API connectivity, and platform integration expert. OAuth flows, credential management, webhook setup, and secure connectivity across 525+ platforms.';

  canHandle(toolName: string, context?: AgentContext): boolean {
    const integrationTools = [
      'get_n8n_workflows',
      'activate_n8n_workflow',
      'deactivate_n8n_workflow'
    ];
    
    return integrationTools.includes(toolName) ||
           (context?.requiresAuthentication === true) ||
           (context?.connectivity === true);
  }

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.requiresAuthentication === true) return 9;
    if (context?.connectivity === true) return 8;
    return 7;
  }
}

export class NodeSpecialist implements Agent {
  name = 'n8n-node-specialist';
  tier = AgentTier.SPECIALIST; // Used in tier filtering
  capabilities = [
    AgentCapability.NODE_EXPERTISE, // Used in capability filtering
    AgentCapability.COMMUNITY       // Used in capability filtering
  ];
  description = '525+ node database expert, AI/ML specialist, and community solutions expert. Node discovery, configuration, AI/ML workflows, community patterns, and emerging automation trends.';

  canHandle(toolName: string, context?: AgentContext): boolean {
    const nodeTools = [
      'search_n8n_nodes'
    ];
    
    return nodeTools.includes(toolName) ||
           (context?.nodeExpertise === true) ||
           (context?.nodeConfiguration === true);
  }

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.nodeExpertise === true) return 9;
    if (context?.nodeConfiguration === true) return 8;
    if (toolName === 'search_n8n_nodes') return 9;
    return 6;
  }
}

export class PerformanceSpecialist implements Agent {
  name = 'n8n-performance-specialist';
  tier = AgentTier.SPECIALIST; // Used in tier filtering
  capabilities = [
    AgentCapability.PERFORMANCE_OPTIMIZATION, // Used in capability filtering
    AgentCapability.MONITORING_ANALYTICS       // Used in capability filtering
  ];
  description = 'Performance monitoring, optimization, and analytics expert. Real-time monitoring, bottleneck analysis, resource optimization, and predictive scaling recommendations.';

  canHandle(toolName: string, context?: AgentContext): boolean {
    const performanceTools = [
      'get_workflow_stats',
      'workflow_execution_analyzer',
      'performance_bottleneck_detector',
      'resource_usage_calculator',
      'optimization_recommender',
      'workflow_health_checker'
    ];
    
    return performanceTools.includes(toolName) ||
           (context?.performance === true) ||
           (context?.optimization === true) ||
           (context?.monitoring === true) ||
           (context?.analytics === true);
  }

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.performance === true) return 9;
    if (context?.optimization === true) return 9;
    if (context?.monitoring === true) return 8;
    if (context?.analytics === true) return 8;
    if (toolName.includes('performance') || toolName.includes('optimization')) return 8;
    return 6;
  }
}

/**
 * TIER 3 - Support Specialist  
 */
export class GuidanceSpecialist implements Agent {
  name = 'n8n-guidance-specialist';
  tier = AgentTier.SUPPORT;    // Used in tier filtering
  capabilities = [
    AgentCapability.DOCUMENTATION,     // Used in capability filtering
    AgentCapability.GUIDANCE_SUPPORT,  // Used in capability filtering
    AgentCapability.SYSTEM_ADMIN,      // Used in capability filtering
    AgentCapability.RESEARCH           // Used in capability filtering
  ];
  description = 'Documentation, troubleshooting, user management, and general support specialist. Setup guides, system administration, quick research, and comprehensive guidance.';

  canHandle(toolName: string, context?: AgentContext): boolean {
    const guidanceTools = [
      'get_tool_usage_stats',
      'get_n8n_workflow',
      'list_users',
      'get_user_info',
      'get_system_settings',
      'get_system_health',
      'create_workflow_documentation'
    ];
    
    return guidanceTools.includes(toolName) ||
           (context?.documentation === true) ||
           (context?.setupGuide === true) ||
           (context?.troubleshooting === true) ||
           (context?.userManagement === true) ||
           (context?.systemAdmin === true) ||
           (context?.guidance === true);
  }

  getPriority(toolName: string, context?: AgentContext): number {
    if (context?.documentation === true) return 7;
    if (context?.setupGuide === true) return 7;
    if (context?.userManagement === true) return 7;
    if (context?.systemAdmin === true) return 6;
    if (context?.guidance === true) return 6;
    return 4; // General support priority
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
      new DeveloperSpecialist(),
      new IntegrationSpecialist(),
      new NodeSpecialist(), 
      new PerformanceSpecialist(),
      new GuidanceSpecialist()
    ];
  }

  /**
   * Route a tool call to the most appropriate agent
   */
  routeTool(toolName: string, context?: AgentContext): Agent {
    // Calculate priorities for each agent
    const candidates = this.agents
      .filter(agent => agent.canHandle(toolName, context))
      .map(agent => ({
        agent,
        priority: agent.getPriority(toolName, context)
      }))
      .sort((a, b) => b.priority - a.priority);

    if (candidates.length === 0) {
      // Default to guidance specialist for unhandled tools
      logger.warn(`No specific agent for tool ${toolName}, using guidance specialist`);
      const guidance = this.agents.find(a => a.name === 'n8n-guidance-specialist');
      if (!guidance) {
        throw new Error('Guidance specialist agent not found');
      }
      return guidance;
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
    return this.agents.find(agent => agent.name === name) ?? null;
  }

  /**
   * Get agent by ID (alias for getAgent for backward compatibility)
   */
  getAgentById(id: string): Agent | undefined {
    return this.getAgent(id) ?? undefined;
  }

  /**
   * Route to agent based on text query (intelligent routing)
   */
  async routeToAgent(query: string): Promise<Agent | undefined> {
    if (!query || typeof query !== 'string') {
      return this.getAgent('n8n-guidance-specialist') ?? undefined;
    }

    const lowerQuery = query.toLowerCase();

    // Authentication/integration queries (PRIMARY focus on auth, not workflow creation with auth)
    if (((lowerQuery.includes('oauth') || lowerQuery.includes('auth') || lowerQuery.includes('credential')) &&
         (lowerQuery.includes('setup') || lowerQuery.includes('configure') || lowerQuery.includes('connect'))) ||
        lowerQuery.includes('webhook') || 
        (lowerQuery.includes('api') && (lowerQuery.includes('setup') || lowerQuery.includes('authentication'))) ||
        (lowerQuery.includes('integration') && !lowerQuery.includes('create') && !lowerQuery.includes('workflow'))) {
      return this.getAgent('n8n-integration-specialist') ?? undefined;
    }

    // Documentation and setup queries (but not auth setup)
    if ((lowerQuery.includes('how to') || lowerQuery.includes('setup') || lowerQuery.includes('guide')) &&
        !lowerQuery.includes('oauth') && !lowerQuery.includes('auth') && !lowerQuery.includes('credential') ||
        (lowerQuery.includes('docker') && (lowerQuery.includes('set up') || lowerQuery.includes('install')))) {
      return this.getAgent('n8n-guidance-specialist') ?? undefined;
    }

    // Code generation and development queries (HIGHEST PRIORITY for Claude Code users)
    // BUT NOT for "complex" queries which should go to architect
    if ((lowerQuery.includes('generate') || lowerQuery.includes('create') || lowerQuery.includes('build') ||
         lowerQuery.includes('template') || lowerQuery.includes('ci/cd') || lowerQuery.includes('deploy') ||
         lowerQuery.includes('pipeline') || lowerQuery.includes('infrastructure')) &&
        !lowerQuery.includes('complex') && !lowerQuery.includes('enterprise') && !lowerQuery.includes('design')) {
      return this.getAgent('n8n-developer-specialist') ?? undefined;
    }

    // Performance and optimization queries
    if (lowerQuery.includes('optimize') || lowerQuery.includes('performance') || lowerQuery.includes('slow') ||
        lowerQuery.includes('monitor') || lowerQuery.includes('analytics') || lowerQuery.includes('metrics') ||
        lowerQuery.includes('bottleneck') || lowerQuery.includes('resource')) {
      return this.getAgent('n8n-performance-specialist') ?? undefined;
    }

    // Complex/strategic queries go to architect (TIER 1)
    if (lowerQuery.includes('complex') || lowerQuery.includes('enterprise') || lowerQuery.includes('design') || 
        lowerQuery.includes('orchestrat') || lowerQuery.includes('strategic') || lowerQuery.includes('architecture')) {
      const architect = this.getAgent('n8n-workflow-architect');
      if (architect) return architect;
      // Fallback to guidance if architect unavailable
      return this.getAgent('n8n-guidance-specialist') ?? undefined;
    }


    // Node discovery and AI/ML queries (includes community patterns)
    if (lowerQuery.includes('nodes') || lowerQuery.includes('available') || lowerQuery.includes('ai') ||
        lowerQuery.includes('openai') || lowerQuery.includes('gpt') || lowerQuery.includes('ml') ||
        lowerQuery.includes('community') || lowerQuery.includes('find') || lowerQuery.includes('discover')) {
      return this.getAgent('n8n-node-specialist') ?? undefined;
    }

    // Documentation, setup, and admin queries
    if (lowerQuery.includes('documentation') || lowerQuery.includes('setup') || lowerQuery.includes('how to') ||
        lowerQuery.includes('user') || lowerQuery.includes('system') || lowerQuery.includes('help') ||
        lowerQuery.includes('guide') || lowerQuery.includes('troubleshoot')) {
      return this.getAgent('n8n-guidance-specialist') ?? undefined;
    }

    // Default to guidance specialist for general queries
    return this.getAgent('n8n-guidance-specialist') ?? undefined;
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
   * Get optimized agent summary for Claude Code users
   */
  getAgentSummary(): { tier: string; agents: { name: string; description: string; }[]; }[] {
    return [
      {
        tier: 'TIER 1 - Master Orchestrator',
        agents: this.getAgentsByTier(AgentTier.MASTER).map(agent => ({
          name: agent.name,
          description: agent.description
        }))
      },
      {
        tier: 'TIER 2 - Core Domain Specialists', 
        agents: this.getAgentsByTier(AgentTier.SPECIALIST).map(agent => ({
          name: agent.name,
          description: agent.description
        }))
      },
      {
        tier: 'TIER 3 - Support Specialist',
        agents: this.getAgentsByTier(AgentTier.SUPPORT).map(agent => ({
          name: agent.name,
          description: agent.description
        }))
      }
    ];
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
export class AgentContextBuilder {
  private context: AgentContext = {};

  static create(): AgentContextBuilder {
    return new AgentContextBuilder();
  }

  complexity(level: 'low' | 'medium' | 'high'): AgentContextBuilder {
    this.context.complexity = level;
    return this;
  }

  requiresValidation(required: boolean = true): AgentContextBuilder {
    this.context.requiresValidation = required;
    return this;
  }

  requiresAuthentication(required: boolean = true): AgentContextBuilder {
    this.context.requiresAuthentication = required;
    return this;
  }

  nodeExpertise(required: boolean = true): AgentContextBuilder {
    this.context.nodeExpertise = required;
    return this;
  }

  quickHelp(required: boolean = true): AgentContextBuilder {
    this.context.quickHelp = required;
    return this;
  }

  documentation(required: boolean = true): AgentContextBuilder {
    this.context.documentation = required;
    return this;
  }

  community(required: boolean = true): AgentContextBuilder {
    this.context.community = required;
    return this;
  }

  codeGeneration(required: boolean = true): AgentContextBuilder {
    this.context.codeGeneration = required;
    return this;
  }

  developerWorkflow(required: boolean = true): AgentContextBuilder {
    this.context.developerWorkflow = required;
    return this;
  }

  performance(required: boolean = true): AgentContextBuilder {
    this.context.performance = required;
    return this;
  }

  optimization(required: boolean = true): AgentContextBuilder {
    this.context.optimization = required;
    return this;
  }

  monitoring(required: boolean = true): AgentContextBuilder {
    this.context.monitoring = required;
    return this;
  }

  guidance(required: boolean = true): AgentContextBuilder {
    this.context.guidance = required;
    return this;
  }

  systemAdmin(required: boolean = true): AgentContextBuilder {
    this.context.systemAdmin = required;
    return this;
  }

  build(): AgentContext {
    return this.context;
  }
}

// Export AgentContextBuilder as AgentContext for test compatibility
export const AgentContext = AgentContextBuilder;