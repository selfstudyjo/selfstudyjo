<template>
  <div class="mf-overlay" @mousedown.self="$emit('close')">
    <div class="mf-modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: width + 'px' }">
      <header class="mf-modal__head">
        <h2 class="mf-modal__title">{{ title }}</h2>
        <button type="button" class="mf-modal__x" aria-label="Close" @click="$emit('close')">
          <MfIcon name="close" />
        </button>
      </header>
      <div class="mf-modal__body"><slot /></div>
      <footer class="mf-modal__foot">
        <slot name="footer">
          <button type="button" class="mf-btn" @click="$emit('close')">Cancel</button>
          <button type="button" class="mf-btn" :class="danger ? 'mf-btn--danger' : 'mf-btn--primary'"
                  :disabled="okDisabled || busy" @click="$emit('ok')">{{ okText }}</button>
        </slot>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import MfIcon from './MfIcon.vue';

withDefaults(defineProps<{
  title: string;
  okText?: string;
  okDisabled?: boolean;
  danger?: boolean;
  busy?: boolean;
  width?: number;
}>(), { okText: 'OK', okDisabled: false, danger: false, busy: false, width: 520 });

const emit = defineEmits<{ (event: 'close'): void; (event: 'ok'): void }>();

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-overlay {
  position: absolute; inset: 0; z-index: 50; background: rgba(17, 23, 28, 0.45);
  display: flex; align-items: flex-start; justify-content: center; padding: 56px 16px 16px; overflow: auto;
}
.mf-modal {
  width: 100%; background: var(--mf-bg); border-radius: 8px; box-shadow: var(--mf-shadow-lg);
  display: flex; flex-direction: column; max-height: calc(100% - 24px); min-height: 0;
}
.mf-modal__head { display: flex; align-items: center; gap: 8px; padding: 20px 24px 8px; }
.mf-modal__title { margin: 0; flex: 1; font-size: 18px; line-height: 24px; font-weight: 600; color: var(--mf-text); }
.mf-modal__x { border: 0; background: none; color: var(--mf-text-2); width: 28px; height: 28px; border-radius: var(--mf-radius); cursor: pointer; display: grid; place-items: center; }
.mf-modal__x:hover { background: var(--mf-row-hover); color: var(--mf-text); }
.mf-modal__body { padding: 8px 24px 16px; overflow: auto; display: flex; flex-direction: column; gap: 14px; font-size: 13px; color: var(--mf-text); }
.mf-modal__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 24px 20px; flex-wrap: wrap; }
</style>
