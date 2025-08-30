/**
 * Cold Start Optimization System
 *
 * Advanced module preloading, lazy loading, and startup performance optimization
 * for ultra-fast MCP server initialization
 */

import { performance } from 'node:perf_hooks'
import { createError } from './enhanced-error-handler.js'
import { logger } from './logger.js'

// ============================================================================
// OPTIMIZATION TYPES
// ============================================================================

/**
 * Module preloading configuration
 */
export interface PreloadConfig {
  enabled: boolean
  criticalModules: string[]
  lazyModules: string[]
  preloadTimeout: number
  parallelPreload: boolean
  warmupCache: boolean
  measurePerformance: boolean
}

/**
 * Startup performance metrics
 */
export interface StartupMetrics {
  totalStartupTime: number
  preloadTime: number
  moduleLoadTime: number
  initializationTime: number
  memoryUsage: {
    beforeStartup: number
    afterStartup: number
    peakDuringStartup: number
  }
  moduleTimings: Record<string, number>
  cacheHitRate?: number
  parallelizationEfficiency?: number
}

/**
 * Module cache entry
 */
interface ModuleCacheEntry {
  module: any
  loadTime: number
  lastUsed: Date
  useCount: number
  size?: number
}

/**
 * Preload strategy
 */
export type PreloadStrategy = 'eager' | 'lazy' | 'adaptive' | 'critical-only'

// ============================================================================
// COLD START OPTIMIZER CLASS
// ============================================================================

/**
 * Advanced cold start optimization system
 */
export class ColdStartOptimizer {
  private moduleCache = new Map<string, ModuleCacheEntry>()
  private loadingPromises = new Map<string, Promise<any>>()
  private startTime = performance.now()
  private config: PreloadConfig
  private metrics: Partial<StartupMetrics> = {}
  private isOptimizing = false

  constructor(config: Partial<PreloadConfig> = {}) {
    this.config = {
      enabled: true,
      criticalModules: [
        '@modelcontextprotocol/sdk/server/index.js',
        '@modelcontextprotocol/sdk/server/stdio.js',
        './server/logger.js',
        './server/config.js',
        './types/fast-types.js',
      ],
      lazyModules: [
        './discovery/credential-discovery.js',
        './discovery/scheduler.js',
        './tools/mcp-tool-generator.js',
        './utils/memory-profiler.js',
      ],
      preloadTimeout: 5000, // 5 seconds
      parallelPreload: true,
      warmupCache: true,
      measurePerformance: true,
      ...config,
    }

    if (this.config.enabled) {
      this.initializeOptimizer()
    }
  }

  /**
   * Initialize the cold start optimizer
   */
  private initializeOptimizer(): void {
    // Record initial memory usage
    this.metrics.memoryUsage = {
      beforeStartup: process.memoryUsage().heapUsed,
      afterStartup: 0,
      peakDuringStartup: process.memoryUsage().heapUsed,
    }

    // Setup memory peak tracking
    if (this.config.measurePerformance) {
      this.setupMemoryTracking()
    }

    logger.debug('Cold start optimizer initialized', {
      criticalModules: this.config.criticalModules.length,
      lazyModules: this.config.lazyModules.length,
      parallelPreload: this.config.parallelPreload,
    })
  }

