/**
 * Node smoke tests for document import helpers.
 * Run: node tests/documentImport.test.js
 */
import assert from 'assert'
import {
  buildImportSourceProperties,
  buildO2mCreatePayload,
  resolveAfterImportUrl,
  makeUniqueMasterName,
  sanitizeImportFormDatasetValues,
  extractDocumentIdFromO2mResponse
} from '../src/services/documentImport.js'

const catProps = [
  { id: 'uuid-a', dataType: 'STRING', isMultiValue: false, isSystemProperty: false, readOnly: false },
  { id: '100', dataType: 'STRING', isMultiValue: true, isSystemProperty: false, readOnly: false }
]
const idMap = { 100: 'uuid-mv' }

let props = buildImportSourceProperties({ 'uuid-a': 'hello' }, catProps, {})
assert.strictEqual(props.length, 1)
assert.strictEqual(props[0].key, 'uuid-a')
assert.deepStrictEqual(props[0].values, ['hello'])

props = buildImportSourceProperties({ 'uuid-mv': [{ value: 'a' }, { value: 'b' }] }, catProps, idMap)
assert.strictEqual(props.length, 1)
assert.strictEqual(props[0].key, 'uuid-mv')
assert.deepStrictEqual(props[0].values, ['a', 'b'])

const body = buildO2mCreatePayload({
  repoId: 'r1',
  categoryId: 'cat-1',
  contentLocationUri: '/dms/r/r1/blob/chunk/x',
  fileName: 'f.pdf',
  formData: { 'uuid-a': 'x' },
  catPropsArr: catProps,
  idMap: {}
})
assert.strictEqual(body.sourceCategory, 'cat-1')
assert.strictEqual(body.contentLocationUri, '/dms/r/r1/blob/chunk/x')
assert.strictEqual(body.alterationText, 'User import')
assert.ok(body.sourceProperties?.properties?.length === 1)

const url = resolveAfterImportUrl('https://t.example', 'repo', 'DOC1', null)
assert.ok(url.includes('/o2/DOC1'))

const u = resolveAfterImportUrl('https://t.example', 'repo', 'DOC1', 'https://other/{docId}')
assert.strictEqual(u, 'https://other/DOC1')

const m = makeUniqueMasterName('invoice.pdf')
assert.ok(m.includes('.pdf'))
assert.ok(/^\w+_\d{6}_/.test(m))

// Value list (cloud): label → stored key via datasetOptionsByDataSetId
const catVl = [
  {
    id: 'uuid-vl',
    dataType: 'STRING',
    isMultiValue: false,
    isSystemProperty: false,
    readOnly: false,
    hasValueList: true,
    dataSetId: 'ds-1'
  }
]
const dsMap = { 'ds-1': [{ label: 'Company', value: 'KEY001' }] }
props = buildImportSourceProperties({ 'uuid-vl': 'Company' }, catVl, {}, dsMap)
assert.strictEqual(props.length, 1)
assert.deepStrictEqual(props[0].values, ['KEY001'])

props = buildImportSourceProperties({ 'uuid-vl': 'KEY001' }, catVl, {}, dsMap)
assert.deepStrictEqual(props[0].values, ['KEY001'])

const fdBad = { 'uuid-vl': 'TotallyNotInList' }
const clean = sanitizeImportFormDatasetValues(fdBad, catVl, {}, dsMap)
assert.strictEqual(clean['uuid-vl'], '')

const fdOk = { 'uuid-vl': 'Company' }
const clean2 = sanitizeImportFormDatasetValues(fdOk, catVl, {}, dsMap)
assert.strictEqual(clean2['uuid-vl'], 'KEY001')

assert.strictEqual(
  extractDocumentIdFromO2mResponse({
    json: { id: 'doc-1' }
  }),
  'doc-1'
)
const halJson = { _links: { self: { href: '/dms/r/r1/o2/ABC-999' } } }
assert.strictEqual(extractDocumentIdFromO2mResponse({ json: halJson }), 'ABC-999')
const h = new Headers()
h.set('Location', 'https://host.example/dms/r/r1/o2/LOC-ID')
assert.strictEqual(
  extractDocumentIdFromO2mResponse({ json: {}, headers: h }),
  'LOC-ID'
)
assert.strictEqual(
  extractDocumentIdFromO2mResponse({ json: { result: { dmsObjectId: 'nested' } } }),
  'nested'
)

console.log('documentImport.test.js: all passed')
