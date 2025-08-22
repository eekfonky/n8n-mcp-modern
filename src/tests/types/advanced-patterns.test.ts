/**
 * Advanced TypeScript Patterns Tests
 * Tests for TypeScript 5.9+ features, branded types, and advanced patterns
 */

import type {
  DeepReadonly,
  ExecutionId,
  ExecutionRow,
  NodeId,
  NodeRow,
  NonEmptyArray,
  OptionalizeUndefined,
  RequireAtLeastOne,
  SafeOmit,
  StrictExtract,
  TimestampedData,
  WorkflowExecutionResult,
  WorkflowId,
  WorkflowRow,
} from '../../types/advanced-patterns.js'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  asyncFailure,
  asyncSuccess,
  createExecutionId,
  createExecutionRow,
  createNodeId,
  createNodeRow,
  createNonEmptyArray,
  createTimestamped,
  createWorkflowId,
  createWorkflowRow,
  extractExecutionData,
  extractExecutionError,
  failure,
  flatMap,
  head,
  isExpired,
  isFailure,
  isNonEmptyArray,
  isSuccess,
  isWorkflowExecutionError,
  isWorkflowExecutionSuccess,
  last,
  map,
  match,
  success,
  tail,
  validateExecutionId,
  validateNodeId,
  validateWorkflowId,
} from '../../types/advanced-patterns.js'

