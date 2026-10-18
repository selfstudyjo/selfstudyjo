<template>
  <div class="fx-page lh">
    <ItemHeader :name="itemName" type="Lakehouse" :label="item?.label" :endorsement="item?.endorsement"
                :tabs="['Home']" model-value="Home" @settings="settings = 'about'" @share="settings = 'share'">
      <template #right>
        <select class="fx-select lh-switch" value="Lakehouse" aria-label="Switch experience"
                @change="switchTo(($event.target as HTMLSelectElement).value)">
          <option value="Lakehouse">Lakehouse</option>
          <option value="SQLEndpoint">SQL analytics endpoint</option>
        </select>
      </template>
    </ItemHeader>
    <div class="fx-cmdbar">
      <button type="button" class="fx-cmd" @click="openShortcut"><FxIcon name="Shortcut" />New shortcut</button>
      <button type="button" class="fx-cmd" :disabled="!files.length" @click="openLoad('')"><FxIcon name="upload" />Load to table</button>
      <button type="button" class="fx-cmd" @click="newModel = true"><FxIcon name="SemanticModel" />New semantic model</button>
      <button type="button" class="fx-cmd" @click="openNotebook"><FxIcon name="Notebook" />Open notebook</button>
      <span class="fx-cmdbar__sep" />
      <button type="button" class="fx-cmd" @click="refresh"><FxIcon name="refresh" />Refresh</button>
    </div>
    <div class="fx-split">
      <aside class="fx-explorer" aria-label="Explorer">
        <div class="fx-explorer__head">Explorer</div>
        <div class="fx-explorer__body">
          <div class="fx-node lh-root"><FxIcon name="Lakehouse" />{{ itemName }}</div>
          <button type="button" class="fx-node" @click="open.tables = !open.tables">
            <span class="fx-node__caret"><FxIcon :name="open.tables ? 'chevronDown' : 'chevronRight'" :size="12" /></span>
            <FxIcon name="Schema" /><span class="fx-node__label">Tables</span>
          </button>
          <template v-if="open.tables">
            <template v-for="schema in schemas" :key="schema">
              <button type="button" class="fx-node lh-l1" @click="toggleSchema(schema)">
                <span class="fx-node__caret"><FxIcon :name="closedSchemas.includes(schema) ? 'chevronRight' : 'chevronDown'" :size="12" /></span>
                <FxIcon name="Schema" /><span class="fx-node__label">{{ schema }}</span>
              </button>
              <template v-if="!closedSchemas.includes(schema)">
                <button v-for="t in tablesIn(schema)" :key="t.name" type="button" class="fx-node lh-l2"
                        :class="{ 'is-selected': sel.kind === 'table' && sel.schema === schema && sel.name === t.name }"
                        @click="selectTable(schema, t.name)">
                  <FxIcon :name="t.shortcut ? 'Shortcut' : t.kind === 'View' ? 'View' : 'Table'" />
                  <span class="fx-node__label">{{ t.name }}</span>
                </button>
              </template>
            </template>
            <div v-if="!tables.length" class="fx-muted lh-l1 lh-empty">No tables yet</div>
          </template>
          <button type="button" class="fx-node" @click="open.files = !open.files">
            <span class="fx-node__caret"><FxIcon :name="open.files ? 'chevronDown' : 'chevronRight'" :size="12" /></span>
            <FxIcon name="Folder" /><span class="fx-node__label">Files</span>
          </button>
          <template v-if="open.files">
            <button v-for="f in fileFolders" :key="f" type="button" class="fx-node lh-l1"
                    :style="{ paddingLeft: (34 + depth(f) * 14) + 'px' }"
                    :class="{ 'is-selected': sel.kind === 'folder' && sel.name === f }"
                    @click="sel = { kind: 'folder', name: f, schema: '' }">
              <FxIcon name="Folder" /><span class="fx-node__label">{{ f.split('/').pop() }}</span>
            </button>
            <div v-if="!fileFolders.length" class="fx-muted lh-l1 lh-empty">No files yet</div>
          </template>
        </div>
      </aside>

      <section class="fx-content">
        <!-- Nothing selected -->
        <div v-if="sel.kind === ''" class="fx-empty">
          <FxIcon name="Lakehouse" :size="48" />
          <h3>{{ tables.length ? 'Select a table or a folder' : 'Get data in your lakehouse' }}</h3>
          <p>{{ tables.length }} table(s) and {{ files.length }} file(s) in {{ itemName }}.</p>
          <div class="lh-start">
            <button type="button" class="fx-btn" @click="openShortcut"><FxIcon name="Shortcut" />New shortcut</button>
            <button type="button" class="fx-btn" :disabled="!files.length" @click="openLoad('')"><FxIcon name="upload" />Load files to a table</button>
            <button type="button" class="fx-btn" @click="openNotebook"><FxIcon name="Notebook" />New notebook</button>
          </div>
        </div>

        <!-- A table -->
        <template v-else-if="sel.kind === 'table'">
          <div class="lh-tablebar">
            <FxIcon :name="currentTable?.shortcut ? 'Shortcut' : 'Table'" />
            <b>{{ sel.schema }}.{{ sel.name }}</b>
            <span v-if="currentTable" class="fx-muted">{{ currentTable.rows }} rows · {{ currentTable.columns.length }} columns</span>
            <span v-if="currentTable?.shortcut" class="fx-pill fx-pill--info">Shortcut → {{ currentTable.shortcut }}</span>
            <span class="fx-cmdbar__grow" />
            <div class="fx-tabs lh-viewtabs">
              <button v-for="v in ['Data', 'Schema', 'History']" :key="v" type="button" class="fx-tab"
                      :class="{ 'is-active': tableView === v }" @click="setTableView(v)">{{ v }}</button>
            </div>
            <button type="button" class="fx-btn fx-btn--sm" @click="maint = true">Maintenance</button>
            <button type="button" class="fx-btn fx-btn--sm" @click="confirmDrop = true">Delete</button>
          </div>
          <div v-if="previewError" class="fx-msgbar fx-msgbar--error lh-msg"><FxIcon name="error" />{{ previewError }}</div>
          <div v-if="tableView === 'Schema'" class="fx-tablewrap lh-schema">
            <table class="fx-table">
              <thead><tr><th>#</th><th>Column name</th><th>Data type</th></tr></thead>
              <tbody><tr v-for="(c, i) in ((currentTable?.columns || []) as any[])" :key="c[0]"><td class="fx-muted">{{ Number(i) + 1 }}</td><td>{{ c[0] }}</td><td class="fx-mono">{{ c[1] || 'string' }}</td></tr></tbody>
            </table>
          </div>
          <FxGrid v-else :grid="grid" :empty="loading ? 'Loading…' : 'No rows'" />
        </template>

        <!-- A files folder -->
        <template v-else>
          <div class="lh-tablebar">
            <FxIcon name="Folder" /><b>{{ sel.name }}</b>
            <span class="fx-muted">{{ folderFiles.length }} file(s)</span>
            <span class="fx-cmdbar__grow" />
            <button type="button" class="fx-btn fx-btn--sm" :disabled="!folderFiles.length" @click="openLoad(sel.name)">Load to Tables</button>
            <button type="button" class="fx-btn fx-btn--sm" @click="confirmFiles = true">Delete</button>
          </div>
          <div class="fx-tablewrap lh-schema">
            <table class="fx-table">
              <thead><tr><th>Name</th><th>Date modified</th><th>Type</th><th>Rows</th></tr></thead>
              <tbody>
                <tr v-for="f in folderFiles" :key="f.path"><td><span class="fx-cellname"><FxIcon name="File" />{{ f.path.slice(sel.name.length + 1) }}</span></td>
                  <td class="fx-muted">{{ f.written }}</td><td>{{ f.format }}</td><td>{{ f.rows }}</td></tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
    </div>

    <!-- Load to table -->
    <FxModal v-if="load" title="Load file to new table" @close="load = false">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <div class="fx-field">
        <span class="fx-field__label">Folder</span>
        <select v-model="loadFolder" class="fx-select" aria-label="Source folder">
          <option v-for="f in fileFolders" :key="f" :value="f">{{ f }}</option>
        </select>
      </div>
      <label class="fx-check"><input v-model="loadExisting" type="radio" :value="false" />New table</label>
      <label class="fx-check"><input v-model="loadExisting" type="radio" :value="true" />Existing table</label>
      <div class="fx-field">
        <label for="lh-tname">Table name<span class="fx-field__req">*</span></label>
        <select v-if="loadExisting" id="lh-tname" v-model="loadTable" class="fx-select">
          <option v-for="t in tables" :key="t.schema + t.name" :value="t.name">{{ t.schema }}.{{ t.name }}</option>
        </select>
        <input v-else id="lh-tname" v-model="loadTable" class="fx-input" />
        <span class="fx-field__help">Lowercase letters, numbers and underscores.</span>
      </div>
      <div v-if="loadExisting" class="fx-field">
        <span class="fx-field__label">Load mode</span>
        <label class="fx-check"><input v-model="loadMode" type="radio" value="append" />Append</label>
        <label class="fx-check"><input v-model="loadMode" type="radio" value="overwrite" />Overwrite</label>
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!loadTable.trim() || !loadFolder" @click="doLoad">Load</button>
        <button type="button" class="fx-btn" @click="load = false">Cancel</button>
      </template>
    </FxModal>

    <!-- New shortcut -->
    <FxModal v-if="shortcut" title="New shortcut" width="520px" @close="shortcut = false">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <p class="lh-p">Internal source: <b>Microsoft OneLake</b>. A shortcut points at a table in another lakehouse - no data is copied.</p>
      <div class="fx-field">
        <span class="fx-field__label">Source table<span class="fx-field__req">*</span></span>
        <select v-model="scTarget" class="fx-select" aria-label="Source table">
          <option v-for="o in otherTables" :key="o.key" :value="o.key">{{ o.workspace }} / {{ o.item }} / {{ o.schema }}.{{ o.name }}</option>
        </select>
      </div>
      <div class="fx-field">
        <label for="lh-scname">Shortcut name<span class="fx-field__req">*</span></label>
        <input id="lh-scname" v-model="scName" class="fx-input" />
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!scTarget || !scName.trim()" @click="doShortcut">Create</button>
        <button type="button" class="fx-btn" @click="shortcut = false">Cancel</button>
      </template>
    </FxModal>

    <!-- Maintenance -->
    <FxModal v-if="maint" :title="'Run maintenance commands'" width="520px" @close="maint = false">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <p class="lh-p">Table: <b>{{ sel.schema }}.{{ sel.name }}</b></p>
      <label class="fx-check"><input v-model="mOptimize" type="checkbox" />Run OPTIMIZE command</label>
      <label class="fx-check lh-indent"><input v-model="mVorder" type="checkbox" :disabled="!mOptimize" />Apply V-Order to maximize reading speeds</label>
      <div class="fx-field lh-indent">
        <label for="lh-z">Z-order by column (optional)</label>
        <select id="lh-z" v-model="mZorder" class="fx-select" :disabled="!mOptimize">
          <option value="">None</option>
          <option v-for="c in currentTable?.columns || []" :key="c[0]" :value="c[0]">{{ c[0] }}</option>
        </select>
      </div>
      <label class="fx-check"><input v-model="mVacuum" type="checkbox" />Run VACUUM command using retention threshold</label>
      <div class="fx-field lh-indent">
        <label for="lh-ret">Retention threshold (hours)</label>
        <input id="lh-ret" v-model.number="mHours" class="fx-input" type="number" min="0" :disabled="!mVacuum" />
        <span class="fx-field__help">The default is 7 days (168 hours). Files older than the threshold are deleted and time travel to them stops working.</span>
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!mOptimize && !mVacuum" @click="doMaintenance">Run now</button>
        <button type="button" class="fx-btn" @click="maint = false">Cancel</button>
      </template>
    </FxModal>

    <FxModal v-if="confirmDrop" :title="'Delete table ' + sel.name + '?'" @close="confirmDrop = false">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <p class="lh-p">The table <b>{{ sel.schema }}.{{ sel.name }}</b> and its data will be permanently deleted.</p>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--danger" @click="doDrop">Delete</button>
        <button type="button" class="fx-btn" @click="confirmDrop = false">Cancel</button>
      </template>
    </FxModal>
    <FxModal v-if="confirmFiles" :title="'Delete ' + sel.name + '?'" @close="confirmFiles = false">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <p class="lh-p">All {{ folderFiles.length }} file(s) under <b>{{ sel.name }}</b> will be permanently deleted.</p>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--danger" @click="doDeleteFiles">Delete</button>
        <button type="button" class="fx-btn" @click="confirmFiles = false">Cancel</button>
      </template>
    </FxModal>

    <NewItemDialog v-if="newModel" :ws="wsName" initial-type="SemanticModel" @close="newModel = false"
                   @created="v => { newModel = false; go({ page: 'item', ws: v.ws, item: v.name, type: v.type }) }" />
    <ItemSettingsPanel v-if="settings && item" :item="item" :tab="settings" @close="settings = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import FxIcon from './FxIcon.vue';
