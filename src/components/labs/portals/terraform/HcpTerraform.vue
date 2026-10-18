<template>
  <div class="tf-app" dir="ltr" :class="{ 'is-nav-open': navOpen }">
    <!-- ===== Side navigation (Helios SideNav, dark) ===== -->
    <aside class="tf-nav" :class="{ 'is-open': navOpen }" aria-label="Primary">
      <div class="tf-nav__head">
        <a href="#" class="tf-nav__brand" aria-label="HCP Terraform home" @click.prevent="go({ page: 'workspaces' })">
          <span class="tf-nav__mark"><TfIcon name="terraform" :size="22" /></span>
          <span class="tf-nav__wordmark">HCP Terraform</span>
        </a>
        <button type="button" class="tf-nav__close" aria-label="Close menu" @click="navOpen = false">
          <TfIcon name="x" />
        </button>
      </div>

      <div class="tf-nav__org">
        <button type="button" class="tf-nav__org-btn" :aria-expanded="orgOpen" @click="orgOpen = !orgOpen">
          <span class="tf-nav__org-label">Organization</span>
          <span class="tf-nav__org-name">{{ orgName }}</span>
          <TfIcon name="chevron-down" class="tf-nav__org-chev" />
        </button>
        <div v-if="orgOpen" class="tf-nav__org-menu">
          <div class="tf-nav__org-menu-title">Organizations</div>
          <button type="button" class="tf-nav__org-item is-current" @click="orgOpen = false; go({ page: 'workspaces' })">
            <TfIcon name="check" :size="14" /> {{ orgName }}
          </button>
          <div class="tf-nav__org-menu-note">This lab has one organization.</div>
        </div>
      </div>

      <nav class="tf-nav__body">
        <template v-if="inWorkspace && workspace">
          <a href="#" class="tf-nav__back" @click.prevent="go({ page: 'workspaces' })">
            <TfIcon name="chevron-left" :size="14" /> Projects &amp; workspaces
          </a>
          <div class="tf-nav__context">
            <span class="tf-nav__context-kind">Workspace</span>
            <span class="tf-nav__context-name" :title="workspace.name">{{ workspace.name }}</span>
          </div>
          <ul class="tf-nav__list">
            <li v-for="item in wsItems" :key="item.page">
              <a href="#" class="tf-nav__item" :class="{ 'is-active': isActive(item.pages) }"
                 :aria-current="isActive(item.pages) ? 'page' : undefined"
                 @click.prevent="go({ page: item.page, ws: workspace.name })">
                <TfIcon :name="item.icon" /> <span>{{ item.label }}</span>
              </a>
              <ul v-if="item.page === 'settings' && isActive(item.pages)" class="tf-nav__sub">
                <li v-for="sub in settingsItems" :key="sub.page">
                  <a href="#" class="tf-nav__subitem" :class="{ 'is-active': route.page === sub.page }"
                     @click.prevent="go({ page: sub.page, ws: workspace.name })">{{ sub.label }}</a>
                </li>
              </ul>
            </li>
          </ul>
        </template>
        <ul v-else class="tf-nav__list">
          <li v-for="item in orgItems" :key="item.page">
            <a href="#" class="tf-nav__item" :class="{ 'is-active': isActive(item.pages) }"
               :aria-current="isActive(item.pages) ? 'page' : undefined"
               @click.prevent="go({ page: item.page })">
              <TfIcon :name="item.icon" /> <span>{{ item.label }}</span>
            </a>
          </li>
        </ul>
      </nav>

      <div class="tf-nav__foot">
        <button type="button" class="tf-nav__item" @click="notify('info', 'Help & Support', 'Terraform documentation lives at developer.hashicorp.com/terraform. This workspace runs the lab\'s simulated Terraform ' + version + '.')">
          <TfIcon name="help" /> <span>Help &amp; Support</span>
        </button>
        <div class="tf-nav__user">
          <span class="tf-nav__avatar">S</span>
          <span class="tf-nav__user-name">selfstudy-student</span>
        </div>
      </div>
    </aside>
    <div v-if="navOpen" class="tf-scrim" @click="navOpen = false"></div>

    <!-- ===== Main ===== -->
    <div class="tf-main">
      <header class="tf-top">
        <button type="button" class="tf-top__burger" aria-label="Open menu" @click="navOpen = true">
          <TfIcon name="menu" />
        </button>
        <nav class="tf-crumbs" aria-label="Breadcrumb">
          <ol>
            <li v-for="(crumb, index) in crumbs" :key="index">
              <TfIcon v-if="index === 0" name="folder" :size="14" class="tf-crumbs__icon" />
              <a v-if="crumb.route && index < crumbs.length - 1" href="#" @click.prevent="go(crumb.route)">{{ crumb.label }}</a>
              <span v-else>{{ crumb.label }}</span>
              <span v-if="index < crumbs.length - 1" class="tf-crumbs__sep">/</span>
            </li>
          </ol>
        </nav>
        <span v-if="busyNow" class="tf-top__busy"><TfIcon name="loading" :size="14" /> Working…</span>
      </header>

      <main ref="mainEl" class="tf-content">
        <component :is="pageComponent" :key="pageKey" />
      </main>
    </div>

    <!-- ===== Toasts (Helios Toast) ===== -->
    <div class="tf-toasts" aria-live="polite">
      <div v-for="flash in api.flashes.value" :key="flash.id" class="tf-toast" :class="'tf-toast--' + toneOf(flash.type)" role="status">
        <TfIcon :name="iconOf(flash.type)" class="tf-toast__icon" />
        <div class="tf-toast__body">
          <div class="tf-toast__title">{{ flash.title }}</div>
          <pre v-if="flash.detail" class="tf-toast__detail">{{ flash.detail }}</pre>
        </div>
        <button type="button" class="tf-toast__close" aria-label="Dismiss" @click="api.dismiss(flash.id)">
          <TfIcon name="x" />
        </button>
      </div>
    </div>

    <!-- ===== Confirmation modal (Helios Modal) ===== -->
    <div v-if="dialog" class="tf-modal-back" @keydown.esc="answer(false)">
      <div class="tf-modal" :class="{ 'tf-modal--critical': dialog.destructive }" role="dialog" aria-modal="true" :aria-label="dialog.title">
        <div class="tf-modal__head">
          <TfIcon :name="dialog.destructive ? 'alert-triangle' : 'info'" class="tf-modal__head-icon" />
          <h2 class="tf-modal__title">{{ dialog.title }}</h2>
          <button type="button" class="tf-modal__x" aria-label="Dismiss" @click="answer(false)"><TfIcon name="x" /></button>
        </div>
        <div class="tf-modal__body">
          <p class="tf-modal__message">{{ dialog.message }}</p>
          <div v-if="dialog.typeToConfirm" class="tf-modal__type">
            <label class="tf-modal__type-label" for="tf-confirm-input">
              To confirm, type <strong>{{ dialog.typeToConfirm }}</strong> below.
            </label>
            <input id="tf-confirm-input" ref="confirmInput" v-model="typed" class="tf-modal__input" autocomplete="off" @keydown.enter="typedOk && answer(true)" />
          </div>
        </div>
        <div class="tf-modal__foot">
          <button type="button" class="tf-mbtn" :class="dialog.destructive ? 'tf-mbtn--critical' : 'tf-mbtn--primary'"
                  :disabled="!typedOk" @click="answer(true)">{{ dialog.yes }}</button>
          <button type="button" class="tf-mbtn tf-mbtn--secondary" @click="answer(false)">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * HCP Terraform (app.terraform.io, Helios design system) over the lab's
 * Terraform engine.
 *
 * This file is the chrome - side navigation, breadcrumbs, toasts, the
 * confirmation modal - and the page switch. Every page reads the shell through
 * `useTf()` (tfContext.ts), and every write is a command line built in
 * tfKit.ts. The workspace the student opens IS a Terraform CLI workspace: the
 * engine's runs, state versions, variables and locks are all reachable from the
 * console too.
 */
