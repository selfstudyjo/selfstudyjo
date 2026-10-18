<template>
  <!-- Fleet Manager -->
  <div v-if="page === 'fleet'">
    <CsTable variant="full-page" title="Managed nodes" :items="nodes" :columns="cols" track-by="id" selection-type="single" v-model:selected="sel"
             description="A managed node is a machine that the SSM Agent has registered with Systems Manager. Its ping status is derived from the instance profile and the network path to the Systems Manager endpoints."
             filter-placeholder="Filter by node ID, name, or platform">
      <template #actions>
        <CsDropdown label="Node actions" :items="[{ id: 'session', text: 'Start terminal session', disabled: selected?.ping !== 'Online' }, { id: 'instance', text: 'View instance in EC2' }]"
                    :disabled="!sel.length" @select="act" />
      </template>
      <template #cell-ping="{ row }"><CsStatus :type="row.ping === 'Online' ? 'success' : row.ping === 'Inactive' ? 'stopped' : 'error'" :label="row.ping" /></template>
    </CsTable>
    <section v-if="selected" class="cs-container sf__detail">
      <div class="cs-container__head"><CsHeader :title="`${selected.name} (${selected.id})`" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div v-if="selected.ping !== 'Online'" class="cs-alert cs-alert--warning"><CsIcon name="status-warning" class="cs-alert__icon" />
          <div><strong>Why this node is {{ selected.ping }}</strong>{{ selected.reason }}</div></div>
        <dl class="cs-kv">
          <div><dt>Ping status</dt><dd>{{ selected.ping }}</dd></div><div><dt>Platform</dt><dd>{{ selected.os }}</dd></div>
          <div><dt>IP address</dt><dd>{{ selected.ip }}</dd></div><div><dt>Instance profile</dt><dd>{{ selected.profile || '-' }}</dd></div>
          <div><dt>Patch group</dt><dd>{{ selected.patch_group || '-' }}</dd></div><div><dt>Patch baseline</dt><dd>{{ selected.baseline || '-' }}</dd></div>
          <div><dt>Patch compliance</dt><dd>{{ selected.compliance || 'Not scanned' }}</dd></div><div><dt>Last patch operation</dt><dd>{{ selected.last_operation ? `${selected.last_operation} at ${selected.last_scan}` : '-' }}</dd></div>
        </dl>
      </div>
    </section>
  </div>

  <!-- Session Manager -->
  <div v-else-if="page === 'sessions'">
    <CsHeader title="Session Manager" description="Session Manager lets you manage instances through a browser-based shell or the AWS CLI, without opening inbound ports.">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="openStart">Start session</button></template>
    </CsHeader>
    <div class="cs-tabs">
      <button v-for="t in ['Sessions', 'Session history', 'Preferences']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <CsTable v-if="tab !== 'Preferences'" :title="tab" :items="tab === 'Sessions' ? active : history" :columns="sessCols" track-by="id"
             empty-title="No sessions" :empty-text="tab === 'Sessions' ? 'There are no active sessions.' : 'No sessions have been started.'">
      <template #cell-logged="{ row }"><CsStatus :type="row.logged ? 'success' : 'warning'" :label="row.logged ? 'Logged' : 'Not logged'" /></template>
    </CsTable>
    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader title="Preferences" :level="2"><template #actions><button type="button" class="cs-btn" @click="openPrefs">Edit</button></template></CsHeader></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Idle session timeout</dt><dd>{{ prefs.idle }} minutes</dd></div>
        <div><dt>S3 logging</dt><dd>{{ prefs.s3 || 'Disabled' }}</dd></div>
        <div><dt>CloudWatch logging</dt><dd>{{ prefs.cloudwatch || 'Disabled' }}</dd></div>
        <div><dt>KMS encryption</dt><dd>{{ prefs.kms || 'Disabled' }}</dd></div>
      </dl></div>
    </section>
  </div>

  <CsModal v-if="starting" title="Start a session" @close="starting = false">
    <div class="cs-field"><label class="cs-label">Target instances</label>
      <select v-model="target" class="cs-select"><option v-for="n in nodes.filter(n => n.ping === 'Online')" :key="n.id" :value="n.id">{{ n.name }} ({{ n.id }})</option></select>
      <span class="cs-constraint">Only nodes whose ping status is Online can be connected to.</span></div>
    <div v-if="!prefs.s3 && !prefs.cloudwatch" class="cs-alert cs-alert--warning sf__warn"><CsIcon name="status-warning" class="cs-alert__icon" />
      <div>Session logging is not configured: commands run in this session leave no audit trail.</div></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="starting = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !target" @click="start">Start session</button>
    </template>
  </CsModal>

  <CsModal v-if="editingPrefs" title="Edit preferences" size="large" @close="editingPrefs = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Idle session timeout</label><input v-model="pf.idle" class="cs-input sf__narrow" inputmode="numeric" /><span class="cs-constraint">minutes</span></div>
      <label class="cs-check"><input v-model="pf.s3on" type="checkbox" /><span>Enable S3 logging</span></label>
      <div v-if="pf.s3on" class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">S3 bucket name</label><select v-model="pf.bucket" class="cs-select"><option v-for="b in buckets" :key="b.name" :value="b.name">{{ b.name }}</option></select></div>
        <div class="cs-field"><label class="cs-label">S3 key prefix <small>- optional</small></label><input v-model="pf.prefix" class="cs-input" placeholder="sessions" /></div>
      </div>
      <label class="cs-check"><input v-model="pf.cwon" type="checkbox" /><span>Enable CloudWatch logging</span></label>
      <div v-if="pf.cwon" class="cs-field"><label class="cs-label">CloudWatch log group</label><input v-model="pf.group" class="cs-input" placeholder="/ssm/sessions" /></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="editingPrefs = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="savePrefs">Save</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const tab = ref('Sessions');
