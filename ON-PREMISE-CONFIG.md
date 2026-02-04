# Configuring On-Premise Mode

## For Local Dev (`npm run dev`)

### Option 1: Environment Variable (Recommended)

Add to `.env.local`:

```bash
# Enable on-premise mode
VITE_ON_PREMISE=true

# Your other config
VITE_BASE_URL=https://your-onprem-instance.d-velop.de
VITE_REPO_ID=your-repo-id
VITE_DOCUMENT_ID=T000000825
VITE_API_KEY=your-api-key
```

Then restart the dev server:
```bash
npm run dev
```

### Option 2: Check Current Config

The dev server will log the configuration when it starts:
```
[vue-app] Mock context from .env.local: {
  base: '/api -> https://your-instance...',
  docId: 'T000000825',
  onPremise: true,  ← This shows if on-premise is enabled
  repoId: '...' || '(auto-detect)'
}
```

## For Tests

### Option 1: Test Config File (`test.config.js`)

```javascript
export const TEST_CONFIG = {
  baseUrl: 'https://your-onprem-instance.d-velop.de',
  repoId: 'your-repo-id',
  documentId: 'T000000825',
  
  // Set to true to test ONLY on-premise
  // Set to false to test ONLY cloud
  // Set to null/undefined to test BOTH (default)
  onPremise: true,  // ← Test on-premise only
  
  // ... other config
}
```

### Option 2: Test Runner UI

1. Open: `http://localhost:5173/tests/test-runner.html`
2. Select **"On-Premise Only"** from the **"On-Premise Mode"** dropdown
3. Fill in your on-premise instance details
4. Click **"Run Tests"**

### Option 3: Environment Variable

```bash
# In .env.local or shell
VITE_TEST_ON_PREMISE=true  # Test on-premise only
# or
VITE_TEST_ON_PREMISE=false # Test cloud only
# or omit to test both
```

## What Changes in On-Premise Mode?

### API Endpoints

**Cloud (`onPremise: false`):**
- Categories: `/dmsconfig/r/{repoId}/objectmanagement/categories`
- Properties: `/dmsconfig/r/{repoId}/objectmanagement/categories/{id}/properties`
- Datasets: `/dmsconfig/r/{repoId}/objectmanagement/datasets`

**On-Premise (`onPremise: true`):**
- Single endpoint: `/dms/r/{repoId}/storedoctype` (cached)
- Extracts categories, properties, datasets from cached response

### Data Format

**Cloud:**
- Properties use UUIDs: `{ id: "uuid-123", ... }`
- O2 response: `{ objectProperties: [...], multivalueProperties: [...] }`

**On-Premise:**
- Properties use numeric IDs: `{ id: "123", ... }`
- O2 response: `{ extendedProperties: { "123": "value", ... } }`
- Values automatically extracted from `extendedProperties`

## Verification

### Check Dev Mode

Look for this in browser console:
```
[vue-app] Mock context from .env.local: {
  onPremise: true  ← Should be true for on-premise
}
```

### Check Tests

Look for this in test output:
```
📡 Fetching API data... (base: /api, onPremise: true)
```

## Troubleshooting

**Q: Dev server still uses cloud mode even with `VITE_ON_PREMISE=true`?**

A: Restart the dev server after changing `.env.local`:
```bash
# Stop server (Ctrl+C)
npm run dev
```

**Q: Tests run both modes even with `onPremise: true`?**

A: Make sure `test.config.js` exports `onPremise: true` (not `null` or `undefined`)

**Q: How do I test against a real on-premise instance?**

A: 
1. Set `VITE_BASE_URL` to your on-premise instance URL
2. Set `VITE_ON_PREMISE=true` in `.env.local`
3. Ensure Vite proxy is configured (already done in `vite.config.js`)
4. Restart dev server
