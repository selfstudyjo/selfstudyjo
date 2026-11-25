/**
 * The network builder's fast path: a request like "build a network of 10 devices connected
 * together" or "3 routers, 4 switches, 20 PCs, VLANs 10 and 20, internet" becomes a correct
 * topology in milliseconds, with no model call. Plain module (no Vue, no DOM).
 *
 * Why it exists: asking a language model for the whole topology means up to 8,000 tokens of
 * exact JSON (every interface, address and link). A model on a student's CPU writes ~5-15 tokens
 * a second, so that is many minutes, and a small model gets addressing wrong. What a request
 * actually carries is a handful of numbers; addressing them correctly is arithmetic, which is
 * code's job. So: parse the numbers (or let a model extract them - a 60-token answer), then build.
 *
 * Every design it emits is valid by construction: each host's gateway is inside its subnet, every
 * routed interface is enabled, every link uses a free port, and multi-router designs run OSPF.
 */
import { createDevice } from './topology';
import type { AiTopologySpec } from './topology';

export interface QuickParams {
    routers: number;
    switches: number;
    pcs: number;
    laptops: number;
    servers: number;
    printers: number;
    phones: number;
    aps: number;
    vlans: number[];        // VLAN ids; [] = one flat subnet per router
    internet: boolean;
    dhcp: boolean;
    firewall: boolean;
}

const WORDS: Record<string, number> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    // Arabic
    'واحد': 1, 'اثنين': 2, 'اثنان': 2, 'ثلاث': 3, 'ثلاثة': 3, 'أربع': 4, 'اربع': 4, 'أربعة': 4, 'خمس': 5, 'خمسة': 5,
    'ست': 6, 'ستة': 6, 'سبع': 7, 'سبعة': 7, 'ثمان': 8, 'ثمانية': 8, 'تسع': 9, 'تسعة': 9, 'عشر': 10, 'عشرة': 10,
};

const KINDS: Array<[keyof QuickParams, RegExp]> = [
    ['routers', /\b(routers?|gateways?)\b|راوتر|موجه/i],
    ['switches', /\bswitch(es)?\b|سويتش|محول/i],
    ['laptops', /\blaptops?|notebooks?\b|لابتوب/i],
    ['servers', /\bservers?\b|سيرفر|خادم|خوادم/i],
    ['printers', /\bprinters?\b|طابع/i],
    ['phones', /\b(phones?|smartphones?|mobiles?)\b|هاتف|جوال/i],
    ['aps', /\b(access[ -]?points?|aps?|wi-?fi aps?)\b|نقطة وصول/i],
    ['pcs', /\b(pcs?|computers?|desktops?|hosts?|workstations?|clients?|users?)\b|حاسوب|كمبيوتر|أجهزة كمبيوتر/i],
];

function toNumber(tok: string): number | null {
    const t = tok.toLowerCase().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if (/^\d{1,3}$/.test(t)) return Number(t);
    return WORDS[t] ?? null;
}

