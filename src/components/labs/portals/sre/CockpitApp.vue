<template>
  <div class="ck" dir="ltr">
    <header class="ck-mast">
      <span class="ck-brand">
        <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="#0066cc"/><path d="M7 12h10M12 7v10" stroke="#fff" stroke-width="2"/></svg>
        <b>Cockpit</b>
      </span>
      <div class="ck-hostswitch">
        <button type="button" class="ck-hostswitch__btn" @click="switcher = !switcher">
          <span class="ck-dot" :class="'is-' + (hostRow ? hostRow.status : 'healthy')"></span>
          sre@<b>{{ host || 'fleet' }}</b> ▾
        </button>
        <div v-if="switcher" class="ck-hostswitch__menu">
          <button type="button" @click="pickHost('')">⌂ All hosts (fleet)</button>
          <button v-for="h in hosts" :key="h.host" type="button" @click="pickHost(h.host)">
            <span class="ck-dot" :class="'is-' + h.status"></span>{{ h.host }} <span class="ck-muted">{{ h.ip }}</span>
          </button>
        </div>
      </div>
      <span class="ck-mast__spacer"></span>
      <span class="ck-admin">🔓 Administrative access</span>
      <span class="ck-mast__item">Help</span>
      <span class="ck-mast__item">Session ▾</span>
    </header>

    <div class="ck-body">
      <nav v-if="host" class="ck-nav" aria-label="Host">
        <input v-model="navSearch" class="ck-nav__search" type="search" placeholder="Search" aria-label="Search pages" />
        <button v-for="p in visibleNav" :key="p.id" type="button" class="ck-nav__item" :class="{ 'is-active': page === p.id }" @click="go(p.id)">{{ p.label }}</button>
      </nav>

      <main class="ck-main">
        <!-- ===== Fleet ===== -->
        <section v-if="!host">
          <h1 class="ck-h1">Hosts</h1>
          <p class="ck-muted">ShopFront production estate. Select a host to manage it.</p>
          <div class="ck-fleet">
            <button v-for="h in hosts" :key="h.host" type="button" class="ck-card ck-hostcard" @click="pickHost(h.host)">
              <div class="ck-hostcard__top"><span class="ck-dot" :class="'is-' + h.status"></span><b>{{ h.host }}</b><span class="ck-muted">{{ h.ip }}</span></div>
              <div class="ck-muted ck-small">{{ h.role }}</div>
              <div class="ck-meter"><span>Memory</span><div class="ck-bar"><i :style="{ width: h.mem_pct + '%', background: barColor(h.mem_pct) }"></i></div><span>{{ h.mem_pct }}%</span></div>
              <div class="ck-meter"><span>Disk</span><div class="ck-bar"><i :style="{ width: h.disk_pct + '%', background: barColor(h.disk_pct) }"></i></div><span>{{ h.disk_pct }}%</span></div>
              <div v-if="h.failed_units.length || h.issues.length" class="ck-alert ck-alert--warn ck-small">
                <span v-if="h.failed_units.length">{{ h.failed_units.length }} failed service{{ h.failed_units.length > 1 ? 's' : '' }}: {{ h.failed_units.join(', ') }}</span>
                <span v-for="i in h.issues" :key="i">{{ ISSUE[i] || i }}</span>
              </div>
            </button>
          </div>
        </section>

        <!-- ===== Overview ===== -->
        <section v-else-if="page === 'overview' && hostRow">
          <h1 class="ck-h1">{{ host }} <span class="ck-muted ck-h1__sub">{{ hostRow.role }}</span></h1>
          <div class="ck-cards">
            <div class="ck-card">
              <h2 class="ck-card__title">Health</h2>
              <ul class="ck-health">
                <li v-if="!hostRow.failed_units.length && !hostRow.issues.length" class="is-ok">✔ System is up to date and healthy</li>
                <li v-for="u in hostRow.failed_units" :key="u" class="is-bad">⚠ <button type="button" class="ck-link" @click="openUnit(u)">{{ u }}.service</button> failed to start</li>
                <li v-for="i in hostRow.issues" :key="i" class="is-warn">⚠ {{ ISSUE[i] || i }}</li>
              </ul>
            </div>
            <div class="ck-card">
              <h2 class="ck-card__title">Usage</h2>
              <div class="ck-meter ck-meter--lg"><span>CPU</span><div class="ck-bar"><i :style="{ width: cpuPct + '%', background: barColor(cpuPct) }"></i></div><span>{{ cpuPct }}% of {{ spec.cpus }} CPUs</span></div>
              <div class="ck-meter ck-meter--lg"><span>Memory</span><div class="ck-bar"><i :style="{ width: hostRow.mem_pct + '%', background: barColor(hostRow.mem_pct) }"></i></div><span>{{ (spec.mem_gib * hostRow.mem_pct / 100).toFixed(1) }} / {{ spec.mem_gib }} GiB</span></div>
              <div class="ck-meter ck-meter--lg"><span>Disk /</span><div class="ck-bar"><i :style="{ width: hostRow.disk_pct + '%', background: barColor(hostRow.disk_pct) }"></i></div><span>{{ (spec.disk_gib * hostRow.disk_pct / 100).toFixed(1) }} / {{ spec.disk_gib }} GiB</span></div>
              <button type="button" class="ck-link" @click="go('metrics')">View metrics and history</button>
            </div>
            <div class="ck-card">
              <h2 class="ck-card__title">System information</h2>
              <dl class="ck-dl"><dt>Model</dt><dd>KVM virtual machine</dd><dt>Operating system</dt><dd>Ubuntu 22.04.4 LTS</dd><dt>IP address</dt><dd>{{ hostRow.ip }}</dd><dt>Role</dt><dd>{{ hostRow.role }}</dd><dt v-if="hostRow.version">shopapi</dt><dd v-if="hostRow.version">{{ hostRow.version }}</dd></dl>
            </div>
            <div class="ck-card">
              <h2 class="ck-card__title">Configuration</h2>
              <dl class="ck-dl"><dt>Hostname</dt><dd>{{ host }}</dd><dt>System time</dt><dd>{{ clock }}</dd><dt>Domain</dt><dd>shopfront.internal</dd></dl>
            </div>
          </div>
        </section>

        <!-- ===== Metrics ===== -->
        <section v-else-if="page === 'metrics'">
          <h1 class="ck-h1">Metrics and history</h1>
          <div class="ck-cards ck-cards--2">
            <div class="ck-card"><h2 class="ck-card__title">Load (1m)</h2><TimeSeries :series="hostSeries('load')" theme="light" unit="short" :height="180" :legend="false" /></div>
            <div class="ck-card"><h2 class="ck-card__title">Memory used %</h2><TimeSeries :series="hostSeries('mem_used')" theme="light" unit="percent" :height="180" :max="100" :legend="false" /></div>
            <div class="ck-card"><h2 class="ck-card__title">Disk used %</h2><TimeSeries :series="hostSeries('disk_used')" theme="light" unit="percent" :height="180" :max="100" :legend="false" /></div>
          </div>
        </section>

        <!-- ===== Services ===== -->
        <section v-else-if="page === 'services'">
          <template v-if="!unit">
            <h1 class="ck-h1">Services</h1>
            <div class="ck-toolbar">
              <input v-model="unitFilter" class="ck-input" placeholder="Filter by name" aria-label="Filter services" />
              <select v-model="unitState" class="ck-input ck-input--sm" aria-label="Active state">
                <option value="">All</option><option value="active">Running</option><option value="failed">Failed</option><option value="inactive">Not running</option>
              </select>
            </div>
            <table class="ck-table">
              <thead><tr><th>Unit</th><th>State</th><th>Since</th></tr></thead>
              <tbody>
                <tr v-for="u in hostUnits" :key="u.unit" class="is-link" @click="openUnit(u.unit)">
                  <td><b>{{ u.unit }}.service</b></td>
                  <td><span class="ck-state" :class="'is-' + u.state">{{ stateLabel(u.state) }}</span></td>
                  <td class="ck-muted">{{ u.since }}</td>
                </tr>
                <tr v-if="!hostUnits.length"><td colspan="3" class="ck-muted">No matching services.</td></tr>
              </tbody>
            </table>
          </template>
          <template v-else>
            <button type="button" class="ck-link" @click="unit = ''">‹ Services</button>
            <div class="ck-unit-head">
              <h1 class="ck-h1">{{ unit }}.service</h1>
              <span class="ck-state" :class="'is-' + unitRow.state">{{ stateLabel(unitRow.state) }}</span>
              <span class="ck-mast__spacer"></span>
              <div class="ck-kebab">
                <button type="button" class="ck-btn ck-btn--primary" :disabled="busy" @click="systemctl('restart')">Restart</button>
                <button type="button" class="ck-btn" :disabled="busy || unitRow.state === 'active'" @click="systemctl('start')">Start</button>
                <button type="button" class="ck-btn ck-btn--danger" :disabled="busy || unitRow.state !== 'active'" @click="systemctl('stop')">Stop</button>
                <button type="button" class="ck-btn" :disabled="busy" @click="systemctl('daemon-reload')">Reload units</button>
              </div>
            </div>
            <div class="ck-card">
              <h2 class="ck-card__title">Status</h2>
              <pre class="ck-pre">{{ unitStatus || 'Loading…' }}</pre>
            </div>
            <div class="ck-card">
              <h2 class="ck-card__title">Service logs</h2>
              <div class="ck-journal">
                <div v-for="(l, i) in unitLog" :key="i" class="ck-jl" :class="levelOf(l)">{{ l }}</div>
                <p v-if="!unitLog.length" class="ck-muted">No log entries.</p>
              </div>
            </div>
          </template>
        </section>

        <!-- ===== Logs ===== -->
        <section v-else-if="page === 'logs'">
          <h1 class="ck-h1">Logs</h1>
          <div class="ck-toolbar">
            <select v-model="logPriority" class="ck-input ck-input--sm" aria-label="Priority"><option value="">Everything</option><option value="err">Error and above</option></select>
            <select v-model="logUnit" class="ck-input ck-input--sm" aria-label="Service"><option value="">All services</option><option v-for="u in allHostUnits" :key="u.unit" :value="u.unit">{{ u.unit }}</option></select>
            <input v-model="logGrep" class="ck-input" placeholder="Search (grep)" aria-label="Search logs" />
            <button type="button" class="ck-btn ck-btn--primary" :disabled="busy" @click="loadLogs">Show</button>
          </div>
          <div class="ck-card ck-journal ck-journal--tall">
            <div v-for="(l, i) in logLines" :key="i" class="ck-jl" :class="levelOf(l)">{{ l }}</div>
            <p v-if="!logLines.length" class="ck-muted">{{ logsLoaded ? 'No entries match.' : 'Press Show to read the journal.' }}</p>
          </div>
        </section>

        <!-- ===== Storage ===== -->
        <section v-else-if="page === 'storage' && hostRow">
          <h1 class="ck-h1">Storage</h1>
          <div class="ck-card">
            <h2 class="ck-card__title">Filesystems</h2>
            <table class="ck-table"><thead><tr><th>Mount point</th><th>Type</th><th>Size</th><th>Usage</th></tr></thead>
              <tbody><tr><td>/</td><td>ext4</td><td>{{ spec.disk_gib }} GiB</td><td><div class="ck-meter"><div class="ck-bar"><i :style="{ width: hostRow.disk_pct + '%', background: barColor(hostRow.disk_pct) }"></i></div><span>{{ hostRow.disk_pct }}%</span></div></td></tr></tbody>
            </table>
            <div class="ck-toolbar ck-toolbar--top">
              <button type="button" class="ck-btn" :disabled="busy" @click="runCmd('df -h')">df -h</button>
              <button type="button" class="ck-btn" :disabled="busy" @click="runCmd('sudo du -xh --max-depth=2 /var | sort -h | tail -n 10')">Largest directories in /var</button>
              <button type="button" class="ck-btn" :disabled="busy" @click="runCmd('sudo lsof +L1')">Deleted files still open</button>
            </div>
          </div>
          <pre v-if="cmdOut" class="ck-pre ck-pre--dark">{{ cmdOut }}</pre>
        </section>

        <!-- ===== Networking ===== -->
        <section v-else-if="page === 'networking' && hostRow">
          <h1 class="ck-h1">Networking</h1>
          <div class="ck-card">
            <h2 class="ck-card__title">Interfaces</h2>
            <table class="ck-table"><thead><tr><th>Name</th><th>IP address</th><th>State</th></tr></thead><tbody><tr><td>ens3</td><td>{{ hostRow.ip }}/24</td><td><span class="ck-state is-active">Up</span></td></tr></tbody></table>
            <div class="ck-toolbar ck-toolbar--top">
              <button type="button" class="ck-btn" :disabled="busy" @click="runCmd('sudo ss -tlnp')">Listening ports</button>
              <button type="button" class="ck-btn" :disabled="busy" @click="runCmd('sudo ufw status verbose')">Firewall</button>
              <button type="button" class="ck-btn" :disabled="busy" @click="runCmd('cat /etc/resolv.conf')">DNS (resolv.conf)</button>
            </div>
          </div>
          <pre v-if="cmdOut" class="ck-pre ck-pre--dark">{{ cmdOut }}</pre>
        </section>

        <!-- ===== Terminal ===== -->
        <section v-else-if="page === 'terminal'" class="ck-term-page">
          <h1 class="ck-h1">Terminal</h1>
          <div class="ck-term" @click="termInput?.focus()">
            <div v-for="(e, i) in termLog" :key="i"><div class="ck-term__cmd">sre@{{ host }}:~$ {{ e.cmd }}</div><div class="ck-term__out" :class="{ 'is-err': !e.ok }">{{ e.out }}</div></div>
            <div class="ck-term__line"><span>sre@{{ host }}:~$&nbsp;</span><input ref="termInput" v-model="termLine" spellcheck="false" aria-label="Command" @keydown.enter="runTerm" /></div>
          </div>
          <p class="ck-muted ck-small">Each line runs on {{ host }} as <b>sre</b> (prefix <code>sudo</code> for root), exactly like <code>ssh {{ host }} '…'</code> in the SRE Console.</p>
        </section>
      </main>
    </div>

    <div class="ck-toasts" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="ck-toast" :class="'is-' + f.type">
        <b>{{ f.title }}</b><span v-if="f.detail">{{ f.detail }}</span>
        <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Cockpit (the Linux web console) over the six ShopFront servers. Every action
 * is a one-shot `ssh HOST <command>` - systemctl, journalctl, df, du, lsof, ss,
 * ufw - run by the same host model the SRE Console's ssh sessions use, so a
 * restart that fails here fails there for the same reason.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import TimeSeries from './TimeSeries.vue';
