<template>
  <div class="dh-app" dir="ltr" @mousedown="onAppDown">
    <!-- ===== DataHub's header: logo, the global search with its platform filter, and the menus ===== -->
    <header class="dh-header">
      <a href="#" class="dh-header__brand" @click.prevent="go({ page: 'home' })">
        <svg class="dh-logo" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <path d="M16 2 28 9v14l-12 7-12-7V9z" fill="#1677ff" />
          <path d="M16 2 28 9l-12 7L4 9z" fill="#4dabf7" />
          <path d="M16 16v14l-12-7V9z" fill="#0b4fae" />
          <circle cx="16" cy="16" r="4.2" fill="#fff" />
        </svg>
        <span class="dh-header__word">DataHub</span>
      </a>

      <div class="dh-search">
        <select v-model="searchPlatform" class="dh-search__scope" aria-label="Platform filter">
          <option value="">All platforms</option>
          <option v-for="p in platformsInCatalog" :key="p" :value="p">{{ platformLabel(p) }}</option>
        </select>
        <div class="dh-search__field">
          <DhIcon name="search" class="dh-search__icon" />
          <input v-model="searchText" class="dh-search__input" type="search" placeholder="Search Datasets, People, & more..."
                 aria-label="Search" @focus="suggestOpen = true" @keydown.enter.prevent="submitSearch"
                 @keydown.escape="suggestOpen = false" />
        </div>
        <div v-if="suggestOpen && suggestions.length" class="dh-suggest" role="listbox">
          <div class="dh-suggest__label">Datasets</div>
          <button v-for="d in suggestions" :key="d.urn" type="button" class="dh-suggest__item" role="option"
                  @mousedown.prevent="pickSuggestion(d.urn)">
            <PlatformIcon :platform="d.platform" :size="16" />
            <span class="dh-suggest__name">{{ shortName(d.urn) }}</span>
            <span class="dh-suggest__path">{{ platformLabel(d.platform) }} · {{ browsePath(d.urn).join(' / ') }}</span>
          </button>
          <button type="button" class="dh-suggest__all" @mousedown.prevent="submitSearch">
            <DhIcon name="search" /> View all results for "{{ searchText || '*' }}"
          </button>
        </div>
      </div>

      <nav class="dh-nav" :class="{ 'is-open': navOpen }" aria-label="DataHub">
        <div class="dh-nav__menu">
          <button type="button" class="dh-nav__item" :class="{ 'is-active': section === 'govern' }"
                  :aria-expanded="menu === 'govern'" @click="toggleMenu('govern')">
            <DhIcon name="book" /> Govern <DhIcon name="chevron-down" :size="12" />
          </button>
          <div v-if="menu === 'govern'" class="dh-drop">
            <button type="button" @click="go({ page: 'glossary' })"><DhIcon name="book" /><span><b>Glossary</b><small>View and modify your data dictionary</small></span></button>
            <button type="button" @click="go({ page: 'domains' })"><DhIcon name="domain" /><span><b>Domains</b><small>Manage related groups of data assets</small></span></button>
          </div>
        </div>
        <div class="dh-nav__menu">
          <button type="button" class="dh-nav__item" :class="{ 'is-active': section === 'observe' }"
                  :aria-expanded="menu === 'observe'" @click="toggleMenu('observe')">
            <DhIcon name="pulse" /> Observe <DhIcon name="chevron-down" :size="12" />
            <span v-if="openIncidents" class="dh-nav__badge">{{ openIncidents }}</span>
          </button>
          <div v-if="menu === 'observe'" class="dh-drop">
            <button type="button" @click="go({ page: 'monitors' })"><DhIcon name="pulse" /><span><b>Monitors</b><small>Freshness, volume, schema and distribution</small></span></button>
            <button type="button" @click="go({ page: 'incidents' })"><DhIcon name="incident" /><span><b>Incidents</b><small>{{ openIncidents }} open</small></span></button>
            <button type="button" @click="go({ page: 'contracts' })"><DhIcon name="contract" /><span><b>Data Contracts</b><small>Validate, diff and publish contracts</small></span></button>
            <button type="button" @click="go({ page: 'gx' })"><DhIcon name="quality" /><span><b>Great Expectations</b><small>Checkpoints, suites and validation results</small></span></button>
          </div>
        </div>
        <div class="dh-nav__menu">
          <button type="button" class="dh-nav__item" :class="{ 'is-active': section === 'compliance' }"
                  :aria-expanded="menu === 'compliance'" @click="toggleMenu('compliance')">
            <DhIcon name="shield" /> Compliance <DhIcon name="chevron-down" :size="12" />
          </button>
          <div v-if="menu === 'compliance'" class="dh-drop">
            <button type="button" @click="go({ page: 'pii' })"><DhIcon name="lock" /><span><b>PII Audit</b><small>Classified columns and masking coverage</small></span></button>
            <button type="button" @click="go({ page: 'erasure' })"><DhIcon name="eraser" /><span><b>GDPR Erasure</b><small>Right-to-be-forgotten requests</small></span></button>
          </div>
        </div>
        <button type="button" class="dh-nav__item" :class="{ 'is-active': section === 'ingestion' }" @click="go({ page: 'ingestion' })">
          <DhIcon name="plug" /> Ingestion
        </button>
      </nav>
      <div class="dh-header__right">
        <button type="button" class="dh-header__icon" title="Help" aria-label="Help" @click="help"><DhIcon name="help" :size="18" /></button>
        <span class="dh-avatar" title="datahub (you)">D</span>
      </div>
      <button type="button" class="dh-header__burger" aria-label="Menu" :aria-expanded="navOpen" @click="navOpen = !navOpen">
        <DhIcon name="menu" :size="20" />
      </button>
    </header>

    <!-- ===== antd `message`: small toasts at the top centre ===== -->
    <div class="dh-messages" aria-live="polite">
      <div v-for="flash in shownFlashes" :key="flash.id" class="dh-message" :class="'is-' + flash.type" role="status">
        <DhIcon :name="flash.type === 'success' ? 'check-circle' : flash.type === 'error' ? 'x-circle' : flash.type === 'warning' ? 'warning' : 'info'"
                class="dh-message__icon" />
        <div class="dh-message__body">
          <span class="dh-message__title">{{ flash.title }}</span>
          <span v-if="flash.detail" class="dh-message__detail">{{ flash.detail }}</span>
        </div>
        <button type="button" class="dh-message__x" aria-label="Close" @click="api.dismiss(flash.id)"><DhIcon name="close" :size="12" /></button>
      </div>
    </div>

    <main class="dh-main" :class="{ 'is-busy': busyRef }">
      <HomePage v-if="route.page === 'home'" :recent="recent" />
      <SearchPage v-else-if="route.page === 'search'" :key="'s-' + (route.query || '')" />
      <EntityPage v-else-if="route.page === 'entity'" :key="'e-' + route.urn" />
      <GlossaryPage v-else-if="route.page === 'glossary'" :key="'g-' + (route.name || '')" />
      <DomainsPage v-else-if="route.page === 'domains'" :key="'d-' + (route.name || '')" />
      <MonitorsPage v-else-if="route.page === 'monitors'" />
      <IncidentsPage v-else-if="route.page === 'incidents'" />
      <ContractsPage v-else-if="route.page === 'contracts'" />
      <GxPage v-else-if="route.page === 'gx'" />
      <IngestionPage v-else-if="route.page === 'ingestion'" />
      <PiiPage v-else-if="route.page === 'pii'" />
      <ErasurePage v-else />
    </main>

    <DhModal v-if="pending" :title="pending.title" :ok-text="pending.yes || 'Yes'" :danger="pending.danger"
             :ok-disabled="Boolean(pending.typeToConfirm) && typed.trim() !== pending.typeToConfirm"
             @close="answer(false)" @ok="answer(true)">
      <div class="dh-confirm">
        <DhIcon :name="pending.danger ? 'warning' : 'info'" :size="22" class="dh-confirm__icon" :class="{ 'is-danger': pending.danger }" />
        <div class="dh-confirm__text">
          <p>{{ pending.message }}</p>
          <label v-if="pending.typeToConfirm" class="dh-confirm__type">
            <span>Type <code>{{ pending.typeToConfirm }}</code> to confirm.</span>
            <input v-model="typed" class="dh-confirm__input" :placeholder="pending.typeToConfirm" aria-label="Confirmation text" />
          </label>
        </div>
      </div>
    </DhModal>
  </div>