  /**
   * Optimize cold start by preloading critical modules
   */
  async optimizeColdStart(): Promise<StartupMetrics> {
    if (this.isOptimizing) {
      throw createError.performance('Cold start optimization already in progress')
    }

    this.isOptimizing = true
    const optimizationStart = performance.now()

    try {
      logger.info('Starting cold start optimization...')

      // Phase 1: Preload critical modules
      const preloadStart = performance.now()
      await this.preloadCriticalModules()
      this.metrics.preloadTime = performance.now() - preloadStart

      // Phase 2: Setup lazy loading for non-critical modules
      const lazySetupStart = performance.now()
      this.setupLazyLoading()
      const lazySetupTime = performance.now() - lazySetupStart

      // Phase 3: Warm up caches if enabled
      if (this.config.warmupCache) {
        const cacheWarmupStart = performance.now()
        await this.warmupCaches()
        const cacheWarmupTime = performance.now() - cacheWarmupStart
        logger.debug(`Cache warmup completed in ${Math.round(cacheWarmupTime)}ms`)
      }

      // Calculate final metrics
      this.metrics.totalStartupTime = performance.now() - this.startTime
      this.metrics.moduleLoadTime = performance.now() - optimizationStart

      // Record final memory usage
      this.metrics.memoryUsage!.afterStartup = process.memoryUsage().heapUsed

      // Calculate cache hit rate
      this.metrics.cacheHitRate = this.calculateCacheHitRate()

      // Calculate parallelization efficiency
      if (this.config.parallelPreload) {
        this.metrics.parallelizationEfficiency = this.calculateParallelizationEfficiency()
      }

      const finalMetrics: StartupMetrics = {
        totalStartupTime: this.metrics.totalStartupTime,
        preloadTime: this.metrics.preloadTime || 0,
        moduleLoadTime: this.metrics.moduleLoadTime,
        initializationTime: this.metrics.initializationTime || 0,
        memoryUsage: this.metrics.memoryUsage!,
        moduleTimings: this.getModuleTimings(),
        cacheHitRate: this.metrics.cacheHitRate,
        parallelizationEfficiency: this.metrics.parallelizationEfficiency || 0,
      }

      logger.info('Cold start optimization completed', {
        totalTime: `${Math.round(finalMetrics.totalStartupTime)}ms`,
        preloadTime: `${Math.round(finalMetrics.preloadTime)}ms`,
        cachedModules: this.moduleCache.size,
        cacheHitRate: finalMetrics.cacheHitRate ? `${(finalMetrics.cacheHitRate * 100).toFixed(1)}%` : 'N/A',
        memoryIncrease: this.formatBytes(
          finalMetrics.memoryUsage.afterStartup - finalMetrics.memoryUsage.beforeStartup,
        ),
      })

      return finalMetrics
    }
    catch (error) {
      logger.error('Cold start optimization failed:', error)
      throw createError.performance(
        'Cold start optimization failed',
        { error: error instanceof Error ? error.message : String(error) },
      )
    }
    finally {
      this.isOptimizing = false
    }
  }

  /**
   * Preload critical modules in parallel
   */
  private async preloadCriticalModules(): Promise<void> {
    const loadPromises = this.config.criticalModules.map(async (modulePath) => {
      const moduleStart = performance.now()

      try {
        const module = await this.loadModuleWithCache(modulePath)
        const loadTime = performance.now() - moduleStart

        logger.debug(`Preloaded critical module: ${modulePath} (${Math.round(loadTime)}ms)`)

        return { modulePath, module, loadTime, success: true }
      }
      catch (error) {
        const loadTime = performance.now() - moduleStart
        logger.warn(`Failed to preload module: ${modulePath}`, { error, loadTime: `${Math.round(loadTime)}ms` })

        return { modulePath, module: null, loadTime, success: false, error }
      }
    })

    const results = this.config.parallelPreload
      ? await Promise.allSettled(loadPromises.map(p => this.withTimeout(p, this.config.preloadTimeout)))
      : await this.loadSequentially(loadPromises)

    // Process results
    let successCount = 0
    let failureCount = 0

    for (let i = 0; i < results.length; i++) {
      const result = results[i]

      if (result && result.status === 'fulfilled') {
        const moduleResult = result.value
        if (moduleResult && moduleResult.success) {
          successCount++
        }
        else {
          failureCount++
        }
      }
      else if (result && result.status === 'rejected') {
        failureCount++
        logger.warn(`Module preload promise rejected: ${this.config.criticalModules[i]}`, result.reason)
      }
      else {
        failureCount++
      }
    }

    logger.info(`Critical module preloading completed`, {
      total: this.config.criticalModules.length,
      success: successCount,
      failed: failureCount,
      strategy: this.config.parallelPreload ? 'parallel' : 'sequential',
    })
  }

