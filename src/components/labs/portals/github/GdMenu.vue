<template>
  <div class="gd-menu-catch" @mousedown.self="$emit('close')" @contextmenu.prevent="$emit('close')">
    <ul class="gd-menu" role="menu" :style="style">
      <template v-for="(item, i) in items" :key="i">
        <li v-if="item.separator" class="gd-menu__sep" role="separator"></li>
        <li v-else role="none">
          <button type="button" role="menuitem" class="gd-menu__item" :class="{ 'is-danger': item.danger }"
                  :disabled="item.disabled" @click="pick(item)">
            <span>{{ item.label }}</span>
            <kbd v-if="item.shortcut">{{ item.shortcut }}</kbd>
          </button>
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
/** The native-looking context menu GitHub Desktop pops on a right-click. */
import { computed } from 'vue';
import type { MenuItem } from './gd';

const props = defineProps<{ items: MenuItem[]; x: number; y: number }>();
const emit = defineEmits<{ (event: 'close'): void }>();

const style = computed(() => ({ left: `${props.x}px`, top: `${props.y}px` }));

function pick(item: MenuItem) {
  emit('close');
  item.action?.();
}
</script>

<style scoped>
.gd-menu-catch { position: absolute; inset: 0; z-index: 60; }
.gd-menu {
  position: absolute; list-style: none; margin: 0; padding: 4px 0; min-width: 200px; max-width: 280px;
  background: #fff; border: 1px solid rgba(27, 31, 35, 0.15); border-radius: 4px;
  box-shadow: 0 3px 12px rgba(27, 31, 35, 0.15); font-size: 12px;
}
.gd-menu__sep { height: 1px; background: var(--gd-border); margin: 4px 0; }
.gd-menu__item {
  width: 100%; display: flex; justify-content: space-between; gap: 16px; padding: 4px 20px;
  border: 0; background: none; text-align: left; color: var(--gd-text); cursor: default; line-height: 18px;
}
.gd-menu__item:hover:not(:disabled) { background: var(--gd-blue); color: #fff; }
.gd-menu__item:disabled { color: #a3aab1; }
.gd-menu__item.is-danger:hover:not(:disabled) { background: var(--gd-red); }
.gd-menu__item kbd { font: inherit; color: inherit; opacity: 0.7; }
</style>
