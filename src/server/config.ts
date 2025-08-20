import { config as dotenvConfig } from "dotenv";
import { z } from "zod";
import type { Config } from "../types/index.js";
import { ConfigSchema } from "../types/index.js";

// Load environment variables
dotenvConfig();

// Environment variable parsing with validation
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  N8N_API_URL: z.string().url().optional(),
  N8N_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DISABLE_CONSOLE_OUTPUT: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  MCP_MODE: z.enum(["stdio", "http"]).default("stdio"),
  MCP_TIMEOUT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("30000"),
  DATABASE_PATH: z.string().default("./data/nodes.db"),
  DATABASE_IN_MEMORY: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  ENABLE_CACHE: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  CACHE_TTL: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("3600"),
  MAX_CONCURRENT_REQUESTS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("10"),
  DEBUG: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

  // API Response Validation Settings
  STRICT_API_VALIDATION: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  ENABLE_RESPONSE_LOGGING: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  VALIDATION_TIMEOUT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("5000"),
  SANITIZE_API_RESPONSES: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  MAX_RESPONSE_SIZE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("10485760"),
});

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
  });

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
  });
}

// Normalize N8N API URL to ensure correct format
function normalizeN8NUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    const baseUrl = `${parsed.protocol}//${parsed.host}`;

    // Remove trailing slashes and existing api paths
    const cleanPath = parsed.pathname
      .replace(/\/+$/, "")
      .replace(/\/api.*$/, "");

    // Always append /api/v1
    return `${baseUrl}${cleanPath}/api/v1`;
  } catch {
    throw new Error(`Invalid N8N_API_URL format: ${url}`);
  }
}

// Export singleton config
export const config = parseEnvironment();

// Helper function for runtime config updates
export function updateConfig(updates: Partial<Config>): Config {
  const updated = ConfigSchema.parse({ ...config, ...updates });
  Object.assign(config, updated);
  return config;
}

// Validation helper
export function validateConfig(cfg: unknown): Config {
  return ConfigSchema.parse(cfg);
}

// Environment helpers
export const isDevelopment = config.nodeEnv === "development";
export const isProduction = config.nodeEnv === "production";
export const isDebug = config.debug || isDevelopment;

// Feature flags based on config
export const features = {
  hasN8nApi: Boolean(config.n8nApiUrl && config.n8nApiKey),
  cachingEnabled: config.enableCache,
  consoleLoggingEnabled: !config.disableConsoleOutput,
  debugMode: isDebug,
} as const;
