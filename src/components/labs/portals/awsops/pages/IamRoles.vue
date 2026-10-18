<template>
  <!-- Roles -->
  <CsTable v-if="page === 'roles'" variant="full-page" title="Roles" :items="roles" :columns="cols" track-by="name" selection-type="multi" v-model:selected="sel"
           description="An IAM role is an identity you can create that has specific permissions with credentials that are valid for short durations. Roles can be assumed by entities that you trust."
           filter-placeholder="Search">
    <template #actions>
      <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = sel[0]">Delete</button>
      <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('iam', 'role-create')">Create role</button>
    </template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('iam', 'role', { name: row.name })">{{ row.name }}</a></template>
  </CsTable>

  <!-- Create role -->
  <div v-else-if="page === 'role-create'">
    <CsHeader title="Create role" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Trusted entity type" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-tiles">
          <label v-for="t in TRUSTS" :key="t.id" class="cs-tile" :class="{ 'is-checked': form.trust === t.id }">
            <input v-model="form.trust" type="radio" :value="t.id" @change="seedTrust" /><span><strong>{{ t.label }}</strong><small>{{ t.help }}</small></span></label>
        </div>
        <div v-if="form.trust === 'service'" class="cs-field"><label class="cs-label">Service or use case</label>
          <select v-model="form.service" class="cs-select" @change="seedTrust"><option value="ec2.amazonaws.com">EC2</option><option value="backup.amazonaws.com">Backup</option>
            <option value="imagebuilder.amazonaws.com">EC2 Image Builder</option><option value="config.amazonaws.com">Config</option></select></div>
        <div v-if="form.trust === 'web'" class="cs-grid-2">
          <div class="cs-field"><label class="cs-label">Identity provider</label>
            <select v-model="form.provider" class="cs-select" @change="seedTrust"><option value="">Choose a provider</option>
              <option v-for="p in providers" :key="p.arn" :value="p.arn">{{ p.url.replace('https://', '') }}</option></select>
            <span v-if="!providers.length" class="cs-constraint">No OpenID Connect providers. Add one under Identity providers first.</span></div>
          <div class="cs-field"><label class="cs-label">GitHub organization / repository / branch (sub claim)</label>
            <input v-model="form.sub" class="cs-input" placeholder="repo:acme-pay/platform:pull_request" @input="seedTrust" /></div>
        </div>
        <div class="cs-field"><label class="cs-label">Trust policy</label>
          <textarea v-model="form.doc" class="cs-textarea cs-mono ir__json" spellcheck="false" />
          <span v-if="docProblem" class="cs-error-text">{{ docProblem }}</span></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Role details" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Role name</label><input v-model="form.name" class="cs-input" :class="{ 'is-invalid': nameProblem }" />
          <span v-if="nameProblem" class="cs-error-text">{{ nameProblem }}</span>
          <span v-else class="cs-constraint">Maximum 64 characters. Use alphanumeric and '+=,.@-_' characters.</span></div>
        <CsTable title="Permissions policies" :items="policies" :columns="polCols" track-by="arn" selection-type="multi" v-model:selected="form.policies" :info="false">
          <template #cell-type="{ row }">{{ row.aws ? 'AWS managed' : 'Customer managed' }}</template>
        </CsTable>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('iam', 'roles')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !form.name || !!nameProblem || !!docProblem" @click="create"><span v-if="busy" class="cs-btn__spinner" />Create role</button>
    </div>
  </div>

  <!-- One role -->
  <div v-else-if="role">
    <CsHeader :title="role.name"><template #actions><button type="button" class="cs-btn" @click="deleting = role.name">Delete</button></template></CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Summary" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>ARN</dt><dd class="cs-mono">{{ role.arn }}</dd></div>
        <div><dt>Instance profile ARN</dt><dd class="cs-mono">{{ role.profiles.length ? `arn:aws:iam::${ctx.account.value}:instance-profile/${role.profiles[0]}` : '-' }}</dd></div>
        <div><dt>Maximum session duration</dt><dd>{{ role.max_session / 3600 }} hour</dd></div>
      </dl></div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in ['Permissions', 'Trust relationships']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <CsTable v-if="tab === 'Permissions'" title="Permissions policies" :items="perms" :columns="permCols" track-by="key" selection-type="multi" v-model:selected="permSel">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!permSel.length || busy" @click="removePerms">Remove</button>
        <CsDropdown label="Add permissions" primary :items="[{ id: 'attach', text: 'Attach policies' }, { id: 'inline', text: 'Create inline policy' }]" @select="addPerm" />
      </template>
      <template #cell-name="{ row }"><a v-if="row.arn" href="#" class="cs-link" @click.prevent="ctx.to('iam', 'policy', { arn: row.arn, name: row.name })">{{ row.name }}</a><span v-else>{{ row.name }}</span></template>
    </CsTable>
    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader title="Trusted entities" :level="2" description="Entities that can assume this role under specified conditions.">
        <template #actions><button type="button" class="cs-btn" @click="editTrust">Edit trust policy</button></template></CsHeader></div>
      <div class="cs-container__body"><pre class="cs-code">{{ pretty(role.trust) }}</pre></div>
    </section>
  </div>
  <NotFound v-else what="Role" :id="ctx.route.value.params?.name || ''" back="roles" />

  <AttachPolicies v-if="attaching && role" :attached="role.attached" :busy="busy" @close="attaching = false" @attach="attach" />

  <CsModal v-if="trustEditing" title="Edit trust policy" size="large" @close="trustEditing = false">
    <textarea v-model="trustDoc" class="cs-textarea cs-mono ir__json" spellcheck="false" />
    <span v-if="parseDoc(trustDoc)[1]" class="cs-error-text">{{ parseDoc(trustDoc)[1] }}</span>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="trustEditing = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!parseDoc(trustDoc)[1]" @click="saveTrust">Update policy</button>
    </template>
  </CsModal>

  <CsModal v-if="inlining" title="Create inline policy" size="large" @close="inlining = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Policy name</label><input v-model="inline.name" class="cs-input" /></div>
      <div class="cs-field"><label class="cs-label">Policy editor</label><textarea v-model="inline.doc" class="cs-textarea cs-mono ir__json" spellcheck="false" />
        <span v-if="parseDoc(inline.doc)[1]" class="cs-error-text">{{ parseDoc(inline.doc)[1] }}</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="inlining = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !inline.name || !!parseDoc(inline.doc)[1]" @click="putInline">Create policy</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" :title="`Delete ${deleting}?`" :word="deleting" :busy="busy" @close="deleting = ''" @confirm="remove">
    <p class="ir__p">A role with attached or inline policies cannot be deleted: remove them first.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import { lastPart, parseJson as parseDoc, pretty } from '../kit';
