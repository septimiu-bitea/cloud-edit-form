/**
 * Submission helpers (from section 12). Pure functions only – no state.
 * Components pass formData, prevMap, metaIdx; this module returns payloads or performs fetch.
 */
import { getNumericIdFromUuid } from '@/utils/idMapping'
import { multivalueToValues } from '@/utils/multivalueParsing'
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
 * Build multivalue slot maps from O2 response: { [uuid]: { "1": "v1", "2": "v2", "6": "v3" }, ... }.
 * Used to preserve exact (possibly non-consecutive) slot keys when sending validation payload.
 */
export function getMultivalueSlotMaps (o2json, catPropsArr = [], idMap = {}) {
  const out = {}
  const resolve = (id) => (id && idMap[id]) ? idMap[id] : id

  const mv = Array.isArray(o2json?.multivalueProperties) ? o2json.multivalueProperties : []
  mv.forEach(p => {
    const id = String(p?.id ?? '').trim()
    const uuid = p?.uuid || resolve(id) || id
    const valuesObj = p?.values
    if (!uuid || !valuesObj || typeof valuesObj !== 'object' || Array.isArray(valuesObj)) return
    out[uuid] = { ...valuesObj }
  })

  const mvep = o2json?.multivalueExtendedProperties
  if (mvep && typeof mvep === 'object' && !Array.isArray(mvep)) {
    for (const [id, valuesObj] of Object.entries(mvep)) {
      const k = String(id ?? '').trim()
      if (!k || !valuesObj || typeof valuesObj !== 'object' || Array.isArray(valuesObj)) continue
      const uuid = resolve(k)
      if (!(uuid in out)) out[uuid] = { ...valuesObj }
    }
  }
  return out
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
        if (Array.isArray(raw)) arr = multivalueToValues(raw)
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
  displayValue = displayValue ?? o2Response?.storeObject?.displayValue ?? o2Response?.displayValue ?? ''
  filename = filename ?? o2Response?.storeObject?.filename ?? o2Response?.filename ?? ''

  const numericCatId = objectDefinitionId || getNumericIdFromUuid(idMap, categoryId) || categoryId

  const systemProperties = {}
  if (srmItem) {
    const srmIdx = buildSrmValueIndex(srmItem)
    const sysProps = ['property_document_number', 'property_variant_number', 'property_editor', 'property_colorcode']
    sysProps.forEach(key => {
      const val = srmIdx[key]
      if (val != null) systemProperties[key] = val
    })
  }

  const formData = (form?.submission?.data) ? form.submission.data : {}
  const extendedProperties = {}
  const multivalueExtendedProperties = {}
  const prevMap = form?._o2mPrev || {}
  const prevSlotMaps = form?._o2mPrevSlotMap || {}

  const norm = (v, dt) => (coerceValueForType(v, dt) == null ? '' : String(coerceValueForType(v, dt))).trim()
  const normalizeMulti = (raw, dt) => {
    let arr
    if (Array.isArray(raw)) arr = multivalueToValues(raw)
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
      const prevSlotMap = prevSlotMaps[formDataKey] ?? prevSlotMaps[propId]
      let prevSlotKeys
      let prevArr
      if (prevSlotMap && typeof prevSlotMap === 'object' && !Array.isArray(prevSlotMap)) {
        prevSlotKeys = Object.keys(prevSlotMap)
          .filter(k => /^\d+$/.test(String(k)))
          .sort((a, b) => Number(a) - Number(b))
        prevArr = prevSlotKeys.map(k => (prevSlotMap[k] != null ? String(prevSlotMap[k]).trim() : ''))
      }
      if (!prevSlotKeys || prevSlotKeys.length === 0) {
        const prevVal = prevMap[formDataKey] ?? prevMap[propId]
        const prevVals = Array.isArray(prevVal) ? multivalueToValues(prevVal) : []
        prevArr = prevVals.map(v => norm(v, dt)).filter(v => v !== '')
        prevSlotKeys = prevArr.map((_, idx) => String(idx + 1))
      }
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
      prevSlotKeys.forEach((slotKey, idx) => {
        valuesObj[slotKey] = slots[idx] != null ? slots[idx] : ''
      })
      let nextSlot = prevSlotKeys.length
        ? Math.max(...prevSlotKeys.map(k => Number(k)), 0) + 1
        : 1
      remaining.forEach(val => {
        valuesObj[String(nextSlot)] = val
        nextSlot++
      })
      if (Object.keys(valuesObj).length === 0) valuesObj['1'] = ''
      multivalueExtendedProperties[numericId] = valuesObj
    } else {
      const prevSingle = prevMap[formDataKey] ?? prevMap[propId]
      const currVal = raw != null ? norm(raw, dt) : (prevSingle != null ? norm(prevSingle, dt) : '')
      extendedProperties[numericId] = currVal
    }
  }

  let eTag = null
  let lockTokenUrl = null
  if (o2Response) {
    const storeObj = o2Response.storeObject ?? o2Response._embedded?.storeObject
    if (storeObj) {
      eTag = storeObj.eTag ?? storeObj.etag ?? null
      lockTokenUrl = storeObj.lockTokenUrl ?? storeObj.lockToken ?? null
    }
    if (!eTag && (o2Response.eTag ?? o2Response.etag)) eTag = o2Response.eTag ?? o2Response.etag
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

  const payload = {}
  payload.type = 1
  payload.objectDefinitionId = String(numericCatId)
  payload.systemProperties = systemProperties
  payload.remarks = {}
  payload.multivalueExtendedProperties = multivalueExtendedProperties
  payload.extendedProperties = extendedProperties
  payload.docNumber = documentId
  payload.id = documentId
  payload.storeObject = storeObject
  return payload
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
    let coercedArr
    if (catPropsArr?.length) {
      const prop = catPropsArr.find(p => String(p?.id) === uuid)
      if (prop) {
        const dataType = String(prop?.dataType || 'STRING').toUpperCase()
        coercedArr = arr.map(v => (v === '' || v == null ? '' : coerceValueForType(v, dataType)))
      } else {
        coercedArr = arr
      }
    } else {
      coercedArr = arr
    }
    values[uuid] = coercedArr.map((v, i) => ({ key: `mv-${uuid}-${i}`, value: v }))
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

/** systemProperties keys to include in update payload (match should payload). */
const UPDATE_SYSTEM_PROPERTY_KEYS = ['property_document_number', 'property_variant_number', 'property_editor', 'property_colorcode']

/**
 * Ensure payload values match expected types for PUT /o2/{documentId}.
 * Should payload: type number, systemProperties (4 keys only), extendedProperties/multivalue values strings, storeObject.id number 0.
 */
function normalizeUpdatePayloadTypes (validationResponse, storeObject, { metaIdx, idMap } = {}) {
  const mvep = validationResponse.multivalueExtendedProperties || {}
  const rawSys = validationResponse.systemProperties || {}
  const systemProperties = {}
  for (const k of UPDATE_SYSTEM_PROPERTY_KEYS) {
    let v = rawSys[k]
    if (k === 'property_colorcode' && v === undefined && validationResponse.colorCode != null) {
      v = validationResponse.colorCode
    }
    systemProperties[k] = v == null ? '' : String(v)
  }

  const extendedProperties = {}
  const ext = validationResponse.extendedProperties || {}
  for (const [numericId, v] of Object.entries(ext)) {
    let str = ''
    if (v != null && v !== '') {
      if (metaIdx && idMap) {
        const uuid = idMap[numericId]
        const meta = uuid ? metaIdx.get(uuid) : metaIdx.get(numericId)
        const dt = meta?.dataType || 'STRING'
        str = String(coerceValueForType(v, dt) ?? '')
      } else {
        str = String(v)
      }
    }
    if (str === '' && mvep[numericId] && typeof mvep[numericId] === 'object' && !Array.isArray(mvep[numericId])) {
      const slotMap = mvep[numericId]
      const slots = Object.keys(slotMap).filter(k => /^\d+$/.test(String(k))).sort((a, b) => Number(a) - Number(b))
      const first = slots.map(s => slotMap[s]).find(val => val != null && String(val).trim() !== '')
      str = first != null ? String(first).trim() : ''
    }
    extendedProperties[numericId] = str
  }
  for (const numericId of Object.keys(mvep)) {
    if (extendedProperties[numericId] !== undefined) continue
    const slotMap = mvep[numericId]
    if (!slotMap || typeof slotMap !== 'object' || Array.isArray(slotMap)) continue
    const slots = Object.keys(slotMap).filter(k => /^\d+$/.test(String(k))).sort((a, b) => Number(a) - Number(b))
    const first = slots.map(s => slotMap[s]).find(val => val != null && String(val).trim() !== '')
    extendedProperties[numericId] = first != null ? String(first).trim() : ''
  }

  const multivalueExtendedProperties = {}
  for (const [numericId, slotMap] of Object.entries(mvep)) {
    if (!slotMap || typeof slotMap !== 'object' || Array.isArray(slotMap)) {
      multivalueExtendedProperties[numericId] = {}
      continue
    }
    const out = {}
    for (const [slot, val] of Object.entries(slotMap)) {
      out[slot] = val == null ? '' : String(val)
    }
    multivalueExtendedProperties[numericId] = out
  }

  const remarks = {}
  for (const [k, v] of Object.entries(validationResponse.remarks ?? {})) {
    remarks[k] = v == null ? '' : String(v)
  }

  const so = storeObject && typeof storeObject === 'object' ? { ...storeObject } : {}
  // Server requires eTag on update; prefer validation response storeObject (eTag/lockTokenUrl) when present
  const respStore = validationResponse?.storeObject ?? validationResponse?._embedded?.storeObject
  if (respStore) {
    if (respStore.eTag != null) so.eTag = respStore.eTag
    if (respStore.etag != null) so.eTag = so.eTag ?? respStore.etag
    if (respStore.lockTokenUrl != null) so.lockTokenUrl = respStore.lockTokenUrl
    if (respStore.lockToken != null) so.lockTokenUrl = so.lockTokenUrl ?? respStore.lockToken
  }
  if ((so.eTag == null || so.eTag === '') && (validationResponse?.eTag ?? validationResponse?.etag) != null) {
    so.eTag = validationResponse.eTag ?? validationResponse.etag
  }
  if (!('id' in so) || typeof so.id !== 'number') so.id = 0
  if (!('doMapping' in so)) so.doMapping = false
  if (!('isInUpdateMode' in so)) so.isInUpdateMode = true
  if (!('doValidate' in so)) so.doValidate = false
  if (!('fileSelect' in so)) so.fileSelect = false
  if (!so._links) so._links = {}
  if (!so._embedded) so._embedded = {}

  const payload = {}
  payload.type = 1
  payload.objectDefinitionId = validationResponse.objectDefinitionId
  payload.systemProperties = systemProperties
  payload.remarks = remarks
  payload.multivalueExtendedProperties = multivalueExtendedProperties
  payload.extendedProperties = extendedProperties
  payload.docNumber = validationResponse.docNumber != null ? String(validationResponse.docNumber) : ''
  payload.id = validationResponse.id
  payload.storeObject = so
  payload.state = null
  return payload
}

/**
 * Build update payload (5) from validate response (4).
 * Used for PUT /dms/r/{repoId}/o2/{documentId} with full document body.
 * Merges validation response with type, storeObject (from validate request), and state.
 * Optional metaIdx + idMap coerce extendedProperties by dataType before stringifying.
 */
export function buildUpdatePayloadFromValidationResponse (validationResponse, { storeObject, metaIdx, idMap } = {}) {
  if (!validationResponse || typeof validationResponse !== 'object') return null
  return normalizeUpdatePayloadTypes(validationResponse, storeObject, { metaIdx, idMap })
}

/**
 * Build O2m update payload body (optional keys only when provided).
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
 * Build payload for PUT /dms/r/{repoId}/o2m/{dmsObjectId} from validation response.
 * Official API: filename, alterationText, sourceCategory, sourceId, contentLocationUri, sourceProperties.
 * Default source (when using sourceProperties): sourceId = "/dms/r/{repositoryId}/source" per API docs.
 * @see https://help.d-velop.de/dev/documentation/dms-app#tag/dmsobjects/put/r/{repositoryId}/o2m/{dmsObjectId}
 */
export function buildO2mPayloadFromValidationResponse (validationResponse, {
  filename,
  alterationText,
  sourceCategory,
  sourceId,
  contentLocationUri,
  repoId
} = {}) {
  if (!validationResponse || typeof validationResponse !== 'object') return null
  const ext = validationResponse.extendedProperties || {}
  const mvep = validationResponse.multivalueExtendedProperties || {}
  const properties = []
  const seen = new Set()
  for (const [numericId, v] of Object.entries(ext)) {
    if (seen.has(numericId)) continue
    seen.add(numericId)
    const val = v != null && v !== '' ? String(v) : ''
    properties.push({ key: numericId, values: [val] })
  }
  for (const [numericId, slotMap] of Object.entries(mvep)) {
    if (!slotMap || typeof slotMap !== 'object' || Array.isArray(slotMap)) continue
    const slots = Object.keys(slotMap)
      .filter(k => /^\d+$/.test(String(k)))
      .sort((a, b) => Number(a) - Number(b))
    const values = slots.map(s => (slotMap[s] != null ? String(slotMap[s]) : ''))
    if (seen.has(numericId)) {
      const idx = properties.findIndex(p => p.key === numericId)
      if (idx !== -1) properties[idx].values = values
    } else {
      seen.add(numericId)
      properties.push({ key: numericId, values })
    }
  }
  const payload = {
    ...(filename != null && filename !== '' ? { filename } : {}),
    ...(alterationText != null && alterationText !== '' ? { alterationText } : {}),
    ...(sourceCategory != null && sourceCategory !== '' ? { sourceCategory: String(sourceCategory) } : {}),
    ...(sourceId != null && sourceId !== '' ? { sourceId } : {}),
    ...(contentLocationUri != null && contentLocationUri !== '' ? { contentLocationUri } : {})
  }
  if (properties.length > 0) {
    payload.sourceProperties = { properties }
    // API: "The sourceId of the default source system is always /dms/r/{repositoryId}/source"
    if (!payload.sourceCategory && !payload.sourceId && repoId) {
      payload.sourceId = `/dms/r/${encodeURIComponent(repoId)}/source`
    }
  }
  return payload
}

/**
 * Build multipart/form-data body with a single part "data" containing the JSON payload.
 * Matches production: multipart/form-data; boundary=----geckoformboundary...
 */
function buildMultipartFormDataBody (payload) {
  const boundary = '----geckoformboundary' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  const json = JSON.stringify(payload)
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="data"',
    '',
    json,
    `--${boundary}--`
  ].join('\r\n')
  return { body, contentType: `multipart/form-data; boundary=${boundary}` }
}

/**
 * PUT /dms/r/{repoId}/o2/{documentId} – full document update. Returns { ok, status, json, text }.
 * Body is multipart/form-data with one part "data" containing the full document payload (built from validate response + storeObject).
 */
export async function putO2Update ({ base, repoId, documentId, payload, apiKey }) {
  const url = `${base}/dms/r/${encodeURIComponent(repoId)}/o2/${encodeURIComponent(documentId)}`
  const { body, contentType } = buildMultipartFormDataBody(payload)
  const headers = { 'Content-Type': contentType, Accept: 'application/json, text/plain, */*' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const res = await fetch(url, {
    method: 'PUT',
    credentials: apiKey ? 'omit' : 'include',
    headers,
    body
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { }
  return { ok: res.ok, status: res.status, json, text }
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
