<template>
  <div class="dh-overlay" @mousedown.self="$emit('close')">
    <div class="dh-modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: width + 'px' }">
      <header class="dh-modal__head">
        <h2 class="dh-modal__title">{{ title }}</h2>
        <button type="button" class="dh-modal__x" aria-label="Close" @click="$emit('close')">
          <DhIcon name="close" />
        </button>
      </header>
      <div class="dh-modal__body"><slot /></div>
      <footer class="dh-modal__foot">
        <slot name="footer">
          <button type="button" class="dh-btn" @click="$emit('close')">{{ cancelText }}</button>
          <button type="button" class="dh-btn" :class="danger ? 'dh-btn--danger' : 'dh-btn--primary'"
                  :disabled="okDisabled || busy" @click="$emit('ok')">{{ okText }}</button>
        </slot>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import DhIcon from './DhIcon.vue';

withDefaults(defineProps<{
  title: string;
  okText?: string;
  cancelText?: string;
  okDisabled?: boolean;
  danger?: boolean;
  busy?: boolean;
  width?: number;
}>(), { okText: 'OK', cancelText: 'Cancel', okDisabled: false, danger: false, busy: false, width: 520 });

const emit = defineEmits<{ (event: 'close'): void; (event: 'ok'): void }>();

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-overlay {
  position: absolute; inset: 0; z-index: 70; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: flex-start; justify-content: center; padding: 64px 16px 16px; overflow: auto;
}
.dh-modal {
  width: 100%; background: #fff; border-radius: 8px; box-shadow: 0 6px 16px rgba(0, 0, 0, .08), 0 3px 6px -4px rgba(0, 0, 0, .12), 0 9px 28px 8px rgba(0, 0, 0, .05);
  display: flex; flex-direction: column; max-height: calc(100% - 24px); min-height: 0;
}
.dh-modal__head { display: flex; align-items: center; gap: 8px; padding: 18px 24px 10px; }
.dh-modal__title { margin: 0; flex: 1; font-size: 16px; line-height: 24px; font-weight: 600; color: var(--dh-text); overflow-wrap: anywhere; }
.dh-modal__x { border: 0; background: none; color: #595959; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; display: grid; place-items: center; }
.dh-modal__x:hover { background: var(--dh-hover); color: var(--dh-text); }
.dh-modal__body { padding: 6px 24px 14px; overflow: auto; display: flex; flex-direction: column; gap: 14px; font-size: 14px; color: var(--dh-text); min-height: 0; }
.dh-modal__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 24px 18px; flex-wrap: wrap; }
</style>
