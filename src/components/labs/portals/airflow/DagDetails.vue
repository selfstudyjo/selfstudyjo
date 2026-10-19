<template>
  <div class="af-ddet">
    <table class="af-kv">
      <tbody>
        <tr class="af-kv__section"><th colspan="2">DAG Runs Summary</th></tr>
        <tr><th>Total Runs Displayed</th><td>{{ runs.length }}</td></tr>
        <tr v-for="s in runStateRows" :key="s.state"><th>Total {{ s.state }}</th>
          <td><span class="af-state"><i :style="{ background: stateColor(s.state) }"></i>{{ s.count }}</span></td></tr>
        <tr><th>First Run Start</th><td>{{ fmtDate(firstStart) }}</td></tr>
        <tr><th>Last Run Start</th><td>{{ fmtDate(lastStart) }}</td></tr>
        <tr><th>Max Run Duration</th><td>{{ fmtDuration(durStats.max) }}</td></tr>
        <tr><th>Mean Run Duration</th><td>{{ fmtDuration(durStats.mean) }}</td></tr>
        <tr><th>Min Run Duration</th><td>{{ fmtDuration(durStats.min) }}</td></tr>

        <tr class="af-kv__section"><th colspan="2">DAG Summary</th></tr>
        <tr><th>Total Tasks</th><td>{{ dag.tasks.length }}</td></tr>
        <tr v-for="[op, n] in operators" :key="op"><th>{{ op }}s</th><td>{{ n }}</td></tr>

        <tr class="af-kv__section"><th colspan="2">DAG Details</th></tr>
        <tr><th>Dag id</th><td class="af-mono">{{ dag.dag_id }}</td></tr>
        <tr><th>Description</th><td>{{ dag.description || 'None' }}</td></tr>
        <tr><th>Schedule interval</th><td><span class="af-pill">{{ scheduleLabel(dag.schedule) }}</span></td></tr>
        <tr><th>Is paused</th><td>{{ dag.paused ? 'true' : 'false' }}</td></tr>
        <tr><th>Catchup</th><td>{{ dag.catchup ? 'true' : 'false' }}</td></tr>
        <tr><th>Start date</th><td>{{ fmtDate(dag.start_date) || dag.start_date }}</td></tr>
        <tr><th>Max active runs</th><td>{{ activeRuns }} / {{ dag.max_active_runs ?? 16 }}</td></tr>
        <tr><th>Max active tasks</th><td>{{ dag.max_active_tasks ?? 16 }}</td></tr>
        <tr><th>Owners</th><td>{{ dag.owner || 'airflow' }}</td></tr>
        <tr><th>Tags</th><td>{{ dag.tags.join(', ') || 'None' }}</td></tr>
        <tr><th>Next run</th><td>{{ fmtDate(dag.next_run) || 'None' }}</td></tr>
        <tr><th>Dagrun timeout</th><td>{{ dag.dagrun_timeout || 'None' }}</td></tr>
        <tr><th>Fileloc</th><td class="af-mono">{{ dag.fileloc }}</td></tr>
        <tr v-if="dag.params && Object.keys(dag.params).length"><th>Params</th><td><pre class="af-code af-code--wrap">{{ JSON.stringify(dag.params, null, 2) }}</pre></td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAf } from './afContext';
import { fmtDate, fmtDuration, normState, scheduleLabel, secondsBetween, stateColor, type AfDag } from './airflow';

const props = defineProps<{ dag: AfDag }>();
const af = useAf();
const runs = computed(() => af.runsOf(props.dag.dag_id));
const runStateRows = computed(() => {
  const counts: Record<string, number> = {};
  runs.value.forEach(r => { const s = normState(r.state); counts[s] = (counts[s] || 0) + 1; });
  return Object.entries(counts).map(([state, count]) => ({ state, count }));
});
const starts = computed(() => runs.value.map(r => String(r.start || '')).filter(Boolean).sort());
const firstStart = computed(() => starts.value[0] || '');
const lastStart = computed(() => starts.value[starts.value.length - 1] || '');
const durStats = computed(() => {
  const d = runs.value.map(r => secondsBetween(r.start, r.end)).filter((x): x is number => x !== null);
  if (!d.length) return { max: null, mean: null, min: null };
  return { max: Math.max(...d), min: Math.min(...d), mean: d.reduce((a, b) => a + b, 0) / d.length };
});
const activeRuns = computed(() => runs.value.filter(r => ['running', 'queued'].includes(normState(r.state))).length);
const operators = computed(() => {
  const counts = new Map<string, number>();
  props.dag.tasks.forEach(t => counts.set(t.operator, (counts.get(t.operator) || 0) + 1));
  return [...counts.entries()];
});
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-ddet { min-width: 0; }
</style>
