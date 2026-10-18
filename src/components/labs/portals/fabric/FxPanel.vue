<template>
  <div class="fx-overlay fx-overlay--side" role="presentation" @mousedown.self="$emit('close')">
    <aside class="fx-panel" role="dialog" aria-modal="true" :aria-label="title"
           :style="{ width: width || '480px' }">
      <div class="fx-panel__head">
        <h2 class="fx-panel__title">{{ title }}</h2>
        <button type="button" class="fx-iconbtn" aria-label="Close" @click="$emit('close')">
          <FxIcon name="close" :size="16" />
        </button>
      </div>
      <div class="fx-panel__body"><slot /></div>
      <div v-if="$slots.footer" class="fx-panel__foot"><slot name="footer" /></div>
    </aside>
  </div>
</template>

<script setup lang="ts">
/** The Fabric side pane (workspace settings, manage access, item settings). */
import { onBeforeUnmount, onMounted } from 'vue';
import FxIcon from './FxIcon.vue';

defineProps<{ title: string; width?: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>
