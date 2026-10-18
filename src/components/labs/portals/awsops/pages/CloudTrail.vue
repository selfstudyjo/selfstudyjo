<template>
  <CsTable v-if="page === 'trails'" variant="full-page" title="Trails" :items="trails" :columns="trailCols" track-by="name" selection-type="single" v-model:selected="sel">
    <template #actions>
      <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = sel[0]">Delete</button>
      <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('cloudtrail', 'trail-create')">Create trail</button>
    </template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('cloudtrail', 'trail', { name: row.name })">{{ row.name }}</a></template>
    <template #cell-logging="{ row }"><CsStatus :type="row.logging ? 'success' : 'stopped'" :label="row.logging ? 'Logging' : 'Off'" /></template>
  </CsTable>

  <div v-else-if="page === 'trail-create'">
    <CsHeader title="Create trail" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="General details" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Trail name</label><input v-model="f.name" class="cs-input" placeholder="org-trail" /></div>
        <label class="cs-check"><input v-model="f.org" type="checkbox" /><span>Enable for all accounts in my organization</span></label>
        <label class="cs-check"><input v-model="f.multi" type="checkbox" /><span>Apply trail to all Regions (multi-Region trail)</span></label>
        <div class="cs-field"><label class="cs-label">Trail log bucket</label><select v-model="f.bucket" class="cs-select"><option v-for="b in buckets" :key="b.name" :value="b.name">{{ b.name }}</option></select></div>
        <label class="cs-check"><input v-model="f.validation" type="checkbox" /><span>Log file validation<small>Detect whether a log file was modified, deleted or unchanged after delivery.</small></span></label>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('cloudtrail', 'trails')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !/^[\w.-]{3,128}$/.test(f.name)" @click="create">Create trail</button>
    </div>
  </div>

  <div v-else-if="page === 'trail' && trail">
    <CsHeader :title="trail.name"><template #actions>
      <button type="button" class="cs-btn" :disabled="busy" @click="toggleLogging">{{ trail.logging ? 'Stop logging' : 'Start logging' }}</button>
      <button type="button" class="cs-btn" @click="openEdit">Edit</button>
      <button type="button" class="cs-btn" @click="deleting = trail.name">Delete</button></template></CsHeader>
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Logging</dt><dd><CsStatus :type="trail.logging ? 'success' : 'stopped'" :label="trail.logging ? 'Logging' : 'Off'" /></dd></div>
      <div><dt>Multi-region trail</dt><dd>{{ trail.multi_region ? 'Yes' : 'No' }}</dd></div>
      <div><dt>Apply trail to my organization</dt><dd>{{ trail.org ? 'Enabled for all accounts' : 'Not enabled' }}</dd></div>
      <div><dt>Trail log location</dt><dd>{{ trail.bucket }}/AWSLogs/{{ ctx.account.value }}</dd></div>
      <div><dt>Log file validation</dt><dd>{{ trail.validation ? 'Enabled' : 'Disabled' }}</dd></div>
      <div><dt>Home Region</dt><dd>{{ trail.home }}</dd></div>
    </dl></div></section>
  </div>

  <div v-else-if="page === 'events'">
    <CsHeader title="Event history" description="Event history shows you the last 90 days of management events." />
    <section class="cs-container"><div class="cs-container__body">
      <div class="cs-row ct__filter">
        <select v-model="lk.key" class="cs-select ct__key"><option value="EventName">Event name</option><option value="Username">User name</option><option value="AccessKeyId">AWS access key</option></select>
        <input v-model="lk.value" class="cs-input ct__val" placeholder="Enter a lookup value" @keydown.enter="lookup" />
        <button type="button" class="cs-btn" :disabled="busy || !lk.value.trim()" @click="lookup">Look up</button>
        <button v-if="looked" type="button" class="cs-btn cs-btn--link" @click="looked = null">Clear filter</button>
      </div>
    </div></section>
    <CsTable title="Events" :items="looked || events" :columns="evCols" track-by="rid" filter-placeholder="Filter loaded events" empty-title="No events" />
  </div>

  <CsModal v-if="editing" title="Edit trail" @close="editing = false">
    <div class="cs-stack">
      <label class="cs-check"><input v-model="ed.multi" type="checkbox" /><span>Multi-region trail</span></label>
      <label class="cs-check"><input v-model="ed.validation" type="checkbox" /><span>Log file validation</span></label>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="editing = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveEdit">Save changes</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete trail" :word="deleting" :busy="busy" @close="deleting = ''" @confirm="remove">
    <p class="ct__p">Logs already delivered to S3 are kept. Nothing is recorded by this trail after it is deleted.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const busy = ref(false);
