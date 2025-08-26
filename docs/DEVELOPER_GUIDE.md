# Developer Guide - n8n-MCP Modern v6.2.0

## Overview

This guide covers development workflows, testing procedures, and contribution guidelines for n8n-MCP Modern v6.2.0, featuring 139 comprehensive tools and a 7-agent hierarchical system.

## Development Setup

### Prerequisites

- **Node.js:** 22.0.0 or higher (required for ES2024 features)
- **npm:** 9.0.0 or higher
- **Git:** Latest version
- **n8n Instance:** For testing (local or remote)
- **Claude Code:** For MCP integration testing

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/eekfonky/n8n-mcp-modern.git
cd n8n-mcp-modern

# Install dependencies (ultra-minimal: only 5 core packages)
npm install

# Copy environment template
cp .env.example .env

# Configure your n8n instance
vim .env
```

**Environment Configuration (.env):**
```bash
# Required for development
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your-development-api-key

# Development settings
NODE_ENV=development
LOG_LEVEL=debug
DEBUG_AGENTS=true
PERFORMANCE_MONITORING=true

# Optional development features
ENABLE_CACHE=false                # Disable cache for development
MAX_CONCURRENT_REQUESTS=5         # Lower limit for development
DISABLE_CONSOLE_OUTPUT=false      # Enable console output
```

### Project Structure

```
n8n-mcp-modern/
├── src/
│   ├── index.ts                  # Main MCP server entry point
│   ├── server/                   # MCP server configuration
│   │   ├── config.ts            # Environment validation (Zod schemas)
│   │   ├── logger.ts            # Structured logging
│   │   ├── security.ts          # Input validation & sanitization
│   │   └── feature-flags.ts     # Runtime feature toggles
│   ├── agents/                   # 7-agent hierarchical system
│   │   ├── index.ts             # Agent definitions and routing
│   │   ├── story-files.ts       # Agent handover context
│   │   ├── story-manager.ts     # Story persistence
│   │   └── communication.ts     # Inter-agent communication
│   ├── tools/                    # 139 comprehensive MCP tools
│   │   ├── index.ts             # Main tool registry (18 core tools)
│   │   ├── comprehensive.ts     # 91 comprehensive tools
│   │   ├── code-generation.ts   # 12 code generation tools
│   │   ├── developer-workflows.ts # 10 developer workflow tools
│   │   └── performance-observability.ts # 12 performance tools
│   ├── n8n/                     # n8n API integration
│   │   ├── api.ts               # Base n8n API client
│   │   └── enhanced-api.ts      # Enhanced API with caching
│   ├── database/                # SQLite integration
│   │   ├── init.ts             # Database initialization
│   │   └── migrations/         # Schema migrations
│   ├── intelligence/            # AI routing and optimization
│   │   ├── complexity-assessor.ts # Workflow complexity analysis
│   │   ├── enhanced-routing.ts  # Agent routing intelligence
│   │   └── template-engine.ts   # Template processing
│   ├── utils/                   # Shared utilities
│   │   ├── enhanced-error-handler.ts # Structured error handling
│   │   └── memory-manager.ts    # Memory optimization
│   ├── validation/              # Input validation schemas
│   └── types/                   # TypeScript type definitions
├── dist/                        # Compiled output (generated)
├── tests/                       # Test suites
├── docs/                        # Documentation
├── scripts/                     # Build and utility scripts
└── agents/                      # Agent configuration files
```

## Development Workflow

### 1. Start Development Server

```bash
# Watch mode with hot reload
npm run dev

# Or with debugging enabled
DEBUG=* npm run dev
```

### 2. Build Process

```bash
# TypeScript compilation + executable setup
npm run build

# Type checking without compilation
npm run typecheck

# Clean build
rm -rf dist/ && npm run build
```

### 3. Code Quality

```bash
# ESLint with TypeScript rules
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Type checking
npm run typecheck

