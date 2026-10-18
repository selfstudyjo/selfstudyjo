<template>
  <div v-if="group">
    <CsHeader :title="group.name">
      <template #actions>
        <CsDropdown :items="[{ id: 'retention', text: 'Edit retention setting' }, { id: 'delete', text: 'Delete log group' }]" @select="act" />
        <button type="button" class="cs-btn" disabled>View in Logs Insights</button>
        <button type="button" class="cs-btn cs-btn--primary" disabled>Start tailing</button>
      </template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Log group details" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Log class</dt><dd>Standard</dd></div>
        <div><dt>Retention</dt><dd>{{ group.retention ? retentionLabel(group.retention) : 'Never expire' }}</dd></div>
        <div><dt>Creation time</dt><dd>{{ awsDate(group.created) }}</dd></div>
        <div><dt>Stored bytes</dt><dd>{{ group.events ? group.events * 96 : 0 }}</dd></div>
        <div><dt>ARN</dt><dd class="cs-mono">{{ group.arn }}</dd></div>
        <div><dt>Metric filters</dt><dd>0</dd></div>
      </dl></div>
    </section>
    <div class="cs-tabs">
      <button type="button" class="cs-tab is-active">Log streams</button>
      <button type="button" class="cs-tab" disabled>Tags</button>
      <button type="button" class="cs-tab" disabled>Anomaly detection</button>
      <button type="button" class="cs-tab" disabled>Metric filters</button>
    </div>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Log events" :level="2"
        description="You can use the filter bar below to search for and match terms, phrases, or values in your log events.">
        <template #actions><button type="button" class="cs-btn" :disabled="busy" @click="load"><CsIcon name="refresh" /> Load events</button></template></CsHeader></div>
      <div class="cs-container__body cs-stack">
        <input v-model="filter" class="cs-input" placeholder="Filter events - press enter to search" aria-label="Filter events" />
        <div class="cs-scroll-x">
          <table class="cs-table-mini"><thead><tr><th>Timestamp</th><th>Message</th></tr></thead>
            <tbody><tr v-for="(e, i) in shown" :key="i"><td class="cg__ts">{{ e.at }}</td><td class="cs-mono cg__msg">{{ e.message }}</td></tr>
              <tr v-if="!shown.length"><td colspan="2" class="cs-empty"><strong>No events found</strong>{{ loaded ? 'No events in this log group.' : 'Choose "Load events" to fetch them.' }}</td></tr></tbody></table>
        </div>
      </div>
    </section>
    <CsModal v-if="modal === 'delete'" title="Delete log group" @close="modal = ''">
      <p class="cg__p">Are you sure you want to delete <strong>{{ group.name }}</strong>? Deleting the log group will permanently delete all the archived log events associated with the log group.</p>
      <template #footer><button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="remove">Delete</button></template>
    </CsModal>
    <CsModal v-if="modal === 'retention'" title="Edit retention setting" @close="modal = ''">
      <div class="cs-field"><label class="cs-label" for="cgg-r">Expire events after</label>
        <select id="cgg-r" v-model.number="retention" class="cs-select"><option :value="0">Never expire</option>
          <option v-for="d in RETENTION" :key="d" :value="d">{{ retentionLabel(d) }}</option></select></div>
      <template #footer><button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveRetention">Save</button></template>
    </CsModal>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>Log group does not exist</strong>The specified log group "{{ name }}" does not exist.
      <button type="button" class="cs-link" @click="ctx.to('cloudwatch', 'groups')">View log groups</button></div></div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { cli, pick } from '@/utils/portalKit';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import { awsDate, useAws } from '../ctx';
import { RETENTION, retentionLabel } from './cwKit';

const ctx = useAws();
const name = computed(() => ctx.route.value.params?.name || '');
const group = computed(() => pick<any[]>(ctx.view.value, 'logs.groups', []).find(g => g.name === name.value) || null);
const events = ref<{ at: string; message: string }[]>([]);
const loaded = ref(false);
const filter = ref('');
const modal = ref<'' | 'delete' | 'retention'>('');
const retention = ref(0);
const busy = ref(false);
const shown = computed(() => events.value.filter(e => !filter.value || e.message.toLowerCase().includes(filter.value.toLowerCase())));

async function load() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'logs', 'get-log-events'], { '--log-group-name': name.value }), '', { unlogged: true });
  busy.value = false;
  loaded.value = true;
  const data = (result.data || {}) as { events?: { at: string; message: string }[] };
  events.value = [...(data.events || [])].reverse();
}
function act(id: string) {
  retention.value = group.value?.retention || 0;
  modal.value = id as typeof modal.value;
}
async function remove() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'logs', 'delete-log-group'], { '--log-group-name': name.value }), `Deleted log group ${name.value}.`);
  busy.value = false;
  if (result.ok) { modal.value = ''; ctx.to('cloudwatch', 'groups'); }
}
async function saveRetention() {
  busy.value = true;
  const command = retention.value
    ? cli(['aws', 'logs', 'put-retention-policy'], { '--log-group-name': name.value, '--retention-in-days': retention.value })
    : cli(['aws', 'logs', 'delete-retention-policy'], { '--log-group-name': name.value });
  const result = await ctx.run(command, 'Retention setting updated.');
  busy.value = false;
  if (result.ok) modal.value = '';
}
onMounted(() => { if (group.value) load(); });
</script>

<style scoped>
.cg__ts { white-space: nowrap; width: 200px; }
.cg__msg { white-space: pre-wrap; word-break: break-word; }
.cg__p { margin: 0; }
</style>
