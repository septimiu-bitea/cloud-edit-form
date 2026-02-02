import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

/**
 * Build a single vue-app.js (IIFE, fixed name) for script-tag loading by the host.
 * Run after the main build so dist/ has both the SPA and assets/vue-app.js.
 * Usage: npm run build:bundle (or run after npm run build in CI).
 */
export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('./', import.meta.url))
  const env = loadEnv(mode, envDir, '')
  // When loaded as script on another origin, assets (fonts etc.) must use full URL
  const base = (env.VITE_BUNDLE_BASE_URL || env.VITE_BASE_PATH || '/').trim() || '/'

  return {
    base,
    plugins: [vue(), cssInjectedByJsPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false, // keep existing dist/ from main build
      rollupOptions: {
        input: fileURLToPath(new URL('./src/main.js', import.meta.url)),
        output: {
          format: 'iife',
          inlineDynamicImports: true,
          entryFileNames: 'assets/vue-app.js',
          chunkFileNames: 'assets/vue-app.js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  }
})
