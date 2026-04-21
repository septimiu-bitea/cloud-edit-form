<template>
  <div class="import-view-root">
    <PoweredByStrip :locale="locale" variant="flat">
      <template #prepend>
        <span class="text-h6 font-weight-semibold">{{ t(locale, 'importViewTitle') }}</span>
      </template>
    </PoweredByStrip>

    <div v-if="pageLoading" class="import-view-body">
      <div class="import-state-block">
        <v-progress-linear indeterminate color="primary" rounded height="6" class="mb-2" />
        <p class="text-body-2 text-medium-emphasis text-center mb-0">{{ t(locale, 'importPageLoadingHint') }}</p>
      </div>
    </div>
    <div v-else-if="pageError" class="import-view-body">
      <v-alert type="error" variant="tonal" class="mb-0 rounded-0" border="start">
        {{ pageError }}
      </v-alert>
    </div>
    <div v-else class="import-body-wrap">
      <div class="import-view-body">
        <transition :name="pilotSuggestLoading ? 'form-shell-none' : 'form-shell'" appear>
          <div class="import-form-root">
            <div class="import-form-shell">
              <div class="import-main-split">
                <transition name="import-preview-panel">
                  <div
                    v-if="resolvedFile"
                    key="import-preview-rail"
                    class="import-preview-rail"
                  >
                    <aside
                      class="import-preview-aside"
                      :aria-label="t(locale, 'importPreviewTitle')"
                    >
                      <div class="text-subtitle-2 mb-2 text-medium-emphasis">
                        {{ t(locale, 'importPreviewTitle') }}
                      </div>
                      <div class="import-preview-frame import-preview-portrait">
                        <div
                          v-if="previewLoading"
                          class="import-preview-state py-10 text-center"
                        >
                          <v-progress-circular
                            indeterminate
                            color="primary"
                            size="40"
                            width="3"
                          />
                          <p class="text-body-2 text-medium-emphasis mt-3 mb-0">
                            {{ t(locale, 'importPreviewLoading') }}
                          </p>
                        </div>
                        <v-alert
                          v-else-if="previewUnsupportedMime"
                          type="info"
                          variant="tonal"
                          density="compact"
                          class="mb-0 rounded-0"
                        >
                          {{ t(locale, 'importPreviewUnsupported') }}
                        </v-alert>
                        <template v-else>
                          <div class="import-preview-zoom-toolbar">
                            <v-btn
                              icon
                              variant="text"
                              size="small"
                              density="compact"
                              class="import-preview-zoom-btn"
                              :aria-label="t(locale, 'importPreviewZoomOut')"
                              :disabled="previewZoomClamped <= previewZoomMin"
                              @click="previewZoomStep(-1)"
                            >
                              <v-icon size="20">mdi-magnify-minus-outline</v-icon>
                            </v-btn>
                            <span
                              class="text-caption text-medium-emphasis import-preview-zoom-pct"
                              :title="t(locale, 'importPreviewZoomWheelHint')"
                            >
                              {{ previewZoomPercentLabel }}
                            </span>
                            <v-btn
                              icon
                              variant="text"
                              size="small"
                              density="compact"
                              class="import-preview-zoom-btn"
                              :aria-label="t(locale, 'importPreviewZoomIn')"
                              :disabled="previewZoomClamped >= previewZoomMax"
                              @click="previewZoomStep(1)"
                            >
                              <v-icon size="20">mdi-magnify-plus-outline</v-icon>
                            </v-btn>
                            <v-btn
                              icon
                              variant="text"
                              size="small"
                              density="compact"
                              class="import-preview-zoom-btn"
                              :aria-label="t(locale, 'importPreviewZoomReset')"
                              @click="previewZoomReset"
                            >
                              <v-icon size="20">mdi-fit-to-screen-outline</v-icon>
                            </v-btn>
                          </div>
                          <div
                            class="import-preview-zoom-scroller"
                            @wheel="onPreviewWheelZoom"
                          >
                            <div
                              class="import-preview-zoom-inner"
                              :style="previewZoomInnerStyle"
                            >
                              <iframe
                                v-if="importPreviewKind === 'pdf' && previewBlobUrl"
                                :src="previewBlobUrl"
                                class="import-preview-iframe"
                                :title="t(locale, 'importPreviewTitle')"
                              />
                              <div
                                v-else-if="importPreviewKind === 'image' && previewBlobUrl"
                                class="import-preview-image-wrap"
                              >
                                <img
                                  v-if="!previewImageError"
                                  :src="previewBlobUrl"
                                  alt=""
                                  class="import-preview-img"
                                  @error="previewImageError = true"
                                />
                                <v-alert
                                  v-else
                                  type="info"
                                  variant="tonal"
                                  density="compact"
                                  class="mb-0 ma-0 rounded-0"
                                >
                                  {{ t(locale, 'importPreviewImageUnavailable') }}
                                </v-alert>
                              </div>
                              <div
                                v-else-if="importPreviewKind === 'text'"
                                class="import-preview-text-wrap"
                              >
                                <v-alert
                                  v-if="previewTextTruncated"
                                  type="info"
                                  variant="tonal"
                                  density="compact"
                                  class="mb-0 rounded-0 import-preview-trunc-bar"
                                >
                                  {{ importPreviewTruncatedHint }}
                                </v-alert>
                                <pre class="import-preview-pre">{{ previewText }}</pre>
                              </div>
                            </div>
                          </div>
                        </template>
                      </div>
                    </aside>
                  </div>
                </transition>
                <div class="import-form-main">
                  <div class="import-file-ai-row mb-2">
                    <div class="import-file-ai-field">
                      <v-file-input
                        v-model="fileModel"
                        :accept="pilotFileAccept"
                        :label="t(locale, 'importFileLabel')"
                        :aria-label="t(locale, 'importFileAria')"
                        :disabled="importLoading || pilotSuggestLoading"
                        prepend-icon="mdi-paperclip"
                        variant="outlined"
                        density="comfortable"
                        show-size
                        :hide-details="false"
                        :error="pilotFileOverMaxBytes"
                        :error-messages="pilotFileTooLargeHintMessage"
                        class="mb-0 import-file-input-ai-pair"
                        color="primary"
                      />
                    </div>
                    <transition name="import-pilot-btn" appear>
                      <div v-if="resolvedFile" class="import-pilot-col">
                        <v-tooltip location="top" :text="t(locale, 'importPilotSuggest')">
                          <template #activator="{ props: tipProps }">
                            <v-btn
                              v-bind="tipProps"
                              icon
                              variant="tonal"
                              color="secondary"
                              size="x-large"
                              class="quantum-pilot-wrap import-pilot-btn flex-shrink-0"
                              :aria-label="t(locale, 'importPilotSuggest')"
                              :disabled="!canPilotSuggest"
                              :loading="pilotSuggestLoading"
                              @click="runPilotSuggest"
                            >
                              <v-icon size="26">mdi-robot-outline</v-icon>
                            </v-btn>
                          </template>
                        </v-tooltip>
                      </div>
                    </transition>
                  </div>

                  <template v-if="resolvedFile">
                <v-select
                  v-model="selectedCategoryId"
                  :items="categorySelectItems"
                  item-title="title"
                  item-value="value"
                  :label="t(locale, 'importCategoryLabel')"
                  variant="outlined"
                  density="comfortable"
                  class="import-category-select"
                  clearable
                  color="primary"
                  :disabled="importLoading || pilotSuggestLoading"
                  @update:model-value="onCategoryIdChange"
                />

                <transition name="import-category-panel" appear mode="out-in">
                  <div
                    v-if="selectedCategoryId"
                    :key="selectedCategoryId"
                    class="import-category-stack"
                  >
                    <transition
                      :name="pilotSuggestLoading ? 'form-shell-none' : 'form-shell'"
                      mode="out-in"
                    >
                      <div
                        v-if="categoryPropsLoading && !pilotSuggestLoading"
                        key="cat-loading"
                        class="import-fields-panel py-8 text-center"
                      >
                        <v-progress-circular
                          indeterminate
                          color="primary"
                          size="52"
                          width="4"
                          class="mb-4"
                        />
                        <p class="text-body-1 text-medium-emphasis mb-1">
                          {{ t(locale, 'importCategoryFieldsLoading') }}
                        </p>
                        <p class="text-body-2 text-medium-emphasis mb-0 import-subtle">
                          {{ t(locale, 'importCategoryFieldsLoadingSub') }}
                        </p>
                      </div>
                      <CategoryFormView
                        v-else-if="!categoryPropsLoading && categoryPropertiesFiltered.length"
                        :key="'cat-form-' + selectedCategoryId"
                        v-model="formData"
                        :properties="categoryPropertiesFiltered"
                        :id-map="idMap"
                        :current-locale="locale"
                        delimiter=";"
                        :fetch-property-values-from-doc="fetchPropertyValuesFromDoc"
                        :invalid-fields="invalidFields"
                        :locked="pilotSuggestLoading"
                        show-required-hints
                        :dataset-options-by-data-set-id="datasetOptionsByDataSetId"
                        @field-updated="onFieldUpdated"
                      />
                      <v-alert
                        v-else-if="!categoryPropsLoading"
                        key="no-props"
                        type="info"
                        variant="tonal"
                        rounded="0"
                        class="mb-0"
                        border="start"
                      >
                        {{ t(locale, 'importNoProperties') }}
                      </v-alert>
                    </transition>
                  </div>
                </transition>

                <transition name="import-submit-btn">
                  <div
                    v-if="showImportSubmitButton"
                    class="import-submit-row d-flex justify-end mt-4 pt-2"
                  >
                    <div class="import-submit-btn-wrap">
                      <v-btn
                        color="primary"
                        size="large"
                        class="px-6 import-footer-import-btn"
                        :disabled="importImportDisabled"
                        :aria-busy="importLoading"
                        @click="runImport"
                      >
                        {{ importSubmitButtonLabel }}
                      </v-btn>
                      <v-progress-linear
                        v-if="importLoading"
                        class="import-btn-ltr-progress"
                        :model-value="uploadProgressForLinear"
                        :indeterminate="importLinearIndeterminate"
                        height="3"
                        rounded
                        color="primary"
                      />
                    </div>
                  </div>
                </transition>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <transition name="pilot-overlay">
        <div
          v-if="pilotSuggestLoading"
          class="import-pilot-overlay-full"
          role="status"
          aria-live="polite"
        >
          <div class="import-pilot-matrix-bg" aria-hidden="true" />
          <div class="import-pilot-overlay-panel quantum-pilot-overlay-panel import-pilot-overlay-card">
            <div class="import-pilot-tech-log">
              <div
                v-for="(line, idx) in pilotLogLines"
                :key="idx"
                class="import-pilot-tech-line"
              >
                {{ line }}
              </div>
            </div>
            <v-progress-circular
              indeterminate
              color="primary"
              size="44"
              width="3"
              class="mt-3 import-pilot-overlay-spinner"
            />
          </div>
        </div>
      </transition>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="4000" location="bottom">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script>
