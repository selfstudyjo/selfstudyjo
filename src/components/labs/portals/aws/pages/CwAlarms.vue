<template>
  <div>
    <CsTable v-model:selected="selected" title="Alarms" variant="full-page" :items="alarms" :columns="columns" track-by="name"
             selection-type="single" empty-title="No alarms" empty-text="Create an alarm to be notified when a metric crosses a threshold.">
      <template #actions>
        <CsDropdown :items="[{ id: 'ALARM', text: 'Set state: In alarm (test actions)' }, { id: 'OK', text: 'Set state: OK' }, { id: 'delete', text: 'Delete' }]"
                    :disabled="!current" @select="action" />
        <button type="button" class="cs-btn cs-btn--primary" @click="openCreate">Create alarm</button>
      </template>
      <template #cell-state="{ row }"><CsStatus :state="row.state === 'ALARM' ? 'failed' : row.state === 'OK' ? 'success' : 'pending'"
        :label="row.state === 'ALARM' ? 'In alarm' : row.state === 'OK' ? 'OK' : 'Insufficient data'" /></template>
    </CsTable>
    <section v-if="current" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="current.name" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>State reason</dt><dd>{{ current.reason }}</dd></div>
        <div><dt>Actions</dt><dd class="cs-mono">{{ current.actions.join(', ') || '-' }}</dd></div>
        <div><dt>Notifications sent</dt><dd>{{ current.fired }}</dd></div>
        <div><dt>History</dt><dd>{{ current.history.join(' > ') || '-' }}</dd></div>
      </dl></div>
    </section>
    <CsModal v-if="form.open" title="Create alarm" size="large" @close="form.open = false">
      <div class="cs-stack">
        <div class="cs-grid-2">
          <div class="cs-field"><label class="cs-label" for="al-metric">Metric</label>
            <select id="al-metric" v-model="form.metricKey" class="cs-select">
              <option v-for="m in metricChoices" :key="m.key" :value="m.key">{{ m.label }}</option></select></div>
          <div class="cs-field"><label class="cs-label" for="al-stat">Statistic</label>
            <select id="al-stat" v-model="form.statistic" class="cs-select"><option v-for="s in ['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount']" :key="s">{{ s }}</option></select></div>
          <div class="cs-field"><label class="cs-label" for="al-period">Period (seconds)</label>
            <select id="al-period" v-model.number="form.period" class="cs-select"><option :value="60">1 minute</option><option :value="300">5 minutes</option><option :value="3600">1 hour</option></select></div>
          <div class="cs-field"><label class="cs-label" for="al-eval">Datapoints to alarm (evaluation periods)</label>
            <input id="al-eval" v-model.number="form.evaluation" type="number" min="1" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="al-cmp">Whenever the metric is</label>
            <select id="al-cmp" v-model="form.comparison" class="cs-select">
              <option value="GreaterThanThreshold">Greater &gt; threshold</option><option value="GreaterThanOrEqualToThreshold">Greater/Equal &gt;= threshold</option>
              <option value="LessThanThreshold">Lower &lt; threshold</option><option value="LessThanOrEqualToThreshold">Lower/Equal &lt;= threshold</option></select></div>
          <div class="cs-field"><label class="cs-label" for="al-thr">Threshold</label><input id="al-thr" v-model.number="form.threshold" type="number" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="al-miss">Missing data treatment</label>
            <select id="al-miss" v-model="form.missing" class="cs-select"><option value="missing">Treat missing data as missing</option>
              <option value="notBreaching">Treat missing data as good (not breaching threshold)</option><option value="breaching">Treat missing data as bad (breaching threshold)</option></select></div>
          <div class="cs-field"><label class="cs-label" for="al-topic">Send a notification to SNS topic</label>
            <select id="al-topic" v-model="form.topic" class="cs-select"><option value="">No notification</option>
              <option v-for="t in topics" :key="t.arn" :value="t.arn">{{ t.name }}</option></select></div>
        </div>
        <div class="cs-field"><label class="cs-label" for="al-name">Alarm name</label><input id="al-name" v-model.trim="form.name" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label" for="al-desc">Alarm description <small>- optional</small></label><input id="al-desc" v-model="form.description" class="cs-input" /></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="form.open = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!form.name || !form.metricKey || busy" @click="create">Create alarm</button>
      </template>
    </CsModal>
    <CsDelete v-if="deleting && current" :title="`Delete alarm ${current.name}?`" :busy="busy" @close="deleting = false" @confirm="remove" />
  </div>
