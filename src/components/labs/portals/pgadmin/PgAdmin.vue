<template>
  <div ref="root" class="pg-app" dir="ltr" :class="{ 'is-nav-open': navOpen }">
    <!-- ===== the menubar ===== -->
    <header class="pg-top">
      <button type="button" class="pg-top__burger" aria-label="Object Explorer" :aria-expanded="navOpen" @click="navOpen = !navOpen"><PgIcon name="menu" /></button>
      <span class="pg-top__brand" aria-label="pgAdmin 4">
        <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3c-6 0-10 3.6-10 9.4v5.2c0 2.2.9 3.4 2.4 3.4h1.7v5.5c0 1.5 1 2.5 2.5 2.5h.8V20h2.2v9h1v-9h2.2v9h.8c1.5 0 2.5-1 2.5-2.5V21h1.7c1.5 0 2.4-1.2 2.4-3.4v-5.2C26 6.6 22 3 16 3z" fill="#fff" /><circle cx="12.5" cy="11" r="1.4" fill="#326690" /></svg>
        <span class="pg-top__name"><b>pg</b>Admin</span>
      </span>
      <nav class="pg-top__menus" aria-label="Main menu">
        <button v-for="m in MENUS" :key="m" type="button" class="pg-top__menu" :class="{ 'is-open': topMenu === m }"
                aria-haspopup="menu" @mousedown.stop @click.stop="openTopMenu(m, $event)">{{ m }}</button>
      </nav>
      <span class="pg-top__grow" />
      <span class="pg-top__user" title="Logged in as admin@shopflow.internal">admin@shopflow.internal <PgIcon name="caret-down" :size="10" /></span>
    </header>

    <div class="pg-body" :style="{ '--pg-nav-w': navWidth + 'px' }">
      <!-- ===== Object Explorer ===== -->
      <aside class="pg-nav" aria-label="Object Explorer">
        <div class="pg-panel-head"><span>Object Explorer</span></div>
        <div class="pg-nav__tools" role="toolbar" aria-label="Object Explorer tools">
          <button type="button" class="pg-nav__tool" title="Query Tool" @click="openQueryTool()"><PgIcon name="query-tool" /></button>
          <button type="button" class="pg-nav__tool" title="View Data" :disabled="!selectedTable" @click="selectedTable && openData(selectedTable, 'all')"><PgIcon name="grid" /></button>
          <button type="button" class="pg-nav__tool" title="View Data (Filtered Rows)" :disabled="!selectedTable" @click="selectedTable && openData(selectedTable, 'all', true)"><PgIcon name="filter" /></button>
          <button type="button" class="pg-nav__tool" title="Search objects" :class="{ 'is-on': searchOpen }" @click="toggleSearch"><PgIcon name="search" /></button>
          <button type="button" class="pg-nav__tool" title="PSQL Tool" @click="psqlTool"><PgIcon name="terminal" /></button>
        </div>
        <div v-if="searchOpen" class="pg-nav__search">
          <input ref="searchBox" v-model="treeFilter" class="pg-input" placeholder="Search objects (name)" aria-label="Search objects" />
        </div>
        <PgTree :root="tree" :expanded="expanded" :selected-id="selectedId" :filter="treeFilter"
                @select="select" @toggle="toggle" @open="openNode" @menu="onTreeMenu" />
      </aside>
      <div class="pg-split" role="separator" aria-orientation="vertical" aria-label="Resize Object Explorer" tabindex="0"
           @pointerdown="startResize" @keydown.left="navWidth = Math.max(200, navWidth - 20)" @keydown.right="navWidth = Math.min(520, navWidth + 20)" />

      <!-- ===== the main panel ===== -->
      <main class="pg-main">
        <div class="pg-tabs" role="tablist">
          <button v-for="t in FIXED_TABS" :key="t.id" type="button" role="tab" class="pg-tab" :aria-selected="activeTab === t.id"
                  :class="{ 'is-active': activeTab === t.id }" @click="activeTab = t.id">{{ t.label }}</button>
          <div v-for="q in queryTabs" :key="q.id" class="pg-tab pg-tab--qt" :class="{ 'is-active': activeTab === 'qt:' + q.id }" role="tab"
               :aria-selected="activeTab === 'qt:' + q.id">
            <button type="button" class="pg-tab__btn" :title="q.title" @click="activeTab = 'qt:' + q.id">
              <PgIcon :name="q.kind === 'data' ? 'grid' : 'query-tool'" :size="14" /><span class="pg-tab__label">{{ q.title }}</span></button>
            <button type="button" class="pg-tab__x" :aria-label="'Close ' + q.title" @click="closeTab(q.id)"><PgIcon name="close" :size="11" /></button>
          </div>
        </div>
        <div class="pg-crumbs" v-if="!activeTab.startsWith('qt:') && crumbs.length">
          <template v-for="(c, i) in crumbs" :key="c.id"><span v-if="i" class="pg-crumbs__sep">/</span>
            <button type="button" class="pg-crumbs__item" @click="selectById(c.id)">{{ c.label }}</button></template>
        </div>
        <div class="pg-panes">
          <PgDashboard v-if="activeTab === 'dashboard'" :scope="dashScope" @select-server="selectById('server:1')" />
          <PgObjectTab v-else-if="isObjectTab" :node="selected" :tab="activeTab as any" @open-node="selectById" />
          <div v-else-if="activeTab === 'processes'" class="pg-procs">
            <table class="pg-table">
              <thead><tr><th>PID</th><th>Type</th><th>Server</th><th>Object</th><th>Start time</th><th>Status</th><th>Time taken (sec)</th><th></th></tr></thead>
              <tbody>
                <tr v-if="!processes.length"><td colspan="8" class="pg-muted">No rows found</td></tr>
                <tr v-for="p in processes" :key="p.id">
                  <td class="is-num">{{ 7000 + (p.id % 997) }}</td><td>{{ p.type }}</td><td>{{ p.server }}</td><td>{{ p.object }}</td><td>{{ p.at }}</td>
                  <td><span class="pg-proc" :class="p.ok ? 'is-ok' : 'is-bad'">{{ p.ok ? 'Finished' : 'Failed' }}</span></td>
                  <td class="is-num">{{ (p.ms / 1000).toFixed(2) }}</td>
                  <td><button type="button" class="pg-btn pg-btn--sm" @click="procDetail = p">View details</button></td>
                </tr>
              </tbody>
            </table>
            <div v-if="procDetail" class="pg-procs__detail">
              <header><strong>{{ procDetail.type }} - {{ procDetail.object }}</strong>
                <button type="button" class="pg-btn pg-btn--icon pg-btn--sm" aria-label="Close" @click="procDetail = null"><PgIcon name="close" :size="12" /></button></header>
              <PgCode :sql="procDetail.sql" />
              <pre class="pg-procs__log">{{ procDetail.detail }}</pre>
            </div>
          </div>
          <PgQueryTool v-for="q in queryTabs" v-show="activeTab === 'qt:' + q.id" :key="q.id" :tab="q" :active="activeTab === 'qt:' + q.id" />
        </div>
      </main>
    </div>

    <!-- ===== notifications (notistack, bottom right) ===== -->
    <div class="pg-snacks" aria-live="polite">
      <div v-for="f in shownFlashes" :key="f.id" class="pg-snack" :class="'is-' + f.type" role="status">
        <PgIcon :name="f.type === 'success' ? 'check-circle' : f.type === 'error' ? 'error-circle' : f.type === 'warning' ? 'warn' : 'info'" :size="18" class="pg-snack__icon" />
        <div class="pg-snack__body"><strong>{{ f.title }}</strong><span v-if="f.detail">{{ f.detail }}</span></div>
        <button type="button" class="pg-snack__x" aria-label="Close" @click="api.dismiss(f.id)"><PgIcon name="close" :size="12" /></button>
      </div>
    </div>

    <PgMenu v-if="menu" :items="menu.items" :x="menu.x" :y="menu.y" @close="menu = null" />

    <!-- ===== dialogs ===== -->
    <CreateTableDialog v-if="dialog?.kind === 'create-table'" @close="dialog = null" />
    <TablePropsDialog v-else-if="dialog?.kind === 'table-props'" :table="dialog.table" @close="dialog = null" />
    <CreateIndexDialog v-else-if="dialog?.kind === 'create-index'" :fixed-table="dialog.table" @close="dialog = null" />
    <ColumnDialog v-else-if="dialog?.kind === 'create-column'" :table="dialog.table" @close="dialog = null" />
    <ColumnDialog v-else-if="dialog?.kind === 'column-props'" :table="dialog.table" :column="dialog.column" @close="dialog = null" />
    <CreateViewDialog v-else-if="dialog?.kind === 'create-view'" :materialized="dialog.materialized" @close="dialog = null" />
    <MaintenanceDialog v-else-if="dialog?.kind === 'maintenance'" :request="dialog" @close="dialog = null" />
    <DropDialog v-else-if="dialog?.kind === 'drop' || dialog?.kind === 'truncate'" :request="dialog" @close="dialog = null" />
  </div>
