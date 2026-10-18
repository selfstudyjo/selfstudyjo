<template>
  <div v-if="page === 'patch'">
    <CsHeader title="Patch Manager" description="Automate the process of patching managed nodes with both security-related updates and other types of updates.">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="openPatchNow">Patch now</button></template>
    </CsHeader>
    <div class="cs-tabs">
      <button v-for="t in TABS" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>

    <template v-if="tab === 'Dashboard'">
      <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Windows servers</dt><dd class="sp__big">{{ windowsNodes.length }}</dd></div>
        <div><dt>Managed</dt><dd class="sp__big">{{ windowsNodes.filter(n => n.ping === 'Online').length }}</dd></div>
        <div><dt>Compliant</dt><dd class="sp__big sp__ok">{{ windowsNodes.filter(n => n.compliance === 'COMPLIANT').length }}</dd></div>
        <div><dt>Non-compliant</dt><dd class="sp__big sp__bad">{{ windowsNodes.filter(n => n.compliance === 'NON_COMPLIANT').length }}</dd></div>
        <div><dt>Never reported</dt><dd class="sp__big">{{ windowsNodes.filter(n => !n.compliance).length }}</dd></div>
      </dl></div></section>
    </template>

    <CsTable v-else-if="tab === 'Compliance reporting'" title="Node patching details" :items="windowsNodes" :columns="compCols" track-by="id">
      <template #cell-compliance="{ row }"><CsStatus v-if="row.compliance" :type="row.compliance === 'COMPLIANT' ? 'success' : 'error'" :label="row.compliance === 'COMPLIANT' ? 'Compliant' : 'Non-compliant'" /><span v-else class="cs-muted">Not reported</span></template>
    </CsTable>

    <CsTable v-else-if="tab === 'Patch baselines'" title="Patch baselines" :items="baselines" :columns="blCols" track-by="id" selection-type="single" v-model:selected="blSel">
      <template #actions>
        <CsDropdown :items="blActions" :disabled="!blSel.length" @select="blAct" />
        <button type="button" class="cs-btn cs-btn--primary" @click="openBaseline(null)">Create patch baseline</button>
      </template>
      <template #cell-default="{ row }">{{ row.default ? 'Yes' : 'No' }}</template>
    </CsTable>

    <CsTable v-else title="Patch groups" :items="groups" :columns="grpCols" track-by="group" selection-type="single" v-model:selected="grpSel"
             description="A patch group associates nodes (by their PatchGroup tag) with a patch baseline. A tag nobody registered falls back to the default baseline.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!grpSel.length || busy" @click="deregister">Deregister</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="registering = true">Register patch group</button>
      </template>
    </CsTable>
  </div>

  <CsModal v-if="patchNow" title="Patch now" size="large" @close="patchNow = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Patching operation</label>
        <label class="cs-radio"><input v-model="pn.operation" type="radio" value="Scan" /><span>Scan<small>Report missing patches. No reboot.</small></span></label>
        <label class="cs-radio"><input v-model="pn.operation" type="radio" value="Install" /><span>Scan and install<small>Install approved patches.</small></span></label></div>
      <div v-if="pn.operation === 'Install'" class="cs-field"><label class="cs-label">Reboot option</label>
        <select v-model="pn.reboot" class="cs-select"><option value="RebootIfNeeded">Reboot if needed</option><option value="NoReboot">Do not reboot my instances</option></select></div>
      <div class="cs-field"><label class="cs-label">Instances to patch - patch groups</label>
        <div class="sp__chips"><label v-for="g in tagGroups" :key="g" class="cs-check"><input v-model="pn.groups" type="checkbox" :value="g" />{{ g }}</label></div></div>
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Concurrency</label><input v-model="pn.concurrency" class="cs-input" /><span class="cs-constraint">Number (3) or percentage (25%) of targets at once.</span></div>
        <div class="cs-field"><label class="cs-label">Error threshold</label><input v-model="pn.errors" class="cs-input" /></div>
      </div>
      <div v-if="pn.operation === 'Install'" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
        <div>Installing with a reboot takes nodes out of service. Patching both members of a clustered pair at once (two domain controllers, both SQL replicas) is an outage.</div></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="patchNow = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !pn.groups.length" @click="doPatch">Patch now</button>
    </template>
  </CsModal>

  <CsModal v-if="baselineForm" :title="baselineForm.id ? `Edit ${baselineForm.name}` : 'Create patch baseline'" size="large" @close="baselineForm = null">
    <div class="cs-stack">
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Name</label><input v-model="baselineForm.name" class="cs-input" :disabled="!!baselineForm.id" /></div>
        <div class="cs-field"><label class="cs-label">Operating system</label><select v-model="baselineForm.os" class="cs-select" :disabled="!!baselineForm.id"><option value="WINDOWS">Windows</option><option value="AMAZON_LINUX_2023">Amazon Linux 2023</option></select></div>
      </div>
      <h3 class="sp__h">Approval rules for operating systems</h3>
      <div v-for="(rule, i) in baselineForm.rules" :key="i" class="sp__rule">
        <div class="cs-field"><label class="cs-label">Classification</label>
          <div class="sp__chips"><label v-for="c in CLASSES" :key="c" class="cs-check"><input v-model="rule.classifications" type="checkbox" :value="c" />{{ c }}</label></div></div>
        <div class="cs-field"><label class="cs-label">Severity</label>
          <div class="sp__chips"><label v-for="s in SEVERITIES" :key="s" class="cs-check"><input v-model="rule.severities" type="checkbox" :value="s" />{{ s }}</label></div></div>
        <div class="cs-row"><div class="cs-field"><label class="cs-label">Auto-approval delay (days)</label><input v-model="rule.after" class="cs-input sp__narrow" inputmode="numeric" /></div>
          <button type="button" class="cs-btn" @click="baselineForm.rules.splice(i, 1)">Remove rule</button></div>
      </div>
      <div class="cs-row"><button type="button" class="cs-btn" @click="baselineForm.rules.push({ classifications: ['CriticalUpdates', 'SecurityUpdates'], severities: ['Critical', 'Important'], after: '7' })">Add rule</button></div>
      <div class="cs-field"><label class="cs-label">Rejected patches <small>- optional</small></label><input v-model="baselineForm.rejected" class="cs-input" placeholder="KB5005112, KB5008212" /></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="baselineForm = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !baselineForm.name.trim() || !baselineForm.rules.length" @click="saveBaseline">{{ baselineForm.id ? 'Save changes' : 'Create patch baseline' }}</button>
    </template>
  </CsModal>

  <CsModal v-if="registering" title="Register patch group" @close="registering = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Patch group</label><input v-model="reg.group" class="cs-input" list="sp-groups" placeholder="prod-web" />
        <datalist id="sp-groups"><option v-for="g in tagGroups" :key="g" :value="g" /></datalist></div>
      <div class="cs-field"><label class="cs-label">Patch baseline</label><select v-model="reg.baseline" class="cs-select"><option v-for="b in baselines" :key="b.id" :value="b.id">{{ b.name }}</option></select></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="registering = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !reg.group.trim() || !reg.baseline" @click="register">Register</button>
    </template>
  </CsModal>

  <CsDelete v-if="deletingBaseline" title="Delete patch baseline" :word="deletingBaseline.name" :busy="busy" @close="deletingBaseline = null" @confirm="removeBaseline">
    <p class="sp__p">A baseline registered with a patch group cannot be deleted. Deregister its patch groups first.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const TABS = ['Dashboard', 'Compliance reporting', 'Patch baselines', 'Patch groups'];
