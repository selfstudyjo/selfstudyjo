<template>
  <div class="fx-page ol">
    <div class="fx-page__head"><h1 class="fx-page__title">OneLake catalog</h1></div>
    <div class="fx-tabs">
      <button type="button" class="fx-tab" :class="{ 'is-active': tab === 'explore' }" @click="tab = 'explore'">Explore</button>
      <button type="button" class="fx-tab" :class="{ 'is-active': tab === 'govern' }" @click="tab = 'govern'">Govern</button>
    </div>
    <template v-if="tab === 'explore'">
      <div class="fx-cmdbar ol-bar">
        <div class="ol-chips">
          <button v-for="c in chips" :key="c.id" type="button" class="ol-chip" :class="{ 'is-on': chip === c.id }" @click="chip = c.id">{{ c.label }}</button>
        </div>
        <span class="fx-cmdbar__grow" />
        <div class="fx-input fx-input--search ol-search"><FxIcon name="search" :size="14" />
          <input v-model="filter" placeholder="Filter by keyword" aria-label="Filter by keyword" /></div>
      </div>
      <div class="fx-split">
        <div class="fx-content fx-tablewrap">
          <table class="fx-table ol-table">
            <thead><tr><th>Name</th><th>Type</th><th>Owner</th><th>Refreshed</th><th>Location</th><th>Endorsement</th><th>Sensitivity</th></tr></thead>
            <tbody>
              <tr v-for="i in list" :key="i.id" :class="{ 'is-selected': sel?.id === i.id }" @click="sel = i">
                <td><span class="fx-cellname"><FxIcon :name="i.type" :size="18" /><button type="button" @click.stop="sel = i">{{ i.name }}</button></span></td>
                <td>{{ typeLabel(i.type) }}</td><td>{{ i.owner }}</td><td class="fx-muted">{{ i.refreshed || '—' }}</td>
                <td>{{ i.workspace }}</td><td>{{ i.endorsement || '—' }}</td><td>{{ i.label || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!list.length" class="fx-empty"><h3>No items found</h3></div>
        </div>
        <aside v-if="sel" class="ol-detail">
          <div class="ol-detail__head"><FxIcon :name="sel.type" :size="24" /><b>{{ sel.name }}</b>
            <button type="button" class="fx-iconbtn" aria-label="Close" @click="sel = null"><FxIcon name="close" /></button></div>
          <div class="ol-detail__actions">
            <button type="button" class="fx-btn fx-btn--primary fx-btn--sm" @click="go({ page: 'item', ws: sel.workspace, item: sel.name, type: sel.type })">Open</button>
            <button type="button" class="fx-btn fx-btn--sm" @click="go({ page: 'workspace', ws: sel.workspace })">Open workspace</button>
          </div>
          <dl class="fx-kv ol-kv">
            <dt>Type</dt><dd>{{ typeLabel(sel.type) }}</dd><dt>Location</dt><dd>{{ sel.workspace }}</dd>
            <dt>Description</dt><dd>{{ sel.description || '—' }}</dd><dt>Sensitivity</dt><dd>{{ sel.label || '—' }}</dd>
            <dt>Endorsement</dt><dd>{{ sel.endorsement || '—' }}</dd>
          </dl>
          <template v-if="tablesOf(sel).length">
            <h3 class="fx-h3">Tables ({{ tablesOf(sel).length }})</h3>
            <ul class="ol-list"><li v-for="t in tablesOf(sel)" :key="t.schema + t.name"><FxIcon :name="t.kind === 'View' ? 'View' : 'Table'" />{{ t.schema }}.{{ t.name }}<span class="fx-muted">{{ t.rows }} rows</span></li></ul>
          </template>
          <template v-if="lineageOf(sel).length">
            <h3 class="fx-h3">Lineage</h3>
            <ul class="ol-list"><li v-for="(e, i) in lineageOf(sel)" :key="i" class="fx-mono">{{ e.from }} → {{ e.to }}</li></ul>
          </template>
        </aside>
      </div>
    </template>
    <div v-else class="fx-page__scroll ol-govern">
      <div class="ol-tiles">
        <div class="ol-tile"><div class="ol-tile__num">{{ items.length }}</div><div>Items you own</div></div>
        <div class="ol-tile"><div class="ol-tile__num">{{ labeled }}%</div><div>Items with a sensitivity label</div></div>
        <div class="ol-tile"><div class="ol-tile__num">{{ endorsed }}</div><div>Endorsed items</div></div>
        <div class="ol-tile"><div class="ol-tile__num">{{ described }}%</div><div>Items with a description</div></div>
      </div>
      <h3 class="fx-h3">Recommended actions</h3>
      <ul class="ol-recs">
        <li v-for="i in items.filter(x => !x.label).slice(0, 8)" :key="i.id">
          <FxIcon name="lock" />Apply a sensitivity label to <b>{{ i.name }}</b>
          <button type="button" class="fx-link" @click="labelFor = i">Apply</button></li>
        <li v-if="items.every(x => x.label)" class="fx-muted">Every item has a sensitivity label.</li>
      </ul>
      <h3 class="fx-h3">Sensitivity label coverage</h3>
      <table class="fx-table ol-table"><thead><tr><th>Label</th><th>Items</th></tr></thead>
        <tbody><tr v-for="l in labelCounts" :key="l.label"><td>{{ l.label }}</td><td>{{ l.count }}</td></tr></tbody></table>
    </div>
    <ItemSettingsPanel v-if="labelFor" :item="labelFor" tab="label" @close="labelFor = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FxIcon from './FxIcon.vue';
import ItemSettingsPanel from './ItemSettingsPanel.vue';
import { rows, typeLabel, useFabric } from './fabric';

const { portal, view, go } = useFabric();
const tab = ref('explore');
const chip = ref('all');
const filter = ref('');
const sel = ref<Record<string, any> | null>(null);
const labelFor = ref<Record<string, any> | null>(null);
const chips = [
  { id: 'all', label: 'All items' }, { id: 'data', label: 'Data' }, { id: 'model', label: 'Semantic models' },
  { id: 'engineering', label: 'Notebooks & pipelines' },
];
const items = computed(() => rows(portal.value, 'items'));
const list = computed(() => items.value.filter(i => {
  if (chip.value === 'data' && !['Lakehouse', 'Warehouse'].includes(i.type)) return false;
  if (chip.value === 'model' && i.type !== 'SemanticModel') return false;
  if (chip.value === 'engineering' && !['Notebook', 'DataPipeline', 'Environment'].includes(i.type)) return false;
  return !filter.value || String(i.name).toLowerCase().includes(filter.value.toLowerCase());
}));
function tablesOf(i: Record<string, any>) {
  return rows(portal.value, 'objects').filter(o => o.item === i.name && o.workspace === i.workspace);
}
function lineageOf(i: Record<string, any>) {
  const n = String(i.name).toLowerCase();
  return rows(view.value, 'lineage').filter(e => String(e.from).toLowerCase().startsWith(n + '.')
    || String(e.to).toLowerCase().startsWith(n)).slice(0, 12);
}
const pct = (n: number) => (items.value.length ? Math.round((n / items.value.length) * 100) : 0);
const labeled = computed(() => pct(items.value.filter(i => i.label).length));
const described = computed(() => pct(items.value.filter(i => i.description).length));
const endorsed = computed(() => items.value.filter(i => i.endorsement).length);
const labelCounts = computed(() => ['Highly Confidential', 'Confidential', 'General', 'Public', ''].map(l => ({
  label: l || '(No label)', count: items.value.filter(i => (i.label || '') === l).length })));
</script>

<style scoped>
.ol-bar { padding: 8px 20px; border-bottom: 0; }
.ol-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.ol-chip { height: 28px; padding: 0 12px; border-radius: 14px; border: 1px solid #d1d1d1; background: #fff; font: 13px "Segoe UI", sans-serif; cursor: pointer; }
.ol-chip.is-on { background: #e6f2ef; border-color: #117865; color: #0e6e5c; font-weight: 600; }
.ol-search { width: 220px; }
.ol-table { min-width: 860px; }
.ol-table tr { cursor: pointer; }
.ol-detail { width: 340px; flex: none; border-left: 1px solid #e0e0e0; padding: 12px 16px; overflow: auto; }
.ol-detail__head { display: flex; align-items: center; gap: 8px; }
.ol-detail__head b { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.ol-detail__actions { display: flex; gap: 8px; margin: 10px 0 14px; }
.ol-kv { grid-template-columns: 110px 1fr; font-size: 13px; }
.ol-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.ol-list li { display: flex; gap: 6px; align-items: center; }
.ol-list .fx-muted { margin-left: auto; font-size: 12px; }
.ol-govern { padding: 16px 20px; }
.ol-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.ol-tile { padding: 16px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 13px; color: #424242; }
.ol-tile__num { font: 600 28px/36px "Segoe UI", sans-serif; color: #242424; }
.ol-recs { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.ol-recs li { display: flex; gap: 8px; align-items: center; }
@container sl-portal (max-width: 700px) {
  .ol-detail { width: auto; border-left: 0; border-top: 1px solid #e0e0e0; }
  .ol-search { width: 100%; }
}
</style>
