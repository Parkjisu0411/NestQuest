import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { apiProxy } from './scripts/api-proxy.mjs'
import { loadEnv } from 'vite'
import { keysFromEnvironment } from './src/data/apiKeyConfig.ts'

export default defineConfig(({ mode }) => ({
  // Only these runtime credentials are embedded; signing/download-only keys are excluded.
  // Unit tests never inject the user's real credentials.
  define: { __NESTQUEST_API_KEYS__: JSON.stringify(keysFromEnvironment(mode === 'test' ? {} : loadEnv(mode, process.cwd(), 'NESTQUEST_'))) },
  plugins: [react(), { name: 'local-provider-proxy', configureServer(server) { server.middlewares.use((req, res, next) => { void apiProxy(req, res, next) }) } }],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
