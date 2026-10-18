<template>
  <!-- AWS accounts -->
  <div v-if="page === 'accounts'">
    <CsHeader title="AWS accounts" description="Assign users or groups access to AWS accounts in your organization with a permission set." />
    <CsTable title="Organizational structure" :items="accounts" :columns="acctCols" track-by="id" selection-type="multi" v-model:selected="sel">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" :disabled="!sel.length" @click="openAssign">Assign users or groups</button></template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('sso', 'account', { id: row.id, name: row.name })">{{ row.name }}</a></template>
    </CsTable>
  </div>

  <!-- One account -->
  <div v-else-if="page === 'account' && account">
    <CsHeader :title="account.name" :description="`${account.id} | ${account.email}`" />
    <CsTable title="Assigned users and groups" :items="accountAssignments" :columns="asgCols" track-by="key" selection-type="single" v-model:selected="asgSel"
             empty-title="No users or groups assigned">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!asgSel.length || busy" @click="removeAssignment">Remove access</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="sel = [account.id]; openAssign()">Assign users or groups</button>
      </template>
    </CsTable>
  </div>

  <!-- Groups -->
  <CsTable v-else-if="page === 'groups'" variant="full-page" title="Groups" :items="groups" :columns="groupCols" track-by="id" />

  <!-- Permission sets -->
  <div v-else-if="page === 'permission-sets'">
    <CsTable variant="full-page" title="Permission sets" :items="sets" :columns="psCols" track-by="arn" selection-type="single" v-model:selected="psSel"
             description="Permission sets are templates you use to grant users and groups permissions to AWS accounts."
             empty-title="No permission sets" empty-text="Create a permission set to assign access to AWS accounts.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!psSel.length" @click="deleting = psSel[0]">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('sso', 'permission-set-create')">Create permission set</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('sso', 'permission-set', { name: row.name })">{{ row.name }}</a></template>
    </CsTable>
  </div>

  <!-- Create permission set -->
  <div v-else-if="page === 'permission-set-create'">
    <CsHeader title="Specify permission set details" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Permission set details" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Permission set name</label><input v-model="form.name" class="cs-input" :class="{ 'is-invalid': nameProblem }" />
          <span v-if="nameProblem" class="cs-error-text">{{ nameProblem }}</span>
          <span v-else class="cs-constraint">Up to 32 alphanumeric characters and the following: + = , . @ -</span></div>
        <div class="cs-field"><label class="cs-label">Session duration</label>
          <select v-model="form.duration" class="cs-select"><option v-for="d in DURATIONS" :key="d.value" :value="d.value">{{ d.label }}</option></select></div>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('sso', 'permission-sets')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !form.name || !!nameProblem" @click="create">Create</button>
    </div>
  </div>

  <!-- One permission set -->
  <div v-else-if="page === 'permission-set' && ps">
    <CsHeader :title="ps.name"><template #actions><button type="button" class="cs-btn" @click="deleting = ps.arn">Delete</button></template></CsHeader>
    <div v-if="ps.stale" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
      <div><strong>{{ ps.stale }} account(s) need to be updated</strong>This permission set changed since it was provisioned. Accounts keep the old version until you update them.
        <button type="button" class="cs-btn ic__inline" :disabled="busy" @click="reprovision">Update</button></div></div>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="General settings" :level="2"><template #actions><button type="button" class="cs-btn" @click="openDuration">Edit</button></template></CsHeader></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Name</dt><dd>{{ ps.name }}</dd></div><div><dt>ARN</dt><dd class="cs-mono">{{ ps.arn }}</dd></div>
        <div><dt>Session duration</dt><dd>{{ durationLabel(ps.duration) }}</dd></div><div><dt>Version</dt><dd>{{ ps.version }}</dd></div>
      </dl></div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in ['Permissions', 'Accounts']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <template v-if="tab === 'Permissions'">
      <CsTable title="AWS managed policies" :items="managedRows" :columns="[{ id: 'name', header: 'Policy name' }]" track-by="arn" selection-type="multi" v-model:selected="mpSel">
        <template #actions>
          <button type="button" class="cs-btn" :disabled="!mpSel.length || busy" @click="detach">Detach</button>
          <button type="button" class="cs-btn" @click="attaching = true">Attach policies</button>
        </template>
      </CsTable>
      <section class="cs-container ic__space">
        <div class="cs-container__head"><CsHeader title="Inline policy" :level="2"><template #actions>
          <button v-if="ps.inline" type="button" class="cs-btn" :disabled="busy" @click="deleteInline">Delete</button>
          <button type="button" class="cs-btn" @click="openInline">{{ ps.inline ? 'Edit' : 'Add inline policy' }}</button></template></CsHeader></div>
        <div class="cs-container__body"><pre v-if="ps.inline" class="cs-code">{{ pretty(ps.inline) }}</pre><div v-else class="cs-empty">No inline policy</div></div>
      </section>
    </template>
    <CsTable v-else title="Provisioned accounts" :items="provisioned" :columns="provCols" track-by="id">
      <template #cell-status="{ row }"><CsStatus :type="row.current ? 'success' : 'warning'" :label="row.current ? 'Provisioned' : 'Outdated'" /></template>
    </CsTable>
  </div>
  <NotFound v-else what="Resource" :id="ctx.route.value.params?.name || ''" :back="page === 'account' ? 'accounts' : 'permission-sets'" />

  <CsModal v-if="assigning" title="Assign users and groups" size="large" @close="assigning = false">
    <div class="cs-stack">
      <p class="cs-muted ic__p">Selected AWS accounts: {{ sel.map(id => accountName(id)).join(', ') }}</p>
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Principal type</label>
          <select v-model="assign.type" class="cs-select"><option value="GROUP">Groups</option><option value="USER">Users</option></select></div>
        <div class="cs-field"><label class="cs-label">{{ assign.type === 'GROUP' ? 'Group' : 'User name' }}</label>
          <select v-if="assign.type === 'GROUP'" v-model="assign.principal" class="cs-select"><option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option></select>
          <input v-else v-model="assign.principal" class="cs-input" placeholder="ops.engineer" /></div>
      </div>
      <div class="cs-field"><label class="cs-label">Permission sets</label>
        <select v-model="assign.ps" class="cs-select"><option v-for="s in sets" :key="s.arn" :value="s.arn">{{ s.name }}</option></select>
        <span v-if="!sets.length" class="cs-error-text">Create a permission set first.</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="assigning = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !assign.ps || !assign.principal" @click="doAssign">Submit</button>
    </template>
  </CsModal>

  <AttachPolicies v-if="attaching && ps" :attached="ps.managed" :busy="busy" @close="attaching = false" @attach="attach" />

  <CsModal v-if="inlining" title="Inline policy" size="large" @close="inlining = false">
    <textarea v-model="inlineDoc" class="cs-textarea cs-mono ic__json" spellcheck="false" />
    <span v-if="parseDoc(inlineDoc)[1]" class="cs-error-text">{{ parseDoc(inlineDoc)[1] }}</span>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="inlining = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!parseDoc(inlineDoc)[1]" @click="saveInline">Save changes</button>
    </template>
  </CsModal>

  <CsModal v-if="durationEditing" title="Edit general settings" @close="durationEditing = false">
    <div class="cs-field"><label class="cs-label">Session duration</label>
      <select v-model="newDuration" class="cs-select"><option v-for="d in DURATIONS" :key="d.value" :value="d.value">{{ d.label }}</option></select></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="durationEditing = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveDuration">Save changes</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete permission set" :word="setName(deleting)" :busy="busy" @close="deleting = ''" @confirm="remove">
    <p class="ic__p">A permission set that is assigned to accounts cannot be deleted. Remove its assignments first.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import { lastPart, parseJson as parseDoc, pretty } from '../kit';
