<template>
  <div class="pm" dir="ltr">
    <!-- Which web UI: Prometheus (:9090) or Alertmanager (:9093), like two browser tabs -->
    <div class="pm-apps" role="tablist" aria-label="Web UI">
      <button type="button" role="tab" :aria-selected="app === 'prom'" :class="{ 'is-active': app === 'prom' }" @click="app = 'prom'">
        <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="11" fill="#E6522C"/><path d="M7 15h10M8 17.5h8M12 5c1.5 2 3.5 3 3.5 6.5S13 15 12 15s-3.5-.5-3.5-3.5S10.5 7 12 5z" fill="#fff" stroke="#fff" stroke-width=".6"/></svg>
        Prometheus · mon-1:9090
      </button>
      <button type="button" role="tab" :aria-selected="app === 'am'" :class="{ 'is-active': app === 'am' }" @click="app = 'am'">
        <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="11" fill="#E6522C"/><path d="M12 6a4 4 0 0 0-4 4v3l-1.5 2h11L16 13v-3a4 4 0 0 0-4-4zM10.5 17a1.5 1.5 0 0 0 3 0" fill="#fff"/></svg>
        Alertmanager · mon-1:9093
        <span v-if="firing.length" class="pm-apps__badge">{{ firing.length }}</span>
      </button>
    </div>

    <!-- ================= PROMETHEUS ================= -->
    <template v-if="app === 'prom'">
      <nav class="pm-nav">
        <span class="pm-brand">Prometheus</span>
        <button v-for="p in PROM_PAGES" :key="p.id" type="button" class="pm-nav__link" :class="{ 'is-active': promPage === p.id }" @click="promPage = p.id">{{ p.label }}</button>
        <span class="pm-nav__spacer"></span>
        <span class="pm-nav__clock">{{ clock }}</span>
      </nav>
      <main class="pm-main">
        <!-- Query / Graph -->
        <section v-if="promPage === 'graph'">
          <div class="pm-expr">
            <textarea v-model="expr" class="pm-expr__input" rows="2" spellcheck="false" placeholder="Expression (press Shift+Enter for newlines)" aria-label="Expression" @keydown.enter.exact.prevent="execute"></textarea>
            <button type="button" class="pm-btn pm-btn--primary" :disabled="busy || !expr.trim()" @click="execute">Execute</button>
          </div>
          <div class="pm-metrics">
            <select v-model="metricPick" class="pm-select" aria-label="Insert metric at cursor" @change="insertMetric">
              <option value="">Insert metric at cursor</option>
              <option v-for="m in METRICS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div class="pm-tabs">
            <button type="button" :class="{ 'is-active': resultTab === 'table' }" @click="resultTab = 'table'">Table</button>
            <button type="button" :class="{ 'is-active': resultTab === 'graph' }" @click="switchToGraph">Graph</button>
          </div>
          <div class="pm-panel">
            <p v-if="queryError" class="pm-alert pm-alert--danger">Error executing query: {{ queryError }}</p>
            <template v-if="resultTab === 'table'">
              <p v-if="!tableRows.length && !queryError" class="pm-muted">{{ executed ? 'Empty query result' : 'No data queried yet' }}</p>
              <table v-else class="pm-table">
                <tbody><tr v-for="(r, i) in tableRows" :key="i"><td class="pm-series">{{ r.series }}</td><td class="pm-value">{{ r.value }}</td></tr></tbody>
              </table>
              <p v-if="tableRows.length" class="pm-muted pm-small">Load time: {{ loadMs }}ms · Result series: {{ tableRows.length }}</p>
            </template>
            <template v-else>
              <div class="pm-graph-controls">
                <button type="button" class="pm-btn pm-btn--sm" @click="shiftRange(-1)">−</button>
                <span class="pm-range">{{ rangeLabel }}</span>
                <button type="button" class="pm-btn pm-btn--sm" @click="shiftRange(1)">+</button>
                <label class="pm-check"><input v-model="stacked" type="checkbox" /> stacked</label>
              </div>
              <TimeSeries :series="graphSeries" theme="light" :fill="stacked" :height="300" unit="short" />
            </template>
          </div>
        </section>

        <!-- Alerts -->
        <section v-else-if="promPage === 'alerts'">
          <div class="pm-filter">
            <label class="pm-check"><input v-model="showInactive" type="checkbox" /> Inactive ({{ counts.inactive }})</label>
            <label class="pm-check"><input v-model="showPending" type="checkbox" /> Pending ({{ counts.pending }})</label>
            <label class="pm-check"><input v-model="showFiring" type="checkbox" /> Firing ({{ counts.firing }})</label>
          </div>
          <div v-for="g in ruleGroups" :key="g.key" class="pm-group">
            <div class="pm-group__head">{{ g.file }} &gt; {{ g.name }}</div>
            <template v-for="r in g.rules" :key="r.name">
              <details v-if="r.type === 'alert' && visibleState(stateOf(r))" class="pm-rule" :class="'is-' + stateOf(r)">
                <summary><span class="pm-rule__name">{{ r.name }}</span> <span class="pm-rule__count">({{ stateOf(r) === 'inactive' ? 0 : 1 }} active)</span>
                  <span class="pm-badge" :class="'is-' + stateOf(r)">{{ stateOf(r).toUpperCase() }}</span></summary>
                <pre class="pm-yaml">name: {{ r.name }}
