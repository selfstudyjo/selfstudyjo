/**
 * The graded snapshot of a Network Simulator design (2026-11-21). Plain - no
 * Vue, no DOM; it runs the simulator's own engine.
 *
 * In a LAB the embedded studio's design is written to the lab workspace as two
 * files: `netsim/topology.json` (the full design, so reopening the lab restores
 * it) and `netsim/state.json` (this document). App 11 grades every task of the
 * Networking track against `state.json` - see selfstudyuserlab/utils/netsimgrade.py.
 * The two halves are a contract: a field renamed here is a task that can never
 * pass there. Keep `STATE_VERSION` and the field names in step with that file.
 *
 * Reachability comes from `Simulator.canReach` - the same forwarding code a
 * ping in the studio runs - between every pair of addressed end/L3 devices,
 * capped so a large design cannot make the snapshot huge.
 */
import { Simulator, roleOf } from '@/netsim/engine';
import type { Device, Topology } from '@/netsim/types';

export const STATE_VERSION = 1;
export const STATE_FILE = 'netsim/state.json';
export const TOPOLOGY_FILE = 'netsim/topology.json';
const REACH_ROLES = new Set(['host', 'server', 'router', 'multilayer', 'firewall', 'cloud']);
const MAX_ENDPOINTS = 24;

function ifaceFacts(device: Device, linked: Set<string>) {
    return (device.interfaces || []).map((i) => ({
        name: i.short || i.name,
        ipv4: i.ipv4 || '',
        mask: i.mask || '',
        dhcp: !!i.dhcp,
        mode: i.mode,
        accessVlan: i.accessVlan ?? 1,
        nativeVlan: i.nativeVlan ?? 1,
        trunkVlans: i.trunkVlans || [],
        sviVlan: i.sviVlan ?? null,
        encapsulationVlan: i.encapsulationVlan ?? null,
        natRole: i.natRole || 'none',
        aclIn: i.aclIn || '',
        aclOut: i.aclOut || '',
        enabled: i.enabled !== false,
        up: i.up !== false,
        linked: linked.has(`${device.id}:${i.id}`),
    }));
}

export function buildGradedState(topology: Topology) {
    const sim = new Simulator(topology);
    try { sim.recompute(); } catch { /* the facts below still describe the design */ }

    const linked = new Set<string>();
    for (const l of topology.links || []) {
        linked.add(`${l.aDeviceId}:${l.aInterfaceId}`);
        linked.add(`${l.bDeviceId}:${l.bInterfaceId}`);
    }
    const byId = new Map(topology.devices.map((d) => [d.id, d]));

    const devices = topology.devices.map((d) => {
        const role = roleOf(d);
        return {
            id: d.id,
            // The HOSTNAME (R1, PC-A) - `name` is the model ("Desktop PC") and
            // is the same on every PC, so it can neither identify nor be shown.
            name: d.hostname || d.name || d.id,
            hostname: d.hostname || '',
            type: d.typeId,
            role,
            powered: d.powered !== false,
            dhcp: !!d.host?.dhcp || (d.interfaces || []).some((i) => i.dhcp),
            gateway: d.host?.defaultGateway || d.routing?.defaultGateway || '',
            interfaces: ifaceFacts(d, linked),
            vlans: (d.vlans || []).map((v) => v.id),
            staticRoutes: (d.routing?.staticRoutes || []).map((r) => ({
                network: r.network, mask: r.mask, nextHop: r.nextHop })),
            ospf: { enabled: !!d.routing?.ospf?.enabled, networks: (d.routing?.ospf?.networks || []).length },
            rip: !!d.routing?.rip?.enabled,
            dhcpPools: (d.services?.dhcp?.pools || []).length,
            dnsRecords: (d.services?.dns?.records || []).length,
            nat: { enabled: !!d.nat?.enabled, mode: d.nat?.mode || '' },
            acls: (d.acls || []).map((a: any) => ({ name: String(a.name ?? a.id ?? ''), rules: (a.rules || []).length })),
        };
    });

    const ifaceOf = (deviceId: string, ifaceId: string) =>
        byId.get(deviceId)?.interfaces.find((i) => i.id === ifaceId);
    const links = (topology.links || []).map((l) => {
        const a = ifaceOf(l.aDeviceId, l.aInterfaceId);
        const b = ifaceOf(l.bDeviceId, l.bInterfaceId);
        const status = l.status || (l.severed ? 'down' : 'up');
        return {
            a: byId.get(l.aDeviceId)?.hostname || l.aDeviceId,
            b: byId.get(l.bDeviceId)?.hostname || l.bDeviceId,
            up: !l.severed && status !== 'down' && status !== 'shutdown' && status !== 'err-disabled',
            trunk: a?.mode === 'trunk' || b?.mode === 'trunk',
        };
    });

    // Reachability between every pair of addressed endpoints, from the engine.
    const endpoints = topology.devices
        .filter((d) => d.powered !== false && REACH_ROLES.has(roleOf(d)))
        .map((d) => ({ d, ip: (d.interfaces || []).find((i) => i.ipv4)?.ipv4 || '' }))
        .filter((e) => e.ip)
        .slice(0, MAX_ENDPOINTS);
    const reach: Array<Record<string, unknown>> = [];
    for (const src of endpoints) {
        for (const dst of endpoints) {
            if (src.d.id === dst.d.id) continue;
            let ok = false;
            try { ok = sim.canReach(src.d.id, dst.ip); } catch { ok = false; }
            reach.push({ from: src.d.hostname || src.d.name, to: dst.d.hostname || dst.d.name,
                         from_id: src.d.id, to_id: dst.d.id, from_role: roleOf(src.d),
                         to_role: roleOf(dst.d), ip: dst.ip, ok });
        }
    }

    return { version: STATE_VERSION, updated_at: new Date().toISOString(), devices, links, reach };
}
