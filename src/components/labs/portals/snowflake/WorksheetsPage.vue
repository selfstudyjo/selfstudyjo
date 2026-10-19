<template>
  <div class="sf-page">
    <div class="sf-page-head">
      <h1 class="sf-h1">Worksheets</h1>
      <span class="sf-spacer"></span>
      <button type="button" class="sf-btn sf-btn--primary" @click="sf.openWorksheet('')"><SfIcon name="plus" /> SQL Worksheet</button>
    </div>
    <div class="sf-tabs">
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'recent' }" @click="tab = 'recent'">Recent</button>
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'mine' }" @click="tab = 'mine'">My Worksheets</button>
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'shared' }" @click="tab = 'shared'">Shared with me</button>
    </div>
    <div class="sf-toolbar">
      <div class="sf-search ws-search"><SfIcon name="search" /><input v-model="filter" class="sf-input" placeholder="Search worksheets" /></div>
    </div>
    <div v-if="tab === 'shared'" class="sf-empty"><SfIcon name="share" /><strong>No worksheets shared with you</strong><span>Worksheets other users share with you appear here.</span></div>
    <div v-else class="sf-table-wrap">
      <table class="sf-table">
        <thead>
          <tr><th>Title</th><th>Viewed</th><th>Updated</th><th>Role</th><th class="sf-actions"></th></tr>
        </thead>
        <tbody>
          <tr v-for="w in shown" :key="w.id" class="is-clickable" @click="sf.go({ page: 'worksheet', id: w.id })">
            <td><span class="sf-cell-name"><SfIcon name="worksheet" /><span class="sf-ellipsis">{{ w.name }}</span></span></td>
            <td class="sf-muted">{{ ago(w.modified) }}</td>
            <td class="sf-muted">{{ ago(w.modified) }}</td>
            <td class="sf-muted">{{ sf.current.value.role }}</td>
            <td class="sf-actions sf-rel" @click.stop>
              <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon sf-btn--sm" aria-label="Actions" @click="menu = menu === w.id ? 0 : w.id"><SfIcon name="more" /></button>
              <div v-if="menu === w.id" class="sf-menu row-menu" @mouseleave="menu = 0">
                <button type="button" @click="menu = 0; sf.go({ page: 'worksheet', id: w.id })"><SfIcon name="worksheet" /> Open</button>
                <button type="button" @click="duplicate(w.id)"><SfIcon name="copy" /> Duplicate</button>
                <hr />
                <button type="button" class="is-danger" @click="remove(w.id)"><SfIcon name="trash" /> Delete</button>
              </div>
            </td>
          </tr>
          <tr v-if="!shown.length"><td colspan="5"><div class="sf-empty"><SfIcon name="worksheet" /><strong>No worksheets</strong><span>Create a SQL worksheet to start querying.</span></div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Projects > Worksheets: the list of this user's worksheets. */
import { computed, ref } from 'vue';
import SfIcon from './SfIcon.vue';
import { useSf } from './sfContext';
import { matches } from '@/utils/portalKit';

const sf = useSf();
const tab = ref<'recent' | 'mine' | 'shared'>('recent');
const filter = ref('');
const menu = ref(0);
const shown = computed(() => [...sf.worksheets.value]
  .sort((a, b) => (tab.value === 'recent' ? b.modified - a.modified : a.name.localeCompare(b.name)))
  .filter(w => matches(w, filter.value, ['name', 'sql'])));

function ago(time: number) {
  const s = Math.round((Date.now() - time) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' minutes ago';
  return Math.round(s / 3600) + ' hours ago';
}
function duplicate(id: number) {
  menu.value = 0;
  const src = sf.worksheets.value.find(w => w.id === id);
  if (src) sf.openWorksheet(src.sql, src.name + ' (copy)');
}
async function remove(id: number) {
  menu.value = 0;
  const w = sf.worksheets.value.find(x => x.id === id);
  if (!w) return;
  const ok = await sf.confirm({ title: 'Delete worksheet?', message: `"${w.name}" will be deleted permanently. This cannot be undone.`, yes: 'Delete', danger: true });
  if (ok) {
    sf.worksheets.value = sf.worksheets.value.filter(x => x.id !== id);
    sf.notify('success', 'Worksheet deleted');
  }
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.ws-search { width: min(320px, 100%); }
.row-menu { right: 8px; top: 34px; }
</style>
