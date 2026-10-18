<template>
  <div v-if="creating">
    <CsHeader title="Create VPC"
              description="A VPC is an isolated portion of the AWS Cloud populated by AWS objects, such as Amazon EC2 instances." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="VPC settings" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><span class="cs-label">Resources to create <a class="cs-link vl__info">Info</a></span>
          <div class="cs-desc">Create only the VPC resource or the VPC and other networking resources.</div>
          <div class="cs-tiles">
            <label class="cs-tile is-checked"><input type="radio" checked /><span><strong>VPC only</strong></span></label>
            <label class="cs-tile vl__off"><input type="radio" disabled /><span><strong>VPC and more</strong></span></label>
          </div></div>
        <div class="cs-field"><label class="cs-label" for="vc-name">Name tag - <em>optional</em></label>
          <div class="cs-desc">Creates a tag with a key of 'Name' and a value that you specify.</div>
          <input id="vc-name" v-model="name" class="cs-input" placeholder="my-vpc-01" /></div>
        <div class="cs-field"><span class="cs-label">IPv4 CIDR block <a class="cs-link vl__info">Info</a></span>
          <label class="cs-radio"><input type="radio" checked /> IPv4 CIDR manual input</label>
          <label class="cs-radio vl__off"><input type="radio" disabled /> IPAM-allocated IPv4 CIDR block</label></div>
        <div class="cs-field"><label class="cs-label" for="vc-cidr">IPv4 CIDR</label>
          <input id="vc-cidr" v-model.trim="cidr" class="cs-input" :class="{ 'is-invalid': cidrError }" placeholder="10.0.0.0/16" />
          <span v-if="cidrError" class="cs-error-text">{{ cidrError }}</span>
          <span class="cs-constraint">CIDR block size must be between /16 and /28.</span></div>
        <div class="cs-field"><span class="cs-label">IPv6 CIDR block</span>
          <label class="cs-radio"><input type="radio" checked /> No IPv6 CIDR block</label>
          <label class="cs-radio vl__off"><input type="radio" disabled /> Amazon-provided IPv6 CIDR block</label></div>
        <div class="cs-field"><span class="cs-label">Tenancy</span>
          <select class="cs-select" disabled><option>Default</option></select></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Tags" :level="2" :info="false" /></div>
      <div class="cs-container__body"><TagEditor v-model="tags" /></div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('vpc', 'vpcs')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !cidr || !!cidrError" @click="create">Create VPC</button>
    </div>
  </div>
  <div v-else>
    <CsTable v-model:selected="selected" title="Your VPCs" variant="full-page" :items="vpcs" :columns="columns" track-by="id"
             selection-type="single" filter-placeholder="Find VPCs by attribute or tag" empty-title="No VPCs found in this Region">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'VPCs refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="actions" :disabled="!current" @select="act" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('vpc', 'vpc-create')">Create VPC</button>
      </template>
      <template #cell-name="{ row }">{{ row.name || '–' }}</template>
      <template #cell-state="{ row }"><CsStatus :state="row.state || 'available'" /></template>
    </CsTable>

    <section v-if="current" class="cs-container vl__detail">
      <div class="cs-container__head"><CsHeader :title="`${current.id}${current.name ? ' / ' + current.name : ''}`" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <div class="cs-tabs">
          <button type="button" class="cs-tab" :class="{ 'is-active': tab === 'details' }" @click="tab = 'details'">Details</button>
          <button type="button" class="cs-tab" :class="{ 'is-active': tab === 'tags' }" @click="tab = 'tags'">Tags</button>
        </div>
        <dl v-if="tab === 'details'" class="cs-kv">
          <div><dt>VPC ID</dt><dd class="cs-mono">{{ current.id }}</dd></div>
          <div><dt>State</dt><dd><CsStatus :state="current.state || 'available'" /></dd></div>
          <div><dt>IPv4 CIDR</dt><dd>{{ current.cidr }}</dd></div>
          <div><dt>Default VPC</dt><dd>{{ current.default ? 'Yes' : 'No' }}</dd></div>
          <div><dt>Subnets</dt><dd>{{ current.subnets }}</dd></div>
          <div><dt>Tenancy</dt><dd>Default</dd></div>
          <div><dt>DNS resolution</dt><dd>Enabled</dd></div>
          <div><dt>Owner ID</dt><dd>{{ ctx.account.value }}</dd></div>
        </dl>
        <template v-else>
          <table v-if="Object.keys(current.tags || {}).length" class="cs-table-mini"><thead><tr><th>Key</th><th>Value</th></tr></thead>
            <tbody><tr v-for="(value, key) in current.tags" :key="key"><td>{{ key }}</td><td>{{ value || '–' }}</td></tr></tbody></table>
          <div v-else class="cs-empty"><strong>No tags</strong></div>
          <button type="button" class="cs-btn vl__gap" @click="modal = 'tags'">Manage tags</button>
        </template>
      </div>
    </section>

    <CsDelete v-if="modal === 'delete' && current" title="Delete VPC" word="delete" :busy="busy" @close="modal = ''" @confirm="remove">
      <p class="vl__p">Are you sure you want to delete this VPC? <span class="cs-mono">{{ current.id }}</span></p>
      <div v-if="current.subnets" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
        <div>This VPC still has {{ current.subnets }} subnet(s). Delete the subnets first, or the request fails with DependencyViolation.</div></div>
      <div v-if="current.default" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
        <div>This is your default VPC. Deleting it can prevent instances from launching without an explicit subnet.</div></div>
    </CsDelete>
    <ManageTags v-if="modal === 'tags' && current" :resource-id="current.id" :tags="current.tags || {}" @close="modal = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RULES, cli, rows, validate } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown, { type DdItem } from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { tagSpec } from '../commands';
