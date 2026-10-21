<template>
  <div ref="root" class="fx-menu fxm" role="menu" :style="{ top: at.y + 'px', left: at.x + 'px' }"
       @click.stop @contextmenu.prevent>
    <template v-for="(entry, i) in items" :key="i">
      <hr v-if="entry.sep" />
      <div v-else-if="entry.heading" class="fxm__head">{{ entry.label }}</div>
      <button v-else type="button" role="menuitem" :class="{ 'is-danger': entry.danger }"
              :disabled="entry.disabled" :title="entry.title || undefined" @click="pick(entry)">
        <FxIcon :name="entry.icon || 'blank'" :size="16" />
        <span class="fxm__label">{{ entry.label }}</span>
        <span v-if="entry.hint" class="fxm__hint">{{ entry.hint }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * A Fluent context menu - the "..." (More options) and right-click menu every
 * explorer row, list row and canvas node in Fabric has. Positioned against the
 * shell's `.fx-body` (see `menuAt` in menu.ts); closes on Escape, on a click
 * anywhere outside it, and after an entry is chosen.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import FxIcon from './FxIcon.vue';
import type { MenuAt, MenuEntry } from './menu';

defineProps<{ at: MenuAt; items: MenuEntry[] }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const root = ref<HTMLElement | null>(null);

function pick(entry: MenuEntry) {
  emit('close');
  entry.action?.();
}
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') emit('close'); }
function onDown(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) emit('close');
}
onMounted(() => {
  window.addEventListener('keydown', onKey);
  // Next tick: the click that opened the menu must not close it.
  setTimeout(() => window.addEventListener('mousedown', onDown), 0);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('mousedown', onDown);
});
</script>

<style scoped>
.fxm { max-height: calc(100% - 8px); overflow: auto; }
.fxm__label { flex: 1; white-space: nowrap; }
.fxm__hint { color: #707070; font-size: 12px; margin-left: 16px; }
.fxm__head { padding: 6px 12px 2px; font-size: 12px; font-weight: 600; color: #616161; }
</style>
