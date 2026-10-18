<template>
  <!-- Your VPCs -->
  <CsTable v-if="page === 'vpcs'" variant="full-page" title="Your VPCs" :items="vpcs" :columns="vpcCols" track-by="id"
           selection-type="single" v-model:selected="sel" filter-placeholder="Filter VPCs"
           description="A VPC is an isolated portion of the AWS Cloud populated by AWS objects, such as Amazon EC2 instances.">
    <template #actions>
      <button type="button" class="cs-btn" disabled>Actions</button>
      <button type="button" class="cs-btn cs-btn--primary" disabled title="This estate's VPCs are owned by the network team">Create VPC</button>
    </template>
    <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'vpc', { id: row.id })">{{ row.id }}</a></template>
    <template #cell-state><CsStatus state="available" /></template>
  </CsTable>

  <!-- One VPC -->
  <div v-else-if="page === 'vpc'">
    <template v-if="vpc">
      <CsHeader :title="`${vpc.id} / ${vpc.name}`" />
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
        <div class="cs-container__body">
          <dl class="cs-kv">
            <div><dt>VPC ID</dt><dd class="cs-mono">{{ vpc.id }}</dd></div>
            <div><dt>State</dt><dd><CsStatus state="available" /></dd></div>
            <div><dt>IPv4 CIDR</dt><dd>{{ vpc.cidr }}</dd></div>
            <div><dt>Owner ID</dt><dd>{{ vpc.account }}</dd></div>
            <div><dt>Main route table</dt><dd>{{ mainTable(vpc.id) || '-' }}</dd></div>
            <div><dt>Main network ACL</dt><dd>{{ mainAcl(vpc.id) || '-' }}</dd></div>
            <div><dt>Flow logs</dt><dd>{{ (vpc.flow_logs || []).length ? 'Enabled' : 'No flow logs' }}</dd></div>
          </dl>
        </div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader :title="`Subnets (${vpcSubnets.length})`" :level="2" /></div>
        <div class="cs-container__body cs-scroll-x">
          <table class="cs-table-mini">
            <thead><tr><th>Name</th><th>Subnet ID</th><th>IPv4 CIDR</th><th>Availability Zone</th><th>Route table</th><th>Network ACL</th></tr></thead>
            <tbody><tr v-for="s in vpcSubnets" :key="s.id"><td>{{ s.name }}</td>
              <td><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'subnet', { id: s.id })">{{ s.id }}</a></td>
              <td>{{ s.cidr }}</td><td>{{ s.az }}</td><td>{{ s.rt }}</td><td>{{ s.acl }}</td></tr></tbody>
          </table>
        </div>
      </section>
    </template>
    <NotFound v-else what="VPC" :id="id" back="vpcs" />
  </div>

  <!-- Subnets -->
  <div v-else-if="page === 'subnets'">
    <CsTable variant="full-page" title="Subnets" :items="subnets" :columns="subnetCols" track-by="id"
             selection-type="single" v-model:selected="sel" filter-placeholder="Find resources by attribute or tag">
      <template #actions>
        <CsDropdown :items="[{ id: 'delete', text: 'Delete subnet', disabled: !selected }]" @select="deleting = true" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('vpc', 'subnet-create')">Create subnet</button>
      </template>
      <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'subnet', { id: row.id })">{{ row.id }}</a></template>
      <template #cell-state><CsStatus state="available" /></template>
    </CsTable>
    <CsDelete v-if="deleting && selected" title="Delete subnet" word="delete" :busy="busy" @close="deleting = false" @confirm="removeSubnet(selected.id)">
      <p class="vb__p">Are you sure that you want to delete the following subnet? <span class="cs-mono">{{ selected.id }}</span> / {{ selected.name }}</p>
    </CsDelete>
  </div>

  <!-- One subnet -->
  <div v-else-if="page === 'subnet'">
    <template v-if="subnet">
      <CsHeader :title="`${subnet.id} / ${subnet.name}`">
        <template #actions><CsDropdown :items="[{ id: 'delete', text: 'Delete subnet' }]" @select="deleting = true" /></template>
      </CsHeader>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
        <div class="cs-container__body">
          <dl class="cs-kv">
            <div><dt>Subnet ID</dt><dd class="cs-mono">{{ subnet.id }}</dd></div>
            <div><dt>State</dt><dd><CsStatus state="available" /></dd></div>
            <div><dt>VPC</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'vpc', { id: subnet.vpc })">{{ subnet.vpc }}</a></dd></div>
            <div><dt>IPv4 CIDR</dt><dd>{{ subnet.cidr }}</dd></div>
            <div><dt>Availability Zone</dt><dd>{{ subnet.az }}</dd></div>
            <div><dt>Route table</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'route-table', { id: subnet.rt })">{{ subnet.rt }}</a></dd></div>
            <div><dt>Network ACL</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'acl', { id: subnet.acl })">{{ subnet.acl }}</a></dd></div>
            <div><dt>Auto-assign public IPv4 address</dt><dd>{{ subnet.public ? 'Yes' : 'No' }}</dd></div>
          </dl>
        </div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader :title="`Route table: ${subnet.rt}`" :level="2" /></div>
        <div class="cs-container__body cs-scroll-x">
          <table class="cs-table-mini"><thead><tr><th>Destination</th><th>Target</th><th>Status</th></tr></thead>
            <tbody><tr v-for="rr in routesOf(subnet.rt)" :key="rr.dest"><td>{{ rr.dest }}</td><td>{{ rr.target }}</td>
              <td><CsStatus :type="rr.blackhole ? 'error' : 'success'" :label="rr.blackhole ? 'Blackhole' : 'Active'" /></td></tr></tbody></table>
        </div>
      </section>
      <CsDelete v-if="deleting" title="Delete subnet" word="delete" :busy="busy" @close="deleting = false" @confirm="removeSubnet(subnet.id)">
        <p class="vb__p">Are you sure that you want to delete <span class="cs-mono">{{ subnet.id }}</span>?</p>
      </CsDelete>
    </template>
    <NotFound v-else what="Subnet" :id="id" back="subnets" />
  </div>

  <!-- Create subnet -->
  <div v-else-if="page === 'subnet-create'">
    <CsHeader title="Create subnet" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="VPC" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">VPC ID</label>
          <p class="cs-desc">Create subnets in this VPC.</p>
          <select v-model="form.vpc" class="cs-select"><option v-for="v in vpcs" :key="v.id" :value="v.id">{{ v.id }} ({{ v.name }})</option></select></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Subnet settings" :level="2" description="Specify the CIDR blocks and Availability Zone for the subnet." /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Subnet name</label>
          <p class="cs-desc">Create a tag with a key of 'Name' and a value that you specify.</p>
          <input v-model="form.name" class="cs-input" placeholder="my-subnet-01" />
          <span class="cs-constraint">The name can be up to 256 characters long.</span></div>
        <div class="cs-field"><label class="cs-label">Availability Zone</label>
          <select v-model="form.az" class="cs-select"><option value="eu-west-1a">Europe (Ireland) / eu-west-1a</option>
            <option value="eu-west-1b">Europe (Ireland) / eu-west-1b</option><option value="eu-west-1c">Europe (Ireland) / eu-west-1c</option></select></div>
        <div class="cs-field"><label class="cs-label">IPv4 subnet CIDR block</label>
          <input v-model="form.cidr" class="cs-input" :class="{ 'is-invalid': cidrProblem }" placeholder="10.20.40.0/24" />
          <span v-if="cidrProblem" class="cs-error-text">{{ cidrProblem }}</span>
          <span v-else class="cs-constraint">VPC CIDR: {{ vpcById(form.vpc)?.cidr }}</span></div>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('vpc', 'subnets')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !form.cidr || !!cidrProblem" @click="createSubnet">
        <span v-if="busy" class="cs-btn__spinner" />Create subnet</button>
    </div>
  </div>

  <!-- Internet gateways -->
  <CsTable v-else-if="page === 'igws'" variant="full-page" title="Internet gateways" :items="igws" :columns="igwCols" track-by="id">
    <template #cell-state><CsStatus state="attached" /></template>
  </CsTable>

  <!-- NAT gateways -->
  <CsTable v-else-if="page === 'nats'" variant="full-page" title="NAT gateways" :items="nats" :columns="natCols" track-by="id">
    <template #cell-state="{ row }"><CsStatus :state="row.state" /></template>
  </CsTable>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RULES, cli, rows, validate } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import NotFound from './NotFound.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const id = computed(() => ctx.route.value.params?.id || '');
