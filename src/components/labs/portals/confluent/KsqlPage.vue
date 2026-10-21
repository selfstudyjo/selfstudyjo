<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span>
      <span>ksqlDB</span><span class="cc-sep">/</span><span>{{ KSQL_CLUSTER }}</span></nav>
    <div class="cc-title-row">
      <h1 class="cc-title">{{ KSQL_CLUSTER }}</h1>
      <span class="cc-muted cc-small cc-mono">{{ KSQL_URL }}</span>
      <span class="cc-badge">ksqlDB {{ cc.ksql.value.version || '7.6.1' }}</span>
      <span class="cc-spacer"></span>
      <button type="button" class="cc-btn" @click="openAdd('STREAM')"><CcIcon name="plus" />Add stream</button>
      <button type="button" class="cc-btn" @click="openAdd('TABLE')"><CcIcon name="plus" />Add table</button>
    </div>
    <nav class="cc-tabs" aria-label="ksqlDB">
      <button v-for="t in TABS" :key="t[0]" type="button" :class="{ 'is-active': tab === t[0] }" @click="setTab(t[0])">
        {{ t[1] }}<span v-if="t[2] !== undefined" class="kq-count">{{ t[2] }}</span></button>
    </nav>

    <!-- ===== Editor ===== -->
    <div v-if="tab === 'editor'" class="kq-editor">
      <div class="kq-editor__main">
        <div class="cc-card">
          <div class="kq-props">
            <label class="kq-prop"><span class="cc-label">auto.offset.reset</span>
              <select v-model="reset" class="cc-select" aria-label="auto.offset.reset">
                <option value="latest">Latest</option><option value="earliest">Earliest</option>
              </select></label>
            <span class="cc-hint">Push queries and new persistent queries start at the {{ reset === 'earliest' ? 'beginning' : 'end' }} of their topic.</span>
          </div>
          <textarea ref="editorEl" v-model="sql" class="cc-textarea kq-sql" rows="9" spellcheck="false" aria-label="ksqlDB statement"
                    placeholder="SELECT * FROM my_stream EMIT CHANGES LIMIT 10;" @keydown.ctrl.enter.prevent="runSql" @keydown.meta.enter.prevent="runSql"></textarea>
          <div class="kq-bar">
            <button type="button" class="cc-btn cc-btn--primary" :disabled="!sql.trim() || running" @click="runSql">
              <CcIcon name="play" />{{ running ? 'Running...' : 'Run query' }}</button>
            <button type="button" class="cc-btn" :disabled="!sql" @click="sql = ''">Clear</button>
            <span class="cc-spacer"></span>
            <span class="cc-muted cc-small">Ctrl+Enter to run</span>
          </div>
        </div>

        <div v-if="outcome" class="cc-card">
          <div class="cc-card__head">
            <span class="cc-status" :class="outcome.ok ? 'cc-status--ok' : 'cc-status--bad'">{{ outcome.ok ? 'Success' : 'Error' }}</span>
            <span class="cc-muted cc-small">{{ outcome.statement }}</span>
            <span class="cc-spacer"></span>
            <div v-if="grids.length > 1" class="kq-gridtabs">
              <button v-for="(g, i) in grids" :key="i" type="button" class="cc-btn cc-btn--sm" :class="{ 'cc-btn--primary': gridIndex === i }" @click="gridIndex = i">{{ g.title || 'Result ' + (i + 1) }}</button>
            </div>
          </div>
          <div class="cc-card__body kq-result">
            <div v-if="!outcome.ok" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><pre class="kq-pre">{{ outcome.text }}</pre></div>
            <template v-else>
              <div v-if="grid && grid.columns.length" class="cc-table-wrap kq-grid">
                <table class="cc-table">
                  <thead><tr><th v-for="(c, i) in grid.columns" :key="i">{{ c }}</th></tr></thead>
                  <tbody>
                    <tr v-if="!grid.rows.length"><td :colspan="grid.columns.length" class="cc-empty">No records.</td></tr>
                    <tr v-for="(r, ri) in grid.rows" :key="ri"><td v-for="(v, ci) in r" :key="ci" class="cc-mono">{{ cell(v) }}</td></tr>
                  </tbody>
                </table>
              </div>
              <div v-if="note" class="cc-alert cc-alert--info"><CcIcon name="info" /><span>{{ note }}</span></div>
              <details class="kq-raw" :open="!grid">
                <summary>CLI output</summary>
                <pre class="cc-code">{{ outcome.text || '(no output)' }}</pre>
              </details>
            </template>
          </div>
        </div>
      </div>

      <aside class="cc-card kq-side" aria-label="Streams and tables">
        <div class="cc-card__head"><h3 class="cc-h3">All available streams and tables</h3></div>
        <div class="kq-side__body">
          <label class="cc-search"><CcIcon name="search" />
            <input v-model="sideFilter" class="cc-input" type="search" placeholder="Search" aria-label="Search streams and tables" /></label>
          <div v-if="!sideList.length" class="cc-muted cc-small">No streams or tables yet. Add a stream over a topic to start.</div>
          <div v-for="s in sideList" :key="s.name" class="kq-src" @contextmenu="cc.menu($event, sourceActions(s))">
            <button type="button" class="kq-src__head" :aria-expanded="openSide === s.name" @click="openSide = openSide === s.name ? '' : s.name">
              <CcIcon :name="openSide === s.name ? 'chevron-down' : 'chevron-right'" />
              <CcIcon :name="s.type === 'TABLE' ? 'table' : 'stream'" />
              <span class="kq-src__name">{{ s.name }}</span>
              <span class="cc-badge">{{ s.type }}</span>
            </button>
            <ul v-if="openSide === s.name" class="kq-cols">
              <li v-for="c in s.columns" :key="c.name"><button type="button" class="cc-link cc-mono" @click="insert(c.name)">{{ c.name }}</button>
                <span class="cc-muted cc-small">{{ c.type }}{{ c.key ? (s.type === 'TABLE' ? ' (primary key)' : ' (key)') : '' }}</span></li>
            </ul>
          </div>
        </div>
      </aside>
    </div>

    <!-- ===== Flow ===== -->
    <div v-else-if="tab === 'flow'" class="cc-card cc-card__body kq-flow">
      <div v-if="!cc.ksql.value.queries.length" class="cc-empty">No persistent queries are running. A CREATE STREAM ... AS SELECT or CREATE TABLE ... AS SELECT shows up here.</div>
      <div v-for="q in cc.ksql.value.queries" :key="q.id" class="kq-flow__row">
        <button type="button" class="kq-node kq-node--topic" @click="openTopic(sourceTopic(q))"><CcIcon name="topics" />{{ sourceTopic(q) }}</button>
        <CcIcon name="arrow-right" class="kq-arrow" />
        <button type="button" class="kq-node" @click="useSql(`SELECT * FROM ${q.source} EMIT CHANGES LIMIT 20;`)"><CcIcon :name="kindOf(q.source) === 'TABLE' ? 'table' : 'stream'" />{{ q.source }}</button>
        <CcIcon name="arrow-right" class="kq-arrow" />
        <button type="button" class="kq-node kq-node--query" :class="{ 'is-bad': q.state !== 'RUNNING' }" @click="explain(q.id)"><CcIcon name="ksql" />{{ q.id }}</button>
        <CcIcon name="arrow-right" class="kq-arrow" />
        <button type="button" class="kq-node" @click="useSql(`SELECT * FROM ${q.sink} EMIT CHANGES LIMIT 20;`)"><CcIcon :name="kindOf(q.sink) === 'TABLE' ? 'table' : 'stream'" />{{ q.sink }}</button>
        <CcIcon name="arrow-right" class="kq-arrow" />
        <button type="button" class="kq-node kq-node--topic" @click="openTopic(q.sink_topic)"><CcIcon name="topics" />{{ q.sink_topic }}</button>
      </div>
    </div>

    <!-- ===== Streams / Tables ===== -->
    <div v-else-if="tab === 'streams' || tab === 'tables'" class="cc-table-wrap">
      <table class="cc-table">
        <thead><tr><th>{{ tab === 'streams' ? 'Stream name' : 'Table name' }}</th><th>Kafka topic</th><th>Key format</th><th>Value format</th>
          <th v-if="tab === 'tables'">Windowed</th><th>Written by</th><th class="is-num">Fields</th><th><span class="kq-sr">Actions</span></th></tr></thead>
        <tbody>
          <tr v-if="!sourceRows.length"><td :colspan="tab === 'tables' ? 8 : 7" class="cc-empty">No {{ tab }} yet.
            <button type="button" class="cc-link" @click="openAdd(tab === 'streams' ? 'STREAM' : 'TABLE')">Add a {{ tab === 'streams' ? 'stream' : 'table' }}</button></td></tr>
          <tr v-for="s in sourceRows" :key="s.name" @contextmenu="cc.menu($event, sourceActions(s))">
            <td><button type="button" class="cc-link kq-strong" @click="describe(s.name)">{{ s.name }}</button></td>
            <td><button type="button" class="cc-link cc-mono" @click="openTopic(s.topic)">{{ s.topic }}</button></td>
            <td>{{ s.key_format }}</td><td>{{ s.value_format }}</td>
            <td v-if="tab === 'tables'">{{ s.windowed ? 'Yes' : 'No' }}</td>
            <td class="cc-mono">{{ s.query || '-' }}</td>
            <td class="is-num">{{ s.columns.length }}</td>
            <td class="cc-actions"><button type="button" class="cc-kebab" :aria-label="'Actions for ' + s.name" @click="cc.menu($event, sourceActions(s))"><CcIcon name="more" /></button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===== Persistent queries ===== -->
    <div v-else class="cc-table-wrap">
      <table class="cc-table">
        <thead><tr><th>Query ID</th><th>Status</th><th>Source</th><th>Sink</th><th class="is-num">Records processed</th><th class="is-num">Records produced</th><th>Query</th><th><span class="kq-sr">Actions</span></th></tr></thead>
        <tbody>
          <tr v-if="!cc.ksql.value.queries.length"><td colspan="8" class="cc-empty">No persistent queries are running.</td></tr>
          <tr v-for="q in cc.ksql.value.queries" :key="q.id" @contextmenu="cc.menu($event, queryActions(q))">
            <td class="cc-mono kq-strong">{{ q.id }}</td>
            <td><span class="cc-status" :class="q.state === 'RUNNING' ? 'cc-status--ok' : 'cc-status--bad'" :title="q.error || ''">{{ q.state === 'RUNNING' ? 'Running' : q.state }}</span></td>
            <td class="cc-mono">{{ q.source }}</td><td class="cc-mono">{{ q.sink }}</td>
            <td class="is-num">{{ num(q.processed) }}</td><td class="is-num">{{ num(q.emitted) }}</td>
            <td class="cc-mono kq-qsql" :title="q.sql">{{ q.sql }}</td>
            <td class="cc-actions"><button type="button" class="cc-kebab" :aria-label="'Actions for ' + q.id" @click="cc.menu($event, queryActions(q))"><CcIcon name="more" /></button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===== Describe / Explain ===== -->
    <CcModal v-if="info" :title="info.title" ok-text="Close" :width="760" @close="info = null" @ok="info = null">
      <div v-if="info.grid" class="cc-table-wrap">
        <table class="cc-table">
          <thead><tr><th v-for="(c, i) in info.grid.columns" :key="i">{{ c }}</th></tr></thead>
          <tbody><tr v-for="(r, ri) in info.grid.rows" :key="ri"><td v-for="(v, ci) in r" :key="ci" class="cc-mono">{{ cell(v) }}</td></tr></tbody>
        </table>
      </div>
      <pre class="cc-code">{{ info.text }}</pre>
    </CcModal>

    <!-- ===== Drop ===== -->
    <CcModal v-if="dropping" :title="'Drop ' + dropping.type.toLowerCase()" ok-text="Drop" danger :busy="cc.busy.value"
             :ok-disabled="dropTyped !== dropping.name" @close="dropping = null" @ok="drop">
      <p class="kq-p">{{ dropping.type === 'TABLE' ? 'Table' : 'Stream' }} <strong>{{ dropping.name }}</strong> will be removed from ksqlDB.
        Queries that read or write it must be terminated first.</p>
      <label class="kq-check"><input v-model="dropTopic" type="checkbox" /> Also delete the Kafka topic <span class="cc-mono">{{ dropping.topic }}</span> and its messages</label>
      <label class="cc-field"><span class="cc-label">To confirm, type <strong>{{ dropping.name }}</strong></span>
        <input v-model="dropTyped" class="cc-input" type="text" autocomplete="off" spellcheck="false" /></label>
      <div v-if="dropError" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><pre class="kq-pre">{{ dropError }}</pre></div>
    </CcModal>

    <!-- ===== Add stream / table ===== -->
    <CcModal v-if="adding" :title="adding === 'TABLE' ? 'Add a table' : 'Add a stream'" :ok-text="adding === 'TABLE' ? 'Save table' : 'Save stream'"
             :busy="cc.busy.value" :width="720" @close="adding = null" @ok="saveAdd">
      <div class="cc-form-grid">
        <label class="cc-field"><span class="cc-label">{{ adding === 'TABLE' ? 'Table' : 'Stream' }} name <em>*</em></span>
          <input v-model.trim="form.name" class="cc-input" type="text" spellcheck="false" placeholder="clicks" /></label>
        <label class="cc-field"><span class="cc-label">Kafka topic <em>*</em></span>
          <select v-model="form.topic" class="cc-select">
            <option v-for="t in cc.topics.value" :key="t.name" :value="t.name">{{ t.name }}</option>
            <option value="__new__">Create a new topic...</option>
          </select></label>
        <label v-if="form.topic === '__new__'" class="cc-field"><span class="cc-label">New topic name <em>*</em></span>
          <input v-model.trim="form.newTopic" class="cc-input" type="text" spellcheck="false" /></label>
        <label v-if="form.topic === '__new__'" class="cc-field"><span class="cc-label">Partitions</span>
          <input v-model.number="form.partitions" class="cc-input" type="number" min="1" max="100" /></label>
        <label class="cc-field"><span class="cc-label">Value format</span>
          <select v-model="form.format" class="cc-select"><option value="JSON">JSON</option></select></label>
      </div>
      <div class="cc-field">
        <span class="cc-label">Fields</span>
        <div v-for="(c, i) in form.columns" :key="i" class="kq-colrow">
          <input v-model.trim="c.name" class="cc-input" type="text" placeholder="field_name" spellcheck="false" :aria-label="'Field ' + (i + 1) + ' name'" />
          <select v-model="c.type" class="cc-select" :aria-label="'Field ' + (i + 1) + ' type'">
            <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
          <label class="kq-check"><input v-model="c.key" type="checkbox" @change="onlyOneKey(i)" />{{ adding === 'TABLE' ? 'Primary key' : 'Key' }}</label>
          <button type="button" class="cc-kebab" :aria-label="'Remove field ' + (i + 1)" @click="form.columns.splice(i, 1)"><CcIcon name="close" /></button>
        </div>
        <div class="cc-toolbar">
          <button type="button" class="cc-btn cc-btn--ghost cc-btn--sm" @click="form.columns.push({ name: '', type: 'STRING', key: false })"><CcIcon name="plus" />Add field</button>
          <button type="button" class="cc-btn cc-btn--ghost cc-btn--sm" :disabled="form.topic === '__new__'" @click="inferFields"><CcIcon name="refresh" />Fill from a sample message</button>
        </div>
      </div>
      <div class="cc-field"><span class="cc-label">Statement</span><pre class="cc-code">{{ addStatement }}</pre></div>
      <div v-if="addError" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><pre class="kq-pre">{{ addError }}</pre></div>
    </CcModal>
  </div>
