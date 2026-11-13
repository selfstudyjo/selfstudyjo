<template>
  <div class="gf" dir="ltr">
    <!-- Top bar: logo, breadcrumbs, search, actions, profile -->
    <header class="gf-top">
      <button type="button" class="gf-icon-btn" aria-label="Toggle menu" @click="menuOpen = !menuOpen">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" fill="none"/></svg>
      </button>
      <span class="gf-logo" aria-label="Grafana">
        <svg viewBox="0 0 32 32" width="22" height="22"><defs><linearGradient id="gfg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FCEE1F"/><stop offset="1" stop-color="#F15B2A"/></linearGradient></defs><circle cx="16" cy="16" r="10" fill="none" stroke="url(#gfg)" stroke-width="5"/><circle cx="16" cy="16" r="3.2" fill="url(#gfg)"/></svg>
      </span>
      <nav class="gf-crumbs" aria-label="Breadcrumb">
        <button type="button" @click="go('home')">Home</button>
        <template v-for="c in crumbs" :key="c.label"><span>›</span><button type="button" @click="c.page && go(c.page)">{{ c.label }}</button></template>
      </nav>
      <div class="gf-search">
        <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2"/></svg>
        <input v-model="search" type="search" placeholder="Search or jump to..." aria-label="Search dashboards" @keydown.enter="go('dashboards')" />
        <kbd>ctrl+k</kbd>
      </div>
      <div class="gf-top-actions">
        <button type="button" class="gf-icon-btn" title="New" aria-label="New" @click="importOpen = true">＋</button>
        <button type="button" class="gf-icon-btn" title="Help" aria-label="Help">?</button>
        <span class="gf-avatar" title="sre (Admin)">SR</span>
      </div>
    </header>

    <div class="gf-body">
      <!-- Mega menu -->
      <nav v-if="menuOpen" class="gf-menu" aria-label="Grafana menu">
        <button v-for="item in MENU" :key="item.page" type="button" class="gf-menu__item"
                :class="{ 'is-active': page === item.page || (item.page === 'dashboards' && page === 'dashboard') }" @click="go(item.page)">
          <span class="gf-menu__ico">{{ item.icon }}</span>{{ item.label }}
        </button>
      </nav>

      <main class="gf-main">
        <!-- ===== Home ===== -->
        <section v-if="page === 'home'" class="gf-page">
          <h1 class="gf-h1">Welcome to Grafana</h1>
          <div class="gf-home-grid">
            <div class="gf-card">
              <h3>Starred dashboards</h3>
              <button type="button" class="gf-link" @click="openDash('overview')">⭐ ShopFront / Service overview</button>
              <button type="button" class="gf-link" @click="openDash('hosts')">⭐ ShopFront / Node exporter - fleet</button>
            </div>
            <div class="gf-card">
              <h3>Recently viewed</h3>
              <button v-for="d in importedDashboards" :key="d" type="button" class="gf-link" @click="openDash('imported:' + d)">{{ d }}</button>
              <p v-if="!importedDashboards.length" class="gf-muted">No imported dashboards yet. Import one from Dashboards → New → Import.</p>
            </div>
            <div class="gf-card">
              <h3>Data sources</h3>
              <p><span class="gf-ds-dot prom"></span> Prometheus <span class="gf-muted">http://mon-1:9090 (default)</span></p>
              <p><span class="gf-ds-dot loki"></span> Loki <span class="gf-muted">http://mon-1:3100</span></p>
              <p><span class="gf-ds-dot am"></span> Alertmanager <span class="gf-muted">http://mon-1:9093</span></p>
            </div>
          </div>
        </section>

        <!-- ===== Dashboards list ===== -->
        <section v-else-if="page === 'dashboards'" class="gf-page">
          <div class="gf-page-head">
            <h1 class="gf-h1">Dashboards</h1>
            <p class="gf-muted">Create and manage dashboards to visualize your data</p>
            <div class="gf-page-actions">
              <button type="button" class="gf-btn gf-btn--primary" @click="importOpen = true">New ▾ Import</button>
            </div>
          </div>
          <div class="gf-filterbar">
            <input v-model="search" type="search" class="gf-input" placeholder="Search for dashboards and folders" />
          </div>
          <table class="gf-table">
            <thead><tr><th>Name</th><th>Tags</th><th>Location</th></tr></thead>
            <tbody>
              <tr class="gf-folder"><td colspan="3">📁 ShopFront</td></tr>
              <tr v-for="d in dashList" :key="d.id" @click="openDash(d.id)">
                <td class="gf-dash-name">▦ {{ d.title }}</td>
                <td><span v-for="t in d.tags" :key="t" class="gf-tag">{{ t }}</span></td>
                <td class="gf-muted">{{ d.folder }}</td>
              </tr>
              <tr v-if="!dashList.length"><td colspan="3" class="gf-muted">No dashboards match "{{ search }}".</td></tr>
            </tbody>
          </table>
        </section>

        <!-- ===== A dashboard ===== -->
        <section v-else-if="page === 'dashboard'" class="gf-page gf-page--dash">
          <div class="gf-dash-bar">
            <h1 class="gf-dash-title">{{ dashTitle }} <span class="gf-star">☆</span></h1>
            <div class="gf-dash-tools">
              <label class="gf-picker">
                <span>🕒</span>
                <select v-model="range" aria-label="Time range">
                  <option v-for="r in RANGES" :key="r.min" :value="r.min">Last {{ r.label }}</option>
                </select>
              </label>
              <button type="button" class="gf-btn" title="Refresh dashboard" @click="$emit('refresh')">⟳ Refresh</button>
              <button type="button" class="gf-btn" @click="share = !share">Share</button>
            </div>
          </div>
          <p v-if="share" class="gf-share">Link: <code>http://grafana.shopfront.internal:3000/d/{{ dashId }}?orgId=1&amp;from=now-{{ range }}m&amp;to=now</code></p>
          <div class="gf-vars">
            <label>datasource <select disabled><option>Prometheus</option></select></label>
            <label>job <select disabled><option>shopapi</option></select></label>
            <label>instance <select v-model="instanceVar"><option value="">All</option><option v-for="s in services" :key="s.instance" :value="s.instance">{{ s.instance }}</option></select></label>
          </div>

          <template v-if="dashId === 'overview'">
            <div class="gf-row-title">▾ Golden signals <span class="gf-muted">{{ clock }}</span></div>
            <div class="gf-grid">
              <div v-for="st in stats" :key="st.title" class="gf-panel gf-panel--stat">
                <div class="gf-panel__head"><span>{{ st.title }}</span><button type="button" class="gf-panel__menu" @click="explore(st.expr)">⋮</button></div>
                <div class="gf-stat" :style="{ background: st.bg }">
                  <span class="gf-stat__value">{{ st.text }}</span>
                  <svg v-if="st.spark.length" class="gf-stat__spark" viewBox="0 0 100 30" preserveAspectRatio="none"><path :d="sparkPath(st.spark)" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.5"/></svg>
                </div>
              </div>
            </div>
            <div class="gf-grid gf-grid--2">
              <div class="gf-panel">
                <div class="gf-panel__head"><span>Requests per second by instance</span><button type="button" class="gf-panel__menu" @click="explore(Q.rpsByInstance)">⋮</button></div>
                <TimeSeries :series="trim(rpsByInstance)" unit="reqps" :height="200" />
              </div>
              <div class="gf-panel">
                <div class="gf-panel__head"><span>5xx responses by code</span><button type="button" class="gf-panel__menu" @click="explore(Q.errorsByCode)">⋮</button></div>
                <TimeSeries :series="trim(errorsByCode)" unit="reqps" :height="200" bars />
              </div>
              <div class="gf-panel">
                <div class="gf-panel__head"><span>Latency p50 / p99</span><button type="button" class="gf-panel__menu" @click="explore(Q.p99)">⋮</button></div>
                <TimeSeries :series="trim(latency)" unit="ms" :height="200" :thresholds="[{ value: 500, color: '#F2495C' }]" />
              </div>
              <div class="gf-panel">
                <div class="gf-panel__head"><span>Error ratio (SLO 99.5% → 0.5%)</span><button type="button" class="gf-panel__menu" @click="explore(Q.errorRatio)">⋮</button></div>
                <TimeSeries :series="trim(errorRatio)" unit="percent" :height="200" :thresholds="[{ value: 0.5, color: '#FF9830' }, { value: 5, color: '#F2495C' }]" />
              </div>
            </div>
            <div class="gf-row-title">▾ Instances</div>
            <div class="gf-panel">
              <div class="gf-panel__head"><span>shopapi instances</span></div>
              <table class="gf-table gf-table--panel">
                <thead><tr><th>instance</th><th>version</th><th>state</th><th>traffic share</th><th>error %</th><th>added latency</th></tr></thead>
                <tbody>
                  <tr v-for="s in filteredServices" :key="s.instance">
                    <td>{{ s.instance }}</td><td>{{ s.version }}</td>
                    <td><span class="gf-cell" :class="s.state === 'ok' ? 'is-ok' : 'is-bad'">{{ s.state }}</span></td>
                    <td><div class="gf-gauge"><i :style="{ width: Math.min(100, s.share_pct) + '%' }"></i><span>{{ s.share_pct }}%</span></div></td>
                    <td :style="{ color: thresholdColor(s.error_pct, 0.5, 5) }">{{ s.error_pct }}%</td>
                    <td>{{ s.latency_add_ms }} ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="gf-row-title">▾ Alerts</div>
            <div class="gf-panel">
              <div class="gf-panel__head"><span>Alert list</span></div>
              <ul class="gf-alertlist">
                <li v-for="a in alerts" :key="a.name">
                  <span class="gf-alert-state" :class="'is-' + (a.silenced ? 'silenced' : a.state)">{{ a.silenced ? 'Silenced' : a.state === 'firing' ? 'Firing' : 'Pending' }}</span>
                  <b>{{ a.name }}</b> <span class="gf-muted">{{ a.summary }}</span> <span class="gf-muted gf-right">for {{ a.since }}</span>
                </li>
                <li v-if="!alerts.length" class="gf-muted">No alerts firing or pending.</li>
              </ul>
            </div>
          </template>

          <template v-else-if="dashId === 'hosts'">
            <div class="gf-row-title">▾ Fleet - node_exporter</div>
            <div class="gf-grid gf-grid--hosts">
              <div v-for="h in hosts" :key="h.host" class="gf-panel gf-panel--stat">
                <div class="gf-panel__head"><span>{{ h.host }}</span></div>
                <div class="gf-stat" :style="{ background: h.status === 'healthy' ? '#1a7f37' : h.status === 'degraded' ? '#b77d06' : '#c4314b' }">
                  <span class="gf-stat__value gf-stat__value--sm">{{ h.status.toUpperCase() }}</span>
                  <span class="gf-stat__sub">{{ h.role }}</span>
                </div>
              </div>
            </div>
            <div class="gf-grid gf-grid--2">
              <div class="gf-panel"><div class="gf-panel__head"><span>System load (1m)</span></div><TimeSeries :series="trim(load)" unit="short" :height="200" /></div>
              <div class="gf-panel"><div class="gf-panel__head"><span>Memory used %</span></div><TimeSeries :series="trim(memUsed)" unit="percent" :height="200" :max="100" :thresholds="[{ value: 90, color: '#F2495C' }]" /></div>
              <div class="gf-panel"><div class="gf-panel__head"><span>Root filesystem used %</span></div><TimeSeries :series="trim(diskUsed)" unit="percent" :height="200" :max="100" :thresholds="[{ value: 90, color: '#F2495C' }]" /></div>
              <div class="gf-panel"><div class="gf-panel__head"><span>shopapi resident memory</span></div><TimeSeries :series="trim(rss)" unit="bytes" :height="200" /></div>
            </div>
          </template>

          <template v-else>
            <div class="gf-row-title">▾ {{ dashTitle }}</div>
            <div class="gf-grid">
              <div v-for="p in importedPanels" :key="p.title" class="gf-panel gf-panel--stat">
                <div class="gf-panel__head"><span>{{ p.title }}</span><button type="button" class="gf-panel__menu" title="Explore" @click="explore(p.expr)">⋮</button></div>
                <div class="gf-stat gf-stat--plain"><span class="gf-stat__value">{{ p.value }}</span><code class="gf-stat__expr">{{ p.expr }}</code></div>
              </div>
            </div>
            <p v-if="!importedPanels.length" class="gf-muted">This dashboard has no panels.</p>
          </template>
        </section>

        <!-- ===== Explore ===== -->
        <section v-else-if="page === 'explore'" class="gf-page">
          <div class="gf-explore-bar">
            <h1 class="gf-h1">Explore</h1>
            <select v-model="exploreDs" class="gf-input gf-input--ds" aria-label="Data source">
              <option value="prometheus">Prometheus</option>
              <option value="loki">Loki</option>
            </select>
            <select v-model="range" class="gf-input gf-input--ds" aria-label="Time range">
              <option v-for="r in RANGES" :key="r.min" :value="r.min">Last {{ r.label }}</option>
            </select>
            <button type="button" class="gf-btn gf-btn--primary" :disabled="busy" @click="runExplore">▶ Run query</button>
          </div>
          <div class="gf-query">
            <div class="gf-query__label">A <span class="gf-muted">({{ exploreDs === 'prometheus' ? 'Prometheus' : 'Loki' }})</span></div>
            <textarea v-model="exploreExpr" class="gf-code" rows="3" spellcheck="false" :placeholder="exploreDs === 'prometheus' ? 'Enter a PromQL query… e.g. sum(rate(http_requests_total[5m])) by (instance)' : 'Enter a LogQL query… e.g. {host=&quot;api-2&quot;} |= &quot;error&quot;'" @keydown.ctrl.enter="runExplore" @keydown.shift.enter.prevent="runExplore"></textarea>
            <div class="gf-query__help">
              <span class="gf-muted">Shift+Enter to run.</span>
              <template v-if="exploreDs === 'prometheus'">
                <button v-for="ex in PROM_EXAMPLES" :key="ex" type="button" class="gf-chip" @click="exploreExpr = ex">{{ ex }}</button>
              </template>
              <template v-else>
                <button v-for="ex in LOKI_EXAMPLES" :key="ex" type="button" class="gf-chip" @click="exploreExpr = ex">{{ ex }}</button>
              </template>
            </div>
          </div>
          <p v-if="exploreError" class="gf-error">{{ exploreError }}</p>
          <div v-if="exploreSeries.length" class="gf-panel">
            <div class="gf-panel__head"><span>Graph</span></div>
            <TimeSeries :series="exploreSeries" unit="short" :height="260" legend-values />
          </div>
          <div v-if="exploreSeries.length" class="gf-panel">
            <div class="gf-panel__head"><span>Table</span></div>
            <table class="gf-table gf-table--panel">
              <thead><tr><th>Series</th><th>Last</th><th>Points</th></tr></thead>
              <tbody><tr v-for="s in exploreSeries" :key="s.name"><td><code>{{ s.name }}</code></td><td>{{ fmtUnit(s.values.length ? s.values[s.values.length - 1][1] : null, 'short', 4) }}</td><td>{{ s.values.length }}</td></tr></tbody>
            </table>
          </div>
          <div v-if="logLines.length" class="gf-panel">
            <div class="gf-panel__head"><span>Logs <span class="gf-muted">{{ logLines.length }} lines</span></span></div>
            <div class="gf-logs">
              <div v-for="(l, i) in logLines" :key="i" class="gf-log" :class="levelOf(l.msg)">
                <span class="gf-log__time">{{ l.time }}</span><span class="gf-log__labels">{{ l.labels }}</span><span class="gf-log__msg">{{ l.msg }}</span>
              </div>
            </div>
          </div>
          <div class="gf-panel">
            <div class="gf-panel__head"><span>Query history</span></div>
            <ul class="gf-history">
              <li v-for="(q, i) in queryHistory" :key="i" @click="exploreDs = 'prometheus'; exploreExpr = q.expr">
                <span class="gf-cell" :class="q.ok ? 'is-ok' : 'is-bad'">{{ q.ok ? q.rows + ' series' : 'error' }}</span><code>{{ q.expr }}</code>
              </li>
              <li v-if="!queryHistory.length" class="gf-muted">No queries yet.</li>
            </ul>
          </div>
        </section>

        <!-- ===== Alerting ===== -->
        <section v-else-if="page === 'alerting'" class="gf-page">
          <div class="gf-page-head"><h1 class="gf-h1">Alert rules</h1><p class="gf-muted">Rules that determine whether an alert will fire (data source-managed, Prometheus).</p></div>
          <div class="gf-tabs">
            <button type="button" :class="{ 'is-active': alertTab === 'rules' }" @click="alertTab = 'rules'">Alert rules</button>
            <button type="button" :class="{ 'is-active': alertTab === 'silences' }" @click="alertTab = 'silences'">Silences</button>
          </div>
          <template v-if="alertTab === 'rules'">
            <div v-for="g in ruleGroups" :key="g.name" class="gf-rulegroup">
              <div class="gf-rulegroup__head">📁 {{ g.file }} › {{ g.name }}</div>
              <table class="gf-table">
                <thead><tr><th>State</th><th>Name</th><th>Health</th><th>Summary</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="r in g.rules" :key="r.name">
                    <td><span class="gf-alert-state" :class="'is-' + ruleState(r)">{{ ruleStateLabel(r) }}</span></td>
                    <td><b>{{ r.name }}</b><div class="gf-muted gf-mono">{{ r.expr }}</div></td>
                    <td>{{ r.health }}</td><td class="gf-muted">{{ r.summary }}</td>
                    <td><button type="button" class="gf-btn gf-btn--sm" @click="explore(r.expr)">Explore</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="!ruleGroups.length" class="gf-muted">No alert rules are loaded. Write monitoring/rules/*.yml and run <code>prom reload</code>.</p>
          </template>
          <template v-else>
            <div class="gf-page-actions"><button type="button" class="gf-btn gf-btn--primary" @click="silenceOpen = true">New silence</button></div>
            <table class="gf-table">
              <thead><tr><th>State</th><th>Matchers</th><th>Comment</th><th></th></tr></thead>
              <tbody>
                <tr v-for="s in silences" :key="s.id">
                  <td><span class="gf-cell" :class="s.active ? 'is-ok' : 'is-muted'">{{ s.active ? 'Active' : 'Expired' }}</span></td>
                  <td class="gf-mono">{{ s.matchers }}</td><td>{{ s.comment }}</td>
                  <td><button v-if="s.active" type="button" class="gf-btn gf-btn--sm" @click="expire(s.id)">Unsilence</button></td>
                </tr>
                <tr v-if="!silences.length"><td colspan="4" class="gf-muted">No silences.</td></tr>
              </tbody>
            </table>
          </template>
        </section>

        <!-- Flashes -->
        <div class="gf-toasts" aria-live="polite">
          <div v-for="f in api.flashes.value" :key="f.id" class="gf-toast" :class="'is-' + f.type">
            <b>{{ f.title }}</b><span v-if="f.detail">{{ f.detail }}</span>
            <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">×</button>
          </div>
        </div>
      </main>
    </div>

    <!-- Import dashboard -->
    <div v-if="importOpen" class="gf-modal" role="dialog" aria-modal="true" aria-label="Import dashboard">
      <div class="gf-modal__card">
        <h2>Import dashboard</h2>
        <p class="gf-muted">Import a dashboard definition from the lab's <code>dashboards/</code> folder (provisioning).</p>
        <label class="gf-field">Dashboard file
          <select v-model="importFile" class="gf-input">
            <option value="" disabled>Choose a file…</option>
            <option v-for="f in dashboardFiles" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>
        <p v-if="!dashboardFiles.length" class="gf-muted">There is no file under dashboards/ yet. Write one in the Files tab first.</p>
        <div class="gf-modal__actions">
          <button type="button" class="gf-btn" @click="importOpen = false">Cancel</button>
          <button type="button" class="gf-btn gf-btn--primary" :disabled="!importFile || busy" @click="doImport">Import</button>
        </div>
      </div>
    </div>

    <!-- New silence -->
    <div v-if="silenceOpen" class="gf-modal" role="dialog" aria-modal="true" aria-label="New silence">
      <div class="gf-modal__card">
        <h2>Silence alert rule</h2>
        <label class="gf-field">Label matchers <input v-model="silenceMatchers" class="gf-input" placeholder='alertname=HighErrorRate severity=page' /></label>
        <label class="gf-field">Duration <input v-model="silenceDuration" class="gf-input" placeholder="1h" /></label>
        <label class="gf-field">Comment <input v-model="silenceComment" class="gf-input" placeholder="Why (required)" /></label>
        <div class="gf-modal__actions">
          <button type="button" class="gf-btn" @click="silenceOpen = false">Cancel</button>
          <button type="button" class="gf-btn gf-btn--primary" :disabled="!silenceMatchers.trim() || !silenceComment.trim() || busy" @click="addSilence">Save silence</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Grafana 11 over the ShopFront estate (app 11 `sim:sre`). Dashboards draw the
 * view's `series` (one hour, computed server-side so a refresh never moves the
 * scenario clock); Explore, imports and silences run the real CLI lines
 * (`promql --range`, `logcli query`, `grafana dashboard import`, `amtool`).
 */
