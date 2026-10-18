<template>
  <div class="mf-page mf-cmp">
    <nav class="mf-crumbs" aria-label="Breadcrumb">
      <button type="button" @click="backToExp">Experiments</button><span class="mf-sep">/</span>
      <button type="button" @click="backToExp">{{ expNames.join(', ') || 'Default' }}</button><span class="mf-sep">/</span>
    </nav>
    <h1 class="mf-title">Comparing {{ runs.length }} Runs from {{ expNames.length || 1 }} Experiment{{ expNames.length > 1 ? 's' : '' }}</h1>

    <div v-if="runs.length < 2" class="mf-alert mf-alert--warning"><MfIcon name="warning" />
      <span>Select at least two runs to compare. Some of the selected runs no longer exist.</span></div>

    <div class="mf-table-wrap">
      <table class="mf-table mf-cmp__grid">
        <tbody>
          <tr><th scope="row">Run ID:</th><td v-for="r in runs" :key="r.run_id" class="mf-mono">
            <button type="button" class="mf-link" @click="openRun(r.run_id)">{{ r.run_id.slice(0, 12) }}…</button></td></tr>
          <tr><th scope="row">Run Name:</th><td v-for="r in runs" :key="r.run_id">
            <span class="mf-dot" :style="{ background: runColor(r.run_id) }"></span> {{ r.run_name }}</td></tr>
          <tr><th scope="row">Start Time:</th><td v-for="r in runs" :key="r.run_id">{{ fullTime(r.start_time) }}</td></tr>
        </tbody>
      </table>
    </div>

    <section class="mf-section">
      <h2 class="mf-h2">Visualizations</h2>
      <div class="mf-tabs" role="tablist">
        <button v-for="t in vizTabs" :key="t" type="button" role="tab" class="mf-tab" :class="{ 'is-active': viz === t }"
                :aria-selected="viz === t" @click="viz = t">{{ t }}</button>
      </div>
      <div v-if="viz === 'Parallel Coordinates Plot'" class="mf-cmp__viz">
        <div class="mf-cmp__pickers">
          <fieldset class="mf-cmp__pick"><legend class="mf-label">Parameters:</legend>
            <label v-for="p in paramKeys" :key="p" class="mf-cmp__opt"><input v-model="pcParams" type="checkbox" class="mf-check" :value="p" />{{ p }}</label>
          </fieldset>
          <fieldset class="mf-cmp__pick"><legend class="mf-label">Metrics:</legend>
            <label v-for="m in metricKeys" :key="m" class="mf-cmp__opt"><input v-model="pcMetrics" type="checkbox" class="mf-check" :value="m" />{{ m }}</label>
          </fieldset>
        </div>
        <div class="mf-cmp__plot"><ParallelCoords :rows="pcRows" :keys="[...pcParams, ...pcMetrics]" /></div>
      </div>
      <div v-else-if="viz === 'Scatter Plot'" class="mf-cmp__viz">
        <div class="mf-cmp__pickers">
          <label class="mf-field"><span class="mf-label">X-axis:</span>
            <select v-model="sx" class="mf-select" aria-label="X-axis"><option v-for="k in axisKeys" :key="k" :value="k">{{ k }}</option></select></label>
          <label class="mf-field"><span class="mf-label">Y-axis:</span>
            <select v-model="sy" class="mf-select" aria-label="Y-axis"><option v-for="k in axisKeys" :key="k" :value="k">{{ k }}</option></select></label>
        </div>
        <div class="mf-cmp__scatter">
          <LineChart :title="`${sy} vs ${sx}`" :x-label="sx" :series="scatterSeries" />
        </div>
      </div>
      <div v-else class="mf-cmp__viz">
        <div class="mf-cmp__charts">
          <LineChart v-for="key in historyKeys" :key="key" :title="key"
                     :series="runs.filter(r => r.history[key]).map(r => ({ name: r.run_name, color: runColor(r.run_id), points: r.history[key] }))" />
        </div>
      </div>
    </section>

    <section class="mf-section">
      <div class="mf-section-head">
        <h2 class="mf-h2">Parameters</h2><span class="mf-spacer"></span>
        <button type="button" class="mf-switch" :class="{ 'is-on': diffOnly }" role="switch" :aria-checked="diffOnly" @click="diffOnly = !diffOnly">
          <i></i>Show diff only</button>
      </div>
      <div class="mf-table-wrap">
        <table class="mf-table mf-cmp__grid">
          <tbody>
            <tr v-for="key in shownParams" :key="key" :class="{ 'mf-cmp__diff': differs(key, 'params') }">
              <th scope="row">{{ key }}</th><td v-for="r in runs" :key="r.run_id" class="mf-mono">{{ r.params[key] ?? '-' }}</td></tr>
            <tr v-if="!shownParams.length"><td class="mf-muted">No parameters {{ diffOnly ? 'differ' : 'recorded' }}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="mf-section">
      <h2 class="mf-h2">Metrics</h2>
      <div class="mf-table-wrap">
        <table class="mf-table mf-cmp__grid">
          <tbody>
            <tr v-for="key in shownMetrics" :key="key" :class="{ 'mf-cmp__diff': differs(key, 'metrics') }">
              <th scope="row">{{ key }}</th>
              <td v-for="r in runs" :key="r.run_id" class="mf-num" :class="{ 'mf-cmp__best': isBest(key, r) }">{{ num(r.metrics[key]) }}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import LineChart from './LineChart.vue';
