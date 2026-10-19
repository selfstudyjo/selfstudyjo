<template>
  <div class="sf-page od">
    <div class="sf-crumbs">
      <button type="button" @click="sf.go({ page: 'databases' })">Databases</button><SfIcon name="chevron-right" />
      <button type="button" @click="sf.go({ page: 'databases', db: parts[0] })">{{ parts[0] }}</button><SfIcon name="chevron-right" />
      <button type="button" @click="sf.go({ page: 'databases', db: parts[0], schema: parts[1] })">{{ parts[1] }}</button><SfIcon name="chevron-right" />
      <button type="button" @click="sf.go({ page: 'databases', db: parts[0], schema: parts[1], kind })">{{ kindLabel }}</button>
    </div>

    <div v-if="!exists" class="sf-empty"><SfIcon name="warning" /><strong>{{ fqn }} does not exist or is not authorized.</strong>
      <span>It may have been dropped. Turn on "Show dropped objects" to see dropped tables.</span></div>

    <template v-else>
      <div class="sf-page-head">
        <span class="od__icon"><SfIcon :name="icon" /></span>
        <div class="od__title">
          <h1 class="sf-h1">{{ name }}</h1>
          <span class="sf-muted sf-small">{{ typeLabel }}<template v-if="table?.owner"> · Owner {{ table.owner }}</template>
            <template v-if="table && table.rows !== undefined"> · {{ fmtNum(table.rows) }} rows</template>
            <template v-if="table && table.bytes !== undefined"> · {{ fmtBytes(table.bytes) }}</template></span>
        </div>
        <span v-if="dropped" class="sf-badge sf-badge--bad">Dropped</span>
        <span class="sf-spacer"></span>
        <template v-if="kind === 'tasks' && task">
          <button v-if="String(task.state).toLowerCase() !== 'started'" type="button" class="sf-btn" @click="taskAction('RESUME')"><SfIcon name="play" /> Resume</button>
          <button v-else type="button" class="sf-btn" @click="taskAction('SUSPEND')"><SfIcon name="pause" /> Suspend</button>
          <button type="button" class="sf-btn" @click="executeTask"><SfIcon name="power" /> Execute</button>
        </template>
        <button v-if="kind === 'stages'" type="button" class="sf-btn" @click="listFiles"><SfIcon name="refresh" /> List files</button>
        <button v-if="kind === 'tables' || kind === 'views'" type="button" class="sf-btn" :disabled="dropped" @click="openInWorksheet"><SfIcon name="worksheet" /> Open in Worksheet</button>
        <div class="sf-rel">
          <button type="button" class="sf-btn sf-btn--icon" aria-label="Object actions" @click="menu = !menu"><SfIcon name="more" /></button>
          <div v-if="menu" class="sf-menu od__menu" @mouseleave="menu = false">
            <template v-if="dropped">
              <button v-if="kind === 'tables' || kind === 'views'" type="button" @click="undropTable"><SfIcon name="undo" /> Undrop</button>
            </template>
            <template v-else>
              <template v-if="kind === 'tables'">
                <button type="button" @click="loadData"><SfIcon name="upload" /> Load data</button>
                <button type="button" @click="cloneTable"><SfIcon name="clone" /> Clone</button>
                <button type="button" @click="renameObject"><SfIcon name="edit" /> Rename</button>
                <button type="button" @click="editRetention"><SfIcon name="history" /> Edit Time Travel retention</button>
                <button type="button" @click="editCluster"><SfIcon name="sort" /> {{ table?.clustering_key ? 'Edit clustering key' : 'Add clustering key' }}</button>
                <button type="button" @click="toggleTracking"><SfIcon name="stream" /> {{ table?.change_tracking ? 'Disable' : 'Enable' }} change tracking</button>
                <button type="button" @click="sf.create('stream', { database: parts[0], schema: parts[1], table: fqn, name: name + '_STREAM' })"><SfIcon name="stream" /> Create stream</button>
                <button type="button" @click="rowPolicy"><SfIcon name="policy" /> {{ table?.row_access_policy ? 'Remove' : 'Add' }} row access policy</button>
              </template>
              <button v-if="kind === 'views'" type="button" @click="renameObject"><SfIcon name="edit" /> Rename</button>
              <button v-if="kind === 'pipes'" type="button" @click="refreshPipe"><SfIcon name="refresh" /> Refresh pipe</button>
              <hr />
              <button type="button" class="is-danger" @click="dropObject"><SfIcon name="trash" /> Drop</button>
            </template>
          </div>
        </div>
      </div>

      <!-- TABLE / VIEW -->
      <template v-if="table">
        <div class="sf-tabs">
          <button v-for="t in tableTabs" :key="t" type="button" class="sf-tab" :class="{ 'is-active': tab === t }" @click="setTab(t)">{{ t }}</button>
        </div>

        <div v-if="tab === 'Table Details' || tab === 'View Details'" class="od__cols">
          <dl class="sf-kv sf-card">
            <dt>Type</dt><dd>{{ typeLabel }}</dd>
            <dt>Owner</dt><dd>{{ table.owner || '—' }}</dd>
            <dt>Created</dt><dd>{{ fmtMinute(table.created) || '—' }}</dd>
            <template v-if="kind === 'tables'">
              <dt>Rows</dt><dd>{{ fmtNum(table.rows) }}</dd>
              <dt>Size</dt><dd>{{ fmtBytes(table.bytes) }}</dd>
              <dt>Change tracking</dt><dd>{{ table.change_tracking ? 'On' : 'Off' }}</dd>
              <dt>Row access policy</dt><dd>{{ table.row_access_policy || '—' }}</dd>
              <dt v-if="table.clone_of">Cloned from</dt><dd v-if="table.clone_of" class="sf-mono">{{ table.clone_of }}</dd>
            </template>
            <dt>Comment</dt><dd>{{ table.comment || '—' }}</dd>
          </dl>
          <div v-if="kind === 'tables'" class="od__side">
            <section class="sf-card od__sec">
              <div class="sf-page-head"><h2 class="sf-h3">Clustering</h2><span class="sf-spacer"></span>
                <button type="button" class="sf-btn sf-btn--sm" @click="clusteringInfo"><SfIcon name="chart" /> Clustering information</button></div>
              <dl class="sf-kv">
                <dt>Clustering key</dt><dd class="sf-mono">{{ table.clustering_key ? clusterColumns(table.clustering_key) : 'Not clustered' }}</dd>
                <dt>Micro-partitions</dt><dd>{{ fmtNum(table.micro_partitions) }}</dd>
                <dt>Average depth</dt><dd>{{ table.clustering_depth ?? '—' }}</dd>
              </dl>
              <pre v-if="clusterJson" class="sf-code od__json">{{ clusterJson }}</pre>
            </section>
            <section class="sf-card od__sec">
              <div class="sf-page-head"><h2 class="sf-h3">Time Travel</h2><span class="sf-spacer"></span>
                <button type="button" class="sf-btn sf-btn--sm" @click="editRetention"><SfIcon name="edit" /> Edit</button></div>
              <dl class="sf-kv">
                <dt>Retention</dt><dd>{{ table.retention_days ?? 1 }} day(s)</dd>
                <dt>Retained versions</dt><dd>{{ table.versions ?? 0 }}</dd>
              </dl>
              <div class="od__tt">
                <label class="sf-field"><span class="sf-label">Query the table as it was</span>
                  <span class="od__ttrow"><input v-model="ttMinutes" class="sf-input" inputmode="numeric" aria-label="Minutes ago" /><span class="sf-muted">minutes ago</span></span></label>
                <button type="button" class="sf-btn sf-btn--sm" :disabled="!/^\d+$/.test(ttMinutes)" @click="timeTravel">Open in Worksheet</button>
              </div>
            </section>
          </div>
        </div>

        <div v-else-if="tab === 'Columns'" class="sf-table-wrap">
          <table class="sf-table">
            <thead><tr><th>#</th><th>Name</th><th>Type</th><th>Nullable</th><th>Masking policy</th><th class="sf-actions"></th></tr></thead>
            <tbody>
              <tr v-for="(c, i) in table.columns || []" :key="c.name">
                <td class="sf-muted">{{ i + 1 }}</td>
                <td class="sf-mono">{{ c.name }}</td>
                <td class="sf-mono">{{ c.type }}</td>
                <td>{{ c.nullable === false ? 'No' : 'Yes' }}</td>
                <td><span v-if="c.masking_policy || maskedCols[c.name.toUpperCase()]" class="sf-badge sf-badge--warn"><SfIcon name="lock" /> {{ c.masking_policy || maskedCols[c.name.toUpperCase()] }}</span></td>
                <td class="sf-actions">
                  <template v-if="kind === 'tables' && !dropped">
                    <button v-if="c.masking_policy || maskedCols[c.name.toUpperCase()]" type="button" class="sf-btn sf-btn--ghost sf-btn--sm" @click="unsetMask(c.name)">Unset policy</button>
                    <button v-else type="button" class="sf-btn sf-btn--ghost sf-btn--sm" @click="setMask(c.name)">Set masking policy</button>
                  </template>
                </td>
              </tr>
              <tr v-if="!(table.columns || []).length"><td colspan="6"><div class="sf-empty">No columns</div></td></tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="tab === 'Data Preview'" class="od__preview">
          <ResultPane :result="preview" :running="previewing" @open-query="id => sf.go({ page: 'query-history', queryId: id })" />
        </div>

        <div v-else-if="tab === 'Definition'" class="od__def">
          <div class="sf-toolbar"><span class="sf-spacer"></span>
            <button type="button" class="sf-btn sf-btn--sm" @click="copy(tableDdl(table))"><SfIcon name="copy" /> Copy</button>
            <button type="button" class="sf-btn sf-btn--sm" @click="sf.openWorksheet(tableDdl(table), name + ' DDL')"><SfIcon name="worksheet" /> Open in Worksheet</button></div>
          <pre class="sf-code">{{ tableDdl(table) }}</pre>
        </div>

        <div v-else-if="tab === 'Copy History'" class="sf-table-wrap">
          <table class="sf-table">
            <thead><tr><th>File</th><th>Status</th><th class="sf-num">Rows loaded</th><th class="sf-num">Errors</th><th>First error</th></tr></thead>
            <tbody>
              <tr v-for="(l, i) in loads" :key="i">
                <td class="sf-mono"><span class="sf-ellipsis">{{ l.file }}</span></td>
                <td><span class="sf-badge" :class="'sf-badge--' + statusTone(l.status)">{{ l.status }}</span></td>
                <td class="sf-num">{{ fmtNum(l.rows_loaded) }}</td>
                <td class="sf-num">{{ fmtNum(l.errors) }}</td>
                <td class="sf-muted"><span class="sf-ellipsis">{{ l.first_error || '' }}</span></td>
              </tr>
              <tr v-if="!loads.length"><td colspan="5"><div class="sf-empty"><strong>No files loaded into this table</strong><span>COPY INTO loads appear here.</span></div></td></tr>
            </tbody>
          </table>
        </div>

        <GrantsTable v-else-if="tab === 'Privileges'" :on-kind="kind === 'views' ? 'VIEW' : 'TABLE'" :on-name="fqn" />
      </template>

      <!-- STAGE -->
      <template v-else-if="kind === 'stages' && stage">
        <dl class="sf-kv sf-card">
          <dt>Type</dt><dd>{{ stage.url ? 'External (Amazon S3)' : 'Internal' }}</dd>
          <dt>URL</dt><dd class="sf-mono">{{ stage.url || '—' }}</dd>
          <dt>File format</dt><dd>{{ formatText(stage.file_format) || '—' }}</dd>
          <dt>Owner</dt><dd>{{ stage.owner || '—' }}</dd>
          <dt>Comment</dt><dd>{{ stage.comment || '—' }}</dd>
        </dl>
        <div class="sf-toolbar"><h2 class="sf-h3">Files</h2><span class="sf-spacer"></span>
          <button type="button" class="sf-btn sf-btn--sm" @click="loadFromStage"><SfIcon name="upload" /> Load into table</button></div>
        <div class="od__preview"><ResultPane :result="files" :running="previewing" /></div>
      </template>

      <!-- OTHER OBJECTS -->
      <template v-else>
        <dl class="sf-kv sf-card">
          <template v-for="[k, v] in details" :key="k"><dt>{{ k }}</dt><dd :class="{ 'sf-mono': /definition|body|signature/i.test(k) }">{{ v }}</dd></template>
        </dl>
        <pre v-if="definition" class="sf-code">{{ definition }}</pre>
      </template>
    </template>

    <PromptDialog v-if="prompt" v-bind="prompt" @close="prompt = null" @done="afterPrompt" />
  </div>
