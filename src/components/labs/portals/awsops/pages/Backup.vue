<template>
  <!-- Dashboard -->
  <div v-if="page === 'dashboard'">
    <CsHeader title="AWS Backup" description="Centrally manage and automate backups across AWS services." />
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Backup jobs completed</dt><dd class="bk__big bk__ok">{{ jobs.filter(j => j.state === 'COMPLETED').length }}</dd></div>
      <div><dt>Backup jobs failed</dt><dd class="bk__big bk__bad">{{ jobs.filter(j => j.state === 'FAILED').length }}</dd></div>
      <div><dt>Restore jobs</dt><dd class="bk__big">{{ restores.length }}</dd></div>
      <div><dt>Protected resources</dt><dd class="bk__big">{{ protectedCount }}</dd></div>
    </dl></div></section>
  </div>

  <!-- Vaults -->
  <div v-else-if="page === 'vaults'">
    <CsTable variant="full-page" title="Backup vaults" :items="vaults" :columns="vaultCols" track-by="key" filter-placeholder="Filter by vault name"
             :description="`Backup vaults in ${ctx.region.value}. Switch Region in the top bar to see the vaults of another Region.`">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="creatingVault = true">Create backup vault</button></template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('backup', 'vault', { name: row.name, region: row.region })">{{ row.name }}</a></template>
      <template #cell-lock="{ row }"><CsStatus :type="row.locked ? 'success' : 'stopped'" :label="row.locked ? `Locked (min ${row.min_days} days)` : 'Not locked'" /></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'vault' && vault">
    <CsHeader :title="vault.name" :description="vault.arn">
      <template #actions>
        <button type="button" class="cs-btn" @click="deletingVault = vault">Delete</button>
        <button type="button" class="cs-btn" :disabled="vault.locked" @click="locking = true">Add vault lock</button>
      </template>
    </CsHeader>
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Region</dt><dd>{{ vault.region }}</dd></div><div><dt>Recovery points</dt><dd>{{ vault.points.length }}</dd></div>
      <div><dt>Vault lock</dt><dd>{{ vault.locked ? `Compliance mode, min ${vault.min_days} / max ${vault.max_days || '-'} days` : 'Not locked' }}</dd></div>
    </dl></div></section>
    <CsTable title="Recovery points" :items="vault.points" :columns="pointCols" track-by="arn" selection-type="single" v-model:selected="pointSel"
             empty-title="No recovery points" empty-text="Recovery points appear as backup jobs complete (the scenario clock has to move).">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!pointSel.length || busy" @click="deletingPoint = pointSel[0]">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!pointSel.length" @click="openRestore">Restore</button>
      </template>
      <template #cell-status><CsStatus type="success" label="Completed" /></template>
      <template #cell-copy="{ row }">{{ row.copy ? 'Copy' : 'Backup' }}</template>
    </CsTable>
  </div>

  <!-- Plans -->
  <div v-else-if="page === 'plans'">
    <CsTable variant="full-page" title="Backup plans" :items="plans" :columns="planCols" track-by="id" selection-type="single" v-model:selected="planSel"
             empty-title="No backup plans">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!planSel.length" @click="deletingPlan = plans.find(p => p.id === planSel[0])">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('backup', 'plan-create')">Create backup plan</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('backup', 'plan', { id: row.id, name: row.name })">{{ row.name }}</a></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'plan-create'">
    <CsHeader title="Create backup plan" description="Build a new plan by entering its JSON document, the same document the AWS CLI takes." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Backup plan" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Start from a file in the lab workspace <small>- optional</small></label>
          <select v-model="planFile" class="cs-select" @change="loadPlanFile"><option value="">Build a new plan</option>
            <option v-for="f in planFiles" :key="f" :value="f">{{ f }}</option></select></div>
        <textarea v-model="planDoc" class="cs-textarea cs-mono bk__json" spellcheck="false" />
        <span v-if="parseDoc(planDoc)[1]" class="cs-error-text">{{ parseDoc(planDoc)[1] }}</span>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('backup', 'plans')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!parseDoc(planDoc)[1]" @click="createPlan">Create plan</button>
    </div>
  </div>

  <div v-else-if="page === 'plan' && plan">
    <CsHeader :title="plan.name" :description="`Backup plan ID: ${plan.id}`"><template #actions><button type="button" class="cs-btn" @click="deletingPlan = plan">Delete</button></template></CsHeader>
    <CsTable title="Backup rules" :items="plan.rules" :columns="ruleCols" track-by="name" />
    <CsTable class="bk__space" title="Resource assignments" :items="plan.selections" :columns="selCols" track-by="id" selection-type="single" v-model:selected="selSel">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!selSel.length || busy" @click="deleteSelection">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="openAssign">Assign resources</button>
      </template>
    </CsTable>
  </div>

  <!-- Jobs -->
  <div v-else-if="page === 'jobs'">
    <div class="cs-tabs">
      <button v-for="t in ['Backup jobs', 'Restore jobs']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <CsTable v-if="tab === 'Backup jobs'" variant="full-page" title="Backup jobs" :items="jobs" :columns="jobCols" track-by="id" empty-title="No backup jobs">
      <template #cell-state="{ row }"><CsStatus :type="kind(row.state)" :label="row.state" /></template>
    </CsTable>
    <CsTable v-else variant="full-page" title="Restore jobs" :items="restores" :columns="restoreCols" track-by="id" selection-type="single" v-model:selected="restSel" empty-title="No restore jobs">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" :disabled="!restSel.length" @click="openValidate">Validate restore</button></template>
      <template #cell-status="{ row }"><CsStatus :type="kind(row.status)" :label="row.status" /></template>
      <template #cell-validation="{ row }"><CsStatus v-if="row.validation" :type="row.validation === 'SUCCESSFUL' ? 'success' : 'error'" :label="row.validation" /><span v-else class="cs-muted">Not validated</span></template>
    </CsTable>
  </div>

  <!-- Restore testing / DR -->
  <div v-else-if="page === 'dr'">
    <CsHeader title="Restore testing" description="Recovery objectives per workload, the disaster-recovery strategy behind each, and game days that measure RTO and RPO for real." />
    <CsTable title="Workloads" :items="workloads" :columns="wlCols" track-by="name" selection-type="single" v-model:selected="wlSel">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!wlSel.length" @click="openStrategy">Change strategy</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!wlSel.length || busy" @click="gameDay">Run game day</button>
      </template>
      <template #cell-meets="{ row }"><CsStatus :type="row.meets ? 'success' : 'error'" :label="row.meets ? 'Meets targets' : 'Misses targets'" /></template>
    </CsTable>
    <CsTable class="bk__space" title="Game day results" :items="tests" :columns="testCols" track-by="key" empty-title="No game days run">
      <template #cell-met="{ row }"><CsStatus :type="row.met ? 'success' : 'error'" :label="row.met ? 'Targets met' : 'Targets missed'" /></template>
    </CsTable>
  </div>

  <CsModal v-if="creatingVault" title="Create backup vault" @close="creatingVault = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Backup vault name</label><input v-model="vaultName" class="cs-input" /><span class="cs-constraint">Region: {{ ctx.region.value }}</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="creatingVault = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !/^[\w.-]{2,50}$/.test(vaultName)" @click="createVault">Create backup vault</button>
    </template>
  </CsModal>

  <CsModal v-if="locking" title="Create vault lock" @close="locking = false">
    <div class="cs-stack">
      <div class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
        <div>A vault lock in compliance mode cannot be removed once its grace time has ended - not by you, not by the root user, not by AWS.</div></div>
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Minimum retention period</label><input v-model="lock.min" class="cs-input" inputmode="numeric" /><span class="cs-constraint">days</span></div>
        <div class="cs-field"><label class="cs-label">Maximum retention period <small>- optional</small></label><input v-model="lock.max" class="cs-input" inputmode="numeric" /><span class="cs-constraint">days</span></div>
      </div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="locking = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !/^\d+$/.test(lock.min)" @click="saveLock">Create vault lock</button>
    </template>
  </CsModal>

  <CsModal v-if="restoring" title="Restore backup" @close="restoring = null">
    <div class="cs-stack">
      <dl class="cs-kv"><div><dt>Resource</dt><dd>{{ restoring.name }}</dd></div><div><dt>Recovery point</dt><dd class="cs-mono">{{ restoring.arn }}</dd></div></dl>
      <div class="cs-field"><label class="cs-label">Instance type</label><select v-model="restoreType" class="cs-select"><option>m5.large</option><option>r5.xlarge</option><option>t3.large</option></select></div>
      <div class="cs-field"><label class="cs-label">IAM role</label><select v-model="restoreRole" class="cs-select"><option v-for="r in roles" :key="r.arn" :value="r.arn">{{ r.name }}</option></select></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="restoring = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="restore">Restore backup</button>
    </template>
  </CsModal>

  <CsModal v-if="validating" title="Validate restore" @close="validating = null">
    <p class="bk__p">Record the result of testing the restored resource <strong>{{ validating.name }}</strong> ({{ validating.id }}).</p>
    <div class="cs-field"><select v-model="validation" class="cs-select"><option>SUCCESSFUL</option><option>FAILED</option><option>TIMED_OUT</option></select></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="validating = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="validate">Submit</button>
    </template>
  </CsModal>

  <CsModal v-if="assigning" title="Assign resources" size="large" @close="assigning = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Resource assignment name</label><input v-model="asg.name" class="cs-input" /></div>
      <div class="cs-field"><label class="cs-label">IAM role</label><select v-model="asg.role" class="cs-select"><option v-for="r in roles" :key="r.arn" :value="r.arn">{{ r.name }}</option></select></div>
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Tag key</label><input v-model="asg.key" class="cs-input" placeholder="Backup" /></div>
        <div class="cs-field"><label class="cs-label">Tag value</label><input v-model="asg.value" class="cs-input" placeholder="gold" /></div>
      </div>
      <span class="cs-constraint">Resources with this tag are backed up by the plan's rules.</span>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="assigning = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !asg.name || !asg.key" @click="assign">Assign resources</button>
    </template>
  </CsModal>

  <CsModal v-if="strategyFor" title="Change disaster recovery strategy" @close="strategyFor = null">
    <div class="cs-stack">
      <p class="bk__p">{{ strategyFor.name }}: RTO target {{ strategyFor.rto_target }}, RPO target {{ strategyFor.rpo_target }}.</p>
      <label v-for="s in strategies" :key="s.name" class="cs-radio"><input v-model="strategy" type="radio" :value="s.name" /><span>{{ s.name }}<small>+${{ s.cost.toLocaleString() }}/month over backups</small></span></label>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="strategyFor = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveStrategy">Save</button>
    </template>
  </CsModal>

  <CsDelete v-if="deletingVault" title="Delete backup vault" :word="deletingVault.name" :busy="busy" @close="deletingVault = null" @confirm="removeVault">
    <p class="bk__p">A vault that contains recovery points, or that a backup plan uses, cannot be deleted.</p>
  </CsDelete>
  <CsDelete v-if="deletingPlan" title="Delete backup plan" :word="deletingPlan.name" :busy="busy" @close="deletingPlan = null" @confirm="removePlan">
    <p class="bk__p">Delete its resource assignments first.</p>
  </CsDelete>
  <CsDelete v-if="deletingPoint" title="Delete recovery point" word="delete" :busy="busy" @close="deletingPoint = ''" @confirm="removePoint">
    <p class="bk__p">Delete <span class="cs-mono">{{ deletingPoint }}</span>? A vault lock refuses this until the minimum retention has passed.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import { parseJson as parseDoc, pretty } from '../kit';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const tab = ref('Backup jobs');
