<template>
  <div>
    <CsTable
      v-model:selected="selected"
      title="Security Groups"
      variant="full-page"
      :items="groups"
      :columns="columns"
      track-by="id"
      selection-type="multi"
      filter-placeholder="Find resources by attribute or tag"
      :filter-fields="['label', 'id', 'name', 'vpc', 'description']"
      empty-title="No security groups"
      :row-menu="() => actions"
      @row-action="(id: string) => act(id)"
    >
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Security groups refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="actions" :disabled="!selected.length" @select="act" />
        <button type="button" class="cs-btn" disabled>Export security groups to CSV</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to(svc, 'sg-create')">Create security group</button>
      </template>
      <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to(svc, 'sg', { id: row.id })">{{ row.id }}</a></template>
      <template #cell-vpc="{ row }"><span class="cs-link">{{ row.vpc }}</span></template>
    </CsTable>

    <CsDelete v-if="deleting" title="Delete security groups" word="delete" action="Delete" :busy="busy"
              @close="deleting = false" @confirm="remove">
      <p class="sgl__p">Are you sure you want to delete the following security groups?</p>
      <ul class="sgl__ids"><li v-for="g in chosen" :key="g.id"><span class="cs-mono">{{ g.id }}</span> - {{ g.name }}
        <span v-if="g.name === 'default'" class="cs-error-text">The default security group can't be deleted.</span>
        <span v-else-if="g.in_use" class="cs-error-text">Associated with {{ g.in_use }} instance(s).</span></li></ul>
    </CsDelete>
    <ManageTags v-if="tagging && single" :resource-id="single.id" :tags="single.tags || {}" @close="tagging = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown, { type DdItem } from '../CsDropdown.vue';
import CsIcon from '../CsIcon.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';
import type { ServiceId } from '../nav';
import ManageTags from './Ec2ManageTags.vue';

const ctx = useAws();
const svc = computed<ServiceId>(() => (ctx.route.value.svc === 'vpc' ? 'vpc' : 'ec2'));
const selected = ref<string[]>([]);
const deleting = ref(false);
const tagging = ref(false);
const busy = ref(false);

const groups = computed(() => rows<any>(ctx.view.value, 'ec2.security_groups').map(g => ({
  ...g, label: (g.tags || {}).Name || '', inbound: (g.ingress || []).length, outbound: (g.egress || []).length || 1,
})));
const chosen = computed(() => groups.value.filter(g => selected.value.includes(g.id)));
const single = computed(() => (chosen.value.length === 1 ? chosen.value[0] : null));

const columns: Column[] = [
  { id: 'label', header: 'Name', sortKey: 'label', cell: r => r.label || '–' },
  { id: 'id', header: 'Security group ID', sortKey: 'id' },
  { id: 'name', header: 'Security group name', sortKey: 'name' },
  { id: 'vpc', header: 'VPC ID', sortKey: 'vpc' },
  { id: 'description', header: 'Description' },
  { id: 'owner', header: 'Owner', cell: () => ctx.account.value },
  { id: 'inbound', header: 'Inbound rules count', cell: r => `${r.inbound} Permission entr${r.inbound === 1 ? 'y' : 'ies'}` },
  { id: 'outbound', header: 'Outbound rules count', cell: r => `${r.outbound} Permission entr${r.outbound === 1 ? 'y' : 'ies'}` },
];

const actions = computed<DdItem[]>(() => [
  { id: 'details', text: 'View details', disabled: !single.value },
  { id: 'inbound', text: 'Edit inbound rules', disabled: !single.value },
  { id: 'outbound', text: 'Edit outbound rules', disabled: !single.value },
  { id: 'tags', text: 'Manage tags', disabled: !single.value },
  { id: 'copy', text: 'Copy to new security group', disabled: true },
  { id: 'delete', text: 'Delete security groups', disabled: !chosen.value.length },
]);

function act(id: string) {
  if (id === 'details' && single.value) ctx.to(svc.value, 'sg', { id: single.value.id });
  if (id === 'inbound' && single.value) ctx.to(svc.value, 'sg-inbound', { id: single.value.id });
  if (id === 'outbound' && single.value) ctx.to(svc.value, 'sg-outbound', { id: single.value.id });
  if (id === 'tags') tagging.value = true;
  if (id === 'delete') deleting.value = true;
}
async function remove() {
  busy.value = true;
  let done = 0;
  for (const group of chosen.value) {
    const result = await ctx.run(cli(['aws', 'ec2', 'delete-security-group'], { '--group-id': group.id }));
    if (result.ok) done += 1;
  }
  busy.value = false;
  deleting.value = false;
  selected.value = [];
  if (done) ctx.api.notify('success', `Successfully deleted ${done} security group(s)`);
}
</script>

<style scoped>
.sgl__p { margin: 0 0 8px; }
.sgl__ids { margin: 0; padding-left: 18px; }
</style>
