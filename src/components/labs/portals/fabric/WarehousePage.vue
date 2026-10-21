<template>
  <div class="fx-page wh">
    <ItemHeader :name="itemName" :type="isEndpoint ? 'SQLEndpoint' : 'Warehouse'" :label="item?.label"
                :endorsement="item?.endorsement" :tabs="['Home', 'Reporting']" :model-value="ribbon"
                @update:model-value="v => ribbon = v" @settings="settings = 'about'" @share="settings = 'share'">
      <template #right>
        <select v-if="isEndpoint" class="fx-select wh-switch" value="SQLEndpoint" aria-label="Switch experience"
                @change="go({ page: 'item', ws: wsName, item: itemName, type: 'Lakehouse' })">
          <option value="Lakehouse">Lakehouse</option>
          <option value="SQLEndpoint">SQL analytics endpoint</option>
        </select>
      </template>
    </ItemHeader>
    <div class="fx-cmdbar">
      <template v-if="ribbon === 'Home'">
        <button type="button" class="fx-cmd" @click="newTab()"><FxIcon name="code" />New SQL query</button>
        <button type="button" class="fx-cmd" @click="newTab(TEMPLATE_TABLE, 'New table')"><FxIcon name="Table" />New table</button>
        <button type="button" class="fx-cmd" @click="newTab(TEMPLATE_VIEW, 'New view')"><FxIcon name="View" />New view</button>
        <button type="button" class="fx-cmd" @click="newTab(TEMPLATE_PROC, 'New stored procedure')"><FxIcon name="Procedure" />New stored procedure</button>
        <span class="fx-cmdbar__sep" />
        <button type="button" class="fx-cmd" @click="refreshExplorer"><FxIcon name="refresh" />Refresh</button>
      </template>
      <template v-else>
        <button type="button" class="fx-cmd" @click="newModel = true"><FxIcon name="SemanticModel" />New semantic model</button>
      </template>
    </div>
    <div class="fx-split">
      <aside class="fx-explorer" aria-label="Explorer">
        <div class="fx-explorer__head">Explorer
          <input v-model="objFilter" class="fx-input wh-filter" placeholder="Filter" aria-label="Filter objects" />
        </div>
        <div class="fx-explorer__body" role="tree">
          <div class="fx-node wh-root" @contextmenu.prevent.stop="openMenu($event, rootMenu())"><FxIcon :name="isEndpoint ? 'SQLEndpoint' : 'Warehouse'" />{{ itemName }}</div>
          <div class="fx-node wh-l1"><FxIcon name="Schema" /><span class="fx-node__label">Schemas</span></div>
          <template v-for="schema in schemas" :key="schema">
            <div class="fx-node wh-row wh-l2" role="treeitem" tabindex="0" :aria-expanded="!closed.includes(schema)"
                 @click="toggle(schema)" @contextmenu.prevent.stop="openMenu($event, schemaMenu(schema))">
              <span class="fx-node__caret"><FxIcon :name="closed.includes(schema) ? 'chevronRight' : 'chevronDown'" :size="12" /></span>
              <FxIcon name="Schema" /><span class="fx-node__label">{{ schema }}</span>
              <button type="button" class="fx-iconbtn wh-act" :aria-label="'More options for schema ' + schema" @click.stop="openMenu($event, schemaMenu(schema))"><FxIcon name="more" :size="12" /></button>
            </div>
            <template v-if="!closed.includes(schema)">
              <div class="fx-node wh-l3 wh-group"><FxIcon name="Schema" :size="14" /><span class="fx-node__label">Tables</span></div>
              <div v-for="t in objectsIn(schema, 'Table')" :key="'t' + t.name" role="treeitem" tabindex="0" class="fx-node wh-row wh-l4"
                   :class="{ 'is-selected': selObj === schema + '.' + t.name }" @click="selObj = schema + '.' + t.name"
                   @dblclick="selectTop(schema, t.name)" @contextmenu.prevent.stop="selObj = schema + '.' + t.name; openMenu($event, objectMenu(t))">
                <FxIcon :name="t.shortcut ? 'Shortcut' : 'Table'" /><span class="fx-node__label">{{ t.name }}</span>
                <button type="button" class="fx-iconbtn wh-act" title="Select top 100" :aria-label="'Select top 100 from ' + t.name" @click.stop="selectTop(schema, t.name)"><FxIcon name="play" :size="12" /></button>
                <button type="button" class="fx-iconbtn wh-act" :aria-label="'More options for ' + t.name" @click.stop="openMenu($event, objectMenu(t))"><FxIcon name="more" :size="12" /></button>
              </div>
              <div class="fx-node wh-l3 wh-group"><FxIcon name="Schema" :size="14" /><span class="fx-node__label">Views</span></div>
              <div v-for="t in objectsIn(schema, 'View')" :key="'v' + t.name" role="treeitem" tabindex="0" class="fx-node wh-row wh-l4"
                   :class="{ 'is-selected': selObj === schema + '.' + t.name }" @click="selObj = schema + '.' + t.name"
                   @dblclick="selectTop(schema, t.name)" @contextmenu.prevent.stop="openMenu($event, objectMenu(t))">
                <FxIcon name="View" /><span class="fx-node__label">{{ t.name }}</span>
                <button type="button" class="fx-iconbtn wh-act" :aria-label="'Select top 100 from ' + t.name" title="Select top 100" @click.stop="selectTop(schema, t.name)"><FxIcon name="play" :size="12" /></button>
                <button type="button" class="fx-iconbtn wh-act" :aria-label="'More options for ' + t.name" @click.stop="openMenu($event, objectMenu(t))"><FxIcon name="more" :size="12" /></button>
              </div>
              <div class="fx-node wh-l3 wh-group"><FxIcon name="Schema" :size="14" /><span class="fx-node__label">Stored Procedures</span></div>
              <div v-for="p in procsIn(schema)" :key="'p' + p.name" role="treeitem" tabindex="0" class="fx-node wh-row wh-l4"
                   @dblclick="execProc(p.name)" @contextmenu.prevent.stop="openMenu($event, procMenu(p))">
                <FxIcon name="Procedure" /><span class="fx-node__label">{{ String(p.name).split('.').pop() }}</span>
                <button type="button" class="fx-iconbtn wh-act" title="Execute" :aria-label="'Execute ' + p.name" @click.stop="execProc(p.name)"><FxIcon name="play" :size="12" /></button>
                <button type="button" class="fx-iconbtn wh-act" :aria-label="'More options for ' + p.name" @click.stop="openMenu($event, procMenu(p))"><FxIcon name="more" :size="12" /></button>
              </div>
            </template>
          </template>
        </div>
      </aside>

      <section class="fx-content">
        <div class="wh-qtabs" role="tablist">
          <button v-for="tab in tabs" :key="tab.id" type="button" class="wh-qtab" :class="{ 'is-active': tab.id === activeId }"
                  @click="activeId = tab.id">
            <FxIcon name="code" :size="14" /><span>{{ tab.title }}</span>
            <span class="wh-qclose" role="button" :aria-label="'Close ' + tab.title" @click.stop="closeTab(tab.id)">×</span>
          </button>
          <button type="button" class="wh-qtab wh-qnew" title="New SQL query" @click="newTab()">+</button>
        </div>
        <template v-if="active">
          <div class="wh-editorbar">
            <button type="button" class="fx-btn fx-btn--primary fx-btn--sm wh-run" :disabled="active.running" @click="runQuery">
              <FxIcon name="play" :size="12" />Run</button>
            <button type="button" class="fx-btn fx-btn--subtle fx-btn--sm" :disabled="!isSelect(active.sql)" title="Save the query as a view" @click="openSaveAs('view')"><FxIcon name="View" :size="12" />Save as view</button>
            <button v-if="!isEndpoint" type="button" class="fx-btn fx-btn--subtle fx-btn--sm" :disabled="!isSelect(active.sql)" title="Save the results as a new table (CTAS)" @click="openSaveAs('table')"><FxIcon name="Table" :size="12" />Save as table</button>
            <span class="fx-muted wh-ctx">{{ itemName }} · {{ isEndpoint ? 'SQL analytics endpoint' : 'Warehouse' }}</span>
          </div>
          <textarea v-model="active.sql" class="fx-code wh-code" spellcheck="false" aria-label="SQL query editor"
                    @keydown.ctrl.enter.prevent="runQuery" @keydown.shift.enter.prevent="runQuery" />
          <div class="wh-results">
            <div class="fx-tabs wh-rtabs">
              <button type="button" class="fx-tab" :class="{ 'is-active': active.view === 'results' }" @click="active.view = 'results'">Results</button>
              <button type="button" class="fx-tab" :class="{ 'is-active': active.view === 'messages' }" @click="active.view = 'messages'">Messages</button>
              <span v-if="active.grids.length > 1" class="wh-sets">
                <button v-for="(g, i) in active.grids" :key="i" type="button" class="fx-btn fx-btn--sm"
                        :class="{ 'fx-btn--primary': active.gridIndex === i }" @click="active.gridIndex = i">Result {{ i + 1 }}</button>
              </span>
              <span class="fx-cmdbar__grow" />
              <template v-if="active.view === 'results' && active.grids[active.gridIndex]">
                <button type="button" class="fx-btn fx-btn--subtle fx-btn--sm" title="Copy the results" @click="copyResults"><FxIcon name="copy" :size="12" />Copy</button>
                <button type="button" class="fx-btn fx-btn--subtle fx-btn--sm" aria-haspopup="menu" @click.stop="openMenu($event, downloadMenu())"><FxIcon name="download" :size="12" />Download<FxIcon name="chevronDown" :size="10" /></button>
              </template>
            </div>
            <FxGrid v-if="active.view === 'results'" :grid="active.grids[active.gridIndex] || null"
                    :empty="active.running ? 'Running…' : active.ran ? 'The statement ran - see Messages.' : 'Run a query to see results'" />
            <pre v-else class="wh-messages" :class="{ 'is-error': active.error }">{{ active.messages || 'No messages' }}</pre>
          </div>
        </template>
        <div v-else class="fx-empty"><h3>No query open</h3><button type="button" class="fx-btn" @click="newTab()">New SQL query</button></div>
      </section>
    </div>

    <FxModal v-if="drop" :title="'Delete ' + drop.kind.toLowerCase() + ' ' + drop.name + '?'" @close="drop = null">
      <div v-if="dropError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dropError }}</div>
      <p class="wh-p">This runs <code class="fx-mono">DROP {{ drop.kind }} [{{ drop.schema }}].[{{ drop.name }}]</code> and can't be undone.</p>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--danger" @click="doDrop">Delete</button>
        <button type="button" class="fx-btn" @click="drop = null">Cancel</button>
      </template>
    </FxModal>
    <FxMenu v-if="menu" :at="menu.at" :items="menu.items" @close="menu = null" />

    <FxModal v-if="renaming" :title="'Rename ' + renaming.name" @close="renaming = null">
      <div v-if="dropError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dropError }}</div>
      <p class="wh-p">Runs <code class="fx-mono">EXEC sp_rename</code>. Views and procedures that reference the old name stop working.</p>
      <div class="fx-field"><label for="wh-rn">New name<span class="fx-field__req">*</span></label>
        <input id="wh-rn" v-model="renameTo" class="fx-input" @keydown.enter="doRename" /></div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!renameTo.trim() || renameTo.trim() === renaming.name" @click="doRename">Rename</button>
        <button type="button" class="fx-btn" @click="renaming = null">Cancel</button>
      </template>
    </FxModal>

    <FxModal v-if="saveAs" :title="saveAs === 'view' ? 'Save as view' : 'Save as table'" @close="saveAs = ''">
      <div v-if="dropError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dropError }}</div>
      <div class="fx-field"><span class="fx-field__label">Schema</span>
        <select v-model="saveSchema" class="fx-select" aria-label="Schema"><option v-for="s in schemas" :key="s" :value="s">{{ s }}</option></select></div>
      <div class="fx-field"><label for="wh-sv">{{ saveAs === 'view' ? 'View' : 'Table' }} name<span class="fx-field__req">*</span></label>
        <input id="wh-sv" v-model="saveName" class="fx-input" /></div>
      <div class="fx-field"><span class="fx-field__label">SQL that will run</span>
        <pre class="wh-preview">{{ saveSql }}</pre></div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!saveName.trim()" @click="doSaveAs">OK</button>
        <button type="button" class="fx-btn" @click="saveAs = ''">Cancel</button>
      </template>
    </FxModal>

    <FxPanel v-if="propsOf" :title="propsOf.name" width="440px" @close="propsOf = null">
      <dl class="wh-props">
        <dt>Type</dt><dd>{{ propsOf.kind }}</dd>
        <dt>Schema</dt><dd>{{ propsOf.schema }}</dd>
        <dt>Rows</dt><dd>{{ propsOf.rows ?? '-' }}</dd>
        <template v-if="propsOf.shortcut"><dt>Shortcut to</dt><dd>{{ propsOf.shortcut }}</dd></template>
      </dl>
      <h3 class="wh-h3">Columns</h3>
      <table class="fx-table"><thead><tr><th>Name</th><th>Data type</th></tr></thead>
        <tbody><tr v-for="c in ((propsOf.columns || []) as any[])" :key="c[0]"><td>{{ c[0] }}</td><td class="fx-mono">{{ c[1] || 'varchar' }}</td></tr></tbody></table>
    </FxPanel>

    <NewItemDialog v-if="newModel" :ws="wsName" initial-type="SemanticModel" @close="newModel = false"
                   @created="v => { newModel = false; go({ page: 'item', ws: v.ws, item: v.name, type: v.type }) }" />
    <ItemSettingsPanel v-if="settings && item" :item="item" :tab="settings" @close="settings = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import FxIcon from './FxIcon.vue';
