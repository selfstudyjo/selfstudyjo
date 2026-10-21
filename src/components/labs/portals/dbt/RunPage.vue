<template>
  <div class="dbt-page">
    <div class="dbt-crumbs">
      <button type="button" @click="dbt.go({ page: 'runs' })">Run history</button><span>/</span><span>Run #{{ id }}</span>
    </div>
    <div v-if="!run" class="dbt-card"><div class="dbt-empty"><h3>Run #{{ id }} not found</h3><p>It may have aged out of the run history.</p></div></div>
    <template v-else>
      <div class="dbt-head">
        <div class="dbt-head__title">
          <h1>
            <span class="dbt-status rp-status" :class="'dbt-status--' + statusTone(run.status)"><DbtIcon :name="icon(run.status)" /></span>
            Run #{{ run.id }}
            <span class="dbt-badge" :class="'dbt-badge--' + (run.status === 10 ? 'ok' : run.status === 20 ? 'bad' : '')">{{ run.status_humanized }}</span>
          </h1>
          <p>{{ run.trigger.cause }} · {{ ago(run.started_at, dbt.nowStamp.value) }}
            <template v-if="run.retried_from"> · <button type="button" class="dbt-link" @click="dbt.go({ page: 'run', id: run.retried_from })">retry of #{{ run.retried_from }}</button></template>
          </p>
        </div>
        <div class="dbt-head__actions">
          <button type="button" class="dbt-btn" @click="dbt.go({ page: 'job', id: run.job_definition_id })"><DbtIcon name="jobs" />View job</button>
          <button v-if="run.status === 20" type="button" class="dbt-btn" :disabled="dbt.busy.value || !jobExists"
                  title="Re-run the failed step as dbt retry, then the steps after it" @click="rerunFromFailure">
            <DbtIcon name="history" />Rerun from failure
          </button>
          <button type="button" class="dbt-btn dbt-btn--primary" :disabled="dbt.busy.value || !jobExists" @click="rerun">
            <DbtIcon name="refresh" />Rerun now
          </button>
        </div>
      </div>

      <div class="dbt-kpis">
        <div class="dbt-kpi"><span>Job</span><strong><button type="button" class="dbt-link" @click="dbt.go({ page: 'job', id: run.job_definition_id })">{{ run.job_name }}</button></strong></div>
        <div class="dbt-kpi"><span>Environment</span><strong>{{ run.environment_name || '—' }}</strong></div>
        <div class="dbt-kpi"><span>Target</span><strong class="dbt-mono">{{ run.target }}</strong></div>
        <div class="dbt-kpi"><span>Commit</span><strong class="dbt-mono">{{ run.git_branch }} · {{ run.git_sha }}</strong></div>
        <div class="dbt-kpi"><span>Run duration</span><strong>{{ duration(run.duration_s) }}</strong></div>
        <div class="dbt-kpi"><span>Started</span><strong class="rp-small">{{ run.started_at }}</strong></div>
      </div>

      <div class="dbt-tabs">
        <button type="button" :class="{ 'is-active': tab === 'summary' }" @click="tab = 'summary'">Run summary</button>
        <button type="button" :class="{ 'is-active': tab === 'timing' }" @click="tab = 'timing'">Model timing</button>
        <button type="button" :class="{ 'is-active': tab === 'results' }" @click="tab = 'results'">Results <span class="dbt-badge">{{ run.results.length }}</span></button>
      </div>

      <div v-if="tab === 'summary'" class="rp-steps">
        <div v-for="step in run.steps" :key="step.index" class="rp-step" :class="{ 'is-open': openSteps.has(step.index) }">
          <button type="button" class="rp-step__head" :aria-expanded="openSteps.has(step.index)" @click="toggle(step.index)">
            <DbtIcon :name="openSteps.has(step.index) ? 'chevron-down' : 'chevron-right'" class="dbt-muted" />
            <span class="dbt-status" :class="'dbt-status--' + (step.warning ? 'warn' : statusTone(step.status))">
              <DbtIcon :name="step.warning ? 'warn' : icon(step.status)" />
            </span>
            <span class="rp-step__name">{{ step.name }}</span>
            <span v-if="step.counts" class="rp-step__counts">
              <span v-for="(n, key) in step.counts" :key="key" class="dbt-badge"
                    :class="{ 'dbt-badge--ok': key === 'PASS' && n, 'dbt-badge--bad': key === 'ERROR' && n, 'dbt-badge--warn': key === 'WARN' && n }">{{ key }} {{ n }}</span>
            </span>
            <span class="rp-step__time">{{ step.status === 30 ? 'Skipped' : duration(step.duration_s) }}</span>
          </button>
          <div v-if="openSteps.has(step.index)" class="rp-step__body">
            <p v-if="step.command" class="dbt-muted">Command: <code class="dbt-mono">{{ step.command }}</code></p>
            <pre class="dbt-log"><span v-for="(l, i) in step.logs" :key="i" :class="'is-' + logTone(l)">{{ l }}
