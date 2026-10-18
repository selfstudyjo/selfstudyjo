<template>
  <div class="hub">
    <div class="dd-toolbar">
      <label class="dd-search"><DdIcon name="search" :size="16" /><input v-model="filter" type="search" placeholder="Search Docker Hub" aria-label="Search Docker Hub" /></label>
      <span class="dd-muted">Repositories available to this lab's registry</span>
    </div>
    <div class="hub__grid">
      <article v-for="repo in shown" :key="repo.name" class="hub__card">
        <div class="hub__title">
          <DdIcon name="cube" :size="22" />
          <div class="dd-name-lines">
            <strong>{{ repo.name }}</strong>
            <small>{{ repo.name.includes('/') ? repo.name.split('/')[0] : 'Docker Official Image' }} · {{ size(repo.size_mb) }}</small>
          </div>
          <span v-if="local.has(repo.name)" class="dd-chip dd-chip--green">Pulled</span>
        </div>
        <div class="hub__actions">
          <input v-model="tags[repo.name]" class="dd-input hub__tag" placeholder="latest" :aria-label="`Tag for ${repo.name}`" />
          <button type="button" class="dd-btn dd-btn--ghost" :disabled="busy" @click="pull(repo.name)">Pull</button>
          <button type="button" class="dd-btn dd-btn--primary" :disabled="busy" @click="$emit('run', ref_(repo.name))">Run</button>
        </div>
      </article>
    </div>
    <p v-if="!shown.length" class="dd-empty">No repositories match "{{ filter }}".</p>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { pick } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import { cmd, images } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean }>();
defineEmits<{ (event: 'run', ref: string): void }>();

const filter = ref('');
const tags = reactive<Record<string, string>>({});
const repos = computed(() => pick<{ name: string; size_mb: number }[]>(props.view, 'registry', []));
const shown = computed(() => repos.value.filter(r => r.name.toLowerCase().includes(filter.value.trim().toLowerCase())));
const local = computed(() => new Set(images(props.view).map(i => i.repository)));

function size(mb: number) { return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : mb < 1 ? `${Math.round(mb * 1024)} kB` : `${Math.round(mb)} MB`; }
function ref_(name: string) { return `${name}:${(tags[name] || '').trim() || 'latest'}`; }
async function pull(name: string) { await props.api.exec(cmd.pull(ref_(name)), { success: `Pulled ${ref_(name)}` }); }
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.hub { display: flex; flex-direction: column; gap: 14px; }
.hub__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 12px; }
.hub__card { display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 1px solid var(--dd-border); border-radius: 6px; }
.hub__title { display: flex; align-items: center; gap: 10px; }
.hub__title svg { color: var(--dd-blue); }
.hub__title strong { font-weight: 500; }
.hub__title .dd-chip { margin-left: auto; }
.hub__actions { display: flex; gap: 8px; }
.hub__tag { flex: 1; }
</style>
