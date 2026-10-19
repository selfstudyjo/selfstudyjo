<template>
  <div class="sf-app" :class="{ 'is-collapsed': collapsed }" dir="ltr">
    <!-- ===== Left navigation (Snowsight 2024+) ===== -->
    <aside class="sf-nav" :class="{ 'is-open': navOpen }" aria-label="Snowsight">
      <div class="sf-nav__top">
        <button type="button" class="sf-nav__logo" title="Snowflake" @click="go({ page: 'home' })">
          <span class="sf-logo"><SfIcon name="snowflake" /></span>
          <span class="sf-nav__brand">snowflake</span>
        </button>
        <button type="button" class="sf-nav__collapse" :title="collapsed ? 'Expand' : 'Collapse'"
                :aria-label="collapsed ? 'Expand navigation' : 'Collapse navigation'" @click="collapsed = !collapsed">
          <SfIcon name="panel-left" />
        </button>
      </div>

      <!-- The session context: who, as which role, on which warehouse. -->
      <div class="sf-ctx sf-rel">
        <button type="button" class="sf-ctx__btn" :aria-expanded="ctxOpen" @click="ctxOpen = !ctxOpen">
          <span class="sf-ctx__avatar">{{ userInitials }}</span>
          <span class="sf-ctx__text">
            <span class="sf-ctx__account">{{ accountLabel }}</span>
            <span class="sf-ctx__role"><SfIcon name="role" /> {{ cur.role || 'No role' }}</span>
            <span class="sf-ctx__role"><SfIcon name="warehouse" /> {{ cur.warehouse || 'No warehouse' }}</span>
          </span>
          <SfIcon name="chevron-down" class="sf-ctx__chev" />
        </button>
        <div v-if="ctxOpen" class="sf-menu sf-ctx__menu" @mouseleave="ctxOpen = false">
          <div class="sf-menu__label">Switch role</div>
          <button v-for="role in myRoles" :key="role" type="button" @click="pickRole(role)">
            <SfIcon :name="role === cur.role ? 'check' : 'dot'" :class="role === cur.role ? '' : 'sf-invisible'" /> {{ role }}
          </button>
          <hr />
          <div class="sf-menu__label">Warehouse</div>
          <button v-for="wh in warehouses" :key="wh.name" type="button" @click="pickWarehouse(wh.name)">
            <SfIcon :name="wh.name === cur.warehouse ? 'check' : 'dot'" :class="wh.name === cur.warehouse ? '' : 'sf-invisible'" />
            {{ wh.name }} <span class="sf-muted sf-small">({{ sizeLabel(wh.size) }})</span>
          </button>
          <hr />
          <button type="button" @click="ctxOpen = false; go({ page: 'users-roles', tab: 'users', name: userName })">
            <SfIcon name="user" /> My profile
          </button>
        </div>
      </div>

      <div class="sf-rel sf-nav__create">
        <button type="button" class="sf-btn sf-btn--primary sf-nav__createbtn" :aria-expanded="createOpen" @click="createOpen = !createOpen">
          <SfIcon name="plus" /> <span class="sf-nav__label">Create</span>
        </button>
        <div v-if="createOpen" class="sf-menu sf-nav__createmenu" @mouseleave="createOpen = false">
          <button type="button" @click="newWorksheet()"><SfIcon name="worksheet" /> SQL Worksheet</button>
          <hr />
          <button type="button" @click="startCreate('database')"><SfIcon name="database" /> Database</button>
          <button type="button" @click="startCreate('schema')"><SfIcon name="schema" /> Schema</button>
          <button type="button" @click="startCreate('table')"><SfIcon name="table" /> Table</button>
          <button type="button" @click="startCreate('view')"><SfIcon name="view" /> View</button>
          <button type="button" @click="startCreate('stage')"><SfIcon name="stage" /> Stage</button>
          <button type="button" @click="startCreate('file-format')"><SfIcon name="format" /> File format</button>
          <hr />
          <button type="button" @click="startCreate('warehouse')"><SfIcon name="warehouse" /> Warehouse</button>
          <button type="button" @click="startCreate('role')"><SfIcon name="role" /> Role</button>
        </div>
      </div>

      <nav class="sf-nav__items">
        <button type="button" class="sf-nav__item" :class="{ 'is-active': route.page === 'home' }" @click="go({ page: 'home' })">
          <SfIcon name="home" /><span class="sf-nav__label">Home</span>
        </button>
        <template v-for="group in NAV" :key="group.label">
          <button type="button" class="sf-nav__item sf-nav__group" :class="{ 'is-section': groupActive(group) }"
                  :aria-expanded="openGroups[group.label]" @click="toggleGroup(group.label)">
            <SfIcon :name="group.icon" /><span class="sf-nav__label">{{ group.label }}</span>
            <SfIcon :name="openGroups[group.label] ? 'chevron-down' : 'chevron-right'" class="sf-nav__chev" />
          </button>
          <template v-if="openGroups[group.label] && !collapsed">
            <button v-for="item in group.items" :key="item.label" type="button" class="sf-nav__item sf-nav__sub"
                    :class="{ 'is-active': item.pages.includes(route.page) }" @click="go(item.route)">
              <span class="sf-nav__label">{{ item.label }}</span>
            </button>
          </template>
        </template>
      </nav>

      <div class="sf-nav__foot">
        <button type="button" class="sf-nav__item" @click="notify('info', 'Snowflake documentation', 'docs.snowflake.com - this lab is offline, so the documentation opens outside it.')">
          <SfIcon name="help" /><span class="sf-nav__label">Help &amp; Support</span>
        </button>
      </div>
    </aside>

    <div class="sf-body">
      <header class="sf-mobilebar">
        <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon" aria-label="Menu" @click="navOpen = !navOpen"><SfIcon name="menu" /></button>
        <span class="sf-logo"><SfIcon name="snowflake" /></span>
        <span class="sf-mobilebar__ctx">{{ cur.role }} · {{ cur.warehouse }}</span>
      </header>
      <main class="sf-main" @click="navOpen = false">
        <div v-if="viewRef.installed && unavailable" class="sf-unavail" role="status">
          <SfIcon name="info" /><span>This lab's platform does not include the Snowflake account yet. It arrives at the "warehouse" stage of the ShopFlow platform.</span>
        </div>
        <HomePage v-if="route.page === 'home'" />
        <WorksheetsPage v-else-if="route.page === 'worksheets'" />
        <WorksheetPage v-else-if="route.page === 'worksheet'" :key="'ws-' + route.id" />
        <DatabasesPage v-else-if="route.page === 'databases'" />
        <QueryHistoryPage v-else-if="route.page === 'query-history'" />
        <CopyHistoryPage v-else-if="route.page === 'copy-history'" />
        <TaskHistoryPage v-else-if="route.page === 'task-history'" />
        <GovernancePage v-else-if="route.page === 'governance'" />
        <WarehousesPage v-else-if="route.page === 'warehouses'" />
        <CostPage v-else-if="route.page === 'cost'" />
        <UsersRolesPage v-else-if="route.page === 'users-roles'" />
      </main>
    </div>

    <!-- ===== Toasts: Snowsight's dark notification, bottom left ===== -->
    <div class="sf-toasts" aria-live="polite">
      <div v-for="flash in shownFlashes" :key="flash.id" class="sf-toast" :class="'sf-toast--' + flash.type" role="status">
        <SfIcon :name="flash.type === 'success' ? 'check-circle' : flash.type === 'error' ? 'x-circle' : flash.type === 'warning' ? 'warning' : 'info'" class="sf-toast__icon" />
        <div class="sf-toast__body">
          <strong>{{ flash.title }}</strong>
          <span v-if="flash.detail">{{ flash.detail }}</span>
        </div>
        <button type="button" class="sf-toast__x" aria-label="Dismiss" @click="api.dismiss(flash.id)"><SfIcon name="close" /></button>
      </div>
    </div>

    <SfCreate v-if="creating" :kind="creating.kind" :defaults="creating.defaults" @close="creating = null" />

    <SfModal v-if="pending" :title="pending.title" :ok-text="pending.yes || 'OK'" :danger="pending.danger"
             :ok-disabled="Boolean(pending.typeToConfirm) && confirmText.trim().toUpperCase() !== String(pending.typeToConfirm).toUpperCase()"
             :width="480" @close="answer(false)" @ok="answer(true)">
      <p class="sf-confirm-text">{{ pending.message }}</p>
      <label v-if="pending.typeToConfirm" class="sf-field">
        <span class="sf-label">Type <b class="sf-mono">{{ pending.typeToConfirm }}</b> to confirm</span>
        <input v-model="confirmText" class="sf-input" autocomplete="off" />
      </label>
    </SfModal>
  </div>
