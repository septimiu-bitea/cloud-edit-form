# ECM Forms – Vue app

Vue 3 + Vuetify 3 + Options API. No Form.io; form UI is built with Vuetify.

Loaded by the host via `formInit`: the script sets `window.__formInitContext = { form, base, uiLocale, data, mountEl }` and loads this bundle. The app mounts on `context.mountEl` (or `#app` when run standalone).

## Setup

```bash
cd vue-app
npm install
```

## Develop (standalone)

```bash
npm run dev
```

Open http://localhost:5173. Without test env vars, the app shows "Running standalone".

## Test locally with test environment variables

To load a real document from your d.velop/ECM instance (e.g. same as `sections/validation.integration.test.js`):

1. Copy the example env file and set your test values:
   ```bash
   cp .env.development.example .env.local
   ```
2. Edit `.env.local` and set:
   - **VITE_BASE_URL** – base URL of the d.velop instance (e.g. `https://your-instance.d-velop.cloud`)
   - **VITE_REPO_ID** – repository UUID
   - **VITE_DOCUMENT_ID** – document ID to open in the edit view (e.g. `T000000825` or `MW00000001`)
   - **VITE_API_KEY** – (optional) API key for Bearer auth. When set, all requests use `Authorization: Bearer <key>`. Omit to use cookies (`credentials: 'include'`).

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173. The app will inject a mock `__formInitContext` from these env vars and load the document. Use the same base URL, repo ID and document ID as in your integration tests (e.g. from `sections/validation.integration.test.js` or `sections/test.config.js`).

**Note:** `.env.local` is gitignored (never commit API keys). If **VITE_API_KEY** is set, requests use Bearer auth; otherwise they use `credentials: 'include'` (cookies). For cookie auth, use a browser session already logged into the same instance or configure CORS for your test server.

## Build

```bash
npm run build
```

Output in `dist/` (SPA: index.html + hashed assets).

**Single-file bundle (for script-tag loading):**

```bash
npm run build:bundle
```

Produces `dist/assets/vue-app.js` (fixed name). Use this URL in the host’s `sections-vue/config.js`:

`https://septimiu-bitea.github.io/cloud-edit-form/assets/vue-app.js`

The GitHub Actions workflow runs both builds and deploys; the site and `vue-app.js` are both available.

## Use with the ECM host

1. Build and deploy this app so the entry JS is reachable at a URL.
2. In the loader (sections 1 + 13): set `BUNDLE_URL` to that URL (or use `?bundle=...`), and set `BUNDLE_MOUNT_SELECTOR` to the element the app should mount into (e.g. `#vue-app`).
3. When the host calls `formInit(form, data)`, the loader sets `__formInitContext` and loads this bundle; the app mounts and receives context via `inject('formInitContext')`.

## Stack

- Vue 3 (Options API)
- Vuetify 3
- Vite 5
