/**
 * Discovery Automation & Scheduling System
 *
 * Phase 4: Automated discovery with intelligent scheduling
 *
 * Features:
 * - Version change detection for Docker/Watchtower environments
 * - Configurable periodic discovery scheduling
 * - Discovery triggers: startup, manual, version_change, scheduled
 * - Session management and cleanup
 * - Performance monitoring and adaptive scheduling
 */

import type { DiscoverySession, N8NInstance, VersionChange } from '../types/core.js'
import { CredentialDiscovery } from './credential-discovery.js'
import { MCPToolGenerator } from '../tools/mcp-tool-generator.js'
import { database, VersionManager } from '../database/index.js'
import { logger } from '../server/logger.js'
import { config } from '../server/config.js'

/**
 * Discovery trigger types
 */
export type DiscoveryTrigger = 'startup' | 'manual' | 'scheduled' | 'version_change' | 'api_health_check'

/**
 * Discovery scheduling configuration
 */
export interface DiscoveryScheduleConfig {
  /** Enable automatic discovery scheduling */
  enabled: boolean
  /** Discovery interval in minutes (default: 60) */
  intervalMinutes: number
  /** Enable version change detection */
  versionDetection: boolean
  /** Version check interval in minutes (default: 15) */
  versionCheckMinutes: number
  /** Maximum concurrent discovery sessions (default: 1) */
  maxConcurrentSessions: number
  /** Enable adaptive scheduling based on change frequency */
  adaptiveScheduling: boolean
  /** Minimum interval for adaptive scheduling in minutes */
  minIntervalMinutes: number
  /** Maximum interval for adaptive scheduling in minutes */
  maxIntervalMinutes: number
}

/**
 * Discovery session status
 */
export interface DiscoverySessionStatus {
  sessionId: string
  instanceId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  trigger: DiscoveryTrigger
  startedAt: Date
  progress: {
    phase: 'initializing' | 'discovering' | 'generating' | 'persisting' | 'completed'
    nodesDiscovered: number
    toolsGenerated: number
    credentialsTested: number
    currentCredential?: string
  }
  stats?: {
    executionTime: number
    memoryUsed: number
    successRate: number
    errorsCount: number
  }
}

/**
 * Discovery Automation Scheduler
 */
export class DiscoveryScheduler {
  private credentialDiscovery: CredentialDiscovery
  private toolGenerator: MCPToolGenerator
  private versionManager: VersionManager
  private activeSessions = new Map<string, DiscoverySessionStatus>()
  private scheduledJobs = new Map<string, NodeJS.Timeout>()
  private isRunning = false
  private config: DiscoveryScheduleConfig

  constructor() {
    this.credentialDiscovery = new CredentialDiscovery()
    this.toolGenerator = new MCPToolGenerator()
    this.versionManager = new VersionManager(database)
    
    // Load configuration with defaults
    this.config = {
      enabled: process.env.ENABLE_DISCOVERY_SCHEDULING !== 'false',
      intervalMinutes: Number.parseInt(process.env.DISCOVERY_INTERVAL_MINUTES || '60', 10),
      versionDetection: process.env.ENABLE_VERSION_DETECTION !== 'false',
      versionCheckMinutes: Number.parseInt(process.env.VERSION_CHECK_INTERVAL_MINUTES || '15', 10),
      maxConcurrentSessions: Number.parseInt(process.env.MAX_CONCURRENT_DISCOVERY_SESSIONS || '1', 10),
      adaptiveScheduling: process.env.ENABLE_ADAPTIVE_SCHEDULING === 'true',
      minIntervalMinutes: Number.parseInt(process.env.MIN_DISCOVERY_INTERVAL_MINUTES || '30', 10),
      maxIntervalMinutes: Number.parseInt(process.env.MAX_DISCOVERY_INTERVAL_MINUTES || '240', 10),
    }
  }