</template>

<script setup lang="ts">
/**
 * DataHub (0.13 / Acryl look) over the lab's data-quality and catalogue engine.
 *
 * The engine (`utils/sims/dataplat/quality.py` on app 11) owns four CLIs -
 * `datahub`, `gx`, `contract`, `monitor` - and this portal is DataHub's view of
 * all of them: the catalogue every other product registered into (search,
 * dataset pages, lineage), the governance edits people make (owners, tags,
 * glossary terms, domains, documentation), the observability layer (monitors,
 * incidents, contracts, Great Expectations assertions), ingestion recipes and
 * compliance (PII audit, GDPR erasure). Every write runs the command line a
 * student could type into the Data Quality & Catalog CLI beside it.
 */
import { computed, onMounted, provide, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { pick, rows } from '@/utils/portalKit';
import DhIcon from './DhIcon.vue';
import DhModal from './DhModal.vue';
import PlatformIcon from './PlatformIcon.vue';
import HomePage from './HomePage.vue';
import SearchPage from './SearchPage.vue';
import EntityPage from './EntityPage.vue';
import GlossaryPage from './GlossaryPage.vue';
import DomainsPage from './DomainsPage.vue';
import MonitorsPage from './MonitorsPage.vue';
import IncidentsPage from './IncidentsPage.vue';
import ContractsPage from './ContractsPage.vue';
import GxPage from './GxPage.vue';
import IngestionPage from './IngestionPage.vue';
import PiiPage from './PiiPage.vue';
import ErasurePage from './ErasurePage.vue';
import {
  DH, browsePath, dh, platformLabel, routeUrl, searchDatasets, shortName,
  type ConfirmRequest, type DhCheckpoint, type DhContext, type DhContract, type DhContractFile, type DhDataset,
  type DhDiff, type DhDomain, type DhEdge, type DhErasure, type DhIncident, type DhIngest, type DhMonitor,
  type DhProfile, type DhRecipeFile, type DhResult, type DhRoute, type DhSuite, type DhTerm, type RunOptions,
} from './dhContext';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const viewRef = computed(() => props.view || {});
const q = (path: string) => rows<any>(viewRef.value, 'quality.' + path);

const datasets = computed(() => q('catalog.datasets') as DhDataset[]);
const edges = computed(() => q('catalog.lineage') as DhEdge[]);
const terms = computed(() => q('catalog.terms') as DhTerm[]);
const domains = computed(() => q('catalog.domains') as DhDomain[]);
const suites = computed(() => q('suites') as DhSuite[]);
const suiteErrors = computed(() => q('suite_errors') as { path: string; error: string }[]);
const checkpoints = computed(() => q('checkpoints') as DhCheckpoint[]);
const results = computed(() => q('results') as DhResult[]);
const contracts = computed(() => q('contracts') as DhContract[]);
const contractFiles = computed(() => q('files.contracts') as DhContractFile[]);
const recipeFiles = computed(() => q('files.recipes') as DhRecipeFile[]);
const diffs = computed(() => q('diffs') as DhDiff[]);
const monitors = computed(() => q('monitors') as DhMonitor[]);
const incidents = computed(() => q('incidents') as DhIncident[]);
const erasures = computed(() => q('erasures') as DhErasure[]);
const ingests = computed(() => q('ingests') as DhIngest[]);
const profiles = computed(() => q('profiles') as DhProfile[]);
const piiUnmasked = computed(() => pick<string[]>(viewRef.value, 'quality.pii_unmasked', []).map(String));
const lastAudit = computed(() => pick<any>(viewRef.value, 'quality.last_audit', null));
const docsBuilt = computed(() => Boolean(pick(viewRef.value, 'quality.docs_built', false)));
const clockText = computed(() => String(pick(viewRef.value, 'time', '')));
const clock = computed(() => Number(pick(viewRef.value, 'clock', 0)) || 0);
const busyRef = computed(() => Boolean(props.busy));

const openIncidents = computed(() => incidents.value.filter(i => i.status !== 'resolved').length);
const platformsInCatalog = computed(() => [...new Set(datasets.value.map(d => d.platform))].sort());

const route = ref<DhRoute>({ page: 'home' });
const recent = ref<string[]>([]);
const navOpen = ref(false);
const menu = ref('');

const section = computed(() => {
  const page = route.value.page;
  if (page === 'glossary' || page === 'domains') return 'govern';
  if (['monitors', 'incidents', 'contracts', 'gx'].includes(page)) return 'observe';
  if (page === 'pii' || page === 'erasure') return 'compliance';
  if (page === 'ingestion') return 'ingestion';
  return '';
});

function go(next: DhRoute) {
  route.value = next;
  navOpen.value = false;
  menu.value = '';
  suggestOpen.value = false;
}

function openEntity(urn: string, tab = 'Schema') {
  recent.value = [urn, ...recent.value.filter(u => u !== urn)].slice(0, 6);
  go({ page: 'entity', urn, tab });
  // DataHub's page load is a GraphQL read; the CLI's is `datahub get`. Logged on
  // the lab (so "inspected the dataset" is checkable) but not in the CLI strip.
  void read(dh(['datahub', 'get'], { '--urn': urn }));
}

watch(route, value => emit('location', routeUrl(value)), { immediate: true, deep: true });

function toggleMenu(name: string) {
  menu.value = menu.value === name ? '' : name;
}

function onAppDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (menu.value && target && !target.closest('.dh-nav__menu')) menu.value = '';
  if (suggestOpen.value && target && !target.closest('.dh-search')) suggestOpen.value = false;
}

