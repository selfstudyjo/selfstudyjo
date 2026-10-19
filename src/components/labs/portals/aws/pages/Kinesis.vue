<template>
  <!-- Firehose -->
  <div v-if="page === 'firehose'">
    <CsTable v-model:selected="selFh" title="Firehose streams" variant="full-page" :items="firehoses" :columns="fhColumns" track-by="name"
             selection-type="single" empty-title="No Firehose streams"
             description="Amazon Data Firehose delivers streaming data to destinations such as Amazon S3.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!selFh.length" @click="fhDeleting = true">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="openFirehose">Create Firehose stream</button>
      </template>
      <template #cell-status="{ row }"><CsStatus state="active" :label="row.status === 'ACTIVE' ? 'Active' : row.status" /></template>
      <template #cell-last_error="{ row }"><span>{{ row.last_error || '-' }}</span></template>
    </CsTable>
    <CsModal v-if="fh.open" title="Create Firehose stream" size="large" @close="fh.open = false">
      <div class="cs-stack">
        <div class="cs-grid-2">
          <div class="cs-field"><label class="cs-label" for="fh-src">Source</label>
            <select id="fh-src" v-model="fh.source" class="cs-select"><option value="">Direct PUT</option>
              <option v-for="s in streams" :key="s.arn" :value="s.arn">Amazon Kinesis Data Streams: {{ s.name }}</option></select></div>
          <div class="cs-field"><label class="cs-label" for="fh-name">Firehose stream name</label><input id="fh-name" v-model.trim="fh.name" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="fh-bucket">S3 bucket</label>
            <select id="fh-bucket" v-model="fh.bucket" class="cs-select"><option v-for="b in buckets" :key="b.name" :value="b.name">{{ b.name }}</option></select></div>
          <div class="cs-field"><label class="cs-label" for="fh-role">Service access (IAM role)</label>
            <select id="fh-role" v-model="fh.role" class="cs-select"><option value="">Choose a role</option>
              <option v-for="r in roles" :key="r.arn" :value="r.arn">{{ r.name }}</option></select></div>
          <div class="cs-field"><label class="cs-label" for="fh-prefix">S3 bucket prefix</label><input id="fh-prefix" v-model="fh.prefix" class="cs-input cs-mono" /></div>
          <div class="cs-field"><label class="cs-label" for="fh-err">S3 bucket error output prefix</label><input id="fh-err" v-model="fh.errorPrefix" class="cs-input cs-mono" />
            <span class="cs-constraint">Required when the prefix contains expressions.</span></div>
          <div class="cs-field"><label class="cs-label" for="fh-int">Buffer interval (seconds)</label><input id="fh-int" v-model.number="fh.interval" type="number" min="0" max="900" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="fh-size">Buffer size (MiB)</label><input id="fh-size" v-model.number="fh.size" type="number" min="1" max="128" class="cs-input" /></div>
        </div>
        <label class="cs-check"><input v-model="fh.delimiter" type="checkbox" /> New line delimiter <small>Add a new line after each record (AppendDelimiterToRecord).</small></label>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="fh.open = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!fh.name || !fh.role || busy" @click="createFirehose">Create Firehose stream</button>
      </template>
    </CsModal>
    <CsDelete v-if="fhDeleting" :title="`Delete ${selFh[0]}?`" :word="selFh[0]" :busy="busy" @close="fhDeleting = false" @confirm="deleteFirehose" />
  </div>

  <!-- Stream detail -->
  <div v-else-if="page === 'stream'">
    <template v-if="stream">
      <CsHeader :title="stream.name"><template #actions>
        <button type="button" class="cs-btn" @click="deleting = true">Delete</button></template></CsHeader>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Data stream summary" :level="2" :info="false" /></div>
        <div class="cs-container__body"><dl class="cs-kv">
          <div><dt>Status</dt><dd><CsStatus state="active" label="Active" /></dd></div>
          <div><dt>Capacity mode</dt><dd>{{ stream.mode === 'PROVISIONED' ? 'Provisioned' : 'On-demand' }}</dd></div>
          <div><dt>Provisioned shards</dt><dd>{{ stream.shards }}</dd></div>
          <div><dt>Data retention period</dt><dd>{{ stream.retention }} hours</dd></div>
          <div><dt>ARN</dt><dd class="cs-mono">{{ stream.arn }}</dd></div>
        </dl></div>
      </section>
      <div class="cs-tabs" role="tablist">
        <button v-for="t in ['Shards', 'Data viewer', 'Put record']" :key="t" type="button" class="cs-tab" role="tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
      </div>
      <section v-if="tab === 'Shards'" class="cs-container"><div class="cs-container__body">
        <table class="cs-table-mini"><thead><tr><th>Shard ID</th><th>Status</th><th>Starting hash key</th><th>Ending hash key</th><th>Records</th></tr></thead>
          <tbody><tr v-for="s in stream.shard_list" :key="s.id"><td class="cs-mono">{{ s.id }}</td><td>{{ s.open ? 'Open' : 'Closed' }}</td>
            <td class="cs-mono ks__hash">{{ s.start }}</td><td class="cs-mono ks__hash">{{ s.end }}</td><td>{{ s.records }}</td></tr></tbody></table>
      </div></section>
      <section v-else-if="tab === 'Data viewer'" class="cs-container"><div class="cs-container__body cs-stack">
        <div class="cs-row">
          <label class="cs-label" for="ks-shard">Shard</label>
          <select id="ks-shard" v-model="viewShard" class="cs-select ks__sel"><option v-for="s in stream.shard_list" :key="s.id" :value="s.id">{{ s.id }}</option></select>
          <label class="cs-label" for="ks-pos">Starting position</label>
          <select id="ks-pos" v-model="viewPos" class="cs-select ks__sel"><option value="TRIM_HORIZON">Trim horizon</option><option value="LATEST">Latest</option></select>
          <button type="button" class="cs-btn" :disabled="busy" @click="getRecords">Get records</button>
        </div>
        <table v-if="records.length" class="cs-table-mini"><thead><tr><th>Partition key</th><th>Data</th><th>Sequence number</th></tr></thead>
          <tbody><tr v-for="r in records" :key="r.seq"><td>{{ r.key }}</td><td class="cs-mono ks__data">{{ r.data }}</td><td class="cs-mono">{{ r.seq }}</td></tr></tbody></table>
        <div v-else class="cs-empty">No records retrieved yet.</div>
      </div></section>
      <section v-else class="cs-container"><div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="ks-pk">Partition key</label><input id="ks-pk" v-model.trim="putKey" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label" for="ks-data">Data</label><textarea id="ks-data" v-model="putData" class="cs-textarea cs-mono" /></div>
        <div class="cs-form-actions"><button type="button" class="cs-btn cs-btn--primary" :disabled="!putKey || !putData || busy" @click="putRecord">Put record</button></div>
      </div></section>
      <CsDelete v-if="deleting" :title="`Delete ${stream.name}?`" word="delete" :busy="busy" @close="deleting = false" @confirm="deleteStream" />
    </template>
  </div>

  <!-- Data streams -->
  <div v-else-if="creating">
    <CsHeader title="Create data stream" />
    <section class="cs-container">
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="ks-name">Data stream name</label><input id="ks-name" v-model.trim="newName" class="cs-input" /></div>
        <div class="cs-tiles">
          <label class="cs-tile" :class="{ 'is-checked': mode === 'ON_DEMAND' }"><input v-model="mode" type="radio" value="ON_DEMAND" />
            <span><strong>On-demand</strong><small>Scales automatically; pay per GB.</small></span></label>
          <label class="cs-tile" :class="{ 'is-checked': mode === 'PROVISIONED' }"><input v-model="mode" type="radio" value="PROVISIONED" />
            <span><strong>Provisioned</strong><small>You set shards: 1 MB/s or 1,000 records/s in each.</small></span></label>
        </div>
        <div v-if="mode === 'PROVISIONED'" class="cs-field"><label class="cs-label" for="ks-shards">Provisioned shards</label>
          <input id="ks-shards" v-model.number="shardCount" type="number" min="1" class="cs-input ks__sel" /></div>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('kinesis', 'streams')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="!newName || busy" @click="createStream">Create data stream</button>
    </div>
  </div>
  <div v-else>
    <CsTable title="Data streams" variant="full-page" :items="streams" :columns="columns" track-by="name" empty-title="No data streams">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('kinesis', 'streams', { create: '1' })">Create data stream</button></template>
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('kinesis', 'stream', { name: row.name })">{{ row.name }}</a></template>
    </CsTable>
  </div>
