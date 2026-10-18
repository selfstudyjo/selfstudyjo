<template>
  <CsTable v-model:selected="selected" title="Amazon Machine Images (AMIs)" variant="full-page" :items="amis" :columns="columns"
           track-by="id" selection-type="single" filter-placeholder="Find AMI by attribute or tag" empty-title="No AMIs">
    <template #actions>
      <CsDropdown :items="[{ id: 'copy', text: 'Copy AMI', disabled: true }, { id: 'deregister', text: 'Deregister AMI', disabled: true }]" :disabled="!selected.length" />
      <button type="button" class="cs-btn cs-btn--primary" :disabled="!selected.length" @click="ctx.to('ec2', 'launch')">Launch instance from AMI</button>
    </template>
  </CsTable>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { pick } from '@/utils/portalKit';
import CsDropdown from '../CsDropdown.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const selected = ref<string[]>([]);
const amis = computed(() => pick<any[]>(ctx.view.value, 'amis', []));
const columns: Column[] = [
  { id: 'name', header: 'AMI name', sortKey: 'name' },
  { id: 'id', header: 'AMI ID', sortKey: 'id' },
  { id: 'source', header: 'Source', cell: () => 'amazon' },
  { id: 'owner', header: 'Owner', cell: () => 'amazon' },
  { id: 'visibility', header: 'Visibility', cell: () => 'Public' },
  { id: 'status', header: 'Status', cell: () => 'Available' },
  { id: 'arch', header: 'Architecture', cell: () => 'x86_64' },
  { id: 'default_type', header: 'Recommended instance type' },
];
</script>
