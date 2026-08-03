/**
 * src/netsim/cli.ts
 * A Cisco-flavoured CLI for infrastructure devices and a Windows/Linux-flavoured
 * shell for hosts. Real command syntax matters: a student who learns
 * `switchport mode trunk` here can type it on real hardware tomorrow.
 *
 * Every command that changes state mutates the topology and triggers a
 * recompute, so `show ip route` reflects the change immediately.
 */

import type { CliLine, CliSession, Device, NetInterface, Acl } from './types';
import type { Simulator } from './engine';
import { roleOf } from './engine';
import { getDeviceType, isL3Forwarder, isL2Forwarder } from './devices';
import { isValidIPv4, isValidMask, maskToPrefix, networkAddress, describeSubnet } from './ip';
import { addVlan, addSvi, addStaticRoute, addDhcpPool, addDnsRecord, addAcl } from './topology';

let lineSeq = 0;
function ln(kind: CliLine['kind'], text: string): CliLine {
    lineSeq += 1;
    return { id: `cl-${lineSeq}`, kind, text };
}

export function createSession(deviceId: string): CliSession {
    return {
        deviceId,
        mode: 'user',
        history: [],
        historyIndex: -1,
        lines: [],
    };
}

export function isHostShell(device: Device): boolean {
    const role = roleOf(device);
    return role === 'host' || role === 'server' || role === 'nas' || role === 'loadbalancer';
}

export function prompt(session: CliSession, device: Device): string {
    if (isHostShell(device)) return `C:\\Users\\${device.hostname}>`;
    const h = device.hostname;
    switch (session.mode) {
        case 'user': return `${h}>`;
        case 'privileged': return `${h}#`;
        case 'config': return `${h}(config)#`;
        case 'config-if': {
            const i = device.interfaces.find(x => x.id === session.contextInterfaceId);
            return `${h}(config-if${i ? `` : ''})#`;
        }
        case 'config-vlan': return `${h}(config-vlan)#`;
        case 'config-line': return `${h}(config-line)#`;
        case 'config-router': return `${h}(config-router)#`;
        case 'config-dhcp': return `${h}(dhcp-config)#`;
        default: return `${h}#`;
    }
}

export function banner(device: Device): CliLine[] {
    const type = getDeviceType(device.typeId);
    if (isHostShell(device)) {
        return [
            ln('info', `SelfStudy JO Network Simulator — ${device.hostname} (${type?.name})`),
            ln('output', 'Microsoft Windows [Version 10.0.26100.4652]'),
            ln('output', ''),
            ln('info', `Try: ipconfig /all · ping <ip|name> · tracert <ip> · nslookup <name> · arp -a · curl http://<host> · help`),
            ln('output', ''),
        ];
    }
    return [
        ln('info', `SelfStudy JO Network Simulator — ${device.hostname} (${type?.name})`),
        ln('output', `IOS-XE Software, Version 17.15.1 [simulated]`),
        ln('output', `${type?.name} with ${device.interfaces.length} interfaces`),
        ln('output', ''),
        ln('info', `Type "enable" to enter privileged mode, then "configure terminal". "?" lists commands.`),
        ln('output', ''),
    ];
}

/* ══════════════════════════ dispatcher ══════════════════════════ */

export function execute(sim: Simulator, session: CliSession, raw: string): CliLine[] {
    const device = sim.device(session.deviceId);
    if (!device) return [ln('error', '% Device no longer exists')];

    const input = raw.trim();
    if (input) {
        session.history.push(input);
        session.historyIndex = session.history.length;
    }
    if (!input) return [];

    const out: CliLine[] = [ln('prompt', `${prompt(session, device)} ${input}`)];

    try {
        const result = isHostShell(device)
            ? hostShell(sim, session, device, input)
            : iosShell(sim, session, device, input);
        out.push(...result);
    } catch (e: any) {
        out.push(ln('error', `% Command failed: ${e?.message || e}`));
    }
    return out;
}

/* ══════════════════════════ host shell ══════════════════════════ */

function hostShell(sim: Simulator, session: CliSession, d: Device, input: string): CliLine[] {
    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
        case 'help':
        case '?':
            return [
                ln('info', 'Available commands'),
                ln('output', '  ipconfig [/all | /renew | /release]   show or refresh IP configuration'),
                ln('output', '  ping <ip|hostname> [-n count]         test reachability with ICMP'),
                ln('output', '  tracert <ip|hostname>                 discover the path hop by hop'),
                ln('output', '  nslookup <hostname>                   resolve a name through DNS'),
                ln('output', '  arp -a                                show the local ARP cache'),
                ln('output', '  route print                           show the host routing table'),
                ln('output', '  netstat                               show sockets and listeners'),
                ln('output', '  curl <url>                            fetch a page over HTTP/HTTPS'),
                ln('output', '  getmac                                show interface MAC addresses'),
                ln('output', '  set ip <iface> <ip> <mask> [gw]       configure statically'),
                ln('output', '  set dns <ip>                          set the DNS resolver'),
                ln('output', '  set wifi <ssid> <passphrase>          join a wireless network'),
                ln('output', '  clear                                 clear the screen'),
            ];

        case 'clear':
        case 'cls':
            session.lines = [];
            return [];

        case 'ipconfig':
        case 'ifconfig': {
            if (args[0]?.toLowerCase() === '/renew' || args[0]?.toLowerCase() === '/renew6') {
                const r = sim.dhcpRequest(d.id);
                return r.lines.map(l => ln(r.ok ? 'output' : 'error', l));
            }
            if (args[0]?.toLowerCase() === '/release') {
                d.interfaces.forEach(i => { if (i.dhcp) { i.ipv4 = ''; } });
                sim.recompute();
                return [ln('output', 'DHCP lease released. All DHCP interfaces now have no address.')];
            }
            const all = args[0]?.toLowerCase() === '/all';
            const out: CliLine[] = [ln('output', ''), ln('info', `Windows IP Configuration`)];
            if (all) {
                out.push(ln('output', `   Host Name . . . . . . . . . . . . : ${d.hostname}`));
                out.push(ln('output', `   DNS Servers . . . . . . . . . . . : ${d.host.dnsServer || '(none)'}`));
                out.push(ln('output', `   DHCP Enabled. . . . . . . . . . . : ${d.host.dhcp ? 'Yes' : 'No'}`));
            }
            out.push(ln('output', ''));
            for (const st of sim.interfaceStatus(d.id)) {
                const i = st.iface;
                if (i.medium === 'console') continue;
                out.push(ln('info', `${i.medium === 'wireless' ? 'Wireless LAN adapter' : i.medium === 'cellular' ? 'Cellular adapter' : 'Ethernet adapter'} ${i.short}:`));
                out.push(ln('output', `   Connection state. . . . . . . . . : ${st.status}${st.linkTo ? ` → ${st.linkTo}` : ''}`));
                if (all) out.push(ln('output', `   Physical Address. . . . . . . . . : ${i.mac}`));
                if (i.medium === 'wireless') out.push(ln('output', `   SSID. . . . . . . . . . . . . . . : ${i.ssid || '(not associated)'}`));
                out.push(ln('output', `   DHCP Enabled. . . . . . . . . . . : ${i.dhcp ? 'Yes' : 'No'}`));
                out.push(ln(i.ipv4 ? 'output' : 'error', `   IPv4 Address. . . . . . . . . . . : ${i.ipv4 || '(none)'}`));
                out.push(ln('output', `   Subnet Mask . . . . . . . . . . . : ${i.ipv4 ? i.mask : '(none)'}`));
                out.push(ln('output', `   Default Gateway . . . . . . . . . : ${d.host.defaultGateway || '(none)'}`));
                if (all && i.ipv4 && isValidIPv4(i.ipv4)) {
                    const s = describeSubnet(i.ipv4, i.mask);
                    out.push(ln('info', `   → network ${s.network}/${s.prefix}, usable ${s.firstHost}–${s.lastHost}, broadcast ${s.broadcast}, ${s.hosts} hosts, ${s.scope}`));
                }
                out.push(ln('output', ''));
            }
            return out;
        }

        case 'getmac':
            return [
                ln('output', 'Physical Address     Transport Name'),
                ln('output', '==================== =========================='),
                ...d.interfaces.filter(i => i.medium !== 'console').map(i => ln('output', `${i.mac.padEnd(20)} ${i.short} (${i.medium})`)),
            ];

        case 'ping': {
            const target = args.find(a => !a.startsWith('-'));
            if (!target) return [ln('error', 'Usage: ping <ip|hostname> [-n count]')];
            const nIdx = args.indexOf('-n');
            const count = nIdx >= 0 ? Math.min(20, Math.max(1, Number(args[nIdx + 1]) || 4)) : 4;
            const r = sim.ping(d.id, target, { count });
            return r.lines.map(l => ln(l.startsWith('Reply') ? 'success' : l.includes('timed out') || l.includes('unreachable') ? 'error' : 'output', l));
        }

        case 'tracert':
        case 'traceroute': {
            if (!args[0]) return [ln('error', 'Usage: tracert <ip|hostname>')];
            const r = sim.traceroute(d.id, args[0]);
            return r.lines.map(l => ln(l.includes('timed out') ? 'error' : 'output', l));
        }

        case 'nslookup':
        case 'dig': {
            if (!args[0]) return [ln('error', 'Usage: nslookup <hostname>')];
            const r = sim.dnsResolve(d.id, args[0]);
            return [...r.lines.map(l => ln(r.ok ? 'output' : 'error', l)), ...(r.ok ? [] : [ln('info', r.reason || '')])];
        }

        case 'arp': {
            const entries = d.arpTable || [];
            if (!entries.length) return [ln('output', 'No ARP Entries Found. Send some traffic first — ARP is populated on demand.')];
            return [
                ln('output', 'Interface: ' + (d.interfaces.find(i => i.ipv4)?.ipv4 || '')),
                ln('output', '  Internet Address      Physical Address      Type'),
                ...entries.map(e => ln('output', `  ${e.ip.padEnd(21)} ${e.mac.padEnd(21)} ${e.type}`)),
            ];
        }

        case 'route': {
            const out: CliLine[] = [ln('info', 'IPv4 Route Table'), ln('output', '='.repeat(66)),
                ln('output', 'Network Destination        Netmask          Gateway       Interface')];
            for (const i of d.interfaces) {
                if (!i.ipv4 || !isValidIPv4(i.ipv4)) continue;
                out.push(ln('output', `${networkAddress(i.ipv4, i.mask).padEnd(26)} ${i.mask.padEnd(16)} ${'On-link'.padEnd(13)} ${i.ipv4}`));
            }
            if (d.host.defaultGateway) {
                out.push(ln('output', `${'0.0.0.0'.padEnd(26)} ${'0.0.0.0'.padEnd(16)} ${d.host.defaultGateway.padEnd(13)} ${d.interfaces.find(i => i.ipv4)?.ipv4 || ''}`));
            }
            out.push(ln('info', 'A host routing table is tiny: its own subnets, plus a default route to the gateway.'));
            return out;
        }

        case 'netstat': {
            const listeners: string[] = [];
            const s = d.services;
            if (s.http.enabled) listeners.push(`  TCP    0.0.0.0:${s.http.port}          LISTENING   (HTTP)`);
            if (s.http.tls) listeners.push('  TCP    0.0.0.0:443            LISTENING   (HTTPS)');
            if (s.dns.enabled) listeners.push('  UDP    0.0.0.0:53             LISTENING   (DNS)');
            if (s.dhcp.enabled) listeners.push('  UDP    0.0.0.0:67             LISTENING   (DHCP)');
            if (s.smtp.enabled) listeners.push(`  TCP    0.0.0.0:${s.smtp.port}           LISTENING   (SMTP)`);
            if (s.ftp.enabled) listeners.push(`  TCP    0.0.0.0:${s.ftp.port}           LISTENING   (FTP)`);
            if (s.mqtt.enabled) listeners.push(`  TCP    0.0.0.0:${s.mqtt.port}         LISTENING   (MQTT)`);
            return [
                ln('info', 'Active Connections'),
                ln('output', '  Proto  Local Address          State       Service'),
                ...(listeners.length ? listeners.map(l => ln('output', l)) : [ln('output', '  (nothing is listening on this host)')]),
                ln('info', 'A port is "open" only because a process is listening on it. Enable services in the properties panel.'),
            ];
        }

        case 'curl':
        case 'wget':
        case 'http': {
            if (!args[0]) return [ln('error', 'Usage: curl http://<host>[/path]')];
            const r = sim.httpGet(d.id, args[0].includes('://') ? args[0] : `http://${args[0]}`);
            return r.lines.map(l => ln(r.ok && l.includes('200 OK') ? 'success' : r.ok ? 'output' : 'error', l));
        }

        case 'set': {
            const what = (args[0] || '').toLowerCase();
            if (what === 'ip') {
                const [, name, ip, mask, gw] = args;
                const i = findIface(d, name);
                if (!i) return [ln('error', `% No interface named "${name}". Try: ${d.interfaces.map(x => x.short).join(', ')}`)];
                if (!isValidIPv4(ip)) return [ln('error', `% "${ip}" is not a valid IPv4 address`)];
                if (!isValidMask(mask)) return [ln('error', `% "${mask}" is not a valid subnet mask`)];
                i.ipv4 = ip; i.mask = mask; i.dhcp = false;
                d.host.dhcp = false;
                if (gw) {
                    if (!isValidIPv4(gw)) return [ln('error', `% "${gw}" is not a valid gateway`)];
                    d.host.defaultGateway = gw;
                }
                sim.recompute();
                const s = describeSubnet(ip, mask);
                return [
                    ln('success', `${i.short} configured: ${ip}/${s.prefix}`),
                    ln('info', `Network ${s.network}/${s.prefix} · usable ${s.firstHost}–${s.lastHost} · broadcast ${s.broadcast}${gw ? ` · gateway ${gw}` : ''}`),
                ];
            }
            if (what === 'dns') {
                if (!isValidIPv4(args[1])) return [ln('error', '% Usage: set dns <ip>')];
                d.host.dnsServer = args[1];
                return [ln('success', `DNS resolver set to ${args[1]}`)];
            }
            if (what === 'gateway' || what === 'gw') {
                if (!isValidIPv4(args[1])) return [ln('error', '% Usage: set gateway <ip>')];
                d.host.defaultGateway = args[1];
                sim.recompute();
                return [ln('success', `Default gateway set to ${args[1]}`)];
            }
            if (what === 'wifi') {
                const ssid = args[1], pass = args.slice(2).join(' ');
                const w = d.interfaces.find(i => i.medium === 'wireless');
                if (!w) return [ln('error', '% This device has no wireless interface')];
                if (!ssid) return [ln('error', '% Usage: set wifi <ssid> <passphrase>')];
                w.ssid = ssid; w.passphrase = pass; w.enabled = true;
                sim.recompute();
                const joined = sim.allLinks.some(l => l.aInterfaceId === w.id || l.bInterfaceId === w.id);
                return joined
                    ? [ln('success', `Associated to "${ssid}".`), ln('info', 'Association is Layer 2. Run "ipconfig /renew" to get an address.')]
                    : [ln('error', `Could not associate to "${ssid}".`), ln('info', 'Check that an access point is broadcasting that SSID, that it is powered on, and that the passphrase matches exactly.')];
            }
            if (what === 'dhcp') {
                d.interfaces.forEach(i => { if (i.medium !== 'console') i.dhcp = true; });
                d.host.dhcp = true;
                return [ln('success', 'Interfaces set to obtain an address automatically. Run "ipconfig /renew".')];
            }
            return [ln('error', '% Usage: set ip|dns|gateway|wifi|dhcp ...')];
        }

        case 'hostname':
            if (!args[0]) return [ln('output', d.hostname)];
            d.hostname = args.join('-').slice(0, 24);
            return [ln('success', `Hostname changed to ${d.hostname}`)];

        default:
            return [ln('error', `'${cmd}' is not recognized as an internal or external command.`), ln('info', 'Type "help" for the command list.')];
    }
}

