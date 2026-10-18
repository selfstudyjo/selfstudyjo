<template>
  <!-- List -->
  <CsTable v-if="page === 'acls'" variant="full-page" title="Network ACLs" :items="acls" :columns="cols" track-by="id"
           selection-type="single" v-model:selected="sel" filter-placeholder="Filter network ACLs">
    <template #actions>
      <CsDropdown :items="listActions" :disabled="!selected" @select="listAct" />
      <button type="button" class="cs-btn cs-btn--primary" disabled title="This estate's network ACLs are managed by the network team">Create network ACL</button>
    </template>
    <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="open(row.id)">{{ row.id }}</a></template>
  </CsTable>

  <!-- Edit inbound / outbound rules (its own page in the console) -->
  <div v-else-if="acl && edit">
    <CsHeader :title="`Edit ${edit} rules`" :description="`${acl.id} / ${acl.name}`" />
    <div class="cs-alert cs-alert--info">
      <CsIcon name="status-info" class="cs-alert__icon" />
      <div>Network ACL rules are <b>stateless</b>: return traffic must be allowed explicitly in the other direction.
        Rules are evaluated in order, starting with the lowest numbered rule - the first match wins.</div>
    </div>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`${edit === 'inbound' ? 'Inbound' : 'Outbound'} rules`" :level="2" /></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini nacl__edit">
          <thead><tr><th>Rule number</th><th>Type</th><th>Protocol</th><th>Port range</th>
            <th>{{ edit === 'inbound' ? 'Source' : 'Destination' }}</th><th>Allow/Deny</th><th /></tr></thead>
          <tbody>
            <tr v-for="(row, i) in draft" :key="row.key">
              <td><input v-model="row.rule" class="cs-input nacl__num" :class="{ 'is-invalid': rowProblem(row, i).startsWith('Rule') }" inputmode="numeric" /></td>
              <td><select v-model="row.type" class="cs-select" @change="applyType(row)">
                <option v-for="t in TYPES" :key="t.label" :value="t.label">{{ t.label }}</option></select></td>
              <td>{{ protoLabel(row.protocol) }}</td>
              <td><input v-model="row.ports" class="cs-input nacl__port" :disabled="!editablePorts(row)" :placeholder="editablePorts(row) ? '0 - 65535' : 'All'" /></td>
              <td><input v-model="row.cidr" class="cs-input" :class="{ 'is-invalid': rowProblem(row, i).includes('CIDR') }" placeholder="0.0.0.0/0" /></td>
              <td><select v-model="row.action" class="cs-select nacl__act"><option value="allow">Allow</option><option value="deny">Deny</option></select></td>
              <td><button type="button" class="cs-btn" @click="draft.splice(i, 1)">Remove</button></td>
            </tr>
            <tr><td>*</td><td>All traffic</td><td>All</td><td>All</td><td>0.0.0.0/0</td><td><CsStatus type="error" label="Deny" /></td><td /></tr>
          </tbody>
        </table>
        <div v-for="(row, i) in draft" :key="'e' + row.key">
          <div v-if="rowProblem(row, i)" class="cs-error-text">Rule {{ row.rule || '(new)' }}: {{ rowProblem(row, i) }}</div>
        </div>
        <button type="button" class="cs-btn nacl__add" @click="addRow">Add new rule</button>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('vpc', 'acl', { id: acl.id })">Cancel</button>
      <button type="button" class="cs-btn" disabled>Preview changes</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || draft.some((r, i) => rowProblem(r, i))" @click="save">
        <span v-if="busy" class="cs-btn__spinner" />Save changes</button>
    </div>
  </div>

  <!-- Detail -->
  <div v-else-if="acl">
    <CsHeader :title="`${acl.id} / ${acl.name}`">
      <template #actions><CsDropdown :items="detailActions" @select="detailAct" /></template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>Network ACL ID</dt><dd class="cs-mono">{{ acl.id }}</dd></div>
          <div><dt>Associated with</dt><dd>{{ acl.subnets.length }} Subnets</dd></div>
          <div><dt>Default</dt><dd>{{ acl.name === 'default' ? 'Yes' : 'No' }}</dd></div>
          <div><dt>VPC ID</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'vpc', { id: acl.vpc })">{{ acl.vpc }}</a></dd></div>
          <div><dt>Owner</dt><dd>{{ ctx.account.value }}</dd></div>
        </dl>
      </div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in ['Inbound rules', 'Outbound rules', 'Subnet associations']" :key="t" type="button" class="cs-tab"
              :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <section v-if="tab !== 'Subnet associations'" class="cs-container">
      <div class="cs-container__head">
        <CsHeader :title="`${tab} (${shown.length + 1})`" :level="2">
          <template #actions><button type="button" class="cs-btn" @click="startEdit(tab === 'Inbound rules' ? 'inbound' : 'outbound')">
            Edit {{ tab === 'Inbound rules' ? 'inbound' : 'outbound' }} rules</button></template>
        </CsHeader>
      </div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini">
          <thead><tr><th>Rule number</th><th>Type</th><th>Protocol</th><th>Port range</th>
            <th>{{ tab === 'Inbound rules' ? 'Source' : 'Destination' }}</th><th>Allow/Deny</th></tr></thead>
          <tbody>
            <tr v-for="row in shown" :key="row.rule"><td>{{ row.rule }}</td><td>{{ ruleType(row) }}</td>
              <td>{{ protoLabel(row.protocol) }}</td><td>{{ portRange(row) }}</td><td>{{ row.cidr }}</td>
              <td><CsStatus :type="row.action === 'allow' ? 'success' : 'error'" :label="row.action === 'allow' ? 'Allow' : 'Deny'" /></td></tr>
            <tr><td>*</td><td>All traffic</td><td>All</td><td>All</td><td>0.0.0.0/0</td><td><CsStatus type="error" label="Deny" /></td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Subnet associations (${acl.subnets.length})`" :level="2" /></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini"><thead><tr><th>Name</th><th>Subnet ID</th><th>IPv4 CIDR</th></tr></thead>
          <tbody><tr v-for="sid in acl.subnets" :key="sid"><td>{{ subnetOf(sid)?.name }}</td>
            <td><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'subnet', { id: sid })">{{ sid }}</a></td><td>{{ subnetOf(sid)?.cidr }}</td></tr></tbody></table>
      </div>
    </section>
  </div>
  <NotFound v-else what="Network ACL" :id="id" back="acls" />
</template>

<script setup lang="ts">
/**
 * Network ACLs, with the console's "Edit inbound rules" page. Saving computes
 * the difference against the stored entries and runs one
 * create- / replace- / delete-network-acl-entry per rule number - exactly the
 * calls the console makes, and the ones the lab's task checks look for.
 */
import { computed, ref } from 'vue';
import { RULES, cli, rows, validate } from '@/utils/portalKit';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import { portRange, protoLabel, ruleType } from '../kit';
import NotFound from './NotFound.vue';

interface Draft {
  key: number; rule: string; type: string; protocol: string; ports: string; cidr: string; action: string;
  original?: Record<string, any>;
}

const TYPES = [
  { label: 'All traffic', protocol: '-1', ports: '' },
  { label: 'Custom TCP', protocol: 'tcp', ports: null },
  { label: 'Custom UDP', protocol: 'udp', ports: null },
  { label: 'SSH (22)', protocol: 'tcp', ports: '22' },
  { label: 'HTTP (80)', protocol: 'tcp', ports: '80' },
  { label: 'HTTPS (443)', protocol: 'tcp', ports: '443' },
  { label: 'RDP (3389)', protocol: 'tcp', ports: '3389' },
  { label: 'MS SQL (1433)', protocol: 'tcp', ports: '1433' },
  { label: 'LDAP (389)', protocol: 'tcp', ports: '389' },
  { label: 'SMB (445)', protocol: 'tcp', ports: '445' },
  { label: 'Ephemeral (1024-65535)', protocol: 'tcp', ports: '1024-65535' },
];

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const id = computed(() => ctx.route.value.params?.id || '');
const edit = computed(() => ctx.route.value.params?.edit || '');
const sel = ref<string[]>([]);
const tab = ref(ctx.route.value.params?.tab === 'outbound' ? 'Outbound rules' : 'Inbound rules');
const busy = ref(false);
const draft = ref<Draft[]>([]);
let seq = 0;

const acls = computed(() => rows<any>(ctx.c.value, 'net.acls').map(a => ({
  ...a, inCount: a.inbound.length + 1, outCount: a.outbound.length + 1,
  associated: a.subnets.length ? `${a.subnets.length} Subnets` : '-',
})));
const acl = computed<any>(() => acls.value.find(a => a.id === id.value) || null);
const selected = computed(() => acls.value.find(a => a.id === sel.value[0]) || null);
const shown = computed(() => (tab.value === 'Inbound rules' ? acl.value?.inbound : acl.value?.outbound) || []);
const subnets = computed(() => rows<any>(ctx.c.value, 'net.subnets'));
function subnetOf(sid: string) { return subnets.value.find(s => s.id === sid); }

const cols = [
  { id: 'name', header: 'Name', sortKey: 'name' }, { id: 'id', header: 'Network ACL ID', sortKey: 'id' },
  { id: 'associated', header: 'Associated with' }, { id: 'default', header: 'Default', cell: (a: any) => (a.name === 'default' ? 'Yes' : 'No') },
  { id: 'vpc', header: 'VPC ID', sortKey: 'vpc' }, { id: 'inCount', header: 'Inbound rules count' },
  { id: 'outCount', header: 'Outbound rules count' },
];
const listActions = [{ id: 'inbound', text: 'Edit inbound rules' }, { id: 'outbound', text: 'Edit outbound rules' },
  { id: 'assoc', text: 'Edit subnet associations', disabled: true }, { id: 'delete', text: 'Delete network ACLs', disabled: true }];
const detailActions = [{ id: 'inbound', text: 'Edit inbound rules' }, { id: 'outbound', text: 'Edit outbound rules' }];

function open(aid: string) { ctx.to('vpc', 'acl', { id: aid }); }
function listAct(action: string) { if (selected.value) startEditFor(selected.value, action); }
function detailAct(action: string) { startEdit(action); }

function typeFor(rule: Record<string, any>): string {
  const ports = portRange(rule).replace(/ /g, '');
  const match = TYPES.find(t => t.protocol === rule.protocol && t.ports !== null && (t.ports === ports || (t.protocol === '-1')));
  if (match) return match.label;
  return rule.protocol === 'udp' ? 'Custom UDP' : 'Custom TCP';
}
function toDraft(rule: Record<string, any>): Draft {
  const ports = rule.protocol === '-1' ? '' : (rule.from === rule.to ? String(rule.from) : `${rule.from}-${rule.to}`);
  return { key: ++seq, rule: String(rule.rule), type: typeFor(rule), protocol: rule.protocol, ports, cidr: rule.cidr,
    action: rule.action, original: rule };
}
function startEdit(direction: string) { if (acl.value) startEditFor(acl.value, direction); }
function startEditFor(target: any, direction: string) {
  // The edit page is its own route, so this component is re-created there and
  // the draft is seeded below from the stored entries.
  ctx.to('vpc', 'acl', { id: target.id, edit: direction });
}
if (edit.value && acl.value) {
  draft.value = (edit.value === 'inbound' ? acl.value.inbound : acl.value.outbound).map(toDraft);
}
function addRow() {
  const used = draft.value.map(r => Number(r.rule) || 0);
  const next = (Math.floor(Math.max(0, ...used) / 10) + 1) * 10;
  draft.value.push({ key: ++seq, rule: String(next), type: 'Custom TCP', protocol: 'tcp', ports: '', cidr: '', action: 'allow' });
}
function applyType(row: Draft) {
  const t = TYPES.find(x => x.label === row.type);
  if (!t) return;
  row.protocol = t.protocol;
  if (t.ports !== null) row.ports = t.ports;
}
function editablePorts(row: Draft) {
  return TYPES.find(t => t.label === row.type)?.ports === null;
}
function parsePorts(row: Draft): [number, number] | null {
  if (row.protocol === '-1') return [0, 65535];
  const text = row.ports.replace(/\s/g, '');
  const m = text.match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const low = Number(m[1]);
  const high = Number(m[2] ?? m[1]);
  if (low > high || high > 65535) return null;
  return [low, high];
}
function rowProblem(row: Draft, index: number): string {
  const n = Number(row.rule);
  if (!/^\d+$/.test(row.rule) || n < 1 || n > 32766) return 'Rule number must be between 1 and 32766.';
  if (draft.value.some((other, j) => j !== index && Number(other.rule) === n)) return 'Rule number must be unique.';
  if (!parsePorts(row)) return 'Port range must be a port or a range like 1024-65535.';
  const cidr = validate(row.cidr, [RULES.required('CIDR'), RULES.cidr('CIDR')]);
  return cidr;
}

function entryCmd(verb: 'create' | 'replace', aclId: string, egress: boolean, row: Draft): string {
  const [low, high] = parsePorts(row) || [0, 65535];
  return cli(['aws', 'ec2', `${verb}-network-acl-entry`], {
    '--network-acl-id': aclId, '--rule-number': Number(row.rule), [egress ? '--egress' : '--ingress']: true,
    '--protocol': row.protocol, '--port-range': row.protocol === '-1' ? '' : `From=${low},To=${high}`,
    '--cidr-block': row.cidr.trim(), '--rule-action': row.action,
  });
}
function changed(row: Draft): boolean {
  const o = row.original;
  if (!o) return true;
  const [low, high] = parsePorts(row) || [0, 65535];
  return o.protocol !== row.protocol || Number(o.from) !== low || Number(o.to) !== high
    || o.cidr !== row.cidr.trim() || o.action !== row.action || Number(o.rule) !== Number(row.rule);
}

async function save() {
  if (!acl.value) return;
  const egress = edit.value === 'outbound';
  const before: any[] = egress ? acl.value.outbound : acl.value.inbound;
  const numbers = new Set(draft.value.map(r => Number(r.rule)));
  busy.value = true;
  let ok = true;
  for (const rule of before) {
    if (numbers.has(Number(rule.rule))) continue;
    const result = await ctx.run(cli(['aws', 'ec2', 'delete-network-acl-entry'], {
      '--network-acl-id': acl.value.id, '--rule-number': Number(rule.rule), [egress ? '--egress' : '--ingress']: true,
    }));
    ok = ok && result.ok;
  }
  for (const row of draft.value) {
    const exists = before.some(r => Number(r.rule) === Number(row.rule));
    if (exists && !changed(row)) continue;
    const result = await ctx.run(entryCmd(exists ? 'replace' : 'create', acl.value.id, egress, row));
    ok = ok && result.ok;
  }
  busy.value = false;
  if (ok) {
    ctx.api.notify('success', `You have successfully updated ${edit.value} rules for ${acl.value.id} / ${acl.value.name}.`);
    ctx.to('vpc', 'acl', { id: acl.value.id, tab: egress ? 'outbound' : 'inbound' });
  }
}
</script>

<style scoped>
.nacl__num { width: 90px; }
.nacl__port { width: 130px; }
.nacl__act { width: 100px; }
.nacl__add { margin-top: 12px; }
.nacl__edit td { vertical-align: middle; }
.nacl__edit .cs-select { min-width: 150px; }
</style>