</template>

<script setup lang="ts">
/**
 * Control Center's ksqlDB area: the editor (with the auto.offset.reset
 * property the real editor carries), the flow, streams, tables and persistent
 * queries. Every action is the `ksql --execute` line a student could type into
 * the Kafka CLI console beside it.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { errorText } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import CcModal from './CcModal.vue';
import { useCc, type CcMenuItem } from './ccContext';
import {
  CLUSTER_NAME, KSQL_CLUSTER, KSQL_URL, consumeCommand, gridsOfResult, ksqlCommand, ksqlIdent, ksqlString, num, parseConsumed,
  type CcKsqlQuery, type CcKsqlSource, type KsqlGrid, type KsqlTab,
} from './confluent';

const cc = useCc();
const tab = computed<KsqlTab>(() => (cc.route.value.page === 'ksql' ? cc.route.value.tab : 'editor'));
const TABS = computed<[KsqlTab, string, number | undefined][]>(() => [
  ['editor', 'Editor', undefined],
  ['flow', 'Flow', undefined],
  ['streams', 'Streams', cc.ksql.value.streams.filter(s => s.type === 'STREAM').length],
  ['tables', 'Tables', cc.ksql.value.streams.filter(s => s.type === 'TABLE').length],
  ['queries', 'Persistent queries', cc.ksql.value.queries.length],
]);
function setTab(next: KsqlTab) { cc.go({ page: 'ksql', tab: next }); }

/* ---------------------------------------------------------------- editor */
const sql = ref('');
const reset = ref<'latest' | 'earliest'>('latest');
const running = ref(false);
const editorEl = ref<HTMLTextAreaElement | null>(null);
const outcome = ref<{ ok: boolean; text: string; statement: string } | null>(null);
const grids = ref<KsqlGrid[]>([]);
const gridIndex = ref(0);
const grid = computed(() => grids.value[gridIndex.value] || null);
const note = computed(() => {
  const text = outcome.value?.text || '';
  const m = text.match(/Query terminated - (.+)$/m) || text.match(/\((this console shows[^)]*)\)/);
  return m ? m[1] : '';
});