import AttachPolicies from './AttachPolicies.vue';
import NotFound from './NotFound.vue';

const DURATIONS = [{ value: 'PT1H', label: '1 hour' }, { value: 'PT2H', label: '2 hours' }, { value: 'PT4H', label: '4 hours' },
  { value: 'PT8H', label: '8 hours' }, { value: 'PT12H', label: '12 hours' }];

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const psSel = ref<string[]>([]);
const asgSel = ref<string[]>([]);
const mpSel = ref<string[]>([]);
const tab = ref('Permissions');
const busy = ref(false);
const deleting = ref('');
const assigning = ref(false);
const attaching = ref(false);
const inlining = ref(false);
const inlineDoc = ref('');
const durationEditing = ref(false);
const newDuration = ref('PT1H');

const instance = computed(() => String(pick(ctx.c.value, 'sso.instance', '')));
const orgAccounts = computed(() => rows<any>(ctx.c.value, 'org.accounts'));
const ous = computed(() => rows<any>(ctx.c.value, 'org.ous'));
const groups = computed(() => rows<any>(ctx.c.value, 'sso.groups').map(g => ({ ...g, count: g.members.length })));
const assignments = computed(() => rows<any>(ctx.c.value, 'sso.assignments'));
const sets = computed(() => rows<any>(ctx.c.value, 'sso.permission_sets').map(p => ({
  ...p, stale: Object.values(p.provisioned).filter((v: any) => v !== p.version).length,
  assignments: assignments.value.filter(a => a.ps === p.arn).length, durationText: durationLabel(p.duration),
})));
const ps = computed<any>(() => sets.value.find(s => s.name === ctx.route.value.params?.name) || null);
const accounts = computed(() => orgAccounts.value.map(a => ({ ...a, ou: ous.value.find(o => o.id === a.parent)?.name || 'Root',
  assigned: assignments.value.filter(x => x.account === a.id).length })));