import { useAws } from '../ctx';
import ManageTags from './Ec2ManageTags.vue';

const ctx = useAws();
const creating = computed(() => ctx.route.value.page === 'vpc-create');
const vpcs = computed(() => rows(ctx.view.value, 'ec2.vpcs'));
const selected = ref<string[]>([]);
const current = computed(() => vpcs.value.find(v => v.id === selected.value[0]) || null);
const modal = ref<'' | 'delete' | 'tags'>('');
const tab = ref('details');
const busy = ref(false);
const name = ref('');
const cidr = ref('10.0.0.0/16');
const tags = ref<Tag[]>([]);

const cidrError = computed(() => {
  const problem = validate(cidr.value, [RULES.cidr('IPv4 CIDR')]);
  if (problem) return problem;
  const prefix = Number(cidr.value.split('/')[1]);
  if (prefix < 16 || prefix > 28) return 'The CIDR block size must be between /16 and /28.';
  return '';
});
const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'id', header: 'VPC ID', sortKey: 'id' },
  { id: 'state', header: 'State' },
  { id: 'cidr', header: 'IPv4 CIDR', sortKey: 'cidr' },
  { id: 'ipv6', header: 'IPv6 CIDR', cell: () => '–' },
  { id: 'dhcp', header: 'DHCP option set', cell: () => 'dopt-0c1d2e3f4a5b6c7d8' },
  { id: 'default', header: 'Default VPC', cell: r => (r.default ? 'Yes' : 'No') },
  { id: 'subnets', header: 'Subnets' },
  { id: 'owner', header: 'Owner ID', cell: () => ctx.account.value },
];
const actions = computed<DdItem[]>(() => [
  { id: 'details', text: 'View details', disabled: true },
  { id: 'cidrs', text: 'Edit CIDRs', disabled: true },
  { id: 'settings', text: 'Edit VPC settings', disabled: true },
  { id: 'tags', text: 'Manage tags' },
  { id: 'delete', text: 'Delete VPC' },
]);

function act(id: string) {
  if (id === 'delete' || id === 'tags') modal.value = id;
}
async function create() {
  busy.value = true;
  const all = [...(name.value.trim() ? [{ key: 'Name', value: name.value.trim() }] : []),
    ...tags.value.filter(t => t.key.trim() && t.key.trim() !== 'Name')];
  const result = await ctx.run(cli(['aws', 'ec2', 'create-vpc'], {
    '--cidr-block': cidr.value, '--tag-specifications': tagSpec('vpc', all),
  }), 'You successfully created your VPC.');
  busy.value = false;
  if (result.ok) ctx.to('vpc', 'vpcs');
}
async function remove() {
  if (!current.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-vpc'], { '--vpc-id': current.value.id }),
    `Successfully deleted ${current.value.id}`);
  busy.value = false;
  if (result.ok) { modal.value = ''; selected.value = []; }
}
</script>

<style scoped>
.vl__info { font-size: 12px; font-weight: 700; margin-left: 4px; }
.vl__off { opacity: .55; cursor: default; }
.vl__detail { margin-top: 20px; }
.vl__p { margin: 0 0 12px; }
.vl__gap { margin-top: 12px; }
</style>
