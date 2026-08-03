/**
 * src/netsim/types.ts
 * The whole data model of the Network Simulator lives here: devices, ports,
 * links, topologies, projects, packets, simulation events and lesson content.
 *
 * Everything is plain JSON-serialisable so a topology can be written straight
 * into the `selfstudynetworksimulator_data` GitHub repo and read back verbatim.
 */

/* ══════════════════════════ Layers & media ══════════════════════════ */

export type LayerId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const OSI_LAYERS: Array<{
    id: LayerId;
    name: string;
    tcpip: string;
    pdu: string;
    color: string;
    blurb: string;
    examples: string[];
}> = [
    {
        id: 7, name: 'Application', tcpip: 'Application', pdu: 'Data', color: '#f472b6',
        blurb: 'What the user actually asked for — a web page, an email, a DNS name lookup.',
        examples: ['HTTP/HTTPS', 'DNS', 'DHCP', 'SMTP', 'FTP', 'SSH', 'MQTT', 'QUIC'],
    },
    {
        id: 6, name: 'Presentation', tcpip: 'Application', pdu: 'Data', color: '#e879f9',
        blurb: 'Encoding, compression and encryption — TLS records and JSON/UTF-8 live here.',
        examples: ['TLS 1.3', 'JPEG', 'UTF-8', 'ASN.1', 'gzip'],
    },
    {
        id: 5, name: 'Session', tcpip: 'Application', pdu: 'Data', color: '#a78bfa',
        blurb: 'Opening, keeping and tearing down a conversation between two applications.',
        examples: ['TLS handshake', 'RPC', 'NetBIOS', 'SIP'],
    },
    {
        id: 4, name: 'Transport', tcpip: 'Transport', pdu: 'Segment / Datagram', color: '#60a5fa',
        blurb: 'Port numbers, reliability and flow control. TCP guarantees delivery, UDP does not.',
        examples: ['TCP', 'UDP', 'SCTP', 'QUIC'],
    },
    {
        id: 3, name: 'Network', tcpip: 'Internet', pdu: 'Packet', color: '#34d399',
        blurb: 'Logical addressing and routing between different networks. TTL lives here.',
        examples: ['IPv4', 'IPv6', 'ICMP', 'OSPF', 'BGP', 'IPsec'],
    },
    {
        id: 2, name: 'Data Link', tcpip: 'Network Access', pdu: 'Frame', color: '#fbbf24',
        blurb: 'MAC addressing inside one broadcast domain, VLAN tags, error detection (FCS).',
        examples: ['Ethernet II', '802.1Q', '802.11', 'ARP', 'STP', 'PPP'],
    },
    {
        id: 1, name: 'Physical', tcpip: 'Network Access', pdu: 'Bits', color: '#fb7185',
        blurb: 'Actual signalling — copper voltage, laser pulses, radio. Cables and connectors.',
        examples: ['1000BASE-T', '10GBASE-SR', 'Wi-Fi 7 radio', 'RS-232', 'DOCSIS 4.0'],
    },
];

export type PortMedium =
    | 'copper-ethernet'
    | 'fiber'
    | 'sfp'
    | 'serial'
    | 'coaxial'
    | 'wireless'
    | 'cellular'
    | 'console'
    | 'usb'
    | 'poe';

export type CableType =
    | 'straight-through'
    | 'crossover'
    | 'fiber-single-mode'
    | 'fiber-multi-mode'
    | 'dac-twinax'
    | 'serial-dce'
    | 'serial-dte'
    | 'coaxial'
    | 'console-rollover'
    | 'wireless'
    | 'cellular';

export const CABLE_LABELS: Record<CableType, string> = {
    'straight-through': 'Copper straight-through',
    'crossover': 'Copper crossover',
    'fiber-single-mode': 'Fiber (single-mode)',
    'fiber-multi-mode': 'Fiber (multi-mode)',
    'dac-twinax': 'DAC / twinax',
    'serial-dce': 'Serial DCE',
    'serial-dte': 'Serial DTE',
    'coaxial': 'Coaxial',
    'console-rollover': 'Console rollover',
    'wireless': 'Wireless (802.11)',
    'cellular': 'Cellular (4G/5G)',
};

/* ══════════════════════════ Devices ══════════════════════════ */

