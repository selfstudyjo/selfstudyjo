<template>
  <div class="ex">
    <!-- ===== Resource sidebar ===== -->
    <aside class="ex__side" aria-label="Resources">
      <div class="ex__search">
        <DbtIcon name="search" />
        <input v-model="search" type="search" placeholder="Search resources" aria-label="Search resources" />
      </div>
      <button type="button" class="ex__home" :class="{ 'is-active': !resourceId }" @click="dbt.go({ page: 'explore' })">
        <DbtIcon name="compass" />Project overview
      </button>
      <div v-for="g in groups" :key="g.kind" class="ex__group">
        <button type="button" class="ex__group-head" :aria-expanded="!collapsed.has(g.kind)" @click="toggle(g.kind)">
          <DbtIcon :name="collapsed.has(g.kind) ? 'chevron-right' : 'chevron-down'" />
          <span class="dbt-kind" :class="'dbt-kind--' + g.kind"><DbtIcon :name="g.kind" /></span>
          <span class="ex__group-title">{{ g.title }}</span>
          <span class="ex__count">{{ g.items.length }}</span>
        </button>
        <ul v-if="!collapsed.has(g.kind)" class="ex__items">
          <li v-for="it in g.items" :key="it.id">
            <button type="button" :class="{ 'is-active': it.id === resourceId }" :title="it.id" @click="dbt.go({ page: 'resource', id: it.id })">
              <i class="ex__dot" :class="'ex__dot--' + statusTone(it.status)"></i>{{ it.name }}
            </button>
          </li>
          <li v-if="!g.items.length" class="ex__none">None</li>
        </ul>
      </div>
    </aside>

    <!-- ===== Overview ===== -->
    <div v-if="!resourceId" class="dbt-page">
      <div class="dbt-head">
        <div class="dbt-head__title">
          <h1>{{ dbt.project.value.name || 'Analytics' }}</h1>
          <p>dbt Explorer · project metadata from the latest runs · {{ dbt.docsGenerated.value ? 'docs generated' : 'docs not generated yet' }}</p>
        </div>
        <div class="dbt-head__actions">
          <button type="button" class="dbt-btn" :disabled="dbt.busy.value || !dbt.sources.value.length" @click="freshness()"><DbtIcon name="clock" />Check source freshness</button>
          <button type="button" class="dbt-btn" :disabled="dbt.busy.value" @click="docs"><DbtIcon name="book" />Generate docs</button>
          <button type="button" class="dbt-btn dbt-btn--primary" @click="dbt.go({ page: 'lineage' })"><DbtIcon name="lineage" />View lineage</button>
        </div>
      </div>

      <div v-if="!dbt.parsed.value" class="dbt-card">
        <div class="dbt-empty">
          <DbtIcon name="compass" />
          <h3>No project metadata yet</h3>
          <p>Explorer reads the manifest dbt writes when it parses the project. Parse it now, or build it from the Studio IDE.</p>
          <button type="button" class="dbt-btn dbt-btn--primary" :disabled="dbt.busy.value" @click="parse">Parse project</button>
        </div>
      </div>
      <template v-else>
        <div class="dbt-kpis">
          <div class="dbt-kpi"><span>Models</span><strong>{{ dbt.models.value.length }}</strong></div>
          <div class="dbt-kpi"><span>Sources</span><strong>{{ dbt.sources.value.length }}</strong></div>
          <div class="dbt-kpi"><span>Tests passing</span><strong>{{ testHealth }}</strong></div>
          <div class="dbt-kpi"><span>Models built</span><strong>{{ built }} / {{ dbt.models.value.length }}</strong></div>
          <div class="dbt-kpi"><span>Stale sources</span><strong :class="{ 'ex__bad': staleCount }">{{ staleCount }}</strong></div>
        </div>
        <section class="dbt-card">
          <div class="dbt-card__head"><h3>Models</h3></div>
          <div class="ex__tablewrap">
            <table class="dbt-table">
              <thead><tr><th>Model</th><th>Materialization</th><th>Last status</th><th class="dbt-num">Rows</th><th class="dbt-num">Execution time</th><th>Tests</th><th>Relation</th></tr></thead>
              <tbody>
                <tr v-for="m in dbt.models.value" :key="m.unique_id" class="is-click" tabindex="0" @click="dbt.go({ page: 'resource', id: m.unique_id })" @keydown.enter="dbt.go({ page: 'resource', id: m.unique_id })">
                  <td><button type="button" class="dbt-link" @click.stop="dbt.go({ page: 'resource', id: m.unique_id })">{{ m.name }}</button></td>
                  <td>{{ m.materialized }}</td>
                  <td><StatusChip :status="m.last_status" /></td>
                  <td class="dbt-num">{{ m.rows ?? '—' }}</td>
                  <td class="dbt-num">{{ m.execution_time != null ? m.execution_time + 's' : '—' }}</td>
                  <td>{{ testsFor(m.unique_id).length }}</td>
                  <td class="dbt-mono">{{ m.relation }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>

    <!-- ===== One resource ===== -->
    <ResourcePage v-else :key="resourceId" :uid="resourceId" @freshness="freshness" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import DbtIcon from './DbtIcon.vue';
import ResourcePage from './ResourcePage.vue';
import StatusChip from './StatusChip.vue';
import { useDbt } from './dbtContext';
import { matchesText, statusTone } from './dbt';

const dbt = useDbt();
const search = ref('');
const collapsed = ref(new Set<string>(['test']));
const resourceId = computed(() => (dbt.route.value.page === 'resource' ? dbt.route.value.id : ''));

function toggle(kind: string) {
  const next = new Set(collapsed.value);
  if (next.has(kind)) next.delete(kind); else next.add(kind);
  collapsed.value = next;
}

const groups = computed(() => {
  const q = search.value;
  const items = (list: { id: string; name: string; status: string | null }[]) => list.filter(i => matchesText(i.name, q));
  return [
    { kind: 'model', title: 'Models', items: items(dbt.models.value.map(m => ({ id: m.unique_id, name: m.name, status: m.last_status }))) },
    { kind: 'source', title: 'Sources', items: items(dbt.sources.value.map(s => ({ id: s.unique_id, name: `${s.source}.${s.name}`, status: s.freshness?.status || null }))) },
    { kind: 'seed', title: 'Seeds', items: items(dbt.seeds.value.map(s => ({ id: s.unique_id, name: s.name, status: s.last_status }))) },
    { kind: 'snapshot', title: 'Snapshots', items: items(dbt.snapshots.value.map(s => ({ id: s.unique_id, name: s.name, status: s.last_status }))) },
    { kind: 'exposure', title: 'Exposures', items: items(dbt.exposures.value.map(e => ({ id: `exposure.${e.name}`, name: e.name, status: null }))) },
    { kind: 'test', title: 'Tests', items: items(dbt.tests.value.map(t => ({ id: t.unique_id, name: t.name, status: t.last_status }))) },
  ];
});

function testsFor(uid: string) { return dbt.tests.value.filter(t => t.attached === uid); }
const testHealth = computed(() => {
  const ran = dbt.tests.value.filter(t => t.last_status);
  if (!ran.length) return dbt.tests.value.length ? 'not run' : '—';
  return `${ran.filter(t => t.last_status === 'pass').length} / ${ran.length}`;
});
const built = computed(() => dbt.models.value.filter(m => m.last_status === 'success').length);
const staleCount = computed(() => dbt.sources.value.filter(s => ['warn', 'error'].includes(String(s.freshness?.status))).length);

async function parse() { await dbt.run(cli(['dbt', 'parse']), { success: 'Project parsed' }); }
async function docs() { await dbt.run(cli(['dbt', 'docs', 'generate']), { success: 'Documentation generated' }); }
async function freshness(select?: string) {
  const result = await dbt.run(cli(['dbt', 'source', 'freshness'], { '--select': select || '' }), { quiet: true });
  if (result.ok) dbt.notify('success', 'Source freshness checked', select ? select : 'All sources are within their thresholds.');
  else dbt.notify('warning', 'Source freshness: some sources are stale', 'Sources past error_after are marked ERROR STALE.');
}
</script>

<style scoped src="./dbt.css"></style>
<style scoped>
.ex { flex: 1; min-height: 0; display: grid; grid-template-columns: 250px minmax(0, 1fr); }
.ex__side { border-right: 1px solid var(--dbt-border); background: #fff; overflow: auto; padding: 10px 8px; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
.ex__search { display: flex; align-items: center; gap: 6px; border: 1px solid var(--dbt-border-strong); border-radius: 6px; padding: 0 8px; height: 32px; color: var(--dbt-muted); margin-bottom: 4px; }
.ex__search input { border: 0; outline: none; flex: 1; min-width: 0; font: 13px var(--dbt-font); color: var(--dbt-ink); background: transparent; }
.ex__home { display: flex; align-items: center; gap: 8px; border: 0; background: none; padding: 6px 8px; border-radius: 6px; cursor: pointer; font: 500 13px var(--dbt-font); color: var(--dbt-ink); text-align: left; }
.ex__home:hover, .ex__items button:hover, .ex__group-head:hover { background: var(--dbt-hover); }
.ex__home.is-active { background: var(--dbt-blue-bg); color: var(--dbt-blue-ink); }
.ex__group-head { width: 100%; display: flex; align-items: center; gap: 6px; border: 0; background: none; padding: 6px 8px; border-radius: 6px; cursor: pointer; font: 600 12px var(--dbt-font); color: var(--dbt-ink); }
.ex__group-title { flex: 1; text-align: left; }
.ex__count { font-weight: 500; color: var(--dbt-muted); }
.ex__items { list-style: none; margin: 0 0 4px; padding: 0; }
.ex__items button { width: 100%; display: flex; align-items: center; gap: 8px; border: 0; background: none; padding: 4px 8px 4px 30px; border-radius: 6px; cursor: pointer; font: 13px var(--dbt-font); color: var(--dbt-ink-2); text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex__items button.is-active { background: var(--dbt-blue-bg); color: var(--dbt-blue-ink); font-weight: 500; }
.ex__none { padding: 2px 8px 4px 30px; color: var(--dbt-muted); font-size: 12px; }
.ex__dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--dbt-border-strong); }
.ex__dot--ok { background: var(--dbt-ok); }
.ex__dot--bad { background: var(--dbt-bad); }
.ex__dot--warn { background: var(--dbt-warn); }
.ex__tablewrap { overflow: auto; }
.ex__bad { color: var(--dbt-bad) !important; }
@container sl-portal (max-width: 760px) {
  .ex { grid-template-columns: 1fr; grid-template-rows: minmax(120px, 30%) minmax(0, 1fr); }
  .ex__side { border-right: 0; border-bottom: 1px solid var(--dbt-border); }
}
</style>