const account = computed<any>(() => accounts.value.find(a => a.id === ctx.route.value.params?.id) || null);
const accountAssignments = computed(() => assignments.value.filter(a => a.account === account.value?.id).map(a => ({
  ...a, key: `${a.type}|${a.principal}|${a.ps}`, principalName: a.type === 'GROUP' ? (groups.value.find(g => g.id === a.principal || g.name === a.principal)?.name || a.principal) : a.principal,
  setName: setName(a.ps) })));
const managedRows = computed(() => (ps.value?.managed || []).map((arn: string) => ({ arn, name: lastPart(arn) })));
const provisioned = computed(() => Object.entries(ps.value?.provisioned || {}).map(([id, v]) => ({ id, name: accountName(id), version: v, current: v === ps.value.version })));

function durationLabel(d: string) { return DURATIONS.find(x => x.value === d)?.label || d; }
function accountName(id: string) { return orgAccounts.value.find(a => a.id === id)?.name || id; }
function setName(arn: string) { return sets.value.find(s => s.arn === arn)?.name || lastPart(arn); }

const acctCols = [{ id: 'name', header: 'Account name' }, { id: 'id', header: 'Account ID' }, { id: 'ou', header: 'Organizational unit' },
  { id: 'assigned', header: 'Assignments' }];
const asgCols = [{ id: 'principalName', header: 'User/group' }, { id: 'type', header: 'Type' }, { id: 'setName', header: 'Permission set' }];
const groupCols = [{ id: 'name', header: 'Group name' }, { id: 'id', header: 'Group ID' }, { id: 'count', header: 'Members' }];
const psCols = [{ id: 'name', header: 'Permission set name', sortKey: 'name' }, { id: 'durationText', header: 'Session duration' },
  { id: 'assignments', header: 'Assignments' }, { id: 'stale', header: 'Outdated accounts' }];
const provCols = [{ id: 'name', header: 'Account name' }, { id: 'id', header: 'Account ID' }, { id: 'version', header: 'Provisioned version' }, { id: 'status', header: 'Status' }];