import ParallelCoords from './ParallelCoords.vue';
import { useMf } from './mfContext';
import { fullTime, num, runColor, type MfRun } from './mlflow';

const mf = useMf();
const ids = computed(() => (mf.route.value.page === 'compare' ? mf.route.value.runIds : []));
const runs = computed(() => ids.value.map(id => mf.findRun(id)).filter((r): r is MfRun => Boolean(r)));
const expNames = computed(() => [...new Set(runs.value.map(r => mf.experiment(r.experiment_id)?.name || 'Default'))]);
function backToExp() { mf.go({ page: 'experiments', expId: runs.value[0]?.experiment_id || '0', mode: 'table' }); }
function openRun(id: string) {
  const r = mf.findRun(id);
  if (r) mf.go({ page: 'run', expId: r.experiment_id, runId: r.run_id, tab: 'overview' });
}

const vizTabs = ['Parallel Coordinates Plot', 'Scatter Plot', 'Metric History'] as const;
const viz = ref<typeof vizTabs[number]>('Parallel Coordinates Plot');
const paramKeys = computed(() => [...new Set(runs.value.flatMap(r => Object.keys(r.params)))].sort());
const metricKeys = computed(() => [...new Set(runs.value.flatMap(r => Object.keys(r.metrics)))].sort());
const historyKeys = computed(() => [...new Set(runs.value.flatMap(r => Object.keys(r.history)))].sort());
const diffParams = computed(() => paramKeys.value.filter(k => differs(k, 'params')));
const pcParams = ref<string[]>([]);
const pcMetrics = ref<string[]>([]);
// The real page pre-selects the parameters that differ and the first metric.
pcParams.value = diffParams.value.slice(0, 4);
pcMetrics.value = metricKeys.value.includes('val_metric') ? ['val_metric'] : metricKeys.value.slice(0, 1);
const pcRows = computed(() => runs.value.map(r => ({ id: r.run_id, color: runColor(r.run_id), values: { ...r.params, ...r.metrics } as Record<string, string | number> })));

const axisKeys = computed(() => [...paramKeys.value.map(k => 'params.' + k), ...metricKeys.value.map(k => 'metrics.' + k)]);
const sx = ref(axisKeys.value.find(k => k === 'params.lr') || axisKeys.value[0] || '');
const sy = ref(axisKeys.value.find(k => k === 'metrics.val_metric') || axisKeys.value[1] || '');
function valueOf(r: MfRun, key: string): number {
  const [kind, ...rest] = key.split('.');
  const name = rest.join('.');
  return Number(kind === 'params' ? r.params[name] : r.metrics[name]);
}
const scatterSeries = computed(() => runs.value
  .map(r => ({ name: r.run_name, color: runColor(r.run_id), points: [[valueOf(r, sx.value), valueOf(r, sy.value)]] as [number, number][] }))
  .filter(s => s.points.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))));

const diffOnly = ref(false);
function differs(key: string, kind: 'params' | 'metrics') {
  const vals = runs.value.map(r => String((r as any)[kind][key] ?? ''));
  return new Set(vals).size > 1;
}
const shownParams = computed(() => (diffOnly.value ? diffParams.value : paramKeys.value));
const shownMetrics = computed(() => (diffOnly.value ? metricKeys.value.filter(k => differs(k, 'metrics')) : metricKeys.value));
function isBest(key: string, r: MfRun) {
  const vals = runs.value.map(x => x.metrics[key]).filter(v => typeof v === 'number');
  if (vals.length < 2 || typeof r.metrics[key] !== 'number') return false;
  const lowerBetter = /loss|error|rmse|mae/i.test(key);
  return r.metrics[key] === (lowerBetter ? Math.min(...vals) : Math.max(...vals));
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-cmp { flex: 1; overflow: auto; gap: 16px; }
.mf-cmp__grid th { position: static; text-align: left; width: 180px; background: var(--mf-bg-2); color: var(--mf-text); border-bottom: 1px solid var(--mf-border-light); }
.mf-cmp__grid td { min-width: 150px; }
.mf-cmp__diff th { background: #FFF8E6; }
.mf-cmp__best { font-weight: 700; color: var(--mf-success); }
.mf-cmp__viz { display: flex; flex-direction: column; gap: 10px; }
.mf-cmp__pickers { display: flex; gap: 16px; flex-wrap: wrap; }
.mf-cmp__pick { border: 1px solid var(--mf-border-light); border-radius: var(--mf-radius); padding: 6px 10px 8px; margin: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; max-width: 520px; }
.mf-cmp__pick legend { padding: 0 4px; }
.mf-cmp__opt { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.mf-cmp__plot { max-width: 980px; overflow-x: auto; border: 1px solid var(--mf-border-light); border-radius: var(--mf-radius); padding: 8px; }
.mf-cmp__scatter { max-width: 560px; }
.mf-cmp__charts { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 12px; }
@container sl-portal (max-width: 900px) { .mf-cmp { padding: 12px; } }
</style>
