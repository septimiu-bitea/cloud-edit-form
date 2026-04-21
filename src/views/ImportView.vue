<template>
  <v-card class="import-view-card surface-card" elevation="4">
    <PoweredByStrip :locale="locale">
      <template #prepend>
        <span class="text-h6 font-weight-semibold">{{ t(locale, 'importViewTitle') }}</span>
      </template>
    </PoweredByStrip>

    <v-card-text v-if="pageLoading" class="import-view-body">
      <div class="import-state-block">
        <v-progress-linear indeterminate color="primary" rounded height="6" class="mb-2" />
        <p class="text-body-2 text-medium-emphasis text-center mb-0">{{ t(locale, 'importPageLoadingHint') }}</p>
      </div>
    </v-card-text>
    <v-card-text v-else-if="pageError" class="import-view-body">
      <v-alert type="error" variant="tonal" class="mb-0 rounded-lg" border="start">
        {{ pageError }}
      </v-alert>
    </v-card-text>
    <div v-else class="import-body-wrap">
      <v-card-text class="import-view-body">
        <transition name="form-shell" appear>
          <div class="import-form-root">
            <div class="import-form-shell">
              <div class="import-file-ai-row mb-4">
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
                    :hide-details="!pilotFileOverMaxBytes"
                    :error="pilotFileOverMaxBytes"
                    :error-messages="pilotFileTooLargeHintMessage"
                    class="mb-0 import-file-input-ai-pair"
                    color="primary"
                  />
                </div>
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
                  class="mb-4"
                  clearable
                  color="primary"
                  :disabled="importLoading || pilotSuggestLoading"
                  @update:model-value="onCategoryIdChange"
                />

                <template v-if="selectedCategoryId">
                  <transition name="progress-slide" mode="out-in">
                    <v-progress-linear
                      v-if="uploadProgress != null"
                      key="up"
                      :model-value="Number(uploadProgress)"
                      color="primary"
                      height="8"
                      rounded
                      class="mt-2 mb-2"
                    />
                  </transition>

                  <transition name="form-shell" mode="out-in">
                    <div
                      v-if="categoryPropsLoading"
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
                      v-else-if="categoryPropertiesFiltered.length"
                      key="cat-form"
                      v-model="formData"
                      :properties="categoryPropertiesFiltered"
                      :id-map="idMap"
                      :current-locale="locale"
                      delimiter=";"
                      :fetch-property-values-from-doc="fetchPropertyValuesFromDoc"
                      :invalid-fields="invalidFields"
                      :locked="pilotSuggestLoading"
                      show-required-hints
                      @field-updated="onFieldUpdated"
                    />
                    <v-alert
                      v-else
                      key="no-props"
                      type="info"
                      variant="tonal"
                      rounded="lg"
                      class="mb-0"
                      border="start"
                    >
                      {{ t(locale, 'importNoProperties') }}
                    </v-alert>
                  </transition>
                </template>

                <div
                  v-if="resolvedFile && selectedCategoryId"
                  class="import-submit-row d-flex justify-end mt-4 pt-2"
                >
                  <v-btn
                    color="primary"
                    size="large"
                    class="px-6 import-footer-import-btn"
                    :loading="importLoading"
                    :disabled="importImportDisabled"
                    @click="runImport"
                  >
                    {{ t(locale, 'importSubmit') }}
                  </v-btn>
                </div>
              </template>
            </div>
          </div>
        </transition>
      </v-card-text>

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
  </v-card>
</template>

<script>
import CategoryFormView from '@/components/CategoryFormView.vue'
import PoweredByStrip from '@/components/PoweredByStrip.vue'
import { createApi, usedRepoId } from '@/services/api'
import {
  uploadFileInChunks,
  createDocumentO2M,
  buildO2mCreatePayload,
  applyCategoryMandatoryFlags,
  resolveAfterImportUrl
} from '@/services/documentImport'
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
      pilotFileAccept: PILOT_FILE_ACCEPT
    }
  },
  watch: {
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
    importImportDisabled () {
      if (this.importLoading || this.pilotSuggestLoading || this.pageLoading || this.pageError) return true
      if (!this.resolvedFile || !this.selectedCategoryId) return true
      if (this.categoryPropsLoading) return true
      return !this.mandatorySatisfied
    }
  },
  async mounted () {
    await this.bootstrap()
  },
  methods: {
    t,
    pilotPushLog (key) {
      const line = this.t(this.locale, key)
      this.pilotLogLines.push(line)
      if (this.pilotLogLines.length > 18) this.pilotLogLines.shift()
    },
    onFieldUpdated (uuid) {
      const i = this.invalidFields.indexOf(uuid)
      if (i > -1) this.invalidFields.splice(i, 1)
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
      } catch (e) {
        this.catPropsArr = []
        this.metaIdx = null
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
        this.formData = { ...this.formData, ...patch }
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

        const payload = buildO2mCreatePayload({
          repoId: this.repoId,
          categoryId: this.selectedCategoryId,
          contentLocationUri,
          fileName,
          formData: this.formData,
          catPropsArr: this.catPropsArr,
          idMap: this.idMap
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

        const documentId = result.json?.id || result.json?.dmsObjectId || null
        if (!documentId) {
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
.import-view-card {
  width: 100%;
  min-width: 720px;
  max-width: 1440px;
  margin: 0 auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.import-body-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.import-footer-import-btn {
  flex-shrink: 0;
}
.import-view-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scroll-behavior: smooth;
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
/* Plain flex (not v-row/v-col) so align-items: center matches file + AI reliably */
.import-file-ai-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 0.75rem 1rem;
  box-sizing: border-box;
  overflow: visible !important;
}
.import-file-ai-field {
  flex: 1 1 220px;
  min-width: 0;
}
.import-pilot-col {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
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
