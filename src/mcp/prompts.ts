/**
 * MCP Prompts Implementation
 * Provides reusable prompt templates for n8n automation
 */

import type {
  Prompt,
  PromptMessage,
} from '@modelcontextprotocol/sdk/types.js'
import { simpleN8nApi } from '../n8n/simple-api.js'
import { features } from '../server/config.js'
import { logger } from '../server/logger.js'

const { hasN8nApi } = features

export class PromptManager {
  private prompts: Map<string, {
    prompt: Prompt
    handler: (args: Record<string, any>) => Promise<PromptMessage[]>
  }> = new Map()

  constructor() {
    this.registerDefaultPrompts()
  }

  /**
   * Register default prompt templates
   */
  private registerDefaultPrompts() {
    // Workflow creation prompt
    this.registerPrompt({
      name: 'create-workflow',
      description: 'Create a new n8n workflow with specified nodes',
      arguments: [
        {
          name: 'name',
          description: 'Workflow name',
          required: true,
        },
        {
          name: 'description',
          description: 'Workflow description',
          required: false,
        },
        {
          name: 'nodes',
          description: 'Comma-separated list of node types to include',
          required: true,
        },
      ],
    }, async (args) => {
      return [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Create a new n8n workflow named "${args.name}" with the following requirements:
          
Description: ${args.description || 'No description provided'}
Required nodes: ${args.nodes}

Please design a workflow that:
1. Uses the specified nodes effectively
2. Follows n8n best practices
3. Includes proper error handling
4. Has clear node naming and organization
5. Includes relevant node configurations

Provide the workflow JSON structure and explain the data flow.`,
        },
      }]
    })

    // Node configuration prompt
    this.registerPrompt({
      name: 'configure-node',
      description: 'Get configuration help for a specific n8n node',
      arguments: [
        {
          name: 'nodeType',
          description: 'The type of node to configure',
          required: true,
        },
        {
          name: 'useCase',
          description: 'Describe what you want to achieve',
          required: true,
        },
      ],
    }, async (args) => {
      return [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Help me configure a ${args.nodeType} node in n8n for the following use case:

${args.useCase}

Please provide:
1. Recommended node settings
2. Required credentials or authentication
3. Common parameters to configure
4. Example expressions or values
5. Best practices and common pitfalls
6. How to test the configuration`,
        },
      }]
    })

    // Debug workflow prompt
    this.registerPrompt({
      name: 'debug-workflow',
      description: 'Debug a workflow execution error',
      arguments: [
        {
          name: 'error',
          description: 'The error message or description',
          required: true,
        },
        {
          name: 'workflowId',
          description: 'Workflow ID if available',
          required: false,
        },
        {
          name: 'nodeType',
          description: 'Node type where error occurred',
          required: false,
        },
      ],
    }, async (args) => {
      let context = ''
      if (args.workflowId && hasN8nApi) {
        try {
          const workflow = await simpleN8nApi.getWorkflow(args.workflowId)
          if (workflow) {
            context = `\n\nWorkflow context:\n${JSON.stringify(workflow, null, 2)}`
          }
        }
        catch {
          // Ignore
        }
      }

      return [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Debug this n8n workflow error:

Error: ${args.error}
${args.nodeType ? `Node Type: ${args.nodeType}` : ''}
${args.workflowId ? `Workflow ID: ${args.workflowId}` : ''}${context}

Please help me:
1. Understand what caused this error
2. Identify the root cause
3. Provide step-by-step troubleshooting
4. Suggest fixes or workarounds
5. Recommend preventive measures`,
        },
      }]
    })

    // Data transformation prompt
    this.registerPrompt({
      name: 'transform-data',
      description: 'Create data transformation expressions',
      arguments: [
        {
          name: 'inputFormat',
          description: 'Describe the input data structure',
          required: true,
        },
        {
          name: 'outputFormat',
          description: 'Describe the desired output structure',
          required: true,
        },
        {
          name: 'example',
          description: 'Example input data (optional)',
          required: false,
        },
      ],
    }, async (args) => {
      return [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Create n8n expressions to transform data:

Input format: ${args.inputFormat}
Desired output: ${args.outputFormat}
${args.example ? `Example input:\n${args.example}` : ''}

Please provide:
1. JavaScript expressions for the transformation
2. Using n8n's $json and $node references
3. Step-by-step explanation
4. Alternative approaches if applicable
5. Performance considerations
6. Error handling for edge cases`,
        },
      }]
    })

    // Webhook setup prompt
    this.registerPrompt({
      name: 'setup-webhook',
      description: 'Configure webhook triggers and responses',
      arguments: [
        {
          name: 'service',
          description: 'External service sending webhooks',
          required: true,
        },
        {
          name: 'events',
          description: 'Events to listen for',
          required: true,
        },
        {
          name: 'authentication',
          description: 'Authentication method if required',
          required: false,
        },
      ],
    }, async (args) => {
      return [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Set up n8n webhook for ${args.service}:

Events to handle: ${args.events}
${args.authentication ? `Authentication: ${args.authentication}` : 'No authentication specified'}

Please guide me through:
1. Webhook node configuration
2. URL structure and path setup
3. Authentication/verification setup
4. Request validation
5. Response formatting
6. Error handling and retries
7. Testing the webhook
8. Security best practices`,
        },
      }]
    })

    // API integration prompt
    this.registerPrompt({
      name: 'integrate-api',
      description: 'Integrate with external APIs',
      arguments: [
        {
          name: 'apiName',
          description: 'Name of the API to integrate',
          required: true,
        },
        {
          name: 'operations',
          description: 'Operations you need to perform',
          required: true,
        },
        {
          name: 'hasNode',
          description: 'Does n8n have a native node for this API?',
          required: false,
        },
      ],
    }, async (args) => {
      return [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Help me integrate with ${args.apiName} API in n8n:

Required operations: ${args.operations}
${args.hasNode === 'false' ? 'Using HTTP Request node (no native node available)' : ''}

Please provide:
1. ${args.hasNode === 'false' ? 'HTTP Request node configuration' : 'Best node choice for this API'}
2. Authentication setup
3. Request structure and headers
4. Parameter configuration
5. Response handling
6. Error handling strategies
7. Rate limiting considerations
8. Example workflow structure`,
        },
      }]
    })

    // Automation pattern prompt
    this.registerPrompt({
      name: 'automation-pattern',
      description: 'Implement common automation patterns',
      arguments: [
        {
          name: 'pattern',
          description: 'Pattern type (e.g., batch processing, scheduled sync, event-driven)',
          required: true,
        },
        {
          name: 'dataSource',
          description: 'Source of data',
          required: true,
        },
        {
          name: 'destination',
          description: 'Where to send/store data',
          required: true,
        },
      ],
    }, async (args) => {
      return [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Implement ${args.pattern} automation pattern in n8n:

Data source: ${args.dataSource}
Destination: ${args.destination}

Design a workflow that:
1. Implements the ${args.pattern} pattern effectively
2. Handles data efficiently
3. Includes error recovery
4. Scales appropriately
5. Monitors execution
6. Logs important events

Provide:
- Complete workflow structure
- Node configurations
- Best practices for this pattern
- Performance optimization tips
- Monitoring and alerting setup`,
        },
      }]
    })

    // Performance optimization prompt
    this.registerPrompt({
      name: 'optimize-workflow',
      description: 'Optimize workflow performance',
      arguments: [
        {
          name: 'issue',
          description: 'Performance issue description',
          required: true,
        },
        {
          name: 'dataVolume',
          description: 'Typical data volume processed',
          required: false,
        },
        {
          name: 'frequency',
          description: 'How often the workflow runs',
          required: false,
        },
      ],
    }, async (args) => {
      return [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Optimize n8n workflow performance:

Issue: ${args.issue}
${args.dataVolume ? `Data volume: ${args.dataVolume}` : ''}
${args.frequency ? `Run frequency: ${args.frequency}` : ''}

Please help with:
1. Identifying performance bottlenecks
2. Memory optimization strategies
3. Batch processing techniques
4. Parallel execution options
5. Caching strategies
6. Database query optimization
7. Node configuration for performance
8. Monitoring performance metrics`,
        },
      }]
    })
  }

  /**
   * Register a new prompt
   */
  registerPrompt(prompt: Prompt, handler: (args: Record<string, any>) => Promise<PromptMessage[]>) {
    this.prompts.set(prompt.name, { prompt, handler })
    logger.debug(`Registered prompt: ${prompt.name}`)
  }

  /**
   * List all available prompts
   */
  async listPrompts(): Promise<Prompt[]> {
    return Array.from(this.prompts.values()).map(p => p.prompt)
  }

  /**
   * Get a specific prompt
   */
  async getPrompt(name: string, args: Record<string, any>): Promise<{
    description?: string
    messages: PromptMessage[]
  }> {
    const promptData = this.prompts.get(name)
    if (!promptData) {
      throw new Error(`Prompt not found: ${name}`)
    }

    const messages = await promptData.handler(args)
    return {
      description: promptData.prompt.description,
      messages,
    }
  }
}

// Singleton instance
export const promptManager = new PromptManager()