const CLASSES = ['CriticalUpdates', 'SecurityUpdates', 'Updates', 'UpdateRollups', 'ServicePacks', 'DefinitionUpdates'];
const SEVERITIES = ['Critical', 'Important', 'Moderate', 'Low', 'Unspecified'];

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const tab = ref('Dashboard');
const blSel = ref<string[]>([]);
const grpSel = ref<string[]>([]);
const busy = ref(false);
const patchNow = ref(false);
const baselineForm = ref<any>(null);
const registering = ref(false);
const deletingBaseline = ref<any>(null);

const nodes = computed(() => rows<any>(ctx.c.value, 'ssm.nodes'));
const windowsNodes = computed(() => nodes.value.filter(n => n.platform === 'Windows' && n.ping !== 'Inactive'));
const baselines = computed(() => rows<any>(ctx.c.value, 'ssm.baselines').map(b => ({ ...b, rulesText: b.rules.map((r: any) => `${r.classifications.join('/')} ${r.severities.join('/')} after ${r.after}d`).join('; '),
  groupsText: b.groups.join(', ') || '-', osText: b.os === 'WINDOWS' ? 'Windows' : 'Amazon Linux 2023' })));
const groups = computed(() => Object.entries((ctx.c.value as any)?.ssm?.patch_groups || {}).map(([group, id]) => ({
  group, baseline: baselines.value.find(b => b.id === id)?.name || String(id), nodes: nodes.value.filter(n => n.patch_group === group).length })));
const tagGroups = computed(() => Array.from(new Set(nodes.value.map(n => n.patch_group).filter(Boolean))).sort());

const compCols = [{ id: 'name', header: 'Node name', sortKey: 'name' }, { id: 'id', header: 'Node ID' }, { id: 'patch_group', header: 'Patch group' },
  { id: 'baseline', header: 'Baseline' }, { id: 'compliance', header: 'Compliance status' }, { id: 'missing', header: 'Missing (approved)' },
  { id: 'pending_reboot', header: 'Installed pending reboot' }, { id: 'last_scan', header: 'Last operation', cell: (n: any) => n.last_scan || '-' }];