  /**
   * Setup lazy loading for non-critical modules
   */
  private setupLazyLoading(): void {
    // Create lazy loading proxies for non-critical modules
    this.config.lazyModules.forEach((modulePath) => {
      this.createLazyLoader(modulePath)
    })

    logger.debug(`Lazy loading setup for ${this.config.lazyModules.length} modules`)
  }

  /**
   * Create a lazy loader for a module
   */
  private createLazyLoader(modulePath: string): void {
    // We don't create actual proxies here since they're complex in TypeScript
    // Instead, we prepare the loading function for when it's needed
    if (!this.loadingPromises.has(modulePath)) {
      const lazyLoad = async () => {
        const start = performance.now()
        try {
          const module = await this.loadModuleWithCache(modulePath)
          const loadTime = performance.now() - start
          logger.debug(`Lazy loaded module: ${modulePath} (${Math.round(loadTime)}ms)`)
          return module
        }
        catch (error) {
          logger.warn(`Failed to lazy load module: ${modulePath}`, error)
          throw error
        }
      }

      // Store the lazy load function
      this.loadingPromises.set(`${modulePath}_lazy`, lazyLoad())
    }
  }

  /**
   * Warm up internal caches
   */
  private async warmupCaches(): Promise<void> {
    const warmupTasks = [
      this.warmupModuleCache(),
      this.warmupV8Cache(),
      this.warmupNodeCache(),
    ]

    await Promise.allSettled(warmupTasks)
  }

  /**
   * Warm up module resolution cache
   */
  private async warmupModuleCache(): Promise<void> {
    // Pre-resolve commonly used module paths
    const commonModules = [
      'node:fs',
      'node:path',
      'node:url',
      'node:crypto',
      'node:http',
      'node:https',
    ]

    for (const mod of commonModules) {
      try {
        await import(mod)
      }
      catch (error) {
        // Ignore errors for unavailable modules
      }
    }
  }

  /**
   * Warm up V8 compilation cache
   */
  private async warmupV8Cache(): Promise<void> {
    // Execute some common patterns to warm up V8's optimization cache
    const patterns = [
      () => JSON.parse('{"test": true}'),
      () => JSON.stringify({ test: true }),
      () => new Date().toISOString(),
      () => Math.random().toString(36),
      () => Buffer.from('test').toString('base64'),
    ]

    for (const pattern of patterns) {
      try {
        pattern()
      }
      catch (error) {
        // Ignore warmup errors
      }
    }
  }

  /**
   * Warm up Node.js internal caches
   */
  private async warmupNodeCache(): Promise<void> {
    // Warm up path resolution cache
    try {
      const path = await import('node:path')
      path.resolve('.')
      path.join('.', 'test')
      path.extname('test.js')
    }
    catch (error) {
      // Ignore warmup errors
    }
  }

  /**
   * Load module with caching
   */
  private async loadModuleWithCache(modulePath: string): Promise<any> {
    // Check cache first
    const cached = this.moduleCache.get(modulePath)
    if (cached) {
      cached.useCount++
      cached.lastUsed = new Date()
      return cached.module
    }

    // Check if already loading
    const existingPromise = this.loadingPromises.get(modulePath)
    if (existingPromise) {
      return await existingPromise
    }

    // Load module
    const loadPromise = this.loadModule(modulePath)
    this.loadingPromises.set(modulePath, loadPromise)

    try {
      const loadStart = performance.now()
      const module = await loadPromise
      const loadTime = performance.now() - loadStart

      // Cache the loaded module
      this.moduleCache.set(modulePath, {
        module,
        loadTime,
        lastUsed: new Date(),
        useCount: 1,
      })

      return module
    }
    finally {
      this.loadingPromises.delete(modulePath)
    }
  }

