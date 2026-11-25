/**
 * Changing the network that is already on the canvas: "create another subnet and connect it to
 * the current subnet", "add 5 PCs", "add Wi-Fi". Plain module (no Vue, no DOM).
 *
 * It edits a COPY of the live topology - every address, VLAN, route, ACL and service the student
 * configured is kept - and the assistant offers the result with an undoable "Apply to canvas".
 * The alternative, asking a model to rewrite the whole network as JSON, is many minutes on a
 * student's CPU and is how the old Build answered "The AI response was not valid JSON".
 * Correct by construction: each new subnet is a free /24, its hosts' gateway is the router port
 * that serves it, routers learn the new subnet (connected, OSPF if running, static otherwise),
 * and every cable joins two free ports of the same medium.
 */
import { cloneTopology, connect, createDevice, setIp, addStaticRoute, separateOverlaps } from './topology';
import { getDeviceType } from './devices';
import { networkAddress, ipToLong, longToIp, maskToPrefix } from './ip';
import type { Device, NetInterface, Topology } from './types';

export type EditAction = 'add_subnet' | 'add_hosts' | 'add_ap';
export interface EditPlan { action: EditAction; count: number; hostType: string }
export interface EditResult { ok: boolean; topology?: Topology; summary: string[]; reason?: string }

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20 };
const numberIn = (s: string): number | null => {
    const m = /\b(\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty)\s+(?:more\s+|new\s+|extra\s+)?(pcs?|computers?|hosts?|laptops?|servers?|printers?|devices?|clients?|machines?|users?)\b/i.exec(s)
        || /([0-9٠-٩]{1,2})\s*(?:أجهزة|جهاز|حواسيب|كمبيوتر)/.exec(s);
    if (!m) return null;
    const t = m[1].toLowerCase().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    return /^\d+$/.test(t) ? Number(t) : NUM[t] ?? null;
};
const hostTypeIn = (s: string): string =>
    /laptop/i.test(s) ? 'laptop' : /server/i.test(s) ? 'server-generic' : /printer/i.test(s) ? 'printer' : 'pc';

/** Is this a request to change the network on the canvas (rather than build a new one)? */
export function isEditRequest(text: string): boolean {
    return /\b(add|another|extend|connect|attach|expand|second|extra|more|existing|current|join|plug)\b|أضف|اضف|أخرى|اخرى|وصل|اربط/i.test(String(text || ''));
}

/** The edit a request asks for, or null when it names none (then the model is asked). */
export function parseEditRequest(text: string): EditPlan | null {
    const s = String(text || '');
    const count = numberIn(s);
    if (/\b(subnets?|lan|segment|network|site|branch|department|office|floor)\b|شبكة|فرعية/i.test(s) && /\b(another|new|second|extra|additional|add|create|one more)\b|أخرى|اخرى|جديدة|أضف|انشئ|أنشئ/i.test(s)) {
        return { action: 'add_subnet', count: count ?? 0, hostType: hostTypeIn(s) };
    }
    if (/\b(wi-?fi|wireless|access[ -]?point|ap)\b|لاسلكي|واي ?فاي/i.test(s)) return { action: 'add_ap', count: count ?? 0, hostType: 'laptop' };
    if (count !== null || /\badd\b.*\b(pc|computer|host|laptop|server|printer|device|client)/i.test(s)) {
        return { action: 'add_hosts', count: Math.max(1, count ?? 1), hostType: hostTypeIn(s) };
    }
    return null;
}

export const EDIT_PROMPT = `A student is changing a computer network that already exists. Reply with ONE JSON object and nothing else:
{"action":"add_subnet","count":4,"host_type":"pc"}
action: "add_subnet" (a new LAN connected to the current network), "add_hosts" (more devices on the current LAN) or "add_ap" (Wi-Fi).
count: how many end devices to add (0 = choose). host_type: "pc", "laptop", "server" or "printer".`;