</template>

<script setup lang="ts">
/** Amazon Kinesis Data Streams (create, shards, data viewer, put record) and Amazon Data Firehose to S3. */
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsHeader from '../CsHeader.vue';
import CsModal from '../CsModal.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const page = computed(() => ctx.route.value.page);
const params = computed(() => ctx.route.value.params || {});
const creating = computed(() => params.value.create === '1');
const streams = computed(() => rows(ctx.view.value, 'kinesis'));
const stream = computed(() => streams.value.find(s => s.name === params.value.name) || null);
const firehoses = computed(() => rows(ctx.view.value, 'firehose'));
const buckets = computed(() => rows(ctx.view.value, 's3.buckets'));
const roles = computed(() => rows(ctx.view.value, 'iam.roles'));
const busy = ref(false);
const tab = ref('Shards');
const deleting = ref(false);
const newName = ref('shopflow-web-events');
const mode = ref('PROVISIONED');
const shardCount = ref(2);
const viewShard = ref('shardId-000000000000');
const viewPos = ref('TRIM_HORIZON');
const records = ref<Array<Record<string, string>>>([]);
const putKey = ref('sess-1001');
const putData = ref('{"event_type":"page_view","page":"/"}');
const selFh = ref<string[]>([]);
const fhDeleting = ref(false);
const fh = reactive({ open: false, source: '', name: 'shopflow-web-events-to-s3', bucket: 'shopflow-lake', role: '',
  prefix: 'bronze/web_events/dt=!{timestamp:yyyy-MM-dd}/', errorPrefix: '_errors/web_events/!{firehose:error-output-type}/',
  interval: 300, size: 64, delimiter: true });

