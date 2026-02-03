<template>
  <v-app class="vue-embed-app">
    <v-main class="vue-embed-main">
      <v-container fluid class="fill-height" style="align-items: flex-start;">
        <v-alert
          v-if="!formInitContext"
          type="info"
          variant="tonal"
          class="mb-4"
        >
          <strong>{{ standaloneMessage }}</strong>
          <div class="mt-3 text-body2">
            To load a document locally: add <code>VITE_BASE_URL</code>, <code>VITE_REPO_ID</code>, <code>VITE_DOCUMENT_ID</code> (and optionally <code>VITE_API_KEY</code>) to <code>vue-app/.env.local</code>, then <strong>restart</strong> the dev server (<code>npm run dev</code>) and refresh the page.
          </div>
        </v-alert>
        <EditView v-else :form-init-context="formInitContext" />
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import EditView from '@/views/EditView.vue'
import { t } from '@/utils/i18n'

export default {
  name: 'App',
  components: { EditView },
  data () {
    return {
      formInitContext: null
    }
  },
  created () {
    this.formInitContext = typeof window !== 'undefined' ? window.__formInitContext ?? null : null
  },
  computed: {
    locale () {
      return this.formInitContext?.uiLocale || 'en'
    },
    standaloneMessage () {
      return t(this.locale, 'runningStandalone')
    }
  }
}
</script>

<style scoped>
/* When mounted inside #vue-app, fill the host area and align content to top */
.vue-embed-app {
  height: 100%;
  min-height: 0;
}
.vue-embed-main {
  align-items: flex-start;
}
</style>
