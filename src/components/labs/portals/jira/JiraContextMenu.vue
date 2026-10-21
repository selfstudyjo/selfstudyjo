<template>
  <div ref="menu" class="jcm" role="menu" :aria-label="label" tabindex="-1"
       :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
       @keydown.down.prevent="step(1)" @keydown.up.prevent="step(-1)"
       @keydown.home.prevent="edge(0)" @keydown.end.prevent="edge(-1)"
       @keydown.esc.stop.prevent="$emit('close')" @keydown.tab.prevent="$emit('close')"
       @contextmenu.prevent>
    <template v-for="(item, index) in items" :key="item.value + index">
      <div v-if="item.section" class="jcm__heading">{{ item.section }}</div>
      <button type="button" role="menuitem" class="jcm__item" :class="{ 'is-danger': item.danger }"
              :disabled="item.disabled" :title="item.hint || undefined" @click.stop="choose(item)">
        <span>{{ item.label }}</span>
        <span v-if="item.hint && item.disabled" class="jcm__hint">{{ item.hint }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * A right-click menu, drawn at the pointer inside the Jira root.
 *
 * Positioned ABSOLUTELY against the skin's root rather than `fixed` against the
 * viewport: the portal frame is a size container, and a container is the
 * containing block for fixed descendants too, so `clientX` would land the menu
 * off by the frame's offset. The menu is clamped inside the root so a click at
 * the right or bottom edge still shows the whole list.
 */
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { DropMenuItem } from './jiraKit';

const props = defineProps<{ items: DropMenuItem[]; x: number; y: number; root: HTMLElement | null; label?: string }>();
const emit = defineEmits<{ (event: 'select', value: string): void; (event: 'close'): void }>();
const menu = ref<HTMLElement | null>(null);
const pos = reactive({ x: 0, y: 0 });

function place() {
  const box = props.root?.getBoundingClientRect();
  const left = box ? props.x - box.left : props.x;
  const top = box ? props.y - box.top : props.y;
  const width = menu.value?.offsetWidth || 220;
  const height = menu.value?.offsetHeight || 300;
  const maxX = (box?.width || window.innerWidth) - width - 4;
  const maxY = (box?.height || window.innerHeight) - height - 4;
  pos.x = Math.max(4, Math.min(left, maxX));
  pos.y = Math.max(4, Math.min(top, maxY));
}

function buttons() {
  return Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('.jcm__item:not(:disabled)') || []);
}
function step(delta: number) {
  const list = buttons();
  if (!list.length) return;
  const at = list.indexOf(document.activeElement as HTMLButtonElement);
  list[(at + delta + list.length) % list.length].focus();
}
function edge(index: number) {
  const list = buttons();
  if (list.length) list[index < 0 ? list.length - 1 : 0].focus();
}
function choose(item: DropMenuItem) {
  if (item.disabled) return;
  emit('select', item.value);
}

function onOutside(event: MouseEvent) {
  if (menu.value && !menu.value.contains(event.target as Node)) emit('close');
}
function onScroll() { emit('close'); }

onMounted(() => {
  place();
  nextTick(() => { place(); buttons()[0]?.focus(); });
  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onOutside, true);
  document.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', onScroll);
});
</script>

<style scoped>
.jcm {
  position: absolute; z-index: 90; min-width: 200px; max-width: 300px; max-height: min(420px, 80%);
  overflow: auto; padding: 4px 0; background: var(--j-surface-overlay); border-radius: 4px;
  box-shadow: 0 8px 12px rgba(30, 31, 33, 0.15), 0 0 1px rgba(30, 31, 33, 0.31); outline: none; text-align: left;
}
.jcm__heading { padding: 10px 16px 4px; font-size: 12px; font-weight: 653; color: var(--j-text-subtlest); text-transform: uppercase; }
.jcm__item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; min-height: 32px;
  padding: 6px 16px; border: 0; border-left: 2px solid transparent; background: transparent; color: var(--j-text);
  font: inherit; font-size: 14px; text-align: left; cursor: pointer;
}
.jcm__item:hover, .jcm__item:focus-visible { background: var(--j-neutral-hover); border-left-color: var(--j-brand); outline: none; }
.jcm__item.is-danger { color: var(--j-danger-text); }
.jcm__item:disabled { color: var(--j-text-disabled); cursor: not-allowed; background: transparent; border-left-color: transparent; }
.jcm__hint { font-size: 12px; color: var(--j-text-subtlest); white-space: normal; }
</style>
