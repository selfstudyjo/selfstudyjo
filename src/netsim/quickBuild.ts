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
    /** Separate subnets (sites, departments, LANs), each with its own devices. 2+ = routed design. */
    subnets?: SubnetSpec[];
}

export interface SubnetSpec { name: string; pcs: number; laptops: number; servers: number; printers: number }

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

const SEG = '(?:subnets?|lans?|departments?|depts?|sites?|branch(?:es)?|floors?|offices?|segments?|teams?|labs?|buildings?|networks?)';
const HOSTWORD = '(devices?|pcs?|computers?|hosts?|users?|machines?|clients?|laptops?|workstations?|nodes?)';

/** "subnet a 5 devices, subnet b 10 devices" -> [{A,5},{B,10}]; "3 departments with 4 PCs each" -> 3x4. */
export function parseSubnets(src: string): SubnetSpec[] {
    const out: SubnetSpec[] = [];
    const mk = (name: string, n: number, word: string): SubnetSpec => {
        const laptops = /laptop/i.test(word) ? n : 0;
        return { name: name.replace(/^./, (c) => c.toUpperCase()), pcs: laptops ? 0 : n, laptops, servers: 0, printers: 0 };
    };
    // 1. "<segment> <name> [with|has|of|:] <n> <hosts>"  and  "<name> <segment> [with] <n> <hosts>"
    const named = new RegExp('\\b' + SEG + '\\s+([a-z0-9]{1,12})\\s*(?:with|has|have|of|:|=|-|contains?)?\\s*([0-9]{1,3}|[a-z]+)\\s+' + HOSTWORD, 'gi');
    for (const m of src.matchAll(named)) {
        if (/^(with|has|of|from|and|the|in|for)$/i.test(m[1])) continue;
        const n = toNumber(m[2]);
        if (n && n > 0) out.push(mk(m[1], Math.min(n, 60), m[3]));
    }
    if (out.length < 2) {
        out.length = 0;
        const named2 = new RegExp('\\b([a-z]{2,12})\\s+' + SEG + '\\s*(?:with|has|have|of|:|=|-)?\\s*([0-9]{1,3}|[a-z]+)\\s+' + HOSTWORD, 'gi');
        for (const m of src.matchAll(named2)) {
            if (/^(the|a|an|each|every|one|two|three|four|five|same|other|new|second|first)$/i.test(m[1])) continue;
            const n = toNumber(m[2]);
            if (n && n > 0) out.push(mk(m[1], Math.min(n, 60), m[3]));
        }
    }
    if (out.length >= 2) return out.slice(0, 8);
    // 2. "<k> <segments> ... <n> <hosts> each" / "<k> <segments> of|with <n> <hosts>"
    const each = new RegExp('([0-9]{1,2}|[a-z]+)\\s+' + SEG + '\\b[^.]*?([0-9]{1,3}|[a-z]+)\\s+' + HOSTWORD + '\\s*(each|per|apiece|in each)?', 'i').exec(src);
    const countOnly = new RegExp('([0-9]{1,2}|[a-z]+)\\s+' + SEG + '\\b', 'i').exec(src);
    const k = each ? toNumber(each[1]) : countOnly ? toNumber(countOnly[1]) : null;
    if (k && k >= 2 && k <= 8) {
        let per = 4;
        if (each) {
            const n = toNumber(each[2]) || 0;
            per = each[4] || /\b(of|with)\b/i.test(each[0]) ? n : Math.max(1, Math.round(n / k));
        }
        const word = each ? each[3] : 'pcs';
        const names = 'ABCDEFGH';
        return Array.from({ length: k }, (_, i) => mk(names[i], Math.min(Math.max(per, 1), 60), word));
    }
    // 3. "a head office and two branches", "main office and 3 branches"
    const branches = /(?:head|main|central)\s+office\s+and\s+([0-9]{1,2}|[a-z]+)\s+branch(?:es)?/i.exec(src);
    if (branches) {
        const n = toNumber(branches[1]) || 1;
        const per = /([0-9]{1,3}|[a-z]+)\s+(?:pcs?|computers?|hosts?|users?)\s*(?:each|per)/i.exec(src);
        const k2 = per ? toNumber(per[1]) || 3 : 3;
        return [mk('HQ', k2, 'pcs'), ...Array.from({ length: Math.min(n, 6) }, (_, i) => mk('Branch' + (i + 1), k2, 'pcs'))];
    }
    return [];
}

