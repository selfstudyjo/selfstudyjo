<template>
  <div ref="rootEl" class="cc-app" dir="ltr">
    <!-- ===== Header: logo, home breadcrumb, help / notifications / user ===== -->
    <header class="cc-header">
      <button type="button" class="cc-header__burger" aria-label="Menu" :aria-expanded="navOpen" @click="navOpen = !navOpen">
        <CcIcon name="menu" />
      </button>
      <a href="#" class="cc-header__brand" @click.prevent="go({ page: 'home' })" aria-label="Confluent Control Center home">
        <svg class="cc-logo" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="15" fill="none" stroke="#fff" stroke-width="2" />
          <path d="M16 5v22M5 16h22M8.2 8.2l15.6 15.6M23.8 8.2L8.2 23.8" stroke="#fff" stroke-width="1.6" />
        </svg>
        <span class="cc-header__word">CONFLUENT</span>
      </a>
      <span class="cc-header__product">Control Center</span>
      <div class="cc-spacer"></div>
      <span class="cc-header__ver">v{{ cpVersion }}</span>
      <button type="button" class="cc-header__icon" aria-label="Help" @click="help"><CcIcon name="help" /></button>
      <button type="button" class="cc-header__icon" aria-label="Notifications" @click="go({ page: 'overview' })">
        <CcIcon name="bell" />
        <span v-if="alertCount" class="cc-header__dot">{{ alertCount }}</span>
      </button>
      <span class="cc-header__user"><CcIcon name="user" /><span>admin</span></span>
    </header>

    <div class="cc-body">
      <!-- ===== Left navigation, scoped to the selected cluster ===== -->
      <nav class="cc-nav" :class="{ 'is-open': navOpen }" aria-label="Control Center">
        <button type="button" class="cc-nav__home" :class="{ 'is-active': route.page === 'home' }" @click="go({ page: 'home' })">
          <CcIcon name="home" /><span>Home</span>
        </button>
        <div class="cc-nav__cluster">
          <span class="cc-nav__cluster-label">Cluster</span>
          <span class="cc-nav__cluster-name" :title="clusterId">{{ CLUSTER_NAME }}</span>
          <span class="cc-nav__health" :class="healthy ? 'is-ok' : 'is-bad'">{{ healthy ? 'Healthy' : 'Unhealthy' }}</span>
        </div>
        <button v-for="item in navItems" :key="item.key" type="button" class="cc-nav__item"
                :class="{ 'is-active': section === item.key }" @click="go(item.route)">
          <CcIcon :name="item.icon" /><span>{{ item.label }}</span>
          <span v-if="item.count !== undefined" class="cc-nav__count">{{ item.count }}</span>
        </button>
      </nav>

      <!-- ===== Notifications (top of the content area) ===== -->
      <div class="cc-flashes" aria-live="polite">
        <div v-for="flash in shownFlashes" :key="flash.id" class="cc-flash" :class="'cc-flash--' + flash.type" role="status">
          <CcIcon :name="flash.type === 'success' ? 'check-circle' : flash.type === 'error' ? 'x-circle' : flash.type === 'warning' ? 'warning' : 'info'" />
          <div class="cc-flash__body">
            <strong>{{ flash.title }}</strong>
            <span v-if="flash.detail">{{ flash.detail }}</span>
          </div>
          <button type="button" class="cc-flash__x" aria-label="Dismiss" @click="api.dismiss(flash.id)"><CcIcon name="close" /></button>
        </div>
      </div>

      <main ref="mainEl" class="cc-main" @click="navOpen = false">
        <div v-if="!installed" class="cc-offline">
          <CcIcon :name="booting ? 'refresh' : 'warning'" />
          <div>
            <strong>{{ booting ? 'Connecting to the cluster...' : 'No Kafka cluster is reachable' }}</strong>
            <p v-if="!booting">{{ bootError || 'Control Center could not reach the brokers at ' + BOOTSTRAP + '.' }}</p>
            <button v-if="!booting" type="button" class="cc-retry" @click="boot">Retry</button>
          </div>
        </div>
        <template v-else>
          <HomePage v-if="route.page === 'home'" />
          <OverviewPage v-else-if="route.page === 'overview'" />
          <BrokersPage v-else-if="route.page === 'brokers'" />
          <TopicsPage v-else-if="route.page === 'topics'" />
          <NewTopicPage v-else-if="route.page === 'new-topic'" />
          <TopicPage v-else-if="route.page === 'topic'" :key="'t-' + route.name" />
          <ConsumersPage v-else-if="route.page === 'consumers'" />
          <GroupPage v-else-if="route.page === 'group'" :key="'g-' + route.group" />
          <ConnectPage v-else-if="route.page === 'connect'" />
          <AddConnectorPage v-else-if="route.page === 'add-connector'" />
          <ConnectorPage v-else-if="route.page === 'connector'" :key="'c-' + route.name" />
          <RegistryPage v-else-if="route.page === 'registry'" />
          <SubjectPage v-else-if="route.page === 'subject'" :key="'s-' + route.subject" />
          <KsqlPage v-else-if="route.page === 'ksql'" />
        </template>
      </main>
    </div>

    <CcMenu v-if="menuState" :items="menuState.items" :x="menuState.x" :y="menuState.y" :bounds="menuState.bounds"
            @close="menuState = null" />

    <CcModal v-if="pending" :title="pending.title" :ok-text="pending.yes || 'Confirm'" :danger="pending.danger"
             :ok-disabled="Boolean(pending.typeToConfirm) && typed !== pending.typeToConfirm"
             @close="answer(false)" @ok="answer(true)">
      <p class="cc-confirm-text">{{ pending.message }}</p>
      <label v-if="pending.typeToConfirm" class="cc-confirm-field">
        <span>To confirm, type <strong>{{ pending.typeToConfirm }}</strong> below.</span>
        <input v-model="typed" class="cc-confirm-input" type="text" autocomplete="off" spellcheck="false" />
      </label>
    </CcModal>
  </div>
