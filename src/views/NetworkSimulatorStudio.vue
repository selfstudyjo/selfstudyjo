<template>
  <div class="ns-studio">
    <!-- ════════════════ toolbar ════════════════ -->
    <header class="ns-toolbar">
      <div class="ns-tb-group project">
        <router-link class="ns-icon-btn" to="/network-simulator" title="Back to projects">
          <DeviceIcon name="folder" :size="16" />
        </router-link>
        <div class="ns-project-name">
          <input
            v-model="projectName"
            class="ns-project-input"
            spellcheck="false"
            placeholder="Untitled network"
            @change="renameProject"
          />
          <span class="ns-project-sub">
            <span v-if="store.dirty" class="ns-dot-dirty" title="Unsaved changes"></span>
            {{ store.dirty ? 'unsaved changes' : (store.lastSavedAt ? `saved ${relTime(store.lastSavedAt)}` : 'not saved yet') }}
          </span>
        </div>
      </div>

      <div class="ns-tb-group">
        <button class="ns-tb-btn primary" :disabled="store.saving" @click="store.saveProject()">
          <DeviceIcon name="save" :size="15" /> <span>{{ store.saving ? 'Saving…' : 'Save' }}</span>
        </button>
        <button class="ns-tb-btn" :disabled="!store.canUndo" title="Undo (Ctrl+Z)" @click="store.undo()">
          <DeviceIcon name="undo" :size="15" />
        </button>
        <button class="ns-tb-btn" :disabled="!store.canRedo" title="Redo (Ctrl+Shift+Z)" @click="store.redo()">
          <DeviceIcon name="redo" :size="15" />
        </button>
      </div>

      <div class="ns-tb-group tools">
        <button
          v-for="t in tools" :key="t.id"
          class="ns-tb-btn tool"
          :class="{ active: store.toolMode === t.id }"
          :title="`${t.label} (${t.key})`"
          @click="store.setTool(t.id as any)"
        >
          <DeviceIcon :name="t.icon" :size="15" />
        </button>
      </div>

      <div class="ns-tb-group">
        <button class="ns-tb-btn accent" :disabled="store.running" @click="store.runFullSimulation()">
          <DeviceIcon name="play" :size="15" /> <span>{{ store.running ? 'Running…' : 'Run simulation' }}</span>
        </button>
        <button class="ns-tb-btn" title="Reset MAC/ARP/NAT tables" @click="store.resetSimulation()">
          <DeviceIcon name="undo" :size="15" /> <span class="hide-sm">Reset</span>
        </button>
        <button class="ns-tb-btn" title="Tidy the layout" @click="store.runAutoLayout()">
          <DeviceIcon name="magic" :size="15" /> <span class="hide-sm">Layout</span>
        </button>
      </div>

      <div class="ns-tb-group right">
        <span class="ns-tb-stat" :class="{ bad: store.errorCount > 0 }" :title="`${store.errorCount} errors, ${store.warningCount} warnings`">
          <DeviceIcon :name="store.errorCount ? 'alert' : 'check'" :size="14" />
          {{ store.errorCount }}/{{ store.warningCount }}
        </span>
        <button class="ns-tb-btn" title="Template library" @click="modal = 'templates'">
          <DeviceIcon name="grid" :size="15" />
        </button>
        <button class="ns-tb-btn" title="Subnet calculator" @click="modal = 'subnet'">
          <DeviceIcon name="ip" :size="15" />
        </button>
        <button class="ns-tb-btn" title="Import / export JSON" @click="modal = 'io'">
          <DeviceIcon name="download" :size="15" />
        </button>
        <button class="ns-tb-btn" :class="{ active: rightTab === 'ai' }" title="AI tutor" @click="rightTab = 'ai'">
          <DeviceIcon name="sparkles" :size="15" />
        </button>
      </div>
    </header>

    <!-- ════════════════ workspace ════════════════ -->
    <div class="ns-workspace">
      <DevicePalette
        v-if="showPalette"
        @add="addAtCentre"
        @open-templates="modal = 'templates'"
        @open-encyclopedia="modal = 'encyclopedia'"
      />

      <div class="ns-centre">
        <NetworkCanvas
          ref="canvasRef"
          @open-device="openTerminalFor"
          @request-template="modal = 'templates'"
          @request-ai="rightTab = 'ai'"
        />

        <!-- bottom dock -->
        <section class="ns-dock" :class="{ collapsed: dockCollapsed }">
          <nav class="ns-dock-tabs">
            <button :class="['ns-dock-tab', { active: dockTab === 'sim' }]" @click="openDock('sim')">
              Simulation
              <span v-if="store.errorCount" class="ns-count bad">{{ store.errorCount }}</span>
            </button>
            <button :class="['ns-dock-tab', { active: dockTab === 'cli' }]" @click="openDock('cli')">Terminal</button>
            <button class="ns-dock-collapse" :title="dockCollapsed ? 'Expand' : 'Collapse'" @click="dockCollapsed = !dockCollapsed">
              {{ dockCollapsed ? '▲' : '▼' }}
            </button>
          </nav>
          <div v-show="!dockCollapsed" class="ns-dock-body">
            <SimulationPanel v-if="dockTab === 'sim'" />
            <DeviceTerminal
              v-else-if="dockTab === 'cli' && terminalDeviceId"
              :device-id="terminalDeviceId"
              @change-device="terminalDeviceId = $event"
            />
            <div v-else class="ns-dock-empty">
              <p>Select a device to open its terminal, or double-click one on the canvas.</p>
            </div>
          </div>
        </section>
      </div>

      <div class="ns-right">
        <nav class="ns-right-tabs">
          <button :class="['ns-right-tab', { active: rightTab === 'props' }]" @click="rightTab = 'props'">Configure</button>
          <button :class="['ns-right-tab', { active: rightTab === 'inspect' }]" @click="rightTab = 'inspect'">Inspect</button>
          <button :class="['ns-right-tab', { active: rightTab === 'ai' }]" @click="rightTab = 'ai'">AI</button>
          <button :class="['ns-right-tab', { active: rightTab === 'lesson' }]" @click="rightTab = 'lesson'">Lesson</button>
        </nav>
        <div class="ns-right-body">
          <PropertiesPanel v-if="rightTab === 'props'" @open-terminal="openTerminalFor" />
          <PacketInspector v-else-if="rightTab === 'inspect'" />
          <AiAssistant v-else-if="rightTab === 'ai'" />
          <LessonPanel v-else />
        </div>
      </div>
    </div>

    <!-- ════════════════ modals ════════════════ -->
    <div v-if="modal" class="ns-modal-backdrop" @click.self="modal = null">
      <!-- templates -->
      <div v-if="modal === 'templates'" class="ns-modal wide">
        <header>
          <h3>Template library</h3>
          <button class="ns-icon-btn" @click="modal = null"><DeviceIcon name="close" :size="16" /></button>
        </header>
        <p class="ns-modal-sub">Each template is a working, correct network — load one and start breaking it. That is how you learn fastest.</p>
        <div class="ns-template-grid">
          <button v-for="t in TOPOLOGY_TEMPLATES" :key="t.id" class="ns-template-card" @click="pickTemplate(t.id)">
            <span class="ns-template-icon"><DeviceIcon :name="t.icon" :size="24" /></span>
            <strong>{{ t.name }}</strong>
            <p>{{ t.description }}</p>
            <span class="ns-template-tags">
              <em class="ns-diff" :class="t.difficulty">{{ t.difficulty }}</em>
              <em v-for="tag in t.tags.slice(0, 3)" :key="tag">{{ tag }}</em>
            </span>
          </button>
        </div>
      </div>

      <!-- encyclopedia -->
      <div v-else-if="modal === 'encyclopedia'" class="ns-modal wide">
        <header>
          <h3>Device encyclopedia</h3>
          <button class="ns-icon-btn" @click="modal = null"><DeviceIcon name="close" :size="16" /></button>
        </header>
        <div class="ns-search inline">
          <DeviceIcon name="search" :size="14" />
          <input v-model="encySearch" placeholder="Search devices, tags, protocols…" spellcheck="false" />
        </div>
        <div class="ns-ency-list">
          <article v-for="t in encyResults" :key="t.id" class="ns-ency-item">
            <header>
              <span class="ns-ency-icon" :style="{ color: t.accent }"><DeviceIcon :name="t.icon" :size="22" /></span>
              <div>
                <h4>{{ t.name }}</h4>
                <p>Layer {{ t.layer }} · {{ t.role }} · since {{ t.year }} · {{ t.ports.reduce((n, p) => n + p.count, 0) }} ports</p>
              </div>
              <button class="ns-btn ghost sm" @click="addAtCentre(t.id); modal = null">Add to canvas</button>
            </header>
            <p class="ns-blurb">{{ t.blurb }}</p>
            <ul><li v-for="(l, i) in t.learn" :key="i">{{ l }}</li></ul>
            <div class="ns-ency-tags"><em v-for="tag in t.tags" :key="tag">{{ tag }}</em></div>
          </article>
        </div>
      </div>

      <!-- subnet calculator -->
      <div v-else-if="modal === 'subnet'" class="ns-modal">
        <header>
          <h3>Subnet calculator</h3>
          <button class="ns-icon-btn" @click="modal = null"><DeviceIcon name="close" :size="16" /></button>
        </header>
        <div class="ns-field-grid">
          <label>IP address<input v-model="calcIp" spellcheck="false" placeholder="192.168.10.37" /></label>
          <label>Mask or prefix<input v-model="calcMask" spellcheck="false" placeholder="255.255.255.0 or 24" /></label>
        </div>
        <table v-if="calc" class="ns-table mono">
          <tbody>
            <tr><th>Network</th><td>{{ calc.network }}/{{ calc.prefix }}</td></tr>
            <tr><th>Mask</th><td>{{ calc.mask }}</td></tr>
            <tr><th>Wildcard</th><td>{{ calc.wildcard }}</td></tr>
            <tr><th>Broadcast</th><td>{{ calc.broadcast }}</td></tr>
            <tr><th>Usable range</th><td>{{ calc.firstHost }} – {{ calc.lastHost }}</td></tr>
            <tr><th>Usable hosts</th><td>{{ calc.hosts.toLocaleString() }}</td></tr>
            <tr><th>Class / scope</th><td>{{ calc.class }} · {{ calc.scope }}</td></tr>
          </tbody>
        </table>
        <p v-else class="ns-muted">Enter a valid IPv4 address to see the breakdown.</p>

        <div class="ns-sub-block">
          <h5>Split into equal subnets</h5>
          <label class="ns-field">New prefix
            <input type="number" min="1" max="32" v-model.number="splitPrefix" />
          </label>
          <div v-if="splits.length" class="ns-split-list">
            <div v-for="(s, i) in splits.slice(0, 32)" :key="i">
              <code>{{ s.network }}/{{ s.prefix }}</code>
              <span>{{ s.firstHost }}–{{ s.lastHost }} · {{ s.hosts }} hosts · bcast {{ s.broadcast }}</span>
            </div>
            <p v-if="splits.length > 32" class="ns-muted sm">…and {{ splits.length - 32 }} more.</p>
          </div>
        </div>
      </div>

      <!-- import / export -->
      <div v-else-if="modal === 'io'" class="ns-modal">
        <header>
          <h3>Import &amp; export</h3>
          <button class="ns-icon-btn" @click="modal = null"><DeviceIcon name="close" :size="16" /></button>
        </header>
        <div class="ns-btn-row tight">
          <button class="ns-btn ghost sm" @click="copyJson"><DeviceIcon name="copy" :size="13" /> Copy topology JSON</button>
          <button class="ns-btn ghost sm" @click="downloadJson"><DeviceIcon name="download" :size="13" /> Download .json</button>
          <label class="ns-btn ghost sm file">
            <DeviceIcon name="upload" :size="13" /> Load from file
            <input type="file" accept=".json,application/json" @change="onFile" />
          </label>
        </div>
        <label class="ns-field block">Paste topology JSON
          <textarea v-model="importText" rows="10" spellcheck="false" placeholder='{ "name": "...", "devices": [...], "links": [...] }'></textarea>
        </label>
        <div class="ns-btn-row tight">
          <button class="ns-btn primary sm" :disabled="!importText.trim()" @click="doImport">Import</button>
          <button class="ns-btn ghost sm" @click="importText = store.exportJson()">Fill with current topology</button>
        </div>
        <p class="ns-muted sm">
          Topologies are stored as JSON in <code>{{ storage.repo }}</code>. The same format is what the AI generator produces,
          so anything you export can be edited by hand and re-imported.
        </p>
      </div>
    </div>

    <!-- ════════════════ toasts ════════════════ -->
    <div class="ns-toasts">
      <div v-for="t in store.toasts" :key="t.id" class="ns-toast" :class="t.kind" @click="store.dismissToast(t.id)">
        <DeviceIcon :name="t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'" :size="15" />
        <div><strong>{{ t.title }}</strong><p v-if="t.message">{{ t.message }}</p></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DeviceIcon from '@/components/netsim/DeviceIcon.vue';
