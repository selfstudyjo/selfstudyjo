/**
 * src/netsim/packet.ts
 * PDU construction with honest per-layer encapsulation.
 *
 * Every packet the engine moves is built here, layer by layer, so the Packet
 * Inspector can show a student exactly which header was added by which layer
 * and which fields get rewritten at each hop. That "watch the headers change"
 * moment is the single most valuable thing a simulator can teach.
 */

import type { Pdu, PduLayer, PduField, LayerId } from './types';
import { BROADCAST_MAC, pseudoChecksum, randomEphemeralPort } from './ip';

let pduSeq = 0;
export function nextPduId(): string {
    pduSeq += 1;
    return `pdu-${pduSeq}-${Math.random().toString(36).slice(2, 7)}`;
}

export function resetPduCounter(): void {
    pduSeq = 0;
}

/* ─────────────── Well-known ports, for the inspector hints ─────────────── */

export const WELL_KNOWN_PORTS: Record<number, string> = {
    20: 'FTP-DATA', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP',
    53: 'DNS', 67: 'DHCP-Server', 68: 'DHCP-Client', 69: 'TFTP',
    80: 'HTTP', 110: 'POP3', 123: 'NTP', 143: 'IMAP', 161: 'SNMP',
    162: 'SNMP-Trap', 179: 'BGP', 389: 'LDAP', 443: 'HTTPS',
    445: 'SMB', 514: 'Syslog', 520: 'RIP', 546: 'DHCPv6-Client',
    547: 'DHCPv6-Server', 587: 'SMTP-Submission', 636: 'LDAPS',
    1812: 'RADIUS', 1883: 'MQTT', 3389: 'RDP', 5060: 'SIP',
    5353: 'mDNS', 8080: 'HTTP-Alt', 8883: 'MQTT-TLS', 9100: 'Printer-RAW',
};

export function portName(port?: number): string {
    if (port === undefined) return '';
    return WELL_KNOWN_PORTS[port] ? `${port} (${WELL_KNOWN_PORTS[port]})` : String(port);
}

export const IP_PROTO_NUMBERS: Record<string, number> = {
    ICMP: 1, IGMP: 2, TCP: 6, UDP: 17, GRE: 47, ESP: 50, AH: 51, OSPF: 89,
};

/* ─────────────── Layer builders ─────────────── */

export interface EthernetOpts {
    srcMac: string;
    dstMac: string;
    vlan?: number;
    /** EtherType of the payload — 0x0800 IPv4, 0x0806 ARP, 0x86DD IPv6. */
    etherType?: string;
    dot1p?: number;
}

export function ethernetLayer(o: EthernetOpts): PduLayer {
    const tagged = o.vlan !== undefined && o.vlan !== null;
    const fields: PduField[] = [
        { label: 'Destination MAC', value: o.dstMac, bits: 48, hint: o.dstMac === BROADCAST_MAC ? 'Broadcast — every device in the VLAN must process this frame' : 'Rewritten at every Layer-3 hop' },
        { label: 'Source MAC', value: o.srcMac, bits: 48, hint: 'Switches learn their MAC table from this field' },
    ];
    if (tagged) {
        fields.push(
            { label: '802.1Q TPID', value: '0x8100', bits: 16, hint: 'Marks the frame as VLAN-tagged' },
            { label: 'PCP (CoS)', value: String(o.dot1p ?? 0), bits: 3, hint: 'Layer-2 priority, 5 for voice' },
            { label: 'DEI', value: '0', bits: 1 },
            { label: 'VLAN ID', value: String(o.vlan), bits: 12, hint: 'Only present on a trunk — access ports are untagged' },
        );
    }
    fields.push(
        { label: 'EtherType', value: o.etherType || '0x0800', bits: 16, hint: '0x0800 = IPv4, 0x0806 = ARP, 0x86DD = IPv6' },
        { label: 'FCS', value: pseudoChecksum(`${o.srcMac}${o.dstMac}${o.vlan ?? ''}`), bits: 32, hint: 'CRC-32 — a corrupted frame is dropped, never repaired' },
    );

    return {
        layer: 2,
        name: 'Data Link',
        protocol: tagged ? 'Ethernet II + 802.1Q' : 'Ethernet II',
        summary: `${o.srcMac} → ${o.dstMac}${tagged ? ` (VLAN ${o.vlan})` : ''}`,
        bytes: tagged ? 22 : 18,
        fields,
    };
}

