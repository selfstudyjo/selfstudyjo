<template>
  <div class="sow">
    <nav class="rail" aria-label="Workspace navigation">
      <button type="button" class="rail__btn" :class="{ 'is-on': !number && view === 'home' }" title="Home" aria-label="Home" @click="goHome">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 9.5L10 3l7 6.5V17h-4.5v-4.5h-5V17H3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
      </button>
      <button type="button" class="rail__btn" :class="{ 'is-on': !number && view === 'list' }" title="Lists" aria-label="Lists" @click="view = 'list'; goHomeTab()">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
      <button type="button" class="rail__btn" title="Major Incident Workbench" aria-label="Major Incident Workbench" @click="$emit('navigate', { page: 'major_list' })">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3l8 14H2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /><path d="M10 8v4M10 14.5v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
      </button>
      <button type="button" class="rail__btn" title="On-call" aria-label="On-call" @click="$emit('navigate', { page: 'oncall' })">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M10 6v4l3 2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" /></svg>
      </button>
      <button type="button" class="rail__btn" title="Alerts" aria-label="Alerts" @click="$emit('navigate', { page: 'events', tab: 'alerts' })">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 11h3l2-5 3 9 2-4h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
      </button>
    </nav>

    <div class="ws">
      <div class="ws__top">
        <span class="ws__name">Service Operations Workspace</span>
        <div class="ws__tabs" role="tablist">
          <button type="button" class="ws__tab" :class="{ 'is-on': !number }" role="tab" @click="goHomeTab">
            {{ view === 'list' ? 'List' : 'Home' }}
          </button>
          <span v-for="t in openTabs" :key="t" class="ws__tab" :class="{ 'is-on': number === t }" role="tab">
            <button type="button" class="ws__tab-btn" @click="$emit('navigate', { page: 'sow-record', id: t })">{{ t }}</button>
            <button type="button" class="ws__x" :aria-label="'Close ' + t" @click="closeTab(t)">×</button>
          </span>
        </div>
        <span class="bar__spacer"></span>
        <button type="button" class="btn btn--primary btn--sm" @click="newIncident">New Incident</button>
      </div>

      <!-- A record tab: the incident form, workspace style, plus Agent Assist -->
      <div v-if="number" class="rec">
        <div class="rec__form"><IncidentForm :key="number" :model="model" :api="api" :number="number" variant="workspace" @navigate="fromForm" /></div>
        <aside class="assist">
          <AgentAssist :model="model" :incident="record" @navigate="r => $emit('navigate', r)" />
        </aside>
      </div>

      <div v-else-if="view === 'list'" class="home">
        <div class="card">
          <div class="card__head"><h3 class="card__title">Incidents</h3><span class="bar__spacer"></span>
            <div class="seg">
              <button v-for="f in LISTS" :key="f.id" type="button" class="seg__btn" :class="{ 'is-on': listFilter === f.id }" @click="listFilter = f.id">{{ f.label }}</button>
            </div>
          </div>
          <WorkTable :rows="listRows" :model="model" @open="openRecord" />
        </div>
      </div>

      <div v-else class="home">
        <h1 class="home__hello">Hello, {{ model.userName === 'You' ? 'Ops Engineer' : model.userName }}</h1>
        <p class="home__sub">{{ model.time }} UTC · {{ myGroupNames.join(', ') || 'no groups' }}</p>
        <section class="kpis">
          <button v-for="k in kpis" :key="k.label" type="button" class="kpi card" :class="k.tone" @click="k.go()">
            <span class="kpi__label">{{ k.label }}</span>
            <span class="kpi__value">{{ k.value }}</span>
            <span class="kpi__foot">{{ k.foot }}</span>
          </button>
        </section>
        <div class="cols">
          <div class="card">
            <div class="card__head"><h3 class="card__title">My work</h3><span class="muted">{{ myWork.length }}</span>
              <span class="bar__spacer"></span><button type="button" class="link" @click="view = 'list'">View all</button></div>
            <WorkTable :rows="myWork" :model="model" @open="openRecord" />
          </div>
          <div class="side">
            <AgentAssist :model="model" :incident="focus" @navigate="r => $emit('navigate', r)" />
            <div class="card">
              <div class="card__head"><h3 class="card__title">On call now</h3></div>
              <div class="card__body">
                <div v-for="g in model.groups.slice(0, 4)" :key="g.name" class="oc-row">
                  <span class="muted">{{ g.name }}</span><b>{{ personName(model, g.primary) || '—' }}</b>
                </div>
                <div v-if="openPages.length" class="pages">{{ openPages.length }} page(s) waiting for acknowledgement</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Service Operations Workspace: landing page with KPIs, My work and Agent
 * Assist, a list view, and record tabs that open the incident in the workspace.
 */
