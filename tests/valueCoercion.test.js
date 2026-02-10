// ============================================================================
// VALUE COERCION TEST (system property date/datetime → ISO)
// ============================================================================
// Run with: node tests/valueCoercion.test.js

import { toISODateTimeIfPossible } from '../src/utils/valueCoercion.js'

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`)
  }
}

// Already ISO: leave as-is
assertEqual(
  toISODateTimeIfPossible('2026-02-06T15:13:42.000+01:00'),
  '2026-02-06T15:13:42.000+01:00',
  'ISO with offset unchanged'
)

// Locale DD.MM.YYYY HH:mm:ss → ISO
assertEqual(
  toISODateTimeIfPossible('04.11.2021 11:19:29'),
  '2021-11-04T11:19:29',
  'locale datetime converted'
)
assertEqual(
  toISODateTimeIfPossible('09.02.2026 08:16:44'),
  '2026-02-09T08:16:44',
  'locale datetime with space'
)

// Non-date strings: unchanged
assertEqual(toISODateTimeIfPossible('212,54 KB'), '212,54 KB', 'size unchanged')
assertEqual(toISODateTimeIfPossible('Freigabe'), 'Freigabe', 'state unchanged')
assertEqual(toISODateTimeIfPossible('T000000825'), 'T000000825', 'document number unchanged')
assertEqual(toISODateTimeIfPossible(''), '', 'empty unchanged')
assertEqual(toISODateTimeIfPossible(null), null, 'null unchanged')

// Example system properties object: all date-like values converted, rest unchanged
const example = {
  property_last_modified_date: '2026-02-06T15:13:42.000+01:00',
  property_last_alteration_date: '04.11.2021 11:19:29',
  property_editor: '',
  property_creation_date: '04.11.2021 11:19:29',
  property_access_date: '09.02.2026 08:16:44',
  property_size: '212,54 KB',
  property_state: 'Freigabe',
  property_document_number: 'T000000825'
}
const coerced = Object.fromEntries(
  Object.entries(example).map(([k, v]) => [k, toISODateTimeIfPossible(v)])
)
assertEqual(coerced.property_last_modified_date, '2026-02-06T15:13:42.000+01:00', 'already ISO')
assertEqual(coerced.property_last_alteration_date, '2021-11-04T11:19:29', 'alteration date')
assertEqual(coerced.property_creation_date, '2021-11-04T11:19:29', 'creation date')
assertEqual(coerced.property_access_date, '2026-02-09T08:16:44', 'access date')
assertEqual(coerced.property_size, '212,54 KB', 'size')
assertEqual(coerced.property_state, 'Freigabe', 'state')
assertEqual(coerced.property_document_number, 'T000000825', 'doc number')
assertEqual(coerced.property_editor, '', 'empty')

console.log('✅ valueCoercion (toISODateTimeIfPossible): all checks passed')