</template>

<script setup lang="ts">
/**
 * pgAdmin 4 (v8) over the ShopFlow PostgreSQL source (`sim:dataplat`, module
 * `source.py`).
 *
 * The Object Explorer, the object tabs (Dashboard, Properties, SQL,
 * Statistics, Dependencies, Dependents, Processes), the Query Tool with its
 * graphical EXPLAIN, View/Edit Data with in-grid editing, and the object
 * dialogs. Everything that changes the database is a PostgreSQL statement run
 * on the `pg_sql` surface - the same tool the lab's PostgreSQL Query Tool is -
 * so a dialog's SQL tab, the equivalent-CLI strip under the frame and the
 * console all show the one statement that ran, and a lab task passes whichever
 * way the student got there.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '../../../../utils/labCatalogue';
import PgIcon from './PgIcon.vue';
import PgTree from './PgTree.vue';
import PgMenu from './PgMenu.vue';
import PgCode from './PgCode.vue';
import PgDashboard from './PgDashboard.vue';
import PgObjectTab from './PgObjectTab.vue';
import PgQueryTool from './PgQueryTool.vue';
import CreateTableDialog from './CreateTableDialog.vue';
import TablePropsDialog from './TablePropsDialog.vue';
import CreateIndexDialog from './CreateIndexDialog.vue';
import ColumnDialog from './ColumnDialog.vue';
import CreateViewDialog from './CreateViewDialog.vue';
import MaintenanceDialog from './MaintenanceDialog.vue';
import DropDialog from './DropDialog.vue';
import { PG, type DialogRequest, type MenuItem, type PgContext, type Process, type QueryTab, type RunSqlOptions } from './pgContext';
import {
  browserUrl, buildTree, gridsOf, indexDdl, indexTree, readModel, roleDdl, tableDdl, tableScript, viewDdl, type TreeNode,
} from './pg';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const root = ref<HTMLElement | null>(null);
const model = computed(() => readModel(props.view || {}));
const tree = computed(() => buildTree(model.value));
const index = computed(() => indexTree(tree.value));

const MENUS = ['File', 'Object', 'Tools', 'Help'] as const;
const FIXED_TABS = [
  { id: 'dashboard', label: 'Dashboard' }, { id: 'properties', label: 'Properties' }, { id: 'sql', label: 'SQL' },
  { id: 'statistics', label: 'Statistics' }, { id: 'dependencies', label: 'Dependencies' }, { id: 'dependents', label: 'Dependents' },
  { id: 'processes', label: 'Processes' },
];

const expanded = ref(new Set<string>(['servers', 'server:1', 'server/databases', `db:${model.value.database}`,
  `${model.value.database}/schemas`, 'schema:public', 'public/tables']));
const selectedId = ref('server:1');
const selected = computed<TreeNode | null>(() => index.value.byId.get(selectedId.value) || null);
const activeTab = ref('dashboard');
const queryTabs = ref<QueryTab[]>([]);
const dialog = ref<DialogRequest | null>(null);
const menu = ref<{ items: MenuItem[]; x: number; y: number } | null>(null);
const topMenu = ref('');
const treeFilter = ref('');
const searchOpen = ref(false);
const searchBox = ref<HTMLInputElement | null>(null);
const navOpen = ref(false);
const navWidth = ref(290);
const processes = ref<Process[]>([]);
const procDetail = ref<Process | null>(null);
let nextTab = 1;

const isObjectTab = computed(() => ['properties', 'sql', 'statistics', 'dependencies', 'dependents'].includes(activeTab.value));
const selectedTable = computed(() => (selected.value?.kind === 'table' ? selected.value.table || '' : ''));

const dashScope = computed<'' | 'server' | 'database'>(() => {
  const id = selectedId.value;
  if (!selected.value || id === 'servers') return '';
  const chain = ancestry(id);
  if (chain.some(n => n.kind === 'database')) return 'database';
  return 'server';
});

function ancestry(id: string): TreeNode[] {
  const out: TreeNode[] = [];
  let cur: string | undefined = id;
  while (cur) {
    const node = index.value.byId.get(cur);
    if (node) out.unshift(node);
    cur = index.value.parent.get(cur);
  }
  return out;
}
const crumbs = computed(() => ancestry(selectedId.value).filter(n => n.kind !== 'servers'));

/* ---------- tree interaction ---------- */

