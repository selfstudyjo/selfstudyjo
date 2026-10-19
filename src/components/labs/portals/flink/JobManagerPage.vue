<template>
  <div class="fk-page fk-page--flush">
    <nav class="fk-tabs" aria-label="Job Manager">
      <button v-for="t in TABS" :key="t.id" type="button" class="fk-tab" :class="{ 'is-active': tab === t.id }"
              @click="fk.go({ page: 'jobmanager', jmTab: t.id })">{{ t.label }}</button>
    </nav>
    <div class="fk-page">
      <template v-if="tab === 'metrics'">
        <div class="fk-jm-grid">
          <section class="fk-card">
            <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">JVM (Heap/Non-Heap) Memory</span></header>
            <div class="fk-table-wrap">
              <table class="fk-table fk-table--sm">
                <thead><tr><th>Type</th><th class="num">Committed</th><th class="num">Used</th><th class="num">Maximum</th></tr></thead>
                <tbody>
                  <tr><td>Heap</td><td class="num">{{ fmtBytes(1024 ** 3) }}</td><td class="num">{{ fmtBytes(heapUsed) }}</td><td class="num">{{ fmtBytes(1024 ** 3) }}</td></tr>
                  <tr><td>Non-Heap</td><td class="num">{{ fmtBytes(180 * 1024 ** 2) }}</td><td class="num">{{ fmtBytes(152 * 1024 ** 2) }}</td><td class="num">{{ fmtBytes(744 * 1024 ** 2) }}</td></tr>
                </tbody>
              </table>
            </div>
          </section>
          <section class="fk-card">
            <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Cluster</span></header>
            <div class="fk-card__body fk-jm-body">
              <dl class="fk-desc">
                <dt>Flink Version</dt><dd>{{ fk.cluster.value.version }}</dd>
                <dt>Task Managers</dt><dd>{{ fk.cluster.value.taskmanagers }}</dd>
                <dt>Slots (free / total)</dt><dd>{{ fk.cluster.value.slots_free }} / {{ fk.cluster.value.slots_total }}</dd>
                <dt>Jobs</dt><dd>{{ fk.jobs.value.length }}</dd>
                <dt>Savepoints taken</dt><dd>{{ fk.savepoints.value.length }}</dd>
              </dl>
            </div>
          </section>
        </div>
      </template>

      <section v-else-if="tab === 'config'" class="fk-card">
        <header class="fk-card__head fk-card__head--sm">
          <span class="fk-card__title">Configuration</span>
          <span class="fk-card__extra">
            <input v-model="filter" class="fk-input fk-filter" type="search" placeholder="Filter keys" aria-label="Filter configuration" />
          </span>
        </header>
        <div class="fk-table-wrap">
          <table class="fk-table fk-table--sm">
            <thead><tr><th>Key</th><th>Value</th></tr></thead>
            <tbody>
              <tr v-for="[k, v] in config" :key="k"><td class="fk-mono">{{ k }}</td><td class="fk-mono wrap">{{ v }}</td></tr>
              <tr v-if="!config.length"><td colspan="2" class="fk-empty">No key matches the filter.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="tab === 'logs'" class="fk-card">
        <div class="fk-card__body"><pre class="fk-pre fk-pre--tall">{{ logLines }}</pre></div>
      </section>

      <section v-else-if="tab === 'stdout'" class="fk-card">
        <div class="fk-card__body"><pre class="fk-pre">{{ stdout }}</pre></div>
      </section>

      <section v-else class="fk-card">
        <div class="fk-table-wrap">
          <table class="fk-table fk-table--sm">
            <thead><tr><th>Log Name</th><th class="num">Size</th><th>Last Modified Time</th></tr></thead>
            <tbody>
              <tr v-for="f in logFiles" :key="f.name" class="is-link" @click="fk.go({ page: 'jobmanager', jmTab: f.tab })">
                <td class="fk-mono">{{ f.name }}</td><td class="num">{{ fmtBytes(f.size) }}</td><td>{{ fmtTime(fk.simNow.value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFk } from './fkContext';
import { CHECKPOINT_DIR, SAVEPOINT_DIR, fmtBytes, fmtTime, isRunning } from './flink';

const TABS = [
  { id: 'metrics', label: 'Metrics' },
  { id: 'config', label: 'Configuration' },
  { id: 'logs', label: 'Logs' },
  { id: 'stdout', label: 'Stdout' },
  { id: 'loglist', label: 'Log List' },
];
const fk = useFk();
const tab = computed(() => fk.route.value.jmTab || 'metrics');
const filter = ref('');

const heapUsed = computed(() => (380 + fk.jobs.value.filter(isRunning).length * 64) * 1024 ** 2);

const config = computed(() => {
  const cluster = fk.cluster.value;
  const perTm = cluster.taskmanagers ? Math.round(cluster.slots_total / cluster.taskmanagers) : 4;
  const base: Record<string, string> = {
    'jobmanager.rpc.address': 'flink-jobmanager.shopflow.internal',
    'jobmanager.rpc.port': '6123',
    'jobmanager.memory.process.size': '1600m',
    'rest.address': 'flink-jobmanager.shopflow.internal',
    'rest.port': '8081',
    'taskmanager.numberOfTaskSlots': String(perTm),
    'taskmanager.memory.process.size': '4096m',
    'parallelism.default': '1',
    'state.backend.type': 'rocksdb',
    'state.backend.incremental': 'true',
    'state.checkpoints.dir': CHECKPOINT_DIR,
    'state.savepoints.dir': SAVEPOINT_DIR,
    'execution.checkpointing.externalized-checkpoint-retention': 'RETAIN_ON_CANCELLATION',
    'restart-strategy.type': 'fixed-delay',
    'restart-strategy.fixed-delay.attempts': '3',
    'high-availability.type': 'NONE',
    'web.submit.enable': 'true',
    'sql-gateway.endpoint.rest.address': 'flink-jobmanager.shopflow.internal',
    'sql-gateway.endpoint.rest.port': '8083',
  };
  const merged = { ...base, ...fk.settings.value };
  const needle = filter.value.trim().toLowerCase();
  return Object.entries(merged)
    .filter(([k, v]) => !needle || k.toLowerCase().includes(needle) || v.toLowerCase().includes(needle))
    .sort(([a], [b]) => a.localeCompare(b));
});

const logLines = computed(() => {
  const v = fk.cluster.value.version;
  const lines = [
    `INFO  org.apache.flink.runtime.entrypoint.ClusterEntrypoint - Starting StandaloneSessionClusterEntrypoint (Version: ${v})`,
    'INFO  org.apache.flink.runtime.rest.RestServerEndpoint - Rest endpoint listening at flink-jobmanager.shopflow.internal:8081',
    'INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher - Dispatcher started',
  ];
  for (let i = 0; i < fk.cluster.value.taskmanagers; i += 1) {
    lines.push(`INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager - Registering TaskManager with ResourceID taskmanager-${i + 1}`);
  }
  for (const job of fk.jobs.value) {
    lines.push(`INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher - Received JobGraph submission '${job.name}' (${job.jid}).`);
    lines.push(`INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph - Job ${job.name} (${job.jid}) switched from state CREATED to RUNNING.`);
    if (!isRunning(job)) {
      lines.push(`INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph - Job ${job.name} (${job.jid}) switched from state RUNNING to ${job.state}.`);
    }
  }
  for (const entry of (Array.isArray(fk.view.value?.flink?.log) ? fk.view.value.flink.log : [])) {
    lines.push(`INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher - ${String(entry?.text ?? entry)}`);
  }
  return lines.join('\n');
});

const stdout = computed(() => 'The JobManager has written nothing to stdout.');
const logFiles = computed(() => [
  { name: 'flink--standalonesession-0-flink-jobmanager.log', size: logLines.value.length, tab: 'logs' },
  { name: 'flink--standalonesession-0-flink-jobmanager.out', size: 0, tab: 'stdout' },
]);
</script>

<style scoped src="./fk.css"></style>
<style scoped>
.fk-jm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 24px; }
.fk-jm-body { padding: 12px; }
.fk-filter { width: 220px; max-width: 100%; }
.fk-pre--tall { max-height: 560px; }
</style>