/* ══════════════════════════ IOS-style shell ══════════════════════════ */

function iosShell(sim: Simulator, session: CliSession, d: Device, input: string): CliLine[] {
    const lower = input.toLowerCase();
    const parts = input.split(/\s+/);
    const tokens = lower.split(/\s+/);

    // Global navigation
    if (lower === '?' || lower === 'help') return helpFor(session);
    if (lower === 'end') { session.mode = 'privileged'; session.contextInterfaceId = undefined; return []; }
    if (lower === 'exit' || lower === 'quit') {
        switch (session.mode) {
            case 'config-if': case 'config-vlan': case 'config-line': case 'config-router': case 'config-dhcp':
                session.mode = 'config'; session.contextInterfaceId = undefined; session.contextVlanId = undefined;
                session.contextPoolId = undefined; session.contextRouter = undefined; return [];
            case 'config': session.mode = 'privileged'; return [];
            case 'privileged': session.mode = 'user'; return [];
            default: return [ln('info', 'Connection to the console closed. Reopen the terminal to continue.')];
        }
    }
    if (lower === 'clear' || lower === 'cls') { session.lines = []; return []; }

    // User → privileged
    if (session.mode === 'user') {
        if (tokens[0] === 'enable' || tokens[0] === 'en') { session.mode = 'privileged'; return []; }
        if (tokens[0] === 'ping' || tokens[0] === 'traceroute' || tokens[0] === 'show') {
            return runPrivileged(sim, session, d, input);
        }
        return [ln('error', '% Invalid input detected. Type "enable" first — most commands need privileged mode.')];
    }

    if (session.mode === 'privileged') return runPrivileged(sim, session, d, input);
    if (session.mode === 'config') return runConfig(sim, session, d, input, parts);
    if (session.mode === 'config-if') return runConfigIf(sim, session, d, input, parts);
    if (session.mode === 'config-vlan') return runConfigVlan(session, d, parts);
    if (session.mode === 'config-router') return runConfigRouter(sim, session, d, parts);
    if (session.mode === 'config-dhcp') return runConfigDhcp(session, d, parts);
    if (session.mode === 'config-line') {
        if (tokens[0] === 'password' || tokens[0] === 'login') return [ln('success', 'Line configuration accepted (simulated).')];
        return [ln('error', '% Invalid input in line configuration mode')];
    }
    return [ln('error', '% Unknown mode')];
}

/* ─────────────── privileged mode ─────────────── */

function runPrivileged(sim: Simulator, session: CliSession, d: Device, input: string): CliLine[] {
    const parts = input.split(/\s+/);
    const t = input.toLowerCase().split(/\s+/);

    if (t[0] === 'configure' || t[0] === 'conf') {
        session.mode = 'config';
        return [ln('output', 'Enter configuration commands, one per line.  End with CNTL/Z.')];
    }
    if (t[0] === 'disable') { session.mode = 'user'; return []; }
    if (t[0] === 'write' || (t[0] === 'copy' && t[1]?.startsWith('run'))) {
        return [ln('output', 'Building configuration...'), ln('success', '[OK]'), ln('info', 'In this simulator the topology is saved to your GitHub project, not to NVRAM — use the Save button.')];
    }
    if (t[0] === 'reload') {
        d.macTable = []; d.arpTable = [];
        sim.recompute();
        return [ln('output', 'Proceed with reload? [confirm]'), ln('success', `${d.hostname} reloaded. Dynamic tables cleared; the configuration is intact.`)];
    }
    if (t[0] === 'ping') {
        if (!parts[1]) return [ln('error', '% Usage: ping <ip|hostname>')];
        const r = sim.ping(d.id, parts[1], { count: 5 });
        return [
            ln('output', `Type escape sequence to abort.`),
            ln('output', `Sending 5, 100-byte ICMP Echos to ${parts[1]}, timeout is 2 seconds:`),
            ln(r.ok ? 'success' : 'error', r.ok ? '!!!!!' : '.....'),
            ln('output', r.ok
                ? `Success rate is 100 percent (5/5), round-trip min/avg/max = ${r.minMs}/${r.avgMs}/${r.maxMs} ms`
                : `Success rate is 0 percent (0/5)`),
            ...(r.reason ? [ln('info', r.reason)] : []),
        ];
    }
    if (t[0] === 'traceroute') {
        if (!parts[1]) return [ln('error', '% Usage: traceroute <ip|hostname>')];
        const r = sim.traceroute(d.id, parts[1]);
        return r.lines.map(l => ln(l.includes('timed out') ? 'error' : 'output', l));
    }
    if (t[0] === 'clear') {
        if (t[1] === 'mac' || t[1]?.startsWith('mac-add')) { d.macTable = []; return [ln('success', 'MAC address table cleared. It will refill as frames arrive.')]; }
        if (t[1] === 'arp' || t[1] === 'arp-cache') { d.arpTable = []; return [ln('success', 'ARP cache cleared.')]; }
        if (t[1] === 'ip' && t[2] === 'nat') { if (d.nat) d.nat.translations = []; return [ln('success', 'NAT translation table cleared.')]; }
        if (t[1] === 'counters') { d.interfaces.forEach(i => i.counters = { txFrames: 0, rxFrames: 0, txBytes: 0, rxBytes: 0, drops: 0 }); return [ln('success', 'Interface counters cleared.')]; }
        return [ln('error', '% Usage: clear mac address-table | arp | ip nat translation | counters')];
    }
    if (t[0] === 'show' || t[0] === 'sh') return runShow(sim, d, parts.slice(1));

    return [ln('error', `% Invalid input detected at "${parts[0]}". Type "?" for help.`)];
}