function select(node: TreeNode) {
  selectedId.value = node.id;
  navOpen.value = false;
}
function selectById(id: string) {
  const chain = ancestry(id);
  const next = new Set(expanded.value);
  chain.slice(0, -1).forEach(n => next.add(n.id));
  expanded.value = next;
  if (index.value.byId.has(id)) selectedId.value = id;
  if (activeTab.value.startsWith('qt:')) activeTab.value = 'properties';
}
function toggle(node: TreeNode) {
  const next = new Set(expanded.value);
  if (next.has(node.id)) next.delete(node.id);
  else next.add(node.id);
  expanded.value = next;
}
function openNode(node: TreeNode) {
  selectedId.value = node.id;
  if (activeTab.value === 'dashboard' || activeTab.value.startsWith('qt:')) activeTab.value = 'properties';
}

// An object that was dropped leaves its node behind: fall back to the nearest ancestor that still exists.
watch(index, idx => {
  if (idx.byId.has(selectedId.value)) return;
  let id = selectedId.value;
  while (id.includes('/')) {
    id = id.slice(0, id.lastIndexOf('/'));
    if (idx.byId.has(id)) { selectedId.value = id; return; }
  }
  selectedId.value = id.startsWith('t:') ? 'public/tables' : id.startsWith('v:') ? 'public/views'
    : id.startsWith('mv:') ? 'public/mviews' : 'server:1';
});

function toggleSearch() {
  searchOpen.value = !searchOpen.value;
  if (!searchOpen.value) treeFilter.value = '';
  else nextTick(() => searchBox.value?.focus());
}

function psqlTool() {
  notify('info', 'PSQL Tool', `psql is the lab's "psql (PostgreSQL)" console - connected to ${model.value.database} as postgres. Every statement this pgAdmin runs works there too.`);
}

/* ---------- actions ---------- */

