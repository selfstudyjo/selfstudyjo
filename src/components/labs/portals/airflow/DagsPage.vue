<template>
  <div class="af-page af-dags">
    <!-- Import errors: the collapsible red banner over the DAGs list. -->
    <div v-if="af.importErrors.value.length" class="af-alert af-alert--error af-dags__errors" role="alert">
      <div class="af-alert__body">
        <button type="button" class="af-dags__errtoggle" :aria-expanded="showErrors" @click="showErrors = !showErrors">
          <AfIcon name="warning" /> DAG Import Errors ({{ af.importErrors.value.length }})
          <AfIcon name="caret" :class="{ 'is-open': showErrors }" />
        </button>
        <template v-if="showErrors">
          <div v-for="err in af.importErrors.value" :key="err.file" class="af-dags__err">
            <strong>Broken DAG: [{{ err.file }}]</strong>
            <pre class="af-dags__errtext">{{ err.error }}</pre>
          </div>
        </template>
      </div>
    </div>

    <h2 class="af-h2">DAGs</h2>

    <div class="af-dags__bar">
      <div class="af-btn-group" role="group" aria-label="Filter by status">
        <button type="button" class="af-btn af-btn--sm" :class="{ 'is-active': status === 'all' }" @click="status = 'all'">
          All <span class="af-badge">{{ af.dags.value.length }}</span></button>
        <button type="button" class="af-btn af-btn--sm" :class="{ 'is-active': status === 'active' }" @click="status = 'active'">
          Active <span class="af-badge">{{ activeCount }}</span></button>
        <button type="button" class="af-btn af-btn--sm" :class="{ 'is-active': status === 'paused' }" @click="status = 'paused'">
          Paused <span class="af-badge">{{ af.dags.value.length - activeCount }}</span></button>
      </div>
      <div class="af-btn-group" role="group" aria-label="Filter by last run">
        <button type="button" class="af-btn af-btn--sm" :class="{ 'is-active': lastRun === 'running' }" @click="lastRun = lastRun === 'running' ? '' : 'running'">
          Running <span class="af-badge">{{ withLast('running') }}</span></button>
        <button type="button" class="af-btn af-btn--sm" :class="{ 'is-active': lastRun === 'failed' }" @click="lastRun = lastRun === 'failed' ? '' : 'failed'">
          Failed <span class="af-badge">{{ withLast('failed') }}</span></button>
      </div>
      <span class="af-spacer"></span>
      <div class="af-dags__tagfilter">
        <select v-model="tagFilter" class="af-select af-dags__tagsel" aria-label="Filter DAGs by tag">
          <option value="">Filter DAGs by tag</option>
          <option v-for="t in allTags" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div class="af-dags__search">
        <AfIcon name="search" />
        <input v-model="query" class="af-input" type="search" placeholder="Search DAGs" aria-label="Search DAGs" />
      </div>
      <button type="button" class="af-btn af-btn--sm af-btn--icon" title="Refresh" aria-label="Refresh" :disabled="af.busy.value" @click="af.refresh()">
        <AfIcon name="refresh" />
      </button>
    </div>

    <div class="af-panel">
      <div class="af-table-wrap">
        <table class="af-table af-dags__table">
          <thead>
            <tr>
              <th class="af-dags__toggle-col" aria-label="Pause/Unpause DAG" title="Pause/Unpause DAG"></th>
              <th class="af-sort" @click="sortOn('dag_id')">DAG {{ arrow('dag_id') }}</th>
              <th class="af-sort" @click="sortOn('owner')">Owner {{ arrow('owner') }}</th>
              <th>Runs <AfIcon name="info" class="af-dags__info" /></th>
              <th>Schedule</th>
              <th>Last Run <AfIcon name="info" class="af-dags__info" /></th>
              <th class="af-sort" @click="sortOn('next_run')">Next Run {{ arrow('next_run') }}</th>
              <th>Recent Tasks <AfIcon name="info" class="af-dags__info" /></th>
              <th class="af-actions-col">Actions</th>
              <th class="af-actions-col">Links</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dag in shown" :key="dag.dag_id" :class="{ 'is-paused': dag.paused }">
              <td class="af-dags__toggle-col">
                <button type="button" class="af-switch" :class="{ 'is-on': !dag.paused }" role="switch" :aria-checked="!dag.paused"
                        :title="dag.paused ? 'DAG is Paused' : 'DAG is Active'" :aria-label="'Pause/Unpause DAG ' + dag.dag_id"
                        :disabled="af.busy.value" @click="togglePause(af, dag)"></button>
              </td>
              <td class="af-dags__name-col">
                <button type="button" class="af-link af-link--strong af-dags__name" :title="dag.description || dag.dag_id"
                        @click="open(dag.dag_id)">{{ dag.dag_id }}</button>
                <div v-if="dag.tags.length" class="af-dags__tags">
                  <button v-for="t in dag.tags" :key="t" type="button" class="af-tag" @click="tagFilter = t">{{ t }}</button>
                </div>
              </td>
              <td class="af-nowrap"><button type="button" class="af-link" @click="query = String(dag.owner || '')">{{ dag.owner || 'airflow' }}</button></td>
              <td><StateCircles :states="RUN_STATES" :counts="runCounts(dag.dag_id)" @pick="af.go({ page: 'dagruns' })" /></td>
              <td><span class="af-pill" :title="'Schedule: ' + scheduleLabel(dag.schedule)">{{ scheduleLabel(dag.schedule) }}</span></td>
              <td class="af-nowrap">
                <template v-if="lastRunOf(dag.dag_id)">
                  <button type="button" class="af-link" @click="open(dag.dag_id, lastRunOf(dag.dag_id)?.run_id)">
                    {{ fmtDate(lastRunOf(dag.dag_id)?.logical_date, false) }}</button>
                  <AfIcon name="info" class="af-dags__info"
                          :title="`Run state: ${lastRunOf(dag.dag_id)?.state}\nStarted: ${fmtDate(lastRunOf(dag.dag_id)?.start)}\nEnded: ${fmtDate(lastRunOf(dag.dag_id)?.end)}`" />
                </template>
              </td>
              <td class="af-nowrap">
                <template v-if="dag.next_run && !dag.paused">{{ fmtDate(dag.next_run, false) }}
                  <AfIcon name="info" class="af-dags__info" :title="'Run After: ' + fmtDate(dag.next_run_after || dag.next_run)" /></template>
                <span v-else-if="dag.next_run" class="af-muted" title="Paused DAGs are not scheduled">{{ fmtDate(dag.next_run, false) }}</span>
              </td>
              <td><StateCircles :states="TASK_STATES" :counts="recentTaskCounts(dag.dag_id)" @pick="af.go({ page: 'tis' })" /></td>
              <td class="af-actions-col">
                <span class="af-dags__actions">
                  <span class="af-menu-anchor">
                    <button type="button" class="af-btn af-btn--sm af-btn--icon af-dags__play" :title="'Trigger DAG ' + dag.dag_id"
                            :aria-label="'Trigger DAG ' + dag.dag_id" :aria-expanded="menuFor === dag.dag_id"
                            @click.stop="menuFor = menuFor === dag.dag_id ? '' : dag.dag_id"><AfIcon name="play" /></button>
                    <div v-if="menuFor === dag.dag_id" class="af-menu af-dags__menu" role="menu">
                      <button type="button" role="menuitem" @click="menuFor = ''; triggerNow(af, dag.dag_id)">Trigger DAG</button>
                      <button type="button" role="menuitem" @click="menuFor = ''; triggering = dag.dag_id">Trigger DAG w/ config</button>
                    </div>
                  </span>
                  <button type="button" class="af-btn af-btn--sm af-btn--icon" :title="'Delete DAG ' + dag.dag_id"
                          :aria-label="'Delete DAG ' + dag.dag_id" @click="deleteDag(af, dag.dag_id)"><AfIcon name="trash" /></button>
                </span>
              </td>
              <td class="af-actions-col">
                <span class="af-menu-anchor">
                  <button type="button" class="af-btn af-btn--sm" :aria-expanded="linksFor === dag.dag_id" aria-label="Links"
                          @click.stop="linksFor = linksFor === dag.dag_id ? '' : dag.dag_id">&middot;&middot;&middot;</button>
                  <div v-if="linksFor === dag.dag_id" class="af-menu af-dags__menu" role="menu">
                    <button v-for="link in LINKS" :key="link.tab" type="button" role="menuitem"
                            @click="linksFor = ''; af.go({ page: 'dag', dagId: dag.dag_id, tab: link.tab })"><AfIcon :name="link.icon" /> {{ link.label }}</button>
                  </div>
                </span>
              </td>
            </tr>
            <tr v-if="!shown.length">
              <td colspan="10" class="af-empty-cell">
                <template v-if="!af.dags.value.length">No DAGs found. Put a DAG file in <code>dags/</code> (Files tool) - the scheduler parses it on the next command.</template>
                <template v-else>No results</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="af-panel__foot">
        Showing {{ shown.length ? 1 : 0 }}-{{ shown.length }} of {{ shown.length }} DAGs
        <span class="af-spacer"></span>
        <button type="button" class="af-link" @click="af.go({ page: 'cluster' })">Cluster Activity</button>
      </div>
    </div>

    <TriggerDialog v-if="triggering" :dag-id="triggering" @close="triggering = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { matches, sortBy } from '@/utils/portalKit';
