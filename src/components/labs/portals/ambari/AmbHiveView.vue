<template>
  <div class="hv">
    <ul class="hv__nav">
      <li v-for="t in TABS" :key="t.id" :class="{ active: tab === t.id }">
        <a href="#" @click.prevent="$emit('navigate', { page: 'hive', tab: t.id })">{{ t.label }}</a>
      </li>
    </ul>

    <!-- QUERY -->
    <div v-if="tab === 'query'" class="hv__query">
      <aside class="hv__explorer">
        <label class="hv__label" for="hv-db">Database</label>
        <select id="hv-db" class="form-control" :value="current" :disabled="busy" @change="useDb(($event.target as HTMLSelectElement).value)">
          <option v-for="db in databases" :key="db" :value="db">{{ db }}</option>
        </select>
        <div class="hv__tables-head">
          <span>Tables ({{ dbTables.length }})</span>
          <input v-model="tableFilter" class="hv__mini" placeholder="Search tables" aria-label="Search tables" />
        </div>
        <ul class="hv__tree">
          <li v-for="t in shownTables" :key="t.name">
            <button type="button" class="hv__tnode" @click="toggleTable(t.name)">
              <AmbIcon :name="expanded.includes(t.name) ? 'caret' : 'chev-right'" :size="10" />
              <AmbIcon name="table" :size="13" /> <span>{{ t.name }}</span>
            </button>
            <ul v-if="expanded.includes(t.name)" class="hv__cols">
              <li v-for="col in columnsOf(t)" :key="col.name">
                <AmbIcon name="column" :size="11" /> {{ col.name }} <span class="hv__type">{{ String(col.type).toLowerCase() }}</span>
              </li>
              <li><a href="#" @click.prevent="insertSelect(t)">SELECT * FROM {{ t.name }}</a></li>
            </ul>
          </li>
          <li v-if="!shownTables.length" class="hv__none">No tables</li>
        </ul>
      </aside>

      <section class="hv__work">
        <div class="hv__sheets">
          <button v-for="(sheet, i) in sheets" :key="sheet.id" type="button" class="hv__sheet"
                  :class="{ active: i === active }" @click="active = i">
            {{ sheet.name }}
            <span v-if="sheets.length > 1" class="hv__sheet-x" role="button" aria-label="Close worksheet" @click.stop="closeSheet(i)">×</span>
          </button>
          <button type="button" class="hv__sheet hv__sheet-add" title="New Worksheet" @click="addSheet()">+</button>
        </div>
        <div class="hv__editor">
          <div class="hv__lines" aria-hidden="true"><span v-for="n in lineCount" :key="n">{{ n }}</span></div>
          <textarea v-model="sheet.sql" class="hv__sql" spellcheck="false" aria-label="Query editor"
                    @keydown.ctrl.enter.prevent="execute" @keydown.meta.enter.prevent="execute"></textarea>
        </div>
        <div class="hv__buttons">
          <button type="button" class="btn btn-success" :disabled="busy || running || !sheet.sql.trim()" @click="execute">
            <AmbIcon name="play" :size="11" />{{ running ? 'Executing' : 'Execute' }}
          </button>
          <button type="button" class="btn btn-default" :disabled="!sheet.sql.trim()" @click="openSave">Save As</button>
          <button type="button" class="btn btn-default" :disabled="busy || running || !sheet.sql.trim()" @click="explain">Visual Explain</button>
          <span class="hv__hint text-muted">Ctrl+Enter to execute</span>
        </div>

        <div class="hv__results">
          <ul class="hv__rtabs">
            <li :class="{ active: rtab === 'results' }"><a href="#" @click.prevent="rtab = 'results'">Results</a></li>
            <li :class="{ active: rtab === 'log' }"><a href="#" @click.prevent="rtab = 'log'">Log</a></li>
            <li :class="{ active: rtab === 'explain' }"><a href="#" @click.prevent="rtab = 'explain'">Visual Explain</a></li>
          </ul>
          <div v-if="rtab === 'results'" class="hv__rbody">
            <div v-if="sheet.error" class="alert alert-danger hv__err">{{ sheet.error }}</div>
            <template v-else-if="sheet.result && sheet.result.columns.length">
              <div class="hv__rbar">
                <input v-model="colFilter" class="form-control hv__mini2" placeholder="Filter columns" aria-label="Filter columns" />
                <span class="text-muted">{{ sheet.result.total }} row{{ sheet.result.total === 1 ? '' : 's' }}
                  <template v-if="sheet.result.truncated"> (first 1000 shown)</template>
                  · {{ (sheet.result.duration / 1000).toFixed(3) }} s</span>
                <span class="spacer"></span>
                <button type="button" class="btn btn-default btn-sm" @click="exportCsv">Export Data</button>
              </div>
              <div class="table-wrap hv__grid">
                <table class="table">
                  <thead><tr><th v-for="col in shownCols" :key="col.i">{{ col.name }}</th></tr></thead>
                  <tbody>
                    <tr v-for="(row, r) in pageRows" :key="r">
                      <td v-for="col in shownCols" :key="col.i" :class="{ 'hv__null': row[col.i] === null }" :title="row[col.i] === null ? undefined : String(row[col.i])">{{ row[col.i] === null ? 'NULL' : row[col.i] }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="pages > 1" class="hv__pager">
                <button type="button" class="btn btn-default btn-sm" :disabled="page === 0" @click="page--">Previous</button>
                <span>Page {{ page + 1 }} of {{ pages }}</span>
                <button type="button" class="btn btn-default btn-sm" :disabled="page >= pages - 1" @click="page++">Next</button>
              </div>
            </template>
            <div v-else-if="sheet.result" class="alert alert-success">{{ sheet.result.message }}</div>
            <div v-else class="empty">Execute a query to see its results here.</div>
          </div>
          <pre v-else-if="rtab === 'log'" class="hv__log">{{ sheet.log || 'No log yet.' }}</pre>
          <div v-else class="hv__rbody">
            <div v-if="!sheet.stages.length" class="empty">Run Visual Explain (or execute a query) to see its plan.</div>
            <div v-else class="hv__plan">
              <template v-for="(stage, i) in sheet.stages" :key="i">
                <div class="hv__vertex">
                  <strong>{{ stage.name }}</strong>
                  <span>{{ stage.tasks }} task{{ stage.tasks === 1 ? '' : 's' }}</span>
                  <span>{{ stage.duration_ms }} ms</span>
                  <span v-if="stage.shuffle_write_h && stage.shuffle_write_h !== '0B'">shuffle {{ stage.shuffle_write_h }}</span>
                </div>
                <span v-if="i < sheet.stages.length - 1" class="hv__edge">→</span>
              </template>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- JOBS -->
    <div v-else-if="tab === 'jobs'" class="panel table-wrap">
      <table class="table">
        <thead><tr><th>Job ID</th><th>Title</th><th>Status</th><th>Date Submitted</th><th>Duration</th><th></th></tr></thead>
        <tbody>
          <tr v-for="job in hiveJobs" :key="job.app + job.id">
            <td class="mono">{{ job.app }}</td>
            <td class="hv__desc" :title="job.description">{{ job.description }}</td>
            <td><span class="label" :class="job.status === 'SUCCEEDED' ? 'label-ok' : 'label-crit'">{{ job.status }}</span></td>
            <td>{{ shortStamp(job.submitted) }}</td>
            <td>{{ (job.duration_ms / 1000).toFixed(2) }} s</td>
            <td><a href="#" @click.prevent="reopen(job.description)">Open in worksheet</a></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!hiveJobs.length" class="empty">No jobs yet. Queries you execute appear here.</div>
    </div>

    <!-- TABLES -->
    <AmbHiveTables v-else-if="tab === 'tables'" :view="view" :api="api" :busy="busy" @query="reopen" />

    <!-- SAVED QUERIES -->
    <div v-else-if="tab === 'saved'" class="panel table-wrap">
      <table class="table">
        <thead><tr><th>Name</th><th>Database</th><th>Query</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="(q, i) in saved" :key="i">
            <td><strong>{{ q.name }}</strong></td><td>{{ q.db }}</td>
            <td class="mono hv__desc" :title="q.sql">{{ q.sql }}</td>
            <td class="hv__nowrap">
              <a href="#" @click.prevent="openSaved(q)">Open</a> ·
              <a href="#" @click.prevent="deleteSaved(i)">Delete</a>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!saved.length" class="empty">No saved queries. Use "Save As" in the worksheet.</div>
    </div>

    <!-- SETTINGS -->
    <div v-else class="panel">
      <div class="panel-heading"><h4>Settings</h4><span class="text-muted">Sent as SET statements before every query</span></div>
      <div class="panel-body">
        <div v-for="(s, i) in settings" :key="i" class="hv__setting">
          <input v-model="s.key" class="form-control mono" placeholder="hive.exec.parallel" aria-label="Setting name" />
          <input v-model="s.value" class="form-control mono" placeholder="true" aria-label="Setting value" />
          <button type="button" class="btn btn-default btn-sm" @click="settings.splice(i, 1)">Remove</button>
        </div>
        <button type="button" class="btn btn-default" @click="settings.push({ key: '', value: '' })"><AmbIcon name="plus" :size="11" />Add</button>
      </div>
    </div>

    <AmbModal v-if="saving" title="Save As" ok-text="Save" :ok-disabled="!saveName.trim()" small @close="saving = false" @ok="saveQuery">
      <div class="form-group">
        <label for="hv-save">Name</label>
        <input id="hv-save" v-model="saveName" class="form-control" @keydown.enter="saveQuery" />
      </div>
    </AmbModal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import { cli, errorText, pick, rows } from '@/utils/portalKit';
import { shortStamp, splitStatements } from './ambari';
import AmbIcon from './AmbIcon.vue';
import AmbModal from './AmbModal.vue';
import AmbHiveTables from './AmbHiveTables.vue';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; tab: string }>();
const emit = defineEmits<{ (event: 'navigate', route: any): void }>();

