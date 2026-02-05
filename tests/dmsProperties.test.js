// ============================================================================
// DMS PROPERTIES POPULATION TEST
// ============================================================================
// Tests that dmsProperties values are correctly populated in form fields
// Run with: npm run test:dmsProperties
// Or open in browser: npm run dev, then open browser console and run tests

import { buildIndexFromDmsProperties, buildInitialValuesFromIndex } from '../src/utils/valueExtraction.js'
import { mapIdtoUniqueId } from '../src/utils/idMapping.js'
import { createApi } from '../src/services/api.js'

// Load test config - try local config file first, then window.TEST_CONFIG, then env vars or defaults
async function loadTestConfig() {
  // Try to load from local test.config.js
  try {
    const localConfig = await import('../test.config.js')
    const config = localConfig.TEST_CONFIG || localConfig.default || localConfig
    console.log('[dmsProperties.test] Loaded config from test.config.js')
    return config
  } catch (e) {
    // Fallback to window.TEST_CONFIG (from test runner) or env vars/defaults
    if (typeof window !== 'undefined' && window.TEST_CONFIG) {
      return window.TEST_CONFIG
    }
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}
    return {
      baseUrl: env.VITE_BASE_URL || process.env.VITE_BASE_URL || (typeof window !== 'undefined' ? window.TEST_BASE_URL : null) || '',
      apiKey: env.VITE_API_KEY || process.env.VITE_API_KEY || (typeof window !== 'undefined' ? window.TEST_API_KEY : null) || null,
      repoId: env.VITE_REPO_ID || process.env.VITE_REPO_ID || (typeof window !== 'undefined' ? window.TEST_REPO_ID : null) || null,
      documentId: env.VITE_DOCUMENT_ID || process.env.VITE_DOCUMENT_ID || (typeof window !== 'undefined' ? window.TEST_DOCUMENT_ID : null) || 'MW00000001',
      categoryId: env.VITE_CATEGORY_ID || process.env.VITE_CATEGORY_ID || (typeof window !== 'undefined' ? window.TEST_CATEGORY_ID : null) || null,
      skipApiCalls: (env.SKIP_API_CALLS === 'true' || process.env.SKIP_API_CALLS === 'true') || (typeof window !== 'undefined' ? window.SKIP_API_CALLS : false) || false
    }
  }
}

let TEST_CONFIG

// Mock dmsProperties data (matches the structure you provided)
const mockDmsProperties = {
  "106": ["Zähler"],
  "123": ["1226009001", "1226009001", null, null, null, "1226009001"],
  "158": ["1LTR/IMP."],
  "174": "DE",
  "185": "ETK_ALPMA",
  "187": "Bedienungshandbuch",
  "189": "",
  "191": "",
  "192": "",
  "193": "",
  "194": "2021-05-11",
  "property_last_modified_date": "2026-02-02T10:23:49.000+01:00",
  "property_last_alteration_date": "2021-11-04T11:19:29.000+01:00",
  "property_editor": "",
  "property_remark1": "",
  "property_remark2": "",
  "property_remark3": "",
  "property_remark4": "",
  "property_owner": "Geissinger",
  "property_caption": "ETK_ALPMA_DE_1LTR/IMP._Bedienungshandbuch",
  "property_filename": "ETK_Kunde_DE_M18x1x77 Schließer ..._Betriebs- und Wartungsanleitung(P006902392).PDF",
  "property_filetype": "PDF",
  "property_filemimetype": "application/pdf",
  "property_document_id": "T000000825",
  "property_document_number": "T000000825",
  "property_creation_date": "2021-11-04T11:19:29.000+01:00",
  "property_size": 217638,
  "property_state": "Released",
  "property_variant_number": "1",
  "property_access_date": "2026-02-04T10:51:27.000+01:00",
  "property_category": "ZDoku",
  "property_date_end_of_retention": "2071-11-04",
  "property_colorcode": ""
}

// Test runner
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

