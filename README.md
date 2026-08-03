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

### Storage modes

`src/services/netsim-storage.service.ts` runs in one of three modes:

| Mode | How | Use it for |
|------|-----|-----------|
| `proxy` | Discovered through the sfsdomains registry (Self Study AI, app 27); the backend holds the GitHub token **server-side** | Production, real multi-user sync |
| `token` | An operator pastes a token under **Storage settings**; it is kept in that browser's `localStorage` | Admin work, local development |
| `local` | No credentials at all | Default. Fully functional, no cross-device sync |

In every mode writes are serialised per path, a stale SHA is retried once, and
everything is mirrored into `localStorage` — so work is never lost to a network
problem, and the studio degrades to `local` rather than breaking.

> **There is deliberately no build-time token.** Anything in a `VITE_*` variable is
> compiled into the published JavaScript bundle. A write-capable GitHub PAT there can
> be read by anyone who loads the page, and GitHub's push protection rejects the
> deploy outright — which is the correct outcome, not an obstacle to work around.
> Never use the "allow this secret" link for a credential in a public bundle.

### Why GitHub repo secrets / variables do NOT solve this

A repo secret is injected into the **build runner**, not into the browser. A Vite app has
no server at runtime, so any value the browser needs ends up as a literal in
`dist/assets/*.js` — whether it came from `.env`, an Actions secret, or a repo variable.
The bundle is published, so the credential is published. Push protection blocks it either
way, and bypassing that block makes the token readable by every visitor.

Repo secrets keep a value out of your *source*. They cannot keep it out of your *output*.
The only place a credential can live is somewhere the browser never sees it: a backend.

`vite.config.ts` enforces this — the build fails if any `VITE_*` value matches a known
credential pattern, or if a URL-only variable such as `VITE_NETSIM_STORAGE_PROXY` holds
something that is not an http(s) URL.

### The proxy contract

`proxy` mode needs no frontend configuration: the storage service resolves the
Self Study AI replicas through the registry, probes `/api/netsim/health` on each,
and switches itself on when one answers. No replica URL is ever hardcoded.
`VITE_NETSIM_STORAGE_PROXY` exists only as a local-development override.

The routes live in `selfstudyai/netsim_storage.py` and are registered from
`app.py`. All of them take the usual `Authorization: Token <AUTH_TOKEN>` header.

```
GET    /api/netsim/file?path=<repo/path.json>   -> { data: <json>, sha }   | 404 if absent
PUT    /api/netsim/file                          <- { path, data, message } -> { ok, sha }
DELETE /api/netsim/file?path=<repo/path.json>    -> { ok }
GET    /api/netsim/dir?path=<repo/dir>           -> { entries: [...] }
GET    /api/netsim/health                        -> { ok, canWrite, repo, branch }
```

The backend performs the GitHub Contents API calls with its own token. The frontend
never sees a GitHub credential.

Backend environment (per replica): `NETSIM_GITHUB_TOKEN` (falls back to
`GITHUB_TOKEN`), plus optional `NETSIM_REPO_OWNER`, `NETSIM_REPO_NAME`,
`NETSIM_BRANCH`. Paths are confined to `users/**` and `shared/**`, records are
capped at 4 MB, and a stale SHA is retried once.

### Environment

```
VITE_NETSIM_STORAGE_PROXY=     # local-dev override only; blank in production (registry discovery)
VITE_NETSIM_DATA_OWNER=selfstudyjo
VITE_NETSIM_DATA_REPO=selfstudynetworksimulator_data
VITE_NETSIM_DATA_BRANCH=main
VITE_NETSIM_AI_APP_ID=27       # Self Study AI backend, resolved through the registry
```

### AI tutor

`src/services/netsim-ai.service.ts` calls the Self Study AI backend (app 27) through the
registry with five separate system prompts: teach, generate a topology as strict JSON,
review a design, troubleshoot a symptom using the real event log, and explain one captured
hop. Generated topologies go through `topologyFromAiSpec()`, which validates and repairs the
model's output (type aliases, port allocation, wireless credential matching) and reports
what it had to fix.