async function run(command: string, options: RunOptions = {}) {
  return props.api.exec(command, { success: options.success, quiet: options.quiet, failure: options.failure });
}

async function read(command: string) {
  return props.api.exec(command, { quiet: true, unlogged: true });
}

/* ----- the global search ----- */
const searchText = ref('');
const searchPlatform = ref('');
const suggestOpen = ref(false);
const suggestions = computed(() => {
  if (!searchText.value.trim()) return [];
  return searchDatasets(datasets.value, searchText.value, searchPlatform.value ? [searchPlatform.value] : []).slice(0, 6);
});

function pickSuggestion(urn: string) {
  suggestOpen.value = false;
  openEntity(urn);
}

async function submitSearch() {
  suggestOpen.value = false;
  const query = searchText.value.trim();
  const platforms = searchPlatform.value ? [searchPlatform.value] : [];
  go({ page: 'search', query, platforms });
  await run(dh(['datahub', 'search', query || '*'], { '--platform': searchPlatform.value || null }), { quiet: true });
}

watch(route, value => {
  if (value.page === 'search') {
    searchText.value = value.query || '';
    searchPlatform.value = (value.platforms && value.platforms.length === 1) ? (value.platforms[0] ?? '') : '';
  }
});

/* ----- confirm ----- */
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