/** The numbers in a request, or null when it names nothing countable (then ask the model). */
export function parseNetworkRequest(text: string): QuickParams | null {
    const src = String(text || '').trim();
    if (!src) return null;
    const p: QuickParams = { routers: 0, switches: 0, pcs: 0, laptops: 0, servers: 0, printers: 0, phones: 0, aps: 0,
        vlans: [], internet: false, dhcp: false, firewall: false };
    let found = false;
    // "<number> <kind>" pairs, e.g. "3 routers", "ten PCs", "2 access points".
    const re = /([0-9٠-٩]{1,3}|[a-z؀-ۿ]+)\s+(?:(?:wired|wireless|cisco|l2|l3|access|core|layer[- ]?\d|managed|desktop|web|file|dns|dhcp|network)\s+)?([a-z؀-ۿ-]+(?:\s+points?)?)/gi;
    for (const m of src.matchAll(re)) {
        const n = toNumber(m[1]);
        if (n === null || n <= 0) continue;
        const kind = KINDS.find(([, r]) => r.test(m[2]));
        if (!kind) continue;
        (p as any)[kind[0]] += Math.min(n, 60);
        found = true;
    }
    // "network of 10 devices", "10 nodes", "10 devices connected together".
    const total = /([0-9٠-٩]{1,3}|[a-z؀-ۿ]+)\s+(devices?|nodes?|machines?|أجهزة|جهاز)/i.exec(src);
    const totalN = total ? toNumber(total[1]) : null;
    // VLANs: "VLANs 10, 20 and 30", "3 vlans", "vlan 10".
    const vlanList = /vlans?\s*((?:\d{1,4}\s*(?:,|and|&|و)?\s*)+)/i.exec(src);
    const vlanCount = /(\d{1,2}|[a-z]+)\s+vlans/i.exec(src);
    if (vlanList) p.vlans = [...new Set(vlanList[1].match(/\d{1,4}/g)!.map(Number).filter((v) => v >= 2 && v <= 4094))].slice(0, 8);
    if (!p.vlans.length && vlanCount) { const n = toNumber(vlanCount[1]) || 0; p.vlans = Array.from({ length: Math.min(Math.max(n, 0), 8) }, (_, i) => (i + 1) * 10); }
    if (p.vlans.length === 1) p.vlans = [];   // one VLAN is one subnet
    p.internet = /\b(internet|wan|isp|online|nat)\b|انترنت|إنترنت/i.test(src);
    p.dhcp = /\bdhcp\b/i.test(src);
    p.firewall = /\bfirewall\b|جدار ناري/i.test(src);
    if (/\b(wi-?fi|wireless)\b|لاسلكي|واي ?فاي/i.test(src) && !p.aps) p.aps = 1;

    if (!found && totalN && totalN >= 2) {
        // "N devices": one switch (or more for many hosts), a router once there is something to
        // route to, and PCs for the rest.
        const n = Math.min(totalN, 120);
        p.routers = n >= 4 || p.internet || p.vlans.length ? 1 : 0;
        p.switches = n >= 3 ? Math.max(1, Math.ceil((n - p.routers) / 24)) : 0;
        p.pcs = Math.max(0, n - p.routers - p.switches - p.aps);
        found = true;
    } else if (found && totalN && totalN > 0) {
        // "10 devices: 2 routers and 3 switches" - the rest are PCs.
        const named = p.routers + p.switches + p.pcs + p.laptops + p.servers + p.printers + p.phones + p.aps;
        if (named < totalN && !p.pcs) p.pcs = totalN - named;
    }
    if (!found && !p.vlans.length) return null;
    // "4 routers, each with a switch and 3 PCs": the counts after "each" are per router.
    if (p.routers > 1 && /\beach\b|\bper (router|site)\b|لكل/i.test(src)) {
        const k = p.routers;
        p.switches = Math.max(p.switches, 1) * k;
        p.pcs *= k; p.laptops *= k; p.servers *= k; p.printers *= k; p.phones *= k;
    }
    // Anything with hosts needs a switch; anything with VLANs or the Internet needs routing.
    const hosts = p.pcs + p.laptops + p.servers + p.printers + p.phones;
    if (!p.pcs && !p.laptops && !p.servers && !p.printers && !p.phones && p.vlans.length) p.pcs = p.vlans.length * 2;
    if ((hosts || p.aps) && !p.switches) p.switches = Math.max(1, Math.ceil((hosts + p.aps) / 22));
    if ((p.internet || p.firewall) && !p.routers) p.routers = 1;
    if (p.routers + p.switches + hosts + p.aps === 0) return null;
    return p;
}

