/**
 * src/services/netsim-ai.service.ts
 * The AI tutor for the Network Simulator, served by the Self Study AI backend
 * (app_id 27) through the sfsdomains registry — never a hardcoded replica.
 *
 * Five capabilities, each with its own system prompt:
 *   ask()          → teach a networking concept, aware of the open topology
 *   generate()     → produce a complete topology as strict JSON
 *   review()       → design review of what the student has built
 *   troubleshoot() → diagnose a described symptom using the real event log
 *   explainPacket() → walk through one hop of a captured trace, layer by layer
 */

import { serviceRegistry } from './config';
import type { Topology, ValidationIssue, SimEvent, Hop, PacketTrace, Device } from '@/netsim/types';
import type { AiTopologySpec } from '@/netsim/topology';
import { DEVICE_TYPES } from '@/netsim/devices';
import { maskToPrefix } from '@/netsim/ip';

export interface AiMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AiResult<T = string> {
    ok: boolean;
    data?: T;
    error?: string;
    raw?: string;
}

const TYPE_LIST = DEVICE_TYPES.map(d => d.id).join(', ');

/* ─────────────────── system prompts ─────────────────── */

const TUTOR_PROMPT = `You are the AI networking instructor inside the SelfStudy JO Network Simulator — a browser-based studio where students build and run real network topologies.

Your job is to make a student genuinely understand networking, not to sound impressive.

Rules:
• Be concrete. Use the student's actual topology (given below) by device name, interface and address whenever it is relevant.
• Explain the WHY, not just the command. "Type no shutdown" is useless; "router interfaces are administratively down by default, so the line protocol never comes up until you enable it" is teaching.
• Name the OSI layer when it clarifies something.
• Give real CLI syntax (Cisco IOS style) in fenced code blocks when configuration is involved.
• Keep answers tight: a short direct answer first, then the reasoning, then the commands. Use markdown with short paragraphs and bullets.
• When the student is wrong, say so plainly and show what to do instead.
• If something in their topology is broken and relevant to the question, point it out.
• Never invent device types or features that this simulator does not have.

The simulator supports: Ethernet framing and MAC learning, 802.1Q access/trunk/native VLANs, STP root election and port blocking, ARP, IPv4 addressing and subnetting, IPv6 addressing, static/default routes, RIP and OSPF, longest-prefix match and administrative distance, TTL and ICMP, NAT/PAT, standard and extended ACLs, DHCP (DORA and relays), DNS, TCP three-way handshake, TLS 1.3, HTTP/HTTPS, 802.11 association with WPA2/WPA3, SSID-to-VLAN mapping, and per-hop packet inspection at every layer.`;

