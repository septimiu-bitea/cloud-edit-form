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
