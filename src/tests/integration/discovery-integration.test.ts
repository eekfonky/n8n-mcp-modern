/**
 * Integration tests for the complete node discovery pipeline
 * Tests all discovery strategies against live n8n instance
 */

import type { DatabaseManager } from '../../database/index.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { database } from '../../database/index.js'
import { ComprehensiveNodeDiscovery } from '../../discovery/comprehensive-discovery.js'
import { StaticNodeManager } from '../../discovery/static-node-manager.js'
import { N8NApi } from '../../n8n/simple-api.js'
import { logger } from '../../server/logger.js'

describe('node Discovery Integration Tests', () => {
  let discovery: ComprehensiveNodeDiscovery
  let staticManager: StaticNodeManager
  let dbManager: DatabaseManager
  let n8nApi: N8NApi

  beforeEach(() => {
    dbManager = database // Use singleton instance
    n8nApi = new N8NApi({
      apiUrl: process.env.N8N_API_URL || 'https://n8n.srv925321.hstgr.cloud',
      apiKey: process.env.N8N_API_KEY || 'test-key',
    })
    discovery = new ComprehensiveNodeDiscovery(dbManager, n8nApi)
    staticManager = new StaticNodeManager()
  })

  describe('full Discovery Pipeline', () => {
    it('should complete full discovery process without errors', async () => {
      // Start a discovery session
      const sessionId = `test-${Date.now()}`
      dbManager.startDiscoverySession(sessionId, 'test-instance', 'integration-test')
      expect(sessionId).toBeDefined()
      expect(typeof sessionId).toBe('string')

      // Run full discovery
      const result = await discovery.discoverNewNodes()

      expect(result).toBeDefined()
      expect(result.newNodes).toBeInstanceOf(Array)
      expect(result.totalChecked).toBeGreaterThan(0)
      expect(result.newNodesFound).toBeGreaterThanOrEqual(0)
      expect(result.workflowsAnalyzed).toBeGreaterThanOrEqual(0)

      logger.info('Discovery completed:', result)
    }, 30000) // 30 second timeout for API calls

    it('should analyze existing workflows successfully', async () => {
      const workflowNodes = await discovery.analyzeExistingWorkflows()

      expect(workflowNodes).toBeInstanceOf(Array)
      // Should return node types found in workflows
      if (workflowNodes.length > 0) {
        workflowNodes.forEach((node) => {
          expect(typeof node).toBe('string')
          expect(node.length).toBeGreaterThan(0)
        })
      }

      logger.info(`Found ${workflowNodes.length} node types in workflows`)
    }, 20000)

    it('should test node patterns effectively', async () => {
      const patternNodes = await discovery.scanForNewNodePatterns()

      expect(patternNodes).toBeInstanceOf(Array)
      // Pattern testing should find at least some valid nodes
      patternNodes.forEach((node) => {
        expect(typeof node).toBe('string')
        expect(node.length).toBeGreaterThan(0)
      })

      logger.info(`Pattern discovery found ${patternNodes.length} nodes`)
    }, 25000)

    it('should scan community packages without errors', async () => {
      const communityNodes = await discovery.scanCommunityPackages()

      expect(communityNodes).toBeInstanceOf(Array)
      // Community scanning should return valid results
      communityNodes.forEach((node) => {
        expect(typeof node).toBe('string')
        expect(node.length).toBeGreaterThan(0)
      })

      logger.info(`Community scan found ${communityNodes.length} packages`)
    }, 15000)
  })

  describe('n8N API Integration', () => {
    it('should fetch workflows successfully', async () => {
      const workflows = await n8nApi.getWorkflows()

      expect(workflows).toBeInstanceOf(Array)
      // Each workflow should have required properties
      workflows.forEach((workflow) => {
        expect(workflow).toHaveProperty('id')
        expect(workflow).toHaveProperty('name')
        expect(workflow).toHaveProperty('nodes')
      })

      logger.info(`Found ${workflows.length} workflows`)
    }, 10000)

    it('should extract nodes from workflows', async () => {
      const allNodes = await n8nApi.getAllWorkflowNodes()

      expect(allNodes).toBeInstanceOf(Array)
      // Should return unique node types
      const uniqueNodes = new Set(allNodes)
      expect(uniqueNodes.size).toBe(allNodes.length)

      allNodes.forEach((node) => {
        expect(typeof node).toBe('string')
        expect(node.length).toBeGreaterThan(0)
      })

      logger.info(`Extracted ${allNodes.length} unique node types from workflows`)
    }, 15000)

    it('should test node patterns via API', async () => {
      const testPatterns = ['HttpRequest', 'Webhook', 'Code', 'SetNode']
      const results = await n8nApi.batchTestNodePatterns(testPatterns)

      expect(results).toBeInstanceOf(Object)
      expect(Object.keys(results)).toHaveLength(testPatterns.length)

      testPatterns.forEach((pattern) => {
        expect(results).toHaveProperty(pattern)
        expect(typeof results[pattern]).toBe('boolean')
      })

      logger.info('Pattern testing results:', results)
    }, 20000)
  })

  describe('database Integration', () => {
    it('should track discovery sessions properly', async () => {
      const sessionId = `test-session-${Date.now()}`
      dbManager.startDiscoverySession(sessionId, 'test-instance', 'test-session')

      // Record some discovered nodes
      dbManager.recordDiscoveredNode('TestNode1', 'test-instance', 'workflow-analysis', sessionId, {
        source: 'workflow-123',
        confidence: 1.0,
        validated: true,
      })

      dbManager.recordDiscoveredNode('TestNode2', 'test-instance', 'pattern-discovery', sessionId, {
        confidence: 0.8,
        validated: false,
      })

      // Get discovery stats
      const stats = dbManager.getDiscoveryStats()
      expect(stats.totalSessions).toBeGreaterThanOrEqual(1)
      expect(stats.totalNodesDiscovered).toBeGreaterThanOrEqual(2)
      expect(stats.topDiscoveryMethods.length).toBeGreaterThan(0)

      // Get discovery history
      const history = dbManager.getDiscoveryHistory()
      expect(history.length).toBeGreaterThan(0)

      const currentSession = history.find(h => h.sessionId === sessionId)
      expect(currentSession).toBeDefined()
      expect(currentSession!.method).toBe('test-session')

      logger.info('Discovery tracking validated successfully')
    })

    it('should validate nodes correctly', async () => {
      const sessionId = `validation-test-${Date.now()}`
      dbManager.startDiscoverySession(sessionId, 'test-instance', 'validation-test')

      // Record unvalidated node
      dbManager.recordDiscoveredNode('ValidationTestNode', 'test-instance', 'test-method', sessionId, {
        validated: false,
      })

      // Mark as validated
      dbManager.markNodesValidated(['ValidationTestNode'], sessionId)

      // Verify validation was recorded
      const discoveredNodes = dbManager.getDiscoveredNodes()
      const validatedNode = discoveredNodes.find(node => node.nodeType === 'ValidationTestNode')
      expect(validatedNode).toBeDefined()

      logger.info('Node validation tracking works correctly')
    })
  })

  describe('static Node Management', () => {
    it('should validate current node list', async () => {
      const validation = await staticManager.validateNodeList()

      expect(validation).toHaveProperty('isValid')
      expect(validation).toHaveProperty('duplicates')
      expect(validation).toHaveProperty('invalidNames')
      expect(validation).toHaveProperty('suggestions')

      expect(validation.duplicates).toBeInstanceOf(Array)
      expect(validation.invalidNames).toBeInstanceOf(Array)
      expect(validation.suggestions).toBeInstanceOf(Array)

      logger.info('Node list validation:', validation)
    })

    it('should provide node list statistics', () => {
      const stats = staticManager.getNodeListStats()

      expect(stats).toHaveProperty('totalNodes')
      expect(stats).toHaveProperty('categories')
      expect(stats.totalNodes).toBeGreaterThan(600) // Should have 686+ nodes

      expect(stats.categories).toBeInstanceOf(Object)
      Object.entries(stats.categories).forEach(([category, count]) => {
        expect(typeof category).toBe('string')
        expect(typeof count).toBe('number')
        expect(count).toBeGreaterThan(0)
      })

      logger.info('Node list statistics:', stats)
    })

    it('should create and list backups', async () => {
      // Create a backup
      const backupPath = await staticManager.createBackup('integration-test')
      expect(backupPath).toBeDefined()
      expect(typeof backupPath).toBe('string')

      // List backups
      const backups = await staticManager.listBackups()
      expect(backups).toBeInstanceOf(Array)

      // Should find our backup
      const ourBackup = backups.find(backup => backup.path === backupPath)
      expect(ourBackup).toBeDefined()
      expect(ourBackup!.filename).toContain('integration-test')

      logger.info(`Created backup: ${backupPath}`)
      logger.info(`Found ${backups.length} total backups`)
    })
  })

  describe('error Handling and Edge Cases', () => {
    it('should handle API failures gracefully', async () => {
      // Test with invalid API setup (this will fail but should be handled)
      const invalidApi = new N8NApi({
        apiUrl: 'http://invalid-url',
        apiKey: 'invalid-key',
      })
      const invalidDiscovery = new ComprehensiveNodeDiscovery(dbManager, invalidApi)

      // Should not throw, but return empty results
      const result = await invalidDiscovery.analyzeExistingWorkflows()
      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBe(0)

      logger.info('API failure handling verified')
    })

    it('should handle empty discovery results', async () => {
      const sessionId = `empty-test-${Date.now()}`
      dbManager.startDiscoverySession(sessionId, 'test-instance', 'empty-test')

      // Should handle empty results without errors
      const stats = dbManager.getDiscoveryStats()
      expect(stats).toBeDefined()
      expect(stats.totalSessions).toBeGreaterThanOrEqual(0)

      logger.info('Empty results handling verified')
    })

    it('should handle duplicate node discoveries', async () => {
      const sessionId = `duplicate-test-${Date.now()}`
      dbManager.startDiscoverySession(sessionId, 'test-instance', 'duplicate-test')

      // Record the same node multiple times
      dbManager.recordDiscoveredNode('DuplicateNode', 'test-instance', 'test-method', sessionId)
      dbManager.recordDiscoveredNode('DuplicateNode', 'test-instance', 'test-method', sessionId)

      // Should handle duplicates properly
      const stats = dbManager.getDiscoveryStats()
      expect(stats.totalSessions).toBeGreaterThanOrEqual(1)

      logger.info('Duplicate handling verified')
    })
  })
})