import { computed, nextTick, onBeforeUnmount, provide, ref, toRef, watch, type Component } from 'vue';
import { pick, type PortalResult } from '@/utils/portalKit';
import type { LabTool } from '@/utils/labCatalogue';
import type { FlashType, PortalApi } from '../usePortal';
import TfIcon from './TfIcon.vue';
import TfWorkspaces from './TfWorkspaces.vue';
import TfProjects from './TfProjects.vue';
import TfNewWorkspace from './TfNewWorkspace.vue';
import TfOverview from './TfOverview.vue';
import TfRuns from './TfRuns.vue';
import TfRun from './TfRun.vue';
import TfStates from './TfStates.vue';
import TfVariables from './TfVariables.vue';
import TfSettings from './TfSettings.vue';
import TfOrgPages from './TfOrgPages.vue';
import { TF, type ConfirmRequest, type RunOptions } from './tfContext';
import {
  cmdInit, cmdWorkspace, org, routeUrl, runsOf, variablesOf, workspacesOf, WS_PAGES,
  type Page, type Route,
} from './tfKit';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const view = toRef(props, 'view');
const orgName = computed(() => org(view.value));
const version = computed(() => String(pick(view.value, 'version', '')));
const workspaces = computed(() => workspacesOf(view.value));
const runs = computed(() => runsOf(view.value));
const variables = computed(() => variablesOf(view.value));
const busyNow = computed(() => Boolean(props.busy) || props.api.busy.value);

