<template>
  <div class="spk" dir="ltr">
    <nav class="spk-nav" aria-label="Spark UI">
      <a href="#" class="spk-brand" @click.prevent="go({ page: 'history' })">
        <svg class="spk-logo" viewBox="0 0 92 40" aria-hidden="true">
          <text x="3" y="11" font-size="7.5" font-family="Arial, sans-serif" fill="#3c3a3e" letter-spacing="1.4">APACHE</text>
          <text x="1" y="34" font-size="26" font-weight="700" font-style="italic" font-family="Arial, Helvetica, sans-serif" fill="#3c3a3e">Spark</text>
          <path d="M80 3 83.2 10.4 91 11.2 85.1 16.3 86.9 24 80 19.9 73.1 24 74.9 16.3 69 11.2 76.8 10.4Z" fill="#E25A1C" />
        </svg>
        <span class="spk-version">{{ version }}</span>
      </a>
      <button type="button" class="spk-burger" aria-label="Menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
        <span></span><span></span><span></span>
      </button>
      <ul v-if="app" class="spk-tabs" :class="{ 'is-open': menuOpen }">
        <li v-for="t in TABS" :key="t.page" :class="{ active: tabActive(t.page) }">
          <a href="#" @click.prevent="go({ page: t.page, app: app.id })">{{ t.label }}</a>
        </li>
      </ul>
      <span v-if="app" class="spk-appname" :title="app.name">{{ app.name }} application UI</span>
    </nav>

    <div class="spk-flashes" aria-live="polite">
      <div v-for="flash in api.flashes.value" :key="flash.id" class="spk-flash" :class="'is-' + flash.type">
        <strong>{{ flash.title }}</strong>
        <span v-if="flash.detail" class="spk-flash__detail">{{ flash.detail }}</span>
        <button type="button" class="spk-flash__x" aria-label="Dismiss" @click="api.dismiss(flash.id)">×</button>
      </div>
    </div>

    <main class="spk-body">
      <SparkHistory v-if="route.page === 'history' || !app" :view="view" :apps="apps" :api="api" :busy="busy" @navigate="go" />
      <SparkJobs v-else-if="route.page === 'jobs'" :app="cur" :view="view" @navigate="go" />
      <SparkJobDetail v-else-if="route.page === 'job'" :app="cur" :job-id="route.id ?? 0" @navigate="go" />
      <SparkStages v-else-if="route.page === 'stages'" :app="cur" @navigate="go" />
      <SparkStageDetail v-else-if="route.page === 'stage'" :app="cur" :view="view" :stage-id="route.id ?? 0" @navigate="go" />
      <section v-else-if="route.page === 'storage'">
        <h3 class="spk-h3">Storage</h3>
        <h4 class="spk-h4"><span class="arrow-open"></span> RDDs</h4>
        <table class="table table-bordered table-sm">
          <thead><tr><th>ID</th><th>RDD Name</th><th>Storage Level</th><th>Cached Partitions</th><th>Fraction Cached</th><th>Size in Memory</th><th>Size on Disk</th></tr></thead>
          <tbody><tr><td colspan="7" class="spk-empty">No RDDs have been persisted. Call <code>df.cache()</code> or <code>CACHE TABLE t</code> to see one here.</td></tr></tbody>
        </table>
      </section>
      <SparkEnvironment v-else-if="route.page === 'environment'" :app="cur" :view="view" />
      <SparkExecutors v-else-if="route.page === 'executors'" :app="cur" :view="view" />
      <SparkSql v-else :app="cur" :query-id="route.page === 'query' ? route.id ?? 0 : null" @navigate="go" />
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * The Apache Spark 3 web UI — the History Server and an application's UI.
 *
 * Read-only, as the real one is: Jobs, Stages, Storage, Environment, Executors
 * and SQL / DataFrame are all drawn from what the engine recorded. The one
 * write is on the History Server page — run a query with `spark-sql -e` or
 * submit a job file with `spark-submit` — which is the lab's addition, labelled
 * as such, so a student can produce an application to inspect without leaving.
 */
