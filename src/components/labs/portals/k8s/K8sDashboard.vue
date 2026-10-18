<template>
  <div class="kd-root" dir="ltr" :class="{ 'nav-open': navOpen }">
    <!-- PRIMARY TOOLBAR -->
    <header class="kd-toolbar">
      <button type="button" class="kd-tbtn" aria-label="Toggle navigation" @click="navOpen = !navOpen"><KIcon name="menu" /></button>
      <a href="#" class="kd-brand" aria-label="Kubernetes Dashboard home" @click.prevent="go({ page: 'overview' })">
        <svg class="kd-brand__logo" viewBox="0 0 64 64" aria-hidden="true">
          <polygon points="32,3 55,14 61,39 45,59 19,59 3,39 9,14" fill="#326de6" />
          <circle cx="32" cy="33" r="13" fill="none" stroke="#fff" stroke-width="3.5" />
          <g stroke="#fff" stroke-width="3" stroke-linecap="round"><line x1="32" y1="14" x2="32" y2="52" /><line x1="15" y1="25" x2="49" y2="41" /><line x1="15" y1="41" x2="49" y2="25" /></g>
          <circle cx="32" cy="33" r="4" fill="#fff" />
        </svg>
        <span class="kd-brand__text">kubernetes</span>
      </a>
      <div class="kd-nsselect">
        <select v-model="namespace" class="kd-nsselect__box" aria-label="Namespace">
          <option :value="ALL_NAMESPACES">All namespaces</option>
          <option v-for="n in namespaceNames" :key="n" :value="n">{{ n }}</option>
        </select>
        <KIcon name="drop" class="kd-nsselect__caret" :size="20" />
      </div>
      <form class="kd-search" role="search" @submit.prevent="go({ page: 'search', q: searchText })">
        <KIcon name="search" :size="20" />
        <input v-model="searchText" type="search" placeholder="Search" aria-label="Search" @keydown.enter.prevent="go({ page: 'search', q: searchText })" />
      </form>
      <span class="kd-toolbar__spacer" />
      <button type="button" class="kd-tbtn kd-tbtn--primary" title="Create new resource" aria-label="Create new resource" @click="go({ page: 'create' })"><KIcon name="add" /></button>
      <div class="kd-anchor">
        <button type="button" class="kd-tbtn" title="Notifications" aria-label="Notifications" @click.stop="openMenu = openMenu === 'bell' ? '' : 'bell'; unread = 0">
          <KIcon name="notifications" /><span v-if="unread" class="kd-badge">{{ unread }}</span>
        </button>
        <div v-if="openMenu === 'bell'" class="kd-popup kd-popup--bell" @click.stop>
          <div class="kd-popup__head">Notifications <button type="button" class="kd-linkbtn" @click="notices = []">Clear</button></div>
          <div v-if="!notices.length" class="kd-popup__empty">There are no notifications</div>
          <div v-for="n in notices" :key="n.id" class="kd-notice">
            <KIcon :name="n.type === 'error' ? 'error' : 'check'" :size="18" :class="n.type === 'error' ? 'kd-c-error' : 'kd-c-success'" />
            <div><div class="kd-notice__t">{{ n.title }}</div><div v-if="n.detail" class="kd-notice__d">{{ n.detail }}</div></div>
          </div>
        </div>
      </div>
      <div class="kd-anchor">
        <button type="button" class="kd-tbtn" title="User" aria-label="User" @click.stop="openMenu = openMenu === 'user' ? '' : 'user'"><KIcon name="account" /></button>
        <div v-if="openMenu === 'user'" class="kd-popup" @click.stop>
          <div class="kd-popup__item">Logged in with auth header</div>
          <div class="kd-popup__item kd-popup__dim">{{ contextUser }}@{{ clusterName }}</div>
        </div>
      </div>
    </header>

    <!-- ACTION BAR (breadcrumbs + page actions) -->
    <div class="kd-actionbar">
      <nav class="kd-crumbs" aria-label="Breadcrumbs">
        <template v-for="(crumb, i) in crumbs" :key="i">
          <span v-if="i > 0" class="kd-crumbs__sep"><KIcon name="chevron" :size="20" /></span>
          <a v-if="crumb.to && i < crumbs.length - 1" href="#" class="kd-crumbs__link" @click.prevent="go(crumb.to)">{{ crumb.label }}</a>
          <span v-else class="kd-crumbs__here">{{ crumb.label }}</span>
        </template>
      </nav>
      <span class="kd-toolbar__spacer" />
      <template v-if="route.page === 'detail' && current && currentDef && !currentDef.readOnly">
        <button v-if="currentDef.kind === 'Pod'" type="button" class="kd-abtn" title="View logs" aria-label="View logs" @click="act('logs', current, currentDef)"><KIcon name="logs" /></button>
        <button v-if="currentDef.kind === 'Pod' && current.status === 'Running'" type="button" class="kd-abtn" title="Exec into pod" aria-label="Exec into pod" @click="act('exec', current, currentDef)"><KIcon name="exec" /></button>
        <button v-if="currentDef.scalable" type="button" class="kd-abtn" title="Scale resource" aria-label="Scale resource" @click="act('scale', current, currentDef)"><KIcon name="scale" /></button>
        <button v-if="currentDef.restartable" type="button" class="kd-abtn" title="Restart" aria-label="Restart" @click="act('restart', current, currentDef)"><KIcon name="restart" /></button>
        <button type="button" class="kd-abtn" title="Edit resource" aria-label="Edit resource" @click="act('edit', current, currentDef)"><KIcon name="edit" /></button>
        <button type="button" class="kd-abtn" title="Delete resource" aria-label="Delete resource" @click="act('delete', current, currentDef)"><KIcon name="delete" /></button>
      </template>
      <button v-if="route.page === 'list' && currentDef && QUICK_CREATE.includes(currentDef.kind)" type="button" class="kd-abtn"
              :title="`Create ${currentDef.singular}`" :aria-label="`Create ${currentDef.singular}`"
              @click="dialog = { type: 'create', def: currentDef, row: { name: '' }, namespace }"><KIcon name="add" /></button>
    </div>

    <div class="kd-body">
      <!-- SIDE NAVIGATION -->
      <nav class="kd-nav" aria-label="Navigation">
        <template v-for="section in NAV" :key="section.label">
          <div v-if="section.divider" class="kd-nav__divider" />
          <a href="#" class="kd-nav__group" :class="{ 'is-active': isGroupActive(section) }" @click.prevent="go(section.to); closeNavIfNarrow()">{{ section.label }}</a>
          <a v-for="item in section.items" :key="item.route" href="#" class="kd-nav__item" :class="{ 'is-active': isItemActive(item.route) }"
             @click.prevent="go({ page: 'list', kind: item.route }); closeNavIfNarrow()">{{ item.title }}</a>
        </template>
      </nav>
      <div class="kd-scrim" @click="navOpen = false" />

      <!-- CONTENT -->
      <main ref="content" class="kd-content">
        <KdOverview v-if="route.page === 'overview'" :view="view" :namespace="namespace" :all-namespaces="allNs"
                    :per-page="settings.itemsPerPage" @open="open" @act="(def, p) => act(p.type, p.row, def)"
                    @list="def => go({ page: 'list', kind: def.route })" @create="go({ page: 'create', tab: 'form' })" />

        <template v-else-if="route.page === 'group'">
          <KdTable v-for="def in groupKinds" :key="def.kind" :def="def" :rows="listOf(view, def, namespace)" :all-namespaces="allNs"
                   :per-page="settings.itemsPerPage" @open="r => open(def, r)" @act="p => act(p.type, p.row, def)" />
        </template>

        <template v-else-if="route.page === 'list' && currentDef">
          <KdHelm v-if="currentDef.kind === 'Helm'" :view="view" :namespace="namespace" :api="api" />
          <KdTable v-else :def="currentDef" :rows="listOf(view, currentDef, namespace)" :all-namespaces="allNs"
                   :per-page="settings.itemsPerPage" @open="r => open(currentDef!, r)" @act="p => act(p.type, p.row, currentDef!)" />
        </template>

        <KdHelm v-else-if="route.page === 'helm'" :view="view" :namespace="namespace" :api="api" />

        <template v-else-if="route.page === 'detail'">
          <KdDetail v-if="current && currentDef" :key="detailKey" :view="view" :def="currentDef" :row="current" :api="api"
                    @open="open" @act="onDetailAct" />
          <section v-else class="kd-gone">
            <p>The resource could not be found. It may have been deleted.</p>
            <button type="button" class="kd-linkbtn" @click="go({ page: 'list', kind: route.kind })">Back to the list</button>
          </section>
        </template>

        <KdCreate v-else-if="route.page === 'create'" :key="createKey" :view="view" :namespace="namespace" :api="api" :initial-tab="route.tab"
                  @cancel="back" @done="afterCreate" />

        <template v-else-if="route.page === 'logs' || route.page === 'shell'">
          <KdPodIo v-if="current" :key="route.page + detailKey" :pod="current" :mode="route.page" :api="api" />
          <section v-else class="kd-gone"><p>The pod could not be found.</p></section>
        </template>

        <template v-else-if="route.page === 'search'">
          <section v-if="!searchHits.length" class="kd-gone"><p>There is nothing to display here for "{{ route.q }}".</p></section>
          <KdTable v-for="hit in searchHits" :key="hit.def.kind" :def="hit.def" :rows="hit.rows" :all-namespaces="allNs"
                   :per-page="settings.itemsPerPage" @open="r => open(hit.def, r)" @act="p => act(p.type, p.row, hit.def)" />
        </template>

        <KdMisc v-else-if="route.page === 'settings' || route.page === 'about'" :page="route.page" :view="view" :settings="settings" @save="saveSettings" />
      </main>
    </div>

    <!-- SNACKBARS (the product's notifications) -->
    <div class="kd-snacks" aria-live="polite">
      <div v-for="flash in api.flashes.value.slice(0, 1)" :key="flash.id" class="kd-snack" :class="`is-${flash.type}`">
        <KIcon v-if="flash.type === 'error'" name="error" :size="20" class="kd-snack__icon" />
        <div class="kd-snack__body">
          <div>{{ flash.title }}</div>
          <div v-if="flash.detail" class="kd-snack__detail">{{ flash.detail }}</div>
        </div>
        <button type="button" class="kd-snack__action" @click="api.dismiss(flash.id)">Dismiss</button>
      </div>
    </div>

    <KdDialogs :dialog="dialog" :view="view" :api="api" @close="dialog = null" @deleted="onDeleted" />
  </div>
</template>

<script setup lang="ts">
/**
 * The Kubernetes Dashboard (kubernetes/dashboard v2.7, Angular Material) as a
 * lab portal.
 *
 * Layout as the product draws it: a light primary toolbar (hamburger,
 * Kubernetes logo, namespace selector, search, "+" create, notifications,
 * user), the BLUE action bar under it carrying the breadcrumbs and the page's
 * action icons, the side navigation on the grey #edeff0 page, and white
 * Material cards. Every write is the kubectl command a student could type -
 * see `k8s.ts` - and the read model is `view.dashboard` from the engine.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import KIcon from './KIcon.vue';
import KdCreate from './KdCreate.vue';
import KdDetail from './KdDetail.vue';
import KdDialogs from './KdDialogs.vue';
import KdHelm from './KdHelm.vue';
import KdMisc from './KdMisc.vue';
import KdOverview from './KdOverview.vue';
import KdPodIo from './KdPodIo.vue';
import KdTable from './KdTable.vue';
import { ALL_NAMESPACES, dash, dashboardUrl, describeCommand, findObject, historyCommand, KINDS, kindByKind, kindByRoute,
  listOf, listReadCommand,
  type DialogState, type KdSettings, type KindDef, type Row } from './k8s';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

interface Route { page: string; kind?: string; ns?: string; name?: string; tab?: string; q?: string; group?: string }

const HELM_DEF: KindDef = { kind: 'Helm', route: 'helm', title: 'Helm Releases', singular: 'release', namespaced: true, group: 'crd' };
const QUICK_CREATE = ['Namespace', 'ConfigMap', 'Secret', 'Service', 'CronJob'];

const GROUP_TITLES: Record<string, string> = { workloads: 'Workloads', service: 'Service', config: 'Config and Storage', cluster: 'Cluster' };
const NAV = [
  { label: 'Workloads', to: { page: 'overview' } as Route, group: 'workloads', items: KINDS.filter(k => k.group === 'workloads') },
  { label: 'Service', to: { page: 'group', group: 'service' } as Route, group: 'service', items: KINDS.filter(k => k.group === 'service') },
  { label: 'Config and Storage', to: { page: 'group', group: 'config' } as Route, group: 'config', items: KINDS.filter(k => k.group === 'config') },
  { label: 'Cluster', to: { page: 'group', group: 'cluster' } as Route, group: 'cluster', items: KINDS.filter(k => k.group === 'cluster') },
  { label: 'Custom Resource Definitions', to: { page: 'list', kind: 'customresourcedefinition' } as Route, group: 'crd', items: [] as KindDef[] },
  { label: 'Helm Releases', to: { page: 'helm' } as Route, group: 'helm', items: [] as KindDef[] },
  { label: 'Settings', to: { page: 'settings' } as Route, group: 'settings', items: [] as KindDef[], divider: true },
  { label: 'About', to: { page: 'about' } as Route, group: 'about', items: [] as KindDef[] },
];

const settings = reactive<KdSettings>({ clusterName: '', itemsPerPage: 10, labelsLimit: 3, defaultNamespace: 'default' });
const route = ref<Route>({ page: 'overview' });
const history: Route[] = [];
const namespace = ref<string>(String(dash(props.view).context?.namespace || 'default'));
const searchText = ref('');
const navOpen = ref(true);
const openMenu = ref('');
const dialog = ref<DialogState | null>(null);
const notices = ref<{ id: number; type: string; title: string; detail: string }[]>([]);
const unread = ref(0);
const createKey = ref(0);
const content = ref<HTMLElement | null>(null);

const allNs = computed(() => namespace.value === ALL_NAMESPACES);
const namespaceNames = computed<string[]>(() => ((dash(props.view).namespaces || []) as Row[]).map(n => n.name));
const clusterName = computed(() => settings.clusterName || dash(props.view).cluster || 'kubernetes');
const contextUser = computed(() => dash(props.view).context?.user || 'admin');

const currentDef = computed<KindDef | undefined>(() => {
  if (route.value.kind === 'helm') return HELM_DEF;
  if (route.value.page === 'logs' || route.value.page === 'shell') return kindByRoute('pod');
  return route.value.kind ? kindByRoute(route.value.kind) : undefined;
});
const current = computed<Row | null>(() => {
  const r = route.value;
  if (!['detail', 'logs', 'shell'].includes(r.page) || !currentDef.value || !r.name) return null;
  return findObject(props.view, currentDef.value, r.ns || 'default', r.name);
});
const detailKey = computed(() => `${route.value.kind}/${route.value.ns}/${route.value.name}`);
const groupKinds = computed(() => KINDS.filter(k => k.group === route.value.group));

const searchHits = computed(() => {
  const q = String(route.value.q || '').trim().toLowerCase();
  if (!q) return [];
  return KINDS.filter(k => k.kind !== 'Event').map(def => ({
    def, rows: listOf(props.view, def, namespace.value).filter(r => String(r.name).toLowerCase().includes(q)),
  })).filter(hit => hit.rows.length);
});

const crumbs = computed<{ label: string; to?: Route }[]>(() => {
  const r = route.value;
  const def = currentDef.value;
  const groupCrumb = (d: KindDef) => d.group === 'workloads' ? { label: 'Workloads', to: { page: 'overview' } }
    : d.group === 'crd' ? null : { label: GROUP_TITLES[d.group], to: { page: 'group', group: d.group } };
  switch (r.page) {
    case 'overview': return [{ label: 'Workloads' }];
    case 'group': return [{ label: GROUP_TITLES[r.group || ''] || '' }];
    case 'helm': return [{ label: 'Helm Releases' }];
    case 'list': return def ? [groupCrumb(def), { label: def.title }].filter(Boolean) as { label: string; to?: Route }[] : [];
    case 'detail': return def ? [groupCrumb(def), { label: def.title, to: { page: 'list', kind: def.route } }, { label: r.name || '' }]
      .filter(Boolean) as { label: string; to?: Route }[] : [];
    case 'logs': case 'shell': return [{ label: 'Workloads', to: { page: 'overview' } }, { label: 'Pods', to: { page: 'list', kind: 'pod' } },
      { label: r.name || '', to: { page: 'detail', kind: 'pod', ns: r.ns, name: r.name } }, { label: r.page === 'logs' ? 'Logs' : 'Shell' }];
    case 'create': return [{ label: 'Create new resource' }];
    case 'search': return [{ label: 'Search' }];
    case 'settings': return [{ label: 'Settings' }];
    case 'about': return [{ label: 'About' }];
    default: return [];
  }
});

function locationFor(r: Route): string {
  const ns = namespace.value;
  switch (r.page) {
    case 'overview': return dashboardUrl('workloads', ns);
    case 'group': return dashboardUrl(r.group === 'config' ? 'config' : r.group || 'workloads', ns);
    case 'list': return dashboardUrl(r.kind || 'workloads', ns);
    case 'helm': return dashboardUrl('helm', ns);
    case 'detail': {
      const def = kindByRoute(r.kind || '');
      return def?.namespaced ? dashboardUrl(`${r.kind}/${r.ns}/${r.name}`, ns) : dashboardUrl(`${r.kind}/${r.name}`, ns);
    }
    case 'logs': return dashboardUrl(`log/${r.ns}/${r.name}/pod`, ns);
    case 'shell': return dashboardUrl(`shell/${r.ns}/${r.name}`, ns);
    case 'create': return dashboardUrl('create', ns);
    case 'search': return dashboardUrl('search', ns, `&q=${encodeURIComponent(r.q || '')}`);
    case 'settings': return dashboardUrl('settings', ns);
    case 'about': return dashboardUrl('about', ns);
    default: return dashboardUrl('workloads', ns);
  }
}

function go(next: Route) {
  history.push(route.value);
  if (history.length > 30) history.shift();
  if (next.page === 'create') createKey.value++;
  route.value = { ...next };
  openMenu.value = '';
  if (content.value) content.value.scrollTop = 0;
  void readFor(route.value);
}

/**
 * The GET the real Dashboard makes when a page opens, run as the kubectl read
 * it is equivalent to - so the CLI drawer shows `kubectl get pods -o wide` and
 * `kubectl describe svc web`, and a lab task asking for that read is met
 * whichever surface the student used.
 */
async function readFor(r: Route) {
  const def = r.kind ? kindByRoute(r.kind) : undefined;
  const lines: (string | null)[] = [];
  if (r.page === 'list' && def) lines.push(listReadCommand(def, namespace.value));
  if (r.page === 'detail' && def && r.name) {
    lines.push(describeCommand(def, r.ns || 'default', r.name));
    if (def.kind === 'Deployment') lines.push(historyCommand(r.ns || 'default', r.name));
  }
  for (const line of lines) if (line) await props.api.exec(line, { quiet: true });
}
function back() { route.value = history.pop() || { page: 'overview' }; }

function open(def: KindDef, row: Row) {
  if (def.kind === 'Event' || def.readOnly && ['StorageClass', 'ClusterRole', 'CustomResourceDefinition'].includes(def.kind)) return;
  go({ page: 'detail', kind: def.route, ns: row.namespace || '', name: row.name });
}

function act(type: string, row: Row, def: KindDef, revision?: number) {
  if (type === 'logs' || type === 'exec') {
    go({ page: type === 'logs' ? 'logs' : 'shell', kind: 'pod', ns: row.namespace, name: row.name });
    return;
  }
  dialog.value = { type, def, row, revision };
}
function onDetailAct(payload: { type: string; row: Row; revision?: number }, def?: KindDef) {
  act(payload.type, payload.row, def || currentDef.value!, payload.revision);
}

function onDeleted(d: DialogState) {
  if (route.value.page === 'detail' && route.value.name === d.row.name && currentDef.value?.kind === d.def.kind) {
    go({ page: 'list', kind: d.def.route });
  }
  if (d.def.kind === 'Namespace' && namespace.value === d.row.name) namespace.value = 'default';
}

function afterCreate(target: { kind: string; namespace: string; name?: string }) {
  if (namespace.value !== ALL_NAMESPACES && target.namespace !== namespace.value) namespace.value = target.namespace;
  const def = kindByRoute(target.kind) || kindByKind(target.kind);
  if (def && target.name && def.kind !== 'Namespace') go({ page: 'detail', kind: def.route, ns: target.namespace, name: target.name });
  else if (def) go({ page: 'list', kind: def.route });
  else go({ page: 'overview' });
}

function saveSettings(next: KdSettings) {
  Object.assign(settings, next);
  if (namespaceNames.value.includes(next.defaultNamespace)) namespace.value = next.defaultNamespace;
  props.api.notify('success', 'Settings saved');
}

function isGroupActive(section: { group: string; to: Route }) {
  const r = route.value;
  if (section.group === 'workloads') return r.page === 'overview';
  if (section.group === 'helm') return r.page === 'helm';
  if (r.page === 'group') return r.group === section.group;
  if (section.group === 'crd') return r.page === 'list' && r.kind === 'customresourcedefinition';
  return r.page === section.group;
}
function isItemActive(kindRoute: string) {
  const r = route.value;
  if (r.page === 'logs' || r.page === 'shell') return kindRoute === 'pod';
  return (r.page === 'list' || r.page === 'detail') && r.kind === kindRoute;
}

function closeNavIfNarrow() {
  const el = document.querySelector('.kd-root') as HTMLElement | null;
  if (el && el.clientWidth < 900) navOpen.value = false;
}

watch([route, namespace], () => emit('location', locationFor(route.value)), { immediate: true, deep: true });
watch(namespace, () => { if (route.value.page === 'detail' && !allNs.value && route.value.ns !== namespace.value) go({ page: 'list', kind: route.value.kind }); });

watch(() => props.api.flashes.value.map(f => f.id).join(','), () => {
  for (const flash of props.api.flashes.value) {
    if (!notices.value.some(n => n.id === flash.id)) {
      notices.value = [{ id: flash.id, type: flash.type, title: flash.title, detail: flash.detail }, ...notices.value].slice(0, 20);
      unread.value++;
    }
  }
});

function closeMenus() { openMenu.value = ''; }
onMounted(() => {
  document.addEventListener('click', closeMenus);
  const el = document.querySelector('.kd-root') as HTMLElement | null;
  if (el && el.clientWidth < 900) navOpen.value = false;
});
onBeforeUnmount(() => document.removeEventListener('click', closeMenus));
</script>

<style scoped>
.kd-root {
  --kd-primary: #326de6;
  --kd-primary-hover: #0048ff;
  --kd-success: #008000;
  --kd-warning: #ffad20;
  --kd-error: #ff481b;
  --kd-bg: #edeff0;
  --kd-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.2), 0 1px 1px 0 rgb(0 0 0 / 0.14), 0 2px 1px -1px rgb(0 0 0 / 0.12);
  position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;
  background: var(--kd-bg); color: rgb(0 0 0 / 0.87);
  font-family: Roboto, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 1.43;
}
/* toolbar */
.kd-toolbar { display: flex; align-items: center; gap: 4px; height: 60px; flex: none; padding: 0 8px; background: #fafafa;
  box-shadow: 0 2px 4px -1px rgb(0 0 0 / 0.2), 0 4px 5px 0 rgb(0 0 0 / 0.14), 0 1px 10px 0 rgb(0 0 0 / 0.12); z-index: 5; }
