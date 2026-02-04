<template>
  <v-card class="edit-view-card">
    <v-card-title class="d-flex align-center flex-shrink-0">
      <span>{{ t(locale, 'editDocument') }}</span>
      <v-spacer />
      <v-btn
        v-if="loaded"
        color="primary"
        :loading="saveLoading"
        :disabled="saveLoading"
        @click="onSave"
      >
        {{ t(locale, 'save') }}
      </v-btn>
    </v-card-title>
    <v-card-subtitle v-if="docId" class="flex-shrink-0">{{ t(locale, 'documentId') }}: {{ docId }}</v-card-subtitle>
    <v-card-text class="edit-view-card-text">
      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
      <v-alert v-else-if="error" type="error" variant="tonal" class="mb-4">
        {{ error }}
      </v-alert>
      <template v-else-if="loaded">
        <v-tabs v-model="activeTab" color="primary" class="mb-2 flex-shrink-0">
          <v-tab value="properties">{{ t(locale, 'tabProperties') }}</v-tab>
          <v-tab value="system">{{ t(locale, 'tabSystem') }}</v-tab>
        </v-tabs>
        <v-divider class="mb-3 flex-shrink-0" />
        <v-tabs-window v-model="activeTab" class="edit-view-tabs-window">
          <v-tabs-window-item value="properties" class="edit-view-tab-item mt-2">
            <div class="edit-view-tab-scroll">
              <v-checkbox
                v-model="showMultivalueOnly"
                :label="t(locale, 'showMultivalueOnly')"
                hide-details
                density="compact"
                class="mb-2"
              />
              <CategoryFormView
                v-model="formData"
                :properties="categoryOnlyPropertiesFiltered"
                :id-map="idMap"
                :current-locale="locale"
                delimiter=";"
                :fetch-property-values-from-doc="fetchPropertyValuesFromDoc"
                @submit="onSave"
              />
            </div>
          </v-tabs-window-item>
          <v-tabs-window-item value="system" class="edit-view-tab-item mt-2">
            <div class="edit-view-tab-scroll">
              <SystemPropertiesView :system-properties="systemPropertiesList" :current-locale="locale" />
            </div>
          </v-tabs-window-item>
        </v-tabs-window>
      </template>
    </v-card-text>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="4000"
      location="bottom"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </v-card>
</template>

<script>
import CategoryFormView from '@/components/CategoryFormView.vue'
import SystemPropertiesView from '@/components/SystemPropertiesView.vue'
import { createApi, usedRepoId } from '@/services/api'
import {
  toMetaIndex,
  makePrevMap,
  collectSourceProperties,
  buildValidationPayload,
  buildSourcePropertiesFromValidationResponse,
  extractValuesFromValidationResponse,
  buildO2mPayload,
  putO2mUpdate
} from '@/services/submission'
import { resolveDocIdFromProcess } from '@/utils/docId'
import { mapIdtoUniqueId, getNumericIdFromUuid } from '@/utils/idMapping'
import { categoryOnlyProperties as filterCategoryOnly } from '@/utils/systemProperties'
import { buildO2ValueIndex, buildIndexFromDmsProperties, buildInitialValuesFromIndex, extractValuesForUuidFromO2 } from '@/utils/valueExtraction'
import { t } from '@/utils/i18n'
import { log, error } from '@/utils/debug'

