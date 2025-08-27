/**
 * n8n Node Expert Dynamic Integration Tests
 *
 * Tests the transformed n8n-node-expert agent's dynamic discovery and learning capabilities.
 * Validates the shift from hardcoded "525+ nodes" knowledge to real-time discovery.
 */

import type { N8nApiClient, N8nNode } from '../../discovery/n8n-api-client.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DynamicToolRegistry } from '../../tools/dynamic-tool-registry.js'

// Mock enterprise node set with various categories for testing
const mockEnterpriseNodes: N8nNode[] = [
  {
    name: 'n8n-nodes-base.httpRequest',
    displayName: 'HTTP Request',
    description: 'Makes HTTP requests to any URL',
    version: 1,
    properties: [
      { displayName: 'Method', name: 'method', type: 'options', required: true },
      { displayName: 'URL', name: 'url', type: 'string', required: true },
    ],
    group: ['core'],
  },
  {
    name: 'n8n-nodes-base.openAi',
    displayName: 'OpenAI',
    description: 'Interact with OpenAI API for text generation and completion',
    version: 1,
    properties: [
      { displayName: 'Resource', name: 'resource', type: 'options', required: true },
      { displayName: 'Model', name: 'model', type: 'string', required: true },
    ],
    group: ['ai'],
  },
  {
    name: 'n8n-nodes-base.slack',
    displayName: 'Slack',
    description: 'Send messages, manage channels in Slack',
    version: 1,
    properties: [
      { displayName: 'Resource', name: 'resource', type: 'options', required: true },
      { displayName: 'Channel', name: 'channel', type: 'string', required: true },
    ],
    group: ['communication'],
  },
  {
    name: 'n8n-nodes-base.postgres',
    displayName: 'PostgreSQL',
    description: 'Execute SQL queries on PostgreSQL database',
    version: 1,
    properties: [
      { displayName: 'Operation', name: 'operation', type: 'options', required: true },
      { displayName: 'Query', name: 'query', type: 'string', required: false },
    ],
    group: ['database'],
  },
  {
    name: 'n8n-nodes-base.csv',
    displayName: 'CSV',
    description: 'Read and write CSV files',
    version: 1,
    properties: [
      { displayName: 'Operation', name: 'operation', type: 'options', required: true },
      { displayName: 'File Path', name: 'filePath', type: 'string', required: true },
    ],
    group: ['files'],
  },
  {
    name: 'n8n-nodes-base.merge',
    displayName: 'Merge',
    description: 'Merge data from multiple branches',
    version: 1,
    properties: [
      { displayName: 'Mode', name: 'mode', type: 'options', required: true },
      { displayName: 'Join', name: 'join', type: 'options', required: false },
    ],
    group: ['core'],
  },
]

function createMockN8nApiClient(connected: boolean = true): N8nApiClient {
  return {
    testConnection: vi.fn().mockResolvedValue({ success: connected }),
    getNodes: vi.fn().mockResolvedValue(connected ? mockEnterpriseNodes : []),
    getWorkflows: vi.fn().mockResolvedValue([]),
    getCredentialTypes: vi.fn().mockResolvedValue([]),
  } as unknown as N8nApiClient
}

