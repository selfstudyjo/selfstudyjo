<template>
  <div class="modal-overlay" role="presentation" @keydown.esc="$emit('close')">
    <section class="modal" :class="size ? 'modal--' + size : ''" role="dialog" aria-modal="true" :aria-label="title">
      <header class="modal__head">
        <h2 class="modal__title">{{ title }}</h2>
        <button type="button" class="icon-btn" aria-label="Close" @click="$emit('close')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" /></svg>
        </button>
      </header>
      <div class="modal__body"><slot /></div>
      <footer v-if="$slots.footer" class="modal__foot"><slot name="footer" /></footer>
    </section>
  </div>
</template>

<script setup lang="ts">
/** A Next Experience modal: a title bar with a close button and a right-aligned footer. */
defineProps<{ title: string; size?: 'sm' | 'lg' }>();
defineEmits<{ (event: 'close'): void }>();
</script>

<style scoped src="./sn.css"></style>
<style scoped>
.modal-overlay { position: absolute; inset: 0; z-index: 50; display: grid; place-items: center; padding: 16px;
  background: rgba(24, 24, 38, 0.55); }
.modal { display: flex; flex-direction: column; width: min(544px, 100%); max-height: 100%; border-radius: var(--sn-radius-lg);
  background: var(--sn-surface); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35); overflow: hidden; }
.modal--sm { width: min(416px, 100%); }
.modal--lg { width: min(736px, 100%); }
.modal__head { display: flex; align-items: center; gap: 8px; padding: 13.6px 16px 9.6px; }
.modal__title { flex: 1; margin: 0; font-size: 16.8px; font-weight: 700; color: var(--sn-text); }
.modal__body { padding: 3.2px 16px 16px; overflow: auto; font-size: 13px; color: var(--sn-text); line-height: 1.45; }
.modal__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--sn-border); background: var(--sn-surface-alt); }
</style>
