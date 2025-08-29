import type { Config } from '../types/fast-types.js'
import process from 'node:process'

import { config as dotenvConfig } from 'dotenv'
import { z } from 'zod'
import { ConfigSchema } from '../types/fast-types.js'

// Load environment variables (quiet: true to maintain v16 behavior in v17)
dotenvConfig({ quiet: true })

// TypeScript 5.9+ const type parameters for better inference
const NODE_ENVIRONMENTS = ['development', 'production', 'test'] as const
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
const MCP_MODES = ['stdio', 'http'] as const

// Environment variable parsing with validation using enhanced TypeScript patterns
const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVIRONMENTS).default('production'),
  N8N_API_URL: z.string().url().optional(),
  N8N_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  DISABLE_CONSOLE_OUTPUT: z
    .string()
    .transform((val): val is 'true' => val === 'true')
    .default('false'),
  MCP_MODE: z.enum(MCP_MODES).default('stdio'),
  MCP_TIMEOUT: z
    .string()
    .transform((val): number => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num))
        throw new Error(`Invalid MCP_TIMEOUT: ${val}`)
      return num
    })
    .default('30000'),
  DATABASE_PATH: z.string().default('./data/nodes.db'),
  DATABASE_IN_MEMORY: z
    .string()
    .transform((val): val is 'true' => val === 'true')
    .default('false'),
  ENABLE_CACHE: z
    .string()
    .transform((val): val is 'true' => val === 'true')
    .default('true'),
  CACHE_TTL: z
    .string()
    .transform((val): number => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num < 0)
        throw new Error(`Invalid CACHE_TTL: ${val}`)
      return num
    })
    .default('3600'),
  MAX_CONCURRENT_REQUESTS: z
    .string()
    .transform((val): number => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num < 1)
        throw new Error(`Invalid MAX_CONCURRENT_REQUESTS: ${val}`)
      return num
    })
    .default('10'),
  DEBUG: z
    .string()
    .transform((val): val is 'true' => val === 'true')
    .default('false'),

  // API Response Validation Settings with enhanced validation
  STRICT_API_VALIDATION: z
    .string()
    .transform((val): val is 'true' => val === 'true')
    .default('false'),
  ENABLE_RESPONSE_LOGGING: z
    .string()
    .transform((val): val is 'true' => val === 'true')
    .default('true'),
  VALIDATION_TIMEOUT: z
    .string()
    .transform((val): number => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num < 100)
        throw new Error(`Invalid VALIDATION_TIMEOUT: ${val}`)
      return num
    })
    .default('5000'),
  SANITIZE_API_RESPONSES: z
    .string()
    .transform((val): val is 'true' => val === 'true')
    .default('true'),
  MAX_RESPONSE_SIZE: z
    .string()
    .transform((val): number => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num < 1024)
        throw new Error(`Invalid MAX_RESPONSE_SIZE: ${val}`)
      return num
    })
    .default('10485760'),

  // Memory Management Settings
  ENABLE_MEMORY_MONITORING: z
    .string()
    .transform((val): val is 'true' => val === 'true')
    .default('true'),
  MEMORY_THRESHOLD_WARNING: z
    .string()
    .transform((val): number => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num < 50 || num > 95)
        throw new Error(`Invalid MEMORY_THRESHOLD_WARNING: ${val} (must be 50-95)`)
      return num
    })
    .default('87'),
  MEMORY_THRESHOLD_CRITICAL: z
    .string()
    .transform((val): number => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num < 80 || num > 98)
        throw new Error(`Invalid MEMORY_THRESHOLD_CRITICAL: ${val} (must be 80-98)`)
      return num
    })
    .default('95'),
  GC_INTERVAL_MS: z
    .string()
    .transform((val): number => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num < 10000)
        throw new Error(`Invalid GC_INTERVAL_MS: ${val} (minimum 10000ms)`)
      return num
    })
    .default('60000'),
  MAX_HEAP_SIZE_MB: z
    .string()
    .transform((val): number => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num < 128)
        throw new Error(`Invalid MAX_HEAP_SIZE_MB: ${val} (minimum 128MB)`)
      return num
    })
    .default('512'),
  CACHE_CLEANUP_INTERVAL_MS: z
    .string()
    .transform((val): number => {
      const num = Number.parseInt(val, 10)
      if (Number.isNaN(num) || num < 30000)
        throw new Error(`Invalid CACHE_CLEANUP_INTERVAL_MS: ${val} (minimum 30000ms)`)
      return num
    })
    .default('300000'),
})