const deleting = ref('');
const editing = ref(false);
const looked = ref<any[] | null>(null);

const trails = computed(() => rows<any>(ctx.c.value, 'security.trails'));
const trail = computed<any>(() => trails.value.find(t => t.name === ctx.route.value.params?.name) || null);
const buckets = computed(() => rows<any>(ctx.c.value, 's3.buckets'));
const events = computed(() => rows<any>(ctx.c.value, 'security.events').map((e, i) => ({ ...e, rid: i, akey: e.key })));
const trailCols = [{ id: 'name', header: 'Name' }, { id: 'home', header: 'Home Region' }, { id: 'multi_region', header: 'Multi-region trail', cell: (t: any) => (t.multi_region ? 'Yes' : 'No') },
  { id: 'org', header: 'Organization trail', cell: (t: any) => (t.org ? 'Yes' : 'No') }, { id: 'bucket', header: 'S3 bucket' }, { id: 'logging', header: 'Status' }];
const evCols = [{ id: 'name', header: 'Event name', sortKey: 'name' }, { id: 'time', header: 'Event time (shift)' }, { id: 'user', header: 'User name' },
  { id: 'region', header: 'AWS Region' }, { id: 'ip', header: 'Source IP address' }, { id: 'akey', header: 'AWS access key', cell: (e: any) => e.akey || '-' },
  { id: 'resources', header: 'Resources', cell: (e: any) => e.resources || '-' }];

const f = reactive({ name: '', org: false, multi: true, bucket: 'acme-cloudtrail-logs', validation: true });
async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'cloudtrail', 'create-trail'], { '--name': f.name, '--s3-bucket-name': f.bucket,
    '--is-multi-region-trail': f.multi, '--is-organization-trail': f.org, '--enable-log-file-validation': f.validation }));
  // The console starts logging on a new trail; the CLI leaves that as a second call.
  if (result.ok) await ctx.run(cli(['aws', 'cloudtrail', 'start-logging'], { '--name': f.name }), `Trail ${f.name} successfully created and logging.`);
  busy.value = false;
  if (result.ok) ctx.to('cloudtrail', 'trails');
}
async function toggleLogging() {
  busy.value = true;
  const verb = trail.value.logging ? 'stop-logging' : 'start-logging';
  await ctx.run(cli(['aws', 'cloudtrail', verb], { '--name': trail.value.name }), verb === 'start-logging' ? 'Logging started.' : 'Logging stopped.');
  busy.value = false;
}
const ed = reactive({ multi: false, validation: false });
function openEdit() { ed.multi = trail.value.multi_region; ed.validation = trail.value.validation; editing.value = true; }
async function saveEdit() {
  busy.value = true;
  const t = trail.value;
  const result = await ctx.run(cli(['aws', 'cloudtrail', 'update-trail'], { '--name': t.name,
    '--is-multi-region-trail': ed.multi && !t.multi_region, '--no-is-multi-region-trail': !ed.multi && t.multi_region,
    '--enable-log-file-validation': ed.validation && !t.validation, '--no-enable-log-file-validation': !ed.validation && t.validation }), `Trail ${t.name} updated.`);
  busy.value = false;
  if (result.ok) editing.value = false;
}
const lk = reactive({ key: ctx.route.value.params?.key ? 'AccessKeyId' : 'EventName', value: ctx.route.value.params?.key || '' });
async function lookup() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'cloudtrail', 'lookup-events'], { '--lookup-attributes': `AttributeKey=${lk.key},AttributeValue=${lk.value.trim()}` }));
  busy.value = false;
  if (result.ok) looked.value = (parseJson<any>(result.output)?.Events || []).map((e: any, i: number) => ({ rid: i, name: e.EventName, time: e.EventTime,
    user: e.Username, region: e.AwsRegion, ip: e.SourceIPAddress, akey: e.AccessKeyId, resources: e.Resources }));
}
async function remove() {
  busy.value = true;
  const name = deleting.value;
  const result = await ctx.run(cli(['aws', 'cloudtrail', 'delete-trail'], { '--name': name }), `Trail ${name} deleted.`);
  busy.value = false;
  deleting.value = '';
  sel.value = [];
  if (result.ok && page.value === 'trail') ctx.to('cloudtrail', 'trails');
}
</script>

<style scoped>
.ct__filter { flex-wrap: wrap; }
.ct__key { width: 180px; }
.ct__val { width: 320px; max-width: 100%; }
.ct__p { margin: 0; }
</style>