export function cleanEditPlan(x: any): EditPlan | null {
    if (!x || typeof x !== 'object') return null;
    const action = ['add_subnet', 'add_hosts', 'add_ap'].includes(x.action) ? x.action as EditAction : null;
    if (!action) return null;
    const t = String(x.host_type || x.hostType || 'pc').toLowerCase();
    return { action, count: Math.max(0, Math.min(40, Math.round(Number(x.count) || 0))), hostType: t.startsWith('lap') ? 'laptop' : t.startsWith('serv') ? 'server-generic' : t.startsWith('print') ? 'printer' : 'pc' };
}

// ---------------------------------------------------------------- helpers
const role = (d: Device) => getDeviceType(d.typeId)?.role || 'host';
const isRouter = (d: Device) => role(d) === 'router';
const isSwitch = (d: Device) => role(d) === 'switch' || role(d) === 'multilayer';
const isHost = (d: Device) => ['host', 'server'].includes(role(d));
const MASK24 = '255.255.255.0';

function linkedIfaces(t: Topology): Set<string> {
    return new Set(t.links.flatMap((l) => [l.aInterfaceId, l.bInterfaceId]));
}
function freeCopper(t: Topology, d: Device, used = linkedIfaces(t)): NetInterface[] {
    return d.interfaces.filter((i) => i.medium === 'copper-ethernet' && !i.sviVlan && !used.has(i.id));
}
function neighbours(t: Topology, d: Device): Array<{ dev: Device; local: NetInterface; remote: NetInterface }> {
    const out: Array<{ dev: Device; local: NetInterface; remote: NetInterface }> = [];
    for (const l of t.links) {
        const mine = l.aDeviceId === d.id ? 'a' : l.bDeviceId === d.id ? 'b' : '';
        if (!mine) continue;
        const otherId = mine === 'a' ? l.bDeviceId : l.aDeviceId;
        const dev = t.devices.find((x) => x.id === otherId);
        const local = d.interfaces.find((i) => i.id === (mine === 'a' ? l.aInterfaceId : l.bInterfaceId));
        const remote = dev?.interfaces.find((i) => i.id === (mine === 'a' ? l.bInterfaceId : l.aInterfaceId));
        if (dev && local && remote) out.push({ dev, local, remote });
    }
    return out;
}
function usedNetworks(t: Topology): Set<string> {
    const s = new Set<string>();
    for (const d of t.devices) for (const i of d.interfaces) if (i.ipv4 && i.mask) s.add(networkAddress(i.ipv4, i.mask) + '/' + maskToPrefix(i.mask));
    return s;
}
function usedIps(t: Topology): Set<string> {
    return new Set(t.devices.flatMap((d) => d.interfaces.map((i) => i.ipv4).filter(Boolean)));
}
function freeLan(t: Topology): string {
    const used = usedNetworks(t);
    const overlaps = (net: string) => [...used].some((u) => { const [n, p] = u.split('/'); return networkAddress(net, Number(p)) === n || networkAddress(n, 24) === net; });
    for (let k = 10; k <= 250; k += 10) { const n = `192.168.${k}.0`; if (!overlaps(n)) return n; }
    for (let k = 1; k <= 254; k++) { const n = `172.16.${k}.0`; if (!overlaps(n)) return n; }
    return '10.99.0.0';
}
function freeP2p(t: Topology): string {
    const used = usedNetworks(t);
    for (let k = 1; k < 250; k++) { const n = `10.0.${k}.0`; if (![...used].some((u) => u.startsWith(`10.0.${k}.`))) return n; }
    return '10.0.250.0';
}
const nthIp = (net: string, n: number) => longToIp(ipToLong(net) + n);