/* ─────────────── show commands ─────────────── */

function runShow(sim: Simulator, d: Device, args: string[]): CliLine[] {
    const a = args.map(x => x.toLowerCase());
    const j = a.join(' ');
    const type = getDeviceType(d.typeId);

    if (!a.length) return [ln('error', '% Incomplete command. Try: show ip interface brief')];

    if (j.startsWith('version')) {
        return [
            ln('output', 'SelfStudy JO Network Simulator, IOS-XE Software Version 17.15.1 [simulated]'),
            ln('output', `${type?.name}`),
            ln('output', `${d.hostname} uptime is 3 days, 7 hours, 12 minutes`),
            ln('output', `${d.interfaces.length} interfaces, highest port speed ${Math.max(...d.interfaces.map(i => i.speedMbps))} Mbps`),
            ln('output', `Device role: ${roleOf(d)} · operates up to OSI layer ${type?.layer}`),
            ln('output', 'Configuration register is 0x2102'),
        ];
    }

    if (j === 'ip interface brief' || j === 'ip int brief' || j === 'ip int br') {
        const rows = sim.interfaceStatus(d.id).filter(s => s.iface.medium !== 'console');
        return [
            ln('output', 'Interface              IP-Address      OK? Method Status                Protocol'),
            ...rows.map(s => {
                const i = s.iface;
                const status = !i.enabled ? 'administratively down' : s.status.startsWith('up/up') ? 'up' : 'down';
                const proto = s.status.startsWith('up/up') ? 'up' : 'down';
                return ln(status === 'up' ? 'output' : 'error',
                    `${i.name.slice(0, 22).padEnd(22)} ${(i.ipv4 || 'unassigned').padEnd(15)} ${'YES'.padEnd(3)} ${(i.dhcp ? 'DHCP' : i.ipv4 ? 'manual' : 'unset').padEnd(6)} ${status.padEnd(21)} ${proto}`);
            }),
            ln('info', 'Status = physical/administrative, Protocol = line protocol. "administratively down" means somebody needs to type "no shutdown".'),
        ];
    }

    if (j.startsWith('interfaces') || j.startsWith('interface ')) {
        const want = args[1];
        const rows = sim.interfaceStatus(d.id).filter(s => !want || s.iface.name.toLowerCase().startsWith(want.toLowerCase()) || s.iface.short.toLowerCase() === want.toLowerCase());
        const out: CliLine[] = [];
        for (const s of rows) {
            const i = s.iface;
            out.push(ln('info', `${i.name} is ${i.enabled ? (s.status.startsWith('up/up') ? 'up' : 'down') : 'administratively down'}, line protocol is ${s.status.startsWith('up/up') ? 'up' : 'down'}`));
            out.push(ln('output', `  Hardware is ${i.medium}, address is ${i.mac}`));
            if (i.description) out.push(ln('output', `  Description: ${i.description}`));
            out.push(ln('output', `  Internet address is ${i.ipv4 ? `${i.ipv4}/${maskToPrefix(i.mask)}` : 'not set'}`));
            out.push(ln('output', `  MTU ${i.mtu} bytes, BW ${i.speedMbps * 1000} Kbit/sec, duplex ${i.duplex}`));
            out.push(ln('output', `  Switchport mode: ${i.mode}${i.mode === 'access' ? ` (VLAN ${i.accessVlan})` : i.mode === 'trunk' ? ` (native ${i.nativeVlan}, allowed ${i.trunkVlans.length ? i.trunkVlans.join(',') : 'all'})` : ''}`));
            if (s.linkTo) out.push(ln('output', `  Connected to ${s.linkTo}`));
            if (s.stpRole) out.push(ln('output', `  Spanning-tree port role: ${s.stpRole}`));
            const c = i.counters || { txFrames: 0, rxFrames: 0, txBytes: 0, rxBytes: 0, drops: 0 };
            out.push(ln('output', `  ${c.rxFrames} packets input, ${c.rxBytes} bytes; ${c.txFrames} packets output, ${c.txBytes} bytes, ${c.drops} drops`));
            out.push(ln('output', ''));
        }
        return out.length ? out : [ln('error', '% Invalid interface')];
    }

    if (j.startsWith('mac address-table') || j.startsWith('mac-address-table') || j === 'mac') {
        if (!isL2Forwarder(roleOf(d))) return [ln('error', '% This device does not keep a MAC address table (it is not a switch).')];
        const rows = d.macTable || [];
        return [
            ln('output', '          Mac Address Table'),
            ln('output', '-------------------------------------------'),
            ln('output', 'Vlan    Mac Address       Type        Ports'),
            ln('output', '----    -----------       --------    -----'),
            ...(rows.length ? rows.map(e => {
                const i = d.interfaces.find(x => x.id === e.interfaceId);
                return ln('output', `${String(e.vlan).padEnd(8)}${e.mac.padEnd(18)}${e.type.padEnd(12)}${i?.short || '?'}`);
            }) : [ln('output', '(empty — send traffic first; a switch only learns from received frames)')]),
            ln('info', `Total Mac Addresses for this criterion: ${rows.length}`),
        ];
    }

    if (j.startsWith('vlan')) {
        if (!d.vlans?.length) return [ln('error', '% VLANs are not supported on this device.')];
        const out: CliLine[] = [
            ln('output', 'VLAN Name                             Status    Ports'),
            ln('output', '---- -------------------------------- --------- -------------------------------'),
        ];
        for (const v of d.vlans) {
            const ports = d.interfaces.filter(i => i.mode === 'access' && (i.accessVlan || 1) === v.id).map(i => i.short);
            out.push(ln('output', `${String(v.id).padEnd(5)}${v.name.padEnd(33)}${'active'.padEnd(10)}${ports.join(', ')}`));
        }
        const trunks = d.interfaces.filter(i => i.mode === 'trunk');
        if (trunks.length) out.push(ln('info', `Trunks: ${trunks.map(i => `${i.short} (native ${i.nativeVlan}, allowed ${i.trunkVlans.length ? i.trunkVlans.join(',') : 'all'})`).join(' · ')}`));
        return out;
    }

    if (j === 'ip route' || j.startsWith('ip route')) {
        if (!isL3Forwarder(roleOf(d))) return [ln('error', '% IP routing is not enabled on this device.')];
        const table = sim.routingTable(d.id);
        const code = (s?: string) => s === 'connected' ? 'C' : s === 'static' ? 'S' : s === 'default' ? 'S*' : s === 'rip' ? 'R' : s === 'ospf' ? 'O' : 'S';
        return [
            ln('output', 'Codes: C - connected, S - static, S* - default, R - RIP, O - OSPF'),
            ln('output', ''),
            ...(table.length ? table.map(r => {
                const iface = r.exitInterfaceId ? d.interfaces.find(i => i.id === r.exitInterfaceId) : undefined;
                const via = r.nextHop && r.nextHop !== '0.0.0.0'
                    ? `via ${r.nextHop}${iface ? `, ${iface.short}` : ''}`
                    : `is directly connected, ${iface?.short || '?'}`;
                const ad = r.source === 'connected' ? '' : ` [${r.adminDistance ?? 1}/${r.metric}]`;
                return ln('output', `${code(r.source).padEnd(3)} ${r.network}/${maskToPrefix(r.mask)}${ad} ${via}`);
            }) : [ln('error', '% No routes. Configure interfaces, then add "ip route" or a routing protocol.')]),
            ln('info', 'Longest prefix wins. When two protocols offer the same prefix, the lower administrative distance wins.'),
        ];
    }

    if (j.startsWith('arp') || j === 'ip arp') {
        const rows = d.arpTable || [];
        return [
            ln('output', 'Protocol  Address          Age (min)  Hardware Addr   Type   Interface'),
            ...(rows.length ? rows.map(e => {
                const i = d.interfaces.find(x => x.id === e.interfaceId);
                return ln('output', `Internet  ${e.ip.padEnd(17)}${String(Math.floor(e.ageSec / 60)).padEnd(11)}${e.mac.padEnd(16)}ARPA   ${i?.short || ''}`);
            }) : [ln('output', '(empty)')]),
        ];
    }

    if (j.startsWith('spanning-tree') || j === 'stp') {
        if (!isL2Forwarder(roleOf(d))) return [ln('error', '% Spanning tree does not run on this device.')];
        const out: CliLine[] = [
            ln('info', `${d.stp.mode.toUpperCase()} — VLAN0001`),
            ln('output', `  Root ID    Priority ${d.stp.isRoot ? d.stp.priority : '(remote)'}`),
            ln('output', `             Address  ${d.stp.rootBridgeId?.split(':').slice(1).join(':') || '(unknown)'}`),
            ln('output', d.stp.isRoot ? '             This bridge is the root' : '             Cost and port shown below'),
            ln('output', ''),
            ln('output', `  Bridge ID  Priority ${d.stp.priority}`),
            ln('output', ''),
            ln('output', 'Interface        Role Sts Cost      Type'),
            ln('output', '---------------- ---- --- --------- --------'),
        ];
        for (const i of d.interfaces) {
            const role = d.stp.portRoles?.[i.id];
            if (!role) continue;
            const sts = role === 'blocked' || role === 'alternate' ? 'BLK' : 'FWD';
            out.push(ln(sts === 'BLK' ? 'error' : 'output',
                `${i.short.padEnd(17)}${role.slice(0, 4).toUpperCase().padEnd(5)}${sts.padEnd(4)}${String(stpCostOf(i)).padEnd(10)}P2p`));
        }
        out.push(ln('info', 'BLK = blocking. That port exists for redundancy; it forwards nothing until the primary path fails.'));
        return out;
    }

    if (j.startsWith('ip dhcp binding') || j.startsWith('dhcp binding')) {
        const leases = d.services?.dhcp?.leases || [];
        return [
            ln('output', 'IP address       Client-ID/Hardware address   Lease expiration       Type'),
            ...(leases.length ? leases.map(l => ln('output', `${l.ip.padEnd(17)}${l.mac.padEnd(29)}${String(Math.round(l.expiresIn / 3600)) + ' hours'.padEnd(23)} Automatic`))
                : [ln('output', '(no active leases)')]),
        ];
    }

    if (j.startsWith('ip dhcp pool') || j === 'ip dhcp') {
        const pools = d.services?.dhcp?.pools || [];
        if (!pools.length) return [ln('output', 'No DHCP pools are configured.')];
        return pools.flatMap(p => [
            ln('info', `Pool ${p.name} :`),
            ln('output', ` Network: ${p.network}/${maskToPrefix(p.mask)}`),
            ln('output', ` Range:   ${p.rangeStart} – ${p.rangeEnd}`),
            ln('output', ` Router:  ${p.gateway || '(not set)'}`),
            ln('output', ` DNS:     ${p.dnsServer || '(not set)'}`),
            ln('output', ` Lease:   ${p.leaseHours} hours`),
        ]);
    }

    if (j.startsWith('ip nat translations') || j.startsWith('ip nat')) {
        const tr = d.nat?.translations || [];
        return [
            ln('output', 'Pro Inside global        Inside local         Outside local        Outside global'),
            ...(tr.length ? tr.map(t => ln('output', `${t.protocol.padEnd(4)}${t.insideGlobal.padEnd(21)}${t.insideLocal.padEnd(21)}${t.outsideLocal.padEnd(21)}${t.outsideGlobal}`))
                : [ln('output', '(no active translations — send traffic through the NAT boundary first)')]),
            ln('info', `NAT is ${d.nat?.enabled ? `enabled in ${d.nat.mode.toUpperCase()} mode` : 'disabled'}.`),
        ];
    }

    if (j.startsWith('access-lists') || j.startsWith('ip access-lists') || j === 'access-list') {
        if (!d.acls?.length) return [ln('output', 'No access lists are configured.')];
        return d.acls.flatMap(acl => [
            ln('info', `${acl.type === 'standard' ? 'Standard' : 'Extended'} IP access list ${acl.name}`),
            ...acl.rules.sort((x, y) => x.seq - y.seq).map(r => ln('output',
                `    ${r.seq} ${r.action} ${r.protocol} ${r.srcAny ? 'any' : `${r.src} ${r.srcWildcard}`}${acl.type === 'extended' ? ` ${r.dstAny ? 'any' : `${r.dst} ${r.dstWildcard}`}` : ''}${r.dstPort ? ` eq ${r.dstPort}` : ''}${r.hits ? ` (${r.hits} matches)` : ''}`)),
            ln('info', '    (implicit deny any at the end — always)'),
        ]);
    }

    if (j.startsWith('cdp neighbors') || j.startsWith('lldp neighbors') || j.startsWith('cdp')) {
        const rows = sim.interfaceStatus(d.id).filter(s => s.linkTo);
        return [
            ln('output', 'Device ID        Local Intrfce     Holdtme    Capability   Platform   Port ID'),
            ...(rows.length ? rows.map(s => ln('output',
                `${(s.linkTo!.split(' ')[0]).padEnd(17)}${s.iface.short.padEnd(18)}${'168'.padEnd(11)}${'R S I'.padEnd(13)}${'NetSim'.padEnd(11)}${s.linkTo!.split(' ').slice(1).join(' ')}`))
                : [ln('output', '(no neighbours discovered — nothing is cabled)')]),
            ln('info', 'CDP/LLDP is how a device learns what is on the other end of a cable without any IP configuration at all.'),
        ];
    }

    if (j.startsWith('running-config') || j.startsWith('run')) {
        return runningConfig(d).map(l => ln('output', l));
    }

    if (j.startsWith('ip protocols') || j.startsWith('ip ospf') || j.startsWith('ip rip')) {
        const out: CliLine[] = [];
        if (d.routing?.ospf?.enabled) {
            out.push(ln('info', `Routing Protocol is "ospf ${d.routing.ospf.processId}"`));
            out.push(ln('output', `  Router ID ${d.routing.ospf.routerId || '(auto)'}`));
            out.push(ln('output', `  Reference bandwidth 100 Mbps, administrative distance 110`));
        }
        if (d.routing?.rip?.enabled) {
            out.push(ln('info', `Routing Protocol is "rip"`));
            out.push(ln('output', `  Version ${d.routing.rip.version}, administrative distance 120, max hop count 15`));
        }
        const learned = d.routing?.learned || [];
        if (learned.length) {
            out.push(ln('output', ''), ln('info', 'Learned routes:'));
            learned.forEach(r => out.push(ln('output', `  ${r.network}/${maskToPrefix(r.mask)} via ${r.nextHop} [${r.adminDistance}/${r.metric}]`)));
        }
        return out.length ? out : [ln('output', 'No dynamic routing protocol is running.')];
    }

    if (j.startsWith('dot11') || j.startsWith('wireless') || j.startsWith('wlan')) {
        if (!d.wireless) return [ln('error', '% No wireless subsystem on this device.')];
        const w = d.wireless;
        const clients = sim.allLinks.filter(l =>
            (l.bDeviceId === d.id || l.aDeviceId === d.id) && (l.cable === 'wireless' || l.cable === 'cellular'));
        return [
            ln('info', `SSID "${w.ssid}"${w.guestSsid ? ` + guest SSID "${w.guestSsid}"` : ''}`),
            ln('output', `  Security      : ${w.security.toUpperCase()}`),
            ln('output', `  Standard      : ${w.standard}`),
            ln('output', `  Band/Channel  : ${w.band} channel ${w.channel} (${w.channelWidthMHz} MHz)`),
            ln('output', `  TX power      : ${w.txPowerDbm} dBm`),
            ln('output', `  Mapped VLAN   : ${w.vlanId ?? '(untagged)'}`),
            ln('output', `  Hidden SSID   : ${w.hidden ? 'yes' : 'no'}`),
            ln('output', `  Associated    : ${clients.length} / ${w.maxClients} clients`),
            ...clients.map(l => {
                const other = l.aDeviceId === d.id ? sim.device(l.bDeviceId) : sim.device(l.aDeviceId);
                return ln('output', `    ${other?.hostname}`);
            }),
        ];
    }

    if (j.startsWith('clock')) return [ln('output', '*10:42:31.204 UTC Mon Aug 3 2026')];
    if (j.startsWith('users') || j.startsWith('sessions')) return [ln('output', '    Line       User       Host(s)              Idle       Location'), ln('output', '*  0 con 0                idle                 00:00:00')];

    return [ln('error', `% Invalid input detected at "${args[0]}".`), ...helpForShow()];
}