const TABS = [
  { id: 'query', label: 'Query' }, { id: 'jobs', label: 'Jobs' }, { id: 'tables', label: 'Tables' },
  { id: 'saved', label: 'Saved Queries' }, { id: 'settings', label: 'Settings' },
];

interface Sheet {
  id: number; name: string; sql: string; log: string; error: string;
  result: { columns: string[]; rows: unknown[][]; total: number; truncated: boolean; duration: number; message: string } | null;
  stages: any[];
}
let seq = 1;
const sheets = ref<Sheet[]>([newSheet('Worksheet1', 'SHOW TABLES;')]);
const active = ref(0);
const sheet = computed(() => sheets.value[active.value]);
const running = ref(false);
const rtab = ref('results');
const colFilter = ref('');
const page = ref(0);
const tableFilter = ref('');
const expanded = ref<string[]>([]);
const saving = ref(false);
const saveName = ref('');
const settings = reactive<{ key: string; value: string }[]>([]);
const STORE = 'sfs-ambari-hive-saved';
const saved = ref<{ name: string; sql: string; db: string }[]>(loadSaved());

function newSheet(name: string, sql = ''): Sheet {
  return { id: seq++, name, sql, log: '', error: '', result: null, stages: [] };
}
function addSheet(sql = '') {
  sheets.value.push(newSheet(`Worksheet${sheets.value.length + 1}`, sql));
  active.value = sheets.value.length - 1;
}
function closeSheet(i: number) {
  sheets.value.splice(i, 1);
  active.value = Math.min(active.value, sheets.value.length - 1);
}

