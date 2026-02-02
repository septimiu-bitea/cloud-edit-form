<template>
  <v-card variant="outlined" class="pa-3">
    <div class="text-subtitle-2 text-medium-emphasis mb-2">{{ label }}</div>

    <v-row dense class="multivalue-layout">
      <!-- Left column: chips + add input beneath -->
      <v-col cols="12" md="6" class="d-flex flex-column">
        <div class="multivalue-chips mb-2" style="min-height: 32px;">
          <template v-if="values.length > 0">
            <v-chip
              v-for="(item, idx) in values"
              :key="`chip-${idx}`"
              size="small"
              variant="tonal"
              closable
              :disabled="readonly"
              class="ma-1"
              @click:close="removeAt(idx)"
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

/**
 * Normalize modelValue to an array of strings (handles array or single value).
 */
function toValues (modelValue) {
  if (Array.isArray(modelValue)) return modelValue.map(v => String(v ?? ''))
  if (modelValue != null && modelValue !== '') return [String(modelValue)]
  return []
}

/**
 * Build regex to split by delimiter (escape special chars).
 */
function splitRegexFor (delimiter) {
  if (!delimiter || typeof delimiter !== 'string') return /;/
  const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped)
}

/**
 * Parse single-line input: quoted "a;b" → one value, else split by delimiter.
 */
function parseInputLine (line, delimiter) {
  const trimmed = (line ?? '').trim()
  if (!trimmed) return []
  if (/^".*"$/.test(trimmed)) {
    return [trimmed.slice(1, -1)]
  }
  const re = splitRegexFor(delimiter)
  return trimmed.split(re).map(t => t.trim().replace(/^"(.*)"$/, '$1')).filter(Boolean)
}

/**
 * Parse pasted text: newlines first, then delimiter per line; trim and unquote.
 */
function parsePasteText (text, delimiter) {
  if (!text || typeof text !== 'string') return []
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const re = splitRegexFor(delimiter)
  const lines = normalized.includes('\n') ? normalized.split('\n') : [normalized]
  const tokens = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (t.startsWith('"') && t.endsWith('"')) {
      tokens.push(t.slice(1, -1))
    } else {
      tokens.push(...t.split(re).map(s => s.trim().replace(/^"(.*)"$/, '$1')).filter(Boolean))
    }
  }
  return tokens
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
    }
  },
  emits: ['update:modelValue'],
  data () {
    return {
      pendingInput: '',
      importDocId: '',
      importLoading: false,
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
    }
  },
  methods: {
    t,
    removeAt (index) {
      const next = this.values.filter((_, i) => i !== index)
      this.$emit('update:modelValue', next)
    },
    parseAndAdd (raw) {
      const tokens = parseInputLine(raw, this.delimiter)
      if (tokens.length === 0) return
      const next = this.values.concat(tokens)
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
        const next = this.values.concat(tokens)
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
</style>
