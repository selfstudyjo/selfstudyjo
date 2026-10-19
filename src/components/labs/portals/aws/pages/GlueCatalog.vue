<template>
  <!-- Table detail -->
  <div v-if="page === 'table'">
    <template v-if="table">
      <CsHeader :title="table.name">
        <template #actions>
          <button type="button" class="cs-btn" @click="ctx.to('athena', 'editor', { db: table.database, table: table.name })">Query with Athena</button>
          <button type="button" class="cs-btn" @click="deleting = true">Delete</button>
        </template>
      </CsHeader>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Table overview" :level="2" :info="false" /></div>
        <div class="cs-container__body"><dl class="cs-kv">
          <div><dt>Name</dt><dd>{{ table.name }}</dd></div>
          <div><dt>Database</dt><dd>{{ table.database }}</dd></div>
          <div><dt>Location</dt><dd class="cs-mono">{{ table.location }}</dd></div>
          <div><dt>Classification</dt><dd>{{ table.format }}</dd></div>
          <div><dt>Last updated</dt><dd>{{ awsDate(table.updated) }}</dd></div>
          <div><dt>Lake Formation</dt><dd>{{ table.lf_registered ? (table.iam_allowed ? 'Registered - IAM access control still applies' : 'Registered - Lake Formation permissions enforced') : 'Location not registered' }}</dd></div>
        </dl></div>
      </section>
      <div class="cs-tabs" role="tablist">
        <button v-for="t in ['Schema', 'Partitions', 'Table properties']" :key="t" type="button" class="cs-tab" role="tab"
                :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
      </div>
      <section v-if="tab === 'Schema'" class="cs-container">
        <div class="cs-container__head"><CsHeader :title="`Schema (${table.columns.length + table.partition_keys.length})`" :level="2" :info="false" /></div>
        <div class="cs-container__body"><table class="cs-table-mini">
          <thead><tr><th>#</th><th>Column name</th><th>Data type</th><th>Partition key</th></tr></thead>
          <tbody>
            <tr v-for="(c, i) in table.columns" :key="c.name"><td>{{ i + 1 }}</td><td>{{ c.name }}</td><td>{{ c.type }}</td><td>-</td></tr>
            <tr v-for="(k, i) in table.partition_keys" :key="k"><td>{{ table.columns.length + i + 1 }}</td><td>{{ k }}</td><td>string</td><td>Partition ({{ i }})</td></tr>
          </tbody></table></div>
      </section>
      <section v-else-if="tab === 'Partitions'" class="cs-container">
        <div class="cs-container__head"><CsHeader :title="`Partitions (${partitions.length})`" :level="2" :info="false" /></div>
        <div class="cs-container__body">
          <table v-if="partitions.length" class="cs-table-mini"><thead><tr><th>{{ table.partition_keys.join(' / ') }}</th><th>Location</th></tr></thead>
            <tbody><tr v-for="p in partitions" :key="p.values"><td>{{ p.values }}</td><td class="cs-mono">{{ p.location }}</td></tr></tbody></table>
          <div v-else class="cs-empty"><strong>No partitions</strong>This table is not partitioned, or no partitions are registered yet.</div>
        </div>
      </section>
      <section v-else class="cs-container">
        <div class="cs-container__head"><CsHeader title="Table properties" :level="2" :info="false" /></div>
        <div class="cs-container__body"><table class="cs-table-mini"><thead><tr><th>Key</th><th>Value</th></tr></thead>
          <tbody><tr v-for="(v, k) in table.params" :key="k"><td>{{ k }}</td><td>{{ v }}</td></tr></tbody></table></div>
      </section>
      <CsDelete v-if="deleting" :title="`Delete table ${table.name}?`" action="Delete" :busy="busy"
                warning="Deleting a table removes it from the Data Catalog. The data in Amazon S3 is not deleted."
                @close="deleting = false" @confirm="removeTable" />
    </template>
    <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" /><div>The table no longer exists.</div></div>
  </div>

  <!-- Tables -->
  <div v-else-if="page === 'tables'">
    <CsTable title="Tables" variant="full-page" :items="tables" :columns="tableColumns" track-by="key"
             filter-placeholder="Filter tables" empty-title="No tables" empty-text="Run a crawler or create a table to add one."
             description="A table is the metadata definition that represents your data, including its schema.">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('glue', 'crawlers')">Add tables using crawler</button></template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('glue', 'table', { db: row.database, name: row.name })">{{ row.name }}</a></template>
    </CsTable>
  </div>

  <!-- Connections -->
  <div v-else-if="page === 'connections'">
    <CsTable v-model:selected="selConn" title="Connections" variant="full-page" :items="connections" :columns="connColumns" track-by="name"
             selection-type="single" empty-title="No connections" empty-text="A NETWORK connection places a job in a VPC subnet.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!selConn.length" @click="deleteConnection">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="connOpen = true">Create connection</button>
      </template>
    </CsTable>
    <CsModal v-if="connOpen" title="Create connection" @close="connOpen = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="gc-name">Name</label><input id="gc-name" v-model.trim="conn.name" class="cs-input" /></div>
        <div class="cs-field"><span class="cs-label">Connection type</span><input class="cs-input" value="Network" disabled /></div>
        <div class="cs-field"><label class="cs-label" for="gc-subnet">Subnet</label>
          <select id="gc-subnet" v-model="conn.subnet" class="cs-select">
            <option v-for="s in subnets" :key="s.id" :value="s.id">{{ s.id }} {{ s.name ? '(' + s.name + ')' : '' }} - {{ s.az }}</option></select></div>
        <div class="cs-field"><label class="cs-label" for="gc-sg">Security group</label>
          <select id="gc-sg" v-model="conn.sg" class="cs-select">
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.id }} ({{ g.name }})</option></select></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="connOpen = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!conn.name || !conn.subnet || !conn.sg || busy" @click="createConnection">Create connection</button>
      </template>
    </CsModal>
  </div>

  <!-- Databases -->
  <div v-else>
    <CsTable v-model:selected="selDb" title="Databases" variant="full-page" :items="databases" :columns="dbColumns" track-by="name"
             selection-type="single" empty-title="No databases" empty-text="A database is a container for tables in the Data Catalog."
             description="A database is a set of associated table definitions, organized into a logical group.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!selDb.length" @click="dbDeleting = true">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="dbOpen = true">Add database</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('glue', 'tables')">{{ row.name }}</a></template>
    </CsTable>
    <CsModal v-if="dbOpen" title="Create a database" @close="dbOpen = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="gd-name">Name</label>
          <input id="gd-name" v-model.trim="dbName" class="cs-input" placeholder="shopflow_bronze" />
          <span class="cs-constraint">Lowercase letters, numbers and underscores.</span></div>
        <div class="cs-field"><label class="cs-label" for="gd-desc">Description <small>- optional</small></label>
          <input id="gd-desc" v-model="dbDesc" class="cs-input" /></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="dbOpen = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!/^[a-z0-9_]+$/.test(dbName) || busy" @click="createDb">Create database</button>
      </template>
    </CsModal>
    <CsDelete v-if="dbDeleting" :title="`Delete ${selDb[0]}?`" action="Delete" :busy="busy"
              warning="Deleting a database also deletes all the tables in it from the Data Catalog."
              @close="dbDeleting = false" @confirm="deleteDb" />
  </div>
