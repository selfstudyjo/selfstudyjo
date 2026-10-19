<template>
  <!-- Route tables -->
  <div v-if="page === 'routes'">
    <CsTable v-model:selected="selRtb" title="Route tables" variant="full-page" :items="routeTables" :columns="rtbColumns" track-by="id"
             selection-type="single" empty-title="No route tables">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!currentRtb" @click="routeOpen = true">Edit routes</button>
      </template>
    </CsTable>
    <section v-if="currentRtb" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Routes (${currentRtb.routes.length}) - ${currentRtb.id}`" :level="2" :info="false" /></div>
      <div class="cs-container__body"><table class="cs-table-mini"><thead><tr><th>Destination</th><th>Target</th><th>Status</th><th /></tr></thead>
        <tbody><tr v-for="r in currentRtb.routes" :key="r.dest"><td class="cs-mono">{{ r.dest }}</td><td class="cs-mono">{{ r.target }}</td><td>Active</td>
          <td><button v-if="r.kind === 'nat' || r.kind === 'igw'" type="button" class="cs-btn cs-btn--inline" :disabled="busy" @click="deleteRoute(r.dest)">Remove</button></td></tr></tbody></table>
        <p class="cs-muted">Subnet associations: {{ currentRtb.associations.join(', ') || (currentRtb.main ? 'main route table' : 'none') }}</p></div>
    </section>
    <CsModal v-if="routeOpen && currentRtb" title="Add route" @close="routeOpen = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="rt-dest">Destination</label><input id="rt-dest" v-model.trim="route.dest" class="cs-input cs-mono" /></div>
        <div class="cs-field"><label class="cs-label" for="rt-target">Target</label>
          <select id="rt-target" v-model="route.target" class="cs-select">
            <option v-for="n in nats" :key="n.id" :value="n.id">NAT Gateway {{ n.id }} {{ n.name ? '(' + n.name + ')' : '' }}</option>
            <option v-for="g in igws" :key="g.id" :value="g.id">Internet Gateway {{ g.id }}</option></select></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="routeOpen = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!route.dest || !route.target || busy" @click="addRoute">Save changes</button>
      </template>
    </CsModal>
  </div>

  <!-- NAT gateways -->
  <div v-else-if="page === 'nats'">
    <CsTable title="NAT gateways" variant="full-page" :items="nats" :columns="natColumns" track-by="id" empty-title="No NAT gateways"
             description="A NAT gateway is billed per hour and per gigabyte it processes - including traffic to S3 that a gateway endpoint would carry for free." />
  </div>

  <!-- Create endpoint -->
  <div v-else-if="page === 'endpoint-create'">
    <CsHeader title="Create endpoint" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Endpoint settings" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="ep-name">Name tag <small>- optional</small></label><input id="ep-name" v-model.trim="ep.name" class="cs-input" /></div>
        <div class="cs-field"><span class="cs-label">Type</span><label class="cs-radio"><input type="radio" checked /> AWS services</label></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Services" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="ep-svc">Service name</label>
          <select id="ep-svc" v-model="ep.service" class="cs-select"><option v-for="s in services" :key="s" :value="s">{{ s }}</option></select></div>
        <div class="cs-row">
          <label class="cs-radio"><input v-model="ep.type" type="radio" value="Gateway" :disabled="!gatewayable" /> Gateway</label>
          <label class="cs-radio"><input v-model="ep.type" type="radio" value="Interface" /> Interface</label>
        </div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Network settings" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="ep-vpc">VPC</label>
          <select id="ep-vpc" v-model="ep.vpc" class="cs-select"><option v-for="v in vpcs" :key="v.id" :value="v.id">{{ v.id }} {{ v.name ? '(' + v.name + ')' : '' }}</option></select></div>
        <div v-if="ep.type === 'Gateway'" class="cs-field"><span class="cs-label">Route tables</span>
          <label v-for="t in vpcRouteTables" :key="t.id" class="cs-check"><input v-model="ep.tables" type="checkbox" :value="t.id" /> {{ t.id }} {{ t.name ? '(' + t.name + ')' : '' }}{{ t.main ? ' - main' : '' }}</label></div>
        <template v-else>
          <div class="cs-field"><span class="cs-label">Subnets</span>
            <label v-for="s in vpcSubnets" :key="s.id" class="cs-check"><input v-model="ep.subnets" type="checkbox" :value="s.id" /> {{ s.id }} {{ s.name ? '(' + s.name + ')' : '' }} - {{ s.az }}</label></div>
          <div class="cs-field"><span class="cs-label">Security groups</span>
            <label v-for="g in vpcGroups" :key="g.id" class="cs-check"><input v-model="ep.sgs" type="checkbox" :value="g.id" /> {{ g.id }} ({{ g.name }})</label></div>
          <label class="cs-check"><input v-model="ep.privateDns" type="checkbox" /> Enable DNS name <small>Requires DNS hostnames and DNS resolution on the VPC.</small></label>
        </template>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Policy" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <label class="cs-radio"><input v-model="ep.policyMode" type="radio" value="full" /> Full access</label>
        <label class="cs-radio"><input v-model="ep.policyMode" type="radio" value="custom" /> Custom</label>
        <textarea v-if="ep.policyMode === 'custom'" v-model="ep.policy" class="cs-textarea cs-mono vn__policy" spellcheck="false" aria-label="Endpoint policy" />
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('vpc', 'endpoints')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="createEndpoint">Create endpoint</button>
    </div>
  </div>

  <!-- Endpoints -->
  <div v-else>
    <CsTable v-model:selected="selEp" title="Endpoints" variant="full-page" :items="endpoints" :columns="epColumns" track-by="id"
             selection-type="single" empty-title="No endpoints" empty-text="You do not have any endpoints in this Region.">
      <template #actions>
        <CsDropdown :items="[{ id: 'policy', text: 'Manage policy' }, { id: 'delete', text: 'Delete VPC endpoints' }]" :disabled="!currentEp" @select="epAction" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('vpc', 'endpoint-create')">Create endpoint</button>
      </template>
      <template #cell-state="{ row }"><CsStatus state="available" label="Available" /></template>
    </CsTable>
    <CsModal v-if="policyOpen && currentEp" :title="`Manage policy: ${currentEp.id}`" size="large" @close="policyOpen = false">
      <textarea v-model="policyText" class="cs-textarea cs-mono vn__policy" spellcheck="false" aria-label="Endpoint policy" />
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="policyOpen = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="savePolicy">Save</button>
      </template>
    </CsModal>
    <CsDelete v-if="epDeleting && currentEp" title="Delete endpoints" word="delete" :busy="busy" @close="epDeleting = false" @confirm="deleteEndpoint">
      <p>{{ currentEp.id }} ({{ currentEp.service_name }})</p>
    </CsDelete>
  </div>
</template>

<script setup lang="ts">
/** VPC: route tables (routes to NAT/IGW), NAT gateways, and gateway/interface endpoints with policies. */
import { computed, reactive, ref, watch } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsModal from '../CsModal.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const page = computed(() => ctx.route.value.page);
const routeTables = computed(() => rows(ctx.view.value, 'ec2.route_tables'));
const nats = computed(() => rows(ctx.view.value, 'ec2.nat_gateways'));
const igws = computed(() => rows(ctx.view.value, 'ec2.internet_gateways'));
const endpoints = computed(() => rows(ctx.view.value, 'ec2.vpc_endpoints'));
const vpcs = computed(() => rows(ctx.view.value, 'ec2.vpcs'));
const services = computed(() => rows<string>(ctx.view.value, 'ec2.endpoint_services'));
const busy = ref(false);
const selRtb = ref<string[]>([]);
const currentRtb = computed(() => routeTables.value.find(t => t.id === selRtb.value[0]) || null);
const routeOpen = ref(false);
const route = reactive({ dest: '0.0.0.0/0', target: '' });
const selEp = ref<string[]>([]);
const currentEp = computed(() => endpoints.value.find(e => e.id === selEp.value[0]) || null);
const policyOpen = ref(false);
const policyText = ref('');
const epDeleting = ref(false);
const ep = reactive({ name: '', service: '', type: 'Gateway', vpc: '', tables: [] as string[], subnets: [] as string[],
  sgs: [] as string[], privateDns: true, policyMode: 'full', policy: '' });
watch([services, vpcs], () => {
  if (!ep.service) ep.service = services.value.find(s => s.endsWith('.s3')) || services.value[0] || '';
  if (!ep.vpc) ep.vpc = (vpcs.value.find(v => !v.default) || vpcs.value[0] || {}).id || '';
}, { immediate: true });
const gatewayable = computed(() => /\.(s3|dynamodb)$/.test(ep.service));
watch(gatewayable, ok => { ep.type = ok ? 'Gateway' : 'Interface'; });
const vpcRouteTables = computed(() => routeTables.value.filter(t => t.vpc === ep.vpc));
const vpcSubnets = computed(() => rows(ctx.view.value, 'ec2.subnets').filter(s => s.vpc === ep.vpc));
const vpcGroups = computed(() => rows(ctx.view.value, 'ec2.security_groups').filter(g => g.vpc === ep.vpc));

const rtbColumns: Column[] = [
  { id: 'name', header: 'Name', cell: r => r.name || '-' }, { id: 'id', header: 'Route table ID' },
  { id: 'associations', header: 'Explicit subnet associations', cell: r => (r.associations || []).length || '-' },
  { id: 'main', header: 'Main', cell: r => (r.main ? 'Yes' : 'No') }, { id: 'vpc', header: 'VPC' },
];
const natColumns: Column[] = [
  { id: 'name', header: 'Name', cell: r => r.name || '-' }, { id: 'id', header: 'NAT gateway ID' },
  { id: 'state', header: 'State' }, { id: 'ip', header: 'Primary public IPv4 address' },
  { id: 'subnet', header: 'Subnet' }, { id: 'vpc', header: 'VPC' },
];
const epColumns: Column[] = [
  { id: 'id', header: 'VPC endpoint ID' }, { id: 'type', header: 'Endpoint type' }, { id: 'state', header: 'Status' },
  { id: 'service_name', header: 'Service name' }, { id: 'vpc', header: 'VPC ID' },
  { id: 'policy', header: 'Policy', cell: r => (r.restricted ? 'Custom' : 'Full access') },
];

async function addRoute() {
  busy.value = true;
  const flag = route.target.startsWith('nat-') ? '--nat-gateway-id' : '--gateway-id';
  const result = await ctx.run(cli(['aws', 'ec2', 'create-route'], { '--route-table-id': currentRtb.value!.id,
    '--destination-cidr-block': route.dest, [flag]: route.target }), 'Updated routes.');
  busy.value = false;
  if (result.ok) routeOpen.value = false;
}
async function deleteRoute(dest: string) {
  busy.value = true;
  await ctx.run(cli(['aws', 'ec2', 'delete-route'], { '--route-table-id': currentRtb.value!.id, '--destination-cidr-block': dest }),
    `Removed the route to ${dest}.`);
  busy.value = false;
}
async function createEndpoint() {
  busy.value = true;
  const flags: Record<string, any> = { '--vpc-id': ep.vpc, '--service-name': ep.service, '--vpc-endpoint-type': ep.type };
  if (ep.type === 'Gateway') flags['--route-table-ids'] = ep.tables;
  else {
    flags['--subnet-ids'] = ep.subnets;
    flags['--security-group-ids'] = ep.sgs;
    flags[ep.privateDns ? '--private-dns-enabled' : '--no-private-dns-enabled'] = true;
  }
  if (ep.policyMode === 'custom' && ep.policy.trim()) flags['--policy-document'] = ep.policy;
  if (ep.name) flags['--tag-specifications'] = `ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=${ep.name}}]`;
  const result = await ctx.run(cli(['aws', 'ec2', 'create-vpc-endpoint'], flags), 'Successfully created VPC endpoint.');
  busy.value = false;
  if (result.ok) ctx.to('vpc', 'endpoints');
}
function epAction(id: string) {
  if (id === 'policy') {
    const parsed = parseJson(currentEp.value!.policy);
    policyText.value = parsed ? JSON.stringify(parsed, null, 2) : currentEp.value!.policy;
    policyOpen.value = true;
  } else epDeleting.value = true;
}
async function savePolicy() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'modify-vpc-endpoint'], { '--vpc-endpoint-id': currentEp.value!.id, '--policy-document': policyText.value }),
    'Policy updated.');
  busy.value = false;
  if (result.ok) policyOpen.value = false;
}
async function deleteEndpoint() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-vpc-endpoints'], { '--vpc-endpoint-ids': [currentEp.value!.id] }), 'Endpoint deleted.');
  busy.value = false;
  if (result.ok) { epDeleting.value = false; selEp.value = []; }
}
</script>

<style scoped>
.vn__policy { min-height: 260px; }
</style>
