<template>
  <v-card
    variant="outlined"
    class="d-flex flex-column"
    :class="[
      compact ? 'pa-2 multivalue-field--compact' : 'pa-3',
      { 'multivalue-field-error': error }
    ]"
    :data-field-uuid="dataFieldUuid"
  >
    <div
      class="d-flex align-start justify-space-between mb-1 multivalue-title-row"
      style="gap: 8px; width: 100%;"
    >
      <div
        :class="[compact ? 'text-body-2' : 'text-subtitle-2', error ? 'text-error' : 'text-medium-emphasis']"
        style="min-width: 0; flex: 1;"
      >
        {{ displayLabel }}
        <span v-if="error" class="text-error text-caption ml-1">({{ t(currentLocale, 'fieldRequired') || 'Required' }})</span>
      </div>
      <div
        v-if="!readonly && (entries.length > 0 || importFromDoc)"
        class="d-flex flex-wrap align-center justify-end flex-shrink-0 multivalue-title-actions"
        :style="compact ? 'gap: 4px 8px;' : 'gap: 6px 10px;'"
      >
        <Transition name="multivalue-clear-fade">
          <v-btn
            v-if="entries.length > 0"
            key="multivalue-clear"
            :size="compact ? 'x-small' : 'small'"
            variant="outlined"
            color="error"
            class="multivalue-clear-btn"
            @click="onClear"
          >
            <v-icon start :size="compact ? 16 : 'small'">mdi-delete-sweep</v-icon>
            {{ t(currentLocale, 'clear') }}
          </v-btn>
        </Transition>
        <v-checkbox
          v-if="importFromDoc"
          v-model="showImportAdvanced"
          :label="t(currentLocale, 'multivalueAdvanced')"
          :aria-label="t(currentLocale, 'multivalueAdvancedAria')"
          density="compact"
          hide-details
          color="primary"
          class="multivalue-advanced-checkbox mt-0 pt-0"
        />
      </div>
    </div>
    <p v-if="hint" class="text-caption text-medium-emphasis" :class="compact ? 'mb-1' : 'mb-2'">{{ hint }}</p>

    <p
      v-if="readonly && entries.length === 0"
      class="text-medium-emphasis text-body-2"
      :class="compact ? 'mb-1' : 'mb-2'"
    >
      —
    </p>

    <div
      v-else
      class="d-flex flex-column multivalue-field-input-stack"
      :style="compact ? 'gap: 6px;' : 'gap: 8px;'"
    >
        <v-expand-transition>
          <div
            v-if="entries.length > 0"
            key="multivalue-chips"
            class="multivalue-chips d-flex align-center flex-wrap"
            :class="{ 'multivalue-chips--scroll': compact }"
            :style="compact ? 'gap: 3px;' : 'gap: 4px;'"
          >
            <v-chip
              v-for="entry in entries"
              :key="entry.key"
              :size="compact ? 'x-small' : 'small'"
              variant="tonal"
              closable
              :disabled="readonly || removingKey !== null"
              :class="compact ? 'ma-0' : 'ma-1'"
              @click:close="(e) => handleRemoveByKey(e, entry.key)"
            >
              {{ entry.value }}
            </v-chip>
          </div>
        </v-expand-transition>
        <div v-if="!readonly" class="d-flex align-center flex-wrap" style="gap: 8px;">
          <v-text-field
            v-model="pendingInput"
            :placeholder="addPlaceholder"
            density="compact"
            hide-details
            variant="outlined"
            class="multivalue-add-input"
            :style="compact ? 'max-width: 260px; min-width: 120px; flex: 1;' : 'max-width: 280px; min-width: 140px; flex: 1;'"
            @keydown.enter.prevent="commitAdd"
          />
          <v-btn
            :size="compact ? 'x-small' : 'small'"
            variant="tonal"
            color="primary"
            :disabled="!hasPendingValue"
            @click="commitAdd"
          >
            <v-icon start :size="compact ? 16 : 'small'">mdi-plus</v-icon>
            {{ t(currentLocale, 'add') }}
          </v-btn>
        </div>
        <v-expand-transition>
          <div
            v-if="!readonly && importFromDoc && showImportAdvanced"
            key="multivalue-import"
            class="multivalue-import-transition-root"
          >
            <div
              class="d-flex align-center flex-wrap multivalue-import-row"
              style="gap: 8px;"
            >
              <v-text-field
                v-model="importDocId"
                :placeholder="t(currentLocale, 'importFromDocPlaceholder')"
                density="compact"
                hide-details
                variant="outlined"
                :style="compact ? 'max-width: 260px; min-width: 120px; flex: 1;' : 'max-width: 260px; min-width: 140px; flex: 1;'"
                :disabled="importLoading"
                @keydown.enter.prevent="doImport"
              />
              <v-btn
                :size="compact ? 'x-small' : 'small'"
                variant="tonal"
                color="primary"
                :loading="importLoading"
                :disabled="!importDocIdTrimmed"
                @click="doImport"
              >
                <v-icon start :size="compact ? 16 : 'small'">mdi-file-import</v-icon>
                {{ t(currentLocale, 'import') }}
              </v-btn>
            </div>
          </div>
        </v-expand-transition>
    </div>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
      location="bottom"
      variant="tonal"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </v-card>
