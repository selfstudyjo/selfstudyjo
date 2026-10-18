<template>
  <!-- Paths -->
  <div v-if="page === 'reachability'">
    <CsHeader title="Reachability Analyzer" description="Analyze the network reachability between a source and a destination: Reachability Analyzer walks every security group, network ACL, route table and transit gateway hop, in both directions, and names the component that blocks the path." />
    <CsTable title="Paths" :items="paths" :columns="cols" track-by="id" selection-type="single" v-model:selected="sel"
             filter-placeholder="Filter paths" empty-title="No paths" empty-text="Create a path to analyze reachability.">
      <template #actions>
        <CsDropdown :items="[{ id: 'analyze', text: 'Analyze path' }, { id: 'delete', text: 'Delete path' }]" :disabled="!selected" @select="act" />
        <button type="button" class="cs-btn cs-btn--primary" @click="creating = true">Create path</button>
      </template>
      <template #cell-id="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'reachability-path', { id: row.id })">{{ row.id }}</a></template>
      <template #cell-status="{ row }">
        <CsStatus v-if="row.last" :type="row.last.found ? 'success' : 'error'" :label="row.last.found ? 'Reachable' : 'Not reachable'" />
        <span v-else class="cs-muted">Not analyzed</span>
      </template>
    </CsTable>
  </div>

  <!-- One path -->
  <div v-else-if="path">
    <CsHeader :title="path.id">
      <template #actions>
        <button type="button" class="cs-btn" @click="deleting = path.id">Delete path</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="analyze(path.id)"><span v-if="busy" class="cs-btn__spinner" />Analyze path</button>
      </template>
    </CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Path details" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Source</dt><dd>{{ path.source }}</dd></div><div><dt>Destination</dt><dd>{{ path.destination }}</dd></div>
        <div><dt>Protocol</dt><dd>{{ path.protocol.toUpperCase() }}</dd></div><div><dt>Destination port</dt><dd>{{ path.port }}</dd></div>
      </dl></div>
    </section>
    <CsTable title="Analyses" :items="pathAnalyses" :columns="anaCols" track-by="id" selection-type="single" v-model:selected="anaSel"
             empty-title="No analyses" empty-text="Analyze the path to see whether it is reachable.">
      <template #cell-found="{ row }"><CsStatus :type="row.found ? 'success' : 'error'" :label="row.found ? 'Reachable' : 'Not reachable'" /></template>
    </CsTable>
    <section v-if="analysis" class="cs-container ra__walk">
      <div class="cs-container__head"><CsHeader :title="`Analysis explorer: ${analysis.id}`" :level="2" :info="false"
        :description="analysis.found ? 'A network path was found from the source to the destination, and back.' : `Blocked at ${analysis.blocked}: ${analysis.reason}`" /></div>
      <div class="cs-container__body">
        <div v-if="!analysis.found" class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
          <div><strong>Not reachable</strong>{{ analysis.blocked }} - {{ analysis.reason }}</div></div>
        <ol class="ra__hops">
          <li v-for="(hop, i) in analysis.hops" :key="i" :class="'is-' + verdictKind(hop.verdict)">
            <span class="ra__dot">{{ Number(i) + 1 }}</span>
            <div class="ra__hop"><div class="ra__comp"><span class="cs-mono">{{ hop.component }}</span>
              <CsStatus :type="verdictKind(hop.verdict)" :label="hop.verdict" /></div>
              <div class="cs-muted">{{ hop.detail }}</div></div>
          </li>
        </ol>
      </div>
    </section>
  </div>
  <NotFound v-else what="Path" :id="id" back="reachability" />

  <CsModal v-if="creating" title="Create and analyze path" size="large" @close="creating = false">
    <div class="cs-stack">
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Source type</label><select class="cs-select" disabled><option>Instances</option></select></div>
        <div class="cs-field"><label class="cs-label">Source</label>
          <select v-model="form.source" class="cs-select"><option v-for="i in instances" :key="i.id" :value="i.id">{{ i.id }} ({{ i.name }})</option></select></div>
      </div>
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Destination type</label>
          <select v-model="form.destType" class="cs-select"><option value="instance">Instances</option><option value="ip">IP addresses</option>
            <option value="host">Hostname (Route 53 private record)</option><option value="internet">Internet</option><option value="service">AWS service (VPC endpoint)</option></select></div>
        <div class="cs-field"><label class="cs-label">Destination</label>
          <select v-if="form.destType === 'instance'" v-model="form.dest" class="cs-select"><option v-for="i in instances" :key="i.id" :value="i.id">{{ i.id }} ({{ i.name }})</option></select>
          <select v-else-if="form.destType === 'service'" v-model="form.dest" class="cs-select"><option value="service:s3">com.amazonaws.eu-west-1.s3</option>
            <option value="service:ssm">com.amazonaws.eu-west-1.ssm</option></select>
          <input v-else-if="form.destType !== 'internet'" v-model="form.dest" class="cs-input" :placeholder="form.destType === 'ip' ? '10.30.1.10' : 'sql.acme.internal'" list="ra-hosts" />
          <input v-else class="cs-input" value="internet (0.0.0.0/0)" disabled />
          <datalist id="ra-hosts"><option v-for="h in hosts" :key="h" :value="h" /></datalist></div>
      </div>
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Protocol</label><select v-model="form.protocol" class="cs-select"><option value="tcp">TCP</option><option value="udp">UDP</option></select></div>
        <div class="cs-field"><label class="cs-label">Destination port <small>- optional</small></label><input v-model="form.port" class="cs-input" inputmode="numeric" placeholder="443" /></div>
      </div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="creating = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !destination || !/^\d+$/.test(form.port)" @click="createAndAnalyze">
        <span v-if="busy" class="cs-btn__spinner" />Create and analyze path</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete path" :busy="busy" @close="deleting = ''" @confirm="remove">
    <p class="ra__p">Delete the path <span class="cs-mono">{{ deleting }}</span>? Its analyses are kept.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
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
const id = computed(() => ctx.route.value.params?.id || '');
const sel = ref<string[]>([]);
const anaSel = ref<string[]>([]);
const busy = ref(false);
const creating = ref(false);
const deleting = ref('');

