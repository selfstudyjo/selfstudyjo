<template>
  <!-- The modern status symbols: a filled disc carrying a glyph, colour by result. -->
  <svg class="jk-status" :class="'is-' + ball" viewBox="0 0 24 24" :width="size" :height="size"
       role="img" :aria-label="label" :title="label">
    <title>{{ label }}</title>
    <template v-if="ball === 'nobuilt'">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.4" />
    </template>
    <template v-else-if="ball === 'disabled'">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path v-if="ball === 'blue'" d="M7.4 12.4l3 3 6.2-6.6" fill="none" stroke="#fff" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" />
      <path v-else-if="ball === 'red'" d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="#fff" stroke-width="2.2"
            stroke-linecap="round" />
      <path v-else-if="ball === 'yellow'" d="M12 6.8v6.4M12 16.6v.3" fill="none" stroke="#fff" stroke-width="2.4"
            stroke-linecap="round" />
      <path v-else d="M7.5 12h9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ ball: string; size?: number }>(), { size: 20 });

const label = computed(() => ({
  blue: 'Success', red: 'Failed', yellow: 'Unstable', aborted: 'Aborted',
  nobuilt: 'Not built', disabled: 'Disabled',
} as Record<string, string>)[props.ball] || 'Not built');
</script>

<style scoped>
.jk-status { flex: none; display: inline-block; vertical-align: middle; }
.is-blue { color: var(--jk-green, #1ea64b); }
.is-red { color: var(--jk-red, #e3172d); }
.is-yellow { color: var(--jk-orange, #f2772e); }
.is-aborted, .is-nobuilt, .is-disabled { color: var(--jk-secondary, #77767c); }
</style>
