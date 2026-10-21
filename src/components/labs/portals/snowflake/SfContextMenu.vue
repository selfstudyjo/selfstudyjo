<template>
  <div ref="el" class="sf-cm" role="menu" :style="{ left: pos.x + 'px', top: pos.y + 'px' }" @mousedown.stop @contextmenu.prevent>
    <div v-if="title" class="sf-cm__title" :title="title">{{ title }}</div>
    <template v-for="(item, i) in items" :key="i">
      <hr v-if="item.sep" class="sf-cm__sep" />
      <button v-else type="button" role="menuitem" class="sf-cm__item" :class="{ 'is-danger': item.danger }" :disabled="item.disabled"
              :title="item.hint || ''" @click="choose(item)">
        <SfIcon :name="item.icon || 'dot'" :class="{ 'sf-cm__blank': !item.icon }" />
        <span class="sf-cm__label">{{ item.label }}</span>
        <span v-if="item.shortcut" class="sf-cm__key">{{ item.shortcut }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Snowsight's object context menu (right-click on a database, schema, table,
 * stage or warehouse in the object explorer). Positioned inside the app at
 * the pointer and kept inside it, so no item is ever clipped by the frame.
 */
import { nextTick, onMounted, reactive, ref } from 'vue';
import SfIcon from './SfIcon.vue';
import type { SfMenuItem } from './sfContext';

const props = defineProps<{ items: SfMenuItem[]; x: number; y: number; bounds: { width: number; height: number }; title?: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const el = ref<HTMLElement | null>(null);
const pos = reactive({ x: props.x, y: props.y });

onMounted(() => nextTick(() => {
  const box = el.value;
  if (!box) return;
  pos.x = Math.max(4, Math.min(props.x, props.bounds.width - box.offsetWidth - 4));
  pos.y = Math.max(4, Math.min(props.y, props.bounds.height - box.offsetHeight - 4));
  (box.querySelector('button:not(:disabled)') as HTMLElement | null)?.focus();
}));

function choose(item: SfMenuItem) {
  if (item.disabled) return;
  emit('close');
  item.action?.();
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.sf-cm {
  position: absolute; z-index: 95; min-width: 220px; max-width: 300px; padding: 4px; background: var(--sf-bg);
  border: 1px solid var(--sf-border); border-radius: var(--sf-radius-lg); box-shadow: var(--sf-shadow); max-height: calc(100% - 8px); overflow-y: auto;
}
.sf-cm__title { padding: 4px 8px 6px; font-size: 11px; font-weight: 600; color: var(--sf-text-3); text-transform: uppercase; letter-spacing: .04em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-cm__item {
  display: flex; align-items: center; gap: 8px; width: 100%; height: 30px; padding: 0 8px; border: 0; border-radius: 4px; background: none;
  font: inherit; font-size: 13px; color: var(--sf-text); cursor: pointer; text-align: left; white-space: nowrap;
}
.sf-cm__item:hover:not(:disabled), .sf-cm__item:focus-visible { background: var(--sf-hover); outline: none; }
.sf-cm__item:disabled { color: var(--sf-text-3); cursor: default; }
.sf-cm__item .sf-ico { width: 15px; height: 15px; color: var(--sf-text-2); flex: none; }
.sf-cm__item.is-danger { color: var(--sf-danger-text); }
.sf-cm__item.is-danger .sf-ico { color: var(--sf-danger); }
.sf-cm__blank { visibility: hidden; }
.sf-cm__label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.sf-cm__key { color: var(--sf-text-3); font-size: 11px; }
.sf-cm__sep { border: 0; border-top: 1px solid var(--sf-border); margin: 4px 0; }
</style>
