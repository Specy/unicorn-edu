import { defineConfig } from 'vitest/config'

// `npm run measure`: throughput through the public API, kept out of `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.measure.ts'],
    testTimeout: 120_000,
  },
})
