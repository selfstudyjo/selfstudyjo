<template>
  <div ref="root" class="cs-dd" @keydown.esc="open = false">
    <button type="button" class="cs-btn" :class="{ 'cs-btn--primary': primary }" :disabled="disabled"
            :aria-expanded="open" aria-haspopup="menu" @click="open = !open">
      {{ label }} <CsIcon name="caret-down" class="cs-dd__caret" />
    </button>
    <ul v-if="open" class="cs-dd__menu" :class="{ 'cs-dd__menu--left': alignLeft }" role="menu">
      <template v-for="item in items" :key="item.id">
        <li v-if="item.group" class="cs-dd__group" role="presentation">{{ item.text }}</li>
        <li v-else role="menuitem" class="cs-dd__item" :class="{ 'is-disabled': item.disabled, 'is-nested': item.nested }"
            :aria-disabled="item.disabled" :title="item.disabledReason || undefined"
            @click="pick(item)">
          {{ item.text }}
          <CsIcon v-if="item.external" name="external" size="small" />
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
/** Cloudscape's button dropdown - the "Actions ▾" and "Instance state ▾" menus. */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import CsIcon from './CsIcon.vue';

export interface DdItem {
  id: string;
  text: string;
  disabled?: boolean;
  disabledReason?: string;
  group?: boolean;
  nested?: boolean;
  external?: boolean;
}

withDefaults(defineProps<{
  label?: string; items: DdItem[]; disabled?: boolean; primary?: boolean; alignLeft?: boolean;
}>(), { label: 'Actions', disabled: false, primary: false, alignLeft: false });
const emit = defineEmits<{ (e: 'select', id: string): void }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function pick(item: DdItem) {
  if (item.disabled || item.group) return;
  open.value = false;
  emit('select', item.id);
}
function outside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener('mousedown', outside));
onBeforeUnmount(() => document.removeEventListener('mousedown', outside));
</script>

<style scoped>
.cs-dd { position: relative; display: inline-block; }
.cs-dd__caret { margin-left: 4px; }
.cs-dd__menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 40; min-width: 220px; max-width: 320px; margin: 0; padding: 4px 0; list-style: none; background: #fff; border: 1px solid #c6c6cd; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 7, 22, .18); }
.cs-dd__menu--left { right: auto; left: 0; }
.cs-dd__item { padding: 5px 16px; color: #0f141a; cursor: pointer; font-size: 14px; display: flex; gap: 6px; align-items: center; white-space: nowrap; border: 1px solid transparent; }
.cs-dd__item:hover:not(.is-disabled) { background: #f0fbff; border-color: #006ce0; border-radius: 4px; }
.cs-dd__item.is-disabled { color: #b4b4bb; cursor: default; }
.cs-dd__item.is-nested { padding-left: 28px; }
.cs-dd__group { padding: 6px 16px 2px; font-weight: 700; color: #424650; font-size: 14px; border-top: 1px solid #ebebf0; }
.cs-dd__group:first-child { border-top: 0; }
</style>