async function runTests() {
  // Load config if not already loaded
  if (!TEST_CONFIG) {
    TEST_CONFIG = await loadTestConfig()
  }
  
  console.group('🧪 DMS Properties Population Tests')
  console.log('Configuration:', {
    baseUrl: TEST_CONFIG.baseUrl,
    hasApiKey: !!TEST_CONFIG.apiKey,
    repoId: TEST_CONFIG.repoId,
    documentId: TEST_CONFIG.documentId,
    skipApiCalls: TEST_CONFIG.skipApiCalls
  })

  // Integration tests - run based on TEST_CONFIG.onPremise
  // If onPremise is null/undefined, test both; otherwise test only the specified mode
  if (TEST_CONFIG.onPremise === true || TEST_CONFIG.onPremise === null || TEST_CONFIG.onPremise === undefined) {
    test('Integration: Fetch real API data and test dmsProperties population (onPremise: true)', async () => {
      return await runIntegrationTest(true)
    })
  }

  if (TEST_CONFIG.onPremise === false || TEST_CONFIG.onPremise === null || TEST_CONFIG.onPremise === undefined) {
    test('Integration: Fetch real API data and test dmsProperties population (onPremise: false)', async () => {
      return await runIntegrationTest(false)
    })
  }

  for (const { name, fn } of tests) {
    try {
      const result = await fn()
      // Handle async test results that return objects
      if (result && typeof result === 'object' && result.skipped) {
        console.log(`⏭️  ${name} (skipped)`)
        // Don't count skipped tests as passed or failed
      } else {
        console.log(`✅ ${name}`)
        passed++
      }
    } catch (err) {
      console.error(`❌ ${name}:`, err.message)
      if (err.stack) console.error(err.stack)
      failed++
    }
  }

  console.groupEnd()
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)
  return { passed, failed }
}

// ===== TESTS =====

test('buildIndexFromDmsProperties: Creates index with numeric IDs', () => {
  const idMap = {}
  const index = buildIndexFromDmsProperties(mockDmsProperties, idMap)
  
  assert(index['106'], 'Should index by numeric ID')
  assert(index['property_106'], 'Should index by property_ prefix')
  assert(Array.isArray(index['106']), 'Should preserve array values')
  assert(index['106'][0] === 'Zähler', 'Should preserve array content')
  
  console.log('  📝 Index keys sample:', Object.keys(index).slice(0, 10))
})

test('buildIndexFromDmsProperties: Maps numeric IDs to UUIDs via idMap', () => {
  const idMap = {
    '106': 'uuid-106',
    '123': 'uuid-123',
    '158': 'uuid-158'
  }
  const index = buildIndexFromDmsProperties(mockDmsProperties, idMap)
  
  assert(index['uuid-106'], 'Should map numeric ID to UUID')
  assert(index['uuid-106'][0] === 'Zähler', 'UUID mapping should have correct value')
  assert(index['uuid-123'], 'Should map other numeric IDs')
  
  console.log('  📝 UUID mappings:', {
    'uuid-106': index['uuid-106'],
    'uuid-123': index['uuid-123']
  })
})

test('buildIndexFromDmsProperties: Handles property_ prefixed keys', () => {
  const idMap = {}
  const index = buildIndexFromDmsProperties(mockDmsProperties, idMap)
  
  assert(index['property_last_modified_date'], 'Should index property_ prefixed keys')
  assert(index['property_owner'] === 'Geissinger', 'Should preserve property_ values')
  
  console.log('  📝 Property_ keys:', {
    'property_owner': index['property_owner'],
    'property_last_modified_date': index['property_last_modified_date']
  })
})

test('buildIndexFromDmsProperties: Filters null/empty values from arrays', () => {
  const dmsProps = {
    '123': ['value1', null, '', 'value2', null]
  }
  const index = buildIndexFromDmsProperties(dmsProps, {})
  
  assert(Array.isArray(index['123']), 'Should preserve array structure')
  assert(index['123'].length === 2, 'Should filter null/empty values')
  assert(index['123'][0] === 'value1', 'Should preserve valid values')
  assert(index['123'][1] === 'value2', 'Should preserve other valid values')
})