</template>

<script setup lang="ts">
/**
 * Snowflake Snowsight (the 2024+ UI) over the lab's data platform engine.
 *
 * The warehouse half of `sim:dataplat` (`utils/sims/dataplat/warehouse.py` on
 * app 11) is one Snowflake account; this portal is Snowsight's view of it.
 * Every action - a worksheet run, a create dialog, Suspend on a warehouse,
 * Undrop, a grant - runs the Snowflake SQL it stands for on the Worksheet
 * surface (`sf_sql`), so the SnowSQL console beside it, the lab's checks and
 * this portal can never disagree.
 */
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { errorText, pick, type PortalResult } from '@/utils/portalKit';
import SfIcon from './SfIcon.vue';
import SfModal from './SfModal.vue';
import SfCreate from './SfCreate.vue';
import HomePage from './HomePage.vue';
import WorksheetsPage from './WorksheetsPage.vue';
import WorksheetPage from './WorksheetPage.vue';
import DatabasesPage from './DatabasesPage.vue';
import QueryHistoryPage from './QueryHistoryPage.vue';
import CopyHistoryPage from './CopyHistoryPage.vue';
import TaskHistoryPage from './TaskHistoryPage.vue';
import GovernancePage from './GovernancePage.vue';
import WarehousesPage from './WarehousesPage.vue';
import CostPage from './CostPage.vue';
import UsersRolesPage from './UsersRolesPage.vue';
import { SF, type ConfirmRequest, type CreateKind, type QueryResult, type RunOptions, type SfContext, type Worksheet } from './sfContext';
import { current, gridsOf, ident, initials, list, readProfile, routeUrl, sizeLabel, SURFACE, type Profile, type SfRoute } from './snowflake';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const viewRef = computed(() => props.view || {});
const cur = computed(() => current(viewRef.value));
const busyRef = computed(() => Boolean(props.busy));
const warehouses = computed(() => list.warehouses(viewRef.value));
const unavailable = computed(() => pick(viewRef.value, 'warehouse.available', true) === false);
const userName = computed(() => {
  const users = list.users(viewRef.value);
  return String(pick(viewRef.value, 'warehouse.user', '') || users[0]?.name || 'DATA_ENGINEER');
});
const userInitials = computed(() => initials(userName.value));
const accountLabel = computed(() => String(pick(viewRef.value, 'warehouse.account', 'SHOPFLOW')).toUpperCase());

