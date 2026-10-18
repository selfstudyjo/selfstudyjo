<template>
  <section class="dd-page">
    <div class="dd-head">
      <h1>Extensions</h1>
      <span class="dd-spacer"></span>
      <button type="button" class="dd-feedback"><DdIcon name="feedback" :size="15" /> Give feedback</button>
    </div>
    <nav class="dd-tabs" aria-label="Extensions">
      <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'browse' }" @click="tab = 'browse'">Browse</button>
      <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'manage' }" @click="tab = 'manage'">Manage</button>
    </nav>
    <div v-if="tab === 'browse'" class="ev-grid">
      <article v-for="ext in EXTENSIONS" :key="ext.name" class="ev-card">
        <div class="ev-logo">{{ ext.name[0] }}</div>
        <div class="dd-name-lines">
          <strong>{{ ext.name }}</strong>
          <small>{{ ext.by }}</small>
        </div>
        <p>{{ ext.text }}</p>
        <button type="button" class="dd-btn dd-btn--ghost" disabled title="Installing extensions is not available in this lab">Install</button>
      </article>
    </div>
    <div v-else class="dd-empty">
      <DdIcon name="extensions" :size="56" class="dd-empty__art" />
      <h2>No extensions installed</h2>
      <p>Extensions add tools to Docker Desktop. Installing them is not available in this lab.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import type { DdRoute } from './dd';

defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();
const tab = ref('browse');
const EXTENSIONS = [
  { name: 'Disk usage', by: 'Docker Inc.', text: 'See how much disk space images, containers and volumes use, and reclaim it.' },
  { name: 'Logs Explorer', by: 'Docker Inc.', text: 'Search and filter the logs of every container in one place.' },
  { name: 'Resource usage', by: 'Docker Inc.', text: 'Monitor CPU, memory and network usage of your containers over time.' },
  { name: 'Volumes Backup & Share', by: 'Docker Inc.', text: 'Back up, clone, restore and share Docker volumes.' },
];
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.dd-spacer { flex: 1; }
.ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 12px; }
.ev-card { display: flex; flex-direction: column; gap: 8px; padding: 14px; border: 1px solid var(--dd-border); border-radius: 6px; }
.ev-card p { margin: 0; font-size: 13px; color: var(--dd-text-2); flex: 1; line-height: 1.45; }
.ev-card strong { font-weight: 500; }
.ev-card .dd-btn { align-self: flex-start; }
.ev-logo { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 8px; background: var(--dd-blue-tint); color: var(--dd-blue); font-weight: 700; }
</style>