expr: {{ r.expr }}<template v-if="r.for">
for: {{ r.for }}</template>
labels:
  severity: {{ r.severity || 'none' }}
annotations:
  summary: {{ r.summary }}<template v-if="r.runbook">
  runbook_url: {{ r.runbook }}</template></pre>
                <table v-if="alertOf(r)" class="pm-table">
                  <thead><tr><th>Labels</th><th>State</th><th>Active Since</th><th>Value</th></tr></thead>
                  <tbody><tr><td><span class="pm-label">alertname={{ r.name }}</span><span class="pm-label">severity={{ r.severity }}</span></td><td><span class="pm-badge" :class="'is-' + stateOf(r)">{{ stateOf(r).toUpperCase() }}</span></td><td>{{ alertOf(r).since }}</td><td>{{ alertOf(r).silenced ? 'silenced' : '' }}</td></tr></tbody>
                </table>
              </details>
            </template>
          </div>
          <p v-if="!ruleGroups.length" class="pm-muted">No alerting rules defined. Load rule files with <code>rule_files</code> and reload.</p>
        </section>

        <!-- Rules -->
        <section v-else-if="promPage === 'rules'">
          <div class="pm-rules-head">
            <h2 class="pm-h2">Rules</h2>
            <button type="button" class="pm-btn" :disabled="busy" @click="reload">Reload configuration</button>
          </div>
          <div v-for="g in ruleGroups" :key="g.key" class="pm-group">
            <div class="pm-group__head pm-group__head--rules"><span>{{ g.name }}</span><span class="pm-muted">{{ g.file }}</span></div>
            <table class="pm-table">
              <thead><tr><th>Rule</th><th>State</th><th>Error</th></tr></thead>
              <tbody>
                <tr v-for="r in g.rules" :key="r.name">
                  <td><pre class="pm-yaml pm-yaml--inline"><template v-if="r.type === 'alert'">alert: </template><template v-else>record: </template>{{ r.name }}
