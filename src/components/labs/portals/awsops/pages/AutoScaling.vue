<template>
  <CsTable v-if="page === 'asgs'" variant="full-page" title="Auto Scaling groups" :items="groups" :columns="cols" track-by="name"
           selection-type="single" v-model:selected="sel" filter-placeholder="Search your Auto Scaling groups">
    <template #actions>
      <CsDropdown :items="[{ id: 'edit', text: 'Edit' }, { id: 'delete', text: 'Delete', disabled: true }]" :disabled="!sel.length"
                  @select="ctx.to('ec2', 'asg', { name: sel[0], edit: '1' })" />
      <button type="button" class="cs-btn cs-btn--primary" disabled>Create Auto Scaling group</button>
    </template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'asg', { name: row.name })">{{ row.name }}</a></template>
    <template #cell-status="{ row }"><span v-if="row.refreshStatus === 'InProgress'"><CsStatus type="in-progress" label="Updating capacity..." /></span><span v-else>-</span></template>
  </CsTable>

  <div v-else-if="group">
    <CsHeader :title="group.name">
      <template #actions><button type="button" class="cs-btn" @click="openEdit">Edit</button></template>
    </CsHeader>
    <div class="cs-tabs">
      <button v-for="t in TABS" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>

    <template v-if="tab === 'Details'">
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Group details" :level="2"><template #actions><button type="button" class="cs-btn" @click="openEdit">Edit</button></template></CsHeader></div>
        <div class="cs-container__body"><dl class="cs-kv">
          <div><dt>Desired capacity</dt><dd>{{ group.desired }}</dd></div><div><dt>Minimum capacity</dt><dd>{{ group.min }}</dd></div>
          <div><dt>Maximum capacity</dt><dd>{{ group.max }}</dd></div><div><dt>Instances</dt><dd>{{ group.instances.length }}</dd></div>
        </dl></div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Launch template" :level="2" /></div>
        <div class="cs-container__body"><dl class="cs-kv">
          <div><dt>Launch template</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'launch-template', { name: group.lt })">{{ group.lt }}</a></dd></div>
          <div><dt>Version</dt><dd>{{ group.version }}</dd></div>
          <div><dt>AMI ID</dt><dd class="cs-mono">{{ ltAmi }}</dd></div>
        </dl></div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Health checks" :level="2" /></div>
        <div class="cs-container__body"><dl class="cs-kv">
          <div><dt>Health check type</dt><dd>{{ group.health_type }}</dd></div>
          <div><dt>Health check grace period</dt><dd>{{ group.grace }} seconds</dd></div>
        </dl>
        <div v-if="group.health_type === 'EC2'" class="cs-alert cs-alert--info as__note"><CsIcon name="status-info" class="cs-alert__icon" />
          <div>With EC2 health checks the group replaces an instance only when its EC2 status checks fail. An instance the load balancer has marked unhealthy (a hung application) stays in service. Turn on Elastic Load Balancing health checks to replace it.</div></div></div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Network and load balancing" :level="2" /></div>
        <div class="cs-container__body"><dl class="cs-kv">
          <div><dt>Subnets</dt><dd>{{ group.subnets.join(', ') }}</dd></div>
          <div><dt>Load balancer target groups</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'target-group', { name: group.tg })">{{ group.tg }}</a></dd></div>
        </dl></div>
      </section>
    </template>

    <CsTable v-else-if="tab === 'Activity'" title="Activity history" :items="activities" :columns="actCols" track-by="key"
             empty-title="No activity" empty-text="Scaling activities appear here as the group launches and terminates instances." />

    <div v-else-if="tab === 'Instance management'">
      <CsTable title="Instances" :items="group.instances" :columns="instCols" track-by="id" selection-type="single" v-model:selected="instSel">
        <template #actions><CsDropdown :items="instActions" :disabled="!instSel.length" @select="instAct" /></template>
        <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'instance', { id: row.id })">{{ row.id }}</a></template>
        <template #cell-health="{ row }"><CsStatus :type="row.health === 'Healthy' ? 'success' : 'error'" :label="row.health" /></template>
        <template #cell-elb="{ row }"><CsStatus :type="row.elb_health === 'healthy' ? 'success' : row.elb_health === 'unhealthy' ? 'error' : 'pending'" :label="row.elb_health" /></template>
      </CsTable>
    </div>

    <div v-else-if="tab === 'Instance refresh'">
      <CsTable title="Instance refreshes" :items="group.refreshes" :columns="refCols" track-by="id"
               empty-title="No instance refreshes" empty-text="Start an instance refresh to replace instances with the group's current launch template.">
        <template #actions><button type="button" class="cs-btn cs-btn--primary" :disabled="refreshing" @click="startRefresh = true">Start instance refresh</button></template>
        <template #cell-status="{ row }"><CsStatus :type="row.status === 'Successful' ? 'success' : row.status === 'InProgress' ? 'in-progress' : row.status === 'Failed' || row.status === 'Cancelled' ? 'error' : 'info'" :label="row.status" /></template>
      </CsTable>
    </div>
  </div>
  <NotFound v-else what="Auto Scaling group" :id="name" back="asgs" />

  <CsModal v-if="editing" title="Edit Auto Scaling group" size="large" @close="editing = false">
    <div class="cs-stack">
      <h3 class="as__h">Group size</h3>
      <div class="cs-grid-3">
        <div class="cs-field"><label class="cs-label">Desired capacity</label><input v-model="edit.desired" class="cs-input" inputmode="numeric" /></div>
        <div class="cs-field"><label class="cs-label">Min desired capacity</label><input v-model="edit.min" class="cs-input" inputmode="numeric" /></div>
        <div class="cs-field"><label class="cs-label">Max desired capacity</label><input v-model="edit.max" class="cs-input" inputmode="numeric" /></div>
      </div>
      <span v-if="sizeProblem" class="cs-error-text">{{ sizeProblem }}</span>
      <h3 class="as__h">Launch template</h3>
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Launch template</label><select v-model="edit.lt" class="cs-select"><option v-for="t in templates" :key="t.name" :value="t.name">{{ t.name }}</option></select></div>
        <div class="cs-field"><label class="cs-label">Version</label><select v-model="edit.version" class="cs-select">
          <option value="$Default">Default ($Default)</option><option value="$Latest">Latest ($Latest)</option>
          <option v-for="v in versionsOf(edit.lt)" :key="v.number" :value="String(v.number)">{{ v.number }}</option></select></div>
      </div>
      <h3 class="as__h">Health checks</h3>
      <label class="cs-check"><input type="checkbox" checked disabled /><span>EC2 health checks<small>Always enabled</small></span></label>
      <label class="cs-check"><input v-model="edit.elb" type="checkbox" /><span>Turn on Elastic Load Balancing health checks<small>Replace instances the load balancer reports as unhealthy.</small></span></label>
      <div class="cs-field"><label class="cs-label">Health check grace period</label><input v-model="edit.grace" class="cs-input as__narrow" inputmode="numeric" /><span class="cs-constraint">seconds</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="editing = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!sizeProblem" @click="saveEdit"><span v-if="busy" class="cs-btn__spinner" />Update</button>
    </template>
  </CsModal>

  <CsModal v-if="startRefresh" title="Start instance refresh" @close="startRefresh = false">
    <div class="cs-stack">
      <p class="cs-muted as__p">Instances are replaced in batches, launched from the group's launch template ({{ group?.lt }}, version {{ group?.version }}).</p>
      <div class="cs-field"><label class="cs-label">Minimum healthy percentage</label><input v-model="refresh.minHealthy" class="cs-input as__narrow" inputmode="numeric" /><span class="cs-constraint">The percentage of the desired capacity that must remain healthy during the refresh.</span></div>
      <div class="cs-field"><label class="cs-label">Instance warmup <small>- optional</small></label><input v-model="refresh.warmup" class="cs-input as__narrow" inputmode="numeric" placeholder="300" /><span class="cs-constraint">seconds</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="startRefresh = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !/^\d+$/.test(refresh.minHealthy)" @click="doRefresh">Start instance refresh</button>
    </template>
  </CsModal>

  <CsModal v-if="instDialog" :title="instDialog.title" @close="instDialog = null">
    <p class="as__p">{{ instDialog.text }}</p>
    <label v-if="instDialog.kind !== 'health'" class="cs-check"><input v-model="decrement" type="checkbox" />
      <span>Decrement desired capacity<small>Without it, the group launches a replacement to keep its desired capacity.</small></span></label>
    <div v-else class="cs-field"><label class="cs-label">Health status</label><select v-model="healthStatus" class="cs-select"><option>Healthy</option><option>Unhealthy</option></select></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="instDialog = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="doInst">{{ instDialog.action }}</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import NotFound from './NotFound.vue';