# Full CI pipeline locally
npm run ci
```

## Testing Framework

### Test Structure

```
src/tests/
├── unit/                    # Unit tests for individual components
│   ├── tools/              # Tool-specific unit tests
│   ├── agents/             # Agent system unit tests
│   └── utils/              # Utility function tests
├── integration/             # Integration tests
│   ├── mcp-integration.test.ts      # MCP protocol compliance
│   ├── agent-routing.test.ts        # Agent routing system
│   └── n8n-api-integration.test.ts  # n8n API integration
├── e2e/                    # End-to-end tests
│   ├── workflow-lifecycle.test.ts   # Complete workflow operations
│   └── claude-code.test.ts         # Claude Code integration
├── performance/            # Performance benchmarking
└── security/              # Security validation tests
```

### Running Tests

```bash
# All tests
npm test

# Watch mode during development
npm run test:watch

# Coverage reports
npm run test:coverage

# Specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Test specific tools/features
npm run test:n8n           # n8n integration tests
npm run test:quick         # Fast test suite
npm run test:live          # Tests against live n8n instance
```

### Test Configuration

**Vitest Configuration (vitest.config.ts):**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        'src/tests/'
      ]
    }
  }
})
```

### Writing Tests

**Unit Test Example:**
```typescript
// src/tests/unit/tools/workflow-management.test.ts
import { describe, it, expect, vi } from 'vitest'
import { N8NMCPTools } from '../../../tools/index.js'

describe('Workflow Management Tools', () => {
  it('should get workflows with proper pagination', async () => {
    const result = await N8NMCPTools.executeTool('get_n8n_workflows', {
      limit: 5
    })
    
    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty('workflows')
    expect(result.data.workflows.length).toBeLessThanOrEqual(5)
  })
  
  it('should handle API errors gracefully', async () => {
    // Mock API failure
    vi.mock('../../../n8n/api.js', () => ({
      n8nApi: null
    }))
    
    const result = await N8NMCPTools.executeTool('get_n8n_workflows', {})
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('not configured')
  })
})
```

**Integration Test Example:**
```typescript
// src/tests/integration/agent-routing.test.ts
import { describe, it, expect } from 'vitest'
import { agentRouter } from '../../agents/index.js'

describe('Agent Routing System', () => {
  it('should route workflow questions to workflow architect', async () => {
    const query = 'How do I create a workflow that sends emails?'
    const agent = await agentRouter.routeToAgent(query)
    
    expect(agent).toBeDefined()
    expect(agent.name).toBe('n8n-workflow-architect')
    expect(agent.tier).toBe(1)
  })
  
  it('should route performance questions to performance specialist', async () => {
    const query = 'My workflow is running slowly, help optimize it'
    const agent = await agentRouter.routeToAgent(query)
    
    expect(agent.name).toBe('n8n-performance-specialist')
    expect(agent.tier).toBe(2)
  })
})
```

### Test Data Management

**Mock Data Setup:**
```typescript
// src/tests/fixtures/n8n-mock-data.ts
export const mockWorkflows = [
  {
    id: 'workflow-1',
    name: 'Test Workflow',
    active: true,
    nodes: [],
    connections: {}
  }
]

export const mockExecutions = [
  {
    id: 'exec-1',
    workflowId: 'workflow-1',
    status: 'success',
    startedAt: '2024-01-01T00:00:00Z'
  }
]
```

## Code Standards

### TypeScript Configuration

**Strict Configuration (tsconfig.json):**
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext", 
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/tests"]
}
```

### ESLint Configuration

**Modern ESLint Setup (eslint.config.js):**
```javascript
import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    'no-console': 'warn'
  }
})
```

### Coding Standards

#### File Naming Conventions
- **Files:** kebab-case (e.g., `enhanced-api.ts`, `story-manager.ts`)
- **Directories:** kebab-case (e.g., `code-generation/`, `performance-observability/`)
- **Classes:** PascalCase (e.g., `N8NMCPTools`, `AgentRouter`)
- **Functions:** camelCase (e.g., `routeToAgent`, `executeWorkflow`)

#### Code Style Guidelines

**Function Definitions:**
```typescript
// ✅ Good: Explicit return types and error handling
async function getWorkflow(id: string): Promise<WorkflowResult> {
  try {
    const workflow = await n8nApi.getWorkflow(id)
    return { success: true, data: workflow }
  } catch (error) {
    logger.error('Failed to get workflow:', error)
    return { success: false, error: sanitizeError(error) }
  }
}

