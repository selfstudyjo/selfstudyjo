<template>
  <!-- Instances -->
  <div v-if="page === 'instances'" @contextmenu="onRowMenu">
    <CsTable variant="full-page" title="Instances" :items="list" :columns="cols" track-by="id" selection-type="multi"
             v-model:selected="sel" filter-placeholder="Find Instance by attribute or tag (case-sensitive)">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Instances refreshed')"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" :disabled="sel.length !== 1" @click="connect">Connect</button>
        <CsDropdown label="Instance state" :items="stateItems" :disabled="!sel.length" @select="stateAct" />
        <CsDropdown :items="actionItems" :disabled="!sel.length" @select="act" />
        <button type="button" class="cs-btn cs-btn--primary" disabled title="This estate's instances are launched by Auto Scaling and Terraform">Launch instances</button>
      </template>
      <template #cell-id="{ row }"><a href="#" class="cs-link" :data-row="row.id" @click.prevent="ctx.to('ec2', 'instance', { id: row.id })">{{ row.id }}</a></template>
      <template #cell-state="{ row }"><CsStatus :state="row.state" /></template>
      <template #cell-status="{ row }">
        <span v-if="row.state !== 'running'" class="cs-muted">-</span>
        <CsStatus v-else :type="row.target_health === 'unhealthy' ? 'error' : 'success'" :label="row.target_health === 'unhealthy' ? '1/2 checks passed' : '2/2 checks passed'" />
      </template>
    </CsTable>
    <section v-if="sel.length === 1 && one" class="cs-container in__peek">
      <div class="cs-container__head"><CsHeader :title="`Instance: ${one.id} (${one.name})`" :level="2" :info="false" /></div>
      <div class="cs-container__body"><InstanceSummary :inst="one" /></div>
    </section>
  </div>

  <!-- One instance -->
  <div v-else-if="inst">
    <CsHeader :title="`Instance summary for ${inst.id} (${inst.name})`" description="Updated less than a minute ago">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Instance refreshed')"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" @click="connectOne(inst)">Connect</button>
        <CsDropdown label="Instance state" :items="stateItems" @select="stateAct" />
        <CsDropdown :items="actionItems" @select="act" />
      </template>
    </CsHeader>
    <section class="cs-container"><div class="cs-container__body"><InstanceSummary :inst="inst" /></div></section>
    <div class="cs-tabs">
      <button v-for="t in ['Details', 'Security', 'Networking', 'Storage', 'Tags']" :key="t" type="button" class="cs-tab"
              :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <section v-if="tab === 'Details'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Instance details" :level="2" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Platform</dt><dd>{{ inst.platform === 'windows' ? 'Windows' : 'Linux/UNIX' }}</dd></div>
        <div><dt>Platform details</dt><dd>{{ inst.os }}</dd></div>
        <div><dt>AMI ID</dt><dd class="cs-mono">{{ inst.ami }}</dd></div>
        <div><dt>Launch time</dt><dd>{{ awsDate(inst.launched) }}</dd></div>
        <div><dt>Termination protection</dt><dd>{{ inst.protect ? 'Enabled' : 'Disabled' }}</dd></div>
        <div><dt>Auto Scaling Group name</dt><dd>
          <a v-if="inst.asg" href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'asg', { name: inst.asg })">{{ inst.asg }}</a><span v-else>-</span></dd></div>
        <div><dt>IAM Role</dt><dd>
          <a v-if="inst.profile" href="#" class="cs-link" @click.prevent="ctx.to('iam', 'role', { name: roleOf(inst.profile) })">{{ inst.profile }}</a><span v-else>-</span></dd></div>
        <div><dt>Managed</dt><dd><CsStatus :type="inst.ssm === 'Online' ? 'success' : 'warning'" :label="inst.ssm === 'Online' ? 'true' : 'false'" />
          <div v-if="inst.ssm !== 'Online'" class="cs-muted">{{ inst.ssm }}: {{ inst.ssm_reason }}</div></dd></div>
      </dl></div>
    </section>
    <section v-else-if="tab === 'Security'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Security details" :level="2">
        <template #actions><button type="button" class="cs-btn" @click="openSgs">Change security groups</button></template></CsHeader></div>
      <div class="cs-container__body cs-stack">
        <dl class="cs-kv"><div><dt>IAM Role</dt><dd>{{ inst.profile || '-' }}</dd></div><div><dt>Owner ID</dt><dd>{{ ctx.account.value }}</dd></div></dl>
        <table class="cs-table-mini"><thead><tr><th>Security groups</th><th>Inbound rules</th></tr></thead>
          <tbody><tr v-for="g in inst.sgs" :key="g"><td><a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'sg', { id: g })">{{ g }} ({{ sgName(g) }})</a></td>
            <td>{{ sgRules(g) }}</td></tr></tbody></table>
      </div>
    </section>
    <section v-else-if="tab === 'Networking'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Networking details" :level="2" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Public IPv4 address</dt><dd>{{ inst.public_ip || '-' }}</dd></div>
        <div><dt>Private IPv4 addresses</dt><dd>{{ inst.ip }}</dd></div>
        <div><dt>VPC ID</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'vpc', { id: inst.vpc })">{{ inst.vpc || '-' }}</a></dd></div>
        <div><dt>Subnet ID</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'subnet', { id: inst.subnet })">{{ inst.subnet || '-' }}</a></dd></div>
        <div><dt>Availability Zone</dt><dd>{{ inst.az || '-' }}</dd></div>
      </dl></div>
    </section>
    <section v-else-if="tab === 'Storage'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Block devices" :level="2">
        <template #actions><button type="button" class="cs-btn" @click="snapping = inst">Create snapshot</button></template></CsHeader></div>
      <div class="cs-container__body cs-scroll-x"><table class="cs-table-mini"><thead><tr><th>Volume ID</th><th>Device name</th><th>Attachment status</th><th>Snapshots</th></tr></thead>
        <tbody><tr><td class="cs-mono">{{ volumeOf(inst) }}</td><td>{{ inst.platform === 'windows' ? '/dev/sda1' : '/dev/xvda' }}</td><td><CsStatus state="attached" /></td>
          <td>{{ snapshotsOf(inst).length }}</td></tr></tbody></table></div>
    </section>
    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Tags (${Object.keys(inst.tags).length})`" :level="2">
        <template #actions><button type="button" class="cs-btn" @click="openTags">Manage tags</button></template></CsHeader></div>
      <div class="cs-container__body cs-scroll-x"><table class="cs-table-mini"><thead><tr><th>Key</th><th>Value</th></tr></thead>
        <tbody><tr v-for="t in tagList(inst.tags)" :key="t.key"><td>{{ t.key }}</td><td>{{ t.value || '-' }}</td></tr></tbody></table></div>
    </section>
  </div>
  <NotFound v-else what="Instance" :id="id" back="instances" />

  <RowMenu v-if="rm.menu.value" :x="rm.menu.value.x" :y="rm.menu.value.y" :title="menuTitle" :items="menuItems"
           @select="menuAct" @close="rm.close" />

  <!-- State change confirmations -->
  <CsDelete v-if="confirm" :title="confirm.title" :action="confirm.action" :busy="busy" :word="confirm.verb === 'terminate' ? 'terminate' : ''"
            :warning="confirm.warning" @close="confirm = null" @confirm="doState">
    <p class="in__p">{{ confirm.text }}</p>
    <ul class="in__list"><li v-for="i in targets" :key="i.id"><span class="cs-mono">{{ i.id }}</span> ({{ i.name }})</li></ul>
  </CsDelete>

  <CsModal v-if="typing" title="Change instance type" @close="typing = null">
    <div v-if="typing.state !== 'stopped'" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
      <div>To change the instance type, the instance must be in the stopped state.</div></div>
    <div class="cs-stack">
      <dl class="cs-kv"><div><dt>Instance ID</dt><dd class="cs-mono">{{ typing.id }} ({{ typing.name }})</dd></div><div><dt>Current instance type</dt><dd>{{ typing.type }}</dd></div></dl>
      <div class="cs-field"><label class="cs-label">New instance type</label>
        <select v-model="newType" class="cs-select"><option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option></select></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="typing = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || newType === typing.type" @click="changeType">Change</button>
    </template>
  </CsModal>

  <CsModal v-if="sgFor" title="Change security groups" size="large" @close="sgFor = null">
    <p class="cs-muted">Security groups act as a firewall for associated instances. Replacing them does not close a connection the instance already has established - security groups are stateful.</p>
    <table class="cs-table-mini"><thead><tr><th /><th>Security group ID</th><th>Security group name</th></tr></thead>
      <tbody><tr v-for="g in vpcGroups" :key="g.id"><td><input v-model="sgPick" type="checkbox" :value="g.id" /></td>
        <td class="cs-mono">{{ g.id }}</td><td>{{ g.name }}</td></tr></tbody></table>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="sgFor = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !sgPick.length" @click="saveSgs">Save</button>
    </template>
  </CsModal>

  <CsModal v-if="protecting" title="Change termination protection" @close="protecting = null">
    <label class="cs-toggle"><input v-model="protectOn" type="checkbox" /> <span>Termination protection: <strong>{{ protectOn ? 'Enable' : 'Disable' }}</strong></span></label>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="protecting = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveProtect">Save</button>
    </template>
  </CsModal>

  <CsModal v-if="tagging" title="Manage tags" size="large" @close="tagging = null">
    <p class="cs-muted">A tag is a label that you assign to an AWS resource. Each tag consists of a key and an optional value.</p>
    <TagEditor v-model="tagDraft" />
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="tagging = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || tagDraft.some(t => tagProblem(t))" @click="saveTags">Save</button>
    </template>
  </CsModal>

  <CsModal v-if="snapping" title="Create snapshot" @close="snapping = null">
    <div class="cs-stack">
      <dl class="cs-kv"><div><dt>Volume ID</dt><dd class="cs-mono">{{ volumeOf(snapping) }}</dd></div></dl>
      <div class="cs-field"><label class="cs-label">Description</label><input v-model="snapDesc" class="cs-input" maxlength="255" />
        <span class="cs-constraint">Up to 255 characters.</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="snapping = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="snapshot">Create snapshot</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import TagEditor from '../../aws/TagEditor.vue';
import RowMenu from '../RowMenu.vue';
import { copyText, useRowMenu, type MenuItem } from '../rowmenu';
import { tagProblem, tagWords, type TagPair } from '../../aws/commands';
import { useOps } from '../ctx';
import { awsDate, tagList } from '../kit';
import InstanceSummary from './InstanceSummary.vue';
import NotFound from './NotFound.vue';

const TYPES = ['t3.medium', 't3.large', 'm5.large', 'm5.xlarge', 'm5.2xlarge', 'r5.large', 'r5.xlarge', 'c5.large'];

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const id = computed(() => ctx.route.value.params?.id || '');
const sel = ref<string[]>([]);
const tab = ref('Details');
const busy = ref(false);
const confirm = ref<any>(null);
const typing = ref<any>(null);
const newType = ref('m5.large');
const sgFor = ref<any>(null);
const sgPick = ref<string[]>([]);
const protecting = ref<any>(null);
const protectOn = ref(false);
const tagging = ref<any>(null);
const tagDraft = ref<TagPair[]>([]);
const snapping = ref<any>(null);
const snapDesc = ref('');

const all = computed(() => rows<any>(ctx.c.value, 'ec2.instances'));
const list = computed(() => all.value.filter(i => i.region === ctx.region.value).map(i => ({
  ...i, display: i.name || '-', alarm: '-', pubdns: '-',
})));
const inst = computed<any>(() => all.value.find(i => i.id === id.value) || null);
const one = computed<any>(() => all.value.find(i => i.id === sel.value[0]) || null);
const targets = computed<any[]>(() => (page.value === 'instance' && inst.value ? [inst.value]
  : all.value.filter(i => sel.value.includes(i.id))));
const vpcGroups = computed(() => rows<any>(ctx.c.value, 'net.sgs').filter(g => g.vpc === sgFor.value?.vpc));

const cols = [
  { id: 'display', header: 'Name', sortKey: 'name' }, { id: 'id', header: 'Instance ID', sortKey: 'id' },
  { id: 'state', header: 'Instance state', sortKey: 'state' }, { id: 'type', header: 'Instance type', sortKey: 'type' },
  { id: 'status', header: 'Status check' }, { id: 'alarm', header: 'Alarm status' },
  { id: 'az', header: 'Availability Zone', sortKey: 'az' }, { id: 'ip', header: 'Private IPv4 address', sortKey: 'ip' },
  { id: 'public_ip', header: 'Public IPv4 address' },
];
const stateItems = computed(() => {
  const list = targets.value;
  const running = list.length > 0 && list.every(i => i.state === 'running');
  const stopped = list.length > 0 && list.every(i => i.state === 'stopped');
  const gone = list.some(i => i.state === 'terminated');
  return [
    { id: 'stop', text: 'Stop instance', disabled: !running, disabledReason: 'Only a running instance can be stopped.' },
    { id: 'start', text: 'Start instance', disabled: !stopped, disabledReason: 'Only a stopped instance can be started.' },
    { id: 'reboot', text: 'Reboot instance', disabled: !running, disabledReason: 'Only a running instance can be rebooted.' },
    { id: 'terminate', text: 'Terminate (delete) instance', disabled: gone || !list.length },
  ];
});
const actionItems = computed(() => [
  { id: 'g-settings', text: 'Instance settings', group: true },
  { id: 'type', text: 'Change instance type', nested: true, disabled: targets.value.length !== 1 },
  { id: 'protect', text: 'Change termination protection', nested: true, disabled: targets.value.length !== 1 },
  { id: 'tags', text: 'Manage tags', nested: true, disabled: targets.value.length !== 1 },
  { id: 'g-net', text: 'Security', group: true },
  { id: 'sgs', text: 'Change security groups', nested: true, disabled: targets.value.length !== 1 },
  { id: 'g-storage', text: 'Storage', group: true },
  { id: 'snapshot', text: 'Create snapshot', nested: true, disabled: targets.value.length !== 1 },
]);

function regionFlag(i: any) { return i.region && i.region !== ctx.home.value ? i.region : ''; }
function volumeOf(i: any) { return 'vol-' + String(i.id).slice(2); }
function snapshotsOf(i: any) { return rows<any>(ctx.c.value, 'ec2.snapshots').filter(s => s.instance === i.name); }
function sgName(gid: string) { return rows<any>(ctx.c.value, 'net.sgs').find(g => g.id === gid)?.name || ''; }
function sgRules(gid: string) {
  const g = rows<any>(ctx.c.value, 'net.sgs').find(x => x.id === gid);
  return g ? g.inbound.map((r: any) => `${r.protocol === '-1' ? 'All' : r.protocol + ' ' + (r.from === r.to ? r.from : r.from + '-' + r.to)} from ${r.cidr || r.sg}`).join('; ') || '-' : '-';
}
function roleOf(profile: string) { return rows<any>(ctx.c.value, 'iam.profiles').find(p => p.name === profile)?.role || profile; }

function connect() { if (one.value) connectOne(one.value); }
function connectOne(i: any) { ctx.to('ec2', 'connect', { id: i.id }); }

// ---- Right-click menu on a row ----
const rm = useRowMenu();
const menuInst = computed<any>(() => all.value.find(i => i.id === rm.menu.value?.key) || null);
const menuTitle = computed(() => (menuInst.value ? `${menuInst.value.id} (${menuInst.value.name || 'no name'})` : ''));
const menuItems = computed<MenuItem[]>(() => {
  const i = menuInst.value;
  if (!i) return [];
  const states = stateItems.value;
  return [
    { id: 'connect', text: 'Connect', disabled: i.state !== 'running', disabledReason: 'Start the instance to connect to it.' },
    { id: 'details', text: 'View details' },
    { id: 'g-state', text: 'Instance state', group: true },
    ...states.map(x => ({ ...x, nested: true, danger: x.id === 'terminate' })),
    { id: 'g-settings', text: 'Instance settings', group: true },
    { id: 'type', text: 'Change instance type', nested: true },
    { id: 'protect', text: 'Change termination protection', nested: true },
    { id: 'tags', text: 'Manage tags', nested: true },
    { id: 'g-sec', text: 'Security', group: true },
    { id: 'sgs', text: 'Change security groups', nested: true },
    { id: 'g-storage', text: 'Storage', group: true },
    { id: 'snapshot', text: 'Create snapshot', nested: true },
    { id: 'g-monitor', text: 'Monitor and troubleshoot', group: true },
    { id: 'alarms', text: 'Manage CloudWatch alarms', nested: true },
    { id: 'logs', text: 'View logs in CloudWatch', nested: true },
    { id: 'fleet', text: 'View in Fleet Manager', nested: true },
    { id: 'div', divider: true },
    { id: 'copy-id', text: 'Copy instance ID' },
    { id: 'copy-ip', text: 'Copy private IPv4 address' },
  ];
});
function onRowMenu(event: MouseEvent) { rm.open(event, key => { sel.value = [key]; }); }
async function menuAct(action: string) {
  const i = menuInst.value || one.value;
  if (!i) return;
  if (action === 'connect') connectOne(i);
  else if (action === 'details') ctx.to('ec2', 'instance', { id: i.id });
  else if (['stop', 'start', 'reboot', 'terminate'].includes(action)) stateAct(action);
  else if (action === 'alarms') ctx.to('cloudwatch', 'alarms');
  else if (action === 'logs') ctx.to('cloudwatch', 'log-groups');
  else if (action === 'fleet') ctx.to('ssm', 'fleet');
  else if (action === 'copy-id' || action === 'copy-ip') {
    const ok = await copyText(action === 'copy-id' ? i.id : i.ip);
    ctx.api.notify(ok ? 'success' : 'error', ok ? 'Copied to clipboard' : 'Could not copy to the clipboard');
  } else act(action);
}

function stateAct(verb: string) {
  const list = targets.value;
  if (!list.length) return;
  const plural = list.length > 1 ? 'instances' : 'instance';
  if (verb === 'stop') confirm.value = { verb, title: `Stop ${plural}?`, action: 'Stop', text: `Are you sure you want to stop these ${plural}?`, warning: '' };
  if (verb === 'start') confirm.value = { verb, title: `Start ${plural}?`, action: 'Start', text: `Start these ${plural}?`, warning: '' };
  if (verb === 'reboot') confirm.value = { verb, title: `Reboot ${plural}?`, action: 'Reboot', text: `Are you sure you want to reboot these ${plural}? Open sessions to them will be disconnected.`, warning: '' };
  if (verb === 'terminate') confirm.value = { verb, title: `Terminate (delete) ${plural}?`, action: 'Terminate (delete)',
    text: 'On an EBS-backed instance, the default action is for the root EBS volume to be deleted when the instance is terminated. Storage on any local drives will be lost.',
    warning: 'Terminating an instance destroys its volumes. Take a snapshot first if it may be evidence.' };
}
async function doState() {
  const verb = confirm.value.verb;
  const list = targets.value;
  busy.value = true;
  const region = regionFlag(list[0]);
  const result = await ctx.run(cli(['aws', 'ec2', `${verb}-instances`], {
    '--region': region, '--instance-ids': list.map(i => i.id),
  }), { stop: 'Successfully stopped', start: 'Successfully started', reboot: 'Successfully rebooted', terminate: 'Successfully initiated termination of' }[verb as 'stop']
    + ` ${list.map(i => i.id).join(', ')}`);
  busy.value = false;
  confirm.value = null;
  if (result.ok) sel.value = [];
}
function act(action: string) {
  const i = targets.value[0];
  if (!i) return;
  if (action === 'type') { typing.value = i; newType.value = i.type; }
  if (action === 'protect') { protecting.value = i; protectOn.value = i.protect; }
  if (action === 'tags') openTagsFor(i);
  if (action === 'sgs') openSgsFor(i);
  if (action === 'snapshot') { snapping.value = i; snapDesc.value = ''; }
}
function openSgs() { if (inst.value) openSgsFor(inst.value); }
function openSgsFor(i: any) { sgFor.value = i; sgPick.value = [...i.sgs]; }
function openTags() { if (inst.value) openTagsFor(inst.value); }
function openTagsFor(i: any) {
  tagging.value = i;
  tagDraft.value = tagList(i.tags).filter(t => !t.key.startsWith('aws:')).map(t => ({ key: t.key, value: t.value }));
}
async function changeType() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'modify-instance-attribute'], {
    '--instance-id': typing.value.id, '--instance-type': newType.value,
  }), `Successfully changed the instance type of ${typing.value.id} to ${newType.value}`);
  busy.value = false;
  if (result.ok) typing.value = null;
}
async function saveSgs() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'modify-instance-attribute'], {
    '--instance-id': sgFor.value.id, '--groups': sgPick.value,
  }), `Successfully attached security groups to instance ${sgFor.value.id}`);
  busy.value = false;
  if (result.ok) sgFor.value = null;
}
async function saveProtect() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'modify-instance-attribute'], {
    '--instance-id': protecting.value.id, '--disable-api-termination': protectOn.value, '--no-disable-api-termination': !protectOn.value,
  }), `Successfully ${protectOn.value ? 'enabled' : 'disabled'} termination protection on ${protecting.value.id}`);
  busy.value = false;
  if (result.ok) protecting.value = null;
}
async function saveTags() {
  const i = tagging.value;
  const before = Object.keys(i.tags).filter(k => !k.startsWith('aws:'));
  const keep = tagDraft.value.filter(t => t.key.trim());
  const removed = before.filter(k => !keep.some(t => t.key.trim() === k));
  const changed = keep.filter(t => i.tags[t.key.trim()] !== t.value.trim());
  busy.value = true;
  let ok = true;
  if (removed.length) {
    const result = await ctx.run(cli(['aws', 'ec2', 'delete-tags'], { '--resources': [i.id], '--tags': removed.map(k => `Key=${k}`) }));
    ok = ok && result.ok;
  }
  if (changed.length) {
    const result = await ctx.run(cli(['aws', 'ec2', 'create-tags'], { '--resources': [i.id], '--tags': tagWords(changed) }));
    ok = ok && result.ok;
  }
  busy.value = false;
  if (ok) { ctx.api.notify('success', `Successfully updated tags for ${i.id}`); tagging.value = null; }
}
async function snapshot() {
  const i = snapping.value;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'create-snapshot'], {
    '--region': regionFlag(i), '--volume-id': volumeOf(i), '--description': snapDesc.value.trim(),
  }));
  busy.value = false;
  if (result.ok) {
    let sid = '';
    try { sid = JSON.parse(result.output || '{}').SnapshotId; } catch { /* ignored */ }
    ctx.api.notify('success', `Successfully created snapshot ${sid} from volume ${volumeOf(i)}.`);
    snapping.value = null;
  }
}
</script>

<style scoped>
.in__peek { margin-top: 20px; }
.in__p { margin: 0 0 8px; }
.in__list { margin: 0; padding-left: 18px; }
</style>
