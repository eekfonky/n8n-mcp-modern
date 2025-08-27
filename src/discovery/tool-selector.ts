/**
 * Intelligent Tool Selection with Context-Aware Filtering
 * Optimizes MCP tool selection for token efficiency and relevance
 *
 * FEATURES:
 * - Context-aware tool filtering based on user intent
 * - Relevance scoring with multiple algorithms
 * - Token-efficient tool subset selection
 * - Usage pattern learning and adaptation
 * - Dynamic priority adjustment based on success rates
 */

import type { ToolDefinition } from '../tools/dynamic-tool-registry.js'
import { logger } from '../server/logger.js'
import { createCleanObject } from '../utils/aggressive-memory-cleanup.js'

export interface ToolContext {
  query?: string
  category?: string
  userIntent?: 'discovery' | 'execution' | 'validation' | 'analysis' | 'troubleshooting'
  nodeTypes?: string[]
  workflowContext?: boolean
  previousTools?: string[]
  maxTools?: number
  priorityThreshold?: number
}

export interface ToolRelevanceScore {
  toolName: string
  score: number
  reasons: string[]
  category: string
  contextMatch: number
  usageFrequency: number
  successRate: number
}

export interface ToolSelection {
  selectedTools: ToolDefinition[]
  scores: ToolRelevanceScore[]
  totalScore: number
  tokenEfficiency: number
  reasoning: string[]
}

export class ToolSelector {
  private usageStats: Map<string, { calls: number, successes: number, lastUsed: number }> = new Map()
  private contextPatterns: Map<string, string[]> = new Map() // Context -> commonly used tools
  private readonly maxHistorySize = 1000

  /**
   * Select most relevant tools based on context
   */
  selectTools(availableTools: ToolDefinition[], context: ToolContext): ToolSelection {
    logger.debug(`Selecting tools from ${availableTools.length} available tools with context:`, context)

    // Calculate relevance scores for all tools
    const scores = this.calculateRelevanceScores(availableTools, context)

    // Sort by score and apply limits
    const sortedScores = scores.sort((a, b) => b.score - a.score)
    const maxTools = context.maxTools || this.calculateOptimalToolCount(context)

    // Apply priority threshold filtering
    const priorityThreshold = context.priorityThreshold || 0.3
    const filteredScores = sortedScores.filter(score => score.score >= priorityThreshold)

    // Select top tools within limits
    const selectedScores = filteredScores.slice(0, maxTools)
    const selectedTools = selectedScores.map(score =>
      availableTools.find(tool => tool.name === score.toolName),
    ).filter((tool): tool is NonNullable<typeof tool> => tool !== undefined)

    // Calculate metrics
    const totalScore = selectedScores.reduce((sum, score) => sum + score.score, 0)
    const tokenEfficiency = this.calculateTokenEfficiency(selectedTools, context)

    // Generate reasoning
    const reasoning = this.generateSelectionReasoning(selectedScores, context)

    const selection: ToolSelection = createCleanObject({
      selectedTools,
      scores: selectedScores,
      totalScore,
      tokenEfficiency,
      reasoning,
    })

    logger.info(`Selected ${selectedTools.length} tools with efficiency ${tokenEfficiency.toFixed(2)}`)

    return selection
  }

