<template>
  <div v-if="current" class="sf-page">
    <div class="sf-crumbs"><button type="button" @click="sf.go({ page: 'warehouses' })">Warehouses</button><SfIcon name="chevron-right" /><span>{{ current.name }}</span></div>
    <div class="sf-page-head">
      <span class="wh__icon"><SfIcon name="warehouse" /></span>
      <h1 class="sf-h1">{{ current.name }}</h1>
      <span class="sf-badge" :class="isStarted(current) ? 'sf-badge--ok' : ''"><span class="sf-dot" :class="isStarted(current) ? 'sf-dot--ok' : ''"></span>{{ isStarted(current) ? 'Started' : 'Suspended' }}</span>
      <span class="sf-spacer"></span>
      <button v-if="isStarted(current)" type="button" class="sf-btn" @click="suspend(current.name)"><SfIcon name="pause" /> Suspend</button>
      <button v-else type="button" class="sf-btn" @click="resume(current.name)"><SfIcon name="play" /> Resume</button>
      <button type="button" class="sf-btn" @click="edit(current.name)"><SfIcon name="edit" /> Edit</button>
      <button type="button" class="sf-btn sf-btn--icon" aria-label="Drop warehouse" title="Drop" @click="drop(current.name)"><SfIcon name="trash" /></button>
    </div>
    <div class="sf-grid-cards">
      <div class="sf-card sf-stat"><b>{{ sizeLabel(current.size) }}</b><span>Size · {{ sizeCredits(current.size) }} credit{{ sizeCredits(current.size) === 1 ? '' : 's' }}/hour</span></div>
      <div class="sf-card sf-stat"><b>{{ clusters(current) }}</b><span>Clusters{{ multi(current) ? ' · ' + (current.scaling_policy || 'STANDARD') : '' }}</span></div>
      <div class="sf-card sf-stat"><b>{{ fmtSuspend(current.auto_suspend) }}</b><span>Auto-suspend · auto-resume {{ current.auto_resume === false ? 'off' : 'on' }}</span></div>
      <div class="sf-card sf-stat"><b>{{ fmtCredits(current.credits_used) }}</b><span>Credits used</span></div>
    </div>
    <section class="sf-card wh__chart">
      <div class="sf-page-head"><h2 class="sf-h3">Warehouse activity</h2><span class="sf-muted sf-small">Credits per query, most recent {{ activity.length }} queries</span></div>
      <svg v-if="activity.length" class="wh__svg" :viewBox="`0 0 ${activity.length * 18 + 40} 140`" preserveAspectRatio="none" role="img" aria-label="Credits by query">
        <line x1="32" y1="118" :x2="activity.length * 18 + 40" y2="118" class="wh__axis" />
        <rect v-for="(q, i) in activity" :key="i" :x="36 + i * 18" :y="118 - q.h" width="12" :height="Math.max(1, q.h)" rx="2" :class="q.cache ? 'wh__bar wh__bar--cache' : 'wh__bar'"><title>{{ q.title }}</title></rect>
        <text x="28" y="14" text-anchor="end" class="wh__tick">{{ fmtCredits(activityMax) }}</text>
        <text x="28" y="118" text-anchor="end" class="wh__tick">0</text>
      </svg>
      <div v-else class="sf-empty"><strong>No queries have run on this warehouse yet</strong></div>
    </section>
    <section class="sf-card">
      <div class="sf-page-head"><h2 class="sf-h3">Resource monitor</h2><span class="sf-spacer"></span>
        <select v-model="monitorPick" class="sf-select wh__monsel" aria-label="Resource monitor">
          <option value="">— None —</option><option v-for="m in monitors" :key="m.name" :value="m.name">{{ m.name }}</option>
        </select>
        <button type="button" class="sf-btn sf-btn--sm" :disabled="monitorPick === (current.resource_monitor || '')" @click="assignMonitor(current.name)">Assign</button>
      </div>
      <p class="sf-muted wh__monnote">{{ current.resource_monitor ? `Credits on ${current.name} count against ${current.resource_monitor}.` : 'No resource monitor: nothing stops this warehouse spending credits.' }}</p>
    </section>
    <GrantsTable on-kind="WAREHOUSE" :on-name="current.name" />
    <PromptDialog v-if="prompt" v-bind="prompt" @close="prompt = null" />
  </div>

  <div v-else class="sf-page">
    <div class="sf-page-head">
      <h1 class="sf-h1">Warehouses</h1>
      <span class="sf-muted">{{ warehouses.length }} warehouses</span>
      <span class="sf-spacer"></span>
      <button type="button" class="sf-btn sf-btn--primary" @click="sf.create('warehouse')"><SfIcon name="plus" /> Warehouse</button>
    </div>
    <div class="sf-toolbar">
      <div class="sf-search wh__search"><SfIcon name="search" /><input v-model="filter" class="sf-input" placeholder="Search warehouses" /></div>
      <label class="sf-chip">Status <select v-model="state" aria-label="Status"><option value="">All</option><option value="STARTED">Started</option><option value="SUSPENDED">Suspended</option></select></label>
    </div>
    <div class="sf-table-wrap">
      <table class="sf-table">
        <thead><tr><th>Name</th><th>Status</th><th>Size</th><th>Clusters</th><th>Auto-suspend</th><th class="sf-num">Credits used</th><th>Resource monitor</th><th>Owner</th><th class="sf-actions"></th></tr></thead>
        <tbody>
          <tr v-for="w in shown" :key="w.name" class="is-clickable" @click="sf.go({ page: 'warehouses', name: w.name })">
            <td><span class="sf-cell-name"><SfIcon name="warehouse" /><b>{{ w.name }}</b><span v-if="w.name === sf.current.value.warehouse" class="sf-badge sf-badge--run">In use</span></span></td>
            <td><span class="wh__state"><span class="sf-dot" :class="isStarted(w) ? 'sf-dot--ok' : ''"></span>{{ isStarted(w) ? 'Started' : 'Suspended' }}</span></td>
            <td>{{ sizeLabel(w.size) }}</td>
            <td>{{ clusters(w) }}</td>
            <td class="sf-muted">{{ fmtSuspend(w.auto_suspend) }}</td>
            <td class="sf-num">{{ fmtCredits(w.credits_used) }}</td>
            <td class="sf-muted">{{ w.resource_monitor || '—' }}</td>
            <td class="sf-muted">{{ w.owner || '' }}</td>
            <td class="sf-actions sf-rel" @click.stop>
              <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon sf-btn--sm" :aria-label="'Actions for ' + w.name" @click="menu = menu === w.name ? '' : w.name"><SfIcon name="more" /></button>
              <div v-if="menu === w.name" class="sf-menu wh__menu" @mouseleave="menu = ''">
                <button v-if="isStarted(w)" type="button" @click="suspend(w.name)"><SfIcon name="pause" /> Suspend</button>
                <button v-else type="button" @click="resume(w.name)"><SfIcon name="play" /> Resume</button>
                <button type="button" @click="edit(w.name)"><SfIcon name="edit" /> Edit</button>
                <button type="button" @click="menu = ''; sf.useWarehouse(w.name)"><SfIcon name="check" /> Use in session</button>
                <hr />
                <button type="button" class="is-danger" @click="drop(w.name)"><SfIcon name="trash" /> Drop</button>
              </div>
            </td>
          </tr>
          <tr v-if="!shown.length"><td colspan="9"><div class="sf-empty"><strong>No warehouses match</strong></div></td></tr>
        </tbody>
      </table>
    </div>
    <PromptDialog v-if="prompt" v-bind="prompt" @close="prompt = null" />
  </div>