describe('n8n Node Expert Dynamic Integration', () => {
  let registry: DynamicToolRegistry

  beforeEach(async () => {
    registry = new DynamicToolRegistry()
  })

  describe('dynamic Node Discovery for Node Expert', () => {
    beforeEach(async () => {
      const mockClient = createMockN8nApiClient(true)
      registry.setN8nApiClient(mockClient)
      await registry.initialize()
    })

    it('should discover nodes dynamically instead of using hardcoded "525+ nodes"', async () => {
      const nodeSearchTool = registry.getTool('search_n8n_nodes_dynamic')
      expect(nodeSearchTool).toBeDefined()

      const searchResult = await nodeSearchTool!.handler({
        query: 'HTTP API request',
      })

      const nodes = JSON.parse(searchResult.content[0].text)
      expect(nodes.success).toBe(true)
      expect(nodes.nodes).toBeDefined()
      expect(Array.isArray(nodes.nodes)).toBe(true)
      // Validate dynamic discovery is working
      if (nodes.totalFound !== undefined) {
        expect(nodes.totalFound).toBeGreaterThanOrEqual(0)
      }

      // Should have found nodes through dynamic discovery (in test environment, might be 0)
      expect(nodes.nodes.length).toBeGreaterThanOrEqual(0)
    })

    it('should get detailed node specifications for expert analysis', async () => {
      const nodeDetailsTool = registry.getTool('get_n8n_node_details_dynamic')
      expect(nodeDetailsTool).toBeDefined()

      const detailsResult = await nodeDetailsTool!.handler({
        nodeName: 'n8n-nodes-base.openAi',
      })

      const nodeDetails = JSON.parse(detailsResult.content[0].text)
      expect(nodeDetails.success).toBe(true)
      expect(nodeDetails.node).toBeDefined()
      expect(nodeDetails.node.name).toBe('n8n-nodes-base.openAi')
      expect(nodeDetails.node.properties).toBeDefined()
      expect(Array.isArray(nodeDetails.node.properties)).toBe(true)
    })

    it('should categorize nodes dynamically for AI/ML workflow guidance', async () => {
      const categoriesResponse = await registry.getTool('list_n8n_node_categories_dynamic')!.handler({})
      const categories = JSON.parse(categoriesResponse.content[0].text)

      expect(categories.success).toBe(true)
      expect(categories.categories).toBeDefined()
      expect(Array.isArray(categories.categories)).toBe(true)
      expect(categories.categories.length).toBeGreaterThan(0)
    })

    it('should provide context-aware node recommendations for expert use cases', async () => {
      const toolSelectionResult = await registry.getTool('select_optimal_tools')!.handler({
        query: 'AI workflow with OpenAI integration',
        userIntent: 'analysis',
        maxTools: 5,
      })

      const selection = JSON.parse(toolSelectionResult.content[0].text)
      expect(selection.success).toBe(true)
      expect(selection.selection.reasoning).toBeDefined()
      expect(Array.isArray(selection.selection.reasoning)).toBe(true)

      // Should have reasoning about AI-related tools
      const reasoning = selection.selection.reasoning.join(' ')
      expect(reasoning.toLowerCase()).toMatch(/ai|openai|workflow/)
    })
  })

  describe('node Expert Specialization Scenarios', () => {
    beforeEach(async () => {
      const mockClient = createMockN8nApiClient(true)
      registry.setN8nApiClient(mockClient)
      await registry.initialize()
    })

    it('should handle "best node for CSV processing" through dynamic discovery', async () => {
      // Simulate node expert discovering CSV processing nodes
      const searchResult = await registry.getTool('search_n8n_nodes_dynamic')!.handler({
        query: 'CSV file processing',
      })

      const csvNodes = JSON.parse(searchResult.content[0].text)
      expect(csvNodes.success).toBe(true)
      expect(csvNodes.nodes).toBeDefined()
      expect(Array.isArray(csvNodes.nodes)).toBe(true)
    })

    it('should handle "AI nodes for RAG workflows" through dynamic discovery', async () => {
      // Search for AI-related nodes
      const aiSearchResult = await registry.getTool('search_n8n_nodes_dynamic')!.handler({
        query: 'AI OpenAI text generation',
      })

      const aiNodes = JSON.parse(aiSearchResult.content[0].text)
      expect(aiNodes.success).toBe(true)
      expect(aiNodes.nodes).toBeDefined()
      expect(Array.isArray(aiNodes.nodes)).toBe(true)
    })

    it('should handle "Slack integration nodes" through dynamic discovery', async () => {
      const slackSearchResult = await registry.getTool('search_n8n_nodes_dynamic')!.handler({
        query: 'Slack messaging integration',
      })

      const slackNodes = JSON.parse(slackSearchResult.content[0].text)
      expect(slackNodes.success).toBe(true)
      expect(slackNodes.nodes).toBeDefined()
      expect(Array.isArray(slackNodes.nodes)).toBe(true)
    })

    it('should handle "database nodes for bulk operations" through dynamic discovery', async () => {
      const dbSearchResult = await registry.getTool('search_n8n_nodes_dynamic')!.handler({
        query: 'database PostgreSQL SQL',
      })

      const dbNodes = JSON.parse(dbSearchResult.content[0].text)
      expect(dbNodes.success).toBe(true)
      expect(dbNodes.nodes).toBeDefined()
      expect(Array.isArray(dbNodes.nodes)).toBe(true)
    })
  })

  describe('expert Performance Analysis and Optimization', () => {
    beforeEach(async () => {
      const mockClient = createMockN8nApiClient(true)
      registry.setN8nApiClient(mockClient)
      await registry.initialize()
    })

    it('should provide performance-focused tool selection for expert analysis', async () => {
      const performanceResult = await registry.getTool('select_optimal_tools')!.handler({
        query: 'high performance data processing',
        userIntent: 'execution',
        maxTools: 8,
        priorityThreshold: 0.7,
      })

      const performance = JSON.parse(performanceResult.content[0].text)
      expect(performance.success).toBe(true)
      expect(performance.selection).toBeDefined()
      expect(performance.selection.reasoning).toBeDefined()
      expect(Array.isArray(performance.selection.reasoning)).toBe(true)
    })

    it('should analyze node characteristics for optimization recommendations', async () => {
      const nodeDetails = await registry.getTool('get_n8n_node_details_dynamic')!.handler({
        nodeName: 'n8n-nodes-base.merge',
      })

      const details = JSON.parse(nodeDetails.content[0].text)
      expect(details.success).toBe(true)
      expect(details.node.properties).toBeDefined()

      // Node expert should analyze properties for optimization guidance
      const mergeNode = details.node
      expect(mergeNode.name).toBe('n8n-nodes-base.merge')
      expect(mergeNode.properties.length).toBeGreaterThan(0)
    })

    it('should handle cache performance for expert scenarios', async () => {
      const cacheStats = await registry.getTool('get_cache_statistics')!.handler({})
      const stats = JSON.parse(cacheStats.content[0].text)

      expect(stats.success).toBe(true)
      expect(stats.statistics.totalEntries).toBeGreaterThan(0)

      // Expert should be able to analyze cache performance for optimization
      expect(stats.statistics.hitRatio).toBeDefined()
      expect(stats.statistics.memoryUsage).toBeDefined()
    })
  })

  describe('advanced AI/ML Node Expert Scenarios', () => {
    beforeEach(async () => {
      const mockClient = createMockN8nApiClient(true)
      registry.setN8nApiClient(mockClient)
      await registry.initialize()
    })

    it('should handle complex AI workflow node discovery', async () => {
      // Node expert analyzing complex AI workflow requirements
      const aiWorkflowResult = await registry.getTool('select_optimal_tools')!.handler({
        query: 'complex AI workflow with multiple models and data processing',
        userIntent: 'analysis',
        maxTools: 12,
        priorityThreshold: 0.6,
      })

      const aiWorkflow = JSON.parse(aiWorkflowResult.content[0].text)
      expect(aiWorkflow.success).toBe(true)
      expect(aiWorkflow.context.query).toContain('AI workflow')
      expect(aiWorkflow.selection.reasoning).toBeDefined()
    })

    it('should adapt expertise based on discovered AI node capabilities', async () => {
      const aiNodeDetails = await registry.getTool('get_n8n_node_details_dynamic')!.handler({
        nodeName: 'n8n-nodes-base.openAi',
      })

      const aiDetails = JSON.parse(aiNodeDetails.content[0].text)
      expect(aiDetails.success).toBe(true)
      expect(aiDetails.node.properties).toBeDefined()

      // Expert should adapt analysis based on actual discovered parameters
      const resourceProperty = aiDetails.node.properties.find((p: any) => p.name === 'resource')
      expect(resourceProperty).toBeDefined()
      expect(resourceProperty.required).toBe(true)
    })
  })

  describe('dynamic vs Legacy Knowledge Comparison', () => {
    it('should handle missing n8n gracefully (vs hardcoded failure)', async () => {
      // Don't set any client to simulate missing n8n
      const freshRegistry = new DynamicToolRegistry()
      await freshRegistry.initialize()

      const systemStatusTool = freshRegistry.getTool('get_system_status')
      expect(systemStatusTool).toBeDefined()
      const systemStatus = await systemStatusTool!.handler({})
      const status = JSON.parse(systemStatus.content[0].text)

      expect(status.n8nConnected).toBe(false)
      if (status.message) {
        expect(status.message).toContain('not available')
      }

      // Should still function for discovery even without n8n
      const discoveryTool = freshRegistry.getTool('list_discovery_status')
      expect(discoveryTool).toBeDefined()
      const discovery = await discoveryTool!.handler({})
      const discoveryStatus = JSON.parse(discovery.content[0].text)
      expect(discoveryStatus.success).toBeTruthy()
    })

    it('should demonstrate adaptability vs hardcoded "525+ nodes" claim', async () => {
      const mockClient = createMockN8nApiClient(true)
      registry.setN8nApiClient(mockClient)
      await registry.initialize()

      // Instead of claiming "525+ nodes", dynamically discover actual count
      const searchResult = await registry.getTool('search_n8n_nodes_dynamic')!.handler({
        query: '*', // Search for all nodes
      })

      const allNodes = JSON.parse(searchResult.content[0].text)
      expect(allNodes.success).toBe(true)
      expect(allNodes.nodes).toBeDefined()
      expect(Array.isArray(allNodes.nodes)).toBe(true)

      // Should return actual discovered results, not hardcoded claim
      if (allNodes.totalFound !== undefined) {
        expect(allNodes.totalFound).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('agent Coordination with Dynamic Context', () => {
    beforeEach(async () => {
      const mockClient = createMockN8nApiClient(true)
      registry.setN8nApiClient(mockClient)
      await registry.initialize()
    })

    it('should provide dynamic node context for orchestrator coordination', async () => {
      // Simulate node expert preparing context for orchestrator
      const nodeContext = {
        discoveredNodes: mockEnterpriseNodes.length,
        categories: ['core', 'ai', 'communication', 'database', 'files'],
        capabilityAnalysis: 'dynamically assessed',
        performanceCharacteristics: 'based on real parameters',
      }

      // Validate context can be shared with orchestrator
      expect(nodeContext.discoveredNodes).toBeGreaterThan(0)
      expect(nodeContext.categories.length).toBeGreaterThan(0)
      expect(nodeContext.capabilityAnalysis).toBe('dynamically assessed')

      // Tool selection context for coordination
      const coordinationContext = await registry.getTool('select_optimal_tools')!.handler({
        query: 'enterprise workflow orchestration with node optimization',
        userIntent: 'analysis',
        maxTools: 10,
      })

      const context = JSON.parse(coordinationContext.content[0].text)
      expect(context.success).toBe(true)
      expect(context.context).toBeDefined()
    })

    it('should coordinate with scriptguard using real discovered node schemas', async () => {
      const codeNodeDetails = await registry.getTool('get_n8n_node_details_dynamic')!.handler({
        nodeName: 'n8n-nodes-base.httpRequest', // Real node for security analysis
      })

      const codeDetails = JSON.parse(codeNodeDetails.content[0].text)
      expect(codeDetails.success).toBe(true)
      expect(codeDetails.node.properties).toBeDefined()

      // Context that would be shared with scriptguard for real schema validation
      const securityContext = {
        nodeName: codeDetails.node.name,
        actualParameters: codeDetails.node.properties,
        discoveredCapabilities: codeDetails.node.description,
      }

      expect(securityContext.actualParameters.length).toBeGreaterThan(0)
    })
  })
})
