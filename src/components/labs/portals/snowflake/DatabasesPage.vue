<template>
  <div class="dbx">
    <!-- ===== Object explorer tree ===== -->
    <aside class="dbx__tree">
      <div class="dbx__treehead">
        <div class="sf-search"><SfIcon name="search" /><input v-model="filter" class="sf-input" placeholder="Search" aria-label="Search databases" /></div>
        <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon sf-btn--sm" title="Refresh" aria-label="Refresh" @click="sf.notify('info', 'Objects refreshed')"><SfIcon name="refresh" /></button>
      </div>
      <label class="sf-check dbx__dropped"><input v-model="showDropped" type="checkbox" /> Show dropped objects</label>
      <div class="dbx__nodes">
        <template v-for="db in treeDbs" :key="db.name">
          <div class="dbx__node" :class="{ 'is-active': isSel(db.name), 'is-dropped': db.dropped }">
            <button type="button" class="dbx__twist" :aria-label="(open[db.name] ? 'Collapse ' : 'Expand ') + db.name" @click="open[db.name] = !open[db.name]">
              <SfIcon :name="open[db.name] ? 'chevron-down' : 'chevron-right'" />
            </button>
            <button type="button" class="dbx__label" @click="select({ db: db.name })"><SfIcon name="database" /><span>{{ db.name }}</span></button>
          </div>
          <template v-if="open[db.name]">
            <template v-for="sc in schemasOf(db.name)" :key="db.name + '.' + sc.name">
              <div class="dbx__node dbx__node--2" :class="{ 'is-active': isSel(db.name, sc.name), 'is-dropped': sc.dropped }">
                <button type="button" class="dbx__twist" :aria-label="'Expand ' + sc.name" @click="open[db.name + '.' + sc.name] = !open[db.name + '.' + sc.name]">
                  <SfIcon :name="open[db.name + '.' + sc.name] ? 'chevron-down' : 'chevron-right'" />
                </button>
                <button type="button" class="dbx__label" @click="select({ db: db.name, schema: sc.name })"><SfIcon name="schema" /><span>{{ sc.name }}</span></button>
              </div>
              <template v-if="open[db.name + '.' + sc.name]">
                <template v-for="group in groupsOf(db.name, sc.name)" :key="group.kind">
                  <div class="dbx__node dbx__node--3">
                    <button type="button" class="dbx__twist" @click="open[db.name + '.' + sc.name + ':' + group.kind] = !open[db.name + '.' + sc.name + ':' + group.kind]">
                      <SfIcon :name="open[db.name + '.' + sc.name + ':' + group.kind] ? 'chevron-down' : 'chevron-right'" />
                    </button>
                    <button type="button" class="dbx__label dbx__label--group" @click="select({ db: db.name, schema: sc.name, kind: group.kind })">
                      <span>{{ group.label }}</span><span class="dbx__count">{{ group.items.length }}</span>
                    </button>
                  </div>
                  <template v-if="open[db.name + '.' + sc.name + ':' + group.kind]">
                    <div v-for="item in group.items" :key="item.fqn" class="dbx__node dbx__node--4"
                         :class="{ 'is-active': route.object === item.fqn, 'is-dropped': item.dropped }">
                      <button type="button" class="dbx__label" @click="select({ db: db.name, schema: sc.name, kind: group.kind, object: item.fqn })">
                        <SfIcon :name="group.icon" /><span>{{ item.name }}</span>
                      </button>
                    </div>
                  </template>
                </template>
              </template>
            </template>
          </template>
        </template>
      </div>
    </aside>

    <!-- ===== Detail ===== -->
    <section class="dbx__detail">
      <ObjectDetail v-if="route.object" :key="route.object" :kind="route.kind || 'tables'" :fqn="route.object" :show-dropped="showDropped" />

      <!-- Schema -->
      <div v-else-if="route.db && route.schema" class="sf-page">
        <div class="sf-crumbs">
          <button type="button" @click="select({})">Databases</button><SfIcon name="chevron-right" />
          <button type="button" @click="select({ db: route.db })">{{ route.db }}</button><SfIcon name="chevron-right" />
          <span>{{ route.schema }}</span>
        </div>
        <div class="sf-page-head">
          <span class="dbx__bigicon"><SfIcon name="schema" /></span>
          <h1 class="sf-h1">{{ route.schema }}</h1>
          <span v-if="schema?.dropped" class="sf-badge sf-badge--bad">Dropped</span>
          <span class="sf-spacer"></span>
          <div class="sf-rel">
            <button type="button" class="sf-btn sf-btn--primary" :disabled="schema?.dropped" @click="createMenu = !createMenu"><SfIcon name="plus" /> Create <SfIcon name="chevron-down" /></button>
            <div v-if="createMenu" class="sf-menu dbx__rmenu" @mouseleave="createMenu = false">
              <button v-for="c in CREATES" :key="c[0]" type="button" @click="createMenu = false; sf.create(c[0], { database: route.db!, schema: route.schema! })"><SfIcon :name="c[2]" /> {{ c[1] }}</button>
            </div>
          </div>
          <div class="sf-rel">
            <button type="button" class="sf-btn sf-btn--icon" aria-label="Schema actions" @click="actMenu = !actMenu"><SfIcon name="more" /></button>
            <div v-if="actMenu" class="sf-menu dbx__rmenu" @mouseleave="actMenu = false">
              <button type="button" :disabled="schema?.dropped" @click="cloneSchema"><SfIcon name="clone" /> Clone</button>
              <button type="button" :disabled="schema?.dropped" @click="editSchema"><SfIcon name="edit" /> Edit</button>
              <hr />
              <button v-if="schema?.dropped" type="button" @click="undrop('SCHEMA', route.db + '.' + route.schema)"><SfIcon name="undo" /> Undrop</button>
              <button v-else type="button" class="is-danger" @click="dropSchema"><SfIcon name="trash" /> Drop</button>
            </div>
          </div>
        </div>
        <dl class="sf-kv sf-card">
          <dt>Database</dt><dd>{{ route.db }}</dd>
          <dt>Owner</dt><dd>{{ schema?.owner || '—' }}</dd>
          <dt>Managed access</dt><dd>{{ schema?.managed_access ? 'Yes' : 'No' }}</dd>
        </dl>
        <div class="sf-tabs">
          <button v-for="g in groupsOf(route.db, route.schema)" :key="g.kind" type="button" class="sf-tab" :class="{ 'is-active': schemaTab === g.kind }" @click="select({ db: route.db, schema: route.schema, kind: g.kind })">
            {{ g.label }} ({{ g.items.length }})
          </button>
        </div>
        <div class="sf-table-wrap">
          <table class="sf-table">
            <thead><tr><th>Name</th><th>Type</th><th class="sf-num">Rows</th><th class="sf-num">Bytes</th><th>Owner</th></tr></thead>
            <tbody>
              <tr v-for="item in currentGroup?.items || []" :key="item.fqn" class="is-clickable"
                  @click="select({ db: route.db, schema: route.schema, kind: currentGroup!.kind, object: item.fqn })">
                <td><span class="sf-cell-name"><SfIcon :name="currentGroup!.icon" /><span>{{ item.name }}</span>
                  <span v-if="item.dropped" class="sf-badge sf-badge--bad">Dropped</span></span></td>
                <td class="sf-muted">{{ item.type }}</td>
                <td class="sf-num">{{ item.rows === undefined ? '' : fmtNum(item.rows) }}</td>
                <td class="sf-num">{{ item.bytes === undefined ? '' : fmtBytes(item.bytes) }}</td>
                <td class="sf-muted">{{ item.owner || '' }}</td>
              </tr>
              <tr v-if="!(currentGroup?.items || []).length"><td colspan="5"><div class="sf-empty"><strong>No {{ currentGroup?.label.toLowerCase() || 'objects' }}</strong><span>Use Create to add one.</span></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Database -->
      <div v-else-if="route.db" class="sf-page">
        <div class="sf-crumbs"><button type="button" @click="select({})">Databases</button><SfIcon name="chevron-right" /><span>{{ route.db }}</span></div>
        <div class="sf-page-head">
          <span class="dbx__bigicon"><SfIcon name="database" /></span>
          <h1 class="sf-h1">{{ route.db }}</h1>
          <span v-if="database?.dropped" class="sf-badge sf-badge--bad">Dropped</span>
          <span class="sf-spacer"></span>
          <button type="button" class="sf-btn sf-btn--primary" :disabled="database?.dropped" @click="sf.create('schema', { database: route.db! })"><SfIcon name="plus" /> Schema</button>
          <div class="sf-rel">
            <button type="button" class="sf-btn sf-btn--icon" aria-label="Database actions" @click="actMenu = !actMenu"><SfIcon name="more" /></button>
            <div v-if="actMenu" class="sf-menu dbx__rmenu" @mouseleave="actMenu = false">
              <button type="button" :disabled="database?.dropped" @click="cloneDatabase"><SfIcon name="clone" /> Clone</button>
              <button type="button" :disabled="database?.dropped" @click="editDatabase"><SfIcon name="edit" /> Edit</button>
              <hr />
              <button v-if="database?.dropped" type="button" @click="undrop('DATABASE', route.db!)"><SfIcon name="undo" /> Undrop</button>
              <button v-else type="button" class="is-danger" @click="dropDatabase"><SfIcon name="trash" /> Drop</button>
            </div>
          </div>
        </div>
        <div class="sf-tabs">
          <button type="button" class="sf-tab" :class="{ 'is-active': dbTab === 'details' }" @click="dbTab = 'details'">Database Details</button>
          <button type="button" class="sf-tab" :class="{ 'is-active': dbTab === 'schemas' }" @click="dbTab = 'schemas'">Schemas</button>
          <button type="button" class="sf-tab" :class="{ 'is-active': dbTab === 'privileges' }" @click="dbTab = 'privileges'">Privileges</button>
        </div>
        <dl v-if="dbTab === 'details'" class="sf-kv sf-card">
          <dt>Owner</dt><dd>{{ database?.owner || '—' }}</dd>
          <dt>Created</dt><dd>{{ fmtMinute(database?.created) || '—' }}</dd>
          <dt>Data retention</dt><dd>{{ database?.retention_days ?? 1 }} day(s)</dd>
          <dt>Comment</dt><dd>{{ database?.comment || '—' }}</dd>
          <dt>Schemas</dt><dd>{{ schemasOf(route.db).length }}</dd>
        </dl>
        <div v-else-if="dbTab === 'schemas'" class="sf-table-wrap">
          <table class="sf-table">
            <thead><tr><th>Name</th><th>Owner</th><th class="sf-num">Objects</th><th>Managed access</th></tr></thead>
            <tbody>
              <tr v-for="sc in schemasOf(route.db)" :key="sc.name" class="is-clickable" @click="select({ db: route.db, schema: sc.name })">
                <td><span class="sf-cell-name"><SfIcon name="schema" />{{ sc.name }}<span v-if="sc.dropped" class="sf-badge sf-badge--bad">Dropped</span></span></td>
                <td class="sf-muted">{{ sc.owner || '' }}</td>
                <td class="sf-num">{{ groupsOf(route.db, sc.name).reduce((n, g) => n + g.items.length, 0) }}</td>
                <td>{{ sc.managed_access ? 'Yes' : 'No' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <GrantsTable v-else on-kind="DATABASE" :on-name="route.db" />
      </div>

      <!-- All databases -->
      <div v-else class="sf-page">
        <div class="sf-page-head">
          <h1 class="sf-h1">Databases</h1>
          <span class="sf-muted">{{ allDbs.length }} databases</span>
          <span class="sf-spacer"></span>
          <button type="button" class="sf-btn" title="UNDROP a database, schema or table by name" @click="restoreDropped"><SfIcon name="undo" /> Undrop</button>
          <button type="button" class="sf-btn sf-btn--primary" @click="sf.create('database')"><SfIcon name="plus" /> Database</button>
        </div>
        <div class="sf-table-wrap">
          <table class="sf-table">
            <thead><tr><th>Name</th><th>Source</th><th>Owner</th><th>Retention</th><th>Comment</th><th class="sf-actions"></th></tr></thead>
            <tbody>
              <tr v-for="db in allDbs" :key="db.name" class="is-clickable" @click="select({ db: db.name })">
                <td><span class="sf-cell-name"><SfIcon name="database" />{{ db.name }}<span v-if="db.dropped" class="sf-badge sf-badge--bad">Dropped</span></span></td>
                <td class="sf-muted">{{ db.clone_of ? 'Clone of ' + db.clone_of : db.transient ? 'Transient' : 'Local' }}</td>
                <td class="sf-muted">{{ db.owner || '' }}</td>
                <td>{{ db.retention_days ?? 1 }} day(s)</td>
                <td class="sf-muted"><span class="sf-ellipsis">{{ db.comment || '' }}</span></td>
                <td class="sf-actions sf-rel" @click.stop>
                  <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon sf-btn--sm" :aria-label="'Actions for ' + db.name" @click="rowMenu = rowMenu === db.name ? '' : db.name"><SfIcon name="more" /></button>
                  <div v-if="rowMenu === db.name" class="sf-menu dbx__rowmenu" @mouseleave="rowMenu = ''">
                    <button v-if="db.dropped" type="button" @click="rowMenu = ''; undrop('DATABASE', db.name)"><SfIcon name="undo" /> Undrop</button>
                    <template v-else>
                      <button type="button" @click="rowMenu = ''; select({ db: db.name }); cloneDatabase()"><SfIcon name="clone" /> Clone</button>
                      <button type="button" class="is-danger" @click="rowMenu = ''; select({ db: db.name }); dropDatabase()"><SfIcon name="trash" /> Drop</button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <PromptDialog v-if="prompt" v-bind="prompt" @close="prompt = null" @done="afterPrompt" />
  </div>
</template>

<script setup lang="ts">
/**
 * Data > Databases: the object explorer. Databases, their schemas, and every
 * object in a schema by type; each create, clone, edit, drop and undrop runs
 * the DDL it stands for.
 */
import { computed, reactive, ref, watch } from 'vue';
import SfIcon from './SfIcon.vue';
import ObjectDetail from './ObjectDetail.vue';
import GrantsTable from './GrantsTable.vue';
import PromptDialog, { type PromptField } from './PromptDialog.vue';
import { useSf, type CreateKind } from './sfContext';
import { fmtBytes, fmtMinute, fmtNum, ident, inSchema, leaf, list, str } from './snowflake';

const sf = useSf();
const view = sf.view;
const route = computed(() => {
  const r = sf.route.value;
  return r.page === 'databases' ? r : { page: 'databases' as const };
});

const filter = ref('');
const showDropped = ref(false);
const open = reactive<Record<string, boolean>>({});
const createMenu = ref(false);
const actMenu = ref(false);
const rowMenu = ref('');
const dbTab = ref<'details' | 'schemas' | 'privileges'>('schemas');

const CREATES: [CreateKind, string, string][] = [
  ['table', 'Table', 'table'], ['view', 'View', 'view'], ['stage', 'Stage', 'stage'], ['file-format', 'File format', 'format'],
  ['pipe', 'Pipe', 'pipe'], ['stream', 'Stream', 'stream'], ['task', 'Task', 'task'],
  ['masking-policy', 'Masking policy', 'policy'], ['row-access-policy', 'Row access policy', 'policy'],
];

const allDbs = computed(() => list.databases(view.value).filter(d => showDropped.value || !d.dropped));
const treeDbs = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  if (!needle) return allDbs.value;
  return allDbs.value.filter(d => d.name.toLowerCase().includes(needle)
    || list.tables(view.value).some(t => String(t.database).toUpperCase() === d.name.toUpperCase() && t.name.toLowerCase().includes(needle)));
});
function schemasOf(db?: string) {
  if (!db) return [];
  return list.schemas(view.value).filter(s => s.database.toUpperCase() === db.toUpperCase() && (showDropped.value || !s.dropped));
}