</template>

<script>
import { t } from '@/utils/i18n'
import { log, warn } from '@/utils/debug'
import { parseInputLine, toKeyedEntries, multivalueToValues, generateMultivalueKey } from '@/utils/multivalueParsing'

export default {
  name: 'MultivalueField',
  props: {
    modelValue: {
      type: [Array, String, Number],
      default: () => []
    },
    label: {
      type: String,
      default: ''
    },
    readonly: {
      type: Boolean,
      default: false
    },
    required: {
      type: Boolean,
      default: false
    },
    error: {
      type: Boolean,
      default: false
    },
    currentLocale: {
      type: String,
      default: 'en'
    },
    /** Delimiter for paste and for splitting typed input (e.g. ';'). */
    delimiter: {
      type: String,
      default: ';'
    },
    /** Optional: (docId: string) => Promise<string[]>. When set, shows Import from Doc ID. */
    importFromDoc: {
      type: Function,
      default: null
    },
    /** Optional: data attribute for field UUID (used for scrolling to invalid fields). */
    dataFieldUuid: {
      type: String,
      default: ''
    },
    /** Optional helper under the title (e.g. required hint). */
    hint: {
      type: String,
      default: ''
    },
    /** Tighter layout (e.g. edit view with many multivalue fields): smaller chips, scrollable chip area. */
    compact: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue'],
  data () {
    return {
      pendingInput: '',
      importDocId: '',
      /** When true, doc-id import row is shown below “Add value” (requires importFromDoc). */
      showImportAdvanced: false,
      importLoading: false,
      removingKey: null, // Key of entry being removed (avoids double-delete when same value appears twice)
      snackbar: {
        show: false,
        text: '',
        color: 'success'
      }
    }
  },
  computed: {
    entries () {
      const raw = this.modelValue
      if (Array.isArray(raw)) return toKeyedEntries(raw, this.dataFieldUuid || undefined)
      if (raw != null && raw !== '') return toKeyedEntries([String(raw)], this.dataFieldUuid)
      return []
    },
    values () {
      return multivalueToValues(this.entries)
    },
    hasPendingValue () {
      return (this.pendingInput ?? '').trim().length > 0
    },
    importDocIdTrimmed () {
      return (this.importDocId ?? '').trim()
    },
    addPlaceholder () {
      return this.delimiter ? this.t(this.currentLocale, 'addValuePlaceholder', this.delimiter) : this.t(this.currentLocale, 'addValuePlaceholderShort')
    },
    displayLabel () {
      if (this.required && !this.readonly) {
        return `${this.label} *`
      }
      return this.label
    }
  },
  methods: {
    t,
    removeAt (index) {
      const entries = [...this.entries]
      if (index < 0 || index >= entries.length) {
        warn(`[MultivalueField] removeAt: invalid index ${index}, array length ${entries.length}`)
        return
      }
      this.handleRemoveByKey(null, entries[index].key)
    },
    handleRemoveByKey (event, keyToRemove) {
      if (event) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
      }
      if (this.removingKey !== null) {
        warn(`[MultivalueField] handleRemoveByKey: already removing key ${this.removingKey}, ignoring ${keyToRemove}`)
        return
      }
      const current = [...this.entries]
      const entry = current.find(e => e.key === keyToRemove)
      if (!entry) {
        warn(`[MultivalueField] handleRemoveByKey: key not found:`, keyToRemove)
        return
      }
      this.removingKey = keyToRemove
      const next = current.filter(e => e.key !== keyToRemove)
      log(`[MultivalueField] handleRemoveByKey("${keyToRemove}"): remaining=`, next.length)
      this.$emit('update:modelValue', next)
      setTimeout(() => {
        this.removingKey = null
      }, 100)
    },
    removeValue (valueToRemove) {
      const entry = this.entries.find(e => e.value === valueToRemove)
      if (entry) this.handleRemoveByKey(null, entry.key)
    },
    parseAndAdd (raw) {
      const tokens = parseInputLine(raw, this.delimiter)
      if (tokens.length === 0) return
      const newEntries = tokens.map(v => ({ key: generateMultivalueKey(), value: String(v ?? '') }))
      const next = [...this.entries, ...newEntries]
      this.$emit('update:modelValue', next)
    },
    commitAdd () {
      const raw = (this.pendingInput ?? '').trim()
      if (!raw) return
      this.parseAndAdd(raw)
      this.pendingInput = ''
    },
    onClear () {
      this.$emit('update:modelValue', [])
      this.showSnackbar(this.t(this.currentLocale, 'clearedAllValues'), 'info')
    },
    doImport () {
      const docId = this.importDocIdTrimmed
      if (!docId || typeof this.importFromDoc !== 'function') return
      this.importLoading = true
      this.importFromDoc(docId)
        .then((arr) => {
          const values = Array.isArray(arr) ? arr.map(v => String(v ?? '')) : []
          const next = values.map((v, i) => ({ key: generateMultivalueKey(`${this.dataFieldUuid || 'import'}-${i}`), value: v }))
          this.$emit('update:modelValue', next)
          this.importDocId = ''
          this.showSnackbar(next.length ? this.t(this.currentLocale, 'importedNValues', next.length) : this.t(this.currentLocale, 'noValuesInDocument'), next.length ? 'success' : 'info')
        })
        .catch((err) => {
          this.showSnackbar(this.t(this.currentLocale, 'importFailed', err?.message || String(err)), 'error')
        })
        .finally(() => {
          this.importLoading = false
        })
    },
    showSnackbar (text, color = 'success') {
      this.snackbar = { show: true, text, color }
    }
  }
}
</script>

<style scoped>
.multivalue-field-input-stack {
  width: 100%;
  min-width: 0;
}
.multivalue-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: 0;
}
.multivalue-add-input {
  flex: 1 1 auto;
}
.multivalue-field-error {
  border-color: rgb(var(--v-theme-error)) !important;
  border-width: 2px !important;
}
.multivalue-chips--scroll {
  max-height: 7.5rem;
  overflow-y: auto;
  overflow-x: hidden;
  align-content: flex-start;
}
.multivalue-title-actions {
  max-width: min(22rem, 100%);
}
.multivalue-advanced-checkbox :deep(.v-label) {
  font-size: 0.8125rem;
  opacity: 0.92;
}
.multivalue-clear-btn {
  flex-shrink: 0;
}
.multivalue-clear-fade-enter-active,
.multivalue-clear-fade-leave-active {
  transition: opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}
.multivalue-clear-fade-enter-from,
.multivalue-clear-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .multivalue-clear-fade-enter-active,
  .multivalue-clear-fade-leave-active {
    transition-duration: 0.01ms !important;
  }
}
</style>