const route = ref<Route>({ page: 'workspaces' });
const navOpen = ref(false);
const orgOpen = ref(false);
const now = ref(Date.now());
const timer = window.setInterval(() => { now.value = Date.now(); }, 20000);
onBeforeUnmount(() => window.clearInterval(timer));

const inWorkspace = computed(() => WS_PAGES.includes(route.value.page) && Boolean(route.value.ws));
const workspace = computed(() => {
  if (!route.value.ws) return null;
  return workspaces.value.find(item => item.name === route.value.ws) || null;
});

function go(next: Route) {
  route.value = { ...next };
  navOpen.value = false;
  orgOpen.value = false;
}

const mainEl = ref<HTMLElement | null>(null);
watch([route, orgName], () => emit('location', routeUrl(route.value, orgName.value)), { immediate: true, deep: true });
watch(route, () => { if (mainEl.value) mainEl.value.scrollTop = 0; }, { deep: true });

// A workspace deleted from the console must not leave the page on it.
watch(workspaces, list => {
  if (route.value.ws && !list.some(item => item.name === route.value.ws)) go({ page: 'workspaces' });
});

async function run(command: string, options: RunOptions = {}): Promise<PortalResult> {
  return props.api.exec(command, {
    success: options.success,
    quiet: options.quiet,
    failure: options.failure,
  });
}

function notify(type: 'success' | 'error' | 'info' | 'warning', title: string, detail = '') {
  props.api.notify(type, title, detail);
}

/**
 * Opening a workspace makes it the CLI's current one (`terraform workspace
 * select`), because a run, a state and a lock all act on the selected
 * workspace - exactly as `TF_WORKSPACE` decides it for a CLI-driven run.
 */
async function openWorkspace(name: string, page: Page = 'overview') {
  const target = workspaces.value.find(item => item.name === name);
  if (target && !target.current) {
    const result = await run(cmdWorkspace('select', name));
    if (!result.ok) return;
  }
  go({ page, ws: name });
}

async function ensureInit(): Promise<boolean> {
  if (pick(view.value, 'initialised', false)) return true;
  const result = await run(cmdInit(), { failure: 'Terraform init failed' });
  return result.ok;
}

// ---- confirmation modal -------------------------------------------------
const dialog = ref<ConfirmRequest | null>(null);
const typed = ref('');
const confirmInput = ref<HTMLInputElement | null>(null);
let resolver: ((value: boolean) => void) | null = null;
const typedOk = computed(() => !dialog.value?.typeToConfirm || typed.value === dialog.value.typeToConfirm);

function confirm(request: ConfirmRequest): Promise<boolean> {
  if (resolver) resolver(false);
  dialog.value = request;
  typed.value = '';
  nextTick(() => confirmInput.value?.focus());
  return new Promise(done => { resolver = done; });
}

function answer(value: boolean) {
  const done = resolver;
  resolver = null;
  dialog.value = null;
  if (done) done(value);
}

provide(TF, {
  view, org: orgName, route, now, busy: busyNow, workspaces, workspace, runs, variables,
  go, openWorkspace, run, ensureInit, notify, confirm,
});

