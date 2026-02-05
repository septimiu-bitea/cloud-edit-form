/**
 * Value extraction and indexing (from section 7). Uses valueCoercion and idMapping.
 */
import { coerceValueForType } from './valueCoercion.js'
import { getNumericIdFromUuid } from './idMapping.js'
import { log, dbgTable } from './debug.js'

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

  // Handle systemProperties: array (cloud) or object (on-premise)
  if (Array.isArray(o2json.systemProperties)) {
    o2json.systemProperties.forEach(p => {
      const k = String(p?.id || '').trim()
      if (k) idx[k] = p?.displayValue ?? p?.value ?? ''
    })
  } else if (o2json.systemProperties && typeof o2json.systemProperties === 'object') {
    // On-premise: systemProperties is an object like { "property_document_number": "MW00000001" }
    for (const [k, v] of Object.entries(o2json.systemProperties)) {
      if (k && v != null && v !== '') idx[k] = v
    }
  }

  const obj = Array.isArray(o2json.objectProperties) ? o2json.objectProperties : []
  obj.forEach(p => {
    const id = String(p?.id ?? '').trim()
    const uuid = String(p?.uuid ?? '').trim()
    const val = p?.value ?? p?.displayValue ?? ''
    if (id) idx[id] = val
    if (uuid) idx[uuid] = val
    if (id && idMap[id]) idx[idMap[id]] = val
  })

  // Cloud: multivalueProperties array: [{ id, uuid, values: { "1": "val1", "2": "val2" } }]
  const mv = Array.isArray(o2json.multivalueProperties) ? o2json.multivalueProperties : []
  if (mv.length > 0) {
    log(`[buildO2ValueIndex] Processing ${mv.length} multivalueProperties`)
  }
  mv.forEach((p, i) => {
    const id = String(p?.id ?? '').trim()
    const uuid = String(p?.uuid ?? '').trim()
    const valuesObj = p?.values || {}
    
    // Convert values object to array: { "1": "val1", "2": "val2" } -> ["val1", "val2"]
    const arr = Object.keys(valuesObj)
      .sort((a, b) => Number(a) - Number(b))
      .map(k => valuesObj[k])
      .filter(v => v != null && String(v).trim() !== '')
    
    if (i < 3 || id === '159') {
      log(`[buildO2ValueIndex] multivalueProperty[${i}]: id=${id}, uuid=${uuid || 'none'}, valuesObj keys:`, Object.keys(valuesObj), '-> arr:', arr)
      log(`[buildO2ValueIndex]   idMap[${id}]=`, idMap[id] || 'not found')
    }
    
    // Index by id, uuid, and mapped UUID
    if (id) idx[id] = arr
    if (uuid) idx[uuid] = arr
    if (id && idMap[id]) {
      idx[idMap[id]] = arr
      if (i < 3 || id === '159') {
        log(`[buildO2ValueIndex]   ✓ Indexed by UUID ${idMap[id]}:`, arr)
      }
    } else if (i < 3 || id === '159') {
      log(`[buildO2ValueIndex]   ⚠️ No UUID mapping for id ${id}`)
    }
  })

  // On-premise: multivalueExtendedProperties object: { "159": { "1": "val1", "2": "val2" } }
  const mvep = o2json.multivalueExtendedProperties
  if (mvep && typeof mvep === 'object' && !Array.isArray(mvep)) {
    for (const [id, valuesObj] of Object.entries(mvep)) {
      const k = String(id ?? '').trim()
      if (!k || !valuesObj || typeof valuesObj !== 'object' || Array.isArray(valuesObj)) continue
      
      // Convert slot map to array: { "1": "val1", "2": "val2" } -> ["val1", "val2"]
      const arr = Object.keys(valuesObj)
        .sort((a, b) => Number(a) - Number(b))
        .map(slot => valuesObj[slot])
        .filter(v => v != null && String(v).trim() !== '')
      
      idx[k] = arr
      idx['property_' + k] = arr
      if (idMap[k]) idx[idMap[k]] = arr
    }
  }

  // On-premise: extendedProperties object keyed by numeric id (single values only)
  const ext = o2json.extendedProperties
  if (ext && typeof ext === 'object' && !Array.isArray(ext)) {
    for (const [id, val] of Object.entries(ext)) {
      const k = String(id ?? '').trim()
      if (!k || val == null || val === '') continue
      // Skip if it's an object (should be in multivalueExtendedProperties)
      if (typeof val === 'object' && !Array.isArray(val)) continue
      idx[k] = val
      idx['property_' + k] = val
      if (idMap[k]) idx[idMap[k]] = val
    }
  }

  if (o2json.id) idx.DOCUMENT_ID = o2json.id
  return idx
}