const databases = computed(() => pick<string[]>(props.view, 'hive.databases', ['default']));
const current = computed(() => String(pick(props.view, 'hive.current', 'default')));
const tables = computed(() => rows(props.view, 'hive.tables'));
const dbTables = computed(() => tables.value.filter(t => t.db === current.value));
const shownTables = computed(() => dbTables.value.filter(t => String(t.name).toLowerCase()
  .includes(tableFilter.value.trim().toLowerCase())));
const lineCount = computed(() => Math.max(8, sheet.value.sql.split('\n').length));

function columnsOf(t: Record<string, any>) {
  return [...(t.columns || []), ...(t.partitioned_by || [])];
}
function toggleTable(name: string) {
  expanded.value = expanded.value.includes(name) ? expanded.value.filter(n => n !== name) : [...expanded.value, name];
}
function insertSelect(t: Record<string, any>) {
  sheet.value.sql = `SELECT * FROM ${t.name} LIMIT 100;`;
}

async function useDb(db: string) {
  if (db === current.value) return;
  await props.api.exec(cli(['USE', db]), { failure: 'Could not switch database' });
}

function settingStatements() {
  return settings.filter(s => s.key.trim()).map(s => `SET ${s.key.trim()}=${s.value.trim()}`);
}

async function runStatements(statements: string[]) {
  const target = sheet.value;
  running.value = true;
  target.error = '';
  target.result = null;
  page.value = 0;
  const log: string[] = [];
  try {
    for (const statement of [...settingStatements(), ...statements]) {
      log.push(`> ${statement}`);
      // A HiveQL statement is sent as the statement itself - what a student
      // types at a beeline prompt - never re-quoted.
      const result = await props.api.exec(statement, { quiet: true });
      const data = (result.data || {}) as Record<string, any>;
      if (Array.isArray(data.log)) log.push(...data.log);
      if (!result.ok) {
        target.error = errorText(result);
        log.push(String(result.error || result.output || ''));
        rtab.value = 'results';
        break;
      }
      if (!Array.isArray(data.log)) log.push(String(result.output || 'OK'));
      if (Array.isArray(data.columns) && data.columns.length) {
        target.result = { columns: data.columns, rows: data.rows || [], total: Number(data.total || 0),
                          truncated: Boolean(data.truncated), duration: Number(data.duration_ms || 0), message: '' };
      } else {
        target.result = { columns: [], rows: [], total: 0, truncated: false, duration: Number(data.duration_ms || 0),
                          message: `Query executed successfully: ${statement.split('\n')[0].slice(0, 80)}` };
      }
      if (data.job) {
        const job = rows(props.view, 'spark.jobs').find(j => j.id === data.job);
        if (job) target.stages = job.stages || [];
      }
    }
  } finally {
    target.log = log.join('\n');
    running.value = false;
  }
}