import FxModal from './FxModal.vue';
import FxPanel from './FxPanel.vue';
import FxMenu from './FxMenu.vue';
import FxGrid from './FxGrid.vue';
import ItemHeader from './ItemHeader.vue';
import NewItemDialog from './NewItemDialog.vue';
import ItemSettingsPanel from './ItemSettingsPanel.vue';
import { errorText, gridsOf, messagesOf, rows, useFabric, type Grid } from './fabric';
import { copyText, menuAt, type MenuAt, type MenuEntry } from './menu';

interface QueryTab { id: number; title: string; sql: string; grids: Grid[]; gridIndex: number;
  messages: string; error: boolean; running: boolean; ran: boolean; view: 'results' | 'messages' }

const TEMPLATE_TABLE = 'CREATE TABLE dbo.new_table\n(\n    id INT NOT NULL,\n    name VARCHAR(100),\n    created_at DATETIME2(6)\n);';
const TEMPLATE_VIEW = 'CREATE VIEW dbo.new_view\nAS\nSELECT *\nFROM dbo.table_name;';
const TEMPLATE_PROC = 'CREATE PROCEDURE dbo.new_procedure\nAS\nBEGIN\n    SELECT 1 AS result\nEND';

const { portal, route, go, api, run } = useFabric();
const wsName = computed(() => String(route.value.ws || ''));
const itemName = computed(() => String(route.value.item || ''));
const isEndpoint = computed(() => route.value.type === 'SQLEndpoint');
const item = computed(() => rows(portal.value, 'items').find(i => i.workspace === wsName.value
  && i.name === itemName.value && i.type === (isEndpoint.value ? 'Lakehouse' : 'Warehouse')));
