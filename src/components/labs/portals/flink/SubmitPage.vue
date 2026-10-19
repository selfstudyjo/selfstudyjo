<template>
  <div class="fk-page">
    <!-- ===== The real page's JAR area, honestly unavailable ===== -->
    <section class="fk-card">
      <header class="fk-card__head">
        <span class="fk-card__title">Uploaded Jars</span>
        <span class="fk-card__extra">
          <button type="button" class="fk-btn fk-btn--primary" disabled title="JAR upload is not available in this simulation">
            <FkIcon name="upload" />+ Add New
          </button>
        </span>
      </header>
      <div class="fk-card__body">
        <div class="fk-alert">
          <FkIcon name="info" />
          <span>JAR upload is not available in this simulated cluster - there is no JVM to run a JAR's <code class="fk-mono">main()</code>.
            Jobs here are Flink SQL: submit them through the <strong>SQL Gateway</strong> below, exactly as the SQL Client
            beside this dashboard would. An <code class="fk-mono">INSERT INTO ... SELECT</code> submits a streaming job.</span>
        </div>
      </div>
    </section>

    <!-- ===== SQL Gateway ===== -->
    <section class="fk-card">
      <header class="fk-card__head">
        <span class="fk-card__title">SQL Gateway</span>
        <span class="fk-card__extra fk-muted fk-gw-endpoint">session default_catalog.default_database</span>
      </header>
      <div class="fk-gw">
        <aside class="fk-gw__catalog" aria-label="Catalog">
          <div class="fk-gw__cat-head">Tables <span class="fk-muted">({{ fk.tables.value.length }})</span></div>
          <ul class="fk-gw__tables">
            <li v-for="t in fk.tables.value" :key="t.name">
              <button type="button" class="fk-gw__table" :class="{ 'is-open': openTable === t.name }" @click="toggleTable(t.name)">
                <FkIcon name="table" /><span class="fk-gw__tname">{{ t.name }}</span>
                <span class="fk-tag fk-tag--plain fk-gw__conn">{{ t.connector || 'table' }}</span>
              </button>
              <div v-if="openTable === t.name" class="fk-gw__tdetail">
                <div v-if="t.topic" class="fk-muted fk-mono">{{ t.connector === 'filesystem' ? 'path' : 'topic' }}: {{ t.topic }}</div>
                <div v-if="t.format" class="fk-muted">format: {{ t.format }}</div>
                <div v-if="t.watermark" class="fk-muted fk-mono">WATERMARK {{ t.watermark }}</div>
                <ul class="fk-gw__cols">
                  <li v-for="c in t.columns" :key="c.name"><span class="fk-mono">{{ c.name }}</span> <span class="fk-muted">{{ c.type }}</span></li>
                </ul>
                <div class="fk-gw__tactions">
                  <button type="button" class="fk-btn fk-btn--sm" @click="insertText(`SELECT * FROM ${t.name};`)">SELECT</button>
                  <button type="button" class="fk-btn fk-btn--sm" @click="insertText(`DESCRIBE ${t.name};`)">DESCRIBE</button>
                  <button type="button" class="fk-btn fk-btn--sm fk-btn--danger" @click="dropTable(t.name)">DROP</button>
                </div>
              </div>
            </li>
            <li v-if="!fk.tables.value.length" class="fk-muted fk-gw__none">No tables yet. Start with CREATE TABLE.</li>
          </ul>
          <div class="fk-gw__cat-head">Snippets</div>
          <div class="fk-gw__snips">
            <button v-for="s in snippets" :key="s.label" type="button" class="fk-btn fk-btn--sm" @click="insertText(s.sql)">{{ s.label }}</button>
          </div>
        </aside>

        <div class="fk-gw__main">
          <label class="fk-field fk-gw__editor">
            <span class="fk-gw__label">Flink SQL <small>Separate statements with <code>;</code> - Ctrl+Enter to execute</small></span>
            <textarea ref="editor" v-model="fk.draft.value.sql" class="fk-textarea" rows="12" spellcheck="false"
                      placeholder="CREATE TABLE ... WITH (...);&#10;SET 'execution.checkpointing.interval' = '30s';&#10;INSERT INTO sink SELECT ... ;"
                      @keydown.ctrl.enter.prevent="execute(false)" @keydown.meta.enter.prevent="execute(false)"></textarea>
          </label>

          <div class="fk-gw__opts">
            <label class="fk-field">Parallelism
              <input v-model="parallelism" class="fk-input" type="number" min="1" max="64" placeholder="Default" />
            </label>
            <label class="fk-field fk-gw__sp">Savepoint Path
              <input v-model="fk.draft.value.savepoint" class="fk-input fk-mono" type="text" placeholder="s3://shopflow-lake/flink/savepoints/savepoint-..." list="fk-savepoints" />
              <datalist id="fk-savepoints"><option v-for="s in fk.savepoints.value" :key="s.path" :value="s.path" /></datalist>
            </label>
            <label class="fk-check fk-gw__nonrestored"><input v-model="allowNonRestored" type="checkbox" :disabled="!fk.draft.value.savepoint" />Allow Non Restored State</label>
          </div>

          <div class="fk-gw__bar">
            <button type="button" class="fk-btn fk-btn--primary" :disabled="!canRun" @click="execute(false)">
              <FkIcon name="play" />Execute
            </button>
            <button type="button" class="fk-btn" :disabled="!canExplain" @click="execute(true)">Explain</button>
            <button type="button" class="fk-btn" :disabled="!fk.draft.value.sql" @click="fk.draft.value.sql = ''">Clear</button>
            <span class="fk-spacer"></span>
            <span v-if="preview.length > 1" class="fk-muted fk-gw__count">{{ preview.length }} statements</span>
          </div>

          <div v-if="preview.length && (parallelism || fk.draft.value.savepoint)" class="fk-alert">
            <FkIcon name="info" />
            <span>Sent to the gateway first: <code class="fk-mono">{{ preludeText }}</code></span>
          </div>

          <!-- ===== Results ===== -->
          <div v-if="result" class="fk-gw__result">
            <div class="fk-gw__result-head">
              <span class="fk-tag" :class="result.ok ? 'fk-tag--green' : 'fk-tag--red'">{{ result.ok ? 'SUCCESS' : 'ERROR' }}</span>
              <span class="fk-muted">{{ result.when }}</span>
              <button v-if="submittedJob" type="button" class="fk-link" @click="fk.go({ page: 'job', jid: submittedJob, tab: 'overview' })">
                Open job {{ submittedJob }}
              </button>
            </div>
            <div v-if="grids.length > 1" class="fk-tabs fk-tabs--card">
              <button v-for="(g, i) in grids" :key="i" type="button" class="fk-tab" :class="{ 'is-active': gridIndex === i }" @click="gridIndex = i">
                {{ g.title || 'Result ' + (i + 1) }}
              </button>
            </div>
            <div v-if="grids.length" class="fk-table-wrap fk-gw__grid">
              <table class="fk-table fk-table--sm">
                <thead><tr><th v-for="(c, i) in grids[gridIndex]?.columns || []" :key="i">{{ c }}</th></tr></thead>
                <tbody>
                  <tr v-for="(row, ri) in grids[gridIndex]?.rows || []" :key="ri">
                    <td v-for="(cell, ci) in row" :key="ci" class="fk-mono wrap">{{ cell === null ? 'NULL' : cell }}</td>
                  </tr>
                  <tr v-if="!(grids[gridIndex]?.rows || []).length"><td :colspan="(grids[gridIndex]?.columns || []).length || 1" class="fk-empty">Empty result.</td></tr>
                </tbody>
              </table>
              <div v-if="(grids[gridIndex]?.total || 0) > (grids[gridIndex]?.rows || []).length" class="fk-muted fk-gw__more">
                Showing {{ grids[gridIndex]?.rows.length }} of {{ grids[gridIndex]?.total }} rows.
              </div>
            </div>
            <pre v-if="result.text && (!grids.length || !result.ok)" class="fk-pre">{{ result.text }}</pre>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== Savepoints known to the cluster ===== -->
    <section class="fk-card">
      <header class="fk-card__head"><span class="fk-card__title">Savepoints</span></header>
      <div class="fk-table-wrap">
        <table class="fk-table fk-table--sm">
          <thead><tr><th>Path</th><th>Job</th><th>Completed</th><th></th></tr></thead>
          <tbody>
            <tr v-for="s in savepointsSorted" :key="s.path">
              <td class="fk-mono wrap">{{ s.path }}</td>
              <td class="fk-mono">{{ s.job || '-' }}</td>
              <td class="nowrap">{{ fmtTime(s.at) }}</td>
              <td><button type="button" class="fk-btn fk-btn--sm" @click="useSavepoint(s)">Resume from here</button></td>
            </tr>
            <tr v-if="!savepointsSorted.length"><td colspan="4" class="fk-empty">No savepoints yet. Trigger one from a running job.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import FkIcon from './FkIcon.vue';
