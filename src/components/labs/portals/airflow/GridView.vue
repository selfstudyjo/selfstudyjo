<template>
  <div class="af-grid">
    <div v-if="!runs.length && !tasks.length" class="af-empty"><strong>No tasks</strong><span>This DAG has no tasks yet.</span></div>
    <div v-else class="af-grid__scroll">
      <table class="af-grid__table" role="grid" aria-label="DAG runs and task instances">
        <thead>
          <tr class="af-grid__bars">
            <th class="af-grid__corner">
              <span class="af-grid__legend-title">{{ runs.length }} run{{ runs.length === 1 ? '' : 's' }}</span>
              <span class="af-grid__dur">Duration<br />{{ fmtDuration(maxDur) }}</span>
            </th>
            <th v-for="run in runs" :key="run.run_id" class="af-grid__bar-col" :class="{ 'is-sel': run.run_id === runId }">
              <button type="button" class="af-grid__bar-btn" :title="runTitle(run)" :aria-label="'Select run ' + run.run_id"
                      @click="$emit('select', run.run_id)" @contextmenu="af.openMenu($event, 'DAG run ' + run.run_id, runMenu(af, dag, run))">
                <span class="af-grid__bar" :style="{ height: barHeight(run) + 'px', background: stateColor(run.state), borderColor: normState(run.state) === 'none' ? '#ccc' : stateColor(run.state) }"></span>
                <span v-if="run.run_type === 'manual'" class="af-grid__manual" aria-hidden="true">▶</span>
                <span v-else-if="run.run_type === 'backfill'" class="af-grid__manual" aria-hidden="true">⇤</span>
              </button>
            </th>
          </tr>
          <tr class="af-grid__dates">
            <th></th>
            <th v-for="(run, i) in runs" :key="'d' + run.run_id" class="af-grid__date-col">
              <span v-if="i % 5 === 0" class="af-grid__date">{{ shortDate(run.logical_date) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in tasks" :key="task.task_id" :class="{ 'is-sel': task.task_id === taskId }">
            <th class="af-grid__task" scope="row">
              <button type="button" class="af-grid__task-btn" :title="`${task.task_id} (${task.operator})`"
                      @click="$emit('select', runId || runs[runs.length - 1]?.run_id || '', task.task_id)"
                      @contextmenu="taskMenu($event, task.task_id)">
                <span class="af-grid__task-name">{{ task.task_id }}</span><span v-if="task.mapped" class="af-grid__mapped"> [ ]</span>
              </button>
            </th>
            <td v-for="run in runs" :key="run.run_id + task.task_id" class="af-grid__cell" :class="{ 'is-col': run.run_id === runId }">
              <button type="button" class="af-grid__sq"
                      :class="{ 'is-sel': run.run_id === runId && task.task_id === taskId, 'is-none': normState(cell(run.run_id, task.task_id)?.state) === 'none' }"
                      :style="{ background: normState(cell(run.run_id, task.task_id)?.state) === 'none' ? '#fff' : stateColor(cell(run.run_id, task.task_id)?.state) }"
                      :title="cellTitle(run.run_id, task.task_id)" :aria-label="cellTitle(run.run_id, task.task_id)"
                      @click="$emit('select', run.run_id, task.task_id)"
                      @contextmenu="af.openMenu($event, task.task_id, tiMenu(af, dag, run, task.task_id))"></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="af-grid__legend" aria-label="Task states">
      <span v-for="s in LEGEND" :key="s" class="af-state" :title="s"><i :style="{ background: s === 'no_status' ? '#fff' : stateColor(s) }"></i>{{ s }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAf } from './afContext';
import { runMenu, tiMenu } from './tiActions';
import { fmtDate, fmtDuration, normState, secondsBetween, stateColor, stateLabel, topoOrder, type AfDag, type AfRun } from './airflow';

const props = defineProps<{ dag: AfDag; runs: AfRun[]; runId: string; taskId: string }>();
defineEmits<{ (event: 'select', runId: string, taskId?: string): void }>();
const af = useAf();

const LEGEND = ['deferred', 'failed', 'queued', 'removed', 'restarting', 'running', 'scheduled', 'skipped', 'success',
  'up_for_reschedule', 'up_for_retry', 'upstream_failed', 'no_status'];

const tasks = computed(() => topoOrder(props.dag.tasks));
const cells = computed(() => {
  const map = new Map<string, any>();
  for (const t of af.tisOf(props.dag.dag_id)) map.set(t.run_id + '\u0000' + t.task_id, t);
  return map;
});
function cell(runId: string, taskId: string) { return cells.value.get(runId + '\u0000' + taskId); }

function taskMenu(event: MouseEvent, taskId: string) {
  const run = props.runs.find(r => r.run_id === props.runId) || props.runs[props.runs.length - 1];
  af.openMenu(event, taskId, tiMenu(af, props.dag, run, taskId));
}

function runDur(run: AfRun) {
  return secondsBetween(run.start, run.end) ?? (normState(run.state) === 'running' ? secondsBetween(run.start, af.airflowView.value?.now || run.start) : null) ?? 0;
}
const maxDur = computed(() => Math.max(0, ...props.runs.map(runDur)));
function barHeight(run: AfRun) {
  const max = maxDur.value || 1;
  return Math.max(6, Math.round((runDur(run) / max) * 52));
}
function shortDate(value: unknown) {
  const m = String(value || '').match(/^\d{4}-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/);
  if (!m) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(m[1]) - 1] || m[1]} ${m[2]}, ${m[3]}`;
}
function runTitle(run: AfRun) {
  return [`Run: ${run.run_id}`, `Status: ${normState(run.state)}`, `Run type: ${run.run_type}`, `Logical date: ${fmtDate(run.logical_date)}`,
    `Duration: ${fmtDuration(runDur(run))}`].join('\n');
}
function cellTitle(runId: string, taskId: string) {
  const t = cell(runId, taskId);
  if (!t) return `${taskId}\nStatus: no_status`;
  return [`Task: ${taskId}`, `Status: ${stateLabel(t.state)}`, `Try number: ${t.try_number || 0}`,
    t.start ? `Started: ${fmtDate(t.start)}` : '', t.duration_s != null ? `Duration: ${fmtDuration(t.duration_s)}` : ''].filter(Boolean).join('\n');
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-grid { display: flex; flex-direction: column; min-height: 0; border: 1px solid var(--af-border-light); border-radius: 4px; background: #fff; overflow: hidden; }
.af-grid__scroll { flex: 1; min-height: 0; overflow: auto; }
.af-grid__table { border-collapse: separate; border-spacing: 0; }
.af-grid__table th, .af-grid__table td { padding: 0; }
.af-grid__corner { position: sticky; left: 0; z-index: 3; background: #fff; text-align: left; vertical-align: bottom; padding: 4px 8px !important; min-width: 170px; }
.af-grid__legend-title { display: block; font-size: 12px; color: var(--af-text-2); font-weight: 400; }
.af-grid__dur { display: block; font-size: 11px; color: #6b6b6b; font-weight: 400; line-height: 13px; }
.af-grid__bars th { position: sticky; top: 0; z-index: 2; background: #fff; height: 64px; vertical-align: bottom; }
.af-grid__bar-col { width: 22px; min-width: 22px; }
.af-grid__bar-col.is-sel { background: #e6f1fd !important; }
.af-grid__bar-btn { position: relative; display: flex; align-items: flex-end; justify-content: center; width: 22px; height: 62px; border: 0; background: none; padding: 0; cursor: pointer; }
.af-grid__bar { display: block; width: 10px; border-radius: 2px; border: 1px solid; box-sizing: border-box; }
.af-grid__bar-btn:hover .af-grid__bar { filter: brightness(1.15); width: 12px; }
.af-grid__manual { position: absolute; top: 0; left: 50%; transform: translateX(-50%); font-size: 8px; color: #777; line-height: 8px; }
.af-grid__dates th { position: relative; height: 58px; border-bottom: 1px solid var(--af-border-light); background: #fff; }
.af-grid__dates th:first-child { position: sticky; left: 0; z-index: 2; }
.af-grid__date { position: absolute; left: 10px; bottom: 4px; transform: rotate(-60deg); transform-origin: left bottom; font-size: 10px; color: #6b6b6b; font-weight: 400; white-space: nowrap; }
.af-grid__task { position: sticky; left: 0; z-index: 1; background: #fff; text-align: left; font-weight: 400; border-right: 1px solid var(--af-border-light); }
.af-grid__task-btn { display: flex; align-items: center; width: 100%; max-width: 230px; height: 22px; border: 0; background: none; padding: 0 8px; font: inherit; font-size: 13px; color: var(--af-text-strong); cursor: pointer; text-align: left; }
.af-grid__task-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-grid__mapped { color: #999; font-size: 12px; }
.af-grid__task-btn:hover .af-grid__task-name { color: var(--af-link); text-decoration: underline; }
tr.is-sel .af-grid__task, tr.is-sel td { background: #e6f1fd; }
tbody tr:hover td, tbody tr:hover .af-grid__task { background: #f3f8fe; }
.af-grid__cell { width: 22px; text-align: center; }
.af-grid__cell.is-col { background: #e6f1fd; }
.af-grid__sq { display: block; margin: 3px auto; width: 16px; height: 16px; border-radius: 2px; border: 1px solid rgba(0, 0, 0, .12); padding: 0; cursor: pointer; }
.af-grid__sq.is-none { border-color: #c4c4c4; }
.af-grid__sq:hover { transform: scale(1.15); }
.af-grid__sq.is-sel { outline: 2px solid var(--af-primary); outline-offset: 1px; }
.af-grid__legend { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 6px 8px; border-top: 1px solid var(--af-border-light); font-size: 11px; color: var(--af-text-2); }
.af-grid__legend .af-state i { width: 10px; height: 10px; }
</style>