export interface Ipv4Opts {
    srcIp: string;
    dstIp: string;
    ttl: number;
    protocol: 'ICMP' | 'TCP' | 'UDP' | 'OSPF' | 'IGMP' | 'ESP';
    dscp?: number;
    totalLength?: number;
    identification?: number;
    dontFragment?: boolean;
}

export function ipv4Layer(o: Ipv4Opts): PduLayer {
    return {
        layer: 3,
        name: 'Network',
        protocol: 'IPv4',
        summary: `${o.srcIp} → ${o.dstIp} (TTL ${o.ttl}, ${o.protocol})`,
        bytes: 20,
        fields: [
            { label: 'Version', value: '4', bits: 4 },
            { label: 'IHL', value: '5 (20 bytes)', bits: 4 },
            { label: 'DSCP', value: String(o.dscp ?? 0) + (o.dscp === 46 ? ' (EF — voice)' : ''), bits: 6, hint: 'QoS marking; routers queue on this' },
            { label: 'ECN', value: '0', bits: 2 },
            { label: 'Total Length', value: `${o.totalLength ?? 60} bytes`, bits: 16 },
            { label: 'Identification', value: `0x${(o.identification ?? 0x1c46).toString(16)}`, bits: 16, hint: 'Groups fragments of the same original packet' },
            { label: 'Flags', value: o.dontFragment ? 'DF' : '—', bits: 3 },
            { label: 'Fragment Offset', value: '0', bits: 13 },
            { label: 'TTL', value: String(o.ttl), bits: 8, hint: 'Decremented by every router. At 0 the packet dies and ICMP Time Exceeded is returned — this is how traceroute works' },
            { label: 'Protocol', value: `${IP_PROTO_NUMBERS[o.protocol] ?? 0} (${o.protocol})`, bits: 8 },
            { label: 'Header Checksum', value: pseudoChecksum(`${o.srcIp}${o.dstIp}${o.ttl}`), bits: 16, hint: 'Recalculated at every hop because the TTL changed' },
            { label: 'Source IP', value: o.srcIp, bits: 32, hint: 'Unchanged end to end — unless NAT rewrites it' },
            { label: 'Destination IP', value: o.dstIp, bits: 32, hint: 'Never changes in transit (this is the key difference from the MAC address)' },
        ],
    };
}

export function ipv6Layer(o: { srcIp: string; dstIp: string; hopLimit: number; nextHeader: string }): PduLayer {
    return {
        layer: 3,
        name: 'Network',
        protocol: 'IPv6',
        summary: `${o.srcIp} → ${o.dstIp} (hop limit ${o.hopLimit})`,
        bytes: 40,
        fields: [
            { label: 'Version', value: '6', bits: 4 },
            { label: 'Traffic Class', value: '0', bits: 8 },
            { label: 'Flow Label', value: '0x00000', bits: 20, hint: 'Lets routers keep a flow on one path without reading L4' },
            { label: 'Payload Length', value: '40 bytes', bits: 16 },
            { label: 'Next Header', value: o.nextHeader, bits: 8, hint: 'Replaces both "Protocol" and IPv4 options' },
            { label: 'Hop Limit', value: String(o.hopLimit), bits: 8, hint: 'IPv6 name for TTL' },
            { label: 'Source Address', value: o.srcIp, bits: 128 },
            { label: 'Destination Address', value: o.dstIp, bits: 128 },
        ],
    };
}

export function arpLayer(o: {
    operation: 'request' | 'reply';
    senderMac: string;
    senderIp: string;
    targetMac: string;
    targetIp: string;
}): PduLayer {
    return {
        layer: 2,
        name: 'Data Link',
        protocol: 'ARP',
        summary: o.operation === 'request'
            ? `Who has ${o.targetIp}? Tell ${o.senderIp}`
            : `${o.targetIp} is at ${o.senderMac}`,
        bytes: 28,
        fields: [
            { label: 'Hardware Type', value: '1 (Ethernet)', bits: 16 },
            { label: 'Protocol Type', value: '0x0800 (IPv4)', bits: 16 },
            { label: 'Hardware Size', value: '6', bits: 8 },
            { label: 'Protocol Size', value: '4', bits: 8 },
            { label: 'Opcode', value: o.operation === 'request' ? '1 (request)' : '2 (reply)', bits: 16 },
            { label: 'Sender MAC', value: o.senderMac, bits: 48 },
            { label: 'Sender IP', value: o.senderIp, bits: 32 },
            { label: 'Target MAC', value: o.operation === 'request' ? '00:00:00:00:00:00' : o.targetMac, bits: 48, hint: o.operation === 'request' ? 'Unknown — that is the whole point of the request' : undefined },
            { label: 'Target IP', value: o.targetIp, bits: 32 },
        ],
    };
}

