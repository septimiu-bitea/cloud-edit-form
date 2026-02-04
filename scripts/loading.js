// ============================================================================
// Vue loader – config + formInit. One file: edit options at the top, then load this script.
// ============================================================================
if (typeof console !== 'undefined') console.log('[vue-loader] loading.js loaded');

// --- Config (edit these) ---
/** Vue app script URL (single-file bundle). */
var BUNDLE_URL = 'https://septimiu-bitea.github.io/cloud-edit-form/assets/vue-app.js?v=' + (window.__APP_VERSION || Date.now());
/** CSS selector for the element the Vue app mounts into. Use #main-container to replace the default form area. */
var BUNDLE_MOUNT_SELECTOR = '#main-container';
/** Set true when running on d.velop on-premise (affects API behavior in the Vue app). */
var ON_PREMISE = true;
/** Fixed repository ID (UUID), or null to resolve from URL. */
var REPO_ID = null;
/** Enable debug logging in the Vue app (console.log, console.warn, etc.). */
var DEBUG = false;
/** Auto-trigger: set to true to automatically call formInit when Form.io is detected. */
var AUTO_TRIGGER = true;
// --- End config ---

var vueLoaderFormInit = function (form, data) {
  if (typeof console !== 'undefined') console.log('[vue-loader] formInit called', { hasForm: !!form, data: data });

  if (!BUNDLE_URL || !BUNDLE_URL.startsWith('http')) {
    if (typeof console !== 'undefined') console.warn('[vue-loader] BUNDLE_URL missing or invalid:', BUNDLE_URL);
    return;
  }

  // Prevent multiple calls
  if (window.__formInitContext) {
    if (typeof console !== 'undefined') console.log('[vue-loader] formInit already called, skipping');
    return;
  }

  var base = window.location.origin;
  var uiLocale = (window.DV_LANG || navigator.language || 'en').trim();
  var dataObj = Object.assign({}, data || {});
  var docId = dataObj.docId || (form && form.submission && form.submission.data && form.submission.data.docId);
  if (docId == null && typeof window.resolveDocIdFromProcess === 'function') {
    docId = window.resolveDocIdFromProcess({ log: false });
  }
  if (docId != null) dataObj.docId = docId;
  
  // Extract dmsProperties from common locations (similar to docId extraction)
  var dmsProperties = dataObj.dmsProperties || 
                      dataObj.data?.dmsProperties ||
                      (form && form.submission && form.submission.data && form.submission.data.dmsProperties) ||
                      (form && form.data && form.data.dmsProperties) ||
                      (typeof window !== 'undefined' && window.DMS_PROPERTIES) ||
                      null;
  if (dmsProperties != null) {
    dataObj.dmsProperties = dmsProperties;
    if (typeof console !== 'undefined') console.log('[vue-loader] Found dmsProperties:', Object.keys(dmsProperties).length, 'properties');
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
    form: form,
    base: base,
    uiLocale: uiLocale,
    data: dataObj,
    mountEl: mountEl,
    onPremise: !!ON_PREMISE,
    repoId: REPO_ID || null,
    debug: !!DEBUG
  };
  if (typeof console !== 'undefined') console.log('[vue-loader] context set, loading script:', BUNDLE_URL);

  var script = document.createElement('script');
  script.src = BUNDLE_URL;
  script.async = false;
  script.onload = function () {
    if (typeof console !== 'undefined') console.log('[vue-loader] script loaded');
  };
  script.onerror = function () {
    if (typeof console !== 'undefined') console.error('[vue-loader] script failed to load (404, CORS, or network):', BUNDLE_URL);
  };
  document.head.appendChild(script);
};

window.formInit = vueLoaderFormInit;

// Expose manual trigger for testing/debugging
window.__vueLoaderTrigger = function (form, data) {
  if (typeof console !== 'undefined') console.log('[vue-loader] Manual trigger called');
  vueLoaderFormInit(form, data);
};

if (typeof console !== 'undefined') {
  setTimeout(function () {
    if (window.formInit !== vueLoaderFormInit) {
      console.warn('[vue-loader] window.formInit was overwritten after loading.js. Load loading.js after the main app so our formInit is used.');
    } else {
      console.log('[vue-loader] formInit is ready. Call window.formInit(form, data) or window.__vueLoaderTrigger(form, data) to load the Vue app.');
    }
  }, 100);
  
  // Auto-trigger: try multiple detection strategies
  if (AUTO_TRIGGER) {
    var triggered = false;
    var checkFormReady = function () {
      if (triggered || window.__formInitContext) return;
      
      // Strategy 1: Check for Form.io form instance in common locations
      var formioForm = null;
      if (typeof window.Formio !== 'undefined') {
        // Look for Form.io instances
        var formioElements = document.querySelectorAll('[class*="formio"], [id*="formio"], [data-testid*="component"]');
        if (formioElements.length > 0) {
          formioForm = formioElements[0].__formio || formioElements[0].formio;
        }
      }
      
      // Strategy 2: Check for form container elements
      var formContainer = document.querySelector('#main-container') || 
                          document.querySelector('#dvf-form-viewer') ||
                          document.querySelector('.formio-component-form') ||
                          document.querySelector('[data-testid*="component"]');
      
      // Strategy 3: Check if form has been rendered (has formio-form class)
      var formRendered = document.querySelector('.formio-form');
      
      if (formContainer && (formRendered || formioForm)) {
        triggered = true;
        if (typeof console !== 'undefined') console.log('[vue-loader] Auto-detected Form.io ready, calling formInit...');
        vueLoaderFormInit(formioForm || null, {});
        return true;
      }
      
      return false;
    };
    
    // Try immediately
    if (!checkFormReady()) {
      // Poll every 200ms for up to 10 seconds
      var attempts = 0;
      var maxAttempts = 50;
      var pollInterval = setInterval(function () {
        attempts++;
        if (checkFormReady() || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (attempts >= maxAttempts && !triggered) {
            if (typeof console !== 'undefined') console.log('[vue-loader] Auto-trigger timeout. Form.io may not be ready yet. Call window.formInit(form, data) manually when ready.');
          }
        }
      }, 200);
      
      // Also listen for DOM mutations (form might be added dynamically)
      if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function (mutations) {
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
        
        // Disconnect after 10 seconds
        setTimeout(function () {
          observer.disconnect();
        }, 10000);
      }
    }
  }
}
