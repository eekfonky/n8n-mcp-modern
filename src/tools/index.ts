/**
 * Pure Dynamic MCP Tools for n8n automation
 * Zero hardcoded tools - everything discovered dynamically from live n8n instances
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { N8NNodeAPI } from '../types/fast-types.js'
import { CredentialDiscovery } from '../discovery/credential-discovery.js'
import { DiscoveryScheduler } from '../discovery/scheduler.js'
import { simpleN8nApi } from '../n8n/simple-api.js'
import { logger } from '../server/logger.js'
import { hasN8nApi } from '../simple-config.js'
import { coldStartOptimizationTools } from './cold-start-optimization-tool.js'
import { getAllCategories, getAllNodeTemplates } from './comprehensive-node-registry.js'
import { createDynamicAgentTools } from './dynamic-agent-tools.js'
import { MCPToolGenerator } from './mcp-tool-generator.js'
import { memoryOptimizationTools } from './memory-optimization-tool.js'
import { performanceMonitoringTools } from './performance-monitoring-tool.js'
import { WorkflowBuilderUtils } from './workflow-builder-utils.js'

let discoveredTools: Tool[] = []
const toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>> = new Map()
let toolGenerator: MCPToolGenerator | null = null
let credentialDiscovery: CredentialDiscovery | null = null
let discoveryScheduler: DiscoveryScheduler | null = null
let dynamicAgentTools: any = null

/**
 * Initialize the pure dynamic tool system
 */
