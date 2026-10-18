<template>
  <div v-if="page === 'dashboard'">
    <CsHeader title="Dashboard" />
    <div v-if="!cfg.recording" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
      <div><strong>Recording is off</strong>AWS Config is not recording, so no rule is evaluated. <button type="button" class="cs-link" @click="ctx.to('config', 'settings')">Settings</button></div></div>
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Compliant rules</dt><dd class="cf__big cf__ok">{{ rules.filter(r => r.status === 'COMPLIANT').length }}</dd></div>
      <div><dt>Noncompliant rules</dt><dd class="cf__big cf__bad">{{ rules.filter(r => r.status === 'NON_COMPLIANT').length }}</dd></div>
      <div><dt>Noncompliant resources</dt><dd class="cf__big">{{ rules.reduce((n, r) => n + r.results.filter((x: any) => !x.compliant).length, 0) }}</dd></div>
    </dl></div></section>
  </div>

  <div v-else-if="page === 'settings'">
    <CsHeader title="Settings" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Recorder" :level="2"><template #actions>
        <button type="button" class="cs-btn" :disabled="busy || !cfg.recorder?.name" @click="toggleRecording">{{ cfg.recording ? 'Stop recording' : 'Start recording' }}</button>
        <button type="button" class="cs-btn" @click="editing = true">Edit</button></template></CsHeader></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Recording is</dt><dd><CsStatus :type="cfg.recording ? 'success' : 'stopped'" :label="cfg.recording ? 'On' : 'Off'" /></dd></div>
        <div><dt>Recorder name</dt><dd>{{ cfg.recorder?.name || '-' }}</dd></div>
        <div><dt>IAM role</dt><dd class="cs-mono">{{ cfg.recorder?.role || '-' }}</dd></div>
        <div><dt>Resource types</dt><dd>{{ cfg.recorder?.name ? (cfg.recorder.all ? 'All supported resource types' : 'Specific types') + (cfg.recorder.global ? ', including global resources' : '') : '-' }}</dd></div>
        <div><dt>Delivery channel - S3 bucket</dt><dd>{{ cfg.channel?.bucket || '-' }}</dd></div>
      </dl></div>
    </section>
  </div>

  <div v-else-if="page === 'rules'">
    <CsTable variant="full-page" title="Rules" :items="rules" :columns="ruleCols" track-by="name" selection-type="single" v-model:selected="sel" empty-title="No rules">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = sel[0]">Delete rule</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="adding = true">Add rule</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('config', 'rule', { name: row.name })">{{ row.name }}</a></template>
      <template #cell-status="{ row }"><CsStatus :type="statusKind(row.status)" :label="statusLabel(row)" /></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'rule' && rule">
    <CsHeader :title="rule.name"><template #actions>
      <button type="button" class="cs-btn" @click="openRemediation">Manage remediation</button></template></CsHeader>
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Compliance</dt><dd><CsStatus :type="statusKind(rule.status)" :label="statusLabel(rule)" /></dd></div>
      <div><dt>Source</dt><dd>AWS managed: {{ rule.source }}</dd></div>
      <div><dt>Parameters</dt><dd class="cs-mono">{{ JSON.stringify(rule.params) }}</dd></div>
      <div><dt>Remediation action</dt><dd>{{ rule.remediation ? `${rule.remediation.target}${rule.remediation.automatic ? ' (automatic)' : ' (manual)'}` : 'Not set' }}</dd></div>
    </dl></div></section>
    <CsTable title="Resources in scope" :items="rule.results.map((r: any) => ({ ...r, key: r.type + r.id }))" :columns="resCols" track-by="key" selection-type="multi" v-model:selected="resSel"
             empty-title="No resources evaluated" :empty-text="cfg.recording ? '' : 'Start recording to evaluate this rule.'">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" :disabled="!resSel.length || !rule.remediation || busy" @click="remediate">Remediate</button></template>
      <template #cell-compliant="{ row }"><CsStatus :type="row.compliant ? 'success' : 'error'" :label="row.compliant ? 'Compliant' : 'Noncompliant'" /></template>
    </CsTable>
  </div>

  <CsModal v-if="editing" title="Edit recorder" size="large" @close="editing = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Recorder name</label><input v-model="rec.name" class="cs-input" /></div>
      <label class="cs-check"><input v-model="rec.all" type="checkbox" /><span>Record all resource types supported in this Region</span></label>
      <label class="cs-check"><input v-model="rec.global" type="checkbox" /><span>Include globally recorded resource types (IAM)</span></label>
      <div class="cs-field"><label class="cs-label">IAM role</label><input v-model="rec.role" class="cs-input cs-mono" /></div>
      <div class="cs-field"><label class="cs-label">Delivery channel - Amazon S3 bucket</label><select v-model="rec.bucket" class="cs-select"><option v-for="b in buckets" :key="b.name" :value="b.name">{{ b.name }}</option></select></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="editing = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !rec.name || !rec.role" @click="saveRecorder">Save</button>
    </template>
  </CsModal>

  <CsModal v-if="adding" title="Add rule" size="large" @close="adding = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">AWS managed rule</label><select v-model="nr.source" class="cs-select"><option v-for="m in managed" :key="m" :value="m">{{ m }}</option></select></div>
      <div class="cs-field"><label class="cs-label">Name</label><input v-model="nr.name" class="cs-input" placeholder="restricted-common-ports" /></div>
      <div class="cs-field"><label class="cs-label">Parameters (JSON) <small>- optional</small></label><textarea v-model="nr.params" class="cs-textarea cs-mono" placeholder='{"blockedPort1": "3389"}' />
        <span v-if="paramsProblem" class="cs-error-text">{{ paramsProblem }}</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="adding = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !nr.name.trim() || !!paramsProblem" @click="addRule">Save</button>
    </template>
  </CsModal>

  <CsModal v-if="remFor" title="Manage remediation" @close="remFor = null">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Remediation action</label><select v-model="rem.target" class="cs-select">
        <option>AWS-DisablePublicAccessForSecurityGroup</option><option>AWSConfigRemediation-ConfigureS3BucketPublicAccessBlock</option></select></div>
      <label class="cs-radio"><input v-model="rem.automatic" type="radio" :value="false" /> Manual remediation</label>
      <label class="cs-radio"><input v-model="rem.automatic" type="radio" :value="true" /> Automatic remediation</label>
    </div>
    <template #footer>
      <button v-if="rule?.remediation" type="button" class="cs-btn" :disabled="busy" @click="deleteRemediation">Delete remediation</button>
      <button type="button" class="cs-btn cs-btn--link" @click="remFor = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveRemediation">Save changes</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete rule" :word="deleting" :busy="busy" @close="deleting = ''" @confirm="removeRule">
    <p class="cf__p">A rule with a remediation configuration cannot be deleted until the remediation is removed.</p>
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
import { parseJson as parseDoc } from '../kit';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const resSel = ref<string[]>([]);
const busy = ref(false);
const editing = ref(false);
const adding = ref(false);
const deleting = ref('');
const remFor = ref<any>(null);

