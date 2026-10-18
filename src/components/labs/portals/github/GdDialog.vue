<template>
  <div class="gd-scrim" @mousedown.self="$emit('close')">
    <section class="gd-dialog" :class="[`gd-dialog--${width || 'md'}`, { 'is-error': type === 'error', 'is-warning': type === 'warning' }]"
             role="dialog" aria-modal="true" :aria-label="title" @keydown.esc="$emit('close')">
      <header class="gd-dialog__head">
        <GdIcon v-if="type === 'error' || type === 'warning'" name="alert" :size="16" class="gd-dialog__alert" />
        <h2 class="gd-dialog__title">{{ title }}</h2>
        <button type="button" class="gd-dialog__close" aria-label="Close" @click="$emit('close')">
          <GdIcon name="x" :size="16" />
        </button>
      </header>
      <div class="gd-dialog__body"><slot /></div>
      <footer v-if="$slots.footer" class="gd-dialog__foot"><slot name="footer" /></footer>
    </section>
  </div>
</template>

<script setup lang="ts">
/** GitHub Desktop's dialog: a white sheet, a 14px title, buttons bottom-right. */
import GdIcon from './GdIcon.vue';

defineProps<{ title: string; width?: 'sm' | 'md' | 'lg' | 'xl'; type?: 'error' | 'warning' | '' }>();
defineEmits<{ (event: 'close'): void }>();
</script>

<style scoped>
.gd-scrim {
  position: absolute; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: flex-start; justify-content: center; padding: 48px 12px 12px;
  overflow: auto;
}
.gd-dialog {
  background: #fff; border-radius: 6px; box-shadow: 0 8px 24px rgba(149, 157, 165, 0.2), 0 0 0 1px rgba(27, 31, 35, 0.15);
  width: 100%; max-width: 450px; display: flex; flex-direction: column; max-height: calc(100% - 20px);
  color: var(--gd-text);
}
.gd-dialog--sm { max-width: 380px; }
.gd-dialog--lg { max-width: 600px; }
.gd-dialog--xl { max-width: 820px; }
.gd-dialog__head {
  display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--gd-border);
}
.gd-dialog__title { flex: 1; margin: 0; font-size: 14px; font-weight: 600; line-height: 20px; }
.gd-dialog__alert { color: var(--gd-red); }
.is-warning .gd-dialog__alert { color: #b08800; }
.gd-dialog__close {
  border: 0; background: none; color: var(--gd-text-secondary); cursor: pointer; padding: 2px;
  border-radius: 3px; display: inline-flex;
}
.gd-dialog__close:hover { background: var(--gd-hover); color: var(--gd-text); }
.gd-dialog__body { padding: 16px; overflow: auto; font-size: 12px; line-height: 18px; }
.gd-dialog__foot {
  display: flex; justify-content: flex-end; gap: 6px; padding: 12px 16px; border-top: 1px solid var(--gd-border);
  flex-wrap: wrap;
}
</style>
