<template>
  <AzPane :title="title" :subtitle="nsg" :error="error" @close="$emit('close')">
    <div class="az-field"><div class="az-field__label">Source</div>
      <div class="az-field__ctl"><select v-model="f.sourceKind" class="az-select">
        <option value="Any">Any</option><option value="IP">IP Addresses</option>
        <option value="Tag">Service Tag</option></select></div></div>
    <div v-if="f.sourceKind === 'IP'" class="az-field"><div class="az-field__label">Source IP addresses/CIDR ranges <span class="az-req">*</span></div>
      <div class="az-field__ctl"><input v-model="f.source" class="az-input" placeholder="10.0.0.0/24 or 1.2.3.4"
             :class="{ 'is-bad': errs.source }" /><div v-if="errs.source" class="az-err">{{ errs.source }}</div></div></div>
    <div v-if="f.sourceKind === 'Tag'" class="az-field"><div class="az-field__label">Source service tag <span class="az-req">*</span></div>
      <div class="az-field__ctl"><select v-model="f.sourceTag" class="az-select">
        <option v-for="t in tags" :key="t" :value="t">{{ t }}</option></select></div></div>
    <div class="az-field"><div class="az-field__label">Source port ranges <span class="az-req">*</span></div>
      <div class="az-field__ctl"><input v-model="f.sourcePorts" class="az-input" /></div></div>
    <div class="az-field"><div class="az-field__label">Destination</div>
      <div class="az-field__ctl"><select v-model="f.destKind" class="az-select">
        <option value="Any">Any</option><option value="IP">IP Addresses</option>
        <option value="Tag">Service Tag</option></select></div></div>
    <div v-if="f.destKind === 'IP'" class="az-field"><div class="az-field__label">Destination IP addresses/CIDR ranges <span class="az-req">*</span></div>
      <div class="az-field__ctl"><input v-model="f.dest" class="az-input" :class="{ 'is-bad': errs.dest }" />
        <div v-if="errs.dest" class="az-err">{{ errs.dest }}</div></div></div>
    <div v-if="f.destKind === 'Tag'" class="az-field"><div class="az-field__label">Destination service tag <span class="az-req">*</span></div>
      <div class="az-field__ctl"><select v-model="f.destTag" class="az-select">
        <option v-for="t in tags" :key="t" :value="t">{{ t }}</option></select></div></div>
    <div class="az-field"><div class="az-field__label">Service</div>
      <div class="az-field__ctl"><select v-model="f.service" class="az-select" @change="applyService">
        <option v-for="s in Object.keys(SERVICES)" :key="s" :value="s">{{ s }}</option></select></div></div>
    <div class="az-field"><div class="az-field__label">Destination port ranges <span class="az-req">*</span></div>
      <div class="az-field__ctl"><input v-model="f.ports" class="az-input" :disabled="f.service !== 'Custom'"
             :class="{ 'is-bad': errs.ports }" /><div v-if="errs.ports" class="az-err">{{ errs.ports }}</div>
        <div class="az-help">Provide a single port, such as 80; a port range, such as 1024-65535; or a comma-separated
          list, such as 80,1024-65535.</div></div></div>
    <div class="az-field"><div class="az-field__label">Protocol</div>
      <div class="az-radios">
        <label v-for="p in ['Any', 'TCP', 'UDP', 'ICMP']" :key="p" class="az-radio">
          <input v-model="f.protocol" type="radio" :value="p" :disabled="f.service !== 'Custom'" /> {{ p }}</label>
      </div></div>
    <div class="az-field"><div class="az-field__label">Action</div>
      <div class="az-radios">
        <label class="az-radio"><input v-model="f.access" type="radio" value="Allow" /> Allow</label>
        <label class="az-radio"><input v-model="f.access" type="radio" value="Deny" /> Deny</label>
      </div></div>
    <div class="az-field"><div class="az-field__label">Priority <span class="az-req">*</span></div>
      <div class="az-field__ctl"><input v-model="f.priority" class="az-input" type="number" min="100" max="4096"
             :class="{ 'is-bad': errs.priority }" /><div v-if="errs.priority" class="az-err">{{ errs.priority }}</div></div></div>
    <div class="az-field"><div class="az-field__label">Name <span class="az-req">*</span></div>
      <div class="az-field__ctl"><input v-model="f.name" class="az-input" :disabled="Boolean(existing)"
             :class="{ 'is-bad': errs.name }" /><div v-if="errs.name" class="az-err">{{ errs.name }}</div></div></div>
    <div class="az-field"><div class="az-field__label">Description</div>
      <div class="az-field__ctl"><input v-model="f.description" class="az-input" /></div></div>
    <template #foot>
      <button type="button" class="az-btn az-btn--primary" :disabled="Object.values(errs).some(Boolean) || saving" @click="save">
        {{ existing ? 'Save' : 'Add' }}</button>
      <button type="button" class="az-btn" @click="$emit('close')">Cancel</button>
    </template>
  </AzPane>
</template>

<script setup lang="ts">
/** "Add inbound security rule" / edit a rule: `az network nsg rule create|update`. */
import { computed, reactive, ref } from 'vue';
import { cli, errorText } from '@/utils/portalKit';
import AzPane from './AzPane.vue';
import { useAz } from './azure';

