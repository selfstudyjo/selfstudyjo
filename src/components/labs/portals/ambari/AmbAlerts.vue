<template>
  <div>
    <div class="toolbar">
      <select v-model="status" class="form-control alerts__select" aria-label="Status filter">
        <option value="">All</option><option value="CRITICAL">CRIT</option><option value="WARNING">WARN</option>
        <option value="OK">OK</option>
      </select>
      <select v-model="service" class="form-control alerts__select" aria-label="Service filter">
        <option value="">All services</option>
        <option v-for="s in services" :key="s" :value="s">{{ s }}</option>
      </select>
      <span class="spacer"></span>
      <input v-model="filter" class="form-control alerts__filter" placeholder="Filter alert definitions"
             aria-label="Filter alerts" />
    </div>
    <div class="panel table-wrap">
      <table class="table">
        <thead>
          <tr><th>Alert Definition Name</th><th>Status</th><th>Service</th><th>Last Status Changed</th><th>State</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in shown" :key="row.name + row.service">
            <td>
              <a href="#" @click.prevent="open = row">{{ row.name }}</a>
              <div v-if="row.text" class="alerts__text">{{ row.text }}</div>
            </td>
            <td><span class="label" :class="labelClass(row.level)">{{ short(row.level) }}</span>
              <span v-if="row.count" class="text-muted"> ({{ row.count }})</span></td>
            <td><a href="#" @click.prevent="goService(row.service)">{{ row.service }}</a></td>
            <td>{{ row.changed }}</td>
            <td>Enabled</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!shown.length" class="empty">No alerts to display</div>
    </div>
    <AmbModal v-if="open" :title="open.name" ok-text="" cancel-text="Close" @close="open = null">
      <p><span class="label" :class="labelClass(open.level)">{{ short(open.level) }}</span> {{ open.service }}</p>
      <p>{{ open.text || open.description }}</p>
      <p class="text-muted">Check interval: 1 minute · Source: {{ open.source }}</p>
    </AmbModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches, rows } from '@/utils/portalKit';
import { SERVICE_NAMES } from './ambari';
import AmbModal from './AmbModal.vue';

const props = defineProps<{ view: Record<string, any> }>();
const emit = defineEmits<{ (event: 'navigate', route: any): void }>();

const status = ref('');
const service = ref('');
const filter = ref('');
const open = ref<Record<string, any> | null>(null);

const DEFINITIONS: [string, string, string][] = [
  ['HDFS', 'NameNode Web UI', 'WEB'], ['HDFS', 'DataNode Health Summary', 'AGGREGATE'],
  ['HDFS', 'HDFS Capacity Utilization', 'METRIC'], ['HDFS', 'NameNode Heap Usage (Hourly)', 'SERVER'],
  ['HDFS', 'Secondary NameNode Process', 'PORT'],
  ['YARN', 'ResourceManager Web UI', 'WEB'], ['YARN', 'NodeManager Health Summary', 'AGGREGATE'],
  ['YARN', 'App Timeline Web UI', 'WEB'],
  ['MapReduce2', 'History Server Web UI', 'WEB'],
  ['Hive', 'HiveServer2 Process', 'SCRIPT'], ['Hive', 'Hive Metastore Process', 'SCRIPT'],
  ['Spark2', 'Spark2 History Server', 'PORT'], ['Spark2', 'Spark2 Thrift Server', 'PORT'],
  ['ZooKeeper', 'ZooKeeper Server Process', 'PORT'],
];

const all = computed(() => {
  const live = rows(props.view, 'ambari.alerts');
  const out: Record<string, any>[] = live.map(a => ({
    name: a.definition || (a.service === 'HDFS' && /safe mode/i.test(a.text) ? 'NameNode Safe Mode'
      : a.service === 'YARN' ? 'YARN Application Failures' : `${a.service} Alert`),
    service: SERVICE_NAMES[String(a.service).toUpperCase()] || a.service,
    level: a.level, text: a.text, changed: 'less than a minute ago', count: 1, source: 'SCRIPT',
  }));
  for (const [svc, name, source] of DEFINITIONS) {
    if (out.some(o => o.name === name)) continue;
    out.push({ name, service: svc, level: 'OK', text: '', changed: 'about an hour ago', source,
               description: `${name} is responding normally.` });
  }
  const rank: Record<string, number> = { CRITICAL: 0, WARNING: 1, OK: 2 };
  return out.sort((a, b) => (rank[a.level] ?? 3) - (rank[b.level] ?? 3));
});
const services = computed(() => Array.from(new Set(all.value.map(a => a.service))));
const shown = computed(() => all.value.filter(a => (!status.value || a.level === status.value)
  && (!service.value || a.service === service.value) && matches(a, filter.value, ['name', 'service', 'text'])));

function short(level: string) {
  return ({ CRITICAL: 'CRIT', WARNING: 'WARN', OK: 'OK' } as Record<string, string>)[level] || level;
}
function labelClass(level: string) {
  return ({ CRITICAL: 'label-crit', WARNING: 'label-warn', OK: 'label-ok' } as Record<string, string>)[level] || 'label-unknown';
}
function goService(name: string) {
  const id = Object.keys(SERVICE_NAMES).find(k => SERVICE_NAMES[k] === name) || name;
  emit('navigate', { page: 'service', id, tab: 'summary' });
}
</script>

<style scoped>
.alerts__select { width: 150px; }
.alerts__filter { max-width: 300px; }
.alerts__text { font-size: 12px; color: #a94442; margin-top: 3px; }
</style>
