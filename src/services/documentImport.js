/**
 * Document import: chunked blob upload + POST /o2m create (aligned with on_prod alpma.js).
 */
import {
  coerceValueForType,
  mapInitialToDatasetValue,
  mapInitialArrayToDatasetValues,
  coerceDatasetValueStrict,
  coerceDatasetMultiStrict
} from '../utils/valueCoercion.js'
import { categoryOnlyProperties, buildRequiredFromCategoryPropertyRefs } from '../utils/systemProperties.js'

const SEP_RE = /[;,|]/
const toUtf8Bytes = (s) => new TextEncoder().encode(String(s || '')).length

function fetchOpts (apiKey) {
  return {
    credentials: apiKey ? 'omit' : 'include',
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
  }
}

/** Short unique filename for chunk session (alpma-style). */
export function makeUniqueMasterName (fileName, { useUTC = false } = {}) {
  const baseFull = String(fileName || 'upload.bin').split(/[/\\]/).pop()
  const m = baseFull.match(/^(.*?)(\.[A-Za-z0-9]{1,10})?$/)
  const baseOnly = (m && m[1]) || 'upload'
  const ext = (m && m[2]) || ''
  const d = new Date()
  const hh = String(useUTC ? d.getUTCHours() : d.getHours()).padStart(2, '0')
  const mm = String(useUTC ? d.getUTCMinutes() : d.getMinutes()).padStart(2, '0')
  const ss = String(useUTC ? d.getUTCSeconds() : d.getSeconds()).padStart(2, '0')
  const hhmmss = `${hh}${mm}${ss}`
  const ascii = baseOnly.normalize('NFKD').replace(/[^\x20-\x7E]/g, '')
  const safe = ascii.replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '_')
  const shortBase = safe.slice(0, 10)
  const uniq = (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(-8)
  return `${shortBase}_${hhmmss}_${uniq}${ext}`
}

export function pickContinuationFromResponse (res, rawText, repoId, base) {
  try {
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (ct.includes('application/json') && rawText) {
      const j = JSON.parse(rawText)
      if (Array.isArray(j) && j.length > 0) {
        const v = j[0]?.BlobChunkUri?.value || j[0]?.blobChunkUri?.value
        if (typeof v === 'string' && v.startsWith('/dms/')) return v
      }
      if (j?.contentLocationUri) return j.contentLocationUri
      if (j?.content_location_uri) return j.content_location_uri
      if (j?.contentUri) return j.contentUri
      if (j?.chunkId) return `/dms/r/${encodeURIComponent(repoId)}/blob/chunk/${j.chunkId}`
      if (typeof j?.location === 'string' && j.location.startsWith('/dms/')) return j.location
    }
  } catch { /* ignore */ }
  const hdr =
    res.headers.get('Location') ||
    res.headers.get('Content-Location') ||
    res.headers.get('X-DV-Location') ||
    res.headers.get('X-Content-Location') ||
    res.headers.get('location') ||
    res.headers.get('content-location') ||
    null
  if (hdr) return hdr
  if (rawText && rawText.startsWith('/dms/')) return rawText
  return null
}

/**
 * Upload file in chunks; returns relative contentLocationUri for POST /o2m.
 */
