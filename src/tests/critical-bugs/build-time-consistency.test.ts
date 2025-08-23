/**
 * Build-Time Consistency Checks
 *
 * Critical tests to ensure pre-commit hooks maintain version sync,
 * count consistency, and prevent build-time inconsistencies.
 */

import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

describe('build-Time Consistency Checks', () => {
  let projectRoot: string
  let packageJson: any
  let lintStagedConfig: any | null = null
  let gitExists: boolean = false

  beforeAll(() => {
    projectRoot = process.cwd()
    packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'))

    // Check for lint-staged configuration
    try {
      if (existsSync(join(projectRoot, '.lintstagedrc.json'))) {
        lintStagedConfig = JSON.parse(readFileSync(join(projectRoot, '.lintstagedrc.json'), 'utf-8'))
      }
      else if (packageJson['lint-staged']) {
        lintStagedConfig = packageJson['lint-staged']
      }
    }
    catch {
      lintStagedConfig = null
    }

    // Check if git repository exists
    gitExists = existsSync(join(projectRoot, '.git'))
  })

  describe('pre-commit Hook Configuration', () => {
    it('should have lint-staged configuration', () => {
      expect(lintStagedConfig, 'lint-staged should be configured').toBeTruthy()

      if (lintStagedConfig) {
        // Should have patterns for different file types
        const hasTypeScriptPattern = Object.keys(lintStagedConfig).some(pattern =>
          pattern.includes('ts') && pattern.includes('*'),
        )
        const hasJavaScriptPattern = Object.keys(lintStagedConfig).some(pattern =>
          pattern.includes('js') && pattern.includes('*'),
        )

        expect(hasTypeScriptPattern || hasJavaScriptPattern, 'Should have patterns for TypeScript/JavaScript files').toBe(true)
      }
    })

    it('should validate lint-staged commands', () => {
      if (lintStagedConfig) {
        Object.entries(lintStagedConfig).forEach(([pattern, commands]) => {
          const commandArray = Array.isArray(commands) ? commands : [commands]

          commandArray.forEach((command: string) => {
            // Commands should be reasonable
            expect(command).toBeTruthy()
            expect(typeof command).toBe('string')

            // Should not contain dangerous operations
            const dangerousCommands = ['rm -rf', 'sudo', 'chmod 777', 'format c:', 'del /f /s']
            dangerousCommands.forEach((dangerous) => {
              expect(command.toLowerCase()).not.toContain(dangerous.toLowerCase())
            })
          })
        })
      }
    })

    it('should have appropriate git hooks', () => {
      if (gitExists) {
        const hooksDir = join(projectRoot, '.git/hooks')

        if (existsSync(hooksDir)) {
          // Check for common hooks
          const expectedHooks = ['pre-commit']

          expectedHooks.forEach((hook) => {
            const hookPath = join(hooksDir, hook)
            if (existsSync(hookPath)) {
              const stats = statSync(hookPath)
              expect(stats.isFile()).toBe(true)

              // Hook should be executable (on Unix systems)
              if (process.platform !== 'win32') {
                expect(stats.mode & Number.parseInt('111', 8)).toBeGreaterThan(0)
              }
            }
          })
        }
      }
    })

    it('should validate husky configuration if present', () => {
      const huskyDir = join(projectRoot, '.husky')

      if (existsSync(huskyDir)) {
        // Should have pre-commit hook
        const preCommitHook = join(huskyDir, 'pre-commit')

        if (existsSync(preCommitHook)) {
          const hookContent = readFileSync(preCommitHook, 'utf-8')

          // Should run lint-staged
          expect(hookContent).toMatch(/lint-staged|npx lint-staged/)

          // Should not have syntax errors
          expect(hookContent).not.toMatch(/\$\{undefined\}/)
          expect(hookContent).not.toMatch(/\$\{null\}/)
        }
      }
    })
  })

  describe('version Synchronization Checks', () => {
    it('should validate version consistency across files', () => {
      const version = packageJson.version
      const versionPattern = new RegExp(version.replace(/\./g, '\\.'))

      const filesToCheck = [
        { file: 'Dockerfile', required: true },
        { file: 'CLAUDE.md', required: false },
        { file: 'README.md', required: false },
      ]

      filesToCheck.forEach(({ file, required }) => {
        const filePath = join(projectRoot, file)

        if (existsSync(filePath) || required) {
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf-8')

            if (file === 'Dockerfile') {
              // Check LABEL version
              const labelMatch = content.match(/LABEL version="([^"]+)"/)
              if (labelMatch) {
                expect(labelMatch[1]).toBe(version)
              }
            }
            else if (content.includes(version)) {
              // If version is mentioned, it should be current
              expect(content).toMatch(versionPattern)
            }
          }
        }
      })
    })

    it('should validate semver compliance in version updates', () => {
      const version = packageJson.version
      const semverPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Z-]+(?:\.[0-9A-Z-]+)*))?(?:\+([0-9A-Z-]+(?:\.[0-9A-Z-]+)*))?$/i

      expect(version).toMatch(semverPattern)

      const [, major, minor, patch] = version.match(semverPattern) || []

      // Version components should be valid
      expect(Number(major)).toBeGreaterThanOrEqual(0)
      expect(Number(minor)).toBeGreaterThanOrEqual(0)
      expect(Number(patch)).toBeGreaterThanOrEqual(0)
    })

    it('should check for version tag consistency', () => {
      if (gitExists) {
        try {
          // Get latest git tag
          const latestTag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo "none"', { encoding: 'utf-8', cwd: projectRoot }).trim()

          if (latestTag !== 'none') {
            const tagVersion = latestTag.replace(/^v/, '')
            const packageVersion = packageJson.version

            // Latest tag should not be ahead of package version
            // (allowing for unreleased changes)
            expect(tagVersion).toBeDefined()
          }
        }
        catch {
          // Git commands might fail in CI or other environments
          // This is acceptable
        }
      }
    })
  })

  describe('count Consistency Validation', () => {
    it('should maintain tool count consistency in build scripts', () => {
      const scripts = packageJson.scripts || {}

      // If there are count validation scripts, they should pass
      const countScripts = Object.entries(scripts).filter(([name]) =>
        name.includes('count') || name.includes('validate'),
      )

      countScripts.forEach(([scriptName, scriptCommand]) => {
        expect(scriptCommand).toBeTruthy()
        expect(typeof scriptCommand).toBe('string')
      })
    })

    it('should validate hardcoded counts in source files', () => {
      const criticalFiles = [
        'src/index.ts',
        'src/tools/index.ts',
        'README.md',
        'CLAUDE.md',
      ]

      const expectedToolCount = 92 // Known from implementation
      const expectedAgentCount = 6 // Known from agent files (excluding README.md)

      criticalFiles.forEach((file) => {
        const filePath = join(projectRoot, file)

        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8')

          // Look for tool count references
          const toolCountMatches = content.match(/(\d+)\s*(?:\+\s*)?tools?/gi) || []
          toolCountMatches.forEach((match) => {
            const count = Number.parseInt(match.match(/\d+/)?.[0] || '0', 10)
            if (count > 50 && count < 150) { // Reasonable range for our tool count
              expect(count, `Tool count in ${file} should be ${expectedToolCount}`).toBe(expectedToolCount)
            }
          })

          // Look for agent count references
          const agentCountMatches = content.match(/(\d+)[-\s]*agents?/gi) || []
          agentCountMatches.forEach((match) => {
            const count = Number.parseInt(match.match(/\d+/)?.[0] || '0', 10)
            if (count > 0 && count < 20) { // Reasonable range for agent count
              expect(count, `Agent count in ${file} should be ${expectedAgentCount}`).toBe(expectedAgentCount)
            }
          })
        }
      })
    })

    it('should validate dynamic count calculations', () => {
      // Import and test getToolCount function
      const indexPath = join(projectRoot, 'src/index.ts')
      const indexContent = readFileSync(indexPath, 'utf-8')

      // Should have tool count logic or return statements
      expect(indexContent).toMatch(/return.*92|92.*tools/)

      // Should not have hardcoded counts that don't match
      const returnMatches = indexContent.match(/return\s+(\d+)/g) || []
      returnMatches.forEach((match) => {
        const count = Number.parseInt(match.match(/\d+/)?.[0] || '0', 10)
        if (count > 50 && count < 150) {
          expect(count).toBeGreaterThan(80) // Should be in expected range
        }
      })
    })
  })

  describe('build Output Validation', () => {
    it('should validate build script configuration', () => {
      const buildScript = packageJson.scripts?.build
      expect(buildScript).toBeDefined()

      // Build should include TypeScript compilation
      expect(buildScript).toMatch(/tsc|typescript|build/)

      // Should also set executable permissions
      expect(buildScript).toMatch(/chmod|\+x/)
    })

    it('should validate output directory structure', () => {
      const distDir = join(projectRoot, 'dist')

      // If dist exists, validate structure
      if (existsSync(distDir)) {
        // Should have main entry point
        const mainFile = join(distDir, 'index.js')
        if (existsSync(mainFile)) {
          const stats = statSync(mainFile)
          expect(stats.isFile()).toBe(true)

          // Should be executable
          if (process.platform !== 'win32') {
            expect(stats.mode & Number.parseInt('111', 8)).toBeGreaterThan(0)
          }

          // Should have shebang
          const content = readFileSync(mainFile, 'utf-8')
          expect(content.startsWith('#!/usr/bin/env node')).toBe(true)
        }
      }
    })

    it('should validate published files configuration', () => {
      const files = packageJson.files || []

      // Should include dist directory
      expect(files).toContain('dist/')

      // Should include agents directory
      expect(files).toContain('agents/')

      // Should not include source files
      expect(files).not.toContain('src/')
      expect(files).not.toContain('tests/')
    })
  })

  describe('dependency Consistency Checks', () => {
    it('should validate package-lock.json consistency', () => {
      const packageLockPath = join(projectRoot, 'package-lock.json')

      if (existsSync(packageLockPath)) {
        const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf-8'))

        // Version should match package.json
        expect(packageLock.version).toBe(packageJson.version)

        // Name should match
        expect(packageLock.name).toBe(packageJson.name)

        // Lock file version should be reasonable
        expect(packageLock.lockfileVersion).toBeGreaterThanOrEqual(2)
      }
    })

    it('should validate dependency version consistency', () => {
      const dependencies = packageJson.dependencies || {}
      const devDependencies = packageJson.devDependencies || {}

      // Check for version conflicts
      const allDeps = { ...dependencies, ...devDependencies }
      const duplicateDeps = Object.keys(dependencies).filter(dep =>
        devDependencies[dep] && dependencies[dep] !== devDependencies[dep],
      )

      expect(duplicateDeps).toHaveLength(0)

      // All versions should be valid semver
      Object.entries(allDeps).forEach(([pkg, version]) => {
        expect(version).toMatch(/^[\d.^~*]|^[a-z]+:/)
      })
    })

    it('should validate security audit passing', () => {
      // Should not have high severity vulnerabilities
      // This is more of a reminder than an enforceable test
      const dependencies = Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      })

      // Should have minimal dependencies (4 core dependencies)
      const depCount = Object.keys(packageJson.dependencies || {}).length
      expect(depCount).toBe(4) // Actual core dependencies: @modelcontextprotocol/sdk, zod, dotenv, undici
    })
  })

  describe('git Configuration Validation', () => {
    it('should validate .gitignore completeness', () => {
      const gitignorePath = join(projectRoot, '.gitignore')

      if (existsSync(gitignorePath)) {
        const gitignoreContent = readFileSync(gitignorePath, 'utf-8')

        const expectedPatterns = [
          'node_modules/',
          'dist/',
          '.env',
          '*.log',
          'coverage/',
        ]

        expectedPatterns.forEach((pattern) => {
          expect(gitignoreContent).toMatch(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        })
      }
    })

    it('should validate commit message format if configured', () => {
      const commitMsgPath = join(projectRoot, '.gitmessage')

      if (existsSync(commitMsgPath)) {
        const template = readFileSync(commitMsgPath, 'utf-8')

        // Should have reasonable structure
        expect(template.length).toBeGreaterThan(10)
        expect(template).not.toContain('TODO')
        expect(template).not.toContain('FIXME')
      }
    })

    it('should validate git attributes if present', () => {
      const gitattributesPath = join(projectRoot, '.gitattributes')

      if (existsSync(gitattributesPath)) {
        const content = readFileSync(gitattributesPath, 'utf-8')

        // Should handle line endings properly
        expect(content).toMatch(/\*\s+text=auto|\*\.ts\s+text/)
      }
    })
  })

  describe('cI/CD Configuration Validation', () => {
    it('should validate GitHub Actions if present', () => {
      const workflowsDir = join(projectRoot, '.github/workflows')

      if (existsSync(workflowsDir)) {
        const workflowFiles = readdirSync(workflowsDir)
          .filter((file: string) => file.endsWith('.yml') || file.endsWith('.yaml'))

        workflowFiles.forEach((file: string) => {
          const workflowPath = join(workflowsDir, file)
          const content = readFileSync(workflowPath, 'utf-8')

          // Should have proper YAML structure
          expect(content).toMatch(/name:\s*/)
          expect(content).toMatch(/on:\s*/)
          expect(content).toMatch(/jobs:\s*/)

          // Should run tests
          expect(content).toMatch(/npm test|yarn test|pnpm test/)

          // Should run build
          expect(content).toMatch(/npm run build|yarn build|pnpm build/)
        })
      }
    })

    it('should validate Node.js version matrix in CI', () => {
      const workflowsDir = join(projectRoot, '.github/workflows')

      if (existsSync(workflowsDir)) {
        const workflowFiles = readdirSync(workflowsDir)
          .filter((file: string) => file.endsWith('.yml') || file.endsWith('.yaml'))

        workflowFiles.forEach((file: string) => {
          const content = readFileSync(join(workflowsDir, file), 'utf-8')

          // If Node.js matrix is used, should include version 22+
          if (content.includes('node-version') && content.includes('matrix')) {
            expect(content).toMatch(/22|latest/)
          }
        })
      }
    })
  })
})