</template>

<script setup lang="ts">
/**
 * One object's page in the database explorer: a table (details, columns,
 * data preview, definition, copy history, privileges, clustering, Time
 * Travel), a view, a stage (its files), or a pipe / stream / task / file
 * format / policy. Every action runs its DDL on the worksheet surface.
 */
import { computed, ref, watch } from 'vue';
import SfIcon from './SfIcon.vue';
import ResultPane from './ResultPane.vue';
import GrantsTable from './GrantsTable.vue';
import PromptDialog, { type PromptField } from './PromptDialog.vue';
import { useSf, type QueryResult } from './sfContext';
import { clusterColumns, fmtBytes, fmtMinute, fmtNum, formatText, fqnSql, ident, leaf, list, splitFqn, statusTone, str, tableDdl } from './snowflake';

const props = defineProps<{ kind: string; fqn: string; showDropped?: boolean }>();
const sf = useSf();
const view = sf.view;
const parts = computed(() => splitFqn(props.fqn));
const name = computed(() => leaf(props.fqn));
const up = (s: unknown) => String(s || '').toUpperCase();
const same = (a: unknown) => up(a) === up(props.fqn);

const table = computed(() => {
  if (props.kind !== 'tables' && props.kind !== 'views') return null;
  const all = list.tables(view.value).filter(t => same(t.fqn));
  return all.find(t => !t.dropped) || all[0] || null;
});
const stage = computed(() => list.stages(view.value).find(s => same(s.fqn)) || null);
const task = computed(() => list.tasks(view.value).find(t => same(t.fqn)) || null);
const other = computed<Record<string, any> | null>(() => {
  const v = view.value;
  switch (props.kind) {
    case 'pipes': return list.pipes(v).find(x => same(x.fqn)) || null;
    case 'streams': return list.streams(v).find(x => same(x.fqn)) || null;
    case 'tasks': return task.value;
    case 'file-formats': return list.fileFormats(v).find(x => same(x.fqn || x.name)) || null;
    case 'policies': return list.masking(v).find(x => same(x.fqn)) || list.rowAccess(v).find(x => same(x.fqn)) || null;
    default: return null;
  }
});
const isRowPolicy = computed(() => props.kind === 'policies' && list.rowAccess(view.value).some(x => same(x.fqn)));
const exists = computed(() => Boolean(table.value || stage.value || other.value));
const dropped = computed(() => Boolean(table.value?.dropped));

