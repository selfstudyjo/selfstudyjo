<template>
  <div class="af-page">
    <!-- ===== Security: List Users / List Roles ===== -->
    <template v-if="page === 'security'">
      <div class="af-panel">
        <div class="af-panel__head"><h3 class="af-panel__title">{{ sub === 'users' ? 'List Users' : 'List Roles' }}</h3></div>
        <div class="af-panel__body">
          <div class="af-alert af-alert--info"><div class="af-alert__body">User management (<code>airflow users create</code>, roles and permissions)
            is not modelled in this lab - everyone works as <b>admin</b>. The lists below are what a fresh deployment shows.</div></div>
          <div class="af-table-wrap">
            <table v-if="sub === 'users'" class="af-table af-table--bordered af-table--striped">
              <thead><tr><th>First Name</th><th>Last Name</th><th>User Name</th><th>Email</th><th>Is Active?</th><th>Role</th></tr></thead>
              <tbody><tr><td>Admin</td><td>User</td><td>admin</td><td>admin@shopflow.example</td><td>True</td><td>[Admin]</td></tr></tbody>
            </table>
            <table v-else class="af-table af-table--bordered af-table--striped">
              <thead><tr><th>Name</th><th>Permissions</th></tr></thead>
              <tbody><tr v-for="r in ROLES" :key="r.name"><td>{{ r.name }}</td><td class="af-small">{{ r.perms }}</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== Browse: SLA Misses ===== -->
    <div v-else-if="page === 'sla'" class="af-panel">
      <div class="af-panel__head"><h3 class="af-panel__title">List Sla Miss</h3></div>
      <div class="af-panel__body">
        <div class="af-table-wrap">
          <table class="af-table af-table--bordered af-table--striped">
            <thead><tr><th>Dag Id</th><th>Task Id</th><th>Logical Date</th><th>Email Sent</th><th>Notification Sent</th><th>Timestamp</th></tr></thead>
            <tbody>
              <tr v-for="(s, i) in af.slaMisses.value" :key="i">
                <td><button type="button" class="af-link" @click="af.go({ page: 'dag', dagId: String(s.dag_id), tab: 'details' })">{{ s.dag_id }}</button></td>
                <td class="af-mono">{{ s.task_id }}</td>
                <td class="af-nowrap">{{ fmtDate(s.logical_date || s.execution_date) }}</td>
                <td>{{ s.email_sent ? 'True' : 'False' }}</td>
                <td>{{ s.notification_sent ? 'True' : 'False' }}</td>
                <td class="af-nowrap">{{ fmtDate(s.timestamp || s.at) }}</td>
              </tr>
              <tr v-if="!af.slaMisses.value.length"><td colspan="6" class="af-empty-cell">No records found</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="af-panel__foot">Record Count: {{ af.slaMisses.value.length }}</div>
    </div>

    <!-- ===== Browse: Audit Logs ===== -->
    <div v-else-if="page === 'audit'" class="af-panel">
      <div class="af-panel__head"><h3 class="af-panel__title">List Log</h3></div>
      <div class="af-panel__body">
        <div class="af-table-wrap">
          <table class="af-table af-table--bordered af-table--striped">
            <thead><tr><th>Dttm</th><th>Dag Id</th><th>Task Id</th><th>Event</th><th>Owner</th><th>Extra</th></tr></thead>
            <tbody>
              <tr v-for="(e, i) in audit" :key="i">
                <td class="af-nowrap">{{ e.dttm }}</td><td>{{ e.dag_id }}</td><td>{{ e.task_id }}</td>
                <td>{{ e.event }}</td><td>{{ e.owner }}</td><td class="af-mono af-info__extra">{{ e.extra }}</td>
              </tr>
              <tr v-if="!audit.length"><td colspan="6" class="af-empty-cell">No records found</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="af-panel__foot">Record Count: {{ audit.length }}<template v-if="!viewAudit.length"> - events from this session's CLI commands</template></div>
    </div>

    <!-- ===== Admin: Configurations ===== -->
    <template v-else-if="page === 'config'">
      <h2 class="af-h2">Airflow Configuration</h2>
      <template v-if="configEntries.length">
        <table class="af-table af-table--bordered af-table--striped">
          <thead><tr><th>Section</th><th>Key</th><th>Value</th><th>Source</th></tr></thead>
          <tbody><tr v-for="(c, i) in configEntries" :key="i"><td>{{ c.section }}</td><td class="af-mono">{{ c.key }}</td><td class="af-mono">{{ c.value }}</td><td>{{ c.source }}</td></tr></tbody>
        </table>
      </template>
      <template v-else>
        <pre class="af-code af-code--wrap"># Your Airflow administrator chose not to expose the configuration, most likely for security reasons.</pre>
        <h3 class="af-h3">Running Configuration</h3>
        <table class="af-table af-table--bordered af-table--striped">
          <thead><tr><th>Section</th><th>Key</th><th>Value</th><th>Source</th></tr></thead>
          <tbody>
            <tr><td>core</td><td class="af-mono">executor</td><td class="af-mono">{{ af.executor.value }}</td><td>env var</td></tr>
            <tr><td>core</td><td class="af-mono">dags_folder</td><td class="af-mono">/opt/airflow/dags</td><td>airflow.cfg</td></tr>
            <tr><td>core</td><td class="af-mono">parallelism</td><td class="af-mono">32</td><td>default</td></tr>
            <tr><td>core</td><td class="af-mono">default_timezone</td><td class="af-mono">utc</td><td>default</td></tr>
            <tr><td>webserver</td><td class="af-mono">expose_config</td><td class="af-mono">non-sensitive-only</td><td>env var</td></tr>
          </tbody>
        </table>
      </template>
    </template>

    <!-- ===== Admin: XComs ===== -->
    <div v-else-if="page === 'xcoms'" class="af-panel">
      <div class="af-panel__head"><h3 class="af-panel__title">List XComs</h3></div>
      <div class="af-panel__body">
        <div class="af-xcf"><input v-model="xq" class="af-input" type="search" placeholder="Search Key, Dag Id, Task Id" aria-label="Search XComs" /></div>
        <div class="af-table-wrap">
          <table class="af-table af-table--bordered af-table--striped">
            <thead><tr><th>Key</th><th>Value</th><th>Dag Id</th><th>Task Id</th><th>Run Id</th><th>Map Index</th></tr></thead>
            <tbody>
              <tr v-for="(x, i) in xcoms" :key="i">
                <td class="af-mono">{{ x.key }}</td>
                <td class="af-mono af-info__extra">{{ typeof x.value === 'string' ? x.value : JSON.stringify(x.value) }}</td>
                <td><button type="button" class="af-link" @click="af.go({ page: 'dag', dagId: x.dag_id, tab: 'xcom', runId: x.run_id, taskId: x.task_id })">{{ x.dag_id }}</button></td>
                <td class="af-mono">{{ x.task_id }}</td><td class="af-mono">{{ x.run_id }}</td><td>{{ x.map_index ?? -1 }}</td>
              </tr>
              <tr v-if="!xcoms.length"><td colspan="6" class="af-empty-cell">No records found</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="af-panel__foot">Record Count: {{ xcoms.length }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches } from '@/utils/portalKit';
