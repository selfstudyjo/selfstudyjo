<template>
  <div>
    <CsTable v-model:selected="selected" title="Databases" variant="full-page" :items="databases" :columns="columns" track-by="id"
             selection-type="single" filter-placeholder="Filter by databases" empty-title="No databases"
             empty-text="You don't have any databases in this Region.">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Databases refreshed')"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" :disabled="!current" @click="current && ctx.to('rds', 'modify', { id: current.id })">Modify</button>
        <RdsActions :db="current" @deleted="selected = []" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('rds', 'create')">Create database</button>
      </template>
      <template #empty><button type="button" class="cs-btn" @click="ctx.to('rds', 'create')">Create database</button></template>
      <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('rds', 'database', { id: row.id })">{{ row.id }}</a></template>
      <template #cell-status="{ row }"><CsStatus :state="row.status" /></template>
    </CsTable>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import CsIcon from '../CsIcon.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';
import RdsActions from './RdsActions.vue';
import { engineLabel } from './rdsKit';

const ctx = useAws();
const databases = computed(() => rows(ctx.view.value, 'rds'));
const selected = ref<string[]>([]);
const current = computed(() => databases.value.find(d => d.id === selected.value[0]) || null);
const columns: Column[] = [
  { id: 'id', header: 'DB identifier', sortKey: 'id' },
  { id: 'status', header: 'Status', sortKey: 'status' },
  { id: 'role', header: 'Role', cell: () => 'Instance' },
  { id: 'engine', header: 'Engine', sortKey: 'engine', cell: r => engineLabel(r.engine) },
  { id: 'az', header: 'Region & AZ', cell: () => `${ctx.region.value}a` },
  { id: 'class', header: 'Size', sortKey: 'class' },
  { id: 'recommend', header: 'Recommendations', cell: () => '–' },
  { id: 'cpu', header: 'CPU', cell: r => (r.status === 'available' ? '2.31%' : '–') },
  { id: 'activity', header: 'Current activity', cell: r => (r.status === 'available' ? '0 Connections' : '–') },
  { id: 'multi_az', header: 'Multi-AZ', cell: r => (r.multi_az ? 'Yes' : 'No') },
];
</script>