const TABS = ['Details', 'Activity', 'Instance management', 'Instance refresh'];
const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const name = computed(() => ctx.route.value.params?.name || '');
const sel = ref<string[]>([]);
const instSel = ref<string[]>([]);
const tab = ref('Details');
const busy = ref(false);
const editing = ref(false);
const startRefresh = ref(false);
const instDialog = ref<any>(null);
const decrement = ref(false);
const healthStatus = ref('Unhealthy');

const groups = computed(() => rows<any>(ctx.c.value, 'ec2.asgs').map(g => ({
  ...g, count: g.instances.length, ltText: `${g.lt} | Version ${g.version}`,
  refreshStatus: g.refreshes[0]?.status || '', azs: 'eu-west-1a, eu-west-1b',
})));
const group = computed<any>(() => groups.value.find(g => g.name === name.value) || null);
const templates = computed(() => rows<any>(ctx.c.value, 'ec2.launch_templates'));
const refreshing = computed(() => group.value?.refreshes[0]?.status === 'InProgress');
const activities = computed(() => (group.value?.activities || []).map((a: any, i: number) => ({ ...a, key: i, status: 'Successful' })));
function versionsOf(lt: string) { return templates.value.find(t => t.name === lt)?.versions || []; }
const ltAmi = computed(() => {
  const t = templates.value.find(x => x.name === group.value?.lt);
  if (!t) return '-';
  const wanted = group.value.version === '$Latest' ? t.latest : group.value.version === '$Default' ? t.default : Number(group.value.version);
  return t.versions.find((v: any) => v.number === wanted)?.ami || '-';
});

