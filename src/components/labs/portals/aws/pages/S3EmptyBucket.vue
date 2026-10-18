<template>
  <CsDelete :title="`Empty bucket ${bucket.name}?`" word="permanently delete" action="Empty" :busy="busy"
            @close="$emit('close')" @confirm="empty">
    <div class="cs-alert cs-alert--warning">
      <CsIcon name="status-warning" class="cs-alert__icon" />
      <ul class="s3e__list">
        <li>Emptying the bucket deletes all objects in the bucket and cannot be undone.</li>
        <li>Objects added to the bucket while the empty bucket action is in progress might be deleted.</li>
      </ul>
    </div>
    <p class="s3e__p">The bucket holds <strong>{{ bucket.objects }}</strong> object(s).</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { cli } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsIcon from '../CsIcon.vue';
import { useAws } from '../ctx';

const props = defineProps<{ bucket: Record<string, any> }>();
const emit = defineEmits<{ (e: 'close'): void }>();
const ctx = useAws();
const busy = ref(false);

async function empty() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 's3', 'rm', `s3://${props.bucket.name}`], { '--recursive': true }),
    `Successfully emptied bucket "${props.bucket.name}"`);
  busy.value = false;
  if (result.ok) emit('close');
}
</script>

<style scoped>
.s3e__list { margin: 0; padding-left: 18px; }
.s3e__p { margin: 0; }
</style>
