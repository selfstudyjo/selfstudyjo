<template>
  <div class="dash">
    <div class="dash__bar">
      <ul class="nav-tabs dash__tabs">
        <li :class="{ active: tab === 'metrics' }"><a href="#" @click.prevent="$emit('navigate', { page: 'dashboard', tab: 'metrics' })">Metrics</a></li>
        <li :class="{ active: tab === 'heatmaps' }"><a href="#" @click.prevent="$emit('navigate', { page: 'dashboard', tab: 'heatmaps' })">Heatmaps</a></li>
        <li :class="{ active: tab === 'configs' }"><a href="#" @click.prevent="$emit('navigate', { page: 'dashboard', tab: 'configs' })">Config History</a></li>
      </ul>
      <div v-if="tab === 'metrics'" class="dash__actions">
        <div class="amb-dd">
          <button type="button" class="btn btn-default btn-sm" @click.stop="actions = !actions">
            Metric Actions <AmbIcon name="caret" :size="11" />
          </button>
          <ul v-if="actions" class="amb-dd__menu is-right" @click="actions = false">
            <li><a href="#" @click.prevent="hidden = []">Reset all widgets to default</a></li>
            <li class="amb-dd__sep"></li>
            <li v-for="w in hidden" :key="w"><a href="#" @click.prevent="hidden = hidden.filter(h => h !== w)">Add: {{ w }}</a></li>
            <li v-if="!hidden.length"><a href="#" class="is-disabled">All widgets shown</a></li>
          </ul>
        </div>
        <span class="dash__range">Last 1 hour</span>
      </div>
    </div>

    <!-- METRICS — the widget grid. -->
    <div v-if="tab === 'metrics'" class="dash__grid">
      <div v-for="w in widgets" :key="w.title" class="widget" :class="{ 'is-wide': w.wide }">
        <div class="widget__head">
          <span class="widget__title">{{ w.title }}</span>
          <button type="button" class="widget__x" title="Hide" @click="hidden.push(w.title)">×</button>
        </div>
        <div class="widget__body">
          <template v-if="w.kind === 'pie'">
            <div class="widget__pie">
              <AmbChart kind="pie" :value="w.pct" :size="76" :pie-color="w.color" />
              <div class="widget__pietext">
                <span class="widget__big">{{ w.pct.toFixed(0) }}%</span>
                <span class="widget__sub">{{ w.sub }}</span>
              </div>
            </div>
          </template>
          <template v-else-if="w.kind === 'chart'">
            <div class="widget__chart"><AmbChart :series="w.series" /></div>
          </template>
          <template v-else-if="w.kind === 'links'">
            <ul class="widget__links">
              <li v-for="link in w.links" :key="link.label">
                <a href="#" @click.prevent="$emit('navigate', link.to)">{{ link.label }}</a>
              </li>
            </ul>
          </template>
          <template v-else>
            <span class="widget__big" :class="w.tone">{{ w.value }}</span>
            <span v-if="w.sub" class="widget__sub">{{ w.sub }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- HEATMAPS -->
    <div v-else-if="tab === 'heatmaps'" class="panel">
      <div class="panel-body heat">
        <div class="heat__side">
          <label class="control-label" for="heat-metric">Select Metric</label>
          <select id="heat-metric" v-model="heatMetric" class="form-control">
            <option value="disk">Host Disk Space Used %</option>
            <option value="load">Host CPU Load Average</option>
            <option value="mem">Host Memory Used %</option>
          </select>
          <ul class="heat__legend">
            <li v-for="band in bands" :key="band.label"><i :style="{ background: band.color }"></i>{{ band.label }}</li>
          </ul>
        </div>
        <div class="heat__racks">
          <div class="heat__rack-name">/default-rack</div>
          <div class="heat__hosts">
            <button v-for="host in hosts" :key="host.host" type="button" class="heat__host"
                    :style="{ background: heatColor(heatValue(host)) }"
                    :title="`${host.fqdn}: ${heatValue(host).toFixed(1)}`"
                    @click="$emit('navigate', { page: 'host', id: host.host })"></button>
          </div>
        </div>
      </div>
    </div>

    <!-- CONFIG HISTORY -->
    <div v-else class="panel">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Service</th><th>Config Group</th><th>Created</th><th>Author</th><th>Notes</th></tr></thead>
          <tbody>
            <tr v-for="(h, i) in history" :key="i">
              <td>
                <a href="#" @click.prevent="$emit('navigate', { page: 'service', id: h.service, tab: 'configs' })">
                  {{ name(h.service) }}
                </a>
                <span class="cfg-version">V{{ h.version }}</span>
                <span v-if="h.current" class="label label-ok">Current</span>
              </td>
              <td>Default</td>
              <td>{{ h.at }}</td>
              <td>{{ h.user }}</td>
              <td>{{ h.note || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { pick, rows } from '@/utils/portalKit';
import { SERVICE_NAMES, SERVICE_ORDER, shortStamp, uptime } from './ambari';
import AmbChart from './AmbChart.vue';
import AmbIcon from './AmbIcon.vue';

const props = defineProps<{ view: Record<string, any>; tab: string }>();
defineEmits<{ (event: 'navigate', route: any): void }>();

const actions = ref(false);
const hidden = ref<string[]>([]);
const heatMetric = ref('disk');

const metrics = computed(() => pick<Record<string, any>>(props.view, 'ambari.metrics', {}));
const nn = computed(() => pick<Record<string, any>>(props.view, 'namenode', {}));
const hosts = computed(() => rows(props.view, 'ambari.host_details'));
const services = computed(() => rows(props.view, 'ambari.cluster_services'));
const stopped = (id: string) => services.value.find(s => s.id === id)?.state === 'INSTALLED';

function name(id: string) {
  return SERVICE_NAMES[id] || id;
}

/** A gentle, deterministic wave around a base, scaled by the cluster's real activity. */
function wave(base: number, amp: number, seed: number, activity: number[]) {
  return Array.from({ length: 12 }, (_, i) =>
    Math.max(0, base + amp * Math.sin((i + seed) * 0.9) * 0.4 + (activity[i] || 0) * amp));
}

const widgets = computed(() => {
  const m = metrics.value;
  const activity: number[] = Array.isArray(m.activity) ? m.activity : [];
  const dnTotal = rows(props.view, 'datanodes').length;
  const heapPct = m.namenode_heap_max_mb ? (100 * m.namenode_heap_used_mb) / m.namenode_heap_max_mb : 0;
  const yarnPct = m.yarn_memory_total_mb ? (100 * m.yarn_memory_used_mb) / m.yarn_memory_total_mb : 0;
  const list: any[] = [
    { title: 'HDFS Disk Usage', kind: 'pie', pct: Number(nn.value.used_percent || 0),
      sub: `${nn.value.used_h || '0B'} / ${nn.value.capacity_h || '0B'}`, color: '#41bfae' },
    { title: 'DataNodes Live', value: `${m.datanodes_live ?? dnTotal}/${dnTotal}`,
      tone: stopped('HDFS') ? 'is-red' : 'is-green' },
    { title: 'HDFS Links', kind: 'links', links: [
      { label: 'NameNode', to: { page: 'service', id: 'HDFS' } },
      { label: 'SNameNode', to: { page: 'service', id: 'HDFS' } },
      { label: `${dnTotal} DataNodes`, to: { page: 'hosts' } },
      { label: 'More...', to: { page: 'service', id: 'HDFS' } },
    ] },
    { title: 'Memory Usage', kind: 'chart', series: [wave(6, 3, 1, activity), wave(3, 1.5, 3, activity)] },
    { title: 'Network Usage', kind: 'chart', series: [wave(2, 2, 2, activity), wave(1.5, 1.4, 5, activity)] },
    { title: 'CPU Usage', kind: 'chart', series: [wave(8, 6, 4, activity)] },
    { title: 'Cluster Load', kind: 'chart', series: [wave(1.2, 1, 0, activity), wave(4, 0.2, 2, [])] },
    { title: 'NameNode Heap', kind: 'pie', pct: stopped('HDFS') ? 0 : heapPct,
      sub: `${Number(m.namenode_heap_used_mb || 0).toFixed(0)} MB / ${m.namenode_heap_max_mb || 1024} MB`,
      color: '#5b9bd5' },
    { title: 'NameNode RPC', value: stopped('HDFS') ? 'n/a' : `${m.namenode_rpc_ms ?? 0.8} ms`, sub: 'average queue wait time' },
    { title: 'NameNode CPU WIO', value: stopped('HDFS') ? 'n/a' : `${m.namenode_cpu_wio ?? 0.3}%` },
    { title: 'NameNode Uptime', value: stopped('HDFS') ? 'n/a' : uptime(m.uptime_s || 0),
      tone: stopped('HDFS') ? 'is-red' : '' },
    { title: 'ResourceManager Heap', kind: 'pie', pct: stopped('YARN') ? 0 : 21,
      sub: '215 MB / 1024 MB', color: '#5b9bd5' },
    { title: 'ResourceManager Uptime', value: stopped('YARN') ? 'n/a' : uptime(m.uptime_s || 0),
      tone: stopped('YARN') ? 'is-red' : '' },
    { title: 'NodeManagers Live', value: `${m.nodemanagers_live ?? dnTotal}/${dnTotal}`,
      tone: stopped('YARN') ? 'is-red' : 'is-green' },
    { title: 'YARN Memory', kind: 'pie', pct: yarnPct,
      sub: `${m.yarn_memory_used_mb || 0} MB / ${m.yarn_memory_total_mb || 0} MB`, color: '#e8bc4e' },
    { title: 'YARN Links', kind: 'links', links: [
      { label: 'ResourceManager', to: { page: 'rm' } },
      { label: `${dnTotal} NodeManagers`, to: { page: 'hosts' } },
      { label: 'Queue Manager', to: { page: 'queues' } },
    ] },
  ];
  return list.filter(w => !hidden.value.includes(w.title));
});

const bands = [
  { label: '0% - 20%', color: '#1EB475' }, { label: '20% - 40%', color: '#6fc46c' },
  { label: '40% - 60%', color: '#e8d34e' }, { label: '60% - 80%', color: '#e98a41' },
  { label: '80% - 100%', color: '#EF6162' }, { label: 'Invalid data', color: '#ccc' },
];

function heatValue(host: Record<string, any>) {
  if (heatMetric.value === 'load') return Number(host.load_avg || 0) * 20;
  if (heatMetric.value === 'mem') return host.host === 'master-1' ? 46 : 28 + Number(host.load_avg || 0) * 8;
  return Number(host.disk_used_percent || 0);
}

function heatColor(value: number) {
  const index = Math.min(4, Math.max(0, Math.floor(value / 20)));
  return bands[index].color;
}

const history = computed(() => {
  const list = rows(props.view, 'ambari.config_history');
  const seen = new Set<string>();
  const out: Record<string, any>[] = list.map(h => {
    const current = !seen.has(h.service);
    seen.add(h.service);
    return { ...h, at: shortStamp(h.at), current };
  });
  for (const id of SERVICE_ORDER) {
    out.push({ service: id, version: 1, at: 'Initial', user: 'admin',
               note: `Initial configurations for ${name(id)}`, current: !seen.has(id) });
  }
  return out;
});
</script>

<style scoped>
.dash__bar { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; border-bottom: 1px solid #ddd; }
.dash__bar .dash__tabs.nav-tabs { margin: 0; border-bottom: 0; flex: 1 1 auto; min-width: 0; }
.dash__actions { display: flex; align-items: center; gap: 12px; padding-bottom: 8px; margin-left: auto; }
.dash__range { color: #666; font-size: 13px; }
.dash__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 14px; }
.widget {
  background: #fff; height: 157px; box-shadow: 0 1px 1px 0 rgba(51, 51, 51, .15); display: flex; flex-direction: column;
  padding: 10px 12px; box-sizing: border-box; min-width: 0;
}
.widget__head { display: flex; align-items: center; }
.widget__title { color: #666; font-size: 14px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.widget__x { opacity: 0; border: 0; background: none; color: #707070; font-size: 16px; cursor: pointer; width: 24px; height: 24px; padding: 0; line-height: 1; }
.widget:focus-within .widget__x { opacity: 1; }
.widget:hover .widget__x { opacity: 1; }
.widget__body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
.widget__big { font-size: 28px; color: #333; font-weight: 300; }
.widget__big.is-green { color: #158a57; }
.widget__big.is-red { color: #d64545; }
.widget__sub { color: #707070; font-size: 12px; text-align: center; }
.widget__pie { display: flex; align-items: center; gap: 12px; }
.widget__pietext { display: flex; flex-direction: column; }
.widget__pietext .widget__big { font-size: 22px; }
.widget__chart { width: 100%; height: 100%; padding-top: 6px; }
.widget__links { list-style: none; margin: 0; padding: 0; align-self: flex-start; font-size: 13px; line-height: 1.8; }
.widget__links a { display: inline-block; line-height: 20px; padding: 1px 0; }
.heat { display: flex; gap: 30px; flex-wrap: wrap; }
.heat__side { width: 240px; max-width: 100%; }
.heat__legend { list-style: none; padding: 0; margin: 16px 0 0; font-size: 12px; color: #666; }
.heat__legend li { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.heat__legend i { width: 14px; height: 14px; display: inline-block; }
.heat__racks { flex: 1; min-width: 200px; }
.heat__rack-name { color: #666; font-size: 13px; margin-bottom: 8px; }
.heat__hosts { display: flex; gap: 6px; flex-wrap: wrap; }
.heat__host { width: 46px; height: 46px; border: 0; cursor: pointer; }
.cfg-version { margin: 0 6px; color: #666; font-size: 12px; }
@container sl-portal (max-width: 720px) {
  .dash__bar { align-items: stretch; border-bottom: 0; row-gap: 0; }
  .dash__bar .dash__tabs.nav-tabs { flex-basis: 100%; border-bottom: 1px solid #ddd; }
  .dash__actions { padding: 10px 0 0; }
  .heat { gap: 16px; }
  .heat__side { width: 100%; }
}
</style>
