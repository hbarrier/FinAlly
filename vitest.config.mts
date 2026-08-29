import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // Pin a timezone *behind* UTC so date-basis tests are deterministic on any
    // runner (GitHub Actions is UTC) and actually exercise the UTC-vs-local gap.
    env: { TZ: 'America/New_York' },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
})