const ribbon = ref('Home');
const settings = ref('');
const newModel = ref(false);
const objFilter = ref('');
const closed = ref<string[]>([]);
const selObj = ref('');

const objects = computed(() => rows(portal.value, 'objects').filter(o => o.item === itemName.value
  && o.workspace === wsName.value && (!objFilter.value || String(o.name).toLowerCase().includes(objFilter.value.toLowerCase()))));
const procs = computed(() => rows(portal.value, 'procedures').filter(p => !p.item || p.item === itemName.value));
const schemas = computed(() => {
  const set = new Set<string>(['dbo']);
  objects.value.forEach(o => set.add(String(o.schema)));
  procs.value.forEach(p => { if (String(p.name).includes('.')) set.add(String(p.name).split('.')[0]); });
  return [...set].sort();
});
function objectsIn(schema: string, kind: string) { return objects.value.filter(o => o.schema === schema && o.kind === kind); }
function procsIn(schema: string) {
  return procs.value.filter(p => (String(p.name).includes('.') ? String(p.name).split('.')[0] : 'dbo') === schema);
}
function toggle(schema: string) {
  closed.value = closed.value.includes(schema) ? closed.value.filter(s => s !== schema) : [...closed.value, schema];
}

let seq = 0;
const tabs = ref<QueryTab[]>([]);
const activeId = ref(0);
const active = computed(() => tabs.value.find(t => t.id === activeId.value) || null);

