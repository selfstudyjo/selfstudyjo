<template>
  <div class="dbt-page">
    <!-- ===== One environment ===== -->
    <template v-if="current">
      <div class="dbt-crumbs">
        <button type="button" @click="dbt.go({ page: 'environments' })">Environments</button><span>/</span><span>{{ current.name }}</span>
      </div>
      <div class="dbt-head">
        <div class="dbt-head__title">
          <h1>{{ current.name }}</h1>
          <p>
            <span class="dbt-badge" :class="current.type === 'development' ? 'dbt-badge--blue' : 'dbt-badge--orange'">{{ current.type === 'development' ? 'Development' : 'Deployment' }}</span>
            <span v-if="current.deployment_type" class="dbt-badge">{{ cap(current.deployment_type) }}</span>
            · Environment ID <span class="dbt-mono">{{ current.id }}</span>
          </p>
        </div>
        <div class="dbt-head__actions">
          <button v-if="current.type === 'deployment'" type="button" class="dbt-btn" :disabled="dbt.busy.value" @click="remove(current)">
            <DbtIcon name="trash" />Delete environment
          </button>
          <button v-if="current.type === 'deployment'" type="button" class="dbt-btn dbt-btn--primary" @click="dbt.go({ page: 'job-edit', id: null, envId: current.id })">
            <DbtIcon name="plus" />Create job
          </button>
          <button v-else type="button" class="dbt-btn dbt-btn--primary" @click="dbt.go({ page: 'develop' })"><DbtIcon name="code" />Open Studio IDE</button>
        </div>
      </div>
      <div class="ev-grid">
        <section class="dbt-card">
          <div class="dbt-card__head"><h3>Settings</h3></div>
          <div class="dbt-card__body">
            <dl class="dbt-dl">
              <dt>dbt version</dt><dd>{{ versionLabel(current.dbt_version) }}</dd>
              <dt>Connection</dt><dd>{{ current.connection }}</dd>
              <dt>Account</dt><dd class="dbt-mono">{{ account }}</dd>
              <dt>Database</dt><dd class="dbt-mono">{{ dbt.project.value.database || 'ANALYTICS' }}</dd>
              <dt>Target name</dt><dd class="dbt-mono">{{ current.target_name }}</dd>
              <dt>Threads</dt><dd>{{ current.threads }}</dd>
              <dt>Custom branch</dt><dd class="dbt-mono">{{ current.custom_branch || 'main (default)' }}</dd>
            </dl>
          </div>
        </section>
        <section class="dbt-card">
          <div class="dbt-card__head"><h3>Jobs in this environment</h3><span class="dbt-muted">{{ envJobs.length }}</span></div>
          <div v-if="!envJobs.length" class="dbt-empty"><p>{{ current.type === 'development' ? 'Development environments run the IDE, not jobs.' : 'No jobs yet.' }}</p></div>
          <ul v-else class="ev-jobs">
            <li v-for="j in envJobs" :key="j.id">
              <button type="button" class="dbt-link" @click="dbt.go({ page: 'job', id: j.id })">{{ j.name }}</button>
              <span class="dbt-muted">{{ j.triggers.schedule ? cronText(j.schedule.cron) : 'On demand' }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <!-- ===== The list ===== -->
    <template v-else>
      <div class="dbt-head">
        <div class="dbt-head__title">
          <h1>Environments</h1>
          <p>Where dbt runs: the development environment powers the IDE; deployment environments run jobs.</p>
        </div>
        <div class="dbt-head__actions">
          <button type="button" class="dbt-btn dbt-btn--primary" @click="openCreate"><DbtIcon name="plus" />Create environment</button>
        </div>
      </div>

      <section v-for="group in groups" :key="group.title" class="ev-section">
        <h2>{{ group.title }}</h2>
        <div class="dbt-table-wrap">
          <table class="dbt-table">
            <thead><tr><th>Name</th><th>Type</th><th>dbt version</th><th>Target name</th><th class="dbt-num">Threads</th><th class="dbt-num">Jobs</th></tr></thead>
            <tbody>
              <tr v-for="e in group.rows" :key="e.id" class="is-click" tabindex="0" @click="dbt.go({ page: 'environment', id: e.id })" @keydown.enter="dbt.go({ page: 'environment', id: e.id })">
                <td><button type="button" class="dbt-link ev-name" @click.stop="dbt.go({ page: 'environment', id: e.id })">{{ e.name }}</button></td>
                <td>
                  <span class="dbt-badge" :class="e.type === 'development' ? 'dbt-badge--blue' : 'dbt-badge--orange'">{{ e.type === 'development' ? 'Development' : 'Deployment' }}</span>
                  <span v-if="e.deployment_type" class="dbt-badge ev-gap">{{ cap(e.deployment_type) }}</span>
                </td>
                <td>{{ versionLabel(e.dbt_version) }}</td>
                <td class="dbt-mono">{{ e.target_name }}</td>
                <td class="dbt-num">{{ e.threads }}</td>
                <td class="dbt-num">{{ dbt.jobs.value.filter(j => j.environment_id === e.id).length }}</td>
              </tr>
              <tr v-if="!group.rows.length"><td colspan="6" class="dbt-muted">None.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <DbtModal v-if="creating" title="Create environment" ok-text="Save" :ok-disabled="!!createProblem || saving" :busy="saving" :width="580"
              @close="creating = false" @ok="create">
      <div v-if="createError" class="dbt-error">{{ createError }}</div>
      <label class="dbt-field"><span>Environment name *</span><input v-model="form.name" class="dbt-input" placeholder="Staging" /></label>
      <div class="dbt-field">
        <span>Set deployment type</span>
        <label class="dbt-check"><input v-model="form.dtype" type="radio" value="production" :disabled="hasProd" />
          <span><strong>PROD</strong> - the environment that builds production data{{ hasProd ? ' (this project already has one)' : '' }}</span></label>
        <label class="dbt-check"><input v-model="form.dtype" type="radio" value="staging" /> <span><strong>Staging</strong> - pre-production checks</span></label>
        <label class="dbt-check"><input v-model="form.dtype" type="radio" value="general" /> <span><strong>General</strong> - anything else</span></label>
      </div>
      <label class="dbt-field">
        <span>dbt version</span>
        <select v-model="form.version" class="dbt-select">
          <option value="versionless">Latest (versionless)</option>
          <option value="1.8">1.8</option>
          <option value="1.7">1.7</option>
        </select>
      </label>
      <label class="dbt-field"><span>Connection</span><input class="dbt-input" value="Snowflake (shopflow)" disabled /></label>
      <div class="ev-two">
        <label class="dbt-field"><span>Target name</span><input v-model="form.target" class="dbt-input is-mono" placeholder="staging" /></label>
        <label class="dbt-field"><span>Threads</span><input v-model.number="form.threads" class="dbt-input" type="number" min="1" max="64" /></label>
      </div>
      <label class="dbt-field"><span>Custom branch</span><input v-model="form.branch" class="dbt-input is-mono" placeholder="(default branch)" />
        <small>The git branch jobs in this environment check out.</small></label>
      <p class="dbt-help">Runs <code class="dbt-mono">{{ createCommand }}</code></p>
    </DbtModal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, parseJson } from '@/utils/portalKit';
