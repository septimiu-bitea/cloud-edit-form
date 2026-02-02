<template>
  <div class="system-properties-view">
    <v-row dense>
      <v-col
        v-for="prop in systemProperties"
        :key="prop.id"
        cols="12"
        sm="6"
        md="4"
      >
        <v-text-field
          :model-value="displayValue(prop)"
          :label="labelFor(prop)"
          readonly
          variant="outlined"
          density="comfortable"
          hide-details="auto"
        />
      </v-col>
    </v-row>
    <v-alert
      v-if="systemProperties.length === 0"
      type="info"
      variant="tonal"
      density="comfortable"
      class="mt-2"
    >
      {{ emptyMessage }}
    </v-alert>
  </div>
</template>

<script>
import { t } from '@/utils/i18n'

/** Friendly labels for known system properties (Document ID, Status, file extension, etc.). */
const SYSTEM_LABELS = {
  property_document_id: 'Document ID',
  DOCUMENT_ID: 'Document ID',
  property_filename: 'File name',
  FILE_NAME: 'File name',
  property_filetype: 'File extension',
  FILE_EXTENSION: 'File extension',
  property_filesize: 'File size',
  FILE_SIZE: 'File size',
  property_state: 'Status',
  STATUS: 'Status',
  property_editor: 'Editor',
  EDITOR: 'Editor',
  property_owner: 'Owner',
  OWNER: 'Owner',
  property_category: 'Category',
  CATEGORY: 'Category',
  property_document_number: 'Document number',
  property_variant_number: 'Variant number',
  property_colorcode: 'Color code'
}

function humanizeId (id) {
  if (!id || typeof id !== 'string') return id || ''
  return id
    .replace(/^property_/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default {
  name: 'SystemPropertiesView',
  props: {
    systemProperties: {
      type: Array,
      default: () => []
    },
    currentLocale: {
      type: String,
      default: 'en'
    }
  },
  computed: {
    emptyMessage () {
      return t(this.currentLocale, 'noSystemProperties')
    }
  },
  methods: {
    labelFor (prop) {
      const id = (prop?.id ?? '').toString().trim()
      return prop?.displayName ?? SYSTEM_LABELS[id] ?? humanizeId(id) ?? '—'
    },
    displayValue (prop) {
      const v = prop?.displayValue ?? prop?.value
      if (v == null) return ''
      return typeof v === 'object' ? JSON.stringify(v) : String(v)
    }
  }
}
</script>
