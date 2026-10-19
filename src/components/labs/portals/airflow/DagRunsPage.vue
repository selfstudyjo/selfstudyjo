<template>
  <div class="af-page">
    <div class="af-panel">
      <div class="af-panel__head">
        <h3 class="af-panel__title">List Dag Run</h3>
        <span class="af-spacer"></span>
        <span class="af-menu-anchor">
          <button type="button" class="af-btn af-btn--sm" :disabled="!selected.size" :aria-expanded="actions" @click.stop="actions = !actions">
            Actions <AfIcon name="caret" /></button>
          <div v-if="actions" class="af-menu af-fab__menu" role="menu">
            <button type="button" role="menuitem" @click="clearSelected">Clear the state</button>
            <button type="button" role="menuitem" @click="markSelected('queued')">Set state to 'queued'</button>
            <button type="button" role="menuitem" @click="markSelected('success')">Set state to 'success'</button>
            <button type="button" role="menuitem" @click="markSelected('failed')">Set state to 'failed'</button>
          </div>
        </span>
        <button type="button" class="af-btn af-btn--sm af-btn--icon" title="Refresh" aria-label="Refresh" @click="af.refresh()"><AfIcon name="refresh" /></button>
      </div>
      <div class="af-panel__body">
        <div class="af-fab__filters">
          <span class="af-small af-muted"><AfIcon name="filter" /> Search</span>
          <select v-model="fDag" class="af-select af-fab__f" aria-label="Dag Id"><option value="">Dag Id: any</option>
            <option v-for="d in dagIds" :key="d" :value="d">{{ d }}</option></select>
          <select v-model="fState" class="af-select af-fab__f" aria-label="State"><option value="">State: any</option>
            <option v-for="s in ['queued', 'running', 'success', 'failed']" :key="s" :value="s">{{ s }}</option></select>
          <select v-model="fType" class="af-select af-fab__f" aria-label="Run Type"><option value="">Run Type: any</option>
            <option v-for="s in ['manual', 'scheduled', 'backfill', 'dataset_triggered']" :key="s" :value="s">{{ s }}</option></select>
          <input v-model="fRun" class="af-input af-fab__f" placeholder="Run Id contains" aria-label="Run Id contains" />
        </div>
        <div class="af-table-wrap">
          <table class="af-table af-table--bordered af-table--striped">
            <thead>
              <tr>
                <th class="af-actions-col"><input type="checkbox" :checked="allChecked" aria-label="Select all" @change="toggleAll" /></th>
                <th>State</th><th class="af-sort" @click="sortOn('dag_id')">Dag Id {{ arrow('dag_id') }}</th>
                <th class="af-sort" @click="sortOn('logical_date')">Logical Date {{ arrow('logical_date') }}</th>
                <th>Run Id</th><th>Run Type</th><th>Start Date</th><th>End Date</th><th>External Trigger</th><th>Conf</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in shown" :key="r.dag_id + r.run_id">
                <td class="af-actions-col"><input type="checkbox" :checked="selected.has(key(r))" :aria-label="'Select ' + r.run_id" @change="toggle(r)" /></td>
                <td><span class="af-state"><i :style="{ background: stateColor(r.state) }"></i>{{ normState(r.state) }}</span></td>
                <td><button type="button" class="af-link" @click="af.go({ page: 'dag', dagId: r.dag_id, tab: 'details' })">{{ r.dag_id }}</button></td>
                <td class="af-nowrap"><button type="button" class="af-link" @click="af.go({ page: 'dag', dagId: r.dag_id, tab: 'details', runId: r.run_id })">{{ fmtDate(r.logical_date) }}</button></td>
                <td class="af-mono">{{ r.run_id }}</td>
                <td>{{ r.run_type }}</td>
                <td class="af-nowrap">{{ fmtDate(r.start) }}</td>
                <td class="af-nowrap">{{ fmtDate(r.end) }}</td>
                <td>{{ r.run_type === 'manual' ? 'True' : 'False' }}</td>
                <td class="af-mono af-fab__conf">{{ confText(r.conf) }}</td>
              </tr>
              <tr v-if="!shown.length"><td colspan="10" class="af-empty-cell">No records found</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="af-panel__foot">Record Count: {{ shown.length }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { sortBy } from '@/utils/portalKit';
import AfIcon from './AfIcon.vue';
import { useAf } from './afContext';
import { CMD, fmtDate, normState, stateColor, type AfRun } from './airflow';

const af = useAf();
const fDag = ref(''); const fState = ref(''); const fType = ref(''); const fRun = ref('');
const sortKey = ref('logical_date'); const sortDir = ref<'asc' | 'desc'>('desc');
const selected = ref(new Set<string>());
const actions = ref(false);
function close() { actions.value = false; }
onMounted(() => window.addEventListener('click', close));
onBeforeUnmount(() => window.removeEventListener('click', close));

const dagIds = computed(() => [...new Set(af.runs.value.map(r => r.dag_id))].sort());
const key = (r: AfRun) => r.dag_id + '\u0000' + r.run_id;
const shown = computed(() => sortBy(af.runs.value.filter(r => (!fDag.value || r.dag_id === fDag.value)
  && (!fState.value || normState(r.state) === fState.value) && (!fType.value || r.run_type === fType.value)
  && (!fRun.value || r.run_id.includes(fRun.value.trim()))), sortKey.value, sortDir.value));
const allChecked = computed(() => shown.value.length > 0 && shown.value.every(r => selected.value.has(key(r))));

function toggle(r: AfRun) { const s = new Set(selected.value); s.has(key(r)) ? s.delete(key(r)) : s.add(key(r)); selected.value = s; }
function toggleAll() { selected.value = allChecked.value ? new Set() : new Set(shown.value.map(key)); }
function sortOn(k: string) { if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'; else { sortKey.value = k; sortDir.value = 'asc'; } }
function arrow(k: string) { return sortKey.value === k ? (sortDir.value === 'asc' ? '▲' : '▼') : ''; }
function confText(c: unknown) { return c === undefined || c === null || c === '' ? '{}' : typeof c === 'string' ? c : JSON.stringify(c); }
const picked = () => af.runs.value.filter(r => selected.value.has(key(r)));

async function clearSelected() {
  actions.value = false;
  const list = picked();
  if (!await af.confirm({ title: 'Clear the state', message: `Are you sure you want to clear the state of the selected ${list.length} DAG run(s)?`,
    lines: list.map(r => `${r.dag_id} - ${r.run_id}`), yes: 'Clear' })) return;
  let ok = 0;
  for (const r of list) if ((await af.run(CMD.clear(r.dag_id, { start: r.logical_date, end: r.logical_date }), { quiet: false })).ok) ok += 1;
  if (ok) af.notify('success', `${ok} dag runs and their task instances were cleared`);
  selected.value = new Set();
}

async function markSelected(state: 'queued' | 'success' | 'failed') {
  actions.value = false;
  const list = picked();
  if (!await af.confirm({ title: `Set state to '${state}'`, message: `Are you sure you want to set ${list.length} DAG run(s) to ${state}?`,
    lines: list.map(r => `${r.dag_id} - ${r.run_id}`), yes: 'Confirm', danger: state === 'failed' })) return;
  let ok = 0;
  for (const r of list) if ((await af.run(CMD.markRun(r.dag_id, r.run_id, state))).ok) ok += 1;
  if (ok) af.notify('success', `${ok} dag runs were set to ${state}`);
  selected.value = new Set();
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-fab__filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.af-fab__f { width: auto; min-width: 150px; height: 30px; font-size: 13px; }
.af-fab__menu { right: 0; top: 30px; }
.af-fab__conf { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