import { computed, ref, watch } from 'vue';
import { cli, parseJson, pick, rows } from '@/utils/portalKit';
import TimeSeries from './TimeSeries.vue';
import { asSeries, fmtUnit, lastValue, num, PALETTE, str, thresholdColor, toPlot, type PlotSeries } from './sreKit';

const props = defineProps<{ view: Record<string, any>; api: any; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();
const api = props.api;


const MENU = [
    { page: 'home', label: 'Home', icon: '⌂' },
    { page: 'dashboards', label: 'Dashboards', icon: '▦' },
    { page: 'explore', label: 'Explore', icon: '🧭' },
    { page: 'alerting', label: 'Alerting', icon: '🔔' },
];
const RANGES = [{ min: 15, label: '15 minutes' }, { min: 30, label: '30 minutes' }, { min: 60, label: '1 hour' }];
const PROM_EXAMPLES = ['up', 'sum by (instance) (rate(http_requests_total[5m]))', 'node_load1', 'probe_success'];
const LOKI_EXAMPLES = ['{service="shopapi"} |= "error"', '{host="lb-1", service="nginx"}', '{host="api-2"}'];
const Q = {
    rpsByInstance: 'sum by (instance) (rate(http_requests_total{service="shopapi"}[5m]))',
    errorsByCode: 'sum by (code) (rate(http_requests_total{service="shopapi",code=~"5.."}[5m]))',
    p99: 'histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{service="shopapi"}[5m])))',
    errorRatio: 'sum(rate(http_requests_total{service="shopapi",code=~"5.."}[5m])) / sum(rate(http_requests_total{service="shopapi"}[5m]))',
};

const menuOpen = ref(true);
const page = ref<'home' | 'dashboards' | 'dashboard' | 'explore' | 'alerting'>('dashboard');
const dashId = ref('overview');
const range = ref(60);
const search = ref('');
const share = ref(false);
const instanceVar = ref('');
const importOpen = ref(false);
const importFile = ref('');
const silenceOpen = ref(false);
const silenceMatchers = ref('');
const silenceDuration = ref('1h');
const silenceComment = ref('');
const alertTab = ref<'rules' | 'silences'>('rules');
const exploreDs = ref<'prometheus' | 'loki'>('prometheus');
const exploreExpr = ref('');
const exploreSeries = ref<PlotSeries[]>([]);
const exploreError = ref('');
const logLines = ref<{ time: string; labels: string; msg: string }[]>([]);

const series = computed(() => pick<Record<string, any>>(props.view, 'series', {}));
const clock = computed(() => str(pick(props.view, 'overview.clock', '')));
const services = computed(() => rows<any>(props.view, 'services'));
const filteredServices = computed(() => services.value.filter(s => !instanceVar.value || s.instance === instanceVar.value));
const hosts = computed(() => rows<any>(props.view, 'hosts'));
const alerts = computed(() => rows<any>(props.view, 'alerts'));
const silences = computed(() => rows<any>(props.view, 'silences'));
const queryHistory = computed(() => rows<any>(props.view, 'queries').slice().reverse().slice(0, 15));
const dashboardFiles = computed(() => pick<string[]>(props.view, 'files.dashboards', []));
const importedRows = computed(() => rows<any>(props.view, 'dashboards'));
const importedDashboards = computed(() => [...new Set(importedRows.value.map(r => str(r.dashboard)))].filter(Boolean));

const instFilter = (s: { metric: Record<string, string> }) =>
    !instanceVar.value || (s.metric.instance || '').startsWith(instanceVar.value);
const rpsByInstance = computed(() => toPlot(asSeries(series.value.rps_by_instance).filter(instFilter), '{{instance}}'));
const errorsByCode = computed(() => toPlot(asSeries(series.value.errors_by_code), '{{code}}').map((s, i) => ({ ...s, color: ['#F2495C', '#FF780A', '#FADE2A'][i % 3] })));
const latency = computed(() => [
    ...toPlot(asSeries(series.value.p50), 'p50', 1000).map(s => ({ ...s, color: '#73BF69' })),
    ...toPlot(asSeries(series.value.p99), 'p99', 1000).map(s => ({ ...s, color: '#F2CC0C' })),
]);
const errorRatio = computed(() => toPlot(asSeries(series.value.error_ratio), 'error ratio', 100).map(s => ({ ...s, color: '#F2495C' })));
const load = computed(() => toPlot(asSeries(series.value.load), '{{instance}}'));
const memUsed = computed(() => toPlot(asSeries(series.value.mem_used), '{{instance}}'));
const diskUsed = computed(() => toPlot(asSeries(series.value.disk_used), '{{instance}}'));
const rss = computed(() => toPlot(asSeries(series.value.rss), '{{instance}}'));

function trim(list: PlotSeries[]): PlotSeries[] {
    const end = num(series.value.end) ?? 0;
    const from = end - range.value * 60;
    return list.map(s => ({ ...s, values: s.values.filter(p => p[0] >= from) }));
}

function spark(key: string, scale = 1) {
    const s = asSeries(series.value[key])[0];
    return s ? s.values.map(p => p[1] * scale) : [];
}
function sparkPath(values: number[]) {
    if (!values.length) return '';
    const lo = Math.min(...values); const hi = Math.max(...values);
    const span = hi - lo || 1;
    return values.map((v, i) => (i ? 'L' : 'M') + (i / Math.max(1, values.length - 1) * 100).toFixed(1) + ',' + (28 - (v - lo) / span * 26).toFixed(1)).join(' ');
}

const stats = computed(() => {
    const o = pick<Record<string, any>>(props.view, 'overview', {});
    const err = num(o.error_rate_pct); const p99 = num(o.p99_ms); const budget = num(o.budget_remaining_pct);
    const firing = num(o.firing_alerts) ?? 0; const up = str(o.probe) === 'OK';
    const bg = (c: string) => c === '#73BF69' ? '#1a7f37' : c === '#FF9830' ? '#b77d06' : c === '#F2495C' ? '#c4314b' : '#2c3235';
    return [
        { title: 'Request rate', text: fmtUnit(num(o.requests_per_s), 'reqps'), bg: '#1f60c4', expr: 'sum(rate(http_requests_total[5m]))', spark: spark('rps') },
        { title: 'Error rate', text: fmtUnit(err, 'percent'), bg: bg(thresholdColor(err, 0.5, 5)), expr: Q.errorRatio, spark: spark('error_ratio', 100) },
        { title: 'p99 latency', text: fmtUnit(p99, 'ms'), bg: bg(thresholdColor(p99, 300, 500)), expr: Q.p99, spark: spark('p99', 1000) },
        { title: 'Availability probe', text: up ? 'UP' : 'DOWN', bg: up ? '#1a7f37' : '#c4314b', expr: 'probe_success', spark: spark('probe') },
        { title: 'Error budget remaining', text: budget === null ? 'No SLO' : budget.toFixed(1) + '%', bg: budget === null ? '#2c3235' : bg(thresholdColor(budget, 50, 10, false)), expr: '', spark: [] },
        { title: 'Firing alerts', text: String(firing), bg: firing ? '#c4314b' : '#1a7f37', expr: 'ALERTS{alertstate="firing"}', spark: [] },
        { title: 'Version', text: str(o.version, '-'), bg: '#2c3235', expr: 'shopapi_build_info', spark: [] },
    ];
});

const dashList = computed(() => {
    const all = [
        { id: 'overview', title: 'Service overview', folder: 'ShopFront', tags: ['shopapi', 'golden-signals'] },
        { id: 'hosts', title: 'Node exporter - fleet', folder: 'ShopFront', tags: ['node', 'infrastructure'] },
        ...importedDashboards.value.map(d => ({ id: 'imported:' + d, title: d, folder: 'Imported', tags: ['provisioned'] })),
    ];
    const q = search.value.trim().toLowerCase();
    return q ? all.filter(d => d.title.toLowerCase().includes(q) || d.tags.some(t => t.includes(q))) : all;
});
const dashTitle = computed(() => dashId.value === 'overview' ? 'ShopFront / Service overview'
    : dashId.value === 'hosts' ? 'ShopFront / Node exporter - fleet' : dashId.value.replace(/^imported:/, ''));
const importedPanels = computed(() => importedRows.value.filter(r => 'imported:' + str(r.dashboard) === dashId.value));

const ruleGroups = computed(() => {
    const groups: Record<string, { name: string; file: string; rules: any[] }> = {};
    for (const r of rows<any>(props.view, 'rules')) {
        if (r.type && r.type !== 'alert' && r.type !== 'alerting') continue;
        const key = str(r.file) + '/' + str(r.group);
        (groups[key] ||= { name: str(r.group), file: str(r.file), rules: [] }).rules.push(r);
    }
    return Object.values(groups);
});
function ruleState(r: any) {
    const a = alerts.value.find(x => x.name === r.name);
    return a ? (a.silenced ? 'silenced' : a.state) : 'normal';
}
function ruleStateLabel(r: any) {
    const s = ruleState(r);
    return s === 'firing' ? 'Firing' : s === 'pending' ? 'Pending' : s === 'silenced' ? 'Silenced' : 'Normal';
}

const crumbs = computed(() => {
    if (page.value === 'dashboard') return [{ label: 'Dashboards', page: 'dashboards' }, { label: dashTitle.value, page: '' }];
    if (page.value === 'dashboards') return [{ label: 'Dashboards', page: '' }];
    if (page.value === 'explore') return [{ label: 'Explore', page: '' }];
    if (page.value === 'alerting') return [{ label: 'Alerting', page: '' }, { label: 'Alert rules', page: '' }];
    return [];
});

function go(p: string) { page.value = p as any; }
function openDash(id: string) { dashId.value = id; page.value = 'dashboard'; }

watch([page, dashId, range], () => {
    const base = 'http://grafana.shopfront.internal:3000';
    const url = page.value === 'dashboard' ? `${base}/d/${encodeURIComponent(dashId.value)}?orgId=1&from=now-${range.value}m&to=now`
        : page.value === 'explore' ? `${base}/explore?orgId=1&left=${exploreDs.value}`
        : page.value === 'alerting' ? `${base}/alerting/list` : page.value === 'dashboards' ? `${base}/dashboards` : `${base}/`;
    emit('location', url);
}, { immediate: true });

function explore(expr: string) {
    if (!expr) return;
    exploreDs.value = 'prometheus';
    exploreExpr.value = expr;
    page.value = 'explore';
    runExplore();
}

async function runExplore() {
    const expr = exploreExpr.value.trim();
    if (!expr) return;
    exploreError.value = '';
    if (exploreDs.value === 'prometheus') {
        logLines.value = [];
        const step = range.value <= 15 ? '30s' : '1m';
        const result = await api.exec(cli(['promql', `--range=${range.value}m`, `--step=${step}`, expr]), { quiet: true });
        if (!result.ok) { exploreError.value = String(result.error || result.output || 'Query failed'); exploreSeries.value = []; return; }
        const data = result.data || parseJson(result.output) || {};
        exploreSeries.value = toPlot(asSeries((data as any).result || []));
        if (!exploreSeries.value.length) exploreError.value = 'No data: the query matched no series.';
    } else {
        exploreSeries.value = [];
        const result = await api.exec(cli(['logcli', 'query', expr]), { quiet: true });
        if (!result.ok) { exploreError.value = String(result.error || result.output || 'Query failed'); logLines.value = []; return; }
        logLines.value = String(result.output || '').split('\n').filter(l => l && !l.startsWith('(no log')).map(l => {
            const m = /^(\S+ \S+) (\{[^}]*\}) (.*)$/.exec(l);
            return m ? { time: m[1], labels: m[2], msg: m[3] } : { time: '', labels: '', msg: l };
        }).reverse();
        if (!logLines.value.length) exploreError.value = 'No logs found for this query and time range.';
    }
}

