<template>
  <div class="af-page">
    <h2 class="af-h2">Datasets</h2>
    <div class="af-ds">
      <div class="af-ds__list">
        <div class="af-ds__search"><AfIcon name="search" />
          <input v-model="query" class="af-input" type="search" placeholder="Search by URI…" aria-label="Search datasets" /></div>
        <div class="af-table-wrap">
          <table class="af-table">
            <thead><tr><th>URI</th><th>Last Update</th><th class="af-num">Total Updates</th></tr></thead>
            <tbody>
              <tr v-for="d in shown" :key="d.uri" :class="{ 'is-sel': d.uri === picked }" class="af-ds__row" @click="picked = d.uri">
                <td><button type="button" class="af-link af-mono">{{ d.uri }}</button></td>
                <td class="af-nowrap">{{ fmtDate(d.last_update) }}</td>
                <td class="af-num">{{ d.events }}</td>
              </tr>
              <tr v-if="!shown.length"><td colspan="3" class="af-empty-cell">No Data found.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="af-ds__detail">
        <template v-if="current">
          <h3 class="af-h3 af-mono af-ds__uri">{{ current.uri }}</h3>
          <h4 class="af-h4">Producing DAGs / tasks</h4>
          <ul class="af-ds__links"><li v-for="p in current.producers" :key="p"><button type="button" class="af-link" @click="openDag(p)">{{ p }}</button></li>
            <li v-if="!current.producers.length" class="af-muted">None</li></ul>
          <h4 class="af-h4">Consuming DAGs</h4>
          <ul class="af-ds__links"><li v-for="c in current.consumers" :key="c"><button type="button" class="af-link" @click="openDag(c)">{{ c }}</button></li>
            <li v-if="!current.consumers.length" class="af-muted">None</li></ul>
        </template>
        <div v-else class="af-empty"><strong>Dataset events</strong><span>Select a dataset to see which DAGs produce and consume it. A DAG scheduled on
          <code>schedule=[Dataset("...")]</code> runs whenever a producing task finishes.</span></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches } from '@/utils/portalKit';
import AfIcon from './AfIcon.vue';
import { useAf } from './afContext';
import { fmtDate } from './airflow';

const af = useAf();
const query = ref('');
const picked = ref('');

interface Ds { uri: string; last_update: string; events: number; producers: string[]; consumers: string[] }

const datasets = computed<Ds[]>(() => {
  const map = new Map<string, Ds>();
  const get = (uri: string) => map.get(uri) || map.set(uri, { uri, last_update: '', events: 0, producers: [], consumers: [] }).get(uri) as Ds;
  const fromView = af.airflowView.value?.datasets;
  if (Array.isArray(fromView)) {
    for (const d of fromView) {
      if (!d || typeof d !== 'object') continue;
      const ds = get(String(d.uri || d.name || ''));
      ds.last_update = String(d.last_update || d.updated_at || '');
      ds.events = Number(d.events ?? d.total_updates ?? 0) || 0;
      (d.producers || d.producing_tasks || []).forEach((p: unknown) => ds.producers.push(String(p)));
      (d.consumers || d.consuming_dags || []).forEach((c: unknown) => ds.consumers.push(String(c)));
    }
  }
  // Every update a producing task made (the engine's dataset_events).
  const events = af.airflowView.value?.dataset_events;
  if (Array.isArray(events)) {
    for (const e of events) {
      if (!e || typeof e !== 'object' || !e.uri) continue;
      const ds = get(String(e.uri));
      ds.events += 1;
      const when = String(e.at_text || '');
      if (when > ds.last_update) ds.last_update = when;
      const label = `${e.dag_id}.${e.task_id}`;
      if (e.dag_id && !ds.producers.includes(label)) ds.producers.push(label);
    }
  }
  // A DAG scheduled on Datasets lists them (view: dag.datasets), or names them in the schedule text.
  for (const dag of af.dags.value) {
    const uris = Array.isArray(dag.datasets) ? dag.datasets.map(String) : [];
    for (const m of String(dag.schedule || '').matchAll(/Dataset\(\s*['"]([^'"]+)['"]/g)) uris.push(m[1] ?? '');
    for (const uri of uris) {
      const ds = get(uri);
      if (!ds.consumers.includes(dag.dag_id)) ds.consumers.push(dag.dag_id);
    }
    for (const t of dag.tasks) {
      for (const o of Array.isArray(t.outlets) ? t.outlets : []) {
        const ds = get(String(o));
        const label = `${dag.dag_id}.${t.task_id}`;
        if (!ds.producers.includes(label)) ds.producers.push(label);
      }
    }
  }
  return [...map.values()].filter(d => d.uri);
});
const shown = computed(() => datasets.value.filter(d => matches(d, query.value, ['uri'])));
const current = computed(() => datasets.value.find(d => d.uri === picked.value));
function openDag(label: string) { af.go({ page: 'dag', dagId: label.split('.')[0] ?? label, tab: 'graph' }); }
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-ds { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 16px; }
.af-ds__list { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.af-ds__search { position: relative; display: flex; align-items: center; }
.af-ds__search .af-ico { position: absolute; left: 9px; color: #999; pointer-events: none; }
.af-ds__search .af-input { padding-left: 30px; height: 30px; font-size: 13px; }
.af-ds__row { cursor: pointer; }
.af-ds__row.is-sel td { background: #e6f1fd; }
.af-ds__detail { border: 1px solid var(--af-border-light); border-radius: 4px; padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.af-ds__uri { overflow-wrap: anywhere; font-size: 15px; }
.af-ds__links { margin: 0; padding-left: 18px; }
@container sl-portal (max-width: 820px) { .af-ds { grid-template-columns: minmax(0, 1fr); } }
</style>