interface TreeItem { name: string; fqn: string; dropped?: boolean; type: string; rows?: number; bytes?: number; owner?: string }
interface Group { kind: string; label: string; icon: string; items: TreeItem[] }

function groupsOf(db?: string, schema?: string): Group[] {
  if (!db || !schema) return [];
  const v = view.value;
  const needle = filter.value.trim().toLowerCase();
  const keep = (name: string, dropped?: boolean) => (showDropped.value || !dropped) && (!needle || name.toLowerCase().includes(needle) || db.toLowerCase().includes(needle));
  const tables = inSchema(list.tables(v), db, schema);
  const mk = (items: TreeItem[]) => items.filter(i => keep(i.name, i.dropped));
  const named = <T extends { fqn: string; name?: string }>(xs: T[], type: string): TreeItem[] => xs.map(x => ({ name: x.name || leaf(x.fqn), fqn: x.fqn, type }));
  return [
    { kind: 'tables', label: 'Tables', icon: 'table', items: mk(tables.filter(t => String(t.kind || 'TABLE').toUpperCase() !== 'VIEW').map(t => ({ name: t.name, fqn: t.fqn, dropped: t.dropped, type: String(t.kind || 'TABLE'), rows: t.rows, bytes: t.bytes, owner: t.owner }))) },
    { kind: 'views', label: 'Views', icon: 'view', items: mk(tables.filter(t => String(t.kind).toUpperCase() === 'VIEW').map(t => ({ name: t.name, fqn: t.fqn, dropped: t.dropped, type: 'VIEW', owner: t.owner }))) },
    { kind: 'stages', label: 'Stages', icon: 'stage', items: mk(named(inSchema(list.stages(v), db, schema), 'External stage')) },
    { kind: 'file-formats', label: 'File Formats', icon: 'format', items: mk(inSchema(list.fileFormats(v).map(f => ({ ...f, fqn: f.fqn || f.name })), db, schema).map(f => ({ name: leaf(f.fqn), fqn: f.fqn, type: f.type }))) },
    { kind: 'pipes', label: 'Pipes', icon: 'pipe', items: mk(named(inSchema(list.pipes(v), db, schema), 'Pipe')) },
    { kind: 'streams', label: 'Streams', icon: 'stream', items: mk(named(inSchema(list.streams(v), db, schema), 'Stream')) },
    { kind: 'tasks', label: 'Tasks', icon: 'task', items: mk(named(inSchema(list.tasks(v), db, schema), 'Task')) },
    { kind: 'policies', label: 'Policies', icon: 'policy', items: mk([...named(inSchema(list.masking(v), db, schema), 'Masking policy'), ...named(inSchema(list.rowAccess(v), db, schema), 'Row access policy')]) },
  ];
}

