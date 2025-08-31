/**
 * Credential-based Node Discovery Engine
 *
 * Phase 2: Dynamic discovery of n8n nodes through credential testing
 *
 * Strategy:
 * 1. Get all available credential types from /api/v1/credentials
 * 2. Test each credential schema endpoint /api/v1/credentials/schema/{type}
 * 3. Extract node information from credential schemas
 * 4. Discover both official and community nodes
 * 5. Store discovered nodes in database with version tracking
 */

import type { N8NNodeDatabase } from '../types/core.js'
import process from 'node:process'
import { database, VersionManager } from '../database/index.js'
import { logger } from '../server/logger.js'
import { config } from '../simple-config.js'
import { SimpleHttpClient } from '../utils/simple-http-client.js'

const httpClient = new SimpleHttpClient()

/**
 * Credential type information from n8n API
 */
interface _LocalCredentialType {
  name: string
  displayName: string
  documentationUrl?: string
  properties?: Array<{
    name: string
    displayName: string
    type: string
    default?: unknown
    required?: boolean
  }>
}

/**
 * Node information extracted from credential schema
 */
interface DiscoveredNode {
  name: string
  displayName: string
  description?: string
  category: string
  nodeType: 'official' | 'community'
  packageName?: string
  packageVersion?: string
  credentialType: string
  icon?: string
  properties?: Record<string, unknown>
}

/**
 * Discovery statistics
 */
interface DiscoveryStats {
  credentialsTested: number
  nodesDiscovered: number
  officialNodes: number
  communityNodes: number
  errors: number
  warnings: number
  executionTime: number
  memoryUsed: number
}

/**
 * Known credential types that commonly exist in n8n
 * This is a starting point - we'll discover more dynamically
 */
const COMMON_CREDENTIAL_TYPES = [
  'airtableApi',
  'asanaApi',
  'aws',
  'githubApi',
  'gitlabApi',
  'googleApi',
  'googleOAuth2Api',
  'hubspotApi',
  'jiraApi',
  'linearApi',
  'mailchimpApi',
  'microsoftOAuth2Api',
  'mongoDb',
  'mySql',
  'notionApi',
  'openAiApi',
  'postgres',
  'redis',
  'salesforceOAuth2Api',
  'sendGridApi',
  'shopifyApi',
  'slackApi',
  'slackOAuth2Api',
  'stripeApi',
  'twilioApi',
  'zoomApi',
  // Community nodes
  'scrapinjaApi',
  'scrapflyApi',
  'browserlessApi',
]

/**
 * Category mapping based on credential type patterns
 */
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  'Data & Storage': [/database|db|sql|redis|mongo|elastic|vector/i],
  'Communication': [/slack|discord|telegram|email|mail|sms|twilio/i],
  'Marketing & Sales': [/hubspot|salesforce|mailchimp|sendgrid|marketo/i],
  'Development': [/github|gitlab|bitbucket|jenkins|docker|kubernetes/i],
  'Productivity': [/notion|airtable|asana|trello|jira|linear|clickup/i],
  'AI & Machine Learning': [/openai|anthropic|hugging|gpt|llm|ai$/i],
  'Analytics': [/google.*analytics|segment|mixpanel|amplitude/i],
  'Finance': [/stripe|paypal|square|quickbooks|xero/i],
  'Cloud Services': [/aws|azure|gcp|google.*cloud|digital.*ocean/i],
  'Social Media': [/twitter|facebook|instagram|linkedin|youtube/i],
  'E-commerce': [/shopify|woocommerce|magento|bigcommerce/i],
  'Files & Documents': [/dropbox|box|google.*drive|onedrive|s3/i],
  'Automation': [/zapier|ifttt|integromat|n8n/i],
  'Security': [/auth|oauth|jwt|vault|1password/i],
  'Monitoring': [/datadog|newrelic|sentry|pagerduty/i],
  'Video & Media': [/zoom|youtube|vimeo|twitch|obs/i],
  'Community': [/scrape|crawl|browser|puppet|playwright/i],
}

/**
 * Credential-based Node Discovery Engine
 */
