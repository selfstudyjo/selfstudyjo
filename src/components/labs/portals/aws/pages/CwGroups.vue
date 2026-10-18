<template>
  <div v-if="creating">
    <CsHeader title="Create log group" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Log group details" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="cg-name">Log group name</label>
          <input id="cg-name" v-model.trim="name" class="cs-input" :class="{ 'is-invalid': tried && nameError }" />
          <span v-if="tried && nameError" class="cs-error-text">{{ nameError }}</span>
          <span class="cs-constraint">The log group name can be between 1 and 512 characters long. Allowed characters: a-z, A-Z, 0-9, '_' (underscore), '-' (hyphen), '/' (forward slash), '.' (period) and '#' (number sign).</span></div>
        <div class="cs-field"><label class="cs-label" for="cg-ret">Retention setting</label>
          <select id="cg-ret" v-model.number="retention" class="cs-select"><option :value="0">Never expire</option>
            <option v-for="d in RETENTION" :key="d" :value="d">{{ retentionLabel(d) }}</option></select></div>
        <div class="cs-field"><span class="cs-label">Log class</span><select class="cs-select" disabled><option>Standard</option></select></div>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('cloudwatch', 'groups')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Create</button>
    </div>
  </div>
  <div v-else>
    <CsTable v-model:selected="selected" title="Log groups" variant="full-page" :items="groups" :columns="columns" track-by="name"
             selection-type="multi" filter-placeholder="Filter log groups or try prefix search" empty-title="No log groups"
             description="By default, we only load up to 10000 log groups.">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Log groups refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="[{ id: 'retention', text: 'Edit retention setting(s)', disabled: !selected.length }, { id: 'delete', text: 'Delete log group(s)', disabled: !selected.length }]" @select="act" />
        <button type="button" class="cs-btn" disabled>View in Logs Insights</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('cloudwatch', 'create')">Create log group</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('cloudwatch', 'group', { name: row.name })">{{ row.name }}</a></template>
    </CsTable>
    <CsModal v-if="modal === 'delete'" title="Delete log group(s)" @close="modal = ''">
      <p class="cg__p">Are you sure you want to delete the following log group(s)? Deleting the log group will permanently delete all the archived log events associated with the log group.</p>
      <ul class="cg__ids"><li v-for="n in selected" :key="n">{{ n }}</li></ul>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="remove">Delete</button>
      </template>
    </CsModal>
    <CsModal v-if="modal === 'retention'" title="Edit retention setting(s)" @close="modal = ''">
      <div class="cs-field"><label class="cs-label" for="cg-r2">Expire events after</label>
        <select id="cg-r2" v-model.number="retention" class="cs-select"><option :value="0">Never expire</option>
          <option v-for="d in RETENTION" :key="d" :value="d">{{ retentionLabel(d) }}</option></select></div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveRetention">Save</button>
      </template>
    </CsModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, pick } from '@/utils/portalKit';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, useAws } from '../ctx';
import { RETENTION, retentionLabel } from './cwKit';

const ctx = useAws();
const creating = computed(() => ctx.route.value.page === 'create');
const groups = computed(() => pick<any[]>(ctx.view.value, 'logs.groups', []));
const selected = ref<string[]>([]);
const modal = ref<'' | 'delete' | 'retention'>('');
const busy = ref(false);
const name = ref('');
const retention = ref(0);
const tried = ref(false);

const columns: Column[] = [
  { id: 'name', header: 'Log group', sortKey: 'name' },
  { id: 'class', header: 'Log class', cell: () => 'Standard' },
  { id: 'anomaly', header: 'Anomaly detection', cell: () => 'Configure' },
  { id: 'protection', header: 'Data protection', cell: () => '-' },
  { id: 'retention', header: 'Retention', cell: r => (r.retention ? retentionLabel(r.retention) : 'Never expire') },
  { id: 'events', header: 'Stored events', sortKey: 'events' },
  { id: 'created', header: 'Creation time', cell: r => awsDate(r.created) },
];
const nameError = computed(() => {
  if (!/^[A-Za-z0-9_\-/.#]{1,512}$/.test(name.value)) return 'Log group name is invalid.';
  if (groups.value.some(g => g.name === name.value)) return 'The specified log group already exists.';
  return '';
});

function act(id: string) {
  modal.value = id as typeof modal.value;
  retention.value = 0;
}
async function create() {
  tried.value = true;
  if (nameError.value) return;
  busy.value = true;
  const made = await ctx.run(cli(['aws', 'logs', 'create-log-group'], { '--log-group-name': name.value }));
  if (made.ok && retention.value) {
    await ctx.run(cli(['aws', 'logs', 'put-retention-policy'], { '--log-group-name': name.value, '--retention-in-days': retention.value }));
  }
  busy.value = false;
  if (made.ok) {
    ctx.api.notify('success', `Log group "${name.value}" has been created.`);
    ctx.to('cloudwatch', 'groups');
  }
}
async function remove() {
  busy.value = true;
  for (const group of selected.value) {
    await ctx.run(cli(['aws', 'logs', 'delete-log-group'], { '--log-group-name': group }));
  }
  ctx.api.notify('success', `Successfully deleted ${selected.value.length} log group(s).`);
  busy.value = false;
  modal.value = '';
  selected.value = [];
}
async function saveRetention() {
  busy.value = true;
  for (const group of selected.value) {
    const command = retention.value
      ? cli(['aws', 'logs', 'put-retention-policy'], { '--log-group-name': group, '--retention-in-days': retention.value })
      : cli(['aws', 'logs', 'delete-retention-policy'], { '--log-group-name': group });
    await ctx.run(command);
  }
  ctx.api.notify('success', 'Retention setting updated.');
  busy.value = false;
  modal.value = '';
}
</script>

<style scoped>
.cg__p { margin: 0 0 8px; }
.cg__ids { margin: 0; padding-left: 18px; }
</style>
