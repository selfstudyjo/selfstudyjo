<template>
  <ul class="pg-menu" role="menu" :style="{ left: x + 'px', top: y + 'px' }" @mousedown.stop @contextmenu.prevent>
    <template v-for="(item, i) in items" :key="i">
      <li v-if="item.sep" class="pg-menu__sep" role="separator" />
      <li v-else class="pg-menu__item" :class="{ 'is-disabled': item.disabled, 'has-sub': item.children }" role="none"
          @mouseenter="open = item.children ? i : -1">
        <button type="button" role="menuitem" class="pg-menu__btn" :disabled="item.disabled"
                :aria-haspopup="item.children ? 'menu' : undefined" @click="choose(item, i)">
          <span class="pg-menu__icon"><PgIcon v-if="item.icon" :name="item.icon" :size="14" /></span>
          <span class="pg-menu__label">{{ item.label }}</span>
          <span v-if="item.shortcut" class="pg-menu__key">{{ item.shortcut }}</span>
          <PgIcon v-if="item.children" name="chev-right" :size="12" class="pg-menu__arrow" />
        </button>
        <PgMenu v-if="item.children && open === i" :items="item.children" :x="subX" :y="0" class="pg-menu--sub"
                @close="$emit('close')" />
      </li>
    </template>
  </ul>
</template>

<script setup lang="ts">
/**
 * pgAdmin's context menu (and the menubar's drop-downs): a flat list with
 * separators and fly-out sub-menus ("Create >", "Scripts >", "View/Edit Data >").
 */
import { ref } from 'vue';
import PgIcon from './PgIcon.vue';
import type { MenuItem } from './pgContext';

withDefaults(defineProps<{ items: MenuItem[]; x: number; y: number }>(), {});
const emit = defineEmits<{ (event: 'close'): void }>();

const open = ref(-1);
const subX = 216;

function choose(item: MenuItem, index: number) {
  if (item.disabled) return;
  if (item.children) {
    open.value = index;
    return;
  }
  emit('close');
  item.action?.();
}
</script>

<style scoped>
.pg-menu {
  position: absolute; z-index: 80; margin: 0; padding: 4px 0; list-style: none; min-width: 216px; max-width: 280px;
  background: #fff; border: 1px solid var(--pg-border); border-radius: var(--pg-radius);
  box-shadow: 0 4px 12px rgba(0, 0, 0, .18); font-size: 13px; color: var(--pg-text);
}
.pg-menu--sub { top: -5px !important; }
.pg-menu__item { position: relative; }
.pg-menu__btn {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 12px 5px 8px; border: 0; background: none;
  font: inherit; color: inherit; text-align: left; cursor: pointer;
}
.pg-menu__btn:hover:not(:disabled), .pg-menu__item.has-sub:hover > .pg-menu__btn { background: var(--pg-primary-light); }
.pg-menu__btn:disabled { color: var(--pg-grey-800); cursor: default; }
.pg-menu__icon { width: 16px; display: inline-flex; justify-content: center; color: var(--pg-muted); }
.pg-menu__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pg-menu__key { color: var(--pg-muted); font-size: 11.5px; }
.pg-menu__arrow { color: var(--pg-muted); }
.pg-menu__sep { height: 1px; margin: 4px 0; background: var(--pg-border); }
</style>
