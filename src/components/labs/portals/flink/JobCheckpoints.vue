<template>
  <div class="fk-cp">
    <div class="fk-tabs fk-tabs--inner">
      <button v-for="t in TABS" :key="t" type="button" class="fk-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>

    <div v-if="!stats.enabled && tab !== 'Configuration'" class="fk-alert fk-alert--warning">
      <FkIcon name="warning" />
      <span>Checkpointing is not enabled for this job. Set <code class="fk-mono">execution.checkpointing.interval</code>
        (for example <code class="fk-mono">SET 'execution.checkpointing.interval' = '30s';</code>) before submitting the INSERT.</span>
    </div>

    <!-- ===== Overview ===== -->
    <template v-if="tab === 'Overview'">
      <section class="fk-card">
        <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Checkpoint Counts</span></header>
        <div class="fk-counts">
          <div><span>Triggered</span><strong>{{ stats.triggered }}</strong></div>
          <div><span>In Progress</span><strong>{{ stats.in_progress }}</strong></div>
          <div><span>Completed</span><strong>{{ stats.completed }}</strong></div>
          <div><span>Failed</span><strong :class="{ 'is-bad': stats.failed }">{{ stats.failed }}</strong></div>
          <div><span>Restored</span><strong>{{ stats.restored }}</strong></div>
        </div>
      </section>
      <section class="fk-card">
        <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Latest Completed Checkpoint</span></header>
        <div class="fk-card__body fk-card__body--tight">
          <dl v-if="latestCompleted" class="fk-desc">
            <dt>Checkpoint ID</dt><dd>{{ latestCompleted.id }}</dd>
            <dt>Completion Time</dt><dd>{{ fmtTime(latestCompleted.ack) }}</dd>
            <dt>End to End Duration</dt><dd>{{ fmtDuration(latestCompleted.duration_ms) }}</dd>
            <dt>Checkpointed Data Size</dt><dd>{{ fmtBytes(latestCompleted.size_kb * 1024) }}</dd>
            <dt>Path</dt><dd class="fk-mono">{{ latestCompleted.path || job.checkpoints.latest_path || cpPath(latestCompleted.id) }}</dd>
          </dl>
          <p v-else class="fk-muted fk-none">None</p>
        </div>
      </section>
      <section class="fk-card">
        <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Latest Failed Checkpoint</span></header>
        <div class="fk-card__body fk-card__body--tight">
          <dl v-if="latestFailed" class="fk-desc">
            <dt>Checkpoint ID</dt><dd>{{ latestFailed.id }}</dd>
            <dt>Failure Time</dt><dd>{{ fmtTime(latestFailed.trigger) }}</dd>
            <dt>Cause</dt><dd>{{ job.checkpoints.failure_cause || 'Checkpoint expired before completing.' }}</dd>
          </dl>
          <p v-else class="fk-muted fk-none">None</p>
        </div>
      </section>
      <section class="fk-card">
        <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Latest Savepoint</span></header>
        <div class="fk-card__body fk-card__body--tight">
          <dl v-if="latestSavepoint" class="fk-desc">
            <dt>Path</dt><dd class="fk-mono">{{ latestSavepoint.path }}</dd>
            <dt>Completion Time</dt><dd>{{ fmtTime(latestSavepoint.at) }}</dd>
          </dl>
          <p v-else class="fk-muted fk-none">None</p>
        </div>
      </section>
      <section class="fk-card">
        <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Latest Restore</span></header>
        <div class="fk-card__body fk-card__body--tight">
          <dl v-if="stats.restored_from" class="fk-desc">
            <dt>Type</dt><dd>{{ /savepoint/i.test(stats.restored_from) ? 'Savepoint' : 'Checkpoint' }}</dd>
            <dt>Path</dt><dd class="fk-mono">{{ stats.restored_from }}</dd>
          </dl>
          <p v-else class="fk-muted fk-none">None</p>
        </div>
      </section>
    </template>

    <!-- ===== History ===== -->
    <section v-else-if="tab === 'History'" class="fk-card">
      <div class="fk-table-wrap">
        <table class="fk-table fk-table--sm">
          <thead>
            <tr>
              <th>ID</th><th>Status</th><th>Acknowledged</th><th>Trigger Time</th><th>Latest Acknowledgement</th>
              <th>End to End Duration</th><th>Checkpointed Data Size</th><th>Full Checkpoint Data Size</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cp in history" :key="cp.id">
              <td class="num">{{ cp.id }}<span v-if="cp.savepoint" class="fk-tag fk-tag--blue fk-sp">Savepoint</span></td>
              <td><span class="fk-tag" :style="{ background: stateColor(cp.status) }">{{ cp.status }}</span></td>
              <td class="num">{{ cp.status === 'FAILED' ? '0' : tasks }}/{{ tasks }} (100%)</td>
              <td class="nowrap">{{ fmtTime(cp.trigger) }}</td>
              <td class="nowrap">{{ cp.status === 'FAILED' ? '-' : fmtTime(cp.ack) }}</td>
              <td class="nowrap">{{ cp.status === 'FAILED' ? '-' : fmtDuration(cp.duration_ms) }}</td>
              <td class="num">{{ cp.status === 'FAILED' ? '-' : fmtBytes(cp.size_kb * 1024) }}</td>
              <td class="num">{{ cp.status === 'FAILED' ? '-' : fmtBytes(cp.size_kb * 1024 * 3.2) }}</td>
            </tr>
            <tr v-if="!history.length"><td colspan="8" class="fk-empty">No checkpoint has been triggered yet.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===== Summary ===== -->
    <section v-else-if="tab === 'Summary'" class="fk-card">
      <div class="fk-table-wrap">
        <table class="fk-table fk-table--sm">
          <thead><tr><th></th><th>End to End Duration</th><th>Checkpointed Data Size</th><th>Full Checkpoint Data Size</th></tr></thead>
          <tbody>
            <tr v-for="row in summary" :key="row.label">
              <td><strong>{{ row.label }}</strong></td>
              <td class="num">{{ row.duration }}</td>
              <td class="num">{{ row.size }}</td>
              <td class="num">{{ row.full }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===== Configuration ===== -->
    <section v-else class="fk-card">
      <div class="fk-table-wrap">
        <table class="fk-table fk-table--sm">
          <thead><tr><th>Option</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Checkpointing Mode</td><td><span class="fk-tag" :class="stats.mode === 'EXACTLY_ONCE' ? 'fk-tag--green' : 'fk-tag--orange'">{{ stats.mode === 'EXACTLY_ONCE' ? 'Exactly Once' : 'At Least Once' }}</span></td></tr>
            <tr><td>Checkpoint Storage</td><td>FileSystemCheckpointStorage</td></tr>
            <tr><td>State Backend</td><td>EmbeddedRocksDBStateBackend</td></tr>
            <tr><td>Interval</td><td>{{ stats.interval_s ? fmtDuration(stats.interval_s * 1000) : 'Periodic checkpoints disabled' }}</td></tr>
            <tr><td>Timeout</td><td>{{ fmtDuration(stats.timeout_s * 1000) }}</td></tr>
            <tr><td>Minimum Pause Between Checkpoints</td><td>{{ fmtDuration(stats.min_pause_ms) }}</td></tr>
            <tr><td>Maximum Concurrent Checkpoints</td><td>{{ stats.max_concurrent }}</td></tr>
            <tr><td>Unaligned Checkpoints</td><td>{{ stats.unaligned ? 'Enabled' : 'Disabled' }}</td></tr>
            <tr><td>Persist Checkpoints Externally</td><td>Enabled ({{ stats.externalized }})</td></tr>
            <tr><td>Checkpoints Directory</td><td class="fk-mono wrap">{{ CHECKPOINT_DIR }}/{{ job.jid }}</td></tr>
            <tr><td>Tolerable Failed Checkpoints</td><td>0</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FkIcon from './FkIcon.vue';
import {
  CHECKPOINT_DIR, checkpointHistory, checkpointStats, fmtBytes, fmtDuration, fmtTime, stateColor, type FkJob, type FkSavepoint,
} from './flink';

const props = defineProps<{ job: FkJob; savepoints?: FkSavepoint[] }>();
const TABS = ['Overview', 'History', 'Summary', 'Configuration'] as const;
const tab = ref<(typeof TABS)[number]>('Overview');

const stats = computed(() => checkpointStats(props.job));
const history = computed(() => checkpointHistory(props.job));
const tasks = computed(() => props.job.vertices.reduce((sum, v) => sum + (v.parallelism || 1), 0) || 1);
const latestCompleted = computed(() => history.value.find(cp => cp.status === 'COMPLETED' && !cp.savepoint));
const latestFailed = computed(() => history.value.find(cp => cp.status === 'FAILED'));
const latestSavepoint = computed(() => {
  const list = props.job.savepoints
    .map((s: any) => (typeof s === 'string' ? { path: s, at: null } : { path: String(s?.path ?? ''), at: s?.at ?? null }))
    .filter(s => s.path);
  const global = props.savepoints || [];
  const last = list[list.length - 1];
  if (!last) return null;
  const known = global.find(s => s.path === last.path);
  return { path: last.path, at: last.at ?? known?.at ?? null };
});
function cpPath(id: number) {
  return `${CHECKPOINT_DIR}/${props.job.jid}/chk-${id}`;
}

const summary = computed(() => {
  const done = history.value.filter(cp => cp.status === 'COMPLETED');
  if (!done.length) return [{ label: 'Minimum', duration: '-', size: '-', full: '-' },
    { label: 'Average', duration: '-', size: '-', full: '-' }, { label: 'Maximum', duration: '-', size: '-', full: '-' }];
  const durations = done.map(cp => cp.duration_ms);
  const sizes = done.map(cp => cp.size_kb * 1024);
  const stat = (list: number[], f: 'min' | 'avg' | 'max') =>
    f === 'min' ? Math.min(...list) : f === 'max' ? Math.max(...list) : list.reduce((a, b) => a + b, 0) / list.length;
  return (['min', 'avg', 'max'] as const).map(f => ({
    label: f === 'min' ? 'Minimum' : f === 'avg' ? 'Average' : 'Maximum',
    duration: fmtDuration(stat(durations, f)),
    size: fmtBytes(Math.round(stat(sizes, f))),
    full: fmtBytes(Math.round(stat(sizes, f) * 3.2)),
  }));
});
</script>

<style scoped src="./fk.css"></style>
<style scoped>
.fk-cp { display: flex; flex-direction: column; gap: 16px; }
.fk-tabs--inner { padding: 0; background: none; }
.fk-counts { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.fk-counts > div { padding: 14px 16px; border-right: 1px solid var(--fk-border-split); display: flex; flex-direction: column; gap: 4px; }
.fk-counts > div:last-child { border-right: 0; }
.fk-counts span { color: var(--fk-text-3); font-size: 13px; }
.fk-counts strong { font-size: 22px; font-weight: 500; color: var(--fk-heading); font-variant-numeric: tabular-nums; }
.fk-counts strong.is-bad { color: #cf1322; }
.fk-card__body--tight { padding: 12px; }
.fk-none { margin: 0; padding: 4px; }
.fk-sp { margin-left: 6px; }
@container sl-portal (max-width: 760px) {
  .fk-counts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fk-counts > div { border-bottom: 1px solid var(--fk-border-split); }
}
</style>
