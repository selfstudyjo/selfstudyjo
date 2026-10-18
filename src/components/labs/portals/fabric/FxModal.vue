<template>
  <div class="fx-overlay" role="presentation" @mousedown.self="$emit('close')">
    <div class="fx-dialog" role="dialog" aria-modal="true" :aria-label="title"
         :style="{ width: width || '480px' }">
      <div class="fx-dialog__head">
        <h2 class="fx-dialog__title">{{ title }}</h2>
        <button type="button" class="fx-iconbtn" aria-label="Close" @click="$emit('close')">
          <FxIcon name="close" :size="16" />
        </button>
      </div>
      <div class="fx-dialog__body"><slot /></div>
      <div v-if="$slots.footer" class="fx-dialog__foot"><slot name="footer" /></div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** A Fluent 2 dialog: title, body, right-aligned actions; Escape and the X close it. */
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