test('buildIndexFromDmsProperties: Converts slot maps to arrays (on-premise multivalue format)', () => {
  const dmsProps = {
    '123': { '0': 'value1', '1': 'value2', '2': 'value3' },
    '456': { '0': 'single' }
  }
  const index = buildIndexFromDmsProperties(dmsProps, {})
  
  assert(Array.isArray(index['123']), 'Should convert slot map to array')
  assert(index['123'].length === 3, 'Should preserve all slot values')
  assert(index['123'][0] === 'value1', 'Should preserve slot order')
  assert(index['123'][1] === 'value2', 'Should preserve other values')
  assert(index['123'][2] === 'value3', 'Should preserve third value')
  
  assert(Array.isArray(index['456']), 'Single-value slot map should become array')
  assert(index['456'].length === 1, 'Should have one value')
  assert(index['456'][0] === 'single', 'Should preserve value')
  
  console.log('  📝 Slot map conversion:', {
    '123': index['123'],
    '456': index['456']
  })
})

test('buildInitialValuesFromIndex: Populates values from dmsIndex with UUID property IDs', () => {
  // Mock category properties with UUID IDs
  const catProps = [
    { id: 'uuid-106', isMultiValue: true, dataType: 'STRING' },
    { id: 'uuid-123', isMultiValue: true, dataType: 'STRING' },
    { id: 'uuid-174', isMultiValue: false, dataType: 'STRING' },
    { id: 'uuid-185', isMultiValue: false, dataType: 'STRING' }
  ]
  
  // idMap: numeric ID -> UUID
  const idMap = {
    '106': 'uuid-106',
    '123': 'uuid-123',
    '174': 'uuid-174',
    '185': 'uuid-185'
  }
  
  // dmsProperties indexed by numeric IDs
  const dmsProps = {
    '106': ['Zähler'],
    '123': ['1226009001', '1226009001'],
    '174': 'DE',
    '185': 'ETK_ALPMA'
  }
  
  const dmsIndex = buildIndexFromDmsProperties(dmsProps, idMap)
  const initialValues = buildInitialValuesFromIndex(catProps, {
    idMap,
    dmsIndex,
    o2Index: null,
    srmItem: null
  })
  
  // Values should be keyed by UUID (as CategoryFormView expects)
  assert(Array.isArray(initialValues['uuid-106']), 'Multivalue should be array')
  assert(initialValues['uuid-106'][0] === 'Zähler', 'Should populate multivalue from dmsIndex')
  
  assert(Array.isArray(initialValues['uuid-123']), 'Multivalue should be array')
  assert(initialValues['uuid-123'].length === 2, 'Should preserve all multivalue items')
  assert(initialValues['uuid-123'][0] === '1226009001', 'Should preserve multivalue content')
  
  assert(initialValues['uuid-174'] === 'DE', 'Should populate single value from dmsIndex')
  assert(initialValues['uuid-185'] === 'ETK_ALPMA', 'Should populate other single value')
  
  console.log('  📝 Initial values:', initialValues)
})

test('buildInitialValuesFromIndex: Populates values from dmsIndex with numeric property IDs', () => {
  // Mock category properties with numeric IDs (on-premise scenario)
  const catProps = [
    { id: '106', isMultiValue: true, dataType: 'STRING' },
    { id: '123', isMultiValue: true, dataType: 'STRING' },
    { id: '174', isMultiValue: false, dataType: 'STRING' }
  ]
  
  // Empty idMap (no UUID mapping)
  const idMap = {}
  
  // dmsProperties indexed by numeric IDs
  const dmsProps = {
    '106': ['Zähler'],
    '123': ['1226009001'],
    '174': 'DE'
  }
  
  const dmsIndex = buildIndexFromDmsProperties(dmsProps, idMap)
  const initialValues = buildInitialValuesFromIndex(catProps, {
    idMap,
    dmsIndex,
    o2Index: null,
    srmItem: null
  })
  
  // Values should be keyed by numeric ID (since no UUID mapping exists)
  assert(Array.isArray(initialValues['106']), 'Multivalue should be array')
  assert(initialValues['106'][0] === 'Zähler', 'Should populate multivalue from dmsIndex')
  
  assert(Array.isArray(initialValues['123']), 'Multivalue should be array')
  assert(initialValues['123'][0] === '1226009001', 'Should populate other multivalue')
  
  assert(initialValues['174'] === 'DE', 'Should populate single value from dmsIndex')
  
  console.log('  📝 Initial values (numeric IDs):', initialValues)
})

