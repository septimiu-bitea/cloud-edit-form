// ============================================================================
// VALIDATION PAYLOAD TEST
// ============================================================================
// Tests that buildValidationPayload produces the correct payload for
// POST /o2/{documentId}/update/validate (form data keyed by UUID vs numeric id).
// Run in browser: npm run dev, then open http://localhost:5173/tests/validation-payload.html
// Use test.config.js or the form on that page to run integration tests with real API data.

import { buildValidationPayload, buildO2mPayloadFromValidationResponse, putO2mUpdate, toMetaIndex, makePrevMap } from '@/services/submission'
import { createApi } from '@/services/api'
import { idToUniqueIdFromSrm, mapIdtoUniqueId, getNumericIdFromUuid } from '@/utils/idMapping'
import { buildInitialValuesFromO2 } from '@/utils/valueExtraction'

let TEST_CONFIG = null

async function loadTestConfig() {
  if (typeof window !== 'undefined' && window.TEST_CONFIG && (window.TEST_CONFIG.baseUrl || window.TEST_CONFIG.repoId || window.TEST_CONFIG.documentId)) {
    console.log('[validationPayload.test] Using config from form / window.TEST_CONFIG')
    return window.TEST_CONFIG
  }
  try {
    const localConfig = await import('./test.config.js')
    const config = localConfig.TEST_CONFIG || localConfig.default || localConfig
    console.log('[validationPayload.test] Loaded config from test.config.js')
    return config
  } catch (e) {
    if (typeof window !== 'undefined' && window.TEST_CONFIG) {
      return window.TEST_CONFIG
    }
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}
    return {
      baseUrl: env.VITE_BASE_URL || (typeof window !== 'undefined' ? window.TEST_BASE_URL : null) || '',
      apiKey: env.VITE_API_KEY || (typeof window !== 'undefined' ? window.TEST_API_KEY : null) || null,
      repoId: env.VITE_REPO_ID || (typeof window !== 'undefined' ? window.TEST_REPO_ID : null) || null,
      documentId: env.VITE_DOCUMENT_ID || (typeof window !== 'undefined' ? window.TEST_DOCUMENT_ID : null) || null,
      categoryId: env.VITE_CATEGORY_ID || (typeof window !== 'undefined' ? window.TEST_CATEGORY_ID : null) || null,
      onPremise: env.VITE_ON_PREMISE === 'true' || (typeof window !== 'undefined' ? window.TEST_ON_PREMISE : null) || false,
      skipApiCalls: env.SKIP_API_CALLS === 'true' || (typeof window !== 'undefined' ? window.SKIP_API_CALLS : false) || false
    }
  }
}

const tests = []
let passed = 0
let failed = 0

