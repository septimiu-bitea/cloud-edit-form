# Loading the Vue app from the host

Use the **Vue loader** alternative sections: `sections-vue/`. They forward context and load the Vue app script (no Form.io, no iframe).

## 1. Set the Vue app script URL

In **`sections-vue/config.js`**:

```javascript
const BUNDLE_URL = 'https://YOUR-USERNAME.github.io/YOUR-REPO/assets/vue-app.js';
const BUNDLE_MOUNT_SELECTOR = '#vue-app';
```

If the host uses **Cross-Origin-Embedder-Policy** (COEP), loading from GitHub Pages can be blocked (OpaqueResponseBlocking). Then either proxy the script from the host (same-origin URL) or deploy the Vue app to a host that sends `Cross-Origin-Resource-Policy: cross-origin` (e.g. Cloudflare Pages). See **sections-vue/README.md** → “OpaqueResponseBlocking”.

## 2. Load the Vue loader on the host page

Load **config.js** then **entry.js** (in that order), or concatenate them into one script and load that.

The host calls `formInit(form, data)` as usual. The loader sets `window.__formInitContext` and injects a `<script src="BUNDLE_URL">`. The Vue app runs in the same window and reads the context.

## 3. Mount element

Ensure the host page has an element for the app (e.g. `<div id="vue-app"></div>`) or the loader will create one.

See **`sections-vue/README.md`** for full details.