const KIND_LABEL: Record<string, string> = { tables: 'Tables', views: 'Views', stages: 'Stages', 'file-formats': 'File Formats', pipes: 'Pipes', streams: 'Streams', tasks: 'Tasks', policies: 'Policies' };
const KIND_ICON: Record<string, string> = { tables: 'table', views: 'view', stages: 'stage', 'file-formats': 'format', pipes: 'pipe', streams: 'stream', tasks: 'task', policies: 'policy' };
const kindLabel = computed(() => KIND_LABEL[props.kind] || 'Objects');
const icon = computed(() => KIND_ICON[props.kind] || 'table');
const typeLabel = computed(() => {
  if (table.value) {
    const k = up(table.value.kind || 'TABLE');
    return k === 'VIEW' ? (table.value.secure ? 'Secure view' : 'View') : k === 'TRANSIENT' ? 'Transient table' : k === 'EXTERNAL' ? 'External table' : k === 'DYNAMIC' ? 'Dynamic table' : 'Table';
  }
  return ({ stages: 'Stage', 'file-formats': 'File format', pipes: 'Pipe', streams: 'Stream', tasks: 'Task' } as Record<string, string>)[props.kind]
    || (isRowPolicy.value ? 'Row access policy' : 'Masking policy');
});

const tableTabs = computed(() => (props.kind === 'views'
  ? ['View Details', 'Columns', 'Data Preview', 'Definition', 'Privileges']
  : ['Table Details', 'Columns', 'Data Preview', 'Definition', 'Copy History', 'Privileges']));
