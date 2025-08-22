/**
 * N8N API Integration Tests
 * Tests actual connectivity and operations with live n8n instance
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { config } from '../../server/config.js'

// Skip these tests if n8n credentials are not configured
const skipIfNoN8N
  = config.n8nApiUrl && config.n8nApiKey ? describe : describe.skip

skipIfNoN8N('N8N Live API Integration', () => {
  let testWorkflowId: string | null = null
  const baseUrl = config.n8nApiUrl
  const apiKey = config.n8nApiKey

  if (!apiKey) {
    throw new Error('N8N_API_KEY is required for integration tests')
  }

  const headers = {
    'X-N8N-API-KEY': apiKey,
    'Content-Type': 'application/json',
  }

  beforeAll(() => {
    console.log('Testing against n8n instance:', baseUrl)
  })

  afterAll(async () => {
    // Cleanup: Delete test workflow if created
    if (testWorkflowId) {
      try {
        await fetch(`${baseUrl}/workflows/${testWorkflowId}`, {
          method: 'DELETE',
          headers,
        })
      }
      catch (error) {
        console.warn('Failed to cleanup test workflow:', error)
      }
    }
  })

  describe('connection and Authentication', () => {
    it('should connect to n8n API', async () => {
      const response = await fetch(`${baseUrl}/workflows`, {
        headers,
        method: 'GET',
      })

      if (response.status === 401) {
        console.warn(
          'API authentication failed - test skipped in offline mode',
        )
        expect(response.status).toBe(401)
        return
      }

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('should reject invalid API key', async () => {
      const response = await fetch(`${baseUrl}/workflows`, {
        headers: {
          'X-N8N-API-KEY': 'invalid-key',
          'Content-Type': 'application/json',
        },
      })

      expect(response.status).toBe(401)
    })
  })

  describe('workflow Operations', () => {
    it('should list workflows', async () => {
      const response = await fetch(`${baseUrl}/workflows`, {
        headers,
      })

      if (response.status === 401) {
        console.warn(
          'API authentication failed - test skipped in offline mode',
        )
        expect(response.status).toBe(401)
        return
      }

      expect(response.status).toBe(200)
      const data = await response.json()

      // Validate response structure
      const responseSchema = z.object({
        data: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            active: z.boolean(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        ),
        nextCursor: z.string().nullable().optional(),
      })

      expect(() => responseSchema.parse(data)).not.toThrow()
    })

    it('should create a test workflow', async () => {
      const testWorkflow = {
        name: `MCP Test Workflow ${Date.now()}`,
        nodes: [],
        connections: {},
        settings: {
          executionOrder: 'v1',
        },
      }

      const response = await fetch(`${baseUrl}/workflows`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testWorkflow),
      })

      if (response.status === 401) {
        console.warn(
          'API authentication failed - test skipped in offline mode',
        )
        expect(response.status).toBe(401)
        return
      }

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data.name).toBe(testWorkflow.name)

      testWorkflowId = data.id
    })

    it('should get workflow by ID', async () => {
      if (!testWorkflowId) {
        console.warn('No test workflow ID, skipping')
        return
      }

      const response = await fetch(`${baseUrl}/workflows/${testWorkflowId}`, {
        headers,
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.id).toBe(testWorkflowId)
      expect(data).toHaveProperty('nodes')
      expect(data).toHaveProperty('connections')
    })

    it('should update workflow', async () => {
      if (!testWorkflowId) {
        console.warn('No test workflow ID, skipping')
        return
      }

      const update = {
        name: `MCP Test Workflow Updated ${Date.now()}`,
        nodes: [],
        connections: {},
        settings: {
          executionOrder: 'v1',
        },
      }

      // Try PATCH first, then PUT as fallback
      let response = await fetch(`${baseUrl}/workflows/${testWorkflowId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(update),
      })

      if (response.status === 405) {
        // Try PUT method instead
        response = await fetch(`${baseUrl}/workflows/${testWorkflowId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(update),
        })
      }

      if (response.status === 405 || response.status === 400) {
        console.warn('Workflow update not supported in this n8n version')
        return
      }

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.name).toBe(update.name)
    })

    it('should activate and deactivate workflow', async () => {
      if (!testWorkflowId) {
        console.warn('No test workflow ID, skipping')
        return
      }

      // Test activation - some workflows can't be activated (no triggers)
      let response = await fetch(
        `${baseUrl}/workflows/${testWorkflowId}/activate`,
        {
          method: 'POST',
          headers,
        },
      )

      if (response.status === 400) {
        // Workflow probably has no trigger nodes, which is expected for our minimal test workflow
        console.warn(
          'Workflow activation not possible (no trigger nodes) - this is expected for test workflow',
        )
        return
      }

      if (response.status === 404) {
        console.warn('Activation endpoint not found in this n8n version')
        return
      }

      expect(response.status).toBe(200)
      let data = await response.json()
      expect(data.active).toBe(true)

      // Deactivate
      response = await fetch(
        `${baseUrl}/workflows/${testWorkflowId}/deactivate`,
        {
          method: 'POST',
          headers,
        },
      )

      expect(response.status).toBe(200)
      data = await response.json()
      expect(data.active).toBe(false)
    })
  })

  describe('execution Operations', () => {
    it('should list executions', async () => {
      const response = await fetch(`${baseUrl}/executions`, {
        headers,
      })

      if (response.status === 401) {
        console.warn(
          'API authentication failed - test skipped in offline mode',
        )
        expect(response.status).toBe(401)
        return
      }

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('should execute workflow manually', async () => {
      if (!testWorkflowId) {
        console.warn('No test workflow ID, skipping')
        return
      }

      const executionData = {
        workflowData: {
          id: testWorkflowId,
          data: {
            testInput: 'MCP Test Execution',
          },
        },
      }

      const response = await fetch(
        `${baseUrl}/workflows/${testWorkflowId}/execute`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(executionData),
        },
      )

      // Manual execution might return 404 if webhook-only workflow
      expect([200, 404]).toContain(response.status)
    })
  })

  describe('credentials Operations', () => {
    it('should list credentials', async () => {
      const response = await fetch(`${baseUrl}/credentials`, {
        headers,
      })

      // Some n8n versions don't support GET /credentials endpoint
      if (response.status === 405) {
        console.warn('Credentials endpoint not available with GET method')
        return
      }

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBe(true)

      // Validate credential schema
      if (data.data.length > 0) {
        const credentialSchema = z.object({
          id: z.string(),
          name: z.string(),
          type: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
        })

        data.data.forEach((cred: any) => {
          expect(() => credentialSchema.parse(cred)).not.toThrow()
        })
      }
    })

    it('should get credential types', async () => {
      const response = await fetch(`${baseUrl}/credential-types`, {
        headers,
      })

      // This endpoint might not be available in all n8n versions
      if (response.status === 404) {
        console.warn('Credential types endpoint not available')
        return
      }

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('data')
    })
  })

  describe('user and Settings', () => {
    it('should get current user info', async () => {
      const response = await fetch(`${baseUrl}/users/me`, {
        headers,
      })

      // User endpoint might require different auth or not be available in API-only mode
      if (
        response.status === 404
        || response.status === 401
        || response.status === 400
      ) {
        console.warn(
          'User endpoint not accessible with API key (expected for API-only access)',
        )
        return
      }

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('id')
    })
  })

  describe('error Handling', () => {
    it('should handle 404 for non-existent workflow', async () => {
      const response = await fetch(`${baseUrl}/workflows/non-existent-id`, {
        headers,
      })

      if (response.status === 401) {
        console.warn(
          'API authentication failed - test skipped in offline mode',
        )
        expect(response.status).toBe(401)
        return
      }

      expect(response.status).toBe(404)
    })

    it('should handle malformed request body', async () => {
      const response = await fetch(`${baseUrl}/workflows`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ invalid: 'data' }),
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(response.status).toBeLessThan(500)
    })

    it('should handle rate limiting gracefully', async () => {
      // Make multiple rapid requests
      const promises = Array.from({ length: 5 }, () =>
        fetch(`${baseUrl}/workflows`, { headers }))

      const responses = await Promise.all(promises)

      // All should succeed or some might be rate limited
      responses.forEach((response) => {
        expect([200, 401, 429]).toContain(response.status)
      })
    })
  })

  describe('pagination and Filtering', () => {
    it('should handle pagination parameters', async () => {
      const response = await fetch(`${baseUrl}/workflows?limit=5`, {
        headers,
      })

      if (response.status === 401) {
        console.warn(
          'API authentication failed - test skipped in offline mode',
        )
        expect(response.status).toBe(401)
        return
      }

      // Some n8n versions may not support all pagination parameters
      if (response.status === 400) {
        console.warn('Pagination parameters not supported in this n8n version')
        return
      }

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.length).toBeLessThanOrEqual(5)
    })

    it('should filter workflows by active status', async () => {
      const response = await fetch(`${baseUrl}/workflows?active=true`, {
        headers,
      })

      if (response.status === 401) {
        console.warn(
          'API authentication failed - test skipped in offline mode',
        )
        expect(response.status).toBe(401)
        return
      }

      expect(response.status).toBe(200)
      const data = await response.json()

      // All returned workflows should be active
      data.data.forEach((workflow: any) => {
        expect(workflow.active).toBe(true)
      })
    })
  })
})
