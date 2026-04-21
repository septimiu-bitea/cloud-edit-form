<template>
  <div
    class="powered-by-strip"
    :class="{ 'powered-by-strip--split': $slots.prepend }"
  >
    <div v-if="$slots.prepend" class="powered-by-strip-prepend">
      <slot name="prepend" />
    </div>
    <a
      href="https://www.ametras-ecm.com"
      target="_blank"
      rel="noopener noreferrer"
      class="powered-by-link d-flex align-center flex-wrap justify-end text-decoration-none flex-shrink-0 ms-4"
      :aria-label="t(locale, 'poweredByAria')"
    >
      <span class="text-caption text-medium-emphasis me-2 text-no-wrap">{{ t(locale, 'poweredBy') }}</span>
      <img
        :src="logoUrl"
        alt=""
        class="powered-by-logo"
        height="32"
        width="220"
        loading="lazy"
        decoding="async"
        aria-hidden="true"
      />
    </a>
  </div>
</template>

<script>
import { t } from '@/utils/i18n'

/** Official brand asset (hosted on ametras-ecm.com). */
const AMETRAS_ECM_LOGO_URL =
  'https://www.ametras-ecm.com/wp-content/uploads/2024/06/Ametras-Ecm-_color.png'

export default {
  name: 'PoweredByStrip',
  props: {
    locale: {
      type: String,
      default: 'en'
    }
  },
  data () {
    return { logoUrl: AMETRAS_ECM_LOGO_URL }
  },
  methods: { t }
}
</script>

<style scoped>
.powered-by-strip {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  width: 100%;
  padding: 10px 16px 8px;
  box-sizing: border-box;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(var(--v-theme-surface), 0.55);
}
.powered-by-strip--split {
  justify-content: space-between;
  gap: 12px;
}
.powered-by-strip-prepend {
  flex: 1 1 auto;
  min-width: 0;
}
.powered-by-logo {
  height: 32px;
  width: auto;
  max-width: min(240px, 72vw);
  object-fit: contain;
  display: block;
}
.powered-by-link:hover .powered-by-logo {
  opacity: 0.92;
}
.powered-by-link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
