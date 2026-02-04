# Best Practice: Data Storage Structure

## Recommended Structure

Based on Vue.js best practices and your current usage patterns, here's the optimal way to store data:

```javascript
data() {
  return {
    // ============================================
    // UI STATE (reactive, frequently changed)
    // ============================================
    loading: false,
    error: null,
    loaded: false,
    saveLoading: false,
    activeTab: 'properties',
    showMultivalueOnly: true,
    snackbar: {
      show: false,
      text: '',
      color: 'success'
    },
    
    // ============================================
    // CONFIGURATION (set once, rarely changes)
    // ============================================
    base: '',
    locale: 'en',
    repoId: '',
    docId: '',
    categoryId: '',
    
    // ============================================
    // RAW API RESPONSES (needed for save operations)
    // Store as-is, don't normalize
    // ============================================
    raw: {
      srmItem: null,              // Raw SRM response item
      o2Response: null,            // Raw O2 response (needed for save)
      categoryProperties: [],      // Raw category properties array
      objectDefinitions: null      // Raw objdefs response (for idMap)
    },
    
    // ============================================
    // MAPPINGS (lookup tables, computed once)
    // ============================================
    idMap: {},                    // numericId -> UUID mapping
    metaIdx: null,                // Map<uuid, metadata> for submission
    
    // ============================================
    // FORM STATE (single source of truth)
    // ============================================
    formData: {},                 // Current form values: { uuid: value }
    previousValues: {},            // Previous values for diffing: { uuid: value }
    
    // ============================================
    // DEPRECATED (remove these)
    // ============================================
    // initialValues: {},         // ❌ Remove - use formData instead
    // o2mPrev: {},              // ❌ Remove - use previousValues instead
    // srmItem: null,            // ❌ Remove - use raw.srmItem
    // o2Response: null,          // ❌ Remove - use raw.o2Response
    // categoryProperties: [],   // ❌ Remove - use raw.categoryProperties
  }
},

computed: {
  // ============================================
  // NORMALIZED DATA (computed from raw)
  // ============================================
  
  /**
   * Normalized category properties with labels
   * Computed from raw.categoryProperties
   */
  categoryProperties() {
    return (this.raw.categoryProperties || []).map(prop => ({
      ...prop,  // Keep all original fields
      uuid: this.idMap[prop.id] || prop.id,
      numericId: prop.id,
      label: labelFromName(prop.name, this.locale),
      dataType: normalizeDataTypeValue(prop.dataType),
      // Already normalized fields stay as-is
    }))
  },
  
  /**
   * Category-only properties (filtered)
   */
  categoryOnlyProperties() {
    return filterCategoryOnly(this.categoryProperties)
  },
  
  /**
   * Filtered by showMultivalueOnly
   */
  categoryOnlyPropertiesFiltered() {
    const list = this.categoryOnlyProperties
    if (!this.showMultivalueOnly) return list
    return list.filter(p => p?.isMultiValue)
  },
  
  /**
   * System properties from O2 response
   */
  systemPropertiesList() {
    const arr = this.raw.o2Response?.systemProperties
    return Array.isArray(arr) ? arr : []
  },
  
  /**
   * Properties with current values
   * Useful for debugging and advanced UI features
   */
  propertiesWithValues() {
    return this.categoryProperties.map(prop => ({
      ...prop,
      value: this.formData[prop.uuid],
      previousValue: this.previousValues[prop.uuid],
      hasChanged: this.formData[prop.uuid] !== this.previousValues[prop.uuid]
    }))
  }
}
```

## Key Principles

### 1. **Single Source of Truth**
- `formData` is the ONLY place where form values are stored
- Components read from and write to `formData` directly
- No duplicate state (no `initialValues` + `formData`)

### 2. **Raw Data Preservation**
- Store raw API responses in `raw.*` namespace
- Needed for save operations (validation payloads)
- Don't mutate raw data

### 3. **Computed Normalization**
- Use Vue computed properties for normalized data
- Automatically updates when raw data changes
- Cached by Vue (only recomputes when dependencies change)

### 4. **Flat Structure**
- Keep data structure flat and simple
- Avoid deep nesting
- Easy to debug and inspect

### 5. **Separation of Concerns**
- **Raw data**: API responses (immutable)
- **Mappings**: Lookup tables (computed once)
- **Form state**: User input (mutable)
- **UI state**: Component state (mutable)

## Migration Steps

### Step 1: Add `raw` namespace
```javascript
// In mounted():
this.raw = {
  srmItem: firstItem,
  o2Response: o2Resp,
  categoryProperties: catP.arr,
  objectDefinitions: od?.raw
}
```

### Step 2: Update computed properties
```javascript
computed: {
  categoryProperties() {
    return this.raw.categoryProperties || []
  },
  // ... other computed properties
}
```

### Step 3: Update references
```javascript
// Old:
this.categoryProperties = catP.arr
this.o2Response = o2Resp

// New:
this.raw.categoryProperties = catP.arr
this.raw.o2Response = o2Resp
```

### Step 4: Remove redundant state
```javascript
// Remove:
// - initialValues (use formData)
// - o2mPrev (use previousValues)
// - Direct references to srmItem, o2Response, categoryProperties
```

## Benefits

1. **Performance**: Computed properties are cached
2. **Memory**: No duplicate data storage
3. **Maintainability**: Clear data flow
4. **Debugging**: Easy to inspect raw vs normalized
5. **Type Safety**: Clear structure (easier to add TypeScript later)

## Example Usage

```javascript
// In mounted():
async mounted() {
  // ... fetch data ...
  
  // Store raw responses
  this.raw = {
    srmItem: firstItem,
    o2Response: o2Resp,
    categoryProperties: catP.arr,
    objectDefinitions: od?.raw
  }
  
  // Build mappings (computed once)
  const { idToUniqueId } = mapIdtoUniqueId(od?.raw ?? {})
  this.idMap = idToUniqueId || {}
  this.metaIdx = toMetaIndex(this.categoryProperties, { idMap: this.idMap })
  
  // Build initial form values
  const initialValues = buildInitialValuesFromIndex(
    this.categoryProperties,
    {
      o2Response: this.raw.o2Response,
      srmItem: this.raw.srmItem,
      idMap: this.idMap,
      dmsProperties: dmsProps
    }
  )
  
  // Set form state (single source of truth)
  this.formData = { ...initialValues }
  this.previousValues = makePrevMap(
    this.raw.o2Response,
    this.raw.srmItem,
    this.categoryProperties,
    this.idMap,
    this.formData
  )
  
  this.loaded = true
}
```

## Component Usage

```vue
<!-- Components receive normalized computed properties -->
<CategoryFormView
  v-model="formData"
  :properties="categoryOnlyPropertiesFiltered"
  :current-locale="locale"
/>
```

## Why This Structure?

1. **Vue Reactivity**: Works perfectly with Vue's reactivity system
2. **Performance**: Computed properties cache results
3. **Memory Efficient**: No duplicate data
4. **Clear Intent**: Raw vs normalized is obvious
5. **Easy Testing**: Can test normalization separately
6. **Future Proof**: Easy to add TypeScript, Vuex, or other state management
