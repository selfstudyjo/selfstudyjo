<template>
  <div class="az-split">
    <nav class="az-svcmenu" aria-label="Network Watcher menu">
      <template v-for="item in MENU" :key="item.key">
        <div v-if="item.group" class="az-svcmenu__group">{{ item.label }}</div>
        <button v-else type="button" class="az-svcmenu__item" :class="{ 'is-active': tab === item.key }" @click="emit('tab', item.key)">
          <AzIcon :name="item.icon || 'watcher'" /> {{ item.label }}</button>
      </template>
    </nav>
    <div class="az-content">
      <template v-if="tab === 'overview' || tab === 'troubleshoot'">
        <h2 class="az-h2">Connection troubleshoot</h2>
        <p class="az-intro">Test a connection between a source in a virtual network and a destination, hop by hop: NSG rules,
          effective routes, peering, the firewall and private DNS.</p>
        <div class="az-form">
          <div class="az-field"><div class="az-field__label">Source type</div>
            <div class="az-radios"><label class="az-radio"><input v-model="f.sourceKind" type="radio" value="subnet" /> Subnet</label>
              <label class="az-radio"><input v-model="f.sourceKind" type="radio" value="ip" /> IP address</label></div></div>
          <div class="az-field"><div class="az-field__label">Source <span class="az-req">*</span></div>
            <div class="az-field__ctl">
              <select v-if="f.sourceKind === 'subnet'" v-model="f.source" class="az-select"><option value="">Select a subnet</option>
                <option v-for="s in subnets" :key="s" :value="s">{{ s }}</option></select>
              <input v-else v-model="f.source" class="az-input" placeholder="10.1.1.4" /></div></div>
          <div class="az-field"><div class="az-field__label">Destination <span class="az-req">*</span></div>
            <div class="az-field__ctl"><input v-model="f.dest" class="az-input" placeholder="IP address or FQDN, e.g. paystore001.blob.core.windows.net" /></div></div>
          <div class="az-field"><div class="az-field__label">Destination port</div>
            <div class="az-field__ctl"><input v-model="f.port" class="az-input" type="number" /></div></div>
          <div class="az-field"><div class="az-field__label">Protocol</div>
            <div class="az-radios"><label v-for="p in ['Tcp', 'Udp', 'Icmp']" :key="p" class="az-radio"><input v-model="f.protocol" type="radio" :value="p" /> {{ p.toUpperCase() }}</label></div></div>
          <button type="button" class="az-btn az-btn--primary" :disabled="!f.source || !f.dest" @click="test">Run diagnostic tests</button>
        </div>
        <template v-if="out">
          <div class="az-banner" :class="ok ? 'is-success' : 'is-error'" style="margin-top: 12px">
            <AzIcon :name="ok ? 'ok' : 'error'" /><span><b>{{ ok ? 'Reachable' : 'Unreachable' }}</b></span></div>
          <pre class="az-code">{{ out }}</pre>
        </template>
        <h3 class="az-section-title">Recent tests</h3>
        <AzTable :columns="testCols" :rows="tests" row-key="key">
          <template #cell-status="{ row }"><span class="az-status"><AzIcon :name="row.status === 'reachable' ? 'ok' : row.status === 'warning' ? 'warning' : 'error'" :size="14" /> {{ row.status }}</span></template>
          <template #empty>No tests yet.</template>
        </AzTable>
      </template>
      <template v-else-if="tab === 'rules' || tab === 'routes'">
        <h2 class="az-h2">{{ tab === 'rules' ? 'Effective security rules' : 'Effective routes' }}</h2>
        <div class="az-filters">
          <select v-model="pickedSubnet" class="az-filter"><option value="">Select a subnet</option>
            <option v-for="s in subnets" :key="s" :value="s">{{ s }}</option></select>
          <button type="button" class="az-btn" :disabled="!pickedSubnet" @click="effective">Show</button>
        </div>
        <pre v-if="effOut" class="az-code">{{ effOut }}</pre>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Network Watcher: connection troubleshoot (the path evaluator), effective rules and routes. */
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzTable from './AzTable.vue';
import { useAz } from './azure';

const props = defineProps<{ tab: string }>();
const emit = defineEmits<{ (event: 'tab', tab: string): void }>();
const az = useAz();
const MENU = [
  { key: 'overview', label: 'Overview', icon: 'watcher' }, { key: 'g', label: 'Network diagnostic tools', group: true },
  { key: 'troubleshoot', label: 'Connection troubleshoot', icon: 'connect' },
  { key: 'rules', label: 'Effective security rules', icon: 'nsg' }, { key: 'routes', label: 'Next hop / Effective routes', icon: 'routetable' },
];
const subnets = computed(() => rows(az.p.value, 'vnets').flatMap(v => (v.subnets || []).map((s: any) => `${v.name}/${s.name}`)));
const f = reactive({ sourceKind: 'subnet', source: '', dest: '', port: '443', protocol: 'Tcp' });
const out = ref('');
const ok = ref(false);
async function test() {
  const r = await az.run(cli(['az', 'network', 'watcher', 'test-connectivity'], { '--source': f.source, '--destination': f.dest,
                                                                                 '--port': f.port, '--protocol': f.protocol }), '', { quiet: true });
  ok.value = r.ok;
  out.value = String(r.ok ? r.output : r.error || r.output || '').trim();
}
const tests = computed(() => rows(az.v.value, 'path_tests').map((t, i: number): Record<string, any> => ({ ...t, key: String(i) })).reverse());
const testCols = [{ key: 'source', label: 'Source' }, { key: 'destination', label: 'Destination' }, { key: 'port', label: 'Port' },
                  { key: 'status', label: 'Result' }, { key: 'detail', label: 'Detail' }];
const pickedSubnet = ref('');
const effOut = ref('');
async function effective() {
  const [v, s] = pickedSubnet.value.split('/');
  const verb = props.tab === 'rules' ? 'show-effective-rules' : 'show-effective-route-table';
  const r = await az.run(cli(['az', 'network', 'watcher', verb], { '--vnet': v, '--subnet': s }), '', { quiet: true });
  effOut.value = String(r.ok ? r.output : r.error || '').trim();
}
</script>
