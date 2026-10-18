<template>
  <div ref="rootEl" class="az-root" dir="ltr" :class="{ 'is-narrow': narrow }" @click="onRootClick">
    <!-- ===== Page header (masthead) ===== -->
    <header class="az-mast">
      <button type="button" class="az-mast__btn az-mast__menu" title="Show portal menu"
              aria-label="Show portal menu" @click="menuOpen = !menuOpen">
        <AzIcon name="menu" :size="18" />
      </button>
      <button type="button" class="az-mast__brand" @click="go({ page: 'home' })">Microsoft Azure</button>
      <div class="az-search" :class="{ 'is-open': searchOpen }">
        <AzIcon name="search" :size="15" class="az-search__icon" />
        <input ref="searchInput" v-model="searchText" class="az-search__input" type="search"
               placeholder="Search resources, services, and docs (G+/)"
               aria-label="Search resources, services, and docs"
               @focus="searchOpen = true" @keydown.escape="closeSearch"
               @keydown.enter.prevent="pickFirst" />
        <div v-if="searchOpen" class="az-search__drop" @mousedown.prevent>
          <template v-if="searchHits.services.length || searchHits.resources.length || searchHits.groups.length">
            <div v-if="searchHits.services.length" class="az-search__sec">
              <div class="az-search__head">Services</div>
              <button v-for="s in searchHits.services" :key="s.key" type="button" class="az-search__hit"
                      @click="openService(s)">
                <AzIcon :name="s.icon" /> <span>{{ s.label }}</span>
              </button>
            </div>
            <div v-if="searchHits.resources.length" class="az-search__sec">
              <div class="az-search__head">Resources</div>
              <button v-for="r in searchHits.resources" :key="r.id" type="button" class="az-search__hit"
                      @click="openRes(r)">
                <AzIcon :name="meta(r.kind).icon" /> <span>{{ r.name }}</span>
                <span class="az-search__type">{{ meta(r.kind).singular }}</span>
              </button>
            </div>
            <div v-if="searchHits.groups.length" class="az-search__sec">
              <div class="az-search__head">Resource Groups</div>
              <button v-for="g in searchHits.groups" :key="g.id" type="button" class="az-search__hit"
                      @click="openGroup(g.name)">
                <AzIcon name="group" /> <span>{{ g.name }}</span>
              </button>
            </div>
          </template>
          <div v-else class="az-search__none">
            {{ searchText ? `No results were found for "${searchText}".` : 'Type to search resources, services and resource groups.' }}
          </div>
        </div>
      </div>
      <div class="az-mast__tools">
        <button type="button" class="az-mast__btn az-mast__hide-s" title="Copilot" aria-label="Copilot"
                @click="togglePanel('copilot')"><AzIcon name="copilot" :size="18" /></button>
        <button type="button" class="az-mast__btn az-mast__hide-s" title="Cloud Shell" aria-label="Cloud Shell"
                @click="togglePanel('shell')"><AzIcon name="shell" :size="18" /></button>
        <button type="button" class="az-mast__btn az-mast__bell" title="Notifications"
                aria-label="Notifications" @click="togglePanel('notes')">
          <AzIcon name="bell" :size="18" />
          <span v-if="unread" class="az-mast__badge">{{ unread }}</span>
        </button>
        <button type="button" class="az-mast__btn az-mast__hide-n" title="Settings" aria-label="Settings"
                @click="togglePanel('settings')"><AzIcon name="gear" :size="18" /></button>
        <button type="button" class="az-mast__btn az-mast__hide-n" title="Support + Troubleshooting"
                aria-label="Support + Troubleshooting" @click="togglePanel('help')">
          <AzIcon name="help" :size="18" /></button>
        <button type="button" class="az-mast__btn az-mast__hide-n" title="Feedback" aria-label="Feedback"
                @click="togglePanel('feedback')"><AzIcon name="feedback" :size="18" /></button>
        <!-- narrow frames: the buttons that no longer fit go behind "..." as the portal does -->
        <div class="az-mast__morewrap">
          <button type="button" class="az-mast__btn az-mast__more" title="More" aria-label="More"
                  :aria-expanded="moreOpen" @click.stop="moreOpen = !moreOpen"><AzIcon name="more" :size="18" /></button>
          <div v-if="moreOpen" class="az-mast__moremenu" role="menu" @click.stop>
            <button v-for="m in MORE" :key="m.key" type="button" role="menuitem" class="az-mast__moreitem"
                    :class="'is-' + m.key" @click="moreOpen = false; togglePanel(m.key)">
              <AzIcon :name="m.icon" :size="16" /> <span>{{ m.label }}</span></button>
          </div>
        </div>
        <button type="button" class="az-mast__acct" title="Account" @click="togglePanel('account')">
          <span class="az-mast__who">
            <span class="az-mast__user">{{ account.user }}</span>
            <span class="az-mast__dir">{{ String(account.directory || '').toUpperCase() }}</span>
          </span>
          <span class="az-mast__avatar">LS</span>
        </button>
      </div>
    </header>

    <div class="az-body">
      <!-- ===== Portal menu (flyout) ===== -->
      <transition name="az-fly">
        <nav v-if="menuOpen" class="az-menu" aria-label="Portal menu">
          <button type="button" class="az-menu__item az-menu__create" @click="nav({ page: 'create', kind: 'marketplace' })">
            <AzIcon name="plus" :size="18" /> <span>Create a resource</span>
          </button>
          <button type="button" class="az-menu__item" @click="nav({ page: 'home' })">
            <AzIcon name="home" :size="18" /> <span>Home</span></button>
          <button type="button" class="az-menu__item" @click="nav({ page: 'dashboard' })">
            <AzIcon name="dashboard" :size="18" /> <span>Dashboard</span></button>
          <button type="button" class="az-menu__item" @click="nav({ page: 'services' })">
            <AzIcon name="allservices" :size="18" /> <span>All services</span></button>
          <div class="az-menu__sep">
            <AzIcon name="favorites" :size="18" /> <span>FAVORITES</span>
          </div>
          <button v-for="f in favorites" :key="f.key" type="button" class="az-menu__item"
                  :class="{ 'is-active': isActive(f) }" @click="openService(f)">
            <AzIcon :name="f.icon" :size="18" /> <span>{{ f.label }}</span>
          </button>
        </nav>
      </transition>
      <div v-if="menuOpen" class="az-menu__scrim" @click="menuOpen = false"></div>

      <!-- ===== Working area ===== -->
      <main class="az-main" @click="closeSearch">
        <nav v-if="crumbs.length" class="az-crumbs" aria-label="Breadcrumb">
          <template v-for="(c, i) in crumbs" :key="i">
            <button type="button" class="az-crumbs__link" @click="go(c.route)">{{ c.label }}</button>
            <AzIcon name="chevron" :size="10" class="az-crumbs__sep" />
          </template>
        </nav>
        <div class="az-page">
          <HomePage v-if="route.page === 'home'" />
          <AllServices v-else-if="route.page === 'services'" />
          <DashboardPage v-else-if="route.page === 'dashboard'" />
          <BrowseBlade v-else-if="route.page === 'browse'" :key="'b' + route.kind" />
          <GroupBlade v-else-if="route.page === 'group'" :key="'g' + route.name" />
          <ResourceBlade v-else-if="route.page === 'resource'" :key="'r' + route.id" />
          <CreateWizard v-else-if="route.page === 'create'" :key="'c' + route.kind + (route.group || '')" />
          <DeploymentBlade v-else-if="route.page === 'deploy'" :key="'d' + (route.name || '')" />
          <ServiceBlade v-else-if="route.page === 'service'" :key="'s' + route.name" />
        </div>
      </main>

      <!-- ===== Flyout panes from the header ===== -->
      <aside v-if="panel" class="az-flyout" :aria-label="panelTitle">
        <div class="az-flyout__head">
          <h2>{{ panelTitle }}</h2>
          <button type="button" class="az-x" aria-label="Close" @click="panel = ''"><AzIcon name="close" /></button>
        </div>
        <div class="az-flyout__body">
          <template v-if="panel === 'notes'">
            <div class="az-notes__bar">
              <span>{{ notes.length ? 'More events in the activity log →' : '' }}</span>
              <button v-if="notes.length" type="button" class="az-link" @click="dismissAll">Dismiss all</button>
            </div>
            <div v-if="!notes.length" class="az-empty az-empty--small">No new notifications from this session.</div>
            <div v-for="n in notes" :key="n.id" class="az-note" :class="'is-' + n.type">
              <AzIcon :name="n.type === 'success' ? 'ok' : n.type === 'error' ? 'error' : n.type === 'progress' ? 'spinner' : 'infofill'" :size="16" />
              <div class="az-note__body">
                <div class="az-note__title">{{ n.title }}</div>
                <div v-if="n.detail" class="az-note__detail">{{ n.detail }}</div>
                <div class="az-note__time">{{ ago(n.at) }}</div>
              </div>
              <button type="button" class="az-x" aria-label="Dismiss" @click="dropNote(n.id)"><AzIcon name="close" :size="12" /></button>
            </div>
          </template>
          <template v-else-if="panel === 'shell'">
            <p class="az-p">Cloud Shell in this lab is the <strong>Azure CLI</strong> console beside the portal.
              Every action you take here is the <code>az</code> command it ran — open the
              equivalent-CLI strip below the portal to copy one.</p>
            <div class="az-section-title">Recent commands from the portal</div>
            <div v-if="!api.history.value.length" class="az-empty az-empty--small">Nothing yet.</div>
            <pre v-for="h in api.history.value.slice(0, 8)" :key="h.id" class="az-code" :class="{ 'is-bad': !h.ok }">{{ h.command }}</pre>
          </template>
          <template v-else-if="panel === 'account'">
            <div class="az-acct">
              <span class="az-mast__avatar az-mast__avatar--big">LS</span>
              <div>
                <div class="az-acct__name">Lab Student</div>
                <div class="az-acct__mail">{{ account.user }}</div>
                <button type="button" class="az-link" disabled>View account</button>
              </div>
            </div>
            <div class="az-section-title">Directory</div>
            <div class="az-kv"><span>Directory</span><span>{{ account.directory }} ({{ account.domain }})</span></div>
            <div class="az-kv"><span>Tenant ID</span><span class="az-mono">{{ account.tenant }}</span></div>
            <button type="button" class="az-link" disabled>Switch directory</button>
            <button type="button" class="az-link az-acct__out" disabled>Sign out</button>
          </template>
          <template v-else-if="panel === 'settings'">
            <div class="az-section-title">Portal settings</div>
            <div class="az-kv"><span>Directory</span><span>{{ account.directory }}</span></div>
            <div class="az-kv"><span>Default subscription</span><span>{{ account.subscription_name }}</span></div>
            <div class="az-kv"><span>Theme</span><span>Light</span></div>
            <div class="az-kv"><span>Language</span><span>English</span></div>
            <div class="az-kv"><span>Portal menu behavior</span><span>Flyout</span></div>
          </template>
          <template v-else-if="panel === 'help'">
            <p class="az-p"><strong>Support + Troubleshooting</strong></p>
            <p class="az-p">This portal is a simulation of the Azure portal running on the lab's own
              subscription model. The tool header says exactly what is and is not modelled.</p>
            <p class="az-p az-muted">{{ tool.fidelity }}</p>
          </template>
          <template v-else-if="panel === 'feedback'">
            <p class="az-p">Send us feedback</p>
            <p class="az-p az-muted">Feedback is not collected in this lab.</p>
          </template>
          <template v-else-if="panel === 'copilot'">
            <p class="az-p"><strong>Microsoft Copilot in Azure</strong></p>
            <p class="az-p az-muted">Copilot is not available in this lab. Use the AI tutor tab of the lab instead.</p>
          </template>
        </div>
      </aside>
    </div>

    <!-- ===== Toasts (the portal's notification pop-ups, top right) ===== -->
    <div class="az-toasts" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="az-toast" :class="'is-' + f.type">
        <AzIcon :name="f.type === 'success' ? 'ok' : f.type === 'error' ? 'error' : f.type === 'warning' ? 'warning' : 'infofill'" :size="16" />
        <div class="az-toast__body">
          <div class="az-toast__title">{{ f.title }}</div>
          <div v-if="f.detail" class="az-toast__detail">{{ f.detail }}</div>
          <div class="az-toast__time">a few seconds ago</div>
        </div>
        <button type="button" class="az-x" aria-label="Dismiss" @click="api.dismiss(f.id)"><AzIcon name="close" :size="12" /></button>
      </div>
    </div>

    <!-- ===== Confirmation dialog ===== -->
    <div v-if="dialog" class="az-modal" role="dialog" aria-modal="true" :aria-label="dialog.title">
      <div class="az-modal__card">
        <div class="az-modal__head">
          <h2>{{ dialog.title }}</h2>
          <button type="button" class="az-x" aria-label="Close" @click="answer(false)"><AzIcon name="close" /></button>
        </div>
        <div class="az-modal__body">
          <div v-if="dialog.danger" class="az-banner is-warning">
            <AzIcon name="warning" :size="16" /><span>{{ dialog.message }}</span>
          </div>
          <p v-else class="az-p">{{ dialog.message }}</p>
          <ul v-if="dialog.items && dialog.items.length" class="az-modal__list">
            <li v-for="item in dialog.items.slice(0, 12)" :key="item">{{ item }}</li>
            <li v-if="dialog.items.length > 12" class="az-muted">and {{ dialog.items.length - 12 }} more</li>
          </ul>
          <label v-if="dialog.typeToConfirm" class="az-modal__type">
            <span class="az-label">{{ dialog.typeLabel || 'Enter resource name to confirm deletion' }} <span class="az-req">*</span></span>
            <input v-model="typed" class="az-input" :placeholder="dialog.typeToConfirm" />
          </label>
        </div>
        <div class="az-modal__foot">
          <button type="button" class="az-btn" :class="dialog.danger ? 'az-btn--danger' : 'az-btn--primary'"
                  :disabled="Boolean(dialog.typeToConfirm) && typed !== dialog.typeToConfirm" @click="answer(true)">
            {{ dialog.confirmLabel || 'Delete' }}</button>
          <button type="button" class="az-btn" @click="answer(false)">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Azure portal: masthead, portal menu, breadcrumb, notifications, and a
 * tiny router over the blades. Every blade reads the context provided here
 * (`AZ` in azure.ts) and writes by running the `az` command line through
 * `api.exec` - so the console beside the portal and the portal can never
 * disagree.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { pick, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import {
  AZ, browseUrl, KINDS, meta, PORTAL, resourceUrl,
  type AzCtx, type AzNote, type AzRoute, type ConfirmOptions,
} from './azure';
import { SERVICES, type ServiceEntry } from './services';
import HomePage from './HomePage.vue';
import AllServices from './AllServices.vue';
import DashboardPage from './DashboardPage.vue';
import BrowseBlade from './BrowseBlade.vue';
import GroupBlade from './GroupBlade.vue';
import ResourceBlade from './ResourceBlade.vue';
import CreateWizard from './CreateWizard.vue';
import DeploymentBlade from './DeploymentBlade.vue';
import ServiceBlade from './ServiceBlade.vue';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const route = ref<AzRoute>({ page: 'home' });
const stack = ref<AzRoute[]>([]);
const menuOpen = ref(false);
const panel = ref('');
const searchText = ref('');
const searchOpen = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const notes = ref<AzNote[]>([]);
const narrow = ref(false);
let seq = 0;

const p = computed<Record<string, any>>(() => pick(props.view, 'portal', {}));
const v = computed<Record<string, any>>(() => props.view || {});
const account = computed<Record<string, any>>(() => pick(p.value, 'account', {}));
const unread = computed(() => notes.value.filter(n => !n.read).length);
const busy = computed(() => Boolean(props.busy) || props.api.busy.value);

const favorites = SERVICES.filter(s => s.favorite);

function go(next: AzRoute) {
  stack.value = [...stack.value, route.value].slice(-30);
  route.value = { ...next };
  menuOpen.value = false;
  panel.value = '';
  searchOpen.value = false;
  // leaving a page through the search box must not leave the (collapsed) box focused
  if (document.activeElement === searchInput.value) searchInput.value?.blur();
}
function nav(next: AzRoute) { go(next); }
function back() {
  const prev = stack.value[stack.value.length - 1];
  stack.value = stack.value.slice(0, -1);
  route.value = prev || { page: 'home' };
}

function note(type: AzNote['type'], title: string, detail = '') {
  notes.value = [{ id: ++seq, type, title, detail, at: Date.now(), read: panel.value === 'notes' },
    ...notes.value].slice(0, 30);
}
function dropNote(id: number) { notes.value = notes.value.filter(n => n.id !== id); }
function dismissAll() { notes.value = []; }

async function run(command: string, success = '', options: { quiet?: boolean; note?: string } = {}) {
  const result = await props.api.exec(command, { success, quiet: options.quiet });
  if (result.ok && (options.note || success)) note('success', options.note || success);
  if (!result.ok) note('error', 'The operation failed', String(result.error || result.output || '').split('\n')[0]);
  return result;
}

const dialog = ref<ConfirmOptions | null>(null);
const typed = ref('');
let resolver: ((value: boolean) => void) | null = null;
function confirm(options: ConfirmOptions): Promise<boolean> {
  dialog.value = options;
  typed.value = '';
  return new Promise(resolve => { resolver = resolve; });
}
function answer(yes: boolean) {
  dialog.value = null;
  const done = resolver;
  resolver = null;
  if (done) done(yes);
}

provide(AZ, { p, v, api: props.api, route, busy, go, back, run, confirm, note,
              refresh: () => emit('refresh') } as AzCtx);

// ----- search -----
const searchHits = computed(() => {
  const q = searchText.value.trim().toLowerCase();
  if (!q) {
    return { services: SERVICES.filter(s => s.favorite).slice(0, 6),
             resources: rows(p.value, 'resources').slice(0, 5), groups: [] as Record<string, any>[] };
  }
  return {
    services: SERVICES.filter(s => s.label.toLowerCase().includes(q)
      || (s.keywords || '').includes(q)).slice(0, 6),
    resources: rows(p.value, 'resources').filter(r => String(r.name).toLowerCase().includes(q)).slice(0, 8),
    groups: rows(p.value, 'groups').filter(g => String(g.name).toLowerCase().includes(q)).slice(0, 5),
  };
});
function closeSearch() { searchOpen.value = false; }
function openService(s: ServiceEntry) {
  searchText.value = '';
  go(s.route);
}
function openRes(r: Record<string, any>) { searchText.value = ''; go({ page: 'resource', id: r.id }); }
function openGroup(name: string) { searchText.value = ''; go({ page: 'group', name }); }
function pickFirst() {
  const hits = searchHits.value;
  const q = searchText.value.trim().toLowerCase();
  // An exact name wins over "the first thing that contains it": typing
  // vm-web-01 must not open vm-web-01VNET.
  const exactRes = hits.resources.find(r => String(r.name).toLowerCase() === q);
  const exactGroup = hits.groups.find(g => String(g.name).toLowerCase() === q);
  const exactSvc = hits.services.find(s => s.label.toLowerCase() === q);
  if (exactSvc) openService(exactSvc);
  else if (exactRes) openRes(exactRes);
  else if (exactGroup) openGroup(exactGroup.name);
  else if (hits.services[0]) openService(hits.services[0]);
  else if (hits.resources[0]) openRes(hits.resources[0]);
  else if (hits.groups[0]) openGroup(hits.groups[0].name);
}
function isActive(s: ServiceEntry) {
  const r = route.value;
  return r.page === s.route.page && r.kind === s.route.kind && r.name === s.route.name;
}

// On a narrow frame a blade's left menu collapses to its current entry (CSS
// below); pressing that entry opens the full list, picking any entry closes it.
// The class is toggled on the DOM node itself: every blade renders its <nav>
// with a static class, so Vue never patches it back.
function onRootClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const item = target?.closest?.('.az-svcmenu__item');
  const nav = item?.closest('.az-svcmenu') as HTMLElement | null;
  if (moreOpen.value && !target?.closest?.('.az-mast__morewrap')) moreOpen.value = false;
  const tabEl = target?.closest?.('.az-tab') as HTMLElement | null;
  if (tabEl) revealTab(tabEl);
  if (!item || !nav) return;
  const collapsible = getComputedStyle(nav).getPropertyValue('--az-menu-collapse').trim() === '1';
  if (collapsible && item.classList.contains('is-active') && !nav.classList.contains('is-open')) nav.classList.add('is-open');
  else nav.classList.remove('is-open');
}

/** A tab strip scrolls sideways on a phone: keep the tab just picked fully in view. */
function revealTab(tab: HTMLElement) {
  const strip = tab.parentElement;
  if (!strip || strip.scrollWidth <= strip.clientWidth) return;
  const t = tab.getBoundingClientRect();
  const sr = strip.getBoundingClientRect();
  if (t.left < sr.left) strip.scrollLeft -= sr.left - t.left + 16;
  else if (t.right > sr.right) strip.scrollLeft += t.right - sr.right + 16;
}

const moreOpen = ref(false);
const MORE = [
  { key: 'copilot', label: 'Copilot', icon: 'copilot' }, { key: 'shell', label: 'Cloud Shell', icon: 'shell' },
  { key: 'settings', label: 'Settings', icon: 'gear' }, { key: 'help', label: 'Support + Troubleshooting', icon: 'help' },
  { key: 'feedback', label: 'Feedback', icon: 'feedback' },
];
function togglePanel(name: string) {
  moreOpen.value = false;
  panel.value = panel.value === name ? '' : name;
  if (name === 'notes') notes.value = notes.value.map(n => ({ ...n, read: true }));
}
const panelTitle = computed(() => ({
  notes: 'Notifications', shell: 'Cloud Shell', account: 'Account', settings: 'Settings',
  help: 'Support + Troubleshooting', feedback: 'Send us feedback', copilot: 'Copilot',
} as Record<string, string>)[panel.value] || '');

function ago(at: number) {
  const s = Math.max(1, Math.round((Date.now() - at) / 1000));
  if (s < 60) return 'a few seconds ago';
  const m = Math.round(s / 60);
  return m === 1 ? 'a minute ago' : `${m} minutes ago`;
}

// ----- breadcrumb -----
const crumbs = computed(() => {
  const r = route.value;
  const home = { label: 'Home', route: { page: 'home' } as AzRoute };
  const out: { label: string; route: AzRoute }[] = [];
  if (r.page === 'home') return out;
  out.push(home);
  if (r.page === 'browse' || r.page === 'services' || r.page === 'dashboard') return out;
  if (r.page === 'group') {
    out.push({ label: 'Resource groups', route: { page: 'browse', kind: 'groups' } });
    return out;
  }
  if (r.page === 'resource') {
    const res = rows(p.value, 'resources').find(x => x.id === r.id);
    if (res) {
      out.push({ label: 'Resource groups', route: { page: 'browse', kind: 'groups' } });
      out.push({ label: String(res.group), route: { page: 'group', name: res.group } });
    }
    return out;
  }
  if (r.page === 'create' && r.group) {
    out.push({ label: r.group, route: { page: 'group', name: r.group } });
  } else if (r.page === 'create' && r.kind && r.kind !== 'marketplace') {
    out.push({ label: r.kind === 'group' ? 'Resource groups' : meta(r.kind).plural,
               route: { page: 'browse', kind: r.kind === 'group' ? 'groups' : r.kind } });
  }
  return out;
});

// ----- the address bar -----
const location = computed(() => {
  const r = route.value;
  switch (r.page) {
    case 'home': return `${PORTAL}/#home`;
    case 'services': return `${PORTAL}/#allservices/category/All`;
    case 'dashboard': return `${PORTAL}/#dashboard`;
    case 'browse': return browseUrl(r.kind || 'all');
    case 'group': {
      const sub = account.value.subscription;
      return `${PORTAL}/${'#@selfstudy.jo'}/resource/subscriptions/${sub}/resourceGroups/${r.name}/${r.tab || 'overview'}`;
    }
    case 'resource': return resourceUrl(String(r.id || ''), r.tab || 'overview');
    case 'create':
      if (r.kind === 'marketplace') return `${PORTAL}/#create/hub`;
      if (r.kind === 'group') return `${PORTAL}/#create/Microsoft.ResourceGroup`;
      return `${PORTAL}/#create/${(KINDS[r.kind || ''] || {}).market || r.kind}`;
    case 'deploy': return `${PORTAL}/#view/HubsExtension/DeploymentDetailsBlade/~/overview/id/${encodeURIComponent(String(r.id || ''))}`;
    case 'service': {
      const s = SERVICES.find(x => x.route.page === 'service' && x.route.name === r.name);
      return s?.url ? `${PORTAL}/${s.url}${r.tab ? '/' + r.tab : ''}` : `${PORTAL}/#home`;
    }
    default: return `${PORTAL}/#home`;
  }
});
watch(location, url => emit('location', url), { immediate: true });
// A new page or a new menu entry starts at the top, as the portal's blades do:
// the working area is one scroller shared by every blade, so without this the
// next page opened at whatever depth the last one had been scrolled to.
watch(() => [route.value.page, route.value.kind, route.value.name, route.value.id, route.value.tab].join('|'), () => {
  nextTick(() => { const page = rootEl.value?.querySelector('.az-page'); if (page) page.scrollTop = 0; });
});

// ----- G+/ shortcut, and a narrow-frame mode the menu reads -----
let observer: ResizeObserver | null = null;
const rootEl = ref<HTMLElement | null>(null);
function onKey(event: KeyboardEvent) {
  if (event.key === '/' && (event.target as HTMLElement)?.tagName !== 'INPUT'
      && (event.target as HTMLElement)?.tagName !== 'TEXTAREA') {
    event.preventDefault();
    searchOpen.value = true;
    nextTick(() => searchInput.value?.focus());
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey);
  if (rootEl.value && 'ResizeObserver' in window) {
    observer = new ResizeObserver(entries => { narrow.value = entries[0].contentRect.width < 700; });
    observer.observe(rootEl.value);
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  observer?.disconnect();
});
</script>

<style scoped>
/* ======================================================================
   Fluent 2 tokens, as the Azure portal spends them. Light theme.
   ====================================================================== */
.az-root {
  --az-brand: #0f6cbd;
  --az-brand-hover: #115ea3;
  --az-brand-press: #0c3b5e;
  --az-brand-bg: #ebf3fc;
  --az-mast: #1f1f1f;
  --az-mast-hover: #383838;
  --az-fg: #242424;
  --az-fg2: #424242;
  --az-fg3: #616161;
  --az-fg4: #707070;
  --az-bg: #ffffff;
  --az-bg2: #fafafa;
  --az-bg3: #f5f5f5;
  --az-hover: #f5f5f5;
  --az-press: #e0e0e0;
  --az-sel: #ebf3fc;
  --az-stroke: #d1d1d1;
  --az-stroke2: #e0e0e0;
  --az-stroke3: #f0f0f0;
  --az-link: #115ea3;
  --az-danger: #c50f1f;
  --az-danger-bg: #fdf3f4;
  --az-ok: #107c10;
  --az-ok-bg: #f1faf1;
  --az-warn: #bc4b09;
  --az-warn-bg: #fff9f5;
  --az-info-bg: #ebf3fc;
  --az-radius: 4px;
  --az-shadow4: 0 0 2px rgba(0, 0, 0, .12), 0 2px 4px rgba(0, 0, 0, .14);
  --az-shadow16: 0 0 2px rgba(0, 0, 0, .12), 0 8px 16px rgba(0, 0, 0, .14);
  --az-shadow28: 0 0 8px rgba(0, 0, 0, .12), 0 14px 28px rgba(0, 0, 0, .14);
  --az-font: 'Segoe UI Variable Text', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto,
             'Helvetica Neue', Arial, sans-serif;
  color-scheme: light;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--az-bg);
  color: var(--az-fg);
  font-family: var(--az-font);
  font-size: 13px;
  line-height: 1.385;
  overflow: hidden;
  overflow: clip;   /* hidden can still be scrolled by focus()/scrollIntoView, which slid the masthead away */
}
.az-root *, .az-root :deep(*) { box-sizing: border-box; }