/** The /24 (or whatever) a switch serves: from a router port facing it or from its hosts. */
function subnetOfSwitch(t: Topology, sw: Device, seen = new Set<string>()): { net: string; mask: string; gw: string } | null {
    seen.add(sw.id);
    for (const n of neighbours(t, sw)) {
        if ((isRouter(n.dev) || role(n.dev) === 'multilayer') && n.remote.ipv4) return { net: networkAddress(n.remote.ipv4, n.remote.mask), mask: n.remote.mask, gw: n.remote.ipv4 };
    }
    for (const n of neighbours(t, sw)) {
        if (isHost(n.dev) && n.remote.ipv4) {
            const gw = n.dev.host.defaultGateway || n.dev.routing.defaultGateway || '';
            return { net: networkAddress(n.remote.ipv4, n.remote.mask || MASK24), mask: n.remote.mask || MASK24, gw };
        }
    }
    for (const n of neighbours(t, sw)) if (isSwitch(n.dev) && !seen.has(n.dev.id)) { const r = subnetOfSwitch(t, n.dev, seen); if (r) return r; }
    return null;
}
function nextHostIp(t: Topology, net: string, mask: string, from = 11): string {
    const used = usedIps(t);
    const size = 2 ** (32 - maskToPrefix(mask));
    for (let k = from; k < size - 1; k++) { const ip = nthIp(net, k); if (!used.has(ip)) return ip; }
    for (let k = 2; k < from; k++) { const ip = nthIp(net, k); if (!used.has(ip)) return ip; }
    return '';
}
function place(d: Device, x: number, y: number) { d.x = Math.round(x); d.y = Math.round(y); }

/** Plug `count` new hosts into `sw` (chaining a further switch when it runs out of ports). */
function addHostsTo(t: Topology, sw: Device, count: number, type: string, sub: { net: string; mask: string; gw: string }, summary: string[]): number {
    let added = 0;
    let current = sw;
    const baseY = sw.y + 170;
    for (let k = 0; k < count; k++) {
        let port = freeCopper(t, current).find((i) => i.mode !== 'trunk') || freeCopper(t, current)[0];
        if (!port || freeCopper(t, current).length < 2) {
            // Keep one port for the uplink of a further switch.
            const more = createDevice('switch-24', current.x + 240, current.y, t.devices);
            t.devices.push(more);
            const a = freeCopper(t, current)[0];
            const b = freeCopper(t, more).slice(-1)[0];
            if (!a || !b || !connect(t, current.id, a.id, more.id, b.id).ok) break;
            summary.push(`${more.hostname}: a further switch, uplinked to ${current.hostname} (it ran out of ports)`);
            current = more;
            port = freeCopper(t, current)[0];
        }
        const host = createDevice(type, 0, 0, t.devices);
        const nic = host.interfaces.find((i) => i.medium === 'copper-ethernet');
        if (!nic || !port) break;
        t.devices.push(host);
        const ip = nextHostIp(t, sub.net, sub.mask, type === 'server-generic' ? 200 : type === 'printer' ? 240 : 11);
        if (ip) { setIp(host, nic.id, ip, sub.mask); host.host.dhcp = false; }
        if (sub.gw) { host.host.defaultGateway = sub.gw; host.routing.defaultGateway = sub.gw; }
        nic.enabled = true;
        if (port.mode === 'trunk') port.mode = 'access';
        const r = connect(t, current.id, port.id, host.id, nic.id);
        if (!r.ok) { t.devices.pop(); break; }
        place(host, current.x - 160 + (k % 5) * 80, baseY + Math.floor(k / 5) * 100);
        summary.push(`${host.hostname}: ${ip || 'no address'}${sub.gw ? `, gateway ${sub.gw}` : ''} on ${current.hostname}`);
        added++;
    }
    return added;
}

/** Make every router learn `net/24`, reachable at `via` on `owner`. */
function advertise(t: Topology, owner: Device, net: string, mask: string, summary: string[]) {
    const routers = t.devices.filter(isRouter);
    if (routers.some((r) => r.routing.ospf.enabled) && owner.routing.ospf.enabled) return;   // OSPF learns it
    for (const r of routers) {
        if (r.id === owner.id) continue;
        // Next hop: the owner's address on a subnet shared with this router.
        let nextHop = '';
        for (const ri of r.interfaces) {
            if (!ri.ipv4) continue;
            const oi = owner.interfaces.find((x) => x.ipv4 && x.mask && networkAddress(x.ipv4, x.mask) === networkAddress(ri.ipv4, ri.mask));
            if (oi) { nextHop = oi.ipv4; break; }
        }
        if (nextHop && !r.routing.staticRoutes.some((s) => s.network === net)) {
            addStaticRoute(r, net, mask, nextHop);
            summary.push(`${r.hostname}: route to ${net}/${maskToPrefix(mask)} via ${nextHop}`);
        }
    }
}