/**
 * Build initial form values from O2 response. Single normalized path for cloud and on-premise.
 * @param {Object} o2Response - O2 API response (shape differs by onPremise)
 * @param {Object} opts - { idMap, categoryProperties, onPremise }
 * @returns {{ initialValues: Object, multivalueUuids: Set }}
 */
export function buildInitialValuesFromO2 (o2Response, { idMap = {}, categoryProperties = [], onPremise = false } = {}) {
  const initialValues = Object.create(null)
  const multivalueUuids = new Set()
  for (const prop of categoryProperties || []) {
    if (prop?.isMultiValue) {
      const pid = prop.id != null ? String(prop.id) : ''
      const uuid = (pid && idMap[pid]) || pid || (idMap[prop.id] != null ? idMap[prop.id] : null)
      if (uuid) multivalueUuids.add(String(uuid))
    }
  }

  const slotMapToArray = (valuesObj) =>
    Object.keys(valuesObj)
      .sort((a, b) => Number(a) - Number(b))
      .map(k => valuesObj[k])
      .filter(v => v != null && String(v).trim() !== '')

  /** True if object looks like a slot map { "1": "v1", "2": "v2" } (numeric string keys). */
  const isSlotMap = (v) =>
    v != null && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).every(k => /^\d+$/.test(String(k)))

  const toMultivalueArray = (valuesObj) => {
    if (Array.isArray(valuesObj)) {
      return valuesObj.filter(v => v != null && String(v).trim() !== '').map(v => String(v).trim())
    }
    if (valuesObj && typeof valuesObj === 'object' && isSlotMap(valuesObj)) {
      return slotMapToArray(valuesObj)
    }
    return []
  }

  const resolveKey = (id) => {
    const s = id != null ? String(id) : ''
    return (s && idMap[s]) || (s && idMap[id]) || s || null
  }

  if (onPremise) {
    // On-premise: some APIs return multivalueProperties (array, same as cloud), others multivalueExtendedProperties (object)
    const mvArr = Array.isArray(o2Response?.multivalueProperties) ? o2Response.multivalueProperties : []
    mvArr.forEach(p => {
      const id = String(p?.id ?? '').trim()
      const key = p?.uuid || resolveKey(id) || id
      if (!key) return
      const arr = toMultivalueArray(p?.values || p)
      if (arr.length > 0 || multivalueUuids.has(key)) initialValues[key] = arr
    })
    const mvep = o2Response?.multivalueExtendedProperties
    if (mvep && typeof mvep === 'object' && !Array.isArray(mvep)) {
      for (const [id, valuesObj] of Object.entries(mvep)) {
        const key = resolveKey(id)
        if (!key) continue
        if (key in initialValues) continue
        const arr = toMultivalueArray(valuesObj)
        if (arr.length > 0 || multivalueUuids.has(key)) initialValues[key] = arr
      }
    }
    const ext = o2Response?.extendedProperties
    if (ext && typeof ext === 'object' && !Array.isArray(ext)) {
      for (const [id, val] of Object.entries(ext)) {
        const key = resolveKey(id)
        if (!key) continue
        if (multivalueUuids.has(key)) {
          // Known multivalue prop: value might be slot map or array (if not in multivalueExtendedProperties)
          if (!(key in initialValues)) {
            const arr = toMultivalueArray(val)
            initialValues[key] = arr
          }
        } else if (val != null && val !== '' && typeof val !== 'object') {
          initialValues[key] = val
        } else if (val != null && typeof val === 'object' && !Array.isArray(val) && isSlotMap(val)) {
          // Slot map in extendedProperties (some on-premise APIs put multivalue here)
          initialValues[key] = slotMapToArray(val)
        }
      }
    }
    const sys = o2Response?.systemProperties
    if (sys && typeof sys === 'object' && !Array.isArray(sys)) {
      for (const [k, v] of Object.entries(sys)) {
        const key = resolveKey(k) || k
        if (key && v != null && v !== '' && !multivalueUuids.has(key) && !(key in initialValues)) initialValues[key] = v
      }
    }
    // Ensure every known multivalue prop has an entry (so the field renders even when empty)
    for (const uuid of multivalueUuids) {
      if (!(uuid in initialValues)) initialValues[uuid] = []
    }
  } else {
    const mv = Array.isArray(o2Response?.multivalueProperties) ? o2Response.multivalueProperties : []
    mv.forEach(p => {
      const id = String(p?.id ?? '').trim()
      const uuid = p?.uuid || (idMap[id] || id)
      const valuesObj = p?.values || {}
      const arr = slotMapToArray(valuesObj)
      if (uuid) initialValues[uuid] = arr
    })
    const obj = Array.isArray(o2Response?.objectProperties) ? o2Response.objectProperties : []
    obj.forEach(p => {
      const uuid = p?.uuid || (idMap[p?.id] || p?.id)
      const val = p?.value ?? p?.displayValue ?? ''
      if (uuid && !multivalueUuids.has(uuid) && val != null && val !== '') initialValues[uuid] = val
    })
    const sys = Array.isArray(o2Response?.systemProperties) ? o2Response.systemProperties : []
    sys.forEach(p => {
      const k = String(p?.id || '').trim()
      const val = p?.displayValue ?? p?.value ?? ''
      if (k && val != null && val !== '' && !multivalueUuids.has(k)) initialValues[k] = val
    })
  }

  return { initialValues, multivalueUuids }
}

