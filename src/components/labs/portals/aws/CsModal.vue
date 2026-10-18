<template>
  <div class="cs-modal" role="dialog" aria-modal="true" :aria-label="title" @keydown.esc="$emit('close')">
    <div class="cs-modal__box" :class="'cs-modal__box--' + size">
      <header class="cs-modal__head">
        <h2>{{ title }}</h2>
        <button type="button" class="cs-modal__x" aria-label="Close modal" @click="$emit('close')">
          <CsIcon name="close" />
        </button>
      </header>
      <div class="cs-modal__body"><slot /></div>
      <footer v-if="$slots.footer" class="cs-modal__foot"><slot name="footer" /></footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import CsIcon from './CsIcon.vue';

withDefaults(defineProps<{ title: string; size?: 'small' | 'medium' | 'large' }>(), { size: 'medium' });
defineEmits<{ (e: 'close'): void }>();
</script>

<style scoped>
.cs-modal { position: absolute; inset: 0; z-index: 60; background: rgba(35, 43, 55, .7); display: flex; align-items: flex-start; justify-content: center; padding: 48px 16px; overflow: auto; }
.cs-modal__box { background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 7, 22, .2); width: 100%; display: flex; flex-direction: column; max-height: calc(100% - 16px); }
.cs-modal__box--small { max-width: 400px; }
.cs-modal__box--medium { max-width: 600px; }
.cs-modal__box--large { max-width: 820px; }
.cs-modal__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 20px 10px; }
.cs-modal__head h2 { margin: 0; font-size: 20px; line-height: 24px; font-weight: 700; color: #0f141a; word-break: break-word; }
.cs-modal__x { flex: none; display: inline-flex; min-width: 28px; min-height: 28px; align-items: center; justify-content: center; border: 0; background: none; color: #424650; cursor: pointer; padding: 4px; border-radius: 4px; }
.cs-modal__x:hover { color: #0f141a; }
.cs-modal__body { padding: 4px 20px 20px; overflow: auto; color: #0f141a; font-size: 14px; line-height: 20px; }
.cs-modal__foot { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; padding: 12px 20px 16px; border-top: 1px solid #c6c6cd; }
@container sl-portal (max-width: 560px) {
  .cs-modal { padding: 16px 8px; }
  .cs-modal__head, .cs-modal__foot { padding-left: 16px; padding-right: 16px; }
  .cs-modal__body { padding-left: 16px; padding-right: 16px; }
}
</style>
