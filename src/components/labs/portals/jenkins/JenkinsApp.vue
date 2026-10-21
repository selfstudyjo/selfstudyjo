<template>
  <div class="jk-app" dir="ltr" :class="{ 'is-nav-open': navOpen }">
    <!-- ===== Header: the 2.440 black bar ===== -->
    <header class="jk-header">
      <button type="button" class="jk-header__burger" aria-label="Toggle the side panel" @click="navOpen = !navOpen">
        <JkIcon name="menu" />
      </button>
      <a href="#" class="jk-header__brand" @click.prevent="go({ page: 'dashboard' })">
        <JkLogo />
        <span class="jk-header__title">Jenkins</span>
      </a>
      <div class="jk-header__spacer"></div>
      <form class="jk-search" role="search" @submit.prevent="search">
        <JkIcon name="search" class="jk-search__icon" />
        <input v-model="query" class="jk-search__input" type="search" placeholder="Search (CTRL+K)"
               aria-label="Search" list="jk-search-jobs" />
        <datalist id="jk-search-jobs">
          <option v-for="job in jobs" :key="job.name" :value="job.name" />
        </datalist>
        <a href="#" class="jk-search__help" title="Help" @click.prevent="notify('info', 'Search for a job by name and press Enter.')">
          <JkIcon name="help" />
        </a>
      </form>
      <button type="button" class="jk-header__action" title="Notifications"
              @click="notify('info', 'No new notifications', 'Jenkins is up to date. Version ' + version + '.')">
        <JkIcon name="bell" />
      </button>
      <button type="button" class="jk-header__action jk-header__action--warn" title="Security"
              @click="notify('warning', 'Building on the built-in node can be a security issue.', 'Set up distributed builds: Manage Jenkins → Nodes.')">
        <JkIcon name="shield" />
        <span class="jk-header__badge">1</span>
      </button>
      <div class="jk-user">
        <button type="button" class="jk-user__button" :aria-expanded="userOpen" @click="userOpen = !userOpen">
          <JkIcon name="user" />
          <span class="jk-user__name">{{ user }}</span>
          <JkIcon name="chevron-down" class="jk-user__chev" />
        </button>
        <div v-if="userOpen" class="jk-menu" @click="userOpen = false">
          <button type="button" class="jk-menu__item" @click="go({ page: 'history' })"><JkIcon name="history" />Builds</button>
          <button type="button" class="jk-menu__item" @click="go({ page: 'dashboard' })"><JkIcon name="views" />My Views</button>
          <button type="button" class="jk-menu__item" @click="go({ page: 'credentials' })"><JkIcon name="key" />Credentials</button>
          <button type="button" class="jk-menu__item" @click="notify('info', 'You are signed in as ' + user + '.')"><JkIcon name="user" />Account</button>
        </div>
      </div>
      <a href="#" class="jk-header__logout" @click.prevent="notify('info', 'The lab keeps you signed in as ' + user + '.')">
        <JkIcon name="logout" /><span>log out</span>
      </a>
    </header>

    <!-- ===== Breadcrumbs ===== -->
    <nav class="jk-crumbs" aria-label="Breadcrumb">
      <ol>
        <li v-for="(crumb, index) in crumbs" :key="index">
          <a v-if="crumb.route && index < crumbs.length - 1" href="#" @click.prevent="go(crumb.route)">{{ crumb.label }}</a>
          <span v-else>{{ crumb.label }}</span>
          <JkIcon v-if="index < crumbs.length - 1" name="chevron" class="jk-crumbs__sep" />
        </li>
      </ol>
    </nav>

    <!-- ===== Notification bar (the toast Jenkins slides in at the top) ===== -->
    <div class="jk-notices" aria-live="polite">
      <div v-for="flash in shownFlashes" :key="flash.id" class="jk-notice" :class="'jk-notice--' + flash.type">
        <JkIcon :name="flash.type === 'success' ? 'status' : flash.type === 'error' ? 'close' : 'info'" class="jk-notice__icon" />
        <div class="jk-notice__body">
          <strong>{{ flash.title }}</strong>
          <span v-if="flash.detail" class="jk-notice__detail">{{ flash.detail }}</span>
        </div>
        <button type="button" class="jk-notice__close" aria-label="Dismiss" @click="api.dismiss(flash.id)">
          <JkIcon name="close" />
        </button>
      </div>
    </div>

    <div class="jk-body">
      <aside class="jk-side" :class="{ 'is-open': navOpen }" @click="onSideClick">
        <JkSidePanel />
      </aside>
      <main ref="mainEl" class="jk-main">
        <component :is="page" :key="pageKey" />
      </main>
    </div>

    <footer class="jk-footer">
      <span>REST API</span>
      <span>Jenkins {{ version }}</span>
    </footer>

    <!-- ===== Confirmation dialog (dialog.confirm in 2.4xx) ===== -->
    <div v-if="dialog" class="jk-dialog-back" @keydown.esc="answer(false)">
      <div class="jk-dialog" role="dialog" aria-modal="true" :aria-label="dialog.title">
        <h2 class="jk-dialog__title">{{ dialog.title }}</h2>
        <p v-if="dialog.message" class="jk-dialog__message">{{ dialog.message }}</p>
        <div class="jk-dialog__buttons">
          <button ref="yesButton" type="button" class="jk-btn"
                  :class="dialog.destructive ? 'jk-btn--danger' : 'jk-btn--primary'" @click="answer(true)">
            {{ dialog.yes || 'Yes' }}
          </button>
          <button type="button" class="jk-btn" @click="answer(false)">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Jenkins web UI (2.440 LTS look), driven by the lab's Jenkins engine.
 *
 * Every button runs a `jenkins-cli` line - see `jenkinsKit.ts` for which
 * surface each goes through and why. This file is the chrome: header,
 * breadcrumbs, side panel, notification bar, confirm dialog and the page
 * switch. Each page is its own component and reads the shell through
 * `useJk()`.
 */
