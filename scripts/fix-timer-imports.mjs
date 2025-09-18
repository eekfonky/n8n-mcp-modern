#!/usr/bin/env node
/**
 * Script to Fix Timer Import Paths and Type Issues
 *
 * Fixes the import paths and type mismatches from the automated timer conversion
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Files that need import path fixes
const filesToFix = [
  'src/utils/circuit-breaker.ts',
  'src/utils/health-monitor.ts',
  'src/utils/memory-manager.ts',
  'src/utils/memory-monitor.ts',
  'src/utils/memory-profiler.ts',
  'src/utils/optimization-integration.ts',
  'src/utils/process-manager.ts',
  'src/utils/system-monitor.ts',
]

/**
 * Fix import paths and type issues in a file
 */
async function fixFile(filePath) {
  try {
    const fullPath = path.join(__dirname, '..', filePath)
    let content = await fs.readFile(fullPath, 'utf8')
    let modified = false

    // Fix import path
    if (content.includes('from \'timer-manager.js\'')) {
      content = content.replace('from \'timer-manager.js\'', 'from \'./timer-manager.js\'')
      modified = true
    }

    // Fix specific type issues
    if (filePath.includes('memory-monitor.ts')) {
      // Fix gcHistory.push call
      content = content.replace(
        'timestamp: new Date(now), memoryBefore,\n        memoryAfter\n      }, \'memory-monitor:timer\')',
        'timestamp: new Date(now),\n        memoryBefore,\n        memoryAfter\n      })',
      )
      modified = true
    }

    if (filePath.includes('memory-profiler.ts')) {
      // Fix toFixed call with extra argument
      content = content.replace(
        '.toFixed(2, \'memory-profiler:timer\')',
        '.toFixed(2)',
      )
      modified = true
    }

    if (filePath.includes('process-manager.ts')) {
      // Fix function calls with wrong number of arguments
      content = content.replace(
        'this.killProcess(processId, \'SIGTERM\', \'process-manager:timer\')',
        'this.killProcess(processId, \'SIGTERM\')',
      )
      modified = true
    }

    if (modified) {
      await fs.writeFile(fullPath, content, 'utf8')
      console.log(`✅ Fixed ${filePath}`)
    }
    else {
      console.log(`⚪ No fixes needed for ${filePath}`)
    }
  }
  catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message)
  }
}

/**
 * Fix specific files with complex type issues
 */
async function fixSpecificTypeIssues() {
  // Fix agents/session-manager.ts
  try {
    const sessionManagerPath = path.join(__dirname, '..', 'src/agents/session-manager.ts')
    let content = await fs.readFile(sessionManagerPath, 'utf8')

    // Fix timeout type declarations
    content = content.replace(/timeout: Timeout/g, 'timeout: string | undefined')
    content = content.replace(/NodeJS\.Timeout/g, 'string | undefined')

    await fs.writeFile(sessionManagerPath, content, 'utf8')
    console.log('✅ Fixed src/agents/session-manager.ts')
  }
  catch (error) {
    console.error('❌ Error fixing session-manager.ts:', error.message)
  }

  // Fix mcp/resources.ts
  try {
    const resourcesPath = path.join(__dirname, '..', 'src/mcp/resources.ts')
    let content = await fs.readFile(resourcesPath, 'utf8')

    // Fix timeout type declarations
    content = content.replace(/timeout: Timeout/g, 'timeout: string | undefined')
    content = content.replace(/NodeJS\.Timeout/g, 'string | undefined')

    await fs.writeFile(resourcesPath, content, 'utf8')
    console.log('✅ Fixed src/mcp/resources.ts')
  }
  catch (error) {
    console.error('❌ Error fixing resources.ts:', error.message)
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Fixing timer import paths and type issues...\n')

  // Fix import paths
  for (const filePath of filesToFix) {
    await fixFile(filePath)
  }

  // Fix specific type issues
  await fixSpecificTypeIssues()

  console.log('\n🎉 Timer import fixes complete!')
  console.log('Run `npm run typecheck` to verify fixes')
}

main().catch(console.error)
