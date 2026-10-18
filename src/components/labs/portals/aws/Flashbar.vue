<template>
  <div v-if="flashes.length" class="fb" role="region" aria-label="Notifications">
    <div v-for="flash in flashes" :key="flash.id" class="fb__item" :class="'fb__item--' + kind(flash.type)"
         role="status">
      <CsIcon :name="icon(flash.type)" class="fb__icon" />
      <div class="fb__text">
        <div class="fb__title">{{ flash.title }}</div>
        <div v-if="flash.detail" class="fb__detail">{{ flash.detail }}</div>
      </div>
      <button type="button" class="fb__x" aria-label="Dismiss notification" @click="$emit('dismiss', flash.id)">
        <CsIcon name="close" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import CsIcon from './CsIcon.vue';
import type { PortalFlash } from '../usePortal';

defineProps<{ flashes: PortalFlash[] }>();
defineEmits<{ (e: 'dismiss', id: number): void }>();

function kind(type: string) {
  return ({ success: 'success', error: 'error', warning: 'warning', progress: 'info', info: 'info' } as Record<string, string>)[type] || 'info';
}
function icon(type: string) {
  return ({ success: 'status-positive', error: 'status-negative', warning: 'status-warning' } as Record<string, string>)[type]
    || 'status-info';
}
</script>

<style scoped>
.fb { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
.fb__item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 16px; border-radius: 12px; color: #fff; font-size: 14px; line-height: 20px; }
.fb__item--success { background: #00802f; }
.fb__item--error { background: #db0000; }
.fb__item--info { background: #006ce0; }
.fb__item--warning { background: #ffe347; color: #0f141a; }
.fb__icon { margin-top: 2px; }
.fb__text { flex: 1; min-width: 0; word-break: break-word; }
.fb__title { font-weight: 700; }
.fb__detail { margin-top: 2px; }
.fb__x { border: 0; background: none; color: inherit; cursor: pointer; padding: 2px; border-radius: 4px; display: inline-flex; }
</style>
