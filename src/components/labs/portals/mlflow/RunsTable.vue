<template>
  <div class="mf-runs">
    <div class="mf-runs__tools">
      <span class="mf-muted">Showing {{ runs.length }} matching run{{ runs.length === 1 ? '' : 's' }}</span>
      <span class="mf-spacer"></span>
      <span class="mf-menu-anchor">
        <button type="button" class="mf-btn mf-btn--sm" :aria-expanded="colsOpen" @click="colsOpen = !colsOpen">
          <MfIcon name="columns" />Columns
        </button>
        <div v-if="colsOpen" class="mf-menu mf-runs__cols" @mouseleave="colsOpen = false">
          <label v-for="col in toggleable" :key="col" class="mf-runs__colopt">
            <input type="checkbox" class="mf-check" :checked="!hidden.has(col)" @change="toggle(col)" />{{ col }}
          </label>
        </div>
      </span>
    </div>
    <div v-if="!runs.length" class="mf-empty">
      <MfIcon name="table" />
      <h3>{{ deleted ? 'No deleted runs' : 'No runs logged' }}</h3>
      <p v-if="!deleted">Runs land here when they are logged to this experiment - in this lab,
        <code class="mf-mono">mlx train</code> and <code class="mf-mono">mlx finetune</code> log one each.
        Change the search or the filters if you expected some.</p>
    </div>
    <div v-else class="mf-table-wrap mf-runs__wrap">
      <table class="mf-table mf-runs__table">
        <thead>
          <tr class="mf-runs__groups">
            <th :colspan="baseCols" class="mf-runs__g0"></th>
            <th v-if="metricCols.length" :colspan="metricCols.length" class="mf-runs__g">Metrics</th>
            <th v-if="paramCols.length" :colspan="paramCols.length" class="mf-runs__g">Parameters</th>
          </tr>
          <tr>
            <th class="mf-runs__chk"><input type="checkbox" class="mf-check" :checked="allChecked" aria-label="Select all runs" @change="toggleAll" /></th>
            <th class="mf-runs__name">Run Name</th>
            <th v-if="show('Created')">Created</th>
            <th v-if="show('Dataset')">Dataset</th>
            <th v-if="show('Duration')">Duration</th>
            <th v-if="show('Source')">Source</th>
            <th v-if="show('Models')">Models</th>
            <th v-for="m in metricCols" :key="'m' + m" class="mf-num">{{ m }}</th>
            <th v-for="p in paramCols" :key="'p' + p">{{ p }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.run_id" :class="{ 'is-selected': selected.includes(run.run_id) }">
            <td class="mf-runs__chk"><input type="checkbox" class="mf-check" :checked="selected.includes(run.run_id)"
                                            :aria-label="'Select ' + run.run_name" @change="toggleRun(run.run_id)" /></td>
            <td class="mf-runs__name">
              <span class="mf-dot" :style="{ background: runColor(run.run_id) }"></span>
              <button type="button" class="mf-link mf-runs__runlink" :title="run.run_name" @click="open(run)">{{ run.run_name }}</button>
            </td>
            <td v-if="show('Created')" class="mf-runs__nowrap">
              <span class="mf-status" :class="'mf-status--' + run.status" :title="run.status">
                <MfIcon :name="run.status === 'FINISHED' ? 'check-circle' : run.status === 'FAILED' ? 'x-circle' : 'clock'" />
                <span>{{ timeAgo(run.start_time, mf.now.value) }}</span>
              </span>
            </td>
            <td v-if="show('Dataset')" class="mf-runs__nowrap">
              <span v-if="run.dataset" class="mf-tag" :title="run.dataset.name + ' (' + run.dataset.digest + ')'">
                <MfIcon name="dataset" />{{ run.dataset.name }} ({{ run.dataset.digest }})
              </span>
              <span v-else class="mf-muted">-</span>
            </td>
            <td v-if="show('Duration')" class="mf-runs__nowrap">{{ duration(run.duration_s) }}</td>
            <td v-if="show('Source')" class="mf-runs__nowrap"><MfIcon name="laptop" class="mf-muted" /> {{ run.source }}</td>
            <td v-if="show('Models')" class="mf-runs__nowrap">
              <template v-if="run.registered.length">
                <button v-for="reg in run.registered" :key="reg.name + reg.version" type="button" class="mf-link mf-runs__model"
                        @click="mf.go({ page: 'version', name: reg.name, version: reg.version })">
                  <MfIcon name="model" />{{ reg.name }} v{{ reg.version }}
                </button>
              </template>
              <span v-else-if="run.logged_model" class="mf-runs__model mf-muted"><MfIcon name="model" />{{ run.flavor }}</span>
              <span v-else class="mf-muted">-</span>
            </td>
            <td v-for="m in metricCols" :key="'m' + m" class="mf-num">{{ num(run.metrics[m]) }}</td>
            <td v-for="p in paramCols" :key="'p' + p" class="mf-runs__nowrap mf-runs__param" :title="run.params[p]">{{ run.params[p] ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import { useMf } from './mfContext';
import { duration, num, runColor, timeAgo, type MfRun } from './mlflow';

const props = defineProps<{ runs: MfRun[]; selected: string[]; deleted?: boolean }>();
const emit = defineEmits<{ (event: 'update:selected', value: string[]): void }>();
const mf = useMf();

const ATTRS = ['Created', 'Dataset', 'Duration', 'Source', 'Models'];
const hidden = ref(new Set<string>());
const colsOpen = ref(false);
const allMetrics = computed(() => [...new Set(props.runs.flatMap(r => Object.keys(r.metrics)))].sort());
const allParams = computed(() => [...new Set(props.runs.flatMap(r => Object.keys(r.params)))].sort());
const toggleable = computed(() => [...ATTRS, ...allMetrics.value.map(m => 'metrics.' + m), ...allParams.value.map(p => 'params.' + p)]);
const metricCols = computed(() => allMetrics.value.filter(m => !hidden.value.has('metrics.' + m)));
const paramCols = computed(() => allParams.value.filter(p => !hidden.value.has('params.' + p)));
const baseCols = computed(() => 2 + ATTRS.filter(a => !hidden.value.has(a)).length);
function show(col: string) { return !hidden.value.has(col); }
function toggle(col: string) {
  const next = new Set(hidden.value);
  if (next.has(col)) next.delete(col); else next.add(col);
  hidden.value = next;
}

const allChecked = computed(() => props.runs.length > 0 && props.runs.every(r => props.selected.includes(r.run_id)));
function toggleAll() {
  emit('update:selected', allChecked.value ? [] : props.runs.map(r => r.run_id));
}
function toggleRun(id: string) {
  emit('update:selected', props.selected.includes(id) ? props.selected.filter(x => x !== id) : [...props.selected, id]);
}
function open(run: MfRun) {
  mf.go({ page: 'run', expId: run.experiment_id, runId: run.run_id, tab: 'overview' });
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-runs { display: flex; flex-direction: column; gap: 6px; min-height: 0; flex: 1; }
.mf-runs__tools { display: flex; align-items: center; gap: 8px; }
.mf-runs__cols { right: 0; top: 28px; max-height: 280px; overflow: auto; }
.mf-runs__colopt { display: flex; align-items: center; gap: 8px; padding: 4px 12px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.mf-runs__colopt:hover { background: var(--mf-row-hover); }
.mf-runs__wrap { flex: 1; min-height: 0; }
.mf-runs__table th, .mf-runs__table td { white-space: nowrap; }
.mf-runs__groups th { top: 0; height: 26px; padding-top: 2px; padding-bottom: 2px; font-size: 12px; border-bottom: 1px solid var(--mf-border-light); }
.mf-runs__table thead tr:nth-child(2) th { top: 26px; }
.mf-runs__g { text-align: center !important; color: var(--mf-text) !important; border-left: 1px solid var(--mf-border-light); }
.mf-runs__chk { width: 32px; padding-right: 0 !important; }
.mf-runs__name { min-width: 180px; }
.mf-runs__name .mf-dot { margin-right: 8px; vertical-align: -1px; }
.mf-runs__runlink { font-weight: 600; max-width: 220px; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle; }
.mf-runs__model { display: inline-flex; align-items: center; gap: 4px; margin-right: 8px; }
.mf-runs__param { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.mf-runs__nowrap { white-space: nowrap; }
</style>
