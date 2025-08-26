# n8n-MCP Modern API Documentation

## Overview

n8n-MCP Modern v6.2.0 provides **139 comprehensive tools** for n8n workflow automation through the Model Context Protocol (MCP). This documentation covers all available tools, their usage, and integration patterns.

## Tool Categories

### Core MCP Tools (18 tools)
Direct n8n API integration with enhanced features for essential workflow operations.

### Code Generation Tools (12 tools)
Automated workflow creation, templates, and Docker configurations.

### Developer Workflow Tools (10 tools)  
CI/CD integration, Git workflows, and deployment automation.

### Performance & Observability Tools (12 tools)
Monitoring, optimization, and analytics capabilities.

### Comprehensive Tools (91 tools)
Specialized discovery, validation, management, and operational tools.

---

## Core MCP Tools

### Workflow Management

#### `get_n8n_workflows`
Retrieve list of workflows from your n8n instance with pagination and filtering.

**Parameters:**
```typescript
{
  limit?: number  // Maximum workflows to return (default: 10)
}
```

**Usage Example:**
```typescript
// Get first 20 workflows
await tool.execute('get_n8n_workflows', { limit: 20 })
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workflows": [...],
    "total": 45,
    "hasMore": true,
    "source": "enhanced_api"
  }
}
```

#### `get_n8n_workflow`
Get detailed information about a specific workflow including nodes and connections.

**Parameters:**
```typescript
{
  id: string  // Workflow ID
}
```

#### `create_n8n_workflow`
Create a new workflow with nodes, connections, and configuration.

**Parameters:**
```typescript
{
  name: string,           // Workflow name
  nodes: object[],        // Array of workflow nodes  
  connections: object,    // Node connection mapping
  active?: boolean,       // Auto-activate (default: false)
  settings?: object,      // Workflow settings
  tags?: string[]         // Workflow tags
}
```

#### `execute_n8n_workflow`
Execute a workflow by ID with optional input data.

**Parameters:**
```typescript
{
  id: string,      // Workflow ID to execute
  data?: object    // Input data for execution
}
```

#### `get_n8n_executions`
Retrieve workflow execution history with filtering options.

**Parameters:**
```typescript
{
  workflowId?: string,  // Filter by workflow (optional)
  limit?: number        // Max executions (default: 20)
}
```

### Node Discovery & Recommendations

#### `search_n8n_nodes`
Advanced search for n8n nodes with intelligent filtering.

**Parameters:**
```typescript
{
  query: string,           // Search term
  category?: string        // Filter by category
}
```

**Usage Example:**
```typescript
// Search for Slack nodes
await tool.execute('search_n8n_nodes', { 
  query: 'slack', 
  category: 'communication' 
})
```

#### `recommend_n8n_nodes`
Get intelligent node recommendations based on context and usage patterns.

**Parameters:**
```typescript
{
  userInput: string,                    // Description of goal
  complexity?: 'simple'|'standard'|'advanced',
  providers?: string[],                 // Preferred providers
  workflowContext?: string[]           // Existing workflow context
}
```

### System Health & Statistics

#### `get_system_health`
Comprehensive system health check for n8n instance and MCP server.

**Parameters:**
```typescript
{
  includeDetails?: boolean  // Include detailed diagnostics
}
```

#### `get_workflow_stats`
Get detailed statistics for a specific workflow.

**Parameters:**
```typescript
{
  id: string  // Workflow ID
}
```

#### `list_available_tools`
Get comprehensive list of all available MCP tools by category.

**Parameters:**
```typescript
{
  category?: string  // Filter by category
}
```

---

## Code Generation Tools

### Template & Boilerplate Generation

#### `generate_workflow_from_description`
Generate complete n8n workflows from natural language descriptions.

**Parameters:**
```typescript
{
  description: string,     // Natural language workflow description
  complexity: 'simple'|'standard'|'advanced',
  includeErrorHandling?: boolean,
  generateTests?: boolean
}
```

**Usage Example:**
```typescript
await tool.execute('generate_workflow_from_description', {
  description: 'Send Slack notification when new GitHub issue is created',
  complexity: 'standard',
  includeErrorHandling: true
})
```

#### `create_api_integration_template`
Generate API integration templates with authentication and error handling.

**Parameters:**
```typescript
{
  serviceName: string,
  authType: 'oauth'|'api_key'|'basic'|'bearer',
  endpoints: string[],
  includeValidation?: boolean
}
```

#### `build_data_processing_pipeline`
Create data transformation and processing workflows.

**Parameters:**
```typescript
{
  inputFormat: 'json'|'csv'|'xml'|'yaml',
  outputFormat: 'json'|'csv'|'xml'|'yaml', 
  transformations: object[],
  validateData?: boolean
}
```

### Docker & Infrastructure

#### `generate_docker_compose`
Generate Docker Compose configurations for n8n deployments.

**Parameters:**
```typescript
{
  environment: 'development'|'staging'|'production',
  includeDatabase?: boolean,
  includeRedis?: boolean,
  customPorts?: object
}
```

#### `create_workflow_documentation`
Generate comprehensive documentation for workflows.

**Parameters:**
```typescript
{
  workflowId: string,
  includeNodeDetails?: boolean,
  generateDiagram?: boolean,
  format: 'markdown'|'html'|'pdf'
}
```

---

## Developer Workflow Tools

### Git Integration

#### `integrate_with_git`
Set up Git integration for workflow version control.