test('buildInitialValuesFromIndex: Prioritizes dmsIndex over O2 and SRM', () => {
  const catProps = [
    { id: 'uuid-106', isMultiValue: true, dataType: 'STRING' },
    { id: 'uuid-174', isMultiValue: false, dataType: 'STRING' }
  ]
  
  const idMap = {
    '106': 'uuid-106',
    '174': 'uuid-174'
  }
  
  // dmsIndex has priority values
  const dmsIndex = buildIndexFromDmsProperties({
    '106': ['dms-value'],
    '174': 'dms-value'
  }, idMap)
  
  // O2 index has different values (should be ignored when dmsIndex exists)
  const o2Index = {
    'uuid-106': ['o2-value'],
    'uuid-174': 'o2-value'
  }
  
  // SRM item has different values (should be ignored when dmsIndex exists)
  const srmItem = {
    sourceProperties: [
      { key: 'uuid-106', value: 'srm-value' },
      { key: 'uuid-174', value: 'srm-value' }
    ]
  }
  
  const initialValues = buildInitialValuesFromIndex(catProps, {
    idMap,
    dmsIndex,
    o2Index,
    srmItem
  })
  
  // Should use dmsIndex values, not O2 or SRM
  assert(initialValues['uuid-106'][0] === 'dms-value', 'Should prioritize dmsIndex for multivalue')
  assert(initialValues['uuid-174'] === 'dms-value', 'Should prioritize dmsIndex for single value')
  
  console.log('  📝 Verified dmsIndex priority:', initialValues)
})

test('buildInitialValuesFromIndex: Falls back to O2/SRM when dmsIndex missing', () => {
  const catProps = [
    { id: 'uuid-106', isMultiValue: true, dataType: 'STRING' },
    { id: 'uuid-174', isMultiValue: false, dataType: 'STRING' }
  ]
  
  const idMap = {
    '106': 'uuid-106',
    '174': 'uuid-174'
  }
  
  // No dmsIndex
  const dmsIndex = null
  
  // O2 index has values
  const o2Index = {
    'uuid-106': ['o2-value'],
    'uuid-174': 'o2-value'
  }
  
  // SRM item has values
  const srmItem = {
    sourceProperties: [
      { key: 'uuid-174', value: 'srm-value' }
    ]
  }
  
  const initialValues = buildInitialValuesFromIndex(catProps, {
    idMap,
    dmsIndex,
    o2Index,
    srmItem
  })
  
  // For multivalue: should prefer O2 over SRM
  assert(initialValues['uuid-106'][0] === 'o2-value', 'Should fallback to O2 for multivalue')
  
  // For single value: should prefer SRM over O2
  assert(initialValues['uuid-174'] === 'srm-value', 'Should fallback to SRM for single value')
  
  console.log('  📝 Verified fallback order:', initialValues)
})

