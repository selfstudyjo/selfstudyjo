<template>
  <div class="af-tsum">
    <h3 class="af-h3 af-tsum__title">{{ taskId }}</h3>
    <table class="af-kv">
      <tbody>
        <tr class="af-kv__section"><th colspan="2">Task Details</th></tr>
        <tr><th>Operator</th><td>{{ task?.operator }}</td></tr>
        <tr><th>Trigger rule</th><td>{{ task?.trigger_rule || 'all_success' }}</td></tr>
        <tr><th>Retries</th><td>{{ task?.retries ?? 0 }}</td></tr>
        <tr><th>Pool</th><td>{{ task?.pool || 'default_pool' }}</td></tr>
        <tr><th>Mapped</th><td>{{ task?.mapped ? 'true' : 'false' }}</td></tr>
        <tr><th>Upstream</th><td>{{ task?.upstream.join(', ') || 'None' }}</td></tr>
        <tr><th>Downstream</th><td>{{ task?.downstream.join(', ') || 'None' }}</td></tr>
      </tbody>
    </table>
    <h4 class="af-h4">Task instances in the displayed runs</h4>
    <div class="af-table-wrap">
      <table class="af-table">
        <thead><tr><th>Run</th><th>State</th><th>Try</th><th>Duration</th></tr></thead>
        <tbody>
          <tr v-for="t in list" :key="t.run_id"><td class="af-mono">{{ t.run_id }}</td>
            <td><span class="af-state"><i :style="{ background: stateColor(t.state) }"></i>{{ stateLabel(t.state) }}</span></td>
            <td>{{ t.try_number }}</td><td>{{ fmtDuration(t.duration_s) }}</td></tr>
          <tr v-if="!list.length"><td colspan="4" class="af-empty-cell">No task instances yet.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAf } from './afContext';
import { fmtDuration, stateColor, stateLabel, type AfDag, type AfRun } from './airflow';

const props = defineProps<{ dag: AfDag; taskId: string; runs: AfRun[] }>();
const af = useAf();
const task = computed(() => props.dag.tasks.find(t => t.task_id === props.taskId));
const list = computed(() => {
  const ids = new Set(props.runs.map(r => r.run_id));
  return af.tisOf(props.dag.dag_id).filter(t => t.task_id === props.taskId && ids.has(t.run_id)).reverse();
});
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-tsum { display: flex; flex-direction: column; gap: 10px; }
.af-tsum__title { font-family: var(--af-mono); overflow-wrap: anywhere; }
</style>
