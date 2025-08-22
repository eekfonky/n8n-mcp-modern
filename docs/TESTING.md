# Testing Guide

This document describes the comprehensive testing strategy for the n8n-MCP Modern server.

## Test Architecture

The testing suite is organized into multiple layers providing comprehensive coverage:

### 🧪 Test Suites

1. **Unit Tests** (`src/tests/`)
   - Security validation tests
   - Tool execution tests
   - Schema validation tests
   - Core functionality tests

2. **Integration Tests** (`src/tests/agents/`, `src/tests/mcp-integration.test.ts`)
   - Agent system integration
   - MCP protocol compliance
   - Database integration
   - Multi-component interaction

3. **Live Integration Tests** (`src/tests/tools/n8n-integration.test.ts`)
   - Real n8n API connectivity
   - Workflow CRUD operations
   - Execution management
   - Credential handling

4. **End-to-End Tests** (`src/tests/e2e/`)
   - Full server lifecycle
   - STDIO protocol testing
   - Complete workflow simulation
   - Error recovery scenarios

5. **Performance Tests** (`src/tests/performance/`)
   - Initialization benchmarks
   - Tool execution performance
   - Agent routing efficiency
   - Memory usage analysis
   - Concurrent request handling

## Quick Start

### Run All Tests

```bash
npm run test:all
```

### Run Specific Test Suites

```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Live n8n API tests (requires credentials)
npm run test:n8n

# End-to-end tests
npm run test:e2e

# Performance benchmarks
npm run test:performance
```

### Development Testing

```bash
# Watch mode for development
npm run test:watch

# Quick critical tests (for pre-commit)
npm run test:quick

# Coverage reports
npm run test:coverage
```

## Test Configuration

### Environment Variables

Set these in your `.env` file for comprehensive testing:

```env
# Required for live n8n integration tests
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your-api-key

# Test environment settings
NODE_ENV=test
LOG_LEVEL=error
DISABLE_CONSOLE_OUTPUT=true

# Performance test tuning
MCP_TIMEOUT=30000
MAX_CONCURRENT_REQUESTS=10
```

### Test Database

Tests use an in-memory SQLite database by default. For integration tests that require persistent data:

```bash
# Rebuild test database
npm run rebuild-db

# Validate test data
npm run validate
```

## Test Data Fixtures

Test fixtures are centralized in `src/tests/fixtures/test-data.ts`:

- **Workflows**: Simple, complex, and AI-powered workflow examples
- **Executions**: Success and failure execution scenarios
- **Credentials**: Various authentication types
- **Nodes**: Core n8n node configurations
- **Agent Queries**: Sample queries for each agent type
- **Error Scenarios**: Edge cases and security tests

## Test Results and Reporting

### Console Output

The test runner provides detailed console output:

- ✅ Test suite status
- 📊 Performance metrics
- 🔴 Critical vs 🟡 Non-critical failures
- 📄 Coverage statistics

### JSON Reports

Detailed test reports are saved to `test-reports/`:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "duration": 45000,
  "summary": {
    "total": 5,
    "passed": 4,
    "failed": 1,
    "criticalFailed": 0
  },
  "suites": [...],
  "environment": {...}
}
```

### Coverage Reports

HTML coverage reports are generated in `coverage/`:

- Line coverage
- Branch coverage
- Function coverage
- File-by-file breakdown

## Performance Benchmarks

### Target Metrics

| Component         | Target  | Unit | Critical |
| ----------------- | ------- | ---- | -------- |
| Server Init       | < 500ms | ms   | Yes      |
| Tool Execution    | < 50ms  | ms   | Yes      |
| Agent Routing     | < 10ms  | ms   | No       |
| Schema Validation | < 5ms   | ms   | No       |
| DB Queries        | < 10ms  | ms   | Yes      |

### Load Testing

The performance suite includes:

- **Concurrent Requests**: 50 simultaneous tool calls
- **Sustained Load**: 1000 requests over 30 seconds
- **Burst Testing**: 100 requests in quick succession
- **Memory Pressure**: Extended operation monitoring

## CI/CD Integration

### GitHub Actions

The test suite integrates with CI/CD pipelines:

```yaml
- name: Run comprehensive tests
  run: npm run ci

