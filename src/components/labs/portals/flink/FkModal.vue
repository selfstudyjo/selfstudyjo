<template>
  <div class="fk-overlay" @mousedown.self="$emit('close')">
    <div class="fk-modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: width + 'px' }">
      <header class="fk-modal__head">
        <FkIcon v-if="confirm" :name="danger ? 'warning' : 'info'" class="fk-modal__icon" :class="{ 'is-danger': danger }" />
        <h2 class="fk-modal__title">{{ title }}</h2>
        <button type="button" class="fk-modal__x" aria-label="Close" @click="$emit('close')">
          <FkIcon name="close" />
        </button>
      </header>
      <div class="fk-modal__body"><slot /></div>
      <footer class="fk-modal__foot">
        <button type="button" class="fk-btn" @click="$emit('close')">{{ cancelText }}</button>
        <button type="button" class="fk-btn" :class="danger ? 'fk-btn--danger-solid' : 'fk-btn--primary'"
                :disabled="okDisabled || busy" @click="$emit('ok')">{{ okText }}</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
/** NG-ZORRO's nz-modal (and its confirm variant), as the Flink dashboard opens it. */
import { onBeforeUnmount, onMounted } from 'vue';
import FkIcon from './FkIcon.vue';

withDefaults(defineProps<{
  title: string;
  okText?: string;
  cancelText?: string;
  okDisabled?: boolean;
  danger?: boolean;
  busy?: boolean;
  confirm?: boolean;
  width?: number;
}>(), { okText: 'OK', cancelText: 'Cancel', okDisabled: false, danger: false, busy: false, confirm: false, width: 520 });

const emit = defineEmits<{ (event: 'close'): void; (event: 'ok'): void }>();

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped src="./fk.css"></style>
<style scoped>
.fk-overlay {
  position: absolute; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: flex-start; justify-content: center; padding: 72px 16px 16px; overflow: auto;
}
.fk-modal {
  width: 100%; background: #fff; border-radius: 2px; box-shadow: 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
  display: flex; flex-direction: column; max-height: calc(100% - 24px); min-height: 0;
}
.fk-modal__head { display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-bottom: 1px solid var(--fk-border-split); }
.fk-modal__icon { font-size: 22px; color: #1890ff; }
.fk-modal__icon.is-danger { color: #faad14; }
.fk-modal__title { margin: 0; flex: 1; font-size: 16px; line-height: 22px; font-weight: 500; color: var(--fk-heading); }
.fk-modal__x { border: 0; background: none; color: rgba(0, 0, 0, 0.45); width: 28px; height: 28px; cursor: pointer; display: grid; place-items: center; border-radius: 2px; }
.fk-modal__x:hover { color: rgba(0, 0, 0, 0.75); background: #f5f5f5; }
.fk-modal__body { padding: 24px; overflow: auto; display: flex; flex-direction: column; gap: 16px; font-size: 14px; color: var(--fk-text); }
.fk-modal__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--fk-border-split); flex-wrap: wrap; }
</style>