function stpCostOf(i: NetInterface): number {
    if (i.speedMbps >= 10000) return 2;
    if (i.speedMbps >= 1000) return 4;
    if (i.speedMbps >= 100) return 19;
    return 100;
}

/* ─────────────── global configuration mode ─────────────── */

function runConfig(sim: Simulator, session: CliSession, d: Device, input: string, parts: string[]): CliLine[] {
    const t = input.toLowerCase().split(/\s+/);
    const neg = t[0] === 'no';
    const c = neg ? t.slice(1) : t;
    const p = neg ? parts.slice(1) : parts;

    if (c[0] === 'hostname') {
        if (!p[1]) return [ln('error', '% Incomplete command.')];
        d.hostname = p[1].slice(0, 24);
        return [];
    }

    if (c[0] === 'interface' || c[0] === 'int') {
        const name = p.slice(1).join('');
        if (!name) return [ln('error', '% Incomplete command.')];
        // interface vlan 10 → SVI
        if (/^vlan/i.test(name)) {
            const vid = Number(name.replace(/[^0-9]/g, ''));
            if (!vid) return [ln('error', '% Invalid VLAN id')];
            if (!getDeviceType(d.typeId)?.supports.routing && roleOf(d) !== 'multilayer') {
                return [ln('error', '% SVIs require a multilayer switch or a router.')];
            }
            const svi = addSvi(d, vid, '', '255.255.255.0');
            addVlan(d, vid, d.vlans.find(v => v.id === vid)?.name || `VLAN${vid}`);
            session.mode = 'config-if';
            session.contextInterfaceId = svi.id;
            sim.recompute();
            return [ln('info', `Configuring SVI ${svi.name} — give it an IP address to route VLAN ${vid}.`)];
        }
        const i = findIface(d, name);
        if (!i) return [ln('error', `% Invalid interface. Available: ${d.interfaces.map(x => x.short).join(', ')}`)];
        session.mode = 'config-if';
        session.contextInterfaceId = i.id;
        return [];
    }

    if (c[0] === 'vlan') {
        const vid = Number(p[1]);
        if (!vid || vid < 1 || vid > 4094) return [ln('error', '% VLAN id must be between 1 and 4094')];
        if (neg) {
            d.vlans = d.vlans.filter(v => v.id !== vid);
            return [ln('success', `VLAN ${vid} removed.`)];
        }
        addVlan(d, vid, `VLAN${String(vid).padStart(4, '0')}`);
        session.mode = 'config-vlan';
        session.contextVlanId = vid;
        return [];
    }

    if (c[0] === 'ip' && c[1] === 'routing') {
        if (neg) return [ln('success', 'IP routing disabled — SVIs will answer but not route.')];
        return [ln('success', 'IP routing enabled. Inter-VLAN routing between SVIs is now active.')];
    }

    if (c[0] === 'ip' && c[1] === 'route') {
        // ip route <net> <mask> <nexthop>
        const [, , net, mask, nh] = p;
        if (!isValidIPv4(net) || !isValidMask(mask)) return [ln('error', '% Usage: ip route <network> <mask> <next-hop>')];
        if (neg) {
            d.routing.staticRoutes = d.routing.staticRoutes.filter(r => !(r.network === net && r.mask === mask));
            sim.recompute();
            return [ln('success', 'Static route removed.')];
        }
        if (!isValidIPv4(nh)) return [ln('error', '% Next hop must be a valid IPv4 address')];
        addStaticRoute(d, net, mask, nh);
        sim.recompute();
        return [ln('success', `Static route ${net}/${maskToPrefix(mask)} via ${nh} installed (administrative distance 1).`)];
    }

    if (c[0] === 'ip' && c[1] === 'default-gateway') {
        if (!isValidIPv4(p[2])) return [ln('error', '% Usage: ip default-gateway <ip>')];
        d.routing.defaultGateway = p[2];
        d.host.defaultGateway = p[2];
        sim.recompute();
        return [ln('success', `Default gateway set to ${p[2]}.`)];
    }

    if (c[0] === 'ip' && c[1] === 'name-server') {
        if (!isValidIPv4(p[2])) return [ln('error', '% Usage: ip name-server <ip>')];
        d.host.dnsServer = p[2];
        return [ln('success', `DNS resolver set to ${p[2]}.`)];
    }

    if (c[0] === 'router') {
        const proto = c[1];
        if (proto === 'ospf') {
            const pid = Number(p[2]) || 1;
            d.routing.ospf.enabled = !neg;
            d.routing.ospf.processId = pid;
            if (!d.routing.ospf.routerId) d.routing.ospf.routerId = d.interfaces.find(i => i.ipv4)?.ipv4 || '';
            session.mode = 'config-router';
            session.contextRouter = 'ospf';
            sim.recompute();
            return neg ? [ln('success', 'OSPF disabled.')] : [];
        }
        if (proto === 'rip') {
            d.routing.rip.enabled = !neg;
            session.mode = 'config-router';
            session.contextRouter = 'rip';
            sim.recompute();
            return neg ? [ln('success', 'RIP disabled.')] : [];
        }
        return [ln('error', '% Supported: router ospf <process-id> | router rip')];
    }

    if (c[0] === 'ip' && c[1] === 'dhcp' && c[2] === 'pool') {
        const name = p[3];
        if (!name) return [ln('error', '% Usage: ip dhcp pool <name>')];
        let pool = d.services.dhcp.pools.find(x => x.name.toLowerCase() === name.toLowerCase());
        if (!pool) {
            addDhcpPool(d, { name, network: '', mask: '255.255.255.0', rangeStart: '', rangeEnd: '', gateway: '' });
            pool = d.services.dhcp.pools[d.services.dhcp.pools.length - 1];
        }
        d.services.dhcp.enabled = true;
        session.mode = 'config-dhcp';
        session.contextPoolId = pool.id;
        return [];
    }

    if (c[0] === 'ip' && c[1] === 'dhcp' && c[2] === 'excluded-address') {
        const pool = d.services.dhcp.pools[0];
        if (!pool) return [ln('error', '% Configure a DHCP pool first.')];
        if (!isValidIPv4(p[3])) return [ln('error', '% Usage: ip dhcp excluded-address <start> [end]')];
        pool.excluded.push(p[3]);
        return [ln('success', `${p[3]} excluded from DHCP allocation.`)];
    }

    if ((c[0] === 'access-list' || (c[0] === 'ip' && c[1] === 'access-list'))) {
        // access-list 10 permit 192.168.1.0 0.0.0.255
        // ip access-list extended NAME
        if (c[0] === 'ip') {
            const kind = c[2] === 'extended' ? 'extended' : 'standard';
            const name = p[3];
            if (!name) return [ln('error', '% Usage: ip access-list {standard|extended} <name>')];
            addAcl(d, name, kind);
            return [ln('info', `ACL ${name} created. Add rules with: access-list ${name} permit|deny ...`)];
        }
        const name = p[1];
        const action = c[2];
        if (!name || (action !== 'permit' && action !== 'deny')) {
            return [ln('error', '% Usage: access-list <name|number> {permit|deny} <protocol> <src> [wildcard] [dst wildcard] [eq port]')];
        }
        const numeric = /^\d+$/.test(name);
        const kind: 'standard' | 'extended' = numeric ? (Number(name) < 100 ? 'standard' : 'extended') : 'extended';
        addAcl(d, name, kind);
        const acl = d.acls.find(x => x.name === name)!;
        const rest = p.slice(3);
        const rule = parseAclRule(acl, action as 'permit' | 'deny', rest);
        if (!rule.ok) return [ln('error', `% ${rule.reason}`)];
        acl.rules.push(rule.rule!);
        return [ln('success', `Added to ${name}: ${action} ${rest.join(' ')}`),
            ln('info', 'Remember the implicit "deny any" at the end of every ACL.')];
    }

    if (c[0] === 'spanning-tree') {
        if (c[1] === 'vlan' && c[3] === 'priority') {
            const prio = Number(p[4]);
            if (isNaN(prio) || prio % 4096 !== 0) return [ln('error', '% Priority must be a multiple of 4096 (0–61440)')];
            d.stp.priority = prio;
            sim.recompute();
            return [ln('success', `Bridge priority set to ${prio}. ${d.stp.isRoot ? 'This switch is now the root bridge.' : 'Root election re-run.'}`)];
        }
        if (c[1] === 'mode') {
            const m = c[2];
            if (!['stp', 'rstp', 'pvst', 'rapid-pvst', 'mstp'].includes(m)) return [ln('error', '% Supported modes: stp rstp pvst rapid-pvst mstp')];
            d.stp.mode = m as any;
            return [ln('success', `Spanning-tree mode set to ${m}.`)];
        }
        if (neg) { d.stp.enabled = false; sim.recompute(); return [ln('error', 'Spanning tree DISABLED. Any Layer-2 loop will now melt this network down.')]; }
        d.stp.enabled = true;
        sim.recompute();
        return [ln('success', 'Spanning tree enabled.')];
    }

    if (c[0] === 'ip' && c[1] === 'nat') {
        // ip nat inside source list X interface Y overload
        if (c.includes('overload') || c[2] === 'inside') {
            d.nat.enabled = !neg;
            d.nat.mode = 'pat';
            const ifIdx = c.indexOf('interface');
            if (ifIdx > 0 && p[ifIdx + 1]) {
                const i = findIface(d, p[ifIdx + 1]);
                if (i) { i.natRole = 'outside'; d.nat.outsideAddress = i.ipv4; }
            }
            sim.recompute();
            return [ln('success', `NAT overload (PAT) ${neg ? 'disabled' : 'enabled'}. Mark interfaces with "ip nat inside" / "ip nat outside".`)];
        }
        return [ln('error', '% Usage: ip nat inside source list <acl> interface <if> overload')];
    }

    if (c[0] === 'ip' && c[1] === 'host') {
        if (!p[2] || !isValidIPv4(p[3])) return [ln('error', '% Usage: ip host <name> <ip>')];
        addDnsRecord(d, p[2], p[3]);
        return [ln('success', `Static host record ${p[2]} → ${p[3]} added.`)];
    }

    if (c[0] === 'line') { session.mode = 'config-line'; return []; }
    if (c[0] === 'enable' || c[0] === 'username' || c[0] === 'banner' || c[0] === 'service' || c[0] === 'crypto' || c[0] === 'logging') {
        return [ln('success', `${p[0]} configuration accepted (simulated).`)];
    }
    if (c[0] === 'dot11' || c[0] === 'wlan' || c[0] === 'ssid') {
        if (!d.wireless) return [ln('error', '% No wireless subsystem on this device.')];
        if (p[1]) d.wireless.ssid = p[1];
        sim.recompute();
        return [ln('success', `SSID set to "${d.wireless.ssid}". Clients must use the same SSID and passphrase.`)];
    }

    return [ln('error', `% Invalid input detected at "${parts[0]}".`), ...helpForConfig()];
}

