/**
 * src/netsim/lessons.ts
 * The curriculum: learning tracks, lessons and machine-checkable tasks.
 *
 * Every lesson is "learn by doing" — the theory is short, the tasks are
 * verified against the *actual simulated network*, not against a quiz answer.
 * `LESSON_CHECKS` is the registry of validators; a task names one and passes
 * arguments to it.
 */

import type { Lesson, Track, LayerId } from './types';
import type { Simulator } from './engine';
import { roleOf } from './engine';
import { getDeviceType, isL2Forwarder, isL3Forwarder } from './devices';
import { isValidIPv4, maskToPrefix, sameSubnet } from './ip';

/* ══════════════════════════ tracks ══════════════════════════ */

export const TRACKS: Track[] = [
    {
        id: 'foundations', order: 1, title: 'Networking Foundations', icon: 'globe', accent: '#60a5fa',
        subtitle: 'What a network is, and the model everything else hangs off',
        description: 'Start here. Signals, media, the OSI and TCP/IP models, encapsulation, and the difference between an address at Layer 2 and an address at Layer 3.',
    },
    {
        id: 'ethernet', order: 2, title: 'Ethernet & Switching', icon: 'switch', accent: '#34d399',
        subtitle: 'How a frame gets from one port to another',
        description: 'MAC addresses, frames, the MAC address table, flooding, collision and broadcast domains, duplex, and spanning tree.',
    },
    {
        id: 'vlans', order: 3, title: 'VLANs & Trunking', icon: 'vlan', accent: '#fbbf24',
        subtitle: 'Splitting one switch into many logical switches',
        description: '802.1Q tagging, access and trunk ports, the native VLAN, voice VLANs, and inter-VLAN routing.',
    },
    {
        id: 'addressing', order: 4, title: 'IP Addressing & Subnetting', icon: 'ip', accent: '#a78bfa',
        subtitle: 'The maths that everything at Layer 3 depends on',
        description: 'IPv4 structure, masks, CIDR, subnetting, VLSM, private vs public, APIPA, and IPv6 addressing.',
    },
    {
        id: 'routing', order: 5, title: 'Routing', icon: 'router', accent: '#f59e0b',
        subtitle: 'Getting a packet between different networks',
        description: 'Default gateways, static and default routes, longest-prefix match, administrative distance, RIP, OSPF, and convergence.',
    },
    {
        id: 'services', order: 6, title: 'Core Network Services', icon: 'server', accent: '#22d3ee',
        subtitle: 'DHCP, DNS, HTTP and NAT — what actually breaks in real life',
        description: 'DORA, name resolution, TCP handshakes, TLS, and how one public address serves a whole household.',
    },
    {
        id: 'wireless', order: 7, title: 'Wireless Networking', icon: 'ap', accent: '#c084fc',
        subtitle: 'Wi-Fi 6/6E/7, 5G and everything that shares the air',
        description: 'Association, bands and channels, WPA2/WPA3, SSID-to-VLAN mapping, controllers, roaming and interference.',
    },
    {
        id: 'security', order: 8, title: 'Network Security', icon: 'firewall', accent: '#f87171',
        subtitle: 'Segmentation, ACLs, firewalls and access control',
        description: 'ACL logic, stateful firewalls and zones, DMZ design, 802.1X, VLAN hopping, and defence in depth.',
    },
    {
        id: 'wan', order: 9, title: 'WAN & Internet Access', icon: 'cloud', accent: '#fb923c',
        subtitle: 'How a site actually reaches the rest of the world',
        description: 'DSL, DOCSIS, GPON, 5G FWA, LEO satellite, serial leased lines, MPLS, SD-WAN and BGP concepts.',
    },
    {
        id: 'datacenter', order: 10, title: 'Data Center & Cloud', icon: 'vm', accent: '#e879f9',
        subtitle: 'Where the servers went, and how their network changed',
        description: 'Leaf-spine fabrics, ECMP, VXLAN, virtual switches, containers, Kubernetes networking and cloud VPCs.',
    },
    {
        id: 'troubleshooting', order: 11, title: 'Troubleshooting', icon: 'wrench', accent: '#94a3b8',
        subtitle: 'A method, not a guess',
        description: 'Bottom-up, top-down and divide-and-conquer; reading the symptom correctly; the eight faults that cause most outages.',
    },
];

/* ══════════════════════════ lessons ══════════════════════════ */

const L = (
    id: string, trackId: string, order: number, title: string, subtitle: string,
    minutes: number, difficulty: Lesson['difficulty'], layers: LayerId[],
    objectives: string[], theory: string,
    keyTerms: Array<[string, string]>,
    tasks: Lesson['tasks'],
    extra: Partial<Lesson> = {}
): Lesson => ({
    id, trackId, order, title, subtitle, minutes, difficulty, layers, objectives, theory,
    keyTerms: keyTerms.map(([term, meaning]) => ({ term, meaning })),
    tasks,
    ...extra,
});