// ---------------------------------------------------------------- the edits
function addSubnet(t: Topology, plan: EditPlan, summary: string[]): string | null {
    const switches = t.devices.filter((d) => role(d) === 'switch');
    const hostsNow = t.devices.filter(isHost).length;
    const count = plan.count || Math.max(2, Math.min(8, Math.round(hostsNow / Math.max(1, switches.length)) || 4));
    const net = freeLan(t), gw = nthIp(net, 1);
    const maxX = Math.max(0, ...t.devices.map((d) => d.x));
    const topY = Math.min(...t.devices.map((d) => d.y), 120);

    let router = t.devices.filter(isRouter).find((r) => freeCopper(t, r).length > 0) || null;
    const anyRouter = t.devices.find(isRouter) || null;

    if (!router && anyRouter) {
        // Every router port is in use: a second router joins the current LAN and serves the new one.
        const lanSw = neighbours(t, anyRouter).find((n) => isSwitch(n.dev) && freeCopper(t, n.dev).length)?.dev;
        const lanSub = lanSw ? subnetOfSwitch(t, lanSw) : null;
        if (!lanSw || !lanSub) return 'Every port of the router is in use and no switch on its LAN has a free port.';
        const r2 = createDevice('router-branch', maxX + 260, topY, t.devices);
        t.devices.push(r2);
        const up = freeCopper(t, r2)[0], swPort = freeCopper(t, lanSw)[0];
        const upIp = nextHostIp(t, lanSub.net, lanSub.mask, 2);
        setIp(r2, up.id, upIp, lanSub.mask); up.enabled = true; up.mode = 'routed';
        connect(t, r2.id, up.id, lanSw.id, swPort.id);
        addStaticRoute(r2, '0.0.0.0', '0.0.0.0', lanSub.gw);
        summary.push(`${r2.hostname}: a new router on ${lanSw.hostname} (${upIp}), because ${anyRouter.hostname} has no free port`);
        router = r2;
    }
    if (!router) {
        // No router yet: add one that joins the current LAN and the new one.
        const lanSw = switches.find((s) => freeCopper(t, s).length) || null;
        if (!lanSw) return 'There is no switch with a free port to connect a router to.';
        const lanSub = subnetOfSwitch(t, lanSw);
        const r1 = createDevice('router-branch', maxX / 2 + 100, topY - 140, t.devices);
        t.devices.push(r1);
        const lanPort = freeCopper(t, r1)[0], swPort = freeCopper(t, lanSw)[0];
        let curGw = lanSub?.gw || '';
        if (lanSub && (!curGw || usedIps(t).has(curGw))) curGw = usedIps(t).has(nthIp(lanSub.net, 1)) ? nextHostIp(t, lanSub.net, lanSub.mask, 1) : nthIp(lanSub.net, 1);
        if (lanSub) {
            setIp(r1, lanPort.id, curGw, lanSub.mask);
            for (const h of t.devices.filter(isHost)) {
                const hi = h.interfaces.find((i) => i.ipv4);
                if (hi && networkAddress(hi.ipv4, hi.mask) === lanSub.net && !h.host.defaultGateway) { h.host.defaultGateway = curGw; h.routing.defaultGateway = curGw; }
            }
            summary.push(`${r1.hostname}: a new router joining the current LAN ${lanSub.net}/${maskToPrefix(lanSub.mask)} (${curGw}); the existing hosts use it as their gateway`);
        } else {
            summary.push(`${r1.hostname}: a new router connected to ${lanSw.hostname}`);
        }
        lanPort.enabled = true; lanPort.mode = 'routed';
        connect(t, r1.id, lanPort.id, lanSw.id, swPort.id);
        router = r1;
    }

    // The new LAN: router port -> new switch -> hosts.
    const port = freeCopper(t, router)[0];
    if (!port) return `${router.hostname} has no free port for the new subnet.`;
    const sw = createDevice('switch-24', maxX + 260, Math.max(300, router.y + 180), t.devices);
    t.devices.push(sw);
    setIp(router, port.id, gw, MASK24); port.enabled = true; port.mode = 'routed';
    port.description = `LAN ${net}/24`;
    const swPort = freeCopper(t, sw).slice(-1)[0];
    const r = connect(t, router.id, port.id, sw.id, swPort.id);
    if (!r.ok) return `Could not cable ${router.hostname} to the new switch: ${r.reason}`;
    summary.unshift(`New subnet ${net}/24 on ${router.hostname} ${port.name} (${gw}), switch ${sw.hostname}`);
    addHostsTo(t, sw, count, plan.hostType, { net, mask: MASK24, gw }, summary);
    advertise(t, router, net, MASK24, summary);
    return null;
}

