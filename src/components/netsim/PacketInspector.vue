<template>
  <div class="ns-inspector">
    <div v-if="!trace" class="ns-inspector-empty">
      <DeviceIcon name="layers" :size="30" />
      <h4>No packet captured yet</h4>
      <p>Run a ping, request DHCP, resolve a name or fetch a page. Every hop is captured with its real headers, so you can watch the encapsulation change layer by layer.</p>
    </div>

    <template v-else>
      <!-- ── trace picker + status ── -->
      <header class="ns-inspector-head">
        <select class="ns-trace-select" :value="trace.id" @change="store.selectTrace(($event.target as HTMLSelectElement).value)">
          <option v-for="t in store.traces.slice().reverse()" :key="t.id" :value="t.id">
            {{ t.label }} — {{ t.status }}
          </option>
        </select>
        <span class="ns-status-pill" :class="trace.status">{{ trace.status }}</span>
      </header>

      <p v-if="trace.reason" class="ns-trace-reason" :class="trace.status">{{ trace.reason }}</p>

      <!-- ── hop timeline ── -->
      <div class="ns-hop-strip">
        <button
          v-for="h in trace.hops" :key="h.index"
          class="ns-hop-pill"
          :class="[`act-${h.action}`, { active: h.index === store.activeHopIndex, bad: !h.ok }]"
          :title="`${h.deviceName} — ${h.action}`"
          @click="store.activeHopIndex = h.index"
        >
          <span class="ns-hop-num">{{ h.index + 1 }}</span>
          <span class="ns-hop-name">{{ h.deviceName }}</span>
        </button>
      </div>

      <div class="ns-hop-controls">
        <button class="ns-icon-btn" title="Previous hop" @click="store.stepHop(-1)"><span>‹</span></button>
        <button class="ns-icon-btn" :title="store.animating ? 'Pause' : 'Play the whole trace'" @click="store.animating ? store.stopAnimation() : store.playTrace()">
          <DeviceIcon :name="store.animating ? 'pause' : 'play'" :size="14" />
        </button>
        <button class="ns-icon-btn" title="Next hop" @click="store.stepHop(1)"><span>›</span></button>
        <span class="ns-hop-counter">hop {{ store.activeHopIndex + 1 }} / {{ trace.hops.length }}</span>
        <label class="ns-speed">
          speed
          <input type="range" min="0.25" max="3" step="0.25" v-model.number="store.animationSpeed" />
        </label>
        <span class="ns-latency">{{ hop?.cumulativeLatencyMs ?? 0 }} ms</span>
      </div>

      <!-- ── what happened at this hop ── -->
      <div v-if="hop" class="ns-hop-detail">
        <div class="ns-hop-title">
          <span class="ns-hop-action" :class="`act-${hop.action}`">{{ actionLabel(hop.action) }}</span>
          <strong>{{ hop.deviceName }}</strong>
          <span class="ns-muted sm">
            {{ hop.inInterfaceName ? `in ${hop.inInterfaceName}` : '' }}
            {{ hop.outInterfaceName ? `→ out ${hop.outInterfaceName}` : '' }}
          </span>
        </div>
        <ul class="ns-hop-notes">
          <li v-for="(n, i) in hop.notes" :key="i">{{ n }}</li>
        </ul>
        <button class="ns-btn ghost sm" :disabled="explaining" @click="explainThisHop">
          <DeviceIcon name="sparkles" :size="13" />
          {{ explaining ? 'Asking the AI…' : 'Explain this hop with AI' }}
        </button>
        <div v-if="aiExplanation" class="ns-ai-inline" v-html="renderMd(aiExplanation)"></div>
      </div>

      <!-- ── layer stack ── -->
      <div class="ns-layer-stack">
        <div class="ns-layer-legend">
          <span>Encapsulation — top of the stack is the application, bottom is bits on the medium</span>
        </div>
        <div
          v-for="l in hop?.pdu.layers || []"
          :key="`${l.layer}-${l.protocol}`"
          class="ns-layer"
          :class="{ open: openLayers.has(layerKey(l)) }"
          :style="{ '--layer-color': layerColor(l.layer) }"
        >
          <button class="ns-layer-head" @click="toggleLayer(layerKey(l))">
            <span class="ns-layer-badge">L{{ l.layer }}</span>
            <span class="ns-layer-proto">{{ l.protocol }}</span>
            <span class="ns-layer-summary">{{ l.summary }}</span>
            <span class="ns-layer-bytes">{{ l.bytes }} B</span>
            <span class="ns-group-chevron"><DeviceIcon name="chevron" :size="12" /></span>
          </button>
          <div v-show="openLayers.has(layerKey(l))" class="ns-layer-body">
            <p class="ns-layer-what">{{ layerBlurb(l.layer) }}</p>
            <table class="ns-field-table">
              <tbody>
                <tr v-for="(f, i) in l.fields" :key="i" :class="{ hinted: !!f.hint }">
                  <th>{{ f.label }}<em v-if="f.bits"> · {{ f.bits }} bits</em></th>
                  <td>
                    <code>{{ f.value }}</code>
                    <p v-if="f.hint" class="ns-field-hint">{{ f.hint }}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ── frame summary ── -->
      <div v-if="hop" class="ns-frame-summary">
        <div><span>Protocol stack</span><strong>{{ hop.pdu.stack.join(' → ') }}</strong></div>
        <div><span>Frame size</span><strong>{{ hop.pdu.sizeBytes }} bytes</strong></div>
        <div v-if="hop.pdu.vlan !== undefined"><span>VLAN tag</span><strong>{{ hop.pdu.vlan }}</strong></div>
        <div v-if="hop.pdu.ttl !== undefined"><span>TTL</span><strong>{{ hop.pdu.ttl }}</strong></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import DeviceIcon from './DeviceIcon.vue';
