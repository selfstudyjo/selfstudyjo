<template>
  <div class="fk-app" :class="{ 'is-collapsed': collapsed }" dir="ltr">
    <!-- ===== The NG-ZORRO dark sider: logo, then the dashboard's menu ===== -->
    <aside class="fk-sider" aria-label="Flink">
      <a href="#" class="fk-logo" @click.prevent="go({ page: 'overview' })">
        <FkLogo class="fk-logo__mark" />
        <span class="fk-logo__text">Apache Flink Dashboard</span>
      </a>
      <nav class="fk-menu">
        <a href="#" class="fk-menu__item" :class="{ 'is-active': route.page === 'overview' }" title="Overview"
           @click.prevent="go({ page: 'overview' })">
          <FkIcon name="dashboard" /><span class="fk-menu__label">Overview</span>
        </a>
        <div class="fk-menu__sub" :class="{ 'is-open': jobsOpen }">
          <button type="button" class="fk-menu__item fk-menu__title" title="Jobs"
                  :class="{ 'is-child-active': section === 'jobs' }" @click="toggleJobs">
            <FkIcon name="jobs" /><span class="fk-menu__label">Jobs</span>
            <FkIcon name="down" class="fk-menu__arrow" />
          </button>
          <div class="fk-menu__children">
            <a href="#" class="fk-menu__item fk-menu__child" title="Running Jobs"
               :class="{ 'is-active': route.page === 'running' || (route.page === 'job' && currentRunning) }"
               @click.prevent="go({ page: 'running' })">
              <FkIcon name="play" class="fk-menu__child-ico" /><span class="fk-menu__label">Running Jobs</span>
            </a>
            <a href="#" class="fk-menu__item fk-menu__child" title="Completed Jobs"
               :class="{ 'is-active': route.page === 'completed' || (route.page === 'job' && !currentRunning) }"
               @click.prevent="go({ page: 'completed' })">
              <FkIcon name="check" class="fk-menu__child-ico" /><span class="fk-menu__label">Completed Jobs</span>
            </a>
          </div>
        </div>
        <a href="#" class="fk-menu__item" title="Task Managers"
           :class="{ 'is-active': route.page === 'taskmanagers' || route.page === 'taskmanager' }"
           @click.prevent="go({ page: 'taskmanagers' })">
          <FkIcon name="cluster" /><span class="fk-menu__label">Task Managers</span>
        </a>
        <a href="#" class="fk-menu__item" title="Job Manager" :class="{ 'is-active': route.page === 'jobmanager' }"
           @click.prevent="go({ page: 'jobmanager', jmTab: 'metrics' })">
          <FkIcon name="build" /><span class="fk-menu__label">Job Manager</span>
        </a>
        <a href="#" class="fk-menu__item" title="Submit New Job" :class="{ 'is-active': route.page === 'submit' }"
           @click.prevent="go({ page: 'submit' })">
          <FkIcon name="upload" /><span class="fk-menu__label">Submit New Job</span>
        </a>
      </nav>
    </aside>

    <div class="fk-body">
      <!-- ===== The white header: fold trigger, version and commit, and the message bell ===== -->
      <header class="fk-header">
        <button type="button" class="fk-trigger" :aria-label="collapsed ? 'Expand menu' : 'Collapse menu'"
                @click="collapsed = !collapsed">
          <FkIcon :name="collapsed ? 'unfold' : 'fold'" />
        </button>
        <div class="fk-header__info">
          <span><strong>Version:</strong> {{ cluster.version }}</span>
          <span class="fk-header__commit"><strong>Commit:</strong> {{ cluster.commit }} @ 2024-06-14T09:31:12+02:00</span>
        </div>
        <span class="fk-spacer"></span>
        <button type="button" class="fk-bell" :title="exceptionCount ? exceptionCount + ' job exception(s)' : 'No new messages'"
                @click="openMessages">
          <FkIcon name="bell" />
          <span v-if="exceptionCount" class="fk-bell__badge">{{ exceptionCount }}</span>
        </button>
      </header>

      <!-- ===== nz-notification, top right ===== -->
      <div class="fk-notes" aria-live="polite">
        <div v-for="flash in shownFlashes" :key="flash.id" class="fk-note" role="status">
          <FkIcon :name="flash.type === 'success' ? 'success' : flash.type === 'error' ? 'error' : flash.type === 'warning' ? 'warning' : 'info'"
                  class="fk-note__icon" :class="'is-' + flash.type" />
          <div class="fk-note__body">
            <strong>{{ flash.title }}</strong>
            <span v-if="flash.detail">{{ flash.detail }}</span>
          </div>
          <button type="button" class="fk-note__x" aria-label="Close" @click="api.dismiss(flash.id)"><FkIcon name="close" /></button>
        </div>
      </div>

      <main class="fk-main">
        <div v-if="!installed" class="fk-offline">
          <FkIcon :name="booting ? 'reload' : 'warning'" class="fk-offline__ico" :class="{ 'is-spinning': booting }" />
          <div>
            <strong>{{ booting ? 'Connecting to the JobManager...' : 'The JobManager is not reachable' }}</strong>
            <p v-if="!booting">{{ bootError || 'No Flink cluster answered at flink-jobmanager.shopflow.internal:8081.' }}</p>
            <button v-if="!booting" type="button" class="fk-retry" @click="boot">Retry</button>
          </div>
        </div>
        <OverviewPage v-else-if="route.page === 'overview'" />
        <JobListPage v-else-if="route.page === 'running'" kind="running" />
        <JobListPage v-else-if="route.page === 'completed'" kind="completed" />
        <JobDetailPage v-else-if="route.page === 'job'" :key="'job-' + route.jid" />
        <TaskManagersPage v-else-if="route.page === 'taskmanagers' || route.page === 'taskmanager'" />
        <JobManagerPage v-else-if="route.page === 'jobmanager'" />
        <SubmitPage v-else />
        <div v-if="busy" class="fk-busy" aria-hidden="true"><span class="fk-busy__bar"></span></div>
      </main>
    </div>

    <FkModal v-if="pending" :title="pending.title" :ok-text="pending.yes || 'OK'" :danger="pending.danger" confirm
             :width="440" @close="answer(false)" @ok="answer(true)">
      <p class="fk-confirm-text">{{ pending.message }}</p>
    </FkModal>
  </div>
