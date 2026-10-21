<template>
  <div ref="menu" class="af-ctx" role="menu" :aria-label="title" :style="{ left: left + 'px', top: top + 'px' }"
       tabindex="-1" @keydown.esc.prevent="$emit('close')" @contextmenu.prevent>
    <div v-if="title" class="af-ctx__title">{{ title }}</div>
    <template v-for="(item, i) in items" :key="i">
      <hr v-if="item.divider" class="af-ctx__hr" />
      <div v-else-if="item.header" class="af-ctx__header">{{ item.label }}</div>
      <button v-else type="button" role="menuitem" class="af-ctx__item" :class="{ 'is-danger': item.danger }"
              :disabled="item.disabled" @click="pick(item)">
        <span>{{ item.label }}</span>
        <code v-if="item.hint" class="af-ctx__hint">{{ item.hint }}</code>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * A right-click menu inside the Airflow UI, positioned against `.af-app`
 * (absolute, never fixed: the portal frame may be transformed or in a
 * full-screen overlay, where `position: fixed` would land somewhere else).
 * The items are plain data - the caller says what each one runs.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { CtxItem } from './afContext';

const props = defineProps<{ x: number; y: number; title?: string; items: CtxItem[] }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const menu = ref<HTMLElement | null>(null);
const left = ref(props.x);
const top = ref(props.y);

function pick(item: CtxItem) {
  emit('close');
  item.action?.();
}

function outside(event: Event) {
  if (menu.value && !menu.value.contains(event.target as Node)) emit('close');
}

onMounted(async () => {
  await nextTick();
  const el = menu.value;
  const host = el?.offsetParent as HTMLElement | null;
  if (el && host) {
    // Keep the menu inside the app: flip left / up when it would overflow.
    if (left.value + el.offsetWidth > host.clientWidth - 4) left.value = Math.max(4, left.value - el.offsetWidth);
    if (top.value + el.offsetHeight > host.clientHeight - 4) top.value = Math.max(4, host.clientHeight - el.offsetHeight - 4);
  }
  el?.focus();
  window.addEventListener('mousedown', outside, true);
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);
});
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', outside, true);
  window.removeEventListener('scroll', close, true);
  window.removeEventListener('resize', close);
});
function close() { emit('close'); }
</script>

<style scoped>
.af-ctx {
  position: absolute; z-index: 60; min-width: 220px; max-width: 360px; padding: 5px 0; outline: none;
  background: #fff; border: 1px solid rgba(0, 0, 0, .15); border-radius: 4px; box-shadow: 0 6px 12px rgba(0, 0, 0, .175);
  font-size: 13px; color: #333;
}
.af-ctx__title { padding: 4px 14px 6px; font-weight: 600; font-family: 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 12px;
  color: #51504f; border-bottom: 1px solid #eee; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-ctx__header { padding: 4px 14px 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #888; }
.af-ctx__item { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; border: 0; background: none;
  padding: 5px 14px; font: inherit; color: inherit; text-align: left; cursor: pointer; white-space: nowrap; }
.af-ctx__item:hover:not(:disabled), .af-ctx__item:focus-visible { background: #e6f1fd; color: #0153a0; outline: none; }
.af-ctx__item:disabled { color: #aaa; cursor: not-allowed; }
.af-ctx__item.is-danger { color: #a94442; }
.af-ctx__hint { font-size: 11px; color: #888; background: none; padding: 0; }
.af-ctx__hr { border: 0; border-top: 1px solid #e5e5e5; margin: 4px 0; }
</style>
