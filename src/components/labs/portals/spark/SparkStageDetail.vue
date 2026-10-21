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
      <li v-if="stage.spillDisk"><strong>Spill (Memory):</strong> {{ bytes(stage.spillMemory) }}</li>
      <li v-if="stage.spillDisk"><strong>Spill (Disk):</strong> {{ bytes(stage.spillDisk) }}</li>
      <li><strong>Associated Job Ids:</strong>{{ ' ' }}
        <a href="#" @click.prevent="$emit('navigate', { page: 'job', app: app.id, id: stage.jobId })">{{ stage.jobId }}</a></li>
    </ul>

    <SparkDag :stages="[stage]" :start-open="false" />

    <!-- Show Additional Metrics, as the real page offers it. -->
    <h4 class="spk-h4" @click="extraOpen = !extraOpen">
      <span :class="extraOpen ? 'arrow-open' : 'arrow-closed'"></span><a href="#" @click.prevent>Show Additional Metrics</a>
    </h4>
    <div v-if="extraOpen" class="sd__extras">
      <label><input type="checkbox" :checked="extras.length === EXTRA.length" @change="toggleAllExtras" /> (De)select All</label>
      <label v-for="m in EXTRA" :key="m.id" :title="m.tip"><input v-model="extras" type="checkbox" :value="m.id" /> {{ m.label }}</label>
    </div>

    <SparkTimeline :items="taskTimeline" item-label="Tasks" />

    <h4 class="spk-h4" @click="open.summary = !open.summary">
      <span :class="open.summary ? 'arrow-open' : 'arrow-closed'"></span><a href="#" @click.prevent>Summary Metrics for {{ tasks.length }} Completed Tasks</a>
    </h4>
    <div v-if="open.summary" class="table-wrap">
      <table class="table table-bordered table-sm">
        <thead><tr><th>Metric</th><th>Min</th><th>25th percentile</th><th>Median</th><th>75th percentile</th><th>Max</th></tr></thead>
        <tbody>
          <tr><td>Duration</td><td v-for="(v, i) in q(tasks.map(t => t.durationMs))" :key="i">{{ duration(v) }}</td></tr>
          <tr><td>GC Time</td><td v-for="(v, i) in q(tasks.map(t => t.gcMs))" :key="i">{{ duration(v) }}</td></tr>
          <tr v-for="m in shownExtras" :key="m.id"><td>{{ m.label }}</td>
            <td v-for="(v, i) in q(tasks.map(t => extraValue(m.id, t)))" :key="i">{{ m.bytes ? bytes(v) : duration(v) }}</td></tr>
          <tr v-if="stage.inputBytes"><td>Input Size / Records</td><td v-for="(v, i) in q(tasks.map(t => t.inputBytes))" :key="i">{{ bytes(v) }} / {{ Math.round(v / 90) }}</td></tr>
          <tr v-if="stage.shuffleRead"><td>Shuffle Read Size / Records</td><td v-for="(v, i) in q(tasks.map(t => t.shuffleRead))" :key="i">{{ bytes(v) }} / {{ Math.round(v / 24) }}</td></tr>
          <tr v-if="stage.shuffleWrite"><td>Shuffle Write Size / Records</td><td v-for="(v, i) in q(tasks.map(t => t.shuffleWrite))" :key="i">{{ bytes(v) }} / {{ Math.round(v / 24) }}</td></tr>
          <tr v-if="stage.spillDisk"><td>Spill (memory)</td><td v-for="(v, i) in q(tasks.map(t => t.spillMemory))" :key="i">{{ bytes(v) }}</td></tr>
          <tr v-if="stage.spillDisk"><td>Spill (disk)</td><td v-for="(v, i) in q(tasks.map(t => t.spillDisk))" :key="i">{{ bytes(v) }}</td></tr>
        </tbody>
      </table>
    </div>

    <h4 class="spk-h4" @click="open.exec = !open.exec">
      <span :class="open.exec ? 'arrow-open' : 'arrow-closed'"></span><a href="#" @click.prevent>Aggregated Metrics by Executor</a>
    </h4>
    <div v-if="open.exec" class="table-wrap">
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

    <h4 class="spk-h4" @click="open.tasks = !open.tasks">
      <span :class="open.tasks ? 'arrow-open' : 'arrow-closed'"></span><a href="#" @click.prevent>Tasks ({{ tasks.length }})</a>
    </h4>
    <template v-if="open.tasks">
      <div class="sd__bar">
        <label>Show
          <select v-model.number="pageSize" class="sd__select" aria-label="Entries per page">
            <option v-for="n in [20, 40, 60, 100]" :key="n" :value="n">{{ n }}</option>
            <option :value="0">All</option>
          </select> entries</label>
        <span class="sd__spacer"></span>
        <label>Search: <input v-model="search" class="sd__search" aria-label="Search tasks" /></label>
      </div>
      <div class="table-wrap">
        <table class="table table-bordered table-sm sd__tasks">
          <thead>
            <tr>
              <th v-for="col in columns" :key="col.id" :class="{ 'is-sortable': col.sort }" :aria-sort="ariaSort(col.id)"
                  @click="col.sort && sortBy(col.id)">{{ col.label }} <span class="sd__arrow">{{ arrow(col.id) }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in pageRows" :key="t.taskId">
              <td>{{ t.index }}</td><td>{{ t.taskId }}</td><td>0</td><td>SUCCESS</td>
              <td>{{ stage.stageId === firstStageId ? 'NODE_LOCAL' : 'PROCESS_LOCAL' }}</td>
              <td>{{ t.executor }}</td><td>{{ t.host }}</td><td class="sd__nowrap">{{ date(t.launch) }}</td>
              <td :class="{ 'sd__slow': t.durationMs > slowThreshold }">{{ duration(t.durationMs) }}</td><td>{{ t.gcMs ? duration(t.gcMs) : '' }}</td>
              <td v-for="m in shownExtras" :key="m.id">{{ m.bytes ? bytes(extraValue(m.id, t)) : duration(extraValue(m.id, t)) }}</td>
              <td v-if="stage.inputBytes">{{ t.inputBytes ? bytes(t.inputBytes) + ' / ' + Math.round(t.inputBytes / 90) : '' }}</td>
              <td>{{ t.shuffleRead ? bytes(t.shuffleRead) + ' / ' + Math.round(t.shuffleRead / 24) : '' }}</td>
              <td>{{ t.shuffleWrite ? bytes(t.shuffleWrite) + ' / ' + Math.round(t.shuffleWrite / 24) : '' }}</td>
              <template v-if="stage.spillDisk"><td>{{ t.spillMemory ? bytes(t.spillMemory) : '' }}</td><td>{{ t.spillDisk ? bytes(t.spillDisk) : '' }}</td></template>
              <td></td>
            </tr>
            <tr v-if="!pageRows.length"><td :colspan="columns.length" class="spk-empty">No matching records found</td></tr>
          </tbody>
        </table>
      </div>
      <div class="sd__bar">
        <span>Showing {{ filtered.length ? first + 1 : 0 }} to {{ Math.min(filtered.length, first + (pageSize || filtered.length)) }} of {{ filtered.length }} entries
          <template v-if="filtered.length !== tasks.length"> (filtered from {{ tasks.length }} total entries)</template></span>
        <span class="sd__spacer"></span>
        <nav v-if="pages > 1" class="sd__pager" aria-label="Task pages">
          <button type="button" :disabled="page === 0" @click="page--">Previous</button>
          <button v-for="p in pageList" :key="p" type="button" :class="{ active: p === page }" @click="page = p">{{ p + 1 }}</button>
          <button type="button" :disabled="page >= pages - 1" @click="page++">Next</button>
        </nav>
      </div>
    </template>
  </section>
  <p v-else>No information to display for Stage {{ stageId }} (Attempt 0)</p>
</template>

<script setup lang="ts">
/**
 * One stage: its DAG, an event timeline of its tasks, the summary quantiles,
 * the per-executor totals and the task table - sortable, searchable and paged
 * the way the real page's DataTables are, with the "Show Additional Metrics"
 * columns. Read-only, as the real page is.
 */
import { computed, reactive, ref, watch } from 'vue';
import { bytes, date, duration, executorsFor, quantiles, taskIdBase, tasksFor, unit, type SparkApp, type SparkTask } from './spark';
import SparkDag from './SparkDag.vue';
import SparkTimeline from './SparkTimeline.vue';

const props = defineProps<{ app: SparkApp; view: Record<string, any>; stageId: number }>();
defineEmits<{ (event: 'navigate', route: any): void }>();

const EXTRA = [
  { id: 'sched', label: 'Scheduler Delay', tip: 'Time the task waited to be scheduled', bytes: false },
  { id: 'deser', label: 'Task Deserialization Time', tip: 'Time spent deserializing the task closure', bytes: false },
  { id: 'resser', label: 'Result Serialization Time', tip: 'Time spent serializing the task result', bytes: false },
  { id: 'getres', label: 'Getting Result Time', tip: 'Time the driver spent fetching the result', bytes: false },
  { id: 'peak', label: 'Peak Execution Memory', tip: 'Peak memory used by shuffles, aggregations and joins', bytes: true },
] as const;
type ExtraId = typeof EXTRA[number]['id'];

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

const open = reactive({ summary: true, exec: true, tasks: true });
const extraOpen = ref(false);
const extras = ref<ExtraId[]>([]);
const shownExtras = computed(() => EXTRA.filter(m => extras.value.includes(m.id)));
function toggleAllExtras() {
  extras.value = extras.value.length === EXTRA.length ? [] : EXTRA.map(m => m.id);
}
/** Derived per task, deterministically, so a reload draws the same numbers. */
function extraValue(id: ExtraId, t: SparkTask): number {
  const seed = `${stage.value?.key}:${t.index}:${id}`;
  switch (id) {
    case 'sched': return Math.round(1 + 12 * unit(seed));
    case 'deser': return Math.round(2 + Math.min(40, t.durationMs * 0.03) * unit(seed));
    case 'resser': return Math.round(unit(seed) * 2);
    case 'getres': return 0;
    default: return Math.round((t.shuffleRead + t.shuffleWrite) * 1.6 + t.spillMemory + 256 * 1024 * unit(seed));
  }
}

// ---- the event timeline of this stage's tasks ----
const taskTimeline = computed(() => tasks.value.slice(0, 200).map(t => ({
  start: t.launch, end: t.launch + t.durationMs, label: `Task ${t.index} (exec ${t.executor})`, status: 'succeeded',
})));

// ---- the task table ----
type ColId = 'index' | 'taskId' | 'attempt' | 'status' | 'locality' | 'executor' | 'host' | 'launch' | 'durationMs'
  | 'gcMs' | ExtraId | 'inputBytes' | 'shuffleRead' | 'shuffleWrite' | 'spillMemory' | 'spillDisk' | 'errors';
const columns = computed(() => {
  const s = stage.value;
  const cols: { id: ColId; label: string; sort: boolean }[] = [
    { id: 'index', label: 'Index', sort: true }, { id: 'taskId', label: 'Task ID', sort: true },
    { id: 'attempt', label: 'Attempt', sort: false }, { id: 'status', label: 'Status', sort: false },
    { id: 'locality', label: 'Locality Level', sort: false }, { id: 'executor', label: 'Executor ID', sort: true },
    { id: 'host', label: 'Host', sort: true }, { id: 'launch', label: 'Launch Time', sort: true },
    { id: 'durationMs', label: 'Duration', sort: true }, { id: 'gcMs', label: 'GC Time', sort: true },
    ...shownExtras.value.map(m => ({ id: m.id as ColId, label: m.label, sort: true })),
  ];
  if (s?.inputBytes) cols.push({ id: 'inputBytes', label: 'Input Size / Records', sort: true });
  cols.push({ id: 'shuffleRead', label: 'Shuffle Read Size / Records', sort: true },
            { id: 'shuffleWrite', label: 'Shuffle Write Size / Records', sort: true });
  if (s?.spillDisk) cols.push({ id: 'spillMemory', label: 'Spill (Memory)', sort: true }, { id: 'spillDisk', label: 'Spill (Disk)', sort: true });
  cols.push({ id: 'errors', label: 'Errors', sort: false });
  return cols;
});
const sortKey = ref<ColId>('index');
const sortDir = ref<'asc' | 'desc'>('asc');
const search = ref('');
const pageSize = ref(20);
const page = ref(0);
function valueOf(t: SparkTask, id: ColId): number | string {
  if (EXTRA.some(m => m.id === id)) return extraValue(id as ExtraId, t);
  const v = (t as unknown as Record<string, unknown>)[id];
  return typeof v === 'number' ? v : String(v ?? '');
}
function sortBy(id: ColId) {
  if (sortKey.value === id) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = id; sortDir.value = id === 'durationMs' || id === 'gcMs' ? 'desc' : 'asc'; }
  page.value = 0;
}
function arrow(id: string) {
  return sortKey.value === id ? (sortDir.value === 'asc' ? '▴' : '▾') : '';
}
function ariaSort(id: string) {
  return sortKey.value === id ? (sortDir.value === 'asc' ? 'ascending' : 'descending') : undefined;
}
const filtered = computed(() => {
  const needle = search.value.trim().toLowerCase();
  const list = needle ? tasks.value.filter(t => [t.index, t.taskId, t.executor, t.host, duration(t.durationMs)]
    .some(v => String(v).toLowerCase().includes(needle))) : tasks.value;
  const key = sortKey.value;
  return [...list].sort((a, b) => {
    const x = valueOf(a, key);
    const y = valueOf(b, key);
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return sortDir.value === 'asc' ? order : -order;
  });
});
const pages = computed(() => (pageSize.value ? Math.max(1, Math.ceil(filtered.value.length / pageSize.value)) : 1));
const first = computed(() => (pageSize.value ? page.value * pageSize.value : 0));
const pageRows = computed(() => (pageSize.value ? filtered.value.slice(first.value, first.value + pageSize.value) : filtered.value));
const pageList = computed(() => {
  const lo = Math.max(0, Math.min(page.value - 2, pages.value - 5));
  return Array.from({ length: Math.min(5, pages.value) }, (_, i) => lo + i);
});
const slowThreshold = computed(() => {
  const qs = quantiles(tasks.value.map(t => t.durationMs));
  return qs.length ? qs[2] * 3 : Infinity;
});
watch([search, pageSize], () => { page.value = 0; });
watch(() => props.stageId, () => { page.value = 0; search.value = ''; });
</script>

<style scoped>
.sd__nowrap { white-space: nowrap; }
.table td, .table th { white-space: nowrap; }
.sd__tasks th.is-sortable { cursor: pointer; user-select: none; }
.sd__tasks th.is-sortable:hover { background: #eef5fb; }
.sd__arrow { color: #0077b3; font-size: 11px; }
.sd__slow { background: #fff3cd; }
.sd__extras { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 4px 0 10px 18px; font-size: 13px; }
.sd__extras label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.sd__bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; margin: 6px 0; }
.sd__spacer { flex: 1; }
.sd__select, .sd__search { border: 1px solid #ced4da; border-radius: 3px; padding: 2px 6px; font: inherit; font-size: 13px; background: #fff; color: #212529; }
.sd__search { width: 160px; }
.sd__pager { display: flex; gap: 0; }
.sd__pager button { border: 1px solid #dee2e6; background: #fff; color: #0077b3; padding: 3px 10px; font: inherit; font-size: 13px; cursor: pointer; margin-left: -1px; }
.sd__pager button.active { background: #0077b3; color: #fff; border-color: #0077b3; }
.sd__pager button:disabled { color: #6c757d; cursor: default; }
</style>
