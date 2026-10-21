<template>
  <div>
    <!-- Overview: the Properties tab under Essentials -->
    <template v-if="tab === 'overview'">
      <div class="az-tabs"><button type="button" class="az-tab is-active">Properties</button>
        <button type="button" class="az-tab" @click="$emit('tab', 'networking')">Networking</button>
        <button type="button" class="az-tab" @click="$emit('tab', 'size')">Size</button></div>
      <div class="az-props">
        <section><h3 class="az-section-title"><AzIcon name="vm" /> Virtual machine</h3>
          <div class="az-kv"><span>Computer name</span><span>{{ res.name }}</span></div>
          <div class="az-kv"><span>Operating system</span><span>{{ String(p.image || '').startsWith('Win') ? 'Windows' : 'Linux' }} ({{ p.image }})</span></div>
          <div class="az-kv"><span>VM generation</span><span>V2</span></div>
          <div class="az-kv"><span>Agent status</span><span>{{ running ? 'Ready' : 'Not Ready' }}</span></div>
          <div class="az-kv"><span>Admin username</span><span>{{ p.admin }}</span></div>
          <div class="az-kv"><span>Authentication</span><span>{{ p.auth === 'password' ? 'Password' : 'SSH public key' }}</span></div></section>
        <section><h3 class="az-section-title"><AzIcon name="vnet" /> Networking</h3>
          <div class="az-kv"><span>Public IP address</span><span>{{ p.public_ip || '—' }}</span></div>
          <div class="az-kv"><span>Private IP address</span><span>{{ p.private_ip }}</span></div>
          <div class="az-kv"><span>Virtual network/subnet</span><span>{{ p.vnet }}/{{ p.subnet }}</span></div>
          <div class="az-kv"><span>Network security group</span><span>{{ p.nsg || 'None' }}</span></div></section>
        <section><h3 class="az-section-title"><AzIcon name="plan" /> Size</h3>
          <div class="az-kv"><span>Size</span><span>{{ p.size }}</span></div>
          <div class="az-kv"><span>vCPUs</span><span>{{ p.cpus }}</span></div>
          <div class="az-kv"><span>RAM</span><span>{{ p.memory }} GiB</span></div></section>
        <section><h3 class="az-section-title"><AzIcon name="storage" /> Disk</h3>
          <div class="az-kv"><span>OS disk</span><span>{{ res.name }}_OsDisk_1</span></div>
          <div class="az-kv"><span>Size</span><span>{{ p.os_disk_gb || 30 }} GiB</span></div>
          <div class="az-kv"><span>Encryption at host</span><span>Disabled</span></div></section>
        <section><h3 class="az-section-title"><AzIcon name="monitor" /> Monitoring</h3>
          <div class="az-kv"><span>Boot diagnostics</span><span><button type="button" class="az-link" @click="$emit('tab', 'bootdiag')">{{ p.boot_diagnostics ? 'Enabled' : 'Disabled' }}</button></span></div>
          <div class="az-kv"><span>Installed packages</span><span>{{ (p.shell && p.shell.packages && p.shell.packages.length) ? p.shell.packages.join(', ') : '—' }}</span></div></section>
        <section><h3 class="az-section-title"><AzIcon name="bastion" /> Connect</h3>
          <div class="az-kv"><span>Bastion</span><span><button type="button" class="az-link" @click="$emit('tab', 'bastion')">{{ bastionName || 'Not configured' }}</button></span></div>
          <div class="az-kv"><span>SSH</span><span><button type="button" class="az-link" @click="$emit('tab', 'connect')">Connect</button></span></div></section>
      </div>
    </template>

    <AzVmConnect v-else-if="CONNECT_TABS.includes(tab)" :res="res" :tab="tab" @tab="$emit('tab', $event)" />

    <template v-else-if="tab === 'networking'">
      <h2 class="az-h2">Network settings</h2>
      <div class="az-ess__grid" style="margin-bottom: 10px">
        <div class="az-ess__row"><span class="az-ess__k">Network interface</span><span class="az-ess__v">{{ res.name }}VMNic</span></div>
        <div class="az-ess__row"><span class="az-ess__k">Virtual network / subnet</span><span class="az-ess__v">{{ p.vnet }}/{{ p.subnet }}</span></div>
        <div class="az-ess__row"><span class="az-ess__k">Public IP</span><span class="az-ess__v">{{ p.public_ip || '—' }}</span></div>
        <div class="az-ess__row"><span class="az-ess__k">Private IP</span><span class="az-ess__v">{{ p.private_ip }}</span></div>
      </div>
      <template v-if="nsg">
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="openRule('Inbound')"><AzIcon name="plus" /> Add inbound port rule</button>
          <button type="button" class="az-cmd" @click="openRule('Outbound')"><AzIcon name="plus" /> Add outbound port rule</button>
          <button type="button" class="az-cmd" @click="openNsg"><AzIcon name="nsg" /> Network security group {{ nsg.name }}</button>
        </div>
        <div class="az-tabs">
          <button type="button" class="az-tab" :class="{ 'is-active': dir === 'Inbound' }" @click="dir = 'Inbound'">Inbound port rules</button>
          <button type="button" class="az-tab" :class="{ 'is-active': dir === 'Outbound' }" @click="dir = 'Outbound'">Outbound port rules</button>
        </div>
        <AzTable :columns="ruleCols" :rows="ruleRows" row-key="key">
          <template #cell-access="{ row }"><span class="az-status"><AzIcon :name="row.access === 'Allow' ? 'ok' : 'error'" :size="14" /> {{ row.access }}</span></template>
          <template #cell-actions="{ row }">
            <template v-if="!row.isDefault">
              <button type="button" class="az-link" @click="editRule(row)">Edit</button> ·
              <button type="button" class="az-link" @click="deleteRule(row)">Delete</button>
            </template>
          </template>
        </AzTable>
      </template>
      <div v-else class="az-banner"><AzIcon name="infofill" /><span>No network security group is associated with this VM's network interface.</span></div>
      <AzRulePane v-if="ruleDir && nsg" :nsg="nsg.name" :group="nsg.group" :direction="ruleDir" :existing="editing"
                  :taken="taken" @close="ruleDir = null; editing = null" />
    </template>

    <template v-else-if="tab === 'disks'">
      <h2 class="az-h2">Disks</h2>
      <h3 class="az-section-title">OS disk</h3>
      <AzTable :columns="[{ key: 'name', label: 'Disk name' }, { key: 'type', label: 'Storage type' }, { key: 'size', label: 'Size (GiB)' }, { key: 'enc', label: 'Encryption' }]"
               :rows="[{ name: res.name + '_OsDisk_1', type: 'Premium SSD LRS', size: p.os_disk_gb || 30, enc: 'SSE with PMK' }]" row-key="name" />
      <h3 class="az-section-title">Data disks</h3>
      <p class="az-muted">None. (Data disks are not modelled in this lab.)</p>
    </template>

    <template v-else-if="tab === 'size'">
      <h2 class="az-h2">Size</h2>
      <p class="az-intro">The VM is currently <b>{{ p.size }}</b>. Prices are monthly list-price ballparks.</p>
      <AzTable :columns="sizeCols" :rows="sizes" row-key="name">
        <template #cell-name="{ row }">
          <label class="az-radio"><input v-model="newSize" type="radio" :value="row.name" /> {{ row.name }}</label></template>
        <template #cell-monthly="{ row }">${{ row.monthly }}</template>
      </AzTable>
      <button type="button" class="az-btn az-btn--primary" style="margin-top: 12px" :disabled="newSize === p.size" @click="resize">Resize</button>
    </template>
  </div>
