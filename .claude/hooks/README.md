# n8n-MCP Modern - Claude Code Hooks

This directory contains project-specific Claude Code hooks that ensure agents stay focused and maintain code quality standards.

## 🎯 Hook Overview

### PreToolUse Hooks (Validation Before Actions)
- **`validate-agent-routing.py`** - Ensures queries are routed to appropriate n8n specialists
- **`protect-sensitive-files.py`** - Prevents accidental modification of critical project files  
- **`validate-bash-commands.py`** - Validates bash commands against security and performance best practices

### PostToolUse Hooks (Actions After Completion)
- **`auto-format-code.py`** - Automatically formats code files using Prettier and validates TypeScript

### UserPromptSubmit Hooks (Context Injection)
- **`inject-n8n-context.py`** - Provides relevant project context and suggests appropriate agent routing

### Stop Hooks (Completion Validation)
- **`validate-completion.py`** - Validates project state before task completion (TypeScript, tests, linting, build)

## 🛡️ Agent Routing Enforcement

The `validate-agent-routing.py` hook ensures queries are routed to the right specialist:

| Agent | Specialization | Keywords |
|-------|----------------|----------|
| `n8n-workflow-architect` | Strategic planning & coordination | strategic, planning, coordination, architecture, complex, multi-system |
| `n8n-developer-specialist` | Code generation & DevOps | code, generate, template, workflow, docker, devops, ci/cd |
| `n8n-integration-specialist` | Authentication & connectivity | oauth, auth, api, webhook, integration, connectivity |
| `n8n-node-specialist` | 525+ nodes & AI/ML workflows | node, ai, ml, llm, vector, embedding, community |
| `n8n-performance-specialist` | Monitoring & optimization | monitor, performance, optimize, alert, dashboard, sla |
| `n8n-guidance-specialist` | Documentation & support | help, guide, tutorial, documentation, getting started |

## 🔒 File Protection

Protected file patterns:
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- `.env*`, `secrets.*`
- `.git/`, `.gitignore`
- `dist/`, `build/`, `node_modules/`
- `data/*.db`, `data/*.sqlite`

Validation required for:
- `package.json`, `tsconfig.json`
- `vitest.config.*`, `.mcp.json`
- `CLAUDE.md`

## ⚡ Code Quality Automation

### Auto-formatting with Prettier for:
- TypeScript/JavaScript (`.ts`, `.js`, `.jsx`, `.tsx`, `.mjs`)
- JSON, Markdown (`.md`, `.mdx`), YAML (`.yml`, `.yaml`) files
- Excludes: `node_modules/`, `dist/`, minified files, database files

### Comprehensive Validations:

**TypeScript (.ts/.tsx):**
- Warns about `any` types
- Suggests using project logger over `console.*`
- Flags `@ts-ignore` usage
- Runs type checking for critical files

**JavaScript (.js/.jsx/.mjs):**
- Suggests `const`/`let` over `var`
- Recommends strict equality (`===` over `==`)
- Warns about security risks (`eval()`, `with()`)
- Suggests project logger over `console.*`
- Flags deprecated patterns (`document.write`)

**JSON (.json):**
- Validates JSON syntax
- **n8n node-specific checks**: `displayName`, `name`, `version`, `properties`, `inputs`, `outputs`
- **package.json checks**: Required fields for n8n/MCP projects
- Credential and trigger node validations

**Markdown (.md/.mdx):**
- **Agent file validation**: YAML frontmatter presence and structure
- Code block language specification
- Empty header detection
- Link and image URL validation
- TODO/FIXME formatting standards

**YAML (.yml/.yaml):**
- YAML syntax validation
- Indentation consistency (spaces vs tabs)
- Empty value detection
- **Docker Compose checks**: `version` and `services` fields
- Configuration field validation (`name`, `version`, `description`)

## 🎯 Context-Aware Assistance

Automatic context injection provides:
- **Project identification**: n8n-MCP Modern v4.3.0
- **Agent routing suggestions**: Based on prompt keywords
- **Technical context**: For debugging, testing, deployment scenarios
- **Project status**: Validates project structure

## 🔧 Bash Command Validation

Security and performance validations:
- **Performance**: Suggests `rg` over `grep`, `rg --files` over `find`
- **Security**: Blocks dangerous `rm -rf /`, `chmod 777`, privileged Docker
- **Best practices**: Recommends npm scripts over direct tool usage

## ✅ Completion Validation

Before task completion, validates:
- **TypeScript compilation**: `npm run typecheck`
- **Test status**: `npm test` (100% pass rate)
- **Code quality**: `npm run lint`
- **Build status**: `npm run build`
- **Agent consistency**: All 6 agents properly configured

## 🚀 Usage

Hooks are automatically executed by Claude Code when:
1. Using Task tool (agent routing validation)
2. Editing files (protection + auto-formatting)
3. Running bash commands (security validation)
4. Submitting prompts (context injection)
5. Completing tasks (final validation)

## 🔧 Configuration

Hooks are configured in `.claude/settings.json` and use project-relative paths with `$CLAUDE_PROJECT_DIR`.

All hooks are **project-specific** and stored in `.claude/hooks/` (not `~/.claude/`).

## 📋 Environment Requirements

- Node.js 22+ (for npm commands)
- Python 3.7+ (for hook scripts)
- Project dependencies installed (`npm ci`)

## 🐛 Debugging

Enable debug mode to see hook execution:
```bash
claude --debug
```

Hook execution details appear in transcript mode (Ctrl-R).