import { useNetSimStore } from '@/store/netsim';
import { netsimAi } from '@/services/netsim-ai.service';
import { OSI_LAYERS } from '@/netsim/types';
import type { PduLayer, HopAction, LayerId } from '@/netsim/types';
import { marked } from 'marked';

const store = useNetSimStore();
const trace = computed(() => store.activeTrace);
const hop = computed(() => store.activeHop);

const openLayers = ref<Set<string>>(new Set());
const aiExplanation = ref('');
const explaining = ref(false);

function layerKey(l: PduLayer): string {
    return `${l.layer}-${l.protocol}`;
}
function toggleLayer(key: string) {
    const s = new Set(openLayers.value);
    s.has(key) ? s.delete(key) : s.add(key);
    openLayers.value = s;
}

/* Open the most interesting layers by default when the hop changes. */
watch(hop, h => {
    aiExplanation.value = '';
    if (!h) return;
    const s = new Set<string>();
    for (const l of h.pdu.layers) {
        if (l.layer === 2 || l.layer === 3) s.add(layerKey(l));
    }
    openLayers.value = s;
}, { immediate: true });

function layerColor(id: LayerId): string {
    return OSI_LAYERS.find(l => l.id === id)?.color || '#64748b';
}
function layerBlurb(id: LayerId): string {
    return OSI_LAYERS.find(l => l.id === id)?.blurb || '';
}

const ACTION_LABELS: Record<HopAction, string> = {
    originate: 'built the packet',
    'forward-l2': 'switched (L2)',
    flood: 'flooded (unknown MAC)',
    route: 'routed (L3)',
    deliver: 'delivered',
    drop: 'dropped',
    nat: 'translated (NAT)',
    'acl-deny': 'denied by ACL',
    'ttl-expired': 'TTL expired',
    'arp-request': 'ARP request',
    'arp-reply': 'ARP reply',
    'bridge-wireless': 'bridged 802.11 ↔ 802.3',
    'stp-blocked': 'blocked by STP',
    encapsulate: 'encapsulated',
    decapsulate: 'de-encapsulated',
    reply: 'replied',
};
function actionLabel(a: HopAction): string {
    return ACTION_LABELS[a] || a;
}

function renderMd(text: string): string {
    try { return marked.parse(text) as string; } catch { return text; }
}

async function explainThisHop() {
    if (!hop.value || !trace.value) return;
    explaining.value = true;
    aiExplanation.value = '';
    try {
        const res = await netsimAi.explainPacket(hop.value, trace.value);
        if (res.ok && res.data) aiExplanation.value = res.data;
        else store.toast('error', 'AI explanation unavailable', res.error);
    } finally {
        explaining.value = false;
    }
}
</script>
