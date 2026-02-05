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
          <template v-if="values.length > 0">
            <v-chip
              v-for="(item, idx) in values"
              :key="`chip-${idx}-${String(item)}`"
              size="small"
              variant="tonal"
              closable
              :disabled="readonly || removingValue !== null"
              class="ma-1"
              @click:close="(e) => handleRemove(e, item, idx)"
            >
              {{ item }}
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
              :disabled="values.length === 0"
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
import { parseInputLine, parsePasteText } from '@/utils/multivalueParsing'

/**
 * Normalize modelValue to an array of strings (handles array or single value).
 */
function toValues (modelValue) {
  if (Array.isArray(modelValue)) return modelValue.map(v => String(v ?? ''))
  if (modelValue != null && modelValue !== '') return [String(modelValue)]
  return []
}

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
      removingValue: null, // Track which value is being removed to prevent double-clicks
      removalTimestamp: null, // Track when removal started
      snackbar: {
        show: false,
        text: '',
        color: 'success'
      }
    }
  },
  computed: {
    values () {
      return toValues(this.modelValue)
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
      // Prevent concurrent removals
      if (this.removingIndex !== null) {
        warn(`[MultivalueField] removeAt: already removing index ${this.removingIndex}, ignoring request for index ${index}`)
        return
      }
      
      // Create a fresh copy to avoid reactivity issues
      const current = [...this.values]
      if (index < 0 || index >= current.length) {
        warn(`[MultivalueField] removeAt: invalid index ${index}, array length ${current.length}`)
        return
      }
      
      // Set removing flag
      this.removingIndex = index
      
      log(`[MultivalueField] removeAt(${index}): current=`, current, 'removing:', current[index])
      const next = current.filter((_, i) => i !== index)
      log(`[MultivalueField] removeAt(${index}): next=`, next)
      
      // Use nextTick to ensure the update happens after the current render cycle
      this.$nextTick(() => {
        this.$emit('update:modelValue', next)
        // Clear removing flag after a short delay to allow Vue to re-render
        setTimeout(() => {
          this.removingIndex = null
        }, 50)
      })
    },
    handleRemove (event, valueToRemove, index) {
      // Stop event propagation immediately
      if (event) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
      }
      
      // Prevent concurrent removals - check both value and timestamp
      const now = Date.now()
      if (this.removingValue !== null) {
        // If removal was recent (within 500ms), ignore this request
        if (this.removalTimestamp && (now - this.removalTimestamp) < 500) {
          warn(`[MultivalueField] handleRemove: already removing "${this.removingValue}", ignoring request for "${valueToRemove}" (${now - this.removalTimestamp}ms ago)`)
          return
        }
        // If it's been a while, clear the flag (might be stale)
        this.removingValue = null
        this.removalTimestamp = null
      }
      
      const current = [...this.values]
      
      // Validate index if provided, otherwise find by value
      let targetIndex = index
      if (targetIndex === undefined || targetIndex < 0 || targetIndex >= current.length) {
        targetIndex = current.indexOf(valueToRemove)
        if (targetIndex === -1) {
          warn(`[MultivalueField] handleRemove: value not found:`, valueToRemove)
          return
        }
      }
      
      // Verify the value at the index matches
      if (current[targetIndex] !== valueToRemove) {
        warn(`[MultivalueField] handleRemove: value mismatch at index ${targetIndex}: expected "${valueToRemove}", got "${current[targetIndex]}"`)
        // Try to find by value instead
        targetIndex = current.indexOf(valueToRemove)
        if (targetIndex === -1) {
          warn(`[MultivalueField] handleRemove: value not found after mismatch:`, valueToRemove)
          return
        }
      }
      
      // Set removing flags
      this.removingValue = valueToRemove
      this.removalTimestamp = now
      
      log(`[MultivalueField] handleRemove("${valueToRemove}", idx=${targetIndex}): current=`, current)
      const next = current.filter((v, i) => i !== targetIndex)
      log(`[MultivalueField] handleRemove("${valueToRemove}"): next=`, next)
      
      // Emit immediately
      this.$emit('update:modelValue', next)
      
      // Clear removing flag after a delay to allow Vue to re-render
      setTimeout(() => {
        // Only clear if we're still removing the same value (not a new removal)
        if (this.removingValue === valueToRemove) {
          this.removingValue = null
          this.removalTimestamp = null
        }
      }, 300)
    },
    removeValue (valueToRemove) {
      // Legacy method - redirect to handleRemove
      this.handleRemove(null, valueToRemove)
    },
    parseAndAdd (raw) {
      console.log('[MultivalueField] parseAndAdd called with:', raw, 'delimiter:', this.delimiter)
      const tokens = parseInputLine(raw, this.delimiter)
      console.log('[MultivalueField] parseInputLine returned tokens:', tokens)
      if (tokens.length === 0) return
      const next = [...this.values, ...tokens]
      console.log('[MultivalueField] Emitting update with values:', next)
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
        const next = [...this.values, ...tokens]
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
          const next = Array.isArray(arr) ? arr.map(v => String(v ?? '')) : []
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
