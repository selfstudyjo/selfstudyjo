<template>
  <div ref="menu" class="dctx" role="menu" :aria-label="title" :style="{ left: left + 'px', top: top + 'px' }"
       tabindex="-1" @keydown.esc.prevent="$emit('close')" @contextmenu.prevent>
    <div v-if="title" class="dctx__title">{{ title }}</div>
    <template v-for="(item, i) in items" :key="i">
      <hr v-if="item.divider" class="dctx__hr" />
      <button v-else type="button" role="menuitem" class="dctx__item" :class="{ 'is-danger': item.danger }"
              :disabled="item.disabled" @click="pick(item)">
        <DbtIcon v-if="item.icon" :name="item.icon" class="dctx__icon" />
        <span class="dctx__label">{{ item.label }}</span>
        <kbd v-if="item.hint" class="dctx__hint">{{ item.hint }}</kbd>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * The Studio IDE's right-click menu. Positioned `absolute` against the nearest
 * positioned ancestor (never `fixed`: the portal frame can be transformed or in
 * a full-screen overlay), flipped to stay inside it.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import DbtIcon from './DbtIcon.vue';
import type { DbtMenuItem } from './dbt';

const props = defineProps<{ x: number; y: number; title?: string; items: DbtMenuItem[] }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const menu = ref<HTMLElement | null>(null);
const left = ref(props.x);
const top = ref(props.y);

function pick(item: DbtMenuItem) {
  emit('close');
  item.action?.();
}
function outside(event: Event) {
  if (menu.value && !menu.value.contains(event.target as Node)) emit('close');
}
function close() { emit('close'); }

onMounted(async () => {
  await nextTick();
  const el = menu.value;
  const host = el?.offsetParent as HTMLElement | null;
  if (el && host) {
    if (left.value + el.offsetWidth > host.clientWidth - 4) left.value = Math.max(4, left.value - el.offsetWidth);
    if (top.value + el.offsetHeight > host.clientHeight - 4) top.value = Math.max(4, host.clientHeight - el.offsetHeight - 4);
  }
  el?.focus();
  window.addEventListener('mousedown', outside, true);
  window.addEventListener('resize', close);
});
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', outside, true);
  window.removeEventListener('resize', close);
});
</script>

<style scoped>
.dctx {
  position: absolute; z-index: 60; min-width: 210px; max-width: 320px; padding: 4px; outline: none;
  background: #fff; border: 1px solid #D5D9E2; border-radius: 8px; box-shadow: 0 8px 24px rgba(20, 24, 38, .18);
  font: 13px Inter, -apple-system, 'Segoe UI', sans-serif; color: #262A38;
}
.dctx__title { padding: 5px 10px 6px; font-size: 11px; font-weight: 600; color: #6B7285; text-transform: uppercase; letter-spacing: .04em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dctx__item { width: 100%; display: flex; align-items: center; gap: 8px; border: 0; background: none; padding: 6px 10px; border-radius: 6px;
  font: inherit; color: inherit; text-align: left; cursor: pointer; }
.dctx__item:hover:not(:disabled), .dctx__item:focus-visible { background: #ECEEF3; outline: none; }
.dctx__item:disabled { color: #A3A9B8; cursor: not-allowed; }
.dctx__item.is-danger { color: #B42318; }
.dctx__icon { width: 14px; height: 14px; color: #6B7285; flex: none; }
.dctx__item.is-danger .dctx__icon { color: #B42318; }
.dctx__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dctx__hint { font: 11px 'SFMono-Regular', Menlo, Consolas, monospace; color: #8A92A6; background: none; }
.dctx__hr { border: 0; border-top: 1px solid #ECEEF3; margin: 4px 2px; }
</style>
