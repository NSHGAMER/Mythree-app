import { defineConfig } from 'vitest/config'

// Integration tests against a live Supabase project (sequential – they share accounts).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 60_000,
  },
})
