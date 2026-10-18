<template>
  <div class="mf-app" dir="ltr">
    <!-- ===== The MLflow 2.x header: logo, version, Experiments / Models / Prompts, Docs and GitHub ===== -->
    <header class="mf-header">
      <a href="#" class="mf-header__brand" @click.prevent="go({ page: 'experiments', expId: defaultExpId, mode: 'table' })">
        <MfLogo />
      </a>
      <span class="mf-header__version" title="MLflow version">{{ version }}</span>
      <nav class="mf-header__nav" :class="{ 'is-open': navOpen }" aria-label="MLflow">
        <a href="#" :class="{ 'is-active': section === 'experiments' }"
           @click.prevent="go({ page: 'experiments', expId: currentExpId, mode: 'table' })">Experiments</a>
        <a href="#" :class="{ 'is-active': section === 'models' }" @click.prevent="go({ page: 'models' })">Models</a>
        <a href="#" :class="{ 'is-active': section === 'prompts' }" @click.prevent="go({ page: 'prompts' })">Prompts</a>
      </nav>
      <div class="mf-spacer"></div>
      <div class="mf-header__right">
        <a href="#" class="mf-header__ext" @click.prevent="openDocs">
          <span>Docs</span>
        </a>
        <a href="#" class="mf-header__ext" @click.prevent="openGithub">
          <MfIcon name="github" /><span>GitHub</span>
        </a>
      </div>
      <button type="button" class="mf-header__burger" aria-label="Menu" :aria-expanded="navOpen" @click="navOpen = !navOpen">
        <MfIcon name="menu" />
      </button>
    </header>

    <!-- ===== Notifications (Du Bois / antd notification, top right) ===== -->
    <div class="mf-notes" aria-live="polite">
      <div v-for="flash in shownFlashes" :key="flash.id" class="mf-note" :class="'mf-note--' + flash.type" role="status">
        <MfIcon :name="flash.type === 'success' ? 'check-circle' : flash.type === 'error' ? 'x-circle' : flash.type === 'warning' ? 'warning' : 'info'"
                class="mf-note__icon" />
        <div class="mf-note__body">
          <strong>{{ flash.title }}</strong>
          <span v-if="flash.detail">{{ flash.detail }}</span>
        </div>
        <button type="button" class="mf-note__x" aria-label="Close" @click="api.dismiss(flash.id)"><MfIcon name="close" /></button>
      </div>
    </div>

    <main class="mf-main">
      <ExperimentsPage v-if="route.page === 'experiments'" :key="'exp-' + route.expId" />
      <RunPage v-else-if="route.page === 'run'" :key="'run-' + route.runId" />
      <ComparePage v-else-if="route.page === 'compare'" />
      <ModelsPage v-else-if="route.page === 'models'" />
      <ModelPage v-else-if="route.page === 'model'" :key="'model-' + route.name" />
      <VersionPage v-else-if="route.page === 'version'" :key="'ver-' + route.name + route.version" />
      <PromptsPage v-else />
    </main>

    <MfModal v-if="pending" :title="pending.title" :ok-text="pending.yes || 'OK'" :danger="pending.danger"
             @close="answer(false)" @ok="answer(true)">
      <p class="mf-confirm-text">{{ pending.message }}</p>
    </MfModal>
  </div>
</template>

