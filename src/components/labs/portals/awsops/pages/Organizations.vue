<template>
  <!-- AWS accounts: the hierarchy -->
  <div v-if="page === 'accounts'">
    <CsHeader title="AWS accounts" :description="`Organization ID: ${org.id} | Management account: ${org.mgmt}`">
      <template #actions>
        <CsDropdown :items="treeActions" :disabled="!picked" @select="treeAct" />
        <button type="button" class="cs-btn cs-btn--primary" disabled title="Accounts are vended through Control Tower Account Factory">Add an AWS account</button>
      </template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Organizational structure" :level="2" :info="false" /></div>
      <div class="cs-container__body og__tree">
        <div v-for="node in tree" :key="node.id" class="og__row" :class="{ 'is-picked': picked === node.id }" :style="{ paddingLeft: 12 + node.depth * 24 + 'px' }">
          <input type="radio" name="og-node" :checked="picked === node.id" :aria-label="'Select ' + node.name" @change="picked = node.id" />
          <CsIcon :name="node.kind === 'account' ? 'user' : 'folder'" class="og__icon" />
          <span class="og__name">{{ node.name }}</span>
          <span class="cs-mono og__id">{{ node.id }}</span>
          <span v-if="node.kind === 'account' && node.enrolled" class="cs-badge cs-badge--grey">Enrolled</span>
          <span v-if="node.kind === 'ou' && node.governed" class="cs-badge cs-badge--grey">Registered</span>
          <span class="og__scps">{{ scpNames(node.id) }}</span>
        </div>
      </div>
    </section>
    <section v-if="pickedNode" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="pickedNode.name" :level="2" :info="false" :description="pickedNode.id" /></div>
      <div class="cs-container__body cs-stack">
        <table class="cs-table-mini"><thead><tr><th>Attached service control policies</th><th>Type</th><th /></tr></thead>
          <tbody><tr v-for="p in attachedTo(pickedNode.id)" :key="p.id"><td><a href="#" class="cs-link" @click.prevent="ctx.to('organizations', 'policy', { id: p.id, name: p.name })">{{ p.name }}</a></td>
            <td>{{ p.aws_managed ? 'AWS managed policy' : 'Customer managed policy' }}</td>
            <td><button type="button" class="cs-btn" :disabled="busy" @click="detach(p.id, pickedNode.id)">Detach</button></td></tr></tbody></table>
        <div class="cs-row"><select v-model="attachId" class="cs-select og__attach"><option value="">Choose a policy to attach</option>
          <option v-for="p in policies.filter(x => !x.targets.includes(pickedNode?.id))" :key="p.id" :value="p.id">{{ p.name }}</option></select>
          <button type="button" class="cs-btn" :disabled="!attachId || busy" @click="attach(attachId, pickedNode.id)">Attach</button></div>
      </div>
    </section>
  </div>

  <!-- SCPs -->
  <div v-else-if="page === 'policies'">
    <CsTable variant="full-page" title="Service control policies" :items="policies" :columns="polCols" track-by="id" selection-type="single" v-model:selected="sel"
             description="Service control policies (SCPs) enable central administration over the permissions available within the accounts in your organization.">
      <template #actions>
        <CsDropdown :items="[{ id: 'delete', text: 'Delete policy', disabled: selectedPolicy?.aws_managed }]" :disabled="!sel.length" @select="deleting = sel[0]" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('organizations', 'policy-create')">Create policy</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('organizations', 'policy', { id: row.id, name: row.name })">{{ row.name }}</a></template>
    </CsTable>
  </div>

  <!-- Create / edit SCP -->
  <div v-else-if="page === 'policy-create' || (page === 'policy' && editing)">
    <CsHeader :title="page === 'policy-create' ? 'Create new service control policy' : `Edit ${policy?.name}`" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Details" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Policy name</label><input v-model="form.name" class="cs-input" maxlength="128" /></div>
        <div class="cs-field"><label class="cs-label">Policy description <small>- optional</small></label><input v-model="form.description" class="cs-input" /></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Policy" :level="2" /></div>
      <div class="cs-container__body"><textarea v-model="form.doc" class="cs-textarea cs-mono og__json" spellcheck="false" />
        <span v-if="docProblem" class="cs-error-text">{{ docProblem }}</span>
        <span v-else class="cs-constraint">{{ size }} of 5,120 characters</span></div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="page === 'policy-create' ? ctx.to('organizations', 'policies') : (editing = false)">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !form.name.trim() || !!docProblem" @click="savePolicy">
        <span v-if="busy" class="cs-btn__spinner" />{{ page === 'policy-create' ? 'Create policy' : 'Save changes' }}</button>
    </div>
  </div>

  <!-- One SCP -->
  <div v-else-if="policy">
    <CsHeader :title="policy.name" :description="policy.description">
      <template #actions>
        <button v-if="!policy.aws_managed" type="button" class="cs-btn" @click="deleting = policy.id">Delete</button>
        <button v-if="!policy.aws_managed" type="button" class="cs-btn cs-btn--primary" @click="startEdit">Edit policy</button>
      </template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Policy details" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Policy ID</dt><dd class="cs-mono">{{ policy.id }}</dd></div><div><dt>Type</dt><dd>{{ policy.aws_managed ? 'AWS managed policy' : 'Customer managed policy' }}</dd></div>
      </dl></div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in ['Content', 'Targets']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <section v-if="tab === 'Content'" class="cs-container"><div class="cs-container__body"><pre class="cs-code">{{ pretty(policy.content) }}</pre></div></section>
    <CsTable v-else title="Targets" :items="targets" :columns="targetCols" track-by="id" selection-type="single" v-model:selected="targetSel">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!targetSel.length || busy" @click="detach(policy.id, targetSel[0])">Detach</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="attaching = true">Attach</button>
      </template>
    </CsTable>
  </div>
  <NotFound v-else what="Policy" :id="ctx.route.value.params?.name || ''" back="policies" />

  <CsModal v-if="attaching && policy" title="Attach the service control policy" @close="attaching = false">
    <div class="cs-field"><label class="cs-label">Target</label>
      <select v-model="attachTarget" class="cs-select"><option v-for="n in tree.filter(n => !policy.targets.includes(n.id))" :key="n.id" :value="n.id">{{ ' '.repeat(n.depth * 2) }}{{ n.name }} ({{ n.id }})</option></select></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="attaching = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !attachTarget" @click="attach(policy.id, attachTarget).then(() => (attaching = false))">Attach policy</button>
    </template>
  </CsModal>

  <CsModal v-if="ouModal" :title="ouModal.mode === 'create' ? 'Create organizational unit' : 'Rename organizational unit'" @close="ouModal = null">
    <div class="cs-stack">
      <p v-if="ouModal.mode === 'create'" class="cs-muted og__p">Parent: {{ nodeName(ouModal.parent) }}</p>
      <div class="cs-field"><label class="cs-label">Organizational unit name</label><input v-model="ouModal.name" class="cs-input" maxlength="128" /></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="ouModal = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !ouModal.name.trim()" @click="saveOu">{{ ouModal.mode === 'create' ? 'Create organizational unit' : 'Save' }}</button>
    </template>
  </CsModal>

  <CsModal v-if="moving" title="Move AWS account" @close="moving = null">
    <div class="cs-stack">
      <p class="og__p">Move <strong>{{ moving.name }}</strong> ({{ moving.id }}) from {{ nodeName(moving.parent) }} to:</p>
      <div class="cs-field"><select v-model="moveTo" class="cs-select"><option :value="org.root">Root</option>
        <option v-for="o in ous" :key="o.id" :value="o.id">{{ o.name }} ({{ o.id }})</option></select></div>
      <div v-if="moving.enrolled && !governedIds.includes(moveTo)" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
        <div>This account is enrolled in AWS Control Tower. Moving it outside Control Tower to an OU that is not registered causes drift: its controls stop applying.</div></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="moving = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || moveTo === moving.parent" @click="move">Move AWS account</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete policy" :word="policyName(deleting)" :busy="busy" @close="deleting = ''" @confirm="removePolicy">
    <p class="og__p">A policy that is attached to any root, OU or account cannot be deleted. Detach it from all targets first.</p>
  </CsDelete>
  <CsDelete v-if="ouDeleting" title="Delete organizational unit" :word="ouDeleting.name" :busy="busy" @close="ouDeleting = null" @confirm="removeOu">
    <p class="og__p">An OU that contains accounts or other OUs cannot be deleted.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import { parseJson as parseDoc, pretty } from '../kit';