export type DeviceCategory =
    | 'end-device'
    | 'mobile'
    | 'switching'
    | 'routing'
    | 'wireless'
    | 'security'
    | 'wan'
    | 'server'
    | 'iot'
    | 'cloud'
    | 'datacenter'
    | 'legacy';

/** Behavioural role — the simulation engine switches on this, not on the model. */
export type DeviceRole =
    | 'host'          // PC, laptop, phone, printer, camera …  (L2/L3 endpoint)
    | 'server'        // host that also answers services
    | 'switch'        // L2 store-and-forward with a MAC table
    | 'multilayer'    // L3 switch: switching + routing (SVIs)
    | 'router'        // L3 forwarding between interfaces
    | 'firewall'      // router + stateful policy
    | 'ap'            // 802.11 bridge between radio and Ethernet
    | 'wlc'           // wireless LAN controller (management plane)
    | 'hub'           // dumb repeater — floods everything, one collision domain
    | 'repeater'
    | 'modem'         // media converter to a WAN circuit
    | 'cloud'         // opaque WAN / Internet cloud
    | 'loadbalancer'
    | 'nas';

export interface PortTemplate {
    /** e.g. "GigabitEthernet0/{i}" — `{i}` is replaced with a 0-based index. */
    pattern: string;
    short: string;
    count: number;
    medium: PortMedium;
    speedMbps: number;
    /** Layer-3 capable out of the box (routers) vs switchport by default. */
    routed?: boolean;
    poe?: boolean;
}

export interface DeviceTypeDef {
    id: string;
    name: string;
    category: DeviceCategory;
    role: DeviceRole;
    /** Highest layer this box normally makes decisions at. */
    layer: LayerId;
    icon: string;
    accent: string;
    year: number;
    blurb: string;
    /** Learning notes shown in the encyclopedia + properties panel. */
    learn: string[];
    ports: PortTemplate[];
    supports: {
        cli?: boolean;
        vlans?: boolean;
        stp?: boolean;
        routing?: boolean;
        nat?: boolean;
        acl?: boolean;
        dhcpServer?: boolean;
        dhcpClient?: boolean;
        dnsServer?: boolean;
        httpServer?: boolean;
        wireless?: boolean;
        poe?: boolean;
        vpn?: boolean;
        ipv6?: boolean;
    };
    defaultServices?: ServiceKey[];
    tags: string[];
}

export type ServiceKey =
    | 'dhcp' | 'dns' | 'http' | 'https' | 'ftp' | 'smtp' | 'ntp'
    | 'ssh' | 'telnet' | 'snmp' | 'radius' | 'syslog' | 'tftp' | 'mqtt';

/* ══════════════════════════ Interfaces ══════════════════════════ */

export type SwitchportMode = 'access' | 'trunk' | 'routed' | 'dynamic-auto';

export interface NetInterface {
    id: string;
    name: string;
    short: string;
    medium: PortMedium;
    speedMbps: number;
    mac: string;

    /** Administrative state — `shutdown` / `no shutdown`. */
    enabled: boolean;
    /** Operational state, recomputed by the engine from link + power. */
    up?: boolean;

    dhcp: boolean;
    ipv4: string;
    mask: string;
    ipv6: string;
    prefix6: number;
    slaac?: boolean;

    mode: SwitchportMode;
    accessVlan: number;
    nativeVlan: number;
    trunkVlans: number[];
    /** For multilayer switches / routers: sub-interface encapsulation VLAN. */
    encapsulationVlan?: number;
    /** SVI marker — a virtual L3 interface for a VLAN. */
    sviVlan?: number;

    duplex: 'auto' | 'full' | 'half';
    mtu: number;
    description: string;

    natRole: 'inside' | 'outside' | 'none';
    aclIn: string;
    aclOut: string;

    /** Wireless client / AP radio settings. */
    ssid?: string;
    passphrase?: string;
    band?: '2.4GHz' | '5GHz' | '6GHz';

    /** Runtime counters, reset by the simulator. */
    counters?: { txFrames: number; rxFrames: number; txBytes: number; rxBytes: number; drops: number };
}

/* ══════════════════════════ Config blocks ══════════════════════════ */

export interface Vlan {
    id: number;
    name: string;
    color: string;
}

