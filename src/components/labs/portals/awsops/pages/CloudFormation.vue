<template>
  <CsTable v-if="page === 'stacks'" variant="full-page" title="Stacks" :items="stacks" :columns="stackCols" track-by="name" selection-type="single" v-model:selected="sel"
           filter-placeholder="Filter by stack name" empty-title="No stacks">
    <template #actions>
      <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = sel[0]">Delete</button>
      <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('cloudformation', 'stack-create')">Create stack</button>
    </template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('cloudformation', 'stack', { name: row.name, id: row.id })">{{ row.name }}</a></template>
    <template #cell-status="{ row }"><CsStatus :type="statusKind(row.status)" :label="row.status" /></template>
  </CsTable>

  <div v-else-if="page === 'stack-create'">
    <CsHeader title="Create stack" description="Specify a template - the same YAML or JSON the CLI takes in --template-body." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Specify template" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Template file in the lab workspace <small>- optional</small></label>
          <input v-model="tf.file" class="cs-input" placeholder="templates/network.yaml" />
          <span class="cs-constraint">Sent as --template-body file://path. Leave empty to write the template below.</span></div>
        <textarea v-if="!tf.file.trim()" v-model="tf.body" class="cs-textarea cs-mono cf__tpl" spellcheck="false" placeholder="AWSTemplateFormatVersion: '2010-09-09'" />
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Stack details" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Stack name</label><input v-model="tf.name" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label">Parameters <small>- optional</small></label><input v-model="tf.params" class="cs-input" placeholder="Environment=prod" />
          <span class="cs-constraint">Key=Value pairs separated by spaces.</span></div>
        <label class="cs-check"><input v-model="tf.protect" type="checkbox" /><span>Termination protection</span></label>
        <label class="cs-check"><input v-model="tf.iam" type="checkbox" /><span>I acknowledge that AWS CloudFormation might create IAM resources.</span></label>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('cloudformation', 'stacks')">Cancel</button>
      <button type="button" class="cs-btn" :disabled="busy || !tplBody()" @click="validateTpl">Validate template</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !/^[A-Za-z][\w-]{0,127}$/.test(tf.name) || !tplBody()" @click="createStack">Submit</button>
    </div>
  </div>

  <div v-else-if="page === 'stack' && stack">
    <CsHeader :title="stack.name"><template #actions>
      <button type="button" class="cs-btn" @click="deleting = stack.name">Delete</button>
      <CsDropdown label="Stack actions" :items="stackActions" @select="stackAct" />
    </template></CsHeader>
    <div class="cs-tabs">
      <button v-for="t in TABS" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <section v-if="tab === 'Stack info'" class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Stack ID</dt><dd class="cs-mono">{{ stack.id }}</dd></div><div><dt>Status</dt><dd><CsStatus :type="statusKind(stack.status)" :label="stack.status" /></dd></div>
      <div><dt>Status reason</dt><dd>{{ stack.reason || '-' }}</dd></div><div><dt>Created time</dt><dd>{{ awsDate(stack.created) }}</dd></div>
      <div><dt>Termination protection</dt><dd>{{ stack.protected ? 'Activated' : 'Deactivated' }}</dd></div>
      <div><dt>Drift status</dt><dd><CsStatus :type="stack.drift === 'DRIFTED' ? 'warning' : stack.drift === 'IN_SYNC' ? 'success' : 'stopped'" :label="stack.drift" /></dd></div>
      <div><dt>Created by</dt><dd>{{ stack.origin === 'cdk' ? 'AWS CDK' : 'CloudFormation' }}</dd></div>
    </dl></div></section>
    <CsTable v-else-if="tab === 'Events'" title="Events" :items="stack.events.map((e: any, i: number) => ({ ...e, key: i }))" :columns="evCols" track-by="key">
      <template #cell-status="{ row }"><CsStatus :type="statusKind(row.status)" :label="row.status" /></template>
    </CsTable>
    <CsTable v-else-if="tab === 'Resources'" title="Resources" :items="stack.resources" :columns="resCols" track-by="logical" />
    <CsTable v-else-if="tab === 'Outputs'" title="Outputs" :items="outputs" :columns="outCols" track-by="key" empty-title="No outputs" />
    <section v-else-if="tab === 'Template'" class="cs-container"><div class="cs-container__body"><pre class="cs-code">{{ pretty(stack.template) }}</pre></div></section>
    <div v-else-if="tab === 'Change sets'">
      <CsTable title="Change sets" :items="changesets" :columns="csCols" track-by="name" selection-type="single" v-model:selected="csSel" empty-title="No change sets">
        <template #actions>
          <button type="button" class="cs-btn" :disabled="!csSel.length || busy" @click="deleteChangeSet">Delete</button>
          <button type="button" class="cs-btn" :disabled="!csSel.length || busy || changesets.find(c => c.name === csSel[0])?.executed" @click="executeChangeSet">Execute change set</button>
          <button type="button" class="cs-btn cs-btn--primary" @click="openChangeSet">Create change set</button>
        </template>
      </CsTable>
      <section v-if="changeset" class="cs-container cf__space">
        <div class="cs-container__head"><CsHeader :title="`Changes: ${changeset.name}`" :level="2" :info="false" /></div>
        <div class="cs-container__body cs-scroll-x"><table class="cs-table-mini"><thead><tr><th>Action</th><th>Logical ID</th><th>Physical ID</th><th>Resource type</th><th>Replacement</th></tr></thead>
          <tbody><tr v-for="(ch, i) in changeset.changes" :key="i"><td>{{ ch.Action }}</td><td>{{ ch.LogicalResourceId }}</td><td>{{ ch.PhysicalResourceId || '-' }}</td>
            <td>{{ ch.ResourceType }}</td><td><span :class="{ cf__bad: ch.Replacement === 'True' }">{{ ch.Replacement }}</span></td></tr></tbody></table></div>
      </section>
    </div>
    <CsTable v-else title="Resource drift results" :items="stack.drift_rows" :columns="driftCols" track-by="logical"
             empty-title="Drift not detected yet" empty-text="Choose Stack actions, Detect drift.">
      <template #cell-status="{ row }"><CsStatus :type="row.status === 'IN_SYNC' ? 'success' : 'warning'" :label="row.status" /></template>
    </CsTable>
  </div>

  <CsTable v-else-if="page === 'exports'" variant="full-page" title="Exports" :items="exports" :columns="expCols" track-by="name" empty-title="No exports" />

  <CsModal v-if="csForm" title="Create change set" size="large" @close="csForm = null">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Change set name</label><input v-model="csForm.name" class="cs-input" /></div>
      <div class="cs-field"><label class="cs-label">Template file in the lab workspace <small>- optional</small></label>
        <input v-model="csForm.file" class="cs-input" placeholder="templates/network.yaml" /></div>
      <textarea v-if="!csForm.file.trim()" v-model="csForm.body" class="cs-textarea cs-mono cf__tpl" spellcheck="false" />
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="csForm = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !csForm.name || !(csForm.file.trim() || csForm.body.trim())" @click="createChangeSet">Create change set</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete stack?" :busy="busy" @close="deleting = ''" @confirm="remove">
    <p class="cf__p">Deleting this stack will delete all stack resources (except those with DeletionPolicy: Retain). Termination protection refuses this.</p>
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
import { awsDate, pretty } from '../kit';

