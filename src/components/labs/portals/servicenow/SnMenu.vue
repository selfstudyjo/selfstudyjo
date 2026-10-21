<template>
  <div ref="menu" class="snm" role="menu" :aria-label="label" :style="style" @contextmenu.prevent>
    <template v-for="item in items" :key="item.id">
      <div v-if="item.divider" class="snm__divider" role="separator" />
      <div v-else-if="item.heading" class="snm__heading" role="presentation">{{ item.text }}</div>
      <button v-else type="button" class="snm__item" role="menuitem" :class="{ 'is-sub': item.sub }" :disabled="item.disabled" @click="pick(item)">
        {{ item.text }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * The platform's context menu (right-click on a list header, a list cell or a
 * form header), in the Next Experience style.
 *
 * Positioned `fixed` and then corrected by measuring where it landed: the
 * portal frame is a size container (and may be full screen), which makes it
 * the containing block for fixed descendants. Closes on Escape, on a press
 * outside it, on scroll and on resize.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

export interface SnMenuItem { id: string; text?: string; disabled?: boolean; divider?: boolean; heading?: boolean; sub?: boolean }

const props = withDefaults(defineProps<{ items: SnMenuItem[]; x: number; y: number; label?: string }>(), { label: 'Context menu' });
const emit = defineEmits<{ (e: 'select', id: string): void; (e: 'close'): void }>();

const menu = ref<HTMLElement | null>(null);
const left = ref(props.x);
const top = ref(props.y);
const ready = ref(false);
const style = computed(() => ({ left: `${left.value}px`, top: `${top.value}px`, visibility: (ready.value ? 'visible' : 'hidden') as 'visible' | 'hidden' }));

function pick(item: SnMenuItem) {
  if (item.disabled) return;
  emit('select', item.id);
  emit('close');
}
function outside(event: Event) { if (menu.value && !menu.value.contains(event.target as Node)) emit('close'); }
function scrolled(event: Event) { if (!(menu.value && menu.value.contains(event.target as Node))) emit('close'); }
function close() { emit('close'); }
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return; }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const buttons = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('.snm__item:not(:disabled)') || []);
  if (!buttons.length) return;
  event.preventDefault();
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  buttons[event.key === 'ArrowDown' ? (at + 1) % buttons.length : (at - 1 + buttons.length) % buttons.length].focus();
}

onMounted(async () => {
  await nextTick();
  const el = menu.value;
  if (!el) return;
  const landed = el.getBoundingClientRect();
  let x = props.x + (props.x - landed.left);
  let y = props.y + (props.y - landed.top);
  if (props.x + landed.width > window.innerWidth - 8) x -= landed.width;
  if (props.y + landed.height > window.innerHeight - 8) y -= Math.min(landed.height, props.y - 8);
  left.value = x;
  top.value = y;
  ready.value = true;
  el.querySelector<HTMLButtonElement>('.snm__item:not(:disabled)')?.focus();
  document.addEventListener('mousedown', outside, true);
  document.addEventListener('keydown', key, true);
  document.addEventListener('scroll', scrolled, true);
  window.addEventListener('resize', close);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', outside, true);
  document.removeEventListener('keydown', key, true);
  document.removeEventListener('scroll', scrolled, true);
  window.removeEventListener('resize', close);
});
</script>

<style scoped>
.snm { position: fixed; z-index: 90; min-width: 208px; max-width: 320px; max-height: 70vh; overflow: auto; padding: 4px 0;
  background: #fff; border: 1px solid #c9cbd3; border-radius: 6px; box-shadow: 0 6px 24px rgba(20, 20, 40, .22);
  font-family: 'Lato', 'Source Sans Pro', 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1c1c28; text-align: left; }
.snm__item { display: block; width: 100%; padding: 6.4px 16px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.snm__item.is-sub { padding-left: 28px; }
.snm__item:hover:not(:disabled), .snm__item:focus-visible { background: #e8eaf6; outline: none; }
.snm__item:disabled { color: #9a9aac; cursor: not-allowed; }
.snm__divider { height: 1px; margin: 4px 0; background: #e3e4ea; }
.snm__heading { padding: 6px 16px 2px; color: #5c5c70; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; }
</style>