const GENERATE_PROMPT = `You are a network design engine for the SelfStudy JO Network Simulator. You output ONLY a single JSON object — no prose, no markdown fences, no explanation outside the JSON.

Schema:
{
  "name": "short topology name",
  "description": "one or two sentences",
  "devices": [
    {
      "hostname": "R1",
      "type": "<one of the allowed type ids>",
      "x": 640, "y": 200,
      "notes": "what this device is for",
      "vlans": [{ "id": 10, "name": "STAFF" }],
      "interfaces": [
        {
          "name": "GigabitEthernet0/0/0",
          "ip": "10.0.1.1", "mask": "255.255.255.0",
          "mode": "routed" | "access" | "trunk",
          "vlan": 10,
          "trunkVlans": [10,20],
          "nativeVlan": 99,
          "sviVlan": 10,
          "enabled": true,
          "dhcp": false,
          "natRole": "inside" | "outside",
          "description": "to SW1",
          "ssid": "SelfStudy-WiFi",
          "passphrase": "SelfStudy2026"
        }
      ],
      "defaultGateway": "10.0.1.1",
      "dnsServer": "10.0.30.10",
      "staticRoutes": [{ "network": "10.0.2.0", "mask": "255.255.255.0", "nextHop": "172.16.1.2" }],
      "ospf": true,
      "rip": false,
      "nat": { "enabled": true, "mode": "pat", "insideInterfaces": ["GigabitEthernet0/0/1"], "outsideInterface": "GigabitEthernet0/0/0" },
      "wireless": { "ssid": "SelfStudy-WiFi", "security": "wpa3-personal", "passphrase": "SelfStudy2026", "band": "5GHz", "channel": 36, "vlanId": 10 },
      "dhcpPools": [{ "name": "STAFF", "network": "10.0.1.0", "mask": "255.255.255.0", "rangeStart": "10.0.1.100", "rangeEnd": "10.0.1.200", "gateway": "10.0.1.1", "dns": "10.0.30.10" }],
      "dnsRecords": [{ "name": "www.lab.local", "value": "10.0.30.20", "type": "A" }],
      "http": { "enabled": true, "title": "Lab site", "body": "<h1>Lab</h1>" }
    }
  ],
  "links": [
    { "from": "R1", "fromInterface": "GigabitEthernet0/0/0", "to": "SW1", "toInterface": "GigabitEthernet1/0/1", "label": "uplink" }
  ],
  "notes": ["design decisions worth explaining to the student"]
}

Allowed "type" values (use these exact ids): ${TYPE_LIST}

Hard requirements — a topology that violates any of these is wrong:
1. Every host that must reach another subnet needs a "defaultGateway" that is INSIDE its own subnet.
2. Router and firewall interfaces MUST have "enabled": true, otherwise they stay shut down.
3. Every subnet must be unique and non-overlapping. Use the mask consistently.
4. Never assign a network address or a broadcast address to an interface.
5. For inter-VLAN routing use "sviVlan" interfaces on a switch-l3, or "trunk" + sub-interface VLANs on a router.
6. Trunk links need "mode": "trunk" and a "trunkVlans" list on BOTH ends, with the same "nativeVlan".
7. Wireless clients need an "ssid" and "passphrase" on their wireless interface that EXACTLY match the access point's wireless block.
8. Interface names must be real names from the chosen device type. If unsure, omit "name" and the simulator will pick the next free port.
9. Lay devices out sensibly: clouds/WAN near y=100, routers/firewalls y≈250, distribution y≈350, access switches y≈450, hosts y≈600. Spread x between 150 and 1250.
10. Reference every device in "links" by its exact "hostname".

Prefer clarity over size. A correct 8-device network teaches far more than a broken 30-device one.`;

const REVIEW_PROMPT = `You are a senior network architect reviewing a student's design in the SelfStudy JO Network Simulator.

Produce a focused review in markdown with exactly these sections:

## Verdict
One or two sentences: is this design sound, and what is the single most important thing to change?

## What is right
Bullets. Be specific and name devices. Do not pad this section — if there is little to praise, say little.

## Problems
Numbered, most serious first. For each: what is wrong, what will actually break as a result, and the exact fix (with CLI where relevant).

## Design improvements
Things that work but should be done differently in production — redundancy, segmentation, addressing hygiene, naming, QoS, security posture.

## What to learn next
Two or three concrete topics, tied to what this design revealed.

Judge against real practice: correct addressing and masks, gateways in-subnet, no VLAN or native-VLAN mismatches, no single points of failure, segmentation for IoT/guest/OT, default-deny security, sensible summarisation, and interfaces actually enabled. Be direct. Do not be encouraging at the expense of being accurate.`;

const TROUBLESHOOT_PROMPT = `You are a network troubleshooting expert working inside the SelfStudy JO Network Simulator. You have the student's topology, the simulator's own validation issues, and the real event log from the last simulation run.

Answer in markdown with exactly these sections:

## Most likely cause
One sentence. Commit to an answer.

## Why
The evidence from the topology and event log that points there. Quote specific device names, addresses and event lines.

## Fix
Numbered steps with exact CLI or exact UI actions.

## How to confirm
The specific test that proves it is fixed, and what output to expect.

## Rule of thumb
The general lesson, so the student recognises this symptom next time.

Work the layers in order and say which layer the fault sits at. Consider, in this order: physical/link state, interface admin state, VLAN and trunk consistency, addressing and mask, default gateway in-subnet, ARP resolution, routing table and return path, ACL and NAT, then services (DHCP/DNS) and finally the application. Prefer the boring explanation — a shut interface, a wrong mask, a missing return route, or DNS — over an exotic one.`;