import { computed, nextTick, onBeforeUnmount, provide, ref, toRef, watch, type Component } from 'vue';
import { pick, type PortalResult } from '@/utils/portalKit';
import type { LabTool } from '@/utils/labCatalogue';
import type { PortalApi } from '../usePortal';
import JkIcon from './JkIcon.vue';
import JkLogo from './JkLogo.vue';
import JkSidePanel from './JkSidePanel.vue';
import JkDashboard from './JkDashboard.vue';
import JkNewItem from './JkNewItem.vue';
import JkJob from './JkJob.vue';
import JkConfigure from './JkConfigure.vue';
import JkBuildParams from './JkBuildParams.vue';
import JkBuild from './JkBuild.vue';
import JkManage from './JkManage.vue';
import JkCredentials from './JkCredentials.vue';
import JkNodes from './JkNodes.vue';
import JkPlugins from './JkPlugins.vue';
import JkHistory from './JkHistory.vue';
import JkMisc from './JkMisc.vue';
import JkViews from './JkViews.vue';
import JkWorkspace from './JkWorkspace.vue';
import JkSystem from './JkSystem.vue';
import { JK, type ConfirmRequest, type RunOptions } from './jkContext';
import {
  baseUrl, credentialsOf, jobsOf, multiline, nodesOf, pluginsOf, routeUrl, systemMessageOf, viewsOf, type Route,
} from './jenkinsKit';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const view = toRef(props, 'view');
const jobs = computed(() => jobsOf(view.value));
const nodes = computed(() => nodesOf(view.value));
const credentials = computed(() => credentialsOf(view.value));
const plugins = computed(() => pluginsOf(view.value));
const views = computed(() => viewsOf(view.value));
const systemMessage = computed(() => systemMessageOf(view.value));
const branch = computed(() => String(pick(view.value, 'portal.branch', '') || pick(view.value, 'branch', 'main')));
const user = computed(() => String(pick(view.value, 'portal.user', 'admin')));
const version = computed(() => String(pick(view.value, 'version', '2.440.1')));
const base = computed(() => baseUrl(view.value));