**Parameters:**
```typescript
{
  repository: string,
  branch?: string,
  webhookUrl?: string,
  autoSync?: boolean
}
```

#### `setup_cicd_pipeline`
Configure CI/CD pipelines for n8n workflows.

**Parameters:**
```typescript
{
  platform: 'github'|'gitlab'|'jenkins',
  stages: string[],
  testingEnabled?: boolean,
  deploymentTarget?: string
}
```

### Deployment & Environment Management

#### `create_deployment_automation`
Set up automated deployment workflows.

**Parameters:**
```typescript
{
  environment: string,
  deploymentStrategy: 'blue-green'|'rolling'|'recreate',
  healthChecks?: boolean,
  rollbackEnabled?: boolean
}
```

#### `setup_environment_management`
Configure environment-specific settings and variables.

**Parameters:**
```typescript
{
  environments: string[],
  variables: object,
  secretManagement?: 'env'|'vault'|'aws-secrets'
}
```

---

## Performance & Observability Tools

### Monitoring & Analytics

#### `analyze_workflow_performance`
Analyze workflow performance metrics and bottlenecks.

**Parameters:**
```typescript
{
  workflowId: string,
  timeRange?: string,
  includeNodeMetrics?: boolean,
  generateRecommendations?: boolean
}
```

#### `monitor_system_metrics`
Set up system monitoring for n8n instance performance.

**Parameters:**
```typescript
{
  metrics: string[],
  interval?: number,
  alertThresholds?: object,
  dashboardEnabled?: boolean
}
```

#### `setup_alert_configuration`
Configure alerting for workflow failures and performance issues.

**Parameters:**
```typescript
{
  alertTypes: string[],
  channels: object[],
  thresholds: object,
  escalationRules?: object
}
```

### Optimization & Planning

#### `generate_optimization_recommendations`
Generate performance optimization recommendations for workflows.

**Parameters:**
```typescript
{
  workflowId?: string,
  focusArea?: 'performance'|'reliability'|'cost',
  implementationPlan?: boolean
}
```

#### `perform_capacity_planning`
Analyze resource requirements and scaling recommendations.

**Parameters:**
```typescript
{
  currentMetrics: object,
  projectedGrowth?: number,
  timeHorizon?: string,
  resourceConstraints?: object
}
```

---

## Comprehensive Tools (91 tools)

### Discovery Tools (8 tools)
- `search_nodes_advanced` - Advanced node search with detailed filters
- `list_node_categories` - Get all available node categories
- `discover_integrations` - Find available service integrations
- `analyze_workflow_complexity` - Assess workflow complexity metrics
- `find_similar_workflows` - Locate similar workflow patterns
- `get_node_documentation` - Retrieve detailed node documentation
- `search_workflow_templates` - Find workflow templates by criteria
- `list_supported_triggers` - Get available trigger types

### Validation Tools (6 tools)
- `validate_workflow_syntax` - Check workflow syntax and structure
- `test_node_connections` - Validate node connectivity
- `verify_credentials` - Test credential configurations
- `check_workflow_permissions` - Validate access permissions  
- `validate_webhook_endpoints` - Test webhook configurations
- `audit_security_settings` - Security configuration audit

### Management Tools (15 tools)
- `bulk_workflow_operations` - Mass workflow operations
- `manage_workflow_versions` - Version control operations
- `organize_workflow_folders` - Folder structure management
- `batch_credential_updates` - Bulk credential operations
- `workflow_backup_restore` - Backup and restore operations
- `manage_execution_queue` - Execution queue management
- `cleanup_old_executions` - Execution history cleanup
- `migrate_workflows` - Workflow migration between instances
- `sync_workflow_settings` - Settings synchronization
- `manage_webhook_configs` - Webhook management
- `update_node_versions` - Node version management
- `manage_workflow_tags` - Tag management operations
- `schedule_maintenance` - Maintenance scheduling
- `manage_user_permissions` - User access management
- `configure_workflow_limits` - Resource limit configuration

### Credential Management Tools (4 tools)
- `secure_credential_storage` - Enhanced credential storage
- `rotate_api_keys` - Automated key rotation
- `audit_credential_usage` - Credential usage tracking
- `manage_oauth_flows` - OAuth flow management

### Additional Specialized Tools (58 tools)
Including workflow optimization, testing automation, integration helpers, debugging tools, reporting utilities, and advanced configuration management.

---

## Authentication

All tools require proper n8n API configuration:

```bash
# Required environment variables
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your-api-key
```

## Error Handling

All tools return standardized error responses:

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {...}
}
```

## Rate Limiting

- Default: 10 concurrent requests
- Configurable via `MAX_CONCURRENT_REQUESTS` environment variable
- Automatic backoff for rate limit exceptions

## Getting Started

1. **Install n8n-MCP Modern:**
   ```bash
   claude mcp add n8n-mcp-modern \
     --env N8N_API_URL="https://your-n8n-instance.com" \
     --env N8N_API_KEY="your-api-key" \
     -- npx -y @eekfonky/n8n-mcp-modern
   ```

2. **Test the connection:**
   ```bash
   # Use the system health tool
   await tool.execute('get_system_health', { includeDetails: true })
   ```

3. **Explore available tools:**
   ```bash
   # List all tools by category
   await tool.execute('list_available_tools', {})
   ```

For detailed examples and advanced usage patterns, see the main [README.md](../README.md) and [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).