const busy = ref(false);
const pointSel = ref<string[]>([]);
const planSel = ref<string[]>([]);
const selSel = ref<string[]>([]);
const restSel = ref<string[]>([]);
const wlSel = ref<string[]>([]);
const creatingVault = ref(false);
const vaultName = ref('');
const locking = ref(false);
const lock = reactive({ min: '30', max: '365' });
const restoring = ref<any>(null);
const restoreType = ref('m5.large');
const restoreRole = ref('');
const validating = ref<any>(null);
const validation = ref('SUCCESSFUL');
const assigning = ref(false);
const strategyFor = ref<any>(null);
const strategy = ref('backup-restore');
const deletingVault = ref<any>(null);
const deletingPlan = ref<any>(null);
const deletingPoint = ref('');

const allVaults = computed(() => rows<any>(ctx.c.value, 'backup.vaults').map(v => ({ ...v, key: `${v.region}/${v.name}`, count: v.points.length })));
const vaults = computed(() => allVaults.value.filter(v => v.region === ctx.region.value));
const vault = computed<any>(() => allVaults.value.find(v => v.name === ctx.route.value.params?.name && v.region === (ctx.route.value.params?.region || ctx.region.value)) || null);
const regionFlag = computed(() => (vault.value && vault.value.region !== ctx.home.value ? vault.value.region : (ctx.region.value !== ctx.home.value ? ctx.region.value : '')));
const plans = computed(() => rows<any>(ctx.c.value, 'backup.plans').map(p => ({ ...p, ruleCount: p.rules.length, schedules: p.rules.map((r: any) => r.schedule).join(', '),
  copies: p.rules.flatMap((r: any) => r.copies.map((c: any) => c.region)).join(', ') || '-' })));
