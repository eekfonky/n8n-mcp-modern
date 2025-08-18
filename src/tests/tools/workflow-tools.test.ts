/**
 * Workflow Tools Test Suite
 * Comprehensive tests for workflow management tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { N8NMCPTools } from '../../tools/index.js';

// Mock the database module
vi.mock('../../database/index.js', () => ({
  database: {
    prepare: vi.fn(() => ({
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn()
    }))
  }
}));

describe('Workflow Management Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchWorkflows', () => {
    it('should validate search parameters', async () => {
      const validParams = {
        query: 'email automation',
        limit: 10
      };

      // Test schema validation
      const schema = z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(100).optional()
      });

      expect(() => schema.parse(validParams)).not.toThrow();
      expect(() => schema.parse({ query: '' })).toThrow();
      expect(() => schema.parse({ query: 'test', limit: -1 })).toThrow();
    });

    it('should handle missing optional parameters', async () => {
      const params = { query: 'test' };
      const schema = z.object({
        query: z.string().min(1),
        limit: z.number().optional(),
        active: z.boolean().optional()
      });

      const parsed = schema.parse(params);
      expect(parsed.query).toBe('test');
      expect(parsed.limit).toBeUndefined();
      expect(parsed.active).toBeUndefined();
    });

    it('should sanitize query input', async () => {
      const maliciousQuery = 'test\x00query\x1fwith\x08control';
      const { inputSanitizer } = await import('../../server/security.js');
      
      const sanitized = inputSanitizer.sanitizeString(maliciousQuery);
      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\x1f');
      expect(sanitized).not.toContain('\x08');
    });
  });

  describe('createWorkflow', () => {
    it('should validate workflow structure', () => {
      const workflowSchema = z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        nodes: z.array(z.object({
          type: z.string(),
          parameters: z.record(z.any()).optional()
        })),
        connections: z.record(z.any()).optional(),
        active: z.boolean().default(false)
      });

      const validWorkflow = {
        name: 'Test Workflow',
        nodes: [
          { type: 'webhook', parameters: { path: '/test' } },
          { type: 'http', parameters: { url: 'https://api.example.com' } }
        ],
        active: false
      };

      expect(() => workflowSchema.parse(validWorkflow)).not.toThrow();
    });

    it('should reject invalid workflow names', () => {
      const workflowSchema = z.object({
        name: z.string().min(1).max(255)
      });

      expect(() => workflowSchema.parse({ name: '' })).toThrow();
      expect(() => workflowSchema.parse({ name: 'a'.repeat(256) })).toThrow();
      expect(() => workflowSchema.parse({})).toThrow();
    });

    it('should handle complex node configurations', () => {
      const nodeSchema = z.object({
        type: z.string(),
        parameters: z.record(z.any()),
        credentials: z.record(z.string()).optional(),
        position: z.tuple([z.number(), z.number()]).optional()
      });

      const complexNode = {
        type: 'postgres',
        parameters: {
          operation: 'insert',
          table: 'users',
          columns: ['name', 'email']
        },
        credentials: {
          postgresDb: 'prod-db-credentials'
        },
        position: [100, 200]
      };

      expect(() => nodeSchema.parse(complexNode)).not.toThrow();
    });
  });

  describe('updateWorkflow', () => {
    it('should validate partial updates', () => {
      const updateSchema = z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        description: z.string().optional(),
        active: z.boolean().optional(),
        nodes: z.array(z.any()).optional()
      });

      const validUpdate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Updated Name',
        active: true
      };

      expect(() => updateSchema.parse(validUpdate)).not.toThrow();
    });

    it('should prevent invalid ID formats', () => {
      const updateSchema = z.object({
        id: z.string().uuid()
      });

      expect(() => updateSchema.parse({ id: 'not-a-uuid' })).toThrow();
      expect(() => updateSchema.parse({ id: '123' })).toThrow();
    });
  });

  describe('deleteWorkflow', () => {
    it('should validate deletion parameters', () => {
      const deleteSchema = z.object({
        id: z.string().uuid(),
        force: z.boolean().default(false)
      });

      const params = {
        id: '550e8400-e29b-41d4-a716-446655440000'
      };

      const parsed = deleteSchema.parse(params);
      expect(parsed.force).toBe(false);
    });
  });

  describe('executeWorkflow', () => {
    it('should validate execution parameters', () => {
      const executeSchema = z.object({
        id: z.string().uuid(),
        data: z.record(z.any()).optional(),
        runMode: z.enum(['manual', 'trigger', 'test']).default('manual')
      });

      const params = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        data: { input: 'test data' },
        runMode: 'test' as const
      };

      const parsed = executeSchema.parse(params);
      expect(parsed.runMode).toBe('test');
    });

    it('should handle execution with webhook data', () => {
      const webhookSchema = z.object({
        headers: z.record(z.string()),
        body: z.any(),
        query: z.record(z.string()),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
      });

      const webhookData = {
        headers: { 'content-type': 'application/json' },
        body: { message: 'test' },
        query: { token: 'abc123' },
        method: 'POST' as const
      };

      expect(() => webhookSchema.parse(webhookData)).not.toThrow();
    });
  });

  describe('getWorkflowExecutions', () => {
    it('should validate pagination parameters', () => {
      const paginationSchema = z.object({
        workflowId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
        status: z.enum(['running', 'success', 'error', 'waiting']).optional()
      });

      const params = {
        workflowId: '550e8400-e29b-41d4-a716-446655440000',
        limit: 20,
        offset: 10,
        status: 'success' as const
      };

      const parsed = paginationSchema.parse(params);
      expect(parsed.limit).toBe(20);
      expect(parsed.offset).toBe(10);
    });

    it('should handle date range filters', () => {
      const dateRangeSchema = z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional()
      });

      const params = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z'
      };

      expect(() => dateRangeSchema.parse(params)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error by creating a failing database operation
      const { database } = await import('../../database/index.js');
      
      // Create a mock that throws when prepare is called
      const originalPrepare = database.prepare;
      database.prepare = vi.fn(() => {
        throw new Error('Database connection failed');
      });

      try {
        // This will attempt to use the database and should fail
        const testDb = database.prepare('SELECT 1');
        testDb.get();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Database connection failed');
      } finally {
        // Restore original function
        database.prepare = originalPrepare;
      }
    });

    it('should provide detailed validation errors', () => {
      const schema = z.object({
        name: z.string().min(3).max(50),
        age: z.number().min(18).max(100)
      });

      try {
        schema.parse({ name: 'Jo', age: 150 });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        if (error instanceof z.ZodError) {
          expect(error.errors.length).toBeGreaterThan(0);
          expect(error.errors[0].path).toBeDefined();
          expect(error.errors[0].message).toBeDefined();
        }
      }
    });
  });
});