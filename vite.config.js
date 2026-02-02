import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('./', import.meta.url))
  const env = loadEnv(mode, envDir, '')
  const baseUrl = (env.VITE_BASE_URL || '').trim().replace(/\/$/, '')
  // For static hosting: base path (e.g. '/' or '/ecm.forms.edit/' for GitHub Pages repo site)
  const base = (env.VITE_BASE_PATH || '/').trim() || '/'

  return {
  base,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: baseUrl ? {
    proxy: {
      '/api': {
        target: baseUrl,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  } : undefined,
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  }
})
