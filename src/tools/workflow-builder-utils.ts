/**
 * Iterative Workflow Builder Utilities
 * Security-hardened helper functions for step-by-step workflow construction
 */

import type { SimpleN8nApi } from '../n8n/simple-api.js'
import type { N8NWorkflowNode } from '../types/core.js'
import { Buffer } from 'node:buffer'
import * as crypto from 'node:crypto'
import { logger } from '../server/logger.js'

// Additional type definitions
export interface ExecutionResult {
  status: 'success' | 'error' | 'running'
  data?: unknown
  timestamp: Date
  error?: string
}

// Security-hardened interfaces
export interface IterativeBuildSession {
  workflowId: string
  sessionId: string // Cryptographically secure UUID
  currentNodes: N8NWorkflowNode[] // Sanitized and validated nodes
  validationHistory: ValidationResult[] // Audit trail
  checkpoints: SecureCheckpoint[] // Encrypted with integrity checks
  mode: 'incremental'
  nextNodeSuggestions?: string[] // Filtered safe suggestions
  securityContext: SecurityContext
}

export interface SecureCheckpoint {
  id: number
  nodesHash: string // Integrity verification
  encryptedNodes: string // AES encrypted node data
  timestamp: string
  signature: string // Tamper detection
}

export interface SecurityContext {
  createdAt: Date
  expiresAt: Date // 30 minute timeout
  permissions: string[] // Limited permissions
  rateLimits: RateLimit
  auditLog: AuditEntry[]
}

export interface RateLimit {
  maxNodesPerSession: number // Default: 50
  maxCheckpoints: number // Default: 10
  operationsPerMinute: number // Default: 10
  currentOperations: number
  lastOperationTime: Date
}

export interface AuditEntry {
  timestamp: Date
  operation: string
  nodeType?: string
  success: boolean
  error?: string
  sessionId: string
}

export interface ValidationResult {
  nodeIndex: number
  nodeType: string
  status: 'success' | 'warning' | 'error'
  message: string
  executionResult?: ExecutionResult | null
  timestamp: Date
}

// Security constants
const SESSION_TIMEOUT_MINUTES = 30
const MAX_NODES_PER_WORKFLOW = 50
const MAX_CHECKPOINTS = 10
const MAX_OPERATIONS_PER_MINUTE = 10
const ENCRYPTION_ALGORITHM = 'aes-256-gcm'

// Approved node types whitelist (can be extended)
const APPROVED_NODE_TYPES = [
  'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.set',
  'n8n-nodes-base.if',
  'n8n-nodes-base.merge',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.csv',
  'n8n-nodes-base.json',
  'n8n-nodes-base.emailSend',
  'n8n-nodes-base.slack',
  // Add more as needed, validated against n8n schema
]

/**
 * Session Management Utilities
 */
export class SecureSessionManager {
  private static sessions = new Map<string, IterativeBuildSession>()

  /**
   * Create a new secure iterative build session
   */
  static createSession(workflowId: string): IterativeBuildSession {
    const sessionId = crypto.randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MINUTES * 60 * 1000)

    const session: IterativeBuildSession = {
      workflowId,
      sessionId,
      currentNodes: [],
      validationHistory: [],
      checkpoints: [],
      mode: 'incremental',
      securityContext: {
        createdAt: now,
        expiresAt,
        permissions: ['add_node', 'test_node', 'checkpoint', 'rollback'],
        rateLimits: {
          maxNodesPerSession: MAX_NODES_PER_WORKFLOW,
          maxCheckpoints: MAX_CHECKPOINTS,
          operationsPerMinute: MAX_OPERATIONS_PER_MINUTE,
          currentOperations: 0,
          lastOperationTime: now,
        },
        auditLog: [{
          timestamp: now,
          operation: 'session_created',
          success: true,
          sessionId,
        }],
      },
    }

    // Create initial checkpoint
    this.createCheckpoint(session, 'initial')

    this.sessions.set(sessionId, session)
    logger.info(`Created secure iterative session: ${sessionId}`)

