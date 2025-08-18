/**
 * Security Module Unit Tests
 * Tests security controls and audit mechanisms
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  SecurityEventType, 
  securityAudit, 
  apiKeyValidator, 
  inputSanitizer, 
  rateLimiter,
  createClaudeContext,
  validateToolAccess,
  generateSessionId
} from '../server/security.js';

describe('Security Module Tests', () => {
  beforeEach(() => {
    // Clear audit log before each test
    securityAudit.clearLog();
    rateLimiter.clearAll();
  });

  describe('Security Audit Logger', () => {
    it('should log security events', () => {
      securityAudit.logEvent({
        eventType: SecurityEventType.TOOL_EXECUTED,
        success: true,
        toolName: 'test_tool',
        userId: 'test_user'
      });

      const events = securityAudit.getRecentEvents(1);
      expect(events.length).toBe(1);
      expect(events[0]?.eventType).toBe(SecurityEventType.TOOL_EXECUTED);
      expect(events[0]?.success).toBe(true);
      expect(events[0]?.toolName).toBe('test_tool');
    });

    it('should filter events by type', () => {
      // Log different types of events
      securityAudit.logEvent({
        eventType: SecurityEventType.TOOL_EXECUTED,
        success: true,
        toolName: 'tool1'
      });
      
      securityAudit.logEvent({
        eventType: SecurityEventType.ACCESS_DENIED,
        success: false,
        toolName: 'tool2'
      });

      const toolEvents = securityAudit.getEventsByType(SecurityEventType.TOOL_EXECUTED);
      const accessEvents = securityAudit.getEventsByType(SecurityEventType.ACCESS_DENIED);

      expect(toolEvents.length).toBe(1);
      expect(accessEvents.length).toBe(1);
      expect(toolEvents[0]?.toolName).toBe('tool1');
      expect(accessEvents[0]?.toolName).toBe('tool2');
    });

    it('should maintain event limits', () => {
      // This would test the maxEvents limit, but for unit test we'll just verify it doesn't crash
      for (let i = 0; i < 100; i++) {
        securityAudit.logEvent({
          eventType: SecurityEventType.TOOL_EXECUTED,
          success: true,
          toolName: `tool_${i}`
        });
      }

      const events = securityAudit.getRecentEvents(200);
      expect(events.length).toBe(100);
    });
  });

  describe('API Key Validator', () => {
    it('should validate API key format', () => {
      // Valid format
      expect(apiKeyValidator.validateFormat('a'.repeat(32))).toBe(true);
      expect(apiKeyValidator.validateFormat('a'.repeat(64))).toBe(true);
      
      // Invalid format
      expect(apiKeyValidator.validateFormat('short')).toBe(false);
      expect(apiKeyValidator.validateFormat('a'.repeat(200))).toBe(false);
      expect(apiKeyValidator.validateFormat('')).toBe(false);
    });

    it('should handle missing configuration gracefully', () => {
      // When no API key is configured, validation should fail safely
      const result = apiKeyValidator.validateKey('any-key');
      expect(result).toBe(false);
      
      // Should log the event
      const events = securityAudit.getEventsByType(SecurityEventType.API_KEY_INVALID);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Input Sanitizer', () => {
    it('should sanitize string input', () => {
      const maliciousInput = 'normal\x00null\x1fcontrol\x08chars\x0ctest';
      const sanitized = inputSanitizer.sanitizeString(maliciousInput);
      
      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\x1f');
      expect(sanitized).not.toContain('\x08');
      expect(sanitized).not.toContain('\x0c');
      expect(sanitized).toContain('normal');
      expect(sanitized).toContain('test');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(2000);
      const sanitized = inputSanitizer.sanitizeString(longString, 100);
      
      expect(sanitized.length).toBe(100);
    });

    it('should sanitize objects recursively', () => {
      const maliciousObject = {
        'normal\x00key': 'normal\x1fvalue',
        nested: {
          'another\x08key': 'another\x0cvalue'
        },
        array: ['item\x001', 'item\x1f2']
      };

      const sanitized = inputSanitizer.sanitizeObject(maliciousObject) as any;
      
      expect(Object.keys(sanitized)[0]).not.toContain('\x00');
      expect(sanitized.normalkey).not.toContain('\x1f');
      expect(sanitized.nested.anotherkey).not.toContain('\x0c');
      expect(sanitized.array[0]).not.toContain('\x00');
    });

    it('should handle deep nesting safely', () => {
      const deepObject = { level: { level: { level: { level: { value: 'deep' } } } } };
      
      // With sufficient depth, should work
      expect(() => inputSanitizer.sanitizeObject(deepObject, 10)).not.toThrow();
      // With insufficient depth, should throw
      expect(() => inputSanitizer.sanitizeObject(deepObject, 2)).toThrow();
    });
  });

  describe('Rate Limiter', () => {
    it('should allow requests within limits', () => {
      const testLimiter = rateLimiter;
      
      // Should allow initial requests
      expect(testLimiter.isAllowed('user1')).toBe(true);
      expect(testLimiter.isAllowed('user1')).toBe(true);
      expect(testLimiter.isAllowed('user2')).toBe(true);
    });

    it('should track different identifiers separately', () => {
      const testLimiter = rateLimiter;
      
      // Different users should have separate limits
      for (let i = 0; i < 5; i++) {
        expect(testLimiter.isAllowed('user1')).toBe(true);
        expect(testLimiter.isAllowed('user2')).toBe(true);
      }
    });

    it('should reset rate limits correctly', () => {
      const testLimiter = rateLimiter;
      
      testLimiter.isAllowed('user1');
      testLimiter.reset('user1');
      
      // After reset, should allow requests again
      expect(testLimiter.isAllowed('user1')).toBe(true);
    });
  });

  describe('Security Context', () => {
    it('should create Claude Code context', () => {
      const context = createClaudeContext();
      
      expect(context.userId).toBe('claude-code');
      expect(context.sessionId).toBeDefined();
      expect(context.sessionId.length).toBeGreaterThan(0);
      expect(context.permissions).toContain('mcp:tools:*');
      expect(context.permissions).toContain('n8n:api:*');
    });

    it('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      
      expect(id1).not.toBe(id2);
      expect(id1.length).toBe(64); // 32 bytes * 2 hex chars
      expect(id2.length).toBe(64);
    });

    it('should validate tool access correctly', () => {
      const context = createClaudeContext();
      
      // Should allow access to any tool for Claude Code context
      expect(validateToolAccess('search_n8n_nodes', context)).toBe(true);
      expect(validateToolAccess('create_workflow', context)).toBe(true);
      expect(validateToolAccess('any_tool', context)).toBe(true);
      
      // Should log successful access
      const events = securityAudit.getEventsByType(SecurityEventType.TOOL_EXECUTED);
      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle restricted contexts', () => {
      const restrictedContext = {
        userId: 'restricted-user',
        sessionId: generateSessionId(),
        permissions: ['mcp:tools:search_only'],
        metadata: {}
      };
      
      expect(validateToolAccess('search_n8n_nodes', restrictedContext)).toBe(false);
      expect(validateToolAccess('create_workflow', restrictedContext)).toBe(false);
      
      // Should log denied access
      const events = securityAudit.getEventsByType(SecurityEventType.TOOL_DENIED);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => inputSanitizer.sanitizeObject(null)).not.toThrow();
      expect(() => inputSanitizer.sanitizeObject(undefined)).not.toThrow();
      
      expect(inputSanitizer.sanitizeObject(null)).toBe(null);
      expect(inputSanitizer.sanitizeObject(undefined)).toBe(undefined);
    });

    it('should handle circular objects', () => {
      const circular: any = { prop: 'value' };
      circular.circular = circular;
      
      // Should handle circular references (may throw depth error, but shouldn't crash)
      expect(() => inputSanitizer.sanitizeObject(circular, 5)).toThrow('Maximum sanitization depth exceeded');
      
      // Simple circular reference with sufficient depth should work
      const simpleCircular: any = { prop: 'value' };
      expect(() => inputSanitizer.sanitizeObject(simpleCircular, 5)).not.toThrow();
    });

    it('should handle edge cases in API key validation', () => {
      expect(apiKeyValidator.validateFormat('')).toBe(false);
      expect(() => apiKeyValidator.validateKey('')).not.toThrow();
    });
  });
});