const plan = computed<any>(() => plans.value.find(p => p.id === ctx.route.value.params?.id) || null);
const jobs = computed(() => rows<any>(ctx.c.value, 'backup.jobs'));
const restores = computed(() => rows<any>(ctx.c.value, 'backup.restores'));
const roles = computed(() => rows<any>(ctx.c.value, 'iam.roles'));
const protectedCount = computed(() => new Set(allVaults.value.flatMap(v => v.points.map((p: any) => p.resource))).size);
const workloads = computed(() => rows<any>(ctx.view.value, 'workloads'));
const tests = computed(() => rows<any>(ctx.view.value, 'dr_tests').map((t, i) => ({ ...t, key: i })));
const strategies = computed(() => rows<any>(ctx.c.value, 'backup.dr_strategies'));
const planFiles = computed(() => Object.keys((ctx.view.value as any)?.files || {}).filter(f => /backup.*\.json$/.test(f)));

function kind(s: string) { return s === 'COMPLETED' ? 'success' : s === 'FAILED' ? 'error' : s === 'RUNNING' ? 'in-progress' : 'info'; }
const vaultCols = [{ id: 'name', header: 'Vault name', sortKey: 'name' }, { id: 'region', header: 'Region' }, { id: 'lock', header: 'Vault lock' },
  { id: 'count', header: 'Recovery points' }];
