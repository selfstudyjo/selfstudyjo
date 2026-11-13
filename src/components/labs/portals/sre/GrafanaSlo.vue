<template>
  <div class="gs" dir="ltr">
    <header class="gs-top">
      <span class="gs-logo" aria-label="Grafana">
        <svg viewBox="0 0 32 32" width="22" height="22"><defs><linearGradient id="gsg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FCEE1F"/><stop offset="1" stop-color="#F15B2A"/></linearGradient></defs><circle cx="16" cy="16" r="10" fill="none" stroke="url(#gsg)" stroke-width="5"/><circle cx="16" cy="16" r="3.2" fill="url(#gsg)"/></svg>
      </span>
      <nav class="gs-crumbs" aria-label="Breadcrumb">
        <span>Home</span><span>›</span><span>Observability</span><span>›</span>
        <button type="button" @click="selected = ''">SLO</button>
        <template v-if="current"><span>›</span><span class="is-current">{{ current.name }}</span></template>
      </nav>
      <span class="gs-avatar" title="sre">SR</span>
    </header>

    <main class="gs-main">
      <!-- ===== List ===== -->
      <template v-if="!current">
        <div class="gs-head">
          <div>
            <h1 class="gs-h1">SLOs</h1>
            <p class="gs-muted">Service level objectives, their error budget, and how fast it is burning.</p>
          </div>
          <div class="gs-head__actions">
            <button type="button" class="gs-btn" :disabled="busy" @click="report">Report</button>
            <button type="button" class="gs-btn gs-btn--primary" @click="createOpen = true">＋ Create SLO</button>
          </div>
        </div>
        <div class="gs-summary">
          <div class="gs-sum"><span>{{ slos.length }}</span>SLOs</div>
          <div class="gs-sum is-ok"><span>{{ countBy('ok') }}</span>Healthy</div>
          <div class="gs-sum is-warn"><span>{{ countBy('warning') }}</span>Burning</div>
          <div class="gs-sum is-bad"><span>{{ countBy('exhausted') }}</span>Budget exhausted</div>
        </div>
        <div class="gs-filter"><input v-model="filter" class="gs-input" placeholder="Search by name or service" aria-label="Search SLOs" /></div>
        <table v-if="filtered.length" class="gs-table">
          <thead><tr><th>Name</th><th>Service</th><th>Objective</th><th>SLI</th><th>Error budget remaining</th><th>Burn rate 1h</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="s in filtered" :key="s.name" @click="selected = s.name">
              <td class="gs-name">{{ s.name }}</td>
              <td><span class="gs-svc">{{ s.service }}</span></td>
              <td>{{ s.objective }}% <span class="gs-muted">/ {{ s.window }}</span></td>
              <td :style="{ color: s.sli_pct !== null && s.sli_pct < s.objective ? '#ff7383' : '#73bf69' }">{{ s.sli_pct === null ? '-' : Number(s.sli_pct).toFixed(3) + '%' }}</td>
              <td>
                <div class="gs-budget"><i :style="{ width: clampPct(s.remaining_pct) + '%', background: budgetColor(s.remaining_pct) }"></i></div>
                <span class="gs-budget__txt">{{ Number(s.remaining_pct).toFixed(1) }}% · {{ minutesLeft(s) }} min left</span>
              </td>
              <td><span class="gs-burn" :class="burnClass(s.burn_1h)">{{ fmtBurn(s.burn_1h) }}</span></td>
              <td><span class="gs-status" :class="'is-' + statusOf(s)">{{ statusLabel(s) }}</span></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="gs-empty">
          <h3>{{ slos.length ? 'No SLO matches the search' : 'No SLOs yet' }}</h3>
          <p class="gs-muted">Define an SLO in a YAML file under <code>slo/</code> (in the Files tab) and apply it here, or run <code>slo apply slo/shopapi.yaml</code> in the console.</p>
          <button v-if="!slos.length" type="button" class="gs-btn gs-btn--primary" @click="createOpen = true">＋ Create SLO</button>
        </div>
        <pre v-if="reportText" class="gs-report">{{ reportText }}</pre>
      </template>

      <!-- ===== One SLO ===== -->
      <template v-else>
        <div class="gs-head">
          <div>
            <h1 class="gs-h1">{{ current.name }} <span class="gs-status" :class="'is-' + statusOf(current)">{{ statusLabel(current) }}</span></h1>
            <p class="gs-muted">Service <b>{{ current.service }}</b> · objective {{ current.objective }}% over {{ current.window }}</p>
          </div>
          <div class="gs-head__actions">
            <button type="button" class="gs-btn" @click="selected = ''">← All SLOs</button>
            <button type="button" class="gs-btn" :disabled="busy" @click="generateOpen = true">Generate alert rules</button>
          </div>
        </div>
        <div class="gs-cards">
          <div class="gs-card"><div class="gs-card__label">SLI ({{ current.window }})</div><div class="gs-card__value" :style="{ color: current.sli_pct !== null && current.sli_pct < current.objective ? '#ff7383' : '#73bf69' }">{{ current.sli_pct === null ? '-' : Number(current.sli_pct).toFixed(3) + '%' }}</div><div class="gs-muted">target {{ current.objective }}%</div></div>
          <div class="gs-card"><div class="gs-card__label">Error budget remaining</div><div class="gs-card__value" :style="{ color: budgetColor(current.remaining_pct) }">{{ Number(current.remaining_pct).toFixed(1) }}%</div><div class="gs-muted">{{ minutesLeft(current) }} of {{ current.budget_minutes }} minutes</div></div>
          <div class="gs-card"><div class="gs-card__label">Budget consumed</div><div class="gs-card__value">{{ Number(current.consumed_pct).toFixed(1) }}%</div><div class="gs-muted">over the {{ current.window }} window</div></div>
          <div class="gs-card"><div class="gs-card__label">Time to exhaustion at 1h burn</div><div class="gs-card__value">{{ exhaustion(current) }}</div><div class="gs-muted">at the current 1h burn rate</div></div>
        </div>
        <div class="gs-grid">
          <div class="gs-panel">
            <div class="gs-panel__title">SLI - success ratio (last hour)</div>
            <TimeSeries :series="sliSeries" unit="percent" :height="210" :min="Math.min(current.objective - 2, minSli)" :max="100" :thresholds="[{ value: current.objective, color: '#FF9830' }]" />
          </div>
          <div class="gs-panel">
            <div class="gs-panel__title">Error budget burn rate (last hour)</div>
            <TimeSeries :series="burnSeries" unit="short" :height="210" :thresholds="[{ value: 14.4, color: '#F2495C' }, { value: 6, color: '#FF9830' }, { value: 1, color: '#73BF69' }]" />
          </div>
        </div>
        <div class="gs-panel">
          <div class="gs-panel__title">Multi-window, multi-burn-rate alerting</div>
          <table class="gs-table gs-table--plain">
            <thead><tr><th>Window</th><th>Burn rate</th><th>Threshold</th><th>Meaning</th><th>State</th></tr></thead>
            <tbody>
              <tr v-for="w in WINDOWS" :key="w.key">
                <td>{{ w.label }}</td><td :class="burnClass(current[w.key])">{{ fmtBurn(current[w.key]) }}</td>
                <td>{{ w.threshold }}×</td><td class="gs-muted">{{ w.meaning }}</td>
                <td><span class="gs-status" :class="Number(current[w.key]) >= w.threshold ? 'is-exhausted' : 'is-ok'">{{ Number(current[w.key]) >= w.threshold ? 'Breaching' : 'OK' }}</span></td>
              </tr>
            </tbody>
          </table>
          <p class="gs-muted gs-small">Burn rate = how many times faster than "exactly on budget" the budget is being spent. 1× uses the whole budget in the window; 14.4× uses 2% of a 30-day budget in one hour (page); 6× uses 5% in six hours (page); 1× over three days is a ticket.</p>
        </div>
      </template>
    </main>

    <!-- Create SLO -->
    <div v-if="createOpen" class="gs-modal" role="dialog" aria-modal="true" aria-label="Create SLO">
      <div class="gs-modal__card">
        <h2>Create SLO</h2>
        <ol class="gs-steps"><li class="is-done">Define the SLI in a file under <code>slo/</code></li><li class="is-done">Validate it</li><li>Apply it</li></ol>
        <label class="gs-field">SLO definition
          <select v-model="sloFile" class="gs-input">
            <option value="" disabled>Choose a file…</option>
            <option v-for="f in sloFiles" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>
        <p v-if="!sloFiles.length" class="gs-muted">There is no file under slo/ yet. Write one in the Files tab.</p>
        <pre v-if="validateText" class="gs-report" :class="{ 'is-bad': !validateOk }">{{ validateText }}</pre>
        <div class="gs-modal__actions">
          <button type="button" class="gs-btn" @click="createOpen = false">Cancel</button>
          <button type="button" class="gs-btn" :disabled="!sloFile || busy" @click="validate">Validate</button>
          <button type="button" class="gs-btn gs-btn--primary" :disabled="!sloFile || busy" @click="apply">Save &amp; apply</button>
        </div>
      </div>
    </div>

    <!-- Generate rules -->
    <div v-if="generateOpen" class="gs-modal" role="dialog" aria-modal="true" aria-label="Generate alert rules">
      <div class="gs-modal__card">
        <h2>Generate burn-rate alert rules</h2>
        <label class="gs-field">From SLO file <select v-model="sloFile" class="gs-input"><option v-for="f in sloFiles" :key="f" :value="f">{{ f }}</option></select></label>
        <label class="gs-field">Write rules to <input v-model="rulesOut" class="gs-input" /></label>
        <div class="gs-modal__actions">
          <button type="button" class="gs-btn" @click="generateOpen = false">Cancel</button>
          <button type="button" class="gs-btn gs-btn--primary" :disabled="!sloFile || !rulesOut || busy" @click="generate">Generate</button>
        </div>
      </div>
    </div>

    <div class="gs-toasts" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="gs-toast" :class="'is-' + f.type">
        <b>{{ f.title }}</b><span v-if="f.detail">{{ f.detail }}</span>
        <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Grafana SLO over the ShopFront estate. Numbers come from the view's `slos`
 * (thirty days of request history, including two past incidents); the charts
 * derive the SLI and burn rate from the view's error-ratio series. Apply,
 * validate, report and generate run the real `slo` CLI lines.
 */
