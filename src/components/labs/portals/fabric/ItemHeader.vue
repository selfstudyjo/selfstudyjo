<template>
  <div class="ih">
    <div class="ih-top">
      <FxIcon :name="type" :size="22" />
      <h1 class="ih-name" :title="name">{{ name }}</h1>
      <span v-if="label" class="fx-pill" :title="'Sensitivity: ' + label"><FxIcon name="lock" :size="12" />{{ label }}</span>
      <span v-if="endorsement" class="fx-pill fx-pill--brand"><FxIcon name="badge" :size="12" />{{ endorsement }}</span>
      <span class="ih-saved fx-muted">{{ status || 'Saved' }}</span>
      <span class="fx-cmdbar__grow" />
      <slot name="right" />
      <button type="button" class="fx-btn ih-act" title="Settings" aria-label="Settings" @click="$emit('settings')"><FxIcon name="settings" /><span class="ih-act__txt">Settings</span></button>
      <button type="button" class="fx-btn fx-btn--primary ih-act" title="Share" aria-label="Share" @click="$emit('share')"><FxIcon name="share" /><span class="ih-act__txt">Share</span></button>
    </div>
    <div v-if="tabs && tabs.length" class="fx-tabs ih-tabs" role="tablist">
      <button v-for="t in tabs" :key="t" type="button" class="fx-tab" :class="{ 'is-active': modelValue === t }"
              @click="$emit('update:modelValue', t)">{{ t }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The header every item editor shares: icon, name, label/endorsement, Settings and Share. */
import FxIcon from './FxIcon.vue';

defineProps<{ name: string; type: string; label?: string; endorsement?: string; status?: string;
  tabs?: string[]; modelValue?: string }>();
defineEmits<{ (event: 'settings'): void; (event: 'share'): void;
  (event: 'update:modelValue', value: string): void }>();
</script>

<style scoped>
.ih { border-bottom: 1px solid #e0e0e0; }
.ih-top { display: flex; align-items: center; gap: 8px; padding: 10px 16px 6px; flex-wrap: wrap; }
.ih-name { margin: 0; font: 600 18px/24px "Segoe UI", sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40%; }
.ih-saved { font-size: 12px; }
.ih-tabs { border-bottom: 0; padding: 0 8px; }
@container sl-portal (max-width: 600px) {
  .ih-name { max-width: none; flex: 1 1 60px; min-width: 0; }
  .ih-top > .fx-cmdbar__grow { display: none; }
  .ih-saved { display: none; }
  .ih-top { padding: 8px 12px 4px; gap: 6px; flex-wrap: nowrap; }
  /* The label and endorsement stay in Settings; on a phone the row keeps the name. */
  .ih-top > .fx-pill { display: none; }
  .ih-top > :deep(.fx-select) { flex: 0 1 124px; min-width: 96px; }
  /* On a phone the two header actions keep their icon and lose the word, so
     the switcher, Settings and Share share one row as in the Fabric app. */
  .ih-act { padding: 0 8px; }
  .ih-act__txt { display: none; }
}
</style>
