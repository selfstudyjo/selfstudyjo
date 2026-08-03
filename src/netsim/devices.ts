/**
 * src/netsim/devices.ts
 * The device catalogue — every class of network-attached box a student is
 * likely to meet in the field as of 2026, from a 10BASE-T hub to a Wi-Fi 7
 * access point, a 5G fixed-wireless CPE and a Kubernetes worker node.
 *
 * Each entry carries:
 *   • the behavioural `role` the simulation engine switches on,
 *   • realistic port templates (naming AND speeds matter for learning),
 *   • a capability matrix that drives which config tabs appear in the UI,
 *   • `learn[]` notes surfaced in the encyclopedia and the properties panel.
 */

import type { DeviceTypeDef, DeviceCategory, PortMedium } from './types';

export const DEVICE_CATEGORIES: Array<{
    id: DeviceCategory;
    label: string;
    icon: string;
    accent: string;
    blurb: string;
}> = [
    { id: 'end-device', label: 'End Devices', icon: 'pc', accent: '#60a5fa', blurb: 'Hosts that originate and consume traffic.' },
    { id: 'mobile', label: 'Mobile & Wireless Clients', icon: 'phone', accent: '#38bdf8', blurb: 'Battery-powered clients that associate over radio.' },
    { id: 'switching', label: 'Switching', icon: 'switch', accent: '#34d399', blurb: 'Layer-2 and multilayer forwarding inside a site.' },
    { id: 'routing', label: 'Routing', icon: 'router', accent: '#fbbf24', blurb: 'Layer-3 forwarding between networks.' },
    { id: 'wireless', label: 'Wireless Infrastructure', icon: 'ap', accent: '#a78bfa', blurb: 'Access points, controllers and mesh.' },
    { id: 'security', label: 'Security', icon: 'firewall', accent: '#f87171', blurb: 'Policy enforcement, inspection and tunnels.' },
    { id: 'wan', label: 'WAN & Access', icon: 'modem', accent: '#fb923c', blurb: 'Last-mile circuits into the provider network.' },
    { id: 'server', label: 'Servers & Services', icon: 'server', accent: '#22d3ee', blurb: 'Boxes that answer requests: DNS, DHCP, HTTP, mail.' },
    { id: 'iot', label: 'IoT & OT', icon: 'sensor', accent: '#4ade80', blurb: 'Sensors, actuators and industrial control.' },
    { id: 'datacenter', label: 'Data Center', icon: 'vm', accent: '#c084fc', blurb: 'Virtualisation, containers, storage, load balancing.' },
    { id: 'cloud', label: 'Cloud & Internet', icon: 'cloud', accent: '#818cf8', blurb: 'Everything you do not own but still depend on.' },
    { id: 'legacy', label: 'Legacy', icon: 'hub', accent: '#94a3b8', blurb: 'Shared-media gear kept for teaching collisions and CSMA/CD.' },
];

/* ─── Reusable port templates ─────────────────────────────────────── */

const P = {
    fe(count: number, pattern = 'FastEthernet0/{i}', short = 'Fa0/{i}') {
        return { pattern, short, count, medium: 'copper-ethernet' as const, speedMbps: 100 };
    },
    ge(count: number, pattern = 'GigabitEthernet0/{i}', short = 'Gi0/{i}', routed = false) {
        return { pattern, short, count, medium: 'copper-ethernet' as const, speedMbps: 1000, routed };
    },
    ge10(count: number, pattern = 'TenGigabitEthernet1/{i}', short = 'Te1/{i}', routed = false) {
        return { pattern, short, count, medium: 'sfp' as const, speedMbps: 10000, routed };
    },
    ge25(count: number) {
        return { pattern: 'TwentyFiveGigE1/{i}', short: 'Twe1/{i}', count, medium: 'sfp' as const, speedMbps: 25000, routed: true };
    },
    ge100(count: number) {
        return { pattern: 'HundredGigE1/{i}', short: 'Hu1/{i}', count, medium: 'sfp' as const, speedMbps: 100000, routed: true };
    },
    nic(count = 1, speed = 1000) {
        // Above 10 Gbps there is no RJ45 in practice — data-center NICs are
        // SFP28/QSFP, which is also why they cable to a leaf switch and not to a
        // copper access switch.
        const medium: PortMedium = speed >= 25000 ? 'sfp' : 'copper-ethernet';
        return { pattern: count > 1 ? 'Ethernet{i}' : 'Ethernet0', short: count > 1 ? 'Eth{i}' : 'Eth0', count, medium, speedMbps: speed, routed: true };
    },
    wifi(count = 1) {
        return { pattern: count > 1 ? 'Wireless{i}' : 'Wireless0', short: count > 1 ? 'Wl{i}' : 'Wl0', count, medium: 'wireless' as const, speedMbps: 1200, routed: true };
    },
    radio(count: number) {
        return { pattern: 'Radio{i}', short: 'Ra{i}', count, medium: 'wireless' as const, speedMbps: 2400 };
    },
    serial(count: number) {
        return { pattern: 'Serial0/{i}/0', short: 'Se0/{i}/0', count, medium: 'serial' as const, speedMbps: 2, routed: true };
    },
    fiber(count: number, speed = 10000) {
        return { pattern: 'FiberEthernet0/{i}', short: 'Fi0/{i}', count, medium: 'fiber' as const, speedMbps: speed, routed: true };
    },
    coax(count = 1) {
        return { pattern: 'Coax0', short: 'Cx0', count, medium: 'coaxial' as const, speedMbps: 1000, routed: true };
    },
    cellular(count = 1) {
        return { pattern: 'Cellular0/{i}', short: 'Ce0/{i}', count, medium: 'cellular' as const, speedMbps: 1000, routed: true };
    },
    poe(count: number) {
        return { pattern: 'GigabitEthernet1/0/{i}', short: 'Gi1/0/{i}', count, medium: 'copper-ethernet' as const, speedMbps: 1000, poe: true };
    },
    console() {
        return { pattern: 'Console0', short: 'Con0', count: 1, medium: 'console' as const, speedMbps: 0 };
    },
};

const CAP = {
    host: { cli: true, dhcpClient: true, ipv6: true },
    server: { cli: true, dhcpClient: true, dhcpServer: true, dnsServer: true, httpServer: true, ipv6: true },
    switch: { cli: true, vlans: true, stp: true, acl: true, ipv6: true },
    multilayer: { cli: true, vlans: true, stp: true, routing: true, acl: true, dhcpServer: true, ipv6: true },
    router: { cli: true, routing: true, nat: true, acl: true, dhcpServer: true, ipv6: true, vpn: true },
    firewall: { cli: true, routing: true, nat: true, acl: true, ipv6: true, vpn: true },
    ap: { cli: true, wireless: true, vlans: true, ipv6: true },
    dumb: {},
};

/* ─── The catalogue ───────────────────────────────────────────────── */