import NotFound from './NotFound.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const org = computed<any>(() => pick(ctx.c.value, 'org', { id: '', root: 'r', mgmt: '' }));
const ous = computed(() => rows<any>(ctx.c.value, 'org.ous'));
const accounts = computed(() => rows<any>(ctx.c.value, 'org.accounts'));
const policies = computed(() => rows<any>(ctx.c.value, 'org.policies').filter(p => p.type === 'SERVICE_CONTROL_POLICY'));
const governedIds = computed(() => rows<any>(ctx.c.value, 'org.ous').filter(o => o.governed).map(o => o.id));
const sel = ref<string[]>([]);
const targetSel = ref<string[]>([]);
const picked = ref('');
const attachId = ref('');
const tab = ref('Content');
const busy = ref(false);
const editing = ref(false);
const attaching = ref(false);
const attachTarget = ref('');
const deleting = ref('');
const ouModal = ref<any>(null);
const ouDeleting = ref<any>(null);
const moving = ref<any>(null);
const moveTo = ref('');

interface Node { id: string; name: string; kind: 'root' | 'ou' | 'account'; depth: number; parent: string; governed?: boolean; enrolled?: boolean }
const tree = computed<Node[]>(() => {
  const out: Node[] = [{ id: org.value.root, name: 'Root', kind: 'root', depth: 0, parent: '' }];
  const walk = (parent: string, depth: number) => {
    for (const ou of ous.value.filter(o => o.parent === parent).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ id: ou.id, name: ou.name, kind: 'ou', depth, parent, governed: ou.governed });
      walk(ou.id, depth + 1);
    }
    for (const a of accounts.value.filter(x => x.parent === parent)) {
      out.push({ id: a.id, name: a.name, kind: 'account', depth, parent, enrolled: a.enrolled });
    }
  };
  walk(org.value.root, 1);
  return out;
});
const pickedNode = computed(() => tree.value.find(n => n.id === picked.value) || null);
const policy = computed<any>(() => policies.value.find(p => p.id === ctx.route.value.params?.id) || null);
const selectedPolicy = computed<any>(() => policies.value.find(p => p.id === sel.value[0]) || null);
const targets = computed(() => (policy.value?.targets || []).map((id: string) => {
  const n = tree.value.find(x => x.id === id);
  return { id, name: n?.name || id, type: n?.kind === 'account' ? 'Account' : n?.kind === 'root' ? 'Root' : 'Organizational unit' };
}));
function attachedTo(id: string) { return policies.value.filter(p => p.targets.includes(id)); }
function scpNames(id: string) { return attachedTo(id).map(p => p.name).join(', '); }
function nodeName(id: string) { return tree.value.find(n => n.id === id)?.name || id; }
function policyName(id: string) { return policies.value.find(p => p.id === id)?.name || id; }

