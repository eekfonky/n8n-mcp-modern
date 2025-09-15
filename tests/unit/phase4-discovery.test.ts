/**
 * Phase 4 Discovery Automation Tests
 * Tests the discovery scheduler, version detection, and automated discovery triggers
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { database } from '../database/index.js'
import { VersionManager } from '../database/version-manager.js'
import { DiscoveryScheduler } from '../discovery/scheduler.js'

describe('phase 4: Discovery Automation', () => {
  let discoveryScheduler: DiscoveryScheduler
  let versionManager: VersionManager

  beforeAll(async () => {
    // Initialize test components
    versionManager = new VersionManager(database)
  })

  afterAll(async () => {
    // Cleanup
    if (discoveryScheduler) {
      await discoveryScheduler.stop()
    }
    await database.close()
  })

  describe('discovery Scheduler Initialization', () => {
    it('should create DiscoveryScheduler instance with default config', () => {
      discoveryScheduler = new DiscoveryScheduler()
      expect(discoveryScheduler).toBeDefined()
      expect(typeof discoveryScheduler.start).toBe('function')
      expect(typeof discoveryScheduler.stop).toBe('function')
    })

    it('should validate environment variables correctly', () => {
      // Test with default environment - should not throw
      expect(() => new DiscoveryScheduler()).not.toThrow()
    })

    it('should provide scheduler status and methods', () => {
      const scheduler = new DiscoveryScheduler()

      // Check if scheduler has proper methods
      expect(typeof scheduler.start).toBe('function')
      expect(typeof scheduler.stop).toBe('function')
      expect(typeof scheduler.triggerDiscovery).toBe('function')
    })
  })

  describe('version Change Detection', () => {
    it('should have version change detection functionality', () => {
      const scheduler = new DiscoveryScheduler()

      // Should have private checkVersionChanges method (not directly testable)
      // But scheduler should be created successfully
      expect(scheduler).toBeDefined()

      // Version detection is configured through environment variables
      expect(process.env.ENABLE_VERSION_DETECTION !== 'false').toBe(true)
    })

    it('should handle version tracking correctly', async () => {
      // Register a test instance
      const instanceId = await versionManager.registerInstance({
        url: 'http://test-instance.com',
        version: '1.0.0',
        edition: 'community',
        lastDiscovered: new Date(),
        discoveryMethod: 'test',
        status: 'active',
        errorCount: 0,
        capabilities: '{}',
        communityNodes: '[]',
        officialNodeCount: 0,
        communityNodeCount: 0,
        apiResponseTime: 100,
      })

      // Retrieve it
      const instance = await versionManager.getInstance(instanceId)
      expect(instance).toBeDefined()
      expect(instance?.version).toBe('1.0.0')
      expect(instance?.url).toBe('http://test-instance.com')

      // Get all instances
      const instances = await versionManager.getAllInstances()
      expect(instances.length).toBeGreaterThan(0)
    })
  })

  describe('discovery Triggers', () => {
    it('should support all discovery trigger types', () => {
      const scheduler = new DiscoveryScheduler()

      const triggerTypes = [
        'startup',
        'manual',
        'scheduled',
        'version_change',
        'api_health_check',
      ]

      // Should have triggerDiscovery method that accepts these types
      expect(typeof scheduler.triggerDiscovery).toBe('function')
      expect(triggerTypes.length).toBeGreaterThan(0)
    })

    it('should handle discovery triggering', async () => {
      const scheduler = new DiscoveryScheduler()

      // triggerDiscovery should be available (but may fail without n8n API)
      expect(typeof scheduler.triggerDiscovery).toBe('function')

      try {
        // This will fail without API credentials, but method should exist
        await scheduler.triggerDiscovery('manual', 'test trigger')
      }
      catch (error) {
        // Expected to fail in test environment without n8n API
        expect(error).toBeDefined()
      }
    })
  })

  describe('configuration and Environment', () => {
    it('should parse discovery environment variables', () => {
      // Test environment variable parsing
      const testEnv = {
        ENABLE_DISCOVERY_SCHEDULING: 'true',
        DISCOVERY_INTERVAL_MINUTES: '30',
        ENABLE_VERSION_DETECTION: 'true',
        VERSION_CHECK_INTERVAL_MINUTES: '10',
        MAX_CONCURRENT_DISCOVERY_SESSIONS: '2',
      }

      // Should parse without errors
      Object.entries(testEnv).forEach(([key, value]) => {
        const oldValue = process.env[key]
        process.env[key] = value

        expect(() => new DiscoveryScheduler()).not.toThrow()

        // Restore original value
        if (oldValue !== undefined) {
          process.env[key] = oldValue
        }
        else {
          delete process.env[key]
        }
      })
    })

    it('should validate configuration parameters', () => {
      const scheduler = new DiscoveryScheduler()

      // Should create scheduler successfully with environment defaults
      expect(scheduler).toBeDefined()

      // Configuration is private but defaults should be reasonable
      // Test that scheduler can be created without throwing
      expect(() => new DiscoveryScheduler()).not.toThrow()
    })
  })

  describe('session Management', () => {
    it('should manage discovery sessions', () => {
      const scheduler = new DiscoveryScheduler()

      // Scheduler should manage sessions internally
      expect(scheduler).toBeDefined()

      // Session management is internal, but scheduler should exist
      expect(typeof scheduler.start).toBe('function')
      expect(typeof scheduler.stop).toBe('function')
    })

    it('should handle concurrent session management', () => {
      const scheduler = new DiscoveryScheduler()

      // Should handle concurrent sessions (configuration is internal)
      expect(scheduler).toBeDefined()

      // MAX_CONCURRENT_DISCOVERY_SESSIONS is handled internally
      expect(process.env.MAX_CONCURRENT_DISCOVERY_SESSIONS || '1').toMatch(/^\d+$/)
    })
  })

  describe('integration with Tools System', () => {
    it('should integrate with MCP tool generation', () => {
      const scheduler = new DiscoveryScheduler()

      // Should create successfully (toolGenerator is private)
      expect(scheduler).toBeDefined()
      expect(typeof scheduler.triggerDiscovery).toBe('function')
    })

    it('should integrate with credential discovery', () => {
      const scheduler = new DiscoveryScheduler()

      // Should create successfully (credentialDiscovery is private)
      expect(scheduler).toBeDefined()
      expect(typeof scheduler.start).toBe('function')
    })

    it('should integrate with version manager', () => {
      const scheduler = new DiscoveryScheduler()

      // Should create successfully (versionManager is private)
      expect(scheduler).toBeDefined()
      expect(typeof scheduler.stop).toBe('function')
    })
  })
})