/* ─────────────── interface configuration mode ─────────────── */

function runConfigIf(sim: Simulator, session: CliSession, d: Device, input: string, parts: string[]): CliLine[] {
    const i = d.interfaces.find(x => x.id === session.contextInterfaceId);
    if (!i) { session.mode = 'config'; return [ln('error', '% Interface context lost')]; }

    const t = input.toLowerCase().split(/\s+/);
    const neg = t[0] === 'no';
    const c = neg ? t.slice(1) : t;
    const p = neg ? parts.slice(1) : parts;

    if (c[0] === 'shutdown') {
        i.enabled = neg;
        sim.recompute();
        return [ln(neg ? 'success' : 'error', `${i.name} is now ${neg ? 'administratively up' : 'administratively down'}.`)];
    }

    if (c[0] === 'ip' && c[1] === 'address') {
        if (neg) { i.ipv4 = ''; sim.recompute(); return [ln('success', `IP address removed from ${i.name}.`)]; }
        if (p[2]?.toLowerCase() === 'dhcp') {
            i.dhcp = true; i.ipv4 = '';
            sim.recompute();
            return [ln('success', `${i.name} will obtain its address by DHCP. Trigger it with "Request DHCP" or ipconfig /renew on a host.`)];
        }
        const ip = p[2], mask = p[3];
        if (!isValidIPv4(ip)) return [ln('error', `% Invalid IP address "${ip}"`)];
        if (!isValidMask(mask)) return [ln('error', `% Invalid subnet mask "${mask}". A mask must be contiguous ones, e.g. 255.255.255.0`)];
        const s = describeSubnet(ip, mask);
        if (s.prefix < 31 && ip === s.network) return [ln('error', `% ${ip} is the network address of ${s.network}/${s.prefix} — pick ${s.firstHost} or higher`)];
        if (s.prefix < 31 && ip === s.broadcast) return [ln('error', `% ${ip} is the broadcast address of ${s.network}/${s.prefix} — pick ${s.lastHost} or lower`)];
        i.ipv4 = ip; i.mask = mask; i.dhcp = false;
        if (i.mode === 'access' && isL3Forwarder(roleOf(d))) i.mode = 'routed';
        sim.recompute();
        return [
            ln('success', `${i.name}: ${ip}/${s.prefix}`),
            ln('info', `Network ${s.network}/${s.prefix} · usable ${s.firstHost}–${s.lastHost} · broadcast ${s.broadcast} · ${s.hosts} hosts · ${s.scope}`),
            ...(i.enabled ? [] : [ln('error', 'The interface is still shut down. Type "no shutdown".')]),
        ];
    }

    if (c[0] === 'ipv6' && c[1] === 'address') {
        if (neg) { i.ipv6 = ''; return [ln('success', 'IPv6 address removed.')]; }
        const [addr, pfx] = (p[2] || '').split('/');
        i.ipv6 = addr || '';
        i.prefix6 = Number(pfx) || 64;
        return [ln('success', `${i.name}: ${i.ipv6}/${i.prefix6}`)];
    }

    if (c[0] === 'description') {
        i.description = neg ? '' : parts.slice(1).join(' ');
        return [];
    }

    if (c[0] === 'switchport') {
        if (!isL2Forwarder(roleOf(d))) return [ln('error', '% switchport commands only exist on switches.')];
        if (c[1] === 'mode') {
            const m = c[2];
            if (m === 'access') { i.mode = 'access'; sim.recompute(); return [ln('success', `${i.name} is an access port in VLAN ${i.accessVlan}.`)]; }
            if (m === 'trunk') { i.mode = 'trunk'; sim.recompute(); return [ln('success', `${i.name} is a trunk. Native VLAN ${i.nativeVlan}; allowed VLANs ${i.trunkVlans.length ? i.trunkVlans.join(',') : 'all'}.`)]; }
            if (m === 'dynamic') { i.mode = 'dynamic-auto'; return [ln('success', `${i.name} set to dynamic auto (DTP). Deterministic designs hard-code the mode instead.`)]; }
            return [ln('error', '% Usage: switchport mode {access | trunk | dynamic auto}')];
        }
        if (c[1] === 'access' && c[2] === 'vlan') {
            const vid = Number(p[3]);
            if (!vid || vid < 1 || vid > 4094) return [ln('error', '% VLAN id must be 1–4094')];
            if (!d.vlans.some(v => v.id === vid)) addVlan(d, vid, `VLAN${String(vid).padStart(4, '0')}`);
            i.accessVlan = vid; i.mode = 'access';
            sim.recompute();
            return [ln('success', `${i.name} placed in VLAN ${vid}.`)];
        }
        if (c[1] === 'trunk' && c[2] === 'allowed' && c[3] === 'vlan') {
            const list = (p[4] || '').split(',').flatMap(x => {
                if (x.includes('-')) {
                    const [a, b] = x.split('-').map(Number);
                    return Array.from({ length: Math.max(0, b - a + 1) }, (_, k) => a + k);
                }
                return [Number(x)];
            }).filter(n => n >= 1 && n <= 4094);
            i.trunkVlans = neg ? [] : list;
            i.mode = 'trunk';
            sim.recompute();
            return [ln('success', `Trunk ${i.name} allows VLANs ${i.trunkVlans.length ? i.trunkVlans.join(',') : 'all'}.`)];
        }
        if (c[1] === 'trunk' && c[2] === 'native' && c[3] === 'vlan') {
            const vid = Number(p[4]);
            if (!vid) return [ln('error', '% Usage: switchport trunk native vlan <id>')];
            i.nativeVlan = vid;
            sim.recompute();
            return [ln('success', `Native VLAN on ${i.name} is ${vid}.`),
                ln('info', 'Both ends of a trunk must agree on the native VLAN, or untagged frames leak between VLANs.')];
        }
        if (c[1] === 'voice' && c[2] === 'vlan') {
            const vid = Number(p[3]);
            if (!vid) return [ln('error', '% Usage: switchport voice vlan <id>')];
            if (!d.vlans.some(v => v.id === vid)) addVlan(d, vid, 'VOICE');
            i.trunkVlans = Array.from(new Set([...i.trunkVlans, vid]));
            return [ln('success', `Voice VLAN ${vid} advertised on ${i.name} via CDP/LLDP-MED. The phone tags voice, the PC stays untagged.`)];
        }
        return [ln('error', '% Usage: switchport mode|access vlan|trunk allowed vlan|trunk native vlan|voice vlan')];
    }

    if (c[0] === 'encapsulation' && (c[1] === 'dot1q' || c[1] === 'dot1Q')) {
        const vid = Number(p[2]);
        if (!vid) return [ln('error', '% Usage: encapsulation dot1q <vlan-id>')];
        i.encapsulationVlan = vid;
        sim.recompute();
        return [ln('success', `${i.name} tags with VLAN ${vid} (router-on-a-stick sub-interface).`)];
    }

    if (c[0] === 'ip' && c[1] === 'nat') {
        i.natRole = neg ? 'none' : c[2] === 'inside' ? 'inside' : c[2] === 'outside' ? 'outside' : 'none';
        if (i.natRole === 'outside') d.nat.outsideAddress = i.ipv4;
        d.nat.enabled = d.nat.enabled || i.natRole !== 'none';
        sim.recompute();
        return [ln('success', `${i.name} marked as NAT ${i.natRole}.`)];
    }

    if (c[0] === 'ip' && c[1] === 'access-group') {
        const name = p[2];
        const dir = c[3];
        if (!name || (dir !== 'in' && dir !== 'out')) return [ln('error', '% Usage: ip access-group <name> {in|out}')];
        if (!d.acls.some(a => a.name === name)) return [ln('error', `% ACL ${name} does not exist. Create it first.`)];
        if (neg) { if (dir === 'in') i.aclIn = ''; else i.aclOut = ''; return [ln('success', `ACL removed from ${i.name} ${dir}bound.`)]; }
        if (dir === 'in') i.aclIn = name; else i.aclOut = name;
        return [ln('success', `ACL ${name} applied ${dir}bound on ${i.name}.`),
            ln('info', dir === 'in' ? 'An inbound ACL is checked before the routing decision.' : 'An outbound ACL is checked after routing, just before transmission.')];
    }

    if (c[0] === 'ip' && c[1] === 'helper-address') {
        if (!isValidIPv4(p[2])) return [ln('error', '% Usage: ip helper-address <dhcp-server-ip>')];
        i.description = `${i.description} [helper ${p[2]}]`.trim();
        return [ln('success', `DHCP relay configured: broadcasts on ${i.name} are forwarded as unicast to ${p[2]}.`)];
    }

    if (c[0] === 'duplex') {
        const v = c[1];
        if (!['auto', 'full', 'half'].includes(v)) return [ln('error', '% Usage: duplex {auto|full|half}')];
        i.duplex = v as any;
        sim.recompute();
        return [ln('success', `Duplex on ${i.name} set to ${v}.`)];
    }
    if (c[0] === 'speed') {
        const v = Number(c[1]);
        if (c[1] === 'auto') return [ln('success', `${i.name} speed set to auto-negotiate.`)];
        if (!v) return [ln('error', '% Usage: speed {auto|10|100|1000|10000}')];
        i.speedMbps = v;
        sim.recompute();
        return [ln('success', `${i.name} speed forced to ${v} Mbps.`)];
    }
    if (c[0] === 'mtu') {
        const v = Number(c[1]);
        if (!v || v < 576 || v > 9216) return [ln('error', '% MTU must be between 576 and 9216')];
        i.mtu = v;
        return [ln('success', `MTU on ${i.name} set to ${v}${v >= 9000 ? ' (jumbo frames — every device on the path must agree)' : ''}.`)];
    }
    if (c[0] === 'clock' && c[1] === 'rate') {
        const v = Number(c[2]);
        if (!v) return [ln('error', '% Usage: clock rate <bps>')];
        i.speedMbps = Math.max(1, Math.round(v / 1000000)) || 1;
        return [ln('success', `Clock rate ${v} bps set on ${i.name} (this is the DCE end of the serial link).`)];
    }
    if (c[0] === 'spanning-tree' && c[1] === 'portfast') {
        return [ln('success', `PortFast ${neg ? 'disabled' : 'enabled'} on ${i.name}.`),
            ln('info', 'PortFast skips listening/learning on an edge port. Never enable it toward another switch.')];
    }
    if (c[0] === 'switchport' || c[0] === 'ssid' || c[0] === 'channel') {
        return [ln('success', 'Accepted (simulated).')];
    }

    return [ln('error', `% Invalid input detected at "${parts[0]}".`), ...helpForConfigIf()];
}