async function runSql(sql: string, options: RunSqlOptions = {}) {
  return props.api.exec(sql, { surface: 'pg_sql', success: options.success, quiet: options.quiet, unlogged: options.unlogged });
}

function openQueryTool(sql = '', autorun = false) {
  const id = nextTab++;
  queryTabs.value = [...queryTabs.value, { id, kind: 'query', title: `${model.value.database}/postgres@${model.value.server}`, sql, autorun }];
  activeTab.value = 'qt:' + id;
  navOpen.value = false;
}

function openData(table: string, limit: 'all' | 'first' | 'last', filter = false) {
  const id = nextTab++;
  queryTabs.value = [...queryTabs.value, {
    id, kind: 'data', title: `${table}/${model.value.database}/postgres@${model.value.server}`, table, schema: 'public',
    limit, sql: '', autorun: true, filter,
  }];
  activeTab.value = 'qt:' + id;
  navOpen.value = false;
}

function closeTab(id: number) {
  const list = queryTabs.value;
  const i = list.findIndex(t => t.id === id);
  queryTabs.value = list.filter(t => t.id !== id);
  if (activeTab.value === 'qt:' + id) {
    const next = queryTabs.value[i] || queryTabs.value[i - 1];
    activeTab.value = next ? 'qt:' + next.id : 'properties';
  }
}

function openDialog(request: DialogRequest) {
  menu.value = null;
  dialog.value = request;
}

function notify(type: 'success' | 'error' | 'info' | 'warning', title: string, detail = '') {
  props.api.notify(type, title, detail);
}

function table(name: string) {
  return model.value.tables.find(t => t.name === name);
}

async function countRows(name: string) {
  const result = await runSql(`SELECT count(*) AS count FROM public.${name};`, { quiet: true });
  const grid = gridsOf(result)[0];
  if (result.ok && grid) notify('success', `Table rows counted: ${grid.rows[0]?.[0] ?? '?'}`);
  else notify('error', 'Count Rows failed', String(result.error || ''));
}

function refresh() {
  emit('refresh');
}

const shownFlashes = computed(() => props.api.flashes.value.slice(0, 4));

/* ---------- context menus ---------- */

function propsAction(node: TreeNode): MenuItem {
  return {
    label: 'Properties...', icon: 'format', action: () => {
      selectedId.value = node.id;
      if (node.kind === 'table' && node.table) openDialog({ kind: 'table-props', table: node.table });
      else if (node.kind === 'column' && node.table && node.name) openDialog({ kind: 'column-props', table: node.table, column: node.name });
      else activeTab.value = 'properties';
    },
  };
}
const REFRESH: MenuItem = { label: 'Refresh...', icon: 'refresh', action: () => refresh() };

