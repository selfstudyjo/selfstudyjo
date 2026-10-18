<template>
  <Teleport :to="root" :disabled="!root">
  <div class="dd-modal" role="dialog" aria-modal="true" :aria-label="title" @keydown.esc="$emit('close')">
    <div class="dd-modal__scrim" @click="$emit('close')"></div>
    <div class="dd-modal__card" :class="{ 'is-wide': wide }">
      <header class="dd-modal__head">
        <div>
          <h2>{{ title }}</h2>
          <p v-if="subtitle" class="dd-modal__subtitle">{{ subtitle }}</p>
        </div>
        <button type="button" class="dd-modal__close" aria-label="Close" @click="$emit('close')">
          <DdIcon name="close" :size="18" />
        </button>
      </header>
      <div class="dd-modal__body"><slot /></div>
      <footer v-if="$slots.footer" class="dd-modal__foot"><slot name="footer" /></footer>
    </div>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
import { inject, ref, type Ref } from 'vue';
import DdIcon from './DdIcon.vue';

/* Teleported to Docker Desktop's root so a dialog opened from inside a
   scrolling page still covers the whole window, as the real one does. */
const root = inject<Ref<HTMLElement | null>>('ddRoot', ref(null));

defineProps<{ title: string; subtitle?: string; wide?: boolean }>();
defineEmits<{ (event: 'close'): void }>();
</script>

<style scoped>
.dd-modal { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; padding: 16px; }
.dd-modal__scrim { position: absolute; inset: 0; background: rgb(23 25 30 / .45); }
.dd-modal__card {
  position: relative; width: min(520px, 100%); max-height: calc(100% - 16px); display: flex; flex-direction: column;
  background: #fff; border-radius: 8px; box-shadow: 0 8px 28px rgb(0 0 0 / .25); overflow: hidden;
}
.dd-modal__card.is-wide { width: min(680px, 100%); }
.dd-modal__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 20px 8px 24px; }
.dd-modal__head h2 { margin: 0; font-size: 20px; font-weight: 500; color: var(--dd-text); }
.dd-modal__subtitle { margin: 4px 0 0; font-size: 14px; color: var(--dd-text-2); overflow-wrap: anywhere; }
.dd-modal__close { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 50%; background: none; color: var(--dd-text-2); cursor: pointer; }
.dd-modal__close:hover { background: var(--dd-hover-strong); color: var(--dd-text); }
.dd-modal__body { padding: 8px 24px 16px; overflow: auto; display: flex; flex-direction: column; gap: 14px; font-size: 14px; color: var(--dd-text); }
.dd-modal__foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px 20px; flex-wrap: wrap; border-top: 1px solid transparent; }
@container sl-portal (max-width: 560px) {
  .dd-modal { padding: 8px; }
  .dd-modal__card, .dd-modal__card.is-wide { width: 100%; max-height: calc(100% - 8px); }
  .dd-modal__head { padding: 16px 12px 6px 16px; }
  .dd-modal__head h2 { font-size: 18px; }
  .dd-modal__body { padding: 6px 16px 12px; }
  .dd-modal__foot { padding: 12px 16px 16px; }
}
</style>
