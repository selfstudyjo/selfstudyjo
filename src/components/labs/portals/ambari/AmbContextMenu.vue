<template>
  <div class="amb-ctx-scrim" @mousedown.self="$emit('close')" @contextmenu.prevent="$emit('close')">
    <ul ref="menu" class="amb-ctx" role="menu" :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
        tabindex="-1" @keydown.esc="$emit('close')">
      <template v-for="(item, i) in items" :key="i">
        <li v-if="item.sep" class="amb-ctx__sep" role="separator"></li>
        <li v-else-if="item.header" class="amb-ctx__header">{{ item.label }}</li>
        <li v-else role="none">
          <button type="button" role="menuitem" class="amb-ctx__item"
                  :class="{ 'is-danger': item.danger }" :disabled="item.disabled" @click="pickItem(item)">
            <AmbIcon v-if="item.icon" :name="item.icon" :size="12" />
            <span v-else class="amb-ctx__gap"></span>
            {{ item.label }}
          </button>
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * A right-click / row-actions menu, drawn as a Bootstrap dropdown at the pointer.
 *
 * Fixed-positioned so a table that scrolls sideways cannot clip it, and pulled
 * back inside the window when it would open off the bottom or right edge.
 */
import { nextTick, onMounted, reactive, ref } from 'vue';
import type { AmbMenuItem } from './ambari';
import AmbIcon from './AmbIcon.vue';

const props = defineProps<{ x: number; y: number; items: AmbMenuItem[] }>();
const emit = defineEmits<{ (event: 'close'): void }>();

const menu = ref<HTMLElement | null>(null);
const pos = reactive({ x: props.x, y: props.y });

onMounted(async () => {
  await nextTick();
  const el = menu.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.right > window.innerWidth - 4) pos.x = Math.max(4, window.innerWidth - rect.width - 4);
  if (rect.bottom > window.innerHeight - 4) pos.y = Math.max(4, props.y - rect.height);
  el.focus();
});

function pickItem(item: AmbMenuItem) {
  emit('close');
  item.run?.();
}
</script>

<style scoped>
.amb-ctx-scrim { position: fixed; inset: 0; z-index: 60; }
.amb-ctx {
  position: fixed; min-width: 190px; max-width: 320px; list-style: none; margin: 0; padding: 5px 0; background: #fff;
  border: 1px solid rgba(0, 0, 0, .15); border-radius: 4px; box-shadow: 0 6px 12px rgba(0, 0, 0, .175); outline: 0;
  font-family: Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: left;
}
.amb-ctx__item {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 18px; border: 0; background: none;
  font: inherit; font-size: 13px; color: #333; cursor: pointer; text-align: left; white-space: nowrap;
}
.amb-ctx__item:hover:not(:disabled), .amb-ctx__item:focus-visible { background: #f5f5f5; outline: 0; }
.amb-ctx__item:disabled { color: #9a9a9a; cursor: default; }
.amb-ctx__item.is-danger { color: #c9302c; }
.amb-ctx__gap { display: inline-block; width: 12px; }
.amb-ctx__sep { height: 1px; margin: 5px 0; background: #e5e5e5; }
.amb-ctx__header { padding: 4px 18px; color: #6b6b6b; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
</style>
