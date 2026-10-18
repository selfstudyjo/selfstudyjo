<template>
  <div v-if="creating">
    <CsHeader title="Create table" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Table details" :level="2"
        description="DynamoDB is a schemaless database that requires only a table name and a primary key when you create the table." /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="dt-name">Table name</label>
          <div class="cs-desc">This will be used to identify your table.</div>
          <input id="dt-name" v-model.trim="name" class="cs-input" :class="{ 'is-invalid': tried && nameError }" placeholder="Enter the table name" />
          <span v-if="tried && nameError" class="cs-error-text">{{ nameError }}</span>
          <span class="cs-constraint">Between 3 and 255 characters, containing only letters, numbers, underscores (_), hyphens (-), and periods (.).</span></div>
        <div class="cs-field"><span class="cs-label">Partition key</span>
          <div class="cs-desc">The partition key is part of the table's primary key. It is a hash value that is used to retrieve items from your table and allocate data across hosts for scalability and availability.</div>
          <div class="dt__key"><input v-model.trim="pk" class="cs-input" :class="{ 'is-invalid': tried && !pk }" placeholder="Enter the partition key name" aria-label="Partition key" />
            <select v-model="pkType" class="cs-select dt__type" aria-label="Partition key type"><option value="S">String</option><option value="N">Number</option><option value="B">Binary</option></select></div>
          <span v-if="tried && !pk" class="cs-error-text">Partition key is required.</span>
          <span class="cs-constraint">1 to 255 characters and case sensitive.</span></div>
        <div class="cs-field"><span class="cs-label">Sort key - <em>optional</em></span>
          <div class="cs-desc">You can use a sort key as the second part of a table's primary key. The sort key allows you to sort or search among all items sharing the same partition key.</div>
          <div class="dt__key"><input v-model.trim="sk" class="cs-input" placeholder="Enter the sort key name" aria-label="Sort key" />
            <select v-model="skType" class="cs-select dt__type" aria-label="Sort key type"><option value="S">String</option><option value="N">Number</option><option value="B">Binary</option></select></div></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Table settings" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-tiles">
          <label class="cs-tile" :class="{ 'is-checked': settings === 'default' }"><input v-model="settings" type="radio" value="default" /><span><strong>Default settings</strong><small>The fastest way to create your table. You can modify most of these settings after your table has been created.</small></span></label>
          <label class="cs-tile" :class="{ 'is-checked': settings === 'custom' }"><input v-model="settings" type="radio" value="custom" /><span><strong>Customize settings</strong><small>Use these advanced features to make DynamoDB work better for your needs.</small></span></label>
        </div>
        <div v-if="settings === 'custom'" class="cs-field"><span class="cs-label">Read/write capacity settings</span>
          <label class="cs-radio"><input v-model="billing" type="radio" value="PAY_PER_REQUEST" /> On-demand <small>Simplify billing by paying for the actual reads and writes your application performs.</small></label>
          <label class="cs-radio"><input v-model="billing" type="radio" value="PROVISIONED" /> Provisioned <small>Manage and optimize your costs by allocating read/write capacity in advance.</small></label></div>
        <table v-else class="cs-table-mini"><thead><tr><th>Setting</th><th>Value</th><th>Editable after creation</th></tr></thead>
          <tbody><tr><td>Table class</td><td>DynamoDB Standard</td><td>Yes</td></tr><tr><td>Capacity mode</td><td>On-demand</td><td>Yes</td></tr>
            <tr><td>Encryption key management</td><td>Owned by Amazon DynamoDB</td><td>Yes</td></tr><tr><td>Deletion protection</td><td>Off</td><td>Yes</td></tr></tbody></table>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('dynamodb', 'tables')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Create table</button>
    </div>
  </div>
  <div v-else>
    <CsTable v-model:selected="selected" title="Tables" variant="full-page" :items="tables" :columns="columns" track-by="name"
             selection-type="multi" filter-placeholder="Find tables" empty-title="You have no tables in this account in this AWS Region.">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Tables refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="actions" :disabled="!selected.length" @select="act" />
        <button type="button" class="cs-btn" :disabled="!selected.length" @click="deleting = true">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('dynamodb', 'create')">Create table</button>
      </template>
      <template #empty><button type="button" class="cs-btn" @click="ctx.to('dynamodb', 'create')">Create table</button></template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('dynamodb', 'table', { name: row.name })">{{ row.name }}</a></template>
      <template #cell-status="{ row }"><CsStatus :state="String(row.status).toLowerCase()" :label="row.status === 'ACTIVE' ? 'Active' : row.status" /></template>
    </CsTable>
    <CsDelete v-if="deleting" :title="`Delete table${selected.length > 1 ? 's' : ''}`" word="confirm" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="dt__p">Delete all of the selected tables? This action cannot be undone.</p>
      <ul class="dt__ids"><li v-for="n in selected" :key="n">{{ n }}</li></ul>
      <label class="cs-check"><input type="checkbox" checked disabled /> Delete all CloudWatch alarms for these tables.</label>
    </CsDelete>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown, { type DdItem } from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const creating = computed(() => ctx.route.value.page === 'create');
