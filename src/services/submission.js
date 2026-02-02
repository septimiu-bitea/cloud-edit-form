/**
 * Submission helpers (from section 12). Pure functions only – no state.
 * Components pass formData, prevMap, metaIdx; this module returns payloads or performs fetch.
 */
import { getNumericIdFromUuid } from '@/utils/idMapping'
import { coerceValueForType } from '@/utils/valueCoercion'
import { buildO2ValueIndex, buildSrmValueIndex } from '@/utils/valueExtraction'

/**
 * Build meta index (uuid -> { uuid, numericId, dataType, isMulti, readOnly }) from category properties.
 */
export function toMetaIndex (catPropsArr, { idMap } = {}) {
  const idx = new Map()
  for (const p of catPropsArr || []) {
    const uuid = String(p?.id ?? '')
    if (!uuid) continue
    idx.set(uuid, {
      uuid,
      numericId: getNumericIdFromUuid(idMap, uuid),
      dataType: String(p?.dataType || 'STRING').toUpperCase(),
      isMulti: !!p?.isMultiValue,
      readOnly: !!p?.isSystemProperty || !!p?.readOnly
    })
  }
  return idx
}

/**
 * Build previous-values map for diff (formData = initial form state after load).
 */
export function makePrevMap (o2json, srmItem, catPropsArr = [], idMap = {}, formData = null) {
  const o2Idx = buildO2ValueIndex(o2json || {}, idMap)
  const srmIdx = buildSrmValueIndex(srmItem || {})
  const prev = {}

  for (const p of catPropsArr || []) {
    const uuid = String(p?.id ?? '')
    if (!uuid) continue
    const isMulti = !!p?.isMultiValue
    const dt = String(p?.dataType || 'STRING').toUpperCase()
    const coerce = (v) => coerceValueForType(v, dt)

    if (isMulti) {
      let arr = o2Idx[uuid]
      if (!Array.isArray(arr)) {
        const num = Object.keys(idMap || {}).find(k => idMap[k] === uuid)
        if (num) arr = o2Idx[num]
      }
      if (!Array.isArray(arr) && formData && formData[uuid] != null) {
        const raw = formData[uuid]
        if (Array.isArray(raw)) arr = raw
        else if (typeof raw === 'string' && /[;,|]/.test(raw)) arr = raw.split(/[;,|]/).map(s => s.trim()).filter(Boolean)
        else if (raw != null && raw !== '') arr = [raw]
      }
      if (!Array.isArray(arr)) arr = []
      prev[uuid] = arr.map(coerce).filter(v => String(v).trim() !== '')
    } else {
      let v = srmIdx[uuid]
      const num = Object.keys(idMap || {}).find(k => idMap[k] === uuid)
      if (v == null && num) v = srmIdx[num]
      if (v == null && formData && formData[uuid] != null) v = formData[uuid]
      if (v == null && uuid === 'DOCUMENT_ID') v = srmIdx.property_document_id ?? srmIdx.DOCUMENT_ID
      if (v == null && uuid === 'CATEGORY') v = srmIdx.property_category ?? srmIdx.CATEGORY
      const s = (v == null ? '' : String(coerce(v))).trim()
      prev[uuid] = s
    }
  }
  return prev
}

const SEP_RE = /[;,|]/
const toUtf8Bytes = (s) => new TextEncoder().encode(String(s || '')).length

/**
 * Collect source properties from current formData vs prevMap. Returns { properties: [{ key, values }] }.
 * metaIdx: Map of uuid -> { uuid, dataType, isMulti, readOnly }.
 */
export function collectSourceProperties (formData = {}, prevMap = {}, metaIdx) {
  const data = formData
  const properties = []
  const entries = metaIdx instanceof Map ? metaIdx.entries() : Object.entries(metaIdx || {})

  const norm = (v, dt) => (coerceValueForType(v, dt) == null ? '' : String(coerceValueForType(v, dt))).trim()
  const normalizeMulti = (raw, dt) => {
    let arr
    if (Array.isArray(raw)) arr = raw.slice()
    else if (raw == null || raw === '') arr = []
    else if (typeof raw === 'string' && SEP_RE.test(raw)) arr = raw.split(SEP_RE).map(s => s.trim())
    else arr = [raw]
    return arr.map(v => norm(v, dt)).filter(v => v !== '')
  }

  for (const [uuid, meta] of entries) {
    const m = meta && typeof meta === 'object' ? meta : { uuid, readOnly: false, dataType: 'STRING', isMulti: false }
    const key = m.uuid ?? uuid
    if (m.readOnly) continue
    const dt = m.dataType
    const raw = data[key]
    const prevVal = prevMap[key]

    if (m.isMulti) {
      const curr = normalizeMulti(raw, dt)
      const prevArr = Array.isArray(prevVal) ? prevVal.map(v => norm(v, dt)).filter(v => v !== '') : []
      const changed = prevArr.length !== curr.length || prevArr.some((v, i) => v !== curr[i])
      if (!changed) continue
      const remaining = curr.slice()
      const values = prevArr.map(prevV => {
        const idx = remaining.findIndex(c => c === prevV)
        if (idx === -1) return ''
        return remaining.splice(idx, 1)[0]
      })
      values.push(...remaining)
      const tooLong = values.find(v => v !== '' && toUtf8Bytes(v) > 255)
      if (tooLong) throw new Error(`Value exceeds 255 bytes for field ${key}`)
      properties.push({ key, values })
    } else {
      const currVal = norm(raw, dt)
      if (currVal === norm(prevVal, dt)) continue
      if (currVal !== '' && toUtf8Bytes(currVal) > 255) throw new Error(`Value exceeds 255 bytes for field ${key}`)
      properties.push({ key, values: [currVal] })
    }
  }
  return { properties }
}

/**
 * Build O2m update payload body.
 */
export function buildO2mPayload ({
  sourceProperties,
  displayValue,
  filename,
  alterationText,
  sourceCategory,
  sourceId,
  contentLocationUri,
  contentUri
} = {}) {
  return {
    ...(displayValue ? { displayValue } : {}),
    ...(filename ? { filename } : {}),
    ...(alterationText ? { alterationText } : {}),
    ...(sourceCategory ? { sourceCategory } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(sourceProperties?.properties?.length ? { sourceProperties } : {}),
    ...(contentLocationUri ? { contentLocationUri } : {}),
    ...(contentUri ? { contentUri } : {})
  }
}

/**
 * PUT /o2m/{dmsObjectId} – cookie session. Returns { ok, status, json, text }.
 */
export async function putO2mUpdate ({ base, repoId, dmsObjectId, payload, apiKey }) {
  const url = `${base}/dms/r/${encodeURIComponent(repoId)}/o2m/${encodeURIComponent(dmsObjectId)}`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/hal+json, application/json;q=0.9' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const res = await fetch(url, {
    method: 'PUT',
    credentials: apiKey ? 'omit' : 'include',
    headers,
    body: JSON.stringify(payload)
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { }
  return { ok: res.ok, status: res.status, json, text }
}