/** The roles the current user can switch to (the engine's `available_roles`). */
const myRoles = computed(() => {
  const available = pick<string[]>(viewRef.value, 'warehouse.available_roles', []);
  const names = available.length ? available.map(String) : list.roles(viewRef.value).map(r => r.name);
  const all = new Set<string>(names);
  if (cur.value.role) all.add(cur.value.role);
  return [...all];
});

interface NavItem { label: string; route: SfRoute; pages: string[] }
interface NavGroup { label: string; icon: string; items: NavItem[] }
const NAV: NavGroup[] = [
  { label: 'Projects', icon: 'projects', items: [
    { label: 'Worksheets', route: { page: 'worksheets' }, pages: ['worksheets', 'worksheet'] },
  ] },
  { label: 'Data', icon: 'data', items: [
    { label: 'Databases', route: { page: 'databases' }, pages: ['databases'] },
  ] },
  { label: 'Monitoring', icon: 'monitoring', items: [
    { label: 'Query History', route: { page: 'query-history' }, pages: ['query-history'] },
    { label: 'Copy History', route: { page: 'copy-history' }, pages: ['copy-history'] },
    { label: 'Task History', route: { page: 'task-history' }, pages: ['task-history'] },
    { label: 'Governance', route: { page: 'governance' }, pages: ['governance'] },
  ] },
  { label: 'Admin', icon: 'admin', items: [
    { label: 'Cost Management', route: { page: 'cost' }, pages: ['cost'] },
    { label: 'Warehouses', route: { page: 'warehouses' }, pages: ['warehouses'] },
    { label: 'Users & Roles', route: { page: 'users-roles' }, pages: ['users-roles'] },
  ] },
];
const openGroups = reactive<Record<string, boolean>>({ Projects: true, Data: true, Monitoring: true, Admin: true });
function toggleGroup(label: string) {
  if (collapsed.value) { collapsed.value = false; openGroups[label] = true; return; }
  openGroups[label] = !openGroups[label];
}
function groupActive(group: NavGroup) {
  return group.items.some(item => item.pages.includes(route.value.page));
}