const cols = [
  { id: 'name', header: 'Name', sortKey: 'name' }, { id: 'ltText', header: 'Launch template/configuration' },
  { id: 'count', header: 'Instances', sortKey: 'count' }, { id: 'status', header: 'Status' },
  { id: 'desired', header: 'Desired capacity' }, { id: 'min', header: 'Min' }, { id: 'max', header: 'Max' },
  { id: 'azs', header: 'Availability Zones' },
];
const actCols = [{ id: 'status', header: 'Status' }, { id: 'what', header: 'Description' }, { id: 'time', header: 'Start time (shift)' }];
const instCols = [{ id: 'id', header: 'Instance ID' }, { id: 'lifecycle', header: 'Lifecycle' }, { id: 'type', header: 'Instance type' },
  { id: 'lt_version', header: 'Launch template version' }, { id: 'az', header: 'Availability Zone' },
  { id: 'health', header: 'Health status' }, { id: 'elb', header: 'Load balancer health' }];
const refCols = [{ id: 'id', header: 'Instance refresh ID' }, { id: 'status', header: 'Status' },
  { id: 'percent', header: 'Percentage complete', cell: (r: any) => `${r.percent}%` }, { id: 'version', header: 'Launch template version' },
  { id: 'min_healthy', header: 'Min healthy %' }, { id: 'started', header: 'Start time (shift)' }, { id: 'reason', header: 'Status reason' }];
const instActions = [{ id: 'detach', text: 'Detach' }, { id: 'health', text: 'Set to Unhealthy / Healthy' },
  { id: 'terminate', text: 'Terminate instance' }];

