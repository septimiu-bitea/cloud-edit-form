# Tests

## Validation Payload Tests (`validationPayload.test.js`)

Tests for `buildValidationPayload` (payload for `POST /o2/{documentId}/update/validate`).

**Run in browser** (uses Vite `@` alias):

1. `npm run dev`
2. Open **http://localhost:5173/tests/validation-payload.html** — tests run automatically.
3. To run the **integration test** with real API data: either copy `test.config.example.js` to `test.config.js` and set `baseUrl`, `repoId`, `documentId`, and `skipApiCalls: false`, or fill the form on the validation-payload page and uncheck "Skip API calls". The integration test will fetch SRM, O2, category properties, build the payload from real form data, and call the validate endpoint.
4. On that same page you can re-run with `window.runValidationPayloadTests()` in the console.

Covers:
- Form data keyed by **UUID** (on-premise: `idMap[propId]`) is included in `extendedProperties` / `multivalueExtendedProperties`
- Form data keyed by numeric `propId` fallback
- Read-only properties are skipped
- `systemProperties` from `srmItem`, `storeObject` shape, `eTag`/`lockTokenUrl` from `o2Response`
- PrevMap fallback for single-value when formData is empty

---

## DMS Properties Tests (`dmsProperties.test.js`)

Tests for verifying that `dmsProperties` values are correctly populated in form fields.

## Setup

1. **Copy test config** (optional - can use environment variables instead):
   ```bash
   cp test.config.example.js test.config.js
   ```

2. **Edit `test.config.js`** with your test instance details:
   - `baseUrl`: Your d.velop instance URL
   - `apiKey`: API key (optional - cookies will be used in browser)
   - `repoId`: Repository UUID
   - `documentId`: Document ID to test with
   - `categoryId`: Category ID (optional - will be auto-detected)

   Or use environment variables:
   - `VITE_BASE_URL`
   - `VITE_API_KEY`
   - `VITE_REPO_ID`
   - `VITE_DOCUMENT_ID`
   - `VITE_CATEGORY_ID`

## Running Tests

### Option 1: Browser Test Runner (Recommended)

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Open test runner:
   ```
   http://localhost:5173/tests/test-runner.html
   ```

3. Fill in configuration and click "Run Tests"

### Option 2: Browser Console

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Open browser console and run:
   ```javascript
   // Tests are auto-loaded, just run:
   window.runDmsPropertiesTests()
   ```

### Option 3: Node.js (Limited)

```bash
npm run test:dmsProperties
```

Note: Node.js execution is limited due to ES modules. Browser testing is recommended.

## What the Tests Do

1. **Unit Tests**: Test `buildIndexFromDmsProperties` function:
   - Creates index with numeric IDs
   - Maps numeric IDs to UUIDs via idMap
   - Handles property_ prefixed keys
   - Filters null/empty values from arrays

2. **Integration Test**: Fetches real API data:
   - Fetches category properties
   - Fetches object definitions (for idMap)
   - Builds dmsIndex from mock dmsProperties
   - Verifies values are populated correctly

## Mock Data

The tests use mock `dmsProperties` data that matches the structure you provided:
- Numeric IDs: `"106"`, `"123"`, `"158"`, etc.
- Property names: `"property_owner"`, `"property_filename"`, etc.
- Arrays and single values

## Debugging

The tests include console logging to help debug:
- What dmsProperties are found
- How the dmsIndex is built
- Which values are populated
- Why values might not be found

Check the browser console for detailed output.