function addHosts(t: Topology, plan: EditPlan, summary: string[]): string | null {
    // The access switch with the most hosts on it (the "current" LAN), else any switch.
    const switches = t.devices.filter((d) => role(d) === 'switch');
    if (!switches.length) return 'There is no switch on the canvas to plug new devices into. Ask me to build a network first.';
    const score = (s: Device) => neighbours(t, s).filter((n) => isHost(n.dev)).length;
    const sw = [...switches].sort((a, b) => score(b) - score(a))[0];
    const sub = subnetOfSwitch(t, sw) || { net: freeLan(t), mask: MASK24, gw: '' };
    summary.push(`Added to ${sw.hostname} (${sub.net}/${maskToPrefix(sub.mask)})`);
    const n = addHostsTo(t, sw, plan.count, plan.hostType, sub, summary);
    return n ? null : `${sw.hostname} has no free port.`;
}

function addAp(t: Topology, plan: EditPlan, summary: string[]): string | null {
    const switches = t.devices.filter((d) => role(d) === 'switch' && freeCopper(t, d).length);
    if (!switches.length) return 'There is no switch with a free port for an access point.';
    const sw = switches[0];
    const sub = subnetOfSwitch(t, sw);
    const ap = createDevice('ap-wifi6', sw.x + 120, sw.y + 120, t.devices);
    t.devices.push(ap);
    const up = ap.interfaces.find((i) => i.medium === 'copper-ethernet')!;
    up.mode = 'access'; up.enabled = true;   // an AP bridges: a switchport, not a routed port
    const port = freeCopper(t, sw)[0];
    if (port.mode === 'trunk') port.mode = 'access';
    connect(t, sw.id, port.id, ap.id, up.id);
    if (ap.wireless) { ap.wireless.ssid = ap.wireless.ssid || 'SelfStudy-WiFi'; ap.wireless.security = 'wpa2-personal'; ap.wireless.passphrase = ap.wireless.passphrase || 'SelfStudy2026'; }
    summary.push(`${ap.hostname} on ${sw.hostname}: SSID "${ap.wireless?.ssid}", WPA2 "${ap.wireless?.passphrase}"`);
    for (let k = 0; k < (plan.count || 2); k++) {
        const lt = createDevice('laptop', ap.x - 80 + k * 80, ap.y + 120, t.devices);
        const radio = lt.interfaces.find((i) => i.medium === 'wireless');
        if (!radio || !ap.wireless) break;
        t.devices.push(lt);
        radio.ssid = ap.wireless.ssid; radio.passphrase = ap.wireless.passphrase; radio.enabled = true;
        if (sub) {
            const ip = nextHostIp(t, sub.net, sub.mask);
            setIp(lt, radio.id, ip, sub.mask); lt.host.dhcp = false;
            if (sub.gw) { lt.host.defaultGateway = sub.gw; lt.routing.defaultGateway = sub.gw; }
            summary.push(`${lt.hostname}: ${ip} over Wi-Fi`);
        }
    }
    return null;
}

/** Apply the edit to a copy of the topology. */
export function applyEdit(current: Topology, plan: EditPlan): EditResult {
    const t = cloneTopology(current);
    const summary: string[] = [];
    const err = plan.action === 'add_subnet' ? addSubnet(t, plan, summary)
        : plan.action === 'add_ap' ? addAp(t, plan, summary)
            : addHosts(t, plan, summary);
    if (err) return { ok: false, summary, reason: err };
    separateOverlaps(t);
    return { ok: true, topology: t, summary };
}