const sel = ref<string[]>([]);
const deleting = ref(false);
const busy = ref(false);

const vpcs = computed(() => rows<any>(ctx.c.value, 'net.vpcs'));
const subnets = computed(() => rows<any>(ctx.c.value, 'net.subnets'));
const tables = computed(() => rows<any>(ctx.c.value, 'net.route_tables'));
const acls = computed(() => rows<any>(ctx.c.value, 'net.acls'));
const igws = computed(() => rows<any>(ctx.c.value, 'net.igws').map(g => ({ ...g, name: g.id })));
const nats = computed(() => rows<any>(ctx.c.value, 'net.nats').map(n => ({ ...n, vpc: subnetById(n.subnet)?.vpc || '' })));

const vpc = computed(() => vpcs.value.find(v => v.id === id.value) || null);
const subnet = computed(() => subnets.value.find(s => s.id === id.value) || null);
const vpcSubnets = computed(() => subnets.value.filter(s => s.vpc === vpc.value?.id));
const selected = computed(() => subnets.value.find(s => s.id === sel.value[0]) || null);

function vpcById(vid: string) { return vpcs.value.find(v => v.id === vid); }
function subnetById(sid: string) { return subnets.value.find(s => s.id === sid); }
function mainTable(vid: string) { return tables.value.find(t => t.vpc === vid)?.id; }
function mainAcl(vid: string) { return acls.value.find(a => a.vpc === vid && a.name === 'default')?.id; }
function routesOf(tid: string) { return tables.value.find(t => t.id === tid)?.routes || []; }

