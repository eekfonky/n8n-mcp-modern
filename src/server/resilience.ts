/**
 * Resilience and fault tolerance module for n8n-MCP-Modern
 * Implements retry logic, circuit breakers, and health monitoring
 */

import { EventEmitter } from "events";
import { logger } from "./logger.js";
import { config } from "./config.js";

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = "CLOSED",

  OPEN = "OPEN",

  HALF_OPEN = "HALF_OPEN",
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  threshold: number; // Number of failures before opening
  timeout: number; // Time before attempting to close (ms)
  resetTimeout: number; // Time to wait before resetting failure count
  monitoringPeriod: number; // Period to monitor failures
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

/**
 * Health check result
 */
interface HealthCheckResult {
  healthy: boolean;
  service: string;
  latency?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime?: Date;
  private successCount = 0;
  private nextAttempt: Date | undefined;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig = {
      threshold: 5,
      timeout: 60000,
      resetTimeout: 30000,
      monitoringPeriod: 60000,
    },
  ) {
    super();
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttempt && Date.now() < this.nextAttempt.getTime()) {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
      this.state = CircuitState.HALF_OPEN;
      logger.info(`Circuit breaker ${this.name} entering HALF_OPEN state`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info(`Circuit breaker ${this.name} is now CLOSED`);
        this.emit("stateChange", CircuitState.CLOSED);
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.successCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.config.timeout);
      logger.warn(
        `Circuit breaker ${this.name} is now OPEN (will retry at ${this.nextAttempt.toISOString()})`,
      );
      this.emit("stateChange", CircuitState.OPEN);
    } else if (this.failures >= this.config.threshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.config.timeout);
      logger.warn(`Circuit breaker ${this.name} threshold reached, now OPEN`);
      this.emit("stateChange", CircuitState.OPEN);
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successCount = 0;
    this.nextAttempt = undefined;
    logger.info(`Circuit breaker ${this.name} has been reset`);
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryHandler {
  constructor(
    private readonly config: RetryConfig = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
    },
  ) {
    // Private config property is used in execute method
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    let lastError: Error | undefined;
    let delay = this.config.initialDelay;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        logger.debug(
          `Attempt ${attempt}/${this.config.maxAttempts} for ${context ?? "operation"}`,
        );
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.config.maxAttempts) {
          logger.error(
            `All retry attempts failed for ${context ?? "operation"}`,
            error,
          );
          break;
        }

        // Calculate next delay with exponential backoff
        if (this.config.jitter) {
          delay = delay + Math.random() * 1000;
        }

        logger.warn(
          `Attempt ${attempt} failed for ${context ?? "operation"}, retrying in ${delay}ms`,
          {
            error: (error as Error).message,
          },
        );

        await this.sleep(delay);
        delay = Math.min(
          delay * this.config.backoffMultiplier,
          this.config.maxDelay,
        );
      }
    }

    throw lastError ?? new Error("Retry failed");
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
  }
}

/**
 * Health monitoring service
 */
export class HealthMonitor extends EventEmitter {
  private checks: Map<string, () => Promise<boolean>> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private monitoringInterval: ReturnType<typeof setInterval> | undefined;
  private isHealthy = true;

  /**
   * Register a health check
   */
  registerCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
    logger.info(`Health check registered: ${name}`);
  }

  /**
   * Perform all health checks
   */
  async performChecks(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    for (const [name, check] of this.checks) {
      const startTime = Date.now();

      try {
        const healthy = await check();
        const result: HealthCheckResult = {
          healthy,
          service: name,
          latency: Date.now() - startTime,
          timestamp: new Date(),
        };

        results.set(name, result);
        this.results.set(name, result);

        if (!healthy) {
          logger.warn(`Health check failed: ${name}`);
        }
      } catch (error) {
        const result: HealthCheckResult = {
          healthy: false,
          service: name,
          latency: Date.now() - startTime,
          error: (error as Error).message,
          timestamp: new Date(),
        };

        results.set(name, result);
        this.results.set(name, result);
        logger.error(`Health check error: ${name}`, error);
      }
    }

    // Update overall health status
    const wasHealthy = this.isHealthy;
    this.isHealthy = Array.from(results.values()).every((r) => r.healthy);

    if (wasHealthy !== this.isHealthy) {
      this.emit("healthChange", this.isHealthy);
      logger.info(
        `System health changed: ${this.isHealthy ? "HEALTHY" : "UNHEALTHY"}`,
      );
    }

    return results;
  }

  /**
   * Start monitoring
   */
  startMonitoring(intervalMs = 30000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info(`Starting health monitoring (interval: ${intervalMs}ms)`);

    // Perform initial check
    this.performChecks();

    // Set up periodic monitoring
    this.monitoringInterval = globalThis.setInterval(() => {
      this.performChecks();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      globalThis.clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info("Health monitoring stopped");
    }
  }

  /**
   * Get current health status
   */
  getStatus(): { healthy: boolean; checks: Map<string, HealthCheckResult> } {
    return {
      healthy: this.isHealthy,
      checks: this.results,
    };
  }

  /**
   * Express/HTTP endpoint handler
   */
  getHealthEndpoint(): (req: unknown, res: unknown) => Promise<void> {
    return async (_req: unknown, res: unknown): Promise<void> => {
      const status = this.getStatus();
      const httpStatus = status.healthy ? 200 : 503;

      (
        res as unknown as {
          status(code: number): { json(data: Record<string, unknown>): void };
        }
      )
        .status(httpStatus)
        .json({
          status: status.healthy ? "UP" : "DOWN",
          timestamp: new Date().toISOString(),
          checks: Object.fromEntries(status.checks),
        });
    };
  }
}

