<template>
  <!-- List -->
  <CsTable v-if="page === 'route-tables'" variant="full-page" title="Route tables" :items="tables" :columns="cols" track-by="id"
           selection-type="single" v-model:selected="sel" filter-placeholder="Filter route tables">
    <template #actions>
      <CsDropdown :items="[{ id: 'routes', text: 'Edit routes' }, { id: 'assoc', text: 'Edit subnet associations' }, { id: 'delete', text: 'Delete route table' }]"
                  :disabled="!selected" @select="listAct" />
      <button type="button" class="cs-btn cs-btn--primary" @click="creating = true">Create route table</button>
    </template>
    <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'route-table', { id: row.id })">{{ row.id }}</a></template>
  </CsTable>

  <!-- Edit routes -->
  <div v-else-if="table && edit === 'routes'">
    <CsHeader title="Edit routes" :description="`${table.id} / ${table.name}`" />
    <section class="cs-container">
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini rt__edit">
          <thead><tr><th>Destination</th><th>Target</th><th>Status</th><th>Propagated</th><th /></tr></thead>
          <tbody>
            <tr v-for="(row, i) in draft" :key="row.key">
              <td><input v-model="row.dest" class="cs-input" :disabled="row.local || row.prefix" :class="{ 'is-invalid': problem(row, i) }" placeholder="10.0.0.0/16" /></td>
              <td><select v-model="row.target" class="cs-select" :disabled="row.local || row.prefix">
                <option v-if="row.local" value="local">local</option>
                <option v-for="t in targets" :key="t.id" :value="t.id">{{ t.label }}</option></select></td>
              <td><CsStatus :type="row.blackhole ? 'error' : 'success'" :label="row.blackhole ? 'Blackhole' : 'Active'" /></td>
              <td>No</td>
              <td><button v-if="!row.local && !row.prefix" type="button" class="cs-btn" @click="draft.splice(i, 1)">Remove</button></td>
            </tr>
          </tbody>
        </table>
        <div v-for="(row, i) in draft" :key="'e' + row.key"><div v-if="problem(row, i)" class="cs-error-text">{{ problem(row, i) }}</div></div>
        <button type="button" class="cs-btn rt__add" @click="addRoute">Add route</button>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('vpc', 'route-table', { id: table.id })">Cancel</button>
      <button type="button" class="cs-btn" disabled>Preview</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || draft.some((r, i) => problem(r, i))" @click="saveRoutes">
        <span v-if="busy" class="cs-btn__spinner" />Save changes</button>
    </div>
  </div>

  <!-- Detail -->
  <div v-else-if="table">
    <CsHeader :title="`${table.id} / ${table.name}`">
      <template #actions><CsDropdown :items="[{ id: 'routes', text: 'Edit routes' }, { id: 'assoc', text: 'Edit subnet associations' }, { id: 'delete', text: 'Delete route table' }]" @select="detailAct" /></template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>Route table ID</dt><dd class="cs-mono">{{ table.id }}</dd></div>
          <div><dt>Main</dt><dd>{{ isMain(table) ? 'Yes' : 'No' }}</dd></div>
          <div><dt>Explicit subnet associations</dt><dd>{{ table.subnets.length ? table.subnets.join(', ') : '-' }}</dd></div>
          <div><dt>VPC</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'vpc', { id: table.vpc })">{{ table.vpc }}</a></dd></div>
          <div><dt>Owner ID</dt><dd>{{ ctx.account.value }}</dd></div>
        </dl>
      </div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in ['Routes', 'Subnet associations']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <section v-if="tab === 'Routes'" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Routes (${table.routes.length})`" :level="2">
        <template #actions><button type="button" class="cs-btn" @click="ctx.to('vpc', 'route-table', { id: table.id, edit: 'routes' })">Edit routes</button></template></CsHeader></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini"><thead><tr><th>Destination</th><th>Target</th><th>Status</th><th>Propagated</th></tr></thead>
          <tbody><tr v-for="rr in table.routes" :key="rr.dest"><td>{{ rr.dest }}</td><td>{{ rr.target }}</td>
            <td><CsStatus :type="rr.blackhole ? 'error' : 'success'" :label="rr.blackhole ? 'Blackhole' : 'Active'" /></td><td>No</td></tr></tbody></table>
      </div>
    </section>
    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Explicit subnet associations (${table.subnets.length})`" :level="2">
        <template #actions><button type="button" class="cs-btn" @click="openAssoc">Edit subnet associations</button></template></CsHeader></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini"><thead><tr><th>Name</th><th>Subnet ID</th><th>IPv4 CIDR</th></tr></thead>
          <tbody><tr v-for="sid in table.subnets" :key="sid"><td>{{ subnetOf(sid)?.name }}</td><td class="cs-mono">{{ sid }}</td><td>{{ subnetOf(sid)?.cidr }}</td></tr>
            <tr v-if="!table.subnets.length"><td colspan="3" class="cs-empty"><strong>No subnet associations</strong>You do not have any subnet associations.</td></tr></tbody></table>
      </div>
    </section>
  </div>
  <NotFound v-else what="Route table" :id="id" back="route-tables" />

  <CsModal v-if="assocFor" title="Edit subnet associations" size="large" @close="assocFor = null">
    <p class="cs-muted">Change which subnets are associated with {{ assocFor.id }}. A subnet can be associated with one route table at a time; associating it here moves it from its current table.</p>
    <table class="cs-table-mini"><thead><tr><th /><th>Name</th><th>Subnet ID</th><th>IPv4 CIDR</th><th>Route table ID</th></tr></thead>
      <tbody><tr v-for="s in vpcSubnets" :key="s.id">
        <td><input v-model="assocSel" type="checkbox" :value="s.id" :disabled="s.rt === assocFor.id" /></td>
        <td>{{ s.name }}</td><td class="cs-mono">{{ s.id }}</td><td>{{ s.cidr }}</td><td>{{ s.rt }}</td></tr></tbody></table>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="assocFor = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveAssoc"><span v-if="busy" class="cs-btn__spinner" />Save associations</button>
    </template>
  </CsModal>

  <CsModal v-if="creating" title="Create route table" @close="creating = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">VPC</label>
        <select v-model="newVpc" class="cs-select"><option v-for="v in vpcs" :key="v.id" :value="v.id">{{ v.id }} ({{ v.name }})</option></select></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="creating = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Create route table</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete route table" word="delete" :busy="busy" @close="deleting = ''" @confirm="remove">
    <p class="rt__p">Delete route table <span class="cs-mono">{{ deleting }}</span>? A route table with subnet associations cannot be deleted.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RULES, cli, rows, validate } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import NotFound from './NotFound.vue';

