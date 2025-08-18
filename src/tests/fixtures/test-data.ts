/**
 * Test Data Fixtures
 * Common test data for consistent testing across the suite
 */

export const testWorkflows = {
  simple: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Simple Test Workflow',
    active: false,
    nodes: [
      {
        id: 'webhook-1',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        parameters: {
          path: 'test-webhook',
          method: 'POST'
        }
      },
      {
        id: 'response-1',
        name: 'Respond',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1,
        position: [450, 300],
        parameters: {
          respondWith: 'json',
          responseBody: '{"status": "success"}'
        }
      }
    ],
    connections: {
      'Webhook': {
        main: [[{
          node: 'Respond',
          type: 'main',
          index: 0
        }]]
      }
    },
    settings: {
      executionOrder: 'v1'
    }
  },

  complex: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Complex Integration Workflow',
    active: true,
    nodes: [
      {
        id: 'schedule-1',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        position: [100, 200],
        parameters: {
          rule: {
            interval: [{ field: 'hours', value: 1 }]
          }
        }
      },
      {
        id: 'http-1',
        name: 'Fetch Data',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [300, 200],
        parameters: {
          url: 'https://api.example.com/data',
          method: 'GET',
          authentication: 'genericCredentialType',
          genericAuthType: 'httpHeaderAuth'
        },
        credentials: {
          httpHeaderAuth: {
            id: 'api-key-credential',
            name: 'API Key'
          }
        }
      },
      {
        id: 'postgres-1',
        name: 'Store in Database',
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2,
        position: [500, 200],
        parameters: {
          operation: 'insert',
          table: 'api_data',
          columns: 'id,data,timestamp',
          additionalFields: {}
        },
        credentials: {
          postgres: {
            id: 'postgres-credential',
            name: 'Production DB'
          }
        }
      },
      {
        id: 'if-1',
        name: 'Check Success',
        type: 'n8n-nodes-base.if',
        typeVersion: 1,
        position: [700, 200],
        parameters: {
          conditions: {
            boolean: [],
            dateTime: [],
            number: [],
            string: [
              {
                value1: '={{$json["status"]}}',
                operation: 'equal',
                value2: 'success'
              }
            ]
          }
        }
      },
      {
        id: 'slack-1',
        name: 'Notify Success',
        type: 'n8n-nodes-base.slack',
        typeVersion: 1,
        position: [900, 150],
        parameters: {
          channel: '#alerts',
          text: 'Data sync completed successfully'
        },
        credentials: {
          slackApi: {
            id: 'slack-credential',
            name: 'Slack Bot'
          }
        }
      },
      {
        id: 'email-1',
        name: 'Error Alert',
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 2,
        position: [900, 250],
        parameters: {
          to: 'admin@example.com',
          subject: 'Data Sync Failed',
          message: 'The scheduled data sync has failed. Please check the logs.'
        },
        credentials: {
          smtp: {
            id: 'smtp-credential',
            name: 'SMTP Server'
          }
        }
      }
    ],
    connections: {
      'Schedule Trigger': {
        main: [[{ node: 'Fetch Data', type: 'main', index: 0 }]]
      },
      'Fetch Data': {
        main: [[{ node: 'Store in Database', type: 'main', index: 0 }]]
      },
      'Store in Database': {
        main: [[{ node: 'Check Success', type: 'main', index: 0 }]]
      },
      'Check Success': {
        main: [
          [{ node: 'Notify Success', type: 'main', index: 0 }],
          [{ node: 'Error Alert', type: 'main', index: 0 }]
        ]
      }
    },
    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
      callerPolicy: 'workflowsFromSameOwner'
    }
  },

  aiWorkflow: {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'AI-Powered Content Processing',
    active: false,
    nodes: [
      {
        id: 'webhook-ai',
        name: 'Content Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [100, 300],
        parameters: {
          path: 'process-content',
          method: 'POST'
        }
      },
      {
        id: 'openai-1',
        name: 'Analyze Content',
        type: '@n8n/n8n-nodes-langchain.openAi',
        typeVersion: 1,
        position: [300, 300],
        parameters: {
          model: 'gpt-4',
          prompt: 'Analyze the following content for sentiment and key topics: {{$json["content"]}}',
          temperature: 0.3
        },
        credentials: {
          openAiApi: {
            id: 'openai-credential',
            name: 'OpenAI API'
          }
        }
      },
      {
        id: 'function-1',
        name: 'Process Results',
        type: 'n8n-nodes-base.function',
        typeVersion: 1,
        position: [500, 300],
        parameters: {
          functionCode: `
            const analysis = $input.first().json;
            const sentiment = analysis.sentiment || 'neutral';
            const topics = analysis.topics || [];
            
            return {
              originalContent: $('Content Webhook').first().json.content,
              sentiment: sentiment,
              topics: topics,
              processedAt: new Date().toISOString(),
              confidence: analysis.confidence || 0.8
            };
          `
        }
      },
      {
        id: 'airtable-1',
        name: 'Store Analysis',
        type: 'n8n-nodes-base.airtable',
        typeVersion: 1,
        position: [700, 300],
        parameters: {
          operation: 'create',
          base: 'content_analysis',
          table: 'analyses',
          fields: {
            'Content': '={{$json["originalContent"]}}',
            'Sentiment': '={{$json["sentiment"]}}',
            'Topics': '={{$json["topics"].join(", ")}}',
            'Processed At': '={{$json["processedAt"]}}',
            'Confidence': '={{$json["confidence"]}}'
          }
        },
        credentials: {
          airtableApi: {
            id: 'airtable-credential',
            name: 'Airtable Base'
          }
        }
      }
    ],
    connections: {
      'Content Webhook': {
        main: [[{ node: 'Analyze Content', type: 'main', index: 0 }]]
      },
      'Analyze Content': {
        main: [[{ node: 'Process Results', type: 'main', index: 0 }]]
      },
      'Process Results': {
        main: [[{ node: 'Store Analysis', type: 'main', index: 0 }]]
      }
    }
  }
};