</template>

<script setup lang="ts">
/** The virtual machine's own blades: Connect, Networking, Disks, Size. */
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzTable from './AzTable.vue';
import AzRulePane from './AzRulePane.vue';
import AzVmConnect from './AzVmConnect.vue';
import { useAz } from './azure';

const props = defineProps<{ res: Record<string, any>; tab: string }>();
defineEmits<{ (event: 'tab', tab: string): void }>();
const az = useAz();
const CONNECT_TABS = ['connect', 'bastion', 'serial', 'runcommand', 'bootdiag'];
function any(v: unknown) { return v === '*' || v === undefined || v === '' ? 'Any' : String(v); }
const p = computed(() => props.res.props || {});
const running = computed(() => p.value.power === 'VM running');
const bastionName = computed(() => rows(az.p.value, 'resources').find(r => r.kind === 'bastion' && r.props?.vnet === p.value.vnet)?.name || '');
const nsg = computed(() => rows(az.p.value, 'nsgs').find(n => n.name === p.value.nsg && n.group === props.res.group) || null);
const dir = ref<'Inbound' | 'Outbound'>('Inbound');
const ruleRows = computed(() => {
  const n = nsg.value;
  if (!n) return [];
  return [...(n.rules || []), ...(n.defaults || [])].filter((r: any) => r.direction === dir.value)
    .map((r: any) => ({ ...r, key: r.name + r.direction, port: any(r.destinationPortRange), source: any(r.sourceAddressPrefix),
                        destination: any(r.destinationAddressPrefix), protocol: any(r.protocol), actions: '' }))
    .sort((a: any, b: any) => Number(a.priority) - Number(b.priority));
});
const ruleCols = [{ key: 'priority', label: 'Priority' }, { key: 'name', label: 'Name' }, { key: 'port', label: 'Port' },
                  { key: 'protocol', label: 'Protocol' }, { key: 'source', label: 'Source' },
                  { key: 'destination', label: 'Destination' }, { key: 'access', label: 'Action' },
                  { key: 'actions', label: '', sortable: false }];
