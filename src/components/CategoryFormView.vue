<template>
  <v-form ref="formRef" @submit.prevent="$emit('submit')">
    <v-row dense>
      <v-col
        v-for="prop in visibleProperties"
        :key="prop.id"
        cols="12"
        :sm="fieldMeta(prop).isMulti ? 12 : 6"
        :md="fieldMeta(prop).isMulti ? 12 : 4"
      >
        <!-- Text / default -->
        <v-text-field
          v-if="fieldType(prop) === 'text'"
          :model-value="currentValue(prop.id)"
          :label="fieldMeta(prop).label"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          @update:model-value="emitField(prop.id, $event)"
        />
        <!-- Number -->
        <v-text-field
          v-else-if="fieldType(prop) === 'number'"
          :model-value="currentValue(prop.id)"
          :label="fieldMeta(prop).label"
          type="number"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          @update:model-value="emitField(prop.id, $event != null && $event !== '' ? Number($event) : $event)"
        />
        <!-- Date -->
        <v-text-field
          v-else-if="fieldType(prop) === 'date'"
          :model-value="currentValue(prop.id)"
          :label="fieldMeta(prop).label"
          type="date"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          @update:model-value="emitField(prop.id, $event)"
        />
        <!-- Datetime (text for now; can switch to v-date-picker + time) -->
        <v-text-field
          v-else-if="fieldType(prop) === 'datetime'"
          :model-value="currentValue(prop.id)"
          :label="fieldMeta(prop).label"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          @update:model-value="emitField(prop.id, $event)"
        />
        <!-- Boolean -->
        <v-checkbox
          v-else-if="fieldType(prop) === 'checkbox' && !fieldMeta(prop).isMulti"
          :model-value="currentValue(prop.id)"
          :label="fieldMeta(prop).label"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly"
          hide-details="auto"
          @update:model-value="emitField(prop.id, !!$event)"
        />
        <!-- Multivalue: chips, add, paste, clear, import from doc -->
        <MultivalueField
          v-else-if="fieldType(prop) === 'multitext'"
          :model-value="multiValues(prop.id)"
          :label="fieldMeta(prop).label"
          :readonly="fieldMeta(prop).readOnly"
          :current-locale="currentLocale"
          :delimiter="delimiter"
          :import-from-doc="importFromDocFor(prop.id)"
          @update:model-value="emitField(prop.id, $event)"
        />
      </v-col>
    </v-row>
  </v-form>
</template>

<script>
import { toFieldMeta, fieldTypeForDataType } from '@/utils/fieldBuilding'
import MultivalueField from '@/components/MultivalueField.vue'

export default {
  name: 'CategoryFormView',
  components: { MultivalueField },
  props: {
    modelValue: {
      type: Object,
      default: () => ({})
    },
    properties: {
      type: Array,
      default: () => []
    },
    currentLocale: {
      type: String,
      default: 'en'
    },
    /** Delimiter for multivalue paste/input (e.g. ';'). */
    delimiter: {
      type: String,
      default: ';'
    },
    /** Optional: (docId, propertyId) => Promise<string[]>. Enables Import from Doc ID. */
    fetchPropertyValuesFromDoc: {
      type: Function,
      default: null
    }
  },
  emits: ['update:modelValue', 'submit'],
  computed: {
    visibleProperties () {
      return this.properties.filter(p => p && p.id)
    }
  },
  methods: {
    fieldMeta (prop) {
      return toFieldMeta(prop, { locale: this.currentLocale })
    },
    fieldType (prop) {
      return fieldTypeForDataType(prop.dataType, { isMulti: !!prop.isMultiValue })
    },
    currentValue (uuid) {
      return this.modelValue[uuid] ?? ''
    },
    multiValues (uuid) {
      const v = this.modelValue[uuid]
      return Array.isArray(v) ? v : (v != null && v !== '' ? [v] : [])
    },
    emitField (uuid, value) {
      this.$emit('update:modelValue', { ...this.modelValue, [uuid]: value })
    },
    importFromDocFor (propertyId) {
      const fn = this.fetchPropertyValuesFromDoc
      if (typeof fn !== 'function') return null
      return (docId) => fn(docId, propertyId)
    }
  }
}
</script>