export const testExecutions = {
  successful: {
    id: 'exec-550e8400-e29b-41d4-a716-446655440000',
    workflowId: '550e8400-e29b-41d4-a716-446655440000',
    mode: 'manual',
    status: 'success',
    startedAt: '2024-01-15T10:30:00.000Z',
    finishedAt: '2024-01-15T10:30:05.234Z',
    executionTime: 5234,
    data: {
      resultData: {
        runData: {
          'Webhook': [
            {
              startTime: 1705316600000,
              executionTime: 1,
              data: {
                main: [[{ json: { message: 'Hello World' } }]]
              }
            }
          ],
          'Respond': [
            {
              startTime: 1705316600001,
              executionTime: 4,
              data: {
                main: [[{ json: { status: 'success' } }]]
              }
            }
          ]
        }
      }
    }
  },

  failed: {
    id: 'exec-550e8400-e29b-41d4-a716-446655440001',
    workflowId: '550e8400-e29b-41d4-a716-446655440001',
    mode: 'trigger',
    status: 'error',
    startedAt: '2024-01-15T11:00:00.000Z',
    finishedAt: '2024-01-15T11:00:02.567Z',
    executionTime: 2567,
    data: {
      resultData: {
        error: {
          message: 'Connection refused',
          name: 'NodeApiError',
          node: {
            id: 'http-1',
            name: 'Fetch Data',
            type: 'n8n-nodes-base.httpRequest'
          },
          stack: 'NodeApiError: Connection refused\n    at HttpRequest.execute...'
        }
      }
    }
  }
};

export const testCredentials = {
  httpAuth: {
    id: 'cred-550e8400-e29b-41d4-a716-446655440000',
    name: 'API Key Credential',
    type: 'httpHeaderAuth',
    data: {
      name: 'X-API-Key',
      value: 'test-api-key-value'
    }
  },

  database: {
    id: 'cred-550e8400-e29b-41d4-a716-446655440001',
    name: 'Test Database',
    type: 'postgres',
    data: {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_password',
      ssl: false
    }
  },

  oauth: {
    id: 'cred-550e8400-e29b-41d4-a716-446655440002',
    name: 'Google OAuth',
    type: 'googleOAuth2Api',
    data: {
      clientId: 'test-client-id.googleusercontent.com',
      clientSecret: 'test-client-secret',
      accessToken: 'ya29.test-access-token',
      refreshToken: 'test-refresh-token',
      scope: 'https://www.googleapis.com/auth/spreadsheets'
    }
  }
};

