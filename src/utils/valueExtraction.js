/**
 * Value extraction and indexing (from section 7). Uses valueCoercion and idMapping.
 */
import { coerceValueForType } from './valueCoercion'
import { getNumericIdFromUuid } from './idMapping'
import { log, dbgTable } from './debug'

export function buildSrmValueIndex (srmItem, { extraAliases = {} } = {}) {
  const idx = Object.create(null)
  log('buildSrmValueIndex: srmItem present?', !!srmItem)
  if (!srmItem) return idx

  const put = (k, v) => {
    const key = String(k ?? '').trim()
    if (!key) return
    if (v == null) return
    idx[key] = v
  }

  const sp = Array.isArray(srmItem.sourceProperties) ? srmItem.sourceProperties : []
  log('buildSrmValueIndex: sourceProperties length', sp.length)
  for (const p of sp) put(p?.key, p?.displayValue ?? p?.value ?? '')

  const dp = Array.isArray(srmItem.displayProperties) ? srmItem.displayProperties : []
  log('buildSrmValueIndex: displayProperties length', dp.length)
  for (const p of dp) put(p?.id, p?.displayValue ?? p?.value ?? '')

  if (srmItem.id) put('DOCUMENT_ID', srmItem.id)

  const catObj = srmItem.category
  const catFromObj = (catObj && (catObj.id || catObj.categoryId || catObj.uuid || catObj.uniqueId || catObj.key)) || ''
  const catFromArray =
    Array.isArray(srmItem.sourceCategories) && srmItem.sourceCategories[0]
      ? (srmItem.sourceCategories[0].id || srmItem.sourceCategories[0].categoryId || srmItem.sourceCategories[0].uuid || srmItem.sourceCategories[0].uniqueId || srmItem.sourceCategories[0].key)
      : ''
  const catResolved =
    typeof catObj === 'string' || typeof catObj === 'number'
      ? String(catObj)
      : catFromObj || catFromArray || ''
  if (catResolved) put('CATEGORY', catResolved)

  if (srmItem.sortProperty?.id && srmItem.sortProperty?.value) {
    put(srmItem.sortProperty.id, srmItem.sortProperty.value)
  }

  const sysAliases = {
    property_filename: 'FILE_NAME',
    property_filetype: 'FILE_EXTENSION',
    property_filesize: 'FILE_SIZE',
    property_state: 'STATUS',
    property_editor: 'EDITOR',
    property_owner: 'OWNER',
    property_document_id: 'DOCUMENT_ID',
    property_category: 'CATEGORY'
  }
  for (const [legacyKey, sysKey] of Object.entries(sysAliases)) {
    if (idx[legacyKey] != null && idx[sysKey] == null) put(sysKey, idx[legacyKey])
  }
  for (const [legacyKey, sysKey] of Object.entries(extraAliases || {})) {
    if (idx[legacyKey] != null && idx[sysKey] == null) put(sysKey, idx[legacyKey])
  }

  dbgTable('SRM value index', idx)
  return idx
}

export function buildO2ValueIndex (o2json, idMap = {}) {
  const idx = Object.create(null)
  if (!o2json) return idx

  const sys = Array.isArray(o2json.systemProperties) ? o2json.systemProperties : []
  sys.forEach(p => {
    const k = String(p?.id || '').trim()
    if (k) idx[k] = p?.displayValue ?? p?.value ?? ''
  })

  const obj = Array.isArray(o2json.objectProperties) ? o2json.objectProperties : []
  obj.forEach(p => {
    const id = String(p?.id ?? '').trim()
    const uuid = String(p?.uuid ?? '').trim()
    const val = p?.value ?? p?.displayValue ?? ''
    if (id) idx[id] = val
    if (uuid) idx[uuid] = val
    if (id && idMap[id]) idx[idMap[id]] = val
  })

  const mv = Array.isArray(o2json.multivalueProperties) ? o2json.multivalueProperties : []
  mv.forEach(p => {
    const id = String(p?.id ?? '').trim()
    const uuid = String(p?.uuid ?? '').trim()
    const valuesObj = p?.values || {}
    const arr = Object.keys(valuesObj)
      .sort((a, b) => Number(a) - Number(b))
      .map(k => valuesObj[k])
      .filter(v => v != null && String(v).trim() !== '')
    if (id) idx[id] = arr
    if (uuid) idx[uuid] = arr
    if (id && idMap[id]) idx[idMap[id]] = arr
  })

  if (o2json.id) idx.DOCUMENT_ID = o2json.id
  return idx
}