import DevicePalette from '@/components/netsim/DevicePalette.vue';
import NetworkCanvas from '@/components/netsim/NetworkCanvas.vue';
import PropertiesPanel from '@/components/netsim/PropertiesPanel.vue';
import PacketInspector from '@/components/netsim/PacketInspector.vue';
import DeviceTerminal from '@/components/netsim/DeviceTerminal.vue';
import SimulationPanel from '@/components/netsim/SimulationPanel.vue';
import AiAssistant from '@/components/netsim/AiAssistant.vue';
import LessonPanel from '@/components/netsim/LessonPanel.vue';
import { useNetSimStore } from '@/store/netsim';
import { TOPOLOGY_TEMPLATES } from '@/netsim/topology';
import { searchDeviceTypes } from '@/netsim/devices';
import { describeSubnet, splitSubnet, maskToPrefix, isValidIPv4 } from '@/netsim/ip';
import { getLesson } from '@/netsim/lessons';

const store = useNetSimStore();
const route = useRoute();
const router = useRouter();

const canvasRef = ref<InstanceType<typeof NetworkCanvas> | null>(null);
const rightTab = ref<'props' | 'inspect' | 'ai' | 'lesson'>('props');
const dockTab = ref<'sim' | 'cli'>('sim');
const dockCollapsed = ref(false);
const modal = ref<null | 'templates' | 'encyclopedia' | 'subnet' | 'io'>(null);
const terminalDeviceId = ref<string>('');
const showPalette = ref(true);