const tables = computed(() => rows(ctx.view.value, 'dynamodb'));
const selected = ref<string[]>([]);
const deleting = ref(false);
const busy = ref(false);
const name = ref('');
const pk = ref('');
const pkType = ref('S');
const sk = ref('');
const skType = ref('S');
const settings = ref('default');
const billing = ref('PAY_PER_REQUEST');
const tried = ref(false);

const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'status', header: 'Status', sortKey: 'status' },
  { id: 'partition_key', header: 'Partition key', cell: r => (r.partition_key ? `${r.partition_key} (${typeName(r.types?.[r.partition_key])})` : '–') },
  { id: 'sort_key', header: 'Sort key', cell: r => (r.sort_key ? `${r.sort_key} (${typeName(r.types?.[r.sort_key])})` : '-') },
  { id: 'indexes', header: 'Indexes', cell: () => '0' },
  { id: 'protection', header: 'Deletion protection', cell: () => 'Off' },
  { id: 'billing', header: 'Read capacity mode', cell: r => (r.billing === 'PAY_PER_REQUEST' ? 'On-demand' : 'Provisioned (5)') },
  { id: 'items', header: 'Item count', sortKey: 'items' },
];
const actions = computed<DdItem[]>(() => [
  { id: 'explore', text: 'Explore items', disabled: selected.value.length !== 1 },
  { id: 'details', text: 'View details', disabled: selected.value.length !== 1 },
]);

function typeName(type: string) {
  return ({ S: 'String', N: 'Number', B: 'Binary' } as Record<string, string>)[type] || 'String';
}
const nameError = computed(() => {
  if (!/^[A-Za-z0-9_.-]{3,255}$/.test(name.value)) return 'Table name must be between 3 and 255 characters: letters, numbers, underscores (_), hyphens (-), and periods (.).';
  if (tables.value.some(t => t.name === name.value)) return `Table already exists: ${name.value}`;
  return '';
});
function act(id: string) {
  if (id === 'explore') ctx.to('dynamodb', 'explore', { name: selected.value[0] });
  if (id === 'details') ctx.to('dynamodb', 'table', { name: selected.value[0] });
}
async function create() {
  tried.value = true;
  if (nameError.value || !pk.value) return;
  busy.value = true;
  const attrs = [`AttributeName=${pk.value},AttributeType=${pkType.value}`];
  const keys = [`AttributeName=${pk.value},KeyType=HASH`];
  if (sk.value) {
    attrs.push(`AttributeName=${sk.value},AttributeType=${skType.value}`);
    keys.push(`AttributeName=${sk.value},KeyType=RANGE`);
  }
  const mode = settings.value === 'custom' ? billing.value : 'PAY_PER_REQUEST';
  const result = await ctx.run(cli(['aws', 'dynamodb', 'create-table'], {
    '--table-name': name.value, '--attribute-definitions': attrs, '--key-schema': keys,
    '--billing-mode': mode,
    '--provisioned-throughput': mode === 'PROVISIONED' ? 'ReadCapacityUnits=5,WriteCapacityUnits=5' : '',
  }), `The ${name.value} table was created successfully.`);
  busy.value = false;
  if (result.ok) ctx.to('dynamodb', 'tables');
}
async function remove() {
  busy.value = true;
  for (const table of selected.value) {
    await ctx.run(cli(['aws', 'dynamodb', 'delete-table'], { '--table-name': table }));
  }
  ctx.api.notify('success', `Deleting ${selected.value.join(', ')}.`);
  busy.value = false;
  deleting.value = false;
  selected.value = [];
}
</script>

<style scoped>
.dt__key { display: flex; gap: 8px; }
.dt__type { width: 130px; flex: none; }
.dt__p { margin: 0 0 8px; }
.dt__ids { margin: 0 0 12px; padding-left: 18px; }
</style>