import FxModal from './FxModal.vue';
import FxGrid from './FxGrid.vue';
import ItemHeader from './ItemHeader.vue';
import NewItemDialog from './NewItemDialog.vue';
import ItemSettingsPanel from './ItemSettingsPanel.vue';
import { cli, errorText, gridsOf, itemPath, rows, tablePath, useFabric, type Grid } from './fabric';

const { portal, route, go, run, api } = useFabric();
const wsName = computed(() => String(route.value.ws || ''));
const itemName = computed(() => String(route.value.item || ''));
const item = computed(() => rows(portal.value, 'items').find(i => i.workspace === wsName.value
  && i.name === itemName.value && i.type === 'Lakehouse'));
const tables = computed(() => rows(portal.value, 'objects').filter(o => o.item === itemName.value
  && o.workspace === wsName.value));
const schemas = computed(() => [...new Set(tables.value.map(t => String(t.schema)))].sort());
const files = computed(() => rows(portal.value, 'files').filter(f => f.item === itemName.value));
const fileFolders = computed(() => {
  const set = new Set<string>();
  for (const f of files.value) {
    const parts = String(f.path).split('/');
    for (let i = 2; i < parts.length; i++) set.add(parts.slice(0, i).join('/'));
  }
  return [...set].sort();
});

const open = reactive({ tables: true, files: true });
const closedSchemas = ref<string[]>([]);
const sel = ref<{ kind: '' | 'table' | 'folder'; name: string; schema: string }>({ kind: '', name: '', schema: '' });
const tableView = ref('Data');
const grid = ref<Grid | null>(null);
const loading = ref(false);
const previewError = ref('');
const settings = ref('');
const newModel = ref(false);
const dlgError = ref('');