</template>

<script setup lang="ts">
/** Admin > Warehouses: create, size, suspend, resume, multi-cluster, monitors, credits. */
import { computed, ref, watch } from 'vue';
import SfIcon from './SfIcon.vue';
import GrantsTable from './GrantsTable.vue';
import PromptDialog, { type PromptField } from './PromptDialog.vue';
import { useSf } from './sfContext';
import { matches } from '@/utils/portalKit';
import { fmtCredits, fmtMs, fmtSuspend, ident, list, oneLine, sizeCredits, sizeId, sizeLabel, SIZES, str, type SfWarehouse } from './snowflake';

const sf = useSf();
const warehouses = computed(() => list.warehouses(sf.view.value));
const monitors = computed(() => list.monitors(sf.view.value));
const filter = ref('');
const state = ref('');
const menu = ref('');
const shown = computed(() => warehouses.value.filter(w => matches(w, filter.value, ['name']) && (!state.value || String(w.state).toUpperCase() === state.value)));
const current = computed(() => {
  const r = sf.route.value;
  return r.page === 'warehouses' && r.name ? warehouses.value.find(w => w.name === r.name) || null : null;
});
const monitorPick = ref('');
watch(current, w => { monitorPick.value = w?.resource_monitor || ''; }, { immediate: true });

function isStarted(w: SfWarehouse) { return String(w.state || '').toUpperCase() === 'STARTED'; }
function multi(w: SfWarehouse) { return (Number(w.max_clusters) || 1) > 1; }
function clusters(w: SfWarehouse) { const lo = Number(w.min_clusters) || 1; const hi = Number(w.max_clusters) || 1; return lo === hi ? String(lo) : `${lo} – ${hi}`; }

const activity = computed(() => {
  if (!current.value) return [];
  const qs = list.queries(sf.view.value).filter(q => q.warehouse === current.value!.name).slice(-40);
  const max = Math.max(0.000001, ...qs.map(q => Number(q.credits) || 0));
  return qs.map(q => ({ h: ((Number(q.credits) || 0) / max) * 104, cache: Boolean(q.from_cache), title: `${oneLine(q.text, 60)} — ${fmtCredits(q.credits)} credits, ${fmtMs(q.elapsed_ms)}` }));
});
const activityMax = computed(() => Math.max(0, ...list.queries(sf.view.value).filter(q => q.warehouse === current.value?.name).slice(-40).map(q => Number(q.credits) || 0)));