const route = ref<Route>({ page: 'dashboard' });
const navOpen = ref(false);
const userOpen = ref(false);
const query = ref('');
const now = ref(Date.now());
const timer = window.setInterval(() => { now.value = Date.now(); }, 15000);
onBeforeUnmount(() => window.clearInterval(timer));

function go(next: Route) {
  route.value = next;
  navOpen.value = false;
  userOpen.value = false;
}

const mainEl = ref<HTMLElement | null>(null);
watch([route, base], () => emit('location', routeUrl(route.value, base.value)), { immediate: true, deep: true });
watch(route, () => { if (mainEl.value) mainEl.value.scrollTop = 0; }, { deep: true });

// A job deleted from the console beside the portal must not leave the page on
// a job that no longer exists.
watch(jobs, list => {
  const r = route.value as any;
  if (r.job && !list.some(job => job.name === r.job)) go({ page: 'dashboard' });
});
// Likewise a view deleted from the console.
watch(views, list => {
  const r = route.value as any;
  if (r.view && (r.page === 'dashboard' || r.page === 'editView') && !list.some(v => v.name === r.view)) go({ page: 'dashboard' });
});

async function run(command: string, options: RunOptions = {}): Promise<PortalResult> {
  return props.api.exec(command, {
    // Single-line commands speak as the Jenkins CLI console, so the lab's
    // command checks (written against that console) see them.
    surface: multiline(command) || options.direct ? undefined : 'jenkins',
    success: options.success,
    quiet: options.quiet,
    unlogged: options.unlogged,
  });
}

function notify(type: 'success' | 'error' | 'info' | 'warning', title: string, detail = '') {
  props.api.notify(type, title, detail);
}

const dialog = ref<ConfirmRequest | null>(null);
const yesButton = ref<HTMLButtonElement | null>(null);
let resolver: ((value: boolean) => void) | null = null;

function confirm(request: ConfirmRequest): Promise<boolean> {
  if (resolver) resolver(false);
  dialog.value = request;
  void nextTick(() => yesButton.value?.focus());
  return new Promise(resolve => { resolver = resolve; });
}

function answer(value: boolean) {
  dialog.value = null;
  const done = resolver;
  resolver = null;
  done?.(value);
}

function search() {
  const text = query.value.trim();
  if (!text) return;
  const hit = jobs.value.find(job => job.name === text)
    || jobs.value.find(job => job.name.toLowerCase().includes(text.toLowerCase()));
  if (hit) {
    go({ page: 'job', job: hit.name });
    query.value = '';
  } else {
    notify('error', `Nothing seems to match ‘${text}’.`);
  }
}

function onSideClick(event: MouseEvent) {
  // Clicking a task in the collapsed (drawer) side panel closes it.
  if ((event.target as HTMLElement)?.closest('a,button')) navOpen.value = false;
}

provide(JK, {
  view, jobs, nodes, credentials, plugins, views, systemMessage, branch, user, base, now,
  busy: computed(() => Boolean(props.busy)),
  route, go, run, confirm, notify,
  job: (name: string) => jobs.value.find(job => job.name === name),
});

const PAGES: Record<string, Component> = {
  dashboard: JkDashboard,
  newView: JkViews,
  editView: JkViews,
  workspace: JkWorkspace,
  system: JkSystem,
  newItem: JkNewItem,
  history: JkHistory,
  manage: JkManage,
  plugins: JkPlugins,
  nodes: JkNodes,
  node: JkNodes,
  nodeNew: JkNodes,
  credentials: JkCredentials,
  credentialNew: JkCredentials,
  credential: JkCredentials,
  cli: JkMisc,
  about: JkMisc,
  job: JkJob,
  stageView: JkJob,
  changes: JkJob,
  configure: JkConfigure,
  buildParams: JkBuildParams,
  rename: JkMisc,
  syntax: JkMisc,
  build: JkBuild,
};

// Jenkins slides ONE notification in at a time and takes a success away after a
// few seconds; an error stays until it is dismissed.
const shownFlashes = computed(() => props.api.flashes.value.slice(0, 1));
watch(() => props.api.flashes.value[0], flash => {
  if (flash && (flash.type === 'success' || flash.type === 'info')) {
    window.setTimeout(() => props.api.dismiss(flash.id), 3500);
  }
});

