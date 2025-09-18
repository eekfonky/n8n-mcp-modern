#!/usr/bin/env node
/**
 * Script to Fix Remaining Type Issues
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function fixFile(filePath, replacements) {
  try {
    const fullPath = path.join(__dirname, '..', filePath)
    let content = await fs.readFile(fullPath, 'utf8')
    let modified = false

    for (const [find, replace] of replacements) {
      if (content.includes(find)) {
        content = content.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace)
        modified = true
      }
    }

    if (modified) {
      await fs.writeFile(fullPath, content, 'utf8')
      console.log(`✅ Fixed ${filePath}`)
    }
  }
  catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message)
  }
}

async function main() {
  console.log('🔧 Fixing remaining type issues...\n')

  // Fix session-manager.ts
  await fixFile('src/agents/session-manager.ts', [
    ['cleanupTimer?: string | undefined | undefined', 'cleanupTimer: string | undefined = undefined'],
    ['.unref()', ''],
  ])

  // Fix health-monitor.ts
  await fixFile('src/utils/health-monitor.ts', [
    ['private monitoringTimer?: Timeout', 'private monitoringTimer: string | undefined = undefined'],
    ['clearInterval(this.monitoringTimer)', 'managedClearTimer(this.monitoringTimer)'],
  ])

  // Fix optimization-integration.ts
  await fixFile('src/utils/optimization-integration.ts', [
    ['private statusCheckInterval?: Timeout', 'private statusCheckInterval: string | undefined = undefined'],
    ['clearInterval(this.statusCheckInterval)', 'managedClearTimer(this.statusCheckInterval)'],
  ])

  // Fix process-manager.ts
  await fixFile('src/utils/process-manager.ts', [
    ['private monitoringInterval?: NodeJS.Timeout', 'private monitoringInterval: string | undefined = undefined'],
    ['clearInterval(this.monitoringInterval)', 'managedClearTimer(this.monitoringInterval)'],
  ])

  // Fix memory-monitor.ts Promise.resolve issue
  await fixFile('src/utils/memory-monitor.ts', [
    ['await new Promise(resolve => managedSetTimeout(resolve, 200, \'memory-monitor:timer\'))', 'await new Promise<void>(resolve => managedSetTimeout(() => resolve(), 200, \'memory-monitor:timer\'))'],
  ])

  console.log('\n🎉 Type fixes complete!')
}

main().catch(console.error)
