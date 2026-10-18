<template>
  <!-- Run Command -->
  <div v-if="page === 'run-command'">
    <CsTable variant="full-page" title="Commands" :items="commands" :columns="cols" track-by="id" filter-placeholder="Search commands"
             empty-title="No commands" empty-text="Run a command, or patch from Patch Manager.">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="running = true">Run command</button></template>
      <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('ssm', 'command', { id: row.id })">{{ row.id }}</a></template>
      <template #cell-status="{ row }"><CsStatus :type="kind(row.status)" :label="row.status" /></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'command' && command">
    <CsHeader :title="`Command ID: ${command.id}`" />
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Status</dt><dd><CsStatus :type="kind(command.status)" :label="command.status" /></dd></div>
      <div><dt>Document name</dt><dd>{{ command.document }}</dd></div><div><dt>Operation</dt><dd>{{ command.operation }}</dd></div>
      <div><dt>Requested (shift time)</dt><dd>{{ command.requested }}</dd></div><div><dt>Concurrency</dt><dd>{{ command.concurrency }}</dd></div>
      <div><dt>Error threshold</dt><dd>{{ command.max_errors }}</dd></div><div><dt>Comment</dt><dd>{{ command.origin }}</dd></div>
    </dl></div></section>
    <CsTable title="Targets and outputs" :items="command.invocations" :columns="invCols" track-by="instance">
      <template #cell-status="{ row }"><CsStatus :type="kind(row.status)" :label="row.status" /></template>
    </CsTable>
  </div>

  <!-- Parameter Store -->
  <div v-else-if="page === 'parameters'">
    <CsTable variant="full-page" title="My parameters" :items="params" :columns="paramCols" track-by="name" selection-type="single" v-model:selected="sel"
             empty-title="No parameters">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = sel[0]">Delete</button>
        <button type="button" class="cs-btn" :disabled="!sel.length" @click="openParam(params.find(p => p.name === sel[0]))">Edit</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="openParam(null)">Create parameter</button>
      </template>
    </CsTable>
  </div>
  <NotFound v-else what="Command" :id="ctx.route.value.params?.id || ''" back="run-command" />

  <CsModal v-if="running" title="Run a command" size="large" @close="running = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Command document</label>
        <select v-model="rf.document" class="cs-select"><option>AWS-RunPowerShellScript</option><option>AWS-RunShellScript</option><option>AWS-RunPatchBaseline</option></select></div>
      <div v-if="rf.document === 'AWS-RunPatchBaseline'" class="cs-field"><label class="cs-label">Operation</label>
        <select v-model="rf.operation" class="cs-select"><option>Scan</option><option>Install</option></select></div>
      <div v-else class="cs-field"><label class="cs-label">Commands</label><textarea v-model="rf.commands" class="cs-textarea cs-mono" placeholder="Get-Service W3SVC" /></div>
      <div class="cs-field"><label class="cs-label">Target selection - choose instances manually</label>
        <div class="sr__nodes"><label v-for="n in online" :key="n.id" class="cs-check"><input v-model="rf.targets" type="checkbox" :value="n.id" />{{ n.name }} <small>{{ n.id }}</small></label></div>
        <span class="cs-constraint">Only managed nodes that are Online are listed.</span></div>
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Concurrency</label><input v-model="rf.concurrency" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label">Error threshold</label><input v-model="rf.errors" class="cs-input" /></div>
      </div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="running = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !rf.targets.length" @click="run">Run</button>
    </template>
  </CsModal>

  <CsModal v-if="paramForm" :title="paramForm.edit ? 'Edit parameter' : 'Create parameter'" @close="paramForm = null">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Name</label><input v-model="paramForm.name" class="cs-input" :disabled="paramForm.edit" placeholder="/platform/network/vpc-id" /></div>
      <div class="cs-field"><label class="cs-label">Type</label><select v-model="paramForm.type" class="cs-select" :disabled="paramForm.edit"><option>String</option><option>StringList</option><option>SecureString</option></select></div>
      <div class="cs-field"><label class="cs-label">Value</label><textarea v-model="paramForm.value" class="cs-textarea" /></div>
      <div v-if="paramForm.managed" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" /><div>This parameter is managed by {{ paramForm.managed }}. Editing it here is drift.</div></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="paramForm = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !paramForm.name.trim() || !paramForm.value" @click="saveParam">{{ paramForm.edit ? 'Save changes' : 'Create parameter' }}</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete parameter" :busy="busy" @close="deleting = ''" @confirm="removeParam">
    <p class="sr__p">Delete <span class="cs-mono">{{ deleting }}</span>? This can't be undone.</p>
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
import NotFound from './NotFound.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const busy = ref(false);
const running = ref(false);
const deleting = ref('');
const paramForm = ref<any>(null);