</span></pre>
          </div>
        </div>
      </div>

      <div v-else-if="tab === 'timing'" class="dbt-card">
        <div class="dbt-card__head"><h3>Model timing</h3><span class="dbt-muted">execution time per node</span></div>
        <div class="dbt-card__body rp-timing">
          <p v-if="!timing.length" class="dbt-muted">This run built no nodes.</p>
          <div v-for="t in timing" :key="t.unique_id + t.step" class="rp-bar-row">
            <span class="rp-bar-name dbt-mono" :title="t.unique_id">{{ dbt.nameOf(t.unique_id) }}</span>
            <span class="rp-bar-track"><span class="rp-bar" :class="'rp-bar--' + statusTone(t.status)" :style="{ width: Math.max(2, 100 * (t.execution_time || 0) / maxTime) + '%' }"></span></span>
            <span class="rp-bar-val">{{ duration(t.execution_time) }}</span>
          </div>
        </div>
      </div>

      <div v-else class="dbt-table-wrap">
        <table class="dbt-table">
          <thead><tr><th>Node</th><th>Type</th><th>Status</th><th class="dbt-num">Execution time</th><th class="dbt-num">Rows affected</th><th>Message</th></tr></thead>
          <tbody>
            <tr v-for="r in run.results" :key="r.unique_id + (r.step || '')">
              <td><button type="button" class="dbt-link dbt-mono" @click="openNode(r.unique_id)">{{ dbt.nameOf(r.unique_id) }}</button></td>
              <td><span class="dbt-kind" :class="'dbt-kind--' + kindOf(r.unique_id)">{{ kindOf(r.unique_id) }}</span></td>
              <td><span class="dbt-status" :class="'dbt-status--' + statusTone(r.status)"><DbtIcon :name="icon(r.status)" /><span class="dbt-status__text">{{ r.status }}</span></span></td>
              <td class="dbt-num">{{ duration(r.execution_time) }}</td>
              <td class="dbt-num">{{ r.rows ?? '—' }}</td>
              <td class="dbt-muted">{{ r.message || '' }}</td>
            </tr>
            <tr v-if="!run.results.length"><td colspan="6" class="dbt-muted">No node results.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DbtIcon from './DbtIcon.vue';
import { cli, errorText, parseJson } from '@/utils/portalKit';
import { runJob, useDbt } from './dbtContext';
import { ago, duration, logTone, statusTone } from './dbt';

const dbt = useDbt();
const id = computed(() => (dbt.route.value.page === 'run' ? dbt.route.value.id : 0));
const run = computed(() => dbt.cloudRuns.value.find(r => r.id === id.value) || null);
const jobExists = computed(() => !!run.value && dbt.jobs.value.some(j => j.id === run.value!.job_definition_id));
const tab = ref<'summary' | 'timing' | 'results'>('summary');

const failedStep = computed(() => run.value?.steps.find(s => s.status === 20)?.index);
const lastCommand = computed(() => [...(run.value?.steps || [])].reverse()
  .find(s => s.command && !/docs generate|source freshness/.test(s.name))?.index);