const pointCols = [{ id: 'name', header: 'Resource name' }, { id: 'arn', header: 'Recovery point ID' }, { id: 'status', header: 'Status' },
  { id: 'copy', header: 'Type' }, { id: 'time', header: 'Creation time (shift)' }];
const planCols = [{ id: 'name', header: 'Backup plan name' }, { id: 'id', header: 'Backup plan ID' }, { id: 'ruleCount', header: 'Rules' },
  { id: 'schedules', header: 'Schedules' }, { id: 'copies', header: 'Copy to Regions' }];
const ruleCols = [{ id: 'name', header: 'Rule name' }, { id: 'vault', header: 'Backup vault' }, { id: 'schedule', header: 'Schedule' },
  { id: 'cold', header: 'Move to cold storage', cell: (r: any) => (r.cold ? `${r.cold} days` : 'Never') },
  { id: 'delete', header: 'Retention', cell: (r: any) => (r.delete ? `${r.delete} days` : 'Always') },
  { id: 'copies', header: 'Copies', cell: (r: any) => r.copies.map((c: any) => `${c.vault} (${c.region})`).join(', ') || '-' }];
const selCols = [{ id: 'name', header: 'Resource assignment name' }, { id: 'id', header: 'ID' },
  { id: 'tags', header: 'Tags', cell: (s: any) => s.tags.map((t: any) => `${t[0]}=${t[1]}`).join(', ') || '-' }, { id: 'role', header: 'IAM role' }];