// ---- navigation ------------------------------------------------------------
const orgItems: { page: Page; label: string; icon: string; pages: Page[] }[] = [
  { page: 'workspaces', label: 'Projects & workspaces', icon: 'folder', pages: ['workspaces', 'projects', 'new-workspace'] },
  { page: 'registry', label: 'Registry', icon: 'box', pages: ['registry'] },
  { page: 'usage', label: 'Usage', icon: 'chart', pages: ['usage'] },
  { page: 'org-settings', label: 'Settings', icon: 'settings', pages: ['org-settings'] },
];
const wsItems: { page: Page; label: string; icon: string; pages: Page[] }[] = [
  { page: 'overview', label: 'Overview', icon: 'home', pages: ['overview'] },
  { page: 'runs', label: 'Runs', icon: 'list', pages: ['runs', 'run'] },
  { page: 'states', label: 'States', icon: 'layers', pages: ['states', 'state'] },
  { page: 'variables', label: 'Variables', icon: 'code', pages: ['variables'] },
  { page: 'settings', label: 'Settings', icon: 'settings', pages: ['settings', 'locking', 'destruction'] },
];
const settingsItems: { page: Page; label: string }[] = [
  { page: 'settings', label: 'General' },
  { page: 'locking', label: 'Locking' },
  { page: 'destruction', label: 'Destruction and Deletion' },
];

function isActive(pages: Page[]) {
  return pages.includes(route.value.page);
}

const crumbs = computed(() => {
  const list: { label: string; route?: Route }[] = [{ label: orgName.value, route: { page: 'workspaces' } }];
  const page = route.value.page;
  if (page === 'projects') list.push({ label: 'Projects' });
  else if (page === 'new-workspace') list.push({ label: 'Workspaces', route: { page: 'workspaces' } }, { label: 'New workspace' });
  else if (page === 'registry') list.push({ label: 'Registry' });
  else if (page === 'usage') list.push({ label: 'Usage' });
  else if (page === 'org-settings') list.push({ label: 'Settings' });
  else if (page === 'workspaces') list.push({ label: 'Workspaces' });
  else if (route.value.ws) {
    const ws = route.value.ws;
    list.push({ label: 'Projects', route: { page: 'projects' } });
    list.push({ label: 'Default Project', route: { page: 'workspaces' } });
    list.push({ label: ws, route: { page: 'overview', ws } });
    const labels: Partial<Record<Page, string>> = {
      runs: 'Runs', run: 'Runs', states: 'States', state: 'States', variables: 'Variables',
      settings: 'Settings', locking: 'Settings', destruction: 'Settings',
    };
    if (labels[page]) list.push({ label: labels[page]!, route: { page: page === 'run' ? 'runs' : page === 'state' ? 'states' : page, ws } });
    if (page === 'run' || page === 'state') list.push({ label: route.value.id || '' });
  }
  return list;
});

const PAGES: Record<string, Component> = {
  workspaces: TfWorkspaces, projects: TfProjects, 'new-workspace': TfNewWorkspace,
  overview: TfOverview, runs: TfRuns, run: TfRun, states: TfStates, state: TfStates,
  variables: TfVariables, settings: TfSettings, locking: TfSettings, destruction: TfSettings,
  registry: TfOrgPages, usage: TfOrgPages, 'org-settings': TfOrgPages,
};
const pageComponent = computed(() => {
  if (WS_PAGES.includes(route.value.page) && !workspace.value) return TfWorkspaces;
  return PAGES[route.value.page] || TfWorkspaces;
});
const pageKey = computed(() => `${route.value.page}:${route.value.ws || ''}:${route.value.id || ''}`);

function toneOf(type: FlashType) {
  return type === 'error' ? 'critical' : type === 'progress' ? 'neutral' : type;
}
function iconOf(type: FlashType) {
  return type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle'
    : type === 'warning' ? 'alert-triangle' : 'info';
}
</script>

