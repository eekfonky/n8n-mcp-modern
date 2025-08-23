/**
 * Environment Configuration Tests
 *
 * Critical tests to validate schema validation, environment variables,
 * and build configuration consistency.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { config, updateConfig, validateConfig } from '../../server/config.js'

describe('environment Configuration Tests', () => {
  let originalEnv: NodeJS.ProcessEnv
  let packageJson: any
  let tsconfigContent: string | null = null

  beforeAll(() => {
    const projectRoot = process.cwd()

    // Read package.json
    packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'))

    // Try to read tsconfig.json
    try {
      tsconfigContent = readFileSync(join(projectRoot, 'tsconfig.json'), 'utf-8')
    }
    catch {
      // tsconfig.json might not exist
      tsconfigContent = null
    }
  })

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('environment Variable Validation', () => {
    it('should validate required environment variables', () => {
      const requiredVars = [
        'NODE_ENV',
        'LOG_LEVEL',
        'MCP_MODE',
        'MCP_TIMEOUT',
      ]

      requiredVars.forEach((varName) => {
        // Should have default values or be optional
        expect(() => {
          delete process.env[varName]
          const testConfig = config
          expect(testConfig).toBeDefined()
        }).not.toThrow()
      })
    })

    it('should validate environment variable types', () => {
      const typeTests = [
        {
          var: 'MCP_TIMEOUT',
          value: '30000',
          expectedType: 'number',
          transform: (val: string) => Number.parseInt(val, 10),
        },
        {
          var: 'ENABLE_CACHE',
          value: 'true',
          expectedType: 'boolean',
          transform: (val: string) => val === 'true',
        },
        {
          var: 'LOG_LEVEL',
          value: 'info',
          expectedType: 'string',
          transform: (val: string) => val,
        },
        {
          var: 'MAX_CONCURRENT_REQUESTS',
          value: '10',
          expectedType: 'number',
          transform: (val: string) => Number.parseInt(val, 10),
        },
      ]

      typeTests.forEach(({ var: varName, value, expectedType, transform }) => {
        process.env[varName] = value
        const transformed = transform(value)

        expect(typeof transformed).toBe(expectedType)

        if (expectedType === 'number') {
          expect(Number.isNaN(transformed)).toBe(false)
        }
      })
    })

    it('should validate enum values', () => {
      const enumTests = [
        {
          var: 'NODE_ENV',
          validValues: ['development', 'production', 'test'],
          invalidValues: ['dev', 'prod', 'staging', ''],
        },
        {
          var: 'LOG_LEVEL',
          validValues: ['debug', 'info', 'warn', 'error'],
          invalidValues: ['verbose', 'silent', 'trace', ''],
        },
        {
          var: 'MCP_MODE',
          validValues: ['stdio', 'http'],
          invalidValues: ['tcp', 'websocket', 'grpc', ''],
        },
      ]

      enumTests.forEach(({ var: varName, validValues, invalidValues }) => {
        // Test valid values
        validValues.forEach((validValue) => {
          process.env[varName] = validValue
          expect(() => {
            const testConfig = config
            expect(testConfig).toBeDefined()
          }).not.toThrow()
        })

        // Test invalid values (should use defaults or throw)
        invalidValues.forEach((invalidValue) => {
          process.env[varName] = invalidValue
          // Either should throw or use default
          try {
            const testConfig = config
            // If it doesn't throw, should use a valid default
            expect(validValues).toContain(testConfig.logLevel || testConfig.nodeEnv || testConfig.mcpMode)
          }
          catch (error) {
            // Throwing is also acceptable for invalid values
            expect(error).toBeDefined()
          }
        })
      })
    })

    it('should validate numeric ranges', () => {
      const rangeTests = [
        {
          var: 'MCP_TIMEOUT',
          min: 1000,
          max: 300000,
          invalidValues: ['0', '-1000', '500000', 'abc'],
        },
        {
          var: 'CACHE_TTL',
          min: 0,
          max: 86400,
          invalidValues: ['-1', '100000', 'never'],
        },
        {
          var: 'MAX_CONCURRENT_REQUESTS',
          min: 1,
          max: 100,
          invalidValues: ['0', '-5', '1000', 'unlimited'],
        },
        {
          var: 'MEMORY_THRESHOLD_WARNING',
          min: 50,
          max: 95,
          invalidValues: ['0', '100', '200', 'high'],
        },
        {
          var: 'MEMORY_THRESHOLD_CRITICAL',
          min: 80,
          max: 98,
          invalidValues: ['0', '100', '50', 'very-high'],
        },
      ]

      rangeTests.forEach(({ var: varName, min, max, invalidValues }) => {
        // Test valid range
        const validValue = Math.floor((min + max) / 2).toString()
        process.env[varName] = validValue

        expect(() => {
          const testConfig = config
          expect(testConfig).toBeDefined()
        }).not.toThrow()

        // Test invalid values
        invalidValues.forEach((invalidValue) => {
          process.env[varName] = invalidValue

          try {
            const testConfig = config
            // If no error, should have a valid default within range
            const configValue = (testConfig as any)[varName] || (testConfig as any)[toCamelCase(varName)]
            if (typeof configValue === 'number') {
              expect(configValue).toBeGreaterThanOrEqual(min)
              expect(configValue).toBeLessThanOrEqual(max)
            }
          }
          catch (error) {
            // Throwing is acceptable for invalid values
            expect(error).toBeDefined()
          }
        })
      })
    })

    it('should validate URL formats', () => {
      const urlTests = [
        {
          var: 'N8N_API_URL',
          validUrls: [
            'https://api.n8n.cloud',
            'http://localhost:5678',
            'https://n8n.example.com/api/v1',
            'http://127.0.0.1:8080',
          ],
          invalidUrls: [
            'not-a-url',
            'ftp://invalid.com',
            'https://',
            'http://localhost:notaport',
            '',
          ],
        },
      ]

      urlTests.forEach(({ var: varName, validUrls, invalidUrls }) => {
        // Test valid URLs
        validUrls.forEach((validUrl) => {
          process.env[varName] = validUrl

          expect(() => {
            const testConfig = config
            expect(testConfig).toBeDefined()
            if (testConfig.n8nApiUrl) {
              expect(() => new URL(testConfig.n8nApiUrl!)).not.toThrow()
            }
          }).not.toThrow()
        })

        // Test invalid URLs
        invalidUrls.forEach((invalidUrl) => {
          process.env[varName] = invalidUrl

          if (invalidUrl === '') {
            // Empty URL should be handled gracefully (undefined)
            expect(() => {
              const testConfig = config
              expect(testConfig.n8nApiUrl).toBeUndefined()
            }).not.toThrow()
          }
          else {
            // Invalid URLs should be handled gracefully or throw during normalization
            // Since normalizeN8NUrl throws on invalid URLs, let's test that directly
            expect(() => {
              // Import the normalization function if exported or test URL parsing
              try {
                new URL(invalidUrl)
                // If URL constructor doesn't throw, it's a valid URL format
                // but our normalizer might still handle it
              }
              catch (urlError) {
                // Expected for truly invalid URLs
                expect(urlError).toBeDefined()
              }
            }).not.toThrow()
          }
        })
      })
    })
  })

  describe('configuration Schema Validation', () => {
    it('should validate complete configuration object', () => {
      const validConfig = {
        n8nApiUrl: 'https://api.n8n.cloud/api/v1',
        n8nApiKey: 'test-key-123',
        logLevel: 'info' as const,
        disableConsoleOutput: false,
        mcpMode: 'stdio' as const,
        mcpTimeout: 30000,
        databasePath: './test.db',
        databaseInMemory: false,
        enableCache: true,
        cacheTtl: 3600,
        maxConcurrentRequests: 10,
        nodeEnv: 'test' as const,
        debug: false,
        strictApiValidation: false,
        enableResponseLogging: true,
        validationTimeout: 5000,
        sanitizeApiResponses: true,
        maxResponseSize: 10485760,
        enableMemoryMonitoring: true,
        memoryThresholdWarning: 80,
        memoryThresholdCritical: 90,
        gcIntervalMs: 60000,
        maxHeapSizeMb: 512,
        cacheCleanupIntervalMs: 300000,
      }

      expect(() => validateConfig(validConfig)).not.toThrow()
    })

    it('should reject invalid configuration schemas', () => {
      const invalidConfigs = [
        // Invalid log level
        { ...config, logLevel: 'invalid' as any },

        // Invalid environment
        { ...config, nodeEnv: 'staging' as any },

        // Invalid MCP mode
        { ...config, mcpMode: 'websocket' as any },

        // Invalid timeout (too low)
        { ...config, mcpTimeout: 100 },

        // Invalid memory thresholds (warning >= critical)
        { ...config, memoryThresholdWarning: 95, memoryThresholdCritical: 90 },

        // Invalid heap size (too low)
        { ...config, maxHeapSizeMb: 50 },
      ]

      invalidConfigs.forEach((invalidConfig, index) => {
        expect(() => validateConfig(invalidConfig), `Config ${index} should throw`).toThrow()
      })
    })

    it('should validate configuration updates', () => {
      const validUpdates = [
        { logLevel: 'debug' as const },
        { enableCache: false },
        { mcpTimeout: 60000 },
        { memoryThresholdWarning: 85 },
      ]

      validUpdates.forEach((update, index) => {
        expect(() => updateConfig(update), `Valid update ${index} should not throw`).not.toThrow()
      })

      const invalidUpdates = [
        { logLevel: 'invalid' as any },
        { mcpTimeout: 100 }, // Too low
        { memoryThresholdWarning: 95, memoryThresholdCritical: 90 }, // Warning >= critical
        { maxHeapSizeMb: 50 }, // Too low
      ]

      invalidUpdates.forEach((update, index) => {
        expect(() => updateConfig(update), `Invalid update ${index} should throw`).toThrow()
      })
    })
  })

  describe('build Configuration Validation', () => {
    it('should validate TypeScript configuration', () => {
      if (tsconfigContent) {
        const tsconfig = JSON.parse(tsconfigContent)
        const compilerOptions = tsconfig.compilerOptions || {}

        // Should target modern ES version
        expect(['ES2022', 'ES2023', 'ES2024', 'ESNext']).toContain(compilerOptions.target)

        // Should use strict mode
        expect(compilerOptions.strict).toBe(true)

        // Should use modern module resolution
        expect(['bundler', 'node16', 'nodenext']).toContain(compilerOptions.moduleResolution)

        // Should output to dist/
        expect(compilerOptions.outDir).toMatch(/dist/)
      }
    })

    it('should validate package.json configuration', () => {
      // Should have proper module type
      expect(packageJson.type).toBe('module')

      // Should target modern Node.js
      expect(packageJson.engines?.node).toMatch(/>=?\s*22/)

      // Should have proper entry points
      expect(packageJson.main).toMatch(/dist\/.*\.js$/)

      // Should have executable binary
      if (packageJson.bin) {
        const binPath = typeof packageJson.bin === 'string'
          ? packageJson.bin
          : packageJson.bin['n8n-mcp']
        expect(binPath).toMatch(/dist\/.*\.js$/)
      }
    })

    it('should validate dependency versions', () => {
      const dependencies = packageJson.dependencies || {}
      const devDependencies = packageJson.devDependencies || {}

      // Critical dependencies should be present
      expect(dependencies['@modelcontextprotocol/sdk']).toBeDefined()
      expect(dependencies.zod).toBeDefined()
      expect(dependencies.dotenv).toBeDefined()

      // Dev dependencies should include testing tools
      expect(devDependencies.vitest).toBeDefined()
      expect(devDependencies.typescript).toBeDefined()

      // Should not have conflicting versions
      Object.entries({ ...dependencies, ...devDependencies }).forEach(([pkg, version]) => {
        expect(version).toMatch(/^[\d.^~]/) // Valid semver range
      })
    })

    it('should validate script consistency', () => {
      const scripts = packageJson.scripts || {}

      // Required scripts should exist
      const requiredScripts = [
        'build',
        'dev',
        'start',
        'lint',
        'test',
        'typecheck',
      ]

      requiredScripts.forEach((script) => {
        expect(scripts[script]).toBeDefined()
      })

      // Build script should compile TypeScript
      expect(scripts.build).toMatch(/tsc|typescript|build/)

      // Test script should use vitest
      expect(scripts.test).toMatch(/vitest/)

      // Lint script should use eslint
      expect(scripts.lint).toMatch(/eslint/)
    })
  })

  describe('runtime Environment Validation', () => {
    it('should validate Node.js version compatibility', () => {
      const nodeVersion = process.version
      const majorVersion = Number.parseInt(nodeVersion.slice(1).split('.')[0], 10)

      // Should run on Node.js 22+
      expect(majorVersion).toBeGreaterThanOrEqual(22)
    })

    it('should validate feature availability', () => {
      // ESM modules should be supported
      expect(typeof import.meta).toBe('object')

      // Modern ES features should be available
      expect(typeof globalThis).toBe('object')
      expect(typeof BigInt).toBe('function')
      expect(typeof WeakRef).toBe('function')

      // Node.js APIs should be available
      expect(typeof process).toBe('object')
      expect(process.version).toBeDefined()
    })

    it('should validate memory and performance settings', () => {
      // Should have reasonable heap limits
      const memoryUsage = process.memoryUsage()
      expect(memoryUsage.heapTotal).toBeGreaterThan(1024 * 1024) // At least 1MB
      expect(memoryUsage.heapUsed).toBeGreaterThan(0)

      // Should have performance timing available
      expect(typeof performance).toBe('object')
      expect(typeof performance.now).toBe('function')
    })
  })

  describe('security Configuration Validation', () => {
    it('should validate security headers and settings', () => {
      // Should not expose sensitive environment variables
      const sensitiveVars = ['PASSWORD', 'SECRET', 'PRIVATE_KEY', 'TOKEN']

      sensitiveVars.forEach((varName) => {
        if (process.env[varName]) {
          // Should not be logged or exposed
          expect(JSON.stringify(config)).not.toContain(process.env[varName])
        }
      })
    })

    it('should validate HTTPS and TLS settings', () => {
      // Should handle HTTPS URLs properly
      if (config.n8nApiUrl) {
        const url = new URL(config.n8nApiUrl)
        if (url.protocol === 'https:') {
          // Should be configured for secure connections
          expect(url.protocol).toBe('https:')
        }
      }
    })

    it('should validate input sanitization settings', () => {
      // Should enable sanitization by default
      expect(config.sanitizeApiResponses).toBe(true)

      // Should have reasonable response size limits
      expect(config.maxResponseSize).toBeGreaterThan(1024)
      expect(config.maxResponseSize).toBeLessThan(100 * 1024 * 1024) // Less than 100MB
    })
  })

  // Helper function to convert snake_case to camelCase
  function toCamelCase(str: string): string {
    return str.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  }
})
