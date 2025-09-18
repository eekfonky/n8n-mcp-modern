/**
 * Static Node List Manager
 *
 * Manages updates to the static node list in all-n8n-nodes.ts
 * Provides backup, versioning, and safe update capabilities
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { logger } from '../server/logger.js'
import { ALL_N8N_NODES } from './all-n8n-nodes.js'

export interface NodeListUpdate {
  added: string[]
  removed: string[]
  timestamp: Date
  discoveryMethod: string
}

export class StaticNodeManager {
  private static readonly NODE_FILE_PATH = join(process.cwd(), 'src/discovery/all-n8n-nodes.ts')
  private static readonly BACKUP_DIR = join(process.cwd(), 'data/node-list-backups')

  constructor() {
    this.ensureBackupDirectory()
  }

  /**
   * Add newly discovered nodes to the static list
   */
  async addDiscoveredNodes(
    newNodes: string[],
    discoveryMethod: string = 'enhanced-discovery',
  ): Promise<NodeListUpdate> {
    const currentNodes = new Set(ALL_N8N_NODES)
    const nodesToAdd = newNodes.filter((node) => {
      // Remove prefixes to get base node name
      const baseName = node.replace(/^n8n-nodes-base\./, '').replace(/^@n8n\/n8n-nodes-langchain\./, '')
      return !currentNodes.has(baseName)
    })

    if (nodesToAdd.length === 0) {
      logger.info('No new nodes to add to static list')
      return {
        added: [],
        removed: [],
        timestamp: new Date(),
        discoveryMethod,
      }
    }

    // Create backup before modifying
    await this.createBackup(discoveryMethod)

    // Read current file content
    const currentContent = await fs.readFile(StaticNodeManager.NODE_FILE_PATH, 'utf-8')

    // Parse and categorize new nodes
    const categorizedNodes = this.categorizeNewNodes(nodesToAdd)

    // Generate updated content
    const updatedContent = this.generateUpdatedContent(currentContent, categorizedNodes, discoveryMethod)

    // Write updated content
    await fs.writeFile(StaticNodeManager.NODE_FILE_PATH, updatedContent, 'utf-8')

    const update: NodeListUpdate = {
      added: nodesToAdd,
      removed: [],
      timestamp: new Date(),
      discoveryMethod,
    }

    logger.info(`✅ Added ${nodesToAdd.length} new nodes to static list:`, nodesToAdd)

    // Log the update
    await this.logUpdate(update)

    return update
  }

  /**
   * Create a backup of the current node list
   */
  async createBackup(reason: string = 'manual-backup'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFileName = `all-n8n-nodes-${timestamp}-${reason}.ts`
    const backupPath = join(StaticNodeManager.BACKUP_DIR, backupFileName)

    const currentContent = await fs.readFile(StaticNodeManager.NODE_FILE_PATH, 'utf-8')
    await fs.writeFile(backupPath, currentContent, 'utf-8')

    logger.info(`📁 Created backup: ${backupFileName}`)
    return backupPath
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<Array<{ filename: string, path: string, created: Date }>> {
    try {
      const files = await fs.readdir(StaticNodeManager.BACKUP_DIR)
      const backups = await Promise.all(
        files
          .filter(file => file.startsWith('all-n8n-nodes-') && file.endsWith('.ts'))
          .map(async (file) => {
            const filePath = join(StaticNodeManager.BACKUP_DIR, file)
            const stats = await fs.stat(filePath)
            return {
              filename: file,
              path: filePath,
              created: stats.birthtime,
            }
          }),
      )

      return backups.sort((a, b) => b.created.getTime() - a.created.getTime())
    }
    catch (error) {
      logger.error('Failed to list backups:', error)
      return []
    }
  }

  /**
   * Restore from a backup
   */
  async restoreFromBackup(backupFilename: string): Promise<void> {
    const backupPath = join(StaticNodeManager.BACKUP_DIR, backupFilename)

    try {
      const backupContent = await fs.readFile(backupPath, 'utf-8')

      // Create a backup of current state before restoring
      await this.createBackup('pre-restore')

      // Restore from backup
      await fs.writeFile(StaticNodeManager.NODE_FILE_PATH, backupContent, 'utf-8')

      logger.info(`🔄 Restored node list from backup: ${backupFilename}`)
    }
    catch (error) {
      logger.error(`Failed to restore from backup ${backupFilename}:`, error)
      throw error
    }
  }

  /**
   * Get statistics about the current node list
   */
  getNodeListStats(): {
    totalNodes: number
    categories: Record<string, number>
    lastModified?: Date
  } {
    const stats = {
      totalNodes: ALL_N8N_NODES.length,
      categories: this.analyzeNodeCategories(ALL_N8N_NODES),
    }

    return stats
  }

  /**
   * Validate node list integrity
   */
  async validateNodeList(): Promise<{
    isValid: boolean
    duplicates: string[]
    invalidNames: string[]
    suggestions: string[]
  }> {
    const duplicates = this.findDuplicates(ALL_N8N_NODES)
    const invalidNames = this.findInvalidNames(ALL_N8N_NODES)
    const suggestions = this.generateSuggestions(ALL_N8N_NODES)

    return {
      isValid: duplicates.length === 0 && invalidNames.length === 0,
      duplicates,
      invalidNames,
      suggestions,
    }
  }

  // Private methods

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(StaticNodeManager.BACKUP_DIR, { recursive: true })
    }
    catch (error) {
      logger.debug('Backup directory already exists or creation failed:', error)
    }
  }

  private categorizeNewNodes(nodes: string[]): Record<string, string[]> {
    const categories: Record<string, string[]> = {
      ai: [],
      database: [],
      communication: [],
      productivity: [],
      cloud: [],
      development: [],
      trigger: [],
      utility: [],
      other: [],
    }

    // Define category patterns for better maintainability
    const categoryPatterns: Array<{ category: keyof typeof categories, keywords: string[] }> = [
      { category: 'ai', keywords: ['openai', 'anthropic', 'gemini', 'langchain', 'ai', 'llm'] },
      { category: 'database', keywords: ['postgres', 'mysql', 'mongo', 'redis', 'elasticsearch'] },
      { category: 'communication', keywords: ['slack', 'discord', 'telegram', 'email', 'sms'] },
      { category: 'productivity', keywords: ['notion', 'airtable', 'jira', 'asana', 'trello'] },
      { category: 'cloud', keywords: ['aws', 'gcp', 'azure', 'vercel', 'netlify'] },
      { category: 'development', keywords: ['github', 'gitlab', 'docker', 'kubernetes', 'ci'] },
      { category: 'trigger', keywords: ['trigger', 'webhook', 'poll'] },
      { category: 'utility', keywords: ['http', 'json', 'xml', 'csv', 'pdf'] },
    ]

    nodes.forEach((node) => {
      const baseName = node.replace(/^n8n-nodes-base\./, '').replace(/^@n8n\/n8n-nodes-langchain\./, '').toLowerCase()

      // Find the first matching category
      const matchedCategory = categoryPatterns.find(({ keywords }) =>
        keywords.some(keyword => baseName.includes(keyword)),
      )

      if (matchedCategory) {
        categories[matchedCategory.category]?.push(node)
      }
      else {
        categories.other?.push(node)
      }
    })

    return categories
  }

  private generateUpdatedContent(
    currentContent: string,
    categorizedNodes: Record<string, string[]>,
    discoveryMethod: string,
  ): string {
    const timestamp = new Date().toISOString().split('T')[0]
    const totalNewNodes = Object.values(categorizedNodes).flat().length

    // Find the closing bracket of the array
    const arrayEndMatch = currentContent.match(/\]\s*$/)
    if (!arrayEndMatch) {
      throw new Error('Could not find end of node array in current file')
    }

    const arrayEndIndex = arrayEndMatch.index ?? currentContent.length
    const beforeArray = currentContent.substring(0, arrayEndIndex)
    const afterArray = currentContent.substring(arrayEndIndex)

    // Generate new nodes section
    let newNodesSection = ''
    if (totalNewNodes > 0) {
      newNodesSection += `\n  // Discovered nodes (${timestamp} via ${discoveryMethod})\n`

      Object.entries(categorizedNodes).forEach(([category, nodes]) => {
        if (nodes.length > 0) {
          newNodesSection += `  // ${category.charAt(0).toUpperCase() + category.slice(1)} nodes\n`
          nodes.forEach((node) => {
            const baseName = node.replace(/^n8n-nodes-base\./, '').replace(/^@n8n\/n8n-nodes-langchain\./, '')
            newNodesSection += `  '${baseName}', // discovered: ${timestamp}\n`
          })
          newNodesSection += '\n'
        }
      })
    }

    // Combine content
    let updatedContent = beforeArray + newNodesSection + afterArray

    // Update the header comment
    const headerMatch = updatedContent.match(/\/\*\*[\s\S]*?\*\//)
    if (headerMatch) {
      const currentTotal = ALL_N8N_NODES.length + totalNewNodes
      const updatedHeader = `/**
 * Complete list of all n8n-nodes-base nodes
 * Based on n8n documentation and enhanced discovery
 * Total: ${currentTotal}+ nodes
 * Last updated: ${timestamp}
 * Discovery methods: static analysis, workflow analysis, pattern scanning, community packages
 */`
      updatedContent = updatedContent.replace(headerMatch[0], updatedHeader)
    }

    return updatedContent
  }

  private analyzeNodeCategories(nodes: string[]): Record<string, number> {
    const categories: Record<string, number> = {}

    nodes.forEach((node) => {
      const category = this.inferNodeCategory(node)
      categories[category] = (categories[category] || 0) + 1
    })

    return categories
  }

  private inferNodeCategory(node: string): string {
    const nodeLower = node.toLowerCase()

    if (nodeLower.includes('trigger'))
      return 'triggers'
    if (nodeLower.includes('webhook'))
      return 'triggers'
    if (nodeLower.includes('ai') || nodeLower.includes('openai') || nodeLower.includes('anthropic'))
      return 'ai'
    if (nodeLower.includes('database') || nodeLower.includes('sql') || nodeLower.includes('mongo'))
      return 'database'
    if (nodeLower.includes('http') || nodeLower.includes('api') || nodeLower.includes('request'))
      return 'communication'
    if (nodeLower.includes('file') || nodeLower.includes('csv') || nodeLower.includes('json'))
      return 'data'
    if (nodeLower.includes('email') || nodeLower.includes('slack') || nodeLower.includes('discord'))
      return 'messaging'

    return 'utility'
  }

  private findDuplicates(nodes: string[]): string[] {
    const seen = new Set<string>()
    const duplicates = new Set<string>()

    nodes.forEach((node) => {
      if (seen.has(node)) {
        duplicates.add(node)
      }
      else {
        seen.add(node)
      }
    })

    return Array.from(duplicates)
  }

  private findInvalidNames(nodes: string[]): string[] {
    const invalidNames: string[] = []
    const validNamePattern = /^[a-z]\w*$/i

    nodes.forEach((node) => {
      if (!validNamePattern.test(node)) {
        invalidNames.push(node)
      }
    })

    return invalidNames
  }

  private generateSuggestions(nodes: string[]): string[] {
    const suggestions: string[] = []

    // Look for potential missing common nodes
    const commonMissingNodes = [
      'openai',
      'anthropic',
      'gemini',
      'ollama',
      'postgres',
      'mysql',
      'mongodb',
      'redis',
      'slack',
      'discord',
      'telegram',
      'whatsapp',
      'notion',
      'airtable',
      'github',
      'gitlab',
    ]

    commonMissingNodes.forEach((commonNode) => {
      const found = nodes.some(node => node.toLowerCase().includes(commonNode))
      if (!found) {
        suggestions.push(`Consider adding: ${commonNode}`)
      }
    })

    return suggestions.slice(0, 10) // Limit to 10 suggestions
  }

  private async logUpdate(update: NodeListUpdate): Promise<void> {
    const logEntry = {
      timestamp: update.timestamp.toISOString(),
      method: update.discoveryMethod,
      added: update.added.length,
      addedNodes: update.added,
      removed: update.removed.length,
      removedNodes: update.removed,
    }

    const logPath = join(StaticNodeManager.BACKUP_DIR, 'node-updates.log')
    const logLine = `${JSON.stringify(logEntry)}\n`

    try {
      await fs.appendFile(logPath, logLine, 'utf-8')
    }
    catch (error) {
      logger.debug('Failed to log node update:', error)
    }
  }
}
