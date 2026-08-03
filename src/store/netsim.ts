/**
 * src/store/netsim.ts
 * The single source of truth for the Network Simulator studio: the open project,
 * the live Simulator instance, selection, tool mode, undo/redo, CLI sessions and
 * persistence to the GitHub data repo.
 */

import { defineStore } from 'pinia';
import { ref, computed, shallowRef, watch } from 'vue';
import type {
    Topology, Device, Link, NetSimProject, ProjectSummary, SimEvent, PacketTrace,
    ValidationIssue, CliSession, CliLine, NetSimProgress, NetSimUserProfile,
    Annotation, CableType, Lesson,
} from '@/netsim/types';
import { Simulator } from '@/netsim/engine';
import {
    createTopology, createDevice, connect as connectDevices, checkConnection,
    disconnect as disconnectLink, removeDevice as removeDeviceFromTopology,
    autoLayout, cloneTopology, importTopology, exportTopology, buildTemplate,
    topologyFromAiSpec, freeInterfaces, separateOverlaps,
} from '@/netsim/topology';
import type { AiTopologySpec } from '@/netsim/topology';
import { createSession, execute as executeCli, banner as cliBanner, prompt as cliPrompt } from '@/netsim/cli';
import { netsimService } from '@/services/netsim.service';
import { netsimStorage } from '@/services/netsim-storage.service';
import { gradeLesson, getLesson } from '@/netsim/lessons';
import { useAuthStore } from '@/store/auth';

export type ToolMode = 'select' | 'connect' | 'delete' | 'note' | 'pan';

export interface PendingConnection {
    deviceId: string;
    interfaceId?: string;
}

export interface Toast {
    id: string;
    kind: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message?: string;
}

const MAX_HISTORY = 60;

