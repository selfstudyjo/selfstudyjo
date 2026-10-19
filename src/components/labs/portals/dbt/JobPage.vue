<template>
  <div class="dbt-page">
    <div class="dbt-crumbs">
      <button type="button" @click="dbt.go({ page: 'jobs' })">Jobs</button><span>/</span><span>{{ job ? job.name : id }}</span>
    </div>
    <div v-if="!job" class="dbt-card"><div class="dbt-empty"><h3>Job not found</h3><p>It may have been deleted.</p>
      <button type="button" class="dbt-btn" @click="dbt.go({ page: 'jobs' })">Back to jobs</button></div></div>
    <template v-else>
      <div class="dbt-head">
        <div class="dbt-head__title">
          <h1>{{ job.name }}</h1>
          <p><span class="dbt-badge dbt-badge--blue">Deploy job</span> · {{ envName }} · Job ID <span class="dbt-mono">{{ job.id }}</span></p>
        </div>
        <div class="dbt-head__actions">
          <button type="button" class="dbt-btn" @click="dbt.go({ page: 'job-edit', id: job.id })"><DbtIcon name="settings" />Settings</button>
          <button type="button" class="dbt-btn" :disabled="dbt.busy.value" @click="remove"><DbtIcon name="trash" />Delete</button>
          <button type="button" class="dbt-btn dbt-btn--primary" :disabled="dbt.busy.value" @click="runNow"><DbtIcon name="play" />Run now</button>
        </div>
      </div>

      <div class="jb-grid">
        <section class="dbt-card">
          <div class="dbt-card__head"><h3>Overview</h3></div>
          <div class="dbt-card__body">
            <dl class="dbt-dl">
              <dt>Environment</dt><dd><button type="button" class="dbt-link" @click="dbt.go({ page: 'environment', id: job.environment_id })">{{ envName }}</button></dd>
              <dt>Description</dt><dd>{{ job.description || '—' }}</dd>
              <dt>Schedule</dt><dd>{{ job.triggers.schedule ? cronText(job.schedule.cron) : 'Not scheduled (runs on demand)' }}
                <span v-if="job.triggers.schedule" class="dbt-muted dbt-mono">({{ job.schedule.cron }})</span></dd>
              <dt>Next run</dt><dd>{{ job.next_run || '—' }}</dd>
              <dt>Threads</dt><dd>{{ job.settings.threads }}</dd>
              <dt>Target name</dt><dd class="dbt-mono">{{ job.settings.target_name || (env ? env.target_name : '') + ' (environment default)' }}</dd>
              <dt>Generate docs</dt><dd>{{ job.generate_docs ? 'Yes - on every run' : 'No' }}</dd>
              <dt>Source freshness</dt><dd>{{ job.run_generate_sources ? 'Yes - before the commands' : 'No' }}</dd>
            </dl>
          </div>
        </section>
        <section class="dbt-card">
          <div class="dbt-card__head"><h3>Commands</h3><span class="dbt-muted">{{ job.execute_steps.length }}</span></div>
          <ol class="jb-cmds">
            <li v-if="job.run_generate_sources" class="dbt-muted"><code class="dbt-mono">dbt source freshness</code> <small>(can fail without failing the run)</small></li>
            <li v-for="(s, i) in job.execute_steps" :key="i"><code class="dbt-mono">{{ s }}</code></li>
            <li v-if="job.generate_docs" class="dbt-muted"><code class="dbt-mono">dbt docs generate</code></li>
          </ol>
        </section>
      </div>

      <section class="dbt-card">
        <div class="dbt-card__head"><h3>Run history</h3><span class="dbt-muted">{{ runs.length }} run{{ runs.length === 1 ? '' : 's' }}</span></div>
        <div v-if="!runs.length" class="dbt-empty"><p>This job has not run yet. Press <strong>Run now</strong>, or advance the simulated clock past its schedule.</p></div>
        <table v-else class="dbt-table">
          <thead><tr><th>Status</th><th>Run</th><th>Trigger</th><th class="dbt-num">Duration</th><th>Started</th><th>Results</th></tr></thead>
          <tbody>
            <tr v-for="r in runs" :key="r.id" class="is-click" tabindex="0" @click="dbt.go({ page: 'run', id: r.id })" @keydown.enter="dbt.go({ page: 'run', id: r.id })">
              <td><span class="dbt-status" :class="'dbt-status--' + statusTone(r.status)"><DbtIcon :name="statusTone(r.status) === 'ok' ? 'ok' : 'bad'" /><span class="dbt-status__text">{{ r.status_humanized }}</span></span></td>
              <td><button type="button" class="dbt-link" @click.stop="dbt.go({ page: 'run', id: r.id })">#{{ r.id }}</button></td>
              <td>{{ r.trigger.cause }}</td>
              <td class="dbt-num">{{ duration(r.duration_s) }}</td>
              <td class="dbt-nowrap" :title="r.started_at">{{ ago(r.started_at, dbt.nowStamp.value) }}</td>
              <td class="dbt-muted">{{ r.results.length }} nodes</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cli } from '@/utils/portalKit';
import DbtIcon from './DbtIcon.vue';
import { runJob, useDbt } from './dbtContext';
import { ago, cronText, duration, statusTone } from './dbt';

const dbt = useDbt();
const id = computed(() => (dbt.route.value.page === 'job' ? dbt.route.value.id : 0));
const job = computed(() => dbt.jobs.value.find(j => j.id === id.value) || null);
const env = computed(() => dbt.envs.value.find(e => e.id === job.value?.environment_id) || null);
const envName = computed(() => env.value?.name || String(job.value?.environment_id || ''));
const runs = computed(() => dbt.cloudRuns.value.filter(r => r.job_definition_id === id.value));

async function runNow() {
  if (!job.value) return;
  const run = await runJob(dbt, job.value.id, job.value.name);
  if (run) dbt.go({ page: 'run', id: run });
}

async function remove() {
  const j = job.value;
  if (!j) return;
  const ok = await dbt.confirm({
    title: 'Delete job',
    message: `Delete "${j.name}"? Its schedule stops immediately. Past runs stay in the run history.`,
    yes: 'Delete job', danger: true, typed: j.name,
  });
  if (!ok) return;
  const result = await dbt.run(cli(['dbt-cloud', 'job', 'delete'], { '--job-id': j.id }), { success: `Job "${j.name}" deleted` });
  if (result.ok) dbt.go({ page: 'jobs' });
}
</script>

<style scoped src="./dbt.css"></style>
<style scoped>
.jb-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; }
.jb-cmds { margin: 0; padding: 12px 16px 14px 36px; display: flex; flex-direction: column; gap: 8px; }
.jb-cmds li { overflow-wrap: anywhere; }
@container sl-portal (max-width: 860px) { .jb-grid { grid-template-columns: 1fr; } }
</style>
