import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'scripts/**',
      '**/*.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/dist/**',
        '**/node_modules/**',
        '**/*.d.ts',
        'tests/**',
        'scripts/**',
      ],
    },
    timeout: 30000, // Longer timeout for database tests
    testTimeout: 30000,
    // Test categorization and filtering
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results.json',
    },
    // Separate environments for different test types
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },
  },
})
