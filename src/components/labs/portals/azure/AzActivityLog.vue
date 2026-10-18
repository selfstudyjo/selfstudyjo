<template>
  <div>
    <div class="az-cmdbar">
      <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
      <button type="button" class="az-cmd" @click="exportCsv"><AzIcon name="download" /> Download as CSV</button>
    </div>
    <div class="az-filters">
      <input v-model="needle" class="az-filter" placeholder="Search" aria-label="Search activity" />
      <span class="az-pill">Management Group : <b>None</b></span>
      <span class="az-pill">Subscription : <b>{{ az.p.value.account?.subscription_name }}</b></span>
      <span class="az-pill">Event severity : <b>All</b></span>
      <span class="az-pill">Timespan : <b>Last 6 hours</b></span>
    </div>
    <div class="az-count">{{ list.length }} items.</div>
    <AzTable :columns="cols" :rows="list" row-key="key">
      <template #cell-operation="{ row }">
        <span class="az-namecell"><AzIcon :name="row.status === 'Succeeded' ? 'ok' : 'error'" :size="14" />
          {{ row.operation }}</span>
      </template>
      <template #cell-command="{ row }"><span class="az-mono">{{ row.command }}</span></template>
      <template #empty>No events to display. Activity log entries appear when you create, change or delete resources.</template>
    </AzTable>
  </div>
</template>

<script setup lang="ts">
/** The Activity log: every write against the subscription, filtered to a scope. */
import { computed, ref } from 'vue';
import { matches, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzTable from './AzTable.vue';
import { fmtDate, useAz } from './azure';

const props = defineProps<{ group?: string; target?: string }>();
const az = useAz();
const needle = ref('');
const cols = [
  { key: 'operation', label: 'Operation name' },
  { key: 'status', label: 'Status' },
  { key: 'when', label: 'Time' },
  { key: 'target', label: 'Resource' },
  { key: 'command', label: 'Event initiated by' },
];
const list = computed(() => rows(az.p.value, 'activity')
  .filter(r => (!props.group || r.group === props.group || r.target === props.group)
    && (!props.target || r.target === props.target))
  .map((r, i: number): Record<string, any> => ({ ...r, key: `${r.at}-${i}`, when: fmtDate(r.at) }))
  .filter(r => matches(r, needle.value, ['operation', 'target', 'command', 'status'])));

function exportCsv() {
  const lines = ['Operation name,Status,Time,Resource'].concat(list.value.map(r =>
    [r.operation, r.status, r.when, r.target].map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ActivityLog.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>