import { computed, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import IncidentForm from './IncidentForm.vue';
import AgentAssist from './AgentAssist.vue';
import WorkTable from './WorkTable.vue';
import { isOpen, myGroups, personName, worstSla, type Incident, type Model } from './snow';
import type { Route } from './route';

const props = defineProps<{ model: Model; api: PortalApi; number: string }>();
const emit = defineEmits<{ (event: 'navigate', route: Route): void }>();

// Module-level so the tabs survive the component being re-created between routes.
const openTabs = tabsStore;
const view = ref<'home' | 'list'>('home');
const listFilter = ref<'open' | 'mine' | 'unassigned' | 'all'>('open');
const LISTS = [
  { id: 'open' as const, label: 'Open' }, { id: 'mine' as const, label: 'Assigned to me' },
  { id: 'unassigned' as const, label: 'Unassigned' }, { id: 'all' as const, label: 'All' },
];

watch(() => props.number, n => {
  if (n && !openTabs.value.includes(n)) openTabs.value = [...openTabs.value, n].slice(-6);
}, { immediate: true });

const record = computed(() => props.model.incidents.find(i => i.number === props.number));
const myGroupNames = computed(() => myGroups(props.model));
const open = computed(() => props.model.incidents.filter(isOpen));
const myWork = computed(() => open.value
  .filter(i => i.assigned_to === props.model.user || (!i.assigned_to && myGroupNames.value.includes(i.group)))
  .sort((a, b) => a.priority - b.priority || a.opened_minute - b.opened_minute));
const focus = computed(() => myWork.value[0] || open.value[0]);
const openPages = computed(() => props.model.pages.filter(p => p.status === 'open'));
const listRows = computed<Incident[]>(() => {
  const m = props.model;
  const all = [...m.incidents].sort((a, b) => a.priority - b.priority || a.opened_minute - b.opened_minute);
  if (listFilter.value === 'all') return all;
  if (listFilter.value === 'mine') return all.filter(i => isOpen(i) && i.assigned_to === m.user);
  if (listFilter.value === 'unassigned') return all.filter(i => isOpen(i) && !i.assigned_to);
  return all.filter(isOpen);
});
const kpis = computed(() => {
  const breached = open.value.filter(i => worstSla(i)?.stage === 'breached').length;
  const atRisk = open.value.filter(i => { const s = worstSla(i); return s && s.stage === 'in progress' && s.percent >= 75; }).length;
  return [
    { label: 'Open incidents', value: open.value.length, foot: `${myWork.value.length} in my work`, tone: '', go: () => { view.value = 'list'; listFilter.value = 'open'; } },
    { label: 'Critical incidents', value: open.value.filter(i => i.priority === 1).length, foot: 'Priority 1 - Critical', tone: 'is-critical', go: () => emit('navigate', { page: 'incident_list', filter: 'p1' }) },
    { label: 'SLA breached', value: breached, foot: `${atRisk} at risk (75%+)`, tone: breached ? 'is-critical' : '', go: () => emit('navigate', { page: 'task_sla' }) },
    { label: 'Unassigned', value: open.value.filter(i => !i.assigned_to).length, foot: 'Open, no assignee', tone: '', go: () => { view.value = 'list'; listFilter.value = 'unassigned'; } },
    { label: 'Major incidents', value: props.model.incidents.filter(i => i.major && !i.major.resolved).length, foot: 'Active', tone: '', go: () => emit('navigate', { page: 'major_list' }) },
    { label: 'Pages open', value: openPages.value.length, foot: 'On-call, unacknowledged', tone: openPages.value.length ? 'is-warn' : '', go: () => emit('navigate', { page: 'oncall' }) },
  ];
});

function goHome() { view.value = 'home'; goHomeTab(); }
function goHomeTab() { if (props.number) emit('navigate', { page: 'sow' }); }
function openRecord(row: Incident) { emit('navigate', { page: 'sow-record', id: row.number }); }
function newIncident() { emit('navigate', { page: 'incident', id: '-1' }); }
function closeTab(t: string) {
  openTabs.value = openTabs.value.filter(x => x !== t);
  if (props.number === t) emit('navigate', { page: 'sow' });
}
function fromForm(r: Route) {
  if (r.page === 'incident' && r.id !== '-1') emit('navigate', { page: 'sow-record', id: r.id });
  else emit('navigate', r);
}
</script>

<script lang="ts">
import { ref as vueRef } from 'vue';
const tabsStore = vueRef<string[]>([]);
</script>

<style scoped src="./sn.css"></style>
<style scoped>
.sow { display: flex; height: 100%; min-height: 0; }
.rail { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; width: 3.2rem; padding: 0.6rem 0; flex: none;
  background: var(--sn-surface); border-right: 1px solid var(--sn-border); }
.rail__btn { display: grid; place-items: center; width: 2.4rem; height: 2.4rem; border: 0; border-radius: var(--sn-radius-lg); background: transparent; color: var(--sn-text-muted); cursor: pointer; }
.rail__btn svg { width: 1.2rem; height: 1.2rem; }
.rail__btn:hover { background: var(--sn-surface-hover); color: var(--sn-text); }
.rail__btn.is-on { background: #e4e5f8; color: var(--sn-primary); }
.ws { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.ws__top { display: flex; align-items: center; gap: 0.6rem; min-height: 2.6rem; padding: 0 0.8rem; background: var(--sn-surface); border-bottom: 1px solid var(--sn-border); overflow-x: auto; }
.ws__name { font-weight: 700; font-size: 0.85rem; white-space: nowrap; }
.ws__tabs { display: flex; align-items: stretch; align-self: stretch; }
.ws__tab { display: inline-flex; align-items: center; gap: 0.2rem; padding: 0 0.8rem; border: 0; border-bottom: 3px solid transparent; background: none;
  font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--sn-text-muted); cursor: pointer; white-space: nowrap; }
.ws__tab.is-on { color: var(--sn-text); border-bottom-color: var(--sn-primary); }
.ws__tab-btn { border: 0; background: none; font: inherit; color: inherit; cursor: pointer; padding: 0; }
.ws__x { border: 0; background: none; color: var(--sn-text-faint); font-size: 1rem; cursor: pointer; }
.home { flex: 1; min-height: 0; overflow: auto; padding: 1rem 1.2rem; }
.home__hello { margin: 0; font-size: 1.35rem; font-weight: 700; }
.home__sub { margin: 0.2rem 0 1rem; color: var(--sn-text-muted); font-size: 0.8125rem; }
.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 8.5rem), 1fr)); gap: 0.7rem; margin-bottom: 1rem; }
.kpi { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; padding: 0.8rem 0.9rem; border-top: 4px solid var(--sn-primary); text-align: left; cursor: pointer; font: inherit; color: var(--sn-text); }
.kpi:hover { box-shadow: 0 2px 8px rgba(24, 24, 38, 0.14); }
.kpi.is-critical { border-top-color: var(--sn-critical); }
.kpi.is-warn { border-top-color: var(--sn-high); }
.kpi__label { font-size: 0.78rem; font-weight: 700; color: var(--sn-text-muted); }
.kpi__value { font-size: 1.9rem; font-weight: 700; line-height: 1.1; }
.kpi__foot { font-size: 0.72rem; color: var(--sn-text-muted); }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) 20rem; gap: 0.9rem; align-items: start; }
.side { display: flex; flex-direction: column; gap: 0.9rem; }
.oc-row { display: flex; justify-content: space-between; gap: 0.6rem; padding: 0.25rem 0; font-size: 0.8125rem; }
.pages { margin-top: 0.5rem; padding: 0.4rem 0.6rem; border-radius: var(--sn-radius); background: var(--sn-warning-bg); color: var(--sn-warning-ink); font-size: 0.78rem; }
.rec { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 19rem; }
.rec__form { min-width: 0; min-height: 0; border-right: 1px solid var(--sn-border); }
.assist { min-height: 0; overflow: auto; padding: 0.8rem; background: var(--sn-page); }
.seg { display: inline-flex; border: 1px solid var(--sn-border-strong); border-radius: var(--sn-radius); overflow: hidden; }
.seg__btn { padding: 0.2rem 0.6rem; border: 0; border-right: 1px solid var(--sn-border-strong); background: var(--sn-surface); font: inherit; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
.seg__btn:last-child { border-right: 0; }
.seg__btn.is-on { background: var(--sn-brand); color: #fff; }
@container sl-portal (max-width: 1000px) {
  .cols, .rec { grid-template-columns: minmax(0, 1fr); }
  .assist { display: none; }
}
@container sl-portal (max-width: 600px) {
  .rail { display: none; }
  .ws__name { display: none; }
}
</style>
