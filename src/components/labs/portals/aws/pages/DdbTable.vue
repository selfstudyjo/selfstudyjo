<template>
  <div v-if="table">
    <CsHeader :title="table.name">
      <template #actions>
        <CsDropdown :items="[{ id: 'delete', text: 'Delete table' }, { id: 'billing', text: 'Edit capacity' }]" @select="act" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('dynamodb', 'explore', { name: table.name })">Explore table items</button>
      </template>
    </CsHeader>
    <div class="cs-tabs">
      <button v-for="t in tabs" :key="t.id" type="button" class="cs-tab" :class="{ 'is-active': tab === t.id }" :disabled="t.off" @click="tab = t.id">{{ t.text }}</button>
    </div>
    <template v-if="tab === 'overview'">
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="General information" :level="2" /></div>
        <div class="cs-container__body">
          <dl class="cs-kv">
            <div><dt>Partition key</dt><dd>{{ table.partition_key || '–' }} ({{ typeName(table.types?.[table.partition_key]) }})</dd></div>
            <div><dt>Sort key</dt><dd>{{ table.sort_key ? `${table.sort_key} (${typeName(table.types?.[table.sort_key])})` : '-' }}</dd></div>
            <div><dt>Capacity mode</dt><dd>{{ table.billing === 'PAY_PER_REQUEST' ? 'On-demand' : 'Provisioned' }}</dd></div>
            <div><dt>Table status</dt><dd><CsStatus state="active" /></dd></div>
            <div><dt>Alarms</dt><dd><CsStatus type="success" label="No active alarms" /></dd></div>
            <div><dt>Point-in-time recovery (PITR)</dt><dd>Off</dd></div>
            <div><dt>Item count</dt><dd>{{ table.items }}</dd></div>
            <div><dt>Amazon Resource Name (ARN)</dt><dd class="cs-mono">{{ table.arn }}</dd></div>
            <div><dt>Creation date</dt><dd>{{ awsDate(table.created) }}</dd></div>
          </dl>
        </div>
      </section>
    </template>
    <section v-else-if="tab === 'settings'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Read/write capacity" :level="2"
        description="The read/write capacity mode controls how you are charged for read and write throughput and how you manage capacity.">
        <template #actions><button v-if="!editing" type="button" class="cs-btn" @click="startEdit">Edit</button></template></CsHeader></div>
      <div class="cs-container__body">
        <div v-if="editing" class="cs-stack">
          <label class="cs-radio"><input v-model="billing" type="radio" value="PAY_PER_REQUEST" /> On-demand</label>
          <label class="cs-radio"><input v-model="billing" type="radio" value="PROVISIONED" /> Provisioned</label>
          <div class="cs-form-actions"><button type="button" class="cs-btn cs-btn--link" @click="editing = false">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveBilling">Save changes</button></div>
        </div>
        <dl v-else class="cs-kv"><div><dt>Capacity mode</dt><dd>{{ table.billing === 'PAY_PER_REQUEST' ? 'On-demand' : 'Provisioned' }}</dd></div></dl>
      </div>
    </section>
    <CsDelete v-if="deleting" :title="`Delete table: ${table.name}`" word="confirm" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="ddt__p">Are you sure you want to delete <strong>{{ table.name }}</strong>? All items in the table are deleted with it.</p>
    </CsDelete>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>Requested resource not found</strong>Table: {{ name }} not found.
      <button type="button" class="cs-link" @click="ctx.to('dynamodb', 'tables')">View tables</button></div></div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsStatus from '../CsStatus.vue';
import { awsDate, useAws } from '../ctx';

const ctx = useAws();
const name = computed(() => ctx.route.value.params?.name || '');
const table = computed(() => rows(ctx.view.value, 'dynamodb').find(t => t.name === name.value) || null);
const tabs = [
  { id: 'overview', text: 'Overview' }, { id: 'indexes', text: 'Indexes', off: true }, { id: 'monitor', text: 'Monitor', off: true },
  { id: 'backups', text: 'Backups', off: true }, { id: 'settings', text: 'Additional settings' },
];
const tab = ref('overview');
const deleting = ref(false);
const editing = ref(false);
const billing = ref('PAY_PER_REQUEST');
const busy = ref(false);

function typeName(type: string) {
  return ({ S: 'String', N: 'Number', B: 'Binary' } as Record<string, string>)[type] || 'String';
}
function act(id: string) {
  if (id === 'delete') deleting.value = true;
  if (id === 'billing') { tab.value = 'settings'; startEdit(); }
}
function startEdit() {
  billing.value = table.value?.billing || 'PAY_PER_REQUEST';
  editing.value = true;
}
async function saveBilling() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'dynamodb', 'update-table'], {
    '--table-name': name.value, '--billing-mode': billing.value,
    '--provisioned-throughput': billing.value === 'PROVISIONED' ? 'ReadCapacityUnits=5,WriteCapacityUnits=5' : '',
  }), `The table ${name.value} was updated successfully.`);
  busy.value = false;
  if (result.ok) editing.value = false;
}
async function remove() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'dynamodb', 'delete-table'], { '--table-name': name.value }),
    `The ${name.value} table was deleted successfully.`);
  busy.value = false;
  if (result.ok) { deleting.value = false; ctx.to('dynamodb', 'tables'); }
}
</script>

<style scoped>
.ddt__p { margin: 0; }
</style>
