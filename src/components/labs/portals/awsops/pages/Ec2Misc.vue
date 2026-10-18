<template>
  <!-- Dashboard -->
  <div v-if="page === 'dashboard'">
    <CsHeader title="Resources" :description="`You are using the following Amazon EC2 resources in the ${regionName(ctx.region.value)} Region:`" />
    <section class="cs-container">
      <div class="cs-container__body e2__grid">
        <a v-for="item in resources" :key="item.label" href="#" class="e2__res" @click.prevent="ctx.to('ec2', item.page)">
          <span class="cs-link">{{ item.label }}</span><strong>{{ item.count }}</strong></a>
      </div>
    </section>
  </div>

  <!-- Launch templates -->
  <CsTable v-else-if="page === 'launch-templates'" variant="full-page" title="Launch templates" :items="templates" :columns="ltCols" track-by="name">
    <template #actions><button type="button" class="cs-btn cs-btn--primary" disabled>Create launch template</button></template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'launch-template', { name: row.name })">{{ row.name }}</a></template>
  </CsTable>

  <div v-else-if="page === 'launch-template' && template">
    <CsHeader :title="`${template.id} (${template.name})`">
      <template #actions><CsDropdown :items="[{ id: 'version', text: 'Modify template (Create new version)' }, { id: 'default', text: 'Set default version' }]" @select="ltAct" /></template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Launch template details" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Launch template ID</dt><dd class="cs-mono">{{ template.id }}</dd></div><div><dt>Launch template name</dt><dd>{{ template.name }}</dd></div>
        <div><dt>Default version</dt><dd>{{ template.default }}</dd></div><div><dt>Latest version</dt><dd>{{ template.latest }}</dd></div>
      </dl></div>
    </section>
    <CsTable title="Versions" :items="template.versions" :columns="verCols" track-by="number" selection-type="single" v-model:selected="verSel">
      <template #cell-number="{ row }">{{ row.number }}<span v-if="row.number === template.default" class="cs-badge cs-badge--grey e2__def">Default</span></template>
      <template #cell-imdsv2="{ row }">{{ row.imdsv2 ? 'Required' : 'Optional' }}</template>
    </CsTable>
  </div>

  <!-- AMIs -->
  <CsTable v-else-if="page === 'amis'" variant="full-page" title="Amazon Machine Images (AMIs)" :items="amis" :columns="amiCols" track-by="id" filter-placeholder="Find AMI by attribute or tag">
    <template #cell-status><CsStatus state="available" /></template>
  </CsTable>

  <!-- Snapshots -->
  <div v-else-if="page === 'snapshots'">
    <CsTable variant="full-page" title="Snapshots" :items="snapshots" :columns="snapCols" track-by="id" selection-type="single" v-model:selected="snapSel">
      <template #actions><CsDropdown :items="[{ id: 'delete', text: 'Delete snapshot' }]" :disabled="!snapSel.length" @select="deletingSnap = snapSel[0]" /></template>
      <template #cell-status><CsStatus type="success" label="Completed" /></template>
    </CsTable>
    <CsDelete v-if="deletingSnap" title="Delete snapshot" word="delete" :busy="busy" warning="A snapshot taken for an incident is evidence. Deleting it cannot be undone."
              @close="deletingSnap = ''" @confirm="deleteSnap">
      <p class="e2__p">Delete <span class="cs-mono">{{ deletingSnap }}</span>?</p>
    </CsDelete>
  </div>
  <NotFound v-else what="Launch template" :id="ctx.route.value.params?.name || ''" back="launch-templates" />

  <CsModal v-if="versioning" title="Create new launch template version" size="large" @close="versioning = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Template version description</label><input v-model="ver.description" class="cs-input" maxlength="255" placeholder="Prod webserver for MyApp" /></div>
      <div class="cs-field"><label class="cs-label">Source template version</label>
        <select v-model="ver.source" class="cs-select"><option v-for="v in template?.versions" :key="v.number" :value="String(v.number)">{{ v.number }}{{ v.number === template?.default ? ' (Default)' : '' }}</option></select></div>
      <div class="cs-field"><label class="cs-label">Amazon Machine Image (AMI)</label>
        <select v-model="ver.ami" class="cs-select"><option v-for="a in amis" :key="a.id" :value="a.id">{{ a.name }} ({{ a.id }})</option></select></div>
      <div class="cs-field"><label class="cs-label">Instance type</label>
        <select v-model="ver.type" class="cs-select"><option v-for="t in ['c5.large', 'm5.large', 'm5.xlarge', 't3.large']" :key="t" :value="t">{{ t }}</option></select></div>
      <div class="cs-field"><label class="cs-label">Metadata version (IMDS)</label>
        <select v-model="ver.tokens" class="cs-select"><option value="required">V2 only (token required)</option><option value="optional">V1 and V2 (token optional)</option></select></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="versioning = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="createVersion"><span v-if="busy" class="cs-btn__spinner" />Create template version</button>
    </template>
  </CsModal>

  <CsModal v-if="defaulting" title="Set default version" @close="defaulting = false">
    <div class="cs-field"><label class="cs-label">Template version</label>
      <select v-model="defVersion" class="cs-select"><option v-for="v in template?.versions" :key="v.number" :value="String(v.number)">{{ v.number }}</option></select></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="defaulting = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="setDefault">Set as default version</button>
    </template>
  </CsModal>
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
import { awsDate } from '../kit';
import { regionName } from '../nav';
import NotFound from './NotFound.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const busy = ref(false);
const verSel = ref<string[]>([]);
const snapSel = ref<string[]>([]);
const deletingSnap = ref('');
const versioning = ref(false);
const defaulting = ref(false);
const defVersion = ref('1');

