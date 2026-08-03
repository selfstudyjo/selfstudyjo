/**
 * src/netsim/ip.ts
 * IPv4 / IPv6 / MAC address maths used everywhere in the Network Simulator.
 * Pure functions, no dependencies — safe to unit test and to call inside tight
 * simulation loops.
 */

/* ─────────────────────────── IPv4 ─────────────────────────── */

export function isValidIPv4(ip: string): boolean {
    if (!ip) return false;
    const parts = ip.trim().split('.');
    if (parts.length !== 4) return false;
    return parts.every(p => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

export function ipToLong(ip: string): number {
    const p = ip.trim().split('.').map(Number);
    return (((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0);
}

export function longToIp(n: number): string {
    const v = n >>> 0;
    return `${(v >>> 24) & 255}.${(v >>> 16) & 255}.${(v >>> 8) & 255}.${v & 255}`;
}

/** Accepts a dotted mask ("255.255.255.0") or a prefix ("24" / "/24"). */
export function maskToPrefix(mask: string | number): number {
    if (typeof mask === 'number') return mask;
    const raw = String(mask).trim().replace(/^\//, '');
    if (/^\d{1,2}$/.test(raw)) return Math.min(32, Number(raw));
    if (!isValidIPv4(raw)) return 24;
    const bits = ipToLong(raw).toString(2).padStart(32, '0');
    // A legal mask is contiguous ones; count them but stop at the first zero.
    const idx = bits.indexOf('0');
    return idx === -1 ? 32 : idx;
}

export function prefixToMask(prefix: number): string {
    const p = Math.max(0, Math.min(32, Math.floor(prefix)));
    return longToIp(p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
}

/** True when the dotted mask is a legal contiguous mask. */
export function isValidMask(mask: string): boolean {
    if (!isValidIPv4(mask)) return false;
    const bits = ipToLong(mask).toString(2).padStart(32, '0');
    return /^1*0*$/.test(bits);
}

export function networkAddress(ip: string, mask: string | number): string {
    const p = maskToPrefix(mask);
    const m = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
    return longToIp((ipToLong(ip) & m) >>> 0);
}

export function broadcastAddress(ip: string, mask: string | number): string {
    const p = maskToPrefix(mask);
    const m = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
    return longToIp(((ipToLong(ip) & m) | (~m >>> 0)) >>> 0);
}

export function wildcardMask(mask: string | number): string {
    return longToIp(~ipToLong(prefixToMask(maskToPrefix(mask))) >>> 0);
}

export function sameSubnet(a: string, b: string, mask: string | number): boolean {
    if (!isValidIPv4(a) || !isValidIPv4(b)) return false;
    return networkAddress(a, mask) === networkAddress(b, mask);
}

/** Number of assignable host addresses for a prefix (/31 and /32 handled). */
export function usableHostCount(prefix: number): number {
    if (prefix >= 32) return 1;
    if (prefix === 31) return 2;
    return Math.pow(2, 32 - prefix) - 2;
}

export function firstUsableHost(ip: string, mask: string | number): string {
    const p = maskToPrefix(mask);
    if (p >= 31) return networkAddress(ip, mask);
    return longToIp(ipToLong(networkAddress(ip, mask)) + 1);
}

export function lastUsableHost(ip: string, mask: string | number): string {
    const p = maskToPrefix(mask);
    if (p >= 31) return broadcastAddress(ip, mask);
    return longToIp(ipToLong(broadcastAddress(ip, mask)) - 1);
}

export function isNetworkAddress(ip: string, mask: string | number): boolean {
    return maskToPrefix(mask) < 31 && ip === networkAddress(ip, mask);
}

export function isBroadcastAddress(ip: string, mask: string | number): boolean {
    return maskToPrefix(mask) < 31 && ip === broadcastAddress(ip, mask);
}

export function isLimitedBroadcast(ip: string): boolean {
    return ip === '255.255.255.255';
}

export function isMulticastIPv4(ip: string): boolean {
    if (!isValidIPv4(ip)) return false;
    const first = Number(ip.split('.')[0]);
    return first >= 224 && first <= 239;
}

export function isLoopbackIPv4(ip: string): boolean {
    return isValidIPv4(ip) && ip.startsWith('127.');
}

export function isLinkLocalIPv4(ip: string): boolean {
    return isValidIPv4(ip) && ip.startsWith('169.254.');
}

export function isPrivateIPv4(ip: string): boolean {
    if (!isValidIPv4(ip)) return false;
    const n = ipToLong(ip);
    const ranges: Array<[string, number]> = [
        ['10.0.0.0', 8],
        ['172.16.0.0', 12],
        ['192.168.0.0', 16],
        ['100.64.0.0', 10], // CGNAT (RFC 6598)
    ];
    return ranges.some(([net, pfx]) => {
        const m = (0xffffffff << (32 - pfx)) >>> 0;
        return (n & m) >>> 0 === (ipToLong(net) & m) >>> 0;
    });
}

/** Classful class letter — still taught, still asked about in exams. */
export function ipv4Class(ip: string): 'A' | 'B' | 'C' | 'D' | 'E' | '-' {
    if (!isValidIPv4(ip)) return '-';
    const f = Number(ip.split('.')[0]);
    if (f < 128) return 'A';
    if (f < 192) return 'B';
    if (f < 224) return 'C';
    if (f < 240) return 'D';
    return 'E';
}

/** Default classful mask, used to explain "why classless addressing exists". */
export function classfulPrefix(ip: string): number {
    switch (ipv4Class(ip)) {
        case 'A': return 8;
        case 'B': return 16;
        case 'C': return 24;
        default: return 24;
    }
}

export interface SubnetInfo {
    ip: string;
    mask: string;
    prefix: number;
    wildcard: string;
    network: string;
    broadcast: string;
    firstHost: string;
    lastHost: string;
    hosts: number;
    class: string;
    scope: 'private' | 'public' | 'loopback' | 'link-local' | 'multicast' | 'invalid';
}

export function describeSubnet(ip: string, mask: string | number): SubnetInfo {
    const prefix = maskToPrefix(mask);
    const valid = isValidIPv4(ip);
    return {
        ip,
        mask: prefixToMask(prefix),
        prefix,
        wildcard: valid ? wildcardMask(prefix) : '-',
        network: valid ? networkAddress(ip, prefix) : '-',
        broadcast: valid ? broadcastAddress(ip, prefix) : '-',
        firstHost: valid ? firstUsableHost(ip, prefix) : '-',
        lastHost: valid ? lastUsableHost(ip, prefix) : '-',
        hosts: usableHostCount(prefix),
        class: ipv4Class(ip),
        scope: !valid ? 'invalid'
            : isLoopbackIPv4(ip) ? 'loopback'
            : isLinkLocalIPv4(ip) ? 'link-local'
            : isMulticastIPv4(ip) ? 'multicast'
            : isPrivateIPv4(ip) ? 'private'
            : 'public',
    };
}

/**
 * Split a network into `count` equally sized subnets (classic VLSM teaching aid).
 */
export function splitSubnet(network: string, prefix: number, newPrefix: number): SubnetInfo[] {
    if (newPrefix <= prefix || newPrefix > 32) return [];
    const step = Math.pow(2, 32 - newPrefix);
    const total = Math.pow(2, newPrefix - prefix);
    const base = ipToLong(networkAddress(network, prefix));
    const out: SubnetInfo[] = [];
    for (let i = 0; i < Math.min(total, 4096); i++) {
        out.push(describeSubnet(longToIp(base + i * step), newPrefix));
    }
    return out;
}

/** VLSM allocator: give it host requirements, get right-sized subnets back. */
export function allocateVlsm(
    baseNetwork: string,
    basePrefix: number,
    requirements: Array<{ name: string; hosts: number }>
): Array<SubnetInfo & { name: string; requested: number }> {
    const sorted = [...requirements].sort((a, b) => b.hosts - a.hosts);
    let cursor = ipToLong(networkAddress(baseNetwork, basePrefix));
    const limit = ipToLong(broadcastAddress(baseNetwork, basePrefix));
    const out: Array<SubnetInfo & { name: string; requested: number }> = [];

    for (const req of sorted) {
        let prefix = 32;
        while (prefix > 0 && usableHostCount(prefix) < Math.max(1, req.hosts)) prefix--;
        const size = Math.pow(2, 32 - prefix);
        // align the cursor to the subnet boundary
        cursor = Math.ceil(cursor / size) * size;
        if (cursor + size - 1 > limit) break;
        out.push({ ...describeSubnet(longToIp(cursor), prefix), name: req.name, requested: req.hosts });
        cursor += size;
    }
    return out;
}

/** Longest-prefix match against a list of CIDR destinations. */
export function longestPrefixMatch<T extends { network: string; prefix: number }>(
    ip: string,
    entries: T[]
): T | null {
    let best: T | null = null;
    for (const e of entries) {
        if (e.prefix < 0 || e.prefix > 32) continue;
        const m = e.prefix === 0 ? 0 : (0xffffffff << (32 - e.prefix)) >>> 0;
        if (((ipToLong(ip) & m) >>> 0) === ((ipToLong(e.network) & m) >>> 0)) {
            if (!best || e.prefix > best.prefix) best = e;
        }
    }
    return best;
}

export function parseCidr(cidr: string): { ip: string; prefix: number } | null {
    const m = String(cidr).trim().match(/^([0-9.]+)\s*\/\s*(\d{1,2})$/);
    if (!m || !isValidIPv4(m[1])) return null;
    return { ip: m[1], prefix: Math.min(32, Number(m[2])) };
}

export function toCidr(ip: string, mask: string | number): string {
    return `${ip}/${maskToPrefix(mask)}`;
}

/* ─────────────────────────── MAC ─────────────────────────── */

const MAC_CHARS = '0123456789ABCDEF';

/** Deterministic-ish MAC with a locally administered OUI so it never clashes. */
export function randomMac(oui = '02:5A:F0'): string {
    const tail: string[] = [];
    for (let i = 0; i < 3; i++) {
        tail.push(
            MAC_CHARS[Math.floor(Math.random() * 16)] + MAC_CHARS[Math.floor(Math.random() * 16)]
        );
    }
    return `${oui}:${tail.join(':')}`.toUpperCase();
}

export function isValidMac(mac: string): boolean {
    return /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test((mac || '').trim());
}

export function normalizeMac(mac: string): string {
    return (mac || '').trim().toUpperCase().replace(/-/g, ':');
}

export const BROADCAST_MAC = 'FF:FF:FF:FF:FF:FF';

export function isBroadcastMac(mac: string): boolean {
    return normalizeMac(mac) === BROADCAST_MAC;
}

/** IPv4 multicast → Ethernet multicast mapping (01:00:5E + low 23 bits). */
export function multicastMacForIp(ip: string): string {
    const n = ipToLong(ip);
    const b1 = (n >>> 16) & 0x7f;
    const b2 = (n >>> 8) & 0xff;
    const b3 = n & 0xff;
    const hex = (v: number) => v.toString(16).padStart(2, '0').toUpperCase();
    return `01:00:5E:${hex(b1)}:${hex(b2)}:${hex(b3)}`;
}

export function isMulticastMac(mac: string): boolean {
    const first = parseInt(normalizeMac(mac).split(':')[0] || '0', 16);
    return (first & 0x01) === 0x01 && !isBroadcastMac(mac);
}

/* ─────────────────────────── IPv6 ─────────────────────────── */

export function isValidIPv6(addr: string): boolean {
    if (!addr) return false;
    const a = addr.trim();
    if (!/^[0-9a-f:]+$/i.test(a)) return false;
    if ((a.match(/::/g) || []).length > 1) return false;
    const groups = a.split(':').filter((g, i, arr) => !(g === '' && i > 0 && i < arr.length - 1) || a.includes('::'));
    if (groups.some(g => g.length > 4)) return false;
    return a.includes('::') ? a.split(':').length <= 8 : a.split(':').length === 8;
}

export function expandIPv6(addr: string): string {
    const a = addr.trim().toLowerCase();
    if (!a) return '';
    let head: string[] = [];
    let tail: string[] = [];
    if (a.includes('::')) {
        const [h, t] = a.split('::');
        head = h ? h.split(':') : [];
        tail = t ? t.split(':') : [];
    } else {
        head = a.split(':');
    }
    const fill = Array(Math.max(0, 8 - head.length - tail.length)).fill('0000');
    return [...head, ...fill, ...tail].map(g => (g || '0').padStart(4, '0')).join(':');
}

export function compressIPv6(addr: string): string {
    const groups = expandIPv6(addr).split(':').map(g => g.replace(/^0+(?=.)/, ''));
    let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
    groups.forEach((g, i) => {
        if (g === '0') {
            if (curStart === -1) curStart = i;
            curLen++;
            if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
        } else { curStart = -1; curLen = 0; }
    });
    if (bestLen < 2) return groups.join(':');
    return `${groups.slice(0, bestStart).join(':')}::${groups.slice(bestStart + bestLen).join(':')}`
        .replace(/^:{3,}/, '::');
}

/** EUI-64 interface identifier from a MAC — how SLAAC builds an address. */
export function macToEui64(mac: string): string {
    const b = normalizeMac(mac).split(':');
    if (b.length !== 6) return '';
    const flipped = (parseInt(b[0], 16) ^ 0x02).toString(16).padStart(2, '0');
    return `${flipped}${b[1]}:${b[2]}ff:fe${b[3]}:${b[4]}${b[5]}`.toLowerCase();
}

export function linkLocalIPv6(mac: string): string {
    const eui = macToEui64(mac);
    return eui ? compressIPv6(`fe80:0000:0000:0000:${eui}`) : '';
}

export function slaacAddress(prefix64: string, mac: string): string {
    const eui = macToEui64(mac);
    if (!eui) return '';
    const head = expandIPv6(prefix64).split(':').slice(0, 4).join(':');
    return compressIPv6(`${head}:${eui}`);
}

export function ipv6Scope(addr: string): string {
    const a = expandIPv6(addr);
    if (a.startsWith('fe80')) return 'link-local';
    if (/^(fc|fd)/.test(a)) return 'unique-local';
    if (a.startsWith('ff')) return 'multicast';
    if (a === '0000:0000:0000:0000:0000:0000:0000:0001') return 'loopback';
    if (a.startsWith('2') || a.startsWith('3')) return 'global-unicast';
    return 'reserved';
}

/* ───────────────────────── misc helpers ───────────────────────── */

/** 16-bit one's complement checksum, shown in the packet inspector. */
export function checksum16(bytes: number[]): string {
    let sum = 0;
    for (let i = 0; i < bytes.length; i += 2) {
        sum += ((bytes[i] << 8) | (bytes[i + 1] || 0)) >>> 0;
        if (sum > 0xffff) sum = (sum & 0xffff) + 1;
    }
    return `0x${((~sum) & 0xffff).toString(16).padStart(4, '0')}`;
}

/** Stable pseudo-checksum derived from a string, so re-runs look consistent. */
export function pseudoChecksum(seed: string): string {
    let h = 0x1505;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) & 0xffff;
    return `0x${h.toString(16).padStart(4, '0')}`;
}

export function randomEphemeralPort(): number {
    return 49152 + Math.floor(Math.random() * (65535 - 49152));
}

export function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function formatSpeed(mbps: number): string {
    if (mbps >= 1000000) return `${mbps / 1000000} Tbps`;
    if (mbps >= 1000) return `${mbps / 1000} Gbps`;
    return `${mbps} Mbps`;
}
