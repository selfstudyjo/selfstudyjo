<template>
  <div class="af-page">
    <div class="af-panel">
      <div class="af-panel__head">
        <h3 class="af-panel__title">List Task Instance</h3>
        <span class="af-spacer"></span>
        <span class="af-menu-anchor">
          <button type="button" class="af-btn af-btn--sm" :disabled="!selected.size" :aria-expanded="actions" @click.stop="actions = !actions">
            Actions <AfIcon name="caret" /></button>
          <div v-if="actions" class="af-menu af-fab__menu" role="menu">
            <button type="button" role="menuitem" @click="clearSelected">Clear</button>
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
            <option v-for="s in states" :key="s" :value="s">{{ s }}</option></select>
          <input v-model="fTask" class="af-input af-fab__f" placeholder="Task Id contains" aria-label="Task Id contains" />
        </div>
        <div class="af-table-wrap">
          <table class="af-table af-table--bordered af-table--striped">
            <thead>
              <tr>
                <th class="af-actions-col"><input type="checkbox" :checked="allChecked" aria-label="Select all" @change="toggleAll" /></th>
                <th>State</th><th>Dag Id</th><th>Task Id</th><th>Run Id</th><th>Map Index</th><th>Operator</th>
                <th>Start Date</th><th>End Date</th><th>Duration</th><th>Try Number</th><th>Pool</th><th>Log</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in shown" :key="key(t)">
                <td class="af-actions-col"><input type="checkbox" :checked="selected.has(key(t))" :aria-label="'Select ' + t.task_id" @change="toggle(t)" /></td>
                <td><span class="af-state"><i :style="{ background: normState(t.state) === 'none' ? '#fff' : stateColor(t.state) }"></i>{{ stateLabel(t.state) }}</span></td>
                <td><button type="button" class="af-link" @click="af.go({ page: 'dag', dagId: t.dag_id, tab: 'details' })">{{ t.dag_id }}</button></td>
                <td><button type="button" class="af-link" @click="open(t, 'details')">{{ t.task_id }}</button></td>
                <td class="af-mono">{{ t.run_id }}</td>
                <td>{{ t.map_index ?? -1 }}</td>
                <td>{{ operatorOf(t) }}</td>
                <td class="af-nowrap">{{ fmtDate(t.start) }}</td>
                <td class="af-nowrap">{{ fmtDate(t.end) }}</td>
                <td class="af-nowrap">{{ fmtDuration(t.duration_s) }}</td>
                <td class="af-num">{{ t.try_number }}</td>
                <td>{{ poolOf(t) }}</td>
                <td><button type="button" class="af-btn af-btn--xs" :aria-label="'Log of ' + t.task_id" @click="open(t, 'logs')"><AfIcon name="log" /></button></td>
              </tr>
              <tr v-if="!shown.length"><td colspan="13" class="af-empty-cell">No records found</td></tr>
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
import AfIcon from './AfIcon.vue';
import { useAf } from './afContext';
import { CMD, fmtDate, fmtDuration, normState, stateColor, stateLabel, taskRegex, type AfTi, type DagTab } from './airflow';

const af = useAf();
const fDag = ref(''); const fState = ref(''); const fTask = ref('');
const selected = ref(new Set<string>());
const actions = ref(false);
function close() { actions.value = false; }
onMounted(() => window.addEventListener('click', close));
onBeforeUnmount(() => window.removeEventListener('click', close));

const dagIds = computed(() => [...new Set(af.tis.value.map(t => t.dag_id))].sort());
const states = computed(() => [...new Set(af.tis.value.map(t => stateLabel(t.state)))].sort());
const key = (t: AfTi) => [t.dag_id, t.run_id, t.task_id, t.map_index ?? -1].join('\u0000');
const shown = computed(() => [...af.tis.value].reverse().filter(t => (!fDag.value || t.dag_id === fDag.value)
  && (!fState.value || stateLabel(t.state) === fState.value) && (!fTask.value || t.task_id.includes(fTask.value.trim()))));
const allChecked = computed(() => shown.value.length > 0 && shown.value.every(t => selected.value.has(key(t))));

function toggle(t: AfTi) { const s = new Set(selected.value); s.has(key(t)) ? s.delete(key(t)) : s.add(key(t)); selected.value = s; }
function toggleAll() { selected.value = allChecked.value ? new Set() : new Set(shown.value.map(key)); }
function task(t: AfTi) { return af.dag(t.dag_id)?.tasks.find(x => x.task_id === t.task_id); }
function operatorOf(t: AfTi) { return t.operator || task(t)?.operator || ''; }
function poolOf(t: AfTi) { return t.pool || task(t)?.pool || 'default_pool'; }
function runOf(t: AfTi) { return af.runsOf(t.dag_id).find(r => r.run_id === t.run_id); }
function open(t: AfTi, tab: DagTab) { af.go({ page: 'dag', dagId: t.dag_id, tab, runId: t.run_id, taskId: t.task_id }); }
const picked = () => af.tis.value.filter(t => selected.value.has(key(t)));

async function clearSelected() {
  actions.value = false;
  const list = picked();
  if (!await af.confirm({ title: 'Clear', message: `Are you sure you want to clear the ${list.length} selected task instance(s)?`,
    lines: list.map(t => `${t.dag_id}.${t.task_id} - ${t.run_id}`), yes: 'Clear' })) return;
  let ok = 0;
  for (const t of list) {
    const date = runOf(t)?.logical_date || '';
    if ((await af.run(CMD.clear(t.dag_id, { taskRegex: taskRegex(t.task_id), start: date, end: date }))).ok) ok += 1;
  }
  if (ok) af.notify('success', `${ok} task instances have been cleared`);
  selected.value = new Set();
}

async function markSelected(state: 'success' | 'failed') {
  actions.value = false;
  const list = picked();
  if (!await af.confirm({ title: `Set state to '${state}'`, message: `Set the ${list.length} selected task instance(s) to ${state}?`,
    lines: list.map(t => `${t.dag_id}.${t.task_id} - ${t.run_id}`), yes: 'Confirm', danger: state === 'failed' })) return;
  let ok = 0;
  for (const t of list) if ((await af.run(CMD.markTask(t.dag_id, t.task_id, t.run_id, state))).ok) ok += 1;
  if (ok) af.notify('success', `${ok} task instances were set to ${state}`);
  selected.value = new Set();
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-fab__filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.af-fab__f { width: auto; min-width: 150px; height: 30px; font-size: 13px; }
.af-fab__menu { right: 0; top: 30px; }
</style>
