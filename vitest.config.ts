import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    globalSetup: ['./tests/e2e/global-setup.ts'],
    setupFiles: ['./tests/e2e/setup-file.ts'],
    hookTimeout: 30_000,
    testTimeout: 10_000,
  },
})
