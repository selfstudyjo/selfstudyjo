<template>
  <div class="dbt-page">
    <div class="dbt-crumbs">
      <button type="button" @click="dbt.go({ page: 'jobs' })">Jobs</button><span>/</span>
      <template v-if="existing"><button type="button" @click="dbt.go({ page: 'job', id: existing.id })">{{ existing.name }}</button><span>/</span><span>Settings</span></template>
      <span v-else>Create deploy job</span>
    </div>
    <div class="dbt-head">
      <div class="dbt-head__title">
        <h1>{{ existing ? 'Edit job settings' : 'Create deploy job' }}</h1>
        <p>Job commands run in the order listed, against the environment's Snowflake target.</p>
      </div>
      <div class="dbt-head__actions">
        <button type="button" class="dbt-btn" @click="cancel">Cancel</button>
        <button type="button" class="dbt-btn dbt-btn--primary" :disabled="!!problem || saving" @click="save">{{ saving ? 'Saving…' : 'Save' }}</button>
      </div>
    </div>
    <div v-if="error" class="dbt-error">{{ error }}</div>

    <section class="dbt-card">
      <div class="dbt-card__head"><h3>Job settings</h3></div>
      <div class="dbt-card__body je-form">
        <label class="dbt-field">
          <span>Job name *</span>
          <input v-model="name" class="dbt-input" placeholder="Daily production build" maxlength="120" />
        </label>
        <label class="dbt-field">
          <span>Description</span>
          <textarea v-model="description" class="dbt-textarea" rows="2" placeholder="What this job builds and why"></textarea>
        </label>
        <label class="dbt-field">
          <span>Environment *</span>
          <select v-model.number="envId" class="dbt-select">
            <option v-for="e in deployEnvs" :key="e.id" :value="e.id">{{ e.name }}{{ e.deployment_type ? ' (' + e.deployment_type + ')' : '' }}</option>
          </select>
          <small>Jobs run in deployment environments. Development is for the IDE.</small>
        </label>
      </div>
    </section>

    <section class="dbt-card">
      <div class="dbt-card__head"><h3>Execution settings</h3></div>
      <div class="dbt-card__body je-form">
        <div class="dbt-field">
          <span>Commands *</span>
          <div v-for="(_s, i) in steps" :key="i" class="je-step">
            <span class="je-step__n">{{ i + 1 }}</span>
            <input v-model="steps[i]" class="dbt-input is-mono" placeholder="dbt build" :aria-label="'Command ' + (i + 1)" />
            <button type="button" class="dbt-btn dbt-btn--icon dbt-btn--ghost" :disabled="steps.length === 1" :aria-label="'Remove command ' + (i + 1)" @click="steps.splice(i, 1)"><DbtIcon name="trash" /></button>
          </div>
          <div>
            <button type="button" class="dbt-btn dbt-btn--sm" :disabled="steps.length >= 10" @click="steps.push('')"><DbtIcon name="plus" />Add command</button>
          </div>
          <small>Each command must begin with <code class="dbt-mono">dbt</code>, e.g. <code class="dbt-mono">dbt build --select tag:daily</code>. Up to 10.</small>
        </div>
        <label class="dbt-check"><input v-model="generateDocs" type="checkbox" /> <span><strong>Generate docs on run</strong><br /><small class="dbt-help">Adds <code class="dbt-mono">dbt docs generate</code> after the commands.</small></span></label>
        <label class="dbt-check"><input v-model="freshness" type="checkbox" /> <span><strong>Run source freshness</strong><br /><small class="dbt-help">Runs <code class="dbt-mono">dbt source freshness</code> first. If it fails, the job continues.</small></span></label>
      </div>
    </section>

    <section class="dbt-card">
      <div class="dbt-card__head"><h3>Triggers</h3></div>
      <div class="dbt-card__body je-form">
        <label class="dbt-check je-toggle">
          <input v-model="scheduled" type="checkbox" role="switch" />
          <span><strong>Run on schedule</strong><br /><small class="dbt-help">Runs whenever the simulated clock passes a scheduled time (UTC).</small></span>
        </label>
        <template v-if="scheduled">
          <label class="dbt-field">
            <span>Timing</span>
            <select v-model="mode" class="dbt-select">
              <option value="interval">Intervals</option>
              <option value="hours">Specific hours</option>
              <option value="cron">Cron schedule</option>
            </select>
          </label>
          <label v-if="mode === 'interval'" class="dbt-field">
            <span>Run every</span>
            <select v-model.number="every" class="dbt-select">
              <option v-for="h in [1, 2, 3, 4, 6, 8, 12, 24]" :key="h" :value="h">{{ h === 24 ? 'Day (at midnight UTC)' : h + ' hour' + (h === 1 ? '' : 's') }}</option>
            </select>
          </label>
          <template v-if="mode === 'hours'">
            <label class="dbt-field">
              <span>At these hours (UTC)</span>
              <input v-model="hours" class="dbt-input" placeholder="6, 18" />
              <small>Comma-separated hours from 0 to 23.</small>
            </label>
            <div class="dbt-field">
              <span>On these days</span>
              <div class="je-days">
                <label v-for="(d, i) in DAYS" :key="d" class="dbt-check"><input v-model="days" type="checkbox" :value="i" />{{ d }}</label>
              </div>
            </div>
          </template>
          <label v-if="mode === 'cron'" class="dbt-field">
            <span>Custom cron schedule (UTC)</span>
            <input v-model="cron" class="dbt-input is-mono" placeholder="0 6 * * *" />
            <small>minute hour day-of-month month day-of-week</small>
          </label>
          <p class="je-preview"><DbtIcon name="calendar" /> {{ cronValue ? cronText(cronValue) : 'Choose a schedule' }} <code v-if="cronValue" class="dbt-mono">{{ cronValue }}</code></p>
        </template>
      </div>
    </section>

    <section class="dbt-card">
      <div class="dbt-card__head"><h3>Advanced settings</h3></div>
      <div class="dbt-card__body je-form je-two">
        <label class="dbt-field">
          <span>Target name</span>
          <input v-model="target" class="dbt-input is-mono" :placeholder="envTarget + ' (environment default)'" />
          <small>Overrides <code class="dbt-mono">target.name</code> for this job.</small>
        </label>
        <label class="dbt-field">
          <span>Threads</span>
          <input v-model.number="threads" class="dbt-input" type="number" min="1" max="64" />
        </label>
      </div>
    </section>
    <p class="dbt-help">Saving runs <code class="dbt-mono">{{ preview }}</code></p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { parseJson } from '@/utils/portalKit';