import DbtIcon from './DbtIcon.vue';
import DbtModal from './DbtModal.vue';
import { useDbt } from './dbtContext';
import { cronText, type CloudEnv } from './dbt';

const dbt = useDbt();
const account = 'shopflow-xy12345.eu-west-1';
const current = computed(() => (dbt.route.value.page === 'environment'
  ? dbt.envs.value.find(e => e.id === (dbt.route.value as any).id) || null : null));
const envJobs = computed(() => dbt.jobs.value.filter(j => j.environment_id === current.value?.id));
const groups = computed(() => [
  { title: 'Development environment', rows: dbt.envs.value.filter(e => e.type === 'development') },
  { title: 'Deployment environments', rows: dbt.envs.value.filter(e => e.type === 'deployment') },
]);
const hasProd = computed(() => dbt.envs.value.some(e => e.deployment_type === 'production'));

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function versionLabel(v: string) { return v === 'versionless' ? 'Latest (versionless)' : v; }

const creating = ref(false);
const saving = ref(false);
const createError = ref('');
const form = reactive({ name: '', dtype: 'staging', version: 'versionless', target: 'staging', threads: 4, branch: '' });
function openCreate() {
  Object.assign(form, { name: '', dtype: hasProd.value ? 'staging' : 'production', version: 'versionless',
                        target: hasProd.value ? 'staging' : 'prod', threads: 4, branch: '' });
  createError.value = '';
  creating.value = true;
}
const createProblem = computed(() => {
  if (!form.name.trim()) return 'Environment name is required.';
  if (!/^[A-Za-z0-9_-]*$/.test(form.target.trim())) return 'Target name: letters, digits, _ and - only.';
  if (!(form.threads >= 1 && form.threads <= 64)) return 'Threads must be between 1 and 64.';
  return '';
});
const createCommand = computed(() => cli(['dbt-cloud', 'environment', 'create'], {
  '--name': form.name.trim(), '--type': 'deployment', '--deployment-type': form.dtype,
  '--dbt-version': form.version, '--target-name': form.target.trim() || 'default', '--threads': form.threads,
  '--custom-branch': form.branch.trim(),
}));

