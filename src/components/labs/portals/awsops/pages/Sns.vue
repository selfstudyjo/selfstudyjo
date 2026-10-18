<template>
  <CsTable v-if="page === 'topics'" variant="full-page" title="Topics" :items="topics" :columns="topicCols" track-by="arn" selection-type="single" v-model:selected="sel"
           empty-title="No topics" empty-text="To get started, create a topic.">
    <template #actions>
      <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = topics.find(t => t.arn === sel[0])">Delete</button>
      <button type="button" class="cs-btn cs-btn--primary" @click="creating = true">Create topic</button>
    </template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('sns', 'topic', { arn: row.arn, name: row.name })">{{ row.name }}</a></template>
  </CsTable>

  <div v-else-if="page === 'topic' && topic">
    <CsHeader :title="topic.name">
      <template #actions>
        <button type="button" class="cs-btn" @click="deleting = topic">Delete</button>
        <button type="button" class="cs-btn" @click="publishing = true">Publish message</button>
      </template>
    </CsHeader>
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Name</dt><dd>{{ topic.name }}</dd></div><div><dt>ARN</dt><dd class="cs-mono">{{ topic.arn }}</dd></div><div><dt>Type</dt><dd>Standard</dd></div>
    </dl></div></section>
    <CsTable title="Subscriptions" :items="topicSubs" :columns="subCols" track-by="arn" selection-type="single" v-model:selected="subSel" empty-title="No subscriptions">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!subSel.length || busy" @click="unsubscribe">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="openSubscribe(topic.arn)">Create subscription</button>
      </template>
      <template #cell-status="{ row }"><CsStatus :type="row.status === 'Confirmed' ? 'success' : 'pending'" :label="row.status === 'Confirmed' ? 'Confirmed' : 'Pending confirmation'" /></template>
    </CsTable>
  </div>

  <CsTable v-else-if="page === 'subscriptions'" variant="full-page" title="Subscriptions" :items="subs" :columns="subCols" track-by="arn" selection-type="single" v-model:selected="subSel"
           empty-title="No subscriptions">
    <template #actions>
      <button type="button" class="cs-btn" :disabled="!subSel.length || busy" @click="unsubscribe">Delete</button>
      <button type="button" class="cs-btn cs-btn--primary" @click="openSubscribe(topics[0]?.arn || '')">Create subscription</button>
    </template>
    <template #cell-status="{ row }"><CsStatus :type="row.status === 'Confirmed' ? 'success' : 'pending'" :label="row.status === 'Confirmed' ? 'Confirmed' : 'Pending confirmation'" /></template>
  </CsTable>

  <CsModal v-if="creating" title="Create topic" @close="creating = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Type</label><select class="cs-select" disabled><option>Standard</option></select></div>
      <div class="cs-field"><label class="cs-label">Name</label><input v-model="name" class="cs-input" placeholder="MyTopic" />
        <span class="cs-constraint">Maximum 256 characters. Can include alphanumeric characters, hyphens (-) and underscores (_).</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="creating = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !/^[\w-]{1,256}$/.test(name)" @click="create">Create topic</button>
    </template>
  </CsModal>

  <CsModal v-if="subscribing" title="Create subscription" @close="subscribing = false">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Topic ARN</label><select v-model="sf.topic" class="cs-select"><option v-for="t in topics" :key="t.arn" :value="t.arn">{{ t.arn }}</option></select></div>
      <div class="cs-field"><label class="cs-label">Protocol</label><select v-model="sf.protocol" class="cs-select"><option value="https">HTTPS</option><option value="email">Email</option><option value="sms">SMS</option></select></div>
      <div class="cs-field"><label class="cs-label">Endpoint</label><input v-model="sf.endpoint" class="cs-input" :placeholder="sf.protocol === 'https' ? 'https://acme.service-now.com/...' : 'ops@acmepay.example'" /></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="subscribing = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !sf.topic || !sf.endpoint.trim()" @click="subscribe">Create subscription</button>
    </template>
  </CsModal>

  <CsModal v-if="publishing" title="Publish message to topic" @close="publishing = false">
    <div class="cs-field"><label class="cs-label">Message body</label><textarea v-model="message" class="cs-textarea" /></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="publishing = false">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !message.trim()" @click="publish">Publish message</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete topic" word="delete me" :busy="busy" @close="deleting = null" @confirm="remove">
    <p class="sn__p">Are you sure you want to delete the topic {{ deleting.name }}? Its subscriptions are deleted with it.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const subSel = ref<string[]>([]);
const busy = ref(false);
const creating = ref(false);
const subscribing = ref(false);
const publishing = ref(false);
const deleting = ref<any>(null);
const name = ref('');
const message = ref('');

const topics = computed(() => rows<any>(ctx.c.value, 'monitoring.topics').map(t => ({ ...t, type: 'Standard' })));
const topic = computed<any>(() => topics.value.find(t => t.arn === ctx.route.value.params?.arn) || null);
const subs = computed(() => rows<any>(ctx.c.value, 'monitoring.subscriptions').map(s => ({ ...s, idText: s.status === 'Confirmed' ? s.arn.split(':').pop() : 'Pending confirmation' })));
const topicSubs = computed(() => subs.value.filter(s => s.topic === topic.value?.arn));
const topicCols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'type', header: 'Type' }, { id: 'arn', header: 'ARN' }];
const subCols = [{ id: 'idText', header: 'ID' }, { id: 'endpoint', header: 'Endpoint' }, { id: 'status', header: 'Status' }, { id: 'protocol', header: 'Protocol' },
  { id: 'topic', header: 'Topic', cell: (s: any) => s.topic.split(':').pop() }];

async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sns', 'create-topic'], { '--name': name.value }), `Topic ${name.value} created successfully.`);
  busy.value = false;
  if (result.ok) { creating.value = false; name.value = ''; }
}
const sf = reactive({ topic: '', protocol: 'https', endpoint: '' });
function openSubscribe(arn: string) { sf.topic = arn; sf.endpoint = ''; subscribing.value = true; }
async function subscribe() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sns', 'subscribe'], { '--topic-arn': sf.topic, '--protocol': sf.protocol, '--notification-endpoint': sf.endpoint.trim() }),
    'Subscription created.');
  busy.value = false;
  if (result.ok) subscribing.value = false;
}
async function unsubscribe() {
  busy.value = true;
  await ctx.run(cli(['aws', 'sns', 'unsubscribe'], { '--subscription-arn': subSel.value[0] }), 'Subscription deleted.');
  busy.value = false;
  subSel.value = [];
}
async function publish() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'sns', 'publish'], { '--topic-arn': topic.value.arn, '--message': message.value }), 'Message published to topic.');
  busy.value = false;
  if (result.ok) { publishing.value = false; message.value = ''; }
}
async function remove() {
  busy.value = true;
  const t = deleting.value;
  const result = await ctx.run(cli(['aws', 'sns', 'delete-topic'], { '--topic-arn': t.arn }), `Topic ${t.name} deleted successfully.`);
  busy.value = false;
  deleting.value = null;
  sel.value = [];
  if (result.ok && page.value === 'topic') ctx.to('sns', 'topics');
}
</script>

<style scoped>
.sn__p { margin: 0; }
</style>
