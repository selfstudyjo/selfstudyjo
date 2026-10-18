<template>
  <CsTable v-if="page === 'buckets'" variant="full-page" title="General purpose buckets" :items="buckets" :columns="cols" track-by="name"
           selection-type="single" v-model:selected="sel" filter-placeholder="Find buckets by name" empty-title="No buckets">
    <template #actions>
      <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = sel[0]">Delete</button>
      <button type="button" class="cs-btn cs-btn--primary" @click="creating = { name: '' }">Create bucket</button>
    </template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('s3', 'bucket', { name: row.name })">{{ row.name }}</a></template>
    <template #cell-access="{ row }"><span :class="row.public ? 's3__public' : ''">{{ row.public ? 'Public' : 'Bucket and objects not public' }}</span></template>
  </CsTable>

  <div v-else-if="page === 'bucket' && bucket">
    <CsHeader :title="bucket.name" />
    <div class="cs-tabs">
      <button v-for="t in ['Objects', 'Properties', 'Permissions']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <div v-if="tab === 'Objects'">
      <CsTable title="Objects" :items="bucket.objects" :columns="objCols" track-by="key" filter-placeholder="Find objects by prefix" empty-title="No objects">
        <template #cell-key="{ row }"><a href="#" class="cs-link" @click.prevent="openObject(row.key)">{{ row.key }}</a></template>
      </CsTable>
      <section v-if="object" class="cs-container s3__space">
        <div class="cs-container__head"><CsHeader :title="object.key" :level="2" :info="false" /></div>
        <div class="cs-container__body"><pre class="cs-code">{{ object.body }}</pre></div>
      </section>
    </div>
    <div v-else-if="tab === 'Properties'" class="cs-stack">
      <section class="cs-container"><div class="cs-container__head"><CsHeader title="Bucket Versioning" :level="2" :info="false">
        <template #actions><button type="button" class="cs-btn" :disabled="busy" @click="toggleVersioning">{{ bucket.versioning === 'Enabled' ? 'Suspend' : 'Enable' }}</button></template></CsHeader></div>
        <div class="cs-container__body">Bucket Versioning: <strong>{{ bucket.versioning }}</strong></div></section>
      <section class="cs-container"><div class="cs-container__head"><CsHeader title="Default encryption" :level="2" :info="false" /></div>
        <div class="cs-container__body">Encryption type: {{ bucket.encryption === 'aws:kms' ? 'SSE-KMS' : 'SSE-S3' }} ({{ bucket.encryption }})</div></section>
      <section class="cs-container"><div class="cs-container__head"><CsHeader :title="`Tags (${Object.keys(bucket.tags).length})`" :level="2" :info="false">
        <template #actions><button type="button" class="cs-btn" @click="openTags">Edit</button></template></CsHeader></div>
        <div class="cs-container__body"><dl class="cs-kv"><div v-for="(v, k) in bucket.tags" :key="k"><dt>{{ k }}</dt><dd>{{ v }}</dd></div></dl>
          <p v-if="!Object.keys(bucket.tags).length" class="cs-muted s3__p">No tags associated with this resource.</p></div></section>
    </div>
    <div v-else class="cs-stack">
      <div v-if="bucket.public" class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
        <div><strong>This bucket is public.</strong> Anyone on the internet can read objects in it. Block public access or remove the statement that grants it.</div></div>
      <section class="cs-container"><div class="cs-container__head"><CsHeader title="Block public access (bucket settings)" :level="2" :info="false">
        <template #actions><button type="button" class="cs-btn" @click="openPab(bucket.pab, 'bucket')">Edit</button></template></CsHeader></div>
        <div class="cs-container__body"><dl class="cs-kv"><div v-for="k in PAB" :key="k"><dt>{{ PAB_LABEL[k] }}</dt><dd><CsStatus :type="bucket.pab[k] ? 'success' : 'warning'" :label="bucket.pab[k] ? 'On' : 'Off'" /></dd></div></dl></div></section>
      <section class="cs-container"><div class="cs-container__head"><CsHeader title="Bucket policy" :level="2" :info="false">
        <template #actions><button type="button" class="cs-btn" :disabled="!bucket.policy" @click="dropPolicy = true">Delete</button>
          <button type="button" class="cs-btn" @click="openPolicy">Edit</button></template></CsHeader></div>
        <div class="cs-container__body"><pre v-if="bucket.policy" class="cs-code">{{ pretty(bucket.policy) }}</pre><p v-else class="cs-muted s3__p">No policy to display.</p></div></section>
      <section class="cs-container"><div class="cs-container__head"><CsHeader title="Access control list (ACL)" :level="2" :info="false" /></div>
        <div class="cs-container__body">Everyone (public access): {{ bucket.acl_public ? 'Read' : '-' }}</div></section>
    </div>
  </div>

  <div v-else-if="page === 'account-bpa'">
    <CsHeader title="Block Public Access settings for this account" :description="`Account ${ctx.account.value}. These apply to every bucket, whatever its own settings.`">
      <template #actions><button type="button" class="cs-btn" @click="openPab(account, 'account')">Edit</button></template></CsHeader>
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div v-for="k in PAB" :key="k"><dt>{{ PAB_LABEL[k] }}</dt><dd><CsStatus :type="account[k] ? 'success' : 'warning'" :label="account[k] ? 'On' : 'Off'" /></dd></div>
    </dl></div></section>
  </div>

  <CsModal v-if="creating" title="Create bucket" @close="creating = null">
    <div class="cs-field"><label class="cs-label">Bucket name</label><input v-model="creating.name" class="cs-input" placeholder="acme-ops-reports" />
      <span class="cs-constraint">3-63 lowercase letters, numbers, dots and hyphens. Block all public access is on for a new bucket.</span></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="creating = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(creating.name)" @click="create">Create bucket</button>
    </template>
  </CsModal>

  <CsModal v-if="pab" :title="pab.scope === 'account' ? 'Edit Block Public Access settings for this account' : 'Edit Block public access (bucket settings)'" @close="pab = null">
    <div class="cs-stack">
      <label class="cs-check"><input type="checkbox" :checked="PAB.every(k => pab.values[k])" @change="setAll(($event.target as HTMLInputElement).checked)" /><span><strong>Block all public access</strong></span></label>
      <label v-for="k in PAB" :key="k" class="cs-check s3__indent"><input v-model="pab.values[k]" type="checkbox" /><span>{{ PAB_LABEL[k] }}</span></label>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="pab = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="savePab">Save changes</button>
    </template>
  </CsModal>

  <CsModal v-if="policy" title="Edit bucket policy" size="large" @close="policy = null">
    <textarea v-model="policy.text" class="cs-textarea cs-mono s3__policy" spellcheck="false" />
    <p v-if="policy.error" class="cs-error-text">{{ policy.error }}</p>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="policy = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="savePolicy">Save changes</button>
    </template>
  </CsModal>

  <CsModal v-if="tags" title="Edit bucket tags" @close="tags = null">
    <div class="cs-stack">
      <div v-for="(t, i) in tags" :key="i" class="cs-row"><input v-model="t.k" class="cs-input" placeholder="Key" /><input v-model="t.v" class="cs-input" placeholder="Value" />
        <button type="button" class="cs-btn" @click="tags.splice(i, 1)">Remove</button></div>
      <div><button type="button" class="cs-btn" @click="tags.push({ k: '', v: '' })">Add tag</button></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="tags = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !tags.some(t => t.k.trim())" @click="saveTags">Save changes</button>
    </template>
  </CsModal>

  <CsDelete v-if="dropPolicy" title="Delete bucket policy?" :busy="busy" @close="dropPolicy = false" @confirm="deletePolicy">
    <p class="s3__p">The bucket keeps its other permissions. Anything the policy granted stops working at once.</p>
  </CsDelete>
  <CsDelete v-if="deleting" title="Delete bucket" :word="deleting" :busy="busy" @close="deleting = ''" @confirm="remove">
    <p class="s3__p">A bucket must be empty before it can be deleted.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, parseJson, pick, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import CsIcon from '../../aws/CsIcon.vue';
