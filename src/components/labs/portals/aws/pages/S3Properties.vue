<template>
  <div>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Bucket overview" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv">
          <div><dt>AWS Region</dt><dd>{{ regionName(bucket.region) }} {{ bucket.region }}</dd></div>
          <div><dt>Amazon Resource Name (ARN)</dt><dd class="cs-mono">{{ bucket.arn }}</dd></div>
          <div><dt>Creation date</dt><dd>{{ awsDate(bucket.created) }}</dd></div>
        </dl>
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head">
        <CsHeader title="Bucket Versioning" :level="2"
                  description="Versioning is a means of keeping multiple variants of an object in the same bucket. You can use versioning to preserve, retrieve, and restore every version of every object stored in your Amazon S3 bucket.">
          <template #actions><button v-if="edit !== 'versioning'" type="button" class="cs-btn" @click="startVersioning">Edit</button></template>
        </CsHeader>
      </div>
      <div class="cs-container__body">
        <template v-if="edit === 'versioning'">
          <span class="cs-label">Bucket Versioning</span>
          <div class="cs-stack s3p__radios">
            <label class="cs-radio"><input v-model="versioning" type="radio" value="Suspended" /> Suspend
              <small>This suspends the creation of object versions for all operations but preserves any existing object versions.</small></label>
            <label class="cs-radio"><input v-model="versioning" type="radio" value="Enabled" /> Enable</label>
          </div>
          <div v-if="bucket.versioning === 'Disabled' && versioning === 'Suspended'" class="cs-alert cs-alert--info s3p__gap">
            <CsIcon name="status-info" class="cs-alert__icon" /><div>Versioning has never been enabled on this bucket, so it stays <strong>Disabled</strong> until you enable it.</div>
          </div>
          <div class="cs-form-actions">
            <button type="button" class="cs-btn cs-btn--link" @click="edit = ''">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveVersioning">Save changes</button>
          </div>
        </template>
        <dl v-else class="cs-kv"><div><dt>Bucket Versioning</dt><dd>{{ bucket.versioning }}</dd></div>
          <div><dt>Multi-factor authentication (MFA) delete</dt><dd>Disabled</dd></div></dl>
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head">
        <CsHeader :title="`Tags (${tagList.length})`" :level="2" description="You can use bucket tags to track storage costs and organize buckets.">
          <template #actions><button v-if="edit !== 'tags'" type="button" class="cs-btn" @click="startTags">Edit</button></template>
        </CsHeader>
      </div>
      <div class="cs-container__body">
        <template v-if="edit === 'tags'">
          <TagEditor v-model="tags" />
          <div class="cs-form-actions">
            <button type="button" class="cs-btn cs-btn--link" @click="edit = ''">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || tags.some(t => tagProblem(t))" @click="saveTags">Save changes</button>
          </div>
        </template>
        <table v-else-if="tagList.length" class="cs-table-mini">
          <thead><tr><th>Key</th><th>Value</th></tr></thead>
          <tbody><tr v-for="tag in tagList" :key="tag.key"><td>{{ tag.key }}</td><td>{{ tag.value || '-' }}</td></tr></tbody>
        </table>
        <div v-else class="cs-empty"><strong>No tags</strong>There are no tags associated with this resource.</div>
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Default encryption" :level="2" description="Server-side encryption is automatically applied to new objects stored in this bucket." /></div>
      <div class="cs-container__body">
        <dl class="cs-kv"><div><dt>Encryption type</dt><dd>Server-side encryption with Amazon S3 managed keys (SSE-S3)</dd></div>
          <div><dt>Bucket Key</dt><dd>Enabled</dd></div></dl>
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head">
        <CsHeader title="Static website hosting" :level="2"
                  description="Use this bucket to host a website or redirect requests.">
          <template #actions><button v-if="edit !== 'website'" type="button" class="cs-btn" @click="startWebsite">Edit</button></template>
        </CsHeader>
      </div>
      <div class="cs-container__body">
        <template v-if="edit === 'website'">
          <div class="cs-stack">
            <div>
              <span class="cs-label">Static website hosting</span>
              <div class="cs-stack s3p__radios">
                <label class="cs-radio"><input v-model="site.enabled" type="radio" :value="false" /> Disable</label>
                <label class="cs-radio"><input v-model="site.enabled" type="radio" :value="true" /> Enable</label>
              </div>
            </div>
            <template v-if="site.enabled">
              <div class="cs-tiles">
                <label class="cs-tile is-checked"><input type="radio" checked /><span><strong>Host a static website</strong><small>Use the bucket endpoint as the web address.</small></span></label>
                <label class="cs-tile s3p__off"><input type="radio" disabled /><span><strong>Redirect requests for an object</strong><small>Redirect requests to another bucket or domain.</small></span></label>
              </div>
              <div v-if="bucket.block_public" class="cs-alert cs-alert--info">
                <CsIcon name="status-info" class="cs-alert__icon" />
                <div>For your customers to access content at the website endpoint, you must make all your content publicly readable. To do so, you can edit the S3 Block Public Access settings for the bucket.</div>
              </div>
              <div class="cs-field">
                <label class="cs-label" for="s3p-index">Index document</label>
                <div class="cs-desc">Specify the home or default page of the website.</div>
                <input id="s3p-index" v-model.trim="site.index" class="cs-input" placeholder="index.html" />
              </div>
              <div class="cs-field">
                <label class="cs-label" for="s3p-error">Error document <small>- optional</small></label>
                <div class="cs-desc">This is returned when an error occurs.</div>
                <input id="s3p-error" v-model.trim="site.error" class="cs-input" placeholder="error.html" />
              </div>
            </template>
          </div>
          <div class="cs-form-actions">
            <button type="button" class="cs-btn cs-btn--link" @click="edit = ''">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || (site.enabled && !site.index)" @click="saveWebsite">Save changes</button>
          </div>
        </template>
        <dl v-else class="cs-kv">
          <div><dt>Static website hosting</dt><dd>{{ bucket.website ? 'Enabled' : 'Disabled' }}</dd></div>
          <template v-if="bucket.website">
            <div><dt>Hosting type</dt><dd>Bucket hosting</dd></div>
            <div><dt>Bucket website endpoint</dt><dd><span class="cs-link">{{ bucket.endpoint }}</span></dd></div>
            <div><dt>Index document</dt><dd>{{ bucket.website_index || 'index.html' }}</dd></div>
            <div><dt>Error document</dt><dd>{{ bucket.website_error || '-' }}</dd></div>
          </template>
        </dl>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { tagProblem, tagShorthand } from '../commands';
