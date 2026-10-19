<template>
  <!-- Execution detail -->
  <div v-if="page === 'execution'">
    <template v-if="execution">
      <CsHeader :title="`Execution: ${execution.name}`" />
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
        <div class="cs-container__body"><dl class="cs-kv">
          <div><dt>Status</dt><dd><CsStatus :state="statusState(execution.status)" :label="title(execution.status)" /></dd></div>
          <div><dt>State machine</dt><dd>{{ execution.machine }}</dd></div>
          <div><dt>Start time</dt><dd>{{ awsDate(execution.start) }}</dd></div>
          <div><dt>End time</dt><dd>{{ awsDate(execution.stop) }}</dd></div>
          <div v-if="execution.error"><dt>Error</dt><dd>{{ execution.error }}</dd></div>
          <div v-if="execution.cause"><dt>Cause</dt><dd class="cs-mono sf__cause">{{ execution.cause }}</dd></div>
        </dl></div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Graph view" :level="2" :info="false" /></div>
        <div class="cs-container__body"><div class="sf__graph">
          <template v-for="(s, i) in visited" :key="i">
            <div class="sf__state" :class="'sf__state--' + s.result">{{ s.name }}</div>
            <div v-if="i < visited.length - 1" class="sf__arrow" aria-hidden="true" />
          </template>
        </div></div>
      </section>
      <CsTable title="Events" :items="events" :columns="eventColumns" track-by="id" />
    </template>
  </div>

  <!-- State machine detail -->
  <div v-else-if="page === 'machine'">
    <template v-if="machine">
      <CsHeader :title="machine.name"><template #actions>
        <button type="button" class="cs-btn" @click="editOpen = true">Edit</button>
        <button type="button" class="cs-btn" @click="deleting = true">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="startOpen = true">Start execution</button>
      </template></CsHeader>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
        <div class="cs-container__body"><dl class="cs-kv">
          <div><dt>ARN</dt><dd class="cs-mono">{{ machine.arn }}</dd></div>
          <div><dt>IAM role ARN</dt><dd class="cs-mono">{{ machine.role }}</dd></div>
          <div><dt>Type</dt><dd>{{ title(machine.type) }}</dd></div>
          <div><dt>Creation date</dt><dd>{{ awsDate(machine.created) }}</dd></div>
        </dl></div>
      </section>
      <CsTable title="Executions" :items="machineExecutions" :columns="execColumns" track-by="arn" empty-title="No executions">
        <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('stepfunctions', 'execution', { arn: row.arn, name: row.name })">{{ row.name }}</a></template>
        <template #cell-status="{ row }"><CsStatus :state="statusState(row.status)" :label="title(row.status)" /></template>
      </CsTable>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Definition" :level="2" :info="false" /></div>
        <div class="cs-container__body"><pre class="cs-code">{{ pretty(machine.definition) }}</pre></div>
      </section>
      <CsModal v-if="startOpen" title="Start execution" @close="startOpen = false">
        <div class="cs-stack">
          <div class="cs-field"><label class="cs-label" for="sf-name">Name <small>- optional</small></label><input id="sf-name" v-model.trim="execName" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="sf-in">Input</label><textarea id="sf-in" v-model="execInput" class="cs-textarea cs-mono" /></div>
        </div>
        <template #footer>
          <button type="button" class="cs-btn cs-btn--link" @click="startOpen = false">Cancel</button>
          <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="start">Start execution</button>
        </template>
      </CsModal>
      <CsModal v-if="editOpen" title="Edit definition" size="large" @close="editOpen = false">
        <textarea v-model="editText" class="cs-textarea cs-mono sf__def" spellcheck="false" aria-label="Definition" />
        <template #footer>
          <button type="button" class="cs-btn cs-btn--link" @click="editOpen = false">Cancel</button>
          <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveEdit">Save</button>
        </template>
      </CsModal>
      <CsDelete v-if="deleting" :title="`Delete ${machine.name}?`" word="delete" :busy="busy" @close="deleting = false" @confirm="remove" />
    </template>
  </div>

  <!-- Create -->
  <div v-else-if="page === 'create'">
    <CsHeader title="Create state machine" description="Write the workflow in Amazon States Language. Use .sync service integrations so a state waits for the job it starts." />
    <section class="cs-container"><div class="cs-container__body cs-stack">
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label" for="sc-name">State machine name</label><input id="sc-name" v-model.trim="form.name" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label" for="sc-role">Execution role</label>
          <select id="sc-role" v-model="form.role" class="cs-select"><option value="">Choose a role</option>
            <option v-for="r in roles" :key="r.arn" :value="r.arn">{{ r.name }}</option></select></div>
      </div>
      <div class="cs-field"><label class="cs-label" for="sc-def">Definition</label>
        <textarea id="sc-def" v-model="form.definition" class="cs-textarea cs-mono sf__def" spellcheck="false" /></div>
    </div></section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('stepfunctions', 'machines')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="!form.name || !form.role || busy" @click="create">Create</button>
    </div>
  </div>

  <!-- List -->
  <div v-else>
    <CsTable title="State machines" variant="full-page" :items="machines" :columns="machineColumns" track-by="arn" empty-title="No state machines">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('stepfunctions', 'create')">Create state machine</button></template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('stepfunctions', 'machine', { arn: row.arn, name: row.name })">{{ row.name }}</a></template>
    </CsTable>
  </div>
