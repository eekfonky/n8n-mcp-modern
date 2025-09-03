#!/usr/bin/env node
/**
 * Update Node Count References Script
 *
 * Automatically updates hardcoded node count references in documentation
 * with dynamic values based on actual discovery results.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { logger } from '../server/logger.js'
import { getDynamicNodeCountString, getFormattedNodeCount } from '../utils/dynamic-node-count.js'

interface FileUpdateConfig {
  path: string
  description: string
  patterns: Array<{
    search: RegExp
    replace: (nodeCount: string) => string
  }>
}

const FILES_TO_UPDATE: FileUpdateConfig[] = [
  {
    path: 'README.md',
    description: 'Main README file',
    patterns: [
      {
        search: /15-agent hierarchical architecture optimized for \d+\+ n8n nodes/g,
        replace: count => `15-agent hierarchical architecture optimized for ${count} n8n nodes`,
      },
      {
        search: /Discovers new n8n nodes beyond the \d+\+ static node library/g,
        replace: count => `Discovers new n8n nodes beyond the ${count} static node library`,
      },
    ],
  },
  {
    path: 'CLAUDE.md',
    description: 'Claude Code documentation',
    patterns: [
      {
        search: /15-agent hierarchical system optimized for \d+\+ n8n nodes/g,
        replace: count => `15-agent hierarchical system optimized for ${count} n8n nodes`,
      },
      {
        search: /Input validation for all \d+ MCP tools optimized for \d+\+ n8n nodes/g,
        replace: count => `Input validation for all 92 MCP tools optimized for ${count} n8n nodes`,
      },
    ],
  },
  {
    path: 'agents/README.md',
    description: 'Agents directory README',
    patterns: [
      {
        search: /expert guidance across \d+\+ n8n nodes/g,
        replace: count => `expert guidance across ${count} n8n nodes`,
      },
      {
        search: /Find nodes across \d+\+ available nodes/g,
        replace: count => `Find nodes across ${count} available nodes`,
      },
    ],
  },
  {
    path: 'src/agents/agent-definitions.ts',
    description: 'TypeScript agent definitions',
    patterns: [
      {
        search: /Optimized for \d+\+ node ecosystem with model tiers and collaboration patterns/g,
        replace: count => `Optimized for ${count} node ecosystem with model tiers and collaboration patterns`,
      },
      {
        search: /Complete 15-agent hierarchy optimized for \d+\+ node ecosystem with model tiers/g,
        replace: count => `Complete 15-agent hierarchy optimized for ${count} node ecosystem with model tiers`,
      },
    ],
  },
  {
    path: 'src/agents/agent-routing.ts',
    description: 'Agent routing system',
    patterns: [
      {
        search: /Optimized for \d+\+ node ecosystem with enhanced TTL and cache size/g,
        replace: count => `Optimized for ${count} node ecosystem with enhanced TTL and cache size`,
      },
      {
        search: /Increased for \d+\+ nodes/g,
        replace: count => `Increased for ${count} nodes`,
      },
    ],
  },
]

/**
 * Update a single file with dynamic node count references
 */
async function updateFile(config: FileUpdateConfig, nodeCountString: string): Promise<boolean> {
  const filePath = resolve(process.cwd(), config.path)

  try {
    const content = await readFile(filePath, 'utf-8')
    let updatedContent = content
    let hasChanges = false

    // Apply all patterns
    for (const pattern of config.patterns) {
      const newContent = updatedContent.replace(pattern.search, pattern.replace(nodeCountString))
      if (newContent !== updatedContent) {
        hasChanges = true
        updatedContent = newContent
      }
    }

    if (hasChanges) {
      await writeFile(filePath, updatedContent, 'utf-8')
      logger.info(`Updated ${config.description} with dynamic node count: ${nodeCountString}`)
      return true
    }
    else {
      logger.debug(`No changes needed for ${config.description}`)
      return false
    }
  }
  catch (error) {
    logger.error(`Failed to update ${config.description}`, { error, path: config.path })
    return false
  }
}

/**
 * Update all documentation files with current node count
 */
async function updateAllNodeCountReferences(): Promise<void> {
  try {
    logger.info('Starting dynamic node count reference update...')

    // Get current node count
    const nodeCountString = await getDynamicNodeCountString()
    const formattedCount = await getFormattedNodeCount()

    logger.info('Current node statistics', {
      nodeCountString,
      formattedCount,
    })

    // Update all files
    const updatePromises = FILES_TO_UPDATE.map(config => updateFile(config, nodeCountString))
    const results = await Promise.all(updatePromises)

    const updatedCount = results.filter(result => result).length
    const totalCount = FILES_TO_UPDATE.length

    logger.info(`Node count reference update completed`, {
      updated: updatedCount,
      total: totalCount,
      nodeCount: nodeCountString,
    })

    if (updatedCount > 0) {
      logger.info('✅ Documentation successfully updated with dynamic node counts')
      logger.info('💡 Run this script after discovery updates to keep references current')
    }
    else {
      logger.info('✅ All documentation already up-to-date')
    }
  }
  catch (error) {
    logger.error('Failed to update node count references', { error })
    process.exit(1)
  }
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.error(`
Update Node Count References Script

Usage: node update-node-count-references.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be updated without making changes

This script automatically updates hardcoded node count references in documentation
files with dynamic values based on current discovery results.

Files updated:
${FILES_TO_UPDATE.map(config => `  - ${config.path} (${config.description})`).join('\n')}
    `)
    return
  }

  if (args.includes('--dry-run')) {
    logger.info('Dry run mode - showing what would be updated...')

    const nodeCountString = await getDynamicNodeCountString()
    const formattedCount = await getFormattedNodeCount()

    console.error(`\nWould update references to: ${nodeCountString}`)
    console.error(`Current statistics: ${formattedCount}\n`)

    FILES_TO_UPDATE.forEach((config) => {
      console.error(`Would update: ${config.path} (${config.description})`)
      config.patterns.forEach((pattern, index) => {
        console.error(`  Pattern ${index + 1}: ${pattern.search}`)
      })
    })

    return
  }

  await updateAllNodeCountReferences()
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Script failed', { error })
    process.exit(1)
  })
}

// Export for programmatic use
export { updateAllNodeCountReferences, updateFile }