export function icmpLayer(o: {
    type: number;
    code: number;
    seq?: number;
    identifier?: number;
    payloadText?: string;
}): PduLayer {
    const label = icmpTypeName(o.type, o.code);
    return {
        layer: 3,
        name: 'Network (control)',
        protocol: 'ICMP',
        summary: label,
        bytes: 8,
        fields: [
            { label: 'Type', value: `${o.type} (${label.split(' — ')[0]})`, bits: 8 },
            { label: 'Code', value: String(o.code), bits: 8 },
            { label: 'Checksum', value: pseudoChecksum(`${o.type}${o.code}${o.seq ?? 0}`), bits: 16 },
            { label: 'Identifier', value: String(o.identifier ?? 1), bits: 16, hint: 'Matches replies to the process that sent the request' },
            { label: 'Sequence', value: String(o.seq ?? 1), bits: 16 },
            { label: 'Payload', value: o.payloadText || 'abcdefghijklmnopqrstuvwabcdefghi (32 bytes)', hint: 'Echoed back unchanged by the destination' },
        ],
    };
}

export function icmpTypeName(type: number, code = 0): string {
    switch (type) {
        case 0: return 'Echo Reply — the ping came back';
        case 3:
            switch (code) {
                case 0: return 'Destination Unreachable — network unreachable';
                case 1: return 'Destination Unreachable — host unreachable';
                case 3: return 'Destination Unreachable — port unreachable';
                case 13: return 'Destination Unreachable — administratively prohibited (an ACL dropped it)';
                default: return 'Destination Unreachable';
            }
        case 5: return 'Redirect — use a better gateway';
        case 8: return 'Echo Request — ping';
        case 11: return 'Time Exceeded — TTL hit zero (traceroute relies on this)';
        default: return `ICMP type ${type}`;
    }
}

export function tcpLayer(o: {
    srcPort: number;
    dstPort: number;
    seq: number;
    ack: number;
    flags: string[];
    window?: number;
    mss?: number;
}): PduLayer {
    const flagStr = o.flags.join(', ') || 'none';
    return {
        layer: 4,
        name: 'Transport',
        protocol: 'TCP',
        summary: `${o.srcPort} → ${portName(o.dstPort)} [${flagStr}] Seq=${o.seq} Ack=${o.ack}`,
        bytes: 20,
        fields: [
            { label: 'Source Port', value: String(o.srcPort), bits: 16, hint: 'Ephemeral port chosen by the client' },
            { label: 'Destination Port', value: portName(o.dstPort), bits: 16, hint: 'Identifies the service being asked for' },
            { label: 'Sequence Number', value: String(o.seq), bits: 32, hint: 'Byte offset of this segment in the stream' },
            { label: 'Acknowledgment Number', value: String(o.ack), bits: 32, hint: 'Next byte the sender expects to receive' },
            { label: 'Data Offset', value: '5 (20 bytes)', bits: 4 },
            { label: 'Flags', value: flagStr, bits: 9, hint: 'SYN opens, ACK confirms, FIN closes politely, RST closes rudely' },
            { label: 'Window Size', value: String(o.window ?? 64240), bits: 16, hint: 'Flow control: how much the receiver can still buffer' },
            { label: 'Checksum', value: pseudoChecksum(`${o.srcPort}${o.dstPort}${o.seq}`), bits: 16 },
            { label: 'Urgent Pointer', value: '0', bits: 16 },
            ...(o.mss ? [{ label: 'Option: MSS', value: `${o.mss} bytes`, hint: 'Largest segment the receiver wants; lower it over VPNs' } as PduField] : []),
        ],
    };
}

