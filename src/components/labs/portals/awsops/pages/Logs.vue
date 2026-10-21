<template>
  <!-- Log groups -->
  <div v-if="page === 'log-groups'" @contextmenu="onRowMenu">
    <CsTable variant="full-page" title="Log groups" :items="groups" :columns="cols" track-by="name" selection-type="multi"
             v-model:selected="sel" filter-placeholder="Filter log groups or try prefix search"
             description="By default, we only load up to 50 log groups." empty-title="No log groups">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Log groups refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="groupActions" :disabled="!sel.length" @select="groupAct" />
        <button type="button" class="cs-btn" :disabled="!sel.length" @click="toInsights(sel)">View in Logs Insights</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="openCreate">Create log group</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" :data-row="row.name" @click.prevent="ctx.to('cloudwatch', 'log-group', { name: row.name })">{{ row.name }}</a></template>
      <template #cell-retentionText="{ row }">{{ retentionText(row.retention) }}</template>
      <template #cell-storedText="{ row }">{{ bytes(row.stored) }}</template>
    </CsTable>
  </div>

  <!-- One log group -->
  <div v-else-if="page === 'log-group' && group">
    <CsHeader :title="group.name">
      <template #actions>
        <CsDropdown :items="[{ id: 'retention', text: 'Edit retention setting' }, { id: 'delete', text: 'Delete log group' }, { id: 'copy', text: 'Copy ARN' }]" @select="oneAct" />
        <button type="button" class="cs-btn" @click="toInsights([group.name])">View in Logs Insights</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="tab = 'Search all log streams'">Search log group</button>
      </template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Log group details" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Log class</dt><dd>Standard</dd></div>
        <div><dt>Retention</dt><dd>{{ retentionText(group.retention) }}</dd></div>
        <div><dt>Stored bytes</dt><dd>{{ bytes(group.stored) }}</dd></div>
        <div><dt>Creation time</dt><dd>{{ group.created }}</dd></div>
        <div><dt>KMS key ID</dt><dd>{{ group.kms || '-' }}</dd></div>
        <div><dt>ARN</dt><dd class="cs-mono">{{ arnOf(group.name) }}</dd></div>
      </dl></div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in ['Log streams', 'Search all log streams']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <template v-if="tab === 'Log streams'">
      <CsTable v-if="!stream" title="Log streams" :items="group.streams" :columns="streamCols" track-by="name" filter-placeholder="Filter log streams"
               empty-title="No log streams" empty-text="Nothing has written to this log group yet.">
        <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="stream = row.name">{{ row.name }}</a></template>
      </CsTable>
      <section v-else class="cs-container">
        <div class="cs-container__head"><CsHeader :title="`Log events: ${stream}`" :level="2" :info="false">
          <template #actions><button type="button" class="cs-btn" @click="stream = ''">Back to log streams</button></template></CsHeader></div>
        <div class="cs-container__body"><LogEvents :events="group.events.filter((e: any) => e.stream === stream)" /></div>
      </section>
    </template>
    <section v-else class="cs-container">
      <div class="cs-container__body cs-stack">
        <form class="lg__search" @submit.prevent="search">
          <input v-model="pattern" class="cs-input" placeholder="Filter events - press enter to search" aria-label="Filter pattern" />
          <button type="submit" class="cs-btn" :disabled="busy">Search</button>
        </form>
        <span class="cs-constraint">Terms must all appear in the message; prefix a term with - to exclude it; quote a phrase. Example: <span class="cs-mono">ERROR -Settlement</span></span>
        <LogEvents v-if="found" :events="found" />
      </div>
    </section>
  </div>

  <!-- Logs Insights -->
  <div v-else-if="page === 'insights'" class="lg__ins">
    <CsHeader title="Logs Insights" description="Interactively search and analyze your log data with a purpose-built query language." />
    <div class="cs-split lg__split">
      <div>
        <section class="cs-container">
          <div class="cs-container__body cs-stack">
            <div class="cs-field" style="max-width: none">
              <span class="cs-label">Select log groups</span>
              <div class="lg__chips">
                <span v-for="g in picked" :key="g" class="lg__chip">{{ g }}<button type="button" :aria-label="`Remove ${g}`" @click="picked = picked.filter(x => x !== g)">×</button></span>
                <select class="cs-select lg__add" aria-label="Add a log group" value="" @change="addGroup(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
                  <option value="">Select log groups ({{ picked.length }}/50)</option>
                  <option v-for="g in groups.filter(x => !picked.includes(x.name))" :key="g.name" :value="g.name">{{ g.name }}</option>
                </select>
              </div>
            </div>
            <div class="lg__bar">
              <div class="lg__range" role="group" aria-label="Time range">
                <button v-for="r in RANGES" :key="r" type="button" :class="{ 'is-on': range === r }" @click="range = r">{{ r }}</button>
              </div>
            </div>
            <div class="lg__editor">
              <div class="lg__gutter" aria-hidden="true"><span v-for="n in lineCount" :key="n">{{ n }}</span></div>
              <textarea v-model="query" class="lg__code" spellcheck="false" aria-label="Query" @keydown.ctrl.enter.prevent="runQuery" @keydown.meta.enter.prevent="runQuery" />
            </div>
            <div class="cs-row">
              <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !picked.length || !query.trim()" @click="runQuery">
                <span v-if="busy" class="cs-btn__spinner" aria-hidden="true" />Run query</button>
              <button type="button" class="cs-btn" :disabled="busy" @click="query = DEFAULT_QUERY">Reset</button>
              <span class="cs-muted">Ctrl + Enter runs the query</span>
            </div>
            <div v-if="queryError" class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" /><div><strong>Query failed</strong>{{ queryError }}</div></div>
          </div>
        </section>
        <section v-if="result" class="cs-container">
          <div class="cs-container__head"><CsHeader title="Logs" :level="2" :info="false"
            :description="`Showing ${result.rows.length} of ${result.matched} records matched · ${result.scanned} records scanned`">
            <template #actions><button type="button" class="cs-btn" :disabled="!result.rows.length" @click="exportCsv">Export results</button></template></CsHeader></div>
          <div class="cs-container__body cs-scroll-x">
            <table class="cs-table-mini lg__results">
              <thead><tr><th>#</th><th v-for="f in result.fields" :key="f">{{ f }}</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in result.rows" :key="i"><td class="cs-muted">{{ i + 1 }}</td>
                  <td v-for="(cell, j) in r" :key="j" :class="{ 'cs-mono': true }">{{ cell }}</td></tr>
                <tr v-if="!result.rows.length"><td :colspan="result.fields.length + 1" class="cs-empty"><strong>No data found.</strong>Try adjusting the query or the log groups.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <aside>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Sample queries" :level="2" :info="false" /></div>
          <div class="cs-container__body lg__samples">
            <button v-for="s in SAMPLES" :key="s.title" type="button" class="lg__sample" @click="query = s.query">
              <strong>{{ s.title }}</strong><code>{{ s.query }}</code></button>
          </div>
        </section>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Query history" :level="2" :info="false" /></div>
          <div class="cs-container__body lg__samples">
            <span v-if="!queries.length" class="cs-muted">No queries run yet.</span>
            <button v-for="q in queries" :key="q.id" type="button" class="lg__sample" @click="loadQuery(q)">
              <strong>{{ q.time }} · {{ q.groups.join(', ') }}</strong><code>{{ q.query }}</code></button>
          </div>
        </section>
      </aside>
    </div>
  </div>
  <NotFound v-else what="Log group" :id="ctx.route.value.params?.name || ''" back="log-groups" />

  <!-- Create log group -->
  <CsModal v-if="creating" title="Create log group" @close="creating = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label" for="lg-name">Log group name</label>
        <input id="lg-name" v-model.trim="cf.name" class="cs-input" :class="{ 'is-invalid': tried && nameProblem }" placeholder="/acme/my-app" />
        <span v-if="tried && nameProblem" class="cs-error-text">{{ nameProblem }}</span>
        <span class="cs-constraint">Up to 512 characters: letters, numbers, and . - _ / #</span></div>
      <div class="cs-field"><label class="cs-label" for="lg-ret">Retention setting</label>
        <select id="lg-ret" v-model="cf.retention" class="cs-select"><option value="">Never expire</option>
          <option v-for="d in RETENTIONS" :key="d" :value="String(d)">{{ retentionText(d) }}</option></select></div>
      <div class="cs-field"><label class="cs-label" for="lg-kms">KMS key ARN <small>- optional</small></label>
        <input id="lg-kms" v-model.trim="cf.kms" class="cs-input" placeholder="arn:aws:kms:..." /></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="creating = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Create</button>
    </template>
  </CsModal>

  <CsModal v-if="retaining.length" title="Edit retention setting" @close="retaining = []">
    <div class="cs-stack">
      <p class="lg__p">Log groups: <span class="cs-mono">{{ retaining.join(', ') }}</span></p>
      <div class="cs-field"><label class="cs-label" for="lg-ret2">Expire events after</label>
        <select id="lg-ret2" v-model="retention" class="cs-select"><option value="">Never expire</option>
          <option v-for="d in RETENTIONS" :key="d" :value="String(d)">{{ retentionText(d) }}</option></select></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="retaining = []">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveRetention">Save</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting.length" :title="deleting.length === 1 ? 'Delete log group' : `Delete ${deleting.length} log groups`" word="delete" :busy="busy"
            @close="deleting = []" @confirm="remove">
    <p class="lg__p">Deleting a log group permanently deletes all the archived log events associated with it: <span class="cs-mono">{{ deleting.join(', ') }}</span></p>
  </CsDelete>

  <RowMenu v-if="rm.menu.value" :x="rm.menu.value.x" :y="rm.menu.value.y" :title="rm.menu.value.key" :items="menuItems"
           @select="menuAct" @close="rm.close" />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsTable from '../../aws/CsTable.vue';