const page = computed(() => PAGES[route.value.page] || JkDashboard);
const pageKey = computed(() => JSON.stringify(route.value));

const crumbs = computed(() => {
  const r = route.value as any;
  const out: { label: string; route?: Route }[] = [{ label: 'Dashboard', route: { page: 'dashboard' } }];
  if (r.view && (r.page === 'dashboard' || r.page === 'editView')) out.push({ label: r.view, route: { page: 'dashboard', view: r.view } });
  if (r.job) out.push({ label: r.job, route: { page: 'job', job: r.job } });
  const manage = () => out.push({ label: 'Manage Jenkins', route: { page: 'manage' } });
  switch (r.page) {
    case 'newItem': out.push({ label: 'All', route: { page: 'dashboard' } }); out.push({ label: 'New Item' }); break;
    case 'history': out.push({ label: 'Build History' }); break;
    case 'newView': out.push({ label: 'New view' }); break;
    case 'editView': out.push({ label: 'Edit View' }); break;
    case 'system': manage(); out.push({ label: 'System' }); break;
    case 'workspace': {
      out.push({ label: 'Workspace', route: { page: 'workspace', job: r.job } });
      if (r.path) out.push({ label: r.path });
      break;
    }
    case 'manage': out.push({ label: 'Manage Jenkins' }); break;
    case 'plugins': manage(); out.push({ label: 'Plugins' }); break;
    case 'nodes': manage(); out.push({ label: 'Nodes' }); break;
    case 'node': manage(); out.push({ label: 'Nodes', route: { page: 'nodes' } }); out.push({ label: r.node === 'built-in' ? 'Built-In Node' : r.node }); break;
    case 'nodeNew': manage(); out.push({ label: 'Nodes', route: { page: 'nodes' } }); out.push({ label: 'New node' }); break;
    case 'credentials': manage(); out.push({ label: 'Credentials' }); out.push({ label: 'System' }); out.push({ label: 'Global credentials (unrestricted)' }); break;
    case 'credentialNew': manage(); out.push({ label: 'Credentials', route: { page: 'credentials' } }); out.push({ label: 'New credentials' }); break;
    case 'credential': manage(); out.push({ label: 'Credentials', route: { page: 'credentials' } }); out.push({ label: r.id }); break;
    case 'cli': manage(); out.push({ label: 'Jenkins CLI' }); break;
    case 'about': manage(); out.push({ label: 'About Jenkins' }); break;
    case 'configure': out.push({ label: 'Configuration' }); break;
    case 'buildParams': out.push({ label: 'Build with Parameters' }); break;
    case 'stageView': out.push({ label: 'Full Stage View' }); break;
    case 'rename': out.push({ label: 'Rename' }); break;
    case 'syntax': out.push({ label: 'Pipeline Syntax' }); break;
    case 'changes': out.push({ label: 'Changes' }); break;
    case 'build': {
      out.push({ label: `#${r.build}`, route: { page: 'build', job: r.job, build: r.build } });
      const tab = { console: 'Console Output', params: 'Parameters', replay: 'Replay', steps: 'Pipeline Steps', overview: 'Pipeline Overview' }[r.tab as string];
      if (tab) out.push({ label: tab });
      break;
    }
    default: break;
  }
  return out;
});
</script>

