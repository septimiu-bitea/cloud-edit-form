/**
 * d.velop DMS API client (cloud + on-premise). On-premise uses storedoctype for categories/properties/datasets.
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
 * Create API instance for a given base, locale, optional apiKey and onPremise (e.g. from __formInitContext).
 */
export function createApi ({ base, locale = 'en', apiKey, onPremise = false } = {}) {
  const j = createJ(apiKey)
  const lang = locale || 'en'

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
      headers: { Accept: 'application/json, text/plain, */*', 'Accept-Language': lang }
    })
    return r.json
  }

  // ----- On-premise: storedoctype-based categories/properties/datasets -----
  let _storedoctypeCache = null
  let _storedoctypeCacheKey = null
  const getStoredoctypeCache = async (baseUrl, repoId) => {
    const cacheKey = `${baseUrl}|${repoId}`
    if (_storedoctypeCache && _storedoctypeCacheKey === cacheKey) return _storedoctypeCache
    _storedoctypeCache = await storedoctype(baseUrl, repoId)
    _storedoctypeCacheKey = cacheKey
    return _storedoctypeCache
  }
  const primaryLocale = () => (typeof window !== 'undefined' && (window.DV_LANG || window.UI_LOCALE)) || lang || 'en'
  const shortLocale = (loc) => (!loc ? '' : loc.includes('-') ? loc.split('-')[0] : loc)
  const normalizeNameField = (nameValue, fallbackLabel = '') => {
    if (nameValue && typeof nameValue === 'object' && !Array.isArray(nameValue)) return nameValue
    const label = String(nameValue || fallbackLabel || '').trim()
    if (!label) return {}
    const loc = primaryLocale()
    const short = shortLocale(loc)
    const map = { [loc]: label }
    if (short && short !== loc) map[short] = label
    if (!map.en) map.en = label
    return map
  }
  const normalizeDataTypeValue = (dataType) => {
    if (dataType == null && dataType !== 0) return 'STRING'
    if (typeof dataType === 'string') {
      const u = dataType.toUpperCase()
      if (['STRING', 'NUMBER', 'DECIMAL', 'INTEGER', 'DATE', 'DATETIME', 'BOOLEAN', 'KEYVALUE'].includes(u)) return u
      return 'STRING'
    }
    const num = Number(dataType)
    if (Number.isNaN(num)) return 'STRING'
    const map = { 0: 'STRING', 1: 'NUMBER', 2: 'DECIMAL', 3: 'DATETIME', 4: 'DATE', 5: 'KEYVALUE', 6: 'STRING', 7: 'STRING', 8: 'STRING' }
    return map[num] || 'STRING'
  }
  const absoluteUrl = (baseUrl, href) => { try { return new URL(href, baseUrl).toString() } catch { return href } }
  const buildValidValuesRequestBody = (objectDefinitionId) => ({
    type: 1, objectDefinitionId, systemProperties: {}, remarks: {}, multivalueExtendedProperties: {}, extendedProperties: {},
    dossierId: null, storeObject: { masterFileName: null, filename: null, parentId: null, dmsObjectId: null, displayValue: null }
  })
  const fetchValidValuesAsDatasetRows = async (url, { objectDefinitionId } = {}) => {
    if (!objectDefinitionId) return []
    try {
      const res = await j(url, {
        method: 'POST',
        headers: { Accept: 'application/json, application/hal+json;q=0.9', 'Content-Type': 'application/json' },
        body: JSON.stringify(buildValidValuesRequestBody(objectDefinitionId))
      })
      if (!res.ok) return []
      const items = Array.isArray(res.json?.values) ? res.json.values : []
      const loc = primaryLocale()
      const short = shortLocale(loc)
      return items.map(entry => {
        const raw = String(entry?.value ?? entry?.label ?? '').trim()
        if (!raw) return null
        const lbl = String(entry?.label ?? raw).trim()
        const row = { 'x-original': raw }; row[loc] = lbl
        if (short && short !== loc) row[short] = lbl
        if (!row.en) row.en = lbl
        return row
      }).filter(Boolean)
    } catch { return [] }
  }
  const categoriesFromStoredoctype = async (baseUrl, repoId) => {
    const data = await getStoredoctypeCache(baseUrl, repoId)
    const arr = (data?.storageDocumentTypes || []).map(dt => ({
      id: dt.id, name: dt.displayName, displayName: dt.displayName, type: 'DOCUMENT_TYPE',
      kind: dt.kind, group: dt.group, isRecentlyUsed: dt.isRecentlyUsed, canEditExtendedProperties: dt.canEditExtendedProperties
    }))
    return { raw: data, arr }
  }
  const catPropsFromStoredoctype = async (baseUrl, repoId, catId) => {
    if (!catId) return { raw: {}, arr: [] }
    const data = await getStoredoctypeCache(baseUrl, repoId)
    const catIdStr = String(catId).trim()
    const docType = (data?.storageDocumentTypes || []).find(dt =>
      dt.id === catIdStr || dt.id?.toLowerCase() === catIdStr.toLowerCase() || dt.displayName?.toLowerCase() === catIdStr.toLowerCase()
    )
    if (!docType) return { raw: {}, arr: [] }
    const arr = (docType.extendedProperties || []).map(prop => {
      const label = prop.displayName || ''
      const dataType = normalizeDataTypeValue(prop.dataType)
      const multi = !!(prop.isMultiValue ?? prop.isMultivalue)
      const hasValueList = !!prop.hasValueList
      const dataSetId = prop.dataSetId || (hasValueList ? prop.id : '')
      return {
        id: prop.id, name: normalizeNameField(prop.name, label || prop.id), displayName: label || prop.id,
        isMandatory: prop.isMandatory, hasValueList, isDynamicValueList: !!prop.isDynamicValueList,
        isMultivalue: multi, isMultiValue: multi, isVisible: prop.isVisible ?? true, dataType,
        isModifiable: prop.isModifiable, readOnly: prop.readOnly ?? prop.isModifiable === false, dataSetId, isSystemProperty: false, _links: prop._links || {}
      }
    })
    return { raw: docType, arr }
  }
  const allPropsFromStoredoctype = async (baseUrl, repoId) => {
    const data = await getStoredoctypeCache(baseUrl, repoId)
    const allProps = []
    ;(data?.systemProperties || []).forEach(prop => {
      const label = prop.displayName || prop.id
      const dataType = normalizeDataTypeValue(prop.dataType)
      const hasValueList = !!prop.hasValueList
      const dataSetId = prop.dataSetId || (hasValueList ? prop.id : '')
      allProps.push({
        id: prop.id, name: normalizeNameField(prop.name, label), displayName: label, hasValueList, dataType, maxLength: prop.maxLength,
        isSystemProperty: true, isMultivalue: !!(prop.isMultivalue ?? prop.isMultiValue), isMultiValue: !!(prop.isMultiValue ?? prop.isMultivalue), readOnly: true, dataSetId, _links: prop._links || {}
      })
    })
    const propMap = new Map()
    ;(data?.storageDocumentTypes || []).forEach(dt => {
      (dt.extendedProperties || []).forEach(prop => {
        if (!propMap.has(prop.id)) {
          const label = prop.displayName || prop.id
          const dataType = normalizeDataTypeValue(prop.dataType)
          const multi = !!(prop.isMultiValue ?? prop.isMultivalue)
          const hasValueList = !!prop.hasValueList
          const dataSetId = prop.dataSetId || (hasValueList ? prop.id : '')
          propMap.set(prop.id, {
            id: prop.id, name: normalizeNameField(prop.name, label), displayName: label, isMandatory: prop.isMandatory, hasValueList,
            isDynamicValueList: !!prop.isDynamicValueList, isMultivalue: multi, isMultiValue: multi, isVisible: prop.isVisible ?? true, dataType,
            isModifiable: prop.isModifiable, readOnly: prop.readOnly ?? prop.isModifiable === false, dataSetId, isSystemProperty: false, _links: prop._links || {}
          })
        }
      })
    })
    allProps.push(...Array.from(propMap.values()))
    return { raw: data, arr: allProps }
  }
  const datasetsFromStoredoctype = async (baseUrl, repoId) => {
    const data = await getStoredoctypeCache(baseUrl, repoId)
    const datasetMap = new Map()
    const ensureEntry = (prop, docTypeId = null) => {
      if (!prop?.hasValueList) return
      const dsId = prop.dataSetId || prop.id
      if (!dsId) return
      if (!datasetMap.has(dsId)) {
        datasetMap.set(dsId, {
          id: dsId, name: prop.displayName || dsId, displayName: prop.displayName || dsId, hasValueList: true, isDynamicValueList: !!prop.isDynamicValueList,
          values: null, _links: {}, sourcePropertyIds: new Set(), _fetchPromise: null, defaultObjectDefinitionId: docTypeId
        })
      }
      const entry = datasetMap.get(dsId)
      entry.sourcePropertyIds.add(prop.id)
      entry._links = { ...(entry._links || {}), ...(prop._links || {}) }
      if (!entry.valuesHref && prop?._links?.postgetvalidvalues?.href) entry.valuesHref = absoluteUrl(baseUrl, prop._links.postgetvalidvalues.href)
      if (!entry.resolveValues) {
        entry.resolveValues = async function ({ objectDefinitionId } = {}) {
          if (this.values && this.values.length) return this.values
          if (this._fetchPromise) return this._fetchPromise
          const objDef = objectDefinitionId || this.defaultObjectDefinitionId
          if (!this.valuesHref || !objDef) return []
          this._fetchPromise = fetchValidValuesAsDatasetRows(this.valuesHref, { objectDefinitionId: objDef }).then(rows => { this.values = rows; return rows }).finally(() => { this._fetchPromise = null })
          return this._fetchPromise
        }
      }
    }
    ;(data?.systemProperties || []).forEach(prop => ensureEntry(prop, null))
    ;(data?.storageDocumentTypes || []).forEach(dt => (dt.extendedProperties || []).forEach(prop => ensureEntry(prop, dt?.id || null)))
    const arr = Array.from(datasetMap.values()).map(entry => ({
      id: entry.id, name: entry.name, displayName: entry.displayName, hasValueList: entry.hasValueList, isDynamicValueList: entry.isDynamicValueList,
      values: entry.values, valuesHref: entry.valuesHref, _links: entry._links, sourcePropertyIds: Array.from(entry.sourcePropertyIds || []), resolveValues: entry.resolveValues
    }))
    return { raw: data, arr }
  }

  if (onPremise) {
    return {
      j, setTxt: () => {}, objdefs, srm, o2, validateUpdate, storedoctype,
      categories: categoriesFromStoredoctype,
      catProps: catPropsFromStoredoctype,
      allProps: allPropsFromStoredoctype,
      datasets: datasetsFromStoredoctype
    }
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