export interface StaticRoute {
    id: string;
    network: string;
    mask: string;
    nextHop: string;
    /** Optional exit interface for directly-attached next hops. */
    exitInterfaceId?: string;
    metric: number;
    /** 1 = connected, static = 1, RIP = 120, OSPF = 110 (display only). */
    adminDistance?: number;
    source?: 'static' | 'connected' | 'rip' | 'ospf' | 'default' | 'dhcp';
}

export interface AclRule {
    id: string;
    seq: number;
    action: 'permit' | 'deny';
    protocol: 'ip' | 'icmp' | 'tcp' | 'udp';
    srcAny: boolean;
    src: string;
    srcWildcard: string;
    dstAny: boolean;
    dst: string;
    dstWildcard: string;
    dstPort?: number;
    remark?: string;
    hits?: number;
}

export interface Acl {
    id: string;
    name: string;
    type: 'standard' | 'extended';
    rules: AclRule[];
}

export interface DhcpPool {
    id: string;
    name: string;
    network: string;
    mask: string;
    rangeStart: string;
    rangeEnd: string;
    gateway: string;
    dnsServer: string;
    domain: string;
    leaseHours: number;
    excluded: string[];
}

export interface DnsRecord {
    id: string;
    name: string;
    type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'PTR';
    value: string;
    ttl: number;
}

export interface WirelessConfig {
    ssid: string;
    hidden: boolean;
    security: 'open' | 'wep' | 'wpa2-personal' | 'wpa2-enterprise' | 'wpa3-personal' | 'wpa3-enterprise';
    passphrase: string;
    band: '2.4GHz' | '5GHz' | '6GHz';
    channel: number;
    channelWidthMHz: number;
    standard: '802.11n' | '802.11ac' | '802.11ax' | '802.11be';
    txPowerDbm: number;
    /** Metres — clients further than this cannot associate. */
    coverageRadius: number;
    guestSsid?: string;
    vlanId?: number;
    /** Bridge the radio into this VLAN on the wired side. */
    maxClients: number;
}

export interface NatConfig {
    enabled: boolean;
    mode: 'static' | 'dynamic' | 'pat';
    insidePoolStart?: string;
    insidePoolEnd?: string;
    outsideAddress?: string;
    staticMappings: Array<{ id: string; inside: string; outside: string; port?: number }>;
    /** Runtime translation table. */
    translations?: NatTranslation[];
}

export interface NatTranslation {
    protocol: string;
    insideLocal: string;
    insideGlobal: string;
    outsideLocal: string;
    outsideGlobal: string;
}

export interface RoutingConfig {
    staticRoutes: StaticRoute[];
    defaultGateway: string;
    rip: { enabled: boolean; version: 1 | 2; networks: string[] };
    ospf: { enabled: boolean; processId: number; routerId: string; networks: Array<{ network: string; wildcard: string; area: number }> };
    /** Learned routes are recomputed on every simulation run. */
    learned?: StaticRoute[];
}

export interface ServerServices {
    dhcp: { enabled: boolean; pools: DhcpPool[]; leases?: DhcpLease[] };
    dns: { enabled: boolean; records: DnsRecord[]; forwarder: string };
    http: { enabled: boolean; port: number; title: string; body: string; tls: boolean };
    ftp: { enabled: boolean; port: number; files: string[] };
    smtp: { enabled: boolean; port: number; domain: string };
    ntp: { enabled: boolean };
    syslog: { enabled: boolean };
    radius: { enabled: boolean; secret: string };
    mqtt: { enabled: boolean; port: number; topics: string[] };
}

export interface DhcpLease {
    mac: string;
    ip: string;
    hostname: string;
    poolId: string;
    expiresIn: number;
}

export interface StpConfig {
    enabled: boolean;
    mode: 'stp' | 'rstp' | 'pvst' | 'rapid-pvst' | 'mstp';
    priority: number;
    /** Runtime port roles, keyed by interface id. */
    portRoles?: Record<string, StpPortRole>;
    isRoot?: boolean;
    rootBridgeId?: string;
}

export type StpPortRole = 'root' | 'designated' | 'blocked' | 'alternate' | 'disabled';

export interface HostConfig {
    dhcp: boolean;
    defaultGateway: string;
    dnsServer: string;
    /** Simple app-level state for the host: opened sockets, last page fetched. */
    domain?: string;
}

/* ══════════════════════════ Device ══════════════════════════ */

