<template>
  <div class="jira" dir="ltr">
    <JiraTopNav :page="page" :issues="allIssues" :signals="signals"
                @toggle-nav="navOpen = !navOpen" @create="openCreate()" @go="go"
                @open-issue="openIssue" />
    <div class="jira__body">
      <JiraSidebar :page="page" :open="navOpen" :counts="counts" :alerts="alerts"
                   @go="go" @close="navOpen = false" />
      <div v-if="navOpen" class="jira__scrim" @click="navOpen = false" />
      <main ref="mainEl" class="jira__main">
        <component :is="pages[page]" />
      </main>
    </div>

    <IssueView v-if="issueKey" :issue-key="issueKey" @close="closeIssue" />
    <CreateIssue v-if="createPreset" :preset="createPreset" @close="createPreset = null" />

    <JiraModal v-if="confirmState" :title="confirmState.title" width="small"
               :icon="confirmState.danger ? 'error' : (confirmState.warning ? 'warning' : '')"
               @close="answer(false)">
      <p class="j-pre">{{ confirmState.body }}</p>
      <template #footer>
        <button type="button" class="j-btn j-btn--subtle" @click="answer(false)">Cancel</button>
        <button type="button" class="j-btn" autofocus
                :class="confirmState.danger ? 'j-btn--danger' : (confirmState.warning ? 'j-btn--warning' : 'j-btn--primary')"
                @click="answer(true)">{{ confirmState.confirm }}</button>
      </template>
    </JiraModal>

    <JiraModal v-if="output" :title="output.title" width="large" dismissable @close="output = null">
      <pre class="j-output">{{ output.text }}</pre>
      <template #footer>
        <button type="button" class="j-btn j-btn--primary" @click="output = null">Close</button>
      </template>
    </JiraModal>

    <JiraFlags :flashes="api.flashes.value" @dismiss="api.dismiss" />
  </div>
</template>

<script setup lang="ts">
/**
 * Jira Software Cloud, over the management simulation.
 *
 * The shell: global navigation, the project sidebar for PLAT, the page in the
 * middle, and the overlays every page shares (the issue view, the create
 * dialog, confirmations, Jira's flags). Each page is its own component and
 * reaches the view and the command runner through `inject(JIRA)`.
 *
 * Every write is the `mgr` command a student could have typed - see
 * `jiraKit.ts` and the engine (`utils/sims/manage.py`). The simulation's clock
 * is never moved implicitly: "Complete sprint" is `mgr advance`, and it says so
 * before it runs.
 */
import { computed, provide, ref, shallowRef, watch, type Component } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { rows } from '@/utils/portalKit';
import JiraTopNav from './JiraTopNav.vue';
import JiraSidebar from './JiraSidebar.vue';
import JiraModal from './JiraModal.vue';
import JiraFlags from './JiraFlags.vue';
import IssueView from './IssueView.vue';
import CreateIssue from './CreateIssue.vue';
import BoardPage from './BoardPage.vue';
import BacklogPage from './BacklogPage.vue';
import TimelinePage from './TimelinePage.vue';
import GoalsPage from './GoalsPage.vue';
import ReportsPage from './ReportsPage.vue';
import RisksPage from './RisksPage.vue';
import IncidentsPage from './IncidentsPage.vue';
import StakeholdersPage from './StakeholdersPage.vue';
import TeamPage from './TeamPage.vue';
import { issues, JIRA, PAGE_URL, PROJECT, SITE, type ConfirmOptions, type PageId } from './jiraKit';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const pages: Record<PageId, Component> = {
  timeline: TimelinePage, backlog: BacklogPage, board: BoardPage, goals: GoalsPage,
  reports: ReportsPage, risks: RisksPage, incidents: IncidentsPage,
  stakeholders: StakeholdersPage, team: TeamPage,
};

const page = ref<PageId>('board');
const navOpen = ref(false);
const issueKey = ref('');
const createPreset = shallowRef<Record<string, any> | null>(null);
const confirmState = shallowRef<(ConfirmOptions & { resolve: (yes: boolean) => void }) | null>(null);
const output = shallowRef<{ title: string; text: string } | null>(null);
const search = ref('');
const mainEl = ref<HTMLElement | null>(null);