const storage = computed(() => store.storageStatus);
const projectName = ref('');

const tools = [
    { id: 'select', label: 'Select and move', icon: 'cursor', key: 'V' },
    { id: 'connect', label: 'Connect devices', icon: 'cable', key: 'C' },
    { id: 'delete', label: 'Delete', icon: 'trash', key: 'X' },
    { id: 'note', label: 'Add a note', icon: 'book', key: 'N' },
    { id: 'pan', label: 'Pan the canvas', icon: 'layers', key: 'Space' },
];

/* ─────────── lifecycle ─────────── */

onMounted(async () => {
    await store.loadProfileAndProgress();

    const projectId = route.params.id as string | undefined;
    const templateId = route.query.template as string | undefined;
    const lessonId = route.query.lesson as string | undefined;

    if (projectId && projectId !== 'new') {
        await store.openProject(projectId);
    } else if (templateId) {
        await store.newProject(
            TOPOLOGY_TEMPLATES.find(t => t.id === templateId)?.name || 'New network',
            '', templateId, lessonId
        );
    } else if (!store.project) {
        await store.newProject('Untitled network', '', undefined, lessonId);
    }

    if (lessonId) {
        store.setActiveLesson(lessonId);
        rightTab.value = 'lesson';
        const lesson = getLesson(lessonId);
        if (lesson?.starterTemplateId && !store.topology.devices.length) {
            store.loadTemplate(lesson.starterTemplateId);
        }
    }

    projectName.value = store.project?.name || store.topology.name;
    window.addEventListener('beforeunload', warnUnsaved);
    window.addEventListener('keydown', onGlobalKey);
});

onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', warnUnsaved);
    window.removeEventListener('keydown', onGlobalKey);
    store.stopAnimation();
});

function warnUnsaved(ev: BeforeUnloadEvent) {
    if (store.dirty) { ev.preventDefault(); ev.returnValue = ''; }
}

function onGlobalKey(ev: KeyboardEvent) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
        ev.preventDefault();
        void store.saveProject();
    }
    if (ev.key === 'Escape' && modal.value) modal.value = null;
}

watch(() => store.project?.name, n => { if (n) projectName.value = n; });
watch(() => store.selectedDeviceId, id => {
    if (id) {
        if (rightTab.value === 'inspect') rightTab.value = 'props';
        if (dockTab.value === 'cli') terminalDeviceId.value = id;
    }
});

/* ─────────── actions ─────────── */

function renameProject() {
    if (!projectName.value.trim()) { projectName.value = store.project?.name || 'Untitled network'; return; }
    if (store.project) store.project.name = projectName.value.trim();
    store.topology.name = projectName.value.trim();
    store.markDirty();
}

function addAtCentre(typeId: string) {
    const existing = store.topology.devices;
    const cx = existing.length ? Math.round(existing.reduce((s, d) => s + d.x, 0) / existing.length) : 640;
    const cy = existing.length ? Math.max(...existing.map(d => d.y)) + 160 : 320;
    store.addDevice(typeId, cx + (existing.length % 5) * 40, cy);
}

