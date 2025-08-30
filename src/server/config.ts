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
  })

  const configData = {
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
  }
  
  // Security: Validate API key without exposing it in logs
  if (configData.n8nApiKey && configData.n8nApiKey.length < 16) {
    throw new Error('N8N_API_KEY must be at least 16 characters long')
  }
  
  return ConfigSchema.parse(configData)
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

// Simple validation helper
export function validateConfig(cfg: unknown): Config {
  const result = ConfigSchema.safeParse(cfg)
  if (!result.success) {
    throw new Error(`Configuration validation failed: ${result.error.message}`)
  }
  return result.data
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

// Simple feature flags
export const features = {
  hasN8nApi: Boolean(config.n8nApiUrl && config.n8nApiKey),
  cachingEnabled: config.enableCache,
  consoleLoggingEnabled: !config.disableConsoleOutput,
  debugMode: isDebug,
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
