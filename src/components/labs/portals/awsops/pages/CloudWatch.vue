<template>
  <!-- Alarms -->
  <div v-if="page === 'alarms'" @contextmenu="onRowMenu">
    <CsTable variant="full-page" title="Alarms" :items="alarms" :columns="cols" track-by="name" selection-type="multi" v-model:selected="sel"
             filter-placeholder="Search" empty-title="No alarms" empty-text="Create an alarm to watch a metric.">
      <template #actions>
        <CsDropdown :items="actions" :disabled="!sel.length" @select="act" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('cloudwatch', 'alarm-create')">Create alarm</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" :data-row="row.name" @click.prevent="ctx.to('cloudwatch', 'alarm', { name: row.name })">{{ row.name }}</a></template>
      <template #cell-state="{ row }"><CsStatus :type="stateKind(row.state)" :label="stateLabel(row.state)" /></template>
      <template #cell-actions="{ row }">{{ row.actions_enabled ? (row.alarm_actions.length ? 'Actions enabled' : 'No actions') : 'Actions disabled' }}</template>
    </CsTable>
  </div>

  <!-- One alarm -->
  <div v-else-if="page === 'alarm' && alarm">
    <CsHeader :title="alarm.name">
      <template #actions>
        <CsDropdown :items="oneActions" @select="oneAct" />
        <button type="button" class="cs-btn" @click="deleting = [alarm.name]">Delete</button>
        <button v-if="!alarm.composite" type="button" class="cs-btn" @click="ctx.to('cloudwatch', 'alarm-create', { edit: alarm.name })">Edit</button>
      </template>
    </CsHeader>
    <section v-if="!alarm.composite" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Graph" :level="2" :info="false" :description="`${alarm.metric} ${COMPARISONS[alarm.comparison]} ${alarm.threshold} for ${alarm.datapoints} datapoints within ${alarm.evaluation_periods * alarm.period / 60} minutes`" /></div>
      <div class="cs-container__body"><MetricChart :points="alarm.series" :label="`${alarm.metric} (${alarm.statistic})`" :threshold="alarm.threshold" /></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>State</dt><dd><CsStatus :type="stateKind(alarm.state)" :label="stateLabel(alarm.state)" /></dd></div>
        <template v-if="!alarm.composite">
          <div><dt>Threshold</dt><dd>{{ alarm.metric }} {{ COMPARISONS[alarm.comparison] }} {{ alarm.threshold }} for {{ alarm.datapoints }} datapoints within {{ alarm.evaluation_periods }} periods</dd></div>
          <div><dt>Namespace</dt><dd>{{ alarm.namespace }}</dd></div><div><dt>Metric name</dt><dd>{{ alarm.metric }}</dd></div>
          <div><dt>{{ alarm.dimension_name }}</dt><dd>{{ alarm.dimension }}</dd></div><div><dt>Statistic</dt><dd>{{ alarm.statistic }}</dd></div>
          <div><dt>Period</dt><dd>{{ alarm.period / 60 }} minute{{ alarm.period === 60 ? '' : 's' }}</dd></div><div><dt>Datapoints to alarm</dt><dd>{{ alarm.datapoints }} out of {{ alarm.evaluation_periods }}</dd></div>
          <div><dt>Missing data treatment</dt><dd>{{ alarm.missing }}</dd></div>
        </template>
        <div v-else><dt>Alarm rule</dt><dd class="cs-mono">{{ alarm.rule }}</dd></div>
        <div><dt>Actions</dt><dd>{{ alarm.alarm_actions.map(lastPart).join(', ') || 'No actions' }}{{ alarm.actions_enabled ? '' : ' (disabled)' }}</dd></div>
        <div><dt>ARN</dt><dd class="cs-mono">{{ alarm.arn }}</dd></div>
      </dl></div>
    </section>
    <CsTable title="History" :items="alarm.history.map((h: any, i: number) => ({ ...h, key: i, summary: `Alarm updated from ${h.from} to ${h.to}` }))" :columns="histCols" track-by="key" empty-title="No history" />
  </div>

  <!-- Create / edit alarm -->
  <div v-else-if="page === 'alarm-create'">
    <CsHeader :title="editName ? `Edit ${editName}` : 'Create alarm'" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Metric" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-grid-2">
          <div class="cs-field"><label class="cs-label">Metric</label>
            <select v-model="metricKey" class="cs-select"><option v-for="m in metrics" :key="m.namespace + m.name" :value="m.namespace + '|' + m.name">{{ m.namespace }} &gt; {{ m.name }}</option></select></div>
          <div class="cs-field"><label class="cs-label">{{ dimName }}</label>
            <select v-if="dimName === 'InstanceId'" v-model="f.dimension" class="cs-select"><option v-for="i in instances" :key="i.id" :value="i.id">{{ i.id }} ({{ i.name }})</option></select>
            <input v-else v-model="f.dimension" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label">Statistic</label><select v-model="f.statistic" class="cs-select"><option v-for="s in ['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount']" :key="s">{{ s }}</option></select></div>
          <div class="cs-field"><label class="cs-label">Period</label><select v-model="f.period" class="cs-select"><option value="60">1 minute</option><option value="300">5 minutes</option><option value="900">15 minutes</option></select></div>
        </div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Conditions" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Whenever {{ selectedMetric?.name }} is...</label>
          <div class="cs-tiles"><label v-for="(sym, op) in COMPARISONS" :key="op" class="cs-tile" :class="{ 'is-checked': f.comparison === op }">
            <input v-model="f.comparison" type="radio" :value="op" /><span><strong>{{ sym }}</strong><small>{{ op.replace('Threshold', ' threshold').replace(/([a-z])([A-Z])/g, '$1 $2') }}</small></span></label></div></div>
        <div class="cs-field"><label class="cs-label">than...</label><input v-model="f.threshold" class="cs-input cw__narrow" inputmode="decimal" /><span class="cs-constraint">Must be a number</span></div>
        <div class="cs-field"><label class="cs-label">Datapoints to alarm</label>
          <div class="cs-row"><input v-model="f.datapoints" class="cs-input cw__tiny" inputmode="numeric" /> out of <input v-model="f.periods" class="cs-input cw__tiny" inputmode="numeric" /></div>
          <span class="cs-constraint">Define the number of datapoints within the evaluation period that must be breaching to cause the alarm to go to ALARM state.</span>
          <span v-if="Number(f.datapoints) > Number(f.periods)" class="cs-error-text">Datapoints to alarm cannot exceed the evaluation periods.</span></div>
        <div class="cs-field"><label class="cs-label">Missing data treatment</label>
          <select v-model="f.missing" class="cs-select"><option value="missing">Treat missing data as missing</option><option value="notBreaching">Treat missing data as good (not breaching threshold)</option>
            <option value="breaching">Treat missing data as bad (breaching threshold)</option><option value="ignore">Ignore (maintain the alarm state)</option></select></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Notification" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Send a notification to the following SNS topic (in ALARM)</label>
          <select v-model="f.topic" class="cs-select"><option value="">No notification</option><option v-for="t in topics" :key="t.arn" :value="t.arn">{{ t.name }}</option></select></div>
        <label class="cs-check"><input v-model="f.okToo" type="checkbox" :disabled="!f.topic" /><span>Also notify when the alarm returns to OK</span></label>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Name and description" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Alarm name</label><input v-model="f.name" class="cs-input" :disabled="!!editName" /></div>
        <div class="cs-field"><label class="cs-label">Alarm description <small>- optional</small></label><textarea v-model="f.description" class="cs-textarea" /></div>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('cloudwatch', 'alarms')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !ready" @click="saveAlarm">{{ editName ? 'Update alarm' : 'Create alarm' }}</button>
    </div>
  </div>

  <!-- Metrics -->
  <div v-else-if="page === 'metrics'">
    <CsHeader title="Metrics" description="Browse a metric and graph its last datapoints." />
    <section class="cs-container"><div class="cs-container__body cs-stack">
      <div class="cs-grid-3">
        <div class="cs-field"><label class="cs-label">Metric</label><select v-model="mx.key" class="cs-select"><option v-for="m in metrics" :key="m.namespace + m.name" :value="m.namespace + '|' + m.name">{{ m.namespace }} &gt; {{ m.name }}</option></select></div>
        <div class="cs-field"><label class="cs-label">Dimension</label>
          <select v-if="mxDim === 'InstanceId'" v-model="mx.dim" class="cs-select"><option v-for="i in instances" :key="i.id" :value="i.id">{{ i.name }} ({{ i.id }})</option></select>
          <input v-else v-model="mx.dim" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label">Period</label><select v-model="mx.period" class="cs-select"><option value="60">1 minute</option><option value="300">5 minutes</option></select></div>
      </div>
      <div class="cs-row"><button type="button" class="cs-btn" :disabled="busy" @click="graph">Graph metric</button></div>
      <MetricChart v-if="mxPoints.length" :points="mxPoints" :label="mx.key.split('|')[1] + ' (Average)'" />
    </div></section>
  </div>

  <CsModal v-if="stating" title="Set alarm state" @close="stating = ''">
    <div class="cs-stack">
      <p class="cw__p">Temporarily set the state of <strong>{{ stating }}</strong>. The alarm returns to its actual state at its next evaluation; use this to test that its actions (SNS topics, incidents) fire.</p>
      <div class="cs-field"><span class="cs-label">State</span>
        <div class="cs-tiles">
          <label v-for="s in ['ALARM', 'OK', 'INSUFFICIENT_DATA']" :key="s" class="cs-tile" :class="{ 'is-checked': stateValue === s }">
            <input v-model="stateValue" type="radio" :value="s" /><span><strong>{{ stateLabel(s) }}</strong></span></label>
        </div></div>
      <div class="cs-field"><label class="cs-label" for="cw-reason">Reason</label>
        <input id="cw-reason" v-model="stateReason" class="cs-input" :class="{ 'is-invalid': stateTried && !stateReason.trim() }" />
        <span v-if="stateTried && !stateReason.trim()" class="cs-error-text">A reason is required.</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="stating = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="setState">Set state</button>
    </template>
  </CsModal>

  <RowMenu v-if="rm.menu.value" :x="rm.menu.value.x" :y="rm.menu.value.y" :title="rm.menu.value.key" :items="menuItems"
           @select="menuAct" @close="rm.close" />

  <CsDelete v-if="deleting.length" title="Delete alarms" word="confirm" action="Delete" :busy="busy" @close="deleting = []" @confirm="remove">
    <p class="cw__p">Delete {{ deleting.join(', ') }}?</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import RowMenu from '../RowMenu.vue';
