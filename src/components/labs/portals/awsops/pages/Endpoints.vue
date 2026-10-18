<template>
  <div v-if="page === 'endpoints'">
    <CsTable variant="full-page" title="Endpoints" :items="endpoints" :columns="cols" track-by="id" selection-type="single"
             v-model:selected="sel" filter-placeholder="Filter endpoints">
      <template #actions>
        <CsDropdown :items="actions" :disabled="!selected" @select="act" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('vpc', 'endpoint-create')">Create endpoint</button>
      </template>
      <template #cell-state><CsStatus state="available" /></template>
    </CsTable>
    <section v-if="selected" class="cs-container ep__detail">
      <div class="cs-container__head"><CsHeader :title="selected.id" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Endpoint ID</dt><dd class="cs-mono">{{ selected.id }}</dd></div>
        <div><dt>VPC ID</dt><dd>{{ selected.vpc }}</dd></div>
        <div><dt>Service name</dt><dd>{{ selected.serviceName }}</dd></div>
        <div><dt>Endpoint type</dt><dd>{{ selected.type }}</dd></div>
        <div><dt>Private DNS names enabled</dt><dd>{{ selected.type === 'Gateway' ? '-' : (selected.private_dns ? 'Yes' : 'No') }}</dd></div>
        <div><dt>Route tables</dt><dd>{{ selected.route_tables.join(', ') || '-' }}</dd></div>
        <div><dt>Subnets</dt><dd>{{ selected.subnets.join(', ') || '-' }}</dd></div>
        <div><dt>Security groups</dt><dd>{{ (selected.sgs || []).join(', ') || '-' }}</dd></div>
        <div><dt>IP addresses</dt><dd>{{ (selected.ips || []).join(', ') || '-' }}</dd></div>
      </dl></div>
    </section>
    <CsDelete v-if="deleting && selected" title="Delete endpoints" word="delete" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="ep__p">Delete <span class="cs-mono">{{ selected.id }}</span> ({{ selected.serviceName }})? A gateway endpoint's routes are removed from its route tables.</p>
    </CsDelete>
  </div>

  <div v-else>
    <CsHeader title="Create endpoint" description="There are three types of VPC endpoints - interface endpoints, Gateway Load Balancer endpoints, and gateway endpoints." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Services" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-scroll-x"><table class="cs-table-mini">
          <thead><tr><th /><th>Service Name</th><th>Owner</th><th>Type</th></tr></thead>
          <tbody><tr v-for="s in SERVICES_LIST" :key="s.name + s.type" @click="pick(s)">
            <td><input type="radio" name="ep-svc" :checked="form.service === s.name && form.type === s.type" @change="pick(s)" /></td>
            <td>com.amazonaws.{{ ctx.home.value }}.{{ s.name }}</td><td>amazon</td><td>{{ s.type }}</td></tr></tbody></table></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Network settings" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">VPC</label>
          <select v-model="form.vpc" class="cs-select"><option v-for="v in vpcs" :key="v.id" :value="v.id">{{ v.id }} ({{ v.name }})</option></select></div>
        <label v-if="form.type === 'Interface'" class="cs-check"><input v-model="form.privateDns" type="checkbox" />
          <span>Enable DNS name<small>Resolve the service's public name to the endpoint's private IP addresses inside the VPC.</small></span></label>
      </div>
    </section>
    <section v-if="form.type === 'Gateway'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Route tables" :level="2" description="A route to the service's prefix list is added to each selected route table." /></div>
      <div class="cs-container__body cs-scroll-x"><table class="cs-table-mini"><thead><tr><th /><th>Route table ID</th><th>Name</th><th>Associated with</th></tr></thead>
        <tbody><tr v-for="t in vpcTables" :key="t.id"><td><input v-model="form.tables" type="checkbox" :value="t.id" /></td>
          <td class="cs-mono">{{ t.id }}</td><td>{{ t.name }}</td><td>{{ t.subnets.join(', ') || '-' }}</td></tr></tbody></table></div>
    </section>
    <template v-else>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Subnets" :level="2" /></div>
        <div class="cs-container__body cs-scroll-x"><table class="cs-table-mini"><thead><tr><th /><th>Subnet ID</th><th>Name</th><th>Availability Zone</th></tr></thead>
          <tbody><tr v-for="s in vpcSubnets" :key="s.id"><td><input v-model="form.subnets" type="checkbox" :value="s.id" /></td>
            <td class="cs-mono">{{ s.id }}</td><td>{{ s.name }}</td><td>{{ s.az }}</td></tr></tbody></table></div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Security groups" :level="2" /></div>
        <div class="cs-container__body cs-scroll-x"><table class="cs-table-mini"><thead><tr><th /><th>Group ID</th><th>Group name</th></tr></thead>
          <tbody><tr v-for="g in vpcGroups" :key="g.id"><td><input v-model="form.sgs" type="checkbox" :value="g.id" /></td>
            <td class="cs-mono">{{ g.id }}</td><td>{{ g.name }}</td></tr></tbody></table></div>
      </section>
    </template>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('vpc', 'endpoints')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !form.service || (form.type === 'Interface' && !form.subnets.length)" @click="create">
        <span v-if="busy" class="cs-btn__spinner" />Create endpoint</button>
    </div>
  </div>

  <CsModal v-if="dnsFor" title="Modify private DNS name" @close="dnsFor = null">
    <label class="cs-check"><input v-model="dnsOn" type="checkbox" /><span>Enable private DNS names</span></label>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="dnsFor = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveDns">Save changes</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const SERVICES_LIST = [
  { name: 's3', type: 'Gateway' }, { name: 'dynamodb', type: 'Gateway' }, { name: 's3', type: 'Interface' },
  { name: 'ssm', type: 'Interface' }, { name: 'ssmmessages', type: 'Interface' }, { name: 'ec2messages', type: 'Interface' },
  { name: 'logs', type: 'Interface' }, { name: 'monitoring', type: 'Interface' },
];

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const busy = ref(false);
const deleting = ref(false);
const dnsFor = ref<any>(null);
const dnsOn = ref(false);

