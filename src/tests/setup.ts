/**
 * Vitest Test Setup
 * Global test configuration and utilities
 */

import process from 'node:process'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import { config } from '../server/config.js'
import { logger } from '../server/logger.js'

// Setup environment variables before importing config
vi.stubEnv('NODE_ENV', 'test')
vi.stubEnv('DATABASE_IN_MEMORY', 'true')
vi.stubEnv('ENABLE_CACHE', 'false')
vi.stubEnv('LOG_LEVEL', 'error')
vi.stubEnv('DISABLE_CONSOLE_OUTPUT', 'true')
vi.stubEnv('CACHE_TTL', '1')
vi.stubEnv('MAX_CONCURRENT_REQUESTS', '5')
vi.stubEnv('MCP_TIMEOUT', '5000')
vi.stubEnv('VALIDATION_TIMEOUT', '1000')
vi.stubEnv('MAX_RESPONSE_SIZE', '1048576')

// Global test environment setup
beforeAll(async () => {
  // Environment variables are already stubbed above before imports

  // Silence logger for tests
  vi.spyOn(logger, 'info').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  vi.spyOn(logger, 'debug').mockImplementation(() => {})

  // Mock timers for consistent testing
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'],
  })
})

afterAll(async () => {
  // Cleanup after all tests
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()

  // Final cleanup of all process event listeners
  const eventsToCleanup = ['SIGINT', 'SIGTERM', 'unhandledRejection', 'uncaughtException', 'warning', 'beforeExit']
  eventsToCleanup.forEach((event) => {
    process.removeAllListeners(event)
  })
})

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks()
})

afterEach(() => {
  // Cleanup after each test
  vi.clearAllTimers()

  // Clean up process event listeners to prevent EventEmitter memory leak warnings
  const signalEvents: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
  const processEvents = ['unhandledRejection', 'uncaughtException', 'warning', 'beforeExit']

  signalEvents.forEach((signal) => {
    const listeners = process.listeners(signal)
    listeners.forEach((listener) => {
      process.removeListener(signal, listener as (...args: unknown[]) => void)
    })
  })

  processEvents.forEach((event) => {
    if (event === 'warning') {
      const listeners = process.listeners('warning')
      listeners.forEach((listener) => {
        process.removeListener('warning', listener as (...args: unknown[]) => void)
      })
    }
    else if (event === 'beforeExit') {
      const listeners = process.listeners('beforeExit')
      listeners.forEach((listener) => {
        process.removeListener('beforeExit', listener as (...args: unknown[]) => void)
      })
    }
    else if (event === 'uncaughtException') {
      const listeners = process.listeners('uncaughtException')
      listeners.forEach((listener) => {
        process.removeListener('uncaughtException', listener as (...args: unknown[]) => void)
      })
    }
    else if (event === 'unhandledRejection') {
      const listeners = process.listeners('unhandledRejection')
      listeners.forEach((listener) => {
        process.removeListener('unhandledRejection', listener as (...args: unknown[]) => void)
      })
    }
  })
})

// Global test utilities
export const testUtils = {
  /**
   * Wait for next tick
   */
  nextTick: async (): Promise<void> => new Promise<void>((resolve) => {
    process.nextTick(resolve)
  }),

  /**
   * Wait for specified timeout
   */
  wait: async (ms: number): Promise<void> => new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  }),

  /**
   * Advance timers by specified amount
   */
  advanceTimers: (ms: number): void => {
    vi.advanceTimersByTime(ms)
  },

  /**
   * Mock implementation helper
   */
  // eslint-disable-next-line ts/no-explicit-any
  mockImplementation: <T extends (...args: any[]) => any>(
    fn: T,
    implementation: (...args: Parameters<T>) => ReturnType<T>,
  // eslint-disable-next-line ts/no-explicit-any
  ): any => {
    return vi.mocked(fn).mockImplementation(implementation)
  },

  /**
   * Create test configuration override
   */
  createTestConfig: (overrides: Partial<typeof config> = {}): typeof config => ({
    ...config,
    databaseInMemory: true,
    enableCache: false,
    logLevel: 'error' as const,
    disableConsoleOutput: true,
    nodeEnv: 'test' as const,
    ...overrides,
  }),

  /**
   * Create mock MCP request
   */
  // eslint-disable-next-line ts/no-explicit-any
  createMockRequest: (method: string, params: Record<string, unknown> = {}): any => ({
    jsonrpc: '2.0' as const,
    id: Math.random().toString(36).substring(7),
    method,
    params,
  }),

  /**
   * Create mock MCP response
   */
  // eslint-disable-next-line ts/no-explicit-any
  createMockResponse: (result: unknown, id?: string): any => ({
    jsonrpc: '2.0' as const,
    id: id || Math.random().toString(36).substring(7),
    result,
  }),

  /**
   * Create mock error response
   */
  // eslint-disable-next-line ts/no-explicit-any
  createMockError: (code: number, message: string, id?: string): any => ({
    jsonrpc: '2.0' as const,
    id: id || Math.random().toString(36).substring(7),
    error: {
      code,
      message,
    },
  }),
}

// Export type for test utilities
export type TestUtils = typeof testUtils

// Global types for better testing (moved to avoid vars-on-top lint error)
declare global {
  // eslint-disable-next-line vars-on-top
  var testUtils: TestUtils
}

// Make testUtils globally available
globalThis.testUtils = testUtils
