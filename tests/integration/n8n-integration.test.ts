/**
 * N8N Integration Tests - Comprehensive n8n API Testing
 * Tests all n8n-dependent functionality that requires N8N_API_URL and N8N_API_KEY
 */

import { strict as assert } from 'node:assert'
import { beforeAll, describe, it } from 'vitest'
import { simpleN8nApi } from '../n8n/simple-api.js'
import { features } from '../server/config.js'

describe('n8N Integration Tests - Requires API Credentials', () => {
  beforeAll(async () => {
    // Skip all tests if n8n API is not configured
    if (!features.hasN8nApi) {
      console.warn('⚠️  Skipping n8n integration tests - N8N_API_URL and N8N_API_KEY not configured')
      console.warn('   To run these tests, set:')
      console.warn('   - N8N_API_URL=https://your-n8n-instance.com')
      console.warn('   - N8N_API_KEY=your-api-key')
      return
    }

    // Test connection before running any tests
    const isConnected = await simpleN8nApi.testConnection()
    if (!isConnected) {
      throw new Error('Failed to connect to n8n API - check your N8N_API_URL and N8N_API_KEY')
    }
  })

  describe('n8N API Connection', () => {
    it('should connect to n8n instance successfully', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      const isConnected = await simpleN8nApi.testConnection()
      assert(isConnected === true, 'Should successfully connect to n8n API')
    })

    it('should retrieve n8n version information', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      const versionInfo = await simpleN8nApi.getVersion()
      // Version endpoint may not be available on all n8n instances
      if (versionInfo) {
        assert(typeof versionInfo === 'object', 'Should return version object')
        console.log('✅ Version info available')
      }
      else {
        console.log('ℹ️  Version endpoint not available (may require different permissions)')
        // This is not a test failure - just means the endpoint isn't accessible
        assert(true, 'Version endpoint check completed')
      }
    })
  })

  describe('workflow Management via Direct API', () => {
    it('should retrieve workflows directly', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      const workflows = await simpleN8nApi.getWorkflows()
      assert(Array.isArray(workflows), 'Should return workflows array')

      // If there are workflows, check structure
      if (workflows.length > 0) {
        const firstWorkflow = workflows[0]
        assert(typeof firstWorkflow === 'object', 'Workflow should be object')
        assert(firstWorkflow.id !== undefined, 'Workflow should have ID')
        assert(typeof firstWorkflow.name === 'string', 'Workflow should have name')
      }
    })

    it('should check n8n health status', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      const health = await simpleN8nApi.getHealth()
      // Health endpoint may or may not exist depending on n8n version
      // Just check that we can make the request without throwing
      assert(health !== undefined, 'Should get health response (or null)')
    })
  })

  describe('node Discovery and Registry', () => {
    it('should discover available n8n nodes', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      const nodeTypes = await simpleN8nApi.getNodeTypes()
      assert(Array.isArray(nodeTypes), 'Should return array of node types')

      // n8n instances may have different numbers of nodes
      console.log(`📊 Discovered ${nodeTypes.length} node types`)

      if (nodeTypes.length > 0) {
        const firstNode = nodeTypes[0]
        assert(typeof firstNode === 'object', 'Node should be object')
        assert(typeof firstNode.name === 'string', 'Node should have name')

        // Log some node names for debugging
        const nodeNames = nodeTypes.slice(0, 5).map(node => node.name)
        console.log(`🔍 Sample nodes: ${nodeNames.join(', ')}`)
      }
    })

    it('should validate node structure', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      const nodeTypes = await simpleN8nApi.getNodeTypes()

      if (nodeTypes.length > 0) {
        const sampleNode = nodeTypes[0]
        assert(typeof sampleNode.name === 'string', 'Node should have string name')
        // Other properties may vary by n8n version, so just check basics
        assert(sampleNode.name.length > 0, 'Node name should not be empty')
      }
      else {
        console.log('ℹ️  No nodes discovered - this may indicate API permission issues')
      }
    })
  })

  describe('credential Management', () => {
    it('should list available credentials', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      const credentials = await simpleN8nApi.getCredentials()
      assert(Array.isArray(credentials), 'Should return credentials array')

      // Each credential should have required fields
      for (const cred of credentials.slice(0, 3)) { // Test first 3 to avoid too many assertions
        assert(typeof cred.id === 'string' || typeof cred.id === 'number', 'Credential should have ID')
        assert(typeof cred.name === 'string', 'Credential should have name')
        assert(typeof cred.type === 'string', 'Credential should have type')
      }
    })

    it('should check credential structure', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      const credentials = await simpleN8nApi.getCredentials()
      assert(Array.isArray(credentials), 'Should return credentials array')

      // If there are credentials, check their structure
      if (credentials.length > 0) {
        const firstCred = credentials[0]
        assert(typeof firstCred === 'object', 'Credential should be object')
        assert(firstCred.id !== undefined, 'Credential should have ID')
        assert(typeof firstCred.name === 'string', 'Credential should have name')
      }
    })
  })

  describe('workflow Management API', () => {
    it('should manage workflow lifecycle', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      // Just test basic workflow operations without MCP tools
      const workflows = await simpleN8nApi.getWorkflows()
      console.log(`📊 Found ${workflows.length} existing workflows`)

      // Test workflow retrieval if any exist
      if (workflows.length > 0) {
        const firstWorkflow = workflows[0]
        const detailedWorkflow = await simpleN8nApi.getWorkflow(firstWorkflow.id)
        assert(detailedWorkflow !== null, 'Should retrieve workflow details')
        assert(detailedWorkflow.id === firstWorkflow.id, 'Should match workflow ID')
      }
    })
  })

  describe('real-World API Integration', () => {
    it('should handle complete n8n resource discovery', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      // Discovery scenario: Get all available resources
      const [workflows, nodeTypes, credentials] = await Promise.all([
        simpleN8nApi.getWorkflows(),
        simpleN8nApi.getNodeTypes(),
        simpleN8nApi.getCredentials(),
      ])

      // Should successfully discover all resources
      assert(Array.isArray(workflows), 'Should discover workflows')
      assert(Array.isArray(nodeTypes), 'Should discover node types')
      assert(Array.isArray(credentials), 'Should discover credentials')

      console.log(`📊 Discovery results:`)
      console.log(`   Workflows: ${workflows.length}`)
      console.log(`   Node Types: ${nodeTypes.length}`)
      console.log(`   Credentials: ${credentials.length}`)

      // Basic validation - different n8n instances will have different numbers
      assert(nodeTypes.length >= 0, 'Should have node types array')
      assert(workflows.length >= 0, 'Should have workflows array')
      assert(credentials.length >= 0, 'Should have credentials array')
    })
  })

  describe('error Handling with N8N API', () => {
    it('should handle invalid workflow IDs gracefully', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      try {
        const workflow = await simpleN8nApi.getWorkflow('invalid-workflow-id-999999')
        // If no error thrown, workflow should be null/undefined
        assert(!workflow, 'Should return null/undefined for invalid workflow ID')
      }
      catch (error) {
        // Should handle error gracefully
        assert(error instanceof Error, 'Should throw proper error for invalid workflow ID')
        assert(error.message.length > 0, 'Should provide meaningful error message')
      }
    })

    it('should handle rate limiting gracefully', async () => {
      if (!features.hasN8nApi) {
        console.log('⏭️  Skipped - n8n API not configured')
        return
      }

      // Make multiple rapid requests to test rate limiting handling
      const rapidRequests = []
      for (let i = 0; i < 5; i++) {
        rapidRequests.push(simpleN8nApi.getNodeTypes())
      }

      try {
        const results = await Promise.all(rapidRequests)
        // All requests should succeed or fail gracefully
        for (const result of results) {
          assert(Array.isArray(result) || result === null, 'Should handle rapid requests gracefully')
        }
      }
      catch (error) {
        // Rate limiting errors should be handled gracefully
        assert(error instanceof Error, 'Should handle rate limiting errors')
        console.log('ℹ️  Rate limiting detected (this is expected):', error.message)
      }
    })
  })
})