async function create() {
  if (createProblem.value) return;
  saving.value = true;
  createError.value = '';
  try {
    const result = await dbt.run(createCommand.value, { quiet: true });
    if (!result.ok) {
      const doc = parseJson<any>(result.error || result.output);
      createError.value = doc?.status?.user_message || String(result.error || result.output || 'The request failed');
      return;
    }
    const id = Number(parseJson<any>(result.output)?.data?.id || 0);
    dbt.notify('success', 'Environment created', form.name.trim());
    creating.value = false;
    if (id) dbt.go({ page: 'environment', id });
  } finally {
    saving.value = false;
  }
}

async function remove(env: CloudEnv) {
  const ok = await dbt.confirm({
    title: 'Delete environment',
    message: `Delete the ${env.name} environment? This cannot be undone. An environment that still has jobs cannot be deleted.`,
    yes: 'Delete', danger: true, typed: env.name,
  });
  if (!ok) return;
  const result = await dbt.run(cli(['dbt-cloud', 'environment', 'delete'], { '--environment-id': env.id }),
                               { success: `Environment "${env.name}" deleted` });
  if (result.ok) dbt.go({ page: 'environments' });
}
</script>

<style scoped src="./dbt.css"></style>
<style scoped>
.ev-section { display: flex; flex-direction: column; gap: 8px; }
.ev-section h2 { margin: 0; font-size: 15px; font-weight: 600; color: var(--dbt-ink); }
.ev-name { font-weight: 500; }
.ev-section .dbt-table { table-layout: fixed; }
.ev-section .dbt-table th:first-child { width: 22%; }
.ev-section .dbt-table th:nth-child(2) { width: 24%; }
.ev-gap { margin-left: 4px; }
.ev-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; }
.ev-jobs { list-style: none; margin: 0; padding: 8px 16px 14px; display: flex; flex-direction: column; gap: 8px; }
.ev-jobs li { display: flex; flex-direction: column; }
.ev-two { display: grid; grid-template-columns: 1fr 140px; gap: 12px; }
.dbt-head p { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
@container sl-portal (max-width: 860px) { .ev-grid { grid-template-columns: 1fr; } }
</style>