// Parse and validate environment variables
function parseEnvironment(): Config {
  const env = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    N8N_API_URL: process.env.N8N_API_URL,
    N8N_API_KEY: process.env.N8N_API_KEY,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DISABLE_CONSOLE_OUTPUT: process.env.DISABLE_CONSOLE_OUTPUT,
    MCP_MODE: process.env.MCP_MODE,
    MCP_TIMEOUT: process.env.MCP_TIMEOUT,
    DATABASE_PATH: process.env.DATABASE_PATH,
    DATABASE_IN_MEMORY: process.env.DATABASE_IN_MEMORY,
    ENABLE_CACHE: process.env.ENABLE_CACHE,
    CACHE_TTL: process.env.CACHE_TTL,
    MAX_CONCURRENT_REQUESTS: process.env.MAX_CONCURRENT_REQUESTS,
    DEBUG: process.env.DEBUG,
    STRICT_API_VALIDATION: process.env.STRICT_API_VALIDATION,
    ENABLE_RESPONSE_LOGGING: process.env.ENABLE_RESPONSE_LOGGING,
    VALIDATION_TIMEOUT: process.env.VALIDATION_TIMEOUT,
    SANITIZE_API_RESPONSES: process.env.SANITIZE_API_RESPONSES,
    MAX_RESPONSE_SIZE: process.env.MAX_RESPONSE_SIZE,
    ENABLE_MEMORY_MONITORING: process.env.ENABLE_MEMORY_MONITORING,
    MEMORY_THRESHOLD_WARNING: process.env.MEMORY_THRESHOLD_WARNING,
    MEMORY_THRESHOLD_CRITICAL: process.env.MEMORY_THRESHOLD_CRITICAL,
    GC_INTERVAL_MS: process.env.GC_INTERVAL_MS,
    MAX_HEAP_SIZE_MB: process.env.MAX_HEAP_SIZE_MB,
    CACHE_CLEANUP_INTERVAL_MS: process.env.CACHE_CLEANUP_INTERVAL_MS,
  })

  return ConfigSchema.parse({
    n8nApiUrl: normalizeN8NUrl(env.N8N_API_URL),
    n8nApiKey: env.N8N_API_KEY,
    logLevel: env.LOG_LEVEL,
    disableConsoleOutput: env.DISABLE_CONSOLE_OUTPUT,
    mcpMode: env.MCP_MODE,
    mcpTimeout: env.MCP_TIMEOUT,
    databasePath: env.DATABASE_PATH,
    databaseInMemory: env.DATABASE_IN_MEMORY,
    enableCache: env.ENABLE_CACHE,
    cacheTtl: env.CACHE_TTL,
    maxConcurrentRequests: env.MAX_CONCURRENT_REQUESTS,
    nodeEnv: env.NODE_ENV,
    debug: env.DEBUG,
    strictApiValidation: env.STRICT_API_VALIDATION,
    enableResponseLogging: env.ENABLE_RESPONSE_LOGGING,
    validationTimeout: env.VALIDATION_TIMEOUT,
    sanitizeApiResponses: env.SANITIZE_API_RESPONSES,
    maxResponseSize: env.MAX_RESPONSE_SIZE,
    enableMemoryMonitoring: env.ENABLE_MEMORY_MONITORING,
    memoryThresholdWarning: env.MEMORY_THRESHOLD_WARNING,
    memoryThresholdCritical: env.MEMORY_THRESHOLD_CRITICAL,
    gcIntervalMs: env.GC_INTERVAL_MS,
    maxHeapSizeMb: env.MAX_HEAP_SIZE_MB,
    cacheCleanupIntervalMs: env.CACHE_CLEANUP_INTERVAL_MS,
  })
}