import { computed, ref, watch } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import TimeSeries from './TimeSeries.vue';
import { asSeries, num, type PlotSeries } from './sreKit';

const props = defineProps<{ view: Record<string, any>; api: any; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();
const api = props.api;

const WINDOWS = [
    { key: 'burn_5m', label: '5 minutes', threshold: 14.4, meaning: 'confirms a fast burn is still happening' },
    { key: 'burn_1h', label: '1 hour', threshold: 14.4, meaning: 'fast burn: page' },
    { key: 'burn_6h', label: '6 hours', threshold: 6, meaning: 'slow burn: page' },
    { key: 'burn_3d', label: '3 days', threshold: 1, meaning: 'budget will run out: ticket' },
];

const selected = ref('');
const filter = ref('');
const createOpen = ref(false);
const generateOpen = ref(false);
const sloFile = ref('');
const rulesOut = ref('monitoring/rules/slo-burn.yml');
const validateText = ref('');
const validateOk = ref(false);
const reportText = ref('');

const slos = computed(() => rows<any>(props.view, 'slos'));
const sloFiles = computed(() => pick<string[]>(props.view, 'files.slo', []));
const filtered = computed(() => {
    const q = filter.value.trim().toLowerCase();
    return q ? slos.value.filter(s => `${s.name} ${s.service}`.toLowerCase().includes(q)) : slos.value;
});
const current = computed(() => slos.value.find(s => s.name === selected.value) || null);

watch(sloFiles, list => { if (!sloFile.value && list.length) sloFile.value = list[0]; }, { immediate: true });
watch(selected, () => emit('location', 'http://grafana.shopfront.internal:3000/a/grafana-slo-app/' + (selected.value ? 'slo/' + encodeURIComponent(selected.value) : 'manage-slos')), { immediate: true });

function statusOf(s: any) {
    const st = String(s.status || '');
    if (st === 'exhausted' || Number(s.remaining_pct) <= 0) return 'exhausted';
    if (st && st !== 'ok' && st !== 'healthy') return 'warning';
    return Number(s.burn_1h) >= 6 ? 'warning' : 'ok';
}
function statusLabel(s: any) { return { ok: 'Healthy', warning: 'Burning', exhausted: 'Exhausted' }[statusOf(s)]; }
function countBy(state: string) { return slos.value.filter(s => statusOf(s) === state).length; }
function clampPct(v: any) { return Math.max(0, Math.min(100, Number(v) || 0)); }
function budgetColor(v: any) { const n = Number(v); return n <= 10 ? '#F2495C' : n <= 50 ? '#FF9830' : '#73BF69'; }
function minutesLeft(s: any) { return Math.max(0, (Number(s.budget_minutes) || 0) * (Number(s.remaining_pct) || 0) / 100).toFixed(1); }
function fmtBurn(v: any) { const n = num(v); return n === null ? '-' : n.toFixed(2) + '×'; }
function burnClass(v: any) { const n = Number(v); return n >= 14.4 ? 'is-bad' : n >= 6 ? 'is-warn' : n >= 1 ? 'is-meh' : 'is-ok'; }
function exhaustion(s: any) {
    const burn = Number(s.burn_1h);
    const left = (Number(s.budget_minutes) || 0) * (Number(s.remaining_pct) || 0) / 100;
    if (!(burn > 0)) return 'never';
    const total = Number(s.budget_minutes) || 0;
    // At burn rate B, the budget lasts window/B; scale by the share left.
    const windowMin = total / Math.max(1e-9, (100 - Number(s.objective)) / 100);
    const hours = (left / total) * (windowMin / burn) / 60;
    if (!Number.isFinite(hours)) return 'never';
    return hours < 1 ? Math.round(hours * 60) + ' min' : hours < 48 ? hours.toFixed(1) + ' h' : (hours / 24).toFixed(1) + ' days';
}

const ratio = computed(() => asSeries(pick(props.view, 'series.error_ratio', []))[0]);
const sliSeries = computed<PlotSeries[]>(() => ratio.value
    ? [{ name: 'SLI', color: '#73BF69', values: ratio.value.values.map(([t, v]) => [t, 100 * (1 - v)] as [number, number]) }]
    : []);
const minSli = computed(() => sliSeries.value.length ? Math.min(...sliSeries.value[0].values.map(p => p[1]), 100) : 99);
const burnSeries = computed<PlotSeries[]>(() => {
    if (!ratio.value || !current.value) return [];
    const allowed = Math.max(1e-9, (100 - Number(current.value.objective)) / 100);
    return [{ name: 'burn rate', color: '#F2CC0C', values: ratio.value.values.map(([t, v]) => [t, v / allowed] as [number, number]) }];
});

async function validate() {
    const result = await api.exec(cli(['slo', 'validate', sloFile.value]), { quiet: true });
    validateOk.value = !!result.ok;
    validateText.value = String(result.ok ? result.output : (result.error || result.output) || '');
}
async function apply() {
    const result = await api.exec(cli(['slo', 'apply', sloFile.value]), { success: 'SLO applied' });
    if (result.ok) { createOpen.value = false; validateText.value = ''; }
}
async function report() {
    const result = await api.exec(cli(['slo', 'report']), { quiet: true });
    reportText.value = String(result.ok ? result.output : (result.error || result.output) || '');
}
async function generate() {
    const result = await api.exec(cli(['slo', 'generate', sloFile.value], { '-o': rulesOut.value.trim() }), { success: 'Alert rules generated' });
    if (result.ok) generateOpen.value = false;
}
</script>

<style scoped>
.gs { --b: rgba(204, 204, 220, 0.12); --t: #ccccdc; --m: rgba(204, 204, 220, 0.65); display: flex; flex-direction: column; height: 100%; min-height: 34rem; background: #111217; color: var(--t); font-family: Inter, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; position: relative; }
.gs-top { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border-bottom: 1px solid var(--b); background: #181b1f; flex: none; }
.gs-crumbs { display: flex; gap: 6px; align-items: center; color: var(--m); flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; }
.gs-crumbs button { background: none; border: 0; color: var(--m); cursor: pointer; font: inherit; padding: 0; }
.gs-crumbs .is-current { color: var(--t); }
.gs-avatar { width: 24px; height: 24px; border-radius: 50%; background: #8f4ad3; color: #fff; display: grid; place-items: center; font-size: 10px; font-weight: 700; }
.gs-main { flex: 1; overflow: auto; padding: 16px 20px 40px; min-height: 0; }
.gs-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.gs-h1 { font-size: 22px; font-weight: 400; margin: 0 0 4px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.gs-head__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.gs-muted { color: var(--m); }
.gs-small { font-size: 12px; margin-top: 8px; }
.gs-btn { background: #22252b; color: var(--t); border: 1px solid var(--b); border-radius: 4px; height: 32px; padding: 0 14px; cursor: pointer; font: inherit; }
.gs-btn:hover { background: #2c3035; }
.gs-btn--primary { background: #3d71d9; border-color: #3d71d9; color: #fff; }
.gs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.gs-input { background: #111217; color: var(--t); border: 1px solid var(--b); border-radius: 4px; height: 32px; padding: 0 8px; font: inherit; width: 100%; }
.gs-summary { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr)); gap: 8px; margin-bottom: 12px; }
.gs-sum { background: #181b1f; border: 1px solid var(--b); border-radius: 4px; padding: 10px 12px; color: var(--m); display: flex; flex-direction: column; }
.gs-sum span { font-size: 24px; color: var(--t); }
.gs-sum.is-ok span { color: #73bf69; } .gs-sum.is-warn span { color: #ff9830; } .gs-sum.is-bad span { color: #ff7383; }
.gs-filter { margin-bottom: 10px; max-width: 26rem; }
.gs-table { width: 100%; border-collapse: collapse; background: #181b1f; border: 1px solid var(--b); }
.gs-table th { text-align: left; color: var(--m); font-weight: 500; padding: 8px 10px; border-bottom: 1px solid var(--b); font-size: 12px; }
.gs-table td { padding: 10px; border-bottom: 1px solid var(--b); }
.gs-table tbody tr { cursor: pointer; }
.gs-table tbody tr:hover td { background: rgba(204, 204, 220, 0.06); }
.gs-table--plain tbody tr { cursor: default; }
.gs-name { color: #6e9fff; font-weight: 500; }
.gs-svc { background: #22252b; border-radius: 3px; padding: 1px 6px; }
.gs-budget { width: 9rem; height: 8px; background: rgba(204, 204, 220, 0.1); border-radius: 4px; overflow: hidden; margin-bottom: 3px; }
.gs-budget i { display: block; height: 100%; }
.gs-budget__txt { font-size: 11.5px; color: var(--m); }
.gs-burn, td.is-ok, td.is-meh, td.is-warn, td.is-bad { font-weight: 600; }
.is-ok.gs-burn, td.is-ok { color: #73bf69; } .is-meh.gs-burn, td.is-meh { color: #fade2a; } .is-warn.gs-burn, td.is-warn { color: #ff9830; } .is-bad.gs-burn, td.is-bad { color: #ff7383; }
.gs-status { display: inline-block; border-radius: 10px; padding: 1px 10px; font-size: 11.5px; font-weight: 500; }
.gs-status.is-ok { background: rgba(115, 191, 105, 0.18); color: #73bf69; }
.gs-status.is-warning { background: rgba(255, 152, 48, 0.18); color: #ff9830; }
.gs-status.is-exhausted { background: rgba(242, 73, 92, 0.2); color: #ff7383; }
.gs-empty { background: #181b1f; border: 1px dashed var(--b); border-radius: 4px; padding: 30px; text-align: center; }
.gs-empty h3 { font-weight: 400; margin: 0 0 6px; }
.gs-report { background: #181b1f; border: 1px solid var(--b); border-radius: 4px; padding: 12px; white-space: pre-wrap; font-family: 'Roboto Mono', ui-monospace, monospace; font-size: 12px; margin-top: 12px; }
.gs-report.is-bad { border-color: rgba(242, 73, 92, 0.5); color: #ff7383; }
.gs-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr)); gap: 8px; margin-bottom: 10px; }
.gs-card { background: #181b1f; border: 1px solid var(--b); border-radius: 4px; padding: 12px; }
.gs-card__label { color: var(--m); font-size: 12px; margin-bottom: 4px; }
.gs-card__value { font-size: 26px; font-weight: 500; }
.gs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr)); gap: 8px; margin-bottom: 8px; }
.gs-panel { background: #181b1f; border: 1px solid var(--b); border-radius: 2px; padding: 8px 10px 10px; margin-bottom: 8px; }
.gs-panel__title { font-weight: 500; margin-bottom: 6px; }
.gs-modal { position: absolute; inset: 0; z-index: 20; background: rgba(0, 0, 0, 0.6); display: grid; place-items: center; padding: 16px; }
.gs-modal__card { background: #181b1f; border: 1px solid var(--b); border-radius: 4px; padding: 18px 20px; width: min(34rem, 100%); }
.gs-modal__card h2 { font-size: 18px; font-weight: 400; margin: 0 0 10px; }
.gs-steps { margin: 0 0 10px; padding-left: 18px; color: var(--m); }
.gs-steps li.is-done { color: var(--t); }
.gs-field { display: flex; flex-direction: column; gap: 4px; margin: 10px 0; font-size: 12px; color: var(--m); }
.gs-modal__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.gs-toasts { position: absolute; right: 12px; top: 52px; display: flex; flex-direction: column; gap: 8px; z-index: 30; }
.gs-toast { background: #22252b; border-left: 4px solid #5794f2; border-radius: 2px; padding: 8px 30px 8px 10px; position: relative; max-width: 22rem; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); }
.gs-toast.is-success { border-left-color: #1a7f37; }
.gs-toast.is-error { border-left-color: #d10e5c; }
.gs-toast button { position: absolute; right: 6px; top: 4px; background: none; border: 0; color: var(--m); cursor: pointer; font-size: 16px; }
@container sl-portal (max-width: 760px) { .gs-table th:nth-child(4), .gs-table td:nth-child(4) { display: none; } }
</style>
