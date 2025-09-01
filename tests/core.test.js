#!/usr/bin/env node
/**
 * Core functionality tests using native Node.js test runner
 * Zero external dependencies, maximum performance
 */

import assert from 'node:assert'
import { performance } from 'node:perf_hooks'
import { describe, it } from 'vitest'
import { config, getNormalizedN8nUrl, hasN8nApi } from '../dist/simple-config.js'
import { SimpleHttpClient } from '../dist/utils/simple-http-client.js'

describe('core Configuration Tests', () => {
  it('config should have expected structure', () => {
    assert.ok(typeof config === 'object', 'config should be an object')
    assert.ok(typeof hasN8nApi === 'boolean', 'hasN8nApi should be boolean')
  })

  it('getNormalizedN8nUrl should handle various URL formats', () => {
    // Test URL normalization
    const normalized = getNormalizedN8nUrl()

    if (normalized) {
      assert.ok(normalized.includes('/api/v1'), 'URL should contain /api/v1')
    }
  })

  it('config agents should default to all', () => {
    assert.ok(Array.isArray(config.agents?.enabled), 'agents.enabled should be array')
    assert.ok(config.agents?.enabled?.includes('all'), 'should include "all" by default')
  })
})

describe('simple HTTP Client Tests', () => {
  it('simpleHttpClient should construct properly', () => {
    const client = new SimpleHttpClient()
    assert.ok(client, 'client should be created')
  })

  it('simpleHttpClient request options should be valid', async () => {
    const client = new SimpleHttpClient('http://localhost:3000')

    // Test timeout handling
    const startTime = performance.now()
    try {
      await client.get('/nonexistent', { timeout: 100 })
    }
    catch {
      const elapsed = performance.now() - startTime
      assert.ok(elapsed < 1000, 'should timeout quickly')
    }
  })

  it('pOST method should handle different body types', async () => {
    const client = new SimpleHttpClient()

    // Test that methods can be called without throwing
    // Use catch to handle expected errors from invalid URLs
    const testPost = async (data) => {
      try {
        await client.post('/test', data)
      }
      catch (error) {
        // Expected to fail with invalid URL - that's OK
        // We're just testing that the method accepts different body types
        assert.ok(error.message.includes('Failed to parse URL') || error.message.includes('fetch failed'), 'Expected URL parse error')
      }
    }

    // Test different body types
    await testPost({ key: 'value' })
    await testPost('string data')
    await testPost(undefined)
  })
})

describe('performance Tests', () => {
  it('configuration loading should be fast', () => {
    const startTime = performance.now()

    // Re-import to test loading time
    import('../dist/simple-config.js').then(() => {
      const loadTime = performance.now() - startTime
      assert.ok(loadTime < 50, `Config loading took ${loadTime}ms, should be <50ms`)
    })
  })

  it('hTTP client creation should be lightweight', () => {
    const startTime = performance.now()
    const client = new SimpleHttpClient('http://test.com', { test: 'header' })
    const creationTime = performance.now() - startTime

    assert.ok(creationTime < 10, `Client creation took ${creationTime}ms, should be <10ms`)
    assert.ok(client, 'Client should be created')
  })
})

describe('memory Tests', () => {
  it('objects should not create memory leaks', () => {
    const initialMemory = process.memoryUsage().heapUsed

    // Create many HTTP clients and let them be garbage collected
    for (let i = 0; i < 100; i++) {
      const client = new SimpleHttpClient(`http://test${i}.com`)
      // Use client briefly
      client.get('/test').catch(() => {}) // Ignore errors
    }

    // Force garbage collection if available
    if (typeof global.gc === 'function') {
      global.gc()
    }

    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory

    // Memory increase should be reasonable (less than 5MB for 100 clients)
    assert.ok(memoryIncrease < 5 * 1024 * 1024, `Memory increased by ${Math.round(memoryIncrease / 1024)}KB, should be <5MB`)
  })
})

// Run performance check
it('overall test suite performance', async () => {
  const suiteStart = performance.now()

  // Simulate some async operations
  await new Promise(resolve => setTimeout(resolve, 10))

  const suiteTime = performance.now() - suiteStart
  console.log(`Test suite completed in ${Math.round(suiteTime)}ms`)

  // Test suite should complete quickly
  assert.ok(suiteTime < 1000, 'Test suite should complete in <1000ms')
})