import { useFk } from './fkContext';
import { fmtTime, gridsOf, sqlString, type FkGridData, type FkSavepoint } from './flink';

const fk = useFk();
const editor = ref<HTMLTextAreaElement | null>(null);
const parallelism = ref<string | number>('');
const allowNonRestored = ref(false);
const openTable = ref('');
const result = ref<{ ok: boolean; text: string; when: string } | null>(null);
const grids = ref<FkGridData[]>([]);
const gridIndex = ref(0);
const submittedJob = ref('');

/** The editor's statements, split on `;` outside quotes, empty ones dropped. */
function split(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; current += ch; continue; }
    if (ch === '-' && text[i + 1] === '-') {
      const end = text.indexOf('\n', i);
      i = end < 0 ? text.length : end;
      current += '\n';
      continue;
    }
    if (ch === ';') { if (current.trim()) out.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const preview = computed(() => split(fk.draft.value.sql || ''));
const canRun = computed(() => preview.value.length > 0 && !fk.busy.value);
const canExplain = computed(() => preview.value.some(s => /^(insert|select)\b/i.test(s)) && !fk.busy.value);

const prelude = computed(() => {
  const lines: string[] = [];
  const p = Number(parallelism.value);
  if (String(parallelism.value).trim() && Number.isFinite(p) && p > 0) {
    lines.push(`SET 'parallelism.default' = '${Math.floor(p)}';`);
  }
  const sp = String(fk.draft.value.savepoint || '').trim();
  if (sp) {
    lines.push(`SET 'execution.savepoint.path' = ${sqlString(sp)};`);
    if (allowNonRestored.value) lines.push(`SET 'execution.savepoint.ignore-unclaimed-state' = 'true';`);
  }
  return lines;
});
const preludeText = computed(() => prelude.value.join(' '));

async function execute(explain: boolean) {
  let body = preview.value;
  if (explain) {
    const target = body.filter(s => /^(insert|select)\b/i.test(s)).pop();
    if (!target) return;
    body = [`EXPLAIN ${target}`];
  }
  const statements = [...(explain ? [] : prelude.value.map(s => s.replace(/;$/, ''))), ...body];
  const text = statements.map(s => s + ';').join('\n');
  const before = new Set(fk.jobs.value.map(j => j.jid));
  const outcome = await fk.run(text, { surface: 'flink_sql', quiet: true });
  grids.value = outcome.ok ? gridsOf(outcome) : [];
  gridIndex.value = Math.max(0, grids.value.length - 1);
  const when = new Date().toISOString().slice(11, 19);
  result.value = { ok: Boolean(outcome.ok), text: outcome.ok ? String(outcome.output || '').trim() : errorText(outcome), when };
  submittedJob.value = '';
  if (!outcome.ok) {
    fk.notify('error', 'Statement failed', errorText(outcome));
    return;
  }
  const created = fk.jobs.value.find(j => !before.has(j.jid));
  if (created) {
    submittedJob.value = created.jid;
    fk.notify('success', 'Job submitted', `${created.name} (${created.jid})`);
    if (String(fk.draft.value.savepoint || '').trim()) fk.draft.value.savepoint = '';
  }
}

async function dropTable(name: string) {
  const yes = await fk.confirm({ title: 'Drop table', message: `DROP TABLE ${name}? Only the catalog entry is removed; the topic or files it points at are kept.`, yes: 'Drop', danger: true });
  if (!yes) return;
  const outcome = await fk.run(`DROP TABLE ${name};`, { surface: 'flink_sql', success: `Table ${name} dropped` });
  if (outcome.ok && openTable.value === name) openTable.value = '';
}

function toggleTable(name: string) {
  openTable.value = openTable.value === name ? '' : name;
}

async function insertText(sql: string) {
  const current = fk.draft.value.sql || '';
  fk.draft.value.sql = current.trim() ? `${current.replace(/\s+$/, '')}\n\n${sql}` : sql;
  await nextTick();
  editor.value?.focus();
}

function useSavepoint(s: FkSavepoint) {
  fk.draft.value.savepoint = s.path;
  const job = fk.jobs.value.find(j => j.jid === s.job);
  if (job?.sql && !String(fk.draft.value.sql || '').trim()) fk.draft.value.sql = job.sql;
  fk.notify('info', 'Savepoint selected', 'Execute the INSERT INTO again to resume from it.');
}

const savepointsSorted = computed(() => fk.savepoints.value.slice().reverse());

const snippets = computed(() => {
  const topic = fk.topics.value.includes('shop.web_events') ? 'shop.web_events' : (fk.topics.value[0] || 'shop.web_events');
  return [
    {
      label: 'Kafka source',
      sql: `CREATE TABLE web_events (
  event_id STRING,
  user_id INT,
  session_id STRING,
  event_type STRING,
  page STRING,
  product_id INT,
  event_ts TIMESTAMP(3),
  device STRING,
  WATERMARK FOR event_ts AS event_ts - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = '${topic}',
  'properties.bootstrap.servers' = 'kafka-1.shopflow.internal:9092',
  'properties.group.id' = 'flink-web-events',
  'scan.startup.mode' = 'earliest-offset',
  'format' = 'json'
);`,
    },
    {
      label: 'Kafka sink',
      sql: `CREATE TABLE page_views_per_minute (
  window_start TIMESTAMP(3),
  window_end TIMESTAMP(3),
  page STRING,
  views BIGINT
) WITH (
  'connector' = 'kafka',
  'topic' = 'shop.page_views_1m',
  'properties.bootstrap.servers' = 'kafka-1.shopflow.internal:9092',
  'format' = 'json'
);`,
    },
    { label: 'Checkpointing', sql: `SET 'execution.checkpointing.interval' = '30s';\nSET 'execution.checkpointing.mode' = 'EXACTLY_ONCE';` },
    {
      label: 'Tumbling window',
      sql: `INSERT INTO page_views_per_minute
SELECT window_start, window_end, page, COUNT(*) AS views
FROM TABLE(TUMBLE(TABLE web_events, DESCRIPTOR(event_ts), INTERVAL '1' MINUTES))
GROUP BY window_start, window_end, page;`,
    },
    { label: 'SHOW', sql: 'SHOW TABLES;\nSHOW JOBS;' },
  ];
});
</script>

<style scoped src="./fk.css"></style>
<style scoped>
.fk-gw { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: 360px; }
.fk-gw__catalog { border-right: 1px solid var(--fk-border-split); padding: 12px 0; background: #fafafa; min-width: 0; overflow: auto; max-height: 640px; }
.fk-gw__cat-head { padding: 6px 16px; font-size: 12px; font-weight: 600; color: var(--fk-text-2); text-transform: uppercase; letter-spacing: 0.02em; }
.fk-gw__tables { list-style: none; margin: 0 0 12px; padding: 0; }
.fk-gw__table {
  display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: none; font: inherit; font-size: 13px;
  padding: 6px 16px; cursor: pointer; color: var(--fk-text); text-align: left;
}
.fk-gw__table:hover, .fk-gw__table.is-open { background: #e6f7ff; }
.fk-gw__tname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--fk-mono); font-size: 12px; }
.fk-gw__conn { height: 18px; line-height: 16px; font-size: 11px; }
.fk-gw__tdetail { padding: 4px 16px 10px 38px; font-size: 12px; display: flex; flex-direction: column; gap: 3px; overflow-wrap: anywhere; }
.fk-gw__cols { list-style: none; margin: 4px 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.fk-gw__tactions { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.fk-gw__none { padding: 6px 16px; font-size: 13px; }
.fk-gw__snips { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 16px; }
.fk-gw__main { padding: 16px 24px 24px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.fk-gw__label { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
.fk-gw__editor .fk-textarea { min-height: 220px; }
.fk-gw__opts { display: grid; grid-template-columns: 140px minmax(0, 1fr) auto; gap: 12px 16px; align-items: end; }
.fk-gw__nonrestored { padding-bottom: 6px; }
.fk-gw__bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.fk-spacer { flex: 1; }
.fk-gw__result { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--fk-border-split); padding-top: 14px; }
.fk-gw__result-head { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.fk-gw__grid { border: 1px solid var(--fk-border-split); max-height: 360px; overflow: auto; }
.fk-gw__more { padding: 6px 8px; font-size: 12px; }
.fk-gw-endpoint { font-family: var(--fk-mono); font-size: 12px; }
@container sl-portal (max-width: 860px) {
  .fk-gw { grid-template-columns: minmax(0, 1fr); }
  .fk-gw__catalog { border-right: 0; border-bottom: 1px solid var(--fk-border-split); max-height: 260px; }
  .fk-gw__opts { grid-template-columns: minmax(0, 1fr); }
  .fk-gw__main { padding: 16px; }
}
</style>
