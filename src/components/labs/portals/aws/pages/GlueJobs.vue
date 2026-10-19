<template>
  <!-- Job detail: runs -->
  <div v-if="page === 'job'">
    <template v-if="job">
      <CsHeader :title="job.name">
        <template #actions>
          <button type="button" class="cs-btn" :disabled="busy" @click="resetBookmark">Reset job bookmark</button>
          <button type="button" class="cs-btn" @click="deleting = true">Delete</button>
          <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="runJob">
            <span v-if="busy" class="cs-btn__spinner" />Run</button>
        </template>
      </CsHeader>
      <div class="cs-tabs" role="tablist">
        <button v-for="t in ['Runs', 'Job details']" :key="t" type="button" class="cs-tab" role="tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
      </div>
      <CsTable v-if="tab === 'Runs'" title="Job runs" :items="runs" :columns="runColumns" track-by="id" empty-title="No runs"
               empty-text="This job has not run yet.">
        <template #cell-state="{ row }"><CsStatus :state="row.state === 'SUCCEEDED' ? 'success' : row.state === 'FAILED' ? 'failed' : 'pending'" :label="row.state" /></template>
        <template #cell-error="{ row }"><span class="gj__err">{{ row.error || '-' }}</span></template>
      </CsTable>
      <template v-else>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Basic properties" :level="2" :info="false" /></div>
          <div class="cs-container__body cs-stack">
            <dl class="cs-kv">
              <div><dt>IAM role</dt><dd class="cs-mono">{{ job.role }}</dd></div>
              <div><dt>Glue version</dt><dd>Glue {{ job.glue_version }}</dd></div>
              <div><dt>Script path</dt><dd class="cs-mono">{{ job.script }}</dd></div>
              <div><dt>Job bookmark</dt><dd>{{ job.bookmark === 'job-bookmark-enable' ? 'Enable' : 'Disable' }}</dd></div>
            </dl>
            <div class="cs-grid-3">
              <div class="cs-field"><label class="cs-label" for="gj-wt">Worker type</label>
                <select id="gj-wt" v-model="edit.worker" class="cs-select"><option v-for="w in WORKERS" :key="w" :value="w">{{ w }}</option></select></div>
              <div class="cs-field"><label class="cs-label" for="gj-nw">Requested number of workers</label>
                <input id="gj-nw" v-model.number="edit.workers" type="number" min="2" class="cs-input" /></div>
              <div class="cs-field"><label class="cs-label" for="gj-cn">Connections</label>
                <select id="gj-cn" v-model="edit.connection" class="cs-select"><option value="">None</option>
                  <option v-for="c in connections" :key="c.name" :value="c.name">{{ c.name }}</option></select></div>
            </div>
            <div class="cs-field"><span class="cs-label">Job parameters</span>
              <table class="cs-table-mini"><tbody><tr v-for="(v, k) in job.arguments" :key="k"><td class="cs-mono">{{ k }}</td><td class="cs-mono">{{ v }}</td></tr></tbody></table></div>
            <div class="cs-form-actions"><button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="save">Save</button></div>
          </div>
        </section>
      </template>
      <CsDelete v-if="deleting" :title="`Delete job ${job.name}?`" word="delete" :busy="busy"
                @close="deleting = false" @confirm="remove" />
    </template>
  </div>

  <!-- Create job -->
  <div v-else-if="creating">
    <CsHeader title="Create job - Script editor" description="This lab's job runs a curation script already in S3: read a catalog table, deduplicate, write partitioned Parquet." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Job details" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-grid-2">
          <div class="cs-field"><label class="cs-label" for="nj-name">Name</label><input id="nj-name" v-model.trim="form.name" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="nj-role">IAM Role</label>
            <select id="nj-role" v-model="form.role" class="cs-select"><option value="">Choose a role</option>
              <option v-for="r in roles" :key="r.name" :value="r.arn">{{ r.name }}</option></select></div>
          <div class="cs-field"><label class="cs-label" for="nj-script">Script path</label><input id="nj-script" v-model.trim="form.script" class="cs-input cs-mono" /></div>
          <div class="cs-field"><label class="cs-label" for="nj-ver">Glue version</label>
            <select id="nj-ver" v-model="form.version" class="cs-select"><option value="4.0">Glue 4.0 - Spark 3.3, Python 3</option><option value="5.0">Glue 5.0 - Spark 3.5, Python 3</option></select></div>
          <div class="cs-field"><label class="cs-label" for="nj-wt">Worker type</label>
            <select id="nj-wt" v-model="form.worker" class="cs-select"><option v-for="w in WORKERS" :key="w" :value="w">{{ w }}</option></select></div>
          <div class="cs-field"><label class="cs-label" for="nj-nw">Requested number of workers</label><input id="nj-nw" v-model.number="form.workers" type="number" min="2" class="cs-input" /></div>
        </div>
        <label class="cs-check"><input v-model="form.bookmark" type="checkbox" /> Job bookmark: Enable <small>Remember which objects were processed so a re-run only reads new data.</small></label>
        <div class="cs-grid-2">
          <div class="cs-field"><label class="cs-label" for="nj-sdb">--source_database</label><input id="nj-sdb" v-model.trim="form.sourceDb" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="nj-st">--source_table</label><input id="nj-st" v-model.trim="form.sourceTable" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="nj-tp">--target_path</label><input id="nj-tp" v-model.trim="form.target" class="cs-input cs-mono" /></div>
          <div class="cs-field"><label class="cs-label" for="nj-pk">--partition_keys</label><input id="nj-pk" v-model.trim="form.partition" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="nj-dk">--dedup_key</label><input id="nj-dk" v-model.trim="form.dedup" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="nj-tdb">--target_database / --target_table</label>
            <div class="cs-row"><input v-model.trim="form.targetDb" class="cs-input gj__half" aria-label="Target database" /><input v-model.trim="form.targetTable" class="cs-input gj__half" aria-label="Target table" /></div></div>
        </div>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('glue', 'jobs')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !form.name || !form.role" @click="create">Save</button>
    </div>
  </div>

  <!-- Jobs list -->
  <div v-else>
    <CsTable v-model:selected="selected" title="Your jobs" variant="full-page" :items="jobs" :columns="jobColumns" track-by="name"
             selection-type="single" empty-title="No jobs" empty-text="Create a job to run an ETL script on AWS Glue.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!selected.length || busy" @click="runSelected">Run job</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('glue', 'jobs', { create: '1' })">Create job</button>
      </template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('glue', 'job', { name: row.name })">{{ row.name }}</a></template>
    </CsTable>
  </div>