const blCols = [{ id: 'name', header: 'Baseline name', sortKey: 'name' }, { id: 'id', header: 'Baseline ID' }, { id: 'osText', header: 'Operating system' },
  { id: 'default', header: 'Default baseline' }, { id: 'rulesText', header: 'Approval rules' }, { id: 'groupsText', header: 'Patch groups' }];
const grpCols = [{ id: 'group', header: 'Patch group' }, { id: 'baseline', header: 'Patch baseline' }, { id: 'nodes', header: 'Nodes tagged' }];
const blActions = computed(() => {
  const b = baselines.value.find(x => x.id === blSel.value[0]);
  return [{ id: 'edit', text: 'Edit', disabled: !b || b.aws }, { id: 'delete', text: 'Delete', disabled: !b || b.aws }];
});

const pn = reactive({ operation: 'Scan', reboot: 'RebootIfNeeded', groups: [] as string[], concurrency: '10%', errors: '1' });
function openPatchNow() { pn.groups = []; patchNow.value = true; }
async function doPatch() {
  busy.value = true;
  const params = pn.operation === 'Install' ? `Operation=Install,RebootOption=${pn.reboot}` : 'Operation=Scan';
  const result = await ctx.run(cli(['aws', 'ssm', 'send-command'], {
    '--document-name': 'AWS-RunPatchBaseline', '--targets': `Key=tag:PatchGroup,Values=${pn.groups.join(',')}`,
    '--parameters': params, '--max-concurrency': pn.concurrency.trim(), '--max-errors': pn.errors.trim(),
  }), 'Patch operation started. Track it in Run Command; it progresses as the scenario clock moves.');
  busy.value = false;
  if (result.ok) patchNow.value = false;
}
function openBaseline(b: any) {
  baselineForm.value = b ? { id: b.id, name: b.name, os: b.os, rules: b.rules.map((r: any) => ({ ...r, classifications: [...r.classifications], severities: [...r.severities], after: String(r.after) })), rejected: b.rejected.join(', ') }
    : { id: '', name: '', os: 'WINDOWS', rules: [{ classifications: ['CriticalUpdates', 'SecurityUpdates'], severities: ['Critical', 'Important'], after: '7' }], rejected: '' };
}
function blAct(action: string) {
  const b = baselines.value.find(x => x.id === blSel.value[0]);
  if (!b) return;
  if (action === 'edit') openBaseline(b);
  if (action === 'delete') deletingBaseline.value = b;
}
async function saveBaseline() {
  const f = baselineForm.value;
  const rules = JSON.stringify({ PatchRules: f.rules.map((r: any) => ({ PatchFilterGroup: { PatchFilters: [
    { Key: 'CLASSIFICATION', Values: r.classifications }, { Key: 'MSRC_SEVERITY', Values: r.severities }] }, ApproveAfterDays: Number(r.after) || 0 })) });
  const rejected = f.rejected.split(/[,\s]+/).filter(Boolean);
  busy.value = true;
  const result = f.id
    ? await ctx.run(cli(['aws', 'ssm', 'update-patch-baseline'], { '--baseline-id': f.id, '--approval-rules': rules, '--rejected-patches': rejected }), `Patch baseline ${f.name} updated.`)
    : await ctx.run(cli(['aws', 'ssm', 'create-patch-baseline'], { '--name': f.name.trim(), '--operating-system': f.os, '--approval-rules': rules, '--rejected-patches': rejected }), `Patch baseline ${f.name} created.`);
  busy.value = false;
  if (result.ok) baselineForm.value = null;
}
async function removeBaseline() {
  busy.value = true;
  const b = deletingBaseline.value;
  await ctx.run(cli(['aws', 'ssm', 'delete-patch-baseline'], { '--baseline-id': b.id }), `Patch baseline ${b.name} deleted.`);
  busy.value = false;
  deletingBaseline.value = null;
}
const reg = reactive({ group: '', baseline: '' });
async function register() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ssm', 'register-patch-baseline-for-patch-group'], { '--baseline-id': reg.baseline, '--patch-group': reg.group.trim() }),
    `Patch group ${reg.group} registered.`);
  busy.value = false;
  if (result.ok) { registering.value = false; reg.group = ''; }
}
async function deregister() {
  const g = groups.value.find(x => x.group === grpSel.value[0]);
  if (!g) return;
  busy.value = true;
  await ctx.run(cli(['aws', 'ssm', 'deregister-patch-baseline-for-patch-group'], { '--baseline-id': g.baseline, '--patch-group': g.group }), `Patch group ${g.group} deregistered.`);
  busy.value = false;
  grpSel.value = [];
}
</script>

<style scoped>
.sp__big { font-size: 28px; line-height: 34px; font-weight: 300; color: #006ce0; }
.sp__ok { color: #00802f; }
.sp__bad { color: #db0000; }
.sp__h { margin: 4px 0 0; font-size: 16px; }
.sp__rule { border: 1px solid #ebebf0; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.sp__chips { display: flex; flex-wrap: wrap; gap: 6px 16px; }
.sp__narrow { width: 120px; }
.sp__p { margin: 0; }
</style>