/**
 * Build a value index from the host's data.dmsProperties (e.g. from form submission).
 * Used when the backend sends property values keyed by numeric id and property_* names.
 * Mirrors the extendedProperties handling in buildO2ValueIndex for on-premise compatibility.
 * Keys in index: id, property_<id>, and idMap[id] (uuid) when idMap is provided.
 */
export function buildIndexFromDmsProperties (dmsProperties = {}, idMap = {}) {
  const idx = Object.create(null)
  if (dmsProperties == null || typeof dmsProperties !== 'object' || Array.isArray(dmsProperties)) {
    return idx
  }
  
  for (const [k, v] of Object.entries(dmsProperties)) {
    const key = String(k ?? '').trim()
    if (!key) continue
    
    // Handle slot maps: { "1": "val1", "2": "val2" } -> ["val1", "val2"]
    const isSlotMap = v != null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(slotKey => /^\d+$/.test(slotKey))
    let value = v
    if (isSlotMap) {
      value = Object.keys(v)
        .sort((a, b) => Number(a) - Number(b))
        .map(slot => v[slot])
        .filter(x => x != null && String(x).trim() !== '')
    } else if (Array.isArray(value)) {
      value = value.filter(x => x != null && String(x).trim() !== '')
    } else if (value == null || value === '') {
      value = null
    }
    
    if (value == null && !Array.isArray(v) && !isSlotMap) continue
    
    idx[key] = value
    idx['property_' + key] = value
    if (idMap && typeof idMap === 'object' && idMap[key]) {
      idx[idMap[key]] = value
    }
  }
  
  return idx
}

