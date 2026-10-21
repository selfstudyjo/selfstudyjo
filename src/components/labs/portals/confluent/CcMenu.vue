<template>
  <div ref="el" class="cc-menu" role="menu" :style="{ left: pos.x + 'px', top: pos.y + 'px' }" @click.stop @contextmenu.prevent>
    <template v-for="(item, i) in items" :key="i">
      <div v-if="item.divider" class="cc-menu__sep" role="separator"></div>
      <button v-else type="button" role="menuitem" class="cc-menu__item" :class="{ 'is-danger': item.danger }"
              :disabled="item.disabled" @click="pick(item)">
        <CcIcon v-if="item.icon" :name="item.icon" /><span>{{ item.label }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * The row actions menu Control Center opens from a row's "..." button or a
 * right-click. One instance, owned by ControlCenter and positioned inside it
 * (the portal frame is a container, so position: fixed would not be the
 * viewport).
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CcIcon from './CcIcon.vue';
import type { CcMenuItem } from './ccContext';

const props = defineProps<{ items: CcMenuItem[]; x: number; y: number; bounds: { w: number; h: number } }>();
const emit = defineEmits<{ (event: 'close'): void }>();

const el = ref<HTMLElement | null>(null);
const pos = ref({ x: props.x, y: props.y });

function place() {
  pos.value = { x: props.x, y: props.y };
  nextTick(() => {
    const box = el.value;
    if (!box) return;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    pos.value = {
      x: Math.max(4, Math.min(props.x, props.bounds.w - w - 4)),
      y: props.y + h > props.bounds.h - 4 ? Math.max(4, props.y - h) : props.y,
    };
  });
}
watch(() => [props.x, props.y, props.items], place);

function pick(item: CcMenuItem) {
  emit('close');
  if (!item.disabled) item.run?.();
}
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') emit('close'); }
function onDown(event: MouseEvent) {
  if (el.value && !el.value.contains(event.target as Node)) emit('close');
}
onMounted(() => {
  place();
  window.addEventListener('keydown', onKey);
  window.addEventListener('mousedown', onDown, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('mousedown', onDown, true);
});
</script>

<style scoped>
.cc-menu {
  position: absolute; z-index: 60; min-width: 190px; padding: 4px 0; background: #fff; border: 1px solid var(--cc-border);
  border-radius: 4px; box-shadow: 0 4px 16px rgba(13, 31, 48, 0.18); display: flex; flex-direction: column;
}
.cc-menu__item {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 14px; border: 0; background: none; font: inherit;
  font-size: 13px; color: var(--cc-text); text-align: left; cursor: pointer; white-space: nowrap;
}
.cc-menu__item:hover:not(:disabled) { background: var(--cc-row-hover); color: var(--cc-primary); }
.cc-menu__item:disabled { color: var(--cc-text-3); cursor: not-allowed; }
.cc-menu__item.is-danger { color: var(--cc-danger); }
.cc-menu__item.is-danger:hover:not(:disabled) { background: var(--cc-danger-bg); color: var(--cc-danger-hover); }
.cc-menu__sep { height: 1px; margin: 4px 0; background: var(--cc-border-light); }
</style>
