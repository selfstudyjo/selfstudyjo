<template>
  <CsTable v-if="page === 'windows'" variant="full-page" title="Maintenance windows" :items="windows" :columns="cols" track-by="id" selection-type="single" v-model:selected="sel"
           description="A maintenance window is a schedule for running tasks on targets, with a duration and a cutoff after which no new task starts."
           empty-title="No maintenance windows">
    <template #actions>
      <CsDropdown :items="[{ id: 'delete', text: 'Delete' }]" :disabled="!sel.length" @select="deleting = windows.find(w => w.id === sel[0])" />
      <button type="button" class="cs-btn cs-btn--primary" @click="creating = true">Create maintenance window</button>
    </template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('ssm', 'window', { id: row.id, name: row.name })">{{ row.name }}</a></template>
    <template #cell-enabled="{ row }"><CsStatus :type="row.enabled ? 'success' : 'stopped'" :label="row.enabled ? 'Enabled' : 'Disabled'" /></template>
  </CsTable>

  <div v-else-if="win">
    <CsHeader :title="win.name" :description="win.id">
      <template #actions>
        <button type="button" class="cs-btn" @click="toggle">{{ win.enabled ? 'Disable' : 'Enable' }}</button>
        <button type="button" class="cs-btn" @click="deleting = win">Delete</button>
      </template>
    </CsHeader>
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Schedule</dt><dd class="cs-mono">{{ win.schedule }}</dd></div><div><dt>Next execution (shift time)</dt><dd>{{ win.next }}</dd></div>
      <div><dt>Duration</dt><dd>{{ win.duration }} hours</dd></div><div><dt>Stop initiating tasks (cutoff)</dt><dd>{{ win.cutoff }} hours before the end</dd></div>
    </dl></div></section>
    <div class="cs-tabs">
      <button v-for="t in ['Targets', 'Tasks', 'History']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <CsTable v-if="tab === 'Targets'" title="Targets" :items="targetRows" :columns="tgtCols" track-by="id" selection-type="single" v-model:selected="tgtSel"
             empty-title="No targets">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!tgtSel.length || busy" @click="deregisterTarget">Deregister target</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="openTarget">Register target</button>
      </template>
    </CsTable>
    <CsTable v-else-if="tab === 'Tasks'" title="Tasks" :items="taskRows" :columns="taskCols" track-by="id" selection-type="single" v-model:selected="taskSel"
             empty-title="No tasks">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!taskSel.length || busy" @click="deregisterTask">Deregister task</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!win.targets.length" @click="openTask">Register Run command task</button>
      </template>
    </CsTable>
    <CsTable v-else title="Executions" :items="win.executions.map((x: any, i: number) => ({ ...x, key: i, count: x.tasks.length }))" :columns="exCols" track-by="key"
             empty-title="No executions" empty-text="The window runs when the scenario clock reaches its schedule (ops wait in the Ops console)." />
  </div>
  <NotFound v-else what="Maintenance window" :id="ctx.route.value.params?.name || ''" back="windows" />

  <CsModal v-if="creating" title="Create maintenance window" size="large" @close="creating = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Name</label><input v-model="form.name" class="cs-input" placeholder="patch-wave-a" /></div>
      <div class="cs-field"><label class="cs-label">Schedule (cron expression)</label><input v-model="form.schedule" class="cs-input cs-mono" placeholder="cron(0 2 ? * MON *)" />
        <span class="cs-constraint">cron(minute hour day-of-month month day-of-week year), UTC</span></div>
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Duration</label><input v-model="form.duration" class="cs-input" inputmode="numeric" /><span class="cs-constraint">hours (1-24)</span></div>
        <div class="cs-field"><label class="cs-label">Stop initiating tasks</label><input v-model="form.cutoff" class="cs-input" inputmode="numeric" /><span class="cs-constraint">hours before the window closes</span></div>
      </div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="creating = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !form.name.trim() || !form.schedule.trim()" @click="create">Create maintenance window</button>
    </template>
  </CsModal>

  <CsModal v-if="targeting" title="Register target" @close="targeting = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Target name</label><input v-model="tf.name" class="cs-input" placeholder="wave-a" /></div>
      <div class="cs-field"><label class="cs-label">Specify instance tags - PatchGroup</label>
        <div class="sw__chips"><label v-for="g in tagGroups" :key="g" class="cs-check"><input v-model="tf.groups" type="checkbox" :value="g" />{{ g }}</label></div></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="targeting = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !tf.groups.length" @click="registerTarget">Register target</button>
    </template>
  </CsModal>

  <CsModal v-if="tasking" title="Register Run command task" size="large" @close="tasking = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Command document</label><select v-model="kf.document" class="cs-select"><option>AWS-RunPatchBaseline</option><option>AWS-RunPowerShellScript</option></select></div>
      <div class="cs-field"><label class="cs-label">Registered target groups</label>
        <div class="sw__chips"><label v-for="t in win?.targets || []" :key="t.id" class="cs-check"><input v-model="kf.targets" type="checkbox" :value="t.name || t.id" />{{ t.name || t.id }}</label></div></div>
      <div v-if="kf.document === 'AWS-RunPatchBaseline'" class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Operation</label><select v-model="kf.operation" class="cs-select"><option>Install</option><option>Scan</option></select></div>
        <div class="cs-field"><label class="cs-label">Reboot option</label><select v-model="kf.reboot" class="cs-select"><option>RebootIfNeeded</option><option>NoReboot</option></select></div>
      </div>
      <div class="cs-grid-3">
        <div class="cs-field"><label class="cs-label">Concurrency</label><input v-model="kf.concurrency" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label">Error threshold</label><input v-model="kf.errors" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label">Priority</label><input v-model="kf.priority" class="cs-input" inputmode="numeric" /></div>
      </div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="tasking = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !kf.targets.length || !kf.concurrency || !kf.errors" @click="registerTask">Register Run command task</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete maintenance window" :word="deleting.name" :busy="busy" @close="deleting = null" @confirm="remove">
    <p class="sw__p">Deleting the window removes its targets and tasks.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import NotFound from './NotFound.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const tgtSel = ref<string[]>([]);