import { useOps } from '../ctx';
import { pretty } from '../kit';
import { regionName } from '../nav';

const PAB = ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'] as const;
const PAB_LABEL: Record<string, string> = {
  BlockPublicAcls: 'Block public access granted through new ACLs', IgnorePublicAcls: 'Block public access granted through any ACLs',
  BlockPublicPolicy: 'Block public access granted through new public bucket policies',
  RestrictPublicBuckets: 'Block public and cross-account access through any public bucket policies' };

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const tab = ref('Objects');
const busy = ref(false);
const deleting = ref('');
const dropPolicy = ref(false);
const creating = ref<any>(null);
const pab = ref<any>(null);
const policy = ref<any>(null);
const tags = ref<{ k: string; v: string }[] | null>(null);
const object = ref<{ key: string; body: string } | null>(null);

const buckets = computed(() => rows<any>(ctx.c.value, 's3.buckets'));
const bucket = computed<any>(() => buckets.value.find(b => b.name === ctx.route.value.params?.name) || null);
const account = computed<any>(() => pick(ctx.c.value, 's3.account_pab', {}));
const cols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'region', header: 'AWS Region', cell: () => `${regionName(ctx.home.value)} ${ctx.home.value}` },
  { id: 'access', header: 'Access' }, { id: 'versioning', header: 'Versioning' }];