const view = computed(() => props.view || {});
const allIssues = computed(() => issues(view.value));
const signals = computed(() => rows(view.value, 'signals'));
const counts = computed(() => ({
  risks: rows(view.value, 'raid').filter(r => r.status === 'open').length,
  incidents: rows(view.value, 'incidents').filter(r => r.status !== 'resolved').length,
}));
const alerts = computed(() => ({
  risks: rows(view.value, 'raid').some(r => r.status === 'open' && (!r.owner || !r.due)),
  incidents: rows(view.value, 'incidents').some(r => r.status !== 'resolved' && String(r.severity) === 'Sev1'),
}));

function go(next: PageId) {
  page.value = next;
  navOpen.value = false;
  if (mainEl.value) mainEl.value.scrollTop = 0;
}

function openIssue(key: string) {
  issueKey.value = key;
}

function closeIssue() {
  issueKey.value = '';
}

function openCreate(preset: Record<string, any> = {}) {
  createPreset.value = { ...preset };
}

function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => { confirmState.value = { ...options, resolve }; });
}

function answer(yes: boolean) {
  const state = confirmState.value;
  confirmState.value = null;
  state?.resolve(yes);
}

const location = computed(() => issueKey.value
  ? `${SITE}/jira/software/projects/${PROJECT.key}/boards/${PROJECT.board}?selectedIssue=${issueKey.value}`
  : PAGE_URL[page.value]);
watch(location, url => emit('location', url), { immediate: true });

provide(JIRA, {
  view,
  busy: computed(() => Boolean(props.busy || props.api.busy.value)),
  exec: (command, options = {}) => props.api.exec(command, options),
  openIssue,
  openCreate,
  go,
  confirm,
  flag: (type, title, detail = '') => {
    const id = props.api.notify(type, title, detail);
    // The engine's coaching notes arrive as warnings; Jira lets a warning flag
    // fade like a success one. Errors (from usePortal) stay until dismissed.
    if (type === 'warning') window.setTimeout(() => props.api.dismiss(id), 14000);
  },
  showOutput: (title, text) => { output.value = { title, text }; },
  search,
});
</script>

<style scoped>
/* Atlassian Design System tokens, light theme (2024–2025 refresh). */
.jira {
  --j-text: #292A2E;
  --j-text-subtle: #505258;
  --j-text-subtlest: #6B6E76;
  --j-text-disabled: #B7B9BE;
  --j-link: #1868DB;
  --j-brand: #1868DB;
  --j-brand-hover: #1558BC;
  --j-brand-pressed: #144794;
  --j-surface: #FFFFFF;
  --j-surface-overlay: #FFFFFF;
  --j-sunken: #F8F8F8;
  --j-neutral: #0515240F;
  --j-neutral-hover: #0B120E24;
  --j-neutral-pressed: #080F214A;
  --j-subtle-hover: #0515240F;
  --j-input-hover: #F8F8F8;
  --j-border: #0B120E24;
  --j-border-input: #8C8F97;
  --j-focus: #4688EC;
  --j-selected: #E9F2FE;
  --j-selected-text: #1868DB;
  --j-danger: #C9372C;
  --j-danger-hover: #AE2E24;
  --j-danger-text: #AE2E24;
  --j-success-text: #216E4E;
  --j-warning-bold: #FBC828;
  --j-card-shadow: 0 1px 1px rgba(30, 31, 33, 0.25), 0 0 1px rgba(30, 31, 33, 0.31);
  --j-raised-shadow: 0 8px 12px rgba(30, 31, 33, 0.15), 0 0 1px rgba(30, 31, 33, 0.31);

  position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0;
  overflow: hidden; background: var(--j-surface); color: var(--j-text);
  font-family: "Atlassian Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI",
    Ubuntu, "Helvetica Neue", sans-serif;
  font-size: 14px; line-height: 20px; text-align: left;
  -webkit-font-smoothing: antialiased;
}
.jira__body { position: relative; display: flex; flex: 1; min-height: 0; }
.jira__main { flex: 1; min-width: 0; min-height: 0; overflow: auto; background: var(--j-surface); }
.jira__scrim { display: none; }
@container sl-portal (max-width: 900px) {
  .jira__scrim { display: block; position: absolute; inset: 0; z-index: 25; background: rgba(5, 21, 36, 0.32); }
}