import { computed, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import type { LabTool } from '@/utils/labCatalogue';
import { pick } from '@/utils/portalKit';
import { locationFor, sparkApps, type SparkApp, type SparkPage, type SparkRoute } from './spark';
import SparkHistory from './SparkHistory.vue';
import SparkJobs from './SparkJobs.vue';
import SparkJobDetail from './SparkJobDetail.vue';
import SparkStages from './SparkStages.vue';
import SparkStageDetail from './SparkStageDetail.vue';
import SparkEnvironment from './SparkEnvironment.vue';
import SparkExecutors from './SparkExecutors.vue';
import SparkSql from './SparkSql.vue';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: LabTool; busy?: boolean }>();
const emit = defineEmits<{ (event: 'location', url: string): void; (event: 'refresh'): void }>();

const TABS: { page: SparkPage; label: string }[] = [
  { page: 'jobs', label: 'Jobs' }, { page: 'stages', label: 'Stages' }, { page: 'storage', label: 'Storage' },
  { page: 'environment', label: 'Environment' }, { page: 'executors', label: 'Executors' },
  { page: 'sql', label: 'SQL / DataFrame' },
];

const route = ref<SparkRoute>({ page: 'history' });
const menuOpen = ref(false);
const version = computed(() => String(pick(props.view, 'versions.spark', '3.5.1')));
const apps = computed(() => sparkApps(props.view));
const app = computed(() => (route.value.app ? apps.value.find(a => a.id === route.value.app) || null : null));
const EMPTY: SparkApp = { id: '', name: '', user: '', state: '', final: '', started: 0, ended: 0, durationMs: 0, completed: true, jobs: [], stages: [] };
const cur = computed<SparkApp>(() => app.value || EMPTY);

function tabActive(page: SparkPage) {
  const p = route.value.page;
  return p === page || (page === 'jobs' && p === 'job') || (page === 'stages' && p === 'stage')
    || (page === 'sql' && p === 'query');
}

function go(next: SparkRoute) {
  route.value = next;
  menuOpen.value = false;
}

watch(route, value => emit('location', locationFor(value)), { immediate: true, deep: true });
</script>