function runConfigVlan(session: CliSession, d: Device, parts: string[]): CliLine[] {
    const t = parts.map(x => x.toLowerCase());
    const v = d.vlans.find(x => x.id === session.contextVlanId);
    if (!v) { session.mode = 'config'; return [ln('error', '% VLAN context lost')]; }
    if (t[0] === 'name') {
        if (!parts[1]) return [ln('error', '% Usage: name <vlan-name>')];
        v.name = parts.slice(1).join('-');
        return [];
    }
    return [ln('error', '% Usage: name <vlan-name>  (then "exit")')];
}

function runConfigRouter(sim: Simulator, session: CliSession, d: Device, parts: string[]): CliLine[] {
    const t = parts.map(x => x.toLowerCase());
    const proto = session.contextRouter;

    if (t[0] === 'network') {
        if (proto === 'ospf') {
            const [, net, wc, , area] = parts;
            if (!isValidIPv4(net)) return [ln('error', '% Usage: network <address> <wildcard> area <area-id>')];
            d.routing.ospf.networks.push({ network: net, wildcard: wc || '0.0.0.255', area: Number(area) || 0 });
            sim.recompute();
            return [ln('success', `OSPF now advertises ${net} ${wc || '0.0.0.255'} in area ${Number(area) || 0}.`),
                ln('info', 'The wildcard mask is the inverse of the subnet mask: 0.0.0.255 matches a /24.')];
        }
        if (!isValidIPv4(parts[1])) return [ln('error', '% Usage: network <classful-network>')];
        d.routing.rip.networks.push(parts[1]);
        sim.recompute();
        return [ln('success', `RIP now advertises ${parts[1]}.`),
            ln('info', 'RIP is classful in its network statement — it advertises the whole major network.')];
    }
    if (t[0] === 'version') {
        d.routing.rip.version = Number(t[1]) === 1 ? 1 : 2;
        return [ln('success', `RIP version ${d.routing.rip.version}.`),
            ln('info', 'Version 2 sends the subnet mask (classless) and supports VLSM. Always use version 2.')];
    }
    if (t[0] === 'router-id') {
        if (!isValidIPv4(parts[1])) return [ln('error', '% Usage: router-id <a.b.c.d>')];
        d.routing.ospf.routerId = parts[1];
        sim.recompute();
        return [ln('success', `OSPF router ID set to ${parts[1]}.`)];
    }
    if (t[0] === 'passive-interface' || t[0] === 'no' || t[0] === 'default-information') {
        return [ln('success', 'Accepted (simulated).')];
    }
    return [ln('error', proto === 'ospf'
        ? '% Usage: network <addr> <wildcard> area <n> | router-id <a.b.c.d>'
        : '% Usage: network <classful-network> | version {1|2}')];
}

