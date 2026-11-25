// npm run check:netsimquick - the network builder's fast path (src/netsim/quickBuild.ts).
// Every request below is parsed, built, turned into a real topology by the same converter the
// assistant uses (topologyFromAiSpec), and then the simulator is asked whether every host can
// reach every other host. A design that "looks right" but cannot ping is a failure here.
import { parseNetworkRequest, buildQuickSpec, cleanParams } from '../../src/netsim/quickBuild';
import { topologyFromAiSpec } from '../../src/netsim/topology';
import { createSimulator } from '../../src/netsim/engine';
import { parseEditRequest, applyEdit, isEditRequest } from '../../src/netsim/quickEdit';

let pass = 0, fail = 0;
const ok = (cond: unknown, msg: string) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };

const CASES: Array<{ text: string; devices?: number; routers?: number; vlans?: number; ping?: boolean }> = [
    { text: 'build network from 10 devices and connected together', devices: 10, ping: true },
    { text: 'build a good network from 5 devices', devices: 5, ping: true },
    { text: 'a network of three devices', devices: 3, ping: true },
    { text: '2 routers, 3 switches and 12 PCs', routers: 2, ping: true },
    { text: 'one router, one switch, 8 computers and a server with internet', ping: true },
    { text: 'office with 2 switches, 20 pcs, 2 printers, VLANs 10, 20 and 30, internet', vlans: 3, ping: true },
    { text: '3 vlans with 12 pcs', vlans: 3, ping: true },
    { text: 'small wifi network: 1 router, 1 switch, 1 access point, 4 laptops, 2 phones', ping: true },
    { text: '4 routers connected with OSPF, each with a switch and 3 PCs', routers: 4, ping: true },
    { text: 'build 10 devices network with dhcp', devices: 10, ping: false },
    { text: 'شبكة من 6 أجهزة', devices: 6, ping: true },
];

for (const c of CASES) {
    const p = parseNetworkRequest(c.text);
    ok(p, `parse: ${c.text}`);
    if (!p) continue;
    const spec = buildQuickSpec(p);
    if (c.devices) ok(spec.devices.length === c.devices, `${c.text}: ${spec.devices.length} devices, wanted ${c.devices}`);
    if (c.routers) ok(spec.devices.filter((d) => d.type.startsWith('router')).length === c.routers, `${c.text}: router count`);
    if (c.vlans) ok(p.vlans.length === c.vlans, `${c.text}: ${p.vlans.length} VLANs`);
    const built = topologyFromAiSpec(spec);
    ok(built.ok && built.topology, `${c.text}: converts (${built.reason || ''})`);
    ok(built.warnings.length === 0, `${c.text}: no warnings (${built.warnings.join(' | ')})`);
    if (!built.topology) continue;
    ok(built.topology.links.length === spec.links.length, `${c.text}: every link placed (${built.topology.links.length}/${spec.links.length})`);
    // Every device is connected to something.
    const linked = new Set(built.topology.links.flatMap((l) => [l.aDeviceId, l.bDeviceId]));
    ok(built.topology.devices.every((d) => linked.has(d.id) || built.topology!.devices.length === 1 || d.interfaces.some((i) => i.medium === 'wireless' && i.ssid)), `${c.text}: every device connected`);
    if (!c.ping) continue;
    const sim = createSimulator(built.topology);
    const hosts = built.topology.devices.filter((d) => ['pc', 'laptop', 'server-generic', 'printer', 'smartphone'].includes(d.typeId));
    const ipOf = (d: typeof hosts[number]) => d.interfaces.find((i) => i.ipv4)?.ipv4 || '';
    let bad = 0;
    for (const a of hosts) for (const b of hosts) {
        if (a === b || !ipOf(b)) continue;
        if (!sim.canReach(a.id, ipOf(b))) { bad++; if (bad <= 3) console.log('   no path', a.hostname, '->', b.hostname, ipOf(b)); }
    }
    ok(bad === 0, `${c.text}: every host reaches every host (${bad} failures over ${hosts.length} hosts)`);
}

// Edits of the network on the canvas: every host must still reach every host afterwards.
const allReach = (t: any) => { const sim = createSimulator(t); const hosts = t.devices.filter((d: any) => ['pc', 'laptop', 'server-generic', 'printer'].includes(d.typeId)); const ip = (d: any) => d.interfaces.find((i: any) => i.ipv4)?.ipv4 || ''; let bad = 0; for (const a of hosts) for (const b of hosts) if (a !== b && ip(b) && !sim.canReach(a.id, ip(b))) { bad++; if (bad <= 3) console.log('   no path', a.hostname, '->', b.hostname, ip(b)); } return { bad, n: hosts.length }; };
const EDITS: Array<[string, string, number]> = [
    ['build network from 10 devices and connected together', 'create another subnet and connect it to the current subnet', 8],
    ['build network from 10 devices and connected together', 'add another subnet with 3 laptops', 3],
    ['build network from 10 devices and connected together', 'add 4 more PCs', 4],
    ['build network from 10 devices and connected together', 'add wifi', 2],
    ['a network of three devices', 'create another subnet and connect it to the current one', 2],
    ['4 routers connected with OSPF, each with a switch and 3 PCs', 'add a new subnet with 2 servers', 2],
    ['2 routers, 3 switches and 12 PCs', 'add another LAN', 0],
];
for (const [base, req, added] of EDITS) {
    const t0 = topologyFromAiSpec(buildQuickSpec(parseNetworkRequest(base)!)).topology!;
    ok(isEditRequest(req), 'edit request: ' + req);
    const plan = parseEditRequest(req);
    ok(plan, 'edit parse: ' + req);
    if (!plan) continue;
    const before = t0.devices.length;
    const r = applyEdit(t0, plan);
    ok(r.ok && r.topology, req + ' on [' + base + ']: applies (' + (r.reason || '') + ')');
    if (!r.topology) continue;
    ok(t0.devices.length === before, req + ': the original is untouched');
    const hostsAdded = r.topology.devices.filter((d) => ['pc', 'laptop', 'server-generic', 'printer'].includes(d.typeId)).length - t0.devices.filter((d) => ['pc', 'laptop', 'server-generic', 'printer'].includes(d.typeId)).length;
    if (added) ok(hostsAdded === added, req + ': ' + hostsAdded + ' hosts added, wanted ' + added);
    const reach = allReach(r.topology);
    ok(reach.bad === 0, req + ' on [' + base + ']: every host reaches every host (' + reach.bad + ' failures over ' + reach.n + ')');
}
ok(!isEditRequest('build network from 10 devices'), 'a new build is not an edit');
ok(!isEditRequest('build network from 10 devices and connected together'), 'connected together is a new build');

// Unparseable text asks the model; its numbers are clamped.
ok(parseNetworkRequest('design something nice for my school') === null, 'no numbers -> null (the model is asked)');
const cp = cleanParams({ routers: 99, switches: -3, pcs: '7', vlans: [10, 10, 5000, 20], internet: 1 });
ok(cp && cp.routers === 8 && cp.switches >= 1 && cp.pcs === 7 && cp.vlans.join() === '10,20' && cp.internet, 'cleanParams clamps');
ok(cleanParams(null) === null && cleanParams({}) === null, 'cleanParams refuses nothing');

// Deterministic: same request, same network.
const a = JSON.stringify(buildQuickSpec(parseNetworkRequest('2 routers, 3 switches and 12 PCs')!));
const b = JSON.stringify(buildQuickSpec(parseNetworkRequest('2 routers, 3 switches and 12 PCs')!));
ok(a === b, 'deterministic');

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
