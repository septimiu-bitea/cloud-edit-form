/**
 * Value coercion and normalization (from section 8).
 */

export function toISODateIfPossible (val) {
  if (!val) return val
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return val
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Match DD.MM.YYYY or DD.MM.YYYY HH:mm:ss (locale datetime). */
const LOCALE_DATETIME_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/

/**
 * Coerce a value to ISO 8601 date/datetime string for API (e.g. system properties).
 * Handles locale format like "04.11.2021 11:19:29" and returns "2021-11-04T11:19:29".
 */
export function toISODateTimeIfPossible (val) {
  if (val == null || val === '') return val
  const s = String(val).trim()
  if (!s) return val
  if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = LOCALE_DATETIME_RE.exec(s)
  if (m) {
    const [, day, month, year, h = '0', min = '0', sec = '0'] = m
    const pad = (x) => String(x).padStart(2, '0')
    return `${year}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(min)}:${pad(sec)}`
  }
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 19)
  return val
}

export function coerceValueForType (val, dataType) {
  switch (dataType) {
    case 'DATE':
      return toISODateIfPossible(val)
    case 'DATETIME':
      return val
    case 'NUMBER':
    case 'DECIMAL':
    case 'INTEGER': {
      if (val === '' || val == null) return val
      const n = Number(String(val).replace(/\s/g, ''))
      return Number.isNaN(n) ? val : n
    }
    case 'BOOLEAN':
      if (typeof val === 'boolean') return val
      if (val === 'true' || val === '1' || val === 1) return true
      if (val === 'false' || val === '0' || val === 0) return false
      return !!val
    default:
      return val == null ? '' : String(val)
  }
}

export function normalizeDatasetOptions (ds, locale) {
  const vals = Array.isArray(ds?.values) ? ds.values : []
  const langs = [locale, (locale || '').split('-')[0], 'en', 'de-DE', 'de'].filter(Boolean)
  const pickLabel = (entry) => {
    for (const k of langs) {
      const v = (entry?.[k] ?? '').toString().trim()
      if (v) return v
    }
    return (entry?.['x-original'] ?? '').toString().trim()
  }
  return vals
    .map(e => {
      const value = (e?.['x-original'] ?? '').toString().trim()
      if (!value) return null
      const label = pickLabel(e)
      return { label, value }
    })
    .filter(Boolean)
}

export function mapInitialToDatasetValue (init, options) {
  if (init == null) return init
  const str = String(init).trim()
  if (!str) return str
  if (options.some(o => o.value === str)) return str
  const hit = options.find(o => o.label === str)
  return hit ? hit.value : str
}

export function mapInitialArrayToDatasetValues (initArr, options) {
  const arr = Array.isArray(initArr) ? initArr : [initArr]
  return arr.map(v => mapInitialToDatasetValue(v, options)).filter(v => v != null && String(v).trim() !== '')
}

export const normalizeExistingOptions = (json) =>
  (Array.isArray(json?.values) ? json.values : []).map(x => {
    const v = String(x?.value ?? '')
    return { label: v, value: v }
  })

export function coerceForExistingValues (val, isMulti) {
  const toStr = (v) => (v == null ? '' : String(v))
  return isMulti ? (Array.isArray(val) ? val.map(toStr) : [toStr(val)]) : toStr(val)
}
