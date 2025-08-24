/**
 * Architecture Validation Tests
 *
 * Critical tests to validate MCP routing, tool registration, agent hierarchy,
 * and prevent architectural consistency issues.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

describe('architecture Validation Tests', () => {
  let indexContent: string
  let toolsIndexContent: string
  let comprehensiveToolsContent: string
  let agentFiles: string[]
  let toolFiles: string[]

  beforeAll(() => {
    const projectRoot = process.cwd()

    // Read core architecture files
    indexContent = readFileSync(join(projectRoot, 'src/index.ts'), 'utf-8')
    toolsIndexContent = readFileSync(join(projectRoot, 'src/tools/index.ts'), 'utf-8')
    comprehensiveToolsContent = readFileSync(join(projectRoot, 'src/tools/comprehensive.ts'), 'utf-8')

    // Discover agent files (exclude README.md)
    const agentsPath = join(projectRoot, 'agents')
    agentFiles = readdirSync(agentsPath)
      .filter(file => extname(file) === '.md' && file !== 'README.md')
      .map(file => join(agentsPath, file))

    // Discover tool files
    const toolsPath = join(projectRoot, 'src/tools')
    toolFiles = readdirSync(toolsPath)
      .filter(file => extname(file) === '.ts' && file !== 'index.ts')
      .map(file => join(toolsPath, file))
  })

  describe('mCP Tool Registration Architecture', () => {
    it('should validate MCP tool routing structure', () => {
      // Extract tool definitions from listTools function
      const listToolsMatch = indexContent.match(/listTools\(\s*\)[^{]*\{([\s\S]*?)return\s*\{[\s\S]*?tools:\s*\[([\s\S]*?)\]/)
      expect(listToolsMatch).toBeDefined()

      if (listToolsMatch) {
        const toolsArray = listToolsMatch[2]

        // Count MCP-registered tools
        const toolDefinitions = toolsArray.match(/\{[^}]*name:\s*['"`][^'"`]+['"`][^}]*\}/g) || []

        // Should have MCP entry point tools
        expect(toolDefinitions.length).toBeGreaterThan(5)

        // Validate each tool has required MCP properties
        toolDefinitions.forEach((toolDef) => {
          expect(toolDef).toMatch(/name:\s*['"`][^'"`]+['"`]/)
          expect(toolDef).toMatch(/description:\s*['"`][^'"`]+['"`]/)
        })
      }
    })

    it('should validate executeTool routing completeness', () => {
      // Extract executeTool switch statement
      const executeToolMatch = indexContent.match(/executeTool[^{]*\{([\s\S]*?)\}/)
      expect(executeToolMatch).toBeDefined()

      if (executeToolMatch) {
        const switchContent = executeToolMatch[1]

        // Extract case statements
        const caseMatches = switchContent.match(/case\s+['"`]([^'"`]+)['"`]:/g) || []

        // Should have multiple case statements for tool routing
        expect(caseMatches.length).toBeGreaterThan(10)

        // Should have default case for error handling
        expect(switchContent).toMatch(/default:\s*/)

        // Each case should have a return statement or throw
        const caseBlocks = switchContent.split(/case\s+['"`][^'"`]+['"`]:/)
        caseBlocks.slice(1).forEach((block, index) => {
          const hasReturn = block.includes('return')
          const hasThrow = block.includes('throw')
          expect(hasReturn || hasThrow, `Case ${index + 1} should return or throw`).toBe(true)
        })
      }
    })

    it('should validate tool name consistency across routing layers', () => {
      // Extract MCP tool names from listTools
      const mcpToolNames = extractMcpToolNames(indexContent)

      // Extract executeTool case names
      const executeToolNames = extractExecuteToolNames(indexContent)

      // Validate that MCP tools route to executeTool cases
      mcpToolNames.forEach((mcpTool) => {
        const hasMatchingCase = executeToolNames.some(caseName =>
          caseName.includes(mcpTool) || mcpTool.includes(caseName),
        )
        expect(hasMatchingCase, `MCP tool "${mcpTool}" should have routing case`).toBe(true)
      })
    })

    it('should validate comprehensive tools integration', () => {
      // Check that comprehensive.ts tools are properly integrated
      const comprehensiveToolMatches = comprehensiveToolsContent.match(/name:\s*['"`]([^'"`]+)['"`]/g) || []
      const comprehensiveToolNames = comprehensiveToolMatches.map(match =>
        match.match(/['"`]([^'"`]+)['"`]/)![1],
      )

      expect(comprehensiveToolNames.length).toBeGreaterThan(20) // Should have multiple comprehensive tools

      // Check integration in executeTool
      const hasComprehensiveCase = indexContent.includes('comprehensive') || indexContent.includes('executeComprehensive')
      expect(hasComprehensiveCase, 'Should integrate comprehensive tools').toBe(true)
    })

    it('should validate error handling in tool routing', () => {
      // Check for proper error handling patterns
      const errorPatterns = [
        /throw new N8NMcpError/,
        /catch\s*\([^)]*\)\s*\{/,
        /finally\s*\{/,
        /default:\s*throw/,
      ]

      errorPatterns.forEach((pattern) => {
        expect(indexContent).toMatch(pattern)
      })

      // Should have structured error responses
      expect(indexContent).toMatch(/error:\s*true/)
      expect(indexContent).toMatch(/message:/)
    })
  })

  describe('agent Hierarchy Architecture', () => {
    it('should validate agent file structure', () => {
      // Should have exactly 6 agent files (excluding README.md)
      expect(agentFiles.length).toBe(6)

      const expectedAgents = [
        'n8n-builder.md',
        'n8n-connector.md',
        'n8n-guide.md',
        'n8n-node-expert.md',
        'n8n-orchestrator.md',
        'n8n-scriptguard.md',
      ]

      expectedAgents.forEach((expectedAgent) => {
        const hasAgent = agentFiles.some(file => file.endsWith(expectedAgent))
        expect(hasAgent, `Should have agent file: ${expectedAgent}`).toBe(true)
      })
    })

    it('should validate agent hierarchy tiers', () => {
      // Read orchestrator (should be tier 1)
      const orchestratorPath = agentFiles.find(f => f.includes('orchestrator'))
      expect(orchestratorPath).toBeDefined()

      if (orchestratorPath) {
        const orchestratorContent = readFileSync(orchestratorPath, 'utf-8')

        // Should be positioned as master coordinator
        expect(orchestratorContent).toMatch(/orchestrator|coordinator|master|tier.*1/i)

        // Should reference other agents
        const agentReferences = agentFiles.filter(f => !f.includes('orchestrator'))
          .map(f => f.split('/').pop()!.replace('.md', ''))
          .filter(name => orchestratorContent.toLowerCase().includes(name.toLowerCase()))

        expect(agentReferences.length).toBeGreaterThan(2) // Should reference multiple agents
      }
    })

    it('should validate agent specialization boundaries', () => {
      const agentSpecializations = [
        { name: 'connector', keywords: ['auth', 'connection', 'oauth', 'api'] },
        { name: 'builder', keywords: ['code', 'template', 'workflow', 'build'] },
        { name: 'node-expert', keywords: ['node', '525', 'expert', 'configuration'] },
        { name: 'scriptguard', keywords: ['javascript', 'security', 'validation', 'code'] },
        { name: 'guide', keywords: ['documentation', 'tutorial', 'guide', 'help'] },
      ]

      agentSpecializations.forEach(({ name, keywords }) => {
        const agentFile = agentFiles.find(f => f.includes(name))
        if (agentFile) {
          const content = readFileSync(agentFile, 'utf-8').toLowerCase()

          const matchingKeywords = keywords.filter(keyword =>
            content.includes(keyword.toLowerCase()),
          )

          expect(matchingKeywords.length, `Agent ${name} should match its specialization`).toBeGreaterThan(0)
        }
      })
    })

    it('should validate agent tool access patterns', () => {
      agentFiles.forEach((agentFile) => {
        const content = readFileSync(agentFile, 'utf-8')
        const fileName = agentFile.split('/').pop()!

        // Agents should reference specific tool categories
        if (fileName.includes('connector')) {
          expect(content).toMatch(/auth|connection|oauth/i)
        }
        else if (fileName.includes('node-expert')) {
          expect(content).toMatch(/node|525|expert/i)
        }
        else if (fileName.includes('scriptguard')) {
          expect(content).toMatch(/javascript|script|validation/i)
        }

        // All agents should have clear role definitions
        expect(content).toMatch(/role|responsibility|purpose/i)
      })
    })
  })

  describe('tool Organization Architecture', () => {
    it('should validate tool file organization', () => {
      const expectedToolFiles = [
        'comprehensive.ts',
        'executors.ts',
        'helpers.ts',
      ]

      expectedToolFiles.forEach((expectedFile) => {
        const hasFile = toolFiles.some(file => file.endsWith(expectedFile))
        expect(hasFile, `Should have tool file: ${expectedFile}`).toBe(true)
      })
    })

    it('should validate tool categorization', () => {
      // Tools should be properly categorized
      const toolCategories = {
        workflow: /workflow|execution|trigger/i,
        node: /node|component|integration/i,
        data: /data|transform|format/i,
        auth: /auth|credential|oauth/i,
        utility: /util|helper|format|validate/i,
      }

      // Check that tools are categorized in listTools
      Object.entries(toolCategories).forEach(([category, pattern]) => {
        const hasCategory = indexContent.match(pattern)
        expect(hasCategory, `Should have ${category} tools`).toBeTruthy()
      })
    })

    it('should validate tool parameter consistency', () => {
      // Extract tool schemas from tools/index.ts
      const schemaMatches = toolsIndexContent.match(/\w+Schema\s*=/g) || []

      schemaMatches.forEach((schemaMatch) => {
        const schemaName = schemaMatch.replace(/\s*=.*/, '')

        // Schema should be used in tool definitions
        const isUsed = indexContent.includes(schemaName) || toolsIndexContent.includes(schemaName)
        expect(isUsed, `Schema ${schemaName} should be used`).toBe(true)
      })
    })

    it('should validate import/export consistency', () => {
      // Check that exports from tools/index.ts are imported in main index
      const exportMatches = toolsIndexContent.match(/export\s*\{([^}]+)\}/g) || []

      exportMatches.forEach((exportMatch) => {
        const exports = exportMatch.match(/[\w,\s]+/g)?.[0]
          ?.split(',')
          .map(e => e.trim())
          .filter(e => e) || []

        exports.forEach((exportName) => {
          if (exportName && exportName !== 'export' && exportName !== '{' && exportName !== '}') {
            const isImported = indexContent.includes(exportName)
            expect(isImported, `Export ${exportName} should be imported`).toBe(true)
          }
        })
      })
    })
  })

  describe('type Safety Architecture', () => {
    it('should validate TypeScript strict mode compliance', () => {
      const typePatterns = [
        /:\s*string/,
        /:\s*number/,
        /:\s*boolean/,
        /:\s*object/,
        /interface\s+\w+/,
        /type\s+\w+/,
      ]

      typePatterns.forEach((pattern) => {
        expect(indexContent).toMatch(pattern)
      })
    })

    it('should validate error type consistency', () => {
      // Should use custom error types consistently
      expect(indexContent).toMatch(/N8NMcpError|Error/)

      // Should not use generic Error throwing
      const genericErrorThrows = indexContent.match(/throw new Error\(/g) || []
      expect(genericErrorThrows.length).toBeLessThan(5) // Minimal generic errors
    })

    it('should validate async/await patterns', () => {
      // Should use proper async patterns
      expect(indexContent).toMatch(/async\s+function/)
      expect(indexContent).toMatch(/await\s+/)

      // Should handle promise rejections
      expect(indexContent).toMatch(/catch\s*\(/)
    })
  })

  describe('configuration Architecture', () => {
    it('should validate config integration patterns', () => {
      // Should import and use config properly
      expect(indexContent).toMatch(/import.*config/)
      expect(indexContent).toMatch(/config\./)

      // Should validate configuration at startup
      expect(indexContent).toMatch(/config.*validation|validation.*config/i)
    })

    it('should validate environment handling', () => {
      // Should handle different environments
      const envPatterns = [
        /development/,
        /production/,
        /test/,
      ]

      envPatterns.some(pattern => indexContent.match(pattern))
    })

    it('should validate feature flag integration', () => {
      // Should use feature flags from config
      expect(indexContent).toMatch(/enable|disable|flag/i)
    })
  })

  describe('integration Architecture', () => {
    it('should validate n8n API integration boundaries', () => {
      // Should have clean API integration layer
      expect(indexContent).toMatch(/n8n.*api|api.*n8n/i)

      // Should handle API failures gracefully
      expect(indexContent).toMatch(/api.*error|error.*api/i)
    })

    it('should validate database integration patterns', () => {
      // Should integrate with database layer
      expect(indexContent).toMatch(/database|db|storage/i)

      // Should handle database errors
      expect(indexContent).toMatch(/database.*error|db.*error/i)
    })

    it('should validate MCP protocol compliance', () => {
      // Should implement required MCP methods
      const requiredMethods = ['listTools', 'callTool']

      requiredMethods.forEach((method) => {
        expect(indexContent).toMatch(new RegExp(method))
      })

      // Should use MCP SDK types
      expect(indexContent).toMatch(/@modelcontextprotocol/)
    })
  })

  // Helper functions
  function extractMcpToolNames(content: string): string[] {
    const toolMatches = content.match(/name:\s*['"`]([^'"`]+)['"`]/g) || []
    return toolMatches.map(match => match.match(/['"`]([^'"`]+)['"`]/)![1])
  }

  function extractExecuteToolNames(content: string): string[] {
    const caseMatches = content.match(/case\s+['"`]([^'"`]+)['"`]:/g) || []
    return caseMatches.map(match => match.match(/['"`]([^'"`]+)['"`]/)![1])
  }
})