const tab = ref(tableTabs.value[0]);

const loads = computed(() => list.loads(view.value).filter(l => same(l.table) || up(l.table) === up(name.value)));
const maskedCols = computed(() => {
  const out: Record<string, string> = {};
  for (const p of list.masking(view.value)) {
    for (const col of p.attached || []) {
      const text = up(col);
      const prefix = up(props.fqn) + '.';
      if (text.startsWith(prefix)) out[text.slice(prefix.length)] = p.name;
    }
  }
  return out;
});

const details = computed<[string, string][]>(() => {
  const o = other.value;
  if (!o) return [];
  const rowsOut: [string, string][] = [];
  const show = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return;
    rowsOut.push([label, Array.isArray(value) ? value.join(', ') || '—' : typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)]);
  };
  if (props.kind === 'pipes') { show('Table', o.table); show('Stage', o.stage); show('Auto ingest', o.auto_ingest); show('Files loaded', o.files_loaded); }
  else if (props.kind === 'streams') { show('Source table', o.table); show('Mode', o.mode); show('Stale', o.stale); show('Rows pending', o.rows_pending); }
  else if (props.kind === 'tasks') { show('State', o.state); show('Schedule', o.schedule); show('Warehouse', o.warehouse); show('Last run', fmtMinute(o.last_run)); show('Last state', o.last_state); }
  else if (props.kind === 'file-formats') { show('Type', o.type); for (const [k, v] of Object.entries(o.options || {})) show(k, v); }
  else if (props.kind === 'policies') { show('Signature', o.signature); show('Returns', o.returns); show('Body', o.body); show(isRowPolicy.value ? 'Attached to tables' : 'Attached to columns', o.attached || []); }
  show('Owner', o.owner);
  return rowsOut;
});
const definition = computed(() => String(other.value?.definition || other.value?.body || ''));