export const LESSONS: Lesson[] = [
    /* ─────────── Foundations ─────────── */
    L('f1', 'foundations', 1, 'What a network actually is', 'Two devices, one medium, one agreement', 12, 'beginner', [1, 2],
        [
            'Explain what has to exist before two devices can exchange data',
            'Identify the physical medium, the addressing and the protocol in a link',
            'Build the smallest working network and prove it works',
        ],
        `A network is three things: a shared **medium** to carry the signal, an **address** so each side knows who it is talking to, and an agreed **protocol** so both sides interpret the signal the same way. Remove any one and there is no network.

Start with the smallest possible example. Two PCs, one switch, one subnet. The PCs have MAC addresses burned into their NICs (Layer 2) and IP addresses you configure (Layer 3). When PC-A pings PC-B, it first has to discover B's MAC address, because a frame cannot be put on the wire without a destination MAC. That discovery is ARP.

The important idea to carry into every later lesson: **the IP address says where the packet is ultimately going; the MAC address says where the frame is going next.** Those are two different questions, answered at two different layers, and confusing them is the single most common source of confusion in networking.`,
        [
            ['Medium', 'The physical thing carrying the signal — copper, fibre or radio.'],
            ['MAC address', '48-bit hardware address, unique per interface, only meaningful inside one broadcast domain.'],
            ['IP address', 'Logical address you assign; it identifies the host AND the network it lives on.'],
            ['Protocol', 'The agreed rules for format and behaviour. Ethernet, IP, TCP, HTTP are all protocols.'],
            ['ARP', 'Address Resolution Protocol — turns a known IP address into an unknown MAC address.'],
        ],
        [
            { id: 'f1t1', text: 'Place two PCs and one switch on the canvas', check: 'deviceCount', args: { role: 'host', min: 2 }, hint: 'Drag them from the End Devices section of the palette.' },
            { id: 'f1t2', text: 'Cable both PCs to the switch', check: 'linkCount', args: { min: 2 }, hint: 'Click a device, then click "Connect", then click the second device.' },
            { id: 'f1t3', text: 'Give both PCs an address in 192.168.10.0/24', check: 'allHostsInSubnet', args: { network: '192.168.10.0', prefix: 24, min: 2 }, hint: 'Select a PC → Interfaces tab → set IPv4 and mask 255.255.255.0.' },
            { id: 'f1t4', text: 'Ping from one PC to the other successfully', check: 'anyPingWorks', hint: 'Open a PC terminal and type: ping <other PC address>' },
        ],
        { starterTemplateId: 'two-pcs', quiz: [
            { q: 'A frame is about to leave a PC. Which address does the PC need to look up first?', options: ['The destination IP address', 'The destination MAC address', 'The default gateway hostname', 'The DNS server'], answer: 1, why: 'It already knows the destination IP — you typed it. It cannot build the frame without the destination MAC, so it ARPs for it.' },
            { q: 'Which of these is NOT required for two devices to communicate?', options: ['A shared medium', 'Addresses', 'A common protocol', 'A router'], answer: 3, why: 'A router is only needed to move between different networks. Two devices on the same network do not need one.' },
        ] }),

    L('f2', 'foundations', 2, 'The OSI model, used properly', 'Seven layers as a troubleshooting tool, not a memory test', 15, 'beginner', [1, 2, 3, 4, 5, 6, 7],
        [
            'Map a real packet onto the seven layers',
            'Describe encapsulation and de-encapsulation in your own words',
            'Use the model to localise a fault',
        ],
        `The OSI model is not trivia. It is the most useful troubleshooting tool in networking, because it tells you what to test next.

Data is produced at Layer 7 and each layer below **adds its own header** on the way down — that is encapsulation. At the receiver each layer **strips its own header** on the way up — de-encapsulation. Each layer only ever reads its own header and hands the rest onwards.

Concretely, one HTTP request looks like this on the wire:

    [ Ethernet | IPv4 | TCP | TLS | HTTP GET ]  →  bits

The practical value: symptoms map to layers.
- No link light → Layer 1. Nothing above matters.
- Link up but a duplicate MAC or the wrong VLAN → Layer 2.
- Ping by IP fails but the link is up → Layer 3 (mask, gateway, route).
- Ping works, the application does not → Layer 4 and above (port closed, firewall, service down).
- Works by IP but not by name → Layer 7 (DNS).

Work either **bottom-up** (start at Layer 1 — best when you know nothing) or **top-down** (start at the application — best when only one app is broken). Never jump randomly between layers.

The Packet Inspector in this studio shows you the real headers of the real simulated packet. Send a ping, click a hop, and watch which fields changed.`,
        [
            ['Encapsulation', 'Adding a header (and sometimes a trailer) as data moves down the stack.'],
            ['PDU', 'Protocol Data Unit — the name of the data at a layer: bits, frame, packet, segment.'],
            ['De-encapsulation', 'Stripping headers on the way back up at the receiver.'],
            ['Layer 4 port', 'The number that says which application the segment belongs to.'],
            ['TCP/IP model', 'The 4-layer practical model: Network Access, Internet, Transport, Application.'],
        ],
        [
            { id: 'f2t1', text: 'Build any network where a ping succeeds', check: 'anyPingWorks', hint: 'The template already does this — just run the ping.' },
            { id: 'f2t2', text: 'Run a simulation so at least one packet trace exists', check: 'traceExists', hint: 'Ping, then look at the Simulation panel.' },
            { id: 'f2t3', text: 'Add a server and fetch a page from it over HTTP', check: 'httpWorks', hint: 'Drop a Web Server, address it, enable HTTP, then "curl http://<ip>" from a PC.' },
        ],
        { starterTemplateId: 'two-subnets-router', quiz: [
            { q: 'Ping by IP works but nothing loads in the browser. Where do you look first?', options: ['Layer 1 — the cable', 'Layer 2 — the switch', 'Layer 3 — the routing table', 'Layer 7 — DNS'], answer: 3, why: 'Layer 3 is proven working by the successful ping. Name resolution is the classic next suspect.' },
            { q: 'Which layer adds the MAC addresses?', options: ['Physical', 'Data Link', 'Network', 'Transport'], answer: 1, why: 'MAC addressing is Layer 2, the Data Link layer.' },
        ] }),

    L('f3', 'foundations', 3, 'Cables, connectors and media', 'Copper, fibre and radio — and when each one fails', 12, 'beginner', [1],
        [
            'Choose the correct medium for a given distance and speed',
            'Explain why a duplex or speed mismatch is so hard to diagnose',
            'Recognise which faults are purely physical',
        ],
        `Layer 1 decides your distance limits, your speed ceiling and a surprising number of your outages.

**Copper (twisted pair).** 100 m maximum for 1000BASE-T. 10GBASE-T needs Cat6a for the full 100 m (Cat6 manages about 30–55 m). Cheap, supports PoE, and susceptible to electrical noise.

**Fibre.** Multi-mode (OM4) for in-building runs up to a few hundred metres; single-mode for kilometres. Immune to electrical interference, carries no power, and cannot be tapped without breaking the light path. Use it between buildings and between floors — always.

**Radio.** Half-duplex and shared. Every client on a radio contends for the same airtime, so 20 clients on one AP do not each get the headline rate. Walls, distance and other networks all reduce it further.

**Serial.** Still worth learning because it teaches DCE/DTE and clocking: one end supplies the clock (\`clock rate 64000\`), the other follows. Forget it and the line stays down with no useful error.

**The classic silent killer** is a duplex mismatch: one side hard-coded full, the other auto-negotiating to half. Small pings succeed, so it "looks fine", and then the link collapses under real load with late collisions. Set both ends to auto, or hard-code both.

Straight-through versus crossover used to matter (host-to-switch straight, switch-to-switch crossover). Auto-MDIX makes it irrelevant on modern gear — but know the rule, because exams still ask and old kit still exists.`,
        [
            ['Attenuation', 'Signal loss over distance — the reason cables have length limits.'],
            ['Auto-MDIX', 'Automatic detection and swap of transmit/receive pairs, which retires the crossover cable.'],
            ['Duplex mismatch', 'One end full, the other half. Passes small tests, fails under load.'],
            ['PoE', 'Power over Ethernet: 802.3af 15.4 W, at 30 W, bt up to 90 W per port.'],
            ['DCE/DTE', 'On a serial link, the DCE provides the clock and the DTE follows it.'],
        ],
        [
            { id: 'f3t1', text: 'Connect two switches with a 10G uplink port', check: 'linkBetweenRoles', args: { roleA: 'switch', roleB: 'switch' }, hint: 'Use the TenGigabitEthernet ports on both.' },
            { id: 'f3t2', text: 'Create a topology with no validation errors', check: 'noErrors', hint: 'Open the Issues panel and clear everything marked "error".' },
        ],
        { quiz: [
            { q: 'You need 10 Gbps over 90 m of copper. Which cable?', options: ['Cat5e', 'Cat6', 'Cat6a', 'OM4 fibre'], answer: 2, why: 'Cat6a supports 10GBASE-T over the full 100 m. Cat6 is limited to roughly 30–55 m at 10 G.' },
            { q: 'Small pings work, large transfers fail with late collisions. Most likely cause?', options: ['Wrong VLAN', 'Duplex mismatch', 'Missing default gateway', 'DNS failure'], answer: 1, why: 'Late collisions are the signature of a duplex mismatch.' },
        ] }),

    /* ─────────── Ethernet & switching ─────────── */
    L('e1', 'ethernet', 1, 'How a switch learns', 'The MAC address table, built one frame at a time', 15, 'beginner', [2],
        [
            'Describe exactly how a MAC address table is populated',
            'Predict when a switch floods and when it forwards',
            'Read a MAC address table and explain every entry',
        ],
        `A switch does one clever thing extremely fast: it maps MAC addresses to ports.

The rule is simple and worth memorising precisely: **a switch learns from the SOURCE address of every frame it receives, and forwards based on the DESTINATION address.** Nothing else populates the table.

So the first frame between two unknown hosts always gets flooded:
1. PC-A sends a frame to PC-B. The switch reads A's source MAC and records "A is on port 1".
2. It looks up B's destination MAC. Not in the table. So it **floods** — sends the frame out every port in the VLAN except port 1.
3. B replies. The switch reads B's source MAC and records "B is on port 4".
4. Every frame after that is **forwarded** out one port only.

That is why a fresh switch appears to behave like a hub for exactly one frame in each direction, and then stops.

Three more behaviours to know:
- **Broadcast** frames (destination FF:FF:FF:FF:FF:FF) are always flooded within the VLAN. Never forwarded by a router.
- **Unknown unicast** is flooded — which is why a MAC table overflow attack works: fill the table and the switch floods everything.
- Entries **age out** after 300 seconds by default. If a device is quiet and then moves ports, the table catches up within one frame.

Use \`show mac address-table\` on the switch after a ping and account for every single line.`,
        [
            ['MAC address table', 'Also called CAM table: MAC → port → VLAN mapping.'],
            ['Flooding', 'Sending a frame out every port in the VLAN except the ingress port.'],
            ['Unknown unicast', 'A unicast frame whose destination is not in the MAC table.'],
            ['Aging', 'Entries expire (300 s default) so the table follows devices that move.'],
            ['Store-and-forward', 'The switch receives the whole frame, checks the FCS, then forwards it.'],
        ],
        [
            { id: 'e1t1', text: 'Build a switch with at least three hosts attached', check: 'hostsOnSwitch', args: { min: 3 }, hint: 'One switch, three PCs, three cables.' },
            { id: 'e1t2', text: 'Ping between two hosts so the switch learns their MACs', check: 'anyPingWorks' },
            { id: 'e1t3', text: 'The switch MAC table has at least two entries', check: 'macTableEntries', args: { min: 2 }, hint: 'Run "show mac address-table" in the switch CLI, or open its MAC Table tab.' },
        ],
        { starterTemplateId: 'two-pcs', quiz: [
            { q: 'A switch receives a frame for a MAC it has never seen. What does it do?', options: ['Drops it', 'Sends it to the default gateway', 'Floods it out all other ports in the VLAN', 'Sends an ARP request'], answer: 2, why: 'Unknown unicast is flooded within the VLAN. The reply then teaches the switch the correct port.' },
            { q: 'Which field populates the MAC address table?', options: ['Destination MAC', 'Source MAC', 'Source IP', 'EtherType'], answer: 1, why: 'Learning is always from the source address of a received frame.' },
        ] }),

    L('e2', 'ethernet', 2, 'Hubs, collision domains and why switches won', 'CSMA/CD, half duplex, and a fair comparison', 12, 'beginner', [1, 2],
        [
            'Explain the difference between a collision domain and a broadcast domain',
            'Describe CSMA/CD and why full duplex removes the need for it',
            'Count the collision and broadcast domains in a diagram',
        ],
        `A **hub** is a Layer-1 repeater: every bit in on one port goes out of every other port. All attached devices share one **collision domain**, so only one can transmit at a time. They run CSMA/CD — listen, transmit, detect a collision, back off a random interval, retry. As you add devices, useful throughput collapses.

A **switch** gives every port its own collision domain. With full duplex there can be no collision at all, so CSMA/CD is simply switched off. A 24-port switch is 24 collision domains.

But a switch does **not** break up broadcast domains. Every port in the same VLAN is one broadcast domain. Only a **router** (or a separate VLAN) does that.

Two rules that show up in every exam and every real design:
- Collision domains = number of switch ports (plus one per hub, however many devices are on it).
- Broadcast domains = number of VLANs, and separately, one per router interface.

Build the "Hub vs switch" template and watch the difference in the event log: the hub floods to every host on every frame, the switch stops after it has learned.`,
        [
            ['Collision domain', 'A set of devices that can interfere with each other\'s transmissions.'],
            ['Broadcast domain', 'The set of devices that receive each other\'s broadcast frames.'],
            ['CSMA/CD', 'Carrier Sense Multiple Access with Collision Detection — the half-duplex arbitration scheme.'],
            ['Full duplex', 'Simultaneous send and receive; makes collisions impossible.'],
            ['Microsegmentation', 'One device per collision domain — what switching gives you.'],
        ],
        [
            { id: 'e2t1', text: 'Place a hub with at least three hosts on it', check: 'hostsOnRole', args: { role: 'hub', min: 3 }, hint: 'The Legacy section of the palette has the hub.' },
            { id: 'e2t2', text: 'Also place a switch with at least three hosts on it', check: 'hostsOnSwitch', args: { min: 3 } },
            { id: 'e2t3', text: 'Ping across the hub, then across the switch, and compare the event log', check: 'traceCount', args: { min: 2 } },
        ],
        { starterTemplateId: 'hub-vs-switch', quiz: [
            { q: 'How many collision domains does an 8-port switch create?', options: ['1', '2', '8', 'None'], answer: 2, why: 'Every switch port is its own collision domain.' },
            { q: 'How many broadcast domains does an 8-port switch with one VLAN create?', options: ['1', '2', '8', '0'], answer: 0, why: 'A switch does not break up broadcast domains. One VLAN = one broadcast domain.' },
        ] }),

    L('e3', 'ethernet', 3, 'Spanning Tree Protocol', 'Redundancy without a meltdown', 20, 'intermediate', [2],
        [
            'Explain what a Layer-2 loop does to a network and why it is catastrophic',
            'Walk through root bridge election',
            'Predict which port will block, and influence it deliberately',
        ],
        `Redundant Layer-2 links are essential and also lethal. A frame at Layer 2 has **no TTL**, so a broadcast in a loop circles forever, gets duplicated at every switch, and saturates every link within seconds. The MAC tables thrash because the same source MAC keeps arriving on different ports. The whole segment stops working — a **broadcast storm**.

STP prevents this by building a loop-free tree and **blocking** the redundant ports until they are needed.

**Root bridge election.** Every switch has a Bridge ID = priority (default 32768) + MAC address. Lowest wins: priority first, MAC as the tiebreaker. Because the default priority is identical everywhere, the oldest switch with the lowest MAC becomes root by accident — which is almost never the switch you want. **Set the priority on your core switches deliberately** (\`spanning-tree vlan 1 priority 4096\`).

**Path cost.** 10 Gbps = 2, 1 Gbps = 4, 100 Mbps = 19, 10 Mbps = 100. Each switch picks the port with the lowest total cost to the root as its **root port**. On every segment, the switch closer to the root owns the **designated port**. Everything left over is **blocking**.

**Convergence.** Classic STP takes about 50 seconds (20 s max age + 2 × 15 s forward delay). RSTP does it in under a second. Use rapid-PVST or RSTP — there is no reason to run classic STP in 2026.

Build the campus template, run the simulation, and read \`show spanning-tree\` on each switch. Then change a priority and watch the tree re-form.`,
        [
            ['Bridge ID', 'Priority + MAC address. Lowest value wins the root election.'],
            ['Root port', 'The one port on a non-root switch with the lowest cost to the root.'],
            ['Designated port', 'The forwarding port on each segment, owned by the switch closer to the root.'],
            ['Blocking port', 'A redundant port that receives BPDUs but forwards no data.'],
            ['Broadcast storm', 'What happens in a Layer-2 loop without STP. Seconds to total failure.'],
            ['PortFast', 'Skips listening/learning on an edge port. Never point it at another switch.'],
        ],
        [
            { id: 'e3t1', text: 'Build a topology with at least three switches and a redundant path', check: 'switchLoopExists', hint: 'Cable SW1–SW2, SW2–SW3 and SW3–SW1.' },
            { id: 'e3t2', text: 'Confirm spanning tree has blocked at least one port', check: 'stpBlocking', args: { min: 1 }, hint: 'Run the simulation, then check "show spanning-tree" or the STP badges on the canvas.' },
            { id: 'e3t3', text: 'Make a switch of your choice the root bridge by lowering its priority', check: 'rootBridgePriorityLowered', hint: 'In config mode: spanning-tree vlan 1 priority 4096' },
        ],
        { starterTemplateId: 'campus-three-tier', quiz: [
            { q: 'Two switches both have the default priority 32768. Which becomes root?', options: ['The one with the highest MAC', 'The one with the lowest MAC', 'The one with more ports', 'Neither — the election fails'], answer: 1, why: 'The MAC address is the tiebreaker and lowest wins.' },
            { q: 'Why is a Layer-2 loop worse than a Layer-3 loop?', options: ['Layer 2 is slower', 'Frames have no TTL, so they never expire', 'Switches have less memory', 'It is not worse'], answer: 1, why: 'IP packets die when the TTL reaches zero. Ethernet frames have no such field, so they circulate forever.' },
        ] }),

    /* ─────────── VLANs ─────────── */
    L('v1', 'vlans', 1, 'VLANs: one switch, many networks', 'Separating traffic without separating hardware', 18, 'beginner', [2],
        [
            'Create VLANs and assign access ports',
            'Explain why each VLAN needs its own IP subnet',
            'Prove that two VLANs cannot talk without a router',
        ],
        `A VLAN turns one physical switch into several logical switches. Ports in VLAN 10 cannot reach ports in VLAN 20, even though they are on the same box, because **each VLAN is a separate broadcast domain**.

That is the whole point: segmentation for security (cameras cannot reach finance), for broadcast control (smaller domains, less noise) and for policy (guest traffic can be rate-limited and filtered independently).

Two rules that follow directly:
1. **Each VLAN needs its own IP subnet.** VLAN 10 might be 10.1.10.0/24, VLAN 20 might be 10.1.20.0/24. Putting two VLANs in one subnet works only by accident and breaks the moment anything has to route.
2. **Traffic between VLANs must pass through a Layer-3 device** — a router, or an SVI on a multilayer switch. A plain switch will never do it, no matter how it is cabled.

An **access port** belongs to exactly one VLAN and sends frames untagged, because the host must never see an 802.1Q tag. Configure it with:

    interface gi1/0/5
     switchport mode access
     switchport access vlan 10

Common mistake: creating the VLAN but forgetting to put the port in it, or putting the port in a VLAN that does not exist on that switch. Both leave the host silently isolated. \`show vlan brief\` shows both problems at a glance.`,
        [
            ['VLAN', 'Virtual LAN — a logically separate broadcast domain on shared switch hardware.'],
            ['Access port', 'Carries exactly one VLAN, untagged, toward a host.'],
            ['VLAN 1', 'The default VLAN. Best practice is to move user traffic off it entirely.'],
            ['Broadcast domain', 'One per VLAN. This is the unit of Layer-2 isolation.'],
            ['SVI', 'Switch Virtual Interface — a virtual L3 interface for a VLAN, used to route between VLANs.'],
        ],
        [
            { id: 'v1t1', text: 'Create VLAN 10 and VLAN 20 on a switch', check: 'hasVlans', args: { vlans: [10, 20] }, hint: 'Switch → VLANs tab → Add VLAN. Or CLI: vlan 10 → name STAFF.' },
            { id: 'v1t2', text: 'Put at least one access port in each VLAN', check: 'accessPortsInVlans', args: { vlans: [10, 20] }, hint: 'switchport mode access + switchport access vlan 10' },
            { id: 'v1t3', text: 'Give the hosts addresses in different subnets per VLAN', check: 'vlanSubnetsDistinct', hint: 'VLAN 10 → 10.1.10.x/24, VLAN 20 → 10.1.20.x/24' },
            { id: 'v1t4', text: 'Confirm hosts in different VLANs cannot ping each other yet', check: 'crossVlanPingFails', hint: 'That failure is the correct answer at this stage. The next lesson fixes it.' },
        ],
        { starterTemplateId: 'vlans-trunk' }),

    L('v2', 'vlans', 2, 'Trunking with 802.1Q', 'Carrying many VLANs down one cable', 18, 'intermediate', [2],
        [
            'Configure a trunk and control the allowed VLAN list',
            'Explain the 802.1Q tag and the native VLAN',
            'Diagnose a native VLAN mismatch',
        ],
        `Two switches, three VLANs. You could run three cables — or one **trunk**.

A trunk inserts a 4-byte **802.1Q tag** into the Ethernet header carrying the VLAN ID (12 bits, so 1–4094) and a 3-bit priority (CoS) field. The receiving switch reads the tag and puts the frame into the right VLAN. When the frame finally leaves on an access port, the tag is **removed**, because the host would not understand it.

    interface Te1/1/0
     switchport mode trunk
     switchport trunk allowed vlan 10,20,30
     switchport trunk native vlan 99

The **native VLAN** is the one VLAN sent untagged on the trunk (VLAN 1 by default). Both ends must agree. If SW1 says native 1 and SW2 says native 99, untagged frames silently cross between VLANs — a correctness bug *and* a VLAN-hopping attack vector. Set the native VLAN explicitly to an unused VLAN on both ends.

The **allowed VLAN list** is your pruning tool. If a trunk only needs 10, 20 and 30, say so. It reduces unnecessary flooding and limits the damage of a misconfiguration.

Watch the tag in the Packet Inspector: send a ping between hosts in VLAN 10 on different switches, click the trunk hop, and you will see the 802.1Q fields appear — then disappear again on the far access port.`,
        [
            ['802.1Q', 'The VLAN tagging standard. 4 bytes: TPID, priority, DEI, VLAN ID.'],
            ['Trunk', 'A port that carries several VLANs, tagging all but the native one.'],
            ['Native VLAN', 'The single VLAN sent untagged over a trunk. Must match on both ends.'],
            ['Allowed VLAN list', 'The pruning list — which VLANs this trunk may carry.'],
            ['VLAN hopping', 'An attack abusing native VLAN mismatches or dynamic trunk negotiation.'],
        ],
        [
            { id: 'v2t1', text: 'Configure a trunk between two switches', check: 'trunkExists', hint: 'switchport mode trunk on both ends of the inter-switch link.' },
            { id: 'v2t2', text: 'Allow VLANs 10 and 20 explicitly on the trunk', check: 'trunkAllows', args: { vlans: [10, 20] } },
            { id: 'v2t3', text: 'Ping between two hosts in VLAN 10 that sit on different switches', check: 'anyPingWorks' },
            { id: 'v2t4', text: 'Fix every VLAN or native-VLAN mismatch reported in the Issues panel', check: 'noErrors' },
        ],
        { starterTemplateId: 'vlans-trunk', quiz: [
            { q: 'How many bytes does an 802.1Q tag add to a frame?', options: ['2', '4', '8', '12'], answer: 1, why: 'The tag is 4 bytes, which is why the maximum frame size grows from 1518 to 1522.' },
            { q: 'What happens when the native VLAN differs on the two ends of a trunk?', options: ['The trunk will not come up', 'Untagged frames leak between VLANs', 'All VLANs stop working', 'Nothing at all'], answer: 1, why: 'Untagged traffic is placed into a different VLAN on each side. It is both a bug and a security hole.' },
        ] }),

    L('v3', 'vlans', 3, 'Inter-VLAN routing', 'Router-on-a-stick versus SVIs on a Layer-3 switch', 20, 'intermediate', [2, 3],
        [
            'Route between VLANs using SVIs',
            'Compare router-on-a-stick with a multilayer switch',
            'Set the right default gateway on hosts in each VLAN',
        ],
        `VLANs are isolated by design. To let them talk you need Layer 3, and there are two ways.

**Router-on-a-stick.** One physical router link, configured as a trunk, with a sub-interface per VLAN:

    interface gi0/0/0.10
     encapsulation dot1Q 10
     ip address 10.1.10.1 255.255.255.0

Cheap in hardware, but every packet between two VLANs goes up the trunk and back down it. That "hairpin" doubles the traffic on that one link, which becomes the bottleneck.

**SVIs on a multilayer switch.** Better in every way when you have the hardware:

    ip routing
    interface vlan 10
     ip address 10.1.10.1 255.255.255.0
    interface vlan 20
     ip address 10.1.20.1 255.255.255.0

Now routing happens in switching silicon at wire speed, with no trunk hairpin. Note \`ip routing\` — without it the SVIs exist and answer pings but forward nothing between VLANs. That single missing line is one of the most common lab failures there is.

Whichever you choose, **each host's default gateway must be the L3 interface in its own VLAN**. A host in VLAN 20 pointing at 10.1.10.1 will fail, because that address is not in its subnet — the host cannot even ARP for it.`,
        [
            ['SVI', 'Switch Virtual Interface — `interface vlan 10`, the gateway for that VLAN.'],
            ['ip routing', 'The global command that turns a multilayer switch into a router. Easy to forget.'],
            ['Sub-interface', 'A logical division of one physical interface, each with its own VLAN tag and IP.'],
            ['Hairpinning', 'Traffic leaving and re-entering the same interface — the router-on-a-stick penalty.'],
            ['Default gateway', 'Must be an address inside the host\'s own subnet, always.'],
        ],
        [
            { id: 'v3t1', text: 'Create SVIs for at least two VLANs on a Layer-3 switch', check: 'sviCount', args: { min: 2 }, hint: 'interface vlan 10 → ip address 10.1.10.1 255.255.255.0' },
            { id: 'v3t2', text: 'Point each host at the SVI in its own VLAN as its default gateway', check: 'gatewaysCorrect' },
            { id: 'v3t3', text: 'Ping successfully between hosts in two different VLANs', check: 'crossVlanPingWorks' },
        ],
        { starterTemplateId: 'inter-vlan-l3' }),

    /* ─────────── Addressing ─────────── */
    L('a1', 'addressing', 1, 'IPv4 addresses and masks', 'Reading an address the way a router does', 18, 'beginner', [3],
        [
            'Split any address into network and host portions',
            'Calculate network, broadcast, first and last usable host',
            'Explain what the mask actually does',
        ],
        `An IPv4 address is 32 bits, written as four decimal octets. It is **not** one number — it is two: a network part and a host part. The **mask** is what tells you where the boundary is.

255.255.255.0 in binary is 24 ones then 8 zeros — hence /24. Ones mark the network bits, zeros mark the host bits.

For 192.168.10.37/24:
- **Network address**: host bits all zero → 192.168.10.0. Identifies the network; not assignable.
- **Broadcast address**: host bits all one → 192.168.10.255. Reaches every host in the subnet; not assignable.
- **Usable range**: 192.168.10.1 – 192.168.10.254, which is 2⁸ − 2 = 254 addresses.

The formula for usable hosts is **2^(32−prefix) − 2**. The −2 is the network and broadcast addresses. (Exceptions: a /31 gives 2 usable addresses for a point-to-point link, and a /32 is a single host route.)

Here is what a host actually does with the mask, every single time it sends a packet: it ANDs its own address with the mask, ANDs the destination with the same mask, and compares. Same result → the destination is local, so ARP for it directly. Different → send it to the default gateway.

That is why **a wrong mask is so destructive**. Give a host /16 instead of /24 and it will think remote networks are local, ARP for them, get no answer, and fail — while pinging its own subnet perfectly. Symptom: "some things work, some do not."

Ranges worth knowing: private (RFC 1918) 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16; loopback 127.0.0.0/8; APIPA/link-local 169.254.0.0/16 (means DHCP failed); CGNAT 100.64.0.0/10; multicast 224.0.0.0/4.`,
        [
            ['Prefix length', 'The /n notation. How many leading bits identify the network.'],
            ['Network address', 'All host bits zero. Names the subnet, cannot be assigned.'],
            ['Broadcast address', 'All host bits one. Reaches every host in the subnet.'],
            ['ANDing', 'The bitwise operation a host performs to decide local vs remote.'],
            ['APIPA', '169.254.0.0/16. A host self-assigned this because DHCP never answered.'],
            ['RFC 1918', 'The private address ranges that must be NATed to reach the Internet.'],
        ],
        [
            { id: 'a1t1', text: 'Address at least four hosts inside one /24', check: 'allHostsInSubnet', args: { prefix: 24, min: 4 } },
            { id: 'a1t2', text: 'Clear every "network address" or "broadcast address" error from the Issues panel', check: 'noErrors' },
            { id: 'a1t3', text: 'Ping successfully between two of them', check: 'anyPingWorks' },
        ],
        { quiz: [
            { q: 'How many usable hosts does a /26 provide?', options: ['30', '62', '64', '126'], answer: 1, why: '2^(32−26) − 2 = 64 − 2 = 62.' },
            { q: 'A host shows 169.254.14.9. What does that tell you?', options: ['It has a public address', 'DHCP did not answer', 'It is behind NAT', 'Its gateway is wrong'], answer: 1, why: 'APIPA is a self-assigned link-local address, used only when no DHCP offer arrived.' },
            { q: 'Why is a wrong subnet mask so hard to spot?', options: ['It breaks everything immediately', 'Local traffic still works, remote traffic fails', 'It only affects DNS', 'It has no effect'], answer: 1, why: 'The host still reaches its own subnet, so the link "looks fine" while anything remote fails.' },
        ] }),

    L('a2', 'addressing', 2, 'Subnetting and VLSM', 'Cutting a network to the size you actually need', 22, 'intermediate', [3],
        [
            'Subnet a network into equal blocks',
            'Apply VLSM to a set of differently-sized requirements',
            'Avoid overlapping subnets',
        ],
        `Subnetting means **borrowing host bits to create more networks**. Take 192.168.1.0/24 and borrow 2 bits → /26 → four subnets of 62 hosts each: .0, .64, .128, .192.

Each borrowed bit doubles the subnet count and halves the size. The block size is 2^(32−prefix), and subnets always start on a multiple of the block size. /26 → blocks of 64. /28 → blocks of 16. /30 → blocks of 4 (2 usable — the classic point-to-point link).

**VLSM** (Variable Length Subnet Masking) means using different prefix lengths in the same address space so each subnet is right-sized. The method is always the same:

1. List every requirement with its host count.
2. Sort **largest first**. This matters — allocate small blocks first and you fragment the space.
3. For each, pick the smallest prefix that fits (remember the −2).
4. Allocate sequentially, always aligned to the block boundary.

Example on 10.0.0.0/24 for 100 / 50 / 25 / 2 hosts:
- 100 hosts → /25 (126 usable) → 10.0.0.0/25
- 50 hosts → /26 (62 usable) → 10.0.0.128/26
- 25 hosts → /27 (30 usable) → 10.0.0.192/27
- 2 hosts (a WAN link) → /30 → 10.0.0.224/30

**Overlapping subnets** are the failure mode to avoid. 10.0.0.0/24 and 10.0.0.128/25 overlap; routing becomes ambiguous and things break in ways that look random. The Subnet Calculator in the studio will show you the exact boundaries — use it while you plan, not after.`,
        [
            ['VLSM', 'Using different mask lengths within one address space so subnets fit their purpose.'],
            ['Block size', '2^(32−prefix). Subnets always start on a multiple of it.'],
            ['/30', 'Four addresses, two usable — the traditional point-to-point WAN link.'],
            ['/31', 'Two addresses, both usable. The modern point-to-point choice (RFC 3021).'],
            ['Supernetting', 'Aggregating adjacent subnets into one shorter prefix to shrink routing tables.'],
        ],
        [
            { id: 'a2t1', text: 'Build a network with at least three different subnets', check: 'subnetCount', args: { min: 3 } },
            { id: 'a2t2', text: 'Use a /30 (or /31) on a point-to-point router link', check: 'hasPointToPointLink' },
            { id: 'a2t3', text: 'Make sure the Issues panel reports no addressing errors', check: 'noErrors' },
        ],
        { quiz: [
            { q: 'You need 4 subnets from 192.168.1.0/24. Which prefix?', options: ['/25', '/26', '/27', '/28'], answer: 1, why: 'Borrowing 2 bits gives 4 subnets: /26, blocks of 64.' },
            { q: 'Why sort requirements largest first in VLSM?', options: ['It is faster to calculate', 'Small blocks first fragment the space and the big subnet no longer fits', 'It is only a convention', 'Routers require it'], answer: 1, why: 'Allocating small blocks first leaves gaps too small for the large subnet.' },
        ] }),

    L('a3', 'addressing', 3, 'IPv6 in practice', 'Why it exists and what actually changes', 18, 'intermediate', [3],
        [
            'Read and compress an IPv6 address correctly',
            'Distinguish link-local, unique-local and global unicast',
            'Explain SLAAC and how it differs from DHCP',
        ],
        `IPv6 is 128 bits, written as eight groups of four hex digits. Two compression rules, and only two:
1. Drop leading zeros in a group: \`0db8\` → \`db8\`.
2. Replace **one** run of all-zero groups with \`::\`. Only once — otherwise the address is ambiguous.

    2001:0db8:0000:0000:0000:0000:0000:0001
    → 2001:db8::1

Address types you must recognise:
- **Global unicast** \`2000::/3\` — routable on the Internet, the equivalent of a public IPv4 address.
- **Link-local** \`fe80::/10\` — every interface has one, automatically, always. It is never routed. IPv6 routing protocols and neighbour discovery run over it.
- **Unique local** \`fc00::/7\` — the rough equivalent of RFC 1918, for internal use.
- **Multicast** \`ff00::/8\`. There is **no broadcast** in IPv6 at all; its jobs are done by well-chosen multicast groups.

What genuinely changes in practice:
- **ARP is gone.** NDP (Neighbour Discovery Protocol) over ICMPv6 does the same job with multicast instead of broadcast. Consequence: blocking all ICMPv6 breaks IPv6 entirely. Do not do it.
- **SLAAC**: the router advertises a /64 prefix, and the host builds its own address from that prefix plus an interface identifier (historically EUI-64 from the MAC, now usually randomised for privacy). No server involved.
- **No NAT needed.** Every device can have a global address. That is a feature, and it means your firewall policy — not address scarcity — is now the only thing protecting inside hosts.
- **Prefixes are /64 for LANs**, effectively always. Subnetting IPv6 is about organising, not about conserving.`,
        [
            ['Global unicast', '2000::/3 — publicly routable.'],
            ['Link-local', 'fe80::/10 — automatic, per-interface, never routed.'],
            ['NDP', 'Neighbour Discovery Protocol. Replaces ARP, runs over ICMPv6.'],
            ['SLAAC', 'Stateless Address Autoconfiguration — the host builds its own address from a router-advertised prefix.'],
            ['EUI-64', 'Deriving a 64-bit interface ID from a 48-bit MAC by inserting fffe and flipping a bit.'],
            ['Dual stack', 'Running IPv4 and IPv6 side by side — the normal migration approach.'],
        ],
        [
            { id: 'a3t1', text: 'Assign an IPv6 address to at least two interfaces', check: 'ipv6Configured', args: { min: 2 }, hint: 'Interfaces tab → IPv6 field, e.g. 2001:db8:10::1 with prefix 64.' },
            { id: 'a3t2', text: 'Keep the network working over IPv4 at the same time (dual stack)', check: 'anyPingWorks' },
        ],
        { quiz: [
            { q: 'Which is the correct compression of 2001:0db8:0000:0000:0001:0000:0000:0001?', options: ['2001:db8::1::1', '2001:db8:0:0:1::1', '2001:db8::1:0:0:1', 'Both B and C are valid'], answer: 3, why: '`::` may appear only once. Both B and C are legal renderings; the double `::` in A is not.' },
            { q: 'What replaced ARP in IPv6?', options: ['DHCPv6', 'NDP over ICMPv6', 'SLAAC', 'Nothing — ARP still runs'], answer: 1, why: 'Neighbour Discovery Protocol, carried in ICMPv6, does address resolution using multicast.' },
        ] }),

    /* ─────────── Routing ─────────── */
    L('r1', 'routing', 1, 'The default gateway and the first route', 'How a packet leaves its own network', 15, 'beginner', [3],
        [
            'Explain what a default gateway is and when it is used',
            'Configure router interfaces correctly, including "no shutdown"',
            'Route between two subnets',
        ],
        `A host can only speak directly to devices in its own subnet. For anything else it needs a **default gateway**: a router interface, inside its own subnet, that it hands the frame to.

The mechanics are worth spelling out precisely, because this is where the MAC/IP distinction finally pays off. PC-A (10.0.1.10/24) pings PC-C (10.0.2.10):
1. A ANDs both addresses with its mask. Different networks → not local.
2. A needs its gateway's MAC, so it ARPs for 10.0.1.1.
3. A builds a frame: **destination MAC = the router**, **destination IP = 10.0.2.10**. The IP header still points at the final target.
4. The router receives it, strips the Ethernet header, looks up 10.0.2.10, finds a connected route, decrements the TTL, builds a **brand-new** Ethernet header toward PC-C, and sends it.

The IP addresses never changed. The MAC addresses changed at every hop. Every router does exactly this.

Two things that catch everyone:
- **Router interfaces are shut down by default.** \`no shutdown\` is not optional. \`show ip interface brief\` will say "administratively down" until you do it.
- **The gateway must be in the host's own subnet.** A host on 10.0.1.10/24 cannot use 10.0.2.1 as a gateway; it cannot even ARP for it.

A router with correctly addressed, enabled interfaces already knows about its **connected** networks — no route configuration needed for those. Anything further away needs a static route or a routing protocol.`,
        [
            ['Default gateway', 'The router address a host sends non-local traffic to.'],
            ['Connected route', 'Automatically in the table for every up interface with an IP. Administrative distance 0.'],
            ['no shutdown', 'Brings a router interface administratively up. Required.'],
            ['TTL', 'Decremented by every router. At zero the packet is dropped and ICMP Time Exceeded returned.'],
            ['Frame rewrite', 'A router builds a new Layer-2 header at every hop; Layer 3 addresses stay put.'],
        ],
        [
            { id: 'r1t1', text: 'Place a router with two interfaces in two different subnets', check: 'routerWithTwoSubnets' },
            { id: 'r1t2', text: 'Bring both interfaces up (no shutdown)', check: 'routerInterfacesUp' },
            { id: 'r1t3', text: 'Set the correct default gateway on hosts in both subnets', check: 'gatewaysCorrect' },
            { id: 'r1t4', text: 'Ping across the router between the two subnets', check: 'crossSubnetPingWorks' },
        ],
        { starterTemplateId: 'two-subnets-router', quiz: [
            { q: 'When a host sends to a remote network, whose MAC goes in the destination field?', options: ['The remote host\'s MAC', 'The default gateway\'s MAC', 'The broadcast MAC', 'Its own MAC'], answer: 1, why: 'It cannot know the remote MAC and does not need to. The frame goes to the gateway; the IP header keeps the final destination.' },
            { q: 'show ip interface brief reports "administratively down". What is missing?', options: ['An IP address', 'A cable', 'no shutdown', 'A routing protocol'], answer: 2, why: '"Administratively down" always means the interface has not been enabled.' },
        ] }),

    L('r2', 'routing', 2, 'Static and default routes', 'Telling a router about networks it cannot see', 18, 'intermediate', [3],
        [
            'Configure static routes with the correct next hop',
            'Configure a default route toward the Internet',
            'Apply longest-prefix match and administrative distance',
        ],
        `A router only knows its **connected** networks. Everything else you either tell it, or a protocol tells it.

    ip route 10.2.0.0 255.255.255.0 172.16.1.2

Read that as: "to reach 10.2.0.0/24, hand the packet to 172.16.1.2". The next hop **must** be on a directly connected subnet — a router cannot send a packet to something it has no path to. If it is not, the recursive lookup fails and the route is useless.

A **default route** is a static route to everything:

    ip route 0.0.0.0 0.0.0.0 203.0.113.1

Prefix length zero, so it matches every destination — and therefore always loses to any more specific route. That is exactly what you want: use the specific route if you have one, otherwise send it upstream.

**Longest-prefix match** decides between routes. For 10.1.1.5:
- 10.1.1.0/24 (24 bits) — most specific, wins
- 10.1.0.0/16 (16 bits)
- 0.0.0.0/0 (0 bits) — last resort

**Administrative distance** breaks ties when two *protocols* offer the same prefix: connected 0, static 1, eBGP 20, OSPF 110, RIP 120. Lower is more trusted. A static route beats OSPF for the same prefix, which is how you deliberately override a protocol — and how you accidentally black-hole traffic.

The failure to watch for is **asymmetric routing**: you configure the route one way and forget the return path. Ping fails and it looks like the destination is down. Run the ping in this simulator and read the reason — it will tell you explicitly when the reply had nowhere to go.`,
        [
            ['Static route', 'A manually configured path. Administrative distance 1.'],
            ['Default route', '0.0.0.0/0 — the gateway of last resort.'],
            ['Next hop', 'The neighbouring router\'s address. Must be on a connected subnet.'],
            ['Longest-prefix match', 'The most specific matching route always wins.'],
            ['Administrative distance', 'Trust ranking between routing sources. Lower wins.'],
            ['Asymmetric routing', 'Traffic flows one way but the return path is missing. Looks like the target is down.'],
        ],
        [
            { id: 'r2t1', text: 'Build a topology with at least two routers', check: 'deviceCount', args: { role: 'router', min: 2 } },
            { id: 'r2t2', text: 'Add a static route on each router for the far-side network', check: 'staticRouteCount', args: { min: 2 }, hint: 'ip route <far-network> <mask> <neighbour-address>' },
            { id: 'r2t3', text: 'Ping end to end across both routers', check: 'multiHopPingWorks', args: { minRouterHops: 2 } },
            { id: 'r2t4', text: 'Add an Internet cloud and a default route toward it', check: 'defaultRouteExists' },
        ],
        { starterTemplateId: 'two-routers-static', quiz: [
            { q: 'A packet for 10.1.1.5 matches 10.1.1.0/24, 10.1.0.0/16 and 0.0.0.0/0. Which is used?', options: ['0.0.0.0/0', '10.1.0.0/16', '10.1.1.0/24', 'All three, load-balanced'], answer: 2, why: 'Longest prefix wins — /24 is the most specific.' },
            { q: 'Ping fails one way only. Most likely cause?', options: ['Bad cable', 'Missing return route', 'Wrong VLAN', 'Duplex mismatch'], answer: 1, why: 'ICMP needs both directions. A missing return route is the classic asymmetric-routing symptom.' },
        ] }),

    L('r3', 'routing', 3, 'Dynamic routing: RIP and OSPF', 'Letting the network figure itself out', 22, 'advanced', [3],
        [
            'Enable OSPF and confirm routes are learned',
            'Compare distance-vector and link-state behaviour',
            'Explain metrics, convergence and why OSPF beats RIP',
        ],
        `Static routes do not scale and do not react. Ten routers means ninety statements to maintain by hand, and none of them notice a failed link.

**RIP** is distance-vector: each router tells its neighbours "I can reach X in N hops". The metric is hop count, maximum 15 (16 = unreachable), which caps network size. It converges slowly and can loop while it does. Administrative distance 120. Learn it to understand the concept; do not deploy it.

**OSPF** is link-state: every router floods a description of its own links, every router builds the same complete map, and each runs Dijkstra on it independently. Metric is **cost**, derived from bandwidth (reference 100 Mbps ÷ interface Mbps, minimum 1) — so it prefers a fast path over a short one, which is what you actually want. Administrative distance 110. Converges in seconds, supports VLSM, scales with areas.

    router ospf 1
     router-id 1.1.1.1
     network 10.0.0.0 0.0.0.255 area 0

The **wildcard mask** is the inverse of the subnet mask: 0.0.0.255 matches a /24. Zero means "must match", 255 means "don't care".

Areas exist to limit flooding. Area 0 is the backbone; every other area must touch it. In a small lab, put everything in area 0.

Configure OSPF on the three-site WAN template, run the simulation, and read \`show ip route\` on a branch: you will see routes marked \`O\` with a cost derived from the serial link speed. Then shut down a link and re-run — the topology reconverges around it. That is the entire point.`,
        [
            ['Distance-vector', 'Routers exchange summarised reachability. RIP. Simple, slow, loop-prone.'],
            ['Link-state', 'Routers flood link descriptions and each builds the full map. OSPF. Fast, scalable.'],
            ['Cost', 'OSPF metric, derived from bandwidth. Lower is better.'],
            ['Wildcard mask', 'Inverse of the subnet mask. 0 = must match, 255 = ignore.'],
            ['Area 0', 'The OSPF backbone. Every other area must connect to it.'],
            ['Convergence', 'The time for every router to agree on the topology again after a change.'],
        ],
        [
            { id: 'r3t1', text: 'Enable OSPF on at least two routers', check: 'routingProtocolCount', args: { proto: 'ospf', min: 2 }, hint: 'router ospf 1 → network <net> <wildcard> area 0' },
            { id: 'r3t2', text: 'Confirm at least one router has learned a route dynamically', check: 'learnedRoutesExist' },
            { id: 'r3t3', text: 'Ping end to end across the WAN without configuring a single static route', check: 'multiHopPingWorks', args: { minRouterHops: 2 } },
        ],
        { starterTemplateId: 'wan-ospf', quiz: [
            { q: 'A network has a 2-hop 10 Mbps path and a 4-hop 1 Gbps path. Which does OSPF pick?', options: ['The 2-hop path', 'The 4-hop path', 'It load-balances', 'Neither'], answer: 1, why: 'OSPF costs by bandwidth, so the faster path wins despite more hops. RIP would pick the 2-hop path and be wrong.' },
            { q: 'What is RIP\'s maximum usable hop count?', options: ['10', '15', '16', '255'], answer: 1, why: '15 is the maximum usable; 16 means unreachable.' },
        ] }),

    /* ─────────── Services ─────────── */
    L('s1', 'services', 1, 'DHCP end to end', 'DORA, options, relays and APIPA', 18, 'beginner', [2, 3, 7],
        [
            'Walk through all four DORA messages and say which are broadcasts',
            'Configure a DHCP pool that hands out a working configuration',
            'Diagnose a 169.254.x.x address correctly',
        ],
        `DHCP hands a client four things at once: an address, a mask, a default gateway (option 3) and a DNS server (option 6). Miss any of them and the client half-works in a confusing way.

**DORA**:
1. **Discover** — the client broadcasts from 0.0.0.0 to 255.255.255.255. It has no address, so it cannot unicast, and it does not know who to ask.
2. **Offer** — a server proposes an address plus the options.
3. **Request** — the client broadcasts again, formally accepting. Broadcasting tells any *other* server that offered that its offer was declined.
4. **Acknowledge** — the server commits the lease and records it.

Because Discover and Request are **broadcasts**, DHCP is scoped to one VLAN. To serve a VLAN whose server lives elsewhere you configure a relay on the router interface facing the clients:

    interface vlan 20
     ip helper-address 10.1.30.10

The router converts the broadcast into a unicast to that server and adds the client's subnet so the server knows which pool to use.

**Reading the symptom.** A client showing **169.254.x.x** did not get an offer. That is APIPA, self-assigned. The question is always the same: is there a server in this VLAN, or is there a working relay? A client with an address but **no gateway** can reach its own subnet only. A client with an address but **no DNS** can ping by IP but resolves nothing.

Servers, printers and network gear should be static or reserved. Everything else should be DHCP — manual addressing at scale is how you get duplicate-IP outages.`,
        [
            ['DORA', 'Discover, Offer, Request, Acknowledge.'],
            ['Option 3', 'Router / default gateway.'],
            ['Option 6', 'DNS server.'],
            ['Option 51', 'Lease time.'],
            ['ip helper-address', 'DHCP relay — turns the client broadcast into a unicast to a remote server.'],
            ['APIPA', '169.254.0.0/16. Self-assigned because no offer arrived.'],
        ],
        [
            { id: 's1t1', text: 'Configure a DHCP pool with a network, range, gateway and DNS server', check: 'dhcpPoolComplete' },
            { id: 's1t2', text: 'Have a client obtain a lease successfully', check: 'dhcpLeaseObtained' },
            { id: 's1t3', text: 'Confirm the client can ping its gateway using the DHCP-supplied configuration', check: 'anyPingWorks' },
        ],
        { starterTemplateId: 'home-network', quiz: [
            { q: 'Which DORA messages are broadcasts?', options: ['Discover only', 'Discover and Request', 'Offer and Ack', 'All four'], answer: 1, why: 'Discover and Request are broadcast by the client. Request is broadcast so other servers learn their offer was declined.' },
            { q: 'A client has 169.254.9.14. What is the fault?', options: ['Wrong DNS', 'No DHCP offer was received', 'Duplicate IP', 'Wrong VLAN tag'], answer: 1, why: 'APIPA means the DHCP Discover went unanswered — no server in the VLAN, or no working relay.' },
        ] }),

    L('s2', 'services', 2, 'DNS: how names become addresses', 'The service that breaks first and gets blamed last', 16, 'beginner', [4, 7],
        [
            'Configure an authoritative record and resolve it from a client',
            'Explain recursion, caching and TTL',
            'Prove whether a fault is DNS or not, in one test',
        ],
        `Nothing on a modern network works without DNS, and about half of all "the Internet is down" reports are DNS.

**Resolution.** Your host asks its configured resolver. If the resolver has no cached answer it works down the hierarchy: root → TLD (\`.com\`) → the authoritative server for the zone. It caches the answer for the record's **TTL** and returns it. UDP 53 for normal queries; TCP 53 for large answers and zone transfers.

**Record types.** A (IPv4), AAAA (IPv6), CNAME (alias to another name), MX (mail exchanger), TXT (SPF/DKIM verification), PTR (reverse lookup).

**TTL is the operational lever.** A 24-hour TTL means a change takes up to a day to be seen everywhere. Lower the TTL *before* a planned migration, not after.

**The one-test diagnosis.** Ping an IP address. If that works and a name does not, it is DNS. Nothing else produces that exact pattern. It takes ten seconds and saves an hour.

Other symptoms worth recognising:
- Resolution works from one host but not another → the two have different resolvers configured.
- Everything resolves slowly, then works → the primary resolver is unreachable and the client is timing out before falling back to the secondary.
- An internal name resolves to a public address → split-horizon DNS is missing or misconfigured.`,
        [
            ['Resolver', 'The DNS server your host asks. Handed out by DHCP option 6.'],
            ['Authoritative', 'The server that holds the real zone data for a domain.'],
            ['Recursion', 'The resolver following the chain root → TLD → authoritative on your behalf.'],
            ['TTL', 'How long an answer may be cached. Controls how fast changes propagate.'],
            ['A / AAAA / CNAME / MX', 'IPv4, IPv6, alias, mail-exchanger records.'],
        ],
        [
            { id: 's2t1', text: 'Place a DNS server, address it, and add at least one A record', check: 'dnsRecordExists' },
            { id: 's2t2', text: 'Point a client at that DNS server', check: 'clientHasDns' },
            { id: 's2t3', text: 'Resolve the name from the client with nslookup', check: 'dnsResolves' },
            { id: 's2t4', text: 'Ping the host by name rather than by address', check: 'pingByNameWorks' },
        ],
        { starterTemplateId: 'inter-vlan-l3', quiz: [
            { q: 'Ping to 8.8.8.8 works; ping to google.com fails. What is broken?', options: ['Routing', 'DNS', 'The default gateway', 'The physical link'], answer: 1, why: 'Layer 3 is proven by the successful ping to an address. Only name resolution is failing.' },
            { q: 'Which transport does a normal DNS query use?', options: ['TCP 53', 'UDP 53', 'TCP 80', 'UDP 67'], answer: 1, why: 'UDP 53 for queries; TCP 53 for large responses and zone transfers.' },
        ] }),

    L('s3', 'services', 3, 'TCP, UDP and a full web request', 'Handshakes, ports, TLS and what "connection refused" means', 20, 'intermediate', [4, 5, 6, 7],
        [
            'Trace a complete HTTP fetch from DNS to FIN',
            'Explain the three-way handshake and the teardown',
            'Distinguish "refused" from "timed out" and act on the difference',
        ],
        `**TCP** is reliable and ordered, at the cost of a round trip before any data moves: SYN → SYN/ACK → ACK. Sequence numbers track every byte; ACKs confirm receipt; the window size does flow control. Closing is FIN → FIN/ACK → ACK, and each direction closes independently — which is why you see two FINs.

**UDP** has none of that. Eight bytes of header, no handshake, no retransmission. It is the right choice for DNS (one packet each way is cheaper than a handshake), for voice and video (a late packet is worse than a lost one), and for DHCP (you have no address yet).

**A full page load**, in order:
1. DNS query for the hostname → address
2. ARP for the gateway (or the server, if local) → MAC
3. TCP three-way handshake to port 443
4. TLS 1.3 handshake — Client Hello with SNI, Server Hello with the certificate. **SNI is sent in clear text**, which is exactly how filtering appliances see the hostname on an encrypted session.
5. HTTP GET with a Host header — this is what lets one IP serve hundreds of sites
6. 200 OK with the body
7. FIN to close

**The diagnostic that matters most:**
- **Connection refused** = a TCP RST came straight back. Something is reachable, and nothing is listening on that port. The network is fine; the service is down or on a different port.
- **Connection timed out** = no answer at all. A firewall dropped it silently, or routing is broken.

Those two words point at completely different teams. Learn to read them.

HTTP/3 replaces TCP with QUIC over UDP 443, merging the transport and TLS handshakes into a single round trip. Same seven layers, fewer round trips.`,
        [
            ['Three-way handshake', 'SYN, SYN/ACK, ACK. One full round trip before any data.'],
            ['Sequence / ACK number', 'Byte offsets that make TCP reliable and ordered.'],
            ['RST', 'Abrupt reset. A closed port answers with this — "connection refused".'],
            ['SNI', 'Server Name Indication in the TLS Client Hello. Sent unencrypted.'],
            ['Host header', 'How one IP address serves many websites.'],
            ['QUIC', 'HTTP/3 transport: UDP 443, handshake and encryption in one round trip.'],
        ],
        [
            { id: 's3t1', text: 'Place a web server, address it and enable HTTP', check: 'httpServerExists' },
            { id: 's3t2', text: 'Fetch the page from a client and get 200 OK', check: 'httpWorks' },
            { id: 's3t3', text: 'Open the trace and find the SYN, SYN/ACK and ACK segments', check: 'traceExists', hint: 'Simulation panel → pick the HTTP trace → step through the hops.' },
        ],
        { starterTemplateId: 'inter-vlan-l3', quiz: [
            { q: '"Connection refused" tells you what?', options: ['The network is broken', 'A firewall dropped the packet', 'The host is reachable but nothing is listening on that port', 'DNS failed'], answer: 2, why: 'A RST came back, so the host answered. The port is closed — a service problem, not a network problem.' },
            { q: 'Why does DNS use UDP?', options: ['UDP is more reliable', 'One request and one reply is cheaper than a handshake', 'TCP cannot carry DNS', 'For security'], answer: 1, why: 'A TCP handshake would triple the cost of a single small query.' },
        ] }),

    L('s4', 'services', 4, 'NAT and PAT', 'How one public address serves an entire house', 18, 'intermediate', [3, 4],
        [
            'Configure PAT so an inside network reaches the Internet',
            'Read a NAT translation table',
            'Explain why inbound connections need an explicit port forward',
        ],
        `There are not enough IPv4 addresses, so almost every network uses private addressing internally (RFC 1918) and translates on the way out.

**PAT** (NAT overload) is what your home router does. It rewrites the **source IP** to the router's public address and also rewrites the **source port** to a unique value, so it can tell the return traffic apart:

    inside local          inside global
    192.168.1.10:51234 →  203.0.113.10:51234
    192.168.1.11:51234 →  203.0.113.10:51235

The translation table is what makes the reply routable back to the right host. No entry, no way home.

Configuration is three parts: mark the interfaces, and enable the translation.

    interface gi0/0/1
     ip nat inside
    interface gi0/0/0
     ip nat outside
    ip nat inside source list 1 interface gi0/0/0 overload

**The consequence students always miss:** translations are created by **outbound** traffic. An unsolicited inbound packet has no matching entry, so it is dropped. That is why hosting anything behind NAT needs an explicit **port forward** (static NAT), and why game consoles complain about "strict NAT".

**CGNAT** (100.64.0.0/10) is NAT applied a second time by the ISP. Common on 5G and some cable services. You cannot port-forward through it at all, no matter what you configure on your own router.

NAT is often described as security. It is not — it is address conservation that happens to block unsolicited inbound traffic as a side effect. The firewall policy is what provides security. IPv6 removes the need for NAT entirely, which makes that policy the only thing left.`,
        [
            ['Static NAT', 'One-to-one permanent mapping. Used to publish a server.'],
            ['PAT / overload', 'Many-to-one using port numbers. What almost every site runs.'],
            ['Inside local / global', 'The private address, and the public address it is translated to.'],
            ['Port forward', 'A manual inbound mapping, because NAT has no entry for unsolicited traffic.'],
            ['CGNAT', 'Carrier-grade NAT, 100.64.0.0/10. You cannot port-forward through it.'],
        ],
        [
            { id: 's4t1', text: 'Build an inside network, a router and an Internet cloud', check: 'internetPresent' },
            { id: 's4t2', text: 'Enable NAT and mark the inside and outside interfaces', check: 'natConfigured' },
            { id: 's4t3', text: 'Ping a public address from an inside host', check: 'pingToInternetWorks' },
            { id: 's4t4', text: 'Check the NAT translation table has an entry', check: 'natTranslationExists', hint: 'Router CLI: show ip nat translations' },
        ],
        { starterTemplateId: 'home-network', quiz: [
            { q: 'Why does an inbound connection fail through PAT without a port forward?', options: ['PAT blocks all inbound traffic by policy', 'There is no translation entry to map it to an inside host', 'The public address is wrong', 'TCP does not work through NAT'], answer: 1, why: 'Entries are created by outbound traffic. Unsolicited inbound has nothing to match, so it is dropped.' },
            { q: 'Is NAT a security control?', options: ['Yes, it is a firewall', 'No — it conserves addresses and blocks unsolicited inbound as a side effect', 'Only with IPv6', 'Only with static NAT'], answer: 1, why: 'The security comes from the firewall policy. NAT\'s inbound behaviour is a side effect, not a designed control.' },
        ] }),

    /* ─────────── Wireless ─────────── */
    L('w1', 'wireless', 1, 'How Wi-Fi actually works', 'Association, airtime, bands and channels', 18, 'beginner', [1, 2],
        [
            'Describe association as a Layer-2 event',
            'Choose bands and channels without creating interference',
            'Explain why measured throughput is far below the headline rate',
        ],
        `An access point is a **Layer-2 bridge**. It converts 802.11 frames to 802.3 frames and forwards them into a VLAN. It is not a router, and it does not give out addresses (unless it is a combined home unit that also happens to be a router).

**Association happens before any IP configuration.** The client scans, authenticates, associates — all at Layer 2 — and only then sends a DHCP Discover. So "connected to Wi-Fi but no Internet" is almost always a Layer-3 problem, not a radio problem.

**Airtime is shared and half-duplex.** Every client on a radio contends for the same medium using CSMA/CA (avoidance, not detection — a radio cannot listen while transmitting). Twenty clients do not each get the headline rate; they take turns. And the slowest client is the expensive one, because it occupies the medium for longer to send the same data.

**Bands.**
- **2.4 GHz** — best range, worst capacity. Only channels **1, 6 and 11** do not overlap. Anything else guarantees adjacent-channel interference. Keep it at 20 MHz. Do not switch it off entirely: cheap IoT is 2.4 GHz-only.
- **5 GHz** — many channels, good capacity, less range. 40 or 80 MHz is the sweet spot.
- **6 GHz** (Wi-Fi 6E/7) — clean spectrum, 160 and 320 MHz channels, and **WPA3 is mandatory**. WPA2-only clients simply cannot join a 6 GHz SSID.

**Wider is not automatically better.** A 160 MHz channel doubles throughput for one client and quarters the number of non-overlapping channels available, so in a dense deployment it makes things worse. Design for capacity, not for one speed test.

**Wi-Fi 6/7 features that matter:** OFDMA lets the AP serve several small clients in one transmission (transformative for dense IoT); MU-MIMO serves several clients spatially; MLO in Wi-Fi 7 lets one client use 5 and 6 GHz simultaneously.`,
        [
            ['Association', 'The Layer-2 process of joining a BSS. Happens before DHCP.'],
            ['SSID / BSSID', 'The network name; the specific radio MAC serving it.'],
            ['CSMA/CA', 'Collision Avoidance — the arbitration scheme for a medium you cannot listen to while transmitting.'],
            ['Co-channel interference', 'Two APs on the same channel sharing airtime instead of adding capacity.'],
            ['OFDMA', 'Serving multiple clients within one transmission. The headline Wi-Fi 6 feature.'],
            ['MLO', 'Multi-Link Operation — Wi-Fi 7 clients using two bands at once.'],
        ],
        [
            { id: 'w1t1', text: 'Place an access point and configure an SSID', check: 'apWithSsid' },
            { id: 'w1t2', text: 'Cable the AP into a switch', check: 'apUplinked' },
            { id: 'w1t3', text: 'Associate at least two wireless clients to the SSID', check: 'wirelessClientsAssociated', args: { min: 2 }, hint: 'On the client: set wifi <SSID> <passphrase>' },
            { id: 'w1t4', text: 'Ping from a wireless client to a wired host', check: 'anyPingWorks' },
        ],
        { starterTemplateId: 'enterprise-wifi', quiz: [
            { q: 'Which 2.4 GHz channels do not overlap?', options: ['1, 5, 9', '1, 6, 11', '2, 7, 12', 'All of them'], answer: 1, why: 'Only 1, 6 and 11 are fully non-overlapping in the 2.4 GHz band.' },
            { q: 'A client shows "connected, no Internet". Where do you look?', options: ['Radio signal strength', 'Layer 3 — DHCP, gateway, DNS', 'The SSID name', 'Channel width'], answer: 1, why: '"Connected" means association succeeded, so Layer 2 is fine. The fault is at Layer 3 or above.' },
        ] }),

    L('w2', 'wireless', 2, 'Wireless security and enterprise design', 'WPA3, SSID-to-VLAN mapping, controllers and roaming', 20, 'intermediate', [2, 3],
        [
            'Choose the right security mode and explain why',
            'Map SSIDs to VLANs for staff and guest separation',
            'Explain what a controller adds and how fast roaming works',
        ],
        `**Security, in order of preference.** WPA3-Personal (SAE) resists offline dictionary attacks and gives forward secrecy — use it wherever clients support it. WPA2-Personal (PSK) is still acceptable with a long, random passphrase. WPA2/WPA3-Enterprise uses 802.1X with per-user credentials and is the correct answer for any organisation. **Open** means everything is readable over the air. **WEP** has been broken since 2004 and must never appear anywhere.

**SSID-to-VLAN mapping** is how you separate populations on shared radios. One SSID for staff mapped to VLAN 10, one for guests mapped to VLAN 20, and the AP uplink becomes a trunk carrying both. Guest VLANs should have **client isolation** on (guests cannot see each other) and an ACL that permits only outbound Internet.

**A controller (WLC)** adds central management: one place to define WLANs, RF management (RRM picks channels and power automatically to reduce co-channel interference), and coordinated roaming. Lightweight APs tunnel to the controller over CAPWAP; client data can be tunnelled centrally or switched locally at the AP.

**Roaming** between APs on the same SSID is a Layer-2 reassociation. The client keeps its IP address, so a TCP session or a voice call survives — provided the target AP is in the same VLAN. 802.11r pre-authenticates the client to neighbouring APs so the handoff takes milliseconds instead of seconds; 802.11k and v help the client choose a good target instead of clinging to a distant AP.

**Design the coverage overlap deliberately.** For voice you want −67 dBm everywhere with about 20 % cell overlap. Too little overlap and calls drop at the edges; too much and clients cling to a far AP at a slow rate, wasting airtime for everyone.`,
        [
            ['WPA3-SAE', 'Simultaneous Authentication of Equals. Resists offline cracking; forward secrecy.'],
            ['802.1X', 'Per-user authentication against RADIUS. The enterprise answer.'],
            ['Client isolation', 'Stops wireless clients on the same SSID from reaching each other. Essential on guest.'],
            ['CAPWAP', 'The tunnel between a lightweight AP and its controller.'],
            ['802.11r/k/v', 'Fast transition, neighbour reports, and BSS transition management — good roaming.'],
            ['RRM', 'Radio Resource Management: automatic channel and power selection.'],
        ],
        [
            { id: 'w2t1', text: 'Set the AP to WPA2-Personal or WPA3-Personal (not open, not WEP)', check: 'wirelessSecure' },
            { id: 'w2t2', text: 'Map the wireless SSID to a VLAN', check: 'wirelessVlanMapped' },
            { id: 'w2t3', text: 'Make the AP uplink a trunk so it can carry both VLANs', check: 'trunkExists' },
            { id: 'w2t4', text: 'Clear every wireless warning from the Issues panel', check: 'noErrors' },
        ],
        { starterTemplateId: 'enterprise-wifi', quiz: [
            { q: 'Why does 6 GHz require WPA3?', options: ['It is faster', 'The standard mandates it — WPA2 clients cannot join', 'For range', 'It does not'], answer: 1, why: 'WPA3 is mandatory in 6 GHz. A WPA2-only client cannot associate at all.' },
            { q: 'A voice call drops when a user walks between APs. Which feature helps most?', options: ['Wider channels', '802.11r fast transition', 'Higher TX power', 'A second SSID'], answer: 1, why: '802.11r pre-authenticates to neighbouring APs so the handoff is fast enough for voice.' },
        ] }),

    /* ─────────── Security ─────────── */
    L('sec1', 'security', 1, 'Access control lists', 'Ordered rules, wildcards and the implicit deny', 20, 'intermediate', [3, 4],
        [
            'Write standard and extended ACLs with correct wildcard masks',
            'Apply an ACL in the right direction on the right interface',
            'Explain why rule order decides everything',
        ],
        `An ACL is an **ordered** list of permit and deny statements. The router evaluates top to bottom and **stops at the first match**. Order is not a style preference — it is the logic.

    10 permit tcp any host 172.31.0.80 eq 80
    20 deny ip any 10.20.0.0 0.0.0.255
    30 permit ip any any

Reverse lines 10 and 20 and the web server is unreachable. Same rules, different meaning.

**Every ACL ends with an implicit \`deny any\`.** If you write only permits, everything else is dropped. An empty ACL applied to an interface therefore blocks all traffic — a genuinely common self-inflicted outage.

**Wildcard masks** are the inverse of subnet masks. 0 = "must match", 255 = "don't care".
- \`0.0.0.0\` → one specific host (or write \`host 10.1.1.1\`)
- \`0.0.0.255\` → a /24
- \`255.255.255.255\` → anything (or write \`any\`)

**Standard vs extended.** Standard ACLs match the **source address only** — place them close to the destination, or you block more than you meant to. Extended ACLs match source, destination, protocol and port — place them close to the source so unwanted traffic never crosses the network.

**Direction matters.** Inbound is evaluated **before** the routing decision, which is cheaper and stops the packet earlier. Outbound is evaluated after routing, just before transmission. \`ip access-group NAME in\` on the interface where the traffic arrives is the usual answer.

Build the ACL, apply it, then run a ping in this simulator. If the ACL denies it, the trace will name the exact rule that matched — including the implicit deny.`,
        [
            ['Implicit deny', 'The invisible "deny any" at the end of every ACL.'],
            ['Wildcard mask', 'Inverse of a subnet mask. 0 must match, 255 is ignored.'],
            ['Standard ACL', 'Source address only. Place near the destination.'],
            ['Extended ACL', 'Source, destination, protocol and port. Place near the source.'],
            ['Inbound vs outbound', 'Inbound is checked before routing; outbound after.'],
        ],
        [
            { id: 'sec1t1', text: 'Create an ACL with at least two rules', check: 'aclRuleCount', args: { min: 2 } },
            { id: 'sec1t2', text: 'Apply it to an interface in a direction', check: 'aclApplied' },
            { id: 'sec1t3', text: 'Prove it blocks the traffic you intended to block', check: 'aclBlocksSomething', hint: 'Ping from a denied source and read the failure reason in the trace.' },
            { id: 'sec1t4', text: 'Prove permitted traffic still passes', check: 'anyPingWorks' },
        ],
        { starterTemplateId: 'iot-segmentation', quiz: [
            { q: 'Your ACL has one permit line and nothing else. What happens to all other traffic?', options: ['It is permitted', 'It is denied by the implicit deny', 'It is logged only', 'It depends on the interface'], answer: 1, why: 'Every ACL ends with an implicit deny any.' },
            { q: 'Where should a standard ACL be placed?', options: ['Close to the source', 'Close to the destination', 'On every interface', 'It does not matter'], answer: 1, why: 'It matches source only, so placing it near the source would block that source from reaching everything.' },
        ] }),

    L('sec2', 'security', 2, 'Firewalls, zones and the DMZ', 'Stateful policy and why a DMZ exists', 20, 'advanced', [3, 4, 7],
        [
            'Explain what "stateful" buys you compared with an ACL',
            'Design inside / outside / DMZ zones',
            'Publish a server safely without exposing the inside network',
        ],
        `A **stateful** firewall tracks connections. Allow a session outbound and the return traffic is permitted automatically — you write the rule once, in one direction. An ACL is stateless and needs both halves, which is how people accidentally open far more than they intended.

**Zones express trust.** Inside (trusted), outside (untrusted), DMZ (semi-trusted). Traffic between zones needs an explicit policy; traffic within a zone usually does not.

**Why a DMZ exists.** A public web server must accept connections from the Internet, so it will eventually be compromised. Put it in the DMZ and the policy becomes:
- Internet → DMZ: permit only tcp/443 to the one host that needs it.
- DMZ → inside: **deny**, except one narrow rule to the specific database port if the application genuinely requires it.
- Inside → DMZ and inside → Internet: permit as needed.

Now compromising the web server gets the attacker the web server, not your finance VLAN. That containment is the entire value.

**Rules to hold on to:**
- **Default deny.** The last rule denies everything and logs it. An implicit permit is a breach waiting to happen.
- **Least privilege.** Permit the specific port to the specific host, not "any any" to the subnet.
- **App-ID over port numbers.** Blocking TCP 443 no longer blocks "the web" when everything tunnels over it. Modern policy matches applications and users.
- **Fail mode is a decision.** An inline IPS that fails closed takes the site down; failing open lets attacks through. Choose deliberately, and write it down.
- **Log the denies.** A rule base you cannot audit is a rule base you do not understand.`,
        [
            ['Stateful inspection', 'Tracking sessions so return traffic is allowed automatically.'],
            ['Zone', 'A trust grouping of interfaces. Policy is written between zones.'],
            ['DMZ', 'A segment for Internet-facing services, isolated from the inside network.'],
            ['Default deny', 'The last rule blocks everything not explicitly allowed.'],
            ['Least privilege', 'Permit the minimum: this host, this port, this direction.'],
        ],
        [
            { id: 'sec2t1', text: 'Place a firewall with at least three interfaces in use', check: 'firewallThreeZones' },
            { id: 'sec2t2', text: 'Put a web server in the DMZ segment', check: 'dmzServerExists' },
            { id: 'sec2t3', text: 'Write a policy that permits the DMZ web server and denies the inside network', check: 'aclRuleCount', args: { min: 2 } },
            { id: 'sec2t4', text: 'Prove an inside host can still reach the Internet', check: 'pingToInternetWorks' },
        ],
        { starterTemplateId: 'dmz-firewall' }),

    L('sec3', 'security', 3, 'Segmentation and access control', 'VLANs, 802.1X and keeping IoT where it belongs', 18, 'advanced', [2, 3],
        [
            'Design segmentation for IoT, OT and guest populations',
            'Explain the three roles in 802.1X',
            'Recognise VLAN hopping and how to prevent it',
        ],
        `**Segmentation is the highest-value security control you can apply**, and it costs nothing but design effort. The principle: group devices by what they need to talk to, then permit only that.

A realistic set of segments: corporate users, servers, voice, printers, cameras, building management/OT, guest, and network management. Cameras talk to the NVR and nothing else. The PLC talks to its controller and nothing else. Guests reach the Internet and nothing else.

**802.1X** authenticates the device or user before the port is opened. Three roles:
- **Supplicant** — the client.
- **Authenticator** — the switch or AP. It relays only.
- **Authentication server** — RADIUS. It decides.

On success RADIUS can return a **VLAN**, so the port lands in the right segment based on *who* connected, not where they plugged in. Always configure a fallback (MAB for printers, or a guest VLAN) or one RADIUS outage takes a whole floor offline.

**VLAN hopping** has two forms, and both have simple fixes:
- **Switch spoofing** — an attacker negotiates a trunk with DTP. Fix: hard-code access ports (\`switchport mode access\`) and disable dynamic negotiation.
- **Double tagging** — abuses a native VLAN mismatch. Fix: set the native VLAN explicitly to an unused VLAN on both ends of every trunk, and never use VLAN 1 for user traffic.

**Other port hardening worth knowing:** port security limits MAC addresses per port; DHCP snooping blocks rogue DHCP servers; dynamic ARP inspection stops ARP spoofing; BPDU guard shuts down a port that receives a BPDU on an edge port. Each one closes a specific, real attack.`,
        [
            ['Segmentation', 'Splitting the network by function so a compromise cannot spread.'],
            ['802.1X', 'Port-based authentication. Supplicant, authenticator, RADIUS server.'],
            ['MAB', 'MAC Authentication Bypass — the fallback for devices with no 802.1X supplicant.'],
            ['VLAN hopping', 'Escaping your VLAN via DTP negotiation or double tagging.'],
            ['DHCP snooping', 'Blocking DHCP offers from untrusted ports — stops rogue servers.'],
            ['Purdue model', 'The layered reference model for separating OT from IT.'],
        ],
        [
            { id: 'sec3t1', text: 'Create at least three VLANs representing different populations', check: 'vlanCount', args: { min: 3 }, hint: 'On a switch: VLANs & STP tab → Add VLAN, or "vlan 20" in the CLI.' },
            { id: 'sec3t2', text: 'Place IoT devices in their own segment', check: 'iotSegmented' },
            { id: 'sec3t3', text: 'Apply an ACL that stops IoT reaching the corporate segment', check: 'aclApplied' },
            { id: 'sec3t4', text: 'Prove the IoT device is blocked but still reaches its gateway', check: 'aclBlocksSomething' },
        ],
        { starterTemplateId: 'iot-segmentation' }),

    /* ─────────── WAN ─────────── */
    L('wan1', 'wan', 1, 'Last-mile technologies', 'DSL, DOCSIS, GPON, 5G and LEO satellite', 16, 'intermediate', [1, 2, 3],
        [
            'Choose an access technology for a given site',
            'Explain what a modem does and does not do',
            'Recognise CGNAT and its consequences',
        ],
        `The last mile is where the physics lives.

**DSL** runs over the telephone pair. Distance-limited: the further from the exchange, the lower the sync rate. Asymmetric.

**DOCSIS (cable)** runs over coax and is **shared in the neighbourhood**. Evening slowdown is contention with your neighbours, not your Wi-Fi. DOCSIS 4.0 finally improves upstream substantially.

**GPON/XGS-PON (fibre)** is a passive optical tree: one fibre from the exchange is split optically to many premises. The split ratio sets contention. XGS-PON is symmetric 10 Gbps. The **ONT** is your demarcation point and hands you plain Ethernet.

**5G fixed wireless** is genuinely good where fibre has not arrived — 20–40 ms latency, high throughput. Two caveats: jitter is worse than fibre, and you are almost certainly behind **CGNAT** (100.64.0.0/10), so no inbound connections and no port forwarding, ever, regardless of your own router config.

**LEO satellite** cut latency from ~600 ms (geostationary) to 25–60 ms because the orbit is ~550 km instead of 36 000 km. Satellite handovers cause periodic loss, which long-lived TCP dislikes and QUIC/BBR tolerates well.

**A modem is a media converter, not a router.** It changes the physical encoding and nothing else. The router does the addressing, NAT and firewalling. In a home all-in-one those are separate functions in one plastic box — and knowing which function is failing is most of the diagnosis.

For a business site the real question is not peak speed but **SLA**: guaranteed throughput, committed repair time, and whether you have a second path. Two consumer circuits from different providers often beat one expensive circuit, because they fail independently.`,
        [
            ['Modem', 'Media converter between Ethernet and the access technology. Does not route.'],
            ['ONT', 'Optical Network Terminal — the fibre demarcation point.'],
            ['PON split ratio', 'How many premises share one feeder fibre. Sets contention.'],
            ['CGNAT', '100.64.0.0/10. Carrier NAT; port forwarding is impossible through it.'],
            ['SLA', 'The contractual guarantee. Usually matters more than headline speed.'],
        ],
        [
            { id: 'wan1t1', text: 'Build a site with a modem or ONT between the router and the Internet', check: 'modemPresent' },
            { id: 'wan1t2', text: 'Get an inside host to reach a public address', check: 'pingToInternetWorks' },
        ],
        { starterTemplateId: 'home-network' }),

    L('wan2', 'wan', 2, 'Enterprise WAN and SD-WAN', 'Connecting sites, and choosing paths intelligently', 18, 'advanced', [2, 3],
        [
            'Compare leased lines, MPLS, Internet VPN and SD-WAN',
            'Configure a serial link with correct DCE clocking',
            'Explain what SD-WAN measures and why',
        ],
        `**Leased line / serial.** A dedicated circuit. Still worth configuring once because it teaches DCE/DTE: one end supplies the clock (\`clock rate 64000\`), the other follows. Forget it and the line stays down with no useful error message.

**MPLS.** The provider forwards on labels rather than IP lookups, giving you a private any-to-any network with QoS guarantees. Expensive, slow to provision, and gradually being displaced.

**Internet VPN.** IPsec tunnels over ordinary broadband. Cheap and fast to deploy. IKE builds the management tunnel, ESP encrypts the data. A tunnel adds ~60 bytes of overhead, so the effective MTU drops — **set TCP MSS to about 1350** or you get black-hole fragmentation: small packets work, large transfers hang. That symptom is almost always MTU.

**SD-WAN** is the current answer. Bond broadband, MPLS and LTE/5G; measure loss, latency and jitter **per tunnel, continuously**; steer each application to the best path in real time. Voice takes the low-jitter path, bulk backup takes the cheap one. Policy is defined centrally and pushed to the edges; the edge box just builds tunnels and enforces what it is told.

**BGP, briefly.** If you are single-homed, take a default route from your provider and stop. If you are multi-homed you need BGP and your own AS number, and you must filter in both directions: accept only what your provider should send, advertise only your own prefixes. Getting that filtering wrong is how routing leaks take large parts of the Internet offline.`,
        [
            ['DCE/DTE', 'On serial, the DCE provides the clock. Missing clock rate = line down.'],
            ['MPLS', 'Label-switched provider network with QoS. Private, expensive.'],
            ['IPsec IKE/ESP', 'IKE negotiates; ESP encrypts. ~60 bytes of overhead.'],
            ['TCP MSS clamping', 'Lowering MSS over a tunnel to avoid fragmentation black holes.'],
            ['SD-WAN', 'Application-aware path selection across multiple transports.'],
            ['AS number', 'Your identity in BGP. Required to be multi-homed.'],
        ],
        [
            { id: 'wan2t1', text: 'Connect two routers over a serial link', check: 'serialLinkExists' },
            { id: 'wan2t2', text: 'Address both serial interfaces in the same /30', check: 'hasPointToPointLink' },
            { id: 'wan2t3', text: 'Reach a host at the far site', check: 'multiHopPingWorks', args: { minRouterHops: 2 } },
        ],
        { starterTemplateId: 'wan-ospf' }),

    /* ─────────── Data center ─────────── */
    L('dc1', 'datacenter', 1, 'Leaf-spine and the modern fabric', 'Why the data center stopped using spanning tree', 18, 'advanced', [2, 3],
        [
            'Explain leaf-spine and its predictable latency',
            'Describe why the fabric routes instead of switching',
            'Say what VXLAN solves',
        ],
        `The classic three-tier design (access → distribution → core) was built for north-south traffic: clients talking to servers. Virtualisation changed the pattern to **east-west**: servers talking to servers, constantly. Three-tier handles that badly, and spanning tree makes it worse by blocking half your links.

**Leaf-spine** fixes both. Every leaf connects to every spine; leaves never connect to each other; spines never connect to each other and carry no host ports. Consequences:
- **Any server is exactly two hops from any other.** Latency becomes predictable, which matters enormously for distributed storage and databases.
- **Every link is active.** The fabric runs a routing protocol (usually eBGP) and uses **ECMP** to spread flows across all uplinks. Nothing is blocked.
- **Scale is linear.** Add a spine and every leaf gets more uplink bandwidth. Add a leaf and you add rack capacity. No redesign.

**VXLAN** solves the remaining problem. Applications and VM mobility still want Layer-2 adjacency, but you just built a routed fabric. VXLAN encapsulates Ethernet in UDP so a Layer-2 segment can stretch across a routed underlay. **EVPN** distributes the MAC and IP reachability via BGP instead of flooding. So: routed underlay for stability and ECMP, bridged overlay for the applications that need it.

**Oversubscription** is the number that matters. 48 servers at 25 G into 4 × 100 G uplinks is 1200 G down to 400 G — 3:1. Fine for general workloads, unacceptable for storage or AI training. Size it for the traffic you actually have.

**AI clusters** are the 2026 special case: RoCE or InfiniBand, lossless with PFC and ECN, because one dropped packet stalls an entire collective operation. They are built as dedicated fabrics and never mixed with general traffic.`,
        [
            ['Leaf-spine', 'Every leaf to every spine. Two hops between any two hosts.'],
            ['ECMP', 'Equal-Cost Multi-Path — using every uplink at once instead of blocking.'],
            ['VXLAN', 'Ethernet in UDP, so L2 can stretch over a routed underlay.'],
            ['EVPN', 'BGP-distributed MAC/IP reachability. Replaces flooding.'],
            ['Oversubscription', 'The ratio of access bandwidth to uplink bandwidth.'],
            ['East-west traffic', 'Server-to-server traffic. The dominant pattern since virtualisation.'],
        ],
        [
            { id: 'dc1t1', text: 'Build a leaf-spine fabric with at least two spines and two leaves', check: 'leafSpineBuilt' },
            { id: 'dc1t2', text: 'Attach a compute host to each leaf', check: 'deviceCount', args: { role: 'server', min: 2 } },
            { id: 'dc1t3', text: 'Confirm no port is in spanning-tree blocking', check: 'noStpBlocking' },
        ],
        { starterTemplateId: 'datacenter-leaf-spine' }),

    L('dc2', 'datacenter', 2, 'Virtual, container and cloud networking', 'vSwitches, Docker bridges, Kubernetes and VPCs', 18, 'advanced', [2, 3, 4],
        [
            'Explain where the switch is in a virtualised host',
            'Describe Kubernetes pod and service networking',
            'Compare a cloud VPC with an on-premises network',
        ],
        `**Virtual switches.** A hypervisor host contains a real Layer-2 switch in software. VM-to-VM traffic on the same host never touches a physical cable — which is why "the network is slow" is sometimes not the network at all. The physical NIC is normally a **trunk**, carrying every VLAN the VMs need.

**Containers.** The default Docker bridge NATs containers behind the host IP — conceptually identical to a home router, one layer up. Overlay networks (VXLAN again) let containers on different hosts share one flat Layer-2 domain.

**Kubernetes** makes three deliberate choices:
- Every pod gets a **real routable IP** from the pod CIDR. **No NAT between pods**, by design. This is the single most important thing to understand about K8s networking.
- A **Service** is a virtual IP that exists on no interface anywhere. kube-proxy or eBPF load-balances it to the pods behind it.
- **NetworkPolicy** is the ACL equivalent, and it permits everything until you write the first one. A cluster with no NetworkPolicy is a flat network.

**Cloud VPCs.** Software-defined: you write route tables and security groups instead of touching interfaces. Two things to internalise:
- **Security groups are stateful, per-instance** firewalls. **NACLs are stateless, per-subnet** ACLs. You usually need both, and forgetting that NACLs are stateless (so you must allow the return traffic explicitly) causes a memorable amount of debugging.
- **Never overlap your on-premises CIDR with the VPC CIDR.** The VPN will build and traffic will never route correctly. Plan the address space before you create anything.

Underneath all of it the fundamentals have not changed. It is still addressing, still routing, still ACLs — with a different control plane.`,
        [
            ['vSwitch', 'The software Layer-2 switch inside a hypervisor host.'],
            ['Pod CIDR', 'The routable range Kubernetes assigns pod IPs from. No NAT between pods.'],
            ['Service VIP', 'A virtual IP load-balanced to pods. Exists on no interface.'],
            ['NetworkPolicy', 'Kubernetes ACLs. Permits everything until the first policy exists.'],
            ['Security group', 'Stateful, per-instance cloud firewall.'],
            ['NACL', 'Stateless, per-subnet cloud ACL. You must allow return traffic explicitly.'],
        ],
        [
            { id: 'dc2t1', text: 'Place a hypervisor host and a container/Kubernetes node', check: 'virtualHostsPresent' },
            { id: 'dc2t2', text: 'Give them addresses and reach one from the other', check: 'anyPingWorks' },
            { id: 'dc2t3', text: 'Add a cloud VPC and route to it', check: 'cloudPresent' },
        ],
        { starterTemplateId: 'datacenter-leaf-spine' }),

    /* ─────────── Troubleshooting ─────────── */
    L('t1', 'troubleshooting', 1, 'A method that works', 'Bottom-up, top-down, divide and conquer', 18, 'intermediate', [1, 2, 3, 4, 7],
        [
            'Choose a troubleshooting approach based on the symptom',
            'Use ping, traceroute, ARP and the routing table in the right order',
            'Localise a fault to one layer before changing anything',
        ],
        `Guessing is slow. A method is fast.

**Pick an approach from the symptom.**
- Nothing works anywhere → **bottom-up**. Start at Layer 1 and climb.
- One application is broken, everything else is fine → **top-down**. Start at Layer 7.
- Something works from A but not from B → **divide and conquer**. Start in the middle and bisect the path.

**The order of tools, and what each one proves.**
1. \`ipconfig\` / \`show ip interface brief\` — do I even have a valid address, mask and gateway? Half of all faults end here. A 169.254 address, a missing gateway, or "administratively down" is your answer.
2. **Ping your own gateway.** Success proves Layer 1, Layer 2 and your local Layer 3 are all fine. Failure means the problem is local — cable, VLAN, mask, or the gateway itself.
3. **Ping a remote IP address.** Success proves routing works in both directions. Failure with the gateway reachable means a route is missing somewhere.
4. \`traceroute\` — where does it stop? The last responding hop is next to the problem.
5. **Ping by name.** Works by IP but not by name = DNS. Always.
6. \`show ip route\`, \`show mac address-table\`, \`show arp\` — verify what the device actually believes, not what you configured.

**Change one thing at a time, and verify after each change.** Two simultaneous changes mean you cannot attribute the result to either.

**Write down what you did.** Most repeat outages are somebody's undocumented emergency fix from six months ago.`,
        [
            ['Bottom-up', 'Start at Layer 1. Best when nothing works.'],
            ['Top-down', 'Start at Layer 7. Best when one application is broken.'],
            ['Divide and conquer', 'Bisect the path. Best when it works from one place and not another.'],
            ['Ping the gateway', 'The single most informative first test. Proves L1, L2 and local L3.'],
            ['Last responding hop', 'In a traceroute, the fault is next to it.'],
        ],
        [
            { id: 't1t1', text: 'Take a working network and break it by shutting an interface', check: 'traceCount', args: { min: 1 }, hint: 'shutdown on a router interface, then ping and read the failure.' },
            { id: 't1t2', text: 'Use the Issues panel to find and fix every error', check: 'noErrors' },
            { id: 't1t3', text: 'Confirm connectivity is restored', check: 'anyPingWorks' },
        ],
        { starterTemplateId: 'two-subnets-router' }),

    L('t2', 'troubleshooting', 2, 'The eight faults that cause most outages', 'Recognise them by symptom, fix them in seconds', 20, 'advanced', [1, 2, 3, 7],
        [
            'Map a symptom directly to a probable cause',
            'Diagnose each of the eight classic faults',
            'Build a personal checklist you can run under pressure',
        ],
        `In practice, a small number of faults cause most incidents. Learn the symptom, not just the cause.

**1. Wrong subnet mask.** Local traffic fine, remote traffic fails. The host ANDs with the wrong mask, thinks remote networks are local, ARPs into the void.

**2. Missing or wrong default gateway.** Own subnet works, nothing else does. Or the gateway is not even in the host's subnet, so it cannot be ARPed at all.

**3. Duplicate IP address.** Intermittent, and it moves between hosts. ARP returns whichever answered first. \`arp -a\` showing a MAC you do not expect is the tell.

**4. VLAN mismatch.** Link is up, MAC table looks fine, nothing passes. Either an access-port VLAN mismatch between switches, or a VLAN missing from a trunk's allowed list, or a native VLAN mismatch.

**5. Interface administratively down.** \`show ip interface brief\` says it. Router interfaces start shut. Ten seconds to check, and people spend an hour not checking.

**6. Missing return route.** Ping fails and it looks like the target is down. Traffic gets there; the reply has nowhere to go. Asymmetry is invisible unless you look for it.

**7. DNS.** Works by IP, not by name. Ten-second test, and it is the answer roughly half the time somebody says "the Internet is down".

**8. MTU / fragmentation black hole.** Ping works, small pages load, large transfers hang. Classic over a VPN or tunnel. Clamp TCP MSS to ~1350.

**Two more worth adding to the list:** duplex mismatch (works small, fails under load, late collisions) and PoE budget exhaustion (some APs or cameras randomly do not come up after a power cycle).

Print this. Run it top to bottom. It will resolve most of what you meet.`,
        [
            ['Symptom-first diagnosis', 'Match the pattern before forming a theory.'],
            ['Duplicate IP', 'Intermittent and mobile. Check ARP.'],
            ['Asymmetric routing', 'Forward path works, return path missing. Looks like the target is down.'],
            ['MTU black hole', 'Small packets fine, large ones hang. Clamp MSS over tunnels.'],
            ['PoE budget', 'Total wattage, not per-port. Devices fail to come up after a reboot.'],
        ],
        [
            { id: 't2t1', text: 'Deliberately create a wrong-mask fault and observe the symptom', check: 'traceCount', args: { min: 1 } },
            { id: 't2t2', text: 'Fix it and confirm remote connectivity returns', check: 'crossSubnetPingWorks' },
            { id: 't2t3', text: 'Finish with a topology that has zero errors and zero warnings', check: 'noIssuesAtAll' },
        ],
        { starterTemplateId: 'two-subnets-router' }),
];

