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
 * - Singleton pattern to prevent multiple instances
 */

import type { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { database, VersionManager } from '../database/index.js'
import { config } from '../server/config.js'
import { logger } from '../server/logger.js'
import { MCPToolGenerator } from '../tools/mcp-tool-generator.js'
import { managedClearTimer, managedSetTimeout } from '../utils/timer-manager.js'
import { CredentialDiscovery } from './credential-discovery.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Singleton instance tracking
let _schedulerInstance: DiscoveryScheduler | null = null
const SCHEDULER_LOCK_FILE = '/tmp/n8n-mcp-scheduler.lock'

// Discovery environment variables validation schema
const DiscoveryEnvSchema = z.object({
  ENABLE_DISCOVERY_SCHEDULING: z.string().optional().default('true'),
  DISCOVERY_INTERVAL_MINUTES: z.string().optional().default('60'),
  ENABLE_VERSION_DETECTION: z.string().optional().default('true'),
  VERSION_CHECK_INTERVAL_MINUTES: z.string().optional().default('15'),
  MAX_CONCURRENT_DISCOVERY_SESSIONS: z.string().optional().default('1'),
  ENABLE_ADAPTIVE_SCHEDULING: z.string().optional().default('false'),
  MIN_DISCOVERY_INTERVAL_MINUTES: z.string().optional().default('30'),
  MAX_DISCOVERY_INTERVAL_MINUTES: z.string().optional().default('240'),
  ENABLE_DISCOVERY_WEBHOOKS: z.string().optional().default('false'),
  DISCOVERY_WEBHOOK_PORT: z.string().optional().default('3001'),
  DISCOVERY_WEBHOOK_SECRET: z.string().optional(),
  ENABLE_SMART_INTERVALS: z.string().optional().default('false'),
  ACTIVITY_WINDOW_MINUTES: z.string().optional().default('30'),
  HIGH_ACTIVITY_INTERVAL_MINUTES: z.string().optional().default('15'),
})

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
  /** Enable webhook-based discovery triggers */
  webhooksEnabled: boolean
  /** Webhook server port (default: 3001) */
  webhookPort: number
  /** Webhook secret for security (optional) */
  webhookSecret?: string
  /** Enable smart intervals based on n8n activity */
  smartIntervals: boolean
  /** Activity detection window in minutes */
  activityWindowMinutes: number
  /** Reduce interval when high activity detected */
  highActivityIntervalMinutes: number
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
 * Discovery Automation Scheduler with Singleton Pattern
 */
export class DiscoveryScheduler {
  private credentialDiscovery: CredentialDiscovery
  private toolGenerator: MCPToolGenerator
  private versionManager: VersionManager
  private activeSessions = new Map<string, DiscoverySessionStatus>()
  private scheduledJobs = new Map<string, string>() // Store timer IDs instead of NodeJS.Timeout
  private isRunning = false
  private config: DiscoveryScheduleConfig
  private webhookServer?: import('node:http').Server | undefined // HTTP server instance for webhooks
  private isHighActivityMode = false // Track high activity mode for smart intervals
  private startupTimerId: string | undefined = undefined // Managed timer ID for startup discovery

  private constructor() {
    this.credentialDiscovery = new CredentialDiscovery()
    this.toolGenerator = new MCPToolGenerator()
    this.versionManager = new VersionManager(database)

    // Validate and load environment variables
    const envVars = DiscoveryEnvSchema.parse(process.env)

    // Load configuration with validated defaults
    this.config = {
      enabled: envVars.ENABLE_DISCOVERY_SCHEDULING !== 'false',
      intervalMinutes: Number.parseInt(envVars.DISCOVERY_INTERVAL_MINUTES, 10),
      versionDetection: envVars.ENABLE_VERSION_DETECTION !== 'false',
      versionCheckMinutes: Number.parseInt(envVars.VERSION_CHECK_INTERVAL_MINUTES, 10),
      maxConcurrentSessions: Number.parseInt(envVars.MAX_CONCURRENT_DISCOVERY_SESSIONS, 10),
      adaptiveScheduling: envVars.ENABLE_ADAPTIVE_SCHEDULING === 'true',
      minIntervalMinutes: Number.parseInt(envVars.MIN_DISCOVERY_INTERVAL_MINUTES, 10),
      maxIntervalMinutes: Number.parseInt(envVars.MAX_DISCOVERY_INTERVAL_MINUTES, 10),
      webhooksEnabled: envVars.ENABLE_DISCOVERY_WEBHOOKS === 'true',
      webhookPort: Number.parseInt(envVars.DISCOVERY_WEBHOOK_PORT, 10),
      ...(envVars.DISCOVERY_WEBHOOK_SECRET && { webhookSecret: envVars.DISCOVERY_WEBHOOK_SECRET }),
      smartIntervals: envVars.ENABLE_SMART_INTERVALS === 'true',
      activityWindowMinutes: Number.parseInt(envVars.ACTIVITY_WINDOW_MINUTES, 10),
      highActivityIntervalMinutes: Number.parseInt(envVars.HIGH_ACTIVITY_INTERVAL_MINUTES, 10),
    }
  }

  /**
   * Get singleton instance with collision detection
   */
  static async getInstance(): Promise<DiscoveryScheduler> {
    if (_schedulerInstance) {
      return _schedulerInstance
    }

    // Check for existing instance lock
    try {
      await fs.access(SCHEDULER_LOCK_FILE)
      logger.warn('Discovery scheduler lock file exists - potential collision detected')

      // Try to read lock file for process info
      try {
        const lockContent = await fs.readFile(SCHEDULER_LOCK_FILE, 'utf8')
        const lockData = JSON.parse(lockContent)
        logger.warn('Existing scheduler instance detected', { lockData })

        // Check if the process is still running
        try {
          process.kill(lockData.pid, 0) // Signal 0 checks if process exists
          throw new Error(`Another Discovery Scheduler is running (PID: ${lockData.pid})`)
        }
        catch {
          // Process is dead, remove stale lock
          logger.info('Removing stale scheduler lock file')
          await fs.unlink(SCHEDULER_LOCK_FILE)
        }
      }
      catch {
        // Invalid lock file, remove it
        await fs.unlink(SCHEDULER_LOCK_FILE)
      }
    }
    catch {
      // Lock file doesn't exist, proceed
    }

    // Create lock file
    const lockData = {
      pid: process.pid,
      startTime: new Date().toISOString(),
      instanceId: `scheduler-${Date.now()}-${process.pid}`,
    }
    await fs.writeFile(SCHEDULER_LOCK_FILE, JSON.stringify(lockData, null, 2))

    // Create instance
    _schedulerInstance = new DiscoveryScheduler()

    // Setup cleanup on process exit
    const cleanup = async () => {
      if (_schedulerInstance) {
        await _schedulerInstance.stop()
        _schedulerInstance = null
      }
      try {
        await fs.unlink(SCHEDULER_LOCK_FILE)
      }
      catch {
        // Ignore cleanup errors
      }
    }

    process.on('exit', cleanup)
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception in scheduler:', error)
      await cleanup()
      process.exit(1)
    })

    return _schedulerInstance
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
      this.startupTimerId = managedSetTimeout(() => {
        this.triggerDiscovery('startup', 'Startup discovery')
      }, 5000, 'DiscoveryScheduler:startup') // 5 second delay to allow initialization
    }

    // Schedule periodic discovery if enabled
    if (this.config.enabled) {
      this.schedulePeriodicDiscovery()
    }

    // Schedule version detection if enabled
    if (this.config.versionDetection) {
      this.scheduleVersionDetection()
    }

    // Initialize webhook server if enabled
    if (this.config.webhooksEnabled) {
      await this.initializeWebhookServer()
    }

    // Initialize smart intervals if enabled
    if (this.config.smartIntervals) {
      this.initializeSmartIntervals()
    }

    logger.info('Discovery scheduler started successfully', {
      webhooks: this.config.webhooksEnabled,
      smartIntervals: this.config.smartIntervals,
      adaptiveScheduling: this.config.adaptiveScheduling,
    })
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
    for (const [jobId, timerId] of this.scheduledJobs) {
      managedClearTimer(timerId)
      logger.debug(`Cancelled scheduled job: ${jobId}`)
    }
    this.scheduledJobs.clear()

    // Clean up startup timer if it exists
    if (this.startupTimerId) {
      managedClearTimer(this.startupTimerId)
      this.startupTimerId = undefined
    }

    // Cancel active sessions
    for (const [sessionId, session] of this.activeSessions) {
      if (session.status === 'running') {
        session.status = 'cancelled'
        logger.debug(`Cancelled active session: ${sessionId}`)
      }
    }

    // Close webhook server if running
    if (this.webhookServer) {
      try {
        this.webhookServer.close(() => {
          logger.debug('Webhook server closed')
        })
        this.webhookServer = undefined
      }
      catch (error) {
        logger.error('Error closing webhook server:', error)
      }
    }

    logger.info('Discovery scheduler stopped')
  }

  /**
   * Trigger manual discovery
   */
  async triggerDiscovery(
    trigger: DiscoveryTrigger,
    reason: string = 'Manual trigger',
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

      // n8n API must be configured for discovery
      if (!config.n8nApiUrl || !config.n8nApiKey) {
        throw new Error('Discovery requires n8n API configuration (N8N_API_URL and N8N_API_KEY)')
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
        .then(() => {
          // Cleanup completed session after 5 minutes
          managedSetTimeout(() => {
            this.activeSessions.delete(sessionId)
          }, 5 * 60 * 1000, `DiscoveryScheduler:cleanup-success-${sessionId}`)
        })
        .catch((error) => {
          logger.error(`Discovery session ${sessionId} failed:`, error)
          sessionStatus.status = 'failed'
          // Cleanup failed session after 1 minute
          managedSetTimeout(() => {
            this.activeSessions.delete(sessionId)
          }, 60 * 1000, `DiscoveryScheduler:cleanup-failed-${sessionId}`)
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
      for (const timerId of this.scheduledJobs.values()) {
        managedClearTimer(timerId)
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
        'full',
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
          memoryUsed,
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

    const scheduleNext = (): void => {
      const timer = managedSetTimeout(() => {
        if (this.isRunning && this.config.enabled) {
          this.triggerDiscovery('scheduled', `Periodic discovery (${this.config.intervalMinutes}m interval)`)
          scheduleNext() // Schedule the next one
        }
      }, intervalMs, 'DiscoveryScheduler:periodic-discovery')

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

    const scheduleNext = (): void => {
      const timer = managedSetTimeout(() => {
        if (this.isRunning && this.config.versionDetection) {
          this.checkVersionChanges()
          scheduleNext() // Schedule the next check
        }
      }, intervalMs, 'DiscoveryScheduler:version-detection')

      this.scheduledJobs.set('version-detection', timer)
    }

    scheduleNext()
    logger.info('Scheduled version detection', { intervalMinutes: this.config.versionCheckMinutes })
  }

  /**
   * Check for n8n and server version changes
   */
  private async checkVersionChanges(): Promise<void> {
    try {
      // Check n8n version changes (existing functionality)
      if (config.n8nApiUrl && config.n8nApiKey) {
        await this.checkN8nVersionChanges()
      }

      // Check n8n-mcp-modern server updates (new functionality)
      await this.checkServerUpdates()
    }
    catch (error) {
      logger.error('Version change detection failed:', error)
    }
  }

  /**
   * Check for n8n version changes (existing functionality)
   */
  private async checkN8nVersionChanges(): Promise<void> {
    try {
      logger.debug('Checking for n8n version changes...')

      // Get current version from n8n API
      const currentVersion = await this.getCurrentN8nVersion()
      if (!currentVersion) {
        return
      }

      // Get registered instances
      const instances = await this.versionManager.getActiveInstances()

      for (const instance of instances) {
        if (instance.version !== currentVersion) {
          logger.info('Detected n8n version change', {
            instanceId: instance.id,
            oldVersion: instance.version,
            newVersion: currentVersion,
          })

          // Register version change (sequential by design for version tracking integrity)
          // eslint-disable-next-line no-await-in-loop
          await this.versionManager.detectVersionChange(instance.id, currentVersion)

          // Trigger rediscovery
          this.triggerDiscovery('version_change', `n8n version change: ${instance.version} → ${currentVersion}`)
        }
      }
    }
    catch (error) {
      logger.error('n8n version change detection failed:', error)
    }
  }

  /**
   * Check for n8n-mcp-modern server updates
   */
  private async checkServerUpdates(): Promise<void> {
    try {
      logger.debug('Checking for n8n-mcp-modern server updates...')

      const updateInfo = await this.getServerUpdateInfo()
      if (!updateInfo) {
        return
      }

      if (updateInfo.updateAvailable) {
        logger.info('n8n-mcp-modern server update available', {
          currentVersion: updateInfo.currentVersion,
          latestVersion: updateInfo.latestVersion,
          updateAvailable: true,
        })

        // Store update notification (could be used by MCP tools or agents)
        await this.storeUpdateNotification(updateInfo)
      }
      else {
        logger.debug('n8n-mcp-modern server is up to date', {
          currentVersion: updateInfo.currentVersion,
          latestVersion: updateInfo.latestVersion,
        })
      }
    }
    catch (error) {
      logger.error('Server update check failed:', error)
    }
  }

  /**
   * Get current n8n version from API
   */
  private async getCurrentN8nVersion(): Promise<string | null> {
    try {
      // Get n8n version from API
      const { simpleN8nApi } = await import('../n8n/simple-api.js')
      if (!simpleN8nApi) {
        throw new Error('n8n API not available for version detection')
      }

      const versionInfo = await simpleN8nApi.getVersion()
      return (versionInfo as { version?: string })?.version || '1.0.0'
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

    const timer = managedSetTimeout(() => {
      if (this.isRunning && this.config.enabled) {
        this.triggerDiscovery('scheduled', `Adaptive discovery (${adaptiveInterval}m interval)`)
      }
    }, adaptiveInterval * 60 * 1000, 'DiscoveryScheduler:adaptive-discovery')

    // Replace existing adaptive timer
    if (this.scheduledJobs.has('adaptive-discovery')) {
      const existingTimerId = this.scheduledJobs.get('adaptive-discovery')
      if (existingTimerId) {
        managedClearTimer(existingTimerId)
      }
    }
    this.scheduledJobs.set('adaptive-discovery', timer)

    logger.debug('Scheduled adaptive discovery', {
      intervalMinutes: adaptiveInterval,
      reason: changesDetected ? 'changes detected' : 'no changes detected',
    })
  }

  /**
   * Initialize lightweight webhook server for discovery triggers
   */
  private async initializeWebhookServer(): Promise<void> {
    try {
      // Create simple HTTP server for webhooks using native Node.js
      const { createServer } = await import('node:http')

      const server = createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/webhook/discovery') {
          this.handleWebhookRequest(req, res)
        }
        else if (req.method === 'GET' && req.url === '/webhook/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'ok', webhooks: true }))
        }
        else {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Not found' }))
        }
      })

      server.listen(this.config.webhookPort, () => {
        logger.info(`Discovery webhook server listening on port ${this.config.webhookPort}`)
      })

      // Store server reference for cleanup
      this.webhookServer = server
    }
    catch (error) {
      logger.error('Failed to initialize webhook server:', error)
    }
  }

  /**
   * Handle incoming webhook requests
   */
  private async handleWebhookRequest(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): Promise<void> {
    try {
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })

      req.on('end', () => {
        try {
          const payload = JSON.parse(body)

          // Verify webhook secret if configured
          if (this.config.webhookSecret) {
            const signature = req.headers['x-webhook-signature']
            if (!this.verifyWebhookSignature(body, String(signature || ''))) {
              res.writeHead(401, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Invalid signature' }))
              return
            }
          }

          // Trigger discovery based on webhook payload
          const trigger = payload.trigger || 'manual'
          const reason = payload.reason || `Webhook trigger: ${payload.event || 'unknown'}`

          this.triggerDiscovery(trigger, reason)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            success: true,
            message: 'Discovery triggered successfully',
            trigger,
            reason,
          }))
        }
        catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }))
        }
      })
    }
    catch (error) {
      logger.error('Webhook request handling failed:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  }

  /**
   * Verify webhook signature for security
   */
  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  /**
   * Verify webhook signature with timing attack protection
   */
  private verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.config.webhookSecret || !signature) {
      logger.warn('Webhook signature verification failed: missing secret or signature')
      return false
    }

    // Normalize and validate signature format
    const normalizedSignature = signature.trim().toLowerCase()
    if (!normalizedSignature.startsWith('sha256=')) {
      logger.warn('Webhook signature verification failed: invalid signature format')
      return false
    }

    try {
      const secret = this.config.webhookSecret
      if (secret.length < 32) {
        logger.error('Webhook secret too short (minimum 32 characters required)')
        return false
      }

      const expectedSignature = `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`
      const providedSignature = normalizedSignature

      // Use constant-time comparison to prevent timing attacks
      const isValid = this.constantTimeCompare(expectedSignature, providedSignature)

      if (!isValid) {
        logger.warn('Webhook signature verification failed: signature mismatch', {
          expectedLength: expectedSignature.length,
          providedLength: providedSignature.length,
          bodyLength: body.length,
        })
      }

      return isValid
    }
    catch (error) {
      logger.error('Webhook signature verification failed with error:', error)
      return false
    }
  }

  /**
   * Initialize smart intervals based on n8n activity monitoring
   */
  private initializeSmartIntervals(): void {
    logger.info('Initializing smart interval monitoring')

    // Monitor n8n activity periodically
    const activityCheckInterval = Math.floor(this.config.activityWindowMinutes / 2) * 60 * 1000

    const checkActivity = async (): Promise<void> => {
      if (!this.isRunning || !this.config.smartIntervals) {
        return
      }

      try {
        const isHighActivity = await this.detectHighActivity()

        if (isHighActivity && !this.isHighActivityMode) {
          logger.info('High n8n activity detected - switching to frequent discovery')
          this.isHighActivityMode = true
          this.scheduleSmartDiscovery()
        }
        else if (!isHighActivity && this.isHighActivityMode) {
          logger.info('n8n activity normalized - switching to normal discovery')
          this.isHighActivityMode = false
          this.scheduleSmartDiscovery()
        }
      }
      catch (error) {
        logger.error('Activity detection failed:', error)
      }

      // Schedule next activity check
      managedSetTimeout(checkActivity, activityCheckInterval, 'DiscoveryScheduler:activity-check')
    }

    // Start activity monitoring
    managedSetTimeout(checkActivity, activityCheckInterval, 'DiscoveryScheduler:activity-start')
  }

  /**
   * Detect high activity based on recent n8n operations
   */
  private async detectHighActivity(): Promise<boolean> {
    try {
      // This would check for:
      // - Recent workflow executions
      // - New workflow creations
      // - Credential changes
      // For now, return false as placeholder

      // Get recent execution activity from n8n API
      const { simpleN8nApi } = await import('../n8n/simple-api.js')
      if (!simpleN8nApi) {
        return false
      }

      // Check for recent workflow executions (using a sample workflow ID)
      const workflows = await simpleN8nApi.getWorkflows()
      if (!Array.isArray(workflows) || workflows.length === 0) {
        return false
      }

      const sampleWorkflowId = workflows[0]?.id?.toString()
      if (!sampleWorkflowId) {
        return false
      }

      const recentExecutions = await simpleN8nApi.getExecutions(sampleWorkflowId)
      const recentCount = Array.isArray(recentExecutions) ? recentExecutions.length : 0

      // Consider high activity if more than 10 executions in recent period
      return recentCount > 10
    }
    catch (error) {
      logger.error('High activity detection failed:', error)
      return false
    }
  }

  /**
   * Schedule discovery based on current activity mode
   */
  private scheduleSmartDiscovery(): void {
    // Cancel existing smart discovery timer
    if (this.scheduledJobs.has('smart-discovery')) {
      const existingTimerId = this.scheduledJobs.get('smart-discovery')
      if (existingTimerId) {
        managedClearTimer(existingTimerId)
      }
      this.scheduledJobs.delete('smart-discovery')
    }

    const intervalMinutes = this.isHighActivityMode
      ? this.config.highActivityIntervalMinutes
      : this.config.intervalMinutes

    const timer = managedSetTimeout(() => {
      if (this.isRunning && this.config.smartIntervals) {
        const mode = this.isHighActivityMode ? 'high activity' : 'normal activity'
        this.triggerDiscovery('scheduled', `Smart discovery (${mode} mode)`)
        this.scheduleSmartDiscovery() // Schedule next
      }
    }, intervalMinutes * 60 * 1000, 'DiscoveryScheduler:smart-discovery')

    this.scheduledJobs.set('smart-discovery', timer)

    logger.debug('Scheduled smart discovery', {
      mode: this.isHighActivityMode ? 'high activity' : 'normal',
      intervalMinutes,
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
    webhookServer?: boolean
    smartIntervals?: boolean
    highActivityMode?: boolean
  } {
    const sessions = Array.from(this.activeSessions.values())

    return {
      isRunning: this.isRunning,
      config: this.config,
      activeSessions: sessions.filter(s => s.status === 'running').length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      failedSessions: sessions.filter(s => s.status === 'failed').length,
      scheduledJobs: Array.from(this.scheduledJobs.keys()),
      ...(this.config.webhooksEnabled && { webhookServer: Boolean(this.webhookServer) }),
      ...(this.config.smartIntervals && {
        smartIntervals: true,
        highActivityMode: this.isHighActivityMode,
      }),
    }
  }

  /**
   * Get server update information
   */
  private async getServerUpdateInfo(): Promise<{ currentVersion: string, latestVersion: string, updateAvailable: boolean } | null> {
    try {
      // Import necessary modules
      const { promises: fs } = await import('node:fs')
      const { spawn } = await import('node:child_process')
      const path = await import('node:path')

      // Helper function to execute commands
      const execCommand = (command: string, args: string[] = []): Promise<{ stdout: string, stderr: string, code: number }> => {
        return new Promise((resolve) => {
          const proc = spawn(command, args, { stdio: 'pipe' })
          let stdout = ''
          let stderr = ''

          if (proc.stdout) {
            proc.stdout.on('data', (data) => {
              stdout += data.toString()
            })
          }

          if (proc.stderr) {
            proc.stderr.on('data', (data) => {
              stderr += data.toString()
            })
          }

          proc.on('close', (code) => {
            resolve({ stdout, stderr, code: code || 0 })
          })

          proc.on('error', () => {
            resolve({ stdout, stderr, code: 1 })
          })
        })
      }

      // Get current version
      let currentVersion: string | null = null
      try {
        const packageJsonPath = path.resolve(__dirname, '../../package.json')
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
        currentVersion = packageJson.version
      }
      catch (error) {
        logger.warn('Could not read current version from package.json:', error)
        return null
      }

      // Get latest version from GitHub Packages
      let latestVersion: string | null = null
      try {
        const result = await execCommand('npm', [
          'view',
          '@eekfonky/n8n-mcp-modern',
          'version',
          '--registry=https://npm.pkg.github.com',
        ])

        if (result.code === 0 && result.stdout.trim()) {
          latestVersion = result.stdout.trim().replace(/['"]/g, '')
        }
      }
      catch (error) {
        logger.warn('Could not check latest version from GitHub Packages:', error)
        return null
      }

      if (!currentVersion || !latestVersion) {
        return null
      }

      return {
        currentVersion,
        latestVersion,
        updateAvailable: currentVersion !== latestVersion,
      }
    }
    catch (error) {
      logger.error('Failed to get server update info:', error)
      return null
    }
  }

  /**
   * Store update notification for later retrieval
   */
  private async storeUpdateNotification(updateInfo: { currentVersion: string, latestVersion: string, updateAvailable: boolean }): Promise<void> {
    try {
      // Store in database for persistence
      const database = await import('../database/index.js').then(m => m.database)

      database.executeCustomSQL('storeUpdateNotification', (db) => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO update_notifications (
            id, current_version, latest_version, update_available, detected_at, notified
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)

        stmt.run(
          'n8n-mcp-modern',
          updateInfo.currentVersion,
          updateInfo.latestVersion,
          updateInfo.updateAvailable ? 1 : 0,
          new Date().toISOString(),
          0,
        )

        return true
      })

      logger.debug('Stored update notification in database', updateInfo)
    }
    catch (error) {
      logger.error('Failed to store update notification:', error)
      // Non-critical error - continue execution
    }
  }
}
