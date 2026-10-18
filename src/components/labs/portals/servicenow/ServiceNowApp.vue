<template>
  <div class="sn-root" dir="ltr">
    <SnBanner :page-title="pageTitle" :starred="starred" :favorites="favorites" :history="visited"
              :user="model.user" :user-name="model.userName" :time="model.time" :pages-for-me="pagesForMe"
              @navigate="navigate" @favorite="toggleFavorite" @star="starPage" @search="globalSearch" />

    <div class="sn-messages" aria-live="polite">
      <div v-for="flash in api.flashes.value.slice(0, 2)" :key="flash.id" class="sn-msg" :class="'sn-msg--' + flash.type" role="status">
        <svg v-if="flash.type === 'error'" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="currentColor" /><path d="M8 4.5v4.2M8 11v.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" /></svg>
        <svg v-else-if="flash.type === 'success'" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="currentColor" /><path d="M5 8.2l2 2 4-4.2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" /></svg>
        <svg v-else viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="currentColor" /><path d="M8 7.2V11M8 5v.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" /></svg>
        <div class="sn-msg__text">
          <b>{{ flash.title }}</b>
          <span v-if="flash.detail" class="sn-msg__detail">{{ flash.detail }}</span>
        </div>
        <button type="button" class="sn-msg__close" aria-label="Close message" @click="api.dismiss(flash.id)">×</button>
      </div>
    </div>

    <main class="sn-main" :class="{ 'is-sow': isSow }">
      <SowHome v-if="route.page === 'sow' || route.page === 'sow-record'" :model="model" :api="api"
               :number="route.page === 'sow-record' ? route.id : ''" @navigate="navigate" />
      <IncidentList v-else-if="route.page === 'incident_list'" :model="model" :api="api" :filter="route.filter"
                    :text="route.text || ''" @navigate="navigate" />
      <IncidentForm v-else-if="route.page === 'incident'" :key="'inc-' + route.id" :model="model" :api="api"
                    :number="route.id" :preset="route.preset" @navigate="navigate" />
      <ProblemPages v-else-if="route.page === 'problem_list' || route.page === 'problem'" :key="'prb-' + routeId"
                    :model="model" :api="api" :route="route" @navigate="navigate" />
      <ChangePages v-else-if="route.page === 'change_list' || route.page === 'change_new' || route.page === 'change'"
                   :key="'chg-' + routeId" :model="model" :api="api" :route="route" @navigate="navigate" />
      <MajorPages v-else-if="route.page === 'major_list' || route.page === 'major'" :key="'mim-' + routeId"
                  :model="model" :api="api" :route="route" @navigate="navigate" />
      <OnCall v-else-if="route.page === 'oncall'" :model="model" :api="api" @navigate="navigate" />
      <EventConsole v-else-if="route.page === 'events'" :model="model" :api="api" :tab="route.tab" @navigate="navigate" />
      <SlaPages v-else-if="route.page === 'sla_defs' || route.page === 'task_sla'" :model="model" :api="api"
                :route="route" @navigate="navigate" />
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * ServiceNow (Next Experience / Polaris) over the cloudops engine's ITSM half.
 *
 * Every write is a `snow …` command line (snow.ts → cmd), so the SLA clocks,
 * the refusals and the lab checks are exactly the console's. This root owns
 * the banner, the message area under it, and which page is open; each page is
 * its own component.
 */
