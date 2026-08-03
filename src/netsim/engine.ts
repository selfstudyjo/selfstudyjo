/**
 * src/netsim/engine.ts
 * The simulation engine.
 *
 * It models a real network the way the protocols actually behave:
 *   L1  link/power/media state, cable-type correctness
 *   L2  MAC learning, unicast forwarding, flooding, 802.1Q access/trunk/native
 *       VLAN handling, 802.11 association, STP root election and port blocking
 *   L3  connected/static/default routes, RIP & OSPF convergence, longest-prefix
 *       match, administrative distance, TTL decrement, ICMP, NAT/PAT, ACLs
 *   L4  TCP three-way handshake and teardown, UDP datagrams, port semantics
 *   L7  DHCP (DORA), DNS resolution, HTTP request/response, TLS handshake
 *
 * Every forwarding decision emits a SimEvent and a Hop carrying the PDU *as it
 * leaves that device*, so the UI can show the headers being rewritten hop by
 * hop. Paths are computed analytically (BFS over the L2 fabric, longest-prefix
 * match at each router) rather than by brute-force flooding, which keeps traces
 * linear, readable and loop-free.
 */

import type {
    Topology, Device, NetInterface, Link, Pdu, PacketTrace, Hop, HopAction,
    SimEvent, EventKind, ValidationIssue, MacEntry, ArpEntry,
    StaticRoute, DeviceRole, StpPortRole, DhcpLease, NatTranslation,
} from './types';
import { getDeviceType, isL2Forwarder, isL3Forwarder, isFlooder, bridgesFrames } from './devices';
import {
    isValidIPv4, sameSubnet, maskToPrefix, networkAddress, prefixToMask,
    ipToLong, longToIp, longestPrefixMatch, BROADCAST_MAC, normalizeMac,
    broadcastAddress, isLinkLocalIPv4,
} from './ip';
import {
    buildIcmpEcho, buildArpRequest, buildTcpSegment,
    buildUdpDatagram, dhcpLayer, dnsLayer, httpLayer, tlsLayer,
    rewriteEthernet, decrementTtl, applyNat, layersOf,
    resetPduCounter, randomEphemeralPort, icmpLayer, buildPdu,
} from './packet';

/* ══════════════════════════ small helpers ══════════════════════════ */

export function roleOf(device: Device): DeviceRole {
    return getDeviceType(device.typeId)?.role ?? 'host';
}

function ifaceLabel(i: NetInterface): string {
    return i.short || i.name;
}