export interface Device {
    id: string;
    typeId: string;
    name: string;
    hostname: string;
    x: number;
    y: number;
    powered: boolean;
    notes: string;
    /** Free-form label colour for grouping (site, floor, tenant). */
    group?: string;

    interfaces: NetInterface[];
    vlans: Vlan[];
    stp: StpConfig;
    routing: RoutingConfig;
    acls: Acl[];
    nat: NatConfig;
    services: ServerServices;
    wireless?: WirelessConfig;
    host: HostConfig;

    /** Runtime tables — cleared by `Simulator.reset()`. */
    macTable?: MacEntry[];
    arpTable?: ArpEntry[];
    /** Locked so lesson scenarios can pin a device's config. */
    locked?: boolean;
}

export interface MacEntry {
    mac: string;
    vlan: number;
    interfaceId: string;
    type: 'dynamic' | 'static';
    ageSec: number;
}

export interface ArpEntry {
    ip: string;
    mac: string;
    interfaceId: string;
    type: 'dynamic' | 'static';
    ageSec: number;
}

/* ══════════════════════════ Links & topology ══════════════════════════ */

export type LinkStatus = 'up' | 'down' | 'blocked' | 'err-disabled' | 'shutdown';

export interface Link {
    id: string;
    aDeviceId: string;
    aInterfaceId: string;
    bDeviceId: string;
    bInterfaceId: string;
    cable: CableType;
    /** Explicit admin down for the cable itself (simulating a cut). */
    severed: boolean;
    latencyMs: number;
    bandwidthMbps: number;
    lossPct: number;
    label: string;
    status?: LinkStatus;
    /** Runtime: STP put this link into blocking on one end. */
    blockedEndDeviceId?: string;
}

export interface Annotation {
    id: string;
    kind: 'note' | 'zone' | 'label';
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
}

export interface Topology {
    id: string;
    name: string;
    description: string;
    devices: Device[];
    links: Link[];
    annotations: Annotation[];
    canvas: { zoom: number; panX: number; panY: number; grid: boolean; snap: boolean };
    createdAt: string;
    updatedAt: string;
    schemaVersion: number;
}

/* ══════════════════════════ Projects (GitHub storage) ══════════════════════════ */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface ProjectSummary {
    id: string;
    name: string;
    description: string;
    owner: string;
    tags: string[];
    difficulty: Difficulty;
    deviceCount: number;
    linkCount: number;
    createdAt: string;
    updatedAt: string;
    shared: boolean;
    /** Optional lesson this project was created from. */
    lessonId?: string;
    thumbnail?: string;
}

export interface NetSimProject extends ProjectSummary {
    topology: Topology;
    /** Chronological AI conversation attached to the project. */
    aiHistory?: Array<{ role: 'user' | 'assistant'; content: string; at: string }>;
    checkpoints?: Array<{ id: string; label: string; at: string; topology: Topology }>;
}

export interface ProjectIndex {
    owner: string;
    updatedAt: string;
    projects: ProjectSummary[];
}

export interface NetSimUserProfile {
    username: string;
    displayName: string;
    email?: string;
    createdAt: string;
    updatedAt: string;
    preferences: {
        theme: 'dark' | 'midnight' | 'slate';
        showGrid: boolean;
        snapToGrid: boolean;
        animationSpeed: number;
        autoSave: boolean;
        cliFont: number;
        defaultCable: CableType;
    };
    stats: {
        projects: number;
        simulationsRun: number;
        packetsSent: number;
        lessonsCompleted: number;
        devicesPlaced: number;
        minutesInStudio: number;
    };
}

export interface NetSimProgress {
    username: string;
    updatedAt: string;
    completedLessons: string[];
    lessonScores: Record<string, { score: number; attempts: number; completedAt: string }>;
    badges: string[];
    currentTrackId?: string;
    xp: number;
}

/* ══════════════════════════ Packets & simulation ══════════════════════════ */

export interface PduField {
    label: string;
    value: string;
    /** Bit/byte width, used by the hex/field ruler in the inspector. */
    bits?: number;
    hint?: string;
}

export interface PduLayer {
    layer: LayerId;
    name: string;
    protocol: string;
    summary: string;
    bytes: number;
    fields: PduField[];
}

