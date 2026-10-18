<template>
  <section v-if="stage">
    <h3 class="spk-h3">Details for Stage {{ stage.stageId }} (Attempt 0)</h3>
    <ul class="list-unstyled">
      <li><strong>Resource Profile Id:</strong> 0</li>
      <li><strong>Total Time Across All Tasks:</strong> {{ duration(totalTime) }}</li>
      <li><strong>Locality Level Summary:</strong> {{ stage.stageId === firstStageId ? 'Node local' : 'Process local' }}: {{ stage.tasks }}</li>
      <li v-if="stage.inputBytes"><strong>Input Size / Records:</strong> {{ bytes(stage.inputBytes) }} / {{ stage.inputRows }}</li>
      <li v-if="stage.shuffleRead"><strong>Shuffle Read Size / Records:</strong> {{ bytes(stage.shuffleRead) }} / {{ Math.round(stage.shuffleRead / 24) }}</li>
      <li v-if="stage.shuffleWrite"><strong>Shuffle Write Size / Records:</strong> {{ bytes(stage.shuffleWrite) }} / {{ Math.round(stage.shuffleWrite / 24) }}</li>
      <li><strong>Associated Job Ids:</strong>{{ ' ' }}
        <a href="#" @click.prevent="$emit('navigate', { page: 'job', app: app.id, id: stage.jobId })">{{ stage.jobId }}</a></li>
    </ul>

    <SparkDag :stages="[stage]" :start-open="false" />

    <h4 class="spk-h4"><span class="arrow-open"></span><a href="#" @click.prevent>Summary Metrics for {{ tasks.length }} Completed Tasks</a></h4>
    <div class="table-wrap">
      <table class="table table-bordered table-sm">
        <thead><tr><th>Metric</th><th>Min</th><th>25th percentile</th><th>Median</th><th>75th percentile</th><th>Max</th></tr></thead>
        <tbody>
          <tr><td>Duration</td><td v-for="(v, i) in q(tasks.map(t => t.durationMs))" :key="i">{{ duration(v) }}</td></tr>
          <tr><td>GC Time</td><td v-for="(v, i) in q(tasks.map(t => t.gcMs))" :key="i">{{ duration(v) }}</td></tr>
          <tr v-if="stage.inputBytes"><td>Input Size / Records</td><td v-for="(v, i) in q(tasks.map(t => t.inputBytes))" :key="i">{{ bytes(v) }} / {{ Math.round(v / 90) }}</td></tr>
          <tr v-if="stage.shuffleRead"><td>Shuffle Read Size / Records</td><td v-for="(v, i) in q(tasks.map(t => t.shuffleRead))" :key="i">{{ bytes(v) }} / {{ Math.round(v / 24) }}</td></tr>
          <tr v-if="stage.shuffleWrite"><td>Shuffle Write Size / Records</td><td v-for="(v, i) in q(tasks.map(t => t.shuffleWrite))" :key="i">{{ bytes(v) }} / {{ Math.round(v / 24) }}</td></tr>
        </tbody>
      </table>
    </div>

    <h4 class="spk-h4"><span class="arrow-open"></span><a href="#" @click.prevent>Aggregated Metrics by Executor</a></h4>
    <div class="table-wrap">
      <table class="table table-bordered table-sm">
        <thead><tr><th>Executor ID</th><th>Address</th><th>Task Time</th><th>Total Tasks</th><th>Failed Tasks</th><th>Succeeded Tasks</th><th>Shuffle Read Size / Records</th><th>Shuffle Write Size / Records</th></tr></thead>
        <tbody>
          <tr v-for="e in byExecutor" :key="e.id">
            <td>{{ e.id }}</td><td>{{ e.address }}</td><td>{{ duration(e.time) }}</td><td>{{ e.count }}</td><td>0</td><td>{{ e.count }}</td>
            <td>{{ bytes(e.read) }} / {{ Math.round(e.read / 24) }}</td><td>{{ bytes(e.write) }} / {{ Math.round(e.write / 24) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h4 class="spk-h4"><span class="arrow-open"></span><a href="#" @click.prevent>Tasks ({{ tasks.length }})</a></h4>
    <div class="table-wrap">
      <table class="table table-bordered table-sm">
        <thead>
          <tr><th>Index</th><th>Task ID</th><th>Attempt</th><th>Status</th><th>Locality Level</th><th>Executor ID</th><th>Host</th>
            <th>Launch Time</th><th>Duration</th><th>GC Time</th><th>Shuffle Read Size / Records</th><th>Shuffle Write Size / Records</th><th>Errors</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in tasks" :key="t.taskId">
            <td>{{ t.index }}</td><td>{{ t.taskId }}</td><td>0</td><td>SUCCESS</td>
            <td>{{ stage.stageId === firstStageId ? 'NODE_LOCAL' : 'PROCESS_LOCAL' }}</td>
            <td>{{ t.executor }}</td><td>{{ t.host }}</td><td class="sd__nowrap">{{ date(t.launch) }}</td>
            <td>{{ duration(t.durationMs) }}</td><td>{{ t.gcMs ? duration(t.gcMs) : '' }}</td>
            <td>{{ t.shuffleRead ? bytes(t.shuffleRead) + ' / ' + Math.round(t.shuffleRead / 24) : '' }}</td>
            <td>{{ t.shuffleWrite ? bytes(t.shuffleWrite) + ' / ' + Math.round(t.shuffleWrite / 24) : '' }}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
  <p v-else>No information to display for Stage {{ stageId }} (Attempt 0)</p>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { bytes, date, duration, executorsFor, quantiles, taskIdBase, tasksFor, type SparkApp } from './spark';
import SparkDag from './SparkDag.vue';

const props = defineProps<{ app: SparkApp; view: Record<string, any>; stageId: number }>();
defineEmits<{ (event: 'navigate', route: any): void }>();

const stage = computed(() => props.app.stages.find(s => s.stageId === props.stageId));
const firstStageId = computed(() => {
  const s = stage.value;
  return s ? (props.app.jobs.find(j => j.jobId === s.jobId)?.stages[0]?.stageId ?? -1) : -1;
});
const executors = computed(() => executorsFor(props.view));
const tasks = computed(() => (stage.value ? tasksFor(stage.value, executors.value, taskIdBase(props.app, stage.value)) : []));
const totalTime = computed(() => tasks.value.reduce((n, t) => n + t.durationMs, 0));
const q = quantiles;
const byExecutor = computed(() => executors.value.filter(e => e.id !== 'driver').map(e => {
  const own = tasks.value.filter(t => t.executor === e.id);
  return { id: e.id, address: e.address, count: own.length, time: own.reduce((n, t) => n + t.durationMs, 0),
           read: own.reduce((n, t) => n + t.shuffleRead, 0), write: own.reduce((n, t) => n + t.shuffleWrite, 0) };
}).filter(e => e.count));
</script>

<style scoped>
.sd__nowrap { white-space: nowrap; }
.table td, .table th { white-space: nowrap; }
</style>