const columns: Column[] = [
  { id: 'name', header: 'Data stream name', sortKey: 'name' }, { id: 'status', header: 'Status', cell: () => 'Active' },
  { id: 'mode', header: 'Capacity mode', cell: r => (r.mode === 'PROVISIONED' ? 'Provisioned' : 'On-demand') },
  { id: 'shards', header: 'Open shards' }, { id: 'records', header: 'Records retained' },
];
const fhColumns: Column[] = [
  { id: 'name', header: 'Name' }, { id: 'status', header: 'Status' },
  { id: 'source', header: 'Source', cell: r => (r.source ? String(r.source).split('/').pop() : 'Direct PUT') },
  { id: 'bucket', header: 'Destination', cell: r => `Amazon S3: ${String(r.bucket).replace('arn:aws:s3:::', '')}` },
  { id: 'delivered', header: 'Objects / records delivered', cell: r => `${r.delivered_objects} / ${r.delivered_records}` },
  { id: 'last_error', header: 'Last error' },
];

async function createStream() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'kinesis', 'create-stream'], {
    '--stream-name': newName.value, '--shard-count': mode.value === 'PROVISIONED' ? shardCount.value : '',
    '--stream-mode-details': `StreamMode=${mode.value}` }), `Data stream ${newName.value} successfully created.`);
  busy.value = false;
  if (result.ok) ctx.to('kinesis', 'stream', { name: newName.value });
}
async function deleteStream() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'kinesis', 'delete-stream'], { '--stream-name': stream.value!.name }), 'Data stream deleted.');
  busy.value = false;
  if (result.ok) { deleting.value = false; ctx.to('kinesis', 'streams'); }
}
async function getRecords() {
  busy.value = true;
  const it = await ctx.run(cli(['aws', 'kinesis', 'get-shard-iterator'], { '--stream-name': stream.value!.name, '--shard-id': viewShard.value,
    '--shard-iterator-type': viewPos.value, '--query': 'ShardIterator', '--output': 'text' }), '', { quiet: true });
  const token = (it.output || '').trim();
  if (it.ok && token) {
    const got = await ctx.run(cli(['aws', 'kinesis', 'get-records'], { '--shard-iterator': token, '--limit': 25 }), '', { quiet: true });
    records.value = ((got.data || {}) as { records?: Array<Record<string, string>> }).records || [];
  }
  busy.value = false;
}
async function putRecord() {
  busy.value = true;
  await ctx.run(cli(['aws', 'kinesis', 'put-record'], { '--stream-name': stream.value!.name, '--partition-key': putKey.value,
    '--cli-binary-format': 'raw-in-base64-out', '--data': putData.value }), 'Record put successfully.');
  busy.value = false;
}
function openFirehose() {
  fh.open = true;
  fh.source = streams.value[0]?.arn || '';
}
async function createFirehose() {
  busy.value = true;
  const dest: Record<string, unknown> = { RoleARN: fh.role, BucketARN: `arn:aws:s3:::${fh.bucket}`, Prefix: fh.prefix,
    ErrorOutputPrefix: fh.errorPrefix, BufferingHints: { SizeInMBs: fh.size, IntervalInSeconds: fh.interval },
    CompressionFormat: 'UNCOMPRESSED' };
  if (fh.delimiter) dest.ProcessingConfiguration = { Enabled: true, Processors: [{ Type: 'AppendDelimiterToRecord' }] };
  const result = await ctx.run(cli(['aws', 'firehose', 'create-delivery-stream'], {
    '--delivery-stream-name': fh.name, '--delivery-stream-type': fh.source ? 'KinesisStreamAsSource' : 'DirectPut',
    '--kinesis-stream-source-configuration': fh.source ? `KinesisStreamARN=${fh.source},RoleARN=${fh.role}` : '',
    '--extended-s3-destination-configuration': JSON.stringify(dest) }), `Firehose stream ${fh.name} created.`);
  busy.value = false;
  if (result.ok) fh.open = false;
}
async function deleteFirehose() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'firehose', 'delete-delivery-stream'], { '--delivery-stream-name': selFh.value[0] }), 'Firehose stream deleted.');
  busy.value = false;
  if (result.ok) { fhDeleting.value = false; selFh.value = []; }
}
</script>

<style scoped>
.ks__hash { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ks__data { max-width: 520px; word-break: break-all; }
.ks__sel { width: 200px; }
</style>
