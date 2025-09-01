import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/**/*.js', // Exclude Node.js test runner format files
      'scripts/**',
      '**/*.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/dist/**', '**/node_modules/**', '**/*.d.ts', 'tests/**'],
    },
  },
})