interface Draft { key: number; dest: string; target: string; local: boolean; prefix: boolean; blackhole: boolean; original?: any }

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const id = computed(() => ctx.route.value.params?.id || '');
const edit = computed(() => ctx.route.value.params?.edit || '');
const sel = ref<string[]>([]);
const tab = ref('Routes');
const busy = ref(false);
const creating = ref(false);
const deleting = ref('');
const newVpc = ref('vpc-0prod20a1b2c3d4e');
const assocFor = ref<any>(null);
const assocSel = ref<string[]>([]);
const draft = ref<Draft[]>([]);
let seq = 0;

const vpcs = computed(() => rows<any>(ctx.c.value, 'net.vpcs'));
const subnets = computed(() => rows<any>(ctx.c.value, 'net.subnets'));
const tables = computed(() => rows<any>(ctx.c.value, 'net.route_tables').map(t => ({
  ...t, explicit: t.subnets.length ? `${t.subnets.length} subnet${t.subnets.length > 1 ? 's' : ''}` : '-',
  main: '',
})));
const table = computed<any>(() => tables.value.find(t => t.id === id.value) || null);
const selected = computed(() => tables.value.find(t => t.id === sel.value[0]) || null);
const vpcSubnets = computed(() => subnets.value.filter(s => s.vpc === assocFor.value?.vpc));
function subnetOf(sid: string) { return subnets.value.find(s => s.id === sid); }
function isMain(t: any) { return tables.value.find(x => x.vpc === t.vpc)?.id === t.id; }

const targets = computed(() => {
  const vpcId = table.value?.vpc;
  const out: { id: string; label: string }[] = [];
  for (const g of rows<any>(ctx.c.value, 'net.igws')) if (g.vpc === vpcId) out.push({ id: g.id, label: `Internet Gateway - ${g.id}` });
  for (const n of rows<any>(ctx.c.value, 'net.nats')) out.push({ id: n.id, label: `NAT Gateway - ${n.id}` });
  const tgw = (ctx.c.value as any)?.net?.tgw;
  if (tgw?.id) out.push({ id: tgw.id, label: `Transit Gateway - ${tgw.id}` });
  for (const e of rows<any>(ctx.c.value, 'net.endpoints')) if (e.vpc === vpcId && e.type === 'Gateway') out.push({ id: e.id, label: `Gateway Load Balancer Endpoint - ${e.id}` });
  return out;
});

const cols = [
  { id: 'name', header: 'Name', sortKey: 'name' }, { id: 'id', header: 'Route table ID', sortKey: 'id' },
  { id: 'explicit', header: 'Explicit subnet associations' }, { id: 'main', header: 'Main', cell: (t: any) => (isMain(t) ? 'Yes' : 'No') },
  { id: 'vpc', header: 'VPC', sortKey: 'vpc' }, { id: 'owner', header: 'Owner ID', cell: () => ctx.account.value },
];