const jobCols = [{ id: 'id', header: 'Backup job ID' }, { id: 'state', header: 'Status' }, { id: 'resource', header: 'Resource ID' },
  { id: 'name', header: 'Resource name' }, { id: 'vault', header: 'Backup vault' }, { id: 'origin', header: 'Initiated by' },
  { id: 'time', header: 'Creation time (shift)' }, { id: 'message', header: 'Message', cell: (j: any) => j.message || '-' }];
const restoreCols = [{ id: 'id', header: 'Restore job ID' }, { id: 'status', header: 'Status' }, { id: 'name', header: 'Resource name' },
  { id: 'region', header: 'Region' }, { id: 'minutes', header: 'Duration (minutes)' }, { id: 'validation', header: 'Validation status' }];
const wlCols = [{ id: 'name', header: 'Workload' }, { id: 'strategy', header: 'DR strategy' }, { id: 'rto_target', header: 'RTO target' },
  { id: 'rpo_target', header: 'RPO target' }, { id: 'rto', header: 'Achieved RTO' }, { id: 'rpo', header: 'Achieved RPO' }, { id: 'meets', header: 'Status' }];
const testCols = [{ id: 'workload', header: 'Workload' }, { id: 'strategy', header: 'Strategy' }, { id: 'rto', header: 'Measured RTO' },
  { id: 'rpo', header: 'Measured RPO' }, { id: 'met', header: 'Result' }, { id: 'reason', header: 'Reason', cell: (t: any) => t.reason || '-' }, { id: 'time', header: 'Time (shift)' }];

async function createVault() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'backup', 'create-backup-vault'], { '--backup-vault-name': vaultName.value,
    '--region': ctx.region.value !== ctx.home.value ? ctx.region.value : '' }), `Backup vault ${vaultName.value} created.`);
  busy.value = false;
  if (result.ok) { creatingVault.value = false; vaultName.value = ''; }
}
async function saveLock() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'backup', 'put-backup-vault-lock-configuration'], { '--backup-vault-name': vault.value.name,
    '--min-retention-days': lock.min, '--max-retention-days': lock.max, '--region': regionFlag.value }), `Vault lock added to ${vault.value.name}.`);
  busy.value = false;
  if (result.ok) locking.value = false;
}
function openRestore() {
  restoring.value = vault.value.points.find((p: any) => p.arn === pointSel.value[0]);
  restoreType.value = /sql/.test(restoring.value?.name || '') ? 'r5.xlarge' : 'm5.large';
  restoreRole.value = roles.value.find(r => r.name === 'AWSBackupDefaultServiceRole')?.arn || roles.value[0]?.arn || '';
}
async function restore() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'backup', 'start-restore-job'], { '--recovery-point-arn': restoring.value.arn, '--iam-role-arn': restoreRole.value,
    '--metadata': `InstanceType=${restoreType.value}` }), 'Restore job started. It completes as the scenario clock moves; validate it under Jobs.');
  busy.value = false;
  if (result.ok) restoring.value = null;
}
function openValidate() { validating.value = restores.value.find(r => r.id === restSel.value[0]); validation.value = 'SUCCESSFUL'; }
async function validate() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'backup', 'put-restore-validation-result'], { '--restore-job-id': validating.value.id, '--validation-status': validation.value }),
    `Validation recorded for ${validating.value.id}.`);
  busy.value = false;
  if (result.ok) validating.value = null;
}
const planFile = ref('');
const planDoc = ref(pretty({ BackupPlanName: 'my-plan', Rules: [{ RuleName: 'daily', TargetBackupVaultName: 'Default',
  ScheduleExpression: 'cron(0 5 ? * * *)', Lifecycle: { DeleteAfterDays: 35 } }] }));
