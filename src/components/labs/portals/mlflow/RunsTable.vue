<template>
  <div class="mf-runs">
    <div class="mf-runs__tools">
      <span class="mf-muted">Showing {{ runs.length }} matching run{{ runs.length === 1 ? '' : 's' }}</span>
      <span v-if="hidden.size" class="mf-muted mf-runs__hiddeninfo">· {{ hidden.size }} column{{ hidden.size === 1 ? '' : 's' }} hidden</span>
      <span class="mf-spacer"></span>
      <span class="mf-menu-anchor">
        <button type="button" class="mf-btn mf-btn--sm" :aria-expanded="colsOpen" @click="colsOpen = !colsOpen">
          <MfIcon name="columns" />Columns
        </button>
        <div v-if="colsOpen" class="mf-menu mf-runs__cols" @mouseleave="colsOpen = false" @keydown.escape="colsOpen = false">
          <div class="mf-search mf-runs__colsearch"><MfIcon name="search" />
            <input v-model="colQuery" class="mf-input" type="search" placeholder="Search columns" aria-label="Search columns" /></div>
          <div class="mf-runs__colall">
            <button type="button" class="mf-btn mf-btn--link mf-btn--sm" @click="setAll(true)">Show all</button>
            <button type="button" class="mf-btn mf-btn--link mf-btn--sm" @click="setAll(false)">Hide all</button>
          </div>
          <label v-for="col in colChoices" :key="col" class="mf-runs__colopt">
            <input type="checkbox" class="mf-check" :checked="!hidden.has(col)" @change="toggle(col)" />{{ col }}
          </label>
          <span v-if="!colChoices.length" class="mf-runs__colnone">No columns match</span>
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
            <th class="mf-runs__g0"></th>
          </tr>
          <tr>
            <th class="mf-runs__chk"><input type="checkbox" class="mf-check" :checked="allChecked" aria-label="Select all runs" @change="toggleAll" /></th>
            <th class="mf-runs__name mf-runs__sortable" :aria-sort="ariaSort('run_name')" @click="sortBy('run_name')">
              Run Name<span v-if="dirOf('run_name')" class="mf-runs__sortmark" aria-hidden="true">{{ arrow('run_name') }}</span></th>
            <th v-if="show('Created')" class="mf-runs__sortable" :aria-sort="ariaSort('created')" @click="sortBy('created')">
              Created<span v-if="dirOf('created')" class="mf-runs__sortmark" aria-hidden="true">{{ arrow('created') }}</span></th>
            <th v-if="show('Dataset')">Dataset</th>
            <th v-if="show('Duration')" class="mf-runs__sortable" :aria-sort="ariaSort('duration')" @click="sortBy('duration')">
              Duration<span v-if="dirOf('duration')" class="mf-runs__sortmark" aria-hidden="true">{{ arrow('duration') }}</span></th>
            <th v-if="show('Source')">Source</th>
            <th v-if="show('Models')">Models</th>
            <th v-for="m in metricCols" :key="'m' + m" class="mf-num mf-runs__sortable" :aria-sort="ariaSort('metric:' + m)"
                @click="sortBy('metric:' + m)" @contextmenu="colMenu($event, 'metrics.' + m, 'metric:' + m)">
              {{ m }}<span v-if="dirOf('metric:' + m)" class="mf-runs__sortmark" aria-hidden="true">{{ arrow('metric:' + m) }}</span></th>
            <th v-for="p in paramCols" :key="'p' + p" class="mf-runs__sortable" :aria-sort="ariaSort('param:' + p)"
                @click="sortBy('param:' + p)" @contextmenu="colMenu($event, 'params.' + p, 'param:' + p)">
              {{ p }}<span v-if="dirOf('param:' + p)" class="mf-runs__sortmark" aria-hidden="true">{{ arrow('param:' + p) }}</span></th>
            <th class="mf-runs__kebabcol"><span class="mf-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.run_id" :class="{ 'is-selected': selected.includes(run.run_id) }"
              @contextmenu="rowMenu($event, run)">
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
            <td class="mf-runs__kebabcol">
              <button type="button" class="mf-runs__kebab" :aria-label="'Actions for ' + run.run_name" title="More actions"
                      @click.stop="rowMenu($event, run)"><MfIcon name="kebab" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The runs table: sortable headers (click to sort, click again to flip;
 * right-click a metric or parameter header for its column menu), a column
 * chooser with search, and the row menu MLflow opens from "⋮" or a
 * right-click. The table decides nothing about writes - every row action is
 * emitted to the experiment page, which runs the `mlflow ...` command.
 */
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import { useMf, type MenuItem } from './mfContext';
import { duration, num, runColor, timeAgo, type MfRun, type RunAction, type RunsSort } from './mlflow';

const props = defineProps<{ runs: MfRun[]; selected: string[]; deleted?: boolean; sort: RunsSort }>();
const emit = defineEmits<{
  (event: 'update:selected', value: string[]): void;
  (event: 'update:sort', value: RunsSort): void;
  (event: 'action', kind: RunAction, run: MfRun): void;
}>();
const mf = useMf();