const PACKET_PROMPT = `You are explaining one hop of a captured packet to a student, inside the SelfStudy JO Network Simulator.

Given the device, the action it took, and the PDU headers as they left that device, explain in markdown:

1. **What this device did and why** — one short paragraph, naming the layer it made its decision at.
2. **Which header fields changed at this hop, and which did not** — a short bullet list. Be exact about MAC rewriting versus IP addresses staying constant, and about TTL and checksum.
3. **The one thing to remember** — a single sentence.

Keep the whole answer under 200 words. Be precise; this is the moment the concept clicks or does not.`;

/* ─────────────────── the service ─────────────────── */

class NetSimAiService {
    private replicas: string[] = [];
    private cursor = 0;
    private authToken = import.meta.env.VITE_AUTH_TOKEN;
    private model = import.meta.env.VITE_AI_MODEL || 'gemini-2.0-flash';
    private appId = Number(import.meta.env.VITE_NETSIM_AI_APP_ID || import.meta.env.VITE_AI_APP_ID || 27);

    async initialize(force = false): Promise<boolean> {
        if (this.replicas.length && !force) return true;
        const replicas = await serviceRegistry.getServiceReplicas(this.appId, 'ai');
        this.replicas = replicas;
        return this.replicas.length > 0;
    }

    isReady(): boolean {
        return this.replicas.length > 0;
    }