export function buildInitialValuesFromIndex (catProps = [], { o2Index = null, srmItem = null, idMap = {}, dmsIndex = null } = {}) {
  const srmIdx = buildSrmValueIndex(srmItem)
  let debugCount = 0

  const getBy = (index, key) => {
    if (!index) return undefined
    let v = index[key]
    // If direct lookup failed and we have an idMap, try reverse lookup (UUID -> numeric ID)
    if (v == null && idMap && typeof idMap === 'object') {
      const numericId = Object.entries(idMap).find(([num, u]) => u === key)?.[0]
      if (numericId) {
        v = index[numericId] ?? index['property_' + numericId]
        if (v != null && index === dmsIndex && debugCount < 3) {
          log(`[getBy] Found via reverse lookup: UUID ${key} -> numericId ${numericId}, value:`, v)
          debugCount++
        }
      }
    }
    // Also try if key itself looks like a numeric ID (for dmsProperties indexed by numeric IDs)
    // This handles cases where prop.id is a numeric ID string
    if (v == null && /^\d+$/.test(String(key))) {
      v = index[key] ?? index['property_' + key]
      if (v != null && index === dmsIndex && debugCount < 3) {
        log(`[getBy] Found via numeric ID lookup: ${key}, value:`, v)
        debugCount++
      }
    }
    if (v == null && key === 'DOCUMENT_ID') v = index.property_document_id ?? index.DOCUMENT_ID
    if (v == null && key === 'CATEGORY') v = index.property_category ?? index.CATEGORY
    // On-premise: index may be keyed by numeric id or property_<id>
    // Try property_ prefix fallback (works for both UUIDs and numeric IDs)
    if (v == null && !String(key).startsWith('property_')) {
      v = index['property_' + key]
    }
    if (v == null && index === dmsIndex && debugCount < 3) {
      log(`[getBy] No value found for key ${key} in dmsIndex. Available keys sample:`, Object.keys(index).slice(0, 10))
      debugCount++
    }
    return v
  }

  const out = {}
  let propDebugCount = 0
  for (const prop of catProps || []) {
    const rawId = String(prop?.id ?? '')
    if (!rawId) continue
    const uuid = idMap && idMap[rawId] ? idMap[rawId] : rawId
    const isMulti = !!prop?.isMultiValue
    const dataType = String(prop?.dataType || 'STRING').toUpperCase()
    const coerce = (v) => coerceValueForType(v, dataType)

    // Debug first few properties
    const shouldDebug = propDebugCount < 5
    if (shouldDebug) {
      log(`[buildInitialValues] Property ${propDebugCount}: rawId=${rawId}, uuid=${uuid}, isMulti=${isMulti}`)
    }

    // Prefer host data (dmsProperties) when present, then O2, then SRM
    let val = isMulti
      ? (getBy(dmsIndex, uuid) ?? getBy(o2Index, uuid) ?? getBy(srmIdx, uuid))
      : (getBy(dmsIndex, uuid) ?? getBy(srmIdx, uuid) ?? getBy(o2Index, uuid))
    
    if (shouldDebug || (isMulti && !val)) {
      const dmsVal = dmsIndex ? getBy(dmsIndex, uuid) : null
      const o2Val = o2Index ? getBy(o2Index, uuid) : null
      const srmVal = srmIdx ? getBy(srmIdx, uuid) : null
      const o2ValByNumeric = o2Index ? getBy(o2Index, rawId) : null
      
      if (val != null) {
        const source = dmsVal != null ? 'dmsIndex' : (o2Val != null ? 'o2Index' : 'srmIdx')
        log(`[buildInitialValues] Found value for ${uuid} from ${source}:`, val, isMulti ? '(multivalue)' : '(single)')
      } else if (isMulti) {
        log(`[buildInitialValues] ⚠️ No value found for multivalue property ${uuid} (rawId=${rawId})`)
        log(`[buildInitialValues]   dmsIndex[${uuid}]:`, dmsVal)
        log(`[buildInitialValues]   o2Index[${uuid}]:`, o2Val)
        log(`[buildInitialValues]   o2Index[${rawId}]:`, o2ValByNumeric)
        log(`[buildInitialValues]   srmIdx[${uuid}]:`, srmVal)
        log(`[buildInitialValues]   o2Index keys sample:`, Object.keys(o2Index || {}).slice(0, 20))
        log(`[buildInitialValues]   o2Index has ${uuid}?:`, o2Index ? (uuid in o2Index) : false)
        log(`[buildInitialValues]   o2Index has ${rawId}?:`, o2Index ? (rawId in o2Index) : false)
      }
    }
    
    propDebugCount++

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

  // On-premise: extendedProperties object keyed by id
  const ext = o2Json.extendedProperties
  if (ext && typeof ext === 'object' && !Array.isArray(ext)) {
    for (const id of wantIds) {
      const val = ext[id] ?? ext['property_' + id]
      if (val == null) continue
      if (Array.isArray(val)) return isMulti ? val.map(coerce) : (val.length ? [coerce(val[0])] : [])
      const isSlotMap = typeof val === 'object' && Object.keys(val).every(key => /^\d+$/.test(key))
      if (isSlotMap) {
        const arr = Object.keys(val).sort((a, b) => Number(a) - Number(b)).map(slot => coerce(val[slot]))
        return isMulti ? arr : (arr.length ? [arr[0]] : [])
      }
      return isMulti ? [coerce(val)] : [coerce(val)]
    }
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
