<template>
  <div v-if="page === 'dashboard'">
    <CsHeader title="Dashboard" />
    <div v-if="ct.drift?.length" class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
      <div><strong>Your landing zone has drifted</strong>{{ ct.drift.length }} drift item(s) found. Repair your landing zone to resolve drift.
        <button type="button" class="cs-btn ct__inline" :disabled="busy" @click="reset">Reset</button></div></div>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Landing zone" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Status</dt><dd><CsStatus :type="ct.status === 'ACTIVE' ? 'success' : 'warning'" :label="ct.status === 'ACTIVE' ? 'Available' : ct.status" /></dd></div>
        <div><dt>Landing zone version</dt><dd>{{ ct.version }}</dd></div>
        <div><dt>Drift status</dt><dd><CsStatus :type="ct.drift?.length ? 'error' : 'success'" :label="ct.drift?.length ? 'Drifted' : 'In sync'" /></dd></div>
        <div><dt>Home Region</dt><dd>{{ ct.home }}</dd></div>
      </dl></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Drift" :level="2" /></div>
      <div class="cs-container__body cs-scroll-x"><table class="cs-table-mini"><thead><tr><th>Type</th><th>Resource</th><th>Detail</th></tr></thead>
        <tbody><tr v-for="(d, i) in ct.drift" :key="i"><td>{{ d.type }}</td><td>{{ d.account }}</td><td>{{ d.detail }}</td></tr>
          <tr v-if="!ct.drift?.length"><td colspan="3" class="cs-empty">No drift detected</td></tr></tbody></table></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Environment summary" :level="2" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Registered OUs</dt><dd>{{ governed.length }}</dd></div><div><dt>Enrolled accounts</dt><dd>{{ accounts.filter(a => a.enrolled).length }}</dd></div>
        <div><dt>Enabled controls</dt><dd>{{ ct.controls?.length || 0 }}</dd></div><div><dt>Accounts vended</dt><dd>{{ ct.factory?.length || 0 }}</dd></div>
      </dl></div>
    </section>
  </div>

  <div v-else-if="page === 'organization'">
    <CsTable variant="full-page" title="Organization" :items="orgRows" :columns="orgCols" track-by="id" filter-placeholder="Find organizational units and accounts">
      <template #cell-state="{ row }"><CsStatus :type="row.ok ? 'success' : 'warning'" :label="row.state" /></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'factory'">
    <CsHeader title="Account factory" description="Provision a new account. The account is created in the organization, enrolled in AWS Control Tower, and governed by the controls of its OU." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Create account" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-grid-2">
          <div class="cs-field"><label class="cs-label">Account name</label><input v-model="fa.name" class="cs-input" placeholder="payments-dev" /></div>
          <div class="cs-field"><label class="cs-label">Account email</label><input v-model="fa.email" class="cs-input" placeholder="aws+payments-dev@acmepay.example" /></div>
          <div class="cs-field"><label class="cs-label">Organizational unit</label>
            <select v-model="fa.ou" class="cs-select"><option v-for="o in governed" :key="o.id" :value="o.name">{{ o.name }} ({{ o.id }})</option></select>
            <span class="cs-constraint">Only OUs registered with AWS Control Tower.</span></div>
          <div class="cs-field"><label class="cs-label">IAM Identity Center user email</label><input v-model="fa.ssoEmail" class="cs-input" placeholder="ops.engineer@acmepay.example" /></div>
          <div class="cs-field"><label class="cs-label">First name</label><input v-model="fa.first" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label">Last name</label><input v-model="fa.last" class="cs-input" /></div>
        </div>
      </div>
    </section>
    <div class="cs-form-actions"><button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !factoryReady" @click="vend">Create account</button></div>
    <CsTable title="Accounts provisioned by Account Factory" :items="ct.factory || []" :columns="facCols" track-by="name" empty-title="No accounts provisioned" />
  </div>

  <div v-else-if="page === 'controls'">
    <CsTable variant="full-page" title="All controls" :items="catalogue" :columns="ctlCols" track-by="id" selection-type="single" v-model:selected="sel"
             description="Controls are high-level rules that provide ongoing governance. Preventive controls are enforced by an SCP; detective controls report.">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" :disabled="!sel.length" @click="openEnable">Enable control on OU</button></template>
      <template #cell-behavior="{ row }">{{ row.kind.charAt(0).toUpperCase() + row.kind.slice(1) }}</template>
    </CsTable>
    <CsTable class="ct__space" title="Enabled controls" :items="enabled" :columns="enCols" track-by="key" selection-type="single" v-model:selected="enSel"
             empty-title="No controls enabled">
      <template #actions><button type="button" class="cs-btn" :disabled="!enSel.length || busy" @click="disable">Disable control</button></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'settings'">
    <CsHeader title="Landing zone settings" />
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Version</dt><dd>{{ ct.version }}</dd></div><div><dt>Home Region</dt><dd>{{ ct.home }}</dd></div>
      <div><dt>Governed Regions</dt><dd>{{ (ct.regions || []).join(', ') }}</dd></div>
    </dl></div></section>
    <div class="cs-form-actions"><button type="button" class="cs-btn" :disabled="busy" @click="reset">Reset landing zone</button></div>
  </div>

  <CsModal v-if="enabling" title="Enable control on OU" @close="enabling = false">
    <div class="cs-stack">
      <p class="ct__p"><strong>{{ selectedControl?.title }}</strong> ({{ selectedControl?.id }})</p>
      <div class="cs-field"><label class="cs-label">Organizational unit</label>
        <select v-model="enableOu" class="cs-select"><option v-for="o in governed" :key="o.id" :value="o.id">{{ o.name }}</option></select></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="enabling = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !enableOu" @click="enable">Enable control on OU</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const ct = computed<any>(() => pick(ctx.c.value, 'org.ct', {}));