</template>

<script setup lang="ts">
/** AWS Glue ETL jobs: create, run, run history (DPU-seconds, network path), bookmarks, edit capacity. */
import { computed, reactive, ref, watch } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsHeader from '../CsHeader.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, bytes, useAws } from '../ctx';

const WORKERS = ['G.025X', 'G.1X', 'G.2X', 'G.4X', 'G.8X'];
const ctx = useAws();
const page = computed(() => ctx.route.value.page);
const params = computed(() => ctx.route.value.params || {});
const creating = computed(() => params.value.create === '1');
const jobs = computed(() => rows(ctx.view.value, 'glue.jobs'));
const job = computed(() => jobs.value.find(j => j.name === params.value.name) || null);
const runs = computed(() => rows(ctx.view.value, 'glue.job_runs').filter(r => job.value && r.job === job.value.name));
const roles = computed(() => rows(ctx.view.value, 'iam.roles'));
const connections = computed(() => rows(ctx.view.value, 'glue.connections'));
const selected = ref<string[]>([]);
const busy = ref(false);
const tab = ref('Runs');
const deleting = ref(false);
const edit = reactive({ worker: 'G.1X', workers: 2, connection: '' });
watch(job, j => { if (j) { edit.worker = j.worker_type; edit.workers = j.workers; edit.connection = (j.connections || [])[0] || ''; } }, { immediate: true });
const form = reactive({ name: 'shopflow-curate-orders', role: '', script: 's3://shopflow-lake/scripts/curate_orders.py', version: '4.0',
  worker: 'G.1X', workers: 2, bookmark: true, sourceDb: 'shopflow_bronze', sourceTable: 'orders',
  target: 's3://shopflow-lake/silver/orders/', partition: 'order_date', dedup: 'order_id',
  targetDb: 'shopflow_silver', targetTable: 'orders' });