</template>

<script setup lang="ts">
/**
 * Confluent Control Center (7.x) over the lab's data-platform engine.
 *
 * The engine (`utils/sims/dataplat/kafka.py` on app 11) is a three-broker Kafka
 * cluster with Schema Registry and Kafka Connect; this portal is Control
 * Center's view of it. Every action runs the Kafka CLI line a student could type
 * into the Kafka CLI console beside it, so the console and the portal never
 * disagree and the lab's checks pass either way.
 */
import { computed, nextTick, onMounted, provide, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { pick, rows } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import CcModal from './CcModal.vue';
import CcMenu from './CcMenu.vue';
import KsqlPage from './KsqlPage.vue';
import HomePage from './HomePage.vue';
import OverviewPage from './OverviewPage.vue';
import BrokersPage from './BrokersPage.vue';
import TopicsPage from './TopicsPage.vue';
import NewTopicPage from './NewTopicPage.vue';
import TopicPage from './TopicPage.vue';
import ConsumersPage from './ConsumersPage.vue';
import GroupPage from './GroupPage.vue';
import ConnectPage from './ConnectPage.vue';
import AddConnectorPage from './AddConnectorPage.vue';
import ConnectorPage from './ConnectorPage.vue';
import RegistryPage from './RegistryPage.vue';
import SubjectPage from './SubjectPage.vue';
import { CC, type CcContext, type CcMenuItem, type ConfirmRequest, type RunOptions } from './ccContext';
import {
  BOOTSTRAP, CLUSTER_NAME, kafkaTopics, routeUrl,
  type CcBroker, type CcConnector, type CcGroup, type CcKsql, type CcRoute, type CcSubject, type CcTopic,
} from './confluent';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const kafka = computed<Record<string, any>>(() => pick(props.view || {}, 'kafka', {}));
const installed = computed(() => Boolean(kafka.value.installed));
const clusterId = computed(() => String(kafka.value.cluster_id || ''));
const version = computed(() => String(kafka.value.version || '3.7.0'));
const cpVersion = '7.6.1';
const brokers = computed(() => rows<CcBroker>(kafka.value, 'brokers'));
const topics = computed(() => rows<CcTopic>(kafka.value, 'topics'));
const groups = computed(() => rows<CcGroup>(kafka.value, 'groups'));
const subjects = computed(() => rows<CcSubject>(kafka.value, 'subjects'));
const connectors = computed(() => rows<CcConnector>(kafka.value, 'connectors'));
const plugins = computed(() => pick<string[]>(kafka.value, 'connect.plugins', []).map(String));
const registryCompat = computed(() => String(pick(kafka.value, 'registry.compatibility', 'BACKWARD') || 'BACKWARD'));
const producer = computed(() => pick<Record<string, any>>(kafka.value, 'producer', {}));
const ksql = computed<CcKsql>(() => {
  const raw = pick<Record<string, any>>(kafka.value, 'ksql', {}) || {};
  return { server: raw.server, version: raw.version, streams: rows(raw, 'streams'), queries: rows(raw, 'queries') };
});
const busyRef = computed(() => Boolean(props.busy) || props.api.busy.value);

const healthy = computed(() => brokers.value.every(b => b.status === 'online')
  && topics.value.every(t => !t.under_replicated && !t.offline_partitions));
const alertCount = computed(() => brokers.value.filter(b => b.status !== 'online').length
  + topics.value.filter(t => t.under_replicated || t.offline_partitions).length
  + connectors.value.filter(c => c.state === 'FAILED' || c.tasks.some(t => t.state === 'FAILED')).length);

const route = ref<CcRoute>({ page: 'home' });
const navOpen = ref(false);

const section = computed(() => {
  const p = route.value.page;
  if (p === 'new-topic' || p === 'topic') return 'topics';
  if (p === 'group') return 'consumers';
  if (p === 'add-connector' || p === 'connector') return 'connect';
  if (p === 'subject') return 'registry';
  if (p === 'ksql') return 'ksql';
  return p;
});

const navItems = computed(() => [
  { key: 'overview', label: 'Cluster overview', icon: 'cluster', route: { page: 'overview' } as CcRoute, count: undefined as number | undefined },
  { key: 'brokers', label: 'Brokers', icon: 'brokers', route: { page: 'brokers' } as CcRoute, count: brokers.value.length },
  { key: 'topics', label: 'Topics', icon: 'topics', route: { page: 'topics' } as CcRoute, count: topics.value.length },
  { key: 'connect', label: 'Connect', icon: 'connect', route: { page: 'connect' } as CcRoute, count: connectors.value.length },
  { key: 'ksql', label: 'ksqlDB', icon: 'ksql', route: { page: 'ksql', tab: 'editor' } as CcRoute, count: ksql.value.streams.length + ksql.value.queries.length },
  { key: 'consumers', label: 'Consumers', icon: 'consumers', route: { page: 'consumers' } as CcRoute, count: groups.value.length },
  { key: 'registry', label: 'Schema Registry', icon: 'schema', route: { page: 'registry' } as CcRoute, count: subjects.value.length },
]);

const mainEl = ref<HTMLElement | null>(null);
function go(next: CcRoute) {
  const samePage = route.value.page === next.page && JSON.stringify(route.value) !== JSON.stringify(next)
    && (next.page === 'topic' || next.page === 'connector');
  route.value = next;
  navOpen.value = false;
  if (!samePage) nextTick(() => mainEl.value?.scrollTo({ top: 0 }));
}

watch([route, clusterId], () => emit('location', routeUrl(route.value, clusterId.value || undefined)),
  { immediate: true, deep: true });

async function run(command: string, options: RunOptions = {}) {
  return props.api.exec(command, { success: options.success, quiet: options.quiet, unlogged: options.unlogged });
}

/* The cluster is built on the first command the lab sees, so opening Control
   Center with nothing run yet asks the brokers for their topic list once. */
const booting = ref(false);
const bootError = ref('');
async function boot() {
  if (installed.value) return;
  booting.value = true;
  bootError.value = '';
  const result = await props.api.exec(kafkaTopics(['--list']), { quiet: true, unlogged: true });
  booting.value = false;
  if (!result.ok) bootError.value = String(result.error || result.output || '').split('\n').slice(-1)[0] || '';
}
onMounted(boot);

const pending = ref<ConfirmRequest | null>(null);
const typed = ref('');
let resolver: ((value: boolean) => void) | null = null;
function confirm(request: ConfirmRequest): Promise<boolean> {
  typed.value = '';
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
function help() {
  notify('info', 'Control Center documentation', 'https://docs.confluent.io/platform/current/control-center/ - this lab is offline.');
}

const shownFlashes = computed(() => props.api.flashes.value.slice(0, 3));

const rootEl = ref<HTMLElement | null>(null);
const menuState = ref<{ items: CcMenuItem[]; x: number; y: number; bounds: { w: number; h: number } } | null>(null);
function openMenu(event: MouseEvent, items: CcMenuItem[]) {
  event.preventDefault();
  event.stopPropagation();
  const root = rootEl.value;
  if (!root) return;
  const box = root.getBoundingClientRect();
  let x = event.clientX - box.left;
  let y = event.clientY - box.top;
  if (event.type === 'click' && event.currentTarget instanceof HTMLElement) {
    const b = event.currentTarget.getBoundingClientRect();
    x = b.right - box.left - 190;
    y = b.bottom - box.top + 2;
  }
  menuState.value = { items, x, y, bounds: { w: box.width, h: box.height } };
}

const ctx: CcContext = {
  installed, clusterId, version, brokers, topics, groups, subjects, connectors, plugins, registryCompat, producer, ksql,
  busy: busyRef,
  route, go, run, confirm, notify, menu: openMenu,
  topic: name => topics.value.find(t => t.name === name),
  subject: name => subjects.value.find(s => s.subject === name),
};
provide(CC, ctx);
</script>

<style scoped>
.cc-app {
  --cc-header: #0d1f30;
  --cc-nav: #172b3e;
  --cc-nav-hover: #22394f;
  --cc-nav-active: #2b4762;
  --cc-nav-text: #c9d4de;
  --cc-accent: #2fb9d6;
  --cc-primary: #0b6aa6;
  --cc-primary-hover: #08507e;
  --cc-link: #0b6aa6;
  --cc-focus: rgba(11, 106, 166, 0.25);
  --cc-text: #1f2b37;
  --cc-text-2: #56616d;
  --cc-text-3: #737f8b;
  --cc-border: #dde2e7;
  --cc-border-light: #eceff2;
  --cc-border-strong: #b8c1ca;
  --cc-bg: #f4f6f8;
  --cc-head-bg: #f8f9fa;
  --cc-row-hover: #f2f6f9;
  --cc-row-selected: #e6f1f9;
  --cc-tag-bg: #e9edf1;
  --cc-blue-bg: #e8f3fa;
  --cc-blue-border: #9ccbe6;
  --cc-code-bg: #f7f8fa;
  --cc-success: #2b8a3e;
  --cc-success-bg: #ebf6ee;
  --cc-success-text: #1d5e2a;
  --cc-warning: #e0a100;
  --cc-warning-bg: #fff7e0;
  --cc-warning-text: #7a5600;
  --cc-danger: #c8312a;
  --cc-danger-hover: #9e211b;
  --cc-danger-bg: #fdecea;
  --cc-danger-border: #f0a8a3;
  --cc-danger-text: #8a1c16;
  --cc-font: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  --cc-mono: 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;

  color-scheme: light;
  position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;
  background: var(--cc-bg); color: var(--cc-text); font-family: var(--cc-font); font-size: 13px; line-height: 20px;
}
.cc-header { flex: none; display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 16px; background: var(--cc-header); color: #fff; z-index: 20; }
.cc-header__brand { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: #fff; }
.cc-logo { width: 22px; height: 22px; }
.cc-header__word { font-weight: 700; letter-spacing: .18em; font-size: 13px; }
.cc-header__product { font-size: 14px; color: #c9d4de; padding-left: 12px; border-left: 1px solid rgba(255, 255, 255, 0.25); white-space: nowrap; }
.cc-header__ver { font-size: 11px; color: #9fb0c0; }
.cc-header__icon { position: relative; border: 0; background: none; color: #dfe7ee; width: 32px; height: 32px; border-radius: 4px; display: grid; place-items: center; cursor: pointer; }
.cc-header__icon:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.cc-header__icon .cc-ico, .cc-header__burger .cc-ico { width: 18px; height: 18px; }
.cc-header__dot { position: absolute; top: 2px; right: 0; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--cc-danger); color: #fff; font-size: 10px; line-height: 16px; font-weight: 700; }
.cc-header__user { display: inline-flex; align-items: center; gap: 6px; color: #dfe7ee; font-size: 13px; }
.cc-header__burger { display: none; border: 0; background: none; color: #fff; width: 32px; height: 32px; border-radius: 4px; cursor: pointer; }
.cc-spacer { flex: 1; }

.cc-body { flex: 1; min-height: 0; display: flex; position: relative; }
.cc-nav { flex: none; width: 216px; background: var(--cc-nav); color: var(--cc-nav-text); display: flex; flex-direction: column; padding: 8px 0; overflow-y: auto; z-index: 15; }
.cc-nav__home, .cc-nav__item {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 16px; border: 0; border-left: 3px solid transparent;
  background: none; color: var(--cc-nav-text); font: inherit; font-size: 13px; text-align: left; cursor: pointer;
}
.cc-nav__home:hover, .cc-nav__item:hover { background: var(--cc-nav-hover); color: #fff; }
.cc-nav__home.is-active, .cc-nav__item.is-active { background: var(--cc-nav-active); border-left-color: var(--cc-accent); color: #fff; font-weight: 600; }
.cc-nav__count { margin-left: auto; font-size: 11px; color: #9fb0c0; }
.cc-nav__cluster { margin: 8px 12px 6px; padding: 10px 12px; border-radius: 4px; background: rgba(255, 255, 255, 0.06); display: flex; flex-direction: column; gap: 2px; }
.cc-nav__cluster-label { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #9fb0c0; }
.cc-nav__cluster-name { font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cc-nav__health { font-size: 11px; font-weight: 600; }
.cc-nav__health.is-ok { color: #7fd99a; }
.cc-nav__health.is-bad { color: #ff9a92; }

.cc-main { flex: 1; min-width: 0; overflow: auto; position: relative; }
.cc-flashes { position: absolute; top: 8px; right: 16px; z-index: 30; display: flex; flex-direction: column; gap: 6px; width: min(440px, calc(100% - 32px)); pointer-events: none; }
.cc-flashes:empty { display: none; }
.cc-flash { pointer-events: auto; display: flex; gap: 10px; align-items: flex-start; padding: 10px 14px; border-radius: 4px; border: 1px solid; background: #fff; box-shadow: 0 2px 8px rgba(13, 31, 48, 0.12); font-size: 13px; }
.cc-flash .cc-ico { width: 18px; height: 18px; margin-top: 1px; }
.cc-flash--success { border-color: var(--cc-success); background: var(--cc-success-bg); color: var(--cc-success-text); }
.cc-flash--error { border-color: var(--cc-danger-border); background: var(--cc-danger-bg); color: var(--cc-danger-text); }
.cc-flash--info, .cc-flash--progress { border-color: var(--cc-blue-border); background: var(--cc-blue-bg); color: var(--cc-text); }
.cc-flash--warning { border-color: var(--cc-warning); background: var(--cc-warning-bg); color: var(--cc-warning-text); }
.cc-flash__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; overflow-wrap: anywhere; }
.cc-flash__x { border: 0; background: none; color: inherit; cursor: pointer; padding: 2px; border-radius: 4px; }
.cc-flash__x:hover { background: rgba(0, 0, 0, 0.06); }

.cc-offline { margin: 32px 28px; display: flex; gap: 12px; align-items: flex-start; padding: 16px 18px; background: #fff; border: 1px solid var(--cc-border); border-radius: 4px; }
.cc-offline .cc-ico { width: 22px; height: 22px; color: var(--cc-warning-text); }
.cc-offline p { margin: 4px 0 8px; color: var(--cc-text-2); overflow-wrap: anywhere; }
.cc-retry { height: 30px; padding: 0 14px; border-radius: 4px; border: 1px solid var(--cc-primary); background: var(--cc-primary); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }

.cc-confirm-text { margin: 0; overflow-wrap: anywhere; }
.cc-confirm-field { display: flex; flex-direction: column; gap: 6px; }
.cc-confirm-input { height: 32px; padding: 0 10px; border: 1px solid var(--cc-border-strong); border-radius: 4px; font: inherit; color: var(--cc-text); background: #fff; }
.cc-confirm-input:focus { outline: none; border-color: var(--cc-primary); box-shadow: 0 0 0 2px var(--cc-focus); }

@container sl-portal (max-width: 900px) {
  .cc-header__burger { display: inline-grid; place-items: center; }
  .cc-header__product, .cc-header__ver, .cc-header__user span { display: none; }
  .cc-nav { position: absolute; top: 0; bottom: 0; left: 0; transform: translateX(-100%); transition: transform .15s ease; visibility: hidden; }
  .cc-nav.is-open { transform: none; visibility: visible; box-shadow: 4px 0 16px rgba(0, 0, 0, 0.25); }
}
</style>