if (edit.value === 'routes' && table.value) {
  draft.value = table.value.routes.map((r: any) => ({
    key: ++seq, dest: r.dest, target: r.target, local: r.target === 'local', prefix: String(r.dest).startsWith('pl-'),
    blackhole: r.blackhole, original: r,
  }));
}

function addRoute() {
  draft.value.push({ key: ++seq, dest: '', target: targets.value[0]?.id || '', local: false, prefix: false, blackhole: false });
}
function listAct(action: string) {
  const t = selected.value;
  if (!t) return;
  if (action === 'routes') ctx.to('vpc', 'route-table', { id: t.id, edit: 'routes' });
  if (action === 'assoc') { assocFor.value = t; assocSel.value = []; }
  if (action === 'delete') deleting.value = t.id;
}
function detailAct(action: string) {
  if (!table.value) return;
  if (action === 'routes') ctx.to('vpc', 'route-table', { id: table.value.id, edit: 'routes' });
  if (action === 'assoc') openAssoc();
  if (action === 'delete') deleting.value = table.value.id;
}
function openAssoc() { assocFor.value = table.value; assocSel.value = []; }

function problem(row: Draft, index: number): string {
  if (row.local || row.prefix) return '';
  const cidr = validate(row.dest, [RULES.required('Destination'), RULES.cidr('Destination')]);
  if (cidr) return cidr;
  if (draft.value.some((other, j) => j !== index && other.dest.trim() === row.dest.trim())) return `The route ${row.dest} is defined twice.`;
  if (!row.target) return 'Target is required.';
  return '';
}
function targetFlag(target: string): string {
  if (target.startsWith('nat-')) return '--nat-gateway-id';
  if (target.startsWith('tgw-')) return '--transit-gateway-id';
  if (target.startsWith('vpce-')) return '--vpc-endpoint-id';
  return '--gateway-id';
}
async function saveRoutes() {
  const t = table.value;
  if (!t) return;
  busy.value = true;
  let ok = true;
  for (const r of t.routes) {
    if (r.target === 'local' || String(r.dest).startsWith('pl-')) continue;
    if (draft.value.some(d => d.dest.trim() === r.dest)) continue;
    const result = await ctx.run(cli(['aws', 'ec2', 'delete-route'], { '--route-table-id': t.id, '--destination-cidr-block': r.dest }));
    ok = ok && result.ok;
  }
  for (const d of draft.value) {
    if (d.local || d.prefix) continue;
    const existing = t.routes.find((r: any) => r.dest === d.dest.trim());
    if (existing && existing.target === d.target && !existing.blackhole) continue;
    const verb = existing ? 'replace-route' : 'create-route';
    const result = await ctx.run(cli(['aws', 'ec2', verb], {
      '--route-table-id': t.id, '--destination-cidr-block': d.dest.trim(), [targetFlag(d.target)]: d.target,
    }));
    ok = ok && result.ok;
  }
  busy.value = false;
  if (ok) {
    ctx.api.notify('success', `Updated routes for ${t.id} / ${t.name} successfully`);
    ctx.to('vpc', 'route-table', { id: t.id });
  }
}
async function saveAssoc() {
  const t = assocFor.value;
  busy.value = true;
  let ok = true;
  for (const sid of assocSel.value) {
    const result = await ctx.run(cli(['aws', 'ec2', 'associate-route-table'], { '--route-table-id': t.id, '--subnet-id': sid }));
    ok = ok && result.ok;
  }
  busy.value = false;
  if (ok) {
    ctx.api.notify('success', `You have successfully updated subnet associations for ${t.id} / ${t.name}.`);
    assocFor.value = null;
  }
}
async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'create-route-table'], { '--vpc-id': newVpc.value }));
  busy.value = false;
  if (result.ok) {
    let rid = '';
    try { rid = JSON.parse(result.output || '{}').RouteTable.RouteTableId; } catch { /* ignored */ }
    creating.value = false;
    ctx.api.notify('success', `Route table ${rid} was created successfully.`);
    if (rid) ctx.to('vpc', 'route-table', { id: rid });
  }
}
async function remove() {
  busy.value = true;
  const rid = deleting.value;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-route-table'], { '--route-table-id': rid }), `Successfully deleted route table ${rid}`);
  busy.value = false;
  deleting.value = '';
  if (result.ok && page.value === 'route-table') ctx.to('vpc', 'route-tables');
}
</script>

<style scoped>
.rt__p { margin: 0; }
.rt__add { margin-top: 12px; }
.rt__edit td { vertical-align: middle; }
.rt__edit .cs-select { min-width: 240px; }
</style>
