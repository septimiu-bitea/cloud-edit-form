# Loading the Vue app from the host

Use the **Vue loader** alternative sections: `sections-vue/`. They forward context and load the Vue app script (no Form.io, no iframe).

## 1. Configure and load the Vue loader

Edit the config at the top of **`sections-vue/loading.js`** (or **`scripts/loading.js`** / **`scripts/loading.import.js`** in this repo: same knobs). Load **`loading.js` on edit pages** and **`loading.import.js` on import pages** **after** the main app—one loader per page so **`__formInitContext.mode`** is `'edit'` or `'import'`.

If the host uses **Cross-Origin-Embedder-Policy** (COEP), loading from GitHub Pages can be blocked. Then either proxy the script from the host (same-origin URL) or use a host that sends CORP. See **sections-vue/README.md** → “OpaqueResponseBlocking”.

## 2. Contract

The host calls `formInit(form, data)` as usual. The loader sets `window.__formInitContext` and injects a `<script src="BUNDLE_URL">`. The Vue app runs in the same window and reads the context.

### Context options

- **`mode`**: `'edit'` or `'import'` — set by which loader script the page includes.
- **`allowBypassRequiredFields`** (boolean, optional): If `true`, required fields can be bypassed on save—they are still marked as invalid in the UI, but the validation/save API is called. If `false` or omitted, save is blocked until all required fields are filled (default behaviour). When using **scripts/loading.js**, set **`ALLOW_BYPASS_REQUIRED_FIELDS = true`** at the top of that file to enable.

## 3. Mount element

The host page should have the mount element (e.g. `#main-container`); the loader clears it and mounts the Vue app there, or creates a div if missing.

See **`sections-vue/README.md`** for full details.