export class CredentialDiscovery {
  private versionManager: VersionManager
  private instanceId?: string
  private sessionId?: string
  private stats: DiscoveryStats = {
    credentialsTested: 0,
    nodesDiscovered: 0,
    officialNodes: 0,
    communityNodes: 0,
    errors: 0,
    warnings: 0,
    executionTime: 0,
    memoryUsed: 0,
  }

  constructor() {
    this.versionManager = new VersionManager(database)
  }

  /**
   * Main discovery process
   */
  async discover(
    instanceUrl?: string,
    apiKey?: string,
    discoveryType: 'full' | 'incremental' | 'community_only' = 'full',
  ): Promise<DiscoveryStats> {
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed

    try {
      // Use provided credentials or fall back to config
      const url = instanceUrl || config.n8nUrl
      const key = apiKey || config.apiKey

      if (!url || !key) {
        throw new Error('n8n API URL and key required for discovery')
      }

      logger.info('Starting credential-based node discovery', {
        url,
        discoveryType,
        phase: 2,
      })

      // Register or update n8n instance
      await this.registerInstance(url)

      // Start discovery session
      await this.startSession(discoveryType)

      // Phase 2a: Discover credential types
      const credentialTypes = await this.discoverCredentialTypes(url, key)
      logger.info(`Discovered ${credentialTypes.length} credential types`)

      // Phase 2b: Test each credential schema endpoint
      const discoveredNodes: DiscoveredNode[] = []

      for (const credType of credentialTypes) {
        try {
          const node = await this.testCredentialSchema(url, key, credType)
          if (node) {
            discoveredNodes.push(node)
            this.stats.nodesDiscovered++

            if (node.nodeType === 'official') {
              this.stats.officialNodes++
            }
            else {
              this.stats.communityNodes++
            }

            // Store node in database
            await this.storeNode(node)
          }
        }
        catch (error) {
          this.stats.errors++
          logger.debug(`Failed to test credential ${credType}:`, error)
        }

        this.stats.credentialsTested++

        // Progress reporting every 10 credentials
        if (this.stats.credentialsTested % 10 === 0) {
          logger.info('Discovery progress', {
            tested: this.stats.credentialsTested,
            discovered: this.stats.nodesDiscovered,
            errors: this.stats.errors,
          })
        }
      }

      // Phase 2c: Discover community nodes specifically
      if (discoveryType === 'full' || discoveryType === 'community_only') {
        const communityNodes = await this.discoverCommunityNodes(url, key)
        discoveredNodes.push(...communityNodes)
        this.stats.communityNodes += communityNodes.length
        this.stats.nodesDiscovered += communityNodes.length
      }

      // Complete discovery session
      this.stats.executionTime = Date.now() - startTime
      this.stats.memoryUsed = process.memoryUsage().heapUsed - startMemory

      await this.completeSession()

      logger.info('Credential-based discovery completed', this.stats)

      return this.stats
    }
    catch (error) {
      logger.error('Discovery failed:', error)
      this.stats.errors++

      if (this.sessionId) {
        await this.versionManager.completeDiscoverySession(this.sessionId, {
          errorsCount: this.stats.errors,
          warningsCount: this.stats.warnings,
        })
      }

      throw error
    }
  }

  /**
   * Discover available credential types
   */
  private async discoverCredentialTypes(url: string, apiKey: string): Promise<string[]> {
    try {
      // First try to get credential types from API with proper timeout and retries
      const response = await httpClient.get(`${url}/api/v1/credentials`, {
        headers: {
          'X-N8N-API-KEY': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'n8n-mcp-modern/6.2.0',
        },
        timeout: 15000, // Increased timeout for slower networks
      })

      if (response.data && Array.isArray(response.data)) {
        const types = response.data
          .map((cred: any) => cred.type || cred.name)
          .filter((type: unknown): type is string => Boolean(type) && typeof type === 'string')

        if (types.length > 0) {
          return [...new Set(types)] // Deduplicate
        }
      }
    }
    catch (error) {
      logger.debug('Failed to get credentials from API, using common types:', error)
    }

    // Fall back to testing common credential types
    return COMMON_CREDENTIAL_TYPES
  }

