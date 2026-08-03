/**
 * src/netsim/topology.ts
 * Factories and mutations for topologies: creating devices with realistic
 * default interfaces, cabling them, validating a connection before it is made,
 * auto-layout, JSON import/export, the starter template library, and the
 * translation layer that turns an AI-generated JSON spec into a real topology.
 */

import type {
    Topology, Device, NetInterface, Link, CableType, DeviceTypeDef,
    Vlan, ServerServices, RoutingConfig, NatConfig, StpConfig, HostConfig,
    WirelessConfig, TopologyTemplate, Annotation,
} from './types';
import { getDeviceType, hostnamePrefix, suggestCable, DEVICE_TYPES } from './devices';
import { randomMac, prefixToMask, isValidIPv4, maskToPrefix, longToIp, ipToLong } from './ip';

let seq = 0;
function nid(p: string): string {
    seq += 1;
    return `${p}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const SCHEMA_VERSION = 1;

/* ─────────────────────── interface construction ─────────────────────── */

function expandPorts(type: DeviceTypeDef): NetInterface[] {
    const out: NetInterface[] = [];
    for (const tpl of type.ports) {
        for (let i = 0; i < tpl.count; i++) {
            const name = tpl.pattern.replace('{i}', String(i));
            const short = tpl.short.replace('{i}', String(i));
            const isWireless = tpl.medium === 'wireless' || tpl.medium === 'cellular';
            const routedByDefault = !!tpl.routed ||
                type.role === 'router' || type.role === 'firewall' || type.role === 'host' ||
                type.role === 'server' || type.role === 'cloud' || type.role === 'nas' ||
                type.role === 'loadbalancer' || type.role === 'modem';

            out.push({
                id: nid('if'),
                name,
                short,
                medium: tpl.medium,
                speedMbps: tpl.speedMbps,
                mac: randomMac(),
                // Routers ship with every wired interface shut down; radios and
                // cellular modems come up on their own, like real hardware.
                enabled: isWireless || !(type.role === 'router' || type.role === 'firewall'),
                dhcp: type.role === 'host' && !isWireless ? true : type.role === 'host',
                ipv4: '',
                mask: '255.255.255.0',
                ipv6: '',
                prefix6: 64,
                slaac: false,
                mode: routedByDefault ? 'routed' : 'access',
                accessVlan: 1,
                nativeVlan: 1,
                trunkVlans: [],
                duplex: 'auto',
                mtu: 1500,
                description: '',
                natRole: 'none',
                aclIn: '',
                aclOut: '',
                ...(isWireless ? { ssid: '', passphrase: '', band: (tpl.medium === 'cellular' ? '5GHz' : '5GHz') as '5GHz' } : {}),
                counters: { txFrames: 0, rxFrames: 0, txBytes: 0, rxBytes: 0, drops: 0 },
            });
        }
    }
    return out;
}

function defaultServices(type: DeviceTypeDef): ServerServices {
    const on = (k: string) => (type.defaultServices || []).includes(k as any);
    return {
        dhcp: { enabled: on('dhcp'), pools: [], leases: [] },
        dns: { enabled: on('dns'), records: [], forwarder: '' },
        http: {
            enabled: on('http') || on('https'),
            port: 80,
            title: type.name,
            body: `<h1>${type.name}</h1><p>This page is served by the Network Simulator.</p>`,
            tls: on('https'),
        },
        ftp: { enabled: on('ftp'), port: 21, files: ['readme.txt', 'ios-image.bin'] },
        smtp: { enabled: on('smtp'), port: 25, domain: 'selfstudy.local' },
        ntp: { enabled: on('ntp') },
        syslog: { enabled: on('syslog') },
        radius: { enabled: false, secret: '' },
        mqtt: { enabled: on('mqtt'), port: 1883, topics: ['sensors/#'] },
    };
}

function defaultRouting(): RoutingConfig {
    return {
        staticRoutes: [],
        defaultGateway: '',
        rip: { enabled: false, version: 2, networks: [] },
        ospf: { enabled: false, processId: 1, routerId: '', networks: [] },
        learned: [],
    };
}

function defaultNat(): NatConfig {
    return { enabled: false, mode: 'pat', staticMappings: [], translations: [] };
}

function defaultStp(type: DeviceTypeDef): StpConfig {
    return {
        enabled: !!type.supports.stp,
        mode: 'rapid-pvst',
        priority: 32768,
        portRoles: {},
    };
}

function defaultHost(): HostConfig {
    return { dhcp: true, defaultGateway: '', dnsServer: '' };
}

/**
 * Only infrastructure that *broadcasts* an SSID gets a wireless block. Clients
 * carry their SSID and passphrase on the radio interface itself, which is how
 * the engine tells an AP from a station.
 */
const SSID_BROADCASTING_ROLES = new Set(['ap', 'wlc', 'router', 'repeater', 'modem']);

function defaultWireless(type: DeviceTypeDef): WirelessConfig | undefined {
    if (!type.supports.wireless) return undefined;
    if (!SSID_BROADCASTING_ROLES.has(type.role)) return undefined;
    if (!type.ports.some(p => p.medium === 'wireless' || p.medium === 'cellular')) return undefined;
    const isWifi7 = type.id === 'ap-wifi7';
    return {
        ssid: 'SelfStudy-WiFi',
        hidden: false,
        security: isWifi7 ? 'wpa3-personal' : 'wpa2-personal',
        passphrase: 'SelfStudy2026',
        band: isWifi7 ? '6GHz' : '5GHz',
        channel: isWifi7 ? 37 : 36,
        channelWidthMHz: isWifi7 ? 160 : 80,
        standard: isWifi7 ? '802.11be' : '802.11ax',
        txPowerDbm: 17,
        coverageRadius: 260,
        vlanId: undefined,
        maxClients: 128,
    };
}

export const DEFAULT_VLANS: Vlan[] = [
    { id: 1, name: 'default', color: '#64748b' },
];

export const VLAN_PALETTE = [
    '#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa',
    '#fb7185', '#4ade80', '#facc15', '#22d3ee', '#c084fc',
];

/* ─────────────────────── device / topology factories ─────────────────────── */

export function createDevice(typeId: string, x: number, y: number, existing: Device[] = []): Device {
    const type = getDeviceType(typeId);
    if (!type) throw new Error(`Unknown device type: ${typeId}`);

    const prefix = hostnamePrefix(type);
    let n = 1;
    const taken = new Set(existing.map(d => d.hostname.toUpperCase()));
    while (taken.has(`${prefix}${n}`)) n++;
    const hostname = `${prefix}${n}`;

    const device: Device = {
        id: nid('dev'),
        typeId,
        name: type.name,
        hostname,
        x: Math.round(x),
        y: Math.round(y),
        powered: true,
        notes: '',
        interfaces: expandPorts(type),
        vlans: type.supports.vlans ? [...DEFAULT_VLANS] : [],
        stp: defaultStp(type),
        routing: defaultRouting(),
        acls: [],
        nat: defaultNat(),
        services: defaultServices(type),
        wireless: defaultWireless(type),
        host: defaultHost(),
        macTable: [],
        arpTable: [],
    };

    // Sensible starting posture per role so a fresh drop is not useless.
    if (type.role === 'switch' || type.role === 'multilayer') {
        device.interfaces.forEach(i => {
            if (i.medium === 'console') return;
            i.mode = i.speedMbps >= 10000 ? 'trunk' : 'access';
            if (i.mode === 'trunk') i.trunkVlans = [];
        });
    }
    if (type.role === 'router' || type.role === 'firewall') {
        device.interfaces.forEach(i => { i.mode = 'routed'; i.dhcp = false; });
    }
    if (type.role === 'cloud') {
        // A cloud is a black box: everything attached to it is reachable through
        // it, so its ports behave as one bridged segment rather than as separate
        // routed links.
        device.interfaces.forEach(i => { i.mode = 'access'; i.accessVlan = 1; i.enabled = true; i.dhcp = false; });
        // Give it a public address so pings have something to hit.
        if (device.interfaces[0]) {
            device.interfaces[0].ipv4 = '203.0.113.1';
            device.interfaces[0].mask = '255.255.255.0';
        }
    }
    if (type.role === 'server' || type.role === 'nas' || type.role === 'loadbalancer') {
        device.interfaces.forEach(i => { i.dhcp = false; });
        device.host.dhcp = false;
    }
    if (type.id === 'router-soho' || type.id === 'cpe-5g') {
        // The classic all-in-one box: a routed WAN port plus a built-in switch on
        // the LAN side, all bridged with the radios into one segment. The LAN
        // address is the gateway for everything behind it.
        const wan = device.interfaces.find(i => i.name.startsWith('WAN') || i.medium === 'cellular');
        if (wan) { wan.dhcp = true; wan.natRole = 'outside'; wan.enabled = true; wan.mode = 'routed'; }
        device.interfaces
            .filter(i => i.name.startsWith('LAN'))
            .forEach(i => { i.natRole = 'inside'; i.enabled = true; i.mode = 'access'; i.accessVlan = 1; i.dhcp = false; });
        // The radios are bridged into the same LAN segment as the wired ports —
        // that is what makes it one network and not two.
        device.interfaces
            .filter(i => i.medium === 'wireless')
            .forEach(i => { i.natRole = 'inside'; i.enabled = true; i.mode = 'access'; i.accessVlan = 1; i.dhcp = false; });
        const lan = device.interfaces.find(i => i.name.startsWith('LAN'));
        if (lan) { lan.ipv4 = '192.168.1.1'; lan.mask = '255.255.255.0'; }
        device.nat = { enabled: true, mode: 'pat', staticMappings: [], translations: [] };
        device.services.dhcp = {
            enabled: true,
            pools: [{
                id: nid('pool'), name: 'LAN', network: '192.168.1.0', mask: '255.255.255.0',
                rangeStart: '192.168.1.100', rangeEnd: '192.168.1.200',
                gateway: '192.168.1.1', dnsServer: '192.168.1.1', domain: 'home.local',
                leaseHours: 24, excluded: ['192.168.1.1'],
            }],
            leases: [],
        };
    }
    if (device.wireless && (type.id === 'router-soho' || type.id === 'cpe-5g')) {
        device.wireless.ssid = 'SelfStudy-Home';
        device.wireless.band = '5GHz';
        device.wireless.security = 'wpa2-personal';
    }

    return device;
}

export function createTopology(name = 'Untitled network', description = ''): Topology {
    const now = new Date().toISOString();
    return {
        id: nid('topo'),
        name,
        description,
        devices: [],
        links: [],
        annotations: [],
        canvas: { zoom: 1, panX: 0, panY: 0, grid: true, snap: true },
        createdAt: now,
        updatedAt: now,
        schemaVersion: SCHEMA_VERSION,
    };
}

/* ─────────────────────── cabling ─────────────────────── */

export interface ConnectCheck {
    ok: boolean;
    reason?: string;
    warning?: string;
    cable: CableType;
}

export function checkConnection(
    topology: Topology,
    aDeviceId: string, aIfaceId: string,
    bDeviceId: string, bIfaceId: string
): ConnectCheck {
    const A = topology.devices.find(d => d.id === aDeviceId);
    const B = topology.devices.find(d => d.id === bDeviceId);
    const ai = A?.interfaces.find(i => i.id === aIfaceId);
    const bi = B?.interfaces.find(i => i.id === bIfaceId);

    if (!A || !B || !ai || !bi) return { ok: false, reason: 'Interface not found', cable: 'straight-through' };
    if (aDeviceId === bDeviceId) return { ok: false, reason: 'A device cannot be cabled to itself', cable: 'straight-through' };

    const used = (ifaceId: string) => topology.links.some(l => l.aInterfaceId === ifaceId || l.bInterfaceId === ifaceId);
    if (used(aIfaceId)) return { ok: false, reason: `${A.hostname} ${ai.short} already has a cable`, cable: 'straight-through' };
    if (used(bIfaceId)) return { ok: false, reason: `${B.hostname} ${bi.short} already has a cable`, cable: 'straight-through' };

    if (ai.medium === 'wireless' || bi.medium === 'wireless') {
        return { ok: false, reason: 'Radios associate over the air — set a matching SSID instead of dragging a cable.', cable: 'wireless' };
    }

    // A cloud stands in for the provider network, so it accepts whatever the
    // last mile happens to be: copper, fibre, coax or a serial circuit.
    const roleA0 = getDeviceType(A.typeId)?.role;
    const roleB0 = getDeviceType(B.typeId)?.role;
    const eitherIsCloud = roleA0 === 'cloud' || roleB0 === 'cloud';

    const fam = (m: string) => (m === 'fiber' || m === 'sfp' ? 'optical' : m === 'copper-ethernet' || m === 'poe' ? 'copper' : m);
    if (!eitherIsCloud && fam(ai.medium) !== fam(bi.medium)) {
        return {
            ok: false,
            reason: `Cannot connect ${ai.medium} to ${bi.medium}. Copper goes to copper, fiber to fiber, serial to serial.`,
            cable: 'straight-through',
        };
    }

    const cable = suggestCable(ai.medium, bi.medium) as CableType;

    // Crossover teaching hint: like-devices historically needed a crossover.
    const likeDevices =
        (isEndpointRole(roleA0) && isEndpointRole(roleB0)) ||
        (roleA0 === 'switch' && roleB0 === 'switch') ||
        (roleA0 === 'router' && roleB0 === 'router');
    const warning = likeDevices && cable === 'straight-through'
        ? 'Two similar devices classically needed a crossover cable. Modern ports auto-negotiate (Auto-MDIX), so straight-through works — but know why the rule existed.'
        : undefined;

    return { ok: true, cable, warning };
}

function isEndpointRole(r?: string): boolean {
    return r === 'host' || r === 'server' || r === 'nas' || r === 'loadbalancer';
}

export function connect(
    topology: Topology,
    aDeviceId: string, aIfaceId: string,
    bDeviceId: string, bIfaceId: string,
    cable?: CableType
): { ok: boolean; link?: Link; reason?: string; warning?: string } {
    const check = checkConnection(topology, aDeviceId, aIfaceId, bDeviceId, bIfaceId);
    if (!check.ok) return { ok: false, reason: check.reason };

    const ai = topology.devices.find(d => d.id === aDeviceId)!.interfaces.find(i => i.id === aIfaceId)!;
    const bi = topology.devices.find(d => d.id === bDeviceId)!.interfaces.find(i => i.id === bIfaceId)!;

    const link: Link = {
        id: nid('link'),
        aDeviceId, aInterfaceId: aIfaceId,
        bDeviceId, bInterfaceId: bIfaceId,
        cable: cable || check.cable,
        severed: false,
        latencyMs: latencyFor(check.cable),
        bandwidthMbps: Math.min(ai.speedMbps || 1000, bi.speedMbps || 1000),
        lossPct: 0,
        label: '',
        status: 'up',
    };
    topology.links.push(link);
    topology.updatedAt = new Date().toISOString();
    return { ok: true, link, warning: check.warning };
}

function latencyFor(cable: CableType): number {
    switch (cable) {
        case 'serial-dce':
        case 'serial-dte': return 12;
        case 'coaxial': return 6;
        case 'cellular': return 28;
        case 'wireless': return 2;
        case 'fiber-single-mode': return 0.3;
        case 'fiber-multi-mode': return 0.4;
        default: return 0.5;
    }
}

export function disconnect(topology: Topology, linkId: string): void {
    topology.links = topology.links.filter(l => l.id !== linkId);
    topology.updatedAt = new Date().toISOString();
}

export function removeDevice(topology: Topology, deviceId: string): void {
    topology.devices = topology.devices.filter(d => d.id !== deviceId);
    topology.links = topology.links.filter(l => l.aDeviceId !== deviceId && l.bDeviceId !== deviceId);
    topology.updatedAt = new Date().toISOString();
}

export function freeInterfaces(topology: Topology, deviceId: string): NetInterface[] {
    const d = topology.devices.find(x => x.id === deviceId);
    if (!d) return [];
    const used = new Set(topology.links.flatMap(l => [l.aInterfaceId, l.bInterfaceId]));
    return d.interfaces.filter(i => !used.has(i.id) && i.medium !== 'console' && i.medium !== 'wireless' && i.medium !== 'cellular');
}

export function firstFreeInterface(topology: Topology, deviceId: string, preferSpeed?: 'fast' | 'slow'): NetInterface | undefined {
    const free = freeInterfaces(topology, deviceId);
    if (!free.length) return undefined;
    if (preferSpeed === 'fast') return [...free].sort((a, b) => b.speedMbps - a.speedMbps)[0];
    return free[0];
}

/* ─────────────────────── layout ─────────────────────── */

/**
 * Tier-aware auto-layout: clouds/WAN at the top, then routers/firewalls,
 * distribution, access switches, and hosts at the bottom. Produces the shape a
 * network engineer expects to see on a diagram.
 */
export function autoLayout(topology: Topology, width = 1400, height = 800): void {
    const tierOf = (d: Device): number => {
        const role = getDeviceType(d.typeId)?.role;
        switch (role) {
            case 'cloud': return 0;
            case 'modem': return 1;
            case 'firewall': return 2;
            case 'router': return 2;
            case 'multilayer': return 3;
            case 'wlc': return 3;
            case 'switch': return 4;
            case 'hub': return 4;
            case 'ap': return 5;
            case 'repeater': return 5;
            default: return 6;
        }
    };

    const tiers = new Map<number, Device[]>();
    for (const d of topology.devices) {
        const t = tierOf(d);
        tiers.set(t, [...(tiers.get(t) || []), d]);
    }

    const usedTiers = Array.from(tiers.keys()).sort((a, b) => a - b);
    const rowGap = usedTiers.length > 1 ? Math.min(180, (height - 160) / (usedTiers.length - 1)) : 0;

    usedTiers.forEach((t, rowIdx) => {
        const row = tiers.get(t)!;
        const colGap = Math.min(200, (width - 200) / Math.max(1, row.length));
        const startX = (width - colGap * (row.length - 1)) / 2;
        row.forEach((d, i) => {
            d.x = Math.round(startX + i * colGap);
            d.y = Math.round(90 + rowIdx * rowGap);
        });
    });

    topology.updatedAt = new Date().toISOString();
}

/** Nudge overlapping devices apart — cheap but effective. */
export function separateOverlaps(topology: Topology, minDist = 110): void {
    for (let pass = 0; pass < 30; pass++) {
        let moved = false;
        for (let i = 0; i < topology.devices.length; i++) {
            for (let j = i + 1; j < topology.devices.length; j++) {
                const a = topology.devices[i], b = topology.devices[j];
                const dx = b.x - a.x, dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                if (dist < minDist) {
                    const push = (minDist - dist) / 2;
                    const ux = dx / dist, uy = dy / dist;
                    a.x -= ux * push; a.y -= uy * push;
                    b.x += ux * push; b.y += uy * push;
                    moved = true;
                }
            }
        }
        if (!moved) break;
    }
    topology.devices.forEach(d => { d.x = Math.round(d.x); d.y = Math.round(d.y); });
}

/* ─────────────────────── import / export ─────────────────────── */

export function exportTopology(t: Topology): string {
    return JSON.stringify(sanitizeForStorage(t), null, 2);
}

/** Strip runtime-only state so stored JSON stays small and diff-friendly. */
export function sanitizeForStorage(t: Topology): Topology {
    return {
        ...t,
        devices: t.devices.map(d => ({
            ...d,
            macTable: [],
            arpTable: [],
            stp: { ...d.stp, portRoles: {}, isRoot: undefined, rootBridgeId: undefined },
            nat: { ...d.nat, translations: [] },
            routing: { ...d.routing, learned: [] },
            services: { ...d.services, dhcp: { ...d.services.dhcp, leases: [] } },
            interfaces: d.interfaces.map(i => ({ ...i, counters: undefined, up: undefined })),
        })),
        links: t.links.map(l => ({ ...l, status: undefined, blockedEndDeviceId: undefined })),
    };
}

export function importTopology(json: string | object): { ok: boolean; topology?: Topology; reason?: string } {
    try {
        const raw = typeof json === 'string' ? JSON.parse(json) : json;
        if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Not a JSON object' };
        if (!Array.isArray(raw.devices)) return { ok: false, reason: 'Missing "devices" array' };

        const topology = createTopology(raw.name || 'Imported network', raw.description || '');
        topology.canvas = { ...topology.canvas, ...(raw.canvas || {}) };
        topology.annotations = Array.isArray(raw.annotations) ? raw.annotations : [];

        const idMap = new Map<string, string>();
        const ifMap = new Map<string, string>();

        for (const rd of raw.devices) {
            const type = getDeviceType(rd.typeId) || getDeviceType('pc')!;
            const d = createDevice(type.id, rd.x ?? 200, rd.y ?? 200, topology.devices);
            idMap.set(rd.id, d.id);
            d.hostname = rd.hostname || d.hostname;
            d.name = rd.name || d.name;
            d.powered = rd.powered !== false;
            d.notes = rd.notes || '';
            d.group = rd.group;
            if (Array.isArray(rd.vlans)) d.vlans = rd.vlans;
            if (rd.stp) d.stp = { ...d.stp, ...rd.stp, portRoles: {} };
            if (rd.routing) d.routing = { ...d.routing, ...rd.routing, learned: [] };
            if (Array.isArray(rd.acls)) d.acls = rd.acls;
            if (rd.nat) d.nat = { ...d.nat, ...rd.nat, translations: [] };
            if (rd.services) d.services = deepMergeServices(d.services, rd.services);
            if (rd.wireless) d.wireless = { ...(d.wireless || defaultWireless(type)!), ...rd.wireless };
            if (rd.host) d.host = { ...d.host, ...rd.host };

            // Map interfaces positionally, keeping the source config.
            if (Array.isArray(rd.interfaces)) {
                // SVIs are virtual, so a freshly-created device has none. Recreate
                // them before positional mapping, or an SVI's config would be
                // written onto a physical port.
                for (const ri of rd.interfaces) {
                    if (ri?.sviVlan && !d.interfaces.some(x => x.sviVlan === ri.sviVlan)) {
                        addSvi(d, ri.sviVlan, ri.ipv4 || '', ri.mask || '255.255.255.0');
                    }
                }
                rd.interfaces.forEach((ri: any, idx: number) => {
                    const target = ri?.sviVlan
                        ? d.interfaces.find(x => x.sviVlan === ri.sviVlan)
                        : (d.interfaces.find(x => x.name === ri.name && !x.sviVlan)
                            || d.interfaces.filter(x => !x.sviVlan)[idx]);
                    if (!target) return;
                    ifMap.set(ri.id, target.id);
                    Object.assign(target, {
                        mac: ri.mac || target.mac,
                        enabled: ri.enabled !== false,
                        dhcp: !!ri.dhcp,
                        ipv4: ri.ipv4 || '',
                        mask: ri.mask || '255.255.255.0',
                        ipv6: ri.ipv6 || '',
                        prefix6: ri.prefix6 ?? 64,
                        mode: ri.mode || target.mode,
                        accessVlan: ri.accessVlan ?? 1,
                        nativeVlan: ri.nativeVlan ?? 1,
                        trunkVlans: Array.isArray(ri.trunkVlans) ? ri.trunkVlans : [],
                        encapsulationVlan: ri.encapsulationVlan,
                        sviVlan: ri.sviVlan,
                        duplex: ri.duplex || 'auto',
                        mtu: ri.mtu ?? 1500,
                        description: ri.description || '',
                        natRole: ri.natRole || 'none',
                        aclIn: ri.aclIn || '',
                        aclOut: ri.aclOut || '',
                        ssid: ri.ssid,
                        passphrase: ri.passphrase,
                        band: ri.band,
                    });
                });
            }
            topology.devices.push(d);
        }

        for (const rl of raw.links || []) {
            const aD = idMap.get(rl.aDeviceId), bD = idMap.get(rl.bDeviceId);
            const aI = ifMap.get(rl.aInterfaceId), bI = ifMap.get(rl.bInterfaceId);
            if (!aD || !bD || !aI || !bI) continue;
            const res = connect(topology, aD, aI, bD, bI, rl.cable);
            if (res.ok && res.link) {
                res.link.latencyMs = rl.latencyMs ?? res.link.latencyMs;
                res.link.bandwidthMbps = rl.bandwidthMbps ?? res.link.bandwidthMbps;
                res.link.lossPct = rl.lossPct ?? 0;
                res.link.label = rl.label || '';
                res.link.severed = !!rl.severed;
            }
        }

        return { ok: true, topology };
    } catch (e: any) {
        return { ok: false, reason: e?.message || 'Invalid JSON' };
    }
}

function deepMergeServices(base: ServerServices, incoming: any): ServerServices {
    const out: any = { ...base };
    for (const k of Object.keys(base)) {
        if (incoming[k]) out[k] = { ...(base as any)[k], ...incoming[k] };
    }
    if (out.dhcp) out.dhcp.leases = [];
    return out as ServerServices;
}

export function cloneTopology(t: Topology): Topology {
    return JSON.parse(JSON.stringify(t));
}

/* ─────────────────────── AI spec → topology ─────────────────────── */

export interface AiTopologySpec {
    name?: string;
    description?: string;
    devices: Array<{
        hostname: string;
        type: string;
        x?: number;
        y?: number;
        notes?: string;
        vlans?: Array<{ id: number; name: string }>;
        interfaces?: Array<{
            name?: string;
            index?: number;
            ip?: string;
            mask?: string;
            mode?: string;
            vlan?: number;
            trunkVlans?: number[];
            nativeVlan?: number;
            sviVlan?: number;
            enabled?: boolean;
            dhcp?: boolean;
            natRole?: string;
            description?: string;
            ssid?: string;
            passphrase?: string;
        }>;
        defaultGateway?: string;
        dnsServer?: string;
        staticRoutes?: Array<{ network: string; mask: string; nextHop: string }>;
        ospf?: boolean;
        rip?: boolean;
        nat?: { enabled: boolean; mode?: string; insideInterfaces?: string[]; outsideInterface?: string };
        wireless?: { ssid: string; security?: string; passphrase?: string; band?: string; channel?: number; vlanId?: number };
        dhcpPools?: Array<{ name: string; network: string; mask: string; rangeStart: string; rangeEnd: string; gateway: string; dns?: string }>;
        dnsRecords?: Array<{ name: string; value: string; type?: string }>;
        http?: { enabled: boolean; title?: string; body?: string };
    }>;
    links: Array<{
        from: string;
        fromInterface?: string;
        to: string;
        toInterface?: string;
        cable?: string;
        label?: string;
    }>;
    notes?: string[];
}

/** Fuzzy match a model-supplied type name onto a catalogue entry. */
export function resolveTypeId(input: string): string {
    const q = (input || '').toLowerCase().trim().replace(/[_\s]+/g, '-');
    const direct = DEVICE_TYPES.find(d => d.id === q);
    if (direct) return direct.id;

    const aliases: Record<string, string> = {
        computer: 'pc', desktop: 'pc', workstation: 'workstation', host: 'pc', client: 'pc',
        notebook: 'laptop', macbook: 'laptop',
        phone: 'smartphone', mobile: 'smartphone', iphone: 'smartphone', android: 'smartphone',
        ipad: 'tablet',
        switch: 'switch-24', 'l2-switch': 'switch-24', 'access-switch': 'switch-24',
        'l3-switch': 'switch-l3', multilayer: 'switch-l3', 'core-switch': 'switch-l3',
        'distribution-switch': 'switch-l3', 'poe-switch': 'switch-48',
        router: 'router-branch', 'edge-router': 'router-edge', 'core-router': 'router-core',
        gateway: 'router-branch', 'home-router': 'router-soho', 'wifi-router': 'router-soho',
        'wireless-router': 'router-soho', modem: 'modem-dsl',
        ap: 'ap-wifi6', 'access-point': 'ap-wifi6', 'wireless-ap': 'ap-wifi6',
        'wifi6-ap': 'ap-wifi6', 'wifi7-ap': 'ap-wifi7', wifi: 'ap-wifi6',
        firewall: 'firewall-ngfw', ngfw: 'firewall-ngfw', asa: 'firewall-ngfw',
        server: 'server-generic', 'web-server': 'server-web', www: 'server-web',
        'dns-server': 'server-dns', dns: 'server-dns',
        'dhcp-server': 'server-dhcp', dhcp: 'server-dhcp',
        'mail-server': 'server-mail', 'file-server': 'server-file',
        database: 'server-database', 'db-server': 'server-database', sql: 'server-database',
        internet: 'internet', cloud: 'internet', wan: 'internet', isp: 'isp-cloud',
        printer: 'printer', camera: 'ip-camera', 'ip-phone': 'ip-phone', voip: 'ip-phone',
        hub: 'hub', 'load-balancer': 'load-balancer', nas: 'nas',
        iot: 'iot-sensor', sensor: 'iot-sensor', plc: 'iot-plc',
        laptop: 'laptop', tablet: 'tablet', tv: 'smart-tv',
    };
    if (aliases[q]) return aliases[q];

    const partial = DEVICE_TYPES.find(d => d.id.includes(q) || q.includes(d.id) || d.name.toLowerCase().includes(q));
    if (partial) return partial.id;

    const byTag = DEVICE_TYPES.find(d => d.tags.some(t => t === q));
    return byTag?.id || 'pc';
}

export function topologyFromAiSpec(spec: AiTopologySpec): { ok: boolean; topology?: Topology; warnings: string[]; reason?: string } {
    const warnings: string[] = [];
    try {
        if (!spec || !Array.isArray(spec.devices) || !spec.devices.length) {
            return { ok: false, warnings, reason: 'The AI response contained no devices.' };
        }

        const topology = createTopology(spec.name || 'AI-generated network', spec.description || '');
        const byHostname = new Map<string, Device>();

        spec.devices.forEach((sd, idx) => {
            const typeId = resolveTypeId(sd.type);
            if (resolveTypeId(sd.type) === 'pc' && !/pc|computer|host|desktop|client/i.test(sd.type)) {
                warnings.push(`Unknown device type "${sd.type}" for ${sd.hostname} — substituted a PC.`);
            }
            const d = createDevice(typeId, sd.x ?? (160 + (idx % 6) * 190), sd.y ?? (120 + Math.floor(idx / 6) * 170), topology.devices);
            d.hostname = (sd.hostname || d.hostname).slice(0, 24);
            d.notes = sd.notes || '';

            if (Array.isArray(sd.vlans) && sd.vlans.length) {
                d.vlans = sd.vlans.map((v, i) => ({ id: v.id, name: v.name || `VLAN${v.id}`, color: VLAN_PALETTE[i % VLAN_PALETTE.length] }));
            }

            for (const si of sd.interfaces || []) {
                let target: NetInterface | undefined;
                if (si.sviVlan) {
                    // Create the SVI on demand.
                    target = {
                        ...d.interfaces[0],
                        id: nid('if'),
                        name: `Vlan${si.sviVlan}`,
                        short: `Vl${si.sviVlan}`,
                        medium: 'copper-ethernet',
                        mac: randomMac(),
                        mode: 'routed',
                        sviVlan: si.sviVlan,
                        enabled: true,
                        dhcp: false,
                        ipv4: '', mask: '255.255.255.0',
                        counters: { txFrames: 0, rxFrames: 0, txBytes: 0, rxBytes: 0, drops: 0 },
                    };
                    d.interfaces.push(target);
                } else if (si.name) {
                    target = d.interfaces.find(i => i.name.toLowerCase() === si.name!.toLowerCase() || i.short.toLowerCase() === si.name!.toLowerCase());
                }
                if (!target && si.index !== undefined) target = d.interfaces[si.index];
                if (!target) target = d.interfaces.find(i => !i.ipv4 && i.medium !== 'console');
                if (!target) { warnings.push(`${d.hostname}: no free interface for "${si.name || si.index}".`); continue; }

                if (si.ip && isValidIPv4(si.ip)) {
                    target.ipv4 = si.ip;
                    target.mask = si.mask && isValidIPv4(si.mask) ? si.mask
                        : si.mask && /^\/?\d+$/.test(String(si.mask)) ? prefixToMask(maskToPrefix(String(si.mask)))
                        : '255.255.255.0';
                    target.dhcp = false;
                }
                if (si.dhcp) { target.dhcp = true; }
                if (si.mode) {
                    const m = si.mode.toLowerCase();
                    target.mode = m === 'trunk' ? 'trunk' : m === 'routed' || m === 'layer3' || m === 'l3' ? 'routed' : 'access';
                }
                if (si.vlan) { target.accessVlan = si.vlan; if (target.mode === 'access') target.mode = 'access'; }
                if (si.trunkVlans?.length) { target.mode = 'trunk'; target.trunkVlans = si.trunkVlans; }
                if (si.nativeVlan) target.nativeVlan = si.nativeVlan;
                if (si.natRole) target.natRole = si.natRole === 'inside' ? 'inside' : si.natRole === 'outside' ? 'outside' : 'none';
                if (si.description) target.description = si.description;
                if (si.ssid) target.ssid = si.ssid;
                if (si.passphrase) target.passphrase = si.passphrase;
                target.enabled = si.enabled !== false;
            }

            if (sd.defaultGateway && isValidIPv4(sd.defaultGateway)) {
                d.host.defaultGateway = sd.defaultGateway;
                d.routing.defaultGateway = sd.defaultGateway;
            }
            if (sd.dnsServer && isValidIPv4(sd.dnsServer)) d.host.dnsServer = sd.dnsServer;

            for (const r of sd.staticRoutes || []) {
                if (!isValidIPv4(r.network)) continue;
                d.routing.staticRoutes.push({
                    id: nid('rt'),
                    network: r.network,
                    mask: isValidIPv4(r.mask) ? r.mask : prefixToMask(maskToPrefix(String(r.mask ?? 24))),
                    nextHop: r.nextHop || '0.0.0.0',
                    metric: 1, adminDistance: 1, source: r.network === '0.0.0.0' ? 'default' : 'static',
                });
            }
            if (sd.ospf) { d.routing.ospf.enabled = true; d.routing.ospf.routerId = d.interfaces.find(i => i.ipv4)?.ipv4 || ''; }
            if (sd.rip) d.routing.rip.enabled = true;

            if (sd.nat?.enabled) {
                d.nat.enabled = true;
                d.nat.mode = (sd.nat.mode as any) || 'pat';
                for (const n of sd.nat.insideInterfaces || []) {
                    const i = d.interfaces.find(x => x.name.toLowerCase() === n.toLowerCase() || x.short.toLowerCase() === n.toLowerCase());
                    if (i) i.natRole = 'inside';
                }
                if (sd.nat.outsideInterface) {
                    const i = d.interfaces.find(x => x.name.toLowerCase() === sd.nat!.outsideInterface!.toLowerCase() || x.short.toLowerCase() === sd.nat!.outsideInterface!.toLowerCase());
                    if (i) { i.natRole = 'outside'; d.nat.outsideAddress = i.ipv4; }
                }
            }

            if (sd.wireless && d.wireless) {
                d.wireless.ssid = sd.wireless.ssid || d.wireless.ssid;
                if (sd.wireless.security) {
                    const s = sd.wireless.security.toLowerCase().replace(/[\s_]/g, '-');
                    d.wireless.security = (['open', 'wep', 'wpa2-personal', 'wpa2-enterprise', 'wpa3-personal', 'wpa3-enterprise'].includes(s) ? s : 'wpa2-personal') as any;
                }
                if (sd.wireless.passphrase) d.wireless.passphrase = sd.wireless.passphrase;
                if (sd.wireless.band) d.wireless.band = (['2.4GHz', '5GHz', '6GHz'].includes(sd.wireless.band) ? sd.wireless.band : '5GHz') as any;
                if (sd.wireless.channel) d.wireless.channel = sd.wireless.channel;
                if (sd.wireless.vlanId) d.wireless.vlanId = sd.wireless.vlanId;
            }

            for (const p of sd.dhcpPools || []) {
                d.services.dhcp.enabled = true;
                d.services.dhcp.pools.push({
                    id: nid('pool'), name: p.name || 'POOL',
                    network: p.network, mask: isValidIPv4(p.mask) ? p.mask : prefixToMask(maskToPrefix(String(p.mask ?? 24))),
                    rangeStart: p.rangeStart, rangeEnd: p.rangeEnd,
                    gateway: p.gateway || '', dnsServer: p.dns || '', domain: 'lab.local',
                    leaseHours: 24, excluded: [],
                });
            }
            for (const r of sd.dnsRecords || []) {
                d.services.dns.enabled = true;
                d.services.dns.records.push({ id: nid('rr'), name: r.name, type: (r.type as any) || 'A', value: r.value, ttl: 300 });
            }
            if (sd.http) {
                d.services.http.enabled = sd.http.enabled !== false;
                if (sd.http.title) d.services.http.title = sd.http.title;
                if (sd.http.body) d.services.http.body = sd.http.body;
            }

            topology.devices.push(d);
            byHostname.set(d.hostname.toLowerCase(), d);
        });

        for (const sl of spec.links || []) {
            const A = byHostname.get((sl.from || '').toLowerCase());
            const B = byHostname.get((sl.to || '').toLowerCase());
            if (!A || !B) { warnings.push(`Link ${sl.from} ↔ ${sl.to} skipped — one of the devices does not exist.`); continue; }

            const pick = (dev: Device, wanted?: string) => {
                if (wanted) {
                    const m = dev.interfaces.find(i =>
                        (i.name.toLowerCase() === wanted.toLowerCase() || i.short.toLowerCase() === wanted.toLowerCase()) &&
                        !topology.links.some(l => l.aInterfaceId === i.id || l.bInterfaceId === i.id)
                    );
                    if (m) return m;
                }
                return firstFreeInterface(topology, dev.id);
            };

            const ai = pick(A, sl.fromInterface);
            const bi = pick(B, sl.toInterface);
            if (!ai || !bi) { warnings.push(`Link ${A.hostname} ↔ ${B.hostname} skipped — no free port on ${!ai ? A.hostname : B.hostname}.`); continue; }

            const res = connect(topology, A.id, ai.id, B.id, bi.id, sl.cable as CableType | undefined);
            if (!res.ok) warnings.push(`Link ${A.hostname} ↔ ${B.hostname} skipped — ${res.reason}`);
            else if (res.link && sl.label) res.link.label = sl.label;
        }

        // Wireless clients need an SSID to associate with — copy it from any AP.
        const aps = topology.devices.filter(d => d.wireless?.ssid && getDeviceType(d.typeId)?.role === 'ap');
        if (aps.length) {
            for (const d of topology.devices) {
                for (const i of d.interfaces) {
                    if ((i.medium === 'wireless' || i.medium === 'cellular') && !i.ssid && getDeviceType(d.typeId)?.role !== 'ap') {
                        i.ssid = aps[0].wireless!.ssid;
                        i.passphrase = aps[0].wireless!.passphrase;
                        i.band = aps[0].wireless!.band;
                    }
                }
            }
        }

        if (spec.notes?.length) {
            topology.annotations.push({
                id: nid('ann'), kind: 'note',
                text: spec.notes.join('\n• '),
                x: 40, y: 40, w: 340, h: 150, color: '#6366f1',
            } as Annotation);
        }

        separateOverlaps(topology);
        return { ok: true, topology, warnings };
    } catch (e: any) {
        return { ok: false, warnings, reason: e?.message || 'Could not build a topology from that spec.' };
    }
}

/* ─────────────────────── quick config helpers ─────────────────────── */

export function setIp(device: Device, ifaceId: string, ip: string, mask: string): void {
    const i = device.interfaces.find(x => x.id === ifaceId);
    if (!i) return;
    i.ipv4 = ip;
    i.mask = mask;
    i.dhcp = false;
}

export function addVlan(device: Device, id: number, name: string): Vlan {
    const existing = device.vlans.find(v => v.id === id);
    if (existing) { existing.name = name; return existing; }
    const v: Vlan = { id, name, color: VLAN_PALETTE[device.vlans.length % VLAN_PALETTE.length] };
    device.vlans.push(v);
    device.vlans.sort((a, b) => a.id - b.id);
    return v;
}

export function addSvi(device: Device, vlanId: number, ip: string, mask: string): NetInterface {
    const existing = device.interfaces.find(i => i.sviVlan === vlanId);
    if (existing) { existing.ipv4 = ip; existing.mask = mask; existing.enabled = true; return existing; }
    const svi: NetInterface = {
        id: nid('if'),
        name: `Vlan${vlanId}`,
        short: `Vl${vlanId}`,
        medium: 'copper-ethernet',
        speedMbps: 1000,
        mac: randomMac(),
        enabled: true,
        dhcp: false,
        ipv4: ip,
        mask,
        ipv6: '',
        prefix6: 64,
        mode: 'routed',
        accessVlan: vlanId,
        nativeVlan: 1,
        trunkVlans: [],
        sviVlan: vlanId,
        duplex: 'auto',
        mtu: 1500,
        description: `SVI for VLAN ${vlanId}`,
        natRole: 'none',
        aclIn: '',
        aclOut: '',
        counters: { txFrames: 0, rxFrames: 0, txBytes: 0, rxBytes: 0, drops: 0 },
    };
    device.interfaces.push(svi);
    return svi;
}

export function addStaticRoute(device: Device, network: string, mask: string, nextHop: string): void {
    device.routing.staticRoutes.push({
        id: nid('rt'), network, mask, nextHop, metric: 1, adminDistance: 1,
        source: network === '0.0.0.0' ? 'default' : 'static',
    });
}

export function addDhcpPool(device: Device, o: {
    name: string; network: string; mask: string; rangeStart: string; rangeEnd: string;
    gateway: string; dnsServer?: string;
}): void {
    device.services.dhcp.enabled = true;
    device.services.dhcp.pools.push({
        id: nid('pool'), name: o.name, network: o.network, mask: o.mask,
        rangeStart: o.rangeStart, rangeEnd: o.rangeEnd, gateway: o.gateway,
        dnsServer: o.dnsServer || '', domain: 'lab.local', leaseHours: 24, excluded: [],
    });
}

export function addDnsRecord(device: Device, name: string, value: string, type: 'A' | 'CNAME' | 'MX' | 'AAAA' = 'A'): void {
    device.services.dns.enabled = true;
    device.services.dns.records.push({ id: nid('rr'), name, type, value, ttl: 300 });
}

export function addAcl(device: Device, name: string, type: 'standard' | 'extended'): void {
    if (device.acls.some(a => a.name === name)) return;
    device.acls.push({ id: nid('acl'), name, type, rules: [] });
}

/* ═══════════════════════ starter templates ═══════════════════════ */

function place(t: Topology, typeId: string, hostname: string, x: number, y: number): Device {
    const d = createDevice(typeId, x, y, t.devices);
    d.hostname = hostname;
    t.devices.push(d);
    return d;
}

function wire(t: Topology, a: Device, b: Device, aName?: string, bName?: string): Link | undefined {
    const pick = (dev: Device, want?: string) => {
        if (want) {
            const m = dev.interfaces.find(i =>
                (i.name.toLowerCase() === want.toLowerCase() || i.short.toLowerCase() === want.toLowerCase()) &&
                !t.links.some(l => l.aInterfaceId === i.id || l.bInterfaceId === i.id));
            if (m) return m;
        }
        return firstFreeInterface(t, dev.id);
    };
    const ai = pick(a, aName), bi = pick(b, bName);
    if (!ai || !bi) return undefined;
    const r = connect(t, a.id, ai.id, b.id, bi.id);
    return r.link;
}

function host(d: Device, ip: string, mask: string, gw = '', dns = ''): Device {
    const i = d.interfaces.find(x => x.medium === 'copper-ethernet') || d.interfaces[0];
    if (i) { i.ipv4 = ip; i.mask = mask; i.dhcp = false; i.enabled = true; }
    d.host.dhcp = false;
    d.host.defaultGateway = gw;
    d.host.dnsServer = dns;
    return d;
}

function routerIf(d: Device, name: string, ip: string, mask: string): void {
    const i = d.interfaces.find(x => x.name.toLowerCase().startsWith(name.toLowerCase()) || x.short.toLowerCase() === name.toLowerCase());
    if (!i) return;
    i.ipv4 = ip; i.mask = mask; i.enabled = true; i.mode = 'routed'; i.dhcp = false;
}

export const TOPOLOGY_TEMPLATES: TopologyTemplate[] = [
    {
        id: 'two-pcs',
        name: 'Two PCs and a switch',
        description: 'The smallest possible network. Perfect for meeting MAC addresses, ARP and the MAC address table.',
        difficulty: 'beginner',
        tags: ['layer2', 'arp', 'mac-table'],
        icon: 'switch',
        build: () => {
            const t = createTopology('Two PCs and a switch', 'One broadcast domain, one subnet, zero routing.');
            const sw = place(t, 'switch-24', 'SW1', 640, 320);
            const a = host(place(t, 'pc', 'PC-A', 440, 500), '192.168.10.10', '255.255.255.0');
            const b = host(place(t, 'pc', 'PC-B', 840, 500), '192.168.10.20', '255.255.255.0');
            wire(t, a, sw); wire(t, b, sw);
            return t;
        },
    },
    {
        id: 'hub-vs-switch',
        name: 'Hub vs switch',
        description: 'Identical networks side by side — one built on a hub, one on a switch. See flooding versus forwarding.',
        difficulty: 'beginner',
        tags: ['layer1', 'collision-domain', 'flooding'],
        icon: 'hub',
        build: () => {
            const t = createTopology('Hub vs switch', 'Same traffic, two very different outcomes.');
            const hub = place(t, 'hub', 'HUB1', 400, 250);
            const sw = place(t, 'switch-24', 'SW1', 950, 250);
            [['PC-H1', '192.168.1.11'], ['PC-H2', '192.168.1.12'], ['PC-H3', '192.168.1.13']].forEach(([n, ip], i) => {
                const p = host(place(t, 'pc', n, 250 + i * 150, 470), ip, '255.255.255.0');
                wire(t, p, hub);
            });
            [['PC-S1', '192.168.2.11'], ['PC-S2', '192.168.2.12'], ['PC-S3', '192.168.2.13']].forEach(([n, ip], i) => {
                const p = host(place(t, 'pc', n, 800 + i * 150, 470), ip, '255.255.255.0');
                wire(t, p, sw);
            });
            return t;
        },
    },
    {
        id: 'two-subnets-router',
        name: 'Two subnets and a router',
        description: 'The moment routing starts to make sense: two LANs, one router, default gateways.',
        difficulty: 'beginner',
        tags: ['routing', 'default-gateway', 'layer3'],
        icon: 'router',
        build: () => {
            const t = createTopology('Two subnets and a router', 'A router breaks one network into two broadcast domains.');
            const r = place(t, 'router-branch', 'R1', 640, 260);
            routerIf(r, 'GigabitEthernet0/0/0', '10.0.1.1', '255.255.255.0');
            routerIf(r, 'GigabitEthernet0/0/1', '10.0.2.1', '255.255.255.0');
            const sw1 = place(t, 'switch-24', 'SW1', 400, 430);
            const sw2 = place(t, 'switch-24', 'SW2', 880, 430);
            wire(t, r, sw1, 'GigabitEthernet0/0/0');
            wire(t, r, sw2, 'GigabitEthernet0/0/1');
            wire(t, host(place(t, 'pc', 'PC-A', 300, 610), '10.0.1.10', '255.255.255.0', '10.0.1.1'), sw1);
            wire(t, host(place(t, 'pc', 'PC-B', 500, 610), '10.0.1.11', '255.255.255.0', '10.0.1.1'), sw1);
            wire(t, host(place(t, 'pc', 'PC-C', 790, 610), '10.0.2.10', '255.255.255.0', '10.0.2.1'), sw2);
            wire(t, host(place(t, 'pc', 'PC-D', 980, 610), '10.0.2.11', '255.255.255.0', '10.0.2.1'), sw2);
            return t;
        },
    },
    {
        id: 'two-routers-static',
        name: 'Two routers, no routing yet',
        description: 'Two sites joined by a /30 link, each with its own LAN and no routes between them. Add the static routes yourself.',
        difficulty: 'intermediate',
        tags: ['static-routes', 'routing', 'next-hop'],
        icon: 'router',
        build: () => {
            const t = createTopology('Two routers, no routing yet', 'Everything is addressed and up — the only thing missing is the routes.');
            const r1 = place(t, 'router-branch', 'R1', 460, 240);
            const r2 = place(t, 'router-branch', 'R2', 900, 240);
            routerIf(r1, 'GigabitEthernet0/0/0', '10.1.1.1', '255.255.255.0');
            routerIf(r1, 'GigabitEthernet0/0/1', '172.16.0.1', '255.255.255.252');
            routerIf(r2, 'GigabitEthernet0/0/0', '10.2.2.1', '255.255.255.0');
            routerIf(r2, 'GigabitEthernet0/0/1', '172.16.0.2', '255.255.255.252');
            const wan = wire(t, r1, r2, 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/1');
            if (wan) wan.label = '172.16.0.0/30';

            const sw1 = place(t, 'switch-24', 'SW1', 380, 410);
            const sw2 = place(t, 'switch-24', 'SW2', 980, 410);
            wire(t, r1, sw1, 'GigabitEthernet0/0/0');
            wire(t, r2, sw2, 'GigabitEthernet0/0/0');
            wire(t, host(place(t, 'pc', 'PC-A', 300, 590), '10.1.1.10', '255.255.255.0', '10.1.1.1'), sw1);
            wire(t, host(place(t, 'pc', 'PC-B', 470, 590), '10.1.1.11', '255.255.255.0', '10.1.1.1'), sw1);
            wire(t, host(place(t, 'pc', 'PC-C', 900, 590), '10.2.2.10', '255.255.255.0', '10.2.2.1'), sw2);
            wire(t, host(place(t, 'pc', 'PC-D', 1070, 590), '10.2.2.11', '255.255.255.0', '10.2.2.1'), sw2);

            t.annotations.push({
                id: nid('ann'), kind: 'note',
                text: 'Each router knows only its own two connected networks.\nPC-A cannot reach PC-C until you tell each router how to get to the far LAN:\n\nR1: ip route 10.2.2.0 255.255.255.0 172.16.0.2\nR2: ip route 10.1.1.0 255.255.255.0 172.16.0.1',
                x: 60, y: 60, w: 330, h: 170, color: '#f59e0b',
            } as Annotation);
            return t;
        },
    },
    {
        id: 'vlans-trunk',
        name: 'VLANs across a trunk',
        description: 'Two switches, three VLANs, one 802.1Q trunk. Watch the tag appear and disappear.',
        difficulty: 'intermediate',
        tags: ['vlan', 'trunk', '802.1q'],
        icon: 'switch',
        build: () => {
            const t = createTopology('VLANs across a trunk', 'Same wire, separate broadcast domains.');
            const sw1 = place(t, 'switch-24', 'SW1', 460, 300);
            const sw2 = place(t, 'switch-24', 'SW2', 940, 300);
            [sw1, sw2].forEach(sw => {
                addVlan(sw, 10, 'STAFF'); addVlan(sw, 20, 'GUEST'); addVlan(sw, 30, 'VOICE');
            });
            const trunk = wire(t, sw1, sw2, 'TenGigabitEthernet1/1/0', 'TenGigabitEthernet1/1/0');
            if (trunk) trunk.label = '802.1Q trunk';
            [sw1, sw2].forEach(sw => {
                const up = sw.interfaces.find(i => i.speedMbps >= 10000);
                if (up) { up.mode = 'trunk'; up.trunkVlans = [10, 20, 30]; up.nativeVlan = 1; }
            });
            const mk = (name: string, ip: string, vlan: number, sw: Device, x: number, y: number) => {
                const p = host(place(t, 'pc', name, x, y), ip, '255.255.255.0');
                const l = wire(t, p, sw);
                if (l) {
                    const swIf = sw.interfaces.find(i => i.id === l.aInterfaceId || i.id === l.bInterfaceId);
                    if (swIf && swIf.speedMbps < 10000) { swIf.mode = 'access'; swIf.accessVlan = vlan; }
                }
                return p;
            };
            mk('PC-Staff1', '10.10.10.11', 10, sw1, 300, 500);
            mk('PC-Guest1', '10.10.20.11', 20, sw1, 470, 500);
            mk('PC-Staff2', '10.10.10.12', 10, sw2, 850, 500);
            mk('PC-Guest2', '10.10.20.12', 20, sw2, 1020, 500);
            return t;
        },
    },
    {
        id: 'inter-vlan-l3',
        name: 'Inter-VLAN routing on a Layer-3 switch',
        description: 'SVIs replace router-on-a-stick. Three VLANs routed at wire speed.',
        difficulty: 'intermediate',
        tags: ['inter-vlan', 'svi', 'layer3-switch'],
        icon: 'switch-l3',
        build: () => {
            const t = createTopology('Inter-VLAN routing', 'One multilayer switch routes between VLANs with SVIs.');
            const mls = place(t, 'switch-l3', 'MLS1', 660, 220);
            addVlan(mls, 10, 'STAFF'); addVlan(mls, 20, 'GUEST'); addVlan(mls, 30, 'SERVERS');
            addSvi(mls, 10, '10.1.10.1', '255.255.255.0');
            addSvi(mls, 20, '10.1.20.1', '255.255.255.0');
            addSvi(mls, 30, '10.1.30.1', '255.255.255.0');
            const sw = place(t, 'switch-24', 'SW1', 660, 420);
            const trunk = wire(t, mls, sw, 'TenGigabitEthernet1/1/0', 'TenGigabitEthernet1/1/0');
            if (trunk) trunk.label = 'trunk 10,20,30';
            [mls, sw].forEach(d => {
                const up = d.interfaces.find(i => i.speedMbps >= 10000);
                if (up) { up.mode = 'trunk'; up.trunkVlans = [10, 20, 30]; }
            });
            const mk = (name: string, typeId: string, ip: string, vlan: number, x: number, y: number) => {
                const p = host(place(t, typeId, name, x, y), ip, '255.255.255.0', `10.1.${vlan}.1`, '10.1.30.10');
                const l = wire(t, p, sw);
                if (l) {
                    const swIf = sw.interfaces.find(i => (i.id === l.aInterfaceId || i.id === l.bInterfaceId) && i.speedMbps < 10000);
                    if (swIf) { swIf.mode = 'access'; swIf.accessVlan = vlan; }
                }
                return p;
            };
            mk('PC-Staff', 'pc', '10.1.10.11', 10, 380, 620);
            mk('PC-Guest', 'pc', '10.1.20.11', 20, 620, 620);
            const srv = mk('SRV-DNS', 'server-dns', '10.1.30.10', 30, 900, 620);
            srv.services.dns.enabled = true;
            addDnsRecord(srv, 'www.selfstudy.local', '10.1.30.10');
            srv.services.http.enabled = true;
            return t;
        },
    },
    {
        id: 'home-network',
        name: 'Complete home network',
        description: 'Fibre ONT, home router with NAT and Wi-Fi, wired and wireless clients, and the Internet.',
        difficulty: 'beginner',
        tags: ['nat', 'dhcp', 'wifi', 'home'],
        icon: 'wifi-router',
        build: () => {
            const t = createTopology('Complete home network', 'Everything a real house has, and every layer it uses.');
            const net = place(t, 'internet', 'Internet', 660, 90);
            const ont = place(t, 'ont-fiber', 'ONT', 660, 220);
            const gw = place(t, 'router-soho', 'HomeRouter', 660, 350);
            gw.wireless!.ssid = 'SelfStudy-Home';
            gw.wireless!.security = 'wpa3-personal';
            gw.wireless!.passphrase = 'SelfStudy2026';

            const netIf = net.interfaces[0];
            netIf.ipv4 = '203.0.113.1';
            netIf.mask = '255.255.255.0';

            const wan = gw.interfaces.find(i => i.name.startsWith('WAN'))!;
            wan.dhcp = false; wan.ipv4 = '203.0.113.10'; wan.mask = '255.255.255.0'; wan.natRole = 'outside';
            gw.routing.defaultGateway = '203.0.113.1';
            gw.nat.outsideAddress = '203.0.113.10';

            const ontEth = ont.interfaces.find(i => i.name === 'Ethernet0')!;
            ontEth.ipv4 = ''; ontEth.enabled = true;
            const pon = ont.interfaces.find(i => i.name === 'PON0')!;
            pon.enabled = true;

            wire(t, net, ont, undefined, 'PON0');
            wire(t, ont, gw, 'Ethernet0', 'WAN0');

            const tv = host(place(t, 'smart-tv', 'LivingRoomTV', 400, 500), '192.168.1.50', '255.255.255.0', '192.168.1.1', '192.168.1.1');
            wire(t, tv, gw, undefined, 'LAN0');
            const pc = host(place(t, 'pc', 'DeskPC', 560, 520), '192.168.1.51', '255.255.255.0', '192.168.1.1', '192.168.1.1');
            wire(t, pc, gw, undefined, 'LAN1');

            [['Phone', 'smartphone', '192.168.1.101'], ['Laptop', 'laptop', '192.168.1.102'], ['Thermostat', 'iot-thermostat', '192.168.1.150']].forEach(([n, ty, ip], i) => {
                const d = place(t, ty, n, 780 + i * 150, 520);
                const w = d.interfaces.find(x => x.medium === 'wireless')!;
                w.ssid = 'SelfStudy-Home'; w.passphrase = 'SelfStudy2026'; w.band = '5GHz';
                w.ipv4 = ip as string; w.mask = '255.255.255.0'; w.dhcp = false; w.enabled = true;
                d.host.defaultGateway = '192.168.1.1';
                d.host.dnsServer = '192.168.1.1';
                d.host.dhcp = false;
            });

            const dns = host(place(t, 'server-dns', 'PublicDNS', 940, 150), '203.0.113.53', '255.255.255.0');
            addDnsRecord(dns, 'www.example.com', '203.0.113.80');
            dns.services.dns.enabled = true;
            wire(t, dns, net);
            const web = host(place(t, 'server-web', 'ExampleWeb', 380, 150), '203.0.113.80', '255.255.255.0');
            web.services.http.enabled = true;
            web.services.http.title = 'example.com';
            web.services.http.body = '<h1>example.com</h1><p>You reached the Internet through NAT.</p>';
            wire(t, web, net);
            return t;
        },
    },
    {
        id: 'campus-three-tier',
        name: 'Campus three-tier network',
        description: 'Core, distribution and access with redundancy — spanning tree has work to do here.',
        difficulty: 'advanced',
        tags: ['stp', 'redundancy', 'campus', 'three-tier'],
        icon: 'switch-l3',
        build: () => {
            const t = createTopology('Campus three-tier network', 'Access → distribution → core, with redundant uplinks.');
            const core1 = place(t, 'switch-l3', 'CORE1', 540, 150);
            const core2 = place(t, 'switch-l3', 'CORE2', 820, 150);
            core1.stp.priority = 4096;
            core2.stp.priority = 8192;
            const dist1 = place(t, 'switch-l3', 'DIST1', 420, 330);
            const dist2 = place(t, 'switch-l3', 'DIST2', 940, 330);
            const acc = [1, 2, 3, 4].map(n => place(t, 'switch-48', `ACC${n}`, 260 + (n - 1) * 250, 520));

            // Every VLAN must exist and every uplink must be a trunk BEFORE the
            // cables go in, so nothing lands on a mismatched access port.
            [core1, core2, dist1, dist2, ...acc].forEach(sw => {
                addVlan(sw, 10, 'STAFF'); addVlan(sw, 20, 'GUEST'); addVlan(sw, 99, 'MGMT');
                sw.interfaces.filter(i => i.speedMbps >= 10000).forEach(i => {
                    i.mode = 'trunk'; i.trunkVlans = [10, 20, 99]; i.nativeVlan = 99;
                });
            });

            const te = (n: number) => `TenGigabitEthernet1/1/${n}`;
            wire(t, core1, core2, te(0), te(0));
            wire(t, core1, dist1, te(1), te(0));
            wire(t, core2, dist1, te(1), te(1));
            wire(t, core1, dist2, te(2), te(0));
            wire(t, core2, dist2, te(2), te(1));
            // Each access switch dual-homes to both distribution switches, which
            // is what gives spanning tree something to block.
            acc.forEach((a, i) => {
                wire(t, a, dist1, te(0), te(2 + i));
                wire(t, a, dist2, te(1), te(2 + i));
            });

            addSvi(core1, 10, '10.10.10.1', '255.255.255.0');
            addSvi(core1, 20, '10.10.20.1', '255.255.255.0');
            addSvi(core1, 99, '10.10.99.1', '255.255.255.0');

            acc.forEach((a, i) => {
                const p = host(place(t, 'pc', `PC${i + 1}`, 260 + i * 250, 690), `10.10.10.${11 + i}`, '255.255.255.0', '10.10.10.1');
                const l = wire(t, p, a);
                if (l) {
                    const swIf = a.interfaces.find(x => (x.id === l.aInterfaceId || x.id === l.bInterfaceId) && x.speedMbps < 10000);
                    if (swIf) { swIf.mode = 'access'; swIf.accessVlan = 10; }
                }
            });
            return t;
        },
    },
    {
        id: 'wan-ospf',
        name: 'Three-site WAN with OSPF',
        description: 'Head office and two branches over serial links, converged with OSPF.',
        difficulty: 'advanced',
        tags: ['ospf', 'wan', 'serial', 'convergence'],
        icon: 'router-core',
        build: () => {
            const t = createTopology('Three-site WAN with OSPF', 'Dynamic routing beats maintaining static routes by hand.');
            const hq = place(t, 'router-branch', 'R-HQ', 660, 200);
            const b1 = place(t, 'router-branch', 'R-BR1', 380, 400);
            const b2 = place(t, 'router-branch', 'R-BR2', 940, 400);

            routerIf(hq, 'GigabitEthernet0/0/0', '10.0.0.1', '255.255.255.0');
            routerIf(hq, 'Serial0/0/0', '172.16.1.1', '255.255.255.252');
            routerIf(hq, 'Serial0/1/0', '172.16.2.1', '255.255.255.252');
            routerIf(b1, 'GigabitEthernet0/0/0', '10.1.0.1', '255.255.255.0');
            routerIf(b1, 'Serial0/0/0', '172.16.1.2', '255.255.255.252');
            routerIf(b2, 'GigabitEthernet0/0/0', '10.2.0.1', '255.255.255.0');
            routerIf(b2, 'Serial0/0/0', '172.16.2.2', '255.255.255.252');

            [hq, b1, b2].forEach((r, i) => {
                r.routing.ospf.enabled = true;
                r.routing.ospf.processId = 1;
                r.routing.ospf.routerId = `1.1.1.${i + 1}`;
            });

            wire(t, hq, b1, 'Serial0/0/0', 'Serial0/0/0');
            wire(t, hq, b2, 'Serial0/1/0', 'Serial0/0/0');

            const swHq = place(t, 'switch-24', 'SW-HQ', 660, 340);
            const swB1 = place(t, 'switch-24', 'SW-BR1', 240, 560);
            const swB2 = place(t, 'switch-24', 'SW-BR2', 1080, 560);
            wire(t, hq, swHq, 'GigabitEthernet0/0/0');
            wire(t, b1, swB1, 'GigabitEthernet0/0/0');
            wire(t, b2, swB2, 'GigabitEthernet0/0/0');
            wire(t, host(place(t, 'pc', 'PC-HQ', 560, 470), '10.0.0.10', '255.255.255.0', '10.0.0.1'), swHq);
            wire(t, host(place(t, 'pc', 'PC-BR1', 160, 700), '10.1.0.10', '255.255.255.0', '10.1.0.1'), swB1);
            wire(t, host(place(t, 'pc', 'PC-BR2', 1160, 700), '10.2.0.10', '255.255.255.0', '10.2.0.1'), swB2);
            return t;
        },
    },
    {
        id: 'dmz-firewall',
        name: 'Firewall with a DMZ',
        description: 'Inside, outside and DMZ zones with ACLs, NAT and a published web server.',
        difficulty: 'advanced',
        tags: ['firewall', 'dmz', 'acl', 'nat', 'security'],
        icon: 'firewall',
        build: () => {
            const t = createTopology('Firewall with a DMZ', 'Three zones, one policy, and the reason a DMZ exists.');
            const net = place(t, 'internet', 'Internet', 660, 80);
            net.interfaces[0].ipv4 = '198.51.100.1';
            net.interfaces[0].mask = '255.255.255.248';
            const fw = place(t, 'firewall-ngfw', 'FW1', 660, 250);
            routerIf(fw, 'GigabitEthernet1/0', '198.51.100.2', '255.255.255.248');
            routerIf(fw, 'GigabitEthernet1/1', '10.20.0.1', '255.255.255.0');
            routerIf(fw, 'GigabitEthernet1/2', '172.31.0.1', '255.255.255.0');
            const out = fw.interfaces.find(i => i.name === 'GigabitEthernet1/0')!;
            const insd = fw.interfaces.find(i => i.name === 'GigabitEthernet1/1')!;
            const dmz = fw.interfaces.find(i => i.name === 'GigabitEthernet1/2')!;
            out.natRole = 'outside'; insd.natRole = 'inside'; dmz.natRole = 'inside';
            fw.nat = { enabled: true, mode: 'pat', outsideAddress: '198.51.100.2', staticMappings: [{ id: nid('nat'), inside: '172.31.0.80', outside: '198.51.100.3', port: 80 }], translations: [] };
            fw.routing.defaultGateway = '198.51.100.1';

            addAcl(fw, 'OUTSIDE-IN', 'extended');
            fw.acls[0].rules.push(
                { id: nid('r'), seq: 10, action: 'permit', protocol: 'tcp', srcAny: true, src: '', srcWildcard: '', dstAny: false, dst: '172.31.0.80', dstWildcard: '0.0.0.0', dstPort: 80, remark: 'Publish the DMZ web server only' },
                { id: nid('r'), seq: 20, action: 'deny', protocol: 'ip', srcAny: true, src: '', srcWildcard: '', dstAny: false, dst: '10.20.0.0', dstWildcard: '0.0.0.255', remark: 'The Internet must never reach the inside network' },
            );
            out.aclIn = 'OUTSIDE-IN';

            wire(t, net, fw, undefined, 'GigabitEthernet1/0');
            const swIn = place(t, 'switch-24', 'SW-INSIDE', 400, 430);
            const swDmz = place(t, 'switch-24', 'SW-DMZ', 940, 430);
            wire(t, fw, swIn, 'GigabitEthernet1/1');
            wire(t, fw, swDmz, 'GigabitEthernet1/2');
            wire(t, host(place(t, 'pc', 'PC-Staff', 300, 610), '10.20.0.10', '255.255.255.0', '10.20.0.1', '172.31.0.53'), swIn);
            wire(t, host(place(t, 'server-database', 'DB1', 500, 610), '10.20.0.20', '255.255.255.0', '10.20.0.1'), swIn);
            const web = host(place(t, 'server-web', 'DMZ-Web', 880, 610), '172.31.0.80', '255.255.255.0', '172.31.0.1');
            web.services.http.enabled = true;
            web.services.http.title = 'Public site (DMZ)';
            wire(t, web, swDmz);
            const dnsSrv = host(place(t, 'server-dns', 'DMZ-DNS', 1060, 610), '172.31.0.53', '255.255.255.0', '172.31.0.1');
            addDnsRecord(dnsSrv, 'www.corp.example', '172.31.0.80');
            wire(t, dnsSrv, swDmz);
            return t;
        },
    },
    {
        id: 'enterprise-wifi',
        name: 'Enterprise Wi-Fi with a controller',
        description: 'WLC, two Wi-Fi 7 APs, staff and guest SSIDs mapped to separate VLANs.',
        difficulty: 'advanced',
        tags: ['wifi7', 'wlc', 'guest-vlan', 'roaming'],
        icon: 'wlc',
        build: () => {
            const t = createTopology('Enterprise Wi-Fi', 'Two SSIDs, two VLANs, one controller.');
            const mls = place(t, 'switch-l3', 'MLS1', 660, 180);
            addVlan(mls, 10, 'STAFF'); addVlan(mls, 20, 'GUEST'); addVlan(mls, 99, 'MGMT');
            addSvi(mls, 10, '10.30.10.1', '255.255.255.0');
            addSvi(mls, 20, '10.30.20.1', '255.255.255.0');
            addSvi(mls, 99, '10.30.99.1', '255.255.255.0');
            addDhcpPool(mls, { name: 'STAFF', network: '10.30.10.0', mask: '255.255.255.0', rangeStart: '10.30.10.50', rangeEnd: '10.30.10.200', gateway: '10.30.10.1', dnsServer: '10.30.10.10' });
            addDhcpPool(mls, { name: 'GUEST', network: '10.30.20.0', mask: '255.255.255.0', rangeStart: '10.30.20.50', rangeEnd: '10.30.20.200', gateway: '10.30.20.1', dnsServer: '10.30.10.10' });

            const accessVlanOn = (sw: Device, link: Link | undefined, vlan: number) => {
                if (!link) return;
                const i = sw.interfaces.find(x => (x.id === link.aInterfaceId || x.id === link.bInterfaceId) && x.speedMbps < 10000);
                if (i) { i.mode = 'access'; i.accessVlan = vlan; }
            };

            const wlc = host(place(t, 'wlc', 'WLC1', 380, 300), '10.30.99.5', '255.255.255.0', '10.30.99.1');
            accessVlanOn(mls, wire(t, wlc, mls), 99);

            const sw = place(t, 'switch-48', 'SW-ACCESS', 660, 330);
            const trunk = wire(t, mls, sw, 'TenGigabitEthernet1/1/0', 'TenGigabitEthernet1/1/0');
            if (trunk) trunk.label = 'trunk 10,20,99';
            [mls, sw].forEach(d => d.interfaces.filter(i => i.speedMbps >= 10000).forEach(i => { i.mode = 'trunk'; i.trunkVlans = [10, 20, 99]; i.nativeVlan = 99; }));

            [1, 2].forEach(n => {
                const ap = place(t, 'ap-wifi7', `AP${n}`, 480 + (n - 1) * 380, 480);
                ap.wireless!.ssid = 'SelfStudy-Staff';
                ap.wireless!.guestSsid = 'SelfStudy-Guest';
                ap.wireless!.security = 'wpa3-personal';
                ap.wireless!.passphrase = 'Staff-2026!';
                ap.wireless!.band = '6GHz';
                ap.wireless!.channel = 37;
                ap.wireless!.vlanId = 10;
                const l = wire(t, ap, sw);
                if (l) {
                    const swIf = sw.interfaces.find(i => (i.id === l.aInterfaceId || i.id === l.bInterfaceId) && i.speedMbps < 10000);
                    if (swIf) { swIf.mode = 'trunk'; swIf.trunkVlans = [10, 20, 99]; swIf.nativeVlan = 99; }
                }
                const uplink = ap.interfaces.find(i => i.medium === 'copper-ethernet');
                if (uplink) { uplink.mode = 'trunk'; uplink.trunkVlans = [10, 20, 99]; }
            });

            ['Phone-Staff', 'Laptop-Staff'].forEach((n, i) => {
                const d = place(t, i === 0 ? 'smartphone' : 'laptop', n, 400 + i * 180, 650);
                const w = d.interfaces.find(x => x.medium === 'wireless')!;
                w.ssid = 'SelfStudy-Staff'; w.passphrase = 'Staff-2026!'; w.band = '6GHz'; w.dhcp = true; w.enabled = true;
                d.host.dhcp = true;
            });
            const guest = place(t, 'tablet', 'Guest-Tablet', 900, 650);
            const gw = guest.interfaces.find(x => x.medium === 'wireless')!;
            gw.ssid = 'SelfStudy-Staff'; gw.passphrase = 'Staff-2026!'; gw.dhcp = true;
            guest.host.dhcp = true;

            const dns = host(place(t, 'server-dns', 'SRV-DNS', 940, 220), '10.30.10.10', '255.255.255.0', '10.30.10.1');
            addDnsRecord(dns, 'intranet.selfstudy.local', '10.30.10.20');
            accessVlanOn(mls, wire(t, dns, mls), 10);
            return t;
        },
    },
    {
        id: 'datacenter-leaf-spine',
        name: 'Leaf-spine data center',
        description: 'Two spines, four leaves, ECMP everywhere and no blocked links.',
        difficulty: 'expert',
        tags: ['datacenter', 'leaf-spine', 'ecmp', 'vxlan'],
        icon: 'switch-l3',
        build: () => {
            const t = createTopology('Leaf-spine data center', 'Why modern fabrics route instead of switching.');
            const spines = [1, 2].map(n => place(t, 'switch-spine', `SPINE${n}`, 520 + (n - 1) * 340, 160));
            const leaves = [1, 2, 3, 4].map(n => place(t, 'switch-leaf', `LEAF${n}`, 280 + (n - 1) * 260, 380));

            [...spines, ...leaves].forEach((sw, i) => {
                sw.routing.ospf.enabled = true;
                sw.routing.ospf.routerId = `10.255.255.${i + 1}`;
            });

            // A routed underlay: every fabric link is its own /30, every port is
            // a routed port. That is why STP has nothing to block here and every
            // uplink carries traffic at the same time (ECMP).
            let p2pBlock = 0;
            leaves.forEach((leaf, li) => {
                spines.forEach((spine, si) => {
                    const link = wire(t, leaf, spine, `HundredGigE1/${si}`, `HundredGigE1/${li}`);
                    if (!link) return;
                    link.label = '100G routed';
                    const base = `10.255.${p2pBlock++}`;
                    const leafIf = leaf.interfaces.find(x => x.id === link.aInterfaceId || x.id === link.bInterfaceId);
                    const spineIf = spine.interfaces.find(x => x.id === link.aInterfaceId || x.id === link.bInterfaceId);
                    if (leafIf) { leafIf.mode = 'routed'; leafIf.ipv4 = `${base}.1`; leafIf.mask = '255.255.255.252'; }
                    if (spineIf) { spineIf.mode = 'routed'; spineIf.ipv4 = `${base}.2`; spineIf.mask = '255.255.255.252'; }
                });
            });

            leaves.forEach((leaf, i) => {
                const vlan = 100 + i;
                addVlan(leaf, vlan, `TENANT${i + 1}`);
                addSvi(leaf, vlan, `10.${i + 1}.0.1`, '255.255.255.0');
                const h = place(t, i % 2 === 0 ? 'hypervisor' : 'k8s-node', i % 2 === 0 ? `ESX${i + 1}` : `K8S${i + 1}`, 260 + i * 260, 590);
                host(h, `10.${i + 1}.0.10`, '255.255.255.0', `10.${i + 1}.0.1`);
                const l = wire(t, h, leaf);
                if (l) {
                    const leafIf = leaf.interfaces.find(x => (x.id === l.aInterfaceId || x.id === l.bInterfaceId) && x.speedMbps < 100000);
                    if (leafIf) { leafIf.mode = 'access'; leafIf.accessVlan = vlan; }
                }
            });
            return t;
        },
    },
    {
        id: 'iot-segmentation',
        name: 'IoT segmentation',
        description: 'Cameras, sensors and smart devices isolated from the corporate LAN with VLANs and ACLs.',
        difficulty: 'intermediate',
        tags: ['iot', 'segmentation', 'acl', 'security'],
        icon: 'sensor',
        build: () => {
            const t = createTopology('IoT segmentation', 'The single most valuable thing you can do for IoT security.');
            const r = place(t, 'router-branch', 'R1', 660, 170);
            routerIf(r, 'GigabitEthernet0/0/0', '10.40.1.1', '255.255.255.0');
            routerIf(r, 'GigabitEthernet0/0/1', '10.40.99.1', '255.255.255.0');
            addAcl(r, 'IOT-OUT', 'extended');
            r.acls[0].rules.push(
                { id: nid('r'), seq: 10, action: 'deny', protocol: 'ip', srcAny: false, src: '10.40.99.0', srcWildcard: '0.0.0.255', dstAny: false, dst: '10.40.1.0', dstWildcard: '0.0.0.255', remark: 'IoT may never initiate to the corporate LAN' },
                { id: nid('r'), seq: 20, action: 'permit', protocol: 'ip', srcAny: true, src: '', srcWildcard: '', dstAny: true, dst: '', dstWildcard: '', remark: 'Everything else is allowed out' },
            );
            const iotIf = r.interfaces.find(i => i.name === 'GigabitEthernet0/0/1');
            if (iotIf) iotIf.aclIn = 'IOT-OUT';

            const swCorp = place(t, 'switch-24', 'SW-CORP', 420, 350);
            const swIot = place(t, 'switch-24', 'SW-IOT', 900, 350);
            wire(t, r, swCorp, 'GigabitEthernet0/0/0');
            wire(t, r, swIot, 'GigabitEthernet0/0/1');
            wire(t, host(place(t, 'pc', 'PC-Finance', 300, 530), '10.40.1.10', '255.255.255.0', '10.40.1.1'), swCorp);
            wire(t, host(place(t, 'server-file', 'FileServer', 500, 530), '10.40.1.20', '255.255.255.0', '10.40.1.1'), swCorp);
            wire(t, host(place(t, 'ip-camera', 'CAM1', 780, 530), '10.40.99.10', '255.255.255.0', '10.40.99.1'), swIot);
            wire(t, host(place(t, 'ip-camera', 'CAM2', 920, 530), '10.40.99.11', '255.255.255.0', '10.40.99.1'), swIot);
            wire(t, host(place(t, 'iot-plc', 'PLC1', 1060, 530), '10.40.99.20', '255.255.255.0', '10.40.99.1'), swIot);
            return t;
        },
    },
];

export function getTemplate(id: string): TopologyTemplate | undefined {
    return TOPOLOGY_TEMPLATES.find(t => t.id === id);
}

export function buildTemplate(id: string): Topology | undefined {
    const tpl = getTemplate(id);
    if (!tpl) return undefined;
    const t = tpl.build();
    t.name = tpl.name;
    t.description = tpl.description;
    return t;
}

/** Handy summary used by the project cards. */
export function topologyStats(t: Topology): {
    devices: number; links: number; subnets: number; vlans: number; wireless: number;
} {
    const subnets = new Set<string>();
    let wireless = 0;
    const vlans = new Set<number>();
    for (const d of t.devices) {
        for (const v of d.vlans || []) vlans.add(v.id);
        for (const i of d.interfaces) {
            if (i.ipv4 && isValidIPv4(i.ipv4)) subnets.add(`${networkAddressSafe(i.ipv4, i.mask)}/${maskToPrefix(i.mask)}`);
            if (i.medium === 'wireless' || i.medium === 'cellular') wireless++;
        }
    }
    return { devices: t.devices.length, links: t.links.length, subnets: subnets.size, vlans: vlans.size, wireless };
}

function networkAddressSafe(ip: string, mask: string): string {
    try {
        const p = maskToPrefix(mask);
        const m = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
        return longToIp((ipToLong(ip) & m) >>> 0);
    } catch { return ip; }
}