const edit = reactive({ desired: '', min: '', max: '', lt: '', version: '', elb: false, grace: '300' });
function openEdit() {
  if (!group.value) return;
  Object.assign(edit, { desired: String(group.value.desired), min: String(group.value.min), max: String(group.value.max),
    lt: group.value.lt, version: group.value.version, elb: group.value.health_type === 'ELB', grace: String(group.value.grace) });
  editing.value = true;
}
if (ctx.route.value.params?.edit && group.value) openEdit();
const sizeProblem = computed(() => {
  const [d, mn, mx] = [edit.desired, edit.min, edit.max].map(Number);
  if (![edit.desired, edit.min, edit.max].every(v => /^\d+$/.test(v))) return 'Capacity values must be whole numbers.';
  if (mn > mx) return 'Minimum capacity must be less than or equal to the maximum capacity.';
  if (d < mn || d > mx) return `Desired capacity must be between ${mn} and ${mx}.`;
  return '';
});
async function saveEdit() {
  const g = group.value;
  const ltChanged = edit.lt !== g.lt || edit.version !== g.version;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'autoscaling', 'update-auto-scaling-group'], {
    '--auto-scaling-group-name': g.name,
    '--min-size': Number(edit.min) !== g.min ? edit.min : '', '--max-size': Number(edit.max) !== g.max ? edit.max : '',
    '--desired-capacity': Number(edit.desired) !== g.desired ? edit.desired : '',
    '--health-check-type': (edit.elb ? 'ELB' : 'EC2') !== g.health_type ? (edit.elb ? 'ELB' : 'EC2') : '',
    '--health-check-grace-period': Number(edit.grace) !== g.grace ? edit.grace : '',
    '--launch-template': ltChanged ? `LaunchTemplateName=${edit.lt},Version=${edit.version}` : '',
  }), `${g.name} updated successfully.`);
  busy.value = false;
  if (result.ok) editing.value = false;
}

const refresh = reactive({ minHealthy: '90', warmup: '' });
async function doRefresh() {
  busy.value = true;
  const prefs = `MinHealthyPercentage=${refresh.minHealthy}` + (refresh.warmup.trim() ? `,InstanceWarmup=${refresh.warmup.trim()}` : '');
  const result = await ctx.run(cli(['aws', 'autoscaling', 'start-instance-refresh'], {
    '--auto-scaling-group-name': group.value.name, '--preferences': prefs,
  }), 'Instance refresh started. The group replaces its instances in batches as the scenario clock moves.');
  busy.value = false;
  if (result.ok) startRefresh.value = false;
}

function instAct(action: string) {
  const iid = instSel.value[0];
  if (!iid) return;
  decrement.value = false;
  if (action === 'detach') instDialog.value = { kind: 'detach', iid, title: 'Detach instance', action: 'Detach instance',
    text: `Detach ${iid} from ${group.value.name}? It keeps running, outside the group and its target group registration.` };
  if (action === 'terminate') instDialog.value = { kind: 'terminate', iid, title: 'Terminate instance', action: 'Terminate',
    text: `Terminate ${iid}?` };
  if (action === 'health') instDialog.value = { kind: 'health', iid, title: 'Set health', action: 'Set health',
    text: `Set the health status of ${iid}.` };
}
async function doInst() {
  const d = instDialog.value;
  busy.value = true;
  let command = '';
  if (d.kind === 'detach') command = cli(['aws', 'autoscaling', 'detach-instances'], {
    '--auto-scaling-group-name': group.value.name, '--instance-ids': [d.iid],
    '--should-decrement-desired-capacity': decrement.value, '--no-should-decrement-desired-capacity': !decrement.value });
  if (d.kind === 'terminate') command = cli(['aws', 'autoscaling', 'terminate-instance-in-auto-scaling-group'], {
    '--instance-id': d.iid, '--should-decrement-desired-capacity': decrement.value,
    '--no-should-decrement-desired-capacity': !decrement.value });
  if (d.kind === 'health') command = cli(['aws', 'autoscaling', 'set-instance-health'], { '--instance-id': d.iid, '--health-status': healthStatus.value });
  const result = await ctx.run(command, { detach: `Instance ${d.iid} detached`, terminate: `Terminating ${d.iid}`, health: `Health status of ${d.iid} set to ${healthStatus.value}` }[d.kind as 'detach']);
  busy.value = false;
  if (result.ok) { instDialog.value = null; instSel.value = []; }
}
</script>

<style scoped>
.as__h { margin: 4px 0 0; font-size: 16px; }
.as__p { margin: 0 0 12px; }
.as__note { margin: 16px 0 0; }
.as__narrow { width: 160px; }
</style>