function newTab(sql = '', title = '') {
  seq += 1;
  const tab = reactive<QueryTab>({ id: seq, title: title || `SQL query ${seq}`, sql, grids: [], gridIndex: 0,
    messages: '', error: false, running: false, ran: false, view: 'results' });
  tabs.value.push(tab);
  activeId.value = tab.id;
  return tab;
}
function closeTab(id: number) {
  tabs.value = tabs.value.filter(t => t.id !== id);
  if (activeId.value === id) activeId.value = tabs.value[tabs.value.length - 1]?.id || 0;
}

async function ensureContext() {
  if (portal.value.sql_item !== itemName.value) {
    await api.exec(`USE [${itemName.value}]`, { surface: 'fabric_sql', quiet: true, unlogged: true });
  }
}

async function runQuery() {
  const tab = active.value;
  if (!tab || !tab.sql.trim()) return;
  tab.running = true;
  await ensureContext();
  const result = await api.exec(tab.sql, { surface: 'fabric_sql', quiet: true });
  tab.running = false;
  tab.ran = true;
  tab.grids = gridsOf(result);
  tab.gridIndex = Math.max(0, tab.grids.length - 1);
  tab.error = !result.ok;
  tab.messages = result.ok ? (messagesOf(result).join('\n') || 'Commands completed successfully.')
    : errorText(result);
  tab.view = result.ok && tab.grids.length ? 'results' : 'messages';
}

