// DEBUG flag: comes from scripts/loading.js via window.__formInitContext.debug (when loaded by host),
// or from Vite dev mode (import.meta.env.DEV) for local development.
// When loaded by the host, __formInitContext.debug overrides env vars.
// VITE_LOG_FETCH=true enables all logs (including API fetch logs) regardless of other flags.
const DEBUG = (import.meta.env?.VITE_LOG_FETCH === 'true' || import.meta.env?.VITE_LOG_FETCH === '1') ||
  (typeof window !== 'undefined' && window.__formInitContext?.debug === true) ||
  (import.meta.env?.DEV ?? false)

export function log (...args) {
  if (DEBUG) console.log('[vue-app]', ...args)
}

export function warn (...args) {
  if (DEBUG) console.warn('[vue-app]', ...args)
}

export function error (...args) {
  // Errors are always shown, but prefixed with DEBUG flag status
  if (DEBUG) {
    console.error('[vue-app]', ...args)
  } else {
    // In production, still log errors but without verbose details
    console.error('[vue-app]', ...args)
  }
}

export function info (...args) {
  if (DEBUG) console.info('[vue-app]', ...args)
}

export function dbgTable (label, objOrArr) {
  if (!DEBUG) return
  console.groupCollapsed(label)
  if (Array.isArray(objOrArr)) {
    objOrArr.slice(0, 10).forEach((x, i) => console.log(i, x))
    if (objOrArr.length > 10) console.log('…', objOrArr.length - 10, 'more')
  } else if (objOrArr && typeof objOrArr === 'object') {
    console.table(objOrArr)
  }
  console.groupEnd()
}
