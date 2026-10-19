<template>
  <div v-if="selected" class="sf-page qh">
    <div class="sf-crumbs"><button type="button" @click="sf.go({ page: 'query-history' })">Query History</button><SfIcon name="chevron-right" /><span class="sf-mono">{{ selected.query_id }}</span></div>
    <div class="sf-page-head">
      <span class="sf-badge" :class="'sf-badge--' + statusTone(selected.status)"><SfIcon :name="statusTone(selected.status) === 'bad' ? 'x-circle' : 'check-circle'" /> {{ statusLabel(selected.status) }}</span>
      <h1 class="sf-h1 qh__title">{{ oneLine(selected.text, 90) }}</h1>
      <span class="sf-spacer"></span>
      <button type="button" class="sf-btn" @click="sf.openWorksheet(selected.text, 'Query ' + selected.query_id.slice(0, 8))"><SfIcon name="worksheet" /> Open in Worksheet</button>
    </div>
    <div class="sf-tabs">
      <button type="button" class="sf-tab" :class="{ 'is-active': detailTab !== 'profile' }" @click="setTab('detail')">Query Details</button>
      <button type="button" class="sf-tab" :class="{ 'is-active': detailTab === 'profile' }" @click="setTab('profile')">Query Profile</button>
    </div>
    <div v-if="detailTab !== 'profile'" class="qh__detail">
      <dl class="sf-kv sf-card">
        <dt>Status</dt><dd>{{ statusLabel(selected.status) }}</dd>
        <dt>Query ID</dt><dd class="sf-mono">{{ selected.query_id }}</dd>
        <dt>Start time</dt><dd>{{ selected.time || '—' }}</dd>
        <dt>Duration</dt><dd>{{ fmtMs(selected.elapsed_ms) }}</dd>
        <dt>Rows</dt><dd>{{ fmtNum(selected.rows) }}</dd>
        <dt>User</dt><dd>{{ selected.user || userName }}</dd>
        <dt>Role</dt><dd>{{ selected.role || '—' }}</dd>
        <dt>Warehouse</dt><dd>{{ selected.warehouse || '—' }}</dd>
        <dt>Bytes scanned</dt><dd>{{ fmtBytes(selected.bytes_scanned) }}</dd>
        <dt>Partitions</dt><dd>{{ fmtNum(selected.partitions_scanned) }} of {{ fmtNum(selected.partitions_total) }} scanned</dd>
        <dt>Credits</dt><dd>{{ fmtCredits(selected.credits) }}</dd>
        <dt>Result cache</dt><dd>{{ selected.from_cache ? 'Reused (no compute)' : 'Not reused' }}</dd>
      </dl>
      <div v-if="selected.error" class="sf-alert sf-alert--error"><SfIcon name="x-circle" /><span class="qh__err">{{ selected.error }}</span></div>
      <section class="qh__sql">
        <div class="sf-toolbar"><h2 class="sf-h3">SQL Text</h2><span class="sf-spacer"></span>
          <button type="button" class="sf-btn sf-btn--sm" @click="copy(selected.text)"><SfIcon name="copy" /> Copy</button></div>
        <pre class="sf-code">{{ selected.text }}</pre>
      </section>
    </div>
    <div v-else class="qh__profile">
      <QueryProfile :profile="profileFor(selected)" :empty-text="profileEmpty" />
    </div>
  </div>

  <div v-else class="sf-page qh">
    <div class="sf-page-head">
      <h1 class="sf-h1">Query History</h1>
      <span class="sf-spacer"></span>
      <button type="button" class="sf-btn" @click="sf.notify('info', 'Query history refreshed')"><SfIcon name="refresh" /> Refresh</button>
    </div>
    <div class="sf-toolbar">
      <div class="sf-search qh__search"><SfIcon name="search" /><input v-model="filter" class="sf-input" placeholder="SQL text or query ID" /></div>
      <label class="sf-chip">Status
        <select v-model="status" aria-label="Status"><option value="">All</option><option value="ok">Succeeded</option><option value="bad">Failed</option><option value="run">Running</option></select></label>
      <label class="sf-chip">Warehouse
        <select v-model="warehouse" aria-label="Warehouse"><option value="">All</option><option v-for="w in warehouses" :key="w" :value="w">{{ w }}</option></select></label>
      <label class="sf-chip">Role
        <select v-model="role" aria-label="Role"><option value="">All</option><option v-for="r in roles" :key="r" :value="r">{{ r }}</option></select></label>
      <span class="sf-spacer"></span>
      <span class="sf-muted sf-small">{{ shown.length }} of {{ all.length }} queries</span>
    </div>
    <div class="sf-table-wrap">
      <table class="sf-table">
        <thead>
          <tr>
            <th>SQL Text</th><th>Query ID</th><th>Status</th><th>User</th><th>Warehouse</th>
            <th class="sf-num sf-sortable" @click="toggleSort('elapsed_ms')">Duration</th>
            <th class="sf-num">Rows</th>
            <th class="sf-sortable" @click="toggleSort('at')">Started</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in shown" :key="q.query_id" class="is-clickable" @click="open(q.query_id)">
            <td><span class="sf-ellipsis sf-mono qh__text">{{ oneLine(q.text) }}</span></td>
            <td class="sf-mono sf-muted">{{ shortId(q.query_id, 14) }}</td>
            <td><span class="qh__status"><span class="sf-dot" :class="'sf-dot--' + statusTone(q.status)"></span>{{ statusLabel(q.status) }}</span></td>
            <td class="sf-muted">{{ q.user || userName }}<span class="qh__role">{{ q.role }}</span></td>
            <td class="sf-muted">{{ q.warehouse || '—' }}</td>
            <td class="sf-num">{{ fmtMs(q.elapsed_ms) }}<span v-if="q.from_cache" class="sf-badge qh__cache" title="Result reused from cache">cache</span></td>
            <td class="sf-num">{{ fmtNum(q.rows) }}</td>
            <td class="sf-muted">{{ q.time || '' }}</td>
          </tr>
          <tr v-if="!shown.length"><td colspan="8"><div class="sf-empty"><SfIcon name="history" /><strong>No queries match</strong><span>Run a query in a worksheet and it appears here.</span></div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Monitoring > Query History: every query, its details and its profile. */