const shownFlashes = computed(() => props.api.flashes.value.slice(0, 3));

function help() {
  notify('info', 'DataHub documentation', 'https://datahubproject.io/docs - this lab is offline; the CLI help is `datahub help`.');
}

const ctx: DhContext = {
  datasets, edges, terms, domains, suites, suiteErrors, checkpoints, results, contracts, contractFiles, recipeFiles,
  diffs, monitors, incidents, erasures, ingests, profiles, piiUnmasked, lastAudit, docsBuilt, clockText, clock,
  busy: busyRef,
  route,
  go,
  openEntity,
  run,
  read,
  confirm,
  notify,
  dataset: urn => datasets.value.find(d => d.urn === urn)
    || datasets.value.find(d => d.urn.toLowerCase() === String(urn).toLowerCase()),
};
provide(DH, ctx);

// The platform is built on its first command. A lab opened straight onto the
// portal has not run one yet, so the catalogue would read as empty: boot it
// with the cheapest read there is.
onMounted(() => {
  if (!pick(viewRef.value, 'installed', false)) void read(dh(['datahub', 'version']));
});
</script>

<style scoped>
.dh-app {
  /* DataHub's antd tokens. */
  --dh-primary: #1677ff;
  --dh-primary-hover: #0958d9;
  --dh-link: #1366d6;
  --dh-text: #262626;
  --dh-text-2: #595959;
  --dh-border: #f0f0f0;
  --dh-border-2: #d9d9d9;
  --dh-bg: #f8f9fa;
  --dh-hover: #f5f5f5;
  --dh-danger: #cf1322;
  --dh-success: #389e0d;
  --dh-warning: #d48806;
  --dh-font: Manrope, Mulish, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --dh-mono: 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;

  color-scheme: light;
  position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;
  background: var(--dh-bg); color: var(--dh-text); font-family: var(--dh-font); font-size: 14px; line-height: 22px;
}
.dh-header {
  flex: none; display: flex; align-items: center; gap: 20px; height: 64px; padding: 0 20px;
  background: #fff; border-bottom: 1px solid var(--dh-border); box-shadow: 0 1px 2px rgba(0, 0, 0, .04); position: relative; z-index: 30;
}
.dh-header__brand { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: var(--dh-text); flex: none; }
.dh-header__word { font-size: 18px; font-weight: 800; letter-spacing: -.2px; }
.dh-logo { display: block; }