// ❌ Bad: No return type, no error handling  
async function getWorkflow(id) {
  return await n8nApi.getWorkflow(id)
}
```

**Error Handling Pattern:**
```typescript
// ✅ Good: Structured error handling with N8NMcpError
import { N8NMcpError } from '../utils/enhanced-error-handler.js'

function validateInput(data: unknown): ValidationResult {
  try {
    const parsed = WorkflowSchema.parse(data)
    return { success: true, data: parsed }
  } catch (error) {
    throw new N8NMcpError(
      'Invalid workflow data',
      'VALIDATION_FAILED',
      400,
      { originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}
```

**Import/Export Patterns:**
```typescript
// ✅ Good: Explicit .js extensions for ESM
import { logger } from '../server/logger.js'
import type { WorkflowResult } from '../types/index.js'

// ✅ Good: Named exports preferred
export { N8NMCPTools } from './tools/index.js'
export type { AgentDefinition } from './agents/index.js'

// ❌ Bad: Missing .js extension
import { logger } from '../server/logger'
```

## Tool Development

### Adding New MCP Tools

#### 1. Define the Tool Schema

```typescript
// In src/types/index.ts
export const NewToolArgsSchema = z.object({
  requiredParam: z.string(),
  optionalParam: z.string().optional(),
  enumParam: z.enum(['option1', 'option2'])
})

export type NewToolArgs = z.infer<typeof NewToolArgsSchema>
```

#### 2. Register the Tool

```typescript
// In src/tools/index.ts
const newTool: Tool = {
  name: 'new_tool_name',
  description: 'Clear description of what this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      requiredParam: {
        type: 'string',
        description: 'Description of required parameter'
      },
      optionalParam: {
        type: 'string', 
        description: 'Description of optional parameter'
      }
    },
    required: ['requiredParam']
  }
}
```

#### 3. Implement Tool Logic

```typescript
// In N8NMCPTools.executeTool() switch statement
case 'new_tool_name':
  result = await this.executeNewTool(
    NewToolArgsSchema.parse(args)
  )
  break