    /** Round-robin across replicas, falling through on failure. */
    private async complete(messages: AiMessage[], o: { temperature?: number; maxTokens?: number } = {}): Promise<AiResult<string>> {
        if (!this.authToken) {
            return { ok: false, error: 'VITE_AUTH_TOKEN is not set, so the AI backend cannot be called.' };
        }
        if (!(await this.initialize())) {
            return { ok: false, error: 'No Self Study AI replica is reachable right now. The registry returned an empty replica list.' };
        }

        let lastError = '';
        for (let i = 0; i < this.replicas.length; i++) {
            const idx = (this.cursor + i) % this.replicas.length;
            const base = this.replicas[idx];
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 90000);
                const res = await fetch(`${base}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Token ${this.authToken}`,
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages,
                        temperature: o.temperature ?? 0.5,
                        max_tokens: o.maxTokens ?? 4096,
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timeout);

                if (!res.ok) {
                    lastError = `HTTP ${res.status} from replica ${i + 1}`;
                    continue;
                }
                const body = await res.json();
                const content = body?.choices?.[0]?.message?.content;
                if (!content) {
                    lastError = 'The AI replica returned an empty response.';
                    continue;
                }
                this.cursor = (idx + 1) % this.replicas.length;
                return { ok: true, data: String(content) };
            } catch (err: any) {
                lastError = err?.name === 'AbortError' ? 'The AI request timed out.' : (err?.message || 'Request failed');
            }
        }
        // A stale replica list is a common cause — refresh once for next time.
        this.replicas = [];
        return { ok: false, error: lastError || 'Every AI replica failed.' };
    }

    /* ══════════════ context serialisation ══════════════ */

    /**
     * A compact, information-dense description of the topology. Deliberately
     * terse — the model needs facts, not JSON noise, and long prompts cost
     * accuracy as well as tokens.
     */
    describeTopology(topology: Topology | null): string {
        if (!topology || !topology.devices.length) return 'The canvas is currently empty — no devices have been placed.';

        const lines: string[] = [
            `Topology: "${topology.name}" — ${topology.devices.length} devices, ${topology.links.length} links.`,
            '',
            'DEVICES:',
        ];

        for (const d of topology.devices) {
            const type = DEVICE_TYPES.find(t => t.id === d.typeId);
            const bits: string[] = [`- ${d.hostname} (${type?.name || d.typeId}, role=${type?.role || '?'}${d.powered ? '' : ', POWERED OFF'})`];

            for (const i of d.interfaces) {
                const parts: string[] = [];
                if (i.ipv4) parts.push(`${i.ipv4}/${maskToPrefix(i.mask)}`);
                else if (i.dhcp) parts.push('dhcp, no lease');
                if (i.ipv6) parts.push(`${i.ipv6}/${i.prefix6}`);
                if (i.mode === 'access') parts.push(`access vlan ${i.accessVlan}`);
                if (i.mode === 'trunk') parts.push(`trunk native ${i.nativeVlan} allowed ${i.trunkVlans.length ? i.trunkVlans.join(',') : 'all'}`);
                if (i.sviVlan) parts.push(`SVI vlan ${i.sviVlan}`);
                if (i.encapsulationVlan) parts.push(`dot1q ${i.encapsulationVlan}`);
                if (i.natRole !== 'none') parts.push(`nat ${i.natRole}`);
                if (i.aclIn) parts.push(`acl ${i.aclIn} in`);
                if (i.aclOut) parts.push(`acl ${i.aclOut} out`);
                if (i.ssid) parts.push(`ssid "${i.ssid}"`);
                if (!i.enabled) parts.push('SHUTDOWN');
                const peer = topology.links.find(l => l.aInterfaceId === i.id || l.bInterfaceId === i.id);
                if (peer) {
                    const otherDevId = peer.aInterfaceId === i.id ? peer.bDeviceId : peer.aDeviceId;
                    const otherIfId = peer.aInterfaceId === i.id ? peer.bInterfaceId : peer.aInterfaceId;
                    const other = topology.devices.find(x => x.id === otherDevId);
                    const otherIf = other?.interfaces.find(x => x.id === otherIfId);
                    parts.push(`→ ${other?.hostname} ${otherIf?.short}`);
                } else if (i.medium !== 'wireless' && i.medium !== 'cellular' && i.medium !== 'console') {
                    parts.push('no cable');
                }
                if (parts.length) bits.push(`    ${i.short}: ${parts.join('; ')}`);
            }

            if (d.host?.defaultGateway) bits.push(`    default gateway: ${d.host.defaultGateway}`);
            if (d.host?.dnsServer) bits.push(`    dns server: ${d.host.dnsServer}`);
            if (d.vlans?.length > 1) bits.push(`    vlans: ${d.vlans.map(v => `${v.id}(${v.name})`).join(', ')}`);
            if (d.routing?.staticRoutes?.length) bits.push(`    static routes: ${d.routing.staticRoutes.map(r => `${r.network}/${maskToPrefix(r.mask)} via ${r.nextHop}`).join(', ')}`);
            if (d.routing?.ospf?.enabled) bits.push(`    ospf: process ${d.routing.ospf.processId}, router-id ${d.routing.ospf.routerId || 'auto'}`);
            if (d.routing?.rip?.enabled) bits.push(`    rip: version ${d.routing.rip.version}`);
            if (d.nat?.enabled) bits.push(`    nat: ${d.nat.mode}${d.nat.outsideAddress ? `, outside ${d.nat.outsideAddress}` : ''}`);
            if (d.stp && d.stp.enabled === false) bits.push('    spanning-tree: DISABLED');
            if (d.stp?.priority && d.stp.priority !== 32768) bits.push(`    stp priority: ${d.stp.priority}`);
            if (d.wireless) bits.push(`    wireless: ssid "${d.wireless.ssid}", ${d.wireless.security}, ${d.wireless.band} ch ${d.wireless.channel}${d.wireless.vlanId ? `, vlan ${d.wireless.vlanId}` : ''}`);
            for (const acl of d.acls || []) {
                bits.push(`    acl ${acl.name} (${acl.type}): ${acl.rules.map(r => `${r.seq} ${r.action} ${r.protocol} ${r.srcAny ? 'any' : r.src} → ${r.dstAny ? 'any' : r.dst}${r.dstPort ? `:${r.dstPort}` : ''}`).join(' | ') || '(empty)'}`);
            }
            for (const p of d.services?.dhcp?.pools || []) {
                bits.push(`    dhcp pool ${p.name}: ${p.rangeStart}-${p.rangeEnd} mask ${p.mask} gw ${p.gateway || 'NONE'} dns ${p.dnsServer || 'NONE'}`);
            }
            for (const r of d.services?.dns?.records || []) {
                bits.push(`    dns record: ${r.name} ${r.type} ${r.value}`);
            }
            if (d.services?.http?.enabled) bits.push(`    http: listening on ${d.services.http.port}${d.services.http.tls ? ' + 443' : ''}`);
            if (d.notes) bits.push(`    notes: ${d.notes}`);

            lines.push(...bits);
        }

        return lines.join('\n');
    }

    private describeIssues(issues: ValidationIssue[]): string {
        if (!issues.length) return 'The simulator reports no validation issues.';
        return ['SIMULATOR VALIDATION ISSUES:', ...issues.slice(0, 40).map(i =>
            `- [${i.severity}] ${i.title} — ${i.detail}${i.fix ? ` (suggested fix: ${i.fix})` : ''}`)].join('\n');
    }

    private describeEvents(events: SimEvent[]): string {
        if (!events.length) return 'No simulation has been run, so there is no event log.';
        const tail = events.slice(-60);
        return ['SIMULATION EVENT LOG (most recent last):', ...tail.map(e =>
            `[${e.timeMs}ms] ${e.kind.toUpperCase()}${e.layer ? ` L${e.layer}` : ''}${e.deviceName ? ` ${e.deviceName}` : ''}: ${e.message}${e.detail ? ` — ${e.detail.split('\n')[0]}` : ''}`)].join('\n');
    }

    /* ══════════════ public capabilities ══════════════ */

    async ask(question: string, o: {
        topology?: Topology | null;
        issues?: ValidationIssue[];
        history?: AiMessage[];
        selectedDevice?: Device | null;
    } = {}): Promise<AiResult<string>> {
        const context: string[] = [];
        if (o.topology) context.push(`CURRENT TOPOLOGY\n${this.describeTopology(o.topology)}`);
        if (o.selectedDevice) context.push(`The student currently has "${o.selectedDevice.hostname}" selected.`);
        if (o.issues?.length) context.push(this.describeIssues(o.issues));

        const messages: AiMessage[] = [
            { role: 'system', content: TUTOR_PROMPT },
            ...(context.length ? [{ role: 'system' as const, content: context.join('\n\n') }] : []),
            ...(o.history || []).slice(-10),
            { role: 'user', content: question },
        ];
        return this.complete(messages, { temperature: 0.45, maxTokens: 2600 });
    }

    async generate(request: string, o: { existing?: Topology | null } = {}): Promise<AiResult<AiTopologySpec>> {
        const messages: AiMessage[] = [
            { role: 'system', content: GENERATE_PROMPT },
            ...(o.existing && o.existing.devices.length
                ? [{ role: 'system' as const, content: `The student already has this on the canvas. If they ask you to extend or modify it, keep the existing hostnames and addressing where sensible:\n${this.describeTopology(o.existing)}` }]
                : []),
            { role: 'user', content: `Design this network and return only the JSON object:\n\n${request}` },
        ];

        const res = await this.complete(messages, { temperature: 0.25, maxTokens: 8000 });
        if (!res.ok || !res.data) return { ok: false, error: res.error };

        const spec = extractJson<AiTopologySpec>(res.data);
        if (!spec) {
            return { ok: false, error: 'The AI response was not valid JSON. Try rephrasing the request, or ask for a smaller network.', raw: res.data };
        }
        if (!Array.isArray(spec.devices) || !spec.devices.length) {
            return { ok: false, error: 'The AI returned JSON with no devices in it. Try being more specific about what you want built.', raw: res.data };
        }
        return { ok: true, data: spec, raw: res.data };
    }

    async review(topology: Topology, issues: ValidationIssue[]): Promise<AiResult<string>> {
        const messages: AiMessage[] = [
            { role: 'system', content: REVIEW_PROMPT },
            { role: 'user', content: `${this.describeTopology(topology)}\n\n${this.describeIssues(issues)}\n\nReview this design.` },
        ];
        return this.complete(messages, { temperature: 0.4, maxTokens: 3000 });
    }

    async troubleshoot(symptom: string, o: {
        topology: Topology;
        issues: ValidationIssue[];
        events: SimEvent[];
        lastTrace?: PacketTrace | null;
    }): Promise<AiResult<string>> {
        const traceText = o.lastTrace
            ? `LAST PACKET TRACE — ${o.lastTrace.label} (${o.lastTrace.status}${o.lastTrace.reason ? `: ${o.lastTrace.reason}` : ''}):\n` +
              o.lastTrace.hops.map(h =>
                  `  ${h.index}. ${h.deviceName} [${h.action}]${h.inInterfaceName ? ` in ${h.inInterfaceName}` : ''}${h.outInterfaceName ? ` out ${h.outInterfaceName}` : ''} — ${h.notes[0] || ''}`).join('\n')
            : 'No packet trace is available.';

        const messages: AiMessage[] = [
            { role: 'system', content: TROUBLESHOOT_PROMPT },
            {
                role: 'user',
                content: `SYMPTOM REPORTED BY THE STUDENT: ${symptom}\n\n${this.describeTopology(o.topology)}\n\n${this.describeIssues(o.issues)}\n\n${traceText}\n\n${this.describeEvents(o.events)}`,
            },
        ];
        return this.complete(messages, { temperature: 0.35, maxTokens: 3000 });
    }

    async explainPacket(hop: Hop, trace: PacketTrace): Promise<AiResult<string>> {
        const layerText = hop.pdu.layers
            .map(l => `L${l.layer} ${l.protocol} — ${l.summary}\n${l.fields.map(f => `    ${f.label}: ${f.value}`).join('\n')}`)
            .join('\n\n');

        const messages: AiMessage[] = [
            { role: 'system', content: PACKET_PROMPT },
            {
                role: 'user',
                content: `Trace: ${trace.label} (${trace.protocol}), overall status ${trace.status}.\n` +
                    `Hop ${hop.index + 1} of ${trace.hops.length}: device ${hop.deviceName} (role ${hop.deviceRole}), action "${hop.action}"` +
                    `${hop.inInterfaceName ? `, arrived on ${hop.inInterfaceName}` : ''}${hop.outInterfaceName ? `, leaving via ${hop.outInterfaceName}` : ''}.\n\n` +
                    `PDU as it left this device:\n${layerText}\n\n` +
                    `Simulator notes for this hop:\n${hop.notes.map(n => `- ${n}`).join('\n')}`,
            },
        ];
        return this.complete(messages, { temperature: 0.35, maxTokens: 1200 });
    }

    /** Short "what should I do next" nudge for the studio's empty state. */
    async suggestNextStep(topology: Topology | null, issues: ValidationIssue[]): Promise<AiResult<string>> {
        const messages: AiMessage[] = [
            { role: 'system', content: `${TUTOR_PROMPT}\n\nAnswer in at most 120 words. Give exactly one concrete next action and one sentence on why it matters. No headings.` },
            { role: 'user', content: `${this.describeTopology(topology)}\n\n${this.describeIssues(issues)}\n\nWhat is the single best next thing for me to do?` },
        ];
        return this.complete(messages, { temperature: 0.5, maxTokens: 400 });
    }

    /** Generate a short quiz on a topic, returned as JSON. */
    async quiz(topic: string, count = 5): Promise<AiResult<Array<{ q: string; options: string[]; answer: number; why: string }>>> {
        const messages: AiMessage[] = [
            {
                role: 'system',
                content: `You write networking exam questions. Output ONLY a JSON array of exactly ${count} objects:
[{ "q": "question text", "options": ["a","b","c","d"], "answer": 0, "why": "why that answer is right and the others are not" }]
"answer" is the zero-based index of the correct option. Questions must be practical and unambiguous — the kind that reveals whether someone actually understands, not whether they memorised a number. No markdown, no fences, no prose.`,
            },
            { role: 'user', content: `Topic: ${topic}` },
        ];
        const res = await this.complete(messages, { temperature: 0.6, maxTokens: 2500 });
        if (!res.ok || !res.data) return { ok: false, error: res.error };
        const parsed = extractJson<any>(res.data);
        const arr = Array.isArray(parsed) ? parsed : (parsed?.questions || null);
        if (!Array.isArray(arr) || !arr.length) {
            return { ok: false, error: 'The AI did not return a usable quiz.', raw: res.data };
        }
        return { ok: true, data: arr };
    }
}