import { asSeries, str, toPlot } from './sreKit';

const props = defineProps<{ view: Record<string, any>; api: any; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();
const api = props.api;

const NAV = [
    { id: 'overview', label: 'Overview' }, { id: 'metrics', label: 'Metrics' }, { id: 'logs', label: 'Logs' },
    { id: 'storage', label: 'Storage' }, { id: 'networking', label: 'Networking' }, { id: 'services', label: 'Services' },
    { id: 'terminal', label: 'Terminal' },
];
const ISSUE: Record<string, string> = {
    disk: 'Root filesystem is over 90% full', cpu: 'CPU is saturated by a runaway process',
    dns: 'Name resolution is failing (resolver)', bind: 'Redis is not listening on the network',
    port: 'Port 8080 is taken by another process', memory: 'Memory pressure: the service is close to its limit',
    tls: 'The TLS certificate being served has expired',
};

const host = ref('');
const page = ref('overview');
const switcher = ref(false);
const navSearch = ref('');
const unit = ref('');
const unitFilter = ref('');
const unitState = ref('');
const unitStatus = ref('');
const unitLog = ref<string[]>([]);
const logPriority = ref('');
const logUnit = ref('');
const logGrep = ref('');
const logLines = ref<string[]>([]);
const logsLoaded = ref(false);
const cmdOut = ref('');
const termLine = ref('');
const termLog = ref<{ cmd: string; out: string; ok: boolean }[]>([]);
const termInput = ref<HTMLInputElement | null>(null);

const hosts = computed(() => rows<any>(props.view, 'hosts').map(h => ({
    ...h, failed_units: Array.isArray(h.failed_units) ? h.failed_units : [], issues: Array.isArray(h.issues) ? h.issues : [],
})));
const hostRow = computed(() => hosts.value.find(h => h.host === host.value) || null);
const spec = computed(() => rows<any>(props.view, 'host_specs').find(s => s.host === host.value) || { cpus: 2, mem_gib: 4, disk_gib: 20 });
const clock = computed(() => str(pick(props.view, 'overview.clock', '')));
const allHostUnits = computed(() => rows<any>(props.view, 'units').filter(u => u.host === host.value));
const hostUnits = computed(() => allHostUnits.value.filter(u => (!unitFilter.value || String(u.unit).includes(unitFilter.value.trim()))
    && (!unitState.value || (unitState.value === 'inactive' ? !['active', 'failed'].includes(u.state) : u.state === unitState.value))));
const unitRow = computed(() => allHostUnits.value.find(u => u.unit === unit.value) || { state: 'unknown', since: '' });
const visibleNav = computed(() => NAV.filter(p => !navSearch.value || p.label.toLowerCase().includes(navSearch.value.toLowerCase())));
const cpuPct = computed(() => {
    const s = asSeries(pick(props.view, 'series.load', [])).find(x => (x.metric.instance || '').startsWith(host.value + ':'));
    const v = s && s.values.length ? s.values[s.values.length - 1][1] : 0;
    return Math.min(100, Math.round(100 * v / Math.max(1, Number(spec.value.cpus) || 1)));
});

watch([host, page, unit], () => {
    const base = 'https://' + (host.value || 'mon-1') + '.shopfront.internal:9090';
    emit('location', host.value ? `${base}/system${page.value === 'overview' ? '' : '/' + page.value}${unit.value ? '#/' + unit.value + '.service' : ''}` : `${base}/dashboard`);
}, { immediate: true });

function pickHost(h: string) { host.value = h; switcher.value = false; page.value = 'overview'; unit.value = ''; cmdOut.value = ''; logLines.value = []; logsLoaded.value = false; termLog.value = []; }
function go(p: string) { page.value = p; unit.value = ''; cmdOut.value = ''; if (p === 'terminal') nextTick(() => termInput.value?.focus()); }
function barColor(v: number) { return v >= 90 ? '#c9190b' : v >= 75 ? '#f0ab00' : '#0066cc'; }
function stateLabel(s: string) { return s === 'active' ? 'Running' : s === 'failed' ? 'Failed to start' : s === 'inactive' ? 'Not running' : s; }
function levelOf(line: string) { return /error|fail|fatal|denied|refused|exited|emerg|crit|panic|no space/i.test(line) ? 'is-error' : /warn/i.test(line) ? 'is-warn' : ''; }
function hostSeries(key: string) {
    return toPlot(asSeries(pick(props.view, 'series.' + key, [])).filter(s => (s.metric.instance || '').startsWith(host.value + ':')), host.value);
}

async function ssh(remote: string[], quietly = true) {
    return api.exec(cli(['ssh', host.value, ...remote]), { quiet: quietly });
}
function outOf(result: any) { return String(result.ok ? result.output : [result.output, result.error].filter(Boolean).join('\n')) || ''; }

async function openUnit(name: string) {
    page.value = 'services';
    unit.value = name;
    unitStatus.value = '';
    unitLog.value = [];
    const status = await ssh(['systemctl', 'status', name]);
    unitStatus.value = outOf(status) || '(no output)';
    const log = await ssh(['journalctl', '-u', name, '-n', '30']);
    unitLog.value = outOf(log).split('\n').filter(Boolean);
}
async function systemctl(verb: string) {
    const remote = verb === 'daemon-reload' ? ['sudo', 'systemctl', 'daemon-reload'] : ['sudo', 'systemctl', verb, unit.value];
    const result = await ssh(remote, true);
    if (result.ok) api.notify('success', verb === 'daemon-reload' ? 'Units reloaded' : `${unit.value}.service: ${verb} succeeded`);
    else api.notify('error', `${verb} failed`, outOf(result).split('\n')[0]);
    if (verb !== 'daemon-reload') await openUnit(unit.value);
}
async function loadLogs() {
    const remote = ['journalctl', '-n', '100'];
    if (logUnit.value) remote.push('-u', logUnit.value);
    if (logPriority.value) remote.push('-p', logPriority.value);
    if (logGrep.value.trim()) remote.push('-g', logGrep.value.trim());
    const result = await ssh(remote);
    logsLoaded.value = true;
    logLines.value = outOf(result).split('\n').filter(Boolean).reverse();
}
async function runCmd(line: string) {
    const result = await api.exec(cli(['ssh', host.value, line]), { quiet: true });
    cmdOut.value = '$ ' + line + '\n' + (outOf(result) || '(no output)');
}
async function runTerm() {
    const line = termLine.value.trim();
    if (!line) return;
    termLine.value = '';
    if (line === 'clear') { termLog.value = []; return; }
    const result = await api.exec(cli(['ssh', host.value, line]), { quiet: true, unlogged: false });
    termLog.value = [...termLog.value, { cmd: line, out: outOf(result), ok: !!result.ok }].slice(-60);
    await nextTick();
    termInput.value?.scrollIntoView({ block: 'nearest' });
}
</script>

<style scoped>
.ck { display: flex; flex-direction: column; height: 100%; min-height: 34rem; background: #f0f0f0; color: #151515; font-family: 'Red Hat Text', 'RedHatText', Overpass, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; position: relative; }
.ck-mast { display: flex; align-items: center; gap: 14px; height: 48px; background: #151515; color: #fff; padding: 0 14px; flex: none; }
.ck-brand { display: flex; align-items: center; gap: 6px; font-size: 15px; }
.ck-hostswitch { position: relative; }
.ck-hostswitch__btn { background: #212427; color: #fff; border: 0; border-radius: 3px; padding: 6px 10px; font: inherit; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.ck-hostswitch__menu { position: absolute; top: 110%; left: 0; z-index: 10; background: #fff; color: #151515; border-radius: 3px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3); min-width: 16rem; padding: 6px 0; display: flex; flex-direction: column; }
.ck-hostswitch__menu button { background: none; border: 0; text-align: left; padding: 7px 14px; cursor: pointer; font: inherit; display: flex; align-items: center; gap: 8px; }
.ck-hostswitch__menu button:hover { background: #f0f0f0; }
.ck-mast__spacer { flex: 1; }
.ck-admin { font-size: 12.5px; color: #d2d2d2; }
.ck-mast__item { font-size: 13px; color: #d2d2d2; }
.ck-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: none; }
.ck-dot.is-healthy { background: #3e8635; } .ck-dot.is-degraded { background: #f0ab00; } .ck-dot.is-down { background: #c9190b; }
.ck-body { flex: 1; display: flex; min-height: 0; }
.ck-nav { width: 200px; flex: none; background: #212427; padding: 10px 0; display: flex; flex-direction: column; }
.ck-nav__search { margin: 0 10px 8px; background: #151515; color: #fff; border: 1px solid #4f5255; border-radius: 3px; padding: 6px 8px; font: inherit; }
.ck-nav__item { background: none; border: 0; text-align: left; color: #d2d2d2; padding: 9px 18px; cursor: pointer; font: inherit; border-left: 3px solid transparent; }
.ck-nav__item:hover { background: #3c3f42; color: #fff; }
.ck-nav__item.is-active { background: #4f5255; color: #fff; border-left-color: #73bcf7; }
.ck-main { flex: 1; overflow: auto; padding: 18px 22px 40px; min-width: 0; }
.ck-h1 { font-size: 22px; font-weight: 400; margin: 0 0 12px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.ck-h1__sub { font-size: 14px; }
.ck-muted { color: #6a6e73; }
.ck-small { font-size: 12.5px; }
.ck-fleet { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); gap: 12px; }
.ck-card { background: #fff; border-radius: 3px; padding: 14px 16px; box-shadow: 0 1px 2px rgba(3, 3, 3, 0.12); margin-bottom: 12px; min-width: 0; }
.ck-hostcard { text-align: left; border: 0; cursor: pointer; font: inherit; display: flex; flex-direction: column; gap: 6px; margin: 0; }
.ck-hostcard:hover { box-shadow: 0 4px 12px rgba(3, 3, 3, 0.18); }
.ck-hostcard__top { display: flex; align-items: center; gap: 8px; }
.ck-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr)); gap: 12px; }
.ck-cards--2 { grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr)); }
.ck-card__title { font-size: 16px; font-weight: 500; margin: 0 0 12px; }
.ck-health { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.ck-health .is-ok { color: #3e8635; } .ck-health .is-bad { color: #c9190b; } .ck-health .is-warn { color: #795600; }
.ck-meter { display: grid; grid-template-columns: 4.2rem 1fr auto; align-items: center; gap: 8px; font-size: 12.5px; }
.ck-meter--lg { margin-bottom: 10px; }
.ck-bar { background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden; }
.ck-bar i { display: block; height: 100%; }
.ck-alert { border-radius: 3px; padding: 6px 10px; display: flex; flex-direction: column; gap: 2px; }
.ck-alert--warn { background: #fdf7e7; border-left: 3px solid #f0ab00; color: #795600; }
.ck-dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
.ck-dl dt { color: #6a6e73; }
.ck-dl dd { margin: 0; }
.ck-link { background: none; border: 0; color: #0066cc; cursor: pointer; font: inherit; padding: 0; margin: 6px 0; }
.ck-link:hover { text-decoration: underline; }
.ck-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.ck-toolbar--top { margin: 12px 0 0; }
.ck-input { border: 1px solid #8a8d90; border-bottom-color: #151515; border-radius: 0; padding: 6px 8px; font: inherit; background: #fff; min-width: 12rem; flex: 1; }
.ck-input--sm { flex: none; min-width: 9rem; }
.ck-btn { background: #fff; color: #0066cc; border: 1px solid #0066cc; border-radius: 3px; padding: 6px 14px; font: inherit; cursor: pointer; }
.ck-btn:hover { background: #e7f1fa; }
.ck-btn--primary { background: #0066cc; color: #fff; }
.ck-btn--primary:hover { background: #004080; }
.ck-btn--danger { color: #c9190b; border-color: #c9190b; }
.ck-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ck-table { width: 100%; border-collapse: collapse; background: #fff; }
.ck-table th { text-align: left; font-size: 13px; font-weight: 600; padding: 10px 12px; border-bottom: 1px solid #d2d2d2; }
.ck-table td { padding: 10px 12px; border-bottom: 1px solid #ededed; }
.ck-table tr.is-link { cursor: pointer; }
.ck-table tr.is-link:hover td { background: #f5f5f5; }
.ck-state { font-size: 13px; }
.ck-state.is-active { color: #3e8635; } .ck-state.is-failed { color: #c9190b; font-weight: 600; } .ck-state.is-inactive { color: #6a6e73; }
.ck-unit-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.ck-unit-head .ck-h1 { margin: 0; }
.ck-kebab { display: flex; gap: 6px; flex-wrap: wrap; }
.ck-pre { background: #f5f5f5; border-radius: 3px; padding: 10px 12px; margin: 0; white-space: pre-wrap; font-family: 'Red Hat Mono', 'Liberation Mono', Menlo, monospace; font-size: 12.5px; overflow-wrap: anywhere; }
.ck-pre--dark { background: #151515; color: #f0f0f0; margin-top: 10px; }
.ck-journal { font-family: 'Red Hat Mono', 'Liberation Mono', Menlo, monospace; font-size: 12.5px; max-height: 18rem; overflow: auto; }
.ck-journal--tall { max-height: 30rem; }
.ck-jl { padding: 3px 6px; border-bottom: 1px solid #f0f0f0; white-space: pre-wrap; overflow-wrap: anywhere; }
.ck-jl.is-error { color: #a30000; background: #faeae8; }
.ck-jl.is-warn { color: #795600; }
.ck-term { background: #151515; color: #f0f0f0; font-family: 'Red Hat Mono', 'Liberation Mono', Menlo, monospace; font-size: 13px; padding: 10px 12px; min-height: 22rem; max-height: 32rem; overflow: auto; border-radius: 3px; cursor: text; }
.ck-term__cmd { color: #8bc1f7; white-space: pre-wrap; }
.ck-term__out { white-space: pre-wrap; margin-bottom: 6px; overflow-wrap: anywhere; }
.ck-term__out.is-err { color: #f9a8a8; }
.ck-term__line { display: flex; }
.ck-term__line span { color: #8bc1f7; white-space: pre; }
.ck-term__line input { flex: 1; background: transparent; border: 0; color: #f0f0f0; font: inherit; outline: none; }
.ck-toasts { position: absolute; right: 14px; top: 60px; display: flex; flex-direction: column; gap: 8px; z-index: 30; }
.ck-toast { background: #fff; border-top: 3px solid #2b9af3; border-radius: 3px; padding: 8px 30px 8px 12px; position: relative; max-width: 24rem; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2); }
.ck-toast.is-success { border-top-color: #3e8635; }
.ck-toast.is-error { border-top-color: #c9190b; }
.ck-toast button { position: absolute; right: 6px; top: 4px; background: none; border: 0; color: #6a6e73; cursor: pointer; font-size: 16px; }
@container sl-portal (max-width: 700px) {
    .ck-nav { width: 140px; }
    .ck-admin, .ck-mast__item { display: none; }
}
</style>