const menu = ref(false);
const preview = ref<QueryResult | null>(null);
const files = ref<QueryResult | null>(null);
const previewing = ref(false);
const clusterJson = ref('');
const ttMinutes = ref('5');

async function setTab(t: string) {
  tab.value = t;
  if (t === 'Data Preview' && !preview.value && table.value && !dropped.value) {
    previewing.value = true;
    preview.value = await sf.query(`SELECT * FROM ${fqnSql(props.fqn)} LIMIT 100`, { unlogged: true });
    previewing.value = false;
  }
}
async function listFiles() {
  previewing.value = true;
  files.value = await sf.query(`LIST @${fqnSql(props.fqn)}`);
  previewing.value = false;
}
watch(() => props.kind, k => { if (k === 'stages') void listFiles(); }, { immediate: true });

async function clusteringInfo() {
  const key = clusterColumns(table.value?.clustering_key);
  const cols = key ? `(${key})` : '';
  const r = await sf.query(cols ? `SELECT SYSTEM$CLUSTERING_INFORMATION(${str(props.fqn)}, ${str(cols)})` : `SELECT SYSTEM$CLUSTERING_INFORMATION(${str(props.fqn)})`, { quiet: false });
  if (!r.ok) { clusterJson.value = ''; return; }
  const cell = r.grids[0]?.rows[0]?.[0];
  try { clusterJson.value = JSON.stringify(JSON.parse(String(cell)), null, 2); } catch { clusterJson.value = String(cell ?? r.output); }
}

