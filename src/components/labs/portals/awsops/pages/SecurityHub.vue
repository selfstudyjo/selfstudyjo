<template>
  <div v-if="!hub.enabled">
    <CsHeader title="Security Hub" description="Security Hub provides you with a comprehensive view of the security state of your AWS resources." />
    <section class="cs-container"><div class="cs-container__body cs-stack">
      <p class="sh__p">Security Hub is not enabled in this account and Region.</p>
      <label class="cs-check"><input v-model="defaults" type="checkbox" /><span>Enable AWS Foundational Security Best Practices v1.0.0
        <small>Leave this off to choose the standards yourself, for example the CIS AWS Foundations Benchmark.</small></span></label>
      <div class="cs-row"><button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="enable">Enable Security Hub</button></div>
    </div></section>
  </div>

  <div v-else-if="page === 'summary'">
    <CsHeader title="Summary" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Security standards" :level="2" /></div>
      <div class="cs-container__body">
        <div v-if="!hub.standards.length" class="cs-empty"><strong>No standards enabled</strong>Nothing is being evaluated.
          <button type="button" class="cs-btn" @click="ctx.to('securityhub', 'standards')">Enable a standard</button></div>
        <div v-else class="sh__score">
          <div class="sh__ring" :style="{ background: `conic-gradient(#00802f ${hub.score * 3.6}deg, #ebebf0 0)` }"><span>{{ hub.score }}%</span></div>
          <dl class="cs-kv"><div><dt>Security score</dt><dd>{{ hub.score }}%</dd></div><div><dt>Passed controls</dt><dd>{{ controls.filter(c => c.status === 'PASSED').length }}</dd></div>
            <div><dt>Failed controls</dt><dd class="sh__bad">{{ controls.filter(c => c.status === 'FAILED').length }}</dd></div></dl>
        </div>
      </div>
    </section>
  </div>

  <div v-else-if="page === 'standards'">
    <CsHeader title="Security standards" />
    <div class="sh__cards">
      <section v-for="s in standards" :key="s.arn" class="cs-container">
        <div class="cs-container__head"><CsHeader :title="s.name" :level="2" :info="false" /></div>
        <div class="cs-container__body cs-stack"><p class="cs-muted sh__p">{{ s.text }}</p>
          <div><CsStatus v-if="hub.standards.includes(s.arn)" type="success" label="Enabled" />
            <button v-else type="button" class="cs-btn" :disabled="busy" @click="enableStandard(s.arn)">Enable</button></div></div>
      </section>
    </div>
  </div>

  <CsTable v-else-if="page === 'controls'" variant="full-page" title="Controls" :items="controls" :columns="ctlCols" track-by="id" filter-placeholder="Filter controls"
           empty-title="No controls" empty-text="Enable a security standard to evaluate controls.">
    <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('securityhub', 'control', { id: row.id })">{{ row.id }}</a></template>
    <template #cell-status="{ row }"><CsStatus :type="row.status === 'PASSED' ? 'success' : 'error'" :label="row.status === 'PASSED' ? 'Passed' : 'Failed'" /></template>
  </CsTable>

  <div v-else-if="page === 'control' && control">
    <CsHeader :title="`${control.id} ${control.title}`" />
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Status</dt><dd><CsStatus :type="control.status === 'PASSED' ? 'success' : 'error'" :label="control.status === 'PASSED' ? 'Passed' : 'Failed'" /></dd></div>
      <div><dt>Severity</dt><dd>{{ control.severity }}</dd></div><div><dt>Resource type</dt><dd>{{ control.kind }}</dd></div>
      <div><dt>Suppressed findings</dt><dd>{{ control.suppressed }}</dd></div>
    </dl></div></section>
    <FindingsTable :items="control.findings.map((f: any) => ({ ...f, control: control.id, severity: control.severity, title: control.title }))" @workflow="openWorkflow" />
  </div>

  <div v-else-if="page === 'findings'">
    <FindingsTable :items="findings" full @workflow="openWorkflow" />
  </div>

  <CsModal v-if="workflow" title="Set workflow status" @close="workflow = null">
    <div class="cs-stack">
      <p class="sh__p">{{ workflow.ids.length }} finding(s) selected.</p>
      <div class="cs-field"><label class="cs-label">Workflow status</label>
        <select v-model="wf.status" class="cs-select"><option>NEW</option><option>NOTIFIED</option><option>SUPPRESSED</option><option>RESOLVED</option></select></div>
      <div class="cs-field"><label class="cs-label">Note {{ wf.status === 'SUPPRESSED' ? '' : '- optional' }}</label><textarea v-model="wf.note" class="cs-textarea" placeholder="Why the risk is accepted, and who accepted it" />
        <span v-if="wf.status === 'SUPPRESSED'" class="cs-constraint">A suppression needs a justification of at least four words.</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="workflow = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveWorkflow">Set status</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import FindingsTable from './FindingsTable.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const busy = ref(false);
