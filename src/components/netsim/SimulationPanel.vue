<template>
  <div class="ns-sim-panel">
    <nav class="ns-subtabs">
      <button :class="['ns-subtab', { active: view === 'events' }]" @click="view = 'events'">
        Event log <span class="ns-count">{{ store.events.length }}</span>
      </button>
      <button :class="['ns-subtab', { active: view === 'issues' }]" @click="view = 'issues'">
        Issues
        <span class="ns-count" :class="{ bad: store.errorCount > 0, warn: store.errorCount === 0 && store.warningCount > 0 }">
          {{ store.issues.length }}
        </span>
      </button>
      <button :class="['ns-subtab', { active: view === 'tests' }]" @click="view = 'tests'">Tests</button>
      <button :class="['ns-subtab', { active: view === 'domains' }]" @click="view = 'domains'">Domains</button>
    </nav>

    <!-- ══════════ event log ══════════ -->
    <div v-if="view === 'events'" class="ns-events">
      <div class="ns-events-filter">
        <button
          v-for="f in filters" :key="f.id"
          :class="['ns-filter-chip', { active: activeFilters.has(f.id) }]"
          @click="toggleFilter(f.id)"
        >{{ f.label }}</button>
        <button class="ns-btn ghost sm" @click="store.resetSimulation()">Reset</button>
      </div>

      <div v-if="!filteredEvents.length" class="ns-events-empty">
        <p>No events yet. Run the simulation, ping between two hosts, or request DHCP on a client.</p>
      </div>

      <ol v-else class="ns-event-list">
        <li
          v-for="e in filteredEvents" :key="e.id"
          class="ns-event" :class="[`kind-${e.kind}`, { expanded: expanded.has(e.id) }]"
          @click="toggle(e.id)"
        >
          <span class="ns-event-time">{{ e.timeMs }}ms</span>
          <span class="ns-event-layer" v-if="e.layer">L{{ e.layer }}</span>
          <span class="ns-event-kind">{{ e.kind }}</span>
          <span class="ns-event-msg">{{ e.message }}</span>
          <span v-if="e.traceId" class="ns-event-trace" title="Open this packet trace" @click.stop="openTrace(e.traceId!)">trace</span>
          <p v-if="expanded.has(e.id) && e.detail" class="ns-event-detail">{{ e.detail }}</p>
        </li>
      </ol>
    </div>

    <!-- ══════════ issues ══════════ -->
    <div v-else-if="view === 'issues'" class="ns-issues">
      <div class="ns-issues-summary">
        <span class="ns-sev err">{{ store.errorCount }} errors</span>
        <span class="ns-sev warn">{{ store.warningCount }} warnings</span>
        <span class="ns-sev hint">{{ store.hintCount }} hints</span>
        <button class="ns-btn ghost sm" @click="store.validate()">Re-check</button>
      </div>

      <div v-if="!store.issues.length" class="ns-issues-clean">
        <DeviceIcon name="check" :size="26" />
        <h4>Nothing wrong</h4>
        <p>Addressing, cabling, VLANs, routing and services all check out. Run a ping to confirm end-to-end behaviour.</p>
      </div>

      <div v-else class="ns-issue-list">
        <div
          v-for="i in sortedIssues" :key="i.id"
          class="ns-issue clickable" :class="i.severity"
          @click="focusIssue(i)"
        >
          <div class="ns-issue-top">
            <span class="ns-issue-sev">{{ i.severity }}</span>
            <strong>{{ i.title }}</strong>
          </div>
          <p>{{ i.detail }}</p>
          <p v-if="i.fix" class="ns-fix">Fix: {{ i.fix }}</p>
        </div>
      </div>
    </div>

    <!-- ══════════ tests ══════════ -->
    <div v-else-if="view === 'tests'" class="ns-tests">
      <div class="ns-test-form">
        <label>From
          <select v-model="testFrom">
            <option value="">choose a device…</option>
            <option v-for="d in store.topology.devices" :key="d.id" :value="d.id">{{ d.hostname }}</option>
          </select>
        </label>
        <label>Target (IP or name)
          <input v-model="testTarget" type="text" placeholder="10.0.2.10 or www.lab.local" spellcheck="false" @keydown.enter="doPing" />
        </label>
      </div>
      <div class="ns-btn-row tight">
        <button class="ns-btn primary sm" :disabled="!testFrom || !testTarget || store.running" @click="doPing">Ping</button>
        <button class="ns-btn ghost sm" :disabled="!testFrom || !testTarget || store.running" @click="doTrace">Traceroute</button>
        <button class="ns-btn ghost sm" :disabled="!testFrom || !testTarget || store.running" @click="doDns">nslookup</button>
        <button class="ns-btn ghost sm" :disabled="!testFrom || !testTarget || store.running" @click="doHttp">HTTP GET</button>
        <button class="ns-btn ghost sm" :disabled="!testFrom || store.running" @click="doDhcp">Request DHCP</button>
      </div>

      <pre v-if="testOutput" class="ns-test-output">{{ testOutput }}</pre>

      <div class="ns-sub-block">
        <h5>Reachability matrix</h5>
        <p class="ns-muted sm">Every addressed host pinged against every other, one packet each. Green means both directions work.</p>
        <button class="ns-btn ghost sm" :disabled="store.running" @click="buildMatrix">
          {{ matrixBuilding ? 'Testing…' : 'Run reachability test' }}
        </button>
        <div v-if="matrix.length" class="ns-matrix-wrap">
          <table class="ns-matrix">
            <thead>
              <tr><th></th><th v-for="h in matrixHosts" :key="h.id">{{ h.hostname }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in matrix" :key="ri">
                <th>{{ matrixHosts[ri].hostname }}</th>
                <td
                  v-for="(cell, ci) in row" :key="ci"
                  :class="cell === null ? 'self' : cell ? 'ok' : 'no'"
                  :title="cell === null ? '' : `${matrixHosts[ri].hostname} → ${matrixHosts[ci].hostname}: ${cell ? 'reachable' : 'unreachable'}`"
                >{{ cell === null ? '—' : cell ? '✓' : '✕' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ══════════ broadcast domains ══════════ -->
    <div v-else class="ns-domains">
      <p class="ns-muted sm">
        A broadcast domain is the set of devices that receive each other's broadcast frames. A switch does not split them —
        only a VLAN boundary or a router does.
      </p>
      <button class="ns-btn ghost sm" @click="computeDomains">Recalculate</button>
      <div v-for="(d, i) in domains" :key="i" class="ns-domain-card">
        <h5>VLAN {{ d.vlan }}</h5>
        <p>{{ d.devices.map(id => store.deviceById.get(id)?.hostname || id).join(' · ') }}</p>
        <span class="ns-muted sm">{{ d.devices.length }} devices share this domain</span>
      </div>
      <p v-if="!domains.length" class="ns-muted">Run "Recalculate" after cabling some devices together.</p>

      <div class="ns-sub-block">
        <h5>VLANs in this topology</h5>
        <div class="ns-vlan-legend">
          <span v-for="v in vlans" :key="v.id" class="ns-vlan-tag" :style="{ borderColor: v.color, color: v.color }">
            {{ v.id }} · {{ v.name }} <em>{{ v.deviceCount }}</em>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import DeviceIcon from './DeviceIcon.vue';
import { useNetSimStore } from '@/store/netsim';
import type { ValidationIssue, EventKind, Device } from '@/netsim/types';

const store = useNetSimStore();
const view = ref<'events' | 'issues' | 'tests' | 'domains'>('events');
const expanded = ref<Set<string>>(new Set());

const filters: Array<{ id: string; label: string; kinds: EventKind[] }> = [
    { id: 'all', label: 'All', kinds: [] },
    { id: 'l2', label: 'Layer 2', kinds: ['learn', 'stp', 'arp', 'wireless'] },
    { id: 'l3', label: 'Layer 3', kinds: ['route', 'icmp', 'nat'] },
    { id: 'services', label: 'Services', kinds: ['dhcp', 'dns', 'http', 'tcp'] },
    { id: 'problems', label: 'Problems', kinds: ['drop', 'error', 'acl'] },
];
const activeFilters = ref<Set<string>>(new Set(['all']));

function toggleFilter(id: string) {
    if (id === 'all') { activeFilters.value = new Set(['all']); return; }
    const s = new Set(activeFilters.value);
    s.delete('all');
    s.has(id) ? s.delete(id) : s.add(id);
    if (!s.size) s.add('all');
    activeFilters.value = s;
}

const filteredEvents = computed(() => {
    const list = [...store.events].reverse();
    if (activeFilters.value.has('all')) return list.slice(0, 300);
    const kinds = new Set(filters.filter(f => activeFilters.value.has(f.id)).flatMap(f => f.kinds));
    return list.filter(e => kinds.has(e.kind)).slice(0, 300);
});

function toggle(id: string) {
    const s = new Set(expanded.value);
    s.has(id) ? s.delete(id) : s.add(id);
    expanded.value = s;
}

function openTrace(id: string) {
    store.selectTrace(id);
}

const SEV_ORDER: Record<string, number> = { error: 0, warning: 1, hint: 2 };
const sortedIssues = computed(() =>
    [...store.issues].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]));

function focusIssue(i: ValidationIssue) {
    if (i.deviceId) store.select(i.deviceId);
    else if (i.linkId) store.selectLink(i.linkId);
}

/* ─── tests ─── */

const testFrom = ref('');
const testTarget = ref('');
const testOutput = ref('');

async function doPing() {
    const r = await store.runPing(testFrom.value, testTarget.value);
    testOutput.value = r.lines.join('\n');
}
async function doTrace() {
    const r = await store.runTraceroute(testFrom.value, testTarget.value);
    testOutput.value = r.lines.join('\n');
}
async function doDns() {
    const r = await store.runDns(testFrom.value, testTarget.value);
    testOutput.value = r.lines.join('\n');
}
async function doHttp() {
    const target = testTarget.value.includes('://') ? testTarget.value : `http://${testTarget.value}`;
    const r = await store.runHttp(testFrom.value, target);
    testOutput.value = r.lines.join('\n');
}
async function doDhcp() {
    const r = await store.runDhcp(testFrom.value);
    testOutput.value = r.lines.join('\n');
}

/* ─── reachability matrix ─── */

const matrixHosts = ref<Device[]>([]);
const matrix = ref<Array<Array<boolean | null>>>([]);
const matrixBuilding = ref(false);

function buildMatrix() {
    matrixBuilding.value = true;
    try {
        const hosts = store.topology.devices
            .filter(d => d.interfaces.some(i => i.ipv4))
            .slice(0, 14);
        matrixHosts.value = hosts;
        matrix.value = hosts.map((a, ri) => hosts.map((b, ci) => {
            if (ri === ci) return null;
            const target = b.interfaces.find(i => i.ipv4)?.ipv4;
            return target ? store.sim.canReach(a.id, target) : false;
        }));
        store.syncSimOutputs();
    } finally {
        matrixBuilding.value = false;
    }
}

/* ─── broadcast domains ─── */

const domains = ref<Array<{ vlan: number; devices: string[]; label: string }>>([]);
function computeDomains() {
    domains.value = store.sim.broadcastDomains();
}
const vlans = computed(() => store.sim.allVlans());
</script>