  /**
   * Load a single module
   */
  private async loadModule(modulePath: string): Promise<any> {
    try {
      // Handle different import styles
      if (modulePath.startsWith('.')) {
        // Relative import - would need to be resolved relative to the calling file
        return await import(modulePath)
      }
      else {
        // Absolute or node module import
        return await import(modulePath)
      }
    }
    catch (error) {
      throw createError.performance(
        `Failed to load module: ${modulePath}`,
        { modulePath, error: error instanceof Error ? error.message : String(error) },
      )
    }
  }

  /**
   * Load modules sequentially
   */
  private async loadSequentially<T>(promises: Promise<T>[]): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = []

    for (const promise of promises) {
      try {
        const result = await promise
        results.push({ status: 'fulfilled', value: result })
      }
      catch (error) {
        results.push({ status: 'rejected', reason: error })
      }
    }

    return results
  }

  /**
   * Wrap promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    })

    return Promise.race([promise, timeoutPromise])
  }

  /**
   * Setup memory usage tracking during startup
   */
  private setupMemoryTracking(): void {
    const trackingInterval = setInterval(() => {
      const current = process.memoryUsage().heapUsed
      if (current > (this.metrics.memoryUsage?.peakDuringStartup || 0)) {
        this.metrics.memoryUsage!.peakDuringStartup = current
      }
    }, 100) // Check every 100ms

    // Stop tracking after startup is complete
    setTimeout(() => {
      clearInterval(trackingInterval)
    }, 30000) // Stop after 30 seconds max
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const totalRequests = Array.from(this.moduleCache.values())
      .reduce((sum, entry) => sum + entry.useCount, 0)

    const cacheHits = this.moduleCache.size

    return totalRequests > 0 ? cacheHits / totalRequests : 0
  }

  /**
   * Calculate parallelization efficiency
   */
  private calculateParallelizationEfficiency(): number {
    if (!this.config.parallelPreload)
      return 0

    const totalModuleTime = Array.from(this.moduleCache.values())
      .reduce((sum, entry) => sum + entry.loadTime, 0)

    const actualPreloadTime = this.metrics.preloadTime || totalModuleTime

    // Efficiency = (theoretical sequential time) / (actual parallel time)
    return actualPreloadTime > 0 ? Math.min(1, totalModuleTime / actualPreloadTime) : 0
  }

  /**
   * Get module loading timings
   */
  private getModuleTimings(): Record<string, number> {
    const timings: Record<string, number> = {}

    for (const [path, entry] of this.moduleCache.entries()) {
      timings[path] = entry.loadTime
    }

    return timings
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    isEnabled: boolean
    cachedModules: number
    totalLoadTime: number
    averageLoadTime: number
    cacheHitRate: number
    memoryOverhead: number
    configuration: PreloadConfig
  } {
    const totalLoadTime = Array.from(this.moduleCache.values())
      .reduce((sum, entry) => sum + entry.loadTime, 0)

    const averageLoadTime = this.moduleCache.size > 0
      ? totalLoadTime / this.moduleCache.size
      : 0

    const memoryOverhead = this.metrics.memoryUsage
      ? this.metrics.memoryUsage.afterStartup - this.metrics.memoryUsage.beforeStartup
      : 0

    return {
      isEnabled: this.config.enabled,
      cachedModules: this.moduleCache.size,
      totalLoadTime,
      averageLoadTime,
      cacheHitRate: this.calculateCacheHitRate(),
      memoryOverhead,
      configuration: this.config,
    }
  }

  /**
   * Clear module cache
   */
  clearCache(): void {
    this.moduleCache.clear()
    this.loadingPromises.clear()
    logger.debug('Module cache cleared')
  }

  /**
   * Get cached module
   */
  getCachedModule(modulePath: string): any | null {
    const cached = this.moduleCache.get(modulePath)
    if (cached) {
      cached.useCount++
      cached.lastUsed = new Date()
      return cached.module
    }
    return null
  }

  /**
   * Format bytes in human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0)
      return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }
}

// ============================================================================
// STARTUP PERFORMANCE ANALYZER
// ============================================================================

/**
 * Analyze and optimize startup performance
 */
