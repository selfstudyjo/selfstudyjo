<template>
  <div class="dbt-overlay" @mousedown.self="$emit('close')">
    <div class="dbt-modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: width + 'px' }">
      <header class="dbt-modal__head">
        <h2 class="dbt-modal__title">{{ title }}</h2>
        <button type="button" class="dbt-modal__x" aria-label="Close" @click="$emit('close')">
          <DbtIcon name="close" />
        </button>
      </header>
      <div class="dbt-modal__body"><slot /></div>
      <footer class="dbt-modal__foot">
        <slot name="footer">
          <button type="button" class="dbt-btn" @click="$emit('close')">Cancel</button>
          <button type="button" class="dbt-btn" :class="danger ? 'dbt-btn--danger' : 'dbt-btn--primary'"
                  :disabled="okDisabled || busy" @click="$emit('ok')">{{ okText }}</button>
        </slot>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import DbtIcon from './DbtIcon.vue';

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

<style scoped src="./dbt.css"></style>
<style scoped>
.dbt-overlay {
  position: absolute; inset: 0; z-index: 70; background: rgba(20, 24, 38, 0.5);
  display: flex; align-items: flex-start; justify-content: center; padding: 56px 16px 16px; overflow: auto;
}
.dbt-modal {
  width: 100%; background: #fff; border-radius: 10px; box-shadow: 0 12px 40px rgba(20, 24, 38, 0.28);
  display: flex; flex-direction: column; max-height: calc(100% - 24px); min-height: 0;
}
.dbt-modal__head { display: flex; align-items: center; gap: 8px; padding: 18px 22px 6px; }
.dbt-modal__title { margin: 0; flex: 1; font-size: 17px; line-height: 24px; font-weight: 600; color: var(--dbt-ink); }
.dbt-modal__x { border: 0; background: none; color: var(--dbt-muted); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: grid; place-items: center; }
.dbt-modal__x:hover { background: var(--dbt-hover); color: var(--dbt-ink); }
.dbt-modal__body { padding: 8px 22px 14px; overflow: auto; display: flex; flex-direction: column; gap: 14px; font-size: 13px; color: var(--dbt-ink); }
.dbt-modal__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 22px 18px; flex-wrap: wrap; border-top: 1px solid var(--dbt-border-light); }
</style>
