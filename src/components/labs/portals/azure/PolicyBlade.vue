<template>
  <div class="az-split">
    <nav class="az-svcmenu" aria-label="Policy menu">
      <template v-for="item in MENU" :key="item.key">
        <div v-if="item.group" class="az-svcmenu__group">{{ item.label }}</div>
        <button v-else type="button" class="az-svcmenu__item" :class="{ 'is-active': tab === item.key }" @click="emit('tab', item.key)">
          <AzIcon :name="item.icon || 'policy'" /> {{ item.label }}</button>
      </template>
    </nav>
    <div class="az-content">
      <!-- Overview / Compliance -->
      <template v-if="tab === 'overview' || tab === 'compliance'">
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="emit('tab', 'definitions')"><AzIcon name="plus" /> Assign policy</button>
          <button type="button" class="az-cmd" @click="scan"><AzIcon name="refresh" /> Trigger scan</button>
          <button type="button" class="az-cmd" @click="summarize"><AzIcon name="query" /> Summarize</button>
        </div>
        <div class="az-pol__kpis">
          <div class="az-card"><div class="az-muted">Overall resource compliance</div><div class="az-big">{{ overall }}</div>
            <div class="az-muted">{{ compliantCount }} out of {{ evals.length }} evaluations</div></div>
          <div class="az-card"><div class="az-muted">Non-compliant initiatives / policies</div><div class="az-big">{{ assignments.filter(a => a.status === 'non-compliant').length }}</div>
            <div class="az-muted">out of {{ assignments.length }} assignments</div></div>
          <div class="az-card"><div class="az-muted">Non-compliant resources</div><div class="az-big">{{ new Set(evals.filter(e => e.status === 'non-compliant').map(e => e.resource)).size }}</div></div>
        </div>
        <pre v-if="output" class="az-code">{{ output }}</pre>
        <h3 class="az-section-title">Assignments</h3>
        <AzTable :columns="assignCols" :rows="assignments" row-key="name">
          <template #cell-status="{ row }"><span class="az-status"><AzIcon :name="row.status === 'compliant' ? 'ok' : row.status === 'non-compliant' ? 'error' : 'stopped'" :size="14" /> {{ cap(row.status) }}</span></template>
          <template #empty>No policy assignments. A subscription with no policy is a subscription where anything is allowed.</template>
        </AzTable>
        <h3 class="az-section-title">Resource compliance</h3>
        <AzTable :columns="evalCols" :rows="evals.map((e, i: number): Record<string, any> => ({ ...e, key: String(i) }))" row-key="key">
          <template #cell-status="{ row }"><span class="az-status"><AzIcon :name="row.status === 'compliant' ? 'ok' : 'error'" :size="14" /> {{ cap(row.status) }}</span></template>
          <template #empty>Nothing evaluated yet. Assign a policy, then Trigger scan.</template>
        </AzTable>
      </template>

      <!-- Definitions -->
      <template v-else-if="tab === 'definitions'">
        <div class="az-filters"><input v-model="needle" class="az-filter" placeholder="Search by name or ID" />
          <span class="az-pill">Definition type : <b>All definition types</b></span><span class="az-pill">Type : <b>Built-in</b></span></div>
        <AzTable :columns="defCols" :rows="defs" row-key="name">
          <template #cell-display="{ row }"><button type="button" class="az-link" @click="openAssign(row.name)">{{ row.display }}</button></template>
          <template #cell-assign="{ row }"><button type="button" class="az-link" @click="openAssign(row.name)">Assign</button></template>
        </AzTable>
      </template>

      <!-- Assignments -->
      <template v-else-if="tab === 'assignments'">
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="openAssign('')"><AzIcon name="plus" /> Assign policy</button>
          <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
        </div>
        <AzTable :columns="[...assignCols, { key: 'actions', label: '', sortable: false }]" :rows="assignments" row-key="name">
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="removeAssignment(row)">Delete assignment</button></template>
          <template #empty>No policy assignments.</template>
        </AzTable>
      </template>

      <!-- Exemptions -->
      <template v-else-if="tab === 'exemptions'">
        <div class="az-cmdbar"><button type="button" class="az-cmd" @click="openExemption"><AzIcon name="plus" /> Create exemption</button></div>
        <AzTable :columns="exCols" :rows="exemptions" row-key="name">
          <template #cell-expires="{ row }"><span :class="{ 'az-warntext': row.expires === 'Never' }">{{ row.expires }}</span></template>
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="removeExemption(row)">Delete</button></template>
          <template #empty>No exemptions.</template>
        </AzTable>
      </template>
    </div>

    <AzPane v-if="assigning" title="Assign policy" :subtitle="defMeta?.display" :error="error" @close="assigning = false">
      <div class="az-tabs"><button type="button" class="az-tab is-active">Basics</button><button type="button" class="az-tab" disabled>Parameters</button>
        <button type="button" class="az-tab" disabled>Remediation</button><button type="button" class="az-tab" disabled>Review + create</button></div>
      <div class="az-field"><div class="az-field__label">Scope <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="form.scope" class="az-select">
          <option v-for="s in scopes" :key="s.value" :value="s.value">{{ s.label }}</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Policy definition <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="form.policy" class="az-select">
          <option value="">Select a policy definition</option>
          <option v-for="d in definitions" :key="d.name" :value="d.name">{{ d.display }}</option></select>
          <div v-if="defMeta" class="az-help">{{ defMeta.note }}</div></div></div>
      <div class="az-field"><div class="az-field__label">Assignment name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="form.name" class="az-input" /></div></div>
      <div class="az-field"><div class="az-field__label">Policy effect</div>
        <div class="az-field__ctl"><select v-model="form.effect" class="az-select">
          <option v-for="e in ['Deny', 'Audit', 'DeployIfNotExists', 'Modify', 'Disabled']" :key="e" :value="e">{{ e }}</option></select></div></div>
      <template v-if="form.policy === 'allowed-locations'">
        <h3 class="az-group-title">Parameters</h3>
        <div class="az-field"><div class="az-field__label">Allowed locations <span class="az-req">*</span></div>
          <div class="az-field__ctl az-pol__locs">
            <label v-for="l in locations" :key="l" class="az-check"><input v-model="form.locs" type="checkbox" :value="l" /> {{ locName(l) }}</label></div></div>
      </template>
      <h3 class="az-group-title">Remediation</h3>
      <label class="az-check"><input v-model="form.identity" type="checkbox" /> Create a Managed Identity (system assigned)</label>
      <div v-if="['DeployIfNotExists', 'Modify'].includes(form.effect) && !form.identity" class="az-banner is-warning" style="margin-top: 8px">
        <AzIcon name="warning" /><span>Policies with the deployIfNotExists and modify effect types need a managed identity to remediate. Without one this assignment reports and remediates nothing.</span></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!form.policy || !form.name || (form.policy === 'allowed-locations' && !form.locs.length)" @click="assign">Review + create</button>
        <button type="button" class="az-btn" @click="assigning = false">Cancel</button>
      </template>
    </AzPane>

    <AzPane v-if="exempting" title="Create exemption" :error="error" @close="exempting = false">
      <div class="az-field"><div class="az-field__label">Policy assignment <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="ex.assignment" class="az-select"><option value="">Select</option>
          <option v-for="a in assignments" :key="a.name" :value="a.name">{{ a.name }}</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Exemption scope <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="ex.scope" class="az-select">
          <option v-for="s in scopes" :key="s.value" :value="s.value">{{ s.label }}</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Exemption name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="ex.name" class="az-input" /></div></div>
      <div class="az-field"><div class="az-field__label">Exemption category</div>
        <div class="az-radios"><label class="az-radio"><input v-model="ex.category" type="radio" value="Waiver" /> Waiver</label>
          <label class="az-radio"><input v-model="ex.category" type="radio" value="Mitigated" /> Mitigated</label></div></div>
      <div class="az-field"><div class="az-field__label">Expiration date</div>
        <div class="az-field__ctl"><input v-model="ex.expires" class="az-input" type="date" />
          <div v-if="!ex.expires" class="az-help">An exemption with no expiry is a policy quietly switched off for that scope.</div></div></div>
      <div class="az-field"><div class="az-field__label">Exemption description</div>
        <div class="az-field__ctl"><textarea v-model="ex.description" class="az-textarea"></textarea></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!ex.assignment || !ex.name" @click="exempt">Create</button>
        <button type="button" class="az-btn" @click="exempting = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** Azure Policy: compliance, definitions, assignments and exemptions. */