function runConfigDhcp(session: CliSession, d: Device, parts: string[]): CliLine[] {
    const t = parts.map(x => x.toLowerCase());
    const pool = d.services.dhcp.pools.find(p => p.id === session.contextPoolId);
    if (!pool) { session.mode = 'config'; return [ln('error', '% DHCP pool context lost')]; }

    if (t[0] === 'network') {
        if (!isValidIPv4(parts[1]) || !isValidMask(parts[2])) return [ln('error', '% Usage: network <network> <mask>')];
        pool.network = parts[1];
        pool.mask = parts[2];
        const s = describeSubnet(parts[1], parts[2]);
        pool.rangeStart = pool.rangeStart || s.firstHost;
        pool.rangeEnd = pool.rangeEnd || s.lastHost;
        return [ln('success', `Pool ${pool.name} serves ${s.network}/${s.prefix} (${pool.rangeStart}–${pool.rangeEnd}).`)];
    }
    if (t[0] === 'default-router') {
        if (!isValidIPv4(parts[1])) return [ln('error', '% Usage: default-router <ip>')];
        pool.gateway = parts[1];
        return [ln('success', `Clients will receive default gateway ${parts[1]} (DHCP option 3).`)];
    }
    if (t[0] === 'dns-server') {
        if (!isValidIPv4(parts[1])) return [ln('error', '% Usage: dns-server <ip>')];
        pool.dnsServer = parts[1];
        return [ln('success', `Clients will receive DNS server ${parts[1]} (DHCP option 6).`)];
    }
    if (t[0] === 'domain-name') { pool.domain = parts[1] || ''; return [ln('success', `Domain name ${pool.domain} (option 15).`)]; }
    if (t[0] === 'lease') {
        const days = Number(parts[1]) || 0, hours = Number(parts[2]) || 0;
        pool.leaseHours = days * 24 + hours || 24;
        return [ln('success', `Lease time ${pool.leaseHours} hours (option 51).`)];
    }
    if (t[0] === 'range') {
        if (!isValidIPv4(parts[1]) || !isValidIPv4(parts[2])) return [ln('error', '% Usage: range <start> <end>')];
        pool.rangeStart = parts[1];
        pool.rangeEnd = parts[2];
        return [ln('success', `Pool range ${pool.rangeStart}–${pool.rangeEnd}.`)];
    }
    return [ln('error', '% Usage: network | default-router | dns-server | domain-name | lease | range')];
}

/* ─────────────── helpers ─────────────── */

function findIface(d: Device, name: string): NetInterface | undefined {
    if (!name) return undefined;
    const n = name.toLowerCase().replace(/\s+/g, '');
    return d.interfaces.find(i =>
        i.name.toLowerCase().replace(/\s+/g, '') === n ||
        i.short.toLowerCase().replace(/\s+/g, '') === n ||
        i.name.toLowerCase().replace(/\s+/g, '').startsWith(n) ||
        expandAbbrev(n) === i.name.toLowerCase()
    );
}

/** gi0/1 → gigabitethernet0/1, fa0/1 → fastethernet0/1, etc. */
function expandAbbrev(n: string): string {
    return n
        .replace(/^gi?g?(?=\d)/, 'gigabitethernet')
        .replace(/^te(?=\d)/, 'tengigabitethernet')
        .replace(/^fa?(?=\d)/, 'fastethernet')
        .replace(/^se?(?=\d)/, 'serial')
        .replace(/^eth?(?=\d)/, 'ethernet')
        .replace(/^vl(?=\d)/, 'vlan')
        .replace(/^hu(?=\d)/, 'hundredgige');
}

function parseAclRule(acl: Acl, action: 'permit' | 'deny', rest: string[]):
    { ok: boolean; rule?: any; reason?: string } {
    const seq = (acl.rules.length + 1) * 10;
    let idx = 0;
    let protocol: 'ip' | 'icmp' | 'tcp' | 'udp' = 'ip';
    if (['ip', 'icmp', 'tcp', 'udp'].includes((rest[0] || '').toLowerCase())) {
        protocol = rest[0].toLowerCase() as any;
        idx = 1;
    }

    const readAddr = (): { any: boolean; addr: string; wc: string } | null => {
        const tok = (rest[idx] || '').toLowerCase();
        if (tok === 'any') { idx++; return { any: true, addr: '', wc: '' }; }
        if (tok === 'host') {
            const a = rest[idx + 1];
            if (!isValidIPv4(a)) return null;
            idx += 2;
            return { any: false, addr: a, wc: '0.0.0.0' };
        }
        const a = rest[idx];
        if (!isValidIPv4(a)) return null;
        const w = rest[idx + 1];
        if (isValidIPv4(w)) { idx += 2; return { any: false, addr: a, wc: w }; }
        idx += 1;
        return { any: false, addr: a, wc: '0.0.0.0' };
    };

    const src = readAddr();
    if (!src) return { ok: false, reason: 'Could not parse the source address. Use "any", "host <ip>", or "<network> <wildcard>".' };

    let dst = { any: true, addr: '', wc: '' };
    let dstPort: number | undefined;
    if (acl.type === 'extended') {
        const d2 = readAddr();
        if (d2) dst = d2;
        if ((rest[idx] || '').toLowerCase() === 'eq') {
            dstPort = Number(rest[idx + 1]) || namedPort(rest[idx + 1]);
            idx += 2;
        }
    }

    return {
        ok: true,
        rule: {
            id: `r-${Date.now()}-${seq}`,
            seq, action, protocol,
            srcAny: src.any, src: src.addr, srcWildcard: src.wc || '0.0.0.0',
            dstAny: dst.any, dst: dst.addr, dstWildcard: dst.wc || '0.0.0.0',
            dstPort,
            hits: 0,
        },
    };
}

function namedPort(n?: string): number | undefined {
    const map: Record<string, number> = { www: 80, http: 80, https: 443, ftp: 21, ssh: 22, telnet: 23, smtp: 25, domain: 53, dns: 53, pop3: 110, imap: 143 };
    return n ? map[n.toLowerCase()] : undefined;
}

export function runningConfig(d: Device): string[] {
    const out: string[] = ['Building configuration...', '', '!', `hostname ${d.hostname}`, '!'];
    if (d.vlans?.length > 1) {
        d.vlans.filter(v => v.id !== 1).forEach(v => { out.push(`vlan ${v.id}`, ` name ${v.name}`, '!'); });
    }
    if (isL3Forwarder(roleOf(d)) || roleOf(d) === 'multilayer') out.push('ip routing', '!');

    for (const i of d.interfaces) {
        if (i.medium === 'console') continue;
        const hasConfig = i.ipv4 || i.description || i.mode === 'trunk' || (i.mode === 'access' && i.accessVlan !== 1) || !i.enabled || i.natRole !== 'none' || i.aclIn || i.aclOut || i.sviVlan;
        if (!hasConfig) continue;
        out.push(`interface ${i.name}`);
        if (i.description) out.push(` description ${i.description}`);
        if (i.encapsulationVlan) out.push(` encapsulation dot1Q ${i.encapsulationVlan}`);
        if (i.mode === 'trunk') {
            out.push(' switchport mode trunk');
            if (i.trunkVlans.length) out.push(` switchport trunk allowed vlan ${i.trunkVlans.join(',')}`);
            if (i.nativeVlan !== 1) out.push(` switchport trunk native vlan ${i.nativeVlan}`);
        } else if (i.mode === 'access' && isL2Forwarder(roleOf(d))) {
            out.push(' switchport mode access');
            if (i.accessVlan !== 1) out.push(` switchport access vlan ${i.accessVlan}`);
        }
        if (i.dhcp) out.push(' ip address dhcp');
        else if (i.ipv4) out.push(` ip address ${i.ipv4} ${i.mask}`);
        if (i.ipv6) out.push(` ipv6 address ${i.ipv6}/${i.prefix6}`);
        if (i.natRole !== 'none') out.push(` ip nat ${i.natRole}`);
        if (i.aclIn) out.push(` ip access-group ${i.aclIn} in`);
        if (i.aclOut) out.push(` ip access-group ${i.aclOut} out`);
        if (i.duplex !== 'auto') out.push(` duplex ${i.duplex}`);
        if (i.mtu !== 1500) out.push(` mtu ${i.mtu}`);
        out.push(i.enabled ? ' no shutdown' : ' shutdown', '!');
    }

    if (d.routing?.ospf?.enabled) {
        out.push(`router ospf ${d.routing.ospf.processId}`);
        if (d.routing.ospf.routerId) out.push(` router-id ${d.routing.ospf.routerId}`);
        d.routing.ospf.networks.forEach(n => out.push(` network ${n.network} ${n.wildcard} area ${n.area}`));
        out.push('!');
    }
    if (d.routing?.rip?.enabled) {
        out.push('router rip', ` version ${d.routing.rip.version}`);
        d.routing.rip.networks.forEach(n => out.push(` network ${n}`));
        out.push('!');
    }
    for (const r of d.routing?.staticRoutes || []) {
        out.push(`ip route ${r.network} ${r.mask} ${r.nextHop}`);
    }
    if (d.routing?.defaultGateway) out.push(`ip default-gateway ${d.routing.defaultGateway}`);
    if (d.routing?.staticRoutes?.length || d.routing?.defaultGateway) out.push('!');

    if (d.services?.dhcp?.enabled) {
        for (const p of d.services.dhcp.pools) {
            p.excluded.forEach(e => out.push(`ip dhcp excluded-address ${e}`));
            out.push(`ip dhcp pool ${p.name}`);
            if (p.network) out.push(` network ${p.network} ${p.mask}`);
            if (p.gateway) out.push(` default-router ${p.gateway}`);
            if (p.dnsServer) out.push(` dns-server ${p.dnsServer}`);
            if (p.domain) out.push(` domain-name ${p.domain}`);
            out.push(` lease 0 ${p.leaseHours}`, '!');
        }
    }
    if (d.nat?.enabled) {
        out.push(`ip nat inside source list 1 interface ${d.interfaces.find(i => i.natRole === 'outside')?.name || 'GigabitEthernet0/0/0'} overload`, '!');
    }
    for (const acl of d.acls || []) {
        out.push(`ip access-list ${acl.type} ${acl.name}`);
        acl.rules.sort((a, b) => a.seq - b.seq).forEach(r => {
            out.push(` ${r.seq} ${r.action} ${r.protocol} ${r.srcAny ? 'any' : `${r.src} ${r.srcWildcard}`}${acl.type === 'extended' ? ` ${r.dstAny ? 'any' : `${r.dst} ${r.dstWildcard}`}` : ''}${r.dstPort ? ` eq ${r.dstPort}` : ''}`);
        });
        out.push('!');
    }
    if (d.stp) {
        if (!d.stp.enabled) out.push('no spanning-tree vlan 1', '!');
        else if (d.stp.priority !== 32768) out.push(`spanning-tree vlan 1 priority ${d.stp.priority}`, '!');
    }
    if (d.wireless) {
        out.push(`dot11 ssid ${d.wireless.ssid}`,
            ` authentication ${d.wireless.security}`,
            ` band ${d.wireless.band} channel ${d.wireless.channel}`, '!');
    }
    for (const r of d.services?.dns?.records || []) {
        out.push(`ip host ${r.name} ${r.value}`);
    }
    out.push('end', '');
    return out;
}

