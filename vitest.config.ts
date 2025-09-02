import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
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
        'src/tests/**',
      ],
    },
    timeout: 30000, // Longer timeout for database tests
    testTimeout: 30000,
  },
})
