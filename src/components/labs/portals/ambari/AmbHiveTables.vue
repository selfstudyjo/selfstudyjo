<template>
  <div class="ht">
    <!-- Databases -->
    <aside class="ht__dbs panel">
      <div class="panel-heading">
        <h4>Databases</h4>
        <span class="spacer"></span>
        <button type="button" class="btn btn-default btn-sm" title="New database" :disabled="busy" @click="openNewDb"><AmbIcon name="plus" :size="11" /></button>
      </div>
      <ul class="ht__list">
        <li v-for="db in databases" :key="db" :class="{ active: db === selectedDb }">
          <button type="button" class="ht__item" @click="selectDb(db)">
            <AmbIcon name="database" :size="13" /> {{ db }}
            <span class="ht__count">{{ tables.filter(t => t.db === db).length }}</span>
          </button>
          <button v-if="db !== 'default'" type="button" class="ht__del" :title="`Delete ${db}`" @click="dropDb = db">
            <AmbIcon name="trash" :size="12" />
          </button>
        </li>
      </ul>
    </aside>

    <!-- Tables of the database, or one table -->
    <section class="ht__main">
      <template v-if="!table">
        <div class="toolbar">
          <h3 class="ht__title">{{ selectedDb }}</h3>
          <span class="spacer"></span>
          <input v-model="filter" class="form-control ht__filter" placeholder="Search tables" aria-label="Search tables" />
          <button type="button" class="btn btn-success" :disabled="busy" @click="openWizard"><AmbIcon name="plus" :size="11" />New Table</button>
        </div>
        <div class="panel table-wrap">
          <table class="table">
            <thead><tr><th>Table Name</th><th>Type</th><th>Format</th><th>Rows</th><th>Size</th><th>Location</th></tr></thead>
            <tbody>
              <tr v-for="t in dbTables" :key="t.name">
                <td><a href="#" @click.prevent="open(t.name)"><AmbIcon name="table" :size="13" /> {{ t.name }}</a></td>
                <td>{{ t.external ? 'EXTERNAL_TABLE' : 'MANAGED_TABLE' }}</td>
                <td>{{ t.format }}</td>
                <td>{{ t.rows }}</td>
                <td>{{ t.size_h }}</td>
                <td class="mono ht__loc" :title="t.location">{{ t.location }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!dbTables.length" class="empty">No tables in {{ selectedDb }}.</div>
        </div>
      </template>

      <template v-else>
        <div class="toolbar">
          <a href="#" @click.prevent="opened = ''">{{ selectedDb }}</a><span class="text-muted">/</span>
          <h3 class="ht__title">{{ table.name }}</h3>
          <span class="spacer"></span>
          <button type="button" class="btn btn-default" @click="$emit('query', `SELECT * FROM ${table.db}.${table.name} LIMIT 100`)">Query</button>
          <button type="button" class="btn btn-default" :disabled="busy" @click="openEdit"><AmbIcon name="edit" :size="11" />Edit</button>
          <button type="button" class="btn btn-danger" :disabled="busy" @click="dropping = true"><AmbIcon name="trash" :size="11" />Delete</button>
        </div>
        <ul class="nav-tabs">
          <li v-for="t in DETAIL_TABS" :key="t" :class="{ active: dtab === t }"><a href="#" @click.prevent="dtab = t">{{ t }}</a></li>
        </ul>
        <div class="panel">
          <div v-if="dtab === 'Columns'" class="table-wrap">
            <table class="table">
              <thead><tr><th>#</th><th>Column Name</th><th>Data Type</th><th>Partitioned</th></tr></thead>
              <tbody>
                <tr v-for="(col, i) in allColumns" :key="col.name">
                  <td>{{ i + 1 }}</td><td>{{ col.name }}</td><td>{{ String(col.type).toUpperCase() }}</td>
                  <td>{{ col.partition ? 'Yes' : '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <pre v-else-if="dtab === 'DDL'" class="ht__ddl">{{ ddl }}</pre>
          <table v-else-if="dtab === 'Storage Information'" class="table ht__kv">
            <tbody>
              <tr><th>Location</th><td class="mono">hdfs://namenode:8020{{ table.location }}</td></tr>
              <tr><th>Input Format</th><td class="mono">{{ inputFormat }}</td></tr>
              <tr><th>Compressed</th><td>No</td></tr>
              <tr><th>Num Buckets</th><td>-1</td></tr>
            </tbody>
          </table>
          <table v-else-if="dtab === 'Detailed Information'" class="table ht__kv">
            <tbody>
              <tr><th>Database</th><td>{{ table.db }}</td></tr>
              <tr><th>Owner</th><td>lab</td></tr>
              <tr><th>Table Type</th><td>{{ table.external ? 'EXTERNAL_TABLE' : 'MANAGED_TABLE' }}</td></tr>
              <tr><th>Storage Format</th><td>{{ table.format }}</td></tr>
            </tbody>
          </table>
          <table v-else class="table ht__kv">
            <tbody>
              <tr><th>Number of Rows</th><td>{{ table.rows }}</td></tr>
              <tr><th>Raw Data Size</th><td>{{ table.size_h }}</td></tr>
              <tr><th>Column Stats Accurate</th><td>{{ table.rows ? 'true' : 'false' }}</td></tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <!-- NEW DATABASE -->
    <AmbModal v-if="newDb !== null" title="Create Database" ok-text="Create" small :busy="busy"
              :ok-disabled="!!dbError || !newDb.trim()" @close="newDb = null" @ok="createDb">
      <div class="form-group" :class="{ 'has-error': dbError }">
        <label for="ht-db">Database name</label>
        <input id="ht-db" v-model="newDb" class="form-control" @keydown.enter="createDb" />
        <span v-if="dbError" class="help-block">{{ dbError }}</span>
      </div>
    </AmbModal>
    <AmbModal v-if="dropDb" title="Delete Database" ok-text="Delete" danger small :busy="busy" @close="dropDb = ''" @ok="deleteDb">
      <p>Are you sure you want to delete the database <strong>{{ dropDb }}</strong>?</p>
      <label class="ht__inline"><input v-model="cascade" type="checkbox" /> Also drop its tables (CASCADE)</label>
    </AmbModal>

    <!-- NEW TABLE wizard -->
    <AmbModal v-if="wizard" title="Create Table" ok-text="Create" wide :busy="busy" :ok-disabled="!!wizardError"
              @close="wizard = false" @ok="createTable">
      <ul class="nav-tabs">
        <li v-for="t in ['Columns', 'Advanced', 'Table Properties']" :key="t" :class="{ active: wtab === t }">
          <a href="#" @click.prevent="wtab = t">{{ t }}</a>
        </li>
      </ul>
      <div class="form-group" :class="{ 'has-error': nameError }">
        <label for="ht-name">Table Name</label>
        <input id="ht-name" v-model="form.name" class="form-control" placeholder="Enter table name" />
        <span v-if="nameError" class="help-block">{{ nameError }}</span>
      </div>
      <template v-if="wtab === 'Columns'">
        <div class="ht__colhead"><span>Column Name</span><span>Data Type</span><span>Partitioned</span><span></span></div>
        <div v-for="(col, i) in form.columns" :key="i" class="ht__colrow">
          <input v-model="col.name" class="form-control" placeholder="column_name" :aria-label="`Column ${i + 1} name`" />
          <select v-model="col.type" class="form-control" :aria-label="`Column ${i + 1} type`">
            <option v-for="type in TYPES" :key="type" :value="type">{{ type }}</option>
          </select>
          <input v-model="col.partition" type="checkbox" :aria-label="`Column ${i + 1} partitioned`" />
          <button type="button" class="btn btn-default btn-sm" :disabled="form.columns.length === 1" @click="form.columns.splice(i, 1)">×</button>
        </div>
        <button type="button" class="btn btn-default btn-sm" @click="form.columns.push({ name: '', type: 'STRING', partition: false })">
          <AmbIcon name="plus" :size="11" />Add Column
        </button>
      </template>
      <template v-else-if="wtab === 'Advanced'">
        <label class="ht__inline"><input v-model="form.external" type="checkbox" /> External table</label>
        <div class="form-group">
          <label for="ht-loc">Location</label>
          <input id="ht-loc" v-model="form.location" class="form-control mono" placeholder="/data/..." :disabled="!form.external" />
          <span class="help-block">An external table reads files already in HDFS; dropping it leaves them in place.</span>
        </div>
        <div class="form-group">
          <label for="ht-fmt">File Format</label>
          <select id="ht-fmt" v-model="form.format" class="form-control">
            <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>
      </template>
      <template v-else>
        <p class="text-muted">The statement that will run:</p>
      </template>
      <pre class="ht__ddl">{{ createSql }}</pre>
      <div v-if="wizardError && form.name" class="alert alert-danger">{{ wizardError }}</div>
    </AmbModal>

    <!-- EDIT TABLE -->
    <AmbModal v-if="editing" :title="`Edit Table ${table?.name}`" ok-text="Save" :busy="busy" :ok-disabled="!!editError"
              @close="editing = false" @ok="saveEdit">
      <div class="form-group" :class="{ 'has-error': editNameError }">
        <label for="ht-rename">Table Name</label>
        <input id="ht-rename" v-model="edit.name" class="form-control" />
        <span v-if="editNameError" class="help-block">{{ editNameError }}</span>
      </div>
      <label class="control-label">Add Columns</label>
      <div v-for="(col, i) in edit.columns" :key="i" class="ht__colrow is-edit">
        <input v-model="col.name" class="form-control" placeholder="new_column" :aria-label="`New column ${i + 1} name`" />
        <select v-model="col.type" class="form-control" :aria-label="`New column ${i + 1} type`">
          <option v-for="type in TYPES" :key="type" :value="type">{{ type }}</option>
        </select>
        <button type="button" class="btn btn-default btn-sm" @click="edit.columns.splice(i, 1)">×</button>
      </div>
      <button type="button" class="btn btn-default btn-sm" @click="edit.columns.push({ name: '', type: 'STRING' })"><AmbIcon name="plus" :size="11" />Add Column</button>
      <pre v-if="editSql.length" class="ht__ddl">{{ editSql.join(';\n') }};</pre>
      <div v-if="editError && editError !== 'nothing'" class="alert alert-danger">{{ editError }}</div>
    </AmbModal>

    <!-- DELETE TABLE -->
    <AmbModal v-if="dropping && table" title="Delete Table" ok-text="Delete" danger small :busy="busy" @close="dropping = false" @ok="dropTable">
      <p>Are you sure you want to delete the table <strong>{{ table.db }}.{{ table.name }}</strong>?</p>
      <p v-if="!table.external" class="alert alert-warning">This is a MANAGED table: its data in
        <span class="mono">{{ table.location }}</span> is deleted with it.</p>
    </AmbModal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import { cli, pick, rows } from '@/utils/portalKit';
import { HIVE_TYPES, IDENT } from './ambari';
import AmbIcon from './AmbIcon.vue';
import AmbModal from './AmbModal.vue';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean }>();
defineEmits<{ (event: 'query', sql: string): void }>();

const DETAIL_TABS = ['Columns', 'DDL', 'Storage Information', 'Detailed Information', 'Statistics'];
const TYPES = HIVE_TYPES.filter(t => !t.includes('('));
const FORMATS = ['TEXTFILE', 'ORC', 'PARQUET', 'AVRO', 'SEQUENCEFILE', 'RCFILE'];

const databases = computed(() => pick<string[]>(props.view, 'hive.databases', ['default']));
const tables = computed(() => rows(props.view, 'hive.tables'));
const selectedDb = ref(String(pick(props.view, 'hive.current', 'default')));
const filter = ref('');
const opened = ref('');
const dtab = ref('Columns');

const dbTables = computed(() => tables.value.filter(t => t.db === selectedDb.value
  && String(t.name).toLowerCase().includes(filter.value.trim().toLowerCase())));
const table = computed(() => tables.value.find(t => t.db === selectedDb.value && t.name === opened.value));
const allColumns = computed(() => [
  ...(table.value?.columns || []).map((c: any) => ({ ...c, partition: false })),
  ...(table.value?.partitioned_by || []).map((c: any) => ({ ...c, partition: true })),
]);
const inputFormat = computed(() => ({
  ORC: 'org.apache.hadoop.hive.ql.io.orc.OrcInputFormat',
  PARQUET: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
} as Record<string, string>)[table.value?.format] || 'org.apache.hadoop.mapred.TextInputFormat');
const ddl = computed(() => {
  const t = table.value;
  if (!t) return '';
  const cols = (t.columns || []).map((c: any) => `  \`${c.name}\` ${String(c.type).toLowerCase()}`).join(',\n');
  const parts = (t.partitioned_by || []).map((c: any) => `\`${c.name}\` ${String(c.type).toLowerCase()}`).join(', ');
  return `CREATE ${t.external ? 'EXTERNAL ' : ''}TABLE \`${t.db}\`.\`${t.name}\`(\n${cols}\n)`
    + (parts ? `\nPARTITIONED BY (${parts})` : '')
    + `\nSTORED AS ${t.format}\nLOCATION\n  'hdfs://namenode:8020${t.location}'`;
});

watch(databases, list => {
  if (!list.includes(selectedDb.value)) selectedDb.value = 'default';
});
watch(table, value => {
  if (!value && opened.value) opened.value = '';
});

function selectDb(db: string) {
  selectedDb.value = db;
  opened.value = '';
}
function open(name: string) {
  opened.value = name;
  dtab.value = 'Columns';
}

// ---- databases ----
const newDb = ref<string | null>(null);
const dropDb = ref('');
const cascade = ref(false);
const dbError = computed(() => {
  const name = (newDb.value || '').trim();
  if (!name) return '';
  if (!IDENT.test(name)) return 'Use letters, digits and underscores, starting with a letter';
  if (databases.value.includes(name)) return `Database ${name} already exists`;
  return '';
});
function openNewDb() {
  newDb.value = '';
}
async function createDb() {
  const name = (newDb.value || '').trim();
  if (!name || dbError.value) return;
  const result = await props.api.exec(`CREATE DATABASE ${name}`, { success: `Database ${name} created` });
  if (result.ok) { newDb.value = null; selectedDb.value = name; }
}
async function deleteDb() {
  const name = dropDb.value;
  const result = await props.api.exec(`DROP DATABASE ${name}${cascade.value ? ' CASCADE' : ''}`,
                                      { success: `Database ${name} deleted` });
  if (result.ok) { dropDb.value = ''; cascade.value = false; if (selectedDb.value === name) selectedDb.value = 'default'; }
}

// ---- create table ----
const wizard = ref(false);
const wtab = ref('Columns');
const form = reactive({
  name: '', external: false, location: '', format: 'TEXTFILE',
  columns: [{ name: 'id', type: 'INT', partition: false }] as { name: string; type: string; partition: boolean }[],
});
function openWizard() {
  Object.assign(form, { name: '', external: false, location: '', format: 'TEXTFILE',
                        columns: [{ name: 'id', type: 'INT', partition: false }] });
  wtab.value = 'Columns';
  wizard.value = true;
}
const nameError = computed(() => {
  const name = form.name.trim();
  if (!name) return '';
  if (!IDENT.test(name)) return 'Table name must start with a letter and contain only letters, digits and underscores';
  if (tables.value.some(t => t.db === selectedDb.value && t.name === name)) return `Table ${selectedDb.value}.${name} already exists`;
  return '';
});
const wizardError = computed(() => {
  if (!form.name.trim()) return 'Table name is required';
  if (nameError.value) return nameError.value;
  const cols = form.columns.filter(c => !c.partition);
  if (!cols.length) return 'A table needs at least one column that is not a partition column';
  const names = form.columns.map(c => c.name.trim().toLowerCase());
  if (names.some(n => !IDENT.test(n))) return 'Every column needs a valid name';
  if (new Set(names).size !== names.length) return 'Column names must be unique';
  if (form.external && !form.location.trim().startsWith('/')) return 'An external table needs an absolute HDFS location';
  return '';
});
const createSql = computed(() => {
  const cols = form.columns.filter(c => !c.partition).map(c => `${c.name.trim() || '?'} ${c.type}`).join(', ');
  const parts = form.columns.filter(c => c.partition).map(c => `${c.name.trim() || '?'} ${c.type}`).join(', ');
  return `CREATE ${form.external ? 'EXTERNAL ' : ''}TABLE ${selectedDb.value}.${form.name.trim() || '?'} (${cols})`
    + (parts ? ` PARTITIONED BY (${parts})` : '')
    + (form.format !== 'TEXTFILE' || form.external ? ` STORED AS ${form.format}` : '')
    + (form.external && form.location.trim() ? ` LOCATION '${form.location.trim().replace(/'/g, '')}'` : '');
});
async function createTable() {
  if (wizardError.value) return;
  const result = await props.api.exec(createSql.value, { success: `Table ${form.name.trim()} created` });
  if (result.ok) { wizard.value = false; open(form.name.trim()); }
}

// ---- edit table ----
const editing = ref(false);
const edit = reactive({ name: '', columns: [] as { name: string; type: string }[] });
function openEdit() {
  edit.name = String(table.value?.name || '');
  edit.columns = [];
  editing.value = true;
}
const editNameError = computed(() => {
  const name = edit.name.trim();
  if (!IDENT.test(name)) return 'Table name must start with a letter and contain only letters, digits and underscores';
  if (name !== table.value?.name && tables.value.some(t => t.db === selectedDb.value && t.name === name)) {
    return `Table ${selectedDb.value}.${name} already exists`;
  }
  return '';
});
const editSql = computed(() => {
  const t = table.value;
  if (!t) return [];
  const out: string[] = [];
  const cols = edit.columns.filter(c => c.name.trim());
  if (cols.length) out.push(`ALTER TABLE ${t.db}.${t.name} ADD COLUMNS (${cols.map(c => `${c.name.trim()} ${c.type}`).join(', ')})`);
  if (edit.name.trim() && edit.name.trim() !== t.name) out.push(`ALTER TABLE ${t.db}.${t.name} RENAME TO ${t.db}.${edit.name.trim()}`);
  return out;
});
const editError = computed(() => {
  if (editNameError.value) return editNameError.value;
  const existing = allColumns.value.map(c => String(c.name).toLowerCase());
  const added = edit.columns.filter(c => c.name.trim()).map(c => c.name.trim().toLowerCase());
  if (added.some(n => !IDENT.test(n))) return 'New column names must be valid identifiers';
  const dupe = added.find((n, i) => existing.includes(n) || added.indexOf(n) !== i);
  if (dupe) return `Column ${dupe} already exists`;
  return editSql.value.length ? '' : 'nothing';
});
async function saveEdit() {
  if (editError.value) return;
  for (const sql of editSql.value) {
    const result = await props.api.exec(sql, { success: 'Table updated' });
    if (!result.ok) return;
  }
  const renamed = edit.name.trim();
  editing.value = false;
  if (renamed) opened.value = renamed;
}

// ---- delete table ----
const dropping = ref(false);
async function dropTable() {
  const t = table.value;
  if (!t) return;
  const result = await props.api.exec(cli(['DROP', 'TABLE', `${t.db}.${t.name}`]), { success: `Table ${t.db}.${t.name} deleted` });
  if (result.ok) { dropping.value = false; opened.value = ''; }
}
</script>

<style scoped>
.ht { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 14px; }
.ht__dbs { margin: 0; align-self: start; }
.ht__dbs .spacer { flex: 1; }
.ht__list { list-style: none; margin: 0; padding: 4px 0; }
.ht__list li { display: flex; align-items: center; }
.ht__list li.active { background: #eef7ec; box-shadow: inset 3px 0 0 #3FAE2A; }
.ht__item { flex: 1; display: flex; align-items: center; gap: 6px; border: 0; background: none; padding: 8px 12px; font: inherit; font-size: 13px; color: #333; cursor: pointer; text-align: left; }
.ht__count { margin-left: auto; color: #999; font-size: 12px; }
.ht__del { border: 0; background: none; color: #999; cursor: pointer; padding: 6px 10px; }
.ht__del:hover { color: #d9534f; }
.ht__title { margin: 0; font-size: 18px; font-weight: 400; }
.ht__filter { max-width: 220px; }
.ht__loc { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ht__ddl { background: #f8f8f8; border: 1px solid #ddd; padding: 10px; font-size: 12px; white-space: pre-wrap; margin: 10px 0 0; }
.ht__kv th { width: 30%; font-weight: 400; color: #666; border-bottom: 0; border-top: 1px solid #ddd; }
.ht__inline { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 12px; }
.ht__colhead, .ht__colrow { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) 80px 40px; gap: 8px; align-items: center; margin-bottom: 8px; }
.ht__colrow.is-edit { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) 40px; }
.ht__colhead { font-size: 12px; font-weight: 700; color: #666; text-transform: uppercase; }
@container sl-portal (max-width: 760px) {
  .ht { grid-template-columns: minmax(0, 1fr); }
}
</style>
