import process from 'node:process'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // Test environment configuration
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      DISABLE_CONSOLE_OUTPUT: 'true',
      DATABASE_IN_MEMORY: 'true',
      ENABLE_CACHE: 'false',
      CACHE_TTL: '1',
    },

    // Performance optimizations
    threads: true,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 2,
        maxThreads: 4,
      },
    },

    // Timeouts
    testTimeout: 30000,
    hookTimeout: 10000,

    // File patterns
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      '.claude/**',
      'agents/**',
      '**/node_modules/**',
    ],

    // Coverage configuration with v8 provider
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Coverage thresholds
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 90,
          statements: 90,
        },
      },

      // Include/exclude patterns
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        '**/tests/**',
        'src/index.ts',
        'src/scripts/**',
      ],

      // Advanced v8 coverage options
      clean: true,
      cleanOnRerun: true,
      all: true,
    },

    // Reporter configuration
    reporter: process.env.CI ? ['github-actions', 'json'] : ['verbose'],

    // Setup files
    setupFiles: ['src/tests/setup.ts'],

    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
  },

  // ESBuild optimizations for faster compilation
  esbuild: {
    target: 'node22',
    format: 'esm',
    sourcemap: true,
  },
})