async function execute() {
  const statements = splitStatements(sheet.value.sql);
  if (!statements.length) return;
  rtab.value = 'results';
  await runStatements(statements);
}

async function explain() {
  const statements = splitStatements(sheet.value.sql);
  const last = statements[statements.length - 1] || '';
  rtab.value = 'explain';
  await runStatements([/^\s*explain\b/i.test(last) ? last : `EXPLAIN ${last}`]);
  rtab.value = 'explain';
}

const shownCols = computed(() => {
  const cols = (sheet.value.result?.columns || []).map((name, i) => ({ name, i }));
  const needle = colFilter.value.trim().toLowerCase();
  return needle ? cols.filter(c => c.name.toLowerCase().includes(needle)) : cols;
});
const PAGE = 50;
const pages = computed(() => Math.ceil((sheet.value.result?.rows.length || 0) / PAGE));
const pageRows = computed(() => (sheet.value.result?.rows || []).slice(page.value * PAGE, page.value * PAGE + PAGE) as unknown[][]);

function exportCsv() {
  const r = sheet.value.result;
  if (!r) return;
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [r.columns.map(esc).join(','), ...r.rows.map(row => row.map(esc).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'results.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const hiveJobs = computed(() => rows(props.view, 'spark.jobs').filter(j => j.engine === 'hive'));

function reopen(sql: string) {
  addSheet(sql.endsWith(';') ? sql : `${sql};`);
  emit('navigate', { page: 'hive', tab: 'query' });
}

function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(saved.value)); } catch { /* storage refused */ }
}
function openSave() {
  saveName.value = sheet.value.name;
  saving.value = true;
}
function saveQuery() {
  if (!saveName.value.trim()) return;
  saved.value = [{ name: saveName.value.trim(), sql: sheet.value.sql, db: current.value }, ...saved.value];
  sheet.value.name = saveName.value.trim();
  persist();
  saving.value = false;
  props.api.notify('success', `Query "${saveName.value.trim()}" saved`);
}
function openSaved(q: { name: string; sql: string }) {
  addSheet(q.sql);
  sheet.value.name = q.name;
  emit('navigate', { page: 'hive', tab: 'query' });
}
function deleteSaved(i: number) {
  saved.value = saved.value.filter((_, index) => index !== i);
  persist();
}

watch(colFilter, () => { page.value = 0; });
</script>