import { copyText, useRowMenu, type MenuItem } from '../rowmenu';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import { COMPARISONS, lastPart } from '../kit';
import MetricChart from './MetricChart.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const busy = ref(false);
const deleting = ref<string[]>([]);

const alarms = computed(() => rows<any>(ctx.c.value, 'monitoring.alarms').map(a => ({ ...a,
  conditions: a.composite ? a.rule : `${a.metric} ${COMPARISONS[a.comparison]} ${a.threshold} for ${a.datapoints} datapoints within ${a.evaluation_periods * a.period / 60} minutes` })));
const alarm = computed<any>(() => alarms.value.find(a => a.name === ctx.route.value.params?.name) || null);
const metrics = computed(() => rows<any>(ctx.c.value, 'monitoring.metrics'));
const topics = computed(() => rows<any>(ctx.c.value, 'monitoring.topics'));
const instances = computed(() => rows<any>(ctx.c.value, 'ec2.instances').filter(i => i.state === 'running' && i.region === ctx.home.value));

function stateKind(s: string) { return s === 'ALARM' ? 'error' : s === 'OK' ? 'success' : 'stopped'; }
function stateLabel(s: string) { return s === 'ALARM' ? 'In alarm' : s === 'OK' ? 'OK' : 'Insufficient data'; }
const cols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'state', header: 'State', sortKey: 'state' },
  { id: 'changed', header: 'Last state update (shift)' }, { id: 'conditions', header: 'Conditions' }, { id: 'actions', header: 'Actions' }];