export const DEVICE_TYPES: DeviceTypeDef[] = [
    /* ═══════════════ End devices ═══════════════ */
    {
        id: 'pc', name: 'Desktop PC', category: 'end-device', role: 'host', layer: 7,
        icon: 'pc', accent: '#60a5fa', year: 1981,
        blurb: 'A wired workstation. The classic source and sink of traffic in every lab.',
        learn: [
            'A PC only needs three things to reach the Internet: an IP address, a subnet mask and a default gateway.',
            'It compares the destination IP against its own network using the mask. Same network → ARP directly. Different network → send the frame to the gateway MAC.',
            'The destination IP in the packet never changes; only the destination MAC in the frame is rewritten hop by hop.',
        ],
        ports: [P.nic(1, 1000)],
        supports: CAP.host, tags: ['host', 'ethernet', 'layer3', 'dhcp'],
    },
    {
        id: 'laptop', name: 'Laptop', category: 'end-device', role: 'host', layer: 7,
        icon: 'laptop', accent: '#38bdf8', year: 1985,
        blurb: 'Dual-homed client: one Ethernet NIC plus a Wi-Fi radio.',
        learn: [
            'A laptop has two interfaces with two different MAC addresses — wired and wireless are separate Layer-2 identities.',
            'When both are up the OS picks the route with the lowest metric; that is why unplugging Ethernet fails traffic over to Wi-Fi.',
            'Wireless association happens at Layer 2 (802.11) before any IP configuration is even attempted.',
        ],
        ports: [P.nic(1, 1000), P.wifi(1)],
        supports: { ...CAP.host, wireless: true }, tags: ['host', 'wifi', 'ethernet', 'mobile'],
    },
    {
        id: 'workstation', name: 'Engineering Workstation', category: 'end-device', role: 'host', layer: 7,
        icon: 'pc', accent: '#818cf8', year: 2015,
        blurb: 'High-throughput client with a 10 GbE NIC — used for CAD, video and ML work.',
        learn: [
            '10 GbE over copper (10GBASE-T) is limited to ~30 m on Cat6; Cat6a is required for the full 100 m.',
            'Enable jumbo frames (MTU 9000) end-to-end or the larger MTU is silently fragmented.',
        ],
        ports: [{ ...P.nic(1, 10000), medium: 'copper-ethernet' as const }],
        supports: CAP.host, tags: ['host', '10gbe', 'jumbo'],
    },
    {
        id: 'thin-client', name: 'Thin Client', category: 'end-device', role: 'host', layer: 7,
        icon: 'pc', accent: '#7dd3fc', year: 1998,
        blurb: 'Diskless endpoint that boots and runs its desktop from a server.',
        learn: [
            'Thin clients rely on PXE: DHCP hands out the IP *and* the TFTP boot server (options 66/67).',
            'They are extremely sensitive to latency — a 50 ms round trip makes the remote desktop feel broken.',
        ],
        ports: [P.nic(1, 1000)],
        supports: CAP.host, tags: ['host', 'pxe', 'vdi'],
    },
    {
        id: 'printer', name: 'Network Printer', category: 'end-device', role: 'host', layer: 7,
        icon: 'printer', accent: '#a3a3a3', year: 1994,
        blurb: 'Printer with its own IP stack, listening on 9100 (RAW) and 631 (IPP).',
        learn: [
            'Give printers a DHCP reservation or a static IP — a changing address breaks every installed print queue.',
            'mDNS/Bonjour discovery is link-local multicast, so it does not cross a router unless you configure an mDNS reflector.',
        ],
        ports: [P.nic(1, 100), P.wifi(1)],
        supports: { ...CAP.host, wireless: true }, tags: ['host', 'printer', 'mdns'],
    },
    {
        id: 'ip-phone', name: 'VoIP Phone', category: 'end-device', role: 'host', layer: 7,
        icon: 'phone-voip', accent: '#2dd4bf', year: 1998,
        blurb: 'SIP handset with a built-in 2-port switch for the PC behind it.',
        learn: [
            'A phone uses two VLANs on one cable: the voice VLAN is 802.1Q-tagged, the PC data VLAN is untagged.',
            'The switch tells the phone which voice VLAN to use over CDP/LLDP-MED — no manual phone config needed.',
            'Voice needs QoS: mark RTP as EF (DSCP 46) and give it priority queuing or calls choppy under load.',
        ],
        ports: [{ ...P.nic(2, 100), pattern: 'Ethernet{i}', short: 'Eth{i}' }],
        supports: CAP.host, tags: ['voip', 'sip', 'qos', 'voice-vlan'],
    },
    {
        id: 'ip-camera', name: 'IP Camera', category: 'end-device', role: 'host', layer: 7,
        icon: 'camera', accent: '#f472b6', year: 1996,
        blurb: 'PoE surveillance camera streaming RTSP/ONVIF.',
        learn: [
            'Cameras are the classic PoE load — budget the switch: 802.3af = 15.4 W, at = 30 W, bt = up to 90 W per port.',
            'Put cameras in their own VLAN with an ACL: they should talk to the NVR and nothing else.',
            'Multicast streaming saves bandwidth but needs IGMP snooping on, or the switch floods every port.',
        ],
        ports: [{ ...P.nic(1, 100), poe: true }],
        supports: CAP.host, tags: ['camera', 'poe', 'rtsp', 'multicast'],
    },
    {
        id: 'smart-tv', name: 'Smart TV', category: 'end-device', role: 'host', layer: 7,
        icon: 'tv', accent: '#c084fc', year: 2010,
        blurb: 'Streaming client — heavy, bursty, latency-tolerant downstream traffic.',
        learn: [
            '4K streaming needs ~25 Mbps sustained; 8K needs ~85 Mbps. Buffering is usually upstream congestion, not Wi-Fi.',
            'Smart TVs are notorious for chatty discovery (SSDP/mDNS) — isolate them in an IoT VLAN.',
        ],
        ports: [P.nic(1, 1000), P.wifi(1)],
        supports: { ...CAP.host, wireless: true }, tags: ['streaming', 'iot', 'wifi'],
    },
    {
        id: 'game-console', name: 'Game Console', category: 'end-device', role: 'host', layer: 7,
        icon: 'console-game', accent: '#38bdf8', year: 2001,
        blurb: 'Latency-sensitive client that wants an open NAT type.',
        learn: [
            '"NAT type strict" means the console could not open inbound ports — enable UPnP or add a port forward.',
            'Symmetric NAT breaks peer-to-peer matchmaking; cone NAT with PAT usually works.',
        ],
        ports: [P.nic(1, 1000), P.wifi(1)],
        supports: { ...CAP.host, wireless: true }, tags: ['gaming', 'nat', 'upnp'],
    },

    /* ═══════════════ Mobile clients ═══════════════ */
    {
        id: 'smartphone', name: 'Smartphone', category: 'mobile', role: 'host', layer: 7,
        icon: 'phone', accent: '#38bdf8', year: 2007,
        blurb: 'Wi-Fi 7 + 5G handset that roams between APs and cells.',
        learn: [
            'Modern phones randomise their MAC per SSID for privacy — MAC-based access control is no longer reliable.',
            'Roaming between APs on the same SSID is a Layer-2 reassociation; the IP address is kept, so the TCP session survives.',
            'When Wi-Fi degrades, the phone silently fails over to cellular — the IP changes, so sessions reset.',
        ],
        ports: [P.wifi(1), P.cellular(1)],
        supports: { ...CAP.host, wireless: true }, tags: ['mobile', 'wifi7', '5g', 'roaming'],
    },
    {
        id: 'tablet', name: 'Tablet', category: 'mobile', role: 'host', layer: 7,
        icon: 'tablet', accent: '#7dd3fc', year: 2010,
        blurb: 'Wireless-only client, typical BYOD device on a guest or 802.1X SSID.',
        learn: [
            'BYOD devices normally land on a guest SSID that is client-isolated and mapped to its own VLAN.',
            'Captive portals work by intercepting the first HTTP request — HTTPS-only clients see a certificate error instead.',
        ],
        ports: [P.wifi(1)],
        supports: { ...CAP.host, wireless: true }, tags: ['mobile', 'byod', 'guest'],
    },
    {
        id: 'smartwatch', name: 'Smartwatch', category: 'mobile', role: 'host', layer: 7,
        icon: 'watch', accent: '#f9a8d4', year: 2015,
        blurb: 'Low-power wearable, usually on 2.4 GHz only.',
        learn: [
            'Wearables often support only 2.4 GHz and 20 MHz channels — do not disable the 2.4 GHz band entirely.',
            'They sleep aggressively; the AP must buffer frames and honour the power-save poll.',
        ],
        ports: [{ ...P.wifi(1), speedMbps: 72 }],
        supports: { ...CAP.host, wireless: true }, tags: ['wearable', '2.4ghz', 'power-save'],
    },
    {
        id: 'ar-headset', name: 'AR/VR Headset', category: 'mobile', role: 'host', layer: 7,
        icon: 'headset', accent: '#c084fc', year: 2023,
        blurb: 'Wi-Fi 6E/7 client needing very low jitter for wireless streaming.',
        learn: [
            'AR/VR is the flagship use case for 6 GHz: clean spectrum, 160/320 MHz channels, sub-5 ms jitter.',
            'Enable WMM/QoS and OFDMA — throughput matters less than consistent latency.',
        ],
        ports: [{ ...P.wifi(1), speedMbps: 5000, medium: 'wireless' as const }],
        supports: { ...CAP.host, wireless: true }, tags: ['xr', 'wifi6e', 'low-latency'],
    },

    /* ═══════════════ Switching ═══════════════ */
    {
        id: 'switch-unmanaged', name: 'Unmanaged Switch (5-port)', category: 'switching', role: 'switch', layer: 2,
        icon: 'switch', accent: '#6ee7b7', year: 1995,
        blurb: 'Plug-and-play desktop switch. No VLANs, no CLI, no visibility.',
        learn: [
            'Even an unmanaged switch still learns MAC addresses and forwards selectively — that is what makes it a switch and not a hub.',
            'No VLAN support means everything on it shares one broadcast domain.',
        ],
        ports: [{ ...P.nic(5, 1000), pattern: 'Port{i}', short: 'P{i}' }],
        supports: {}, tags: ['switch', 'layer2', 'soho'],
    },
    {
        id: 'switch-24', name: 'Access Switch (24-port)', category: 'switching', role: 'switch', layer: 2,
        icon: 'switch', accent: '#34d399', year: 2000,
        blurb: 'Managed Layer-2 access switch with VLANs, STP and trunking.',
        learn: [
            'A switch builds its MAC address table by reading the SOURCE MAC of every frame it receives.',
            'Unknown-unicast, broadcast and multicast frames are flooded to every port in the VLAN except the one they arrived on.',
            'A trunk carries many VLANs by adding a 4-byte 802.1Q tag; the native VLAN is the one sent untagged.',
            'Each VLAN is a separate broadcast domain and needs its own IP subnet.',
        ],
        ports: [P.poe(24), P.ge10(2, 'TenGigabitEthernet1/1/{i}', 'Te1/1/{i}')],
        supports: { ...CAP.switch, poe: true }, tags: ['switch', 'vlan', 'stp', 'trunk', 'poe'],
    },
    {
        id: 'switch-48', name: 'Access Switch (48-port PoE+)', category: 'switching', role: 'switch', layer: 2,
        icon: 'switch', accent: '#10b981', year: 2010,
        blurb: 'High-density wiring-closet switch with a PoE budget and 10G uplinks.',
        learn: [
            'PoE budget is shared: 48 ports × 30 W is 1440 W, far above a typical 740 W supply — plan per-port priorities.',
            'Uplinks should be faster than access ports; 48 × 1 G into 2 × 10 G is a 2.4:1 oversubscription.',
        ],
        ports: [P.poe(48), P.ge10(4, 'TenGigabitEthernet1/1/{i}', 'Te1/1/{i}')],
        supports: { ...CAP.switch, poe: true }, tags: ['switch', 'poe+', 'density'],
    },
    {
        id: 'switch-l3', name: 'Multilayer Switch (L3)', category: 'switching', role: 'multilayer', layer: 3,
        icon: 'switch-l3', accent: '#059669', year: 1997,
        blurb: 'Switch that also routes: SVIs per VLAN, inter-VLAN routing at wire speed.',
        learn: [
            'Inter-VLAN routing on a multilayer switch uses an SVI — a virtual interface named `interface vlan 10` with an IP.',
            'You must `ip routing` globally, otherwise the SVIs exist but nothing is forwarded between them.',
            'This replaces "router-on-a-stick": no trunk to an external router, no hairpinning.',
        ],
        ports: [P.ge(24, 'GigabitEthernet1/0/{i}', 'Gi1/0/{i}'), P.ge10(8, 'TenGigabitEthernet1/1/{i}', 'Te1/1/{i}')],
        supports: CAP.multilayer, tags: ['switch', 'layer3', 'svi', 'inter-vlan'],
    },
    {
        id: 'switch-leaf', name: 'Data Center Leaf Switch', category: 'switching', role: 'multilayer', layer: 3,
        icon: 'switch-l3', accent: '#14b8a6', year: 2013,
        blurb: 'Top-of-rack leaf: 25G to servers, 100G to spines, VXLAN/EVPN capable.',
        learn: [
            'Leaf-spine replaces the old three-tier design: every leaf connects to every spine, so any two servers are 2 hops apart.',
            'STP is not used inside the fabric — ECMP routing (or VXLAN/EVPN) uses every link at once instead of blocking half of them.',
        ],
        ports: [P.ge25(32), P.ge100(4)],
        supports: CAP.multilayer, tags: ['datacenter', 'leaf-spine', 'vxlan', 'ecmp'],
    },
    {
        id: 'switch-spine', name: 'Data Center Spine Switch', category: 'switching', role: 'multilayer', layer: 3,
        icon: 'switch-l3', accent: '#0d9488', year: 2013,
        blurb: '100/400G spine. Connects only to leaves — never to servers.',
        learn: [
            'Spines carry no host-facing ports. Add a spine and you add fabric bandwidth without redesigning anything.',
            'Fabric links run a routing protocol (usually eBGP), so the underlay converges in well under a second.',
        ],
        ports: [P.ge100(32)],
        supports: CAP.multilayer, tags: ['datacenter', 'spine', 'bgp', '400g'],
    },
    {
        id: 'switch-industrial', name: 'Industrial Switch (DIN-rail)', category: 'switching', role: 'switch', layer: 2,
        icon: 'switch', accent: '#84cc16', year: 2004,
        blurb: 'Hardened switch for factory floors: −40…75 °C, ring redundancy, PROFINET.',
        learn: [
            'OT networks favour ring topologies with sub-50 ms recovery (REP/MRP) because STP convergence is far too slow for a PLC.',
            'Keep OT strictly segmented from IT — the Purdue model puts a firewall between every level.',
        ],
        ports: [P.fe(8, 'FastEthernet1/{i}', 'Fa1/{i}'), P.ge(2, 'GigabitEthernet1/{i}', 'Gi1/{i}')],
        supports: CAP.switch, tags: ['industrial', 'ot', 'ring', 'profinet'],
    },

    /* ═══════════════ Routing ═══════════════ */
    {
        id: 'router-soho', name: 'Home Router', category: 'routing', role: 'router', layer: 3,
        icon: 'wifi-router', accent: '#facc15', year: 1999,
        blurb: 'The all-in-one box: router + switch + AP + DHCP server + NAT + firewall.',
        learn: [
            'One physical box, five logical roles. Understanding which role is doing what is the whole point of this simulator.',
            'The WAN port gets a public address from the ISP; everything inside shares it via PAT (NAT overload).',
            'Its DHCP server hands out the LAN gateway (itself) and a DNS resolver in one DHCP Offer.',
        ],
        ports: [
            { ...P.nic(1, 1000), pattern: 'WAN0', short: 'WAN0' },
            { pattern: 'LAN{i}', short: 'LAN{i}', count: 4, medium: 'copper-ethernet' as const, speedMbps: 1000 },
            P.radio(2),
        ],
        supports: { ...CAP.router, wireless: true, dhcpServer: true }, tags: ['soho', 'nat', 'dhcp', 'wifi', 'all-in-one'],
    },
    {
        id: 'router-branch', name: 'Branch Router (ISR)', category: 'routing', role: 'router', layer: 3,
        icon: 'router', accent: '#fbbf24', year: 2004,
        blurb: 'Enterprise branch router: routed Gi ports, serial WAN, NAT, ACLs, VPN.',
        learn: [
            'Router interfaces are shut down by default — `no shutdown` is not optional.',
            'A router never forwards a broadcast. Every interface is a separate broadcast domain, which is why routers "break up" networks.',
            'Longest-prefix match wins: 10.1.1.0/24 beats 10.1.0.0/16 beats 0.0.0.0/0 for 10.1.1.5.',
            'Administrative distance breaks ties between protocols: connected 0, static 1, eBGP 20, OSPF 110, RIP 120.',
        ],
        ports: [P.ge(4, 'GigabitEthernet0/0/{i}', 'Gi0/0/{i}', true), P.serial(2), P.console()],
        supports: CAP.router, tags: ['router', 'wan', 'nat', 'acl', 'vpn', 'ospf'],
    },
    {
        id: 'router-core', name: 'Core Router', category: 'routing', role: 'router', layer: 3,
        icon: 'router-core', accent: '#f59e0b', year: 2000,
        blurb: 'High-capacity aggregation router with 10/100G interfaces and full BGP.',
        learn: [
            'Core routers do not do access control or NAT — they forward as fast as possible and nothing else.',
            'A full BGP table is around a million IPv4 prefixes in 2026, so core boxes are sized by TCAM, not by port count.',
        ],
        ports: [P.ge10(8, 'TenGigabitEthernet0/{i}', 'Te0/{i}', true), P.ge100(2)],
        supports: CAP.router, tags: ['core', 'bgp', 'mpls', '100g'],
    },
    {
        id: 'router-edge', name: 'Internet Edge Router', category: 'routing', role: 'router', layer: 3,
        icon: 'router-core', accent: '#fb923c', year: 1995,
        blurb: 'Faces the provider: BGP peering, public addressing, DDoS scrubbing hand-off.',
        learn: [
            'The edge is where you own the public prefix and where the default route usually comes from.',
            'Filter BGP in both directions: accept only what your provider should send, advertise only your own prefixes.',
        ],
        ports: [P.ge10(4, 'TenGigabitEthernet0/{i}', 'Te0/{i}', true), P.ge(2, 'GigabitEthernet0/{i}', 'Gi0/{i}', true)],
        supports: CAP.router, tags: ['edge', 'bgp', 'peering', 'public-ip'],
    },
    {
        id: 'router-sdwan', name: 'SD-WAN Edge', category: 'routing', role: 'router', layer: 3,
        icon: 'sdwan', accent: '#f97316', year: 2015,
        blurb: 'Policy-driven WAN edge that bonds broadband, MPLS and LTE/5G.',
        learn: [
            'SD-WAN measures loss/latency/jitter per tunnel and steers each application to the best path in real time.',
            'The control plane is centralised; the edge box just receives policy and builds IPsec tunnels to its peers.',
        ],
        ports: [P.ge(4, 'GigabitEthernet0/{i}', 'Gi0/{i}', true), P.cellular(1)],
        supports: CAP.router, tags: ['sdwan', 'ipsec', 'app-aware', '5g'],
    },
    {
        id: 'router-virtual', name: 'Virtual Router (VM)', category: 'routing', role: 'router', layer: 3,
        icon: 'vm', accent: '#eab308', year: 2012,
        blurb: 'Router as software on a hypervisor or in a cloud VPC.',
        learn: [
            'The forwarding logic is identical to hardware; the difference is throughput ceiling and how you license it.',
            'In a cloud VPC the "router" is usually invisible — you configure route tables instead of interfaces.',
        ],
        ports: [P.nic(4, 10000)],
        supports: CAP.router, tags: ['nfv', 'cloud', 'virtual'],
    },

    /* ═══════════════ Wireless ═══════════════ */
    {
        id: 'ap-wifi6', name: 'Access Point (Wi-Fi 6)', category: 'wireless', role: 'ap', layer: 2,
        icon: 'ap', accent: '#a78bfa', year: 2019,
        blurb: '802.11ax dual-band AP. Bridges radio clients into wired VLANs.',
        learn: [
            'An AP is a Layer-2 bridge, not a router. It converts 802.11 frames to 802.3 frames and forwards them.',
            'Wi-Fi is half-duplex and shared: every client on a radio contends for the same airtime (CSMA/CA).',
            'OFDMA in Wi-Fi 6 lets the AP serve several small clients in one transmission — huge for dense IoT.',
            'Use 20 MHz channels on 2.4 GHz (only 1, 6, 11 do not overlap) and 40/80 MHz on 5 GHz.',
        ],
        ports: [{ ...P.nic(1, 2500), poe: true, pattern: 'GigabitEthernet0', short: 'Gi0' }, P.radio(2)],
        supports: CAP.ap, tags: ['wifi6', '802.11ax', 'ofdma', 'poe'],
    },
    {
        id: 'ap-wifi7', name: 'Access Point (Wi-Fi 7)', category: 'wireless', role: 'ap', layer: 2,
        icon: 'ap', accent: '#8b5cf6', year: 2024,
        blurb: '802.11be tri-band AP with 6 GHz, 320 MHz channels and MLO.',
        learn: [
            'Wi-Fi 7 adds Multi-Link Operation: a client uses 5 GHz and 6 GHz simultaneously for redundancy and throughput.',
            '320 MHz channels only exist in 6 GHz, and 6 GHz requires WPA3 — no legacy WPA2 fallback.',
            'A Wi-Fi 7 AP can exceed 5 Gbps, so a 1 GbE uplink becomes the bottleneck. Use 2.5/5/10 GbE + PoE++.',
        ],
        ports: [{ ...P.nic(1, 10000), poe: true, pattern: 'MultigigabitEthernet0', short: 'Mgi0' }, P.radio(3)],
        supports: CAP.ap, tags: ['wifi7', '802.11be', 'mlo', '6ghz', 'wpa3'],
    },
    {
        id: 'ap-mesh', name: 'Mesh Node', category: 'wireless', role: 'ap', layer: 2,
        icon: 'mesh', accent: '#c4b5fd', year: 2016,
        blurb: 'Wireless-backhaul AP for areas with no cable run.',
        learn: [
            'Each mesh hop roughly halves usable throughput because the radio relays as well as serves.',
            'A dedicated backhaul radio (tri-band mesh) avoids that penalty.',
        ],
        ports: [{ ...P.nic(1, 1000), pattern: 'GigabitEthernet0', short: 'Gi0' }, P.radio(3)],
        supports: CAP.ap, tags: ['mesh', 'backhaul', 'wireless'],
    },
    {
        id: 'wlc', name: 'Wireless LAN Controller', category: 'wireless', role: 'wlc', layer: 3,
        icon: 'wlc', accent: '#9333ea', year: 2005,
        blurb: 'Central brain for many APs: RF planning, WLAN/SSID policy, fast roaming.',
        learn: [
            'Lightweight APs build a CAPWAP tunnel to the controller; client data can be tunnelled centrally or switched locally.',
            'The controller runs RRM: it picks channels and power levels automatically to reduce co-channel interference.',
            'Fast roaming (802.11r) pre-authenticates a client to neighbouring APs so a voice call survives the handoff.',
        ],
        ports: [P.ge(4, 'GigabitEthernet0/0/{i}', 'Gi0/0/{i}', true)],
        supports: { cli: true, wireless: true, vlans: true, routing: true, ipv6: true }, tags: ['wlc', 'capwap', 'rrm', '802.11r'],
    },
    {
        id: 'wifi-bridge', name: 'Outdoor Wireless Bridge', category: 'wireless', role: 'ap', layer: 2,
        icon: 'bridge', accent: '#a5b4fc', year: 2002,
        blurb: 'Point-to-point link between two buildings, kilometres apart.',
        learn: [
            'A bridge pair extends one Layer-2 segment across the air — both ends stay in the same broadcast domain.',
            'Needs clear line of sight and Fresnel-zone clearance; rain fade matters above 10 GHz.',
        ],
        ports: [{ ...P.nic(1, 1000), poe: true, pattern: 'GigabitEthernet0', short: 'Gi0' }, P.radio(1)],
        supports: CAP.ap, tags: ['ptp', 'outdoor', 'bridge'],
    },
    {
        id: 'wifi-extender', name: 'Wi-Fi Range Extender', category: 'wireless', role: 'repeater', layer: 1,
        icon: 'repeater', accent: '#ddd6fe', year: 2008,
        blurb: 'Repeats an existing SSID. Cheap, and halves your throughput.',
        learn: [
            'A repeater receives and retransmits on the same radio, so the airtime cost doubles and throughput roughly halves.',
            'Prefer a cabled AP or mesh with a dedicated backhaul radio whenever a cable run is possible.',
        ],
        ports: [P.radio(2), { ...P.nic(1, 100), pattern: 'Ethernet0', short: 'Eth0' }],
        supports: { wireless: true }, tags: ['repeater', 'extender', 'throughput'],
    },

    /* ═══════════════ Security ═══════════════ */
    {
        id: 'firewall-ngfw', name: 'Next-Gen Firewall', category: 'security', role: 'firewall', layer: 7,
        icon: 'firewall', accent: '#ef4444', year: 2009,
        blurb: 'Stateful firewall with app awareness, TLS inspection, IPS and user identity.',
        learn: [
            'Stateful means the return traffic of an allowed session is permitted automatically — you only write the rule once.',
            'Zones (inside / outside / DMZ) express trust; traffic between zones needs an explicit policy.',
            'Application-ID beats port numbers: blocking TCP 443 no longer blocks "the web" when everything tunnels over it.',
            'Default deny at the bottom of the rule base is the entire point. An implicit permit is a breach waiting to happen.',
        ],
        ports: [P.ge(8, 'GigabitEthernet1/{i}', 'Gi1/{i}', true), P.ge10(2, 'TenGigabitEthernet1/{i}', 'Te1/{i}', true)],
        supports: CAP.firewall, tags: ['firewall', 'ngfw', 'zones', 'ips', 'tls'],
    },
    {
        id: 'firewall-utm', name: 'UTM Appliance', category: 'security', role: 'firewall', layer: 7,
        icon: 'firewall', accent: '#f87171', year: 2004,
        blurb: 'All-in-one small-business security: firewall, AV, web filter, VPN.',
        learn: [
            'UTM trades depth for simplicity — fine for a 30-seat office, a bottleneck for a data center.',
            'Enabling every inspection engine can cut throughput by 70 %. Always size on the *inspected* number.',
        ],
        ports: [P.ge(6, 'Port{i}', 'P{i}', true)],
        supports: CAP.firewall, tags: ['utm', 'smb', 'av', 'web-filter'],
    },
    {
        id: 'ids-ips', name: 'IDS / IPS Sensor', category: 'security', role: 'firewall', layer: 7,
        icon: 'ids', accent: '#dc2626', year: 1998,
        blurb: 'Signature and anomaly detection. Inline (IPS) blocks; out-of-band (IDS) only alerts.',
        learn: [
            'An IDS sits on a SPAN/mirror port and cannot stop anything. An IPS is inline and can drop the packet.',
            'Inline means it is now a single point of failure — plan fail-open vs fail-closed deliberately.',
        ],
        ports: [P.ge(4, 'GigabitEthernet0/{i}', 'Gi0/{i}', true)],
        supports: { cli: true, acl: true, ipv6: true }, tags: ['ids', 'ips', 'span', 'signatures'],
    },
    {
        id: 'vpn-gateway', name: 'VPN Gateway', category: 'security', role: 'firewall', layer: 3,
        icon: 'vpn', accent: '#b91c1c', year: 1998,
        blurb: 'Terminates IPsec site-to-site tunnels and remote-access clients.',
        learn: [
            'IPsec has two phases: IKE builds the management tunnel, then ESP encrypts the actual data.',
            'A tunnel adds ~60 bytes of overhead, so the effective MTU drops — set TCP MSS to 1350 or you get black-hole fragmentation.',
        ],
        ports: [P.ge(4, 'GigabitEthernet0/{i}', 'Gi0/{i}', true)],
        supports: { ...CAP.firewall, vpn: true }, tags: ['ipsec', 'ike', 'mtu', 'remote-access'],
    },
    {
        id: 'proxy', name: 'Web Proxy / SWG', category: 'security', role: 'server', layer: 7,
        icon: 'proxy', accent: '#f43f5e', year: 1994,
        blurb: 'Forward proxy for outbound web: caching, URL filtering, DLP.',
        learn: [
            'Explicit proxy needs client config (PAC file); transparent proxy intercepts port 80/443 with a redirect.',
            'To inspect HTTPS the proxy must present its own certificate — every client needs its CA installed.',
        ],
        ports: [P.nic(2, 10000)],
        supports: { ...CAP.server, acl: true }, tags: ['proxy', 'swg', 'pac', 'tls-inspection'],
    },
    {
        id: 'nac-radius', name: 'NAC / RADIUS Server', category: 'security', role: 'server', layer: 7,
        icon: 'shield', accent: '#e11d48', year: 2000,
        blurb: '802.1X authentication, posture checks, dynamic VLAN assignment.',
        learn: [
            '802.1X has three roles: supplicant (client), authenticator (switch/AP) and authentication server (RADIUS).',
            'On success RADIUS can return a VLAN — the port is put in the right VLAN based on *who* logged in, not where they plugged in.',
            'Always configure a fallback (MAB or guest VLAN) or a failed RADIUS takes the whole floor offline.',
        ],
        ports: [P.nic(2, 1000)],
        supports: CAP.server, tags: ['802.1x', 'radius', 'nac', 'dynamic-vlan'],
    },

    /* ═══════════════ WAN & access ═══════════════ */
    {
        id: 'modem-dsl', name: 'DSL Modem', category: 'wan', role: 'modem', layer: 1,
        icon: 'modem', accent: '#fb923c', year: 1999,
        blurb: 'Converts Ethernet to VDSL over the telephone pair.',
        learn: [
            'A modem is a media converter: it changes the physical encoding, it does not route.',
            'DSL is distance-limited — the further from the exchange, the lower the sync rate.',
        ],
        ports: [{ ...P.nic(1, 1000), pattern: 'Ethernet0', short: 'Eth0' }, { pattern: 'DSL0', short: 'DSL0', count: 1, medium: 'serial' as const, speedMbps: 100, routed: true }],
        supports: {}, tags: ['dsl', 'modem', 'last-mile'],
    },
    {
        id: 'modem-cable', name: 'Cable Modem (DOCSIS 4.0)', category: 'wan', role: 'modem', layer: 1,
        icon: 'modem', accent: '#f97316', year: 1997,
        blurb: 'Coax access with multi-gigabit downstream.',
        learn: [
            'Cable is a shared medium in the neighbourhood — evening congestion is contention, not your Wi-Fi.',
            'DOCSIS 4.0 finally makes upstream symmetrical-ish (up to ~6 Gbps down / 4 Gbps up).',
        ],
        ports: [{ ...P.nic(1, 10000), pattern: 'Ethernet0', short: 'Eth0' }, P.coax(1)],
        supports: {}, tags: ['docsis', 'coax', 'shared-medium'],
    },
    {
        id: 'ont-fiber', name: 'Fiber ONT (GPON/XGS-PON)', category: 'wan', role: 'modem', layer: 1,
        icon: 'ont', accent: '#fdba74', year: 2005,
        blurb: 'Optical network terminal — the fibre demarcation point.',
        learn: [
            'PON is a passive tree: one fibre from the exchange is split optically to many homes; the split ratio sets contention.',
            'XGS-PON gives symmetric 10 Gbps; the ONT hands you plain Ethernet.',
        ],
        ports: [{ ...P.nic(1, 10000), pattern: 'Ethernet0', short: 'Eth0' }, { ...P.fiber(1, 10000), pattern: 'PON0', short: 'PON0' }],
        supports: {}, tags: ['gpon', 'xgs-pon', 'fiber', 'ftth'],
    },
    {
        id: 'cpe-5g', name: '5G Fixed-Wireless CPE', category: 'wan', role: 'modem', layer: 3,
        icon: 'tower', accent: '#fdba74', year: 2020,
        blurb: '5G router used where fibre has not arrived. CGNAT by default.',
        learn: [
            'Most 5G ISPs put you behind carrier-grade NAT (100.64.0.0/10), so no inbound connections and no port forwarding.',
            'Latency is good (20–40 ms) but jitter is worse than fibre; mmWave is fast but blocked by walls and rain.',
        ],
        ports: [P.cellular(1), { ...P.nic(2, 1000), pattern: 'LAN{i}', short: 'LAN{i}' }, P.radio(2)],
        supports: { ...CAP.router, wireless: true }, tags: ['5g', 'fwa', 'cgnat', 'mmwave'],
    },
    {
        id: 'sat-terminal', name: 'LEO Satellite Terminal', category: 'wan', role: 'modem', layer: 3,
        icon: 'satellite', accent: '#fed7aa', year: 2021,
        blurb: 'Low-earth-orbit dish for remote sites.',
        learn: [
            'LEO cuts satellite latency from ~600 ms (geostationary) to 25–60 ms because the orbit is ~550 km, not 36 000 km.',
            'Handovers between satellites cause periodic packet loss — bad for long-lived TCP, fine with BBR/QUIC.',
        ],
        ports: [{ ...P.nic(1, 1000), pattern: 'Ethernet0', short: 'Eth0' }, { pattern: 'Satellite0', short: 'Sat0', count: 1, medium: 'wireless' as const, speedMbps: 300, routed: true }],
        supports: { ...CAP.router }, tags: ['leo', 'satellite', 'remote'],
    },
    {
        id: 'cell-tower', name: 'Cellular Base Station (gNB)', category: 'wan', role: 'ap', layer: 2,
        icon: 'tower', accent: '#fb923c', year: 2019,
        blurb: '5G NR radio site backhauled into the mobile core.',
        learn: [
            'A gNB is conceptually an AP with scheduling: the network, not the client, decides who transmits when.',
            'Network slicing lets one physical 5G network present separate virtual networks with different SLAs.',
        ],
        ports: [{ ...P.fiber(2, 10000), pattern: 'Backhaul{i}', short: 'Bh{i}' }, { pattern: 'NR-Radio{i}', short: 'NR{i}', count: 3, medium: 'cellular' as const, speedMbps: 2000 }],
        supports: { cli: true, wireless: true }, tags: ['5g', 'gnb', 'slicing', 'ran'],
    },
    {
        id: 'wan-serial', name: 'CSU/DSU (Serial WAN)', category: 'wan', role: 'modem', layer: 1,
        icon: 'serial', accent: '#fdba74', year: 1985,
        blurb: 'Leased-line terminator. Still the classic way to teach DCE/DTE and clock rate.',
        learn: [
            'On a serial link one end is DCE and provides the clock (`clock rate 64000`); the other is DTE.',
            'Forget the clock rate on the DCE side and the line stays down with no obvious error.',
        ],
        ports: [{ ...P.serial(2) }, { ...P.nic(1, 100), pattern: 'Ethernet0', short: 'Eth0' }],
        supports: {}, tags: ['serial', 'dce', 'dte', 'clock-rate', 'leased-line'],
    },

    /* ═══════════════ Servers ═══════════════ */
    {
        id: 'server-generic', name: 'Server', category: 'server', role: 'server', layer: 7,
        icon: 'server', accent: '#22d3ee', year: 1990,
        blurb: 'General-purpose server. Enable any combination of services on it.',
        learn: [
            'A server is just a host that listens. The listening port number is what makes it a "web" or "mail" server.',
            'Servers need static addressing (or a DHCP reservation) because clients find them by a fixed address or DNS name.',
        ],
        ports: [P.nic(2, 10000)],
        supports: CAP.server, defaultServices: ['http'], tags: ['server', 'services'],
    },
    {
        id: 'server-web', name: 'Web Server', category: 'server', role: 'server', layer: 7,
        icon: 'server', accent: '#06b6d4', year: 1991,
        blurb: 'HTTP/HTTPS origin. Serves the page your browser fetches in the simulation.',
        learn: [
            'A browser fetch is: DNS lookup → ARP (if local) → TCP 3-way handshake → TLS handshake → HTTP GET → response → FIN.',
            'HTTP/3 replaces TCP with QUIC over UDP 443, so the handshake and the encryption happen together in one round trip.',
        ],
        ports: [P.nic(2, 10000)],
        supports: CAP.server, defaultServices: ['http', 'https'], tags: ['http', 'tcp', 'tls', 'quic'],
    },
    {
        id: 'server-dns', name: 'DNS Server', category: 'server', role: 'server', layer: 7,
        icon: 'globe', accent: '#0891b2', year: 1983,
        blurb: 'Resolves names to addresses. Nothing works when this is wrong.',
        learn: [
            'DNS normally uses UDP 53 and falls back to TCP 53 for large answers or zone transfers.',
            'Resolution is recursive: your resolver asks the root, then the TLD, then the authoritative server, then caches the answer for its TTL.',
            '"The Internet is down" is DNS about half the time. Test with an IP address to prove it.',
        ],
        ports: [P.nic(2, 1000)],
        supports: CAP.server, defaultServices: ['dns'], tags: ['dns', 'udp53', 'ttl', 'recursion'],
    },
    {
        id: 'server-dhcp', name: 'DHCP Server', category: 'server', role: 'server', layer: 7,
        icon: 'server', accent: '#0e7490', year: 1993,
        blurb: 'Hands out addresses, masks, gateways and DNS servers.',
        learn: [
            'DORA: Discover (broadcast) → Offer → Request → Acknowledge. The first two are broadcasts, so DHCP is VLAN-scoped.',
            'To serve a remote VLAN you need an `ip helper-address` on the router — it relays the broadcast as a unicast.',
            'No answer means the client self-assigns 169.254.x.x (APIPA). Seeing that address is a diagnosis, not a bug.',
        ],
        ports: [P.nic(2, 1000)],
        supports: CAP.server, defaultServices: ['dhcp'], tags: ['dhcp', 'dora', 'helper-address', 'apipa'],
    },
    {
        id: 'server-mail', name: 'Mail Server', category: 'server', role: 'server', layer: 7,
        icon: 'mail', accent: '#0284c7', year: 1982,
        blurb: 'SMTP for sending, IMAP/POP3 for reading.',
        learn: [
            'SMTP (25/587) pushes mail between servers; IMAP (993) and POP3 (995) pull it to a client.',
            'Delivery depends on DNS MX records, plus SPF, DKIM and DMARC to prove you are allowed to send.',
        ],
        ports: [P.nic(2, 1000)],
        supports: CAP.server, defaultServices: ['smtp'], tags: ['smtp', 'imap', 'mx', 'spf'],
    },
    {
        id: 'server-file', name: 'File Server', category: 'server', role: 'server', layer: 7,
        icon: 'nas', accent: '#0369a1', year: 1985,
        blurb: 'SMB/NFS shares. Sensitive to latency and MTU.',
        learn: [
            'SMB is chatty: small operations over a high-latency WAN feel far slower than raw bandwidth suggests.',
            'Never expose SMB (445) to the Internet. Ever.',
        ],
        ports: [P.nic(2, 10000)],
        supports: CAP.server, defaultServices: ['ftp'], tags: ['smb', 'nfs', 'latency'],
    },
    {
        id: 'server-database', name: 'Database Server', category: 'server', role: 'server', layer: 7,
        icon: 'database', accent: '#1d4ed8', year: 1979,
        blurb: 'Back-end tier. Should never be directly reachable from the client VLAN.',
        learn: [
            'Classic three-tier segmentation: web VLAN → app VLAN → DB VLAN, with a firewall policy between each.',
            'The DB should accept connections only from the app tier — enforce it with an ACL, not with a password.',
        ],
        ports: [P.nic(2, 25000)],
        supports: CAP.server, tags: ['database', 'three-tier', 'segmentation'],
    },
    {
        id: 'server-ntp', name: 'NTP Server', category: 'server', role: 'server', layer: 7,
        icon: 'clock', accent: '#0891b2', year: 1985,
        blurb: 'Time source. Certificates, logs and Kerberos all break without it.',
        learn: [
            'Clock skew over ~5 minutes breaks Kerberos authentication and makes TLS certificates look invalid.',
            'Correlating logs across devices is impossible unless every device shares one time source.',
        ],
        ports: [P.nic(1, 1000)],
        supports: CAP.server, defaultServices: ['ntp'], tags: ['ntp', 'time', 'stratum'],
    },
    {
        id: 'server-syslog', name: 'Syslog / SIEM Collector', category: 'server', role: 'server', layer: 7,
        icon: 'logs', accent: '#0e7490', year: 1980,
        blurb: 'Central log sink on UDP 514 — the first thing you build in a real network.',
        learn: [
            'Syslog severity runs 0 (emergency) to 7 (debug). Sending level 7 from every device will drown the collector.',
            'UDP syslog is fire-and-forget; use TCP/TLS syslog when the logs are evidence.',
        ],
        ports: [P.nic(2, 10000)],
        supports: CAP.server, defaultServices: ['syslog'], tags: ['syslog', 'siem', 'severity'],
    },

    /* ═══════════════ IoT & OT ═══════════════ */
    {
        id: 'iot-sensor', name: 'IoT Sensor', category: 'iot', role: 'host', layer: 7,
        icon: 'sensor', accent: '#4ade80', year: 2014,
        blurb: 'Battery sensor reporting over Wi-Fi or MQTT.',
        learn: [
            'IoT devices are rarely patched — segment them into their own VLAN with an egress-only ACL.',
            'MQTT (1883/8883) is publish/subscribe over TCP: the device publishes to a broker, it never listens for inbound connections.',
        ],
        ports: [{ ...P.wifi(1), speedMbps: 54 }],
        supports: { ...CAP.host, wireless: true }, tags: ['iot', 'mqtt', 'segmentation'],
    },
    {
        id: 'iot-thermostat', name: 'Smart Thermostat', category: 'iot', role: 'host', layer: 7,
        icon: 'thermostat', accent: '#86efac', year: 2011,
        blurb: 'Cloud-managed HVAC controller.',
        learn: [
            'Cloud-dependent IoT stops working when your Internet does — even for local control.',
            'Blocking its outbound DNS is enough to brick most consumer IoT. Test policies before enforcing them.',
        ],
        ports: [{ ...P.wifi(1), speedMbps: 72 }],
        supports: { ...CAP.host, wireless: true }, tags: ['iot', 'cloud', 'hvac'],
    },
    {
        id: 'iot-smartplug', name: 'Smart Plug', category: 'iot', role: 'host', layer: 7,
        icon: 'plug', accent: '#bbf7d0', year: 2013,
        blurb: '2.4 GHz-only actuator. The cheapest thing on your network and the least secure.',
        learn: [
            'Most cheap IoT is 2.4 GHz-only and cannot see a 5 GHz-only SSID — a very common onboarding failure.',
            'Onboarding usually needs mDNS/broadcast, so the phone must be on the same VLAN during setup.',
        ],
        ports: [{ ...P.wifi(1), speedMbps: 54 }],
        supports: { ...CAP.host, wireless: true }, tags: ['iot', '2.4ghz', 'onboarding'],
    },
    {
        id: 'iot-lock', name: 'Smart Lock', category: 'iot', role: 'host', layer: 7,
        icon: 'lock', accent: '#34d399', year: 2013,
        blurb: 'Physical access control on the network. Treat as high-risk.',
        learn: [
            'Anything that opens a door belongs on a dedicated, monitored VLAN with no Internet egress except its vendor endpoint.',
            'Fail-safe vs fail-secure is a design decision with legal consequences — decide it before you deploy.',
        ],
        ports: [{ ...P.wifi(1), speedMbps: 54 }],
        supports: { ...CAP.host, wireless: true }, tags: ['iot', 'physical-security'],
    },
    {
        id: 'iot-plc', name: 'Industrial PLC', category: 'iot', role: 'host', layer: 7,
        icon: 'plc', accent: '#65a30d', year: 1969,
        blurb: 'Programmable logic controller driving machinery. Deterministic, fragile.',
        learn: [
            'OT protocols (Modbus, PROFINET, EtherNet/IP) have no authentication — segmentation *is* the security control.',
            'A port scan can crash a PLC. Never run active discovery on a production OT segment.',
        ],
        ports: [{ ...P.nic(2, 100) }],
        supports: CAP.host, tags: ['ot', 'plc', 'modbus', 'purdue'],
    },
    {
        id: 'iot-ev-charger', name: 'EV Charger', category: 'iot', role: 'host', layer: 7,
        icon: 'ev', accent: '#22c55e', year: 2015,
        blurb: 'OCPP-connected charge point with billing back-end.',
        learn: [
            'Chargers speak OCPP over WebSockets to a central system — it needs stable outbound 443, not inbound access.',
            'Load management requires the chargers to talk to each other or to a local controller; plan that VLAN deliberately.',
        ],
        ports: [{ ...P.nic(1, 100) }, { ...P.cellular(1) }],
        supports: CAP.host, tags: ['ev', 'ocpp', 'websocket'],
    },
    {
        id: 'iot-drone', name: 'Drone / UAV', category: 'iot', role: 'host', layer: 7,
        icon: 'drone', accent: '#4ade80', year: 2016,
        blurb: 'Mobile client on Wi-Fi or 5G with a live video uplink.',
        learn: [
            'Video uplink is the hard part: upstream bandwidth and jitter, not download speed.',
            'A moving client roams constantly; without 802.11r/k/v the video stalls at every handoff.',
        ],
        ports: [{ ...P.wifi(1), speedMbps: 866 }, P.cellular(1)],
        supports: { ...CAP.host, wireless: true }, tags: ['uav', 'uplink', 'roaming'],
    },
    {
        id: 'iot-meter', name: 'Smart Meter', category: 'iot', role: 'host', layer: 7,
        icon: 'meter', accent: '#a3e635', year: 2009,
        blurb: 'Utility metering over LoRaWAN / NB-IoT / cellular.',
        learn: [
            'LPWAN trades bandwidth for range and battery life: a few hundred bytes a day over kilometres, on one battery for a decade.',
            'NB-IoT rides the licensed cellular band, LoRaWAN uses unlicensed ISM — different economics, same use case.',
        ],
        ports: [{ ...P.cellular(1), speedMbps: 1 }],
        supports: CAP.host, tags: ['lpwan', 'lorawan', 'nb-iot'],
    },
    {
        id: 'iot-medical', name: 'Medical Device', category: 'iot', role: 'host', layer: 7,
        icon: 'medical', accent: '#5eead4', year: 2005,
        blurb: 'Patient monitor or infusion pump — availability is a safety issue.',
        learn: [
            'Medical devices are often unpatchable for regulatory reasons; compensating controls mean strict segmentation and monitoring.',
            'Design for no single point of failure: redundant APs, redundant uplinks, UPS on every closet.',
        ],
        ports: [{ ...P.wifi(1), speedMbps: 300 }, P.nic(1, 100)],
        supports: { ...CAP.host, wireless: true }, tags: ['medical', 'availability', 'segmentation'],
    },

    /* ═══════════════ Data center ═══════════════ */
    {
        id: 'hypervisor', name: 'Hypervisor Host', category: 'datacenter', role: 'server', layer: 7,
        icon: 'vm', accent: '#c084fc', year: 2001,
        blurb: 'Physical host running many VMs behind a virtual switch.',
        learn: [
            'The vSwitch inside the host is a real Layer-2 switch — VM-to-VM traffic on the same host never touches the physical network.',
            'Uplinks are usually trunks: the physical NIC carries every VLAN the VMs need.',
        ],
        ports: [P.nic(4, 25000)],
        supports: { ...CAP.server, vlans: true }, tags: ['virtualization', 'vswitch', 'trunk'],
    },
    {
        id: 'container-host', name: 'Container Host', category: 'datacenter', role: 'server', layer: 7,
        icon: 'container', accent: '#a855f7', year: 2013,
        blurb: 'Docker/Podman host with bridge and overlay networks.',
        learn: [
            'A default Docker bridge NATs containers behind the host IP — same idea as a home router, one layer up.',
            'Overlay networks (VXLAN) let containers on different hosts share one flat Layer-2 domain.',
        ],
        ports: [P.nic(2, 25000)],
        supports: CAP.server, tags: ['docker', 'bridge', 'overlay', 'nat'],
    },
    {
        id: 'k8s-node', name: 'Kubernetes Node', category: 'datacenter', role: 'server', layer: 7,
        icon: 'container', accent: '#9333ea', year: 2015,
        blurb: 'Worker node with a CNI plugin, pod CIDR and service CIDR.',
        learn: [
            'Every pod gets a real routable IP from the pod CIDR — no NAT between pods, by design.',
            'A Service is a virtual IP load-balanced by kube-proxy/eBPF; it does not exist on any interface.',
            'NetworkPolicy is the Kubernetes equivalent of an ACL, and it is deny-nothing until you write the first one.',
        ],
        ports: [P.nic(2, 25000)],
        supports: CAP.server, tags: ['kubernetes', 'cni', 'pod-cidr', 'networkpolicy'],
    },
    {
        id: 'load-balancer', name: 'Load Balancer / ADC', category: 'datacenter', role: 'loadbalancer', layer: 7,
        icon: 'loadbalancer', accent: '#d946ef', year: 1997,
        blurb: 'Distributes connections across a server pool; terminates TLS.',
        learn: [
            'L4 load balancing forwards by IP:port. L7 reads the HTTP host/path and can route per URL.',
            'Health checks are what make it useful: a dead member is removed before a user notices.',
            'Terminating TLS at the LB means the servers see plaintext — insert X-Forwarded-For or you lose the client IP.',
        ],
        ports: [P.nic(4, 25000)],
        supports: { ...CAP.server, acl: true }, tags: ['adc', 'vip', 'health-check', 'tls-offload'],
    },
    {
        id: 'nas', name: 'NAS / Storage Array', category: 'datacenter', role: 'nas', layer: 7,
        icon: 'nas', accent: '#7e22ce', year: 1996,
        blurb: 'Shared storage over SMB/NFS/iSCSI.',
        learn: [
            'iSCSI wants a dedicated, non-routed storage VLAN with jumbo frames and no oversubscription.',
            'Storage traffic and user traffic on the same uplink is how you get random application timeouts.',
        ],
        ports: [P.nic(4, 25000)],
        supports: CAP.server, tags: ['iscsi', 'nfs', 'jumbo', 'storage-vlan'],
    },
    {
        id: 'gpu-cluster', name: 'GPU / AI Compute Node', category: 'datacenter', role: 'server', layer: 7,
        icon: 'gpu', accent: '#c026d3', year: 2016,
        blurb: 'Training node with RDMA over 400G — the 2026 bandwidth hog.',
        learn: [
            'AI training uses RoCE/InfiniBand: lossless fabrics with PFC and ECN, because a single dropped packet stalls a collective.',
            'These clusters are built as dedicated fabrics; they are never mixed with general-purpose traffic.',
        ],
        ports: [P.ge100(8)],
        supports: CAP.server, tags: ['rdma', 'roce', 'pfc', 'ai'],
    },

    /* ═══════════════ Cloud & Internet ═══════════════ */
    {
        id: 'internet', name: 'Internet Cloud', category: 'cloud', role: 'cloud', layer: 3,
        icon: 'cloud', accent: '#818cf8', year: 1983,
        blurb: 'Everything outside your control. Drop one in to test NAT and default routes.',
        learn: [
            'Modelling the Internet as one cloud is the right abstraction for learning: it has a public address and a default route back.',
            'If a ping to a public address works but a name does not, your DNS is the problem, not your routing.',
        ],
        ports: [{ ...P.nic(6, 100000), pattern: 'Peer{i}', short: 'Pe{i}' }],
        supports: { routing: true, ipv6: true }, tags: ['internet', 'default-route', 'public'],
    },
    {
        id: 'cloud-vpc', name: 'Cloud VPC / Region', category: 'cloud', role: 'cloud', layer: 3,
        icon: 'cloud', accent: '#6366f1', year: 2009,
        blurb: 'A provider VPC reached over IPsec or a direct interconnect.',
        learn: [
            'A VPC is software-defined: you write route tables and security groups instead of touching interfaces.',
            'Security groups are stateful per-instance firewalls; NACLs are stateless per-subnet ACLs. You usually need both.',
            'Never overlap your on-prem CIDR with the VPC CIDR, or the VPN will never route correctly.',
        ],
        ports: [{ ...P.nic(4, 10000), pattern: 'Gateway{i}', short: 'Gw{i}' }],
        supports: { routing: true, nat: true, acl: true, ipv6: true, vpn: true }, tags: ['vpc', 'security-group', 'nacl', 'interconnect'],
    },
    {
        id: 'cdn-edge', name: 'CDN Edge / PoP', category: 'cloud', role: 'cloud', layer: 7,
        icon: 'globe', accent: '#4f46e5', year: 1998,
        blurb: 'Caches content close to users; the reason a page loads in 20 ms.',
        learn: [
            'Anycast puts the same IP in many locations; BGP sends each user to the nearest one.',
            'Cache hit ratio, not bandwidth, is the CDN metric that matters.',
        ],
        ports: [{ ...P.nic(4, 100000), pattern: 'Edge{i}', short: 'Ed{i}' }],
        supports: { routing: true, ipv6: true }, tags: ['cdn', 'anycast', 'caching'],
    },
    {
        id: 'isp-cloud', name: 'ISP / Provider Network', category: 'cloud', role: 'cloud', layer: 3,
        icon: 'cloud', accent: '#4338ca', year: 1990,
        blurb: 'Your upstream. Hands you an address and a default route.',
        learn: [
            'Single-homed sites take a default route. Multi-homed sites need BGP and their own AS number.',
            'The ISP will filter anything you advertise that is not yours — that is a feature.',
        ],
        ports: [{ ...P.nic(6, 100000), pattern: 'Customer{i}', short: 'Cu{i}' }],
        supports: { routing: true, ipv6: true }, tags: ['isp', 'bgp', 'as', 'default-route'],
    },

    /* ═══════════════ Legacy ═══════════════ */
    {
        id: 'hub', name: 'Ethernet Hub', category: 'legacy', role: 'hub', layer: 1,
        icon: 'hub', accent: '#94a3b8', year: 1990,
        blurb: 'Repeats every bit to every port. One collision domain, half duplex.',
        learn: [
            'A hub has no MAC table and makes no decisions — every frame goes everywhere. That is one collision domain.',
            'Because it is half duplex, hosts must run CSMA/CD: listen, transmit, detect collision, back off, retry.',
            'Swap a hub for a switch and every port becomes its own collision domain — this is why hubs disappeared.',
        ],
        ports: [{ ...P.nic(8, 10), pattern: 'Port{i}', short: 'P{i}' }],
        supports: {}, tags: ['hub', 'collision-domain', 'csma-cd', 'half-duplex'],
    },
    {
        id: 'repeater', name: 'Repeater', category: 'legacy', role: 'repeater', layer: 1,
        icon: 'repeater', accent: '#cbd5e1', year: 1985,
        blurb: 'Regenerates a weak signal to extend a segment beyond its length limit.',
        learn: [
            'Purely Layer 1: it amplifies and reshapes the signal, it does not read addresses.',
            'The 5-4-3 rule limited how many repeaters a 10BASE-T segment could chain — worth knowing why limits exist.',
        ],
        ports: [{ ...P.nic(2, 10), pattern: 'Port{i}', short: 'P{i}' }],
        supports: {}, tags: ['repeater', 'layer1', 'attenuation'],
    },
    {
        id: 'bridge', name: 'Transparent Bridge', category: 'legacy', role: 'switch', layer: 2,
        icon: 'bridge', accent: '#94a3b8', year: 1984,
        blurb: 'Two-port ancestor of the switch. Learns MACs and splits collision domains.',
        learn: [
            'A switch is just a bridge with many ports and hardware forwarding — the algorithm is identical.',
            'Spanning Tree was invented for bridges, which is why the terminology still says "bridge ID" and "root bridge".',
        ],
        ports: [{ ...P.nic(2, 10), pattern: 'Port{i}', short: 'P{i}' }],
        supports: { stp: true }, tags: ['bridge', 'stp', 'history'],
    },
];

