<template>
  <div ref="root" class="jd" :class="{ 'is-open': open }">
    <button ref="trigger" type="button" class="jd__trigger" :class="triggerClass"
            :disabled="disabled" :aria-haspopup="'menu'" :aria-expanded="open"
            :aria-label="label || undefined" :title="label || undefined"
            @click.stop="toggle" @keydown.down.prevent="openAt(0)">
      <slot name="trigger">{{ label }}</slot>
    </button>
    <div v-if="open" class="jd__menu" :class="['jd__menu--' + align]" role="menu"
         @keydown.down.prevent="step(1)" @keydown.up.prevent="step(-1)"
         @keydown.esc.stop.prevent="close(true)" @keydown.tab="close(false)">
      <div v-if="heading" class="jd__heading">{{ heading }}</div>
      <template v-for="(item, index) in items" :key="String(item.value) + index">
        <div v-if="item.section" class="jd__heading">{{ item.section }}</div>
        <button type="button" role="menuitem" class="jd__item"
                :class="{ 'is-selected': item.value === selected, 'is-danger': item.danger }"
                :disabled="item.disabled" :title="item.hint || undefined"
                :data-index="index" @click.stop="choose(item)">
          <slot name="item" :item="item">
            <span class="jd__label">{{ item.label }}</span>
          </slot>
          <span v-if="item.hint && item.disabled" class="jd__hint">{{ item.hint }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Atlassian's dropdown menu: a trigger, a raised list, keyboard navigation
 * (arrows, Escape), and closing on an outside click. Used for status
 * transitions, assignee pickers and every "•••" menu.
 */
import { nextTick, onBeforeUnmount, ref } from 'vue';

export interface DropItem {
  label: string;
  value: string;
  disabled?: boolean;
  hint?: string;
  danger?: boolean;
  section?: string;
  [extra: string]: any;
}

const props = withDefaults(defineProps<{ items: DropItem[]; label?: string; selected?: string;
                                          disabled?: boolean; align?: 'left' | 'right';
                                          heading?: string; triggerClass?: string }>(),
                           { label: '', selected: '', disabled: false, align: 'left', heading: '',
                             triggerClass: '' });
const emit = defineEmits<{ (event: 'select', value: string, item: DropItem): void }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLElement | null>(null);

function onOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close(false);
}

function toggle() {
  if (open.value) close(false);
  else openAt(-1);
}

function openAt(index: number) {
  open.value = true;
  document.addEventListener('mousedown', onOutside);
  nextTick(() => {
    const buttons = root.value?.querySelectorAll<HTMLButtonElement>('.jd__item:not(:disabled)');
    if (buttons && buttons.length) buttons[Math.max(0, index)].focus();
  });
}

function close(refocus: boolean) {
  open.value = false;
  document.removeEventListener('mousedown', onOutside);
  if (refocus) trigger.value?.focus();
}

function step(delta: number) {
  const buttons = Array.from(root.value?.querySelectorAll<HTMLButtonElement>('.jd__item:not(:disabled)') || []);
  if (!buttons.length) return;
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  buttons[(at + delta + buttons.length) % buttons.length].focus();
}

function choose(item: DropItem) {
  if (item.disabled) return;
  close(true);
  emit('select', item.value, item);
}

onBeforeUnmount(() => document.removeEventListener('mousedown', onOutside));
defineExpose({ openAt, close });
void props;
</script>

<style scoped>
.jd { position: relative; display: inline-flex; }
.jd__trigger {
  display: inline-flex; align-items: center; gap: 4px; max-width: 100%; border: 0;
  background: transparent; color: inherit; font: inherit; cursor: pointer; padding: 0;
}
.jd__trigger:disabled { cursor: not-allowed; opacity: 0.6; }
.jd__menu {
  position: absolute; top: calc(100% + 4px); z-index: 40; min-width: 180px; max-width: 320px;
  max-height: 320px; overflow: auto; padding: 4px 0; background: var(--j-surface-overlay);
  border-radius: 4px; box-shadow: 0 8px 12px rgba(30, 31, 33, 0.15), 0 0 1px rgba(30, 31, 33, 0.31);
  text-align: left;
}
.jd__menu--left { left: 0; }
.jd__menu--right { right: 0; }
.jd__heading {
  padding: 10px 16px 4px; font-size: 12px; font-weight: 653; color: var(--j-text-subtlest);
  text-transform: uppercase; letter-spacing: 0;
}
.jd__item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%;
  min-height: 32px; padding: 6px 16px; border: 0; border-left: 2px solid transparent;
  background: transparent; color: var(--j-text); font: inherit; font-size: 14px;
  text-align: left; cursor: pointer;
}
.jd__item:hover, .jd__item:focus-visible {
  background: var(--j-neutral-hover); border-left-color: var(--j-brand); outline: none;
}
.jd__item.is-selected { background: var(--j-selected); color: var(--j-selected-text); border-left-color: var(--j-brand); }
.jd__item.is-danger { color: var(--j-danger-text); }
.jd__item:disabled { color: var(--j-text-disabled); cursor: not-allowed; background: transparent; border-left-color: transparent; }
.jd__label { display: inline-flex; align-items: center; gap: 8px; }
.jd__hint { font-size: 12px; color: var(--j-text-subtlest); white-space: normal; }
</style>