import DbtIcon from './DbtIcon.vue';
import { textFlag, useDbt } from './dbtContext';
import { cronText } from './dbt';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dbt = useDbt();
const editId = computed(() => (dbt.route.value.page === 'job-edit' ? dbt.route.value.id : null));
const presetEnv = dbt.route.value.page === 'job-edit' ? dbt.route.value.envId : undefined;
const existing = computed(() => (editId.value ? dbt.jobs.value.find(j => j.id === editId.value) || null : null));
const deployEnvs = computed(() => dbt.envs.value.filter(e => e.type === 'deployment'));

const job = existing.value;
const name = ref(job?.name || '');
const description = ref(job?.description || '');
const envId = ref<number>(job?.environment_id || presetEnv
  || deployEnvs.value.find(e => e.deployment_type === 'production')?.id || deployEnvs.value[0]?.id || 0);
const steps = ref<string[]>(job ? [...job.execute_steps] : ['dbt build']);
const generateDocs = ref(job ? job.generate_docs : true);
const freshness = ref(job ? job.run_generate_sources : false);
const scheduled = ref(job ? job.triggers.schedule : false);
const initialCron = job?.schedule.cron || '0 6 * * *';
const mode = ref<'interval' | 'hours' | 'cron'>(job?.schedule.cron ? 'cron' : 'hours');
const every = ref(6);
const hours = ref('6');
const days = ref<number[]>([0, 1, 2, 3, 4, 5, 6]);
const cron = ref(initialCron);
const target = ref(job?.settings.target_name || '');
const threads = ref<number>(job?.settings.threads || 4);
const saving = ref(false);
const error = ref('');

const envTarget = computed(() => dbt.envs.value.find(e => e.id === envId.value)?.target_name || 'prod');