export function udpLayer(o: { srcPort: number; dstPort: number; length?: number }): PduLayer {
    return {
        layer: 4,
        name: 'Transport',
        protocol: 'UDP',
        summary: `${o.srcPort} → ${portName(o.dstPort)}`,
        bytes: 8,
        fields: [
            { label: 'Source Port', value: String(o.srcPort), bits: 16 },
            { label: 'Destination Port', value: portName(o.dstPort), bits: 16 },
            { label: 'Length', value: `${o.length ?? 32} bytes`, bits: 16 },
            { label: 'Checksum', value: pseudoChecksum(`${o.srcPort}${o.dstPort}`), bits: 16, hint: 'Optional in IPv4, mandatory in IPv6' },
        ],
    };
}

export function dhcpLayer(o: {
    messageType: 'Discover' | 'Offer' | 'Request' | 'Ack' | 'Nak' | 'Release';
    clientMac: string;
    offeredIp?: string;
    serverIp?: string;
    mask?: string;
    gateway?: string;
    dns?: string;
    leaseHours?: number;
    transactionId?: string;
}): PduLayer {
    const fields: PduField[] = [
        { label: 'Op', value: o.messageType === 'Offer' || o.messageType === 'Ack' ? '2 (BOOTREPLY)' : '1 (BOOTREQUEST)', bits: 8 },
        { label: 'Transaction ID (xid)', value: o.transactionId || '0x3903F326', bits: 32, hint: 'Ties all four DORA messages together' },
        { label: 'Client MAC (chaddr)', value: o.clientMac, bits: 48, hint: 'The server keys the lease on this' },
        { label: 'Option 53: Message Type', value: `${dhcpTypeCode(o.messageType)} (${o.messageType})` },
    ];
    if (o.offeredIp) fields.push({ label: 'yiaddr / Option 50', value: o.offeredIp, hint: '"your" IP address — the address being offered' });
    if (o.mask) fields.push({ label: 'Option 1: Subnet Mask', value: o.mask });
    if (o.gateway) fields.push({ label: 'Option 3: Router', value: o.gateway, hint: 'This becomes the client default gateway' });
    if (o.dns) fields.push({ label: 'Option 6: DNS Server', value: o.dns });
    if (o.leaseHours) fields.push({ label: 'Option 51: Lease Time', value: `${o.leaseHours * 3600}s (${o.leaseHours}h)` });
    if (o.serverIp) fields.push({ label: 'Option 54: Server Identifier', value: o.serverIp });

    return {
        layer: 7,
        name: 'Application',
        protocol: 'DHCP',
        summary: `DHCP ${o.messageType}${o.offeredIp ? ` — ${o.offeredIp}` : ''}`,
        bytes: 300,
        fields,
    };
}

function dhcpTypeCode(t: string): number {
    return ({ Discover: 1, Offer: 2, Request: 3, Ack: 5, Nak: 6, Release: 7 } as Record<string, number>)[t] ?? 0;
}

export function dnsLayer(o: {
    kind: 'query' | 'response';
    name: string;
    recordType?: string;
    answer?: string;
    transactionId?: string;
    ttl?: number;
    authoritative?: boolean;
}): PduLayer {
    const fields: PduField[] = [
        { label: 'Transaction ID', value: o.transactionId || '0x8f2b', bits: 16 },
        { label: 'Flags', value: o.kind === 'query' ? '0x0100 (standard query, RD set)' : `0x81${o.authoritative ? '84' : '80'} (response, RA set)`, bits: 16, hint: 'RD = recursion desired, RA = recursion available' },
        { label: 'Questions', value: '1', bits: 16 },
        { label: 'Answer RRs', value: o.kind === 'response' ? '1' : '0', bits: 16 },
        { label: 'Query Name', value: o.name },
        { label: 'Query Type', value: o.recordType || 'A', hint: 'A = IPv4, AAAA = IPv6, MX = mail, CNAME = alias' },
    ];
    if (o.kind === 'response' && o.answer) {
        fields.push(
            { label: 'Answer', value: `${o.name} → ${o.answer}` },
            { label: 'TTL', value: `${o.ttl ?? 300}s`, hint: 'How long resolvers may cache this answer' },
        );
    }
    return {
        layer: 7,
        name: 'Application',
        protocol: 'DNS',
        summary: o.kind === 'query' ? `Query A ${o.name}` : `Response ${o.name} = ${o.answer}`,
        bytes: 60,
        fields,
    };
}