import CategoryFormView from '@/components/CategoryFormView.vue'
import PoweredByStrip from '@/components/PoweredByStrip.vue'
import { createApi, usedRepoId } from '@/services/api'
import {
  uploadFileInChunks,
  createDocumentO2M,
  extractDocumentIdFromO2mResponse,
  buildO2mCreatePayload,
  applyCategoryMandatoryFlags,
  resolveAfterImportUrl,
  sanitizeImportFormDatasetValues
} from '@/services/documentImport'
import { fetchDatasetOptionsMap } from '@/services/datasetOptionsCloud'
import {
  fileToBase64Url,
  buildPilotPromptBody,
  createPromptRequest,
  pollPromptUntilDone,
  extractJsonObject,
  resolveCategoryIdFromPilot,
  pilotPropertiesToFormData,
  buildCategoriesCatalogText,
  buildPropertiesCatalogText,
  defaultStep1Template,
  buildStep2PromptTemplate,
  mergeEnvPromptSuffix,
  resolvePilotDocumentMimeType,
  isPilotDocumentMimeSupported,
  PILOT_FILE_ACCEPT
} from '@/services/pilotPrompts'
import { toMetaIndex } from '@/services/submission'
import { mapIdtoUniqueId } from '@/utils/idMapping'
import { categoryOnlyProperties as filterCategoryOnly } from '@/utils/systemProperties'
import { labelFromName } from '@/utils/fieldBuilding'
import { extractValuesForUuidFromO2 } from '@/utils/valueExtraction'
import { t } from '@/utils/i18n'
import { formatByteSizeShort } from '@/utils/formatByteSize'
import { log, error } from '@/utils/debug'

