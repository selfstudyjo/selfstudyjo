<template>
  <section>
    <ul class="list-unstyled">
      <li><strong>Event log directory:</strong> {{ eventLogDir }}</li>
      <li><strong>Last updated:</strong> {{ lastUpdated }}</li>
      <li><strong>Client local time zone:</strong> {{ zone }}</li>
    </ul>

    <div class="table-wrap">
      <table class="table table-bordered table-sm sortable" aria-label="Applications">
        <thead>
          <tr>
            <th>Version</th><th>App ID</th><th>App Name</th><th>Started</th><th v-if="!showIncomplete">Completed</th>
            <th>Duration</th><th>Spark User</th><th>Last Updated</th><th>Event Log</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="app in listed" :key="app.id">
            <td>{{ version }}</td>
            <td><a href="#" @click.prevent="$emit('navigate', { page: 'jobs', app: app.id })">{{ app.id }}</a></td>
            <td class="hist__name" :title="app.name">{{ app.name }}</td>
            <td class="hist__nowrap">{{ date(app.started) }}</td>
            <td v-if="!showIncomplete" class="hist__nowrap">{{ date(app.ended) }}</td>
            <td>{{ duration(app.durationMs) }}</td>
            <td>{{ app.user }}</td>
            <td class="hist__nowrap">{{ date(app.ended || app.started) }}</td>
            <td><a href="#" @click.prevent="downloadLog(app)">Download</a></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!listed.length" class="hist__none">
      {{ showIncomplete ? 'No incomplete applications found!' : 'No completed applications found!' }}
      <span v-if="!showIncomplete" class="spk-muted"><br />Did you specify the correct logging directory? Run a Spark SQL query below,
        or submit a job, and it appears here.</span>
    </p>
    <p><a href="#" @click.prevent="showIncomplete = !showIncomplete">{{ showIncomplete ? 'Back to completed applications' : 'Show incomplete applications' }}</a></p>

    <!-- The lab's addition: produce an application to inspect. -->
    <div class="hist__submit">
      <h4 class="spk-h4" @click="open = !open"><span :class="open ? 'arrow-open' : 'arrow-closed'"></span>
        <a href="#" @click.prevent>Submit an application to the cluster</a></h4>
      <div v-if="open" class="hist__panel">
        <p class="spk-muted">Not part of the real History Server: a lab shortcut that runs the same command you would
          type in the console, so there is an application to look at.</p>
        <div class="hist__modes">
          <label><input v-model="mode" type="radio" value="sql" /> Spark SQL query <code>spark-sql -e</code></label>
          <label><input v-model="mode" type="radio" value="submit" /> Job file <code>spark-submit</code></label>
        </div>
        <template v-if="mode === 'sql'">
          <textarea v-model="sql" class="form-control hist__sql" rows="4" spellcheck="false" aria-label="Spark SQL query"></textarea>
        </template>
        <template v-else>
          <select v-model="script" class="form-control hist__select" aria-label="Job file">
            <option value="" disabled>Choose a .py file from the lab workspace</option>
            <option v-for="file in scripts" :key="file" :value="file">{{ file }}</option>
          </select>
          <p v-if="!scripts.length" class="spk-muted">No .py file in this lab's workspace yet — write one with the Files tool.</p>
        </template>
        <p class="hist__cmd"><code>{{ command || ' ' }}</code></p>
        <button type="button" class="btn btn-primary" :disabled="busy || running || !command" @click="submit">
          {{ running ? 'Running…' : 'Run' }}
        </button>
        <div v-if="error" class="alert-danger hist__err">{{ error }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import { cli, errorText, pick } from '@/utils/portalKit';
import { date, duration, type SparkApp } from './spark';

const props = defineProps<{ view: Record<string, any>; apps: SparkApp[]; api: PortalApi; busy?: boolean }>();
const emit = defineEmits<{ (event: 'navigate', route: any): void }>();

const showIncomplete = ref(false);
const open = ref(true);
const mode = ref<'sql' | 'submit'>('sql');
const sql = ref('SELECT country, COUNT(*) AS orders FROM orders GROUP BY country ORDER BY orders DESC');
const script = ref('');
const running = ref(false);
const error = ref('');

const version = computed(() => String(pick(props.view, 'versions.spark', '3.5.1')));
const eventLogDir = computed(() => String(pick<Record<string, string>>(props.view,
  'ambari.configs.spark2-defaults.properties', {})['spark.eventLog.dir'] || 'hdfs:///spark2-history/'));
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const lastUpdated = computed(() => date(Math.max(0, ...props.apps.map(a => a.ended || a.started))) || date(Date.now()));
const listed = computed(() => props.apps.filter(a => (showIncomplete.value ? !a.completed : a.completed)));
const scripts = computed(() => pick<string[]>(props.view, 'local_files', []).filter(f => /\.py$/.test(f)));
const command = computed(() => {
  if (mode.value === 'sql') return sql.value.trim() ? cli(['spark-sql', '-e', sql.value.trim()]) : '';
  return script.value ? cli(['spark-submit'], { '--master': 'yarn', '--deploy-mode': 'client' }) + ' ' + cli([script.value]) : '';
});

async function submit() {
  error.value = '';
  running.value = true;
  try {
    const before = new Set(props.apps.map(a => a.id));
    const result = await props.api.exec(command.value, { quiet: true, success: 'Application finished' });
    if (!result.ok) {
      error.value = errorText(result);
      return;
    }
    const data = (result.data || {}) as Record<string, any>;
    const created = props.apps.find(a => !before.has(a.id));
    const id = String(data.app || created?.id || '');
    if (id) emit('navigate', { page: 'jobs', app: id });
  } finally {
    running.value = false;
  }
}

function downloadLog(app: SparkApp) {
  const lines = [
    JSON.stringify({ Event: 'SparkListenerLogStart', 'Spark Version': version.value }),
    JSON.stringify({ Event: 'SparkListenerApplicationStart', 'App Name': app.name, 'App ID': app.id, Timestamp: app.started, User: app.user }),
    ...app.jobs.map(j => JSON.stringify({ Event: 'SparkListenerJobStart', 'Job ID': j.jobId, 'Submission Time': j.submitted,
                                            'Stage IDs': j.stages.map(s => s.stageId) })),
    ...app.jobs.map(j => JSON.stringify({ Event: 'SparkListenerJobEnd', 'Job ID': j.jobId, 'Completion Time': j.submitted + j.durationMs,
                                            'Job Result': { Result: 'JobSucceeded' } })),
    JSON.stringify({ Event: 'SparkListenerApplicationEnd', Timestamp: app.ended || app.started }),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `eventLogs-${app.id}`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.hist__name { max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hist__nowrap { white-space: nowrap; }
.hist__none { font-size: 15px; }
.hist__submit { border-top: 1px solid #dee2e6; margin-top: 24px; }
.hist__panel { max-width: 860px; }
.hist__modes { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 8px; }
.hist__modes label { display: flex; align-items: center; gap: 6px; }
.hist__sql { font-family: SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
.hist__select { max-width: 420px; }
.hist__cmd { margin: 8px 0; word-break: break-all; }
.hist__err { margin-top: 10px; }
</style>
