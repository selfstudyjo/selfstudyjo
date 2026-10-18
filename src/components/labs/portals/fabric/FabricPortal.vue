<template>
  <div class="fx" dir="ltr" :class="{ 'is-rail-open': railOpen }" :data-ready="portal.installed ? 'yes' : null">
    <!-- The app bar: waffle, product name, search, the trial chip and the account. -->
    <header class="fx-bar">
      <button type="button" class="fx-bar__btn fx-bar__burger" aria-label="Navigation"
              @click="railOpen = !railOpen">
        <FxIcon name="hamburger" :size="18" />
      </button>
      <button type="button" class="fx-bar__btn fx-bar__waffle" aria-label="App launcher" title="App launcher">
        <FxIcon name="waffle" :size="16" />
      </button>
      <button type="button" class="fx-bar__brand" @click="go({ page: 'home' })">
        <FxIcon name="fabric" :size="20" />
        <span>Microsoft Fabric</span>
      </button>
      <span v-if="crumb" class="fx-bar__crumb">{{ crumb }}</span>
      <div class="fx-bar__search">
        <FxIcon name="search" :size="14" />
        <input v-model="search" type="search" placeholder="Search" aria-label="Search"
               @keydown.enter="doSearch" />
        <ul v-if="searchHits.length" class="fx-bar__hits" role="listbox">
          <li v-for="hit in searchHits" :key="hit.workspace + hit.name + hit.type">
            <button type="button" @mousedown.prevent="openItem(hit)">
              <FxIcon :name="hit.type" :size="16" />
              <span class="fx-bar__hitname">{{ hit.name }}</span>
              <span class="fx-bar__hitmeta">{{ typeLabel(hit.type) }} · {{ hit.workspace }}</span>
            </button>
          </li>
        </ul>
      </div>
      <div class="fx-bar__right">
        <span class="fx-bar__trial" :title="capacityTitle">
          <span class="fx-bar__trial-dot" :class="{ 'is-paused': capacityPaused }" />
          {{ capacityText }}
        </span>
        <button type="button" class="fx-bar__btn" aria-label="Notifications" title="Notifications"
                @click="toggle('bell')">
          <FxIcon name="bell" :size="18" />
          <span v-if="unread" class="fx-bar__badge">{{ unread }}</span>
        </button>
        <button type="button" class="fx-bar__btn" aria-label="Settings" title="Settings"
                @click="toggle('gear')">
          <FxIcon name="settings" :size="18" />
        </button>
        <button type="button" class="fx-bar__btn fx-hide-narrow" aria-label="Download" title="Download">
          <FxIcon name="download" :size="18" />
        </button>
        <button type="button" class="fx-bar__btn fx-hide-narrow" aria-label="Help" title="Help and support">
          <FxIcon name="help" :size="18" />
        </button>
        <button type="button" class="fx-bar__avatar" :title="me" aria-label="Account manager"
                @click="toggle('me')">
          {{ initials(me) }}
        </button>
      </div>

      <!-- Flyout menus from the app bar -->
      <div v-if="menu === 'gear'" class="fx-flyout fx-flyout--gear" @mouseleave="menu = ''">
        <div class="fx-flyout__title">Settings</div>
        <button type="button" @click="openAdmin('capacities')"><FxIcon name="admin" />Admin portal</button>
        <button type="button" @click="openAdmin('connections')"><FxIcon name="share" />Manage connections and gateways</button>
        <button type="button" @click="go({ page: 'deploy' }); menu = ''"><FxIcon name="deploy" />Deployment pipelines</button>
        <button type="button" @click="go({ page: 'monitor' }); menu = ''"><FxIcon name="monitor" />Monitoring hub</button>
        <button type="button" @click="openAdmin('audit')"><FxIcon name="lock" />Audit logs</button>
      </div>
      <div v-if="menu === 'bell'" class="fx-flyout fx-flyout--bell">
        <div class="fx-flyout__title">Notifications
          <button type="button" class="fx-iconbtn" aria-label="Close" @click="menu = ''"><FxIcon name="close" /></button>
        </div>
        <p v-if="!signals.length" class="fx-muted fx-pad">You're all caught up.</p>
        <div v-for="(s, i) in signals" :key="i" class="fx-note">
          <FxIcon :name="s.level === 'error' ? 'error' : s.level === 'warning' ? 'warning' : 'info'" :size="16" />
          <div><div class="fx-note__msg">{{ s.message }}</div><div class="fx-note__at">{{ s.at }} · {{ s.source }}</div></div>
        </div>
      </div>
      <div v-if="menu === 'me'" class="fx-flyout fx-flyout--me" @mouseleave="menu = ''">
        <div class="fx-me">
          <span class="fx-avatar fx-avatar--lg" :style="{ background: avatarColor(me) }">{{ initials(me) }}</span>
          <div><div class="fx-strong">{{ displayName(me, portal.principals || []) }}</div>
            <div class="fx-muted">{{ me }}</div></div>
        </div>
        <div class="fx-me__row"><span class="fx-muted">Licenses</span><span>Fabric capacity ({{ capacitySku }})</span></div>
        <div class="fx-me__row"><span class="fx-muted">Clock</span><span>{{ view.clock?.time }}</span></div>
      </div>
    </header>

    <div class="fx-body">
      <!-- On a narrow frame the rail is a drawer; the scrim behind it closes it. -->
      <div v-if="railOpen" class="fx-scrim" aria-hidden="true" @click="railOpen = false" />
      <!-- The left navigation rail -->
      <nav class="fx-rail" aria-label="Fabric navigation">
        <button v-for="entry in railItems" :key="entry.id" type="button" class="fx-rail__item"
                :class="{ 'is-active': activeRail === entry.id }" :title="entry.label"
                @click="onRail(entry.id)">
          <FxIcon :name="entry.icon" :size="20" />
          <span>{{ entry.label }}</span>
        </button>
        <div class="fx-rail__sep" />
        <button v-if="currentWs" type="button" class="fx-rail__item"
                :class="{ 'is-active': activeRail === 'current' }" :title="currentWs"
                @click="go({ page: 'workspace', ws: currentWs })">
          <FxIcon name="Workspace" :size="20" />
          <span class="fx-rail__ws">{{ currentWs }}</span>
        </button>
        <button v-if="route.page === 'item'" type="button" class="fx-rail__item is-active"
                :title="route.item">
          <FxIcon :name="route.type || ''" :size="20" />
          <span class="fx-rail__ws">{{ route.item }}</span>
        </button>
        <div class="fx-rail__grow" />
        <button type="button" class="fx-rail__item fx-rail__exp" title="Fabric">
          <FxIcon name="fabric" :size="22" />
          <span>Fabric</span>
        </button>
      </nav>

      <!-- Workspaces flyout -->
      <div v-if="flyout" class="fx-wsfly" @mouseleave="flyout = false">
        <div class="fx-wsfly__head">
          <h2>Workspaces</h2>
          <button type="button" class="fx-iconbtn" aria-label="Close" @click="flyout = false"><FxIcon name="close" /></button>
        </div>
        <div class="fx-input fx-input--search">
          <FxIcon name="search" :size="14" />
          <input v-model="wsFilter" placeholder="Search" aria-label="Search workspaces" />
        </div>
        <ul class="fx-wsfly__list">
          <li v-for="w in flyoutWorkspaces" :key="w.name">
            <button type="button" :class="{ 'is-current': w.name === currentWs }"
                    @click="go({ page: 'workspace', ws: w.name }); flyout = false">
              <FxIcon name="Workspace" :size="20" />
              <span class="fx-wsfly__name">{{ w.name }}</span>
              <span v-if="w.capacity" class="fx-diamond" title="Fabric capacity">◆</span>
            </button>
          </li>
          <li v-if="!flyoutWorkspaces.length" class="fx-muted fx-pad">No workspaces found</li>
        </ul>
        <div class="fx-wsfly__foot">
          <button type="button" class="fx-btn fx-btn--primary" @click="openNewWorkspace">
            <FxIcon name="plus" />New workspace
          </button>
          <button type="button" class="fx-btn" @click="go({ page: 'deploy' }); flyout = false">
            Deployment pipelines
          </button>
        </div>
      </div>

      <main class="fx-main">
        <div v-if="portal.installed === false || busy" class="fx-loading" role="progressbar" aria-label="Loading"><span /></div>
        <HomePage v-if="route.page === 'home'" @new-workspace="openNewWorkspace" />
        <WorkspacesPage v-else-if="route.page === 'workspaces'" @new-workspace="openNewWorkspace" />
        <WorkspacePage v-else-if="route.page === 'workspace'" :key="'ws:' + route.ws" />
        <template v-else-if="route.page === 'item'">
          <LakehousePage v-if="route.type === 'Lakehouse'" :key="itemKey" />
          <WarehousePage v-else-if="route.type === 'Warehouse' || route.type === 'SQLEndpoint'"
                         :key="itemKey" />
          <NotebookPage v-else-if="route.type === 'Notebook'" :key="itemKey" />
          <PipelinePage v-else-if="route.type === 'DataPipeline'" :key="itemKey" />
          <ModelPage v-else-if="route.type === 'SemanticModel'" :key="itemKey" />
          <GenericItemPage v-else :key="itemKey" />
        </template>
        <MonitorPage v-else-if="route.page === 'monitor'" @refresh="emit('refresh')" />
        <OneLakePage v-else-if="route.page === 'onelake'" />
        <DeployPage v-else-if="route.page === 'deploy'" />
        <AdminPage v-else-if="route.page === 'admin'" />
        <CreatePage v-else-if="route.page === 'create' || route.page === 'workloads'"
                    @new-workspace="openNewWorkspace" />
        <RealTimePage v-else-if="route.page === 'realtime'" />
      </main>
    </div>

    <!-- Toasts: Fluent notifications, top-right under the header -->
    <div class="fx-toasts" aria-live="polite">
      <div v-for="flash in api.flashes.value" :key="flash.id" class="fx-toast"
           :class="'fx-toast--' + flash.type">
        <FxIcon :name="flash.type === 'success' ? 'success' : flash.type === 'error' ? 'error'
          : flash.type === 'warning' ? 'warning' : 'info'" :size="16" />
        <div class="fx-toast__text">
          <div class="fx-toast__title">{{ flash.title }}</div>
          <div v-if="flash.detail" class="fx-toast__detail">{{ flash.detail }}</div>
        </div>
        <button type="button" class="fx-iconbtn" aria-label="Dismiss" @click="api.dismiss(flash.id)">
          <FxIcon name="close" :size="12" />
        </button>
      </div>
    </div>

    <NewWorkspacePanel v-if="newWs" @close="newWs = false" />
  </div>