- name: Quick pre-commit tests
  run: npm run precommit
```

### Exit Codes

- `0`: All tests passed
- `1`: Critical test failures (should block deployment)
- `0` with warnings: Non-critical failures only

## Live N8N Testing

### Prerequisites

1. **Running n8n Instance**: Cloud or self-hosted
2. **API Access**: Admin or API access enabled
3. **Credentials**: Valid API key

### Test Coverage

Live integration tests verify:

- ✅ API connectivity and authentication
- ✅ Workflow CRUD operations
- ✅ Execution management
- ✅ Credential handling
- ✅ Error scenarios
- ✅ Rate limiting
- ✅ Pagination

### Safety Features

- Tests use clearly marked test workflows
- Automatic cleanup of created resources
- Non-destructive operations only
- Respects rate limits

## Debugging Tests

### Verbose Output

```bash
# Enable debug logging
LOG_LEVEL=debug npm run test:unit

# Disable output suppression
DISABLE_CONSOLE_OUTPUT=false npm run test
```

### Isolated Testing

```bash
# Run specific test files
npx vitest run src/tests/security.test.ts

# Run with specific patterns
npx vitest run --grep "agent routing"
```

### Test Failures

Common issues and solutions:

1. **Database Errors**: Ensure `data/nodes.db` exists
2. **Timeout Issues**: Check `MCP_TIMEOUT` setting
3. **N8N Connection**: Verify API URL and key
4. **Memory Issues**: Enable garbage collection with `--expose-gc`

## Contributing Tests

### Test File Organization

```
src/tests/
├── fixtures/          # Test data and mocks
├── tools/             # Tool-specific tests
├── agents/            # Agent system tests
├── e2e/               # End-to-end tests
├── performance/       # Benchmarks
├── security.test.ts   # Security validation
├── mcp-integration.test.ts  # MCP protocol
└── agent-routing.test.ts    # Agent routing
```

### Writing New Tests

1. **Use TypeScript**: All tests in TypeScript
2. **Follow Patterns**: Use existing test structure
3. **Mock External APIs**: Don't depend on external services
4. **Test Edge Cases**: Include error scenarios
5. **Performance Aware**: Consider test execution time

### Test Categories

Mark tests appropriately:

```typescript
// Critical test - blocks deployment if failed
describe('Critical: Tool Validation', () => {
  // ...
})

// Integration test - requires multiple components
describe('Integration: Agent System', () => {
  // ...
})

// Performance test - measures metrics
describe('Performance: Database Queries', () => {
  // ...
})
```

## Performance Comparison

### vs Legacy v3.x

The test suite validates performance improvements:

| Metric         | v4.x Modern | v3.x Legacy | Improvement   |
| -------------- | ----------- | ----------- | ------------- |
| Bundle Size    | 15MB        | 1.1GB       | 98.6% smaller |
| Install Time   | <30s        | >3min       | 90% faster    |
| Init Time      | <500ms      | >3s         | 90% faster    |
| Tool Execution | <50ms       | >200ms      | 75% faster    |
| Dependencies   | 5           | 1000+       | 99.5% fewer   |

## Troubleshooting

### Common Issues

1. **Tests Hanging**
   - Check for unclosed database connections
   - Verify timeout settings
   - Look for unresolved promises

2. **Memory Leaks**
   - Run with `--detect-open-handles`
   - Check test cleanup
   - Monitor memory usage trends

3. **Flaky Tests**
   - Review timing dependencies
   - Check external service dependencies
   - Add appropriate wait conditions

### Getting Help

- Check the [CLAUDE.md](../CLAUDE.md) file for project context
- Review test output for specific error messages
- Run tests in isolation to identify issues
- Enable debug logging for detailed information

---

_This testing strategy ensures the n8n-MCP Modern server maintains its performance advantages while providing comprehensive validation of all functionality._
