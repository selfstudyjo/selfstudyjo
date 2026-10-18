<template>
  <CsDelete :title="`Delete bucket ${bucket.name}?`" :word="notEmpty ? '' : bucket.name" :busy="busy"
            action="Delete bucket" @close="$emit('close')" @confirm="remove">
    <div v-if="notEmpty" class="cs-alert cs-alert--error">
      <CsIcon name="status-negative" class="cs-alert__icon" />
      <div>
        <strong>This bucket is not empty</strong>
        Buckets must be empty before they can be deleted. To delete all objects in the bucket, use the
        <button type="button" class="cs-link" @click="emptyFirst">empty bucket configuration</button>.
      </div>
    </div>
    <div v-else class="cs-alert cs-alert--warning">
      <CsIcon name="status-warning" class="cs-alert__icon" />
      <ul class="s3d__list">
        <li>Deleting a bucket cannot be undone.</li>
        <li>Bucket names are unique. If you delete a bucket, another AWS user can use the name.</li>
      </ul>
    </div>
    <p v-if="!notEmpty" class="s3d__p">Bucket name: <strong>{{ bucket.name }}</strong></p>
    <S3EmptyBucket v-if="emptying" :bucket="bucket" @close="emptying = false" />
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsIcon from '../CsIcon.vue';
import { useAws } from '../ctx';
import S3EmptyBucket from './S3EmptyBucket.vue';

const props = defineProps<{ bucket: Record<string, any> }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'done'): void }>();
const ctx = useAws();
const busy = ref(false);
const emptying = ref(false);
const notEmpty = computed(() => Number(props.bucket.objects) > 0);

function emptyFirst() {
  emptying.value = true;
}

async function remove() {
  if (notEmpty.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 's3', 'rb', `s3://${props.bucket.name}`]),
    `Successfully deleted bucket "${props.bucket.name}"`);
  busy.value = false;
  if (result.ok) {
    emit('done');
    emit('close');
    if (ctx.route.value.page !== 'buckets') ctx.to('s3', 'buckets');
  }
}
</script>

<style scoped>
.s3d__list { margin: 0; padding-left: 18px; }
.s3d__p { margin: 0; }
</style>
