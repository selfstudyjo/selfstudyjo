<template>
  <!-- Users -->
  <div v-if="page === 'users'">
    <CsTable variant="full-page" title="Users" :items="users" :columns="cols" track-by="name" selection-type="multi" v-model:selected="sel"
             description="An IAM user is an identity with long-term credentials that is used to interact with AWS in an account."
             filter-placeholder="Search">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = sel[0]">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('iam', 'user-create')">Create user</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('iam', 'user', { name: row.name })">{{ row.name }}</a></template>
      <template #cell-keyage="{ row }">
        <span v-if="row.activeAge === null" class="cs-muted">-</span>
        <CsStatus v-else :type="row.activeAge > 90 ? 'warning' : 'success'" :label="days(row.activeAge)" />
      </template>
    </CsTable>
  </div>

  <!-- Create user -->
  <div v-else-if="page === 'user-create'">
    <CsHeader title="Specify user details" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="User details" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">User name</label>
          <input v-model="form.name" class="cs-input" :class="{ 'is-invalid': nameProblem }" />
          <span v-if="nameProblem" class="cs-error-text">{{ nameProblem }}</span>
          <span v-else class="cs-constraint">The user name can have up to 64 characters. Valid characters: A-Z, a-z, 0-9, and + = , . @ _ - (hyphen)</span></div>
        <label class="cs-check"><input type="checkbox" disabled /><span>Provide user access to the AWS Management Console - <em>optional</em>
          <small>If you're providing console access to a person, it's a best practice to manage their access in IAM Identity Center.</small></span></label>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Set permissions" :level="2" description="Attach existing policies directly to the user." /></div>
      <div class="cs-container__body">
        <CsTable title="Permissions policies" :items="policies" :columns="polCols" track-by="arn" selection-type="multi" v-model:selected="form.policies" :info="false">
          <template #cell-type="{ row }">{{ row.aws ? 'AWS managed' : 'Customer managed' }}</template>
        </CsTable>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('iam', 'users')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !form.name || !!nameProblem" @click="create"><span v-if="busy" class="cs-btn__spinner" />Create user</button>
    </div>
  </div>

  <!-- One user -->
  <div v-else-if="user">
    <CsHeader :title="user.name"><template #actions><button type="button" class="cs-btn" @click="deleting = user.name">Delete</button></template></CsHeader>
    <div v-if="user.backdoor" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
      <div><strong>Created by ci-deployer's key from a Tor exit node</strong>CloudTrail shows CreateUser and AttachUserPolicy for this user from 185.220.101.44.</div></div>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Summary" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>ARN</dt><dd class="cs-mono">{{ user.arn }}</dd></div>
        <div><dt>Console access</dt><dd>{{ user.console ? (user.mfa ? 'Enabled with MFA' : 'Enabled without MFA') : 'Disabled' }}</dd></div>
        <div><dt>Access key 1</dt><dd>{{ user.keys[0] ? `${user.keys[0].id} - ${user.keys[0].status} - ${days(user.keys[0].age)} old` : 'Create access key' }}</dd></div>
        <div><dt>Created</dt><dd>{{ user.created_days ? `${user.created_days} days ago` : 'Today' }}</dd></div>
        <div><dt>Access key 2</dt><dd>{{ user.keys[1] ? `${user.keys[1].id} - ${user.keys[1].status} - ${days(user.keys[1].age)} old` : '-' }}</dd></div>
      </dl></div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in ['Permissions', 'Security credentials', 'Access Advisor']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>

    <template v-if="tab === 'Permissions'">
      <CsTable title="Permissions policies" :items="perms" :columns="permCols" track-by="key" selection-type="multi" v-model:selected="permSel"
               description="Permissions are defined by policies attached to the user directly.">
        <template #actions>
          <button type="button" class="cs-btn" :disabled="!permSel.length || busy" @click="removePerms">Remove</button>
          <CsDropdown label="Add permissions" primary :items="[{ id: 'attach', text: 'Add permissions' }, { id: 'inline', text: 'Create inline policy' }]" @select="addPerm" />
        </template>
        <template #cell-name="{ row }"><a v-if="row.arn" href="#" class="cs-link" @click.prevent="ctx.to('iam', 'policy', { arn: row.arn, name: row.name })">{{ row.name }}</a><span v-else>{{ row.name }}</span></template>
      </CsTable>
    </template>

    <template v-else-if="tab === 'Security credentials'">
      <CsTable title="Access keys" :items="keys" :columns="keyCols" track-by="id" selection-type="single" v-model:selected="keySel"
               description="Use access keys to send programmatic calls to AWS from the AWS CLI, AWS Tools for PowerShell, AWS SDKs, or direct AWS API calls. You can have a maximum of two access keys (active or inactive) at a time."
               empty-title="No access keys" empty-text="As a best practice, avoid using long-term credentials like access keys.">
        <template #actions>
          <CsDropdown :items="keyActions" :disabled="!keySel.length" @select="keyAct" />
          <button type="button" class="cs-btn" :disabled="user.keys.length >= 2 || busy" @click="createKey">Create access key</button>
        </template>
        <template #cell-status="{ row }"><CsStatus :type="row.status === 'Active' ? 'success' : 'stopped'" :label="row.status" /></template>
        <template #cell-agecell="{ row }"><CsStatus :type="row.age > 90 && row.status === 'Active' ? 'warning' : 'info'" :label="days(row.age)" /></template>
      </CsTable>
      <div class="cs-alert cs-alert--info iu__tip"><CsIcon name="status-info" class="cs-alert__icon" />
        <div><strong>Rotating a key without an outage</strong>Create the second key, point the consumer at it (for example its Secrets Manager secret), wait for it to be used, then make the old key Inactive - which can be reverted - and only then delete it.</div></div>
    </template>

    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader title="Access Advisor" :level="2" description="Service last accessed data. Generate a report to see which services this user has used." /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-row"><button type="button" class="cs-btn" :disabled="busy" @click="advisor">Generate report</button></div>
        <table v-if="advisorRows.length" class="cs-table-mini"><thead><tr><th>Service</th><th>Last accessed</th></tr></thead>
          <tbody><tr v-for="r in advisorRows" :key="r.ServiceNamespace"><td>{{ r.ServiceNamespace }}</td><td>{{ r.LastAuthenticated }}</td></tr></tbody></table>
      </div>
    </section>
  </div>
  <NotFound v-else what="User" :id="ctx.route.value.params?.name || ''" back="users" />

  <AttachPolicies v-if="attaching && user" :attached="user.attached" :busy="busy" title="Add permissions" @close="attaching = false" @attach="attach" />

  <CsModal v-if="inlining" title="Create inline policy" size="large" @close="inlining = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Policy name</label><input v-model="inline.name" class="cs-input" /></div>
      <div class="cs-field"><label class="cs-label">Policy editor</label><textarea v-model="inline.doc" class="cs-textarea cs-mono iu__json" spellcheck="false" />
        <span v-if="inlineProblem" class="cs-error-text">{{ inlineProblem }}</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="inlining = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !inline.name || !!inlineProblem" @click="putInline">Create policy</button>
    </template>
  </CsModal>

  <CsModal v-if="newKey" title="Retrieve access keys" @close="newKey = null">
    <div class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
      <div>This is the only time that the secret access key can be viewed or downloaded. You cannot recover it later.</div></div>
    <dl class="cs-kv"><div><dt>Access key</dt><dd class="cs-mono">{{ newKey.AccessKeyId }}</dd></div>
      <div><dt>Secret access key</dt><dd class="cs-mono">{{ newKey.SecretAccessKey }}</dd></div></dl>
    <template #footer><button type="button" class="cs-btn cs-btn--primary" @click="newKey = null">Done</button></template>
  </CsModal>

  <CsDelete v-if="keyDeleting" title="Delete access key" :word="keyDeleting" :busy="busy" @close="keyDeleting = ''" @confirm="deleteKey"
            :warning="keyDeleteWarning">
    <p class="iu__p">To confirm deletion, enter the access key ID in the text input field.</p>
  </CsDelete>

  <CsDelete v-if="deleting" :title="`Delete ${deleting}?`" :word="deleting" :busy="busy" @close="deleting = ''" @confirm="removeUser">
    <p class="iu__p">Permanently delete this user? Its access keys must be deleted and its policies detached first.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import { days, lastPart, parseJson as parseDoc, pretty } from '../kit';
