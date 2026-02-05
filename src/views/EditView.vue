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
                :invalid-fields="invalidFields"
                @submit="onSave"
                @field-updated="onFieldUpdated"
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
  getMultivalueSlotMaps,
  collectSourceProperties,
  buildValidationPayload,
  buildUpdatePayloadFromValidationResponse,
  extractValuesFromValidationResponse,
  putO2Update
} from '@/services/submission'
import { resolveDocIdFromProcess } from '@/utils/docId'
import { mapIdtoUniqueId, idToUniqueIdFromSrm, getNumericIdFromUuid } from '@/utils/idMapping'
import { categoryOnlyProperties as filterCategoryOnly, buildRequiredFromCategoryPropertyRefs } from '@/utils/systemProperties'
import { buildO2ValueIndex, buildIndexFromDmsProperties, buildInitialValuesFromIndex, buildInitialValuesFromO2, extractValuesForUuidFromO2 } from '@/utils/valueExtraction'
import { t } from '@/utils/i18n'
import { log, error } from '@/utils/debug'

export default {
  name: 'EditView',
  components: { CategoryFormView, SystemPropertiesView },
  inject: {
    formInitContext: { default: null },
    rawFetchResponses: { default: null }
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
      /** Category id in both forms; use .simpleId or .uniqueId depending on API/context. */
      categoryId: { simpleId: '', uniqueId: '' },
      onPremise: false,
      // Raw API responses (used for form state, save, and branching)
      raw: {
        srmItem: null,
        o2Response: null,
        category: null, // single category GET .../categories/{id}
        categoryProperties: [],
        objectDefinitions: null
      },
      idMap: {},
      metaIdx: null,
      // Form State (single source of truth)
      formData: {},
      previousValues: {},
      /** Multivalue slot maps from last load/validation: { [uuid]: { "1": "v1", "2": "v2", "6": "v3" } } for exact slot keys */
      previousSlotMaps: {},
      // Validation state (array of UUIDs for invalid fields)
      invalidFields: []
    }
  },
  computed: {
    /** When true, required fields can be bypassed (still marked invalid) but save/validation API is allowed. When false, save is blocked until required fields are filled. */
    allowBypassRequiredFields () {
      return !!this.formInitContext?.allowBypassRequiredFields
    },
    categoryProperties () {
      return this.raw.categoryProperties || []
    },
    systemPropertiesList () {
      const o2 = this.raw.o2Response
      const sp = o2?.systemProperties
      if (Array.isArray(sp)) return sp
      if (sp && typeof sp === 'object')
        return Object.entries(sp).map(([id, value]) => ({ id, value, displayValue: value }))
      return []
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

      // Normalize category ID: SRM can return sourceCategories[0] as object; extract simpleId and uniqueId
      const c3 = firstItem?.sourceCategories?.[0] ?? firstItem?.category
      const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let simpleId = ''
      let uniqueId = ''
      if (typeof c3 === 'string' || typeof c3 === 'number') {
        const s = String(c3).trim()
        if (uuidLike.test(s)) uniqueId = s
        else simpleId = s
      } else if (c3 && typeof c3 === 'object') {
        simpleId = String(c3.id ?? c3.categoryId ?? '').trim()
        uniqueId = String(c3.uuid ?? c3.uniqueId ?? '').trim()
        if (!simpleId && !uniqueId) {
          const fallback = c3.key ?? ''
          if (typeof fallback === 'string' && fallback) {
            if (uuidLike.test(fallback)) uniqueId = fallback
            else simpleId = fallback
          }
        }
      }
      this.categoryId = { simpleId, uniqueId }
      const hasCategory = this.categoryId.simpleId || this.categoryId.uniqueId
      if (!hasCategory) {
        this.error = this.t(this.locale, 'errorNoCategory')
        return
      }
      // catProps: on-prem uses simpleId (storedoctype), cloud uses uniqueId (dmsconfig)
      const onPrem = !!this.formInitContext?.onPremise
      const catIdForApi = onPrem
        ? (this.categoryId.simpleId || this.categoryId.uniqueId)
        : (this.categoryId.uniqueId || this.categoryId.simpleId)

      const [catResp, catP, o2Resp, od] = await Promise.all([
        Dv.category(this.base, this.repoId, catIdForApi),
        Dv.catProps(this.base, this.repoId, catIdForApi),
        Dv.o2(this.base, this.repoId, this.docId),
        Dv.objdefs(this.base, this.repoId)
      ])

      // Category properties response is for the active (document's) category only
      log('[EditView] Category properties API response is for active category:', this.categoryId.simpleId || this.categoryId.uniqueId, '→', (catP.arr || []).length, 'properties')
      
      // Log API response structure to identify correct field name for required status
      if (catP.arr && catP.arr.length > 0) {
        const sampleProp = catP.arr[0]
        const allKeys = Object.keys(sampleProp)
        const possibleRequiredFields = allKeys.filter(k => 
          k.toLowerCase().includes('mandatory') || 
          k.toLowerCase().includes('required') ||
          k.toLowerCase().includes('obligatory')
        )
        log('[EditView] API response - Property keys:', allKeys)
        log('[EditView] API response - Required-related fields found:', possibleRequiredFields)
        if (possibleRequiredFields.length > 0) {
          possibleRequiredFields.forEach(key => {
            log(`[EditView] API response - ${key}:`, sampleProp[key], `(type: ${typeof sampleProp[key]})`)
          })
        } else {
          log('[EditView] API response - No required/mandatory field found in property object')
          log('[EditView] API response - Full sample property:', sampleProp)
        }
      }

      // idMap: numericId -> uuid. Prefer SRM (same on cloud and on-prem), else objdefs.
      const fromSrm = idToUniqueIdFromSrm(srmResp)
      const fromObjdef = mapIdtoUniqueId(od?.raw ?? {})
      this.idMap = (fromSrm?.idToUniqueId || fromObjdef?.idToUniqueId) || {}
      if (fromSrm?.idToUniqueId) log('[EditView] idMap from SRM:', Object.keys(this.idMap).length, 'entries')
      else log('[EditView] idMap from objdefs:', Object.keys(this.idMap).length, 'entries')

      // Fill categoryId.simpleId / uniqueId from idMap if one was missing
      if (!this.categoryId.uniqueId && this.categoryId.simpleId && this.idMap[this.categoryId.simpleId]) {
        this.categoryId.uniqueId = this.idMap[this.categoryId.simpleId]
      }
      if (!this.categoryId.simpleId && this.categoryId.uniqueId) {
        const num = getNumericIdFromUuid(this.idMap, this.categoryId.uniqueId)
        if (num) this.categoryId.simpleId = num
      }

      // Store raw API responses
      this.raw.category = catResp?.raw ?? catResp?.item ?? null
      this.raw.categoryProperties = catP.arr || []
      this.onPremise = !!this.formInitContext?.onPremise
      // Required: cloud uses category.propertyRefs; on-premise uses catProps (extendedProperties.isMandatory, already set).
      if (!this.onPremise) {
        const requiredByRef = buildRequiredFromCategoryPropertyRefs(this.raw.category)
        if (Object.keys(requiredByRef).length) {
          this.raw.categoryProperties.forEach(p => {
            const required = requiredByRef[p.id] ?? requiredByRef[p.uuid]
            if (required !== undefined) p.isMandatory = required
          })
        }
      }
      this.raw.o2Response = o2Resp
      this.raw.objectDefinitions = od?.raw ?? null

      // Send raw responses to app so data can be handled there
      if (this.rawFetchResponses) {
        this.rawFetchResponses.srm = srmResp
        this.rawFetchResponses.category = this.raw.category
        this.rawFetchResponses.categoryProperties = catP.raw
        this.rawFetchResponses.o2 = o2Resp
        this.rawFetchResponses.objectDefinitions = od?.raw ?? null
        if (this.onPremise) {
          this.rawFetchResponses.storedoctype = await Dv.storedoctype(this.base, this.repoId)
        } else {
          this.rawFetchResponses.storedoctype = null
        }
        log('[EditView] Raw fetch responses sent to app:', Object.keys(this.rawFetchResponses))
      }

      log('[EditView] Fetch complete. Mode:', this.onPremise ? 'on-premise' : 'cloud', { raw: this.raw, onPremise: this.onPremise })

      // Log entire category properties response so you can point out mandatory field
      log('[EditView] === FULL CATEGORY PROPERTIES RESPONSE (active category) ===')
      log('[EditView] Raw API response (catP.raw):', catP.raw)
      log('[EditView] Category properties array (43 items) - full JSON:')
      try {
        const fullJson = JSON.stringify(this.raw.categoryProperties, null, 2)
        console.log('[EditView] categoryProperties JSON:\n' + fullJson)
      } catch (e) {
        log('[EditView] JSON.stringify failed:', e)
        console.table(this.raw.categoryProperties)
      }
      log('[EditView] === END CATEGORY PROPERTIES RESPONSE ===')

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
      
      // Populate formData from O2 response — single normalized path (cloud vs on-premise handled inside)
      const { initialValues, multivalueUuids } = buildInitialValuesFromO2(o2Resp, {
        idMap: this.idMap,
        categoryProperties: this.categoryProperties,
        onPremise: this.onPremise
      })
      log('[EditView] Multivalue properties:', multivalueUuids.size, 'fields')

      // Fallback: SRM displayProperties (both modes)
      const srmDp = Array.isArray(this.raw.srmItem?.displayProperties) ? this.raw.srmItem.displayProperties : []
      log('[EditView] SRM displayProperties:', srmDp.length, 'items')
      srmDp.forEach(p => {
        const uuid = this.idMap[p?.id] || p?.id
        const val = p?.displayValue ?? p?.value ?? ''
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
      this.previousSlotMaps = getMultivalueSlotMaps(this.raw.o2Response, this.categoryProperties, this.idMap)
      this.metaIdx = toMetaIndex(this.categoryProperties, { idMap: this.idMap })

      // Log mandatory fields for this document's category only
      const categoryLabel = this.raw.srmItem?.sourceCategories?.[0]?.displayName ?? this.raw.srmItem?.category ?? (this.categoryId.uniqueId || this.categoryId.simpleId)
      const mandatoryFields = (this.categoryProperties || []).filter(p => p && !!p.isMandatory)
      log('[EditView] Document category (mandatory applies only to this):', this.categoryId, categoryLabel)
      if (mandatoryFields.length > 0) {
        log('[EditView] Mandatory fields for this category:', mandatoryFields.length, mandatoryFields.map(p => ({
          id: p.id,
          uuid: this.idMap[p.id] || p.id,
          label: p.name?.en ?? p.displayName ?? p.id
        })))
      } else {
        log('[EditView] Mandatory fields for this category: none (no property has isMandatory === true)')
      }

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
    /**
     * Clear validation error for a field when user updates it.
     */
    onFieldUpdated (uuid) {
      const index = this.invalidFields.indexOf(uuid)
      if (index > -1) {
        this.invalidFields.splice(index, 1)
      }
    },
    /**
     * Validate required fields for this document's category only.
     * Returns true if all mandatory fields (isMandatory === true) are filled.
     */
    validateRequiredFields () {
      this.invalidFields = []
      let isValid = true
      
      const filtered = this.categoryOnlyPropertiesFiltered
      log(`[EditView] Validating required fields for category ${this.categoryId.simpleId || this.categoryId.uniqueId}. Properties: ${filtered.length}`)
      
      for (const prop of filtered) {
        const uuid = this.idMap[prop.id] || prop.id
        const meta = this.metaIdx?.get?.(uuid) || {
          uuid,
          isMulti: !!prop.isMultiValue,
          readOnly: !!prop.isSystemProperty || !!prop.readOnly
        }
        
        // Skip readonly fields
        if (meta.readOnly) continue
        
        // Check if field is required - use isMandatory field from API response
        const isRequired = !!prop.isMandatory
        if (!isRequired) continue
        log(`[EditView] Found required field: uuid=${uuid}, prop.id=${prop.id}, isMandatory=${prop.isMandatory}`)
        
        // Check if field has a value
        const value = this.formData[uuid]
        let hasValue = false
        
        if (meta.isMulti) {
          // For multivalue fields, check if array has at least one non-empty value (supports keyed { key, value }[])
          if (Array.isArray(value)) {
            const vals = value.map(v => (v != null && typeof v === 'object' && 'value' in v) ? v.value : v)
            hasValue = vals.length > 0 && vals.some(v => v != null && String(v).trim() !== '')
          } else if (value != null && value !== '') {
            hasValue = true
          }
        } else {
          // For single-value fields, check if value is not empty
          // Handle empty strings, null, undefined, and whitespace-only strings
          if (value != null && value !== '') {
            const strValue = String(value).trim()
            hasValue = strValue.length > 0
          }
          // Also handle boolean false - it's a valid value
          if (typeof value === 'boolean') {
            hasValue = true
          }
        }
        
        if (!hasValue) {
          this.invalidFields.push(uuid)
          isValid = false
          log(`[EditView] Required field missing: uuid=${uuid}, prop.id=${prop.id}, label=${prop.name?.en || prop.id}`)
        }
      }
      
      log(`[EditView] Validation result: isValid=${isValid}, invalidFields=${this.invalidFields.length}`, this.invalidFields)
      return isValid
    },
    async onSave () {
      if (this.saveLoading || !this.loaded) return
      
      // Always run required-field validation so invalid fields stay marked in the UI
      const requiredValid = this.validateRequiredFields()
      // Unless bypass is allowed, block save when required fields are missing
      if (!requiredValid && !this.allowBypassRequiredFields) {
        const requiredCount = this.invalidFields.length
        const message = requiredCount === 1
          ? this.t(this.locale, 'requiredFieldMissing') || 'Please fill in the required field.'
          : this.t(this.locale, 'requiredFieldsMissing', requiredCount) || `Please fill in ${requiredCount} required fields.`
        this.snackbar = { show: true, text: message, color: 'error' }
        // Scroll to first invalid field
        this.$nextTick(() => {
          const firstInvalidUuid = this.invalidFields[0]
          if (firstInvalidUuid) {
            const element = document.querySelector(`[data-field-uuid="${firstInvalidUuid}"]`)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
              // Try to focus the input inside if it's a v-text-field or v-card
              const input = element.querySelector('input') || element.querySelector('textarea')
              if (input) {
                setTimeout(() => input.focus(), 300)
              }
            }
          }
        })
        return
      }
      
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
          _o2mPrevSlotMap: this.previousSlotMaps,
          _o2Response: this.raw.o2Response,
          _srmItem: this.raw.srmItem
        }
        const objectDefinitionId = this.categoryId.simpleId || getNumericIdFromUuid(this.idMap, this.categoryId.uniqueId)
        const categoryIdForPayload = this.categoryId.uniqueId || this.categoryId.simpleId
        const validationPayload = buildValidationPayload({
          base: this.base,
          repoId: this.repoId,
          documentId: this.docId,
          objectDefinitionId,
          categoryId: categoryIdForPayload,
          form: formLike,
          metaIdx: this.metaIdx,
          catPropsArr: this.categoryProperties,
          idMap: this.idMap,
          o2Response: this.raw.o2Response,
          srmItem: this.raw.srmItem,
          displayValue: '',
          filename: ''
        })

        const lockTokenResult = await Dv.getLockToken(this.base, this.repoId, this.docId)
        if (lockTokenResult.ok) {
          await this.refetchDocument()
          return
        }

        const validationResult = await Dv.validateUpdate(
          this.base,
          this.repoId,
          this.docId,
          validationPayload
        )

        if (!validationResult.ok) {
          const errorData = validationResult.json || {}
          let errorMsg
          if (validationResult.status === 409 || validationResult.status === 412) {
            errorMsg = this.t(this.locale, 'documentEditedByAnotherUser') || 'Document is being edited by another user. Please refresh and try again.'
          } else {
            const details = (errorData.details ?? '').trim()
            const reason = (errorData.reason ?? '').trim()
            errorMsg = details
              || (reason ? (errorData.errorCode ? `[${errorData.errorCode}] ${reason}` : reason) : null)
              || errorData.message
              || errorData.error
              || this.t(this.locale, 'saveFailedWithStatus', validationResult.status)
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
        // Keep previousSlotMaps in sync with validation response (exact slot keys for next save)
        const mvep = validationResponse?.multivalueExtendedProperties
        if (mvep && typeof mvep === 'object') {
          for (const [numericId, valuesObj] of Object.entries(mvep)) {
            const uuid = this.idMap[numericId]
            if (uuid && valuesObj && typeof valuesObj === 'object') {
              this.previousSlotMaps[uuid] = { ...valuesObj }
            }
          }
        }

        const updatePayload = buildUpdatePayloadFromValidationResponse(validationResponse, {
          storeObject: validationPayload.storeObject
        })
        if (!updatePayload) {
          this.snackbar = { show: true, text: this.t(this.locale, 'saveFailedWithStatus', 500) || 'Save failed', color: 'error' }
          return
        }
        const result = await putO2Update({
          base: this.base,
          repoId: this.repoId,
          documentId: this.docId,
          payload: updatePayload,
          apiKey
        })

        if (result.ok) {
          await this.refetchDocument()
          this.invalidFields = []
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
    },
    /**
     * Refetch the document (O2) from the server and refresh form state.
     * Used after save to show what was actually persisted.
     */
    async refetchDocument () {
      if (!this.base || !this.repoId || !this.docId || !this.loaded) return
      const apiKey = import.meta.env.VITE_API_KEY || undefined
      const Dv = createApi({ base: this.base, locale: this.locale, apiKey, onPremise: this.formInitContext?.onPremise })
      const o2Resp = await Dv.o2(this.base, this.repoId, this.docId)
      if (!o2Resp?.id) return
      this.raw.o2Response = o2Resp
      if (this.rawFetchResponses) this.rawFetchResponses.o2 = o2Resp
      const { initialValues, multivalueUuids } = buildInitialValuesFromO2(o2Resp, {
        idMap: this.idMap,
        categoryProperties: this.categoryProperties,
        onPremise: this.onPremise
      })
      const srmDp = Array.isArray(this.raw.srmItem?.displayProperties) ? this.raw.srmItem.displayProperties : []
      srmDp.forEach(p => {
        const uuid = this.idMap[p?.id] || p?.id
        const val = p?.displayValue ?? p?.value ?? ''
        if (uuid && !multivalueUuids.has(uuid) && !initialValues[uuid] && val != null && val !== '') {
          initialValues[uuid] = val
        }
      })
      this.formData = { ...initialValues }
      this.previousValues = makePrevMap(
        this.raw.o2Response,
        this.raw.srmItem,
        this.categoryProperties,
        this.idMap,
        this.formData
      )
      this.previousSlotMaps = getMultivalueSlotMaps(this.raw.o2Response, this.categoryProperties, this.idMap)
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