:where(.jira) :deep(:where(button, input, select, textarea)) { color: inherit; font-family: inherit; }
.jira :deep(input::placeholder), .jira :deep(textarea::placeholder) { color: var(--j-text-subtlest); opacity: 1; }
.jira :deep(input), .jira :deep(select), .jira :deep(textarea) { color-scheme: light; }

/* ---- the shared kit, reached by every page through :deep --------------- */
.jira :deep(.j-page) { padding: 24px 32px 40px; min-width: 0; }
.jira :deep(.j-crumbs) { display: flex; gap: 8px; font-size: 14px; color: var(--j-text-subtle); margin-bottom: 8px; flex-wrap: wrap; }
.jira :deep(.j-crumbs a) { color: var(--j-text-subtle); text-decoration: none; }
.jira :deep(.j-crumbs a:hover) { text-decoration: underline; }
.jira :deep(.j-crumbs .sep) { color: var(--j-text-subtlest); }
.jira :deep(.j-header) { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.jira :deep(.j-h1) { margin: 0; font-size: 24px; line-height: 28px; font-weight: 653; color: var(--j-text); }
.jira :deep(.j-h2) { margin: 0 0 8px; font-size: 16px; line-height: 20px; font-weight: 653; }
.jira :deep(.j-h3) { margin: 0 0 6px; font-size: 14px; line-height: 20px; font-weight: 653; }
.jira :deep(.j-actions) { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.jira :deep(.j-muted) { color: var(--j-text-subtle); }
.jira :deep(.j-small) { font-size: 12px; line-height: 16px; color: var(--j-text-subtlest); }
.jira :deep(.j-pre) { white-space: pre-wrap; margin: 0; }
.jira :deep(.j-output) {
  margin: 0; padding: 12px; max-height: 420px; overflow: auto; white-space: pre-wrap; word-break: break-word; color: var(--j-text);
  background: var(--j-sunken); border-radius: 3px; font: 12px/18px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}
.jira :deep(.j-link) { color: var(--j-link); text-decoration: none; background: none; border: 0; padding: 0; font: inherit; cursor: pointer; }
.jira :deep(.j-link:hover) { text-decoration: underline; }

/* Buttons: default (subtle grey), primary (brand), subtle, danger, warning. */
.jira :deep(.j-btn) {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 32px;
  padding: 0 12px; border: 0; border-radius: 3px; background: var(--j-neutral);
  color: var(--j-text-subtle); font: inherit; font-weight: 500; white-space: nowrap; cursor: pointer;
  text-decoration: none;
}
.jira :deep(.j-btn:hover) { background: var(--j-neutral-hover); color: var(--j-text); }
.jira :deep(.j-btn:active) { background: var(--j-neutral-pressed); }
.jira :deep(.j-btn:focus-visible) { outline: 2px solid var(--j-focus); outline-offset: 2px; }
.jira :deep(.j-btn:disabled) { background: var(--j-neutral); color: var(--j-text-disabled); cursor: not-allowed; }
.jira :deep(.j-btn--primary) { background: var(--j-brand); color: #fff; }
.jira :deep(.j-btn--primary:hover) { background: var(--j-brand-hover); color: #fff; }
.jira :deep(.j-btn--primary:active) { background: var(--j-brand-pressed); }
.jira :deep(.j-btn--subtle) { background: transparent; }
.jira :deep(.j-btn--subtle:hover) { background: var(--j-neutral); }
.jira :deep(.j-btn--danger) { background: var(--j-danger); color: #fff; }
.jira :deep(.j-btn--danger:hover) { background: var(--j-danger-hover); color: #fff; }
.jira :deep(.j-btn--warning) { background: var(--j-warning-bold); color: #292A2E; }
.jira :deep(.j-btn--compact) { height: 24px; padding: 0 6px; }
.jira :deep(.j-btn--icon) { width: 32px; padding: 0; }
.jira :deep(.j-btn--icon.j-btn--compact) { width: 24px; }

/* Form fields. */
.jira :deep(.j-field) { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; min-width: 0; }
.jira :deep(.j-label) { font-size: 12px; line-height: 16px; font-weight: 653; color: var(--j-text-subtle); }
.jira :deep(.j-req) { color: var(--j-danger-text); padding-left: 2px; }
.jira :deep(.j-help) { font-size: 12px; line-height: 16px; color: var(--j-text-subtlest); }
.jira :deep(.j-error) { display: flex; gap: 4px; align-items: center; font-size: 12px; line-height: 16px; color: var(--j-danger-text); }
.jira :deep(.j-input), .jira :deep(.j-select), .jira :deep(.j-textarea) {
  width: 100%; min-height: 36px; padding: 6px 8px; border: 1px solid var(--j-border-input); border-radius: 3px;
  background: var(--j-surface); color: var(--j-text); font: inherit; font-size: 14px; box-sizing: border-box;
}
.jira :deep(.j-input:hover), .jira :deep(.j-select:hover), .jira :deep(.j-textarea:hover) { background: var(--j-input-hover); }
.jira :deep(.j-input:focus), .jira :deep(.j-select:focus), .jira :deep(.j-textarea:focus) {
  outline: none; border-color: var(--j-focus); box-shadow: inset 0 0 0 1px var(--j-focus); background: var(--j-surface);
}
.jira :deep(.j-input.is-invalid), .jira :deep(.j-textarea.is-invalid), .jira :deep(.j-select.is-invalid) { border-color: var(--j-danger); }
.jira :deep(.j-select:disabled), .jira :deep(.j-input:disabled) { background: var(--j-neutral); color: var(--j-text-subtle); cursor: not-allowed; }
.jira :deep(.j-textarea) { min-height: 96px; resize: vertical; line-height: 20px; }
.jira :deep(.j-grid2) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.jira :deep(.j-check) { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
.jira :deep(.j-check input) { width: 14px; height: 14px; accent-color: var(--j-brand); }

/* Lozenges: 11px bold uppercase on a tinted ground. */
.jira :deep(.j-lozenge) {
  display: inline-flex; align-items: center; max-width: 200px; height: 16px; padding: 0 4px;
  border-radius: 3px; font-size: 11px; font-weight: 700; line-height: 16px; text-transform: uppercase;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: #DDDEE1; color: #292A2E;
}
.jira :deep(.j-lozenge--todo), .jira :deep(.j-lozenge--default) { background: #DDDEE1; color: #292A2E; }
.jira :deep(.j-lozenge--doing), .jira :deep(.j-lozenge--inprogress) { background: #CFE1FD; color: #1558BC; }
.jira :deep(.j-lozenge--done), .jira :deep(.j-lozenge--success) { background: #BAF3DB; color: #216E4E; }
.jira :deep(.j-lozenge--removed), .jira :deep(.j-lozenge--danger) { background: #FFD5D2; color: #AE2E24; }
.jira :deep(.j-lozenge--moved), .jira :deep(.j-lozenge--warning) { background: #FFF5DB; color: #7F5F01; }
.jira :deep(.j-lozenge--new), .jira :deep(.j-lozenge--discovery) { background: #EED7FC; color: #803FA5; }
.jira :deep(.j-lozenge--bold-done) { background: #1F845A; color: #fff; }
.jira :deep(.j-lozenge--bold-danger) { background: #C9372C; color: #fff; }
.jira :deep(.j-lozenge--bold-doing) { background: #1868DB; color: #fff; }

/* Story points: the grey pill. */
.jira :deep(.j-points) {
  display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px;
  padding: 0 6px; border-radius: 9px; background: #DDDEE1; color: #292A2E; font-size: 12px; font-weight: 600;
}
.jira :deep(.j-points--doing) { background: #CFE1FD; color: #1558BC; }
.jira :deep(.j-points--done) { background: #BAF3DB; color: #216E4E; }

/* Section messages (Atlassian's in-page banners). */
.jira :deep(.j-msg) {
  display: flex; gap: 12px; padding: 12px 16px; border-radius: 3px; background: #E9F2FE; margin-bottom: 16px;
  color: var(--j-text);
}
.jira :deep(.j-msg > .ji) { color: #1868DB; margin-top: 2px; }
.jira :deep(.j-msg--warning) { background: #FFF5DB; }
.jira :deep(.j-msg--warning > .ji) { color: #B38600; }
.jira :deep(.j-msg--error) { background: #FFECEB; }
.jira :deep(.j-msg--error > .ji) { color: #C9372C; }
.jira :deep(.j-msg--success) { background: #DCFFF1; }
.jira :deep(.j-msg--success > .ji) { color: #22A06B; }
.jira :deep(.j-msg__title) { font-weight: 653; margin-bottom: 2px; }

/* Tables (the dynamic table). */
.jira :deep(.j-table-wrap) { overflow-x: auto; border-bottom: 2px solid var(--j-border); }
.jira :deep(.j-table) { width: 100%; border-collapse: collapse; font-size: 14px; }
.jira :deep(.j-table th) {
  position: sticky; top: 0; padding: 4px 8px; border-bottom: 2px solid var(--j-border); background: var(--j-surface);
  color: var(--j-text-subtle); font-size: 12px; font-weight: 653; text-align: left; white-space: nowrap;
}
.jira :deep(.j-table td) { padding: 8px; border-bottom: 1px solid var(--j-border); vertical-align: middle; }
.jira :deep(.j-table tbody tr:hover) { background: var(--j-subtle-hover); }
.jira :deep(.j-table tr.is-selected) { background: var(--j-selected); }
.jira :deep(.j-nowrap) { white-space: nowrap; }
.jira :deep(.j-key) { color: var(--j-text-subtle); font-size: 12px; font-weight: 500; white-space: nowrap; }
.jira :deep(.j-key--done) { text-decoration: line-through; }

/* Tabs. */
.jira :deep(.j-tabs) { display: flex; gap: 0; box-shadow: inset 0 -2px 0 var(--j-border); margin-bottom: 16px; overflow-x: auto; overflow-y: hidden; }
.jira :deep(.j-tab) {
  position: relative; padding: 6px 8px; border: 0; border-bottom: 2px solid transparent;
  background: transparent; color: var(--j-text-subtle); font: inherit; font-weight: 500; cursor: pointer; white-space: nowrap;
}
.jira :deep(.j-tab:hover) { color: var(--j-text); border-bottom-color: var(--j-border); }
.jira :deep(.j-tab.is-active) { color: var(--j-brand); border-bottom-color: var(--j-brand); }

/* Empty states. */
.jira :deep(.j-empty) { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px 16px; text-align: center; }
.jira :deep(.j-empty h3) { margin: 0; font-size: 20px; line-height: 24px; font-weight: 653; }
.jira :deep(.j-empty p) { margin: 0; max-width: 460px; color: var(--j-text-subtle); }

/* Progress bars. */
.jira :deep(.j-progress) { position: relative; height: 6px; border-radius: 3px; background: #DDDEE1; overflow: hidden; min-width: 60px; }
.jira :deep(.j-progress > span) { position: absolute; inset: 0 auto 0 0; border-radius: 3px; background: #1868DB; }
.jira :deep(.j-progress--green > span) { background: #22A06B; }
.jira :deep(.j-progress--yellow > span) { background: #E2B203; }
.jira :deep(.j-progress--red > span) { background: #E2483D; }

@container sl-portal (max-width: 700px) {
  .jira :deep(.j-page) { padding: 16px 12px 32px; }
  .jira :deep(.j-grid2) { grid-template-columns: minmax(0, 1fr); }
  .jira :deep(.j-h1) { font-size: 20px; line-height: 24px; }
}
</style>