import AttachPolicies from './AttachPolicies.vue';
import NotFound from './NotFound.vue';

const TRUSTS = [
  { id: 'service', label: 'AWS service', help: 'Allow AWS services like EC2 to perform actions in this account.' },
  { id: 'web', label: 'Web identity', help: 'Allows users federated by an OpenID Connect provider to assume this role.' },
  { id: 'custom', label: 'Custom trust policy', help: 'Create a custom trust policy to enable others to perform actions in this account.' },
];

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const permSel = ref<string[]>([]);
const tab = ref('Permissions');
const busy = ref(false);
const deleting = ref('');
const attaching = ref(false);
const trustEditing = ref(false);
const trustDoc = ref('');
const inlining = ref(false);
const inline = reactive({ name: '', doc: '' });

const roles = computed(() => rows<any>(ctx.c.value, 'iam.roles').map(r => ({ ...r, trusted: trustedText(r.trust), lastActivity: '-' })));
const role = computed<any>(() => roles.value.find(r => r.name === ctx.route.value.params?.name) || null);
const policies = computed(() => rows<any>(ctx.c.value, 'iam.policies'));
const providers = computed(() => rows<any>(ctx.c.value, 'iam.oidc'));
const perms = computed(() => role.value ? [
  ...role.value.attached.map((arn: string) => ({ key: arn, arn, name: lastPart(arn), type: arn.includes(':aws:policy/') ? 'AWS managed' : 'Customer managed' })),
  ...role.value.inline.map((n: string) => ({ key: 'inline:' + n, arn: '', name: n, type: 'Customer inline' })),
] : []);

function trustedText(trust: any): string {
  const out = new Set<string>();
  for (const st of trust?.Statement || []) {
    const p = st.Principal || {};
    if (p.Service) out.add(`AWS Service: ${String(p.Service).replace('.amazonaws.com', '')}`);
    if (p.Federated) out.add(String(p.Federated).includes('oidc-provider') ? `Identity Provider: ${lastPart(p.Federated)}` : 'Identity Provider: AWSSSO');
    if (p.AWS) out.add('Account');
  }
  return [...out].join(', ') || '-';
}

const cols = [{ id: 'name', header: 'Role name', sortKey: 'name' }, { id: 'trusted', header: 'Trusted entities' }, { id: 'lastActivity', header: 'Last activity' }];
const polCols = [{ id: 'name', header: 'Policy name', sortKey: 'name' }, { id: 'type', header: 'Type' }, { id: 'attachments', header: 'Attached entities' }];
const permCols = [{ id: 'name', header: 'Policy name' }, { id: 'type', header: 'Type' }];