export default {
  name: 'ImportView',
  components: { CategoryFormView, PoweredByStrip },
  inject: {
    formInitContext: { default: null }
  },
  data () {
    return {
      pageLoading: true,
      pageError: null,
      base: '',
      locale: 'en',
      repoId: '',
      onPremise: false,
      apiKey: undefined,
      categoriesRaw: [],
      categorySelectItems: [],
      selectedCategoryId: null,
      catPropsArr: [],
      idMap: {},
      metaIdx: null,
      formData: {},
      fileModel: null,
      importLoading: false,
      uploadProgress: null,
      invalidFields: [],
      snackbar: { show: false, text: '', color: 'success' },
      /** True while category properties are fetched after user (or preset) picks a type */
      categoryPropsLoading: false,
      /** d.velop Pilot: suggest category + properties from uploaded file */
      pilotSuggestLoading: false,
      /** Document type id from the last successful Pilot run (for re-prompt after user changes category) */
      lastPilotCategoryId: null,
      /** Terminal-style lines for Pilot overlay */
      pilotLogLines: [],
      /** Same as Pilot-allowed MIME + extensions; OS file dialog filter + import validation */
      pilotFileAccept: PILOT_FILE_ACCEPT,
      /** Cloud: `dataSetId` → `{ label, value }[]` for value-list fields */
      datasetOptionsByDataSetId: {},
      /** Blob URL for PDF / image in-browser preview (revoked on change/unmount) */
      previewBlobUrl: null,
      previewText: null,
      previewTextTruncated: false,
      previewLoading: false,
      previewUnsupportedMime: false,
      previewImageError: false,
      /** Max bytes read into memory for plain-text preview */
      importPreviewTextMaxBytes: 200000,
      /** Preview zoom (1 = 100%); inverse-scale wrapper keeps scrollbars usable */
      previewZoom: 1
    }
  },
  watch: {
    resolvedFile: {
      immediate: true,
      async handler (file) {
        this.previewZoom = 1
        this.revokePreviewBlobUrl()
        this.previewText = null
        this.previewTextTruncated = false
        this.previewLoading = false
        this.previewUnsupportedMime = false
        this.previewImageError = false
        if (!file) return

        const mime = resolvePilotDocumentMimeType(file)
        if (!isPilotDocumentMimeSupported(mime)) {
          this.previewUnsupportedMime = true
          return
        }
        if (mime === 'text/plain') {
          this.previewLoading = true
          try {
            const max = this.importPreviewTextMaxBytes
            const slice = file.size > max ? file.slice(0, max) : file
            this.previewText = await slice.text()
            this.previewTextTruncated = file.size > max
          } catch (e) {
            error('[ImportView] text preview read failed', e)
            this.previewUnsupportedMime = true
          } finally {
            this.previewLoading = false
          }
          return
        }
        this.previewBlobUrl = URL.createObjectURL(file)
      }
    },
    fileModel (val) {
      this.lastPilotCategoryId = null
      if (this.onPremise) return
      const f = Array.isArray(val) ? (val[0] || null) : val
      if (f && typeof f.size === 'number' && f.size > this.pilotMaxFileBytes) {
        this.$nextTick(() => {
          this.snackbar = {
            show: true,
            text: this.t(this.locale, 'importPilotFileTooLarge'),
            color: 'warning'
          }
        })
      }
    },
    datasetOptionsByDataSetId: {
      handler () {
        this.applyDatasetSanitize()
      },
      deep: true
    }
  },
  computed: {
    ctx () {
      return this.formInitContext || null
    },
    categoryOnlyPropertiesList () {
      return filterCategoryOnly(this.catPropsArr || [])
    },
    categoryPropertiesFiltered () {
      return this.categoryOnlyPropertiesList
    },
    resolvedFile () {
      const f = this.fileModel
      if (!f) return null
      return Array.isArray(f) ? (f[0] || null) : f
    },
    afterImportTemplate () {
      return (
        this.ctx?.data?.afterImportUrlTemplate ||
        (import.meta.env.VITE_AFTER_IMPORT_URL || '').trim() ||
        null
      )
    },
    pilotMaxFileBytes () {
      const n = Number(import.meta.env.VITE_PILOT_MAX_FILE_BYTES)
      if (Number.isFinite(n) && n > 0) return n
      return 12 * 1024 * 1024
    },
    /** Pilot sends the file as Base64; large files fail — same cap as runPilotSuggest (cloud only). */
    pilotFileOverMaxBytes () {
      if (this.onPremise) return false
      const f = this.resolvedFile
      if (!f || typeof f.size !== 'number') return false
      return f.size > this.pilotMaxFileBytes
    },
    pilotFileTooLargeHintMessage () {
      if (!this.pilotFileOverMaxBytes) return undefined
      return this.t(
        this.locale,
        'importPilotFileTooLargeHint',
        formatByteSizeShort(this.pilotMaxFileBytes)
      )
    },
    canPilotSuggest () {
      if (this.onPremise || !this.resolvedFile || this.pageLoading || this.pageError) return false
      if (this.pilotFileOverMaxBytes) return false
      if (this.importLoading || this.pilotSuggestLoading) return false
      if (this.selectedCategoryId && this.categoryPropsLoading) return false
      return true
    },
    /** True when every mandatory category field has a value (no side effects). */
    mandatorySatisfied () {
      const meta = this.metaIdx
      if (!meta) return true
      for (const prop of this.categoryPropertiesFiltered) {
        if (prop.readOnly || prop.isSystemProperty) continue
        if (!prop.isMandatory) continue
        const uuid = this.idMap[prop.id] || prop.id
        const m = meta?.get?.(String(prop.id)) || meta?.get?.(uuid) || {
          uuid,
          isMulti: !!prop.isMultiValue,
          readOnly: !!prop.readOnly
        }
        if (m.readOnly) continue
        const value = this.formData[uuid]
        let has = false
        if (m.isMulti) {
          if (Array.isArray(value)) {
            const vals = value.map(v => (v != null && typeof v === 'object' && 'value' in v) ? v.value : v)
            has = vals.length > 0 && vals.some(v => v != null && String(v).trim() !== '')
          } else if (value != null && value !== '') has = true
        } else {
          if (value != null && value !== '') {
            has = String(value).trim().length > 0 || typeof value === 'boolean'
          }
        }
        if (!has) return false
      }
      return true
    },
    /** Import CTA only after category fields are loaded and there is at least one field to show. */
    showImportSubmitButton () {
      return !!(
        this.resolvedFile &&
        this.selectedCategoryId &&
        !this.categoryPropsLoading &&
        this.categoryPropertiesFiltered.length > 0
      )
    },
    importImportDisabled () {
      if (this.importLoading || this.pilotSuggestLoading || this.pageLoading || this.pageError) return true
      if (!this.showImportSubmitButton) return true
      return !this.mandatorySatisfied
    },
    /** Upload % and create phase text live on the import button (no separate progress bar). */
    importSubmitButtonLabel () {
      if (!this.importLoading) return this.t(this.locale, 'importSubmit')
      if (this.uploadProgress != null) {
        return this.t(this.locale, 'importUploadingPercent', Math.round(Number(this.uploadProgress)))
      }
      return this.t(this.locale, 'importCreatingDocument')
    },
    /** Bottom LTR strip on import button: real % while chunking, indeterminate while creating. */
    uploadProgressForLinear () {
      if (this.uploadProgress == null) return undefined
      return Math.min(100, Math.max(0, Number(this.uploadProgress)))
    },
    importLinearIndeterminate () {
      return this.importLoading && this.uploadProgress == null
    },
    /** Pilot-supported types: pdf / image / text / null while loading or unsupported */
    importPreviewKind () {
      if (!this.resolvedFile || this.previewUnsupportedMime || this.previewLoading) return null
      const mime = resolvePilotDocumentMimeType(this.resolvedFile)
      if (mime === 'application/pdf') return 'pdf'
      if (mime === 'text/plain') return 'text'
      if (mime.startsWith('image/')) return 'image'
      return null
    },
    importPreviewTruncatedHint () {
      if (!this.previewTextTruncated) return ''
      return this.t(
        this.locale,
        'importPreviewTruncated',
        formatByteSizeShort(this.importPreviewTextMaxBytes)
      )
    },
    previewZoomMin () {
      return 0.25
    },
    previewZoomMax () {
      return 4
    },
    previewZoomClamped () {
      const z = Number(this.previewZoom)
      if (!Number.isFinite(z) || z <= 0) return 1
      return Math.round(Math.min(this.previewZoomMax, Math.max(this.previewZoomMin, z)) * 100) / 100
    },
    previewZoomInnerStyle () {
      const z = this.previewZoomClamped
      const inv = 100 / z
      return {
        transform: `scale(${z})`,
        transformOrigin: 'top left',
        width: `${inv.toFixed(4)}%`,
        minHeight: `${inv.toFixed(4)}%`
      }
    },
    previewZoomPercentLabel () {
      return `${Math.round(this.previewZoomClamped * 100)}%`
    }
  },
  beforeUnmount () {
    this.revokePreviewBlobUrl()
  },
  async mounted () {
    await this.bootstrap()
  },
  methods: {
    t,
    revokePreviewBlobUrl () {
      if (this.previewBlobUrl) {
        URL.revokeObjectURL(this.previewBlobUrl)
        this.previewBlobUrl = null
      }
    },
    previewZoomStep (dir) {
      const step = 0.1
      const z = this.previewZoomClamped + dir * step
      this.previewZoom =
        Math.round(Math.min(this.previewZoomMax, Math.max(this.previewZoomMin, z)) * 100) / 100
    },
    previewZoomReset () {
      this.previewZoom = 1
    },
    onPreviewWheelZoom (e) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const z = this.previewZoomClamped + delta
      this.previewZoom =
        Math.round(Math.min(this.previewZoomMax, Math.max(this.previewZoomMin, z)) * 100) / 100
    },
    pilotPushLog (key) {
      const line = this.t(this.locale, key)
      this.pilotLogLines.push(line)
      if (this.pilotLogLines.length > 18) this.pilotLogLines.shift()
    },
    onFieldUpdated (uuid) {
      const i = this.invalidFields.indexOf(uuid)
      if (i > -1) this.invalidFields.splice(i, 1)
    },
    /** Drop AI/pasted values that are not valid dataset keys (or label match). */
    applyDatasetSanitize () {
      if (!this.catPropsArr.length) return
      this.formData = sanitizeImportFormDatasetValues(
        this.formData,
        this.catPropsArr,
        this.idMap,
        this.datasetOptionsByDataSetId
      )
    },
    validateMandatory () {
      this.invalidFields = []
      const meta = this.metaIdx
      let ok = true
      for (const prop of this.categoryPropertiesFiltered) {
        if (prop.readOnly || prop.isSystemProperty) continue
        if (!prop.isMandatory) continue
        const uuid = this.idMap[prop.id] || prop.id
        const m = meta?.get?.(String(prop.id)) || meta?.get?.(uuid) || {
          uuid,
          isMulti: !!prop.isMultiValue,
          readOnly: !!prop.readOnly
        }
        if (m.readOnly) continue
        const value = this.formData[uuid]
        let has = false
        if (m.isMulti) {
          if (Array.isArray(value)) {
            const vals = value.map(v => (v != null && typeof v === 'object' && 'value' in v) ? v.value : v)
            has = vals.length > 0 && vals.some(v => v != null && String(v).trim() !== '')
          } else if (value != null && value !== '') has = true
        } else {
          if (value != null && value !== '') {
            has = String(value).trim().length > 0 || typeof value === 'boolean'
          }
        }
        if (!has) {
          this.invalidFields.push(uuid)
          ok = false
        }
      }
      return ok
    },
    async bootstrap () {
      const ctx = this.ctx
      if (!ctx?.base) {
        this.pageError = this.t(ctx?.uiLocale || 'en', 'errorNoContext')
        this.pageLoading = false
        return
      }
      this.base = ctx.base
      this.locale = ctx.uiLocale || 'en'
      this.onPremise = !!ctx.onPremise
      this.apiKey = import.meta.env.VITE_API_KEY || undefined

      this.pageLoading = true
      this.pageError = null
      try {
        this.repoId = (ctx.repoId || '').trim() || usedRepoId(this.base)
        if (!this.repoId) {
          this.pageError = this.t(this.locale, 'errorNoRepo')
          return
        }

        const Dv = createApi({
          base: this.base,
          locale: this.locale,
          apiKey: this.apiKey,
          onPremise: this.onPremise
        })

        const [cats, od] = await Promise.all([
          Dv.categories(this.base, this.repoId),
          Dv.objdefs(this.base, this.repoId)
        ])

        const fromOd = mapIdtoUniqueId(od?.raw ?? {})
        this.idMap = fromOd?.idToUniqueId || {}

        let list = Array.isArray(cats?.arr) ? cats.arr : []
        const docTypes = list.filter(c => c?.type === 'DOCUMENT_TYPE')
        if (docTypes.length) list = docTypes
        else if (list.length) {
          log('[ImportView] No DOCUMENT_TYPE categories; using full list')
        }

        this.categoriesRaw = list
        this.categorySelectItems = list.map(c => {
          const id =
            c.id ??
            c.identifier ??
            c.categoryId ??
            c.objectDefinitionId ??
            c.uuid ??
            c.uniqueId ??
            ''
          const title =
            labelFromName(c.name, this.locale) ||
            c.displayName ||
            String(id || '')
          return { value: String(id), title, raw: c }
        }).filter(x => x.value)

        const preset = ctx.data?.categoryId ?? ctx.data?.importCategoryId
        if (preset != null && String(preset).trim()) {
          const p = String(preset).trim()
          if (this.categorySelectItems.some(i => i.value === p)) {
            this.selectedCategoryId = p
            await this.loadCategoryProperties(p)
          }
        }
      } catch (e) {
        this.pageError = e?.message || String(e)
        error('[ImportView] bootstrap failed', e)
      } finally {
        this.pageLoading = false
      }
    },
    async onCategoryIdChange (id) {
      this.formData = {}
      this.invalidFields = []
      this.catPropsArr = []
      this.metaIdx = null
      this.datasetOptionsByDataSetId = {}
      this.categoryPropsLoading = false
      if (id == null || id === '') return
      await this.loadCategoryProperties(id)
    },
    async loadCategoryProperties (categoryIdStr) {
      this.categoryPropsLoading = true
      const Dv = createApi({
        base: this.base,
        locale: this.locale,
        apiKey: this.apiKey,
        onPremise: this.onPremise
      })
      try {
        const catP = await Dv.catProps(this.base, this.repoId, categoryIdStr)
        let arr = catP.arr || []
        if (!this.onPremise) {
          const catSingle = await Dv.category(this.base, this.repoId, categoryIdStr)
          const item = catSingle?.item || catSingle?.raw
          applyCategoryMandatoryFlags(item, arr)
        }
        this.catPropsArr = arr
        this.metaIdx = toMetaIndex(arr, { idMap: this.idMap })
        this.datasetOptionsByDataSetId = {}
        if (arr.length) {
          try {
            this.datasetOptionsByDataSetId = await fetchDatasetOptionsMap({
              base: this.base,
              repoId: this.repoId,
              catPropsArr: arr,
              locale: this.locale,
              apiKey: this.apiKey,
              onPremise: this.onPremise,
              categoryId: categoryIdStr
            })
          } catch (e) {
            error('[ImportView] dataset options failed', e)
          }
        }
        this.formData = sanitizeImportFormDatasetValues(
          this.formData,
          this.catPropsArr,
          this.idMap,
          this.datasetOptionsByDataSetId
        )
      } catch (e) {
        this.catPropsArr = []
        this.metaIdx = null
        this.datasetOptionsByDataSetId = {}
        this.snackbar = {
          show: true,
          text: e?.message || String(e),
          color: 'error'
        }
        error('[ImportView] catProps failed', e)
      } finally {
        this.categoryPropsLoading = false
      }
    },
    categoryTitleForPilot (categoryIdStr) {
      const id = String(categoryIdStr || '').trim()
      if (!id) return ''
      const it = this.categorySelectItems.find(i => i.value === id)
      return (it?.title || id).trim()
    },
    async fetchPropertyValuesFromDoc (docId, propertyId) {
      if (!docId || !propertyId || !this.base || !this.repoId) return []
      const Dv = createApi({
        base: this.base,
        locale: this.locale,
        apiKey: this.apiKey,
        onPremise: this.onPremise
      })
      const o2Resp = await Dv.o2(this.base, this.repoId, docId)
      if (!o2Resp?.id) throw new Error('Document not found.')
      const values = extractValuesForUuidFromO2(o2Resp, propertyId, this.idMap || {}, { isMulti: true, dataType: 'STRING' })
      return Array.isArray(values) ? values.map(v => String(v ?? '')) : []
    },
    async runPilotSuggest () {
      if (this.onPremise) {
        this.snackbar = {
          show: true,
          text: this.t(this.locale, 'importPilotUnavailableOnPrem'),
          color: 'warning'
        }
        return
      }
      const file = this.resolvedFile
      if (!file) {
        this.snackbar = {
          show: true,
          text: this.t(this.locale, 'importPilotNeedFile'),
          color: 'warning'
        }
        return
      }
      if (file.size > this.pilotMaxFileBytes) {
        this.snackbar = {
          show: true,
          text: this.t(this.locale, 'importPilotFileTooLarge'),
          color: 'warning'
        }
        return
      }

      const mime = resolvePilotDocumentMimeType(file)
      if (!isPilotDocumentMimeSupported(mime)) {
        this.snackbar = {
          show: true,
          text: this.t(this.locale, 'importPilotUnsupportedMime'),
          color: 'warning'
        }
        return
      }

      this.pilotLogLines = []
      this.pilotSuggestLoading = true
      try {
        const hadCategorySelectedAtRunStart = !!this.selectedCategoryId
        const blob = file instanceof Blob ? file : file
        this.pilotPushLog('importPilotLogEncode')
        const b64 = await fileToBase64Url(blob)

        let categoryId = this.selectedCategoryId

        if (!categoryId) {
          const catText = buildCategoriesCatalogText(this.categorySelectItems)
          const t1 = mergeEnvPromptSuffix(defaultStep1Template(catText))
          const body1 = buildPilotPromptBody({
            template: t1,
            documentBase64Url: b64,
            documentMimeType: mime
          })
          this.pilotPushLog('importPilotLogStep1')
          const r1 = await createPromptRequest({
            base: this.base,
            apiKey: this.apiKey,
            body: body1
          })
          if (!r1.ok) {
            const msg = r1.json?.detail || r1.json?.title || r1.text?.slice(0, 400) || `HTTP ${r1.status}`
            throw new Error(msg)
          }
          const pid1 = r1.json?.id
          if (!pid1) throw new Error(this.t(this.locale, 'importPilotNoPromptId'))
          this.pilotPushLog('importPilotLogStep1Poll')
          const res1 = await pollPromptUntilDone({
            base: this.base,
            apiKey: this.apiKey,
            promptId: pid1
          })
          const parsed1 = extractJsonObject(res1?.result?.response)
          if (!parsed1) throw new Error(this.t(this.locale, 'importPilotBadJson'))
          this.pilotPushLog('importPilotLogStep1Ok')
          categoryId = resolveCategoryIdFromPilot(parsed1, this.categorySelectItems)
          if (!categoryId) throw new Error(this.t(this.locale, 'importPilotNoCategory'))
          this.formData = {}
          this.invalidFields = []
          this.catPropsArr = []
          this.metaIdx = null
          this.selectedCategoryId = categoryId
          this.pilotPushLog('importPilotLogLoadProps')
          await this.loadCategoryProperties(categoryId)
        }

        const catForStep2 = this.selectedCategoryId
        if (!catForStep2) {
          throw new Error(this.t(this.locale, 'importPilotNoCategory'))
        }
        const propList = this.categoryPropertiesFiltered.filter(p => !p.readOnly)
        const propText = buildPropertiesCatalogText(propList, this.idMap, this.locale)
        const userChangedCategoryAfterPilot =
          hadCategorySelectedAtRunStart &&
          this.lastPilotCategoryId != null &&
          this.lastPilotCategoryId !== catForStep2
        const t2 = mergeEnvPromptSuffix(
          buildStep2PromptTemplate({
            propertiesText: propText,
            categoryId: catForStep2,
            categoryTitle: this.categoryTitleForPilot(catForStep2),
            userChangedCategoryAfterPilot
          })
        )
        const body2 = buildPilotPromptBody({
          template: t2,
          documentBase64Url: b64,
          documentMimeType: mime
        })
        this.pilotPushLog('importPilotLogStep2')
        const r2 = await createPromptRequest({
          base: this.base,
          apiKey: this.apiKey,
          body: body2
        })
        if (!r2.ok) {
          const msg = r2.json?.detail || r2.json?.title || r2.text?.slice(0, 400) || `HTTP ${r2.status}`
          throw new Error(msg)
        }
        const pid2 = r2.json?.id
        if (!pid2) throw new Error(this.t(this.locale, 'importPilotNoPromptId'))
        this.pilotPushLog('importPilotLogStep2Poll')
        const res2 = await pollPromptUntilDone({
          base: this.base,
          apiKey: this.apiKey,
          promptId: pid2
        })
        const parsed2 = extractJsonObject(res2?.result?.response)
        if (!parsed2) throw new Error(this.t(this.locale, 'importPilotBadJson'))
        this.pilotPushLog('importPilotLogMerge')
        const patch = pilotPropertiesToFormData(parsed2, propList, this.idMap)
        this.formData = sanitizeImportFormDatasetValues(
          { ...this.formData, ...patch },
          this.catPropsArr,
          this.idMap,
          this.datasetOptionsByDataSetId
        )
        await this.$nextTick()
        this.validateMandatory()
        this.lastPilotCategoryId = this.selectedCategoryId
        this.snackbar = {
          show: true,
          text: this.t(this.locale, 'importPilotSuccess'),
          color: 'success'
        }
      } catch (e) {
        error('[ImportView] pilot suggest failed', e)
        this.snackbar = {
          show: true,
          text: e?.message || String(e),
          color: 'error'
        }
      } finally {
        this.pilotSuggestLoading = false
        this.pilotLogLines = []
      }
    },
    async runImport () {
      if (!this.validateMandatory()) {
        const n = this.invalidFields.length
        this.snackbar = {
          show: true,
          text: n === 1
            ? (this.t(this.locale, 'requiredFieldMissing'))
            : (this.t(this.locale, 'requiredFieldsMissing', n)),
          color: 'warning'
        }
        return
      }

      const file = this.resolvedFile
      if (!this.selectedCategoryId || !file) {
        this.snackbar = {
          show: true,
          text: this.t(this.locale, 'importMissingFileOrCategory'),
          color: 'warning'
        }
        return
      }

      const mime = resolvePilotDocumentMimeType(file)
      if (!isPilotDocumentMimeSupported(mime)) {
        this.snackbar = {
          show: true,
          text: this.t(this.locale, 'importPilotUnsupportedMime'),
          color: 'warning'
        }
        return
      }

      this.importLoading = true
      this.uploadProgress = 0
      try {
        const fileName = file.name || 'upload.bin'
        const blob = file instanceof Blob ? file : file

        const contentLocationUri = await uploadFileInChunks({
          base: this.base,
          repoId: this.repoId,
          fileBlob: blob,
          fileName,
          apiKey: this.apiKey,
          onProgress: ({ percent }) => {
            this.uploadProgress = Number(percent)
          }
        })
        this.uploadProgress = null

        const payload = buildO2mCreatePayload({
          repoId: this.repoId,
          categoryId: this.selectedCategoryId,
          contentLocationUri,
          fileName,
          formData: this.formData,
          catPropsArr: this.catPropsArr,
          idMap: this.idMap,
          datasetOptionsByDataSetId: this.datasetOptionsByDataSetId
        })

        const result = await createDocumentO2M({
          base: this.base,
          repoId: this.repoId,
          payload,
          apiKey: this.apiKey
        })

        if (!result.ok) {
          const msg = result.json?.message || result.text?.slice(0, 400) || `HTTP ${result.status}`
          throw new Error(msg)
        }

        const documentId = extractDocumentIdFromO2mResponse(result)
        if (!documentId) {
          log('[ImportView] o2m ok but no document id', {
            status: result.status,
            json: result.json,
            text: result.text?.slice(0, 400)
          })
          throw new Error(this.t(this.locale, 'importNoDocumentId'))
        }

        this.snackbar = {
          show: true,
          text: this.t(this.locale, 'importSuccessRedirect'),
          color: 'success'
        }

        const target = resolveAfterImportUrl(
          this.base,
          this.repoId,
          documentId,
          this.afterImportTemplate
        )
        log('[ImportView] redirect after create', target)
        window.location.assign(target)
      } catch (e) {
        error('[ImportView] import failed', e)
        this.snackbar = {
          show: true,
          text: e?.message || String(e),
          color: 'error'
        }
      } finally {
        this.importLoading = false
        this.uploadProgress = null
      }
    }
  }
}
</script>