/**
 * Graceful shutdown handler
 */
export class GracefulShutdown {
  private shutdownHandlers: Array<() => Promise<void>> = [];
  private isShuttingDown = false;
  private shutdownTimeout = 30000; // 30 seconds

  /**
   * Register shutdown handler
   */
  registerHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Initialize shutdown listeners
   */
  initialize(): void {
    const signals: Array<"SIGTERM" | "SIGINT" | "SIGUSR2"> = [
      "SIGTERM",
      "SIGINT",
      "SIGUSR2",
    ];

    signals.forEach((signal) => {
      process.on(signal, async (): Promise<void> => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        await this.shutdown();
      });
    });

    // Handle uncaught errors
    process.on("uncaughtException", async (error): Promise<void> => {
      logger.error("Uncaught exception, shutting down gracefully", error);
      await this.shutdown(1);
    });

    process.on("unhandledRejection", async (reason, promise): Promise<void> => {
      logger.error("Unhandled rejection, shutting down gracefully", {
        reason,
        promise,
      });
      await this.shutdown(1);
    });
  }

  /**
   * Perform graceful shutdown
   */
  async shutdown(exitCode = 0): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn("Shutdown already in progress");
      return;
    }

    this.isShuttingDown = true;
    logger.info("Starting graceful shutdown...");

    // Set timeout for forced shutdown
    const forceShutdown = globalThis.setTimeout(() => {
      logger.error("Graceful shutdown timeout, forcing exit");
      process.exit(exitCode);
    }, this.shutdownTimeout);

    try {
      // Execute all shutdown handlers
      await Promise.all(
        this.shutdownHandlers.map((handler) =>
          handler().catch((error) => {
            logger.error("Shutdown handler error", error);
          }),
        ),
      );

      logger.info("Graceful shutdown complete");
      globalThis.clearTimeout(forceShutdown);
      process.exit(exitCode);
    } catch (error) {
      logger.error("Error during graceful shutdown", error);
      globalThis.clearTimeout(forceShutdown);
      process.exit(1);
    }
  }
}

// Create singleton instances
export const healthMonitor = new HealthMonitor();
export const gracefulShutdown = new GracefulShutdown();
export const retryHandler = new RetryHandler();

// Default circuit breakers for critical services
export const n8nApiCircuitBreaker = new CircuitBreaker("n8n-api");
export const databaseCircuitBreaker = new CircuitBreaker("database");

// Initialize resilience features
export function initializeResilience(): void {
  // Register health checks
  healthMonitor.registerCheck("database", async (): Promise<boolean> => {
    try {
      // Check database connectivity
      const { database } = await import("../database/index.js");
      return database.isReady();
    } catch {
      return false;
    }
  });

  if (config.n8nApiUrl && config.n8nApiKey) {
    healthMonitor.registerCheck("n8n-api", async (): Promise<boolean> => {
      try {
        const { fetch } = await import("undici");
        const response = await fetch(`${config.n8nApiUrl}/workflows`, {
          method: "HEAD",
          headers: {
            "X-N8N-API-KEY": config.n8nApiKey ?? "",
          },
        });
        return response.ok;
      } catch {
        return false;
      }
    });
  }

  // Start health monitoring
  healthMonitor.startMonitoring(30000);

  // Initialize graceful shutdown
  gracefulShutdown.initialize();

  // Register cleanup handlers
  gracefulShutdown.registerHandler(async (): Promise<void> => {
    logger.info("Stopping health monitoring...");
    healthMonitor.stopMonitoring();
  });

  gracefulShutdown.registerHandler(async (): Promise<void> => {
    logger.info("Closing database connections...");
    const { database } = await import("../database/index.js");
    database.close();
  });

  logger.info("Resilience features initialized");
}