export async function uploadFileInChunks ({
  base,
  repoId,
  fileBlob,
  fileName,
  chunkSize = 8 * 1024 * 1024,
  onProgress = null,
  apiKey
} = {}) {
  if (!fileBlob || !fileBlob.size) throw new Error('No file content to upload.')
  if (!base || !repoId) throw new Error('Missing base or repoId.')

  const masterName = makeUniqueMasterName(fileName)
  if (import.meta.env.DEV) console.log('[import] chunk upload', { fileName, masterName, size: fileBlob.size })

  const entryUrl = `${base}/dms/r/${encodeURIComponent(repoId)}/blob/chunk/`
  let nextPostUrl = entryUrl
  let contentLocationUri = null
  let isFirst = true

  const validRel = (rel) =>
    typeof rel === 'string' &&
    /^\/dms\/r\/[0-9a-f-]{36}\/blob\/chunk\/[A-Za-z0-9._=-]+$/.test(rel) &&
    !rel.endsWith('-')

  const baseFetch = fetchOpts(apiKey)

  const post = async (url, start, end) => {
    const slice = fileBlob.slice(start, end)
    const headers = {
      ...baseFetch.headers,
      'Content-Type': 'application/octet-stream'
    }
    if (isFirst) headers.Accept = 'application/json'

    const res = await fetch(url, {
      method: 'POST',
      credentials: baseFetch.credentials,
      headers,
      body: slice
    })

    const rawText = await res.text()

    if (!(res.status === 200 || res.status === 201)) {
      if (isFirst && /use location uri of first post response/i.test(rawText || '')) {
        const picked = pickContinuationFromResponse(res, rawText, repoId, base)
        if (picked) {
          const rel = picked.startsWith('http') ? picked.replace(new URL(base).origin, '') : picked
          if (validRel(rel)) {
            const err = new Error('RESTART_WITH_CONTINUATION')
            err.name = 'RestartUpload'
            err.continuation = picked.startsWith('http') ? picked : (base + rel)
            throw err
          }
        }
      }
      throw new Error(`blob/chunk failed: HTTP ${res.status} ${rawText?.slice(0, 300)}`)
    }

    if (isFirst) {
      let picked = pickContinuationFromResponse(res, rawText, repoId, base)
      if (!picked) throw new Error('No contentLocationUri from first chunk response.')

      const rel = picked.startsWith('http') ? picked.replace(new URL(base).origin, '') : picked
      const looksValid = validRel(rel)
      const looksTruncated = typeof rel === 'string' && /-+$/.test(rel)
      if (!looksValid && !looksTruncated) {
        throw new Error(`Invalid continuation URL: ${rel}`)
      }

      contentLocationUri = rel
      nextPostUrl = picked.startsWith('http') ? picked : (base + rel)
      isFirst = false
    }

    return true
  }

  let restartUrl = null
  let attempts = 0

  while (true) {
    attempts++
    nextPostUrl = restartUrl || entryUrl
    isFirst = !restartUrl
    contentLocationUri = null

    try {
      for (let start = 0; start < fileBlob.size; start += chunkSize) {
        const end = Math.min(start + chunkSize, fileBlob.size)
        await post(nextPostUrl, start, end)
        if (onProgress) {
          const percent = (100 * end / fileBlob.size).toFixed(1)
          onProgress({ percent, bytesUploaded: end, totalBytes: fileBlob.size })
        }
      }
      break
    } catch (e) {
      if (e?.name === 'RestartUpload' && e.continuation && attempts < 3) {
        restartUrl = e.continuation
        continue
      }
      throw e
    }
  }

  if (!contentLocationUri) throw new Error('No contentLocationUri after upload.')
  return contentLocationUri
}

/**
 * POST /o2m — create new document.
 */