.dh-search { position: relative; flex: 1 1 480px; max-width: 620px; min-width: 200px; display: flex; height: 40px; }
.dh-search__scope {
  flex: none; width: 140px; border: 1px solid var(--dh-border-2); border-right: 0; border-radius: 8px 0 0 8px;
  background: #fafafa; font: inherit; font-size: 13px; color: var(--dh-text); padding: 0 8px; cursor: pointer;
}
.dh-search__field { flex: 1; position: relative; min-width: 0; }
.dh-search__icon { position: absolute; left: 12px; top: 12px; color: #8c8c8c; }
.dh-search__input {
  width: 100%; height: 40px; box-sizing: border-box; border: 1px solid var(--dh-border-2); border-radius: 0 8px 8px 0;
  padding: 0 12px 0 36px; font: inherit; font-size: 14px; color: var(--dh-text); background: #fff;
}
.dh-search__input:focus { outline: none; border-color: var(--dh-primary); box-shadow: 0 0 0 2px rgba(22, 119, 255, .15); }
.dh-search__input::placeholder { color: #8c8c8c; }
.dh-suggest {
  position: absolute; top: 44px; left: 0; right: 0; z-index: 60; background: #fff; border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, .12); padding: 6px 0; display: flex; flex-direction: column;
}
.dh-suggest__label { font-size: 12px; color: var(--dh-text-2); padding: 4px 14px; font-weight: 600; }
.dh-suggest__item, .dh-suggest__all {
  display: flex; align-items: center; gap: 8px; border: 0; background: none; padding: 7px 14px; font: inherit; font-size: 14px;
  color: var(--dh-text); text-align: left; cursor: pointer; min-width: 0;
}
.dh-suggest__item:hover, .dh-suggest__all:hover { background: #f0f5ff; }
.dh-suggest__name { font-weight: 600; flex: none; }
.dh-suggest__path { color: var(--dh-text-2); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dh-suggest__all { border-top: 1px solid var(--dh-border); margin-top: 4px; color: var(--dh-link); }

.dh-nav { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.dh-nav__menu { position: relative; }
.dh-nav__item {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: 0; border-radius: 6px;
  background: none; font: inherit; font-size: 14px; color: var(--dh-text); cursor: pointer; white-space: nowrap; position: relative;
}
.dh-nav__item:hover { background: var(--dh-hover); }
.dh-nav__item.is-active { color: var(--dh-primary); font-weight: 600; }
.dh-nav__badge { min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--dh-danger); color: #fff; font-size: 10px; line-height: 16px; text-align: center; font-weight: 700; }
.dh-drop {
  position: absolute; top: 42px; right: 0; z-index: 60; width: 300px; background: #fff; border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, .12); padding: 6px; display: flex; flex-direction: column;
}
.dh-drop button {
  display: flex; align-items: flex-start; gap: 10px; border: 0; background: none; padding: 8px 10px; border-radius: 6px;
  font: inherit; text-align: left; cursor: pointer; color: var(--dh-text);
}
.dh-drop button:hover { background: #f0f5ff; }
.dh-drop button > .dh-ico { margin-top: 3px; color: var(--dh-primary); }
.dh-drop span { display: flex; flex-direction: column; min-width: 0; }
.dh-drop b { font-weight: 600; font-size: 14px; }
.dh-drop small { color: var(--dh-text-2); font-size: 12px; line-height: 18px; }
.dh-header__right { display: flex; align-items: center; gap: 10px; flex: none; }
.dh-header__icon { border: 0; background: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; color: #595959; display: grid; place-items: center; }
.dh-header__icon:hover { background: var(--dh-hover); }
.dh-avatar { width: 30px; height: 30px; border-radius: 50%; background: #722ed1; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 13px; }
.dh-header__burger { display: none; border: 0; background: none; width: 36px; height: 36px; border-radius: 6px; cursor: pointer; color: var(--dh-text); }

.dh-main { flex: 1; min-height: 0; overflow: auto; position: relative; }
.dh-main.is-busy { cursor: progress; }

.dh-messages { position: absolute; top: 76px; left: 50%; transform: translateX(-50%); z-index: 80; display: flex; flex-direction: column; align-items: center; gap: 8px; width: min(520px, calc(100% - 32px)); pointer-events: none; }
.dh-message {
  pointer-events: auto; display: flex; align-items: flex-start; gap: 8px; padding: 9px 12px; background: #fff; border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, .08), 0 3px 6px -4px rgba(0, 0, 0, .12); max-width: 100%;
}
.dh-message__icon { margin-top: 3px; }
.is-success .dh-message__icon { color: #52c41a; }
.is-error .dh-message__icon { color: #ff4d4f; }
.is-info .dh-message__icon, .is-progress .dh-message__icon { color: #1677ff; }
.is-warning .dh-message__icon { color: #faad14; }
.dh-message__body { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
.dh-message__title { color: var(--dh-text); }
.dh-message__detail { color: var(--dh-text-2); font-size: 13px; line-height: 18px; }
.dh-message__x { border: 0; background: none; padding: 3px; color: #8c8c8c; cursor: pointer; border-radius: 4px; }
.dh-message__x:hover { color: var(--dh-text); background: var(--dh-hover); }

.dh-confirm { display: flex; gap: 12px; align-items: flex-start; }
.dh-confirm__icon { color: #1677ff; margin-top: 2px; }
.dh-confirm__icon.is-danger { color: #faad14; }
.dh-confirm__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.dh-confirm__text p { margin: 0; overflow-wrap: anywhere; }
.dh-confirm__type { display: flex; flex-direction: column; gap: 6px; }
.dh-confirm__type code { background: #f5f5f5; padding: 0 4px; border-radius: 3px; font-family: var(--dh-mono); font-size: 12px; }
.dh-confirm__input { height: 32px; border: 1px solid var(--dh-border-2); border-radius: 6px; padding: 0 10px; font: inherit; color: var(--dh-text); background: #fff; }
.dh-confirm__input:focus { outline: none; border-color: var(--dh-primary); }

@container sl-portal (max-width: 1180px) {
  .dh-header__word { display: none; }
  .dh-nav__item { padding: 0 8px; }
}
@container sl-portal (max-width: 960px) {
  .dh-header { gap: 12px; padding: 0 12px; }
  .dh-header__burger { display: inline-grid; place-items: center; }
  .dh-header__right { display: none; }
  .dh-search__scope { width: 92px; }
  .dh-nav {
    display: none; position: absolute; top: 64px; left: 0; right: 0; flex-direction: column; align-items: stretch;
    background: #fff; padding: 6px; box-shadow: 0 6px 16px rgba(0, 0, 0, .12); gap: 2px;
  }
  .dh-nav.is-open { display: flex; }
  .dh-nav__item { width: 100%; justify-content: flex-start; }
  .dh-drop { position: static; width: auto; box-shadow: none; padding: 0 0 0 18px; }
}
@container sl-portal (max-width: 560px) {
  .dh-search__scope { display: none; }
  .dh-search__input { border-radius: 8px; }
  .dh-search { min-width: 0; }
}
</style>
