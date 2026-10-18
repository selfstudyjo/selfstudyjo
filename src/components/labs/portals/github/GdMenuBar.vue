<template>
  <div class="gd-title">
    <GdIcon name="mark" :size="16" class="gd-title__logo" />
    <button type="button" class="gd-title__burger" aria-label="Application menu" @click="toggle(open ? '' : menus[0].label)">
      <GdIcon name="menu" :size="16" />
    </button>
    <nav class="gd-title__menus" aria-label="Application menu">
      <div v-for="menu in menus" :key="menu.label" class="gd-title__menu">
        <button type="button" class="gd-title__item" :class="{ 'is-open': open === menu.label }"
                :aria-expanded="open === menu.label" @click="toggle(menu.label)"
                @mouseenter="open && (open = menu.label)">{{ menu.label }}</button>
        <ul v-if="open === menu.label" class="gd-title__drop" role="menu">
          <template v-for="(item, i) in menu.items" :key="i">
            <li v-if="item.separator" class="gd-title__sep" role="separator"></li>
            <li v-else role="none">
              <button type="button" role="menuitem" class="gd-title__entry" :disabled="item.disabled" @click="pick(item)">
                <span>{{ item.label }}</span><kbd v-if="item.shortcut">{{ item.shortcut }}</kbd>
              </button>
            </li>
          </template>
        </ul>
      </div>
    </nav>
    <span class="gd-title__name">GitHub Desktop</span>
    <span class="gd-title__window" aria-hidden="true"><i>&#8211;</i><i>&#9633;</i><i>&#10005;</i></span>
    <div v-if="open" class="gd-title__catch" @mousedown="open = ''"></div>
  </div>
</template>

<script setup lang="ts">
/** The Windows title bar with GitHub Desktop's File / Edit / View / Repository / Branch / Help menus. */
import { ref } from 'vue';
import GdIcon from './GdIcon.vue';
import type { MenuItem } from './gd';

defineProps<{ menus: { label: string; items: MenuItem[] }[] }>();

const open = ref('');

function toggle(label: string) {
  open.value = open.value === label ? '' : label;
}

function pick(item: MenuItem) {
  open.value = '';
  item.action?.();
}
</script>

<style scoped>
.gd-title {
  display: flex; align-items: center; height: 30px; background: var(--gd-toolbar); color: #fff; flex: none;
  position: relative; z-index: 30; font-size: 12px; user-select: none;
}
.gd-title__logo { margin: 0 8px 0 10px; }
.gd-title__burger { display: none; border: 0; background: none; color: #fff; padding: 4px 8px; }
.gd-title__menus { display: flex; height: 100%; }
.gd-title__menu { position: relative; height: 100%; }
.gd-title__item {
  height: 100%; border: 0; border-radius: 0; background: none; color: #fff; padding: 0 9px; font-size: 12px; font-weight: 400; cursor: default;
}
.gd-title__item:hover, .gd-title__item.is-open { background: var(--gd-toolbar-hover); }
.gd-title__drop {
  position: absolute; left: 0; top: 100%; z-index: 2; list-style: none; margin: 0; padding: 4px 0; min-width: 240px;
  background: #fff; color: var(--gd-text); border: 1px solid rgba(27, 31, 35, 0.15); box-shadow: 0 3px 12px rgba(27, 31, 35, 0.2);
}
.gd-title__entry {
  width: 100%; display: flex; justify-content: space-between; gap: 24px; border: 0; background: none; text-align: left;
  padding: 4px 20px; font-size: 12px; color: var(--gd-text); cursor: default; line-height: 18px;
}
.gd-title__entry:hover:not(:disabled) { background: var(--gd-blue); color: #fff; }
.gd-title__entry:disabled { color: #a3aab1; }
.gd-title__entry kbd { font: inherit; opacity: 0.75; }
.gd-title__sep { height: 1px; background: var(--gd-border); margin: 4px 0; }
.gd-title__name { flex: 1; text-align: center; color: #d1d5da; pointer-events: none; }
.gd-title__window { display: flex; height: 100%; }
.gd-title__window i { font-style: normal; width: 40px; display: grid; place-items: center; color: #d1d5da; font-size: 11px; }
.gd-title__catch { position: fixed; inset: 0; z-index: 1; }
.gd-title__menu:has(.gd-title__drop) { z-index: 3; }
@container sl-portal (max-width: 700px) {
  .gd-title__menus { position: absolute; left: 30px; top: 0; height: 30px; }
  .gd-title__item { display: none; }
  .gd-title__burger { display: inline-flex; }
  .gd-title__menus:has(.gd-title__drop) .gd-title__item { display: block; background: var(--gd-toolbar); }
  .gd-title__name { display: none; }
  .gd-title__window { margin-left: auto; }
}
</style>