/* ══════════════════════════ task validators ══════════════════════════ */

export interface CheckResult { ok: boolean; message: string }
export type CheckFn = (sim: Simulator, args: Record<string, any>) => CheckResult;

const ok = (message: string): CheckResult => ({ ok: true, message });
const no = (message: string): CheckResult => ({ ok: false, message });

function hostsOf(sim: Simulator) {
    return sim.topology.devices.filter(d => ['host', 'server', 'nas', 'loadbalancer'].includes(roleOf(d)));
}

function pingablePairs(sim: Simulator): Array<[string, string]> {
    const hosts = hostsOf(sim).filter(d => d.interfaces.some(i => i.ipv4 && isValidIPv4(i.ipv4)));
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < hosts.length; i++) {
        for (let j = 0; j < hosts.length; j++) {
            if (i === j) continue;
            const target = hosts[j].interfaces.find(x => x.ipv4 && isValidIPv4(x.ipv4))!.ipv4;
            pairs.push([hosts[i].id, target]);
        }
    }
    return pairs;
}

export const LESSON_CHECKS: Record<string, CheckFn> = {
    deviceCount: (sim, args) => {
        const min = args.min ?? 1;
        const list = sim.topology.devices.filter(d =>
            (!args.typeId || d.typeId === args.typeId) &&
            (!args.role || roleOf(d) === args.role));
        return list.length >= min
            ? ok(`${list.length} matching device${list.length === 1 ? '' : 's'} found`)
            : no(`Found ${list.length}, need at least ${min}${args.role ? ` with role "${args.role}"` : ''}`);
    },

    linkCount: (sim, args) => {
        const min = args.min ?? 1;
        return sim.topology.links.length >= min
            ? ok(`${sim.topology.links.length} cables in place`)
            : no(`Only ${sim.topology.links.length} cable${sim.topology.links.length === 1 ? '' : 's'} — need at least ${min}`);
    },

    linkBetweenRoles: (sim, args) => {
        const found = sim.topology.links.some(l => {
            const a = sim.device(l.aDeviceId), b = sim.device(l.bDeviceId);
            if (!a || !b) return false;
            const ra = roleOf(a), rb = roleOf(b);
            return (ra === args.roleA && rb === args.roleB) || (ra === args.roleB && rb === args.roleA);
        });
        return found ? ok(`Link between a ${args.roleA} and a ${args.roleB} found`) : no(`No cable found between a ${args.roleA} and a ${args.roleB}`);
    },

    allHostsInSubnet: (sim, args) => {
        const prefix = args.prefix ?? 24;
        const min = args.min ?? 2;
        const addressed = hostsOf(sim).filter(d => d.interfaces.some(i => i.ipv4 && isValidIPv4(i.ipv4) && maskToPrefix(i.mask) === prefix));
        if (addressed.length < min) return no(`${addressed.length} host(s) have a /${prefix} address — need ${min}`);
        if (args.network) {
            const inNet = addressed.filter(d => d.interfaces.some(i => i.ipv4 && sameSubnet(i.ipv4, args.network, prefix)));
            return inNet.length >= min ? ok(`${inNet.length} hosts addressed in ${args.network}/${prefix}`) : no(`Only ${inNet.length} host(s) are inside ${args.network}/${prefix}`);
        }
        return ok(`${addressed.length} hosts addressed with /${prefix}`);
    },

    hostsOnSwitch: (sim, args) => {
        const min = args.min ?? 2;
        for (const sw of sim.topology.devices.filter(d => isL2Forwarder(roleOf(d)))) {
            const attached = sim.topology.links.filter(l => l.aDeviceId === sw.id || l.bDeviceId === sw.id)
                .map(l => (l.aDeviceId === sw.id ? l.bDeviceId : l.aDeviceId))
                .filter(id => { const d = sim.device(id); return d && ['host', 'server'].includes(roleOf(d)); });
            if (attached.length >= min) return ok(`${sw.hostname} has ${attached.length} hosts attached`);
        }
        return no(`No switch has ${min} or more hosts attached to it`);
    },

    hostsOnRole: (sim, args) => {
        const min = args.min ?? 2;
        for (const dev of sim.topology.devices.filter(d => roleOf(d) === args.role)) {
            const attached = sim.topology.links.filter(l => l.aDeviceId === dev.id || l.bDeviceId === dev.id).length;
            if (attached >= min) return ok(`${dev.hostname} has ${attached} devices attached`);
        }
        return no(`No ${args.role} has ${min} or more devices attached`);
    },

    anyPingWorks: (sim) => {
        for (const [srcId, dstIp] of pingablePairs(sim)) {
            if (sim.canReach(srcId, dstIp)) {
                const d = sim.device(srcId);
                return ok(`${d?.hostname} can reach ${dstIp}`);
            }
        }
        return no('No host can currently ping another host. Check addressing, masks, cables and gateways.');
    },

    crossSubnetPingWorks: (sim) => {
        const hosts = hostsOf(sim).filter(d => d.interfaces.some(i => i.ipv4 && isValidIPv4(i.ipv4)));
        for (const a of hosts) {
            const ai = a.interfaces.find(i => i.ipv4 && isValidIPv4(i.ipv4))!;
            for (const b of hosts) {
                if (a.id === b.id) continue;
                const bi = b.interfaces.find(i => i.ipv4 && isValidIPv4(i.ipv4))!;
                if (sameSubnet(ai.ipv4, bi.ipv4, ai.mask)) continue;
                if (sim.canReach(a.id, bi.ipv4)) return ok(`${a.hostname} (${ai.ipv4}) reaches ${b.hostname} (${bi.ipv4}) across a router`);
            }
        }
        return no('No ping succeeds between two different subnets yet. Check router interfaces (no shutdown), addresses, and host default gateways.');
    },

    crossVlanPingWorks: (sim) => {
        const byVlan = new Map<number, typeof sim.topology.devices>();
        for (const sw of sim.topology.devices.filter(d => isL2Forwarder(roleOf(d)))) {
            for (const l of sim.topology.links) {
                const isA = l.aDeviceId === sw.id, isB = l.bDeviceId === sw.id;
                if (!isA && !isB) continue;
                const swIf = sw.interfaces.find(i => i.id === (isA ? l.aInterfaceId : l.bInterfaceId));
                const otherId = isA ? l.bDeviceId : l.aDeviceId;
                const other = sim.device(otherId);
                if (!swIf || !other || swIf.mode !== 'access') continue;
                if (!['host', 'server'].includes(roleOf(other))) continue;
                const v = swIf.accessVlan || 1;
                byVlan.set(v, [...(byVlan.get(v) || []), other] as any);
            }
        }
        const vlans = Array.from(byVlan.keys());
        for (const va of vlans) {
            for (const vb of vlans) {
                if (va === vb) continue;
                for (const a of byVlan.get(va)!) {
                    for (const b of byVlan.get(vb)!) {
                        const bi = b.interfaces.find(i => i.ipv4 && isValidIPv4(i.ipv4));
                        if (bi && sim.canReach(a.id, bi.ipv4)) return ok(`${a.hostname} (VLAN ${va}) reaches ${b.hostname} (VLAN ${vb})`);
                    }
                }
            }
        }
        return no('No ping succeeds between two VLANs yet. You need an SVI (or a router sub-interface) per VLAN, and hosts pointing at it as their gateway.');
    },

    crossVlanPingFails: (sim) => {
        const r = LESSON_CHECKS.crossVlanPingWorks(sim, {});
        return r.ok
            ? no('Inter-VLAN traffic is already working — for this task the VLANs should still be isolated.')
            : ok('VLANs are isolated as expected: no Layer-3 device is routing between them yet.');
    },

    multiHopPingWorks: (sim, args) => {
        const minHops = args.minRouterHops ?? 2;
        for (const [srcId, dstIp] of pingablePairs(sim)) {
            const r = sim.ping(srcId, dstIp, { count: 1, quiet: true });
            if (r.ok && r.trace) {
                const routerHops = r.trace.hops.filter(h => h.action === 'route').length;
                if (routerHops >= minHops) {
                    return ok(`${sim.device(srcId)?.hostname} reaches ${dstIp} across ${routerHops} routers`);
                }
            }
        }
        return no(`No end-to-end ping crosses at least ${minHops} routers yet`);
    },

    pingToInternetWorks: (sim) => {
        const cloud = sim.topology.devices.find(d => roleOf(d) === 'cloud');
        if (!cloud) return no('There is no Internet cloud in this topology yet');
        const target = cloud.interfaces.find(i => i.ipv4 && isValidIPv4(i.ipv4))?.ipv4;
        if (!target) return no('The Internet cloud has no IP address on any interface');
        for (const d of hostsOf(sim)) {
            if (sim.canReach(d.id, target)) return ok(`${d.hostname} reaches the Internet at ${target}`);
        }
        return no(`No inside host can reach ${target}. Check the default route on the router and NAT configuration.`);
    },

    pingByNameWorks: (sim) => {
        const servers = sim.topology.devices.filter(d => d.services?.dns?.enabled);
        for (const s of servers) {
            for (const rec of s.services.dns.records) {
                for (const d of hostsOf(sim)) {
                    const r = sim.ping(d.id, rec.name, { count: 1, quiet: true });
                    if (r.ok) return ok(`${d.hostname} pinged ${rec.name} successfully`);
                }
            }
        }
        return no('No host can ping another by name yet. Add an A record, set the client DNS server, then ping the name.');
    },

    traceExists: (sim) => sim.traces.length > 0
        ? ok(`${sim.traces.length} packet trace(s) recorded`)
        : no('No simulation has been run yet — send a ping or fetch a page'),

    traceCount: (sim, args) => sim.traces.length >= (args.min ?? 1)
        ? ok(`${sim.traces.length} traces recorded`)
        : no(`Only ${sim.traces.length} trace(s) — run the simulation at least ${args.min ?? 1} time(s)`),

    macTableEntries: (sim, args) => {
        const min = args.min ?? 1;
        for (const sw of sim.topology.devices.filter(d => isL2Forwarder(roleOf(d)))) {
            if ((sw.macTable?.length || 0) >= min) return ok(`${sw.hostname} has learned ${sw.macTable!.length} MAC addresses`);
        }
        return no(`No switch has learned ${min} MAC address(es) yet — send some traffic first`);
    },

    hasVlans: (sim, args) => {
        const want: number[] = args.vlans || [];
        for (const sw of sim.topology.devices.filter(d => (d.vlans?.length || 0) > 0)) {
            const have = new Set(sw.vlans.map(v => v.id));
            if (want.every(v => have.has(v))) return ok(`${sw.hostname} has VLANs ${want.join(', ')}`);
        }
        return no(`No device has all of VLAN ${want.join(', ')} configured`);
    },

    vlanCount: (sim, args) => {
        const min = args.min ?? 2;
        const ids = new Set<number>();
        for (const d of sim.topology.devices) for (const v of d.vlans || []) ids.add(v.id);
        return ids.size >= min
            ? ok(`${ids.size} VLANs defined: ${Array.from(ids).sort((a, b) => a - b).join(', ')}`)
            : no(`Only ${ids.size} VLAN(s) defined — need at least ${min}`);
    },

    accessPortsInVlans: (sim, args) => {
        const want: number[] = args.vlans || [];
        for (const sw of sim.topology.devices.filter(d => isL2Forwarder(roleOf(d)))) {
            const covered = want.filter(v => sw.interfaces.some(i => i.mode === 'access' && (i.accessVlan || 1) === v));
            if (covered.length === want.length) return ok(`${sw.hostname} has access ports in VLAN ${want.join(' and ')}`);
        }
        return no(`No switch has an access port in each of VLAN ${want.join(', ')}`);
    },

    vlanSubnetsDistinct: (sim) => {
        const vlanSubnet = new Map<number, string>();
        for (const sw of sim.topology.devices.filter(d => isL2Forwarder(roleOf(d)))) {
            for (const l of sim.topology.links) {
                const isA = l.aDeviceId === sw.id, isB = l.bDeviceId === sw.id;
                if (!isA && !isB) continue;
                const swIf = sw.interfaces.find(i => i.id === (isA ? l.aInterfaceId : l.bInterfaceId));
                const other = sim.device(isA ? l.bDeviceId : l.aDeviceId);
                if (!swIf || swIf.mode !== 'access' || !other) continue;
                const oi = other.interfaces.find(i => i.ipv4 && isValidIPv4(i.ipv4));
                if (!oi) continue;
                const net = `${networkOf(oi.ipv4, oi.mask)}/${maskToPrefix(oi.mask)}`;
                const v = swIf.accessVlan || 1;
                const seen = vlanSubnet.get(v);
                if (seen && seen !== net) return no(`VLAN ${v} contains two different subnets (${seen} and ${net}) — one VLAN must map to exactly one subnet`);
                vlanSubnet.set(v, net);
            }
        }
        const nets = Array.from(vlanSubnet.values());
        if (vlanSubnet.size < 2) return no('Fewer than two VLANs have addressed hosts yet');
        if (new Set(nets).size !== nets.length) return no('Two VLANs share the same subnet — give each VLAN its own subnet');
        return ok(`${vlanSubnet.size} VLANs, each with its own subnet: ${Array.from(vlanSubnet.entries()).map(([v, n]) => `VLAN ${v} → ${n}`).join(', ')}`);
    },

    trunkExists: (sim) => {
        for (const d of sim.topology.devices) {
            if (d.interfaces.some(i => i.mode === 'trunk' && sim.allLinks.some(l => l.aInterfaceId === i.id || l.bInterfaceId === i.id))) {
                return ok(`${d.hostname} has a configured trunk`);
            }
        }
        return no('No cabled interface is configured as a trunk yet');
    },

    trunkAllows: (sim, args) => {
        const want: number[] = args.vlans || [];
        for (const d of sim.topology.devices) {
            for (const i of d.interfaces) {
                if (i.mode !== 'trunk') continue;
                if (!i.trunkVlans.length) continue;
                if (want.every(v => i.trunkVlans.includes(v))) return ok(`${d.hostname} ${i.short} allows VLAN ${want.join(', ')}`);
            }
        }
        return no(`No trunk explicitly allows VLAN ${want.join(' and ')} — use "switchport trunk allowed vlan ${want.join(',')}"`);
    },

    sviCount: (sim, args) => {
        const min = args.min ?? 1;
        for (const d of sim.topology.devices) {
            const svis = d.interfaces.filter(i => i.sviVlan && i.ipv4 && isValidIPv4(i.ipv4));
            if (svis.length >= min) return ok(`${d.hostname} has ${svis.length} addressed SVIs (${svis.map(s => s.short).join(', ')})`);
        }
        return no(`No device has ${min} addressed SVIs — use "interface vlan <id>" then "ip address ..."`);
    },

    gatewaysCorrect: (sim) => {
        const hosts = hostsOf(sim).filter(d => d.interfaces.some(i => i.ipv4 && isValidIPv4(i.ipv4)));
        if (!hosts.length) return no('No addressed hosts yet');
        const bad = hosts.filter(d => {
            const gw = d.host?.defaultGateway;
            if (!gw || !isValidIPv4(gw)) return true;
            return !d.interfaces.some(i => i.ipv4 && isValidIPv4(i.ipv4) && sameSubnet(i.ipv4, gw, i.mask));
        });
        return bad.length === 0
            ? ok(`All ${hosts.length} hosts have a gateway inside their own subnet`)
            : no(`${bad.map(d => d.hostname).join(', ')} ${bad.length === 1 ? 'has' : 'have'} a missing or out-of-subnet default gateway`);
    },

    routerWithTwoSubnets: (sim) => {
        for (const d of sim.topology.devices.filter(x => isL3Forwarder(roleOf(x)))) {
            const nets = new Set(d.interfaces.filter(i => i.ipv4 && isValidIPv4(i.ipv4)).map(i => `${networkOf(i.ipv4, i.mask)}/${maskToPrefix(i.mask)}`));
            if (nets.size >= 2) return ok(`${d.hostname} has interfaces in ${nets.size} subnets: ${Array.from(nets).join(', ')}`);
        }
        return no('No router has addressed interfaces in two different subnets yet');
    },

    routerInterfacesUp: (sim) => {
        const routers = sim.topology.devices.filter(d => isL3Forwarder(roleOf(d)) && roleOf(d) !== 'cloud');
        if (!routers.length) return no('No router in the topology');
        const down: string[] = [];
        for (const r of routers) {
            for (const i of r.interfaces) {
                const cabled = sim.allLinks.some(l => l.aInterfaceId === i.id || l.bInterfaceId === i.id);
                if (cabled && !i.enabled) down.push(`${r.hostname} ${i.short}`);
            }
        }
        return down.length === 0
            ? ok('Every cabled router interface is administratively up')
            : no(`Still shut down: ${down.join(', ')} — run "no shutdown"`);
    },

    staticRouteCount: (sim, args) => {
        const total = sim.topology.devices.reduce((n, d) => n + (d.routing?.staticRoutes?.length || 0), 0);
        return total >= (args.min ?? 1) ? ok(`${total} static route(s) configured`) : no(`Only ${total} static route(s) — need ${args.min ?? 1}`);
    },

    defaultRouteExists: (sim) => {
        for (const d of sim.topology.devices) {
            if (d.routing?.defaultGateway && isValidIPv4(d.routing.defaultGateway)) return ok(`${d.hostname} has a default gateway of ${d.routing.defaultGateway}`);
            if (d.routing?.staticRoutes?.some(r => r.network === '0.0.0.0')) return ok(`${d.hostname} has a default route (0.0.0.0/0)`);
        }
        return no('No router has a default route yet — add "ip route 0.0.0.0 0.0.0.0 <next-hop>"');
    },

    routingProtocolCount: (sim, args) => {
        const min = args.min ?? 1;
        const list = sim.topology.devices.filter(d =>
            args.proto === 'ospf' ? d.routing?.ospf?.enabled : d.routing?.rip?.enabled);
        return list.length >= min
            ? ok(`${args.proto.toUpperCase()} is enabled on ${list.map(d => d.hostname).join(', ')}`)
            : no(`${args.proto.toUpperCase()} is enabled on ${list.length} device(s) — need ${min}`);
    },

    learnedRoutesExist: (sim) => {
        for (const d of sim.topology.devices) {
            if ((d.routing?.learned?.length || 0) > 0) {
                return ok(`${d.hostname} has learned ${d.routing!.learned!.length} route(s) dynamically`);
            }
        }
        return no('No router has learned a route dynamically yet. Enable the protocol on both ends and make sure the interfaces are up and addressed.');
    },

    stpBlocking: (sim, args) => {
        const blocked = sim.allLinks.filter(l => l.status === 'blocked').length;
        return blocked >= (args.min ?? 1)
            ? ok(`Spanning tree has blocked ${blocked} redundant port(s)`)
            : no('No port is blocking. Add a redundant link between switches to create a loop for STP to break.');
    },

    noStpBlocking: (sim) => {
        const blocked = sim.allLinks.filter(l => l.status === 'blocked').length;
        return blocked === 0 ? ok('No port is blocking — every link is carrying traffic') : no(`${blocked} port(s) are blocking. In a leaf-spine fabric every link should be active (routed, not switched).`);
    },

    switchLoopExists: (sim) => {
        const switches = sim.topology.devices.filter(d => isL2Forwarder(roleOf(d)));
        const swIds = new Set(switches.map(s => s.id));
        const swLinks = sim.topology.links.filter(l => swIds.has(l.aDeviceId) && swIds.has(l.bDeviceId));
        // A tree over N nodes has N-1 edges; anything more means a cycle exists.
        const hasCycle = swLinks.length >= switches.length;
        return switches.length >= 3 && hasCycle
            ? ok(`${switches.length} switches with ${swLinks.length} inter-switch links — more links than a tree needs, so there is a loop`)
            : no(`Need at least 3 switches and a redundant path between them (currently ${switches.length} switches, ${swLinks.length} inter-switch links — a loop needs at least ${switches.length})`);
    },

    rootBridgePriorityLowered: (sim) => {
        const d = sim.topology.devices.find(x => isL2Forwarder(roleOf(x)) && (x.stp?.priority ?? 32768) < 32768);
        return d ? ok(`${d.hostname} has priority ${d.stp!.priority}${d.stp!.isRoot ? ' and is the root bridge' : ''}`)
            : no('No switch has a lowered bridge priority — use "spanning-tree vlan 1 priority 4096"');
    },

    dhcpPoolComplete: (sim) => {
        for (const d of sim.topology.devices) {
            for (const p of d.services?.dhcp?.pools || []) {
                if (p.rangeStart && p.rangeEnd && p.gateway && p.mask) {
                    return ok(`${d.hostname} pool "${p.name}" is complete (${p.rangeStart}–${p.rangeEnd}, gateway ${p.gateway}${p.dnsServer ? `, DNS ${p.dnsServer}` : ''})`);
                }
            }
        }
        return no('No DHCP pool has a range, mask and gateway configured');
    },

    dhcpLeaseObtained: (sim) => {
        for (const d of sim.topology.devices) {
            const leases = d.services?.dhcp?.leases || [];
            if (leases.length) return ok(`${d.hostname} has issued ${leases.length} lease(s): ${leases.map(l => `${l.hostname} → ${l.ip}`).join(', ')}`);
        }
        return no('No DHCP lease has been issued yet. Set a client interface to DHCP and click "Request DHCP" (or run ipconfig /renew).');
    },

    dnsRecordExists: (sim) => {
        for (const d of sim.topology.devices) {
            if (d.services?.dns?.enabled && (d.services.dns.records?.length || 0) > 0) {
                return ok(`${d.hostname} is authoritative for ${d.services.dns.records.map(r => r.name).join(', ')}`);
            }
        }
        return no('No DNS server has an A record yet');
    },

    clientHasDns: (sim) => {
        const d = hostsOf(sim).find(x => x.host?.dnsServer && isValidIPv4(x.host.dnsServer));
        return d ? ok(`${d.hostname} uses DNS server ${d.host.dnsServer}`) : no('No client has a DNS server configured');
    },

    dnsResolves: (sim) => {
        for (const s of sim.topology.devices.filter(d => d.services?.dns?.enabled)) {
            for (const rec of s.services.dns.records) {
                for (const c of hostsOf(sim)) {
                    const r = sim.dnsResolve(c.id, rec.name, { quiet: true });
                    if (r.ok) return ok(`${c.hostname} resolved ${rec.name} → ${r.ip}`);
                }
            }
        }
        return no('No client can resolve a name yet. Check the client DNS setting and that it can reach the DNS server.');
    },

    httpServerExists: (sim) => {
        const d = sim.topology.devices.find(x => x.services?.http?.enabled && x.interfaces.some(i => i.ipv4 && isValidIPv4(i.ipv4)));
        return d ? ok(`${d.hostname} is serving HTTP on port ${d.services.http.port}`) : no('No addressed device has the HTTP service enabled');
    },

    httpWorks: (sim) => {
        const servers = sim.topology.devices.filter(d => d.services?.http?.enabled);
        for (const s of servers) {
            const ip = s.interfaces.find(i => i.ipv4 && isValidIPv4(i.ipv4))?.ipv4;
            if (!ip) continue;
            for (const c of hostsOf(sim)) {
                if (c.id === s.id) continue;
                const r = sim.httpGet(c.id, `http://${ip}`);
                if (r.ok) return ok(`${c.hostname} fetched http://${ip} — ${r.status} OK`);
            }
        }
        return no('No client can fetch a page yet. Enable HTTP on a server, address it, and make sure the client can reach it.');
    },

    natConfigured: (sim) => {
        for (const d of sim.topology.devices) {
            if (!d.nat?.enabled) continue;
            const hasInside = d.interfaces.some(i => i.natRole === 'inside');
            const hasOutside = d.interfaces.some(i => i.natRole === 'outside');
            if (hasInside && hasOutside) return ok(`${d.hostname} has NAT ${d.nat.mode.toUpperCase()} with inside and outside interfaces marked`);
            return no(`${d.hostname} has NAT enabled but is missing ${!hasInside ? 'an inside' : 'an outside'} interface`);
        }
        return no('No device has NAT enabled');
    },

    natTranslationExists: (sim) => {
        for (const d of sim.topology.devices) {
            if ((d.nat?.translations?.length || 0) > 0) {
                return ok(`${d.hostname} has ${d.nat!.translations!.length} active translation(s)`);
            }
        }
        return no('The NAT table is empty. Send traffic from an inside host to a public address first.');
    },

    internetPresent: (sim) => {
        const c = sim.topology.devices.find(d => roleOf(d) === 'cloud');
        return c ? ok(`${c.hostname} represents the Internet`) : no('Add an Internet cloud from the Cloud section of the palette');
    },

    cloudPresent: (sim) => LESSON_CHECKS.internetPresent(sim, {}),

    modemPresent: (sim) => {
        const m = sim.topology.devices.find(d => roleOf(d) === 'modem');
        return m ? ok(`${m.hostname} provides the last-mile connection`) : no('Add a modem or ONT from the WAN & Access section');
    },

    serialLinkExists: (sim) => {
        const l = sim.topology.links.find(x => x.cable === 'serial-dce' || x.cable === 'serial-dte');
        return l ? ok('A serial WAN link is in place') : no('No serial link yet — connect two Serial interfaces on branch routers');
    },

    hasPointToPointLink: (sim) => {
        for (const d of sim.topology.devices) {
            for (const i of d.interfaces) {
                if (i.ipv4 && isValidIPv4(i.ipv4) && maskToPrefix(i.mask) >= 30) {
                    return ok(`${d.hostname} ${i.short} uses ${i.ipv4}/${maskToPrefix(i.mask)} — a proper point-to-point prefix`);
                }
            }
        }
        return no('No interface uses a /30 or /31 — use one on a router-to-router link');
    },

    subnetCount: (sim, args) => {
        const nets = new Set<string>();
        for (const d of sim.topology.devices) {
            for (const i of d.interfaces) {
                if (i.ipv4 && isValidIPv4(i.ipv4)) nets.add(`${networkOf(i.ipv4, i.mask)}/${maskToPrefix(i.mask)}`);
            }
        }
        return nets.size >= (args.min ?? 2)
            ? ok(`${nets.size} distinct subnets: ${Array.from(nets).join(', ')}`)
            : no(`Only ${nets.size} subnet(s) — need at least ${args.min ?? 2}`);
    },

    ipv6Configured: (sim, args) => {
        const count = sim.topology.devices.reduce((n, d) => n + d.interfaces.filter(i => i.ipv6).length, 0);
        return count >= (args.min ?? 1) ? ok(`${count} interface(s) have an IPv6 address`) : no(`Only ${count} interface(s) have IPv6 — need ${args.min ?? 1}`);
    },

    apWithSsid: (sim) => {
        const ap = sim.topology.devices.find(d => roleOf(d) === 'ap' && d.wireless?.ssid);
        return ap ? ok(`${ap.hostname} is broadcasting "${ap.wireless!.ssid}"`) : no('No access point with an SSID configured');
    },

    apUplinked: (sim) => {
        for (const ap of sim.topology.devices.filter(d => roleOf(d) === 'ap')) {
            const wired = ap.interfaces.filter(i => i.medium === 'copper-ethernet' || i.medium === 'sfp' || i.medium === 'poe');
            if (wired.some(i => sim.topology.links.some(l => l.aInterfaceId === i.id || l.bInterfaceId === i.id))) {
                return ok(`${ap.hostname} is cabled into the wired network`);
            }
        }
        return no('No access point has a wired uplink. An AP is a bridge — it needs a cable to the switch.');
    },

    wirelessClientsAssociated: (sim, args) => {
        const min = args.min ?? 1;
        const assoc = sim.allLinks.filter(l => l.cable === 'wireless' || l.cable === 'cellular');
        return assoc.length >= min
            ? ok(`${assoc.length} wireless client(s) associated`)
            : no(`Only ${assoc.length} client(s) associated — need ${min}. Set a matching SSID and passphrase on the client radio.`);
    },

    wirelessSecure: (sim) => {
        const aps = sim.topology.devices.filter(d => d.wireless);
        if (!aps.length) return no('No wireless device in the topology');
        const bad = aps.filter(d => d.wireless!.security === 'open' || d.wireless!.security === 'wep');
        return bad.length === 0
            ? ok(`All ${aps.length} SSIDs use WPA2 or WPA3`)
            : no(`${bad.map(d => d.hostname).join(', ')} still use${bad.length === 1 ? 's' : ''} open or WEP security`);
    },

    wirelessVlanMapped: (sim) => {
        const d = sim.topology.devices.find(x => x.wireless?.vlanId);
        return d ? ok(`${d.hostname} maps SSID "${d.wireless!.ssid}" into VLAN ${d.wireless!.vlanId}`)
            : no('No SSID is mapped to a VLAN yet — set the VLAN in the wireless settings');
    },

    aclRuleCount: (sim, args) => {
        const min = args.min ?? 1;
        for (const d of sim.topology.devices) {
            for (const a of d.acls || []) {
                if (a.rules.length >= min) return ok(`${d.hostname} ACL ${a.name} has ${a.rules.length} rules`);
            }
        }
        return no(`No ACL has ${min} or more rules`);
    },

    aclApplied: (sim) => {
        for (const d of sim.topology.devices) {
            for (const i of d.interfaces) {
                if (i.aclIn) return ok(`${d.hostname} applies ACL ${i.aclIn} inbound on ${i.short}`);
                if (i.aclOut) return ok(`${d.hostname} applies ACL ${i.aclOut} outbound on ${i.short}`);
            }
        }
        return no('No ACL is applied to an interface. Creating it is not enough — use "ip access-group <name> in".');
    },

    aclBlocksSomething: (sim) => {
        const applied = sim.topology.devices.some(d => d.interfaces.some(i => i.aclIn || i.aclOut));
        if (!applied) return no('No ACL is applied to an interface yet');
        for (const [srcId, dstIp] of pingablePairs(sim)) {
            const r = sim.ping(srcId, dstIp, { count: 1, quiet: true });
            if (!r.ok && r.trace?.hops.some(h => h.action === 'acl-deny')) {
                return ok(`${sim.device(srcId)?.hostname} → ${dstIp} is correctly denied by an ACL`);
            }
        }
        return no('The ACL is applied but nothing is being denied. Check the rules, the direction, and that a permit line is not matching first.');
    },

    firewallThreeZones: (sim) => {
        for (const d of sim.topology.devices.filter(x => roleOf(x) === 'firewall')) {
            const used = d.interfaces.filter(i => sim.topology.links.some(l => l.aInterfaceId === i.id || l.bInterfaceId === i.id) && i.ipv4);
            if (used.length >= 3) return ok(`${d.hostname} has ${used.length} addressed, cabled interfaces (inside / outside / DMZ)`);
        }
        return no('No firewall has three addressed and cabled interfaces yet');
    },

    dmzServerExists: (sim) => {
        for (const fw of sim.topology.devices.filter(d => roleOf(d) === 'firewall')) {
            for (const i of fw.interfaces) {
                if (!i.ipv4 || !isValidIPv4(i.ipv4)) continue;
                const srv = sim.topology.devices.find(d =>
                    d.services?.http?.enabled &&
                    d.interfaces.some(x => x.ipv4 && isValidIPv4(x.ipv4) && sameSubnet(x.ipv4, i.ipv4, i.mask)));
                if (srv) return ok(`${srv.hostname} is a published server on the ${networkOf(i.ipv4, i.mask)}/${maskToPrefix(i.mask)} segment`);
            }
        }
        return no('No web server sits on a firewall-attached segment yet');
    },

    iotSegmented: (sim) => {
        const iot = sim.topology.devices.filter(d => getDeviceType(d.typeId)?.category === 'iot' || d.typeId === 'ip-camera');
        if (!iot.length) return no('No IoT or camera devices in the topology');
        const iotNets = new Set<string>();
        const otherNets = new Set<string>();
        for (const d of sim.topology.devices) {
            const isIot = iot.some(x => x.id === d.id);
            for (const i of d.interfaces) {
                if (!i.ipv4 || !isValidIPv4(i.ipv4)) continue;
                const n = `${networkOf(i.ipv4, i.mask)}/${maskToPrefix(i.mask)}`;
                if (isIot) iotNets.add(n);
                else if (['host', 'server'].includes(roleOf(d))) otherNets.add(n);
            }
        }
        const overlap = Array.from(iotNets).filter(n => otherNets.has(n));
        return overlap.length === 0 && iotNets.size > 0
            ? ok(`IoT devices live in ${Array.from(iotNets).join(', ')}, separate from the corporate subnets`)
            : no(`IoT shares subnet ${overlap.join(', ')} with corporate hosts — move it into its own VLAN and subnet`);
    },

    leafSpineBuilt: (sim) => {
        const spines = sim.topology.devices.filter(d => d.typeId === 'switch-spine');
        const leaves = sim.topology.devices.filter(d => d.typeId === 'switch-leaf');
        if (spines.length < 2 || leaves.length < 2) return no(`Need at least 2 spines and 2 leaves (have ${spines.length} spines, ${leaves.length} leaves)`);
        for (const leaf of leaves) {
            const connectedSpines = new Set(sim.topology.links
                .filter(l => l.aDeviceId === leaf.id || l.bDeviceId === leaf.id)
                .map(l => (l.aDeviceId === leaf.id ? l.bDeviceId : l.aDeviceId))
                .filter(id => spines.some(s => s.id === id)));
            if (connectedSpines.size < spines.length) {
                return no(`${leaf.hostname} is only connected to ${connectedSpines.size} of ${spines.length} spines — every leaf must reach every spine`);
            }
        }
        return ok(`${leaves.length} leaves each fully meshed to ${spines.length} spines`);
    },

    virtualHostsPresent: (sim) => {
        const v = sim.topology.devices.filter(d => ['hypervisor', 'container-host', 'k8s-node'].includes(d.typeId));
        return v.length >= 2 ? ok(`${v.map(d => d.hostname).join(', ')} present`) : no(`Need a hypervisor and a container/Kubernetes node (have ${v.length})`);
    },

    noErrors: (sim) => {
        const issues = sim.validate().filter(i => i.severity === 'error');
        return issues.length === 0
            ? ok('No errors in the Issues panel')
            : no(`${issues.length} error(s) remain: ${issues.slice(0, 3).map(i => i.title).join('; ')}${issues.length > 3 ? '…' : ''}`);
    },

    noIssuesAtAll: (sim) => {
        const issues = sim.validate().filter(i => i.severity !== 'hint');
        return issues.length === 0
            ? ok('Clean topology — no errors and no warnings')
            : no(`${issues.length} issue(s) remain: ${issues.slice(0, 3).map(i => i.title).join('; ')}${issues.length > 3 ? '…' : ''}`);
    },
};

