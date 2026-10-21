<template>
  <div class="amb" dir="ltr" :class="{ 'nav-collapsed': collapsed, 'nav-open': mobileNav }">
    <!-- SIDE NAVIGATION — Ambari 2.7's dark navy rail. -->
    <nav class="amb-side" aria-label="Ambari navigation">
      <div class="amb-side__brand">
        <svg class="amb-logo" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="#3FAE2A" />
          <path d="M7 24 14.5 8h3L25 24h-3.6l-1.7-3.9h-7.4L10.6 24Z" fill="#fff" />
          <path d="M13.6 17h4.8L16 11.4Z" fill="#3FAE2A" />
        </svg>
        <span class="amb-side__name">Ambari</span>
        <button type="button" class="amb-side__close" aria-label="Close menu" @click="mobileNav = false">
          <AmbIcon name="close" />
        </button>
      </div>
      <ul class="amb-side__menu">
        <li :class="{ active: route.page === 'dashboard' }">
          <a href="#" @click.prevent="go({ page: 'dashboard', tab: 'metrics' })">
            <AmbIcon name="dashboard" :size="16" /><span>Dashboard</span>
          </a>
        </li>
        <li :class="{ active: route.page === 'service' }">
          <a href="#" @click.prevent="servicesOpen = !servicesOpen">
            <AmbIcon name="services" :size="16" /><span>Services</span>
            <AmbIcon class="amb-side__caret" :name="servicesOpen ? 'caret' : 'chev-right'" :size="12" />
          </a>
          <ul v-if="servicesOpen" class="amb-side__sub">
            <li v-for="svc in services" :key="svc.id" :class="{ active: route.page === 'service' && route.id === svc.id }">
              <a href="#" @click.prevent="go({ page: 'service', id: svc.id, tab: 'summary' })">
                <AmbIcon :name="svc.maintenance === 'ON' ? 'maint' : svc.state === 'STARTED' ? 'ok' : 'down'"
                         :class="statusClass(svc)" :size="12" />
                <span>{{ svc.display }}</span>
                <AmbIcon v-if="svc.stale_configs" name="restart-ind" class="amb-restart" :size="12" />
              </a>
            </li>
          </ul>
        </li>
        <li :class="{ active: route.page === 'hosts' || route.page === 'host' }">
          <a href="#" @click.prevent="go({ page: 'hosts' })">
            <AmbIcon name="hosts" :size="16" /><span>Hosts</span>
          </a>
        </li>
        <li :class="{ active: route.page === 'alerts' }">
          <a href="#" @click.prevent="go({ page: 'alerts' })">
            <AmbIcon name="alerts" :size="16" /><span>Alerts</span>
            <span v-if="alerts.length" class="amb-side__badge">{{ alerts.length }}</span>
          </a>
        </li>
        <li :class="{ active: route.page === 'admin' }">
          <a href="#" @click.prevent="go({ page: 'admin' })">
            <AmbIcon name="admin" :size="16" /><span>Cluster Admin</span>
          </a>
        </li>
      </ul>
      <button type="button" class="amb-side__toggle" :title="collapsed ? 'Expand' : 'Collapse'"
              @click="collapsed = !collapsed">
        <AmbIcon :name="collapsed ? 'chev-right' : 'chev-left'" :size="12" />
        <AmbIcon :name="collapsed ? 'chev-right' : 'chev-left'" :size="12" />
      </button>
    </nav>
    <div v-if="mobileNav" class="amb-scrim" @click="mobileNav = false"></div>

    <div class="amb-main">
      <!-- TOP NAVIGATION — white, page title left, cluster status right. -->
      <header class="amb-top">
        <button type="button" class="amb-top__burger" aria-label="Menu" @click="mobileNav = true">
          <AmbIcon name="bars" :size="18" />
        </button>
        <h1 class="amb-top__title">{{ pageTitle }}</h1>
        <div class="amb-top__right">
          <span class="amb-top__cluster" :title="cluster">{{ cluster }}</span>
          <button type="button" class="amb-top__badge" title="Background Operations" @click="opsOpen = true">
            <span class="amb-num" :class="{ 'is-running': runningOps }">{{ runningOps }}</span>
            <span class="amb-top__label">ops</span>
          </button>
          <button type="button" class="amb-top__badge" title="Alerts" @click="go({ page: 'alerts' })">
            <span class="amb-num" :class="critAlerts ? 'is-crit' : alerts.length ? 'is-warn' : ''">{{ alerts.length }}</span>
            <span class="amb-top__label">alerts</span>
          </button>
          <div class="amb-dd">
            <button type="button" class="amb-top__views" title="Ambari Views" aria-haspopup="true"
                    :aria-expanded="menu === 'views'" @click.stop="toggleMenu('views')">
              <AmbIcon name="grid" :size="18" />
            </button>
            <ul v-if="menu === 'views'" class="amb-dd__menu is-right">
              <li class="amb-dd__header">Views</li>
              <li><a href="#" @click.prevent="go({ page: 'files' })">Files View</a></li>
              <li><a href="#" @click.prevent="go({ page: 'hive', tab: 'query' })">Hive View 2.0</a></li>
              <li><a href="#" @click.prevent="go({ page: 'queues' })">YARN Queue Manager</a></li>
            </ul>
          </div>
          <div class="amb-dd">
            <button type="button" class="amb-top__user" aria-haspopup="true" :aria-expanded="menu === 'user'"
                    @click.stop="toggleMenu('user')">
              <AmbIcon name="user" :size="16" /><span>admin</span><AmbIcon name="caret" :size="12" />
            </button>
            <ul v-if="menu === 'user'" class="amb-dd__menu is-right">
              <li><a href="#" @click.prevent="aboutOpen = true; menu = ''">About</a></li>
              <li><a href="#" @click.prevent="go({ page: 'admin' })">Manage Ambari</a></li>
              <li><a href="#" @click.prevent="menu = ''">Settings</a></li>
              <li class="amb-dd__sep"></li>
              <li><a href="#" @click.prevent="menu = ''">Sign out</a></li>
            </ul>
          </div>
        </div>
      </header>

      <!-- Notifications, Bootstrap alert style. -->
      <div class="amb-flashes" aria-live="polite">
        <div v-for="flash in api.flashes.value" :key="flash.id" class="amb-flash"
             :class="'is-' + flash.type">
          <strong>{{ flash.title }}</strong>
          <span v-if="flash.detail" class="amb-flash__detail">{{ flash.detail }}</span>
          <button type="button" class="amb-flash__x" aria-label="Dismiss" @click="api.dismiss(flash.id)">×</button>
        </div>
      </div>

      <main class="amb-content" @click="menu = ''">
        <AmbDashboard v-if="route.page === 'dashboard'" :view="view" :tab="route.tab || 'metrics'"
                      @navigate="go" />
        <AmbService v-else-if="route.page === 'service'" :key="route.id" :view="view" :api="api"
                    :busy="busy" :service-id="route.id || 'HDFS'" :tab="route.tab || 'summary'"
                    @navigate="go" />
        <AmbHosts v-else-if="route.page === 'hosts' || route.page === 'host'" :view="view" :api="api"
                  :busy="busy" :host="route.page === 'host' ? route.id : ''" @navigate="go" />
        <AmbAlerts v-else-if="route.page === 'alerts'" :view="view" :api="api" :busy="busy" @navigate="go" />
        <AmbAdmin v-else-if="route.page === 'admin'" :view="view" />
        <AmbFilesView v-else-if="route.page === 'files'" :view="view" :api="api" :busy="busy" />
        <AmbHiveView v-else-if="route.page === 'hive'" :view="view" :api="api" :busy="busy"
                     :tab="route.tab || 'query'" @navigate="go" />
        <AmbQueueManager v-else-if="route.page === 'queues'" :view="view" :api="api" :busy="busy" />
        <AmbRmUi v-else-if="route.page === 'rm'" :view="view" :api="api" :busy="busy" :app-id="route.id || ''"
                 @navigate="go" />
      </main>
    </div>

    <AmbBgOps v-if="opsOpen" :view="view" @close="opsOpen = false" />
    <AmbModal v-if="aboutOpen" title="About" ok-text="" cancel-text="OK" small @close="aboutOpen = false">
      <p><strong>Apache Ambari</strong></p>
      <p>Version 2.7.8.0<br />Hadoop {{ versions.hadoop }} · Hive {{ versions.hive }} · Spark {{ versions.spark }}</p>
      <p class="text-muted">{{ tool.fidelity }}</p>
    </AmbModal>
  </div>