export function httpLayer(o: {
    kind: 'request' | 'response';
    method?: string;
    path?: string;
    host?: string;
    status?: number;
    body?: string;
    tls?: boolean;
}): PduLayer {
    const fields: PduField[] = o.kind === 'request'
        ? [
            { label: 'Request Line', value: `${o.method || 'GET'} ${o.path || '/'} HTTP/1.1` },
            { label: 'Host', value: o.host || '', hint: 'Lets one IP serve many sites (virtual hosting)' },
            { label: 'User-Agent', value: 'SelfStudyJO-NetSim/1.0' },
            { label: 'Accept', value: 'text/html,application/xhtml+xml' },
            { label: 'Connection', value: 'keep-alive', hint: 'Reuses the TCP connection for the next request' },
        ]
        : [
            { label: 'Status Line', value: `HTTP/1.1 ${o.status ?? 200} ${httpStatusText(o.status ?? 200)}` },
            { label: 'Content-Type', value: 'text/html; charset=utf-8' },
            { label: 'Content-Length', value: String((o.body || '').length) },
            { label: 'Server', value: 'SelfStudyJO-NetSim' },
            { label: 'Body', value: (o.body || '').slice(0, 400) },
        ];

    const layers: PduLayer = {
        layer: 7,
        name: 'Application',
        protocol: o.tls ? 'HTTP over TLS (HTTPS)' : 'HTTP',
        summary: o.kind === 'request'
            ? `${o.method || 'GET'} http${o.tls ? 's' : ''}://${o.host}${o.path || '/'}`
            : `${o.status ?? 200} ${httpStatusText(o.status ?? 200)}`,
        bytes: o.kind === 'request' ? 220 : 300 + (o.body || '').length,
        fields,
    };
    return layers;
}

export function httpStatusText(code: number): string {
    return ({
        200: 'OK', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found',
        304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized',
        403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error',
        502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
    } as Record<number, string>)[code] || 'Unknown';
}

export function tlsLayer(o: { kind: 'client-hello' | 'server-hello' | 'application-data'; sni?: string }): PduLayer {
    const fieldsByKind: Record<string, PduField[]> = {
        'client-hello': [
            { label: 'Handshake Type', value: '1 (Client Hello)' },
            { label: 'Version', value: 'TLS 1.3' },
            { label: 'SNI', value: o.sni || '', hint: 'Server Name Indication — sent in the clear, which is how filtering appliances see the hostname' },
            { label: 'Cipher Suites', value: 'TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256' },
            { label: 'Key Share', value: 'x25519 (32 bytes)' },
        ],
        'server-hello': [
            { label: 'Handshake Type', value: '2 (Server Hello)' },
            { label: 'Version', value: 'TLS 1.3' },
            { label: 'Selected Cipher', value: 'TLS_AES_256_GCM_SHA384' },
            { label: 'Certificate', value: 'CN=server, signed by SelfStudy-CA' },
        ],
        'application-data': [
            { label: 'Record Type', value: '23 (Application Data)' },
            { label: 'Encrypted Payload', value: '…AES-256-GCM ciphertext…', hint: 'Beyond this point an on-path device sees only ciphertext' },
        ],
    };
    return {
        layer: 6,
        name: 'Presentation / Session',
        protocol: 'TLS 1.3',
        summary: o.kind === 'client-hello' ? `TLS Client Hello (SNI ${o.sni})` : o.kind === 'server-hello' ? 'TLS Server Hello + Certificate' : 'TLS Application Data (encrypted)',
        bytes: o.kind === 'application-data' ? 120 : 260,
        fields: fieldsByKind[o.kind],
    };
}

export function stpLayer(o: { rootId: string; bridgeId: string; cost: number; portRole: string }): PduLayer {
    return {
        layer: 2,
        name: 'Data Link',
        protocol: 'STP BPDU',
        summary: `BPDU root=${o.rootId} cost=${o.cost}`,
        bytes: 35,
        fields: [
            { label: 'Protocol ID', value: '0x0000 (STP)', bits: 16 },
            { label: 'BPDU Type', value: '0x00 (Configuration)', bits: 8 },
            { label: 'Root Bridge ID', value: o.rootId, hint: 'Lowest priority wins; MAC breaks the tie' },
            { label: 'Root Path Cost', value: String(o.cost), hint: '1 G = 4, 100 M = 19, 10 M = 100' },
            { label: 'Bridge ID', value: o.bridgeId },
            { label: 'Port Role', value: o.portRole },
            { label: 'Hello Time', value: '2s' },
            { label: 'Max Age', value: '20s' },
            { label: 'Forward Delay', value: '15s', hint: 'Classic STP takes ~50s to converge; RSTP does it in under a second' },
        ],
    };
}

