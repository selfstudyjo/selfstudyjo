<template>
  <CsDropdown label="Instance state" :items="stateItems" :disabled="!instances.length" @select="act" />
  <CsDropdown label="Actions" :items="actionItems" :disabled="!instances.length" @select="act" />

  <CsModal v-if="modal === 'stop' || modal === 'start' || modal === 'reboot'" :title="titles[modal]" @close="modal = ''">
    <p class="ia__p">{{ blurbs[modal] }}</p>
    <ul class="ia__ids"><li v-for="row in live" :key="row.id" class="cs-mono">{{ row.id }}<span v-if="row.name"> ({{ row.name }})</span></li></ul>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="changeState(modal)">{{ buttons[modal] }}</button>
    </template>
  </CsModal>

  <CsModal v-if="modal === 'terminate'" title="Terminate (delete) instance?" @close="modal = ''">
    <div class="cs-alert cs-alert--warning">
      <CsIcon name="status-warning" class="cs-alert__icon" />
      <div>On an EBS-backed instance, the default action is for the root EBS volume to be deleted when the instance is terminated. Storage on any local drives will be lost.</div>
    </div>
    <p class="ia__p">Are you sure you want to terminate these instances?</p>
    <ul class="ia__ids"><li v-for="row in live" :key="row.id" class="cs-mono">{{ row.id }}<span v-if="row.name"> ({{ row.name }})</span></li></ul>
    <p class="ia__p">To confirm that you want to terminate the instances, choose the terminate button below. Terminating the instance cannot be undone.</p>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="changeState('terminate')">Terminate (delete)</button>
    </template>
  </CsModal>

  <CsModal v-if="modal === 'type' && one" title="Change instance type" @close="modal = ''">
    <div v-if="one.state !== 'stopped'" class="cs-alert cs-alert--warning">
      <CsIcon name="status-warning" class="cs-alert__icon" />
      <div>To change the instance type, the instance must be in the <strong>stopped</strong> state. The request will fail with IncorrectInstanceState.</div>
    </div>
    <dl class="cs-kv ia__gap"><div><dt>Instance ID</dt><dd class="cs-mono">{{ one.id }}</dd></div>
      <div><dt>Current instance type</dt><dd>{{ one.type }}</dd></div></dl>
    <div class="cs-field">
      <label class="cs-label" for="ia-type">New instance type</label>
      <select id="ia-type" v-model="newType" class="cs-select">
        <option v-for="t in types" :key="t.name" :value="t.name">{{ t.name }} ({{ t.cpus }} vCPU, {{ t.memory }} GiB Memory)</option>
      </select>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || newType === one.type" @click="changeType">Apply</button>
    </template>
  </CsModal>

  <CsModal v-if="modal === 'sgs' && one" title="Change security groups" size="large" @close="modal = ''">
    <p class="ia__p">Associated security groups for <span class="cs-mono">{{ one.id }}</span> in <span class="cs-mono">{{ one.vpc }}</span>.</p>
    <div class="cs-scroll-x">
      <table class="cs-table-mini">
        <thead><tr><th></th><th>Security group name</th><th>Security group ID</th><th>Description</th></tr></thead>
        <tbody>
          <tr v-for="g in vpcGroups" :key="g.id">
            <td><input v-model="groupIds" type="checkbox" :value="g.id" class="ia__cb" :aria-label="g.name" /></td>
            <td>{{ g.name }}</td><td class="cs-mono">{{ g.id }}</td><td>{{ g.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !groupIds.length" @click="changeGroups">Save</button>
    </template>
  </CsModal>

  <CsModal v-if="modal === 'role' && one" title="Modify IAM role" size="large" @close="modal = ''">
    <p class="ia__p">Attach an IAM role to your instance. The role's permissions are what software on the instance - the AWS CLI, the SSM Agent - can do.</p>
    <dl class="cs-kv ia__gap"><div><dt>Instance ID</dt><dd class="cs-mono">{{ one.id }}<span v-if="one.name"> ({{ one.name }})</span></dd></div>
      <div><dt>Current IAM role</dt><dd>{{ one.iam_role || '–' }}</dd></div></dl>
    <div class="cs-field">
      <label class="cs-label" for="ia-role">IAM role</label>
      <div class="cs-desc">Select an IAM role to attach to your instance or create a new role if you haven't created any. The role you select replaces any roles that are currently attached to your instance.</div>
      <div class="cs-row ia__role">
        <select id="ia-role" v-model="newProfile" class="cs-select">
          <option value="">No IAM Role</option>
          <option v-for="p in profiles" :key="p.name" :value="p.name">{{ p.name }}{{ p.roles.length ? '' : ' (no role in profile)' }}</option>
        </select>
        <button type="button" class="cs-btn" @click="modal = ''; ctx.to('iam', 'role-create')">Create new IAM role <CsIcon name="external" size="small" /></button>
      </div>
    </div>
    <div v-if="!profiles.length" class="cs-alert cs-alert--info ia__top">
      <CsIcon name="status-info" class="cs-alert__icon" />
      <div>No instance profiles in this account yet. Creating a role for the <strong>EC2</strong> service in IAM creates one with the same name.</div>
    </div>
    <div v-if="one.iam_profile && !newProfile" class="cs-alert cs-alert--warning ia__top">
      <CsIcon name="status-warning" class="cs-alert__icon" />
      <div>Choosing <strong>No IAM Role</strong> detaches {{ one.iam_profile }}. Software on the instance loses its credentials, and Session Manager stops working.</div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || newProfile === (one.iam_profile || '')" @click="changeRole">Update IAM role</button>
    </template>
  </CsModal>

  <CsModal v-if="modal === 'log' && one" title="Get system log" size="large" @close="modal = ''">
    <p class="ia__p">Instance <span class="cs-mono">{{ one.id }}</span><span v-if="one.name"> ({{ one.name }})</span>. Updated {{ logStamp || '–' }}.</p>
    <pre class="cs-code ia__log">{{ systemLog || (busy ? 'Loading...' : 'No system log output is available yet.') }}</pre>
    <template #footer>
      <button type="button" class="cs-btn" :disabled="busy" @click="loadLog"><CsIcon name="refresh" /> Refresh</button>
      <button type="button" class="cs-btn cs-btn--primary" @click="modal = ''">Close</button>
    </template>
  </CsModal>

  <CsModal v-if="modal === 'userdata' && one" title="Edit user data" size="large" @close="modal = ''">
    <div v-if="one.state !== 'stopped'" class="cs-alert cs-alert--warning">
      <CsIcon name="status-warning" class="cs-alert__icon" />
      <div>To edit an instance's user data, the instance must be in the <strong>stopped</strong> state. User data runs when the instance next starts.</div>
    </div>
    <dl class="cs-kv ia__gap"><div><dt>Instance ID</dt><dd class="cs-mono">{{ one.id }}</dd></div></dl>
    <div class="cs-field">
      <label class="cs-label" for="ia-ud">New user data</label>
      <div class="cs-desc">Shell scripts that begin with #!/bin/bash run as root at boot.</div>
      <textarea id="ia-ud" v-model="userData" class="cs-textarea cs-mono ia__ud" spellcheck="false" placeholder="#!/bin/bash" />
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || userData === (one.user_data || '')" @click="saveUserData">Save</button>
    </template>
  </CsModal>

  <CsModal v-if="modal === 'password' && one" title="Get Windows password" @close="modal = ''">
    <p class="ia__p">Retrieve and decrypt the initial Windows administrator password for this instance.</p>
    <dl class="cs-kv ia__gap"><div><dt>Instance ID</dt><dd class="cs-mono">{{ one.id }}</dd></div>
      <div><dt>Key pair associated with this instance</dt><dd>{{ one.key || '–' }}</dd></div></dl>
    <template v-if="!password">
      <div class="cs-field">
        <label class="cs-label" for="ia-key">Private key file</label>
        <div class="cs-desc">The name of the private key file (.pem) you saved when you created the key pair.</div>
        <input id="ia-key" v-model.trim="keyFile" class="cs-input" :placeholder="(one.key || 'key') + '.pem'" />
      </div>
    </template>
    <template v-else>
      <div class="cs-alert cs-alert--success"><CsIcon name="status-positive" class="cs-alert__icon" /><div>Password decrypted.</div></div>
      <dl class="cs-kv">
        <div><dt>Private IP address</dt><dd>{{ one.private_ip }}</dd></div>
        <div><dt>Username</dt><dd>Administrator</dd></div>
        <div><dt>Password</dt><dd class="cs-mono">{{ password }} <button type="button" class="cs-link" aria-label="Copy password" @click="copy(password)"><CsIcon name="copy" size="small" /></button></dd></div>
      </dl>
    </template>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">{{ password ? 'Close' : 'Cancel' }}</button>
      <button v-if="!password" type="button" class="cs-btn cs-btn--primary" :disabled="busy || !keyFile" @click="decrypt">Decrypt password</button>
    </template>
  </CsModal>

  <ManageTags v-if="modal === 'tags' && one" :resource-id="one.id" :tags="one.tags || {}" @close="modal = ''" />
</template>

<script setup lang="ts">
/**
 * "Instance state" and "Actions" for the instances list, the instance page and
 * the right-click menu - one implementation, so the three can never offer
 * different things. `act(id)` is exposed for the context menu.
 */
import { computed, ref } from 'vue';
import { cli, parseJson, pick, rows } from '@/utils/portalKit';
import CsDropdown, { type DdItem } from '../CsDropdown.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import { awsDate, useAws } from '../ctx';
import ManageTags from './Ec2ManageTags.vue';

const props = defineProps<{ instances: Record<string, any>[] }>();
const ctx = useAws();
type Modal = '' | 'stop' | 'start' | 'reboot' | 'terminate' | 'type' | 'sgs' | 'tags' | 'role' | 'log' | 'userdata' | 'password';
const modal = ref<Modal>('');
const busy = ref(false);
const newType = ref('');
const groupIds = ref<string[]>([]);
const newProfile = ref('');
const systemLog = ref('');
const logStamp = ref('');
const userData = ref('');
const keyFile = ref('');
const password = ref('');

const one = computed(() => (props.instances.length === 1 ? props.instances[0] : null));
const live = computed(() => props.instances.filter(i => i.state !== 'terminated'));
const types = computed(() => pick<any[]>(ctx.view.value, 'instance_types', []));
const vpcGroups = computed(() => rows(ctx.view.value, 'ec2.security_groups').filter(g => g.vpc === one.value?.vpc));
const profiles = computed(() => rows<any>(ctx.view.value, 'ec2.instance_profiles'));
const gone = computed(() => !one.value || one.value.state === 'terminated');
const windows = computed(() => Boolean(one.value?.connect?.windows));

const stateItems = computed<DdItem[]>(() => [
  { id: 'stop', text: 'Stop instance', disabled: !live.value.length || live.value.every(i => i.state === 'stopped') },
  { id: 'start', text: 'Start instance', disabled: !live.value.length || live.value.every(i => i.state === 'running') },
  { id: 'reboot', text: 'Reboot instance', disabled: !live.value.length || live.value.some(i => i.state !== 'running') },
  { id: 'hibernate', text: 'Hibernate instance', disabled: true, disabledReason: 'Hibernation is not enabled for this instance' },
  { id: 'terminate', text: 'Terminate (delete) instance', disabled: !live.value.length },
]);
const actionItems = computed<DdItem[]>(() => [
  { id: 'connect', text: 'Connect', disabled: !one.value || one.value.state !== 'running' },
  { id: 'details', text: 'View details', disabled: !one.value },
  { id: 'g1', text: 'Instance settings', group: true },
  { id: 'type', text: 'Change instance type', disabled: gone.value, nested: true },
  { id: 'userdata', text: 'Edit user data', disabled: gone.value, nested: true },
  { id: 'tags', text: 'Manage tags', disabled: !one.value, nested: true },
  { id: 'g2', text: 'Networking', group: true },
  { id: 'net', text: 'Change source/destination check', disabled: true, nested: true },
  { id: 'g3', text: 'Security', group: true },
  { id: 'sgs', text: 'Change security groups', disabled: gone.value, nested: true },
  { id: 'password', text: 'Get Windows password', disabled: gone.value || !windows.value, nested: true },
  { id: 'role', text: 'Modify IAM role', disabled: gone.value, nested: true },
  { id: 'g4', text: 'Image and templates', group: true },
  { id: 'image', text: 'Create image', disabled: true, nested: true },
  { id: 'g5', text: 'Monitor and troubleshoot', group: true },
  { id: 'log', text: 'Get system log', disabled: gone.value, nested: true },
]);

/** Everything a right-click on one instance offers: state changes first, then actions. */
const menuItems = computed<DdItem[]>(() => [
  ...actionItems.value.slice(0, 2),
  { id: 'gs', text: 'Instance state', group: true },
  ...stateItems.value.map(item => ({ ...item, nested: true })),
  ...actionItems.value.slice(2),
  { id: 'gc', text: 'Copy', group: true },
  { id: 'copy-id', text: 'Copy instance ID', disabled: !one.value, nested: true },
  { id: 'copy-ip', text: 'Copy public IPv4 address', disabled: !one.value?.public_ip || one.value?.state !== 'running', nested: true },
]);

const titles: Record<string, string> = { stop: 'Stop instance?', start: 'Start instance?', reboot: 'Reboot instance?' };
const buttons: Record<string, string> = { stop: 'Stop', start: 'Start', reboot: 'Reboot' };
const blurbs: Record<string, string> = {
  stop: 'Are you sure you want to stop these instances? Any data on the ephemeral storage of your instances will be lost.',
  start: 'Are you sure you want to start these instances?',
  reboot: 'Are you sure you want to reboot these instances?',
};
const VERB: Record<string, string> = { stop: 'stop-instances', start: 'start-instances', reboot: 'reboot-instances', terminate: 'terminate-instances' };
const DONE: Record<string, string> = { stop: 'Successfully stopped', start: 'Successfully started', reboot: 'Successfully rebooted', terminate: 'Successfully initiated termination (deletion) of' };

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* ignored */ }
  ctx.api.notify('success', 'Copied', text);
}