const histCols = [{ id: 'time', header: 'Date (shift)' }, { id: 'summary', header: 'Summary' }, { id: 'reason', header: 'Reason' }];
const actions = computed(() => [
  { id: 'edit', text: 'Edit', disabled: sel.value.length !== 1 || Boolean(alarms.value.find(a => a.name === sel.value[0])?.composite) },
  { id: 'state', text: 'Set alarm state', disabled: sel.value.length !== 1 },
  { id: 'delete', text: 'Delete' }, { id: 'disable', text: 'Disable actions' }, { id: 'enable', text: 'Enable actions' },
]);
const oneActions = computed(() => [
  { id: 'state', text: 'Set alarm state' },
  { id: alarm.value?.actions_enabled ? 'disable' : 'enable', text: alarm.value?.actions_enabled ? 'Disable actions' : 'Enable actions' },
  { id: 'copy-arn', text: 'Copy ARN' },
]);
async function oneAct(action: string) {
  if (!alarm.value) return;
  sel.value = [alarm.value.name];
  if (action === 'copy-arn') { await copy(alarm.value.arn); return; }
  await act(action);
}
const stating = ref('');
const stateValue = ref('ALARM');
const stateReason = ref('');
const stateTried = ref(false);
async function setState() {
  stateTried.value = true;
  if (!stateReason.value.trim()) return;
  const name = stating.value;
  const result = await ctx.run(cli(['aws', 'cloudwatch', 'set-alarm-state'], {
    '--alarm-name': name, '--state-value': stateValue.value, '--state-reason': stateReason.value.trim(),
  }), `Alarm ${name} set to ${stateLabel(stateValue.value)}.`);
  if (result.ok) stating.value = '';
}
async function copy(text: string) {
  const ok = await copyText(text);
  ctx.api.notify(ok ? 'success' : 'error', ok ? 'Copied to clipboard' : 'Could not copy to the clipboard');
}
const rm = useRowMenu();
const menuAlarm = computed<any>(() => alarms.value.find(a => a.name === rm.menu.value?.key) || null);
const menuItems = computed<MenuItem[]>(() => {
  const a = menuAlarm.value;
  if (!a) return [];
  return [
    { id: 'view', text: 'View details' },
    { id: 'edit', text: 'Edit', disabled: Boolean(a.composite), disabledReason: 'A composite alarm is edited from the CLI.' },
    { id: 'state', text: 'Set alarm state' },
    { id: a.actions_enabled ? 'disable' : 'enable', text: a.actions_enabled ? 'Disable actions' : 'Enable actions' },
    { id: 'd1', divider: true },
    { id: 'copy-name', text: 'Copy alarm name' }, { id: 'copy-arn', text: 'Copy ARN' },
    { id: 'd2', divider: true },
    { id: 'delete', text: 'Delete', danger: true },
  ];
});
function onRowMenu(event: MouseEvent) { rm.open(event, key => { sel.value = [key]; }); }
async function menuAct(action: string) {
  const a = menuAlarm.value;
  if (!a) return;
  sel.value = [a.name];
  if (action === 'view') ctx.to('cloudwatch', 'alarm', { name: a.name });
  else if (action === 'copy-name') await copy(a.name);
  else if (action === 'copy-arn') await copy(a.arn);
  else await act(action);
}
async function act(action: string) {
  if (action === 'delete') { deleting.value = [...sel.value]; return; }
  if (action === 'edit') { ctx.to('cloudwatch', 'alarm-create', { edit: sel.value[0] }); return; }
  if (action === 'state') { stating.value = sel.value[0]; stateValue.value = 'ALARM'; stateReason.value = 'Testing the alarm actions'; stateTried.value = false; return; }
  busy.value = true;
  await ctx.run(cli(['aws', 'cloudwatch', `${action}-alarm-actions`], { '--alarm-names': sel.value }), `Actions ${action}d for ${sel.value.length} alarm(s).`);
  busy.value = false;
}
async function remove() {
  busy.value = true;
  const names = deleting.value;
  const result = await ctx.run(cli(['aws', 'cloudwatch', 'delete-alarms'], { '--alarm-names': names }), `Successfully deleted ${names.length} alarm(s).`);
  busy.value = false;
  deleting.value = [];
  sel.value = [];
  if (result.ok && page.value === 'alarm') ctx.to('cloudwatch', 'alarms');
}