</template>

<script setup lang="ts">
/**
 * The Apache Flink 1.19 web dashboard (Angular + NG-ZORRO) over the lab's
 * data-platform engine (`sim:dataplat`, its `flink` block).
 *
 * What the real dashboard does, this does with the command a student could type
 * into the Flink CLI or the SQL Client beside it: Cancel Job runs `flink cancel`,
 * Trigger Savepoint `flink savepoint`, Stop with savepoint `flink stop
 * --savepointPath`, and "Submit New Job" sends Flink SQL through the
 * `flink_sql` surface. Uploaded Jars are the JobManager REST calls (as curl)
 * for the Flink operations playground JARs, which run as real jobs.
 */
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { errorText, pick } from '@/utils/portalKit';
import FkIcon from './FkIcon.vue';
import FkLogo from './FkLogo.vue';
import FkModal from './FkModal.vue';
import OverviewPage from './OverviewPage.vue';
import JobListPage from './JobListPage.vue';
import JobDetailPage from './JobDetailPage.vue';
import TaskManagersPage from './TaskManagersPage.vue';
import JobManagerPage from './JobManagerPage.vue';
import SubmitPage from './SubmitPage.vue';
import { FK, type ConfirmRequest, type FkContext, type RunOptions } from './fkContext';
import {
  clusterOf, cmd, isRunning, jobsOf, routeUrl, savepointsOf, settingsOf, simNowMs, tablesOf, taskManagersOf, topicsOf,
  type FkRoute,
} from './flink';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const viewRef = computed(() => props.view || {});
const jobs = computed(() => jobsOf(viewRef.value));
const cluster = computed(() => clusterOf(viewRef.value));
const tables = computed(() => tablesOf(viewRef.value));
const savepoints = computed(() => savepointsOf(viewRef.value));
const taskManagers = computed(() => taskManagersOf(viewRef.value));
const settings = computed(() => settingsOf(viewRef.value));
const topics = computed(() => topicsOf(viewRef.value));
const busy = computed(() => Boolean(props.busy));
/** The engine builds the cluster on its first command: the dashboard's own first read does it. */
const installed = computed(() => Boolean(pick(viewRef.value, 'flink.installed', false)));
const booting = ref(false);
const bootError = ref('');
async function boot() {
  if (installed.value) return;
  booting.value = true;
  bootError.value = '';
  const result = await props.api.exec(cmd.list(), { quiet: true, unlogged: true });
  booting.value = false;
  if (!result.ok) bootError.value = errorText(result);
  else if (!installed.value) emit('refresh');
}
onMounted(boot);
const simNow = computed(() => simNowMs(viewRef.value));

const route = ref<FkRoute>({ page: 'overview' });
const collapsed = ref(false);
const jobsOpen = ref(true);
const draft = ref({ sql: '', savepoint: '' });
const now = ref(Date.now());
let timer = 0;
onMounted(() => { timer = window.setInterval(() => { now.value = Date.now(); }, 15000); });
onBeforeUnmount(() => window.clearInterval(timer));

const section = computed(() => ['running', 'completed', 'job'].includes(route.value.page) ? 'jobs' : route.value.page);
const currentJob = computed(() => route.value.jid ? jobs.value.find(j => j.jid === route.value.jid) : undefined);
const currentRunning = computed(() => (currentJob.value ? isRunning(currentJob.value) : true));
const exceptionCount = computed(() => jobs.value.filter(j => j.state === 'FAILED').length);

