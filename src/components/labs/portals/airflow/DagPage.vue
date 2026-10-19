<template>
  <div v-if="!dag" class="af-page">
    <div class="af-alert af-alert--error">
      <div class="af-alert__body">DAG "{{ dagId }}" seems to be missing from DagBag.</div>
    </div>
    <div><button type="button" class="af-btn" @click="af.go({ page: 'home' })">Back to DAGs</button></div>
  </div>
  <div v-else class="af-dag">
    <!-- ===== DAG header: breadcrumbs, pause switch, schedule, next run, actions ===== -->
    <div class="af-dag__head">
      <div class="af-dag__crumbs">
        <button type="button" class="af-link" @click="af.go({ page: 'home' })">DAGs</button>
        <span class="af-dag__sep">/</span>
        <span class="af-dag__crumb-label">DAG</span>
        <button type="button" class="af-switch" :class="{ 'is-on': !dag.paused }" role="switch" :aria-checked="!dag.paused"
                :aria-label="'Pause/Unpause DAG ' + dag.dag_id" :title="dag.paused ? 'DAG is Paused' : 'DAG is Active'"
                :disabled="af.busy.value" @click="togglePause(af, dag)"></button>
        <h2 class="af-dag__title" :title="dag.description || dag.dag_id">{{ dag.dag_id }}</h2>
        <template v-if="selectedRun">
          <span class="af-dag__sep">/</span>
          <span class="af-dag__crumb-label">Run</span>
          <button type="button" class="af-link af-dag__crumb" @click="select(selectedRun.run_id)">{{ fmtDate(selectedRun.logical_date, false) }}</button>
        </template>
        <template v-if="taskId">
          <span class="af-dag__sep">/</span>
          <span class="af-dag__crumb-label">Task</span>
          <span class="af-dag__crumb af-dag__crumb--task">{{ taskId }}</span>
        </template>
      </div>
      <div class="af-dag__meta">
        <span class="af-dag__tags">
          <button v-for="t in dag.tags" :key="t" type="button" class="af-tag" @click="af.go({ page: 'home' })">{{ t }}</button>
        </span>
        <span class="af-pill" :title="'Schedule interval'">Schedule: {{ scheduleLabel(dag.schedule) }}</span>
        <span v-if="dag.next_run" class="af-dag__next" :class="{ 'af-muted': dag.paused }">Next Run: {{ fmtDate(dag.next_run) }}</span>
        <span class="af-spacer"></span>
        <span class="af-menu-anchor">
          <button type="button" class="af-btn af-btn--sm af-btn--primary" :aria-expanded="trigMenu" @click.stop="trigMenu = !trigMenu">
            <AfIcon name="play" /> Trigger <AfIcon name="caret" /></button>
          <div v-if="trigMenu" class="af-menu af-dag__menu" role="menu">
            <button type="button" role="menuitem" @click="trigMenu = false; triggerNow(af, dag.dag_id)">Trigger DAG</button>
            <button type="button" role="menuitem" @click="trigMenu = false; triggering = true">Trigger DAG w/ config</button>
            <hr />
            <div class="af-menu__head">Not in the 2.9 UI</div>
            <button type="button" role="menuitem" @click="trigMenu = false; backfilling = true"><AfIcon name="terminal" /> Backfill (CLI)…</button>
            <button type="button" role="menuitem" @click="trigMenu = false; testing = true"><AfIcon name="terminal" /> Test DAG (CLI)…</button>
          </div>
        </span>
        <button type="button" class="af-btn af-btn--sm af-btn--icon" :title="'Delete DAG ' + dag.dag_id" aria-label="Delete DAG"
                @click="onDelete"><AfIcon name="trash" /></button>
        <button type="button" class="af-btn af-btn--sm af-btn--icon" title="Refresh" aria-label="Refresh" :disabled="af.busy.value"
                @click="af.refresh()"><AfIcon name="refresh" /></button>
      </div>
      <div v-if="importError" class="af-alert af-alert--error af-dag__broken">
        <div class="af-alert__body"><strong>Broken DAG: [{{ importError.file }}]</strong>
          <pre class="af-dag__errtext">{{ importError.error }}</pre></div>
      </div>
    </div>

    <!-- ===== Filters over the Grid ===== -->
    <div class="af-dag__filters">
      <label class="af-dag__filter"><span>Number of runs</span>
        <select v-model.number="numRuns" class="af-select" aria-label="Number of runs">
          <option v-for="n in [5, 10, 25, 50, 100]" :key="n" :value="n">{{ n }}</option>
        </select></label>
      <label class="af-dag__filter"><span>Run type</span>
        <select v-model="runType" class="af-select" aria-label="Run type">
          <option value="">All Run Types</option>
          <option value="manual">manual</option>
          <option value="scheduled">scheduled</option>
          <option value="backfill">backfill</option>
          <option value="dataset_triggered">dataset_triggered</option>
        </select></label>
      <label class="af-dag__filter"><span>Run state</span>
        <select v-model="runState" class="af-select" aria-label="Run state">
          <option value="">All Run States</option>
          <option v-for="s in ['queued', 'running', 'success', 'failed']" :key="s" :value="s">{{ s }}</option>
        </select></label>
      <button type="button" class="af-btn af-btn--sm" :disabled="!runType && !runState && numRuns === 25" @click="runType = ''; runState = ''; numRuns = 25">Clear Filters</button>
      <span class="af-spacer"></span>
      <button v-if="selectedRun || taskId" type="button" class="af-btn af-btn--sm" @click="select()">Clear selection</button>
      <button type="button" class="af-btn af-btn--sm" @click="showPanel = !showPanel">{{ showPanel ? 'Hide' : 'Show' }} Details Panel</button>
    </div>

    <div class="af-dag__body" :class="{ 'no-panel': !showPanel }">
      <GridView class="af-dag__grid" :dag="dag" :runs="gridRuns" :run-id="runId" :task-id="taskId" @select="select" />

      <section v-if="showPanel" class="af-dag__panel">
        <nav class="af-tabs" aria-label="Details panel">
          <button v-for="t in tabs" :key="t.id" type="button" class="af-tab" :class="{ 'is-active': tab === t.id }" @click="setTab(t.id)">
            <AfIcon :name="t.icon" /> {{ t.label }}</button>
        </nav>
        <div class="af-dag__tab">
          <template v-if="tab === 'details'">
            <TaskInstancePanel v-if="taskId && selectedRun" :key="'ti-' + selectedRun.run_id + taskId" :dag="dag" :run="selectedRun" :task-id="taskId" @select="select" />
            <TaskSummary v-else-if="taskId" :dag="dag" :task-id="taskId" :runs="gridRuns" />
            <RunDetails v-else-if="selectedRun" :key="'run-' + selectedRun.run_id" :dag="dag" :run="selectedRun" />
            <DagDetails v-else :dag="dag" />
          </template>
          <GraphView v-else-if="tab === 'graph'" :dag="dag" :run="selectedRun || latestRun" :task-id="taskId"
                     @select-task="t => select(selectedRun?.run_id || latestRun?.run_id, t)" />
          <GanttView v-else-if="tab === 'gantt'" :dag="dag" :run="selectedRun || latestRun" :task-id="taskId"
                     @select-task="t => select(selectedRun?.run_id || latestRun?.run_id, t)" />
          <CodeView v-else-if="tab === 'code'" :dag="dag" />
          <CalendarView v-else-if="tab === 'calendar'" :dag="dag" @select-run="r => select(r)" />
          <TaskLogs v-else-if="tab === 'logs' && ti" :key="'log-' + ti.run_id + ti.task_id" :ti="ti" />
          <TaskXcom v-else-if="tab === 'xcom' && ti" :ti="ti" />
          <RenderedTemplate v-else-if="tab === 'rendered' && ti && selectedRun" :key="'rt-' + ti.run_id + ti.task_id" :dag="dag" :ti="ti" :run="selectedRun" />
          <div v-else class="af-empty"><strong>Select a task instance</strong><span>Click a square in the Grid to see its logs, XComs and rendered templates.</span></div>
        </div>
      </section>
    </div>

    <TriggerDialog v-if="triggering" :dag-id="dag.dag_id" @close="triggering = false" />
    <BackfillDialog v-if="backfilling" :dag="dag" @close="backfilling = false" />
    <AfModal v-if="testing" title="Test DAG (CLI)" ok-text="Run airflow dags test" :busy="af.busy.value" @close="testing = false" @ok="runTest">
      <div class="af-alert af-alert--info"><div class="af-alert__body">The 2.9 web UI has no Test button: <code>airflow dags test</code> runs one
        DAG run in-process, ignoring the scheduler, and is how a DAG is debugged before it is unpaused.</div></div>
      <label class="af-field"><span class="af-label">Logical date</span>
        <input v-model="testDate" class="af-input" placeholder="2026-11-01" aria-label="Logical date" /></label>
      <code class="af-dag__line">{{ CMD.testDag(dag.dag_id, testDate.trim() || today) }}</code>
    </AfModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AfIcon from './AfIcon.vue';
