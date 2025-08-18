/**
 * Security module for n8n-MCP-Modern
 * Implements security controls and audit mechanisms
 */

import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Security event types for audit logging
 */
export enum SecurityEventType {
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  API_KEY_VALIDATED = 'API_KEY_VALIDATED',
  API_KEY_INVALID = 'API_KEY_INVALID',
  TOOL_EXECUTED = 'TOOL_EXECUTED',
  TOOL_DENIED = 'TOOL_DENIED',
  CONFIG_CHANGED = 'CONFIG_CHANGED',
  SECURITY_ERROR = 'SECURITY_ERROR'
}

/**
 * Security event for audit logging
 */
export interface SecurityEvent {
  timestamp: Date;
  eventType: SecurityEventType;
  userId?: string;
  toolName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  success: boolean;
}

/**
 * Security audit logger
 */
class SecurityAuditLogger {
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 10000;

  /**
   * Log a security event
   */
  logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    };

    this.events.push(fullEvent);
    
    // Trim events if exceeding max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to system logger based on event type
    if (event.success) {
      logger.info(`Security: ${event.eventType}`, {
        toolName: event.toolName,
        userId: event.userId
      });
    } else {
      logger.warn(`Security Alert: ${event.eventType}`, {
        toolName: event.toolName,
        userId: event.userId,
        details: event.details
      });
    }
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: SecurityEventType, limit = 100): SecurityEvent[] {
    return this.events
      .filter(e => e.eventType === eventType)
      .slice(-limit);
  }

  /**
   * Clear audit log (use with caution)
   */
  clearLog(): void {
    this.events = [];
    logger.info('Security audit log cleared');
  }
}

/**
 * API Key validator
 */
export class ApiKeyValidator {
  private readonly keyHashCache = new Map<string, string>();

  /**
   * Hash an API key for secure comparison
   */
  private hashKey(key: string): string {
    const cached = this.keyHashCache.get(key);
    if (cached) return cached;

    const hash = createHash('sha256').update(key).digest('hex');
    this.keyHashCache.set(key, hash);
    return hash;
  }

  /**
   * Validate API key format
   */
  validateFormat(apiKey: string): boolean {
    // n8n API keys are typically 64 characters
    const apiKeySchema = z.string().min(32).max(128);
    
    try {
      apiKeySchema.parse(apiKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate API key against configured key
   */
  validateKey(providedKey: string): boolean {
    if (!config.n8nApiKey) {
      securityAudit.logEvent({
        eventType: SecurityEventType.API_KEY_INVALID,
        success: false,
        details: { reason: 'No API key configured' }
      });
      return false;
    }

    if (!this.validateFormat(providedKey)) {
      securityAudit.logEvent({
        eventType: SecurityEventType.API_KEY_INVALID,
        success: false,
        details: { reason: 'Invalid API key format' }
      });
      return false;
    }

    const isValid = this.hashKey(providedKey) === this.hashKey(config.n8nApiKey);
    
    securityAudit.logEvent({
      eventType: isValid ? SecurityEventType.API_KEY_VALIDATED : SecurityEventType.API_KEY_INVALID,
      success: isValid
    });

    return isValid;
  }
}

/**
 * Input sanitizer for security
 */
export class InputSanitizer {
  /**
   * Sanitize string input
   */
  sanitizeString(input: string, maxLength = 1000): string {
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');
    
    // Truncate to max length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
  }

  /**
   * Sanitize object input recursively
   */
  sanitizeObject(obj: unknown, maxDepth = 10): unknown {
    if (maxDepth <= 0) {
      throw new Error('Maximum sanitization depth exceeded');
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, maxDepth - 1));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key, 100);
        sanitized[sanitizedKey] = this.sanitizeObject(value, maxDepth - 1);
      }
      return sanitized;
    }

    return obj;
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private readonly requests = new Map<string, number[]>();
  
  constructor(
    private readonly maxRequests: number = 100,
    private readonly windowMs: number = 60000 // 1 minute
  ) {}

  /**
   * Check if request is allowed
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Filter out old requests
    const recentRequests = requests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      securityAudit.logEvent({
        eventType: SecurityEventType.ACCESS_DENIED,
        success: false,
        userId: identifier,
        details: { reason: 'Rate limit exceeded' }
      });
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    return true;
  }

  /**
   * Reset rate limit for identifier
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.requests.clear();
  }
}

/**
 * Security context for request handling
 */
export interface SecurityContext {
  userId: string;
  sessionId: string;
  permissions: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a security context for Claude Code
 */
export function createClaudeContext(): SecurityContext {
  return {
    userId: 'claude-code',
    sessionId: generateSessionId(),
    permissions: ['mcp:tools:*', 'n8n:api:*'],
    metadata: {
      client: 'Claude Code',
      version: process.env.npm_package_version
    }
  };
}

// Export singleton instances
export const securityAudit = new SecurityAuditLogger();
export const apiKeyValidator = new ApiKeyValidator();
export const inputSanitizer = new InputSanitizer();
export const rateLimiter = new RateLimiter(
  config.maxConcurrentRequests * 10,
  60000 // 1 minute window
);

/**
 * Security middleware for tool execution
 */
export function validateToolAccess(
  toolName: string,
  context: SecurityContext
): boolean {
  // Check if user has permission for this tool
  const hasPermission = context.permissions.some(perm => 
    perm === `mcp:tools:${toolName}` ||
    perm === 'mcp:tools:*'
  );

  securityAudit.logEvent({
    eventType: hasPermission ? SecurityEventType.TOOL_EXECUTED : SecurityEventType.TOOL_DENIED,
    success: hasPermission,
    userId: context.userId,
    toolName
  });

  return hasPermission;
}

/**
 * Initialize security module
 */
export function initializeSecurity(): void {
  logger.info('Security module initialized', {
    auditingEnabled: true,
    rateLimitingEnabled: true,
    inputSanitizationEnabled: true
  });

  // Log initial security configuration
  securityAudit.logEvent({
    eventType: SecurityEventType.CONFIG_CHANGED,
    success: true,
    details: {
      hasApiKey: Boolean(config.n8nApiKey),
      environment: config.nodeEnv,
      mcpMode: config.mcpMode
    }
  });
}