.kd-tbtn { position: relative; width: 40px; height: 40px; flex: none; border: 0; border-radius: 50%; background: transparent; color: #000;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.kd-tbtn:hover { background: rgb(0 0 0 / 0.06); }
.kd-tbtn--primary { color: var(--kd-primary); }
.kd-brand { display: flex; align-items: center; gap: 6px; text-decoration: none; padding: 0 12px 0 4px; flex: none; }
.kd-brand__logo { width: 32px; height: 32px; }
.kd-brand__text { color: var(--kd-primary); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; font-family: Ubuntu, Roboto, 'Helvetica Neue', sans-serif; }
.kd-nsselect { position: relative; display: flex; align-items: center; flex: none; margin: 0 12px; }
.kd-nsselect__box { appearance: none; -webkit-appearance: none; border: 0; border-bottom: 1px solid rgb(0 0 0 / 0.42); background: transparent;
  font: inherit; font-size: 14px; padding: 6px 24px 6px 2px; min-width: 160px; color: rgb(0 0 0 / 0.87); cursor: pointer; outline: 0; }
.kd-nsselect__box:focus { border-bottom: 2px solid var(--kd-primary); }
.kd-nsselect__caret { position: absolute; right: 0; pointer-events: none; color: rgb(0 0 0 / 0.54); }
.kd-search { display: flex; align-items: center; gap: 8px; flex: 0 1 560px; min-width: 120px; height: 40px; padding: 0 12px; margin-left: 8px;
  background: #fff; border-radius: 2px; color: rgb(0 0 0 / 0.54); box-shadow: 0 1px 1px rgb(0 0 0 / 0.12) inset, 0 0 0 1px rgb(0 0 0 / 0.08); }
.kd-search input { flex: 1; min-width: 0; border: 0; outline: 0; font: inherit; font-size: 14px; background: transparent; color: rgb(0 0 0 / 0.87); }
.kd-search input::placeholder { color: rgb(0 0 0 / 0.54); opacity: 1; }
.kd-toolbar__spacer { flex: 1; }
.kd-anchor { position: relative; }
.kd-badge { position: absolute; top: 4px; right: 4px; min-width: 16px; height: 16px; border-radius: 8px; background: var(--kd-error); color: #fff;
  font-size: 10px; line-height: 16px; text-align: center; padding: 0 3px; }
.kd-popup { position: absolute; right: 0; top: 44px; z-index: 40; min-width: 220px; background: #fff; border-radius: 4px; padding: 8px 0;
  box-shadow: 0 2px 4px -1px rgb(0 0 0 / 0.2), 0 4px 5px 0 rgb(0 0 0 / 0.14), 0 1px 10px 0 rgb(0 0 0 / 0.12); }
.kd-popup--bell { width: 340px; max-height: 360px; overflow: auto; }
.kd-popup__head { display: flex; justify-content: space-between; align-items: center; padding: 4px 16px 8px; font-weight: 500; border-bottom: 1px solid rgb(0 0 0 / 0.12); }
.kd-popup__empty, .kd-popup__item { padding: 12px 16px; font-size: 14px; }
.kd-popup__dim { color: rgb(0 0 0 / 0.54); font-size: 12px; padding-top: 0; }
.kd-notice { display: flex; gap: 10px; padding: 10px 16px; border-bottom: 1px solid rgb(0 0 0 / 0.06); }
.kd-notice__t { font-size: 14px; }
.kd-notice__d { font-size: 12px; color: rgb(0 0 0 / 0.54); word-break: break-word; }
.kd-c-error { color: var(--kd-error); }
.kd-c-success { color: var(--kd-success); }
.kd-linkbtn { border: 0; background: none; color: var(--kd-primary); font: inherit; cursor: pointer; padding: 0; }
/* action bar */
.kd-actionbar { display: flex; align-items: center; height: 48px; flex: none; padding: 0 8px 0 20px; background: var(--kd-primary); color: #fff; z-index: 4; }
.kd-crumbs { display: flex; align-items: center; min-width: 0; overflow: hidden; white-space: nowrap; font-size: 20px; }
.kd-crumbs__link { color: rgb(255 255 255 / 0.8); text-decoration: none; }
.kd-crumbs__link:hover { color: #fff; text-decoration: underline; }
.kd-crumbs__here { color: #fff; overflow: hidden; text-overflow: ellipsis; }
.kd-crumbs__sep { display: inline-flex; color: rgb(255 255 255 / 0.7); margin: 0 2px; }
.kd-abtn { width: 40px; height: 40px; flex: none; border: 0; border-radius: 50%; background: transparent; color: #fff; display: inline-flex;
  align-items: center; justify-content: center; cursor: pointer; }
.kd-abtn:hover { background: rgb(255 255 255 / 0.12); }
/* body */
.kd-body { position: relative; display: flex; flex: 1; min-height: 0; }
.kd-nav { width: 248px; flex: none; overflow-y: auto; padding: 20px 3px 20px 20px; font-size: 14px; display: none; flex-direction: column; }
.nav-open .kd-nav { display: flex; }
.kd-nav__group { display: block; padding: 6px 0; margin-top: 4px; color: rgb(0 0 0 / 0.87); font-weight: 500; text-decoration: none; }
.kd-nav__item { display: block; padding: 5px 0 5px 12px; color: rgb(0 0 0 / 0.87); text-decoration: none; white-space: nowrap; }
.kd-nav__group:hover, .kd-nav__item:hover { color: var(--kd-primary); }
.kd-nav__group.is-active, .kd-nav__item.is-active { color: var(--kd-primary); font-weight: 500; }
.kd-nav__divider { height: 1px; background: rgb(0 0 0 / 0.12); margin: 8px 8px 12px -20px; }
.kd-scrim { display: none; }
.kd-content { flex: 1; min-width: 0; overflow: auto; padding: 20px; }
.kd-gone { background: #fff; box-shadow: var(--kd-shadow); padding: 24px; }
/* snackbars */
.kd-snacks { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 70; display: flex; flex-direction: column; gap: 8px;
  width: min(568px, calc(100% - 32px)); pointer-events: none; }
.kd-snack { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 6px 8px 6px 16px; background: #323232; color: #fff;
  border-radius: 4px; pointer-events: auto; box-shadow: 0 3px 5px -1px rgb(0 0 0 / 0.2), 0 6px 10px 0 rgb(0 0 0 / 0.14), 0 1px 18px 0 rgb(0 0 0 / 0.12); }
.kd-snack__icon { color: #ff8a65; }
.kd-snack__body { flex: 1; font-size: 14px; min-width: 0; word-break: break-word; }
.kd-snack__detail { font-size: 12px; color: rgb(255 255 255 / 0.7); margin-top: 2px; }
.kd-snack__action { border: 0; background: none; color: #82b1ff; font: inherit; font-weight: 500; text-transform: uppercase; cursor: pointer; padding: 8px; }
/* narrow frames */
@container sl-portal (max-width: 900px) {
  .kd-nav { position: absolute; inset: 0 auto 0 0; z-index: 20; background: #fff; box-shadow: 2px 0 8px rgb(0 0 0 / 0.2); }
  .nav-open .kd-scrim { display: block; position: absolute; inset: 0; z-index: 15; background: rgb(0 0 0 / 0.32); }
  .kd-search { flex: 1 1 auto; }
}
@container sl-portal (max-width: 640px) {
  .kd-brand__text { display: none; }
  .kd-nsselect { margin: 0 4px; }
  .kd-nsselect__box { min-width: 0; max-width: 110px; }
  .kd-search { margin-left: 4px; min-width: 40px; padding: 0 8px; }
  .kd-crumbs { font-size: 16px; }
  .kd-content { padding: 12px 8px; }
  .kd-actionbar { padding-left: 12px; }
}
@container sl-portal (max-width: 440px) {
  .kd-search input { width: 0; }
  .kd-search { flex: 0 0 40px; }
  .kd-toolbar { gap: 0; padding: 0 2px; }
}
</style>
