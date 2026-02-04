# API Calls: Cloud vs On-Premise

## Overview

The `onPremise` flag (set in `scripts/loading.js` as `ON_PREMISE = true/false`) determines which API functions are used. Both environments use the same core APIs, but **category properties, datasets, and categories** are fetched differently.

## API Calls Made in EditView

### Common APIs (Both Cloud & On-Premise)

These are called the same way regardless of `onPremise` flag:

1. **`Dv.srm()`** - Search/Retrieve Metadata
   - Endpoint: `/dms/r/{repoId}/sr/`
   - Purpose: Get document metadata and category ID
   - Used to: Extract category ID from document

2. **`Dv.o2()`** - Object Details
   - Endpoint: `/dms/r/{repoId}/o2/{documentId}`
   - Purpose: Get full document object with properties
   - Used to: Build `o2Index` for value population
   - **On-premise**: Returns `extendedProperties` (object keyed by numeric IDs)
   - **Cloud**: Returns `objectProperties`, `multivalueProperties`, `systemProperties` arrays

3. **`Dv.objdefs()`** - Object Definitions
   - Endpoint: `/dms/r/{repoId}/objdef`
   - Purpose: Get ID mapping (numeric ID ↔ UUID)
   - Used to: Build `idMap` for property lookups

4. **`Dv.validateUpdate()`** - Validate Update
   - Endpoint: `/dms/r/{repoId}/o2/{documentId}/update/validate`
   - Purpose: Validate form submission before saving
   - Used in: `onSave()` method

5. **`putO2mUpdate()`** - Save Changes
   - Endpoint: `/dms/r/{repoId}/o2m/{documentId}`
   - Purpose: Save form changes
   - Used in: `onSave()` method

### Different APIs (Cloud vs On-Premise)

#### Cloud (`onPremise: false`)

**`Dv.catProps()`** - Category Properties
- Endpoint: `/dmsconfig/r/{repoId}/objectmanagement/categories/{categoryId}/properties`
- Returns: Array of property definitions with UUIDs
- Format: `[{ id: "uuid-123", name: {...}, dataType: "STRING", ... }]`

**`Dv.categories()`** - Categories List
- Endpoint: `/dmsconfig/r/{repoId}/objectmanagement/categories`
- Returns: Array of categories

**`Dv.datasets()`** - Datasets
- Endpoint: `/dmsconfig/r/{repoId}/objectmanagement/datasets`
- Returns: Array of dataset definitions

**`Dv.allProps()`** - All Properties
- Endpoint: `/dmsconfig/r/{repoId}/objectmanagement/properties`
- Returns: Array of all property definitions

#### On-Premise (`onPremise: true`)

**`Dv.catProps()`** → Uses `catPropsFromStoredoctype()`
- First calls: `Dv.storedoctype()` → `/dms/r/{repoId}/storedoctype`
- Then extracts: `storageDocumentTypes[].extendedProperties[]`
- Returns: Array of property definitions with **numeric IDs**
- Format: `[{ id: "123", name: {...}, dataType: "STRING", ... }]`
- **Cached**: `storedoctype` response is cached per `baseUrl|repoId`

**`Dv.categories()`** → Uses `categoriesFromStoredoctype()`
- Uses cached `storedoctype` data
- Extracts: `storageDocumentTypes[]` → categories

**`Dv.datasets()`** → Uses `datasetsFromStoredoctype()`
- Uses cached `storedoctype` data
- Extracts: `systemProperties[]` and `storageDocumentTypes[].extendedProperties[]` with `hasValueList`

**`Dv.allProps()`** → Uses `allPropsFromStoredoctype()`
- Uses cached `storedoctype` data
- Combines: `systemProperties[]` + `storageDocumentTypes[].extendedProperties[]`

## Key Differences

### 1. Property IDs
- **Cloud**: Properties use UUIDs (`"uuid-123"`)
- **On-Premise**: Properties use numeric IDs (`"123"`)

### 2. Data Source
- **Cloud**: Uses REST API endpoints (`/dmsconfig/r/.../objectmanagement/...`)
- **On-Premise**: Uses single `storedoctype` endpoint, then extracts from cached data

### 3. O2 Response Format
- **Cloud**: 
  ```json
  {
    "objectProperties": [{ "id": "uuid-123", "value": "..." }],
    "multivalueProperties": [{ "id": "uuid-456", "values": {...} }],
    "systemProperties": [{ "id": "DOCUMENT_ID", "value": "..." }]
  }
  ```
- **On-Premise**:
  ```json
  {
    "extendedProperties": {
      "123": "value",
      "456": { "0": "value1", "1": "value2" },
      "property_filename": "file.pdf"
    }
  }
  ```

### 4. Value Population

**Cloud**:
- Values come from `objectProperties`, `multivalueProperties`, `systemProperties` arrays
- Indexed by UUID

**On-Premise**:
- Values come from `extendedProperties` object (keyed by numeric ID)
- Automatically extracted from O2 response if not provided by host
- Indexed by numeric ID + UUID (via `idMap`)

## Code Flow

```javascript
// EditView.mounted() calls:
const [catP, o2Resp, od] = await Promise.all([
  Dv.catProps(...),    // ← Different implementation based on onPremise
  Dv.o2(...),          // ← Same endpoint, different response format
  Dv.objdefs(...)      // ← Same endpoint
])

// Then:
const o2Index = buildO2ValueIndex(o2Resp, idMap)  // Handles both formats
const dmsProps = dmsPropsFromHost || o2Resp.extendedProperties  // On-premise fallback
const dmsIndex = buildIndexFromDmsProperties(dmsProps, idMap)
```

## Summary

| API | Cloud | On-Premise |
|-----|-------|------------|
| `srm()` | ✅ Same | ✅ Same |
| `o2()` | ✅ Same endpoint | ✅ Same endpoint, different format |
| `objdefs()` | ✅ Same | ✅ Same |
| `catProps()` | `/dmsconfig/.../categories/{id}/properties` | `/dms/r/.../storedoctype` (cached) |
| `categories()` | `/dmsconfig/.../categories` | From cached `storedoctype` |
| `datasets()` | `/dmsconfig/.../datasets` | From cached `storedoctype` |
| `validateUpdate()` | ✅ Same | ✅ Same |
| `putO2mUpdate()` | ✅ Same | ✅ Same |

**Main difference**: On-premise uses a single `storedoctype` call (cached) instead of multiple REST endpoints for metadata.