const database = computed(() => list.databases(view.value).find(d => d.name.toUpperCase() === String(route.value.db || '').toUpperCase()));
const schema = computed(() => schemasOf(route.value.db).find(s => s.name.toUpperCase() === String(route.value.schema || '').toUpperCase())
  || list.schemas(view.value).find(s => s.database.toUpperCase() === String(route.value.db || '').toUpperCase() && s.name.toUpperCase() === String(route.value.schema || '').toUpperCase()));
const schemaTab = computed(() => route.value.kind || 'tables');
const currentGroup = computed(() => groupsOf(route.value.db, route.value.schema).find(g => g.kind === schemaTab.value));

function select(target: { db?: string; schema?: string; kind?: string; object?: string }) {
  if (target.db) open[target.db] = true;
  if (target.db && target.schema) open[target.db + '.' + target.schema] = true;
  if (target.db && target.schema && target.kind && target.object) open[target.db + '.' + target.schema + ':' + target.kind] = true;
  actMenu.value = false;
  createMenu.value = false;
  sf.go({ page: 'databases', ...target });
}
function isSel(db: string, schema?: string) {
  const r = route.value;
  return !r.object && !r.kind && r.db === db && (schema ? r.schema === schema : !r.schema);
}
// Open the session's current database in the tree on arrival.
const curDb = sf.current.value.database;
if (curDb) { open[curDb] = true; if (sf.current.value.schema) open[curDb + '.' + sf.current.value.schema] = true; }
watch(() => route.value.db, () => { dbTab.value = 'schemas'; });