const cfg = computed<any>(() => pick(ctx.c.value, 'security.config', { rules: [] }));
const rules = computed(() => rows<any>(cfg.value, 'rules'));
const rule = computed<any>(() => rules.value.find(r => r.name === ctx.route.value.params?.name) || null);
const managed = computed<string[]>(() => pick(cfg.value, 'managed_rules', []));
const buckets = computed(() => rows<any>(ctx.c.value, 's3.buckets'));
function statusKind(s: string) { return s === 'COMPLIANT' ? 'success' : s === 'NON_COMPLIANT' ? 'error' : 'stopped'; }
function statusLabel(r: any) {
  if (r.status === 'COMPLIANT') return 'Compliant';
  if (r.status === 'NON_COMPLIANT') return `${r.results.filter((x: any) => !x.compliant).length} Noncompliant resource(s)`;
  return 'No results reported';
}
const ruleCols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'remediation', header: 'Remediation action', cell: (r: any) => (r.remediation ? r.remediation.target : 'Not set') },
  { id: 'status', header: 'Compliance' }, { id: 'source', header: 'Type', cell: () => 'AWS managed' }];
const resCols = [{ id: 'id', header: 'ID' }, { id: 'type', header: 'Type' }, { id: 'compliant', header: 'Compliance' }];

