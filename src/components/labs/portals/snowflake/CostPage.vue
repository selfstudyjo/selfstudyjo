<template>
  <div class="sf-page">
    <div class="sf-page-head">
      <h1 class="sf-h1">Cost Management</h1>
      <span class="sf-spacer"></span>
      <button v-if="tab === 'monitors'" type="button" class="sf-btn sf-btn--primary" @click="sf.create('monitor')"><SfIcon name="plus" /> Resource Monitor</button>
    </div>
    <div class="sf-tabs">
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'overview' }" @click="setTab('overview')">Account Overview</button>
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'consumption' }" @click="setTab('consumption')">Consumption</button>
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'monitors' }" @click="setTab('monitors')">Resource Monitors</button>
    </div>

    <template v-if="tab === 'overview'">
      <div class="sf-grid-cards">
        <div class="sf-card sf-stat"><b>{{ fmtCredits(total) }}</b><span>Compute credits used</span></div>
        <div class="sf-card sf-stat"><b>{{ queries.length }}</b><span>Queries</span></div>
        <div class="sf-card sf-stat"><b>{{ cached }}</b><span>Queries served from the result cache</span></div>
        <div class="sf-card sf-stat"><b>{{ monitors.length }}</b><span>Resource monitors</span></div>
      </div>
      <section class="sf-card cost__chart">
        <h2 class="sf-h3">Credits by warehouse</h2>
        <div v-if="byWarehouse.length" class="cost__bars" role="img" aria-label="Credits used by warehouse">
          <div v-for="w in byWarehouse" :key="w.name" class="cost__bar">
            <span class="cost__name">{{ w.name }}</span>
            <span class="cost__track"><i :style="{ width: Math.max(1, (w.credits / maxCredits) * 100) + '%' }"></i></span>
            <span class="cost__val">{{ fmtCredits(w.credits) }}</span>
          </div>
        </div>
        <div v-else class="sf-empty"><strong>No credits used yet</strong><span>Credits accrue while a warehouse is running.</span></div>
      </section>
      <section class="sf-card">
        <h2 class="sf-h3">Most expensive queries</h2>
        <div class="sf-table-wrap cost__table">
          <table class="sf-table">
            <thead><tr><th>Query</th><th>Warehouse</th><th class="sf-num">Duration</th><th class="sf-num">Credits</th></tr></thead>
            <tbody>
              <tr v-for="q in topQueries" :key="q.query_id" class="is-clickable" @click="sf.go({ page: 'query-history', queryId: q.query_id })">
                <td class="sf-mono"><span class="sf-ellipsis">{{ oneLine(q.text) }}</span></td>
                <td class="sf-muted">{{ q.warehouse || '—' }}</td>
                <td class="sf-num">{{ fmtMs(q.elapsed_ms) }}</td>
                <td class="sf-num">{{ fmtCredits(q.credits) }}</td>
              </tr>
              <tr v-if="!topQueries.length"><td colspan="4"><div class="sf-empty">No billed queries yet</div></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <div v-else-if="tab === 'consumption'" class="sf-table-wrap">
      <table class="sf-table">
        <thead><tr><th>Warehouse</th><th>Size</th><th class="sf-num">Queries</th><th class="sf-num">Avg duration</th><th class="sf-num">Credits used</th><th class="sf-num">Share</th></tr></thead>
        <tbody>
          <tr v-for="w in consumption" :key="w.name" class="is-clickable" @click="sf.go({ page: 'warehouses', name: w.name })">
            <td><span class="sf-cell-name"><SfIcon name="warehouse" />{{ w.name }}</span></td>
            <td>{{ w.size }}</td>
            <td class="sf-num">{{ w.queries }}</td>
            <td class="sf-num">{{ fmtMs(w.avg) }}</td>
            <td class="sf-num">{{ fmtCredits(w.credits) }}</td>
            <td class="sf-num">{{ total ? Math.round((w.credits / total) * 100) : 0 }}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <template v-else>
      <div class="sf-table-wrap">
        <table class="sf-table">
          <thead><tr><th>Name</th><th>Credit quota</th><th>Used</th><th>Schedule</th><th>Actions</th><th>Assigned to</th><th class="sf-actions"></th></tr></thead>
          <tbody>
            <tr v-for="m in monitors" :key="m.name">
              <td><span class="sf-cell-name"><SfIcon name="monitoring" /><b>{{ m.name }}</b></span></td>
              <td>{{ fmtNum(m.credit_quota) }}</td>
              <td>
                <span class="cost__meter"><span class="cost__track"><i :class="{ 'is-hot': pct(m) >= 90 }" :style="{ width: Math.min(100, pct(m)) + '%' }"></i></span><span>{{ fmtCredits(m.used || 0) }} ({{ pct(m) }}%)</span></span>
              </td>
              <td class="sf-muted">{{ m.frequency || 'MONTHLY' }}</td>
              <td class="sf-muted"><span class="sf-ellipsis">{{ triggers(m) }}</span></td>
              <td class="sf-muted">{{ (m.warehouses || []).join(', ') || (m.level === 'ACCOUNT' ? 'Account' : '—') }}</td>
              <td class="sf-actions sf-rel">
                <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon sf-btn--sm" :aria-label="'Actions for ' + m.name" @click="menu = menu === m.name ? '' : m.name"><SfIcon name="more" /></button>
                <div v-if="menu === m.name" class="sf-menu cost__menu" @mouseleave="menu = ''">
                  <button type="button" @click="editQuota(m.name, m.credit_quota)"><SfIcon name="edit" /> Edit quota</button>
                  <hr />
                  <button type="button" class="is-danger" @click="drop(m.name)"><SfIcon name="trash" /> Drop</button>
                </div>
              </td>
            </tr>
            <tr v-if="!monitors.length"><td colspan="7"><div class="sf-empty"><SfIcon name="monitoring" /><strong>No resource monitors</strong><span>A resource monitor notifies or suspends warehouses when they reach a credit quota.</span></div></td></tr>
          </tbody>
        </table>
      </div>
    </template>
    <PromptDialog v-if="prompt" v-bind="prompt" @close="prompt = null" />
  </div>