function itemsFor(node: TreeNode | null): MenuItem[] {
  if (!node) return [{ label: 'Refresh...', icon: 'refresh', action: refresh }];
  const qt: MenuItem = { label: 'Query Tool', icon: 'query-tool', action: () => openQueryTool() };
  const t = node.table || '';
  switch (node.kind) {
    case 'servers':
      return [REFRESH];
    case 'server':
      return [REFRESH, { sep: true }, qt, { sep: true }, propsAction(node)];
    case 'database':
      return [REFRESH, { label: 'Maintenance...', icon: 'refresh', action: () => openDialog({ kind: 'maintenance', target: 'database', name: model.value.database }) },
        { sep: true }, { label: 'Create', children: [{ label: 'Table...', icon: 'table', action: () => openDialog({ kind: 'create-table' }) },
          { label: 'View...', icon: 'view', action: () => openDialog({ kind: 'create-view' }) }] }, { sep: true }, qt, { sep: true }, propsAction(node)];
    case 'schema':
      return [{ label: 'Create', children: [
        { label: 'Table...', icon: 'table', action: () => openDialog({ kind: 'create-table' }) },
        { label: 'View...', icon: 'view', action: () => openDialog({ kind: 'create-view' }) },
        { label: 'Materialized View...', icon: 'mview', action: () => openDialog({ kind: 'create-view', materialized: true }) },
        { label: 'Index...', icon: 'index', action: () => openDialog({ kind: 'create-index' }) },
      ] }, REFRESH, { sep: true }, qt, { sep: true }, propsAction(node)];
    case 'tables':
      return [{ label: 'Create', children: [{ label: 'Table...', icon: 'table', action: () => openDialog({ kind: 'create-table' }) }] }, REFRESH, { sep: true }, qt];
    case 'table':
      return [
        { label: 'Count Rows', action: () => countRows(t) },
        { label: 'Create', children: [
          { label: 'Table...', icon: 'table', action: () => openDialog({ kind: 'create-table' }) },
          { label: 'Column...', icon: 'column', action: () => openDialog({ kind: 'create-column', table: t }) },
          { label: 'Index...', icon: 'index', action: () => openDialog({ kind: 'create-index', table: t }) },
        ] },
        { label: 'Delete', icon: 'trash', action: () => openDialog({ kind: 'drop', objType: 'TABLE', name: t, cascade: false }) },
        { label: 'Delete (Cascade)', icon: 'trash', action: () => openDialog({ kind: 'drop', objType: 'TABLE', name: t, cascade: true }) },
        { label: 'Truncate', children: [
          { label: 'Truncate', action: () => openDialog({ kind: 'truncate', table: t, mode: 'plain' }) },
          { label: 'Truncate Cascade', action: () => openDialog({ kind: 'truncate', table: t, mode: 'cascade' }) },
          { label: 'Truncate Restart Identity', action: () => openDialog({ kind: 'truncate', table: t, mode: 'restart' }) },
        ] },
        REFRESH,
        { label: 'Maintenance...', icon: 'refresh', action: () => openDialog({ kind: 'maintenance', target: 'table', name: t }) },
        { sep: true },
        { label: 'Scripts', icon: 'sql', children: scriptItems(node) },
        { label: 'View/Edit Data', icon: 'grid', children: [
          { label: 'All Rows', action: () => openData(t, 'all') },
          { label: 'First 100 Rows', action: () => openData(t, 'first') },
          { label: 'Last 100 Rows', action: () => openData(t, 'last') },
          { label: 'Filtered Rows...', action: () => openData(t, 'all', true) },
        ] },
        { sep: true }, qt, { sep: true }, propsAction(node),
      ];
    case 'columns':
      return [{ label: 'Create', children: [{ label: 'Column...', icon: 'column', action: () => openDialog({ kind: 'create-column', table: t }) }] }, REFRESH];
    case 'column':
      return [{ label: 'Delete', icon: 'trash', disabled: node.icon === 'column-pk', action: () => openDialog({ kind: 'drop', objType: 'COLUMN', name: node.name || '', table: t, cascade: false }) },
        REFRESH, { sep: true }, propsAction(node)];
    case 'indexes':
      return [{ label: 'Create', children: [{ label: 'Index...', icon: 'index', action: () => openDialog({ kind: 'create-index', table: t }) }] }, REFRESH];
    case 'index':
      return [
        { label: 'Create', children: [{ label: 'Index...', icon: 'index', action: () => openDialog({ kind: 'create-index', table: t }) }] },
        { label: 'Delete', icon: 'trash', action: () => openDialog({ kind: 'drop', objType: 'INDEX', name: node.name || '', table: t, cascade: false }) },
        { label: 'Delete (Cascade)', icon: 'trash', action: () => openDialog({ kind: 'drop', objType: 'INDEX', name: node.name || '', table: t, cascade: true }) },
        REFRESH,
        { label: 'Scripts', icon: 'sql', children: scriptItems(node) },
        { sep: true }, propsAction(node),
      ];
    case 'constraints':
      return [REFRESH];
    case 'pkey':
    case 'fkey':
    case 'ukey':
    case 'check':
      return [{ label: 'Delete', icon: 'trash', action: () => openDialog({ kind: 'drop', objType: 'CONSTRAINT', name: node.name || '', table: t, cascade: false }) },
        { label: 'Delete (Cascade)', icon: 'trash', action: () => openDialog({ kind: 'drop', objType: 'CONSTRAINT', name: node.name || '', table: t, cascade: true }) },
        REFRESH, { label: 'Scripts', icon: 'sql', children: [{ label: 'CREATE Script', action: () => { selectedId.value = node.id; activeTab.value = 'sql'; } }] },
        { sep: true }, propsAction(node)];
    case 'views':
      return [{ label: 'Create', children: [{ label: 'View...', icon: 'view', action: () => openDialog({ kind: 'create-view' }) }] }, REFRESH];
    case 'view': {
      const mat = node.icon === 'mview';
      return [
        { label: 'Delete', icon: 'trash', action: () => openDialog({ kind: 'drop', objType: mat ? 'MATERIALIZED VIEW' : 'VIEW', name: node.name || '', cascade: false }) },
        { label: 'Delete (Cascade)', icon: 'trash', action: () => openDialog({ kind: 'drop', objType: mat ? 'MATERIALIZED VIEW' : 'VIEW', name: node.name || '', cascade: true }) },
        REFRESH,
        { label: 'Scripts', icon: 'sql', children: scriptItems(node) },
        { label: 'View/Edit Data', icon: 'grid', children: [
          { label: 'All Rows', action: () => openQueryTool(`SELECT * FROM public.${node.name};`, true) },
          { label: 'First 100 Rows', action: () => openQueryTool(`SELECT * FROM public.${node.name}\nLIMIT 100;`, true) },
        ] },
        { sep: true }, propsAction(node),
      ];
    }
    case 'coll':
      if (node.id === 'public/mviews') {
        return [{ label: 'Create', children: [{ label: 'Materialized View...', icon: 'mview', action: () => openDialog({ kind: 'create-view', materialized: true }) }] }, REFRESH];
      }
      return [REFRESH];
    case 'role':
      return [REFRESH, { label: 'Scripts', icon: 'sql', children: scriptItems(node) }, { sep: true }, propsAction(node)];
    default:
      return [REFRESH, { sep: true }, propsAction(node)];
  }
}

