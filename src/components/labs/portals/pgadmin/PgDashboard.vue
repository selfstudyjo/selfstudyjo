<template>
  <div class="pg-dash">
    <div v-if="!scope" class="pg-welcome">
      <div class="pg-welcome__hero">
        <PgIcon name="server" :size="48" />
        <div>
          <h2>Welcome</h2>
          <p><strong>pgAdmin 4</strong> - Feature rich | Maximises PostgreSQL | Open Source</p>
          <p class="pg-muted">pgAdmin is an Open Source administration and management tool for the PostgreSQL database.
            It includes a graphical administration interface, an SQL query tool, a procedural code debugger and much more.</p>
        </div>
      </div>
      <h3>Quick Links</h3>
      <div class="pg-welcome__links">
        <button type="button" class="pg-welcome__link" @click="$emit('select-server')">
          <PgIcon name="server" :size="32" /><span>{{ model.server }}</span><small>Open the connected server</small>
        </button>
        <button type="button" class="pg-welcome__link" @click="ctx.openQueryTool()">
          <PgIcon name="query-tool" :size="32" /><span>Query Tool</span><small>on {{ model.database }}</small>
        </button>
      </div>
    </div>

    <template v-else>
      <div class="pg-dash__tabs" role="tablist">
        <button type="button" role="tab" :aria-selected="sub === 'general'" :class="{ 'is-active': sub === 'general' }" @click="sub = 'general'">General</button>
        <button type="button" role="tab" :aria-selected="sub === 'system'" :class="{ 'is-active': sub === 'system' }" @click="sub = 'system'">System Statistics</button>
      </div>
      <template v-if="sub === 'general'">
        <div class="pg-dash__charts">
          <PgChart :title="scope === 'server' ? 'Server sessions' : 'Database sessions'" :series="data.sessions" />
          <PgChart title="Transactions per second" :series="data.tps" />
          <PgChart title="Tuples in" :series="data.tuplesIn" />
          <PgChart title="Tuples out" :series="data.tuplesOut" />
          <PgChart title="Block I/O" :series="data.blockIo" class="pg-dash__wide" />
        </div>
        <section class="pg-dash__activity">
          <header class="pg-dash__acthead">
            <h3>{{ scope === 'server' ? 'Server activity' : 'Database activity' }}</h3>
            <div class="pg-dash__acttabs" role="tablist">
              <button v-for="t in actTabs" :key="t" type="button" role="tab" :aria-selected="act === t"
                      :class="{ 'is-active': act === t }" @click="act = t">{{ t }}</button>
            </div>
            <input v-model="search" class="pg-input pg-dash__search" placeholder="Search" aria-label="Search activity" />
          </header>
          <div class="pg-dash__tablewrap">
            <table class="pg-table">
              <template v-if="act === 'Sessions'">
                <thead><tr><th>PID</th><th>Database</th><th>User</th><th>Application</th><th>Client</th><th>Backend start</th><th>State</th><th>Wait event</th><th>Blocking PIDs</th></tr></thead>
                <tbody>
                  <tr v-for="s in sessions" :key="s.pid"><td class="is-num">{{ s.pid }}</td><td>{{ s.db }}</td><td>{{ s.user }}</td>
                    <td>{{ s.app }}</td><td>{{ s.client }}</td><td>{{ s.start }}</td>
                    <td><span class="pg-state" :class="'is-' + s.state.replace(/\W+/g, '-')">{{ s.state }}</span></td><td>{{ s.wait }}</td><td></td></tr>
                </tbody>
              </template>
              <template v-else-if="act === 'Locks'">
                <thead><tr><th>PID</th><th>Lock type</th><th>Target relation</th><th>Page</th><th>Tuple</th><th>vXID (target)</th><th>Mode</th><th>Granted?</th></tr></thead>
                <tbody>
                  <tr v-for="l in locks" :key="l.pid + l.rel"><td class="is-num">{{ l.pid }}</td><td>{{ l.type }}</td><td>{{ l.rel }}</td><td></td><td></td><td>{{ l.vxid }}</td><td>{{ l.mode }}</td><td>true</td></tr>
                </tbody>
              </template>
              <template v-else-if="act === 'Prepared Transactions'">
                <thead><tr><th>Name</th><th>Database</th><th>Owner</th><th>Prepared at</th></tr></thead>
                <tbody><tr><td colspan="4" class="pg-muted">No rows found</td></tr></tbody>
              </template>
              <template v-else>
                <thead><tr><th>Name</th><th>Category</th><th>Setting</th><th>Unit</th><th>Description</th></tr></thead>
                <tbody>
                  <tr v-for="c in config" :key="c[0]"><td class="pg-mono">{{ c[0] }}</td><td>{{ c[1] }}</td><td>{{ c[2] }}</td><td>{{ c[3] }}</td><td>{{ c[4] }}</td></tr>
                </tbody>
              </template>
            </table>
          </div>
        </section>
      </template>
      <div v-else class="pg-dash__system">
        <div class="pg-dash__kpis">
          <div class="pg-kpi"><span>Total sessions</span><strong>{{ data.totals.sessions }}</strong></div>
          <div class="pg-kpi"><span>Active sessions</span><strong>{{ data.totals.active }}</strong></div>
          <div class="pg-kpi"><span>Commits</span><strong>{{ data.totals.commits.toLocaleString('en-US') }}</strong></div>
          <div class="pg-kpi"><span>Block reads</span><strong>{{ data.totals.reads.toLocaleString('en-US') }}</strong></div>
          <div class="pg-kpi"><span>Buffer hit ratio</span><strong>{{ hitRatio }}%</strong></div>
          <div class="pg-kpi"><span>WAL position (LSN)</span><strong>0/{{ (0x1a2b3c0 + model.cdc.lsn * 0x128).toString(16).toUpperCase() }}</strong></div>
        </div>
        <p class="pg-muted pg-dash__note">System statistics need the <code>system_stats</code> extension on the server; these
          figures are modelled from the database's own activity (every statement the engine ran, replication slots and the WAL position).</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * The Dashboard tab: pgAdmin's five streaming graphs and the activity table.
 *
 * MODELLED, and said so: the graphs follow the statements the engine actually
 * ran (`source.queries`) over a deterministic baseline, the sessions table is
 * this pgAdmin connection plus the application's and Debezium's, and the
 * configuration is PostgreSQL 16's defaults with `wal_level = logical`.
 */
