#!/usr/bin/env node

/**
 * Structured logging utility for n8n-MCP Modern scripts
 * Provides consistent, structured logging across all JavaScript files
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

/**
 * Log levels with numeric values for filtering
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SUCCESS: 4,
}

/**
 * Create a structured logger instance
 */
export function createLogger(context = 'general', options = {}) {
  const {
    level = LogLevel.INFO,
    includeTimestamp = true,
    includeContext = true,
    writeToFile = false,
    logFile = null,
  } = options

  // Ensure log directory exists if file logging is enabled
  if (writeToFile && logFile) {
    const logDir = dirname(logFile)
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
  }

  const formatMessage = (message, logLevel, metadata = {}) => {
    const parts = []

    if (includeTimestamp) {
      parts.push(`[${new Date().toISOString()}]`)
    }

    parts.push(`[${Object.keys(LogLevel)[logLevel]}]`)

    if (includeContext) {
      parts.push(`[${context}]`)
    }

    parts.push(message)

    // Add metadata if provided
    if (Object.keys(metadata).length > 0) {
      parts.push(JSON.stringify(metadata))
    }

    return parts.join(' ')
  }

  const writeLog = (formattedMessage, logLevel) => {
    // Always write to console
    const emoji = getLogEmoji(logLevel)
    console.log(`${emoji} ${formattedMessage}`)

    // Write to file if configured
    if (writeToFile && logFile) {
      try {
        writeFileSync(logFile, `${formattedMessage}\n`, { flag: 'a' })
      }
      catch (error) {
        console.error('Failed to write to log file:', error.message)
      }
    }
  }

  const shouldLog = logLevel => logLevel >= level

  return {
    debug: (message, metadata) => {
      if (shouldLog(LogLevel.DEBUG)) {
        writeLog(formatMessage(message, LogLevel.DEBUG, metadata), LogLevel.DEBUG)
      }
    },

    info: (message, metadata) => {
      if (shouldLog(LogLevel.INFO)) {
        writeLog(formatMessage(message, LogLevel.INFO, metadata), LogLevel.INFO)
      }
    },

    warn: (message, metadata) => {
      if (shouldLog(LogLevel.WARN)) {
        writeLog(formatMessage(message, LogLevel.WARN, metadata), LogLevel.WARN)
      }
    },

    error: (message, metadata) => {
      if (shouldLog(LogLevel.ERROR)) {
        writeLog(formatMessage(message, LogLevel.ERROR, metadata), LogLevel.ERROR)
      }
    },

    success: (message, metadata) => {
      if (shouldLog(LogLevel.SUCCESS)) {
        writeLog(formatMessage(message, LogLevel.SUCCESS, metadata), LogLevel.SUCCESS)
      }
    },

    // Convenience method for logging with custom level
    log: (message, logLevel = LogLevel.INFO, metadata) => {
      if (shouldLog(logLevel)) {
        writeLog(formatMessage(message, logLevel, metadata), logLevel)
      }
    },
  }
}

/**
 * Get emoji for log level
 */
function getLogEmoji(logLevel) {
  switch (logLevel) {
    case LogLevel.DEBUG:
      return '🔍'
    case LogLevel.INFO:
      return 'ℹ️'
    case LogLevel.WARN:
      return '⚠️'
    case LogLevel.ERROR:
      return '❌'
    case LogLevel.SUCCESS:
      return '✅'
    default:
      return '📝'
  }
}

/**
 * Create a logger specifically for script execution
 */
export function createScriptLogger(scriptName, options = {}) {
  const defaultLogFile = join(homedir(), '.n8n-mcp-modern', 'logs', `${scriptName}.log`)

  return createLogger(scriptName, {
    writeToFile: true,
    logFile: defaultLogFile,
    ...options,
  })
}

/**
 * Default logger instance for quick usage
 */
export const logger = createLogger('n8n-mcp-modern')

/**
 * Performance timing utility
 */
export function createTimer(logger, operation) {
  const start = process.hrtime.bigint()

  return {
    end: () => {
      const end = process.hrtime.bigint()
      const duration = Number(end - start) / 1000000 // Convert to milliseconds
      logger.info(`${operation} completed`, { duration: `${duration.toFixed(2)}ms` })
      return duration
    },
  }
}

/**
 * Error logging with stack trace
 */
export function logError(logger, error, context = '') {
  const metadata = {
    error: error.name,
    stack: error.stack?.split('\n').slice(0, 3).join(' | '), // First 3 lines
    context,
  }

  logger.error(error.message, metadata)
}

/**
 * Environment variable logging (sanitized)
 */
export function logEnvironment(logger, envVars = {}) {
  const sanitized = {}

  for (const [key, value] of Object.entries(envVars)) {
    const keyLower = key.toLowerCase()
    
    // Enhanced security patterns for sensitive data detection
    if (keyLower.includes('key') || 
        keyLower.includes('token') || 
        keyLower.includes('secret') ||
        keyLower.includes('password') ||
        keyLower.includes('auth') ||
        keyLower.includes('api_key') ||
        keyLower.includes('credential')) {
      
      // Only show last 4 characters if value exists and is long enough
      if (value && typeof value === 'string' && value.length >= 8) {
        sanitized[key] = `***${value.slice(-4)}`
      } else {
        sanitized[key] = value ? '***HIDDEN***' : 'not-set'
      }
    }
    else {
      // Still sanitize other values to prevent log injection
      if (typeof value === 'string') {
        sanitized[key] = value.replace(/[\r\n\t]/g, ' ').substring(0, 200) || 'not-set'
      } else {
        sanitized[key] = value || 'not-set'
      }
    }
  }

  logger.info('Environment variables loaded', sanitized)
}