</template>

<script setup lang="ts">
/** CloudWatch alarms: create on a real metric with an SNS action, test with set-alarm-state, delete. */
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsModal from '../CsModal.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const alarms = computed(() => rows(ctx.view.value, 'cloudwatch.alarms'));
const topics = computed(() => rows(ctx.view.value, 'sns'));
const selected = ref<string[]>([]);
const current = computed(() => alarms.value.find(a => a.name === selected.value[0]) || null);
const busy = ref(false);
const deleting = ref(false);

/** The metrics this account emits, plus the well-known ones for its streams and workgroups. */
const metricChoices = computed(() => {
  const seen = new Map<string, { key: string; label: string; ns: string; name: string; dims: Record<string, string> }>();
  const add = (ns: string, name: string, dims: Record<string, string>) => {
    const key = JSON.stringify([ns, name, dims]);
    const label = `${ns} - ${name} (${Object.entries(dims).map(([k, v]) => `${k}=${v}`).join(', ')})`;
    if (!seen.has(key)) seen.set(key, { key, label, ns, name, dims });
  };
  for (const s of rows(ctx.view.value, 'kinesis')) {
    add('AWS/Kinesis', 'GetRecords.IteratorAgeMilliseconds', { StreamName: s.name });
    add('AWS/Kinesis', 'IncomingRecords', { StreamName: s.name });
  }
  for (const w of rows(ctx.view.value, 'athena.workgroups')) add('AWS/Athena', 'ProcessedBytes', { WorkGroup: w.name });
  for (const m of rows(ctx.view.value, 'stepfunctions.machines')) add('AWS/States', 'ExecutionsFailed', { StateMachineArn: m.arn });
  for (const m of rows(ctx.view.value, 'cloudwatch.metrics')) add(m.namespace, m.name, m.dims || {});
  return [...seen.values()];
});
const form = reactive({ open: false, metricKey: '', statistic: 'Maximum', period: 60, evaluation: 5, comparison: 'GreaterThanThreshold',
  threshold: 60000, missing: 'notBreaching', topic: '', name: '', description: '' });

const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' }, { id: 'state', header: 'State' },
  { id: 'conditions', header: 'Conditions', cell: r => `${r.metric} ${r.comparison.replace('Threshold', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase()} ${r.threshold} for ${r.evaluation} datapoints within ${Math.round(r.period * r.evaluation / 60)} minutes` },
  { id: 'actions', header: 'Actions', cell: r => (r.actions.length ? 'Actions enabled' : 'No actions') },
];

function openCreate() {
  form.open = true;
  form.metricKey = metricChoices.value[0]?.key || '';
  form.topic = topics.value[0]?.arn || '';
}
async function create() {
  const metric = metricChoices.value.find(m => m.key === form.metricKey)!;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'cloudwatch', 'put-metric-alarm'], {
    '--alarm-name': form.name, '--alarm-description': form.description, '--namespace': metric.ns, '--metric-name': metric.name,
    '--dimensions': Object.entries(metric.dims).map(([k, v]) => `Name=${k},Value=${v}`), '--statistic': form.statistic,
    '--period': form.period, '--evaluation-periods': form.evaluation, '--threshold': form.threshold,
    '--comparison-operator': form.comparison, '--treat-missing-data': form.missing,
    '--alarm-actions': form.topic ? [form.topic] : [] }), `Successfully created alarm ${form.name}.`);
  busy.value = false;
  if (result.ok) { form.open = false; selected.value = [form.name]; }
}
async function action(id: string) {
  if (id === 'delete') { deleting.value = true; return; }
  busy.value = true;
  await ctx.run(cli(['aws', 'cloudwatch', 'set-alarm-state'], { '--alarm-name': current.value!.name, '--state-value': id,
    '--state-reason': 'Set from the console to test the alarm actions' }), `Alarm state set to ${id}.`);
  busy.value = false;
}
async function remove() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'cloudwatch', 'delete-alarms'], { '--alarm-names': [current.value!.name] }), 'Alarm deleted.');
  busy.value = false;
  if (result.ok) { deleting.value = false; selected.value = []; }
}
</script>
