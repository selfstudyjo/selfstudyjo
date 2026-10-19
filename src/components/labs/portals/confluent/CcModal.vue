<template>
  <div class="cc-overlay" @mousedown.self="$emit('close')">
    <div class="cc-modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: width + 'px' }">
      <header class="cc-modal__head">
        <h2 class="cc-modal__title">{{ title }}</h2>
        <button type="button" class="cc-modal__x" aria-label="Close" @click="$emit('close')"><CcIcon name="close" /></button>
      </header>
      <div class="cc-modal__body"><slot /></div>
      <footer class="cc-modal__foot">
        <slot name="footer">
          <button type="button" class="cc-btn" @click="$emit('close')">Cancel</button>
          <button type="button" class="cc-btn" :class="danger ? 'cc-btn--danger' : 'cc-btn--primary'"
                  :disabled="okDisabled || busy" @click="$emit('ok')">{{ okText }}</button>
        </slot>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import CcIcon from './CcIcon.vue';

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

<style scoped src="./cc.css"></style>
<style scoped>
.cc-overlay {
  position: absolute; inset: 0; z-index: 50; background: rgba(13, 31, 48, 0.5);
  display: flex; align-items: flex-start; justify-content: center; padding: 48px 16px 16px; overflow: auto;
}
.cc-modal {
  width: 100%; background: #fff; border-radius: 4px; box-shadow: 0 8px 32px rgba(13, 31, 48, 0.3);
  display: flex; flex-direction: column; max-height: calc(100% - 16px); min-height: 0;
}
.cc-modal__head { display: flex; align-items: center; gap: 8px; padding: 16px 20px; border-bottom: 1px solid var(--cc-border); }
.cc-modal__title { margin: 0; flex: 1; font-size: 18px; line-height: 24px; font-weight: 600; color: var(--cc-text); overflow-wrap: anywhere; }
.cc-modal__x { border: 0; background: none; color: var(--cc-text-2); width: 28px; height: 28px; border-radius: 4px; cursor: pointer; display: grid; place-items: center; }
.cc-modal__x:hover { background: var(--cc-row-hover); color: var(--cc-text); }
.cc-modal__body { padding: 16px 20px; overflow: auto; display: flex; flex-direction: column; gap: 14px; font-size: 13px; color: var(--cc-text); }
.cc-modal__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--cc-border); flex-wrap: wrap; }
</style>