const editName = computed(() => ctx.route.value.params?.edit || '');
const metricKey = ref('AWS/EC2|CPUUtilization');
const selectedMetric = computed<any>(() => metrics.value.find(m => `${m.namespace}|${m.name}` === metricKey.value));
const dimName = computed(() => selectedMetric.value?.dimension || 'InstanceId');
const f = reactive({ dimension: '', statistic: 'Average', period: '300', comparison: 'GreaterThanThreshold', threshold: '80',
  datapoints: '3', periods: '3', missing: 'missing', topic: '', okToo: false, name: '', description: '' });
watch(dimName, d => { if (d !== 'InstanceId') f.dimension = d === 'LoadBalancer' ? 'app/alb-payments-api/5f1b' : 'tg-payments-api'; else if (!f.dimension.startsWith('i-')) f.dimension = instances.value[0]?.id || ''; }, { immediate: true });
const existing = alarms.value.find(a => a.name === editName.value && !a.composite);
if (existing) {
  metricKey.value = `${existing.namespace}|${existing.metric}`;
  Object.assign(f, { dimension: existing.dimension, statistic: existing.statistic, period: String(existing.period), comparison: existing.comparison,
    threshold: String(existing.threshold), datapoints: String(existing.datapoints), periods: String(existing.evaluation_periods), missing: existing.missing,
    topic: existing.alarm_actions[0] || '', okToo: existing.ok_actions.length > 0, name: existing.name, description: existing.description });
}
const ready = computed(() => f.name.trim() && f.dimension && /^-?\d+(\.\d+)?$/.test(f.threshold) && /^\d+$/.test(f.datapoints) && /^\d+$/.test(f.periods)
  && Number(f.datapoints) >= 1 && Number(f.datapoints) <= Number(f.periods));