<style scoped>
.spk {
  --spk-link: #0088cc;
  --spk-link-hover: #005580;
  --spk-blue: #3EC0FF;
  --spk-border: #dee2e6;
  color-scheme: light;
  position: relative;
  height: 100%;
  overflow: auto;
  background: #fff;
  color: #212529;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
}
.spk-nav {
  position: sticky; top: 0; z-index: 20; display: flex; align-items: stretch; height: 50px; padding: 0 16px;
  background-color: #fafafa; background-image: linear-gradient(to bottom, #fff, #f2f2f2); border-bottom: 1px solid #d4d4d4;
  box-shadow: 0 1px 4px rgba(0, 0, 0, .065);
}
.spk-brand { display: flex; align-items: center; gap: 4px; margin-right: 18px; text-decoration: none !important; }
.spk-logo { height: 38px; width: auto; }
.spk-version { color: #777; font-size: 12px; align-self: flex-end; margin-bottom: 9px; }
.spk-tabs { display: flex; list-style: none; margin: 0; padding: 0; }
.spk-tabs a { display: flex; align-items: center; height: 50px; padding: 0 14px; color: #777; font-size: 15px; text-decoration: none; white-space: nowrap; }
.spk-tabs a:hover { color: #333; text-decoration: none !important; }
.spk-tabs li.active a { background-color: #e5e5e5; color: #555; box-shadow: inset 0 3px 8px rgba(0, 0, 0, .125); }
.spk-appname { margin-left: auto; align-self: center; color: #777; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; padding-left: 12px; }
.spk-burger { display: none; margin-left: auto; align-self: center; background: none; border: 1px solid #ddd; border-radius: 4px; padding: 7px 9px; cursor: pointer; flex-direction: column; gap: 3px; }
.spk-burger span { display: block; width: 18px; height: 2px; background: #888; }
.spk-body { padding: 15px 20px 30px; }
.spk-flashes { position: absolute; top: 60px; right: 16px; z-index: 30; display: flex; flex-direction: column; gap: 8px; width: min(420px, calc(100% - 32px)); }
.spk-flash { position: relative; padding: 12px 32px 12px 14px; border-radius: 4px; border: 1px solid transparent; font-size: 13px; box-shadow: 0 2px 6px rgba(0,0,0,.1); word-break: break-word; }
.spk-flash.is-success, .spk-flash.is-info { background: #d4edda; border-color: #c3e6cb; color: #155724; }
.spk-flash.is-error { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
.spk-flash.is-warning, .spk-flash.is-progress { background: #fff3cd; border-color: #ffeeba; color: #856404; }
.spk-flash__detail { display: block; margin-top: 4px; font-family: SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; }
.spk-flash__x { position: absolute; right: 8px; top: 5px; border: 0; background: none; font-size: 20px; opacity: .5; cursor: pointer; color: inherit; }

/* ---- the Bootstrap 4 + webui.css kit every page uses ---- */
.spk :deep(a) { color: var(--spk-link); text-decoration: none; }
.spk :deep(a:hover) { color: var(--spk-link-hover); text-decoration: underline; }
.spk :deep(.spk-h3) { font-size: 24.5px; font-weight: 700; margin: 6px 0 12px; line-height: 1.2; display: flex; align-items: center; gap: 6px; }
.spk :deep(.spk-h4) { font-size: 17.5px; font-weight: 700; margin: 18px 0 8px; line-height: 1.2; display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
.spk :deep(.spk-h4 a) { color: var(--spk-link); }
.spk :deep(.arrow-open) { display: inline-block; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #08c; }
.spk :deep(.arrow-closed) { display: inline-block; width: 0; height: 0; border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 5px solid #08c; }
.spk :deep(.tip) { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; background: #999; color: #fff; font-size: 10px; font-weight: 700; cursor: help; }
.spk :deep(.list-unstyled) { list-style: none; padding: 0; margin: 0 0 10px; }
.spk :deep(.list-unstyled li) { padding: 1px 0; }
.spk :deep(.table) { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px; }
.spk :deep(.table th), .spk :deep(.table td) { padding: 4px; border: 1px solid var(--spk-border); vertical-align: top; text-align: left; }
.spk :deep(.table thead th) { vertical-align: bottom; border-bottom: 2px solid var(--spk-border); font-weight: 700; white-space: nowrap; }
.spk :deep(.table tbody tr:nth-of-type(odd)) { background-color: rgba(0, 0, 0, .05); }
.spk :deep(.table-wrap) { overflow-x: auto; }
.spk :deep(.sortable th) { cursor: pointer; }
.spk :deep(.progress) { position: relative; height: 20px; min-width: 120px; overflow: hidden; background: linear-gradient(to bottom, #f5f5f5, #f9f9f9); border-radius: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,.1); text-align: center; }
.spk :deep(.progress-bar) { position: absolute; top: 0; bottom: 0; left: 0; background-image: linear-gradient(to bottom, #64CBFF, #54B0EE); }
.spk :deep(.progress-label) { position: relative; z-index: 1; font-size: 12px; line-height: 20px; color: #333; white-space: nowrap; }
.spk :deep(.btn) { display: inline-flex; align-items: center; gap: 6px; font: inherit; padding: 5px 10px; border-radius: 4px; border: 1px solid transparent; cursor: pointer; line-height: 1.5; }
.spk :deep(.btn:disabled) { opacity: .65; cursor: not-allowed; }
.spk :deep(.btn-primary) { color: #fff; background: #007bff; border-color: #007bff; }
.spk :deep(.btn-primary:hover:not(:disabled)) { background: #0069d9; }
.spk :deep(.btn-secondary) { color: #fff; background: #6c757d; border-color: #6c757d; }
.spk :deep(.btn-sm) { padding: 4px 7px; font-size: 12px; }
.spk :deep(.form-control) { display: block; width: 100%; padding: 5px 10px; font: inherit; color: #495057; background: #fff; border: 1px solid #ced4da; border-radius: 4px; box-sizing: border-box; }
.spk :deep(.form-control:focus) { border-color: #80bdff; outline: 0; box-shadow: 0 0 0 3px rgba(0, 123, 255, .25); }
.spk :deep(code) { color: #e83e8c; font-size: 87.5%; font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.spk :deep(pre) { color: #212529; font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
.spk :deep(.spk-empty) { color: #666; text-align: center; padding: 14px; }
.spk :deep(.spk-muted) { color: #6c757d; }
.spk :deep(.alert-danger) { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 10px 14px; border-radius: 4px; white-space: pre-wrap; font-size: 13px; }

@container sl-portal (max-width: 900px) {
  .spk-burger { display: flex; }
  .spk-appname { display: none; }
  .spk-tabs { display: none; position: absolute; top: 50px; left: 0; right: 0; flex-direction: column; background: #f8f8f8; border-bottom: 1px solid #d4d4d4; box-shadow: 0 4px 10px rgba(0,0,0,.1); }
  .spk-tabs.is-open { display: flex; }
  .spk-tabs a { height: 42px; }
  .spk-body { padding: 12px; }
}
</style>