const treeActions = computed(() => {
  const n = pickedNode.value;
  return [
    { id: 'g-ou', text: 'Organizational unit', group: true },
    { id: 'create', text: 'Create new', nested: true, disabled: !n || n.kind === 'account' },
    { id: 'rename', text: 'Rename', nested: true, disabled: n?.kind !== 'ou' },
    { id: 'delete', text: 'Delete', nested: true, disabled: n?.kind !== 'ou' },
    { id: 'g-acct', text: 'AWS account', group: true },
    { id: 'move', text: 'Move', nested: true, disabled: n?.kind !== 'account' },
  ];
});
function treeAct(action: string) {
  const n = pickedNode.value;
  if (!n) return;
  if (action === 'create') ouModal.value = { mode: 'create', parent: n.id, name: '' };
  if (action === 'rename') ouModal.value = { mode: 'rename', id: n.id, name: n.name };
  if (action === 'delete') ouDeleting.value = n;
  if (action === 'move') { moving.value = accounts.value.find(a => a.id === n.id); moveTo.value = moving.value?.parent || ''; }
}
const polCols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'kind', header: 'Kind', cell: (p: any) => (p.aws_managed ? 'AWS managed policy' : 'Customer managed policy') },
  { id: 'description', header: 'Description' }, { id: 'targets', header: 'Targets', cell: (p: any) => p.targets.length }];
const targetCols = [{ id: 'name', header: 'Name' }, { id: 'id', header: 'ID' }, { id: 'type', header: 'Type' }];

