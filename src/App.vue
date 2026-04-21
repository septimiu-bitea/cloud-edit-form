<template>
  <v-app class="vue-embed-app">
    <v-main class="vue-embed-main">
      <v-container fluid class="vue-embed-container vue-embed-canvas">
        <MultivalueFieldTestView v-if="testMultivalue" />
        <template v-else>
          <template v-if="!context">
            <transition name="state-fade" appear>
              <v-alert
                type="info"
                variant="tonal"
                class="mb-4 standalone-alert rounded-xl"
                border="start"
              >
                <strong>{{ standaloneMessage }}</strong>
                <div class="mt-3 text-body2">
                  <strong>Edit:</strong> <code>VITE_BASE_URL</code>, <code>VITE_REPO_ID</code>, <code>VITE_DOCUMENT_ID</code> (optional <code>VITE_API_KEY</code>) in <code>vue-app/.env.local</code>.
                  <strong class="d-block mt-2">Import:</strong> same plus <code>VITE_FORM_MODE=import</code>; omit <code>VITE_DOCUMENT_ID</code>; optional <code>VITE_IMPORT_CATEGORY_ID</code>.
                  Then <strong>restart</strong> <code>npm run dev</code> and refresh.
                </div>
              </v-alert>
            </transition>
          </template>
          <transition v-else name="view-cross-fade" mode="out-in">
            <ImportView v-if="isImportMode" key="view-import" />
            <EditView v-else key="view-edit" />
          </transition>
        </template>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import EditView from '@/views/EditView.vue'
import ImportView from '@/views/ImportView.vue'
import MultivalueFieldTestView from '@/views/MultivalueFieldTestView.vue'
import { t } from '@/utils/i18n'

export default {
  name: 'App',
  components: { EditView, ImportView, MultivalueFieldTestView },
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
    /** Host import loader sets mode: 'import'; edit loader sets 'edit'. Missing mode treated as edit. */
    isImportMode () {
      return !!(this.context && this.context.mode === 'import')
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
.vue-embed-canvas {
  background: linear-gradient(
    165deg,
    rgba(var(--v-theme-surface-variant), 0.35) 0%,
    rgba(var(--v-theme-surface), 0.92) 42%,
    rgb(var(--v-theme-surface)) 100%
  );
}
.standalone-alert {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}
</style>