export default {
  name: 'EditView',
  components: { CategoryFormView, SystemPropertiesView },
  inject: {
    formInitContext: { default: null }
  },
  data () {
    return {
      // UI State
      loading: false,
      error: null,
      loaded: false,
      saveLoading: false,
      activeTab: 'properties',
      showMultivalueOnly: true,
      snackbar: {
        show: false,
        text: '',
        color: 'success'
      },
      // Configuration
      base: '',
      locale: 'en',
      repoId: '',
      docId: '',
      categoryId: '',
      // Raw API Responses (needed for save operations)
      raw: {
        srmItem: null,
        o2Response: null,
        categoryProperties: [],
        objectDefinitions: null
      },
      // Mappings
      idMap: {},
      metaIdx: null,
      // Form State (single source of truth)
      formData: {},
      previousValues: {}
    }
  },
  computed: {
    // Normalized category properties (computed from raw)
    categoryProperties () {
      return this.raw.categoryProperties || []
    },
    systemPropertiesList () {
      const arr = this.raw.o2Response?.systemProperties
      return Array.isArray(arr) ? arr : []
    },
    categoryOnlyProperties () {
      return filterCategoryOnly(this.categoryProperties)
    },
    categoryOnlyPropertiesFiltered () {
      const list = this.categoryOnlyProperties
      if (!this.showMultivalueOnly) return list
      return list.filter(p => p?.isMultiValue)
    }
  },
  async mounted () {
    const ctx = this.formInitContext
    log('[EditView] formInitContext:', ctx)
    log('[EditView] formInitContext.data:', ctx?.data)
    log('[EditView] formInitContext.data?.data:', ctx?.data?.data)
    log('[EditView] formInitContext.data?.dmsProperties:', ctx?.data?.dmsProperties)
    log('[EditView] formInitContext.data?.data?.dmsProperties:', ctx?.data?.data?.dmsProperties)
    if (!ctx?.base) {
      this.error = this.t(ctx?.uiLocale || 'en', 'errorNoContext')
      return
    }
    this.base = ctx.base
    this.locale = ctx.uiLocale || 'en'

    const docIdFromForm = ctx.form?.submission?.data?.docId ?? ctx.data?.docId
    const docIdFromProcess =
      typeof window !== 'undefined' && window.resolveDocIdFromProcess
        ? window.resolveDocIdFromProcess({ log: false })
        : resolveDocIdFromProcess({ log: false })
    this.docId = docIdFromForm || docIdFromProcess || ''

    if (!this.docId) {
      this.error = this.t(this.locale, 'errorNoDocId')
      return
    }

    this.loading = true
    this.error = null
    try {
      const apiKey = import.meta.env.VITE_API_KEY || undefined
      const Dv = createApi({ base: this.base, locale: this.locale, apiKey, onPremise: this.formInitContext?.onPremise })
      this.repoId = (this.formInitContext && this.formInitContext.repoId) || usedRepoId(this.base)
      if (!this.repoId) {
        this.error = this.t(this.locale, 'errorNoRepo')
        return
      }

      const srmResp = await Dv.srm(this.base, this.repoId, this.docId)
      const firstItem = Array.isArray(srmResp?.items) ? srmResp.items[0] : null
      if (!firstItem) {
        this.error = this.t(this.locale, 'errorSrmNoItem')
        return
      }
      // Store raw SRM response
      this.raw.srmItem = firstItem

      // Normalize category ID: SRM can return sourceCategories[0] as object; extract string ID (match sections/13-entry-point.js)
      const c3 = firstItem?.sourceCategories?.[0] ?? firstItem?.category
      let catId = ''
      if (typeof c3 === 'string' || typeof c3 === 'number') {
        catId = String(c3)
      } else if (c3 && typeof c3 === 'object') {
        const raw = c3.id ?? c3.categoryId ?? c3.uuid ?? c3.uniqueId ?? c3.key ?? ''
        catId = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : ''
      }
      this.categoryId = (catId || '').trim()
      if (!this.categoryId) {
        this.error = this.t(this.locale, 'errorNoCategory')
        return
      }

      const [catP, o2Resp, od] = await Promise.all([
        Dv.catProps(this.base, this.repoId, this.categoryId),
        Dv.o2(this.base, this.repoId, this.docId),
        Dv.objdefs(this.base, this.repoId)
      ])

      const { idToUniqueId } = mapIdtoUniqueId(od?.raw ?? {})
      this.idMap = idToUniqueId || {}

      // Store raw API responses
      this.raw.categoryProperties = catP.arr || []
      this.raw.o2Response = o2Resp
      this.raw.objectDefinitions = od?.raw ?? null

      // Log O2 response structure for debugging
      log('[EditView] O2 response structure:', {
        hasSystemProperties: !!o2Resp?.systemProperties,
        systemPropertiesType: Array.isArray(o2Resp?.systemProperties) ? 'array' : typeof o2Resp?.systemProperties,
        systemPropertiesLength: Array.isArray(o2Resp?.systemProperties) ? o2Resp.systemProperties.length : Object.keys(o2Resp?.systemProperties || {}).length,
        hasExtendedProperties: !!o2Resp?.extendedProperties,
        extendedPropertiesType: Array.isArray(o2Resp?.extendedProperties) ? 'array' : typeof o2Resp?.extendedProperties,
        extendedPropertiesKeys: o2Resp?.extendedProperties && typeof o2Resp.extendedProperties === 'object' ? Object.keys(o2Resp.extendedProperties).slice(0, 5) : [],
        hasMultivalueExtendedProperties: !!o2Resp?.multivalueExtendedProperties,
        multivalueExtendedPropertiesKeys: o2Resp?.multivalueExtendedProperties && typeof o2Resp.multivalueExtendedProperties === 'object' ? Object.keys(o2Resp.multivalueExtendedProperties).slice(0, 5) : [],
        hasMultivalueProperties: Array.isArray(o2Resp?.multivalueProperties),
        multivaluePropertiesLength: o2Resp?.multivalueProperties?.length || 0,
        multivaluePropertiesSample: o2Resp?.multivalueProperties?.slice(0, 2).map(p => ({ id: p?.id, uuid: p?.uuid, valuesKeys: Object.keys(p?.values || {}).slice(0, 3) })),
        hasObjectProperties: Array.isArray(o2Resp?.objectProperties),
        objectPropertiesLength: o2Resp?.objectProperties?.length || 0
      })
      
      // Populate formData directly from O2 response
      // Strategy: Multivalue fields ONLY from multivalueProperties/multivalueExtendedProperties
      //           Single-value fields from objectProperties/extendedProperties/systemProperties/SRM
      const initialValues = {}
      
      // Build map of multivalue property UUIDs for quick lookup
      const multivalueUuids = new Set()
      this.categoryProperties.forEach(prop => {
        if (prop?.isMultiValue) {
          const uuid = this.idMap[prop.id] || prop.id
          if (uuid) multivalueUuids.add(uuid)
        }
      })
      log('[EditView] Multivalue properties:', multivalueUuids.size, 'fields')
      
      // Process multivalueProperties array: [{ id, uuid, values: { "1": "val1", "2": "val2" } }]
      const mv = Array.isArray(o2Resp?.multivalueProperties) ? o2Resp.multivalueProperties : []
      log('[EditView] multivalueProperties array:', mv.length, 'items')
      mv.forEach((p, i) => {
        const id = String(p?.id ?? '').trim()
        const uuid = p?.uuid || (this.idMap[id] || id)
        const valuesObj = p?.values || {}
        const arr = Object.keys(valuesObj)
          .sort((a, b) => Number(a) - Number(b))
          .map(k => valuesObj[k])
          .filter(v => v != null && String(v).trim() !== '')
        if (uuid) {
          initialValues[uuid] = arr
          log(`[EditView] multivalueProperty[${i}]: id=${id} → uuid=${uuid}`, arr)
        }
      })
      
      // Process multivalueExtendedProperties object: { "159": { "1": "val1", "2": "val2" } }
      const mvep = o2Resp?.multivalueExtendedProperties
      if (mvep && typeof mvep === 'object' && !Array.isArray(mvep)) {
        const keys = Object.keys(mvep)
        log('[EditView] multivalueExtendedProperties object:', keys.length, 'keys')
        for (const [id, valuesObj] of Object.entries(mvep)) {
          const uuid = this.idMap[id] || id
          if (!uuid || !valuesObj || typeof valuesObj !== 'object' || Array.isArray(valuesObj)) continue
          const arr = Object.keys(valuesObj)
            .sort((a, b) => Number(a) - Number(b))
            .map(slot => valuesObj[slot])
            .filter(v => v != null && String(v).trim() !== '')
          initialValues[uuid] = arr
          log(`[EditView] multivalueExtendedProperty: id=${id} → uuid=${uuid}`, arr)
        }
      }
      
      // Process single-value properties: objectProperties array
      const obj = Array.isArray(o2Resp?.objectProperties) ? o2Resp.objectProperties : []
      obj.forEach(p => {
        const uuid = p?.uuid || (this.idMap[p?.id] || p?.id)
        const val = p?.value ?? p?.displayValue ?? ''
        // Skip if this is a multivalue field (already processed above)
        if (uuid && !multivalueUuids.has(uuid) && val != null && val !== '') {
          initialValues[uuid] = val
        }
      })
      
      // Process single-value properties: extendedProperties object (on-premise)
      const ext = o2Resp?.extendedProperties
      if (ext && typeof ext === 'object' && !Array.isArray(ext)) {
        for (const [id, val] of Object.entries(ext)) {
          // Skip slot maps (multivalue format) and null/empty values
          if (val == null || val === '' || (typeof val === 'object' && !Array.isArray(val))) continue
          const uuid = this.idMap[id] || id
          // Skip if this is a multivalue field (already processed above)
          if (uuid && !multivalueUuids.has(uuid) && !initialValues[uuid]) {
            initialValues[uuid] = val
          }
        }
      }
      
      // Process systemProperties array: [{ id, value }]
      const sys = Array.isArray(o2Resp?.systemProperties) ? o2Resp.systemProperties : []
      sys.forEach(p => {
        const k = String(p?.id || '').trim()
        const val = p?.displayValue ?? p?.value ?? ''
        if (k && val != null && val !== '' && !multivalueUuids.has(k)) {
          initialValues[k] = val
        }
      })
      
      // Process systemProperties as object (on-premise)
      if (o2Resp?.systemProperties && typeof o2Resp.systemProperties === 'object' && !Array.isArray(o2Resp.systemProperties)) {
        for (const [k, v] of Object.entries(o2Resp.systemProperties)) {
          if (k && v != null && v !== '' && !multivalueUuids.has(k) && !initialValues[k]) {
            initialValues[k] = v
          }
        }
      }
      
      // Fallback to SRM displayProperties for single-value fields only
      const srmDp = Array.isArray(this.raw.srmItem?.displayProperties) ? this.raw.srmItem.displayProperties : []
      log('[EditView] SRM displayProperties:', srmDp.length, 'items')
      srmDp.forEach(p => {
        const uuid = this.idMap[p?.id] || p?.id
        const val = p?.displayValue ?? p?.value ?? ''
        // Skip if multivalue field or already has value
        if (uuid && !multivalueUuids.has(uuid) && !initialValues[uuid] && val != null && val !== '') {
          initialValues[uuid] = val
        }
      })

      // Set form state (single source of truth)
      this.formData = { ...initialValues }
      
      log('[EditView] formData populated:', {
        totalKeys: Object.keys(this.formData).length,
        multivalueFields: multivalueUuids.size
      })
      
      const multivalueEntries = Object.entries(this.formData).filter(([k, v]) => Array.isArray(v))
      log('[EditView] Multivalue entries in formData:', multivalueEntries.length, multivalueEntries.map(([uuid, arr]) => ({ uuid, length: arr.length })))
      this.previousValues = makePrevMap(
        this.raw.o2Response,
        this.raw.srmItem,
        this.categoryProperties,
        this.idMap,
        this.formData
      )
      this.metaIdx = toMetaIndex(this.categoryProperties, { idMap: this.idMap })
      this.loaded = true
    } catch (e) {
      this.error = e?.message || String(e)
      error('[EditView] load failed', e)
    } finally {
      this.loading = false
    }
  },
  methods: {
    t,
    async onSave () {
      if (this.saveLoading || !this.loaded) return
      this.saveLoading = true
      this.snackbar.show = false
      try {
        const { properties } = collectSourceProperties(
          this.formData,
          this.previousValues,
          this.metaIdx
        )
        if (properties.length === 0) {
          this.snackbar = { show: true, text: this.t(this.locale, 'noChangesToSave'), color: 'info' }
          return
        }

        const apiKey = import.meta.env.VITE_API_KEY || undefined
        const Dv = createApi({
          base: this.base,
          locale: this.locale,
          apiKey,
          onPremise: this.formInitContext?.onPremise
        })
        const formLike = {
          submission: { data: this.formData },
          _o2mPrev: this.previousValues,
          _o2Response: this.raw.o2Response,
          _srmItem: this.raw.srmItem
        }
        const numericCatId = getNumericIdFromUuid(this.idMap, this.categoryId) || this.categoryId
        const validationPayload = buildValidationPayload({
          base: this.base,
          repoId: this.repoId,
          documentId: this.docId,
          objectDefinitionId: numericCatId,
          categoryId: this.categoryId,
          form: formLike,
          metaIdx: this.metaIdx,
          catPropsArr: this.categoryProperties,
          idMap: this.idMap,
          o2Response: this.raw.o2Response,
          srmItem: this.raw.srmItem,
          displayValue: '',
          filename: ''
        })

        const validationResult = await Dv.validateUpdate(
          this.base,
          this.repoId,
          this.docId,
          validationPayload
        )

        if (!validationResult.ok) {
          const errorData = validationResult.json || {}
          let errorMsg = errorData.reason
            ? (errorData.errorCode ? `[${errorData.errorCode}] ${errorData.reason}` : errorData.reason)
            : (errorData.message || errorData.error || this.t(this.locale, 'saveFailedWithStatus', validationResult.status))
          if (validationResult.status === 409 || validationResult.status === 412) {
            errorMsg = this.t(this.locale, 'documentEditedByAnotherUser') || 'Document is being edited by another user. Please refresh and try again.'
          }
          this.snackbar = { show: true, text: errorMsg, color: 'error' }
          return
        }

        const validationResponse = validationResult.json
        const validatedValues = extractValuesFromValidationResponse(validationResponse, {
          idMap: this.idMap,
          catPropsArr: this.categoryProperties,
          originalValues: this.previousValues
        })
        if (Object.keys(validatedValues).length > 0) {
          this.formData = { ...this.formData, ...validatedValues }
          for (const [uuid, value] of Object.entries(validatedValues)) {
            const meta = this.metaIdx?.get?.(uuid)
            if (meta?.isMulti) {
              this.previousValues[uuid] = Array.isArray(value) ? value : (value != null ? [value] : [])
            } else {
              this.previousValues[uuid] = value != null ? String(value) : ''
            }
          }
        }

        const sourceProperties = buildSourcePropertiesFromValidationResponse(validationResponse, {
          idMap: this.idMap,
          catPropsArr: this.categoryProperties,
          metaIdx: this.metaIdx
        })
        const payload = buildO2mPayload({ sourceProperties })
        const result = await putO2mUpdate({
          base: this.base,
          repoId: this.repoId,
          dmsObjectId: this.docId,
          payload,
          apiKey
        })

        if (result.ok) {
          this.previousValues = makePrevMap(
            this.raw.o2Response,
            this.raw.srmItem,
            this.categoryProperties,
            this.idMap,
            this.formData
          )
          this.snackbar = { show: true, text: this.t(this.locale, 'savedSuccessfully'), color: 'success' }
        } else {
          const msg = result.json?.message || result.text || this.t(this.locale, 'saveFailedWithStatus', result.status)
          this.snackbar = { show: true, text: msg, color: 'error' }
        }
      } catch (e) {
        this.snackbar = {
          show: true,
          text: e?.message || String(e),
          color: 'error'
        }
        error('[EditView] save failed', e)
      } finally {
        this.saveLoading = false
      }
    },
    /** For multivalue Import from Doc ID: fetch O2 for docId and return values for propertyId. */
    async fetchPropertyValuesFromDoc (docId, propertyId) {
      if (!docId || !propertyId || !this.base || !this.repoId) return []
      const apiKey = import.meta.env.VITE_API_KEY || undefined
      const Dv = createApi({ base: this.base, locale: this.locale, apiKey, onPremise: this.formInitContext?.onPremise })
      const o2Resp = await Dv.o2(this.base, this.repoId, docId)
      if (!o2Resp?.id) throw new Error('Document not found.')
      const values = extractValuesForUuidFromO2(o2Resp, propertyId, this.idMap || {}, { isMulti: true, dataType: 'STRING' })
      return Array.isArray(values) ? values.map(v => String(v ?? '')) : []
    }
  }
}
</script>

<style scoped>
/* Fixed height: card fills container; only tab content (Standard / System properties) scrolls */
.edit-view-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.edit-view-card-text {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.edit-view-tabs-window {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
/* Vuetify v-tabs-window: inner window uses absolute positioning; give it height so our scroll div works */
.edit-view-tabs-window :deep(.v-window),
.edit-view-tabs-window :deep(.v-window__container) {
  height: 100%;
}
.edit-view-tab-item {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.edit-view-tabs-window :deep(.v-window-item) {
  height: 100%;
  overflow: hidden;
}
.edit-view-tab-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
  /* Fallback so this area scrolls even if flex parent height isn't set (e.g. Vuetify absolute positioning) */
  max-height: calc(100vh - 220px);
  padding-bottom: 1rem;
}
</style>