/** Make a model's parameter answer safe (it is just numbers and flags). */
export function cleanParams(x: any): QuickParams | null {
    if (!x || typeof x !== 'object') return null;
    const n = (v: any, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
    const p: QuickParams = {
        routers: n(x.routers, 8), switches: n(x.switches, 12), pcs: n(x.pcs, 80), laptops: n(x.laptops, 40),
        servers: n(x.servers, 12), printers: n(x.printers, 8), phones: n(x.phones, 20), aps: n(x.aps ?? x.access_points, 6),
        vlans: Array.isArray(x.vlans) ? [...new Set(x.vlans.map(Number).filter((v: number) => v >= 2 && v <= 4094))].slice(0, 8) as number[] : [],
        internet: !!x.internet, dhcp: !!x.dhcp, firewall: !!x.firewall,
    };
    if (p.vlans.length === 1) p.vlans = [];
    const hosts = p.pcs + p.laptops + p.servers + p.printers + p.phones;
    if ((hosts || p.aps) && !p.switches) p.switches = Math.max(1, Math.ceil((hosts + p.aps) / 22));
    if ((p.internet || p.firewall || p.vlans.length) && !p.routers) p.routers = 1;
    return p.routers + p.switches + hosts + p.aps ? p : null;
}

/** The prompt that asks a model for parameters only (used when the text parser finds nothing). */
export const PARAMS_PROMPT = `Read a request for a computer network and reply with ONE JSON object and nothing else:
{"routers":0,"switches":0,"pcs":0,"laptops":0,"servers":0,"printers":0,"phones":0,"aps":0,"vlans":[],"internet":false,"dhcp":false,"firewall":false}
Fill in the numbers the request asks for (vlans = list of VLAN ids such as [10,20]). Choose sensible numbers when it only describes a place, e.g. "a small office" = 1 router, 1 switch, 6 pcs, 1 printer, internet true.`;

interface Ports { wired: string[]; sfp: string[]; wireless: string[] }
const portCache = new Map<string, Ports>();
function ports(typeId: string): Ports {
    let p = portCache.get(typeId);
    if (!p) {
        const d = createDevice(typeId, 0, 0, []);
        p = {
            // Copper only: a copper port cannot be cabled to a fibre (SFP) one.
            wired: d.interfaces.filter((i) => i.medium === 'copper-ethernet').map((i) => i.name),
            sfp: d.interfaces.filter((i) => i.medium === 'sfp').map((i) => i.name),
            wireless: d.interfaces.filter((i) => i.medium === 'wireless').map((i) => i.name),
        };
        portCache.set(typeId, p);
    }
    return p;
}

type SpecDevice = AiTopologySpec['devices'][number];

/** Build the topology for the parameters. Deterministic: the same request, the same network. */
export function buildQuickSpec(p: QuickParams): AiTopologySpec {
    const devices: SpecDevice[] = [];
    const links: AiTopologySpec['links'] = [];
    const notes: string[] = [];
    const used = new Map<string, number>();          // hostname -> next free wired port index
    const portOf = (dev: SpecDevice, from = 0) => {
        const list = ports(dev.type).wired;
        const i = Math.max(used.get(dev.hostname) ?? 0, from);
        used.set(dev.hostname, i + 1);
        return list[i];
    };
    const iface = (dev: SpecDevice, x: NonNullable<SpecDevice['interfaces']>[number]) => { (dev.interfaces ||= []).push(x); };
    const link = (a: SpecDevice, ai: string, b: SpecDevice, bi: string, label?: string) => links.push({ from: a.hostname, fromInterface: ai, to: b.hostname, toInterface: bi, label });

    const useVlans = p.vlans.length >= 2;
    const routerCount = Math.max(p.routers, useVlans || p.internet ? 1 : 0);
    const switchCount = Math.max(p.switches, 1);

    // ---- routers in a chain, OSPF between them (a /30 per hop)
    const routers: SpecDevice[] = [];
    for (let r = 0; r < routerCount; r++) {
        routers.push({ hostname: `R${r + 1}`, type: r === 0 && p.internet ? 'router-edge' : 'router-branch', x: 640 + (r - (routerCount - 1) / 2) * 260, y: 110, notes: r === 0 ? 'Gateway router' : 'Site router', ospf: routerCount > 1, interfaces: [] });
    }
    devices.push(...routers);
    for (let r = 1; r < routers.length; r++) {
        const a = routers[r - 1], b = routers[r];
        const net = `10.0.${r}.`;
        // Copper ports: [0] = LAN, [1] = link from the previous router, [2] = link to the next
        // (an edge router has two copper ports: LAN and the link to R2).
        const ai = r === 1 ? ports(a.type).wired[1] : ports(a.type).wired[2], bi = ports(b.type).wired[1];
        iface(a, { name: ai, ip: net + '1', mask: '255.255.255.252', mode: 'routed', enabled: true, description: `to ${b.hostname}` });
        iface(b, { name: bi, ip: net + '2', mask: '255.255.255.252', mode: 'routed', enabled: true, description: `to ${a.hostname}` });
        link(a, ai, b, bi, `WAN 10.0.${r}.0/30`);
    }
    if (routers.length > 1) notes.push(`The ${routers.length} routers are chained with /30 links and run OSPF, so every LAN reaches every other one.`);

    // ---- switches: VLAN design = an L3 core switch + access switches; flat = switches per router
    const switches: SpecDevice[] = [];
    let core: SpecDevice | null = null;
    if (useVlans) {
        core = { hostname: 'CORE1', type: 'switch-l3', x: 640, y: 260, notes: 'Routes between the VLANs (SVIs)', vlans: p.vlans.map((v) => ({ id: v, name: `VLAN${v}` })), interfaces: [] };
        for (const v of p.vlans) iface(core, { sviVlan: v, ip: `192.168.${v % 256}.1`, mask: '255.255.255.0', enabled: true, description: `Gateway VLAN ${v}` });
        devices.push(core);
        switches.push(core);
        for (let s = 1; s < switchCount; s++) {
            const sw: SpecDevice = { hostname: `SW${s}`, type: 'switch-24', x: 640 + (s - switchCount / 2) * 200, y: 400, vlans: p.vlans.map((v) => ({ id: v, name: `VLAN${v}` })), interfaces: [] };
            const up = ports(sw.type).wired[ports(sw.type).wired.length - 1];
            const down = portOf(core, 0);
            iface(sw, { name: up, mode: 'trunk', trunkVlans: p.vlans, enabled: true, description: 'uplink to CORE1' });
            iface(core, { name: down, mode: 'trunk', trunkVlans: p.vlans, enabled: true, description: `to ${sw.hostname}` });
            link(core, down, sw, up, 'trunk');
            devices.push(sw);
            switches.push(sw);
        }
        if (routers.length) {
            const r1 = routers[0];
            const rp = ports(r1.type).wired[0], cp = portOf(core, 0);
            iface(r1, { name: rp, ip: '10.255.0.1', mask: '255.255.255.252', mode: 'routed', enabled: true, description: 'to CORE1' });
            iface(core, { name: cp, ip: '10.255.0.2', mask: '255.255.255.252', mode: 'routed', enabled: true, description: 'to R1' });
            link(r1, rp, core, cp, 'routed 10.255.0.0/30');
            core.staticRoutes = [{ network: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.255.0.1' }];
            r1.staticRoutes = p.vlans.map((v) => ({ network: `192.168.${v % 256}.0`, mask: '255.255.255.0', nextHop: '10.255.0.2' }));
        }
        notes.push(`VLANs ${p.vlans.join(', ')} each have their own subnet (192.168.<vlan>.0/24); CORE1 routes between them with SVIs, and access switches reach it over 802.1Q trunks.`);
    } else {
        const perRouter = Math.max(1, routers.length);
        for (let s = 0; s < switchCount; s++) {
            const site = s % perRouter;
            const sw: SpecDevice = { hostname: `SW${s + 1}`, type: 'switch-24', x: 120 + s * 210, y: 300, interfaces: [] };
            // Only the first switch of a site is uplinked to the router; with several sites,
            // sites without a switch of their own have no LAN (see nets below).
            devices.push(sw);
            switches.push(sw);
            const r = routers[site];
            const firstOfSite = switches.filter((x, i) => i % perRouter === site)[0] === sw;
            if (r && firstOfSite) {
                // (the router's LAN interface exists only for a site with a switch)
                const rp = ports(r.type).wired[0], sp = ports(sw.type).wired[ports(sw.type).wired.length - 1];
                iface(r, { name: rp, ip: `192.168.${(site + 1) * 10}.1`, mask: '255.255.255.0', mode: 'routed', enabled: true, description: `LAN ${sw.hostname}` });
                link(r, rp, sw, sp, 'LAN');
            } else {
                // A further switch at the same site: uplink to that site's first switch.
                const first = switches.filter((x, i) => i % perRouter === site)[0];
                if (first && first !== sw) {
                    const fw = ports(first.type).wired;
                    const spare = fw[fw.length - 2];
                    const a = !links.some((l) => l.from === first.hostname && l.fromInterface === spare) ? spare : portOf(first);
                    link(first, a, sw, ports(sw.type).wired[ports(sw.type).wired.length - 1], 'uplink');
                }
            }
        }
    }

    // ---- subnets
    type Net = { prefix: string; gw: string; vlan?: number; sw: SpecDevice[]; router?: SpecDevice };
    const nets: Net[] = useVlans
        ? p.vlans.map((v) => ({ prefix: `192.168.${v % 256}.`, gw: `192.168.${v % 256}.1`, vlan: v, sw: switches.length > 1 ? switches.slice(1) : switches }))
        : (routers.length ? routers : [null]).map((r, i) => ({
            prefix: `192.168.${(i + 1) * 10}.`, gw: r ? `192.168.${(i + 1) * 10}.1` : '', router: r || undefined,
            sw: switches.filter((_, k) => k % Math.max(1, routers.length) === i),
        })).filter((n) => n.sw.length);
    const nextHost = new Map<Net, number>();
    const hostIp = (n: Net, server = false) => {
        if (server) { const k = (nextHost.get(n) ?? 0); return `${n.prefix}${200 + (k % 50)}`; }
        const k = (nextHost.get(n) ?? 10) + 1; nextHost.set(n, k); return `${n.prefix}${k}`;
    };
    if (p.dhcp && !useVlans) {
        routers.forEach((r, i) => { r.dhcpPools = [{ name: `LAN${i + 1}`, network: `192.168.${(i + 1) * 10}.0`, mask: '255.255.255.0', rangeStart: `192.168.${(i + 1) * 10}.100`, rangeEnd: `192.168.${(i + 1) * 10}.199`, gateway: `192.168.${(i + 1) * 10}.1` }]; });
        notes.push('DHCP: each router hands out .100-.199 on its LAN; servers and printers keep fixed addresses.');
    } else if (p.dhcp && core) {
        core.dhcpPools = p.vlans.map((v) => ({ name: `VLAN${v}`, network: `192.168.${v % 256}.0`, mask: '255.255.255.0', rangeStart: `192.168.${v % 256}.100`, rangeEnd: `192.168.${v % 256}.199`, gateway: `192.168.${v % 256}.1` }));
        notes.push('DHCP: CORE1 hands out .100-.199 in every VLAN.');
    }

    // ---- hosts, spread round-robin over the subnets and their switches
    let hostNo = 0, serverNo = 0;
    const counters: Record<string, number> = {};
    const place = (type: string, prefix: string, kind: 'host' | 'server' | 'printer') => {
        const n = nets[hostNo % nets.length];
        hostNo++;
        const sw = n.sw[(counters[n.prefix] = (counters[n.prefix] ?? -1) + 1) % n.sw.length] || switches[0];
        const c = (counters[prefix] = (counters[prefix] ?? 0) + 1);
        const dev: SpecDevice = { hostname: `${prefix}${c}`, type, x: 0, y: 0, interfaces: [] };
        const nic = ports(type).wired[0];
        const swPort = portOf(sw);
        const fixed = kind !== 'host' || !p.dhcp;
        const ip = kind === 'server' ? `${n.prefix}${200 + serverNo++}` : kind === 'printer' ? `${n.prefix}${250 - c}` : hostIp(n);
        iface(dev, fixed ? { name: nic, ip, mask: '255.255.255.0', enabled: true } : { name: nic, dhcp: true, enabled: true });
        if (n.gw) dev.defaultGateway = n.gw;
        if (n.vlan) iface(sw, { name: swPort, mode: 'access', vlan: n.vlan, enabled: true, description: dev.hostname });
        link(sw, swPort, dev, nic);
        devices.push(dev);
        return dev;
    };
    for (let i = 0; i < p.servers; i++) place('server-generic', 'SRV', 'server');
    for (let i = 0; i < p.printers; i++) place('printer', 'PRN', 'printer');
    for (let i = 0; i < p.pcs; i++) place('pc', 'PC', 'host');

    // ---- Wi-Fi: APs on the first access switch; laptops and phones join over the air
    const ssid = 'SelfStudy-WiFi', pass = 'SelfStudy2026';
    const wifiNet = nets[0];
    for (let a = 0; a < p.aps; a++) {
        const sw = wifiNet.sw[0] || switches[0];
        const ap: SpecDevice = { hostname: `AP${a + 1}`, type: 'ap-wifi6', x: 0, y: 0, wireless: { ssid, security: 'wpa2-personal', passphrase: pass, band: '5GHz', channel: 36 + a * 4, ...(wifiNet.vlan ? { vlanId: wifiNet.vlan } : {}) }, interfaces: [] };
        const swPort = portOf(sw);
        if (wifiNet.vlan) iface(sw, { name: swPort, mode: 'access', vlan: wifiNet.vlan, enabled: true, description: ap.hostname });
        // The AP is a bridge: its wired port must be a switchport, not the routed default.
        iface(ap, { name: ports(ap.type).wired[0], mode: 'access', ...(wifiNet.vlan ? { vlan: wifiNet.vlan } : {}), enabled: true, description: 'uplink' });
        link(sw, swPort, ap, ports(ap.type).wired[0]);
        devices.push(ap);
    }
    const wirelessHost = (type: string, prefix: string, count: number) => {
        for (let i = 0; i < count; i++) {
            const dev: SpecDevice = { hostname: `${prefix}${i + 1}`, type, x: 0, y: 0, interfaces: [] };
            const radio = ports(type).wireless[0];
            if (radio && p.aps) {
                iface(dev, p.dhcp ? { name: radio, dhcp: true, ssid, passphrase: pass, enabled: true } : { name: radio, ip: hostIp(wifiNet), mask: '255.255.255.0', ssid, passphrase: pass, enabled: true });
            } else {
                // No access point: a laptop plugs into a switch like a PC.
                const n = nets[hostNo++ % nets.length];
                const sw = n.sw[0] || switches[0];
                const nic = ports(type).wired[0];
                if (!nic) continue;
                const swPort = portOf(sw);
                iface(dev, p.dhcp ? { name: nic, dhcp: true, enabled: true } : { name: nic, ip: hostIp(n), mask: '255.255.255.0', enabled: true });
                if (n.vlan) iface(sw, { name: swPort, mode: 'access', vlan: n.vlan, enabled: true, description: dev.hostname });
                link(sw, swPort, dev, nic);
                if (n.gw) dev.defaultGateway = n.gw;
                devices.push(dev);
                continue;
            }
            if (wifiNet.gw) dev.defaultGateway = wifiNet.gw;
            devices.push(dev);
        }
    };
    wirelessHost('laptop', 'LT', p.laptops);
    wirelessHost('smartphone', 'PH', p.phones);
    if (p.aps) notes.push(`Wi-Fi: SSID "${ssid}", WPA2 passphrase "${pass}".`);

    // ---- the Internet: NAT on R1 and a default route
    if (p.internet && routers.length) {
        const r1 = routers[0];
        const net: SpecDevice = { hostname: 'INTERNET', type: 'internet', x: 640, y: -40, interfaces: [{ name: ports('internet').sfp[0], ip: '203.0.113.1', mask: '255.255.255.252', enabled: true }] };
        const wan = ports(r1.type).sfp[0];
        iface(r1, { name: wan, ip: '203.0.113.2', mask: '255.255.255.252', mode: 'routed', enabled: true, natRole: 'outside', description: 'ISP' });
        for (const i of r1.interfaces || []) if (i !== r1.interfaces![r1.interfaces!.length - 1] && i.ip && i.ip.startsWith('192.168.')) i.natRole = 'inside';
        if (useVlans) (r1.interfaces || []).forEach((i) => { if (i.ip === '10.255.0.1') i.natRole = 'inside'; });
        r1.nat = { enabled: true, mode: 'pat', outsideInterface: wan, insideInterfaces: (r1.interfaces || []).filter((i) => i.natRole === 'inside').map((i) => i.name!) };
        r1.staticRoutes = [...(r1.staticRoutes || []), { network: '0.0.0.0', mask: '0.0.0.0', nextHop: '203.0.113.1' }];
        if (r1.ospf) notes.push('R1 holds the default route to the Internet; the other routers learn their LANs by OSPF (add a default route on them to reach the Internet too).');
        link(r1, wan, net, ports('internet').sfp[0], 'ISP');
        devices.push(net);
        notes.push('R1 translates the inside addresses to 203.0.113.2 (PAT) for the Internet.');
    }

    // ---- layout: routers on top, switches below, hosts in rows under their switch
    const rows = new Map<string, SpecDevice[]>();
    for (const l of links) {
        const sw = switches.find((s) => s.hostname === l.from);
        const host = devices.find((d) => d.hostname === l.to);
        if (sw && host && !switches.includes(host) && !routers.includes(host)) { const arr = rows.get(sw.hostname) || []; arr.push(host); rows.set(sw.hostname, arr); }
    }
    const swY = core ? 260 : 300;
    const flatSw = core ? switches.filter((s) => s !== core) : switches;
    flatSw.forEach((s, i) => { s.x = 160 + i * Math.max(260, 900 / Math.max(1, flatSw.length)); s.y = core ? 420 : swY; });
    for (const [name, hosts] of rows) {
        const sw = switches.find((s) => s.hostname === name)!;
        hosts.forEach((h, i) => { h.x = Math.round((sw.x ?? 0) - 120 + (i % 4) * 80); h.y = Math.round((sw.y ?? 0) + 150 + Math.floor(i / 4) * 110); });
    }
    devices.filter((d) => d.x === 0 && d.y === 0).forEach((d, i) => { d.x = 160 + i * 110; d.y = 760; });

    const hostTotal = p.pcs + p.laptops + p.servers + p.printers + p.phones;
    return {
        name: `${devices.length}-device network`,
        description: `${routers.length ? routers.length + ' router(s), ' : ''}${switches.length} switch(es), ${hostTotal} end device(s)${p.aps ? `, ${p.aps} access point(s)` : ''}${useVlans ? `, VLANs ${p.vlans.join(', ')}` : ''}${p.internet ? ', Internet via NAT' : ''}.`,
        devices,
        links,
        notes: [...notes, 'Built instantly from your request. Ask the assistant to explain any part, or run the simulator to ping between devices.'],
    };
}