/* ─────────────── Full PDU assembly ─────────────── */

export interface BuildPduOpts {
    srcMac: string;
    dstMac: string;
    vlan?: number;
    srcIp?: string;
    dstIp?: string;
    ttl?: number;
    srcPort?: number;
    dstPort?: number;
    protocol: string;
    dscp?: number;
    /** Upper layers, already built. Order does not matter; sorted on output. */
    upper?: PduLayer[];
    payload?: string;
}

/**
 * Physical layer is always present — a frame is ultimately bits on a medium.
 */
export function physicalLayer(medium: string, speedMbps: number, bytes: number): PduLayer {
    const encoding = medium === 'fiber' || medium === 'sfp' ? '64b/66b line code over laser'
        : medium === 'wireless' ? 'OFDM / OFDMA modulated radio'
        : medium === 'cellular' ? '5G NR OFDM (CP-OFDM up / down)'
        : medium === 'serial' ? 'NRZ over a synchronous clock'
        : medium === 'coaxial' ? 'QAM over DOCSIS RF'
        : '4D-PAM5 over 4 twisted pairs';
    return {
        layer: 1,
        name: 'Physical',
        protocol: mediumProtocol(medium, speedMbps),
        summary: `${bytes} bytes → ${bytes * 8} bits on ${medium}`,
        bytes: 8, // preamble + SFD
        fields: [
            { label: 'Preamble', value: '10101010 × 7', bits: 56, hint: 'Lets the receiver lock onto the clock' },
            { label: 'Start Frame Delimiter', value: '10101011', bits: 8 },
            { label: 'Encoding', value: encoding },
            { label: 'Signalling Rate', value: `${speedMbps} Mbps` },
            { label: 'Duplex', value: medium === 'wireless' || medium === 'cellular' ? 'Half (shared airtime)' : 'Full' },
        ],
    };
}

function mediumProtocol(medium: string, speed: number): string {
    if (medium === 'wireless') return speed >= 2400 ? '802.11be (Wi-Fi 7)' : speed >= 1200 ? '802.11ax (Wi-Fi 6)' : '802.11ac';
    if (medium === 'cellular') return '5G NR';
    if (medium === 'fiber' || medium === 'sfp') return speed >= 100000 ? '100GBASE-SR4' : speed >= 10000 ? '10GBASE-SR' : '1000BASE-LX';
    if (medium === 'serial') return 'HDLC / PPP over serial';
    if (medium === 'coaxial') return 'DOCSIS 4.0';
    if (speed >= 10000) return '10GBASE-T';
    if (speed >= 2500) return '2.5GBASE-T';
    if (speed >= 1000) return '1000BASE-T';
    if (speed >= 100) return '100BASE-TX';
    return '10BASE-T';
}

export function buildPdu(o: BuildPduOpts, medium = 'copper-ethernet', speedMbps = 1000): Pdu {
    const layers: PduLayer[] = [];
    const upper = o.upper || [];

    const hasArp = upper.some(l => l.protocol === 'ARP');
    const l4 = upper.find(l => l.layer === 4);
    const l3proto = (l4?.protocol as any) || (upper.some(l => l.protocol === 'ICMP') ? 'ICMP' : 'ICMP');

    // Layer 7/6/5 first (they are conceptually innermost = the payload)
    upper.filter(l => l.layer >= 5).sort((a, b) => b.layer - a.layer).forEach(l => layers.push(l));
    // Layer 4
    if (l4) layers.push(l4);
    // Layer 3
    if (!hasArp && o.srcIp && o.dstIp) {
        const icmp = upper.find(l => l.protocol === 'ICMP');
        layers.push(ipv4Layer({
            srcIp: o.srcIp,
            dstIp: o.dstIp,
            ttl: o.ttl ?? 64,
            protocol: icmp ? 'ICMP' : (l3proto === 'TCP' || l3proto === 'UDP' ? l3proto : 'ICMP'),
            dscp: o.dscp,
            totalLength: 20 + (l4?.bytes || 0) + upper.filter(l => l.layer >= 5).reduce((s, l) => s + l.bytes, 0) + (icmp?.bytes || 0),
        }));
        if (icmp) layers.push(icmp);
    } else {
        upper.filter(l => l.layer === 3).forEach(l => layers.push(l));
    }
    // ARP sits directly on Ethernet
    if (hasArp) upper.filter(l => l.protocol === 'ARP').forEach(l => layers.push(l));
    // STP BPDUs likewise
    upper.filter(l => l.protocol === 'STP BPDU').forEach(l => layers.push(l));

    // Layer 2
    layers.push(ethernetLayer({
        srcMac: o.srcMac,
        dstMac: o.dstMac,
        vlan: o.vlan,
        etherType: hasArp ? '0x0806' : '0x0800',
        dot1p: o.dscp === 46 ? 5 : 0,
    }));

    const sizeBytes = Math.max(64, layers.reduce((s, l) => s + l.bytes, 0));
    layers.push(physicalLayer(medium, speedMbps, sizeBytes));

    // Sort top-down (7 → 1) for display
    layers.sort((a, b) => b.layer - a.layer || 0);

    return {
        id: nextPduId(),
        stack: dedupe(layers.map(l => l.protocol)),
        layers,
        srcMac: o.srcMac,
        dstMac: o.dstMac,
        srcIp: o.srcIp,
        dstIp: o.dstIp,
        srcPort: o.srcPort,
        dstPort: o.dstPort,
        vlan: o.vlan,
        ttl: o.ttl,
        protocol: o.protocol,
        sizeBytes,
        payload: o.payload,
    };
}

