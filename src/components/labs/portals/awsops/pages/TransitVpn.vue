<template>
  <CsTable v-if="page === 'tgws'" variant="full-page" title="Transit gateways" :items="tgws" :columns="tgwCols" track-by="id">
    <template #cell-state><CsStatus state="available" /></template>
  </CsTable>

  <CsTable v-else-if="page === 'tgw-attachments'" variant="full-page" title="Transit gateway attachments" :items="attachments"
           :columns="attCols" track-by="id" filter-placeholder="Filter transit gateway attachments">
    <template #cell-state="{ row }"><CsStatus :state="row.state" /></template>
  </CsTable>

  <div v-else-if="page === 'tgw-route-tables'">
    <CsTable variant="full-page" title="Transit gateway route tables" :items="tgwTables" :columns="rtCols" track-by="id"
             selection-type="single" v-model:selected="sel">
      <template #cell-state><CsStatus state="available" /></template>
    </CsTable>
    <section v-if="table" class="cs-container tv__detail">
      <div class="cs-container__head"><CsHeader :title="`Routes (${table.routes.length})`" :level="2" :description="`${table.id} / ${table.name}`">
        <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="openRoute">Create static route</button></template></CsHeader></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini"><thead><tr><th>CIDR</th><th>Attachment ID</th><th>Resource type</th><th>Route type</th><th>Route state</th></tr></thead>
          <tbody><tr v-for="rr in table.routes" :key="rr.dest"><td>{{ rr.dest }}</td><td class="cs-mono">{{ rr.target || '-' }}</td>
            <td>{{ attachments.find(a => a.id === rr.target)?.type || '-' }}</td><td>{{ rr.type || 'static' }}</td>
            <td><CsStatus :type="rr.blackhole ? 'error' : 'success'" :label="rr.blackhole ? 'Blackhole' : 'Active'" /></td></tr></tbody></table>
      </div>
    </section>
  </div>

  <div v-else-if="page === 'vpn'">
    <CsTable variant="full-page" title="VPN connections" :items="vpns" :columns="vpnCols" track-by="id" selection-type="single" v-model:selected="sel">
      <template #cell-state><CsStatus state="available" /></template>
    </CsTable>
    <section v-if="vpn" class="cs-container tv__detail">
      <div class="cs-container__head"><CsHeader :title="`Tunnel details: ${vpn.id}`" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini"><thead><tr><th>Tunnel number</th><th>Outside IP address</th><th>Status</th><th>BGP</th></tr></thead>
          <tbody><tr v-for="(t, i) in vpn.tunnels" :key="t.outside"><td>Tunnel {{ Number(i) + 1 }}</td><td>{{ t.outside }}</td>
            <td><CsStatus :type="t.status === 'UP' ? 'success' : 'error'" :label="t.status === 'UP' ? 'Up' : 'Down'" /></td><td>{{ t.bgp }}</td></tr></tbody></table>
      </div>
    </section>
  </div>

  <CsModal v-if="routing" title="Create static route" @close="routing = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">CIDR</label><input v-model="form.cidr" class="cs-input" placeholder="10.40.0.0/16" />
        <span v-if="cidrProblem" class="cs-error-text">{{ cidrProblem }}</span></div>
      <div class="cs-field"><label class="cs-label">Type</label>
        <label class="cs-radio"><input v-model="form.blackhole" type="radio" :value="false" /> Active</label>
        <label class="cs-radio"><input v-model="form.blackhole" type="radio" :value="true" /> Blackhole</label></div>
      <div v-if="!form.blackhole" class="cs-field"><label class="cs-label">Choose attachment</label>
        <select v-model="form.attachment" class="cs-select"><option v-for="a in attachments" :key="a.id" :value="a.id">{{ a.id }} ({{ a.type }} {{ a.resource }})</option></select></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="routing = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !form.cidr || !!cidrProblem" @click="createRoute">Create static route</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RULES, cli, pick, rows, validate } from '@/utils/portalKit';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const busy = ref(false);
const routing = ref(false);

const tgw = computed<any>(() => pick(ctx.c.value, 'net.tgw', {}));
const tgws = computed(() => (tgw.value.id ? [{ ...tgw.value, owner: tgw.value.account }] : []));
const attachments = computed(() => rows<any>(ctx.c.value, 'net.tgw_attachments'));
const tgwTables = computed(() => rows<any>(ctx.c.value, 'net.tgw_route_tables'));
const table = computed<any>(() => tgwTables.value.find(t => t.id === sel.value[0]) || null);
const vpns = computed(() => rows<any>(ctx.c.value, 'net.vpns').map(v => ({ ...v, up: v.tunnels.filter((t: any) => t.status === 'UP').length })));
const vpn = computed<any>(() => vpns.value.find(v => v.id === sel.value[0]) || null);

const tgwCols = [{ id: 'name', header: 'Name' }, { id: 'id', header: 'Transit gateway ID' }, { id: 'state', header: 'State' },
  { id: 'owner', header: 'Owner ID' }, { id: 'asn', header: 'Amazon ASN' }];
const attCols = [{ id: 'id', header: 'Transit gateway attachment ID', sortKey: 'id' }, { id: 'tgw', header: 'Transit gateway ID', cell: () => tgw.value.id },
  { id: 'type', header: 'Resource type', sortKey: 'type' }, { id: 'resource', header: 'Resource ID' }, { id: 'state', header: 'State' },
  { id: 'rt', header: 'Association route table ID' }];
const rtCols = [{ id: 'name', header: 'Name' }, { id: 'id', header: 'Transit gateway route table ID' }, { id: 'state', header: 'State' },
  { id: 'count', header: 'Routes', cell: (t: any) => t.routes.length }];
const vpnCols = [{ id: 'id', header: 'VPN ID' }, { id: 'state', header: 'State' }, { id: 'cgw', header: 'Customer gateway ID' },
  { id: 'cgw_ip', header: 'Customer gateway address' }, { id: 'routing', header: 'Routing', cell: (v: any) => (v.routing === 'bgp' ? 'Dynamic' : 'Static') },
  { id: 'up', header: 'Tunnels up', cell: (v: any) => `${v.up} of ${v.tunnels.length}` }];

const form = reactive({ cidr: '', blackhole: false, attachment: '' });
const cidrProblem = computed(() => validate(form.cidr, [RULES.cidr('CIDR')]));
function openRoute() { form.cidr = ''; form.blackhole = false; form.attachment = attachments.value[0]?.id || ''; routing.value = true; }
async function createRoute() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'create-transit-gateway-route'], {
    '--transit-gateway-route-table-id': table.value.id, '--destination-cidr-block': form.cidr.trim(),
    '--transit-gateway-attachment-id': form.blackhole ? '' : form.attachment, '--blackhole': form.blackhole,
  }), `Static route ${form.cidr} created in ${table.value.id}`);
  busy.value = false;
  if (result.ok) routing.value = false;
}
</script>

<style scoped>
.tv__detail { margin-top: 20px; }
</style>
