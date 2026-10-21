<template>
  <div class="dbt-app" :class="{ 'is-nav-open': navOpen }" dir="ltr">
    <!-- ===== The dbt Cloud left navigation (2024+ layout) ===== -->
    <aside class="dbt-nav" aria-label="dbt Cloud">
      <div class="dbt-nav__brand">
        <svg class="dbt-logo" viewBox="0 0 32 32" aria-hidden="true">
          <path fill="#FF694A" d="M28.6 3.4c.7.7 1.2 1.7 1.3 2.7 0 .4-.1.7-.2 1.1-.2.3-2.3 3.9-3.2 5.4.6 1 1 2.1 1 3.3 0 1.2-.4 2.3-1 3.3 1 1.5 3 5.1 3.2 5.4.1.3.2.7.2 1.1-.1 1-.6 2-1.3 2.7-.7.7-1.7 1.1-2.7 1.2-.4 0-.7-.1-1.1-.3-.3-.2-3.9-2.2-5.4-3.2-1 .6-2.1 1-3.3 1-1.2 0-2.3-.4-3.3-1-1.5 1-5.1 3-5.4 3.2-.3.2-.7.3-1.1.3-1-.1-2-.5-2.7-1.2-.7-.7-1.2-1.7-1.3-2.7 0-.4.1-.7.3-1.1.2-.3 2.2-3.9 3.2-5.4-.6-1-1-2.1-1-3.3 0-1.2.4-2.3 1-3.3-1-1.5-3-5.1-3.2-5.4-.2-.4-.3-.7-.3-1.1.1-1 .6-2 1.3-2.7.7-.7 1.7-1.1 2.7-1.2.4 0 .7.1 1.1.3.3.1 3.5 2 5.2 3 .4.2.7.2 1.1 0 .6-.3 1.2-.4 1.9-.4.7 0 1.4.1 2 .4.3.2.7.2 1.1 0 1.7-1 4.9-2.9 5.2-3 .3-.2.7-.3 1.1-.3 1 .1 2 .5 2.7 1.2z" />
          <circle cx="16" cy="16" r="2.4" fill="#1B2033" />
        </svg>
        <div class="dbt-nav__account">
          <strong>ShopFlow</strong>
          <span>Enterprise</span>
        </div>
        <button type="button" class="dbt-nav__close" aria-label="Close navigation" @click="navOpen = false">
          <DbtIcon name="close" />
        </button>
      </div>
      <button type="button" class="dbt-nav__project" :title="'Project: ' + projectLabel">
        <span class="dbt-nav__project-name">{{ projectLabel }}</span>
        <DbtIcon name="chevron-down" />
      </button>

      <nav class="dbt-nav__list">
        <span class="dbt-nav__group">Develop</span>
        <button type="button" :class="{ 'is-active': section === 'develop' }" @click="go({ page: 'develop' })">
          <DbtIcon name="code" /><span>Studio IDE</span>
        </button>
        <span class="dbt-nav__group">Deploy</span>
        <button type="button" :class="{ 'is-active': section === 'runs' }" @click="go({ page: 'runs' })">
          <DbtIcon name="history" /><span>Run history</span>
        </button>
        <button type="button" :class="{ 'is-active': section === 'jobs' }" @click="go({ page: 'jobs' })">
          <DbtIcon name="jobs" /><span>Jobs</span>
        </button>
        <button type="button" :class="{ 'is-active': section === 'environments' }" @click="go({ page: 'environments' })">
          <DbtIcon name="env" /><span>Environments</span>
        </button>
        <span class="dbt-nav__group">Explore</span>
        <button type="button" :class="{ 'is-active': section === 'explore' }" @click="go({ page: 'explore' })">
          <DbtIcon name="compass" /><span>Catalog</span>
        </button>
        <button type="button" :class="{ 'is-active': section === 'lineage' }" @click="go({ page: 'lineage' })">
          <DbtIcon name="lineage" /><span>Lineage</span>
        </button>
      </nav>

      <div class="dbt-nav__foot">
        <button type="button" @click="notify('info', 'Account settings', 'Connections, credentials and users are managed by the lab - this simulated account has one Snowflake connection.')">
          <DbtIcon name="settings" /><span>Settings</span>
        </button>
        <button type="button" @click="notify('info', 'dbt documentation', 'https://docs.getdbt.com - the lab is offline, so the docs open outside it.')">
          <DbtIcon name="help" /><span>Help &amp; docs</span>
        </button>
        <div class="dbt-nav__user"><span class="dbt-avatar">S</span><span>student@shopflow.io</span></div>
      </div>
    </aside>

    <div class="dbt-main">
      <header class="dbt-top">
        <button type="button" class="dbt-top__burger" aria-label="Open navigation" @click="navOpen = true">
          <DbtIcon name="menu" />
        </button>
        <span class="dbt-top__title">{{ topTitle }}</span>
        <span class="dbt-spacer"></span>
        <span class="dbt-top__clock" title="Simulated time">
          <DbtIcon name="clock" /> {{ timeText }}
        </span>
        <span class="dbt-top__env" :title="'dbt ' + version">dbt {{ version }} · Snowflake</span>
      </header>

      <main class="dbt-content">
        <DevelopPage v-if="route.page === 'develop'" />
        <RunsPage v-else-if="route.page === 'runs'" />
        <RunPage v-else-if="route.page === 'run'" :key="'run-' + route.id" />
        <JobsPage v-else-if="route.page === 'jobs'" />
        <JobPage v-else-if="route.page === 'job'" :key="'job-' + route.id" />
        <JobEditor v-else-if="route.page === 'job-edit'" :key="'edit-' + (route.id || 'new')" />
        <EnvironmentsPage v-else-if="route.page === 'environments' || route.page === 'environment'" />
        <LineagePage v-else-if="route.page === 'lineage'" />
        <ExplorePage v-else />
      </main>
    </div>

    <!-- ===== Toasts (dbt Cloud: top right, coloured left edge) ===== -->
    <div class="dbt-toasts" aria-live="polite">
      <div v-for="flash in shownFlashes" :key="flash.id" class="dbt-toast" :class="'dbt-toast--' + flash.type" role="status">
        <DbtIcon :name="flash.type === 'success' ? 'ok' : flash.type === 'error' ? 'bad' : flash.type === 'warning' ? 'warn' : 'info'"
                 class="dbt-toast__icon" />
        <div class="dbt-toast__body">
          <strong>{{ flash.title }}</strong>
          <span v-if="flash.detail">{{ flash.detail }}</span>
        </div>
        <button type="button" class="dbt-toast__x" aria-label="Dismiss" @click="api.dismiss(flash.id)"><DbtIcon name="close" /></button>
      </div>
    </div>

    <DbtModal v-if="pending" :title="pending.title" :ok-text="pending.yes || 'Confirm'" :danger="pending.danger"
              :ok-disabled="!!pending.typed && typedValue !== pending.typed" @close="answer(false)" @ok="answer(true)">
      <p class="dbt-confirm">{{ pending.message }}</p>
      <label v-if="pending.typed" class="dbt-field">
        <span>Type <code class="dbt-mono">{{ pending.typed }}</code> to confirm</span>
        <input v-model="typedValue" class="dbt-input" :placeholder="pending.typed" />
      </label>
    </DbtModal>
  </div>