function scriptItems(node: TreeNode): MenuItem[] {
  const m = model.value;
  if (node.kind === 'table') {
    const t = table(node.table || '');
    if (!t) return [];
    return [
      { label: 'CREATE Script', action: () => openQueryTool(tableDdl(m, t)) },
      { label: 'DELETE Script', action: () => openQueryTool(tableScript(t, 'delete')) },
      { label: 'INSERT Script', action: () => openQueryTool(tableScript(t, 'insert')) },
      { label: 'SELECT Script', action: () => openQueryTool(tableScript(t, 'select')) },
      { label: 'UPDATE Script', action: () => openQueryTool(tableScript(t, 'update')) },
    ];
  }
  if (node.kind === 'index') {
    const ix = m.indexes.find(i => i.table === node.table && i.name === node.name);
    return ix ? [{ label: 'CREATE Script', action: () => openQueryTool(indexDdl(ix)) }] : [];
  }
  if (node.kind === 'view') {
    const v = m.views.find(x => x.name === node.name);
    return v ? [{ label: 'CREATE Script', action: () => openQueryTool(viewDdl(v)) },
      { label: 'SELECT Script', action: () => openQueryTool(`SELECT * FROM public.${v.name};`) }] : [];
  }
  if (node.kind === 'role') {
    const r = m.roles.find(x => x.name === node.name);
    return r ? [{ label: 'CREATE Script', action: () => openQueryTool(roleDdl(r)) }] : [];
  }
  return [];
}

/** Where a menu opens: at the pointer, kept inside the app (a menu clipped by the frame is a menu with missing items). */
function place(clientX: number, clientY: number, items: MenuItem[], width = 230) {
  const box = root.value?.getBoundingClientRect();
  if (!box) return { x: 0, y: 0 };
  const height = items.reduce((h, item) => h + (item.sep ? 9 : 30), 10);
  const x = Math.max(4, Math.min(clientX - box.left, box.width - width - 4));
  const y = Math.max(4, Math.min(clientY - box.top, box.height - height - 4));
  return { x, y };
}

function onTreeMenu(node: TreeNode, event: MouseEvent | KeyboardEvent) {
  selectedId.value = node.id;
  let cx = 0;
  let cy = 0;
  if (event instanceof MouseEvent && event.clientX) {
    cx = event.clientX;
    cy = event.clientY;
  } else {
    const el = root.value?.querySelector(`[data-node="${CSS.escape(node.id)}"]`) as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    cx = (r?.left || 0) + 40;
    cy = (r?.bottom || 0);
  }
  const items = itemsFor(node);
  menu.value = { items, ...place(cx, cy, items) };
  topMenu.value = '';
}

function openTopMenu(name: string, event: MouseEvent) {
  if (topMenu.value === name && menu.value) {
    menu.value = null;
    topMenu.value = '';
    return;
  }
  const el = event.currentTarget as HTMLElement;
  const r = el.getBoundingClientRect();
  let items: MenuItem[] = [];
  if (name === 'File') {
    items = [
      { label: 'Preferences', action: () => notify('info', 'Preferences', 'Preferences are fixed in this lab: the Standard theme, auto-commit on, and the default Query Tool layout.') },
      { label: 'Reset Layout', action: () => { navWidth.value = 290; queryTabs.value = []; activeTab.value = 'dashboard'; } },
      { sep: true },
      { label: 'Refresh', icon: 'refresh', action: refresh },
    ];
  } else if (name === 'Object') {
    items = itemsFor(selected.value);
  } else if (name === 'Tools') {
    items = [
      { label: 'Query Tool', icon: 'query-tool', shortcut: 'Alt+Shift+Q', action: () => openQueryTool() },
      { label: 'PSQL Tool', icon: 'terminal', action: psqlTool },
      { label: 'Search Objects...', icon: 'search', action: () => { if (!searchOpen.value) toggleSearch(); } },
      { sep: true },
      { label: 'Maintenance...', icon: 'refresh', action: () => {
        const n = selected.value;
        if (n?.kind === 'table') openDialog({ kind: 'maintenance', target: 'table', name: n.table || '' });
        else openDialog({ kind: 'maintenance', target: 'database', name: model.value.database });
      } },
    ];
  } else {
    items = [
      { label: 'Quick Search', icon: 'search', action: () => { if (!searchOpen.value) toggleSearch(); } },
      { label: 'Online Help', icon: 'help', action: () => notify('info', 'pgAdmin 4 documentation', 'https://www.pgadmin.org/docs/pgadmin4/8.12/ - this lab is offline.') },
      { label: 'PostgreSQL Website', action: () => notify('info', 'PostgreSQL', 'https://www.postgresql.org/docs/16/ - this lab is offline.') },
      { sep: true },
      { label: 'About pgAdmin 4', icon: 'info', action: () => notify('info', 'pgAdmin 4 - Version 8.12', `Application mode: Server. Connected to ${model.value.version} (${model.value.server}).`) },
    ];
  }
  menu.value = { items, ...place(r.left, r.bottom + 2, items) };
  topMenu.value = name;
}

function closeMenus() {
  menu.value = null;
  topMenu.value = '';
}
watch(menu, value => { if (!value) topMenu.value = ''; });

/* ---------- splitter ---------- */