const commands = computed(() => rows<any>(ctx.c.value, 'ssm.commands').map(x => ({ ...x, targetsText: `${x.invocations.filter((i: any) => i.status === 'Success').length} / ${x.invocations.length}` })));
const command = computed<any>(() => commands.value.find(x => x.id === ctx.route.value.params?.id) || null);
const online = computed(() => rows<any>(ctx.c.value, 'ssm.nodes').filter(n => n.ping === 'Online'));
const params = computed(() => rows<any>(ctx.c.value, 'ssm.parameters').map(p => ({ ...p, tier: 'Standard', managed: p.managed_by || '-' })));

function kind(status: string) {
  if (status === 'Success') return 'success';
  if (status === 'InProgress') return 'in-progress';
  if (status === 'Pending') return 'pending';
  if (['Failed', 'DeliveryTimedOut', 'Undeliverable', 'Cancelled'].includes(status)) return 'error';
  return 'info';
}
const cols = [{ id: 'id', header: 'Command ID' }, { id: 'status', header: 'Status' }, { id: 'requested', header: 'Requested date time' },
  { id: 'document', header: 'Document name' }, { id: 'operation', header: 'Operation' }, { id: 'targetsText', header: 'Succeeded / targets' }, { id: 'origin', header: 'Comment' }];
const invCols = [{ id: 'instance', header: 'Instance ID' }, { id: 'name', header: 'Instance name' }, { id: 'status', header: 'Status' }, { id: 'detail', header: 'Detailed status', cell: (i: any) => i.detail || '-' }];
const paramCols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'tier', header: 'Tier' }, { id: 'type', header: 'Type' }, { id: 'value', header: 'Value' },
  { id: 'version', header: 'Version' }, { id: 'managed', header: 'Managed by' }];

const rf = reactive({ document: 'AWS-RunPowerShellScript', operation: 'Scan', commands: '', targets: [] as string[], concurrency: '50', errors: '0' });
async function run() {
  busy.value = true;
  const parameters = rf.document === 'AWS-RunPatchBaseline' ? `Operation=${rf.operation}` : (rf.commands.trim() ? JSON.stringify({ commands: [rf.commands.trim()] }) : '');
  const result = await ctx.run(cli(['aws', 'ssm', 'send-command'], {
    '--document-name': rf.document, '--instance-ids': rf.targets, '--parameters': parameters,
    '--max-concurrency': rf.concurrency, '--max-errors': rf.errors,
  }), 'Command sent successfully.');
  busy.value = false;
  if (result.ok) running.value = false;
}
function openParam(p: any) {
  paramForm.value = p ? { edit: true, name: p.name, type: p.type, value: p.value, managed: p.managed_by } : { edit: false, name: '', type: 'String', value: '', managed: '' };
}
async function saveParam() {
  const f = paramForm.value;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ssm', 'put-parameter'], { '--name': f.name.trim(), '--value': f.value, '--type': f.type, '--overwrite': f.edit }),
    f.edit ? `Parameter ${f.name} updated.` : `Create parameter request succeeded.`);
  busy.value = false;
  if (result.ok) paramForm.value = null;
}
async function removeParam() {
  busy.value = true;
  const name = deleting.value;
  await ctx.run(cli(['aws', 'ssm', 'delete-parameter'], { '--name': name }), `Parameter ${name} deleted.`);
  busy.value = false;
  deleting.value = '';
  sel.value = [];
}
</script>

<style scoped>
.sr__nodes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 6px 16px; max-height: 220px; overflow: auto; border: 1px solid #ebebf0; border-radius: 8px; padding: 8px 12px; }
.sr__nodes small { color: #656871; margin-left: 4px; }
.sr__p { margin: 0; }
</style>
