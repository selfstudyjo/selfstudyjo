<template>
  <div class="fk-page">
    <template v-if="!current">
      <section class="fk-card">
        <header class="fk-card__head"><span class="fk-card__title">Task Managers</span></header>
        <div class="fk-table-wrap">
          <table class="fk-table">
            <thead>
              <tr>
                <th>Path, ID</th><th class="num">Data Port</th><th>Last Heartbeat</th><th class="num">All Slots</th>
                <th class="num">Free Slots</th><th class="num">CPU Cores</th><th class="num">Physical MEM</th>
                <th class="num">JVM Heap Size</th><th class="num">Flink Managed MEM</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tm in fk.taskManagers.value" :key="tm.id" class="is-link" tabindex="0"
                  @click="open(tm.id)" @keydown.enter="open(tm.id)">
                <td class="wrap"><span class="fk-tm-path fk-mono">{{ tm.path }}</span><span class="fk-tm-id fk-mono">{{ tm.id }}</span></td>
                <td class="num">{{ tm.dataPort }}</td>
                <td class="nowrap">{{ fmtTime(tm.heartbeat) }}</td>
                <td class="num">{{ tm.slots }}</td>
                <td class="num">{{ tm.free }}</td>
                <td class="num">{{ tm.cores }}</td>
                <td class="num">{{ fmtBytes(tm.physicalMemory) }}</td>
                <td class="num">{{ fmtBytes(tm.heap) }}</td>
                <td class="num">{{ fmtBytes(tm.managed) }}</td>
              </tr>
              <tr v-if="!fk.taskManagers.value.length">
                <td colspan="9" class="fk-empty"><FkIcon name="inbox" class="fk-empty__ico" />No task managers are registered with this JobManager.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="fk-card">
        <header class="fk-card__head">
          <button type="button" class="fk-btn fk-btn--sm fk-btn--link" @click="fk.go({ page: 'taskmanagers' })">Task Managers</button>
          <span class="fk-muted">/</span>
          <span class="fk-card__title fk-mono">{{ current.id }}</span>
        </header>
        <div class="fk-card__body fk-tm-summary">
          <div><span>Free Slots / All Slots</span><strong>{{ current.free }} / {{ current.slots }}</strong></div>
          <div><span>CPU Cores</span><strong>{{ current.cores }}</strong></div>
          <div><span>Physical Memory</span><strong>{{ fmtBytes(current.physicalMemory) }}</strong></div>
          <div><span>JVM Heap Size</span><strong>{{ fmtBytes(current.heap) }}</strong></div>
          <div><span>Flink Managed Memory</span><strong>{{ fmtBytes(current.managed) }}</strong></div>
        </div>
      </section>
      <nav class="fk-tabs fk-tabs--card">
        <button v-for="t in TABS" :key="t" type="button" class="fk-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
      </nav>
      <section v-if="tab === 'Metrics'" class="fk-card">
        <header class="fk-card__head fk-card__head--sm"><span class="fk-card__title">Memory Model</span></header>
        <div class="fk-table-wrap">
          <table class="fk-table fk-table--sm">
            <thead><tr><th>Flink Memory Model</th><th>Effective Configuration</th><th>Metric</th></tr></thead>
            <tbody>
              <tr v-for="m in memory" :key="m.name">
                <td>{{ m.name }}</td><td class="num">{{ fmtBytes(m.size) }}</td>
                <td><span class="fk-bar"><span :style="{ width: m.used + '%' }"></span></span><span class="fk-muted fk-bar-label">{{ m.used }}%</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section v-else-if="tab === 'Slots'" class="fk-card">
        <div class="fk-table-wrap">
          <table class="fk-table fk-table--sm">
            <thead><tr><th>Slot</th><th>Status</th><th>Job</th></tr></thead>
            <tbody>
              <tr v-for="s in slots" :key="s.index">
                <td>{{ s.index }}</td>
                <td><span class="fk-tag" :class="s.job ? 'fk-tag--blue' : 'fk-tag--plain'">{{ s.job ? 'ALLOCATED' : 'FREE' }}</span></td>
                <td class="fk-mono">{{ s.job || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section v-else-if="tab === 'Logs'" class="fk-card">
        <div class="fk-card__body"><pre class="fk-pre">{{ log }}</pre></div>
      </section>
      <section v-else class="fk-card">
        <div class="fk-card__body"><pre class="fk-pre">{{ stdout }}</pre></div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FkIcon from './FkIcon.vue';
import { useFk } from './fkContext';
import { fmtBytes, fmtTime, isRunning } from './flink';

const TABS = ['Metrics', 'Slots', 'Logs', 'Stdout'] as const;
const fk = useFk();
const tab = ref<(typeof TABS)[number]>('Metrics');
const current = computed(() => (fk.route.value.page === 'taskmanager'
  ? fk.taskManagers.value.find(tm => tm.id === fk.route.value.tm) : undefined));

function open(id: string) {
  tab.value = 'Metrics';
  fk.go({ page: 'taskmanager', tm: id });
}

const memory = computed(() => {
  const tm = current.value;
  if (!tm) return [];
  const usedShare = tm.slots ? (tm.slots - tm.free) / tm.slots : 0;
  const pct = (base: number) => Math.min(99, Math.round(base + usedShare * 45));
  return [
    { name: 'Framework Heap', size: 128 * 1024 ** 2, used: pct(22) },
    { name: 'Task Heap', size: tm.heap - 128 * 1024 ** 2, used: pct(18) },
    { name: 'Managed Memory', size: tm.managed, used: Math.round(usedShare * 100) },
    { name: 'Framework Off-Heap', size: 128 * 1024 ** 2, used: pct(5) },
    { name: 'Network', size: 320 * 1024 ** 2, used: pct(8) },
    { name: 'JVM Metaspace', size: 256 * 1024 ** 2, used: 61 },
    { name: 'JVM Overhead', size: 384 * 1024 ** 2, used: 12 },
  ];
});

/** Which slot holds what: running jobs take slots across the task managers in order. */
const slots = computed(() => {
  const tm = current.value;
  if (!tm) return [];
  const index = fk.taskManagers.value.indexOf(tm);
  const holders: string[] = [];
  for (const job of fk.jobs.value.filter(isRunning)) {
    for (let i = 0; i < Math.max(1, job.parallelism); i += 1) holders.push(job.jid);
  }
  const before = fk.taskManagers.value.slice(0, index).reduce((sum, t) => sum + (t.slots - t.free), 0);
  const taken = tm.slots - tm.free;
  return Array.from({ length: tm.slots }, (_, i) => ({ index: i, job: i < taken ? holders[before + i] || 'allocated' : '' }));
});

/** What a `'connector' = 'print'` sink wrote: Flink prints it to the TaskManager's stdout. */
const stdout = computed(() => {
  const lines = fk.jobs.value.flatMap(job => (Array.isArray(job.stdout) ? job.stdout.map(String) : []));
  return lines.length ? lines.join('\n') : 'Nothing has been written to stdout. A print sink writes its rows here.';
});

const log = computed(() => {
  const tm = current.value;
  if (!tm) return '';
  const lines = [
    `INFO  org.apache.flink.runtime.taskexecutor.TaskManagerRunner - Starting TaskManager (Version: ${fk.cluster.value.version})`,
    `INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor - Connecting to ResourceManager pekko.tcp://flink@flink-jobmanager.shopflow.internal:6123/user/rpc/resourcemanager_*`,
    `INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor - Successful registration at resource manager, slots: ${tm.slots}`,
  ];
  for (const job of fk.jobs.value) {
    lines.push(`INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor - Received task ${job.name} (${job.jid}), state ${job.state}`);
  }
  return lines.join('\n');
});
</script>

<style scoped src="./fk.css"></style>
<style scoped>
.fk-tm-path { display: block; color: var(--fk-heading); }
.fk-tm-id { display: block; color: var(--fk-text-3); margin-top: 2px; }
.fk-tm-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 16px; }
.fk-tm-summary > div { display: flex; flex-direction: column; gap: 4px; }
.fk-tm-summary span { color: var(--fk-text-3); }
.fk-tm-summary strong { font-size: 20px; font-weight: 500; color: var(--fk-heading); }
.fk-bar { display: inline-block; width: 160px; max-width: 60%; height: 8px; background: #f5f5f5; border-radius: 4px; overflow: hidden; vertical-align: middle; }
.fk-bar > span { display: block; height: 100%; background: var(--fk-primary); }
.fk-bar-label { margin-left: 8px; }
</style>
