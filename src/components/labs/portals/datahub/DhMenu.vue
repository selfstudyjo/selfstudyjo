<template>
  <div ref="el" class="dh-more">
    <button type="button" class="dh-more__btn" :aria-label="label" :aria-expanded="open" @click.stop="open = !open">
      <DhIcon name="more" :size="16" />
    </button>
    <div v-if="open" class="dh-more__drop" role="menu" @click.stop>
      <template v-for="(item, i) in items" :key="i">
        <div v-if="item.divider" class="dh-more__sep" role="separator"></div>
        <button v-else type="button" role="menuitem" class="dh-more__item" :class="{ 'is-danger': item.danger }"
                :disabled="item.disabled" @click="pick(item)">
          <DhIcon v-if="item.icon" :name="item.icon" :size="14" /><span>{{ item.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The "..." dropdown DataHub puts on an entity header and on list rows (antd Dropdown). */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import type { DhMenuItem } from './dhContext';


withDefaults(defineProps<{ items: DhMenuItem[]; label?: string }>(), { label: 'More actions' });
const open = ref(false);
const el = ref<HTMLElement | null>(null);

function pick(item: DhMenuItem) {
  open.value = false;
  if (!item.disabled) item.run?.();
}
function onDown(event: MouseEvent) {
  if (open.value && el.value && !el.value.contains(event.target as Node)) open.value = false;
}
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') open.value = false; }
onMounted(() => { window.addEventListener('mousedown', onDown, true); window.addEventListener('keydown', onKey); });
onBeforeUnmount(() => { window.removeEventListener('mousedown', onDown, true); window.removeEventListener('keydown', onKey); });
</script>

<style scoped>
.dh-more { position: relative; display: inline-flex; }
.dh-more__btn { width: 32px; height: 32px; border: 1px solid var(--dh-border); border-radius: 6px; background: #fff; color: var(--dh-text-2); cursor: pointer; display: grid; place-items: center; }
.dh-more__btn:hover { border-color: var(--dh-primary); color: var(--dh-primary); }
.dh-more__drop {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 40; min-width: 190px; padding: 4px; background: #fff;
  border-radius: 8px; box-shadow: 0 6px 16px rgba(0, 0, 0, .08), 0 3px 6px -4px rgba(0, 0, 0, .12), 0 9px 28px 8px rgba(0, 0, 0, .05);
  display: flex; flex-direction: column;
}
.dh-more__item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border: 0; border-radius: 4px; background: none; font: inherit; font-size: 14px; color: var(--dh-text); text-align: left; cursor: pointer; white-space: nowrap; }
.dh-more__item:hover:not(:disabled) { background: var(--dh-hover); }
.dh-more__item:disabled { color: #bfbfbf; cursor: not-allowed; }
.dh-more__item.is-danger { color: var(--dh-danger); }
.dh-more__item.is-danger:hover:not(:disabled) { background: #fff1f0; }
.dh-more__sep { height: 1px; margin: 4px 0; background: var(--dh-border); }
</style>