  /**
   * Test a credential schema endpoint
   */
  private async testCredentialSchema(
    url: string,
    apiKey: string,
    credentialType: string,
  ): Promise<DiscoveredNode | null> {
    try {
      const response = await httpClient.get(
        `${url}/api/v1/credentials/schema/${credentialType}`,
        {
          headers: {
            'X-N8N-API-KEY': apiKey,
            'Accept': 'application/json',
          },
          timeout: 5000,
        },
      )

      if (response.data) {
        // Extract node information from credential schema
        return this.extractNodeFromCredential(credentialType, response.data)
      }
    }
    catch (error: any) {
      // 404 is expected for non-existent credentials
      if (error.response?.status !== 404) {
        logger.debug(`Error testing credential ${credentialType}:`, error.message)
      }
    }

    return null
  }

  /**
   * Extract node information from credential schema
   */
  private extractNodeFromCredential(
    credentialType: string,
    schema: any,
  ): DiscoveredNode {
    // Determine if this is a community node
    const isCommunity = this.isCommunityNode(credentialType, schema)

    // Determine category based on credential type
    const category = this.determineCategory(credentialType, schema)

    // Build display name from credential type
    const displayName = this.formatDisplayName(credentialType)

    return {
      name: `n8n-nodes-base.${credentialType.replace(/Api|OAuth2?/g, '').toLowerCase()}`,
      displayName,
      description: schema.description || `Integration with ${displayName}`,
      category,
      nodeType: isCommunity ? 'community' : 'official',
      ...(isCommunity
        ? {
            packageName: this.extractPackageName(credentialType, schema),
            packageVersion: '1.0.0',
          }
        : {}),
      credentialType,
      icon: schema.icon,
      properties: schema.properties || {},
    }
  }

  /**
   * Determine if a node is a community node
   */
  private isCommunityNode(credentialType: string, schema: any): boolean {
    // Known community node patterns
    const communityPatterns = [
      /scrapeninja/i,
      /scrapfly/i,
      /browserless/i,
      /puppeteer/i,
      /playwright/i,
      /custom/i,
    ]

    // Check credential type
    if (communityPatterns.some(pattern => pattern.test(credentialType))) {
      return true
    }

    // Check package name in schema if available
    if (schema.package && !schema.package.startsWith('n8n-nodes-base')) {
      return true
    }

    return false
  }

