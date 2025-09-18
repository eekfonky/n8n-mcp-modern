/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascade failures and resource exhaustion by:
 * - Monitoring failure rates
 * - Opening circuit when threshold exceeded
 * - Providing fallback responses
 * - Self-healing with periodic health checks
 */

import { logger } from '../server/logger.js'
import { managedSetTimeout } from './timer-manager.js'

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  failureThreshold: number // Number of failures before opening
  resetTimeout: number // Time in ms before trying to close circuit
  timeout: number // Request timeout in ms
  monitoringWindow: number // Time window for monitoring failures
  volumeThreshold: number // Minimum requests before evaluating
}

export interface CircuitBreakerMetrics {
  state: CircuitState
  failureCount: number
  successCount: number
  totalRequests: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  nextAttemptTime?: Date
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private totalRequests = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private nextAttemptTime?: Date | undefined
  private requestWindow: Date[] = []

  constructor(
    private name: string,
    private config: CircuitBreakerConfig,
    private fallbackFn?: () => Promise<any>,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.canAttemptReset()) {
        this.state = 'HALF_OPEN'
        logger.info(`Circuit breaker ${this.name} moving to HALF_OPEN state`)
      }
      else {
        logger.warn(`Circuit breaker ${this.name} is OPEN - using fallback`)
        if (this.fallbackFn) {
          return await this.fallbackFn()
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN`)
      }
    }

    const startTime = Date.now()
    this.totalRequests++
    this.cleanupOldRequests()

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        managedSetTimeout(() => reject(new Error('Request timeout')), this.config.timeout, 'circuit-breaker:timer')
      })

      const result = await Promise.race([fn(), timeoutPromise])

      this.onSuccess()
      return result
    }
    catch (error: unknown) {
      this.onFailure()
      // ✅ Type-safe error re-throwing
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Circuit breaker execution failed: ${String(error)}`)
    }
  }

  private onSuccess(): void {
    this.successCount++
    this.lastSuccessTime = new Date()
    this.requestWindow.push(new Date())

    if (this.state === 'HALF_OPEN') {
      this.reset()
      logger.info(`Circuit breaker ${this.name} reset to CLOSED state`)
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = new Date()
    this.requestWindow.push(new Date())

    if (this.shouldOpenCircuit()) {
      this.open()
    }
  }

  private shouldOpenCircuit(): boolean {
    if (this.requestWindow.length < this.config.volumeThreshold) {
      return false
    }

    const failureRate = this.failureCount / this.totalRequests
    return failureRate >= (this.config.failureThreshold / 100)
  }

  private open(): void {
    this.state = 'OPEN'
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout)
    logger.warn(`Circuit breaker ${this.name} opened`, {
      failureCount: this.failureCount,
      totalRequests: this.totalRequests,
      nextAttempt: this.nextAttemptTime,
    })
  }

  private reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.totalRequests = 0
    this.nextAttemptTime = undefined
    this.requestWindow.length = 0 // ✅ Reuse existing array instead of creating new one
  }

  private canAttemptReset(): boolean {
    return this.nextAttemptTime ? Date.now() >= this.nextAttemptTime.getTime() : false
  }

  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.config.monitoringWindow
    this.requestWindow = this.requestWindow.filter(time => time.getTime() > cutoff)
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      ...(this.lastFailureTime && { lastFailureTime: this.lastFailureTime }),
      ...(this.lastSuccessTime && { lastSuccessTime: this.lastSuccessTime }),
      ...(this.nextAttemptTime && { nextAttemptTime: this.nextAttemptTime }),
    }
  }

  // Manual control methods
  forceOpen(): void {
    this.state = 'OPEN'
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout)
    logger.warn(`Circuit breaker ${this.name} manually opened`)
  }

  forceClose(): void {
    this.reset()
    logger.info(`Circuit breaker ${this.name} manually closed`)
  }
}

// Default configurations for different services
export const CircuitBreakerConfigs = {
  n8nApi: {
    failureThreshold: 50, // 50% failure rate
    resetTimeout: 30000, // 30 seconds
    timeout: 10000, // 10 seconds
    monitoringWindow: 60000, // 1 minute
    volumeThreshold: 5, // Minimum 5 requests
  },
  discovery: {
    failureThreshold: 30, // 30% failure rate
    resetTimeout: 60000, // 1 minute
    timeout: 30000, // 30 seconds
    monitoringWindow: 300000, // 5 minutes
    volumeThreshold: 3, // Minimum 3 requests
  },
  database: {
    failureThreshold: 20, // 20% failure rate
    resetTimeout: 15000, // 15 seconds
    timeout: 5000, // 5 seconds
    monitoringWindow: 30000, // 30 seconds
    volumeThreshold: 10, // Minimum 10 requests
  },
} as const

// Circuit breaker registry
const circuitBreakers = new Map<string, CircuitBreaker>()

export function getCircuitBreaker(
  name: string,
  config: CircuitBreakerConfig,
  fallbackFn?: () => Promise<any>,
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, config, fallbackFn))
  }
  return circuitBreakers.get(name)!
}

export function getAllCircuitBreakers(): Map<string, CircuitBreaker> {
  return circuitBreakers
}
