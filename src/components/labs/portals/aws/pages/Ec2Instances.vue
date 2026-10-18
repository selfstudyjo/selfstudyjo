<template>
  <div>
    <CsTable
      v-model:selected="selected"
      title="Instances"
      variant="full-page"
      :items="instances"
      :columns="columns"
      track-by="id"
      selection-type="multi"
      filter-placeholder="Find Instance by attribute or tag (case-sensitive)"
      :filter-fields="['name', 'id', 'state', 'type', 'az', 'public_ip', 'private_ip', 'key']"
      empty-title="No instances"
      empty-text="You do not have any instances in this region"
    >
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Instances refreshed')"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" disabled>Connect</button>
        <Ec2InstanceActions :instances="chosen" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('ec2', 'launch')">Launch instances</button>
      </template>
      <template #empty>
        <button type="button" class="cs-btn" @click="ctx.to('ec2', 'launch')">Launch instances</button>
      </template>
      <template #cell-name="{ row }">
        <span class="ei__name">
          <template v-if="editing === row.id">
            <input v-model="draft" class="cs-input ei__edit" aria-label="Name" @keydown.enter="saveName(row)" @keydown.esc="editing = ''" />
            <button type="button" class="cs-btn cs-btn--link ei__mini" @click="editing = ''">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary ei__mini" @click="saveName(row)">Save</button>
          </template>
          <template v-else>
            {{ row.name || '–' }}
            <button type="button" class="ei__pencil" aria-label="Edit Name" @click.stop="startName(row)"><CsIcon name="edit" size="small" /></button>
          </template>
        </span>
      </template>
      <template #cell-id="{ row }">
        <a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'instance', { id: row.id })">{{ row.id }}</a>
      </template>
      <template #cell-state="{ row }"><CsStatus :state="row.state" /></template>
      <template #cell-check="{ row }">
        <CsStatus v-if="row.state === 'running'" type="success" label="2/2 checks passed" />
        <span v-else>–</span>
      </template>
      <template #cell-alarm><span class="cs-link">View alarms <CsIcon name="add-plus" size="small" /></span></template>
    </CsTable>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsIcon from '../CsIcon.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, useAws } from '../ctx';
import Ec2InstanceActions from './Ec2InstanceActions.vue';

const ctx = useAws();
const selected = ref<string[]>([]);
const editing = ref('');
const draft = ref('');

const groups = computed(() => rows(ctx.view.value, 'ec2.security_groups'));
const instances = computed(() => rows<any>(ctx.view.value, 'ec2.instances').map(i => ({
  ...i,
  sg_names: (i.groups || []).map((id: string) => groups.value.find(g => g.id === id)?.name || id).join(', '),
})));
const chosen = computed(() => instances.value.filter(i => selected.value.includes(i.id)));

const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'id', header: 'Instance ID', sortKey: 'id' },
  { id: 'state', header: 'Instance state', sortKey: 'state' },
  { id: 'type', header: 'Instance type', sortKey: 'type' },
  { id: 'check', header: 'Status check' },
  { id: 'alarm', header: 'Alarm status' },
  { id: 'az', header: 'Availability Zone', sortKey: 'az' },
  { id: 'dns', header: 'Public IPv4 DNS', cell: r => (r.state === 'running' ? r.dns : '') },
  { id: 'public_ip', header: 'Public IPv4 address', cell: r => (r.state === 'running' ? r.public_ip : '') },
  { id: 'eip', header: 'Elastic IP', cell: () => '–' },
  { id: 'monitoring', header: 'Monitoring', cell: () => 'disabled' },
  { id: 'sg_names', header: 'Security group name' },
  { id: 'key', header: 'Key name', sortKey: 'key' },
  { id: 'launched_at', header: 'Launch time', sortKey: 'launched_at', cell: r => awsDate(r.launched_at) },
  { id: 'platform', header: 'Platform details' },
];

function startName(row: Record<string, any>) {
  editing.value = row.id;
  draft.value = row.name || '';
}
async function saveName(row: Record<string, any>) {
  const value = draft.value.trim();
  const command = value
    ? cli(['aws', 'ec2', 'create-tags'], { '--resources': row.id, '--tags': `Key=Name,Value=${value}` })
    : cli(['aws', 'ec2', 'delete-tags'], { '--resources': row.id, '--tags': 'Key=Name' });
  const result = await ctx.run(command, `Successfully updated the name of ${row.id}`);
  if (result.ok) editing.value = '';
}
</script>

<style scoped>
.ei__name { display: inline-flex; align-items: center; gap: 6px; }
.ei__pencil { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; min-height: 20px; border: 0; background: none; color: #424650; cursor: pointer; padding: 2px; }
.ei__pencil:hover { color: #006ce0; }
.ei__edit { width: 160px; min-height: 28px; padding: 2px 8px; }
.ei__mini { min-height: 26px; padding: 1px 10px; }
</style>