function networkOf(ip: string, mask: string): string {
    try {
        const p = maskToPrefix(mask);
        const parts = ip.split('.').map(Number);
        const n = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
        const m = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
        const v = (n & m) >>> 0;
        return `${(v >>> 24) & 255}.${(v >>> 16) & 255}.${(v >>> 8) & 255}.${v & 255}`;
    } catch { return ip; }
}

/* ══════════════════════════ public helpers ══════════════════════════ */

export function runCheck(sim: Simulator, check: string, args: Record<string, any> = {}): CheckResult {
    const fn = LESSON_CHECKS[check];
    if (!fn) return no(`No validator named "${check}" — this task cannot be auto-checked.`);
    try {
        return fn(sim, args);
    } catch (e: any) {
        return no(`Check failed to run: ${e?.message || e}`);
    }
}

export function gradeLesson(sim: Simulator, lesson: Lesson): {
    passed: number; total: number; score: number; results: Array<{ task: string; ok: boolean; message: string; id: string }>;
} {
    const results = lesson.tasks.map(t => {
        const r = runCheck(sim, t.check, t.args || {});
        return { id: t.id, task: t.text, ok: r.ok, message: r.message };
    });
    const passed = results.filter(r => r.ok).length;
    return { passed, total: results.length, score: results.length ? Math.round((passed / results.length) * 100) : 0, results };
}