import AfIcon from './AfIcon.vue';
import StateCircles from './StateCircles.vue';
import TriggerDialog from './TriggerDialog.vue';
import { useAf } from './afContext';
import { RUN_STATES, TASK_STATES, fmtDate, normState, scheduleLabel, type AfDag, type AfRun, type DagTab } from './airflow';
import { deleteDag, togglePause, triggerNow } from './dagActions';

const af = useAf();
const status = ref<'all' | 'active' | 'paused'>('all');
const lastRun = ref('');
const tagFilter = ref('');
const query = ref('');
const showErrors = ref(false);
const sortKey = ref('dag_id');
const sortDir = ref<'asc' | 'desc'>('asc');
const menuFor = ref('');
const linksFor = ref('');
const triggering = ref('');

const LINKS: { label: string; tab: DagTab; icon: string }[] = [
  { label: 'Code', tab: 'code', icon: 'code' },
  { label: 'Details', tab: 'details', icon: 'details' },
  { label: 'Gantt', tab: 'gantt', icon: 'list' },
  { label: 'Calendar', tab: 'calendar', icon: 'calendar' },
  { label: 'Graph', tab: 'graph', icon: 'graph' },
  { label: 'Grid', tab: 'details', icon: 'grid' },
];

function closeMenus() { menuFor.value = ''; linksFor.value = ''; }
onMounted(() => window.addEventListener('click', closeMenus));
onBeforeUnmount(() => window.removeEventListener('click', closeMenus));

