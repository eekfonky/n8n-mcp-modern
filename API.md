# API Reference

## MCP Tools

### Core Tools

- `ping` - Health check 
- `list_agents` - Show available agents and status
- `execute_tool` - Route tool execution through agent system

### Agent System

**Agent Router (`src/agents/optimized.ts`):**
- Selects best agent based on tool name and context
- Prioritizes by tier (Master > Specialist > Support)
- Falls back to Orchestrator if no specific match

**Fast Communication (`src/agents/fast-communication.ts`):**
- Direct function calls (no events)
- Performance tracking
- Simple execution logging (last 100 operations)

## Configuration

**Environment Variables (`src/simple-config.ts`):**

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_URL` | `http://localhost:5678` | n8n instance URL |
| `N8N_API_KEY` | `undefined` | n8n API key (optional) |
| `LOG_LEVEL` | `info` | error, warn, info, debug |
| `ENABLED_AGENTS` | `all` | Comma-separated agent names |

## Agent Classes

### BaseAgent
- Abstract base with resource cleanup
- `canHandle()` - Tool matching logic
- `getPriority()` - Routing priority (1-10)
- `execute()` - Tool execution

### Orchestrator (Tier 1)
- Master coordinator
- Routes complex operations
- Handles high-complexity contexts

### Specialists (Tier 2)
- **BuilderAgent**: Code generation, performance
- **ConnectorAgent**: Authentication, APIs  
- **NodeExpertAgent**: Node expertise, JS validation

### GuideAgent (Tier 3)
- Documentation and support
- Lower priority routing

## Performance Targets

- **Startup**: <2 seconds
- **Operations**: <100ms average
- **Memory**: Auto-cleanup, leak detection
- **Tool Registration**: <50ms
- **Tool Lookup**: <10ms

## File Structure

```
src/
├── fast-index.ts          # Streamlined entry point
├── simple-config.ts       # Single config file
├── agents/
│   ├── optimized.ts       # 5 focused agent classes
│   └── fast-communication.ts # Direct communication
├── tools/
│   └── unified-registry.ts # Single tool registry
└── utils/
    └── memory-manager.ts   # Simple memory management
```

## Memory Management

- Automatic cleanup registration
- Force garbage collection when needed
- Resource tracking per agent
- Simple reporting (used/total memory)