const currentTable = computed(() => tables.value.find(t => t.schema === sel.value.schema && t.name === sel.value.name));
const folderFiles = computed(() => files.value.filter(f => String(f.path).startsWith(sel.value.name + '/')));

function tablesIn(schema: string) { return tables.value.filter(t => t.schema === schema); }
function depth(path: string) { return path.split('/').length - 2; }
function toggleSchema(schema: string) {
  closedSchemas.value = closedSchemas.value.includes(schema)
    ? closedSchemas.value.filter(s => s !== schema) : [...closedSchemas.value, schema];
}

async function loadPreview() {
  if (sel.value.kind !== 'table') return;
  loading.value = true;
  previewError.value = '';
  grid.value = null;
  let result;
  if (tableView.value === 'History') {
    result = await api.exec(cli(['fab', 'table', 'history', tablePath(wsName.value, itemName.value, 'Lakehouse',
      sel.value.schema, sel.value.name)]), { quiet: true, unlogged: true });
  } else {
    // The preview reads through the SQL analytics endpoint, as the explorer does.
    result = await api.exec(`SELECT TOP 100 * FROM [${itemName.value}].[${sel.value.schema}].[${sel.value.name}]`,
      { surface: 'fabric_sql', quiet: true, unlogged: true });
  }
  loading.value = false;
  if (!result.ok) { previewError.value = errorText(result); return; }
  grid.value = gridsOf(result).pop() || null;
}