</template>

<script setup lang="ts">
/** Admin > Cost Management: credits by warehouse, consumption, resource monitors. */
import { computed, ref } from 'vue';
import SfIcon from './SfIcon.vue';
import PromptDialog, { type PromptField } from './PromptDialog.vue';
import { useSf } from './sfContext';
import { pick } from '@/utils/portalKit';
import { fmtCredits, fmtMs, fmtNum, ident, list, oneLine, sizeLabel, type SfMonitor } from './snowflake';

const sf = useSf();
const tab = computed(() => (sf.route.value.page === 'cost' ? sf.route.value.tab || 'overview' : 'overview'));
function setTab(t: string) { sf.go({ page: 'cost', tab: t }); }
const menu = ref('');

const queries = computed(() => list.queries(sf.view.value));
const monitors = computed(() => list.monitors(sf.view.value));
const warehouses = computed(() => list.warehouses(sf.view.value));
const total = computed(() => Number(pick(sf.view.value, 'warehouse.credits.total', 0)) || warehouses.value.reduce((n, w) => n + (Number(w.credits_used) || 0), 0));
const cached = computed(() => queries.value.filter(q => q.from_cache).length);
const byWarehouse = computed(() => {
  const map = pick<Record<string, number>>(sf.view.value, 'warehouse.credits.by_warehouse', {});
  const entries = Object.keys(map).length ? Object.entries(map) : warehouses.value.map(w => [w.name, Number(w.credits_used) || 0] as [string, number]);
  return entries.map(([name, credits]) => ({ name, credits: Number(credits) || 0 })).sort((a, b) => b.credits - a.credits || a.name.localeCompare(b.name));
});
const maxCredits = computed(() => Math.max(0.000001, ...byWarehouse.value.map(w => w.credits)));
const topQueries = computed(() => [...queries.value].filter(q => (Number(q.credits) || 0) > 0).sort((a, b) => (Number(b.credits) || 0) - (Number(a.credits) || 0)).slice(0, 8));
const consumption = computed(() => warehouses.value.map(w => {
  const qs = queries.value.filter(q => q.warehouse === w.name);
  const credits = byWarehouse.value.find(x => x.name === w.name)?.credits ?? (Number(w.credits_used) || 0);
  return { name: w.name, size: sizeLabel(w.size), queries: qs.length, avg: qs.length ? qs.reduce((n, q) => n + (Number(q.elapsed_ms) || 0), 0) / qs.length : null, credits };
}));

function pct(m: SfMonitor) { const q = Number(m.credit_quota) || 0; return q ? Math.round(((Number(m.used) || 0) / q) * 100) : 0; }
function triggers(m: SfMonitor) {
  const t = m.triggers;
  if (Array.isArray(t)) return t.map((x: any) => (typeof x === 'object' ? `${x.percent ?? x.threshold}% ${String(x.action || '').toLowerCase()}` : String(x))).join(', ');
  return t ? String(t) : '—';
}

const prompt = ref<null | { title: string; okText?: string; fields: PromptField[]; build: (v: Record<string, string>) => string; success?: string }>(null);
function editQuota(name: string, quota?: number) {
  menu.value = '';
  prompt.value = {
    title: `Edit ${name}`, okText: 'Save',
    fields: [{ key: 'quota', label: 'Credit quota', value: String(quota ?? ''), numeric: true }],
    build: v => (/^\d+(\.\d+)?$/.test(v.quota.trim()) ? `ALTER RESOURCE MONITOR ${ident(name)} SET CREDIT_QUOTA = ${v.quota.trim()}` : ''),
    success: 'Resource monitor updated',
  };
}
async function drop(name: string) {
  menu.value = '';
  const ok = await sf.confirm({ title: `Drop resource monitor ${name}?`, message: 'Warehouses assigned to it will no longer be limited.', yes: 'Drop', danger: true });
  if (ok) await sf.sql(`DROP RESOURCE MONITOR ${ident(name)}`, { success: 'Resource monitor dropped' });
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.cost__chart { display: flex; flex-direction: column; gap: 12px; }
.cost__bars { display: flex; flex-direction: column; gap: 8px; }
.cost__bar { display: grid; grid-template-columns: minmax(90px, 160px) minmax(0, 1fr) 70px; gap: 12px; align-items: center; font-size: 13px; }
.cost__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cost__track { display: block; height: 14px; border-radius: 3px; background: var(--sf-hover); overflow: hidden; }
.cost__track i { display: block; height: 100%; background: #29B5E8; border-radius: 3px; }
.cost__track i.is-hot { background: var(--sf-danger); }
.cost__val { text-align: right; font-variant-numeric: tabular-nums; }
.cost__table { margin-top: 10px; }
.cost__meter { display: grid; grid-template-columns: 100px max-content; align-items: center; gap: 8px; font-size: 12px; }
.cost__meter .cost__track { height: 8px; }
.cost__menu { right: 8px; top: 34px; }
</style>
