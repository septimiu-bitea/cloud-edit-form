/**
 * ID mapping: numeric id ↔ UUID (from section 6).
 * idMap shape: { numericId: uuid } e.g. { "100": "e51d2f7c-...", "101": "7c4874df-..." }
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isNumericIdKey (k) {
  return typeof k === 'string' && /^\d+$/.test(k.trim())
}

function looksLikeIdToUuidMap (obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  const entries = Object.entries(obj)
  if (entries.length === 0) return false
  return entries.every(([k, v]) => isNumericIdKey(k) && typeof v === 'string' && UUID_RE.test(String(v).trim()))
}

/**
 * Get simpleId -> uuid map from SRM response (same shape on cloud and on-prem).
 * SRM uses srm.propertyIdToUUID.
 */
export function idToUniqueIdFromSrm (srmResponse) {
  const map = srmResponse?.propertyIdToUUID ?? srmResponse?.items?.[0]?.propertyIdToUUID
  if (looksLikeIdToUuidMap(map)) return { idToUniqueId: map }
  return null
}

export function mapIdtoUniqueId (objdefsRaw, { onDuplicate = 'last' } = {}) {
  const map = {}
  const defs = Array.isArray(objdefsRaw?.objectDefinitions) ? objdefsRaw.objectDefinitions : []

  const setPair = (idVal, uuidVal) => {
    const id = String(idVal ?? '').trim()
    const uuid = String(uuidVal ?? '').trim()
    if (!id) return
    if (id in map) {
      if (onDuplicate === 'first') return
      if (onDuplicate === 'error' && map[id] !== uuid) {
        throw new Error(`Duplicate id "${id}" with conflicting uniqueId: "${map[id]}" vs "${uuid}"`)
      }
    }
    map[id] = uuid
  }

  for (const def of defs) {
    setPair(def?.id, def?.uniqueId ?? def?.uuid)
    const propFields = Array.isArray(def?.propertyFields) ? def.propertyFields : []
    for (const pf of propFields) {
      setPair(pf?.id, pf?.uniqueId ?? pf?.uuid)
    }
  }

  return { idToUniqueId: map }
}

export function getNumericIdFromUuid (idMap = {}, uuid) {
  for (const [num, u] of Object.entries(idMap || {})) {
    if (u === uuid) return num
  }
  return null
}
