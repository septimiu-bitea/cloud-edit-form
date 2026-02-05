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

const VALIDATION_SEP_RE = /[;,|]/

/**
 * Build validation payload for POST /o2/{documentId}/update/validate.
 * form: { submission: { data }, _o2mPrev }; o2Response/srmItem can be passed separately.
 */
export function buildValidationPayload ({
  base,
  repoId,
  documentId,
  objectDefinitionId,
  categoryId,
  form,
  metaIdx,
  catPropsArr,
  idMap,
  o2Response,
  srmItem,
  displayValue,
  filename
} = {}) {
  const numericCatId = objectDefinitionId || getNumericIdFromUuid(idMap, categoryId) || categoryId

  const systemProperties = {}
  if (srmItem) {
    const srmIdx = buildSrmValueIndex(srmItem)
    const sysProps = ['property_document_number', 'property_variant_number', 'property_colorcode']
    sysProps.forEach(key => {
      const val = srmIdx[key]
      if (val != null) systemProperties[key] = val
    })
  }

  const formData = (form?.submission?.data) ? form.submission.data : {}
  const extendedProperties = {}
  const multivalueExtendedProperties = {}
  const prevMap = form?._o2mPrev || {}

  const norm = (v, dt) => (coerceValueForType(v, dt) == null ? '' : String(coerceValueForType(v, dt))).trim()
  const normalizeMulti = (raw, dt) => {
    let arr
    if (Array.isArray(raw)) arr = raw.slice()
    else if (raw == null || raw === '') arr = []
    else if (typeof raw === 'string' && VALIDATION_SEP_RE.test(raw)) arr = raw.split(VALIDATION_SEP_RE).map(s => s.trim())
    else arr = [raw]
    return arr.map(v => norm(v, dt)).filter(v => v !== '')
  }

  const propsToProcess = catPropsArr?.length
    ? catPropsArr
    : Array.from(metaIdx?.entries() ?? []).map(([uuid, meta]) => ({
        id: uuid,
        isMultiValue: meta.isMulti,
        dataType: meta.dataType,
        readOnly: meta.readOnly
      }))

  for (const prop of propsToProcess) {
    const propId = String(prop?.id ?? '')
    if (!propId) continue
    // Form data is keyed by UUID: CategoryFormView uses resolveUuid(prop.id) = idMap[prop.id] || prop.id
    const formDataKey = (idMap && idMap[propId]) ? idMap[propId] : propId
    const meta = metaIdx?.get?.(formDataKey) || metaIdx?.get?.(propId) || {
      uuid: formDataKey,
      numericId: getNumericIdFromUuid(idMap, formDataKey) || getNumericIdFromUuid(idMap, propId),
      dataType: String(prop?.dataType || 'STRING').toUpperCase(),
      isMulti: !!prop?.isMultiValue,
      readOnly: !!prop?.isSystemProperty || !!prop?.readOnly
    }
    if (meta.readOnly) continue
    // numericId for API: from meta, or resolve UUID→numeric, or use propId when it is already numeric (on-premise)
    const numericId = meta.numericId || getNumericIdFromUuid(idMap, formDataKey) || getNumericIdFromUuid(idMap, propId) || (/^\d+$/.test(propId) ? propId : null)
    if (!numericId) continue
    const dt = meta.dataType
    const raw = formData[formDataKey] ?? formData[propId]

    if (meta.isMulti) {
      const curr = normalizeMulti(raw, dt)
      const prevVal = prevMap[formDataKey] ?? prevMap[propId]
      const prevArr = Array.isArray(prevVal)
        ? prevVal.map(v => norm(v, dt)).filter(v => v !== '')
        : []
      const valuesObj = {}
      const remaining = curr.slice()
      const slots = prevArr.map(prevVal => {
        const matchIdx = remaining.findIndex(c => c === prevVal)
        if (matchIdx !== -1) {
          const matched = remaining[matchIdx]
          remaining.splice(matchIdx, 1)
          return matched
        }
        return null
      })
      for (let i = 0; i < slots.length; i++) {
        if (slots[i] === null && remaining.length > 0) slots[i] = remaining.shift()
      }
      slots.forEach((val, idx) => {
        valuesObj[String(idx + 1)] = val != null ? val : ''
      })
      let slotIndex = slots.length + 1
      remaining.forEach(val => {
        valuesObj[String(slotIndex)] = val
        slotIndex++
      })
      // Only include non-empty values in the payload (exclude deleted slots)
      const filled = Object.keys(valuesObj)
        .sort((a, b) => Number(a) - Number(b))
        .map(k => valuesObj[k])
        .filter(v => v != null && String(v).trim() !== '')
      const filteredObj = {}
      filled.forEach((val, idx) => { filteredObj[String(idx + 1)] = val })
      multivalueExtendedProperties[numericId] = Object.keys(filteredObj).length > 0 ? filteredObj : { '1': '' }
    } else {
      const prevSingle = prevMap[formDataKey] ?? prevMap[propId]
      const currVal = raw != null ? norm(raw, dt) : (prevSingle != null ? norm(prevSingle, dt) : '')
      extendedProperties[numericId] = currVal
    }
  }

  let eTag = null
  let lockTokenUrl = null
  if (o2Response) {
    if (o2Response.storeObject) {
      eTag = o2Response.storeObject.eTag
      lockTokenUrl = o2Response.storeObject.lockTokenUrl
    }
    if (!lockTokenUrl && o2Response._links?.locktoken?.href) {
      lockTokenUrl = o2Response._links.locktoken.href
    }
  }

  const storeObject = {
    displayValue: displayValue || '',
    filename: filename || '',
    dmsObjectId: documentId,
    dmsobject: {
      href: repoId ? `/dms/r/${encodeURIComponent(repoId)}/o2/${encodeURIComponent(documentId)}` : '',
      id: documentId
    },
    doMapping: false,
    isInUpdateMode: true,
    doValidate: false,
    fileSelect: false,
    id: 0,
    _links: {},
    _embedded: {}
  }
  if (eTag) storeObject.eTag = eTag
  if (lockTokenUrl) storeObject.lockTokenUrl = lockTokenUrl

  return {
    type: 1,
    objectDefinitionId: String(numericCatId),
    systemProperties,
    remarks: {},
    multivalueExtendedProperties,
    extendedProperties,
    docNumber: documentId,
    id: documentId,
    storeObject
  }
}