const TABS = ['Stack info', 'Events', 'Resources', 'Outputs', 'Template', 'Change sets', 'Drifts'];
const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const csSel = ref<string[]>([]);
const tab = ref('Stack info');
const busy = ref(false);
const deleting = ref('');
const csForm = ref<any>(null);

const stacks = computed(() => rows<any>(ctx.c.value, 'iac.stacks').map(s => ({ ...s, createdText: awsDate(s.created) })));
const stack = computed<any>(() => stacks.value.find(s => s.name === ctx.route.value.params?.name) || null);
const changesets = computed(() => rows<any>(ctx.c.value, 'iac.changesets').filter(c => c.stack === stack.value?.name).map(c => ({ ...c,
  exec: c.executed ? 'EXECUTE_COMPLETE' : 'AVAILABLE', count: c.changes.length })));
const changeset = computed<any>(() => changesets.value.find(c => c.name === csSel.value[0]) || null);
const outputs = computed(() => Object.entries(stack.value?.outputs || {}).map(([key, value]) => ({ key, value,
  export: Object.entries(stack.value.exports || {}).find(([, v]) => v === value)?.[0] || '-' })));
const exports = computed(() => stacks.value.flatMap(s => Object.entries(s.exports || {}).map(([name, value]) => ({ name, value, stack: s.name }))));

function statusKind(s: string) {
  if (/FAILED|ROLLBACK/.test(s)) return 'error';
  if (/IN_PROGRESS/.test(s)) return 'in-progress';
  if (/COMPLETE/.test(s)) return 'success';
  return 'info';
}
const stackCols = [{ id: 'name', header: 'Stack name', sortKey: 'name' }, { id: 'status', header: 'Status' }, { id: 'createdText', header: 'Created time' },
  { id: 'drift', header: 'Drift status' }];
const evCols = [{ id: 'time', header: 'Timestamp (shift)' }, { id: 'logical', header: 'Logical ID' }, { id: 'status', header: 'Status' },
  { id: 'reason', header: 'Status reason', cell: (e: any) => e.reason || '-' }];