const form = reactive({ trust: 'service', service: 'ec2.amazonaws.com', provider: '', sub: '', doc: '', name: '', policies: [] as string[] });
function seedTrust() {
  let doc: any;
  if (form.trust === 'service') {
    doc = { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: form.service }, Action: 'sts:AssumeRole' }] };
  } else if (form.trust === 'web') {
    const host = form.provider.split('oidc-provider/')[1] || 'token.actions.githubusercontent.com';
    doc = { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Federated: form.provider || `arn:aws:iam::${ctx.account.value}:oidc-provider/${host}` },
      Action: 'sts:AssumeRoleWithWebIdentity', Condition: { StringEquals: { [`${host}:aud`]: 'sts.amazonaws.com' },
        StringLike: { [`${host}:sub`]: form.sub || 'repo:acme-pay/platform:*' } } }] };
  } else {
    doc = { Version: '2012-10-17', Statement: [{ Sid: 'Statement1', Effect: 'Allow', Principal: {}, Action: 'sts:AssumeRole' }] };
  }
  form.doc = pretty(doc);
}
seedTrust();
const docProblem = computed(() => parseDoc(form.doc)[1]);
const nameProblem = computed(() => {
  if (!form.name) return '';
  if (!/^[\w+=,.@-]{1,64}$/.test(form.name)) return 'Use alphanumeric and \'+=,.@-_\' characters. Maximum 64 characters.';
  return roles.value.some(r => r.name.toLowerCase() === form.name.toLowerCase()) ? `A role named ${form.name} already exists.` : '';
});
async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'create-role'], {
    '--role-name': form.name, '--assume-role-policy-document': JSON.stringify(JSON.parse(form.doc)),
  }));
  let ok = result.ok;
  for (const arn of ok ? form.policies : []) {
    const attached = await ctx.run(cli(['aws', 'iam', 'attach-role-policy'], { '--role-name': form.name, '--policy-arn': arn }));
    ok = ok && attached.ok;
  }
  busy.value = false;
  if (result.ok) { ctx.api.notify('success', `Role ${form.name} created.`); ctx.to('iam', 'role', { name: form.name }); }
}
function addPerm(action: string) {
  if (action === 'attach') attaching.value = true;
  if (action === 'inline') { inline.name = ''; inline.doc = pretty({ Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: [], Resource: '*' }] }); inlining.value = true; }
}
async function attach(arns: string[]) {
  busy.value = true;
  let ok = true;
  for (const arn of arns) {
    const result = await ctx.run(cli(['aws', 'iam', 'attach-role-policy'], { '--role-name': role.value.name, '--policy-arn': arn }));
    ok = ok && result.ok;
  }
  busy.value = false;
  if (ok) { ctx.api.notify('success', `Policy was successfully attached to role ${role.value.name}.`); attaching.value = false; }
}
async function removePerms() {
  busy.value = true;
  for (const key of permSel.value) {
    const command = key.startsWith('inline:')
      ? cli(['aws', 'iam', 'delete-role-policy'], { '--role-name': role.value.name, '--policy-name': key.slice(7) })
      : cli(['aws', 'iam', 'detach-role-policy'], { '--role-name': role.value.name, '--policy-arn': key });
    await ctx.run(command, `Policy ${lastPart(key.replace('inline:', ''))} removed from ${role.value.name}.`);
  }
  busy.value = false;
  permSel.value = [];
}
function editTrust() { trustDoc.value = pretty(role.value.trust); trustEditing.value = true; }
async function saveTrust() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'update-assume-role-policy'], {
    '--role-name': role.value.name, '--policy-document': JSON.stringify(JSON.parse(trustDoc.value)),
  }), `Trust policy updated for ${role.value.name}.`);
  busy.value = false;
  if (result.ok) trustEditing.value = false;
}
async function putInline() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'put-role-policy'], {
    '--role-name': role.value.name, '--policy-name': inline.name.trim(), '--policy-document': JSON.stringify(JSON.parse(inline.doc)),
  }), `Policy ${inline.name} created.`);
  busy.value = false;
  if (result.ok) inlining.value = false;
}
async function remove() {
  busy.value = true;
  const name = deleting.value;
  const result = await ctx.run(cli(['aws', 'iam', 'delete-role'], { '--role-name': name }), `Role ${name} deleted.`);
  busy.value = false;
  deleting.value = '';
  if (result.ok) { sel.value = []; if (page.value === 'role') ctx.to('iam', 'roles'); }
}
</script>

<style scoped>
.ir__p { margin: 0; }
.ir__json { min-height: 260px; }
</style>