export function lessonsByTrack(trackId: string): Lesson[] {
    return LESSONS.filter(l => l.trackId === trackId).sort((a, b) => a.order - b.order);
}

export function getLesson(id: string): Lesson | undefined {
    return LESSONS.find(l => l.id === id);
}

export function nextLesson(id: string): Lesson | undefined {
    const idx = LESSONS.findIndex(l => l.id === id);
    return idx >= 0 && idx < LESSONS.length - 1 ? LESSONS[idx + 1] : undefined;
}

export const TOTAL_LESSONS = LESSONS.length;
export const TOTAL_MINUTES = LESSONS.reduce((n, l) => n + l.minutes, 0);

export const BADGES: Array<{ id: string; title: string; description: string; icon: string; requires: (progress: { completedLessons: string[]; xp: number }) => boolean }> = [
    { id: 'first-packet', title: 'First Packet', description: 'Complete your first lesson', icon: 'zap', requires: p => p.completedLessons.length >= 1 },
    { id: 'frame-wrangler', title: 'Frame Wrangler', description: 'Finish the Ethernet & Switching track', icon: 'switch', requires: p => lessonsByTrack('ethernet').every(l => p.completedLessons.includes(l.id)) },
    { id: 'vlan-master', title: 'VLAN Master', description: 'Finish the VLANs & Trunking track', icon: 'vlan', requires: p => lessonsByTrack('vlans').every(l => p.completedLessons.includes(l.id)) },
    { id: 'subnet-surgeon', title: 'Subnet Surgeon', description: 'Finish the IP Addressing track', icon: 'ip', requires: p => lessonsByTrack('addressing').every(l => p.completedLessons.includes(l.id)) },
    { id: 'route-finder', title: 'Route Finder', description: 'Finish the Routing track', icon: 'router', requires: p => lessonsByTrack('routing').every(l => p.completedLessons.includes(l.id)) },
    { id: 'service-owner', title: 'Service Owner', description: 'Finish the Core Network Services track', icon: 'server', requires: p => lessonsByTrack('services').every(l => p.completedLessons.includes(l.id)) },
    { id: 'airtime-architect', title: 'Airtime Architect', description: 'Finish the Wireless track', icon: 'ap', requires: p => lessonsByTrack('wireless').every(l => p.completedLessons.includes(l.id)) },
    { id: 'gatekeeper', title: 'Gatekeeper', description: 'Finish the Security track', icon: 'firewall', requires: p => lessonsByTrack('security').every(l => p.completedLessons.includes(l.id)) },
    { id: 'fabric-builder', title: 'Fabric Builder', description: 'Finish the Data Center & Cloud track', icon: 'vm', requires: p => lessonsByTrack('datacenter').every(l => p.completedLessons.includes(l.id)) },
    { id: 'fault-finder', title: 'Fault Finder', description: 'Finish the Troubleshooting track', icon: 'wrench', requires: p => lessonsByTrack('troubleshooting').every(l => p.completedLessons.includes(l.id)) },
    { id: 'complete', title: 'Network Engineer', description: 'Complete every lesson in every track', icon: 'award', requires: p => LESSONS.every(l => p.completedLessons.includes(l.id)) },
];
