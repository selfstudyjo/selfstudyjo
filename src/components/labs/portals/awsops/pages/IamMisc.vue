<template>
  <!-- Dashboard -->
  <div v-if="page === 'dashboard'">
    <CsHeader title="IAM Dashboard" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Security recommendations" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div v-for="rec in recommendations" :key="rec.text" class="im__rec">
          <CsStatus :type="rec.ok ? 'success' : 'warning'" :label="rec.text" />
          <span class="cs-muted">{{ rec.detail }}</span>
        </div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="IAM resources" :level="2" /></div>
      <div class="cs-container__body im__res">
        <a href="#" @click.prevent="ctx.to('iam', 'users')"><span class="cs-link">Users</span><strong>{{ users.length }}</strong></a>
        <a href="#" @click.prevent="ctx.to('iam', 'roles')"><span class="cs-link">Roles</span><strong>{{ rows<any>(ctx.c.value, 'iam.roles').length }}</strong></a>
        <a href="#" @click.prevent="ctx.to('iam', 'policies')"><span class="cs-link">Customer managed policies</span><strong>{{ rows<any>(ctx.c.value, 'iam.policies').filter(p => !p.aws).length }}</strong></a>
        <a href="#" @click.prevent="ctx.to('iam', 'idp')"><span class="cs-link">Identity providers</span><strong>{{ providers.length }}</strong></a>
      </div>
    </section>
  </div>

  <!-- Identity providers -->
  <div v-else-if="page === 'idp'">
    <CsTable variant="full-page" title="Identity providers" :items="providers" :columns="idpCols" track-by="arn" selection-type="single" v-model:selected="sel"
             description="Use an identity provider (IdP) to manage your user identities outside of AWS but grant the user identities permissions to use AWS resources in your account."
             empty-title="No resources to display">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = sel[0]">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="adding = true">Add provider</button>
      </template>
    </CsTable>
  </div>

  <!-- Account settings -->
  <div v-else-if="page === 'settings'">
    <CsHeader title="Account settings" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Password policy" :level="2" description="The password policy sets the requirements for IAM user passwords.">
        <template #actions><button type="button" class="cs-btn" @click="openPolicy">Edit</button></template></CsHeader></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Password minimum length</dt><dd>{{ pp.min || 8 }} characters</dd></div>
        <div><dt>Prevent password reuse</dt><dd>{{ pp.reuse ? `Remember last ${pp.reuse} passwords` : 'Not enforced' }}</dd></div>
        <div><dt>Policy</dt><dd>{{ pp.min ? 'Custom' : 'IAM default' }}</dd></div>
      </dl></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Root user" :level="2" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>MFA</dt><dd><CsStatus :type="root.mfa ? 'success' : 'error'" :label="root.mfa ? 'Assigned' : 'Not assigned'" /></dd></div>
        <div><dt>Access keys</dt><dd><CsStatus :type="root.keys ? 'error' : 'success'" :label="root.keys ? `${root.keys} active` : 'None'" /></dd></div>
      </dl>
      <p class="cs-muted im__note">Root user MFA and access keys are managed by signing in as the root user (in this lab: <code>ops console root-enable-mfa</code> and <code>ops console root-delete-access-key</code>).</p></div>
    </section>
  </div>

  <!-- Credential report -->
  <div v-else-if="page === 'report'">
    <CsHeader title="Credential report" description="A credential report lists all users in your account and the status of their various credentials. The report can be generated as often as once every four hours.">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="download"><span v-if="busy" class="cs-btn__spinner" /><CsIcon name="download" /> Download credentials report</button></template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__body">
        <p v-if="!report.length" class="cs-muted im__p">{{ generated ? `A report was generated at ${reportTime}.` : 'No credential report has been generated yet.' }} Download the report to see it here.</p>
        <div v-else class="cs-scroll-x"><table class="cs-table-mini"><thead><tr><th v-for="h in report[0]" :key="h">{{ h }}</th></tr></thead>
          <tbody><tr v-for="(r, i) in report.slice(1)" :key="i"><td v-for="(cell, j) in r" :key="j">{{ cell }}</td></tr></tbody></table></div>
      </div>
    </section>
  </div>

  <!-- Policy simulator -->
  <div v-else-if="page === 'simulator'">
    <CsHeader title="IAM Policy Simulator" description="Test the identity policies attached to a user or role - and the service control policies of this account - against API actions." />
    <section class="cs-container">
      <div class="cs-container__body cs-stack">
        <div class="cs-grid-2">
          <div class="cs-field"><label class="cs-label">Users, Groups, and Roles</label>
            <select v-model="sim.principal" class="cs-select">
              <optgroup label="Users"><option v-for="u in users" :key="u.arn" :value="u.arn">{{ u.name }}</option></optgroup>
              <optgroup label="Roles"><option v-for="r in rows<any>(ctx.c.value, 'iam.roles')" :key="r.arn" :value="r.arn">{{ r.name }}</option></optgroup>
            </select></div>
          <div class="cs-field"><label class="cs-label">Actions</label><input v-model="sim.actions" class="cs-input" placeholder="ec2:RunInstances, iam:CreateUser" />
            <span class="cs-constraint">Comma-separated service:action names.</span></div>
        </div>
        <div class="cs-row"><button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !sim.actions.trim()" @click="simulate">Run Simulation</button></div>
      </div>
    </section>
    <section v-if="simRows.length" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Action Settings and Results (${simRows.length})`" :level="2" /></div>
      <div class="cs-container__body cs-scroll-x"><table class="cs-table-mini"><thead><tr><th>Action</th><th>Resource</th><th>Permission</th><th>Matched statement</th><th>Organizations</th></tr></thead>
        <tbody><tr v-for="r in simRows" :key="r.EvalActionName"><td>{{ r.EvalActionName }}</td><td>{{ r.EvalResourceName }}</td>
          <td><CsStatus :type="r.EvalDecision === 'allowed' ? 'success' : 'error'" :label="r.EvalDecision === 'allowed' ? 'allowed' : 'denied (' + r.EvalDecision + ')'" /></td>
          <td>{{ (r.MatchedStatements || []).join('; ') }}</td><td>{{ r.OrganizationsDecisionDetail?.AllowedByOrganizations ? 'Allowed' : 'Denied by an SCP' }}</td></tr></tbody></table></div>
    </section>
  </div>

  <CsModal v-if="adding" title="Add an Identity provider" size="large" @close="adding = false">
    <div class="cs-stack">
      <div class="cs-tiles"><label class="cs-tile"><input type="radio" disabled /><span><strong>SAML</strong><small>Establish trust between your AWS account and a SAML 2.0 compatible Identity Provider.</small></span></label>
        <label class="cs-tile is-checked"><input type="radio" checked /><span><strong>OpenID Connect</strong><small>Establish trust between your AWS account and Identity Provider services, such as Google or Salesforce.</small></span></label></div>
      <div class="cs-field"><label class="cs-label">Provider URL</label><input v-model="idp.url" class="cs-input" placeholder="https://token.actions.githubusercontent.com" />
        <span v-if="idp.url && !idp.url.startsWith('https://')" class="cs-error-text">The provider URL must begin with https://</span></div>
      <div class="cs-field"><label class="cs-label">Audience</label><input v-model="idp.audience" class="cs-input" placeholder="sts.amazonaws.com" /></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="adding = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !idp.url.startsWith('https://') || !idp.audience.trim()" @click="addProvider">Add provider</button>
    </template>
  </CsModal>

  <CsModal v-if="editingPolicy" title="Edit password policy" @close="editingPolicy = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Password minimum length</label><input v-model="ppForm.min" class="cs-input im__narrow" inputmode="numeric" /><span class="cs-constraint">Needs to be between 6 and 128.</span></div>
      <div class="cs-field"><label class="cs-label">Prevent password reuse</label><input v-model="ppForm.reuse" class="cs-input im__narrow" inputmode="numeric" /><span class="cs-constraint">Remember up to 24 previous passwords.</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="editingPolicy = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !/^\d+$/.test(ppForm.min) || !/^\d+$/.test(ppForm.reuse)" @click="savePolicy">Save changes</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete identity provider" word="confirm" :busy="busy" @close="deleting = ''" @confirm="removeProvider">
    <p class="im__p">Roles that trust <span class="cs-mono">{{ deleting }}</span> can no longer be assumed with its tokens.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, parseJson, pick, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const busy = ref(false);
const adding = ref(false);
const deleting = ref('');
const editingPolicy = ref(false);
const report = ref<string[][]>([]);
const simRows = ref<any[]>([]);

const users = computed(() => rows<any>(ctx.c.value, 'iam.users'));
const providers = computed(() => rows<any>(ctx.c.value, 'iam.oidc').map(p => ({ ...p, provider: p.url.replace('https://', ''), type: 'OpenID Connect', aud: p.clients.join(', ') })));
const root = computed<any>(() => pick(ctx.c.value, 'iam.root', {}));
const pp = computed<any>(() => pick(ctx.c.value, 'iam.password_policy', {}));
const generated = computed(() => Boolean(pick(ctx.c.value, 'iam.report_generated', false)));
const reportTime = computed(() => String(pick(ctx.c.value, 'iam.report_time', '')));
const recommendations = computed(() => [
  { ok: Boolean(root.value.mfa), text: root.value.mfa ? 'Root user has MFA' : 'Add MFA for root user', detail: 'Add MFA for the root user - enable multi-factor authentication (MFA) for the root user to improve security for this account.' },
  { ok: !root.value.keys, text: root.value.keys ? 'Root user has active access keys' : 'Root user has no active access keys', detail: 'Using access keys attached to an IAM user instead of the root user improves security.' },
  { ok: !users.value.some(u => u.keys.some((k: any) => k.status === 'Active' && k.age > 90)), text: 'Rotate access keys older than 90 days', detail: 'Rotate long-lived access keys, or replace them with roles.' },
]);
const idpCols = [{ id: 'provider', header: 'Provider' }, { id: 'type', header: 'Type' }, { id: 'aud', header: 'Audience' }, { id: 'arn', header: 'ARN' }];

const idp = reactive({ url: 'https://token.actions.githubusercontent.com', audience: 'sts.amazonaws.com' });
async function addProvider() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'create-open-id-connect-provider'], {
    '--url': idp.url.trim(), '--client-id-list': idp.audience.split(',').map(s => s.trim()).filter(Boolean),
  }), `Provider ${idp.url.replace('https://', '')} added.`);
  busy.value = false;
  if (result.ok) adding.value = false;
}
async function removeProvider() {
  busy.value = true;
  const arn = deleting.value;
  const result = await ctx.run(cli(['aws', 'iam', 'delete-open-id-connect-provider'], { '--open-id-connect-provider-arn': arn }), 'Identity provider deleted.');
  busy.value = false;
  deleting.value = '';
  if (result.ok) sel.value = [];
}
const ppForm = reactive({ min: '8', reuse: '0' });
function openPolicy() { ppForm.min = String(pp.value.min || 8); ppForm.reuse = String(pp.value.reuse || 0); editingPolicy.value = true; }
async function savePolicy() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'update-account-password-policy'], {
    '--minimum-password-length': ppForm.min, '--password-reuse-prevention': ppForm.reuse === '0' ? '' : ppForm.reuse,
  }), 'Password policy updated.');
  busy.value = false;
  if (result.ok) editingPolicy.value = false;
}
async function download() {
  busy.value = true;
  if (!generated.value) await ctx.run(cli(['aws', 'iam', 'generate-credential-report']));
  const result = await ctx.run(cli(['aws', 'iam', 'get-credential-report'], { '--output': 'text' }), '', { quiet: false });
  busy.value = false;
  if (result.ok) report.value = String(result.output || '').trim().split('\n').map(line => line.split(','));
}
const sim = reactive({ principal: '', actions: '' });
if (!sim.principal && users.value[0]) sim.principal = users.value[0].arn;
async function simulate() {
  busy.value = true;
  const actions = sim.actions.split(/[,\s]+/).filter(Boolean);
  const result = await ctx.run(cli(['aws', 'iam', 'simulate-principal-policy'], { '--policy-source-arn': sim.principal, '--action-names': actions }));
  busy.value = false;
  if (result.ok) simRows.value = parseJson<any>(result.output)?.EvaluationResults || [];
}
</script>

<style scoped>
.im__rec { display: flex; flex-direction: column; gap: 2px; padding-bottom: 8px; border-bottom: 1px solid #ebebf0; }
.im__res { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 12px; }
.im__res a { display: flex; justify-content: space-between; padding: 10px 14px; border: 1px solid #ebebf0; border-radius: 8px; text-decoration: none; }
.im__res strong { color: #0f141a; }
.im__p { margin: 0; }
.im__note { margin: 12px 0 0; font-size: 12px; }
.im__note code { font-family: Monaco, Menlo, Consolas, monospace; background: #ebebf0; color: #0f141a; padding: 0 4px; border-radius: 4px; }
.im__narrow { width: 140px; }
</style>