const props = defineProps<{ nsg: string; group: string; direction: 'Inbound' | 'Outbound';
                            existing?: Record<string, any> | null; taken: number[] }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const az = useAz();
const tags = computed<string[]>(() => az.p.value.catalogue?.service_tags || ['VirtualNetwork', 'Internet']);

const SERVICES: Record<string, [string, string]> = {
  Custom: ['', ''], HTTP: ['80', 'TCP'], HTTPS: ['443', 'TCP'], SSH: ['22', 'TCP'], RDP: ['3389', 'TCP'],
  MS_SQL: ['1433', 'TCP'], MySQL: ['3306', 'TCP'], PostgreSQL: ['5432', 'TCP'], DNS_UDP: ['53', 'UDP'],
};
const title = computed(() => (props.existing ? props.existing.name : `Add ${props.direction.toLowerCase()} security rule`));

function kindOf(value: string): 'Any' | 'IP' | 'Tag' {
  if (!value || value === '*') return 'Any';
  return tags.value.includes(value) ? 'Tag' : 'IP';
}
const e = props.existing;
let nextPriority = 100;
while (props.taken.includes(nextPriority)) nextPriority += 10;
const f = reactive({
  sourceKind: kindOf(e?.sourceAddressPrefix || ''), source: e && kindOf(e.sourceAddressPrefix) === 'IP' ? e.sourceAddressPrefix : '',
  sourceTag: e && kindOf(e.sourceAddressPrefix) === 'Tag' ? e.sourceAddressPrefix : 'VirtualNetwork',
  sourcePorts: e?.sourcePortRange || '*',
  destKind: kindOf(e?.destinationAddressPrefix || ''), dest: e && kindOf(e.destinationAddressPrefix) === 'IP' ? e.destinationAddressPrefix : '',
  destTag: e && kindOf(e.destinationAddressPrefix) === 'Tag' ? e.destinationAddressPrefix : 'Internet',
  service: 'Custom', ports: e?.destinationPortRange || '8080',
  protocol: e ? ({ '*': 'Any', Any: 'Any', Tcp: 'TCP', Udp: 'UDP', Icmp: 'ICMP' } as Record<string, string>)[e.protocol] || String(e.protocol).toUpperCase() : 'Any',
  access: e?.access || 'Allow', priority: String(e?.priority || nextPriority),
  name: e?.name || `Allow${props.direction === 'Inbound' ? 'AnyCustom' : 'Outbound'}${nextPriority}`,
  description: e?.description || '',
});
function applyService() {
  const [port, protocol] = SERVICES[f.service];
  if (port) { f.ports = port; f.protocol = protocol; f.name = `Allow${f.service.replace('_', '')}${props.direction === 'Inbound' ? 'Inbound' : 'Outbound'}`; }
}
const CIDR = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
const errs = computed(() => {
  const out: Record<string, string> = {};
  if (f.sourceKind === 'IP' && !f.source.split(',').every((x: string) => CIDR.test(x.trim()))) out.source = 'Invalid address prefix. Value should be a valid IPv4 address or CIDR.';
  if (f.destKind === 'IP' && !f.dest.split(',').every((x: string) => CIDR.test(x.trim()))) out.dest = 'Invalid address prefix. Value should be a valid IPv4 address or CIDR.';
  if (!/^(\*|\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/.test(f.ports.trim())) out.ports = 'Invalid port range.';
  const pr = Number(f.priority);
  if (!Number.isInteger(pr) || pr < 100 || pr > 4096) out.priority = 'Priority must be between 100 and 4096.';
  else if (props.taken.includes(pr) && pr !== Number(e?.priority)) out.priority = `A rule with priority ${pr} already exists.`;
  if (!/^[A-Za-z0-9][\w.-]{0,79}$/.test(f.name)) out.name = 'The name must begin with a letter or number, and contain only letters, numbers, underscores, periods, or hyphens.';
  return out;
});
const saving = ref(false);
const error = ref('');
async function save() {
  saving.value = true;
  error.value = '';
  const src = f.sourceKind === 'Any' ? '*' : f.sourceKind === 'Tag' ? f.sourceTag : f.source.replace(/\s/g, '');
  const dst = f.destKind === 'Any' ? '*' : f.destKind === 'Tag' ? f.destTag : f.dest.replace(/\s/g, '');
  const protocol = ({ Any: '*', TCP: 'Tcp', UDP: 'Udp', ICMP: 'Icmp' } as Record<string, string>)[f.protocol];
  const verb = props.existing ? 'update' : 'create';
  const command = cli(['az', 'network', 'nsg', 'rule', verb], {
    '-g': props.group, '--nsg-name': props.nsg, '-n': f.name, '--priority': f.priority,
    '--direction': props.direction, '--access': f.access, '--protocol': protocol,
    '--source-address-prefixes': src, '--source-port-ranges': f.sourcePorts.trim() || '*',
    '--destination-address-prefixes': dst, '--destination-port-ranges': f.ports.replace(/\s/g, ''),
    '--description': f.description,
  });
  const result = await az.run(command, props.existing ? `Updated security rule '${f.name}'` : `Created security rule '${f.name}'`,
                              { quiet: true });
  saving.value = false;
  if (!result.ok) { error.value = errorText(result); return; }
  emit('close');
}
</script>