</template>

<script setup lang="ts">
/** AWS Step Functions: create a state machine, start executions, follow the graph and event history. */
import { computed, reactive, ref } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsHeader from '../CsHeader.vue';
import CsModal from '../CsModal.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, useAws } from '../ctx';

const ctx = useAws();
const page = computed(() => ctx.route.value.page);
const params = computed(() => ctx.route.value.params || {});
const machines = computed(() => rows(ctx.view.value, 'stepfunctions.machines'));
const executions = computed(() => rows(ctx.view.value, 'stepfunctions.executions'));
const machine = computed(() => machines.value.find(m => m.arn === params.value.arn) || null);
const machineExecutions = computed(() => executions.value.filter(e => machine.value && e.machine === machine.value.name));
const execution = computed(() => executions.value.find(e => e.arn === params.value.arn) || null);
const events = computed(() => (execution.value?.history || []).map((e: Record<string, any>, i: number) => ({ ...e, id: i + 1 })));
const visited = computed(() => {
  const out: Array<{ name: string; result: string }> = [];
  for (const e of execution.value?.history || []) {
    if (/StateEntered$/.test(e.type)) out.push({ name: e.name, result: 'ok' });
    if (e.type === 'TaskFailed' && out.length) out[out.length - 1].result = 'failed';
  }
  return out;
});
const roles = computed(() => rows(ctx.view.value, 'iam.roles'));
const busy = ref(false);
const startOpen = ref(false);
const editOpen = ref(false);
const deleting = ref(false);
const execName = ref('');
const execInput = ref('{}');
const editText = ref('');
const form = reactive({ name: 'shopflow-nightly', role: '', definition: JSON.stringify({
  StartAt: 'CurateOrders', States: { CurateOrders: { Type: 'Task', Resource: 'arn:aws:states:::glue:startJobRun.sync',
    Parameters: { JobName: 'shopflow-curate-orders' }, End: true } } }, null, 2) });

const machineColumns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' }, { id: 'type', header: 'Type' },
  { id: 'created', header: 'Creation date', cell: r => awsDate(r.created) },
];
const execColumns: Column[] = [
  { id: 'name', header: 'Name' }, { id: 'status', header: 'Status' },
  { id: 'start', header: 'Started', cell: r => awsDate(r.start) }, { id: 'stop', header: 'End time', cell: r => awsDate(r.stop) },
];
const eventColumns: Column[] = [
  { id: 'id', header: 'ID' }, { id: 'type', header: 'Type' }, { id: 'name', header: 'Step', cell: r => r.name || '-' },
  { id: 'error', header: 'Error', cell: r => r.error || '-' }, { id: 'timestamp', header: 'Timestamp', cell: r => awsDate(r.timestamp) },
];

function title(text: string) { return String(text || '').charAt(0) + String(text || '').slice(1).toLowerCase(); }
function statusState(status: string) { return status === 'SUCCEEDED' ? 'success' : status === 'FAILED' ? 'failed' : 'pending'; }
function pretty(text: string) { const p = parseJson(text); return p ? JSON.stringify(p, null, 2) : text; }

async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'stepfunctions', 'create-state-machine'], {
    '--name': form.name, '--role-arn': form.role, '--definition': form.definition }), `State machine ${form.name} created.`);
  busy.value = false;
  if (result.ok) {
    const arn = parseJson<any>(result.output)?.stateMachineArn;
    ctx.to('stepfunctions', arn ? 'machine' : 'machines', arn ? { arn, name: form.name } : {});
  }
}
async function start() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'stepfunctions', 'start-execution'], {
    '--state-machine-arn': machine.value!.arn, '--name': execName.value, '--input': execInput.value }), 'Execution started.');
  busy.value = false;
  if (result.ok) {
    startOpen.value = false;
    const arn = parseJson<any>(result.output)?.executionArn;
    if (arn) ctx.to('stepfunctions', 'execution', { arn, name: execName.value || arn.split(':').pop() });
  }
}
async function saveEdit() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'stepfunctions', 'update-state-machine'], {
    '--state-machine-arn': machine.value!.arn, '--definition': editText.value }), 'State machine updated.');
  busy.value = false;
  if (result.ok) editOpen.value = false;
}
async function remove() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'stepfunctions', 'delete-state-machine'], { '--state-machine-arn': machine.value!.arn }), 'State machine deleted.');
  busy.value = false;
  if (result.ok) { deleting.value = false; ctx.to('stepfunctions', 'machines'); }
}
editText.value = machine.value ? pretty(machine.value.definition) : '';
</script>

<style scoped>
.sf__def { min-height: 320px; }
.sf__cause { white-space: pre-wrap; word-break: break-word; }
.sf__graph { display: flex; flex-direction: column; align-items: center; gap: 0; padding: 8px; }
.sf__state { border: 2px solid #8c8c94; border-radius: 8px; padding: 8px 18px; min-width: 200px; text-align: center; background: #fff; }
.sf__state--ok { border-color: #00802f; background: #effff1; }
.sf__state--failed { border-color: #db0000; background: #fff5f5; }
.sf__arrow { width: 2px; height: 22px; background: #8c8c94; }
</style>
