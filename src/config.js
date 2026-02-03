/**
 * App config (mirrors section 1). When loaded by the host, __formInitContext.onPremise / .repoId override.
 */
export const DEBUG = import.meta.env?.DEV ?? false
export const ON_PREMISE = (typeof window !== 'undefined' && window.__formInitContext?.onPremise === true) ||
  (import.meta.env?.VITE_ON_PREMISE === 'true') || false
export const REPO_ID = ((typeof window !== 'undefined' && window.__formInitContext?.repoId) ||
  import.meta.env?.VITE_REPO_ID) ?? null
