<template>
  <div class="af-overlay" @mousedown.self="$emit('close')">
    <div class="af-modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: width + 'px' }">
      <header class="af-modal__head">
        <h4 class="af-modal__title">{{ title }}</h4>
        <button type="button" class="af-modal__x" aria-label="Close" @click="$emit('close')">&times;</button>
      </header>
      <div class="af-modal__body"><slot /></div>
      <footer class="af-modal__foot">
        <slot name="footer">
          <button type="button" class="af-btn" @click="$emit('close')">Cancel</button>
          <button type="button" class="af-btn" :class="danger ? 'af-btn--danger' : 'af-btn--primary'"
                  :disabled="okDisabled || busy" @click="$emit('ok')">{{ okText }}</button>
        </slot>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

withDefaults(defineProps<{
  title: string;
  okText?: string;
  okDisabled?: boolean;
  danger?: boolean;
  busy?: boolean;
  width?: number;
}>(), { okText: 'OK', okDisabled: false, danger: false, busy: false, width: 600 });

const emit = defineEmits<{ (event: 'close'): void; (event: 'ok'): void }>();

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-overlay {
  position: absolute; inset: 0; z-index: 70; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px 16px; overflow: auto;
}
.af-modal {
  width: 100%; background: #fff; border-radius: 6px; border: 1px solid rgba(0, 0, 0, .2);
  box-shadow: 0 5px 15px rgba(0, 0, 0, .5); display: flex; flex-direction: column; max-height: calc(100% - 20px); min-height: 0;
}
.af-modal__head { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #e5e5e5; }
.af-modal__title { margin: 0; flex: 1; font-size: 18px; line-height: 24px; font-weight: 500; color: var(--af-text); overflow-wrap: anywhere; }
.af-modal__x { border: 0; background: none; font-size: 22px; line-height: 1; color: #000; opacity: .3; cursor: pointer; padding: 0 4px; }
.af-modal__x:hover { opacity: .6; }
.af-modal__body { padding: 16px; overflow: auto; display: flex; flex-direction: column; gap: 12px; font-size: 14px; color: var(--af-text); min-height: 0; }
.af-modal__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid #e5e5e5; flex-wrap: wrap; }
</style>