function openInWorksheet() { sf.openWorksheet(`SELECT *\nFROM ${props.fqn}\nLIMIT 100;\n`, name.value); }
function timeTravel() {
  const seconds = Number(ttMinutes.value) * 60;
  sf.openWorksheet(`-- ${props.fqn} as it was ${ttMinutes.value} minute(s) ago (Time Travel)\nSELECT *\nFROM ${props.fqn} AT(OFFSET => -${seconds})\nLIMIT 100;\n`, name.value + ' (Time Travel)');
}
function loadData() {
  menu.value = false;
  const stageName = list.stages(view.value)[0]?.fqn || 'RAW.SHOP.LAKE_STAGE';
  sf.openWorksheet(`-- Load files from a stage into ${props.fqn}\nLIST @${stageName};\n\nCOPY INTO ${props.fqn}\nFROM @${stageName}\nPATTERN = '.*\\.csv'\nFILE_FORMAT = (FORMAT_NAME = 'RAW.SHOP.CSV_FMT')\nON_ERROR = 'ABORT_STATEMENT';\n`, 'Load ' + name.value);
}
function loadFromStage() {
  sf.openWorksheet(`COPY INTO <database>.<schema>.<table>\nFROM @${props.fqn}\nFILE_FORMAT = (FORMAT_NAME = 'RAW.SHOP.CSV_FMT')\nON_ERROR = 'CONTINUE';\n`, 'Load from ' + name.value);
}

const prompt = ref<null | { title: string; subtitle?: string; message?: string; okText?: string; danger?: boolean; fields: PromptField[]; build: (v: Record<string, string>) => string | string[]; success?: string; then?: (v: Record<string, string>) => void }>(null);
function afterPrompt(v: Record<string, string>) { prompt.value?.then?.(v); }

