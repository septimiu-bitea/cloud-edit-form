/**
 * Node smoke tests for document import helpers.
 * Run: node tests/documentImport.test.js
 */
import assert from 'assert'
import {
  buildImportSourceProperties,
  buildO2mCreatePayload,
  resolveAfterImportUrl,
  makeUniqueMasterName
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

console.log('documentImport.test.js: all passed')
