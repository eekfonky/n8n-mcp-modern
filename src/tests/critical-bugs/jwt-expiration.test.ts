import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { N8NApiClient } from '../../n8n/api.js'

describe('jWT Token Expiration Handling', () => {
  it('should handle expired token gracefully', async () => {
    // Simulate expired token by using invalid JWT
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid'

    process.env.N8N_API_KEY = expiredToken
    const client = new N8NApiClient()

    try {
      await client.getWorkflows()
      expect.fail('Should have thrown authentication error')
    }
    catch (error) {
      expect(error).toBeDefined()
      expect((error as Error).message).toMatch(/401|unauthorized|authentication/i)
    }
  })

  it('should detect token without expiration claim', () => {
    // Your actual token - checking for missing exp claim
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo'

    // Decode JWT payload (base64)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())

    expect(payload.exp).toBeUndefined()
    console.warn('WARNING: JWT token has no expiration - could be security risk or cause issues if n8n adds expiration')
  })
})