function openTerminalFor(id: string) {
    terminalDeviceId.value = id;
    dockTab.value = 'cli';
    dockCollapsed.value = false;
}

function openDock(tab: 'sim' | 'cli') {
    dockTab.value = tab;
    dockCollapsed.value = false;
    if (tab === 'cli' && !terminalDeviceId.value) {
        terminalDeviceId.value = store.selectedDeviceId || store.topology.devices[0]?.id || '';
    }
}

function pickTemplate(id: string) {
    store.loadTemplate(id);
    modal.value = null;
    setTimeout(() => canvasRef.value?.fitToView(), 80);
}

function relTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h ago`;
    return new Date(iso).toLocaleDateString();
}

/* ─────────── encyclopedia ─────────── */

const encySearch = ref('');
const encyResults = computed(() => searchDeviceTypes(encySearch.value).slice(0, 60));

/* ─────────── subnet calculator ─────────── */

const calcIp = ref('192.168.10.37');
const calcMask = ref('255.255.255.0');
const splitPrefix = ref(26);

const calc = computed(() => (isValidIPv4(calcIp.value) ? describeSubnet(calcIp.value, calcMask.value) : null));
const splits = computed(() => {
    if (!calc.value) return [];
    const from = maskToPrefix(calcMask.value);
    if (splitPrefix.value <= from) return [];
    return splitSubnet(calc.value.network, from, splitPrefix.value);
});

/* ─────────── import / export ─────────── */

const importText = ref('');

async function copyJson() {
    try {
        await navigator.clipboard.writeText(store.exportJson());
        store.toast('success', 'Topology JSON copied');
    } catch {
        store.toast('error', 'Could not copy to the clipboard');
    }
}

function downloadJson() {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(store.topology.name || 'topology').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function doImport() {
    if (store.importJson(importText.value)) {
        modal.value = null;
        importText.value = '';
        setTimeout(() => canvasRef.value?.fitToView(), 80);
    }
}

function onFile(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { importText.value = String(reader.result || ''); };
    reader.readAsText(file);
}
</script>

<style src="@/assets/css/netsim.css"></style>