function selectTable(schema: string, name: string) {
  sel.value = { kind: 'table', schema, name };
  if (tableView.value === 'Schema') tableView.value = 'Data';
  loadPreview();
}
function setTableView(v: string) {
  tableView.value = v;
  if (v !== 'Schema') loadPreview();
}
watch(tables, list => {
  if (sel.value.kind === 'table' && !list.some(t => t.schema === sel.value.schema && t.name === sel.value.name)) {
    sel.value = { kind: '', name: '', schema: '' };
  }
});

function refresh() { loadPreview(); }
function switchTo(type: string) {
  if (type === 'SQLEndpoint') go({ page: 'item', ws: wsName.value, item: itemName.value, type: 'SQLEndpoint' });
}
function openNotebook() {
  const nb = rows(portal.value, 'items').find(i => i.type === 'Notebook' && i.workspace === wsName.value
    && i.lakehouse === itemName.value);
  if (nb) go({ page: 'item', ws: wsName.value, item: nb.name, type: 'Notebook' });
  else newNotebook();
}
async function newNotebook() {
  const taken = new Set(rows(portal.value, 'items').filter(i => i.type === 'Notebook').map(i => i.name));
  let n = 1;
  while (taken.has(`Notebook ${n}`)) n++;
  const name = `Notebook ${n}`;
  const result = await run(cli(['fab', 'mkdir', itemPath(wsName.value, name, 'Notebook')], { '-P': `lakehouse=${itemName.value}` }),
    `Created ${name}`);
  if (result.ok) go({ page: 'item', ws: wsName.value, item: name, type: 'Notebook' });
}