const templates = computed(() => rows<any>(ctx.c.value, 'ec2.launch_templates'));
const template = computed<any>(() => templates.value.find(t => t.name === ctx.route.value.params?.name) || null);
const amis = computed(() => rows<any>(ctx.c.value, 'ec2.amis').map(a => ({ ...a, ownerText: a.owner === 'self' ? ctx.account.value : 'amazon',
  platformText: a.platform === 'windows' ? 'Windows' : 'Linux/UNIX' })));
const snapshots = computed(() => rows<any>(ctx.c.value, 'ec2.snapshots').map(s => ({ ...s, started: awsDate(s.stamp), size: '80 GiB' })));
const resources = computed(() => {
  const inst = rows<any>(ctx.c.value, 'ec2.instances').filter(i => i.region === ctx.region.value);
  return [
    { label: 'Instances (running)', count: inst.filter(i => i.state === 'running').length, page: 'instances' },
    { label: 'Auto Scaling Groups', count: rows<any>(ctx.c.value, 'ec2.asgs').length, page: 'asgs' },
    { label: 'Load balancers', count: rows<any>(ctx.c.value, 'ec2.albs').length, page: 'load-balancers' },
    { label: 'Security groups', count: rows<any>(ctx.c.value, 'net.sgs').length, page: 'sgs' },
    { label: 'Snapshots', count: snapshots.value.length, page: 'snapshots' },
    { label: 'Launch templates', count: templates.value.length, page: 'launch-templates' },
    { label: 'Instances (all states)', count: inst.length, page: 'instances' },
    { label: 'AMIs', count: amis.value.length, page: 'amis' },
  ];
});

const ltCols = [{ id: 'id', header: 'Launch template ID' }, { id: 'name', header: 'Launch template name' },
  { id: 'default', header: 'Default version' }, { id: 'latest', header: 'Latest version' }];
const verCols = [{ id: 'number', header: 'Version' }, { id: 'description', header: 'Description' }, { id: 'ami', header: 'AMI ID' },
  { id: 'type', header: 'Instance type' }, { id: 'imdsv2', header: 'IMDSv2' }];
const amiCols = [{ id: 'name', header: 'AMI name', sortKey: 'name' }, { id: 'id', header: 'AMI ID' }, { id: 'ownerText', header: 'Owner' },
  { id: 'created', header: 'Creation date', sortKey: 'created' }, { id: 'platformText', header: 'Platform' },
  { id: 'patched_days_ago', header: 'Patched', cell: (a: any) => a.description || '-' }, { id: 'status', header: 'Status' }];
const snapCols = [{ id: 'id', header: 'Snapshot ID' }, { id: 'volume', header: 'Volume ID' }, { id: 'instance', header: 'Source instance' },
  { id: 'description', header: 'Description' }, { id: 'status', header: 'Snapshot status' }, { id: 'started', header: 'Started' }];

const ver = reactive({ description: '', source: '1', ami: '', type: 'c5.large', tokens: 'required' });
function ltAct(action: string) {
  if (!template.value) return;
  if (action === 'version') {
    const base = template.value.versions.find((v: any) => v.number === template.value.default) || template.value.versions[0];
    Object.assign(ver, { description: '', source: String(template.value.default), ami: base?.ami || '', type: base?.type || 'c5.large', tokens: 'required' });
    versioning.value = true;
  }
  if (action === 'default') { defVersion.value = String(template.value.latest); defaulting.value = true; }
}
async function createVersion() {
  busy.value = true;
  const data = JSON.stringify({ ImageId: ver.ami, InstanceType: ver.type, MetadataOptions: { HttpTokens: ver.tokens } });
  const result = await ctx.run(cli(['aws', 'ec2', 'create-launch-template-version'], {
    '--launch-template-name': template.value.name, '--source-version': ver.source,
    '--version-description': ver.description.trim(), '--launch-template-data': data,
  }), `Successfully created a new version of launch template ${template.value.id}.`);
  busy.value = false;
  if (result.ok) versioning.value = false;
}
async function setDefault() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'modify-launch-template'], {
    '--launch-template-name': template.value.name, '--default-version': defVersion.value,
  }), `Default version of ${template.value.name} set to ${defVersion.value}.`);
  busy.value = false;
  if (result.ok) defaulting.value = false;
}
async function deleteSnap() {
  busy.value = true;
  const sid = deletingSnap.value;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-snapshot'], { '--snapshot-id': sid }), `Successfully deleted snapshot ${sid}`);
  busy.value = false;
  deletingSnap.value = '';
  if (result.ok) snapSel.value = [];
}
</script>

<style scoped>
.e2__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 12px 24px; }
.e2__res { display: flex; justify-content: space-between; padding: 10px 14px; border: 1px solid #ebebf0; border-radius: 8px; text-decoration: none; }
.e2__res strong { color: #0f141a; }
.e2__def { margin-left: 8px; }
.e2__p { margin: 0; }
</style>