/* --------------------------------------------------------------- actions */

const prompt = ref<null | { title: string; subtitle?: string; message?: string; okText?: string; danger?: boolean; fields: PromptField[]; build: (v: Record<string, string>) => string | string[]; success?: string; then?: (v: Record<string, string>) => void }>(null);
function afterPrompt(values: Record<string, string>) { prompt.value?.then?.(values); }

function cloneDatabase() {
  actMenu.value = false;
  const db = String(route.value.db || '');
  prompt.value = {
    title: 'Clone database', subtitle: db, okText: 'Clone',
    fields: [{ key: 'name', label: 'New database name', value: db + '_CLONE' }],
    build: v => (v.name.trim() ? `CREATE DATABASE ${ident(v.name.trim())} CLONE ${ident(db)}` : ''),
    success: 'Database cloned', then: v => select({ db: v.name.trim().toUpperCase() }),
  };
}
function editDatabase() {
  actMenu.value = false;
  const db = String(route.value.db || '');
  prompt.value = {
    title: 'Edit database', subtitle: db, okText: 'Save',
    fields: [
      { key: 'retention', label: 'Data retention time (days)', value: String(database.value?.retention_days ?? 1), numeric: true },
      { key: 'comment', label: 'Comment', value: database.value?.comment || '', type: 'textarea' },
    ],
    build: v => {
      if (!/^\d+$/.test(v.retention.trim())) return '';
      return [`ALTER DATABASE ${ident(db)} SET DATA_RETENTION_TIME_IN_DAYS = ${v.retention.trim()}`,
        `ALTER DATABASE ${ident(db)} SET COMMENT = ${str(v.comment)}`];
    },
    success: 'Database updated',
  };
}
async function dropDatabase() {
  actMenu.value = false;
  const db = String(route.value.db || '');
  const ok = await sf.confirm({ title: `Drop database ${db}?`, message: `Dropping ${db} drops every schema and table in it. You can restore it with UNDROP DATABASE within its data retention period.`, yes: 'Drop Database', danger: true, typeToConfirm: db });
  if (!ok) return;
  const r = await sf.sql(`DROP DATABASE ${ident(db)}`, { success: `Database ${db} dropped` });
  if (r.ok) select({});
}
function cloneSchema() {
  actMenu.value = false;
  const { db, schema: sc } = route.value as { db: string; schema: string };
  prompt.value = {
    title: 'Clone schema', subtitle: `${db}.${sc}`, okText: 'Clone',
    fields: [{ key: 'name', label: 'New schema name', value: sc + '_CLONE' }],
    build: v => (v.name.trim() ? `CREATE SCHEMA ${ident(db)}.${ident(v.name.trim())} CLONE ${ident(db)}.${ident(sc)}` : ''),
    success: 'Schema cloned',
  };
}
function editSchema() {
  actMenu.value = false;
  const { db, schema: sc } = route.value as { db: string; schema: string };
  prompt.value = {
    title: 'Edit schema', subtitle: `${db}.${sc}`, okText: 'Save',
    fields: [{ key: 'retention', label: 'Data retention time (days)', value: '1', numeric: true }],
    build: v => (/^\d+$/.test(v.retention.trim()) ? `ALTER SCHEMA ${ident(db)}.${ident(sc)} SET DATA_RETENTION_TIME_IN_DAYS = ${v.retention.trim()}` : ''),
    success: 'Schema updated',
  };
}
async function dropSchema() {
  actMenu.value = false;
  const { db, schema: sc } = route.value as { db: string; schema: string };
  const ok = await sf.confirm({ title: `Drop schema ${sc}?`, message: `Every table and view in ${db}.${sc} will be dropped. You can restore the schema with UNDROP SCHEMA within its retention period.`, yes: 'Drop Schema', danger: true });
  if (!ok) return;
  const r = await sf.sql(`DROP SCHEMA ${ident(db)}.${ident(sc)}`, { success: `Schema ${sc} dropped` });
  if (r.ok) select({ db });
}
function restoreDropped() {
  prompt.value = {
    title: 'Undrop object', okText: 'Undrop',
    message: 'Restore a dropped object from Time Travel. It must still be within its data retention period, and no object with the same name may exist.',
    fields: [
      { key: 'kind', label: 'Object type', value: 'DATABASE', options: [['DATABASE', 'Database'], ['SCHEMA', 'Schema'], ['TABLE', 'Table']] },
      { key: 'name', label: 'Name', value: '', placeholder: 'e.g. SANDBOX, SANDBOX.LAB or SANDBOX.LAB.EVENTS' },
    ],
    build: v => {
      const parts = v.name.split('.').map(p => p.trim()).filter(Boolean);
      const want = v.kind === 'DATABASE' ? 1 : v.kind === 'SCHEMA' ? 2 : 3;
      return parts.length === want ? `UNDROP ${v.kind} ${parts.map(p => ident(p)).join('.')}` : '';
    },
    success: 'Object restored',
  };
}
async function undrop(kind: 'DATABASE' | 'SCHEMA', name: string) {
  actMenu.value = false;
  const target = name.split('.').map(p => ident(p)).join('.');
  await sf.sql(`UNDROP ${kind} ${target}`, { success: `${kind === 'DATABASE' ? 'Database' : 'Schema'} ${name} restored` });
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.dbx { flex: 1; min-height: 0; display: flex; }
.dbx__tree { width: 280px; flex: none; border-right: 1px solid var(--sf-border); display: flex; flex-direction: column; min-height: 0; background: var(--sf-bg); }
.dbx__treehead { display: flex; gap: 6px; padding: 12px 10px 6px; }
.dbx__treehead .sf-search { flex: 1; }
.dbx__treehead .sf-input { height: 30px; font-size: 12px; }
.dbx__dropped { padding: 0 12px 8px; font-size: 12px; color: var(--sf-text-2); }
.dbx__nodes { flex: 1; overflow: auto; padding: 0 6px 12px; }
.dbx__node { display: flex; align-items: center; min-width: 0; border-radius: 4px; }
.dbx__node:hover { background: var(--sf-hover); }
.dbx__node.is-active { background: var(--sf-selected); }
.dbx__node.is-active .dbx__label { color: var(--sf-primary-text); font-weight: 600; }
.dbx__node.is-dropped .dbx__label span:first-of-type { text-decoration: line-through; color: var(--sf-text-3); }
.dbx__node--2 { padding-left: 16px; }
.dbx__node--3 { padding-left: 32px; }
.dbx__node--4 { padding-left: 66px; }
.dbx__twist { flex: none; width: 20px; height: 26px; border: 0; background: none; color: var(--sf-text-3); cursor: pointer; display: grid; place-items: center; padding: 0; }
.dbx__twist .sf-ico { width: 12px; height: 12px; }
.dbx__label { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; height: 26px; border: 0; background: none; font: inherit; font-size: 12.5px; color: var(--sf-text); cursor: pointer; text-align: left; padding: 0 4px; }
.dbx__label span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dbx__label .sf-ico { width: 14px; height: 14px; color: var(--sf-text-2); }
.dbx__label--group { color: var(--sf-text-2); }
.dbx__count { margin-left: auto; font-size: 11px; color: var(--sf-text-3); padding-right: 6px; }
.dbx__detail { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.dbx__bigicon { width: 32px; height: 32px; border-radius: 8px; background: var(--sf-selected); color: var(--sf-primary-text); display: grid; place-items: center; }
.dbx__rmenu { right: 0; top: calc(100% + 4px); }
.dbx__rowmenu { right: 8px; top: 34px; }
@container sl-portal (max-width: 900px) {
  .dbx { flex-direction: column; }
  .dbx__tree { width: auto; max-height: 220px; border-right: 0; border-bottom: 1px solid var(--sf-border); }
}
</style>
