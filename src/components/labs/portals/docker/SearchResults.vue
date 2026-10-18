<template>
  <div class="dd-sr" role="listbox">
    <template v-for="group in groups" :key="group.title">
      <div v-if="group.items.length" class="dd-sr__group">
        <div class="dd-sr__title">{{ group.title }}</div>
        <button v-for="item in group.items" :key="item.key" type="button" class="dd-sr__item" role="option"
                @mousedown.prevent="item.act()">
          <DdIcon :name="item.icon" :size="16" />
          <span class="dd-sr__name">{{ item.label }}</span>
          <small>{{ item.meta }}</small>
        </button>
      </div>
    </template>
    <div v-if="!groups.some(g => g.items.length)" class="dd-sr__none">No results for "{{ query }}"</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { pick } from '@/utils/portalKit';
import DdIcon from './DdIcon.vue';
import { containers, fmtSize, images, imageRef, volumes, type DdRoute } from './dd';

const props = defineProps<{ view: Record<string, any>; query: string }>();
const emit = defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'pull', ref: string): void }>();

const groups = computed(() => {
  const q = props.query.trim().toLowerCase();
  const has = (text: string) => text.toLowerCase().includes(q);
  return [
    { title: 'Containers', items: containers(props.view).filter(c => has(c.name) || has(c.image)).slice(0, 5)
        .map(c => ({ key: 'c' + c.id, icon: 'containers', label: c.name, meta: c.image,
                     act: () => emit('go', { page: 'containers', id: c.name }) })) },
    { title: 'Local images', items: images(props.view).filter(i => has(imageRef(i))).slice(0, 5)
        .map(i => ({ key: 'i' + i.id, icon: 'images', label: imageRef(i), meta: fmtSize(i.size_mb, i.size),
                     act: () => emit('go', { page: 'images', id: imageRef(i) }) })) },
    { title: 'Volumes', items: volumes(props.view).filter(v => has(v.name)).slice(0, 5)
        .map(v => ({ key: 'v' + v.name, icon: 'volumes', label: v.name, meta: v.driver,
                     act: () => emit('go', { page: 'volumes', id: v.name }) })) },
    { title: 'Docker Hub images', items: pick<any[]>(props.view, 'registry', [])
        .filter(r => has(String(r.name))).slice(0, 5)
        .map(r => ({ key: 'h' + r.name, icon: 'hub', label: String(r.name), meta: 'Pull',
                     act: () => emit('pull', String(r.name)) })) },
  ];
});
</script>

<style scoped>
.dd-sr { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 46; max-height: 380px; overflow: auto; background: #fff; border-radius: 6px; box-shadow: 0 6px 24px rgb(0 0 0 / .2), 0 0 0 1px rgb(0 0 0 / .05); padding: 6px 0; }
.dd-sr__title { padding: 6px 14px 4px; font-size: 12px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: var(--dd-text-2); }
.dd-sr__item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 14px; border: 0; background: none; font: inherit; font-size: 13px; color: var(--dd-text); text-align: left; cursor: pointer; }
.dd-sr__item:hover { background: var(--dd-hover); }
.dd-sr__item svg { color: var(--dd-text-2); }
.dd-sr__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dd-sr__item small { color: var(--dd-text-2); }
.dd-sr__none { padding: 14px; font-size: 13px; color: var(--dd-text-2); }
</style>