    return session
  }

  /**
   * Validate session and check security constraints
   */
  static validateSession(sessionId: string): IterativeBuildSession | null {
    const session = this.sessions.get(sessionId)

    if (!session) {
      logger.warn(`Session not found: ${sessionId}`)
      return null
    }

    // Check timeout
    if (new Date() > session.securityContext.expiresAt) {
      logger.warn(`Session expired: ${sessionId}`)
      this.cleanupSession(sessionId)
      return null
    }

    return session
  }

  /**
   * Check rate limits
   */
  static checkRateLimit(session: IterativeBuildSession): boolean {
    const now = new Date()
    const minuteAgo = new Date(now.getTime() - 60 * 1000)

    // Reset counter if more than a minute has passed
    if (session.securityContext.rateLimits.lastOperationTime < minuteAgo) {
      session.securityContext.rateLimits.currentOperations = 0
    }

    // Check limit
    if (session.securityContext.rateLimits.currentOperations
      >= session.securityContext.rateLimits.operationsPerMinute) {
      logger.warn(`Rate limit exceeded for session: ${session.sessionId}`)
      return false
    }

    // Increment counter
    session.securityContext.rateLimits.currentOperations++
    session.securityContext.rateLimits.lastOperationTime = now

    return true
  }

  /**
   * Clean up expired or completed sessions
   */
  static cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId)
    logger.info(`Cleaned up session: ${sessionId}`)
  }

  /**
   * Create encrypted checkpoint
   */
  static createCheckpoint(session: IterativeBuildSession, type: string = 'manual'): boolean {
    if (session.checkpoints.length >= MAX_CHECKPOINTS) {
      // Remove oldest checkpoint
      session.checkpoints.shift()
    }

    try {
      const checkpointId = session.checkpoints.length
      const nodesData = JSON.stringify(session.currentNodes)
      const nodesHash = crypto.createHash('sha256').update(nodesData).digest('hex')

      // Encrypt nodes data
      const key = crypto.scryptSync(session.sessionId, 'salt', 32)
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv)

      let encryptedNodes = cipher.update(nodesData, 'utf8', 'hex')
      encryptedNodes += cipher.final('hex')

      // Prepend IV to encrypted data for later decryption
      encryptedNodes = iv.toString('hex') + encryptedNodes

      // Create signature for tamper detection
      const signature = crypto
        .createHmac('sha256', session.sessionId)
        .update(nodesHash + encryptedNodes)
        .digest('hex')

      const checkpoint: SecureCheckpoint = {
        id: checkpointId,
        nodesHash,
        encryptedNodes,
        timestamp: new Date().toISOString(),
        signature,
      }

      session.checkpoints.push(checkpoint)

      // Audit log
      session.securityContext.auditLog.push({
        timestamp: new Date(),
        operation: `checkpoint_created_${type}`,
        success: true,
        sessionId: session.sessionId,
      })

      logger.debug(`Created checkpoint ${checkpointId} for session: ${session.sessionId}`)
      return true
    }
    catch (error) {
      logger.error(`Failed to create checkpoint: ${error}`)
      return false
    }
  }
}

/**
 * Node Management Utilities
 */
export class SecureNodeManager {
  /**
   * Validate node type against whitelist
   */
  static validateNodeType(nodeType: string): boolean {
    return APPROVED_NODE_TYPES.includes(nodeType)
  }

  /**
   * Sanitize node parameters
   */
  static sanitizeNode(node: Partial<N8NWorkflowNode>): N8NWorkflowNode {
    // Remove potentially dangerous properties using safe object creation
    const sanitized = Object.create(null)
    // Copy only safe properties, excluding prototype chain
    for (const [key, value] of Object.entries(node)) {
      if (key !== '__proto__' && key !== 'constructor' && typeof value !== 'function') {
        sanitized[key] = value
      }
    }

    // Validate required properties
    if (!sanitized.type || !this.validateNodeType(sanitized.type)) {
      throw new Error(`Invalid or unauthorized node type: ${sanitized.type}`)
    }

    // Ensure node has required structure - cast to satisfy type checker
    const completeNode: N8NWorkflowNode = {
      id: sanitized.id || crypto.randomUUID(),
      name: sanitized.name || sanitized.type,
      type: sanitized.type,
      parameters: sanitized.parameters || {},
      position: sanitized.position || [100, 100],
      typeVersion: sanitized.typeVersion || 1,
    }

    return completeNode
  }