const objCols = [{ id: 'key', header: 'Name', sortKey: 'key' }, { id: 'size', header: 'Size', cell: (o: any) => `${o.size} B` }];

async function create() {
  busy.value = true;
  const name = creating.value.name;
  const result = await ctx.run(cli(['aws', 's3api', 'create-bucket'], { '--bucket': name, '--create-bucket-configuration': `LocationConstraint=${ctx.home.value}` }), `Successfully created bucket "${name}".`);
  busy.value = false;
  if (result.ok) creating.value = null;
}
async function remove() {
  busy.value = true;
  const name = deleting.value;
  const result = await ctx.run(cli(['aws', 's3api', 'delete-bucket'], { '--bucket': name }), `Successfully deleted bucket "${name}".`);
  busy.value = false;
  deleting.value = '';
  if (result.ok) sel.value = [];
}
async function openObject(key: string) {
  const result = await ctx.run(cli(['aws', 's3', 'cp', `s3://${bucket.value.name}/${key}`, '-']), undefined, { quiet: true });
  if (result.ok) object.value = { key, body: result.output || '' };
}
async function toggleVersioning() {
  busy.value = true;
  const status = bucket.value.versioning === 'Enabled' ? 'Suspended' : 'Enabled';
  await ctx.run(cli(['aws', 's3api', 'put-bucket-versioning'], { '--bucket': bucket.value.name, '--versioning-configuration': `Status=${status}` }), `Bucket Versioning ${status.toLowerCase()}.`);
  busy.value = false;
}
function openPab(values: Record<string, boolean>, scope: string) { pab.value = { scope, values: { ...values } }; }
function setAll(on: boolean) { for (const k of PAB) pab.value.values[k] = on; }
async function savePab() {
  busy.value = true;
  const config = PAB.map(k => `${k}=${pab.value.values[k] ? 'true' : 'false'}`).join(',');
  const command = pab.value.scope === 'account'
    ? cli(['aws', 's3control', 'put-public-access-block'], { '--account-id': ctx.account.value, '--public-access-block-configuration': config })
    : cli(['aws', 's3api', 'put-public-access-block'], { '--bucket': bucket.value.name, '--public-access-block-configuration': config });
  const result = await ctx.run(command, 'Block Public Access settings updated.');
  busy.value = false;
  if (result.ok) pab.value = null;
}
function openPolicy() {
  policy.value = { text: bucket.value.policy ? pretty(bucket.value.policy)
    : pretty({ Version: '2012-10-17', Statement: [{ Sid: 'Statement1', Effect: 'Deny', Principal: '*', Action: 's3:*', Resource: [`arn:aws:s3:::${bucket.value.name}/*`],
      Condition: { Bool: { 'aws:SecureTransport': 'false' } } }] }), error: '' };
}
async function savePolicy() {
  const parsed = parseJson(policy.value.text);
  if (!parsed) { policy.value.error = 'Policy has invalid JSON format.'; return; }
  busy.value = true;
  const result = await ctx.run(cli(['aws', 's3api', 'put-bucket-policy'], { '--bucket': bucket.value.name, '--policy': JSON.stringify(parsed) }), 'Bucket policy saved.');
  busy.value = false;
  if (result.ok) policy.value = null;
}
async function deletePolicy() {
  busy.value = true;
  await ctx.run(cli(['aws', 's3api', 'delete-bucket-policy'], { '--bucket': bucket.value.name }), 'Bucket policy deleted.');
  busy.value = false;
  dropPolicy.value = false;
}
function openTags() { tags.value = Object.entries(bucket.value.tags).map(([k, v]) => ({ k, v: String(v) })); if (!tags.value.length) tags.value.push({ k: '', v: '' }); }
async function saveTags() {
  busy.value = true;
  const set = tags.value!.filter(t => t.k.trim()).map(t => ({ Key: t.k.trim(), Value: t.v }));
  const result = await ctx.run(cli(['aws', 's3api', 'put-bucket-tagging'], { '--bucket': bucket.value.name, '--tagging': JSON.stringify({ TagSet: set }) }), 'Tags saved.');
  busy.value = false;
  if (result.ok) tags.value = null;
}
</script>

<style scoped>
.s3__public { color: #db0000; font-weight: 700; }
.s3__space { margin-top: 20px; }
.s3__p { margin: 0; }
.s3__indent { margin-left: 24px; }
.s3__policy { min-height: 320px; }
</style>
