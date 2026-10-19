import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@modules': resolve('src/modules'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    env: { LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8' },
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts']
  }
})