/** The numbers in a request, or null when it names nothing countable (then ask the model). */
export function parseNetworkRequest(text: string): QuickParams | null {
    const src = String(text || '').trim();
    if (!src) return null;
    const subnets = /vlan/i.test(src) ? [] : parseSubnets(src);
    if (subnets.length >= 2) {
        const p: QuickParams = { routers: 1, switches: subnets.length, pcs: 0, laptops: 0, servers: 0, printers: 0, phones: 0, aps: 0,
            vlans: [], internet: /\b(internet|wan|isp|online|nat)\b|انترنت|إنترنت/i.test(src), dhcp: /\bdhcp\b/i.test(src), firewall: false, subnets };
        // Servers or printers named once ("and a file server") go to the first subnet.
        const srv = /([0-9]{1,2}|a|an|one|two|three)\s+(?:[a-z]+\s+)?servers?\b/i.exec(src);
        if (srv) subnets[0].servers += toNumber(srv[1]) || 1;
        const prn = /([0-9]{1,2}|a|an|one|two)\s+printers?\b/i.exec(src);
        if (prn) subnets[0].printers += toNumber(prn[1]) || 1;
        return p;
    }
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
    if (!p.vlans.length) {
        const namedV = /((?:[a-z]+(?:\s*,\s*|\s+and\s+))+[a-z]+)\s+vlans\b/i.exec(src) || /vlans?\s+(?:for|called|named)\s+((?:[a-z]+(?:\s*,\s*|\s+and\s+))+[a-z]+)/i.exec(src);
        if (namedV) { const n = namedV[1].split(/\s*,\s*|\s+and\s+/).filter(Boolean).length; if (n >= 2) p.vlans = Array.from({ length: Math.min(n, 8) }, (_, i) => (i + 1) * 10); }
    }
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
    if (Array.isArray(x.subnets) && x.subnets.length >= 2) {
        p.subnets = x.subnets.slice(0, 8).map((sn: any, i: number) => ({
            name: String(sn?.name || 'ABCDEFGH'[i]).replace(/[^\w -]/g, '').slice(0, 16) || 'ABCDEFGH'[i],
            pcs: n(sn?.pcs ?? sn?.devices ?? sn?.hosts, 60), laptops: n(sn?.laptops, 30), servers: n(sn?.servers, 8), printers: n(sn?.printers, 4),
        }));
        p.subnets.forEach((sn) => { if (sn.pcs + sn.laptops + sn.servers + sn.printers === 0) sn.pcs = 3; });
        p.routers = Math.max(p.routers, 1);
        p.vlans = [];
        return p;
    }
    if (p.vlans.length === 1) p.vlans = [];
    const hosts = p.pcs + p.laptops + p.servers + p.printers + p.phones;
    if ((hosts || p.aps) && !p.switches) p.switches = Math.max(1, Math.ceil((hosts + p.aps) / 22));
    if ((p.internet || p.firewall || p.vlans.length) && !p.routers) p.routers = 1;
    return p.routers + p.switches + hosts + p.aps ? p : null;
}

/** The prompt that asks a model for parameters only (used when the text parser finds nothing). */
export const PARAMS_PROMPT = `You turn a student's request for a computer network into numbers. A program then builds the network, so you never design addresses or cables yourself.
Reply with ONE JSON object and nothing else, with exactly these keys:
{"routers":0,"switches":0,"pcs":0,"laptops":0,"servers":0,"printers":0,"phones":0,"aps":0,"vlans":[],"subnets":[],"internet":false,"dhcp":false,"firewall":false}
Rules:
- "subnets" lists SEPARATE networks joined by routing (sites, departments, branches, floors, "subnet A / subnet B"): [{"name":"A","pcs":5,"laptops":0,"servers":0,"printers":0}, ...]. Use it whenever the request has two or more groups of devices. Each group's devices go INSIDE its entry, not in the top-level counts.
- "vlans" lists VLAN ids (10, 20, 30...) only when the request says VLAN.
- "devices", "computers", "hosts", "users" mean pcs. A switch or router named in the request counts in routers/switches.
- internet true when it mentions Internet, WAN, ISP or NAT. aps = Wi-Fi access points (1 when it says Wi-Fi or wireless).
- When the request only describes a place, choose sensible numbers.
Examples:
"two subnets, A with 5 devices and B with 10" -> {"routers":1,"switches":2,"pcs":0,"laptops":0,"servers":0,"printers":0,"phones":0,"aps":0,"vlans":[],"subnets":[{"name":"A","pcs":5,"laptops":0,"servers":0,"printers":0},{"name":"B","pcs":10,"laptops":0,"servers":0,"printers":0}],"internet":false,"dhcp":false,"firewall":false}
"a small office with internet" -> {"routers":1,"switches":1,"pcs":6,"laptops":0,"servers":0,"printers":1,"phones":0,"aps":1,"vlans":[],"subnets":[],"internet":true,"dhcp":true,"firewall":false}
"sales, HR and IT departments, 4 pcs each and a file server for IT" -> {"routers":1,"switches":3,"pcs":0,"laptops":0,"servers":0,"printers":0,"phones":0,"aps":0,"vlans":[],"subnets":[{"name":"Sales","pcs":4,"laptops":0,"servers":0,"printers":0},{"name":"HR","pcs":4,"laptops":0,"servers":0,"printers":0},{"name":"IT","pcs":4,"laptops":0,"servers":1,"printers":0}],"internet":false,"dhcp":false,"firewall":false}
"a school lab: 20 computers, a printer and wifi" -> {"routers":1,"switches":1,"pcs":20,"laptops":0,"servers":0,"printers":1,"phones":0,"aps":1,"vlans":[],"subnets":[],"internet":false,"dhcp":false,"firewall":false}`;

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