/**
 * Extract UUID-keyed values from validation response (for updating form state).
 */
export function extractValuesFromValidationResponse (validationResponse, { idMap, catPropsArr, originalValues } = {}) {
  if (!validationResponse || typeof validationResponse !== 'object') return {}
  const values = {}
  const extendedProps = validationResponse.extendedProperties || {}
  const multivalueProps = validationResponse.multivalueExtendedProperties || {}
  const numericToUuid = {}
  if (idMap && typeof idMap === 'object') {
    for (const [numericId, uuid] of Object.entries(idMap)) {
      numericToUuid[numericId] = uuid
    }
  }
  if (catPropsArr?.length) {
    for (const prop of catPropsArr) {
      const uuid = String(prop?.id ?? '')
      const numericId = getNumericIdFromUuid(idMap, uuid)
      if (numericId && uuid) numericToUuid[String(numericId)] = uuid
    }
  }
  for (const [numericId, value] of Object.entries(extendedProps)) {
    const uuid = numericToUuid[numericId]
    if (uuid && multivalueProps?.[numericId]) continue
    let coercedValue = value
    if (catPropsArr?.length) {
      const prop = catPropsArr.find(p => String(p?.id) === uuid)
      if (prop) {
        const dataType = String(prop?.dataType || 'STRING').toUpperCase()
        coercedValue = coerceValueForType(value, dataType)
      }
    }
    if (uuid) values[uuid] = coercedValue
  }
  for (const [numericId, valuesObj] of Object.entries(multivalueProps)) {
    const uuid = numericToUuid[numericId]
    if (!uuid || !valuesObj || typeof valuesObj !== 'object') continue
    const arr = Object.keys(valuesObj)
      .sort((a, b) => Number(a) - Number(b))
      .map(key => (valuesObj[key] != null ? String(valuesObj[key]) : ''))
    if (catPropsArr?.length) {
      const prop = catPropsArr.find(p => String(p?.id) === uuid)
      if (prop) {
        const dataType = String(prop?.dataType || 'STRING').toUpperCase()
        values[uuid] = arr.map(v => (v === '' || v == null ? '' : coerceValueForType(v, dataType)))
      } else {
        values[uuid] = arr
      }
    } else {
      values[uuid] = arr
    }
  }
  return values
}

/**
 * Build sourceProperties for O2m payload from validation response.
 */
export function buildSourcePropertiesFromValidationResponse (validationResponse, { idMap, catPropsArr, metaIdx } = {}) {
  if (!validationResponse || typeof validationResponse !== 'object') return { properties: [] }
  const properties = []
  const extendedProps = validationResponse.extendedProperties || {}
  const multivalueProps = validationResponse.multivalueExtendedProperties || {}
  const numericToUuid = {}
  if (idMap && typeof idMap === 'object') {
    for (const [numericId, uuid] of Object.entries(idMap)) {
      numericToUuid[numericId] = uuid
    }
  }
  if (catPropsArr?.length) {
    for (const prop of catPropsArr) {
      const uuid = String(prop?.id ?? '')
      const numericId = getNumericIdFromUuid(idMap, uuid)
      if (numericId && uuid) numericToUuid[String(numericId)] = uuid
    }
  }
  for (const [numericId, value] of Object.entries(extendedProps)) {
    const uuid = numericToUuid[numericId]
    if (!uuid || multivalueProps[numericId]) continue
    const coercedValue = value != null ? String(value) : ''
    if (coercedValue !== '' || (metaIdx?.get?.(uuid) && !metaIdx.get(uuid).readOnly)) {
      properties.push({ key: uuid, values: [coercedValue] })
    }
  }
  for (const [numericId, valuesObj] of Object.entries(multivalueProps)) {
    const uuid = numericToUuid[numericId]
    if (!uuid || !valuesObj || typeof valuesObj !== 'object') continue
    const arr = Object.keys(valuesObj)
      .sort((a, b) => Number(a) - Number(b))
      .map(key => (valuesObj[key] != null ? String(valuesObj[key]) : ''))
    if (arr.length === 0) continue
    properties.push({ key: uuid, values: arr })
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
