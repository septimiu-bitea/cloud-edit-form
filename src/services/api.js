/**
 * d.velop DMS API client (from section 5, cloud path). No Form.io; setTxt is a no-op.
 */
import { REPO_ID } from '@/config'

function createJ (apiKey) {
  const j = async (u, o = {}) => {
    const d = {
      credentials: apiKey ? 'omit' : 'include',
      headers: {
        Accept: 'application/hal+json, application/json;q=0.9, */*;q=0.1',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      }
    }
    const r = await fetch(u, { ...d, ...o, headers: { ...(d.headers || {}), ...(o.headers || {}) } })
    const t = (await r.text()).trim()
    const clean = t.startsWith(")]}',") ? t.slice(5) : t
    let json = {}
    try { json = clean ? JSON.parse(clean) : {} } catch { }
    return { ok: r.ok, status: r.status, url: u, headers: r.headers, text: clean, json }
  }
  return j
}

/**
 * Create API instance for a given base, locale and optional apiKey (e.g. from __formInitContext or VITE_* env).
 */
export function createApi ({ base, locale = 'en', apiKey } = {}) {
  const j = createJ(apiKey)

  const catProps = async (baseUrl, repoId, catId) => {
    const idRaw = catId != null && typeof catId === 'object'
      ? (catId.id ?? catId.categoryId ?? catId.uuid ?? catId.uniqueId ?? catId.key ?? '')
      : (catId ?? '')
    const idStr = (typeof idRaw === 'string' ? idRaw : String(idRaw)).trim()
    if (!idStr) return { raw: {}, arr: [] }
    const r = await j(
      `${baseUrl}/dmsconfig/r/${encodeURIComponent(repoId)}/objectmanagement/categories/${encodeURIComponent(idStr)}/properties`,
      { headers: { Accept: 'application/json', 'Accept-Language': locale || 'en' } }
    )
    const arr = Array.isArray(r.json?._embedded?.properties) ? r.json._embedded.properties
      : (Array.isArray(r.json) ? r.json : (r.json?.properties || r.json?.items || []))
    return { raw: r.json, arr: Array.isArray(arr) ? arr : [] }
  }

  const allProps = async (baseUrl, repoId) => {
    const r = await j(
      `${baseUrl}/dmsconfig/r/${encodeURIComponent(repoId)}/objectmanagement/properties`,
      { headers: { Accept: 'application/json', 'Accept-Language': locale || 'en' } }
    )
    const arr = Array.isArray(r.json?._embedded?.properties) ? r.json._embedded.properties
      : (r.json?.properties || r.json?.items || [])
    return { raw: r.json, arr: Array.isArray(arr) ? arr : [] }
  }

  const datasets = async (baseUrl, repoId) => {
    const r = await j(
      `${baseUrl}/dmsconfig/r/${encodeURIComponent(repoId)}/objectmanagement/datasets`,
      { headers: { Accept: 'application/json', 'Accept-Language': locale || 'en' } }
    )
    const arr = Array.isArray(r.json?._embedded?.datasets) ? r.json._embedded.datasets
      : (r.json?.datasets || r.json?.items || [])
    return { raw: r.json, arr: Array.isArray(arr) ? arr : [] }
  }

  const objdefs = async (baseUrl, repoId) => {
    const r = await j(
      `${baseUrl}/dms/r/${encodeURIComponent(repoId)}/objdef`,
      { headers: { Accept: 'application/hal+json, application/json' } }
    )
    return { raw: r.json }
  }

  const categories = async (baseUrl, repoId) => {
    const r = await j(
      `${baseUrl}/dmsconfig/r/${encodeURIComponent(repoId)}/objectmanagement/categories`,
      { headers: { Accept: 'application/json', 'Accept-Language': locale || 'en' } }
    )
    const arr = Array.isArray(r.json?._embedded?.categories) ? r.json._embedded.categories : []
    return { raw: r.json, arr }
  }

  const srm = async (baseUrl, repoId, documentId) => {
    const props = JSON.stringify({ property_document_id: [documentId] })
    const url = `${baseUrl}/dms/r/${encodeURIComponent(repoId)}/sr/?` +
      new URLSearchParams({ properties: props, page: '1', pagesize: '50', ascending: 'false' }).toString()
    const r = await j(url, {
      headers: { Accept: 'application/json', 'Accept-Language': locale || 'en' }
    })
    return r.json
  }

  const o2 = async (baseUrl, repoId, documentId) => {
    const url = `${baseUrl}/dms/r/${encodeURIComponent(repoId)}/o2/${encodeURIComponent(documentId)}`
    const r = await j(url, { headers: { Accept: 'application/hal+json, application/json;q=0.9' } })
    return r.json
  }

  const validateUpdate = async (baseUrl, repoId, documentId, payload) => {
    const url = `${baseUrl}/dms/r/${encodeURIComponent(repoId)}/o2/${encodeURIComponent(documentId)}/update/validate`
    const r = await j(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Accept: 'application/json, text/plain, */*' },
      body: JSON.stringify(payload)
    })
    return { ok: r.ok, status: r.status, json: r.json, text: r.text }
  }

  const storedoctype = async (baseUrl, repoId) => {
    const url = `${baseUrl}/dms/r/${encodeURIComponent(repoId)}/storedoctype`
    const r = await j(url, {
      headers: { Accept: 'application/json, text/plain, */*', 'Accept-Language': locale || 'en' }
    })
    return r.json
  }

  const Dv = {
    j,
    setTxt: () => {}, // no-op (no Form.io)
    catProps,
    allProps,
    datasets,
    objdefs,
    categories,
    srm,
    o2,
    validateUpdate,
    storedoctype
  }

  return Dv
}

let _repoIdCache = null

/**
 * Resolve repository ID: REPO_ID config, or from URL path /dms/r/{repoId}/ or query dmsRepoId.
 */
export function usedRepoId (base = typeof window !== 'undefined' ? window.location.origin : '') {
  if (_repoIdCache) return _repoIdCache
  if (REPO_ID) {
    _repoIdCache = REPO_ID
    return _repoIdCache
  }
  if (typeof window !== 'undefined') {
    const urlPath = new URL(window.location.href)
    const dmsRMatch = urlPath.pathname.match(/\/dms\/r\/([^/?#]+)/i)
    if (dmsRMatch?.[1]) {
      const extractedId = decodeURIComponent(dmsRMatch[1]).trim()
      if (extractedId) _repoIdCache = extractedId
    } else {
      _repoIdCache = urlPath.searchParams.get('dmsRepoId') || null
    }
  }
  return _repoIdCache
}