</template>

<script setup lang="ts">
/**
 * Microsoft Fabric (app.fabric.microsoft.com), simulated - the shell.
 *
 * Fluent 2 chrome: the app bar, the navigation rail (Home, Workspaces, OneLake
 * catalog, Monitor, Real-Time, Workloads, Create, then the open workspace), the
 * workspaces flyout and the toast notifications. Every page lives in its own
 * component and reads the view through the injected context (`fabric.ts`); every
 * write is a `fab` command line (or T-SQL / a notebook cell / DAX on its sibling
 * surface) sent through `api.exec`.
 */
import { computed, onMounted, provide, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import FxIcon from './FxIcon.vue';
import HomePage from './HomePage.vue';
import WorkspacesPage from './WorkspacesPage.vue';
import WorkspacePage from './WorkspacePage.vue';
import LakehousePage from './LakehousePage.vue';
import WarehousePage from './WarehousePage.vue';
import NotebookPage from './NotebookPage.vue';
import PipelinePage from './PipelinePage.vue';
import ModelPage from './ModelPage.vue';
import GenericItemPage from './GenericItemPage.vue';
import MonitorPage from './MonitorPage.vue';
import OneLakePage from './OneLakePage.vue';
import DeployPage from './DeployPage.vue';
import AdminPage from './AdminPage.vue';
import CreatePage from './CreatePage.vue';
import RealTimePage from './RealTimePage.vue';
import NewWorkspacePanel from './NewWorkspacePanel.vue';
import {
  FABRIC, avatarColor, displayName, initials, locationFor, rows, typeLabel, type Route,
} from './fabric';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool;
  busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const route = ref<Route>({ page: 'home' });
const lastWs = ref('');
const railOpen = ref(false);
const flyout = ref(false);
const menu = ref('');
const search = ref('');
const wsFilter = ref('');
const newWs = ref(false);
const seenSignals = ref(0);

const view = computed(() => props.view || {});
const portal = computed<Record<string, any>>(() => (view.value.portal as any) || {});
const me = computed(() => String(portal.value.me || 'data.engineer@acmepay.com'));

function go(next: Route) {
  route.value = { ...next };
  if (next.ws) lastWs.value = next.ws;
  railOpen.value = false;
  flyout.value = false;
}

async function run(command: string, success?: string,
                   options: { surface?: string; quiet?: boolean } = {}) {
  return props.api.exec(command, { success, surface: options.surface, quiet: options.quiet });
}

provide(FABRIC, {
  view, portal, api: props.api, route, go, run,
  busy: computed(() => Boolean(props.busy)),
});

watch([route, portal], () => emit('location', locationFor(route.value, portal.value)),
      { immediate: true, deep: true });

// A workspace that was renamed or deleted under the open page: go back home.
watch(portal, value => {
  const names = rows(value, 'workspaces').map(w => w.name);
  if (route.value.ws && names.length && !names.includes(route.value.ws)
      && route.value.page !== 'deploy') {
    route.value = { page: 'workspaces' };
  }
  if (lastWs.value && !names.includes(lastWs.value)) lastWs.value = '';
});

const currentWs = computed(() => route.value.ws || lastWs.value);
const itemKey = computed(() => `${route.value.ws}/${route.value.item}.${route.value.type}`);

const railItems = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'workspaces', label: 'Workspaces', icon: 'workspaces' },
  { id: 'onelake', label: 'OneLake catalog', icon: 'onelake' },
  { id: 'monitor', label: 'Monitor', icon: 'monitor' },
  { id: 'realtime', label: 'Real-Time', icon: 'realtime' },
  { id: 'workloads', label: 'Workloads', icon: 'workloads' },
  { id: 'create', label: 'Create', icon: 'create' },
];

const activeRail = computed(() => {
  const page = route.value.page;
  if (page === 'workspace' || page === 'item') return 'current';
  if (page === 'deploy' || page === 'admin') return '';
  return page;
});

function onRail(id: string) {
  if (id === 'workspaces') {
    railOpen.value = false;
    flyout.value = !flyout.value;
    return;
  }
  go({ page: id as Route['page'] });
}

const flyoutWorkspaces = computed(() => rows(portal.value, 'workspaces')
  .filter(w => !wsFilter.value || String(w.name).toLowerCase().includes(wsFilter.value.toLowerCase())));