const cronValue = computed(() => {
  if (!scheduled.value) return '';
  if (mode.value === 'interval') return every.value >= 24 ? '0 0 * * *' : `0 ${every.value === 1 ? '*' : '*/' + every.value} * * *`;
  if (mode.value === 'hours') {
    const list = hours.value.split(',').map(h => h.trim()).filter(Boolean);
    if (!list.length || list.some(h => !/^\d{1,2}$/.test(h) || Number(h) > 23)) return '';
    const dow = days.value.length === 7 || !days.value.length ? '*' : [...days.value].sort().join(',');
    return `0 ${list.map(Number).join(',')} * * ${dow}`;
  }
  return cron.value.trim().split(/\s+/).join(' ');
});

const cleanSteps = computed(() => steps.value.map(s => s.trim().split(/\s+/).join(' ')).filter(Boolean));

const problem = computed(() => {
  if (!name.value.trim()) return 'Job name is required.';
  if (!envId.value) return 'Choose a deployment environment.';
  if (!cleanSteps.value.length) return 'Add at least one command.';
  const bad = cleanSteps.value.find(s => !/^dbt(\s|$)/.test(s));
  if (bad) return `"${bad}" must begin with dbt.`;
  if (scheduled.value && cronValue.value.split(' ').length !== 5) return 'Enter a valid schedule.';
  if (!(threads.value >= 1 && threads.value <= 64)) return 'Threads must be between 1 and 64.';
  return '';
});

function command(): string {
  const flags: Record<string, any> = {};
  if (existing.value) flags['--job-id'] = existing.value.id;
  flags['--name'] = name.value.trim();
  flags['--environment-id'] = envId.value;
  flags['--execute-steps'] = JSON.stringify(cleanSteps.value);
  flags['--settings-threads'] = threads.value;
  if (scheduled.value) {
    flags['--schedule-cron'] = cronValue.value;
    flags['--triggers-schedule'] = true;
  } else if (existing.value) {
    flags['--no-triggers-schedule'] = true;
  }
  if (generateDocs.value) flags['--generate-docs'] = true; else if (existing.value) flags['--no-generate-docs'] = true;
  if (freshness.value) flags['--run-generate-sources'] = true; else if (existing.value) flags['--no-run-generate-sources'] = true;
  const text: Record<string, string> = {};
  if (description.value.trim() || existing.value) text['--description'] = description.value.trim();
  if (target.value.trim() || existing.value) text['--settings-target-name'] = target.value.trim();
  return textFlag(['dbt-cloud', 'job', existing.value ? 'update' : 'create'], flags, text);
}

const preview = computed(() => (problem.value ? problem.value : command()));

async function save() {
  if (problem.value) return;
  saving.value = true;
  error.value = '';
  try {
    const result = await dbt.run(command(), { quiet: true });
    if (!result.ok) {
      const doc = parseJson<any>(result.error || result.output);
      error.value = doc?.status?.user_message || String(result.error || result.output || 'The request failed');
      return;
    }
    const doc = parseJson<any>(result.output);
    const id = Number(doc?.data?.id || existing.value?.id || 0);
    dbt.notify('success', existing.value ? 'Job saved' : 'Job created', name.value.trim());
    dbt.go(id ? { page: 'job', id } : { page: 'jobs' });
  } finally {
    saving.value = false;
  }
}

function cancel() {
  dbt.go(existing.value ? { page: 'job', id: existing.value.id } : { page: 'jobs' });
}
</script>

<style scoped src="./dbt.css"></style>
<style scoped>
.je-form { display: flex; flex-direction: column; gap: 16px; max-width: 760px; }
.je-two { flex-direction: row; flex-wrap: wrap; }
.je-two > .dbt-field { flex: 1 1 240px; }
.je-step { display: flex; align-items: center; gap: 8px; }
.je-step__n { width: 22px; height: 22px; border-radius: 50%; background: var(--dbt-tag); color: var(--dbt-ink-2); display: grid; place-items: center; font-size: 11px; font-weight: 600; flex: none; }
.je-days { display: flex; gap: 14px; flex-wrap: wrap; }
.je-preview { margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--dbt-ink-2); }
.dbt-help code { overflow-wrap: anywhere; white-space: normal; }
</style>
