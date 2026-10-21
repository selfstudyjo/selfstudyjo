<template>
  <div class="af-page">
    <div class="af-panel">
      <div class="af-panel__head">
        <h3 class="af-panel__title">List Job</h3>
        <span class="af-spacer"></span>
        <span class="af-menu-anchor">
          <button type="button" class="af-btn af-btn--sm" :aria-expanded="checkMenu" @click.stop="checkMenu = !checkMenu">
            <AfIcon name="heart" /> Health check <AfIcon name="caret" /></button>
          <div v-if="checkMenu" class="af-menu af-jobs__menu" role="menu">
            <button v-for="t in CHECKABLE" :key="t" type="button" role="menuitem" @click="check(t)">airflow jobs check --job-type {{ t }}</button>
          </div>
        </span>
        <button type="button" class="af-btn af-btn--sm af-btn--icon" title="Refresh" aria-label="Refresh" @click="af.refresh()"><AfIcon name="refresh" /></button>
      </div>
      <div class="af-panel__body">
        <div class="af-jobs__filters">
          <span class="af-small af-muted"><AfIcon name="filter" /> Search</span>
          <select v-model="fType" class="af-select af-jobs__f" aria-label="Job Type"><option value="">Job Type: any</option>
            <option v-for="t in types" :key="t" :value="t">{{ t }}</option></select>
          <select v-model="fState" class="af-select af-jobs__f" aria-label="State"><option value="">State: any</option>
            <option v-for="s in states" :key="s" :value="s">{{ s }}</option></select>
          <input v-model="fDag" class="af-input af-jobs__f" placeholder="Dag Id contains" aria-label="Dag Id contains" />
        </div>
        <div class="af-table-wrap">
          <table class="af-table af-table--bordered af-table--striped">
            <thead>
              <tr>
                <th class="af-sort" @click="sortOn('id')">Id {{ arrow('id') }}</th>
                <th>Dag Id</th><th>State</th><th>Job Type</th>
                <th class="af-sort" @click="sortOn('start_date')">Start Date {{ arrow('start_date') }}</th>
                <th>End Date</th><th>Latest Heartbeat</th><th>Executor Class</th><th>Hostname</th><th>Unixname</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in shown" :key="j.id">
                <td>{{ j.id }}</td>
                <td>
                  <button v-if="j.dag_id" type="button" class="af-link" @click="openDag(j)">{{ j.dag_id }}</button>
                  <span v-if="j.task_id" class="af-muted af-small"> / {{ j.task_id }}</span>
                </td>
                <td><span class="af-state"><i :style="{ background: jobColor(j.state) }"></i>{{ j.state }}</span></td>
                <td>{{ j.job_type }}</td>
                <td class="af-nowrap">{{ fmtDate(j.start_date) }}</td>
                <td class="af-nowrap">{{ fmtDate(j.end_date) }}</td>
                <td class="af-nowrap">{{ fmtDate(j.latest_heartbeat) }}</td>
                <td>{{ j.executor_class || '' }}</td>
                <td class="af-mono">{{ j.hostname }}</td>
                <td class="af-mono">airflow</td>
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
/**
 * Browse > Jobs: the scheduler and triggerer heartbeats, and one LocalTaskJob
 * per task instance a worker picked up. The Health check runs the stock
 * `airflow jobs check` - the command a liveness probe uses.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AfIcon from './AfIcon.vue';
import { useAf } from './afContext';
import { CMD, fmtDate, stateColor, type AfJob } from './airflow';

const af = useAf();
const CHECKABLE = ['SchedulerJob', 'TriggererJob'];
const checkMenu = ref(false);
const fType = ref('');
const fState = ref('');
const fDag = ref('');
const sortKey = ref<'id' | 'start_date'>('id');
const sortDir = ref<'asc' | 'desc'>('desc');

const types = computed(() => [...new Set(af.jobs.value.map(j => j.job_type))].sort());
const states = computed(() => [...new Set(af.jobs.value.map(j => j.state))].sort());
const shown = computed(() => {
  const list = af.jobs.value.filter(j => (!fType.value || j.job_type === fType.value)
    && (!fState.value || j.state === fState.value)
    && (!fDag.value || String(j.dag_id || '').toLowerCase().includes(fDag.value.toLowerCase())));
  const dir = sortDir.value === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const x = a[sortKey.value] ?? '';
    const y = b[sortKey.value] ?? '';
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
});

function sortOn(k: 'id' | 'start_date') {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = k; sortDir.value = 'asc'; }
}
function arrow(k: string) { return sortKey.value === k ? (sortDir.value === 'asc' ? '▲' : '▼') : ''; }
function jobColor(state: string) { return state === 'running' ? stateColor('running') : stateColor(state); }
function openDag(j: AfJob) {
  if (j.dag_id) af.go({ page: 'dag', dagId: j.dag_id, tab: j.task_id ? 'logs' : 'details', runId: j.run_id, taskId: j.task_id });
}

async function check(jobType: string) {
  checkMenu.value = false;
  const result = await af.run(CMD.jobsCheck(jobType), { quiet: true });
  if (result.ok) af.notify('success', `${jobType}: ${String(result.output || '').trim() || 'alive'}`);
  else af.notify('error', `${jobType} is not alive`, String(result.error || result.output || ''));
}

function close(event: MouseEvent) {
  if (!(event.target as HTMLElement | null)?.closest?.('.af-menu-anchor')) checkMenu.value = false;
}
onMounted(() => window.addEventListener('click', close));
onBeforeUnmount(() => window.removeEventListener('click', close));
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-jobs__filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.af-jobs__f { width: auto; min-width: 150px; height: 30px; font-size: 13px; }
.af-jobs__menu { right: 0; top: 30px; min-width: 300px; }
</style>