const jobColumns: Column[] = [
  { id: 'name', header: 'Job name', sortKey: 'name' },
  { id: 'type', header: 'Type', cell: () => 'Glue ETL' },
  { id: 'worker_type', header: 'Worker type' },
  { id: 'workers', header: 'Workers' },
  { id: 'glue_version', header: 'Glue version' },
  { id: 'runs', header: 'Runs' },
];
const runColumns: Column[] = [
  { id: 'state', header: 'Run status' },
  { id: 'started', header: 'Start time (UTC)', cell: r => awsDate(r.started) },
  { id: 'execution_time', header: 'Execution time', cell: r => `${r.execution_time} s` },
  { id: 'dpu_seconds', header: 'DPU seconds', cell: r => r.dpu_seconds },
  { id: 'rows', header: 'Records read / written', cell: r => `${r.rows_read} / ${r.rows_written}` },
  { id: 'bytes', header: 'S3 bytes read', cell: r => bytes(r.bytes_read) },
  { id: 'network_path', header: 'Network path' },
  { id: 'error', header: 'Error message' },
];

async function create() {
  busy.value = true;
  const args: Record<string, string> = {
    '--source_database': form.sourceDb, '--source_table': form.sourceTable, '--target_path': form.target,
    '--partition_keys': form.partition, '--dedup_key': form.dedup, '--target_database': form.targetDb,
    '--target_table': form.targetTable, '--job-bookmark-option': form.bookmark ? 'job-bookmark-enable' : 'job-bookmark-disable',
  };
  const result = await ctx.run(cli(['aws', 'glue', 'create-job'], {
    '--name': form.name, '--role': form.role, '--glue-version': form.version, '--worker-type': form.worker,
    '--number-of-workers': form.workers, '--command': `Name=glueetl,ScriptLocation=${form.script},PythonVersion=3`,
    '--default-arguments': JSON.stringify(args),
  }), `Successfully created job ${form.name}.`);
  busy.value = false;
  if (result.ok) ctx.to('glue', 'job', { name: form.name });
}
async function start(name: string) {
  busy.value = true;
  await ctx.run(cli(['aws', 'glue', 'start-job-run'], { '--job-name': name }), `Successfully started job ${name}. Navigate to Runs to view the run.`);
  busy.value = false;
}
const runJob = () => start(job.value!.name);
const runSelected = () => start(selected.value[0] || '');
async function resetBookmark() {
  busy.value = true;
  await ctx.run(cli(['aws', 'glue', 'reset-job-bookmark'], { '--job-name': job.value!.name }), 'Job bookmark reset.');
  busy.value = false;
}
async function save() {
  busy.value = true;
  const update = { Role: job.value!.role, Command: { Name: 'glueetl', ScriptLocation: job.value!.script },
    WorkerType: edit.worker, NumberOfWorkers: edit.workers,
    Connections: { Connections: edit.connection ? [edit.connection] : [] } };
  await ctx.run(cli(['aws', 'glue', 'update-job'], { '--job-name': job.value!.name, '--job-update': JSON.stringify(update) }),
    `Successfully updated job ${job.value!.name}.`);
  busy.value = false;
}
async function remove() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'glue', 'delete-job'], { '--job-name': job.value!.name }), 'Job deleted.');
  busy.value = false;
  if (result.ok) { deleting.value = false; ctx.to('glue', 'jobs'); }
}
</script>

<style scoped>
.gj__err { display: inline-block; max-width: 420px; white-space: normal; }
.gj__half { width: calc(50% - 4px); }
</style>
