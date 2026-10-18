<template>
  <div>
    <CsTable v-model:selected="selected" title="Manual snapshots" variant="full-page" :items="snapshots" :columns="columns" track-by="id"
             selection-type="single" filter-placeholder="Filter by manual snapshots" empty-title="No manual snapshots"
             empty-text="You don't have any manual snapshots.">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Snapshots refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="[{ id: 'restore', text: 'Restore snapshot', disabled: true }, { id: 'delete', text: 'Delete snapshot' }]" :disabled="!selected.length" @select="deleting = true" />
      </template>
      <template #cell-status="{ row }"><CsStatus :state="row.status" /></template>
    </CsTable>
    <CsDelete v-if="deleting" :title="`Delete snapshot ${selected[0]}?`" word="delete me" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="rs__p">Are you sure you want to delete this snapshot? This can't be undone.</p>
    </CsDelete>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsIcon from '../CsIcon.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, useAws } from '../ctx';
import { engineLabel } from './rdsKit';

const ctx = useAws();
const snapshots = computed(() => rows(ctx.view.value, 'rds_snapshots'));
const selected = ref<string[]>([]);
const deleting = ref(false);
const busy = ref(false);
const columns: Column[] = [
  { id: 'id', header: 'Snapshot name', sortKey: 'id' },
  { id: 'instance', header: 'DB instance or cluster', sortKey: 'instance' },
  { id: 'created', header: 'Snapshot creation time', cell: r => awsDate(r.created) },
  { id: 'status', header: 'Status' },
  { id: 'engine', header: 'Engine', cell: r => engineLabel(r.engine) },
  { id: 'storage', header: 'Allocated storage', cell: r => `${r.storage} GiB` },
  { id: 'type', header: 'Snapshot type' },
];

async function remove() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'rds', 'delete-db-snapshot'], { '--db-snapshot-identifier': selected.value[0] }),
    `Deleted snapshot ${selected.value[0]}.`);
  busy.value = false;
  if (result.ok) { deleting.value = false; selected.value = []; }
}
</script>

<style scoped>
.rs__p { margin: 0; }
</style>