/**
 * Two or more subnets joined by routing. Up to the router's free ports: one router, one port per
 * subnet. More subnets, or the Internet as well: an L3 core switch routes between them (a VLAN and
 * an SVI per subnet, one access switch each), and the router faces the Internet.
 */
function buildSubnetSpec(p: QuickParams, subnets: SubnetSpec[]): AiTopologySpec {
    const devices: SpecDevice[] = [];
    const links: AiTopologySpec['links'] = [];
    const notes: string[] = [];
    const used = new Map<string, number>();
    const take = (d: SpecDevice) => { const list = ports(d.type).wired; const i = used.get(d.hostname) ?? 0; used.set(d.hostname, i + 1); return list[i]; };
    const add = (d: SpecDevice, x: NonNullable<SpecDevice['interfaces']>[number]) => { (d.interfaces ||= []).push(x); };
    const link = (a: SpecDevice, ai: string, b: SpecDevice, bi: string, label?: string) => links.push({ from: a.hostname, fromInterface: ai, to: b.hostname, toInterface: bi, label });
    const routerType = p.internet ? 'router-edge' : 'router-branch';
    const routed = !p.internet && subnets.length <= ports('router-branch').wired.length;
    const counters: Record<string, number> = {};
    const name = (prefix: string) => `${prefix}${(counters[prefix] = (counters[prefix] || 0) + 1)}`;

    const r1: SpecDevice = { hostname: 'R1', type: routed ? 'router-branch' : routerType, x: 640, y: 90, notes: routed ? 'Routes between the subnets' : 'Internet edge', interfaces: [] };
    devices.push(r1);
    let core: SpecDevice | null = null;
    if (!routed) {
        core = { hostname: 'CORE1', type: 'switch-l3', x: 640, y: 240, notes: 'Routes between the subnets (one SVI each)', vlans: subnets.map((_, i) => ({ id: (i + 1) * 10, name: subnets[i].name.toUpperCase() })), interfaces: [] };
        devices.push(core);
        const rp = ports(r1.type).wired[0], cp = take(core);
        add(r1, { name: rp, ip: '10.255.0.1', mask: '255.255.255.252', mode: 'routed', enabled: true, description: 'to CORE1' });
        add(core, { name: cp, ip: '10.255.0.2', mask: '255.255.255.252', mode: 'routed', enabled: true, description: 'to R1' });
        link(r1, rp, core, cp, 'routed 10.255.0.0/30');
        core.staticRoutes = [{ network: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.255.0.1' }];
        r1.staticRoutes = [];
    }

    const hostTotalOf = (sn: SubnetSpec) => sn.pcs + sn.laptops + sn.servers + sn.printers;
    subnets.forEach((sn, i) => {
        const third = (i + 1) * 10;
        const net = `192.168.${third}.`, gw = net + '1', vlan = third;
        const swX = 140 + i * Math.max(260, 1100 / subnets.length);
        let sw: SpecDevice = { hostname: name('SW'), type: 'switch-24', x: swX, y: core ? 400 : 280, notes: `Subnet ${sn.name}: ${net}0/24`, interfaces: [] };
        devices.push(sw);
        const swUp = ports(sw.type).wired[ports(sw.type).wired.length - 1];
        if (core) {
            add(core, { sviVlan: vlan, ip: gw, mask: '255.255.255.0', enabled: true, description: `Gateway subnet ${sn.name}` });
            const cp = take(core);
            add(core, { name: cp, mode: 'access', vlan, enabled: true, description: `Subnet ${sn.name}` });
            add(sw, { name: swUp, mode: 'access', vlan, enabled: true, description: 'uplink' });
            sw.vlans = [{ id: vlan, name: sn.name.toUpperCase() }];
            link(core, cp, sw, swUp, `subnet ${sn.name}`);
            r1.staticRoutes!.push({ network: net + '0', mask: '255.255.255.0', nextHop: '10.255.0.2' });
        } else {
            const rp = ports(r1.type).wired[i];
            add(r1, { name: rp, ip: gw, mask: '255.255.255.0', mode: 'routed', enabled: true, description: `Subnet ${sn.name}` });
            link(r1, rp, sw, swUp, `subnet ${sn.name}`);
        }
        if (p.dhcp) (core || r1).dhcpPools = [...((core || r1).dhcpPools || []), { name: sn.name.toUpperCase(), network: net + '0', mask: '255.255.255.0', rangeStart: net + '100', rangeEnd: net + '199', gateway: gw }];
        // hosts
        let host = 10, k = 0;
        const plug = (type: string, prefix: string, ip: string) => {
            if ((used.get(sw.hostname) ?? 0) >= ports(sw.type).wired.length - 2) {
                // Out of ports: a further switch in the same subnet.
                const more: SpecDevice = { hostname: name('SW'), type: 'switch-24', x: sw.x! + 120, y: sw.y! + 60, interfaces: [] };
                devices.push(more);
                const a = take(sw), b = ports(more.type).wired[ports(more.type).wired.length - 1];
                if (core) { add(sw, { name: a, mode: 'access', vlan, enabled: true }); add(more, { name: b, mode: 'access', vlan, enabled: true }); }
                link(sw, a, more, b, 'uplink');
                sw = more;
            }
            const dev: SpecDevice = { hostname: name(prefix), type, x: Math.round(sw.x! - 140 + (k % 4) * 90), y: Math.round(sw.y! + 150 + Math.floor(k / 4) * 105), interfaces: [] };
            k++;
            const nic = ports(type).wired[0], sp = take(sw);
            add(dev, p.dhcp && prefix !== 'SRV' && prefix !== 'PRN' ? { name: nic, dhcp: true, enabled: true } : { name: nic, ip, mask: '255.255.255.0', enabled: true });
            dev.defaultGateway = gw;
            if (core) add(sw, { name: sp, mode: 'access', vlan, enabled: true, description: dev.hostname });
            link(sw, sp, dev, nic);
            devices.push(dev);
        };
        for (let j = 0; j < sn.servers; j++) plug('server-generic', 'SRV', net + (200 + j));
        for (let j = 0; j < sn.printers; j++) plug('printer', 'PRN', net + (250 - j));
        for (let j = 0; j < sn.pcs; j++) plug('pc', 'PC', net + (++host));
        for (let j = 0; j < sn.laptops; j++) plug('laptop', 'LT', net + (++host));
        notes.push(`Subnet ${sn.name}: ${net}0/24, gateway ${gw}, ${hostTotalOf(sn)} device(s), switch ${sw.hostname}.`);
    });

    if (p.internet) {
        const net: SpecDevice = { hostname: 'INTERNET', type: 'internet', x: 640, y: -60, interfaces: [{ name: ports('internet').sfp[0], ip: '203.0.113.1', mask: '255.255.255.252', enabled: true }] };
        const wan = ports(r1.type).sfp[0];
        add(r1, { name: wan, ip: '203.0.113.2', mask: '255.255.255.252', mode: 'routed', enabled: true, natRole: 'outside', description: 'ISP' });
        (r1.interfaces || []).forEach((i) => { if (i.ip && i.ip !== '203.0.113.2') i.natRole = 'inside'; });
        r1.nat = { enabled: true, mode: 'pat', outsideInterface: wan, insideInterfaces: (r1.interfaces || []).filter((i) => i.natRole === 'inside').map((i) => i.name!) };
        r1.staticRoutes = [...(r1.staticRoutes || []), { network: '0.0.0.0', mask: '0.0.0.0', nextHop: '203.0.113.1' }];
        link(r1, wan, net, ports('internet').sfp[0], 'ISP');
        devices.push(net);
        notes.push('R1 reaches the Internet and translates every subnet to 203.0.113.2 (PAT).');
    }
    notes.unshift(routed
        ? `R1 has one port in each subnet, so it routes between them: every device can reach every device in both subnets.`
        : `CORE1 routes between the subnets (one VLAN and gateway SVI per subnet), so every device can reach every device.`);
    const total = subnets.reduce((a, sn) => a + hostTotalOf(sn), 0);
    return {
        name: `${subnets.length} subnets, ${total} devices`,
        description: subnets.map((sn) => `subnet ${sn.name}: ${hostTotalOf(sn)} device(s)`).join(', ') + (p.internet ? ', Internet via NAT' : '') + '.',
        devices, links, notes,
    };
}

/** Build the topology for the parameters. Deterministic: the same request, the same network. */
export function buildQuickSpec(p: QuickParams): AiTopologySpec {
    if (p.subnets && p.subnets.length >= 2) return buildSubnetSpec(p, p.subnets);
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