import AfModal from './AfModal.vue';
import GridView from './GridView.vue';
import GraphView from './GraphView.vue';
import GanttView from './GanttView.vue';
import CalendarView from './CalendarView.vue';
import CodeView from './CodeView.vue';
import DagDetails from './DagDetails.vue';
import RunDetails from './RunDetails.vue';
import TaskInstancePanel from './TaskInstancePanel.vue';
import TaskSummary from './TaskSummary.vue';
import TaskLogs from './TaskLogs.vue';
import TaskXcom from './TaskXcom.vue';
import RenderedTemplate from './RenderedTemplate.vue';
import TriggerDialog from './TriggerDialog.vue';
import BackfillDialog from './BackfillDialog.vue';
import { useAf } from './afContext';
import { CMD, dayOf, fmtDate, normState, scheduleLabel, type DagTab } from './airflow';
import { deleteDag, togglePause, triggerNow } from './dagActions';

const af = useAf();
const r = computed(() => (af.route.value.page === 'dag' ? af.route.value : null));
const dagId = computed(() => r.value?.dagId || '');
const runId = computed(() => r.value?.runId || '');
const taskId = computed(() => r.value?.taskId || '');
const tab = computed<DagTab>(() => r.value?.tab || 'details');
const dag = computed(() => af.dag(dagId.value));

