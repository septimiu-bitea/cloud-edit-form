<template>
  <div class="pa-4">
    <h1 class="text-h5 mb-4">MultivalueField – test</h1>
    <p class="text-body2 text-medium-emphasis mb-4">
      Add values (e.g. <kbd>a; b; c</kbd>), remove chips, use Clear, and resize the window to see justify-between / wrap.
    </p>
    <v-row>
      <v-col cols="12" md="6">
        <MultivalueField
          v-model="values1"
          label="Tags (empty then add)"
          :current-locale="locale"
        />
      </v-col>
      <v-col cols="12" md="6">
        <MultivalueField
          v-model="values2"
          label="Pre-filled"
          :current-locale="locale"
        />
      </v-col>
      <v-col cols="12" md="6">
        <MultivalueField
          v-model="values3"
          label="With Import (mock)"
          :current-locale="locale"
          :import-from-doc="mockImport"
        />
      </v-col>
      <v-col cols="12" md="6">
        <MultivalueField
          v-model="values4"
          label="Read-only"
          :current-locale="locale"
          readonly
        />
      </v-col>
    </v-row>
    <div class="mt-4 text-caption text-medium-emphasis">
      Current values (for verification): values1={{ JSON.stringify(values1) }}, values2={{ JSON.stringify(values2) }}
    </div>
  </div>
</template>

<script>
import MultivalueField from '@/components/MultivalueField.vue'

export default {
  name: 'MultivalueFieldTestView',
  components: { MultivalueField },
  data () {
    return {
      locale: 'en',
      values1: [],
      values2: ['Alpha', 'Beta', 'Gamma'],
      values3: [],
      values4: ['Read', 'Only']
    }
  },
  methods: {
    mockImport () {
      return Promise.resolve(['imported-1', 'imported-2'])
    }
  }
}
</script>