<style scoped>
.hv { display: flex; flex-direction: column; gap: 14px; min-height: 100%; }
.hv__nav { display: flex; list-style: none; margin: 0; padding: 0; background: #fff; border-bottom: 1px solid #ddd; box-shadow: 0 1px 1px rgba(51,51,51,.1); flex-wrap: nowrap; overflow-x: auto; }
.hv .hv__nav a { display: block; padding: 13px 20px; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: .4px; border-bottom: 3px solid transparent; text-decoration: none; white-space: nowrap; }
.hv .hv__nav a:hover { color: #333; text-decoration: none; }
.hv .hv__nav .active a { color: #333; border-bottom-color: #3FAE2A; }
.hv__query { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 14px; flex: 1; min-height: 0; }
.hv__explorer { background: #fff; border: 1px solid #e3e3e3; padding: 12px; overflow: auto; max-height: 100%; }
.hv__label { font-size: 12px; text-transform: uppercase; color: #666; font-weight: 700; display: block; margin-bottom: 6px; }
.hv__tables-head { display: flex; flex-direction: column; gap: 6px; margin: 14px 0 6px; font-size: 12px; text-transform: uppercase; color: #666; font-weight: 700; }
.hv__mini { height: 28px; border: 1px solid #ccc; border-radius: 3px; padding: 0 8px; font: inherit; font-size: 12px; text-transform: none; font-weight: 400; background: #fff; color: #555; min-width: 0; }
.hv__tree, .hv__cols { list-style: none; margin: 0; padding: 0; }
.hv__tnode { display: flex; align-items: center; gap: 5px; width: 100%; border: 0; background: none; padding: 4px 2px; font: inherit; font-size: 13px; color: #333; cursor: pointer; text-align: left; }
.hv__tnode:hover { background: #f5f5f5; }
.hv__tnode span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hv__cols { padding-left: 26px; font-size: 12px; color: #555; }
.hv__cols li { padding: 2px 0; }
.hv__cols a { display: inline-block; line-height: 20px; }
.hv__type { color: #707070; margin-left: 4px; }
.hv__none { color: #707070; font-size: 12px; padding: 6px 0; }
.hv__work { display: flex; flex-direction: column; min-width: 0; gap: 10px; }
.hv__sheets { display: flex; gap: 2px; flex-wrap: wrap; }
.hv__sheet { border: 1px solid #ddd; border-bottom: 0; background: #e8e8e8; color: #555; padding: 7px 14px; min-height: 32px; font: inherit; font-size: 13px; cursor: pointer; display: flex; gap: 8px; align-items: center; }
.hv__sheet.active { background: #fff; color: #333; font-weight: 500; }
.hv__sheet-x { color: #707070; font-size: 16px; line-height: 20px; width: 20px; height: 20px; text-align: center; border-radius: 2px; margin-right: -6px; }
.hv__sheet-x:hover { background: #ddd; color: #333; }
.hv__sheet-add { font-weight: 700; }
.hv__editor { display: flex; border: 1px solid #ddd; background: #fff; min-height: 180px; height: 200px; resize: vertical; overflow: hidden; margin-top: -10px; }
.hv__lines { background: #f7f7f7; border-right: 1px solid #e5e5e5; color: #707070; font: 12px/18px Menlo, Consolas, monospace; padding: 8px 6px; text-align: right; display: flex; flex-direction: column; min-width: 28px; overflow: hidden; user-select: none; }
.hv__sql { flex: 1; border: 0; outline: 0; resize: none; font: 13px/18px Menlo, Consolas, monospace; padding: 8px 10px; color: #333; white-space: pre; overflow: auto; }
.hv__buttons { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.hv__hint { font-size: 12px; }
.hv__results { background: #fff; border: 1px solid #e3e3e3; flex: 1; display: flex; flex-direction: column; min-height: 220px; }
.hv__rtabs { display: flex; list-style: none; margin: 0; padding: 0 10px; border-bottom: 1px solid #ddd; overflow-x: auto; scrollbar-width: none; }
.hv .hv__rtabs a { display: block; padding: 10px 14px; color: #666; font-size: 12px; text-transform: uppercase; border-bottom: 3px solid transparent; text-decoration: none; white-space: nowrap; }
.hv .hv__rtabs .active a { color: #333; border-bottom-color: #3FAE2A; }
.hv__rbody { padding: 12px; overflow: auto; flex: 1; }
.hv__rbar { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; font-size: 12px; }
.hv__rbar .spacer { flex: 1; }
.hv__mini2 { width: 200px; max-width: 100%; height: 30px; }
.hv__grid { max-height: 360px; overflow: auto; border: 1px solid #eee; }
.hv__grid th { position: sticky; top: 0; background: #f5f5f5; }
.hv__grid td { white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
.hv__null { color: #767676; font-style: italic; }
.hv__pager { display: flex; gap: 10px; align-items: center; justify-content: flex-end; margin-top: 10px; font-size: 13px; }
.hv__err { white-space: pre-wrap; font-family: Menlo, Consolas, monospace; font-size: 12px; }
.hv__log { margin: 0; padding: 12px; font-size: 12px; white-space: pre-wrap; overflow: auto; flex: 1; background: #fafafa; }
.hv__plan { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px; }
.hv__vertex { border: 2px solid #41bfae; border-radius: 4px; padding: 10px 14px; display: flex; flex-direction: column; font-size: 12px; color: #555; background: #f3fbf9; min-width: 120px; }
.hv__vertex strong { color: #333; font-size: 13px; }
.hv__edge { font-size: 22px; color: #707070; }
.hv__desc { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hv__nowrap { white-space: nowrap; }
.hv__setting { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; margin-bottom: 8px; }
@container sl-portal (max-width: 820px) {
  .hv__query { grid-template-columns: minmax(0, 1fr); }
  .hv__explorer { max-height: 220px; }
}
@container sl-portal (max-width: 560px) {
  .hv__setting { grid-template-columns: minmax(0, 1fr); padding-bottom: 8px; border-bottom: 1px solid #eee; }
  .hv__setting .btn { justify-self: start; }
  .hv__desc { max-width: 220px; }
  .hv__nav { flex-wrap: wrap; }
  .hv .hv__nav a { padding: 11px 12px; }
}
</style>