import { useAf } from './afContext';
import { fmtDate } from './airflow';

const af = useAf();
const page = computed(() => af.route.value.page);
const sub = computed(() => (af.route.value.page === 'security' ? af.route.value.sub : 'users'));
const xq = ref('');

const ROLES = [
  { name: 'Admin', perms: 'all permissions, including Security and Admin menus' },
  { name: 'Op', perms: 'User permissions + Admin menu (Connections, Pools, Variables, XComs, Configurations)' },
  { name: 'User', perms: 'Viewer permissions + edit DAGs, trigger, clear and mark task instances' },
  { name: 'Viewer', perms: 'read-only access to DAGs, runs, task instances and logs' },
  { name: 'Public', perms: 'no permissions' },
];

const viewAudit = computed(() => {
  const list = af.airflowView.value?.audit_log || af.airflowView.value?.audit || af.airflowView.value?.events;
  return Array.isArray(list) ? list.filter(e => e && typeof e === 'object') : [];
});
const audit = computed(() => {
  if (viewAudit.value.length) {
    return [...viewAudit.value].reverse().map((e: any) => ({
      dttm: fmtDate(e.dttm || e.at || e.when), dag_id: e.dag_id || '', task_id: e.task_id || '', event: e.event || '',
      owner: e.owner || 'admin', extra: typeof e.extra === 'string' ? e.extra : e.extra ? JSON.stringify(e.extra) : '',
    }));
  }
  return af.history.value.map(h => {
    const words = h.command.split(/\s+/);
    return { dttm: new Date(h.at).toISOString().replace('T', ', ').slice(0, 20) + ' UTC', dag_id: words[3] && !words[3].startsWith('-') ? words[3].replace(/^'|'$/g, '') : '',
      task_id: words[1] === 'tasks' && words[4] ? words[4] : '', event: `cli_${words[1] || ''}_${words[2] || ''}`.replace(/-/g, '_'),
      owner: 'admin', extra: h.ok ? h.command : `${h.command}  (failed)` };
  });
});

const configEntries = computed(() => {
  const cfg = af.airflowView.value?.config;
  if (!cfg || typeof cfg !== 'object') return [];
  const out: { section: string; key: string; value: string; source: string }[] = [];
  for (const [section, entries] of Object.entries(cfg as Record<string, any>)) {
    if (entries && typeof entries === 'object') {
      for (const [key, value] of Object.entries(entries)) out.push({ section, key, value: String(value), source: 'airflow.cfg' });
    }
  }
  return out;
});

const xcoms = computed(() => [...af.xcom.value].reverse().filter(x => matches(x, xq.value, ['key', 'dag_id', 'task_id'])));
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-info__extra { max-width: 420px; overflow-wrap: anywhere; white-space: pre-wrap; }
.af-xcf { max-width: 360px; }
.af-xcf .af-input { height: 30px; font-size: 13px; }
</style>