function act(id: string) {
  const row = one.value;
  if (id in VERB) { modal.value = id as Modal; return; }
  if (!row) return;
  if (id === 'connect') ctx.to('ec2', 'connect', { id: row.id });
  else if (id === 'details') ctx.to('ec2', 'instance', { id: row.id });
  else if (id === 'type') { newType.value = row.type; modal.value = 'type'; }
  else if (id === 'sgs') { groupIds.value = [...(row.groups || [])]; modal.value = 'sgs'; }
  else if (id === 'tags') modal.value = 'tags';
  else if (id === 'role') { newProfile.value = row.iam_profile || ''; modal.value = 'role'; }
  else if (id === 'userdata') { userData.value = row.user_data || ''; modal.value = 'userdata'; }
  else if (id === 'password') { keyFile.value = row.key ? `${row.key}.pem` : ''; password.value = ''; modal.value = 'password'; }
  else if (id === 'log') { modal.value = 'log'; loadLog(); }
  else if (id === 'copy-id') copy(row.id);
  else if (id === 'copy-ip' && row.public_ip) copy(row.public_ip);
}

async function changeState(which: string) {
  const ids = live.value.map(i => i.id);
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', VERB[which]], { '--instance-ids': ids }),
    `${DONE[which]} ${ids.join(', ')}`);
  busy.value = false;
  if (result.ok) modal.value = '';
}
async function changeType() {
  if (!one.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'modify-instance-attribute'], {
    '--instance-id': one.value.id, '--instance-type': `Value=${newType.value}`,
  }), `Successfully changed the instance type of ${one.value.id} to ${newType.value}`);
  busy.value = false;
  if (result.ok) modal.value = '';
}
async function changeGroups() {
  if (!one.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'modify-instance-attribute'], {
    '--instance-id': one.value.id, '--groups': groupIds.value,
  }), `Successfully changed security groups of ${one.value.id}`);
  busy.value = false;
  if (result.ok) modal.value = '';
}
async function changeRole() {
  const row = one.value;
  if (!row) return;
  busy.value = true;
  let command: string;
  if (!newProfile.value) {
    command = cli(['aws', 'ec2', 'disassociate-iam-instance-profile'], { '--association-id': row.association_id });
  } else if (row.iam_profile) {
    command = cli(['aws', 'ec2', 'replace-iam-instance-profile-association'], {
      '--association-id': row.association_id, '--iam-instance-profile': `Name=${newProfile.value}`,
    });
  } else {
    command = cli(['aws', 'ec2', 'associate-iam-instance-profile'], {
      '--instance-id': row.id, '--iam-instance-profile': `Name=${newProfile.value}`,
    });
  }
  const result = await ctx.run(command, newProfile.value
    ? `Successfully attached ${newProfile.value} to instance ${row.id}`
    : `Successfully detached the IAM role from instance ${row.id}`);
  busy.value = false;
  if (result.ok) modal.value = '';
}
async function loadLog() {
  if (!one.value) return;
  busy.value = true;
  systemLog.value = '';
  const result = await ctx.run(cli(['aws', 'ec2', 'get-console-output'], { '--instance-id': one.value.id, '--output': 'json' }), '', { quiet: true });
  busy.value = false;
  const out = parseJson<{ Output?: string; Timestamp?: string }>(result.output);
  systemLog.value = result.ok ? String(out?.Output || '') : String(result.error || result.output || '');
  logStamp.value = out?.Timestamp ? awsDate(out.Timestamp) : '';
}
async function saveUserData() {
  if (!one.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'modify-instance-attribute'], {
    '--instance-id': one.value.id, '--attribute': 'userData', '--value': userData.value,
  }), `Successfully updated the user data of ${one.value.id}`);
  busy.value = false;
  if (result.ok) modal.value = '';
}
async function decrypt() {
  if (!one.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'get-password-data'], {
    '--instance-id': one.value.id, '--priv-launch-key': keyFile.value,
  }));
  busy.value = false;
  if (result.ok) password.value = String(parseJson<{ PasswordData?: string }>(result.output)?.PasswordData || '');
}

defineExpose({ act, menuItems });
</script>

<style scoped>
.ia__p { margin: 0 0 12px; }
.ia__ids { margin: 0 0 12px; padding-left: 18px; }
.ia__gap { margin-bottom: 14px; }
.ia__top { margin-top: 14px; }
.ia__cb { accent-color: #006ce0; }
.ia__role { flex-wrap: nowrap; }
.ia__role .cs-select { flex: 1 1 auto; min-width: 0; }
.ia__log { max-height: 360px; background: #0f141a; color: #e9ebed; border-color: #0f141a; }
.ia__ud { min-height: 180px; }
@container sl-portal (max-width: 560px) {
  .ia__role { flex-wrap: wrap; }
}
</style>
