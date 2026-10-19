<template>
  <div class="af-app" dir="ltr">
    <!-- ===== The 2.9 navbar: pinwheel, DAGs / Cluster Activity / Datasets / Security / Browse / Admin / Docs, clock, user ===== -->
    <header class="af-nav">
      <a href="#" class="af-nav__brand" @click.prevent="go({ page: 'home' })">
        <AfIcon name="logo" /><span>Airflow</span>
      </a>
      <button type="button" class="af-nav__burger" aria-label="Menu" :aria-expanded="navOpen" @click="navOpen = !navOpen">
        <AfIcon name="menu" />
      </button>
      <nav class="af-nav__menu" :class="{ 'is-open': navOpen }" aria-label="Airflow">
        <a href="#" :class="{ 'is-active': section === 'dags' }" @click.prevent="go({ page: 'home' })">DAGs</a>
        <a href="#" :class="{ 'is-active': section === 'cluster' }" @click.prevent="go({ page: 'cluster' })">Cluster Activity</a>
        <a href="#" :class="{ 'is-active': section === 'datasets' }" @click.prevent="go({ page: 'datasets' })">Datasets</a>
        <div v-for="menu in MENUS" :key="menu.label" class="af-nav__drop">
          <button type="button" :class="{ 'is-active': section === menu.key }" :aria-expanded="open === menu.label"
                  @click.stop="open = open === menu.label ? '' : menu.label">
            {{ menu.label }} <AfIcon name="caret" />
          </button>
          <div v-if="open === menu.label" class="af-nav__list" role="menu">
            <button v-for="item in menu.items" :key="item.label" type="button" role="menuitem" @click="pickMenu(item)">
              {{ item.label }}
            </button>
          </div>
        </div>
      </nav>
      <span class="af-spacer"></span>
      <div class="af-nav__right">
        <div class="af-nav__drop">
          <button type="button" class="af-nav__clock" title="Simulated platform clock (UTC)" :aria-expanded="open === 'clock'"
                  @click.stop="open = open === 'clock' ? '' : 'clock'"><AfIcon name="clock" /> {{ clockShort }} UTC</button>
          <div v-if="open === 'clock'" class="af-nav__list af-nav__list--right" role="menu">
            <div class="af-nav__who"><strong>{{ clock || 'UTC' }}</strong><span>The lab's simulated clock - the scheduler follows it</span></div>
            <button v-for="d in ['+15m', '+1h', '+6h', '+1d']" :key="d" type="button" role="menuitem" @click="moveClock(d)">Advance clock {{ d }}</button>
          </div>
        </div>
        <div class="af-nav__drop">
          <button type="button" class="af-nav__user" aria-label="User menu" :aria-expanded="open === 'user'" @click.stop="open = open === 'user' ? '' : 'user'">
            <span class="af-nav__avatar">A</span><AfIcon name="caret" />
          </button>
          <div v-if="open === 'user'" class="af-nav__list af-nav__list--right" role="menu">
            <div class="af-nav__who"><strong>admin</strong><span>Admin</span></div>
            <button type="button" role="menuitem" @click="open = ''; notify('info', 'Your Profile', 'admin (Admin) - authentication is not modelled in this lab.')">Your Profile</button>
            <button type="button" role="menuitem" @click="open = ''; notify('info', 'Log Out', 'This lab keeps you signed in as admin.')">Log Out</button>
          </div>
        </div>
      </div>
    </header>

    <main class="af-main" @click="open = ''">
      <!-- Flask flash messages: Bootstrap alerts at the top of the page. -->
      <div v-if="shownFlashes.length || !schedulerHealthy" class="af-flashes" aria-live="polite">
        <div v-if="!schedulerHealthy" class="af-alert af-alert--warning" role="alert">
          <AfIcon name="warning" />
          <div class="af-alert__body">The scheduler does not appear to be running.
            <template v-if="scheduler.last_heartbeat"> Last heartbeat was received {{ fmtDate(scheduler.last_heartbeat) }}.</template>
            <br />The DAGs list may not update, and new tasks will not be scheduled.</div>
        </div>
        <div v-for="flash in shownFlashes" :key="flash.id" class="af-alert" :class="'af-alert--' + alertType(flash.type)" role="status">
          <div class="af-alert__body">
            <strong v-if="flash.detail">{{ flash.title }}</strong><template v-else>{{ flash.title }}</template>
            <div v-if="flash.detail" class="af-flash-detail">{{ flash.detail }}</div>
          </div>
          <button type="button" class="af-alert__x" aria-label="Close" @click="api.dismiss(flash.id)">&times;</button>
        </div>
      </div>

      <DagsPage v-if="route.page === 'home'" />
      <DagPage v-else-if="route.page === 'dag'" :key="'dag-' + route.dagId" />
      <ClusterActivity v-else-if="route.page === 'cluster'" />
      <DatasetsPage v-else-if="route.page === 'datasets'" />
      <DagRunsPage v-else-if="route.page === 'dagruns'" />
      <TaskInstancesPage v-else-if="route.page === 'tis'" />
      <ConnectionsPage v-else-if="route.page === 'connections'" />
      <VariablesPage v-else-if="route.page === 'variables'" />
      <PoolsPage v-else-if="route.page === 'pools'" />
      <InfoPages v-else />
    </main>

    <AfModal v-if="pending" :title="pending.title" :ok-text="pending.yes || 'OK'" :danger="pending.danger"
             @close="answer(false)" @ok="answer(true)">
      <p class="af-confirm-text">{{ pending.message }}</p>
      <ul v-if="pending.lines && pending.lines.length" class="af-confirm-list">
        <li v-for="line in pending.lines.slice(0, 60)" :key="line">{{ line }}</li>
        <li v-if="pending.lines.length > 60" class="af-muted">… and {{ pending.lines.length - 60 }} more</li>
      </ul>
    </AfModal>
  </div>