import { awsDate, useAws } from '../ctx';
import { regionName } from '../nav';

const props = defineProps<{ bucket: Record<string, any> }>();
const ctx = useAws();
const edit = ref<'' | 'versioning' | 'tags' | 'website'>('');
const busy = ref(false);
const versioning = ref('Enabled');
const tags = ref<Tag[]>([]);
const site = reactive({ enabled: false, index: 'index.html', error: '' });

const tagList = computed(() => Object.entries(props.bucket.tags || {}).map(([key, value]) => ({ key, value: String(value) })));

function startVersioning() {
  versioning.value = props.bucket.versioning === 'Enabled' ? 'Enabled' : 'Suspended';
  edit.value = 'versioning';
}
async function saveVersioning() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 's3api', 'put-bucket-versioning'], {
    '--bucket': props.bucket.name, '--versioning-configuration': `Status=${versioning.value}`,
  }), `Successfully edited Bucket Versioning.`);
  busy.value = false;
  if (result.ok) edit.value = '';
}
function startTags() {
  tags.value = tagList.value.map(tag => ({ ...tag }));
  edit.value = 'tags';
}
async function saveTags() {
  busy.value = true;
  const filled = tags.value.filter(tag => tag.key.trim());
  const command = filled.length
    ? cli(['aws', 's3api', 'put-bucket-tagging'], { '--bucket': props.bucket.name, '--tagging': `TagSet=[${tagShorthand(filled)}]` })
    : cli(['aws', 's3api', 'delete-bucket-tagging'], { '--bucket': props.bucket.name });
  const result = await ctx.run(command, 'Successfully edited tags.');
  busy.value = false;
  if (result.ok) edit.value = '';
}
function startWebsite() {
  site.enabled = Boolean(props.bucket.website);
  site.index = props.bucket.website_index || 'index.html';
  site.error = props.bucket.website_error || '';
  edit.value = 'website';
}
async function saveWebsite() {
  busy.value = true;
  const command = site.enabled
    ? cli(['aws', 's3', 'website', `s3://${props.bucket.name}`], { '--index-document': site.index, '--error-document': site.error })
    : cli(['aws', 's3api', 'delete-bucket-website'], { '--bucket': props.bucket.name });
  const result = await ctx.run(command, 'Successfully edited static website hosting.');
  busy.value = false;
  if (result.ok) edit.value = '';
}
</script>

<style scoped>
.s3p__radios { gap: 8px; margin-top: 6px; }
.s3p__gap { margin-top: 12px; }
.s3p__off { opacity: .55; cursor: default; }
</style>