const route = ref<SfRoute>({ page: 'home' });
const collapsed = ref(false);
const navOpen = ref(false);
const ctxOpen = ref(false);
const createOpen = ref(false);

function go(next: SfRoute) {
  route.value = next;
  navOpen.value = false;
  ctxOpen.value = false;
  createOpen.value = false;
}
watch(route, value => emit('location', routeUrl(value)), { immediate: true, deep: true });

/* ------------------------------------------------------------ running SQL */

async function sql(statement: string, options: RunOptions = {}): Promise<PortalResult> {
  return props.api.exec(statement, {
    surface: SURFACE, success: options.success, failure: options.failure, quiet: options.quiet, unlogged: options.unlogged,
  });
}

let resultSeq = 0;
const profiles = ref<Record<string, Profile>>({});

function queryIdOf(result: PortalResult): string {
  const data = (result.data || {}) as Record<string, any>;
  const direct = data.query_id || data.queryId || pick(data, 'profile.query_id', '');
  if (direct) return String(direct);
  const ids = Array.isArray(data.query_ids) ? data.query_ids : [];
  if (ids.length) return String(ids[ids.length - 1]);
  const match = String(result.output || result.error || '').match(/\b(01[0-9a-f]{6,}-[0-9a-f-]{8,})\b/i);
  return match ? match[1] : '';
}

async function query(statement: string, options: RunOptions = {}): Promise<QueryResult> {
  const result = await sql(statement, { ...options, quiet: options.quiet ?? true });
  const data = (result.data || {}) as Record<string, any>;
  // The statement's own history row is the newest one: exec resolves after the view refreshed.
  const history = list.queries(viewRef.value);
  const last = history[history.length - 1];
  const queryId = queryIdOf(result) || last?.query_id || '';
  const profile = readProfile(data.profile, { query_id: queryId });
  if (profile) {
    const key = profile.queryId || queryId;
    if (key) profiles.value = { ...profiles.value, [key]: profile };
  }
  const row = history.find(h => h.query_id === queryId);
  const elapsed = profile?.totalMs ?? (row && Number.isFinite(Number(row.elapsed_ms)) ? Number(row.elapsed_ms) : null);
  return {
    id: ++resultSeq, sql: statement, ok: Boolean(result.ok), error: result.ok ? '' : errorText(result),
    grids: gridsOf(data), output: String(result.output || ''), queryId: profile?.queryId || queryId,
    profile, elapsedMs: elapsed, at: Date.now(),
  };
}

async function useRole(role: string) {
  const result = await sql(`USE ROLE ${ident(role)}`, { success: `Role switched to ${role}` });
  return result.ok;
}
async function useWarehouse(warehouse: string) {
  const result = await sql(`USE WAREHOUSE ${ident(warehouse)}`, { success: `Using warehouse ${warehouse}` });
  return result.ok;
}
function pickRole(role: string) { ctxOpen.value = false; if (role !== cur.value.role) void useRole(role); }
function pickWarehouse(name: string) { ctxOpen.value = false; if (name !== cur.value.warehouse) void useWarehouse(name); }

