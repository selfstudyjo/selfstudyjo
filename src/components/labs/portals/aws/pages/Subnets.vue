<template>
  <div v-if="creating">
    <CsHeader title="Create subnet" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="VPC" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <div class="cs-field"><label class="cs-label" for="sc-vpc">VPC ID</label>
          <div class="cs-desc">Create subnets in this VPC.</div>
          <select id="sc-vpc" v-model="vpc" class="cs-select">
            <option value="" disabled>Select a VPC</option>
            <option v-for="v in vpcs" :key="v.id" :value="v.id">{{ v.id }}{{ v.name ? ` (${v.name})` : '' }}</option>
          </select></div>
        <dl v-if="vpcRow" class="cs-kv sc__assoc"><div><dt>Associated VPC CIDRs</dt><dd>IPv4 CIDRs: {{ vpcRow.cidr }}</dd></div></dl>
      </div>
    </section>
    <section v-for="(sub, index) in subnetForms" :key="index" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Subnet ${index + 1} of ${subnetForms.length}`" :level="2" :info="false">
        <template #actions><button v-if="subnetForms.length > 1" type="button" class="cs-btn" @click="subnetForms.splice(index, 1)">Remove</button></template>
      </CsHeader></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" :for="`sc-name-${index}`">Subnet name</label>
          <div class="cs-desc">Create a tag with a key of 'Name' and a value that you specify.</div>
          <input :id="`sc-name-${index}`" v-model="sub.name" class="cs-input" placeholder="my-subnet-01" /></div>
        <div class="cs-field"><label class="cs-label" :for="`sc-az-${index}`">Availability Zone <a class="cs-link sc__info">Info</a></label>
          <div class="cs-desc">Choose the zone in which your subnet will reside, or let Amazon choose one for you.</div>
          <select :id="`sc-az-${index}`" v-model="sub.az" class="cs-select">
            <option value="">No preference</option>
            <option v-for="z in zones" :key="z" :value="z">{{ regionName(ctx.region.value) }} / {{ z }}</option>
          </select></div>
        <div class="cs-field"><label class="cs-label" :for="`sc-cidr-${index}`">IPv4 subnet CIDR block</label>
          <input :id="`sc-cidr-${index}`" v-model.trim="sub.cidr" class="cs-input" :class="{ 'is-invalid': cidrError(sub.cidr) }" placeholder="10.0.1.0/24" />
          <span v-if="cidrError(sub.cidr)" class="cs-error-text">{{ cidrError(sub.cidr) }}</span></div>
      </div>
    </section>
    <button type="button" class="cs-btn" @click="subnetForms.push({ name: '', az: '', cidr: '' })">Add new subnet</button>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('vpc', 'subnets')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !vpc || subnetForms.some(s => !s.cidr || cidrError(s.cidr))" @click="create">Create subnet</button>
    </div>
  </div>
  <div v-else>
    <CsTable v-model:selected="selected" title="Subnets" variant="full-page" :items="subnets" :columns="columns" track-by="id"
             selection-type="multi" filter-placeholder="Find resources by attribute or tag" empty-title="No subnets found">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Subnets refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="actions" :disabled="!selected.length" @select="act" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('vpc', 'subnet-create')">Create subnet</button>
      </template>
      <template #cell-state="{ row }"><CsStatus :state="row.state || 'available'" /></template>
    </CsTable>
    <CsDelete v-if="modal === 'delete'" title="Delete subnet" word="delete" :busy="busy" @close="modal = ''" @confirm="remove">
      <p class="sc__p">Are you sure you want to delete the following subnets?</p>
      <ul class="sc__ids"><li v-for="s in chosen" :key="s.id"><span class="cs-mono">{{ s.id }}</span> {{ s.name }}
        <span v-if="s.instances" class="cs-error-text">{{ s.instances }} instance(s) still run in this subnet.</span></li></ul>
    </CsDelete>
    <ManageTags v-if="modal === 'tags' && chosen.length === 1" :resource-id="chosen[0].id" :tags="chosen[0].tags || {}" @close="modal = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RULES, cli, pick, rows, validate } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown, { type DdItem } from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { tagSpec } from '../commands';
import { useAws } from '../ctx';
import { regionName } from '../nav';
import ManageTags from './Ec2ManageTags.vue';

const ctx = useAws();
const creating = computed(() => ctx.route.value.page === 'subnet-create');
const vpcs = computed(() => rows(ctx.view.value, 'ec2.vpcs'));
const zones = computed(() => pick<string[]>(ctx.view.value, 'zones', []));
const subnets = computed(() => rows(ctx.view.value, 'ec2.subnets'));
const selected = ref<string[]>([]);
const chosen = computed(() => subnets.value.filter(s => selected.value.includes(s.id)));
const modal = ref<'' | 'delete' | 'tags'>('');
const busy = ref(false);
const vpc = ref(vpcs.value.find(v => !v.default)?.id || '');
const vpcRow = computed(() => vpcs.value.find(v => v.id === vpc.value));
const subnetForms = ref([{ name: '', az: '', cidr: '' }]);

const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name', cell: r => r.name || '–' },
  { id: 'id', header: 'Subnet ID', sortKey: 'id' },
  { id: 'state', header: 'State' },
  { id: 'vpc', header: 'VPC', sortKey: 'vpc' },
  { id: 'cidr', header: 'IPv4 CIDR', sortKey: 'cidr' },
  { id: 'ipv6', header: 'IPv6 CIDR', cell: () => '–' },
  { id: 'az', header: 'Availability Zone', sortKey: 'az' },
  { id: 'public', header: 'Auto-assign public IPv4 address', cell: r => (r.public ? 'Yes' : 'No') },
  { id: 'owner', header: 'Owner ID', cell: () => ctx.account.value },
];
const actions = computed<DdItem[]>(() => [
  { id: 'settings', text: 'Edit subnet settings', disabled: true },
  { id: 'tags', text: 'Manage tags', disabled: chosen.value.length !== 1 },
  { id: 'delete', text: 'Delete subnet' },
]);

function cidrError(value: string) {
  return value ? validate(value, [RULES.cidr('IPv4 subnet CIDR block')]) : '';
}
function act(id: string) {
  modal.value = id as typeof modal.value;
}
async function create() {
  busy.value = true;
  let made = 0;
  for (const sub of subnetForms.value) {
    const result = await ctx.run(cli(['aws', 'ec2', 'create-subnet'], {
      '--vpc-id': vpc.value, '--cidr-block': sub.cidr, '--availability-zone': sub.az,
      '--tag-specifications': tagSpec('subnet', sub.name.trim() ? [{ key: 'Name', value: sub.name.trim() }] : []),
    }));
    if (result.ok) made += 1;
  }
  busy.value = false;
  if (made === subnetForms.value.length) {
    ctx.api.notify('success', `You have successfully created ${made} subnet(s).`);
    ctx.to('vpc', 'subnets');
  }
}
async function remove() {
  busy.value = true;
  let done = 0;
  for (const subnet of chosen.value) {
    const result = await ctx.run(cli(['aws', 'ec2', 'delete-subnet'], { '--subnet-id': subnet.id }));
    if (result.ok) done += 1;
  }
  busy.value = false;
  modal.value = '';
  selected.value = [];
  if (done) ctx.api.notify('success', `Successfully deleted ${done} subnet(s)`);
}
</script>

<style scoped>
.sc__info { font-size: 12px; font-weight: 700; margin-left: 4px; }
.sc__assoc { margin-top: 14px; }
.sc__p { margin: 0 0 8px; }
.sc__ids { margin: 0; padding-left: 18px; }
</style>
