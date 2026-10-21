<template>
  <div class="az-ctx-host">
    <div ref="scrim" class="az-ctx-scrim" @click="$emit('close')" @contextmenu.prevent="$emit('close')"></div>
    <div ref="menu" class="az-ctx" role="menu" :style="{ left: pos.x + 'px', top: pos.y + 'px' }" @keydown="onKey">
      <template v-for="item in items" :key="item.key">
        <div v-if="item.sep" class="az-ctx__sep" role="separator"></div>
        <button v-else type="button" role="menuitem" class="az-ctx__item" :class="{ 'is-danger': item.danger }"
                :disabled="item.disabled" :title="item.hint || ''" @click="$emit('pick', item.key)">
          <svg v-if="!item.icon" width="16" height="16" aria-hidden="true"></svg>
          <AzIcon v-else :name="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The portal's context menu: what "..." on a row and a right-click both open.
 * Positioned in viewport coordinates and kept inside the window; Escape and a
 * click anywhere else close it, arrow keys move between items.
 */
import { nextTick, onMounted, reactive, ref } from 'vue';
import AzIcon from './AzIcon';

export interface CtxItem {
  key: string; label?: string; icon?: string; disabled?: boolean; danger?: boolean; sep?: boolean; hint?: string;
}

const props = defineProps<{ items: CtxItem[]; x: number; y: number }>();
const emit = defineEmits<{ (event: 'pick', key: string): void; (event: 'close'): void }>();
const menu = ref<HTMLElement | null>(null);
const scrim = ref<HTMLElement | null>(null);
const pos = reactive({ x: -9999, y: -9999 });   // off-screen until measured

function buttons(): HTMLButtonElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('.az-ctx__item:not(:disabled)') || []);
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return; }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const list = buttons();
  const at = list.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'ArrowDown' ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
  list[next]?.focus();
}
onMounted(() => nextTick(() => {
  const el = menu.value;
  if (!el) return;
  // Fixed positioning is relative to the nearest containing block, which is
  // the portal frame (container queries give it layout containment), not the
  // viewport. The scrim is `inset: 0` in that same block, so it IS the box.
  const box = scrim.value?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const rect = el.getBoundingClientRect();
  const x = props.x - box.left;
  const y = props.y - box.top;
  pos.x = Math.max(4, Math.min(x, box.width - rect.width - 4));
  pos.y = Math.max(4, y + rect.height > box.height - 4 ? y - rect.height : y);
  buttons()[0]?.focus({ preventScroll: true });
}));
</script>

<style scoped>
.az-ctx-scrim { position: fixed; inset: 0; z-index: 80; }
.az-ctx { position: fixed; z-index: 81; min-width: 200px; max-width: 320px; padding: 4px 0; background: #fff; color: #242424;
  border-radius: 4px; box-shadow: 0 0 2px rgba(0, 0, 0, .12), 0 8px 16px rgba(0, 0, 0, .14);
  font: 13px 'Segoe UI Variable Text', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif; }
.az-ctx__item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 32px; padding: 0 14px; border: 0;
  background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; white-space: nowrap; }
.az-ctx__item :deep(svg) { flex: none; color: #0f6cbd; }
.az-ctx__item:hover:not(:disabled), .az-ctx__item:focus-visible { background: #f5f5f5; outline: none; }
.az-ctx__item:disabled { color: #bdbdbd; cursor: default; }
.az-ctx__item:disabled :deep(svg) { color: #bdbdbd; }
.az-ctx__item.is-danger :deep(svg) { color: #c50f1f; }
.az-ctx__sep { height: 1px; margin: 4px 0; background: #e0e0e0; }
</style>