function go(next: FkRoute) {
  route.value = next;
  if (['running', 'completed', 'job'].includes(next.page)) jobsOpen.value = true;
}
function toggleJobs() {
  if (collapsed.value) {
    go({ page: 'running' });
    return;
  }
  jobsOpen.value = !jobsOpen.value;
}

watch([route, currentJob], () => emit('location', routeUrl(route.value, currentJob.value)),
  { immediate: true, deep: true });

async function run(command: string, options: RunOptions = {}) {
  return props.api.exec(command, { success: options.success, quiet: options.quiet, surface: options.surface });
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

function openMessages() {
  const failed = jobs.value.filter(j => j.state === 'FAILED');
  if (!failed.length) {
    notify('info', 'No new messages', 'No job has failed on this cluster.');
    return;
  }
  go({ page: 'job', jid: failed[0].jid, tab: 'exceptions' });
}

function openSubmit(sql = '', savepoint = '') {
  draft.value = { sql: sql || draft.value.sql, savepoint: savepoint || draft.value.savepoint };
  go({ page: 'submit' });
}

const shownFlashes = computed(() => props.api.flashes.value.slice(0, 3));

const ctx: FkContext = {
  view: viewRef,
  jobs,
  cluster,
  tables,
  savepoints,
  taskManagers,
  settings,
  topics,
  now,
  simNow,
  busy,
  route,
  go,
  run,
  confirm,
  notify,
  job: jid => jobs.value.find(j => j.jid === jid),
  openSubmit,
  draft,
};
provide(FK, ctx);
</script>

<style scoped>
.fk-app {
  /* Ant Design 4 tokens, as NG-ZORRO spends them in the Flink dashboard. */
  --fk-primary: #1890ff;
  --fk-sider: #001529;
  --fk-sider-sub: #000c17;
  --fk-heading: rgba(0, 0, 0, 0.85);
  --fk-text: rgba(0, 0, 0, 0.85);
  --fk-text-2: rgba(0, 0, 0, 0.65);
  --fk-text-3: rgba(0, 0, 0, 0.55);
  --fk-border-split: #f0f0f0;
  --fk-border: #d9d9d9;
  --fk-table-head: #fafafa;
  --fk-row-hover: #fafafa;
  --fk-row-selected: #e6f7ff;
  --fk-bg: #f0f2f5;
  --fk-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
  --fk-mono: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  --fk-sider-w: 256px;

  color-scheme: light;
  position: relative; display: flex; height: 100%; min-height: 0; overflow: hidden;
  background: var(--fk-bg); color: var(--fk-text); font-family: var(--fk-font); font-size: 14px; line-height: 1.5715;
}
.fk-app.is-collapsed { --fk-sider-w: 80px; }

.fk-sider { flex: none; width: var(--fk-sider-w); background: var(--fk-sider); display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; transition: width 0.2s; z-index: 5; }
.fk-logo { display: flex; align-items: center; gap: 12px; height: 64px; padding: 0 24px; text-decoration: none; background: #002140; flex: none; overflow: hidden; }
.fk-logo__mark { width: 32px; height: 32px; flex: none; }
.fk-logo__text { color: #fff; font-size: 16px; font-weight: 600; white-space: nowrap; }
.fk-menu { display: flex; flex-direction: column; padding: 4px 0; }
.fk-menu__item {
  display: flex; align-items: center; gap: 10px; height: 40px; margin: 4px 0; padding: 0 24px; color: rgba(255, 255, 255, 0.65);
  text-decoration: none; font: inherit; font-size: 14px; background: none; border: 0; width: 100%; cursor: pointer; text-align: left; white-space: nowrap;
}
.fk-menu__item:hover { color: #fff; }
.fk-menu__item.is-active { background: var(--fk-primary); color: #fff; }
.fk-menu__item.is-child-active { color: #fff; }
.fk-menu__item .fk-ico { font-size: 14px; }
.fk-menu__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.fk-menu__arrow { font-size: 10px !important; transition: transform 0.2s; }
.fk-menu__sub.is-open .fk-menu__arrow { transform: rotate(180deg); }
.fk-menu__children { display: none; background: var(--fk-sider-sub); }
.fk-menu__sub.is-open .fk-menu__children { display: block; }
.fk-menu__child { padding-left: 48px; margin: 0; }
.fk-menu__child-ico { display: none; }
.is-collapsed .fk-logo { padding: 0 24px; }
.is-collapsed .fk-logo__text, .is-collapsed .fk-menu__label, .is-collapsed .fk-menu__arrow { display: none; }
.is-collapsed .fk-menu__item { justify-content: center; padding: 0; }
.is-collapsed .fk-menu__item .fk-ico { font-size: 16px; }
.is-collapsed .fk-menu__child { padding: 0; }
.is-collapsed .fk-menu__child-ico { display: inline-block; }

.fk-body { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; }
.fk-header { flex: none; height: 64px; display: flex; align-items: center; gap: 16px; padding: 0 24px 0 0; background: #fff; box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08); z-index: 4; }
.fk-trigger { width: 64px; height: 64px; border: 0; background: none; font-size: 18px; color: var(--fk-text); cursor: pointer; display: grid; place-items: center; flex: none; }
.fk-trigger:hover { color: var(--fk-primary); }
.fk-header__info { display: flex; gap: 24px; font-size: 14px; color: var(--fk-text-2); min-width: 0; overflow: hidden; white-space: nowrap; }
.fk-header__info strong { color: var(--fk-heading); font-weight: 500; }
.fk-header__commit { overflow: hidden; text-overflow: ellipsis; }
.fk-spacer { flex: 1; }
.fk-bell { position: relative; border: 0; background: none; font-size: 18px; color: var(--fk-text-2); cursor: pointer; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 2px; }
.fk-bell:hover { background: rgba(0, 0, 0, 0.025); color: var(--fk-heading); }
.fk-bell__badge { position: absolute; top: 4px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #ff4d4f; color: #fff; font-size: 12px; line-height: 18px; box-shadow: 0 0 0 1px #fff; }

.fk-main { flex: 1; min-height: 0; overflow: auto; position: relative; }
.fk-busy { position: absolute; top: 0; left: 0; right: 0; height: 2px; overflow: hidden; pointer-events: none; }
.fk-busy__bar { display: block; height: 100%; width: 30%; background: var(--fk-primary); animation: fk-slide 1.1s infinite linear; }
@keyframes fk-slide { from { transform: translateX(-100%); } to { transform: translateX(380%); } }

.fk-notes { position: absolute; top: 76px; right: 24px; z-index: 60; display: flex; flex-direction: column; gap: 12px; width: min(384px, calc(100% - 32px)); pointer-events: none; }
.fk-note {
  pointer-events: auto; display: flex; gap: 14px; align-items: flex-start; padding: 16px 20px; background: #fff; border-radius: 2px;
  box-shadow: 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
}
.fk-note__icon { font-size: 24px; margin-top: 1px; color: #1890ff; }
.fk-note__icon.is-success { color: #52c41a; }
.fk-note__icon.is-error { color: #ff4d4f; }
.fk-note__icon.is-warning { color: #faad14; }
.fk-note__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; overflow-wrap: anywhere; font-size: 14px; }
.fk-note__body strong { font-size: 16px; font-weight: 400; color: var(--fk-heading); line-height: 24px; }
.fk-note__body span { color: var(--fk-text-2); }
.fk-note__x { border: 0; background: none; color: rgba(0, 0, 0, 0.45); cursor: pointer; padding: 2px; border-radius: 2px; }
.fk-note__x:hover { color: rgba(0, 0, 0, 0.75); }
.fk-offline { margin: 48px auto; max-width: 560px; display: flex; gap: 16px; align-items: flex-start; background: #fff; border: 1px solid var(--fk-border-split); padding: 24px; }
.fk-offline__ico { font-size: 28px; color: #faad14; flex: none; }
.fk-offline__ico.is-spinning { color: var(--fk-primary); animation: fk-spin 1s linear infinite; }
@keyframes fk-spin { to { transform: rotate(360deg); } }
.fk-offline strong { font-size: 16px; font-weight: 500; color: var(--fk-heading); }
.fk-offline p { margin: 6px 0 12px; color: var(--fk-text-2); overflow-wrap: anywhere; }
.fk-retry { height: 32px; padding: 4px 15px; border: 1px solid var(--fk-primary); background: var(--fk-primary); color: #fff; border-radius: 2px; cursor: pointer; font: inherit; }
.fk-confirm-text { margin: 0; overflow-wrap: anywhere; }

@container sl-portal (max-width: 900px) {
  .fk-app { --fk-sider-w: 80px; }
  .fk-logo { padding: 0 24px; }
  .fk-logo__text, .fk-menu__label, .fk-menu__arrow { display: none; }
  .fk-menu__item { justify-content: center; padding: 0; }
  .fk-menu__item .fk-ico { font-size: 16px; }
  .fk-menu__child { padding: 0; }
  .fk-menu__child-ico { display: inline-block; }
  .fk-trigger { display: none; }
  .fk-header { padding-left: 16px; }
  .fk-header__commit { display: none; }
}
@container sl-portal (max-width: 560px) {
  .fk-app { --fk-sider-w: 56px; }
  .fk-logo { padding: 0 12px; }
}
</style>