import RowMenu from '../RowMenu.vue';
import { useOps } from '../ctx';
import { copyText, downloadText, useRowMenu, type MenuItem } from '../rowmenu';
import LogEvents from './LogEvents.vue';
import NotFound from './NotFound.vue';

const RETENTIONS = [1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653];
const RANGES = ['5m', '30m', '1h', '3h', '12h', 'Custom'];
const DEFAULT_QUERY = 'fields @timestamp, @message, @logStream\n| sort @timestamp desc\n| limit 20';
const SAMPLES = [
  { title: '25 most recent events', query: 'fields @timestamp, @message\n| sort @timestamp desc\n| limit 25' },
  { title: 'Errors in the payments API', query: "fields @timestamp, @logStream, @message\n| filter level = 'ERROR'\n| sort @timestamp desc\n| limit 20" },
  { title: 'Error count by instance', query: "filter level = 'ERROR'\n| stats count(*) as errors by instance\n| sort errors desc" },
  { title: 'Health check latency', query: 'filter @message like /GET \\/health/\n| stats avg(latency) as avg_ms, max(latency) as max_ms by instance' },
  { title: 'Windows warnings and errors', query: "fields @timestamp, instance, source, @message\n| filter level != 'Information'\n| sort @timestamp desc" },
  { title: 'API calls by event name', query: 'stats count(*) as calls by eventName\n| sort calls desc\n| limit 10' },
];

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const busy = computed(() => ctx.busy.value);
const sel = ref<string[]>([]);
const all = computed(() => rows<any>(ctx.c.value, 'logs.groups'));
const groups = computed(() => all.value.map(g => ({ ...g, cls: 'Standard', retentionText: retentionText(g.retention), storedText: g.stored })));
const group = computed<any>(() => all.value.find(g => g.name === ctx.route.value.params?.name) || null);
const queries = computed(() => rows<any>(ctx.c.value, 'logs.queries'));
const cols = [
  { id: 'name', header: 'Log group', sortKey: 'name' }, { id: 'cls', header: 'Log class' },
  { id: 'retentionText', header: 'Retention', sortKey: 'retention' }, { id: 'storedText', header: 'Stored bytes', sortKey: 'stored' },
];
const streamCols = [{ id: 'name', header: 'Log stream', sortKey: 'name' }, { id: 'last', header: 'Last event time', sortKey: 'last' },
  { id: 'count', header: 'Events', sortKey: 'count' }];
