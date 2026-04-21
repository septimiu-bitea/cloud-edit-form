/**
 * Node smoke tests for Pilot prompt helpers.
 * Run: node tests/pilotPrompts.test.js
 */
import assert from 'assert'
import {
  extractJsonObject,
  resolveCategoryIdFromPilot,
  pilotPropertiesToFormData,
  pilotApiV1Base,
  buildStep2PromptTemplate,
  fileToBase64Url,
  resolvePilotDocumentMimeType,
  isPilotDocumentMimeSupported,
  PILOT_FILE_ACCEPT,
  PILOT_ALLOWED_DOCUMENT_MIMES
} from '../src/services/pilotPrompts.js'

assert.strictEqual(pilotApiV1Base('https://t.example/'), 'https://t.example/d42/api/v1')

const j = extractJsonObject('```json\n{ "a": 1 }\n```')
assert.deepStrictEqual(j, { a: 1 })

const j2 = extractJsonObject('Here is data:\n{"categoryId":"x","displayValue":"y"}\nThanks')
assert.deepStrictEqual(j2, { categoryId: 'x', displayValue: 'y' })

const items = [{ value: 'cat-1', title: 'Invoice' }]
assert.strictEqual(resolveCategoryIdFromPilot({ categoryId: 'cat-1' }, items), 'cat-1')
assert.strictEqual(resolveCategoryIdFromPilot({ categoryId: 'missing' }, items), null)

const props = [
  { id: 'p1', dataType: 'STRING', isMultiValue: false, readOnly: false, name: { en: 'A' } }
]
const idMap = {}
const fd = pilotPropertiesToFormData({ properties: { p1: 'hello' } }, props, idMap)
assert.strictEqual(fd.p1, 'hello')

const s2 = buildStep2PromptTemplate({
  propertiesText: '- x',
  categoryId: 'cat-1',
  categoryTitle: 'Invoice',
  userChangedCategoryAfterPilot: true
})
assert.ok(s2.includes('cat-1'))
assert.ok(s2.includes('Invoice'))
assert.ok(s2.includes('changed the document type'))

const s2b = buildStep2PromptTemplate({
  propertiesText: '- y',
  categoryId: 'cat-2',
  categoryTitle: 'Receipt',
  userChangedCategoryAfterPilot: false
})
assert.ok(!s2b.includes('changed the document type'))

const b64 = await fileToBase64Url(new Blob([new Uint8Array([1, 2, 3])]))
assert.strictEqual(b64.length % 4, 0, 'standard Base64 must be multiple of 4 incl. padding')
assert.ok(/^[A-Za-z0-9+/]+=*$/.test(b64), 'standard Base64 chars + optional padding')

assert.strictEqual(
  resolvePilotDocumentMimeType({ type: 'application/pdf', name: 'a.bin' }),
  'application/pdf'
)
assert.strictEqual(isPilotDocumentMimeSupported('application/pdf'), true)
assert.strictEqual(
  isPilotDocumentMimeSupported('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  false
)

assert.ok(PILOT_FILE_ACCEPT.includes('application/pdf'))
assert.ok(PILOT_FILE_ACCEPT.includes('.pdf'))
for (const m of PILOT_ALLOWED_DOCUMENT_MIMES) {
  assert.ok(PILOT_FILE_ACCEPT.includes(m), `PILOT_FILE_ACCEPT must include ${m}`)
}

console.log('pilotPrompts.test.js: all passed')