</template>

<script setup lang="ts">
/**
 * Apache Ambari 2.7 — the cluster console, interactive.
 *
 * The shell: the dark side navigation, the white top bar with the cluster name,
 * the ops and alerts counters, the Views menu and the user menu, and a router
 * between the pages. Every page is its own component; every write a page makes
 * is a command line (see ambari.ts for which).
 */
import { computed, onMounted, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { pick, rows } from '@/utils/portalKit';
import { locationFor, SERVICE_NAMES, SERVICE_ORDER, type AmbRoute } from './ambari';
import AmbIcon from './AmbIcon.vue';
import AmbModal from './AmbModal.vue';
import AmbDashboard from './AmbDashboard.vue';
import AmbService from './AmbService.vue';
import AmbHosts from './AmbHosts.vue';
import AmbAlerts from './AmbAlerts.vue';
import AmbAdmin from './AmbAdmin.vue';
import AmbFilesView from './AmbFilesView.vue';
import AmbHiveView from './AmbHiveView.vue';
import AmbQueueManager from './AmbQueueManager.vue';
import AmbRmUi from './AmbRmUi.vue';
import AmbBgOps from './AmbBgOps.vue';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const route = ref<AmbRoute>({ page: 'dashboard', tab: 'metrics' });
const collapsed = ref(false);
const mobileNav = ref(false);
const servicesOpen = ref(true);
const menu = ref('');
const opsOpen = ref(false);
const aboutOpen = ref(false);

const cluster = computed(() => String(pick(props.view, 'cluster', 'cluster')));
const versions = computed(() => pick<Record<string, string>>(props.view, 'versions', {}));
const services = computed<Record<string, any>[]>(() => {
  const list = rows(props.view, 'ambari.cluster_services');
  if (list.length) return list;
  return SERVICE_ORDER.map(id => ({ id, display: SERVICE_NAMES[id], state: 'STARTED', maintenance: 'OFF' }));
});
const alerts = computed(() => rows(props.view, 'ambari.alerts'));
const critAlerts = computed(() => alerts.value.filter(a => a.level === 'CRITICAL').length);
const runningOps = computed(() => rows(props.view, 'ambari.requests')
  .filter(r => r.status === 'IN_PROGRESS' || r.status === 'PENDING').length);

const pageTitle = computed(() => {
  const r = route.value;
  if (r.page === 'service') return SERVICE_NAMES[r.id || ''] || r.id || 'Services';
  return ({
    dashboard: 'Dashboard', hosts: 'Hosts', host: r.id ? `${r.id}.lab.internal` : 'Host',
    alerts: 'Alerts', admin: 'Stack and Versions', files: 'Files View', hive: 'Hive View 2.0',
    queues: 'YARN Queue Manager', rm: 'ResourceManager',
  } as Record<string, string>)[r.page] || 'Ambari';
});

function statusClass(svc: Record<string, any>) {
  if (svc.maintenance === 'ON') return 'is-maint';
  return svc.state === 'STARTED' ? 'is-ok' : 'is-down';
}

function toggleMenu(name: string) {
  menu.value = menu.value === name ? '' : name;
}

function go(next: AmbRoute) {
  route.value = next;
  menu.value = '';
  mobileNav.value = false;
}

watch(route, value => emit('location', locationFor(value)), { immediate: true, deep: true });

onMounted(async () => {
  // The lab's datasets are registered in HDFS and the Hive metastore on the
  // first command of a session. Ask the cluster something harmless so the
  // Files View and the Hive View have them on first paint.
  if (!pick(props.view, 'datasets_installed', true)) {
    await props.api.exec('hdfs dfsadmin -safemode get', { unlogged: true, quiet: true });
  }
});
</script>

<style scoped>
.amb {
  --amb-navy: #323544;
  --amb-navy-dark: #26283a;
  --amb-green: #3FAE2A;
  --amb-green-dark: #34932a;
  --amb-blue: #1491c1;
  --amb-link: #107fab;
  --amb-btn-green: #2b8521;
  --amb-btn-green-dark: #236d1b;
  --amb-red: #EF6162;
  --amb-orange: #e98a41;
  --amb-yellow: #FFD13D;
  --amb-ok: #179f66;
  --amb-text: #333;
  --amb-muted: #666;
  --amb-border: #ddd;
  --amb-bg: #f0f0f0;
  position: relative;
  color-scheme: light;
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--amb-bg);
  color: var(--amb-text);
  font-family: Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.42857;
  text-align: left;
}