const numRuns = ref(25);
const runType = ref('');
const runState = ref('');
const showPanel = ref(true);
const trigMenu = ref(false);
const triggering = ref(false);
const backfilling = ref(false);
const testing = ref(false);
const testDate = ref('');

function closeMenu() { trigMenu.value = false; }
onMounted(() => window.addEventListener('click', closeMenu));
onBeforeUnmount(() => window.removeEventListener('click', closeMenu));

const allRuns = computed(() => [...af.runsOf(dagId.value)].sort((a, b) => String(a.logical_date).localeCompare(String(b.logical_date))));
const gridRuns = computed(() => allRuns.value
  .filter(x => (!runType.value || x.run_type === runType.value) && (!runState.value || normState(x.state) === runState.value))
  .slice(-numRuns.value));
const latestRun = computed(() => allRuns.value[allRuns.value.length - 1]);
const selectedRun = computed(() => allRuns.value.find(x => x.run_id === runId.value));
const ti = computed(() => (selectedRun.value && taskId.value
  ? af.tis.value.find(t => t.dag_id === dagId.value && t.run_id === selectedRun.value?.run_id && t.task_id === taskId.value)
  : undefined));
const importError = computed(() => af.importErrors.value.find(e => dag.value && String(e.file).endsWith(String(dag.value.fileloc || '').split('/').pop() || '\u0000')));
const today = computed(() => dayOf(af.clock.value.replace(/^\w{3} /, '')) || dayOf(latestRun.value?.logical_date) || '2026-11-01');

const tabs = computed(() => {
  const list: { id: DagTab; label: string; icon: string }[] = [
    { id: 'details', label: 'Details', icon: 'details' },
    { id: 'graph', label: 'Graph', icon: 'graph' },
    { id: 'gantt', label: 'Gantt', icon: 'list' },
    { id: 'code', label: 'Code', icon: 'code' },
  ];
  if (!runId.value && !taskId.value) list.push({ id: 'calendar', label: 'Calendar', icon: 'calendar' });
  if (taskId.value && selectedRun.value) {
    list.push({ id: 'logs', label: 'Logs', icon: 'log' }, { id: 'rendered', label: 'Rendered Template', icon: 'code' }, { id: 'xcom', label: 'XCom', icon: 'list' });
  }
  return list;
});