const vpcs = computed(() => rows<any>(ctx.c.value, 'net.vpcs'));
const endpoints = computed(() => rows<any>(ctx.c.value, 'net.endpoints').map(e => ({
  ...e, serviceName: `com.amazonaws.${ctx.home.value}.${e.service}`,
})));
const selected = computed<any>(() => endpoints.value.find(e => e.id === sel.value[0]) || null);
const cols = [
  { id: 'name', header: 'Name', cell: () => '-' }, { id: 'id', header: 'VPC endpoint ID', sortKey: 'id' },
  { id: 'vpc', header: 'VPC ID', sortKey: 'vpc' }, { id: 'serviceName', header: 'Service name', sortKey: 'serviceName' },
  { id: 'type', header: 'Endpoint type', sortKey: 'type' }, { id: 'state', header: 'Status' },
];
const actions = computed(() => [
  { id: 'dns', text: 'Modify private DNS name', disabled: selected.value?.type !== 'Interface' },
  { id: 'delete', text: 'Delete VPC endpoints' },
]);

const form = reactive({ service: 's3', type: 'Gateway', vpc: 'vpc-0prod20a1b2c3d4e', tables: [] as string[],
  subnets: [] as string[], sgs: [] as string[], privateDns: true });
const vpcTables = computed(() => rows<any>(ctx.c.value, 'net.route_tables').filter(t => t.vpc === form.vpc));
const vpcSubnets = computed(() => rows<any>(ctx.c.value, 'net.subnets').filter(s => s.vpc === form.vpc));
const vpcGroups = computed(() => rows<any>(ctx.c.value, 'net.sgs').filter(g => g.vpc === form.vpc));
function pick(s: { name: string; type: string }) { form.service = s.name; form.type = s.type; }

function act(action: string) {
  if (!selected.value) return;
  if (action === 'delete') deleting.value = true;
  if (action === 'dns') { dnsFor.value = selected.value; dnsOn.value = selected.value.private_dns; }
}
async function create() {
  busy.value = true;
  const gateway = form.type === 'Gateway';
  const result = await ctx.run(cli(['aws', 'ec2', 'create-vpc-endpoint'], {
    '--vpc-id': form.vpc, '--vpc-endpoint-type': form.type,
    '--service-name': `com.amazonaws.${ctx.home.value}.${form.service}`,
    '--route-table-ids': gateway ? form.tables : [], '--subnet-ids': gateway ? [] : form.subnets,
    '--security-group-ids': gateway ? [] : form.sgs,
    '--private-dns-enabled': !gateway && form.privateDns, '--no-private-dns-enabled': !gateway && !form.privateDns,
  }));
  busy.value = false;
  if (result.ok) {
    let eid = '';
    try { eid = JSON.parse(result.output || '{}').VpcEndpoint.VpcEndpointId; } catch { /* ignored */ }
    ctx.api.notify('success', `Successfully created VPC endpoint ${eid}`);
    ctx.to('vpc', 'endpoints');
  }
}
async function saveDns() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'modify-vpc-endpoint'], {
    '--vpc-endpoint-id': dnsFor.value.id, '--private-dns-enabled': dnsOn.value, '--no-private-dns-enabled': !dnsOn.value,
  }), `Modified private DNS name for ${dnsFor.value.id}`);
  busy.value = false;
  if (result.ok) dnsFor.value = null;
}
async function remove() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-vpc-endpoints'], { '--vpc-endpoint-ids': [selected.value.id] }),
    `Successfully deleted VPC endpoint ${selected.value.id}`);
  busy.value = false;
  deleting.value = false;
  if (result.ok) sel.value = [];
}
</script>

<style scoped>
.ep__p { margin: 0; }
.ep__detail { margin-top: 20px; }
</style>
