/**
 * Complete 15-agent hierarchy definitions for n8n-MCP Modern
 * Optimized for 682+ node ecosystem with model tiers and collaboration patterns
 */

import type { AgentSpecialization } from './types.js'
import { CLAUDE_MODEL_TIERS } from './types.js'

/**
 * Complete 15-agent hierarchy optimized for 682+ node ecosystem with model tiers
 */
export const AGENT_DEFINITIONS: readonly AgentSpecialization[] = [
  // TIER 1 - Strategic Orchestration
  {
    name: 'n8n-orchestrator',
    tier: 1,
    displayName: 'Master Orchestrator',
    description: 'Strategic planning, workflow architecture, and multi-agent coordination',
    domains: ['workflow-orchestration', 'strategic-planning', 'architecture-review'],
    nodePatterns: ['*complex-workflow*', '*multi-step*', '*enterprise*'],
    expertise: [
      'Workflow architecture design',
      'Multi-agent coordination',
      'Complex automation strategies',
      'Enterprise workflow patterns',
      'Performance planning',
      'Scalability architecture'
    ],
    toolAccess: [
      'delegate_agent_task',
      'analyze_workflow_complexity',
      'performance_monitoring',
      'session_management',
      'memory_management'
    ],
    collaboratesWith: [
      'n8n-architect',
      'n8n-builder',
      'n8n-workflow',
      'n8n-performance'
    ],
    maxConcurrentTasks: 10,
    specializedKnowledge: [
      'Workflow design patterns',
      'Agent coordination strategies',
      'Performance bottleneck identification',
      'Enterprise automation requirements'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.SONNET,
      fallbackModel: CLAUDE_MODEL_TIERS.OPUS,
      modelReason: 'Balanced capability for strategic coordination with Opus fallback for complex decisions'
    }
  },

  // TIER 2 - Core Architecture Specialists
  {
    name: 'n8n-architect',
    tier: 2,
    displayName: 'Workflow Architect',
    description: 'Workflow architecture patterns, performance design, and scalability',
    domains: ['architecture', 'performance', 'scalability', 'patterns'],
    nodePatterns: ['*trigger*', '*webhook*', '*schedule*', '*execute*'],
    expertise: [
      'Workflow architecture patterns',
      'Performance optimization strategies',
      'Scalability design principles',
      'Error handling architectures',
      'State management patterns',
      'Real-time processing design'
    ],
    toolAccess: [
      'analyze_workflow_architecture',
      'performance_monitoring',
      'memory_optimization',
      'cold_start_optimization',
      'workflow_validation'
    ],
    collaboratesWith: [
      'n8n-orchestrator',
      'n8n-performance',
      'n8n-workflow'
    ],
    maxConcurrentTasks: 8,
    specializedKnowledge: [
      'Microservices architecture patterns',
      'Event-driven architecture',
      'Batch vs stream processing',
      'Caching strategies',
      'Load balancing techniques'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Balanced capability for architectural decisions and pattern recognition'
    }
  },

  {
    name: 'n8n-builder',
    tier: 2,
    displayName: 'Workflow Builder',
    description: 'Code generation, DevOps workflows, and implementation',
    domains: ['code-generation', 'devops', 'implementation', 'deployment'],
    nodePatterns: ['*code*', '*function*', '*execute*', '*webhook*', '*http*'],
    expertise: [
      'JavaScript/TypeScript code generation',
      'DevOps workflow automation',
      'CI/CD pipeline creation',
      'API integration patterns',
      'Custom node development',
      'Workflow templating'
    ],
    toolAccess: [
      'generate_workflow',
      'create_code_node',
      'validate_javascript',
      'build_templates',
      'deployment_tools'
    ],
    collaboratesWith: [
      'n8n-scriptguard',
      'n8n-architect',
      'n8n-workflow'
    ],
    maxConcurrentTasks: 10,
    specializedKnowledge: [
      'Modern JavaScript/TypeScript patterns',
      'DevOps best practices',
      'Container orchestration',
      'API design principles',
      'Version control workflows'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Balanced capability for code generation and DevOps workflows'
    }
  },

  {
    name: 'n8n-connector',
    tier: 2,
    displayName: 'Connection Specialist',
    description: 'Authentication, connectivity, and security protocols',
    domains: ['authentication', 'connectivity', 'security', 'protocols'],
    nodePatterns: ['*auth*', '*oauth*', '*api*', '*credential*', '*token*'],
    expertise: [
      'OAuth 2.0 implementation',
      'API authentication patterns',
      'Secure credential management',
      'Connection pooling',
      'Rate limiting strategies',
      'SSL/TLS configuration'
    ],
    toolAccess: [
      'setup_authentication',
      'manage_credentials',
      'test_connections',
      'security_validation',
      'rate_limit_management'
    ],
    collaboratesWith: [
      'n8n-scriptguard',
      'n8n-cloud',
      'n8n-ecommerce'
    ],
    maxConcurrentTasks: 12,
    specializedKnowledge: [
      'Security protocols and standards',
      'API gateway patterns',
      'Identity provider integration',
      'Certificate management',
      'Network security'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Balanced capability for security protocols and authentication patterns'
    }
  },

  {
    name: 'n8n-scriptguard',
    tier: 2,
    displayName: 'Security Guardian',
    description: 'JavaScript validation, security analysis, and code quality',
    domains: ['security', 'validation', 'code-quality', 'compliance'],
    nodePatterns: ['*code*', '*function*', '*script*', '*eval*'],
    expertise: [
      'JavaScript security analysis',
      'Code injection prevention',
      'Input sanitization',
      'Security compliance validation',
      'Performance security impact',
      'Vulnerability assessment'
    ],
    toolAccess: [
      'validate_javascript',
      'security_scan',
      'vulnerability_check',
      'code_analysis',
      'compliance_validation'
    ],
    collaboratesWith: [
      'n8n-builder',
      'n8n-connector',
      'n8n-ai'
    ],
    maxConcurrentTasks: 15,
    specializedKnowledge: [
      'OWASP security guidelines',
      'JavaScript security best practices',
      'Static code analysis techniques',
      'Runtime security monitoring',
      'Compliance frameworks (SOC2, ISO27001)'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Balanced capability for security analysis and code validation'
    }
  },

  // TIER 3 - Domain Specialists
  {
    name: 'n8n-data',
    tier: 3,
    displayName: 'Data Processing Specialist',
    description: 'Databases, ETL workflows, data transformation, and analytics',
    domains: ['databases', 'etl', 'data-processing', 'analytics'],
    nodePatterns: [
      '*postgres*', '*mysql*', '*mongo*', '*redis*', '*elastic*',
      '*sql*', '*database*', '*table*', '*query*', '*aggregate*',
      '*transform*', '*split*', '*merge*', '*sort*', '*filter*'
    ],
    expertise: [
      'SQL optimization and tuning',
      'ETL pipeline design',
      'Data transformation patterns',
      'Database performance optimization',
      'Data modeling and normalization',
      'Analytics workflow creation'
    ],
    toolAccess: [
      'database_query_optimizer',
      'etl_pipeline_generator',
      'data_transformation_tools',
      'analytics_workflow_builder'
    ],
    collaboratesWith: [
      'n8n-cloud',
      'n8n-ai',
      'n8n-performance'
    ],
    maxConcurrentTasks: 12,
    specializedKnowledge: [
      'Database optimization techniques',
      'Data pipeline architectures',
      'Stream processing patterns',
      'Data warehouse design',
      'Business intelligence workflows'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.OPUS,
      fallbackModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Complex reasoning required for data modeling and ETL optimization'
    }
  },

  {
    name: 'n8n-cloud',
    tier: 3,
    displayName: 'Cloud Integration Specialist',
    description: 'AWS, GCP, Azure, cloud-native patterns, and serverless',
    domains: ['cloud-services', 'serverless', 'containers', 'infrastructure'],
    nodePatterns: [
      '*aws*', '*google*', '*azure*', '*s3*', '*lambda*', '*cloud*',
      '*serverless*', '*function*', '*storage*', '*compute*', '*kubernetes*'
    ],
    expertise: [
      'Multi-cloud integration strategies',
      'Serverless architecture patterns',
      'Container orchestration workflows',
      'Cloud cost optimization',
      'Infrastructure as code',
      'Hybrid cloud connectivity'
    ],
    toolAccess: [
      'cloud_service_integrator',
      'serverless_optimizer',
      'infrastructure_manager',
      'cost_optimizer'
    ],
    collaboratesWith: [
      'n8n-data',
      'n8n-architect',
      'n8n-connector'
    ],
    maxConcurrentTasks: 10,
    specializedKnowledge: [
      'Cloud architecture patterns',
      'Serverless best practices',
      'Infrastructure automation',
      'Cloud security and compliance',
      'Multi-region deployment strategies'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Balanced capability for cloud service integration and infrastructure management'
    }
  },

  {
    name: 'n8n-ecommerce',
    tier: 3,
    displayName: 'E-commerce Specialist',
    description: 'E-commerce platforms, online retail, inventory, and order management',
    domains: ['ecommerce', 'retail', 'inventory', 'orders'],
    nodePatterns: [
      '*shopify*', '*woocommerce*', '*magento*', '*prestashop*',
      '*order*', '*product*', '*inventory*', '*catalog*', '*cart*'
    ],
    expertise: [
      'E-commerce platform integration',
      'Product catalog management',
      'Order fulfillment automation',
      'Inventory management systems',
      'Customer journey optimization',
      'Multi-channel retail workflows'
    ],
    toolAccess: [
      'ecommerce_integrator',
      'inventory_manager',
      'order_processor',
      'catalog_optimizer'
    ],
    collaboratesWith: [
      'n8n-finance',
      'n8n-data',
      'n8n-communication'
    ],
    maxConcurrentTasks: 8,
    specializedKnowledge: [
      'E-commerce platform APIs',
      'Inventory optimization strategies',
      'Order lifecycle management',
      'Product data standards',
      'Multi-channel synchronization'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Balanced capability for e-commerce platform integration and workflow optimization'
    }
  },

  {
    name: 'n8n-finance',
    tier: 3,
    displayName: 'Finance Specialist',
    description: 'Payments, financial workflows, accounting, and compliance',
    domains: ['finance', 'payments', 'accounting', 'compliance'],
    nodePatterns: [
      '*stripe*', '*paypal*', '*square*', '*payment*', '*invoice*',
      '*tax*', '*accounting*', '*quickbooks*', '*xero*', '*financial*',
      '*banking*', '*ledger*', '*transaction*'
    ],
    expertise: [
      'Payment processing optimization',
      'Financial data workflows',
      'Tax calculation and compliance',
      'Accounting system integration',
      'Financial reporting automation',
      'Regulatory compliance workflows'
    ],
    toolAccess: [
      'payment_processor',
      'financial_analyzer',
      'compliance_checker',
      'accounting_integrator'
    ],
    collaboratesWith: [
      'n8n-ecommerce',
      'n8n-connector',
      'n8n-data'
    ],
    maxConcurrentTasks: 8,
    specializedKnowledge: [
      'PCI DSS compliance',
      'Financial regulations (PSD2, GDPR)',
      'Payment gateway integration patterns',
      'Fraud prevention techniques',
      'Financial data security'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Balanced capability for payment processing and financial compliance'
    }
  },

  {
    name: 'n8n-communication',
    tier: 3,
    displayName: 'Communication Specialist',
    description: 'Messaging platforms, notifications, social media, and communication workflows',
    domains: ['messaging', 'notifications', 'social-media', 'communication'],
    nodePatterns: [
      '*slack*', '*discord*', '*teams*', '*telegram*', '*whatsapp*',
      '*email*', '*sms*', '*notification*', '*message*', '*chat*',
      '*social*', '*twitter*', '*facebook*', '*linkedin*'
    ],
    expertise: [
      'Multi-platform messaging strategies',
      'Notification orchestration',
      'Social media automation',
      'Communication workflow optimization',
      'Broadcast and targeting strategies',
      'Message templating and personalization'
    ],
    toolAccess: [
      'messaging_orchestrator',
      'notification_manager',
      'social_media_automation',
      'communication_analytics'
    ],
    collaboratesWith: [
      'n8n-ai',
      'n8n-automation',
      'n8n-data'
    ],
    maxConcurrentTasks: 12,
    specializedKnowledge: [
      'Multi-channel communication strategies',
      'Message queue patterns',
      'Social media API limitations',
      'Communication compliance (GDPR, CAN-SPAM)',
      'Real-time messaging architectures'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.HAIKU,
      fallbackModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Fast throughput for high-volume messaging with Sonnet fallback for complex scenarios'
    }
  },

  {
    name: 'n8n-ai',
    tier: 3,
    displayName: 'AI & Machine Learning Specialist',
    description: 'AI/ML workflows, LLMs, data science, and intelligent automation',
    domains: ['artificial-intelligence', 'machine-learning', 'data-science', 'nlp'],
    nodePatterns: [
      '*openai*', '*anthropic*', '*hugging*', '*tensorflow*', '*pytorch*',
      '*ai*', '*ml*', '*gpt*', '*claude*', '*model*', '*predict*',
      '*classify*', '*embedding*', '*vector*', '*semantic*'
    ],
    expertise: [
      'LLM integration and optimization',
      'Machine learning pipeline creation',
      'Natural language processing workflows',
      'Computer vision automation',
      'AI model deployment patterns',
      'Intelligent data processing'
    ],
    toolAccess: [
      'ai_workflow_generator',
      'llm_optimizer',
      'ml_pipeline_builder',
      'model_performance_analyzer'
    ],
    collaboratesWith: [
      'n8n-data',
      'n8n-cloud',
      'n8n-scriptguard'
    ],
    maxConcurrentTasks: 12,
    specializedKnowledge: [
      'LLM prompt engineering',
      'ML model lifecycle management',
      'AI ethics and bias mitigation',
      'Vector database optimization',
      'AI workflow cost optimization'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.OPUS,
      fallbackModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Complex reasoning and advanced capabilities required for AI/ML workflow optimization'
    }
  },

  {
    name: 'n8n-automation',
    tier: 3,
    displayName: 'IoT & Automation Specialist',
    description: 'IoT devices, smart home, industrial automation, and sensor workflows',
    domains: ['iot', 'smart-home', 'industrial', 'sensors'],
    nodePatterns: [
      '*mqtt*', '*home*', '*assistant*', '*philips*', '*hue*', '*smart*',
      '*iot*', '*sensor*', '*device*', '*arduino*', '*raspberry*',
      '*automation*', '*control*', '*monitor*'
    ],
    expertise: [
      'IoT device integration',
      'Smart home automation',
      'Industrial control systems',
      'Sensor data processing',
      'Device communication protocols',
      'Real-time monitoring systems'
    ],
    toolAccess: [
      'iot_device_manager',
      'sensor_data_processor',
      'automation_controller',
      'device_monitor'
    ],
    collaboratesWith: [
      'n8n-data',
      'n8n-communication',
      'n8n-performance'
    ],
    maxConcurrentTasks: 10,
    specializedKnowledge: [
      'IoT communication protocols (MQTT, CoAP)',
      'Edge computing patterns',
      'Industrial automation standards',
      'Smart home ecosystems',
      'Real-time data processing'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.HAIKU,
      fallbackModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Fast throughput for high-frequency IoT data processing with Sonnet for complex automation logic'
    }
  },

  // TIER 4 - Specialized Support
  {
    name: 'n8n-workflow',
    tier: 4,
    displayName: 'Workflow Specialist',
    description: 'Workflow templates, patterns, file operations, and reusable components',
    domains: ['templates', 'patterns', 'files', 'components'],
    nodePatterns: ['*template*', '*pattern*', '*file*', '*upload*', '*download*', '*document*'],
    expertise: [
      'Workflow template creation',
      'Reusable component development',
      'File processing workflows',
      'Document automation',
      'Pattern library management',
      'Component integration strategies'
    ],
    toolAccess: [
      'template_generator',
      'pattern_analyzer',
      'file_processor',
      'component_builder',
      'workflow_composer'
    ],
    collaboratesWith: [
      'n8n-orchestrator',
      'n8n-architect',
      'n8n-builder',
      'n8n-data'
    ],
    maxConcurrentTasks: 10,
    specializedKnowledge: [
      'Workflow design patterns',
      'Template architecture',
      'File format processing',
      'Component reusability',
      'Integration testing patterns'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Balanced capability for template creation and workflow pattern optimization'
    }
  },

  {
    name: 'n8n-performance',
    tier: 4,
    displayName: 'Performance Specialist',
    description: 'Workflow performance tuning, resource optimization, and scalability',
    domains: ['performance', 'optimization', 'scalability', 'monitoring'],
    nodePatterns: ['*performance*', '*optimize*', '*cache*', '*memory*', '*cpu*'],
    expertise: [
      'Workflow performance analysis',
      'Resource usage optimization',
      'Caching strategy implementation',
      'Bottleneck identification',
      'Scalability testing',
      'Performance monitoring setup'
    ],
    toolAccess: [
      'performance_analyzer',
      'resource_optimizer',
      'cache_manager',
      'monitoring_setup'
    ],
    collaboratesWith: [
      'n8n-architect',
      'n8n-orchestrator',
      'n8n-data',
      'n8n-cloud'
    ],
    maxConcurrentTasks: 8,
    specializedKnowledge: [
      'Performance profiling techniques',
      'Resource optimization strategies',
      'Caching patterns and strategies',
      'Load testing methodologies',
      'Performance monitoring tools'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Balanced capability for performance analysis and optimization strategies'
    }
  },

  {
    name: 'n8n-guide',
    tier: 4,
    displayName: 'Documentation & Support Guide',
    description: 'Documentation, tutorials, user guidance, and knowledge management',
    domains: ['documentation', 'tutorials', 'support', 'knowledge'],
    nodePatterns: ['*help*', '*guide*', '*tutorial*', '*documentation*'],
    expertise: [
      'Technical documentation creation',
      'Tutorial and guide development',
      'User support workflows',
      'Knowledge base management',
      'Training material creation',
      'Community support patterns'
    ],
    toolAccess: [
      'documentation_generator',
      'tutorial_creator',
      'knowledge_manager',
      'support_analyzer'
    ],
    collaboratesWith: [
      'n8n-orchestrator',
      'n8n-builder',
      'n8n-workflow'
    ],
    maxConcurrentTasks: 10,
    specializedKnowledge: [
      'Technical writing best practices',
      'Knowledge management systems',
      'User experience design',
      'Community engagement strategies',
      'Training and education methodologies'
    ],
    modelConfig: {
      primaryModel: CLAUDE_MODEL_TIERS.HAIKU,
      fallbackModel: CLAUDE_MODEL_TIERS.SONNET,
      modelReason: 'Fast information gathering and documentation with Sonnet for complex explanations'
    }
  }
] as const