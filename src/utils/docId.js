/**
 * Document ID resolution (from section 2). No Form.io dependency.
 */
import { log as debugLog } from './debug'

function readParam (name, def = '') {
  try {
    return new URL(window.location.href).searchParams.get(name) || def
  } catch {
    return def
  }
}

export function extractDocIdFromAny (v) {
  if (!v) return ''
  const s = String(v).trim()
  if (!/[/]/.test(s) && /^[A-Za-z0-9].*$/.test(s)) return s
  const pathish = s.startsWith('dmsObject:///') ? s.replace(/^dmsObject:\/\//, '') : s
  const m = pathish.match(/\/o2\/([^/?#]+)/i)
  if (m && m[1]) return m[1]
  try {
    const u = new URL(s, window.location.origin)
    const segs = (u.pathname || '').split('/').filter(Boolean)
    if (segs.length) return segs[segs.length - 1]
  } catch { /* not a URL */ }
  return ''
}

/**
 * Resolve document ID from process/URL params (dmsObjectId, dv_attachment, dvDocPath, o2url).
 */
export function resolveDocIdFromProcess (opts = {}) {
  const { params = ['dmsObjectId', 'dv_attachment', 'dvDocPath', 'o2url'], log = false } = opts
  const values = Object.fromEntries(params.map(p => [p, readParam(p, '')]))
  const docId =
    extractDocIdFromAny(values.dmsObjectId) ||
    extractDocIdFromAny(values.dv_attachment) ||
    extractDocIdFromAny(values.dvDocPath) ||
    extractDocIdFromAny(values.o2url) ||
    ''
  if (log) {
    console.groupCollapsed('[process → docId]')
    Object.entries(values).forEach(([k, v]) => debugLog(`${k}:`, v))
    debugLog('resolvedDocId:', docId)
    console.groupEnd()
  }
  return docId
}