import AttachPolicies from './AttachPolicies.vue';
import NotFound from './NotFound.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const permSel = ref<string[]>([]);
const keySel = ref<string[]>([]);
const tab = ref(ctx.route.value.params?.tab === 'credentials' ? 'Security credentials' : 'Permissions');
const busy = ref(false);
const deleting = ref('');
const keyDeleting = ref('');
const attaching = ref(false);
const inlining = ref(false);
const newKey = ref<any>(null);
const advisorRows = ref<any[]>([]);

const users = computed(() => rows<any>(ctx.c.value, 'iam.users').map(u => {
  const active = u.keys.filter((k: any) => k.status === 'Active');
  return { ...u, path: '/', groups: 0, mfaText: u.mfa ? 'Virtual' : '-',
    keyId: active[0] ? `${active[0].id}` : '-', activeAge: active.length ? Math.max(...active.map((k: any) => k.age)) : null,
    lastActivity: u.keys.some((k: any) => k.last_used !== null) ? `${Math.min(...u.keys.filter((k: any) => k.last_used !== null).map((k: any) => k.last_used))} days ago` : 'Never' };
}));
const user = computed<any>(() => users.value.find(u => u.name === ctx.route.value.params?.name) || null);
const policies = computed(() => rows<any>(ctx.c.value, 'iam.policies'));
const perms = computed(() => user.value ? [
  ...user.value.attached.map((arn: string) => ({ key: arn, arn, name: lastPart(arn), type: arn.includes(':aws:policy/') ? 'AWS managed' : 'Customer managed', via: 'Directly' })),
  ...user.value.inline.map((n: string) => ({ key: 'inline:' + n, arn: '', name: n, type: 'Customer inline', via: 'Inline' })),
] : []);
const keys = computed(() => (user.value?.keys || []).map((k: any) => ({ ...k, lastUsed: k.last_used === null ? 'Never' : `${k.last_used} day(s) ago${k.service ? ` - ${k.service} - ${k.region}` : ''}` })));
const keyActions = computed(() => {
  const k = keys.value.find((x: any) => x.id === keySel.value[0]);
  return [{ id: 'activate', text: 'Activate', disabled: k?.status === 'Active' }, { id: 'deactivate', text: 'Deactivate', disabled: k?.status !== 'Active' },
    { id: 'delete', text: 'Delete' }];
});
const keyDeleteWarning = computed(() => (keys.value.find((k: any) => k.id === keyDeleting.value)?.status === 'Active'
  ? 'This key is Active. Deactivate it first: an inactive key can be reactivated if something still depends on it; a deleted key cannot.' : ''));

