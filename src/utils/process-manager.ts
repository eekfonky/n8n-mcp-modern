/**
 * Process Lifecycle Management
 *
 * Manages child processes and ensures proper cleanup:
 * - Process tracking and monitoring
 * - Graceful shutdown handling
 * - Resource cleanup on exit
 * - Process health monitoring
 * - Automatic cleanup of orphaned processes
 */

import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { logger } from '../server/logger.js'
import { getHealthMonitor } from './health-monitor.js'
import { createSafeEnvironment, sanitizeCommandArgs, validateFilePath, validateNpmCommand } from './input-sanitizer.js'
import { managedClearTimer, managedSetInterval, managedSetTimeout } from './timer-manager.js'

export interface ProcessInfo {
  id: string
  pid: number
  command: string
  args: string[]
  startTime: Date
  status: 'running' | 'completed' | 'failed' | 'killed'
  exitCode?: number
  signal?: string | undefined
  stdout?: string
  stderr?: string
}

export interface ProcessOptions {
  timeout?: number
  killSignal?: NodeJS.Signals
  stdio?: 'pipe' | 'inherit' | 'ignore'
  cwd?: string
  env?: Record<string, string>
  maxBuffer?: number
}

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, { info: ProcessInfo, process: ChildProcess }>()
  private readonly MAX_PROCESSES = 20 // ✅ Prevent unbounded process map growth
  private cleanupHandlers: Array<() => Promise<void>> = []
  private isShuttingDown = false
  private shutdownTimeout = 5000 // 5 seconds graceful shutdown
  private monitoringInterval: string | undefined = undefined

  constructor() {
    super()
    this.setupSignalHandlers()
    this.startMonitoring()
  }

  /**
   * Execute a command with proper process management and security validation
   */
  async execute(
    command: string,
    args: string[] = [],
    options: ProcessOptions = {},
  ): Promise<{ stdout: string, stderr: string, code: number }> {
    if (this.isShuttingDown) {
      throw new Error('Process manager is shutting down')
    }

    // ✅ Enforce process limit to prevent resource exhaustion
    if (this.processes.size >= this.MAX_PROCESSES) {
      logger.warn(`Process limit reached (${this.MAX_PROCESSES}) - cleaning up oldest processes`)
      await this.cleanupOldestProcesses(this.MAX_PROCESSES / 2)
    }

    // Security validation
    const securityCheck = this.validateCommandSecurity(command, args, options)
    if (!securityCheck.isValid) {
      throw new Error(`Command rejected for security reasons: ${securityCheck.violations.join(', ')}`)
    }

    const processId = `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const timeout = options.timeout || 30000 // 30 second default timeout

    // Use sanitized args and environment
    const sanitizedArgs = securityCheck.sanitizedArgs
    const safeEnv = securityCheck.safeEnvironment

    logger.debug(`Starting process ${processId}`, {
      command,
      args: sanitizedArgs,
      violations: securityCheck.violations,
    })

    return new Promise((resolve, reject) => {
      const child = spawn(command, sanitizedArgs, {
        stdio: options.stdio || 'pipe',
        cwd: options.cwd || process.cwd(),
        env: safeEnv,
        ...options,
      })

      const processInfo: ProcessInfo = {
        id: processId,
        pid: child.pid!,
        command,
        args,
        startTime: new Date(),
        status: 'running',
        stdout: '',
        stderr: '',
      }

      this.processes.set(processId, { info: processInfo, process: child })

      let stdout = ''
      let stderr = ''
      let timeoutId: string | undefined

      // Set up timeout
      if (timeout > 0) {
        timeoutId = managedSetTimeout(() => {
          logger.warn(`Process ${processId} timed out after ${timeout}ms`)
          this.killProcess(processId, 'SIGTERM')
          reject(new Error(`Process timed out after ${timeout}ms`))
        }, timeout)
      }

      // Handle stdout
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const chunk = data.toString()
          stdout += chunk
          processInfo.stdout = stdout

          // Prevent memory exhaustion from large outputs
          if (stdout.length > (options.maxBuffer || 1024 * 1024)) { // 1MB default
            logger.warn(`Process ${processId} output exceeded buffer limit`)
            this.killProcess(processId, 'SIGTERM')
            reject(new Error('Process output exceeded buffer limit'))
          }
        })
      }

      // Handle stderr
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const chunk = data.toString()
          stderr += chunk
          processInfo.stderr = stderr
        })
      }

      // Handle process completion
      child.on('close', (code, signal) => {
        if (timeoutId) {
          managedClearTimer(timeoutId)
        }

        processInfo.status = code === 0 ? 'completed' : 'failed'
        processInfo.exitCode = code || 0
        processInfo.signal = signal || undefined

        this.processes.delete(processId)

        logger.debug(`Process ${processId} completed`, {
          code,
          signal,
          duration: Date.now() - processInfo.startTime.getTime(),
        })

        this.emit('processCompleted', processInfo)

        if (code === 0) {
          resolve({ stdout, stderr, code })
        }
        else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`))
        }
      })

      // Handle process errors
      child.on('error', (error) => {
        if (timeoutId) {
          managedClearTimer(timeoutId)
        }

        processInfo.status = 'failed'
        this.processes.delete(processId)

        logger.error(`Process ${processId} error:`, error)
        this.emit('processError', processInfo, error)
        reject(error)
      })

      this.emit('processStarted', processInfo)
    })
  }

  /**
   * Kill a specific process
   */
  killProcess(processId: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const entry = this.processes.get(processId)
    if (!entry) {
      return false
    }

    const { info, process: child } = entry

    try {
      child.kill(signal)
      info.status = 'killed'
      info.signal = signal

      logger.info(`Killed process ${processId} with signal ${signal}`)
      this.emit('processKilled', info)

      // Remove from tracking after a delay to allow cleanup
      managedSetTimeout(() => {
        this.processes.delete(processId)
      }, 1000, 'process-manager:timer')

      return true
    }
    catch (error) {
      logger.error(`Failed to kill process ${processId}:`, error)
      return false
    }
  }

  /**
   * Kill all running processes
   */
  killAllProcesses(signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    const processIds = Array.from(this.processes.keys())

    logger.info(`Killing ${processIds.length} running processes`)

    const killPromises = processIds.map(id =>
      new Promise<void>((resolve) => {
        this.killProcess(id, signal)
        // Give each process 1 second to cleanup
        managedSetTimeout(resolve, 1000, 'process-manager:timer')
      }),
    )

    return Promise.all(killPromises).then(() => {})
  }

  /**
   * Get information about running processes
   */
  getRunningProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values()).map(entry => ({ ...entry.info }))
  }

  /**
   * Get process by ID
   */
  getProcess(processId: string): ProcessInfo | null {
    const entry = this.processes.get(processId)
    return entry ? { ...entry.info } : null
  }

  /**
   * Add cleanup handler
   */
  addCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler)
  }

  /**
   * Start monitoring for orphaned processes
   */
  private startMonitoring(): void {
    this.monitoringInterval = managedSetInterval(() => {
      this.cleanupOrphanedProcesses()
    }, 30000, 'process-manager:interval') // Check every 30 seconds
  }

  /**
   * Clean up orphaned processes
   */
  private cleanupOrphanedProcesses(): void {
    const now = Date.now()
    const orphanThreshold = 5 * 60 * 1000 // 5 minutes

    for (const [id, { info, process: child }] of this.processes) {
      const age = now - info.startTime.getTime()

      if (age > orphanThreshold && info.status === 'running') {
        logger.warn(`Cleaning up orphaned process ${id}`, {
          pid: info.pid,
          age: Math.floor(age / 1000),
          command: info.command,
        })

        this.killProcess(id, 'SIGKILL')
      }
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT']

    signals.forEach((signal) => {
      process.on(signal, async () => {
        if (this.isShuttingDown) {
          logger.warn(`Received ${signal} during shutdown - forcing exit`)
          process.exit(1)
        }

        logger.info(`Received ${signal} - starting graceful shutdown`)
        await this.gracefulShutdown()
      })
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception:', error)
      await this.gracefulShutdown()
      process.exit(1)
    })

    // Handle unhandled rejections
    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection:', { reason, promise })
      await this.gracefulShutdown()
      process.exit(1)
    })
  }

  /**
   * Perform graceful shutdown
   */
  async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    logger.info('Starting graceful shutdown')

    // Stop monitoring
    if (this.monitoringInterval) {
      managedClearTimer(this.monitoringInterval)
    }

    // Run cleanup handlers
    const cleanupPromises = this.cleanupHandlers.map(async (handler) => {
      try {
        await handler()
      }
      catch (error) {
        logger.error('Cleanup handler failed:', error)
      }
    })

    // Kill all processes
    const killPromise = this.killAllProcesses('SIGTERM')

    // Set a timeout for forceful shutdown
    const timeoutPromise = new Promise<void>((resolve) => {
      managedSetTimeout(() => {
        logger.warn('Graceful shutdown timeout - forcing exit')
        this.killAllProcesses('SIGKILL')
        resolve()
      }, this.shutdownTimeout, 'process-manager:timer')
    })

    try {
      await Promise.race([
        Promise.all([...cleanupPromises, killPromise]),
        timeoutPromise,
      ])
    }
    catch (error) {
      logger.error('Error during graceful shutdown:', error)
    }

    logger.info('Graceful shutdown completed')
  }

  /**
   * Validate command security before execution
   */
  private validateCommandSecurity(
    command: string,
    args: string[],
    options: ProcessOptions,
  ): {
    isValid: boolean
    violations: string[]
    sanitizedArgs: string[]
    safeEnvironment: Record<string, string>
  } {
    const violations: string[] = []

    // Validate command
    const allowedCommands = ['npm', 'node', 'git', 'cp', 'df', 'ls', 'mkdir', 'rm', 'cat', 'head', 'tail']
    if (!allowedCommands.includes(command)) {
      violations.push(`Command '${command}' not in allowlist`)
    }

    // Sanitize arguments
    const argResult = sanitizeCommandArgs(args)
    violations.push(...argResult.violations)

    // Special validation for npm commands
    if (command === 'npm') {
      const npmValidation = validateNpmCommand(args[0] || '', args.slice(1))
      if (!npmValidation.isValid) {
        violations.push(...npmValidation.violations)
      }
    }

    // Validate file paths if present
    for (const arg of args) {
      if (arg.includes('/') || arg.includes('\\')) {
        const pathValidation = validateFilePath(arg)
        if (!pathValidation.isValid) {
          violations.push(...pathValidation.violations)
        }
      }
    }

    // Create safe environment
    const safeEnvironment = createSafeEnvironment(options.env || {})

    return {
      isValid: violations.length === 0,
      violations,
      sanitizedArgs: argResult.sanitized,
      safeEnvironment,
    }
  }

  /**
   * Clean up oldest processes to maintain resource limits
   */
  private async cleanupOldestProcesses(count: number): Promise<void> {
    const sortedProcesses = Array.from(this.processes.entries())
      .sort(([, a], [, b]) => a.info.startTime.getTime() - b.info.startTime.getTime())

    const toCleanup = sortedProcesses.slice(0, count)

    for (const [id, { info }] of toCleanup) {
      if (info.status === 'running') {
        logger.info(`Cleaning up old process: ${id} (${info.command})`)
        this.killProcess(id, 'SIGTERM')
      }
      else {
        this.processes.delete(id)
      }
    }
  }

  /**
   * Check if the manager is healthy
   */
  isHealthy(): boolean {
    const runningProcesses = this.getRunningProcesses()
    const healthMonitor = getHealthMonitor()

    // Check for too many running processes
    if (runningProcesses.length > 10) {
      return false
    }

    // Check overall system health
    return healthMonitor.isHealthy()
  }

  /**
   * Get statistics
   */
  getStats() {
    const runningProcesses = this.getRunningProcesses()

    return {
      totalProcesses: runningProcesses.length,
      runningTime: runningProcesses.reduce((total, proc) => {
        return total + (Date.now() - proc.startTime.getTime())
      }, 0),
      cleanupHandlers: this.cleanupHandlers.length,
      isShuttingDown: this.isShuttingDown,
    }
  }
}

// Global process manager instance
let _processManager: ProcessManager | null = null

export function getProcessManager(): ProcessManager {
  if (!_processManager) {
    _processManager = new ProcessManager()
  }
  return _processManager
}

// Enhanced execCommand function with process management
export async function execCommand(
  command: string,
  args: string[] = [],
  options: ProcessOptions = {},
): Promise<{ stdout: string, stderr: string, code: number }> {
  const manager = getProcessManager()
  return manager.execute(command, args, options)
}