/* ─── Lookup helpers ──────────────────────────────────────────────── */

const BY_ID = new Map(DEVICE_TYPES.map(d => [d.id, d]));

export function getDeviceType(id: string): DeviceTypeDef | undefined {
    return BY_ID.get(id);
}

export function deviceTypesByCategory(category: DeviceCategory): DeviceTypeDef[] {
    return DEVICE_TYPES.filter(d => d.category === category);
}

export function searchDeviceTypes(query: string): DeviceTypeDef[] {
    const q = query.trim().toLowerCase();
    if (!q) return DEVICE_TYPES;
    return DEVICE_TYPES.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.id.includes(q) ||
        d.blurb.toLowerCase().includes(q) ||
        d.tags.some(t => t.includes(q))
    );
}

/** Roles that forward at Layer 2 by looking at MAC addresses. */
export const L2_ROLES: DeviceRoleSet = new Set(['switch', 'multilayer', 'ap', 'bridge' as any]);
/** Roles that make Layer-3 forwarding decisions. */
export const L3_ROLES: DeviceRoleSet = new Set(['router', 'multilayer', 'firewall', 'cloud', 'modem']);
/** Roles that terminate traffic (they are the destination). */
export const HOST_ROLES: DeviceRoleSet = new Set(['host', 'server', 'nas', 'loadbalancer', 'wlc']);