</template>

<script setup lang="ts">
/**
 * The Apache Airflow 2.9 web UI over the lab's data platform engine.
 *
 * The engine (`utils/sims/dataplat/airflow.py` on app 11) parses the DAG files
 * the student writes, runs a scheduler on the simulated clock and keeps the
 * metadata database (runs, task instances, connections, variables, pools,
 * XComs). This portal is the webserver's view of that: every button runs the
 * `airflow ...` command a student could type into the Airflow CLI console
 * beside it, so the two can never disagree and a task done here satisfies the
 * same lab checks.
 */
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { pick, rows } from '@/utils/portalKit';
import AfIcon from './AfIcon.vue';
import AfModal from './AfModal.vue';
import DagsPage from './DagsPage.vue';
import DagPage from './DagPage.vue';
import ClusterActivity from './ClusterActivity.vue';
import DatasetsPage from './DatasetsPage.vue';
import DagRunsPage from './DagRunsPage.vue';
import TaskInstancesPage from './TaskInstancesPage.vue';
import ConnectionsPage from './ConnectionsPage.vue';
import VariablesPage from './VariablesPage.vue';
import PoolsPage from './PoolsPage.vue';
import InfoPages from './InfoPages.vue';
import { AF, type AfContext, type ConfirmRequest, type RunOptions } from './afContext';
import { CMD, fmtDate, routeUrl, type AfConnection, type AfDag, type AfPool, type AfRoute, type AfRun, type AfTi, type AfVariable, type AfXcom } from './airflow';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const viewRef = computed(() => props.view || {});
const af = computed<Record<string, any>>(() => pick(viewRef.value, 'airflow', {}));
const version = computed(() => String(pick(af.value, 'version', '2.9.3')));
const executor = computed(() => String(pick(af.value, 'executor', 'CeleryExecutor')));
const dags = computed(() => rows<AfDag>(af.value, 'dags').map(d => ({
  ...d,
  tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
  next_run: d.next_run && String(d.next_run) !== 'None' ? String(d.next_run) : '',
  tasks: Array.isArray(d.tasks) ? d.tasks.filter(t => t && typeof t === 'object').map(t => ({
    ...t,
    upstream: Array.isArray(t.upstream) ? t.upstream.map(String) : [],
    downstream: Array.isArray(t.downstream) ? t.downstream.map(String) : [],
  })) : [],
})));
const runs = computed(() => rows<AfRun>(af.value, 'runs'));
const tis = computed(() => rows<AfTi>(af.value, 'task_instances').map(t => ({ ...t, log: Array.isArray(t.log) ? t.log.map(String) : [] })));
const importErrors = computed(() => rows<{ file: string; error: string }>(af.value, 'import_errors'));
const connections = computed(() => rows<AfConnection>(af.value, 'connections'));
const variables = computed(() => rows<AfVariable>(af.value, 'variables'));
const pools = computed(() => rows<AfPool>(af.value, 'pools'));
const xcom = computed(() => rows<AfXcom>(af.value, 'xcom'));
const slaMisses = computed(() => rows(af.value, 'sla_misses'));
const scheduler = computed<Record<string, any>>(() => pick(af.value, 'scheduler', {}));
// The banner is for a scheduler that is installed and has stopped - not for a
// lab whose platform has not been started by its first command yet.
const schedulerHealthy = computed(() => af.value.installed !== true || scheduler.value.healthy !== false);
const clock = computed(() => String(pick(viewRef.value, 'time', '')));
const clockShort = computed(() => {
  const m = clock.value.match(/(\d{2}:\d{2})/);
  return m ? m[1] : '--:--';
});
const busyRef = computed(() => Boolean(props.busy));
const history = computed(() => props.api.history.value.map(h => ({ command: h.command, ok: h.ok, at: h.at })));