export async function createDocumentO2M ({ base, repoId, payload, apiKey } = {}) {
  const url = `${base}/dms/r/${encodeURIComponent(repoId)}/o2m`
  const fo = fetchOpts(apiKey)
  const res = await fetch(url, {
    method: 'POST',
    credentials: fo.credentials,
    headers: {
      ...fo.headers,
      Accept: 'application/json, application/hal+json;q=0.9',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, headers: res.headers, json, text }
}

/**
 * Parse document id from O2M create response. Some tenants return 201 with the id only in
 * Location / Content-Location or HAL _links, not as top-level json.id.
 */
export function extractDocumentIdFromO2mResponse ({ json, headers, text } = {}) {
  const normalizeId = (v) => {
    if (v == null || v === '') return null
    const s = String(v).trim()
    return s || null
  }

  const idFromHref = (href) => {
    if (typeof href !== 'string' || !href) return null
    try {
      const u = href.includes('://') ? new URL(href) : new URL(href, 'http://local.placeholder')
      const m = u.pathname.match(/\/o2\/([^/]+)/i)
      if (m) return decodeURIComponent(m[1])
    } catch { /* ignore */ }
    return null
  }

  const directFromObject = (obj) => {
    if (!obj || typeof obj !== 'object') return null
    let id = normalizeId(
      obj.id ?? obj.dmsObjectId ?? obj.documentId ?? obj.dms_object_id
    )
    if (id) return id
    const store = obj.storeObject ?? obj.dmsObject
    if (store && typeof store === 'object') {
      id = normalizeId(store.id ?? store.dmsObjectId)
      if (id) return id
    }
    const href =
      obj._links?.self?.href ||
      obj._links?.['o2:self']?.href ||
      obj._links?.o2?.href
    id = idFromHref(href)
    if (id) return id
    const emb = obj._embedded
    if (emb && typeof emb === 'object') {
      for (const v of Object.values(emb)) {
        if (v && typeof v === 'object') {
          id = normalizeId(v.id ?? v.dmsObjectId ?? v.documentId)
          if (id) return id
        }
      }
    }
    return null
  }

  const fromObject = (obj) => {
    if (!obj || typeof obj !== 'object') return null
    let id = directFromObject(obj)
    if (id) return id
    const wrap = obj.result ?? obj.data
    if (wrap && typeof wrap === 'object' && !Array.isArray(wrap)) {
      id = directFromObject(wrap)
      if (id) return id
    }
    return null
  }

  if (json != null) {
    if (Array.isArray(json) && json.length > 0) {
      const id = fromObject(json[0])
      if (id) return id
    } else if (typeof json === 'object') {
      const id = fromObject(json)
      if (id) return id
    }
  }

  if (headers && typeof headers.get === 'function') {
    const loc = headers.get('Location') || headers.get('Content-Location')
    if (loc) {
      const id = idFromHref(loc)
      if (id) return id
    }
  }

  if (text && typeof text === 'string') {
    const t = text.trim()
    if (t && !/[\s{[]/.test(t) && t.length <= 200) return t
  }

  return null
}

const norm = (v, dt) => {
  const c4 = coerceValueForType(v, dt)
  return (c4 == null ? '' : String(c4)).trim()
}

function datasetOptsForProp (p, datasetOptionsByDataSetId) {
  if (!datasetOptionsByDataSetId || typeof datasetOptionsByDataSetId !== 'object') return []
  const dsKey = String(p.dataSetId || p.id || '').trim()
  if (!dsKey) return []
  const opts = datasetOptionsByDataSetId[dsKey]
  return Array.isArray(opts) ? opts : []
}

/**
 * Clear or fix value-list fields when AI / paste sent a string that is not in the dataset.
 * Only runs where `datasetOptionsByDataSetId` has entries for that property.
 */
export function sanitizeImportFormDatasetValues (formData = {}, catPropsArr = [], idMap = {}, datasetOptionsByDataSetId = {}) {
  const out = { ...formData }
  const props = categoryOnlyProperties(catPropsArr || [])
  for (const p of props) {
    if (p.readOnly || p.isSystemProperty) continue
    const pid = p.id != null ? String(p.id) : ''
    if (!pid) continue
    const uuid = idMap[pid] || pid
    const opts = datasetOptsForProp(p, datasetOptionsByDataSetId)
    if (!opts.length) continue
    const raw = out[uuid]
    if (raw == null || raw === '') continue
    if (Array.isArray(raw) && raw.length === 0) continue
    if (p.isMultiValue) {
      out[uuid] = coerceDatasetMultiStrict(raw, opts)
    } else {
      out[uuid] = coerceDatasetValueStrict(raw, opts)
    }
  }
  return out
}

const normalizeMulti = (raw, dt) => {
  let arr
  if (Array.isArray(raw)) {
    arr = raw.map(item => {
      if (item != null && typeof item === 'object' && 'value' in item) return item.value
      return item
    })
  } else if (raw == null || raw === '') arr = []
  else if (typeof raw === 'string' && SEP_RE.test(raw)) arr = raw.split(SEP_RE).map(s => s.trim())
  else arr = [raw]

  const seen = new Set()
  return arr
    .map(v => norm(v, dt))
    .filter(v => v !== '' && !seen.has(v) && (seen.add(v), true))
}

/**
 * Map formData + category props → sourceProperties.properties for create payload.
 * Keys sent to API: property UUID (idMap[numericId] || id).
 * @param {Record<string, { label: string, value: string }[]>} [datasetOptionsByDataSetId] — cloud value lists; labels are mapped to stored keys.
 */
export function buildImportSourceProperties (formData = {}, catPropsArr = [], idMap = {}, datasetOptionsByDataSetId = {}) {
  const properties = []
  const props = categoryOnlyProperties(catPropsArr || [])

  for (const p of props) {
    if (p.readOnly || p.isSystemProperty) continue
    const pid = p.id != null ? String(p.id) : ''
    if (!pid) continue

    const propKey = idMap[pid] || pid
    const storageKey = propKey
    const raw = formData[storageKey]
    if (raw == null || raw === '') continue
    if (Array.isArray(raw) && raw.length === 0) continue

    const dt = String(p?.dataType || 'STRING').toUpperCase()
    const isMulti = !!p?.isMultiValue
    const opts = datasetOptsForProp(p, datasetOptionsByDataSetId)

    if (isMulti) {
      let curr = normalizeMulti(raw, dt)
      if (opts.length) {
        curr = mapInitialArrayToDatasetValues(curr, opts)
      }
      if (curr.length === 0) continue
      const tooLong = curr.find(v => toUtf8Bytes(v) > 255)
      if (tooLong) throw new Error(`Value exceeds 255 bytes for property ${propKey}`)
      properties.push({ key: propKey, values: curr })
    } else {
      let currVal = norm(raw, dt)
      if (opts.length) {
        currVal = mapInitialToDatasetValue(currVal, opts)
      }
      if (currVal === '') continue
      if (toUtf8Bytes(String(currVal)) > 255) throw new Error(`Value exceeds 255 bytes for property ${propKey}`)
      properties.push({ key: propKey, values: [String(currVal)] })
    }
  }

  return properties
}

/**
 * Apply cloud category.propertyRefs mandatory flags onto cat props (same as EditView).
 */
export function applyCategoryMandatoryFlags (categoryItem, catPropsArr) {
  if (!categoryItem || !Array.isArray(catPropsArr)) return
  const requiredByRef = buildRequiredFromCategoryPropertyRefs(categoryItem)
  if (!Object.keys(requiredByRef).length) return
  catPropsArr.forEach(p => {
    const required = requiredByRef[p.id] ?? requiredByRef[p.uuid]
    if (required !== undefined) p.isMandatory = required
  })
}

/**
 * Full JSON body for POST /o2m (create).
 */
export function buildO2mCreatePayload ({
  repoId,
  categoryId,
  contentLocationUri,
  fileName,
  formData = {},
  catPropsArr = [],
  idMap = {},
  datasetOptionsByDataSetId = {},
  displayValue = null,
  alterationText,
  sourceId = null
} = {}) {
  const properties = buildImportSourceProperties(formData, catPropsArr, idMap, datasetOptionsByDataSetId)
  const alterationResolved =
    alterationText != null && String(alterationText).trim() !== ''
      ? String(alterationText).trim()
      : 'User import'

  const body = {
    filename: fileName,
    sourceCategory: String(categoryId ?? ''),
    sourceId: sourceId || `/dms/r/${repoId}/source`,
    contentLocationUri,
    ...(displayValue ? { displayValue } : {}),
    alterationText: alterationResolved,
    ...(properties.length > 0 ? { sourceProperties: { properties } } : {})
  }

  return body
}

/**
 * Resolve URL after import. Template may include {docId} and {repoId} (already encoded placeholders optional).
 */
export function resolveAfterImportUrl (base, repoId, documentId, template) {
  const encDoc = encodeURIComponent(documentId)
  const encRepo = encodeURIComponent(repoId)
  if (template && typeof template === 'string') {
    const s = template
      .replace(/\{docId\}/g, documentId)
      .replace(/\{repoId\}/g, repoId)
    if (s.startsWith('http://') || s.startsWith('https://')) return s
    if (s.startsWith('/')) return base.replace(/\/$/, '') + s
    return s
  }
  return `${base}/dms/r/${encRepo}/o2/${encDoc}`
}