import { computed, reactive, ref, watch } from 'vue';
import { cli, errorText, matches, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import { locName, scopeLabel, useAz } from './azure';

const props = defineProps<{ tab: string; preset?: Record<string, any> }>();
const emit = defineEmits<{ (event: 'tab', tab: string): void }>();
const az = useAz();
const MENU = [
  { key: 'overview', label: 'Overview', icon: 'policy' }, { key: 'compliance', label: 'Compliance', icon: 'ok' },
  { key: 'g', label: 'Authoring', group: true },
  { key: 'definitions', label: 'Definitions', icon: 'props' }, { key: 'assignments', label: 'Assignments', icon: 'policy' },
  { key: 'exemptions', label: 'Exemptions', icon: 'lock' },
];
function cap(s: string) { return String(s || '').replace(/^./, c => c.toUpperCase()); }
const evals = computed(() => rows(az.v.value, 'compliance'));
const compliantCount = computed(() => evals.value.filter(e => e.status === 'compliant').length);
const overall = computed(() => (evals.value.length ? `${Math.round(100 * compliantCount.value / evals.value.length)}%` : '—'));
const assignments = computed(() => rows(az.v.value, 'policy_assignments').map((a): Record<string, any> => ({ ...a, actions: '',
  identityText: a.identity ? 'System assigned' : 'None' })));
const assignCols = [{ key: 'name', label: 'Name' }, { key: 'display', label: 'Definition' }, { key: 'effect', label: 'Effect' },
                    { key: 'scope', label: 'Scope' }, { key: 'identityText', label: 'Managed identity' },
                    { key: 'compliance', label: 'Compliance' }, { key: 'status', label: 'Compliance state' }];
const evalCols = [{ key: 'resource', label: 'Resource' }, { key: 'kind', label: 'Type' }, { key: 'assignment', label: 'Assignment' },
                  { key: 'effect', label: 'Effect' }, { key: 'status', label: 'Compliance state' }, { key: 'reason', label: 'Reason' }];
const output = ref('');
async function scan() {
  const r = await az.run(cli(['az', 'policy', 'state', 'trigger-scan']), 'Policy compliance scan complete');
  output.value = r.ok ? String(r.output || '').trim() : '';
}
async function summarize() {
  const r = await az.run(cli(['az', 'policy', 'state', 'summarize']), '', { quiet: true });
  output.value = String(r.ok ? r.output : r.error || '').trim();
}

const definitions = computed(() => rows(az.p.value, 'policy_definitions'));
const needle = ref('');
const defs = computed(() => definitions.value.map((d): Record<string, any> => ({ ...d, type: 'Built-in', definitionType: 'Policy', assign: '' }))
  .filter(d => matches(d, needle.value, ['display', 'name', 'category'])));
const defCols = [{ key: 'display', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'definitionType', label: 'Definition type' },
                 { key: 'category', label: 'Category' }, { key: 'effect', label: 'Effect' }, { key: 'assign', label: '', sortable: false }];
let listed = false;
watch(() => props.tab, t => {
  if (t === 'definitions' && !listed) { listed = true; void az.run(cli(['az', 'policy', 'definition', 'list']), '', { quiet: true }); }
}, { immediate: true });

const locations = computed<string[]>(() => az.p.value.catalogue?.locations || []);
const scopes = computed(() => {
  const p = az.p.value;
  const out = rows(p, 'mgmt_groups').map(m => ({ value: `/providers/Microsoft.Management/managementGroups/${m.name}`,
                                                label: `${m.display} (Management group)` }));
  out.push({ value: `/subscriptions/${p.account?.subscription}`, label: `${p.account?.subscription_name} (Subscription)` });
  for (const g of rows(p, 'groups')) out.push({ value: String(g.id), label: `${g.name} (Resource group)` });
  return out;
});
const assigning = ref(false);
const error = ref('');
const form = reactive({ scope: '', policy: '', name: '', effect: 'Audit', identity: false, locs: [] as string[] });
const defMeta = computed(() => definitions.value.find(d => d.name === form.policy) || null);
watch(() => form.policy, v => {
  const d = definitions.value.find(x => x.name === v);
  if (d) { form.effect = d.effect; if (!form.name || definitions.value.some(x => x.name === form.name)) form.name = d.name; }
});
function openAssign(policy: string) {
  const presetScope = props.preset?.scope ? String(props.preset.scope) : '';
  const scope = presetScope.startsWith('rg:')
    ? scopes.value.find(s => s.value.endsWith(`/resourceGroups/${presetScope.slice(3)}`))?.value
    : undefined;
  Object.assign(form, { scope: scope || scopes.value.find(s => s.label.endsWith('(Subscription)'))?.value || '', policy: '', name: '',
                        effect: 'Audit', identity: false, locs: ['uaenorth', 'westeurope'] });
  form.policy = policy;
  error.value = '';
  assigning.value = true;
}
async function assign() {
  const result = await az.run(cli(['az', 'policy', 'assignment', 'create'], {
    '--name': form.name, '--policy': form.policy, '--scope': form.scope,
    '--effect': defMeta.value && form.effect !== defMeta.value.effect ? form.effect : '',
    '--params': form.policy === 'allowed-locations' ? form.locs.join(' ') : '',
    '--mi-system-assigned': form.identity }), `Creating policy assignment '${form.name}' succeeded`, { quiet: true });
  if (!result.ok) { error.value = errorText(result); return; }
  assigning.value = false;
  emit('tab', 'assignments');
}
async function removeAssignment(row: Record<string, any>) {
  if (!(await az.confirm({ title: 'Delete assignment', message: `Are you sure you want to delete the assignment '${row.name}'? Resources stop being evaluated against it.`, confirmLabel: 'Yes', danger: true }))) return;
  await az.run(cli(['az', 'policy', 'assignment', 'delete'], { '--name': row.name }), `Deleted policy assignment '${row.name}'`);
}

const exemptions = computed(() => rows(az.p.value, 'policy_exemptions').map(x => ({ name: x.name, assignment: x.assignment,
  scope: scopeLabel(String(x.scope)), category: x.category, expires: x.expires || 'Never', reason: x.reason || '', actions: '' })));
const exCols = [{ key: 'name', label: 'Name' }, { key: 'assignment', label: 'Assignment' }, { key: 'scope', label: 'Scope' },
                { key: 'category', label: 'Category' }, { key: 'expires', label: 'Expires' }, { key: 'reason', label: 'Description' },
                { key: 'actions', label: '', sortable: false }];
const exempting = ref(false);
const ex = reactive({ assignment: '', scope: '', name: '', category: 'Waiver', expires: '', description: '' });
function openExemption() {
  Object.assign(ex, { assignment: assignments.value[0]?.name || '', scope: scopes.value[scopes.value.length - 1]?.value || '',
                      name: '', category: 'Waiver', expires: '', description: '' });
  error.value = '';
  exempting.value = true;
}
async function exempt() {
  const result = await az.run(cli(['az', 'policy', 'exemption', 'create'], { '--name': ex.name, '--policy-assignment': ex.assignment,
    '--scope': ex.scope, '--exemption-category': ex.category, '--expires-on': ex.expires ? `${ex.expires}T00:00:00Z` : '',
    '--description': ex.description }), `Created exemption '${ex.name}'`, { quiet: true });
  if (!result.ok) { error.value = errorText(result); return; }
  exempting.value = false;
}
async function removeExemption(row: Record<string, any>) {
  if (!(await az.confirm({ title: 'Delete exemption', message: `Delete exemption '${row.name}'? The assignment applies to that scope again.`, confirmLabel: 'Yes', danger: true }))) return;
  await az.run(cli(['az', 'policy', 'exemption', 'delete'], { '--name': row.name }), `Deleted exemption '${row.name}'`);
}
</script>

<style scoped>
.az-pol__kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px; }
.az-big { font-size: 32px; font-weight: 600; margin: 4px 0; }
.az-pol__locs { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 4px; padding-top: 6px; }
.az-warntext { color: #bc4b09; font-weight: 600; }
</style>