const taskSel = ref<string[]>([]);
const tab = ref('Targets');
const busy = ref(false);
const creating = ref(false);
const targeting = ref(false);
const tasking = ref(false);
const deleting = ref<any>(null);

const windows = computed(() => rows<any>(ctx.c.value, 'ssm.windows').map(w => ({ ...w, durationText: `${w.duration} hours`, cutoffText: `${w.cutoff} hours` })));
const win = computed<any>(() => windows.value.find(w => w.id === ctx.route.value.params?.id) || null);
const tagGroups = computed(() => Array.from(new Set(rows<any>(ctx.c.value, 'ssm.nodes').map(n => n.patch_group).filter(Boolean))).sort());
const targetRows = computed(() => (win.value?.targets || []).map((t: any) => ({ ...t, spec: (t.targets || []).map((s: any) => `${s.Key}=${[].concat(s.Values || []).join(',')}`).join('; ') })));
const taskRows = computed(() => (win.value?.tasks || []).map((t: any) => ({ ...t, op: t.params?.Operation || '-',
  tgt: (t.targets || []).map((s: any) => [].concat(s.Values || []).join(',')).join('; ') })));

const cols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'id', header: 'ID' }, { id: 'enabled', header: 'State' },
  { id: 'schedule', header: 'Schedule' }, { id: 'durationText', header: 'Duration' }, { id: 'cutoffText', header: 'Cutoff' }, { id: 'next', header: 'Next execution time' }];
const tgtCols = [{ id: 'name', header: 'Name' }, { id: 'id', header: 'Window target ID' }, { id: 'spec', header: 'Targets' }];
const taskCols = [{ id: 'id', header: 'Window task ID' }, { id: 'document', header: 'Document' }, { id: 'op', header: 'Operation' },
  { id: 'tgt', header: 'Targets' }, { id: 'concurrency', header: 'Concurrency' }, { id: 'max_errors', header: 'Error threshold' }, { id: 'priority', header: 'Priority' }];