// Normalize N8N API URL to ensure correct format
function normalizeN8NUrl(url: string | undefined): string | undefined {
  if (!url)
    return undefined

  // Handle empty string as undefined
  if (url.trim() === '') {
    return undefined
  }

  try {
    const parsed = new URL(url)
    const baseUrl = `${parsed.protocol}//${parsed.host}`

    // Remove trailing slashes and existing api paths
    const cleanPath = parsed.pathname
      .replace(/\/+$/, '')
      .replace(/\/api.*$/, '')

    // Always append /api/v1
    return `${baseUrl}${cleanPath}/api/v1`
  }
  catch {
    throw new Error(`Invalid N8N_API_URL format: ${url}`)
  }
}

// Lazy config loading to handle MCP environment variables
let _configInstance: Config | null = null

function getConfig(): Config {
  if (_configInstance === null) {
    _configInstance = parseEnvironment()
  }
  return _configInstance
}

// Function to refresh config (useful for MCP servers)
export function refreshConfig(): Config {
  _configInstance = null
  return getConfig()
}

// Export lazy singleton config
export const config = new Proxy({} as Config, {
  get(_target, prop: string | symbol): unknown {
    const configInstance = getConfig()
    return configInstance[prop as keyof Config]
  },
  has(_target, prop: string | symbol): boolean {
    const configInstance = getConfig()
    return prop in configInstance
  },
})

// Helper function for runtime config updates
export function updateConfig(updates: Partial<Config>): Config {
  const merged = { ...config, ...updates }
  const updated = validateConfig(merged)
  Object.assign(config, updated)
  return config
}

// Validation helper
export function validateConfig(cfg: unknown): Config {
  // First validate against ConfigSchema which has strict validation
  const result = ConfigSchema.safeParse(cfg)

  if (!result.success) {
    throw new Error(`Configuration validation failed: ${result.error.message}`)
  }

  // Additional validation for configuration logic
  const config = result.data

  // Memory threshold validation
  if (config.memoryThresholdWarning >= config.memoryThresholdCritical) {
    throw new Error('memoryThresholdWarning must be less than memoryThresholdCritical')
  }

  // MCP timeout validation
  if (config.mcpTimeout < 1000 || config.mcpTimeout > 300000) {
    throw new Error('mcpTimeout must be between 1000 and 300000 milliseconds')
  }

  // Max heap size validation
  if (config.maxHeapSizeMb < 128) {
    throw new Error('maxHeapSizeMb must be at least 128MB')
  }

  return config
}

// Environment helpers with TypeScript 5.9+ type predicates
export const isDevelopment = config.nodeEnv === 'development'
export const isProduction = config.nodeEnv === 'production'
export const isDebug = config.debug || isDevelopment

// TypeScript 5.9+ type helper for environment checking
export function assertEnvironment<T extends typeof NODE_ENVIRONMENTS[number]>(
  env: T,
): void {
  if (config.nodeEnv !== env) {
    throw new Error(`Expected environment ${env}, got ${config.nodeEnv}`)
  }
}

// Feature flags with enhanced type safety using const assertions
export const features = {
  hasN8nApi: Boolean(config.n8nApiUrl && config.n8nApiKey),
  cachingEnabled: config.enableCache,
  consoleLoggingEnabled: !config.disableConsoleOutput,
  debugMode: isDebug,
  strictValidation: config.strictApiValidation,
  responseLogging: config.enableResponseLogging,
  sanitizedResponses: config.sanitizeApiResponses,
} as const satisfies Record<string, boolean>

// Export type-safe configuration constants
export type NodeEnvironment = typeof NODE_ENVIRONMENTS[number]
export type LogLevel = typeof LOG_LEVELS[number]
export type McpMode = typeof MCP_MODES[number]

// Configuration type predicate helpers
export function isValidLogLevel(level: string): level is LogLevel {
  return LOG_LEVELS.includes(level as LogLevel)
}

export function isValidEnvironment(env: string): env is NodeEnvironment {
  return NODE_ENVIRONMENTS.includes(env as NodeEnvironment)
}
