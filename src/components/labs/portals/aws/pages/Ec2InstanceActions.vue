<template>
  <CsDropdown label="Instance state" :items="stateItems" :disabled="!instances.length" @select="stateAction" />
  <CsDropdown label="Actions" :items="actionItems" :disabled="!instances.length" @select="action" />

  <CsModal v-if="modal === 'stop' || modal === 'start' || modal === 'reboot'" :title="titles[modal]" @close="modal = ''">
    <p class="ia__p">{{ blurbs[modal] }}</p>
    <ul class="ia__ids"><li v-for="row in instances" :key="row.id" class="cs-mono">{{ row.id }}<span v-if="row.name"> ({{ row.name }})</span></li></ul>
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
    <ul class="ia__ids"><li v-for="row in instances" :key="row.id" class="cs-mono">{{ row.id }}<span v-if="row.name"> ({{ row.name }})</span></li></ul>
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
    <table class="cs-table-mini">
      <thead><tr><th></th><th>Security group name</th><th>Security group ID</th><th>Description</th></tr></thead>
      <tbody>
        <tr v-for="g in vpcGroups" :key="g.id">
          <td><input v-model="groupIds" type="checkbox" :value="g.id" class="ia__cb" :aria-label="g.name" /></td>
          <td>{{ g.name }}</td><td class="cs-mono">{{ g.id }}</td><td>{{ g.description }}</td>
        </tr>
      </tbody>
    </table>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="modal = ''">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !groupIds.length" @click="changeGroups">Save</button>
    </template>
  </CsModal>

  <ManageTags v-if="modal === 'tags' && one" :resource-id="one.id" :tags="one.tags || {}" @close="modal = ''" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsDropdown, { type DdItem } from '../CsDropdown.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import { useAws } from '../ctx';
import ManageTags from './Ec2ManageTags.vue';

const props = defineProps<{ instances: Record<string, any>[] }>();
const ctx = useAws();
const modal = ref<'' | 'stop' | 'start' | 'reboot' | 'terminate' | 'type' | 'sgs' | 'tags'>('');
const busy = ref(false);
const newType = ref('');
const groupIds = ref<string[]>([]);

const one = computed(() => (props.instances.length === 1 ? props.instances[0] : null));
const live = computed(() => props.instances.filter(i => i.state !== 'terminated'));
const types = computed(() => pick<any[]>(ctx.view.value, 'instance_types', []));
const vpcGroups = computed(() => rows(ctx.view.value, 'ec2.security_groups').filter(g => g.vpc === one.value?.vpc));

const stateItems = computed<DdItem[]>(() => [
  { id: 'stop', text: 'Stop instance', disabled: !live.value.length || live.value.every(i => i.state === 'stopped') },
  { id: 'start', text: 'Start instance', disabled: !live.value.length || live.value.every(i => i.state === 'running') },
  { id: 'reboot', text: 'Reboot instance', disabled: !live.value.length || live.value.some(i => i.state !== 'running') },
  { id: 'hibernate', text: 'Hibernate instance', disabled: true },
  { id: 'terminate', text: 'Terminate (delete) instance', disabled: !live.value.length },
]);
const actionItems = computed<DdItem[]>(() => [
  { id: 'connect', text: 'Connect', disabled: true },
  { id: 'details', text: 'View details', disabled: !one.value },
  { id: 'g1', text: 'Instance settings', group: true },
  { id: 'type', text: 'Change instance type', disabled: !one.value || one.value.state === 'terminated', nested: true },
  { id: 'tags', text: 'Manage tags', disabled: !one.value, nested: true },
  { id: 'g2', text: 'Security', group: true },
  { id: 'sgs', text: 'Change security groups', disabled: !one.value || one.value.state === 'terminated', nested: true },
  { id: 'g3', text: 'Networking', group: true },
  { id: 'net', text: 'Change source/destination check', disabled: true, nested: true },
  { id: 'g4', text: 'Image and templates', group: true },
  { id: 'image', text: 'Create image', disabled: true, nested: true },
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

function stateAction(id: string) {
  if (id in VERB) modal.value = id as typeof modal.value;
}
function action(id: string) {
  if (id === 'details' && one.value) ctx.to('ec2', 'instance', { id: one.value.id });
  if (id === 'type' && one.value) { newType.value = one.value.type; modal.value = 'type'; }
  if (id === 'sgs' && one.value) { groupIds.value = [...(one.value.groups || [])]; modal.value = 'sgs'; }
  if (id === 'tags') modal.value = 'tags';
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
</script>

<style scoped>
.ia__p { margin: 0 0 12px; }
.ia__ids { margin: 0 0 12px; padding-left: 18px; }
.ia__gap { margin-bottom: 14px; }
.ia__cb { accent-color: #006ce0; }
</style>
