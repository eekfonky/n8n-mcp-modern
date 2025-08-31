import antfu from '@antfu/eslint-config'

export default antfu({
  // Type of the project - library configuration
  type: 'lib',

  // Enable TypeScript support
  typescript: {
    overrides: {
      'ts/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'ts/no-explicit-any': 'warn',
      'ts/explicit-function-return-type': 'warn',
      'ts/no-non-null-assertion': 'error',
      'ts/consistent-type-definitions': ['error', 'interface'],
    },
  },

  // Enable stylistic formatting rules with modern patterns
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: false,
  },

  // Enable formatters for better code style
  formatters: {
    css: true,
    html: true,
    markdown: 'prettier',
  },

  // Disable JSONC and YAML for now to keep focused
  jsonc: false,
  yaml: false,

  // Ignore patterns (replaces .eslintignore)
  ignores: [
    '**/fixtures',
    '**/node_modules',
    '**/dist',
    '**/coverage',
    '**/*.d.ts',
    '**/data/nodes.db*',
    'CLAUDE.md/**/*',
    '**/*.log',
    '.vscode/**/*',
    '**/*.md',
    '**/agents/**/*.md',
    '**/.claude/**/*.md',
  ],
},
// Additional configuration for specific needs
{
  files: ['src/**/*.ts'],
  rules: {
    // n8n-mcp-modern specific rules
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    'no-control-regex': 'error',

    // MCP server performance optimizations
    'no-await-in-loop': 'warn',
    'no-promise-executor-return': 'error',
    'prefer-promise-reject-errors': 'error',
  },
}, {
  files: ['**/*.test.ts', '**/*.spec.ts'],
  rules: {
    // Test files can be more lenient
    'no-console': 'off',
    'ts/no-explicit-any': 'off',
    'ts/no-unused-vars': 'off',
    'unused-imports/no-unused-vars': 'off',
    'ts/explicit-function-return-type': 'off',
    'ts/no-non-null-assertion': 'off',
    'no-promise-executor-return': 'off',

    // Test-specific performance rules
    'no-await-in-loop': 'off',
    'no-new': 'off',
    'vars-on-top': 'off',
  },
}, {
  files: ['src/server/logger.ts', 'scripts/**/*.ts', 'scripts/**/*.js', 'analyze-bundle.js', 'benchmark.cjs', '**/*.test.js'],
  rules: {
    'no-console': 'off',
    'no-undef': 'off',
    'node/prefer-global/process': 'off',
    'no-restricted-globals': 'off',
  },
})