export const useNetSimStore = defineStore('netsim', () => {
    /* ═══════════════ core state ═══════════════ */

    const topology = ref<Topology>(createTopology('Untitled network'));
    const project = ref<NetSimProject | null>(null);
    const sim = shallowRef<Simulator>(new Simulator(topology.value));

    const projects = ref<ProjectSummary[]>([]);
    const sharedProjects = ref<ProjectSummary[]>([]);
    const profile = ref<NetSimUserProfile | null>(null);
    const progress = ref<NetSimProgress | null>(null);

    const loading = ref(false);
    const saving = ref(false);
    const dirty = ref(false);
    const lastSavedAt = ref<string>('');
    const storageMessage = ref<string>('');

    /* selection + tools */
    const selectedDeviceId = ref<string | null>(null);
    const selectedLinkId = ref<string | null>(null);
    const selectedAnnotationId = ref<string | null>(null);
    const toolMode = ref<ToolMode>('select');
    const pendingConnection = ref<PendingConnection | null>(null);
    const cableChoice = ref<CableType | undefined>(undefined);

    /* simulation */
    const events = ref<SimEvent[]>([]);
    const traces = ref<PacketTrace[]>([]);
    const issues = ref<ValidationIssue[]>([]);
    const activeTraceId = ref<string | null>(null);
    const activeHopIndex = ref(0);
    const animating = ref(false);
    const animationSpeed = ref(1);
    const running = ref(false);

    /* CLI */
    const cliSessions = ref<Record<string, CliSession>>({});

    /* lessons */
    const activeLessonId = ref<string | null>(null);
    const lessonResults = ref<Array<{ id: string; task: string; ok: boolean; message: string }>>([]);
    const lessonScore = ref(0);

    /* toasts */
    const toasts = ref<Toast[]>([]);

    /* undo / redo */
    const undoStack = ref<string[]>([]);
    const redoStack = ref<string[]>([]);

    /* ═══════════════ derived ═══════════════ */

    const selectedDevice = computed<Device | null>(() =>
        topology.value.devices.find(d => d.id === selectedDeviceId.value) || null);

    const selectedLink = computed<Link | null>(() =>
        topology.value.links.find(l => l.id === selectedLinkId.value) || null);

    const activeTrace = computed<PacketTrace | null>(() =>
        traces.value.find(t => t.id === activeTraceId.value) || traces.value[traces.value.length - 1] || null);

    const activeHop = computed(() => {
        const t = activeTrace.value;
        if (!t || !t.hops.length) return null;
        return t.hops[Math.min(activeHopIndex.value, t.hops.length - 1)] || null;
    });

    const errorCount = computed(() => issues.value.filter(i => i.severity === 'error').length);
    const warningCount = computed(() => issues.value.filter(i => i.severity === 'warning').length);
    const hintCount = computed(() => issues.value.filter(i => i.severity === 'hint').length);

    const deviceById = computed(() => {
        const m = new Map<string, Device>();
        topology.value.devices.forEach(d => m.set(d.id, d));
        return m;
    });

    const stats = computed(() => {
        const subnets = new Set<string>();
        let wireless = 0;
        const vlans = new Set<number>();
        for (const d of topology.value.devices) {
            (d.vlans || []).forEach(v => vlans.add(v.id));
            for (const i of d.interfaces) {
                if (i.ipv4) subnets.add(`${i.ipv4}/${i.mask}`);
                if (i.medium === 'wireless' || i.medium === 'cellular') wireless++;
            }
        }
        return {
            devices: topology.value.devices.length,
            links: topology.value.links.length,
            vlans: vlans.size,
            wireless,
            events: events.value.length,
            traces: traces.value.length,
        };
    });

    const storageStatus = computed(() => netsimStorage.status());

    const currentUsername = computed(() => {
        try {
            const auth = useAuthStore();
            return auth.user?.username || 'anonymous';
        } catch {
            return 'anonymous';
        }
    });

    /* ═══════════════ toasts ═══════════════ */

    function toast(kind: Toast['kind'], title: string, message?: string): void {
        const t: Toast = { id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind, title, message };
        toasts.value.push(t);
        setTimeout(() => { toasts.value = toasts.value.filter(x => x.id !== t.id); }, kind === 'error' ? 9000 : 4500);
    }

    function dismissToast(id: string): void {
        toasts.value = toasts.value.filter(t => t.id !== id);
    }

    /* ═══════════════ history ═══════════════ */

    function snapshot(): void {
        try {
            undoStack.value.push(JSON.stringify(topology.value));
            if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift();
            redoStack.value = [];
        } catch { /* ignore */ }
        dirty.value = true;
    }

    function undo(): void {
        const prev = undoStack.value.pop();
        if (!prev) { toast('info', 'Nothing to undo'); return; }
        redoStack.value.push(JSON.stringify(topology.value));
        topology.value = JSON.parse(prev);
        rebuildSimulator();
        dirty.value = true;
    }

    function redo(): void {
        const next = redoStack.value.pop();
        if (!next) { toast('info', 'Nothing to redo'); return; }
        undoStack.value.push(JSON.stringify(topology.value));
        topology.value = JSON.parse(next);
        rebuildSimulator();
        dirty.value = true;
    }

    const canUndo = computed(() => undoStack.value.length > 0);
    const canRedo = computed(() => redoStack.value.length > 0);

    /* ═══════════════ simulator lifecycle ═══════════════ */

    function rebuildSimulator(): void {
        sim.value = new Simulator(topology.value);
        events.value = sim.value.events;
        traces.value = sim.value.traces;
        validate();
    }

    function recompute(): void {
        sim.value.recompute();
        validate();
    }

    function validate(): ValidationIssue[] {
        issues.value = sim.value.validate();
        return issues.value;
    }

    function syncSimOutputs(): void {
        events.value = [...sim.value.events];
        traces.value = [...sim.value.traces];
        if (traces.value.length) {
            activeTraceId.value = traces.value[traces.value.length - 1].id;
            activeHopIndex.value = 0;
        }
    }

    function resetSimulation(): void {
        sim.value.reset();
        events.value = [];
        traces.value = [];
        activeTraceId.value = null;
        activeHopIndex.value = 0;
        validate();
        toast('info', 'Simulation reset', 'MAC tables, ARP caches and NAT translations are cleared. The configuration is untouched.');
    }

    /* ═══════════════ topology editing ═══════════════ */

    function addDevice(typeId: string, x: number, y: number): Device | null {
        try {
            snapshot();
            const d = createDevice(typeId, x, y, topology.value.devices);
            topology.value.devices.push(d);
            topology.value.updatedAt = new Date().toISOString();
            recompute();
            selectedDeviceId.value = d.id;
            selectedLinkId.value = null;
            void netsimService.bumpStats(currentUsername.value, { devicesPlaced: 1 });
            return d;
        } catch (e: any) {
            toast('error', 'Could not add device', e?.message);
            return null;
        }
    }

    function moveDevice(deviceId: string, x: number, y: number, commit = false): void {
        const d = deviceById.value.get(deviceId);
        if (!d) return;
        if (commit) snapshot();
        d.x = Math.round(x);
        d.y = Math.round(y);
        if (commit) { topology.value.updatedAt = new Date().toISOString(); dirty.value = true; }
    }

    function removeDevice(deviceId: string): void {
        const d = deviceById.value.get(deviceId);
        if (!d) return;
        snapshot();
        removeDeviceFromTopology(topology.value, deviceId);
        if (selectedDeviceId.value === deviceId) selectedDeviceId.value = null;
        delete cliSessions.value[deviceId];
        recompute();
        toast('info', `${d.hostname} removed`);
    }

    function duplicateDevice(deviceId: string): void {
        const d = deviceById.value.get(deviceId);
        if (!d) return;
        snapshot();
        const copy: Device = JSON.parse(JSON.stringify(d));
        copy.id = `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        copy.x = d.x + 90;
        copy.y = d.y + 60;
        // New identities: fresh interface ids and MACs, no cables.
        copy.interfaces = copy.interfaces.map((i, idx) => ({
            ...i,
            id: `if_${Date.now().toString(36)}${idx}${Math.random().toString(36).slice(2, 5)}`,
            mac: randomMacLocal(),
            ipv4: '',
            counters: { txFrames: 0, rxFrames: 0, txBytes: 0, rxBytes: 0, drops: 0 },
        }));
        let n = 2;
        const taken = new Set(topology.value.devices.map(x => x.hostname));
        const base = d.hostname.replace(/\d+$/, '');
        while (taken.has(`${base}${n}`)) n++;
        copy.hostname = `${base}${n}`;
        copy.macTable = [];
        copy.arpTable = [];
        topology.value.devices.push(copy);
        recompute();
        selectedDeviceId.value = copy.id;
        toast('success', `${copy.hostname} created`, 'Interfaces were given new MAC addresses and cleared of IPs.');
    }

    function randomMacLocal(): string {
        const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
        return `02:5A:F0:${hex()}:${hex()}:${hex()}`;
    }

    /** Connect flow: first click stores the source, second click completes it. */
    function handleConnectClick(deviceId: string, interfaceId?: string): void {
        if (!pendingConnection.value) {
            pendingConnection.value = { deviceId, interfaceId };
            const d = deviceById.value.get(deviceId);
            toast('info', `Connecting from ${d?.hostname}`, 'Now click the device you want to connect it to.');
            return;
        }
        if (pendingConnection.value.deviceId === deviceId) {
            pendingConnection.value = null;
            toast('info', 'Connection cancelled');
            return;
        }
        makeConnection(pendingConnection.value.deviceId, pendingConnection.value.interfaceId, deviceId, interfaceId);
        pendingConnection.value = null;
    }

    function makeConnection(aDeviceId: string, aIfaceId: string | undefined, bDeviceId: string, bIfaceId?: string): boolean {
        const A = deviceById.value.get(aDeviceId);
        const B = deviceById.value.get(bDeviceId);
        if (!A || !B) return false;

        const pick = (dev: Device, wanted?: string) => {
            if (wanted) {
                const explicit = dev.interfaces.find(i => i.id === wanted);
                if (explicit) return explicit;
            }
            const free = freeInterfaces(topology.value, dev.id);
            return free[0];
        };

        const ai = pick(A, aIfaceId);
        const bi = pick(B, bIfaceId);
        if (!ai || !bi) {
            toast('error', 'No free port', `${!ai ? A.hostname : B.hostname} has no available interface. Delete a cable or pick a bigger device.`);
            return false;
        }

        const check = checkConnection(topology.value, A.id, ai.id, B.id, bi.id);
        if (!check.ok) {
            toast('error', 'Cannot connect these ports', check.reason);
            return false;
        }

        snapshot();
        const res = connectDevices(topology.value, A.id, ai.id, B.id, bi.id, cableChoice.value);
        if (!res.ok) {
            toast('error', 'Connection failed', res.reason);
            return false;
        }
        recompute();
        selectedLinkId.value = res.link!.id;
        selectedDeviceId.value = null;
        toast('success', `${A.hostname} ${ai.short} ↔ ${B.hostname} ${bi.short}`, res.warning);
        return true;
    }

    function removeLink(linkId: string): void {
        const l = topology.value.links.find(x => x.id === linkId);
        if (!l) return;
        snapshot();
        disconnectLink(topology.value, linkId);
        if (selectedLinkId.value === linkId) selectedLinkId.value = null;
        recompute();
        toast('info', 'Cable removed');
    }

    function toggleLinkSevered(linkId: string): void {
        const l = topology.value.links.find(x => x.id === linkId);
        if (!l) return;
        snapshot();
        l.severed = !l.severed;
        recompute();
        toast(l.severed ? 'warning' : 'success', l.severed ? 'Cable cut' : 'Cable restored',
            l.severed ? 'The link is down. Good way to test redundancy and spanning-tree failover.' : undefined);
    }

    function togglePower(deviceId: string): void {
        const d = deviceById.value.get(deviceId);
        if (!d) return;
        snapshot();
        d.powered = !d.powered;
        recompute();
        toast(d.powered ? 'success' : 'warning', `${d.hostname} ${d.powered ? 'powered on' : 'powered off'}`);
    }

    function addAnnotation(x: number, y: number, text = 'Note'): void {
        snapshot();
        const a: Annotation = {
            id: `ann-${Date.now().toString(36)}`,
            kind: 'note', text, x: Math.round(x), y: Math.round(y),
            w: 220, h: 110, color: '#6366f1',
        };
        topology.value.annotations.push(a);
        selectedAnnotationId.value = a.id;
        dirty.value = true;
    }

    function removeAnnotation(id: string): void {
        snapshot();
        topology.value.annotations = topology.value.annotations.filter(a => a.id !== id);
        if (selectedAnnotationId.value === id) selectedAnnotationId.value = null;
        dirty.value = true;
    }

    function markDirty(): void {
        dirty.value = true;
        topology.value.updatedAt = new Date().toISOString();
    }

    /** Called by the properties panel after any config change. */
    function applyConfigChange(label?: string): void {
        snapshot();
        markDirty();
        recompute();
        if (label) toast('success', label);
    }

    function runAutoLayout(): void {
        snapshot();
        autoLayout(topology.value);
        separateOverlaps(topology.value);
        markDirty();
        toast('success', 'Layout tidied', 'Devices are arranged by tier: WAN at the top, hosts at the bottom.');
    }

    function clearTopology(): void {
        snapshot();
        topology.value.devices = [];
        topology.value.links = [];
        topology.value.annotations = [];
        selectedDeviceId.value = null;
        selectedLinkId.value = null;
        cliSessions.value = {};
        rebuildSimulator();
        toast('info', 'Canvas cleared');
    }

    /* ═══════════════ simulation commands ═══════════════ */

    async function runPing(deviceId: string, target: string, count = 4) {
        running.value = true;
        try {
            const r = sim.value.ping(deviceId, target, { count });
            syncSimOutputs();
            validate();
            void netsimService.bumpStats(currentUsername.value, { simulationsRun: 1, packetsSent: count });
            if (r.ok) toast('success', `Ping to ${target} succeeded`, `avg ${r.avgMs} ms · ${r.trace?.hops.length || 0} hops traced`);
            else toast('error', `Ping to ${target} failed`, r.reason);
            return r;
        } finally {
            running.value = false;
        }
    }

    async function runTraceroute(deviceId: string, target: string) {
        running.value = true;
        try {
            const r = sim.value.traceroute(deviceId, target);
            syncSimOutputs();
            if (r.ok) toast('success', `Traceroute to ${target} complete`, `${r.hops.length} hops`);
            else toast('warning', `Traceroute to ${target} incomplete`);
            return r;
        } finally {
            running.value = false;
        }
    }

    async function runDhcp(deviceId: string) {
        running.value = true;
        try {
            const r = sim.value.dhcpRequest(deviceId);
            syncSimOutputs();
            validate();
            markDirty();
            if (r.ok) toast('success', 'DHCP lease obtained', `${deviceById.value.get(deviceId)?.hostname} → ${r.ip}`);
            else toast('error', 'DHCP failed', r.reason);
            return r;
        } finally {
            running.value = false;
        }
    }

    async function runDns(deviceId: string, name: string) {
        running.value = true;
        try {
            const r = sim.value.dnsResolve(deviceId, name);
            syncSimOutputs();
            if (r.ok) toast('success', `${name} resolved`, `→ ${r.ip}`);
            else toast('error', `Could not resolve ${name}`, r.reason);
            return r;
        } finally {
            running.value = false;
        }
    }

    async function runHttp(deviceId: string, url: string) {
        running.value = true;
        try {
            const r = sim.value.httpGet(deviceId, url);
            syncSimOutputs();
            if (r.ok) toast('success', `${url} → 200 OK`, 'Open the trace to step through the TCP handshake.');
            else toast('error', `Request to ${url} failed`, r.reason);
            return r;
        } finally {
            running.value = false;
        }
    }

    /** Run everything that can be verified, in one click. */
    async function runFullSimulation() {
        running.value = true;
        try {
            sim.value.reset();
            const hosts = topology.value.devices.filter(d => d.interfaces.some(i => i.dhcp && !i.ipv4));
            for (const h of hosts) sim.value.dhcpRequest(h.id);

            const addressed = topology.value.devices.filter(d => d.interfaces.some(i => i.ipv4));
            let attempted = 0;
            let succeeded = 0;
            for (const a of addressed) {
                for (const b of addressed) {
                    if (a.id === b.id || attempted >= 12) continue;
                    const target = b.interfaces.find(i => i.ipv4)?.ipv4;
                    if (!target) continue;
                    attempted++;
                    const r = sim.value.ping(a.id, target, { count: 1, quiet: true });
                    if (r.ok) succeeded++;
                }
            }
            syncSimOutputs();
            validate();
            toast(succeeded > 0 ? 'success' : 'warning', 'Simulation complete',
                `${succeeded} of ${attempted} host pairs can reach each other. ${errorCount.value} error(s), ${warningCount.value} warning(s) found.`);
            void netsimService.bumpStats(currentUsername.value, { simulationsRun: 1, packetsSent: attempted });
        } finally {
            running.value = false;
        }
    }

    /* ═══════════════ CLI ═══════════════ */

    function getCliSession(deviceId: string): CliSession {
        let s = cliSessions.value[deviceId];
        if (!s) {
            s = createSession(deviceId);
            const d = deviceById.value.get(deviceId);
            if (d) s.lines = cliBanner(d);
            cliSessions.value[deviceId] = s;
        }
        return s;
    }

    function runCli(deviceId: string, command: string): CliLine[] {
        const session = getCliSession(deviceId);
        const out = executeCli(sim.value, session, command);
        session.lines = [...session.lines, ...out].slice(-600);
        syncSimOutputs();
        validate();
        markDirty();
        return out;
    }

    function cliPromptFor(deviceId: string): string {
        const d = deviceById.value.get(deviceId);
        if (!d) return '>';
        return cliPrompt(getCliSession(deviceId), d);
    }

    function clearCli(deviceId: string): void {
        const s = getCliSession(deviceId);
        const d = deviceById.value.get(deviceId);
        s.lines = d ? cliBanner(d) : [];
    }

    /* ═══════════════ projects ═══════════════ */

    async function loadProjects(): Promise<void> {
        loading.value = true;
        try {
            // Discover the backend storage proxy before the first read, so the UI
            // reports the mode it will actually use.
            await netsimStorage.ensureReady();
            const res = await netsimService.listProjects(currentUsername.value);
            projects.value = res.projects;
            if (res.local && !netsimStorage.isConfigured()) {
                storageMessage.value = 'Projects are being kept in this browser only. Open Storage settings on the Network Simulator hub to sync them to the data repository.';
            } else if (res.local) {
                storageMessage.value = 'Showing locally cached projects — the data repository is not reachable right now.';
            } else {
                storageMessage.value = '';
            }
        } finally {
            loading.value = false;
        }
    }

    async function loadSharedProjects(): Promise<void> {
        sharedProjects.value = await netsimService.listSharedProjects();
    }

    async function loadProfileAndProgress(): Promise<void> {
        const auth = (() => { try { return useAuthStore(); } catch { return null; } })();
        profile.value = await netsimService.getProfile(currentUsername.value, {
            displayName: auth?.user?.first_name ? `${auth.user.first_name} ${auth.user.last_name || ''}`.trim() : auth?.user?.username,
            email: auth?.user?.email,
        });
        progress.value = await netsimService.getProgress(currentUsername.value);
        if (profile.value?.preferences) {
            topology.value.canvas.grid = profile.value.preferences.showGrid;
            topology.value.canvas.snap = profile.value.preferences.snapToGrid;
            animationSpeed.value = profile.value.preferences.animationSpeed || 1;
        }
    }

    function openTopology(t: Topology, p: NetSimProject | null = null): void {
        topology.value = t;
        project.value = p;
        selectedDeviceId.value = null;
        selectedLinkId.value = null;
        pendingConnection.value = null;
        cliSessions.value = {};
        undoStack.value = [];
        redoStack.value = [];
        dirty.value = false;
        rebuildSimulator();
    }

    async function openProject(projectId: string): Promise<boolean> {
        loading.value = true;
        try {
            const p = await netsimService.getProject(currentUsername.value, projectId);
            if (!p) {
                toast('error', 'Project not found', 'It may have been deleted, or the data repository is unreachable.');
                return false;
            }
            openTopology(p.topology, p);
            lastSavedAt.value = p.updatedAt;
            if (p.lessonId) activeLessonId.value = p.lessonId;
            toast('success', `Opened "${p.name}"`, `${p.deviceCount} devices · ${p.linkCount} links`);
            return true;
        } finally {
            loading.value = false;
        }
    }

    async function newProject(name: string, description = '', templateId?: string, lessonId?: string): Promise<NetSimProject | null> {
        loading.value = true;
        try {
            const t = templateId ? buildTemplate(templateId) : createTopology(name, description);
            if (!t) { toast('error', 'Unknown template'); return null; }
            t.name = name;
            if (description) t.description = description;

            const p = netsimService.createProject({
                owner: currentUsername.value,
                name, description,
                topology: t,
                lessonId,
            });
            openTopology(p.topology, p);
            activeLessonId.value = lessonId || null;
            const res = await netsimService.saveProject(currentUsername.value, p);
            lastSavedAt.value = p.updatedAt;
            dirty.value = false;
            await loadProjects();
            void netsimService.bumpStats(currentUsername.value, { projects: 1 });
            toast(res.ok ? 'success' : 'warning', `Created "${name}"`,
                res.ok ? undefined : `Saved in this browser only — ${res.error || 'the data repository is unreachable.'}`);
            return p;
        } finally {
            loading.value = false;
        }
    }

    async function saveProject(): Promise<boolean> {
        if (!project.value) {
            toast('error', 'No project open', 'Create or open a project before saving.');
            return false;
        }
        saving.value = true;
        try {
            project.value.topology = topology.value;
            const res = await netsimService.saveProject(currentUsername.value, project.value);
            if (res.ok) {
                dirty.value = false;
                lastSavedAt.value = project.value.updatedAt;
                storageMessage.value = '';
                toast('success', 'Saved', netsimStorage.isConfigured() ? `Committed to ${netsimStorage.repoSlug}` : 'Stored in this browser.');
            } else {
                dirty.value = false;
                lastSavedAt.value = project.value.updatedAt;
                storageMessage.value = res.error || 'The data repository is unreachable; your work is safe in this browser.';
                toast('warning', 'Saved locally only', storageMessage.value);
            }
            await loadProjects();
            return res.ok;
        } finally {
            saving.value = false;
        }
    }

    async function deleteProject(projectId: string): Promise<void> {
        const res = await netsimService.deleteProject(currentUsername.value, projectId);
        if (project.value?.id === projectId) {
            project.value = null;
            openTopology(createTopology('Untitled network'));
        }
        await loadProjects();
        toast(res.ok ? 'success' : 'warning', res.ok ? 'Project deleted' : 'Deleted locally only', res.error);
    }

    async function duplicateProject(projectId: string): Promise<void> {
        const copy = await netsimService.duplicateProject(currentUsername.value, projectId);
        await loadProjects();
        toast(copy ? 'success' : 'error', copy ? `Duplicated as "${copy.name}"` : 'Could not duplicate the project');
    }

    async function shareProject(): Promise<void> {
        if (!project.value) return;
        project.value.topology = topology.value;
        const res = await netsimService.shareProject(currentUsername.value, project.value);
        toast(res.ok ? 'success' : 'error', res.ok ? 'Shared with the community' : 'Could not share', res.error);
        await loadSharedProjects();
    }

    async function unshareProject(): Promise<void> {
        if (!project.value) return;
        const res = await netsimService.unshareProject(currentUsername.value, project.value.id);
        toast(res.ok ? 'success' : 'error', res.ok ? 'No longer shared' : 'Could not unshare', res.error);
        await loadSharedProjects();
    }

    async function cloneShared(projectId: string): Promise<void> {
        const copy = await netsimService.cloneSharedProject(currentUsername.value, projectId);
        if (copy) {
            await loadProjects();
            toast('success', `Copied "${copy.name}" into your projects`);
        } else {
            toast('error', 'Could not copy that project');
        }
    }

    async function addCheckpoint(label: string): Promise<void> {
        if (!project.value) return;
        project.value.topology = topology.value;
        await netsimService.addCheckpoint(currentUsername.value, project.value, label);
        toast('success', 'Checkpoint saved', 'You can restore this snapshot from the project menu.');
    }

    function restoreCheckpoint(checkpointId: string): void {
        const cp = project.value?.checkpoints?.find(c => c.id === checkpointId);
        if (!cp) return;
        snapshot();
        topology.value = cloneTopology(cp.topology);
        rebuildSimulator();
        toast('success', `Restored "${cp.label}"`);
    }

    /* ═══════════════ templates / import / export / AI ═══════════════ */

    function loadTemplate(templateId: string): void {
        const t = buildTemplate(templateId);
        if (!t) { toast('error', 'Unknown template'); return; }
        snapshot();
        topology.value = t;
        if (project.value) {
            project.value.topology = t;
            project.value.name = t.name;
        }
        rebuildSimulator();
        markDirty();
        toast('success', `Loaded "${t.name}"`, `${t.devices.length} devices ready to explore.`);
    }

    function applyAiSpec(spec: AiTopologySpec, mode: 'replace' | 'merge' = 'replace'): boolean {
        const res = topologyFromAiSpec(spec);
        if (!res.ok || !res.topology) {
            toast('error', 'Could not build that topology', res.reason);
            return false;
        }
        snapshot();
        if (mode === 'replace') {
            const keepId = topology.value.id;
            topology.value = res.topology;
            topology.value.id = keepId;
        } else {
            // Offset the new devices so they do not land on top of the old ones.
            const maxY = Math.max(0, ...topology.value.devices.map(d => d.y));
            res.topology.devices.forEach(d => { d.y += maxY + 160; });
            topology.value.devices.push(...res.topology.devices);
            topology.value.links.push(...res.topology.links);
            separateOverlaps(topology.value);
        }
        if (project.value) project.value.topology = topology.value;
        rebuildSimulator();
        markDirty();

        const warnCount = res.warnings.length;
        toast(warnCount ? 'warning' : 'success',
            `AI built ${res.topology.devices.length} devices`,
            warnCount ? `${warnCount} note(s): ${res.warnings.slice(0, 2).join(' · ')}` : 'Run the simulation to see whether it actually works.');
        if (warnCount) res.warnings.forEach(w => console.warn('[netsim/ai]', w));
        return true;
    }

    function exportJson(): string {
        return exportTopology(topology.value);
    }

    function importJson(json: string): boolean {
        const res = importTopology(json);
        if (!res.ok || !res.topology) {
            toast('error', 'Import failed', res.reason);
            return false;
        }
        snapshot();
        topology.value = res.topology;
        if (project.value) project.value.topology = res.topology;
        rebuildSimulator();
        markDirty();
        toast('success', 'Topology imported', `${res.topology.devices.length} devices, ${res.topology.links.length} links.`);
        return true;
    }

    /* ═══════════════ lessons ═══════════════ */

    function setActiveLesson(lessonId: string | null): void {
        activeLessonId.value = lessonId;
        lessonResults.value = [];
        lessonScore.value = 0;
        if (lessonId && project.value) project.value.lessonId = lessonId;
    }

    async function checkLesson(): Promise<void> {
        const lesson: Lesson | undefined = activeLessonId.value ? getLesson(activeLessonId.value) : undefined;
        if (!lesson) { toast('info', 'No lesson selected'); return; }
        validate();
        const graded = gradeLesson(sim.value, lesson);
        lessonResults.value = graded.results;
        lessonScore.value = graded.score;
        syncSimOutputs();

        progress.value = await netsimService.recordLessonAttempt(currentUsername.value, lesson.id, graded.score);

        if (graded.score >= 100) {
            toast('success', `Lesson complete — ${lesson.title}`, `All ${graded.total} tasks verified against your live network.`);
        } else {
            const firstFail = graded.results.find(r => !r.ok);
            toast('warning', `${graded.passed} of ${graded.total} tasks done`, firstFail?.message);
        }
    }

    /* ═══════════════ animation ═══════════════ */

    let animTimer: number | null = null;

    function playTrace(traceId?: string): void {
        const t = traceId ? traces.value.find(x => x.id === traceId) : activeTrace.value;
        if (!t || !t.hops.length) { toast('info', 'Nothing to animate', 'Run a ping or fetch a page first.'); return; }
        activeTraceId.value = t.id;
        activeHopIndex.value = 0;
        animating.value = true;
        stopAnimation();
        const interval = Math.max(180, 900 / Math.max(0.25, animationSpeed.value));
        animTimer = window.setInterval(() => {
            if (activeHopIndex.value >= t.hops.length - 1) { stopAnimation(); return; }
            activeHopIndex.value += 1;
        }, interval);
    }

    function stopAnimation(): void {
        if (animTimer !== null) { clearInterval(animTimer); animTimer = null; }
        animating.value = false;
    }

    function stepHop(delta: number): void {
        const t = activeTrace.value;
        if (!t) return;
        stopAnimation();
        activeHopIndex.value = Math.max(0, Math.min(t.hops.length - 1, activeHopIndex.value + delta));
    }

    function selectTrace(traceId: string): void {
        activeTraceId.value = traceId;
        activeHopIndex.value = 0;
        stopAnimation();
    }

    /* ═══════════════ selection helpers ═══════════════ */

    function select(deviceId: string | null): void {
        selectedDeviceId.value = deviceId;
        selectedLinkId.value = null;
        selectedAnnotationId.value = null;
    }

    function selectLink(linkId: string | null): void {
        selectedLinkId.value = linkId;
        selectedDeviceId.value = null;
        selectedAnnotationId.value = null;
    }

    function setTool(mode: ToolMode): void {
        toolMode.value = mode;
        if (mode !== 'connect') pendingConnection.value = null;
    }

    /* Persist preference changes without spamming the repo. */
    let prefTimer: number | null = null;
    watch(() => profile.value?.preferences, () => {
        if (!profile.value) return;
        if (prefTimer !== null) clearTimeout(prefTimer);
        prefTimer = window.setTimeout(() => { void netsimService.saveProfile(profile.value!); }, 1500);
    }, { deep: true });

    return {
        /* state */
        topology, project, sim, projects, sharedProjects, profile, progress,
        loading, saving, dirty, lastSavedAt, storageMessage,
        selectedDeviceId, selectedLinkId, selectedAnnotationId, toolMode,
        pendingConnection, cableChoice,
        events, traces, issues, activeTraceId, activeHopIndex, animating,
        animationSpeed, running,
        cliSessions, activeLessonId, lessonResults, lessonScore, toasts,

        /* derived */
        selectedDevice, selectedLink, activeTrace, activeHop,
        errorCount, warningCount, hintCount, deviceById, stats,
        storageStatus, currentUsername, canUndo, canRedo,

        /* actions */
        toast, dismissToast,
        snapshot, undo, redo,
        rebuildSimulator, recompute, validate, resetSimulation, syncSimOutputs,
        addDevice, moveDevice, removeDevice, duplicateDevice,
        handleConnectClick, makeConnection, removeLink, toggleLinkSevered, togglePower,
        addAnnotation, removeAnnotation, markDirty, applyConfigChange,
        runAutoLayout, clearTopology,
        runPing, runTraceroute, runDhcp, runDns, runHttp, runFullSimulation,
        getCliSession, runCli, cliPromptFor, clearCli,
        loadProjects, loadSharedProjects, loadProfileAndProgress,
        openTopology, openProject, newProject, saveProject, deleteProject,
        duplicateProject, shareProject, unshareProject, cloneShared,
        addCheckpoint, restoreCheckpoint,
        loadTemplate, applyAiSpec, exportJson, importJson,
        setActiveLesson, checkLesson,
        playTrace, stopAnimation, stepHop, selectTrace,
        select, selectLink, setTool,
    };
});