const defaults = ref(false);
const workflow = ref<any>(null);
const wf = reactive({ status: 'SUPPRESSED', note: '' });

const hub = computed<any>(() => pick(ctx.c.value, 'security.hub', { enabled: false, standards: [], score: 0 }));
const controls = computed(() => rows<any>(ctx.c.value, 'security.controls').map(c => ({ ...c, failed: c.findings.length - c.suppressed })));
const control = computed<any>(() => controls.value.find(c => c.id === ctx.route.value.params?.id) || null);
const findings = computed(() => controls.value.flatMap(c => c.findings.map((f: any) => ({ ...f, control: c.id, severity: c.severity, title: c.title }))));
const standards = computed(() => [
  { arn: hub.value.cis_arn, name: 'CIS AWS Foundations Benchmark v3.0.0', text: 'The Center for Internet Security (CIS) AWS Foundations Benchmark is a set of security configuration best practices for AWS.' },
  { arn: hub.value.fsbp_arn, name: 'AWS Foundational Security Best Practices v1.0.0', text: 'A set of controls that detect when your AWS accounts and resources deviate from security best practices.' },
]);
const ctlCols = [{ id: 'id', header: 'ID', sortKey: 'id' }, { id: 'title', header: 'Title' }, { id: 'status', header: 'Status', sortKey: 'status' },
  { id: 'severity', header: 'Severity', sortKey: 'severity' }, { id: 'failed', header: 'Failed checks' }];

async function enable() {
  busy.value = true;
  await ctx.run(cli(['aws', 'securityhub', 'enable-security-hub'], { '--enable-default-standards': defaults.value, '--no-enable-default-standards': !defaults.value }),
    'Security Hub is enabled.');
  busy.value = false;
}
async function enableStandard(arn: string) {
  busy.value = true;
  await ctx.run(cli(['aws', 'securityhub', 'batch-enable-standards'], { '--standards-subscription-requests': `StandardsArn=${arn}` }), 'Standard enabled. Controls are evaluated.');
  busy.value = false;
}
function openWorkflow(ids: string[]) { workflow.value = { ids }; wf.status = 'SUPPRESSED'; wf.note = ''; }
async function saveWorkflow() {
  busy.value = true;
  const product = `arn:aws:securityhub:${ctx.home.value}::product/aws/securityhub`;
  const result = await ctx.run(cli(['aws', 'securityhub', 'batch-update-findings'], {
    '--finding-identifiers': workflow.value.ids.map((id: string) => `Id=${id},ProductArn=${product}`),
    '--workflow': `Status=${wf.status}`, '--note': wf.note.trim() ? `Text=${wf.note.trim()},UpdatedBy=ops.engineer` : '',
  }), `Workflow status set to ${wf.status}.`);
  busy.value = false;
  if (result.ok) workflow.value = null;
}
</script>

<style scoped>
.sh__p { margin: 0; }
.sh__bad { color: #db0000; font-weight: 700; }
.sh__score { display: flex; gap: 32px; align-items: center; flex-wrap: wrap; }
.sh__ring { width: 120px; height: 120px; border-radius: 50%; display: grid; place-items: center; }
.sh__ring span { width: 92px; height: 92px; border-radius: 50%; background: #fff; display: grid; place-items: center; font-size: 26px; font-weight: 700; }
.sh__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 0 20px; }
</style>