describe('advanced TypeScript Patterns Tests', () => {
  describe('branded Types', () => {
    describe('workflowId', () => {
      it('should create valid workflow IDs', () => {
        const validId = 'workflow_123'
        const workflowId = createWorkflowId(validId)

        expect(workflowId).toBe(validId)
        expectTypeOf(workflowId).toEqualTypeOf<WorkflowId>()
      })

      it('should validate workflow ID format', () => {
        expect(validateWorkflowId('workflow_123')).toBe(true)
        expect(validateWorkflowId('wf_456')).toBe(true)
        expect(validateWorkflowId('123')).toBe(false)
        expect(validateWorkflowId('')).toBe(false)
        expect(validateWorkflowId('workflow')).toBe(false)
      })

      it('should throw for invalid workflow IDs', () => {
        expect(() => createWorkflowId('invalid')).toThrow('Invalid workflow ID format')
        expect(() => createWorkflowId('')).toThrow('Invalid workflow ID format')
      })
    })

    describe('nodeId', () => {
      it('should create valid node IDs', () => {
        const validId = 'node_abc123'
        const nodeId = createNodeId(validId)

        expect(nodeId).toBe(validId)
        expectTypeOf(nodeId).toEqualTypeOf<NodeId>()
      })

      it('should validate node ID format', () => {
        expect(validateNodeId('node_123')).toBe(true)
        expect(validateNodeId('n_456')).toBe(true)
        expect(validateNodeId('123')).toBe(false)
        expect(validateNodeId('')).toBe(false)
      })
    })

    describe('executionId', () => {
      it('should create valid execution IDs', () => {
        const validId = 'exec_xyz789'
        const execId = createExecutionId(validId)

        expect(execId).toBe(validId)
        expectTypeOf(execId).toEqualTypeOf<ExecutionId>()
      })

      it('should validate execution ID format', () => {
        expect(validateExecutionId('exec_123')).toBe(true)
        expect(validateExecutionId('execution_456')).toBe(true)
        expect(validateExecutionId('123')).toBe(false)
        expect(validateExecutionId('')).toBe(false)
      })
    })
  })

  describe('discriminated Unions', () => {
    describe('workflowExecutionResult', () => {
      it('should create success results', () => {
        const successResult: WorkflowExecutionResult = {
          state: 'success',
          data: [{ output: 'test' }],
          duration: 1500,
        }

        expect(isWorkflowExecutionSuccess(successResult)).toBe(true)
        expect(isWorkflowExecutionError(successResult)).toBe(false)

        if (isWorkflowExecutionSuccess(successResult)) {
          expectTypeOf(successResult.data).toEqualTypeOf<readonly unknown[]>()
          expectTypeOf(successResult.duration).toEqualTypeOf<number>()
        }
      })

      it('should create error results', () => {
        const errorResult: WorkflowExecutionResult = {
          state: 'error',
          error: new Error('Execution failed'),
          node: 'node_123',
        }

        expect(isWorkflowExecutionError(errorResult)).toBe(true)
        expect(isWorkflowExecutionSuccess(errorResult)).toBe(false)

        if (isWorkflowExecutionError(errorResult)) {
          expectTypeOf(errorResult.error).toEqualTypeOf<Error>()
          expectTypeOf(errorResult.node).toEqualTypeOf<string | undefined>()
        }
      })

      it('should extract data from success results', () => {
        const successResult: WorkflowExecutionResult = {
          state: 'success',
          data: [{ key: 'value' }],
          duration: 1000,
        }

        const data = extractExecutionData(successResult)
        expect(data).toEqual([{ key: 'value' }])
      })

      it('should extract error from error results', () => {
        const error = new Error('Test error')
        const errorResult: WorkflowExecutionResult = {
          state: 'error',
          error,
        }

        const extractedError = extractExecutionError(errorResult)
        expect(extractedError).toBe(error)
      })

      it('should return null for wrong result type extraction', () => {
        const successResult: WorkflowExecutionResult = {
          state: 'success',
          data: [],
          duration: 500,
        }

        const error = extractExecutionError(successResult)
        expect(error).toBeNull()
      })
    })
  })

  describe('result Type (Railway-oriented Programming)', () => {
    describe('basic Result Operations', () => {
      it('should create success results', () => {
        const result = success('test value')

        expect(isSuccess(result)).toBe(true)
        expect(isFailure(result)).toBe(false)

        if (isSuccess(result)) {
          expect(result.value).toBe('test value')
        }
      })

      it('should create failure results', () => {
        const error = new Error('Test error')
        const result = failure(error)

        expect(isFailure(result)).toBe(true)
        expect(isSuccess(result)).toBe(false)

        if (isFailure(result)) {
          expect(result.error).toBe(error)
        }
      })
    })

    describe('result Transformations', () => {
      it('should map over success values', () => {
        const result = success(5)
        const mapped = map(result, x => x * 2)

        expect(isSuccess(mapped)).toBe(true)
        if (isSuccess(mapped)) {
          expect(mapped.value).toBe(10)
        }
      })

      it('should not map over failure values', () => {
        const error = new Error('Test error')
        const result = failure(error)
        const mapped = map(result, x => x * 2)

        expect(isFailure(mapped)).toBe(true)
        if (isFailure(mapped)) {
          expect(mapped.error).toBe(error)
        }
      })

      it('should flatMap success values', () => {
        const result = success(5)
        const flatMapped = flatMap(result, x => success(x.toString()))

        expect(isSuccess(flatMapped)).toBe(true)
        if (isSuccess(flatMapped)) {
          expect(flatMapped.value).toBe('5')
        }
      })

      it('should flatMap failure values', () => {
        const error = new Error('Test error')
        const result = failure(error)
        const flatMapped = flatMap(result, x => success(x.toString()))

        expect(isFailure(flatMapped)).toBe(true)
        if (isFailure(flatMapped)) {
          expect(flatMapped.error).toBe(error)
        }
      })

      it('should handle flatMap returning failure', () => {
        const result = success(5)
        const error = new Error('Transformation error')
        const flatMapped = flatMap(result, _x => failure(error))

        expect(isFailure(flatMapped)).toBe(true)
        if (isFailure(flatMapped)) {
          expect(flatMapped.error).toBe(error)
        }
      })
    })

    describe('pattern Matching', () => {
      it('should match on success values', () => {
        const result = success('hello')
        const matched = match(result, {
          success: value => `Success: ${value}`,
          failure: error => `Error: ${error.message}`,
        })

        expect(matched).toBe('Success: hello')
      })

      it('should match on failure values', () => {
        const error = new Error('Test error')
        const result = failure(error)
        const matched = match(result, {
          success: value => `Success: ${value}`,
          failure: error => `Error: ${error.message}`,
        })

        expect(matched).toBe('Error: Test error')
      })
    })

    describe('async Results', () => {
      it('should create async success results', async () => {
        const result = await asyncSuccess('async value')

        expect(isSuccess(result)).toBe(true)
        if (isSuccess(result)) {
          expect(result.value).toBe('async value')
        }
      })

      it('should create async failure results', async () => {
        const error = new Error('Async error')
        const result = await asyncFailure(error)

        expect(isFailure(result)).toBe(true)
        if (isFailure(result)) {
          expect(result.error).toBe(error)
        }
      })

      it('should chain async results', async () => {
        const initial = await asyncSuccess(10)
        const doubled = map(initial, x => x * 2)
        const stringified = flatMap(doubled, x => success(x.toString()))

        expect(isSuccess(stringified)).toBe(true)
        if (isSuccess(stringified)) {
          expect(stringified.value).toBe('20')
        }
      })
    })
  })

  describe('timestamped Data', () => {
    it('should create timestamped data', () => {
      const data = { message: 'hello' }
      const timestamped = createTimestamped(data)

      expect(timestamped.data).toBe(data)
      expect(typeof timestamped.timestamp).toBe('number')
      expect(timestamped.timestamp).toBeGreaterThan(0)
    })

    it('should check expiration', () => {
      const data = { message: 'hello' }
      const timestamped = createTimestamped(data)

      // Should not be expired immediately
      expect(isExpired(timestamped, 1000)).toBe(false)

      // Simulate old data
      const oldTimestamped: TimestampedData<typeof data> = {
        data,
        timestamp: Date.now() - 2000, // 2 seconds ago
      }

      expect(isExpired(oldTimestamped, 1000)).toBe(true) // 1 second TTL
    })

    it('should handle zero TTL', () => {
      const data = { message: 'hello' }
      const timestamped = createTimestamped(data)

      // Zero TTL should always be expired
      expect(isExpired(timestamped, 0)).toBe(true)
    })
  })

  describe('database Row Types', () => {
    it('should create node rows', () => {
      const nodeData = {
        name: 'Test Node',
        displayName: 'Test Display Name',
        description: 'Test description',
        category: 'test',
        version: 1,
        properties: {},
        credentials: [],
        defaults: {},
      }

      const nodeRow = createNodeRow('test-node', nodeData)

      expect(nodeRow.type).toBe('test-node')
      expect(nodeRow.name).toBe('Test Node')
      expectTypeOf(nodeRow).toEqualTypeOf<NodeRow>()
    })

    it('should create workflow rows', () => {
      const workflowData = {
        name: 'Test Workflow',
        active: true,
        nodes: [],
        connections: {},
        settings: {},
        tags: [],
      }

      const workflowRow = createWorkflowRow('123', workflowData)

      expect(workflowRow.id).toBe(123)
      expect(workflowRow.name).toBe('Test Workflow')
      expectTypeOf(workflowRow).toEqualTypeOf<WorkflowRow>()
    })

    it('should create execution rows', () => {
      const executionData = {
        workflowId: '123',
        status: 'success' as const,
        startTime: Date.now(),
        endTime: Date.now() + 1000,
        data: { result: 'success' },
        error: null,
      }

      const executionRow = createExecutionRow('456', executionData)

      expect(executionRow.id).toBe(456)
      expect(executionRow.workflowId).toBe(123)
      expectTypeOf(executionRow).toEqualTypeOf<ExecutionRow>()
    })
  })

  describe('advanced Type Utilities', () => {
    describe('optionalizeUndefined', () => {
      it('should make undefined properties optional', () => {
        interface Test {
          required: string
          optional: string | undefined
          nullable: string | null
          both: string | null | undefined
        }

        type Optimized = OptionalizeUndefined<Test>

        // Type-only test
        expectTypeOf<Optimized>().toEqualTypeOf<{
          required: string
          optional?: string
          nullable: string | null
          both?: string | null
        }>()
      })
    })

    describe('requireAtLeastOne', () => {
      it('should require at least one property', () => {
        interface Options {
          name?: string
          id?: number
          email?: string
        }

        type RequiredOptions = RequireAtLeastOne<Options>

        // Type-only tests - these should compile
        const valid1: RequiredOptions = { name: 'test' }
        const valid2: RequiredOptions = { id: 123 }
        const valid3: RequiredOptions = { email: 'test@example.com' }
        const valid4: RequiredOptions = { name: 'test', id: 123 }

        expect(valid1.name).toBe('test')
        expect(valid2.id).toBe(123)
        expect(valid3.email).toBe('test@example.com')
        expect(valid4.name).toBe('test')
        expect(valid4.id).toBe(123)
      })
    })

    describe('deepReadonly', () => {
      it('should make nested objects readonly', () => {
        interface Nested {
          user: {
            profile: {
              name: string
              settings: {
                theme: string
              }
            }
          }
          tags: string[]
        }

        type ReadonlyNested = DeepReadonly<Nested>

        // Type-only test
        expectTypeOf<ReadonlyNested>().toMatchTypeOf<{
          readonly user: {
            readonly profile: {
              readonly name: string
              readonly settings: {
                readonly theme: string
              }
            }
          }
          readonly tags: readonly string[]
        }>()
      })
    })

    describe('safeOmit', () => {
      it('should omit keys safely', () => {
        interface User {
          id: string
          name: string
          email: string
          password: string
        }

        type PublicUser = SafeOmit<User, 'password'>

        expectTypeOf<PublicUser>().toEqualTypeOf<{
          id: string
          name: string
          email: string
        }>()
      })
    })

    describe('strictExtract', () => {
      it('should extract union types strictly', () => {
        type Status = 'pending' | 'success' | 'error' | 'cancelled'
        type FinalStatus = StrictExtract<Status, 'success' | 'error'>

        expectTypeOf<FinalStatus>().toEqualTypeOf<'success' | 'error'>()
      })
    })
  })

  describe('nonEmpty Arrays', () => {
    it('should create non-empty arrays', () => {
      const arr = createNonEmptyArray([1, 2, 3])

      expect(arr).toEqual([1, 2, 3])
      expectTypeOf(arr).toEqualTypeOf<NonEmptyArray<number>>()
    })

    it('should reject empty arrays', () => {
      expect(() => createNonEmptyArray([])).toThrow('Array cannot be empty')
    })

    it('should identify non-empty arrays', () => {
      expect(isNonEmptyArray([1, 2, 3])).toBe(true)
      expect(isNonEmptyArray([])).toBe(false)
      expect(isNonEmptyArray([0])).toBe(true)
      expect(isNonEmptyArray([''])).toBe(true)
    })

    it('should get head element', () => {
      const arr = createNonEmptyArray(['a', 'b', 'c'])
      const headElement = head(arr)

      expect(headElement).toBe('a')
      expectTypeOf(headElement).toEqualTypeOf<string>()
    })

    it('should get tail elements', () => {
      const arr = createNonEmptyArray([1, 2, 3, 4])
      const tailElements = tail(arr)

      expect(tailElements).toEqual([2, 3, 4])
      expectTypeOf(tailElements).toEqualTypeOf<number[]>()
    })

    it('should get last element', () => {
      const arr = createNonEmptyArray(['x', 'y', 'z'])
      const lastElement = last(arr)

      expect(lastElement).toBe('z')
      expectTypeOf(lastElement).toEqualTypeOf<string>()
    })

    it('should handle single-element arrays', () => {
      const arr = createNonEmptyArray([42])

      expect(head(arr)).toBe(42)
      expect(tail(arr)).toEqual([])
      expect(last(arr)).toBe(42)
    })
  })

  describe('type Safety and Compile-time Checks', () => {
    it('should enforce branded type safety at runtime', () => {
      const workflowId = createWorkflowId('workflow_123')
      const nodeId = createNodeId('node_456')

      // These should be different types despite same runtime value
      expect(workflowId).not.toBe(nodeId)
      expect(typeof workflowId).toBe('string')
      expect(typeof nodeId).toBe('string')

      // But TypeScript should treat them as different types
      expectTypeOf(workflowId).not.toEqualTypeOf<NodeId>()
      expectTypeOf(nodeId).not.toEqualTypeOf<WorkflowId>()
    })

    it('should maintain type information through transformations', () => {
      const data = [{ name: 'test' }]
      const result = success(data)
      const mapped = map(result, arr => arr.map(item => ({ ...item, processed: true })))

      if (isSuccess(mapped)) {
        expectTypeOf(mapped.value).toEqualTypeOf<Array<{ name: string, processed: boolean }>>()
        expect(mapped.value[0].name).toBe('test')
        expect(mapped.value[0].processed).toBe(true)
      }
    })

    it('should preserve immutability with readonly types', () => {
      const successResult: WorkflowExecutionResult = {
        state: 'success',
        data: [{ key: 'value' }],
        duration: 1000,
      }

      if (isWorkflowExecutionSuccess(successResult)) {
        expectTypeOf(successResult.data).toEqualTypeOf<readonly unknown[]>()
        // TypeScript should prevent mutation:
        // successResult.data.push({ new: 'item' }) // This would be a compile error
      }
    })
  })
})