const route = ref<AfRoute>({ page: 'home' });
const navOpen = ref(false);
const open = ref('');

interface MenuItem { label: string; route?: AfRoute; docs?: string }
const MENUS: { label: string; key: string; items: MenuItem[] }[] = [
  { label: 'Security', key: 'security', items: [
    { label: 'List Users', route: { page: 'security', sub: 'users' } },
    { label: 'List Roles', route: { page: 'security', sub: 'roles' } },
  ] },
  { label: 'Browse', key: 'browse', items: [
    { label: 'DAG Runs', route: { page: 'dagruns' } },
    { label: 'Task Instances', route: { page: 'tis' } },
    { label: 'SLA Misses', route: { page: 'sla' } },
    { label: 'Audit Logs', route: { page: 'audit' } },
  ] },
  { label: 'Admin', key: 'admin', items: [
    { label: 'Variables', route: { page: 'variables' } },
    { label: 'Configurations', route: { page: 'config' } },
    { label: 'Connections', route: { page: 'connections' } },
    { label: 'Pools', route: { page: 'pools' } },
    { label: 'XComs', route: { page: 'xcoms' } },
  ] },
  { label: 'Docs', key: 'docs', items: [
    { label: 'Documentation', docs: 'https://airflow.apache.org/docs/apache-airflow/2.9.3/' },
    { label: 'Airflow Website', docs: 'https://airflow.apache.org' },
    { label: 'GitHub', docs: 'https://github.com/apache/airflow' },
    { label: 'REST API Reference (Swagger UI)', docs: '/api/v1/ui/' },
  ] },
];

const section = computed(() => {
  const p = route.value.page;
  if (p === 'home' || p === 'dag') return 'dags';
  if (p === 'cluster' || p === 'datasets') return p;
  if (p === 'security') return 'security';
  if (p === 'dagruns' || p === 'tis' || p === 'sla' || p === 'audit') return 'browse';
  return 'admin';
});

function go(next: AfRoute) {
  route.value = next;
  navOpen.value = false;
  open.value = '';
}

