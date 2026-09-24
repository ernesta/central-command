import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = {
  '@shared': resolve('src/shared'),
  '@modules': resolve('src/modules')
}

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      // These are ESM-only, but the main process is built as CommonJS, so Electron cannot
      // require() them from node_modules. Bundle them into the main build instead.
      externalizeDeps: { exclude: ['@retorquere/bibtex-parser', 'chokidar'] }
    }
  },
  preload: { resolve: { alias } },
  renderer: {
    resolve: { alias: { ...alias, '@renderer': resolve('src/renderer/src') } },
    plugins: [react()]
  }
})