  /**
   * Add node to workflow with security validation
   */
  static async addNodeToWorkflow(
    session: IterativeBuildSession,
    node: Partial<N8NWorkflowNode>,
    api: SimpleN8nApi,
  ): Promise<boolean> {
    try {
      // Security checks
      if (!SecureSessionManager.checkRateLimit(session)) {
        throw new Error('Rate limit exceeded')
      }

      if (session.currentNodes.length >= MAX_NODES_PER_WORKFLOW) {
        throw new Error(`Maximum nodes limit reached: ${MAX_NODES_PER_WORKFLOW}`)
      }

      // Sanitize and validate node
      const sanitizedNode = this.sanitizeNode(node)

      // Add to session
      session.currentNodes.push(sanitizedNode)

      // Update workflow via API
      const updateResult = await api.updateWorkflow(session.workflowId, {
        nodes: session.currentNodes,
      })

      if (!updateResult) {
        // Rollback on failure
        session.currentNodes.pop()
        throw new Error('Failed to update workflow via API')
      }

      // Audit log
      session.securityContext.auditLog.push({
        timestamp: new Date(),
        operation: 'node_added',
        nodeType: sanitizedNode.type,
        success: true,
        sessionId: session.sessionId,
      })

      logger.info(`Added node ${sanitizedNode.type} to workflow ${session.workflowId}`)
      return true
    }
    catch (error) {
      // Audit log failure
      session.securityContext.auditLog.push({
        timestamp: new Date(),
        operation: 'node_add_failed',
        nodeType: node?.type || 'unknown',
        success: false,
        error: String(error),
        sessionId: session.sessionId,
      })

      logger.error(`Failed to add node: ${error}`)
      return false
    }
  }

  /**
   * Test workflow execution in sandbox mode
   */
  static async testWorkflow(
    session: IterativeBuildSession,
    api: SimpleN8nApi,
  ): Promise<ValidationResult | null> {
    try {
      // Security check
      if (!SecureSessionManager.checkRateLimit(session)) {
        throw new Error('Rate limit exceeded')
      }

      // Execute workflow in test mode
      const executionResult = await api.executeWorkflow(session.workflowId, {
        mode: 'test',
        timeout: 30000, // 30 second timeout for safety
        sandbox: true, // Execute in isolated environment
      })

      const lastNodeIndex = session.currentNodes.length - 1
      const lastNode = session.currentNodes[lastNodeIndex]

      const validationResult: ValidationResult = {
        nodeIndex: lastNodeIndex,
        nodeType: lastNode?.type || 'unknown',
        status: executionResult ? 'success' : 'error',
        message: executionResult ? 'Node executed successfully' : 'Execution failed',
        executionResult: this.sanitizeExecutionResult(executionResult),
        timestamp: new Date(),
      }

      session.validationHistory.push(validationResult)

      // Audit log
      session.securityContext.auditLog.push({
        timestamp: new Date(),
        operation: 'workflow_tested',
        success: validationResult.status === 'success',
        sessionId: session.sessionId,
      })

      return validationResult
    }
    catch (error) {
      logger.error(`Failed to test workflow: ${error}`)
      return null
    }
  }