function dedupe(a: string[]): string[] {
    return a.filter((v, i) => a.indexOf(v) === i);
}

/** Deep-ish clone used when a hop rewrites headers. */
export function clonePdu(pdu: Pdu, overrides: Partial<Pdu> = {}): Pdu {
    return {
        ...pdu,
        id: nextPduId(),
        stack: [...pdu.stack],
        layers: pdu.layers.map(l => ({ ...l, fields: l.fields.map(f => ({ ...f })) })),
        ...overrides,
    };
}

/**
 * Rewrite the Ethernet header of an existing PDU — exactly what a router does
 * on every hop. Returns a new PDU so the trace keeps the "before" version.
 */
export function rewriteEthernet(pdu: Pdu, srcMac: string, dstMac: string, vlan?: number): Pdu {
    const next = clonePdu(pdu, { srcMac, dstMac, vlan });
    const idx = next.layers.findIndex(l => l.layer === 2 && l.protocol.startsWith('Ethernet'));
    const fresh = ethernetLayer({ srcMac, dstMac, vlan, etherType: pdu.stack.includes('ARP') ? '0x0806' : '0x0800' });
    if (idx >= 0) next.layers[idx] = fresh; else next.layers.push(fresh);
    return next;
}

/** Decrement TTL and refresh the IPv4 layer (and its checksum). */
export function decrementTtl(pdu: Pdu): Pdu {
    const ttl = Math.max(0, (pdu.ttl ?? 64) - 1);
    const next = clonePdu(pdu, { ttl });
    const idx = next.layers.findIndex(l => l.layer === 3 && l.protocol === 'IPv4');
    if (idx >= 0 && pdu.srcIp && pdu.dstIp) {
        const old = next.layers[idx];
        const proto = (old.fields.find(f => f.label === 'Protocol')?.value || '1 (ICMP)').match(/\((\w+)\)/)?.[1] || 'ICMP';
        next.layers[idx] = ipv4Layer({
            srcIp: pdu.srcIp, dstIp: pdu.dstIp, ttl, protocol: proto as any,
        });
    }
    return next;
}

/** Apply a NAT translation to the IP (and optionally port) headers. */
export function applyNat(pdu: Pdu, newSrcIp: string, newSrcPort?: number): Pdu {
    const next = clonePdu(pdu, { srcIp: newSrcIp, srcPort: newSrcPort ?? pdu.srcPort });
    const l3 = next.layers.findIndex(l => l.layer === 3 && l.protocol === 'IPv4');
    if (l3 >= 0) {
        const f = next.layers[l3].fields.find(x => x.label === 'Source IP');
        if (f) { f.value = newSrcIp; f.hint = 'Rewritten by NAT — the inside host never sees this address'; }
        next.layers[l3].summary = `${newSrcIp} → ${pdu.dstIp} (TTL ${next.ttl}, ${pdu.protocol})`;
    }
    if (newSrcPort !== undefined) {
        const l4 = next.layers.findIndex(l => l.layer === 4);
        if (l4 >= 0) {
            const f = next.layers[l4].fields.find(x => x.label === 'Source Port');
            if (f) { f.value = String(newSrcPort); f.hint = 'PAT assigned this port so many hosts can share one public address'; }
        }
    }
    return next;
}