<script setup lang="ts">
/**
 * The MLflow UI (2.x, Databricks Du Bois look) over the lab's MLOps engine.
 *
 * The engine (`utils/sims/mlops.py` on app 11) is one store behind ten tool
 * names; this portal is MLflow's view of it: the experiments and the runs that
 * `mlx train` / `mlx finetune` record, the model registry, and the evaluation
 * results logged against runs. Every action runs the `mlflow ...` command a
 * student could type into the console beside it. Anything that is not MLflow
 * (DVC, the trainer itself, drift monitoring) is deliberately left out.
 */
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { pick, rows } from '@/utils/portalKit';
import MfIcon from './MfIcon.vue';
import MfLogo from './MfLogo.vue';
import MfModal from './MfModal.vue';
import ExperimentsPage from './ExperimentsPage.vue';
import RunPage from './RunPage.vue';
import ComparePage from './ComparePage.vue';
import ModelsPage from './ModelsPage.vue';
import ModelPage from './ModelPage.vue';
import VersionPage from './VersionPage.vue';
import PromptsPage from './PromptsPage.vue';
import { MF, type ConfirmRequest, type MfContext, type RunOptions } from './mfContext';
import { routeUrl, type MfEval, type MfExperiment, type MfModel, type MfRoute, type MfRun, type MfServing } from './mlflow';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const viewRef = computed(() => props.view || {});
const version = computed(() => String(pick(viewRef.value, 'mlflow.version', '2.17.2')));
const experiments = computed(() => rows<MfExperiment>(viewRef.value, 'mlflow.experiments'));
const runs = computed(() => rows<MfRun>(viewRef.value, 'mlflow.runs'));
const models = computed(() => rows<MfModel>(viewRef.value, 'mlflow.models'));
const evals = computed(() => rows<MfEval>(viewRef.value, 'mlflow.evals'));
const serving = computed(() => rows<MfServing>(viewRef.value, 'serving'));
const busyRef = computed(() => Boolean(props.busy));

/** The experiment MLflow opens on: the newest live one, else Default. */
const defaultExpId = computed(() => {
  const live = experiments.value.filter(e => e.lifecycle_stage !== 'deleted' && !e.default);
  return live.length ? live[live.length - 1].id : '0';
});

const route = ref<MfRoute>({ page: 'experiments', expId: defaultExpId.value, mode: 'table' });
const navOpen = ref(false);
const now = ref(Date.now());
let timer = 0;
onMounted(() => { timer = window.setInterval(() => { now.value = Date.now(); }, 20000); });
onBeforeUnmount(() => window.clearInterval(timer));

const section = computed(() => {
  const page = route.value.page;
  if (page === 'models' || page === 'model' || page === 'version') return 'models';
  if (page === 'prompts') return 'prompts';
  return 'experiments';
});
const currentExpId = computed(() => {
  const r = route.value;
  if (r.page === 'experiments' || r.page === 'run') return r.expId;
  return defaultExpId.value;
});

function go(next: MfRoute) {
  route.value = next;
  navOpen.value = false;
}

watch(route, value => emit('location', routeUrl(value)), { immediate: true, deep: true });

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

const shownFlashes = computed(() => props.api.flashes.value.slice(0, 3));

function openDocs() {
  notify('info', 'MLflow documentation', 'https://mlflow.org/docs/latest - this lab is offline, so the docs open outside it.');
}
function openGithub() {
  notify('info', 'mlflow/mlflow on GitHub', 'https://github.com/mlflow/mlflow - this lab is offline.');
}

const ctx: MfContext = {
  version,
  experiments,
  runs,
  models,
  evals,
  serving,
  now,
  busy: busyRef,
  route,
  go,
  run,
  confirm,
  notify,
  experiment: id => experiments.value.find(e => e.id === id),
  findRun: id => runs.value.find(r => r.run_id === id || r.run_id.startsWith(id)),
  model: name => models.value.find(m => m.name === name),
};
provide(MF, ctx);
</script>