export interface Pdu {
    id: string;
    /** Top-down stack description, e.g. ['Ethernet II','IPv4','ICMP']. */
    stack: string[];
    layers: PduLayer[];
    srcMac: string;
    dstMac: string;
    srcIp?: string;
    dstIp?: string;
    srcPort?: number;
    dstPort?: number;
    vlan?: number;
    ttl?: number;
    protocol: string;
    sizeBytes: number;
    payload?: string;
}

export type HopAction =
    | 'originate'
    | 'forward-l2'
    | 'flood'
    | 'route'
    | 'deliver'
    | 'drop'
    | 'nat'
    | 'acl-deny'
    | 'ttl-expired'
    | 'arp-request'
    | 'arp-reply'
    | 'bridge-wireless'
    | 'stp-blocked'
    | 'encapsulate'
    | 'decapsulate'
    | 'reply';

export interface Hop {
    index: number;
    deviceId: string;
    deviceName: string;
    deviceRole: DeviceRole;
    inInterfaceId?: string;
    inInterfaceName?: string;
    outInterfaceId?: string;
    outInterfaceName?: string;
    linkId?: string;
    action: HopAction;
    /** The PDU *as it looks leaving this device* — shows rewrites. */
    pdu: Pdu;
    layersTouched: LayerId[];
    notes: string[];
    cumulativeLatencyMs: number;
    ok: boolean;
}

export interface PacketTrace {
    id: string;
    label: string;
    protocol: string;
    srcDeviceId: string;
    srcDeviceName: string;
    dstDeviceId?: string;
    dstDeviceName?: string;
    srcIp?: string;
    dstIp?: string;
    hops: Hop[];
    status: 'success' | 'failed' | 'partial';
    reason?: string;
    totalLatencyMs: number;
    startedAt: number;
}

export type EventKind =
    | 'info' | 'tx' | 'rx' | 'drop' | 'learn' | 'route' | 'arp'
    | 'dhcp' | 'dns' | 'tcp' | 'icmp' | 'stp' | 'wireless' | 'nat'
    | 'acl' | 'error' | 'success' | 'http';

export interface SimEvent {
    id: string;
    seq: number;
    timeMs: number;
    deviceId?: string;
    deviceName?: string;
    layer?: LayerId;
    kind: EventKind;
    protocol?: string;
    message: string;
    detail?: string;
    traceId?: string;
    pduId?: string;
}

export interface ValidationIssue {
    id: string;
    severity: 'error' | 'warning' | 'hint';
    deviceId?: string;
    linkId?: string;
    interfaceId?: string;
    title: string;
    detail: string;
    /** Short "how to fix" that the AI helper and the UI both use. */
    fix?: string;
}

/* ══════════════════════════ Curriculum ══════════════════════════ */

export interface LessonTask {
    id: string;
    text: string;
    /** Machine check id resolved in `lessons.ts`. */
    check: string;
    args?: Record<string, any>;
    hint?: string;
}

export interface Lesson {
    id: string;
    trackId: string;
    order: number;
    title: string;
    subtitle: string;
    minutes: number;
    difficulty: Difficulty;
    layers: LayerId[];
    objectives: string[];
    theory: string;
    /** Key/value glossary rendered as chips. */
    keyTerms: Array<{ term: string; meaning: string }>;
    commands?: Array<{ cmd: string; explain: string }>;
    tasks: LessonTask[];
    /** Optional starter topology id from `TOPOLOGY_TEMPLATES`. */
    starterTemplateId?: string;
    quiz?: Array<{ q: string; options: string[]; answer: number; why: string }>;
}

export interface Track {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    accent: string;
    order: number;
    description: string;
}

export interface TopologyTemplate {
    id: string;
    name: string;
    description: string;
    difficulty: Difficulty;
    tags: string[];
    icon: string;
    build: () => Topology;
}

/* ══════════════════════════ CLI ══════════════════════════ */

export type CliMode = 'user' | 'privileged' | 'config' | 'config-if' | 'config-vlan' | 'config-line' | 'config-router' | 'config-dhcp';

export interface CliSession {
    deviceId: string;
    mode: CliMode;
    contextInterfaceId?: string;
    contextVlanId?: number;
    contextPoolId?: string;
    contextRouter?: 'rip' | 'ospf';
    history: string[];
    historyIndex: number;
    lines: CliLine[];
}

export interface CliLine {
    id: string;
    kind: 'prompt' | 'output' | 'error' | 'info' | 'success';
    text: string;
}