export class StartupPerformanceAnalyzer {
  private timings: Record<string, number> = {}
  private phases: Array<{ name: string, start: number, end?: number }> = []
  private currentPhase: string | undefined = undefined

  /**
   * Start timing a phase
   */
  startPhase(name: string): void {
    if (this.currentPhase) {
      this.endPhase(this.currentPhase)
    }

    this.currentPhase = name
    this.phases.push({ name, start: performance.now() })
  }

  /**
   * End timing a phase
   */
  endPhase(name: string): void {
    const phase = this.phases.find(p => p.name === name && !p.end)
    if (phase) {
      phase.end = performance.now()
      this.timings[name] = phase.end - phase.start
    }

    if (this.currentPhase === name) {
      this.currentPhase = undefined
    }
  }

  /**
   * Get timing for a phase
   */
  getPhaseTime(name: string): number {
    return this.timings[name] || 0
  }

  /**
   * Get all timings
   */
  getAllTimings(): Record<string, number> {
    return { ...this.timings }
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    totalTime: number
    phases: Record<string, number>
    slowestPhase: { name: string, time: number }
    recommendations: string[]
  } {
    const totalTime = Object.values(this.timings).reduce((sum, time) => sum + time, 0)
    const entries = Object.entries(this.timings)
    const slowestPhase = entries.length > 0
      ? entries.reduce((max, [name, time]) => time > max.time ? { name, time } : max, { name: '', time: 0 })
      : { name: 'none', time: 0 }

    const recommendations = this.generateRecommendations()

    return {
      totalTime,
      phases: this.timings,
      slowestPhase,
      recommendations,
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    const sortedPhases = Object.entries(this.timings).sort(([,a], [,b]) => b - a)

    for (const [phase, time] of sortedPhases.slice(0, 3)) {
      if (time > 1000) { // More than 1 second
        recommendations.push(`Optimize "${phase}" phase (${Math.round(time)}ms)`)
      }
    }

    if (sortedPhases.length > 0 && sortedPhases[0] && sortedPhases[0][1] > 500) {
      recommendations.push('Consider lazy loading for non-critical components')
    }

    if (Object.keys(this.timings).length > 10) {
      recommendations.push('Consider consolidating initialization phases')
    }

    return recommendations
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

/**
 * Global cold start optimizer instance
 */
export const coldStartOptimizer = new ColdStartOptimizer()

/**
 * Global startup performance analyzer
 */
export const startupAnalyzer = new StartupPerformanceAnalyzer()

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Optimize imports for faster loading
 */
export function optimizeImports(modules: string[]): Promise<any[]> {
  return Promise.all(modules.map(mod => coldStartOptimizer.getCachedModule(mod) || import(mod)))
}

/**
 * Preload specific modules
 */
export async function preloadModules(modules: string[]): Promise<void> {
  await Promise.allSettled(modules.map(mod => import(mod)))
}

/**
 * Get cold start optimization recommendations
 */
export function getOptimizationRecommendations(metrics: StartupMetrics): string[] {
  const recommendations: string[] = []

  if (metrics.totalStartupTime > 3000) {
    recommendations.push('Consider enabling module preloading to reduce startup time')
  }

  if (metrics.preloadTime > metrics.totalStartupTime * 0.5) {
    recommendations.push('Reduce critical module count or enable parallel preloading')
  }

  if (metrics.memoryUsage.peakDuringStartup > metrics.memoryUsage.afterStartup * 1.5) {
    recommendations.push('High memory usage during startup - optimize initialization order')
  }

  if ((metrics.cacheHitRate || 0) < 0.5) {
    recommendations.push('Improve module caching strategy for better performance')
  }

  return recommendations
}