const cols = [
  { id: 'name', header: 'User name', sortKey: 'name' }, { id: 'path', header: 'Path' }, { id: 'groups', header: 'Groups' },
  { id: 'lastActivity', header: 'Last activity' }, { id: 'mfaText', header: 'MFA' },
  { id: 'console', header: 'Console access', cell: (u: any) => (u.console ? 'Enabled' : 'Disabled') },
  { id: 'keyId', header: 'Access key ID' }, { id: 'keyage', header: 'Active key age' },
];
const polCols = [{ id: 'name', header: 'Policy name', sortKey: 'name' }, { id: 'type', header: 'Type' }, { id: 'attachments', header: 'Attached entities' }];
const permCols = [{ id: 'name', header: 'Policy name' }, { id: 'type', header: 'Type' }, { id: 'via', header: 'Attached via' }];
const keyCols = [{ id: 'id', header: 'Access key ID' }, { id: 'status', header: 'Status' }, { id: 'agecell', header: 'Age' }, { id: 'lastUsed', header: 'Last used' }];

const form = reactive({ name: '', policies: [] as string[] });
const nameProblem = computed(() => {
  if (!form.name) return '';
  if (!/^[\w+=,.@-]{1,64}$/.test(form.name)) return 'User name can have up to 64 characters: A-Z, a-z, 0-9, and + = , . @ _ -';
  if (users.value.some(u => u.name.toLowerCase() === form.name.toLowerCase())) return 'A user with this name already exists.';
  return '';
});
async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'create-user'], { '--user-name': form.name }));
  let ok = result.ok;
  for (const arn of ok ? form.policies : []) {
    const attached = await ctx.run(cli(['aws', 'iam', 'attach-user-policy'], { '--user-name': form.name, '--policy-arn': arn }));
    ok = ok && attached.ok;
  }
  busy.value = false;
  if (result.ok) { ctx.api.notify('success', `User ${form.name} created successfully.`); ctx.to('iam', 'user', { name: form.name }); }
}

