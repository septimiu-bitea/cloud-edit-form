<template>
  <v-card 
    variant="outlined" 
    class="pa-3"
    :class="{ 'multivalue-field-error': error }"
    :data-field-uuid="dataFieldUuid"
  >
    <div class="text-subtitle-2 mb-2" :class="error ? 'text-error' : 'text-medium-emphasis'">
      {{ displayLabel }}
      <span v-if="error" class="text-error text-caption ml-1">({{ t(currentLocale, 'fieldRequired') || 'Required' }})</span>
    </div>

    <v-row dense class="multivalue-layout">
      <!-- Left column: chips + add input beneath -->
      <v-col cols="12" md="6" class="d-flex flex-column">
        <div class="multivalue-chips mb-2" style="min-height: 32px;">
          <template v-if="entries.length > 0">
            <v-chip
              v-for="entry in entries"
              :key="entry.key"
              size="small"
              variant="tonal"
              closable
              :disabled="readonly || removingKey !== null"
              class="ma-1"
              @click:close="(e) => handleRemoveByKey(e, entry.key)"
            >
              {{ entry.value }}
            </v-chip>
          </template>
          <span v-else-if="readonly" class="text-medium-emphasis text-body2">—</span>
        </div>
        <template v-if="!readonly">
          <div class="d-flex align-center flex-wrap" style="gap: 8px;">
            <v-text-field
              v-model="pendingInput"
              :placeholder="addPlaceholder"
              density="compact"
              hide-details
              variant="outlined"
              class="multivalue-add-input"
              style="max-width: 280px; min-width: 140px; flex: 1;"
              @keydown.enter.prevent="commitAdd"
            />
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              :disabled="!hasPendingValue"
              @click="commitAdd"
            >
              <v-icon start size="small">mdi-plus</v-icon>
              {{ t(currentLocale, 'add') }}
            </v-btn>
          </div>
        </template>
      </v-col>

      <!-- Right column: Paste/Clear + Import (aligned right) -->
      <v-col v-if="!readonly" cols="12" md="6" class="d-flex flex-column align-end">
        <div class="d-flex align-center flex-wrap justify-end mb-2" style="gap: 8px;">
          <v-btn
            size="small"
            variant="outlined"
            color="secondary"
            @click="onPaste"
          >
            <v-icon start size="small">mdi-content-paste</v-icon>
            {{ t(currentLocale, 'paste') }}
          </v-btn>
            <v-btn
              size="small"
              variant="outlined"
              color="error"
              :disabled="entries.length === 0"
              @click="onClear"
            >
            <v-icon start size="small">mdi-delete-sweep</v-icon>
            {{ t(currentLocale, 'clear') }}
          </v-btn>
        </div>
        <template v-if="importFromDoc">
          <div class="d-flex align-center flex-wrap justify-end" style="gap: 8px;">
            <v-text-field
              v-model="importDocId"
              :placeholder="t(currentLocale, 'importFromDocPlaceholder')"
              density="compact"
              hide-details
              variant="outlined"
              style="max-width: 260px; min-width: 140px; flex: 1;"
              :disabled="importLoading"
              @keydown.enter.prevent="doImport"
            />
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              :loading="importLoading"
              :disabled="!importDocIdTrimmed"
              @click="doImport"
            >
              <v-icon start size="small">mdi-file-import</v-icon>
              {{ t(currentLocale, 'import') }}
            </v-btn>
          </div>
        </template>
      </v-col>
    </v-row>

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
import { parseInputLine, parsePasteText, toKeyedEntries, multivalueToValues, generateMultivalueKey } from '@/utils/multivalueParsing'

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
    }
  },
  emits: ['update:modelValue'],
  data () {
    return {
      pendingInput: '',
      importDocId: '',
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
    onPaste () {
      if (typeof navigator?.clipboard?.readText !== 'function') {
        this.showSnackbar(this.t(this.currentLocale, 'pasteNotAvailable'), 'warning')
        return
      }
      navigator.clipboard.readText().then((text) => {
        const tokens = parsePasteText(text, this.delimiter)
        if (tokens.length === 0) {
          this.showSnackbar(this.t(this.currentLocale, 'noValuesInClipboard'), 'info')
          return
        }
        const newEntries = tokens.map(v => ({ key: generateMultivalueKey(), value: String(v ?? '') }))
        const next = [...this.entries, ...newEntries]
        this.$emit('update:modelValue', next)
        this.showSnackbar(this.t(this.currentLocale, 'pastedNValues', tokens.length), 'success')
      }).catch((err) => {
        this.showSnackbar(this.t(this.currentLocale, 'pasteFailed', err?.message || String(err)), 'error')
      })
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
.multivalue-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: 32px;
}
.multivalue-add-input {
  flex: 1 1 auto;
}
.multivalue-field-error {
  border-color: rgb(var(--v-theme-error)) !important;
  border-width: 2px !important;
}
</style>
