<template>
  <CsDelete v-if="mode === 'delete'" title="Delete queue" word="confirm" :busy="busy" @close="$emit('close')" @confirm="go">
    <p class="sd__p">Are you sure you want to delete the queue <strong>{{ queue.name }}</strong>? Any messages in the queue will no longer be available.</p>
  </CsDelete>
  <CsDelete v-else title="Purge queue" word="purge" action="Purge" :busy="busy" @close="$emit('close')" @confirm="go">
    <p class="sd__p">Purging deletes all {{ queue.messages }} message(s) in <strong>{{ queue.name }}</strong>. This action can't be undone and can take up to 60 seconds.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { cli } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import { useAws } from '../ctx';

const props = defineProps<{ queue: Record<string, any>; mode: 'delete' | 'purge' }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'done'): void }>();
const ctx = useAws();
const busy = ref(false);

async function go() {
  busy.value = true;
  const verb = props.mode === 'delete' ? 'delete-queue' : 'purge-queue';
  const result = await ctx.run(cli(['aws', 'sqs', verb], { '--queue-url': props.queue.url }),
    props.mode === 'delete' ? `Successfully deleted ${props.queue.name}.` : `Successfully purged queue ${props.queue.name}.`);
  busy.value = false;
  if (result.ok) {
    emit('done');
    if (props.mode === 'delete' && ctx.route.value.page !== 'queues') ctx.to('sqs', 'queues');
  }
}
</script>

<style scoped>
.sd__p { margin: 0; }
</style>