const vpcCols = [
  { id: 'name', header: 'Name', sortKey: 'name' }, { id: 'id', header: 'VPC ID', sortKey: 'id' },
  { id: 'state', header: 'State' }, { id: 'cidr', header: 'IPv4 CIDR', sortKey: 'cidr' },
  { id: 'rt', header: 'Main route table', cell: (v: any) => mainTable(v.id) },
  { id: 'acl', header: 'Main network ACL', cell: (v: any) => mainAcl(v.id) },
  { id: 'account', header: 'Owner ID', sortKey: 'account' },
];
const subnetCols = [
  { id: 'name', header: 'Name', sortKey: 'name' }, { id: 'id', header: 'Subnet ID', sortKey: 'id' },
  { id: 'state', header: 'State' }, { id: 'vpc', header: 'VPC', sortKey: 'vpc' },
  { id: 'cidr', header: 'IPv4 CIDR', sortKey: 'cidr' }, { id: 'az', header: 'Availability Zone', sortKey: 'az' },
  { id: 'rt', header: 'Route table', sortKey: 'rt' }, { id: 'acl', header: 'Network ACL', sortKey: 'acl' },
];
const igwCols = [{ id: 'name', header: 'Name' }, { id: 'id', header: 'Internet gateway ID' },
  { id: 'state', header: 'State' }, { id: 'vpc', header: 'VPC ID' }];
const natCols = [{ id: 'id', header: 'NAT gateway ID' }, { id: 'state', header: 'State' },
  { id: 'public_ip', header: 'Primary public IPv4 address' }, { id: 'subnet', header: 'Subnet' }, { id: 'vpc', header: 'VPC' }];

const form = reactive({ vpc: 'vpc-0prod20a1b2c3d4e', name: '', az: 'eu-west-1a', cidr: '' });
const cidrProblem = computed(() => validate(form.cidr, [RULES.cidr('IPv4 subnet CIDR block')]));

async function createSubnet() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'create-subnet'], {
    '--vpc-id': form.vpc, '--cidr-block': form.cidr.trim(), '--availability-zone': form.az,
    '--tag-specifications': form.name.trim() ? `ResourceType=subnet,Tags=[{Key=Name,Value=${form.name.trim()}}]` : '',
  }), 'You have successfully created 1 subnet.');
  busy.value = false;
  if (result.ok) ctx.to('vpc', 'subnets');
}
async function removeSubnet(sid: string) {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-subnet'], { '--subnet-id': sid }),
    `Successfully deleted subnet ${sid}`);
  busy.value = false;
  deleting.value = false;
  if (result.ok && page.value === 'subnet') ctx.to('vpc', 'subnets');
}
</script>

<style scoped>
.vb__p { margin: 0; }
</style>