const crumb = computed(() => {
  if (route.value.page === 'workspace') return route.value.ws;
  if (route.value.page === 'item') return `${route.value.ws} / ${route.value.item}`;
  return '';
});

const searchHits = computed(() => {
  const text = search.value.trim().toLowerCase();
  if (!text) return [];
  return rows(portal.value, 'items').filter(i => String(i.name).toLowerCase().includes(text))
    .slice(0, 8);
});

function openItem(item: Record<string, any>) {
  search.value = '';
  go({ page: 'item', ws: item.workspace, item: item.name, type: item.type });
}

function doSearch() {
  if (searchHits.value[0]) openItem(searchHits.value[0]);
}

const capacity = computed(() => rows(view.value, 'capacities')[0] || null);
const capacitySku = computed(() => capacity.value?.sku || 'F8');
const capacityPaused = computed(() => capacity.value?.state === 'Paused');
const capacityText = computed(() => capacity.value
  ? `${capacity.value.name} · ${capacity.value.sku}${capacityPaused.value ? ' · Paused' : ''}`
  : 'No capacity');
const capacityTitle = computed(() => capacity.value
  ? `Capacity ${capacity.value.name} (${capacity.value.sku}), ${capacity.value.utilization}% utilized`
  : '');

const signals = computed(() => [...rows(view.value, 'signals')].reverse());
const unread = computed(() => Math.max(0, signals.value.length - seenSignals.value));

function toggle(name: string) {
  menu.value = menu.value === name ? '' : name;
  if (name === 'bell') seenSignals.value = signals.value.length;
}

function openAdmin(tab: string) {
  menu.value = '';
  go({ page: 'admin', tab });
}

// The lab builds its starting estate on the first command; a portal opened
// before the console has run anything asks for it with a harmless read.
onMounted(() => {
  if (portal.value.installed === false || !Object.keys(portal.value).length) {
    props.api.exec('fab ls', { quiet: true, unlogged: true });
  }
});

function openNewWorkspace() {
  flyout.value = false;
  newWs.value = true;
}
</script>

<style scoped>
/* ---- Fluent 2 tokens, the Fabric brand ramp (teal), Segoe UI ---- */
.fx {
  --fx-brand: #117865;
  --fx-brand-hover: #0f6c5b;
  --fx-brand-pressed: #0c5b4c;
  --fx-brand-fg: #0e6e5c;
  --fx-brand-tint: #e6f2ef;
  --fx-brand-tint2: #cfe7e1;
  --fx-fg1: #242424;
  --fx-fg2: #424242;
  --fx-fg3: #616161;
  --fx-fg4: #707070;
  --fx-fg-disabled: #8a8a8a;
  --fx-bg1: #ffffff;
  --fx-bg2: #fafafa;
  --fx-bg3: #f5f5f5;
  --fx-bg4: #f0f0f0;
  --fx-bg5: #ebebeb;
  --fx-canvas: #f0f0f0;
  --fx-stroke1: #d1d1d1;
  --fx-stroke2: #e0e0e0;
  --fx-stroke3: #f0f0f0;
  --fx-success: #107c10;
  --fx-success-bg: #f1faf1;
  --fx-danger: #c50f1f;
  --fx-danger-bg: #fdf3f4;
  --fx-warning: #bc4b09;
  --fx-warning-bg: #fff9f5;
  --fx-info: #0f6cbd;
  --fx-link: #0f6cbd;
  --fx-radius: 4px;
  --fx-radius-lg: 8px;
  --fx-shadow4: 0 0 2px rgba(0, 0, 0, .12), 0 2px 4px rgba(0, 0, 0, .14);
  --fx-shadow8: 0 0 2px rgba(0, 0, 0, .12), 0 4px 8px rgba(0, 0, 0, .14);
  --fx-shadow16: 0 0 2px rgba(0, 0, 0, .12), 0 8px 16px rgba(0, 0, 0, .14);
  --fx-shadow64: 0 0 8px rgba(0, 0, 0, .12), 0 32px 64px rgba(0, 0, 0, .14);
  --fx-font: "Segoe UI", "Segoe UI Web (West European)", -apple-system, BlinkMacSystemFont,
    Roboto, "Helvetica Neue", sans-serif;
  --fx-mono: Consolas, "Cascadia Mono", "Courier New", monospace;

  color-scheme: light;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--fx-canvas);
  color: var(--fx-fg1);
  font-family: var(--fx-font);
  font-size: 14px;
  line-height: 20px;
  text-align: left;
}
.fx *, :where(.fx) :deep(*) { box-sizing: border-box; }

/* ---- App bar ---- */
.fx-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  flex: none;
  padding: 0 8px 0 4px;
  background: var(--fx-canvas);
  z-index: 30;
}
.fx-bar__btn {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: var(--fx-radius);
  background: transparent;
  color: var(--fx-fg2);
  cursor: pointer;
}
.fx-bar__btn:hover { background: var(--fx-bg5); }
.fx-bar__burger { display: none; }
.fx-bar__brand {
  display: inline-flex; align-items: center; gap: 8px; padding: 0 8px; height: 36px;
  border: 0; background: transparent; font: 600 16px/22px var(--fx-font); color: var(--fx-fg1);
  cursor: pointer; white-space: nowrap; border-radius: var(--fx-radius);
}
.fx-bar__brand:hover { background: var(--fx-bg5); }
.fx-bar__crumb {
  color: var(--fx-fg3); font-size: 14px; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; max-width: 260px; padding-left: 4px; border-left: 1px solid var(--fx-stroke1);
  margin-left: 4px; padding-left: 10px;
}
.fx-bar__search {
  position: relative;
  display: flex; align-items: center; gap: 8px;
  flex: 1 1 auto; min-width: 0; max-width: 468px; margin: 0 auto; height: 32px; padding: 0 10px;
  border-radius: var(--fx-radius); background: var(--fx-bg1); border: 1px solid var(--fx-stroke2);
  color: var(--fx-fg3);
}
.fx-bar__search input {
  flex: 1; min-width: 0; border: 0; outline: 0; background: transparent;
  font: 14px var(--fx-font); color: var(--fx-fg1);
}
.fx-bar__hits {
  position: absolute; top: 36px; left: 0; right: 0; min-width: 340px; margin: 0; padding: 4px 0; list-style: none;
  background: var(--fx-bg1); border-radius: var(--fx-radius-lg); box-shadow: var(--fx-shadow16); z-index: 40;
}
.fx-bar__hits button {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 12px; border: 0;
  background: transparent; text-align: left; font: 14px var(--fx-font); cursor: pointer; color: var(--fx-fg1);
}
.fx-bar__hits button:hover { background: var(--fx-bg3); }
.fx-bar__hitname { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fx-bar__hitmeta { margin-left: auto; flex: none; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fx-fg3); font-size: 12px; }
@container sl-portal (max-width: 600px) {
  /* On a phone the hit list is wider than the search box, and the type and
     workspace go under the name instead of being squeezed beside it. */
  .fx-bar__hits { left: -4px; right: -96px; min-width: 0; }
  .fx-bar__hits button { flex-wrap: wrap; row-gap: 0; padding: 6px 12px 6px 36px; position: relative; }
  .fx-bar__hits button > :first-child { position: absolute; left: 12px; top: 8px; }
  .fx-bar__hitname { flex: 1 1 100%; }
  .fx-bar__hitmeta { margin-left: 0; max-width: 100%; }
}
.fx-bar__right { display: flex; align-items: center; gap: 2px; }
.fx-bar__trial {
  display: inline-flex; align-items: center; gap: 6px; margin-right: 6px; padding: 0 10px;
  height: 28px; border-radius: 14px; background: var(--fx-bg1); border: 1px solid var(--fx-stroke2);
  font-size: 12px; color: var(--fx-fg2); white-space: nowrap;
}
.fx-bar__trial-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fx-brand); }
.fx-bar__trial-dot.is-paused { background: var(--fx-warning); }
.fx-bar__badge {
  position: absolute; top: 3px; right: 2px; min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 9px; background: var(--fx-brand); color: #fff; font-size: 12px; line-height: 16px; text-align: center;
}
.fx-bar__avatar {
  width: 32px; height: 32px; margin-left: 4px; border: 0; border-radius: 50%;
  background: #8764b8; color: #fff; font: 600 12px var(--fx-font); cursor: pointer;
}

