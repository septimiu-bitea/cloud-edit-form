// ============================================================================
// Vue loader — IMPORT mode (new document / upload flow). Use loading.js on edit pages.
// Host: load this script only on the import form page so mode is always correct.
// ============================================================================
if (typeof console !== 'undefined') console.log('[vue-loader-import] loading.import.js loaded');

// --- Config (edit these) ---
/** Vue app script URL (single-file bundle). */
var BUNDLE_URL = 'https://septimiu-bitea.github.io/cloud-edit-form/assets/vue-app.js?v=' + (window.__APP_VERSION || Date.now());
/** CSS selector for the element the Vue app mounts into. */
var BUNDLE_MOUNT_SELECTOR = '#main-container';
/** Set true when running on d.velop on-premise (affects API behavior in the Vue app). */
var ON_PREMISE = true;
/** Fixed repository ID (UUID), or null to resolve from URL. */
var REPO_ID = null;
/** Enable debug logging in the Vue app. */
var DEBUG = false;
/** Import flow: bypass required fields is usually irrelevant until ImportView defines save; kept for parity with edit loader. */
var ALLOW_BYPASS_REQUIRED_FIELDS = false;
/** Auto-trigger: set to true to automatically call formInit when Form.io is detected. */
var AUTO_TRIGGER = true;
// --- End config ---

var vueLoaderFormInitImport = function (form, data) {
  if (typeof console !== 'undefined') console.log('[vue-loader-import] formInit called', { hasForm: !!form, data: data });

  if (!BUNDLE_URL || !BUNDLE_URL.startsWith('http')) {
    if (typeof console !== 'undefined') console.warn('[vue-loader-import] BUNDLE_URL missing or invalid:', BUNDLE_URL);
    return;
  }

  if (window.__formInitContext) {
    if (typeof console !== 'undefined') console.log('[vue-loader-import] formInit already called, skipping');
    return;
  }

  var base = window.location.origin;
  var uiLocale = (window.DV_LANG || navigator.language || 'en').trim();
  var dataObj = Object.assign({}, data || {});

  // Optional docId (e.g. after redirect); import usually starts without one
  var docId = dataObj.docId || (form && form.submission && form.submission.data && form.submission.data.docId);
  if (docId == null && typeof window.resolveDocIdFromProcess === 'function') {
    docId = window.resolveDocIdFromProcess({ log: false });
  }
  if (docId != null) dataObj.docId = docId;

  // Preset category from host: data.categoryId or submission
  var categoryId = dataObj.categoryId ||
    (form && form.submission && form.submission.data && form.submission.data.importCategoryId) ||
    (form && form.submission && form.submission.data && form.submission.data.categoryId);
  if (categoryId != null && dataObj.categoryId == null) dataObj.categoryId = categoryId;

  var dmsProperties = dataObj.dmsProperties ||
    dataObj.data?.dmsProperties ||
    (form && form.submission && form.submission.data && form.submission.data.dmsProperties) ||
    (form && form.data && form.data.dmsProperties) ||
    (typeof window !== 'undefined' && window.DMS_PROPERTIES) ||
    null;
  if (dmsProperties != null) {
    dataObj.dmsProperties = dmsProperties;
    if (typeof console !== 'undefined') console.log('[vue-loader-import] Found dmsProperties:', Object.keys(dmsProperties).length, 'properties');
  }

  var mountEl = null;
  if (BUNDLE_MOUNT_SELECTOR && typeof document !== 'undefined') {
    mountEl = document.querySelector(BUNDLE_MOUNT_SELECTOR);
    if (!mountEl) {
      mountEl = document.createElement('div');
      mountEl.id = BUNDLE_MOUNT_SELECTOR.replace(/^#/, '') || 'vue-app';
      document.body.appendChild(mountEl);
    } else {
      mountEl.innerHTML = '';
    }
    mountEl.style.cssText = 'width:100%;height:100vh;min-height:100vh;box-sizing:border-box;display:block;visibility:visible;overflow:hidden;';
  }

  window.__formInitContext = {
    mode: 'import',
    form: form,
    base: base,
    uiLocale: uiLocale,
    data: dataObj,
    mountEl: mountEl,
    onPremise: !!ON_PREMISE,
    repoId: REPO_ID || null,
    debug: !!DEBUG,
    allowBypassRequiredFields: !!ALLOW_BYPASS_REQUIRED_FIELDS
  };
  if (typeof console !== 'undefined') console.log('[vue-loader-import] context set (mode=import), loading script:', BUNDLE_URL);

  var script = document.createElement('script');
  script.src = BUNDLE_URL;
  script.async = false;
  script.onload = function () {
    if (typeof console !== 'undefined') console.log('[vue-loader-import] script loaded');
  };
  script.onerror = function () {
    if (typeof console !== 'undefined') console.error('[vue-loader-import] script failed to load (404, CORS, or network):', BUNDLE_URL);
  };
  document.head.appendChild(script);
};

window.formInit = vueLoaderFormInitImport;

window.__vueLoaderTrigger = function (form, data) {
  if (typeof console !== 'undefined') console.log('[vue-loader-import] Manual trigger called');
  vueLoaderFormInitImport(form, data);
};

if (typeof console !== 'undefined') {
  setTimeout(function () {
    if (window.formInit !== vueLoaderFormInitImport) {
      console.warn('[vue-loader-import] window.formInit was overwritten after loading.import.js. Load this file after the main app so our formInit is used.');
    } else {
      console.log('[vue-loader-import] formInit is ready. Call window.formInit(form, data) or window.__vueLoaderTrigger(form, data).');
    }
  }, 100);

  if (AUTO_TRIGGER) {
    var triggered = false;
    var checkFormReady = function () {
      if (triggered || window.__formInitContext) return;

      var formioForm = null;
      if (typeof window.Formio !== 'undefined') {
        var formioElements = document.querySelectorAll('[class*="formio"], [id*="formio"], [data-testid*="component"]');
        if (formioElements.length > 0) {
          formioForm = formioElements[0].__formio || formioElements[0].formio;
        }
      }

      var formContainer = document.querySelector('#main-container') ||
        document.querySelector('#dvf-form-viewer') ||
        document.querySelector('.formio-component-form') ||
        document.querySelector('[data-testid*="component"]');

      var formRendered = document.querySelector('.formio-form');

      if (formContainer && (formRendered || formioForm)) {
        triggered = true;
        if (typeof console !== 'undefined') console.log('[vue-loader-import] Auto-detected Form.io ready, calling formInit...');
        vueLoaderFormInitImport(formioForm || null, {});
        return true;
      }

      return false;
    };

    if (!checkFormReady()) {
      var attempts = 0;
      var maxAttempts = 50;
      var pollInterval = setInterval(function () {
        attempts++;
        if (checkFormReady() || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (attempts >= maxAttempts && !triggered) {
            if (typeof console !== 'undefined') console.log('[vue-loader-import] Auto-trigger timeout. Call window.formInit(form, data) manually when ready.');
          }
        }
      }, 200);

      if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function () {
          if (!triggered && checkFormReady()) {
            observer.disconnect();
          }
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'id', 'data-testid']
        });
        setTimeout(function () {
          observer.disconnect();
        }, 10000);
      }
    }
  }
}