  /**
   * Start the discovery scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Discovery scheduler already running')
      return
    }

    this.isRunning = true
    logger.info('Starting discovery automation scheduler', {
      config: this.config,
      phase: 4,
    })

    // Schedule startup discovery
    if (config.n8nApiUrl && config.n8nApiKey) {
      setTimeout(() => {
        this.triggerDiscovery('startup', 'Startup discovery')
      }, 5000) // 5 second delay to allow initialization
    }

    // Schedule periodic discovery if enabled
    if (this.config.enabled) {
      this.schedulePeriodicDiscovery()
    }

    // Schedule version detection if enabled
    if (this.config.versionDetection) {
      this.scheduleVersionDetection()
    }

    logger.info('Discovery scheduler started successfully')
  }

  /**
   * Stop the discovery scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    logger.info('Stopping discovery scheduler...')

    // Cancel all scheduled jobs
    for (const [jobId, timer] of this.scheduledJobs) {
      clearTimeout(timer)
      logger.debug(`Cancelled scheduled job: ${jobId}`)
    }
    this.scheduledJobs.clear()

    // Cancel active sessions
    for (const [sessionId, session] of this.activeSessions) {
      if (session.status === 'running') {
        session.status = 'cancelled'
        logger.debug(`Cancelled active session: ${sessionId}`)
      }
    }

    logger.info('Discovery scheduler stopped')
  }

  /**
   * Trigger manual discovery
   */
  async triggerDiscovery(
    trigger: DiscoveryTrigger, 
    reason: string = 'Manual trigger'
  ): Promise<string | null> {
    try {
      // Check concurrent session limit
      const runningSessions = Array.from(this.activeSessions.values())
        .filter(s => s.status === 'running')
      
      if (runningSessions.length >= this.config.maxConcurrentSessions) {
        logger.warn('Cannot start discovery: maximum concurrent sessions reached', {
          running: runningSessions.length,
          limit: this.config.maxConcurrentSessions,
        })
        return null
      }

      // Check if n8n API is configured
      if (!config.n8nApiUrl || !config.n8nApiKey) {
        logger.debug('Skipping discovery: n8n API not configured')
        return null
      }

      logger.info('Triggering discovery session', { trigger, reason })

      // Create session status
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const sessionStatus: DiscoverySessionStatus = {
        sessionId,
        instanceId: '', // Will be set after instance registration
        status: 'running',
        trigger,
        startedAt: new Date(),
        progress: {
          phase: 'initializing',
          nodesDiscovered: 0,
          toolsGenerated: 0,
          credentialsTested: 0,
        },
      }

      this.activeSessions.set(sessionId, sessionStatus)

      // Execute discovery in background
      this.executeDiscoverySession(sessionStatus)
        .catch(error => {
          logger.error(`Discovery session ${sessionId} failed:`, error)
          sessionStatus.status = 'failed'
        })
        .finally(() => {
          // Cleanup completed session after 5 minutes
          setTimeout(() => {
            this.activeSessions.delete(sessionId)
          }, 5 * 60 * 1000)
        })

      return sessionId
    }
    catch (error) {
      logger.error('Failed to trigger discovery:', error)
      return null
    }
  }

