<template>
  <div>
    <CsTable v-model:selected="selected" title="Functions" variant="full-page" :items="functions" :columns="columns" track-by="name"
             selection-type="multi" filter-placeholder="Filter by tags and attributes or search by keyword"
             empty-title="There is no data to display.">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Functions refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="actions" :disabled="!selected.length" @select="act" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('lambda', 'create')">Create function</button>
      </template>
      <template #empty><button type="button" class="cs-btn" @click="ctx.to('lambda', 'create')">Create function</button></template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('lambda', 'function', { name: row.name })">{{ row.name }}</a></template>
    </CsTable>
    <CsDelete v-if="deleting" :title="selected.length === 1 ? 'Delete function' : `Delete ${selected.length} functions`" word="confirm"
              :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="ll__p">Deleting a function permanently removes the function code. The related logs and roles are retained in your account.</p>
      <ul class="ll__ids"><li v-for="n in selected" :key="n">{{ n }}</li></ul>
    </CsDelete>
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
import { runtimeLabel } from './lambdaKit';

const ctx = useAws();
const functions = computed(() => rows(ctx.view.value, 'lambda'));
const selected = ref<string[]>([]);
const deleting = ref(false);
const busy = ref(false);
const columns: Column[] = [
  { id: 'name', header: 'Function name', sortKey: 'name' },
  { id: 'description', header: 'Description', cell: r => r.description || '–' },
  { id: 'package', header: 'Package type', cell: () => 'Zip' },
  { id: 'runtime', header: 'Runtime', sortKey: 'runtime', cell: r => runtimeLabel(r.runtime) },
  { id: 'modified', header: 'Last modified', sortKey: 'modified', cell: r => ago(r.modified) },
];
const actions = computed<DdItem[]>(() => [
  { id: 'details', text: 'View details', disabled: selected.value.length !== 1 },
  { id: 'test', text: 'Test', disabled: selected.value.length !== 1 },
  { id: 'delete', text: 'Delete' },
]);

function ago(stamp: string) {
  const ms = Date.now() - new Date(stamp).getTime();
  if (!stamp || Number.isNaN(ms)) return '–';
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
function act(id: string) {
  if (id === 'delete') deleting.value = true;
  if (id === 'details') ctx.to('lambda', 'function', { name: selected.value[0] });
  if (id === 'test') ctx.to('lambda', 'function', { name: selected.value[0], tab: 'test' });
}
async function remove() {
  busy.value = true;
  let done = 0;
  for (const name of selected.value) {
    const result = await ctx.run(cli(['aws', 'lambda', 'delete-function'], { '--function-name': name }));
    if (result.ok) done += 1;
  }
  busy.value = false;
  deleting.value = false;
  selected.value = [];
  if (done) ctx.api.notify('success', `Successfully deleted ${done} function(s).`);
}
</script>

<style scoped>
.ll__p { margin: 0 0 8px; }
.ll__ids { margin: 0; padding-left: 18px; }
</style>
