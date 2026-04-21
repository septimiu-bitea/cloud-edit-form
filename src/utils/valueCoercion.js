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
    const vo = (entry?.value ?? entry?.displayValue ?? entry?.['x-original'] ?? '').toString().trim()
    return vo
  }
  return vals
    .map(e => {
      // Cloud datasets often use `x-original` as stored key; some responses only set `value`.
      const value = (e?.['x-original'] ?? e?.value ?? '').toString().trim()
      if (!value) return null
      const label = pickLabel(e) || value
      return { label, value }
    })
    .filter(Boolean)
}

export function mapInitialToDatasetValue (init, options) {
  if (init == null) return init
  const str = String(init).trim()
  if (!str) return str
  if (options.some(o => o.value === str)) return str
  const hit =
    options.find(o => o.label === str) ||
    options.find(o => o.label.localeCompare(str, undefined, { sensitivity: 'base' }) === 0)
  return hit ? hit.value : str
}

export function mapInitialArrayToDatasetValues (initArr, options) {
  const arr = Array.isArray(initArr) ? initArr : [initArr]
  return arr.map(v => mapInitialToDatasetValue(v, options)).filter(v => v != null && String(v).trim() !== '')
}

function valueInDatasetOptions (v, options) {
  const s = String(v ?? '').trim()
  if (!s) return false
  return options.some(o => String(o.value).trim() === s)
}

/**
 * When `options` is loaded, keep only values that exist in the dataset (by key or label match).
 * If nothing matches, return ''.
 * When `options` is empty (not loaded yet), return `init` unchanged.
 */
export function coerceDatasetValueStrict (init, options) {
  if (!options || options.length === 0) return init
  if (init == null || init === '') return ''
  const str = String(init).trim()
  if (!str) return ''
  if (valueInDatasetOptions(str, options)) return str
  const mapped = mapInitialToDatasetValue(str, options)
  if (valueInDatasetOptions(mapped, options)) return String(mapped).trim()
  return ''
}

/**
 * Multi value list: keep only entries that resolve to a valid stored key; drop the rest.
 */
export function coerceDatasetMultiStrict (init, options) {
  if (!options || options.length === 0) return init
  const raw = Array.isArray(init) ? init : (init == null || init === '' ? [] : [init])
  const seen = new Set()
  const out = []
  for (const item of raw) {
    const v = item != null && typeof item === 'object' && 'value' in item ? item.value : item
    const s = coerceDatasetValueStrict(v, options)
    if (s && !seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  return out
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