watch(tabs, list => {
  if (!list.some(t => t.id === tab.value)) setTab('details');
});

function select(run?: string, task?: string) {
  const sameRun = (run || '') === runId.value;
  const sameTask = (task || '') === taskId.value;
  // Clicking the selected square again deselects it, as the Grid does.
  if (run && sameRun && sameTask) {
    af.go({ page: 'dag', dagId: dagId.value, tab: tab.value === 'logs' || tab.value === 'xcom' || tab.value === 'rendered' ? 'details' : tab.value });
    return;
  }
  af.go({ page: 'dag', dagId: dagId.value, tab: tab.value === 'calendar' ? 'details' : tab.value, runId: run || undefined, taskId: task || undefined });
}

function setTab(next: DagTab) {
  af.go({ page: 'dag', dagId: dagId.value, tab: next, runId: runId.value || undefined, taskId: taskId.value || undefined });
}

async function onDelete() {
  if (!dag.value) return;
  if (await deleteDag(af, dag.value.dag_id)) af.go({ page: 'home' });
}

async function runTest() {
  if (!dag.value) return;
  const result = await af.run(CMD.testDag(dag.value.dag_id, testDate.value.trim() || today.value), { success: `airflow dags test ${dag.value.dag_id} finished` });
  if (result.ok) testing.value = false;
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-dag { display: flex; flex-direction: column; min-height: 0; flex: 1; padding: 12px 24px 16px; gap: 10px; }
.af-dag > * { flex-shrink: 0; }
.af-dag__head { display: flex; flex-direction: column; gap: 6px; }
.af-dag__crumbs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; font-size: 14px; }
.af-dag__sep { color: #858585; }
.af-dag__crumb-label { font-size: 12px; color: var(--af-text-2); text-transform: uppercase; letter-spacing: .03em; }
.af-dag__title { margin: 0; font-size: 22px; line-height: 28px; font-weight: 500; color: var(--af-text-strong); overflow-wrap: anywhere; min-width: 0; letter-spacing: normal; }
.af-dag__crumb { font-weight: 600; }
.af-dag__crumb--task { font-family: var(--af-mono); color: var(--af-text-strong); overflow-wrap: anywhere; }
.af-dag__meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.af-dag__tags { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.af-dag__next { font-size: 13px; }
.af-dag__menu { right: 0; top: 30px; min-width: 220px; }
.af-dag__broken { padding: 8px 12px; }
.af-dag__errtext { margin: 4px 0 0; white-space: pre-wrap; font-family: var(--af-mono); font-size: 12px; color: #a94442; background: none; border: 0; padding: 0; overflow-wrap: anywhere; }
.af-dag__filters { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; padding: 8px 10px; background: #f8f8f8; border: 1px solid var(--af-border-light); border-radius: 4px; }
.af-dag__filter { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--af-text-2); }
.af-dag__filter .af-select { height: 28px; font-size: 13px; padding: 2px 6px; width: auto; min-width: 120px; }
.af-dag__body { display: grid; grid-template-columns: minmax(280px, 42%) minmax(0, 1fr); gap: 12px; flex: 1 0 auto; min-height: 420px; }
.af-dag__body.no-panel { grid-template-columns: minmax(0, 1fr); }
.af-dag__grid { min-width: 0; min-height: 0; }
.af-dag__panel { display: flex; flex-direction: column; min-width: 0; min-height: 0; border: 1px solid var(--af-border-light); border-radius: 4px; background: #fff; }
.af-dag__panel .af-tabs { padding: 0 8px; }
.af-dag__tab { flex: 1; min-height: 0; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
.af-dag__line { display: block; padding: 6px 8px; color: #24292e; background: #f6f8fa; border: 1px solid #e1e4e8; overflow-wrap: anywhere; white-space: pre-wrap; }
@container sl-portal (max-width: 900px) {
  .af-dag { padding: 10px 12px; }
  .af-dag__body { grid-template-columns: minmax(0, 1fr); }
  .af-dag__grid { max-height: 420px; }
  .af-dag__panel .af-tabs { flex-wrap: wrap; overflow: visible; }
}
</style>