type DeviceRoleSet = Set<string>;

export function isL2Forwarder(role: string): boolean {
    return role === 'switch' || role === 'multilayer' || role === 'ap';
}
export function isL3Forwarder(role: string): boolean {
    return role === 'router' || role === 'multilayer' || role === 'firewall' || role === 'cloud';
}
export function isHostLike(role: string): boolean {
    return HOST_ROLES.has(role);
}
export function isFlooder(role: string): boolean {
    return role === 'hub' || role === 'repeater' || role === 'modem';
}

/** True when the box forwards frames between its own ports (has a bridge inside). */
export function bridgesFrames(role: string): boolean {
    return isL2Forwarder(role) || isFlooder(role) || role === 'cloud';
}

/** Default hostname prefix used when a device is dropped on the canvas. */
export function hostnamePrefix(type: DeviceTypeDef): string {
    // All-in-one boxes read better as a gateway than as a bare router.
    if (type.id === 'router-soho' || type.id === 'cpe-5g' || type.id === 'sat-terminal') return 'GW';
    switch (type.role) {
        case 'switch': return 'SW';
        case 'multilayer': return 'MLS';
        case 'router': return 'R';
        case 'firewall': return 'FW';
        case 'ap': return 'AP';
        case 'wlc': return 'WLC';
        case 'server': return 'SRV';
        case 'hub': return 'HUB';
        case 'cloud': return 'NET';
        case 'modem': return 'MDM';
        case 'loadbalancer': return 'LB';
        case 'nas': return 'NAS';
        default: return 'PC';
    }
}

/** Which cable the UI should suggest between two media types. */
export function suggestCable(a: PortMediumLike, b: PortMediumLike): string {
    if (a === 'wireless' || b === 'wireless') return 'wireless';
    if (a === 'cellular' || b === 'cellular') return 'cellular';
    if (a === 'serial' && b === 'serial') return 'serial-dce';
    if (a === 'coaxial' || b === 'coaxial') return 'coaxial';
    if (a === 'console' || b === 'console') return 'console-rollover';
    if (a === 'fiber' || b === 'fiber' || a === 'sfp' || b === 'sfp') return 'fiber-multi-mode';
    return 'straight-through';
}

type PortMediumLike = string;