/* ------------------------------------------------------------- worksheets */

let worksheetSeq = 0;
const worksheets = ref<Worksheet[]>([]);
function stamp() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) + ' '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
}
function openWorksheet(text = '', name = ''): Worksheet {
  const sheet: Worksheet = {
    id: ++worksheetSeq, name: name || stamp(), sql: text, created: Date.now(), modified: Date.now(), lastResult: null,
  };
  worksheets.value = [sheet, ...worksheets.value];
  go({ page: 'worksheet', id: sheet.id });
  return sheet;
}
function newWorksheet() {
  createOpen.value = false;
  const c = cur.value;
  const ctxLine = c.database ? `-- ${c.database}${c.schema ? '.' + c.schema : ''}\n` : '';
  openWorksheet(ctxLine);
}
// A first worksheet, as a new Snowsight account shows one.
worksheets.value = [{
  id: ++worksheetSeq, name: 'ShopFlow - getting started', created: Date.now(), modified: Date.now(), lastResult: null,
  sql: '-- Welcome to Snowsight. Ctrl+Enter runs the statement under the cursor.\nSELECT CURRENT_ROLE(), CURRENT_WAREHOUSE(), CURRENT_DATABASE();\n\nSHOW TABLES IN SCHEMA RAW.SHOP;\n\nSELECT status, COUNT(*) AS orders\nFROM RAW.SHOP.ORDERS\nGROUP BY status\nORDER BY orders DESC;\n',
}];

/* ---------------------------------------------------------- create, confirm */

const creating = ref<{ kind: CreateKind; defaults: Record<string, string> } | null>(null);
function startCreate(kind: CreateKind, defaults: Record<string, string> = {}) {
  createOpen.value = false;
  creating.value = { kind, defaults };
}

const pending = ref<ConfirmRequest | null>(null);
const confirmText = ref('');
let resolver: ((value: boolean) => void) | null = null;
function confirm(request: ConfirmRequest): Promise<boolean> {
  confirmText.value = '';
  pending.value = request;
  return new Promise(resolve => { resolver = resolve; });
}
function answer(value: boolean) {
  pending.value = null;
  resolver?.(value);
  resolver = null;
}