const org = computed<any>(() => pick(ctx.c.value, 'org', {}));
const ous = computed(() => rows<any>(ctx.c.value, 'org.ous'));
const accounts = computed(() => rows<any>(ctx.c.value, 'org.accounts'));
const governed = computed(() => ous.value.filter(o => o.governed));
const sel = ref<string[]>([]);
const enSel = ref<string[]>([]);
const busy = ref(false);
const enabling = ref(false);
const enableOu = ref('');

const catalogue = computed(() => rows<any>(ct.value, 'catalogue').map(x => ({ ...x, implementation: x.kind === 'preventive' ? 'Service control policy' : x.kind === 'detective' ? 'AWS Config rule' : 'CloudFormation hook' })));
const selectedControl = computed<any>(() => catalogue.value.find(x => x.id === sel.value[0]) || null);
const enabled = computed(() => rows<any>(ct.value, 'controls').map(x => ({ ...x, key: `${x.control}|${x.target}`,
  ou: ous.value.find(o => o.id === x.target)?.name || x.target, title: catalogue.value.find(c => c.id === x.control)?.title || '' })));
const orgRows = computed(() => [
  ...ous.value.map(o => ({ id: o.id, name: o.name, type: 'Organizational unit', state: o.governed ? 'Registered' : 'Not registered', ok: o.governed,
    parent: o.parent === org.value.root ? 'Root' : ous.value.find(x => x.id === o.parent)?.name || o.parent })),
  ...accounts.value.map(a => ({ id: a.id, name: a.name, type: 'Account', state: a.enrolled ? (governed.value.some(o => o.id === a.parent) ? 'Enrolled' : 'Enrolled - drifted') : 'Not enrolled',
    ok: a.enrolled && governed.value.some(o => o.id === a.parent), parent: ous.value.find(x => x.id === a.parent)?.name || 'Root' })),
]);
const orgCols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'type', header: 'Object type' }, { id: 'state', header: 'State' },
  { id: 'parent', header: 'Parent OU' }, { id: 'id', header: 'ID' }];
const facCols = [{ id: 'name', header: 'Provisioned product name' }, { id: 'account', header: 'Account ID' }, { id: 'ou', header: 'Organizational unit' },
  { id: 'time', header: 'Created (shift time)' }];
const ctlCols = [{ id: 'title', header: 'Name', sortKey: 'title' }, { id: 'id', header: 'Control ID' }, { id: 'behavior', header: 'Behavior' },
  { id: 'implementation', header: 'Implementation' }];
const enCols = [{ id: 'control', header: 'Control ID' }, { id: 'title', header: 'Name' }, { id: 'ou', header: 'Organizational unit' }, { id: 'kind', header: 'Behavior' }];

function ouArn(id: string) { return `arn:aws:organizations::${org.value.mgmt}:ou/${org.value.id}/${id}`; }
function controlArn(id: string) { return `arn:aws:controltower:${ctx.home.value}::control/${id}`; }
function openEnable() { enableOu.value = governed.value.find(o => o.name === 'Prod')?.id || governed.value[0]?.id || ''; enabling.value = true; }
async function enable() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'controltower', 'enable-control'], {
    '--control-identifier': controlArn(selectedControl.value.id), '--target-identifier': ouArn(enableOu.value),
  }), `Control ${selectedControl.value.id} is enabled on the OU.`);
  busy.value = false;
  if (result.ok) enabling.value = false;
}
async function disable() {
  const x = enabled.value.find(e => e.key === enSel.value[0]);
  if (!x) return;
  busy.value = true;
  await ctx.run(cli(['aws', 'controltower', 'disable-control'], { '--control-identifier': controlArn(x.control), '--target-identifier': ouArn(x.target) }),
    `Control ${x.control} disabled on ${x.ou}.`);
  busy.value = false;
  enSel.value = [];
}
async function reset() {
  busy.value = true;
  await ctx.run(cli(['aws', 'controltower', 'reset-landing-zone']), 'Your landing zone is being repaired. Drift is resolved.');
  busy.value = false;
}
const fa = reactive({ name: '', email: '', ou: '', ssoEmail: 'ops.engineer@acmepay.example', first: 'Ops', last: 'Engineer' });
const factoryReady = computed(() => fa.name.trim() && /@/.test(fa.email) && fa.ou && /@/.test(fa.ssoEmail) && fa.first.trim() && fa.last.trim());
async function vend() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'servicecatalog', 'provision-product'], {
    '--product-name': 'AWS Control Tower Account Factory', '--provisioned-product-name': fa.name.trim(),
    '--provisioning-parameters': [`Key=AccountName,Value=${fa.name.trim()}`, `Key=AccountEmail,Value=${fa.email.trim()}`,
      `Key=ManagedOrganizationalUnit,Value=${fa.ou}`, `Key=SSOUserEmail,Value=${fa.ssoEmail.trim()}`,
      `Key=SSOUserFirstName,Value=${fa.first.trim()}`, `Key=SSOUserLastName,Value=${fa.last.trim()}`],
  }), `Account ${fa.name} is being created and enrolled.`);
  busy.value = false;
  if (result.ok) fa.name = '';
}
</script>

<style scoped>
.ct__inline { margin-left: 8px; }
.ct__space { margin-top: 20px; }
.ct__p { margin: 0; }
</style>
