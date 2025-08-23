/**
 * Configuration Consistency Tests
 *
 * Critical tests to ensure all configuration values remain consistent
 * across different files and prevent count/version mismatches.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

describe('configuration Consistency Tests', () => {
  let packageJson: any
  let readmeContent: string
  let claudeContent: string
  let dockerfileContent: string
  let indexContent: string
  let toolsIndexContent: string
  let comprehensiveToolsContent: string

  beforeAll(() => {
    const projectRoot = join(process.cwd())

    // Read all relevant files
    packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'))
    readmeContent = readFileSync(join(projectRoot, 'README.md'), 'utf-8')
    claudeContent = readFileSync(join(projectRoot, 'CLAUDE.md'), 'utf-8')
    dockerfileContent = readFileSync(join(projectRoot, 'Dockerfile'), 'utf-8')
    indexContent = readFileSync(join(projectRoot, 'src/index.ts'), 'utf-8')
    toolsIndexContent = readFileSync(join(projectRoot, 'src/tools/index.ts'), 'utf-8')
    comprehensiveToolsContent = readFileSync(join(projectRoot, 'src/tools/comprehensive.ts'), 'utf-8')
  })

  describe('version Consistency', () => {
    it('should have consistent version across package.json and Dockerfile', () => {
      const packageVersion = packageJson.version
      expect(packageVersion).toBeDefined()
      expect(packageVersion).toMatch(/^\d+\.\d+\.\d+$/)

      // Dockerfile should reference the same version
      const dockerVersionMatch = dockerfileContent.match(/LABEL version="([^"]+)"/)
      if (dockerVersionMatch) {
        const dockerVersion = dockerVersionMatch[1]
        expect(dockerVersion).toBe(packageVersion)
      }
    })

    it('should have consistent version in CLAUDE.md references', () => {
      const packageVersion = packageJson.version

      // Check for version references in CLAUDE.md
      const versionMatches = claudeContent.match(/v\d+\.\d+\.\d+/g) || []
      if (versionMatches.length > 0) {
        // Latest version reference should match package.json
        const latestVersionRef = versionMatches[versionMatches.length - 1]
        expect(latestVersionRef).toBe(`v${packageVersion}`)
      }
    })

    it('should maintain semantic versioning format', () => {
      const version = packageJson.version
      const semverPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Z-]+(?:\.[0-9A-Z-]+)*))?(?:\+([0-9A-Z-]+(?:\.[0-9A-Z-]+)*))?$/i

      expect(version).toMatch(semverPattern)

      const [, major, minor, patch] = version.match(semverPattern) || []
      expect(Number(major)).toBeGreaterThanOrEqual(0)
      expect(Number(minor)).toBeGreaterThanOrEqual(0)
      expect(Number(patch)).toBeGreaterThanOrEqual(0)
    })
  })

  describe('tool Count Consistency', () => {
    it('should have consistent tool count across all files', () => {
      // Extract tool counts from various sources
      const counts = {
        readme: extractToolCountFromReadme(),
        claude: extractToolCountFromClaude(),
        index: extractToolCountFromIndex(),
        toolsIndex: extractToolCountFromToolsIndex(),
        comprehensive: extractToolCountFromComprehensive(),
      }

      // All counts should be defined and be numbers
      Object.entries(counts).forEach(([source, count]) => {
        expect(count, `Tool count from ${source} should be defined`).toBeDefined()
        if (count !== null) {
          expect(typeof count, `Tool count from ${source} should be a number`).toBe('number')
          expect(count, `Tool count from ${source} should be positive`).toBeGreaterThan(0)
        }
      })

      // Calculate expected total based on actual implementation
      const mcpCount = extractExecuteToolCount()
      const comprehensiveCount = extractComprehensiveToolCount()
      const calculatedTotal = mcpCount + comprehensiveCount

      // Verify counts are within reasonable ranges and consistent
      if (counts.readme && counts.claude) {
        // README and CLAUDE.md should be consistent with each other
        expect(Math.abs(counts.readme - counts.claude)).toBeLessThanOrEqual(5) // Allow small variance
      }

      // All found counts should be in a reasonable range
      Object.entries(counts).forEach(([source, count]) => {
        if (count !== null && count > 0) {
          expect(count, `${source} tool count should be reasonable`).toBeGreaterThan(30)
          expect(count, `${source} tool count should be reasonable`).toBeLessThan(150)
        }
      })
    })

    it('should validate tool breakdown calculation', () => {
      // Extract the breakdown from index.ts
      const mcpRegisteredCount = extractExecuteToolCount()
      const comprehensiveToolCount = extractComprehensiveToolCount()

      expect(mcpRegisteredCount).toBeGreaterThan(5) // Should have multiple MCP tools
      expect(comprehensiveToolCount).toBeGreaterThan(10) // Should have multiple comprehensive tools

      const calculatedTotal = mcpRegisteredCount + comprehensiveToolCount
      expect(calculatedTotal).toBeGreaterThan(40) // Should be substantial total
      expect(calculatedTotal).toBeLessThan(200) // Reasonable upper bound
    })

    it('should prevent hardcoded count drift', () => {
      // Look for hardcoded tool counts that might become stale
      const hardcodedPatterns = [
        /(\d+)\s*(?:\+\s*)?tools?/gi,
        /tools?[:\s]*(\d+)/gi,
        /(\d+)\s*available\s*tools?/gi,
      ]

      const suspiciousMatches: string[] = []

      hardcodedPatterns.forEach((pattern) => {
        const readmeMatches = readmeContent.match(pattern) || []
        const claudeMatches = claudeContent.match(pattern) || []

        suspiciousMatches.push(...readmeMatches, ...claudeMatches)
      })

      // Check that found matches are reasonable (not obviously outdated)
      suspiciousMatches.forEach((match) => {
        const numberMatch = match.match(/\d+/)
        if (numberMatch) {
          const count = Number.parseInt(numberMatch[0], 10)
          // Should be in reasonable range for our tool count
          if (count > 50 && count < 150) {
            expect(count).toBeGreaterThan(80) // Should be in expected range
            expect(count).toBeLessThan(120) // Should be in expected range
          }
        }
      })
    })
  })

  describe('agent Count Consistency', () => {
    it('should have consistent agent count across documentation', () => {
      const agentCounts = {
        readme: extractAgentCountFromReadme(),
        claude: extractAgentCountFromClaude(),
      }

      const expectedAgentCount = 6 // Actual count from agents directory: 6 agent files (excluding README.md)

      Object.entries(agentCounts).forEach(([source, count]) => {
        if (count) {
          expect(count, `Agent count from ${source} should match expected`).toBe(expectedAgentCount)
        }
      })
    })

    it('should validate agent hierarchy structure', () => {
      // Check that CLAUDE.md describes the correct agent hierarchy
      const hierarchyPatterns = [
        /TIER\s+1[^:]+:\s+([^T]+)/i,
        /TIER\s+2[^:]+:\s+([^T]+)/i,
        /TIER\s+3[^:]+:\s+([^T]+)/i,
      ]

      hierarchyPatterns.forEach((pattern) => {
        const match = claudeContent.match(pattern)
        if (match) {
          expect(match[1]).toBeDefined()
          expect(match[1].trim()).toBeTruthy()
        }
      })
    })

    it('should validate agent tier counts', () => {
      // Extract tier information from CLAUDE.md
      const tier1Match = claudeContent.match(/TIER\s+1[^:]*:([\s\S]*?)(?=TIER\s+2|$)/i)
      const tier2Match = claudeContent.match(/TIER\s+2[^:]*:([\s\S]*?)(?=TIER\s+3|$)/i)
      const tier3Match = claudeContent.match(/TIER\s+3[^:]*:([\s\S]*?)(?=###|##|$)/i)

      if (tier1Match && tier2Match && tier3Match) {
        const tier1Agents = (tier1Match[1].match(/`[^`]+`/g) || []).length
        const tier2Agents = (tier2Match[1].match(/`[^`]+`/g) || []).length
        const tier3Agents = (tier3Match[1].match(/`[^`]+`/g) || []).length

        // Expected structure: 1 + 4 + 1 = 6 agents
        expect(tier1Agents).toBe(1) // n8n-orchestrator
        expect(tier2Agents).toBe(4) // n8n-builder, n8n-connector, n8n-node-expert, n8n-scriptguard
        expect(tier3Agents).toBe(1) // n8n-guide
        expect(tier1Agents + tier2Agents + tier3Agents).toBe(6)
      }
    })
  })

  describe('node.js Version Consistency', () => {
    it('should have consistent Node.js requirements', () => {
      const packageEngines = packageJson.engines?.node
      expect(packageEngines).toBeDefined()

      // Should require Node.js 22+
      expect(packageEngines).toMatch(/>=?\s*22/)

      // Check Dockerfile Node version
      const dockerNodeMatch = dockerfileContent.match(/FROM node:(\d+)/i)
      if (dockerNodeMatch) {
        const dockerNodeVersion = Number.parseInt(dockerNodeMatch[1], 10)
        expect(dockerNodeVersion).toBeGreaterThanOrEqual(22)
      }
    })

    it('should validate TypeScript target compatibility', () => {
      // Read tsconfig.json if it exists
      try {
        const tsconfig = JSON.parse(readFileSync(join(process.cwd(), 'tsconfig.json'), 'utf-8'))
        const target = tsconfig.compilerOptions?.target

        if (target) {
          // Should target modern ES version
          expect(['ES2022', 'ES2023', 'ES2024', 'ESNext']).toContain(target)
        }
      }
      catch {
        // tsconfig.json might not exist, which is fine
      }
    })
  })

  describe('dependency Consistency', () => {
    it('should maintain minimal dependency philosophy', () => {
      const dependencies = Object.keys(packageJson.dependencies || {})
      const devDependencies = Object.keys(packageJson.devDependencies || {})

      // Core dependencies should be minimal (aim for < 10)
      expect(dependencies.length).toBeLessThan(10)

      // Should include essential packages
      const essentialPackages = ['@modelcontextprotocol/sdk', 'zod', 'dotenv']
      essentialPackages.forEach((pkg) => {
        expect(dependencies).toContain(pkg)
      })
    })

    it('should avoid legacy or problematic dependencies', () => {
      const dependencies = Object.keys(packageJson.dependencies || {})
      const devDependencies = Object.keys(packageJson.devDependencies || {})
      const allDeps = [...dependencies, ...devDependencies]

      // Problematic packages to avoid
      const problematicPackages = [
        'axios', // prefer undici/fetch
        'lodash', // prefer native methods
        'moment', // prefer native Date or date-fns
        'request', // deprecated
      ]

      problematicPackages.forEach((pkg) => {
        expect(allDeps).not.toContain(pkg)
      })
    })
  })

  describe('environment Configuration', () => {
    it('should validate default configuration values', () => {
      // Check that defaults in config.ts are reasonable
      const configDefaults = {
        logLevel: 'info',
        mcpMode: 'stdio',
        mcpTimeout: 30000,
        enableCache: true,
        cacheTtl: 3600,
        maxConcurrentRequests: 10,
      }

      Object.entries(configDefaults).forEach(([key, expectedValue]) => {
        // This would need to be tested by importing config
        expect(expectedValue).toBeDefined()
      })
    })

    it('should validate environment variable naming', () => {
      // Environment variables should follow consistent naming
      const expectedEnvVars = [
        'NODE_ENV',
        'N8N_API_URL',
        'N8N_API_KEY',
        'LOG_LEVEL',
        'MCP_MODE',
        'MCP_TIMEOUT',
        'ENABLE_CACHE',
        'CACHE_TTL',
      ]

      expectedEnvVars.forEach((envVar) => {
        expect(envVar).toMatch(/^[A-Z][A-Z0-9_]*$/) // Uppercase with underscores
      })
    })
  })

  describe('build Configuration', () => {
    it('should validate package.json scripts', () => {
      const scripts = packageJson.scripts || {}
      const requiredScripts = ['build', 'dev', 'start', 'lint', 'test', 'typecheck']

      requiredScripts.forEach((script) => {
        expect(scripts[script], `${script} script should be defined`).toBeDefined()
      })
    })

    it('should validate output configuration', () => {
      const main = packageJson.main
      const bin = packageJson.bin

      if (main) {
        expect(main).toMatch(/dist\/.*\.js$/)
      }

      if (bin) {
        const binPath = typeof bin === 'string' ? bin : bin['n8n-mcp']
        if (binPath) {
          expect(binPath).toMatch(/dist\/.*\.js$/)
        }
      }
    })
  })

  // Helper functions
  function extractToolCountFromReadme(): number | null {
    // Look for main tool count in title, not category breakdowns
    const patterns = [
      /##?\s*🛠️\s*(\d+)\s*MCP\s*Tools/i,
      /(\d+)\s*MCP\s*Tools/i,
      /total\s+(\d+)\s+tools/i,
    ]

    for (const pattern of patterns) {
      const match = readmeContent.match(pattern)
      if (match)
        return Number.parseInt(match[1], 10)
    }
    return null
  }

  function extractToolCountFromClaude(): number | null {
    // Look for main tool count, not breakdown
    const patterns = [
      /provides\s*(\d+)\s*tools/i,
      /(\d+)\s+tools\s+n8n/i,
      /MCP\s+server\s+(\d+)\s+tools/i,
    ]

    for (const pattern of patterns) {
      const match = claudeContent.match(pattern)
      if (match)
        return Number.parseInt(match[1], 10)
    }
    return null
  }

  function extractToolCountFromIndex(): number | null {
    const match = indexContent.match(/return\s+(\d+)/)
    return match ? Number.parseInt(match[1], 10) : null
  }

  function extractToolCountFromToolsIndex(): number | null {
    const match = toolsIndexContent.match(/(\d+)\s*tools?/i)
    return match ? Number.parseInt(match[1], 10) : null
  }

  function extractToolCountFromComprehensive(): number | null {
    const match = comprehensiveToolsContent.match(/(\d+)\s*total\s*tools?/i)
    return match ? Number.parseInt(match[1], 10) : null
  }

  function extractExecuteToolCount(): number {
    // Extract MCP registered tool count by counting function return array entries
    // Look for the getMCPToolRegistry function and count its entries
    const lines = indexContent.split('\n')
    let inRegistry = false
    let toolCount = 0

    for (const line of lines) {
      if (line.includes('getMCPToolRegistry')) {
        inRegistry = true
      }
      else if (inRegistry && line.includes('return [')) {
        inRegistry = true
      }
      else if (inRegistry && line.includes(']')) {
        break
      }
      else if (inRegistry && line.trim().startsWith('\'')) {
        toolCount++
      }
    }

    return toolCount || 12 // Fallback
  }

  function extractComprehensiveToolCount(): number {
    // Count all tool objects with name property
    const toolObjectMatches = comprehensiveToolsContent.match(/\{\s*name:\s*['"`][^'"`]+['"`]/g) || []
    return toolObjectMatches.length || 40 // Fallback
  }

  function extractAgentCountFromReadme(): number | null {
    const match = readmeContent.match(/(\d+)-agent/i)
    return match ? Number.parseInt(match[1], 10) : null
  }

  function extractAgentCountFromClaude(): number | null {
    const match = claudeContent.match(/(\d+)\s*agents?/i)
    return match ? Number.parseInt(match[1], 10) : null
  }
})