export const testNodes = [
  {
    name: 'HTTP Request',
    type: 'n8n-nodes-base.httpRequest',
    category: 'core',
    description: 'Makes HTTP requests to APIs and websites',
    version: 3,
    properties: [
      {
        displayName: 'Authentication',
        name: 'authentication',
        type: 'options',
        options: [
          { name: 'None', value: 'none' },
          { name: 'Basic Auth', value: 'basicAuth' },
          { name: 'Header Auth', value: 'headerAuth' },
          { name: 'OAuth2', value: 'oAuth2' }
        ],
        default: 'none'
      },
      {
        displayName: 'Request Method',
        name: 'method',
        type: 'options',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'PATCH', value: 'PATCH' }
        ],
        default: 'GET'
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: '',
        placeholder: 'https://api.example.com/data',
        required: true
      }
    ]
  },
  {
    name: 'Webhook',
    type: 'n8n-nodes-base.webhook',
    category: 'trigger',
    description: 'Listens for HTTP requests sent to a specific URL',
    version: 1,
    properties: [
      {
        displayName: 'HTTP Method',
        name: 'method',
        type: 'options',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' }
        ],
        default: 'GET'
      },
      {
        displayName: 'Path',
        name: 'path',
        type: 'string',
        default: 'webhook',
        required: true
      }
    ]
  },
  {
    name: 'PostgreSQL',
    type: 'n8n-nodes-base.postgres',
    category: 'database',
    description: 'Execute queries against PostgreSQL databases',
    version: 2,
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        options: [
          { name: 'Execute Query', value: 'executeQuery' },
          { name: 'Insert', value: 'insert' },
          { name: 'Update', value: 'update' },
          { name: 'Delete', value: 'delete' }
        ],
        default: 'executeQuery'
      },
      {
        displayName: 'Table',
        name: 'table',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['insert', 'update', 'delete']
          }
        }
      }
    ]
  }
];

export const testAgentQueries = {
  architect: [
    'Design a complex workflow for customer onboarding',
    'Create enterprise automation strategy',
    'Orchestrate multi-step business process',
    'Plan workflow architecture for e-commerce platform'
  ],
  
  validator: [
    'Validate workflow security settings',
    'Check compliance with data regulations',
    'Analyze workflow for security vulnerabilities',
    'Audit credentials and permissions'
  ],
  
  integrationSpecialist: [
    'Setup OAuth2 for Google APIs',
    'Configure webhook authentication',
    'Troubleshoot API connection issues',
    'Implement JWT authentication flow'
  ],
  
  nodeSpecialist: [
    'Configure PostgreSQL node for bulk operations',
    'Optimize HTTP request node performance',
    'Find best AI nodes for text processing',
    'Setup advanced Slack notification parameters'
  ],
  
  assistant: [
    'How do I create my first workflow?',
    'What nodes are available for email?',
    'Quick help with webhook setup',
    'List available trigger nodes'
  ],
  
  docsSpecialist: [
    'How to install n8n with Docker?',
    'Setting up n8n in production environment',
    'n8n configuration best practices',
    'Troubleshooting installation issues'
  ],
  
  communitySpecialist: [
    'Find community nodes for PDF processing',
    'Latest AI/ML integration patterns',
    'Emerging automation trends in 2024',
    'OpenAI integration best practices'
  ]
};

export const testErrorScenarios = {
  validation: [
    { input: '', error: 'Empty string validation' },
    { input: null, error: 'Null input validation' },
    { input: { invalid: 'object' }, error: 'Invalid object structure' },
    { input: 'a'.repeat(10000), error: 'String too long' }
  ],
  
  api: [
    { status: 401, message: 'Unauthorized access' },
    { status: 404, message: 'Resource not found' },
    { status: 429, message: 'Rate limit exceeded' },
    { status: 500, message: 'Internal server error' }
  ],
  
  security: [
    { input: '<script>alert("xss")</script>', type: 'XSS attempt' },
    { input: 'test\x00null\x1fbytes', type: 'Control characters' },
    { input: '../../etc/passwd', type: 'Path traversal' },
    { input: 'DROP TABLE users;', type: 'SQL injection attempt' }
  ]
};

export const testPerformanceData = {
  benchmarks: {
    initialization: { target: 500, unit: 'ms' },
    toolExecution: { target: 50, unit: 'ms' },
    agentRouting: { target: 10, unit: 'ms' },
    validation: { target: 5, unit: 'ms' },
    dbQuery: { target: 10, unit: 'ms' }
  },
  
  loads: {
    concurrent: { requests: 50, timeout: 1000 },
    sustained: { requests: 1000, duration: 30000 },
    burst: { requests: 100, interval: 100 }
  }
};

export default {
  workflows: testWorkflows,
  executions: testExecutions,
  credentials: testCredentials,
  nodes: testNodes,
  agentQueries: testAgentQueries,
  errorScenarios: testErrorScenarios,
  performance: testPerformanceData
};