function selectTop(schema: string, name: string) {
  const tab = newTab(`SELECT TOP (100) *\nFROM [${itemName.value}].[${schema}].[${name}];`, `${name} (top 100)`);
  activeId.value = tab.id;
  runQuery();
}
function execProc(name: string) {
  newTab(`EXEC ${name};`, `EXEC ${name.split('.').pop()}`);
  runQuery();
}

const drop = ref<{ kind: string; schema: string; name: string } | null>(null);
const dropError = ref('');
function askDrop(kind: string, schema: string, name: string) { dropError.value = ''; drop.value = { kind, schema, name }; }
async function doDrop() {
  if (!drop.value) return;
  await ensureContext();
  const r = await run(`DROP ${drop.value.kind} [${drop.value.schema}].[${drop.value.name}]`,
    `Deleted ${drop.value.name}`, { surface: 'fabric_sql', quiet: true });
  if (!r.ok) { dropError.value = errorText(r); return; }
  drop.value = null;
}
function refreshExplorer() { closed.value = []; }

// ------------------------------------------------------------------ context menus
const menu = ref<{ at: MenuAt; items: MenuEntry[] } | null>(null);
function openMenu(event: MouseEvent, items: MenuEntry[]) {
  menu.value = { at: menuAt(event, 260, Math.min(460, items.length * 34 + 12)), items };
}
function bracket(schema: string, name: string) { return `[${schema}].[${name}]`; }
function scriptCreate(o: Record<string, any>): string {
  if (o.kind === 'View') {
    return o.definition ? `CREATE VIEW ${bracket(o.schema, o.name)}\nAS\n${o.definition}`
      : `-- The definition of ${o.schema}.${o.name} is not available\nCREATE VIEW ${bracket(o.schema, o.name)}\nAS\nSELECT 1 AS placeholder;`;
  }
  const cols = ((o.columns || []) as any[]).map((c: any) => `    [${c[0]}] ${String(c[1] || 'VARCHAR(8000)').toUpperCase()}`);
  return `CREATE TABLE ${bracket(o.schema, o.name)}\n(\n${cols.join(',\n')}\n);`;
}
function rootMenu(): MenuEntry[] {
  return [
    { label: 'New SQL query', icon: 'code', action: () => newTab() },
    ...(isEndpoint.value ? [] : [
      { label: 'New table', icon: 'Table', action: () => newTab(TEMPLATE_TABLE, 'New table') },
      { label: 'New stored procedure', icon: 'Procedure', action: () => newTab(TEMPLATE_PROC, 'New stored procedure') },
    ] as MenuEntry[]),
    { label: 'New view', icon: 'View', action: () => newTab(TEMPLATE_VIEW, 'New view') },
    { sep: true },
    { label: 'Refresh', icon: 'refresh', action: refreshExplorer },
  ];
}
function schemaMenu(schema: string): MenuEntry[] {
  const swap = (t: string) => t.replace(/\bdbo\./g, `${schema}.`);
  return [
    { label: 'New SQL query', icon: 'code', action: () => newTab(`SELECT *\nFROM [${schema}].[table_name];`) },
    ...(isEndpoint.value ? [] : [
      { label: 'New table', icon: 'Table', action: () => newTab(swap(TEMPLATE_TABLE), 'New table') },
      { label: 'New stored procedure', icon: 'Procedure', action: () => newTab(swap(TEMPLATE_PROC), 'New stored procedure') },
    ] as MenuEntry[]),
    { label: 'New view', icon: 'View', action: () => newTab(swap(TEMPLATE_VIEW), 'New view') },
    { sep: true },
    { label: closed.value.includes(schema) ? 'Expand' : 'Collapse', action: () => toggle(schema) },
  ];
}
function objectMenu(o: Record<string, any>): MenuEntry[] {
  const view = o.kind === 'View';
  const shortcut = !!o.shortcut;
  const readOnly = isEndpoint.value;
  const cols = ((o.columns || []) as any[]).map((c: any) => `[${c[0]}]`).join(', ') || '*';
  return [
    { label: 'Select TOP 100', icon: 'play', action: () => selectTop(o.schema, o.name) },
    { label: 'New SQL query', icon: 'code', action: () => newTab(`SELECT *\nFROM ${bracket(o.schema, o.name)}\nWHERE 1 = 1;`, o.name) },
    { sep: true },
    { heading: true, label: 'Script as' },
    { label: 'CREATE', icon: 'code', action: () => newTab(scriptCreate(o), `Create ${o.name}`) },
    { label: 'SELECT', icon: 'code', action: () => newTab(`SELECT ${cols}\nFROM ${bracket(o.schema, o.name)};`, `Select ${o.name}`) },
    { label: 'DROP', icon: 'code', action: () => newTab(`DROP ${view ? 'VIEW' : 'TABLE'} ${bracket(o.schema, o.name)};`, `Drop ${o.name}`) },
    { sep: true },
    { label: 'Copy name', icon: 'copy', action: () => copyText(api, `${o.schema}.${o.name}`, 'Name') },
    ...(view || readOnly || shortcut ? [] : [{ label: 'Rename', icon: 'edit', action: () => openRename(o) }] as MenuEntry[]),
    ...(readOnly && !view ? [] : [{ label: 'Delete', icon: 'delete', danger: true, action: () => askDrop(view ? 'VIEW' : 'TABLE', o.schema, o.name) }] as MenuEntry[]),
    { sep: true },
    { label: 'Properties', icon: 'info', action: () => { propsOf.value = { ...o }; } },
  ];
}
function procMenu(p: Record<string, any>): MenuEntry[] {
  const params = ((p.params || []) as string[]);
  const name = String(p.name);
  const short = name.split('.').pop() || name;
  return [
    { label: 'Execute', icon: 'play', action: () => execProc(name) },
    { label: 'Script as CREATE', icon: 'code', action: () => newTab(`CREATE OR ALTER PROCEDURE ${name}${params.length ? ' ' + params.map(x => `${x} VARCHAR(100)`).join(', ') : ''}\nAS\nBEGIN\n${p.body}\nEND`, `Alter ${short}`) },
    { label: 'Script as EXECUTE', icon: 'code', action: () => newTab(`EXEC ${name}${params.length ? ' ' + params.map(x => `${x} = NULL`).join(', ') : ''};`, `EXEC ${short}`) },
    { sep: true },
    { label: 'Copy name', icon: 'copy', action: () => copyText(api, name, 'Name') },
    ...(isEndpoint.value ? [] : [{ label: 'Delete', icon: 'delete', danger: true, action: () => askDrop('PROCEDURE', name.includes('.') ? name.split('.')[0] : 'dbo', short) }] as MenuEntry[]),
  ];
}