const taken = computed(() => (nsg.value?.rules || []).map((r: any) => Number(r.priority)));
const ruleDir = ref<'Inbound' | 'Outbound' | null>(null);
const editing = ref<Record<string, any> | null>(null);
function openRule(d: 'Inbound' | 'Outbound') { editing.value = null; ruleDir.value = d; }
function editRule(row: Record<string, any>) { editing.value = row; ruleDir.value = row.direction; }
async function deleteRule(row: Record<string, any>) {
  if (!nsg.value) return;
  if (!(await az.confirm({ title: 'Delete security rule', message: `Do you want to delete the security rule '${row.name}'?`, confirmLabel: 'Yes', danger: true }))) return;
  await az.run(cli(['az', 'network', 'nsg', 'rule', 'delete'], { '-g': nsg.value.group, '--nsg-name': nsg.value.name, '-n': row.name }),
               `Deleted security rule '${row.name}'`);
}
function openNsg() { if (nsg.value) az.go({ page: 'resource', id: nsg.value.id }); }

const sizes = computed(() => (az.p.value.catalogue?.vm_sizes || []) as Record<string, any>[]);
const sizeCols = [{ key: 'name', label: 'VM Size' }, { key: 'cpus', label: 'vCPUs' }, { key: 'memory', label: 'RAM (GiB)' },
                  { key: 'monthly', label: 'Cost/month' }];
const newSize = ref(String(p.value.size || ''));
async function resize() {
  await az.run(cli(['az', 'vm', 'resize'], { '-g': props.res.group, '-n': props.res.name, '--size': newSize.value }),
               `Successfully resized virtual machine '${props.res.name}' to ${newSize.value}`);
}
</script>

<style scoped>
.az-props { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px; }
.az-props .az-section-title { display: flex; align-items: center; gap: 8px; }
@container sl-portal (max-width: 900px) { .az-props { grid-template-columns: 1fr; } }
</style>