<style scoped>
.import-view-root {
  width: 100%;
  min-width: 720px;
  max-width: 1440px;
  margin: 0 auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}
.import-body-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
/* No Vuetify :loading — avoids extra spinner + width jump; only bottom bar + disabled state */
.import-footer-import-btn {
  flex-shrink: 0;
  min-width: 15rem;
}
.import-submit-btn-wrap :deep(.import-footer-import-btn) {
  /* Stable width while label switches (Uploading % / Creating…) */
  justify-content: center;
}
/* LTR load strip along bottom of import button (determinate % or indeterminate sweep) */
.import-submit-btn-wrap {
  position: relative;
  display: inline-flex;
  max-width: 100%;
  border-radius: 4px;
  overflow: hidden;
  vertical-align: middle;
}
.import-btn-ltr-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0 !important;
  z-index: 2;
  pointer-events: none;
  border-radius: 0 !important;
}
.import-submit-btn-wrap :deep(.import-btn-ltr-progress .v-progress-linear__background),
.import-submit-btn-wrap :deep(.import-btn-ltr-progress .v-progress-linear__buffer) {
  opacity: 0.35;
}
.import-view-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scroll-behavior: smooth;
  /* Padding formerly from v-card-text */
  padding: 16px 24px;
}
.import-state-block {
  padding: 0.5rem 0 1rem;
}
.import-form-root {
  min-height: 0;
}
.import-form-shell {
  overflow: visible !important;
}
/* Panel below category select: fade + rise when a type is chosen */
.import-category-panel-enter-active {
  transition:
    opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.import-category-panel-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.import-category-panel-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.import-category-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.import-category-stack {
  min-height: 0;
  margin-top: 0;
  padding-top: 0;
}
.import-category-select {
  margin-bottom: 4px !important;
}
/* Import CTA: fade + slide when fields become available (or leave when category cleared / loading) */
.import-submit-btn-enter-active,
.import-submit-btn-leave-active {
  transition:
    opacity 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.import-submit-btn-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.import-submit-btn-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
/* Tight gap: category control → first field row (CategoryFormView adds mt-1 on cols) */
.import-category-stack :deep(.category-form-animate .v-row:first-child .field-col-animate) {
  margin-top: 0 !important;
}
/* Disable form-shell transitions so they do not compete with Pilot overlay */
.form-shell-none-enter-active,
.form-shell-none-leave-active {
  transition: none !important;
}
.form-shell-none-enter-from,
.form-shell-none-leave-to {
  opacity: 1;
  transform: none;
}
.import-pilot-overlay-full {
  position: absolute;
  inset: 0;
  z-index: 24;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(3px) saturate(1.08);
  -webkit-backdrop-filter: blur(3px) saturate(1.08);
  pointer-events: auto;
  will-change: opacity;
}
.import-pilot-matrix-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(34, 211, 238, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(168, 85, 247, 0.05) 1px, transparent 1px);
  background-size: 22px 22px;
  animation: import-matrix-pan 28s linear infinite;
  pointer-events: none;
  opacity: 0.5;
  will-change: background-position;
}
@keyframes import-matrix-pan {
  from {
    background-position: 0 0, 0 0;
  }
  to {
    background-position: 0 220px, 220px 0;
  }
}
.import-pilot-overlay-panel {
  position: relative;
  z-index: 1;
  max-width: min(32rem, 100%);
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform-origin: center center;
  will-change: transform, opacity;
}
.import-pilot-overlay-spinner {
  transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
/* Vue transition root: fade only (card handles motion) */
.pilot-overlay-enter-active {
  transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.pilot-overlay-leave-active {
  transition: opacity 0.42s cubic-bezier(0.4, 0, 0.2, 1);
}
.pilot-overlay-enter-from,
.pilot-overlay-leave-to {
  opacity: 0;
}
/* Inner card: staggered rise (runs while root enters) */
.pilot-overlay-enter-active .import-pilot-overlay-card {
  animation: import-pilot-card-in 0.56s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.pilot-overlay-leave-active .import-pilot-overlay-card {
  animation: import-pilot-card-out 0.38s cubic-bezier(0.4, 0, 0.2, 1) both;
}
@keyframes import-pilot-card-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes import-pilot-card-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
}
.import-pilot-overlay-full :deep(.quantum-pilot-overlay-panel::after) {
  background: rgba(8, 12, 20, 0.94) !important;
}
.import-pilot-tech-log {
  width: 100%;
  max-height: 14rem;
  overflow-y: auto;
  scroll-behavior: smooth;
  padding: 0.25rem 0.4rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: left;
}
.import-pilot-tech-line {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(34, 211, 238, 0.92);
  text-shadow: 0 0 10px rgba(34, 211, 238, 0.35);
  word-break: break-word;
}
/* Left portrait preview + form: file row stays full width above */
.import-main-split {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 1.25rem;
  min-height: 0;
  width: 100%;
}
/* Rail: width reveals from the left like a drawer; inner aside slides in */
.import-preview-rail {
  flex: 0 0 auto;
  max-width: clamp(220px, 28vw, 320px);
  overflow: hidden;
  will-change: max-width;
}
.import-preview-panel-enter-active,
.import-preview-panel-leave-active {
  transition: max-width 0.46s cubic-bezier(0.22, 1, 0.36, 1);
}
.import-preview-panel-enter-from,
.import-preview-panel-leave-to {
  max-width: 0 !important;
}
.import-preview-panel-enter-active .import-preview-aside,
.import-preview-panel-leave-active .import-preview-aside {
  transition:
    transform 0.46s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.32s ease;
}
.import-preview-panel-enter-from .import-preview-aside {
  transform: translateX(-100%);
  opacity: 0.88;
}
.import-preview-panel-leave-to .import-preview-aside {
  transform: translateX(-100%);
  opacity: 0.85;
}
.import-preview-aside {
  flex-shrink: 0;
  width: clamp(220px, 28vw, 320px);
  max-width: 100%;
  position: sticky;
  top: 0.5rem;
  align-self: flex-start;
  z-index: 2;
  box-shadow: 4px 0 28px -10px rgba(0, 0, 0, 0.2);
  border-radius: 0 6px 6px 0;
}
.import-form-main {
  flex: 1;
  min-width: 0;
}
.import-preview-frame {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}
/* Tall narrow viewport (portrait page strip) */
.import-preview-frame.import-preview-portrait {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: min(72vh, 720px);
  max-height: min(72vh, 720px);
  min-height: min(72vh, 720px);
}
.import-preview-zoom-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 6px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(var(--v-theme-surface-variant), 0.38);
}
.import-preview-zoom-pct {
  min-width: 2.85rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
  cursor: default;
}
.import-preview-zoom-scroller {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  position: relative;
  overscroll-behavior: contain;
}
.import-preview-zoom-inner {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  box-sizing: border-box;
}
.import-preview-iframe {
  display: block;
  flex: 1 1 auto;
  min-height: min(48vh, 360px);
  width: 100%;
  height: 100%;
  border: 0;
}
.import-preview-image-wrap {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 8px;
  box-sizing: border-box;
}
.import-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  vertical-align: middle;
}
.import-preview-text-wrap {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.import-preview-trunc-bar {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  flex-shrink: 0;
}
.import-preview-pre {
  margin: 0;
  padding: 12px 14px;
  font-size: 0.8125rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
  flex: 1 1 auto;
  min-height: 0;
}
@media (max-width: 959px) {
  .import-main-split {
    flex-direction: column;
    align-items: stretch;
  }
  .import-preview-rail {
    max-width: min(22rem, 100%);
    align-self: center;
  }
  .import-preview-panel-enter-from,
  .import-preview-panel-leave-to {
    max-width: 0 !important;
  }
  .import-preview-aside {
    width: min(22rem, 100%);
    margin-inline: auto;
    position: static;
    border-radius: 6px;
    box-shadow:
      0 4px 24px -8px rgba(0, 0, 0, 0.18),
      0 0 0 1px rgba(var(--v-border-color), var(--v-border-opacity));
  }
}
.import-fields-placeholder {
  border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(var(--v-theme-surface-variant), 0.25);
}
.import-subtle {
  opacity: 0.85;
}
.import-fields-panel {
  min-height: 140px;
}
/* File row: pilot column top-aligned with file field */
.import-file-ai-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  padding: 0.75rem 1rem;
  box-sizing: border-box;
  overflow: visible !important;
}
.import-file-ai-field {
  flex: 1 1 220px;
  min-width: 0;
}
/* AI suggest button: enter/leave when a file is chosen */
.import-pilot-btn-enter-active,
.import-pilot-btn-leave-active {
  transition:
    opacity 0.36s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}
.import-pilot-btn-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.94);
}
.import-pilot-btn-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
.import-pilot-col {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  overflow: visible !important;
}
.import-pilot-col :deep(.v-tooltip) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: visible !important;
}
/* File field + AI button share one visual row: center icon with the outlined control, not the row bottom */
.import-file-input-ai-pair :deep(.v-input__control) {
  min-height: 0;
}
@media (max-width: 599px) {
  .import-file-ai-field {
    flex: 1 1 100%;
  }
  .import-pilot-col {
    flex: 1 1 100%;
    justify-content: center !important;
  }
}
@media (prefers-reduced-motion: reduce) {
  .import-preview-panel-enter-active,
  .import-preview-panel-leave-active {
    transition-duration: 0.01ms !important;
  }
  .import-preview-panel-enter-active .import-preview-aside,
  .import-preview-panel-leave-active .import-preview-aside {
    transition-duration: 0.01ms !important;
  }
  .import-category-panel-enter-active,
  .import-category-panel-leave-active {
    transition-duration: 0.12s !important;
  }
  .import-category-panel-enter-from,
  .import-category-panel-leave-to {
    transform: none !important;
  }
  .import-pilot-btn-enter-active,
  .import-pilot-btn-leave-active {
    transition-duration: 0.14s !important;
  }
  .import-pilot-btn-enter-from,
  .import-pilot-btn-leave-to {
    transform: none !important;
  }
  .import-submit-btn-enter-active,
  .import-submit-btn-leave-active {
    transition-duration: 0.12s !important;
  }
  .import-submit-btn-enter-from,
  .import-submit-btn-leave-to {
    transform: none !important;
  }
  .import-submit-btn-wrap :deep(.v-progress-linear__indeterminate .long),
  .import-submit-btn-wrap :deep(.v-progress-linear__indeterminate .short) {
    animation: none !important;
  }
  .import-pilot-matrix-bg {
    animation: none;
  }
  .pilot-overlay-enter-active,
  .pilot-overlay-leave-active {
    transition-duration: 0.12s !important;
  }
  .pilot-overlay-enter-active .import-pilot-overlay-card,
  .pilot-overlay-leave-active .import-pilot-overlay-card {
    animation: none !important;
  }
}
</style>