function cloneTable() {
  menu.value = false;
  prompt.value = {
    title: 'Clone table', subtitle: props.fqn, okText: 'Clone',
    message: 'A clone is zero-copy: it shares the source\'s micro-partitions until either table changes.',
    fields: [
      { key: 'name', label: 'New table name', value: name.value + '_CLONE' },
      { key: 'offset', label: 'Clone as of (minutes ago, optional)', value: '', numeric: true, hint: 'Leave empty to clone the current data. A value uses Time Travel: AT(OFFSET => -seconds).' },
    ],
    build: v => {
      if (!v.name.trim() || (v.offset.trim() && !/^\d+$/.test(v.offset.trim()))) return '';
      const at = v.offset.trim() ? ` AT(OFFSET => -${Number(v.offset.trim()) * 60})` : '';
      return `CREATE TABLE ${ident(parts.value[0])}.${ident(parts.value[1])}.${ident(v.name.trim())} CLONE ${fqnSql(props.fqn)}${at}`;
    },
    success: 'Table cloned',
    then: v => sf.go({ page: 'databases', db: parts.value[0], schema: parts.value[1], kind: 'tables', object: `${parts.value[0]}.${parts.value[1]}.${v.name.trim().toUpperCase()}` }),
  };
}
function renameObject() {
  menu.value = false;
  const word = props.kind === 'views' ? 'VIEW' : 'TABLE';
  prompt.value = {
    title: `Rename ${word.toLowerCase()}`, subtitle: props.fqn, okText: 'Rename',
    fields: [{ key: 'name', label: 'New name', value: name.value }],
    build: v => (v.name.trim() && up(v.name.trim()) !== up(name.value) ? `ALTER ${word} ${fqnSql(props.fqn)} RENAME TO ${ident(parts.value[0])}.${ident(parts.value[1])}.${ident(v.name.trim())}` : ''),
    success: `${word === 'VIEW' ? 'View' : 'Table'} renamed`,
    then: v => sf.go({ page: 'databases', db: parts.value[0], schema: parts.value[1], kind: props.kind, object: `${parts.value[0]}.${parts.value[1]}.${v.name.trim().toUpperCase()}` }),
  };
}
function editRetention() {
  menu.value = false;
  prompt.value = {
    title: 'Edit Time Travel retention', subtitle: props.fqn, okText: 'Save',
    fields: [{ key: 'days', label: 'DATA_RETENTION_TIME_IN_DAYS', value: String(table.value?.retention_days ?? 1), numeric: true, hint: 'Standard edition allows 0-1 days; transient tables allow 0 or 1.' }],
    build: v => (/^\d+$/.test(v.days.trim()) ? `ALTER TABLE ${fqnSql(props.fqn)} SET DATA_RETENTION_TIME_IN_DAYS = ${v.days.trim()}` : ''),
    success: 'Retention updated',
  };
}
function editCluster() {
  menu.value = false;
  const key = clusterColumns(table.value?.clustering_key);
  prompt.value = {
    title: key ? 'Edit clustering key' : 'Add clustering key', subtitle: props.fqn, okText: 'Save',
    fields: [{ key: 'cols', label: 'Clustering key columns', value: key, placeholder: 'e.g. ORDER_DATE, STORE_ID', hint: 'Leave empty to drop the clustering key.' }],
    build: v => {
      const cols = v.cols.split(',').map(c => c.trim()).filter(Boolean);
      if (!cols.length) return key ? `ALTER TABLE ${fqnSql(props.fqn)} DROP CLUSTERING KEY` : '';
      return `ALTER TABLE ${fqnSql(props.fqn)} CLUSTER BY (${cols.map(c => ident(c)).join(', ')})`;
    },
    success: 'Clustering key updated',
  };
}
async function toggleTracking() {
  menu.value = false;
  const on = !table.value?.change_tracking;
  await sf.sql(`ALTER TABLE ${fqnSql(props.fqn)} SET CHANGE_TRACKING = ${on ? 'TRUE' : 'FALSE'}`, { success: `Change tracking ${on ? 'enabled' : 'disabled'}` });
}
function rowPolicy() {
  menu.value = false;
  const current = table.value?.row_access_policy;
  if (current) {
    void (async () => {
      const ok = await sf.confirm({ title: 'Remove row access policy?', message: `${current} will no longer filter rows of ${props.fqn}.`, yes: 'Remove', danger: true });
      if (ok) await sf.sql(`ALTER TABLE ${fqnSql(props.fqn)} DROP ROW ACCESS POLICY ${fqnSql(current)}`, { success: 'Row access policy removed' });
    })();
    return;
  }
  const policies = list.rowAccess(view.value);
  const cols = (table.value?.columns || []).map(c => [c.name, c.name] as [string, string]);
  prompt.value = {
    title: 'Add row access policy', subtitle: props.fqn, okText: 'Add',
    message: policies.length ? '' : 'There are no row access policies yet. Create one in Governance first.',
    fields: [
      { key: 'policy', label: 'Policy', value: policies[0]?.fqn || '', options: policies.map(p => [p.fqn, p.fqn] as [string, string]) },
      { key: 'col', label: 'Column passed to the policy', value: cols[0]?.[0] || '', options: cols },
    ],
    build: v => (v.policy && v.col ? `ALTER TABLE ${fqnSql(props.fqn)} ADD ROW ACCESS POLICY ${fqnSql(v.policy)} ON (${ident(v.col)})` : ''),
    success: 'Row access policy added',
  };
}
function setMask(column: string) {
  const policies = list.masking(view.value);
  prompt.value = {
    title: 'Set masking policy', subtitle: `${props.fqn}.${column}`, okText: 'Apply',
    message: policies.length ? '' : 'There are no masking policies yet. Create one in Governance first.',
    fields: [{ key: 'policy', label: 'Masking policy', value: policies[0]?.fqn || '', options: policies.map(p => [p.fqn, `${p.fqn}${p.signature ? '  ' + p.signature : ''}`] as [string, string]) }],
    build: v => (v.policy ? `ALTER TABLE ${fqnSql(props.fqn)} MODIFY COLUMN ${ident(column)} SET MASKING POLICY ${fqnSql(v.policy)}` : ''),
    success: `Masking policy applied to ${column}`,
  };
}
async function unsetMask(column: string) {
  const ok = await sf.confirm({ title: 'Unset masking policy?', message: `${column} will be readable in clear text by every role with SELECT on ${props.fqn}.`, yes: 'Unset', danger: true });
  if (ok) await sf.sql(`ALTER TABLE ${fqnSql(props.fqn)} MODIFY COLUMN ${ident(column)} UNSET MASKING POLICY`, { success: `Masking policy removed from ${column}` });
}
async function refreshPipe() {
  menu.value = false;
  await sf.sql(`ALTER PIPE ${fqnSql(props.fqn)} REFRESH`, { success: 'Pipe refreshed' });
}
async function taskAction(action: 'RESUME' | 'SUSPEND') {
  await sf.sql(`ALTER TASK ${fqnSql(props.fqn)} ${action}`, { success: `Task ${action === 'RESUME' ? 'resumed' : 'suspended'}` });
}
async function executeTask() {
  await sf.sql(`EXECUTE TASK ${fqnSql(props.fqn)}`, { success: 'Task run started' });
}