const rec = reactive({ name: 'default', all: true, global: true, role: `arn:aws:iam::${ctx.account.value}:role/aws-service-role/config.amazonaws.com/AWSServiceRoleForConfig`, bucket: 'acme-cloudtrail-logs' });
async function saveRecorder() {
  busy.value = true;
  let result = await ctx.run(cli(['aws', 'configservice', 'put-configuration-recorder'], {
    '--configuration-recorder': `name=${rec.name},roleARN=${rec.role}`, '--recording-group': `allSupported=${rec.all},includeGlobalResourceTypes=${rec.global}` }));
  if (result.ok) result = await ctx.run(cli(['aws', 'configservice', 'put-delivery-channel'], { '--delivery-channel': `name=default,s3BucketName=${rec.bucket}` }), 'Recorder and delivery channel saved.');
  busy.value = false;
  if (result.ok) editing.value = false;
}
async function toggleRecording() {
  busy.value = true;
  const verb = cfg.value.recording ? 'stop' : 'start';
  await ctx.run(cli(['aws', 'configservice', `${verb}-configuration-recorder`], { '--configuration-recorder-name': cfg.value.recorder.name }),
    `Recording ${verb === 'start' ? 'started' : 'stopped'}.`);
  busy.value = false;
}
const nr = reactive({ source: 'RESTRICTED_INCOMING_TRAFFIC', name: '', params: '' });
const paramsProblem = computed(() => (nr.params.trim() ? parseDoc(nr.params)[1] : ''));
async function addRule() {
  busy.value = true;
  const body: Record<string, unknown> = { ConfigRuleName: nr.name.trim(), Source: { Owner: 'AWS', SourceIdentifier: nr.source } };
  if (nr.params.trim()) body.InputParameters = JSON.stringify(JSON.parse(nr.params));
  const result = await ctx.run(cli(['aws', 'configservice', 'put-config-rule'], { '--config-rule': JSON.stringify(body) }), `Rule ${nr.name} added.`);
  busy.value = false;
  if (result.ok) adding.value = false;
}
const rem = reactive({ target: 'AWS-DisablePublicAccessForSecurityGroup', automatic: false });
function openRemediation() {
  remFor.value = rule.value;
  rem.target = rule.value.remediation?.target || (rule.value.source.startsWith('S3') ? 'AWSConfigRemediation-ConfigureS3BucketPublicAccessBlock' : 'AWS-DisablePublicAccessForSecurityGroup');
  rem.automatic = Boolean(rule.value.remediation?.automatic);
}
async function saveRemediation() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'configservice', 'put-remediation-configurations'], {
    '--remediation-configurations': JSON.stringify([{ ConfigRuleName: rule.value.name, TargetType: 'SSM_DOCUMENT', TargetId: rem.target, Automatic: rem.automatic }]),
  }), 'Remediation action saved.');
  busy.value = false;
  if (result.ok) remFor.value = null;
}
async function deleteRemediation() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'configservice', 'delete-remediation-configuration'], { '--config-rule-name': rule.value.name }), 'Remediation action deleted.');
  busy.value = false;
  if (result.ok) remFor.value = null;
}
async function remediate() {
  busy.value = true;
  const keys = resSel.value.map(k => rule.value.results.find((r: any) => r.type + r.id === k)).filter(Boolean)
    .map((r: any) => `resourceType=${r.type},resourceId=${r.id}`);
  await ctx.run(cli(['aws', 'configservice', 'start-remediation-execution'], { '--config-rule-name': rule.value.name, '--resource-keys': keys }),
    'Remediation action executed.');
  busy.value = false;
  resSel.value = [];
}
async function removeRule() {
  busy.value = true;
  await ctx.run(cli(['aws', 'configservice', 'delete-config-rule'], { '--config-rule-name': deleting.value }), `Rule ${deleting.value} deleted.`);
  busy.value = false;
  deleting.value = '';
  sel.value = [];
}
</script>

<style scoped>
.cf__big { font-size: 28px; line-height: 34px; font-weight: 300; color: #006ce0; }
.cf__ok { color: #00802f; }
.cf__bad { color: #db0000; }
.cf__p { margin: 0; }
</style>
