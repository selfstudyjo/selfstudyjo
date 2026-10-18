<template>
  <div>
    <CsHeader title="Create bucket"
              description="Buckets are containers for data stored in S3." />

    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="General configuration" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field">
          <label class="cs-label" for="s3c-region">AWS Region</label>
          <select id="s3c-region" v-model="region" class="cs-select s3c__narrow">
            <option v-for="code in regions" :key="code" :value="code">{{ regionName(code) }} {{ code }}</option>
          </select>
        </div>
        <div class="cs-field">
          <span class="cs-label">Bucket type <a class="cs-link s3c__info">Info</a></span>
          <div class="cs-tiles">
            <label class="cs-tile is-checked"><input type="radio" checked />
              <span><strong>General purpose</strong><small>Recommended for most use cases and access patterns. General purpose buckets are the original S3 bucket type. They allow a mix of storage classes that redundantly store objects across multiple Availability Zones.</small></span></label>
            <label class="cs-tile s3c__off"><input type="radio" disabled />
              <span><strong>Directory</strong><small>Recommended for low-latency use cases. These buckets use only the S3 Express One Zone storage class, which provides faster processing of data within a single Availability Zone.</small></span></label>
          </div>
        </div>
        <div class="cs-field">
          <label class="cs-label" for="s3c-name">Bucket name <a class="cs-link s3c__info">Info</a></label>
          <input id="s3c-name" v-model.trim="name" class="cs-input" :class="{ 'is-invalid': nameError }"
                 placeholder="myawsbucket" autocomplete="off" @blur="touched = true" />
          <div v-if="nameError" class="cs-error-text"><CsIcon name="status-warning" size="small" /> {{ nameError }}</div>
          <div class="cs-constraint">Bucket names must be 3 to 63 characters and unique within the global namespace. Bucket names must also begin and end with a letter or number. Valid characters are a-z, 0-9, periods (.), and hyphens (-). <span class="cs-link">Learn More <CsIcon name="external" size="small" /></span></div>
        </div>
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Object Ownership" :level="2"
        description="Control ownership of objects written to this bucket from other AWS accounts and the use of access control lists (ACLs). Object ownership determines who can specify access to objects." /></div>
      <div class="cs-container__body">
        <div class="cs-tiles">
          <label class="cs-tile" :class="{ 'is-checked': acls === 'off' }"><input v-model="acls" type="radio" value="off" />
            <span><strong>ACLs disabled (recommended)</strong><small>All objects in this bucket are owned by this account. Access to this bucket and its objects is specified using only policies.</small></span></label>
          <label class="cs-tile" :class="{ 'is-checked': acls === 'on' }"><input v-model="acls" type="radio" value="on" />
            <span><strong>ACLs enabled</strong><small>Objects in this bucket can be owned by other AWS accounts. Access to this bucket and its objects can be specified using ACLs.</small></span></label>
        </div>
        <p class="s3c__own">Object Ownership: <strong>Bucket owner enforced</strong></p>
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Block Public Access settings for this bucket" :level="2"
        description="Public access is granted to buckets and objects through access control lists (ACLs), bucket policies, access point policies, or all. In order to ensure that public access to this bucket and its objects is blocked, turn on Block all public access. These settings apply only to this bucket and its access points." /></div>
      <div class="cs-container__body cs-stack">
        <label class="cs-check s3c__all"><input v-model="blockAll" type="checkbox" @change="setAll" />
          <span><strong>Block <em>all</em> public access</strong><small>Turning this setting on is the same as turning on all four settings below. Each of the following settings are independent of one another.</small></span></label>
        <div class="s3c__sub">
          <label v-for="(label, index) in blockLabels" :key="index" class="cs-check">
            <input v-model="block[index]" type="checkbox" @change="syncAll" />
            <span>{{ label[0] }}<small>{{ label[1] }}</small></span>
          </label>
        </div>
        <div v-if="!blockAll" class="cs-alert cs-alert--warning">
          <CsIcon name="status-warning" class="cs-alert__icon" />
          <div>
            <strong>Turning off block all public access might result in this bucket and the objects within becoming public</strong>
            AWS recommends that you turn on block all public access, unless public access is required for specific and verified use cases such as static website hosting.
            <label class="cs-check s3c__ack"><input v-model="acknowledge" type="checkbox" />
              <span>I acknowledge that the current settings might result in this bucket and the objects within becoming public.</span></label>
          </div>
        </div>
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Bucket Versioning" :level="2"
        description="Versioning is a means of keeping multiple variants of an object in the same bucket. You can use versioning to preserve, retrieve, and restore every version of every object stored in your Amazon S3 bucket. With versioning, you can easily recover from both unintended user actions and application failures." /></div>
      <div class="cs-container__body">
        <span class="cs-label">Bucket Versioning</span>
        <div class="cs-stack s3c__radios">
          <label class="cs-radio"><input v-model="versioning" type="radio" value="Disable" /> Disable</label>
          <label class="cs-radio"><input v-model="versioning" type="radio" value="Enable" /> Enable</label>
        </div>
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Tags (${tags.length}) - optional`" :level="2"
        description="You can use bucket tags to track storage costs and organize buckets." /></div>
      <div class="cs-container__body">
        <TagEditor v-model="tags" />
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Default encryption" :level="2"
        description="Server-side encryption is automatically applied to new objects stored in this bucket." /></div>
      <div class="cs-container__body cs-stack">
        <span class="cs-label">Encryption type</span>
        <label class="cs-radio"><input type="radio" checked /> Server-side encryption with Amazon S3 managed keys (SSE-S3)</label>
        <label class="cs-radio s3c__off"><input type="radio" disabled /> Server-side encryption with AWS Key Management Service keys (SSE-KMS)</label>
        <label class="cs-radio s3c__off"><input type="radio" disabled /> Dual-layer server-side encryption with AWS Key Management Service keys (DSSE-KMS)</label>
        <span class="cs-label">Bucket Key</span>
        <label class="cs-radio"><input type="radio" disabled /> Disable</label>
        <label class="cs-radio"><input type="radio" checked /> Enable</label>
      </div>
    </section>

    <div class="cs-alert cs-alert--info">
      <CsIcon name="status-info" class="cs-alert__icon" />
      <div>After creating the bucket, you can upload files and folders to the bucket, and configure additional bucket settings.</div>
    </div>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('s3', 'buckets')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || (!blockAll && !acknowledge)" @click="create">
        <span v-if="busy" class="cs-btn__spinner" />Create bucket
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, pick } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { useAws } from '../ctx';
import { regionName } from '../nav';
import { tagShorthand } from '../commands';

const ctx = useAws();
const regions = computed(() => pick<string[]>(ctx.view.value, 'regions', [ctx.region.value]));
const region = ref(ctx.region.value);
const name = ref('');
const touched = ref(false);
const acls = ref('off');
const blockAll = ref(true);
const block = ref([true, true, true, true]);
const acknowledge = ref(false);
const versioning = ref('Disable');
const tags = ref<Tag[]>([]);
const busy = ref(false);

const blockLabels: [string, string][] = [
  ['Block public access to buckets and objects granted through new access control lists (ACLs)', 'S3 will block public access permissions applied to newly added buckets or objects, and prevent the creation of new public access ACLs for existing buckets and objects.'],
  ['Block public access to buckets and objects granted through any access control lists (ACLs)', 'S3 will ignore all ACLs that grant public access to buckets and objects.'],
  ['Block public access to buckets and objects granted through new public bucket or access point policies', 'S3 will block new bucket and access point policies that grant public access to buckets and objects.'],
  ['Block public and cross-account access to buckets and objects through any public bucket or access point policies', 'S3 will ignore public and cross-account access for buckets or access points with policies that grant public access to buckets and objects.'],
];

const nameError = computed(() => {
  if (!touched.value && !name.value) return '';
  const value = name.value;
  if (!value) return 'Bucket name must not be empty.';
  if (value.length < 3 || value.length > 63) return 'Bucket name must be between 3 and 63 characters long.';
  if (/[A-Z]/.test(value)) return 'Bucket name must not contain uppercase characters.';
  if (!/^[a-z0-9.-]+$/.test(value)) return 'Bucket name can contain only lowercase letters, numbers, periods (.), and hyphens (-).';
  if (!/^[a-z0-9].*[a-z0-9]$/.test(value)) return 'Bucket name must start and end with a letter or number.';
  if (rowsHave(value)) return 'Bucket with the same name already exists.';
  return '';
});
function rowsHave(value: string) {
  return pick<any[]>(ctx.view.value, 's3.buckets', []).some(b => b?.name === value);
}

function setAll() {
  block.value = block.value.map(() => blockAll.value);
}
function syncAll() {
  blockAll.value = block.value.every(Boolean);
}

async function create() {
  touched.value = true;
  if (nameError.value) return;
  busy.value = true;
  const bucket = name.value;
  const made = await ctx.run(cli(['aws', 's3', 'mb', `s3://${bucket}`],
    { '--region': region.value !== ctx.region.value ? region.value : '' }));
  if (!made.ok) { busy.value = false; return; }
  if (!blockAll.value) {
    const [a, b, c, d] = block.value.map(flag => String(flag));
    await ctx.run(cli(['aws', 's3api', 'put-public-access-block'], {
      '--bucket': bucket,
      '--public-access-block-configuration':
        `BlockPublicAcls=${a},IgnorePublicAcls=${b},BlockPublicPolicy=${c},RestrictPublicBuckets=${d}`,
    }));
  }
  if (versioning.value === 'Enable') {
    await ctx.run(cli(['aws', 's3api', 'put-bucket-versioning'], {
      '--bucket': bucket, '--versioning-configuration': 'Status=Enabled',
    }));
  }
  const filled = tags.value.filter(tag => tag.key.trim());
  if (filled.length) {
    await ctx.run(cli(['aws', 's3api', 'put-bucket-tagging'], {
      '--bucket': bucket, '--tagging': `TagSet=[${tagShorthand(filled)}]`,
    }));
  }
  busy.value = false;
  ctx.api.notify('success', `Successfully created bucket "${bucket}"`,
    'To upload files and folders, or to configure additional bucket settings, choose View details.');
  ctx.to('s3', 'buckets');
}
</script>

<style scoped>
.s3c__narrow { max-width: 420px; }
.s3c__info { font-size: 12px; font-weight: 700; margin-left: 4px; }
.s3c__off { opacity: .55; cursor: default; }
.s3c__own { margin: 12px 0 0; }
.s3c__all strong em { font-style: italic; }
.s3c__sub { display: flex; flex-direction: column; gap: 10px; padding-left: 24px; border-left: 1px solid #c6c6cd; margin-left: 6px; }
.s3c__ack { margin-top: 8px; }
.s3c__radios { gap: 8px; margin-top: 6px; }
</style>