import { computed, inject, ref } from 'vue';
import PgIcon from './PgIcon.vue';
import PgChart from './PgChart.vue';
import { PG } from './pgContext';
import { dashboardData } from './pg';

const props = defineProps<{ scope: '' | 'server' | 'database' }>();
defineEmits<{ (event: 'select-server'): void }>();
const ctx = inject(PG)!;
const model = ctx.model;

const sub = ref<'general' | 'system'>('general');
const act = ref('Sessions');
const search = ref('');
const actTabs = computed(() => (props.scope === 'server'
  ? ['Sessions', 'Locks', 'Prepared Transactions', 'Configuration'] : ['Sessions', 'Locks', 'Prepared Transactions']));

const data = computed(() => dashboardData(model.value));
const hitRatio = computed(() => {
  const t = data.value.totals;
  return ((t.hits / (t.hits + t.reads)) * 100).toFixed(2);
});

const sessions = computed(() => {
  const db = model.value.database;
  const list = [
    { pid: 4412, db, user: 'postgres', app: 'pgAdmin 4 - DB:' + db, client: '10.0.4.21', start: '2026-11-02 06:00:12+00', state: 'active', wait: '' },
    { pid: 4418, db, user: 'postgres', app: 'pgAdmin 4 - CONN:5521377', client: '10.0.4.21', start: '2026-11-02 06:00:14+00', state: 'idle', wait: 'Client: ClientRead' },
    { pid: 3120, db, user: 'shop_app', app: 'shopflow-api', client: '10.0.2.11', start: '2026-11-01 22:14:03+00', state: 'idle', wait: 'Client: ClientRead' },
    { pid: 3121, db, user: 'shop_app', app: 'shopflow-api', client: '10.0.2.12', start: '2026-11-01 22:14:03+00', state: 'idle in transaction', wait: 'Client: ClientRead' },
    { pid: 3122, db, user: 'shop_app', app: 'shopflow-worker', client: '10.0.2.15', start: '2026-11-01 22:14:05+00', state: 'idle', wait: 'Client: ClientRead' },
  ];
  model.value.cdc.slots.forEach((slot, i) => {
    list.push({ pid: 5200 + i, db, user: 'debezium', app: String(slot.name || 'debezium'), client: '10.0.6.30',
      start: '2026-11-02 06:00:30+00', state: slot.active ? 'active' : 'idle', wait: slot.active ? 'Activity: WalSenderMain' : '' });
  });
  const needle = search.value.trim().toLowerCase();
  return list.filter(s => !needle || Object.values(s).some(v => String(v).toLowerCase().includes(needle)));
});

const locks = computed(() => [
  { pid: 4412, type: 'relation', rel: 'pg_locks', vxid: '4/112', mode: 'AccessShareLock' },
  { pid: 4412, type: 'virtualxid', rel: '', vxid: '4/112', mode: 'ExclusiveLock' },
  { pid: 3121, type: 'relation', rel: 'orders', vxid: '7/2051', mode: 'RowExclusiveLock' },
]);

