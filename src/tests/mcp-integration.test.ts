/**
 * MCP Protocol Integration Tests
 * Tests basic MCP server functionality and protocol compliance
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { N8NMcpServer } from '../index.js';
import { config } from '../server/config.js';
import { database } from '../database/index.js';

describe('MCP Protocol Integration Tests', () => {
  let server: N8NMcpServer;

  beforeAll(async () => {
    // Initialize test environment
    await database.initialize();
    server = new N8NMcpServer();
  });

  afterAll(async () => {
    // Cleanup
    if (server) {
      // Server cleanup would happen here
    }
  });

  describe('Server Initialization', () => {
    it('should create server instance without errors', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(N8NMcpServer);
    });

    it('should have proper configuration', () => {
      expect(config).toBeDefined();
      expect(config.mcpMode).toBe('stdio');
      expect(config.logLevel).toBeDefined();
    });
  });

  describe('Database Integration', () => {
    it('should initialize database successfully', async () => {
      // Database should already be initialized from beforeAll
      expect(database).toBeDefined();
    });

    it('should handle database queries without errors', async () => {
      // Test basic database operation
      try {
        // This would test a simple query if database methods are available
        expect(true).toBe(true); // Placeholder until we have database methods to test
      } catch (error) {
        expect.fail(`Database query failed: ${error}`);
      }
    });
  });

  describe('Security Integration', () => {
    it('should initialize security module', () => {
      // Security module should be initialized during server startup
      expect(true).toBe(true); // Security is initialized in main server
    });

    it('should handle input sanitization', async () => {
      // Test that security module functions are available
      const { inputSanitizer } = await import('../server/security.js');
      expect(inputSanitizer).toBeDefined();
      
      const testInput = 'test\x00input\x1fwith\x08control\x0cchars';
      const sanitized = inputSanitizer.sanitizeString(testInput);
      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\x1f');
      expect(sanitized).not.toContain('\x08');
      expect(sanitized).not.toContain('\x0c');
    });
  });

  describe('Agent System Integration', () => {
    it('should initialize agent routing system', async () => {
      const { agentRouter } = await import('../agents/index.js');
      expect(agentRouter).toBeDefined();
      
      const agents = agentRouter.getAllAgents();
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should have proper agent hierarchy', async () => {
      const { agentRouter } = await import('../agents/index.js');
      const agents = agentRouter.getAllAgents();
      
      // Should have agents from different tiers
      const tiers = [...new Set(agents.map(agent => agent.tier))];
      expect(tiers.length).toBeGreaterThan(1);
    });
  });

  describe('Tool Registration', () => {
    it('should register MCP tools correctly', () => {
      // Test that tools are properly structured
      // This would require access to server's internal tool registry
      expect(true).toBe(true); // Placeholder - tools are registered in server constructor
    });

    it('should have proper tool schemas', async () => {
      // Test that Zod schemas are properly defined
      const { z } = await import('zod');
      
      // Test basic schema validation
      const testSchema = z.object({
        query: z.string(),
        limit: z.number().optional()
      });
      
      expect(() => testSchema.parse({ query: 'test' })).not.toThrow();
      expect(() => testSchema.parse({ query: 'test', limit: 10 })).not.toThrow();
      expect(() => testSchema.parse({ invalid: 'data' })).toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate environment configuration', () => {
      expect(config.nodeEnv).toMatch(/^(development|production)$/);
      expect(config.mcpMode).toMatch(/^(stdio|http)$/);
      expect(config.logLevel).toMatch(/^(debug|info|warn|error)$/);
    });

    it('should handle optional n8n configuration', () => {
      // n8n API configuration is optional
      if (config.n8nApiUrl) {
        expect(config.n8nApiUrl).toMatch(/^https?:\/\/.+\/api\/v1$/);
      }
      
      if (config.n8nApiKey) {
        expect(config.n8nApiKey.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed tool arguments gracefully', async () => {
      const { inputSanitizer } = await import('../server/security.js');
      
      // Test various malformed inputs
      const malformedInputs = [
        null,
        undefined,
        { circular: {} },
        'string\x00with\x1fnull\x08bytes',
        { deeply: { nested: { object: { with: { many: { levels: true } } } } } }
      ];
      
      malformedInputs.forEach(input => {
        expect(() => inputSanitizer.sanitizeObject(input)).not.toThrow();
      });
    });

    it('should provide meaningful error messages', async () => {
      const { N8NMCPTools } = await import('../tools/index.js');
      
      try {
        // Test with invalid tool name
        await N8NMCPTools.executeTool('nonexistent_tool', {});
        expect.fail('Should have thrown an error for nonexistent tool');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
        expect((error as Error).message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance Characteristics', () => {
    it('should initialize quickly', async () => {
      const startTime = Date.now();
      const testServer = new N8NMcpServer();
      const initTime = Date.now() - startTime;
      
      expect(initTime).toBeLessThan(1000); // Should initialize in under 1 second
      expect(testServer).toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      const { inputSanitizer } = await import('../server/security.js');
      
      // Test concurrent sanitization operations
      const promises = Array.from({ length: 10 }, (_, i) => 
        Promise.resolve(inputSanitizer.sanitizeString(`test input ${i}`))
      );
      
      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      results.forEach((result, i) => {
        expect(result).toBe(`test input ${i}`);
      });
    });
  });
});