function pickMenu(item: MenuItem) {
  open.value = '';
  if (item.route) go(item.route);
  else notify('info', item.label, `${item.docs} - this lab is offline, so documentation opens outside it.`);
}

watch(route, value => emit('location', routeUrl(value)), { immediate: true, deep: true });

function closeMenus(event: MouseEvent) {
  if (!(event.target as HTMLElement | null)?.closest?.('.af-nav__drop')) open.value = '';
}
onMounted(() => window.addEventListener('click', closeMenus));
onBeforeUnmount(() => window.removeEventListener('click', closeMenus));

async function run(command: string, options: RunOptions = {}) {
  return props.api.exec(command, { success: options.success, quiet: options.quiet });
}

const pending = ref<ConfirmRequest | null>(null);
let resolver: ((value: boolean) => void) | null = null;
function confirm(request: ConfirmRequest): Promise<boolean> {
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

async function moveClock(delta: string) {
  open.value = '';
  await run(CMD.clock(delta), { success: `Clock advanced ${delta} - the scheduler caught up` });
}

function alertType(type: string) {
  return type === 'progress' ? 'info' : type;
}

const shownFlashes = computed(() => props.api.flashes.value.slice(0, 3));

const ctx: AfContext = {
  version,
  executor,
  dags,
  runs,
  tis,
  importErrors,
  connections,
  variables,
  pools,
  xcom,
  slaMisses,
  scheduler,
  airflowView: af,
  clock,
  busy: busyRef,
  history,
  route,
  go,
  run,
  confirm,
  notify,
  refresh: () => emit('refresh'),
  dag: id => dags.value.find(d => d.dag_id === id),
  runsOf: dagId => runs.value.filter(r => r.dag_id === dagId),
  tisOf: (dagId, runId) => tis.value.filter(t => t.dag_id === dagId && (runId === undefined || t.run_id === runId)),
};
provide(AF, ctx);
</script>

<style scoped>
.af-app {
  /* Airflow 2.9's palette. */
  --af-primary: #017cee;
  --af-primary-dark: #0167c6;
  --af-primary-darker: #0153a0;
  --af-link: #017cee;
  --af-link-hover: #0153a0;
  --af-text: #51504f;
  --af-text-strong: #333;
  --af-text-2: #767676;
  --af-border: #ddd;
  --af-border-light: #e6e6e6;
  --af-border-strong: #ccc;
  --af-bg: #fff;
  --af-bg-2: #f8f8f8;
  --af-tag-bg: #e2eefd;
  --af-tag-hover: #cfe2fb;
  --af-tag-ink: #0153a0;
  --af-nav-height: 56px;
  --af-font: 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --af-mono: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;

  color-scheme: light;
  position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;
  background: var(--af-bg); color: var(--af-text); font-family: var(--af-font); font-size: 14px; line-height: 1.42857;
}
.af-nav {
  flex: none; display: flex; align-items: center; gap: 4px; height: var(--af-nav-height); padding: 0 16px;
  background: #fff; border-bottom: 1px solid #e7e7e7; box-shadow: 0 1px 2px rgba(0, 0, 0, .06); position: relative; z-index: 30;
}
.af-nav__brand { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; color: #51504f; font-size: 19px; font-weight: 500; margin-right: 18px; }
.af-nav__menu { display: flex; align-items: center; gap: 2px; }
.af-nav__menu > a, .af-nav__drop > button {
  display: inline-flex; align-items: center; gap: 4px; height: 36px; padding: 0 10px; border: 0; background: none; border-radius: 4px;
  color: #51504f; text-decoration: none; font: inherit; font-size: 15px; cursor: pointer; white-space: nowrap;
}
.af-nav__menu > a:hover, .af-nav__drop > button:hover { color: var(--af-primary); background: #f3f8fe; }
.af-nav__menu > a.is-active, .af-nav__drop > button.is-active { color: var(--af-primary); }
.af-nav__drop { position: relative; }
.af-nav__list {
  position: absolute; top: 38px; left: 0; z-index: 40; min-width: 190px; background: #fff; border: 1px solid rgba(0, 0, 0, .15);
  border-radius: 4px; box-shadow: 0 6px 12px rgba(0, 0, 0, .175); padding: 5px 0; display: flex; flex-direction: column;
}
.af-nav__list--right { left: auto; right: 0; }
.af-nav__list button { border: 0; background: none; text-align: left; padding: 6px 18px; font: inherit; font-size: 14px; color: #333; cursor: pointer; white-space: nowrap; }
.af-nav__list button:hover { background: #f5f5f5; color: #262626; }
.af-nav__who { display: flex; flex-direction: column; padding: 6px 18px 8px; border-bottom: 1px solid #e5e5e5; margin-bottom: 4px; }
.af-nav__who strong { color: #333; }
.af-nav__who span { font-size: 12px; color: #777; }
.af-nav__right { display: flex; align-items: center; gap: 12px; }
.af-nav__drop > button.af-nav__clock { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: #51504f; padding: 4px 8px; height: 32px; border: 1px solid #e7e7e7; border-radius: 4px; white-space: nowrap; }
.af-nav__user { gap: 2px !important; }
.af-nav__avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--af-primary); color: #fff; display: inline-grid; place-items: center; font-size: 13px; font-weight: 600; }
.af-nav__burger { display: none; border: 0; background: none; color: #51504f; width: 36px; height: 36px; cursor: pointer; border-radius: 4px; }
.af-nav__burger:hover { background: #f3f8fe; }
.af-spacer { flex: 1; }

.af-main { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
.af-flashes { display: flex; flex-direction: column; gap: 8px; padding: 12px 24px 0; flex: none; }
.af-alert { display: flex; gap: 10px; align-items: flex-start; padding: 10px 15px; border: 1px solid transparent; border-radius: 4px; font-size: 14px; line-height: 20px; overflow-wrap: anywhere; }
.af-alert--info { background: #d9edf7; border-color: #bce8f1; color: #31708f; }
.af-alert--success { background: #dff0d8; border-color: #d6e9c6; color: #3c763d; }
.af-alert--warning { background: #fcf8e3; border-color: #faebcc; color: #8a6d3b; }
.af-alert--error { background: #f2dede; border-color: #ebccd1; color: #a94442; }
.af-alert__body { flex: 1; min-width: 0; }
.af-alert__x { border: 0; background: none; color: inherit; opacity: .6; cursor: pointer; padding: 2px 6px; min-width: 24px; min-height: 24px; font-size: 20px; line-height: 18px; }
.af-alert__x:hover { opacity: 1; }
.af-flash-detail { white-space: pre-wrap; font-family: var(--af-mono); font-size: 12.5px; margin-top: 2px; }
.af-confirm-text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.af-confirm-list { margin: 0; padding: 8px 8px 8px 28px; max-height: 260px; overflow: auto; background: #f8f8f8; border: 1px solid #e6e6e6; border-radius: 4px; font-family: var(--af-mono); font-size: 12.5px; }
.af-muted { color: var(--af-text-2); }

@container sl-portal (max-width: 980px) {
  .af-nav__burger { display: inline-grid; place-items: center; order: 3; }
  .af-nav__menu {
    display: none; position: absolute; top: var(--af-nav-height); left: 0; right: 0; flex-direction: column; align-items: stretch;
    background: #fff; border-bottom: 1px solid #e7e7e7; box-shadow: 0 6px 12px rgba(0, 0, 0, .1); padding: 6px 8px;
  }
  .af-nav__menu.is-open { display: flex; }
  .af-nav__drop > button, .af-nav__menu > a { width: 100%; justify-content: flex-start; }
  .af-nav__list { position: static; box-shadow: none; border: 0; padding-left: 12px; }
  .af-nav__right { order: 2; }
}
@container sl-portal (max-width: 520px) {
  .af-nav__clock { display: none; }
  .af-flashes { padding: 8px 12px 0; }
}
</style>