  /**
   * Determine node category
   */
  private determineCategory(credentialType: string, schema: any): string {
    // Check schema for category hint
    if (schema.category) {
      return schema.category
    }

    // Match against patterns
    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(credentialType))) {
        return category
      }
    }

    // Default category
    return 'Miscellaneous'
  }

  /**
   * Format display name from credential type
   */
  private formatDisplayName(credentialType: string): string {
    return credentialType
      .replace(/Api$/, '')
      .replace(/OAuth2?/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^./, str => str.toUpperCase())
  }

  /**
   * Extract package name for community nodes
   */
  private extractPackageName(credentialType: string, schema: any): string {
    if (schema.package) {
      return schema.package
    }

    // Generate package name from credential type
    const baseName = credentialType.toLowerCase().replace(/api|oauth2?/gi, '')
    return `n8n-nodes-${baseName}`
  }

  /**
   * Discover community nodes specifically
   */
  private async discoverCommunityNodes(url: string, apiKey: string): Promise<DiscoveredNode[]> {
    const communityNodes: DiscoveredNode[] = []

    try {
      // Check for installed community nodes
      const response = await httpClient.get(
        `${url}/api/v1/nodes`,
        {
          headers: {
            'X-N8N-API-KEY': apiKey,
            'Accept': 'application/json',
          },
          timeout: 10000,
        },
      )

      if (response.data && Array.isArray(response.data)) {
        for (const node of response.data) {
          if (node.package && !node.package.startsWith('n8n-nodes-base')) {
            communityNodes.push({
              name: node.name,
              displayName: node.displayName,
              description: node.description,
              category: node.group?.[0] || 'Community',
              nodeType: 'community',
              packageName: node.package,
              packageVersion: node.version || '1.0.0',
              credentialType: node.credentials?.[0]?.name || '',
              icon: node.icon,
              properties: node.properties || {},
            })
          }
        }
      }
    }
    catch (error) {
      logger.debug('Failed to discover community nodes:', error)
    }

    // Always check for scrapeninja specifically
    const scrapninjaNode = await this.testCredentialSchema(url, apiKey, 'scrapinjaApi')
    if (scrapninjaNode) {
      scrapninjaNode.nodeType = 'community'
      scrapninjaNode.packageName = 'n8n-nodes-scrapeninja'
      communityNodes.push(scrapninjaNode)
    }

    return communityNodes
  }

  /**
   * Register n8n instance
   */
  private async registerInstance(url: string): Promise<void> {
    try {
      // Get instance version
      const response = await httpClient.get(`${url}/api/v1/version`, {
        timeout: 5000,
      })

      const data = response.data as any || {}
      const version = data.version || '1.0.0'
      const edition = data.edition || 'community'

      // Register or update instance
      this.instanceId = await this.versionManager.registerInstance({
        url,
        version,
        edition,
        lastDiscovered: new Date(),
        discoveryMethod: 'credential_test',
        status: 'active',
        errorCount: 0,
        officialNodeCount: 0,
        communityNodeCount: 0,
        apiResponseTime: 0,
      })

      logger.info('Registered n8n instance', { instanceId: this.instanceId, version, edition })
    }
    catch (error) {
      logger.warn('Failed to get instance version, using defaults:', error)

      this.instanceId = await this.versionManager.registerInstance({
        url,
        version: '1.0.0',
        edition: 'community',
        lastDiscovered: new Date(),
        discoveryMethod: 'credential_test',
        status: 'active',
        errorCount: 0,
        officialNodeCount: 0,
        communityNodeCount: 0,
        apiResponseTime: 0,
      })
    }
  }

  /**
   * Start discovery session
   */
  private async startSession(discoveryType: 'full' | 'incremental' | 'community_only'): Promise<void> {
    if (!this.instanceId) {
      throw new Error('Instance not registered')
    }

    this.sessionId = await this.versionManager.startDiscoverySession({
      instanceId: this.instanceId,
      discoveryType,
      trigger: 'manual',
      nodesDiscovered: 0,
      toolsGenerated: 0,
      credentialsTested: 0,
      errorsCount: 0,
      warningsCount: 0,
      executionTime: 0,
      memoryUsed: 0,
      successRate: 0,
    })

    logger.info('Started discovery session', { sessionId: this.sessionId })
  }

  /**
   * Complete discovery session
   */
  private async completeSession(): Promise<void> {
    if (!this.sessionId) {
      return
    }

    await this.versionManager.completeDiscoverySession(this.sessionId, {
      nodesDiscovered: this.stats.nodesDiscovered,
      toolsGenerated: 0, // Will be updated in Phase 3
      credentialsTested: this.stats.credentialsTested,
      errorsCount: this.stats.errors,
      warningsCount: this.stats.warnings,
      discoveryLog: {
        stats: this.stats,
        timestamp: new Date().toISOString(),
      },
      performanceMetrics: {
        executionTime: this.stats.executionTime,
        memoryUsed: this.stats.memoryUsed,
      },
    })

    // Update instance counts
    if (this.instanceId) {
      await this.versionManager.updateInstance(this.instanceId, {
        officialNodeCount: this.stats.officialNodes,
        communityNodeCount: this.stats.communityNodes,
        lastDiscovered: new Date(),
      })
    }
  }

  /**
   * Store discovered node in database
   */
  private async storeNode(node: DiscoveredNode): Promise<void> {
    if (!this.instanceId) {
      throw new Error('Instance ID not set')
    }

    const dbNode: N8NNodeDatabase = {
      name: node.name,
      type: node.name,
      displayName: node.displayName,
      description: node.description || '',
      version: 1,
      inputs: ['main'],
      outputs: ['main'],
      category: node.category,
      icon: node.icon,
      properties: node.properties || {},
      credentials: node.credentialType ? [node.credentialType] : [],
      lastUpdated: new Date(),
      instanceId: this.instanceId,
      nodeType: node.nodeType,
      ...(node.packageName ? { packageName: node.packageName } : {}),
      ...(node.packageVersion ? { packageVersion: node.packageVersion } : {}),
      discoveredAt: new Date(),
      ...(this.sessionId ? { discoverySessionId: this.sessionId } : {}),
      isActive: true,
    }

    // Store in database using the database manager
    await database.addNode(dbNode)
    logger.debug('Stored node:', { name: node.name, type: node.nodeType })
  }
}