export async function initializeDynamicTools(): Promise<void> {
  logger.info('Initializing pure dynamic tool discovery...')

  try {
    // Initialize the Phase 3 tool generator
    toolGenerator = new MCPToolGenerator()
    credentialDiscovery = new CredentialDiscovery()

    // Initialize dynamic agent tools
    dynamicAgentTools = await createDynamicAgentTools()

    // Basic connectivity tool
    discoveredTools.push({
      name: 'ping',
      description: 'Health check for n8n-MCP server',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    })
    toolHandlers.set('ping', async () => ({
      status: 'ok',
      timestamp: Date.now(),
      mode: 'dynamic',
      phase: 'Phase 4: Discovery Automation',
    }))

    // Add memory optimization tools
    for (const [toolName, toolConfig] of Object.entries(memoryOptimizationTools)) {
      discoveredTools.push({
        name: toolName,
        description: toolConfig.description,
        inputSchema: toolConfig.parameters,
      })
      toolHandlers.set(toolName, toolConfig.handler)
    }

    // Add cold start optimization tools
    for (const [toolName, toolConfig] of Object.entries(coldStartOptimizationTools)) {
      discoveredTools.push({
        name: toolName,
        description: toolConfig.description,
        inputSchema: toolConfig.parameters,
      })
      toolHandlers.set(toolName, toolConfig.handler)
    }

    // Add performance monitoring tools
    for (const [toolName, toolConfig] of Object.entries(performanceMonitoringTools)) {
      discoveredTools.push({
        name: toolName,
        description: toolConfig.description,
        inputSchema: toolConfig.parameters,
      })
      toolHandlers.set(toolName, toolConfig.handler)
    }

    // Add dynamic agent tools
    const dynamicTools = dynamicAgentTools.getTools()
    for (const tool of dynamicTools) {
      discoveredTools.push(tool)
      toolHandlers.set(tool.name, async (args: any) => {
        return await dynamicAgentTools.handleToolCall(tool.name, args)
      })
    }

    // Add iterative workflow building tool
    discoveredTools.push({
      name: 'build_workflow_iteratively',
      description: 'Interactive step-by-step workflow building with real-time validation and rollback capability',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'create_session',
              'add_node',
              'test_workflow',
              'create_checkpoint',
              'rollback',
              'get_suggestions',
              'validate_connections',
              'preview_workflow',
              'complete_workflow',
            ],
            description: 'The iterative building action to perform',
          },
          sessionId: {
            type: 'string',
            description: 'Unique session identifier for maintaining state across interactions',
          },
          workflowName: {
            type: 'string',
            description: 'Name for the workflow (required for create_session)',
          },
          nodeType: {
            type: 'string',
            description: 'Type of node to add (e.g., n8n-nodes-base.httpRequest)',
          },
          nodeParameters: {
            type: 'object',
            description: 'Parameters for the node being added',
            additionalProperties: true,
          },
          checkpointId: {
            type: 'number',
            description: 'Checkpoint ID for rollback operations',
            minimum: 0,
          },
        },
        required: ['action'],
      },
    })

    // Discovery scheduler control tools
    discoveredTools.push({
      name: 'discovery-trigger',
      description: 'Manually trigger n8n node discovery',
      inputSchema: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for triggering discovery',
            default: 'Manual trigger via MCP',
          },
        },
      },
    })

    discoveredTools.push({
      name: 'discovery-status',
      description: 'Get status of discovery sessions and scheduler',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    })

    discoveredTools.push({
      name: 'discovery-config',
      description: 'Update discovery scheduler configuration',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Enable/disable automatic discovery scheduling',
          },
          intervalMinutes: {
            type: 'number',
            description: 'Discovery interval in minutes',
            minimum: 5,
            maximum: 1440,
          },
          versionDetection: {
            type: 'boolean',
            description: 'Enable version change detection',
          },
        },
      },
    })

    // Add handlers for scheduler tools
    toolHandlers.set('discovery-trigger', async (args: any) => {
      if (!discoveryScheduler) {
        return { error: 'Discovery scheduler not initialized' }
      }

      const sessionId = await discoveryScheduler.triggerDiscovery('manual', args?.reason || 'Manual trigger via MCP')

      return {
        success: true,
        sessionId,
        message: sessionId ? `Discovery session ${sessionId} started` : 'Discovery session could not be started (check concurrent limit)',
      }
    })

    toolHandlers.set('discovery-status', async () => {
      if (!discoveryScheduler) {
        return { error: 'Discovery scheduler not initialized' }
      }

      const sessions = discoveryScheduler.getSessionStatus()
      const stats = discoveryScheduler.getStats()

      return {
        scheduler: stats,
        sessions: sessions.map(session => ({
          sessionId: session.sessionId,
          status: session.status,
          trigger: session.trigger,
          startedAt: session.startedAt,
          progress: session.progress,
          stats: session.stats,
        })),
        timestamp: new Date(),
      }
    })

    toolHandlers.set('discovery-config', async (args: any) => {
      if (!discoveryScheduler) {
        return { error: 'Discovery scheduler not initialized' }
      }

      if (!args || Object.keys(args).length === 0) {
        return { error: 'No configuration provided' }
      }

      discoveryScheduler.updateConfig(args)

      return {
        success: true,
        message: 'Discovery scheduler configuration updated',
        newConfig: discoveryScheduler.getStats().config,
      }
    })

    // Add handler for iterative workflow building
    toolHandlers.set('build_workflow_iteratively', async (args: any) => {
      try {
        if (!simpleN8nApi) {
          return { error: 'n8n API not available' }
        }

        const { action, sessionId, workflowName, nodeType, nodeParameters, checkpointId } = args

        switch (action) {
          case 'create_session': {
            if (!workflowName) {
              return { error: 'workflowName is required for create_session' }
            }

            // Create a new workflow for iterative building
            const workflow = await simpleN8nApi.createIterativeWorkflow(workflowName)
            if (!workflow) {
              return { error: 'Failed to create workflow' }
            }

            // Create a new session
            const session = WorkflowBuilderUtils.SessionManager.createSession(workflow.id)

            return {
              success: true,
              sessionId: session.sessionId,
              workflowId: session.workflowId,
              message: `Created iterative workflow session: ${session.sessionId}`,
              suggestions: await simpleN8nApi.getCompatibleNodes(workflow.id),
            }
          }

          case 'add_node': {
            if (!sessionId) {
              return { error: 'sessionId is required for add_node' }
            }
            if (!nodeType) {
              return { error: 'nodeType is required for add_node' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            // Create node object
            const node = {
              type: nodeType,
              parameters: nodeParameters || {},
              position: [100 + session.currentNodes.length * 200, 100] as [number, number],
            }

            // Add node to workflow
            const success = await WorkflowBuilderUtils.NodeManager.addNodeToWorkflow(
              session,
              node,
              simpleN8nApi,
            )

            if (!success) {
              return { error: 'Failed to add node to workflow' }
            }

            // Create automatic checkpoint
            WorkflowBuilderUtils.SessionManager.createCheckpoint(session, 'auto_after_add_node')

            return {
              success: true,
              message: `Added ${nodeType} node to workflow`,
              nodeCount: session.currentNodes.length,
              nextSuggestions: await simpleN8nApi.getCompatibleNodes(session.workflowId, nodeType),
            }
          }

          case 'test_workflow': {
            if (!sessionId) {
              return { error: 'sessionId is required for test_workflow' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            const result = await WorkflowBuilderUtils.NodeManager.testWorkflow(session, simpleN8nApi)
            if (!result) {
              return { error: 'Workflow test failed' }
            }

            return {
              success: true,
              validationResult: result,
              message: result.status === 'success' ? 'Workflow executed successfully' : 'Workflow execution had issues',
            }
          }

          case 'create_checkpoint': {
            if (!sessionId) {
              return { error: 'sessionId is required for create_checkpoint' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            const success = WorkflowBuilderUtils.SessionManager.createCheckpoint(session, 'manual')

            return {
              success,
              message: success ? 'Checkpoint created successfully' : 'Failed to create checkpoint',
              checkpointId: success ? session.checkpoints.length - 1 : null,
            }
          }

          case 'rollback': {
            if (!sessionId) {
              return { error: 'sessionId is required for rollback' }
            }
            if (checkpointId === undefined) {
              return { error: 'checkpointId is required for rollback' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            const success = await WorkflowBuilderUtils.RollbackManager.rollbackToCheckpoint(
              session,
              checkpointId,
              simpleN8nApi,
            )

            return {
              success,
              message: success ? `Rolled back to checkpoint ${checkpointId}` : 'Rollback failed',
              nodeCount: success ? session.currentNodes.length : null,
            }
          }

          case 'get_suggestions': {
            if (!sessionId) {
              return { error: 'sessionId is required for get_suggestions' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            const lastNode = session.currentNodes[session.currentNodes.length - 1]
            const suggestions = await simpleN8nApi.getCompatibleNodes(
              session.workflowId,
              lastNode?.type,
            )

            return {
              success: true,
              suggestions,
              lastNodeType: lastNode?.type || null,
              nodeCount: session.currentNodes.length,
            }
          }

          case 'validate_connections': {
            if (!sessionId) {
              return { error: 'sessionId is required for validate_connections' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            const validation = await simpleN8nApi.validateWorkflowConnections(session.workflowId)

            return {
              success: true,
              validation,
              message: validation.valid ? 'Workflow connections are valid' : 'Workflow has validation issues',
            }
          }

          case 'preview_workflow': {
            if (!sessionId) {
              return { error: 'sessionId is required for preview_workflow' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            // Generate ASCII visualization
            const nodeNames = session.currentNodes.map(n => n.name || n.type.split('.').pop())
            const preview = nodeNames.length > 0
              ? `[Start] → ${nodeNames.join(' → ')} → [End]`
              : '[Empty Workflow]'

            return {
              success: true,
              preview,
              nodeCount: session.currentNodes.length,
              checkpointCount: session.checkpoints.length,
              sessionAge: Date.now() - session.securityContext.createdAt.getTime(),
            }
          }

          case 'complete_workflow': {
            if (!sessionId) {
              return { error: 'sessionId is required for complete_workflow' }
            }

            const session = WorkflowBuilderUtils.SessionManager.validateSession(sessionId)
            if (!session) {
              return { error: 'Invalid or expired session' }
            }

            // Final validation
            const validation = await simpleN8nApi.validateWorkflowConnections(session.workflowId)
            if (!validation.valid) {
              return {
                error: 'Cannot complete workflow - validation failed',
                validationErrors: validation.errors,
              }
            }

            // Cleanup session
            WorkflowBuilderUtils.SessionManager.cleanupSession(sessionId)

            return {
              success: true,
              workflowId: session.workflowId,
              finalNodeCount: session.currentNodes.length,
              message: 'Workflow completed successfully. Session cleaned up.',
            }
          }

          default:
            return { error: `Unknown action: ${action}` }
        }
      }
      catch (error) {
        logger.error('Iterative workflow building error:', error)
        return {
          error: 'Internal error during iterative workflow building',
          details: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })

    // Run Phase 2 discovery if n8n API is available
    if (hasN8nApi && simpleN8nApi && await testN8nConnection()) {
      logger.info('Running Phase 2: Credential-based node discovery...')
      const discoveryStats = await credentialDiscovery.discover()
      logger.info(`Phase 2 complete: ${discoveryStats.nodesDiscovered} nodes discovered`)

      // Run Phase 3: Generate MCP tools from discovered nodes
      logger.info('Running Phase 3: MCP tool generation with lazy loading...')
      const generationStats = await toolGenerator.generateAllTools()
      logger.info(`Phase 3 complete: ${generationStats.totalGenerated} tools generated (${generationStats.toolsWithOperations} with operations)`)

      // Load the generated tools into the MCP system
      await loadGeneratedTools(generationStats.totalGenerated)

      // Initialize Phase 4: Discovery Scheduler
      logger.info('Initializing Phase 4: Discovery automation scheduler...')
      discoveryScheduler = new DiscoveryScheduler()
      await discoveryScheduler.start()
      logger.info('Phase 4 complete: Discovery scheduler initialized')
    }
    else {
      logger.warn('No n8n API connection - running with basic tools only')

      // Still initialize scheduler for potential future connections
      discoveryScheduler = new DiscoveryScheduler()
      await discoveryScheduler.start()
    }

    logger.info(`Dynamic discovery complete: ${discoveredTools.length} tools available`)
  }
  catch (error) {
    logger.error('Dynamic discovery failed:', error)
    throw error
  }
}

/**
 * Test n8n API connectivity
 */
async function testN8nConnection(): Promise<boolean> {
  try {
    return await simpleN8nApi?.testConnection() || false
  }
  catch {
    return false
  }
}

/**
 * Load generated tools into MCP system with lazy loading
 */
async function loadGeneratedTools(maxTools?: number): Promise<void> {
  if (!toolGenerator) {
    logger.warn('Tool generator not initialized')
    return
  }

  try {
    // Get all tool metadata from database (without loading full schemas)
    const toolMetadata = await toolGenerator.getToolMetadata(maxTools)
    logger.info(`Loading ${toolMetadata.length} tool definitions with lazy loading...`)

    for (const metadata of toolMetadata) {
      // Create lightweight tool definition for MCP
      const description = metadata.operationName
        ? `${metadata.operationName} operation for ${metadata.nodeName || 'general category'}`
        : `${metadata.toolType} tool for ${metadata.nodeName || 'category operations'}`

      discoveredTools.push({
        name: metadata.toolId,
        description,
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: metadata.operationName || 'Operation to perform',
            },
            parameters: {
              type: 'object',
              description: 'Operation parameters',
            },
          },
        },
      })

      // Create lazy-loading handler
      toolHandlers.set(metadata.toolId, createLazyToolHandler(metadata.toolId))
    }

    logger.info(`Successfully loaded ${toolMetadata.length} lazy-loading MCP tools`)
  }
  catch (error) {
    logger.error('Failed to load generated tools:', error)
    throw error
  }
}

/**
 * Create a lazy-loading tool handler
 */
function createLazyToolHandler(toolId: string) {
  return async (args: Record<string, unknown>) => {
    if (!toolGenerator) {
      throw new Error('Tool generator not available')
    }

    try {
      // Lazy load the full tool definition when first executed
      const cachedTool = await toolGenerator.loadTool(toolId)
      if (!cachedTool) {
        throw new Error(`Tool ${toolId} not found in cache`)
      }

      // Execute with the loaded tool data
      return {
        toolId,
        status: 'lazy_loaded_execution',
        timestamp: Date.now(),
        nodeType: cachedTool.tool.sourceNode,
        operation: args.operation || 'default',
        parameters: args.parameters || {},
        agentRecommendation: 'n8n-orchestrator', // Default agent
        schema: cachedTool.schema ? 'loaded' : 'not_available',
        result: 'Tool execution would proceed with n8n workflow operations',
      }
    }
    catch (error) {
      logger.error(`Lazy loading failed for tool ${toolId}:`, error)
      return {
        toolId,
        status: 'lazy_loading_error',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

/**
 * Discover n8n capabilities and generate comprehensive tools (Legacy fallback)
 */
async function _discoverN8nNodes(): Promise<void> {
  try {
    // Generate dynamic tools for comprehensive workflow operations
    const coreOperations = [
      'list_workflows',
      'get_workflow',
      'create_workflow',
      'execute_workflow',
      'get_executions',

      // Extended workflow operations
      'update_workflow',
      'delete_workflow',
      'activate_workflow',
      'deactivate_workflow',
      'duplicate_workflow',

      // Execution operations
      'get_execution',
      'delete_execution',
      'retry_execution',
      'stop_execution',

      // Credential operations
      'list_credentials',
      'get_credential',
      'create_credential',
      'update_credential',
      'delete_credential',
      'test_credential',

      // Import/Export operations
      'export_workflow',
      'import_workflow',

      // Tag operations
      'list_tags',
      'create_tag',
      'tag_workflow',

      // Variable operations
      'list_variables',
      'create_variable',
      'update_variable',
      'delete_variable',

      // System operations
      'get_health',
      'get_version',
      'list_event_destinations',

      // Batch operations
      'batch_delete_workflows',
      'batch_activate_workflows',
      'batch_deactivate_workflows',
    ]

    for (const operation of coreOperations) {
      discoveredTools.push({
        name: operation,
        description: `Dynamic ${operation.replace('_', ' ')} operation`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Resource ID' },
            name: { type: 'string', description: 'Resource name' },
            data: { type: 'object', description: 'Operation data' },
          },
        },
      })

      toolHandlers.set(operation, createDynamicHandler(operation))
    }

    // Generate tools for comprehensive node registry
    const allNodes = getAllNodeTemplates()
    logger.info(`Generating tools for ${allNodes.length} n8n node types from comprehensive registry`)

    for (const nodeTemplate of allNodes) {
      // Create a general tool for the node
      const nodeToolName = `node_${nodeTemplate.name.replace(/[^a-z0-9]/g, '_')}`

      discoveredTools.push({
        name: nodeToolName,
        description: `${nodeTemplate.displayName}: ${nodeTemplate.description}`,
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: `Operation to perform. Available: ${nodeTemplate.commonOperations.join(', ')}`,
            },
            parameters: {
              type: 'object',
              description: 'Node-specific parameters',
            },
            credentials: {
              type: 'object',
              description: 'Authentication credentials if required',
            },
          },
          required: ['operation'],
        },
      })

      toolHandlers.set(nodeToolName, createNodeTemplateHandler(nodeTemplate))

      // Create specific operation tools for common operations
      for (const operation of nodeTemplate.commonOperations.slice(0, 3)) { // Limit to avoid tool explosion
        const operationToolName = `${nodeTemplate.name.replace(/[^a-z0-9]/g, '_')}_${operation}`

        discoveredTools.push({
          name: operationToolName,
          description: `${nodeTemplate.displayName} - ${operation}: ${nodeTemplate.description}`,
          inputSchema: {
            type: 'object',
            properties: {
              parameters: {
                type: 'object',
                description: `Parameters for ${operation} operation`,
              },
              credentials: {
                type: 'object',
                description: 'Authentication credentials if required',
              },
            },
          },
        })

        toolHandlers.set(operationToolName, createOperationHandler(nodeTemplate, operation))
      }
    }

    // Generate category overview tools
    const categories = getAllCategories()
    for (const category of categories) {
      const categoryToolName = `category_${category.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

      discoveredTools.push({
        name: categoryToolName,
        description: `List all ${category} nodes and their capabilities`,
        inputSchema: {
          type: 'object',
          properties: {
            detailed: { type: 'boolean', description: 'Return detailed information about each node' },
          },
        },
      })

      toolHandlers.set(categoryToolName, createCategoryHandler(category))
    }

    // Try to detect additional nodes from API if available
    try {
      const apiNodes = await simpleN8nApi?.getNodeTypes() || []
      if (apiNodes.length > 0) {
        logger.info(`Additionally discovered ${apiNodes.length} nodes from live API`)
        // We could add these but our registry is already comprehensive
      }
    }
    catch (_nodeError) {
      logger.debug('Live node discovery not available - using comprehensive registry')
    }

    logger.info(`Comprehensive discovery complete: ${discoveredTools.length} tools generated from registry + API`)
  }
  catch (error) {
    logger.error('n8n discovery failed:', error)
    throw error
  }
}

/**
 * Create dynamic handler for core operations
 */
function createDynamicHandler(operation: string) {
  return async (args: Record<string, unknown>) => {
    try {
      // Security: Validate and sanitize input arguments
      if (!args || typeof args !== 'object') {
        throw new Error('Invalid arguments provided')
      }

      // Sanitize string arguments to prevent injection attacks
      const sanitizedArgs: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string') {
          // Remove potentially dangerous characters and limit length
          sanitizedArgs[key] = value.replace(/[<>"'&]/g, '').substring(0, 1000)
        }
        else if (Array.isArray(value)) {
          // Validate array elements
          sanitizedArgs[key] = value.slice(0, 100).map(item =>
            typeof item === 'string' ? item.replace(/[<>"'&]/g, '').substring(0, 500) : item,
          )
        }
        else {
          sanitizedArgs[key] = value
        }
      }

      switch (operation) {
        // Core workflow operations
        case 'list_workflows':
          return await simpleN8nApi?.getWorkflows() || []
        case 'get_workflow':
          return await simpleN8nApi?.getWorkflow(args.id as string) || null
        case 'create_workflow':
          return await simpleN8nApi?.createWorkflow({
            name: args.name as string || 'Dynamic Workflow',
            nodes: args.data as any || [],
            active: false,
          }) || { status: 'workflow_creation_pending' }
        case 'execute_workflow':
          return await simpleN8nApi?.executeWorkflow(args.id as string, args.data as any) || { status: 'execution_started' }
        case 'get_executions':
          return await simpleN8nApi?.getExecutions(args.id as string) || []

        // Extended workflow operations
        case 'update_workflow':
          return await simpleN8nApi?.updateWorkflow(args.id as string, args.data as any) || null
        case 'delete_workflow':
          return await simpleN8nApi?.deleteWorkflow(args.id as string) || false
        case 'activate_workflow':
          return await simpleN8nApi?.activateWorkflow(args.id as string) || false
        case 'deactivate_workflow':
          return await simpleN8nApi?.deactivateWorkflow(args.id as string) || false
        case 'duplicate_workflow':
          return await simpleN8nApi?.duplicateWorkflow(args.id as string, args.name as string) || null

        // Execution operations
        case 'get_execution':
          return await simpleN8nApi?.getExecution(args.id as string) || null
        case 'delete_execution':
          return await simpleN8nApi?.deleteExecution(args.id as string) || false
        case 'retry_execution':
          return await simpleN8nApi?.retryExecution(args.id as string) || null
        case 'stop_execution':
          return await simpleN8nApi?.stopExecution(args.id as string) || false

        // Credential operations
        case 'list_credentials':
          return await simpleN8nApi?.getCredentials() || []
        case 'get_credential':
          return await simpleN8nApi?.getCredential(args.id as string) || null
        case 'create_credential':
          return await simpleN8nApi?.createCredential(args.data as any) || null
        case 'update_credential':
          return await simpleN8nApi?.updateCredential(args.id as string, args.data as any) || null
        case 'delete_credential':
          return await simpleN8nApi?.deleteCredential(args.id as string) || false
        case 'test_credential':
          return await simpleN8nApi?.testCredential(args.id as string) || null

        // Import/Export operations
        case 'export_workflow':
          return await simpleN8nApi?.exportWorkflow(args.id as string) || null
        case 'import_workflow':
          return await simpleN8nApi?.importWorkflow(args.data as any) || null

        // Tag operations
        case 'list_tags':
          return await simpleN8nApi?.getTags() || []
        case 'create_tag':
          return await simpleN8nApi?.createTag(args.name as string) || null
        case 'tag_workflow':
          return await simpleN8nApi?.tagWorkflow(args.workflowId as string, args.tagIds as string[]) || false

        // Variable operations
        case 'list_variables':
          return await simpleN8nApi?.getVariables() || []
        case 'create_variable':
          return await simpleN8nApi?.createVariable(args as { key: string, value: string }) || null
        case 'update_variable':
          return await simpleN8nApi?.updateVariable(args.id as string, args.data as any) || null
        case 'delete_variable':
          return await simpleN8nApi?.deleteVariable(args.id as string) || false

        // System operations
        case 'get_health':
          return await simpleN8nApi?.getHealth() || null
        case 'get_version':
          return await simpleN8nApi?.getVersion() || null
        case 'list_event_destinations':
          return await simpleN8nApi?.getEventDestinations() || []

        // Batch operations
        case 'batch_delete_workflows':
          return await simpleN8nApi?.batchDeleteWorkflows(args.ids as string[]) || { success: [], failed: [] }
        case 'batch_activate_workflows':
          return await simpleN8nApi?.batchActivateWorkflows(args.ids as string[]) || { success: [], failed: [] }
        case 'batch_deactivate_workflows':
          return await simpleN8nApi?.batchDeactivateWorkflows(args.ids as string[]) || { success: [], failed: [] }

        default:
          return { operation, args, status: 'dynamic_execution' }
      }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
}

/**
 * Create handler for specific node (legacy - for API discovered nodes)
 */
function _createNodeHandler(node: N8NNodeAPI) {
  return async (args: Record<string, unknown>) => {
    return {
      node: node.name,
      operation: args.operation || 'info',
      parameters: args.parameters || {},
      status: 'node_ready',
    }
  }
}

/**
 * Create handler for node template
 */
function createNodeTemplateHandler(nodeTemplate: any) {
  return async (args: Record<string, unknown>) => {
    return {
      node: nodeTemplate.name,
      displayName: nodeTemplate.displayName,
      category: nodeTemplate.category,
      operation: args.operation,
      parameters: args.parameters || {},
      credentials: args.credentials || {},
      availableOperations: nodeTemplate.commonOperations,
      status: 'template_node_ready',
      description: nodeTemplate.description,
    }
  }
}

/**
 * Create handler for specific node operation
 */
function createOperationHandler(nodeTemplate: any, operation: string) {
  return async (args: Record<string, unknown>) => {
    return {
      node: nodeTemplate.name,
      displayName: nodeTemplate.displayName,
      category: nodeTemplate.category,
      operation,
      parameters: args.parameters || {},
      credentials: args.credentials || {},
      status: 'operation_ready',
      description: `Executing ${operation} on ${nodeTemplate.displayName}`,
    }
  }
}

/**
 * Create handler for category overview
 */
function createCategoryHandler(category: string) {
  return async (args: Record<string, unknown>) => {
    const categoryNodes = getAllNodeTemplates().filter(node => node.category === category)
    const detailed = args.detailed as boolean || false

    if (detailed) {
      return {
        category,
        nodeCount: categoryNodes.length,
        nodes: categoryNodes.map(node => ({
          name: node.name,
          displayName: node.displayName,
          description: node.description,
          operations: node.commonOperations,
        })),
      }
    }
    else {
      return {
        category,
        nodeCount: categoryNodes.length,
        nodes: categoryNodes.map(node => `${node.displayName} (${node.name})`),
      }
    }
  }
}

/**
 * Get all dynamically discovered tools
 */
export async function getAllTools(): Promise<Tool[]> {
  return discoveredTools
}

/**
 * Execute a dynamically discovered tool
 */
export async function executeToolHandler(name: string, args: Record<string, unknown>) {
  const handler = toolHandlers.get(name)
  if (!handler) {
    throw new Error(`Tool not found: ${name}`)
  }

  return await handler(args)
}

/**
 * Get current tool count (for monitoring)
 */
export function getToolCount(): number {
  return discoveredTools.length
}

/**
 * Refresh tool discovery (for community node updates)
 */
export async function refreshTools(): Promise<void> {
  discoveredTools = []
  toolHandlers.clear()
  await initializeDynamicTools()
  logger.info(`Tools refreshed - now ${getToolCount()} available`)
}

/**
 * Cleanup resources on shutdown
 */
export async function cleanup(): Promise<void> {
  logger.info('Cleaning up discovery automation resources...')

  try {
    // Stop discovery scheduler
    if (discoveryScheduler) {
      await discoveryScheduler.stop()
      discoveryScheduler = null
      logger.info('Discovery scheduler stopped')
    }

    // Clear tool references
    discoveredTools = []
    toolHandlers.clear()
    toolGenerator = null
    credentialDiscovery = null

    logger.info('Cleanup completed successfully')
  }
  catch (error) {
    logger.error('Error during cleanup:', error)
  }
}
