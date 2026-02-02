/**
 * App config (mirrors section 1). Can be overridden by env or window.
 */
export const DEBUG = import.meta.env?.DEV ?? false
export const ON_PREMISE = import.meta.env?.VITE_ON_PREMISE === 'true' ?? false
export const REPO_ID = import.meta.env?.VITE_REPO_ID ?? null