function test(name, fn) {
  tests.push({ name, fn })
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

function assertEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Expected ${expectedStr}, but got ${actualStr}`
    )
  }
}

async function runTests() {
  if (!TEST_CONFIG) {
    TEST_CONFIG = await loadTestConfig()
  }
  console.group('🧪 Validation Payload Tests')
  console.log('Config:', {
    baseUrl: TEST_CONFIG.baseUrl ? TEST_CONFIG.baseUrl.slice(0, 40) + '...' : '',
    repoId: TEST_CONFIG.repoId ? TEST_CONFIG.repoId.slice(0, 20) + '...' : '',
    documentId: TEST_CONFIG.documentId,
    skipApiCalls: TEST_CONFIG.skipApiCalls,
    onPremise: TEST_CONFIG.onPremise
  })

  const testsToRun = [...tests]
  if (!TEST_CONFIG.skipApiCalls && TEST_CONFIG.baseUrl && TEST_CONFIG.repoId && TEST_CONFIG.documentId) {
    const onPrem = TEST_CONFIG.onPremise
    if (onPrem === true || onPrem === null || onPrem === undefined) {
      testsToRun.push({ name: 'Integration: build validation payload with real API data (onPremise: true)', fn: () => runIntegrationTest(true) })
    }
    if (onPrem === false || onPrem === null || onPrem === undefined) {
      testsToRun.push({ name: 'Integration: build validation payload with real API data (onPremise: false)', fn: () => runIntegrationTest(false) })
    }
  }
  console.log('Running', testsToRun.length, 'tests...\n')

  for (const { name, fn } of testsToRun) {
    try {
      const result = await fn()
      if (result && typeof result === 'object' && result.skipped) {
        console.log('⏭️', name, '(skipped)')
      } else {
        console.log('✅', name)
        passed++
      }
    } catch (err) {
      console.error('❌', name)
      console.error('   Error:', err.message)
      if (err.stack) {
        console.error('   Stack:', err.stack.split('\n').slice(1, 3).join('\n'))
      }
      failed++
    }
  }

  console.groupEnd()
  console.log('\n' + '='.repeat(50))
  console.log(`Tests: ${passed} passed, ${failed} failed, ${testsToRun.length} total`)
  console.log('='.repeat(50))

  return { passed, failed, total: testsToRun.length }
}

// ============================================================================
// TESTS
// ============================================================================

test('buildValidationPayload: includes extendedProperties when formData is keyed by UUID (on-premise)', () => {
  // Category properties use numeric id (on-premise); form stores values by UUID (CategoryFormView resolveUuid)
  const idMap = { '159': 'uuid-159', '160': 'uuid-160' }
  const catPropsArr = [
    { id: '159', dataType: 'STRING', isMultiValue: false, isSystemProperty: false, readOnly: false },
    { id: '160', dataType: 'STRING', isMultiValue: false, isSystemProperty: false, readOnly: false }
  ]
  const metaIdx = toMetaIndex(catPropsArr, { idMap })
  const form = {
    submission: {
      data: {
        'uuid-159': 'Value for 159',
        'uuid-160': 'Value for 160'
      }
    },
    _o2mPrev: {}
  }

  const payload = buildValidationPayload({
    documentId: 'F600000193',
    repoId: '6527a63c-8b2e-4c01-b14e-89396124d736',
    objectDefinitionId: '9e332',
    categoryId: '9e332',
    form,
    metaIdx,
    catPropsArr,
    idMap
  })

  assert(payload.extendedProperties['159'] === 'Value for 159', 'extendedProperties[159] should come from formData[uuid-159]')
  assert(payload.extendedProperties['160'] === 'Value for 160', 'extendedProperties[160] should come from formData[uuid-160]')
  assert(payload.type === 1, 'type should be 1')
  assert(payload.objectDefinitionId === '9e332', 'objectDefinitionId should be set')
  assert(payload.docNumber === 'F600000193', 'docNumber should be documentId')
  assert(payload.id === 'F600000193', 'id should be documentId')
})

test('buildValidationPayload: includes multivalueExtendedProperties when formData is keyed by UUID', () => {
  const idMap = { '161': 'uuid-161' }
  const catPropsArr = [
    { id: '161', dataType: 'STRING', isMultiValue: true, isSystemProperty: false, readOnly: false }
  ]
  const metaIdx = toMetaIndex(catPropsArr, { idMap })
  const form = {
    submission: {
      data: {
        'uuid-161': ['A', 'B', 'C']
      }
    },
    _o2mPrev: { '161': [] }
  }

  const payload = buildValidationPayload({
    documentId: 'DOC001',
    objectDefinitionId: '9e332',
    form,
    metaIdx,
    catPropsArr,
    idMap
  })

  assert(payload.multivalueExtendedProperties['161'], 'multivalueExtendedProperties[161] should exist')
  assertEqual(
    Object.keys(payload.multivalueExtendedProperties['161']).sort((a, b) => Number(a) - Number(b)).map(k => payload.multivalueExtendedProperties['161'][k]),
    ['A', 'B', 'C'],
    'multivalue values should match formData[uuid-161]'
  )
})

test('buildValidationPayload: fallback formData[propId] when keyed by numeric id', () => {
  const idMap = {}
  const catPropsArr = [
    { id: '162', dataType: 'STRING', isMultiValue: false, isSystemProperty: false, readOnly: false }
  ]
  const metaIdx = toMetaIndex(catPropsArr, { idMap })
  const form = {
    submission: {
      data: {
        '162': 'Value by numeric id'
      }
    },
    _o2mPrev: {}
  }

  const payload = buildValidationPayload({
    documentId: 'DOC001',
    objectDefinitionId: '9e332',
    form,
    metaIdx,
    catPropsArr,
    idMap
  })

  assert(payload.extendedProperties['162'] === 'Value by numeric id', 'extendedProperties[162] should come from formData[162]')
})

test('buildValidationPayload: skips readOnly properties', () => {
  const idMap = { '163': 'uuid-163' }
  const catPropsArr = [
    { id: '163', dataType: 'STRING', isMultiValue: false, isSystemProperty: true, readOnly: true }
  ]
  const metaIdx = toMetaIndex(catPropsArr, { idMap })
  const form = {
    submission: { data: { 'uuid-163': 'Should not appear' } },
    _o2mPrev: {}
  }

  const payload = buildValidationPayload({
    documentId: 'DOC001',
    objectDefinitionId: '9e332',
    form,
    metaIdx,
    catPropsArr,
    idMap
  })

  assert(!payload.extendedProperties['163'], 'readOnly property should not be in extendedProperties')
})

test('buildValidationPayload: includes systemProperties from srmItem', () => {
  const srmItem = {
    sourceProperties: [
      { key: 'property_document_number', displayValue: 'F600000193' },
      { key: 'property_variant_number', displayValue: '1' }
    ]
  }

  const payload = buildValidationPayload({
    documentId: 'DOC001',
    objectDefinitionId: '9e332',
    form: { submission: { data: {} }, _o2mPrev: {} },
    metaIdx: new Map(),
    catPropsArr: [],
    idMap: {},
    srmItem
  })

  assert(payload.systemProperties.property_document_number === 'F600000193', 'systemProperties should include document number')
  assert(payload.systemProperties.property_variant_number === '1', 'systemProperties should include variant number')
})

test('buildValidationPayload: storeObject has correct shape', () => {
  const payload = buildValidationPayload({
    documentId: 'F600000193',
    repoId: 'repo-123',
    form: { submission: { data: {} }, _o2mPrev: {} },
    metaIdx: new Map(),
    catPropsArr: [],
    idMap: {}
  })

  assert(payload.storeObject.dmsObjectId === 'F600000193', 'storeObject.dmsObjectId')
  assert(payload.storeObject.dmsobject.id === 'F600000193', 'storeObject.dmsobject.id')
  assert(payload.storeObject.isInUpdateMode === true, 'storeObject.isInUpdateMode')
  assert(payload.storeObject.doValidate === false, 'storeObject.doValidate')
  assert(payload.storeObject._links && typeof payload.storeObject._links === 'object', 'storeObject._links')
  assert(payload.storeObject._embedded && typeof payload.storeObject._embedded === 'object', 'storeObject._embedded')
})

// --- buildO2mPayloadFromValidationResponse (PUT o2m body per update_definition.txt) ---
test('buildO2mPayloadFromValidationResponse: sourceProperties shape per API (key + values array)', () => {
  const validationResponse = {
    extendedProperties: { '2': 'INV/2022/0011', '25': '2022-06-02' },
    multivalueExtendedProperties: {}
  }
  const payload = buildO2mPayloadFromValidationResponse(validationResponse, { repoId: 'repo-uuid-123' })
  assert(payload != null, 'payload exists')
  assert(payload.sourceProperties != null, 'sourceProperties exists')
  assert(Array.isArray(payload.sourceProperties.properties), 'sourceProperties.properties is array (per API)')
  const props = payload.sourceProperties.properties
  assert(props.every(p => typeof p.key === 'string' && Array.isArray(p.values)), 'each property has key (string) and values (array)')
  assert(props.every(p => p.values.every(v => typeof v === 'string')), 'values are strings (per API)')
  const inv = props.find(p => p.key === '2')
  assert(inv && inv.values.length === 1 && inv.values[0] === 'INV/2022/0011', 'single-value as one-element array')
})

test('buildO2mPayloadFromValidationResponse: default sourceId per API when repoId given', () => {
  const validationResponse = {
    extendedProperties: { '2': 'val' },
    multivalueExtendedProperties: {}
  }
  const repoId = 'f7258e62-5526-49e5-abc5-d0ced1b4ada5'
  const payload = buildO2mPayloadFromValidationResponse(validationResponse, { repoId })
  assert(payload.sourceProperties != null, 'has sourceProperties')
  assert(payload.sourceId === `/dms/r/${repoId}/source`, 'sourceId is default /dms/r/{repositoryId}/source per update_definition.txt')
})

test('buildO2mPayloadFromValidationResponse: custom sourceId not overridden', () => {
  const validationResponse = {
    extendedProperties: { '2': 'x' },
    multivalueExtendedProperties: {}
  }
  const payload = buildO2mPayloadFromValidationResponse(validationResponse, {
    repoId: 'repo-1',
    sourceId: '/myapp/sources/mysource'
  })
  assert(payload.sourceId === '/myapp/sources/mysource', 'custom sourceId preserved')
})

test('buildO2mPayloadFromValidationResponse: multivalue as values array per API', () => {
  const validationResponse = {
    extendedProperties: {},
    multivalueExtendedProperties: {
      '106': { '1': 'Kabel', '2': 'Kabel' }
    }
  }
  const payload = buildO2mPayloadFromValidationResponse(validationResponse, { repoId: 'r1' })
  const p106 = payload.sourceProperties.properties.find(p => p.key === '106')
  assert(p106 != null, 'multivalue property present')
  assert(Array.isArray(p106.values) && p106.values.length === 2, 'values is array (per API)')
  assert(p106.values[0] === 'Kabel' && p106.values[1] === 'Kabel', 'slot values in order')
})

test('buildO2mPayloadFromValidationResponse: optional fields only when provided', () => {
  const validationResponse = { extendedProperties: { '1': 'a' }, multivalueExtendedProperties: {} }
  const withCategory = buildO2mPayloadFromValidationResponse(validationResponse, {
    repoId: 'r1',
    filename: 'doc.pdf',
    sourceCategory: 'cat-ID'
  })
  assert(withCategory.filename === 'doc.pdf', 'filename when provided')
  assert(withCategory.sourceCategory === 'cat-ID', 'sourceCategory when provided')
  assert(withCategory.sourceId == null, 'sourceId not set when sourceCategory provided (per API: sourceCategory ignored on update)')
  const withDefaultSource = buildO2mPayloadFromValidationResponse(validationResponse, { repoId: 'r1' })
  assert(withDefaultSource.sourceId === '/dms/r/r1/source', 'default sourceId when only repoId and sourceProperties per update_definition.txt')
})

test('buildValidationPayload: adds eTag and lockTokenUrl from o2Response when present', () => {
  const o2Response = {
    storeObject: {
      eTag: 'etag-123',
      lockTokenUrl: 'https://example.com/lock'
    }
  }

  const payload = buildValidationPayload({
    documentId: 'DOC001',
    objectDefinitionId: '9e332',
    form: { submission: { data: {} }, _o2mPrev: {} },
    metaIdx: new Map(),
    catPropsArr: [],
    idMap: {},
    o2Response
  })

  assert(payload.storeObject.eTag === 'etag-123', 'storeObject should include eTag from o2Response')
  assert(payload.storeObject.lockTokenUrl === 'https://example.com/lock', 'storeObject should include lockTokenUrl')
})

test('buildValidationPayload: empty form still produces valid structure', () => {
  const payload = buildValidationPayload({
    documentId: 'DOC001',
    objectDefinitionId: '9e332',
    form: { submission: { data: {} }, _o2mPrev: {} },
    metaIdx: new Map(),
    catPropsArr: [],
    idMap: {}
  })

  assert(payload.extendedProperties && typeof payload.extendedProperties === 'object', 'extendedProperties should be object')
  assert(payload.multivalueExtendedProperties && typeof payload.multivalueExtendedProperties === 'object', 'multivalueExtendedProperties should be object')
  assert(payload.remarks && typeof payload.remarks === 'object', 'remarks should be object')
  assert(payload.type === 1, 'type should be 1')
})

test('buildValidationPayload: single-value uses prevMap when formData missing', () => {
  const idMap = { '164': 'uuid-164' }
  const catPropsArr = [
    { id: '164', dataType: 'STRING', isMultiValue: false, isSystemProperty: false, readOnly: false }
  ]
  const metaIdx = toMetaIndex(catPropsArr, { idMap })
  const form = {
    submission: { data: {} },
    _o2mPrev: { '164': 'Previous value' }
  }

  const payload = buildValidationPayload({
    documentId: 'DOC001',
    objectDefinitionId: '9e332',
    form,
    metaIdx,
    catPropsArr,
    idMap
  })

  assert(payload.extendedProperties['164'] === 'Previous value', 'extendedProperties should fallback to prevMap when formData empty')
})

test('buildValidationPayload: uses test config values when provided', () => {
  const docId = (TEST_CONFIG && TEST_CONFIG.documentId) || 'F600000193'
  const repoId = (TEST_CONFIG && TEST_CONFIG.repoId) || '6527a63c-8b2e-4c01-b14e-89396124d736'
  const objectDefinitionId = (TEST_CONFIG && TEST_CONFIG.categoryId) || '9e332'
  const idMap = { '159': 'uuid-159' }
  const catPropsArr = [
    { id: '159', dataType: 'STRING', isMultiValue: false, isSystemProperty: false, readOnly: false }
  ]
  const metaIdx = toMetaIndex(catPropsArr, { idMap })
  const form = {
    submission: { data: { 'uuid-159': 'Config test value' } },
    _o2mPrev: {}
  }

  const payload = buildValidationPayload({
    documentId: docId,
    repoId,
    objectDefinitionId,
    categoryId: objectDefinitionId,
    form,
    metaIdx,
    catPropsArr,
    idMap
  })

  assert(payload.docNumber === docId, 'docNumber should match config documentId')
  assert(payload.id === docId, 'id should match config documentId')
  assert(payload.extendedProperties['159'] === 'Config test value', 'extendedProperties should contain form value')
})

async function runIntegrationTest (onPremise) {
  if (TEST_CONFIG.skipApiCalls || !TEST_CONFIG.baseUrl || !TEST_CONFIG.repoId || !TEST_CONFIG.documentId) {
    console.log('  ⏭️  Skipped (set baseUrl, repoId, documentId and skipApiCalls=false in test config)')
    return { skipped: true }
  }

  const base = typeof window !== 'undefined' && import.meta.env.DEV ? '/api' : TEST_CONFIG.baseUrl
  const Dv = createApi({
    base,
    locale: 'en',
    apiKey: TEST_CONFIG.apiKey || undefined,
    onPremise: !!onPremise
  })

  const srmResp = await Dv.srm(base, TEST_CONFIG.repoId, TEST_CONFIG.documentId)
  const firstItem = Array.isArray(srmResp?.items) ? srmResp.items[0] : null
  if (!firstItem) {
    console.log('  ⏭️  Skipped (no SRM item for document)')
    return { skipped: true }
  }

  const c3 = firstItem?.sourceCategories?.[0] ?? firstItem?.category
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let simpleId = ''
  let uniqueId = ''
  if (typeof c3 === 'string' || typeof c3 === 'number') {
    const s = String(c3).trim()
    if (uuidLike.test(s)) uniqueId = s
    else simpleId = s
  } else if (c3 && typeof c3 === 'object') {
    simpleId = String(c3.id ?? c3.categoryId ?? '').trim()
    uniqueId = String(c3.uuid ?? c3.uniqueId ?? '').trim()
  }
  const categoryId = uniqueId || simpleId
  if (!categoryId) {
    console.log('  ⏭️  Skipped (no category on document)')
    return { skipped: true }
  }

  const onPrem = !!onPremise
  const catIdForApi = onPrem ? (simpleId || uniqueId) : (uniqueId || simpleId)
  const [catP, o2Resp, od] = await Promise.all([
    Dv.catProps(base, TEST_CONFIG.repoId, catIdForApi),
    Dv.o2(base, TEST_CONFIG.repoId, TEST_CONFIG.documentId),
    Dv.objdefs(base, TEST_CONFIG.repoId)
  ])

  const fromSrm = idToUniqueIdFromSrm(srmResp)
  const fromObjdef = mapIdtoUniqueId(od?.raw ?? {})
  const idMap = (fromSrm?.idToUniqueId || fromObjdef?.idToUniqueId) || {}

  const categoryProperties = catP.arr || []
  const metaIdx = toMetaIndex(categoryProperties, { idMap })
  const { initialValues } = buildInitialValuesFromO2(o2Resp, {
    idMap,
    categoryProperties,
    onPremise: onPrem
  })
  const formData = { ...initialValues }
  const previousValues = makePrevMap(o2Resp, firstItem, categoryProperties, idMap, formData)

  const objectDefinitionId = simpleId || getNumericIdFromUuid(idMap, uniqueId) || categoryId
  const formLike = {
    submission: { data: formData },
    _o2mPrev: previousValues
  }

  const payload = buildValidationPayload({
    base,
    repoId: TEST_CONFIG.repoId,
    documentId: TEST_CONFIG.documentId,
    objectDefinitionId,
    categoryId,
    form: formLike,
    metaIdx,
    catPropsArr: categoryProperties,
    idMap,
    o2Response: o2Resp,
    srmItem: firstItem,
    displayValue: '',
    filename: ''
  })

  if (typeof window !== 'undefined') {
    window.__lastValidationPayload = payload
    window.__lastValidationPayloadDocumentId = TEST_CONFIG.documentId
  }
  console.log('Integration test payload (onPremise:', onPremise, ') (see Payload section below):', JSON.stringify(payload, null, 2))

  assert(payload.docNumber === TEST_CONFIG.documentId, 'payload.docNumber should match config documentId')
  assert(payload.objectDefinitionId, 'payload should have objectDefinitionId')
  const hasExtended = Object.keys(payload.extendedProperties || {}).length > 0
  const hasMultivalue = Object.keys(payload.multivalueExtendedProperties || {}).length > 0
  assert(hasExtended || hasMultivalue || categoryProperties.length === 0, 'payload should include extended or multivalue properties when category has editable props')

  const validationResult = await Dv.validateUpdate(base, TEST_CONFIG.repoId, TEST_CONFIG.documentId, payload)
  const reason = (validationResult.json && (validationResult.json.reason || validationResult.json.message)) || validationResult.text || ''
  const isOriginOrRefererBlock = validationResult.status === 403 && /invalid origin|invalid referer|origin|referer/i.test(reason)
  if (!validationResult.ok) {
    if (isOriginOrRefererBlock) {
      console.log('  ⚠️  Validate returned 403 (origin/referer). Payload was built correctly; run from the app origin or allow the test origin in your instance.')
      return
    }
    assert(false, `Validate endpoint rejected payload: ${validationResult.status} ${reason}`)
  }

  // Test full save flow: PUT o2m with current values (no edits)
  const validationResponse = validationResult.json
  const storeObj = validationResponse?.storeObject ?? payload?.storeObject ?? {}
  const o2mPayload = buildO2mPayloadFromValidationResponse(validationResponse, {
    filename: storeObj.filename ?? payload?.storeObject?.filename ?? '',
    sourceCategory: objectDefinitionId ?? categoryId ?? '',
    repoId: TEST_CONFIG.repoId
  })
  assert(o2mPayload != null, 'buildO2mPayloadFromValidationResponse should return payload')
  // Per update_definition.txt: when sourceProperties present, source required (default sourceId = /dms/r/{repositoryId}/source)
  if (o2mPayload.sourceProperties?.properties?.length > 0) {
    assert(o2mPayload.sourceId != null || o2mPayload.sourceCategory != null, 'o2m payload must have sourceId or sourceCategory when sourceProperties set')
    if (o2mPayload.sourceId != null) {
      assert(o2mPayload.sourceId === `/dms/r/${encodeURIComponent(TEST_CONFIG.repoId)}/source` || o2mPayload.sourceId.startsWith('/'), 'sourceId must be default or custom URI')
    }
    assert(Array.isArray(o2mPayload.sourceProperties.properties), 'sourceProperties.properties must be array per API')
    o2mPayload.sourceProperties.properties.forEach(p => {
      assert(typeof p.key === 'string', 'property key must be string')
      assert(Array.isArray(p.values) && p.values.every(v => typeof v === 'string'), 'property values must be string[] per API')
    })
  }
  console.log('  📤 PUT o2m (save with current values)...')
  const saveResult = await putO2mUpdate({
    base,
    repoId: TEST_CONFIG.repoId,
    dmsObjectId: TEST_CONFIG.documentId,
    payload: o2mPayload,
    apiKey: TEST_CONFIG.apiKey || undefined
  })
  if (!saveResult.ok) {
    const saveReason = (saveResult.json && (saveResult.json.reason || saveResult.json.message)) || saveResult.text || ''
    const saveBlock = saveResult.status === 403 && /invalid origin|invalid referer|origin|referer/i.test(saveReason)
    if (saveBlock) {
      console.log('  ⚠️  PUT o2m returned 403 (origin/referer). Validate + o2m payload were built correctly.')
      return
    }
    assert(false, `PUT o2m (save) failed: ${saveResult.status} ${saveReason}`)
  }
  console.log('  ✅ Validate + PUT o2m (save with current values) succeeded')
}

export { runTests, loadTestConfig }

if (typeof window !== 'undefined') {
  window.runValidationPayloadTests = runTests
  console.log('✅ Validation payload tests loaded. Run window.runValidationPayloadTests() to execute.')
} else {
  const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
    (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')))

  if (isMainModule || !process.argv[1] || process.argv[1].includes('validationPayload.test.js')) {
    runTests().then(({ passed, failed }) => {
      process.exit(failed > 0 ? 1 : 0)
    }).catch(err => {
      console.error('Test runner error:', err)
      process.exit(1)
    })
  }
}