</template>

<script setup lang="ts">
/** AWS Glue Data Catalog: databases, tables (schema, partitions, properties), connections. */
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, useAws } from '../ctx';

const ctx = useAws();
const page = computed(() => ctx.route.value.page);
const params = computed(() => ctx.route.value.params || {});
const databases = computed(() => rows(ctx.view.value, 'glue.databases'));
const tables = computed(() => rows(ctx.view.value, 'glue.tables').map(t => ({ ...t, key: `${t.database}.${t.name}` })));
const table = computed(() => tables.value.find(t => t.database === params.value.db && t.name === params.value.name) || null);
const partitions = computed(() => rows(ctx.view.value, 'glue.partitions')
  .filter(p => table.value && p.database === table.value.database && p.table === table.value.name));
const connections = computed(() => rows(ctx.view.value, 'glue.connections'));
const subnets = computed(() => rows(ctx.view.value, 'ec2.subnets'));
const groups = computed(() => rows(ctx.view.value, 'ec2.security_groups'));
const busy = ref(false);
const tab = ref('Schema');
const deleting = ref(false);
const selDb = ref<string[]>([]);
const selConn = ref<string[]>([]);
const dbOpen = ref(false);
const dbDeleting = ref(false);
const dbName = ref('');
const dbDesc = ref('');
const connOpen = ref(false);
const conn = reactive({ name: 'shopflow-private', subnet: '', sg: '' });