async function suspend(name: string) {
  menu.value = '';
  await sf.sql(`ALTER WAREHOUSE ${ident(name)} SUSPEND`, { success: `Warehouse ${name} suspended` });
}
async function resume(name: string) {
  menu.value = '';
  await sf.sql(`ALTER WAREHOUSE ${ident(name)} RESUME`, { success: `Warehouse ${name} resumed` });
}
async function drop(name: string) {
  menu.value = '';
  const ok = await sf.confirm({ title: `Drop warehouse ${name}?`, message: 'Queries running on it are cancelled and it can no longer be used. This cannot be undone.', yes: 'Drop Warehouse', danger: true, typeToConfirm: name });
  if (!ok) return;
  const r = await sf.sql(`DROP WAREHOUSE ${ident(name)}`, { success: `Warehouse ${name} dropped` });
  if (r.ok && current.value) sf.go({ page: 'warehouses' });
}
async function assignMonitor(name: string) {
  const sqlText = monitorPick.value ? `ALTER WAREHOUSE ${ident(name)} SET RESOURCE_MONITOR = ${ident(monitorPick.value)}` : `ALTER WAREHOUSE ${ident(name)} UNSET RESOURCE_MONITOR`;
  await sf.sql(sqlText, { success: monitorPick.value ? `Resource monitor assigned to ${name}` : 'Resource monitor removed' });
}

const prompt = ref<null | { title: string; subtitle?: string; okText?: string; fields: PromptField[]; build: (v: Record<string, string>) => string | string[]; success?: string }>(null);
function edit(name: string) {
  menu.value = '';
  const w = warehouses.value.find(x => x.name === name);
  if (!w) return;
  const before = { size: sizeId(w.size), suspend: String(w.auto_suspend ?? 0), resume: w.auto_resume === false ? '' : '1', min: String(w.min_clusters || 1), max: String(w.max_clusters || 1), policy: String(w.scaling_policy || 'STANDARD') };
  prompt.value = {
    title: `Edit ${name}`, okText: 'Save Warehouse',
    fields: [
      { key: 'size', label: 'Size', value: before.size, options: SIZES.map(([id, label, c]) => [id, `${label} (${c} credits/hour)`]) },
      { key: 'suspend', label: 'Auto-suspend (seconds, 0 = never)', value: before.suspend, numeric: true },
      { key: 'resume', label: 'Auto-resume', value: before.resume, type: 'check' },
      { key: 'min', label: 'Min clusters', value: before.min, numeric: true },
      { key: 'max', label: 'Max clusters', value: before.max, numeric: true, hint: 'More than 1 makes it a multi-cluster warehouse (scale out for concurrency).' },
      { key: 'policy', label: 'Scaling policy', value: before.policy, options: [['STANDARD', 'Standard'], ['ECONOMY', 'Economy']] },
    ],
    build: v => {
      if (!/^\d+$/.test(v.suspend) || !/^\d+$/.test(v.min) || !/^\d+$/.test(v.max) || Number(v.min) < 1 || Number(v.min) > Number(v.max)) return '';
      const sets: string[] = [];
      if (v.size !== before.size) sets.push(`WAREHOUSE_SIZE = ${str(v.size)}`);
      if (v.suspend !== before.suspend) sets.push(`AUTO_SUSPEND = ${v.suspend === '0' ? 'NULL' : v.suspend}`);
      if (v.resume !== before.resume) sets.push(`AUTO_RESUME = ${v.resume ? 'TRUE' : 'FALSE'}`);
      if (v.min !== before.min) sets.push(`MIN_CLUSTER_COUNT = ${v.min}`);
      if (v.max !== before.max) sets.push(`MAX_CLUSTER_COUNT = ${v.max}`);
      if (v.policy !== before.policy) sets.push(`SCALING_POLICY = ${str(v.policy)}`);
      return sets.length ? `ALTER WAREHOUSE ${ident(name)} SET ${sets.join(' ')}` : '';
    },
    success: `Warehouse ${name} updated`,
  };
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.wh__icon { width: 36px; height: 36px; border-radius: 8px; background: var(--sf-selected); color: var(--sf-primary-text); display: grid; place-items: center; }
.wh__search { width: min(300px, 100%); }
.wh__state { display: inline-flex; align-items: center; gap: 6px; }
.wh__menu { right: 8px; top: 34px; }
.wh__chart { display: flex; flex-direction: column; gap: 10px; }
.wh__svg { width: 100%; height: 150px; }
.wh__axis { stroke: var(--sf-border-strong); }
.wh__bar { fill: #29B5E8; }
.wh__bar--cache { fill: #B9C3D2; }
.wh__tick { font-size: 9px; fill: var(--sf-text-2); }
.wh__monsel { height: 28px; }
.wh__monnote { margin: 8px 0 0; }
</style>
