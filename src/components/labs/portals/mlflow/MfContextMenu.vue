<template>
  <div ref="el" class="mf-ctx" role="menu" :aria-label="label || 'Actions'" :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
       @keydown="onKey" @contextmenu.prevent>
    <template v-for="(item, i) in items" :key="i">
      <hr v-if="item.divider" class="mf-ctx__hr" />
      <span v-else-if="item.heading" class="mf-ctx__heading">{{ item.heading }}</span>
      <button v-else type="button" role="menuitem" class="mf-ctx__item" :class="{ 'is-danger': item.danger }"
              :disabled="item.disabled" :title="item.title || ''" @click="pick(item)">
        <MfIcon v-if="item.icon" :name="item.icon" />
        <span v-else class="mf-ctx__noicon"></span>
        <span class="mf-ctx__label">{{ item.label }}</span>
        <kbd v-if="item.hint" class="mf-ctx__hint">{{ item.hint }}</kbd>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * The row menu MLflow opens from a row's "⋮" button or a right-click: one
 * instance for the whole UI, drawn by MlflowUi at a point relative to its own
 * root (the portal frame is a size container, so `position: fixed` would be
 * relative to the frame anyway - absolute inside `.mf-app` says what it means).
 * Kept on screen by measuring itself after it renders.
 */
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import type { MenuItem } from './mfContext';

const props = defineProps<{ x: number; y: number; items: MenuItem[]; boundW: number; boundH: number; label?: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();

const el = ref<HTMLElement | null>(null);
const pos = reactive({ x: props.x, y: props.y });

function buttons(): HTMLButtonElement[] {
  return Array.from(el.value?.querySelectorAll<HTMLButtonElement>('button.mf-ctx__item:not(:disabled)') || []);
}

function pick(item: MenuItem) {
  if (item.disabled) return;
  emit('close');
  item.action?.();
}

function onKey(event: KeyboardEvent) {
  const list = buttons();
  const at = list.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === 'ArrowDown') { event.preventDefault(); list[(at + 1) % list.length]?.focus(); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); list[(at - 1 + list.length) % list.length]?.focus(); }
  else if (event.key === 'Home') { event.preventDefault(); list[0]?.focus(); }
  else if (event.key === 'End') { event.preventDefault(); list[list.length - 1]?.focus(); }
  else if (event.key === 'Tab') { emit('close'); }
}

function onOutside(event: Event) {
  if (el.value && !el.value.contains(event.target as Node)) emit('close');
}
function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}

onMounted(async () => {
  await nextTick();
  const box = el.value;
  if (box) {
    const w = box.offsetWidth; const h = box.offsetHeight;
    pos.x = Math.max(4, Math.min(props.x, props.boundW - w - 4));
    pos.y = props.y + h > props.boundH - 4 ? Math.max(4, props.y - h) : props.y;
  }
  buttons()[0]?.focus({ preventScroll: true });
  // Registered on the next tick so the click that opened the menu does not close it.
  window.setTimeout(() => {
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('wheel', onOutside, { capture: true, passive: true });
  });
  window.addEventListener('keydown', onEscape);
  window.addEventListener('resize', close);
});
function close() { emit('close'); }
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onOutside, true);
  document.removeEventListener('wheel', onOutside, true);
  window.removeEventListener('keydown', onEscape);
  window.removeEventListener('resize', close);
});
</script>

<style scoped>
.mf-ctx {
  position: absolute; z-index: 70; min-width: 180px; max-width: 280px; padding: 4px 0;
  background: var(--mf-bg); border: 1px solid var(--mf-border-light); border-radius: var(--mf-radius);
  box-shadow: var(--mf-shadow-lg); display: flex; flex-direction: column; font-size: 13px;
}
.mf-ctx__item {
  display: flex; align-items: center; gap: 8px; border: 0; background: none; text-align: left; padding: 6px 12px;
  font: inherit; color: var(--mf-text); cursor: pointer; white-space: nowrap; min-height: 32px;
}
.mf-ctx__item:hover:not(:disabled), .mf-ctx__item:focus-visible { background: var(--mf-row-hover); outline: none; }
.mf-ctx__item:disabled { color: var(--mf-text-3); cursor: not-allowed; }
.mf-ctx__item.is-danger { color: var(--mf-danger); }
.mf-ctx__item.is-danger:disabled { color: var(--mf-text-3); }
.mf-ctx__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.mf-ctx__noicon { width: 16px; flex: none; }
.mf-ctx__hint { font: 11px var(--mf-mono); color: var(--mf-text-3); background: none; border: 0; }
.mf-ctx__heading { padding: 6px 12px 2px; font-size: 12px; color: var(--mf-text-2); font-weight: 600; }
.mf-ctx__hr { border: 0; border-top: 1px solid var(--mf-border-light); margin: 4px 0; }
</style>
