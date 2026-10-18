<template>
  <div class="fx-page mo" @click="menu = ''">
    <div class="fx-page__head">
      <h1 class="fx-page__title">Monitor</h1>
      <span class="fx-pill">{{ filtered.length }}</span>
      <span class="fx-cmdbar__grow" />
      <span class="fx-muted mo-clock">Lab clock: {{ view.clock?.time }}</span>
      <button type="button" class="fx-btn" @click="$emit('refresh')"><FxIcon name="refresh" />Refresh</button>
    </div>
    <div class="fx-cmdbar mo-filters">
      <div class="fx-input fx-input--search mo-search">
        <FxIcon name="filter" :size="14" />
        <input v-model="filter" placeholder="Filter by keyword" aria-label="Filter by keyword" />
      </div>
      <select v-model="status" class="fx-select mo-sel" aria-label="Status"><option value="">Status: All</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <select v-model="itemType" class="fx-select mo-sel" aria-label="Item type"><option value="">Item type: All</option>
        <option v-for="t in types" :key="t" :value="t">{{ t }}</option></select>
      <select v-model="location" class="fx-select mo-sel" aria-label="Location"><option value="">Location: All</option>
        <option v-for="w in workspaces" :key="w" :value="w">{{ w }}</option></select>
      <button v-if="filter || status || itemType || location" type="button" class="fx-btn fx-btn--subtle" @click="clear">Clear all</button>
    </div>
    <div class="fx-page__scroll fx-tablewrap">
      <table class="fx-table mo-table">
        <thead><tr><th>Activity name</th><th>Status</th><th>Item type</th><th>Start time</th><th>Submitted by</th>
          <th>Location</th><th>Run kind</th><th>Duration</th></tr></thead>
        <tbody>
          <tr v-for="r in filtered" :key="r.id" :class="{ 'is-selected': detail?.id === r.id }">
            <td><span class="fx-cellname"><FxIcon :name="typeIcon(r.type)" :size="18" />
              <button type="button" @click="detail = r">{{ r.item }}</button>
              <button type="button" class="fx-iconbtn mo-more" :aria-label="'More options for ' + r.item" @click.stop="menu = r.id"><FxIcon name="more" /></button>
              <span v-if="menu === r.id" class="fx-menu mo-menu" @click.stop>
                <button type="button" @click="detail = r; menu = ''"><FxIcon name="info" />View detail</button>
                <button type="button" :disabled="r.status !== 'Failed' || r.type !== 'DataPipeline'" @click="rerun(r)"><FxIcon name="refresh" />Rerun</button>
                <button type="button" @click="openItem(r)"><FxIcon name="chevronRight" />Open item</button>
              </span></span></td>
            <td><span class="mo-status" :class="'is-' + String(r.status).toLowerCase()"><FxIcon :name="statusIcon(r.status)" :size="14" />{{ r.status }}</span></td>
            <td>{{ typeLabel(r.type) }}</td>
            <td>{{ r.start }}</td>
            <td>{{ r.trigger === 'Manual' ? me : 'System (schedule)' }}</td>
            <td>{{ locationOf(r) }}</td>
            <td>{{ r.trigger === 'Manual' ? 'Manual' : 'Scheduled' }}</td>
            <td>{{ duration(r.duration_s) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!filtered.length" class="fx-empty"><FxIcon name="monitor" :size="44" />
        <h3>No activities</h3><p>Run a pipeline, a notebook or a semantic model refresh and it appears here.</p></div>
    </div>

    <FxPanel v-if="detail" :title="detail.item" width="560px" @close="detail = null">
      <dl class="fx-kv">
        <dt>Status</dt><dd><span class="mo-status" :class="'is-' + String(detail.status).toLowerCase()">{{ detail.status }}</span></dd>
        <dt>Item type</dt><dd>{{ typeLabel(detail.type) }}</dd>
        <dt>Run ID</dt><dd class="fx-mono">{{ detail.id }}</dd>
        <dt>Start time</dt><dd>{{ detail.start }}</dd>
        <dt>End time</dt><dd>{{ detail.end || '—' }}</dd>
        <dt>Duration</dt><dd>{{ duration(detail.duration_s) }}</dd>
        <dt>Run kind</dt><dd>{{ detail.trigger }}</dd>
      </dl>
      <div v-if="detail.error" class="fx-msgbar fx-msgbar--error mo-err"><FxIcon name="error" /><span>{{ detail.error }}</span></div>
      <template v-if="activities.length">
        <h3 class="fx-h3">Activity runs</h3>
        <div class="fx-tablewrap">
          <table class="fx-table">
            <thead><tr><th>Activity</th><th>Type</th><th>Status</th><th>Attempts</th><th>Duration</th></tr></thead>
            <tbody><tr v-for="(a, i) in activities" :key="i"><td>{{ a.activity }}<span v-if="a.iteration !== ''" class="fx-muted"> [{{ a.iteration }}]</span></td>
              <td>{{ a.type }}</td><td><span class="mo-status" :class="'is-' + String(a.status).toLowerCase()">{{ a.status }}</span></td>
              <td>{{ a.attempts }}</td><td>{{ a.seconds }}s</td></tr></tbody>
          </table>
        </div>
        <div v-for="(a, i) in activities.filter(x => x.error)" :key="'e' + i" class="fx-msgbar fx-msgbar--error mo-err"><FxIcon name="error" /><span><b>{{ a.activity }}:</b> {{ a.error }}</span></div>
      </template>
      <template #footer>
        <button v-if="detail.status === 'Failed' && detail.type === 'DataPipeline'" type="button" class="fx-btn fx-btn--primary" @click="rerun(detail)">Rerun</button>
        <button type="button" class="fx-btn" @click="detail = null">Close</button>
      </template>
    </FxPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FxIcon from './FxIcon.vue';
import FxPanel from './FxPanel.vue';
import { cli, itemPath, rows, typeLabel, useFabric } from './fabric';

defineEmits<{ (event: 'refresh'): void }>();
const { portal, view, run, go } = useFabric();
const filter = ref('');
const status = ref('');
const itemType = ref('');
const location = ref('');
const menu = ref('');
const detail = ref<Record<string, any> | null>(null);
const me = computed(() => String(portal.value.me || ''));

const runs = computed(() => [...rows(portal.value, 'runs')].reverse());
const itemsByName = computed(() => rows(portal.value, 'items'));
function locationOf(r: Record<string, any>) {
  return r.workspace || itemsByName.value.find(i => i.name === r.item && i.type === r.type)?.workspace || '';
}
const statuses = computed(() => [...new Set(runs.value.map(r => String(r.status)))]);
const types = computed(() => [...new Set(runs.value.map(r => typeLabel(r.type)))]);
const workspaces = computed(() => [...new Set(runs.value.map(locationOf).filter(Boolean))]);
const filtered = computed(() => runs.value.filter(r => (!filter.value || String(r.item).toLowerCase().includes(filter.value.toLowerCase()))
  && (!status.value || r.status === status.value) && (!itemType.value || typeLabel(r.type) === itemType.value)
  && (!location.value || locationOf(r) === location.value)));
const activities = computed(() => detail.value ? rows(view.value, 'activity_runs')
  .filter(a => a.run === String(detail.value!.id).slice(0, 8)) : []);

function clear() { filter.value = ''; status.value = ''; itemType.value = ''; location.value = ''; }
function typeIcon(type: string) { return type || 'DataPipeline'; }
function statusIcon(s: string) { return s === 'Succeeded' ? 'success' : s === 'Failed' ? 'error' : s === 'Cancelled' ? 'warning' : 'running'; }
function duration(seconds: number) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
async function rerun(r: Record<string, any>) {
  menu.value = '';
  const ws = locationOf(r);
  await run(cli(['fab', 'job', 'run', itemPath(ws, r.item, r.type)], { '--rerun': String(r.id).slice(0, 8) }),
    `Rerun of ${r.item} finished`);
  detail.value = null;
}
function openItem(r: Record<string, any>) {
  go({ page: 'item', ws: locationOf(r), item: r.item, type: r.type });
}
</script>

<style scoped>
.mo-clock { font-size: 12px; }
.mo-filters { padding: 6px 20px 10px; border-bottom: 0; gap: 8px; }
.mo-search { width: 220px; }
.mo-sel { width: 160px; }
.mo-table { min-width: 1000px; }
.mo-more { margin-left: auto; opacity: 0; }
tr:hover .mo-more { opacity: 1; }
.fx-cellname { position: relative; }
.mo-menu { top: 30px; left: 40px; }
.mo-status { display: inline-flex; align-items: center; gap: 6px; }
.mo-status.is-failed { color: #c50f1f; }
.mo-status.is-succeeded { color: #107c10; }
.mo-err { margin-top: 12px; }
@container sl-portal (max-width: 600px) {
  .mo-search, .mo-sel { width: 100%; }
  .mo-more { opacity: 1; }
}
</style>
