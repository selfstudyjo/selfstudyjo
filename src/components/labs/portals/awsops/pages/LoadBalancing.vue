<template>
  <CsTable v-if="page === 'load-balancers'" variant="full-page" title="Load balancers" :items="albs" :columns="lbCols" track-by="name"
           selection-type="single" v-model:selected="sel" filter-placeholder="Filter load balancers">
    <template #actions><button type="button" class="cs-btn cs-btn--primary" disabled>Create load balancer</button></template>
    <template #cell-state><CsStatus state="active" /></template>
  </CsTable>

  <CsTable v-else-if="page === 'target-groups'" variant="full-page" title="Target groups" :items="tgs" :columns="tgCols" track-by="name"
           filter-placeholder="Filter target groups">
    <template #actions><button type="button" class="cs-btn cs-btn--primary" disabled>Create target group</button></template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'target-group', { name: row.name })">{{ row.name }}</a></template>
  </CsTable>

  <div v-else-if="tg">
    <CsHeader :title="tg.name">
      <template #actions><CsDropdown :items="[{ id: 'hc', text: 'Edit health check settings' }]" @select="openHc" /></template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" :description="tg.arn" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Target type</dt><dd>Instance</dd></div><div><dt>Protocol : Port</dt><dd>{{ tg.protocol }}: {{ tg.port }}</dd></div>
        <div><dt>Load balancer</dt><dd>{{ albs.find(a => a.listener?.tg === tg.name)?.name || '-' }}</dd></div>
        <div><dt>Total targets</dt><dd>{{ tg.targets.length }}</dd></div>
        <div><dt>Healthy</dt><dd class="lb__ok">{{ count('healthy') }}</dd></div><div><dt>Unhealthy</dt><dd class="lb__bad">{{ count('unhealthy') }}</dd></div>
        <div><dt>Initial</dt><dd>{{ count('initial') }}</dd></div><div><dt>Draining</dt><dd>{{ count('draining') }}</dd></div>
      </dl></div>
    </section>
    <div class="cs-tabs">
      <button v-for="t in ['Targets', 'Health checks']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <CsTable v-if="tab === 'Targets'" title="Registered targets" :items="tg.targets" :columns="targetCols" track-by="id"
             selection-type="multi" v-model:selected="targetSel">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="describe"><CsIcon name="refresh" /></button>
        <button type="button" class="cs-btn" :disabled="!targetSel.length || busy" @click="deregister">Deregister</button>
        <button type="button" class="cs-btn" disabled>Register targets</button>
      </template>
      <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'instance', { id: row.id })">{{ row.id }}</a></template>
      <template #cell-state="{ row }"><CsStatus :type="kind(row.state)" :label="row.state" /></template>
    </CsTable>
    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader title="Health check settings" :level="2"><template #actions><button type="button" class="cs-btn" @click="openHc">Edit</button></template></CsHeader></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Protocol</dt><dd>{{ tg.protocol }}</dd></div><div><dt>Path</dt><dd>{{ tg.path }}</dd></div>
        <div><dt>Healthy threshold</dt><dd>{{ tg.healthy }} consecutive health check successes</dd></div>
        <div><dt>Unhealthy threshold</dt><dd>{{ tg.unhealthy }} consecutive health check failures</dd></div>
        <div><dt>Interval</dt><dd>{{ tg.interval }} seconds</dd></div>
      </dl></div>
    </section>
  </div>
  <NotFound v-else what="Target group" :id="name" back="target-groups" />

  <CsModal v-if="hcOpen" title="Edit health check settings" @close="hcOpen = false">
    <div class="cs-field"><label class="cs-label">Health check path</label><input v-model="hcPath" class="cs-input" />
      <span class="cs-constraint">Up to 1024 characters allowed.</span></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="hcOpen = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !hcPath.startsWith('/')" @click="saveHc">Save changes</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import NotFound from './NotFound.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const name = computed(() => ctx.route.value.params?.name || '');
const sel = ref<string[]>([]);
const targetSel = ref<string[]>([]);
const tab = ref('Targets');
const busy = ref(false);
const hcOpen = ref(false);
const hcPath = ref('/health');

const albs = computed(() => rows<any>(ctx.c.value, 'ec2.albs').map(a => ({ ...a, type: 'application', vpc: 'vpc-0prod20a1b2c3d4e' })));
const tgs = computed(() => rows<any>(ctx.c.value, 'ec2.target_groups').map(t => ({
  ...t, protoPort: `${t.protocol}: ${t.port}`, type: 'Instance', lb: albs.value.find(a => a.listener?.tg === t.name)?.name || '-',
})));
const tg = computed<any>(() => tgs.value.find(t => t.name === name.value) || null);
function count(state: string) { return (tg.value?.targets || []).filter((t: any) => t.state === state).length; }
function kind(state: string) { return state === 'healthy' ? 'success' : state === 'unhealthy' ? 'error' : state === 'draining' ? 'in-progress' : 'pending'; }

const lbCols = [{ id: 'name', header: 'Name' }, { id: 'dns', header: 'DNS name' }, { id: 'state', header: 'State' },
  { id: 'vpc', header: 'VPC ID' }, { id: 'type', header: 'Type' }, { id: 'scheme', header: 'Scheme' },
  { id: 'waf', header: 'AWS WAF', cell: (a: any) => a.waf || '-' }];
const tgCols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'arn', header: 'ARN' }, { id: 'port', header: 'Port' },
  { id: 'protocol', header: 'Protocol' }, { id: 'type', header: 'Target type' }, { id: 'lb', header: 'Load balancer' }];
const targetCols = [{ id: 'id', header: 'Instance ID' }, { id: 'name', header: 'Name' }, { id: 'port', header: 'Port' },
  { id: 'az', header: 'Zone' }, { id: 'state', header: 'Health status' }, { id: 'reason', header: 'Health status details', cell: (t: any) => t.reason || '-' }];

/** The Targets tab reads target health the way the console does: DescribeTargetHealth. */
async function describe() {
  if (!tg.value) return;
  await ctx.run(cli(['aws', 'elbv2', 'describe-target-health'], { '--target-group-arn': tg.value.arn }), '', { quiet: true });
}
onMounted(() => { if (page.value === 'target-group') describe(); });

async function deregister() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'elbv2', 'deregister-targets'], {
    '--target-group-arn': tg.value.arn, '--targets': targetSel.value.map(i => `Id=${i}`),
  }), `Successfully deregistered ${targetSel.value.length} target(s) from ${tg.value.name}`);
  busy.value = false;
  if (result.ok) targetSel.value = [];
}
function openHc() { hcPath.value = tg.value?.path || '/'; hcOpen.value = true; }
async function saveHc() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'elbv2', 'modify-target-group'], { '--target-group-arn': tg.value.arn, '--health-check-path': hcPath.value }),
    `Successfully updated health check settings for ${tg.value.name}`);
  busy.value = false;
  if (result.ok) hcOpen.value = false;
}
</script>

<style scoped>
.lb__ok { color: #00802f; font-weight: 700; }
.lb__bad { color: #db0000; font-weight: 700; }
</style>