const resCols = [{ id: 'logical', header: 'Logical ID' }, { id: 'physical', header: 'Physical ID' }, { id: 'type', header: 'Type' }, { id: 'policy', header: 'Deletion policy' }];
const outCols = [{ id: 'key', header: 'Key' }, { id: 'value', header: 'Value' }, { id: 'export', header: 'Export name' }];
const csCols = [{ id: 'name', header: 'Name' }, { id: 'type', header: 'Type' }, { id: 'exec', header: 'Execution status' }, { id: 'count', header: 'Changes' }];
const driftCols = [{ id: 'logical', header: 'Logical ID' }, { id: 'physical', header: 'Physical ID' }, { id: 'type', header: 'Type' }, { id: 'status', header: 'Drift status' }];
const expCols = [{ id: 'name', header: 'Export name' }, { id: 'value', header: 'Export value' }, { id: 'stack', header: 'Exporting stack' }];
const stackActions = computed(() => [{ id: 'protect', text: stack.value?.protected ? 'Deactivate termination protection' : 'Activate termination protection' },
  { id: 'drift', text: 'Detect drift' }, { id: 'changeset', text: 'Create change set for current stack' }]);

const tf = reactive({ file: '', body: '', name: '', params: '', protect: false, iam: false });
function tplBody() { return tf.file.trim() ? `file://${tf.file.trim()}` : tf.body.trim() ? tf.body : ''; }
function paramWords(text: string) { return text.trim().split(/\s+/).filter(Boolean).map(p => { const [k, ...v] = p.split('='); return `ParameterKey=${k},ParameterValue=${v.join('=')}`; }); }
async function validateTpl() {
  busy.value = true;
  await ctx.run(cli(['aws', 'cloudformation', 'validate-template'], { '--template-body': tplBody() }), 'Template is valid.');
  busy.value = false;
}
async function createStack() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'cloudformation', 'create-stack'], { '--stack-name': tf.name, '--template-body': tplBody(),
    '--parameters': paramWords(tf.params), '--capabilities': tf.iam ? ['CAPABILITY_NAMED_IAM'] : [], '--enable-termination-protection': tf.protect }));
  busy.value = false;
  if (result.ok) { ctx.api.notify('success', `Stack ${tf.name} created.`); ctx.to('cloudformation', 'stack', { name: tf.name }); }
}
async function stackAct(action: string) {
  if (action === 'changeset') { tab.value = 'Change sets'; openChangeSet(); return; }
  busy.value = true;
  if (action === 'protect') await ctx.run(cli(['aws', 'cloudformation', 'update-termination-protection'], { '--stack-name': stack.value.name,
    '--enable-termination-protection': !stack.value.protected, '--no-enable-termination-protection': stack.value.protected }), 'Termination protection updated.');
  if (action === 'drift') {
    const result = await ctx.run(cli(['aws', 'cloudformation', 'detect-stack-drift'], { '--stack-name': stack.value.name }), 'Drift detection complete.');
    if (result.ok) tab.value = 'Drifts';
  }
  busy.value = false;
}
function openChangeSet() { csForm.value = { name: '', file: '', body: typeof stack.value?.template === 'string' ? stack.value.template : pretty(stack.value?.template || {}) }; }
async function createChangeSet() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'cloudformation', 'create-change-set'], { '--stack-name': stack.value.name, '--change-set-name': csForm.value.name.trim(),
    '--template-body': csForm.value.file.trim() ? `file://${csForm.value.file.trim()}` : csForm.value.body }), `Change set ${csForm.value.name} created.`);
  busy.value = false;
  if (result.ok) { csSel.value = [csForm.value.name.trim()]; csForm.value = null; }
}
async function executeChangeSet() {
  busy.value = true;
  await ctx.run(cli(['aws', 'cloudformation', 'execute-change-set'], { '--stack-name': stack.value.name, '--change-set-name': csSel.value[0] }), `Change set ${csSel.value[0]} executed.`);
  busy.value = false;
}
async function deleteChangeSet() {
  busy.value = true;
  await ctx.run(cli(['aws', 'cloudformation', 'delete-change-set'], { '--stack-name': stack.value.name, '--change-set-name': csSel.value[0] }), 'Change set deleted.');
  busy.value = false;
  csSel.value = [];
}
async function remove() {
  busy.value = true;
  const name = deleting.value;
  const result = await ctx.run(cli(['aws', 'cloudformation', 'delete-stack'], { '--stack-name': name }), `Delete of stack ${name} started.`);
  busy.value = false;
  deleting.value = '';
  if (result.ok) { sel.value = []; if (page.value === 'stack') ctx.to('cloudformation', 'stacks'); }
}
</script>

<style scoped>
.cf__tpl { min-height: 300px; }
.cf__space { margin-top: 20px; }
.cf__bad { color: #db0000; font-weight: 700; }
.cf__p { margin: 0; }
</style>
