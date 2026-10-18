<template>
  <!-- List -->
  <div v-if="page === 'sgs'">
    <CsTable variant="full-page" title="Security Groups" :items="groups" :columns="cols" track-by="id"
             selection-type="single" v-model:selected="sel" filter-placeholder="Find resources by attribute or tag">
      <template #actions>
        <CsDropdown :items="listActions" :disabled="!selected" @select="listAct" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to(svc, 'sg-create')">Create security group</button>
      </template>
      <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to(svc, 'sg', { id: row.id })">{{ row.id }}</a></template>
    </CsTable>
    <CsDelete v-if="deleting && selected" title="Delete security groups" word="delete" :busy="busy"
              @close="deleting = false" @confirm="remove(selected.id)">
      <p class="sg__p">Are you sure you want to delete the security group <span class="cs-mono">{{ selected.id }}</span> ({{ selected.name }})?</p>
    </CsDelete>
  </div>

  <!-- Create -->
  <div v-else-if="page === 'sg-create'">
    <CsHeader title="Create security group" description="A security group acts as a virtual firewall for your instance to control inbound and outbound traffic." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Basic details" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Security group name</label>
          <input v-model="form.name" class="cs-input" :class="{ 'is-invalid': nameProblem }" placeholder="MyWebServerGroup" />
          <span v-if="nameProblem" class="cs-error-text">{{ nameProblem }}</span>
          <span v-else class="cs-constraint">Name cannot be edited after creation.</span></div>
        <div class="cs-field"><label class="cs-label">Description</label>
          <input v-model="form.description" class="cs-input" placeholder="Allows SSH access to developers" /></div>
        <div class="cs-field"><label class="cs-label">VPC</label>
          <select v-model="form.vpc" class="cs-select"><option v-for="v in vpcs" :key="v.id" :value="v.id">{{ v.id }} ({{ v.name }})</option></select></div>
      </div>
    </section>
    <div class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
      <div>A new security group has no inbound rules and allows all outbound traffic. Add rules after it is created.</div></div>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to(svc, 'sgs')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!nameProblem || !form.description.trim()" @click="create">
        <span v-if="busy" class="cs-btn__spinner" />Create security group</button>
    </div>
  </div>

  <!-- Edit rules page -->
  <div v-else-if="group && edit">
    <CsHeader :title="`Edit ${edit} rules`" :description="edit === 'inbound'
      ? 'Inbound rules control the incoming traffic that’s allowed to reach the instance.'
      : 'Outbound rules control the outgoing traffic that’s allowed to leave the instance.'" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader :title="edit === 'inbound' ? 'Inbound rules' : 'Outbound rules'" :level="2" /></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini sg__edit">
          <thead><tr><th>Type</th><th>Protocol</th><th>Port range</th><th>{{ edit === 'inbound' ? 'Source' : 'Destination' }}</th><th>Description - optional</th><th /></tr></thead>
          <tbody>
            <tr v-for="(row, i) in draft" :key="row.key">
              <td><select v-model="row.type" class="cs-select" @change="applyType(row)"><option v-for="t in TYPES" :key="t.label" :value="t.label">{{ t.label }}</option></select></td>
              <td>{{ protoLabel(row.protocol) }}</td>
              <td><input v-model="row.ports" class="cs-input sg__port" :disabled="!portsEditable(row)" :placeholder="portsEditable(row) ? '0' : 'All'" /></td>
              <td><input v-model="row.peer" class="cs-input" :class="{ 'is-invalid': problem(row) }" placeholder="CIDR or sg-..." list="sg-peers" /></td>
              <td><input v-model="row.note" class="cs-input" placeholder="" disabled /></td>
              <td><button type="button" class="cs-btn" @click="draft.splice(i, 1)">Delete</button></td>
            </tr>
            <tr v-if="!draft.length"><td colspan="6" class="cs-empty">This security group has no {{ edit }} rules.</td></tr>
          </tbody>
        </table>
        <datalist id="sg-peers"><option value="0.0.0.0/0" /><option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option></datalist>
        <div v-for="row in draft" :key="'e' + row.key"><div v-if="problem(row)" class="cs-error-text">{{ problem(row) }}</div></div>
        <button type="button" class="cs-btn sg__add" @click="addRow">Add rule</button>
      </div>
    </section>
    <div v-if="draft.some(r => r.peer.trim() === '0.0.0.0/0' && edit === 'inbound')" class="cs-alert cs-alert--warning">
      <CsIcon name="status-warning" class="cs-alert__icon" />
      <div>Rules with source of 0.0.0.0/0 or ::/0 allow all IP addresses to access your instance. We recommend setting security group rules to allow access from known IP addresses only.</div>
    </div>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to(svc, 'sg', { id: group.id })">Cancel</button>
      <button type="button" class="cs-btn" disabled>Preview changes</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || draft.some(r => problem(r))" @click="save">
        <span v-if="busy" class="cs-btn__spinner" />Save rules</button>
    </div>
  </div>

  <!-- Detail -->
  <div v-else-if="group">
    <CsHeader :title="`${group.id} - ${group.name}`">
      <template #actions><CsDropdown :items="detailActions" @select="detailAct" /></template>
    </CsHeader>
    <div v-if="group.managed_by" class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
      <div>This security group is managed by <b>{{ group.managed_by }}</b>. A console change is drift the next plan will see.</div></div>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>Security group name</dt><dd>{{ group.name }}</dd></div>
          <div><dt>Security group ID</dt><dd class="cs-mono">{{ group.id }}</dd></div>
          <div><dt>Owner</dt><dd>{{ ctx.account.value }}</dd></div>
          <div><dt>Inbound rules count</dt><dd>{{ group.inbound.length }} Permission entries</dd></div>
          <div><dt>Outbound rules count</dt><dd>{{ group.outbound.length }} Permission entries</dd></div>
          <div><dt>VPC ID</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'vpc', { id: group.vpc })">{{ group.vpc }}</a></dd></div>
        </dl>
      </div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in ['Inbound rules', 'Outbound rules', 'Used by']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <section v-if="tab !== 'Used by'" class="cs-container">
      <div class="cs-container__head">
        <CsHeader :title="`${tab} (${shown.length})`" :level="2">
          <template #actions><button type="button" class="cs-btn" @click="startEdit(tab === 'Inbound rules' ? 'inbound' : 'outbound')">Edit {{ tab.toLowerCase() }}</button></template>
        </CsHeader>
      </div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini">
          <thead><tr><th>Security group rule ID</th><th>IP version</th><th>Type</th><th>Protocol</th><th>Port range</th><th>{{ tab === 'Inbound rules' ? 'Source' : 'Destination' }}</th><th>Description</th></tr></thead>
          <tbody>
            <tr v-for="(rule, i) in shown" :key="i"><td class="cs-mono">sgr-{{ ruleId(rule, Number(i)) }}</td><td>{{ rule.cidr ? 'IPv4' : '-' }}</td>
              <td>{{ ruleType(rule) }}</td><td>{{ protoLabel(rule.protocol) }}</td><td>{{ portRange(rule) }}</td>
              <td>{{ rule.cidr || rule.sg }}</td><td>{{ rule.note || '-' }}</td></tr>
            <tr v-if="!shown.length"><td colspan="7" class="cs-empty"><strong>No security group rules found</strong></td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Network interfaces (${usedBy.length})`" :level="2" /></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini"><thead><tr><th>Resource</th><th>Name</th><th>Private IP</th></tr></thead>
          <tbody><tr v-for="u in usedBy" :key="u.id"><td class="cs-mono">{{ u.id }}</td><td>{{ u.name }}</td><td>{{ u.ip || '-' }}</td></tr>
            <tr v-if="!usedBy.length"><td colspan="3" class="cs-empty">No resources use this security group.</td></tr></tbody></table>
      </div>
    </section>
    <CsDelete v-if="deleting" title="Delete security groups" word="delete" :busy="busy" @close="deleting = false" @confirm="remove(group.id)">
      <p class="sg__p">Are you sure you want to delete <span class="cs-mono">{{ group.id }}</span> ({{ group.name }})?</p>
    </CsDelete>
  </div>
  <NotFound v-else what="Security group" :id="id" back="sgs" />
</template>

<script setup lang="ts">
/**
 * Security groups (the same page under VPC and EC2). Saving an "Edit inbound
 * rules" page revokes the rules that went and authorizes the ones that came -
 * the calls the console makes - so a stateful rule change is one
 * authorize-/revoke-security-group-ingress per rule.
 */
import { computed, reactive, ref } from 'vue';
import { RULES, cli, rows, validate } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import { portRange, protoLabel, ruleType } from '../kit';
import type { ServiceId } from '../nav';
import NotFound from './NotFound.vue';

interface Draft { key: number; type: string; protocol: string; ports: string; peer: string; note: string; original?: any }

const TYPES = [
  { label: 'Custom TCP', protocol: 'tcp', ports: null }, { label: 'Custom UDP', protocol: 'udp', ports: null },
  { label: 'All traffic', protocol: '-1', ports: '' }, { label: 'All TCP', protocol: 'tcp', ports: '0-65535' },
  { label: 'SSH', protocol: 'tcp', ports: '22' }, { label: 'HTTP', protocol: 'tcp', ports: '80' },
  { label: 'HTTPS', protocol: 'tcp', ports: '443' }, { label: 'RDP', protocol: 'tcp', ports: '3389' },
  { label: 'MSSQL', protocol: 'tcp', ports: '1433' }, { label: 'LDAP', protocol: 'tcp', ports: '389' },
  { label: 'SMB', protocol: 'tcp', ports: '445' },
];

const ctx = useOps();
const svc = computed<ServiceId>(() => (ctx.route.value.svc === 'ec2' ? 'ec2' : 'vpc'));
const page = computed(() => ctx.route.value.page);
const id = computed(() => ctx.route.value.params?.id || '');
const edit = computed(() => ctx.route.value.params?.edit || '');
const sel = ref<string[]>([]);
const tab = ref(ctx.route.value.params?.tab === 'outbound' ? 'Outbound rules' : 'Inbound rules');
const busy = ref(false);
const deleting = ref(false);
const draft = ref<Draft[]>([]);
let seq = 0;

const vpcs = computed(() => rows<any>(ctx.c.value, 'net.vpcs'));
const groups = computed(() => rows<any>(ctx.c.value, 'net.sgs').map(g => ({
  ...g, inCount: `${g.inbound.length} Permission entries`, outCount: `${g.outbound.length} Permission entries`,
})));
const group = computed<any>(() => groups.value.find(g => g.id === id.value) || null);
const selected = computed(() => groups.value.find(g => g.id === sel.value[0]) || null);
const shown = computed(() => (tab.value === 'Inbound rules' ? group.value?.inbound : group.value?.outbound) || []);
const usedBy = computed(() => {
  if (!group.value) return [];
  const gid = group.value.id;
  const inst = rows<any>(ctx.c.value, 'ec2.instances').filter(i => i.sgs.includes(gid) && i.state !== 'terminated');
  const eps = rows<any>(ctx.c.value, 'net.endpoints').filter(e => (e.sgs || []).includes(gid))
    .map(e => ({ id: e.id, name: 'VPC endpoint ' + e.service, ip: (e.ips || [])[0] }));
  return [...inst.map(i => ({ id: i.id, name: i.name, ip: i.ip })), ...eps];
});

const cols = [
  { id: 'name', header: 'Name', cell: () => '-' }, { id: 'id', header: 'Security group ID', sortKey: 'id' },
  { id: 'sgname', header: 'Security group name', cell: (g: any) => g.name, sortKey: 'name' },
  { id: 'vpc', header: 'VPC ID', sortKey: 'vpc' }, { id: 'inCount', header: 'Inbound rules count' },
  { id: 'outCount', header: 'Outbound rules count' },
];
const listActions = [{ id: 'inbound', text: 'Edit inbound rules' }, { id: 'outbound', text: 'Edit outbound rules' },
  { id: 'delete', text: 'Delete security groups' }];
const detailActions = listActions;

function listAct(action: string) {
  if (!selected.value) return;
  if (action === 'delete') deleting.value = true;
  else ctx.to(svc.value, 'sg', { id: selected.value.id, edit: action });
}
function detailAct(action: string) {
  if (action === 'delete') deleting.value = true;
  else startEdit(action);
}
function startEdit(direction: string) {
  if (group.value) ctx.to(svc.value, 'sg', { id: group.value.id, edit: direction });
}
function ruleId(rule: any, i: number) {
  let h = 0;
  for (const ch of `${group.value?.id}${rule.protocol}${rule.from}${rule.to}${rule.cidr}${rule.sg}${i}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ('0' + h.toString(16)).padStart(17, '0').slice(0, 17);
}
function typeFor(rule: any): string {
  const ports = rule.from === rule.to ? String(rule.from) : `${rule.from}-${rule.to}`;
  return (TYPES.find(t => t.protocol === rule.protocol && (t.protocol === '-1' || t.ports === ports))?.label)
    || (rule.protocol === 'udp' ? 'Custom UDP' : 'Custom TCP');
}
function toDraft(rule: any): Draft {
  const ports = rule.protocol === '-1' ? '' : (rule.from === rule.to ? String(rule.from) : `${rule.from}-${rule.to}`);
  return { key: ++seq, type: typeFor(rule), protocol: rule.protocol, ports, peer: rule.cidr || rule.sg || '', note: rule.note || '', original: rule };
}
if (edit.value && group.value) {
  draft.value = (edit.value === 'inbound' ? group.value.inbound : group.value.outbound).map(toDraft);
}
function addRow() { draft.value.push({ key: ++seq, type: 'Custom TCP', protocol: 'tcp', ports: '', peer: '', note: '' }); }
function applyType(row: Draft) {
  const t = TYPES.find(x => x.label === row.type);
  if (!t) return;
  row.protocol = t.protocol;
  if (t.ports !== null) row.ports = t.ports;
}
function portsEditable(row: Draft) { return TYPES.find(t => t.label === row.type)?.ports === null; }
function ports(row: Draft): [number, number] | null {
  if (row.protocol === '-1') return [0, 65535];
  const m = row.ports.replace(/\s/g, '').match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const low = Number(m[1]);
  const high = Number(m[2] ?? m[1]);
  return low <= high && high <= 65535 ? [low, high] : null;
}
function problem(row: Draft): string {
  if (!ports(row)) return 'Port range: enter a port (443) or a range (1024-65535).';
  const peer = row.peer.trim();
  if (!peer) return 'You must specify a source/destination: a CIDR block or a security group.';
  if (peer.startsWith('sg-')) return groups.value.some(g => g.id === peer) ? '' : `The security group ${peer} does not exist.`;
  return validate(peer, [RULES.cidr('Source')]);
}
function same(a: any, row: Draft): boolean {
  const p = ports(row);
  if (!p) return false;
  const peer = row.peer.trim();
  return a.protocol === row.protocol && Number(a.from) === p[0] && Number(a.to) === p[1]
    && ((a.cidr || '') === (peer.startsWith('sg-') ? '' : peer)) && ((a.sg || '') === (peer.startsWith('sg-') ? peer : ''));
}
function ruleCmd(verb: string, rule: { protocol: string; from: number; to: number; cidr?: string; sg?: string }) {
  return cli(['aws', 'ec2', verb], {
    '--group-id': group.value.id, '--protocol': rule.protocol === '-1' ? 'all' : rule.protocol,
    '--port': rule.protocol === '-1' ? '' : (rule.from === rule.to ? String(rule.from) : `${rule.from}-${rule.to}`),
    '--cidr': rule.cidr || '', '--source-group': rule.sg || '',
  });
}
async function save() {
  if (!group.value) return;
  const direction = edit.value === 'outbound' ? 'egress' : 'ingress';
  const before: any[] = edit.value === 'outbound' ? group.value.outbound : group.value.inbound;
  busy.value = true;
  let ok = true;
  for (const rule of before) {
    if (draft.value.some(row => same(rule, row))) continue;
    const result = await ctx.run(ruleCmd(`revoke-security-group-${direction}`, rule));
    ok = ok && result.ok;
  }
  for (const row of draft.value) {
    if (before.some(rule => same(rule, row))) continue;
    const [from, to] = ports(row) || [0, 65535];
    const peer = row.peer.trim();
    const result = await ctx.run(ruleCmd(`authorize-security-group-${direction}`, {
      protocol: row.protocol, from, to, cidr: peer.startsWith('sg-') ? '' : peer, sg: peer.startsWith('sg-') ? peer : '',
    }));
    ok = ok && result.ok;
  }
  busy.value = false;
  if (ok) {
    ctx.api.notify('success', `${edit.value === 'outbound' ? 'Outbound' : 'Inbound'} security group rules successfully modified on security group (${group.value.id} | ${group.value.name})`);
    ctx.to(svc.value, 'sg', { id: group.value.id, tab: edit.value });
  }
}

