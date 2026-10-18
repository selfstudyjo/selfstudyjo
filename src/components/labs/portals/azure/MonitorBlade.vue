<template>
  <div class="az-split">
    <nav class="az-svcmenu" aria-label="Monitor menu">
      <template v-for="item in MENU" :key="item.key">
        <div v-if="item.group" class="az-svcmenu__group">{{ item.label }}</div>
        <button v-else type="button" class="az-svcmenu__item" :class="{ 'is-active': tab === item.key }" @click="emit('tab', item.key)">
          <AzIcon :name="item.icon || 'monitor'" /> {{ item.label }}</button>
      </template>
    </nav>
    <div class="az-content">
      <template v-if="tab === 'overview'">
        <div class="az-cards">
          <button type="button" class="az-card az-mon__card" @click="emit('tab', 'alerts')"><h3>Alerts</h3>
            <div class="az-big">{{ alerts.length }}</div><div class="az-muted">alert rule(s), {{ alerts.filter(a => !a.action).length }} with no action group</div></button>
          <button type="button" class="az-card az-mon__card" @click="emit('tab', 'logs')"><h3>Logs</h3>
            <div class="az-big">{{ workspaces.length }}</div><div class="az-muted">Log Analytics workspace(s)</div></button>
          <button type="button" class="az-card az-mon__card" @click="emit('tab', 'diag')"><h3>Diagnostic settings</h3>
            <div class="az-big">{{ silent }}</div><div class="az-muted">resource(s) send nothing</div></button>
        </div>
      </template>

      <AzActivityLog v-else-if="tab === 'activity'" />

      <template v-else-if="tab === 'alerts'">
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="openAlert"><AzIcon name="plus" /> Create alert rule</button>
          <button type="button" class="az-cmd" @click="listAlerts"><AzIcon name="refresh" /> Refresh</button>
        </div>
        <div class="az-tabs"><button type="button" class="az-tab is-active">Alert rules</button></div>
        <AzTable :columns="alertCols" :rows="alertRows" row-key="name">
          <template #cell-action="{ row }"><span :class="{ 'az-warntext': !row.action }">{{ row.action || 'None' }}</span></template>
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="removeAlert(row)">Delete</button></template>
          <template #empty>No alert rules. Create one to be notified when a metric crosses a threshold.</template>
        </AzTable>
      </template>

      <template v-else-if="tab === 'logs'">
        <LogsQuery v-if="workspaces.length" />
        <div v-else class="az-empty"><AzIcon name="workspace" :size="56" /><h3>No Log Analytics workspace</h3>
          <p>A query needs somewhere for the data to have been ingested.</p>
          <button type="button" class="az-btn az-btn--primary" @click="az.go({ page: 'create', kind: 'workspace' })">Create workspace</button></div>
      </template>

      <template v-else-if="tab === 'diag'">
        <p class="az-intro">Diagnostic settings for every resource in the subscription. A resource with no setting is invisible to Log Analytics.</p>
        <div class="az-cmdbar"><button type="button" class="az-cmd" @click="listDiag"><AzIcon name="refresh" /> Refresh</button></div>
        <AzTable :columns="diagCols" :rows="diag" row-key="resource">
          <template #cell-status="{ row }"><span class="az-status"><AzIcon :name="row.status === 'collecting' ? 'ok' : 'warning'" :size="14" /> {{ row.status === 'collecting' ? 'Enabled' : 'Disabled' }}</span></template>
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="diagFor = row.resource">Edit setting</button></template>
        </AzTable>
        <pre v-if="diagOut" class="az-code" style="margin-top: 10px">{{ diagOut }}</pre>
        <AzPane v-if="diagFor" title="Diagnostic settings" :subtitle="diagFor" @close="diagFor = ''">
          <DiagnosticsTab :resource="diagFor" />
          <template #foot><button type="button" class="az-btn" @click="diagFor = ''">Close</button></template>
        </AzPane>
      </template>
    </div>

    <AzPane v-if="creating" title="Create an alert rule" :error="error" @close="creating = false">
      <div class="az-tabs"><button type="button" class="az-tab is-active">Scope</button><button type="button" class="az-tab" disabled>Condition</button>
        <button type="button" class="az-tab" disabled>Actions</button><button type="button" class="az-tab" disabled>Details</button></div>
      <div class="az-field"><div class="az-field__label">Resource <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="form.scope" class="az-select"><option value="">Select a resource</option>
          <option v-for="r in resources" :key="r.id" :value="r.id">{{ r.name }} ({{ r.kind }})</option></select></div></div>
      <h3 class="az-group-title">Condition</h3>
      <div class="az-field"><div class="az-field__label">Signal name</div>
        <div class="az-field__ctl"><select v-model="form.signal" class="az-select">
          <option v-for="s in ['Percentage CPU', 'Available Memory Bytes', 'Network In Total', 'Http5xx', 'Transactions', 'Availability']" :key="s">{{ s }}</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Aggregation · Operator · Threshold</div>
        <div class="az-field__ctl az-mon__cond">
          <select v-model="form.agg" class="az-select"><option>avg</option><option>max</option><option>min</option><option>total</option></select>
          <select v-model="form.op" class="az-select"><option>&gt;</option><option>&gt;=</option><option>&lt;</option><option>&lt;=</option></select>
          <input v-model="form.threshold" class="az-input" type="number" /></div></div>
      <div class="az-field"><div class="az-field__label">Check every · Lookback period</div>
        <div class="az-field__ctl az-mon__cond">
          <select v-model="form.frequency" class="az-select"><option>1m</option><option>5m</option><option>15m</option></select>
          <select v-model="form.window" class="az-select"><option>5m</option><option>15m</option><option>1h</option></select></div></div>
      <h3 class="az-group-title">Actions</h3>
      <div class="az-field"><div class="az-field__label">Action group</div>
        <div class="az-field__ctl"><input v-model="form.action" class="az-input" placeholder="ag-platform" />
          <div v-if="!form.action" class="az-help">An alert rule with no action group fires and tells nobody.</div></div></div>
      <h3 class="az-group-title">Details</h3>
      <div class="az-field"><div class="az-field__label">Severity</div>
        <div class="az-field__ctl"><select v-model="form.severity" class="az-select">
          <option v-for="s in [0, 1, 2, 3, 4]" :key="s" :value="String(s)">{{ s }} - {{ ['Critical', 'Error', 'Warning', 'Informational', 'Verbose'][s] }}</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Alert rule name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="form.name" class="az-input" /></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!form.name || !form.scope" @click="createAlert">Review + create</button>
        <button type="button" class="az-btn" @click="creating = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** Azure Monitor: alerts, Logs (KQL), diagnostic settings and the activity log. */
