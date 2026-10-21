<template>
  <ul v-if="open" ref="menu" class="cs-ctx" role="menu" :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
      @keydown.esc.stop="close" @contextmenu.prevent>
    <template v-for="item in items" :key="item.id">
      <li v-if="item.group" class="cs-ctx__group" role="presentation">{{ item.text }}</li>
      <li v-else role="menuitem" class="cs-ctx__item" :class="{ 'is-disabled': item.disabled, 'is-nested': item.nested }"
          :aria-disabled="item.disabled" :title="item.disabledReason || undefined" tabindex="-1"
          @click="pick(item)" @keydown.enter="pick(item)">
        {{ item.text }}
        <CsIcon v-if="item.external" name="external" size="small" />
      </li>
    </template>
  </ul>
</template>

<script setup lang="ts">
/**
 * A right-click menu, the way the EC2 console's instance list and the S3 object
 * list offer one: the same entries as the "Actions" dropdown, at the pointer.
 *
 * Positioned inside the `.awsc` root (fixed coordinates clamped to it), so it
 * can never be drawn under the browser frame's edge on a narrow pane.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import CsIcon from './CsIcon.vue';
import type { DdItem } from './CsDropdown.vue';

const props = defineProps<{ items: DdItem[] }>();
const emit = defineEmits<{ (e: 'select', id: string): void; (e: 'close'): void }>();

const open = ref(false);
const menu = ref<HTMLElement | null>(null);
const pos = ref({ x: 0, y: 0 });

async function show(event: MouseEvent) {
  pos.value = { x: 0, y: 0 };
  open.value = true;
  await nextTick();
  const el = menu.value;
  const box = el?.closest('.awsc')?.getBoundingClientRect();
  const parent = (el?.offsetParent as HTMLElement | null)?.getBoundingClientRect();
  if (!el || !box || !parent) return;
  // Absolutely positioned against its offset parent (never `fixed`: an ancestor with
  // a transform would re-anchor that), clamped to the console's own box.
  let x = event.clientX;
  let y = event.clientY;
  if (x + el.offsetWidth > box.right - 8) x = Math.max(box.left + 8, box.right - 8 - el.offsetWidth);
  if (y + el.offsetHeight > box.bottom - 8) y = Math.max(box.top + 8, y - el.offsetHeight);
  pos.value = { x: x - parent.left, y: y - parent.top };
  (el.querySelector('.cs-ctx__item:not(.is-disabled)') as HTMLElement | null)?.focus();
}
function close() {
  if (!open.value) return;
  open.value = false;
  emit('close');
}
function pick(item: DdItem) {
  if (item.disabled || item.group) return;
  close();
  emit('select', item.id);
}
function outside(event: MouseEvent) {
  if (menu.value && !menu.value.contains(event.target as Node)) close();
}
function onScroll() { close(); }
onMounted(() => {
  document.addEventListener('mousedown', outside, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', outside, true);
  document.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', onScroll);
});

defineExpose({ show, close });
void props;
</script>

<style scoped>
.cs-ctx { position: absolute; z-index: 60; min-width: 220px; max-width: 320px; max-height: 70vh; overflow-y: auto; margin: 0; padding: 4px 0; list-style: none; background: #fff; border: 1px solid #c6c6cd; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 7, 22, .22); font-size: 14px; text-align: left; }
.cs-ctx__item { padding: 5px 16px; min-height: 30px; color: #0f141a; cursor: pointer; display: flex; gap: 6px; align-items: center; white-space: nowrap; border: 1px solid transparent; outline: none; }
.cs-ctx__item:hover:not(.is-disabled), .cs-ctx__item:focus:not(.is-disabled) { background: #f0fbff; border-color: #006ce0; border-radius: 4px; }
.cs-ctx__item.is-disabled { color: #b4b4bb; cursor: default; }
.cs-ctx__item.is-nested { padding-left: 28px; }
.cs-ctx__group { padding: 6px 16px 2px; font-weight: 700; color: #424650; border-top: 1px solid #ebebf0; }
.cs-ctx__group:first-child { border-top: 0; }
</style>