function startResize(event: PointerEvent) {
  const startX = event.clientX;
  const start = navWidth.value;
  const move = (e: PointerEvent) => { navWidth.value = Math.max(200, Math.min(520, start + e.clientX - startX)); };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/* ---------- location ---------- */

watch(activeTab, tab => {
  if (!tab.startsWith('qt:')) emit('location', browserUrl());
  // On a narrow frame the tab strip scrolls; keep the open tab in sight.
  nextTick(() => root.value?.querySelector('.pg-tab.is-active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
}, { immediate: true });

onMounted(() => {
  window.addEventListener('mousedown', closeMenus);
  // Connecting: pgAdmin runs its own queries the moment it connects, and the
  // lab's world is built on the first statement - so an untouched lab gets
  // the same `SELECT version()` pgAdmin sends, unlogged.
  if (props.view && props.view.installed === false) {
    props.api.exec('SELECT version();', { surface: 'pg_sql', quiet: true, unlogged: true });
  }
});
onBeforeUnmount(() => window.removeEventListener('mousedown', closeMenus));

const ctx: PgContext = {
  model,
  busy: computed(() => Boolean(props.busy)),
  selected,
  processes,
  runSql,
  openQueryTool,
  openData,
  openDialog,
  table,
  notify,
  refresh,
  location: url => emit('location', url),
};
provide(PG, ctx);
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-app {
  /* pgAdmin 4 "Standard" theme tokens */
  --pg-primary: #326690;
  --pg-primary-hover: #1e3f5e;
  --pg-primary-light: #d6effc;
  --pg-primary-light-2: #9cc3e2;
  --pg-text: #222222;
  --pg-muted: #646b82;
  --pg-bg: #ffffff;
  --pg-hover: #ebeef3;
  --pg-border: #dde0e6;
  --pg-btn-border: #bac1cd;
  --pg-input-border: #dde0e6;
  --pg-grey-200: #f3f5f9;
  --pg-grey-400: #ebeef3;
  --pg-grey-600: #bac1cd;
  --pg-grey-800: #848ea0;
  --pg-tree-selected: #d6effc;
  --pg-error: #cc0000;
  --pg-error-light: #faecec;
  --pg-editor-bg: #ffffff;
  --pg-gutter: #f3f5f9;
  --pg-radius: 4px;
  --pg-mono: 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace;

  color-scheme: light;
  position: relative; display: flex; flex-direction: column; height: 100%; min-height: 560px; overflow: hidden;
  background: var(--pg-bg); color: var(--pg-text); font-family: Roboto, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif; font-size: 13px;
}
.pg-top { flex: none; display: flex; align-items: center; gap: 4px; height: 38px; padding: 0 10px; background: var(--pg-primary); color: #fff; }
.pg-top__burger { display: none; border: 0; background: none; color: #fff; width: 32px; height: 32px; border-radius: 4px; cursor: pointer; }
.pg-top__burger:hover { background: rgba(255, 255, 255, .14); }
.pg-top__brand { display: inline-flex; align-items: center; gap: 6px; margin-right: 12px; }
.pg-top__name { font-size: 18px; letter-spacing: .2px; font-weight: 300; }
.pg-top__name b { font-weight: 700; }
.pg-top__menus { display: flex; }
.pg-top__menu { border: 0; background: none; color: #fff; font: inherit; font-size: 13.5px; padding: 0 10px; height: 38px; cursor: pointer; }
.pg-top__menu:hover, .pg-top__menu.is-open { background: rgba(255, 255, 255, .16); }
.pg-top__grow { flex: 1; }
.pg-top__user { font-size: 12.5px; opacity: .92; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }

.pg-body { flex: 1; min-height: 0; display: grid; grid-template-columns: var(--pg-nav-w) 5px minmax(0, 1fr); }
.pg-nav { min-width: 0; min-height: 0; display: flex; flex-direction: column; border-right: 1px solid var(--pg-border); background: #fff; }
.pg-panel-head { flex: none; height: 32px; display: flex; align-items: center; padding: 0 10px; font-weight: 600; font-size: 13px; background: var(--pg-grey-400); border-bottom: 1px solid var(--pg-border); }
.pg-nav__tools { flex: none; display: flex; gap: 2px; padding: 3px 6px; border-bottom: 1px solid var(--pg-border); background: var(--pg-grey-200); }
.pg-nav__tool { width: 28px; height: 26px; border: 1px solid transparent; border-radius: var(--pg-radius); background: none; color: var(--pg-text); display: grid; place-items: center; cursor: pointer; }
.pg-nav__tool:hover:not(:disabled) { background: #fff; border-color: var(--pg-btn-border); }
.pg-nav__tool:disabled { color: var(--pg-grey-600); cursor: not-allowed; }
.pg-nav__tool.is-on { background: var(--pg-primary-light); border-color: var(--pg-primary-light-2); }
.pg-nav__search { flex: none; padding: 6px; border-bottom: 1px solid var(--pg-border); }
.pg-nav__search .pg-input { width: 100%; }
.pg-split { cursor: col-resize; background: var(--pg-grey-200); border-right: 1px solid var(--pg-border); }
.pg-split:hover, .pg-split:focus-visible { background: var(--pg-primary-light-2); outline: none; }

.pg-main { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.pg-tabs { flex: none; display: flex; align-items: stretch; background: var(--pg-grey-400); border-bottom: 1px solid var(--pg-border); overflow-x: auto; scrollbar-width: thin; }
.pg-tab {
  flex: none; border: 0; border-right: 1px solid var(--pg-border); background: transparent; padding: 0 14px; height: 32px; font: inherit; font-size: 13px;
  color: var(--pg-text); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-top: 2px solid transparent;
}
.pg-tab:hover:not(.is-active) { background: var(--pg-grey-200); }
.pg-tab.is-active { background: #fff; border-top-color: var(--pg-primary); font-weight: 500; }
.pg-tab--qt { padding: 0 2px 0 0; cursor: default; }
.pg-tab__btn { border: 0; background: none; font: inherit; color: inherit; height: 100%; padding: 0 6px 0 12px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; max-width: 260px; }
.pg-tab__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pg-tab__x { border: 0; background: none; width: 20px; height: 20px; border-radius: 3px; display: grid; place-items: center; cursor: pointer; color: var(--pg-muted); }
.pg-tab__x:hover { background: var(--pg-grey-600); color: #fff; }
.pg-crumbs { flex: none; display: flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 12px; color: var(--pg-muted); border-bottom: 1px solid var(--pg-border); overflow: hidden; white-space: nowrap; }
.pg-crumbs__item { border: 0; background: none; padding: 0; font: inherit; color: var(--pg-primary); cursor: pointer; }
.pg-crumbs__item:hover { text-decoration: underline; }
.pg-crumbs__sep { color: var(--pg-grey-800); }
.pg-panes { flex: 1; min-height: 0; display: flex; flex-direction: column; position: relative; }

.pg-procs { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
.pg-proc { padding: 1px 8px; border-radius: 8px; font-size: 12px; }
.pg-proc.is-ok { background: #d9ecda; color: #1b5e20; }
.pg-proc.is-bad { background: var(--pg-error-light); color: var(--pg-error); }
.pg-procs__detail { margin: 10px; border: 1px solid var(--pg-border); border-radius: var(--pg-radius); display: flex; flex-direction: column; gap: 6px; padding-bottom: 6px; }
.pg-procs__detail header { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--pg-grey-200); border-bottom: 1px solid var(--pg-border); }
.pg-procs__detail :deep(.pg-code) { margin: 0 8px; }
.pg-procs__log { margin: 0 8px; padding: 8px; background: #1e1e1e; color: #d4d4d4; font-family: var(--pg-mono); font-size: 12px; white-space: pre-wrap; border-radius: var(--pg-radius); max-height: 200px; overflow: auto; }

.pg-snacks { position: absolute; right: 14px; bottom: 14px; z-index: 90; display: flex; flex-direction: column-reverse; gap: 8px; width: min(380px, calc(100% - 28px)); pointer-events: none; }
.pg-snack {
  pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 4px;
  background: #fff; border: 1px solid var(--pg-border); border-left-width: 4px; box-shadow: 0 4px 14px rgba(0, 0, 0, .18); font-size: 13px;
}
.pg-snack.is-success { background: #e8f4e9; border-color: #b6d8b8; border-left-color: #26852b; }
.pg-snack.is-success .pg-snack__icon { color: #26852b; }
.pg-snack.is-error { background: var(--pg-error-light); border-color: #f0b5b5; border-left-color: var(--pg-error); }
.pg-snack.is-error .pg-snack__icon { color: var(--pg-error); }
.pg-snack.is-warning { background: #fdf0dc; border-color: #f2cf9b; border-left-color: #ea7b00; }
.pg-snack.is-warning .pg-snack__icon { color: #ea7b00; }
.pg-snack.is-info, .pg-snack.is-progress { background: #eaf3fb; border-color: #b9d4ea; border-left-color: var(--pg-primary); }
.pg-snack.is-info .pg-snack__icon, .pg-snack.is-progress .pg-snack__icon { color: var(--pg-primary); }
.pg-snack__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; overflow-wrap: anywhere; color: var(--pg-text); }
.pg-snack__body span { color: #44506a; font-size: 12.5px; }
.pg-snack__x { border: 0; background: none; color: var(--pg-muted); cursor: pointer; padding: 2px; border-radius: 3px; }
.pg-snack__x:hover { background: rgba(0, 0, 0, .06); }

@container sl-portal (max-width: 820px) {
  .pg-top__burger { display: inline-grid; place-items: center; }
  .pg-top__user { display: none; }
  .pg-top__brand { margin-right: 4px; }
  .pg-top__menu { padding: 0 7px; }
  .pg-body { grid-template-columns: minmax(0, 1fr); }
  .pg-split { display: none; }
  .pg-nav { position: absolute; z-index: 60; top: 38px; bottom: 0; left: 0; width: min(320px, 86%); box-shadow: 4px 0 16px rgba(0, 0, 0, .2); transform: translateX(-105%); transition: transform .18s; }
  .pg-app.is-nav-open .pg-nav { transform: none; }
}
@container sl-portal (max-width: 520px) {
  .pg-top__name { display: none; }
}
</style>
