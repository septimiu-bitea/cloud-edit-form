/**
 * Field building helpers (from section 9). Map category properties to labels and Vuetify-friendly field type.
 */

/**
 * Localized label from name object (en, de-DE, etc.).
 */
export function labelFromName (nameObj = {}, locale = 'en') {
  if (!nameObj || typeof nameObj !== 'object') return ''
  const langs = [locale, (locale || '').split('-')[0], 'en', 'de-DE', 'de'].filter(Boolean)
  for (const l of langs) if (nameObj[l]) return nameObj[l]
  const first = Object.values(nameObj)[0]
  return typeof first === 'string' ? first : ''
}

/**
 * Field meta for a category property (uuid, label, dataType, isMulti, readOnly, etc.).
 */
export function toFieldMeta (p, { locale = 'en' } = {}) {
  const uuid = String(p?.id || '')
  const label = labelFromName(p?.name, locale) || uuid
  const dataType = String(p?.dataType || 'STRING').toUpperCase()
  const isSystem = !!p?.isSystemProperty
  const isMulti = !!p?.isMultiValue
  const readOnly = isSystem ? true : !!p?.readOnly
  const dataSetId = p?.dataSetId || ''
  const hasValueList = !!p?.hasValueList
  const isRequired = !!p?.isMandatory
  return { uuid, label, dataType, isSystem, isMulti, readOnly, dataSetId, hasValueList, isRequired }
}

/**
 * Vuetify component type from dataType + isMulti. One of: 'text', 'number', 'date', 'datetime', 'checkbox', 'select', 'multitext'.
 */
export function fieldTypeForDataType (dataType, { isMulti = false } = {}) {
  const dt = String(dataType).toUpperCase()
  if (isMulti) return dt === 'BOOLEAN' ? 'checkbox' : 'multitext'
  switch (dt) {
    case 'DATE': return 'date'
    case 'DATETIME': return 'datetime'
    case 'NUMBER':
    case 'DECIMAL':
    case 'INTEGER': return 'number'
    case 'BOOLEAN': return 'checkbox'
    default: return 'text'
  }
}