<style scoped>
/* ---------- Palette (Jenkins 2.4xx light theme, header in the classic black) ---------- */
.jk-app {
  --jk-bg: #fefefe;
  --jk-text: #14141f;
  --jk-secondary: #67666c;
  --jk-accent: #0b66e4;
  --jk-green: #1ea64b;
  --jk-red: #e3172d;
  --jk-orange: #f2772e;
  --jk-orange-strong: #c2410c;
  --jk-green-strong: #15803d;
  --jk-border: #e5e5e8;
  --jk-table-bg: #f2f2f4;
  --jk-btn-bg: rgba(119, 118, 124, 0.075);
  --jk-btn-hover: rgba(119, 118, 124, 0.125);
  --jk-btn-active: rgba(119, 118, 124, 0.175);
  --jk-input-border: rgba(119, 118, 124, 0.32);
  --jk-radius: 10.56px;
  --jk-header: #000;
  --jk-font: system-ui, "Segoe UI", roboto, "Noto Sans", oxygen, ubuntu, cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  --jk-mono: ui-monospace, sfmono-regular, "SF Mono", jetbrainsmono, consolas, monospace;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--jk-bg);
  color: var(--jk-text);
  font-family: var(--jk-font);
  font-size: 14px;
  line-height: 1.66;
  position: relative;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