<style scoped>
.tf-app {
  /* Helios semantic tokens (light theme) + the Terraform brand. */
  --tf-fg-strong: #0c0c0e;
  --tf-fg-primary: #3b3d45;
  --tf-fg-faint: #656a76;
  --tf-fg-disabled: #8c909c;
  --tf-fg-action: #1060ff;
  --tf-fg-action-hover: #0c56e9;
  --tf-fg-critical: #e52228;
  --tf-fg-success: #008a22;
  --tf-fg-warning: #bb5a00;
  --tf-fg-highlight: #a737ff;
  --tf-surface: #ffffff;
  --tf-surface-faint: #fafafa;
  --tf-surface-strong: #f1f2f3;
  --tf-surface-action: #f2f8ff;
  --tf-surface-critical: #fff5f5;
  --tf-surface-success: #f2fbf6;
  --tf-surface-warning: #fff9e8;
  --tf-border: #656a7633;
  --tf-border-faint: #656a761a;
  --tf-border-strong: #3b3d4566;
  --tf-border-strong-ish: #656a7640;
  --tf-border-input: #8c909c;
  --tf-btn-primary: #1060ff;
  --tf-btn-primary-border: #0c56e9;
  --tf-btn-primary-hover: #0c56e9;
  --tf-focus: #5990ff;
  --tf-brand: #7b42bc;
  --tf-nav-bg: #0c0c0e;
  --tf-nav-fg: #d5d7db;
  --tf-nav-faint: #b2b6bd;
  --tf-nav-hover: #3b3d45;
  --tf-nav-active: #656a76;
  --tf-mono: ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace;

  position: relative;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  overflow: clip;
  background: var(--tf-surface);
  color: var(--tf-fg-primary);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 20px;
  text-align: left;
  color-scheme: light;
}
.tf-app :deep(*) { scrollbar-color: #c2c5cb transparent; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; letter-spacing: normal; min-height: 0; min-width: 0; border-radius: 0; font-weight: inherit; line-height: inherit; }
input { font: inherit; letter-spacing: normal; min-height: 0; }
a { text-decoration: none; }
h2 { margin: 0; letter-spacing: normal; text-wrap: wrap; }
p { margin: 0; color: inherit; }
pre { background: none; border-radius: 0; margin: 0; }
ol, ul { margin: 0; padding: 0; list-style: none; }
label { color: inherit; }

/* ---- side nav ---- */
.tf-nav {
  display: flex; flex-direction: column; min-height: 0; overflow-y: auto;
  background: var(--tf-nav-bg); color: var(--tf-nav-fg);
}
.tf-nav__head { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 12px; }
.tf-nav__brand { display: inline-flex; align-items: center; gap: 10px; color: #fff; }
.tf-nav__brand:hover { color: #fff; text-decoration: none; }
.tf-nav__mark { display: inline-grid; place-items: center; width: 32px; height: 32px; color: #a067da; }
.tf-nav__wordmark { font-size: 15px; font-weight: 600; letter-spacing: 0.01em; color: #fff; }
.tf-nav__close { display: none; color: var(--tf-nav-fg); padding: 6px; border-radius: 5px; }
.tf-nav__org { position: relative; padding: 0 12px 12px; }
.tf-nav__org-btn {
  display: grid; grid-template-columns: 1fr auto; text-align: left; width: 100%;
  padding: 7px 10px; border: 1px solid #3b3d45; border-radius: 5px; background: #15181e;
}
.tf-nav__org-btn:hover { background: var(--tf-nav-hover); }
.tf-nav__org-label { grid-column: 1; font-size: 12px; color: var(--tf-nav-faint); line-height: 16px; }
.tf-nav__org-name { grid-column: 1; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; }
.tf-nav__org-chev { grid-column: 2; grid-row: 1 / span 2; align-self: center; color: var(--tf-nav-faint); }
.tf-nav__org-menu {
  position: absolute; left: 12px; right: 12px; top: 100%; z-index: 20; margin-top: -6px;
  background: #fff; color: var(--tf-fg-primary); border-radius: 6px; padding: 6px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
}
.tf-nav__org-menu-title { font-size: 12px; font-weight: 600; color: var(--tf-fg-faint); padding: 4px 8px; }
.tf-nav__org-item { display: flex; gap: 6px; align-items: center; width: 100%; padding: 6px 8px; border-radius: 5px; font-weight: 500; color: var(--tf-fg-strong); }
.tf-nav__org-item:hover { background: var(--tf-surface-strong); }
.tf-nav__org-menu-note { font-size: 12px; color: var(--tf-fg-faint); padding: 4px 8px; }
.tf-nav__body { flex: 1; padding: 4px 12px; }
.tf-nav__back { display: inline-flex; align-items: center; gap: 4px; padding: 6px 6px; font-size: 13px; color: var(--tf-nav-faint); }
.tf-nav__back:hover { color: #fff; text-decoration: none; }
.tf-nav__context { display: flex; flex-direction: column; padding: 8px 8px 12px; border-bottom: 1px solid #3b3d45; margin-bottom: 8px; }
.tf-nav__context-kind { font-size: 12px; color: var(--tf-nav-faint); }
.tf-nav__context-name { font-size: 15px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tf-nav__list { display: flex; flex-direction: column; gap: 2px; }
.tf-nav__item {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; border-radius: 5px;
  color: var(--tf-nav-fg); font-size: 14px; font-weight: 500; text-align: left;
}
.tf-nav__item:hover { background: var(--tf-nav-hover); color: #fff; text-decoration: none; }
.tf-nav__item.is-active { background: var(--tf-nav-active); color: #fff; }
.tf-nav__sub { padding: 2px 0 4px 34px; display: flex; flex-direction: column; gap: 1px; }
.tf-nav__subitem { display: block; padding: 5px 8px; border-radius: 5px; font-size: 13px; color: var(--tf-nav-faint); }
.tf-nav__subitem:hover { background: var(--tf-nav-hover); color: #fff; text-decoration: none; }
.tf-nav__subitem.is-active { color: #fff; font-weight: 600; background: #2a2c33; }
.tf-nav__foot { padding: 8px 12px 14px; border-top: 1px solid #3b3d45; display: flex; flex-direction: column; gap: 6px; }
.tf-nav__user { display: flex; align-items: center; gap: 10px; padding: 4px 8px; font-size: 13px; color: var(--tf-nav-fg); }
.tf-nav__avatar { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--tf-brand); color: #fff; font-size: 12px; font-weight: 600; }

/* ---- main ---- */
.tf-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.tf-top {
  display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 32px;
  border-bottom: 1px solid var(--tf-border); background: var(--tf-surface);
}
.tf-top__burger { display: none; padding: 6px; border-radius: 5px; color: var(--tf-fg-primary); }
.tf-top__burger:hover { background: var(--tf-surface-strong); }
.tf-crumbs { min-width: 0; flex: 1; overflow: hidden; }
.tf-crumbs ol { display: flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 13px; color: var(--tf-fg-faint); overflow: hidden; }
.tf-crumbs li { display: inline-flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; flex: none; }
.tf-crumbs li:last-child { flex: 0 1 auto; }
.tf-crumbs li:last-child span { color: var(--tf-fg-strong); font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
.tf-crumbs a { color: var(--tf-fg-faint); }
.tf-crumbs a:hover { color: var(--tf-fg-action); text-decoration: underline; }
.tf-crumbs__sep { color: #8c909c; }
.tf-crumbs__icon { color: var(--tf-fg-faint); }
.tf-top__busy { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; color: var(--tf-fg-faint); }
.tf-content { flex: 1; min-height: 0; overflow: auto; background: var(--tf-surface); }

/* ---- toasts ---- */
.tf-toasts { position: absolute; right: 16px; bottom: 16px; z-index: 70; display: flex; flex-direction: column; gap: 8px; width: min(400px, calc(100% - 32px)); }
.tf-toast {
  display: flex; gap: 10px; padding: 14px 14px 14px 16px; border-radius: 6px; border: 1px solid;
  background: #fff; box-shadow: 0 2px 3px rgba(101, 106, 118, 0.15), 0 16px 16px -10px rgba(101, 106, 118, 0.2);
}
.tf-toast--success { border-color: #cceeda; background: var(--tf-surface-success); }
.tf-toast--success .tf-toast__icon { color: var(--tf-fg-success); }
.tf-toast--critical { border-color: #fbd4d4; background: var(--tf-surface-critical); }
.tf-toast--critical .tf-toast__icon { color: var(--tf-fg-critical); }
.tf-toast--warning { border-color: #fbeabf; background: var(--tf-surface-warning); }
.tf-toast--warning .tf-toast__icon { color: var(--tf-fg-warning); }
.tf-toast--info, .tf-toast--neutral { border-color: #cce3fe; background: var(--tf-surface-action); }
.tf-toast--info .tf-toast__icon { color: var(--tf-fg-action); }
.tf-toast__icon { margin-top: 2px; }
.tf-toast__body { flex: 1; min-width: 0; }
.tf-toast__title { font-weight: 600; color: var(--tf-fg-strong); }
.tf-toast__detail { margin-top: 4px; font-family: inherit; font-size: 13px; line-height: 18px; color: var(--tf-fg-primary); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 180px; overflow: auto; }
.tf-toast__close { align-self: flex-start; padding: 2px; color: var(--tf-fg-primary); border-radius: 4px; }
.tf-toast__close:hover { background: rgba(0, 0, 0, 0.06); }

/* ---- modal ---- */
.tf-modal-back { position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: rgba(59, 61, 69, 0.4); }
.tf-modal { width: min(480px, 100%); max-height: 100%; display: flex; flex-direction: column; background: #fff; border-radius: 8px; box-shadow: 0 2px 3px rgba(59,61,69,.25), 0 16px 32px rgba(59,61,69,.3); overflow: hidden; }
.tf-modal__head { display: flex; align-items: center; gap: 10px; padding: 16px 20px; background: var(--tf-surface-faint); border-bottom: 1px solid var(--tf-border); }
.tf-modal--critical .tf-modal__head { background: var(--tf-surface-critical); border-bottom-color: #fbd4d4; }
.tf-modal--critical .tf-modal__head-icon { color: var(--tf-fg-critical); }
.tf-modal__title { flex: 1; font-size: 18px; line-height: 24px; font-weight: 600; color: var(--tf-fg-strong); }
.tf-modal__x { padding: 4px; border-radius: 4px; color: var(--tf-fg-primary); }
.tf-modal__x:hover { background: rgba(0, 0, 0, 0.06); }
.tf-modal__body { padding: 20px; overflow: auto; min-height: 0; }
.tf-modal__message { white-space: pre-line; color: var(--tf-fg-primary); }
.tf-modal__type { margin-top: 16px; display: flex; flex-direction: column; gap: 6px; }
.tf-modal__type-label { font-size: 14px; color: var(--tf-fg-primary); }
.tf-modal__input { min-height: 36px; padding: 7px 11px; border: 1px solid var(--tf-border-input); border-radius: 5px; background: #fff; color: var(--tf-fg-strong); }
.tf-modal__input:focus { outline: 3px solid var(--tf-focus); }
.tf-modal__foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 20px; border-top: 1px solid var(--tf-border); background: var(--tf-surface-faint); }
.tf-mbtn { display: inline-flex; align-items: center; min-height: 36px; padding: 0 15px; border: 1px solid transparent; border-radius: 5px; font-weight: 500; font-size: 14px; }
.tf-mbtn--primary { background: var(--tf-btn-primary); border-color: var(--tf-btn-primary-border); color: #fff; }
.tf-mbtn--critical { background: #c00005; border-color: #a7000e; color: #fff; }
.tf-mbtn--secondary { background: var(--tf-surface-faint); border-color: var(--tf-border-strong); color: var(--tf-fg-primary); }
.tf-mbtn:disabled { background: var(--tf-surface-strong); border-color: var(--tf-border); color: var(--tf-fg-disabled); cursor: not-allowed; }

.tf-scrim { display: none; }

@container sl-portal (max-width: 900px) {
  .tf-app { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
  .tf-nav {
    position: absolute; inset: 0 auto 0 0; width: min(280px, 86%); z-index: 40;
    transform: translateX(-100%); transition: transform 0.18s ease; box-shadow: 4px 0 20px rgba(0,0,0,.3);
  }
  .tf-nav.is-open { transform: none; }
  .tf-nav__close { display: inline-flex; }
  .tf-scrim { display: block; position: absolute; inset: 0; z-index: 35; background: rgba(12, 12, 14, 0.45); }
  .tf-top { padding: 0 12px; }
  .tf-top__burger { display: inline-flex; }
  .tf-crumbs li:not(:nth-last-child(-n+2)) { display: none; }
  .tf-toasts { top: 56px; bottom: auto; right: 8px; width: calc(100% - 16px); }
}
</style>