// Load to table
const load = ref(false);
const loadFolder = ref('');
const loadExisting = ref(false);
const loadTable = ref('');
const loadMode = ref('append');
function openLoad(folder: string) {
  dlgError.value = '';
  loadFolder.value = folder || fileFolders.value[fileFolders.value.length - 1] || '';
  loadTable.value = (loadFolder.value.split('/').pop() || 'new_table').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  loadExisting.value = false;
  load.value = true;
}
watch(loadExisting, existing => {
  if (existing) loadTable.value = tables.value[0]?.name || '';
});
async function doLoad() {
  const target = tables.value.find(t => t.name === loadTable.value);
  const schema = target?.schema || 'dbo';
  const result = await run(cli(['fab', 'table', 'load', tablePath(wsName.value, itemName.value, 'Lakehouse', schema, loadTable.value.trim())],
    { '--file': loadFolder.value, '--mode': loadExisting.value ? loadMode.value : 'overwrite' }),
  `Loaded ${loadFolder.value} to table ${loadTable.value.trim()}`, { quiet: true });
  if (!result.ok) { dlgError.value = errorText(result); return; }
  load.value = false;
  selectTable(schema, loadTable.value.trim());
}

// Shortcut
const shortcut = ref(false);
const scTarget = ref('');
const scName = ref('');
const otherTables = computed(() => rows(portal.value, 'objects').filter(o => o.item !== itemName.value && o.kind === 'Table')
  .map(o => ({ ...o, key: [o.workspace, o.item, o.schema, o.name].join('|') }) as Record<string, any>));