/* ---- Flyout menus ---- */
.fx-flyout {
  position: absolute; top: 46px; right: 8px; width: 300px; max-width: calc(100% - 16px); padding: 8px 0;
  background: var(--fx-bg1); border-radius: var(--fx-radius-lg); box-shadow: var(--fx-shadow16); z-index: 50;
}
.fx-flyout--bell { width: 360px; max-height: 420px; overflow: auto; }
.fx-flyout__title {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 16px 8px; font-weight: 600; font-size: 16px;
}
.fx-flyout > button {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 16px; border: 0;
  background: transparent; font: 14px var(--fx-font); color: var(--fx-fg1); cursor: pointer; text-align: left;
}
.fx-flyout > button:hover { background: var(--fx-bg3); }
.fx-note { display: flex; gap: 10px; padding: 8px 16px; border-top: 1px solid var(--fx-stroke3); }
.fx-note__msg { font-size: 13px; }
.fx-note__at { color: var(--fx-fg3); font-size: 12px; }
.fx-me { display: flex; gap: 12px; align-items: center; padding: 8px 16px 12px; }
.fx-me__row { display: flex; justify-content: space-between; padding: 6px 16px; font-size: 13px; }

/* ---- Body: rail + main ---- */
.fx-body { position: relative; display: flex; flex: 1; min-height: 0; }
.fx-rail {
  display: flex; flex-direction: column; align-items: stretch; gap: 2px;
  width: 76px; flex: none; padding: 4px 4px 8px; overflow-y: auto; background: var(--fx-canvas);
  z-index: 20;
}
.fx-rail__item {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  min-height: 56px; padding: 8px 2px 6px; border: 0; border-radius: var(--fx-radius);
  background: transparent; color: var(--fx-fg2); font: 12px/14px var(--fx-font); cursor: pointer;
  text-align: center;
}
.fx-rail__item > span { max-width: 68px; overflow: hidden; text-overflow: ellipsis; overflow-wrap: anywhere; }
.fx-rail__item:hover { background: var(--fx-bg5); }
.fx-rail__item.is-active { background: var(--fx-bg1); color: var(--fx-brand-fg); font-weight: 600; box-shadow: var(--fx-shadow4); }
.fx-rail__item.is-active::before {
  content: ''; position: absolute; left: 0; top: 14px; bottom: 14px; width: 3px;
  border-radius: 2px; background: var(--fx-brand);
}
.fx-rail__ws {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2;
  overflow-wrap: anywhere; padding: 0 2px;
}
.fx-rail__sep { height: 1px; margin: 6px 10px; background: var(--fx-stroke1); }
.fx-rail__grow { flex: 1; }
.fx-rail__exp { color: var(--fx-fg1); }
.fx-scrim { display: none; }
.fx-main {
  flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column;
  margin: 0 8px 8px 0; border-radius: var(--fx-radius-lg); background: var(--fx-bg1);
  box-shadow: var(--fx-shadow4); overflow: hidden;
}

.fx-loading { position: relative; height: 2px; flex: none; overflow: hidden; background: var(--fx-brand-tint); }
.fx-loading span { position: absolute; top: 0; bottom: 0; width: 30%; background: var(--fx-brand); animation: fx-load 1.2s ease-in-out infinite; }
@keyframes fx-load { from { left: -30%; } to { left: 100%; } }

/* ---- Workspaces flyout ---- */
.fx-wsfly {
  position: absolute; top: 0; bottom: 8px; left: 76px; width: 320px; display: flex;
  flex-direction: column; background: var(--fx-bg1); box-shadow: var(--fx-shadow16);
  border-radius: var(--fx-radius-lg); z-index: 25; padding: 12px 0 0;
}
.fx-wsfly__head { display: flex; align-items: center; justify-content: space-between; padding: 0 16px 8px; }
.fx-wsfly__head h2 { margin: 0; font: 600 20px/28px var(--fx-font); }
.fx-wsfly__list { flex: 1; overflow: auto; margin: 8px 0 0; padding: 0; list-style: none; }
.fx-wsfly__list button {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 16px; border: 0;
  background: transparent; font: 14px var(--fx-font); color: var(--fx-fg1); cursor: pointer; text-align: left;
}
.fx-wsfly__list button:hover { background: var(--fx-bg3); }
.fx-wsfly__list button.is-current { background: var(--fx-brand-tint); font-weight: 600; }
.fx-wsfly__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fx-wsfly__foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--fx-stroke2); }
.fx-diamond { color: var(--fx-brand); font-size: 12px; }
.fx-wsfly .fx-input--search { margin: 0 16px; width: auto; }

/* ---- Toasts ---- */
.fx-toasts {
  position: absolute; bottom: 16px; right: 16px; display: flex; flex-direction: column-reverse; gap: 8px;
  width: min(360px, calc(100% - 32px)); z-index: 90; pointer-events: none;
}
.fx-toast {
  display: flex; align-items: flex-start; gap: 10px; padding: 12px; pointer-events: auto;
  background: var(--fx-bg1); border-radius: var(--fx-radius-lg); box-shadow: var(--fx-shadow16);
}
.fx-toast__text { flex: 1; min-width: 0; }
.fx-toast__title { font-weight: 600; font-size: 14px; }
.fx-toast__detail { margin-top: 2px; font-size: 13px; color: var(--fx-fg2); word-break: break-word; }

/* ================= Shared primitives, used by every page ================= */
/* The platform's global sheet paints form controls for a dark galaxy (white ink
   on a translucent field). Inside the product they take the product's palette;
   The lab's cascade guard (labs.css) reverts bare controls at (0,1,1), and the
   `:where(.fx[data-v])` wrapper weighs nothing, so a shared rule written as one
   class lost to it on colour, background, border, weight and radius - every
   .fx-btn came out as a grey bevel with black text. `:not(.fx-nil)` and the
   `:is(*, b)` suffix below lift these rules to (0,1,1): they win the tie with
   the guard (this chunk loads after labs.css) and still lose to every page's
   own scoped (0,2,0) rule. */
