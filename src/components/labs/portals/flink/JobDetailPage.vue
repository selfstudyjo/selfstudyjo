<template>
  <div v-if="!job" class="fk-page">
    <div class="fk-alert fk-alert--warning">
      <FkIcon name="warning" />
      <span>Job <code class="fk-mono">{{ fk.route.value.jid }}</code> was not found on this cluster.
        <button type="button" class="fk-link" @click="fk.go({ page: 'overview' })">Back to Overview</button></span>
    </div>
  </div>
  <div v-else class="fk-page fk-page--flush">
    <!-- ===== The job status bar ===== -->
    <section class="fk-status">
      <div class="fk-status__top">
        <h1 class="fk-status__name" :title="job.name">{{ job.name }}</h1>
        <span class="fk-tag" :style="{ background: stateColor(job.state) }">{{ job.state }}</span>
        <span class="fk-spacer"></span>
        <div class="fk-status__actions">
          <template v-if="running">
            <button type="button" class="fk-btn" :disabled="fk.busy.value" @click="openSavepoint">
              <FkIcon name="save" />Trigger Savepoint
            </button>
            <button type="button" class="fk-btn" :disabled="fk.busy.value" @click="openStop">
              <FkIcon name="stop" />Stop with Savepoint
            </button>
            <button type="button" class="fk-btn fk-btn--danger" :disabled="fk.busy.value" @click="cancelJob">Cancel Job</button>
          </template>
          <button v-else-if="resumePath" type="button" class="fk-btn fk-btn--primary" @click="resume">
            <FkIcon name="play" />Resume from Savepoint
          </button>
        </div>
      </div>
      <dl class="fk-status__desc">
        <div><dt>Job ID</dt><dd class="fk-mono">{{ job.jid }}</dd></div>
        <div><dt>Job State</dt><dd>{{ job.state }}</dd></div>
        <div><dt>Start Time</dt><dd>{{ fmtTime(job.start) }}</dd></div>
        <div><dt>Duration</dt><dd>{{ durationText }}</dd></div>
        <div><dt>End Time</dt><dd>{{ fmtTime(jobEndMs(job)) }}</dd></div>
      </dl>
    </section>

    <nav class="fk-tabs" aria-label="Job">
      <button v-for="t in TABS" :key="t.id" type="button" class="fk-tab" :class="{ 'is-active': tab === t.id }" @click="setTab(t.id)">
        {{ t.label }}
      </button>
    </nav>

    <div class="fk-page fk-tabbody">
      <!-- ===== Overview: the graph and the vertex table ===== -->
      <template v-if="tab === 'overview'">
        <div v-if="job.state === 'FAILED' && rootException" class="fk-alert fk-alert--error">
          <FkIcon name="error" /><span>{{ rootLine }}
            <button type="button" class="fk-link" @click="setTab('exceptions')">View exceptions</button></span>
        </div>
        <JobGraph :job="job" :selected="selected" @select="select" />
        <section class="fk-card">
          <div class="fk-table-wrap">
            <table class="fk-table fk-table--sm">
              <thead>
                <tr>
                  <th>Name</th><th>Status</th><th class="num">Bytes Received</th><th class="num">Records Received</th>
                  <th class="num">Bytes Sent</th><th class="num">Records Sent</th><th class="num">Parallelism</th>
                  <th>Start Time</th><th>Duration</th><th>Tasks</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(v, i) in job.vertices" :key="v.id" class="is-link" :class="{ 'is-selected': v.id === selected }"
                    @click="select(v.id)">
                  <td class="wrap fk-vname">{{ v.name }}</td>
                  <td><span class="fk-tag" :style="{ background: stateColor(vertexState) }">{{ vertexState }}</span></td>
                  <td class="num">{{ fmtBytes(v.bytes_in ?? (i === 0 ? 0 : v.records_in * 96)) }}</td>
                  <td class="num">{{ fmtCount(i === 0 ? 0 : v.records_in) }}</td>
                  <td class="num">{{ fmtBytes(v.bytes_out ?? (i === job.vertices.length - 1 ? 0 : v.records_out * 96)) }}</td>
                  <td class="num">{{ fmtCount(i === job.vertices.length - 1 ? 0 : v.records_out) }}</td>
                  <td class="num">{{ v.parallelism }}</td>
                  <td class="nowrap">{{ fmtTime(job.start) }}</td>
                  <td class="nowrap">{{ durationText }}</td>
                  <td><span class="fk-taskbox" :style="{ background: stateColor(vertexState) }">{{ v.parallelism }}</span></td>
                </tr>
                <tr v-if="!job.vertices.length"><td colspan="10" class="fk-empty">No vertices.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- The vertex panel the dashboard opens under the graph -->
        <section v-if="vertex" class="fk-card">
          <header class="fk-card__head fk-card__head--sm">
            <span class="fk-card__title" :title="vertex.name">{{ vertex.name }}</span>
            <button type="button" class="fk-btn fk-btn--sm fk-btn--link" aria-label="Close" @click="selected = ''"><FkIcon name="close" /></button>
          </header>
          <div class="fk-tabs fk-tabs--card">
            <button v-for="t in VTABS" :key="t" type="button" class="fk-tab fk-tab--sm" :class="{ 'is-active': vtab === t }" @click="vtab = t">{{ t }}</button>
          </div>
          <div class="fk-card__body fk-vbody">
            <dl v-if="vtab === 'Detail'" class="fk-desc">
              <dt>Vertex ID</dt><dd class="fk-mono">{{ vertex.id }}</dd>
              <dt>Parallelism</dt><dd>{{ vertex.parallelism }}</dd>
              <dt>Records Received</dt><dd>{{ fmtCount(vertex.records_in) }}</dd>
              <dt>Records Sent</dt><dd>{{ fmtCount(vertex.records_out) }}</dd>
              <dt>Input Ship Strategy</dt><dd>{{ inputStrategy(vertex) }}</dd>
              <dt>Low Watermark</dt><dd>{{ fmtWatermark(vertexWatermark(vertex)) }}</dd>
              <dt>Back Pressure</dt><dd><span class="fk-tag" :class="bpClass(vertex)">{{ bpLevel(vertex) }}</span></dd>
            </dl>
            <div v-else-if="vtab === 'SubTasks'" class="fk-table-wrap">
              <table class="fk-table fk-table--sm">
                <thead><tr><th>ID</th><th class="num">Records Received</th><th class="num">Records Sent</th><th>Endpoint</th><th>Status</th></tr></thead>
                <tbody>
                  <tr v-for="s in subtasks(vertex)" :key="s.index">
                    <td>{{ s.index }}</td><td class="num">{{ fmtCount(s.in) }}</td><td class="num">{{ fmtCount(s.out) }}</td>
                    <td class="fk-mono">{{ s.host }}</td>
                    <td><span class="fk-tag" :style="{ background: stateColor(vertexState) }">{{ vertexState }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else-if="vtab === 'Watermarks'" class="fk-table-wrap">
              <table class="fk-table fk-table--sm">
                <thead><tr><th>SubTask</th><th>Watermark</th></tr></thead>
                <tbody>
                  <tr v-for="s in subtasks(vertex)" :key="s.index"><td>{{ s.index }}</td><td>{{ fmtWatermark(vertexWatermark(vertex)) }}</td></tr>
                </tbody>
              </table>
            </div>
            <div v-else>
              <p class="fk-bp-head">Back Pressure Status: <span class="fk-tag" :class="bpClass(vertex)">{{ bpLevel(vertex) }}</span>
                <span class="fk-muted">Measurement: just now</span></p>
              <div class="fk-table-wrap">
                <table class="fk-table fk-table--sm">
                  <thead><tr><th>SubTask</th><th>Backpressured / Idle / Busy</th><th>Status</th></tr></thead>
                  <tbody>
                    <tr v-for="s in subtasks(vertex)" :key="s.index">
                      <td>{{ s.index }}</td>
                      <td>{{ bp(vertex) }}% / {{ idle(vertex) }}% / {{ busy(vertex) }}%</td>
                      <td><span class="fk-tag" :class="bpClass(vertex)">{{ bpLevel(vertex) }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- ===== Exceptions ===== -->
      <template v-else-if="tab === 'exceptions'">
        <section class="fk-card">
          <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Root Exception</span></header>
          <div class="fk-card__body">
            <pre v-if="rootException" class="fk-pre">{{ rootException }}</pre>
            <p v-else class="fk-muted fk-none">No Root Exception</p>
          </div>
        </section>
        <section class="fk-card">
          <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Exception History</span></header>
          <div class="fk-table-wrap">
            <table class="fk-table fk-table--sm">
              <thead><tr><th>Time</th><th>Exception</th><th>Task Name</th><th>Location</th></tr></thead>
              <tbody>
                <tr v-for="(e, i) in exceptionHistory" :key="i">
                  <td class="nowrap">{{ fmtTime(e.at) }}</td><td class="wrap">{{ e.exception }}</td>
                  <td class="wrap">{{ e.task || '-' }}</td><td class="fk-mono">{{ e.location || '-' }}</td>
                </tr>
                <tr v-if="!exceptionHistory.length"><td colspan="4" class="fk-empty">No exceptions have been recorded for this job.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <!-- ===== TimeLine ===== -->
      <section v-else-if="tab === 'timeline'" class="fk-card">
        <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Job Timeline</span></header>
        <div class="fk-card__body">
          <div class="fk-tl">
            <div class="fk-tl__axis"><span>{{ fmtTime(timeline.start) }}</span><span>{{ timeline.endLabel }}</span></div>
            <div v-for="row in timeline.rows" :key="row.id" class="fk-tl__row">
              <span class="fk-tl__name" :title="row.name">{{ row.name }}</span>
              <span class="fk-tl__track">
                <span class="fk-tl__bar" :style="{ left: row.left + '%', width: row.width + '%', background: stateColor(vertexState) }"
                      :title="row.name + ': ' + vertexState"></span>
              </span>
            </div>
            <p v-if="!timeline.rows.length" class="fk-muted">No vertices.</p>
          </div>
        </div>
      </section>

      <!-- ===== Checkpoints ===== -->
      <JobCheckpoints v-else-if="tab === 'checkpoints'" :job="job" :savepoints="fk.savepoints.value" />

      <!-- ===== Configuration ===== -->
      <template v-else-if="tab === 'configuration'">
        <section class="fk-card">
          <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Execution Configuration</span></header>
          <div class="fk-table-wrap">
            <table class="fk-table fk-table--sm">
              <thead><tr><th>Execution Config Key</th><th>Execution Config Value</th></tr></thead>
              <tbody>
                <tr><td>Execution Mode</td><td>PIPELINED</td></tr>
                <tr><td>Max. Number of Execution Retries</td><td>Restart with fixed delay (1 s). #3 restart attempts.</td></tr>
                <tr><td>Job Parallelism</td><td>{{ job.parallelism }}</td></tr>
                <tr><td>Object Reuse Mode</td><td>false</td></tr>
                <tr v-if="job.sink"><td>Sink</td><td>{{ job.sink }}<span v-if="job.sink_connector"> ({{ job.sink_connector }}{{ job.transactional ? ', transactional' : '' }})</span></td></tr>
                <tr v-if="job.transactional"><td>Pending (uncommitted) records</td><td>{{ fmtCount(job.pending) }}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="fk-card">
          <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">User Configuration</span></header>
          <div class="fk-table-wrap">
            <table class="fk-table fk-table--sm">
              <thead><tr><th>Key</th><th>Value</th></tr></thead>
              <tbody>
                <tr v-for="[k, v] in userConfig" :key="k"><td class="fk-mono">{{ k }}</td><td class="fk-mono wrap">{{ v }}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section v-if="job.sql" class="fk-card">
          <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Submitted Flink SQL</span>
            <span class="fk-card__extra"><button type="button" class="fk-btn fk-btn--sm" @click="fk.openSubmit(job.sql)">Open in SQL Gateway</button></span>
          </header>
          <div class="fk-card__body"><pre class="fk-pre">{{ job.sql }}</pre></div>
        </section>
      </template>

      <!-- ===== Watermarks ===== -->
      <section v-else-if="tab === 'watermarks'" class="fk-card">
        <div v-if="job.idle_note" class="fk-alert fk-alert--warning fk-inner-alert"><FkIcon name="warning" /><span>{{ job.idle_note }}</span></div>
        <div class="fk-card__body fk-wm-note">
          <span>Low watermark per vertex. Records arriving behind the watermark for a window that has already fired are dropped.</span>
          <span class="fk-wm-late">numLateRecordsDropped: <strong>{{ fmtCount(job.late_records_dropped) }}</strong></span>
        </div>
        <div class="fk-table-wrap">
          <table class="fk-table fk-table--sm">
            <thead><tr><th>Vertex</th><th class="num">Parallelism</th><th>Low Watermark</th></tr></thead>
            <tbody>
              <tr v-for="v in job.vertices" :key="v.id">
                <td class="wrap fk-vname">{{ v.name }}</td><td class="num">{{ v.parallelism }}</td>
                <td>{{ fmtWatermark(vertexWatermark(v)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ===== BackPressure ===== -->
      <section v-else class="fk-card">
        <div v-if="running && job.backpressure_reason" class="fk-alert fk-alert--warning fk-inner-alert">
          <FkIcon name="warning" /><span><strong>Back pressure {{ job.backpressure }}:</strong> {{ job.backpressure_reason }}</span>
        </div>
        <div class="fk-table-wrap">
          <table class="fk-table fk-table--sm">
            <thead><tr><th>Vertex</th><th>Back Pressure Status</th><th class="num">Backpressured (max)</th><th class="num">Idle</th><th class="num">Busy (max)</th></tr></thead>
            <tbody>
              <tr v-for="v in job.vertices" :key="v.id">
                <td class="wrap fk-vname">{{ v.name }}</td>
                <td><span class="fk-tag" :class="bpClass(v)">{{ bpLevel(v) }}</span></td>
                <td class="num">{{ bp(v) }}%</td><td class="num">{{ idle(v) }}%</td><td class="num">{{ busy(v) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- ===== Trigger Savepoint ===== -->
    <FkModal v-if="dialog === 'savepoint'" title="Trigger Savepoint" ok-text="Trigger" :busy="fk.busy.value"
             @close="dialog = ''" @ok="triggerSavepoint">
      <p class="fk-modal-text">Takes a savepoint of <strong>{{ job.name }}</strong> while it keeps running.</p>
      <label class="fk-field">Target directory
        <input v-model="dir" class="fk-input fk-mono" type="text" :placeholder="SAVEPOINT_DIR" />
        <small>Leave empty to use <code>state.savepoints.dir</code>.</small>
      </label>
      <div v-if="dialogError" class="fk-alert fk-alert--error"><FkIcon name="error" /><span>{{ dialogError }}</span></div>
    </FkModal>

    <!-- ===== Stop with Savepoint ===== -->
    <FkModal v-if="dialog === 'stop'" title="Stop with Savepoint" ok-text="Stop" danger :busy="fk.busy.value"
             @close="dialog = ''" @ok="stopJob">
      <p class="fk-modal-text">Gracefully stops <strong>{{ job.name }}</strong>, taking a final savepoint the job can be resumed from.</p>
      <label class="fk-field">Savepoint directory
        <input v-model="dir" class="fk-input fk-mono" type="text" :placeholder="SAVEPOINT_DIR" />
      </label>
      <label class="fk-check"><input v-model="drain" type="checkbox" />Drain (emit MAX_WATERMARK, firing every open window before stopping)</label>
      <div v-if="dialogError" class="fk-alert fk-alert--error"><FkIcon name="error" /><span>{{ dialogError }}</span></div>
    </FkModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { errorText, rows } from '@/utils/portalKit';
import FkIcon from './FkIcon.vue';
import FkModal from './FkModal.vue';
import JobGraph from './JobGraph.vue';
import JobCheckpoints from './JobCheckpoints.vue';
import { useFk } from './fkContext';
import {
  SAVEPOINT_DIR, backpressuredPct, busyPct, checkpointStats, cmd, fmtBytes, fmtCount, fmtDuration, fmtTime,
  fmtWatermark, graphEdges, isRunning, jobDurationMs, jobEndMs, stateColor, type FkVertex,
} from './flink';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'timeline', label: 'TimeLine' },
  { id: 'checkpoints', label: 'Checkpoints' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'watermarks', label: 'Watermarks' },
  { id: 'backpressure', label: 'BackPressure' },
];
const VTABS = ['Detail', 'SubTasks', 'Watermarks', 'BackPressure'] as const;

const fk = useFk();
const job = computed(() => fk.job(String(fk.route.value.jid || '')));
const running = computed(() => (job.value ? isRunning(job.value) : false));
const tab = computed(() => fk.route.value.tab || 'overview');
const selected = ref('');
const vtab = ref<(typeof VTABS)[number]>('Detail');
const vertex = computed(() => job.value?.vertices.find(v => v.id === selected.value));
const vertexState = computed(() => (job.value?.state === 'CANCELLING' ? 'CANCELING' : String(job.value?.state || '')));

function setTab(id: string) {
  fk.go({ page: 'job', jid: fk.route.value.jid, tab: id });
}
function select(id: string) {
  selected.value = selected.value === id ? '' : id;
}

const durationText = computed(() => (job.value ? fmtDuration(jobDurationMs(job.value)) : '-'));

// ---------------------------------------------------------------- per-vertex figures
const bp = (v: FkVertex) => (job.value ? backpressuredPct(v, job.value) : 0);
const busy = (v: FkVertex) => (job.value ? busyPct(v, job.value) : 0);
const idle = (v: FkVertex) => Math.max(0, 100 - bp(v) - busy(v));
function bpLevel(v: FkVertex) {
  if (!running.value) return 'OK';
  const level = String(v.backpressure || 'OK').toUpperCase();
  return level === 'HIGH' || level === 'LOW' ? level : 'OK';
}
function bpClass(v: FkVertex) {
  const level = bpLevel(v);
  return level === 'HIGH' ? 'fk-tag--red' : level === 'LOW' ? 'fk-tag--orange' : 'fk-tag--green';
}
function vertexWatermark(v: FkVertex) {
  return v.watermark ?? job.value?.watermark ?? null;
}
function inputStrategy(v: FkVertex) {
  if (!job.value) return '-';
  const edge = graphEdges(job.value.vertices).find(e => e.to === v.id);
  return edge ? edge.strategy : 'Source (no input)';
}
function subtasks(v: FkVertex) {
  const n = Math.max(1, v.parallelism || 1);
  const tms = fk.taskManagers.value;
  return Array.from({ length: n }, (_, i) => ({
    index: i,
    in: Math.floor(v.records_in / n) + (i < v.records_in % n ? 1 : 0),
    out: Math.floor(v.records_out / n) + (i < v.records_out % n ? 1 : 0),
    host: tms.length ? tms[i % tms.length].id.split(':')[0] + ':' + (35000 + i) : `localhost:${35000 + i}`,
  }));
}

// ---------------------------------------------------------------- exceptions and timeline
const rootException = computed(() => {
  const j = job.value as Record<string, any> | undefined;
  if (!j) return '';
  return String(j.root_exception || j.exception || j.failure_cause || j.error || '');
});
const rootLine = computed(() => rootException.value.split('\n')[0]);
const exceptionHistory = computed(() => {
  const j = job.value as Record<string, any> | undefined;
  if (!j) return [];
  const list = rows(j, 'exceptions').map((e: any) => ({
    at: e.at ?? e.timestamp ?? null, exception: String(e.exception ?? e.message ?? e.name ?? ''),
    task: e.task ?? e.taskName ?? '', location: e.location ?? '',
  }));
  if (!list.length && rootException.value) {
    list.push({ at: j.end ?? null, exception: rootException.value.split('\n')[0], task: '', location: '' });
  }
  return list;
});

const timeline = computed(() => {
  const j = job.value;
  if (!j) return { start: null, endLabel: '', rows: [] as any[] };
  const start = j.startMs ?? fk.simNow.value;
  const end = jobEndMs(j) ?? (running.value ? Math.max(start + 1000, fk.simNow.value) : start + (jobDurationMs(j) ?? 1000));
  const span = Math.max(1, end - start);
  const n = j.vertices.length;
  return {
    start,
    endLabel: running.value ? 'now' : fmtTime(end),
    rows: j.vertices.map((v, i) => {
      const offset = Math.min(span * 0.08, 400 * (n - i));
      return { id: v.id, name: v.name, left: (offset / span) * 100, width: Math.max(1, 100 - (offset / span) * 100) };
    }),
  };
});

const userConfig = computed(() => {
  const j = job.value;
  if (!j) return [] as [string, string][];
  const stats = checkpointStats(j);
  const out: Record<string, string> = {
    'pipeline.name': j.name,
    'parallelism.default': String(j.parallelism),
    'execution.runtime-mode': 'streaming',
    'execution.checkpointing.mode': stats.mode,
  };
  if (stats.interval_s) out['execution.checkpointing.interval'] = `${stats.interval_s} s`;
  if (stats.restored_from) out['execution.savepoint.path'] = stats.restored_from;
  const own = (j as Record<string, any>).config;
  if (own && typeof own === 'object') for (const [k, v] of Object.entries(own)) out[k] = String(v);
  if (j.sink) out['table.exec.sink'] = j.sink;
  return Object.entries(out);
});

// ---------------------------------------------------------------- actions
const dialog = ref<'' | 'savepoint' | 'stop'>('');
const dialogError = ref('');
const dir = ref('');
const drain = ref(false);
watch(dialog, () => { dialogError.value = ''; });

const resumePath = computed(() => {
  const j = job.value;
  if (!j) return '';
  const own = j.savepoints.map((s: any) => (typeof s === 'string' ? s : String(s?.path || ''))).filter(Boolean);
  if (own.length) return own[own.length - 1];
  const global = fk.savepoints.value.filter(s => s.job === j.jid);
  return global.length ? global[global.length - 1].path : '';
});

function openSavepoint() { dir.value = SAVEPOINT_DIR; dialog.value = 'savepoint'; }
function openStop() { dir.value = SAVEPOINT_DIR; drain.value = false; dialog.value = 'stop'; }

function savedPath(output: string | undefined) {
  const match = String(output || '').match(/(?:Path|path)[:\s]+(\S+)/);
  return match ? match[1] : '';
}

async function triggerSavepoint() {
  const j = job.value;
  if (!j) return;
  const result = await fk.run(cmd.savepoint(j.jid, dir.value), { quiet: true });
  if (!result.ok) { dialogError.value = errorText(result); return; }
  dialog.value = '';
  fk.notify('success', 'Savepoint completed', savedPath(result.output) || String(result.output || '').trim().split('\n').pop() || '');
}

async function stopJob() {
  const j = job.value;
  if (!j) return;
  const result = await fk.run(cmd.stop(j.jid, dir.value, drain.value), { quiet: true });
  if (!result.ok) { dialogError.value = errorText(result); return; }
  dialog.value = '';
  fk.notify('success', 'Job stopped with savepoint', savedPath(result.output) || String(result.output || '').trim().split('\n').pop() || '');
}

async function cancelJob() {
  const j = job.value;
  if (!j) return;
  const yes = await fk.confirm({ title: 'Cancel Job', message: `Do you want to cancel the job "${j.name}"? Its state is not saved; to resume it later, use Stop with Savepoint instead.`, yes: 'Yes', danger: true });
  if (!yes) return;
  await fk.run(cmd.cancel(j.jid), { success: 'Job canceled' });
}

function resume() {
  const j = job.value;
  if (!j) return;
  fk.openSubmit(j.sql, resumePath.value);
}
</script>

<style scoped src="./fk.css"></style>
<style scoped>
.fk-status { background: #fff; padding: 16px 24px 4px; border-bottom: 1px solid var(--fk-border-split); }
.fk-status__top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.fk-status__name { margin: 0; font-size: 20px; line-height: 28px; font-weight: 500; color: var(--fk-heading); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.fk-spacer { flex: 1; }
.fk-status__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.fk-status__desc { display: flex; flex-wrap: wrap; gap: 4px 40px; margin: 12px 0; }
.fk-status__desc > div { display: flex; gap: 8px; font-size: 14px; min-width: 0; }
.fk-status__desc dt { color: var(--fk-text-3); }
.fk-status__desc dd { margin: 0; color: var(--fk-heading); overflow-wrap: anywhere; }
.fk-tabbody { padding-top: 16px; gap: 16px; }
.fk-vname { min-width: 220px; }
.fk-taskbox { display: inline-block; min-width: 22px; height: 20px; padding: 0 5px; border-radius: 2px; color: #fff; font-size: 12px; line-height: 20px; text-align: center; }
.fk-tab--sm { margin-left: 16px; margin-right: 16px; padding: 10px 0; }
.fk-vbody { padding: 16px; }
.fk-bp-head { margin: 0 0 12px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.fk-none { margin: 0; }
.fk-wm-note { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 12px 16px; color: var(--fk-text-2); }
.fk-wm-late strong { color: var(--fk-heading); }
.fk-inner-alert { margin: 12px 16px 0; }
.fk-modal-text { margin: 0; overflow-wrap: anywhere; }
.fk-tl { display: flex; flex-direction: column; gap: 10px; }
.fk-tl__axis { display: flex; justify-content: space-between; font-size: 12px; color: var(--fk-text-3); margin-left: 240px; }
.fk-tl__row { display: flex; align-items: center; gap: 12px; }
.fk-tl__name { flex: none; width: 228px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.fk-tl__track { position: relative; flex: 1; height: 18px; background: #fafafa; border: 1px solid var(--fk-border-split); }
.fk-tl__bar { position: absolute; top: 2px; bottom: 2px; border-radius: 2px; }
@container sl-portal (max-width: 760px) {
  .fk-status { padding: 12px 16px 2px; }
  .fk-status__desc { gap: 4px 20px; }
  .fk-tl__axis { margin-left: 132px; }
  .fk-tl__name { width: 120px; }
}
</style>