/** Add or remove the 802.1Q tag as a frame crosses an access/trunk boundary. */
export function retag(pdu: Pdu, vlan: number | undefined): Pdu {
    return rewriteEthernet(pdu, pdu.srcMac, pdu.dstMac, vlan);
}

/* ─────────────── Convenience builders for common flows ─────────────── */

export function buildIcmpEcho(o: {
    srcMac: string; dstMac: string; srcIp: string; dstIp: string;
    ttl?: number; seq: number; vlan?: number; reply?: boolean;
    medium?: string; speedMbps?: number;
}): Pdu {
    return buildPdu({
        srcMac: o.srcMac, dstMac: o.dstMac, srcIp: o.srcIp, dstIp: o.dstIp,
        ttl: o.ttl ?? 64, vlan: o.vlan, protocol: o.reply ? 'ICMP Echo Reply' : 'ICMP Echo Request',
        upper: [icmpLayer({ type: o.reply ? 0 : 8, code: 0, seq: o.seq })],
        payload: '32 bytes of ping payload',
    }, o.medium, o.speedMbps);
}

export function buildArpRequest(o: {
    senderMac: string; senderIp: string; targetIp: string; vlan?: number;
    medium?: string; speedMbps?: number;
}): Pdu {
    return buildPdu({
        srcMac: o.senderMac, dstMac: BROADCAST_MAC, vlan: o.vlan, protocol: 'ARP Request',
        upper: [arpLayer({ operation: 'request', senderMac: o.senderMac, senderIp: o.senderIp, targetMac: BROADCAST_MAC, targetIp: o.targetIp })],
    }, o.medium, o.speedMbps);
}

export function buildArpReply(o: {
    senderMac: string; senderIp: string; targetMac: string; targetIp: string; vlan?: number;
    medium?: string; speedMbps?: number;
}): Pdu {
    return buildPdu({
        srcMac: o.senderMac, dstMac: o.targetMac, vlan: o.vlan, protocol: 'ARP Reply',
        upper: [arpLayer({ operation: 'reply', senderMac: o.senderMac, senderIp: o.senderIp, targetMac: o.targetMac, targetIp: o.targetIp })],
    }, o.medium, o.speedMbps);
}

export function buildTcpSegment(o: {
    srcMac: string; dstMac: string; srcIp: string; dstIp: string;
    srcPort: number; dstPort: number; flags: string[]; seq: number; ack: number;
    vlan?: number; ttl?: number; app?: PduLayer[]; mss?: number;
    medium?: string; speedMbps?: number;
}): Pdu {
    return buildPdu({
        srcMac: o.srcMac, dstMac: o.dstMac, srcIp: o.srcIp, dstIp: o.dstIp,
        srcPort: o.srcPort, dstPort: o.dstPort, ttl: o.ttl ?? 64, vlan: o.vlan,
        protocol: `TCP [${o.flags.join(',')}]`,
        upper: [
            ...(o.app || []),
            tcpLayer({ srcPort: o.srcPort, dstPort: o.dstPort, seq: o.seq, ack: o.ack, flags: o.flags, mss: o.mss }),
        ],
    }, o.medium, o.speedMbps);
}

export function buildUdpDatagram(o: {
    srcMac: string; dstMac: string; srcIp: string; dstIp: string;
    srcPort: number; dstPort: number; vlan?: number; ttl?: number;
    app?: PduLayer[]; label?: string; medium?: string; speedMbps?: number;
}): Pdu {
    return buildPdu({
        srcMac: o.srcMac, dstMac: o.dstMac, srcIp: o.srcIp, dstIp: o.dstIp,
        srcPort: o.srcPort, dstPort: o.dstPort, ttl: o.ttl ?? 64, vlan: o.vlan,
        protocol: o.label || 'UDP',
        upper: [...(o.app || []), udpLayer({ srcPort: o.srcPort, dstPort: o.dstPort })],
    }, o.medium, o.speedMbps);
}

export { randomEphemeralPort };

/** Layer ids present in a PDU — drives the layer highlight strip in the UI. */
export function layersOf(pdu: Pdu): LayerId[] {
    return Array.from(new Set(pdu.layers.map(l => l.layer))).sort((a, b) => b - a) as LayerId[];
}