  /**
   * Calculate relevance scores using multiple algorithms
   */
  private calculateRelevanceScores(tools: ToolDefinition[], context: ToolContext): ToolRelevanceScore[] {
    return tools.map((tool) => {
      const reasons: string[] = []
      let score = 0

      // Base priority score (0-40 points)
      const priorityScore = (tool.priority / 100) * 40
      score += priorityScore
      if (priorityScore >= 30)
        reasons.push('High priority tool')

      // Context matching (0-30 points)
      const contextScore = this.calculateContextMatch(tool, context)
      score += contextScore
      if (contextScore >= 20)
        reasons.push('Strong context match')

      // Query relevance (0-20 points)
      if (context.query) {
        const queryScore = this.calculateQueryRelevance(tool, context.query)
        score += queryScore
        if (queryScore >= 15)
          reasons.push('Query relevance')
      }

      // Usage frequency (0-15 points)
      const usageScore = this.calculateUsageScore(tool.name)
      score += usageScore
      if (usageScore >= 10)
        reasons.push('Frequently used')

      // Success rate bonus (0-10 points)
      const successScore = this.calculateSuccessScore(tool.name)
      score += successScore
      if (successScore >= 7)
        reasons.push('High success rate')

      // Category bonus (0-10 points)
      if (context.category && tool.category.toLowerCase().includes(context.category.toLowerCase())) {
        score += 10
        reasons.push('Category match')
      }

      // Dynamic tools bonus (0-5 points)
      if (tool.dynamicallyGenerated) {
        score += 5
        reasons.push('Dynamic discovery')
      }

      // Memory optimization bonus (0-5 points)
      if (tool.memoryOptimized) {
        score += 5
        reasons.push('Memory efficient')
      }

      // Normalize score to 0-1 range
      const normalizedScore = Math.min(score / 130, 1)

      return createCleanObject({
        toolName: tool.name,
        score: normalizedScore,
        reasons,
        category: tool.category,
        contextMatch: contextScore / 30,
        usageFrequency: usageScore / 15,
        successRate: successScore / 10,
      })
    })
  }

  /**
   * Calculate context matching score
   */
  private calculateContextMatch(tool: ToolDefinition, context: ToolContext): number {
    let score = 0

    // User intent matching
    if (context.userIntent) {
      switch (context.userIntent) {
        case 'discovery':
          if (tool.category.toLowerCase().includes('discovery')
            || tool.name.includes('search')
            || tool.name.includes('list')) {
            score += 25
          }
          break
        case 'execution':
          if (tool.category.toLowerCase().includes('execution')
            || tool.name.includes('execute')
            || tool.name.includes('run')) {
            score += 25
          }
          break
        case 'validation':
          if (tool.name.includes('validate')
            || tool.name.includes('verify')
            || tool.name.includes('check')) {
            score += 25
          }
          break
        case 'analysis':
          if (tool.name.includes('analyze')
            || tool.name.includes('stats')
            || tool.name.includes('report')) {
            score += 25
          }
          break
        case 'troubleshooting':
          if (tool.name.includes('debug')
            || tool.name.includes('health')
            || tool.name.includes('status')) {
            score += 25
          }
          break
      }
    }

    // Node type matching
    if (context.nodeTypes?.length) {
      const toolDesc = `${tool.name} ${tool.title} ${tool.description}`.toLowerCase()
      const matchingTypes = context.nodeTypes.filter(nodeType =>
        toolDesc.includes(nodeType.toLowerCase()),
      )
      score += Math.min(matchingTypes.length * 5, 15)
    }

    // Workflow context bonus
    if (context.workflowContext && tool.category.toLowerCase().includes('workflow')) {
      score += 10
    }

    return Math.min(score, 30)
  }

  /**
   * Calculate query relevance using text matching
   */
  private calculateQueryRelevance(tool: ToolDefinition, query: string): number {
    const queryLower = query.toLowerCase()
    const toolText = `${tool.name} ${tool.title} ${tool.description}`.toLowerCase()

    let score = 0
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2)

    for (const word of queryWords) {
      if (tool.name.toLowerCase().includes(word)) {
        score += 8 // Exact name match
      }
      else if (tool.title.toLowerCase().includes(word)) {
        score += 6 // Title match
      }
      else if (tool.description.toLowerCase().includes(word)) {
        score += 3 // Description match
      }
    }

    // Bonus for multiple word matches
    const matchCount = queryWords.filter(word => toolText.includes(word)).length
    if (matchCount > 1) {
      score += matchCount * 2
    }