</template>

<script setup lang="ts">
/**
 * dbt Cloud over the lab's dbt project.
 *
 * Develop is the Studio IDE: the project's files (read from the lab's
 * workspace, edited in the Files tool), a preview grid, compiled SQL, a
 * lineage mini-graph and the command bar that runs `dbt ...` lines in the
 * Development environment. Deploy is environments, jobs and the run history -
 * `dbt-cloud ...` lines over `dbtcloud.py`, where "Run now" really runs every
 * job step through dbt Core against the environment's target. Explore is the
 * catalog and the project DAG. Every action is a command a student could type.
 */
import { computed, provide, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { pick, rows } from '@/utils/portalKit';
import DbtIcon from './DbtIcon.vue';
import DbtModal from './DbtModal.vue';
import DevelopPage from './DevelopPage.vue';
import RunsPage from './RunsPage.vue';
import RunPage from './RunPage.vue';
import JobsPage from './JobsPage.vue';
import JobPage from './JobPage.vue';
import JobEditor from './JobEditor.vue';
import EnvironmentsPage from './EnvironmentsPage.vue';
import ExplorePage from './ExplorePage.vue';
import LineagePage from './LineagePage.vue';
import { DBT, type ConfirmRequest, type DbtContext, type IdeInvocation, type RunOptions } from './dbtContext';
import {
  buildGraph, clockStamp, routeUrl, type CloudEnv, type CloudJob, type CloudRun, type DbtCoreRun,
  type DbtExposure, type DbtModel, type DbtRoute, type DbtSeedLike, type DbtSource, type DbtTest, type FileItem,
} from './dbt';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const v = computed(() => props.view || {});
const version = computed(() => String(pick(v.value, 'dbt.version', '1.8.7')));
const project = computed(() => pick<Record<string, any>>(v.value, 'dbt.project', {}));
const models = computed(() => rows<DbtModel>(v.value, 'dbt.models'));
const sources = computed(() => rows<DbtSource>(v.value, 'dbt.sources'));
const seeds = computed(() => rows<DbtSeedLike>(v.value, 'dbt.seeds'));
const snapshots = computed(() => rows<DbtSeedLike>(v.value, 'dbt.snapshots'));
const tests = computed(() => rows<DbtTest>(v.value, 'dbt.tests'));
const exposures = computed(() => rows<DbtExposure>(v.value, 'dbt.exposures'));
const coreRuns = computed(() => rows<DbtCoreRun>(v.value, 'dbt.runs'));
const envs = computed(() => rows<CloudEnv>(v.value, 'dbt.cloud.environments'));
const jobs = computed(() => rows<CloudJob>(v.value, 'dbt.cloud.jobs'));
const cloudRuns = computed(() => rows<CloudRun>(v.value, 'dbt.cloud.runs'));
const files = computed(() => rows<FileItem>(v.value, 'dbt.files.items'));
const fileDirs = computed(() => {
  const list = pick<unknown>(v.value, 'dbt.files.dirs', []);
  return Array.isArray(list) ? list.map(String) : [];
});
const docsGenerated = computed(() => Boolean(pick(v.value, 'dbt.docs_generated', false)));
const parsed = computed(() => Boolean(project.value.name) || models.value.length > 0 || sources.value.length > 0);
const nowStamp = computed(() => clockStamp(Number(pick(v.value, 'clock', 0))));
const timeText = computed(() => String(pick(v.value, 'time', '')));
const busy = computed(() => Boolean(props.busy));
const projectLabel = computed(() => `Analytics${project.value.name ? ' (' + project.value.name + ')' : ''}`);

const route = ref<DbtRoute>({ page: 'develop' });
const navOpen = ref(false);

const section = computed(() => {
  const page = route.value.page;
  if (page === 'run') return 'runs';
  if (page === 'job' || page === 'job-edit') return 'jobs';
  if (page === 'environment') return 'environments';
  if (page === 'resource') return 'explore';
  return page;
});
const topTitle = computed(() => ({
  develop: 'Studio IDE', runs: 'Run history', jobs: 'Jobs', environments: 'Environments',
  explore: 'Catalog', lineage: 'Lineage',
} as Record<string, string>)[section.value] || 'dbt Cloud');

function go(next: DbtRoute) {
  route.value = next;
  navOpen.value = false;
}

watch(route, value => emit('location', routeUrl(value)), { immediate: true, deep: true });

async function run(command: string, options: RunOptions = {}) {
  return props.api.exec(command, { success: options.success, quiet: options.quiet, unlogged: options.unlogged });
}

const ide = ref<IdeInvocation[]>([]);
let ideSeq = 0;
async function ideRun(command: string): Promise<IdeInvocation> {
  const result = await props.api.exec(command, { quiet: true });
  const entry: IdeInvocation = {
    id: ++ideSeq, command, ok: Boolean(result.ok),
    output: String(result.ok ? result.output || '' : result.error || result.output || ''),
    data: result.data || null, at: nowStamp.value,
  };
  ide.value = [entry, ...ide.value].slice(0, 25);
  return entry;
}

const pending = ref<ConfirmRequest | null>(null);
const typedValue = ref('');
let resolver: ((value: boolean) => void) | null = null;
function confirm(request: ConfirmRequest): Promise<boolean> {
  typedValue.value = '';
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

const graphCache = new Map<string, ReturnType<typeof buildGraph>>();
watch(v, () => graphCache.clear());
function graph(withTests = false) {
  const key = withTests ? 't' : 'n';
  if (!graphCache.has(key)) {
    graphCache.set(key, buildGraph({
      models: models.value, sources: sources.value, seeds: seeds.value, snapshots: snapshots.value,
      tests: tests.value, exposures: exposures.value,
    }, withTests));
  }
  return graphCache.get(key)!;
}

function nameOf(uid: string): string {
  const node = graph(true).nodes.get(uid);
  if (node) return node.name;
  return String(uid || '').split('.').slice(2).join('.') || String(uid || '');
}

const ctx: DbtContext = {
  version, project, models, sources, seeds, snapshots, tests, exposures, coreRuns, envs, jobs, cloudRuns,
  files, fileDirs, docsGenerated, parsed, nowStamp, busy, graph, route, go, run, confirm, notify, ide, ideRun, nameOf,
};
provide(DBT, ctx);
</script>

<style scoped src="./dbt.css"></style>
<style scoped>
.dbt-app {
  /* dbt Cloud tokens. */
  --dbt-orange: #FF694A;
  --dbt-nav: #1B2033;
  --dbt-nav-2: #262C44;
  --dbt-nav-ink: #C7CDDD;
  --dbt-nav-muted: #8A93AD;
  --dbt-primary: #047377;
  --dbt-primary-hover: #035A5D;
  --dbt-link: #0B6A8F;
  --dbt-link-hover: #084E6A;
  --dbt-ink: #262A38;
  --dbt-ink-2: #3D4357;
  --dbt-muted: #5C6378;
  --dbt-border: #DCDFE7;
  --dbt-border-light: #ECEEF3;
  --dbt-border-strong: #B9BECB;
  --dbt-bg: #F5F6F8;
  --dbt-bg-2: #F7F8FA;
  --dbt-hover: #F0F2F5;
  --dbt-row-hover: #F4F6F9;
  --dbt-tag: #ECEEF3;
  --dbt-focus: #0B6A8F;
  --dbt-focus-ring: rgba(11, 106, 143, 0.18);
  --dbt-ok: #178A4F;
  --dbt-ok-bg: #E5F5EC;
  --dbt-ok-ink: #0F6639;
  --dbt-bad: #C8352B;
  --dbt-bad-bg: #FDECEA;
  --dbt-bad-ink: #A3261D;
  --dbt-bad-border: #F4C1BC;
  --dbt-warn: #B26100;
  --dbt-warn-bg: #FFF3E0;
  --dbt-warn-ink: #8A4B00;
  --dbt-blue-bg: #E4F1F7;
  --dbt-blue-ink: #0B5675;
  --dbt-orange-bg: #FFEDE8;
  --dbt-orange-ink: #A33B22;
  --dbt-danger: #C8352B;
  --dbt-danger-hover: #A3261D;
  --dbt-code-bg: #F7F8FA;
  --dbt-log-bg: #1E2233;
  --dbt-log-ink: #DCE1EE;
  --dbt-k-source: #3E8E1F;
  --dbt-k-model: #0B7EA3;
  --dbt-k-seed: #7A5AA8;
  --dbt-k-snapshot: #1F6E8C;
  --dbt-k-test: #8C6A00;
  --dbt-k-exposure: #D2502F;
  --dbt-radius: 6px;
  --dbt-font: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --dbt-mono: 'Source Code Pro', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;

  color-scheme: light;
  position: relative; display: flex; height: 100%; min-height: 0; overflow: hidden;
  background: var(--dbt-bg); color: var(--dbt-ink); font-family: var(--dbt-font); font-size: 13px; line-height: 20px;
}

/* ---- navigation ---- */
.dbt-nav {
  flex: none; width: 228px; display: flex; flex-direction: column; background: var(--dbt-nav); color: var(--dbt-nav-ink);
  z-index: 30; min-height: 0;
}
.dbt-nav__brand { display: flex; align-items: center; gap: 10px; padding: 14px 14px 10px; }
.dbt-logo { width: 28px; height: 28px; flex: none; }
.dbt-nav__account { display: flex; flex-direction: column; line-height: 16px; min-width: 0; flex: 1; }
.dbt-nav__account strong { color: #fff; font-size: 14px; font-weight: 600; }
.dbt-nav__account span { color: var(--dbt-nav-muted); font-size: 11px; }
.dbt-nav__close { display: none; border: 0; background: none; color: var(--dbt-nav-ink); cursor: pointer; width: 28px; height: 28px; border-radius: 6px; }
.dbt-nav__project {
  margin: 0 10px 8px; display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12); background: var(--dbt-nav-2); color: #fff; cursor: default; font: 500 13px var(--dbt-font);
}
.dbt-nav__project-name { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dbt-nav__list { flex: 1; display: flex; flex-direction: column; gap: 1px; padding: 4px 8px; overflow: auto; }
.dbt-nav__group { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--dbt-nav-muted); padding: 12px 10px 4px; }
.dbt-nav__list button, .dbt-nav__foot button {
  display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border: 0; border-radius: 6px; background: none;
  color: var(--dbt-nav-ink); font: 500 13px var(--dbt-font); cursor: pointer; text-align: left; position: relative;
}
.dbt-nav__list button .dbt-ico, .dbt-nav__foot button .dbt-ico { width: 16px; height: 16px; }
.dbt-nav__list button:hover, .dbt-nav__foot button:hover { background: rgba(255, 255, 255, 0.07); color: #fff; }
.dbt-nav__list button.is-active { background: rgba(255, 255, 255, 0.11); color: #fff; }
.dbt-nav__list button.is-active::before { content: ''; position: absolute; left: -8px; top: 7px; bottom: 7px; width: 3px; border-radius: 0 2px 2px 0; background: var(--dbt-orange); }
.dbt-nav__foot { padding: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; gap: 1px; }
.dbt-nav__user { display: flex; align-items: center; gap: 8px; padding: 8px 10px 4px; font-size: 12px; color: var(--dbt-nav-muted); overflow: hidden; white-space: nowrap; }
.dbt-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--dbt-orange); color: #1B2033; display: grid; place-items: center; font-weight: 700; font-size: 12px; flex: none; }

/* ---- main ---- */
.dbt-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.dbt-top { flex: none; height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 20px; background: #fff; border-bottom: 1px solid var(--dbt-border); }
.dbt-top__burger { display: none; border: 0; background: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; color: var(--dbt-ink); }
.dbt-top__burger:hover { background: var(--dbt-hover); }
.dbt-top__title { font-weight: 600; font-size: 14px; color: var(--dbt-ink); white-space: nowrap; }
.dbt-top__clock, .dbt-top__env { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dbt-muted); white-space: nowrap; }
.dbt-top__env { padding: 2px 8px; border: 1px solid var(--dbt-border); border-radius: 12px; }
.dbt-content { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

/* ---- toasts ---- */
.dbt-toasts { position: absolute; bottom: 60px; right: 16px; z-index: 80; display: flex; flex-direction: column-reverse; gap: 8px; width: min(380px, calc(100% - 32px)); pointer-events: none; }
.dbt-toast {
  pointer-events: auto; display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; background: #fff; border-radius: 8px;
  border: 1px solid var(--dbt-border); border-left: 4px solid var(--dbt-link); box-shadow: 0 8px 24px rgba(20, 24, 38, 0.16);
}
.dbt-toast--success { border-left-color: var(--dbt-ok); }
.dbt-toast--error { border-left-color: var(--dbt-bad); }
.dbt-toast--warning { border-left-color: var(--dbt-warn); }
.dbt-toast__icon { width: 18px; height: 18px; margin-top: 1px; color: var(--dbt-link); }
.dbt-toast--success .dbt-toast__icon { color: var(--dbt-ok); }
.dbt-toast--error .dbt-toast__icon { color: var(--dbt-bad); }
.dbt-toast--warning .dbt-toast__icon { color: var(--dbt-warn); }
.dbt-toast__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; overflow-wrap: anywhere; font-size: 12px; color: var(--dbt-muted); }
.dbt-toast__body strong { font-size: 13px; color: var(--dbt-ink); font-weight: 600; }
.dbt-toast__x { border: 0; background: none; color: var(--dbt-muted); cursor: pointer; padding: 2px; border-radius: 4px; }
.dbt-toast__x:hover { background: var(--dbt-hover); }
.dbt-confirm { margin: 0; overflow-wrap: anywhere; line-height: 19px; }

@container sl-portal (max-width: 960px) {
  .dbt-nav { position: absolute; top: 0; bottom: 0; left: 0; transform: translateX(-100%); transition: transform 0.18s ease; box-shadow: 0 0 32px rgba(0, 0, 0, 0.3); }
  .dbt-app.is-nav-open .dbt-nav { transform: none; }
  .dbt-nav__close { display: grid; place-items: center; }
  .dbt-top__burger { display: grid; place-items: center; }
  .dbt-top { padding: 0 12px; }
}
@container sl-portal (max-width: 560px) {
  .dbt-top__env { display: none; }
}
</style>