const openSteps = ref(new Set<number>([failedStep.value ?? lastCommand.value ?? -1]));
function toggle(index: number) {
  const next = new Set(openSteps.value);
  if (next.has(index)) next.delete(index); else next.add(index);
  openSteps.value = next;
}

const timing = computed(() => (run.value?.results || []).filter(r => /^(model|snapshot|seed)\./.test(r.unique_id)));
const maxTime = computed(() => Math.max(0.01, ...timing.value.map(t => t.execution_time || 0)));
function icon(s: string | number) { const t = statusTone(s); return t === 'ok' ? 'ok' : t === 'bad' ? 'bad' : t === 'warn' ? 'warn' : 'skip'; }
function kindOf(uid: string): string { return String(uid).split('.')[0] ?? ''; }
function openNode(uid: string) { dbt.go({ page: 'resource', id: uid }); }

async function rerunFromFailure() {
  const r = run.value;
  if (!r) return;
  const result = await dbt.run(cli(['dbt-cloud', 'run', 'retry'], { '--run-id': r.id }), { quiet: true });
  const doc = parseJson<any>(result.ok ? result.output : result.error || result.output);
  const next = Number(doc?.data?.id || 0) || null;
  if (result.ok) dbt.notify('success', `Run #${next} succeeded`, `Rerun from failure of run #${r.id}.`);
  else if (next) dbt.notify('error', `Run #${next} failed`, 'The retried step failed again - open the run for its logs.');
  else dbt.notify('error', 'Could not rerun from failure', errorText(result));
  if (next) dbt.go({ page: 'run', id: next });
}

async function rerun() {
  const r = run.value;
  if (!r) return;
  const next = await runJob(dbt, r.job_definition_id, r.job_name, `Rerun of run #${r.id}`);
  if (next) dbt.go({ page: 'run', id: next });
}
</script>

<style scoped src="./dbt.css"></style>
<style scoped>
.rp-status { vertical-align: -3px; font-size: 20px; }
.dbt-head h1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.rp-small { font-size: 13px !important; }
.rp-steps { display: flex; flex-direction: column; border: 1px solid var(--dbt-border); border-radius: 8px; background: #fff; overflow: hidden; }
.rp-step + .rp-step { border-top: 1px solid var(--dbt-border-light); }
.rp-step__head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 0; background: #fff; cursor: pointer; text-align: left; font: 13px var(--dbt-font); color: var(--dbt-ink); flex-wrap: wrap; }
.rp-step__head:hover { background: var(--dbt-row-hover); }
.rp-step__name { flex: 1; font-weight: 500; min-width: 160px; overflow-wrap: anywhere; }
.rp-step__counts { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.rp-step__time { color: var(--dbt-muted); font-variant-numeric: tabular-nums; min-width: 56px; text-align: right; }
.rp-step__body { padding: 0 14px 14px 46px; display: flex; flex-direction: column; gap: 8px; }
.rp-step__body p { margin: 0; overflow-wrap: anywhere; }
.rp-step__body .dbt-log { max-height: 340px; }
.rp-timing { display: flex; flex-direction: column; gap: 6px; }
.rp-bar-row { display: grid; grid-template-columns: minmax(120px, 220px) minmax(0, 1fr) 60px; gap: 10px; align-items: center; }
.rp-bar-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rp-bar-track { height: 14px; background: var(--dbt-bg-2); border-radius: 3px; overflow: hidden; }
.rp-bar { display: block; height: 100%; background: var(--dbt-k-model); border-radius: 3px; }
.rp-bar--bad { background: var(--dbt-bad); }
.rp-bar--warn { background: var(--dbt-warn); }
.rp-bar-val { text-align: right; color: var(--dbt-muted); font-variant-numeric: tabular-nums; font-size: 12px; }
@container sl-portal (max-width: 640px) {
  .rp-bar-row { grid-template-columns: minmax(90px, 40%) minmax(0, 1fr) 50px; }
  .rp-step__body { padding-left: 14px; }
}
</style>
