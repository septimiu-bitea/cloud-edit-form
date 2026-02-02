# Loading the Vue app from the host

Use the **Vue loader** alternative sections: `sections-vue/`. They only forward context and load the Vue app in an iframe (no Form.io, no validation).

## 1. Set your GitHub Pages URL

In **`sections-vue/config.js`**:

```javascript
const BUNDLE_URL = 'https://YOUR-USERNAME.github.io/YOUR-REPO/';
const BUNDLE_MOUNT_SELECTOR = '#vue-app';
```

## 2. Load the Vue loader on the host page

Load **config.js** then **entry.js** (in that order), or concatenate them into one script (e.g. `vue-loader.js`) and load that.

The host calls `formInit(form, data)` as usual. The loader builds context (base, uiLocale, docId from form/data/process), creates an iframe with `BUNDLE_URL`, and posts the context to the Vue app via `postMessage`.

## 3. Mount element

Ensure the host page has an element for the iframe (e.g. `<div id="vue-app"></div>`) or the loader will create one.

See **`sections-vue/README.md`** for full details.
