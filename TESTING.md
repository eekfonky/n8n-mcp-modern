# Testing Guide for n8n-MCP Modern

This project has comprehensive tests that cover both **infrastructure** (works without n8n) and **integration** (requires live n8n instance).

## Test Categories

### 1. Infrastructure Tests (No n8n Required)
- **MCP Tool Invocation** (`mcp-tool-invocation.test.ts`)
- **Agent Behavioral** (`agent-behavioral.test.ts`) 
- **Phase 2 Integration** (`phase2-integration.test.ts`)
- **Iterative Builder** (`iterative-builder.test.ts`)

These test the agent memory system, session management, and MCP protocol compliance.

### 2. N8N Integration Tests (Requires n8n API)
- **N8N Integration** (`n8n-integration.test.ts`)

Tests actual n8n connectivity, node discovery, workflow management, and real agent-n8n interactions.

## Quick Start

### Run Infrastructure Tests (Always Works)
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

### Run Complete Tests (Requires n8n)
1. **Set up test environment:**
   ```bash
   cp .env.test.example .env.test
   # Edit .env.test with your n8n instance details
   ```

2. **Configure test n8n instance:**
   ```bash
   N8N_API_URL=http://localhost:5678
   N8N_API_KEY=your-api-key
   ```

3. **Run all tests:**
   ```bash
   npm test
   ```

## Test Environment Setup

### Option 1: Local n8n Instance
```bash
# Start local n8n for testing
npx n8n start --tunnel

# Get API key from n8n UI:
# Settings → API → Create API Key
```

### Option 2: Docker n8n Instance
```bash
# Start n8n in Docker
docker run -it --rm \
  --name n8n-test \
  -p 5678:5678 \
  -e N8N_API_KEY_PREFIX=n8n_api_ \
  n8nio/n8n

# Access http://localhost:5678 and create API key
```

### Option 3: Cloud n8n Instance
```bash
# Use your cloud n8n instance
N8N_API_URL=https://your-instance.app.n8n.cloud
N8N_API_KEY=your-cloud-api-key
```

## Test Behavior

### Without n8n Credentials
- ✅ Infrastructure tests run normally
- ⏭️ N8N integration tests are **skipped** with warnings
- 🎯 **Result:** Partial but meaningful test coverage

### With n8n Credentials
- ✅ All infrastructure tests run
- ✅ N8N integration tests run with **live API calls**
- 🎯 **Result:** Complete comprehensive test coverage

## What Gets Tested

### Infrastructure Layer
- ✅ All 10 MCP dynamic agent tools
- ✅ Agent hierarchy and delegation
- ✅ Memory system and session management
- ✅ Error handling and validation
- ✅ Concurrent operations
- ✅ Data consistency

### N8N Integration Layer  
- ✅ n8n API connectivity
- ✅ Node discovery and tool generation
- ✅ Workflow creation and management
- ✅ Credential discovery
- ✅ Real agent-n8n interactions
- ✅ Rate limiting and error handling
- ✅ Live workflow testing

## Continuous Integration

The tests are designed to work in CI environments:

```yaml
# GitHub Actions example
- name: Run Infrastructure Tests
  run: npm test
  # Skips n8n tests automatically

- name: Run Complete Tests  
  run: npm test
  env:
    N8N_API_URL: ${{ secrets.TEST_N8N_URL }}
    N8N_API_KEY: ${{ secrets.TEST_N8N_API_KEY }}
  # Runs all tests if credentials provided
```

## Test Output Examples

### Without n8n (Infrastructure Only)
```
✅ MCP Tool Invocation - Critical Core Tests
✅ Agent Behavioral Tests - 6-Agent Hierarchy  
⏭️  N8N Integration Tests - Skipped (credentials not configured)

Results: 45 passed, 12 skipped
```

### With n8n (Complete)
```
✅ MCP Tool Invocation - Critical Core Tests
✅ Agent Behavioral Tests - 6-Agent Hierarchy
✅ N8N Integration Tests - All scenarios

Results: 67 passed, 0 skipped
```

## Troubleshooting

### Tests Fail with "n8n connection error"
1. Check `N8N_API_URL` is accessible
2. Verify `N8N_API_KEY` is valid and has permissions
3. Ensure n8n instance is running

### Tests Pass but Skip n8n Integration
1. Check environment variables are set: `echo $N8N_API_URL`
2. Copy and configure `.env.test` file
3. Restart test runner

### Database Permission Errors
```bash
# Clean up test databases
rm -f test_*.sqlite
npm test
```

## Contributing

When adding new functionality:

1. **Infrastructure features**: Add tests to existing test files
2. **N8N integration features**: Add tests to `n8n-integration.test.ts`
3. **New agent behavior**: Add to `agent-behavioral.test.ts`
4. **New MCP tools**: Add to `mcp-tool-invocation.test.ts`

All tests should follow the same pattern:
- ✅ Work without n8n for infrastructure
- ✅ Skip gracefully when n8n not available  
- ✅ Test thoroughly when n8n is available