const busy = ref(false);
const starting = ref(false);
const target = ref('');
const editingPrefs = ref(false);

const nodes = computed(() => rows<any>(ctx.c.value, 'ssm.nodes'));
const selected = computed<any>(() => nodes.value.find(n => n.id === sel.value[0]) || null);
const sessions = computed(() => rows<any>(ctx.c.value, 'ssm.sessions').map(s => ({ ...s, owner: 'OpsEngineer/ops.engineer', status: s.ended ? 'Terminated' : 'Connected' })));
const active = computed(() => sessions.value.filter(s => !s.ended));
const history = computed(() => sessions.value.filter(s => s.ended));
const prefs = computed<any>(() => pick(ctx.c.value, 'ssm.prefs', {}));
const buckets = computed(() => rows<any>(ctx.c.value, 's3.buckets'));

const cols = [{ id: 'id', header: 'Node ID', sortKey: 'id' }, { id: 'name', header: 'Node name', sortKey: 'name' },
  { id: 'ping', header: 'Ping status', sortKey: 'ping' }, { id: 'platform', header: 'Platform type' },
  { id: 'os', header: 'Operating system' }, { id: 'ip', header: 'IP address' }, { id: 'compliance', header: 'Patch compliance', cell: (n: any) => n.compliance || '-' }];
const sessCols = [{ id: 'id', header: 'Session ID' }, { id: 'owner', header: 'Owner' }, { id: 'name', header: 'Target' },
  { id: 'started', header: 'Start date (shift)' }, { id: 'ended', header: 'End date', cell: (s: any) => s.ended || '-' },
  { id: 'status', header: 'Status' }, { id: 'logged', header: 'Logging' }];

if (ctx.route.value.params?.target) { target.value = ctx.route.value.params.target; starting.value = true; }
function act(action: string) {
  if (!selected.value) return;
  if (action === 'session') { target.value = selected.value.id; starting.value = true; }
  if (action === 'instance') ctx.to('ec2', 'instance', { id: selected.value.id });
}
function openStart() { target.value = target.value || nodes.value.find(n => n.ping === 'Online')?.id || ''; starting.value = true; }
async function start() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ssm', 'start-session'], { '--target': target.value }));
  busy.value = false;
  if (result.ok) starting.value = false;
}
const pf = reactive({ idle: '20', s3on: false, bucket: '', prefix: 'sessions', cwon: false, group: '/ssm/sessions' });
function openPrefs() {
  const s3 = String(prefs.value.s3 || '');
  const m = s3.match(/^s3:\/\/([^/]+)\/?(.*)$/);
  Object.assign(pf, { idle: String(prefs.value.idle || 20), s3on: Boolean(m), bucket: m ? m[1] : (buckets.value[0]?.name || ''),
    prefix: m ? m[2] : 'sessions', cwon: Boolean(prefs.value.cloudwatch), group: prefs.value.cloudwatch || '/ssm/sessions' });
  editingPrefs.value = true;
}
async function savePrefs() {
  const inputs: Record<string, unknown> = { idleSessionTimeout: pf.idle, s3BucketName: pf.s3on ? pf.bucket : '',
    s3KeyPrefix: pf.s3on ? pf.prefix : '', cloudWatchLogGroupName: pf.cwon ? pf.group : '', s3EncryptionEnabled: pf.s3on };
  const content = JSON.stringify({ schemaVersion: '1.0', description: 'Document to hold regional settings for Session Manager',
    sessionType: 'Standard_Stream', inputs });
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ssm', 'update-document'], {
    '--name': 'SSM-SessionManagerRunShell', '--content': content, '--document-version': '$LATEST',
  }), 'Preferences updated successfully.');
  busy.value = false;
  if (result.ok) editingPrefs.value = false;
}
</script>

<style scoped>
.sf__detail { margin-top: 20px; }
.sf__warn { margin-top: 12px; }
.sf__narrow { width: 140px; }
</style>
