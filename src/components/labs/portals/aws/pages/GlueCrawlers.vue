<template>
  <div v-if="creating">
    <CsHeader title="Create crawler" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Crawler properties" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="cr-name">Name</label>
          <input id="cr-name" v-model.trim="form.name" class="cs-input" :class="{ 'is-invalid': tried && !form.name }" /></div>
        <div class="cs-field"><label class="cs-label" for="cr-path">Data source - S3 path</label>
          <input id="cr-path" v-model.trim="form.path" class="cs-input cs-mono" placeholder="s3://bucket/prefix/" />
          <span class="cs-constraint">Every folder below the path becomes a table; key=value folders become partitions.</span></div>
        <div class="cs-field"><label class="cs-label" for="cr-role">IAM role</label>
          <select id="cr-role" v-model="form.role" class="cs-select">
            <option value="">Choose an IAM role</option>
            <option v-for="r in roles" :key="r.name" :value="r.name">{{ r.name }}</option></select>
          <span class="cs-constraint">The role must trust glue.amazonaws.com and be able to read the path.</span></div>
        <div class="cs-field"><label class="cs-label" for="cr-db">Target database</label>
          <select id="cr-db" v-model="form.db" class="cs-select">
            <option value="">Choose a database</option>
            <option v-for="d in databases" :key="d.name" :value="d.name">{{ d.name }}</option></select></div>
        <div class="cs-field"><label class="cs-label" for="cr-prefix">Table name prefix <small>- optional</small></label>
          <input id="cr-prefix" v-model.trim="form.prefix" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label" for="cr-sched">Crawler schedule</label>
          <select id="cr-sched" v-model="form.schedule" class="cs-select">
            <option value="">On demand</option><option value="cron(15 2 * * ? *)">Daily at 02:15 UTC</option>
            <option value="cron(0 * * * ? *)">Hourly</option></select></div>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('glue', 'crawlers')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Create crawler</button>
    </div>
  </div>
  <div v-else>
    <CsTable v-model:selected="selected" title="Crawlers" variant="full-page" :items="crawlers" :columns="columns" track-by="name"
             selection-type="single" filter-placeholder="Filter crawlers" empty-title="No crawlers"
             empty-text="A crawler connects to a data store, infers a schema and creates tables in the Data Catalog."
             description="A crawler connects to a data store, progresses through a prioritized list of classifiers to determine the schema for your data, and then creates metadata tables in the Data Catalog.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!current || busy" @click="run">Run</button>
        <CsDropdown :items="[{ id: 'delete', text: 'Delete crawler' }]" :disabled="!current" @select="deleting = true" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('glue', 'crawlers', { create: '1' })">Create crawler</button>
      </template>
      <template #cell-state="{ row }"><CsStatus :state="row.state === 'READY' ? 'available' : 'pending'" :label="row.state === 'READY' ? 'Ready' : 'Running'" /></template>
      <template #cell-last="{ row }">
        <CsStatus v-if="row.last_status" :state="row.last_status === 'SUCCEEDED' ? 'success' : 'failed'" :label="row.last_status === 'SUCCEEDED' ? 'Succeeded' : 'Failed'" />
        <span v-else>-</span></template>
    </CsTable>
    <section v-if="current && current.runs" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Last run: ${current.name}`" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Status</dt><dd>{{ current.last_status }}</dd></div>
        <div><dt>Tables created</dt><dd>{{ current.tables_created }}</dd></div>
        <div><dt>Tables updated</dt><dd>{{ current.tables_updated }}</dd></div>
        <div><dt>Partitions added</dt><dd>{{ current.partitions_added }}</dd></div>
        <div v-if="current.last_error"><dt>Error</dt><dd>{{ current.last_error }}</dd></div>
      </dl></div>
    </section>
    <CsDelete v-if="deleting && current" :title="`Delete ${current.name}?`" action="Delete" :busy="busy"
              warning="Tables the crawler created stay in the Data Catalog." @close="deleting = false" @confirm="remove" />
  </div>
</template>

<script setup lang="ts">
/** AWS Glue crawlers: create, run (with what the last crawl did), delete. */
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, useAws } from '../ctx';

const ctx = useAws();
const creating = computed(() => (ctx.route.value.params || {}).create === '1');
const crawlers = computed(() => rows(ctx.view.value, 'glue.crawlers'));
const roles = computed(() => rows(ctx.view.value, 'iam.roles'));
const databases = computed(() => rows(ctx.view.value, 'glue.databases'));
const selected = ref<string[]>([]);
const current = computed(() => crawlers.value.find(c => c.name === selected.value[0]) || null);
const busy = ref(false);
const tried = ref(false);
const deleting = ref(false);
const form = reactive({ name: '', path: 's3://shopflow-lake/bronze/', role: '', db: '', prefix: '', schedule: '' });

const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'state', header: 'State' },
  { id: 'schedule', header: 'Schedule', cell: r => r.schedule || '-' },
  { id: 'last', header: 'Last run' },
  { id: 'last_run', header: 'Last run timestamp', cell: r => (r.runs ? awsDate(r.last_run) : '-') },
  { id: 'database', header: 'Database' },
  { id: 'tables', header: 'Table changes', cell: r => (r.runs ? `${r.tables_created} created, ${r.tables_updated} updated` : '-') },
];

async function create() {
  tried.value = true;
  if (!form.name || !form.role || !form.db || !form.path) {
    ctx.api.notify('error', 'Name, S3 path, IAM role and target database are required.');
    return;
  }
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'glue', 'create-crawler'], {
    '--name': form.name, '--role': form.role, '--database-name': form.db,
    '--targets': JSON.stringify({ S3Targets: [{ Path: form.path }] }),
    '--table-prefix': form.prefix, '--schedule': form.schedule,
  }), `Crawler ${form.name} created.`);
  busy.value = false;
  if (result.ok) { selected.value = [form.name]; ctx.to('glue', 'crawlers'); }
}
async function run() {
  busy.value = true;
  await ctx.run(cli(['aws', 'glue', 'start-crawler'], { '--name': current.value!.name }),
    `Crawler "${current.value!.name}" completed.`);
  busy.value = false;
}
async function remove() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'glue', 'delete-crawler'], { '--name': current.value!.name }), 'Crawler deleted.');
  busy.value = false;
  if (result.ok) { deleting.value = false; selected.value = []; }
}
</script>