let idc = 0;
function uid(prefix: string): string {
    idc += 1;
    return `${prefix}-${idc}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ══════════════════════════ path result types ══════════════════════════ */

interface Peer {
    link: Link;
    peerDeviceId: string;
    peerIfaceId: string;
}

interface L2Step {
    deviceId: string;
    inIfaceId: string;
    outIfaceId: string;
    linkId: string;
    action: HopAction;
    vlanIn: number;
    vlanOut: number;
    taggedOut: boolean;
}

interface L2PathResult {
    ok: boolean;
    reason?: string;
    steps: L2Step[];
    /** Link the source uses to leave its own port. */
    firstLinkId?: string;
    /** Interface on the destination device the frame arrives on. */
    dstIfaceId?: string;
    latencyMs: number;
}

interface EgressDecision {
    iface: NetInterface;
    nextHopIp: string;
    direct: boolean;
    source: string;
    routeLabel: string;
    metric: number;
}

export interface PingOptions {
    count?: number;
    ttl?: number;
    sizeBytes?: number;
    /** Suppress event emission (used for silent reachability probes). */
    quiet?: boolean;
}

export interface PingResult {
    ok: boolean;
    sent: number;
    received: number;
    lossPct: number;
    minMs: number;
    avgMs: number;
    maxMs: number;
    reason?: string;
    trace?: PacketTrace;
    returnTrace?: PacketTrace;
    lines: string[];
}

export interface TracerouteHopResult {
    ttl: number;
    deviceName: string;
    ip: string;
    rttMs: number[];
    reachedTarget: boolean;
    timedOut: boolean;
}

/* ══════════════════════════ Simulator ══════════════════════════ */

export class Simulator {
    topology: Topology;
    events: SimEvent[] = [];
    traces: PacketTrace[] = [];
    issues: ValidationIssue[] = [];

    private seq = 0;
    private clockMs = 0;

    private byId = new Map<string, Device>();
    private ifaceOwner = new Map<string, Device>();
    private ifaceById = new Map<string, NetInterface>();
    /**
     * interfaceId → every peer reachable from it. A wired port has exactly one
     * peer; an access-point radio has one per associated client, which is why
     * this is a list and not a single value.
     */
    private peerMap = new Map<string, Peer[]>();
    /**
     * Every interface that has a cable attached, regardless of whether the link
     * is up. Validation needs this: a shut interface has no adjacency but is
     * still very much cabled, and "you forgot no shutdown" is the whole point.
     */
    private cabled = new Set<string>();
    private virtualLinks: Link[] = [];
    private routingTables = new Map<string, StaticRoute[]>();
    /**
     * Session table per firewall. A stateful firewall permits the return traffic
     * of a session it already allowed, which is the whole difference between a
     * firewall policy and a stateless ACL.
     */
    private sessions = new Map<string, Set<string>>();

    constructor(topology: Topology) {
        this.topology = topology;
        this.reset();
    }

    /* ─────────────── setup / reset ─────────────── */

    reset(): void {
        this.events = [];
        this.traces = [];
        this.issues = [];
        this.seq = 0;
        this.clockMs = 0;
        resetPduCounter();

        this.byId.clear();
        this.ifaceOwner.clear();
        this.ifaceById.clear();
        this.peerMap.clear();
        this.cabled.clear();
        this.sessions.clear();
        this.virtualLinks = [];
        this.routingTables.clear();

        for (const d of this.topology.devices) {
            this.byId.set(d.id, d);
            d.macTable = [];
            d.arpTable = [];
            if (d.nat) d.nat.translations = [];
            if (d.services?.dhcp) d.services.dhcp.leases = d.services.dhcp.leases || [];
            for (const i of d.interfaces) {
                this.ifaceOwner.set(i.id, d);
                this.ifaceById.set(i.id, i);
                i.counters = { txFrames: 0, rxFrames: 0, txBytes: 0, rxBytes: 0, drops: 0 };
                i.up = false;
            }
        }

        this.computeWirelessAssociations();
        this.computeLinkStates();
        this.runStp();
        this.computeRoutingTables();
    }

    /** Recompute everything without wiping the event log (used after edits). */
    recompute(): void {
        this.byId.clear();
        this.ifaceOwner.clear();
        this.ifaceById.clear();
        this.peerMap.clear();
        this.cabled.clear();
        this.virtualLinks = [];
        this.routingTables.clear();
        for (const d of this.topology.devices) {
            this.byId.set(d.id, d);
            for (const i of d.interfaces) {
                this.ifaceOwner.set(i.id, d);
                this.ifaceById.set(i.id, i);
            }
        }
        this.computeWirelessAssociations();
        this.computeLinkStates();
        this.runStp();
        this.computeRoutingTables();
    }

    private emit(kind: EventKind, message: string, o: Partial<SimEvent> = {}): SimEvent {
        this.seq += 1;
        const ev: SimEvent = {
            id: uid('ev'),
            seq: this.seq,
            timeMs: Math.round(this.clockMs * 100) / 100,
            kind,
            message,
            ...o,
        };
        this.events.push(ev);
        if (this.events.length > 4000) this.events.splice(0, 1000);
        return ev;
    }

    device(id: string): Device | undefined { return this.byId.get(id); }
    iface(id: string): NetInterface | undefined { return this.ifaceById.get(id); }
    ownerOf(ifaceId: string): Device | undefined { return this.ifaceOwner.get(ifaceId); }

    get allLinks(): Link[] { return [...this.topology.links, ...this.virtualLinks]; }

    /* ─────────────── L1: wireless association + link state ─────────────── */

    private computeWirelessAssociations(): void {
        const aps = this.topology.devices.filter(d => {
            const r = roleOf(d);
            return (r === 'ap' || r === 'router' || r === 'repeater') && !!d.wireless?.ssid;
        });

        for (const client of this.topology.devices) {
            if (!client.powered) continue;
            for (const cif of client.interfaces) {
                if (cif.medium !== 'wireless' && cif.medium !== 'cellular') continue;
                if (!cif.enabled) continue;
                // Only client radios associate; an AP's own radio is the other end.
                const clientRole = roleOf(client);
                if (clientRole === 'ap' || clientRole === 'wlc') continue;
                if (!cif.ssid) continue;

                const ap = aps.find(a =>
                    a.powered &&
                    (a.wireless!.ssid === cif.ssid || a.wireless!.guestSsid === cif.ssid) &&
                    this.wifiKeyOk(a, cif)
                );
                if (!ap) continue;

                const radio = ap.interfaces.find(i =>
                    (i.medium === 'wireless' || i.medium === 'cellular') && i.enabled &&
                    (!ap.wireless!.band || !cif.band || i.speedMbps > 0)
                );
                if (!radio) continue;

                const vl: Link = {
                    id: `wl-${cif.id}-${radio.id}`,
                    aDeviceId: client.id, aInterfaceId: cif.id,
                    bDeviceId: ap.id, bInterfaceId: radio.id,
                    cable: cif.medium === 'cellular' ? 'cellular' : 'wireless',
                    severed: false,
                    latencyMs: cif.medium === 'cellular' ? 28 : 2,
                    bandwidthMbps: Math.min(cif.speedMbps || 300, radio.speedMbps || 300),
                    lossPct: 0,
                    label: `${cif.ssid}`,
                    status: 'up',
                };
                this.virtualLinks.push(vl);
                this.emit('wireless', `${client.hostname} associated to SSID "${cif.ssid}" on ${ap.hostname}`, {
                    deviceId: client.id, deviceName: client.hostname, layer: 2, protocol: '802.11',
                    detail: `Association is a Layer-2 event: the client authenticates, associates, and only then asks for an IP address. Band ${ap.wireless!.band}, channel ${ap.wireless!.channel}, security ${ap.wireless!.security.toUpperCase()}.`,
                });
            }
        }
    }

    private wifiKeyOk(ap: Device, cif: NetInterface): boolean {
        const w = ap.wireless!;
        if (w.security === 'open') return true;
        if (!cif.passphrase) return false;
        return cif.passphrase === w.passphrase;
    }

    private computeLinkStates(): void {
        for (const link of this.allLinks) {
            const a = this.byId.get(link.aDeviceId);
            const b = this.byId.get(link.bDeviceId);
            const ai = this.ifaceById.get(link.aInterfaceId);
            const bi = this.ifaceById.get(link.bInterfaceId);

            this.cabled.add(link.aInterfaceId);
            this.cabled.add(link.bInterfaceId);

            if (!a || !b || !ai || !bi) { link.status = 'down'; continue; }
            if (link.severed) { link.status = 'down'; continue; }
            if (!a.powered || !b.powered) { link.status = 'down'; continue; }
            if (!ai.enabled || !bi.enabled) { link.status = 'shutdown'; continue; }

            link.status = 'up';
            ai.up = true;
            bi.up = true;
            this.addPeer(ai.id, { link, peerDeviceId: b.id, peerIfaceId: bi.id });
            this.addPeer(bi.id, { link, peerDeviceId: a.id, peerIfaceId: ai.id });
        }

        // An SVI is a virtual interface: it comes up when at least one physical
        // port in its VLAN is up. Without this, `interface vlan 10` would have an
        // address but never install a connected route.
        for (const d of this.topology.devices) {
            for (const svi of d.interfaces) {
                if (!svi.sviVlan) continue;
                svi.up = d.powered && d.interfaces.some(p =>
                    p.id !== svi.id && p.up && (
                        (p.mode === 'access' && (p.accessVlan || 1) === svi.sviVlan) ||
                        (p.mode === 'trunk' && (!p.trunkVlans.length || p.trunkVlans.includes(svi.sviVlan!))) ||
                        ((p.medium === 'wireless' || p.medium === 'cellular') && (d.wireless?.vlanId || 1) === svi.sviVlan)
                    ));
            }
        }
    }

    private addPeer(ifaceId: string, peer: Peer): void {
        const list = this.peerMap.get(ifaceId);
        if (list) list.push(peer);
        else this.peerMap.set(ifaceId, [peer]);
    }

    /** Every peer on this interface (several, for an AP radio). */
    private peersOf(ifaceId: string): Peer[] {
        return this.peerMap.get(ifaceId) || [];
    }

    /** The representative peer — enough for link-state and status checks. */
    private adjacency_get(ifaceId: string): Peer | undefined {
        return this.peerMap.get(ifaceId)?.[0];
    }

    private isCabledUp(ifaceId: string): boolean {
        return (this.peerMap.get(ifaceId)?.length || 0) > 0;
    }

    /**
     * Does this box forward frames between its own ports?
     *
     * Switches, hubs and the Internet cloud obviously do. So does any all-in-one
     * box that has two or more switchports/radios — a home router really is a
     * router bolted to a switch bolted to an access point, and modelling that
     * honestly is what makes the home-network lab behave like the real thing.
     */
    private bridgesInternally(dev: Device): boolean {
        if (bridgesFrames(roleOf(dev))) return true;
        let bridgePorts = 0;
        for (const i of dev.interfaces) {
            if (i.medium === 'console') continue;
            if (i.mode === 'access' || i.mode === 'trunk' || i.medium === 'wireless' || i.medium === 'cellular') {
                bridgePorts++;
                if (bridgePorts >= 2) return true;
            }
        }
        return false;
    }

    /** Interfaces on this device that can carry `vlan` onto a cable. */
    private bridgePortsFor(dev: Device, vlan: number, exceptId?: string): Array<{ iface: NetInterface; tagged: boolean }> {
        const out: Array<{ iface: NetInterface; tagged: boolean }> = [];
        for (const p of dev.interfaces) {
            if (p.id === exceptId) continue;
            if (!this.isCabledUp(p.id)) continue;
            const e = this.canEgress(dev, p, vlan, true);
            if (e.ok) out.push({ iface: p, tagged: e.tagged });
        }
        return out;
    }

    /* ─────────────── L2: Spanning Tree ─────────────── */

    /**
     * Elects a root bridge and assigns port roles so redundant links get
     * blocked instead of looping. Costs follow the IEEE table (1G=4, 100M=19,
     * 10M=100), the root bridge is the lowest priority then lowest MAC.
     */
    runStp(): void {
        const bridges = this.topology.devices.filter(d => d.powered && isL2Forwarder(roleOf(d)) && d.stp?.enabled !== false);
        if (bridges.length === 0) return;

        /**
         * Spanning tree only runs on switchports. A routed interface is a Layer-3
         * link — which is exactly why a leaf-spine fabric can use every uplink at
         * once instead of blocking half of them.
         */
        const isSwitchport = (ifaceId: string) => {
            const i = this.ifaceById.get(ifaceId);
            return !!i && i.mode !== 'routed' && !i.sviVlan;
        };
        const stpLink = (link: Link) => isSwitchport(link.aInterfaceId) && isSwitchport(link.bInterfaceId);

        const bridgeId = (d: Device) => {
            const macs = d.interfaces.map(i => normalizeMac(i.mac)).filter(Boolean).sort();
            const prio = d.stp?.priority ?? 32768;
            return `${String(prio).padStart(5, '0')}:${macs[0] || 'FF:FF:FF:FF:FF:FF'}`;
        };

        const ids = new Map<string, string>();
        bridges.forEach(b => ids.set(b.id, bridgeId(b)));

        const root = bridges.reduce((best, b) => (ids.get(b.id)! < ids.get(best.id)! ? b : best), bridges[0]);

        // Dijkstra over bridge fabric using STP port costs.
        const cost = new Map<string, number>();
        const viaIface = new Map<string, string>();
        bridges.forEach(b => cost.set(b.id, Number.POSITIVE_INFINITY));
        cost.set(root.id, 0);

        const bridgeSet = new Set(bridges.map(b => b.id));
        const visited = new Set<string>();

        for (let n = 0; n < bridges.length; n++) {
            let cur: Device | null = null;
            let curCost = Number.POSITIVE_INFINITY;
            for (const b of bridges) {
                if (visited.has(b.id)) continue;
                const c = cost.get(b.id)!;
                if (c < curCost || (c === curCost && cur && ids.get(b.id)! < ids.get(cur.id)!)) {
                    cur = b; curCost = c;
                }
            }
            if (!cur || curCost === Number.POSITIVE_INFINITY) break;
            visited.add(cur.id);

            for (const i of cur.interfaces) {
                for (const adj of this.peersOf(i.id)) {
                    if (!bridgeSet.has(adj.peerDeviceId)) continue;
                    if (adj.link.status !== 'up' || !stpLink(adj.link)) continue;
                    const c = curCost + stpCost(i.speedMbps);
                    const peerCost = cost.get(adj.peerDeviceId)!;
                    if (c < peerCost) {
                        cost.set(adj.peerDeviceId, c);
                        viaIface.set(adj.peerDeviceId, adj.peerIfaceId);
                    }
                }
            }
        }

        // Assign roles.
        for (const b of bridges) {
            b.stp = b.stp || { enabled: true, mode: 'rapid-pvst', priority: 32768 };
            b.stp.portRoles = {};
            b.stp.isRoot = b.id === root.id;
            b.stp.rootBridgeId = ids.get(root.id);
        }

        const rootPortOf = new Map<string, string | undefined>();
        for (const b of bridges) rootPortOf.set(b.id, b.id === root.id ? undefined : viaIface.get(b.id));

        for (const link of this.allLinks) {
            if (link.status !== 'up') continue;
            if (!stpLink(link)) continue;
            link.blockedEndDeviceId = undefined;
            const A = this.byId.get(link.aDeviceId), B = this.byId.get(link.bDeviceId);
            if (!A || !B) continue;
            const aIsBridge = bridgeSet.has(A.id), bIsBridge = bridgeSet.has(B.id);
            if (!aIsBridge || !bIsBridge) {
                // Edge port toward a host — designated, forwarding immediately (portfast).
                if (aIsBridge) A.stp!.portRoles![link.aInterfaceId] = 'designated';
                if (bIsBridge) B.stp!.portRoles![link.bInterfaceId] = 'designated';
                continue;
            }

            const aIsRootPort = rootPortOf.get(A.id) === link.aInterfaceId;
            const bIsRootPort = rootPortOf.get(B.id) === link.bInterfaceId;

            if (aIsRootPort) {
                A.stp!.portRoles![link.aInterfaceId] = 'root';
                B.stp!.portRoles![link.bInterfaceId] = 'designated';
            } else if (bIsRootPort) {
                B.stp!.portRoles![link.bInterfaceId] = 'root';
                A.stp!.portRoles![link.aInterfaceId] = 'designated';
            } else {
                // Neither end is a root port → one end must block.
                const aBetter = cost.get(A.id)! < cost.get(B.id)! ||
                    (cost.get(A.id)! === cost.get(B.id)! && ids.get(A.id)! < ids.get(B.id)!);
                const winner = aBetter ? A : B;
                const loser = aBetter ? B : A;
                const winIf = aBetter ? link.aInterfaceId : link.bInterfaceId;
                const loseIf = aBetter ? link.bInterfaceId : link.aInterfaceId;
                winner.stp!.portRoles![winIf] = 'designated';
                loser.stp!.portRoles![loseIf] = 'blocked';
                link.status = 'blocked';
                link.blockedEndDeviceId = loser.id;
                this.emit('stp', `STP blocked ${loser.hostname} ${ifaceLabel(this.ifaceById.get(loseIf)!)} to break a Layer-2 loop`, {
                    deviceId: loser.id, deviceName: loser.hostname, layer: 2, protocol: 'STP',
                    detail: `Root bridge is ${root.hostname} (bridge ID ${ids.get(root.id)}). ${loser.hostname} has a root path cost of ${cost.get(loser.id)}; this redundant port is put into blocking so no frame can circle forever. Remove the primary link and this port becomes forwarding.`,
                });
            }
        }

        if (bridges.length > 1) {
            this.emit('stp', `Spanning tree converged — root bridge is ${root.hostname}`, {
                deviceId: root.id, deviceName: root.hostname, layer: 2, protocol: 'STP',
                detail: `Election compares bridge priority first (default 32768) and then the lowest MAC address. Lower priority on a device you choose deliberately is how you control which switch becomes root.`,
            });
        }
    }

    /* ─────────────── L3: routing tables ─────────────── */

    computeRoutingTables(): void {
        const routers = this.topology.devices.filter(d => d.powered && isL3Forwarder(roleOf(d)));

        // 1. Connected + static + default
        for (const r of routers) {
            const table: StaticRoute[] = [];
            for (const i of r.interfaces) {
                if (!i.ipv4 || !isValidIPv4(i.ipv4) || !i.up) continue;
                table.push({
                    id: `conn-${i.id}`,
                    network: networkAddress(i.ipv4, i.mask),
                    mask: prefixToMask(maskToPrefix(i.mask)),
                    nextHop: '0.0.0.0',
                    exitInterfaceId: i.id,
                    metric: 0,
                    adminDistance: 0,
                    source: 'connected',
                });
            }
            for (const s of r.routing?.staticRoutes || []) {
                table.push({ ...s, adminDistance: s.adminDistance ?? 1, source: s.network === '0.0.0.0' ? 'default' : 'static' });
            }
            if (r.routing?.defaultGateway && isValidIPv4(r.routing.defaultGateway)) {
                table.push({
                    id: `dg-${r.id}`, network: '0.0.0.0', mask: '0.0.0.0',
                    nextHop: r.routing.defaultGateway, metric: 1, adminDistance: 1, source: 'default',
                });
            }
            this.routingTables.set(r.id, table);
        }

        // 2. Dynamic routing: distance-vector convergence across shared subnets.
        const dyn = routers.filter(r => r.routing?.rip?.enabled || r.routing?.ospf?.enabled);
        if (dyn.length > 1) {
            const learned = new Map<string, Map<string, StaticRoute>>();
            dyn.forEach(r => learned.set(r.id, new Map()));

            const neighboursOf = (r: Device) => {
                const out: Array<{ peer: Device; localIface: NetInterface; peerIp: string }> = [];
                for (const i of r.interfaces) {
                    if (!i.ipv4 || !i.up) continue;
                    // Anything in the same subnet, reachable at L2, running a protocol
                    for (const other of dyn) {
                        if (other.id === r.id) continue;
                        for (const oi of other.interfaces) {
                            if (!oi.ipv4 || !oi.up) continue;
                            if (!sameSubnet(i.ipv4, oi.ipv4, i.mask)) continue;
                            const p = this.findL2Path(r, i, other, oi, this.vlanForPort(i));
                            if (p.ok) out.push({ peer: other, localIface: i, peerIp: oi.ipv4 });
                        }
                    }
                }
                return out;
            };

            const protoOf = (r: Device) => (r.routing?.ospf?.enabled ? 'ospf' : 'rip') as 'ospf' | 'rip';
            const adOf = (p: 'ospf' | 'rip') => (p === 'ospf' ? 110 : 120);

            // Bellman-Ford style: iterate until stable (max 32 rounds for 32 hops).
            for (let round = 0; round < 32; round++) {
                let changed = false;
                for (const r of dyn) {
                    for (const nb of neighboursOf(r)) {
                        const nbTable = [
                            ...(this.routingTables.get(nb.peer.id) || []),
                            ...Array.from(learned.get(nb.peer.id)?.values() || []),
                        ];
                        for (const route of nbTable) {
                            if (route.network === '0.0.0.0' && !(nb.peer.routing?.rip?.enabled || nb.peer.routing?.ospf?.enabled)) continue;
                            const key = `${route.network}/${maskToPrefix(route.mask)}`;
                            // Do I already have this connected or statically?
                            const own = (this.routingTables.get(r.id) || []).find(
                                x => x.network === route.network && maskToPrefix(x.mask) === maskToPrefix(route.mask)
                            );
                            if (own) continue;
                            const proto = protoOf(r);
                            const metric = (route.metric ?? 0) + (proto === 'ospf' ? ospfCost(nb.localIface.speedMbps) : 1);
                            if (proto === 'rip' && metric >= 16) continue; // RIP infinity
                            const cur = learned.get(r.id)!.get(key);
                            if (!cur || metric < cur.metric) {
                                learned.get(r.id)!.set(key, {
                                    id: `dyn-${r.id}-${key}`,
                                    network: route.network,
                                    mask: prefixToMask(maskToPrefix(route.mask)),
                                    nextHop: nb.peerIp,
                                    exitInterfaceId: nb.localIface.id,
                                    metric,
                                    adminDistance: adOf(proto),
                                    source: proto,
                                });
                                changed = true;
                            }
                        }
                    }
                }
                if (!changed) break;
            }

            for (const r of dyn) {
                const l = Array.from(learned.get(r.id)!.values());
                r.routing!.learned = l;
                this.routingTables.set(r.id, [...(this.routingTables.get(r.id) || []), ...l]);
                if (l.length) {
                    this.emit('route', `${r.hostname} learned ${l.length} route${l.length > 1 ? 's' : ''} via ${protoOf(r).toUpperCase()}`, {
                        deviceId: r.id, deviceName: r.hostname, layer: 3, protocol: protoOf(r).toUpperCase(),
                        detail: l.map(x => `${x.network}/${maskToPrefix(x.mask)} via ${x.nextHop} [${x.adminDistance}/${x.metric}]`).join('\n'),
                    });
                }
            }
        } else {
            for (const r of routers) if (r.routing) r.routing.learned = [];
        }
    }

    routingTable(deviceId: string): StaticRoute[] {
        const t = this.routingTables.get(deviceId) || [];
        // Best route per prefix wins on administrative distance, then metric.
        const best = new Map<string, StaticRoute>();
        for (const r of t) {
            const k = `${r.network}/${maskToPrefix(r.mask)}`;
            const cur = best.get(k);
            if (!cur || (r.adminDistance ?? 1) < (cur.adminDistance ?? 1) ||
                ((r.adminDistance ?? 1) === (cur.adminDistance ?? 1) && r.metric < cur.metric)) {
                best.set(k, r);
            }
        }
        return Array.from(best.values()).sort(
            (a, b) => maskToPrefix(b.mask) - maskToPrefix(a.mask) || ipToLong(a.network) - ipToLong(b.network)
        );
    }

    /* ─────────────── VLAN helpers ─────────────── */

    private vlanForPort(i: NetInterface): number {
        if (i.mode === 'access') return i.accessVlan || 1;
        if (i.mode === 'trunk') return i.nativeVlan || 1;
        if (i.sviVlan) return i.sviVlan;
        if (i.encapsulationVlan) return i.encapsulationVlan;
        return 1;
    }

    /**
     * Can this frame leave the device on this interface?
     *
     * `transit` distinguishes the two very different cases:
     *  • false — the device is *originating* or *routing* the frame, so any port
     *    type is fair game (that is how a router sends out a routed interface).
     *  • true  — the device is *bridging* the frame through, so the port must be
     *    a switchport that carries this VLAN. This is what stops a LAN broadcast
     *    leaking out of a WAN port.
     */
    private canEgress(dev: Device, i: NetInterface, vlan: number, transit = false): { ok: boolean; tagged: boolean; reason?: string } {
        if (!i.enabled) return { ok: false, tagged: false, reason: `${ifaceLabel(i)} is administratively down` };
        const adj = this.adjacency_get(i.id);
        if (!adj) return { ok: false, tagged: false, reason: `${ifaceLabel(i)} has no cable` };
        if (adj.link.status === 'blocked' && adj.link.blockedEndDeviceId === dev.id) {
            return { ok: false, tagged: false, reason: `${ifaceLabel(i)} is blocking (spanning tree)` };
        }
        if (adj.link.status !== 'up' && adj.link.status !== 'blocked') {
            return { ok: false, tagged: false, reason: `link on ${ifaceLabel(i)} is down` };
        }

        if (i.medium === 'wireless' || i.medium === 'cellular') {
            const w = dev.wireless;
            if (transit && w?.vlanId && w.vlanId !== vlan) {
                return { ok: false, tagged: false, reason: `radio is mapped to VLAN ${w.vlanId}, frame is VLAN ${vlan}` };
            }
            return { ok: true, tagged: false };
        }

        // Hubs, repeaters and modems are media converters: no VLAN awareness.
        if (isFlooder(roleOf(dev))) return { ok: true, tagged: false };

        if (!transit) {
            return { ok: true, tagged: i.mode === 'trunk' && vlan !== (i.nativeVlan || 1) };
        }

        switch (i.mode) {
            case 'access':
                if ((i.accessVlan || 1) !== vlan) {
                    return { ok: false, tagged: false, reason: `${ifaceLabel(i)} is an access port in VLAN ${i.accessVlan}, frame is VLAN ${vlan}` };
                }
                return { ok: true, tagged: false };
            case 'trunk': {
                const allowed = !i.trunkVlans?.length || i.trunkVlans.includes(vlan);
                if (!allowed) return { ok: false, tagged: false, reason: `VLAN ${vlan} is not allowed on trunk ${ifaceLabel(i)}` };
                return { ok: true, tagged: vlan !== (i.nativeVlan || 1) };
            }
            case 'routed':
                return { ok: false, tagged: false, reason: `${ifaceLabel(i)} is a routed port, not a switchport` };
            default:
                return { ok: true, tagged: false };
        }
    }

    /**
     * Normalise the frame's VLAN on the way in. Switchport rules apply to any
     * device that has switchports, not only to boxes we happen to call switches
     * — a home router's LAN ports behave exactly like a switch, because they are.
     */
    private canIngress(dev: Device, i: NetInterface, vlan: number, tagged: boolean): { ok: boolean; vlan: number; reason?: string } {
        if (!i.enabled) return { ok: false, vlan, reason: `${ifaceLabel(i)} is administratively down` };
        const adj = this.adjacency_get(i.id);
        if (adj && adj.link.status === 'blocked' && adj.link.blockedEndDeviceId === dev.id) {
            return { ok: false, vlan, reason: `${ifaceLabel(i)} is blocking (spanning tree)` };
        }
        if (i.medium === 'wireless' || i.medium === 'cellular') {
            return { ok: true, vlan: dev.wireless?.vlanId || vlan };
        }
        if (isFlooder(roleOf(dev))) return { ok: true, vlan };

        switch (i.mode) {
            case 'access':
                if (tagged && vlan !== (i.accessVlan || 1)) {
                    return { ok: false, vlan, reason: `tagged VLAN ${vlan} arrived on access port ${ifaceLabel(i)} (VLAN ${i.accessVlan}) — VLAN mismatch` };
                }
                return { ok: true, vlan: i.accessVlan || 1 };
            case 'trunk': {
                const v = tagged ? vlan : (i.nativeVlan || 1);
                const allowed = !i.trunkVlans?.length || i.trunkVlans.includes(v);
                if (!allowed) return { ok: false, vlan: v, reason: `VLAN ${v} is not in the allowed list on trunk ${ifaceLabel(i)}` };
                return { ok: true, vlan: v };
            }
            default:
                return { ok: true, vlan };
        }
    }

    /* ─────────────── L2 path finding (BFS over the switch fabric) ─────────────── */

    /**
     * Finds the frame's path from (srcDev, srcIface) to (dstDev, dstIface),
     * hopping only through Layer-2 forwarders and honouring VLANs and STP.
     */
    findL2Path(srcDev: Device, srcIface: NetInterface, dstDev: Device, dstIface: NetInterface, vlan: number): L2PathResult {
        const fail = (reason: string): L2PathResult => ({ ok: false, reason, steps: [], latencyMs: 0 });

        if (!srcDev.powered) return fail(`${srcDev.hostname} is powered off`);
        if (!dstDev.powered) return fail(`${dstDev.hostname} is powered off`);

        interface QN {
            deviceId: string;
            inIfaceId: string;
            vlan: number;
            tagged: boolean;
            steps: L2Step[];
            latency: number;
        }

        /**
         * Where can the frame physically leave from? A routed port has exactly one
         * cable. An SVI has none of its own, and a switchport belongs to a bridge
         * — in both of those cases the frame can leave on any member port of the
         * VLAN, which is what makes SVIs and built-in switches work.
         */
        const startPorts: Array<{ iface: NetInterface; tagged: boolean; via: Peer }> = [];
        const bridged = !!srcIface.sviVlan || srcIface.mode === 'access' || srcIface.mode === 'trunk';

        if (bridged) {
            for (const p of this.bridgePortsFor(srcDev, vlan, srcIface.id)) {
                for (const via of this.peersOf(p.iface.id)) {
                    startPorts.push({ iface: p.iface, tagged: p.tagged, via });
                }
            }
            // A switchport that also carries an IP can still send out of itself.
            if (!srcIface.sviVlan) {
                const eg = this.canEgress(srcDev, srcIface, vlan, false);
                if (eg.ok) {
                    for (const via of this.peersOf(srcIface.id)) {
                        startPorts.unshift({ iface: srcIface, tagged: eg.tagged, via });
                    }
                }
            }
            if (!startPorts.length) {
                return fail(srcIface.sviVlan
                    ? `${srcDev.hostname} ${ifaceLabel(srcIface)} has no port up in VLAN ${vlan}`
                    : `${srcDev.hostname} ${ifaceLabel(srcIface)} has no usable path in VLAN ${vlan}`);
            }
        } else {
            const eg = this.canEgress(srcDev, srcIface, vlan, false);
            if (!eg.ok) return fail(eg.reason!);
            const adj0 = this.adjacency_get(srcIface.id);
            if (!adj0) return fail(`${srcDev.hostname} ${ifaceLabel(srcIface)} is not connected to anything`);
            startPorts.push({ iface: srcIface, tagged: eg.tagged, via: adj0 });
        }

        const firstLinkId = startPorts[0].via.link.id;
        const seen = new Set<string>();
        const queue: QN[] = startPorts.map(sp => ({
            deviceId: sp.via.peerDeviceId,
            inIfaceId: sp.via.peerIfaceId,
            vlan,
            tagged: sp.tagged,
            steps: [],
            latency: sp.via.link.latencyMs || 0.5,
        }));
        let guard = 0;

        while (queue.length && guard++ < 4000) {
            const node = queue.shift()!;
            const dev = this.byId.get(node.deviceId);
            const inIf = this.ifaceById.get(node.inIfaceId);
            if (!dev || !inIf || !dev.powered) continue;

            const ing = this.canIngress(dev, inIf, node.vlan, node.tagged);
            if (!ing.ok) continue;
            const v = ing.vlan;

            const key = `${dev.id}:${inIf.id}:${v}`;
            if (seen.has(key)) continue;
            seen.add(key);

            // Arrived on exactly the interface that owns the target address.
            if (dev.id === dstDev.id && inIf.id === dstIface.id) {
                return { ok: true, steps: node.steps, firstLinkId, dstIfaceId: dstIface.id, latencyMs: node.latency };
            }
            // Arrived at the right device on a different port. That still counts
            // when the target address lives on the bridge rather than on one
            // cable: an SVI, a radio, or another switchport in the same VLAN.
            if (dev.id === dstDev.id) {
                const targetIsBridged = !!dstIface.sviVlan
                    || dstIface.medium === 'wireless' || dstIface.medium === 'cellular'
                    || ((dstIface.mode === 'access' || dstIface.mode === 'trunk')
                        && (inIf.mode === 'access' || inIf.mode === 'trunk')
                        && (dstIface.mode !== 'access' || (dstIface.accessVlan || 1) === v));
                if (targetIsBridged) {
                    return { ok: true, steps: node.steps, firstLinkId, dstIfaceId: inIf.id, latencyMs: node.latency };
                }
            }

            const role = roleOf(dev);
            if (!this.bridgesInternally(dev)) continue; // hosts and pure routers terminate the L2 domain

            for (const out of dev.interfaces) {
                if (out.id === inIf.id) continue;
                const e = this.canEgress(dev, out, v, true);
                if (!e.ok) continue;
                // A radio has one peer per associated client, so fan out to all.
                for (const adj of this.peersOf(out.id)) {
                    if (adj.peerIfaceId === inIf.id) continue;
                    queue.push({
                        deviceId: adj.peerDeviceId,
                        inIfaceId: adj.peerIfaceId,
                        vlan: v,
                        tagged: e.tagged,
                        latency: node.latency + (adj.link.latencyMs || 0.5) + (role === 'hub' ? 0.1 : 0.05),
                        steps: [
                            ...node.steps,
                            {
                                deviceId: dev.id,
                                inIfaceId: inIf.id,
                                outIfaceId: out.id,
                                linkId: adj.link.id,
                                action: role === 'hub' || role === 'repeater' ? 'flood'
                                    : (out.medium === 'wireless' || inIf.medium === 'wireless') ? 'bridge-wireless'
                                    : 'forward-l2',
                                vlanIn: v,
                                vlanOut: v,
                                taggedOut: e.tagged,
                            },
                        ],
                    });
                }
            }
        }

        return fail(`no Layer-2 path from ${srcDev.hostname} ${ifaceLabel(srcIface)} to ${dstDev.hostname} in VLAN ${vlan}`);
    }

    /* ─────────────── address ownership + ARP ─────────────── */

    findIpOwner(ip: string): { device: Device; iface: NetInterface } | null {
        if (!isValidIPv4(ip)) return null;
        for (const d of this.topology.devices) {
            for (const i of d.interfaces) {
                if (i.ipv4 && i.ipv4 === ip) return { device: d, iface: i };
            }
        }
        return null;
    }

    /** A cloud stands in for "the rest of the Internet". */
    private findCloud(): { device: Device; iface: NetInterface } | null {
        for (const d of this.topology.devices) {
            if (roleOf(d) !== 'cloud' || !d.powered) continue;
            const i = d.interfaces.find(x => x.ipv4 && isValidIPv4(x.ipv4) && x.up) || d.interfaces[0];
            if (i) return { device: d, iface: i };
        }
        return null;
    }

    /** ARP: who owns `ip` inside the L2 domain reachable from (dev, iface)? */
    resolveArp(dev: Device, iface: NetInterface, ip: string, opts: { quiet?: boolean } = {}): { mac: string; device: Device; iface: NetInterface } | null {
        const cached = dev.arpTable?.find(e => e.ip === ip);
        const owner = this.findIpOwner(ip);
        if (!owner) return null;

        const vlan = this.vlanForPort(iface);
        const path = this.findL2Path(dev, iface, owner.device, owner.iface, vlan);
        if (!path.ok) return null;

        if (!cached) {
            const entry: ArpEntry = { ip, mac: owner.iface.mac, interfaceId: iface.id, type: 'dynamic', ageSec: 0 };
            dev.arpTable = [...(dev.arpTable || []).filter(e => e.ip !== ip), entry];
            if (!opts.quiet) {
                this.emit('arp', `${dev.hostname} resolved ${ip} → ${owner.iface.mac} via ARP`, {
                    deviceId: dev.id, deviceName: dev.hostname, layer: 2, protocol: 'ARP',
                    detail: `ARP Request is a Layer-2 broadcast (FF:FF:FF:FF:FF:FF) sent only inside VLAN ${vlan}. Every host in the VLAN receives it; only ${owner.device.hostname} answers, with a unicast ARP Reply. The mapping is cached so the next packet skips this step.`,
                });
            }
            // Switches along the way learn both MACs.
            this.learnAlongPath(path, iface, owner.iface, vlan);
        }
        return { mac: owner.iface.mac, device: owner.device, iface: owner.iface };
    }

    private learnAlongPath(path: L2PathResult, srcIf: NetInterface, dstIf: NetInterface, vlan: number): void {
        for (const step of path.steps) {
            const sw = this.byId.get(step.deviceId);
            if (!sw || !isL2Forwarder(roleOf(sw))) continue;
            this.learnMac(sw, srcIf.mac, vlan, step.inIfaceId);
        }
        // Reverse direction learning (the reply teaches the other MAC).
        for (const step of path.steps) {
            const sw = this.byId.get(step.deviceId);
            if (!sw || !isL2Forwarder(roleOf(sw))) continue;
            this.learnMac(sw, dstIf.mac, vlan, step.outIfaceId);
        }
    }

    private learnMac(sw: Device, mac: string, vlan: number, ifaceId: string): void {
        sw.macTable = sw.macTable || [];
        const existing = sw.macTable.find(e => e.mac === mac && e.vlan === vlan);
        if (existing) {
            if (existing.interfaceId !== ifaceId) existing.interfaceId = ifaceId;
            existing.ageSec = 0;
            return;
        }
        const entry: MacEntry = { mac, vlan, interfaceId: ifaceId, type: 'dynamic', ageSec: 0 };
        sw.macTable.push(entry);
        const i = this.ifaceById.get(ifaceId);
        this.emit('learn', `${sw.hostname} learned ${mac} on ${i ? ifaceLabel(i) : ifaceId} (VLAN ${vlan})`, {
            deviceId: sw.id, deviceName: sw.hostname, layer: 2, protocol: 'Ethernet',
            detail: 'A switch fills its MAC address table from the SOURCE address of every frame it receives. Nothing else populates it.',
        });
    }

    /* ─────────────── routing decision ─────────────── */

    /** Which interface does this device use to reach `dstIp`, and via which next hop? */
    findEgress(dev: Device, dstIp: string): { ok: boolean; decision?: EgressDecision; reason?: string } {
        const role = roleOf(dev);

        if (isL3Forwarder(role)) {
            const table = this.routingTable(dev.id);
            const entries = table.map(r => ({ ...r, prefix: maskToPrefix(r.mask) }));
            const match = longestPrefixMatch(dstIp, entries as any) as (StaticRoute & { prefix: number }) | null;
            if (!match) {
                return { ok: false, reason: `${dev.hostname} has no route to ${dstIp} — add a static or default route` };
            }
            let exitIface = match.exitInterfaceId ? this.ifaceById.get(match.exitInterfaceId) : undefined;
            let nextHop = match.nextHop && match.nextHop !== '0.0.0.0' ? match.nextHop : dstIp;

            if (!exitIface) {
                exitIface = dev.interfaces.find(i => i.ipv4 && i.up && sameSubnet(i.ipv4, nextHop, i.mask));
            }
            if (!exitIface) {
                return { ok: false, reason: `${dev.hostname} route to ${dstIp} points at next hop ${nextHop}, which is not on any connected subnet (recursive lookup failed)` };
            }
            return {
                ok: true,
                decision: {
                    iface: exitIface,
                    nextHopIp: nextHop,
                    direct: match.source === 'connected',
                    source: match.source || 'static',
                    routeLabel: `${match.network}/${match.prefix} via ${match.nextHop === '0.0.0.0' ? 'directly connected' : match.nextHop} [${match.adminDistance ?? 1}/${match.metric}]`,
                    metric: match.metric,
                },
            };
        }

        // Host / server behaviour: compare against my own subnets, else gateway.
        for (const i of dev.interfaces) {
            if (!i.ipv4 || !isValidIPv4(i.ipv4) || !i.up) continue;
            if (sameSubnet(i.ipv4, dstIp, i.mask)) {
                return {
                    ok: true,
                    decision: {
                        iface: i, nextHopIp: dstIp, direct: true, source: 'connected',
                        routeLabel: `${networkAddress(i.ipv4, i.mask)}/${maskToPrefix(i.mask)} on-link via ${ifaceLabel(i)}`,
                        metric: 0,
                    },
                };
            }
        }
        const gw = dev.host?.defaultGateway || dev.routing?.defaultGateway;
        if (!gw || !isValidIPv4(gw)) {
            return { ok: false, reason: `${dev.hostname} has no default gateway, so it cannot reach anything outside its own subnet` };
        }
        const gwIface = dev.interfaces.find(i => i.ipv4 && i.up && sameSubnet(i.ipv4, gw, i.mask));
        if (!gwIface) {
            return { ok: false, reason: `${dev.hostname} default gateway ${gw} is not inside any of its own subnets — check the mask` };
        }
        return {
            ok: true,
            decision: {
                iface: gwIface, nextHopIp: gw, direct: false, source: 'default',
                routeLabel: `0.0.0.0/0 via default gateway ${gw}`,
                metric: 1,
            },
        };
    }

    /* ─────────────── ACL + NAT ─────────────── */

    /** Record the forward direction of a flow so its reply is allowed back. */
    private noteSession(dev: Device, pdu: Pdu): void {
        if (roleOf(dev) !== 'firewall') return;
        if (!pdu.srcIp || !pdu.dstIp) return;
        const set = this.sessions.get(dev.id) || new Set<string>();
        set.add(sessionKey(pdu.protocol, pdu.srcIp, pdu.srcPort, pdu.dstIp, pdu.dstPort));
        if (set.size > 4000) set.clear();
        this.sessions.set(dev.id, set);
    }

    /** Is this packet the reply to a session this firewall already permitted? */
    private hasReverseSession(dev: Device, pdu: Pdu): boolean {
        if (roleOf(dev) !== 'firewall') return false;
        const set = this.sessions.get(dev.id);
        if (!set || !pdu.srcIp || !pdu.dstIp) return false;
        // The reply swaps source and destination.
        return set.has(sessionKey(pdu.protocol, pdu.dstIp, pdu.dstPort, pdu.srcIp, pdu.srcPort));
    }

    private aclCheck(dev: Device, aclName: string, pdu: Pdu, direction: 'in' | 'out'): { permit: boolean; ruleText?: string } {
        if (!aclName) return { permit: true };
        const acl = (dev.acls || []).find(a => a.name === aclName);
        if (!acl) return { permit: true };

        // Stateful inspection runs before the rule base: a firewall lets the
        // return traffic of an allowed session through without a matching rule.
        if (direction === 'in' && this.hasReverseSession(dev, pdu)) {
            return { permit: true, ruleText: 'stateful inspection — return traffic of an existing session' };
        }

        const proto = pdu.protocol.startsWith('ICMP') ? 'icmp'
            : pdu.protocol.startsWith('TCP') ? 'tcp'
            : pdu.protocol.startsWith('UDP') || pdu.protocol === 'DHCP' || pdu.protocol === 'DNS' ? 'udp'
            : 'ip';

        for (const rule of [...acl.rules].sort((a, b) => a.seq - b.seq)) {
            if (rule.protocol !== 'ip' && rule.protocol !== proto) continue;
            if (!rule.srcAny && !wildcardMatch(pdu.srcIp || '', rule.src, rule.srcWildcard)) continue;
            if (acl.type === 'extended' && !rule.dstAny && !wildcardMatch(pdu.dstIp || '', rule.dst, rule.dstWildcard)) continue;
            if (rule.dstPort && pdu.dstPort !== rule.dstPort) continue;
            rule.hits = (rule.hits || 0) + 1;
            const text = `${rule.seq} ${rule.action} ${rule.protocol} ${rule.srcAny ? 'any' : `${rule.src} ${rule.srcWildcard}`}${acl.type === 'extended' ? ` ${rule.dstAny ? 'any' : `${rule.dst} ${rule.dstWildcard}`}` : ''}${rule.dstPort ? ` eq ${rule.dstPort}` : ''}`;
            return { permit: rule.action === 'permit', ruleText: text };
        }
        // Implicit deny at the end of every ACL.
        return { permit: false, ruleText: `implicit deny any (every ACL ends with one — this is why a single permit line is never enough)` };
    }

    private natTranslate(dev: Device, outIface: NetInterface, pdu: Pdu): { pdu: Pdu; note?: string } {
        if (!dev.nat?.enabled) return { pdu };
        if (outIface.natRole !== 'outside') return { pdu };
        const srcIsInside = dev.interfaces.some(
            i => i.natRole === 'inside' && i.ipv4 && pdu.srcIp && sameSubnet(i.ipv4, pdu.srcIp, i.mask)
        ) || !!pdu.srcIp;
        if (!srcIsInside || !pdu.srcIp) return { pdu };

        const stat = dev.nat.staticMappings?.find(m => m.inside === pdu.srcIp);
        const globalIp = stat?.outside || dev.nat.outsideAddress || outIface.ipv4;
        if (!globalIp) return { pdu };

        // PAT only has a port to rewrite when the packet has one. ICMP does not,
        // so it is tracked by its identifier instead — modelled here as no port.
        const patPort = dev.nat.mode === 'pat' && pdu.srcPort !== undefined ? pdu.srcPort : undefined;
        const translated = applyNat(pdu, globalIp, patPort);

        const t: NatTranslation = {
            protocol: pdu.protocol.split(' ')[0].toLowerCase(),
            insideLocal: `${pdu.srcIp}${pdu.srcPort ? `:${pdu.srcPort}` : ''}`,
            insideGlobal: `${globalIp}${dev.nat.mode === 'pat' && patPort ? `:${patPort}` : ''}`,
            outsideLocal: `${pdu.dstIp}${pdu.dstPort ? `:${pdu.dstPort}` : ''}`,
            outsideGlobal: `${pdu.dstIp}${pdu.dstPort ? `:${pdu.dstPort}` : ''}`,
        };
        dev.nat.translations = [...(dev.nat.translations || []).filter(x => x.insideLocal !== t.insideLocal), t];

        return {
            pdu: translated,
            note: `NAT ${dev.nat.mode.toUpperCase()}: inside local ${t.insideLocal} → inside global ${t.insideGlobal}. The inside host never learns its public address; the return packet is translated back using this table entry.`,
        };
    }

    /* ══════════════════════════ ICMP: ping ══════════════════════════ */

    ping(srcDeviceId: string, target: string, opts: PingOptions = {}): PingResult {
        const count = opts.count ?? 4;
        const src = this.byId.get(srcDeviceId);
        const lines: string[] = [];

        if (!src) return { ok: false, sent: 0, received: 0, lossPct: 100, minMs: 0, avgMs: 0, maxMs: 0, reason: 'unknown source device', lines: ['% Unknown device'] };
        if (!src.powered) return { ok: false, sent: 0, received: 0, lossPct: 100, minMs: 0, avgMs: 0, maxMs: 0, reason: `${src.hostname} is powered off`, lines: [`% ${src.hostname} is powered off`] };

        // Resolve a hostname if needed.
        let dstIp = target.trim();
        if (!isValidIPv4(dstIp)) {
            const res = this.dnsResolve(srcDeviceId, dstIp, { quiet: opts.quiet });
            if (!res.ok) {
                lines.push(`Ping request could not find host ${target}. Please check the name and try again.`);
                if (!opts.quiet) this.emit('error', `${src.hostname} could not resolve ${target}`, { deviceId: src.id, deviceName: src.hostname, layer: 7, protocol: 'DNS', detail: res.reason });
                return { ok: false, sent: 0, received: 0, lossPct: 100, minMs: 0, avgMs: 0, maxMs: 0, reason: res.reason, lines };
            }
            dstIp = res.ip!;
            lines.push(`Resolved ${target} to ${dstIp} via DNS.`);
        }

        const forward = this.buildForwardTrace(src, dstIp, {
            protocol: 'ICMP',
            label: `Ping ${src.hostname} → ${dstIp}`,
            ttl: opts.ttl ?? 64,
            quiet: opts.quiet,
            makePdu: ({ srcMac, dstMac, srcIp, vlan, ttl, medium, speed }) =>
                buildIcmpEcho({ srcMac, dstMac, srcIp, dstIp, ttl, seq: 1, vlan, medium, speedMbps: speed }),
        });

        if (!opts.quiet) this.traces.push(forward);

        if (forward.status !== 'success') {
            lines.push(`Pinging ${dstIp} with 32 bytes of data:`);
            for (let i = 0; i < count; i++) lines.push(forward.reason?.includes('unreachable') ? `Reply from ${forward.hops[forward.hops.length - 1]?.pdu.srcIp || '?'}: Destination host unreachable.` : 'Request timed out.');
            lines.push('', `Ping statistics for ${dstIp}:`, `    Packets: Sent = ${count}, Received = 0, Lost = ${count} (100% loss),`);
            if (!opts.quiet) {
                this.emit('error', `Ping from ${src.hostname} to ${dstIp} failed`, {
                    deviceId: src.id, deviceName: src.hostname, layer: 3, protocol: 'ICMP',
                    detail: forward.reason, traceId: forward.id,
                });
            }
            return { ok: false, sent: count, received: 0, lossPct: 100, minMs: 0, avgMs: 0, maxMs: 0, reason: forward.reason, trace: forward, lines };
        }

        // The reply has to find its own way home — asymmetric routing shows up here.
        const dstOwner = this.findIpOwner(dstIp) || this.findCloud();
        let returnTrace: PacketTrace | undefined;
        if (dstOwner) {
            // Reply to the source address as the destination saw it. Behind NAT
            // that is the inside-global address, not the private one.
            const srcIp = forward.hops[forward.hops.length - 1]?.pdu.srcIp || forward.srcIp!;
            returnTrace = this.buildForwardTrace(dstOwner.device, srcIp, {
                protocol: 'ICMP',
                label: `Echo Reply ${dstOwner.device.hostname} → ${srcIp}`,
                ttl: opts.ttl ?? 64,
                quiet: true,
                // An echo reply is sourced from the address that was pinged.
                srcIpOverride: dstIp,
                makePdu: ({ srcMac, dstMac, srcIp: s, vlan, ttl, medium, speed }) =>
                    buildIcmpEcho({ srcMac, dstMac, srcIp: s, dstIp: srcIp, ttl, seq: 1, vlan, reply: true, medium, speedMbps: speed }),
            });
            if (!opts.quiet) this.traces.push(returnTrace);
        }

        if (returnTrace && returnTrace.status !== 'success') {
            lines.push(`Pinging ${dstIp} with 32 bytes of data:`);
            for (let i = 0; i < count; i++) lines.push('Request timed out.');
            lines.push('', `Ping statistics for ${dstIp}:`, `    Packets: Sent = ${count}, Received = 0, Lost = ${count} (100% loss),`);
            const blockedByPolicy = returnTrace.hops.some(h => h.action === 'acl-deny');
            const reason = blockedByPolicy
                ? `The echo request reached ${dstOwner!.device.hostname}, but the reply was denied on the way back: ${returnTrace.reason}. Ping needs BOTH directions, so a one-way ACL blocks it in both — that is usually the intended behaviour, not a fault.`
                : `The echo request arrived, but ${dstOwner!.device.hostname} cannot get a reply back to ${forward.srcIp}. Ping needs BOTH directions to work. ${returnTrace.reason || 'Check the return path — a default gateway or a route for ' + forward.srcIp + '.'}`;
            if (!opts.quiet) {
                this.emit('error', `Reply from ${dstIp} could not be routed back to ${src.hostname}`, {
                    deviceId: dstOwner!.device.id, deviceName: dstOwner!.device.hostname, layer: 3, protocol: 'ICMP',
                    detail: `${reason}\n${returnTrace.reason || ''}`, traceId: returnTrace.id,
                });
            }
            return { ok: false, sent: count, received: 0, lossPct: 100, minMs: 0, avgMs: 0, maxMs: 0, reason, trace: forward, returnTrace, lines };
        }

        const oneWay = forward.totalLatencyMs + (returnTrace?.totalLatencyMs || forward.totalLatencyMs);
        const rtts: number[] = [];
        lines.push(`Pinging ${dstIp} with 32 bytes of data:`);
        for (let i = 0; i < count; i++) {
            // First packet pays the ARP penalty, like the real thing.
            const jitter = (i === 0 ? 8 : 0) + Math.random() * 2;
            const rtt = Math.max(1, Math.round((oneWay + jitter) * 10) / 10);
            rtts.push(rtt);
            lines.push(`Reply from ${dstIp}: bytes=32 time=${rtt}ms TTL=${Math.max(1, (opts.ttl ?? 64) - forward.hops.filter(h => h.action === 'route').length)}`);
        }
        const min = Math.min(...rtts), max = Math.max(...rtts);
        const avg = Math.round((rtts.reduce((a, b) => a + b, 0) / rtts.length) * 10) / 10;
        lines.push('', `Ping statistics for ${dstIp}:`,
            `    Packets: Sent = ${count}, Received = ${count}, Lost = 0 (0% loss),`,
            'Approximate round trip times in milli-seconds:',
            `    Minimum = ${min}ms, Maximum = ${max}ms, Average = ${avg}ms`);

        if (!opts.quiet) {
            this.emit('success', `Ping ${src.hostname} → ${dstIp} succeeded (avg ${avg} ms, ${forward.hops.filter(h => h.action === 'route').length} router hops)`, {
                deviceId: src.id, deviceName: src.hostname, layer: 3, protocol: 'ICMP', traceId: forward.id,
                detail: `The echo request traversed ${forward.hops.length} devices. The destination IP never changed; the destination MAC was rewritten at every router.`,
            });
        }

        return { ok: true, sent: count, received: count, lossPct: 0, minMs: min, avgMs: avg, maxMs: max, trace: forward, returnTrace, lines };
    }

    /** Silent reachability probe used by services and lesson checks. */
    canReach(srcDeviceId: string, dstIp: string): boolean {
        const src = this.byId.get(srcDeviceId);
        if (!src) return false;
        const t = this.buildForwardTrace(src, dstIp, {
            protocol: 'ICMP', label: 'probe', ttl: 64, quiet: true,
            makePdu: ({ srcMac, dstMac, srcIp, vlan, ttl }) =>
                buildIcmpEcho({ srcMac, dstMac, srcIp, dstIp, ttl, seq: 1, vlan }),
        });
        return t.status === 'success';
    }

    /* ══════════════════════════ traceroute ══════════════════════════ */

    traceroute(srcDeviceId: string, target: string, maxTtl = 15): { ok: boolean; hops: TracerouteHopResult[]; lines: string[] } {
        const src = this.byId.get(srcDeviceId);
        const lines: string[] = [];
        if (!src) return { ok: false, hops: [], lines: ['% Unknown device'] };

        let dstIp = target.trim();
        if (!isValidIPv4(dstIp)) {
            const r = this.dnsResolve(srcDeviceId, dstIp, { quiet: true });
            if (!r.ok) return { ok: false, hops: [], lines: [`Unable to resolve target system name ${target}.`] };
            dstIp = r.ip!;
        }

        lines.push(`Tracing route to ${target} [${dstIp}] over a maximum of ${maxTtl} hops:`, '');

        const full = this.buildForwardTrace(src, dstIp, {
            protocol: 'ICMP', label: `Traceroute ${src.hostname} → ${dstIp}`, ttl: maxTtl, quiet: true,
            makePdu: ({ srcMac, dstMac, srcIp, vlan, ttl }) =>
                buildIcmpEcho({ srcMac, dstMac, srcIp, dstIp, ttl, seq: 1, vlan }),
        });

        // Each L3 device on the path answers one TTL value.
        const l3Hops = full.hops.filter(h => h.action === 'route' || h.action === 'nat');
        const out: TracerouteHopResult[] = [];
        let ttl = 1;
        let cumul = 0;

        for (const h of l3Hops) {
            cumul = h.cumulativeLatencyMs;
            const dev = this.byId.get(h.deviceId)!;
            const ip = dev.interfaces.find(i => i.id === h.inInterfaceId)?.ipv4 || dev.interfaces.find(i => i.ipv4)?.ipv4 || '*';
            const r = [1, 2, 3].map(() => Math.max(1, Math.round((cumul + Math.random() * 3) * 10) / 10));
            out.push({ ttl, deviceName: dev.hostname, ip, rttMs: r, reachedTarget: false, timedOut: false });
            lines.push(`  ${String(ttl).padStart(2)}    ${r.map(x => `${x} ms`).join('    ')}  ${dev.hostname} [${ip}]`);
            this.emit('icmp', `TTL ${ttl} expired at ${dev.hostname} → ICMP Time Exceeded returned`, {
                deviceId: dev.id, deviceName: dev.hostname, layer: 3, protocol: 'ICMP',
                detail: 'Traceroute sends packets with a deliberately small TTL. Each router that decrements the TTL to zero replies with ICMP Type 11 (Time Exceeded), and its source address is the router itself — which is how the path is discovered.',
            });
            ttl++;
        }

        if (full.status === 'success') {
            const dev = this.byId.get(full.hops[full.hops.length - 1].deviceId)!;
            const r = [1, 2, 3].map(() => Math.max(1, Math.round((full.totalLatencyMs + Math.random() * 3) * 10) / 10));
            out.push({ ttl, deviceName: dev.hostname, ip: dstIp, rttMs: r, reachedTarget: true, timedOut: false });
            lines.push(`  ${String(ttl).padStart(2)}    ${r.map(x => `${x} ms`).join('    ')}  ${dev.hostname} [${dstIp}]`, '', 'Trace complete.');
        } else {
            out.push({ ttl, deviceName: '*', ip: '*', rttMs: [], reachedTarget: false, timedOut: true });
            lines.push(`  ${String(ttl).padStart(2)}     *        *        *     Request timed out.`, '', `Trace incomplete: ${full.reason}`);
        }

        this.traces.push(full);
        return { ok: full.status === 'success', hops: out, lines };
    }

    /* ══════════════════════════ the forwarding walker ══════════════════════════ */

    private buildForwardTrace(
        src: Device,
        dstIp: string,
        o: {
            protocol: string;
            label: string;
            ttl: number;
            quiet?: boolean;
            srcPort?: number;
            dstPort?: number;
            /**
             * Force the source address in the IP header. An ICMP echo reply is
             * sourced from the address that was pinged, which is not necessarily
             * the address of the interface the reply happens to leave from.
             */
            srcIpOverride?: string;
            makePdu: (a: {
                srcMac: string; dstMac: string; srcIp: string; vlan?: number; ttl: number;
                medium: string; speed: number;
            }) => Pdu;
        }
    ): PacketTrace {
        const trace: PacketTrace = {
            id: uid('tr'),
            label: o.label,
            protocol: o.protocol,
            srcDeviceId: src.id,
            srcDeviceName: src.hostname,
            dstIp,
            hops: [],
            status: 'failed',
            totalLatencyMs: 0,
            startedAt: Date.now(),
        };

        const eg = this.findEgress(src, dstIp);
        if (!eg.ok) { trace.reason = eg.reason; return trace; }
        const d0 = eg.decision!;
        if (!d0.iface.ipv4) { trace.reason = `${src.hostname} ${ifaceLabel(d0.iface)} has no IP address`; return trace; }
        trace.srcIp = o.srcIpOverride || d0.iface.ipv4;

        let hopIndex = 0;
        let latency = 0;
        let currentDev = src;
        let currentIface = d0.iface;
        let nextHopIp = d0.nextHopIp;
        let inIfaceId: string | undefined;
        let pdu: Pdu | null = null;
        let ttl = o.ttl;
        let routeLabel = d0.routeLabel;
        let guard = 0;

        while (guard++ < 40) {
            const vlan = this.vlanForPort(currentIface);

            // ARP for the next hop inside this L2 domain.
            const arp = this.resolveArp(currentDev, currentIface, nextHopIp, { quiet: o.quiet });
            if (!arp) {
                const reason = `${currentDev.hostname} could not ARP for next hop ${nextHopIp} out of ${ifaceLabel(currentIface)}. Either nothing on that segment owns ${nextHopIp}, the VLAN does not match, the cable is missing, or spanning tree is blocking the only path.`;
                trace.reason = reason;
                trace.hops.push(this.makeHop(hopIndex++, currentDev, {
                    inIfaceId, outIfaceId: currentIface.id, action: 'drop',
                    pdu: pdu || buildArpRequest({ senderMac: currentIface.mac, senderIp: currentIface.ipv4!, targetIp: nextHopIp, vlan }),
                    notes: [reason], latency, ok: false,
                }));
                return trace;
            }

            // Build (first hop) or rewrite (subsequent hops) the frame.
            if (!pdu) {
                pdu = o.makePdu({
                    srcMac: currentIface.mac, dstMac: arp.mac, srcIp: trace.srcIp!,
                    vlan: currentIface.mode === 'trunk' ? vlan : undefined, ttl,
                    medium: currentIface.medium, speed: currentIface.speedMbps,
                });
                trace.hops.push(this.makeHop(hopIndex++, currentDev, {
                    inIfaceId: undefined, outIfaceId: currentIface.id, action: 'originate',
                    pdu, latency, ok: true,
                    notes: [
                        `${currentDev.hostname} builds the packet: destination IP ${dstIp} (final target), destination MAC ${arp.mac} (${d0.direct ? 'the target itself — same subnet' : 'the default gateway — different subnet'}).`,
                        `Route used: ${routeLabel}`,
                        d0.direct
                            ? `${dstIp} is inside ${networkAddress(currentIface.ipv4!, currentIface.mask)}/${maskToPrefix(currentIface.mask)}, so the host ARPs for it directly.`
                            : `${dstIp} is outside the local subnet, so the frame is addressed to the gateway MAC while the IP header still targets ${dstIp}. This is the single most important idea in routing.`,
                    ],
                }));
                currentIface.counters!.txFrames++;
                currentIface.counters!.txBytes += pdu.sizeBytes;
            }

            // ACL outbound on the egress interface.
            if (currentIface.aclOut) {
                const chk = this.aclCheck(currentDev, currentIface.aclOut, pdu, 'out');
                if (!chk.permit) {
                    const reason = `ACL ${currentIface.aclOut} applied outbound on ${currentDev.hostname} ${ifaceLabel(currentIface)} denied the packet (matched: ${chk.ruleText}).`;
                    trace.reason = reason;
                    trace.hops.push(this.makeHop(hopIndex++, currentDev, { inIfaceId, outIfaceId: currentIface.id, action: 'acl-deny', pdu, notes: [reason], latency, ok: false }));
                    if (!o.quiet) this.emit('acl', reason, { deviceId: currentDev.id, deviceName: currentDev.hostname, layer: 3, protocol: 'ACL', traceId: trace.id });
                    return trace;
                }
            }

            // NAT on the way out.
            const nat = this.natTranslate(currentDev, currentIface, pdu);
            if (nat.note) {
                pdu = nat.pdu;
                trace.hops.push(this.makeHop(hopIndex++, currentDev, {
                    inIfaceId, outIfaceId: currentIface.id, action: 'nat', pdu, notes: [nat.note], latency, ok: true,
                }));
                if (!o.quiet) this.emit('nat', `${currentDev.hostname} translated ${nat.pdu.srcIp} (NAT ${currentDev.nat!.mode.toUpperCase()})`, { deviceId: currentDev.id, deviceName: currentDev.hostname, layer: 3, protocol: 'NAT', traceId: trace.id, detail: nat.note });
            }

            // Open the session AFTER any translation, so the firewall recognises
            // the reply by the addresses that actually go on the wire.
            this.noteSession(currentDev, pdu);

            // Walk the Layer-2 fabric to the next hop's interface.
            const l2 = this.findL2Path(currentDev, currentIface, arp.device, arp.iface, vlan);
            if (!l2.ok) {
                trace.reason = `Frame could not cross the Layer-2 network: ${l2.reason}`;
                trace.hops.push(this.makeHop(hopIndex++, currentDev, { inIfaceId, outIfaceId: currentIface.id, action: 'drop', pdu, notes: [trace.reason], latency, ok: false }));
                return trace;
            }

            for (const step of l2.steps) {
                const sw = this.byId.get(step.deviceId)!;
                const outIf = this.ifaceById.get(step.outIfaceId)!;
                latency += 0.05;
                const role = roleOf(sw);
                const known = sw.macTable?.some(e => e.mac === pdu!.dstMac && e.vlan === step.vlanIn);
                const notes: string[] = [];

                if (role === 'hub' || role === 'repeater') {
                    notes.push(`${sw.hostname} is a Layer-1 device: it repeats the bits out of every other port. Every attached host has to process the frame and discard it — one collision domain, wasted bandwidth.`);
                } else if (outIf.medium === 'wireless' || this.ifaceById.get(step.inIfaceId)!.medium === 'wireless') {
                    notes.push(`${sw.hostname} bridges between 802.11 and 802.3: the radio header is stripped and an Ethernet header is put on (or the reverse). The IP packet inside is untouched.`);
                } else {
                    notes.push(known
                        ? `${sw.hostname} found ${pdu!.dstMac} in its MAC table for VLAN ${step.vlanIn} and forwarded the frame out ${ifaceLabel(outIf)} only.`
                        : `${sw.hostname} had no entry for ${pdu!.dstMac} in VLAN ${step.vlanIn}, so it flooded the frame to every other port in that VLAN. The reply teaches it the port and the next frame is unicast.`);
                }
                if (step.taggedOut) notes.push(`Leaving on a trunk → an 802.1Q tag for VLAN ${step.vlanOut} is inserted (4 bytes).`);
                else if (outIf.mode === 'access') notes.push(`Leaving on an access port → the 802.1Q tag is removed, because the host must never see a tag.`);

                const framed = step.taggedOut ? rewriteEthernet(pdu!, pdu!.srcMac, pdu!.dstMac, step.vlanOut) : rewriteEthernet(pdu!, pdu!.srcMac, pdu!.dstMac, undefined);
                trace.hops.push(this.makeHop(hopIndex++, sw, {
                    inIfaceId: step.inIfaceId, outIfaceId: step.outIfaceId, linkId: step.linkId,
                    action: known ? step.action : (step.action === 'forward-l2' ? 'flood' : step.action),
                    pdu: framed, notes, latency, ok: true,
                }));
                if (!o.quiet) {
                    this.emit(known ? 'tx' : 'info', `${sw.hostname}: ${known ? 'forwarded' : 'flooded'} frame ${pdu!.srcMac} → ${pdu!.dstMac} (VLAN ${step.vlanIn})`, {
                        deviceId: sw.id, deviceName: sw.hostname, layer: 2, protocol: 'Ethernet', traceId: trace.id, detail: notes.join('\n'),
                    });
                }
            }
            latency += l2.latencyMs;

            // Arrived at the next hop device.
            const arrived = arp.device;
            const arrivedIface = this.ifaceById.get(l2.dstIfaceId!) || arp.iface;
            arrivedIface.counters!.rxFrames++;
            arrivedIface.counters!.rxBytes += pdu.sizeBytes;

            // Inbound ACL.
            if (arrivedIface.aclIn) {
                const chk = this.aclCheck(arrived, arrivedIface.aclIn, pdu, 'in');
                if (!chk.permit) {
                    const reason = `ACL ${arrivedIface.aclIn} applied inbound on ${arrived.hostname} ${ifaceLabel(arrivedIface)} denied the packet (matched: ${chk.ruleText}).`;
                    trace.reason = reason;
                    trace.hops.push(this.makeHop(hopIndex++, arrived, { inIfaceId: arrivedIface.id, action: 'acl-deny', pdu, notes: [reason, 'An inbound ACL is evaluated before the routing decision — the packet never even gets looked up.'], latency, ok: false }));
                    if (!o.quiet) this.emit('acl', reason, { deviceId: arrived.id, deviceName: arrived.hostname, layer: 3, protocol: 'ACL', traceId: trace.id });
                    return trace;
                }
            }

            const arrivedRole = roleOf(arrived);
            const isFinal =
                arrivedIface.ipv4 === dstIp ||
                arrived.interfaces.some(i => i.ipv4 === dstIp) ||
                (arrivedRole === 'cloud' && !this.findIpOwner(dstIp));

            if (isFinal) {
                trace.dstDeviceId = arrived.id;
                trace.dstDeviceName = arrived.hostname;
                trace.status = 'success';
                trace.totalLatencyMs = Math.round(latency * 10) / 10;
                trace.hops.push(this.makeHop(hopIndex++, arrived, {
                    inIfaceId: arrivedIface.id, action: 'deliver', pdu, latency, ok: true,
                    notes: [
                        `${arrived.hostname} sees its own MAC in the destination field, strips the Ethernet header, sees its own IP in the destination field, strips the IP header, and hands the payload up the stack.`,
                        arrivedRole === 'cloud'
                            ? 'The cloud stands in for the Internet — it answers any address that is not owned by a device in this topology.'
                            : `De-encapsulation is just encapsulation in reverse: L1 → L2 → L3 → L4 → L7.`,
                    ],
                }));
                if (!o.quiet) {
                    this.emit('rx', `${arrived.hostname} received ${o.protocol} from ${trace.srcIp}`, {
                        deviceId: arrived.id, deviceName: arrived.hostname, layer: 7, protocol: o.protocol, traceId: trace.id,
                    });
                }
                return trace;
            }

            if (!isL3Forwarder(arrivedRole)) {
                trace.reason = `${arrived.hostname} received the frame but is not a router, and ${dstIp} is not one of its addresses — the packet is discarded. A host never forwards traffic that is not addressed to it.`;
                trace.hops.push(this.makeHop(hopIndex++, arrived, { inIfaceId: arrivedIface.id, action: 'drop', pdu, notes: [trace.reason], latency, ok: false }));
                return trace;
            }

            // Router: decrement TTL, then route.
            ttl -= 1;
            if (ttl <= 0) {
                trace.reason = `TTL reached zero at ${arrived.hostname}. It returns ICMP Time Exceeded (type 11) to ${trace.srcIp}. A TTL of ${o.ttl} was not enough — or you have a routing loop.`;
                trace.hops.push(this.makeHop(hopIndex++, arrived, {
                    inIfaceId: arrivedIface.id, action: 'ttl-expired',
                    pdu: buildPdu({ srcMac: arrivedIface.mac, dstMac: pdu.srcMac, srcIp: arrivedIface.ipv4 || '', dstIp: trace.srcIp!, ttl: 255, protocol: 'ICMP Time Exceeded', upper: [icmpLayer({ type: 11, code: 0 })] }),
                    notes: [trace.reason], latency, ok: false,
                }));
                if (!o.quiet) this.emit('icmp', `TTL expired at ${arrived.hostname}`, { deviceId: arrived.id, deviceName: arrived.hostname, layer: 3, protocol: 'ICMP', traceId: trace.id, detail: trace.reason });
                return trace;
            }

            const next = this.findEgress(arrived, dstIp);
            if (!next.ok) {
                trace.reason = next.reason;
                trace.hops.push(this.makeHop(hopIndex++, arrived, {
                    inIfaceId: arrivedIface.id, action: 'drop', pdu,
                    notes: [next.reason!, 'A router with no matching route drops the packet and returns ICMP Destination Unreachable (type 3, code 0). Add a static route or a default route.'],
                    latency, ok: false,
                }));
                if (!o.quiet) this.emit('drop', `${arrived.hostname}: no route to ${dstIp}`, { deviceId: arrived.id, deviceName: arrived.hostname, layer: 3, protocol: 'IPv4', traceId: trace.id, detail: next.reason });
                return trace;
            }

            const nd = next.decision!;
            const nextArp = this.resolveArp(arrived, nd.iface, nd.nextHopIp, { quiet: o.quiet });
            const decremented = decrementTtl(pdu);
            const rewritten = rewriteEthernet(
                decremented,
                nd.iface.mac,
                nextArp?.mac || BROADCAST_MAC,
                nd.iface.mode === 'trunk' ? this.vlanForPort(nd.iface) : undefined
            );

            trace.hops.push(this.makeHop(hopIndex++, arrived, {
                inIfaceId: arrivedIface.id, outIfaceId: nd.iface.id, action: 'route', pdu: rewritten,
                notes: [
                    `${arrived.hostname} strips the Ethernet header, looks up ${dstIp} in its routing table and matches: ${nd.routeLabel}.`,
                    `TTL ${pdu.ttl} → ${rewritten.ttl}, so the IPv4 header checksum is recalculated.`,
                    `A brand-new Ethernet header is built: source ${nd.iface.mac} (this router's egress port), destination ${nextArp?.mac || '(unresolved)'} (${nd.direct ? 'the final host' : `next-hop router ${nd.nextHopIp}`}). The IP addresses are untouched.`,
                ],
                latency, ok: true,
            }));
            if (!o.quiet) {
                this.emit('route', `${arrived.hostname} routed ${dstIp} out ${ifaceLabel(nd.iface)} (${nd.routeLabel})`, {
                    deviceId: arrived.id, deviceName: arrived.hostname, layer: 3, protocol: 'IPv4', traceId: trace.id,
                    detail: `Longest-prefix match selected this route. Administrative distance decides between protocols offering the same prefix.`,
                });
            }

            pdu = rewritten;
            ttl = rewritten.ttl ?? ttl;
            inIfaceId = arrivedIface.id;
            currentDev = arrived;
            currentIface = nd.iface;
            nextHopIp = nd.nextHopIp;
            routeLabel = nd.routeLabel;
        }

        trace.reason = 'Forwarding loop detected — the packet passed through more than 40 devices. Check for a routing loop or a redundant path with spanning tree disabled.';
        return trace;
    }

    private makeHop(
        index: number,
        dev: Device,
        o: {
            inIfaceId?: string; outIfaceId?: string; linkId?: string;
            action: HopAction; pdu: Pdu; notes?: string[]; latency: number; ok: boolean;
        }
    ): Hop {
        const inIf = o.inIfaceId ? this.ifaceById.get(o.inIfaceId) : undefined;
        const outIf = o.outIfaceId ? this.ifaceById.get(o.outIfaceId) : undefined;
        return {
            index,
            deviceId: dev.id,
            deviceName: dev.hostname,
            deviceRole: roleOf(dev),
            inInterfaceId: o.inIfaceId,
            inInterfaceName: inIf ? ifaceLabel(inIf) : undefined,
            outInterfaceId: o.outIfaceId,
            outInterfaceName: outIf ? ifaceLabel(outIf) : undefined,
            linkId: o.linkId,
            action: o.action,
            pdu: o.pdu,
            layersTouched: layersOf(o.pdu),
            notes: o.notes || [],
            cumulativeLatencyMs: Math.round(o.latency * 10) / 10,
            ok: o.ok,
        };
    }

    /* ══════════════════════════ DHCP ══════════════════════════ */

    dhcpRequest(deviceId: string): { ok: boolean; ip?: string; reason?: string; trace?: PacketTrace; lines: string[] } {
        const client = this.byId.get(deviceId);
        const lines: string[] = [];
        if (!client) return { ok: false, reason: 'unknown device', lines: ['% Unknown device'] };

        const cif = client.interfaces.find(i => i.dhcp && i.enabled && i.up)
            || client.interfaces.find(i => i.enabled && i.up);
        if (!cif) return { ok: false, reason: `${client.hostname} has no interface that is up`, lines: [`% No interface is up on ${client.hostname}`] };

        lines.push(`DHCP: Broadcasting DHCPDISCOVER from ${cif.mac} on ${ifaceLabel(cif)}...`);
        this.emit('dhcp', `${client.hostname} broadcast DHCP Discover`, {
            deviceId: client.id, deviceName: client.hostname, layer: 7, protocol: 'DHCP',
            detail: 'DHCP Discover is sent from 0.0.0.0 to 255.255.255.255 — the client has no address yet, so it cannot unicast. Because it is a broadcast, it never leaves the VLAN unless a relay (ip helper-address) forwards it.',
        });

        const vlan = this.vlanForPort(cif);
        // Any reachable DHCP server in this broadcast domain, or a relay-capable router.
        const candidates: Array<{ dev: Device; iface: NetInterface; pool: any; relay?: Device }> = [];

        for (const d of this.topology.devices) {
            if (!d.powered || !d.services?.dhcp?.enabled) continue;
            for (const pool of d.services.dhcp.pools || []) {
                const serverIface = d.interfaces.find(i => i.ipv4 && i.up && sameSubnet(i.ipv4, pool.rangeStart, pool.mask))
                    || d.interfaces.find(i => i.ipv4 && i.up);
                if (!serverIface) continue;
                const path = this.findL2Path(client, cif, d, serverIface, vlan);
                if (path.ok) candidates.push({ dev: d, iface: serverIface, pool });
            }
        }

        // Relay: a router in this VLAN with its own pool for this subnet.
        if (!candidates.length) {
            for (const d of this.topology.devices) {
                if (!d.powered || !isL3Forwarder(roleOf(d))) continue;
                for (const i of d.interfaces) {
                    if (!i.ipv4 || !i.up) continue;
                    const p = this.findL2Path(client, cif, d, i, vlan);
                    if (!p.ok) continue;
                    const pool = (d.services?.dhcp?.pools || []).find(pl => sameSubnet(i.ipv4, pl.rangeStart, pl.mask));
                    if (pool && d.services?.dhcp?.enabled) candidates.push({ dev: d, iface: i, pool });
                }
            }
        }

        if (!candidates.length) {
            const apipa = `169.254.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
            cif.ipv4 = apipa;
            cif.mask = '255.255.0.0';
            lines.push('DHCP: No DHCPOFFER received after 4 attempts.',
                `DHCP: Falling back to link-local autoconfiguration: ${apipa}/16 (APIPA).`,
                'Diagnosis: a 169.254.x.x address means the DHCP Discover was never answered. Check that a DHCP server exists in this VLAN, or that the router has "ip helper-address" pointing at a remote server.');
            this.emit('error', `${client.hostname} got no DHCP offer — self-assigned ${apipa} (APIPA)`, {
                deviceId: client.id, deviceName: client.hostname, layer: 7, protocol: 'DHCP',
                detail: 'APIPA (169.254.0.0/16) is the client giving up. It can still talk to other APIPA hosts on the same wire, and nothing else.',
            });
            return { ok: false, reason: 'no DHCP server reachable in this broadcast domain', lines };
        }

        const chosen = candidates[0];
        const pool = chosen.pool;
        const taken = new Set<string>([
            ...(chosen.dev.services!.dhcp.leases || []).map(l => l.ip),
            ...(pool.excluded || []),
            ...this.topology.devices.flatMap(d => d.interfaces.map(i => i.ipv4).filter(Boolean) as string[]),
        ]);

        let offered = '';
        const start = ipToLong(pool.rangeStart), end = ipToLong(pool.rangeEnd);
        for (let n = start; n <= end; n++) {
            const cand = longToIp(n);
            if (!taken.has(cand)) { offered = cand; break; }
        }
        if (!offered) {
            lines.push(`DHCP: Server ${chosen.dev.hostname} replied DHCPNAK — the pool ${pool.name} is exhausted.`);
            this.emit('error', `DHCP pool "${pool.name}" on ${chosen.dev.hostname} is exhausted`, {
                deviceId: chosen.dev.id, deviceName: chosen.dev.hostname, layer: 7, protocol: 'DHCP',
                detail: 'Either widen the range, shorten the lease time, or find the device that is consuming addresses.',
            });
            return { ok: false, reason: 'DHCP pool exhausted', lines };
        }

        // Build a 4-message trace.
        const trace: PacketTrace = {
            id: uid('tr'), label: `DHCP DORA — ${client.hostname}`, protocol: 'DHCP',
            srcDeviceId: client.id, srcDeviceName: client.hostname,
            dstDeviceId: chosen.dev.id, dstDeviceName: chosen.dev.hostname,
            srcIp: '0.0.0.0', dstIp: '255.255.255.255',
            hops: [], status: 'success', totalLatencyMs: 4, startedAt: Date.now(),
        };

        const xid = `0x${Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')}`;
        const mk = (
            type: 'Discover' | 'Offer' | 'Request' | 'Ack',
            fromIf: NetInterface,
            srcIp: string, dstIp: string, dstMac: string
        ) => buildUdpDatagram({
            srcMac: fromIf.mac, dstMac, srcIp, dstIp,
            srcPort: type === 'Offer' || type === 'Ack' ? 67 : 68,
            dstPort: type === 'Offer' || type === 'Ack' ? 68 : 67,
            label: `DHCP ${type}`,
            app: [dhcpLayer({
                messageType: type, clientMac: cif.mac, transactionId: xid,
                offeredIp: type === 'Offer' || type === 'Ack' || type === 'Request' ? offered : undefined,
                mask: type === 'Offer' || type === 'Ack' ? pool.mask : undefined,
                gateway: type === 'Offer' || type === 'Ack' ? pool.gateway : undefined,
                dns: type === 'Offer' || type === 'Ack' ? pool.dnsServer : undefined,
                leaseHours: type === 'Offer' || type === 'Ack' ? pool.leaseHours : undefined,
                serverIp: type === 'Offer' || type === 'Ack' ? chosen.iface.ipv4 : undefined,
            })],
            medium: fromIf.medium, speedMbps: fromIf.speedMbps,
        });

        const explain: Record<string, string> = {
            Discover: 'Broadcast. "Is there a DHCP server out there?" Source 0.0.0.0 because the client has no address; destination 255.255.255.255 because it does not know who to ask.',
            Offer: 'Unicast (or broadcast) back to the client MAC. Carries the proposed address plus options 1 (mask), 3 (router), 6 (DNS) and 51 (lease).',
            Request: 'Broadcast again — the client formally asks for the offered address. Broadcasting tells any OTHER servers that offered that their offer was declined.',
            Ack: 'The server commits the lease and records it. Only now may the client use the address.',
        };

        (['Discover', 'Offer', 'Request', 'Ack'] as const).forEach((t, i) => {
            const clientToServer = t === 'Discover' || t === 'Request';
            const from = clientToServer ? client : chosen.dev;
            const fromIf = clientToServer ? cif : chosen.iface;
            const to = clientToServer ? chosen.dev : client;
            const pdu = mk(
                t, fromIf,
                clientToServer ? '0.0.0.0' : (chosen.iface.ipv4 || '0.0.0.0'),
                clientToServer ? '255.255.255.255' : (t === 'Offer' ? '255.255.255.255' : offered),
                clientToServer ? BROADCAST_MAC : cif.mac
            );
            trace.hops.push(this.makeHop(i, from, {
                outIfaceId: fromIf.id, action: clientToServer ? 'originate' : 'reply',
                pdu, latency: i + 1, ok: true, notes: [explain[t]],
            }));
            this.emit('dhcp', `DHCP ${t}: ${from.hostname} → ${to.hostname}${t === 'Ack' ? ` (${offered})` : ''}`, {
                deviceId: from.id, deviceName: from.hostname, layer: 7, protocol: 'DHCP',
                traceId: trace.id, detail: explain[t],
            });
            lines.push(`DHCP: ${t.toUpperCase()}${clientToServer ? ' →' : ' ←'} ${clientToServer ? chosen.dev.hostname : chosen.dev.hostname}`);
        });

        // Commit the lease.
        cif.ipv4 = offered;
        cif.mask = pool.mask;
        cif.dhcp = true;
        client.host = client.host || { dhcp: true, defaultGateway: '', dnsServer: '' };
        client.host.dhcp = true;
        if (pool.gateway) client.host.defaultGateway = pool.gateway;
        if (pool.dnsServer) client.host.dnsServer = pool.dnsServer;
        if (isL3Forwarder(roleOf(client)) && client.routing) client.routing.defaultGateway = pool.gateway;

        const lease: DhcpLease = { mac: cif.mac, ip: offered, hostname: client.hostname, poolId: pool.id, expiresIn: pool.leaseHours * 3600 };
        chosen.dev.services!.dhcp.leases = [
            ...(chosen.dev.services!.dhcp.leases || []).filter(l => l.mac !== cif.mac),
            lease,
        ];

        lines.push('',
            `Interface ${ifaceLabel(cif)} configured by DHCP:`,
            `   IPv4 address . . . . : ${offered}`,
            `   Subnet mask  . . . . : ${pool.mask}`,
            `   Default gateway  . . : ${pool.gateway || '(none supplied)'}`,
            `   DNS server . . . . . : ${pool.dnsServer || '(none supplied)'}`,
            `   Lease . . . . . . . .: ${pool.leaseHours} hours from ${chosen.dev.hostname}`);

        this.recompute();
        this.traces.push(trace);
        this.emit('success', `${client.hostname} leased ${offered}/${maskToPrefix(pool.mask)} from ${chosen.dev.hostname}`, {
            deviceId: client.id, deviceName: client.hostname, layer: 7, protocol: 'DHCP', traceId: trace.id,
        });

        return { ok: true, ip: offered, trace, lines };
    }

    /* ══════════════════════════ DNS ══════════════════════════ */

    dnsResolve(deviceId: string, name: string, opts: { quiet?: boolean } = {}): { ok: boolean; ip?: string; reason?: string; server?: string; lines: string[] } {
        const client = this.byId.get(deviceId);
        const lines: string[] = [];
        const clean = name.trim().replace(/^https?:\/\//, '').split('/')[0];
        if (!client) return { ok: false, reason: 'unknown device', lines };

        const resolverIp = client.host?.dnsServer || client.routing?.defaultGateway || '';
        const servers = this.topology.devices.filter(d => d.powered && d.services?.dns?.enabled);

        // Preferred: the configured resolver, if it is actually a DNS server and reachable.
        let server: Device | undefined;
        if (resolverIp) {
            const owner = this.findIpOwner(resolverIp);
            if (owner && owner.device.services?.dns?.enabled && this.canReach(client.id, resolverIp)) server = owner.device;
        }
        if (!server) server = servers.find(s => s.interfaces.some(i => i.ipv4 && this.canReach(client.id, i.ipv4)));

        if (!server) {
            const reason = resolverIp
                ? `${client.hostname} has DNS server ${resolverIp} configured but cannot reach it (or that host is not running DNS).`
                : `${client.hostname} has no DNS server configured. Set one manually or hand one out with DHCP option 6.`;
            if (!opts.quiet) this.emit('error', `DNS lookup for ${clean} failed on ${client.hostname}`, { deviceId: client.id, deviceName: client.hostname, layer: 7, protocol: 'DNS', detail: reason });
            lines.push(`*** Can't find ${clean}: ${resolverIp ? 'No response from server' : 'No DNS servers configured'}`);
            return { ok: false, reason, lines };
        }

        const serverIp = server.interfaces.find(i => i.ipv4 && this.canReach(client.id, i.ipv4))?.ipv4 || '';
        const record = (server.services!.dns.records || []).find(
            r => r.name.toLowerCase() === clean.toLowerCase() && (r.type === 'A' || r.type === 'CNAME')
        );

        // Fall back to hostname → first address, so labs "just work".
        let ip = record?.value;
        if (record?.type === 'CNAME') {
            const target = (server.services!.dns.records || []).find(r => r.name.toLowerCase() === record.value.toLowerCase() && r.type === 'A');
            ip = target?.value;
        }
        if (!ip) {
            const byHostname = this.topology.devices.find(d => d.hostname.toLowerCase() === clean.toLowerCase());
            ip = byHostname?.interfaces.find(i => i.ipv4)?.ipv4;
        }

        if (!ip) {
            const reason = `${server.hostname} has no A record for ${clean}. Add one in the server's DNS service tab.`;
            if (!opts.quiet) this.emit('dns', `${server.hostname}: NXDOMAIN for ${clean}`, { deviceId: server.id, deviceName: server.hostname, layer: 7, protocol: 'DNS', detail: reason });
            lines.push(`Server:  ${server.hostname}`, `Address: ${serverIp}`, '', `*** ${server.hostname} can't find ${clean}: NXDOMAIN`);
            return { ok: false, reason, server: serverIp, lines };
        }

        if (!opts.quiet) {
            const trace: PacketTrace = {
                id: uid('tr'), label: `DNS ${clean}`, protocol: 'DNS',
                srcDeviceId: client.id, srcDeviceName: client.hostname,
                dstDeviceId: server.id, dstDeviceName: server.hostname,
                srcIp: client.interfaces.find(i => i.ipv4)?.ipv4, dstIp: serverIp,
                hops: [], status: 'success', totalLatencyMs: 2, startedAt: Date.now(),
            };
            const cif = client.interfaces.find(i => i.ipv4)!;
            const sif = server.interfaces.find(i => i.ipv4 === serverIp)!;
            const q = buildUdpDatagram({
                srcMac: cif.mac, dstMac: sif.mac, srcIp: cif.ipv4!, dstIp: serverIp,
                srcPort: randomEphemeralPort(), dstPort: 53, label: 'DNS Query',
                app: [dnsLayer({ kind: 'query', name: clean })],
            });
            const a = buildUdpDatagram({
                srcMac: sif.mac, dstMac: cif.mac, srcIp: serverIp, dstIp: cif.ipv4!,
                srcPort: 53, dstPort: q.srcPort!, label: 'DNS Response',
                app: [dnsLayer({ kind: 'response', name: clean, answer: ip, ttl: record?.ttl ?? 300, authoritative: true })],
            });
            trace.hops.push(this.makeHop(0, client, { outIfaceId: cif.id, action: 'originate', pdu: q, latency: 0.5, ok: true, notes: ['A DNS query is a small UDP datagram to port 53. UDP is used because one packet out, one packet back is cheaper than a TCP handshake.'] }));
            trace.hops.push(this.makeHop(1, server, { inIfaceId: sif.id, action: 'reply', pdu: a, latency: 2, ok: true, notes: [`${server.hostname} is authoritative for this record and answers ${clean} = ${ip} with a TTL of ${record?.ttl ?? 300}s. The client caches it for that long.`] }));
            this.traces.push(trace);
            this.emit('dns', `${client.hostname} resolved ${clean} → ${ip} (via ${server.hostname})`, {
                deviceId: client.id, deviceName: client.hostname, layer: 7, protocol: 'DNS', traceId: trace.id,
                detail: 'Name resolution happens BEFORE any connection is attempted. If DNS fails nothing else even starts — which is why "it works by IP but not by name" always points here.',
            });
        }

        lines.push(`Server:  ${server.hostname}`, `Address: ${serverIp}`, '', `Name:    ${clean}`, `Address: ${ip}`);
        return { ok: true, ip, server: serverIp, lines };
    }

    /* ══════════════════════════ HTTP (with TCP handshake) ══════════════════════════ */

    httpGet(deviceId: string, target: string): { ok: boolean; status?: number; body?: string; reason?: string; trace?: PacketTrace; lines: string[] } {
        const client = this.byId.get(deviceId);
        const lines: string[] = [];
        if (!client) return { ok: false, reason: 'unknown device', lines };

        const raw = target.trim();
        const tls = raw.startsWith('https://');
        const hostPart = raw.replace(/^https?:\/\//, '').split('/')[0];
        const path = '/' + raw.replace(/^https?:\/\//, '').split('/').slice(1).join('/');

        let dstIp = hostPart;
        if (!isValidIPv4(hostPart)) {
            const r = this.dnsResolve(deviceId, hostPart);
            if (!r.ok) { lines.push(`Could not resolve host: ${hostPart}`, r.reason || ''); return { ok: false, reason: r.reason, lines }; }
            dstIp = r.ip!;
        }

        const owner = this.findIpOwner(dstIp);
        if (!owner) { lines.push(`No device in this topology owns ${dstIp}.`); return { ok: false, reason: `no host owns ${dstIp}`, lines }; }
        const server = owner.device;
        const http = server.services?.http;
        const port = tls ? 443 : (http?.port || 80);

        if (!http?.enabled) {
            lines.push(`Connecting to ${dstIp}:${port}... failed.`,
                `TCP RST received: nothing is listening on port ${port} at ${server.hostname}.`);
            this.emit('error', `${client.hostname} → ${server.hostname}:${port} refused (no listener)`, {
                deviceId: server.id, deviceName: server.hostname, layer: 4, protocol: 'TCP',
                detail: 'A closed port answers with TCP RST straight away — that is "connection refused". A firewall that DROPs instead gives you a timeout. Learning to tell those two apart is a core troubleshooting skill.',
            });
            return { ok: false, reason: `HTTP service is disabled on ${server.hostname}`, lines };
        }

        // Reachability first — reuse the full forwarding walker for the SYN.
        const sport = randomEphemeralPort();
        let isn = Math.floor(Math.random() * 100000) + 1000;

        const synTrace = this.buildForwardTrace(client, dstIp, {
            protocol: 'TCP', label: `TCP SYN ${client.hostname} → ${dstIp}:${port}`, ttl: 64,
            srcPort: sport, dstPort: port,
            makePdu: ({ srcMac, dstMac, srcIp, vlan, ttl, medium, speed }) =>
                buildTcpSegment({
                    srcMac, dstMac, srcIp, dstIp, srcPort: sport, dstPort: port,
                    flags: ['SYN'], seq: isn, ack: 0, vlan, ttl, mss: 1460, medium, speedMbps: speed,
                }),
        });
        this.traces.push(synTrace);

        if (synTrace.status !== 'success') {
            lines.push(`Connecting to ${hostPart} (${dstIp}):${port}...`, 'Connection timed out.', '', synTrace.reason || '');
            this.emit('error', `HTTP request from ${client.hostname} failed before the handshake`, {
                deviceId: client.id, deviceName: client.hostname, layer: 4, protocol: 'TCP', traceId: synTrace.id, detail: synTrace.reason,
            });
            return { ok: false, reason: synTrace.reason, trace: synTrace, lines };
        }

        const cif = this.ifaceById.get(synTrace.hops[0].outInterfaceId!)!;
        const sif = owner.iface;
        const rtt = Math.round(synTrace.totalLatencyMs * 2 * 10) / 10;

        const trace: PacketTrace = {
            id: uid('tr'), label: `${tls ? 'HTTPS' : 'HTTP'} GET ${hostPart}${path}`, protocol: tls ? 'HTTPS' : 'HTTP',
            srcDeviceId: client.id, srcDeviceName: client.hostname,
            dstDeviceId: server.id, dstDeviceName: server.hostname,
            srcIp: cif.ipv4, dstIp, hops: [], status: 'success',
            totalLatencyMs: rtt * (tls ? 3 : 2), startedAt: Date.now(),
        };

        const srvIsn = Math.floor(Math.random() * 100000) + 5000;
        let step = 0;
        const addHop = (dev: Device, ifaceId: string, action: HopAction, pdu: Pdu, notes: string[], lat: number) => {
            trace.hops.push(this.makeHop(step++, dev, { outIfaceId: ifaceId, action, pdu, notes, latency: lat, ok: true }));
        };

        const seg = (from: 'c' | 's', flags: string[], seq: number, ack: number, app?: any[]) =>
            buildTcpSegment({
                srcMac: from === 'c' ? cif.mac : sif.mac,
                dstMac: from === 'c' ? sif.mac : cif.mac,
                srcIp: from === 'c' ? cif.ipv4! : dstIp,
                dstIp: from === 'c' ? dstIp : cif.ipv4!,
                srcPort: from === 'c' ? sport : port,
                dstPort: from === 'c' ? port : sport,
                flags, seq, ack, app, mss: flags.includes('SYN') ? 1460 : undefined,
            });

        addHop(client, cif.id, 'originate', seg('c', ['SYN'], isn, 0), [
            `Step 1 of the three-way handshake. The client picks a random initial sequence number (${isn}) and an ephemeral source port (${sport}).`,
            'No data is sent yet. TCP insists on agreeing sequence numbers before a single byte of payload moves.',
        ], rtt / 2);

        addHop(server, sif.id, 'reply', seg('s', ['SYN', 'ACK'], srvIsn, isn + 1), [
            `Step 2. The server acknowledges the client's ISN (Ack = ${isn + 1}) and sends its own (${srvIsn}).`,
            `Port ${port} is open and listening — that is the only reason a SYN/ACK comes back instead of a RST.`,
        ], rtt);

        addHop(client, cif.id, 'originate', seg('c', ['ACK'], isn + 1, srvIsn + 1), [
            'Step 3. The connection is now ESTABLISHED on both sides. This ACK carries no data.',
            `The handshake cost one full round trip (~${rtt} ms) before any request could even be sent. That is why HTTP/3 (QUIC) exists.`,
        ], rtt);

        if (tls) {
            addHop(client, cif.id, 'originate', seg('c', ['PSH', 'ACK'], isn + 1, srvIsn + 1, [tlsLayer({ kind: 'client-hello', sni: hostPart })]), [
                'TLS 1.3 Client Hello with the SNI extension. SNI is sent in clear text, which is how firewalls and proxies can see the hostname even on an encrypted session.',
                'The client also sends its key share, so TLS 1.3 completes in one round trip instead of two.',
            ], rtt * 1.5);
            addHop(server, sif.id, 'reply', seg('s', ['PSH', 'ACK'], srvIsn + 1, isn + 200, [tlsLayer({ kind: 'server-hello' })]), [
                'Server Hello + certificate. The client validates the chain, the hostname and the validity dates. A wrong clock breaks this.',
                'From here on every record is encrypted — an on-path device sees only ciphertext.',
            ], rtt * 2);
        }

        const reqPdu = seg('c', ['PSH', 'ACK'], isn + 1, srvIsn + 1, [
            ...(tls ? [tlsLayer({ kind: 'application-data' })] : []),
            httpLayer({ kind: 'request', method: 'GET', path, host: hostPart, tls }),
        ]);
        addHop(client, cif.id, 'originate', reqPdu, [
            `Finally the actual request: GET ${path} with a Host header of ${hostPart}.`,
            'The Host header is what lets one IP address serve hundreds of different websites.',
        ], rtt * (tls ? 2.5 : 1.5));

        const body = http.body || `<h1>${http.title || server.hostname}</h1><p>Served by ${server.hostname} at ${dstIp}.</p>`;
        const respPdu = seg('s', ['PSH', 'ACK'], srvIsn + 1, isn + 400, [
            ...(tls ? [tlsLayer({ kind: 'application-data' })] : []),
            httpLayer({ kind: 'response', status: 200, body, tls }),
        ]);
        addHop(server, sif.id, 'reply', respPdu, [
            `200 OK with ${body.length} bytes of HTML.`,
            'The server ACKs the request bytes in the same segment as the response — TCP piggybacks acknowledgements onto data whenever it can.',
        ], rtt * (tls ? 3 : 2));

        addHop(client, cif.id, 'originate', seg('c', ['FIN', 'ACK'], isn + 400, srvIsn + body.length), [
            'Graceful teardown: FIN, FIN/ACK, ACK. Each direction closes independently, which is why you see two FINs.',
            'A RST instead of a FIN means something aborted the connection — a firewall, a crash, or a timeout.',
        ], rtt * (tls ? 3.2 : 2.2));

        this.traces.push(trace);

        lines.push(`Connecting to ${hostPart} (${dstIp}):${port}...`,
            `TCP handshake complete (SYN → SYN/ACK → ACK) in ${rtt} ms.`,
            ...(tls ? [`TLS 1.3 handshake complete — SNI "${hostPart}", cipher TLS_AES_256_GCM_SHA384.`] : []),
            `GET ${path} HTTP/1.1`,
            `Host: ${hostPart}`,
            '',
            `HTTP/1.1 200 OK`,
            `Content-Type: text/html`,
            `Content-Length: ${body.length}`,
            '',
            body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
            '',
            'Connection closed (FIN).');

        this.emit('http', `${client.hostname} fetched ${tls ? 'https' : 'http'}://${hostPart}${path} — 200 OK`, {
            deviceId: client.id, deviceName: client.hostname, layer: 7, protocol: tls ? 'HTTPS' : 'HTTP',
            traceId: trace.id,
            detail: `Full sequence: DNS → ARP → TCP handshake${tls ? ' → TLS handshake' : ''} → HTTP GET → 200 OK → FIN. Seven layers, ${trace.hops.length} steps, one page.`,
        });

        return { ok: true, status: 200, body, trace, lines };
    }

    /* ══════════════════════════ validation ══════════════════════════ */

    validate(): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const push = (i: Omit<ValidationIssue, 'id'>) => issues.push({ id: uid('iss'), ...i });

        // Duplicate IPs
        const ipMap = new Map<string, Array<{ d: Device; i: NetInterface }>>();
        for (const d of this.topology.devices) {
            for (const i of d.interfaces) {
                if (!i.ipv4 || !isValidIPv4(i.ipv4)) continue;
                const list = ipMap.get(i.ipv4) || [];
                list.push({ d, i });
                ipMap.set(i.ipv4, list);
            }
        }
        for (const [ip, list] of ipMap) {
            if (list.length > 1) {
                push({
                    severity: 'error', deviceId: list[0].d.id, interfaceId: list[0].i.id,
                    title: `Duplicate IP address ${ip}`,
                    detail: `${list.map(x => `${x.d.hostname} ${ifaceLabel(x.i)}`).join(' and ')} both use ${ip}. ARP will return whichever answers first and connectivity becomes intermittent.`,
                    fix: 'Give each interface a unique address inside the subnet.',
                });
            }
        }

        for (const d of this.topology.devices) {
            const type = getDeviceType(d.typeId);
            const role = roleOf(d);

            if (!d.powered) {
                push({ severity: 'warning', deviceId: d.id, title: `${d.hostname} is powered off`, detail: 'A powered-off device drops every link attached to it.', fix: 'Switch it on from the properties panel.' });
                continue;
            }

            const connected = d.interfaces.filter(i => this.cabled.has(i.id));
            if (!connected.length && role !== 'cloud') {
                push({ severity: 'warning', deviceId: d.id, title: `${d.hostname} is not cabled to anything`, detail: 'It has no link, so it is isolated.', fix: 'Drag a cable from one of its ports to another device.' });
            }

            for (const i of d.interfaces) {
                const adj = this.adjacency_get(i.id);
                if (i.medium === 'console') continue;

                if (i.ipv4 && !isValidIPv4(i.ipv4)) {
                    push({ severity: 'error', deviceId: d.id, interfaceId: i.id, title: `${d.hostname} ${ifaceLabel(i)} has an invalid IPv4 address`, detail: `"${i.ipv4}" is not a valid dotted-quad address.`, fix: 'Use four octets between 0 and 255.' });
                }
                if (i.ipv4 && isValidIPv4(i.ipv4) && i.mask) {
                    const prefix = maskToPrefix(i.mask);
                    if (prefix < 31 && i.ipv4 === networkAddress(i.ipv4, i.mask)) {
                        push({ severity: 'error', deviceId: d.id, interfaceId: i.id, title: `${d.hostname} ${ifaceLabel(i)} uses the network address`, detail: `${i.ipv4}/${prefix} is the network address itself and cannot be assigned to a host.`, fix: `Use ${longToIp(ipToLong(networkAddress(i.ipv4, i.mask)) + 1)} or higher.` });
                    }
                    if (prefix < 31 && i.ipv4 === broadcastAddress(i.ipv4, i.mask)) {
                        push({ severity: 'error', deviceId: d.id, interfaceId: i.id, title: `${d.hostname} ${ifaceLabel(i)} uses the broadcast address`, detail: `${i.ipv4}/${prefix} is the subnet broadcast address.`, fix: 'Pick any address between the first and last usable host.' });
                    }
                }
                if (isLinkLocalIPv4(i.ipv4)) {
                    push({ severity: 'warning', deviceId: d.id, interfaceId: i.id, title: `${d.hostname} ${ifaceLabel(i)} has an APIPA address`, detail: `${i.ipv4} means DHCP never answered. The device can only talk to other APIPA hosts on the same wire.`, fix: 'Fix DHCP reachability, or set a static address.' });
                }
                if (i.dhcp && !i.ipv4) {
                    push({ severity: 'hint', deviceId: d.id, interfaceId: i.id, title: `${d.hostname} ${ifaceLabel(i)} is set to DHCP but has no lease`, detail: 'Nothing has been requested yet.', fix: 'Run "Request DHCP" on the device, or ipconfig /renew in its terminal.' });
                }

                // Cable / media sanity
                if (adj) {
                    const peerIf = this.ifaceById.get(adj.peerIfaceId)!;
                    const peerDev = this.byId.get(adj.peerDeviceId);
                    const eitherIsCloud = role === 'cloud' || (peerDev && roleOf(peerDev) === 'cloud');
                    if (!eitherIsCloud && mediaFamily(i.medium) !== mediaFamily(peerIf.medium)) {
                        push({
                            severity: 'error', deviceId: d.id, interfaceId: i.id, linkId: adj.link.id,
                            title: `Media mismatch on ${d.hostname} ${ifaceLabel(i)}`,
                            detail: `${i.medium} cannot be cabled to ${peerIf.medium} on ${this.byId.get(adj.peerDeviceId)?.hostname}.`,
                            fix: 'Connect like media to like media — copper to copper, fiber to fiber, serial to serial.',
                        });
                    }
                    if (i.speedMbps && peerIf.speedMbps && i.speedMbps !== peerIf.speedMbps) {
                        push({
                            severity: 'hint', deviceId: d.id, interfaceId: i.id, linkId: adj.link.id,
                            title: `Speed mismatch on ${d.hostname} ${ifaceLabel(i)}`,
                            detail: `${i.speedMbps} Mbps against ${peerIf.speedMbps} Mbps — the link negotiates down to the slower side and becomes a bottleneck.`,
                            fix: 'Match the port speeds, or accept the lower rate deliberately.',
                        });
                    }
                    if (i.duplex !== 'auto' && peerIf.duplex !== 'auto' && i.duplex !== peerIf.duplex) {
                        push({ severity: 'error', deviceId: d.id, interfaceId: i.id, linkId: adj.link.id, title: `Duplex mismatch on ${d.hostname} ${ifaceLabel(i)}`, detail: 'A duplex mismatch still passes small pings but collapses under load with late collisions. Classic hard-to-find fault.', fix: 'Set both ends to auto, or hard-code both to full.' });
                    }
                    // VLAN mismatch across an access-access link
                    if (i.mode === 'access' && peerIf.mode === 'access' && isL2Forwarder(role) && isL2Forwarder(roleOf(this.byId.get(adj.peerDeviceId)!)) && (i.accessVlan || 1) !== (peerIf.accessVlan || 1)) {
                        push({ severity: 'error', deviceId: d.id, interfaceId: i.id, linkId: adj.link.id, title: `VLAN mismatch between switches`, detail: `${d.hostname} ${ifaceLabel(i)} is access VLAN ${i.accessVlan} but the far end is access VLAN ${peerIf.accessVlan}. Traffic will silently cross between VLANs — or not pass at all.`, fix: 'Make it a trunk if it must carry several VLANs, or match the access VLANs.' });
                    }
                    if (i.mode === 'trunk' && peerIf.mode === 'trunk' && (i.nativeVlan || 1) !== (peerIf.nativeVlan || 1)) {
                        push({ severity: 'warning', deviceId: d.id, interfaceId: i.id, linkId: adj.link.id, title: `Native VLAN mismatch on trunk`, detail: `Native VLAN ${i.nativeVlan} vs ${peerIf.nativeVlan}. Untagged frames leak between VLANs — this is also a VLAN-hopping attack vector.`, fix: 'Set the same native VLAN on both ends (and prefer an unused VLAN for it).' });
                    }
                }

                if (i.mode === 'trunk' && !isL2Forwarder(role) && role !== 'router') {
                    push({ severity: 'warning', deviceId: d.id, interfaceId: i.id, title: `${d.hostname} ${ifaceLabel(i)} is a trunk on a non-switch`, detail: 'Hosts should be on access ports; they do not understand 802.1Q tags.', fix: 'Set the port back to access mode.' });
                }
            }

            // Host-level checks
            if ((role === 'host' || role === 'server') && d.interfaces.some(i => i.ipv4)) {
                if (!d.host?.defaultGateway) {
                    push({ severity: 'warning', deviceId: d.id, title: `${d.hostname} has no default gateway`, detail: 'It can reach its own subnet and nothing else.', fix: 'Set the gateway to the router interface in its subnet.' });
                } else {
                    const gwLocal = d.interfaces.some(i => i.ipv4 && sameSubnet(i.ipv4, d.host.defaultGateway, i.mask));
                    if (!gwLocal) {
                        push({ severity: 'error', deviceId: d.id, title: `${d.hostname} gateway is outside its own subnet`, detail: `Gateway ${d.host.defaultGateway} is not reachable from any of ${d.hostname}'s subnets. This is almost always a wrong subnet mask.`, fix: 'Fix the mask, or use the correct gateway address.' });
                    }
                }
            }

            // Router checks. Only ROUTED ports need an address — a trunk or an
            // access port on a multilayer switch is a switchport, and the home
            // router's LAN ports are a built-in switch.
            if (isL3Forwarder(role) && role !== 'cloud') {
                const noIp = d.interfaces.filter(i =>
                    this.cabled.has(i.id) && !i.ipv4 && !i.dhcp &&
                    i.mode === 'routed' && i.medium !== 'console');
                for (const i of noIp) {
                    push({ severity: 'error', deviceId: d.id, interfaceId: i.id, title: `${d.hostname} ${ifaceLabel(i)} is cabled but has no IP address`, detail: 'A routed interface without an address cannot forward anything.', fix: `Configure "ip address <addr> <mask>" and "no shutdown" on ${ifaceLabel(i)}.` });
                }
                const shut = d.interfaces.filter(i => this.cabled.has(i.id) && !i.enabled);
                for (const i of shut) {
                    push({ severity: 'error', deviceId: d.id, interfaceId: i.id, title: `${d.hostname} ${ifaceLabel(i)} is shut down`, detail: 'Router and firewall interfaces are administratively down by default, so a cabled port stays dark until you enable it.', fix: `Run "no shutdown" on ${ifaceLabel(i)}.` });
                }
            }

            // Multilayer switch: SVIs without ip routing
            if (role === 'multilayer') {
                const svis = d.interfaces.filter(i => i.sviVlan && i.ipv4);
                if (svis.length > 1 && !d.routing) {
                    push({ severity: 'error', deviceId: d.id, title: `${d.hostname} has SVIs but IP routing is off`, detail: 'The SVIs will answer pings but will not route between VLANs.', fix: 'Enable "ip routing" in global configuration.' });
                }
            }

            // Wireless
            if (d.wireless) {
                if (d.wireless.security === 'open') {
                    push({ severity: 'warning', deviceId: d.id, title: `${d.hostname} SSID "${d.wireless.ssid}" is open`, detail: 'Anyone in range joins, and all traffic is unencrypted over the air.', fix: 'Use WPA3-Personal (or WPA2 for older clients) with a strong passphrase.' });
                }
                if (d.wireless.security.startsWith('wep')) {
                    push({ severity: 'error', deviceId: d.id, title: `${d.hostname} uses WEP`, detail: 'WEP is broken and can be cracked in minutes. It has been deprecated since 2004.', fix: 'Move to WPA2-Personal at minimum, WPA3 where clients allow.' });
                }
                if (d.wireless.band === '2.4GHz' && ![1, 6, 11].includes(d.wireless.channel)) {
                    push({ severity: 'hint', deviceId: d.id, title: `${d.hostname} uses 2.4 GHz channel ${d.wireless.channel}`, detail: 'Only channels 1, 6 and 11 do not overlap in 2.4 GHz. Anything else guarantees adjacent-channel interference.', fix: 'Use 1, 6 or 11.' });
                }
                if (d.wireless.band === '6GHz' && !d.wireless.security.startsWith('wpa3')) {
                    push({ severity: 'error', deviceId: d.id, title: `6 GHz requires WPA3`, detail: 'The 6 GHz band mandates WPA3; WPA2 clients simply cannot join.', fix: 'Switch the SSID security to WPA3-Personal or WPA3-Enterprise.' });
                }
            }

            // DHCP pool sanity
            for (const pool of d.services?.dhcp?.pools || []) {
                if (pool.gateway && !sameSubnet(pool.gateway, pool.rangeStart, pool.mask)) {
                    push({ severity: 'error', deviceId: d.id, title: `DHCP pool "${pool.name}" hands out a gateway outside its own subnet`, detail: `Gateway ${pool.gateway} is not inside ${networkAddress(pool.rangeStart, pool.mask)}/${maskToPrefix(pool.mask)}. Every client will get an unusable default route.`, fix: 'Point the gateway at the router interface in that subnet.' });
                }
                if (ipToLong(pool.rangeEnd) < ipToLong(pool.rangeStart)) {
                    push({ severity: 'error', deviceId: d.id, title: `DHCP pool "${pool.name}" range is reversed`, detail: `${pool.rangeStart} is higher than ${pool.rangeEnd}.`, fix: 'Swap the start and end addresses.' });
                }
            }

            if (type?.supports.acl) {
                for (const acl of d.acls || []) {
                    if (!acl.rules.length) {
                        push({ severity: 'warning', deviceId: d.id, title: `ACL ${acl.name} on ${d.hostname} is empty`, detail: 'An empty ACL applied to an interface denies everything, because every ACL ends with an implicit deny.', fix: 'Add at least one permit statement.' });
                    } else if (!acl.rules.some(r => r.action === 'permit')) {
                        push({ severity: 'warning', deviceId: d.id, title: `ACL ${acl.name} has no permit statement`, detail: 'It will deny all traffic.', fix: 'Add the traffic you want to allow before the implicit deny.' });
                    }
                }
            }
        }

        // Loop without STP
        const l2 = this.topology.devices.filter(d => isL2Forwarder(roleOf(d)));
        const l2Links = this.topology.links.filter(l => {
            const a = this.byId.get(l.aDeviceId), b = this.byId.get(l.bDeviceId);
            return a && b && isL2Forwarder(roleOf(a)) && isL2Forwarder(roleOf(b));
        });
        if (l2Links.length >= l2.length && l2.length > 1) {
            const noStp = l2.filter(d => d.stp?.enabled === false);
            if (noStp.length) {
                push({ severity: 'error', deviceId: noStp[0].id, title: 'Redundant Layer-2 links with spanning tree disabled', detail: `${noStp.map(d => d.hostname).join(', ')} have STP off while the topology contains a loop. Broadcasts will circle forever, the MAC tables will thrash and the whole segment will melt down within seconds.`, fix: 'Re-enable spanning tree on every switch in the loop.' });
            }
        }

        this.issues = issues;
        return issues;
    }

    /* ─────────────── convenience reporting for the UI ─────────────── */

    interfaceStatus(deviceId: string): Array<{
        iface: NetInterface; linkTo?: string; status: string; stpRole?: StpPortRole;
    }> {
        const d = this.byId.get(deviceId);
        if (!d) return [];
        return d.interfaces.map(i => {
            const adj = this.adjacency_get(i.id);
            const peer = adj ? this.byId.get(adj.peerDeviceId) : undefined;
            const peerIf = adj ? this.ifaceById.get(adj.peerIfaceId) : undefined;
            let status = 'administratively down';
            if (i.enabled && adj && adj.link.status === 'up') status = 'up/up';
            else if (i.enabled && adj && adj.link.status === 'blocked') status = 'up/up (STP blocking)';
            else if (i.enabled && adj) status = 'down/down';
            else if (i.enabled) status = 'up/down (no cable)';
            return {
                iface: i,
                linkTo: peer && peerIf ? `${peer.hostname} ${ifaceLabel(peerIf)}` : undefined,
                status,
                stpRole: d.stp?.portRoles?.[i.id],
            };
        });
    }

    /** Which VLANs exist across the whole topology (for the VLAN legend). */
    allVlans(): Array<{ id: number; name: string; color: string; deviceCount: number }> {
        const map = new Map<number, { id: number; name: string; color: string; deviceCount: number }>();
        for (const d of this.topology.devices) {
            for (const v of d.vlans || []) {
                const cur = map.get(v.id);
                if (cur) cur.deviceCount++;
                else map.set(v.id, { ...v, deviceCount: 1 });
            }
        }
        if (!map.size) map.set(1, { id: 1, name: 'default', color: '#64748b', deviceCount: this.topology.devices.length });
        return Array.from(map.values()).sort((a, b) => a.id - b.id);
    }

    /** Broadcast domains — a genuinely useful thing to visualise. */
    broadcastDomains(): Array<{ vlan: number; devices: string[]; label: string }> {
        const out: Array<{ vlan: number; devices: string[]; label: string }> = [];
        const seen = new Set<string>();

        for (const d of this.topology.devices) {
            const role = roleOf(d);
            if (isL2Forwarder(role) || isFlooder(role) || !d.powered) continue;
            for (const i of d.interfaces) {
                if (!this.isCabledUp(i.id)) continue;
                const key = `${d.id}:${i.id}`;
                if (seen.has(key)) continue;

                const vlan = this.vlanForPort(i);
                const members: string[] = [d.id];
                seen.add(key);

                for (const other of this.topology.devices) {
                    if (other.id === d.id) continue;
                    const orole = roleOf(other);
                    if (isL2Forwarder(orole) || isFlooder(orole)) continue;
                    for (const oi of other.interfaces) {
                        if (!this.isCabledUp(oi.id)) continue;
                        if (this.findL2Path(d, i, other, oi, vlan).ok) {
                            members.push(other.id);
                            seen.add(`${other.id}:${oi.id}`);
                            break;
                        }
                    }
                }
                if (members.length > 1) {
                    out.push({ vlan, devices: members, label: `VLAN ${vlan} — ${members.length} devices` });
                }
            }
        }
        return out;
    }
}

/* ══════════════════════════ module helpers ══════════════════════════ */

function stpCost(speedMbps: number): number {
    if (speedMbps >= 10000) return 2;
    if (speedMbps >= 1000) return 4;
    if (speedMbps >= 100) return 19;
    if (speedMbps >= 16) return 62;
    return 100;
}

function ospfCost(speedMbps: number): number {
    // reference bandwidth 100 Mbps, minimum cost 1
    return Math.max(1, Math.round(100 / Math.max(1, speedMbps)));
}

function mediaFamily(m: string): string {
    if (m === 'fiber' || m === 'sfp') return 'optical';
    if (m === 'copper-ethernet' || m === 'poe') return 'copper';
    if (m === 'wireless') return 'radio';
    if (m === 'cellular') return 'cellular';
    return m;
}

function sessionKey(protocol: string, srcIp: string, srcPort: number | undefined, dstIp: string, dstPort: number | undefined): string {
    const family = protocol.split(' ')[0].split('[')[0].toLowerCase();
    return `${family}|${srcIp}:${srcPort ?? '-'}|${dstIp}:${dstPort ?? '-'}`;
}

function wildcardMatch(ip: string, base: string, wildcard: string): boolean {
    if (!isValidIPv4(ip) || !isValidIPv4(base)) return false;
    const w = isValidIPv4(wildcard) ? ipToLong(wildcard) : 0;
    const mask = ~w >>> 0;
    return ((ipToLong(ip) & mask) >>> 0) === ((ipToLong(base) & mask) >>> 0);
}

export function createSimulator(topology: Topology): Simulator {
    return new Simulator(topology);
}