export function buildInitialValuesFromIndex (catProps = [], { o2Index = null, srmItem = null, idMap = {} } = {}) {
  const srmIdx = buildSrmValueIndex(srmItem)

  const getBy = (index, key) => {
    if (!index) return undefined
    let v = index[key]
    if (v == null && idMap && typeof idMap === 'object') {
      const numericId = Object.entries(idMap).find(([num, u]) => u === key)?.[0]
      if (numericId) v = index[numericId] ?? index['property_' + numericId]
    }
    if (v == null && key === 'DOCUMENT_ID') v = index.property_document_id ?? index.DOCUMENT_ID
    if (v == null && key === 'CATEGORY') v = index.property_category ?? index.CATEGORY
    if (v == null) v = index['property_' + key]
    return v
  }

  const out = {}
  for (const prop of catProps || []) {
    const rawId = String(prop?.id ?? '')
    if (!rawId) continue
    const uuid = idMap && idMap[rawId] ? idMap[rawId] : rawId
    const isMulti = !!prop?.isMultiValue
    const dataType = String(prop?.dataType || 'STRING').toUpperCase()
    const coerce = (v) => coerceValueForType(v, dataType)

    let val = isMulti
      ? (getBy(o2Index, uuid) ?? getBy(srmIdx, uuid))
      : (getBy(srmIdx, uuid) ?? getBy(o2Index, uuid))

    if (isMulti) {
      if (Array.isArray(val)) {
        out[uuid] = val.map(coerce)
      } else if (val == null || val === '') {
        out[uuid] = []
      } else {
        const str = String(val)
        const arr = /[;,]/.test(str) ? str.split(/[;,]/).map(s => s.trim()).filter(Boolean) : [str]
        out[uuid] = arr.map(coerce)
      }
    } else {
      if (val != null) out[uuid] = coerce(val)
    }
  }
  return out
}

export function extractValuesForUuidFromO2 (o2Json, uuid, idMap, { isMulti, dataType }) {
  if (!o2Json || !uuid) return []
  const numericId = getNumericIdFromUuid(idMap, uuid)
  const wantIds = new Set([uuid, numericId && String(numericId)].filter(Boolean))
  const coerce = (v) => coerceValueForType(v, dataType)

  const mvp = Array.isArray(o2Json.multivalueProperties) ? o2Json.multivalueProperties : []
  const hitMv = mvp.find(p => wantIds.has(String(p.uuid || p.id)))
  if (hitMv?.values && typeof hitMv.values === 'object') {
    const ordered = Object.entries(hitMv.values)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, val]) => coerce(val))
    return isMulti ? ordered : (ordered.length ? [ordered[0]] : [])
  }

  const op = Array.isArray(o2Json.objectProperties) ? o2Json.objectProperties : []
  const hitOp = op.find(p => wantIds.has(String(p.uuid || p.id)))
  if (hitOp) {
    const val = coerce(hitOp.value)
    return isMulti ? (val == null || val === '' ? [] : [val]) : (val == null ? [] : [val])
  }

  const sp = Array.isArray(o2Json.systemProperties) ? o2Json.systemProperties : []
  const hitSp = sp.find(p => wantIds.has(String(p.id)))
  if (hitSp) {
    const val = coerce(hitSp.value)
    return isMulti ? (val == null || val === '' ? [] : [val]) : (val == null ? [] : [val])
  }
  return []
}

export function extractValuesForUuidFromSrm (srmItem, uuid, idMap, { isMulti = false, dataType = 'STRING' } = {}) {
  const idx = buildSrmValueIndex(srmItem)
  let val = idx[uuid]
  if (val == null && idMap && typeof idMap === 'object') {
    const numericId = Object.entries(idMap).find(([num, u]) => u === uuid)?.[0]
    if (numericId) val = idx[numericId]
  }
  if (val == null && uuid === 'DOCUMENT_ID') val = idx.property_document_id ?? idx.DOCUMENT_ID
  if (val == null && uuid === 'CATEGORY') val = idx.property_category ?? idx.CATEGORY

  const toArray = (v) => {
    if (Array.isArray(v)) return v
    if (v == null || v === '') return []
    if (typeof v === 'string' && /[,;|]/.test(v)) return v.split(/[;,|]/).map(s => s.trim()).filter(Boolean)
    return [v]
  }
  const coerce = (v) => coerceValueForType(v, String(dataType).toUpperCase())
  if (isMulti) return toArray(val).map(coerce)
  return val == null ? [] : [coerce(val)]
}