/* ─────────────────── JSON extraction ─────────────────── */

/**
 * Models wrap JSON in prose or fences no matter how firmly you ask them not to.
 * Strip fences, then take the outermost balanced object or array.
 */
export function extractJson<T>(text: string): T | null {
    if (!text) return null;
    let s = text.trim();

    // Strip ```json ... ``` fences.
    const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();

    const direct = tryParse<T>(s);
    if (direct) return direct;

    // Find the outermost {...} or [...]
    for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
        const start = s.indexOf(open);
        if (start === -1) continue;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let i = start; i < s.length; i++) {
            const ch = s[i];
            if (inString) {
                if (escaped) escaped = false;
                else if (ch === '\\') escaped = true;
                else if (ch === '"') inString = false;
                continue;
            }
            if (ch === '"') { inString = true; continue; }
            if (ch === open) depth++;
            else if (ch === close) {
                depth--;
                if (depth === 0) {
                    const candidate = s.slice(start, i + 1);
                    const parsed = tryParse<T>(candidate);
                    if (parsed) return parsed;
                    break;
                }
            }
        }
    }
    return null;
}

function tryParse<T>(s: string): T | null {
    try {
        return JSON.parse(s) as T;
    } catch {
        // Tolerate trailing commas, which models produce constantly.
        try {
            return JSON.parse(s.replace(/,(\s*[}\]])/g, '$1')) as T;
        } catch {
            return null;
        }
    }
}

