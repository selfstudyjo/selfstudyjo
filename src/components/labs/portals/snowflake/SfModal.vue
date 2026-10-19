<template>
  <div class="sf-overlay" @mousedown.self="$emit('close')">
    <div class="sf-modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: width + 'px' }">
      <header class="sf-modal__head">
        <div class="sf-modal__titles">
          <h2 class="sf-modal__title">{{ title }}</h2>
          <p v-if="subtitle" class="sf-modal__sub">{{ subtitle }}</p>
        </div>
        <button type="button" class="sf-modal__x" aria-label="Close" @click="$emit('close')">
          <SfIcon name="close" />
        </button>
      </header>
      <div class="sf-modal__body"><slot /></div>
      <div v-if="sql" class="sf-modal__sql">
        <button type="button" class="sf-modal__sqltoggle" :aria-expanded="showSql" @click="showSql = !showSql">
          <SfIcon :name="showSql ? 'chevron-down' : 'chevron-right'" /> SQL preview
        </button>
        <pre v-if="showSql" class="sf-code">{{ sql }}</pre>
      </div>
      <p v-if="error" class="sf-modal__error" role="alert"><SfIcon name="x-circle" /> <span>{{ error }}</span></p>
      <footer class="sf-modal__foot">
        <slot name="footer">
          <button type="button" class="sf-btn" @click="$emit('close')">Cancel</button>
          <button type="button" class="sf-btn" :class="danger ? 'sf-btn--danger' : 'sf-btn--primary'"
                  :disabled="okDisabled || busy" @click="$emit('ok')">{{ busy ? 'Working…' : okText }}</button>
        </slot>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * A Snowsight dialog. The SQL preview is the product's own "Open in
 * Worksheets" idea in miniature: every dialog in Snowsight is a form over a
 * statement, and showing that statement is what teaches it.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import SfIcon from './SfIcon.vue';

withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  okText?: string;
  okDisabled?: boolean;
  danger?: boolean;
  busy?: boolean;
  width?: number;
  sql?: string;
  error?: string;
}>(), { subtitle: '', okText: 'Create', okDisabled: false, danger: false, busy: false, width: 560, sql: '', error: '' });

const emit = defineEmits<{ (event: 'close'): void; (event: 'ok'): void }>();
const showSql = ref(false);

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.sf-overlay {
  position: absolute; inset: 0; z-index: 70; background: rgba(30, 37, 47, 0.45);
  display: flex; align-items: flex-start; justify-content: center; padding: 48px 16px 16px; overflow: auto;
}
.sf-modal {
  width: 100%; background: var(--sf-bg); border-radius: 12px; box-shadow: var(--sf-shadow-lg);
  display: flex; flex-direction: column; max-height: calc(100% - 16px); min-height: 0;
}
.sf-modal__head { display: flex; align-items: flex-start; gap: 8px; padding: 20px 24px 8px; }
.sf-modal__titles { flex: 1; min-width: 0; }
.sf-modal__title { margin: 0; font-size: 18px; line-height: 24px; font-weight: 600; color: var(--sf-text); overflow-wrap: anywhere; }
.sf-modal__sub { margin: 4px 0 0; font-size: 13px; color: var(--sf-text-2); }
.sf-modal__x { border: 0; background: none; color: var(--sf-text-2); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: grid; place-items: center; flex: none; }
.sf-modal__x:hover { background: var(--sf-hover); color: var(--sf-text); }
.sf-modal__body { padding: 8px 24px 12px; overflow: auto; display: flex; flex-direction: column; gap: 14px; font-size: 13px; color: var(--sf-text); min-height: 0; }
.sf-modal__sql { padding: 0 24px 8px; display: flex; flex-direction: column; gap: 6px; }
.sf-modal__sqltoggle { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; background: none; border: 0; padding: 0; font: inherit; font-size: 12px; color: var(--sf-link); cursor: pointer; }
.sf-modal__sql .sf-code { max-height: 180px; }
.sf-modal__error { margin: 0 24px 8px; display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: 6px; background: var(--sf-bad-bg); color: var(--sf-danger-text); font-size: 13px; overflow-wrap: anywhere; }
.sf-modal__error .sf-ico { margin-top: 2px; }
.sf-modal__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 24px 20px; flex-wrap: wrap; border-top: 1px solid var(--sf-border); }
</style>