const activeCount = computed(() => af.dags.value.filter(d => !d.paused).length);
const allTags = computed(() => [...new Set(af.dags.value.flatMap(d => d.tags))].sort());

const latestRuns = computed(() => {
  const map = new Map<string, AfRun>();
  for (const r of af.runs.value) {
    const prev = map.get(r.dag_id);
    if (!prev || String(r.logical_date) >= String(prev.logical_date)) map.set(r.dag_id, r);
  }
  return map;
});
function lastRunOf(dagId: string) { return latestRuns.value.get(dagId); }
function lastState(dag: AfDag) { return normState(lastRunOf(dag.dag_id)?.state || dag.last_run_state); }
function withLast(state: string) { return af.dags.value.filter(d => lastState(d) === state).length; }

function runCounts(dagId: string) {
  const counts: Record<string, number> = {};
  for (const r of af.runsOf(dagId)) { const s = normState(r.state); counts[s] = (counts[s] || 0) + 1; }
  return counts;
}
function recentTaskCounts(dagId: string) {
  const counts: Record<string, number> = {};
  const active = af.runsOf(dagId).filter(r => ['running', 'queued'].includes(normState(r.state))).map(r => r.run_id);
  const ids = active.length ? new Set(active) : new Set([lastRunOf(dagId)?.run_id].filter(Boolean) as string[]);
  for (const t of af.tis.value) {
    if (t.dag_id !== dagId || !ids.has(t.run_id)) continue;
    const s = normState(t.state); counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

const shown = computed(() => {
  const list = af.dags.value.filter(d => (status.value === 'all' || (status.value === 'active') === !d.paused)
    && (!lastRun.value || lastState(d) === lastRun.value)
    && (!tagFilter.value || d.tags.includes(tagFilter.value))
    && matches(d, query.value, ['dag_id', 'owner', 'tags', 'description']));
  return sortBy(list, sortKey.value, sortDir.value);
});

function sortOn(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'asc'; }
}
function arrow(key: string) { return sortKey.value === key ? (sortDir.value === 'asc' ? '▲' : '▼') : ''; }

function open(dagId: string, runId?: string) {
  af.go({ page: 'dag', dagId, tab: 'details', runId });
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-dags__errors { padding: 8px 12px; }
.af-dags__errtoggle { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; padding: 0; font: inherit; font-weight: 700; color: inherit; cursor: pointer; }
.af-dags__errtoggle .is-open { transform: rotate(180deg); }
.af-dags__err { margin-top: 8px; }
.af-dags__errtext { margin: 4px 0 0; white-space: pre-wrap; font-family: var(--af-mono); font-size: 12px; color: #a94442; background: none; border: 0; padding: 0; overflow-wrap: anywhere; }
.af-dags__bar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.af-badge { display: inline-block; min-width: 18px; padding: 1px 6px; border-radius: 9px; background: #777; color: #fff; font-size: 11px; line-height: 15px; font-weight: 700; }
.af-btn.is-active .af-badge { background: var(--af-primary); }
.af-dags__tagsel { width: 200px; height: 30px; font-size: 13px; }
.af-dags__search { position: relative; display: flex; align-items: center; width: 220px; }
.af-dags__search .af-ico { position: absolute; left: 9px; color: #999; pointer-events: none; }
.af-dags__search .af-input { padding-left: 30px; height: 30px; font-size: 13px; }
.af-dags__table td { padding: 6px 8px; }
.af-dags__table tr.is-paused .af-dags__name { color: #777; }
.af-dags__toggle-col { width: 46px; }
.af-dags__name-col { min-width: 180px; }
.af-dags__name { font-size: 15px; }
.af-dags__tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
.af-dags__info { color: #999; width: 13px; height: 13px; cursor: help; vertical-align: -2px; }
.af-dags__actions { display: inline-flex; gap: 4px; }
.af-dags__play { color: var(--af-primary); }
.af-dags__menu { right: 0; top: 30px; }
@container sl-portal (max-width: 760px) {
  .af-dags__search, .af-dags__tagsel { width: 100%; }
  .af-dags__tagfilter { flex: 1 1 160px; }
  .af-dags__search { flex: 1 1 160px; }
}
</style>