const exCols = [{ id: 'time', header: 'Start time (shift)' }, { id: 'count', header: 'Tasks run' }];

const form = reactive({ name: '', schedule: 'cron(0 2 ? * MON *)', duration: '4', cutoff: '1' });
async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ssm', 'create-maintenance-window'], {
    '--name': form.name.trim(), '--schedule': form.schedule.trim(), '--duration': form.duration, '--cutoff': form.cutoff,
    '--allow-unassociated-targets': true,
  }), `Maintenance window ${form.name} has been created.`);
  busy.value = false;
  if (result.ok) creating.value = false;
}
async function toggle() {
  busy.value = true;
  await ctx.run(cli(['aws', 'ssm', 'update-maintenance-window'], { '--window-id': win.value.id, '--enabled': !win.value.enabled, '--no-enabled': win.value.enabled }),
    `Maintenance window ${win.value.enabled ? 'disabled' : 'enabled'}.`);
  busy.value = false;
}
const tf = reactive({ name: '', groups: [] as string[] });
function openTarget() { tf.name = ''; tf.groups = []; targeting.value = true; }
async function registerTarget() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ssm', 'register-target-with-maintenance-window'], {
    '--window-id': win.value.id, '--name': tf.name.trim(), '--resource-type': 'INSTANCE', '--targets': `Key=tag:PatchGroup,Values=${tf.groups.join(',')}`,
  }), 'Target registered.');
  busy.value = false;
  if (result.ok) targeting.value = false;
}
async function deregisterTarget() {
  busy.value = true;
  await ctx.run(cli(['aws', 'ssm', 'deregister-target-from-maintenance-window'], { '--window-id': win.value.id, '--window-target-id': tgtSel.value[0] }), 'Target deregistered.');
  busy.value = false;
  tgtSel.value = [];
}
const kf = reactive({ document: 'AWS-RunPatchBaseline', targets: [] as string[], operation: 'Install', reboot: 'RebootIfNeeded', concurrency: '3', errors: '1', priority: '1' });
function openTask() { kf.targets = []; tasking.value = true; }
async function registerTask() {
  busy.value = true;
  const params = kf.document === 'AWS-RunPatchBaseline'
    ? JSON.stringify({ RunCommand: { Parameters: { Operation: [kf.operation], RebootOption: [kf.reboot] } } }) : '';
  const result = await ctx.run(cli(['aws', 'ssm', 'register-task-with-maintenance-window'], {
    '--window-id': win.value.id, '--targets': `Key=WindowTargetIds,Values=${kf.targets.join(',')}`, '--task-arn': kf.document,
    '--task-type': 'RUN_COMMAND', '--max-concurrency': kf.concurrency.trim(), '--max-errors': kf.errors.trim(), '--priority': kf.priority,
    '--task-invocation-parameters': params,
  }), 'Task registered.');
  busy.value = false;
  if (result.ok) tasking.value = false;
}
async function deregisterTask() {
  busy.value = true;
  await ctx.run(cli(['aws', 'ssm', 'deregister-task-from-maintenance-window'], { '--window-id': win.value.id, '--window-task-id': taskSel.value[0] }), 'Task deregistered.');
  busy.value = false;
  taskSel.value = [];
}
async function remove() {
  busy.value = true;
  const w = deleting.value;
  const result = await ctx.run(cli(['aws', 'ssm', 'delete-maintenance-window'], { '--window-id': w.id }), `Maintenance window ${w.name} deleted.`);
  busy.value = false;
  deleting.value = null;
  if (result.ok && page.value === 'window') ctx.to('ssm', 'windows');
}
</script>

<style scoped>
.sw__chips { display: flex; flex-wrap: wrap; gap: 6px 16px; }
.sw__p { margin: 0; }
</style>