:where(.fx) :deep(:is(button, input, select, textarea):not(.fx-nil)) { color: inherit; font: inherit; }
:where(.fx) :deep(:is(input, select, textarea):not(.fx-nil)) {
  background-color: #fff; border-color: var(--fx-stroke1); caret-color: var(--fx-fg1); accent-color: var(--fx-brand);
}
:where(.fx) :deep(:is(option, optgroup):not(.fx-nil)) { background-color: #fff; color: #242424; }
:where(.fx) :deep(.fx-muted:is(*, b)) { color: var(--fx-fg3); }
:where(.fx) :deep(.fx-strong:is(*, b)) { font-weight: 600; }
:where(.fx) :deep(.fx-pad:is(*, b)) { padding: 8px 16px; }
:where(.fx) :deep(.fx-mono:is(*, b)) { font-family: var(--fx-mono); font-size: 13px; }
:where(.fx) :deep(.fx-link:is(*, b)) {
  border: 0; padding: 0; background: none; color: var(--fx-link); font: inherit; cursor: pointer;
  text-align: left;
}
:where(.fx) :deep(.fx-link:hover) { text-decoration: underline; }

:where(.fx) :deep(.fx-btn:is(*, b)) {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-width: 32px; height: 32px; padding: 0 12px; border: 1px solid var(--fx-stroke1);
  border-radius: var(--fx-radius); background: var(--fx-bg1); color: var(--fx-fg1);
  font: 600 14px/20px var(--fx-font); cursor: pointer; white-space: nowrap;
}
:where(.fx) :deep(.fx-btn:hover) { background: var(--fx-bg3); border-color: #c7c7c7; }
:where(.fx) :deep(.fx-btn:disabled:is(*, b)) { background: var(--fx-bg4); border-color: var(--fx-stroke2); color: var(--fx-fg-disabled); cursor: default; }
:where(.fx) :deep(.fx-btn--primary:is(*, b)) { background: var(--fx-brand); border-color: transparent; color: #fff; }
:where(.fx) :deep(.fx-btn--primary:hover) { background: var(--fx-brand-hover); border-color: transparent; }
:where(.fx) :deep(.fx-btn--primary:active) { background: var(--fx-brand-pressed); }
:where(.fx) :deep(.fx-btn--primary:disabled:is(*, b)) { background: var(--fx-bg4); color: var(--fx-fg-disabled); }
:where(.fx) :deep(.fx-btn--danger:is(*, b)) { background: var(--fx-danger); border-color: transparent; color: #fff; }
:where(.fx) :deep(.fx-btn--danger:hover) { background: #a80d1a; }
:where(.fx) :deep(.fx-btn--subtle:is(*, b)) { border-color: transparent; background: transparent; font-weight: 400; }
:where(.fx) :deep(.fx-btn--subtle:hover) { background: var(--fx-bg4); border-color: transparent; }
:where(.fx) :deep(.fx-btn--sm:is(*, b)) { height: 24px; padding: 0 8px; font-size: 12px; font-weight: 400; }

:where(.fx) :deep(.fx-iconbtn:is(*, b)) {
  display: inline-grid; place-items: center; width: 28px; height: 28px; border: 0;
  border-radius: var(--fx-radius); background: transparent; color: var(--fx-fg2); cursor: pointer;
}
:where(.fx) :deep(.fx-iconbtn:hover) { background: var(--fx-bg4); }
:where(.fx) :deep(.fx-iconbtn:disabled:is(*, b)) { color: var(--fx-fg-disabled); background: transparent; cursor: default; }

/* Ribbon / command bar */
:where(.fx) :deep(.fx-cmdbar:is(*, b)) {
  display: flex; align-items: center; gap: 2px; flex-wrap: wrap; padding: 6px 12px;
  border-bottom: 1px solid var(--fx-stroke2); background: var(--fx-bg1);
}
:where(.fx) :deep(.fx-cmd:is(*, b)) {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px;
  border: 0; border-radius: var(--fx-radius); background: transparent; color: var(--fx-fg1);
  font: 14px var(--fx-font); cursor: pointer; white-space: nowrap;
}
:where(.fx) :deep(.fx-cmd:hover) { background: var(--fx-bg4); }
:where(.fx) :deep(.fx-cmd:disabled:is(*, b)) { color: var(--fx-fg-disabled); cursor: default; background: transparent; }
:where(.fx) :deep(.fx-cmd--primary:is(*, b)) { color: var(--fx-brand-fg); font-weight: 600; }
:where(.fx) :deep(.fx-cmd .fx-ico) { color: var(--fx-brand-fg); }
:where(.fx) :deep(.fx-cmdbar__sep:is(*, b)) { width: 1px; height: 20px; margin: 0 4px; background: var(--fx-stroke1); }
:where(.fx) :deep(.fx-cmdbar__grow:is(*, b)) { flex: 1; }
:where(.fx) :deep(.fx-tabs:is(*, b)) { display: flex; gap: 4px; padding: 0 12px; border-bottom: 1px solid var(--fx-stroke2); overflow-x: auto; }
:where(.fx) :deep(.fx-tab:is(*, b)) {
  position: relative; height: 40px; padding: 0 10px; border: 0; background: transparent;
  color: var(--fx-fg2); font: 14px var(--fx-font); cursor: pointer; white-space: nowrap;
}
:where(.fx) :deep(.fx-tab:disabled:is(*, b)) { color: var(--fx-fg-disabled); cursor: default; }
:where(.fx) :deep(.fx-tab:hover) { color: var(--fx-fg1); }
:where(.fx) :deep(.fx-tab.is-active) { color: var(--fx-fg1); font-weight: 600; }
:where(.fx) :deep(.fx-tab.is-active::after) {
  content: ''; position: absolute; left: 10px; right: 10px; bottom: 0; height: 3px;
  border-radius: 2px; background: var(--fx-brand);
}

/* Page header */
:where(.fx) :deep(.fx-page:is(*, b)) { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
:where(.fx) :deep(.fx-page__scroll:is(*, b)) { flex: 1; min-height: 0; overflow: auto; }
:where(.fx) :deep(.fx-page__head:is(*, b)) { display: flex; align-items: center; gap: 12px; padding: 16px 20px 8px; flex-wrap: wrap; }
:where(.fx) :deep(.fx-page__title:is(*, b)) { margin: 0; font: 600 20px/28px var(--fx-font); }
:where(.fx) :deep(.fx-page__sub:is(*, b)) { color: var(--fx-fg3); font-size: 13px; }
:where(.fx) :deep(.fx-h3:is(*, b)) { margin: 16px 0 8px; font: 600 16px/22px var(--fx-font); }
:where(.fx) :deep(.fx-breadcrumb:is(*, b)) { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 0 20px; font-size: 14px; }
:where(.fx) :deep(.fx-breadcrumb button) { border: 0; background: none; padding: 2px 4px; border-radius: 4px; font: inherit; color: var(--fx-fg2); cursor: pointer; }
:where(.fx) :deep(.fx-breadcrumb button:hover) { background: var(--fx-bg4); }
:where(.fx) :deep(.fx-breadcrumb .is-current) { color: var(--fx-fg1); font-weight: 600; }

/* Tables (the workspace list, monitor, settings lists) */
:where(.fx) :deep(.fx-tablewrap:is(*, b)) { overflow: auto; }
:where(.fx) :deep(.fx-table:is(*, b)) { width: 100%; border-collapse: collapse; font-size: 14px; }
:where(.fx) :deep(.fx-table th) {
  position: sticky; top: 0; z-index: 1; height: 40px; padding: 0 12px; text-align: left;
  font-weight: 600; font-size: 13px; color: var(--fx-fg2); background: var(--fx-bg1);
  border-bottom: 1px solid var(--fx-stroke2); white-space: nowrap;
}
:where(.fx) :deep(.fx-table td) {
  height: 44px; padding: 0 12px; border-bottom: 1px solid var(--fx-stroke3); white-space: nowrap;
  color: var(--fx-fg1);
}
/* An empty-state row spans the table; it wraps rather than widening every column. */
:where(.fx) :deep(.fx-table td[colspan]) { white-space: normal; height: auto; padding-top: 12px; padding-bottom: 12px; line-height: 20px; }
:where(.fx) :deep(.fx-table tr:hover td) { background: var(--fx-bg2); }
:where(.fx) :deep(.fx-table tr.is-selected td) { background: var(--fx-brand-tint); }
:where(.fx) :deep(.fx-table .fx-cellname) { display: flex; align-items: center; gap: 8px; min-width: 180px; }
:where(.fx) :deep(.fx-table .fx-cellname button) { border: 0; background: none; font: inherit; color: var(--fx-fg1); cursor: pointer; padding: 0; text-align: left; }
:where(.fx) :deep(.fx-table .fx-cellname button:hover) { color: var(--fx-link); text-decoration: underline; }
:where(.fx) :deep(.fx-table input[type='checkbox']) { accent-color: var(--fx-brand); width: 16px; height: 16px; margin: 0; vertical-align: middle; }
:where(.fx) :deep(.fx-empty:is(*, b)) { padding: 48px 20px; text-align: center; color: var(--fx-fg3); }
:where(.fx) :deep(.fx-empty h3) { margin: 12px 0 4px; color: var(--fx-fg1); font: 600 16px var(--fx-font); }
:where(.fx) :deep(.fx-empty p) { max-width: 560px; margin: 0 auto 16px; line-height: 20px; }

/* Pills & badges */
:where(.fx) :deep(.fx-pill:is(*, b)) {
  display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 8px;
  border-radius: 10px; font-size: 12px; background: var(--fx-bg4); color: var(--fx-fg2); white-space: nowrap;
}
:where(.fx) :deep(.fx-pill--brand:is(*, b)) { background: var(--fx-brand-tint); color: var(--fx-brand-fg); }
:where(.fx) :deep(.fx-pill--ok:is(*, b)) { background: var(--fx-success-bg); color: var(--fx-success); }
:where(.fx) :deep(.fx-pill--bad:is(*, b)) { background: var(--fx-danger-bg); color: var(--fx-danger); }
:where(.fx) :deep(.fx-pill--warn:is(*, b)) { background: var(--fx-warning-bg); color: var(--fx-warning); }
:where(.fx) :deep(.fx-pill--info:is(*, b)) { background: #ebf3fc; color: var(--fx-info); }
:where(.fx) :deep(.fx-label:is(*, b)) { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
:where(.fx) :deep(.fx-label:is(*, b)::before) { content: ''; width: 8px; height: 8px; border-radius: 2px; background: var(--fx-label-color, #8a8886); }
:where(.fx) :deep(.fx-avatar:is(*, b)) {
  display: inline-grid; place-items: center; width: 24px; height: 24px; flex: none;
  border-radius: 50%; color: #fff; font: 600 12px/1 var(--fx-font); letter-spacing: -.4px;
}
:where(.fx) :deep(.fx-avatar--lg:is(*, b)) { width: 40px; height: 40px; font-size: 14px; }

/* Forms */
:where(.fx) :deep(.fx-field:is(*, b)) { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
:where(.fx) :deep(.fx-field > label), :where(.fx) :deep(.fx-field__label:is(*, b)) { font-weight: 600; font-size: 14px; color: var(--fx-fg1); }
:where(.fx) :deep(.fx-field__req:is(*, b)) { color: var(--fx-danger); margin-left: 2px; }
:where(.fx) :deep(.fx-field__help:is(*, b)) { font-size: 12px; color: var(--fx-fg3); }
:where(.fx) :deep(.fx-field__err:is(*, b)) { font-size: 12px; color: var(--fx-danger); }
/* :where() keeps these at the lowest specificity so a page can size its own fields */
:where(.fx) :deep(:where(.fx-input, .fx-select, .fx-textarea)) { width: 100%; }
:where(.fx) :deep(.fx-input:is(*, b)), :where(.fx) :deep(.fx-select:is(*, b)), :where(.fx) :deep(.fx-textarea:is(*, b)) {
  min-height: 32px; padding: 5px 10px; border: 1px solid var(--fx-stroke1);
  border-bottom-color: #616161; border-radius: var(--fx-radius); background: var(--fx-bg1);
  font: 14px var(--fx-font); color: var(--fx-fg1); outline: none;
}
:where(.fx) :deep(.fx-input:focus), :where(.fx) :deep(.fx-select:focus), :where(.fx) :deep(.fx-textarea:focus) {
  border-bottom: 2px solid var(--fx-brand); padding-bottom: 4px; box-shadow: none; outline: none;
}
:where(.fx) :deep(:is(.fx-input, .fx-select, .fx-textarea):disabled:is(*, b)) {
  background: var(--fx-bg3); border-color: var(--fx-stroke2); color: var(--fx-fg3); cursor: default;
}
:where(.fx) :deep(.fx-input.is-invalid) { border-bottom-color: var(--fx-danger); }
:where(.fx) :deep(.fx-textarea:is(*, b)) { min-height: 72px; resize: vertical; }
/* A Fluent dropdown: no native bevel, a thin chevron (an inline SVG data URI -
   no request), and room on the right for it. */
:where(.fx) :deep(select.fx-select) {
  appearance: none; -webkit-appearance: none; padding-right: 30px; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%23424242' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center; background-size: 12px 12px;
  text-overflow: ellipsis; white-space: nowrap;
}
:where(.fx) :deep(select.fx-select:disabled) { cursor: default; opacity: .8; }
:where(.fx) :deep(input:is(*, b)::placeholder), :where(.fx) :deep(textarea:is(*, b)::placeholder), .fx input::placeholder { color: var(--fx-fg4); opacity: 1; }
:where(.fx) :deep(.fx-input--search:is(*, b)) { display: flex; align-items: center; gap: 6px; color: var(--fx-fg3); }
:where(.fx) :deep(.fx-input--search input), :where(.fx) :deep(.fx-input--search input:focus) { flex: 1; min-width: 0; border: 0; outline: 0; box-shadow: none; font: 14px var(--fx-font); background: transparent; }
.fx-bar__search input:focus { box-shadow: none; }
:where(.fx) :deep(.fx-code:focus) { box-shadow: none; outline: none; }
:where(.fx) :deep(.fx-check:is(*, b)) { display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 12px; cursor: pointer; }
:where(.fx) :deep(.fx-check input) { accent-color: var(--fx-brand); width: 16px; height: 16px; }
:where(.fx) :deep(.fx-switch:is(*, b)) { position: relative; width: 40px; height: 20px; border-radius: 10px; border: 1px solid #616161; background: #fff; cursor: pointer; flex: none; padding: 0; }
:where(.fx) :deep(.fx-switch:is(*, b)::after) { content: ''; position: absolute; top: 3px; left: 3px; width: 12px; height: 12px; border-radius: 50%; background: #616161; transition: left .1s; }
:where(.fx) :deep(.fx-switch.is-on) { background: var(--fx-brand); border-color: var(--fx-brand); }
:where(.fx) :deep(.fx-switch.is-on::after) { left: 23px; background: #fff; }
:where(.fx) :deep(.fx-msgbar:is(*, b)) {
  display: flex; gap: 8px; align-items: flex-start; padding: 8px 12px; border-radius: var(--fx-radius);
  border: 1px solid var(--fx-stroke2); background: var(--fx-bg2); font-size: 13px; margin-bottom: 12px;
}
:where(.fx) :deep(.fx-msgbar--error:is(*, b)) { background: var(--fx-danger-bg); border-color: #eeacb2; }
:where(.fx) :deep(.fx-msgbar--warning:is(*, b)) { background: var(--fx-warning-bg); border-color: #fdcfb4; }
:where(.fx) :deep(.fx-msgbar--success:is(*, b)) { background: var(--fx-success-bg); border-color: #9fd89f; }
:where(.fx) :deep(.fx-msgbar--info:is(*, b)) { background: #ebf3fc; border-color: #b4d6fa; }

/* Overlay, dialog, side panel */
:where(.fx) :deep(.fx-overlay:is(*, b)) {
  position: absolute; inset: 0; z-index: 80; display: grid; place-items: center;
  background: rgba(0, 0, 0, .4); padding: 16px;
  /* One track no wider than the overlay, so an inline width on the dialog or
     panel is capped by its max-width instead of overflowing the frame. */
  grid-template-columns: minmax(0, 1fr);
}
:where(.fx) :deep(.fx-overlay--side:is(*, b)) { place-items: stretch end; padding: 0; }
:where(.fx) :deep(.fx-dialog:is(*, b)) {
  max-width: 100%; max-height: calc(100% - 16px); display: flex; flex-direction: column;
  background: var(--fx-bg1); border-radius: var(--fx-radius-lg); box-shadow: var(--fx-shadow64);
}
:where(.fx) :deep(.fx-dialog__head:is(*, b)) { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 24px 24px 8px; }
:where(.fx) :deep(.fx-dialog__title:is(*, b)) { margin: 0; font: 600 20px/28px var(--fx-font); }
:where(.fx) :deep(.fx-dialog__body:is(*, b)) { padding: 8px 24px; overflow: auto; }
:where(.fx) :deep(.fx-dialog__foot:is(*, b)) { display: flex; justify-content: flex-end; gap: 8px; padding: 16px 24px 24px; flex-wrap: wrap; }
:where(.fx) :deep(.fx-panel:is(*, b)) {
  max-width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--fx-bg1);
  box-shadow: var(--fx-shadow64);
}
:where(.fx) :deep(.fx-panel__head:is(*, b)) { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 12px; }
:where(.fx) :deep(.fx-panel__title:is(*, b)) { margin: 0; font: 600 20px/28px var(--fx-font); }
:where(.fx) :deep(.fx-panel__body:is(*, b)) { flex: 1; overflow: auto; padding: 4px 24px 16px; }
:where(.fx) :deep(.fx-panel__foot:is(*, b)) { display: flex; gap: 8px; padding: 16px 24px; border-top: 1px solid var(--fx-stroke2); flex-wrap: wrap; }

/* Context menu */
:where(.fx) :deep(.fx-menu:is(*, b)) {
  position: absolute; z-index: 60; min-width: 200px; padding: 4px 0; background: var(--fx-bg1);
  border-radius: var(--fx-radius-lg); box-shadow: var(--fx-shadow16);
}
:where(.fx) :deep(.fx-menu button) {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 12px; border: 0;
  background: transparent; font: 14px var(--fx-font); color: var(--fx-fg1); cursor: pointer; text-align: left;
}
:where(.fx) :deep(.fx-menu button:hover) { background: var(--fx-bg3); }
:where(.fx) :deep(.fx-menu button:disabled) { color: var(--fx-fg-disabled); background: transparent; cursor: default; }
:where(.fx) :deep(.fx-menu .is-danger) { color: var(--fx-danger); }
:where(.fx) :deep(.fx-menu hr) { margin: 4px 0; border: 0; border-top: 1px solid var(--fx-stroke2); }

/* Explorer tree (lakehouse, warehouse, model) */
:where(.fx) :deep(.fx-split:is(*, b)) { display: flex; flex: 1; min-height: 0; }
:where(.fx) :deep(.fx-explorer:is(*, b)) {
  width: 260px; flex: none; display: flex; flex-direction: column; border-right: 1px solid var(--fx-stroke2);
  background: var(--fx-bg2); min-height: 0;
}
:where(.fx) :deep(.fx-explorer__head:is(*, b)) { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px 6px; font-weight: 600; }
:where(.fx) :deep(.fx-explorer__body:is(*, b)) { flex: 1; overflow: auto; padding: 0 4px 12px; }
:where(.fx) :deep(.fx-node:is(*, b)) {
  display: flex; align-items: center; gap: 6px; width: 100%; min-height: 28px; padding: 0 6px;
  border: 0; border-radius: var(--fx-radius); background: transparent; font: 13px var(--fx-font);
  color: var(--fx-fg1); cursor: pointer; text-align: left; white-space: nowrap;
}
:where(.fx) :deep(.fx-node:hover) { background: var(--fx-bg4); }
:where(.fx) :deep(.fx-node.is-selected) { background: var(--fx-brand-tint); font-weight: 600; }
:where(.fx) :deep(.fx-node__caret:is(*, b)) { width: 16px; flex: none; color: var(--fx-fg3); display: inline-grid; place-items: center; }
:where(.fx) :deep(.fx-node__label:is(*, b)) { overflow: hidden; text-overflow: ellipsis; flex: 1; }
:where(.fx) :deep(.fx-node__meta:is(*, b)) { color: var(--fx-fg3); font-size: 12px; }
:where(.fx) :deep(.fx-content:is(*, b)) { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }

/* Result grid */
:where(.fx) :deep(.fx-grid:is(*, b)) { display: flex; flex-direction: column; min-height: 0; flex: 1; }
:where(.fx) :deep(.fx-grid__empty:is(*, b)) { padding: 24px; color: var(--fx-fg3); text-align: center; }
:where(.fx) :deep(.fx-grid__scroll:is(*, b)) { flex: 1; overflow: auto; min-height: 0; }
:where(.fx) :deep(.fx-grid__table:is(*, b)) { border-collapse: separate; border-spacing: 0; font-size: 13px; }
:where(.fx) :deep(.fx-grid__table th) {
  position: sticky; top: 0; z-index: 1; padding: 6px 10px; background: var(--fx-bg3);
  border-bottom: 1px solid var(--fx-stroke1); border-right: 1px solid var(--fx-stroke2);
  text-align: left; font-weight: 600; white-space: nowrap;
}
:where(.fx) :deep(.fx-grid__table td) {
  max-width: 280px; padding: 5px 10px; border-bottom: 1px solid var(--fx-stroke3);
  border-right: 1px solid var(--fx-stroke3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
:where(.fx) :deep(.fx-grid__table td.is-null) { color: var(--fx-fg4); font-style: italic; }
:where(.fx) :deep(.fx-grid__rownum:is(*, b)) { color: var(--fx-fg4); text-align: right; background: var(--fx-bg2); min-width: 36px; }
:where(.fx) :deep(.fx-grid__status:is(*, b)) { padding: 4px 12px; font-size: 12px; color: var(--fx-fg3); border-top: 1px solid var(--fx-stroke2); }

/* Code editors (SQL, notebook cells, DAX) */
:where(.fx) :deep(.fx-code:is(*, b)) {
  width: 100%; min-height: 120px; padding: 10px 12px; border: 0; outline: 0; resize: vertical;
  font: 13px/20px var(--fx-mono); color: #1f1f1f; background: #fff; tab-size: 4; white-space: pre;
}
:where(.fx) :deep(.fx-cards:is(*, b)) { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
:where(.fx) :deep(.fx-card:is(*, b)) {
  display: flex; flex-direction: column; gap: 6px; padding: 14px; border: 1px solid var(--fx-stroke2);
  border-radius: var(--fx-radius-lg); background: var(--fx-bg1); text-align: left; font: 14px var(--fx-font);
  color: var(--fx-fg1); cursor: pointer;
}
:where(.fx) :deep(.fx-card:disabled:is(*, b)) { background: var(--fx-bg2); color: var(--fx-fg-disabled); cursor: default; box-shadow: none; border-color: var(--fx-stroke2); }
:where(.fx) :deep(.fx-card:disabled .fx-card__desc) { color: var(--fx-fg-disabled); }
:where(.fx) :deep(.fx-card:not(:disabled):hover) { box-shadow: var(--fx-shadow8); border-color: transparent; }
:where(.fx) :deep(.fx-card__title:is(*, b)) { display: flex; align-items: center; gap: 8px; font-weight: 600; }
:where(.fx) :deep(.fx-card__desc:is(*, b)) { font-size: 12px; color: var(--fx-fg3); line-height: 16px; }
:where(.fx) :deep(.fx-kv:is(*, b)) { display: grid; grid-template-columns: 180px 1fr; gap: 8px 16px; font-size: 14px; }
:where(.fx) :deep(.fx-kv dt) { color: var(--fx-fg3); }
:where(.fx) :deep(.fx-kv dd) { margin: 0; word-break: break-word; }
:where(.fx) :deep(.fx-settings:is(*, b)) { display: flex; min-height: 100%; }
:where(.fx) :deep(.fx-settings__nav:is(*, b)) { width: 200px; flex: none; padding: 0 8px 0 0; border-right: 1px solid var(--fx-stroke2); }
:where(.fx) :deep(.fx-settings__nav button) {
  display: block; width: 100%; padding: 8px 12px; border: 0; border-radius: var(--fx-radius);
  background: transparent; text-align: left; font: 14px var(--fx-font); color: var(--fx-fg1); cursor: pointer;
}
:where(.fx) :deep(.fx-settings__nav button:hover) { background: var(--fx-bg4); }
:where(.fx) :deep(.fx-settings__nav button.is-active) { background: var(--fx-brand-tint); font-weight: 600; }
:where(.fx) :deep(.fx-settings__body:is(*, b)) { flex: 1; min-width: 0; padding: 0 0 0 20px; }

/* ---- Narrow frames: the rail collapses behind a hamburger ---- */
@container sl-portal (max-width: 900px) {
  .fx-bar__burger { display: inline-grid; }
  .fx-bar__crumb { display: none; }
  .fx-rail {
    position: absolute; top: 0; bottom: 0; left: 0; transform: translateX(-100%);
    transition: transform .15s, visibility 0s .15s; box-shadow: var(--fx-shadow16); background: var(--fx-bg3);
    /* Closed, the drawer is out of the tab order and out of hit-testing too. */
    visibility: hidden;
  }
  .fx.is-rail-open .fx-rail { transform: none; visibility: visible; transition: transform .15s; }
  /* The drawer: wider, one row per destination, icon then label. */
  .fx-rail { width: 248px; padding: 8px; gap: 2px; z-index: 26; }
  .fx-rail__item {
    flex-direction: row; justify-content: flex-start; gap: 12px; min-height: 40px;
    padding: 8px 12px; font-size: 14px; line-height: 20px; text-align: left;
  }
  .fx-rail__item > span { max-width: none; flex: 1; min-width: 0; white-space: nowrap; text-overflow: ellipsis; }
  .fx-rail__ws { display: block; }
  .fx-rail__item.is-active::before { top: 10px; bottom: 10px; }
  .fx-scrim { display: block; position: absolute; inset: 0; z-index: 24; background: rgba(0, 0, 0, .32); }
  .fx-main { margin-left: 8px; }
  .fx-wsfly { left: 8px; width: min(320px, calc(100% - 16px)); }
  :where(.fx) :deep(.fx-explorer:is(*, b)) { width: 200px; }
  :where(.fx) :deep(.fx-settings:is(*, b)) { flex-direction: column; }
  :where(.fx) :deep(.fx-settings__nav:is(*, b)) { width: auto; display: flex; flex-wrap: wrap; gap: 2px; border-right: 0; border-bottom: 1px solid var(--fx-stroke2); padding: 0 0 4px; }
  :where(.fx) :deep(.fx-settings__nav button) { white-space: nowrap; width: auto; padding: 6px 10px; }
  :where(.fx) :deep(.fx-settings__body:is(*, b)) { padding: 12px 0 0; }
}
@container sl-portal (max-width: 600px) {
  .fx-bar__trial, .fx-hide-narrow, .fx-bar__waffle { display: none; }
  .fx-bar { padding: 0 6px 0 2px; gap: 2px; }
  .fx-bar__brand span { display: none; }
  .fx-bar__search { max-width: none; }
  :where(.fx) :deep(.fx-split:is(*, b)) { flex-direction: column; }
  :where(.fx) :deep(.fx-explorer:is(*, b)) { width: auto; max-height: 38%; border-right: 0; border-bottom: 1px solid var(--fx-stroke2); }
  :where(.fx) :deep(.fx-kv:is(*, b)) { grid-template-columns: 1fr; gap: 2px 0; }
  :where(.fx) :deep(.fx-kv dd) { margin-bottom: 8px; }
  :where(.fx) :deep(.fx-page__head:is(*, b)) { padding: 12px 12px 6px; }
  :where(.fx) :deep(.fx-breadcrumb:is(*, b)) { padding: 0 12px; }
  /* The ribbon under an item header: tighter commands on a phone so it wraps
     into two rows at most rather than three that push the editor down. */
  :where(.fx) :deep(.ih + .fx-cmdbar:is(*, b)) { padding: 4px 6px; gap: 0 2px; }
  :where(.fx) :deep(.ih + .fx-cmdbar .fx-cmd:is(*, b)) { height: 30px; padding: 0 6px; gap: 4px; font-size: 13px; }
  :where(.fx) :deep(.ih + .fx-cmdbar .fx-cmdbar__sep) { display: none; }
  :where(.fx) :deep(.fx-tabs:is(*, b)) { padding: 0 6px; gap: 0; }
  :where(.fx) :deep(.fx-tab:is(*, b)) { padding: 0 6px; }
  :where(.fx) :deep(.fx-tab.is-active::after) { left: 6px; right: 6px; }
  :where(.fx) :deep(.fx-dialog__head:is(*, b)) { padding: 16px 16px 6px; }
  :where(.fx) :deep(.fx-dialog__body:is(*, b)) { padding: 6px 16px; }
  :where(.fx) :deep(.fx-dialog__foot:is(*, b)) { padding: 12px 16px 16px; }
  :where(.fx) :deep(.fx-panel__head:is(*, b)), :where(.fx) :deep(.fx-panel__body:is(*, b)), :where(.fx) :deep(.fx-panel__foot:is(*, b)) { padding-left: 16px; padding-right: 16px; }
}
@container sl-portal (max-width: 400px) {
  /* The smallest phones: tab strips tighten so three tabs still fit. */
  :where(.fx) :deep(.fx-tab:is(*, b)) { padding: 0 4px; font-size: 13px; }
  :where(.fx) :deep(.fx-tab.is-active::after) { left: 4px; right: 4px; }
}
</style>