/* ─────────────── contextual help ─────────────── */

function helpFor(session: CliSession): CliLine[] {
    switch (session.mode) {
        case 'user': return [
            ln('info', 'User EXEC commands:'),
            ln('output', '  enable                 enter privileged EXEC mode'),
            ln('output', '  ping <ip>              send ICMP echoes'),
            ln('output', '  traceroute <ip>        discover the path'),
            ln('output', '  show version           device information'),
        ];
        case 'privileged': return [
            ln('info', 'Privileged EXEC commands:'),
            ln('output', '  configure terminal     enter global configuration mode'),
            ln('output', '  show ...               see "show ?" below'),
            ln('output', '  ping / traceroute      connectivity tests'),
            ln('output', '  clear mac address-table | arp | ip nat translation | counters'),
            ln('output', '  write                  save the configuration'),
            ln('output', '  reload                 restart the device'),
            ...helpForShow(),
        ];
        case 'config': return helpForConfig();
        case 'config-if': return helpForConfigIf();
        case 'config-vlan': return [ln('info', 'VLAN configuration:'), ln('output', '  name <vlan-name>'), ln('output', '  exit')];
        case 'config-router': return [
            ln('info', 'Router configuration:'),
            ln('output', '  network <addr> <wildcard> area <n>    (OSPF)'),
            ln('output', '  network <classful-network>            (RIP)'),
            ln('output', '  router-id <a.b.c.d>'),
            ln('output', '  version {1|2}                        (RIP)'),
        ];
        case 'config-dhcp': return [
            ln('info', 'DHCP pool configuration:'),
            ln('output', '  network <network> <mask>'),
            ln('output', '  default-router <ip>'),
            ln('output', '  dns-server <ip>'),
            ln('output', '  domain-name <name>'),
            ln('output', '  lease <days> <hours>'),
            ln('output', '  range <start> <end>'),
        ];
        default: return [ln('output', 'No help available in this mode.')];
    }
}

function helpForShow(): CliLine[] {
    return [
        ln('info', 'show commands:'),
        ln('output', '  show ip interface brief      one-line status of every interface'),
        ln('output', '  show interfaces [name]       full interface detail and counters'),
        ln('output', '  show ip route                the routing table'),
        ln('output', '  show mac address-table       what the switch has learned'),
        ln('output', '  show vlan brief              VLANs and their ports'),
        ln('output', '  show spanning-tree           root bridge and port roles'),
        ln('output', '  show arp                     the ARP cache'),
        ln('output', '  show ip dhcp binding|pool    DHCP leases and pools'),
        ln('output', '  show ip nat translations     the NAT table'),
        ln('output', '  show access-lists            ACLs and hit counts'),
        ln('output', '  show cdp neighbors           what is on the other end of each cable'),
        ln('output', '  show ip protocols            routing protocol status'),
        ln('output', '  show dot11 / show wireless   radio and SSID status'),
        ln('output', '  show running-config          the whole configuration'),
    ];
}

function helpForConfig(): CliLine[] {
    return [
        ln('info', 'Global configuration commands:'),
        ln('output', '  hostname <name>'),
        ln('output', '  interface <name>                    e.g. interface gi0/1, interface vlan 10'),
        ln('output', '  vlan <id>  →  name <vlan-name>'),
        ln('output', '  ip routing                          enable L3 forwarding on a multilayer switch'),
        ln('output', '  ip route <net> <mask> <next-hop>    static route'),
        ln('output', '  ip default-gateway <ip>'),
        ln('output', '  ip name-server <ip>'),
        ln('output', '  router ospf <pid> | router rip'),
        ln('output', '  ip dhcp pool <name>'),
        ln('output', '  ip dhcp excluded-address <ip>'),
        ln('output', '  ip access-list {standard|extended} <name>'),
        ln('output', '  access-list <name> {permit|deny} <proto> <src> [wc] [dst wc] [eq port]'),
        ln('output', '  ip nat inside source list 1 interface <if> overload'),
        ln('output', '  spanning-tree vlan 1 priority <n>   |  no spanning-tree'),
        ln('output', '  ip host <name> <ip>'),
        ln('output', '  exit / end'),
    ];
}

function helpForConfigIf(): CliLine[] {
    return [
        ln('info', 'Interface configuration commands:'),
        ln('output', '  ip address <ip> <mask>   |  ip address dhcp'),
        ln('output', '  ipv6 address <addr>/<prefix>'),
        ln('output', '  no shutdown  /  shutdown'),
        ln('output', '  description <text>'),
        ln('output', '  switchport mode {access|trunk}'),
        ln('output', '  switchport access vlan <id>'),
        ln('output', '  switchport trunk allowed vlan <list>'),
        ln('output', '  switchport trunk native vlan <id>'),
        ln('output', '  switchport voice vlan <id>'),
        ln('output', '  encapsulation dot1q <vlan-id>'),
        ln('output', '  ip nat {inside|outside}'),
        ln('output', '  ip access-group <name> {in|out}'),
        ln('output', '  ip helper-address <dhcp-server>'),
        ln('output', '  duplex {auto|full|half}  /  speed <mbps>  /  mtu <bytes>'),
        ln('output', '  clock rate <bps>                    (serial DCE end)'),
        ln('output', '  spanning-tree portfast'),
        ln('output', '  exit / end'),
    ];
}

/** Tab-completion candidates for the terminal input. */
export function completions(session: CliSession, device: Device, partial: string): string[] {
    const p = partial.toLowerCase().trimStart();
    const pool = isHostShell(device)
        ? ['ipconfig', 'ipconfig /all', 'ipconfig /renew', 'ping ', 'tracert ', 'nslookup ', 'arp -a', 'route print', 'netstat', 'curl http://', 'getmac', 'set ip ', 'set dns ', 'set gateway ', 'set wifi ', 'help', 'clear']
        : session.mode === 'user' ? ['enable', 'ping ', 'traceroute ', 'show version', 'exit']
        : session.mode === 'privileged' ? [
            'configure terminal', 'show ip interface brief', 'show ip route', 'show mac address-table',
            'show vlan brief', 'show spanning-tree', 'show arp', 'show running-config', 'show interfaces',
            'show ip dhcp binding', 'show ip dhcp pool', 'show ip nat translations', 'show access-lists',
            'show cdp neighbors', 'show ip protocols', 'show dot11', 'ping ', 'traceroute ', 'write',
            'clear mac address-table', 'clear arp', 'reload', 'exit',
        ]
        : session.mode === 'config' ? [
            'hostname ', 'interface ', 'vlan ', 'ip routing', 'ip route ', 'ip default-gateway ',
            'ip name-server ', 'router ospf 1', 'router rip', 'ip dhcp pool ', 'ip dhcp excluded-address ',
            'ip access-list extended ', 'ip access-list standard ', 'access-list ', 'ip nat inside source list 1 interface ',
            'spanning-tree vlan 1 priority ', 'no spanning-tree', 'ip host ', 'exit', 'end',
        ]
        : session.mode === 'config-if' ? [
            'ip address ', 'ip address dhcp', 'no shutdown', 'shutdown', 'description ',
            'switchport mode access', 'switchport mode trunk', 'switchport access vlan ',
            'switchport trunk allowed vlan ', 'switchport trunk native vlan ', 'switchport voice vlan ',
            'encapsulation dot1q ', 'ip nat inside', 'ip nat outside', 'ip access-group ',
            'ip helper-address ', 'duplex auto', 'speed auto', 'mtu 1500', 'clock rate 64000',
            'spanning-tree portfast', 'exit', 'end',
        ]
        : session.mode === 'config-vlan' ? ['name ', 'exit']
        : session.mode === 'config-router' ? ['network ', 'router-id ', 'version 2', 'exit']
        : session.mode === 'config-dhcp' ? ['network ', 'default-router ', 'dns-server ', 'domain-name ', 'lease 0 24', 'range ', 'exit']
        : ['exit'];

    // Interface names are useful completions too.
    const withIfaces = /^int(erface)?\s+\S*$/.test(p) || /^(ip address|switchport)/.test(p)
        ? [...pool, ...device.interfaces.map(i => `interface ${i.short}`)]
        : pool;

    return withIfaces.filter(c => c.startsWith(p)).slice(0, 12);
}

export { ln as cliLine };
