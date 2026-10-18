<template>
  <div class="dd-menu" ref="root">
    <button type="button" class="dd-menu__trigger" :aria-label="label" :title="label" :aria-expanded="open"
            :disabled="disabled" @click.stop="toggle">
      <DdIcon name="dots" :size="18" />
    </button>
    <Teleport :to="host" :disabled="!host">
    <ul v-if="open" ref="list" class="dd-menu__list" role="menu" :style="place">
      <li v-for="item in items" :key="item.key" role="none">
        <button type="button" role="menuitem" class="dd-menu__item" :class="{ 'is-danger': item.danger }"
                :disabled="item.disabled" @click.stop="pick(item.key)">
          <DdIcon v-if="item.icon" :name="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </button>
      </li>
    </ul>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { inject, nextTick, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import DdIcon from './DdIcon.vue';
import type { MenuItem } from './dd';


withDefaults(defineProps<{ items: MenuItem[]; label?: string; disabled?: boolean }>(),
             { label: 'Show actions', disabled: false });
const emit = defineEmits<{ (event: 'select', key: string): void }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);
/* The list is teleported to Docker Desktop's root and placed against the
   trigger, so a table's horizontal scroll box cannot clip it. */
const host = inject<Ref<HTMLElement | null>>('ddRoot', ref(null));
const place = ref<Record<string, string>>({});

async function toggle() {
  open.value = !open.value;
  if (!open.value || !root.value) return;
  const base = host.value?.getBoundingClientRect() || { left: 0, top: 0, width: 9999, height: 9999 };
  const rect = root.value.getBoundingClientRect();
  place.value = { top: `${rect.bottom - base.top + 2}px`, right: `${base.left + base.width - rect.right}px` };
  await nextTick();
  const height = list.value?.offsetHeight || 0;
  if (rect.bottom - base.top + height + 8 > base.height) {
    place.value = { top: `${Math.max(4, rect.top - base.top - height - 2)}px`, right: place.value.right };
  }
}

function pick(key: string) {
  open.value = false;
  emit('select', key);
}

function outside(event: MouseEvent) {
  const target = event.target as Node;
  if (open.value && root.value && !root.value.contains(target)
      && !(list.value && list.value.contains(target))) open.value = false;
}
onMounted(() => document.addEventListener('click', outside));
onBeforeUnmount(() => document.removeEventListener('click', outside));
</script>

<style scoped>
.dd-menu { position: relative; display: inline-flex; }
.dd-menu__trigger { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; border: 0; background: none; color: var(--dd-text-2); cursor: pointer; padding: 0; }
.dd-menu__trigger:hover:not(:disabled) { background: var(--dd-hover-strong); color: var(--dd-text); }
.dd-menu__trigger:disabled { opacity: .35; cursor: not-allowed; }
.dd-menu__list {
  position: absolute; z-index: 45; min-width: 210px; margin: 0; padding: 6px 0;
  list-style: none; background: #fff; border-radius: 6px; box-shadow: 0 4px 18px rgb(0 0 0 / .18), 0 0 0 1px rgb(0 0 0 / .04);
}
.dd-menu__item {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 16px; border: 0; background: none;
  font: inherit; font-size: 14px; color: var(--dd-text); cursor: pointer; text-align: left; white-space: nowrap;
}
.dd-menu__item:hover:not(:disabled) { background: var(--dd-hover); }
.dd-menu__item:disabled { opacity: .4; cursor: not-allowed; }
.dd-menu__item.is-danger { color: var(--dd-red); }
.dd-menu__item svg { color: var(--dd-text-2); }
.dd-menu__item.is-danger svg { color: var(--dd-red); }
</style>
