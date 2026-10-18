<template>
  <div>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Permissions overview" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <dl class="cs-kv"><div><dt>Access finding</dt>
          <dd>{{ bucket.block_public ? 'Bucket and objects not public' : 'Objects can be public' }}</dd></div></dl>
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head">
        <CsHeader title="Block public access (bucket settings)" :level="2"
                  description="Public access is granted to buckets and objects through access control lists (ACLs), bucket policies, access point policies, or all. In order to ensure that public access to all your S3 buckets and objects is blocked, turn on Block all public access. These settings apply only to this bucket and its access points.">
          <template #actions><button v-if="!editing" type="button" class="cs-btn" @click="start">Edit</button></template>
        </CsHeader>
      </div>
      <div class="cs-container__body">
        <template v-if="editing">
          <label class="cs-check"><input v-model="all" type="checkbox" @change="flags = flags.map(() => all)" />
            <span><strong>Block all public access</strong></span></label>
          <div class="s3m__sub">
            <label v-for="(label, i) in labels" :key="i" class="cs-check">
              <input v-model="flags[i]" type="checkbox" @change="all = flags.every(Boolean)" /> <span>{{ label }}</span></label>
          </div>
          <div class="cs-form-actions">
            <button type="button" class="cs-btn cs-btn--link" @click="editing = false">Cancel</button>
            <button type="button" class="cs-btn cs-btn--primary" @click="confirming = true">Save changes</button>
          </div>
        </template>
        <div v-else class="s3m__state">
          <div class="s3m__line"><strong>Block <em>all</em> public access</strong>
            <CsStatus :type="bucket.block_public ? 'success' : 'warning'" :label="bucket.block_public ? 'On' : 'Off'" /></div>
        </div>
      </div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Bucket policy" :level="2" description="The bucket policy, written in JSON, provides access to the objects stored in the bucket. Bucket policies don't apply to objects owned by other accounts." /></div>
      <div class="cs-container__body"><div class="cs-empty"><strong>No policy to display.</strong></div></div>
    </section>

    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Object Ownership" :level="2" description="Control ownership of objects written to this bucket from other AWS accounts and the use of access control lists (ACLs)." /></div>
      <div class="cs-container__body"><dl class="cs-kv"><div><dt>Object Ownership</dt><dd>Bucket owner enforced</dd></div>
        <div><dt>ACLs</dt><dd>ACLs are disabled. All objects in this bucket are owned by this account.</dd></div></dl></div>
    </section>

    <CsDelete v-if="confirming" title="Edit Block public access (bucket settings)" word="confirm" action="Confirm"
              :busy="busy" @close="confirming = false" @confirm="save">
      <p class="s3m__p">Updating the Block Public Access settings for this bucket will affect this bucket and all objects within. This may result in some objects becoming public.</p>
    </CsDelete>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { cli } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsHeader from '../CsHeader.vue';
import CsStatus from '../CsStatus.vue';
import { useAws } from '../ctx';

const props = defineProps<{ bucket: Record<string, any> }>();
const ctx = useAws();
const editing = ref(false);
const confirming = ref(false);
const busy = ref(false);
const all = ref(true);
const flags = ref([true, true, true, true]);
const labels = [
  'Block public access to buckets and objects granted through new access control lists (ACLs)',
  'Block public access to buckets and objects granted through any access control lists (ACLs)',
  'Block public access to buckets and objects granted through new public bucket or access point policies',
  'Block public and cross-account access to buckets and objects through any public bucket or access point policies',
];

function start() {
  all.value = Boolean(props.bucket.block_public);
  flags.value = [0, 1, 2, 3].map(() => all.value);
  editing.value = true;
}
async function save() {
  busy.value = true;
  const [a, b, c, d] = flags.value.map(String);
  const result = await ctx.run(cli(['aws', 's3api', 'put-public-access-block'], {
    '--bucket': props.bucket.name,
    '--public-access-block-configuration': `BlockPublicAcls=${a},IgnorePublicAcls=${b},BlockPublicPolicy=${c},RestrictPublicBuckets=${d}`,
  }), 'Successfully edited Block Public Access settings for this bucket.');
  busy.value = false;
  if (result.ok) { confirming.value = false; editing.value = false; }
}
</script>

<style scoped>
.s3m__sub { display: flex; flex-direction: column; gap: 8px; padding: 10px 0 0 24px; }
.s3m__line { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.s3m__line em { font-style: italic; }
.s3m__p { margin: 0; }
</style>
