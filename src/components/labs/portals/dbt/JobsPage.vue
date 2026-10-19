<template>
  <div class="dbt-page">
    <div class="dbt-head">
      <div class="dbt-head__title">
        <h1>Jobs</h1>
        <p>Deploy jobs run a list of dbt commands in a deployment environment, on a schedule or on demand.</p>
      </div>
      <div class="dbt-head__actions">
        <span class="jp-anchor">
          <button type="button" class="dbt-btn dbt-btn--primary" :aria-expanded="menu" @click="menu = !menu">
            <DbtIcon name="plus" />Create job<DbtIcon name="chevron-down" />
          </button>
          <div v-if="menu" class="jp-menu" @mouseleave="menu = false">
            <button type="button" @click="create">
              <strong>Deploy job</strong><span>Build production data assets on a schedule or on demand.</span>
            </button>
            <button type="button" disabled title="Continuous integration needs a git provider; this lab has none.">
              <strong>Continuous integration job</strong><span>Needs a connected git provider (not available in this lab).</span>
            </button>
          </div>
        </span>
      </div>
    </div>

    <div class="dbt-filters">
      <input v-model="search" class="dbt-input" type="search" placeholder="Search jobs" aria-label="Search jobs" />
      <select v-model="envId" class="dbt-select" aria-label="Environment">
        <option value="">All environments</option>
        <option v-for="e in deployEnvs" :key="e.id" :value="String(e.id)">{{ e.name }}</option>
      </select>
    </div>

    <div v-if="!dbt.jobs.value.length" class="dbt-card">
      <div class="dbt-empty">
        <DbtIcon name="jobs" />
        <h3>Create your first job</h3>
        <p>A job runs commands such as <code class="dbt-mono">dbt build</code> against the Production environment. Schedule it, or trigger it with Run now.</p>
        <button type="button" class="dbt-btn dbt-btn--primary" @click="create"><DbtIcon name="plus" />Create job</button>
      </div>
    </div>
    <div v-else class="dbt-table-wrap">
      <table class="dbt-table">
        <thead><tr><th>Job name</th><th>Environment</th><th>Commands</th><th>Schedule</th><th>Last run</th><th>Next run</th><th></th></tr></thead>
        <tbody>
          <tr v-for="j in shown" :key="j.id" class="is-click" tabindex="0" @click="open(j.id)" @keydown.enter="open(j.id)">
            <td><button type="button" class="dbt-link jp-name" @click.stop="open(j.id)">{{ j.name }}</button></td>
            <td>{{ envName(j.environment_id) }}</td>
            <td class="dbt-mono jp-cmds" :title="j.execute_steps.join('\n')">{{ j.execute_steps[0] }}<span v-if="j.execute_steps.length > 1" class="dbt-muted"> +{{ j.execute_steps.length - 1 }}</span></td>
            <td>{{ j.triggers.schedule ? cronText(j.schedule.cron) : 'Not scheduled' }}</td>
            <td>
              <span v-if="j.last_run" class="dbt-status" :class="'dbt-status--' + statusTone(j.last_run.status)">
                <DbtIcon :name="statusTone(j.last_run.status) === 'ok' ? 'ok' : 'bad'" />
                <span class="dbt-status__text">{{ ago(j.last_run.finished_at, dbt.nowStamp.value) }}</span>
              </span>
              <span v-else class="dbt-muted">Never run</span>
            </td>
            <td class="dbt-nowrap">{{ j.next_run ? ago2(j.next_run) : '—' }}</td>
            <td class="dbt-num">
              <button type="button" class="dbt-btn dbt-btn--sm" :disabled="dbt.busy.value" @click.stop="runNow(j.id, j.name)"><DbtIcon name="play" />Run now</button>
            </td>
          </tr>
          <tr v-if="!shown.length"><td colspan="7" class="dbt-muted">No jobs match.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DbtIcon from './DbtIcon.vue';
import { runJob, useDbt } from './dbtContext';
import { ago, cronText, statusTone } from './dbt';

const dbt = useDbt();
const menu = ref(false);
const search = ref('');
const envId = ref('');
const deployEnvs = computed(() => dbt.envs.value.filter(e => e.type === 'deployment'));
const shown = computed(() => dbt.jobs.value.filter(j =>
  (!search.value.trim() || j.name.toLowerCase().includes(search.value.trim().toLowerCase()))
  && (!envId.value || String(j.environment_id) === envId.value)));

function envName(id: number) { return dbt.envs.value.find(e => e.id === id)?.name || String(id); }
function open(id: number) { dbt.go({ page: 'job', id }); }
function create() { menu.value = false; dbt.go({ page: 'job-edit', id: null }); }
function ago2(stamp: string) { return `in ${ago(dbt.nowStamp.value, stamp).replace(' ago', '')}`; }
async function runNow(id: number, name: string) {
  const run = await runJob(dbt, id, name);
  if (run) dbt.go({ page: 'run', id: run });
}
</script>

<style scoped src="./dbt.css"></style>
<style scoped>
.jp-anchor { position: relative; }
.jp-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; width: 320px; background: #fff; border: 1px solid var(--dbt-border); border-radius: 8px; box-shadow: 0 8px 24px rgba(20, 24, 38, .16); padding: 4px; }
.jp-menu button { width: 100%; display: flex; flex-direction: column; gap: 2px; align-items: flex-start; border: 0; background: none; padding: 9px 10px; border-radius: 6px; text-align: left; cursor: pointer; font: 13px var(--dbt-font); color: var(--dbt-ink); }
.jp-menu button:hover:not(:disabled) { background: var(--dbt-hover); }
.jp-menu button:disabled { cursor: not-allowed; opacity: .6; }
.jp-menu span { color: var(--dbt-muted); font-size: 12px; line-height: 16px; }
.jp-name { font-weight: 500; }
.jp-cmds { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