async function saveAlarm() {
  const [namespace, name] = metricKey.value.split('|');
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'cloudwatch', 'put-metric-alarm'], {
    '--alarm-name': f.name.trim(), '--alarm-description': f.description.trim(), '--namespace': namespace, '--metric-name': name,
    '--dimensions': `Name=${dimName.value},Value=${f.dimension}`, '--statistic': f.statistic, '--period': f.period,
    '--evaluation-periods': f.periods, '--datapoints-to-alarm': f.datapoints, '--threshold': f.threshold,
    '--comparison-operator': f.comparison, '--treat-missing-data': f.missing,
    '--alarm-actions': f.topic ? [f.topic] : [], '--ok-actions': f.topic && f.okToo ? [f.topic] : [],
  }), editName.value ? `Successfully updated alarm ${f.name}.` : `Successfully created alarm ${f.name}.`);
  busy.value = false;
  if (result.ok) ctx.to('cloudwatch', 'alarm', { name: f.name.trim() });
}

const mx = reactive({ key: 'AWS/EC2|CPUUtilization', dim: '', period: '60' });
const mxDim = computed(() => metrics.value.find(m => `${m.namespace}|${m.name}` === mx.key)?.dimension || 'InstanceId');
watch(mxDim, d => { mx.dim = d === 'InstanceId' ? (instances.value[0]?.id || '') : d === 'LoadBalancer' ? 'app/alb-payments-api/5f1b' : 'tg-payments-api'; }, { immediate: true });
const mxPoints = ref<{ t: string; v: number | null }[]>([]);
async function graph() {
  const [namespace, name] = mx.key.split('|');
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'cloudwatch', 'get-metric-statistics'], {
    '--namespace': namespace, '--metric-name': name, '--dimensions': `Name=${mxDim.value},Value=${mx.dim}`,
    '--statistics': 'Average', '--period': mx.period, '--start-time': 'now-1h', '--end-time': 'now',
  }), '', { unlogged: true });
  busy.value = false;
  const data = parseJson<any>(result.output);
  mxPoints.value = (data?.Datapoints || []).map((p: any) => ({ t: p.Timestamp, v: p.Average ?? null }));
}
</script>

<style scoped>
.cw__narrow { width: 160px; }
.cw__tiny { width: 70px; }
.cw__p { margin: 0; }
</style>
