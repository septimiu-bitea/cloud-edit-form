/**
 * ID mapping: numeric id ↔ UUID (from section 6).
 */

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