function openShortcut() {
  dlgError.value = '';
  scTarget.value = otherTables.value[0]?.key || '';
  shortcut.value = true;
}
watch(scTarget, key => { scName.value = key ? key.split('|')[3] : ''; });
async function doShortcut() {
  const [ws, lh, schema, table] = scTarget.value.split('|');
  const ownerType = rows(portal.value, 'items').find(i => i.name === lh && i.workspace === ws && i.type === 'Warehouse') ? 'Warehouse' : 'Lakehouse';
  const result = await run(cli(['fab', 'ln', `${itemPath(wsName.value, itemName.value, 'Lakehouse')}/Tables/dbo/${scName.value.trim()}.Shortcut`],
    { '--type': 'oneLake', '--target': tablePath(ws, lh, ownerType, schema, table) }),
  `Shortcut ${scName.value.trim()} created`, { quiet: true });
  if (!result.ok) { dlgError.value = errorText(result); return; }
  shortcut.value = false;
  selectTable('dbo', scName.value.trim());
}

// Maintenance
const maint = ref(false);
const mOptimize = ref(true);
const mVorder = ref(true);
const mZorder = ref('');
const mVacuum = ref(false);
const mHours = ref(168);
async function doMaintenance() {
  dlgError.value = '';
  const path = tablePath(wsName.value, itemName.value, 'Lakehouse', sel.value.schema, sel.value.name);
  if (mOptimize.value) {
    const r = await run(cli(['fab', 'table', 'optimize', path], { '--vorder': mVorder.value, '--zorder': mZorder.value }),
      `OPTIMIZE completed on ${sel.value.name}`, { quiet: true });
    if (!r.ok) { dlgError.value = errorText(r); return; }
  }
  if (mVacuum.value) {
    const r = await run(cli(['fab', 'table', 'vacuum', path], { '--retain_n_hours': String(mHours.value) }),
      `VACUUM completed on ${sel.value.name}`, { quiet: true });
    if (!r.ok) { dlgError.value = errorText(r); return; }
  }
  maint.value = false;
  loadPreview();
}

// Deletes
const confirmDrop = ref(false);
const confirmFiles = ref(false);
async function doDrop() {
  const r = await run(cli(['fab', 'rm', tablePath(wsName.value, itemName.value, 'Lakehouse', sel.value.schema, sel.value.name), '-f']),
    `Deleted table ${sel.value.name}`, { quiet: true });
  if (!r.ok) { dlgError.value = errorText(r); return; }
  confirmDrop.value = false;
  sel.value = { kind: '', name: '', schema: '' };
}
async function doDeleteFiles() {
  const r = await run(cli(['fab', 'rm', `${itemPath(wsName.value, itemName.value, 'Lakehouse')}/${sel.value.name}`, '-f']),
    `Deleted ${sel.value.name}`, { quiet: true });
  if (!r.ok) { dlgError.value = errorText(r); return; }
  confirmFiles.value = false;
  sel.value = { kind: '', name: '', schema: '' };
}
</script>

<style scoped>
.lh-switch { width: 200px; }
@container sl-portal (max-width: 600px) { .lh-switch { width: 124px; flex: none; } }
.lh-root { font-weight: 600; cursor: default; }
.lh-l1 { padding-left: 16px; }
.lh-l2 { padding-left: 34px; }
.lh-empty { font-size: 12px; padding: 4px 0 4px 40px; }
.lh-start { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
.lh-tablebar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid #e0e0e0; flex-wrap: wrap; min-height: 44px; }
.lh-viewtabs { border-bottom: 0; padding: 0; }
.lh-viewtabs .fx-tab { height: 32px; }
.lh-schema { flex: 1; }
.lh-msg { margin: 8px 12px; }
.lh-p { margin: 0 0 12px; }
.lh-indent { margin-left: 24px; }
</style>
