#!/usr/bin/env node
/**
 * Script to Fix Remaining 'any' Type Usage
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
  console.log('🔧 Fixing remaining any types...\n')

  // Fix dynamic-tools.ts
  await fixFile('src/tools/dynamic-tools.ts', [
    ['nodes: any[]', 'nodes: Array<Record<string, unknown>>'],
    ['connections?: {}', 'connections?: Record<string, unknown>'],
  ])

  // Fix schemaParser.ts - make parameters more permissive
  await fixFile('src/discovery/schemaParser.ts', [
    ['(properties: Array<Record<string, unknown>>)', '(properties: unknown)'],
    ['(credentials: Array<Record<string, unknown>>)', '(credentials: unknown)'],
    ['(schema: Record<string, unknown>)', '(schema: unknown)'],
  ])

  // Fix nodeDiscovery.ts
  await fixFile('src/discovery/nodeDiscovery.ts', [
    ['nodes: Array<Record<string, unknown>>', 'nodes: unknown[]'],
    ['nodeData: Record<string, unknown>', 'nodeData: Record<string, unknown>'],
  ])

  console.log('\n🎉 Any type fixes complete!')
}

main().catch(console.error)
