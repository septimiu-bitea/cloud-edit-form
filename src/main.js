import { createApp } from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import { log } from './utils/debug'

/**
 * ECM formInit contract: the host sets window.__formInitContext before loading this script.
 * Context contains: { form, base, uiLocale, data, mountEl }.
 */
let context = typeof window !== 'undefined' ? window.__formInitContext : null

// Local dev: if no host context but .env.local vars are set, use a mock context.
// Use /api so Vite dev proxy handles requests (avoids CORS to d.velop).
const baseUrl = (import.meta.env.VITE_BASE_URL || '').trim()
const docId = (import.meta.env.VITE_DOCUMENT_ID || '').trim()
const onPremise = import.meta.env.VITE_ON_PREMISE === 'true' || import.meta.env.VITE_ON_PREMISE === '1'
if (!context && import.meta.env.DEV && baseUrl) {
  context = {
    base: '/api', // proxy in vite.config.js forwards /api -> VITE_BASE_URL
    uiLocale: 'en',
    data: docId ? { docId } : {},
    mountEl: null,
    onPremise: onPremise,
    repoId: import.meta.env.VITE_REPO_ID || null
  }
  if (typeof window !== 'undefined') window.__formInitContext = context
  log('[vue-app] Mock context from .env.local:', {
    base: context.base + ' -> ' + baseUrl,
    docId: context.data.docId || '(none)',
    onPremise: context.onPremise,
    repoId: context.repoId || '(auto-detect)'
  })
} else if (!context && import.meta.env.DEV) {
  log('[vue-app] Standalone: no mock context. Set VITE_BASE_URL in vue-app/.env.local and restart: npm run dev')
}

let mountTarget
if (context && context.mountEl && context.mountEl instanceof Node) {
  mountTarget = context.mountEl
} else {
  mountTarget = document.getElementById('app')
  if (!mountTarget) {
    mountTarget = document.createElement('div')
    mountTarget.id = 'app'
    document.body.appendChild(mountTarget)
  }
}

const app = createApp(App)
app.use(vuetify)
if (context) {
  app.provide('formInitContext', context)
}
app.mount(mountTarget)
