<template>
  <v-form ref="formRef" class="category-form-animate" @submit.prevent="$emit('submit')">
    <v-row dense>
      <v-col
        v-for="(prop, index) in visibleProperties"
        :key="prop.id"
        cols="12"
        :sm="fieldMeta(prop).isMulti ? 12 : 6"
        :md="fieldMeta(prop).isMulti ? 12 : 4"
        class="mt-1 field-col-animate"
        :style="{ '--stagger': index }"
      >
        <!-- Value list (cloud): single -->
        <v-select
          v-if="fieldType(prop) === 'select'"
          :model-value="currentValue(prop.id)"
          :items="selectItems(prop)"
          item-title="label"
          item-value="value"
          :label="fieldLabel(prop)"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly || locked"
          :error="fieldHasRequiredError(prop)"
          :error-messages="fieldHasRequiredError(prop) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          variant="outlined"
          density="comfortable"
          :hide-details="false"
          clearable
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="emitField(prop.id, $event ?? '')"
        />
        <!-- Value list (cloud): multi -->
        <v-select
          v-else-if="fieldType(prop) === 'multiselect'"
          :model-value="multiValues(prop.id)"
          :items="selectItems(prop)"
          item-title="label"
          item-value="value"
          :label="fieldLabel(prop)"
          multiple
          chips
          closable-chips
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly || locked"
          :error="fieldHasRequiredError(prop)"
          :error-messages="fieldHasRequiredError(prop) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          variant="outlined"
          density="comfortable"
          :hide-details="false"
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="handleMultivalueUpdate(prop.id, Array.isArray($event) ? $event : ($event == null ? [] : [$event]))"
        />
        <!-- Text / default -->
        <v-text-field
          v-else-if="fieldType(prop) === 'text'"
          :model-value="currentValue(prop.id)"
          :label="fieldLabel(prop)"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly || locked"
          :error="fieldHasRequiredError(prop)"
          :error-messages="fieldHasRequiredError(prop) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          :hint="fieldHint(prop)"
          :persistent-hint="!!fieldHint(prop)"
          variant="outlined"
          density="comfortable"
          :hide-details="false"
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
          :disabled="fieldMeta(prop).readOnly || locked"
          :error="fieldHasRequiredError(prop)"
          :error-messages="fieldHasRequiredError(prop) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          :hint="fieldHint(prop)"
          :persistent-hint="!!fieldHint(prop)"
          variant="outlined"
          density="comfortable"
          :hide-details="false"
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
          :disabled="fieldMeta(prop).readOnly || locked"
          :error="fieldHasRequiredError(prop)"
          :error-messages="fieldHasRequiredError(prop) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          :hint="fieldHint(prop)"
          :persistent-hint="!!fieldHint(prop)"
          variant="outlined"
          density="comfortable"
          :hide-details="false"
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="emitField(prop.id, $event)"
        />
        <!-- Datetime (text for now; can switch to v-date-picker + time) -->
        <v-text-field
          v-else-if="fieldType(prop) === 'datetime'"
          :model-value="currentValue(prop.id)"
          :label="fieldLabel(prop)"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly || locked"
          :error="fieldHasRequiredError(prop)"
          :error-messages="fieldHasRequiredError(prop) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          :hint="fieldHint(prop)"
          :persistent-hint="!!fieldHint(prop)"
          variant="outlined"
          density="comfortable"
          :hide-details="false"
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="emitField(prop.id, $event)"
        />
        <!-- Boolean -->
        <v-checkbox
          v-else-if="fieldType(prop) === 'checkbox' && !fieldMeta(prop).isMulti"
          :model-value="currentValue(prop.id)"
          :label="fieldLabel(prop)"
          :color="fieldHasRequiredError(prop) ? 'error' : 'primary'"
          :readonly="fieldMeta(prop).readOnly"
          :disabled="fieldMeta(prop).readOnly || locked"
          :error="fieldHasRequiredError(prop)"
          :error-messages="fieldHasRequiredError(prop) ? (t(currentLocale, 'fieldRequired') || 'This field is required') : ''"
          :hint="fieldHint(prop)"
          :persistent-hint="!!fieldHint(prop)"
          :hide-details="false"
          :data-field-uuid="resolveUuid(prop.id)"
          @update:model-value="emitField(prop.id, !!$event)"
        />
        <!-- Multivalue: chips, add, paste, clear, import from doc -->
        <MultivalueField
          v-else-if="fieldType(prop) === 'multitext'"
          :model-value="multiValues(prop.id)"
          :label="fieldMeta(prop).label"
          :readonly="fieldMeta(prop).readOnly || locked"
          :required="fieldMeta(prop).isRequired"
          :error="fieldHasRequiredError(prop)"
          :hint="multiFieldHint(prop)"
          :current-locale="currentLocale"
          :delimiter="delimiter"
          :import-from-doc="importFromDocFor(prop.id)"
          :data-field-uuid="resolveUuid(prop.id)"
          :compact="compactMultivalue"
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
    },
    /** When true, all fields are non-interactive (e.g. while Pilot runs). */
    locked: {
      type: Boolean,
      default: false
    },
    /** Show persistent hints on mandatory fields (import flow). */
    showRequiredHints: {
      type: Boolean,
      default: false
    },
    /**
     * Cloud value lists: keys = property `dataSetId` (or property id), values = `{ label, value }[]` (`value` = API stored key).
     */
    datasetOptionsByDataSetId: {
      type: Object,
      default: () => ({})
    },
    /** Tighter multivalue fields (smaller chips, scroll area); keeps add/paste/clear/import behavior. */
    compactMultivalue: {
      type: Boolean,
      default: false
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
      const isMulti = !!prop.isMultiValue
      const has =
        !!prop.hasValueList || !!String(prop.dataSetId || '').trim()
      if (!has) {
        return fieldTypeForDataType(prop.dataType, { isMulti })
      }
      const items = this.selectItems(prop)
      if (isMulti) {
        if (!items.length) return fieldTypeForDataType(prop.dataType, { isMulti: true, hasValueList: false })
        return 'multiselect'
      }
      if (!items.length) return fieldTypeForDataType(prop.dataType, { isMulti: false, hasValueList: false })
      return 'select'
    },
    selectItems (prop) {
      const dsId = String(this.fieldMeta(prop).dataSetId || prop.id || '').trim()
      const m = dsId ? this.datasetOptionsByDataSetId[dsId] : null
      return Array.isArray(m) ? m : []
    },
    fieldLabel (prop) {
      const meta = this.fieldMeta(prop)
      if (meta.isRequired && !meta.readOnly) {
        return `${meta.label} *`
      }
      return meta.label
    },
    /** Required, editable field is still empty (red border + message). */
    fieldHasRequiredError (prop) {
      const m = this.fieldMeta(prop)
      if (m.readOnly || !m.isRequired) return false
      return !this.propertyValueSatisfied(prop)
    },
    /** Same “has value” rules as ImportView.validateMandatory — hint only while empty. */
    propertyValueSatisfied (prop) {
      const m = this.fieldMeta(prop)
      if (m.readOnly || !m.isRequired) return true
      const uuid = this.resolveUuid(prop.id)
      const value = this.modelValue[uuid]
      if (m.isMulti) {
        if (Array.isArray(value)) {
          const vals = value.map(v => (v != null && typeof v === 'object' && 'value' in v) ? v.value : v)
          return vals.length > 0 && vals.some(v => v != null && String(v).trim() !== '')
        }
        return value != null && value !== ''
      }
      if (value != null && value !== '') {
        return String(value).trim().length > 0 || typeof value === 'boolean'
      }
      return false
    },
    /** Import flow once used importRequiredHint; empty required is shown via :error + fieldRequired. */
    fieldHint () {
      return undefined
    },
    multiFieldHint (prop) {
      return this.fieldHint(prop) || ''
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