const form = reactive({ name: '', description: '', doc: '' });
const docProblem = computed(() => parseDoc(form.doc)[1]);
const size = computed(() => { try { return JSON.stringify(JSON.parse(form.doc)).length; } catch { return 0; } });
if (page.value === 'policy-create') {
  form.doc = pretty({ Version: '2012-10-17', Statement: [{ Sid: 'Statement1', Effect: 'Deny', Action: [], Resource: ['*'] }] });
}
function startEdit() {
  Object.assign(form, { name: policy.value.name, description: policy.value.description, doc: pretty(policy.value.content) });
  editing.value = true;
}
async function savePolicy() {
  busy.value = true;
  const content = JSON.stringify(JSON.parse(form.doc));
  const result = page.value === 'policy-create'
    ? await ctx.run(cli(['aws', 'organizations', 'create-policy'], { '--name': form.name.trim(), '--type': 'SERVICE_CONTROL_POLICY',
      '--description': form.description.trim(), '--content': content }), `Successfully created policy ${form.name}.`)
    : await ctx.run(cli(['aws', 'organizations', 'update-policy'], { '--policy-id': policy.value.id,
      '--name': form.name.trim() !== policy.value.name ? form.name.trim() : '', '--description': form.description.trim() !== policy.value.description ? form.description.trim() : '',
      '--content': content }), `Successfully updated policy ${form.name}.`);
  busy.value = false;
  if (result.ok) { if (page.value === 'policy-create') ctx.to('organizations', 'policies'); else editing.value = false; }
}
async function attach(policyId: string, target: string) {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'organizations', 'attach-policy'], { '--policy-id': policyId, '--target-id': target }),
    `Successfully attached ${policyName(policyId)} to ${nodeName(target)}.`);
  busy.value = false;
  if (result.ok) attachId.value = '';
}
async function detach(policyId: string, target: string) {
  busy.value = true;
  await ctx.run(cli(['aws', 'organizations', 'detach-policy'], { '--policy-id': policyId, '--target-id': target }),
    `Successfully detached ${policyName(policyId)} from ${nodeName(target)}.`);
  busy.value = false;
  targetSel.value = [];
}
async function saveOu() {
  busy.value = true;
  const m = ouModal.value;
  const result = m.mode === 'create'
    ? await ctx.run(cli(['aws', 'organizations', 'create-organizational-unit'], { '--parent-id': m.parent, '--name': m.name.trim() }), `Organizational unit ${m.name} created.`)
    : await ctx.run(cli(['aws', 'organizations', 'update-organizational-unit'], { '--organizational-unit-id': m.id, '--name': m.name.trim() }), `Organizational unit renamed to ${m.name}.`);
  busy.value = false;
  if (result.ok) ouModal.value = null;
}
async function removeOu() {
  busy.value = true;
  const n = ouDeleting.value;
  const result = await ctx.run(cli(['aws', 'organizations', 'delete-organizational-unit'], { '--organizational-unit-id': n.id }), `Organizational unit ${n.name} deleted.`);
  busy.value = false;
  ouDeleting.value = null;
  if (result.ok) picked.value = '';
}
async function move() {
  busy.value = true;
  const a = moving.value;
  const result = await ctx.run(cli(['aws', 'organizations', 'move-account'], { '--account-id': a.id, '--source-parent-id': a.parent, '--destination-parent-id': moveTo.value }),
    `Successfully moved ${a.name} to ${nodeName(moveTo.value)}.`);
  busy.value = false;
  if (result.ok) moving.value = null;
}
async function removePolicy() {
  busy.value = true;
  const id = deleting.value;
  const result = await ctx.run(cli(['aws', 'organizations', 'delete-policy'], { '--policy-id': id }), `Policy ${policyName(id)} deleted.`);
  busy.value = false;
  deleting.value = '';
  if (result.ok && page.value === 'policy') ctx.to('organizations', 'policies');
}
</script>

<style scoped>
.og__tree { padding: 8px 0; }
.og__row { display: flex; align-items: center; gap: 10px; padding: 6px 20px; border-bottom: 1px solid #ebebf0; flex-wrap: wrap; }
.og__row.is-picked { background: #f0fbff; }
.og__row input { accent-color: #006ce0; }
.og__icon { color: #424650; }
.og__name { font-weight: 700; }
.og__id { color: #656871; }
.og__scps { margin-left: auto; color: #656871; font-size: 12px; }
.og__attach { max-width: 360px; }
.og__json { min-height: 320px; }
.og__p { margin: 0; }
</style>