/* ---------- Header ---------- */
.jk-header {
  flex: none;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 5.6px;
  padding: 0 12px 0 16px;
  background: var(--jk-header);
  color: #fff;
}
.jk-header__burger { display: none; flex: none; background: none; border: 0; color: #fff; padding: 6.4px; border-radius: 8px; cursor: pointer; }
.jk-header__brand { display: flex; align-items: center; gap: 9.6px; color: #fff; text-decoration: none; }
.jk-header__title { font-size: 18.4px; font-weight: 600; letter-spacing: -0.01em; }
.jk-header__spacer { flex: 1; }
.jk-search {
  position: relative; display: flex; align-items: center;
  width: min(384px, 34vw); height: 36px; margin-right: 8px;
  background: #fff; border-radius: 10.56px; color: var(--jk-text);
}
.jk-search__icon { position: absolute; left: 10.4px; width: 16px; height: 16px; color: var(--jk-secondary); }
.jk-search__input { flex: 1; min-width: 0; height: 100%; border: 0; background: transparent; padding: 0 8px 0 33.6px; font: inherit; color: inherit; outline: none; border-radius: 10.56px; }
.jk-search__input::placeholder { color: var(--jk-secondary); opacity: 1; }
.jk-search__input:focus { box-shadow: 0 0 0 3px rgba(11, 102, 228, 0.35); }
.jk-search__help { flex: none; margin-right: 8px; color: var(--jk-secondary); display: flex; }
.jk-search__help .jk-icon { width: 16.8px; height: 16.8px; }
.jk-header__action { position: relative; background: none; border: 0; color: #fff; padding: 7.2px; border-radius: 8px; cursor: pointer; display: flex; }
.jk-header__action:hover, .jk-user__button:hover, .jk-header__logout:hover { background: rgba(255, 255, 255, 0.14); }
.jk-header__badge { position: absolute; top: 1.6px; right: 0.8px; min-width: 16px; height: 16px; border-radius: 8px; background: var(--jk-orange-strong); color: #fff; font-size: 12px; font-weight: 700; line-height: 16px; text-align: center; }
.jk-user { position: relative; }
.jk-user__button { display: flex; align-items: center; gap: 6.4px; background: none; border: 0; color: #fff; font: inherit; font-weight: 500; padding: 6.4px 8.8px; border-radius: 8px; cursor: pointer; }
.jk-user__chev { width: 12.8px; height: 12.8px; }
.jk-header__logout { display: flex; align-items: center; gap: 5.6px; color: #fff; text-decoration: none; font-weight: 500; padding: 6.4px 8.8px; border-radius: 8px; }
.jk-menu {
  position: absolute; right: 0; top: calc(100% + 6.4px); z-index: 30; min-width: 192px; padding: 6.4px;
  background: #fff; color: var(--jk-text); border-radius: 12.8px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06), 0 10px 30px rgba(0, 0, 0, 0.2);
}
.jk-menu__item { display: flex; width: 100%; align-items: center; gap: 9.6px; padding: 7.2px 9.6px; background: none; border: 0; border-radius: 8px; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.jk-menu__item:hover { background: var(--jk-btn-hover); }

/* ---------- Breadcrumbs ---------- */
.jk-crumbs { flex: none; padding: 0 20px; height: 41.6px; display: flex; align-items: center; border-bottom: 1px solid var(--jk-border); background: var(--jk-bg); overflow-x: auto; white-space: nowrap; }
.jk-crumbs ol { display: flex; align-items: center; list-style: none; margin: 0; padding: 0; gap: 3.2px; }
.jk-crumbs li { display: flex; align-items: center; gap: 3.2px; flex: none; }
.jk-crumbs { scrollbar-width: none; }
.jk-crumbs::-webkit-scrollbar { display: none; }
.jk-crumbs a, .jk-crumbs span { color: var(--jk-text); text-decoration: none; padding: 2.4px 7.2px; border-radius: 6.4px; font-weight: 500; }
.jk-crumbs a:hover { background: var(--jk-btn-hover); }
.jk-crumbs li:last-child span { color: var(--jk-text); }
.jk-crumbs__sep { width: 12px; height: 12px; color: var(--jk-secondary); }

/* ---------- Body ---------- */
.jk-body { flex: 1; min-height: 0; display: flex; overflow: hidden; }
.jk-side { flex: none; width: 320px; padding: 20px 8px 24px 20px; overflow-y: auto; }
.jk-main { flex: 1; min-width: 0; padding: 22.4px 28px 32px; overflow: auto; }
.jk-footer { flex: none; display: flex; justify-content: flex-end; gap: 24px; padding: 7.2px 24px; font-size: 12px; color: var(--jk-secondary); border-top: 1px solid var(--jk-border); }

/* ---------- Notification bar ---------- */
.jk-notices { position: absolute; top: 62.4px; left: 50%; transform: translateX(-50%); z-index: 40; display: flex; flex-direction: column; gap: 8px; width: min(576px, calc(100% - 32px)); pointer-events: none; }
.jk-notice { pointer-events: auto; display: flex; align-items: flex-start; gap: 9.6px; padding: 11.2px 12.8px 11.2px 16px; border-radius: 12.8px; color: #fff; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); }
.jk-notice--success { background: var(--jk-green-strong); }
.jk-notice--error { background: var(--jk-red); }
.jk-notice--warning { background: var(--jk-orange-strong); }
.jk-notice--info, .jk-notice--progress { background: #2f3138; }
.jk-notice__icon { margin-top: 1.6px; }
.jk-notice__body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.jk-notice__detail { font-size: 12.8px; opacity: 0.95; word-break: break-word; }
.jk-notice__close { background: none; border: 0; color: inherit; padding: 1.6px; cursor: pointer; display: flex; }
.jk-notice__close .jk-icon { width: 16px; height: 16px; }

/* ---------- Dialog ---------- */
.jk-dialog-back { position: absolute; inset: 0; z-index: 50; background: rgba(20, 20, 31, 0.35); display: flex; align-items: center; justify-content: center; padding: 16px; }
.jk-dialog { width: min(480px, 100%); background: #fff; border-radius: 17.6px; padding: 24px 25.6px 20.8px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); }
.jk-dialog__title { margin: 0 0 8px; font-size: 18.4px; font-weight: 600; }
.jk-dialog__message { margin: 0 0 17.6px; color: var(--jk-secondary); word-break: break-word; }
.jk-dialog__buttons { display: flex; gap: 9.6px; justify-content: flex-start; }

/* ---------- Shared component styles (pages are descendants) ---------- */
.jk-app :deep(a.jk-link), .jk-app :deep(.jk-link) { color: var(--jk-accent); text-decoration: none; cursor: pointer; background: none; border: 0; padding: 0; font: inherit; }
.jk-app :deep(.jk-link:hover) { text-decoration: underline; }
.jk-app :deep(.jk-h1) { display: flex; align-items: center; gap: 9.6px; margin: 0 0 16px; font-size: 25.6px; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; word-break: break-word; }
.jk-app :deep(.jk-h2) { margin: 25.6px 0 11.2px; font-size: 18.4px; font-weight: 650; }
.jk-app :deep(.jk-app-bar) { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.jk-app :deep(.jk-app-bar .jk-h1) { margin: 0; }
.jk-app :deep(.jk-btn) {
  display: inline-flex; align-items: center; justify-content: center; gap: 7.2px;
  min-height: 36.8px; padding: 6.4px 16px; border: 0; border-radius: var(--jk-radius);
  background: var(--jk-btn-bg); color: var(--jk-text); font: inherit; font-weight: 500; cursor: pointer;
  white-space: nowrap; text-decoration: none;
}
.jk-app :deep(.jk-btn:hover) { background: var(--jk-btn-hover); }
.jk-app :deep(.jk-btn:active) { background: var(--jk-btn-active); }
.jk-app :deep(.jk-btn:disabled) { opacity: 0.5; cursor: not-allowed; }
.jk-app :deep(.jk-btn--primary) { background: var(--jk-accent); color: #fff; }
.jk-app :deep(.jk-btn--primary:hover) { background: #0a5bcc; }
.jk-app :deep(.jk-btn--danger) { background: var(--jk-red); color: #fff; }
.jk-app :deep(.jk-btn--danger:hover) { background: #c8121f; }
.jk-app :deep(.jk-btn--text-danger) { color: var(--jk-red); }
.jk-app :deep(.jk-btn .jk-icon) { width: 17.6px; height: 17.6px; }
.jk-app :deep(.jk-input), .jk-app :deep(.jk-select), .jk-app :deep(.jk-textarea) {
  width: 100%; box-sizing: border-box; min-height: 36.8px; padding: 7.2px 10.4px;
  border: 2px solid var(--jk-input-border); border-radius: var(--jk-radius); background: #fff;
  color: var(--jk-text); font: inherit; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
}
.jk-app :deep(.jk-input:hover), .jk-app :deep(.jk-select:hover), .jk-app :deep(.jk-textarea:hover) { border-color: rgba(119, 118, 124, 0.55); }
.jk-app :deep(.jk-input:focus), .jk-app :deep(.jk-select:focus), .jk-app :deep(.jk-textarea:focus) { border-color: var(--jk-accent); box-shadow: 0 0 0 3px rgba(11, 102, 228, 0.15); }
.jk-app :deep(.jk-input[readonly]) { background: var(--jk-table-bg); }
.jk-app :deep(.jk-textarea) { min-height: 80px; resize: vertical; line-height: 1.5; }
.jk-app :deep(.jk-mono) { font-family: var(--jk-mono); font-size: 13px; }
.jk-app :deep(.jk-field) { margin-bottom: 20px; max-width: 832px; }
.jk-app :deep(.jk-label) { display: block; font-weight: 600; margin-bottom: 5.6px; }
.jk-app :deep(.jk-help) { color: var(--jk-secondary); font-size: 13px; margin-top: 4.8px; }
.jk-app :deep(.jk-error) { color: var(--jk-red); font-size: 13px; margin-top: 4.8px; font-weight: 500; }
.jk-app :deep(.jk-warning) { color: #b45309; font-size: 13px; margin-top: 4.8px; }
.jk-app :deep(.jk-check) { display: flex; align-items: flex-start; gap: 9.6px; margin: 8.8px 0; cursor: pointer; }
.jk-app :deep(.jk-check input) {
  appearance: none; -webkit-appearance: none; position: relative; flex: none;
  width: 18.4px; height: 18.4px; margin: 2.88px 0 0; border: 2px solid var(--jk-input-border);
  border-radius: 4.8px; background: #fff; cursor: inherit; transition: background 0.15s, border-color 0.15s;
}
.jk-app :deep(.jk-check input[type='radio']) { border-radius: 50%; }
.jk-app :deep(.jk-check input:hover:not(:disabled)) { border-color: rgba(119, 118, 124, 0.6); }
.jk-app :deep(.jk-check input:checked) { background: var(--jk-accent); border-color: var(--jk-accent); }
.jk-app :deep(.jk-check input[type='checkbox']:checked::after) {
  content: ''; position: absolute; left: 4.8px; top: 1.28px; width: 4.48px; height: 8.8px;
  border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.jk-app :deep(.jk-check input[type='radio']:checked::after) {
  content: ''; position: absolute; inset: 3.2px; border-radius: 50%; background: #fff;
}
.jk-app :deep(.jk-check input:disabled) { background: var(--jk-table-bg); opacity: 0.7; }
.jk-app :deep(.jk-check input:disabled:checked) { background: #a8a7ad; border-color: #a8a7ad; }
.jk-app :deep(.jk-check input:focus-visible) { box-shadow: 0 0 0 3px rgba(11, 102, 228, 0.3); }
.jk-app :deep(.jk-table-wrap) { overflow-x: auto; max-width: 100%; }
.jk-app :deep(.jk-table) { width: 100%; border-collapse: separate; border-spacing: 0; background: var(--jk-table-bg); border-radius: 11px; padding: 0 4.8px 4.8px; }
.jk-app :deep(.jk-table th) { text-align: left; font-weight: 600; padding: 9.6px 12.8px; white-space: nowrap; color: var(--jk-text); }
.jk-app :deep(.jk-table td) { padding: 8px 12.8px; background: var(--jk-bg); vertical-align: middle; }
.jk-app :deep(.jk-table tbody tr td:first-child) { border-top-left-radius: 5px; border-bottom-left-radius: 5px; }
.jk-app :deep(.jk-table tbody tr td:last-child) { border-top-right-radius: 5px; border-bottom-right-radius: 5px; }
.jk-app :deep(.jk-table tbody tr + tr td) { border-top: 2px solid var(--jk-table-bg); }
.jk-app :deep(.jk-table .is-center) { text-align: center; }
.jk-app :deep(.jk-empty) { padding: 19.2px; color: var(--jk-secondary); background: var(--jk-table-bg); border-radius: 11px; }
.jk-app :deep(.jk-card) { border: 1px solid var(--jk-border); border-radius: 12.8px; padding: 16px 19.2px; background: #fff; }
.jk-app :deep(.jk-alert) { padding: 12px 16px; border-radius: 10.56px; margin-bottom: 16px; }
.jk-app :deep(.jk-alert--danger) { background: rgba(227, 23, 45, 0.08); color: #a50f1f; }
.jk-app :deep(.jk-alert--warning) { background: rgba(242, 119, 46, 0.1); color: #8a3d0c; }
.jk-app :deep(.jk-alert--info) { background: rgba(11, 102, 228, 0.07); color: #0b4aa6; }
.jk-app :deep(.jk-bottom-bar) { position: sticky; bottom: -32px; display: flex; gap: 9.6px; padding: 14.4px 0 19.2px; margin-top: 16px; background: linear-gradient(transparent, var(--jk-bg) 9.6px); }
.jk-app :deep(.jk-muted) { color: var(--jk-secondary); }
.jk-app :deep(code) { color: var(--jk-text); background: var(--jk-btn-bg); font-family: var(--jk-mono); font-size: 0.85em; padding: 0 4px; border-radius: 4px; }

/* ---------- Narrow frames: the side panel becomes a drawer ---------- */
@container sl-portal (max-width: 900px) {
  .jk-header__burger { display: flex; }
  .jk-side {
    position: absolute; top: 97.6px; bottom: 0; left: 0; z-index: 35; width: min(320px, 85%);
    background: var(--jk-bg); box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
    transform: translateX(-105%); transition: transform 0.2s ease; padding-right: 16px;
  }
  .jk-side.is-open { transform: none; }
  .jk-main { padding: 17.6px 16px 32px; }
  .jk-header__logout span, .jk-user__name { display: none; }
  .jk-search { width: auto; flex: 1; min-width: 96px; }
  .jk-header__spacer { display: none; }
}
@container sl-portal (max-width: 520px) {
  .jk-header { padding: 0 6.4px; gap: 2.4px; }
  .jk-header__title { display: none; }
  .jk-header__action--warn, .jk-header__logout { display: none; }
  .jk-app :deep(.jk-h1) { font-size: 20.8px; }
  .jk-crumbs { padding: 0 9.6px; }
  /* Keep the last two crumbs on a phone; the earlier ones are one tap away in the side panel. */
  .jk-crumbs li:not(:nth-last-child(-n+2)) { display: none; }
}
</style>
