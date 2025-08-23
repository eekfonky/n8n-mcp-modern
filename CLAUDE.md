# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**n8n-MCP Modern** is a high-performance MCP (Model Context Protocol) server that provides 92 tools for n8n workflow automation. Built from the ground up with zero legacy dependencies, it features a 6-agent hierarchical system and modern TypeScript architecture.

**Key Architecture Principles:**

- Ultra-minimal dependencies (5 core packages vs 1000+ in legacy versions)
- Official MCP TypeScript SDK with full type safety
- Zod-first validation throughout
- ESM-only modern architecture
- Security-first approach with zero vulnerabilities

## Essential Commands

### Development

```bash
npm run dev           # Watch mode with tsx
npm run build         # Production build (TypeScript compilation + chmod +x)
npm run start         # Run production build
```

### Quality Assurance

```bash
npm run lint          # ESLint with TypeScript rules
npm run lint:fix      # Auto-fix linting issues
npm run typecheck     # TypeScript type checking (--noEmit)
npm test              # Vitest test runner
npm run test:watch    # Watch mode testing
npm run test:coverage # Coverage reports with v8 provider
```

### Database Management

```bash
node scripts/cleanup-sqlite.cjs    # Clean up SQLite database
npm run validate-readme            # Validate documentation accuracy
```

## Core Architecture

### Directory Structure

```
src/
├── server/           # MCP server implementation (config.ts, logger.ts, security.ts)
├── database/         # SQLite with clean schemas
├── tools/           # 92+ MCP tools (modern patterns)
├── agents/          # 6-agent hierarchical system
├── n8n/            # N8N API integration layer
├── types/          # Complete TypeScript definitions
├── utils/          # Enhanced HTTP client & memory management
├── tests/          # Comprehensive test suite with critical bug prevention
└── scripts/        # Database and validation utilities
```

### Agent Hierarchy

**TIER 1 - Master Orchestrator:**

- `n8n-orchestrator`: Strategic planning & coordination

**TIER 2 - Core Specialists:**

- `n8n-builder`: Code generation & DevOps workflows
- `n8n-connector`: Authentication & connectivity  
- `n8n-node-expert`: 525+ node expertise
- `n8n-scriptguard`: JavaScript validation & security

**TIER 3 - Support Specialists:**

- `n8n-guide`: Documentation, tutorials & guidance

### Configuration System

Environment variables are validated through Zod schemas in `src/server/config.ts`:

**Core MCP Settings:**

- `MCP_MODE=stdio` (optimized for Claude Code)
- `LOG_LEVEL=info`
- `DISABLE_CONSOLE_OUTPUT=false`

**N8N API Integration (Optional):**

- `N8N_API_URL` (auto-normalized to `/api/v1` endpoint)
- `N8N_API_KEY`

**Performance Optimization:**

- `ENABLE_CACHE=true`
- `CACHE_TTL=3600`
- `MAX_CONCURRENT_REQUESTS=10`

## TypeScript Configuration

**Strict Modern Setup:**

- Target: ES2024 with ESNext modules
- Bundler module resolution for optimal tree-shaking
- Ultra-strict compiler options including `noUncheckedIndexedAccess`
- `verbatimModuleSyntax` for explicit imports
- Node.js 22+ requirement for modern ES features

## Validation & Error Handling

**Zod-First Approach:**

- All configurations validated via `ConfigSchema`
- Input validation for all 92+ MCP tools
- Custom `N8NMcpError` class for structured error handling
- Validation profiles: minimal, runtime, ai-friendly, strict

## Development Standards

**Code Style:**

- ESLint with TypeScript-specific rules
- Strict type checking with explicit return types
- No `any` types (warnings enforced)
- Prefer nullish coalescing and optional chaining
- Modern ES patterns (const, template literals, object shorthand)

**Dependencies Philosophy:**

- Minimal surface area (5 core dependencies only)
- Official packages over community alternatives
- Security-first package selection
- Zero tolerance for vulnerabilities

## Key Patterns

**Error Handling:**

```typescript
// Use structured errors with codes
throw new N8NMcpError('Message', 'ERROR_CODE', 400, details);
```

**Configuration Updates:**

```typescript
// Runtime config updates through helper
const updated = updateConfig({ logLevel: 'debug' });
```

**Validation:**

```typescript
// All inputs validated via Zod schemas
const result = ValidationProfileSchema.parse(input);
```

## Testing Strategy

**Vitest Configuration:**

- Node environment with globals enabled
- v8 coverage provider
- HTML, JSON, and text reports
- Exclusions for dist/, node_modules/, type files
- Separate rules for test files (relaxed console/any usage)

## Publishing & Distribution

**GitHub Package:** `@eekfonky/n8n-mcp-modern` (GitHub Packages Registry)
**Binary:** `n8n-mcp` (via dist/index.js with shebang)
**Files:** dist/, data/, agents/, README.md, LICENSE
**Engine Requirement:** Node.js >=22.0.0

## Performance Characteristics

**Benchmarks vs Legacy (v3.x):**

- 95% smaller bundle (1.1GB → 15MB)
- 10x faster installation (3+ min → <30s)
- 2x faster runtime execution
- Zero security vulnerabilities (vs 16 critical)

## Node.js Upgrade Path

Currently targeting Node 22 LTS with future-ready architecture for Node 24 LTS (October 2025). The ESM-first, modern API approach ensures seamless upgrades without legacy compatibility concerns.
