<template>
  <div
    ref="wrapEl"
    class="ns-canvas-wrap"
    :class="[`tool-${store.toolMode}`, { 'is-panning': isPanning }]"
    @wheel.prevent="onWheel"
    @mousedown="onBackgroundDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @dragover.prevent="onDragOver"
    @drop.prevent="onDrop"
    @contextmenu.prevent
  >
    <svg class="ns-canvas" :width="'100%'" :height="'100%'">
      <defs>
        <pattern id="ns-grid-sm" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgba(148,163,184,.07)" stroke-width="1" />
        </pattern>
        <pattern id="ns-grid-lg" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#ns-grid-sm)" />
          <path d="M100 0H0V100" fill="none" stroke="rgba(148,163,184,.13)" stroke-width="1" />
        </pattern>
        <filter id="ns-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="ns-packet-grad">
          <stop offset="0%" stop-color="#fff" stop-opacity="1" />
          <stop offset="55%" stop-color="#38bdf8" stop-opacity=".95" />
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
        </radialGradient>
        <marker id="ns-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="rgba(148,163,184,.75)" />
        </marker>
      </defs>

      <rect
        v-if="topology.canvas.grid"
        class="ns-grid"
        :x="-panX / zoom" :y="-panY / zoom"
        :width="viewW / zoom" :height="viewH / zoom"
        fill="url(#ns-grid-lg)"
      />

      <g :transform="`translate(${panX},${panY}) scale(${zoom})`">
        <!-- ── annotations (behind everything) ── -->
        <g
          v-for="a in topology.annotations"
          :key="a.id"
          class="ns-annotation"
          :class="{ selected: store.selectedAnnotationId === a.id }"
          @mousedown.stop="startAnnotationDrag(a, $event)"
        >
          <rect :x="a.x" :y="a.y" :width="a.w" :height="a.h" rx="10"
                :fill="`${a.color}14`" :stroke="`${a.color}55`" stroke-width="1.5" />
          <foreignObject :x="a.x + 12" :y="a.y + 10" :width="a.w - 24" :height="a.h - 20">
            <div class="ns-note-body" xmlns="http://www.w3.org/1999/xhtml">{{ a.text }}</div>
          </foreignObject>
        </g>

        <!-- ── links ── -->
        <g class="ns-links">
          <g
            v-for="l in renderLinks"
            :key="l.id"
            class="ns-link"
            :class="[
              `status-${l.status}`,
              { selected: store.selectedLinkId === l.id, 'in-path': l.inPath, active: l.isActiveHop },
            ]"
            @click.stop="onLinkClick(l.id)"
          >
            <line :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" class="ns-link-hit" />
            <line
              :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2"
              class="ns-link-line"
              :stroke-dasharray="l.dash"
            />
            <g v-if="l.status === 'blocked'">
              <circle :cx="l.mx" :cy="l.my" r="9" class="ns-link-badge blocked" />
              <text :x="l.mx" :y="l.my + 3.4" class="ns-link-badge-text">×</text>
            </g>
            <text
              v-else-if="l.label && zoom > 0.55"
              :x="l.mx" :y="l.my - 7"
              class="ns-link-label"
              text-anchor="middle"
            >{{ l.label }}</text>
            <text
              v-if="zoom > 0.85 && l.portA"
              :x="l.pa.x" :y="l.pa.y" class="ns-port-label" text-anchor="middle"
            >{{ l.portA }}</text>
            <text
              v-if="zoom > 0.85 && l.portB"
              :x="l.pb.x" :y="l.pb.y" class="ns-port-label" text-anchor="middle"
            >{{ l.portB }}</text>
          </g>
        </g>

        <!-- ── wireless associations ── -->
        <g class="ns-wireless">
          <line
            v-for="w in wirelessLinks" :key="w.id"
            :x1="w.x1" :y1="w.y1" :x2="w.x2" :y2="w.y2"
            class="ns-wifi-line"
          />
        </g>

        <!-- ── pending connection rubber band ── -->
        <line
          v-if="pendingFrom"
          :x1="pendingFrom.x" :y1="pendingFrom.y"
          :x2="cursorWorld.x" :y2="cursorWorld.y"
          class="ns-rubber"
        />

        <!-- ── devices ── -->
        <g
          v-for="d in topology.devices"
          :key="d.id"
          class="ns-device"
          :class="{
            selected: store.selectedDeviceId === d.id,
            off: !d.powered,
            'has-error': deviceErrors.has(d.id),
            'in-path': pathDeviceIds.has(d.id),
            'is-current': currentHopDeviceId === d.id,
            'pending-source': store.pendingConnection?.deviceId === d.id,
          }"
          :transform="`translate(${d.x},${d.y})`"
          @mousedown.stop="startDeviceDrag(d, $event)"
          @click.stop="onDeviceClick(d, $event)"
          @dblclick.stop="emit('open-device', d.id)"
        >
          <circle class="ns-device-halo" cx="0" cy="0" r="46" />
          <rect class="ns-device-box" x="-32" y="-32" width="64" height="64" rx="16" />
          <g class="ns-device-icon" :style="{ color: accentOf(d) }">
            <g transform="translate(-16,-16)">
              <DeviceIcon :name="iconOf(d)" :size="32" />
            </g>
          </g>

          <text class="ns-device-name" x="0" y="49" text-anchor="middle">{{ d.hostname }}</text>
          <text v-if="zoom > 0.6 && primaryAddress(d)" class="ns-device-ip" x="0" y="63" text-anchor="middle">
            {{ primaryAddress(d) }}
          </text>

          <!-- badges -->
          <g v-if="!d.powered" class="ns-badge off-badge" transform="translate(20,-24)">
            <circle r="9" />
            <g transform="translate(-6,-6)"><DeviceIcon name="power" :size="12" /></g>
          </g>
          <g v-else-if="deviceErrors.has(d.id)" class="ns-badge err-badge" transform="translate(21,-23)">
            <circle r="9" />
            <text y="3.6" text-anchor="middle">!</text>
          </g>
          <g v-if="rootBridgeIds.has(d.id)" class="ns-badge root-badge" transform="translate(-21,-23)">
            <circle r="9" />
            <text y="3.4" text-anchor="middle">R</text>
          </g>
          <g v-if="vlanChips(d).length && zoom > 0.7" class="ns-vlan-chips" :transform="`translate(${-vlanChips(d).length * 9 + 9}, 76)`">
            <g v-for="(v, idx) in vlanChips(d)" :key="v.id" :transform="`translate(${idx * 18},0)`">
              <rect x="-8" y="-6" width="16" height="12" rx="3" :fill="`${v.color}33`" :stroke="v.color" stroke-width="1" />
              <text y="3.2" text-anchor="middle" :fill="v.color" class="ns-vlan-chip-text">{{ v.id }}</text>
            </g>
          </g>
        </g>

        <!-- ── animated packet ── -->
        <g v-if="packetPos" class="ns-packet" :style="{ transform: `translate(${packetPos.x}px, ${packetPos.y}px)` }">
          <circle r="16" fill="url(#ns-packet-grad)" />
          <circle r="6" class="ns-packet-core" />
          <text y="-22" text-anchor="middle" class="ns-packet-label">{{ packetLabel }}</text>
        </g>
      </g>
    </svg>

    <!-- ── empty state ── -->
    <div v-if="!topology.devices.length" class="ns-empty">
      <div class="ns-empty-inner">
        <DeviceIcon name="layers" :size="52" />
        <h3>{{ $t('Your canvas is empty') }}</h3>
        <p>{{ $t('Drag a device from the palette on the left, load a template, or ask the AI to build a network for you.') }}</p>
        <div class="ns-empty-actions">
          <button class="ns-btn primary" @click="emit('request-template')">
            <DeviceIcon name="grid" :size="16" /> {{ $t('Start from a template') }}
          </button>
          <button class="ns-btn ghost" @click="emit('request-ai')">
            <DeviceIcon name="sparkles" :size="16" /> {{ $t('Generate with AI') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── zoom controls ── -->
    <div class="ns-canvas-controls">
      <button class="ns-zoom-btn" :title="$t('Zoom in')" @click="zoomBy(1.2)">+</button>
      <button class="ns-zoom-btn" :title="$t('Zoom out')" @click="zoomBy(1 / 1.2)">−</button>
      <button class="ns-zoom-btn wide" :title="$t('Fit to view')" @click="fitToView">{{ $t('Fit') }}</button>
      <span class="ns-zoom-value">{{ Math.round(zoom * 100) }}%</span>
    </div>

    <div v-if="store.pendingConnection" class="ns-connect-hint">
      <DeviceIcon name="cable" :size="15" />
      {{ $t('Click the second device to complete the cable — press') }} <kbd>{{ $t('Esc') }}</kbd> {{ $t('to cancel') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import DeviceIcon from './DeviceIcon.vue';
import { useNetSimStore } from '@/store/netsim';
import type { Device, Annotation, LinkStatus } from '@/netsim/types';
import { getDeviceType } from '@/netsim/devices';
import { maskToPrefix } from '@/netsim/ip';

const emit = defineEmits<{
    (e: 'open-device', id: string): void;
    (e: 'request-template'): void;
    (e: 'request-ai'): void;
}>();

const store = useNetSimStore();
const topology = computed(() => store.topology);

const wrapEl = ref<HTMLElement | null>(null);
const viewW = ref(1200);
const viewH = ref(800);

const zoom = computed({
    get: () => topology.value.canvas.zoom || 1,
    set: v => { topology.value.canvas.zoom = Math.min(3, Math.max(0.25, v)); },
});
const panX = computed({
    get: () => topology.value.canvas.panX || 0,
    set: v => { topology.value.canvas.panX = v; },
});
const panY = computed({
    get: () => topology.value.canvas.panY || 0,
    set: v => { topology.value.canvas.panY = v; },
});

/* ─────────── drag state ─────────── */

const draggingDevice = ref<{ id: string; offX: number; offY: number } | null>(null);
const draggingAnnotation = ref<{ id: string; offX: number; offY: number } | null>(null);
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0, px: 0, py: 0 });
const cursorWorld = ref({ x: 0, y: 0 });

function toWorld(clientX: number, clientY: number) {
    const rect = wrapEl.value?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
        x: (clientX - rect.left - panX.value) / zoom.value,
        y: (clientY - rect.top - panY.value) / zoom.value,
    };
}

function snap(v: number): number {
    return topology.value.canvas.snap ? Math.round(v / 20) * 20 : Math.round(v);
}

/* ─────────── interaction ─────────── */

function onDeviceClick(d: Device, ev: MouseEvent) {
    if (store.toolMode === 'delete') { store.removeDevice(d.id); return; }
    if (store.toolMode === 'connect' || ev.shiftKey) { store.handleConnectClick(d.id); return; }
    store.select(d.id);
}

function onLinkClick(id: string) {
    if (store.toolMode === 'delete') { store.removeLink(id); return; }
    store.selectLink(id);
}

function startDeviceDrag(d: Device, ev: MouseEvent) {
    if (store.toolMode === 'connect' || store.toolMode === 'delete' || ev.button !== 0) return;
    const w = toWorld(ev.clientX, ev.clientY);
    draggingDevice.value = { id: d.id, offX: w.x - d.x, offY: w.y - d.y };
    store.snapshot();
}

function startAnnotationDrag(a: Annotation, ev: MouseEvent) {
    if (store.toolMode === 'delete') { store.removeAnnotation(a.id); return; }
    store.selectedAnnotationId = a.id;
    store.selectedDeviceId = null;
    if (ev.button !== 0) return;
    const w = toWorld(ev.clientX, ev.clientY);
    draggingAnnotation.value = { id: a.id, offX: w.x - a.x, offY: w.y - a.y };
}

function onBackgroundDown(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    const onBackground = target.tagName === 'svg' || target.classList.contains('ns-grid') || target.classList.contains('ns-canvas-wrap');
    if (!onBackground) return;

    if (store.toolMode === 'note') {
        const w = toWorld(ev.clientX, ev.clientY);
        store.addAnnotation(snap(w.x), snap(w.y), 'Double-click to edit this note');
        store.setTool('select');
        return;
    }

    if (ev.button === 1 || store.toolMode === 'pan' || ev.altKey) {
        isPanning.value = true;
        panStart.value = { x: ev.clientX, y: ev.clientY, px: panX.value, py: panY.value };
        return;
    }
    store.select(null);
    store.selectLink(null);
    store.selectedAnnotationId = null;
}

function onMouseMove(ev: MouseEvent) {
    cursorWorld.value = toWorld(ev.clientX, ev.clientY);

    if (isPanning.value) {
        panX.value = panStart.value.px + (ev.clientX - panStart.value.x);
        panY.value = panStart.value.py + (ev.clientY - panStart.value.y);
        return;
    }
    if (draggingDevice.value) {
        const d = topology.value.devices.find(x => x.id === draggingDevice.value!.id);
        if (d) {
            d.x = snap(cursorWorld.value.x - draggingDevice.value.offX);
            d.y = snap(cursorWorld.value.y - draggingDevice.value.offY);
        }
        return;
    }
    if (draggingAnnotation.value) {
        const a = topology.value.annotations.find(x => x.id === draggingAnnotation.value!.id);
        if (a) {
            a.x = snap(cursorWorld.value.x - draggingAnnotation.value.offX);
            a.y = snap(cursorWorld.value.y - draggingAnnotation.value.offY);
        }
    }
}

function onMouseUp() {
    if (draggingDevice.value || draggingAnnotation.value) store.markDirty();
    draggingDevice.value = null;
    draggingAnnotation.value = null;
    isPanning.value = false;
}

function onWheel(ev: WheelEvent) {
    const rect = wrapEl.value?.getBoundingClientRect();
    if (!rect) return;
    const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    const before = toWorld(ev.clientX, ev.clientY);
    zoom.value = zoom.value * factor;
    const after = toWorld(ev.clientX, ev.clientY);
    panX.value += (after.x - before.x) * zoom.value;
    panY.value += (after.y - before.y) * zoom.value;
}

function zoomBy(factor: number) {
    const cx = viewW.value / 2, cy = viewH.value / 2;
    const before = { x: (cx - panX.value) / zoom.value, y: (cy - panY.value) / zoom.value };
    zoom.value = zoom.value * factor;
    panX.value = cx - before.x * zoom.value;
    panY.value = cy - before.y * zoom.value;
}

function fitToView() {
    const ds = topology.value.devices;
    if (!ds.length) { zoom.value = 1; panX.value = 0; panY.value = 0; return; }
    const pad = 110;
    const minX = Math.min(...ds.map(d => d.x)) - pad;
    const maxX = Math.max(...ds.map(d => d.x)) + pad;
    const minY = Math.min(...ds.map(d => d.y)) - pad;
    const maxY = Math.max(...ds.map(d => d.y)) + pad;
    const z = Math.min(viewW.value / (maxX - minX), viewH.value / (maxY - minY), 1.6);
    zoom.value = Math.max(0.25, z);
    panX.value = viewW.value / 2 - ((minX + maxX) / 2) * zoom.value;
    panY.value = viewH.value / 2 - ((minY + maxY) / 2) * zoom.value;
}

/* ─────────── palette drag & drop ─────────── */

function onDragOver(ev: DragEvent) {
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
}

function onDrop(ev: DragEvent) {
    const typeId = ev.dataTransfer?.getData('application/x-netsim-device') || ev.dataTransfer?.getData('text/plain');
    if (!typeId) return;
    const w = toWorld(ev.clientX, ev.clientY);
    store.addDevice(typeId, snap(w.x), snap(w.y));
}

/* ─────────── rendering data ─────────── */

function iconOf(d: Device): string {
    return getDeviceType(d.typeId)?.icon || 'pc';
}
function accentOf(d: Device): string {
    return getDeviceType(d.typeId)?.accent || '#60a5fa';
}
function primaryAddress(d: Device): string {
    const i = d.interfaces.find(x => x.ipv4);
    if (!i) {
        const dhcp = d.interfaces.find(x => x.dhcp);
        return dhcp ? 'DHCP · no lease' : '';
    }
    return `${i.ipv4}/${maskToPrefix(i.mask)}`;
}
function vlanChips(d: Device) {
    const ids = new Set<number>();
    for (const i of d.interfaces) {
        if (i.mode === 'access' && i.accessVlan > 1) ids.add(i.accessVlan);
        if (i.sviVlan) ids.add(i.sviVlan);
    }
    return Array.from(ids).slice(0, 4).map(id => ({
        id,
        color: d.vlans.find(v => v.id === id)?.color || '#64748b',
    }));
}

const deviceErrors = computed(() => {
    const s = new Set<string>();
    store.issues.filter(i => i.severity === 'error' && i.deviceId).forEach(i => s.add(i.deviceId!));
    return s;
});

const rootBridgeIds = computed(() => {
    const s = new Set<string>();
    topology.value.devices.forEach(d => { if (d.stp?.isRoot) s.add(d.id); });
    return s;
});

const pathDeviceIds = computed(() => {
    const s = new Set<string>();
    store.activeTrace?.hops.forEach(h => s.add(h.deviceId));
    return s;
});

const currentHopDeviceId = computed(() => store.activeHop?.deviceId || null);

const pathLinkIds = computed(() => {
    const s = new Set<string>();
    store.activeTrace?.hops.forEach(h => { if (h.linkId) s.add(h.linkId); });
    return s;
});

const renderLinks = computed(() => {
    const byId = store.deviceById;
    const activeLinkId = store.activeHop?.linkId;
    return topology.value.links.map(l => {
        const A = byId.get(l.aDeviceId);
        const B = byId.get(l.bDeviceId);
        if (!A || !B) return null;
        const ai = A.interfaces.find(i => i.id === l.aInterfaceId);
        const bi = B.interfaces.find(i => i.id === l.bInterfaceId);

        const dx = B.x - A.x, dy = B.y - A.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len, uy = dy / len;
        const r = 34;

        const dash =
            l.cable === 'serial-dce' || l.cable === 'serial-dte' ? '9 5'
            : l.cable === 'fiber-single-mode' || l.cable === 'fiber-multi-mode' ? '0'
            : l.cable === 'coaxial' ? '2 4'
            : '0';

        const status: LinkStatus = l.severed ? 'down' : (l.status || 'up');

        return {
            id: l.id,
            x1: A.x + ux * r, y1: A.y + uy * r,
            x2: B.x - ux * r, y2: B.y - uy * r,
            mx: (A.x + B.x) / 2, my: (A.y + B.y) / 2,
            pa: { x: A.x + ux * (r + 20) + uy * 11, y: A.y + uy * (r + 20) - ux * 11 },
            pb: { x: B.x - ux * (r + 20) + uy * 11, y: B.y - uy * (r + 20) - ux * 11 },
            portA: ai?.short || '',
            portB: bi?.short || '',
            dash,
            status,
            label: l.label || (l.bandwidthMbps >= 10000 ? `${l.bandwidthMbps / 1000}G` : ''),
            inPath: pathLinkIds.value.has(l.id),
            isActiveHop: activeLinkId === l.id,
        };
    }).filter(Boolean) as any[];
});

const wirelessLinks = computed(() => {
    const byId = store.deviceById;
    return store.sim.allLinks
        .filter(l => l.cable === 'wireless' || l.cable === 'cellular')
        .map(l => {
            const A = byId.get(l.aDeviceId);
            const B = byId.get(l.bDeviceId);
            if (!A || !B) return null;
            return { id: l.id, x1: A.x, y1: A.y, x2: B.x, y2: B.y };
        })
        .filter(Boolean) as any[];
});

const pendingFrom = computed(() => {
    const p = store.pendingConnection;
    if (!p) return null;
    const d = store.deviceById.get(p.deviceId);
    return d ? { x: d.x, y: d.y } : null;
});

const packetPos = computed(() => {
    const hop = store.activeHop;
    if (!hop) return null;
    const d = store.deviceById.get(hop.deviceId);
    return d ? { x: d.x, y: d.y - 46 } : null;
});

const packetLabel = computed(() => {
    const hop = store.activeHop;
    if (!hop) return '';
    return hop.pdu.protocol.length > 22 ? hop.pdu.protocol.slice(0, 22) + '…' : hop.pdu.protocol;
});

/* ─────────── lifecycle ─────────── */

function measure() {
    const rect = wrapEl.value?.getBoundingClientRect();
    if (rect) { viewW.value = rect.width; viewH.value = rect.height; }
}

function onKey(ev: KeyboardEvent) {
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (ev.target as HTMLElement)?.isContentEditable) return;

    if (ev.key === 'Escape') {
        store.pendingConnection = null;
        store.setTool('select');
        return;
    }
    if ((ev.key === 'Delete' || ev.key === 'Backspace')) {
        if (store.selectedDeviceId) { store.removeDevice(store.selectedDeviceId); ev.preventDefault(); }
        else if (store.selectedLinkId) { store.removeLink(store.selectedLinkId); ev.preventDefault(); }
        else if (store.selectedAnnotationId) { store.removeAnnotation(store.selectedAnnotationId); ev.preventDefault(); }
        return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        ev.shiftKey ? store.redo() : store.undo();
        return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd' && store.selectedDeviceId) {
        ev.preventDefault();
        store.duplicateDevice(store.selectedDeviceId);
        return;
    }
    if (!ev.ctrlKey && !ev.metaKey) {
        if (ev.key === 'v') store.setTool('select');
        if (ev.key === 'c') store.setTool('connect');
        if (ev.key === 'x') store.setTool('delete');
        if (ev.key === 'n') store.setTool('note');
        if (ev.key === 'f') fitToView();
    }
}

let ro: ResizeObserver | null = null;

onMounted(() => {
    measure();
    ro = new ResizeObserver(measure);
    if (wrapEl.value) ro.observe(wrapEl.value);
    window.addEventListener('keydown', onKey);
    if (topology.value.devices.length) setTimeout(fitToView, 60);
});

onUnmounted(() => {
    ro?.disconnect();
    window.removeEventListener('keydown', onKey);
});

watch(() => topology.value.id, () => setTimeout(fitToView, 60));

defineExpose({ fitToView });
</script>

<style scoped src="@/assets/css/netsim-canvas.css"></style>