const form = reactive({ name: '', description: '', vpc: 'vpc-0prod20a1b2c3d4e' });
const nameProblem = computed(() => {
  if (!form.name) return '';
  if (/^sg-/i.test(form.name)) return 'Names can’t start with sg-.';
  if (groups.value.some(g => g.name === form.name && g.vpc === form.vpc)) return 'A security group with this name already exists in this VPC.';
  return validate(form.name, [RULES.pattern(/^[\w .:/()#,@[\]+=&;{}!$*-]{1,255}$/, 'Valid characters are a-z, A-Z, 0-9, spaces, and ._-:/()#,@[]+=&;{}!$*')]);
});
async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'create-security-group'], {
    '--group-name': form.name.trim(), '--description': form.description.trim(), '--vpc-id': form.vpc,
  }));
  busy.value = false;
  if (result.ok) {
    let gid = '';
    try { gid = JSON.parse(result.output || '{}').GroupId; } catch { /* ignored */ }
    ctx.api.notify('success', `Security group (${gid} | ${form.name}) was created successfully`);
    ctx.to(svc.value, 'sg', { id: gid });
  }
}
async function remove(gid: string) {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-security-group'], { '--group-id': gid }),
    `Successfully deleted security group ${gid}`);
  busy.value = false;
  deleting.value = false;
  if (result.ok) ctx.to(svc.value, 'sgs');
}
</script>

<style scoped>
.sg__p { margin: 0; }
.sg__port { width: 130px; }
.sg__add { margin-top: 12px; }
.sg__edit td { vertical-align: middle; }
.sg__edit .cs-select { min-width: 140px; }
</style>