import { computed, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import SnBanner from './SnBanner.vue';
import SowHome from './SowHome.vue';
import IncidentList from './IncidentList.vue';
import IncidentForm from './IncidentForm.vue';
import ProblemPages from './ProblemPages.vue';
import ChangePages from './ChangePages.vue';
import MajorPages from './MajorPages.vue';
import OnCall from './OnCall.vue';
import EventConsole from './EventConsole.vue';
import SlaPages from './SlaPages.vue';
import { readModel } from './snow';
import { urlFor, type Route } from './route';
import { DEFAULT_FAVORITES, NAV } from './nav';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const model = computed(() => readModel(props.view));
const route = ref<Route>({ page: 'sow' });
const favorites = ref<string[]>([...DEFAULT_FAVORITES]);
const visited = ref<{ label: string; kind: string; route: Route }[]>([]);
const readsDone = new Set<string>();

const isSow = computed(() => route.value.page === 'sow' || route.value.page === 'sow-record');
const routeId = computed(() => ('id' in route.value ? route.value.id : route.value.page));

const pageTitle = computed(() => {
  const r = route.value;
  switch (r.page) {
    case 'sow': return 'Service Operations Workspace';
    case 'sow-record': return `${r.id} | Service Operations Workspace`;
    case 'incident_list': return 'Incidents';
    case 'incident': return r.id === '-1' ? 'Incident | New record' : `${r.id} | Incident`;
    case 'problem_list': return 'Problems';
    case 'problem': return r.id === '-1' ? 'Problem | New record' : `${r.id} | Problem`;
    case 'change_list': return 'Change Requests';
    case 'change_new': return 'Create New Change';
    case 'change': return r.id === '-1' ? 'Change Request | New record' : `${r.id} | Change Request`;
    case 'major_list': return 'Major Incident Workbench';
    case 'major': return `${r.id} | Major Incident Workbench`;
    case 'oncall': return 'On-Call Scheduling';
    case 'events': return { alerts: 'Alerts', events: 'Events', rules: 'Event Rules', integrations: 'Connectors' }[r.tab];
    case 'sla_defs': return 'SLA Definitions';
    case 'task_sla': return 'Task SLAs';
  }
  return 'ServiceNow';
});

const moduleKey = computed(() => {
  for (const app of NAV) {
    const hit = app.modules.find(m => JSON.stringify(m.route) === JSON.stringify(route.value));
    if (hit) return hit.key;
  }
  return '';
});
const starred = computed(() => Boolean(moduleKey.value) && favorites.value.includes(moduleKey.value));
const pagesForMe = computed(() => model.value.pages.filter(p => p.status === 'open' && p.who === model.value.user).length);

function navigate(next: Route) {
  route.value = next;
}

watch(route, next => {
  emit('location', urlFor(next));
  const label = pageTitle.value;
  const kind = 'id' in next && next.id !== '-1' ? 'Record' : 'List';
  visited.value = [{ label, kind, route: next }, ...visited.value.filter(v => v.label !== label)].slice(0, 12);
  // The two reads a lab asks for by name. Opening the screen IS reading the
  // queue, so it runs the read the console would - once per page per session.
  const read = next.page === 'incident_list' ? 'incidents' : next.page === 'task_sla' ? 'sla' : '';
  if (read && !readsDone.has(read)) {
    readsDone.add(read);
    void props.api.exec(read === 'incidents' ? 'snow incident list --all' : 'snow sla', { quiet: true });
  }
}, { immediate: true });

function toggleFavorite(key: string) {
  favorites.value = favorites.value.includes(key) ? favorites.value.filter(k => k !== key) : [...favorites.value, key];
}
function starPage() {
  if (moduleKey.value) toggleFavorite(moduleKey.value);
  else props.api.notify('info', 'Only a module (a list) can be added to Favorites from here.');
}
function globalSearch(text: string) {
  const id = text.trim().toUpperCase();
  const m = model.value;
  if (/^INC\d+$/.test(id) && m.incidents.some(i => i.number === id)) return navigate({ page: 'incident', id });
  if (/^PRB\d+$/.test(id) && m.problems.some(p => p.number === id)) return navigate({ page: 'problem', id });
  if (/^CHG\d+$/.test(id) && m.changes.some(c => c.number === id)) return navigate({ page: 'change', id });
  if (/^(INC|PRB|CHG)\d+$/.test(id)) {
    props.api.notify('warning', `No record found for "${text}"`);
    return;
  }
  navigate({ page: 'incident_list', filter: 'all', text });
}
</script>

<style scoped>
.sn-root {
  /* ServiceNow Next Experience (Polaris) palette. Banner = chrome brand-10. */
  --sn-banner: #181826;
  --sn-banner-ink: #ffffff;
  --sn-menu: #1f1f33;
  --sn-brand: #302f4b;
  --sn-brand-green: #62d84e;
  --sn-primary: #4f52bd;
  --sn-primary-hover: #3f42a6;
  --sn-focus: #6c6fe0;
  --sn-link: #3c3fb0;
  --sn-text: #181826;
  --sn-text-muted: #5c5c70;
  --sn-text-faint: #9a9aab;
  --sn-surface: #ffffff;
  --sn-surface-alt: #f4f4f7;
  --sn-surface-hover: #ececf2;
  --sn-row-hover: #f2f2fb;
  --sn-header-bg: #f4f4f7;
  --sn-page: #ececf1;
  --sn-border: #e0e0e8;
  --sn-border-strong: #b9b9c8;
  --sn-critical: #d32f2f;
  --sn-high: #f07c1a;
  --sn-moderate: #e0b300;
  --sn-low: #2f80ed;
  --sn-planning: #8d8da0;
  --sn-positive: #2e8540;
  --sn-info: #2f80ed;
  --sn-critical-bg: #fde4e4; --sn-critical-ink: #9c1c1c;
  --sn-warning-bg: #fff1d6; --sn-warning-ink: #7a4a00;
  --sn-positive-bg: #e1f4e4; --sn-positive-ink: #1d5e2b;
  --sn-info-bg: #e3edfd; --sn-info-ink: #1a4a9a;
  --sn-radius: 4px;
  --sn-radius-lg: 8px;
  --sn-shadow-sm: 0 1px 2px rgba(24, 24, 38, 0.08);
  /* The product is a light UI whatever galaxy the platform is in: native
     checkboxes, selects and scrollbars must render light too. */
  color-scheme: light;

  position: relative;
  display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;
  background: var(--sn-page); color: var(--sn-text);
  font-family: Lato, 'Source Sans Pro', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px; line-height: 1.35;
}
.sn-messages { flex: none; }
.sn-msg { display: flex; align-items: flex-start; gap: 8.8px; padding: 8.8px 16px; border-bottom: 1px solid; font-size: 13px; }
.sn-msg svg { width: 16px; height: 16px; flex: none; margin-top: 0.8px; }
.sn-msg__text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.sn-msg__detail { margin-left: 6.4px; }
.sn-msg__close { border: 0; background: none; color: inherit; font-size: 17.6px; line-height: 1; cursor: pointer; }
.sn-msg--success { background: var(--sn-positive-bg); color: var(--sn-positive-ink); border-color: #b8e0bf; }
.sn-msg--error { background: var(--sn-critical-bg); color: var(--sn-critical-ink); border-color: #f4b9b9; }
.sn-msg--warning { background: var(--sn-warning-bg); color: var(--sn-warning-ink); border-color: #f2d49a; }
.sn-msg--info, .sn-msg--progress { background: var(--sn-info-bg); color: var(--sn-info-ink); border-color: #bcd2f6; }
.sn-main { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--sn-surface); }
.sn-main.is-sow { background: var(--sn-page); overflow: hidden; }
</style>