// Add implementation method
private static async executeNewTool(args: NewToolArgs): Promise<unknown> {
  const enhancedClient = this.createEnhancedClient()
  if (!enhancedClient) {
    throw EnhancedErrorHandler.createApiNotConfiguredError('new_tool_name')
  }

  return ErrorUtils.withEnhancedErrorHandling(
    async () => {
      // Tool implementation logic here
      const result = await enhancedClient.someOperation(args)
      
      return {
        ...result,
        source: 'enhanced_api',
        timestamp: new Date().toISOString()
      }
    },
    {
      toolName: 'new_tool_name',
      operation: 'description of operation',
      args,
      ...(process.env.N8N_API_URL && { apiUrl: process.env.N8N_API_URL })
    }
  )
}
```

#### 4. Write Tests

```typescript
// In src/tests/unit/tools/new-tool.test.ts
describe('New Tool', () => {
  it('should execute with valid parameters', async () => {
    const result = await N8NMCPTools.executeTool('new_tool_name', {
      requiredParam: 'test-value'
    })
    
    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty('timestamp')
  })
  
  it('should validate input parameters', async () => {
    const result = await N8NMCPTools.executeTool('new_tool_name', {
      // Missing required parameter
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('requiredParam')
  })
})
```

### Agent Development

#### Adding New Agents

```typescript
// In src/agents/index.ts
class NewSpecialistAgent extends BaseAgent {
  name = 'n8n-new-specialist'
  tier = AgentTier.SPECIALIST
  capabilities = [
    AgentCapability.NEW_CAPABILITY
  ]
  
  description = 'Specialized agent for new functionality'
  
  async canHandle(context: AgentContext): Promise<boolean> {
    // Logic to determine if this agent can handle the request
    return context.query.includes('new functionality keywords')
  }
  
  async handle(context: AgentContext): Promise<AgentResult> {
    try {
      // Agent-specific logic
      const result = await this.performNewOperation(context)
      
      return {
        success: true,
        message: 'Successfully handled request',
        result,
        handledBy: this.name
      }
    } catch (error) {
      return this.handleError(error, context)
    }
  }
}
```

## Performance Optimization

### Profiling and Benchmarking

```bash
# Run performance tests
npm run test:performance

# Profile memory usage
node --inspect dist/index.js

# Benchmark tool execution times
npm run benchmark
```

### Memory Management

**Memory Optimization Features:**
```typescript
// In src/utils/memory-manager.ts
export class MemoryManager {
  static optimizeArrays<T>(arr: T[], maxSize: number = 1000): T[] {
    if (arr.length > maxSize) {
      logger.warn(`Array size ${arr.length} exceeds limit ${maxSize}, truncating`)
      return arr.slice(0, maxSize)
    }
    return arr
  }
  
  static monitorMemoryUsage(): void {
    const usage = process.memoryUsage()
    logger.debug('Memory usage:', {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`
    })
  }
}
```

### Caching Strategies

```typescript
// Enhanced caching with TTL
const cache = new Map<string, { data: any, timestamp: number }>()
const CACHE_TTL = 3600 * 1000 // 1 hour

function getCachedData(key: string): any | null {
  const cached = cache.get(key)
  if (!cached) return null
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  
  return cached.data
}
```

## Debugging

### Debug Configuration

```bash
# Enable comprehensive debugging
export DEBUG=n8n-mcp:*
export LOG_LEVEL=debug
export DEBUG_AGENTS=true
export PERFORMANCE_MONITORING=true

# Run with debugging
npm run dev
```

### Debug Tools

**Agent Routing Debug:**
```typescript
// Debug agent selection process
const debugRouting = process.env.DEBUG_AGENTS === 'true'

if (debugRouting) {
  console.log('Agent routing decision:', {
    query: context.query,
    selectedAgent: agent.name,
    confidence: agent.confidence,
    alternatives: alternatives.map(a => ({ name: a.name, score: a.score }))
  })
}
```

**Performance Monitoring:**
```typescript
// Monitor tool execution times
const startTime = Date.now()
const result = await tool.execute(name, args)
const duration = Date.now() - startTime

if (duration > 2000) {
  logger.warn(`Slow tool execution: ${name} took ${duration}ms`)
}
```

## Contribution Guidelines

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-tool-name

# Make changes with proper commits
git add .
git commit -m "feat: add new tool for X functionality"

# Run tests and linting
npm run precommit

# Push and create PR
git push origin feature/new-tool-name
```

### Commit Message Format

```
type(scope): description

feat: add new workflow analysis tool
fix: resolve agent routing edge case  
docs: update API documentation
test: add comprehensive tool tests
refactor: optimize memory usage in agents
perf: improve caching performance
chore: update dependencies
```

### Pull Request Process

1. **Run full test suite:** `npm run ci`
2. **Update documentation** if needed
3. **Add tests** for new functionality
4. **Follow code standards** and pass linting
5. **Provide clear PR description** with context and testing steps

### Code Review Checklist

- [ ] Code follows TypeScript strict mode guidelines
- [ ] All functions have explicit return types
- [ ] Error handling uses structured N8NMcpError pattern
- [ ] Input validation using Zod schemas
- [ ] Tests cover new functionality
- [ ] Documentation updated if needed
- [ ] Performance impact considered
- [ ] Security implications reviewed

## Release Process

### Version Management

```bash
# Update version
npm version patch|minor|major

# Sync version across files
npm run sync-version

# Build and validate
npm run ci

# Publish (after tests pass)
npm run release
```

### Release Checklist

1. **Version Update**: Package.json, README.md, CHANGELOG.md
2. **Documentation**: All docs reflect new version
3. **Tests**: Full test suite passes
4. **Security Audit**: `npm audit` clean
5. **Performance**: Benchmarks meet requirements
6. **Build**: Clean production build
7. **Publish**: GitHub Packages and npm registry

For questions or support, please open an issue on [GitHub](https://github.com/eekfonky/n8n-mcp-modern/issues).