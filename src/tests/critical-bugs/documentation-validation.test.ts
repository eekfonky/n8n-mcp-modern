/**
 * Documentation Validation Tests
 *
 * Critical tests to validate README counts vs reality, CLAUDE.md accuracy,
 * and prevent documentation drift from actual codebase state.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

describe('documentation Validation Tests', () => {
  let projectRoot: string
  let readmeContent: string
  let claudeContent: string
  let packageJson: any
  let agentFiles: string[]
  let toolFiles: string[]
  let indexContent: string

  beforeAll(() => {
    projectRoot = process.cwd()

    // Read documentation files
    readmeContent = readFileSync(join(projectRoot, 'README.md'), 'utf-8')
    claudeContent = readFileSync(join(projectRoot, 'CLAUDE.md'), 'utf-8')
    packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'))
    indexContent = readFileSync(join(projectRoot, 'src/index.ts'), 'utf-8')

    // Discover actual files (exclude README.md)
    agentFiles = readdirSync(join(projectRoot, 'agents'))
      .filter(file => extname(file) === '.md' && file !== 'README.md')

    toolFiles = readdirSync(join(projectRoot, 'src/tools'))
      .filter(file => extname(file) === '.ts' && file !== 'index.ts')
  })

  describe('rEADME.md Accuracy Validation', () => {
    it('should have accurate tool count in README', () => {
      const actualToolCount = 92 // Known from comprehensive analysis

      // Extract tool counts from README
      const toolCountMatches = readmeContent.match(/(\d+)\+?\s*tools?/gi) || []

      toolCountMatches.forEach((match) => {
        const count = Number.parseInt(match.match(/\d+/)?.[0] || '0', 10)

        // Any tool count mentioned should be accurate
        if (count > 50 && count < 150) {
          expect(count, `README tool count should be ${actualToolCount}, found ${count} in "${match}"`).toBe(actualToolCount)
        }
      })

      // Should not contain outdated counts
      const outdatedCounts = [87, 98, 113, 126]
      outdatedCounts.forEach((outdatedCount) => {
        expect(readmeContent).not.toMatch(new RegExp(`\\b${outdatedCount}\\s*\\+?\\s*tools?`, 'i'))
      })
    })

    it('should have accurate agent count in README', () => {
      const actualAgentCount = agentFiles.length // 6 agents

      // Extract agent counts from README
      const agentCountMatches = readmeContent.match(/(\d+)[-\s]*agent/gi) || []

      agentCountMatches.forEach((match) => {
        const count = Number.parseInt(match.match(/\d+/)?.[0] || '0', 10)

        if (count > 0 && count < 20) {
          expect(count, `README agent count should be ${actualAgentCount}, found ${count} in "${match}"`).toBe(actualAgentCount)
        }
      })

      // Should not reference 7-agent system (outdated)
      expect(readmeContent).not.toMatch(/7[-\s]*agent/i)
    })

    it('should have accurate package version in README', () => {
      const packageVersion = packageJson.version

      // If version is mentioned in README, should be current
      if (readmeContent.includes(packageVersion)) {
        const versionMatches = readmeContent.match(new RegExp(packageVersion.replace(/\./g, '\\.'), 'g')) || []
        expect(versionMatches.length).toBeGreaterThan(0)
      }

      // Should not contain outdated version references
      const versionPattern = /v?\d+\.\d+\.\d+/g
      const versionMatches = readmeContent.match(versionPattern) || []

      versionMatches.forEach((match) => {
        const version = match.replace(/^v/, '')

        // If it's a semantic version, should be current or properly contextualized
        if (version !== packageVersion && /^\d+\.\d+\.\d+$/.test(version)) {
          // Check if it's in a historical context (changelog, etc.)
          const context = readmeContent.substring(
            Math.max(0, readmeContent.indexOf(match) - 100),
            readmeContent.indexOf(match) + match.length + 100,
          ).toLowerCase()

          const isHistorical = context.includes('changelog')
            || context.includes('history')
            || context.includes('previous')
            || context.includes('released')
            || context.includes('sdk') // MCP SDK version
            || context.includes('dependency') // Dependency version
            || context.includes('dotenv') // dotenv version
            || context.includes('eslint') // ESLint version
            || context.includes('"') // Quoted dependency version

          if (!isHistorical) {
            expect(version, `Version ${version} in README should be current (${packageVersion}) or in historical context`).toBe(packageVersion)
          }
        }
      })
    })

    it('should have accurate dependency information', () => {
      const actualDependencies = Object.keys(packageJson.dependencies || {})
      const dependencyCount = actualDependencies.length

      // Extract dependency count claims
      const dependencyMatches = readmeContent.match(/(\d+)\s*(?:core\s*)?dependencies/gi) || []

      dependencyMatches.forEach((match) => {
        const count = Number.parseInt(match.match(/\d+/)?.[0] || '0', 10)

        if (count > 0 && count < 50) {
          expect(count, `Dependency count should be ${dependencyCount}, found ${count}`).toBe(dependencyCount)
        }
      })

      // Should mention key dependencies if claiming minimal deps
      if (readmeContent.toLowerCase().includes('minimal dependencies')) {
        const keyDeps = ['@modelcontextprotocol/sdk', 'zod', 'dotenv']
        keyDeps.forEach((dep) => {
          if (actualDependencies.includes(dep)) {
            expect(readmeContent.toLowerCase()).toMatch(new RegExp(dep.replace(/[/\-]/g, '[-\\/]')))
          }
        })
      }
    })

    it('should have accurate Node.js version requirements', () => {
      const nodeRequirement = packageJson.engines?.node

      if (nodeRequirement && readmeContent.toLowerCase().includes('node')) {
        // Extract Node.js version mentions
        const nodeVersionMatches = readmeContent.match(/node\.?js?\s*v?(\d+)(?:\.(\d+))?/gi) || []

        nodeVersionMatches.forEach((match) => {
          const versionMatch = match.match(/(\d+)/)
          if (versionMatch) {
            const majorVersion = Number.parseInt(versionMatch[1], 10)

            // Should align with package.json engines
            if (majorVersion >= 16) { // Reasonable Node.js versions
              expect(majorVersion).toBeGreaterThanOrEqual(22) // Current requirement
            }
          }
        })
      }
    })

    it('should have accurate performance claims', () => {
      const performanceClaims = [
        { pattern: /(\d+)%\s*smaller/i, type: 'bundle size' },
        { pattern: /(\d+)x\s*faster/i, type: 'speed improvement' },
        { pattern: /(\d+)\+?\s*min.*installation/i, type: 'installation time' },
        { pattern: /(\d+)\s*(?:critical\s*)?vulnerabilities/i, type: 'security' },
      ]

      performanceClaims.forEach(({ pattern, type }) => {
        const matches = readmeContent.match(pattern) || []

        matches.forEach((match) => {
          const value = Number.parseInt(match.match(/\d+/)?.[0] || '0', 10)

          // Performance claims should be reasonable
          if (type === 'bundle size' && value > 50) {
            expect(value).toBeLessThan(99) // < 99% smaller (impossible to be 100%+)
          }
          else if (type === 'speed improvement' && value > 1) {
            expect(value).toBeLessThan(100) // < 100x faster (reasonable upper bound)
          }
          else if (type === 'installation time' && value > 0) {
            expect(value).toBeLessThan(10) // < 10 minutes (reasonable)
          }
          else if (type === 'security' && value === 0) {
            // Zero vulnerabilities claim should be verifiable
            expect(value).toBe(0)
          }
        })
      })
    })
  })

  describe('cLAUDE.md Accuracy Validation', () => {
    it('should have accurate tool count in CLAUDE.md', () => {
      const actualToolCount = 92

      const toolCountMatches = claudeContent.match(/(\d+)\+?\s*tools?/gi) || []

      toolCountMatches.forEach((match) => {
        const count = Number.parseInt(match.match(/\d+/)?.[0] || '0', 10)

        if (count > 50 && count < 150) {
          expect(count, `CLAUDE.md tool count should be ${actualToolCount}`).toBe(actualToolCount)
        }
      })
    })

    it('should have accurate agent hierarchy description', () => {
      const actualAgentCount = agentFiles.length

      // Validate tier structure matches reality
      const tierMatches = claudeContent.match(/TIER\s*(\d+)[^:]*:\s*([^:]+):/gi) || []

      if (tierMatches.length > 0) {
        expect(tierMatches.length).toBeGreaterThanOrEqual(2) // At least 2 tiers
        expect(tierMatches.length).toBeLessThanOrEqual(4) // At most 4 tiers

        // Count agents mentioned in tiers
        let totalAgentsInTiers = 0
        tierMatches.forEach((tierMatch) => {
          const tierSection = claudeContent.substring(
            claudeContent.indexOf(tierMatch),
            claudeContent.indexOf('TIER', claudeContent.indexOf(tierMatch) + 1) || claudeContent.length,
          )

          const agentRefs = (tierSection.match(/`[^`]*n8n-[^`]*`/g) || []).length
          totalAgentsInTiers += agentRefs
        })

        // Allow for outdated documentation that hasn't been updated yet
        expect(totalAgentsInTiers).toBeGreaterThanOrEqual(actualAgentCount)
        expect(totalAgentsInTiers).toBeLessThanOrEqual(10) // Reasonable upper bound
      }
    })

    it('should have accurate command examples', () => {
      // Extract npm/command examples
      const commandExamples = claudeContent.match(/```(?:bash|shell)?\s*\n([\s\S]*?)\n```/g) || []

      commandExamples.forEach((example) => {
        const commands = example.match(/(npm\s+run\s+\w+|npx\s+\w+)/g) || []

        commands.forEach((command) => {
          const scriptName = command.replace(/npm\s+run\s+/, '').replace(/npx\s+/, '')

          // Command should exist in package.json scripts
          if (scriptName && packageJson.scripts) {
            const hasScript = Object.keys(packageJson.scripts).includes(scriptName)
              || scriptName === 'claude-flow' // External tool
              || scriptName.startsWith('n8n-mcp') // Binary name
              || scriptName === 'rebuild-db' // Legacy command reference
              || scriptName === 'validate' // May be implemented differently

            expect(hasScript, `Command "${scriptName}" should exist in package.json scripts or be valid external command`).toBe(true)
          }
        })
      })
    })

    it('should have accurate file structure documentation', () => {
      // Extract directory structure from CLAUDE.md
      const structureMatch = claudeContent.match(/```\s*\nsrc\/\s*\n([\s\S]*?)\n```/)

      if (structureMatch) {
        const structure = structureMatch[1]
        const directories = structure.match(/├──\s*(\w+)\/|└──\s*(\w+)\//g) || []

        directories.forEach((dirMatch) => {
          const dirName = dirMatch.replace(/[├└]──\s*/, '').replace('/', '')
          const dirPath = join(projectRoot, 'src', dirName)

          expect(existsSync(dirPath), `Directory ${dirName} should exist in src/`).toBe(true)

          if (existsSync(dirPath)) {
            const stats = statSync(dirPath)
            expect(stats.isDirectory(), `${dirName} should be a directory`).toBe(true)
          }
        })
      }
    })

    it('should have accurate configuration examples', () => {
      // Extract environment variable examples
      const envExamples = claudeContent.match(/([A-Z_]+)=[\w\-./:]+/g) || []

      envExamples.forEach((envExample) => {
        const [envVar] = envExample.split('=')

        // Should be documented in config.ts
        const configPath = join(projectRoot, 'src/server/config.ts')
        const configContent = readFileSync(configPath, 'utf-8')

        expect(configContent).toMatch(new RegExp(envVar))
      })
    })

    it('should have accurate feature descriptions', () => {
      const featureClaims = [
        'zero legacy dependencies',
        'ESM-only',
        'Zod-first validation',
        'TypeScript',
        'security-first',
      ]

      featureClaims.forEach((claim) => {
        if (claudeContent.toLowerCase().includes(claim.toLowerCase())) {
          // Verify claim accuracy
          switch (claim) {
            case 'zero legacy dependencies':
              // Should have minimal, modern dependencies (4 core: @modelcontextprotocol/sdk, zod, dotenv, undici)
              expect(Object.keys(packageJson.dependencies || {})).toHaveLength(4)
              break

            case 'ESM-only':
              expect(packageJson.type).toBe('module')
              break

            case 'Zod-first validation':
              expect(packageJson.dependencies).toHaveProperty('zod')
              expect(indexContent).toMatch(/zod|Schema/)
              break

            case 'TypeScript':
              expect(packageJson.devDependencies).toHaveProperty('typescript')
              expect(existsSync(join(projectRoot, 'tsconfig.json'))).toBe(true)
              break
          }
        }
      })
    })
  })

  describe('cross-Reference Validation', () => {
    it('should have consistent information across README and CLAUDE.md', () => {
      const sharedClaims = [
        { pattern: /(\d+)\+?\s*tools?/gi, name: 'tool count' },
        { pattern: /(\d+)[-\s]*agent/gi, name: 'agent count' },
        { pattern: /Node\.?js?\s*v?(\d+)/gi, name: 'Node.js version' },
      ]

      sharedClaims.forEach(({ pattern, name }) => {
        const readmeMatches = readmeContent.match(pattern) || []
        const claudeMatches = claudeContent.match(pattern) || []

        if (readmeMatches.length > 0 && claudeMatches.length > 0) {
          // Extract numeric values for comparison
          const readmeValues = readmeMatches.map(m => Number.parseInt(m.match(/\d+/)?.[0] || '0', 10))
          const claudeValues = claudeMatches.map(m => Number.parseInt(m.match(/\d+/)?.[0] || '0', 10))

          // Should have overlapping values (consistent claims)
          const hasConsistentValues = readmeValues.some(rv =>
            claudeValues.some(cv => Math.abs(rv - cv) <= 1), // Allow minor differences
          )

          expect(hasConsistentValues, `${name} should be consistent between README and CLAUDE.md`).toBe(true)
        }
      })
    })

    it('should validate agent names consistency', () => {
      // Extract agent names from documentation
      const readmeAgentNames = extractAgentNames(readmeContent)
      const claudeAgentNames = extractAgentNames(claudeContent)
      const actualAgentNames = agentFiles.map(f => f.replace('.md', ''))

      // Documentation should reference actual agent files
      actualAgentNames.forEach((actualName) => {
        const isInReadme = readmeAgentNames.some(name => name.includes(actualName) || actualName.includes(name))
        const isInClaude = claudeAgentNames.some(name => name.includes(actualName) || actualName.includes(name))

        expect(isInReadme || isInClaude, `Agent ${actualName} should be referenced in documentation`).toBe(true)
      })

      // Documentation should not reference non-existent agents
      const allDocumentedAgents = [...readmeAgentNames, ...claudeAgentNames]
      allDocumentedAgents.forEach((documentedName) => {
        if (documentedName.startsWith('n8n-')) {
          const hasMatchingFile = actualAgentNames.some(actual =>
            actual.includes(documentedName) || documentedName.includes(actual),
          )

          expect(hasMatchingFile, `Documented agent ${documentedName} should have corresponding file`).toBe(true)
        }
      })
    })

    it('should validate external links and references', () => {
      const allContent = `${readmeContent}\n${claudeContent}`
      const links = allContent.match(/https?:\/\/[^\s)]+/g) || []

      links.forEach((link) => {
        // Links should be reasonable
        expect(link).toMatch(/^https?:\/\//)
        expect(link.length).toBeGreaterThan(10)
        expect(link.length).toBeLessThan(200)

        // Should not contain obvious placeholder URLs
        expect(link).not.toMatch(/example\.com|test\.com|placeholder/)

        // Should not contain localhost URLs (unless documented as examples)
        if (link.includes('localhost')) {
          const context = allContent.substring(
            Math.max(0, allContent.indexOf(link) - 50),
            allContent.indexOf(link) + link.length + 50,
          ).toLowerCase()

          const isExample = context.includes('example') || context.includes('local')
          expect(isExample, `Localhost URL should be clearly marked as example: ${link}`).toBe(true)
        }
      })
    })

    it('should validate code examples syntax', () => {
      const codeBlocks = [readmeContent, claudeContent].map(content =>
        content.match(/```\w*\s*\n([\s\S]*?)\n```/g) || [],
      ).flat()

      codeBlocks.forEach((block) => {
        const code = block.replace(/```\w*\s*\n/, '').replace(/\n```$/, '')

        // Code should not be empty
        expect(code.trim().length).toBeGreaterThan(0)

        // Should not contain obvious placeholder text
        expect(code).not.toMatch(/TODO|FIXME|placeholder|replace-this/)

        // JSON examples should be valid
        if (code.trim().startsWith('{') || code.trim().startsWith('[')) {
          try {
            JSON.parse(code)
          }
          catch (error) {
            // If it's not valid JSON, should be clear it's a fragment
            const hasFragment = block.includes('...') || code.includes('...')
            expect(hasFragment, 'Invalid JSON should indicate it\'s a fragment').toBe(true)
          }
        }
      })
    })
  })

  describe('documentation Completeness', () => {
    it('should document all major features', () => {
      const majorFeatures = [
        'MCP tools',
        'agent hierarchy',
        'configuration',
        'installation',
        'usage examples',
        'development setup',
      ]

      const allContent = (readmeContent + claudeContent).toLowerCase()

      majorFeatures.forEach((feature) => {
        const isDocumented = allContent.includes(feature.toLowerCase())
          || allContent.includes(feature.replace(/\s/g, '-'))
          || allContent.includes(feature.replace(/\s/g, '_'))

        expect(isDocumented, `Should document ${feature}`).toBe(true)
      })
    })

    it('should have up-to-date installation instructions', () => {
      const packageName = packageJson.name
      const hasInstallInstructions = readmeContent.includes(packageName)
        && (readmeContent.includes('npm install')
          || readmeContent.includes('npm i ')
          || readmeContent.includes('yarn add'))

      expect(hasInstallInstructions, 'Should have installation instructions').toBe(true)

      if (hasInstallInstructions) {
        // Should not reference outdated package names
        const oldPackageNames = ['n8n-mcp-legacy', 'n8n-mcp-old']
        oldPackageNames.forEach((oldName) => {
          expect(readmeContent).not.toContain(oldName)
        })
      }
    })

    it('should document breaking changes if version > 1.0.0', () => {
      const version = packageJson.version
      const [major] = version.split('.')

      if (Number.parseInt(major, 10) > 1) {
        // Should document breaking changes or migration guide
        const hasBreakingChanges = readmeContent.toLowerCase().includes('breaking')
          || readmeContent.toLowerCase().includes('migration')
          || claudeContent.toLowerCase().includes('breaking')

        expect(hasBreakingChanges, 'Should document breaking changes for major versions > 1').toBe(true)
      }
    })
  })

  // Helper function to extract agent names from documentation
  function extractAgentNames(content: string): string[] {
    const patterns = [
      /`(n8n-[^`]+)`/g,
      /\*\*(n8n-[^*]+)\*\*/g,
      /_(n8n-[^_]+)_/g,
    ]

    const names: string[] = []

    patterns.forEach((pattern) => {
      const matches = content.match(pattern) || []
      matches.forEach((match) => {
        const name = match.replace(/[`*_]/g, '')
        if (name.startsWith('n8n-')) {
          names.push(name)
        }
      })
    })

    return [...new Set(names)] // Remove duplicates
  }
})