    return Math.min(score, 20)
  }

  /**
   * Calculate usage-based scoring
   */
  private calculateUsageScore(toolName: string): number {
    const stats = this.usageStats.get(toolName)
    if (!stats)
      return 0

    // Frequency score (0-10 points)
    const maxCalls = Math.max(...Array.from(this.usageStats.values()).map(s => s.calls))
    const frequencyScore = maxCalls > 0 ? (stats.calls / maxCalls) * 10 : 0

    // Recency bonus (0-5 points)
    const hoursSinceUsed = (Date.now() - stats.lastUsed) / (1000 * 60 * 60)
    const recencyScore = Math.max(0, 5 - (hoursSinceUsed / 24)) // Decay over days

    return Math.min(frequencyScore + recencyScore, 15)
  }

  /**
   * Calculate success rate scoring
   */
  private calculateSuccessScore(toolName: string): number {
    const stats = this.usageStats.get(toolName)
    if (!stats || stats.calls === 0)
      return 5 // Neutral score for new tools

    const successRate = stats.successes / stats.calls
    return successRate * 10
  }

  /**
   * Calculate optimal tool count based on context
   */
  private calculateOptimalToolCount(context: ToolContext): number {
    let baseCount = 10 // Default

    // Adjust based on user intent
    switch (context.userIntent) {
      case 'discovery':
        baseCount = 15 // More tools for discovery
        break
      case 'execution':
        baseCount = 8 // Focused set for execution
        break
      case 'validation':
        baseCount = 6 // Small focused set
        break
      case 'analysis':
        baseCount = 12 // Medium set for analysis
        break
      case 'troubleshooting':
        baseCount = 8 // Focused diagnostic tools
        break
    }

    // Adjust based on query complexity
    if (context.query) {
      const wordCount = context.query.split(/\s+/).length
      if (wordCount > 10)
        baseCount += 5 // Complex queries need more tools
      if (wordCount < 3)
        baseCount -= 2 // Simple queries need fewer
    }

    return Math.max(5, Math.min(baseCount, 20)) // Keep within reasonable bounds
  }

  /**
   * Calculate token efficiency metric
   */
  private calculateTokenEfficiency(tools: ToolDefinition[], _context: ToolContext): number {
    const totalTools = tools.length
    const memoryOptimizedCount = tools.filter(t => t.memoryOptimized).length
    const dynamicCount = tools.filter(t => t.dynamicallyGenerated).length
    const highPriorityCount = tools.filter(t => t.priority >= 80).length

    // Calculate efficiency score (0-1)
    let efficiency = 0
    efficiency += (memoryOptimizedCount / totalTools) * 0.3 // 30% weight for memory optimization
    efficiency += (dynamicCount / totalTools) * 0.2 // 20% weight for dynamic generation
    efficiency += (highPriorityCount / totalTools) * 0.3 // 30% weight for high priority
    efficiency += Math.min(15 / totalTools, 1) * 0.2 // 20% weight for reasonable count

    return efficiency
  }

  /**
   * Generate human-readable selection reasoning
   */
  private generateSelectionReasoning(scores: ToolRelevanceScore[], context: ToolContext): string[] {
    const reasoning: string[] = []

    if (context.userIntent) {
      reasoning.push(`Prioritized tools for ${context.userIntent} intent`)
    }

    if (context.query) {
      reasoning.push(`Matched tools relevant to query: "${context.query}"`)
    }

    const highScoreCount = scores.filter(s => s.score >= 0.8).length
    if (highScoreCount > 0) {
      reasoning.push(`Selected ${highScoreCount} highly relevant tools`)
    }

    const categories = [...new Set(scores.map(s => s.category))]
    reasoning.push(`Covered ${categories.length} categories: ${categories.slice(0, 3).join(', ')}${categories.length > 3 ? '...' : ''}`)

    const dynamicCount = scores.filter(s => s.toolName.includes('dynamic')).length
    if (dynamicCount > 0) {
      reasoning.push(`Included ${dynamicCount} dynamically discovered tools`)
    }

    return reasoning
  }

  /**
   * Record tool usage for learning
   */
  recordToolUsage(toolName: string, success: boolean): void {
    const current = this.usageStats.get(toolName) || { calls: 0, successes: 0, lastUsed: 0 }

    current.calls++
    if (success)
      current.successes++
    current.lastUsed = Date.now()

    this.usageStats.set(toolName, current)

    // Cleanup old entries to prevent memory leaks
    if (this.usageStats.size > this.maxHistorySize) {
      this.cleanupOldStats()
    }

    logger.debug(`Recorded usage for ${toolName}: ${current.successes}/${current.calls} success rate`)
  }

  /**
   * Learn context patterns for future selections
   */
  learnContextPattern(context: ToolContext, selectedTools: string[]): void {
    if (!context.userIntent)
      return

    const existingPattern = this.contextPatterns.get(context.userIntent) || []
    const updatedPattern = [...new Set([...existingPattern, ...selectedTools])]

    // Keep only top patterns to prevent memory bloat
    this.contextPatterns.set(context.userIntent, updatedPattern.slice(0, 50))

    logger.debug(`Learned pattern for ${context.userIntent}: ${selectedTools.length} tools`)
  }

  /**
   * Get selection statistics and insights
   */
  getSelectionStatistics(): Record<string, unknown> {
    const totalUsage = Array.from(this.usageStats.values()).reduce((sum, stat) => sum + stat.calls, 0)
    const totalSuccess = Array.from(this.usageStats.values()).reduce((sum, stat) => sum + stat.successes, 0)

    const topTools = Array.from(this.usageStats.entries())
      .sort((a, b) => b[1].calls - a[1].calls)
      .slice(0, 10)
      .map(([name, stats]) => ({
        tool: name,
        calls: stats.calls,
        successRate: stats.calls > 0 ? (stats.successes / stats.calls).toFixed(2) : '0.00',
      }))

    return createCleanObject({
      totalTools: this.usageStats.size,
      totalUsage,
      overallSuccessRate: totalUsage > 0 ? (totalSuccess / totalUsage).toFixed(3) : '0.000',
      topTools,
      learnedPatterns: this.contextPatterns.size,
      memoryUsage: {
        usageStats: this.usageStats.size,
        contextPatterns: this.contextPatterns.size,
        maxHistorySize: this.maxHistorySize,
      },
    })
  }

  /**
   * Clear usage statistics for memory management
   */
  clearStatistics(): void {
    this.usageStats.clear()
    this.contextPatterns.clear()
    logger.info('Tool selection statistics cleared')
  }

  /**
   * Cleanup old statistics entries
   */
  private cleanupOldStats(): void {
    const entries = Array.from(this.usageStats.entries())
    const sortedByLastUsed = entries.sort((a, b) => b[1].lastUsed - a[1].lastUsed)

    // Keep only the most recent entries
    this.usageStats.clear()
    sortedByLastUsed.slice(0, this.maxHistorySize * 0.8).forEach(([name, stats]) => {
      this.usageStats.set(name, stats)
    })

    logger.debug(`Cleaned up tool usage statistics, kept ${this.usageStats.size} entries`)
  }

  /**
   * Export selection criteria for analysis
   */
  exportSelectionCriteria(): Record<string, unknown> {
    return createCleanObject({
      scoringWeights: {
        priority: 40,
        contextMatch: 30,
        queryRelevance: 20,
        usageFrequency: 15,
        successRate: 10,
        categoryBonus: 10,
        dynamicBonus: 5,
        memoryBonus: 5,
      },
      thresholds: {
        defaultPriorityThreshold: 0.3,
        maxToolsRange: [5, 20],
        tokenEfficiencyComponents: ['memoryOptimized', 'dynamicGeneration', 'highPriority', 'reasonableCount'],
      },
      adaptiveFeatures: [
        'usageStatistics',
        'contextPatternLearning',
        'successRateTracking',
        'dynamicPriorityAdjustment',
      ],
    })
  }
}