  /**
   * Get status of all discovery sessions
   */
  getSessionStatus(): DiscoverySessionStatus[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * Get specific session status
   */
  getSession(sessionId: string): DiscoverySessionStatus | null {
    return this.activeSessions.get(sessionId) || null
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<DiscoveryScheduleConfig>): void {
    this.config = { ...this.config, ...newConfig }
    logger.info('Discovery scheduler configuration updated', { config: this.config })

    // Restart scheduling with new config
    if (this.isRunning) {
      // Clear existing jobs
      for (const timer of this.scheduledJobs.values()) {
        clearTimeout(timer)
      }
      this.scheduledJobs.clear()

      // Reschedule with new config
      if (this.config.enabled) {
        this.schedulePeriodicDiscovery()
      }
      if (this.config.versionDetection) {
        this.scheduleVersionDetection()
      }
    }
  }

  /**
   * Execute a discovery session
   */
  private async executeDiscoverySession(session: DiscoverySessionStatus): Promise<void> {
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed

    try {
      // Phase 1: Initialize and register instance
      session.progress.phase = 'initializing'
      logger.info(`Discovery session ${session.sessionId}: Initializing...`)

      // Phase 2: Credential-based discovery
      session.progress.phase = 'discovering'
      logger.info(`Discovery session ${session.sessionId}: Starting credential discovery...`)

      const discoveryStats = await this.credentialDiscovery.discover(
        config.n8nApiUrl,
        config.n8nApiKey,
        'full'
      )

      // instanceId should already be set when we register the n8n instance
      session.progress.nodesDiscovered = discoveryStats.nodesDiscovered
      session.progress.credentialsTested = discoveryStats.credentialsTested

      // Phase 3: Tool generation
      session.progress.phase = 'generating'
      logger.info(`Discovery session ${session.sessionId}: Generating MCP tools...`)

      const generationStats = await this.toolGenerator.generateAllTools()
      session.progress.toolsGenerated = generationStats.toolsGenerated

      // Phase 4: Persist and complete
      session.progress.phase = 'persisting'
      logger.info(`Discovery session ${session.sessionId}: Completing session...`)

      const executionTime = Date.now() - startTime
      const memoryUsed = process.memoryUsage().heapUsed - startMemory

      // Complete the session
      session.status = 'completed'
      session.progress.phase = 'completed'
      // Calculate success rate from discovery stats
      const successRate = discoveryStats.errors > 0 
        ? (discoveryStats.nodesDiscovered / (discoveryStats.nodesDiscovered + discoveryStats.errors))
        : 1.0

      session.stats = {
        executionTime,
        memoryUsed,
        successRate,
        errorsCount: discoveryStats.errors,
      }

      // Update discovery session in database
      if (session.instanceId) {
        await this.versionManager.completeDiscoverySession(
          session.sessionId,
          session.progress.nodesDiscovered,
          session.progress.toolsGenerated,
          executionTime,
          memoryUsed
        )
      }

      logger.info(`Discovery session ${session.sessionId} completed successfully`, {
        nodesDiscovered: session.progress.nodesDiscovered,
        toolsGenerated: session.progress.toolsGenerated,
        executionTime,
        memoryUsed,
      })

      // Schedule next discovery if adaptive scheduling is enabled
      if (this.config.adaptiveScheduling) {
        this.scheduleAdaptiveDiscovery(discoveryStats.nodesDiscovered > 0)
      }
    }
    catch (error) {
      session.status = 'failed'
      session.stats = {
        executionTime: Date.now() - startTime,
        memoryUsed: process.memoryUsage().heapUsed - startMemory,
        successRate: 0,
        errorsCount: 1,
      }

      logger.error(`Discovery session ${session.sessionId} failed:`, error)
      throw error
    }
  }

  /**
   * Schedule periodic discovery
   */
  private schedulePeriodicDiscovery(): void {
    const intervalMs = this.config.intervalMinutes * 60 * 1000
    
    const scheduleNext = () => {
      const timer = setTimeout(() => {
        if (this.isRunning && this.config.enabled) {
          this.triggerDiscovery('scheduled', `Periodic discovery (${this.config.intervalMinutes}m interval)`)
          scheduleNext() // Schedule the next one
        }
      }, intervalMs)

      this.scheduledJobs.set('periodic-discovery', timer)
    }

    scheduleNext()
    logger.info('Scheduled periodic discovery', { intervalMinutes: this.config.intervalMinutes })
  }

  /**
   * Schedule version detection checks
   */
  private scheduleVersionDetection(): void {
    const intervalMs = this.config.versionCheckMinutes * 60 * 1000

    const scheduleNext = () => {
      const timer = setTimeout(() => {
        if (this.isRunning && this.config.versionDetection) {
          this.checkVersionChanges()
          scheduleNext() // Schedule the next check
        }
      }, intervalMs)

      this.scheduledJobs.set('version-detection', timer)
    }

    scheduleNext()
    logger.info('Scheduled version detection', { intervalMinutes: this.config.versionCheckMinutes })
  }

  /**
   * Check for n8n version changes
   */
  private async checkVersionChanges(): Promise<void> {
    try {
      if (!config.n8nApiUrl || !config.n8nApiKey) {
        return
      }

      logger.debug('Checking for version changes...')

      // Get current version from n8n API
      const currentVersion = await this.getCurrentN8nVersion()
      if (!currentVersion) {
        return
      }

      // Get registered instances
      const instances = await this.versionManager.getActiveInstances()
      
      for (const instance of instances) {
        if (instance.version !== currentVersion) {
          logger.info('Detected version change', {
            instanceId: instance.id,
            oldVersion: instance.version,
            newVersion: currentVersion,
          })

          // Register version change
          await this.versionManager.detectVersionChange(instance.id, currentVersion)

          // Trigger rediscovery
          this.triggerDiscovery('version_change', `Version change: ${instance.version} → ${currentVersion}`)
        }
      }
    }
    catch (error) {
      logger.error('Version change detection failed:', error)
    }
  }

  /**
   * Get current n8n version from API
   */
  private async getCurrentN8nVersion(): Promise<string | null> {
    try {
      // This would make an API call to get n8n version
      // For now, return a placeholder since we don't have a direct version endpoint
      return '1.0.0' // Placeholder - would implement actual version detection
    }
    catch (error) {
      logger.error('Failed to get n8n version:', error)
      return null
    }
  }

  /**
   * Schedule next discovery with adaptive timing
   */
  private scheduleAdaptiveDiscovery(changesDetected: boolean): void {
    if (!this.config.adaptiveScheduling) {
      return
    }

    // If changes were detected, schedule sooner; if not, wait longer
    const adaptiveInterval = changesDetected 
      ? this.config.minIntervalMinutes 
      : Math.min(this.config.maxIntervalMinutes, this.config.intervalMinutes * 2)

    const timer = setTimeout(() => {
      if (this.isRunning && this.config.enabled) {
        this.triggerDiscovery('scheduled', `Adaptive discovery (${adaptiveInterval}m interval)`)
      }
    }, adaptiveInterval * 60 * 1000)

    // Replace existing adaptive timer
    if (this.scheduledJobs.has('adaptive-discovery')) {
      clearTimeout(this.scheduledJobs.get('adaptive-discovery')!)
    }
    this.scheduledJobs.set('adaptive-discovery', timer)

    logger.debug('Scheduled adaptive discovery', { 
      intervalMinutes: adaptiveInterval,
      reason: changesDetected ? 'changes detected' : 'no changes detected',
    })
  }

  /**
   * Get scheduler statistics
   */
  getStats(): {
    isRunning: boolean
    config: DiscoveryScheduleConfig
    activeSessions: number
    completedSessions: number
    failedSessions: number
    scheduledJobs: string[]
  } {
    const sessions = Array.from(this.activeSessions.values())
    
    return {
      isRunning: this.isRunning,
      config: this.config,
      activeSessions: sessions.filter(s => s.status === 'running').length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      failedSessions: sessions.filter(s => s.status === 'failed').length,
      scheduledJobs: Array.from(this.scheduledJobs.keys()),
    }
  }
}