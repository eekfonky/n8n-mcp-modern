# API Reference

## MCP Tools

### Discovery Tools
- `ping` - Health check for n8n-MCP server
- `discovery-trigger` - Manually trigger n8n node discovery
- `discovery-status` - Get status of discovery sessions
- `discovery-config` - Update discovery scheduler configuration

### n8n Operations
- `list_workflows` - Get all workflows
- `get_workflow` - Get specific workflow
- `create_workflow` - Create new workflow  
- `execute_workflow` - Execute workflow
- `get_executions` - Get workflow executions

### Node Tools
Dynamically generated tools for 400+ n8n nodes:
- `node_[nodename]` - General node operations
- `[nodename]_[operation]` - Specific node operations

### Category Tools
- `category_[category]` - List all nodes in category

## Configuration

Simple environment variables:

```bash
N8N_URL=http://localhost:5678    # n8n instance URL
N8N_API_KEY=your-key             # n8n API key
AGENTS=all                       # Enabled agents
DEBUG=false                      # Debug mode
```

## Tools Response Format

All tools return JSON with:
```typescript
{
  status: string
  data?: any
  error?: string
  timestamp: number
}
```

## Performance

- **Tool Count**: 400+ dynamically discovered
- **Discovery Time**: <5 seconds  
- **Tool Execution**: <100ms
- **Memory Usage**: <50MB base