function addPerm(action: string) {
  if (action === 'attach') attaching.value = true;
  if (action === 'inline') { Object.assign(inline, { name: '', doc: pretty({ Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: [], Resource: '*' }] }) }); inlining.value = true; }
}
async function attach(arns: string[]) {
  busy.value = true;
  let ok = true;
  for (const arn of arns) {
    const result = await ctx.run(cli(['aws', 'iam', 'attach-user-policy'], { '--user-name': user.value.name, '--policy-arn': arn }));
    ok = ok && result.ok;
  }
  busy.value = false;
  if (ok) { ctx.api.notify('success', `${arns.length} policy(ies) attached to ${user.value.name}.`); attaching.value = false; }
}
async function removePerms() {
  busy.value = true;
  for (const key of permSel.value) {
    const command = key.startsWith('inline:')
      ? cli(['aws', 'iam', 'delete-user-policy'], { '--user-name': user.value.name, '--policy-name': key.slice(7) })
      : cli(['aws', 'iam', 'detach-user-policy'], { '--user-name': user.value.name, '--policy-arn': key });
    await ctx.run(command, `Policy ${lastPart(key.replace('inline:', ''))} removed from ${user.value.name}.`);
  }
  busy.value = false;
  permSel.value = [];
}
const inline = reactive({ name: '', doc: '' });
const inlineProblem = computed(() => parseDoc(inline.doc)[1]);
async function putInline() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'put-user-policy'], {
    '--user-name': user.value.name, '--policy-name': inline.name.trim(), '--policy-document': JSON.stringify(JSON.parse(inline.doc)),
  }), `Policy ${inline.name} created.`);
  busy.value = false;
  if (result.ok) inlining.value = false;
}

async function createKey() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'create-access-key'], { '--user-name': user.value.name }));
  busy.value = false;
  if (result.ok) newKey.value = parseJson<any>(result.output)?.AccessKey || null;
}
async function keyAct(action: string) {
  const kid = keySel.value[0];
  if (!kid) return;
  if (action === 'delete') { keyDeleting.value = kid; return; }
  busy.value = true;
  const status = action === 'activate' ? 'Active' : 'Inactive';
  await ctx.run(cli(['aws', 'iam', 'update-access-key'], { '--user-name': user.value.name, '--access-key-id': kid, '--status': status }),
    `Access key ${kid} is now ${status.toLowerCase()}.`);
  busy.value = false;
}
async function deleteKey() {
  busy.value = true;
  const kid = keyDeleting.value;
  const result = await ctx.run(cli(['aws', 'iam', 'delete-access-key'], { '--user-name': user.value.name, '--access-key-id': kid }), `Access key ${kid} deleted.`);
  busy.value = false;
  keyDeleting.value = '';
  if (result.ok) keySel.value = [];
}
async function advisor() {
  busy.value = true;
  const job = await ctx.run(cli(['aws', 'iam', 'generate-service-last-accessed-details'], { '--arn': user.value.arn }), '', { unlogged: true });
  const jobId = parseJson<any>(job.output)?.JobId;
  if (jobId) {
    const details = await ctx.run(cli(['aws', 'iam', 'get-service-last-accessed-details'], { '--job-id': jobId }), '', { unlogged: true });
    advisorRows.value = parseJson<any>(details.output)?.ServicesLastAccessed || [];
  }
  busy.value = false;
}
async function removeUser() {
  busy.value = true;
  const name = deleting.value;
  const result = await ctx.run(cli(['aws', 'iam', 'delete-user'], { '--user-name': name }), `User ${name} deleted.`);
  busy.value = false;
  deleting.value = '';
  if (result.ok) { sel.value = []; if (page.value === 'user') ctx.to('iam', 'users'); }
}
</script>

<style scoped>
.iu__p { margin: 0; }
.iu__tip { margin-top: 16px; }
.iu__json { min-height: 260px; }
</style>
