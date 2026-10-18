<template>
  <div>
    <CsTable v-model:selected="selected" :title="topic ? 'Subscriptions' : 'Subscriptions'" :variant="topic ? 'container' : 'full-page'"
             :items="subs" :columns="columns" track-by="arn" selection-type="single" filter-placeholder="Search"
             empty-title="No subscriptions found" empty-text="You don't have any subscriptions.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!current" @click="deleting = true">Delete</button>
        <button type="button" class="cs-btn" disabled>Request confirmation</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="creating = true">Create subscription</button>
      </template>
      <template #cell-status="{ row }"><CsStatus :state="row.confirmed ? 'confirmed' : 'pending confirmation'" /></template>
    </CsTable>

    <CsModal v-if="creating" title="Create subscription" @close="creating = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="ss-topic">Topic ARN</label>
          <select id="ss-topic" v-model="topicArn" class="cs-select" :disabled="!!topic">
            <option v-for="t in topics" :key="t.arn" :value="t.arn">{{ t.arn }}</option></select></div>
        <div class="cs-field"><label class="cs-label" for="ss-proto">Protocol</label>
          <div class="cs-desc">The type of endpoint to subscribe</div>
          <select id="ss-proto" v-model="protocol" class="cs-select">
            <option value="email">Email</option><option value="email-json">Email-JSON</option><option value="https">HTTPS</option>
            <option value="http">HTTP</option><option value="sqs">Amazon SQS</option><option value="lambda">AWS Lambda</option><option value="sms">SMS</option>
          </select></div>
        <div class="cs-field"><label class="cs-label" for="ss-end">Endpoint</label>
          <select v-if="protocol === 'sqs'" id="ss-end" v-model="endpoint" class="cs-select">
            <option value="" disabled>Choose a queue</option><option v-for="q in queues" :key="q.arn" :value="q.arn">{{ q.arn }}</option></select>
          <select v-else-if="protocol === 'lambda'" id="ss-end" v-model="endpoint" class="cs-select">
            <option value="" disabled>Choose a function</option><option v-for="f in functions" :key="f.arn" :value="f.arn">{{ f.arn }}</option></select>
          <input v-else id="ss-end" v-model.trim="endpoint" class="cs-input" :placeholder="placeholder" />
          <div v-if="protocol.startsWith('email')" class="cs-constraint">After your subscription is created, you must confirm it.</div></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="creating = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!topicArn || !endpoint || busy" @click="subscribe">Create subscription</button>
      </template>
    </CsModal>
    <CsDelete v-if="deleting && current" title="Delete subscription" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="sst__p">Are you sure you want to delete this subscription? {{ current.protocol }} → {{ current.endpoint }}</p>
    </CsDelete>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsModal from '../CsModal.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const props = defineProps<{ topic?: Record<string, any> | null }>();
const ctx = useAws();
const topics = computed(() => rows(ctx.view.value, 'sns'));
const queues = computed(() => rows(ctx.view.value, 'sqs'));
const functions = computed(() => rows(ctx.view.value, 'lambda'));
const subs = computed(() => topics.value
  .filter(t => !props.topic || t.arn === props.topic.arn)
  .flatMap(t => (t.subscriptions || []).map((s: any) => ({ ...s, topic: t.arn, id: String(s.arn).split(':').pop() }))));
const selected = ref<string[]>([]);
const current = computed(() => subs.value.find(s => s.arn === selected.value[0]) || null);
const creating = ref(ctx.route.value.page === 'subscribe');
const deleting = ref(false);
const busy = ref(false);
const topicArn = ref(props.topic?.arn || topics.value[0]?.arn || '');
const protocol = ref('email');
const endpoint = ref('');
watch(protocol, () => { endpoint.value = ''; });

const placeholder = computed(() => ({ email: 'user@example.com', 'email-json': 'user@example.com', https: 'https://www.example.com', http: 'http://www.example.com', sms: '+1 206-555-0100' } as Record<string, string>)[protocol.value] || '');
const columns: Column[] = [
  { id: 'id', header: 'ID' },
  { id: 'endpoint', header: 'Endpoint', sortKey: 'endpoint' },
  { id: 'status', header: 'Status' },
  { id: 'protocol', header: 'Protocol', sortKey: 'protocol', cell: r => String(r.protocol).toUpperCase() },
  { id: 'topic', header: 'Topic', cell: r => String(r.topic).split(':').pop() },
];

async function subscribe() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sns', 'subscribe'], {
    '--topic-arn': topicArn.value, '--protocol': protocol.value, '--notification-endpoint': endpoint.value,
  }), protocol.value.startsWith('email') || protocol.value.startsWith('http')
    ? 'Subscription created successfully. Status: Pending confirmation.' : 'Subscription created successfully.');
  busy.value = false;
  if (result.ok) { creating.value = false; endpoint.value = ''; }
}
async function remove() {
  if (!current.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sns', 'unsubscribe'], { '--subscription-arn': current.value.arn }),
    'Subscription deleted successfully.');
  busy.value = false;
  if (result.ok) { deleting.value = false; selected.value = []; }
}
</script>

<style scoped>
.sst__p { margin: 0; }
</style>
