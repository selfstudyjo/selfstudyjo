<template>
  <div ref="menu" class="rm" role="menu" :aria-label="label" :style="style" @contextmenu.prevent>
    <div v-if="title" class="rm__title">{{ title }}</div>
    <template v-for="item in items" :key="item.id">
      <div v-if="item.group" class="rm__group" role="presentation">{{ item.text }}</div>
      <div v-else-if="item.divider" class="rm__divider" role="separator" />
      <button v-else type="button" class="rm__item" role="menuitem" :class="{ 'is-nested': item.nested, 'is-danger': item.danger }"
              :disabled="item.disabled" :title="item.disabledReason || ''" @click="pick(item)">
        <span>{{ item.text }}</span>
        <kbd v-if="item.hint" class="rm__hint">{{ item.hint }}</kbd>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * A right-click menu, in Cloudscape's dropdown style.
 *
 * Positioned `fixed` and then corrected by measuring where it actually landed:
 * the portal frame is a size container (and may be full screen), which makes
 * it the containing block for fixed descendants, so client coordinates cannot
 * be used as they are. It closes on Escape, on any press outside it, on scroll
 * and on resize - the same ways the real dropdowns do.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { MenuItem } from './rowmenu';

const props = withDefaults(defineProps<{ items: MenuItem[]; x: number; y: number; title?: string; label?: string }>(),
  { title: '', label: 'Actions' });
const emit = defineEmits<{ (e: 'select', id: string): void; (e: 'close'): void }>();

const menu = ref<HTMLElement | null>(null);
const left = ref(props.x);
const top = ref(props.y);
const ready = ref(false);
const style = computed(() => ({ left: `${left.value}px`, top: `${top.value}px`, visibility: (ready.value ? 'visible' : 'hidden') as 'visible' | 'hidden' }));

function pick(item: MenuItem) {
  if (item.disabled) return;
  emit('select', item.id);
  emit('close');
}
function outside(event: Event) {
  if (menu.value && !menu.value.contains(event.target as Node)) emit('close');
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const buttons = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('.rm__item:not(:disabled)') || []);
    if (!buttons.length) return;
    event.preventDefault();
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? (at + 1) % buttons.length : (at - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  }
}
function close() { emit('close'); }
function scrolled(event: Event) {
  if (menu.value && menu.value.contains(event.target as Node)) return;
  emit('close');
}

onMounted(async () => {
  await nextTick();
  const el = menu.value;
  if (!el) return;
  // Where did (x, y) actually land? Correct for the containing block.
  const landed = el.getBoundingClientRect();
  let x = props.x + (props.x - landed.left);
  let y = props.y + (props.y - landed.top);
  const width = landed.width;
  const height = landed.height;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (props.x + width > vw - 8) x -= width;
  if (props.y + height > vh - 8) y -= Math.min(height, props.y - 8);
  left.value = x;
  top.value = y;
  ready.value = true;
  el.querySelector<HTMLButtonElement>('.rm__item:not(:disabled)')?.focus();
  document.addEventListener('mousedown', outside, true);
  document.addEventListener('keydown', key, true);
  window.addEventListener('resize', close);
  document.addEventListener('scroll', scrolled, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', outside, true);
  document.removeEventListener('keydown', key, true);
  window.removeEventListener('resize', close);
  document.removeEventListener('scroll', scrolled, true);
});
</script>

<style scoped>
.rm { position: fixed; z-index: 80; min-width: 220px; max-width: 320px; max-height: 70vh; overflow: auto; padding: 4px 0;
  background: #fff; border: 1px solid #c6c6cd; border-radius: 8px; box-shadow: 0 4px 20px 1px rgba(0, 7, 22, .18);
  font-family: 'Amazon Ember', 'Open Sans', 'Helvetica Neue', Roboto, Arial, sans-serif; font-size: 14px; color: #0f141a; text-align: left; }
.rm__title { padding: 6px 16px 4px; font-weight: 700; color: #424650; font-size: 12px; border-bottom: 1px solid #ebebf0; margin-bottom: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rm__group { padding: 6px 16px 2px; font-weight: 700; color: #424650; font-size: 12px; }
.rm__divider { height: 1px; margin: 4px 0; background: #ebebf0; }
.rm__item { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 30px; padding: 5px 16px;
  border: 1px solid transparent; background: none; color: #0f141a; font: inherit; text-align: left; cursor: pointer; white-space: nowrap; }
.rm__item.is-nested { padding-left: 28px; }
.rm__item.is-danger { color: #db0000; }
.rm__item:hover:not(:disabled), .rm__item:focus-visible { background: #f0fbff; border-color: #006ce0; color: #002b66; outline: none; }
.rm__item:disabled { color: #8c8c94; cursor: default; }
.rm__hint { font: 12px Monaco, Menlo, Consolas, monospace; color: #656871; background: none; border: 0; padding: 0; }
</style>