watch(() => (cc.route.value.page === 'ksql' ? cc.route.value.sql : undefined), value => {
  if (value) {
    sql.value = value;
    cc.route.value = { page: 'ksql', tab: 'editor' };
    nextTick(() => editorEl.value?.focus());
  }
}, { immediate: true });

function cell(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

async function runSql() {
  const text = sql.value.trim();
  if (!text) return;
  running.value = true;
  const result = await cc.run(ksqlCommand(text, reset.value), { quiet: true });
  running.value = false;
  const all = gridsOfResult(result.data).filter(g => g.title !== 'PROPERTIES' || /SHOW\s+PROPERTIES/i.test(text));
  const meaningful = all.filter(g => !(g.columns.length === 1 && g.columns[0] === 'Message'));
  grids.value = meaningful.length ? meaningful : all;
  gridIndex.value = Math.max(0, grids.value.length - 1);
  outcome.value = {
    ok: result.ok,
    text: result.ok ? String(result.output || '') : errorText(result),
    statement: text.length > 90 ? text.slice(0, 90) + '...' : text,
  };
}

function insert(text: string) {
  const el = editorEl.value;
  if (!el) { sql.value += text; return; }
  const start = el.selectionStart ?? sql.value.length;
  const end = el.selectionEnd ?? start;
  sql.value = sql.value.slice(0, start) + text + sql.value.slice(end);
  nextTick(() => { el.focus(); el.selectionStart = el.selectionEnd = start + text.length; });
}
function useSql(text: string) {
  sql.value = text;
  setTab('editor');
  nextTick(() => editorEl.value?.focus());
}

const sideFilter = ref('');
const openSide = ref('');
const sideList = computed(() => cc.ksql.value.streams.filter(s => !sideFilter.value || s.name.toLowerCase().includes(sideFilter.value.toLowerCase())));
const sourceRows = computed(() => cc.ksql.value.streams.filter(s => s.type === (tab.value === 'tables' ? 'TABLE' : 'STREAM')));

function kindOf(name: string) { return cc.ksql.value.streams.find(s => s.name === name)?.type || 'STREAM'; }
function sourceTopic(q: CcKsqlQuery) { return cc.ksql.value.streams.find(s => s.name === q.source)?.topic || '?'; }
function openTopic(name: string) { if (cc.topic(name)) cc.go({ page: 'topic', name, tab: 'messages' }); }

/* ---------------------------------------------------------------- menus */
function sourceActions(s: CcKsqlSource): CcMenuItem[] {
  return [
    { label: s.type === 'TABLE' ? 'Query table' : 'Query stream', icon: 'play',
      run: () => useSql(s.type === 'TABLE' ? `SELECT * FROM ${ksqlIdent(s.name)};` : `SELECT * FROM ${ksqlIdent(s.name)} EMIT CHANGES LIMIT 20;`) },
    { label: 'Describe', icon: 'info', run: () => describe(s.name) },
    { label: 'View topic', icon: 'topics', disabled: !cc.topic(s.topic), run: () => openTopic(s.topic) },
    { divider: true },
    { label: s.type === 'TABLE' ? 'Drop table' : 'Drop stream', icon: 'trash', danger: true, run: () => startDrop(s) },
  ];
}
function queryActions(q: CcKsqlQuery): CcMenuItem[] {
  return [
    { label: 'Explain', icon: 'info', run: () => explain(q.id) },
    { label: 'Query the sink', icon: 'play', run: () => useSql(`SELECT * FROM ${ksqlIdent(q.sink)} EMIT CHANGES LIMIT 20;`) },
    { label: 'View sink topic', icon: 'topics', disabled: !cc.topic(q.sink_topic), run: () => openTopic(q.sink_topic) },
    { divider: true },
    { label: 'Terminate', icon: 'stop', danger: true, run: () => terminate(q.id) },
  ];
}

const info = ref<{ title: string; text: string; grid: KsqlGrid | null } | null>(null);
async function describe(name: string) {
  const result = await cc.run(ksqlCommand(`DESCRIBE ${ksqlIdent(name)} EXTENDED`), { quiet: true });
  if (!result.ok) { cc.notify('error', `Could not describe ${name}`, errorText(result)); return; }
  const schema = gridsOfResult(result.data).find(g => g.title === 'schema') || null;
  const lines = String(result.output || '').split('\n');
  const text = schema ? lines.filter(l => !l.includes(' | ') && !/^-{6,}$/.test(l.trim())).join('\n') : lines.join('\n');
  info.value = { title: name, text, grid: schema };
}
async function explain(id: string) {
  const result = await cc.run(ksqlCommand(`EXPLAIN ${id}`), { quiet: true });
  if (!result.ok) { cc.notify('error', `Could not explain ${id}`, errorText(result)); return; }
  info.value = { title: id, text: String(result.output || ''), grid: null };
}
async function terminate(id: string) {
  const ok = await cc.confirm({
    title: 'Terminate query',
    message: `Persistent query ${id} will stop consuming and producing. Its sink stream or table and its topic are kept.`,
    yes: 'Terminate', danger: true,
  });
  if (ok) await cc.run(ksqlCommand(`TERMINATE ${id}`), { success: `Query ${id} terminated` });
}

const dropping = ref<CcKsqlSource | null>(null);
const dropTopic = ref(false);
const dropTyped = ref('');
const dropError = ref('');
function startDrop(s: CcKsqlSource) { dropping.value = s; dropTopic.value = false; dropTyped.value = ''; dropError.value = ''; }
async function drop() {
  const s = dropping.value;
  if (!s) return;
  const result = await cc.run(ksqlCommand(`DROP ${s.type} ${ksqlIdent(s.name)}${dropTopic.value ? ' DELETE TOPIC' : ''}`),
    { quiet: true });
  if (!result.ok) { dropError.value = errorText(result); return; }
  cc.notify('success', `${s.type === 'TABLE' ? 'Table' : 'Stream'} ${s.name} dropped`);
  dropping.value = null;
}

/* ---------------------------------------------------------------- add */
const TYPES = ['STRING', 'INT', 'BIGINT', 'DOUBLE', 'BOOLEAN', 'DECIMAL(10, 2)', 'TIMESTAMP', 'ARRAY<STRING>', 'MAP<STRING, STRING>'];
const adding = ref<'STREAM' | 'TABLE' | null>(null);
const addError = ref('');
const form = ref({ name: '', topic: '', newTopic: '', partitions: 1, format: 'JSON',
  columns: [] as { name: string; type: string; key: boolean }[] });
function openAdd(kind: 'STREAM' | 'TABLE') {
  adding.value = kind;
  addError.value = '';
  form.value = { name: '', topic: cc.topics.value[0]?.name || '__new__', newTopic: '', partitions: 1, format: 'JSON',
    columns: [{ name: 'id', type: 'STRING', key: true }, { name: '', type: 'STRING', key: false }] };
}
function onlyOneKey(i: number) {
  if (form.value.columns[i]?.key) form.value.columns.forEach((c, j) => { if (j !== i) c.key = false; });
}
const addStatement = computed(() => {
  const f = form.value;
  const kind = adding.value || 'STREAM';
  const cols = f.columns.filter(c => c.name)
    .map(c => `${ksqlIdent(c.name)} ${c.type}${c.key ? (kind === 'TABLE' ? ' PRIMARY KEY' : ' KEY') : ''}`);
  const topic = f.topic === '__new__' ? f.newTopic : f.topic;
  const props = [`KAFKA_TOPIC=${ksqlString(topic || '')}`, `VALUE_FORMAT=${ksqlString(f.format)}`];
  if (f.topic === '__new__') props.push(`PARTITIONS=${Number(f.partitions) || 1}`);
  return `CREATE ${kind} ${f.name ? ksqlIdent(f.name) : '<name>'} (${cols.join(', ')}) WITH (${props.join(', ')});`;
});
async function inferFields() {
  const topic = form.value.topic;
  const result = await cc.run(consumeCommand(topic, { partition: null, offset: 'earliest', limit: 5 }), { quiet: true, unlogged: true });
  const msgs = result.ok ? parseConsumed(String(result.output || '')) : [];
  const sample = msgs.map(m => { try { return JSON.parse(m.value); } catch { return null; } }).find(v => v && typeof v === 'object' && !Array.isArray(v));
  if (!sample) { addError.value = `No JSON message to sample on ${topic}.`; return; }
  const guess = (v: unknown) => typeof v === 'number' ? (Number.isInteger(v) ? 'BIGINT' : 'DOUBLE') : typeof v === 'boolean' ? 'BOOLEAN' : 'STRING';
  const keyed = msgs.some(m => m.key !== null);
  form.value.columns = [
    ...(keyed ? [{ name: 'msg_key', type: 'STRING', key: true }] : []),
    ...Object.entries(sample).map(([k, v]) => ({ name: k, type: guess(v), key: false })),
  ];
  addError.value = '';
}
async function saveAdd() {
  const f = form.value;
  if (!f.name) { addError.value = 'A name is required.'; return; }
  if (!f.columns.some(c => c.name)) { addError.value = 'Add at least one field.'; return; }
  if (adding.value === 'TABLE' && !f.columns.some(c => c.name && c.key)) { addError.value = 'A table needs a PRIMARY KEY field.'; return; }
  if (f.topic === '__new__' && !f.newTopic) { addError.value = 'Name the new topic.'; return; }
  const result = await cc.run(ksqlCommand(addStatement.value), { quiet: true });
  if (!result.ok) { addError.value = errorText(result); return; }
  cc.notify('success', `${adding.value === 'TABLE' ? 'Table' : 'Stream'} ${f.name.toUpperCase()} created`);
  const kind = adding.value;
  adding.value = null;
  setTab(kind === 'TABLE' ? 'tables' : 'streams');
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.kq-count { margin-left: 6px; padding: 0 6px; border-radius: 8px; background: var(--cc-tag-bg); color: var(--cc-text-2); font-size: 11px; }
.kq-editor { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 16px; align-items: start; }
.kq-editor__main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.kq-props { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-bottom: 1px solid var(--cc-border); background: var(--cc-head-bg); }
.kq-prop { display: inline-flex; align-items: center; gap: 8px; }
.kq-prop .cc-label { font-family: var(--cc-mono); font-weight: 400; }
.kq-sql { display: block; width: 100%; border: 0; border-radius: 0; min-height: 180px; padding: 12px 14px; font-size: 13px; line-height: 20px; }
.kq-sql:focus { box-shadow: inset 0 0 0 2px var(--cc-focus); }
.kq-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--cc-border); }
.kq-result { display: flex; flex-direction: column; gap: 12px; }
.kq-grid { max-height: 420px; }
.kq-gridtabs { display: flex; gap: 4px; flex-wrap: wrap; }
.kq-raw summary { cursor: pointer; font-size: 12px; font-weight: 600; color: var(--cc-text-2); margin-bottom: 6px; }
.kq-pre { margin: 0; white-space: pre-wrap; font-family: var(--cc-mono); font-size: 12px; overflow-wrap: anywhere; }
.kq-side { position: sticky; top: 8px; }
.kq-side__body { padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; max-height: 560px; overflow: auto; }
.kq-side .cc-search .cc-input { width: 100%; }
.kq-src { border: 1px solid var(--cc-border-light); border-radius: 4px; }
.kq-src__head { display: flex; align-items: center; gap: 6px; width: 100%; padding: 6px 8px; border: 0; background: none; font: inherit; cursor: pointer; text-align: left; color: var(--cc-text); }
.kq-src__head:hover { background: var(--cc-row-hover); }
.kq-src__name { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.kq-cols { list-style: none; margin: 0; padding: 4px 10px 8px 34px; display: flex; flex-direction: column; gap: 3px; }
.kq-cols li { display: flex; justify-content: space-between; gap: 8px; }
.kq-flow { display: flex; flex-direction: column; gap: 12px; overflow-x: auto; }
.kq-flow__row { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.kq-node { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid var(--cc-border-strong); border-radius: 4px; background: #fff; font: inherit; font-size: 12px; font-weight: 600; color: var(--cc-text); cursor: pointer; white-space: nowrap; }
.kq-node:hover { border-color: var(--cc-primary); color: var(--cc-primary); }
.kq-node--topic { background: var(--cc-head-bg); font-family: var(--cc-mono); font-weight: 400; }
.kq-node--query { background: var(--cc-blue-bg); border-color: var(--cc-blue-border); }
.kq-node--query.is-bad { background: var(--cc-danger-bg); border-color: var(--cc-danger-border); color: var(--cc-danger-text); }
.kq-arrow { color: var(--cc-text-3); flex: none; }
.kq-strong { font-weight: 600; }
.kq-qsql { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kq-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.kq-p { margin: 0; }
.kq-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
.kq-colrow { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto 28px; gap: 6px; align-items: center; }
@container sl-portal (max-width: 1000px) {
  .kq-editor { grid-template-columns: minmax(0, 1fr); }
  .kq-side { position: static; }
}
</style>
