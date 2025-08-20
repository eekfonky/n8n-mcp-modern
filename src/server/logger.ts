import { config } from "./config.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  context?: string;
}

class Logger {
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[config.logLevel];
  }

  private formatEntry(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}`;
    const context = entry.context ? ` [${entry.context}]` : "";
    const message = `${prefix}${context}: ${entry.message}`;

    if (entry.data !== undefined) {
      const dataStr =
        typeof entry.data === "object"
          ? JSON.stringify(entry.data, null, 2)
          : String(entry.data);
      return `${message}\n${dataStr}`;
    }

    return message;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    context?: string,
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      ...(context && { context }),
    };

    const formatted = this.formatEntry(entry);

    // Only log to console if not disabled
    if (!config.disableConsoleOutput) {
      switch (level) {
        case "debug":
          console.debug(formatted);
          break;
        case "info":
          console.info(formatted);
          break;
        case "warn":
          console.warn(formatted);
          break;
        case "error":
          console.error(formatted);
          break;
      }
    }
  }

  debug(message: string, data?: unknown, context?: string): void {
    this.log("debug", message, data, context);
  }

  info(message: string, data?: unknown, context?: string): void {
    this.log("info", message, data, context);
  }

  warn(message: string, data?: unknown, context?: string): void {
    this.log("warn", message, data, context);
  }

  error(message: string, error?: Error | unknown, context?: string): void {
    let data: unknown = error;

    if (error instanceof Error) {
      data = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      };
    }

    this.log("error", message, data, context);
  }

  // Create contextual logger
  context(contextName: string): ContextLogger {
    return new ContextLogger(this, contextName);
  }
}

class ContextLogger {
  constructor(
    private readonly logger: Logger,
    private readonly contextName: string,
  ) {
    // Parameters are used in methods below
    void logger;
    void contextName;
  }

  debug(message: string, data?: unknown): void {
    this.logger.debug(message, data, this.contextName);
  }

  info(message: string, data?: unknown): void {
    this.logger.info(message, data, this.contextName);
  }

  warn(message: string, data?: unknown): void {
    this.logger.warn(message, data, this.contextName);
  }

  error(message: string, error?: Error | unknown): void {
    this.logger.error(message, error, this.contextName);
  }
}

// Export singleton logger instance
export const logger = new Logger();

// Export commonly used contextual loggers
export const mcpLogger = logger.context("MCP");
export const dbLogger = logger.context("Database");
export const n8nLogger = logger.context("N8N");
export const validationLogger = logger.context("Validation");
export const agentLogger = logger.context("Agent");
