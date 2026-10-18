<template>
  <div v-if="obj">
    <CsHeader :title="leaf">
      <template #actions>
        <button type="button" class="cs-btn" @click="copy(s3uri, 'S3 URI copied')"><CsIcon name="copy" /> Copy S3 URI</button>
        <button type="button" class="cs-btn" @click="download"><CsIcon name="download" /> Download</button>
        <button type="button" class="cs-btn" @click="open">Open <CsIcon name="external" size="small" /></button>
        <CsDropdown label="Object actions" :items="actions" @select="act" />
      </template>
    </CsHeader>
    <div class="cs-tabs">
      <button type="button" class="cs-tab" :class="{ 'is-active': tab === 'properties' }" @click="tab = 'properties'">Properties</button>
      <button type="button" class="cs-tab" :class="{ 'is-active': tab === 'permissions' }" @click="tab = 'permissions'">Permissions</button>
      <button type="button" class="cs-tab" disabled>Versions</button>
    </div>
    <template v-if="tab === 'properties'">
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Object overview" :level="2" :info="false" /></div>
        <div class="cs-container__body">
          <dl class="cs-kv">
            <div><dt>Owner</dt><dd>lab</dd></div>
            <div><dt>AWS Region</dt><dd>{{ regionName(bucketRow?.region || '') }} {{ bucketRow?.region }}</dd></div>
            <div><dt>Last modified</dt><dd>{{ awsDate(obj.modified) }}</dd></div>
            <div><dt>Size</dt><dd>{{ bytes(obj.size) }}</dd></div>
            <div><dt>Type</dt><dd>{{ obj.content_type || '-' }}</dd></div>
            <div><dt>Key</dt><dd class="cs-mono">{{ obj.key }}</dd></div>
            <div><dt>S3 URI</dt><dd class="cs-mono">{{ s3uri }}</dd></div>
            <div><dt>Amazon Resource Name (ARN)</dt><dd class="cs-mono">arn:aws:s3:::{{ bucket }}/{{ obj.key }}</dd></div>
            <div><dt>Entity tag (Etag)</dt><dd class="cs-mono">{{ obj.etag }}</dd></div>
            <div><dt>Object URL</dt><dd><span class="cs-link">{{ url }}</span></dd></div>
          </dl>
        </div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Storage class" :level="2" description="Amazon S3 offers a range of storage classes designed for different use cases." /></div>
        <div class="cs-container__body"><dl class="cs-kv"><div><dt>Storage class</dt><dd>Standard</dd></div></dl></div>
      </section>
    </template>
    <section v-else class="cs-container">
      <div class="cs-container__head"><CsHeader title="Access control list (ACL)" :level="2" :info="false" /></div>
      <div class="cs-container__body"><div class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
        <div>This bucket has the bucket owner enforced setting applied for Object Ownership. Use bucket policies to control access.</div></div></div>
    </section>
    <section v-if="body !== null" class="cs-container">
      <div class="cs-container__head"><CsHeader :title="obj.key" :level="2" :info="false" description="Object content (aws s3 cp … -)">
        <template #actions><button type="button" class="cs-btn cs-btn--link" @click="body = null">Close</button></template>
      </CsHeader></div>
      <div class="cs-container__body"><pre class="cs-code">{{ body || '(empty object)' }}</pre></div>
    </section>
    <CsDelete v-if="deleting" title="Delete objects" word="permanently delete" action="Delete objects" @close="deleting = false" @confirm="remove">
      <p class="s3ob__p">Deleting the specified object can't be undone: <strong>{{ obj.key }}</strong></p>
    </CsDelete>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>Object not found</strong>The key "{{ key }}" is not in bucket "{{ bucket }}".
      <button type="button" class="cs-link" @click="ctx.to('s3', 'bucket', { name: bucket })">Back to the bucket</button></div></div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import { awsDate, bytes, useAws } from '../ctx';
import { regionName } from '../nav';

const ctx = useAws();
const bucket = computed(() => ctx.route.value.params?.bucket || '');
const key = computed(() => ctx.route.value.params?.key || '');
const obj = computed(() => rows(ctx.view.value, 's3.objects').find(o => o.bucket === bucket.value && o.key === key.value) || null);
const bucketRow = computed(() => rows(ctx.view.value, 's3.buckets').find(b => b.name === bucket.value));
const leaf = computed(() => key.value.split('/').filter(Boolean).pop() || key.value);
const s3uri = computed(() => `s3://${bucket.value}/${key.value}`);
const url = computed(() => `https://${bucket.value}.s3.${bucketRow.value?.region || ctx.region.value}.amazonaws.com/${key.value}`);
const tab = ref('properties');
const body = ref<string | null>(null);
const deleting = ref(false);

const actions = [
  { id: 'copy-url', text: 'Copy URL' }, { id: 'presign', text: 'Share with a presigned URL' },
  { id: 'delete', text: 'Delete' },
];

async function copy(text: string, title: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* ignored */ }
  ctx.api.notify('success', title, text);
}
async function download() {
  await ctx.run(cli(['aws', 's3', 'cp', s3uri.value, leaf.value]), `Downloaded to ${leaf.value} in your lab workspace`);
}
async function open() {
  const result = await ctx.run(cli(['aws', 's3', 'cp', s3uri.value, '-']));
  if (result.ok) body.value = String(result.output || '');
}
async function act(id: string) {
  if (id === 'copy-url') copy(url.value, 'Object URL copied');
  if (id === 'delete') deleting.value = true;
  if (id === 'presign') {
    const result = await ctx.run(cli(['aws', 's3', 'presign', s3uri.value], { '--expires-in': 3600 }));
    if (result.ok) ctx.api.notify('success', 'Presigned URL created', String(result.output || '').trim());
  }
}
async function remove() {
  const result = await ctx.run(cli(['aws', 's3api', 'delete-object'], { '--bucket': bucket.value, '--key': key.value }),
    `Successfully deleted object "${key.value}"`);
  if (result.ok) {
    deleting.value = false;
    const prefix = key.value.includes('/') ? key.value.slice(0, key.value.lastIndexOf('/') + 1) : '';
    ctx.to('s3', 'bucket', { name: bucket.value, prefix });
  }
}
</script>

<style scoped>
.s3ob__p { margin: 0; }
</style>