<style scoped>
.mf-app {
  /* Du Bois tokens, as the MLflow UI spends them. */
  --mf-primary: #2272B4;
  --mf-primary-hover: #0E538B;
  --mf-link: #2272B4;
  --mf-link-hover: #0E538B;
  --mf-brand: #0194E2;
  --mf-header: #082138;
  --mf-text: #11171C;
  --mf-text-2: #5F7281;
  --mf-text-3: #8396A5;
  --mf-border: #D1D9E1;
  --mf-border-light: #E8ECF0;
  --mf-bg: #FFFFFF;
  --mf-bg-2: #F6F7F9;
  --mf-row-hover: #F2F5F7;
  --mf-row-selected: #EAF4FB;
  --mf-tag-bg: #EEF1F4;
  --mf-blue-bg: #F0F8FF;
  --mf-alias-bg: #E6F1FA;
  --mf-alias-text: #0E538B;
  --mf-danger: #C82D4C;
  --mf-danger-hover: #9E102C;
  --mf-success: #277C43;
  --mf-warning: #BE501E;
  --mf-radius: 4px;
  --mf-shadow-xs: 0 1px 0 rgba(0, 0, 0, 0.02);
  --mf-shadow-lg: 0 2px 16px rgba(27, 31, 35, 0.16);
  --mf-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
  --mf-mono: 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;

  color-scheme: light;
  position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;
  background: var(--mf-bg); color: var(--mf-text); font-family: var(--mf-font); font-size: 13px; line-height: 20px;
}
.mf-header {
  flex: none; display: flex; align-items: center; gap: 24px; height: 60px; padding: 0 24px;
  background: var(--mf-header); color: #fff; position: relative; z-index: 20;
}
.mf-header__brand { display: inline-flex; align-items: center; text-decoration: none; }
.mf-header__version {
  margin-left: -16px; font-size: 12px; line-height: 16px; padding: 0 6px; border-radius: 10px;
  background: rgba(255, 255, 255, 0.12); color: #E3E9EF; align-self: center;
}
.mf-header__nav { display: flex; align-items: center; gap: 24px; }
.mf-header__nav a, .mf-header__ext {
  color: #E3E9EF; text-decoration: none; font-size: 16px; line-height: 24px; display: inline-flex; align-items: center; gap: 6px;
  border-bottom: 2px solid transparent; padding: 4px 0;
}
.mf-header__nav a:hover, .mf-header__ext:hover { color: #43C9ED; }
.mf-header__nav a.is-active { color: #43C9ED; font-weight: 600; }
.mf-header__right { display: flex; align-items: center; gap: 24px; }
.mf-header__ext { font-size: 14px; }
.mf-spacer { flex: 1; }
.mf-header__burger { display: none; border: 0; background: none; color: #fff; width: 36px; height: 36px; cursor: pointer; border-radius: 4px; }
.mf-header__burger:hover { background: rgba(255, 255, 255, 0.1); }
.mf-header__burger .mf-ico { width: 20px; height: 20px; }

.mf-main { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

.mf-notes { position: absolute; top: 72px; right: 16px; z-index: 60; display: flex; flex-direction: column; gap: 8px; width: min(384px, calc(100% - 32px)); pointer-events: none; }
.mf-note {
  pointer-events: auto; display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; background: #fff;
  border-radius: 8px; box-shadow: var(--mf-shadow-lg); font-size: 13px;
}
.mf-note__icon { width: 20px; height: 20px; margin-top: 1px; }
.mf-note--success .mf-note__icon { color: var(--mf-success); }
.mf-note--error .mf-note__icon { color: var(--mf-danger); }
.mf-note--info .mf-note__icon { color: var(--mf-link); }
.mf-note--warning .mf-note__icon { color: var(--mf-warning); }
.mf-note__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; overflow-wrap: anywhere; }
.mf-note__body strong { font-size: 14px; font-weight: 600; color: var(--mf-text); }
.mf-note__body span { color: var(--mf-text-2); }
.mf-note__x { border: 0; background: none; color: var(--mf-text-2); cursor: pointer; padding: 2px; border-radius: 4px; }
.mf-note__x:hover { background: var(--mf-row-hover); }
.mf-confirm-text { margin: 0; overflow-wrap: anywhere; }

@container sl-portal (max-width: 900px) {
  .mf-header { gap: 16px; padding: 0 12px; }
  .mf-header__burger { display: inline-grid; place-items: center; }
  .mf-header__right { display: none; }
  .mf-header__nav {
    display: none; position: absolute; top: 60px; left: 0; right: 0; flex-direction: column; align-items: stretch; gap: 0;
    background: var(--mf-header); padding: 4px 0 8px; box-shadow: var(--mf-shadow-lg);
  }
  .mf-header__nav.is-open { display: flex; }
  .mf-header__nav a { padding: 10px 16px; }
}
</style>
