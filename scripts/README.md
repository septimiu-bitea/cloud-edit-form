# Vue loader – alternative sections

This folder contains a **minimal** script that only:

1. Builds context (base, uiLocale, docId/data) and sets `window.__formInitContext`
2. Loads the Vue app by injecting a script tag (BUNDLE_URL)

No Form.io, no validation, no iframe. Use this when the host should only load the Vue app and pass context.

## File

- **loading.js** – Standard loader (use this always). Config at the top (BUNDLE_URL, BUNDLE_MOUNT_SELECTOR, ON_PREMISE, REPO_ID) and `window.formInit`. Load this one script after the main app.

## Setup

1. Build the Vue app as a **single script** (e.g. `vue-app.js`) and deploy it. See `vue-app/` for a build that outputs `dist/assets/vue-app.js`.

2. Edit the config at the top of **loading.js**:
   ```javascript
   var BUNDLE_URL = 'https://septimiu-bitea.github.io/cloud-edit-form/assets/vue-app.js';
   var BUNDLE_MOUNT_SELECTOR = '#main-container';
   var ON_PREMISE = false;
   var REPO_ID = null;
   ```
   If the selector matches an existing element (e.g. `#main-container`), the loader clears it and mounts the Vue app there. Otherwise it creates a div with that id.

3. Load **loading.js** on the host page **after** the main app. The host page should have the mount element (e.g. `#main-container`) or the loader will create one.

4. **On-premise / repo:** Set `ON_PREMISE = true` and optionally `REPO_ID` to a repository UUID. Both are passed to the Vue app in `__formInitContext`.

## Contract

- The host calls `formInit(form, data)`. The loader sets `window.__formInitContext` and then loads the script at BUNDLE_URL.
- The Vue app script runs in the same window and reads `window.__formInitContext`.

## Troubleshooting (nothing happens on tenant)

If you added loading.js to the tenant but nothing happens (no Vue form, no errors):

1. **Open DevTools → Console.** You should see:
   - `[vue-loader] loading.js loaded` → loader ran and set `formInit`.
   - When the form is ready, the **host** must call `formInit(form, data)`; then:
   - `[vue-loader] formInit called` → our loader was invoked.

2. **If you never see "loading.js loaded":** The tenant is not loading loading.js. Add it to the tenant's script list.

3. **If you see "loading.js loaded" but never "formInit called" and no request to GitHub:** Our `formInit` is never invoked. Two causes:
   - **Overwritten:** Another script (usually the main app) sets `window.formInit` after us. You should see: `[vue-loader] window.formInit was overwritten after loading.js`. **Fix:** Load **loading.js after** the main app.
   - **Never called:** The host/platform never calls `formInit(form, data)`. The tenant flow must call it when the form is ready.

4. **Script order:** Load **loading.js after** the main app so our `formInit` is the one that stays.

## Troubleshooting (nothing loads)

1. **Open DevTools (F12) → Console.** The loader logs:
   - `[vue-loader] formInit called` → formInit is being invoked.
   - `[vue-loader] context set, loading script: ...` → context set, script tag added.
   - `[vue-loader] script loaded` → script fetched and ran.
   - `[vue-loader] script failed to load` → 404, CORS, or network error; check Network tab for the vue-app.js request.

2. **Is formInit actually called?** If you never see `formInit called`, the host page is not calling `formInit(form, data)`. Wire the loader so it runs when the form is ready (e.g. after Form.io createForm, then `formInit(form, data)`).

3. **Does the script URL load?** Open `https://septimiu-bitea.github.io/cloud-edit-form/assets/vue-app.js` in a new tab. You should see JavaScript. If 404, run the Vue repo's build + deploy (e.g. push with the workflow that runs `build:bundle`).

4. **Script order:** Load **loading.js after** the main app. The loader logs a warning if it detects it was overwritten.

## OpaqueResponseBlocking / "Loading failed" for the script

If the host page sends **Cross-Origin-Embedder-Policy** (COEP), the browser blocks cross-origin scripts unless they send **Cross-Origin-Resource-Policy: cross-origin**. **GitHub Pages does not allow custom headers**, so the script from GitHub Pages can be blocked and you see:

- "A resource is blocked by OpaqueResponseBlocking"
- "Loading failed for the &lt;script&gt; with source …"

**Options:**

1. **Proxy the script from the host (recommended)**  
   Have the host app serve the Vue script from the **same origin** (e.g. `https://your-host.example/app/vue-app.js`). That route fetches `https://septimiu-bitea.github.io/cloud-edit-form/assets/vue-app.js` and returns it with `Content-Type: application/javascript` and optionally `Cross-Origin-Resource-Policy: cross-origin`.    In **loading.js** set:
   ```javascript
   var BUNDLE_URL = 'https://your-host.example/app/vue-app.js';  // same origin as the page
   ```
   Then the script is same-origin and COEP does not block it.

2. **Use a host that supports response headers**  
   Deploy the Vue app to **Cloudflare Pages** or **Netlify** (instead of GitHub Pages). The repo includes `vue-app/public/_headers` so `/assets/*` is served with `Cross-Origin-Resource-Policy: cross-origin`. Point `BUNDLE_URL` at that deployment.

3. **Relax COEP on the embedding page**  
   If the host can avoid sending `Cross-Origin-Embedder-Policy` on the page that embeds the form, the script will load from GitHub Pages without changes. This may not be possible if other features depend on COEP.