function loadPlanFile() {
  const body = (ctx.view.value as any)?.files?.[planFile.value];
  if (body) planDoc.value = body;
}
async function createPlan() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'backup', 'create-backup-plan'], { '--backup-plan': JSON.stringify(JSON.parse(planDoc.value)) }), 'Backup plan created.');
  busy.value = false;
  if (result.ok) ctx.to('backup', 'plans');
}
const asg = reactive({ name: '', role: '', key: 'Backup', value: 'gold' });
function openAssign() { asg.name = ''; asg.role = roles.value.find(r => r.name === 'AWSBackupDefaultServiceRole')?.arn || ''; assigning.value = true; }
async function assign() {
  busy.value = true;
  const selection = JSON.stringify({ SelectionName: asg.name.trim(), IamRoleArn: asg.role,
    ListOfTags: [{ ConditionType: 'STRINGEQUALS', ConditionKey: asg.key.trim(), ConditionValue: asg.value.trim() }] });
  const result = await ctx.run(cli(['aws', 'backup', 'create-backup-selection'], { '--backup-plan-id': plan.value.id, '--backup-selection': selection }),
    'Resources assigned to the backup plan.');
  busy.value = false;
  if (result.ok) assigning.value = false;
}
async function deleteSelection() {
  busy.value = true;
  await ctx.run(cli(['aws', 'backup', 'delete-backup-selection'], { '--backup-plan-id': plan.value.id, '--selection-id': selSel.value[0] }), 'Resource assignment deleted.');
  busy.value = false;
  selSel.value = [];
}
function openStrategy() { strategyFor.value = workloads.value.find(w => w.name === wlSel.value[0]); strategy.value = strategyFor.value?.strategy || 'backup-restore'; }
async function saveStrategy() {
  busy.value = true;
  const result = await ctx.run(cli(['ops', 'dr', 'strategy'], { '--workload': strategyFor.value.name, '--set': strategy.value }), `Strategy for ${strategyFor.value.name} set to ${strategy.value}.`);
  busy.value = false;
  if (result.ok) strategyFor.value = null;
}
async function gameDay() {
  busy.value = true;
  const result = await ctx.run(cli(['ops', 'dr', 'test'], { '--workload': wlSel.value[0] }));
  busy.value = false;
  if (result.ok) ctx.api.notify(/TARGETS MET/.test(result.output || '') ? 'success' : 'warning', String(result.output || '').split('\n').pop() || 'Game day complete');
}
async function removeVault() {
  busy.value = true;
  const v = deletingVault.value;
  const result = await ctx.run(cli(['aws', 'backup', 'delete-backup-vault'], { '--backup-vault-name': v.name, '--region': v.region !== ctx.home.value ? v.region : '' }),
    `Backup vault ${v.name} deleted.`);
  busy.value = false;
  deletingVault.value = null;
  if (result.ok && page.value === 'vault') ctx.to('backup', 'vaults');
}
async function removePlan() {
  busy.value = true;
  const p = deletingPlan.value;
  const result = await ctx.run(cli(['aws', 'backup', 'delete-backup-plan'], { '--backup-plan-id': p.id }), `Backup plan ${p.name} deleted.`);
  busy.value = false;
  deletingPlan.value = null;
  if (result.ok && page.value === 'plan') ctx.to('backup', 'plans');
}
async function removePoint() {
  busy.value = true;
  await ctx.run(cli(['aws', 'backup', 'delete-recovery-point'], { '--backup-vault-name': vault.value.name, '--recovery-point-arn': deletingPoint.value,
    '--region': regionFlag.value }), 'Recovery point deleted.');
  busy.value = false;
  deletingPoint.value = '';
  pointSel.value = [];
}
</script>

<style scoped>
.bk__big { font-size: 28px; line-height: 34px; font-weight: 300; color: #006ce0; }
.bk__ok { color: #00802f; }
.bk__bad { color: #db0000; }
.bk__json { min-height: 320px; }
.bk__space { margin-top: 20px; }
.bk__p { margin: 0; }
</style>
