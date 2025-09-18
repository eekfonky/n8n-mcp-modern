#!/usr/bin/env node
/**
 * Script to Convert setTimeout/setInterval to Managed Timers
 *
 * This script systematically converts all setTimeout and setInterval usage
 * to use the centralized timer management system to prevent resource leaks.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, '..', 'src')

// Files to process (excluding test files which are less critical)
const filesToProcess = [
  'src/utils/system-monitor.ts',
  'src/utils/memory-monitor.ts',
  'src/utils/optimization-integration.ts',
  'src/utils/circuit-breaker.ts',
  'src/utils/health-monitor.ts',
  'src/utils/process-manager.ts',
  'src/mcp/resources.ts',
  'src/tools/real-time-schema-generator.ts',
  'src/discovery/comprehensive-discovery.ts',
  'src/utils/memory-profiler.ts',
  'src/types/api-validation.ts',
  'src/utils/memory-manager.ts',
  'src/tools/memory-optimization-tool.ts',
  'src/server/cold-start-optimizer.ts',
  'src/agents/session-manager.ts',
]

/**
 * Add managed timer imports to a file if not already present
 */
async function addManagedTimerImports(filePath, content) {
  const relativePath = path.relative(path.dirname(filePath), path.join(srcDir, 'utils', 'timer-manager.js'))

  // Check if imports already exist
  if (content.includes('managedSetTimeout') || content.includes('managedSetInterval')) {
    return content
  }

  // Find the last import statement
  const lines = content.split('\n')
  let lastImportIndex = -1

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') && !lines[i].includes('type')) {
      lastImportIndex = i
    }
  }

  if (lastImportIndex >= 0) {
    // Add import after the last import statement
    const importStatement = `import { managedSetTimeout, managedSetInterval, managedClearTimer } from '${relativePath}'`
    lines.splice(lastImportIndex + 1, 0, importStatement)
    return lines.join('\n')
  }

  return content
}

/**
 * Convert timer usage in file content
 */
function convertTimerUsage(content, filename) {
  let modified = content
  let changesMade = false

  // Track timer variable declarations to fix type annotations
  const timerVars = new Set()

  // Pattern to find timer variable declarations
  const timerVarPattern = /(\w+):\s*NodeJS\.Timeout\s*\|\s*undefined/g
  let match
  while ((match = timerVarPattern.exec(content)) !== null) {
    timerVars.add(match[1])
  }

  // Convert timer variable types
  for (const timerVar of timerVars) {
    const oldPattern = new RegExp(`${timerVar}:\\s*NodeJS\\.Timeout\\s*\\|\\s*undefined`, 'g')
    const newType = `${timerVar}: string | undefined`
    modified = modified.replace(oldPattern, newType)
    changesMade = true
  }

  // Convert setTimeout calls
  const setTimeoutPattern = /setTimeout\s*\(\s*([^,]+),\s*([^)]+)\)/g
  modified = modified.replace(setTimeoutPattern, (fullMatch, callback, delay) => {
    changesMade = true
    const cleanFilename = path.basename(filename, '.ts')
    const source = `'${cleanFilename}:timer'`
    return `managedSetTimeout(${callback}, ${delay}, ${source})`
  })

  // Convert setInterval calls
  const setIntervalPattern = /setInterval\s*\(\s*([^,]+),\s*([^)]+)\)/g
  modified = modified.replace(setIntervalPattern, (fullMatch, callback, delay) => {
    changesMade = true
    const cleanFilename = path.basename(filename, '.ts')
    const source = `'${cleanFilename}:interval'`
    return `managedSetInterval(${callback}, ${delay}, ${source})`
  })

  // Convert clearTimeout/clearInterval calls
  const clearPattern = /clear(Timeout|Interval)\s*\(\s*([^)]+)\)/g
  modified = modified.replace(clearPattern, (fullMatch, type, timerId) => {
    changesMade = true
    return `managedClearTimer(${timerId})`
  })

  return { content: modified, changed: changesMade }
}

/**
 * Process a single file
 */
async function processFile(filePath) {
  try {
    const fullPath = path.join(__dirname, '..', filePath)
    const content = await fs.readFile(fullPath, 'utf8')

    // Check if file has timer usage
    if (!content.includes('setTimeout') && !content.includes('setInterval') && !content.includes('clearTimeout') && !content.includes('clearInterval')) {
      console.log(`⏭️  Skipping ${filePath} (no timer usage)`)
      return
    }

    console.log(`🔄 Processing ${filePath}...`)

    // Add imports
    const modifiedContent = await addManagedTimerImports(fullPath, content)

    // Convert timer usage
    const result = convertTimerUsage(modifiedContent, filePath)

    if (result.changed || modifiedContent !== content) {
      await fs.writeFile(fullPath, result.content, 'utf8')
      console.log(`✅ Updated ${filePath}`)
    }
    else {
      console.log(`⚪ No changes needed for ${filePath}`)
    }
  }
  catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message)
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Converting timer usage to managed timers...\n')

  for (const filePath of filesToProcess) {
    await processFile(filePath)
  }

  console.log('\n🎉 Timer conversion complete!')
  console.log('\n📋 Next steps:')
  console.log('1. Run `npm run typecheck` to verify TypeScript compilation')
  console.log('2. Run `npm test` to ensure tests pass')
  console.log('3. Review changes and test functionality')
}

main().catch(console.error)