const analyses = computed(() => rows<any>(ctx.c.value, 'net.analyses'));
const paths = computed(() => rows<any>(ctx.c.value, 'net.paths').map(p => {
  const mine = analyses.value.filter(a => a.path === p.id);
  return { ...p, last: mine[mine.length - 1] || null, proto: String(p.protocol).toUpperCase() };
}));
const path = computed<any>(() => paths.value.find(p => p.id === id.value) || null);
const selected = computed(() => paths.value.find(p => p.id === sel.value[0]) || null);
const pathAnalyses = computed(() => analyses.value.filter(a => a.path === id.value).slice().reverse());
const analysis = computed<any>(() => pathAnalyses.value.find(a => a.id === anaSel.value[0]) || pathAnalyses.value[0] || null);
watch(pathAnalyses, list => { if (list[0] && !list.some(a => a.id === anaSel.value[0])) anaSel.value = [list[0].id]; }, { immediate: true });

const instances = computed(() => rows<any>(ctx.c.value, 'ec2.instances').filter(i => i.state !== 'terminated' && i.region === ctx.home.value));
const hosts = computed(() => rows<any>(ctx.c.value, 'net.zones').filter(z => z.private)
  .flatMap(z => z.records.map((r: any) => String(r.name).replace(/\.$/, ''))));

const cols = [
  { id: 'id', header: 'Path ID', sortKey: 'id' }, { id: 'source', header: 'Source', sortKey: 'source' },
  { id: 'destination', header: 'Destination', sortKey: 'destination' }, { id: 'proto', header: 'Protocol' },
  { id: 'port', header: 'Destination port' }, { id: 'status', header: 'Last analysis status' },
];
const anaCols = [{ id: 'id', header: 'Analysis ID' }, { id: 'found', header: 'Reachability status' },
  { id: 'blocked', header: 'Blocking component', cell: (a: any) => a.blocked || '-' }, { id: 'time', header: 'Analysis start (shift time)' }];

function verdictKind(verdict: string): string {
  if (['DENY', 'NO ROUTE', 'BLACKHOLE', 'DOWN', 'NO RETURN', 'NXDOMAIN'].includes(verdict)) return 'error';
  return 'success';
}

const form = reactive({ source: '', destType: 'host', dest: '', protocol: 'tcp', port: '443' });
watch(instances, list => { if (!form.source && list[0]) form.source = list[0].id; }, { immediate: true });
watch(() => form.destType, () => { form.dest = form.destType === 'service' ? 'service:s3' : form.destType === 'instance' ? (instances.value[0]?.id || '') : ''; });
const destination = computed(() => (form.destType === 'internet' ? 'internet' : form.dest.trim()));

function act(action: string) {
  if (!selected.value) return;
  if (action === 'analyze') analyze(selected.value.id);
  if (action === 'delete') deleting.value = selected.value.id;
}
async function analyze(pid: string) {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'start-network-insights-analysis'], { '--network-insights-path-id': pid }), '', { failure: 'Analysis failed to start' });
  busy.value = false;
  if (result.ok) {
    const found = /NetworkPathFound: true/.test(result.output || '');
    ctx.api.notify(found ? 'success' : 'warning', found ? `Analysis of ${pid} completed: reachable.` : `Analysis of ${pid} completed: not reachable.`);
    if (page.value !== 'reachability-path') ctx.to('vpc', 'reachability-path', { id: pid });
  }
}
async function createAndAnalyze() {
  busy.value = true;
  const created = await ctx.run(cli(['aws', 'ec2', 'create-network-insights-path'], {
    '--source': form.source, '--destination': destination.value, '--protocol': form.protocol, '--destination-port': form.port,
  }));
  busy.value = false;
  if (!created.ok) return;
  const pid = parseJson<any>(created.output)?.NetworkInsightsPath?.NetworkInsightsPathId;
  creating.value = false;
  if (pid) await analyze(pid);
}
async function remove() {
  busy.value = true;
  const pid = deleting.value;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-network-insights-path'], { '--network-insights-path-id': pid }), `Path ${pid} deleted.`);
  busy.value = false;
  deleting.value = '';
  if (result.ok && page.value === 'reachability-path') ctx.to('vpc', 'reachability');
}
</script>

<style scoped>
.ra__p { margin: 0; }
.ra__walk { margin-top: 20px; }
.ra__hops { list-style: none; margin: 0; padding: 0; position: relative; }
.ra__hops li { display: flex; gap: 12px; padding: 8px 0; position: relative; }
.ra__hops li + li::before { content: ''; position: absolute; left: 11px; top: -8px; height: 16px; border-left: 2px solid #c6c6cd; }
.ra__dot { flex: none; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: #00802f; color: #fff; }
.ra__hops li.is-error .ra__dot { background: #db0000; }
.ra__hop { min-width: 0; }
.ra__comp { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-weight: 700; }
</style>