/* ---- side nav ---- */
.amb-side {
  width: 230px; flex: 0 0 230px; background: var(--amb-navy); color: #fff; display: flex; flex-direction: column;
  overflow-y: auto; overflow-x: hidden; transition: width .15s, flex-basis .15s; z-index: 30;
}
.amb-side__brand { display: flex; align-items: center; gap: 10px; height: 70px; padding: 0 18px; flex: 0 0 auto; }
.amb-logo { width: 30px; height: 30px; flex: 0 0 auto; }
.amb-side__name { font-size: 20px; font-weight: 300; letter-spacing: .3px; white-space: nowrap; }
.amb-side__close { display: none; margin-left: auto; background: none; border: 0; color: #fff; cursor: pointer; width: 32px; height: 32px; padding: 0; align-items: center; justify-content: center; }
.amb-side__menu, .amb-side__sub { list-style: none; margin: 0; padding: 0; }
.amb-side__menu > li > a {
  display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 18px; color: #fff; text-decoration: none;
  border-left: 4px solid transparent; white-space: nowrap; font-size: 14px;
}
.amb-side__menu > li > a:hover { background: #3c3f50; }
.amb-side__menu > li.active > a { background: var(--amb-navy-dark); border-left-color: var(--amb-green); }
.amb-side__caret { margin-left: auto; opacity: .8; }
.amb-side__sub { background: #2b2d3b; padding: 4px 0; }
.amb-side__sub a {
  display: flex; align-items: center; gap: 9px; height: 34px; padding: 0 18px 0 50px; color: #c3c3c3;
  text-decoration: none; font-size: 13px; white-space: nowrap; border-left: 4px solid transparent;
}
.amb-side__sub a:hover { color: #fff; background: #35384a; }
.amb-side__sub li.active a { color: #fff; background: var(--amb-navy-dark); border-left-color: var(--amb-green); }
.amb-side__sub .is-ok { color: var(--amb-ok); }
.amb-side__sub .is-down { color: var(--amb-red); }
.amb-side__sub .is-maint { color: #a9a9a9; }
.amb-restart { color: #FDB82F; margin-left: auto; }
.amb-side__badge {
  margin-left: auto; background: #d43f3a; color: #fff; border-radius: 10px; font-size: 11px;
  padding: 0 7px; line-height: 18px;
}
.amb-side__toggle {
  margin-top: auto; height: 40px; border: 0; background: #2b2d3b; color: #c3c3c3; cursor: pointer;
  display: flex; align-items: center; justify-content: flex-end; padding: 0 14px; gap: 0;
}
.amb.nav-collapsed .amb-side { width: 50px; flex-basis: 50px; }
.amb.nav-collapsed .amb-side__name,
.amb.nav-collapsed .amb-side__menu > li > a > span,
.amb.nav-collapsed .amb-side__caret,
.amb.nav-collapsed .amb-side__sub { display: none; }
.amb.nav-collapsed .amb-side__brand { padding: 0 10px; }
.amb.nav-collapsed .amb-side__menu > li > a { padding: 0 13px; }
.amb.nav-collapsed .amb-side__toggle { justify-content: center; padding: 0; }

/* ---- main column ---- */
.amb-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.amb-top {
  display: flex; align-items: center; gap: 12px; height: 70px; flex: 0 0 70px; background: #fff;
  border-bottom: 1px solid #e3e3e3; padding: 0 20px;
}
.amb-top__burger { display: none; background: none; border: 0; color: #313D54; cursor: pointer; padding: 4px; }
.amb-top__title {
  margin: 0; font-size: 20px; font-weight: 400; color: #313D54; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; min-width: 0;
}
.amb-top__right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.amb-top__cluster { color: #6b6b6b; font-size: 16px; white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.amb-top__badge {
  display: flex; align-items: center; gap: 5px; background: none; border: 0; cursor: pointer; padding: 4px 0; color: #6b6b6b;
  font-size: 14px; font-family: inherit;
}
.amb-num {
  display: inline-block; min-width: 20px; height: 20px; line-height: 20px; border-radius: 10px; padding: 0 6px;
  background: #767676; color: #fff; font-size: 12px; text-align: center;
}
.amb-num.is-running { background: #006DCC; }
.amb-num.is-crit { background: #d43f3a; }
.amb-num.is-warn { background: #b8661f; }
.amb-top__views { background: none; border: 0; color: var(--amb-blue); cursor: pointer; padding: 6px; display: flex; }
.amb-top__user {
  display: flex; align-items: center; gap: 6px; background: none; border: 0; color: #313D54; cursor: pointer; font-size: 14px; font-family: inherit; padding: 6px 2px; min-height: 32px;
}
.amb-dd { position: relative; }
.amb-dd__menu {
  position: absolute; top: calc(100% + 8px); left: 0; z-index: 40; min-width: 180px; list-style: none; margin: 0;
  padding: 5px 0; background: #fff; border: 1px solid rgba(0, 0, 0, .15); box-shadow: 0 6px 12px rgba(0, 0, 0, .175);
}
.amb-dd__menu.is-right { left: auto; right: 0; }
.amb-dd__menu a { display: block; padding: 6px 20px; color: #333; text-decoration: none; white-space: nowrap; font-size: 13px; }
.amb-dd__menu a:hover { background: #f5f5f5; }
.amb-dd__header { padding: 4px 20px; color: #6b6b6b; font-size: 12px; text-transform: uppercase; }
.amb-dd__sep { height: 1px; margin: 5px 0; background: #e5e5e5; }

.amb-content { flex: 1; overflow: auto; min-height: 0; padding: 20px; }

.amb-flashes { position: absolute; bottom: 16px; right: 18px; z-index: 45; display: flex; flex-direction: column; gap: 8px; width: min(420px, calc(100% - 36px)); }
.amb-flash {
  position: relative; padding: 12px 34px 12px 15px; border: 1px solid transparent; border-radius: 4px; font-size: 13px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, .12); word-break: break-word;
}
.amb-flash.is-success, .amb-flash.is-info { background: #dff0d8; border-color: #d6e9c6; color: #3c763d; }
.amb-flash.is-error { background: #f2dede; border-color: #ebccd1; color: #a94442; }
.amb-flash.is-warning, .amb-flash.is-progress { background: #fcf8e3; border-color: #faebcc; color: #8a6d3b; }
.amb-flash__detail { display: block; margin-top: 4px; font-family: Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; }
.amb-flash__x { position: absolute; top: 6px; right: 10px; border: 0; background: none; font-size: 20px; line-height: 1; opacity: .4; cursor: pointer; color: inherit; }
.amb-scrim { display: none; }

/* ---- the shared Bootstrap 3 / bootstrap-ambari kit every page uses ---- */
.amb-content :deep(a) { color: var(--amb-link); text-decoration: none; }
.amb-content :deep(a:hover) { text-decoration: underline; }
.amb-content :deep(.table td a) { display: inline-block; line-height: 20px; }
.amb :deep(.btn) {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 14px;
  font: inherit; font-size: 13px; text-transform: uppercase; letter-spacing: .3px; border: 1px solid transparent;
  border-radius: 4px; cursor: pointer; white-space: nowrap; background: #fff;
}
.amb :deep(input[type='checkbox']), .amb :deep(input[type='radio']) { accent-color: #3FAE2A; width: 14px; height: 14px; margin: 0; }
.amb :deep(.btn:disabled) { opacity: .55; cursor: not-allowed; }
.amb :deep(.btn-default) { color: #666; border-color: #ccc; background: #fff; }
.amb :deep(.btn-default:hover:not(:disabled)) { background: #f5f5f5; border-color: #adadad; color: #333; }
.amb :deep(.btn-success), .amb :deep(.btn-primary) { color: #fff; background: var(--amb-btn-green); border-color: var(--amb-btn-green); }
.amb :deep(.btn-success:hover:not(:disabled)), .amb :deep(.btn-primary:hover:not(:disabled)) { background: var(--amb-btn-green-dark); border-color: var(--amb-btn-green-dark); }
.amb :deep(.btn-danger) { color: #fff; background: #d43f3a; border-color: #c9302c; }
.amb :deep(.btn-danger:hover:not(:disabled)) { background: #c9302c; }
.amb :deep(.btn-link) { background: none; border: 0; color: var(--amb-link); text-transform: none; padding: 0 6px; }
.amb :deep(.btn-sm) { height: 28px; padding: 0 10px; font-size: 12px; }
.amb :deep(.form-control) {
  display: block; width: 100%; height: 34px; padding: 6px 12px; font: inherit; font-size: 14px; color: #555;
  background: #fff; border: 1px solid #ccc; border-radius: 4px; box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
  box-sizing: border-box;
}
.amb :deep(textarea.form-control) { height: auto; }
.amb :deep(.form-control:focus) { border-color: #66afe9; outline: 0; box-shadow: inset 0 1px 1px rgba(0,0,0,.075), 0 0 8px rgba(102, 175, 233, .6); }
.amb :deep(.form-group) { margin-bottom: 15px; }
.amb :deep(.form-group > label), .amb :deep(.control-label) { display: block; margin-bottom: 5px; font-weight: 700; font-size: 13px; color: #333; }
.amb :deep(.help-block) { display: block; margin-top: 5px; color: #737373; font-size: 12px; }
.amb :deep(.has-error .form-control) { border-color: #a94442; }
.amb :deep(.has-error .help-block) { color: #a94442; }
.amb :deep(.text-muted) { color: #707070; }
.amb :deep(.alert) { padding: 12px 15px; margin-bottom: 15px; border: 1px solid transparent; border-radius: 4px; font-size: 13px; }
.amb :deep(.alert-danger) { background: #f2dede; border-color: #ebccd1; color: #a94442; }
.amb :deep(.alert-warning) { background: #fcf8e3; border-color: #faebcc; color: #8a6d3b; }
.amb :deep(.alert-info) { background: #d9edf7; border-color: #bce8f1; color: #31708f; }
.amb :deep(.alert-success) { background: #dff0d8; border-color: #d6e9c6; color: #3c763d; }
.amb :deep(.panel) { background: #fff; border: 1px solid #e3e3e3; border-radius: 0; margin-bottom: 20px; box-shadow: 0 1px 1px rgba(51, 51, 51, .15); }
.amb :deep(.panel-heading) { padding: 12px 15px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.amb :deep(.panel-heading h4) { margin: 0; font-size: 14px; font-weight: 500; text-transform: uppercase; color: #666; }
.amb :deep(.panel-body) { padding: 15px; }
.amb :deep(.table) { width: 100%; border-collapse: collapse; background: #fff; font-size: 13px; }
.amb :deep(.table th) {
  text-align: left; font-weight: 700; color: #333; border-bottom: 2px solid #ddd; padding: 8px; white-space: nowrap;
}
.amb :deep(.table td) { padding: 8px; border-top: 1px solid #ddd; vertical-align: middle; }
.amb :deep(.table tbody tr:hover) { background: #f5f5f5; }
.amb :deep(.table tr.is-selected) { background: #eef7ec; }
.amb :deep(.table-wrap) { overflow-x: auto; background: #fff; }
.amb :deep(.nav-tabs) { display: flex; gap: 0; list-style: none; margin: 0 0 20px; padding: 0; border-bottom: 1px solid #ddd; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
.amb :deep(.nav-tabs a) {
  display: block; padding: 10px 18px; color: #666; text-transform: uppercase; font-size: 13px; letter-spacing: .3px;
  border-bottom: 3px solid transparent; margin-bottom: -1px; text-decoration: none; white-space: nowrap;
}
.amb :deep(.nav-tabs a:hover) { color: #333; text-decoration: none; }
.amb :deep(.nav-tabs .active a) { color: #333; border-bottom-color: var(--amb-green); }
.amb :deep(.label) { display: inline-block; padding: 2px 7px; border-radius: 3px; font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase; }
.amb :deep(.label-ok) { background: #158a57; }
.amb :deep(.label-crit) { background: #d43f3a; }
.amb :deep(.label-warn) { background: #b8661f; }
.amb :deep(.label-unknown) { background: #767676; }
.amb :deep(.health-ok) { color: var(--amb-ok); }
.amb :deep(.health-down) { color: #d64545; }
.amb :deep(.health-maint) { color: #707070; }
.amb :deep(.health-warn) { color: #c46a1f; }
.amb :deep(input::placeholder), .amb :deep(textarea::placeholder) { color: #767676; opacity: 1; }
.amb :deep(pre) { color: #333; text-shadow: none; }
.amb :deep(code) { color: #c7254e; background: #f9f2f4; padding: 1px 4px; border-radius: 3px; }
.amb :deep(.mono) { font-family: Menlo, Monaco, Consolas, 'Courier New', monospace; font-size: 12px; }
.amb :deep(.empty) { padding: 24px; text-align: center; color: #6b6b6b; }
.amb :deep(.toolbar) { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 15px; }
.amb :deep(.toolbar .spacer) { flex: 1; }
.amb :deep(.amb-dd) { position: relative; }
.amb :deep(.amb-dd__menu) {
  position: absolute; top: calc(100% + 4px); left: 0; z-index: 40; min-width: 200px; list-style: none; margin: 0;
  padding: 5px 0; background: #fff; border: 1px solid rgba(0, 0, 0, .15); box-shadow: 0 6px 12px rgba(0, 0, 0, .175);
}
.amb :deep(.amb-dd__menu.is-right) { left: auto; right: 0; }
.amb :deep(.amb-dd__menu a) { display: flex; align-items: center; gap: 8px; padding: 6px 18px; color: #333; white-space: nowrap; font-size: 13px; text-decoration: none; }
.amb :deep(.amb-dd__menu a:hover) { background: #f5f5f5; }
.amb :deep(.amb-dd__menu a.is-disabled) { color: #767676; pointer-events: none; cursor: default; }
.amb :deep(.amb-dd__sep) { height: 1px; margin: 5px 0; background: #e5e5e5; }

/* ---- narrow frames: the rail becomes a drawer ---- */
@container sl-portal (max-width: 900px) {
  .amb-side { position: absolute; top: 0; bottom: 0; left: 0; transform: translateX(-100%); transition: transform .2s; width: 230px !important; }
  .amb.nav-open .amb-side { transform: none; box-shadow: 4px 0 18px rgba(0, 0, 0, .35); }
  .amb.nav-collapsed .amb-side__name, .amb.nav-collapsed .amb-side__menu > li > a > span { display: inline; }
  .amb-side__close { display: flex; }
  .amb-side__toggle { display: none; }
  .amb-scrim { display: block; position: absolute; inset: 0; background: rgba(0, 0, 0, .3); z-index: 25; }
  .amb-top__burger { display: flex; }
  .amb-top { padding: 0 12px; gap: 8px; height: 56px; flex-basis: 56px; }
  .amb-top__title { font-size: 17px; }
  .amb-top__cluster { display: none; }
  .amb-content { padding: 12px; }
  .amb-flashes { bottom: 10px; right: 10px; }
  /* wide tables scroll inside their wrapper rather than squeezing every cell to a word */
  .amb :deep(.table-wrap .table td:not([colspan])) { white-space: nowrap; }
  .amb :deep(.table-wrap .table th) { white-space: normal; }
}
@container sl-portal (max-width: 520px) {
  .amb-top__label, .amb-top__user span { display: none; }
  .amb-top__right { gap: 8px; }
  .amb :deep(.nav-tabs a) { padding: 10px 11px; }
  .amb :deep(.btn) { min-height: 32px; }
  .amb :deep(.btn-sm) { height: 32px; }
}
@container sl-portal (max-width: 400px) {
  .amb :deep(.nav-tabs a) { padding: 10px 8px; letter-spacing: 0; }
}
</style>
