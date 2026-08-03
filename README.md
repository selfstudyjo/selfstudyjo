# selfstudy2026

Vue 3 + TypeScript + Vite frontend for Self Study JO. Deployed to GitHub Pages.

```
npm install
npm run dev      # port 3000
npm run build    # also copies dist/index.html to dist/404.html for SPA deep links
npm run deploy   # gh-pages -d dist
```

Every backend base URL is resolved at runtime through the **SelfStudy Domains registry**
(`src/services/config.ts`). Never hardcode a PythonAnywhere replica.

---

## Network Simulator

A full network-building studio gated behind the `lab_feature` subscription feature.
Students drag real devices onto a canvas, cable them, configure them with real Cisco-style
CLI syntax, then send a packet and follow it hop by hop with every header exposed.

### Routes

| Path | View | Purpose |
|------|------|---------|
| `/network-simulator` | `NetworkSimulator.vue` | Project hub, templates, community networks, progress |
| `/network-simulator/learn` | `NetworkSimulatorLearn.vue` | 30-lesson curriculum across 11 tracks |
| `/network-simulator/studio/:id?` | `NetworkSimulatorStudio.vue` | The studio itself |

Query parameters on the studio route: `?template=<id>` starts from a template,
`?lesson=<id>` attaches a lesson so its tasks are checked live.

### What the engine actually models

`src/netsim/` is framework-free TypeScript — no Vue, no DOM — so it can be unit tested
and reasoned about on its own.

| File | Responsibility |
|------|----------------|
| `types.ts` | Every data structure; all JSON-serialisable |
| `ip.ts` | IPv4/IPv6/MAC maths: masks, subnetting, VLSM, EUI-64, checksums |
| `devices.ts` | 76 device types from a 10BASE-T hub to a Wi-Fi 7 AP and a GPU compute node |
| `packet.ts` | PDU construction with honest per-layer encapsulation and field-level hints |
| `engine.ts` | The simulator (see below) |
| `cli.ts` | Cisco IOS-style CLI for infrastructure, Windows-style shell for hosts |
| `topology.ts` | Device/link factories, validation, auto-layout, import/export, 13 templates, AI-spec → topology |
| `lessons.ts` | 11 tracks, 30 lessons, and ~45 machine validators that grade against the live network |

The engine covers:

- **L1** link and power state, media compatibility, duplex/speed mismatch, cable types
- **L2** MAC learning, unicast forwarding vs flooding, 802.1Q access/trunk/native VLANs,
  802.11 association with WPA2/WPA3 key checking, STP root election and port blocking
- **L3** connected/static/default routes, RIP and OSPF convergence, longest-prefix match,
  administrative distance, TTL decrement, ICMP, NAT/PAT, stateless ACLs, **stateful**
  firewall session tracking
- **L4** TCP three-way handshake and teardown, UDP, port semantics, RST vs timeout
- **L7** DHCP (full DORA with relays and APIPA fallback), DNS, HTTP/HTTPS, TLS 1.3

Every forwarding decision produces a `SimEvent` and a `Hop` carrying the PDU *as it left
that device*, which is what lets the Packet Inspector show a MAC address being rewritten
while the IP address stays put.

### Data storage

Projects, profiles and learning progress are stored as JSON files in a dedicated repo:
**`selfstudyjo/selfstudynetworksimulator_data`**.

```
users/<username>/profile.json                 preferences + counters
users/<username>/progress.json                lessons, scores, badges, XP
users/<username>/projects/index.json          lightweight project list
users/<username>/projects/<projectId>.json    the full project + topology
users/<username>/ai/<sessionId>.json          saved AI conversations
shared/index.json                             community-shared projects
shared/<projectId>.json
```

`src/services/netsim-storage.service.ts` talks to the GitHub Contents API. It serialises
writes per path, retries once on a stale SHA, and mirrors everything into `localStorage`.
**If the token is missing or the repo is unreachable the studio still works** — it just
stops syncing and says so in the UI.

### Environment

```
VITE_NETSIM_GITHUB_TOKEN=      # fine-grained PAT, Contents: Read and write, that repo only
VITE_NETSIM_DATA_OWNER=selfstudyjo
VITE_NETSIM_DATA_REPO=selfstudynetworksimulator_data
VITE_NETSIM_DATA_BRANCH=main
VITE_NETSIM_AI_APP_ID=27       # Self Study AI backend, resolved through the registry
```

> **Security note.** Anything in a `VITE_*` variable is compiled into the JavaScript bundle
> and is readable by anyone who loads the page. A write-capable PAT here can be extracted
> and used to write to (or delete from) the data repo directly. Scope the token to that one
> repository and nothing else, and treat its contents as public. The durable fix is a small
> backend endpoint that holds the token server-side and proxies the reads and writes; the
> storage service is deliberately the only file that would need to change.

### AI tutor

`src/services/netsim-ai.service.ts` calls the Self Study AI backend (app 27) through the
registry with five separate system prompts: teach, generate a topology as strict JSON,
review a design, troubleshoot a symptom using the real event log, and explain one captured
hop. Generated topologies go through `topologyFromAiSpec()`, which validates and repairs the
model's output (type aliases, port allocation, wireless credential matching) and reports
what it had to fix.