const ATTRS = ['Created', 'Dataset', 'Duration', 'Source', 'Models'];
const hidden = ref(new Set<string>());
const colsOpen = ref(false);
const colQuery = ref('');
const allMetrics = computed(() => [...new Set(props.runs.flatMap(r => Object.keys(r.metrics)))].sort());
const allParams = computed(() => [...new Set(props.runs.flatMap(r => Object.keys(r.params)))].sort());
const toggleable = computed(() => [...ATTRS, ...allMetrics.value.map(m => 'metrics.' + m), ...allParams.value.map(p => 'params.' + p)]);
const colChoices = computed(() => {
  const q = colQuery.value.trim().toLowerCase();
  return toggleable.value.filter(col => !q || col.toLowerCase().includes(q));
});
const metricCols = computed(() => allMetrics.value.filter(m => !hidden.value.has('metrics.' + m)));
const paramCols = computed(() => allParams.value.filter(p => !hidden.value.has('params.' + p)));
const baseCols = computed(() => 2 + ATTRS.filter(a => !hidden.value.has(a)).length);
function show(col: string) { return !hidden.value.has(col); }
function toggle(col: string) {
  const next = new Set(hidden.value);
  if (next.has(col)) next.delete(col); else next.add(col);
  hidden.value = next;
}
function setAll(visible: boolean) {
  // Only the columns the search shows, as MLflow's column selector does.
  const next = new Set(hidden.value);
  for (const col of colChoices.value) { if (visible) next.delete(col); else next.add(col); }
  hidden.value = next;
}

function dirOf(key: string) { return props.sort.key === key ? props.sort.dir : ''; }
function arrow(key: string) { return dirOf(key) === 'asc' ? ' ↑' : ' ↓'; }
function ariaSort(key: string) {
  return props.sort.key === key ? (props.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
}
function sortBy(key: string) {
  // First click: the column's natural order (names A-Z, times and numbers newest/highest first); again flips it.
  const natural: RunsSort['dir'] = key === 'run_name' || key.startsWith('param:') ? 'asc' : 'desc';
  emit('update:sort', props.sort.key === key ? { key, dir: props.sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: natural });
}
function colMenu(event: MouseEvent, column: string, key: string) {
  mf.menu(event, [
    { label: 'Sort ascending', icon: 'chevron-down', action: () => emit('update:sort', { key, dir: 'asc' }) },
    { label: 'Sort descending', icon: 'chevron-down', action: () => emit('update:sort', { key, dir: 'desc' }) },
    { divider: true },
    { label: 'Hide column', icon: 'eye-off', action: () => toggle(column) },
  ], column);
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

function rowMenu(event: MouseEvent, run: MfRun) {
  const deletedRun = run.lifecycle_stage === 'deleted';
  const others = props.selected.filter(id => id !== run.run_id);
  const items: MenuItem[] = [
    { label: 'Open run', icon: 'chevron-right', action: () => open(run) },
    { label: props.selected.includes(run.run_id) ? 'Deselect' : 'Select', icon: 'table', action: () => toggleRun(run.run_id) },
    { label: others.length ? `Compare with ${others.length} selected` : 'Compare (select another run first)', icon: 'chart',
      disabled: !others.length, action: () => emit('action', 'compare', run) },
    { divider: true },
    { label: 'Rename', icon: 'pencil', disabled: deletedRun, action: () => emit('action', 'rename', run) },
    { label: 'Edit description', icon: 'pencil', disabled: deletedRun, action: () => emit('action', 'description', run) },
    { label: 'Register model', icon: 'model', disabled: deletedRun || !run.logged_model,
      title: run.logged_model ? '' : 'This run did not log a model', action: () => emit('action', 'register', run) },
    { label: 'Copy run ID', icon: 'copy', action: () => mf.copy(run.run_id, 'run ID') },
    { label: 'Copy model URI', icon: 'copy', disabled: !run.logged_model, action: () => mf.copy(`runs:/${run.run_id}/model`, 'model URI') },
    { divider: true },
    deletedRun
      ? { label: 'Restore', icon: 'restore', action: () => emit('action', 'restore', run) }
      : { label: 'Delete', icon: 'trash', danger: true, action: () => emit('action', 'delete', run) },
  ];
  mf.menu(event, items, run.run_name);
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-runs { display: flex; flex-direction: column; gap: 6px; min-height: 0; flex: 1; }
.mf-runs__tools { display: flex; align-items: center; gap: 8px; }
.mf-runs__cols { right: 0; top: 28px; max-height: 320px; overflow: auto; width: 260px; }
.mf-runs__colopt { display: flex; align-items: center; gap: 8px; padding: 4px 12px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.mf-runs__colopt:hover { background: var(--mf-row-hover); }
.mf-runs__colsearch { margin: 4px 8px; }
.mf-runs__colall { display: flex; gap: 4px; padding: 0 6px 4px; border-bottom: 1px solid var(--mf-border-light); margin-bottom: 4px; }
.mf-runs__colnone { padding: 4px 12px; color: var(--mf-text-2); }
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
.mf-runs__sortable { cursor: pointer; user-select: none; }
.mf-runs__sortable:hover { color: var(--mf-text) !important; background: var(--mf-row-hover) !important; }
.mf-runs__sortmark { color: var(--mf-link); font-weight: 700; }
.mf-runs__kebabcol { width: 36px; padding-left: 0 !important; padding-right: 4px !important; text-align: right; }
.mf-runs__kebab { border: 0; background: none; color: var(--mf-text-2); width: 28px; height: 28px; border-radius: var(--mf-radius);
  cursor: pointer; display: inline-grid; place-items: center; opacity: 0; }
tr:hover .mf-runs__kebab, tr.is-selected .mf-runs__kebab, .mf-runs__kebab:focus-visible { opacity: 1; }
.mf-runs__kebab:hover { background: var(--mf-border-light); color: var(--mf-text); }
.mf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@container sl-portal (max-width: 700px) {
  .mf-runs__kebab { opacity: 1; }
  .mf-runs__hiddeninfo { display: none; }
}
</style>