const form = reactive({ name: '', duration: 'PT1H' });
const nameProblem = computed(() => {
  if (!form.name) return '';
  if (!/^[\w+=,.@-]{1,32}$/.test(form.name)) return 'Up to 32 alphanumeric characters and + = , . @ -';
  return sets.value.some(s => s.name === form.name) ? `A permission set named ${form.name} already exists.` : '';
});
async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sso-admin', 'create-permission-set'], {
    '--instance-arn': instance.value, '--name': form.name, '--session-duration': form.duration,
  }), `Successfully created permission set ${form.name}.`);
  busy.value = false;
  if (result.ok) ctx.to('sso', 'permission-set', { name: form.name });
}
const assign = reactive({ type: 'GROUP', principal: '', ps: '' });
function openAssign() {
  assign.type = 'GROUP'; assign.principal = groups.value[0]?.id || ''; assign.ps = ps.value?.arn || sets.value[0]?.arn || '';
  assigning.value = true;
}
async function doAssign() {
  busy.value = true;
  let ok = true;
  for (const id of sel.value) {
    const result = await ctx.run(cli(['aws', 'sso-admin', 'create-account-assignment'], {
      '--instance-arn': instance.value, '--target-id': id, '--target-type': 'AWS_ACCOUNT', '--permission-set-arn': assign.ps,
      '--principal-type': assign.type, '--principal-id': assign.principal,
    }));
    ok = ok && result.ok;
  }
  busy.value = false;
  if (ok) { ctx.api.notify('success', 'We have successfully assigned access to the selected accounts.'); assigning.value = false; }
}
async function removeAssignment() {
  const a = accountAssignments.value.find(x => x.key === asgSel.value[0]);
  if (!a) return;
  busy.value = true;
  await ctx.run(cli(['aws', 'sso-admin', 'delete-account-assignment'], {
    '--instance-arn': instance.value, '--target-id': a.account, '--target-type': 'AWS_ACCOUNT', '--permission-set-arn': a.ps,
    '--principal-type': a.type, '--principal-id': a.principal,
  }), 'Access removed.');
  busy.value = false;
  asgSel.value = [];
}
async function attach(arns: string[]) {
  busy.value = true;
  for (const arn of arns) {
    await ctx.run(cli(['aws', 'sso-admin', 'attach-managed-policy-to-permission-set'], {
      '--instance-arn': instance.value, '--permission-set-arn': ps.value.arn, '--managed-policy-arn': arn,
    }));
  }
  busy.value = false;
  attaching.value = false;
  ctx.api.notify('success', `Policies attached to ${ps.value.name}. Update the provisioned accounts to apply them.`);
}
async function detach() {
  busy.value = true;
  for (const arn of mpSel.value) {
    await ctx.run(cli(['aws', 'sso-admin', 'detach-managed-policy-from-permission-set'], {
      '--instance-arn': instance.value, '--permission-set-arn': ps.value.arn, '--managed-policy-arn': arn,
    }), `${lastPart(arn)} detached.`);
  }
  busy.value = false;
  mpSel.value = [];
}
function openInline() { inlineDoc.value = ps.value.inline ? pretty(ps.value.inline) : pretty({ Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: [], Resource: '*' }] }); inlining.value = true; }
async function saveInline() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sso-admin', 'put-inline-policy-to-permission-set'], {
    '--instance-arn': instance.value, '--permission-set-arn': ps.value.arn, '--inline-policy': JSON.stringify(JSON.parse(inlineDoc.value)),
  }), 'Inline policy saved.');
  busy.value = false;
  if (result.ok) inlining.value = false;
}
async function deleteInline() {
  busy.value = true;
  await ctx.run(cli(['aws', 'sso-admin', 'delete-inline-policy-from-permission-set'], {
    '--instance-arn': instance.value, '--permission-set-arn': ps.value.arn }), 'Inline policy deleted.');
  busy.value = false;
}
function openDuration() { newDuration.value = ps.value.duration; durationEditing.value = true; }
async function saveDuration() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sso-admin', 'update-permission-set'], {
    '--instance-arn': instance.value, '--permission-set-arn': ps.value.arn, '--session-duration': newDuration.value }), 'Permission set updated.');
  busy.value = false;
  if (result.ok) durationEditing.value = false;
}
async function reprovision() {
  busy.value = true;
  await ctx.run(cli(['aws', 'sso-admin', 'provision-permission-set'], {
    '--instance-arn': instance.value, '--permission-set-arn': ps.value.arn, '--target-type': 'ALL_PROVISIONED_ACCOUNTS',
  }), `${ps.value.name} was updated in all provisioned accounts.`);
  busy.value = false;
}
async function remove() {
  busy.value = true;
  const arn = deleting.value;
  const result = await ctx.run(cli(['aws', 'sso-admin', 'delete-permission-set'], { '--instance-arn': instance.value, '--permission-set-arn': arn }),
    'Permission set deleted.');
  busy.value = false;
  deleting.value = '';
  if (result.ok && page.value === 'permission-set') ctx.to('sso', 'permission-sets');
}
</script>

<style scoped>
.ic__p { margin: 0; }
.ic__inline { margin-left: 8px; }
.ic__space { margin-top: 20px; }
.ic__json { min-height: 260px; }
</style>
