/**
 * Cold Start Optimization MCP Tool
 *
 * Provides cold start analysis, optimization, and performance monitoring
 * capabilities as MCP tools
 */

import { coldStartOptimizer, getOptimizationRecommendations, startupAnalyzer } from '../server/cold-start-optimizer.js'
import { logger } from '../server/logger.js'

/**
 * Get cold start optimization statistics
 */
export async function getColdStartStats(_args: Record<string, any>) {
  try {
    const stats = coldStartOptimizer.getOptimizationStats()
    const timings = startupAnalyzer.getAllTimings()

    return {
      success: true,
      data: {
        optimization: {
          enabled: stats.isEnabled,
          cachedModules: stats.cachedModules,
          totalLoadTime: `${Math.round(stats.totalLoadTime)}ms`,
          averageLoadTime: `${Math.round(stats.averageLoadTime)}ms`,
          cacheHitRate: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
          memoryOverhead: formatBytes(stats.memoryOverhead),
        },
        startupPhases: Object.entries(timings).map(([name, time]) => ({
          phase: name,
          duration: `${Math.round(time)}ms`,
          percentage: timings ? `${((time / Object.values(timings).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%` : '0%',
        })).sort((a, b) => Number.parseFloat(b.duration) - Number.parseFloat(a.duration)),
        configuration: {
          criticalModules: stats.configuration.criticalModules.length,
          lazyModules: stats.configuration.lazyModules.length,
          parallelPreload: stats.configuration.parallelPreload,
          preloadTimeout: `${stats.configuration.preloadTimeout}ms`,
          warmupCache: stats.configuration.warmupCache,
        },
        timestamp: new Date().toISOString(),
      },
    }
  }
  catch (error) {
    logger.error('Failed to get cold start stats:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Generate cold start performance report
 */
export async function generateColdStartReport(_args: Record<string, any>) {
  try {
    const performanceReport = startupAnalyzer.generateReport()
    const optimizationStats = coldStartOptimizer.getOptimizationStats()

    // Calculate metrics for recommendations
    const mockMetrics = {
      totalStartupTime: performanceReport.totalTime,
      preloadTime: performanceReport.phases['cold-start-optimization'] || 0,
      moduleLoadTime: performanceReport.phases['dynamic-tool-discovery'] || 0,
      initializationTime: performanceReport.phases['startup-initialization'] || 0,
      memoryUsage: {
        beforeStartup: 0,
        afterStartup: optimizationStats.memoryOverhead,
        peakDuringStartup: optimizationStats.memoryOverhead * 1.2,
      },
      moduleTimings: {},
      cacheHitRate: optimizationStats.cacheHitRate,
    }

    const recommendations = getOptimizationRecommendations(mockMetrics)

    return {
      success: true,
      data: {
        summary: {
          totalStartupTime: `${Math.round(performanceReport.totalTime)}ms`,
          slowestPhase: performanceReport.slowestPhase.name,
          slowestPhaseTime: `${Math.round(performanceReport.slowestPhase.time)}ms`,
          totalPhases: Object.keys(performanceReport.phases).length,
          cacheEfficiency: `${(optimizationStats.cacheHitRate * 100).toFixed(1)}%`,
          overallScore: calculatePerformanceScore(performanceReport, optimizationStats),
        },
        phaseBreakdown: Object.entries(performanceReport.phases).map(([phase, time]) => ({
          phase,
          duration: `${Math.round(time)}ms`,
          percentage: `${((time / performanceReport.totalTime) * 100).toFixed(1)}%`,
          status: time > 1000 ? 'Slow' : time > 500 ? 'Medium' : 'Fast',
        })).sort((a, b) => Number.parseFloat(b.duration) - Number.parseFloat(a.duration)),
        optimization: {
          enabled: optimizationStats.isEnabled,
          modulesPreloaded: optimizationStats.cachedModules,
          cacheHitRate: `${(optimizationStats.cacheHitRate * 100).toFixed(1)}%`,
          memoryOverhead: formatBytes(optimizationStats.memoryOverhead),
          averageModuleLoadTime: `${Math.round(optimizationStats.averageLoadTime)}ms`,
        },
        recommendations: recommendations.map(rec => ({
          type: 'performance',
          priority: rec.includes('Consider') ? 'Medium' : 'High',
          description: rec,
          category: categorizeRecommendation(rec),
        })),
        performanceTargets: {
          totalStartup: { target: '< 2000ms', current: `${Math.round(performanceReport.totalTime)}ms`, met: performanceReport.totalTime < 2000 },
          moduleLoading: { target: '< 500ms', current: `${Math.round(optimizationStats.totalLoadTime)}ms`, met: optimizationStats.totalLoadTime < 500 },
          cacheEfficiency: { target: '> 70%', current: `${(optimizationStats.cacheHitRate * 100).toFixed(1)}%`, met: optimizationStats.cacheHitRate > 0.7 },
        },
        timestamp: new Date().toISOString(),
      },
    }
  }
  catch (error) {
    logger.error('Failed to generate cold start report:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Analyze startup bottlenecks
 */
export async function analyzeStartupBottlenecks(args: Record<string, any>) {
  try {
    const timings = startupAnalyzer.getAllTimings()
    const stats = coldStartOptimizer.getOptimizationStats()

    // Analyze bottlenecks
    const sortedPhases = Object.entries(timings).sort(([,a], [,b]) => b - a)
    const totalTime = Object.values(timings).reduce((sum, time) => sum + time, 0)

    const bottlenecks = sortedPhases
      .filter(([, time]) => time > 100) // Only phases taking more than 100ms
      .slice(0, 5) // Top 5 bottlenecks
      .map(([phase, time]) => {
        const percentage = (time / totalTime) * 100
        return {
          phase,
          duration: `${Math.round(time)}ms`,
          percentage: `${percentage.toFixed(1)}%`,
          severity: percentage > 30 ? 'Critical' : percentage > 15 ? 'High' : 'Medium',
          impact: Math.round(percentage / 10),
          suggestions: getPhaseOptimizationSuggestions(phase, time),
        }
      })

    return {
      success: true,
      data: {
        analysis: {
          totalStartupTime: `${Math.round(totalTime)}ms`,
          bottleneckCount: bottlenecks.length,
          topBottleneck: bottlenecks[0] || null,
          optimizationPotential: `${Math.round(bottlenecks.reduce((sum, b) => sum + Number.parseFloat(b.duration), 0) * 0.3)}ms`,
        },
        bottlenecks,
        moduleAnalysis: {
          totalModules: stats.cachedModules,
          averageLoadTime: `${Math.round(stats.averageLoadTime)}ms`,
          cacheEfficiency: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
          slowModules: stats.cachedModules > 0 ? 'Module timing data not available' : 'No modules cached',
        },
        actionItems: generateActionItems(bottlenecks),
        timestamp: new Date().toISOString(),
      },
    }
  }
  catch (error) {
    logger.error('Failed to analyze startup bottlenecks:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Clear optimization cache
 */
export async function clearOptimizationCache(args: Record<string, any>) {
  try {
    const statsBefore = coldStartOptimizer.getOptimizationStats()

    coldStartOptimizer.clearCache()

    const statsAfter = coldStartOptimizer.getOptimizationStats()

    return {
      success: true,
      data: {
        cacheCleared: true,
        modulesCleared: statsBefore.cachedModules,
        memoryFreed: formatBytes(Math.max(0, statsBefore.memoryOverhead - statsAfter.memoryOverhead)),
        before: {
          cachedModules: statsBefore.cachedModules,
          memoryUsage: formatBytes(statsBefore.memoryOverhead),
        },
        after: {
          cachedModules: statsAfter.cachedModules,
          memoryUsage: formatBytes(statsAfter.memoryOverhead),
        },
        timestamp: new Date().toISOString(),
        note: 'Cache cleared successfully. Next startup will rebuild the module cache.',
      },
    }
  }
  catch (error) {
    logger.error('Failed to clear optimization cache:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Get optimization configuration
 */
export async function getOptimizationConfig(args: Record<string, any>) {
  try {
    const stats = coldStartOptimizer.getOptimizationStats()
    const config = stats.configuration

    return {
      success: true,
      data: {
        current: {
          enabled: config.enabled,
          criticalModules: config.criticalModules,
          lazyModules: config.lazyModules,
          preloadTimeout: `${config.preloadTimeout}ms`,
          parallelPreload: config.parallelPreload,
          warmupCache: config.warmupCache,
          measurePerformance: config.measurePerformance,
        },
        recommendations: {
          enabled: !config.enabled ? 'Enable cold start optimization for better performance' : null,
          parallelPreload: !config.parallelPreload ? 'Enable parallel preloading for faster startup' : null,
          warmupCache: !config.warmupCache ? 'Enable cache warmup for improved performance' : null,
          preloadTimeout: config.preloadTimeout < 3000 ? 'Consider increasing preload timeout to 5000ms' : null,
        },
        performance: {
          cachedModules: stats.cachedModules,
          cacheHitRate: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
          averageLoadTime: `${Math.round(stats.averageLoadTime)}ms`,
          memoryOverhead: formatBytes(stats.memoryOverhead),
        },
        timestamp: new Date().toISOString(),
      },
    }
  }
  catch (error) {
    logger.error('Failed to get optimization config:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format bytes in human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

/**
 * Calculate performance score
 */
function calculatePerformanceScore(performanceReport: any, optimizationStats: any): string {
  let score = 100

  // Deduct points for slow startup
  if (performanceReport.totalTime > 3000)
    score -= 30
  else if (performanceReport.totalTime > 2000)
    score -= 15
  else if (performanceReport.totalTime > 1000)
    score -= 5

  // Deduct points for low cache efficiency
  if (optimizationStats.cacheHitRate < 0.5)
    score -= 20
  else if (optimizationStats.cacheHitRate < 0.7)
    score -= 10

  // Deduct points for slow phases
  if (performanceReport.slowestPhase.time > 1000)
    score -= 15
  else if (performanceReport.slowestPhase.time > 500)
    score -= 5

  score = Math.max(0, Math.min(100, score))

  if (score >= 90)
    return `${score}/100 (Excellent)`
  if (score >= 75)
    return `${score}/100 (Good)`
  if (score >= 60)
    return `${score}/100 (Fair)`
  return `${score}/100 (Needs Improvement)`
}

/**
 * Categorize recommendation
 */
function categorizeRecommendation(recommendation: string): string {
  if (recommendation.includes('module') || recommendation.includes('preload'))
    return 'Module Loading'
  if (recommendation.includes('memory') || recommendation.includes('Memory'))
    return 'Memory Management'
  if (recommendation.includes('cache') || recommendation.includes('Cache'))
    return 'Caching'
  if (recommendation.includes('parallel') || recommendation.includes('concurrent'))
    return 'Parallelization'
  return 'General Performance'
}

/**
 * Get phase-specific optimization suggestions
 */
function getPhaseOptimizationSuggestions(phase: string, time: number): string[] {
  const suggestions: string[] = []

  switch (phase) {
    case 'cold-start-optimization':
      if (time > 1000) {
        suggestions.push('Reduce number of critical modules')
        suggestions.push('Enable parallel preloading')
        suggestions.push('Increase preload timeout')
      }
      break

    case 'dynamic-tool-discovery':
      if (time > 2000) {
        suggestions.push('Implement lazy loading for non-essential tools')
        suggestions.push('Cache tool discovery results')
        suggestions.push('Optimize n8n API connections')
      }
      break

    case 'memory-profiling-setup':
      if (time > 500) {
        suggestions.push('Reduce memory profiling sampling frequency')
        suggestions.push('Delay non-critical memory monitoring')
      }
      break

    case 'server-connection':
      if (time > 300) {
        suggestions.push('Optimize MCP server initialization')
        suggestions.push('Pre-allocate server resources')
      }
      break

    default:
      if (time > 500) {
        suggestions.push('Profile this phase for specific optimizations')
        suggestions.push('Consider lazy initialization')
      }
  }

  return suggestions
}

/**
 * Generate action items from bottlenecks
 */
function generateActionItems(bottlenecks: any[]): Array<{ priority: string, action: string, impact: string }> {
  const actions = []

  for (const bottleneck of bottlenecks.slice(0, 3)) { // Top 3 bottlenecks
    const suggestions = bottleneck.suggestions
    if (suggestions.length > 0) {
      actions.push({
        priority: bottleneck.severity,
        action: `Optimize ${bottleneck.phase}: ${suggestions[0]}`,
        impact: `Could save ~${Math.round(Number.parseFloat(bottleneck.duration) * 0.3)}ms`,
      })
    }
  }

  return actions
}

/**
 * Export cold start optimization tools
 */
export const coldStartOptimizationTools = {
  'cold-start-stats': {
    description: 'Get cold start optimization statistics and configuration',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: getColdStartStats,
  },

  'cold-start-report': {
    description: 'Generate comprehensive cold start performance report',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: generateColdStartReport,
  },

  'analyze-startup-bottlenecks': {
    description: 'Analyze startup performance bottlenecks and get optimization suggestions',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: analyzeStartupBottlenecks,
  },

  'clear-optimization-cache': {
    description: 'Clear module optimization cache to free memory',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: clearOptimizationCache,
  },

  'optimization-config': {
    description: 'Get current optimization configuration and recommendations',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: getOptimizationConfig,
  },
}