  /**
   * Sanitize execution results for safe output
   */
  private static sanitizeExecutionResult(result: unknown): ExecutionResult | null {
    if (!result)
      return null

    // Type guard for result object
    if (typeof result !== 'object' || result === null)
      return null

    const resultObj = result as Record<string, unknown>

    // Remove sensitive data and limit output size
    const sanitized: ExecutionResult = {
      status: (resultObj.status as 'success' | 'error' | 'running') || 'error',
      timestamp: resultObj.timestamp instanceof Date ? resultObj.timestamp : new Date(),
      // Remove any credentials, tokens, or sensitive fields
    }

    // Add optional properties conditionally
    if (resultObj.data) {
      sanitized.data = String(resultObj.data).substring(0, 1000) // Limit to 1KB
    }
    if (resultObj.error) {
      sanitized.error = String(resultObj.error)
    }

    return sanitized
  }
}

/**
 * Rollback Management
 */
export class SecureRollbackManager {
  /**
   * Rollback to previous checkpoint
   */
  static async rollbackToCheckpoint(
    session: IterativeBuildSession,
    checkpointId: number,
    api: SimpleN8nApi,
  ): Promise<boolean> {
    try {
      // Security checks
      if (!SecureSessionManager.checkRateLimit(session)) {
        throw new Error('Rate limit exceeded')
      }

      if (checkpointId < 0 || checkpointId >= session.checkpoints.length) {
        throw new Error('Invalid checkpoint ID')
      }

      const checkpoint = session.checkpoints[checkpointId]
      if (!checkpoint) {
        throw new Error('Checkpoint not found')
      }

      // Verify checkpoint integrity
      if (!this.verifyCheckpointIntegrity(checkpoint, session.sessionId)) {
        throw new Error('Checkpoint integrity check failed - possible tampering')
      }

      // Decrypt checkpoint data
      const restoredNodes = this.decryptCheckpoint(checkpoint, session.sessionId)
      if (!restoredNodes) {
        throw new Error('Failed to decrypt checkpoint data')
      }

      // Update workflow via API
      const updateResult = await api.updateWorkflow(session.workflowId, {
        nodes: restoredNodes,
      })

      if (!updateResult) {
        throw new Error('Failed to update workflow during rollback')
      }

      // Update session state
      session.currentNodes = restoredNodes

      // Remove checkpoints after the rollback point
      session.checkpoints = session.checkpoints.slice(0, checkpointId + 1)

      // Audit log
      session.securityContext.auditLog.push({
        timestamp: new Date(),
        operation: `rollback_to_checkpoint_${checkpointId}`,
        success: true,
        sessionId: session.sessionId,
      })

      logger.info(`Rolled back session ${session.sessionId} to checkpoint ${checkpointId}`)
      return true
    }
    catch (error) {
      logger.error(`Rollback failed: ${error}`)
      return false
    }
  }

  /**
   * Verify checkpoint integrity
   */
  private static verifyCheckpointIntegrity(checkpoint: SecureCheckpoint, sessionId: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', sessionId)
        .update(checkpoint.nodesHash + checkpoint.encryptedNodes)
        .digest('hex')

      return expectedSignature === checkpoint.signature
    }
    catch (error) {
      logger.error(`Integrity check failed: ${error}`)
      return false
    }
  }

  /**
   * Decrypt checkpoint data
   */
  private static decryptCheckpoint(checkpoint: SecureCheckpoint, sessionId: string): N8NWorkflowNode[] | null {
    try {
      const key = crypto.scryptSync(sessionId, 'salt', 32)
      // Extract IV from encrypted data (first 16 bytes when hex encoded = 32 chars)
      const iv = Buffer.from(checkpoint.encryptedNodes.slice(0, 32), 'hex')
      const encryptedData = checkpoint.encryptedNodes.slice(32)
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      const nodes = JSON.parse(decrypted) as N8NWorkflowNode[]

      // Verify hash
      const nodesHash = crypto.createHash('sha256').update(decrypted).digest('hex')
      if (nodesHash !== checkpoint.nodesHash) {
        throw new Error('Checkpoint hash mismatch')
      }

      return nodes
    }
    catch (error) {
      logger.error(`Decryption failed: ${error}`)
      return null
    }
  }
}

// Export utility functions for easy access
export const WorkflowBuilderUtils = {
  SessionManager: SecureSessionManager,
  NodeManager: SecureNodeManager,
  RollbackManager: SecureRollbackManager,
}
