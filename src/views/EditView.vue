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

export default {
  name: 'EditView',
  components: { CategoryFormView, SystemPropertiesView },
  inject: {
    formInitContext: { default: null }
  },
  data () {
    return {
      loading: false,
      error: null,
      loaded: false,
      saveLoading: false,
      docId: '',
      repoId: '',
      categoryId: '',
      base: '',
      locale: 'en',
      categoryProperties: [],
      initialValues: {},
      formData: {},
      idMap: {},
      o2mPrev: {},
      srmItem: null,
      o2Response: null,
      metaIdx: null,
      snackbar: {
        show: false,
        text: '',
        color: 'success'
      },
      activeTab: 'properties',
      showMultivalueOnly: true
    }
  },
  computed: {
    systemPropertiesList () {
      const arr = this.o2Response?.systemProperties
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
    console.log('[EditView] formInitContext:', ctx)
    console.log('[EditView] formInitContext.data:', ctx?.data)
    console.log('[EditView] formInitContext.data?.data:', ctx?.data?.data)
    console.log('[EditView] formInitContext.data?.dmsProperties:', ctx?.data?.dmsProperties)
    console.log('[EditView] formInitContext.data?.data?.dmsProperties:', ctx?.data?.data?.dmsProperties)
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
      this.srmItem = firstItem

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

      const o2Index = buildO2ValueIndex(o2Resp, this.idMap)
      // Host may pass data.dmsProperties (e.g. from backend); use it so standard properties populate on-prem
      const dmsProps = this.formInitContext?.data?.dmsProperties ?? this.formInitContext?.data?.data?.dmsProperties
      console.log('[EditView] dmsProperties from context:', dmsProps)
      console.log('[EditView] idMap size:', Object.keys(this.idMap).length)
      const dmsIndex = buildIndexFromDmsProperties(dmsProps, this.idMap)
      console.log('[EditView] dmsIndex keys:', Object.keys(dmsIndex).slice(0, 20))
      console.log('[EditView] Sample dmsIndex entries:', Object.fromEntries(Object.entries(dmsIndex).slice(0, 5)))
      this.initialValues = buildInitialValuesFromIndex(catP.arr, {
        o2Index,
        srmItem: firstItem,
        idMap: this.idMap,
        dmsIndex: Object.keys(dmsIndex).length ? dmsIndex : null
      })
      console.log('[EditView] initialValues keys:', Object.keys(this.initialValues).slice(0, 20))
      console.log('[EditView] Sample initialValues:', Object.fromEntries(Object.entries(this.initialValues).slice(0, 5)))
      this.categoryProperties = catP.arr || []
      this.o2Response = o2Resp

      this.formData = { ...this.initialValues }
      this.o2mPrev = makePrevMap(
        o2Resp,
        firstItem,
        this.categoryProperties,
        this.idMap,
        this.formData
      )
      this.metaIdx = toMetaIndex(this.categoryProperties, { idMap: this.idMap })
      this.loaded = true
    } catch (e) {
      this.error = e?.message || String(e)
      console.error('[EditView] load failed', e)
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
          this.o2mPrev,
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
          _o2mPrev: this.o2mPrev,
          _o2Response: this.o2Response,
          _srmItem: this.srmItem
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
          o2Response: this.o2Response,
          srmItem: this.srmItem,
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
          originalValues: this.o2mPrev
        })
        if (Object.keys(validatedValues).length > 0) {
          this.formData = { ...this.formData, ...validatedValues }
          for (const [uuid, value] of Object.entries(validatedValues)) {
            const meta = this.metaIdx?.get?.(uuid)
            if (meta?.isMulti) {
              this.o2mPrev[uuid] = Array.isArray(value) ? value : (value != null ? [value] : [])
            } else {
              this.o2mPrev[uuid] = value != null ? String(value) : ''
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
          this.o2mPrev = makePrevMap(
            this.o2Response,
            this.srmItem,
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
        console.error('[EditView] save failed', e)
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