const dbColumns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'description', header: 'Description' },
  { id: 'tables', header: 'Tables', sortKey: 'tables' },
  { id: 'created', header: 'Created on (UTC)', cell: r => awsDate(r.created) },
];
const tableColumns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'database', header: 'Database', sortKey: 'database' },
  { id: 'location', header: 'Location' },
  { id: 'format', header: 'Classification' },
  { id: 'partitions', header: 'Partitions', cell: r => (r.partition_keys.length ? `${r.partitions} (${r.partition_keys.join(', ')})` : '-') },
  { id: 'updated', header: 'Last updated', cell: r => awsDate(r.updated) },
];
const connColumns: Column[] = [
  { id: 'name', header: 'Name' }, { id: 'type', header: 'Type' },
  { id: 'subnet', header: 'Subnet' }, { id: 'sgs', header: 'Security groups', cell: r => (r.sgs || []).join(', ') },
];

async function createDb() {
  busy.value = true;
  const input = JSON.stringify(dbDesc.value ? { Name: dbName.value, Description: dbDesc.value } : { Name: dbName.value });
  const result = await ctx.run(cli(['aws', 'glue', 'create-database'], { '--database-input': input }), `Database ${dbName.value} created.`);
  busy.value = false;
  if (result.ok) { dbOpen.value = false; dbName.value = ''; dbDesc.value = ''; }
}
async function deleteDb() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'glue', 'delete-database'], { '--name': selDb.value[0] }), `Database ${selDb.value[0]} deleted.`);
  busy.value = false;
  if (result.ok) { dbDeleting.value = false; selDb.value = []; }
}
async function removeTable() {
  busy.value = true;
  const t = table.value!;
  const result = await ctx.run(cli(['aws', 'glue', 'delete-table'], { '--database-name': t.database, '--name': t.name }), `Table ${t.name} deleted.`);
  busy.value = false;
  if (result.ok) { deleting.value = false; ctx.to('glue', 'tables'); }
}
async function createConnection() {
  busy.value = true;
  const subnet = subnets.value.find(s => s.id === conn.subnet);
  const input = JSON.stringify({ Name: conn.name, ConnectionType: 'NETWORK', PhysicalConnectionRequirements: {
    SubnetId: conn.subnet, SecurityGroupIdList: [conn.sg], AvailabilityZone: subnet ? subnet.az : '' } });
  const result = await ctx.run(cli(['aws', 'glue', 'create-connection'], { '--connection-input': input }), `Connection ${conn.name} created.`);
  busy.value = false;
  if (result.ok) connOpen.value = false;
}
async function deleteConnection() {
  await ctx.run(cli(['aws', 'glue', 'delete-connection'], { '--connection-name': selConn.value[0] }), `Connection ${selConn.value[0]} deleted.`);
  selConn.value = [];
}
</script>
