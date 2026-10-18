<template>
  <nav class="sn" :aria-label="service.title">
    <div class="sn__head">
      <a href="#" class="sn__title" @click.prevent="$emit('go', service.home)">{{ service.title }}</a>
      <button type="button" class="sn__close" aria-label="Close side navigation" @click="$emit('close')">
        <CsIcon name="close" />
      </button>
    </div>
    <div class="sn__body">
      <template v-for="(section, index) in service.nav" :key="index">
        <hr v-if="index > 0 && !section.title" class="sn__divider" />
        <div v-if="section.title" class="sn__section">
          <button type="button" class="sn__section-btn" :aria-expanded="!collapsed.has(index)" @click="flip(index)">
            <CsIcon :name="collapsed.has(index) ? 'caret-right' : 'caret-down'" size="small" />
            {{ section.title }}
          </button>
        </div>
        <ul v-if="!collapsed.has(index)" class="sn__list" :class="{ 'sn__list--nested': section.title }">
          <li v-for="link in section.links" :key="link.label">
            <a v-if="link.route" href="#" class="sn__link" :class="{ 'is-active': isActive(link.route) }"
               @click.prevent="$emit('go', link.route)">{{ link.label }}</a>
            <span v-else class="sn__link sn__link--off" title="Not available in this lab">{{ link.label }}</span>
          </li>
        </ul>
      </template>
      <hr class="sn__divider" />
      <ul class="sn__list">
        <li><span class="sn__link sn__link--off">Documentation <CsIcon name="external" size="small" /></span></li>
      </ul>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CsIcon from '../aws/CsIcon.vue';
import { pageMeta } from './nav';
import type { Route, ServiceDef } from './nav';

const props = defineProps<{ service: ServiceDef; route: Route }>();
defineEmits<{ (e: 'go', route: Route): void; (e: 'close'): void }>();

const collapsed = ref(new Set<number>());
function flip(index: number) {
  const next = new Set(collapsed.value);
  if (next.has(index)) next.delete(index); else next.add(index);
  collapsed.value = next;
}

/** Detail and create pages light up the list they belong to. */
function isActive(link: Route) {
  if (link.svc !== props.route.svc) return false;
  if (link.page === props.route.page) return true;
  return pageMeta(props.route)?.parent === link.page;
}
</script>

<style scoped>
.sn { display: flex; flex-direction: column; height: 100%; background: #fff; }
.sn__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 20px 16px 14px 28px; }
.sn__title { color: #0f141a; font-size: 18px; line-height: 22px; font-weight: 700; text-decoration: none; }
.sn__title:hover { color: #006ce0; }
.sn__close { flex: none; display: inline-flex; align-items: center; justify-content: center; min-width: 28px; min-height: 28px; margin: -4px -6px 0 0; border: 0; background: none; color: #424650; cursor: pointer; padding: 4px; border-radius: 4px; }
.sn__close:hover { color: #0f141a; }
.sn__body { overflow-y: auto; padding: 0 0 24px; }
.sn__divider { border: 0; border-top: 1px solid #c6c6cd; margin: 10px 28px; }
.sn__section-btn { display: flex; align-items: center; gap: 6px; width: 100%; border: 0; background: none; padding: 6px 28px 4px 22px; font: inherit; font-size: 14px; font-weight: 700; color: #0f141a; cursor: pointer; text-align: left; }
.sn__list { list-style: none; margin: 0; padding: 0; }
.sn__list--nested { padding-left: 12px; }
.sn__link { display: block; padding: 4px 28px; font-size: 14px; line-height: 20px; color: #424650; text-decoration: none; }
a.sn__link:hover { color: #006ce0; }
.sn__link.is-active { color: #006ce0; font-weight: 700; }
.sn__link--off { color: #424650; cursor: default; }
</style>
