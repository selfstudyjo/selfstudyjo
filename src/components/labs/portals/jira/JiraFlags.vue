<template>
  <div class="jf" aria-live="polite">
    <div v-for="flash in flashes" :key="flash.id" class="jf__flag" :class="'is-' + flash.type"
         role="alert">
      <JiraIcon :name="icon(flash.type)" :size="20" class="jf__icon" />
      <div class="jf__text">
        <div class="jf__title">{{ flash.title }}</div>
        <div v-if="flash.detail" class="jf__detail">{{ flash.detail }}</div>
        <div v-if="flash.command" class="jf__command" :title="flash.command">{{ flash.command }}</div>
      </div>
      <button type="button" class="jf__x" aria-label="Dismiss" @click="$emit('dismiss', flash.id)">
        <JiraIcon name="close" :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Jira's flags: stacked bottom-left, an icon, a bold title, the detail. */
import JiraIcon from './JiraIcon.vue';
import type { PortalFlash } from '../usePortal';

defineProps<{ flashes: PortalFlash[] }>();
defineEmits<{ (event: 'dismiss', id: number): void }>();

function icon(type: string) {
  return type === 'success' ? 'success' : type === 'error' ? 'error'
    : type === 'warning' ? 'warning' : 'info';
}
</script>

<style scoped>
.jf { position: absolute; left: 24px; bottom: 24px; z-index: 60; display: flex; flex-direction: column-reverse; gap: 8px; width: 400px; max-width: calc(100% - 48px); pointer-events: none; }
.jf__flag {
  display: flex; gap: 16px; padding: 16px; border-radius: 4px; background: var(--j-surface-overlay);
  box-shadow: var(--j-raised-shadow); pointer-events: auto; animation: jf-in 0.18s ease-out;
}
.jf__icon { margin-top: 0; }
.is-success .jf__icon { color: #22A06B; }
.is-error .jf__icon { color: #C9372C; }
.is-warning .jf__icon { color: #E06C00; }
.is-info .jf__icon, .is-progress .jf__icon { color: #1868DB; }
.jf__text { flex: 1; min-width: 0; }
.jf__title { font-weight: 653; color: var(--j-text); }
.jf__detail { margin-top: 4px; color: var(--j-text); white-space: pre-wrap; word-break: break-word; }
.jf__command {
  margin-top: 6px; font: 11px/16px ui-monospace, Menlo, Consolas, monospace; color: var(--j-text-subtlest);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.jf__x { align-self: flex-start; display: grid; place-items: center; width: 24px; height: 24px; border: 0; border-radius: 3px; background: transparent; color: var(--j-text-subtle); cursor: pointer; }
.jf__x:hover { background: var(--j-neutral-hover); }
@keyframes jf-in { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .jf__flag { animation: none; } }
@container sl-portal (max-width: 520px) { .jf { left: 8px; bottom: 8px; max-width: calc(100% - 16px); } }
</style>
