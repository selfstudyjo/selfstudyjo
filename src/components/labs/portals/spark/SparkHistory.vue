<template>
  <section>
    <ul class="list-unstyled">
      <li><strong>Event log directory:</strong> {{ eventLogDir }}</li>
      <li><strong>Last updated:</strong> {{ lastUpdated }}</li>
      <li><strong>Client local time zone:</strong> {{ zone }}</li>
    </ul>

    <div class="hist__bar">
      <span class="spk-muted">{{ sorted.length }} application{{ sorted.length === 1 ? '' : 's' }}</span>
      <span class="hist__spacer"></span>
      <label>Search: <input v-model="search" class="hist__search" aria-label="Search applications" /></label>
    </div>
    <div class="table-wrap">
      <table class="table table-bordered table-sm sortable" aria-label="Applications">
        <thead>
          <tr>
            <th>Version</th>
            <th class="is-sortable" @click="sortBy('id')">App ID {{ arrow('id') }}</th>
            <th class="is-sortable" @click="sortBy('name')">App Name {{ arrow('name') }}</th>
            <th class="is-sortable" @click="sortBy('started')">Started {{ arrow('started') }}</th>
            <th v-if="!showIncomplete" class="is-sortable" @click="sortBy('ended')">Completed {{ arrow('ended') }}</th>
            <th class="is-sortable" @click="sortBy('durationMs')">Duration {{ arrow('durationMs') }}</th>
            <th class="is-sortable" @click="sortBy('user')">Spark User {{ arrow('user') }}</th><th>Last Updated</th><th>Event Log</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="app in sorted" :key="app.id">
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
    <p v-if="listed.length && !sorted.length" class="spk-muted">No applications match "{{ search }}".</p>
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
          <div class="hist__opts">
            <label>--name <input v-model="appName" class="form-control" placeholder="(the file name)" /></label>
            <label>--num-executors <input v-model="numExecutors" class="form-control" placeholder="2" inputmode="numeric" /></label>
            <label>--executor-memory <input v-model="executorMemory" class="form-control" placeholder="2g" /></label>
            <label>--executor-cores <input v-model="executorCores" class="form-control" placeholder="2" inputmode="numeric" /></label>
          </div>
          <div class="hist__confs">
            <div v-for="(c, i) in confs" :key="i" class="hist__conf">
              <span class="spk-muted">--conf</span>
              <input v-model="c.key" class="form-control" placeholder="spark.sql.shuffle.partitions" aria-label="Conf key" />
              <span>=</span>
              <input v-model="c.value" class="form-control" placeholder="8" aria-label="Conf value" />
              <button type="button" class="btn btn-secondary btn-sm" @click="confs.splice(i, 1)">Remove</button>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" @click="confs.push({ key: '', value: '' })">Add --conf</button>
          </div>
          <p v-if="optionError" class="alert-danger hist__err">{{ optionError }}</p>
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
const appName = ref('');
const numExecutors = ref('');
const executorMemory = ref('');
const executorCores = ref('');
const confs = ref<{ key: string; value: string }[]>([]);
const search = ref('');
const sortKey = ref<'id' | 'name' | 'started' | 'ended' | 'durationMs' | 'user'>('started');
const sortDir = ref<'asc' | 'desc'>('desc');
function sortBy(key: typeof sortKey.value) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'desc'; }
}
function arrow(key: string) {
  return sortKey.value === key ? (sortDir.value === 'asc' ? '▴' : '▾') : '';
}
const optionError = computed(() => {
  if (numExecutors.value.trim() && !/^\d+$/.test(numExecutors.value.trim())) return '--num-executors takes a whole number';
  if (executorCores.value.trim() && !/^\d+$/.test(executorCores.value.trim())) return '--executor-cores takes a whole number';
  if (executorMemory.value.trim() && !/^\d+[kmgt]?b?$/i.test(executorMemory.value.trim())) return '--executor-memory takes a size such as 2g or 512m';
  if (confs.value.some(c => c.key.trim() && !/^spark\.[\w.-]+$/.test(c.key.trim()))) return 'A --conf key looks like spark.something';
  return '';
});
const running = ref(false);
const error = ref('');

const version = computed(() => String(pick(props.view, 'versions.spark', '3.5.1')));
const eventLogDir = computed(() => String(pick<Record<string, string>>(props.view,
  'ambari.configs.spark2-defaults.properties', {})['spark.eventLog.dir'] || 'hdfs:///spark2-history/'));
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const lastUpdated = computed(() => date(Math.max(0, ...props.apps.map(a => a.ended || a.started))) || date(Date.now()));
const listed = computed(() => props.apps.filter(a => (showIncomplete.value ? !a.completed : a.completed)));
const sorted = computed(() => {
  const needle = search.value.trim().toLowerCase();
  const list = needle ? listed.value.filter(a => [a.id, a.name, a.user].some(v => String(v).toLowerCase().includes(needle)))
    : listed.value;
  const key = sortKey.value;
  return [...list].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return sortDir.value === 'asc' ? order : -order;
  });
});
const scripts = computed(() => pick<string[]>(props.view, 'local_files', []).filter(f => /\.py$/.test(f)));
const command = computed(() => {
  if (mode.value === 'sql') return sql.value.trim() ? cli(['spark-sql', '-e', sql.value.trim()]) : '';
  if (!script.value || optionError.value) return '';
  const conf = confs.value.filter(c => c.key.trim()).map(c => `${c.key.trim()}=${c.value.trim()}`);
  return cli(['spark-submit'], {
    '--master': 'yarn', '--deploy-mode': 'client', '--name': appName.value.trim() || null,
    '--num-executors': numExecutors.value.trim() || null, '--executor-memory': executorMemory.value.trim() || null,
    '--executor-cores': executorCores.value.trim() || null,
  }) + conf.map(c => ' ' + cli(['--conf', c])).join('') + ' ' + cli([script.value]);
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
.hist__name { max-width: min(380px, 45cqw); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hist__nowrap { white-space: nowrap; }
.hist__none { font-size: 15px; }
.hist__submit { border-top: 1px solid #dee2e6; margin-top: 24px; }
.hist__panel { max-width: 860px; }
.hist__modes { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 8px; }
.hist__modes label { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.hist__modes input[type='radio'] { accent-color: #007bff; width: 15px; height: 15px; margin: 0; }
.hist__sql { font-family: SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
.hist__select { max-width: 420px; }
.hist__cmd { margin: 8px 0; word-break: break-all; }
.hist__err { margin-top: 10px; }
.hist__bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; margin-bottom: 6px; }
.hist__spacer { flex: 1; }
.hist__search { border: 1px solid #ced4da; border-radius: 3px; padding: 2px 6px; font: inherit; font-size: 13px; width: 180px; background: #fff; color: #212529; }
th.is-sortable { cursor: pointer; user-select: none; }
th.is-sortable:hover { background: #eef5fb; }
.hist__opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr)); gap: 8px; margin: 10px 0; }
.hist__opts label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; font-family: SFMono-Regular, Menlo, Consolas, monospace; }
.hist__confs { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; margin-bottom: 8px; }
.hist__conf { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; width: 100%; }
.hist__conf .form-control { flex: 1 1 160px; min-width: 0; }
</style>
