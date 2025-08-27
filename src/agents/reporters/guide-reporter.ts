/**
 * Memory-Efficient Guide Reporter
 * Token-optimized reporting for n8n-guide agent
 *
 * TECH DEBT CLEANUP:
 * - Proper TypeScript interfaces (no 'any' types)
 * - Memory-bounded documentation cache
 * - No setTimeout/setInterval memory leaks
 * - Efficient help response generation
 */

import { MemoryEfficientReporter } from '../memory-optimized-base.js'

interface GuideSection {
  title: string
  content: string
  category: 'tutorial' | 'reference' | 'troubleshooting' | 'best-practices'
  lastUpdated: string
}

/**
 * Bounded documentation cache - prevents memory leaks
 * FIXES: Unbounded help documentation accumulation
 */
class BoundedDocumentationCache {
  private cache: Map<string, GuideSection> = new Map()
  private readonly maxSize = 15 // Aggressive memory optimization: reduced from 150 to 15

  set(key: string, section: GuideSection): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest documentation sections
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, section)
  }

  get(key: string): GuideSection | undefined {
    return this.cache.get(key)
  }

  getSize(): number {
    return this.cache.size
  }

  clear(): void {
    this.cache.clear()
  }
}

export class GuideReporter extends MemoryEfficientReporter {
  private documentationCache = new BoundedDocumentationCache()

  constructor() {
    super('guide-reporter')
  }

  async report(request: Record<string, unknown>): Promise<Record<string, unknown>> {
    const query = (String(request.query || request.description || '')).toLowerCase()
    this.logOptimization('guide_query')

    // Fast pattern matching - no complex analysis
    if (query.includes('tutorial') || query.includes('guide')) {
      return this.getTutorials(query)
    }
    if (query.includes('help') || query.includes('how')) {
      return this.getQuickHelp(query)
    }
    if (query.includes('troubleshoot') || query.includes('error') || query.includes('problem')) {
      return this.getTroubleshooting(query)
    }
    if (query.includes('best') || query.includes('practice') || query.includes('recommend')) {
      return this.getBestPractices()
    }
    if (query.includes('reference') || query.includes('docs')) {
      return this.getReference(query)
    }
    if (query.includes('examples') || query.includes('template')) {
      return this.getExamples(query)
    }

    return this.getQuickHelp('')
  }

  /**
   * Get available tutorials
   * TECH DEBT FIX: No complex processing, bounded data
   */
  private getTutorials(_query: string): Record<string, unknown> {
    return this.createResponse({
      available_tutorials: [
        {
          title: 'Getting Started with n8n Workflows',
          difficulty: 'beginner',
          duration: '15 minutes',
          topics: ['workflow creation', 'basic nodes', 'connections'],
        },
        {
          title: 'Advanced Node Configuration',
          difficulty: 'intermediate',
          duration: '30 minutes',
          topics: ['expressions', 'conditional logic', 'error handling'],
        },
        {
          title: 'API Integration Patterns',
          difficulty: 'advanced',
          duration: '45 minutes',
          topics: ['authentication', 'rate limiting', 'data transformation'],
        },
        {
          title: 'Workflow Optimization',
          difficulty: 'intermediate',
          duration: '25 minutes',
          topics: ['performance', 'monitoring', 'debugging'],
        },
      ],
      categories: {
        beginner: 8,
        intermediate: 12,
        advanced: 6,
      },
      total_tutorials: 26,
      cached_content: this.documentationCache.getSize(),
    }, 'tutorials_list')
  }

  /**
   * Get quick help responses
   */
  private getQuickHelp(query: string): Record<string, unknown> {
    // Extract help topic from query
    const helpTopics = this.extractHelpTopics(query)

    if (helpTopics.length === 0) {
      return this.createResponse({
        message: 'Available help topics',
        topics: [
          'workflow creation',
          'node configuration',
          'troubleshooting',
          'best practices',
          'API integration',
          'debugging',
          'performance optimization',
          'security',
        ],
        usage: 'Ask specific questions like "how to create webhook" or "troubleshoot connection error"',
      }, 'help_overview')
    }

    return this.createResponse({
      help_provided: true,
      topics_addressed: helpTopics,
      quick_answers: this.generateQuickAnswers(helpTopics),
      further_reading: 'Use "tutorial" or "reference" for detailed information',
    }, 'quick_help')
  }

  /**
   * Get troubleshooting information
   * TECH DEBT FIX: Bounded troubleshooting data, no memory accumulation
   */
  private getTroubleshooting(_query: string): Record<string, unknown> {
    const commonIssues = [
      {
        issue: 'Connection Timeout',
        symptoms: ['workflow hangs', 'timeout errors', 'no response'],
        solutions: ['Check API endpoints', 'Increase timeout', 'Verify network connectivity'],
        frequency: 'high',
      },
      {
        issue: 'Authentication Failed',
        symptoms: ['401 errors', 'invalid credentials', 'token expired'],
        solutions: ['Refresh API keys', 'Check OAuth flow', 'Verify permissions'],
        frequency: 'high',
      },
      {
        issue: 'Data Transformation Error',
        symptoms: ['unexpected output', 'missing fields', 'type errors'],
        solutions: ['Check expressions', 'Validate input data', 'Use Set node for debugging'],
        frequency: 'medium',
      },
      {
        issue: 'Webhook Not Triggering',
        symptoms: ['no workflow execution', 'missing events', 'silent failures'],
        solutions: ['Check webhook URL', 'Verify HTTP method', 'Test with manual trigger'],
        frequency: 'medium',
      },
    ]

    return this.createResponse({
      common_issues: commonIssues.slice(0, 10), // Limit response size
      diagnostic_steps: [
        'Check execution logs',
        'Test individual nodes',
        'Verify credentials',
        'Review error messages',
      ],
      support_resources: {
        documentation: 'available',
        community_forum: 'active',
        issue_tracker: 'monitored',
      },
    }, 'troubleshooting_guide')
  }