const DROP_WORD: Record<string, string> = { tables: 'TABLE', views: 'VIEW', stages: 'STAGE', 'file-formats': 'FILE FORMAT', pipes: 'PIPE', streams: 'STREAM', tasks: 'TASK' };
async function dropObject() {
  menu.value = false;
  const word = props.kind === 'policies' ? (isRowPolicy.value ? 'ROW ACCESS POLICY' : 'MASKING POLICY') : DROP_WORD[props.kind] || 'TABLE';
  const note = props.kind === 'tables' ? ' You can restore it with UNDROP TABLE within its retention period.' : ' This cannot be undone.';
  const ok = await sf.confirm({ title: `Drop ${word.toLowerCase()} ${name.value}?`, message: `${props.fqn} will be dropped.${note}`, yes: 'Drop', danger: true });
  if (!ok) return;
  const r = await sf.sql(`DROP ${word} ${fqnSql(props.fqn)}`, { success: `${name.value} dropped` });
  if (r.ok && !props.showDropped) sf.go({ page: 'databases', db: parts.value[0], schema: parts.value[1], kind: props.kind });
}
async function undropTable() {
  menu.value = false;
  await sf.sql(`UNDROP ${props.kind === 'views' ? 'VIEW' : 'TABLE'} ${fqnSql(props.fqn)}`, { success: `${name.value} restored` });
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); sf.notify('success', 'Copied to clipboard'); } catch { /* refused */ }
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.od__icon { width: 36px; height: 36px; border-radius: 8px; background: var(--sf-selected); color: var(--sf-primary-text); display: grid; place-items: center; flex: none; }
.od__icon .sf-ico { width: 20px; height: 20px; }
.od__title { display: flex; flex-direction: column; min-width: 0; }
.od__menu { right: 0; top: calc(100% + 4px); min-width: 230px; }
.od__cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px; align-items: start; }
.od__side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.od__sec { display: flex; flex-direction: column; gap: 10px; }
.od__json { max-height: 220px; }
.od__tt { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
.od__ttrow { display: flex; align-items: center; gap: 8px; }
.od__ttrow .sf-input { width: 90px; }
.od__preview { border: 1px solid var(--sf-border); border-radius: var(--sf-radius-lg); min-height: 320px; display: flex; flex-direction: column; overflow: hidden; }
.od__def { display: flex; flex-direction: column; gap: 8px; }
</style>