function notify(type: 'success' | 'error' | 'info' | 'warning', title: string, detail = '') {
  props.api.notify(type, title, detail);
}
const shownFlashes = computed(() => props.api.flashes.value.slice(0, 3));

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { ctxOpen.value = false; createOpen.value = false; }
}
onMounted(() => {
  window.addEventListener('keydown', onKey);
  // A lab's platform is built on its first statement. Signing in to Snowsight
  // runs the session's context query, which is what builds it here - so the
  // explorer and the warehouses are populated before the student types.
  if (!viewRef.value.installed) {
    void sql('SELECT CURRENT_ACCOUNT(), CURRENT_ROLE(), CURRENT_WAREHOUSE()', { quiet: true, unlogged: true });
  }
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

const ctx: SfContext = {
  view: viewRef,
  current: cur,
  busy: busyRef,
  route,
  go,
  sql,
  query,
  confirm,
  notify,
  worksheets,
  openWorksheet,
  profiles,
  useRole,
  useWarehouse,
  create: startCreate,
};
provide(SF, ctx);
</script>

<style scoped>
.sf-app {
  /* Snowsight's palette. */
  --sf-primary: #1A6CE7;
  --sf-primary-hover: #1559C4;
  --sf-primary-text: #1556B8;
  --sf-focus: rgba(26, 108, 231, 0.18);
  --sf-brand: #29B5E8;
  --sf-link: #1A6CE7;
  --sf-text: #1E252F;
  --sf-text-2: #5D6A80;
  --sf-text-3: #667085;
  --sf-border: #E3E7EE;
  --sf-border-strong: #C9D0DB;
  --sf-bg: #FFFFFF;
  --sf-bg-2: #F7F8FA;
  --sf-nav: #F4F6F9;
  --sf-hover: #EEF1F5;
  --sf-row-hover: #F6F8FB;
  --sf-selected: #E8F0FD;
  --sf-tag: #EDF0F4;
  --sf-danger: #C62E2E;
  --sf-danger-hover: #A72424;
  --sf-danger-text: #A32121;
  --sf-bad-bg: #FDECEC;
  --sf-ok: #1B7F3A;
  --sf-ok-bg: #E6F4EA;
  --sf-run-bg: #E8F0FD;
  --sf-warning: #9A5B00;
  --sf-warn-bg: #FFF4DE;
  --sf-radius: 6px;
  --sf-radius-lg: 8px;
  --sf-shadow: 0 4px 16px rgba(30, 37, 47, 0.14);
  --sf-shadow-lg: 0 12px 40px rgba(30, 37, 47, 0.22);
  --sf-font: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --sf-mono: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;

  color-scheme: light;
  position: relative; display: flex; height: 100%; min-height: 0; overflow: hidden;
  background: var(--sf-bg); color: var(--sf-text); font-family: var(--sf-font); font-size: 13px; line-height: 20px;
}

.sf-nav {
  flex: none; width: 236px; display: flex; flex-direction: column; gap: 6px; background: var(--sf-nav);
  border-right: 1px solid var(--sf-border); padding: 10px 10px 8px; min-height: 0; overflow-y: auto; z-index: 30;
}
.sf-nav__top { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 2px 2px 4px; }
.sf-nav__logo { display: inline-flex; align-items: center; gap: 8px; background: none; border: 0; padding: 2px; cursor: pointer; color: var(--sf-text); }
.sf-logo { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; background: var(--sf-brand); color: #fff; }
.sf-logo .sf-ico { width: 18px; height: 18px; }
.sf-nav__brand { font-size: 17px; font-weight: 700; letter-spacing: -.01em; color: #1D3E6E; }
.sf-nav__collapse { border: 0; background: none; width: 28px; height: 28px; border-radius: 6px; color: var(--sf-text-2); cursor: pointer; display: grid; place-items: center; }
.sf-nav__collapse:hover { background: var(--sf-hover); color: var(--sf-text); }

.sf-ctx__btn {
  width: 100%; display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--sf-border);
  background: var(--sf-bg); cursor: pointer; text-align: left; font: inherit; color: var(--sf-text);
}
.sf-ctx__btn:hover { border-color: var(--sf-border-strong); }
.sf-ctx__avatar { flex: none; width: 30px; height: 30px; border-radius: 50%; background: #1D3E6E; color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 600; }
.sf-ctx__text { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 16px; }
.sf-ctx__account { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-ctx__role { font-size: 11px; color: var(--sf-text-2); display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-ctx__role .sf-ico { width: 11px; height: 11px; }
.sf-ctx__chev { color: var(--sf-text-3); }
.sf-ctx__menu { top: calc(100% + 4px); left: 0; right: 0; max-height: 380px; overflow-y: auto; }
.sf-invisible { visibility: hidden; }

.sf-nav__create { margin: 2px 0 4px; }
.sf-nav__createbtn { width: 100%; justify-content: flex-start; }
.sf-nav__createmenu { top: calc(100% + 4px); left: 0; right: 0; }

.sf-nav__items { display: flex; flex-direction: column; gap: 1px; flex: 1; }
.sf-nav__item {
  display: flex; align-items: center; gap: 10px; width: 100%; height: 32px; padding: 0 8px; border: 0; border-radius: 6px;
  background: none; color: var(--sf-text); font: inherit; font-size: 13px; cursor: pointer; text-align: left; white-space: nowrap;
}
.sf-nav__item:hover { background: var(--sf-hover); }
.sf-nav__item .sf-ico { color: var(--sf-text-2); width: 17px; height: 17px; }
.sf-nav__item.is-active { background: var(--sf-selected); color: var(--sf-primary-text); font-weight: 600; }
.sf-nav__item.is-active .sf-ico { color: var(--sf-primary-text); }
.sf-nav__group.is-section > .sf-ico:first-child { color: var(--sf-primary-text); }
.sf-nav__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.sf-nav__chev { width: 13px !important; height: 13px !important; }
.sf-nav__sub { padding-left: 35px; height: 30px; }
.sf-nav__foot { border-top: 1px solid var(--sf-border); padding-top: 6px; }

.sf-app.is-collapsed .sf-nav { width: 60px; padding: 10px 8px; }
.sf-app.is-collapsed .sf-nav__brand,
.sf-app.is-collapsed .sf-nav__label,
.sf-app.is-collapsed .sf-nav__chev,
.sf-app.is-collapsed .sf-ctx__text,
.sf-app.is-collapsed .sf-ctx__chev { display: none; }
.sf-app.is-collapsed .sf-nav__top { flex-direction: column; }
.sf-app.is-collapsed .sf-ctx__btn { justify-content: center; padding: 4px; }
.sf-app.is-collapsed .sf-nav__createbtn { justify-content: center; padding: 0; }
.sf-app.is-collapsed .sf-ctx__menu, .sf-app.is-collapsed .sf-nav__createmenu { right: auto; width: 240px; }

.sf-body { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.sf-mobilebar { display: none; align-items: center; gap: 10px; height: 48px; padding: 0 10px; border-bottom: 1px solid var(--sf-border); flex: none; }
.sf-mobilebar__ctx { font-size: 12px; color: var(--sf-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-main { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.sf-unavail { display: flex; gap: 8px; align-items: flex-start; margin: 12px 16px 0; padding: 10px 12px; border-radius: 6px; background: var(--sf-warn-bg); color: var(--sf-warning); font-size: 13px; }
.sf-unavail .sf-ico { margin-top: 2px; }

.sf-toasts { position: absolute; left: 252px; bottom: 16px; z-index: 80; display: flex; flex-direction: column-reverse; gap: 8px; width: min(420px, calc(100% - 32px)); pointer-events: none; }
.sf-app.is-collapsed .sf-toasts { left: 76px; }
.sf-toast { pointer-events: auto; display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; background: #1E252F; color: #fff; border-radius: 8px; box-shadow: var(--sf-shadow-lg); font-size: 13px; }
.sf-toast__icon { width: 18px; height: 18px; margin-top: 1px; }
.sf-toast--success .sf-toast__icon { color: #5CD68A; }
.sf-toast--error { background: #fff; color: var(--sf-text); border-left: 4px solid var(--sf-danger); }
.sf-toast--error .sf-toast__icon { color: var(--sf-danger); }
.sf-toast--error .sf-toast__body span { color: var(--sf-text-2); }
.sf-toast--error .sf-toast__x { color: var(--sf-text-2); }
.sf-toast--info .sf-toast__icon, .sf-toast--progress .sf-toast__icon { color: #8EC5FF; }
.sf-toast--warning .sf-toast__icon { color: #FFC266; }
.sf-toast__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; overflow-wrap: anywhere; }
.sf-toast__body strong { font-weight: 600; }
.sf-toast__body span { color: #C9D0DB; font-size: 12px; }
.sf-toast__x { border: 0; background: none; color: #C9D0DB; cursor: pointer; padding: 2px; border-radius: 4px; display: grid; place-items: center; }
.sf-toast__x:hover { background: rgba(255, 255, 255, 0.12); }
.sf-confirm-text { margin: 0; overflow-wrap: anywhere; }

@container sl-portal (max-width: 820px) {
  .sf-nav { position: absolute; top: 0; bottom: 0; left: 0; transform: translateX(-100%); transition: transform .18s; box-shadow: var(--sf-shadow-lg); width: 236px !important; }
  .sf-nav.is-open { transform: none; }
  .sf-app.is-collapsed .sf-nav__label, .sf-app.is-collapsed .sf-nav__brand, .sf-app.is-collapsed .sf-ctx__text { display: initial; }
  .sf-mobilebar { display: flex; }
  .sf-toasts, .sf-app.is-collapsed .sf-toasts { left: 16px; }
}
</style>
<style scoped src="./sf.css"></style>