const groupActions = computed(() => [
  { id: 'retention', text: 'Edit retention setting(s)' }, { id: 'delete', text: 'Delete log group(s)' },
]);

function retentionText(days: number | null | undefined) {
  if (!days) return 'Never expire';
  if (days % 365 === 0 || [731, 1096, 1827, 2192, 2557, 2922, 3288, 3653].includes(days)) {
    const years = Math.round(days / 365.25);
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  if (days >= 30 && days % 30 === 0) return `${days / 30} month${days === 30 ? '' : 's'}`;
  if (days === 545) return '18 months';
  if (days === 400) return '13 months';
  return `${days} day${days === 1 ? '' : 's'}`;
}
function bytes(n: number) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
function arnOf(name: string) { return `arn:aws:logs:${ctx.home.value}:${ctx.account.value}:log-group:${name}:*`; }
async function copy(text: string) {
  const ok = await copyText(text);
  ctx.api.notify(ok ? 'success' : 'error', ok ? 'Copied to clipboard' : 'Could not copy to the clipboard');
}

// ---- create / retention / delete ----
const creating = ref(false);
const tried = ref(false);
const cf = reactive({ name: '', retention: '', kms: '' });
const nameProblem = computed(() => {
  if (!cf.name) return 'Log group name is required.';
  if (!/^[\w./#-]{1,512}$/.test(cf.name)) return 'Use only letters, numbers, and . - _ / #';
  if (all.value.some(g => g.name === cf.name)) return 'A log group with this name already exists.';
  return '';
});
function openCreate() { cf.name = ''; cf.retention = ''; cf.kms = ''; tried.value = false; creating.value = true; }
async function create() {
  tried.value = true;
  if (nameProblem.value) return;
  const made = await ctx.run(cli(['aws', 'logs', 'create-log-group'], { '--log-group-name': cf.name, '--kms-key-id': cf.kms }));
  if (!made.ok) return;
  if (cf.retention) {
    await ctx.run(cli(['aws', 'logs', 'put-retention-policy'], { '--log-group-name': cf.name, '--retention-in-days': cf.retention }));
  }
  ctx.api.notify('success', `Log group "${cf.name}" has been created.`);
  creating.value = false;
}
const retaining = ref<string[]>([]);
const retention = ref('');
async function saveRetention() {
  const names = retaining.value;
  let ok = true;
  for (const name of names) {
    const result = await ctx.run(retention.value
      ? cli(['aws', 'logs', 'put-retention-policy'], { '--log-group-name': name, '--retention-in-days': retention.value })
      : cli(['aws', 'logs', 'delete-retention-policy'], { '--log-group-name': name }));
    ok = ok && result.ok;
  }
  if (ok) { ctx.api.notify('success', `Retention updated for ${names.length} log group${names.length === 1 ? '' : 's'}.`); retaining.value = []; }
}
const deleting = ref<string[]>([]);
async function remove() {
  const names = deleting.value;
  let ok = true;
  for (const name of names) {
    const result = await ctx.run(cli(['aws', 'logs', 'delete-log-group'], { '--log-group-name': name }));
    ok = ok && result.ok;
  }
  deleting.value = [];
  sel.value = [];
  if (ok) {
    ctx.api.notify('success', `Deleted ${names.length} log group${names.length === 1 ? '' : 's'}.`);
    if (page.value === 'log-group') ctx.to('cloudwatch', 'log-groups');
  }
}
function groupAct(action: string) {
  if (action === 'retention') { retaining.value = [...sel.value]; retention.value = String(all.value.find(g => g.name === sel.value[0])?.retention || ''); }
  if (action === 'delete') deleting.value = [...sel.value];
}
async function oneAct(action: string) {
  if (!group.value) return;
  if (action === 'retention') { retaining.value = [group.value.name]; retention.value = String(group.value.retention || ''); }
  if (action === 'delete') deleting.value = [group.value.name];
  if (action === 'copy') await copy(arnOf(group.value.name));
}

// ---- right-click ----
const rm = useRowMenu();
const menuItems = computed<MenuItem[]>(() => [
  { id: 'open', text: 'View log group' }, { id: 'insights', text: 'View in Logs Insights' },
  { id: 'retention', text: 'Edit retention setting' }, { id: 'd1', divider: true },
  { id: 'copy-name', text: 'Copy name' }, { id: 'copy-arn', text: 'Copy ARN' }, { id: 'd2', divider: true },
  { id: 'delete', text: 'Delete log group', danger: true },
]);
function onRowMenu(event: MouseEvent) { rm.open(event, key => { sel.value = [key]; }); }
async function menuAct(action: string) {
  const name = rm.menu.value?.key || sel.value[0];
  if (!name) return;
  if (action === 'open') ctx.to('cloudwatch', 'log-group', { name });
  else if (action === 'insights') toInsights([name]);
  else if (action === 'retention') { retaining.value = [name]; retention.value = String(all.value.find(g => g.name === name)?.retention || ''); }
  else if (action === 'copy-name') await copy(name);
  else if (action === 'copy-arn') await copy(arnOf(name));
  else if (action === 'delete') deleting.value = [name];
}

// ---- one group: streams and search ----
const tab = ref('Log streams');
const stream = ref('');
const pattern = ref('');
const found = ref<any[] | null>(null);
async function search() {
  if (!group.value) return;
  const result = await ctx.run(cli(['aws', 'logs', 'filter-log-events'], {
    '--log-group-name': group.value.name, '--filter-pattern': pattern.value.trim(),
  }), '', { quiet: true });
  if (!result.ok) { ctx.api.notify('error', 'Search failed', String(result.error || '')); return; }
  const events = parseJson<any>(result.output)?.events || [];
  found.value = events.map((e: any) => ({ time: e.timestamp, stream: e.logStreamName, message: e.message }));
}

// ---- Logs Insights ----
const picked = ref<string[]>([]);
const range = ref('1h');
const query = ref(DEFAULT_QUERY);
const queryError = ref('');
const result = ref<{ fields: string[]; rows: string[][]; matched: number; scanned: number } | null>(null);
const lineCount = computed(() => Math.max(3, query.value.split('\n').length));
watch(() => ctx.route.value, r => {
  if (r.page !== 'insights') return;
  const wanted = String(r.params?.groups || '').split(',').filter(Boolean);
  picked.value = wanted.length ? wanted : (picked.value.length ? picked.value : (all.value[0] ? [all.value[0].name] : []));
}, { immediate: true });
function addGroup(name: string) { if (name && !picked.value.includes(name)) picked.value = [...picked.value, name]; }
function toInsights(names: string[]) { ctx.to('cloudwatch', 'insights', { groups: names.join(',') }); }
function loadQuery(q: any) {
  query.value = q.query;
  picked.value = [...q.groups];
  result.value = { fields: q.fields, rows: q.results.map((r: any[]) => r.map(c => c.value)), matched: q.results.length, scanned: q.scanned };
}
async function runQuery() {
  queryError.value = '';
  const minutes: Record<string, number> = { '5m': 5, '30m': 30, '1h': 60, '3h': 180, '12h': 720, Custom: 1440 };
  const end = 1760234400;
  const start = end - minutes[range.value] * 60;
  const started = await ctx.run(cli(['aws', 'logs', 'start-query'], {
    '--log-group-names': picked.value, '--start-time': String(start), '--end-time': String(end), '--query-string': query.value,
  }), '', { quiet: true });
  if (!started.ok) { queryError.value = String(started.error || started.output || '').trim(); result.value = null; return; }
  const qid = parseJson<any>(started.output)?.queryId;
  if (!qid) return;
  const got = await ctx.run(cli(['aws', 'logs', 'get-query-results'], { '--query-id': qid }), '', { quiet: true });
  if (!got.ok) { queryError.value = String(got.error || '').trim(); return; }
  const data = parseJson<any>(got.output) || {};
  const list: any[][] = data.results || [];
  const fields = list.length ? list[0].map((c: any) => c.field) : (queries.value.find(q => q.id === qid)?.fields || []);
  result.value = { fields, rows: list.map(r => r.map((c: any) => c.value)), matched: data.statistics?.recordsMatched ?? list.length, scanned: data.statistics?.recordsScanned ?? 0 };
}
function exportCsv() {
  if (!result.value) return;
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const text = [result.value.fields.map(esc).join(','), ...result.value.rows.map(r => r.map(esc).join(','))].join('\n');
  downloadText('logs-insights-results.csv', text, 'text/csv');
}
</script>

<style scoped>
.lg__p { margin: 0; }
.lg__search { display: flex; gap: 8px; max-width: 720px; }
.lg__chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.lg__chip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 4px 2px 10px; border: 1px solid #8c8c94; border-radius: 6px; background: #f8f8f8; font-size: 13px; }
.lg__chip button { border: 0; background: none; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; color: #424650; }
.lg__add { width: auto !important; min-width: 260px; }
.lg__bar { display: flex; justify-content: flex-end; }
.lg__range { display: inline-flex; border: 1px solid #8c8c94; border-radius: 8px; overflow: hidden; }
.lg__range button { border: 0; border-left: 1px solid #c6c6cd; background: #fff; padding: 4px 12px; font: inherit; font-size: 13px; cursor: pointer; color: #424650; }
.lg__range button:first-child { border-left: 0; }
.lg__range button.is-on { background: #006ce0; color: #fff; font-weight: 700; }
.lg__editor { display: flex; border: 1px solid #8c8c94; border-radius: 8px; overflow: hidden; background: #fff; }
.lg__gutter { display: flex; flex-direction: column; padding: 8px 8px; background: #f4f4f4; color: #8c8c94; font: 13px/20px Monaco, Menlo, Consolas, monospace; text-align: right; user-select: none; min-width: 36px; }
.lg__code { flex: 1; min-height: 120px; border: 0; outline: 0; resize: vertical; padding: 8px 12px; font: 13px/20px Monaco, Menlo, Consolas, monospace; color: #0f141a; background: #fff; white-space: pre; box-shadow: none; }
.lg__results td { white-space: pre-wrap; word-break: break-word; font-size: 12px; }
.lg__samples { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow: auto; }
.lg__sample { display: flex; flex-direction: column; gap: 2px; text-align: left; border: 1px solid #ebebf0; border-radius: 8px; background: #fff; padding: 6px 10px; cursor: pointer; font: inherit; color: inherit; }
.lg__sample:hover { border-color: #006ce0; background: #f0fbff; }
.lg__sample strong { font-size: 13px; color: #006ce0; }
.lg__sample code { font: 11px/16px Monaco, Menlo, Consolas, monospace; color: #424650; white-space: pre-wrap; word-break: break-word; }
</style>
