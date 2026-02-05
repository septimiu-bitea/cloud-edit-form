<template>
  <v-form ref="formRef" @submit.prevent="$emit('submit')">
    <v-row dense>
      <v-col
        v-for="prop in visibleProperties"
        :key="prop.id"
        cols="12"
        :sm="fieldMeta(prop).isMulti ? 12 : 6"
        :md="fieldMeta(prop).isMulti ? 12 : 4"
        class="mt-1"
      >
        <!-- Text / default -->
        <v-text-field
          v-if="fieldType(prop) === 'text'"
          :model-value="currentValue(prop.id)"
          :label="fieldLabel(prop)"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly"
          :error="isFieldInvalid(prop.id)"
          :error-messages="isFieldInvalid(prop.id) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="emitField(prop.id, $event)"
        />
        <!-- Number -->
        <v-text-field
          v-else-if="fieldType(prop) === 'number'"
          :model-value="currentValue(prop.id)"
          :label="fieldLabel(prop)"
          type="number"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly"
          :error="isFieldInvalid(prop.id)"
          :error-messages="isFieldInvalid(prop.id) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="emitField(prop.id, $event != null && $event !== '' ? Number($event) : $event)"
        />
        <!-- Date -->
        <v-text-field
          v-else-if="fieldType(prop) === 'date'"
          :model-value="currentValue(prop.id)"
          :label="fieldLabel(prop)"
          type="date"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly"
          :error="isFieldInvalid(prop.id)"
          :error-messages="isFieldInvalid(prop.id) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="emitField(prop.id, $event)"
        />
        <!-- Datetime (text for now; can switch to v-date-picker + time) -->
        <v-text-field
          v-else-if="fieldType(prop) === 'datetime'"
          :model-value="currentValue(prop.id)"
          :label="fieldLabel(prop)"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly"
          :error="isFieldInvalid(prop.id)"
          :error-messages="isFieldInvalid(prop.id) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="emitField(prop.id, $event)"
        />
        <!-- Boolean -->
        <v-checkbox
          v-else-if="fieldType(prop) === 'checkbox' && !fieldMeta(prop).isMulti"
          :model-value="currentValue(prop.id)"
          :label="fieldLabel(prop)"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly"
          :error="isFieldInvalid(prop.id)"
          :error-messages="isFieldInvalid(prop.id) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          hide-details="auto"
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="emitField(prop.id, !!$event)"
        />
        <!-- Multivalue: chips, add, paste, clear, import from doc -->
        <MultivalueField
          v-else-if="fieldType(prop) === 'multitext'"
          :model-value="multiValues(prop.id)"
          :label="fieldMeta(prop).label"
          :readonly="fieldMeta(prop).readOnly"
          :required="fieldMeta(prop).isRequired"
          :error="isFieldInvalid(prop.id)"
          :current-locale="currentLocale"
          :delimiter="delimiter"
          :import-from-doc="importFromDocFor(prop.id)"
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="handleMultivalueUpdate(prop.id, $event)"
        />
      </v-col>
    </v-row>
  </v-form>
</template>

<script>
import { toFieldMeta, fieldTypeForDataType } from '@/utils/fieldBuilding'
import MultivalueField from '@/components/MultivalueField.vue'
import { t } from '@/utils/i18n'

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
    idMap: {
      type: Object,
      default: () => ({})
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
    },
    /** Array of UUIDs for fields that are invalid (missing required values). */
    invalidFields: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update:modelValue', 'submit', 'field-updated'],
  computed: {
    visibleProperties () {
      return this.properties.filter(p => p && p.id)
    },
    invalidFieldsSet () {
      // Convert array to Set for faster lookups, reactive to invalidFields changes
      return new Set(this.invalidFields || [])
    }
  },
  methods: {
    t,
    fieldMeta (prop) {
      return toFieldMeta(prop, { locale: this.currentLocale })
    },
    fieldType (prop) {
      return fieldTypeForDataType(prop.dataType, { isMulti: !!prop.isMultiValue })
    },
    fieldLabel (prop) {
      const meta = this.fieldMeta(prop)
      if (meta.isRequired && !meta.readOnly) {
        return `${meta.label} *`
      }
      return meta.label
    },
    isFieldInvalid (propId) {
      const uuid = this.resolveUuid(propId)
      return this.invalidFieldsSet.has(uuid)
    },
    // Resolve UUID from prop.id (handles numeric IDs in on-premise mode)
    resolveUuid (propId) {
      return this.idMap[propId] || propId
    },
    currentValue (propId) {
      const uuid = this.resolveUuid(propId)
      return this.modelValue[uuid] ?? ''
    },
    multiValues (propId) {
      const uuid = this.resolveUuid(propId)
      const v = this.modelValue[uuid]
      return Array.isArray(v) ? v : (v != null && v !== '' ? [v] : [])
    },
    emitField (propId, value) {
      const uuid = this.resolveUuid(propId)
      // Clear validation error for this field when user updates it
      if (this.isFieldInvalid(propId)) {
        this.$emit('field-updated', uuid)
      }
      this.$emit('update:modelValue', { ...this.modelValue, [uuid]: value })
    },
    handleMultivalueUpdate (propId, value) {
      const uuid = this.resolveUuid(propId)
      // Clear validation error for this field when user updates it
      if (this.isFieldInvalid(propId)) {
        this.$emit('field-updated', uuid)
      }
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