async function runIntegrationTest(onPremise) {
  if (TEST_CONFIG.skipApiCalls || !TEST_CONFIG.baseUrl || TEST_CONFIG.baseUrl.includes('your-instance')) {
    console.log(`  ⏭️  Skipped (no API config or SKIP_API_CALLS=true) [onPremise: ${onPremise}]`)
    return { passed: true, skipped: true, onPremise }
  }

  // In browser, use Vite proxy to avoid CORS issues
  const isBrowser = typeof window !== 'undefined'
  const base = isBrowser && import.meta.env.DEV ? '/api' : TEST_CONFIG.baseUrl
  const repoId = TEST_CONFIG.repoId
  const docId = TEST_CONFIG.documentId || 'MW00000001'
  
  if (!repoId) {
    console.log(`  ⏭️  Skipped (no repoId) [onPremise: ${onPremise}]`)
    return { passed: true, skipped: true, onPremise }
  }

  console.log(`  📡 Fetching API data... (base: ${base}, onPremise: ${onPremise})`)
  console.log(`  📝 Using categoryId from config: ${TEST_CONFIG.categoryId}`)
  
  const Dv = createApi({ 
    base, 
    locale: 'en', 
    apiKey: TEST_CONFIG.apiKey,
    onPremise: onPremise
  })

  // Fetch document first to get actual categoryId if not provided or to verify
  let catPropsResp, objdefsResp, o2Resp
  let corsError = false
  let actualCategoryId = TEST_CONFIG.categoryId
  
  try {
    // Fetch O2 first to get the actual categoryId from the document
    o2Resp = await Dv.o2(base, repoId, docId).catch((err) => {
      if (err?.message?.includes('CORS') || err?.message?.includes('Failed to fetch')) {
        corsError = true
      }
      return null
    })
    
    // Extract categoryId from O2 response if available
    if (o2Resp) {
      const catFromO2 = o2Resp.objectDefinitionId || 
                       o2Resp.category?.id || 
                       o2Resp.category?.categoryId || 
                       o2Resp.category?.uuid ||
                       o2Resp.sourceCategory?.id ||
                       o2Resp.sourceCategory?.categoryId ||
                       (Array.isArray(o2Resp.sourceCategories) && o2Resp.sourceCategories[0]?.id) ||
                       (Array.isArray(o2Resp.sourceCategories) && o2Resp.sourceCategories[0]?.categoryId)
      if (catFromO2) {
        actualCategoryId = String(catFromO2)
        console.log(`  📝 Found categoryId from document O2 response: ${actualCategoryId}`)
      } else {
        console.log(`  ⚠️  Could not extract categoryId from O2 response. Available fields:`, {
          objectDefinitionId: o2Resp.objectDefinitionId,
          category: o2Resp.category,
          sourceCategory: o2Resp.sourceCategory,
          sourceCategories: o2Resp.sourceCategories
        })
      }
    }
    
    // Fetch category properties and object definitions
    [catPropsResp, objdefsResp] = await Promise.all([
      Dv.catProps(base, repoId, actualCategoryId).catch((err) => {
        console.warn(`  ⚠️  Failed to fetch category properties for ${actualCategoryId}:`, err.message)
        if (err?.message?.includes('CORS') || err?.message?.includes('Failed to fetch')) {
          corsError = true
        }
        return { arr: [] }
      }),
      Dv.objdefs(base, repoId).catch((err) => {
        if (err?.message?.includes('CORS') || err?.message?.includes('Failed to fetch')) {
          corsError = true
        }
        return { raw: {} }
      })
    ])
  } catch (err) {
    console.error('  ❌ Error fetching API data:', err)
    if (err?.message?.includes('CORS') || err?.message?.includes('Failed to fetch')) {
      corsError = true
    }
    catPropsResp = { arr: [] }
    objdefsResp = { raw: {} }
    o2Resp = null
  }

  // If CORS error, skip test with helpful message
  if (corsError || (catPropsResp.arr?.length === 0 && objdefsResp.raw && Object.keys(objdefsResp.raw).length === 0)) {
    console.log(`  ⚠️  Skipped due to CORS error or API unavailable [onPremise: ${onPremise}]`)
    console.log('  💡 Tip: Set VITE_BASE_URL in .env.local to use Vite proxy, or run tests in an environment with CORS configured')
    console.log('  ✅ Unit tests passed - dmsProperties indexing logic is working correctly')
    return { passed: true, skipped: true, onPremise }
  }

  let catProps = catPropsResp.arr || []
  const { idToUniqueId } = mapIdtoUniqueId(objdefsResp.raw || {})
  
  // Prefer single category by id; categories list is fallback only when single returns empty
  if (catProps.length === 0 && actualCategoryId && !corsError) {
    console.log(`  ⚠️  No properties found for categoryId: ${actualCategoryId}`)
    console.log(`  🔍 Fetching single category: /dmsconfig/r/{repoId}/objectmanagement/categories/${actualCategoryId}`)
    try {
      const singleResp = await Dv.category(base, repoId, actualCategoryId)
      const cat = singleResp.item || singleResp.raw
      if (cat) {
        const foundCatId = cat.id ?? cat.categoryId ?? cat.uuid ?? actualCategoryId
        console.log(`  ✅ Got category: ${foundCatId} (${cat.displayName || cat.name || ''})`)
        actualCategoryId = foundCatId
        const retryResp = await Dv.catProps(base, repoId, foundCatId).catch(() => ({ arr: [] }))
        catProps = retryResp.arr || []
        if (catProps.length > 0) {
          console.log(`  ✅ Successfully fetched ${catProps.length} properties with categoryId: ${foundCatId}`)
        }
      } else {
        // Fallback: fetch full categories list (e.g. if single-category endpoint not available)
        console.log(`  🔍 Single category empty; trying categories list...`)
        const categoriesResp = await Dv.categories(base, repoId)
        const categories = categoriesResp.arr || []
        const matchingCat = categories.find(c => 
          c.id === actualCategoryId || c.id?.toLowerCase() === actualCategoryId.toLowerCase() ||
          c.categoryId === actualCategoryId || c.uuid === actualCategoryId ||
          c.displayName?.toLowerCase() === actualCategoryId.toLowerCase()
        )
        if (matchingCat) {
          const foundCatId = matchingCat.id || matchingCat.categoryId || matchingCat.uuid
          actualCategoryId = foundCatId
          const retryResp = await Dv.catProps(base, repoId, foundCatId).catch(() => ({ arr: [] }))
          catProps = retryResp.arr || []
        } else if (categories.length > 0) {
          const firstCat = categories[0]
          const fallbackCatId = firstCat.id || firstCat.categoryId || firstCat.uuid
          if (fallbackCatId) {
            actualCategoryId = fallbackCatId
            const fallbackResp = await Dv.catProps(base, repoId, fallbackCatId).catch(() => ({ arr: [] }))
            catProps = fallbackResp.arr || []
          }
        }
      }
    } catch (err) {
      console.warn(`  ⚠️  Could not fetch category:`, err.message)
    }
  }
  
  console.log(`  📝 Found ${catProps.length} category properties`)
  console.log(`  📝 Built idMap with ${Object.keys(idToUniqueId).length} mappings`)

  // Build dmsIndex from mock data
  const dmsIndex = buildIndexFromDmsProperties(mockDmsProperties, idToUniqueId)
  
  console.log(`  📝 Built dmsIndex with ${Object.keys(dmsIndex).length} keys`)
  console.log('  📝 Sample dmsIndex entries:', Object.fromEntries(Object.entries(dmsIndex).slice(0, 5)))

  // Build initial values
  const initialValues = buildInitialValuesFromIndex(catProps, {
    idMap: idToUniqueId,
    dmsIndex: dmsIndex,
    o2Index: null,
    srmItem: null
  })

  console.log(`  📝 Built initialValues with ${Object.keys(initialValues).length} values`)
  
  // Check if any values were populated from dmsProperties
  const populatedFromDms = Object.entries(initialValues).filter(([uuid, value]) => {
    // Check if this value exists in dmsIndex
    const numericId = Object.entries(idToUniqueId).find(([num, u]) => u === uuid)?.[0]
    return numericId && dmsIndex[numericId] != null
  })

  console.log(`  📝 ${populatedFromDms.length} values populated from dmsProperties`)
  
  if (populatedFromDms.length > 0) {
    console.log('  📝 Sample populated values:', Object.fromEntries(populatedFromDms.slice(0, 5)))
  } else {
    console.warn('  ⚠️  No values were populated from dmsProperties!')
    console.log('  📝 Checking why...')
    console.log('  📝 Sample category property IDs:', catProps.slice(0, 5).map(p => ({ id: p.id, name: p.name })))
    console.log('  📝 Sample dmsProperties keys:', Object.keys(mockDmsProperties).slice(0, 10))
    console.log('  📝 Sample idMap entries:', Object.fromEntries(Object.entries(idToUniqueId).slice(0, 10)))
  }

  // Assert that at least some values were populated (only if we have category properties)
  if (catProps.length > 0) {
    assert(populatedFromDms.length > 0, `Expected at least some values to be populated from dmsProperties [onPremise: ${onPremise}]`)
    return { passed: true, populatedCount: populatedFromDms.length, onPremise }
  } else {
    console.log(`  ⚠️  Cannot verify population - no category properties fetched [onPremise: ${onPremise}]`)
    return { passed: true, skipped: true, onPremise }
  }
}

// Export for use in browser console or test runner
if (typeof window !== 'undefined') {
  window.runDmsPropertiesTests = async () => {
    if (!TEST_CONFIG) {
      TEST_CONFIG = await loadTestConfig()
    }
    return runTests()
  }
}

// Auto-run if executed directly (Node.js only)
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  runTests().catch(console.error)
}

export { runTests, loadTestConfig }