import { computed, ref } from 'vue';
import SfIcon from './SfIcon.vue';
import QueryProfile from './QueryProfile.vue';
import { useSf } from './sfContext';
import { matches, shortId, sortBy } from '@/utils/portalKit';
import { fmtBytes, fmtCredits, fmtMs, fmtNum, list, oneLine, readProfile, statusTone, type SfQuery } from './snowflake';

const sf = useSf();
const all = computed(() => list.queries(sf.view.value));
const route = computed(() => (sf.route.value.page === 'query-history' ? sf.route.value : { page: 'query-history' as const }));
const selected = computed(() => {
  const id = (route.value as { queryId?: string }).queryId;
  return id ? all.value.find(q => q.query_id === id) || null : null;
});
const detailTab = computed(() => (route.value as { tab?: string }).tab || 'detail');
const userName = computed(() => list.users(sf.view.value)[0]?.name || 'DATA_ENGINEER');

const filter = ref('');
const status = ref('');
const warehouse = ref('');
const role = ref('');
const sortKey = ref<'at' | 'elapsed_ms'>('at');
const sortDir = ref<'asc' | 'desc'>('desc');
const warehouses = computed(() => [...new Set(all.value.map(q => q.warehouse).filter(Boolean))] as string[]);
const roles = computed(() => [...new Set(all.value.map(q => q.role).filter(Boolean))] as string[]);

const shown = computed(() => {
  const filtered = all.value.filter(q => matches(q, filter.value, ['text', 'query_id'])
    && (!status.value || statusTone(q.status) === status.value)
    && (!warehouse.value || q.warehouse === warehouse.value)
    && (!role.value || q.role === role.value));
  const keyed = filtered.map((q, i) => ({ ...q, at: q.at ?? i }));
  return sortBy(keyed, sortKey.value, sortDir.value);
});
function toggleSort(key: 'at' | 'elapsed_ms') {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'desc'; }
}
function statusLabel(s: string) {
  const tone = statusTone(s);
  return tone === 'ok' ? 'Success' : tone === 'bad' ? 'Failed' : tone === 'run' ? 'Running' : String(s || '—');
}
function open(id: string) { sf.go({ page: 'query-history', queryId: id }); }
function setTab(tab: string) { if (selected.value) sf.go({ page: 'query-history', queryId: selected.value.query_id, tab }); }

const profileEmpty = computed(() => (selected.value && statusTone(selected.value.status) === 'bad'
  ? 'A failed query has no execution profile.'
  : 'This statement did not scan any table, so there is no operator profile. Profiles are recorded for SELECT queries.'));

/** The session's captured profile; otherwise one assembled from the history row's statistics. */
function profileFor(q: SfQuery) {
  const cached = sf.profiles.value[q.query_id];
  if (cached) return cached;
  if (statusTone(q.status) === 'bad' || !/^\s*(select|with)\b/i.test(q.text || '')) return null;
  return readProfile({
    query_id: q.query_id,
    operators: [
      ...(q.partitions_total ? [{ id: 0, type: 'TableScan', partitions_scanned: q.partitions_scanned, partitions_total: q.partitions_total }] : []),
      { id: q.partitions_total ? 1 : 0, type: 'Result', rows: q.rows },
    ],
    partitions: { scanned: q.partitions_scanned, total: q.partitions_total },
    bytes: q.bytes_scanned, elapsed: q.elapsed_ms, from_cache: q.from_cache, warehouse: q.warehouse, credits: q.credits,
    spill: { local: q.spill_local || 0, remote: q.spill_remote || 0 },
  });
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); sf.notify('success', 'SQL copied'); } catch { /* refused */ }
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.qh__search { width: min(320px, 100%); }
.qh__text { max-width: 380px; }
.qh__status { display: inline-flex; align-items: center; gap: 6px; }
.qh__role { display: block; font-size: 11px; color: var(--sf-text-3); }
.qh__cache { margin-left: 6px; font-size: 10px; height: 16px; }
.qh__title { font-family: var(--sf-mono); font-size: 15px; font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.qh__detail { display: flex; flex-direction: column; gap: 16px; }
.qh__err { white-space: pre-wrap; font-family: var(--sf-mono); font-size: 12px; }
.qh__sql { display: flex; flex-direction: column; gap: 8px; }
.qh__profile { flex: 1; min-height: 420px; display: flex; border: 1px solid var(--sf-border); border-radius: var(--sf-radius-lg); overflow: hidden; }
</style>