/* ----- masthead ----- */
.az-mast {
  position: relative; flex: none; display: flex; align-items: center; gap: 2px; height: 40px;
  padding: 0 4px 0 0; background: var(--az-mast); color: #fff;
}
.az-mast__btn {
  position: relative; display: grid; place-items: center; width: 40px; height: 40px;
  background: transparent; border: 0; color: #fff; cursor: pointer;
}
.az-mast__btn:hover, .az-mast__acct:hover, .az-mast__brand:hover { background: var(--az-mast-hover); }
.az-mast__brand {
  height: 40px; padding: 0 12px 0 4px; background: none; border: 0; color: #fff;
  font: 600 15px var(--az-font); cursor: pointer; white-space: nowrap;
}
.az-mast__tools { display: flex; align-items: center; margin-left: auto; }
.az-mast__morewrap { position: relative; display: none; }
.az-mast__moremenu { position: absolute; z-index: 60; top: 40px; right: 0; min-width: 230px; padding: 4px 0; background: #fff;
  border-radius: var(--az-radius); box-shadow: var(--az-shadow16); }
.az-mast__moreitem { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 36px; padding: 0 14px; border: 0;
  background: none; color: var(--az-fg); font: 13px var(--az-font); text-align: left; cursor: pointer; }
.az-mast__moreitem:hover { background: var(--az-hover); }
.az-mast__badge {
  position: absolute; top: 5px; right: 4px; min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 8px; background: #0f6cbd; color: #fff; font-size: 12px; font-weight: 600; line-height: 16px;
}
.az-mast__acct {
  display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 6px 0 10px;
  background: none; border: 0; color: #fff; cursor: pointer; text-align: right;
}
.az-mast__who { display: flex; flex-direction: column; line-height: 1.15; }
.az-mast__user { font-size: 12px; }
.az-mast__dir { font-size: 12px; color: #c8c8c8; letter-spacing: .02em; }
.az-mast__avatar {
  display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
  background: #6b4ea0; color: #fff; font-size: 12px; font-weight: 600;
}
.az-mast__avatar--big { width: 64px; height: 64px; font-size: 22px; }
.az-search { position: relative; flex: 1 1 auto; max-width: 560px; margin: 0 auto; }
.az-search__icon { position: absolute; left: 10px; top: 8px; color: #616161; }
.az-search__input {
  width: 100%; height: 30px; padding: 0 10px 0 34px; border: 1px solid transparent;
  border-radius: var(--az-radius); background: #fff; color: var(--az-fg); font: 13px var(--az-font);
}
.az-search__input::placeholder { color: #707070; }
.az-search__input:focus { outline: none; box-shadow: inset 0 0 0 2px var(--az-brand); }
.az-search__drop {
  position: absolute; top: 34px; left: 0; right: 0; z-index: 50; max-height: 420px; overflow: auto;
  background: #fff; color: var(--az-fg); border-radius: var(--az-radius); box-shadow: var(--az-shadow16);
  padding: 6px 0;
}
.az-search__head { padding: 6px 14px 4px; font-weight: 600; font-size: 12px; color: var(--az-fg3); }
.az-search__hit {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 14px; border: 0;
  background: none; text-align: left; font: 13px var(--az-font); color: var(--az-fg); cursor: pointer;
}
.az-search__hit:hover { background: var(--az-hover); }
.az-search__type { margin-left: auto; color: var(--az-fg3); font-size: 12px; }
.az-search__none { padding: 14px; color: var(--az-fg3); }

/* ----- body, menu ----- */
.az-body { position: relative; flex: 1 1 auto; min-height: 0; display: flex; }
.az-menu {
  position: absolute; z-index: 40; top: 0; bottom: 0; left: 0; width: 260px; overflow-y: auto;
  background: #fff; box-shadow: var(--az-shadow28); padding: 6px 0;
}
.az-menu__scrim { position: absolute; inset: 0; z-index: 39; background: rgba(0, 0, 0, .25); }
.az-menu__item, .az-menu__sep {
  display: flex; align-items: center; gap: 12px; width: 100%; height: 36px; padding: 0 16px;
  border: 0; background: none; font: 13px var(--az-font); color: var(--az-fg); text-align: left; cursor: pointer;
}
.az-menu__item:hover { background: var(--az-hover); }
.az-menu__item.is-active { background: var(--az-sel); font-weight: 600; }
.az-menu__create { color: var(--az-brand); }
.az-menu__create :deep(svg) { color: var(--az-brand); }
.az-menu__sep { cursor: default; font-size: 12px; color: var(--az-fg3); letter-spacing: .04em; margin-top: 4px;
  border-top: 1px solid var(--az-stroke2); }
.az-fly-enter-active, .az-fly-leave-active { transition: transform .15s ease; }
.az-fly-enter-from, .az-fly-leave-to { transform: translateX(-100%); }

.az-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; overflow: hidden; overflow: clip; }
.az-crumbs { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 8px 24px 0; }
.az-crumbs__link { border: 0; background: none; padding: 0; color: var(--az-link); font: 13px var(--az-font); cursor: pointer; }
.az-crumbs__link:hover { text-decoration: underline; }
.az-crumbs__sep { color: var(--az-fg3); }
.az-page { flex: 1 1 auto; min-height: 0; overflow: auto; }

.az-flyout {
  position: absolute; z-index: 45; top: 0; right: 0; bottom: 0; width: min(380px, 100%);
  display: flex; flex-direction: column; background: #fff; box-shadow: var(--az-shadow28);
}
.az-flyout__head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 8px; }
.az-flyout__head h2 { margin: 0; font-size: 18px; font-weight: 600; }
.az-flyout__body { flex: 1 1 auto; overflow-y: auto; padding: 4px 16px 16px; }
.az-notes__bar { display: flex; justify-content: space-between; padding: 4px 0 8px; color: var(--az-fg3); font-size: 12px; }
.az-note { display: flex; gap: 10px; padding: 12px 8px; border-bottom: 1px solid var(--az-stroke3); }
.az-note__body { flex: 1; min-width: 0; }
.az-note__title { font-weight: 600; }
.az-note__detail { color: var(--az-fg2); margin-top: 2px; overflow-wrap: anywhere; }
.az-note__time { color: var(--az-fg3); font-size: 12px; margin-top: 4px; }
.az-acct { display: flex; gap: 14px; align-items: center; padding: 8px 0 16px; }
.az-acct__name { font-size: 16px; font-weight: 600; }
.az-acct__mail { color: var(--az-fg3); }
.az-acct__out { display: block; margin-top: 16px; }

.az-toasts { position: absolute; z-index: 60; top: 46px; right: 12px; display: flex; flex-direction: column;
  gap: 8px; width: min(360px, calc(100% - 24px)); pointer-events: none; }
.az-toast { pointer-events: auto; display: flex; gap: 10px; padding: 12px; background: #fff;
  border-radius: var(--az-radius); box-shadow: var(--az-shadow16); border-left: 3px solid var(--az-brand); }
.az-toast.is-success { border-left-color: var(--az-ok); }
.az-toast.is-error { border-left-color: var(--az-danger); }
.az-toast.is-warning { border-left-color: #f7630c; }
.az-toast__body { flex: 1; min-width: 0; }
.az-toast__title { font-weight: 600; }
.az-toast__detail { margin-top: 2px; color: var(--az-fg2); overflow-wrap: anywhere; }
.az-toast__time { margin-top: 4px; color: var(--az-fg3); font-size: 12px; }

.az-modal { position: absolute; inset: 0; z-index: 70; display: grid; place-items: center;
  background: rgba(0, 0, 0, .4); padding: 16px; }
.az-modal__card { width: min(520px, 100%); max-height: 100%; overflow: auto; background: #fff;
  border-radius: 8px; box-shadow: var(--az-shadow28); }
.az-modal__head { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 8px; }
.az-modal__head h2 { margin: 0; font-size: 20px; font-weight: 600; }
.az-modal__body { padding: 8px 24px; }
.az-modal__list { margin: 8px 0; padding-left: 20px; max-height: 160px; overflow: auto; }
.az-modal__type { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.az-modal__foot { display: flex; gap: 8px; padding: 16px 24px 20px; }

/* ======================================================================
   The shared vocabulary every blade uses. `:deep` keeps it inside this
   skin's root - nothing here reaches the rest of the platform.
   ====================================================================== */
.az-root :deep(.az-p) { margin: 0 0 10px; }
.az-root :deep(.az-muted) { color: var(--az-fg3); }
.az-root :deep(.az-mono) { font-family: Consolas, 'Cascadia Mono', 'Courier New', monospace; font-size: 12px; overflow-wrap: anywhere; }
.az-root :deep(.az-code) { margin: 0 0 6px; padding: 8px 10px; background: var(--az-bg3); color: var(--az-fg); border: 0; border-radius: var(--az-radius);
  font: 12px Consolas, 'Cascadia Mono', monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.az-root :deep(.az-code.is-bad) { border-left: 3px solid var(--az-danger); }
.az-root :deep(.az-x) { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: var(--az-radius);
  background: none; color: var(--az-fg2); cursor: pointer; flex: none; }
.az-root :deep(.az-x:hover) { background: var(--az-hover); }
.az-root :deep(.az-link) { border: 0; background: none; padding: 0; color: var(--az-link); font: inherit; cursor: pointer; text-align: left; }
.az-root :deep(.az-link:hover) { text-decoration: underline; }
.az-root :deep(.az-link:disabled) { color: var(--az-fg4); cursor: default; text-decoration: none; }
.az-root :deep(.az-kv) { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--az-stroke3); }
.az-root :deep(.az-kv > span:first-child) { color: var(--az-fg3); flex: none; max-width: 45%; }
.az-root :deep(.az-kv > :last-child:not(:first-child)) { min-width: 0; text-align: right; overflow-wrap: anywhere; }
.az-root :deep(.az-kv .az-link) { min-width: 16px; text-align: right; }

.az-root :deep(input::placeholder), .az-root :deep(textarea::placeholder) { color: #707070; opacity: 1; }
/* inline code in prose, and the native controls no class reaches */
.az-root :deep(code:not([class])) { padding: 1px 4px; border-radius: 3px; background: var(--az-bg3); color: var(--az-fg);
  font: 12px Consolas, 'Cascadia Mono', 'Courier New', monospace; }
.az-root :deep(input[type=range]) { accent-color: var(--az-brand); }
.az-root :deep(input[type=radio]), .az-root :deep(input[type=checkbox]) { accent-color: var(--az-brand); }

/* buttons */
.az-root :deep(.az-btn) { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 80px; height: 32px;
  padding: 0 12px; border: 1px solid var(--az-stroke); border-radius: var(--az-radius); background: #fff; color: var(--az-fg);
  font: 600 13px var(--az-font); cursor: pointer; white-space: nowrap; }
.az-root :deep(.az-btn:hover:not(:disabled)) { background: var(--az-hover); border-color: #c7c7c7; }
.az-root :deep(.az-btn--primary) { background: var(--az-brand); border-color: transparent; color: #fff; }
.az-root :deep(.az-btn--primary:hover:not(:disabled)) { background: var(--az-brand-hover); border-color: transparent; }
.az-root :deep(.az-btn--danger) { background: var(--az-danger); border-color: transparent; color: #fff; }
.az-root :deep(.az-btn--danger:hover:not(:disabled)) { background: #b10e1c; border-color: transparent; }
.az-root :deep(.az-btn:disabled) { background: #f0f0f0; border-color: #e0e0e0; color: #bdbdbd; cursor: not-allowed; }

/* command bar */
.az-root :deep(.az-cmdbar) { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 4px 0; margin-bottom: 8px;
  border-bottom: 1px solid var(--az-stroke2); }
.az-root :deep(.az-cmd) { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px; border: 0;
  border-radius: var(--az-radius); background: none; color: var(--az-fg); font: 13px var(--az-font); cursor: pointer; white-space: nowrap; }
.az-root :deep(.az-cmd svg) { color: var(--az-brand); }
.az-root :deep(.az-cmd:hover:not(:disabled)) { background: var(--az-hover); }
.az-root :deep(.az-cmd:disabled) { color: #bdbdbd; cursor: not-allowed; }
.az-root :deep(.az-cmd:disabled svg) { color: #bdbdbd; }
.az-root :deep(.az-cmd--danger svg) { color: var(--az-danger); }
.az-root :deep(.az-cmdsep) { width: 1px; height: 20px; margin: 0 4px; background: var(--az-stroke2); }

/* blade layout */
.az-root :deep(.az-blade) { padding: 4px 24px 24px; min-height: 100%; }
.az-root :deep(.az-blade__head) { display: flex; align-items: center; gap: 12px; padding: 10px 0 12px; }
.az-root :deep(.az-blade__icon) { flex: none; }
.az-root :deep(.az-blade__titles) { min-width: 0; flex: 1; }
.az-root :deep(.az-blade__title) { margin: 0; font-size: 20px; font-weight: 600; line-height: 28px; overflow-wrap: anywhere; }
.az-root :deep(.az-blade__title small) { font-weight: 400; color: var(--az-fg3); }
.az-root :deep(.az-blade__sub) { color: var(--az-fg3); font-size: 12px; }
.az-root :deep(.az-blade__close) { margin-left: auto; }
.az-root :deep(.az-split) { display: flex; min-height: calc(100% - 60px); }
.az-root :deep(.az-svcmenu) { flex: none; width: 220px; padding: 0 8px 16px 0; border-right: 1px solid var(--az-stroke2); }
.az-root :deep(.az-svcmenu__search) { width: 100%; height: 28px; margin: 4px 0 8px; padding: 0 8px; border: 1px solid var(--az-stroke);
  border-radius: var(--az-radius); font: 13px var(--az-font); }
.az-root :deep(.az-svcmenu__group) { padding: 10px 8px 4px; font-weight: 600; font-size: 12px; color: var(--az-fg3); }
.az-root :deep(.az-svcmenu__item) { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 32px; padding: 4px 8px;
  border: 0; border-radius: var(--az-radius); background: none; font: 13px var(--az-font); color: var(--az-fg); text-align: left; cursor: pointer; }
.az-root :deep(.az-svcmenu__item svg) { color: var(--az-brand); }
.az-root :deep(.az-svcmenu__item:hover) { background: var(--az-hover); }
.az-root :deep(.az-svcmenu__item.is-active) { background: var(--az-sel); font-weight: 600; box-shadow: inset 3px 0 0 var(--az-brand); }
.az-root :deep(.az-content) { flex: 1 1 auto; min-width: 0; padding: 0 0 0 20px; }
.az-root :deep(.az-section-title) { margin: 18px 0 8px; font-size: 14px; font-weight: 600; }
.az-root :deep(.az-h2) { margin: 0 0 12px; font-size: 16px; font-weight: 600; }

/* essentials */
.az-root :deep(.az-ess) { border-bottom: 1px solid var(--az-stroke2); margin-bottom: 12px; }
.az-root :deep(.az-ess__head) { display: flex; align-items: center; justify-content: space-between; padding: 6px 0;
  font-weight: 600; }
.az-root :deep(.az-ess__grid) { display: grid; grid-template-columns: 1fr 1fr; column-gap: 32px; padding-bottom: 10px; }
.az-root :deep(.az-ess__row) { display: grid; grid-template-columns: 150px 1fr; gap: 8px; padding: 3px 0; min-width: 0; }
.az-root :deep(.az-ess__k) { color: var(--az-fg2); }
.az-root :deep(.az-ess__v) { min-width: 0; overflow-wrap: anywhere; }
.az-root :deep(.az-ess__v::before) { content: ': '; margin-left: -8px; }
.az-root :deep(.az-ess__tags) { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 4px 0 12px; }

/* fields and forms */
.az-root :deep(.az-form) { max-width: 760px; }
.az-root :deep(.az-field) { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 4px 16px; align-items: start; margin: 0 0 14px; }
.az-root :deep(.az-field__label) { padding-top: 6px; display: flex; align-items: center; gap: 4px; }
.az-root :deep(.az-field__ctl) { min-width: 0; }
.az-root :deep(.az-label) { font-weight: 400; }
.az-root :deep(.az-req) { color: var(--az-danger); }
.az-root :deep(.az-help) { color: var(--az-fg3); font-size: 12px; margin-top: 4px; }
.az-root :deep(.az-err) { color: var(--az-danger); font-size: 12px; margin-top: 4px; display: flex; gap: 4px; align-items: flex-start; }
.az-root :deep(.az-input), .az-root :deep(.az-select), .az-root :deep(.az-textarea) {
  width: 100%; min-height: 32px; padding: 0 10px; border: 1px solid var(--az-stroke); border-bottom-color: #616161;
  border-radius: var(--az-radius); background: #fff; color: var(--az-fg); font: 13px var(--az-font); }
.az-root :deep(.az-textarea) { padding: 6px 10px; min-height: 80px; resize: vertical; }
.az-root :deep(.az-input:focus), .az-root :deep(.az-select:focus), .az-root :deep(.az-textarea:focus) {
  outline: none; border-bottom: 2px solid var(--az-brand); }
.az-root :deep(.az-input.is-bad), .az-root :deep(.az-select.is-bad) { border-color: var(--az-danger); }
.az-root :deep(.az-input:disabled), .az-root :deep(.az-select:disabled) { background: #fafafa; color: var(--az-fg3); }
.az-root :deep(.az-radios) { display: flex; flex-wrap: wrap; gap: 6px 18px; padding-top: 6px; }
.az-root :deep(.az-radio), .az-root :deep(.az-check) { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.az-root :deep(.az-radio input), .az-root :deep(.az-check input) { accent-color: var(--az-brand); margin: 0; width: 15px; height: 15px; }
.az-root :deep(.az-group-title) { margin: 18px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--az-stroke2);
  font-size: 15px; font-weight: 600; }
.az-root :deep(.az-intro) { color: var(--az-fg2); margin: 0 0 16px; max-width: 760px; }

/* tabs */
.az-root :deep(.az-tabs) { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 16px; border-bottom: 1px solid var(--az-stroke2); }
.az-root :deep(.az-tab) { position: relative; height: 36px; padding: 0 10px; border: 0; background: none; color: var(--az-fg2);
  font: 13px var(--az-font); cursor: pointer; white-space: nowrap; }
.az-root :deep(.az-tab:hover) { color: var(--az-fg); }
.az-root :deep(.az-tab.is-active) { color: var(--az-fg); font-weight: 600; }
.az-root :deep(.az-tab.is-active::after) { content: ''; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 3px;
  border-radius: 2px; background: var(--az-brand); }
.az-root :deep(.az-tab .az-dot-err) { display: inline-block; width: 6px; height: 6px; margin-left: 4px; border-radius: 50%;
  background: var(--az-danger); vertical-align: middle; }

/* tables */
.az-root :deep(.az-tablewrap) { width: 100%; overflow-x: auto; }
.az-root :deep(.az-table) { width: 100%; border-collapse: collapse; font-size: 13px; }
.az-root :deep(.az-table th) { padding: 8px 12px 8px 8px; text-align: left; font-weight: 600; color: var(--az-fg); white-space: nowrap;
  border-bottom: 1px solid var(--az-stroke); position: sticky; top: 0; background: #fff; }
.az-root :deep(.az-table th button) { border: 0; background: none; padding: 0; font: 600 13px var(--az-font); cursor: pointer; color: inherit; }
.az-root :deep(.az-table td) { padding: 7px 12px 7px 8px; border-bottom: 1px solid var(--az-stroke3); vertical-align: middle;
  max-width: 340px; overflow-wrap: break-word; }
.az-root :deep(.az-table tr:hover td) { background: var(--az-hover); }
.az-root :deep(.az-table tr.is-sel td) { background: var(--az-sel); }
.az-root :deep(.az-table .az-cb) { width: 36px; }
.az-root :deep(.az-table input[type=checkbox]) { accent-color: var(--az-brand); width: 15px; height: 15px; margin: 0; }
.az-root :deep(.az-namecell) { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.az-root :deep(.az-count) { color: var(--az-fg3); margin: 4px 0 8px; font-size: 12px; }

/* filter pills and list toolbar */
.az-root :deep(.az-filters) { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 4px 0 10px; }
.az-root :deep(.az-filter) { height: 28px; min-width: 200px; padding: 0 10px; border: 1px solid var(--az-stroke);
  border-radius: var(--az-radius); font: 13px var(--az-font); }
.az-root :deep(.az-pill) { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 10px; border-radius: 12px;
  background: var(--az-bg3); border: 1px solid transparent; font: 12px var(--az-font); color: var(--az-fg); cursor: pointer; }
.az-root :deep(.az-pill:hover) { border-color: var(--az-stroke); }
.az-root :deep(.az-pill b) { font-weight: 600; }
.az-root :deep(.az-pill select) { border: 0; background: transparent; font: 600 12px var(--az-font); color: var(--az-fg); max-width: 160px; }
.az-root :deep(.az-tagchip) { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 11px;
  background: var(--az-bg3); font-size: 12px; color: var(--az-fg); }

/* banners, empty states, status */
.az-root :deep(.az-banner) { display: flex; gap: 8px; align-items: flex-start; padding: 8px 12px; margin: 0 0 12px;
  border-radius: var(--az-radius); background: var(--az-info-bg); border: 1px solid #b4d6fa; overflow-wrap: anywhere; }
.az-root :deep(.az-banner.is-error) { background: var(--az-danger-bg); border-color: #eeacb2; }
.az-root :deep(.az-banner.is-success) { background: var(--az-ok-bg); border-color: #9fd89f; }
.az-root :deep(.az-banner.is-warning) { background: var(--az-warn-bg); border-color: #fdcfb4; }
.az-root :deep(.az-empty) { padding: 48px 16px; text-align: center; color: var(--az-fg2); }
.az-root :deep(.az-empty h3) { margin: 12px 0 6px; font-size: 16px; font-weight: 600; color: var(--az-fg); }
.az-root :deep(.az-empty--small) { padding: 16px; }
.az-root :deep(.az-status) { display: inline-flex; align-items: center; gap: 6px; }

/* right-hand context pane (Edit tags, Add rule ...) */
.az-root :deep(.az-pane-scrim) { position: absolute; inset: 0; z-index: 55; background: rgba(0, 0, 0, .3); }
.az-root :deep(.az-pane) { position: absolute; z-index: 56; top: 0; right: 0; bottom: 0; width: min(560px, 100%);
  display: flex; flex-direction: column; background: #fff; box-shadow: var(--az-shadow28); }
.az-root :deep(.az-pane__head) { display: flex; align-items: flex-start; gap: 8px; padding: 16px 20px 8px; }
.az-root :deep(.az-pane__head h2) { margin: 0; font-size: 20px; font-weight: 600; }
.az-root :deep(.az-pane__sub) { color: var(--az-fg3); font-size: 12px; }
.az-root :deep(.az-pane__body) { flex: 1 1 auto; overflow-y: auto; padding: 8px 20px; }
.az-root :deep(.az-pane__body .az-field) { grid-template-columns: 1fr; }
.az-root :deep(.az-pane__foot) { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--az-stroke2); }

/* wizard footer */
.az-root :deep(.az-wiz) { display: flex; flex-direction: column; }
.az-root :deep(.az-wiz > .az-form) { padding-bottom: 16px; }
.az-root :deep(.az-wizfoot) { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  margin: auto -24px -24px; padding: 12px 24px; background: #fff; border-top: 1px solid var(--az-stroke2); }

/* home tiles */
.az-root :deep(.az-tiles) { display: flex; flex-wrap: wrap; gap: 4px; }
.az-root :deep(.az-tile) { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 96px; padding: 10px 4px;
  border: 0; border-radius: var(--az-radius); background: none; font: 12px var(--az-font); color: var(--az-fg); cursor: pointer; text-align: center; }
.az-root :deep(.az-tile:hover) { background: var(--az-hover); }
.az-root :deep(.az-tile__ico) { display: grid; place-items: center; width: 40px; height: 40px; }
.az-root :deep(.az-tile__ico--create) { color: var(--az-brand); }
.az-root :deep(.az-cards) { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.az-root :deep(.az-card) { padding: 16px; border: 1px solid var(--az-stroke2); border-radius: 8px; background: #fff; box-shadow: var(--az-shadow4); }
.az-root :deep(.az-card h3) { margin: 0 0 6px; font-size: 14px; font-weight: 600; }

/* ----- narrow frame ----- */
@container sl-portal (max-width: 900px) {
  .az-mast__hide-n, .az-mast__who { display: none; }
  .az-mast__morewrap { display: block; }
  .az-mast__moreitem.is-copilot, .az-mast__moreitem.is-shell { display: none; }
  .az-root :deep(.az-split) { flex-direction: column; }
  /* the blade menu collapses to a "current page" button that opens the list */
  .az-root :deep(.az-svcmenu) { --az-menu-collapse: 1; width: 100%; border-right: 0; padding: 0 0 8px;
    display: flex; flex-direction: column; }
  .az-root :deep(.az-svcmenu:not(.is-open) > :not(.az-svcmenu__item.is-active)) { display: none; }
  .az-root :deep(.az-svcmenu__item.is-active) { min-height: 36px; border: 1px solid var(--az-stroke); box-shadow: none;
    background: #fff; }
  .az-root :deep(.az-svcmenu__item.is-active::after) { content: ''; margin-left: auto; width: 7px; height: 7px;
    border: solid var(--az-fg2); border-width: 0 1.5px 1.5px 0; transform: translateY(-2px) rotate(45deg); flex: none; }
  .az-root :deep(.az-svcmenu.is-open) { margin-bottom: 4px; border: 1px solid var(--az-stroke2); border-radius: var(--az-radius);
    padding: 4px; box-shadow: var(--az-shadow4); }
  .az-root :deep(.az-svcmenu.is-open .az-svcmenu__item.is-active) { border-color: transparent; background: var(--az-sel); }
  .az-root :deep(.az-svcmenu.is-open .az-svcmenu__item.is-active::after) { transform: translateY(2px) rotate(-135deg); }
  .az-root :deep(.az-svcmenu.is-open .az-svcmenu__search) { order: -1; margin-top: 0; }
  .az-root :deep(.az-content) { padding: 10px 0 0; }
  .az-root :deep(.az-field) { grid-template-columns: 1fr; }
  .az-root :deep(.az-field__label) { padding-top: 0; }
  .az-root :deep(.az-ess__grid) { grid-template-columns: 1fr; }
  /* grids keep readable columns and scroll inside their wrapper instead of squeezing
     every cell into a tall stack of one-word lines */
  /* min-width is ignored on a table cell, so a zero-height strut sets the column floor */
  .az-root :deep(.az-table th:not(.az-cb):not(:empty)::after) { content: ''; display: block; width: 110px; height: 0; }
  .az-root :deep(.az-table td .az-mono) { display: inline-block; min-width: 240px; }
  /* a wrapped command bar must not leave a separator dangling at a line end */
  .az-root :deep(.az-cmdsep) { display: none; }
}
@container sl-portal (max-width: 560px) {
  .az-mast__brand { font-size: 13px; padding: 0 6px 0 0; }
  .az-mast__hide-s { display: none; }
  .az-root .az-mast__moreitem.is-copilot, .az-root .az-mast__moreitem.is-shell { display: flex; }
  /* the search box collapses to the magnifier, and opens over the masthead */
  .az-search { flex: 0 0 36px; max-width: none; margin: 0 0 0 auto; }
  .az-search__icon { pointer-events: none; color: #fff; left: 11px; top: 11px; }
  .az-search:not(.is-open) .az-search__input { padding: 0; width: 36px; height: 36px; background: transparent; color: transparent;
    cursor: pointer; }
  .az-search:not(.is-open) .az-search__input::placeholder { color: transparent; }
  .az-search:not(.is-open) .az-search__input:hover { background: var(--az-mast-hover); }
  .az-search:not(.is-open) .az-search__input:focus { box-shadow: none; }
  .az-search:not(.is-open) .az-search__input:focus-visible { box-shadow: inset 0 0 0 2px #fff; }
  .az-search.is-open { position: absolute; z-index: 55; left: 4px; right: 4px; top: 5px; }
  .az-search.is-open .az-search__icon { color: #616161; left: 10px; top: 8px; }
  .az-root :deep(.az-blade) { padding: 4px 12px 16px; }
  .az-crumbs { padding: 6px 12px 0; }
  .az-root :deep(.az-ess__row) { grid-template-columns: 120px 1fr; }
  .az-root :deep(.az-wizfoot) { margin: auto -12px -16px; padding: 10px 12px; }
  .az-root :deep(.az-filter) { min-width: 0; width: 100%; }
  /* on a phone a stack of toasts would sit on the command bar: show only the newest,
     compact, so it covers the breadcrumb and title and not what has to be pressed */
  .az-toasts { left: 12px; right: 12px; width: auto; }
  .az-toast:not(:first-child), .az-toast__detail { display: none; }
  .az-toast { padding: 8px 10px; }
  /* tab strips scroll sideways on a phone rather than stacking into rows */
  .az-root :deep(.az-tabs) { flex-wrap: nowrap; gap: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
  .az-root :deep(.az-tabs::-webkit-scrollbar) { display: none; }
  .az-root :deep(.az-tab) { flex: none; }
  .az-root :deep(.az-tab.is-active::after) { bottom: 0; }
}
</style>
