<template>
  <div>
    <p class="az-intro">Diagnostic settings are used to configure streaming export of platform logs and metrics for a resource
      to the destination of your choice. A resource with no diagnostic setting sends nothing to Log Analytics.</p>
    <div class="az-cmdbar">
      <button type="button" class="az-cmd" @click="open"><AzIcon name="plus" /> Add diagnostic setting</button>
      <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
    </div>
    <AzTable :columns="cols" :rows="list" row-key="key">
      <template #cell-actions="{ row }">
        <button type="button" class="az-link" @click="remove(row)">Delete</button>
      </template>
      <template #empty>No diagnostic settings defined. Click "+ Add diagnostic setting" above to configure the
        collection of the following data: allLogs, AllMetrics.</template>
    </AzTable>

    <AzPane v-if="adding" title="Diagnostic setting" :subtitle="resource" :error="error" @close="adding = false">
      <div class="az-field"><div class="az-field__label">Diagnostic setting name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="form.name" class="az-input" /></div></div>
      <h3 class="az-group-title">Logs</h3>
      <label class="az-check"><input v-model="form.logs" type="checkbox" /> allLogs</label>
      <h3 class="az-group-title">Metrics</h3>
      <label class="az-check"><input v-model="form.metrics" type="checkbox" /> AllMetrics</label>
      <h3 class="az-group-title">Destination details</h3>
      <label class="az-check"><input type="checkbox" checked disabled /> Send to Log Analytics workspace</label>
      <div class="az-field" style="margin-top: 10px"><div class="az-field__label">Log Analytics workspace <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="form.workspace" class="az-select">
          <option value="">Select a workspace</option>
          <option v-for="w in workspaces" :key="w" :value="w">{{ w }}</option></select>
          <div v-if="!workspaces.length" class="az-help">No Log Analytics workspace yet — create one first.</div></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!form.name || !form.workspace || (!form.logs && !form.metrics)"
                @click="save">Save</button>
        <button type="button" class="az-btn" @click="adding = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** Diagnostic settings for one resource: `az monitor diagnostic-settings create/delete`. */
import { computed, reactive, ref } from 'vue';
import { cli, errorText, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import { useAz } from './azure';

const props = defineProps<{ resource: string }>();
const az = useAz();
const list = computed(() => rows(az.p.value, 'diagnostic_settings').filter(d => d.resource === props.resource)
  .map((d, i) => ({ key: String(i), name: d.name || 'to-law', workspace: d.workspace,
                    categories: (d.categories || []).join(', '), by: d.by, actions: '' })));
const cols = [{ key: 'name', label: 'Name' }, { key: 'workspace', label: 'Log Analytics workspace' },
              { key: 'categories', label: 'Categories' }, { key: 'by', label: 'Created by' },
              { key: 'actions', label: '', sortable: false }];
const workspaces = computed(() => rows(az.p.value, 'workspaces').map(w => String(w.name)));
const adding = ref(false);
const error = ref('');
const form = reactive({ name: '', workspace: '', logs: true, metrics: true });
function open() {
  Object.assign(form, { name: `${props.resource}-diag`, workspace: workspaces.value[0] || '', logs: true, metrics: true });
  error.value = '';
  adding.value = true;
}
async function save() {
  const logs = [form.logs ? 'AllLogs' : '', form.metrics ? 'AllMetrics' : ''].filter(Boolean).join(',');
  const result = await az.run(cli(['az', 'monitor', 'diagnostic-settings', 'create'],
                                  { '--name': form.name, '--resource': props.resource, '--workspace': form.workspace,
                                    '--logs': logs }),
                              `Successfully saved diagnostic setting '${form.name}'`, { quiet: true });
  if (!result.ok) { error.value = errorText(result); return; }
  adding.value = false;
}
async function remove(row: Record<string, any>) {
  if (!(await az.confirm({ title: 'Delete diagnostic setting', message: `Delete '${row.name}'? The resource will stop sending data to ${row.workspace}.`, confirmLabel: 'Yes', danger: true }))) return;
  await az.run(cli(['az', 'monitor', 'diagnostic-settings', 'delete'], { '--name': row.name, '--resource': props.resource }),
               `Deleted diagnostic setting '${row.name}'`);
}
</script>