import { computed, reactive, ref, watch } from 'vue';
import { cli, errorText, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import AzActivityLog from './AzActivityLog.vue';
import DiagnosticsTab from './DiagnosticsTab.vue';
import LogsQuery from './LogsQuery.vue';
import { allResources, useAz } from './azure';

const props = defineProps<{ tab: string }>();
const emit = defineEmits<{ (event: 'tab', tab: string): void }>();
const az = useAz();
const MENU = [
  { key: 'overview', label: 'Overview', icon: 'monitor' }, { key: 'activity', label: 'Activity log', icon: 'activity' },
  { key: 'alerts', label: 'Alerts', icon: 'warning' }, { key: 'logs', label: 'Logs', icon: 'query' },
  { key: 'g', label: 'Settings', group: true }, { key: 'diag', label: 'Diagnostic settings', icon: 'settings' },
];
const alerts = computed(() => rows(az.p.value, 'alerts'));
const workspaces = computed(() => rows(az.p.value, 'workspaces'));
const diag = computed(() => rows(az.v.value, 'diagnostics').map((d): Record<string, any> => ({ ...d, actions: '' })));
const silent = computed(() => diag.value.filter(d => d.status !== 'collecting').length);
const alertRows = computed(() => alerts.value.map((a): Record<string, any> => ({ ...a, scope: (a.scopes || []).map((s: string) => s.split('/').pop()).join(', '),
                                                          actions: '' })));
const alertCols = [{ key: 'name', label: 'Name' }, { key: 'condition', label: 'Condition' }, { key: 'scope', label: 'Target resource' },
                   { key: 'severity', label: 'Severity' }, { key: 'frequency', label: 'Frequency' }, { key: 'action', label: 'Action group' },
                   { key: 'actions', label: '', sortable: false }];
const diagCols = [{ key: 'resource', label: 'Name' }, { key: 'kind', label: 'Resource type' }, { key: 'status', label: 'Diagnostics status' },
                  { key: 'workspace', label: 'Workspace' }, { key: 'actions', label: '', sortable: false }];
const resources = computed(() => allResources(az.p.value).filter(r => r.kind !== 'sqldb'));
const diagFor = ref('');
const diagOut = ref('');
async function listDiag() {
  const r = await az.run(cli(['az', 'monitor', 'diagnostic-settings', 'list']), '', { quiet: true });
  diagOut.value = String(r.ok ? r.output : r.error || '').trim();
}
async function listAlerts() { await az.run(cli(['az', 'monitor', 'metrics', 'alert', 'list']), '', { quiet: true }); }
watch(() => props.tab, t => { if (t === 'diag') void listDiag(); }, { immediate: true });

const creating = ref(false);
const error = ref('');
const form = reactive({ scope: '', signal: 'Percentage CPU', agg: 'avg', op: '>', threshold: '80', frequency: '1m', window: '5m',
                        action: '', severity: '3', name: '' });
function openAlert() {
  Object.assign(form, { scope: resources.value[0]?.id || '', signal: 'Percentage CPU', agg: 'avg', op: '>', threshold: '80',
                        frequency: '1m', window: '5m', action: '', severity: '3', name: '' });
  error.value = '';
  creating.value = true;
}
async function createAlert() {
  const res = resources.value.find(r => r.id === form.scope);
  const r = await az.run(cli(['az', 'monitor', 'metrics', 'alert', 'create'], { '--name': form.name, '--resource-group': res?.group,
    '--scopes': form.scope, '--condition': `${form.agg} ${form.signal} ${form.op} ${form.threshold}`, '--window-size': form.window,
    '--evaluation-frequency': form.frequency, '--severity': form.severity, '--action': form.action }),
    `Alert rule '${form.name}' created`, { quiet: true });
  if (!r.ok) { error.value = errorText(r); return; }
  creating.value = false;
}
async function removeAlert(row: Record<string, any>) {
  if (!(await az.confirm({ title: 'Delete alert rule', message: `Delete the alert rule '${row.name}'?`, confirmLabel: 'Yes', danger: true }))) return;
  await az.run(cli(['az', 'monitor', 'metrics', 'alert', 'delete'], { '--name': row.name }), `Deleted alert rule '${row.name}'`);
}
</script>

<style scoped>
.az-mon__card { text-align: left; cursor: pointer; font: inherit; color: inherit; }
.az-mon__card:hover { background: #fafafa; }
.az-big { font-size: 32px; font-weight: 600; margin: 4px 0; }
.az-mon__cond { display: flex; gap: 6px; }
.az-warntext { color: #bc4b09; font-weight: 600; }
</style>
