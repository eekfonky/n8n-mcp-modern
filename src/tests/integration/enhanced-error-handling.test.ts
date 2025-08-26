/**
 * Integration tests for Enhanced Error Handling (Story 2.2)
 * Validates user-friendly error messages and troubleshooting guidance
 */

import { describe, expect, it } from 'vitest'
import { EnhancedN8NMcpError } from '../../types/enhanced-errors.js'
import { EnhancedErrorHandler, ErrorUtils } from '../../utils/enhanced-error-handler.js'

describe('enhanced Error Handling Integration', () => {
  describe('enhancedErrorHandler', () => {
    it('creates user-friendly API not configured errors', () => {
      const error = EnhancedErrorHandler.createApiNotConfiguredError('test_tool')

      expect(error).toBeInstanceOf(EnhancedN8NMcpError)
      expect(error.category).toBe('feature_unavailable')
      expect(error.message).toContain('requires n8n API configuration')
      expect(error.troubleshooting).toHaveLength(2)
      expect(error.quickFixes).toBeDefined()
    })

    it('handles timeout errors with specific guidance', () => {
      const error = EnhancedErrorHandler.createTimeoutError('test_tool', 5000)

      expect(error).toBeInstanceOf(EnhancedN8NMcpError)
      expect(error.category).toBe('timeout')
      expect(error.message).toContain('5000ms')
      expect(error.troubleshooting.length).toBeGreaterThan(0)
    })

    it('creates validation errors with helpful format guidance', () => {
      const error = EnhancedErrorHandler.createValidationError(
        'test_tool',
        'workflow_id',
        'string (UUID format)',
      )

      expect(error).toBeInstanceOf(EnhancedN8NMcpError)
      expect(error.category).toBe('validation')
      expect(error.message).toContain('workflow_id')
      expect(error.message).toContain('string (UUID format)')
    })

    it('transforms technical errors into user-friendly responses', () => {
      const technicalError = new Error('ECONNREFUSED 127.0.0.1:5678')

      const response = EnhancedErrorHandler.handleToolError(
        technicalError,
        {
          toolName: 'get_n8n_workflows',
          operation: 'fetch workflows',
          apiUrl: 'http://localhost:5678',
        },
      )

      expect(response.success).toBe(false)
      expect(response.category).toBe('connectivity')
      expect(response.error).not.toContain('ECONNREFUSED')
      expect(response.help.troubleshooting.length).toBeGreaterThan(0)
      expect(response.help.quickFixes.length).toBeGreaterThan(0)
    })

    it('provides progressive error detail', () => {
      const error = new Error('Network timeout')

      // Basic response (default)
      const basicResponse = EnhancedErrorHandler.getProgressiveError(
        error,
        { toolName: 'test_tool', operation: 'test operation' },
        false,
      )

      expect(basicResponse.helpHint).toContain('includeDetails: true')
      expect(basicResponse.detailedHelp).toBeUndefined()

      // Detailed response
      const detailedResponse = EnhancedErrorHandler.getProgressiveError(
        error,
        { toolName: 'test_tool', operation: 'test operation' },
        true,
      )

      expect(detailedResponse.detailedHelp).toBeDefined()
      expect(detailedResponse.detailedHelp.technicalDetails).toBeDefined()
    })
  })

  describe('errorUtils.withEnhancedErrorHandling', () => {
    it('wraps successful operations transparently', async () => {
      const result = await ErrorUtils.withEnhancedErrorHandling(
        async () => ({ data: 'success', status: 'ok' }),
        {
          toolName: 'test_tool',
          operation: 'test operation',
        },
      )

      expect(result.data).toBe('success')
      expect(result.status).toBe('ok')
    })

    it('transforms errors using enhanced error handling', async () => {
      let thrownError: any = null

      try {
        await ErrorUtils.withEnhancedErrorHandling(
          async () => {
            throw new Error('Connection timeout after 5000ms')
          },
          {
            toolName: 'test_tool',
            operation: 'test operation',
          },
        )
      }
      catch (error) {
        thrownError = JSON.parse((error as Error).message)
      }

      expect(thrownError).toBeDefined()
      expect(thrownError.success).toBe(false)
      expect(thrownError.category).toBe('timeout')
      expect(thrownError.help).toBeDefined()
      expect(thrownError.help.troubleshooting).toBeDefined()
    })

    it('categorizes different error types correctly', async () => {
      const testCases = [
        {
          error: new Error('N8N_API_URL not configured'),
          expectedCategory: 'configuration',
        },
        {
          error: new Error('ECONNREFUSED connection failed'),
          expectedCategory: 'connectivity',
        },
        {
          error: new Error('Required field "workflow_id" missing'),
          expectedCategory: 'validation',
        },
        {
          error: new Error('Network request timed out'),
          expectedCategory: 'connectivity',
        },
      ]

      for (const testCase of testCases) {
        let errorResponse: any = null

        try {
          await ErrorUtils.withEnhancedErrorHandling(
            async () => { throw testCase.error },
            { toolName: 'test_tool', operation: 'test' },
          )
        }
        catch (error) {
          errorResponse = JSON.parse((error as Error).message)
        }

        expect(errorResponse?.category).toBe(testCase.expectedCategory)
      }
    })
  })

  describe('error Message Templates', () => {
    it('provides actionable troubleshooting steps for configuration errors', () => {
      const error = EnhancedErrorHandler.createApiNotConfiguredError('test_tool')
      const response = error.toUserFriendlyResponse()

      expect(response.help.troubleshooting.some(step =>
        step.action.toLowerCase().includes('api url') || step.action.toLowerCase().includes('n8n'),
      )).toBe(true)
      expect(response.help.quickFixes.some(fix =>
        fix.includes('validate_mcp_config'),
      )).toBe(true)
    })

    it('includes specific commands for troubleshooting', () => {
      const error = EnhancedErrorHandler.createApiNotConfiguredError('test_tool')
      const response = error.toUserFriendlyResponse(true)

      const hasCommand = response.detailedHelp?.technicalDetails
        || error.troubleshooting.some(step => step.command?.includes('mcp-tool'))

      expect(hasCommand).toBeTruthy()
    })
  })
})