// ------------------------------------------------------------------ rename (sp_rename)
const renaming = ref<Record<string, any> | null>(null);
const renameTo = ref('');
function openRename(o: Record<string, any>) { dropError.value = ''; renaming.value = o; renameTo.value = String(o.name); }
async function doRename() {
  const o = renaming.value;
  if (!o) return;
  const to = renameTo.value.trim().replace(/'/g, "''");
  await ensureContext();
  const r = await run(`EXEC sp_rename '${o.schema}.${o.name}', '${to}'`,
    `Renamed ${o.name} to ${renameTo.value.trim()}`, { surface: 'fabric_sql', quiet: true });
  if (!r.ok) { dropError.value = errorText(r); return; }
  renaming.value = null;
}

// ------------------------------------------------------------------ save as view / table
const saveAs = ref<'' | 'view' | 'table'>('');
const saveSchema = ref('dbo');
const saveName = ref('');
function isSelect(sql: string) { return /^\s*(WITH|SELECT)\b/i.test(sql || ''); }
const saveSql = computed(() => {
  const body = (active.value?.sql || '').trim().replace(/;\s*$/, '');
  const target = bracket(saveSchema.value, saveName.value.trim() || 'name');
  return saveAs.value === 'view' ? `CREATE VIEW ${target}\nAS\n${body}` : `CREATE TABLE ${target}\nAS\n${body}`;
});
function openSaveAs(kind: 'view' | 'table') {
  dropError.value = '';
  saveAs.value = kind;
  saveSchema.value = 'dbo';
  saveName.value = kind === 'view' ? 'vw_new' : 'new_table';
}
async function doSaveAs() {
  await ensureContext();
  const kind = saveAs.value;
  const r = await run(saveSql.value, `${kind === 'view' ? 'View' : 'Table'} ${saveSchema.value}.${saveName.value.trim()} created`,
    { surface: 'fabric_sql', quiet: true });
  if (!r.ok) { dropError.value = errorText(r); return; }
  saveAs.value = '';
}

// ------------------------------------------------------------------ properties
const propsOf = ref<Record<string, any> | null>(null);

// ------------------------------------------------------------------ results: copy / download
function currentGrid(): Grid | null { return active.value?.grids[active.value.gridIndex] || null; }
function cellText(v: unknown) { return v === null || v === undefined ? '' : String(v); }
function csvCell(v: unknown) {
  const t = cellText(v);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
function copyResults() {
  const g = currentGrid();
  if (!g) return;
  const text = [g.columns.join('\t'), ...g.rows.map(r => r.map(cellText).join('\t'))].join('\n');
  copyText(api, text, `${g.rows.length} row(s)`);
}
function saveBlob(text: string, name: string, type: string) {
  // A local download of text the page already holds - no request is made.
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadMenu(): MenuEntry[] {
  const g = currentGrid();
  const base = (active.value?.title || 'results').replace(/[^\w-]+/g, '_');
  const csv = g ? [g.columns.map(csvCell).join(','), ...g.rows.map(r => r.map(csvCell).join(','))].join('\n') + '\n' : '';
  const json = g ? JSON.stringify(g.rows.map(r => Object.fromEntries(g.columns.map((c, i) => [c, r[i] ?? null]))), null, 2) : '';
  return [
    { label: 'CSV', icon: 'File', disabled: !g, action: () => saveBlob(csv, `${base}.csv`, 'text/csv') },
    { label: 'JSON', icon: 'File', disabled: !g, action: () => saveBlob(json, `${base}.json`, 'application/json') },
  ];
}

onMounted(() => {
  newTab(isEndpoint.value
    ? `SELECT TOP (100) *\nFROM [${itemName.value}].[dbo].[${objects.value[0]?.name || 'table_name'}];`
    : '');
  ensureContext();
});
</script>

<style scoped>
.wh-switch { width: 200px; }
@container sl-portal (max-width: 600px) { .wh-switch { width: 124px; flex: none; } }
.wh-filter { width: 120px; min-height: 28px; padding: 3px 8px; font-size: 13px; }
.wh-root { font-weight: 600; cursor: default; }
.wh-l1 { padding-left: 10px; cursor: default; }
.wh-l2 { padding-left: 18px; }
.wh-l3 { padding-left: 40px; }
.wh-l4 { padding-left: 52px; }
.wh-group { color: #424242; font-size: 13px; cursor: default; }
.wh-act { width: 20px; height: 20px; opacity: 0; }
.fx-node:hover .wh-act { opacity: 1; }
.wh-qtabs { display: flex; align-items: flex-end; gap: 2px; padding: 6px 8px 0; background: #fafafa; border-bottom: 1px solid #e0e0e0; overflow-x: auto; overflow-y: hidden; flex: none; }
.wh-qtab { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border: 1px solid transparent; border-bottom: 0; border-radius: 4px 4px 0 0; background: transparent; font: 13px "Segoe UI", sans-serif; color: #424242; cursor: pointer; white-space: nowrap; }
.wh-qtab.is-active { background: #fff; border-color: #e0e0e0; color: #242424; font-weight: 600; margin-bottom: -1px; height: 33px; }
.wh-qclose { display: inline-grid; place-items: center; width: 20px; height: 20px; margin-right: -4px; border-radius: 4px; color: #616161; font-size: 15px; font-weight: 400; }
.wh-qclose:hover { background: #ebebeb; color: #242424; }
.wh-qnew { font-size: 16px; }
.wh-editorbar { display: flex; align-items: center; gap: 10px; padding: 6px 10px; }
.wh-ctx { font-size: 12px; }
.wh-code { flex: 0 0 auto; height: 38%; min-height: 110px; border-top: 1px solid #f0f0f0; border-bottom: 1px solid #e0e0e0; }
.wh-results { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.wh-rtabs { align-items: center; }
.wh-sets { display: inline-flex; gap: 4px; margin-left: 8px; }
.wh-messages { flex: 1; margin: 0; padding: 10px 12px; overflow: auto; font: 13px/18px Consolas, monospace; white-space: pre-wrap; color: #242424; }
.wh-messages.is-error { color: #c50f1f; }
.wh-p { margin: 0 0 8px; }
.wh-row { position: relative; }
.wh-row:focus-within .wh-act { opacity: 1; }
.wh-preview { margin: 0; padding: 8px 10px; background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; font: 12px/17px Consolas, monospace; white-space: pre-wrap; max-height: 160px; overflow: auto; }
.wh-props { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0 0 16px; font-size: 13px; }
.wh-props dt { color: #616161; }
.wh-props dd { margin: 0; word-break: break-all; }
.wh-h3 { font: 600 14px "Segoe UI", sans-serif; margin: 8px 0; }
</style>