export const netsimAi = new NetSimAiService();

/* ─────────────────── canned prompts for the UI ─────────────────── */

export const AI_QUICK_PROMPTS: Array<{ label: string; prompt: string; icon: string; kind: 'ask' | 'generate' }> = [
    { label: 'Explain my topology', prompt: 'Walk me through what I have built, device by device, and tell me what traffic can and cannot flow.', icon: 'info', kind: 'ask' },
    { label: 'Why is my ping failing?', prompt: 'My ping is failing. Work through the layers and tell me exactly what is wrong and how to fix it.', icon: 'alert', kind: 'ask' },
    { label: 'Teach me VLANs here', prompt: 'Using my actual topology, teach me how VLANs and trunking work and show me the commands to configure them on my devices.', icon: 'book', kind: 'ask' },
    { label: 'Check my subnetting', prompt: 'Review every IP address and subnet mask in my topology. List anything wrong, and explain the correct plan.', icon: 'check', kind: 'ask' },
    { label: 'Small office network', prompt: 'Build a small office network: an Internet connection, a router doing NAT and DHCP, a switch with staff and guest VLANs, a Wi-Fi access point, four wired PCs, two wireless laptops, and a local DNS + web server.', icon: 'plus', kind: 'generate' },
    { label: 'Campus with redundancy', prompt: 'Build a campus network with two core Layer-3 switches, two distribution switches, four access switches with redundant uplinks, three VLANs with SVIs, and hosts in each VLAN. Make one core switch the spanning-tree root.', icon: 'plus', kind: 'generate' },
    { label: 'Three-site WAN', prompt: 'Build a head office and two branches connected by serial WAN links, running OSPF area 0, each site with its own LAN subnet, plus an Internet connection at head office with NAT.', icon: 'plus', kind: 'generate' },
    { label: 'DMZ and firewall', prompt: 'Build an Internet edge with a next-gen firewall, an inside network, a DMZ containing a web server and a DNS server, NAT for the inside hosts, and ACLs that publish only the web server.', icon: 'plus', kind: 'generate' },
    { label: 'Home network 2026', prompt: 'Build a modern home network: fibre ONT, a Wi-Fi 7 router with NAT and DHCP, a smart TV and desktop on cable, a phone, laptop and tablet on Wi-Fi, and an IoT VLAN with a thermostat and two cameras.', icon: 'plus', kind: 'generate' },
    { label: 'Data center fabric', prompt: 'Build a leaf-spine data center with two spines, four leaves, OSPF in the underlay, and a hypervisor plus a Kubernetes node attached to different leaves.', icon: 'plus', kind: 'generate' },
];
