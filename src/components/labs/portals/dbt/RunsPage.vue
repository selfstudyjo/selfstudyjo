<template>
  <div class="dbt-page">
    <div class="dbt-head">
      <div class="dbt-head__title">
        <h1>Run history</h1>
        <p>Every run of every job in this project, newest first.</p>
      </div>
      <div class="dbt-head__actions">
        <button type="button" class="dbt-btn" @click="dbt.go({ page: 'jobs' })"><DbtIcon name="jobs" />View jobs</button>
      </div>
    </div>

    <div class="dbt-filters">
      <input v-model="search" class="dbt-input" type="search" placeholder="Search by job name or run ID" aria-label="Search runs" />
      <select v-model="status" class="dbt-select" aria-label="Status">
        <option value="">All statuses</option>
        <option value="Success">Success</option>
        <option value="Error">Error</option>
        <option value="Cancelled">Cancelled</option>
      </select>
      <select v-model="envId" class="dbt-select" aria-label="Environment">
        <option value="">All environments</option>
        <option v-for="e in dbt.envs.value" :key="e.id" :value="String(e.id)">{{ e.name }}</option>
      </select>
      <select v-model="jobId" class="dbt-select" aria-label="Job">
        <option value="">All jobs</option>
        <option v-for="j in dbt.jobs.value" :key="j.id" :value="String(j.id)">{{ j.name }}</option>
      </select>
    </div>

    <div v-if="!dbt.cloudRuns.value.length" class="dbt-card">
      <div class="dbt-empty">
        <DbtIcon name="history" />
        <h3>No runs yet</h3>
        <p>Runs appear here when a job is triggered - by its schedule as simulated time passes, or with <strong>Run now</strong>.</p>
        <button type="button" class="dbt-btn dbt-btn--primary" @click="dbt.go({ page: 'job-edit', id: null })"><DbtIcon name="plus" />Create job</button>
      </div>
    </div>
    <div v-else class="dbt-table-wrap">
      <table class="dbt-table">
        <thead>
          <tr>
            <th>Status</th><th>Run</th><th>Job</th><th>Environment</th><th>Trigger</th><th>Branch</th>
            <th class="dbt-num">Duration</th><th>Started</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in shown" :key="r.id" class="is-click" tabindex="0" @click="open(r.id)" @keydown.enter="open(r.id)">
            <td><span class="dbt-status" :class="'dbt-status--' + statusTone(r.status)"><DbtIcon :name="icon(r.status)" /><span class="dbt-status__text">{{ r.status_humanized }}</span></span></td>
            <td><button type="button" class="dbt-link" @click.stop="open(r.id)">#{{ r.id }}</button></td>
            <td>{{ r.job_name }}</td>
            <td>{{ r.environment_name || '—' }}</td>
            <td class="dbt-nowrap"><DbtIcon :name="r.trigger.type === 'scheduled' ? 'calendar' : 'user'" class="dbt-muted" /> {{ r.trigger.cause }}</td>
            <td class="dbt-mono dbt-nowrap"><DbtIcon name="branch" class="dbt-muted" /> {{ r.git_branch }} · {{ r.git_sha }}</td>
            <td class="dbt-num">{{ duration(r.duration_s) }}</td>
            <td class="dbt-nowrap" :title="r.started_at">{{ ago(r.started_at, dbt.nowStamp.value) }}</td>
          </tr>
          <tr v-if="!shown.length"><td colspan="8" class="dbt-muted">No runs match these filters.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DbtIcon from './DbtIcon.vue';
import { useDbt } from './dbtContext';
import { ago, duration, statusTone } from './dbt';

const dbt = useDbt();
const search = ref('');
const status = ref('');
const envId = ref('');
const jobId = ref('');

const shown = computed(() => dbt.cloudRuns.value.filter(r => {
  const q = search.value.trim().toLowerCase();
  if (q && !(r.job_name.toLowerCase().includes(q) || String(r.id).includes(q))) return false;
  if (status.value && r.status_humanized !== status.value) return false;
  if (envId.value && String(r.environment_id) !== envId.value) return false;
  if (jobId.value && String(r.job_definition_id) !== jobId.value) return false;
  return true;
}));

function icon(s: number) { const t = statusTone(s); return t === 'ok' ? 'ok' : t === 'bad' ? 'bad' : 'skip'; }
function open(id: number) { dbt.go({ page: 'run', id }); }
</script>

<style scoped src="./dbt.css"></style>
