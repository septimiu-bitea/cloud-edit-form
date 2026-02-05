/**
 * Known d.velop system property identifiers (Document ID, Status, file extension,
 * category, file name, owner, etc.). Used to separate system properties from
 * category/object properties in the UI.
 */
const SYSTEM_PROPERTY_IDS = new Set([
  'property_document_id',
  'DOCUMENT_ID',
  'property_filename',
  'FILE_NAME',
  'property_filetype',
  'FILE_EXTENSION',
  'property_filesize',
  'FILE_SIZE',
  'property_state',
  'STATUS',
  'property_editor',
  'EDITOR',
  'property_owner',
  'OWNER',
  'property_category',
  'CATEGORY',
  'property_document_number',
  'property_variant_number',
  'property_colorcode'
])

/**
 * Returns true if the given property is a system property (Document ID, Status,
 * file extension, category, file name, owner, etc.).
 * @param {Object} prop - Property object from category API (has id, possibly isSystemProperty)
 */
export function isSystemProperty (prop) {
  if (!prop) return false
  if (prop.isSystemProperty === true) return true
  const id = String(prop.id ?? prop.uuid ?? '').trim()
  return id ? SYSTEM_PROPERTY_IDS.has(id) : false
}

/**
 * Filter an array of properties to only category/object properties (exclude system).
 */
export function categoryOnlyProperties (properties) {
  return Array.isArray(properties) ? properties.filter(p => !isSystemProperty(p)) : []
}

/**
 * Build a map propertyId -> required from category.propertyRefs (non-system only).
 * Cloud: single-category API returns propertyRefs with "required". On-premise: category has no propertyRefs; use extendedProperties.isMandatory from catProps.
 * @param {Object} category - Raw category response (cloud: GET .../categories/{id}; on-premise: docType from storedoctype, no propertyRefs)
 * @returns {Object} Map of property id (string) -> boolean (required)
 */
export function buildRequiredFromCategoryPropertyRefs (category) {
  const refs = category?.propertyRefs
  if (!Array.isArray(refs)) return {}
  const map = {}
  for (const ref of refs) {
    const id = ref?.id ?? ref?.propertyId ?? ref?.uuid ?? ''
    if (!id) continue
    if (ref.isSystemProperty === true) continue
    const sysId = String(id).trim()
    if (sysId && SYSTEM_PROPERTY_IDS.has(sysId)) continue
    map[id] = !!ref.required
    if (typeof ref.uuid === 'string' && ref.uuid !== id) map[ref.uuid] = !!ref.required
  }
  return map
}