const config = [
  ['max_connections', 'Connections and Authentication / Connection Settings', '100', '', 'Sets the maximum number of concurrent connections.'],
  ['shared_buffers', 'Resource Usage / Memory', '16384', '8kB', 'Sets the number of shared memory buffers used by the server.'],
  ['work_mem', 'Resource Usage / Memory', '4096', 'kB', 'Sets the maximum memory to be used for query workspaces.'],
  ['maintenance_work_mem', 'Resource Usage / Memory', '65536', 'kB', 'Sets the maximum memory to be used for maintenance operations.'],
  ['effective_cache_size', 'Query Tuning / Planner Cost Constants', '524288', '8kB', "Sets the planner's assumption about the total size of the data caches."],
  ['random_page_cost', 'Query Tuning / Planner Cost Constants', '4', '', "Sets the planner's estimate of the cost of a nonsequentially fetched disk page."],
  ['seq_page_cost', 'Query Tuning / Planner Cost Constants', '1', '', "Sets the planner's estimate of the cost of a sequentially fetched disk page."],
  ['wal_level', 'Write-Ahead Log / Settings', 'logical', '', 'Sets the level of information written to the WAL.'],
  ['max_replication_slots', 'Replication / Sending Servers', '10', '', 'Sets the maximum number of simultaneously defined replication slots.'],
  ['max_wal_senders', 'Replication / Sending Servers', '10', '', 'Sets the maximum number of simultaneously running WAL sender processes.'],
  ['autovacuum', 'Autovacuum', 'on', '', 'Starts the autovacuum subprocess.'],
  ['autovacuum_vacuum_scale_factor', 'Autovacuum', '0.2', '', 'Number of tuple updates or deletes prior to vacuum as a fraction of reltuples.'],
  ['default_statistics_target', 'Query Tuning / Other Planner Options', '100', '', 'Sets the default statistics target.'],
  ['log_min_duration_statement', 'Reporting and Logging / When to Log', '-1', 'ms', 'Sets the minimum execution time above which all statements will be logged.'],
  ['server_version', 'Preset Options', '16.4', '', 'Shows the server version.'],
];
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-dash { padding: 12px; display: flex; flex-direction: column; gap: 12px; min-height: 0; overflow: auto; flex: 1; }
.pg-dash__tabs { display: flex; gap: 0; border-bottom: 1px solid var(--pg-border); }
.pg-dash__tabs button, .pg-dash__acttabs button {
  border: 0; background: none; padding: 7px 14px; font: inherit; font-size: 13px; color: var(--pg-muted); cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.pg-dash__tabs button.is-active, .pg-dash__acttabs button.is-active { color: var(--pg-primary); border-bottom-color: var(--pg-primary); font-weight: 600; }
.pg-dash__charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.pg-dash__activity { border: 1px solid var(--pg-border); border-radius: var(--pg-radius); background: #fff; min-width: 0; }
.pg-dash__acthead { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 4px 10px; border-bottom: 1px solid var(--pg-border); background: var(--pg-grey-200); }
.pg-dash__acthead h3 { margin: 0; font-size: 13px; font-weight: 600; }
.pg-dash__acttabs { display: flex; flex-wrap: wrap; }
.pg-dash__search { margin-left: auto; width: 180px; height: 26px; }
.pg-dash__tablewrap { overflow: auto; max-height: 260px; }
.pg-state { padding: 1px 6px; border-radius: 8px; font-size: 11.5px; background: var(--pg-grey-400); }
.pg-state.is-active { background: #d9ecda; color: #1b5e20; }
.pg-state.is-idle-in-transaction { background: #fce5c5; color: #8a4b00; }
.pg-dash__system { display: flex; flex-direction: column; gap: 12px; }
.pg-dash__kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.pg-kpi { border: 1px solid var(--pg-border); border-radius: var(--pg-radius); padding: 12px; display: flex; flex-direction: column; gap: 6px; background: #fff; }
.pg-kpi span { color: var(--pg-muted); font-size: 12px; }
.pg-kpi strong { font-size: 22px; font-weight: 500; color: var(--pg-primary); overflow-wrap: anywhere; }
.pg-dash__note { margin: 0; font-size: 12px; }
.pg-welcome { display: flex; flex-direction: column; gap: 12px; }
.pg-welcome__hero { display: flex; gap: 16px; align-items: flex-start; padding: 16px; border: 1px solid var(--pg-border); border-radius: var(--pg-radius); background: linear-gradient(90deg, #f3f7fb, #fff); }
.pg-welcome__hero h2 { margin: 0 0 6px; font-size: 22px; font-weight: 500; color: var(--pg-primary); }
.pg-welcome__hero p { margin: 0 0 4px; }
.pg-welcome h3 { margin: 4px 0 0; font-size: 14px; }
.pg-welcome__links { display: flex; gap: 12px; flex-wrap: wrap; }
.pg-welcome__link {
  display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 10px; align-items: center; text-align: left;
  border: 1px solid var(--pg-border); border-radius: var(--pg-radius); background: #fff; padding: 12px 16px; cursor: pointer; font: inherit; color: var(--pg-text); min-width: 220px;
}
.pg-welcome__link .pg-ico { grid-row: span 2; }
.pg-welcome__link span { font-weight: 600; }
.pg-welcome__link small { color: var(--pg-muted); }
.pg-welcome__link:hover { border-color: var(--pg-primary); background: var(--pg-grey-200); }
@container sl-portal (max-width: 860px) {
  .pg-dash__charts { grid-template-columns: minmax(0, 1fr); }
  .pg-dash__kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.pg-dash__wide { grid-column: 1 / -1; }
</style>
