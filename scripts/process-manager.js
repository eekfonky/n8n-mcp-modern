#!/usr/bin/env node

/**
 * Process management utilities for n8n-MCP Modern scripts
 * Handles graceful shutdowns, error recovery, and process monitoring
 */

import process from 'node:process'
import { createLogger } from './logger.js'

const logger = createLogger('process-manager')

/**
 * Setup graceful shutdown handling
 */
export function setupGracefulShutdown(cleanupCallback = null) {
  let isShuttingDown = false

  const gracefulShutdown = (signal) => {
    if (isShuttingDown) {
      logger.warn('Force shutdown - previous shutdown still in progress')
      process.exit(1)
    }

    isShuttingDown = true
    logger.info(`Received ${signal}. Starting graceful shutdown...`)

    // Set a timeout to force exit if cleanup takes too long
    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout - forcing exit')
      process.exit(1)
    }, 10000) // 10 seconds timeout

    Promise.resolve()
      .then(() => {
        if (cleanupCallback && typeof cleanupCallback === 'function') {
          return cleanupCallback()
        }
      })
      .then(() => {
        clearTimeout(forceExitTimeout)
        logger.success('Graceful shutdown completed')
        process.exit(0)
      })
      .catch((error) => {
        clearTimeout(forceExitTimeout)
        logger.error('Error during graceful shutdown', { error: error.message })
        process.exit(1)
      })
  }

  // Handle different signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

  // Handle Windows signals
  if (process.platform === 'win32') {
    process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'))
  }

  logger.info('Graceful shutdown handlers registered')
}

/**
 * Setup global error handlers
 */
export function setupErrorHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception detected', {
      error: error.name,
      message: error.message,
      stack: error.stack?.split('\\n').slice(0, 5).join(' | '),
    })

    // Give time for logging then exit
    setTimeout(() => {
      process.exit(1)
    }, 100)
  })

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection detected', {
      reason: reason?.toString() || 'Unknown reason',
      promise: promise?.toString() || 'Unknown promise',
    })

    // Give time for logging then exit
    setTimeout(() => {
      process.exit(1)
    }, 100)
  })

  process.on('warning', (warning) => {
    logger.warn('Process Warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack?.split('\\n').slice(0, 3).join(' | '),
    })
  })

  logger.info('Global error handlers registered')
}

/**
 * Monitor process resources and log warnings
 */
export function setupResourceMonitoring(options = {}) {
  const {
    memoryThreshold = 500 * 1024 * 1024, // 500MB
    interval = 30000, // 30 seconds
    enabled = true,
  } = options

  if (!enabled)
    return

  const monitorInterval = setInterval(() => {
    const usage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    if (usage.heapUsed > memoryThreshold) {
      logger.warn('High memory usage detected', {
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      })
    }

    logger.debug('Resource usage', {
      memory: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      cpu: {
        user: Math.round(cpuUsage.user / 1000),
        system: Math.round(cpuUsage.system / 1000),
      },
    })
  }, interval)

  // Clear interval on shutdown
  process.on('exit', () => {
    clearInterval(monitorInterval)
  })

  logger.info('Resource monitoring started', {
    memoryThreshold: `${Math.round(memoryThreshold / 1024 / 1024)}MB`,
    interval: `${interval / 1000}s`,
  })
}

/**
 * Environment validation
 */
export function validateEnvironment(requiredVars = []) {
  const missing = []
  const warnings = []

  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (!value) {
      missing.push(varName)
    }
    else if (value === 'your-api-key' || value === 'https://your-n8n-instance.com') {
      warnings.push(varName)
    }
  }

  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing })
    return false
  }

  if (warnings.length > 0) {
    logger.warn('Environment variables using placeholder values', { warnings })
  }

  logger.info('Environment validation passed')
  return true
}

/**
 * Process health check
 */
export function performHealthCheck() {
  const health = {
    pid: process.pid,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  }

  logger.info('Process health check', health)
  return health
}

/**
 * Setup complete process management
 */
export function initializeProcessManager(options = {}) {
  const {
    enableGracefulShutdown = true,
    enableErrorHandlers = true,
    enableResourceMonitoring = false,
    cleanupCallback = null,
    requiredEnvVars = [],
    monitoringOptions = {},
  } = options

  logger.info('Initializing process manager')

  // Validate environment first
  if (requiredEnvVars.length > 0) {
    if (!validateEnvironment(requiredEnvVars)) {
      logger.error('Environment validation failed - exiting')
      process.exit(1)
    }
  }

  // Setup error handling
  if (enableErrorHandlers) {
    setupErrorHandlers()
  }

  // Setup graceful shutdown
  if (enableGracefulShutdown) {
    setupGracefulShutdown(cleanupCallback)
  }

  // Setup resource monitoring
  if (enableResourceMonitoring) {
    setupResourceMonitoring(monitoringOptions)
  }

  // Perform initial health check
  performHealthCheck()

  logger.success('Process manager initialized successfully')
}

/**
 * Exit with proper logging and cleanup
 */
export function exitProcess(code = 0, message = null, cleanup = null) {
  if (message) {
    if (code === 0) {
      logger.success(message)
    }
    else {
      logger.error(message)
    }
  }

  if (cleanup && typeof cleanup === 'function') {
    try {
      cleanup()
    }
    catch (error) {
      logger.error('Error during cleanup', { error: error.message })
    }
  }

  logger.info(`Process exiting with code ${code}`)
  process.exit(code)
}