expr: {{ r.expr }}<template v-if="r.for">
for: {{ r.for }}</template></pre></td>
                  <td><span class="pm-badge" :class="r.health === 'ok' ? 'is-ok' : 'is-err'">{{ r.health === 'ok' ? 'OK' : String(r.health).toUpperCase() }}</span></td>
                  <td class="pm-muted">{{ r.health === 'ok' ? '' : r.health }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!ruleGroups.length" class="pm-muted">No rules loaded.</p>
        </section>

        <!-- Targets -->
        <section v-else-if="promPage === 'targets'">
          <h2 class="pm-h2">Targets</h2>
          <div v-for="job in targetJobs" :key="job.name" class="pm-group">
            <div class="pm-group__head">{{ job.name }} <span :class="job.up === job.total ? 'pm-ok' : 'pm-err'">({{ job.up }}/{{ job.total }} up)</span></div>
            <table class="pm-table">
              <thead><tr><th>Endpoint</th><th>State</th><th>Labels</th><th>Last Scrape</th><th>Error</th></tr></thead>
              <tbody>
                <tr v-for="t in job.targets" :key="t.instance">
                  <td class="pm-link">http://{{ t.instance }}/{{ job.name === 'blackbox' ? 'probe' : 'metrics' }}</td>
                  <td><span class="pm-badge" :class="t.up ? 'is-ok' : 'is-err'">{{ t.up ? 'UP' : 'DOWN' }}</span></td>
                  <td><span class="pm-label">instance="{{ t.instance }}"</span><span class="pm-label">job="{{ job.name }}"</span></td>
                  <td>{{ t.up ? '7.3s ago' : '15s ago' }}</td>
                  <td class="pm-err">{{ t.up ? '' : 'Get "http://' + t.instance + '/metrics": context deadline exceeded' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Status -->
        <section v-else-if="promPage === 'status'">
          <h2 class="pm-h2">Runtime &amp; Build Information</h2>
          <table class="pm-table pm-table--kv">
            <tbody>
              <tr><th>Start time</th><td>{{ clock }}</td></tr>
              <tr><th>Configuration reload</th><td>Successful</td></tr>
              <tr><th>Rule files loaded</th><td>{{ files.join(', ') || 'none' }}</td></tr>
              <tr><th>Storage retention</th><td>30d</td></tr>
              <tr><th>Version</th><td>2.53.1</td></tr>
            </tbody>
          </table>
          <h2 class="pm-h2">Recent queries</h2>
          <table class="pm-table"><tbody><tr v-for="(q, i) in recentQueries" :key="i"><td><code>{{ q.expr }}</code></td><td>{{ q.ok ? q.rows + ' series' : 'error' }}</td></tr></tbody></table>
        </section>
      </main>
    </template>

    <!-- ================= ALERTMANAGER ================= -->
    <template v-else>
      <nav class="am-nav">
        <span class="am-brand">Alertmanager</span>
        <button v-for="p in AM_PAGES" :key="p.id" type="button" class="am-nav__link" :class="{ 'is-active': amPage === p.id }" @click="amPage = p.id">{{ p.label }}</button>
        <span class="pm-nav__spacer"></span>
        <button type="button" class="am-btn am-btn--outline" @click="newSilence()">New Silence</button>
      </nav>
      <main class="pm-main">
        <section v-if="amPage === 'alerts'">
          <div class="am-filter">
            <input v-model="amFilter" class="am-input" placeholder='Filter: alertname="HighErrorRate"' aria-label="Filter" />
            <label class="pm-check"><input v-model="showSilenced" type="checkbox" /> Silenced</label>
          </div>
          <div v-for="a in amAlerts" :key="a.name" class="am-group">
            <div class="am-group__labels"><span class="am-label">alertname="{{ a.name }}"</span><span class="am-label">severity="{{ a.severity }}"</span></div>
            <div class="am-alert">
              <div class="am-alert__time">{{ a.since }}</div>
              <div class="am-alert__body">
                <div class="am-alert__actions">
                  <button type="button" class="am-btn am-btn--sm" @click="toggleInfo(a.name)">+ Info</button>
                  <button type="button" class="am-btn am-btn--sm" :disabled="a.silenced" @click="newSilence(a.name)">Silence</button>
                </div>
                <div v-if="info.has(a.name)" class="am-info"><b>summary:</b> {{ a.summary }}<br /><b>state:</b> {{ a.silenced ? 'suppressed' : 'active' }}</div>
                <span class="am-label">service="shopapi"</span><span class="am-label">receiver="{{ receiverOf(a.name) }}"</span>
                <span v-if="a.silenced" class="am-label am-label--muted">silenced</span>
              </div>
            </div>
          </div>
          <p v-if="!amAlerts.length" class="pm-muted am-empty">No alert groups found</p>
        </section>

        <section v-else-if="amPage === 'silences'">
          <div class="am-tabs">
            <button type="button" :class="{ 'is-active': silenceTab === 'active' }" @click="silenceTab = 'active'">Active <span>{{ activeSilences.length }}</span></button>
            <button type="button" :class="{ 'is-active': silenceTab === 'expired' }" @click="silenceTab = 'expired'">Expired <span>{{ expiredSilences.length }}</span></button>
          </div>
          <div v-for="s in (silenceTab === 'active' ? activeSilences : expiredSilences)" :key="s.id" class="am-silence">
            <div class="am-silence__top">
              <span class="am-muted">{{ s.id }}</span>
              <span class="pm-nav__spacer"></span>
              <button v-if="s.active" type="button" class="am-btn am-btn--sm" @click="newSilence('', s.matchers, s.comment)">Edit</button>
              <button v-if="s.active" type="button" class="am-btn am-btn--sm am-btn--danger" @click="expire(s.id)">Expire</button>
              <button v-else type="button" class="am-btn am-btn--sm" @click="newSilence('', s.matchers, s.comment)">Recreate</button>
            </div>
            <div><span v-for="m in String(s.matchers).split(' ')" :key="m" class="am-label">{{ m }}</span></div>
            <div class="am-muted">{{ s.comment }}</div>
          </div>
          <p v-if="!(silenceTab === 'active' ? activeSilences : expiredSilences).length" class="pm-muted am-empty">No silences</p>
        </section>

        <section v-else-if="amPage === 'new'" class="am-form">
          <h2 class="pm-h2">New Silence</h2>
          <div class="am-row">
            <label>Duration<input v-model="form.duration" class="am-input" placeholder="2h" /></label>
          </div>
          <fieldset class="am-matchers">
            <legend>Matchers <span class="am-muted">Alerts affected by this silence</span></legend>
            <div v-for="(m, i) in form.matchers" :key="i" class="am-matcher">
              <input v-model="m.name" class="am-input" placeholder="Name" aria-label="Matcher name" />
              <select v-model="m.op" class="am-input am-input--op" aria-label="Operator"><option>=</option><option>!=</option><option>=~</option></select>
              <input v-model="m.value" class="am-input" placeholder="Value" aria-label="Matcher value" />
              <button type="button" class="am-btn am-btn--sm" aria-label="Remove matcher" @click="form.matchers.splice(i, 1)">✕</button>
            </div>
            <button type="button" class="am-btn am-btn--sm" @click="form.matchers.push({ name: '', op: '=', value: '' })">+ Add matcher</button>
            <p class="am-muted">Affected alerts: <b>{{ affectedCount }}</b></p>
          </fieldset>
          <label class="am-block">Creator<input class="am-input" value="sre" disabled /></label>
          <label class="am-block">Comment<textarea v-model="form.comment" class="am-input" rows="3" placeholder="Why is this alert silenced? (required)"></textarea></label>
          <p v-if="formError" class="pm-alert pm-alert--danger">{{ formError }}</p>
          <div class="am-form__actions">
            <button type="button" class="am-btn am-btn--primary" :disabled="busy" @click="createSilence">Create</button>
            <button type="button" class="am-btn" @click="amPage = 'silences'">Cancel</button>
          </div>
        </section>

        <section v-else-if="amPage === 'status'">
          <h2 class="pm-h2">Status</h2>
          <table class="pm-table pm-table--kv"><tbody>
            <tr><th>Uptime</th><td>{{ clock }}</td></tr>
            <tr><th>Cluster</th><td>ready · 1 peer</td></tr>
            <tr><th>Config</th><td><button type="button" class="am-btn am-btn--sm" :disabled="busy" @click="checkConfig">Check monitoring/alertmanager.yml</button></td></tr>
          </tbody></table>
          <h2 class="pm-h2">Notifications sent</h2>
          <table class="pm-table">
            <thead><tr><th>Time</th><th>Alert</th><th>Severity</th><th>Receiver</th><th>Summary</th></tr></thead>
            <tbody>
              <tr v-for="(n, i) in notifications" :key="i"><td>{{ n.time }}</td><td>{{ n.alert }}</td><td>{{ n.severity }}</td><td><span class="am-label">{{ n.receiver }}</span></td><td class="pm-muted">{{ n.summary }}</td></tr>
              <tr v-if="!notifications.length"><td colspan="5" class="pm-muted">Nothing has been sent.</td></tr>
            </tbody>
          </table>
        </section>
      </main>
    </template>

    <div class="pm-toasts" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="pm-toast" :class="'is-' + f.type">
        <b>{{ f.title }}</b><span v-if="f.detail">{{ f.detail }}</span>
        <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Prometheus web UI and the Alertmanager UI over the ShopFront estate.
 * Execute runs `promql` (instant) or `promql --range` (graph); Reload runs
 * `prom reload`; silences run `amtool silence add|expire`. The rules, alerts,
 * targets and notifications come from the view, which the engine derives from
 * the student's own rule files and alertmanager.yml.
 */
import { computed, reactive, ref, watch } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import TimeSeries from './TimeSeries.vue';
import { asSeries, str, toPlot, type PlotSeries } from './sreKit';

const props = defineProps<{ view: Record<string, any>; api: any; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();
const api = props.api;

const PROM_PAGES = [
    { id: 'alerts', label: 'Alerts' }, { id: 'graph', label: 'Graph' }, { id: 'rules', label: 'Rules' },
    { id: 'targets', label: 'Targets' }, { id: 'status', label: 'Status' },
];
const AM_PAGES = [{ id: 'alerts', label: 'Alerts' }, { id: 'silences', label: 'Silences' }, { id: 'status', label: 'Status' }];
const METRICS = ['up', 'http_requests_total', 'http_request_duration_seconds_bucket', 'http_request_duration_seconds_count',
    'nginx_http_requests_total', 'node_cpu_seconds_total', 'node_filesystem_avail_bytes', 'node_filesystem_size_bytes',
    'node_load1', 'node_memory_MemAvailable_bytes', 'node_memory_MemTotal_bytes', 'probe_success', 'probe_duration_seconds',
    'probe_ssl_earliest_cert_expiry', 'process_resident_memory_bytes', 'shopapi_build_info'];
const RANGES = [15, 30, 60, 180, 360, 1440];

const app = ref<'prom' | 'am'>('prom');
const promPage = ref('graph');
const amPage = ref('alerts');
const expr = ref('');
const metricPick = ref('');
const resultTab = ref<'table' | 'graph'>('table');
const tableRows = ref<{ series: string; value: string }[]>([]);
const graphSeries = ref<PlotSeries[]>([]);
const queryError = ref('');
const executed = ref(false);
const loadMs = ref(0);
const rangeIdx = ref(2);
const stacked = ref(false);
const showInactive = ref(true);
const showPending = ref(true);
const showFiring = ref(true);
const amFilter = ref('');
const showSilenced = ref(false);
const info = ref(new Set<string>());
const silenceTab = ref<'active' | 'expired'>('active');
const form = reactive({ duration: '2h', comment: '', matchers: [{ name: 'alertname', op: '=', value: '' }] });
const formError = ref('');

const clock = computed(() => str(pick(props.view, 'overview.clock', '')));
const alerts = computed(() => rows<any>(props.view, 'alerts'));
const firing = computed(() => alerts.value.filter(a => a.state === 'firing' && !a.silenced));
const rules = computed(() => rows<any>(props.view, 'rules').map(r => ({ ...r, type: r.type === 'alerting' ? 'alert' : r.type })));
const files = computed(() => [...new Set(rules.value.map(r => str(r.file)))].filter(Boolean));
const silences = computed(() => rows<any>(props.view, 'silences'));
const activeSilences = computed(() => silences.value.filter(s => s.active));
const expiredSilences = computed(() => silences.value.filter(s => !s.active));
const notifications = computed(() => rows<any>(props.view, 'notifications').slice().reverse());
const recentQueries = computed(() => rows<any>(props.view, 'queries').slice().reverse().slice(0, 12));
const rangeLabel = computed(() => { const m = RANGES[rangeIdx.value]; return m >= 60 ? (m / 60) + 'h' : m + 'm'; });

const ruleGroups = computed(() => {
    const groups: Record<string, { key: string; name: string; file: string; rules: any[] }> = {};
    for (const r of rules.value) {
        const key = str(r.file) + '/' + str(r.group);
        (groups[key] ||= { key, name: str(r.group), file: str(r.file), rules: [] }).rules.push(r);
    }
    return Object.values(groups);
});
function alertOf(r: any) { return alerts.value.find(a => a.name === r.name); }
function stateOf(r: any): 'firing' | 'pending' | 'inactive' {
    const a = alertOf(r);
    return a ? (a.state === 'firing' ? 'firing' : 'pending') : 'inactive';
}
const counts = computed(() => {
    const c = { inactive: 0, pending: 0, firing: 0 };
    for (const r of rules.value) if (r.type === 'alert') c[stateOf(r)]++;
    return c;
});
function visibleState(s: string) {
    return (s === 'inactive' && showInactive.value) || (s === 'pending' && showPending.value) || (s === 'firing' && showFiring.value);
}

const targetJobs = computed(() => {
    const jobs: Record<string, { name: string; targets: { instance: string; up: boolean }[]; up: number; total: number }> = {};
    for (const s of asSeries(pick(props.view, 'series.up', []))) {
        const job = s.metric.job || 'unknown';
        const last = s.values.length ? s.values[s.values.length - 1][1] : 0;
        const entry = (jobs[job] ||= { name: job, targets: [], up: 0, total: 0 });
        entry.targets.push({ instance: s.metric.instance || '', up: last >= 1 });
        entry.total++;
        if (last >= 1) entry.up++;
    }
    return Object.values(jobs).sort((a, b) => a.name.localeCompare(b.name));
});

const amAlerts = computed(() => {
    const q = amFilter.value.trim().toLowerCase().replace(/alertname\s*=\s*"?([^"]*)"?/, '$1');
    return alerts.value.filter(a => a.state === 'firing' && (showSilenced.value || !a.silenced)
        && (!q || a.name.toLowerCase().includes(q) || str(a.severity).includes(q)));
});
function receiverOf(name: string) {
    const n = rows<any>(props.view, 'notifications').filter(x => x.alert === name).pop();
    return n ? n.receiver : 'default';
}
function toggleInfo(name: string) {
    const next = new Set(info.value);
    if (next.has(name)) next.delete(name); else next.add(name);
    info.value = next;
}
const affectedCount = computed(() => alerts.value.filter(a => form.matchers.every(m => {
    if (!m.name || !m.value) return true;
    const v = m.name === 'alertname' ? a.name : m.name === 'severity' ? a.severity : '';
    if (m.op === '=') return v === m.value;
    if (m.op === '!=') return v !== m.value;
    try { return new RegExp('^(?:' + m.value + ')$').test(v); } catch { return false; }
})).length);

watch([app, promPage, amPage], () => {
    emit('location', app.value === 'prom' ? `http://mon-1:9090/${promPage.value === 'graph' ? 'graph' : promPage.value}`
        : `http://mon-1:9093/#/${amPage.value === 'new' ? 'silences/new' : amPage.value}`);
}, { immediate: true });

function insertMetric() {
    if (metricPick.value) expr.value = (expr.value ? expr.value + ' ' : '') + metricPick.value;
    metricPick.value = '';
}

async function execute() {
    const q = expr.value.trim();
    if (!q) return;
    queryError.value = '';
    executed.value = true;
    const started = performance.now();
    if (resultTab.value === 'graph') return runGraph();
    const result = await api.exec(cli(['promql', q]), { quiet: true });
    loadMs.value = Math.round(performance.now() - started);
    if (!result.ok) { queryError.value = String(result.error || result.output || '').replace(/^Error executing query: /, ''); tableRows.value = []; return; }
    const out = String(result.output || '');
    if (out.startsWith('scalar:')) {
        tableRows.value = [{ series: 'scalar', value: out.replace(/^scalar:\s*/, '').replace(/\s*@\[.*$/, '') }];
    } else if (out.startsWith('(empty')) {
        tableRows.value = [];
    } else {
        tableRows.value = out.split('\n').filter(Boolean).map(l => {
            const m = /^(.*) => (\S+)/.exec(l);
            return m ? { series: m[1], value: m[2] } : { series: l, value: '' };
        });
    }
}
async function runGraph() {
    const q = expr.value.trim();
    if (!q) return;
    const minutes = RANGES[rangeIdx.value];
    const step = Math.max(15, Math.round(minutes * 60 / 120));
    const result = await api.exec(cli(['promql', `--range=${minutes}m`, `--step=${step}s`, q]), { quiet: true });
    if (!result.ok) { queryError.value = String(result.error || result.output || '').replace(/^Error executing query: /, ''); graphSeries.value = []; return; }
    graphSeries.value = toPlot(asSeries((result.data || {}).result || []));
}
function switchToGraph() { resultTab.value = 'graph'; if (expr.value.trim()) runGraph(); }
function shiftRange(d: number) {
    rangeIdx.value = Math.max(0, Math.min(RANGES.length - 1, rangeIdx.value + d));
    if (resultTab.value === 'graph') runGraph();
}

async function reload() {
    await api.exec(cli(['prom', 'reload']), { success: 'Configuration reloaded' });
}
async function checkConfig() {
    await api.exec(cli(['amtool', 'check-config', 'monitoring/alertmanager.yml']), { success: 'alertmanager.yml is valid' });
}

function newSilence(alertname = '', matchers = '', comment = '') {
    formError.value = '';
    form.duration = '2h';
    form.comment = comment;
    form.matchers = matchers
        ? String(matchers).split(' ').filter(Boolean).map(m => {
            const x = /^(\w+)(=~|!=|=)(.*)$/.exec(m);
            return x ? { name: x[1], op: x[2], value: x[3].replace(/^"|"$/g, '') } : { name: m, op: '=', value: '' };
        })
        : [{ name: 'alertname', op: '=', value: alertname }];
    app.value = 'am';
    amPage.value = 'new';
}

async function createSilence() {
    formError.value = '';
    const ms = form.matchers.filter(m => m.name.trim() && m.value.trim());
    if (!ms.length) { formError.value = 'At least one matcher with a name and a value is required.'; return; }
    if (!form.comment.trim()) { formError.value = 'A comment is required: say why this alert is silenced.'; return; }
    const result = await api.exec(cli(['amtool', 'silence', 'add', ...ms.map(m => `${m.name.trim()}${m.op}${m.value.trim()}`)], {
        '--duration': form.duration.trim() || '2h', '--comment': form.comment.trim(),
    }), { quiet: true });
    if (!result.ok) { formError.value = String(result.error || result.output || 'The silence could not be created.'); return; }
    api.notify('success', 'Silence created', String(result.output || ''));
    amPage.value = 'silences';
    silenceTab.value = 'active';
}

async function expire(id: string) {
    if (!window.confirm(`Expire silence ${id}? Matching alerts will notify again.`)) return;
    await api.exec(cli(['amtool', 'silence', 'expire', id]), { success: 'Silence expired' });
}
</script>

<style scoped>
.pm {
    display: flex; flex-direction: column; height: 100%; min-height: 34rem; background: #fff; color: #212529;
    font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; position: relative;
}
.pm-apps { display: flex; gap: 2px; background: #dee1e6; padding: 4px 6px 0; flex: none; }
.pm-apps button { display: flex; align-items: center; gap: 6px; background: #c7cbd1; border: 0; border-radius: 8px 8px 0 0; padding: 6px 14px; font: inherit; font-size: 12.5px; color: #3c4043; cursor: pointer; }
.pm-apps button.is-active { background: #fff; color: #202124; }
.pm-apps__badge { background: #d9534f; color: #fff; border-radius: 9px; padding: 0 6px; font-size: 11px; }
.pm-nav, .am-nav { display: flex; align-items: center; gap: 2px; padding: 0 14px; height: 52px; flex: none; flex-wrap: wrap; }
.pm-nav { background: #343a40; }
.pm-brand { color: #fff; font-size: 19px; margin-right: 18px; }
.pm-nav__link { background: none; border: 0; color: rgba(255, 255, 255, 0.55); font: inherit; padding: 8px 10px; cursor: pointer; }
.pm-nav__link:hover, .pm-nav__link.is-active { color: #fff; }
.pm-nav__spacer { flex: 1; }
.pm-nav__clock { color: rgba(255, 255, 255, 0.55); font-size: 12px; }
.pm-main { flex: 1; overflow: auto; padding: 16px 18px 40px; min-height: 0; }
.pm-h2 { font-size: 20px; font-weight: 500; margin: 6px 0 12px; }
.pm-expr { display: flex; gap: 8px; align-items: stretch; }
.pm-expr__input { flex: 1; border: 1px solid #ced4da; border-radius: 4px; padding: 8px 10px; font-family: SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; resize: vertical; min-height: 40px; }
.pm-expr__input:focus { outline: none; border-color: #80bdff; box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25); }
.pm-metrics { margin: 8px 0; }
.pm-select { border: 1px solid #ced4da; border-radius: 4px; padding: 4px 8px; font: inherit; font-size: 13px; background: #fff; }
.pm-btn { background: #fff; color: #212529; border: 1px solid #ced4da; border-radius: 4px; padding: 6px 12px; font: inherit; cursor: pointer; }
.pm-btn:hover { background: #f1f3f5; }
.pm-btn--primary { background: #007bff; border-color: #007bff; color: #fff; }
.pm-btn--primary:hover { background: #0069d9; }
.pm-btn--sm { padding: 2px 10px; }
.pm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.pm-tabs { display: flex; border-bottom: 1px solid #dee2e6; margin-top: 8px; }
.pm-tabs button { background: none; border: 1px solid transparent; border-radius: 4px 4px 0 0; padding: 8px 16px; color: #007bff; font: inherit; cursor: pointer; margin-bottom: -1px; }
.pm-tabs button.is-active { color: #495057; background: #fff; border-color: #dee2e6 #dee2e6 #fff; }
.pm-panel { border: 1px solid #dee2e6; border-top: 0; padding: 12px; min-height: 8rem; }
.pm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pm-table th { text-align: left; border-bottom: 2px solid #dee2e6; padding: 6px 8px; font-weight: 600; }
.pm-table td { border-top: 1px solid #dee2e6; padding: 6px 8px; vertical-align: top; }
.pm-table--kv th { width: 14rem; border: 0; border-top: 1px solid #dee2e6; }
.pm-series { font-family: SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; word-break: break-all; }
.pm-value { text-align: right; font-family: SFMono-Regular, Menlo, Consolas, monospace; white-space: nowrap; }
.pm-muted { color: #6c757d; }
.pm-small { font-size: 12px; margin-top: 8px; }
.pm-graph-controls { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.pm-range { border: 1px solid #ced4da; border-radius: 4px; padding: 2px 10px; min-width: 3.5rem; text-align: center; }
.pm-check { display: inline-flex; align-items: center; gap: 4px; margin-right: 12px; font-size: 13px; }
.pm-alert { padding: 10px 14px; border-radius: 4px; margin: 0 0 10px; }
.pm-alert--danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
.pm-filter { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.pm-group { margin-bottom: 18px; }
.pm-group__head { font-weight: 600; padding: 8px 0; border-bottom: 1px solid #dee2e6; }
.pm-group__head--rules { display: flex; justify-content: space-between; font-size: 16px; }
.pm-rule { border: 1px solid #dee2e6; border-radius: 4px; margin: 6px 0; }
.pm-rule summary { padding: 10px 12px; cursor: pointer; list-style: revert; }
.pm-rule.is-firing { border-color: #f5c6cb; background: #fdf1f2; }
.pm-rule.is-pending { border-color: #ffeeba; background: #fffaeb; }
.pm-rule.is-inactive { background: #eef8f0; border-color: #c3e6cb; }
.pm-rule__name { font-weight: 600; }
.pm-rule__count { color: #6c757d; }
.pm-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #fff; margin-left: 6px; }
.pm-badge.is-firing, .pm-badge.is-err { background: #dc3545; }
.pm-badge.is-pending { background: #ffc107; color: #212529; }
.pm-badge.is-inactive, .pm-badge.is-ok { background: #28a745; }
.pm-yaml { background: #f8f9fa; margin: 0 12px 10px; padding: 10px; border-radius: 4px; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; }
.pm-yaml--inline { margin: 0; }
.pm-label { display: inline-block; background: #e9ecef; border-radius: 4px; padding: 1px 6px; margin: 2px 4px 2px 0; font-size: 12px; font-family: SFMono-Regular, Menlo, Consolas, monospace; }
.pm-rules-head { display: flex; align-items: center; justify-content: space-between; }
.pm-link { color: #007bff; word-break: break-all; }
.pm-ok { color: #28a745; } .pm-err { color: #dc3545; }
/* Alertmanager */
.am-nav { background: #fff; border-bottom: 1px solid #e5e5e5; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.am-brand { font-size: 19px; color: #333; margin-right: 16px; }
.am-nav__link { background: none; border: 0; color: #777; font: inherit; padding: 8px 10px; cursor: pointer; }
.am-nav__link.is-active, .am-nav__link:hover { color: #333; }
.am-btn { background: #fff; border: 1px solid #ccc; border-radius: 4px; padding: 6px 12px; font: inherit; cursor: pointer; color: #333; }
.am-btn:hover { background: #f5f5f5; }
.am-btn--outline { border-color: #337ab7; color: #337ab7; }
.am-btn--primary { background: #337ab7; border-color: #2e6da4; color: #fff; }
.am-btn--danger { color: #d9534f; border-color: #d9534f; }
.am-btn--sm { padding: 2px 8px; font-size: 12px; }
.am-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.am-input { border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; font: inherit; width: 100%; }
.am-input--op { width: 5rem; flex: none; }
.am-filter { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.am-group { border-left: 3px solid #d9534f; margin-bottom: 14px; padding-left: 12px; }
.am-group__labels { margin-bottom: 6px; }
.am-label { display: inline-block; background: #e8eef6; color: #31708f; border-radius: 3px; padding: 2px 6px; margin: 2px 4px 2px 0; font-size: 12px; }
.am-label--muted { background: #eee; color: #777; }
.am-alert { display: flex; gap: 12px; }
.am-alert__time { color: #777; font-size: 12px; min-width: 4rem; padding-top: 3px; }
.am-alert__actions { display: flex; gap: 6px; margin-bottom: 4px; }
.am-info { background: #f9f9f9; border: 1px solid #eee; padding: 6px 10px; border-radius: 3px; margin: 4px 0; font-size: 13px; }
.am-empty { padding: 20px 0; }
.am-tabs { display: flex; gap: 4px; border-bottom: 1px solid #ddd; margin-bottom: 12px; }
.am-tabs button { background: none; border: 0; padding: 8px 14px; cursor: pointer; font: inherit; color: #337ab7; border-bottom: 2px solid transparent; }
.am-tabs button.is-active { color: #333; border-bottom-color: #337ab7; }
.am-tabs span { background: #777; color: #fff; border-radius: 9px; padding: 0 6px; font-size: 11px; margin-left: 4px; }
.am-silence { border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; margin-bottom: 8px; }
.am-silence__top { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
.am-muted { color: #777; font-size: 13px; }
.am-form { max-width: 44rem; }
.am-row label, .am-block { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-weight: 600; font-size: 13px; }
.am-matchers { border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; margin-bottom: 12px; }
.am-matchers legend { font-weight: 600; font-size: 13px; padding: 0 4px; }
.am-matcher { display: flex; gap: 6px; margin-bottom: 6px; }
.am-form__actions { display: flex; gap: 8px; }
.pm-toasts { position: absolute; right: 12px; bottom: 12px; display: flex; flex-direction: column; gap: 8px; z-index: 30; }
.pm-toast { background: #fff; border: 1px solid #dee2e6; border-left: 4px solid #17a2b8; border-radius: 4px; padding: 8px 30px 8px 10px; position: relative; max-width: 22rem; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
.pm-toast.is-success { border-left-color: #28a745; }
.pm-toast.is-error { border-left-color: #dc3545; }
.pm-toast button { position: absolute; right: 6px; top: 4px; background: none; border: 0; color: #6c757d; cursor: pointer; font-size: 16px; }
@container sl-portal (max-width: 640px) {
    .pm-expr { flex-direction: column; }
    .am-matcher { flex-wrap: wrap; }
}
</style>
