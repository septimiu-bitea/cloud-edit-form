<template>
  <v-app class="vue-embed-app">
    <v-main class="vue-embed-main">
      <v-container fluid class="vue-embed-container">
        <MultivalueFieldTestView v-if="testMultivalue" />
        <template v-else>
          <v-alert
            v-if="!context"
            type="info"
            variant="tonal"
            class="mb-4"
          >
            <strong>{{ standaloneMessage }}</strong>
            <div class="mt-3 text-body2">
              To load a document locally: add <code>VITE_BASE_URL</code>, <code>VITE_REPO_ID</code>, <code>VITE_DOCUMENT_ID</code> (and optionally <code>VITE_API_KEY</code>) to <code>vue-app/.env.local</code>, then <strong>restart</strong> the dev server (<code>npm run dev</code>) and refresh the page.
            </div>
          </v-alert>
          <EditView v-else />
        </template>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import EditView from '@/views/EditView.vue'
import MultivalueFieldTestView from '@/views/MultivalueFieldTestView.vue'
import { t } from '@/utils/i18n'

export default {
  name: 'App',
  components: { EditView, MultivalueFieldTestView },
  inject: {
    formInitContext: { default: null }
  },
  data () {
    return {
      /** Show MultivalueField test view when URL hash is #test-multivalue */
      testMultivalue: false,
      /** Raw API response for each fetch. Populated by EditView after load; app can use this to handle data. */
      rawFetchResponses: {
        srm: null,
        categoryProperties: null,
        o2: null,
        objectDefinitions: null,
        storedoctype: null
      }
    }
  },
  provide () {
    return {
      rawFetchResponses: this.rawFetchResponses
    }
  },
  mounted () {
    this.testMultivalue = window.location.hash === '#test-multivalue'
    window.addEventListener('hashchange', this.onHashChange)
  },
  beforeUnmount () {
    window.removeEventListener('hashchange', this.onHashChange)
  },
  methods: {
    onHashChange () {
      this.testMultivalue = window.location.hash === '#test-multivalue'
    }
  },
  computed: {
    context () {
      return this.formInitContext || null
    },
    locale () {
      return this.context?.uiLocale || 'en'
    },
    standaloneMessage () {
      return t(this.locale, 'runningStandalone')
    }
  }
}
</script>

<style scoped>
/* Fixed height: no app-level scroll; only tab content scrolls */
.vue-embed-app {
  height: 100%;
  min-height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.vue-embed-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.vue-embed-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
