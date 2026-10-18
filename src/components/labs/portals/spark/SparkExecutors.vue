<template>
  <section>
    <h3 class="spk-h3">Executors</h3>
    <h4 class="spk-h4"><span class="arrow-open"></span><a href="#" @click.prevent>Summary</a></h4>
    <div class="table-wrap">
      <table class="table table-bordered table-sm">
        <thead>
          <tr><th></th><th>RDD Blocks</th><th>Storage Memory</th><th>Disk Used</th><th>Cores</th><th>Active Tasks</th>
            <th>Failed Tasks</th><th>Complete Tasks</th><th>Total Tasks</th><th>Task Time (GC Time)</th><th>Input</th>
            <th>Shuffle Read</th><th>Shuffle Write</th><th>Excluded</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in summary" :key="row.label">
            <td><strong>{{ row.label }}</strong></td><td>0</td><td>{{ row.storage }}</td><td>0.0 B</td><td>{{ row.cores }}</td>
            <td>0</td><td>0</td><td>{{ row.tasks }}</td><td>{{ row.tasks }}</td>
            <td>{{ duration(row.time) }} ({{ duration(row.gc) }})</td><td>{{ bytes(row.input) }}</td>
            <td>{{ bytes(row.read) }}</td><td>{{ bytes(row.write) }}</td><td>0</td>
          </tr>
        </tbody>
      </table>
    </div>
    <h4 class="spk-h4"><span class="arrow-open"></span><a href="#" @click.prevent>Executors</a></h4>
    <div class="table-wrap">
      <table class="table table-bordered table-sm">
        <thead>
          <tr><th>Executor ID</th><th>Address</th><th>Status</th><th>RDD Blocks</th><th>Storage Memory</th><th>Disk Used</th>
            <th>Cores</th><th>Active Tasks</th><th>Failed Tasks</th><th>Complete Tasks</th><th>Total Tasks</th>
            <th>Task Time (GC Time)</th><th>Input</th><th>Shuffle Read</th><th>Shuffle Write</th><th>Logs</th><th>Thread Dump</th></tr>
        </thead>
        <tbody>
          <tr v-for="e in rowsOut" :key="e.id">
            <td>{{ e.id }}</td><td>{{ e.address }}</td><td>{{ app.completed ? 'Dead' : 'Active' }}</td><td>0</td>
            <td>0.0 B / {{ bytes(e.maxMemoryBytes) }}</td><td>0.0 B</td><td>{{ e.cores }}</td><td>0</td><td>0</td>
            <td>{{ e.tasks }}</td><td>{{ e.tasks }}</td>
            <td :style="{ background: heat(e.time) }">{{ duration(e.time) }} ({{ duration(e.gc) }})</td>
            <td>{{ bytes(e.input) }}</td><td>{{ bytes(e.read) }}</td><td>{{ bytes(e.write) }}</td>
            <td><template v-if="e.id !== 'driver'"><a href="#" @click.prevent>stdout</a> <a href="#" @click.prevent>stderr</a></template></td>
            <td><a v-if="!app.completed" href="#" @click.prevent>Thread Dump</a></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { bytes, duration, executorsFor, taskIdBase, tasksFor, type SparkApp } from './spark';

const props = defineProps<{ app: SparkApp; view: Record<string, any> }>();

const executors = computed(() => executorsFor(props.view));
const allTasks = computed(() => props.app.stages.flatMap(s => tasksFor(s, executors.value, taskIdBase(props.app, s))));
const rowsOut = computed(() => executors.value.map(e => {
  const own = allTasks.value.filter(t => t.executor === e.id);
  return { ...e, tasks: own.length, time: own.reduce((n, t) => n + t.durationMs, 0), gc: own.reduce((n, t) => n + t.gcMs, 0),
           input: own.reduce((n, t) => n + t.inputBytes, 0), read: own.reduce((n, t) => n + t.shuffleRead, 0),
           write: own.reduce((n, t) => n + t.shuffleWrite, 0) };
}));
const summary = computed(() => {
  const total = rowsOut.value.reduce((acc, e) => ({
    cores: acc.cores + e.cores, tasks: acc.tasks + e.tasks, time: acc.time + e.time, gc: acc.gc + e.gc,
    input: acc.input + e.input, read: acc.read + e.read, write: acc.write + e.write, mem: acc.mem + e.maxMemoryBytes,
  }), { cores: 0, tasks: 0, time: 0, gc: 0, input: 0, read: 0, write: 0, mem: 0 });
  const active = props.app.completed ? 0 : rowsOut.value.length;
  const row = (label: string, on: boolean) => ({ label, storage: `0.0 B / ${bytes(on ? total.mem : 0)}`, cores: on ? total.cores : 0,
    tasks: on ? total.tasks : 0, time: on ? total.time : 0, gc: on ? total.gc : 0, input: on ? total.input : 0,
    read: on ? total.read : 0, write: on ? total.write : 0 });
  return [row(`Active(${active})`, !props.app.completed), row(`Dead(${rowsOut.value.length - active})`, props.app.completed),
          row(`Total(${rowsOut.value.length})`, true)];
});
function heat(time: number) {
  const max = Math.max(1, ...rowsOut.value.map(e => e.time));
  return time ? `rgba(255, 0, 0, ${(0.35 * time) / max})` : 'transparent';
}
</script>

<style scoped>
.table td, .table th { white-space: nowrap; }
</style>