function levelOf(msg: string) {
    return /error|fail|fatal|panic|refused|denied|5\d\d/i.test(msg) ? 'is-error' : /warn/i.test(msg) ? 'is-warn' : '';
}

async function doImport() {
    const result = await api.exec(cli(['grafana', 'dashboard', 'import', importFile.value]), { success: 'Dashboard imported' });
    if (result.ok) {
        importOpen.value = false;
        page.value = 'dashboards';
        importFile.value = '';
    }
}

async function addSilence() {
    const matchers = silenceMatchers.value.trim().split(/\s+/).filter(Boolean);
    const result = await api.exec(cli(['amtool', 'silence', 'add', ...matchers], {
        '--duration': silenceDuration.value.trim() || '1h', '--comment': silenceComment.value.trim(),
    }), { success: 'Silence created' });
    if (result.ok) { silenceOpen.value = false; silenceMatchers.value = ''; silenceComment.value = ''; alertTab.value = 'silences'; }
}

async function expire(id: string) {
    if (!window.confirm('Remove this silence? Matching alerts will notify again.')) return;
    await api.exec(cli(['amtool', 'silence', 'expire', id]), { success: 'Silence expired' });
}

void PALETTE; void lastValue;
</script>

<style scoped>
.gf {
    --gf-bg: #111217; --gf-canvas: #111217; --gf-panel: #181b1f; --gf-border: rgba(204, 204, 220, 0.12);
    --gf-text: #ccccdc; --gf-muted: rgba(204, 204, 220, 0.65); --gf-primary: #3d71d9; --gf-hover: rgba(204, 204, 220, 0.08);
    display: flex; flex-direction: column; height: 100%; min-height: 34rem; background: var(--gf-bg); color: var(--gf-text);
    font-family: Inter, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; position: relative;
}
.gf-top { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 10px; border-bottom: 1px solid var(--gf-border); background: #181b1f; flex: none; }
.gf-icon-btn { background: transparent; border: 0; color: var(--gf-text); width: 28px; height: 28px; border-radius: 4px; cursor: pointer; display: grid; place-items: center; font-size: 15px; }
.gf-icon-btn:hover { background: var(--gf-hover); }
.gf-logo { display: grid; place-items: center; }
.gf-crumbs { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; white-space: nowrap; }
.gf-crumbs button { background: none; border: 0; color: var(--gf-muted); cursor: pointer; font: inherit; padding: 2px 4px; border-radius: 3px; }
.gf-crumbs button:last-child { color: var(--gf-text); }
.gf-crumbs button:hover { background: var(--gf-hover); }
.gf-crumbs span { color: var(--gf-muted); }
.gf-search { margin-left: auto; display: flex; align-items: center; gap: 6px; background: #111217; border: 1px solid var(--gf-border); border-radius: 4px; padding: 0 8px; height: 28px; width: min(22rem, 34%); color: var(--gf-muted); }
.gf-search input { flex: 1; min-width: 0; background: transparent; border: 0; color: var(--gf-text); font: inherit; outline: none; }
.gf-search kbd { font-size: 10px; border: 1px solid var(--gf-border); border-radius: 3px; padding: 0 4px; }
.gf-top-actions { display: flex; align-items: center; gap: 4px; }
.gf-avatar { width: 24px; height: 24px; border-radius: 50%; background: #8f4ad3; color: #fff; display: grid; place-items: center; font-size: 10px; font-weight: 700; }
.gf-body { flex: 1; display: flex; min-height: 0; }
.gf-menu { width: 200px; flex: none; border-right: 1px solid var(--gf-border); background: #181b1f; padding: 8px 6px; display: flex; flex-direction: column; gap: 2px; }
.gf-menu__item { display: flex; align-items: center; gap: 10px; background: transparent; border: 0; color: var(--gf-text); text-align: left; padding: 7px 10px; border-radius: 4px; cursor: pointer; font: inherit; }
.gf-menu__item:hover { background: var(--gf-hover); }
.gf-menu__item.is-active { background: rgba(61, 113, 217, 0.16); box-shadow: inset 3px 0 0 #ff8833; }
.gf-menu__ico { width: 18px; text-align: center; opacity: 0.85; }
.gf-main { flex: 1; min-width: 0; overflow: auto; position: relative; }
.gf-page { padding: 16px 20px 40px; }
.gf-page--dash { padding: 10px 14px 40px; }
.gf-h1 { font-size: 22px; font-weight: 400; margin: 0 0 4px; color: var(--gf-text); }
.gf-page-head { margin-bottom: 14px; position: relative; }
.gf-page-actions { display: flex; justify-content: flex-end; gap: 8px; margin: 8px 0; }
.gf-muted { color: var(--gf-muted); }
.gf-mono { font-family: 'Roboto Mono', ui-monospace, monospace; font-size: 11.5px; }
.gf-right { margin-left: auto; }
.gf-btn { background: #22252b; color: var(--gf-text); border: 1px solid var(--gf-border); border-radius: 4px; height: 30px; padding: 0 12px; cursor: pointer; font: inherit; }
.gf-btn:hover { background: #2c3035; }
.gf-btn--primary { background: var(--gf-primary); border-color: var(--gf-primary); color: #fff; }
.gf-btn--primary:hover { background: #3062c8; }
.gf-btn--sm { height: 24px; padding: 0 8px; font-size: 12px; }
.gf-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.gf-input { background: #111217; color: var(--gf-text); border: 1px solid var(--gf-border); border-radius: 4px; height: 32px; padding: 0 8px; font: inherit; width: 100%; }
.gf-input--ds { width: auto; min-width: 10rem; }
.gf-home-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr)); gap: 12px; margin-top: 12px; }
.gf-card { background: var(--gf-panel); border: 1px solid var(--gf-border); border-radius: 4px; padding: 14px; }
.gf-card h3 { font-size: 14px; margin: 0 0 10px; font-weight: 500; }
.gf-link { display: block; background: none; border: 0; color: #6e9fff; cursor: pointer; padding: 4px 0; font: inherit; text-align: left; }
.gf-ds-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.gf-ds-dot.prom { background: #e6522c; } .gf-ds-dot.loki { background: #f2cc0c; } .gf-ds-dot.am { background: #73bf69; }
.gf-filterbar { margin-bottom: 10px; }
.gf-table { width: 100%; border-collapse: collapse; }
.gf-table th { text-align: left; font-weight: 500; color: var(--gf-muted); padding: 8px; border-bottom: 1px solid var(--gf-border); font-size: 12px; }
.gf-table td { padding: 8px; border-bottom: 1px solid var(--gf-border); vertical-align: top; }
.gf-table tbody tr:hover td { background: var(--gf-hover); cursor: pointer; }
.gf-table--panel tbody tr:hover td { cursor: default; }
.gf-folder td { color: var(--gf-muted); font-weight: 500; }
.gf-dash-name { color: var(--gf-text); }
.gf-tag { display: inline-block; background: #1f60c4; color: #fff; border-radius: 3px; padding: 0 6px; margin-right: 4px; font-size: 11px; }
.gf-dash-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 8px; }
.gf-dash-title { font-size: 16px; font-weight: 500; margin: 0; flex: 1; min-width: 12rem; }
.gf-star { color: var(--gf-muted); margin-left: 6px; }
.gf-dash-tools { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.gf-picker { display: flex; align-items: center; gap: 6px; background: #22252b; border: 1px solid var(--gf-border); border-radius: 4px; height: 30px; padding: 0 8px; }
.gf-picker select { background: transparent; color: var(--gf-text); border: 0; font: inherit; }
.gf-share { margin: 0 0 8px; font-size: 12px; }
.gf-share code { background: #22252b; padding: 2px 6px; border-radius: 3px; }
.gf-vars { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
.gf-vars label { display: flex; align-items: center; gap: 0; font-size: 12px; }
.gf-vars label > select { margin-left: 0; }
.gf-vars label::before { content: ''; }
.gf-vars select { background: #111217; color: var(--gf-text); border: 1px solid var(--gf-border); border-left: 0; height: 28px; padding: 0 6px; font: inherit; border-radius: 0 3px 3px 0; }
.gf-vars label { background: #22252b; border: 1px solid var(--gf-border); border-radius: 3px; padding-left: 8px; color: #6e9fff; }
.gf-row-title { font-size: 14px; font-weight: 500; margin: 14px 0 8px; display: flex; gap: 10px; }
.gf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.5rem), 1fr)); gap: 8px; margin-bottom: 8px; }
.gf-grid--2 { grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr)); }
.gf-grid--hosts { grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr)); }
.gf-panel { background: var(--gf-panel); border: 1px solid var(--gf-border); border-radius: 2px; padding: 6px 8px 8px; min-width: 0; display: flex; flex-direction: column; }
.gf-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 12.5px; font-weight: 500; margin-bottom: 6px; min-height: 18px; }
.gf-panel__head span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gf-panel__menu { background: transparent; border: 0; color: var(--gf-muted); cursor: pointer; opacity: 0; font-size: 14px; }
.gf-panel:hover .gf-panel__menu { opacity: 1; }
.gf-panel--stat { padding: 6px; }
.gf-stat { position: relative; border-radius: 2px; min-height: 78px; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; color: #fff; padding: 6px; }
.gf-stat--plain { background: transparent; color: var(--gf-text); align-items: flex-start; }
.gf-stat__value { font-size: 26px; font-weight: 500; z-index: 1; text-align: center; }
.gf-stat__value--sm { font-size: 17px; }
.gf-stat__sub { font-size: 11px; opacity: 0.85; z-index: 1; text-align: center; }
.gf-stat__spark { position: absolute; inset: auto 0 0 0; width: 100%; height: 40%; }
.gf-stat__expr { font-size: 10.5px; color: var(--gf-muted); margin-top: 6px; word-break: break-all; }
.gf-cell { display: inline-block; padding: 1px 8px; border-radius: 2px; font-size: 12px; }
.gf-cell.is-ok { background: rgba(115, 191, 105, 0.18); color: #73bf69; }
.gf-cell.is-bad { background: rgba(242, 73, 92, 0.18); color: #ff7383; }
.gf-cell.is-muted { background: rgba(204, 204, 220, 0.1); color: var(--gf-muted); }
.gf-gauge { position: relative; background: rgba(204, 204, 220, 0.08); height: 18px; border-radius: 2px; min-width: 6rem; }
.gf-gauge i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #37872d, #73bf69); border-radius: 2px; }
.gf-gauge span { position: relative; padding-left: 6px; font-size: 11.5px; line-height: 18px; }
.gf-alertlist { list-style: none; margin: 0; padding: 0; }
.gf-alertlist li { display: flex; gap: 8px; align-items: center; padding: 6px 4px; border-bottom: 1px solid var(--gf-border); flex-wrap: wrap; }
.gf-alert-state { display: inline-block; min-width: 4.6rem; text-align: center; border-radius: 2px; padding: 1px 6px; font-size: 11.5px; font-weight: 500; }
.gf-alert-state.is-firing { background: #d10e5c; color: #fff; }
.gf-alert-state.is-pending { background: #ff9830; color: #000; }
.gf-alert-state.is-normal { background: rgba(115, 191, 105, 0.2); color: #73bf69; }
.gf-alert-state.is-silenced { background: #5a5f66; color: #fff; }
.gf-explore-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
.gf-explore-bar .gf-h1 { margin-right: auto; }
.gf-query { background: var(--gf-panel); border: 1px solid var(--gf-border); border-radius: 2px; padding: 8px; margin-bottom: 10px; }
.gf-query__label { color: #6e9fff; font-weight: 500; margin-bottom: 6px; }
.gf-code { width: 100%; background: #111217; color: #ccccdc; border: 1px solid var(--gf-border); border-radius: 2px; font-family: 'Roboto Mono', ui-monospace, monospace; font-size: 12.5px; padding: 8px; resize: vertical; }
.gf-query__help { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 6px; }
.gf-chip { background: #22252b; color: var(--gf-text); border: 1px solid var(--gf-border); border-radius: 10px; padding: 1px 8px; font-size: 11px; cursor: pointer; font-family: 'Roboto Mono', monospace; }
.gf-error { color: #ff7383; background: rgba(242, 73, 92, 0.1); border: 1px solid rgba(242, 73, 92, 0.3); padding: 8px; border-radius: 2px; }
.gf-logs { font-family: 'Roboto Mono', ui-monospace, monospace; font-size: 11.5px; max-height: 22rem; overflow: auto; }
.gf-log { display: flex; gap: 10px; padding: 2px 4px 2px 8px; border-left: 3px solid #5794f2; white-space: pre; }
.gf-log.is-error { border-left-color: #f2495c; }
.gf-log.is-warn { border-left-color: #ff9830; }
.gf-log__time { color: var(--gf-muted); }
.gf-log__labels { color: #6e9fff; }
.gf-history { list-style: none; padding: 0; margin: 0; }
.gf-history li { display: flex; gap: 8px; padding: 5px 4px; border-bottom: 1px solid var(--gf-border); cursor: pointer; align-items: center; }
.gf-history li:hover { background: var(--gf-hover); }
.gf-history code { font-size: 11.5px; word-break: break-all; }
.gf-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--gf-border); margin-bottom: 12px; }
.gf-tabs button { background: none; border: 0; color: var(--gf-muted); padding: 8px 14px; cursor: pointer; font: inherit; border-bottom: 2px solid transparent; }
.gf-tabs button.is-active { color: var(--gf-text); border-bottom-color: #ff8833; }
.gf-rulegroup { margin-bottom: 14px; }
.gf-rulegroup__head { font-weight: 500; margin-bottom: 4px; }
.gf-modal { position: absolute; inset: 0; z-index: 20; background: rgba(0, 0, 0, 0.6); display: grid; place-items: center; padding: 16px; }
.gf-modal__card { background: #181b1f; border: 1px solid var(--gf-border); border-radius: 4px; padding: 18px 20px; width: min(32rem, 100%); }
.gf-modal__card h2 { font-size: 18px; font-weight: 400; margin: 0 0 8px; }
.gf-field { display: flex; flex-direction: column; gap: 4px; margin: 10px 0; font-size: 12px; color: var(--gf-muted); }
.gf-modal__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.gf-toasts { position: absolute; right: 12px; top: 12px; display: flex; flex-direction: column; gap: 8px; z-index: 30; }
.gf-toast { background: #22252b; border-left: 4px solid #5794f2; border-radius: 2px; padding: 8px 30px 8px 10px; position: relative; max-width: 22rem; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); }
.gf-toast.is-success { border-left-color: #1a7f37; }
.gf-toast.is-error { border-left-color: #d10e5c; }
.gf-toast button { position: absolute; right: 6px; top: 4px; background: none; border: 0; color: var(--gf-muted); cursor: pointer; font-size: 16px; }
@container sl-portal (max-width: 760px) {
    .gf-menu { display: none; }
    .gf-search { display: none; }
}
</style>