  /**
   * Get best practices
   */
  private getBestPractices(): Record<string, unknown> {
    return this.createResponse({
      workflow_design: [
        'Use meaningful node names',
        'Add error handling to critical paths',
        'Implement proper logging',
        'Keep workflows focused and modular',
      ],
      performance: [
        'Minimize API calls in loops',
        'Use efficient data structures',
        'Implement caching where appropriate',
        'Monitor execution times',
      ],
      security: [
        'Store credentials securely',
        'Validate input data',
        'Use HTTPS for all connections',
        'Implement proper authentication',
      ],
      maintenance: [
        'Document workflow purpose',
        'Version control workflows',
        'Regular testing and validation',
        'Monitor for deprecated nodes',
      ],
    }, 'best_practices')
  }

  /**
   * Get reference documentation
   */
  private getReference(_query: string): Record<string, unknown> {
    return this.createResponse({
      api_reference: {
        endpoints: 'available',
        authentication: 'documented',
        rate_limits: 'specified',
        examples: 'provided',
      },
      node_reference: {
        core_nodes: 200,
        community_nodes: 325,
        custom_nodes: 'unlimited',
        documentation_coverage: '95%',
      },
      expression_reference: {
        functions: 'complete_list',
        variables: 'context_aware',
        examples: 'interactive',
        syntax_help: 'available',
      },
      integration_patterns: {
        common_apis: 'documented',
        authentication_flows: 'explained',
        error_handling: 'standardized',
        testing_approaches: 'recommended',
      },
    }, 'reference_docs')
  }

  /**
   * Get workflow examples
   * TECH DEBT FIX: Fast example generation without complex parsing
   */
  private getExamples(_query: string): Record<string, unknown> {
    const exampleCategories = [
      {
        category: 'Data Processing',
        examples: ['CSV to JSON conversion', 'API data enrichment', 'Data validation'],
        complexity: 'beginner',
      },
      {
        category: 'Automation',
        examples: ['Email notifications', 'File monitoring', 'Scheduled reports'],
        complexity: 'intermediate',
      },
      {
        category: 'Integration',
        examples: ['CRM sync', 'Database updates', 'Multi-platform posting'],
        complexity: 'advanced',
      },
      {
        category: 'Monitoring',
        examples: ['Health checks', 'Alert systems', 'Performance tracking'],
        complexity: 'intermediate',
      },
    ]

    return this.createResponse({
      example_workflows: exampleCategories,
      template_library: {
        total_templates: 45,
        categories: 4,
        difficulty_levels: 3,
        last_updated: new Date().toISOString(),
      },
      quick_start: 'Choose a category to see specific examples and implementation details',
    }, 'workflow_examples')
  }

  /**
   * Extract help topics from query
   */
  private extractHelpTopics(query: string): string[] {
    const topics: string[] = []
    const keywords = query.toLowerCase()

    if (keywords.includes('webhook'))
      topics.push('webhook')
    if (keywords.includes('api') || keywords.includes('http'))
      topics.push('api_integration')
    if (keywords.includes('database') || keywords.includes('sql'))
      topics.push('database')
    if (keywords.includes('email'))
      topics.push('email')
    if (keywords.includes('schedule') || keywords.includes('cron'))
      topics.push('scheduling')
    if (keywords.includes('error') || keywords.includes('debug'))
      topics.push('debugging')
    if (keywords.includes('auth') || keywords.includes('credential'))
      topics.push('authentication')
    if (keywords.includes('performance') || keywords.includes('slow'))
      topics.push('performance')

    return topics
  }

  /**
   * Generate quick answers for topics
   */
  private generateQuickAnswers(topics: string[]): Record<string, string> {
    const answers: Record<string, string> = {}

    topics.forEach((topic) => {
      switch (topic) {
        case 'webhook':
          answers[topic] = 'Create webhook node, copy URL, configure external service to POST to that URL'
          break
        case 'api_integration':
          answers[topic] = 'Use HTTP Request node, set method and URL, add authentication in credentials'
          break
        case 'database':
          answers[topic] = 'Use database-specific nodes (MySQL, PostgreSQL), configure connection, write SQL queries'
          break
        case 'email':
          answers[topic] = 'Use Email Send node, configure SMTP settings, compose message with dynamic content'
          break
        case 'scheduling':
          answers[topic] = 'Use Schedule Trigger node, set cron expression or interval for automated execution'
          break
        case 'debugging':
          answers[topic] = 'Check execution logs, use Set node to inspect data, test individual nodes'
          break
        case 'authentication':
          answers[topic] = 'Store credentials securely, use OAuth2 for modern APIs, rotate keys regularly'
          break
        case 'performance':
          answers[topic] = 'Minimize loops, use batch operations, implement caching, monitor execution times'
          break
        default:
          answers[topic] = 'General guidance available in documentation and tutorials'
      }
    })

    return answers
  }
}
